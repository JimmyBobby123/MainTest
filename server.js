import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { NewsFeed } from './newsfeed.js';
import WebSocket, { WebSocketServer } from 'ws';  // <-- fixed import

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const newsFeed = new NewsFeed();

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // <-- use WebSocketServer

// Store connected players
let players = {};

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New player connected');

  const playerId = Date.now() + Math.floor(Math.random() * 1000);
  players[playerId] = { x: 0, z: 0 };
  ws.send(JSON.stringify({ type: 'init', id: playerId }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'update') {
        players[playerId] = { x: data.x, z: data.z };
        const updateData = JSON.stringify({ type: 'update', players });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(updateData);
        });
      }
    } catch (err) {
      console.warn('Invalid message received', err);
    }
  });

  ws.on('close', () => {
    console.log('Player disconnected', playerId);
    delete players[playerId];
    const updateData = JSON.stringify({ type: 'update', players });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(updateData);
    });
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
