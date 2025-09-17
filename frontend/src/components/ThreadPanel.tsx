import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import MessageItem from './MessageItem';

interface ThreadPanelProps {
  message: any;
  replies: any[];
  onClose: () => void;
  onSendReply: (content: string) => void;
  currentUserId: number;
}

const ThreadPanel: React.FC<ThreadPanelProps> = ({
  message,
  replies,
  onClose,
  onSendReply,
  currentUserId,
}) => {
  const [replyContent, setReplyContent] = useState('');

  const handleSendReply = () => {
    if (replyContent.trim()) {
      onSendReply(replyContent);
      setReplyContent('');
    }
  };

  return (
    <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-lg">Thread</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <XMarkIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Original message */}
        <div className="pb-4 border-b border-gray-200">
          <MessageItem
            message={message}
            isOwn={message.user_id === currentUserId}
            onEdit={() => {}}
            onDelete={() => {}}
            onReact={() => {}}
            onThreadClick={() => {}}
            onUserClick={() => {}}
            formatTime={(date) => new Date(date).toLocaleTimeString()}
          />
        </div>

        {/* Replies */}
        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-4">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </div>
          
          {replies.map((reply) => (
            <MessageItem
              key={reply.id}
              message={reply}
              isOwn={reply.user_id === currentUserId}
              onEdit={() => {}}
              onDelete={() => {}}
              onReact={() => {}}
              onThreadClick={() => {}}
              onUserClick={() => {}}
              formatTime={(date) => new Date(date).toLocaleTimeString()}
            />
          ))}
        </div>
      </div>

      {/* Reply input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex">
          <input
            type="text"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendReply();
              }
            }}
            placeholder="Reply..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:border-slack-active"
          />
          <button
            onClick={handleSendReply}
            disabled={!replyContent.trim()}
            className="px-4 py-2 bg-slack-green text-white rounded-r-md hover:bg-slack-greenHover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreadPanel;
