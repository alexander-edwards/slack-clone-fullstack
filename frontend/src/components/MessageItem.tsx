import React, { useState } from 'react';
import { PencilIcon, TrashIcon, ChatBubbleLeftIcon, FaceSmileIcon } from '@heroicons/react/24/outline';
import EmojiPicker from 'emoji-picker-react';

interface MessageItemProps {
  message: any;
  isOwn: boolean;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onReact: (id: number, emoji: string) => void;
  onThreadClick: (message: any) => void;
  onUserClick: (user: any) => void;
  formatTime: (date: string) => string;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  onEdit,
  onDelete,
  onReact,
  onThreadClick,
  onUserClick,
  formatTime,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleReaction = (emojiData: any) => {
    onReact(message.id, emojiData.emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div
      className="group flex items-start mb-4 hover:bg-gray-50 px-4 py-2 -mx-4 rounded"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <img
        src={message.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.display_name)}&background=random`}
        alt={message.display_name}
        className="w-9 h-9 rounded-md mr-3 cursor-pointer"
        onClick={() => onUserClick({ 
          id: message.user_id, 
          username: message.username,
          display_name: message.display_name,
          avatar_url: message.avatar_url
        })}
      />
      
      <div className="flex-1">
        <div className="flex items-baseline">
          <span 
            className="font-bold text-sm mr-2 cursor-pointer hover:underline"
            onClick={() => onUserClick({ 
              id: message.user_id, 
              username: message.username,
              display_name: message.display_name,
              avatar_url: message.avatar_url
            })}
          >
            {message.display_name}
          </span>
          <span className="text-xs text-gray-500">
            {formatTime(message.created_at)}
            {message.edited_at && <span className="ml-1">(edited)</span>}
          </span>
        </div>
        
        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md resize-none"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditContent(message.content);
                }
              }}
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleEdit}
                className="px-3 py-1 bg-slack-green text-white rounded-md text-sm hover:bg-slack-greenHover"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1 text-sm text-gray-800">
              {message.is_deleted ? (
                <span className="italic text-gray-500">{message.content}</span>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }} />
              )}
            </div>
            
            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.reactions.map((reaction: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => onReact(message.id, reaction.emoji)}
                    className="inline-flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs"
                  >
                    <span className="mr-1">{reaction.emoji}</span>
                    <span>{reaction.count || 1}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Thread indicator */}
            {message.reply_count > 0 && (
              <button
                onClick={() => onThreadClick(message)}
                className="mt-2 text-sm text-slack-link hover:underline flex items-center"
              >
                <ChatBubbleLeftIcon className="w-4 h-4 mr-1" />
                {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Message actions */}
      {showActions && !isEditing && !message.is_deleted && (
        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md shadow-sm px-1 py-1">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <FaceSmileIcon className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => onThreadClick(message)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChatBubbleLeftIcon className="w-4 h-4 text-gray-600" />
          </button>
          {isOwn && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <PencilIcon className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => onDelete(message.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <TrashIcon className="w-4 h-4 text-red-600" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute z-10 mt-8">
          <EmojiPicker
            onEmojiClick={handleReaction}
            height={350}
            width={300}
          />
        </div>
      )}
    </div>
  );
};

export default MessageItem;
