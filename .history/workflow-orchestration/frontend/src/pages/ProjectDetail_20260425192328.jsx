import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import ExecutionPlanModal from '../components/ExecutionPlanModal';
import SimulationModal from '../components/SimulationModal';
import InviteModal from '../components/InviteModal';
import TaskVersionModal from '../components/TaskVersionModal';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { socket, joinProject, leaveProject } = useSocket();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [executionPlanOpen, setExecutionPlanOpen] = useState(false);
  const [executionData, setExecutionData] = useState(null);
  const [executionType, setExecutionType] = useState('execution');
  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchProject = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${projectId}`);
      setProject(response.data);
    } catch (error) {
      toast.error('Failed to fetch project');
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.get(`/tasks/project/${projectId}`);
      setTasks(response.data);
    } catch (error) {
      toast.error('Failed to fetch tasks');
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchTasks();
    joinProject(projectId);

    return () => {
      leaveProject(projectId);
    };
  }, [projectId, fetchProject, fetchTasks, joinProject, leaveProject]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (task) => {
      setTasks(prev => [task, ...prev]);
      toast.success(`New task created: ${task.title}`);
    };

    const handleTaskUpdated = (task) => {
      setTasks(prev => prev.map(t => t._id === task._id ? task : t));
    };

    const handleTaskStatusChanged = ({ task, oldStatus, newStatus }) => {
      setTasks(prev => prev.map(t => t._id === task._id ? task : t));
      toast.success(`Task "${task.title}" status: ${oldStatus} → ${newStatus}`);
    };

    const handleTaskRetried = (task) => {
      setTasks(prev => prev.map(t => t._id === task._id ? task : t));
      toast.success(`Task "${task.title}" queued for retry`);
    };

    const handleTaskDeleted = ({ taskId }) => {
      setTasks(prev => prev.filter(t => t._id !== taskId));
    };

    const handleMemberJoined = ({ user }) => {
      toast.success(`${user.name} joined the project`);
      fetchProject();
    };

    socket.on('task-created', handleTaskCreated);
    socket.on('task-updated', handleTaskUpdated);
    socket.on('task-status-changed', handleTaskStatusChanged);
    socket.on('task-retried', handleTaskRetried);
    socket.on('task-deleted', handleTaskDeleted);
    socket.on('member-joined', handleMemberJoined);

    return () => {
      socket.off('task-created', handleTaskCreated);
      socket.off('task-updated', handleTaskUpdated);
      socket.off('task-status-changed', handleTaskStatusChanged);
      socket.off('task-retried', handleTaskRetried);
      socket.off('task-deleted', handleTaskDeleted);
      socket.off('member-joined', handleMemberJoined);
    };
  }, [socket, fetchProject]);

  const handleCreateTask = async (data) => {
    await api.post('/tasks', data);
  };

  const handleUpdateTask = async (data) => {
    await api.put(`/tasks/${editingTask._id}`, data);
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await api.put(`/tasks/${task._id}/status`, {
        status: newStatus,
        versionNumber: task.versionNumber
      });
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Conflict: Task was modified. Please refresh.');
        fetchTasks();
      } else {
        toast.error(error.response?.data?.message || 'Failed to update status');
      }
    }
  };

  const handleRetry = async (task) => {
    try {
      await api.post(`/tasks/${task._id}/retry`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to retry task');
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    
    try {
      await api.delete(`/tasks/${task._id}`);
      toast.success('Task deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete task');
    }
  };

  const handleComputeExecution = async () => {
    try {
      const response = await api.post(`/projects/${projectId}/compute-execution`);
      setExecutionData(response.data);
      setExecutionType('execution');
      setExecutionPlanOpen(true);
    } catch (error) {
      toast.error('Failed to compute execution plan');
    }
  };

  const handleSimulation = async ({ availableHours, failedTaskIds }) => {
    try {
      const response = await api.post(`/projects/${projectId}/simulate`, {
        availableHours,
        failedTaskIds
      });
      setExecutionData(response.data);
      setExecutionType('simulation');
      setSimulationModalOpen(false);
      setExecutionPlanOpen(true);
    } catch (error) {
      toast.error('Failed to run simulation');
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const response = await api.post(`/projects/${projectId}/invite`);
      setInviteData(response.data);
      setInviteModalOpen(true);
    } catch (error) {
      toast.error('Failed to generate invite');
    }
  };

  const filteredTasks = statusFilter === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === statusFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
              {project?.description && (
                <p className="text-gray-500 mt-1">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                <span>{project?.members?.length || 1} member(s)</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateInvite}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Invite
              </button>
              <button
                onClick={handleComputeExecution}
                className="px-3 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
              >
                Execution Plan
              </button>
              <button
                onClick={() => setSimulationModalOpen(true)}
                className="px-3 py-2 border border-green-300 text-green-600 rounded-lg hover:bg-green-50 text-sm"
              >
                Simulate
              </button>
              <button
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                + Add Task
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex gap-2">
          {['all', 'Pending', 'Running', 'Completed', 'Failed', 'Blocked'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-sm ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status}
              {status !== 'all' && (
                <span className="ml-1">
                  ({tasks.filter(t => t.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tasks Grid */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">
              {statusFilter === 'all' ? 'No tasks yet' : `No ${statusFilter.toLowerCase()} tasks`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map(task => (
              <TaskCard
                key={task._id}
                task={task}
                allTasks={tasks}
                onEdit={(t) => {
                  setEditingTask(t);
                  setTaskModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                onRetry={handleRetry}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        task={editingTask}
        allTasks={tasks}
        projectId={projectId}
      />

      <ExecutionPlanModal
        isOpen={executionPlanOpen}
        onClose={() => setExecutionPlanOpen(false)}
        data={executionData}
        type={executionType}
      />

      <SimulationModal
        isOpen={simulationModalOpen}
        onClose={() => setSimulationModalOpen(false)}
        onSubmit={handleSimulation}
        tasks={tasks}
      />

      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        inviteData={inviteData}
      />

      <TaskVersionModal
        isOpen={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        taskId={selectedTaskId}
      />
    </div>
  );
};

export default ProjectDetail;
