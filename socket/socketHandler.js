const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

// Store active connections
const userSockets = new Map(); // userId -> Set of socket IDs
const socketUsers = new Map(); // socket ID -> user data

const socketHandler = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
          return next(new Error('Invalid token'));
        }

        // Get user data
        const result = await query(
          'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (result.rows.length === 0) {
          return next(new Error('User not found'));
        }

        socket.userId = decoded.userId;
        socket.user = result.rows[0];
        next();
      });
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.username} connected (${socket.id})`);

    // Store socket connection
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);
    socketUsers.set(socket.id, socket.user);

    // Update user online status
    await query(
      'UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [socket.userId]
    );

    // Join workspace rooms
    socket.on('join:workspace', async (workspaceId) => {
      try {
        // Verify membership
        const memberCheck = await query(
          'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
          [workspaceId, socket.userId]
        );

        if (memberCheck.rows.length > 0) {
          socket.join(`workspace:${workspaceId}`);
          
          // Get all channels user is member of
          const channels = await query(
            'SELECT channel_id FROM channel_members WHERE user_id = $1',
            [socket.userId]
          );

          // Join channel rooms
          for (const channel of channels.rows) {
            socket.join(`channel:${channel.channel_id}`);
          }

          // Notify workspace members that user is online
          socket.to(`workspace:${workspaceId}`).emit('user:online', {
            userId: socket.userId,
            username: socket.user.username
          });

          // Update presence
          await query(
            `INSERT INTO user_presence (user_id, workspace_id, status, last_active)
             VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, workspace_id)
             DO UPDATE SET status = 'active', last_active = CURRENT_TIMESTAMP`,
            [socket.userId, workspaceId]
          );

          socket.emit('joined:workspace', { workspaceId });
        }
      } catch (error) {
        console.error('Join workspace error:', error);
        socket.emit('error', { message: 'Failed to join workspace' });
      }
    });

    // Join channel
    socket.on('join:channel', async (channelId) => {
      try {
        // Verify membership
        const memberCheck = await query(
          'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
          [channelId, socket.userId]
        );

        if (memberCheck.rows.length > 0) {
          socket.join(`channel:${channelId}`);
          socket.emit('joined:channel', { channelId });
        }
      } catch (error) {
        console.error('Join channel error:', error);
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // Leave channel
    socket.on('leave:channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
      socket.emit('left:channel', { channelId });
    });

    // Handle new message
    socket.on('message:send', async (data) => {
      try {
        const { channelId, content, parentId } = data;

        // Verify channel membership
        const memberCheck = await query(
          'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
          [channelId, socket.userId]
        );

        if (memberCheck.rows.length === 0) {
          return socket.emit('error', { message: 'Not a member of this channel' });
        }

        // Insert message
        const result = await query(
          `INSERT INTO messages (channel_id, user_id, content, parent_id)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [channelId, socket.userId, content, parentId || null]
        );

        const message = result.rows[0];

        // Prepare message with user info
        const fullMessage = {
          ...message,
          user: socket.user
        };

        // Emit to all channel members
        io.to(`channel:${channelId}`).emit('message:new', fullMessage);

        // Handle mentions
        const mentions = content.match(/@(\w+)/g);
        if (mentions) {
          for (const mention of mentions) {
            const username = mention.substring(1);
            const userResult = await query(
              'SELECT id FROM users WHERE username = $1',
              [username]
            );

            if (userResult.rows.length > 0) {
              const mentionedUserId = userResult.rows[0].id;
              
              // Save mention
              await query(
                'INSERT INTO mentions (message_id, mentioned_user_id) VALUES ($1, $2)',
                [message.id, mentionedUserId]
              );

              // Notify mentioned user
              const mentionedUserSockets = userSockets.get(mentionedUserId);
              if (mentionedUserSockets) {
                for (const socketId of mentionedUserSockets) {
                  io.to(socketId).emit('mention:new', {
                    message: fullMessage,
                    channelId
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message edit
    socket.on('message:edit', async (data) => {
      try {
        const { messageId, content } = data;

        // Verify ownership
        const messageCheck = await query(
          'SELECT channel_id FROM messages WHERE id = $1 AND user_id = $2',
          [messageId, socket.userId]
        );

        if (messageCheck.rows.length === 0) {
          return socket.emit('error', { message: 'Cannot edit this message' });
        }

        const channelId = messageCheck.rows[0].channel_id;

        // Update message
        const result = await query(
          `UPDATE messages 
           SET content = $1, edited_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [content, messageId]
        );

        const message = result.rows[0];

        // Emit to channel members
        io.to(`channel:${channelId}`).emit('message:edited', {
          ...message,
          user: socket.user
        });
      } catch (error) {
        console.error('Edit message error:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Handle message deletion
    socket.on('message:delete', async (messageId) => {
      try {
        // Verify ownership or admin
        const messageCheck = await query(
          'SELECT channel_id FROM messages WHERE id = $1 AND user_id = $2',
          [messageId, socket.userId]
        );

        if (messageCheck.rows.length === 0) {
          return socket.emit('error', { message: 'Cannot delete this message' });
        }

        const channelId = messageCheck.rows[0].channel_id;

        // Soft delete
        await query(
          'UPDATE messages SET is_deleted = true WHERE id = $1',
          [messageId]
        );

        // Emit to channel members
        io.to(`channel:${channelId}`).emit('message:deleted', { messageId });
      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Handle reactions
    socket.on('reaction:add', async (data) => {
      try {
        const { messageId, emoji } = data;

        // Get message channel
        const messageResult = await query(
          'SELECT channel_id FROM messages WHERE id = $1',
          [messageId]
        );

        if (messageResult.rows.length === 0) {
          return socket.emit('error', { message: 'Message not found' });
        }

        const channelId = messageResult.rows[0].channel_id;

        // Add reaction
        await query(
          `INSERT INTO message_reactions (message_id, user_id, emoji)
           VALUES ($1, $2, $3)
           ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
          [messageId, socket.userId, emoji]
        );

        // Emit to channel members
        io.to(`channel:${channelId}`).emit('reaction:added', {
          messageId,
          emoji,
          userId: socket.userId,
          username: socket.user.username
        });
      } catch (error) {
        console.error('Add reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    socket.on('reaction:remove', async (data) => {
      try {
        const { messageId, emoji } = data;

        // Get message channel
        const messageResult = await query(
          'SELECT channel_id FROM messages WHERE id = $1',
          [messageId]
        );

        if (messageResult.rows.length === 0) {
          return socket.emit('error', { message: 'Message not found' });
        }

        const channelId = messageResult.rows[0].channel_id;

        // Remove reaction
        await query(
          'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [messageId, socket.userId, emoji]
        );

        // Emit to channel members
        io.to(`channel:${channelId}`).emit('reaction:removed', {
          messageId,
          emoji,
          userId: socket.userId
        });
      } catch (error) {
        console.error('Remove reaction error:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // Handle typing indicators
    socket.on('typing:start', async (channelId) => {
      try {
        // Store typing indicator
        await query(
          `INSERT INTO typing_indicators (channel_id, user_id, started_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (channel_id, user_id)
           DO UPDATE SET started_at = CURRENT_TIMESTAMP`,
          [channelId, socket.userId]
        );

        // Broadcast to channel members except sender
        socket.to(`channel:${channelId}`).emit('user:typing', {
          channelId,
          userId: socket.userId,
          username: socket.user.username
        });

        // Auto-remove typing indicator after 5 seconds
        setTimeout(async () => {
          await query(
            'DELETE FROM typing_indicators WHERE channel_id = $1 AND user_id = $2',
            [channelId, socket.userId]
          );

          socket.to(`channel:${channelId}`).emit('user:stopped_typing', {
            channelId,
            userId: socket.userId
          });
        }, 5000);
      } catch (error) {
        console.error('Typing indicator error:', error);
      }
    });

    socket.on('typing:stop', async (channelId) => {
      try {
        // Remove typing indicator
        await query(
          'DELETE FROM typing_indicators WHERE channel_id = $1 AND user_id = $2',
          [channelId, socket.userId]
        );

        // Broadcast to channel members
        socket.to(`channel:${channelId}`).emit('user:stopped_typing', {
          channelId,
          userId: socket.userId
        });
      } catch (error) {
        console.error('Stop typing error:', error);
      }
    });

    // Handle direct messages
    socket.on('dm:send', async (data) => {
      try {
        const { workspaceId, receiverId, content } = data;

        // Insert DM
        const result = await query(
          `INSERT INTO direct_messages (workspace_id, sender_id, receiver_id, content)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [workspaceId, socket.userId, receiverId, content]
        );

        const message = result.rows[0];

        // Prepare message with user info
        const fullMessage = {
          ...message,
          sender: socket.user
        };

        // Send to receiver if online
        const receiverSockets = userSockets.get(receiverId);
        if (receiverSockets) {
          for (const socketId of receiverSockets) {
            io.to(socketId).emit('dm:new', fullMessage);
          }
        }

        // Send back to sender
        socket.emit('dm:sent', fullMessage);
      } catch (error) {
        console.error('Send DM error:', error);
        socket.emit('error', { message: 'Failed to send direct message' });
      }
    });

    // Handle presence updates
    socket.on('presence:update', async (data) => {
      try {
        const { workspaceId, status } = data;

        // Update presence
        await query(
          `INSERT INTO user_presence (user_id, workspace_id, status, last_active)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, workspace_id)
           DO UPDATE SET status = $3, last_active = CURRENT_TIMESTAMP`,
          [socket.userId, workspaceId, status]
        );

        // Broadcast to workspace members
        socket.to(`workspace:${workspaceId}`).emit('user:presence_changed', {
          userId: socket.userId,
          status
        });
      } catch (error) {
        console.error('Presence update error:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected (${socket.id})`);

      // Remove socket from tracking
      const userSocketSet = userSockets.get(socket.userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        
        // If no more sockets for this user, mark as offline
        if (userSocketSet.size === 0) {
          userSockets.delete(socket.userId);

          // Update user offline status
          await query(
            'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
            [socket.userId]
          );

          // Update presence in all workspaces
          await query(
            `UPDATE user_presence 
             SET status = 'offline', last_active = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [socket.userId]
          );

          // Notify all workspaces
          const workspaces = await query(
            'SELECT workspace_id FROM workspace_members WHERE user_id = $1',
            [socket.userId]
          );

          for (const workspace of workspaces.rows) {
            io.to(`workspace:${workspace.workspace_id}`).emit('user:offline', {
              userId: socket.userId,
              username: socket.user.username
            });
          }
        }
      }

      socketUsers.delete(socket.id);

      // Clean up typing indicators
      await query(
        'DELETE FROM typing_indicators WHERE user_id = $1',
        [socket.userId]
      );
    });
  });
};

module.exports = socketHandler;
