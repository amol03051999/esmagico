const ExecutionPlanModal = ({ isOpen, onClose, data, type }) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {type === 'execution' ? 'Execution Plan' : 'Simulation Results'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {type === 'simulation' && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Priority Score:</span>
                <span className="ml-2 font-bold text-blue-700">{data.totalPriorityScore}</span>
              </div>
              <div>
                <span className="text-gray-600">Hours Used:</span>
                <span className="ml-2 font-bold">{data.totalHoursUsed} / {data.availableHours}</span>
              </div>
            </div>
          </div>
        )}

        {type === 'execution' && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Tasks:</span>
                <span className="ml-2 font-bold">{data.totalTasks}</span>
              </div>
              <div>
                <span className="text-gray-600">Completed:</span>
                <span className="ml-2 font-bold text-green-600">{data.completedTasks}</span>
              </div>
              <div>
                <span className="text-gray-600">Running:</span>
                <span className="ml-2 font-bold text-blue-600">{data.runningTasks}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {(data.executionOrder?.length > 0 || data.selectedTasks?.length > 0) && (
            <div>
              <h3 className="font-medium text-green-700 mb-2">
                {type === 'simulation' ? 'Selected Tasks' : 'Ready to Execute'}
              </h3>
              <div className="space-y-2">
                {(data.executionOrder || data.selectedTasks).map((task, index) => (
                  <div key={task._id} className="flex items-center gap-3 p-2 bg-green-50 rounded">
                    <span className="w-6 h-6 flex items-center justify-center bg-green-200 rounded-full text-xs font-medium">
                      {task.order || index + 1}
                    </span>
                    <span className="flex-1">{task.title}</span>
                    <span className="text-sm text-gray-500">P{task.priority}</span>
                    <span className="text-sm text-gray-500">{task.estimatedHours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.blockedTasks?.length > 0 && (
            <div>
              <h3 className="font-medium text-red-700 mb-2">Blocked Tasks</h3>
              <div className="space-y-2">
                {data.blockedTasks.map(task => (
                  <div key={task._id} className="flex items-center gap-3 p-2 bg-red-50 rounded">
                    <span className="flex-1">{task.title}</span>
                    {task.reason && (
                      <span className="text-xs text-red-600">{task.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.skippedTasks?.length > 0 && (
            <div>
              <h3 className="font-medium text-yellow-700 mb-2">Skipped Tasks</h3>
              <div className="space-y-2">
                {data.skippedTasks.map(task => (
                  <div key={task._id} className="flex items-center gap-3 p-2 bg-yellow-50 rounded">
                    <span className="flex-1">{task.title}</span>
                    <span className="text-sm text-gray-500">P{task.priority}</span>
                    <span className="text-sm text-gray-500">{task.estimatedHours}h</span>
                    {task.reason && (
                      <span className="text-xs text-yellow-700">{task.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.executionOrder?.length === 0 && data.selectedTasks?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No tasks ready for execution
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExecutionPlanModal;
