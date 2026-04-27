const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const TaskVersion = require('../models/TaskVersion');
const { protect, projectMember } = require('../middleware/auth');
const { validateDependencies } = require('../services/executionService');
const { logAudit } = require('../services/auditService');
const { triggerWebhook } = require('../services/webhookService');
const { emitToProject } = require('../socket');

// Helper to create version
const createTaskVersion = async (task, changedBy, changeType) => {
  await TaskVersion.create({
    task: task._id,
    versionNumber: task.versionNumber,
    title: task.title,
    description: task.description,
    priority: task.priority,
    estimatedHours: task.estimatedHours,
    status: task.status,
    dependencies: task.dependencies,
    resourceTag: task.resourceTag,
    maxRetries: task.maxRetries,
    retryCount: task.retryCount,
    changedBy,
    changeType
  });
};

// @route   GET /api/tasks/project/:projectId
// @desc    Get all tasks for a project
// @access  Private (members only)
router.get('/project/:projectId', protect, projectMember, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('dependencies', 'title status')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a task
// @access  Private (project members only)
router.post('/', protect, [
  body('projectId').notEmpty().withMessage('Project ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('priority').optional().isInt({ min: 1, max: 5 }),
  body('estimatedHours').optional().isFloat({ min: 0 }),
  body('dependencies').optional().isArray(),
  body('resourceTag').optional().trim(),
  body('maxRetries').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { projectId, title, description, priority, estimatedHours, dependencies, resourceTag, maxRetries } = req.body;

    // Check project membership
    const Project = require('../models/Project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this project' });
    }

    // Validate dependencies if provided
    if (dependencies && dependencies.length > 0) {
      // Create a temporary ID for validation
      const tempId = 'temp-' + Date.now();
      const validation = await validateDependencies(tempId, dependencies, projectId);
      
      if (!validation.valid) {
        await logAudit({
          actor: req.user._id,
          action: 'dependency.rejected',
          entityType: 'Task',
          projectId,
          metadata: { error: validation.error, dependencies }
        });
        return res.status(400).json({ message: validation.error });
      }
    }

    const task = await Task.create({
      project: projectId,
      title,
      description,
      priority: priority || 3,
      estimatedHours: estimatedHours || 1,
      dependencies: dependencies || [],
      resourceTag: resourceTag || 'default',
      maxRetries: maxRetries || 3,
      createdBy: req.user._id
    });

    // Create initial version
    await createTaskVersion(task, req.user._id, 'created');

    await logAudit({
      actor: req.user._id,
      action: 'task.created',
      entityType: 'Task',
      entityId: task._id,
      projectId,
      metadata: { title }
    });

    const populatedTask = await Task.findById(task._id)
      .populate('dependencies', 'title status')
      .populate('createdBy', 'name email');

    // Emit socket event
    emitToProject(projectId, 'task-created', populatedTask);

    // Trigger webhook
    await triggerWebhook(projectId, 'task.created', {
      taskId: task._id,
      title: task.title
    });

    res.status(201).json(populatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:taskId
// @desc    Get single task
// @access  Private
router.get('/:taskId', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('dependencies', 'title status')
      .populate('createdBy', 'name email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check project membership
    const Project = require('../models/Project');
    const project = await Project.findById(task.project);
    
    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:taskId
// @desc    Update task
// @access  Private (project members only)
router.put('/:taskId', protect, [
  body('versionNumber').notEmpty().withMessage('Version number is required for updates'),
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('priority').optional().isInt({ min: 1, max: 5 }),
  body('estimatedHours').optional().isFloat({ min: 0 }),
  body('dependencies').optional().isArray(),
  body('resourceTag').optional().trim(),
  body('maxRetries').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check project membership
    const Project = require('../models/Project');
    const project = await Project.findById(task.project);
    
    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Optimistic concurrency check
    if (req.body.versionNumber !== task.versionNumber) {
      return res.status(409).json({
        message: 'Version conflict. Task has been modified by another user.',
        currentVersion: task.versionNumber,
        yourVersion: req.body.versionNumber,
        currentTask: task
      });
    }

    const { title, description, priority, estimatedHours, dependencies, resourceTag, maxRetries } = req.body;

    // Validate dependencies if changed
    if (dependencies && JSON.stringify(dependencies) !== JSON.stringify(task.dependencies.map(d => d.toString()))) {
      const validation = await validateDependencies(task._id, dependencies, task.project);
      
      if (!validation.valid) {
        await logAudit({
          actor: req.user._id,
          action: 'dependency.rejected',
          entityType: 'Task',
          entityId: task._id,
          projectId: task.project,
          metadata: { error: validation.error, dependencies }
        });
        return res.status(400).json({ message: validation.error });
      }
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
    if (dependencies !== undefined) task.dependencies = dependencies;
    if (resourceTag !== undefined) task.resourceTag = resourceTag;
    if (maxRetries !== undefined) task.maxRetries = maxRetries;

    task.versionNumber += 1;
    await task.save();

    // Create version
    await createTaskVersion(task, req.user._id, 'updated');

    await logAudit({
      actor: req.user._id,
      action: 'task.updated',
      entityType: 'Task',
      entityId: task._id,
      projectId: task.project
    });

    const populatedTask = await Task.findById(task._id)
      .populate('dependencies', 'title status')
      .populate('createdBy', 'name email');

    // Emit socket event
    emitToProject(task.project.toString(), 'task-updated', populatedTask);

    // Trigger webhook
    await triggerWebhook(task.project, 'task.updated', {
      taskId: task._id,
      title: task.title,
      versionNumber: task.versionNumber
    });

    res.json(populatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:taskId/status
// @desc    Update task status
// @access  Private (project members only)
router.put('/:taskId/status', protect, [
  body('status').isIn(['Pending', 'Running', 'Completed', 'Failed', 'Blocked']).withMessage('Invalid status'),
  body('versionNumber').notEmpty().withMessage('Version number is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check project membership
    const Project = require('../models/Project');
    const project = await Project.findById(task.project);
    
    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Optimistic concurrency check
    if (req.body.versionNumber !== task.versionNumber) {
      return res.status(409).json({
        message: 'Version conflict. Task has been modified by another user.',
        currentVersion: task.versionNumber,
        yourVersion: req.body.versionNumber,
        currentTask: task
      });
    }

    const newStatus = req.body.status;
    const oldStatus = task.status;

    // Validation for Running status
    if (newStatus === 'Running') {
      // Check all dependencies are completed
      const depTasks = await Task.find({ _id: { $in: task.dependencies } });
      const allDepsCompleted = depTasks.every(d => d.status === 'Completed');
      
      if (!allDepsCompleted) {
        return res.status(400).json({ 
          message: 'Cannot start task: not all dependencies are completed' 
        });
      }

      // Check resource constraint
      const runningWithSameResource = await Task.findOne({
        project: task.project,
        _id: { $ne: task._id },
        resourceTag: task.resourceTag,
        status: 'Running'
      });

      if (runningWithSameResource) {
        return res.status(400).json({
          message: `Cannot start task: another task with resource tag "${task.resourceTag}" is already running`
        });
      }
    }

    task.status = newStatus;
    task.versionNumber += 1;
    await task.save();

    // Create version
    await createTaskVersion(task, req.user._id, 'status_change');

    await logAudit({
      actor: req.user._id,
      action: 'task.status_changed',
      entityType: 'Task',
      entityId: task._id,
      projectId: task.project,
      metadata: { oldStatus, newStatus }
    });

    // If task failed, log it
    if (newStatus === 'Failed') {
      await logAudit({
        actor: req.user._id,
        action: 'task.failed',
        entityType: 'Task',
        entityId: task._id,
        projectId: task.project
      });
    }

    const populatedTask = await Task.findById(task._id)
      .populate('dependencies', 'title status')
      .populate('createdBy', 'name email');

    // Emit socket event
    emitToProject(task.project.toString(), 'task-status-changed', {
      task: populatedTask,
      oldStatus,
      newStatus
    });

    // Trigger webhook for completed/failed
    if (newStatus === 'Completed') {
      await triggerWebhook(task.project, 'task.completed', {
        taskId: task._id,
        title: task.title
      });
    } else if (newStatus === 'Failed') {
      await triggerWebhook(task.project, 'task.failed', {
        taskId: task._id,
        title: task.title,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries
      });
    }

    res.json(populatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:taskId/retry
// @desc    Retry a failed task
// @access  Private (project members only)
router.post('/:taskId/retry', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check project membership
    const Project = require('../models/Project');
    const project = await Project.findById(task.project);
    
    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (task.status !== 'Failed') {
      return res.status(400).json({ message: 'Can only retry failed tasks' });
    }

    if (task.retryCount >= task.maxRetries) {
      return res.status(400).json({ 
        message: `Maximum retries (${task.maxRetries}) exceeded` 
      });
    }

    task.status = 'Pending';
    task.retryCount += 1;
    task.versionNumber += 1;
    await task.save();

    // Create version
    await createTaskVersion(task, req.user._id, 'retry');

    await logAudit({
      actor: req.user._id,
      action: 'task.retry',
      entityType: 'Task',
      entityId: task._id,
      projectId: task.project,
      metadata: { retryCount: task.retryCount, maxRetries: task.maxRetries }
    });

    const populatedTask = await Task.findById(task._id)
      .populate('dependencies', 'title status')
      .populate('createdBy', 'name email');

    // Emit socket event
    emitToProject(task.project.toString(), 'task-retried', populatedTask);

    res.json(populatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:taskId/versions
// @desc    Get task version history
// @access  Private
router.get('/:taskId/versions', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check project membership
    const Project = require('../models/Project');
    const project = await Project.findById(task.project);
    
    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const versions = await TaskVersion.find({ task: req.params.taskId })
      .populate('changedBy', 'name email')
      .sort({ versionNumber: -1 });

    res.json(versions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:taskId
// @desc    Delete task
// @access  Private (project members only)
router.delete('/:taskId', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check project membership
    const Project = require('../models/Project');
    const project = await Project.findById(task.project);
    
    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if other tasks depend on this one
    const dependentTasks = await Task.find({
      project: task.project,
      dependencies: task._id
    });

    if (dependentTasks.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete task: other tasks depend on it',
        dependentTasks: dependentTasks.map(t => ({ _id: t._id, title: t.title }))
      });
    }

    const projectId = task.project;

    await Task.findByIdAndDelete(req.params.taskId);
    await TaskVersion.deleteMany({ task: req.params.taskId });

    await logAudit({
      actor: req.user._id,
      action: 'task.deleted',
      entityType: 'Task',
      entityId: task._id,
      projectId,
      metadata: { title: task.title }
    });

    // Emit socket event
    emitToProject(projectId.toString(), 'task-deleted', { taskId: req.params.taskId });

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
