const Task = require('../models/Task');

// Detect cyclic dependencies using DFS
const detectCycle = (taskId, dependencies, taskMap, visited = new Set(), recStack = new Set()) => {
  visited.add(taskId.toString());
  recStack.add(taskId.toString());

  for (const depId of dependencies) {
    const depIdStr = depId.toString();
    if (!visited.has(depIdStr)) {
      const depTask = taskMap.get(depIdStr);
      if (depTask) {
        if (detectCycle(depIdStr, depTask.dependencies || [], taskMap, visited, recStack)) {
          return true;
        }
      }
    } else if (recStack.has(depIdStr)) {
      return true;
    }
  }

  recStack.delete(taskId.toString());
  return false;
};

const validateDependencies = async (taskId, newDependencies, projectId) => {
  const projectTasks = await Task.find({ project: projectId });
  const taskMap = new Map(projectTasks.map(t => [t._id.toString(), t]));

  // Check if all dependencies exist in the project
  for (const depId of newDependencies) {
    if (!taskMap.has(depId.toString())) {
      return { valid: false, error: `Dependency task ${depId} not found in project` };
    }
  }

  // Check for self-dependency
  if (newDependencies.some(d => d.toString() === taskId.toString())) {
    return { valid: false, error: 'Task cannot depend on itself' };
  }

  // Temporarily update the task's dependencies for cycle detection
  const currentTask = taskMap.get(taskId.toString());
  if (currentTask) {
    currentTask.dependencies = newDependencies;
  }

  // Check for cycles
  if (detectCycle(taskId, newDependencies, taskMap)) {
    return { valid: false, error: 'Cyclic dependency detected' };
  }

  return { valid: true };
};

const computeExecutionPlan = async (projectId) => {
  const tasks = await Task.find({ project: projectId });
  
  // Build task map
  const taskMap = new Map(tasks.map(t => [t._id.toString(), t]));
  
  // Find blocked tasks (dependencies failed or blocked)
  const blockedTasks = new Set();
  const markBlocked = (taskId) => {
    if (blockedTasks.has(taskId)) return;
    
    const task = taskMap.get(taskId);
    if (!task) return;
    
    if (task.status === 'Failed' || task.status === 'Blocked') {
      blockedTasks.add(taskId);
      // Mark all dependents as blocked
      for (const [id, t] of taskMap) {
        if (t.dependencies.some(d => d.toString() === taskId)) {
          markBlocked(id);
        }
      }
    }
  };
  
  // Initial pass to find blocked tasks
  for (const task of tasks) {
    if (task.status === 'Failed') {
      markBlocked(task._id.toString());
    }
  }

  // Get eligible tasks (not completed, not running, not blocked, all deps completed)
  const eligibleTasks = tasks.filter(task => {
    if (task.status === 'Completed' || task.status === 'Running' || task.status === 'Blocked') {
      return false;
    }
    if (blockedTasks.has(task._id.toString())) {
      return false;
    }
    
    // Check all dependencies are completed
    const allDepsCompleted = task.dependencies.every(depId => {
      const dep = taskMap.get(depId.toString());
      return dep && dep.status === 'Completed';
    });
    
    return allDepsCompleted;
  });

  // Sort by priority (desc), estimatedHours (asc), createdAt (asc)
  eligibleTasks.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.estimatedHours !== b.estimatedHours) return a.estimatedHours - b.estimatedHours;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  // Build execution order respecting resource constraints
  const executionOrder = [];
  const runningResourceTags = new Set();
  const runningTasks = tasks.filter(t => t.status === 'Running');
  runningTasks.forEach(t => runningResourceTags.add(t.resourceTag));

  for (const task of eligibleTasks) {
    // Check resource constraint
    if (!runningResourceTags.has(task.resourceTag)) {
      executionOrder.push(task);
      runningResourceTags.add(task.resourceTag);
    }
  }

  return {
    executionOrder: executionOrder.map(t => ({
      _id: t._id,
      title: t.title,
      priority: t.priority,
      estimatedHours: t.estimatedHours,
      resourceTag: t.resourceTag
    })),
    blockedTasks: Array.from(blockedTasks).map(id => {
      const t = taskMap.get(id);
      return { _id: id, title: t?.title };
    }),
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'Completed').length,
    runningTasks: runningTasks.length
  };
};

const simulateExecution = async (projectId, availableHours, failedTaskIds = []) => {
  const tasks = await Task.find({ project: projectId });
  const taskMap = new Map(tasks.map(t => [t._id.toString(), t]));

  // Mark failed tasks
  const blockedTasks = new Set();
  const failedSet = new Set(failedTaskIds.map(id => id.toString()));

  const markBlocked = (taskId) => {
    if (blockedTasks.has(taskId)) return;
    blockedTasks.add(taskId);
    
    // Mark all dependents as blocked
    for (const [id, t] of taskMap) {
      if (t.dependencies.some(d => d.toString() === taskId)) {
        markBlocked(id);
      }
    }
  };

  // Process failed tasks
  for (const failedId of failedSet) {
    markBlocked(failedId);
  }

  // Also process already failed/blocked tasks
  for (const task of tasks) {
    if (task.status === 'Failed' || task.status === 'Blocked') {
      markBlocked(task._id.toString());
    }
  }

  // Get eligible tasks
  const eligibleTasks = tasks.filter(task => {
    const taskIdStr = task._id.toString();
    
    if (task.status === 'Completed' || task.status === 'Running') {
      return false;
    }
    if (blockedTasks.has(taskIdStr) || failedSet.has(taskIdStr)) {
      return false;
    }
    
    // Check all dependencies are completed or in our simulation can be completed
    const allDepsCompleted = task.dependencies.every(depId => {
      const dep = taskMap.get(depId.toString());
      return dep && (dep.status === 'Completed' || failedSet.has(depId.toString()) === false);
    });
    
    return allDepsCompleted;
  });

  // Sort by priority (desc), estimatedHours (asc), createdAt (asc)
  eligibleTasks.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.estimatedHours !== b.estimatedHours) return a.estimatedHours - b.estimatedHours;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  // Knapsack-like selection to maximize priority within available hours
  const selectedTasks = [];
  const skippedTasks = [];
  let remainingHours = availableHours;
  let totalPriorityScore = 0;
  const usedResourceTags = new Set();

  // Simple greedy selection with dependency checking
  const completedInSimulation = new Set(
    tasks.filter(t => t.status === 'Completed').map(t => t._id.toString())
  );

  // Build a proper execution order using topological sort
  const canExecute = (task) => {
    return task.dependencies.every(depId => 
      completedInSimulation.has(depId.toString())
    );
  };

  let changed = true;
  while (changed && remainingHours > 0) {
    changed = false;
    
    for (const task of eligibleTasks) {
      const taskIdStr = task._id.toString();
      
      if (completedInSimulation.has(taskIdStr) || 
          selectedTasks.some(t => t._id.toString() === taskIdStr)) {
        continue;
      }

      if (!canExecute(task)) {
        continue;
      }

      // Check resource constraint (simplified: one resource at a time per tag)
      // For simulation, we assume sequential execution per resource tag
      
      if (task.estimatedHours <= remainingHours) {
        selectedTasks.push(task);
        completedInSimulation.add(taskIdStr);
        remainingHours -= task.estimatedHours;
        totalPriorityScore += task.priority;
        changed = true;
      } else {
        if (!skippedTasks.some(t => t._id.toString() === taskIdStr)) {
          skippedTasks.push(task);
        }
      }
    }
  }

  // Remaining eligible tasks that weren't selected
  for (const task of eligibleTasks) {
    const taskIdStr = task._id.toString();
    if (!selectedTasks.some(t => t._id.toString() === taskIdStr) &&
        !skippedTasks.some(t => t._id.toString() === taskIdStr) &&
        !blockedTasks.has(taskIdStr)) {
      skippedTasks.push(task);
    }
  }

  return {
    executionOrder: selectedTasks.map((t, index) => ({
      order: index + 1,
      _id: t._id,
      title: t.title,
      priority: t.priority,
      estimatedHours: t.estimatedHours
    })),
    selectedTasks: selectedTasks.map(t => ({
      _id: t._id,
      title: t.title,
      priority: t.priority,
      estimatedHours: t.estimatedHours
    })),
    blockedTasks: Array.from(blockedTasks).map(id => {
      const t = taskMap.get(id);
      return { _id: id, title: t?.title, reason: failedSet.has(id) ? 'Failed' : 'Dependency failed' };
    }),
    skippedTasks: skippedTasks.map(t => ({
      _id: t._id,
      title: t.title,
      priority: t.priority,
      estimatedHours: t.estimatedHours,
      reason: 'Insufficient time or dependency pending'
    })),
    totalPriorityScore,
    totalHoursUsed: availableHours - remainingHours,
    availableHours
  };
};

module.exports = {
  validateDependencies,
  computeExecutionPlan,
  simulateExecution,
  detectCycle
};
