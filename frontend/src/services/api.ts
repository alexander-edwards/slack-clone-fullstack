import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data: any) => api.post('/api/auth/register', data),
  login: (data: any) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data: any) => api.put('/api/auth/profile', data),
  changePassword: (data: any) => api.post('/api/auth/change-password', data),
};

// Workspace APIs
export const workspaceAPI = {
  getAll: () => api.get('/api/workspaces'),
  create: (data: any) => api.post('/api/workspaces', data),
  getDetails: (id: string) => api.get(`/api/workspaces/${id}`),
  update: (id: string, data: any) => api.put(`/api/workspaces/${id}`, data),
  getMembers: (id: string) => api.get(`/api/workspaces/${id}/members`),
  addMember: (id: string, data: any) => api.post(`/api/workspaces/${id}/members`, data),
  removeMember: (id: string, userId: string) => api.delete(`/api/workspaces/${id}/members/${userId}`),
  leave: (id: string) => api.post(`/api/workspaces/${id}/leave`),
};

// Channel APIs
export const channelAPI = {
  getByWorkspace: (workspaceId: string) => api.get(`/api/channels/workspace/${workspaceId}`),
  create: (data: any) => api.post('/api/channels', data),
  getDetails: (id: string) => api.get(`/api/channels/${id}`),
  update: (id: string, data: any) => api.put(`/api/channels/${id}`, data),
  delete: (id: string) => api.delete(`/api/channels/${id}`),
  getMembers: (id: string) => api.get(`/api/channels/${id}/members`),
  join: (id: string) => api.post(`/api/channels/${id}/join`),
  leave: (id: string) => api.post(`/api/channels/${id}/leave`),
  addMembers: (id: string, userIds: number[]) => api.post(`/api/channels/${id}/members`, { user_ids: userIds }),
  updateNotifications: (id: string, preference: string) => api.patch(`/api/channels/${id}/notifications`, { preference }),
};

// Message APIs
export const messageAPI = {
  getChannelMessages: (channelId: string, params?: any) => api.get(`/api/messages/channel/${channelId}`, { params }),
  send: (data: any) => api.post('/api/messages', data),
  sendWithAttachment: (formData: FormData) => api.post('/api/messages/with-attachment', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  edit: (id: string, content: string) => api.put(`/api/messages/${id}`, { content }),
  delete: (id: string) => api.delete(`/api/messages/${id}`),
  addReaction: (id: string, emoji: string) => api.post(`/api/messages/${id}/reactions`, { emoji }),
  removeReaction: (id: string, emoji: string) => api.delete(`/api/messages/${id}/reactions/${encodeURIComponent(emoji)}`),
  getThread: (id: string) => api.get(`/api/messages/${id}/thread`),
  bookmark: (id: string) => api.post(`/api/messages/${id}/bookmark`),
  unbookmark: (id: string) => api.delete(`/api/messages/${id}/bookmark`),
  getBookmarks: () => api.get('/api/messages/bookmarks/all'),
};

// Direct Message APIs
export const dmAPI = {
  getConversations: (workspaceId: string) => api.get(`/api/direct-messages/workspace/${workspaceId}`),
  getMessages: (params: any) => api.get('/api/direct-messages/conversation', { params }),
  send: (data: any) => api.post('/api/direct-messages', data),
  edit: (id: string, content: string) => api.put(`/api/direct-messages/${id}`, { content }),
  delete: (id: string) => api.delete(`/api/direct-messages/${id}`),
  addReaction: (id: string, emoji: string) => api.post(`/api/direct-messages/${id}/reactions`, { emoji }),
  removeReaction: (id: string, emoji: string) => api.delete(`/api/direct-messages/${id}/reactions/${encodeURIComponent(emoji)}`),
  getUnreadCount: (workspaceId: string) => api.get(`/api/direct-messages/unread/${workspaceId}`),
};

// User APIs
export const userAPI = {
  search: (params: any) => api.get('/api/users/search', { params }),
  getProfile: (id: string) => api.get(`/api/users/${id}`),
  updateStatus: (data: any) => api.put('/api/users/status', data),
  updatePresence: (data: any) => api.put('/api/users/presence', data),
  getMentions: (params?: any) => api.get('/api/users/mentions/all', { params }),
  getActivity: (userId: string, params?: any) => api.get(`/api/users/${userId}/activity`, { params }),
  getWorkspaceUsers: (workspaceId: string) => api.get(`/api/users/workspace/${workspaceId}/all`),
};

// Search APIs
export const searchAPI = {
  global: (params: any) => api.get('/api/search', { params }),
  channel: (channelId: string, params: any) => api.get(`/api/search/channel/${channelId}`, { params }),
  directMessages: (params: any) => api.get('/api/search/direct-messages', { params }),
};

export default api;
