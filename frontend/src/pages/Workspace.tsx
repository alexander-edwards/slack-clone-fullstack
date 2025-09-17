import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { workspaceAPI, channelAPI, messageAPI, dmAPI, userAPI } from '../services/api';
import socketService from '../services/socket';
import Sidebar from '../components/Sidebar';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import ChannelHeader from '../components/ChannelHeader';
import ThreadPanel from '../components/ThreadPanel';
import UserProfileModal from '../components/UserProfileModal';
import toast from 'react-hot-toast';

interface Channel {
  id: number;
  name: string;
  description?: string;
  is_private: boolean;
  member_count?: number;
}

interface Message {
  id: number;
  content: string;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  edited_at?: string;
  is_deleted: boolean;
  reactions?: any[];
  attachments?: any[];
  reply_count?: number;
  parent_id?: number;
}

interface DirectMessageUser {
  user_id: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_online: boolean;
  last_message?: string;
  last_message_at?: string;
}

const Workspace: React.FC = () => {
  const { workspaceId, channelId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [workspace, setWorkspace] = useState<any>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmUsers, setDmUsers] = useState<DirectMessageUser[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const [selectedThread, setSelectedThread] = useState<Message | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDMView, setIsDMView] = useState(false);
  const [currentDMUser, setCurrentDMUser] = useState<DirectMessageUser | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceData();
      setupSocketListeners();
      socketService.joinWorkspace(workspaceId);
    }

    return () => {
      cleanupSocketListeners();
    };
  }, [workspaceId]);

  useEffect(() => {
    if (channelId && channels.length > 0) {
      const channel = channels.find(c => c.id === parseInt(channelId));
      if (channel) {
        selectChannel(channel);
      }
    }
  }, [channelId, channels]);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      const [workspaceRes, channelsRes, membersRes, dmsRes] = await Promise.all([
        workspaceAPI.getDetails(workspaceId!),
        channelAPI.getByWorkspace(workspaceId!),
        workspaceAPI.getMembers(workspaceId!),
        dmAPI.getConversations(workspaceId!)
      ]);

      setWorkspace(workspaceRes.data.workspace);
      setChannels(channelsRes.data.channels);
      setMembers(membersRes.data.members);
      setDmUsers(dmsRes.data.conversations);
    } catch (error) {
      console.error('Failed to load workspace data:', error);
      toast.error('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const selectChannel = async (channel: Channel) => {
    try {
      setMessageLoading(true);
      setCurrentChannel(channel);
      setIsDMView(false);
      setCurrentDMUser(null);
      
      socketService.joinChannel(channel.id.toString());
      
      const response = await messageAPI.getChannelMessages(channel.id.toString());
      setMessages(response.data.messages);
      
      navigate(`/workspace/${workspaceId}/channel/${channel.id}`);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to load channel messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setMessageLoading(false);
    }
  };

  const selectDMUser = async (dmUser: DirectMessageUser) => {
    try {
      setMessageLoading(true);
      setCurrentDMUser(dmUser);
      setIsDMView(true);
      setCurrentChannel(null);
      
      const response = await dmAPI.getMessages({
        workspace_id: workspaceId,
        other_user_id: dmUser.user_id
      });
      
      setMessages(response.data.messages);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to load DM messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setMessageLoading(false);
    }
  };

  const sendMessage = async (content: string, parentId?: number) => {
    if (!content.trim()) return;

    try {
      if (isDMView && currentDMUser) {
        // Send direct message
        const response = await dmAPI.send({
          workspace_id: workspaceId,
          receiver_id: currentDMUser.user_id,
          content
        });
        
        const newMessage = response.data.data;
        setMessages(prev => [...prev, {
          ...newMessage,
          username: user!.username,
          display_name: user!.display_name,
          avatar_url: user!.avatar_url
        }]);
      } else if (currentChannel) {
        // Send channel message
        const response = await messageAPI.send({
          channel_id: currentChannel.id,
          content,
          parent_id: parentId
        });
        
        const newMessage = response.data.data;
        
        if (parentId) {
          // It's a thread reply
          setThreadReplies(prev => [...prev, newMessage]);
          // Update reply count in main message
          setMessages(prev => prev.map(msg => 
            msg.id === parentId 
              ? { ...msg, reply_count: (msg.reply_count || 0) + 1 }
              : msg
          ));
        } else {
          // Regular message
          setMessages(prev => [...prev, newMessage]);
        }
      }
      
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  const editMessage = async (messageId: number, content: string) => {
    try {
      if (isDMView) {
        await dmAPI.edit(messageId.toString(), content);
      } else {
        await messageAPI.edit(messageId.toString(), content);
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content, edited_at: new Date().toISOString() }
          : msg
      ));
      
      toast.success('Message updated');
    } catch (error) {
      console.error('Failed to edit message:', error);
      toast.error('Failed to edit message');
    }
  };

  const deleteMessage = async (messageId: number) => {
    try {
      if (isDMView) {
        await dmAPI.delete(messageId.toString());
      } else {
        await messageAPI.delete(messageId.toString());
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, is_deleted: true, content: 'This message was deleted' }
          : msg
      ));
      
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  const addReaction = async (messageId: number, emoji: string) => {
    try {
      if (isDMView) {
        await dmAPI.addReaction(messageId.toString(), emoji);
      } else {
        await messageAPI.addReaction(messageId.toString(), emoji);
      }
      
      // Update local state
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          const existingReaction = reactions.find(r => r.emoji === emoji);
          
          if (existingReaction) {
            existingReaction.count = (existingReaction.count || 1) + 1;
            existingReaction.users = [...(existingReaction.users || []), user!.username];
          } else {
            reactions.push({
              emoji,
              count: 1,
              users: [user!.username]
            });
          }
          
          return { ...msg, reactions };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const loadThreadReplies = async (message: Message) => {
    try {
      setSelectedThread(message);
      const response = await messageAPI.getThread(message.id.toString());
      setThreadReplies(response.data.replies);
    } catch (error) {
      console.error('Failed to load thread:', error);
      toast.error('Failed to load thread');
    }
  };

  const setupSocketListeners = () => {
    socketService.on('message:new', handleNewMessage);
    socketService.on('message:edited', handleMessageEdit);
    socketService.on('message:deleted', handleMessageDelete);
    socketService.on('reaction:added', handleReactionAdded);
    socketService.on('user:typing', handleUserTyping);
    socketService.on('user:stopped_typing', handleUserStoppedTyping);
    socketService.on('dm:new', handleNewDM);
    socketService.on('user:online', handleUserOnline);
    socketService.on('user:offline', handleUserOffline);
  };

  const cleanupSocketListeners = () => {
    socketService.off('message:new', handleNewMessage);
    socketService.off('message:edited', handleMessageEdit);
    socketService.off('message:deleted', handleMessageDelete);
    socketService.off('reaction:added', handleReactionAdded);
    socketService.off('user:typing', handleUserTyping);
    socketService.off('user:stopped_typing', handleUserStoppedTyping);
    socketService.off('dm:new', handleNewDM);
    socketService.off('user:online', handleUserOnline);
    socketService.off('user:offline', handleUserOffline);
  };

  const handleNewMessage = (message: any) => {
    if (currentChannel && message.channel_id === currentChannel.id) {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    }
  };

  const handleMessageEdit = (data: any) => {
    setMessages(prev => prev.map(msg => 
      msg.id === data.id ? { ...msg, ...data } : msg
    ));
  };

  const handleMessageDelete = (data: any) => {
    setMessages(prev => prev.map(msg => 
      msg.id === data.messageId 
        ? { ...msg, is_deleted: true, content: 'This message was deleted' }
        : msg
    ));
  };

  const handleReactionAdded = (data: any) => {
    // Update reaction in messages
  };

  const handleUserTyping = (data: any) => {
    const channelTyping = typingUsers.get(data.channelId) || new Set();
    channelTyping.add(data.username);
    setTypingUsers(new Map(typingUsers.set(data.channelId, channelTyping)));

    // Clear existing timeout
    const existingTimeout = typingTimeouts.current.get(`${data.channelId}-${data.username}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout to remove typing indicator
    const timeout = setTimeout(() => {
      handleUserStoppedTyping(data);
    }, 3000);
    
    typingTimeouts.current.set(`${data.channelId}-${data.username}`, timeout);
  };

  const handleUserStoppedTyping = (data: any) => {
    const channelTyping = typingUsers.get(data.channelId);
    if (channelTyping) {
      channelTyping.delete(data.username);
      if (channelTyping.size === 0) {
        typingUsers.delete(data.channelId);
      } else {
        typingUsers.set(data.channelId, channelTyping);
      }
      setTypingUsers(new Map(typingUsers));
    }
  };

  const handleNewDM = (message: any) => {
    if (isDMView && currentDMUser && 
        (message.sender_id === currentDMUser.user_id || message.receiver_id === currentDMUser.user_id)) {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    }
    
    // Show notification
    if (message.sender_id !== user?.id) {
      toast(`New message from ${message.sender.display_name}: ${message.content.substring(0, 50)}...`);
    }
  };

  const handleUserOnline = (data: any) => {
    setMembers(prev => prev.map(m => 
      m.id === data.userId ? { ...m, is_online: true } : m
    ));
    setDmUsers(prev => prev.map(u => 
      u.user_id === data.userId ? { ...u, is_online: true } : u
    ));
  };

  const handleUserOffline = (data: any) => {
    setMembers(prev => prev.map(m => 
      m.id === data.userId ? { ...m, is_online: false } : m
    ));
    setDmUsers(prev => prev.map(u => 
      u.user_id === data.userId ? { ...u, is_online: false } : u
    ));
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      <Sidebar
        workspace={workspace}
        channels={channels}
        currentChannel={currentChannel}
        dmUsers={dmUsers}
        currentDMUser={currentDMUser}
        onSelectChannel={selectChannel}
        onSelectDMUser={selectDMUser}
        onCreateChannel={() => {}}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ChannelHeader
          channel={currentChannel}
          dmUser={currentDMUser}
          memberCount={currentChannel?.member_count || 0}
          onShowMembers={() => {}}
        />

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col">
            <MessageList
              messages={messages}
              loading={messageLoading}
              currentUserId={user?.id || 0}
              onEditMessage={editMessage}
              onDeleteMessage={deleteMessage}
              onReactToMessage={addReaction}
              onThreadClick={loadThreadReplies}
              onUserClick={setSelectedUser}
              typingUsers={Array.from(typingUsers.get(currentChannel?.id.toString() || '') || [])}
            />
            <div ref={messagesEndRef} />
            
            <MessageInput
              onSendMessage={sendMessage}
              channelName={currentChannel?.name || currentDMUser?.display_name || ''}
              onTyping={() => {
                if (currentChannel) {
                  socketService.startTyping(currentChannel.id.toString());
                }
              }}
              onStopTyping={() => {
                if (currentChannel) {
                  socketService.stopTyping(currentChannel.id.toString());
                }
              }}
            />
          </div>

          {selectedThread && (
            <ThreadPanel
              message={selectedThread}
              replies={threadReplies}
              onClose={() => {
                setSelectedThread(null);
                setThreadReplies([]);
              }}
              onSendReply={(content) => sendMessage(content, selectedThread.id)}
              currentUserId={user?.id || 0}
            />
          )}
        </div>
      </div>

      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onStartDM={(userId) => {
            const dmUser = dmUsers.find(u => u.user_id === userId);
            if (dmUser) {
              selectDMUser(dmUser);
              setSelectedUser(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default Workspace;
