const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../db/connection');
const { authenticateWorkspaceMember, authenticateChannelMember } = require('../middleware/auth');

const router = express.Router();

// Get all channels in a workspace
router.get('/workspace/:workspaceId', authenticateWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const result = await query(
      `SELECT c.*, 
              COUNT(DISTINCT cm.user_id) as member_count,
              COUNT(DISTINCT m.id) as message_count,
              MAX(m.created_at) as last_message_at,
              EXISTS(SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2) as is_member
       FROM channels c
       LEFT JOIN channel_members cm ON c.id = cm.channel_id
       LEFT JOIN messages m ON c.id = m.channel_id AND m.is_deleted = false
       WHERE c.workspace_id = $1 AND (c.is_private = false OR EXISTS(
         SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2
       ))
       GROUP BY c.id
       ORDER BY c.name`,
      [workspaceId, req.user.id]
    );

    res.json({ channels: result.rows });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

// Create a new channel
router.post('/', [
  body('workspace_id').isInt(),
  body('name').isLength({ min: 1, max: 100 }).matches(/^[a-z0-9-_]+$/),
  body('description').optional().isLength({ max: 500 }),
  body('is_private').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { workspace_id, name, description, is_private = false } = req.body;

    // Check workspace membership
    const memberCheck = await query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const result = await transaction(async (client) => {
      // Create channel
      const channelResult = await client.query(
        `INSERT INTO channels (workspace_id, name, description, is_private, created_by) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [workspace_id, name, description, is_private, req.user.id]
      );

      const channel = channelResult.rows[0];

      // Add creator as member
      await client.query(
        `INSERT INTO channel_members (channel_id, user_id) 
         VALUES ($1, $2)`,
        [channel.id, req.user.id]
      );

      return channel;
    });

    res.status(201).json({
      message: 'Channel created successfully',
      channel: result
    });
  } catch (error) {
    console.error('Create channel error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Channel name already exists in this workspace' });
    }
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Get channel details
router.get('/:channelId', authenticateChannelMember, async (req, res) => {
  try {
    const { channelId } = req.params;

    const result = await query(
      `SELECT c.*, 
              COUNT(DISTINCT cm.user_id) as member_count,
              COUNT(DISTINCT m.id) as message_count,
              u.display_name as creator_name
       FROM channels c
       LEFT JOIN channel_members cm ON c.id = cm.channel_id
       LEFT JOIN messages m ON c.id = m.channel_id AND m.is_deleted = false
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1
       GROUP BY c.id, u.display_name`,
      [channelId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ channel: result.rows[0] });
  } catch (error) {
    console.error('Get channel error:', error);
    res.status(500).json({ error: 'Failed to get channel' });
  }
});

// Update channel
router.put('/:channelId', authenticateChannelMember, [
  body('name').optional().isLength({ min: 1, max: 100 }).matches(/^[a-z0-9-_]+$/),
  body('description').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { channelId } = req.params;

    // Check if user created the channel or is workspace admin
    const channelResult = await query(
      `SELECT c.*, wm.role 
       FROM channels c
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id AND wm.user_id = $2
       WHERE c.id = $1`,
      [channelId, req.user.id]
    );

    const channel = channelResult.rows[0];
    if (channel.created_by !== req.user.id && channel.role !== 'admin' && channel.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized to update this channel' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['name', 'description'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(req.body[field]);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(channelId);

    const result = await query(
      `UPDATE channels SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    res.json({
      message: 'Channel updated successfully',
      channel: result.rows[0]
    });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Delete channel
router.delete('/:channelId', authenticateChannelMember, async (req, res) => {
  try {
    const { channelId } = req.params;

    // Check if user is workspace admin or channel creator
    const channelResult = await query(
      `SELECT c.*, wm.role 
       FROM channels c
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id AND wm.user_id = $2
       WHERE c.id = $1`,
      [channelId, req.user.id]
    );

    const channel = channelResult.rows[0];
    if (channel.created_by !== req.user.id && channel.role !== 'admin' && channel.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized to delete this channel' });
    }

    // Don't allow deleting general channel
    if (channel.name === 'general') {
      return res.status(400).json({ error: 'Cannot delete general channel' });
    }

    await query('DELETE FROM channels WHERE id = $1', [channelId]);

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// Get channel members
router.get('/:channelId/members', authenticateChannelMember, async (req, res) => {
  try {
    const { channelId } = req.params;

    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, 
              u.status_text, u.status_emoji, u.is_online, u.last_seen,
              cm.joined_at, cm.notification_preference
       FROM channel_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.channel_id = $1
       ORDER BY u.display_name`,
      [channelId]
    );

    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get channel members error:', error);
    res.status(500).json({ error: 'Failed to get channel members' });
  }
});

// Join channel
router.post('/:channelId/join', async (req, res) => {
  try {
    const { channelId } = req.params;

    // Check if channel exists and is not private
    const channelResult = await query(
      'SELECT * FROM channels WHERE id = $1',
      [channelId]
    );

    if (channelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    if (channel.is_private) {
      return res.status(403).json({ error: 'Cannot join private channel without invitation' });
    }

    // Check workspace membership
    const memberCheck = await query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [channel.workspace_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Must be a workspace member to join channels' });
    }

    // Add to channel
    const result = await query(
      `INSERT INTO channel_members (channel_id, user_id) 
       VALUES ($1, $2) 
       ON CONFLICT (channel_id, user_id) DO NOTHING 
       RETURNING *`,
      [channelId, req.user.id]
    );

    res.json({
      message: 'Joined channel successfully',
      membership: result.rows[0]
    });
  } catch (error) {
    console.error('Join channel error:', error);
    res.status(500).json({ error: 'Failed to join channel' });
  }
});

// Leave channel
router.post('/:channelId/leave', authenticateChannelMember, async (req, res) => {
  try {
    const { channelId } = req.params;

    // Check if it's general channel
    const channelResult = await query('SELECT name FROM channels WHERE id = $1', [channelId]);
    if (channelResult.rows[0].name === 'general') {
      return res.status(400).json({ error: 'Cannot leave general channel' });
    }

    await query(
      'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, req.user.id]
    );

    res.json({ message: 'Left channel successfully' });
  } catch (error) {
    console.error('Leave channel error:', error);
    res.status(500).json({ error: 'Failed to leave channel' });
  }
});

// Add members to channel (for private channels)
router.post('/:channelId/members', authenticateChannelMember, [
  body('user_ids').isArray().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { channelId } = req.params;
    const { user_ids } = req.body;

    // Check if channel is private and user has permission
    const channelResult = await query(
      `SELECT c.*, wm.role 
       FROM channels c
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id AND wm.user_id = $2
       WHERE c.id = $1`,
      [channelId, req.user.id]
    );

    const channel = channelResult.rows[0];

    if (!channel.is_private) {
      return res.status(400).json({ error: 'Users can join public channels themselves' });
    }

    if (channel.created_by !== req.user.id && channel.role !== 'admin' && channel.role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized to add members to this channel' });
    }

    // Add members
    const addedMembers = [];
    for (const userId of user_ids) {
      try {
        const result = await query(
          `INSERT INTO channel_members (channel_id, user_id) 
           VALUES ($1, $2) 
           ON CONFLICT (channel_id, user_id) DO NOTHING 
           RETURNING user_id`,
          [channelId, userId]
        );
        if (result.rows.length > 0) {
          addedMembers.push(userId);
        }
      } catch (error) {
        console.error(`Failed to add user ${userId}:`, error);
      }
    }

    res.json({
      message: 'Members added successfully',
      added_members: addedMembers
    });
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({ error: 'Failed to add members' });
  }
});

// Update notification preference
router.patch('/:channelId/notifications', authenticateChannelMember, [
  body('preference').isIn(['all', 'mentions', 'nothing'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { channelId } = req.params;
    const { preference } = req.body;

    const result = await query(
      `UPDATE channel_members 
       SET notification_preference = $1 
       WHERE channel_id = $2 AND user_id = $3 
       RETURNING *`,
      [preference, channelId, req.user.id]
    );

    res.json({
      message: 'Notification preference updated',
      preference: result.rows[0]
    });
  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({ error: 'Failed to update notification preference' });
  }
});

module.exports = router;
