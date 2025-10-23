import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { CONFIG } from './config.js';


// WebSocket (Render service)
//const socket = new WebSocket('wss://maintest-5ltj.onrender.com');
const socket = new WebSocket(CONFIG.WS_URL);

if (CONFIG.DEBUG) {
  console.log("Running in local mode:", CONFIG.WS_URL);
}

socket.onopen = () => console.log('WS open');
socket.onerror = (err) => console.error('WS error', err);
socket.onclose = () => console.warn('WS closed');

// local identifiers & maps
let playerId = null;
let otherPlayers = {};             // server-provided positions: { id: { x, z } }
const otherPlayerMeshes = {};      // local persistent meshes keyed by id

const topFloorTiles = [];

// THREE scene setup (same as your code)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const tileSize = 1;
const gridSize = 10;
const halfGridSize = gridSize / 2 * tileSize;

function createFloorAndTiles() {
  for (let x = -gridSize / 2; x < gridSize / 2; x++) {
    for (let z = -gridSize / 2; z < gridSize / 2; z++) {
      const isEven = (x + z) % 2 === 0;
      const topColor = isEven ? 0x00ff00 : 0xffffff;
      const tileGeometry = new THREE.BoxGeometry(tileSize, 0.1, tileSize);
      const tileMaterial = new THREE.MeshBasicMaterial({ color: topColor });
      const tile = new THREE.Mesh(tileGeometry, tileMaterial);
      tile.position.set(x * tileSize, 0, z * tileSize);
      scene.add(tile);
      topFloorTiles.push(tile);
    }
  }
}

const bottomColor = 0x8B4513;
const bottomGeometry = new THREE.BoxGeometry(gridSize, 0.5, gridSize);
const bottomMaterial = new THREE.MeshBasicMaterial({ color: bottomColor });
const bottomTile = new THREE.Mesh(bottomGeometry, bottomMaterial);
bottomTile.position.set(-0.5, -0.3, -0.5);
scene.add(bottomTile);

const playerGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
playerMesh.position.set(0, 0.5, 0);
scene.add(playerMesh);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// movement
const playerSpeed = 0.1;
const playerVelocity = { x: 0, z: 0 };

document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowUp': playerVelocity.z = -playerSpeed; break;
    case 'ArrowDown': playerVelocity.z = playerSpeed; break;
    case 'ArrowLeft': playerVelocity.x = -playerSpeed; break;
    case 'ArrowRight': playerVelocity.x = playerSpeed; break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowDown': playerVelocity.z = 0; break;
    case 'ArrowLeft':
    case 'ArrowRight': playerVelocity.x = 0; break;
  }
});

// handle incoming socket messages
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'init') {
      playerId = data.id;
      console.log('Assigned playerId', playerId);
    } else if (data.type === 'update') {
      // server sends players map: { id: { x, z }, ... }
      otherPlayers = data.players || {};
    }
  } catch (e) {
    console.warn('Invalid WS message', e);
  }
};

function sendPlayerPosition() {
  if (socket.readyState === WebSocket.OPEN && playerId !== null) {
    socket.send(JSON.stringify({
      type: 'update',
      id: playerId,
      x: playerMesh.position.x,
      z: playerMesh.position.z,
    }));
  }
}

function syncOtherPlayerMeshes() {
  // Create/update meshes for players in otherPlayers
  Object.keys(otherPlayers).forEach(id => {
    // ignore yourself
    if (playerId !== null && id === playerId.toString()) return;

    const data = otherPlayers[id];
    if (!data) return;

    if (!otherPlayerMeshes[id]) {
      const geometry = new THREE.SphereGeometry(0.5, 32, 32);
      const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(data.x || 0, 0.5, data.z || 0);
      scene.add(mesh);
      otherPlayerMeshes[id] = mesh;
    } else {
      // update
      otherPlayerMeshes[id].position.set(data.x || 0, 0.5, data.z || 0);
    }
  });

  // Remove meshes for players no longer present
  Object.keys(otherPlayerMeshes).forEach(id => {
    if (!otherPlayers[id]) {
      const mesh = otherPlayerMeshes[id];
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else mesh.material.dispose();
      }
      delete otherPlayerMeshes[id];
    }
  });
}

// animation loop
let lastTime = 0;
const targetFPS = 60;
const frameDuration = 1000 / targetFPS;

function animate(time) {
  requestAnimationFrame(animate);
  const deltaTime = time - lastTime;
  if (deltaTime < frameDuration) return;
  lastTime = time;

  playerMesh.position.x += playerVelocity.x;
  playerMesh.position.z += playerVelocity.z;

  playerMesh.position.x = Math.max(-halfGridSize, Math.min(halfGridSize - 1, playerMesh.position.x));
  playerMesh.position.z = Math.max(-halfGridSize, Math.min(halfGridSize - 1, playerMesh.position.z));

  // send and sync
  sendPlayerPosition();
  syncOtherPlayerMeshes();

  renderer.clear();
  renderer.render(scene, camera);
  controls.update();
}

createFloorAndTiles();
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
