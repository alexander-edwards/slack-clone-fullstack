# Slack Clone API Documentation

Base URL: `https://slack-backend-morphvm-s6un9i69.http.cloud.morph.so`

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Test Credentials

- Email: `alice@example.com`
- Password: `demo123`

## API Endpoints

### Authentication Endpoints

#### 1. Register User
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

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "display_name": "John Doe",
    "avatar_url": "https://ui-avatars.com/api/?name=John+Doe"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### 2. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "demo123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "username": "alice",
    "display_name": "Alice Johnson",
    "avatar_url": "https://ui-avatars.com/api/?name=Alice+Johnson",
    "status_text": "Working from home",
    "status_emoji": "🏠"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### 3. Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### 4. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### 5. Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "New Name",
  "status_text": "In a meeting",
  "status_emoji": "📅",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

### Workspace Endpoints

#### 1. Get User's Workspaces
```http
GET /api/workspaces
Authorization: Bearer <token>
```

#### 2. Create Workspace
```http
POST /api/workspaces
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Team",
  "slug": "my-team",
  "description": "Team collaboration space"
}
```

#### 3. Get Workspace Details
```http
GET /api/workspaces/:workspaceId
Authorization: Bearer <token>
```

#### 4. Get Workspace Members
```http
GET /api/workspaces/:workspaceId/members
Authorization: Bearer <token>
```

#### 5. Add Member to Workspace
```http
POST /api/workspaces/:workspaceId/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": 2,
  "role": "member"
}
```

### Channel Endpoints

#### 1. Get Workspace Channels
```http
GET /api/channels/workspace/:workspaceId
Authorization: Bearer <token>
```

#### 2. Create Channel
```http
POST /api/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": 1,
  "name": "engineering",
  "description": "Engineering team channel",
  "is_private": false
}
```

#### 3. Join Channel
```http
POST /api/channels/:channelId/join
Authorization: Bearer <token>
```

#### 4. Leave Channel
```http
POST /api/channels/:channelId/leave
Authorization: Bearer <token>
```

#### 5. Get Channel Members
```http
GET /api/channels/:channelId/members
Authorization: Bearer <token>
```

### Message Endpoints

#### 1. Get Channel Messages
```http
GET /api/messages/channel/:channelId?limit=50&before=2024-01-01T00:00:00Z
Authorization: Bearer <token>
```

#### 2. Send Message
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "channel_id": 1,
  "content": "Hello everyone!",
  "parent_id": null
}
```

#### 3. Send Message with Attachment
```http
POST /api/messages/with-attachment
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: (binary)
channel_id: 1
content: "Check out this file"
```

#### 4. Edit Message
```http
PUT /api/messages/:messageId
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated message content"
}
```

#### 5. Delete Message
```http
DELETE /api/messages/:messageId
Authorization: Bearer <token>
```

#### 6. Add Reaction
```http
POST /api/messages/:messageId/reactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "emoji": "👍"
}
```

#### 7. Remove Reaction
```http
DELETE /api/messages/:messageId/reactions/:emoji
Authorization: Bearer <token>
```

#### 8. Get Thread Replies
```http
GET /api/messages/:messageId/thread
Authorization: Bearer <token>
```

#### 9. Bookmark Message
```http
POST /api/messages/:messageId/bookmark
Authorization: Bearer <token>
```

#### 10. Get All Bookmarks
```http
GET /api/messages/bookmarks/all
Authorization: Bearer <token>
```

### Direct Message Endpoints

#### 1. Get DM Conversations
```http
GET /api/direct-messages/workspace/:workspaceId
Authorization: Bearer <token>
```

#### 2. Get DM History
```http
GET /api/direct-messages/conversation?workspace_id=1&other_user_id=2&limit=50
Authorization: Bearer <token>
```

#### 3. Send Direct Message
```http
POST /api/direct-messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": 1,
  "receiver_id": 2,
  "content": "Hey, how are you?"
}
```

#### 4. Get Unread DM Count
```http
GET /api/direct-messages/unread/:workspaceId
Authorization: Bearer <token>
```

### User Endpoints

#### 1. Search Users
```http
GET /api/users/search?q=alice&workspace_id=1&limit=10
Authorization: Bearer <token>
```

#### 2. Get User Profile
```http
GET /api/users/:userId
Authorization: Bearer <token>
```

#### 3. Update User Status
```http
PUT /api/users/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status_text": "In a meeting",
  "status_emoji": "📅"
}
```

#### 4. Update Presence
```http
PUT /api/users/presence
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": 1,
  "status": "active"
}
```

Status values: `active`, `away`, `dnd`, `offline`

#### 5. Get User Mentions
```http
GET /api/users/mentions/all?workspace_id=1&unread_only=true
Authorization: Bearer <token>
```

### Search Endpoints

#### 1. Global Search
```http
GET /api/search?q=hello&workspace_id=1&type=messages&limit=20
Authorization: Bearer <token>
```

Type values: `messages`, `channels`, `users`, `files`

#### 2. Search in Channel
```http
GET /api/search/channel/:channelId?q=hello&from_user=alice&has_file=true
Authorization: Bearer <token>
```

#### 3. Search Direct Messages
```http
GET /api/search/direct-messages?q=hello&workspace_id=1&other_user_id=2
Authorization: Bearer <token>
```

## WebSocket Events

### Connection

Connect with authentication:
```javascript
const socket = io('wss://slack-backend-morphvm-s6un9i69.http.cloud.morph.so', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Client Events (Emit)

#### Join Workspace
```javascript
socket.emit('join:workspace', workspaceId);
```

#### Join Channel
```javascript
socket.emit('join:channel', channelId);
```

#### Send Message
```javascript
socket.emit('message:send', {
  channelId: 1,
  content: 'Hello!',
  parentId: null // optional, for threads
});
```

#### Start Typing
```javascript
socket.emit('typing:start', channelId);
```

#### Stop Typing
```javascript
socket.emit('typing:stop', channelId);
```

#### Send Direct Message
```javascript
socket.emit('dm:send', {
  workspaceId: 1,
  receiverId: 2,
  content: 'Hey there!'
});
```

### Server Events (Listen)

#### New Message
```javascript
socket.on('message:new', (message) => {
  console.log('New message:', message);
});
```

#### User Typing
```javascript
socket.on('user:typing', (data) => {
  console.log(`${data.username} is typing in channel ${data.channelId}`);
});
```

#### User Online/Offline
```javascript
socket.on('user:online', (data) => {
  console.log(`${data.username} is online`);
});

socket.on('user:offline', (data) => {
  console.log(`${data.username} is offline`);
});
```

#### New Mention
```javascript
socket.on('mention:new', (data) => {
  console.log('You were mentioned:', data);
});
```

#### New Direct Message
```javascript
socket.on('dm:new', (message) => {
  console.log('New DM:', message);
});
```

## Rate Limiting

- Window: 15 minutes
- Max requests: 100 per window
- Applies to all `/api/*` endpoints

## File Upload Limits

- Max file size: 10MB
- Supported formats: jpeg, jpg, png, gif, pdf, doc, docx, txt, csv, zip, mp4, mp3

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "errors": [
    {
      "msg": "Invalid email",
      "param": "email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Access token required"
}
```

### 403 Forbidden
```json
{
  "error": "Not a member of this workspace"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "User already exists"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```
