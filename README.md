# Slack Clone - Full Stack Application

A comprehensive Slack clone with real-time messaging, channels, direct messages, file sharing, and more. Built with Node.js, Express, Socket.IO, PostgreSQL (Neon), and React.

## 🚀 Live Demo

- **Backend API**: https://slack-backend-morphvm-s6un9i69.http.cloud.morph.so
- **Health Check**: https://slack-backend-morphvm-s6un9i69.http.cloud.morph.so/health

## ✨ Features

### Core Messaging
- **Real-time messaging** with Socket.IO
- **Channels** (public and private)
- **Direct messages** between users
- **Thread replies** for organized conversations
- **Message reactions** with emojis
- **Message editing and deletion**
- **File attachments** support

### User Management
- **User authentication** with JWT
- **User profiles** with avatars and status
- **Online/offline presence** tracking
- **Custom status** messages and emojis
- **User search** and mentions (@username)

### Workspace Features
- **Multiple workspaces** support
- **Workspace member management**
- **Role-based access control** (owner, admin, moderator, member)
- **Channel management** within workspaces
- **Workspace invitations**

### Advanced Features
- **Full-text search** across messages, channels, users, and files
- **Message bookmarks** for saving important messages
- **Typing indicators** in real-time
- **Unread message counts**
- **Notification preferences** per channel
- **File upload** with multiple format support
- **Rate limiting** for API protection

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time bidirectional communication
- **PostgreSQL** (Neon) - Database
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Multer** - File uploads
- **Express Validator** - Input validation
- **Helmet** - Security headers
- **Morgan** - HTTP request logging
- **Compression** - Response compression

## 📦 Installation

### Prerequisites
- Node.js 16+
- PostgreSQL database (we use Neon)
- npm or yarn

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/alexander-edwards/slack-clone-fullstack.git
cd slack-clone-fullstack
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```env
# Database Configuration
DATABASE_URL=your_postgres_connection_string

# Server Configuration
PORT=3001
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Socket.IO Configuration
SOCKET_CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. Start the server:
```bash
npm start
```

## 📚 API Documentation

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "password123",
  "display_name": "John Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Workspaces

#### Create Workspace
```http
POST /api/workspaces
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Workspace",
  "slug": "my-workspace",
  "description": "Team workspace"
}
```

#### Get User's Workspaces
```http
GET /api/workspaces
Authorization: Bearer <token>
```

### Channels

#### Create Channel
```http
POST /api/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": 1,
  "name": "general",
  "description": "General discussion",
  "is_private": false
}
```

#### Join Channel
```http
POST /api/channels/:channelId/join
Authorization: Bearer <token>
```

### Messages

#### Send Message
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "channel_id": 1,
  "content": "Hello, world!",
  "parent_id": null
}
```

#### Get Channel Messages
```http
GET /api/messages/channel/:channelId?limit=50&before=timestamp&after=timestamp
Authorization: Bearer <token>
```

#### Add Reaction
```http
POST /api/messages/:messageId/reactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "emoji": "👍"
}
```

### Direct Messages

#### Send Direct Message
```http
POST /api/direct-messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": 1,
  "receiver_id": 2,
  "content": "Hey there!"
}
```

### Search

#### Global Search
```http
GET /api/search?q=search_term&workspace_id=1&type=messages&limit=20
Authorization: Bearer <token>
```

### WebSocket Events

#### Client Events
- `join:workspace` - Join a workspace room
- `join:channel` - Join a channel room
- `message:send` - Send a new message
- `message:edit` - Edit a message
- `message:delete` - Delete a message
- `reaction:add` - Add a reaction
- `reaction:remove` - Remove a reaction
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator
- `dm:send` - Send direct message
- `presence:update` - Update user presence

#### Server Events
- `message:new` - New message received
- `message:edited` - Message was edited
- `message:deleted` - Message was deleted
- `reaction:added` - Reaction added
- `reaction:removed` - Reaction removed
- `user:typing` - User is typing
- `user:stopped_typing` - User stopped typing
- `dm:new` - New direct message
- `user:online` - User came online
- `user:offline` - User went offline
- `mention:new` - You were mentioned

## 🏗️ Database Schema

The application uses PostgreSQL with the following main tables:

- `users` - User accounts and profiles
- `workspaces` - Team workspaces
- `workspace_members` - Workspace memberships
- `channels` - Communication channels
- `channel_members` - Channel memberships
- `messages` - Channel messages
- `direct_messages` - Direct messages
- `message_reactions` - Message reactions
- `message_attachments` - File attachments
- `threads` - Message threads
- `mentions` - User mentions
- `bookmarks` - Saved messages
- `user_presence` - Online/offline status
- `typing_indicators` - Real-time typing status

## 🔐 Security

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- SQL injection prevention
- XSS protection with Helmet
- CORS configuration
- File upload restrictions

## 🚦 Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Window: 15 minutes
- Max requests: 100 per window
- Applies to all `/api/` endpoints

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment (development/production) | production |
| `JWT_SECRET` | Secret for JWT signing | Required |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Required |
| `JWT_EXPIRE` | Access token expiry | 7d |
| `JWT_REFRESH_EXPIRE` | Refresh token expiry | 30d |
| `MAX_FILE_SIZE` | Max file upload size | 10MB |
| `UPLOAD_DIR` | Directory for uploads | ./uploads |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by Slack's excellent user experience
- Built with modern web technologies
- Powered by Neon PostgreSQL
