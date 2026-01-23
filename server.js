const { spawn } = require("child_process");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const HTTP_PORT = 3000;
const WS_PORT = 4000;
const SYNC_MESSAGE = "move";

// Enemy configuration - matching Scene.jsx dimensions
const HALL_SCALE = 5;
const SCALE = (value) => value * HALL_SCALE;
const HALL_WIDTH = SCALE(44 * 5);
const HALL_LENGTH = SCALE(110 * 5);
const HALL_HALF_WIDTH = HALL_WIDTH / 2;
const HALL_HALF_LENGTH = HALL_LENGTH / 2;
const ENEMY_BOUNDARY_MARGIN = 50; // Keep enemies away from walls
const ENEMY_COUNT = 3;
const ENEMY_SPEED = 4; // units per second - increased for more aggressive pursuit
const ENEMY_UPDATE_INTERVAL = 50; // ms
const ENEMY_STOP_DISTANCE = 12; // units - enemies stop pursuing when this close to player
const ENEMY_DETECTION_RANGE = 1000; // units - enemies can detect players across the entire map
const RESPAWN_DELAY = 5000; // ms - wait before respawning all enemies

const servePath = path.join(__dirname, "node_modules", ".bin", "serve");
const staticServer = spawn(servePath, ["-s", "dist", "-l", String(HTTP_PORT)], {
  stdio: "inherit",
});

const app = express();
app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});
const wsServer = http.createServer(app);
const wss = new WebSocketServer({ server: wsServer });
const players = new Map();

// Enemy state management
const enemies = new Map();
let respawnPending = false;

const randomColor = () =>
  `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;

// Initialize enemy with random position
const createEnemy = (id, faceIndex) => {
  const limitX = HALL_HALF_WIDTH - ENEMY_BOUNDARY_MARGIN;
  const limitZ = HALL_HALF_LENGTH - ENEMY_BOUNDARY_MARGIN;
  
  return {
    id,
    x: (Math.random() - 0.5) * 2 * limitX,
    y: 0, // Ground level
    z: (Math.random() - 0.5) * 2 * limitZ,
    alive: true,
    faceIndex, // Which profile picture to use (0, 1, or 2)
    directionX: 0, // Will be set by AI when pursuing player
    directionZ: 0,
    lastDirectionChange: null, // Used for random wandering when no players present
  };
};

// Initialize all enemies
const initializeEnemies = () => {
  enemies.clear();
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const id = `enemy-${i}`;
    enemies.set(id, createEnemy(id, i));
  }
  respawnPending = false;
};

// Find the closest player to an enemy
const findClosestPlayer = (enemy) => {
  if (players.size === 0) return null;
  
  let closestPlayer = null;
  let closestDistance = Infinity;
  
  for (const player of players.values()) {
    const pos = player.position;
    if (!pos) continue;
    
    const dx = pos.x - enemy.x;
    const dz = pos.z - enemy.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < closestDistance && distance < ENEMY_DETECTION_RANGE) {
      closestDistance = distance;
      closestPlayer = { player, distance, dx, dz };
    }
  }
  
  return closestPlayer;
};

// Update enemy position (server-side AI) - now pursues closest player
const updateEnemyPosition = (enemy, deltaSeconds) => {
  if (!enemy.alive) return;
  
  // Find the closest player
  const target = findClosestPlayer(enemy);
  
  if (target) {
    const { distance, dx, dz } = target;
    
    // Only move if we're outside the stop distance
    if (distance > ENEMY_STOP_DISTANCE) {
      // Normalize direction toward player
      const dirLength = Math.sqrt(dx * dx + dz * dz);
      if (dirLength > 0.001) {
        enemy.directionX = dx / dirLength;
        enemy.directionZ = dz / dirLength;
      }
      
      // Move toward player
      const moveX = enemy.directionX * ENEMY_SPEED * deltaSeconds;
      const moveZ = enemy.directionZ * ENEMY_SPEED * deltaSeconds;
      
      enemy.x += moveX;
      enemy.z += moveZ;
    }
    // If within stop distance, enemy holds position (ready to be attacked)
  } else {
    // No players - wander randomly (fallback behavior)
    const now = Date.now();
    if (!enemy.lastDirectionChange || now - enemy.lastDirectionChange > 3000) {
      const angle = Math.random() * Math.PI * 2;
      enemy.directionX = Math.cos(angle);
      enemy.directionZ = Math.sin(angle);
      enemy.lastDirectionChange = now;
    }
    
    // Move in current direction
    const moveX = enemy.directionX * ENEMY_SPEED * 0.5 * deltaSeconds; // Slower wander
    const moveZ = enemy.directionZ * ENEMY_SPEED * 0.5 * deltaSeconds;
    
    enemy.x += moveX;
    enemy.z += moveZ;
  }
  
  // Boundary check - clamp to hall bounds
  const limitX = HALL_HALF_WIDTH - ENEMY_BOUNDARY_MARGIN;
  const limitZ = HALL_HALF_LENGTH - ENEMY_BOUNDARY_MARGIN;
  
  enemy.x = Math.max(-limitX, Math.min(limitX, enemy.x));
  enemy.z = Math.max(-limitZ, Math.min(limitZ, enemy.z));
};

// Check if all enemies are dead and trigger respawn
const checkRespawn = () => {
  if (respawnPending) return;
  
  const allDead = Array.from(enemies.values()).every(e => !e.alive);
  if (allDead) {
    respawnPending = true;
    console.log(`All enemies eliminated! Respawning in ${RESPAWN_DELAY / 1000} seconds...`);
    setTimeout(() => {
      initializeEnemies();
      broadcastEnemyState();
      console.log("Enemies respawned!");
    }, RESPAWN_DELAY);
  }
};

// Handle attack from player
const handleAttack = (enemyId, playerId) => {
  const enemy = enemies.get(enemyId);
  if (!enemy || !enemy.alive) return false;
  
  enemy.alive = false;
  console.log(`Player ${playerId} eliminated ${enemyId}`);
  
  broadcastEnemyState();
  checkRespawn();
  
  return true;
};

// Get enemy state for broadcasting
const getEnemyState = () => {
  return Array.from(enemies.values()).map(e => ({
    id: e.id,
    x: e.x,
    y: e.y,
    z: e.z,
    alive: e.alive,
    faceIndex: e.faceIndex,
  }));
};

// Broadcast enemy state to all clients
const broadcastEnemyState = () => {
  const payload = JSON.stringify({
    type: "enemies",
    enemies: getEnemyState(),
  });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
};

// Initialize enemies on server start
initializeEnemies();

// Enemy update loop
let lastEnemyUpdate = Date.now();
const enemyUpdateLoop = setInterval(() => {
  const now = Date.now();
  const deltaSeconds = (now - lastEnemyUpdate) / 1000;
  lastEnemyUpdate = now;
  
  // Update each enemy's position
  for (const enemy of enemies.values()) {
    updateEnemyPosition(enemy, deltaSeconds);
  }
  
  // Broadcast updated positions
  broadcastEnemyState();
}, ENEMY_UPDATE_INTERVAL);

const broadcastState = () => {
  const payload = JSON.stringify({
    type: "state",
    players: Array.from(players.values()),
  });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
};

wss.on("connection", (socket) => {
  const id = crypto.randomUUID();
  const player = {
    id,
    color: randomColor(),
    position: { x: 0, y: 0.9, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
  players.set(id, player);

  // Send welcome message with player info and current enemy state
  socket.send(
    JSON.stringify({
      type: "welcome",
      id: player.id,
      color: player.color,
      players: Array.from(players.values()),
      enemies: getEnemyState(),
    })
  );

  socket.on("message", (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch (error) {
      return;
    }
    
    // Handle player movement
    if (payload?.type === SYNC_MESSAGE) {
      const existing = players.get(id);
      if (!existing) {
        return;
      }
      if (payload.position) {
        existing.position = payload.position;
      }
      if (payload.rotation) {
        existing.rotation = payload.rotation;
      }
      broadcastState();
      return;
    }
    
    // Handle attack
    if (payload?.type === "attack") {
      const enemyId = payload.enemyId;
      if (enemyId) {
        handleAttack(enemyId, id);
      }
      return;
    }
  });

  socket.on("close", () => {
    players.delete(id);
    broadcastState();
  });
});

wsServer.listen(WS_PORT, () => {
  console.log(`WebSocket server listening on ${WS_PORT}`);
});

const shutdown = () => {
  clearInterval(enemyUpdateLoop);
  staticServer.kill("SIGTERM");
  wss.close(() => {
    wsServer.close(() => {
      process.exit(0);
    });
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
