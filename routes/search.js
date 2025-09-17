const express = require('express');
const { query } = require('../db/connection');

const router = express.Router();

// Global search
router.get('/', async (req, res) => {
  try {
    const { q, workspace_id, type, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const results = {
      messages: [],
      channels: [],
      users: [],
      files: []
    };

    const searchPattern = `%${q}%`;

    // Search messages if type is not specified or is 'messages'
    if (!type || type === 'messages') {
      let messageQuery = `
        SELECT m.id, m.content, m.created_at,
               c.id as channel_id, c.name as channel_name,
               w.id as workspace_id, w.name as workspace_name,
               u.username, u.display_name, u.avatar_url
        FROM messages m
        JOIN channels c ON m.channel_id = c.id
        JOIN workspaces w ON c.workspace_id = w.id
        JOIN users u ON m.user_id = u.id
        JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $1
        WHERE m.content ILIKE $2 AND m.is_deleted = false
      `;

      const messageParams = [req.user.id, searchPattern];
      let paramCount = 3;

      if (workspace_id) {
        messageQuery += ` AND w.id = $${paramCount}`;
        messageParams.push(workspace_id);
        paramCount++;
      }

      messageQuery += ` ORDER BY m.created_at DESC LIMIT $${paramCount}`;
      messageParams.push(parseInt(limit));

      const messageResult = await query(messageQuery, messageParams);
      results.messages = messageResult.rows;
    }

    // Search channels if type is not specified or is 'channels'
    if (!type || type === 'channels') {
      let channelQuery = `
        SELECT c.id, c.name, c.description, c.is_private,
               w.id as workspace_id, w.name as workspace_name,
               COUNT(DISTINCT cm.user_id) as member_count
        FROM channels c
        JOIN workspaces w ON c.workspace_id = w.id
        LEFT JOIN channel_members cm ON c.id = cm.channel_id
        WHERE (c.name ILIKE $1 OR c.description ILIKE $1)
          AND (c.is_private = false OR EXISTS(
            SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2
          ))
      `;

      const channelParams = [searchPattern, req.user.id];
      let paramCount = 3;

      if (workspace_id) {
        channelQuery += ` AND w.id = $${paramCount}`;
        channelParams.push(workspace_id);
        paramCount++;
      }

      channelQuery += `
        GROUP BY c.id, w.id, w.name
        ORDER BY c.name
        LIMIT $${paramCount}
      `;
      channelParams.push(parseInt(limit));

      const channelResult = await query(channelQuery, channelParams);
      results.channels = channelResult.rows;
    }

    // Search users if type is not specified or is 'users'
    if (!type || type === 'users') {
      let userQuery = `
        SELECT DISTINCT u.id, u.username, u.display_name, u.avatar_url,
               u.is_online, u.status_text, u.status_emoji
        FROM users u
      `;

      const userParams = [searchPattern, searchPattern];
      let paramCount = 3;

      if (workspace_id) {
        userQuery += `
          JOIN workspace_members wm ON u.id = wm.user_id
          WHERE wm.workspace_id = $${paramCount}
          AND (u.username ILIKE $1 OR u.display_name ILIKE $2)
        `;
        userParams.push(workspace_id);
        paramCount++;
      } else {
        userQuery += `
          WHERE u.username ILIKE $1 OR u.display_name ILIKE $2
        `;
      }

      userQuery += ` ORDER BY u.display_name LIMIT $${paramCount}`;
      userParams.push(parseInt(limit));

      const userResult = await query(userQuery, userParams);
      results.users = userResult.rows;
    }

    // Search files if type is not specified or is 'files'
    if (!type || type === 'files') {
      let fileQuery = `
        SELECT DISTINCT a.id, a.filename, a.file_url, a.file_type, a.file_size,
               a.created_at, m.id as message_id,
               c.id as channel_id, c.name as channel_name,
               w.id as workspace_id, w.name as workspace_name,
               u.username, u.display_name
        FROM message_attachments a
        JOIN messages m ON a.message_id = m.id
        JOIN channels c ON m.channel_id = c.id
        JOIN workspaces w ON c.workspace_id = w.id
        JOIN users u ON m.user_id = u.id
        JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $1
        WHERE a.filename ILIKE $2 AND m.is_deleted = false
      `;

      const fileParams = [req.user.id, searchPattern];
      let paramCount = 3;

      if (workspace_id) {
        fileQuery += ` AND w.id = $${paramCount}`;
        fileParams.push(workspace_id);
        paramCount++;
      }

      fileQuery += ` ORDER BY a.created_at DESC LIMIT $${paramCount}`;
      fileParams.push(parseInt(limit));

      const fileResult = await query(fileQuery, fileParams);
      results.files = fileResult.rows;
    }

    // Count total results
    const totalResults = 
      results.messages.length + 
      results.channels.length + 
      results.users.length + 
      results.files.length;

    res.json({
      query: q,
      total_results: totalResults,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

// Search messages in a specific channel
router.get('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { q, from_user, has_file, before, after, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // Check channel access
    const accessCheck = await query(
      `SELECT c.* FROM channels c
       LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $2
       WHERE c.id = $1 AND (c.is_private = false OR cm.user_id IS NOT NULL)`,
      [channelId, req.user.id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No access to this channel' });
    }

    let searchQuery = `
      SELECT m.id, m.content, m.created_at, m.edited_at,
             u.id as user_id, u.username, u.display_name, u.avatar_url,
             COUNT(DISTINCT a.id) as attachment_count,
             COUNT(DISTINCT r.id) as reaction_count
      FROM messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN message_attachments a ON m.id = a.message_id
      LEFT JOIN message_reactions r ON m.id = r.message_id
      WHERE m.channel_id = $1 AND m.content ILIKE $2 AND m.is_deleted = false
    `;

    const params = [channelId, `%${q}%`];
    let paramCount = 3;

    if (from_user) {
      searchQuery += ` AND u.username = $${paramCount}`;
      params.push(from_user);
      paramCount++;
    }

    if (has_file === 'true') {
      searchQuery += ` AND EXISTS(SELECT 1 FROM message_attachments WHERE message_id = m.id)`;
    }

    if (before) {
      searchQuery += ` AND m.created_at < $${paramCount}`;
      params.push(before);
      paramCount++;
    }

    if (after) {
      searchQuery += ` AND m.created_at > $${paramCount}`;
      params.push(after);
      paramCount++;
    }

    searchQuery += `
      GROUP BY m.id, u.id
      ORDER BY m.created_at DESC
      LIMIT $${paramCount}
    `;
    params.push(parseInt(limit));

    const result = await query(searchQuery, params);

    res.json({
      query: q,
      channel_id: channelId,
      messages: result.rows
    });
  } catch (error) {
    console.error('Channel search error:', error);
    res.status(500).json({ error: 'Failed to search channel' });
  }
});

// Search direct messages
router.get('/direct-messages', async (req, res) => {
  try {
    const { q, workspace_id, other_user_id, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    let searchQuery = `
      SELECT dm.id, dm.content, dm.created_at, dm.edited_at,
             dm.sender_id, dm.receiver_id,
             s.username as sender_username, s.display_name as sender_name, s.avatar_url as sender_avatar,
             r.username as receiver_username, r.display_name as receiver_name, r.avatar_url as receiver_avatar,
             w.id as workspace_id, w.name as workspace_name
      FROM direct_messages dm
      JOIN users s ON dm.sender_id = s.id
      JOIN users r ON dm.receiver_id = r.id
      JOIN workspaces w ON dm.workspace_id = w.id
      WHERE dm.content ILIKE $1 
        AND (dm.sender_id = $2 OR dm.receiver_id = $2)
        AND dm.is_deleted = false
    `;

    const params = [`%${q}%`, req.user.id];
    let paramCount = 3;

    if (workspace_id) {
      searchQuery += ` AND dm.workspace_id = $${paramCount}`;
      params.push(workspace_id);
      paramCount++;
    }

    if (other_user_id) {
      searchQuery += ` AND (
        (dm.sender_id = $2 AND dm.receiver_id = $${paramCount}) OR
        (dm.sender_id = $${paramCount} AND dm.receiver_id = $2)
      )`;
      params.push(other_user_id);
      paramCount++;
    }

    searchQuery += ` ORDER BY dm.created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await query(searchQuery, params);

    res.json({
      query: q,
      direct_messages: result.rows
    });
  } catch (error) {
    console.error('DM search error:', error);
    res.status(500).json({ error: 'Failed to search direct messages' });
  }
});

module.exports = router;
