require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, transaction } = require('./db/connection');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');

    // Create demo users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('demo123', salt);

    const users = [];
    const usernames = ['alice', 'bob', 'charlie', 'diana', 'eve'];
    const displayNames = ['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Eve Adams'];

    for (let i = 0; i < usernames.length; i++) {
      const result = await query(
        `INSERT INTO users (email, username, display_name, password_hash, avatar_url, is_online, status_text, status_emoji) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [
          `${usernames[i]}@example.com`,
          usernames[i],
          displayNames[i],
          passwordHash,
          `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNames[i])}&background=random`,
          i < 3, // First 3 users are online
          i === 0 ? 'Working from home' : i === 1 ? 'In a meeting' : null,
          i === 0 ? '🏠' : i === 1 ? '📅' : null
        ]
      );
      users.push({ id: result.rows[0].id, username: usernames[i], displayName: displayNames[i] });
      console.log(`✅ Created user: ${usernames[i]}`);
    }

    // Create demo workspace
    let workspace;
    const workspaceCheck = await query('SELECT * FROM workspaces WHERE slug = $1', ['demo-workspace']);
    
    if (workspaceCheck.rows.length > 0) {
      workspace = workspaceCheck.rows[0];
      console.log('✅ Using existing workspace: demo-workspace');
    } else {
      const workspaceResult = await query(
        `INSERT INTO workspaces (name, slug, description, owner_id, logo_url) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          'Demo Workspace',
          'demo-workspace',
          'A demo workspace for testing Slack clone features',
          users[0].id,
          'https://ui-avatars.com/api/?name=Demo+Workspace&background=5865F2&color=fff'
        ]
      );
      workspace = workspaceResult.rows[0];
      console.log('✅ Created workspace: Demo Workspace');

      // Add all users to workspace
      for (const user of users) {
        await query(
          `INSERT INTO workspace_members (workspace_id, user_id, role) 
           VALUES ($1, $2, $3)
           ON CONFLICT (workspace_id, user_id) DO NOTHING`,
          [workspace.id, user.id, user.id === users[0].id ? 'admin' : 'member']
        );
      }
      console.log('✅ Added users to workspace');
    }

    // Create channels
    const channelNames = ['general', 'random', 'engineering', 'design', 'marketing', 'announcements'];
    const channelDescriptions = [
      'General discussion for everyone',
      'Random conversations and fun',
      'Engineering team discussions',
      'Design team collaboration',
      'Marketing strategies and campaigns',
      'Important company announcements'
    ];

    const channels = [];
    for (let i = 0; i < channelNames.length; i++) {
      const existingChannel = await query(
        'SELECT * FROM channels WHERE workspace_id = $1 AND name = $2',
        [workspace.id, channelNames[i]]
      );

      let channel;
      if (existingChannel.rows.length > 0) {
        channel = existingChannel.rows[0];
        console.log(`✅ Using existing channel: #${channelNames[i]}`);
      } else {
        const channelResult = await query(
          `INSERT INTO channels (workspace_id, name, description, is_private, created_by) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING *`,
          [
            workspace.id,
            channelNames[i],
            channelDescriptions[i],
            channelNames[i] === 'engineering' || channelNames[i] === 'design', // Make some channels private
            users[0].id
          ]
        );
        channel = channelResult.rows[0];
        console.log(`✅ Created channel: #${channelNames[i]}`);
      }
      channels.push(channel);

      // Add users to channels
      const usersToAdd = channelNames[i] === 'engineering' ? users.slice(0, 3) : 
                        channelNames[i] === 'design' ? users.slice(2, 4) : 
                        users;

      for (const user of usersToAdd) {
        await query(
          `INSERT INTO channel_members (channel_id, user_id) 
           VALUES ($1, $2)
           ON CONFLICT (channel_id, user_id) DO NOTHING`,
          [channel.id, user.id]
        );
      }
    }

    // Create sample messages in general channel
    const generalChannel = channels.find(c => c.name === 'general');
    const sampleMessages = [
      { user: 0, content: 'Welcome to the Demo Workspace! 🎉' },
      { user: 1, content: 'Hey everyone! Excited to be here!' },
      { user: 2, content: 'Has anyone tried the new file upload feature?' },
      { user: 0, content: 'Yes! You can drag and drop files directly into the chat' },
      { user: 3, content: '@alice thanks for setting this up!' },
      { user: 0, content: 'You\'re welcome @diana! Feel free to explore all the features' },
      { user: 4, content: 'The real-time messaging is super smooth 🚀' },
      { user: 1, content: 'I love the thread feature for organizing conversations' },
    ];

    const messages = [];
    for (const msg of sampleMessages) {
      const messageResult = await query(
        `INSERT INTO messages (channel_id, user_id, content) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [generalChannel.id, users[msg.user].id, msg.content]
      );
      messages.push(messageResult.rows[0].id);
      
      // Add mentions if content contains @
      const mentions = msg.content.match(/@(\w+)/g);
      if (mentions) {
        for (const mention of mentions) {
          const username = mention.substring(1);
          const mentionedUser = users.find(u => u.username === username);
          if (mentionedUser) {
            await query(
              'INSERT INTO mentions (message_id, mentioned_user_id) VALUES ($1, $2)',
              [messageResult.rows[0].id, mentionedUser.id]
            );
          }
        }
      }
    }
    console.log('✅ Created sample messages');

    // Add some reactions
    const reactions = ['👍', '❤️', '😄', '🎉', '🚀'];
    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) 
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [messages[0], users[i].id, reactions[i]]
      );
    }
    console.log('✅ Added message reactions');

    // Create a thread
    const threadMessage = messages[2]; // "Has anyone tried the new file upload feature?"
    await query(
      `INSERT INTO threads (message_id, last_reply_at, reply_count, participant_count)
       VALUES ($1, CURRENT_TIMESTAMP, 2, 2)
       ON CONFLICT (message_id) DO UPDATE SET reply_count = 2`,
      [threadMessage]
    );

    // Add thread replies
    await query(
      `INSERT INTO messages (channel_id, user_id, content, parent_id) 
       VALUES ($1, $2, $3, $4)`,
      [generalChannel.id, users[1].id, 'Yes, it supports images, PDFs, and documents!', threadMessage]
    );
    await query(
      `INSERT INTO messages (channel_id, user_id, content, parent_id) 
       VALUES ($1, $2, $3, $4)`,
      [generalChannel.id, users[3].id, 'That\'s awesome! The preview feature is really helpful', threadMessage]
    );
    console.log('✅ Created message thread');

    // Create some direct messages
    await query(
      `INSERT INTO direct_messages (workspace_id, sender_id, receiver_id, content) 
       VALUES ($1, $2, $3, $4)`,
      [workspace.id, users[0].id, users[1].id, 'Hey Bob, welcome to the team!']
    );
    await query(
      `INSERT INTO direct_messages (workspace_id, sender_id, receiver_id, content) 
       VALUES ($1, $2, $3, $4)`,
      [workspace.id, users[1].id, users[0].id, 'Thanks Alice! Happy to be here']
    );
    await query(
      `INSERT INTO direct_messages (workspace_id, sender_id, receiver_id, content) 
       VALUES ($1, $2, $3, $4)`,
      [workspace.id, users[2].id, users[3].id, 'Diana, can you review the new designs?']
    );
    console.log('✅ Created direct messages');

    console.log(`
    ✨ Database seeded successfully!
    
    Demo Credentials:
    -----------------
    Email: alice@example.com
    Password: demo123
    
    Other users:
    - bob@example.com / demo123
    - charlie@example.com / demo123
    - diana@example.com / demo123
    - eve@example.com / demo123
    
    Workspace: demo-workspace
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedDatabase();
