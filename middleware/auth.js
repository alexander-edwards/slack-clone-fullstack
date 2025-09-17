const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      // Get fresh user data from database
      const result = await query(
        'SELECT id, email, username, display_name, is_admin FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      req.user = result.rows[0];
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const authenticateWorkspaceMember = async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    const result = await query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    req.workspaceMember = result.rows[0];
    next();
  } catch (error) {
    console.error('Workspace auth error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

const authenticateChannelMember = async (req, res, next) => {
  try {
    const channelId = req.params.channelId || req.body.channelId || req.query.channelId;
    
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID required' });
    }

    // Check if channel is private
    const channelResult = await query(
      'SELECT c.*, cm.user_id FROM channels c LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $2 WHERE c.id = $1',
      [channelId, req.user.id]
    );

    if (channelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    // If channel is private, check membership
    if (channel.is_private && !channel.user_id) {
      return res.status(403).json({ error: 'Not a member of this private channel' });
    }

    req.channel = channel;
    next();
  } catch (error) {
    console.error('Channel auth error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );

  return { accessToken, refreshToken };
};

module.exports = {
  authenticateToken,
  authenticateWorkspaceMember,
  authenticateChannelMember,
  generateTokens
};
