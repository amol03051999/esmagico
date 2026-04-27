import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const JoinProject = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      // Store the invite token and redirect to login
      localStorage.setItem('pendingInvite', token);
      navigate('/login');
    }
  }, [authLoading, user, token, navigate]);

  useEffect(() => {
    // Check for pending invite after login
    const pendingInvite = localStorage.getItem('pendingInvite');
    if (pendingInvite && user) {
      localStorage.removeItem('pendingInvite');
    }
  }, [user]);

  const handleJoin = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/projects/join', { token });
      toast.success('Successfully joined the project!');
      navigate(`/projects/${response.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join project');
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Join Project
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <p className="text-gray-600 text-center mb-6">
          You've been invited to join a project. Click the button below to accept the invitation.
        </p>

        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join Project'}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
            Go to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
};

export default JoinProject;
