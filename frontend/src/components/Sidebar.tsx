import React, { useState } from 'react';
import { HashtagIcon, LockClosedIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface SidebarProps {
  workspace: any;
  channels: any[];
  currentChannel: any;
  dmUsers: any[];
  currentDMUser: any;
  onSelectChannel: (channel: any) => void;
  onSelectDMUser: (user: any) => void;
  onCreateChannel: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  workspace,
  channels,
  currentChannel,
  dmUsers,
  currentDMUser,
  onSelectChannel,
  onSelectDMUser,
  onCreateChannel,
}) => {
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);

  return (
    <div className="w-64 bg-slack-sidebar text-gray-300 flex flex-col">
      {/* Workspace Header */}
      <div className="p-4 border-b border-slack-purpleHover">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">{workspace?.name}</h2>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-400">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Channels and DMs */}
      <div className="flex-1 overflow-y-auto">
        {/* Channels Section */}
        <div className="mt-4">
          <div
            className="px-4 py-1 flex items-center justify-between cursor-pointer hover:bg-slack-sidebarHover"
            onClick={() => setChannelsExpanded(!channelsExpanded)}
          >
            <div className="flex items-center">
              {channelsExpanded ? (
                <ChevronDownIcon className="w-3 h-3 mr-1" />
              ) : (
                <ChevronRightIcon className="w-3 h-3 mr-1" />
              )}
              <span className="text-sm font-semibold">Channels</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateChannel();
              }}
              className="hover:bg-slack-hover p-1 rounded"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {channelsExpanded && (
            <div className="mt-1">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`px-4 py-1 cursor-pointer hover:bg-slack-sidebarHover flex items-center ${
                    currentChannel?.id === channel.id ? 'bg-slack-active text-white' : ''
                  }`}
                  onClick={() => onSelectChannel(channel)}
                >
                  {channel.is_private ? (
                    <LockClosedIcon className="w-4 h-4 mr-2" />
                  ) : (
                    <HashtagIcon className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-sm">{channel.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div className="mt-6">
          <div
            className="px-4 py-1 flex items-center justify-between cursor-pointer hover:bg-slack-sidebarHover"
            onClick={() => setDmsExpanded(!dmsExpanded)}
          >
            <div className="flex items-center">
              {dmsExpanded ? (
                <ChevronDownIcon className="w-3 h-3 mr-1" />
              ) : (
                <ChevronRightIcon className="w-3 h-3 mr-1" />
              )}
              <span className="text-sm font-semibold">Direct Messages</span>
            </div>
            <PlusIcon className="w-4 h-4 cursor-pointer hover:text-white" />
          </div>

          {dmsExpanded && (
            <div className="mt-1">
              {dmUsers.map((user) => (
                <div
                  key={user.user_id}
                  className={`px-4 py-1 cursor-pointer hover:bg-slack-sidebarHover flex items-center ${
                    currentDMUser?.user_id === user.user_id ? 'bg-slack-active text-white' : ''
                  }`}
                  onClick={() => onSelectDMUser(user)}
                >
                  <div className="relative mr-2">
                    <img
                      src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=random`}
                      alt={user.display_name}
                      className="w-5 h-5 rounded-full"
                    />
                    {user.is_online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-slack-sidebar"></div>
                    )}
                  </div>
                  <span className="text-sm">{user.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
