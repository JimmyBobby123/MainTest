import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';

// Create a WebSocket connection to the server
//const socket = new WebSocket('ws://localhost:8080');
const socket = new WebSocket('wss://maintest-5ltj.onrender.com/');

let playerId = null;
let otherPlayers = {};

const topFloorTiles = []; // Array to store references to the top floor tiles

// Initialize the scene
const scene = new THREE.Scene();

// Set up the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 10);
camera.lookAt(0, 0, 0);

// Create a renderer and attach it to the document
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Enable OrbitControls for camera movement
const controls = new OrbitControls(camera, renderer.domElement);

// Define grid and tile sizes
const tileSize = 1;
const gridSize = 10;
const halfGridSize = gridSize / 2 * tileSize;

// Create the floor and tiles
function createFloorAndTiles() {
    // Create top layer tiles
    for (let x = -gridSize / 2; x < gridSize / 2; x++) {
        for (let z = -gridSize / 2; z < gridSize / 2; z++) {
            const isEven = (x + z) % 2 === 0;
            const topColor = isEven ? 0x00ff00 : 0xffffff; // Green and White tiles
            const tileGeometry = new THREE.BoxGeometry(tileSize, 0.1, tileSize);
            const tileMaterial = new THREE.MeshBasicMaterial({ color: topColor });
            const tile = new THREE.Mesh(tileGeometry, tileMaterial);
            tile.position.set(x * tileSize, 0, z * tileSize);
            scene.add(tile);

            // Store the tile reference
            topFloorTiles.push(tile);
        }
    }
}

// Create a single large brown cube for the layer underneath
const bottomColor = 0x8B4513; // Brown color
const bottomGeometry = new THREE.BoxGeometry(gridSize, 0.5, gridSize);
const bottomMaterial = new THREE.MeshBasicMaterial({ color: bottomColor });
const bottomTile = new THREE.Mesh(bottomGeometry, bottomMaterial);
bottomTile.position.set(-0.5, -0.3, -0.5); // Positioned just below the top layer
scene.add(bottomTile);

// Create the player
const playerGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
playerMesh.position.set(0, 0.5, 0);
scene.add(playerMesh);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Player movement variables
const playerSpeed = 0.1;
const playerVelocity = { x: 0, z: 0 };

//Frame rate
let lastTime = 0;
const targetFPS = 60;
const frameDuration = 1000 / targetFPS;

// Handle keydown events for movement
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowUp': playerVelocity.z = -playerSpeed; break;
        case 'ArrowDown': playerVelocity.z = playerSpeed; break;
        case 'ArrowLeft': playerVelocity.x = -playerSpeed; break;
        case 'ArrowRight': playerVelocity.x = playerSpeed; break;
    }
});

// Handle keyup events to stop movement
document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown': playerVelocity.z = 0; break;
        case 'ArrowLeft':
        case 'ArrowRight': playerVelocity.x = 0; break;
    }
});

// Handle WebSocket messages
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'init') {
        playerId = data.id;
    } else if (data.type === 'update') {
        otherPlayers = data.players;
    }
};

// Send player position to the server
function sendPlayerPosition() {
    if (playerId !== null) {
        socket.send(JSON.stringify({
            type: 'update',
            id: playerId,
            x: playerMesh.position.x,
            z: playerMesh.position.z,
        }));
    }
}

// Render other players
function renderOtherPlayers() {
    // Create or update meshes for existing players
    Object.keys(otherPlayers).forEach(id => {
        if (id !== playerId.toString()) {
            const playerData = otherPlayers[id];

            // Create a new mesh if it doesn't exist
            if (!playerData.mesh) {
                const otherPlayerGeometry = new THREE.SphereGeometry(0.5, 32, 32);
                const otherPlayerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                playerData.mesh = new THREE.Mesh(otherPlayerGeometry, otherPlayerMaterial);
                scene.add(playerData.mesh);
            }

            // Update position of existing mesh
            playerData.mesh.position.set(playerData.x, 0.5, playerData.z);
        }
    });

    // Remove old meshes not part of the scene
    scene.children.forEach(child => {
        if (child.isMesh && child !== playerMesh && child !== bottomTile && !topFloorTiles.includes(child)) {
            const shouldRemove = !Object.values(otherPlayers).some(player => player.mesh === child);
            if (shouldRemove) {
                scene.remove(child);
            }
        }
    });
}

function animate(time) {
    requestAnimationFrame(animate);

    // Calculate time elapsed since the last frame
    const deltaTime = time - lastTime;

    if (deltaTime >= frameDuration) {
        lastTime = time;

        // Update player position based on velocity
        playerMesh.position.x += playerVelocity.x;
        playerMesh.position.z += playerVelocity.z;

        // Constrain player within the floor boundaries
        playerMesh.position.x = Math.max(-halfGridSize, Math.min(halfGridSize - 1, playerMesh.position.x));
        playerMesh.position.z = Math.max(-halfGridSize, Math.min(halfGridSize - 1, playerMesh.position.z));

        // Send updated position to the server
        sendPlayerPosition();

        // Update positions of other players
        renderOtherPlayers();

        // Clear and render the scene
        renderer.clear();
        renderer.render(scene, camera);

        // Update controls
        controls.update();
    }
}


// Handle window resize
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Initialize the scene and start animation
createFloorAndTiles();
animate();
