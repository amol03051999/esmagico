import { useState } from 'react';

const SimulationModal = ({ isOpen, onClose, onSubmit, tasks }) => {
  const [availableHours, setAvailableHours] = useState(8);
  const [failedTaskIds, setFailedTaskIds] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ availableHours, failedTaskIds });
  };

  const toggleFailedTask = (taskId) => {
    setFailedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  if (!isOpen) return null;

  const pendingTasks = tasks.filter(t => t.status === 'Pending');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Daily Simulation</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Available Hours
            </label>
            <input
              type="number"
              min="1"
              step="0.5"
              value={availableHours}
              onChange={(e) => setAvailableHours(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {pendingTasks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Simulate Failed Tasks (optional)
              </label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {pendingTasks.map(task => (
                  <label key={task._id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={failedTaskIds.includes(task._id)}
                      onChange={() => toggleFailedTask(task._id)}
                      className="rounded text-red-600"
                    />
                    <span className="text-sm">{task.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Run Simulation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimulationModal;
