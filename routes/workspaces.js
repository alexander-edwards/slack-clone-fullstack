const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../db/connection');
const { authenticateWorkspaceMember } = require('../middleware/auth');

const router = express.Router();

// Get all workspaces for the current user
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT w.*, wm.role, wm.joined_at,
              COUNT(DISTINCT wm2.user_id) as member_count
       FROM workspaces w
       JOIN workspace_members wm ON w.id = wm.workspace_id
       LEFT JOIN workspace_members wm2 ON w.id = wm2.workspace_id
       WHERE wm.user_id = $1
       GROUP BY w.id, wm.role, wm.joined_at
       ORDER BY wm.joined_at DESC`,
      [req.user.id]
    );

    res.json({ workspaces: result.rows });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Failed to get workspaces' });
  }
});

// Create a new workspace
router.post('/', [
  body('name').isLength({ min: 1, max: 255 }).trim(),
  body('slug').isLength({ min: 3, max: 100 }).matches(/^[a-z0-9-]+$/),
  body('description').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, slug, description } = req.body;

    const result = await transaction(async (client) => {
      // Create workspace
      const workspaceResult = await client.query(
        `INSERT INTO workspaces (name, slug, description, owner_id, logo_url) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [name, slug, description, req.user.id, `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`]
      );

      const workspace = workspaceResult.rows[0];

      // Add creator as admin member
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) 
         VALUES ($1, $2, 'admin')`,
        [workspace.id, req.user.id]
      );

      // Create default channels
      const defaultChannels = ['general', 'random'];
      for (const channelName of defaultChannels) {
        await client.query(
          `INSERT INTO channels (workspace_id, name, description, created_by) 
           VALUES ($1, $2, $3, $4)`,
          [workspace.id, channelName, `Default ${channelName} channel`, req.user.id]
        );
      }

      return workspace;
    });

    res.status(201).json({
      message: 'Workspace created successfully',
      workspace: result
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Workspace slug already exists' });
    }
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// Get workspace details
router.get('/:workspaceId', authenticateWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const result = await query(
      `SELECT w.*, 
              COUNT(DISTINCT wm.user_id) as member_count,
              COUNT(DISTINCT c.id) as channel_count
       FROM workspaces w
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
       LEFT JOIN channels c ON w.id = c.workspace_id
       WHERE w.id = $1
       GROUP BY w.id`,
      [workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ workspace: result.rows[0] });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Failed to get workspace' });
  }
});

// Update workspace
router.put('/:workspaceId', authenticateWorkspaceMember, [
  body('name').optional().isLength({ min: 1, max: 255 }),
  body('description').optional().isLength({ max: 500 }),
  body('logo_url').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { workspaceId } = req.params;

    // Check if user is admin
    if (req.workspaceMember.role !== 'admin' && req.workspaceMember.role !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['name', 'description', 'logo_url'];
    
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

    values.push(workspaceId);

    const result = await query(
      `UPDATE workspaces SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    res.json({
      message: 'Workspace updated successfully',
      workspace: result.rows[0]
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// Get workspace members
router.get('/:workspaceId/members', authenticateWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, 
              u.status_text, u.status_emoji, u.is_online, u.last_seen,
              wm.role, wm.joined_at
       FROM workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = $1
       ORDER BY wm.joined_at DESC`,
      [workspaceId]
    );

    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// Add member to workspace
router.post('/:workspaceId/members', authenticateWorkspaceMember, [
  body('user_id').isInt(),
  body('role').optional().isIn(['member', 'moderator', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { workspaceId } = req.params;
    const { user_id, role = 'member' } = req.body;

    // Check if requester is admin
    if (req.workspaceMember.role !== 'admin' && req.workspaceMember.role !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check if user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add member
    const result = await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [workspaceId, user_id, role]
    );

    res.status(201).json({
      message: 'Member added successfully',
      member: result.rows[0]
    });
  } catch (error) {
    console.error('Add member error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'User is already a member' });
    }
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member from workspace
router.delete('/:workspaceId/members/:userId', authenticateWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;

    // Check if requester is admin or removing themselves
    if (req.workspaceMember.role !== 'admin' && 
        req.workspaceMember.role !== 'owner' && 
        parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Don't allow owner to be removed
    const workspace = await query('SELECT owner_id FROM workspaces WHERE id = $1', [workspaceId]);
    if (workspace.rows[0].owner_id === parseInt(userId)) {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    await query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update member role
router.patch('/:workspaceId/members/:userId', authenticateWorkspaceMember, [
  body('role').isIn(['member', 'moderator', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { workspaceId, userId } = req.params;
    const { role } = req.body;

    // Check if requester is admin
    if (req.workspaceMember.role !== 'admin' && req.workspaceMember.role !== 'owner') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Don't allow changing owner's role
    const workspace = await query('SELECT owner_id FROM workspaces WHERE id = $1', [workspaceId]);
    if (workspace.rows[0].owner_id === parseInt(userId)) {
      return res.status(400).json({ error: 'Cannot change workspace owner role' });
    }

    const result = await query(
      `UPDATE workspace_members SET role = $1 
       WHERE workspace_id = $2 AND user_id = $3 
       RETURNING *`,
      [role, workspaceId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({
      message: 'Member role updated successfully',
      member: result.rows[0]
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Leave workspace
router.post('/:workspaceId/leave', authenticateWorkspaceMember, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Don't allow owner to leave
    const workspace = await query('SELECT owner_id FROM workspaces WHERE id = $1', [workspaceId]);
    if (workspace.rows[0].owner_id === req.user.id) {
      return res.status(400).json({ error: 'Owner cannot leave workspace. Transfer ownership first.' });
    }

    await query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user.id]
    );

    res.json({ message: 'Left workspace successfully' });
  } catch (error) {
    console.error('Leave workspace error:', error);
    res.status(500).json({ error: 'Failed to leave workspace' });
  }
});

module.exports = router;
