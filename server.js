const { spawn } = require("child_process");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const HTTP_PORT = 3000;
const WS_PORT = 4000;
const SYNC_MESSAGE = "move";

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

const randomColor = () =>
  `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;

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

  socket.send(
    JSON.stringify({
      type: "welcome",
      id: player.id,
      color: player.color,
      players: Array.from(players.values()),
    })
  );

  socket.on("message", (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch (error) {
      return;
    }
    if (payload?.type !== SYNC_MESSAGE) {
      return;
    }
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
  staticServer.kill("SIGTERM");
  wss.close(() => {
    wsServer.close(() => {
      process.exit(0);
    });
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
