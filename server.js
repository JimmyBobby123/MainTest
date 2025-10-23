// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected players
let players = {};

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New player connected');

  // Assign a unique ID to the player
  const playerId = Date.now() + Math.floor(Math.random() * 1000);
  players[playerId] = { x: 0, z: 0 };

  // Notify the client of their ID
  ws.send(JSON.stringify({ type: 'init', id: playerId }));

  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'update') {
        // Update player's position
        players[playerId] = { x: data.x, z: data.z };

        // Broadcast the updated positions to all clients
        const updateData = JSON.stringify({
          type: 'update',
          players: players,
        });

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(updateData);
          }
        });
      }
    } catch (err) {
      console.warn('Invalid message received', err);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log('Player disconnected', playerId);
    delete players[playerId];

    const updateData = JSON.stringify({
      type: 'update',
      players: players,
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(updateData);
      }
    });
  });
});

// Use Render's PORT or fall back to 8080 locally
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
