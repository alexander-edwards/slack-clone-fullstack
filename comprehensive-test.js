#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
let token = '';
let userId = null;
let workspaceId = null;
let channelId = null;
let messageId = null;

const tests = {
  passed: 0,
  failed: 0,
  errors: []
};

async function test(name, fn) {
  try {
    console.log(`\nTesting: ${name}`);
    await fn();
    console.log(`✅ PASSED`);
    tests.passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    tests.failed++;
    tests.errors.push({ test: name, error: error.message });
  }
}

async function runTests() {
  console.log('=====================================');
  console.log('   COMPREHENSIVE SLACK CLONE TEST   ');
  console.log('=====================================');

  // Test Health Check
  await test('Health Check', async () => {
    const res = await axios.get(`${BASE_URL}/health`);
    if (!res.data.status === 'healthy') throw new Error('Health check failed');
  });

  // Test User Registration
  await test('User Registration', async () => {
    try {
      const res = await axios.post(`${BASE_URL}/api/auth/register`, {
        email: `test${Date.now()}@example.com`,
        username: `test${Date.now()}`,
        password: 'testpass123',
        display_name: 'Test User'
      });
      if (!res.data.accessToken) throw new Error('No token received');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('  (User already exists - acceptable)');
      } else {
        throw error;
      }
    }
  });

  // Test Login
  await test('User Login', async () => {
    const res = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'alice@example.com',
      password: 'demo123'
    });
    token = res.data.accessToken;
    userId = res.data.user.id;
    if (!token) throw new Error('Login failed - no token');
  });

  // Test Get Current User
  await test('Get Current User', async () => {
    const res = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.user) throw new Error('User data not received');
  });

  // Test Update Profile
  await test('Update Profile', async () => {
    const res = await axios.put(`${BASE_URL}/api/auth/profile`, {
      status_text: 'Testing API',
      status_emoji: '🧪'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.user) throw new Error('Profile update failed');
  });

  // Test Get Workspaces
  await test('Get Workspaces', async () => {
    const res = await axios.get(`${BASE_URL}/api/workspaces`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.workspaces || res.data.workspaces.length === 0) {
      throw new Error('No workspaces found');
    }
    workspaceId = res.data.workspaces[0].id;
  });

  // Test Get Workspace Details
  await test('Get Workspace Details', async () => {
    const res = await axios.get(`${BASE_URL}/api/workspaces/${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.workspace) throw new Error('Workspace details not found');
  });

  // Test Get Workspace Members
  await test('Get Workspace Members', async () => {
    const res = await axios.get(`${BASE_URL}/api/workspaces/${workspaceId}/members`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.members || res.data.members.length === 0) {
      throw new Error('No workspace members found');
    }
  });

  // Test Get Channels
  await test('Get Channels', async () => {
    const res = await axios.get(`${BASE_URL}/api/channels/workspace/${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.channels || res.data.channels.length === 0) {
      throw new Error('No channels found');
    }
    channelId = res.data.channels[0].id;
  });

  // Test Create Channel
  await test('Create Channel', async () => {
    const res = await axios.post(`${BASE_URL}/api/channels`, {
      workspace_id: workspaceId,
      name: `test-channel-${Date.now()}`,
      description: 'Test channel',
      is_private: false
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.channel) throw new Error('Channel creation failed');
  });

  // Test Join Channel
  await test('Join Channel', async () => {
    const res = await axios.post(`${BASE_URL}/api/channels/${channelId}/join`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Should succeed or return already member
  });

  // Test Get Channel Members
  await test('Get Channel Members', async () => {
    const res = await axios.get(`${BASE_URL}/api/channels/${channelId}/members`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.members) throw new Error('No channel members found');
  });

  // Test Send Message
  await test('Send Message', async () => {
    const res = await axios.post(`${BASE_URL}/api/messages`, {
      channel_id: channelId,
      content: `Test message ${Date.now()}`
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.data) throw new Error('Message not sent');
    messageId = res.data.data.id;
  });

  // Test Get Messages
  await test('Get Channel Messages', async () => {
    const res = await axios.get(`${BASE_URL}/api/messages/channel/${channelId}?limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.messages) throw new Error('Messages not retrieved');
  });

  // Test Edit Message
  await test('Edit Message', async () => {
    const res = await axios.put(`${BASE_URL}/api/messages/${messageId}`, {
      content: 'Edited test message'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.data) throw new Error('Message edit failed');
  });

  // Test Add Reaction
  await test('Add Reaction', async () => {
    const res = await axios.post(`${BASE_URL}/api/messages/${messageId}/reactions`, {
      emoji: '👍'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Should succeed
  });

  // Test Remove Reaction
  await test('Remove Reaction', async () => {
    const res = await axios.delete(`${BASE_URL}/api/messages/${messageId}/reactions/👍`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Should succeed
  });

  // Test Bookmark Message
  await test('Bookmark Message', async () => {
    const res = await axios.post(`${BASE_URL}/api/messages/${messageId}/bookmark`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Should succeed
  });

  // Test Get Bookmarks
  await test('Get Bookmarks', async () => {
    const res = await axios.get(`${BASE_URL}/api/messages/bookmarks/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.bookmarks) throw new Error('Bookmarks not retrieved');
  });

  // Test Send Direct Message
  await test('Send Direct Message', async () => {
    const res = await axios.post(`${BASE_URL}/api/direct-messages`, {
      workspace_id: workspaceId,
      receiver_id: 2, // Bob
      content: 'Test DM'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.data) throw new Error('DM not sent');
  });

  // Test Get DM Conversations
  await test('Get DM Conversations', async () => {
    const res = await axios.get(`${BASE_URL}/api/direct-messages/workspace/${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.conversations) throw new Error('DM conversations not retrieved');
  });

  // Test Search Users
  await test('Search Users', async () => {
    const res = await axios.get(`${BASE_URL}/api/users/search?q=bob&workspace_id=${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.users) throw new Error('User search failed');
  });

  // Test Global Search
  await test('Global Search', async () => {
    const res = await axios.get(`${BASE_URL}/api/search?q=test&workspace_id=${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.results) throw new Error('Global search failed');
  });

  // Test Update User Status
  await test('Update User Status', async () => {
    const res = await axios.put(`${BASE_URL}/api/users/status`, {
      status_text: 'Running tests',
      status_emoji: '🧪'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.status) throw new Error('Status update failed');
  });

  // Test Update Presence
  await test('Update Presence', async () => {
    const res = await axios.put(`${BASE_URL}/api/users/presence`, {
      workspace_id: workspaceId,
      status: 'active'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.presence) throw new Error('Presence update failed');
  });

  // Test Get User Mentions
  await test('Get User Mentions', async () => {
    const res = await axios.get(`${BASE_URL}/api/users/mentions/all?workspace_id=${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.mentions) throw new Error('Mentions not retrieved');
  });

  // Test Thread Reply
  await test('Send Thread Reply', async () => {
    const res = await axios.post(`${BASE_URL}/api/messages`, {
      channel_id: channelId,
      content: 'Thread reply test',
      parent_id: messageId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.data) throw new Error('Thread reply failed');
  });

  // Test Get Thread Replies
  await test('Get Thread Replies', async () => {
    const res = await axios.get(`${BASE_URL}/api/messages/${messageId}/thread`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.data.replies) throw new Error('Thread replies not retrieved');
  });

  // Test Refresh Token
  await test('Refresh Token', async () => {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'alice@example.com',
      password: 'demo123'
    });
    const refreshToken = loginRes.data.refreshToken;
    
    const res = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refreshToken: refreshToken
    });
    if (!res.data.accessToken) throw new Error('Token refresh failed');
  });

  // Test Delete Message
  await test('Delete Message', async () => {
    const res = await axios.delete(`${BASE_URL}/api/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Should succeed
  });

  // Test Logout
  await test('Logout', async () => {
    const res = await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Should succeed
  });

  // Print Summary
  console.log('\n=====================================');
  console.log('           TEST SUMMARY              ');
  console.log('=====================================');
  console.log(`✅ Passed: ${tests.passed}`);
  console.log(`❌ Failed: ${tests.failed}`);
  console.log(`Total: ${tests.passed + tests.failed}`);
  console.log(`Success Rate: ${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%`);

  if (tests.failed > 0) {
    console.log('\n❌ Failed Tests:');
    tests.errors.forEach(err => {
      console.log(`  - ${err.test}: ${err.error}`);
    });
  }

  console.log('\n=====================================');
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error.message);
});
