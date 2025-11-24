const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Game state
const players = {};

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

    // Load blocks from DB and send to player
    db.query('SELECT * FROM blocks')
      .then(res => socket.emit('initialBlocks', res.rows))
      .catch(err => {
        console.error('Error loading blocks:', err);
        socket.emit('initialBlocks', []);
      });

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
      // Broadcast to others
      socket.broadcast.emit('blockPlaced', data);
    } catch (err) {
      console.error('Error saving block:', err);
    }
  });

  // Handle ping for latency check
  socket.on('ping', () => {
    socket.emit('pong');
  });

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
