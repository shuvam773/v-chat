import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(
  cors({
    origin: "https://v-chat-tau.vercel.app",
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

// Add a status endpoint to monitor server state
app.get('/status', (req, res) => {
  res.json({
    waitingUsers: waitingUsers.size,
    activeConnections: activeConnections.size,
    totalRooms: roomCounter,
    uptime: process.uptime(),
  });
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://v-chat-tau.vercel.app",
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store waiting users and active connections
let waitingUsers = new Set();
let activeConnections = new Map();
let roomCounter = 0;

// Store chat messages for each room
let chatMessages = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('find-peer', () => {
    console.log('User looking for peer:', socket.id);
    console.log('Current waiting users:', waitingUsers.size);
    console.log('Current active connections:', activeConnections.size / 2);

    // Remove from any existing connection first
    if (activeConnections.has(socket.id)) {
      const partnerId = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      activeConnections.delete(partnerId);

      // Clear chat messages for the room
      const oldRoomId = getRoomId(socket.id, partnerId);
      if (oldRoomId && chatMessages.has(oldRoomId)) {
        chatMessages.delete(oldRoomId);
      }

      socket.to(partnerId).emit('peer-disconnected');
      console.log('Removed existing connection:', socket.id, 'and', partnerId);
    }

    waitingUsers.delete(socket.id);

    // Try to find a waiting peer
    const availablePeers = Array.from(waitingUsers);

    if (availablePeers.length > 0) {
      const peerId = availablePeers[0];
      waitingUsers.delete(peerId);

      // Create connection between users
      activeConnections.set(socket.id, peerId);
      activeConnections.set(peerId, socket.id);

      // Generate a unique room ID for this connection
      roomCounter++;
      const roomId = `room_${roomCounter}`;

      // Initialize chat messages for this room
      chatMessages.set(roomId, []);

      // Notify both users they've been matched
      socket.emit('peer-found', {
        peerId,
        initiator: true,
        roomId,
        chatHistory: [], // Send empty chat history for new connection
      });
      socket.to(peerId).emit('peer-found', {
        peerId: socket.id,
        initiator: false,
        roomId,
        chatHistory: [], // Send empty chat history for new connection
      });

      console.log(`Room ${roomId}: Connected users ${socket.id} and ${peerId}`);
      console.log(`Total active rooms: ${activeConnections.size / 2}`);
    } else {
      // Add to waiting list
      waitingUsers.add(socket.id);
      socket.emit('waiting-for-peer');
      console.log(
        'User added to waiting list:',
        socket.id,
        'Total waiting:',
        waitingUsers.size
      );
    }
  });

  // Text chat functionality
  socket.on('send-message', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      const roomId = getRoomId(socket.id, partnerId);

      if (roomId) {
        // Create message object with timestamp
        const message = {
          id: generateMessageId(),
          from: socket.id,
          text: data.text,
          timestamp: new Date().toISOString(),
          type: data.type || 'text', // 'text' or 'system'
        };

        // Store message in chat history
        if (chatMessages.has(roomId)) {
          const messages = chatMessages.get(roomId);
          messages.push(message);

          // Limit chat history to last 100 messages to prevent memory issues
          if (messages.length > 100) {
            messages.shift(); // Remove oldest message
          }
        }

        // Send message to partner
        socket.to(partnerId).emit('receive-message', message);

        // Also send back to sender for confirmation and UI update
        socket.emit('receive-message', message);

        console.log(
          `Message sent in room ${roomId}: ${data.text.substring(0, 50)}...`
        );
      }
    }
  });

  socket.on('signal', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      socket.to(partnerId).emit('signal', {
        signal: data.signal,
        from: socket.id,
      });
    }
  });

  socket.on('disconnect-peer', () => {
    handleDisconnection(socket.id);
    roomCounter = Math.max(0, roomCounter - 1);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    handleDisconnection(socket.id);
    roomCounter = Math.max(0, roomCounter - 1);
  });

  function handleDisconnection(socketId) {
    // Remove from waiting list
    waitingUsers.delete(socketId);

    // Handle active connection
    if (activeConnections.has(socketId)) {
      const partnerId = activeConnections.get(socketId);
      const roomId = getRoomId(socketId, partnerId);

      // Clear chat messages for the room
      if (roomId && chatMessages.has(roomId)) {
        chatMessages.delete(roomId);
        console.log(`Cleared chat messages for room: ${roomId}`);
      }

      activeConnections.delete(socketId);
      activeConnections.delete(partnerId);

      // Notify partner of disconnection
      socket.to(partnerId).emit('peer-disconnected');
      console.log('Disconnected users:', socketId, 'and', partnerId);
    }
  }

  // Helper function to get room ID from two socket IDs
  function getRoomId(socketId1, socketId2) {
    for (let [id1, id2] of activeConnections) {
      if (
        (id1 === socketId1 && id2 === socketId2) ||
        (id1 === socketId2 && id2 === socketId1)
      ) {
        // Find the room number by checking which pair matches
        let roomNumber = 1;
        for (let [key, value] of activeConnections) {
          if (
            (key === socketId1 && value === socketId2) ||
            (key === socketId2 && value === socketId1)
          ) {
            return `room_${roomNumber}`;
          }
          roomNumber++;
        }
      }
    }
    return null;
  }

  // Helper function to generate unique message ID
  function generateMessageId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
