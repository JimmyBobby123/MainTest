const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New player connected');
});

server.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});

// Store connected players
let players = {};

// Handle connection
wss.on('connection', (ws) => {
    console.log('New player connected');

    // Assign a unique ID to the player
    const playerId = Date.now();
    players[playerId] = { x: 0, z: 0 };

    // Notify the client of their ID
    ws.send(JSON.stringify({ type: 'init', id: playerId }));

    // Handle messages from clients
    ws.on('message', (message) => {
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
    });

    // Handle disconnection
    ws.on('close', () => {
        console.log('Player disconnected');
        delete players[playerId];

        // Broadcast the updated player list to all clients
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

console.log('WebSocket server is running on ws://localhost:8080');
