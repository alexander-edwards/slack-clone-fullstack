#!/usr/bin/env node

const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
let socket;
let token = '';

async function getToken() {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: 'alice@example.com',
    password: 'demo123'
  });
  return res.data.accessToken;
}

async function testWebSocket() {
  console.log('=====================================');
  console.log('     WEBSOCKET FUNCTIONALITY TEST    ');
  console.log('=====================================');

  try {
    // Get auth token
    token = await getToken();
    console.log('\n✅ Authentication successful');

    // Connect to WebSocket
    socket = io(BASE_URL, {
      auth: { token }
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        resolve();
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection failed:', error.message);
        reject(error);
      });

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Test joining workspace
    await testEvent('Join Workspace', () => {
      return new Promise((resolve, reject) => {
        socket.emit('join:workspace', 1);
        
        socket.once('joined:workspace', (data) => {
          console.log('  ✅ Joined workspace:', data.workspaceId);
          resolve();
        });

        socket.once('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
    });

    // Test joining channel
    await testEvent('Join Channel', () => {
      return new Promise((resolve, reject) => {
        socket.emit('join:channel', 1);
        
        socket.once('joined:channel', (data) => {
          console.log('  ✅ Joined channel:', data.channelId);
          resolve();
        });

        socket.once('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
    });

    // Test sending message
    await testEvent('Send Message via WebSocket', () => {
      return new Promise((resolve, reject) => {
        socket.once('message:new', (message) => {
          console.log('  ✅ Message received:', message.content.substring(0, 30) + '...');
          resolve();
        });

        socket.emit('message:send', {
          channelId: 1,
          content: `WebSocket test message ${Date.now()}`
        });

        socket.once('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
    });

    // Test typing indicator
    await testEvent('Typing Indicator', () => {
      return new Promise((resolve, reject) => {
        // Start typing
        socket.emit('typing:start', 1);
        console.log('  ✅ Typing indicator started');
        
        setTimeout(() => {
          socket.emit('typing:stop', 1);
          console.log('  ✅ Typing indicator stopped');
          resolve();
        }, 1000);
      });
    });

    // Test presence update
    await testEvent('Presence Update', () => {
      return new Promise((resolve, reject) => {
        socket.emit('presence:update', {
          workspaceId: 1,
          status: 'away'
        });
        
        console.log('  ✅ Presence updated to away');
        resolve();
      });
    });

    // Test direct message
    await testEvent('Send Direct Message', () => {
      return new Promise((resolve, reject) => {
        socket.once('dm:sent', (message) => {
          console.log('  ✅ DM sent:', message.content);
          resolve();
        });

        socket.emit('dm:send', {
          workspaceId: 1,
          receiverId: 2,
          content: 'WebSocket DM test'
        });

        socket.once('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
    });

    // Test reaction
    await testEvent('Add Reaction', () => {
      return new Promise((resolve, reject) => {
        socket.once('reaction:added', (data) => {
          console.log('  ✅ Reaction added:', data.emoji);
          resolve();
        });

        socket.emit('reaction:add', {
          messageId: 1,
          emoji: '🚀'
        });

        socket.once('error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
    });

    console.log('\n=====================================');
    console.log('✅ All WebSocket tests passed!');
    console.log('=====================================');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    if (socket) {
      socket.disconnect();
      console.log('\n✅ WebSocket disconnected');
    }
    process.exit(0);
  }
}

async function testEvent(name, fn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await fn();
  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);
    throw error;
  }
}

// Run tests
testWebSocket();
