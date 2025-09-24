import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors(
  {
    origin: "https://v-chat-tau.vercel.app/",
    methods: ["GET", "POST"]
  }
));

// Add a status endpoint to monitor server state
app.get('/status', (req, res) => {
  res.json({
    waitingUsers: waitingUsers.size,
    activeConnections: activeConnections.size / 2,
    totalRooms: roomCounter,
    uptime: process.uptime()
  });
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://v-chat-tau.vercel.app/",
    methods: ["GET", "POST"]
  }
});

// Store waiting users and active connections
let waitingUsers = new Set();
let activeConnections = new Map();
let roomCounter = 0;

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
      
      // Notify both users they've been matched
      socket.emit('peer-found', { peerId, initiator: true, roomId });
      socket.to(peerId).emit('peer-found', { peerId: socket.id, initiator: false, roomId });
      
      console.log(`Room ${roomId}: Connected users ${socket.id} and ${peerId}`);
      console.log(`Total active rooms: ${activeConnections.size / 2}`);
    } else {
      // Add to waiting list
      waitingUsers.add(socket.id);
      socket.emit('waiting-for-peer');
      console.log('User added to waiting list:', socket.id, 'Total waiting:', waitingUsers.size);
    }
  });

  socket.on('signal', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      socket.to(partnerId).emit('signal', {
        signal: data.signal,
        from: socket.id
      });
    }
  });

  socket.on('disconnect-peer', () => {
    handleDisconnection(socket.id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    handleDisconnection(socket.id);
  });

  function handleDisconnection(socketId) {
    // Remove from waiting list
    waitingUsers.delete(socketId);
    
    // Handle active connection
    if (activeConnections.has(socketId)) {
      const partnerId = activeConnections.get(socketId);
      activeConnections.delete(socketId);
      activeConnections.delete(partnerId);
      
      // Notify partner of disconnection
      socket.to(partnerId).emit('peer-disconnected');
      console.log('Disconnected users:', socketId, 'and', partnerId);
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});