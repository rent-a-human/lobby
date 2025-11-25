const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://rent-a-human.github.io", // Allow your GitHub Pages site
    methods: ["GET", "POST"]
  }
});

app.use(express.static(__dirname));

// Game state
const players = {};
const messageHistory = []; // Store last 10 messages
const initialBlocks = [];

// Load initial state from DB
(async () => {
  try {
    const res = await db.query('SELECT * FROM blocks');
    res.rows.forEach(row => {
      initialBlocks.push({
        x: row.x,
        y: row.y,
        z: row.z,
        type: row.type
      });
    });
    console.log(`Loaded ${initialBlocks.length} blocks from DB`);

    // Load last 10 messages
    const msgRes = await db.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 10');
    // Reverse to show oldest first in the list
    msgRes.rows.reverse().forEach(row => {
      messageHistory.push({
        id: row.id,
        text: row.text,
        author: row.author,
        timestamp: row.created_at
      });
    });
    console.log(`Loaded ${messageHistory.length} messages from DB`);

  } catch (err) {
    console.error('Error loading initial state:', err);
  }
})();

io.on('connection', async (socket) => {
  console.log('A user connected:', socket.id);

  // Handle new player joining
  socket.on('joinGame', (playerName) => {
    // Check if name is taken
    const nameTaken = Object.values(players).some(p => p.name === playerName);
    if (nameTaken) {
      socket.emit('joinError', 'Name is already taken');
      return;
    }

    // Add player
    players[socket.id] = {
      name: playerName,
      x: 0, y: 0, z: 0,
      rotation: 0
    };

    socket.emit('joinSuccess', { id: socket.id, ...players[socket.id] });
    
    // Send existing players to new player
    socket.emit('currentPlayers', players);

    // Send initial blocks to new player
    socket.emit('initialBlocks', initialBlocks);

    socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });
  });


  // Handle player movement
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id] = data;
      socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
    }
  });

  // Handle block placement
  socket.on('blockPlace', async (data) => {
    try {
      const { x, y, z, type } = data;
      // Save to DB
      await db.query(
        'INSERT INTO blocks (x, y, z, type) VALUES ($1, $2, $3, $4)',
        [x, y, z, type]
      );
      
      // Update in-memory state
      initialBlocks.push({ x, y, z, type });

      // Broadcast to others
      socket.broadcast.emit('blockPlaced', data);
      // Acknowledge success to sender
      socket.emit('blockSaveSuccess', { x, y, z });
    } catch (err) {
      console.error('Error saving block:', err);
      socket.emit('blockSaveError', err.message);
    }
  });

  // Handle ping for latency check
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Chat/Message Board
  socket.on('chatMessage', async (msg) => {
    const messageData = {
      id: Date.now(),
      text: msg.text,
      author: msg.author || 'Anonymous',
      timestamp: new Date().toISOString()
    };
    
    // Store in history (keep last 10 in memory)
    messageHistory.push(messageData);
    if (messageHistory.length > 10) messageHistory.shift();
    
    io.emit('chatUpdate', messageHistory);

    // Persist to DB
    try {
      await db.query(
        'INSERT INTO messages (text, author) VALUES ($1, $2)',
        [messageData.text, messageData.author]
      );
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  // Send history on connect
  socket.emit('chatUpdate', messageHistory);

  // Handle block removal
  socket.on('blockRemove', async (data) => {
    try {
      const { x, y, z } = data;
      // Remove from DB (using approximate float matching or exact if possible)
      // Since coordinates are floats, we might need a small epsilon or ensure exact match from client
      // For this prototype, we assume exact match as sent by client
      await db.query(
        'DELETE FROM blocks WHERE x = $1 AND y = $2 AND z = $3',
        [x, y, z]
      );
      
      // Update in-memory state
      const index = initialBlocks.findIndex(b => 
        Math.abs(b.x - x) < 0.001 && 
        Math.abs(b.y - y) < 0.001 && 
        Math.abs(b.z - z) < 0.001
      );
      if (index !== -1) {
        initialBlocks.splice(index, 1);
      }

      // Broadcast to others
      socket.broadcast.emit('blockRemoved', data);
    } catch (err) {
      console.error('Error removing block:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
