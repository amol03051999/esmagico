import { useState } from 'react';

const statusColors = {
  Pending: 'bg-gray-100 text-gray-800',
  Running: 'bg-blue-100 text-blue-800',
  Completed: 'bg-green-100 text-green-800',
  Failed: 'bg-red-100 text-red-800',
  Blocked: 'bg-yellow-100 text-yellow-800'
};

const priorityLabels = {
  1: 'Very Low',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical'
};

const TaskCard = ({ task, onEdit, onStatusChange, onRetry, onDelete, allTasks }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getDependencyNames = () => {
    if (!task.dependencies || task.dependencies.length === 0) return [];
    return task.dependencies.map(dep => {
      if (typeof dep === 'object') return dep.title;
      const found = allTasks?.find(t => t._id === dep);
      return found?.title || dep;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900">{task.title}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
          {task.status}
        </span>
      </div>
      
      {task.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
          P{task.priority} - {priorityLabels[task.priority]}
        </span>
        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
          {task.estimatedHours}h
        </span>
        <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-xs">
          {task.resourceTag}
        </span>
      </div>

      {getDependencyNames().length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-gray-500">Dependencies: </span>
          <span className="text-xs text-gray-700">
            {getDependencyNames().join(', ')}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
          <button
            onClick={() => onEdit(task)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(task)}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>

        <div className="flex gap-1">
          {task.status === 'Pending' && (
            <button
              onClick={() => onStatusChange(task, 'Running')}
              className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
            >
              Start
            </button>
          )}
          {task.status === 'Running' && (
            <>
              <button
                onClick={() => onStatusChange(task, 'Completed')}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                Complete
              </button>
              <button
                onClick={() => onStatusChange(task, 'Failed')}
                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
              >
                Fail
              </button>
            </>
          )}
          {task.status === 'Failed' && task.retryCount < task.maxRetries && (
            <button
              onClick={() => onRetry(task)}
              className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
            >
              Retry ({task.retryCount}/{task.maxRetries})
            </button>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-500 space-y-1">
          <p>Version: {task.versionNumber}</p>
          <p>Retries: {task.retryCount}/{task.maxRetries}</p>
          <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
          {task.createdBy && <p>By: {task.createdBy.name}</p>}
        </div>
      )}
    </div>
  );
};

export default TaskCard;
