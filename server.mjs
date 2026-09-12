import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Game WS Logic
const rooms = new Map();

// Initialize the global event bus that the Next.js routes use
if (!globalThis.__mmoRoomEventBus) {
  globalThis.__mmoRoomEventBus = new EventEmitter();
}
const roomEventBus = globalThis.__mmoRoomEventBus;

const hookedRooms = new Set();

function ensureRoomHooked(roomId) {
  if (!roomId || hookedRooms.has(roomId)) return;
  hookedRooms.add(roomId);

  const eventName = roomId === 'mmo-world-village' ? 'room:mmo-world-village:all' : `room:${roomId}`;
  roomEventBus.on(eventName, (payload) => {
    const targetRoomId = payload.roomId || roomId;
    const roomClients = rooms.get(targetRoomId);
    if (roomClients) {
      const originCharId = payload.actionPayload?.characterId;
      const originUserId = payload.originUserId;
      const wsMsg = JSON.stringify({
        type: payload.actionType === 'move' ? 'HERO_MOVED' : 
              payload.actionType === 'attack' ? 'ATTACK_RESULT' : 'SYNC_SNAPSHOT',
        version: payload.version,
        originUserId,
        originCharId,
        state: payload.state,
        finalPos: payload.actionType === 'move'
          ? {
              x: payload.actionPayload?.x,
              y: payload.actionPayload?.y
            }
          : undefined,
        ...payload.actionPayload
      });
      for (const client of roomClients) {
        if (client.readyState === 1) {
          if (payload.actionType === 'move' && originCharId && client.characterId === originCharId) {
            continue;
          }
          client.send(wsMsg);
        }
      }
    }
  });
}

// Hook default MMO world
ensureRoomHooked('mmo-world-village');

wss.on('connection', (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const roomId = url.searchParams.get('room') || 'mmo-world-village';
  ensureRoomHooked(roomId);
  const userId = url.searchParams.get('userId') || 'anon';
  const charId = url.searchParams.get('characterId') || '';
  ws.userId = userId;
  ws.characterId = charId;
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  const roomClients = rooms.get(roomId);
  roomClients.add(ws);
  
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'PING') return;
      if (parsed.type === 'JOIN_ROOM') {
        if (parsed.characterId) ws.characterId = parsed.characterId;
        if (parsed.userId) ws.userId = parsed.userId;
      } else if (parsed.type === 'PLAYER_JOIN') {
        if (parsed.character?.id) ws.characterId = parsed.character.id;
        if (parsed.userId) ws.userId = parsed.userId;
        const wsMsg = JSON.stringify({
          type: 'PLAYER_JOINED',
          roomId: parsed.roomId,
          userId: parsed.userId,
          character: parsed.character,
          version: Date.now() // Fake version bump
        });
        for (const client of roomClients) {
          if (client !== ws && client.readyState === 1) client.send(wsMsg);
        }
      } else if (parsed.type === 'FORCE_SYNC') {
        // Just acknowledging
      } else {
        // Broadcast generic updates
        for (const client of roomClients) {
          if (client !== ws && client.readyState === 1) {
            client.send(message.toString());
          }
        }
      }
    } catch {}
  });
  
  ws.on('close', () => {
    roomClients.delete(ws);
    if (roomClients.size === 0) {
      rooms.delete(roomId);
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/api/game/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const clientDist = path.join(__dirname, 'dist', 'client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

function createFetchRequest(req) {
  const origin = `${req.protocol}://${req.get('host')}`;
  const url = new URL(req.originalUrl || req.url, origin);

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const init = {
    method: req.method,
    headers: req.headers,
    signal: controller.signal,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body ? JSON.stringify(req.body) : null;
  }

  return new Request(url.href, init);
}

app.use(express.json());

// Native Server-Sent Events (SSE) stream endpoint for real-time multiplayer updates
app.get('/api/game/stream', (req, res) => {
  const roomId = req.query.room || 'mmo-world-village';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  res.write(`event: connected\ndata: ${JSON.stringify({ roomId, timestamp: Date.now() })}\n\n`);

  const onUpdate = (payload) => {
    try {
      res.write(`event: update\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch {}
  };

  const eventName = roomId === 'mmo-world-village' ? 'room:mmo-world-village:all' : `room:${roomId}`;
  roomEventBus.on(eventName, onUpdate);
  if (roomId === 'mmo-world-village') {
    roomEventBus.on('room:mmo-world-village', onUpdate);
  }

  const pingTimer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingTimer);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingTimer);
    roomEventBus.off(eventName, onUpdate);
    if (roomId === 'mmo-world-village') {
      roomEventBus.off('room:mmo-world-village', onUpdate);
    }
  });
});

app.all('/{*splat}', async (req, res) => {
  try {
    let handler;
    const handlerPath = path.join(__dirname, 'dist', 'server', 'index.js');
    if (fs.existsSync(handlerPath)) {
      handler = (await import(pathToFileURL(handlerPath).href)).default;
    } else {
      return res.status(404).send('Server build not found.');
    }
    
    const fetchReq = createFetchRequest(req);
    const fetchRes = await handler(fetchReq, {}, { waitUntil: (p) => p });
    
    res.status(fetchRes.status);
    for (const [key, value] of fetchRes.headers.entries()) {
      res.setHeader(key, value);
    }
    
    if (fetchRes.body) {
      const reader = fetchRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch (err) {
    console.error('SSR Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Node Server] Running natively on port ${PORT}`);
});



