const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../db/connection');
const { authenticateChannelMember } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|zip|mp4|mp3/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get messages for a channel
router.get('/channel/:channelId', authenticateChannelMember, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, before, after } = req.query;

    let queryStr = `
      SELECT m.*, 
             u.username, u.display_name, u.avatar_url,
             COUNT(DISTINCT r.id) as reaction_count,
             COUNT(DISTINCT t.id) as reply_count,
             array_agg(DISTINCT jsonb_build_object(
               'id', r.id,
               'emoji', r.emoji,
               'user_id', r.user_id,
               'username', ru.username
             )) FILTER (WHERE r.id IS NOT NULL) as reactions,
             array_agg(DISTINCT jsonb_build_object(
               'id', a.id,
               'filename', a.filename,
               'file_url', a.file_url,
               'file_type', a.file_type,
               'file_size', a.file_size
             )) FILTER (WHERE a.id IS NOT NULL) as attachments
      FROM messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN message_reactions r ON m.id = r.message_id
      LEFT JOIN users ru ON r.user_id = ru.id
      LEFT JOIN message_attachments a ON m.id = a.message_id
      LEFT JOIN threads t ON m.id = t.message_id
      WHERE m.channel_id = $1 AND m.is_deleted = false AND m.parent_id IS NULL
    `;

    const params = [channelId];
    let paramCount = 2;

    if (before) {
      queryStr += ` AND m.created_at < $${paramCount}`;
      params.push(before);
      paramCount++;
    }

    if (after) {
      queryStr += ` AND m.created_at > $${paramCount}`;
      params.push(after);
      paramCount++;
    }

    queryStr += `
      GROUP BY m.id, u.username, u.display_name, u.avatar_url
      ORDER BY m.created_at DESC
      LIMIT $${paramCount}
    `;
    params.push(parseInt(limit));

    const result = await query(queryStr, params);

    // Update last read timestamp
    await query(
      'UPDATE channel_members SET last_read_at = CURRENT_TIMESTAMP WHERE channel_id = $1 AND user_id = $2',
      [channelId, req.user.id]
    );

    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send a message
router.post('/', [
  body('channel_id').isInt(),
  body('content').isLength({ min: 1, max: 4000 }),
  body('parent_id').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { channel_id, content, parent_id } = req.body;

    // Check channel membership
    const memberCheck = await query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channel_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    const result = await transaction(async (client) => {
      // Insert message
      const messageResult = await client.query(
        `INSERT INTO messages (channel_id, user_id, content, parent_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [channel_id, req.user.id, content, parent_id]
      );

      const message = messageResult.rows[0];

      // If it's a thread reply, update thread info
      if (parent_id) {
        await client.query(
          `INSERT INTO threads (message_id, last_reply_at, reply_count, participant_count)
           VALUES ($1, CURRENT_TIMESTAMP, 1, 1)
           ON CONFLICT (message_id) 
           DO UPDATE SET 
             last_reply_at = CURRENT_TIMESTAMP,
             reply_count = threads.reply_count + 1`,
          [parent_id]
        );

        // Add participant to thread
        await client.query(
          `INSERT INTO thread_participants (thread_id, user_id)
           SELECT id, $2 FROM threads WHERE message_id = $1
           ON CONFLICT (thread_id, user_id) DO NOTHING`,
          [parent_id, req.user.id]
        );
      }

      // Extract and save mentions
      const mentions = content.match(/@(\w+)/g);
      if (mentions) {
        for (const mention of mentions) {
          const username = mention.substring(1);
          const userResult = await client.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
          );
          if (userResult.rows.length > 0) {
            await client.query(
              'INSERT INTO mentions (message_id, mentioned_user_id) VALUES ($1, $2)',
              [message.id, userResult.rows[0].id]
            );
          }
        }
      }

      return message;
    });

    // Get complete message with user info
    const completeMessage = await query(
      `SELECT m.*, u.username, u.display_name, u.avatar_url
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.id = $1`,
      [result.id]
    );

    res.status(201).json({
      message: 'Message sent successfully',
      data: completeMessage.rows[0]
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send message with file attachment
router.post('/with-attachment', upload.single('file'), [
  body('channel_id').isInt(),
  body('content').optional().isLength({ max: 4000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { channel_id, content = '' } = req.body;

    // Check channel membership
    const memberCheck = await query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channel_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const result = await transaction(async (client) => {
      // Insert message
      const messageContent = content || `📎 ${req.file.originalname}`;
      const messageResult = await client.query(
        `INSERT INTO messages (channel_id, user_id, content) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [channel_id, req.user.id, messageContent]
      );

      const message = messageResult.rows[0];

      // Insert attachment
      const fileUrl = `/uploads/${req.file.filename}`;
      await client.query(
        `INSERT INTO message_attachments (message_id, filename, file_url, file_type, file_size)
         VALUES ($1, $2, $3, $4, $5)`,
        [message.id, req.file.originalname, fileUrl, req.file.mimetype, req.file.size]
      );

      return message;
    });

    res.status(201).json({
      message: 'Message with attachment sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Send message with attachment error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Edit a message
router.put('/:messageId', [
  body('content').isLength({ min: 1, max: 4000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { messageId } = req.params;
    const { content } = req.body;

    // Check if user owns the message
    const messageCheck = await query(
      'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Cannot edit this message' });
    }

    const result = await query(
      `UPDATE messages 
       SET content = $1, edited_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [content, messageId]
    );

    res.json({
      message: 'Message updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if user owns the message or is admin
    const messageCheck = await query(
      `SELECT m.*, wm.role 
       FROM messages m
       JOIN channels c ON m.channel_id = c.id
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id AND wm.user_id = $2
       WHERE m.id = $1`,
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageCheck.rows[0];
    if (message.user_id !== req.user.id && message.role !== 'admin' && message.role !== 'owner') {
      return res.status(403).json({ error: 'Cannot delete this message' });
    }

    // Soft delete
    await query(
      'UPDATE messages SET is_deleted = true WHERE id = $1',
      [messageId]
    );

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Add reaction to message
router.post('/:messageId/reactions', [
  body('emoji').isLength({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { messageId } = req.params;
    const { emoji } = req.body;

    // Check if message exists and user has access
    const messageCheck = await query(
      `SELECT m.* FROM messages m
       JOIN channel_members cm ON m.channel_id = cm.channel_id
       WHERE m.id = $1 AND cm.user_id = $2`,
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or no access' });
    }

    const result = await query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING 
       RETURNING *`,
      [messageId, req.user.id, emoji]
    );

    res.status(201).json({
      message: 'Reaction added successfully',
      reaction: result.rows[0]
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from message
router.delete('/:messageId/reactions/:emoji', async (req, res) => {
  try {
    const { messageId, emoji } = req.params;

    await query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, req.user.id, decodeURIComponent(emoji)]
    );

    res.json({ message: 'Reaction removed successfully' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Get thread replies
router.get('/:messageId/thread', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if user has access to the parent message
    const parentCheck = await query(
      `SELECT m.* FROM messages m
       JOIN channel_members cm ON m.channel_id = cm.channel_id
       WHERE m.id = $1 AND cm.user_id = $2`,
      [messageId, req.user.id]
    );

    if (parentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found or no access' });
    }

    // Get thread replies
    const result = await query(
      `SELECT m.*, 
              u.username, u.display_name, u.avatar_url,
              array_agg(DISTINCT jsonb_build_object(
                'id', r.id,
                'emoji', r.emoji,
                'user_id', r.user_id
              )) FILTER (WHERE r.id IS NOT NULL) as reactions
       FROM messages m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN message_reactions r ON m.id = r.message_id
       WHERE m.parent_id = $1 AND m.is_deleted = false
       GROUP BY m.id, u.username, u.display_name, u.avatar_url
       ORDER BY m.created_at ASC`,
      [messageId]
    );

    // Update thread participant last read
    await query(
      `UPDATE thread_participants 
       SET last_read_at = CURRENT_TIMESTAMP 
       WHERE thread_id = (SELECT id FROM threads WHERE message_id = $1) 
       AND user_id = $2`,
      [messageId, req.user.id]
    );

    res.json({ replies: result.rows });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

// Bookmark a message
router.post('/:messageId/bookmark', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if message exists and user has access
    const messageCheck = await query(
      `SELECT m.* FROM messages m
       JOIN channel_members cm ON m.channel_id = cm.channel_id
       WHERE m.id = $1 AND cm.user_id = $2`,
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or no access' });
    }

    const result = await query(
      `INSERT INTO bookmarks (user_id, message_id) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, message_id) DO NOTHING 
       RETURNING *`,
      [req.user.id, messageId]
    );

    res.status(201).json({
      message: 'Message bookmarked successfully',
      bookmark: result.rows[0]
    });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ error: 'Failed to bookmark message' });
  }
});

// Remove bookmark
router.delete('/:messageId/bookmark', async (req, res) => {
  try {
    const { messageId } = req.params;

    await query(
      'DELETE FROM bookmarks WHERE user_id = $1 AND message_id = $2',
      [req.user.id, messageId]
    );

    res.json({ message: 'Bookmark removed successfully' });
  } catch (error) {
    console.error('Remove bookmark error:', error);
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

// Get bookmarked messages
router.get('/bookmarks/all', async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, 
              u.username, u.display_name, u.avatar_url,
              c.name as channel_name,
              w.name as workspace_name,
              b.created_at as bookmarked_at
       FROM bookmarks b
       JOIN messages m ON b.message_id = m.id
       JOIN users u ON m.user_id = u.id
       JOIN channels c ON m.channel_id = c.id
       JOIN workspaces w ON c.workspace_id = w.id
       WHERE b.user_id = $1 AND m.is_deleted = false
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );

    res.json({ bookmarks: result.rows });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ error: 'Failed to get bookmarks' });
  }
});

module.exports = router;
