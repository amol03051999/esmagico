const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Invite = require('../models/Invite');
const { protect, projectMember, projectOwner } = require('../middleware/auth');
const { generateInviteToken, verifyInviteToken } = require('../utils/inviteToken');
const { logAudit } = require('../services/auditService');
const { computeExecutionPlan, simulateExecution } = require('../services/executionService');
const { emitToProject } = require('../socket');

// @route   GET /api/projects
// @desc    Get all projects for current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const projects = await Project.find({
      'members.user': req.user._id
    }).populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects
// @desc    Create a project
// @access  Private
router.post('/', protect, [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('description').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const project = await Project.create({
      name: req.body.name,
      description: req.body.description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'owner' }]
    });

    await logAudit({
      actor: req.user._id,
      action: 'project.created',
      entityType: 'Project',
      entityId: project._id,
      projectId: project._id,
      metadata: { name: project.name }
    });

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.status(201).json(populatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/:projectId
// @desc    Get single project
// @access  Private (members only)
router.get('/:projectId', protect, projectMember, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/projects/:projectId
// @desc    Update project
// @access  Private (owner only)
router.put('/:projectId', protect, projectOwner, [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const { name, description } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { name, description, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('owner', 'name email')
      .populate('members.user', 'name email');

    await logAudit({
      actor: req.user._id,
      action: 'project.updated',
      entityType: 'Project',
      entityId: project._id,
      projectId: project._id
    });

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/:projectId/invite
// @desc    Generate invite link
// @access  Private (members only)
router.post('/:projectId/invite', protect, projectMember, async (req, res) => {
  try {
    const token = generateInviteToken(req.params.projectId, req.user._id);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const invite = await Invite.create({
      project: req.params.projectId,
      token,
      createdBy: req.user._id,
      expiresAt
    });

    await logAudit({
      actor: req.user._id,
      action: 'invite.generated',
      entityType: 'Invite',
      entityId: invite._id,
      projectId: req.params.projectId
    });

    const inviteLink = `${process.env.FRONTEND_URL}/join/${token}`;

    res.json({
      token,
      inviteLink,
      expiresAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/join
// @desc    Join project using invite token
// @access  Private
router.post('/join', protect, [
  body('token').notEmpty().withMessage('Invite token is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { token } = req.body;

    // Verify token
    const verification = verifyInviteToken(token);
    if (!verification.valid) {
      return res.status(400).json({ message: verification.error });
    }

    const { projectId } = verification.data;

    // Check if invite exists and is valid
    const invite = await Invite.findOne({ token, isValid: true });
    if (!invite) {
      return res.status(400).json({ message: 'Invalid or expired invite' });
    }

    if (new Date() > invite.expiresAt) {
      invite.isValid = false;
      await invite.save();
      return res.status(400).json({ message: 'Invite has expired' });
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if already a member
    const isMember = project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (isMember) {
      return res.status(400).json({ message: 'Already a member of this project' });
    }

    // Add user to project
    project.members.push({ user: req.user._id, role: 'member' });
    await project.save();

    // Mark invite as used
    invite.usedBy = req.user._id;
    invite.usedAt = new Date();
    invite.isValid = false;
    await invite.save();

    await logAudit({
      actor: req.user._id,
      action: 'member.joined',
      entityType: 'Project',
      entityId: project._id,
      projectId: project._id,
      metadata: { inviteId: invite._id }
    });

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    // Emit to project members
    emitToProject(projectId, 'member-joined', {
      user: { _id: req.user._id, name: req.user.name, email: req.user.email },
      projectId
    });

    res.json(populatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/:projectId/compute-execution
// @desc    Compute execution plan
// @access  Private (members only)
router.post('/:projectId/compute-execution', protect, projectMember, async (req, res) => {
  try {
    const result = await computeExecutionPlan(req.params.projectId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/:projectId/simulate
// @desc    Simulate daily execution
// @access  Private (members only)
router.post('/:projectId/simulate', protect, projectMember, [
  body('availableHours').isNumeric().withMessage('Available hours must be a number'),
  body('failedTaskIds').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { availableHours, failedTaskIds = [] } = req.body;
    const result = await simulateExecution(
      req.params.projectId,
      parseFloat(availableHours),
      failedTaskIds
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/projects/:projectId/webhook
// @desc    Configure webhook
// @access  Private (owner only)
router.put('/:projectId/webhook', protect, projectOwner, [
  body('url').isURL().withMessage('Valid URL is required'),
  body('secret').optional().trim(),
  body('events').optional().isArray(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { url, secret, events, isActive } = req.body;
    
    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      {
        webhookConfig: { url, secret, events, isActive: isActive !== false }
      },
      { new: true }
    ).populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
