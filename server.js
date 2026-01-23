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

// Enemy spawn/patrol area constraints - keep enemies near player spawn point (0, 0, 0)
// This creates a more focused combat area instead of enemies spawning across the massive map
const ENEMY_SPAWN_RADIUS = 150; // Enemies spawn within this radius of center (much smaller than full map)
const ENEMY_MAX_RANGE = 250; // Enemies won't wander further than this from their spawn zone center
const ENEMY_LEASH_RANGE = 300; // If enemy gets beyond this, force return to spawn area
const SPAWN_AREA_CENTER_X = 0; // Player spawn point X
const SPAWN_AREA_CENTER_Z = 0; // Player spawn point Z

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

// Calculate distance from spawn area center
const getDistanceFromSpawnArea = (enemy) => {
  const dx = enemy.x - SPAWN_AREA_CENTER_X;
  const dz = enemy.z - SPAWN_AREA_CENTER_Z;
  return Math.sqrt(dx * dx + dz * dz);
};

// Initialize enemy with random position within spawn area (near player spawn point)
const createEnemy = (id, faceIndex) => {
  // Spawn enemies in a circle around the spawn area center (player spawn point)
  // This ensures enemies are always findable and combat-ready
  const angle = Math.random() * Math.PI * 2;
  const distance = ENEMY_SPAWN_RADIUS * 0.5 + Math.random() * ENEMY_SPAWN_RADIUS * 0.5; // 50-100% of radius
  
  const spawnX = SPAWN_AREA_CENTER_X + Math.cos(angle) * distance;
  const spawnZ = SPAWN_AREA_CENTER_Z + Math.sin(angle) * distance;
  
  // Clamp to hall bounds (safety check)
  const limitX = HALL_HALF_WIDTH - ENEMY_BOUNDARY_MARGIN;
  const limitZ = HALL_HALF_LENGTH - ENEMY_BOUNDARY_MARGIN;
  
  return {
    id,
    x: Math.max(-limitX, Math.min(limitX, spawnX)),
    y: 0, // Ground level
    z: Math.max(-limitZ, Math.min(limitZ, spawnZ)),
    alive: true,
    faceIndex, // Which profile picture to use (0, 1, or 2)
    directionX: 0, // Will be set by AI when pursuing player
    directionZ: 0,
    lastDirectionChange: null, // Used for random wandering when no players present
    // Track spawn position for leash system
    spawnX: spawnX,
    spawnZ: spawnZ,
  };
};

// Initialize all enemies
const initializeEnemies = () => {
  enemies.clear();
  console.log(`Initializing ${ENEMY_COUNT} enemies within ${ENEMY_SPAWN_RADIUS} units of spawn point...`);
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const id = `enemy-${i}`;
    const enemy = createEnemy(id, i);
    enemies.set(id, enemy);
    console.log(`  ${id}: spawned at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)}) - ${getDistanceFromSpawnArea(enemy).toFixed(1)} units from center`);
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

// Update enemy position (server-side AI) - pursues closest player within patrol range
const updateEnemyPosition = (enemy, deltaSeconds) => {
  if (!enemy.alive) return;
  
  const distanceFromSpawn = getDistanceFromSpawnArea(enemy);
  
  // LEASH SYSTEM: If enemy is beyond the leash range, force return to spawn area
  if (distanceFromSpawn > ENEMY_LEASH_RANGE) {
    // Calculate direction back to spawn area center
    const dx = SPAWN_AREA_CENTER_X - enemy.x;
    const dz = SPAWN_AREA_CENTER_Z - enemy.z;
    const dirLength = Math.sqrt(dx * dx + dz * dz);
    
    if (dirLength > 0.001) {
      enemy.directionX = dx / dirLength;
      enemy.directionZ = dz / dirLength;
    }
    
    // Move back toward spawn area at full speed
    const moveX = enemy.directionX * ENEMY_SPEED * deltaSeconds;
    const moveZ = enemy.directionZ * ENEMY_SPEED * deltaSeconds;
    
    enemy.x += moveX;
    enemy.z += moveZ;
  } else {
    // Normal AI behavior: pursue closest player or wander
    const target = findClosestPlayer(enemy);
    
    if (target) {
      const { distance, dx, dz } = target;
      const playerPos = target.player.position;
      
      // Check if pursuing this player would take us beyond max range
      const playerDistFromSpawn = Math.sqrt(
        Math.pow(playerPos.x - SPAWN_AREA_CENTER_X, 2) + 
        Math.pow(playerPos.z - SPAWN_AREA_CENTER_Z, 2)
      );
      
      // Only pursue if the player is within the patrol area OR enemy isn't already at max range
      const canPursue = playerDistFromSpawn <= ENEMY_MAX_RANGE || distanceFromSpawn < ENEMY_MAX_RANGE;
      
      if (canPursue && distance > ENEMY_STOP_DISTANCE) {
        // Normalize direction toward player
        const dirLength = Math.sqrt(dx * dx + dz * dz);
        if (dirLength > 0.001) {
          enemy.directionX = dx / dirLength;
          enemy.directionZ = dz / dirLength;
        }
        
        // Calculate next position
        let nextX = enemy.x + enemy.directionX * ENEMY_SPEED * deltaSeconds;
        let nextZ = enemy.z + enemy.directionZ * ENEMY_SPEED * deltaSeconds;
        
        // Check if next position would exceed max range
        const nextDistFromSpawn = Math.sqrt(
          Math.pow(nextX - SPAWN_AREA_CENTER_X, 2) + 
          Math.pow(nextZ - SPAWN_AREA_CENTER_Z, 2)
        );
        
        if (nextDistFromSpawn <= ENEMY_MAX_RANGE) {
          // Safe to move toward player
          enemy.x = nextX;
          enemy.z = nextZ;
        }
        // else: don't move - player is outside patrol area and we're at edge
      }
      // If within stop distance, enemy holds position (ready to be attacked)
    } else {
      // No players - wander randomly within patrol area
      const now = Date.now();
      if (!enemy.lastDirectionChange || now - enemy.lastDirectionChange > 3000) {
        const angle = Math.random() * Math.PI * 2;
        enemy.directionX = Math.cos(angle);
        enemy.directionZ = Math.sin(angle);
        enemy.lastDirectionChange = now;
      }
      
      // Calculate next position
      let nextX = enemy.x + enemy.directionX * ENEMY_SPEED * 0.5 * deltaSeconds;
      let nextZ = enemy.z + enemy.directionZ * ENEMY_SPEED * 0.5 * deltaSeconds;
      
      // Check if next position would exceed max range during wandering
      const nextDistFromSpawn = Math.sqrt(
        Math.pow(nextX - SPAWN_AREA_CENTER_X, 2) + 
        Math.pow(nextZ - SPAWN_AREA_CENTER_Z, 2)
      );
      
      if (nextDistFromSpawn <= ENEMY_MAX_RANGE) {
        enemy.x = nextX;
        enemy.z = nextZ;
      } else {
        // Turn around - head back toward spawn center
        enemy.directionX = -enemy.directionX;
        enemy.directionZ = -enemy.directionZ;
        enemy.lastDirectionChange = now;
      }
    }
  }
  
  // Final boundary check - clamp to hall bounds (safety net)
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
