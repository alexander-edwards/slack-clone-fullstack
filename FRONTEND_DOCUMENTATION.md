# Slack Clone Frontend Documentation

## Overview

A full-featured Slack clone frontend built with React, TypeScript, and Tailwind CSS. Features real-time messaging, channels, direct messages, threads, reactions, and more.

## 🌐 Live Demo

- **Frontend URL**: https://slack-frontend-morphvm-s6un9i69.http.cloud.morph.so
- **Backend API**: http://localhost:3001

## 🚀 Features Implemented

### Core Features
- **User Authentication**
  - Login/Register forms with validation
  - JWT token management
  - Auto-refresh tokens
  - Persistent sessions

- **Workspace Management**
  - List all workspaces
  - Create new workspaces
  - Join/leave workspaces
  - Workspace member management

- **Channel Features**
  - Public and private channels
  - Create/join/leave channels
  - Channel member list
  - Channel descriptions

- **Messaging**
  - Real-time message sending/receiving
  - Message editing and deletion
  - Message formatting
  - Typing indicators
  - Message timestamps

- **Direct Messages**
  - One-on-one conversations
  - Online/offline status
  - Last message preview
  - Unread message counts

- **Advanced Features**
  - **Threads**: Reply to messages in threads
  - **Reactions**: Add emoji reactions to messages
  - **Mentions**: @username mentions
  - **Search**: Global search functionality
  - **File Uploads**: Attachment support
  - **User Profiles**: View user details
  - **Status Updates**: Custom status with emoji

### UI/UX Features
- Responsive design
- Dark purple Slack-like theme
- Smooth animations
- Loading states
- Error handling with toast notifications
- Keyboard shortcuts (Enter to send, Esc to cancel)
- Auto-scroll to latest messages
- Date separators in message list

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS v3** - Styling
- **Socket.io Client** - Real-time communication
- **React Router v6** - Routing
- **Axios** - HTTP client
- **date-fns** - Date formatting
- **emoji-picker-react** - Emoji selection
- **react-hot-toast** - Notifications
- **@headlessui/react** - UI components
- **@heroicons/react** - Icons

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ChannelHeader.tsx
│   │   ├── CreateWorkspaceModal.tsx
│   │   ├── MessageInput.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MessageList.tsx
│   │   ├── PrivateRoute.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ThreadPanel.tsx
│   │   └── UserProfileModal.tsx
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx
│   ├── pages/             # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Workspace.tsx
│   │   └── WorkspaceList.tsx
│   ├── services/          # API and WebSocket services
│   │   ├── api.ts
│   │   └── socket.ts
│   ├── App.tsx            # Main app component
│   └── index.tsx          # Entry point
├── public/                # Static assets
├── tailwind.config.js     # Tailwind configuration
└── package.json          # Dependencies

```

## 🔧 Installation & Setup

1. **Install dependencies**:
```bash
cd frontend
npm install
```

2. **Configure environment**:
Create `.env` file:
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001
```

3. **Start development server**:
```bash
npm start
```

4. **Build for production**:
```bash
npm run build
```

## 🎯 Component Overview

### Pages

#### Login (`/login`)
- Email/password authentication
- Quick demo login buttons
- Form validation
- Link to registration

#### Register (`/register`)
- User registration form
- Password confirmation
- Username validation
- Auto-redirect after registration

#### WorkspaceList (`/workspaces`)
- Display all user workspaces
- Create new workspace modal
- Workspace cards with member counts
- Role badges (admin, member)

#### Workspace (`/workspace/:id`)
- Main chat interface
- Three-column layout:
  - Sidebar (channels & DMs)
  - Message area
  - Thread panel (optional)
- Real-time updates

### Components

#### Sidebar
- Workspace header
- Channel list (public/private)
- Direct message list
- Online status indicators
- Collapsible sections

#### MessageList
- Grouped by date
- User avatars
- Message timestamps
- Edit/delete options
- Reactions display
- Thread indicators
- Typing indicators

#### MessageInput
- Rich text input
- Emoji picker
- File attachment button
- Send button
- Typing notifications

#### ThreadPanel
- Original message
- Thread replies
- Reply input
- Reply count

#### UserProfileModal
- User avatar
- Display name
- Status
- Start DM button

## 🔌 API Integration

### Authentication Flow
1. User enters credentials
2. Frontend sends to `/api/auth/login`
3. Receives JWT tokens
4. Stores in localStorage
5. Attaches to all API requests
6. Auto-refreshes when expired

### WebSocket Connection
1. Connects on login with JWT
2. Joins workspace/channel rooms
3. Listens for real-time events
4. Updates UI immediately
5. Handles reconnection

### Data Flow
1. **Initial Load**: Fetch workspace data
2. **Channel Selection**: Load messages
3. **Send Message**: API call + WebSocket emit
4. **Receive Update**: WebSocket listener updates state
5. **UI Update**: React re-renders

## 🎨 Styling & Theme

### Color Palette
- **Primary**: Slack Purple (#4A154B)
- **Sidebar**: Dark Purple (#3F0E40)
- **Active**: Blue (#1164A3)
- **Success**: Green (#007A5A)
- **Text**: Dark Gray (#1D1C1D)
- **Border**: Light Gray (#E1E1E1)

### Custom Classes
- Slack-themed color utilities
- Custom animations (pulse-slow)
- Responsive breakpoints
- Dark mode ready

## ⚡ Performance Optimizations

- Lazy loading of components
- Message virtualization (can be added)
- Debounced typing indicators
- Optimistic UI updates
- Cached user data
- Efficient re-renders with React.memo

## 🐛 Known Issues & Limitations

1. **WebSocket Reconnection**: May need manual refresh on disconnect
2. **File Uploads**: UI present but backend integration pending
3. **Search**: Basic implementation, needs enhancement
4. **Notifications**: Browser notifications not implemented
5. **Mobile Responsiveness**: Needs optimization for small screens

## 🔄 State Management

- **AuthContext**: User authentication state
- **Local State**: Component-specific data
- **WebSocket Events**: Real-time updates
- **API Calls**: Server data fetching

## 🚦 Testing

Run tests:
```bash
npm test
```

Build for production:
```bash
npm run build
```

## 📝 Future Enhancements

1. **Features**
   - Voice/Video calls
   - Screen sharing
   - Rich text editor
   - Message formatting (markdown)
   - Slash commands
   - Giphy integration

2. **Technical**
   - Redux/Zustand for state management
   - Service workers for offline
   - Push notifications
   - Message pagination
   - Infinite scroll
   - Virtual scrolling

3. **UI/UX**
   - Dark mode toggle
   - Customizable themes
   - Keyboard shortcuts menu
   - Settings page
   - User preferences

## 📄 License

MIT License - Feel free to use for any purpose

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📞 Support

For issues or questions, please open an issue on GitHub.
