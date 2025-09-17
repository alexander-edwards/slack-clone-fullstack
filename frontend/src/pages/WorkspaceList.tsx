import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { workspaceAPI, channelAPI } from '../services/api';
import { PlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import CreateWorkspaceModal from '../components/CreateWorkspaceModal';
import toast from 'react-hot-toast';

interface Workspace {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  member_count?: number;
  role?: string;
}

const WorkspaceList: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const response = await workspaceAPI.getAll();
      setWorkspaces(response.data.workspaces);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceClick = async (workspace: Workspace) => {
    try {
      // Get channels for the workspace and navigate to the first one
      const response = await channelAPI.getByWorkspace(workspace.id.toString());
      const channels = response.data.channels;
      
      if (channels.length > 0) {
        // Find general channel or use the first one
        const generalChannel = channels.find((c: any) => c.name === 'general') || channels[0];
        navigate(`/workspace/${workspace.id}/channel/${generalChannel.id}`);
      } else {
        navigate(`/workspace/${workspace.id}`);
      }
    } catch (error) {
      console.error('Failed to get channels:', error);
      navigate(`/workspace/${workspace.id}`);
    }
  };

  const handleCreateWorkspace = async (data: any) => {
    try {
      const response = await workspaceAPI.create(data);
      toast.success('Workspace created successfully!');
      setShowCreateModal(false);
      loadWorkspaces();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to create workspace';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-slack-purple shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <svg className="h-8 w-8 text-white mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              <h1 className="text-2xl font-bold text-white">Slack Clone</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white">Welcome, {user?.display_name}</span>
              <button
                onClick={logout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-slack-purple bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Workspaces</h2>
          <p className="text-gray-600">Select a workspace to continue or create a new one</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              onClick={() => handleWorkspaceClick(workspace)}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6"
            >
              <div className="flex items-center mb-4">
                {workspace.logo_url ? (
                  <img
                    src={workspace.logo_url}
                    alt={workspace.name}
                    className="h-12 w-12 rounded-lg mr-4"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-slack-purple flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-xl">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{workspace.name}</h3>
                  <p className="text-sm text-gray-500">@{workspace.slug}</p>
                </div>
              </div>
              {workspace.description && (
                <p className="text-gray-600 text-sm mb-4">{workspace.description}</p>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">
                  {workspace.member_count || 0} members
                </span>
                {workspace.role && (
                  <span className="px-2 py-1 bg-slack-purple text-white rounded-full text-xs">
                    {workspace.role}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Create New Workspace Card */}
          <div
            onClick={() => setShowCreateModal(true)}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6 border-2 border-dashed border-gray-300 hover:border-slack-purple flex flex-col items-center justify-center"
          >
            <PlusIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Create Workspace</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Start a new workspace for your team
            </p>
          </div>
        </div>

        {workspaces.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No workspaces</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new workspace.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-slack-purple hover:bg-slack-purpleHover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slack-purple"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                New Workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateWorkspaceModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateWorkspace}
        />
      )}
    </div>
  );
};

export default WorkspaceList;
