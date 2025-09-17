import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
    
    this.socket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });

    // Forward all events to registered listeners
    this.setupEventForwarding();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  private setupEventForwarding() {
    if (!this.socket) return;

    const events = [
      'message:new',
      'message:edited',
      'message:deleted',
      'reaction:added',
      'reaction:removed',
      'user:typing',
      'user:stopped_typing',
      'user:online',
      'user:offline',
      'user:presence_changed',
      'dm:new',
      'dm:sent',
      'mention:new',
      'joined:workspace',
      'joined:channel',
      'left:channel',
    ];

    events.forEach(event => {
      this.socket!.on(event, (data: any) => {
        this.emit(event, data);
      });
    });
  }

  // Event emitters
  joinWorkspace(workspaceId: string) {
    this.socket?.emit('join:workspace', workspaceId);
  }

  joinChannel(channelId: string) {
    this.socket?.emit('join:channel', channelId);
  }

  leaveChannel(channelId: string) {
    this.socket?.emit('leave:channel', channelId);
  }

  sendMessage(channelId: string, content: string, parentId?: string) {
    this.socket?.emit('message:send', { channelId, content, parentId });
  }

  editMessage(messageId: string, content: string) {
    this.socket?.emit('message:edit', { messageId, content });
  }

  deleteMessage(messageId: string) {
    this.socket?.emit('message:delete', messageId);
  }

  addReaction(messageId: string, emoji: string) {
    this.socket?.emit('reaction:add', { messageId, emoji });
  }

  removeReaction(messageId: string, emoji: string) {
    this.socket?.emit('reaction:remove', { messageId, emoji });
  }

  startTyping(channelId: string) {
    this.socket?.emit('typing:start', channelId);
  }

  stopTyping(channelId: string) {
    this.socket?.emit('typing:stop', channelId);
  }

  sendDirectMessage(workspaceId: string, receiverId: number, content: string) {
    this.socket?.emit('dm:send', { workspaceId, receiverId, content });
  }

  updatePresence(workspaceId: string, status: string) {
    this.socket?.emit('presence:update', { workspaceId, status });
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export default socketService;
