const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');

const router = express.Router();

// Search users
router.get('/search', async (req, res) => {
  try {
    const { q, workspace_id, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    let queryStr = `
      SELECT DISTINCT u.id, u.username, u.display_name, u.avatar_url, 
             u.is_online, u.status_text, u.status_emoji
      FROM users u
    `;

    const params = [`%${q}%`, `%${q}%`];
    let paramCount = 3;

    if (workspace_id) {
      queryStr += `
        JOIN workspace_members wm ON u.id = wm.user_id
        WHERE wm.workspace_id = $${paramCount}
        AND (u.username ILIKE $1 OR u.display_name ILIKE $2)
      `;
      params.push(workspace_id);
      paramCount++;
    } else {
      queryStr += `
        WHERE u.username ILIKE $1 OR u.display_name ILIKE $2
      `;
    }

    queryStr += `
      ORDER BY u.display_name
      LIMIT $${paramCount}
    `;
    params.push(parseInt(limit));

    const result = await query(queryStr, params);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT id, username, display_name, avatar_url, 
              status_text, status_emoji, is_online, last_seen,
              created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get shared workspaces
    const workspacesResult = await query(
      `SELECT w.id, w.name, w.logo_url
       FROM workspaces w
       JOIN workspace_members wm1 ON w.id = wm1.workspace_id
       JOIN workspace_members wm2 ON w.id = wm2.workspace_id
       WHERE wm1.user_id = $1 AND wm2.user_id = $2`,
      [req.user.id, userId]
    );

    res.json({
      user: result.rows[0],
      shared_workspaces: workspacesResult.rows
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update user status
router.put('/status', [
  body('status_text').optional().isLength({ max: 255 }),
  body('status_emoji').optional().isLength({ max: 50 }),
  body('clear_after').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status_text, status_emoji, clear_after } = req.body;

    const result = await query(
      `UPDATE users 
       SET status_text = $1, status_emoji = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, status_text, status_emoji`,
      [status_text || null, status_emoji || null, req.user.id]
    );

    // TODO: Implement clear_after with a scheduled job

    res.json({
      message: 'Status updated successfully',
      status: result.rows[0]
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Update user presence
router.put('/presence', [
  body('workspace_id').isInt(),
  body('status').isIn(['active', 'away', 'dnd', 'offline'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { workspace_id, status } = req.body;

    // Update or insert presence
    const result = await query(
      `INSERT INTO user_presence (user_id, workspace_id, status, last_active)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, workspace_id)
       DO UPDATE SET status = $3, last_active = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, workspace_id, status]
    );

    // Update online status in users table
    if (status === 'active') {
      await query(
        'UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [req.user.id]
      );
    } else if (status === 'offline') {
      await query(
        'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [req.user.id]
      );
    }

    res.json({
      message: 'Presence updated successfully',
      presence: result.rows[0]
    });
  } catch (error) {
    console.error('Update presence error:', error);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// Get user's mentions
router.get('/mentions/all', async (req, res) => {
  try {
    const { workspace_id, limit = 20, unread_only = false } = req.query;

    let queryStr = `
      SELECT m.id, m.content, m.created_at,
             c.id as channel_id, c.name as channel_name,
             w.id as workspace_id, w.name as workspace_name,
             u.id as sender_id, u.username, u.display_name, u.avatar_url
      FROM mentions mn
      JOIN messages m ON mn.message_id = m.id
      JOIN channels c ON m.channel_id = c.id
      JOIN workspaces w ON c.workspace_id = w.id
      JOIN users u ON m.user_id = u.id
      WHERE mn.mentioned_user_id = $1 AND m.is_deleted = false
    `;

    const params = [req.user.id];
    let paramCount = 2;

    if (workspace_id) {
      queryStr += ` AND w.id = $${paramCount}`;
      params.push(workspace_id);
      paramCount++;
    }

    if (unread_only === 'true') {
      queryStr += ` AND m.created_at > COALESCE(
        (SELECT last_read_at FROM channel_members WHERE channel_id = c.id AND user_id = $1),
        '1970-01-01'
      )`;
    }

    queryStr += `
      ORDER BY m.created_at DESC
      LIMIT $${paramCount}
    `;
    params.push(parseInt(limit));

    const result = await query(queryStr, params);

    res.json({ mentions: result.rows });
  } catch (error) {
    console.error('Get mentions error:', error);
    res.status(500).json({ error: 'Failed to get mentions' });
  }
});

// Get user's activity
router.get('/:userId/activity', async (req, res) => {
  try {
    const { userId } = req.params;
    const { workspace_id, limit = 20 } = req.query;

    // Check if users share a workspace
    const sharedCheck = await query(
      `SELECT COUNT(*) as count
       FROM workspace_members wm1
       JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
       WHERE wm1.user_id = $1 AND wm2.user_id = $2`,
      [req.user.id, userId]
    );

    if (parseInt(sharedCheck.rows[0].count) === 0) {
      return res.status(403).json({ error: 'No shared workspaces with this user' });
    }

    let queryStr = `
      WITH recent_messages AS (
        SELECT 
          m.id,
          m.content,
          m.created_at,
          c.id as channel_id,
          c.name as channel_name,
          w.id as workspace_id,
          w.name as workspace_name,
          'message' as activity_type
        FROM messages m
        JOIN channels c ON m.channel_id = c.id
        JOIN workspaces w ON c.workspace_id = w.id
        JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $1
        WHERE m.user_id = $2 AND m.is_deleted = false
    `;

    const params = [req.user.id, userId];
    let paramCount = 3;

    if (workspace_id) {
      queryStr += ` AND w.id = $${paramCount}`;
      params.push(workspace_id);
      paramCount++;
    }

    queryStr += `
        ORDER BY m.created_at DESC
        LIMIT $${paramCount}
      )
      SELECT * FROM recent_messages
      ORDER BY created_at DESC
    `;
    params.push(parseInt(limit));

    const result = await query(queryStr, params);

    res.json({ activity: result.rows });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Failed to get user activity' });
  }
});

// Get workspace-specific user list
router.get('/workspace/:workspaceId/all', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Check if requester is a member
    const memberCheck = await query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              u.status_text, u.status_emoji, u.is_online, u.last_seen,
              wm.role, wm.joined_at,
              up.status as presence_status, up.last_active
       FROM users u
       JOIN workspace_members wm ON u.id = wm.user_id
       LEFT JOIN user_presence up ON u.id = up.user_id AND up.workspace_id = $1
       WHERE wm.workspace_id = $1
       ORDER BY u.is_online DESC, u.display_name`,
      [workspaceId]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get workspace users error:', error);
    res.status(500).json({ error: 'Failed to get workspace users' });
  }
});

module.exports = router;
