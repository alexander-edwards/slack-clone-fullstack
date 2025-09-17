import React from 'react';
import { HashtagIcon, LockClosedIcon, UserGroupIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface ChannelHeaderProps {
  channel: any;
  dmUser: any;
  memberCount: number;
  onShowMembers: () => void;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({
  channel,
  dmUser,
  memberCount,
  onShowMembers,
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {channel ? (
            <>
              {channel.is_private ? (
                <LockClosedIcon className="w-5 h-5 mr-2 text-gray-600" />
              ) : (
                <HashtagIcon className="w-5 h-5 mr-2 text-gray-600" />
              )}
              <h1 className="text-lg font-bold text-gray-900">{channel.name}</h1>
            </>
          ) : dmUser ? (
            <>
              <div className="relative mr-2">
                <img
                  src={dmUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(dmUser.display_name)}&background=random`}
                  alt={dmUser.display_name}
                  className="w-6 h-6 rounded-full"
                />
                {dmUser.is_online && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <h1 className="text-lg font-bold text-gray-900">{dmUser.display_name}</h1>
              <span className="ml-2 text-sm text-gray-500">
                {dmUser.is_online ? 'Active' : 'Away'}
              </span>
            </>
          ) : (
            <h1 className="text-lg font-bold text-gray-900">Select a channel</h1>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {channel && (
            <button
              onClick={onShowMembers}
              className="flex items-center px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              <UserGroupIcon className="w-4 h-4 mr-1" />
              {memberCount}
            </button>
          )}
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded">
            <InformationCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {channel?.description && (
        <p className="text-sm text-gray-500 mt-1">{channel.description}</p>
      )}
    </div>
  );
};

export default ChannelHeader;
