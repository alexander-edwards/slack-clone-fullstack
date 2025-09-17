#!/bin/bash

BASE_URL="http://localhost:3001"
echo "Testing Slack Clone Backend API"
echo "================================"

# Test 1: Health Check
echo -e "\n1. Testing Health Check..."
HEALTH=$(curl -s $BASE_URL/health)
echo "Response: $HEALTH"

# Test 2: Register a new user
echo -e "\n2. Testing User Registration..."
REGISTER=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "username": "testuser",
    "password": "testpass123",
    "display_name": "Test User"
  }')
echo "Response: $(echo $REGISTER | head -c 150)..."

# Test 3: Login
echo -e "\n3. Testing Login..."
LOGIN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"demo123"}')

TOKEN=$(echo $LOGIN | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "Login successful, token received: $(echo $TOKEN | head -c 20)..."

# Test 4: Get Current User
echo -e "\n4. Testing Get Current User..."
ME=$(curl -s $BASE_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $(echo $ME | head -c 150)..."

# Test 5: Get Workspaces
echo -e "\n5. Testing Get Workspaces..."
WORKSPACES=$(curl -s $BASE_URL/api/workspaces \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $(echo $WORKSPACES | head -c 150)..."

# Test 6: Get Channels
echo -e "\n6. Testing Get Channels..."
CHANNELS=$(curl -s $BASE_URL/api/channels/workspace/1 \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $(echo $CHANNELS | head -c 150)..."

# Test 7: Send a Message
echo -e "\n7. Testing Send Message..."
MESSAGE=$(curl -s -X POST $BASE_URL/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": 1,
    "content": "Test message from API test script"
  }')
echo "Response: $(echo $MESSAGE | head -c 150)..."

# Test 8: Get Messages
echo -e "\n8. Testing Get Messages..."
MESSAGES=$(curl -s $BASE_URL/api/messages/channel/1?limit=5 \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $(echo $MESSAGES | head -c 150)..."

# Test 9: Search
echo -e "\n9. Testing Search..."
SEARCH=$(curl -s "$BASE_URL/api/search?q=test&limit=5" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $(echo $SEARCH | head -c 150)..."

# Test 10: Get Direct Messages
echo -e "\n10. Testing Direct Messages..."
DMS=$(curl -s $BASE_URL/api/direct-messages/workspace/1 \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $(echo $DMS | head -c 150)..."

echo -e "\n================================"
echo "API Testing Complete!"
