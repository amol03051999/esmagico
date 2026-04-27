import { useState, useEffect } from 'react';
import api from '../services/api';

const TaskVersionModal = ({ isOpen, onClose, taskId }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchVersions();
    }
  }, [isOpen, taskId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/tasks/${taskId}/versions`);
      setVersions(response.data);
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Version History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-3">
            {versions.map(version => (
              <div key={version._id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">Version {version.versionNumber}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(version.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Change:</span> {version.changeType}</div>
                  <div><span className="text-gray-500">Status:</span> {version.status}</div>
                  <div><span className="text-gray-500">Priority:</span> {version.priority}</div>
                  <div><span className="text-gray-500">Hours:</span> {version.estimatedHours}</div>
                  <div><span className="text-gray-500">By:</span> {version.changedBy?.name || 'Unknown'}</div>
                  <div><span className="text-gray-500">Retries:</span> {version.retryCount}/{version.maxRetries}</div>
                </div>
              </div>
            ))}
          </div>
        )}

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

export default TaskVersionModal;
