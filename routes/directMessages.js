const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');
const { authenticateWorkspaceMember } = require('../middleware/auth');

const router = express.Router();

// Get DM conversations for a user in a workspace
router.get('/workspace/:workspaceId', authenticateWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const result = await query(
      `WITH dm_users AS (
        SELECT DISTINCT
          CASE 
            WHEN sender_id = $1 THEN receiver_id
            ELSE sender_id
          END as other_user_id,
          MAX(created_at) as last_message_at
        FROM direct_messages
        WHERE workspace_id = $2 
          AND (sender_id = $1 OR receiver_id = $1)
          AND is_deleted = false
        GROUP BY other_user_id
      )
      SELECT 
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.is_online,
        u.status_text,
        u.status_emoji,
        du.last_message_at,
        (
          SELECT content FROM direct_messages 
          WHERE workspace_id = $2 
            AND ((sender_id = $1 AND receiver_id = u.id) 
              OR (sender_id = u.id AND receiver_id = $1))
            AND is_deleted = false
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message
      FROM dm_users du
      JOIN users u ON du.other_user_id = u.id
      ORDER BY du.last_message_at DESC`,
      [req.user.id, workspaceId]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Get DM conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Get DM messages between two users
router.get('/conversation', [
  body('workspace_id').isInt(),
  body('other_user_id').isInt()
], async (req, res) => {
  try {
    const { workspace_id, other_user_id } = req.query;

    // Check workspace membership
    const memberCheck = await query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const { limit = 50, before, after } = req.query;

    let queryStr = `
      SELECT dm.*, 
             u.username, u.display_name, u.avatar_url,
             array_agg(DISTINCT jsonb_build_object(
               'id', r.id,
               'emoji', r.emoji,
               'user_id', r.user_id
             )) FILTER (WHERE r.id IS NOT NULL) as reactions
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      LEFT JOIN dm_reactions r ON dm.id = r.dm_id
      WHERE dm.workspace_id = $1 
        AND ((dm.sender_id = $2 AND dm.receiver_id = $3) 
          OR (dm.sender_id = $3 AND dm.receiver_id = $2))
        AND dm.is_deleted = false
    `;

    const params = [workspace_id, req.user.id, other_user_id];
    let paramCount = 4;

    if (before) {
      queryStr += ` AND dm.created_at < $${paramCount}`;
      params.push(before);
      paramCount++;
    }

    if (after) {
      queryStr += ` AND dm.created_at > $${paramCount}`;
      params.push(after);
      paramCount++;
    }

    queryStr += `
      GROUP BY dm.id, u.username, u.display_name, u.avatar_url
      ORDER BY dm.created_at DESC
      LIMIT $${paramCount}
    `;
    params.push(parseInt(limit));

    const result = await query(queryStr, params);

    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    console.error('Get DM messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send a direct message
router.post('/', [
  body('workspace_id').isInt(),
  body('receiver_id').isInt(),
  body('content').isLength({ min: 1, max: 4000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { workspace_id, receiver_id, content } = req.body;

    // Check workspace membership for both users
    const memberCheck = await query(
      `SELECT COUNT(*) as count 
       FROM workspace_members 
       WHERE workspace_id = $1 AND user_id IN ($2, $3)`,
      [workspace_id, req.user.id, receiver_id]
    );

    if (parseInt(memberCheck.rows[0].count) !== 2) {
      return res.status(403).json({ error: 'Both users must be workspace members' });
    }

    const result = await query(
      `INSERT INTO direct_messages (workspace_id, sender_id, receiver_id, content) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [workspace_id, req.user.id, receiver_id, content]
    );

    // Get complete message with sender info
    const completeMessage = await query(
      `SELECT dm.*, u.username, u.display_name, u.avatar_url
       FROM direct_messages dm
       JOIN users u ON dm.sender_id = u.id
       WHERE dm.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      message: 'Direct message sent successfully',
      data: completeMessage.rows[0]
    });
  } catch (error) {
    console.error('Send DM error:', error);
    res.status(500).json({ error: 'Failed to send direct message' });
  }
});

// Edit a direct message
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
      'SELECT * FROM direct_messages WHERE id = $1 AND sender_id = $2',
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Cannot edit this message' });
    }

    const result = await query(
      `UPDATE direct_messages 
       SET content = $1, edited_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [content, messageId]
    );

    res.json({
      message: 'Direct message updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Edit DM error:', error);
    res.status(500).json({ error: 'Failed to edit direct message' });
  }
});

// Delete a direct message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if user owns the message
    const messageCheck = await query(
      'SELECT * FROM direct_messages WHERE id = $1 AND sender_id = $2',
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Cannot delete this message' });
    }

    // Soft delete
    await query(
      'UPDATE direct_messages SET is_deleted = true WHERE id = $1',
      [messageId]
    );

    res.json({ message: 'Direct message deleted successfully' });
  } catch (error) {
    console.error('Delete DM error:', error);
    res.status(500).json({ error: 'Failed to delete direct message' });
  }
});

// Add reaction to direct message
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

    // Check if user has access to the message
    const messageCheck = await query(
      `SELECT * FROM direct_messages 
       WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)`,
      [messageId, req.user.id]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or no access' });
    }

    const result = await query(
      `INSERT INTO dm_reactions (dm_id, user_id, emoji) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (dm_id, user_id, emoji) DO NOTHING 
       RETURNING *`,
      [messageId, req.user.id, emoji]
    );

    res.status(201).json({
      message: 'Reaction added successfully',
      reaction: result.rows[0]
    });
  } catch (error) {
    console.error('Add DM reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from direct message
router.delete('/:messageId/reactions/:emoji', async (req, res) => {
  try {
    const { messageId, emoji } = req.params;

    await query(
      'DELETE FROM dm_reactions WHERE dm_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, req.user.id, decodeURIComponent(emoji)]
    );

    res.json({ message: 'Reaction removed successfully' });
  } catch (error) {
    console.error('Remove DM reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Get unread DM count
router.get('/unread/:workspaceId', authenticateWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const result = await query(
      `SELECT COUNT(*) as unread_count
       FROM direct_messages dm
       WHERE dm.workspace_id = $1 
         AND dm.receiver_id = $2 
         AND dm.is_deleted = false
         AND dm.created_at > COALESCE(
           (SELECT MAX(last_seen) FROM users WHERE id = $2),
           '1970-01-01'
         )`,
      [workspaceId, req.user.id]
    );

    res.json({ unread_count: parseInt(result.rows[0].unread_count) });
  } catch (error) {
    console.error('Get unread DMs error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

module.exports = router;
