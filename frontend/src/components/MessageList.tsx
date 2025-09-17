import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import MessageItem from './MessageItem';

interface MessageListProps {
  messages: any[];
  loading: boolean;
  currentUserId: number;
  onEditMessage: (id: number, content: string) => void;
  onDeleteMessage: (id: number) => void;
  onReactToMessage: (id: number, emoji: string) => void;
  onThreadClick: (message: any) => void;
  onUserClick: (user: any) => void;
  typingUsers: string[];
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  currentUserId,
  onEditMessage,
  onDeleteMessage,
  onReactToMessage,
  onThreadClick,
  onUserClick,
  typingUsers,
}) => {
  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return `Today at ${format(messageDate, 'h:mm a')}`;
    } else if (isYesterday(messageDate)) {
      return `Yesterday at ${format(messageDate, 'h:mm a')}`;
    }
    return format(messageDate, 'MMM d, yyyy at h:mm a');
  };

  const groupMessagesByDate = (messages: any[]) => {
    const groups: { [key: string]: any[] } = {};
    
    messages.forEach(message => {
      const date = format(new Date(message.created_at), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading messages...</p>
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date}>
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <div className="px-3 text-xs text-gray-500">
              {isToday(new Date(date)) ? 'Today' : 
               isYesterday(new Date(date)) ? 'Yesterday' : 
               format(new Date(date), 'EEEE, MMMM d')}
            </div>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>
          
          {dateMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isOwn={message.user_id === currentUserId}
              onEdit={onEditMessage}
              onDelete={onDeleteMessage}
              onReact={onReactToMessage}
              onThreadClick={onThreadClick}
              onUserClick={onUserClick}
              formatTime={formatMessageDate}
            />
          ))}
        </div>
      ))}

      {messages.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          <p>No messages yet. Start the conversation!</p>
        </div>
      )}

      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-500 italic">
          {typingUsers.length === 1 ? (
            <span>{typingUsers[0]} is typing<span className="loading-dots"></span></span>
          ) : (
            <span>{typingUsers.join(', ')} are typing<span className="loading-dots"></span></span>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageList;
