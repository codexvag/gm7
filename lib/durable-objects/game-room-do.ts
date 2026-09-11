import {
  type State,
  type Character,
  type Enemy,
  type WsClientMessage,
  type WsServerMessage,
  type ProjectileVFX,
  validateWaypointPath,
  validateAttackRange,
  resolveAttack,
  initialState,
  entry
} from '@/lib/game-engine';
import { MAP_COLLISION_PROFILES, type CollisionPolygon } from '@/lib/collision-system';
import { roomEventBus, emitRoomUpdate, type RoomUpdatePayload } from '@/lib/room-events';
import fs from 'node:fs';
import path from 'node:path';

export interface ClientConnectionMeta {
  userId: string;
  characterId?: string;
  connectedAt: number;
  lastPing: number;
}

// In-memory cache for collision polygons by biome
const biomeZoneCache = new Map<string, CollisionPolygon[]>();

function getCollisionZonesForBiome(biome: string): CollisionPolygon[] {
  const profileKey = (biome === 'vila' ? 'village' : biome) as 'village' | 'forest' | 'dungeon';
  if (biomeZoneCache.has(profileKey)) {
    return biomeZoneCache.get(profileKey)!;
  }
  const fileName = `${profileKey === 'village' ? 'vila' : profileKey}-collision.json`;
  const candidates = [
    path.join(process.cwd(), 'public', 'maps', fileName),
    path.join('c:/gm/public/maps', fileName)
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.zones)) {
          biomeZoneCache.set(profileKey, parsed.zones);
          return parsed.zones;
        }
      }
    } catch {
      // Ignore file read errors and fall back
    }
  }
  const fallback = MAP_COLLISION_PROFILES[profileKey]?.customZones || [];
  biomeZoneCache.set(profileKey, fallback);
  return fallback;
}

/**
 * Cloudflare Native Durable Object + In-Memory Real-Time State Controller
 * Manages WebSocket connections, authoritative waypoint movement, combat resolution,
 * sequence numbers (seq), and debounced D1 persistence.
 */
export class GameRoomDurableObject {
  public roomId: string;
  public state: State;
  public version: number;
  public seq: number;
  public sockets: Map<any, ClientConnectionMeta>;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(roomId: string, initialStateData?: State, initialVersion: number = 1) {
    this.roomId = roomId;
    this.state = initialStateData || initialState();
    this.version = initialVersion;
    this.seq = 1;
    this.sockets = new Map();

    // Listen to external HTTP mutations from roomEventBus so DO state stays 100% in sync
    const handleBusUpdate = (payload: RoomUpdatePayload) => {
      if (payload.roomId !== this.roomId || this.isDestroyed) return;
      if (payload.version > this.version) {
        this.version = payload.version;
        this.state = payload.state;
        this.seq++;
        this.broadcast({
          type: 'SYNC_SNAPSHOT',
          roomId: this.roomId,
          state: this.state,
          version: this.version,
          seq: this.seq
        });
      }
    };

    roomEventBus.on(`room:${this.roomId}`, handleBusUpdate);
  }

  public getZones(): CollisionPolygon[] {
    const biome = this.state.biome || 'village';
    return getCollisionZonesForBiome(biome);
  }

  /**
   * Register a new client WebSocket connection to this room
   */
  public handleConnection(ws: any, userId: string = 'anon', characterId?: string): void {
    const meta: ClientConnectionMeta = {
      userId,
      characterId,
      connectedAt: Date.now(),
      lastPing: Date.now()
    };
    this.sockets.set(ws, meta);

    // Send initial authoritative snapshot with monotonic seq
    const snapshotMsg: WsServerMessage = {
      type: 'INIT_SNAPSHOT',
      roomId: this.roomId,
      state: this.state,
      version: this.version,
      seq: this.seq,
      serverTime: Date.now()
    };
    this.send(ws, snapshotMsg);

    // Setup message listener on socket
    if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('message', (event: any) => {
        const raw = typeof event.data === 'string' ? event.data : event.data?.toString();
        this.onMessage(ws, raw);
      });
      ws.addEventListener('close', () => {
        this.sockets.delete(ws);
      });
      ws.addEventListener('error', () => {
        this.sockets.delete(ws);
      });
    } else if (typeof ws.on === 'function') {
      // Node.js ws compatibility
      ws.on('message', (data: any) => {
        this.onMessage(ws, data.toString());
      });
      ws.on('close', () => {
        this.sockets.delete(ws);
      });
      ws.on('error', () => {
        this.sockets.delete(ws);
      });
    }
  }

  /**
   * Process incoming WebSocket message with server-authoritative validation
   */
  public onMessage(ws: any, rawData: string): void {
    try {
      const msg = JSON.parse(rawData) as WsClientMessage;
      const meta = this.sockets.get(ws);

      switch (msg.type) {
        case 'JOIN_ROOM': {
          if (meta) {
            meta.userId = msg.userId || meta.userId;
            meta.characterId = msg.characterId || meta.characterId;
          }
          this.send(ws, {
            type: 'INIT_SNAPSHOT',
            roomId: this.roomId,
            state: this.state,
            version: this.version,
            seq: this.seq,
            serverTime: Date.now()
          });
          break;
        }

        case 'MOVE_PATH': {
          this.handleMovePath(ws, msg);
          break;
        }

        case 'ATTACK': {
          this.handleAttack(ws, msg);
          break;
        }

        case 'CHAT': {
          const chatMsg: WsServerMessage = {
            type: 'CHAT_MESSAGE',
            roomId: this.roomId,
            sender: msg.sender || 'Aventureiro',
            text: msg.text || '',
            timestamp: Date.now()
          };
          this.broadcast(chatMsg);
          break;
        }

        case 'PING': {
          this.send(ws, {
            type: 'PONG',
            timestamp: msg.timestamp || Date.now()
          });
          if (meta) meta.lastPing = Date.now();
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      this.send(ws, {
        type: 'ERROR',
        message: err?.message || 'Erro ao processar mensagem WebSocket.'
      });
    }
  }

  /**
   * Server-Authoritative Waypoint Path Movement
   * Validates contiguous steps, obstacle collisions, speed budget, and turns.
   * If rejected: sends MOVE_REJECTED with legitimate position.
   * If valid: broadcasts HERO_MOVED to all peers and debounces D1 save.
   */
  public handleMovePath(
    ws: any,
    msg: { characterId: string; waypoints: { x: number; y: number }[]; seq: number; maxBound?: number; gridSize?: number }
  ): void {
    const meta = this.sockets.get(ws);
    const char = this.state.characters.find((c) => c.id === msg.characterId);

    if (!char) {
      this.send(ws, {
        type: 'MOVE_REJECTED',
        roomId: this.roomId,
        characterId: msg.characterId,
        originalPos: { x: 0, y: 0 },
        reason: 'Personagem não encontrado.',
        seq: this.seq
      });
      return;
    }

    // Security ownership check: in multiplayer, player cannot move another player's hero
    if (meta && char.owner && meta.userId && char.owner !== meta.userId && meta.userId !== 'gm-host') {
      this.send(ws, {
        type: 'MOVE_REJECTED',
        roomId: this.roomId,
        characterId: char.id,
        originalPos: { x: char.x, y: char.y },
        reason: 'Você não possui permissão para mover este personagem.',
        seq: this.seq
      });
      return;
    }

    const maxBound = msg.maxBound ?? (this.state.biome === 'village' ? 7 : 15);
    const gridSize = msg.gridSize ?? (maxBound + 1);
    const zones = this.getZones();

    const validation = validateWaypointPath(
      char,
      msg.waypoints,
      this.state,
      maxBound,
      gridSize,
      zones
    );

    if (!validation.valid) {
      // Cheat attempt / Invalid step detected: Authoritative Rejection
      this.send(ws, {
        type: 'MOVE_REJECTED',
        roomId: this.roomId,
        characterId: char.id,
        originalPos: { x: char.x, y: char.y },
        reason: validation.reason || 'Movimento inválido.',
        seq: this.seq
      });
      return;
    }

    // Apply movement authoritatively in live RAM (<0.01ms)
    char.x = validation.finalPos.x;
    char.y = validation.finalPos.y;

    if (this.state.combat) {
      this.state.movementUsed = (this.state.movementUsed || 0) + validation.distance;
    }

    this.seq++;
    this.version++;

    // Instant broadcast to ALL connected clients in room
    const moveBroadcast: WsServerMessage = {
      type: 'HERO_MOVED',
      roomId: this.roomId,
      characterId: char.id,
      waypoints: validation.validatedWaypoints,
      finalPos: validation.finalPos,
      seq: this.seq
    };
    this.broadcast(moveBroadcast);

    // Synchronize global server bus for SSE / cross-window listeners
    emitRoomUpdate(this.roomId, {
      version: this.version,
      state: this.state,
      originUserId: meta?.userId,
      actionType: 'move'
    });

    // Schedule debounced database persistence (500ms) without blocking the thread
    this.scheduleDebouncedSave();
  }

  /**
   * Server-Authoritative Combat Attack Resolution
   * Computes D&D 5e rolls, range checks, damage, projectile VFX, and broadcasts result.
   */
  public handleAttack(
    ws: any,
    msg: { actorId: string; targetId: string; weaponIndex?: number; seq: number }
  ): void {
    const meta = this.sockets.get(ws);
    const actor =
      this.state.characters.find((c) => c.id === msg.actorId) ||
      this.state.enemies.find((e) => e.id === msg.actorId);
    const target =
      this.state.characters.find((c) => c.id === msg.targetId) ||
      this.state.enemies.find((e) => e.id === msg.targetId);

    if (!actor || !target) {
      this.send(ws, {
        type: 'ERROR',
        message: 'Atacante ou alvo inválido.'
      });
      return;
    }

    // Turn verification in combat
    if (this.state.combat) {
      const curTurnId = this.state.order[this.state.turn];
      if (curTurnId && curTurnId !== actor.id) {
        this.send(ws, {
          type: 'ERROR',
          message: 'Não é o seu turno de combate.'
        });
        return;
      }
    }

    // Range verification
    const rangeCheck = validateAttackRange(actor, target);
    if (!rangeCheck.inRange) {
      this.send(ws, {
        type: 'ERROR',
        message: `Alvo fora de alcance (${(rangeCheck.distance * 1.5).toFixed(1)}m). Alcance máximo: ${(rangeCheck.maxRange * 1.5).toFixed(1)}m.`
      });
      return;
    }

    // Resolve authoritative D&D 5e attack roll
    const attackResult = resolveAttack(actor, target, 'normal', rangeCheck.isRanged);

    // Determine projectile VFX
    const weaponName = (actor.weapon || '').toLowerCase();
    const isArrow = rangeCheck.isRanged || weaponName.includes('arco') || weaponName.includes('besta');
    const projType: ProjectileVFX['type'] = isArrow ? 'arrow' : 'slash';

    const projectile: ProjectileVFX = {
      id: crypto.randomUUID(),
      type: projType,
      from: { x: actor.x, y: actor.y },
      to: { x: target.x, y: target.y },
      hit: attackResult.hit,
      damage: attackResult.damage
    };

    // Append narrative log
    this.state.logs.push(entry(attackResult.text, 'roll'));

    this.seq++;
    this.version++;

    // Broadcast result to all connected clients
    const resultMsg: WsServerMessage = {
      type: 'ATTACK_RESULT',
      roomId: this.roomId,
      actorId: actor.id,
      targetId: target.id,
      projectile,
      attackResult,
      state: this.state,
      version: this.version,
      seq: this.seq
    };
    this.broadcast(resultMsg);

    emitRoomUpdate(this.roomId, {
      version: this.version,
      state: this.state,
      originUserId: meta?.userId,
      actionType: 'attack'
    });

    this.scheduleDebouncedSave();
  }

  /**
   * Broadcast message to all connected clients in the room
   */
  public broadcast(msg: WsServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const [socket] of this.sockets.entries()) {
      try {
        if (socket.readyState === 1 || socket.readyState === undefined) {
          socket.send(payload);
        }
      } catch {
        this.sockets.delete(socket);
      }
    }
  }

  /**
   * Send message to a specific client WebSocket
   */
  public send(socket: any, msg: WsServerMessage): void {
    try {
      if (socket.readyState === 1 || socket.readyState === undefined) {
        socket.send(JSON.stringify(msg));
      }
    } catch {
      this.sockets.delete(socket);
    }
  }

  /**
   * Debounced D1 persistence (500ms delay) to prevent database write flooding
   */
  public scheduleDebouncedSave(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flushToDatabase().catch((err) => {
        console.warn(`[DO ${this.roomId}] Debounced D1 save notice:`, err?.message);
      });
    }, 500);
  }

  /**
   * Persist current RAM state to D1 SQLite database
   */
  public async flushToDatabase(): Promise<boolean> {
    try {
      const { database } = await import('@/lib/room-db');
      const db = await database();
      if (!db) return false;

      await db
        .prepare('UPDATE rooms SET state = ?, version = ? WHERE id = ?')
        .bind(JSON.stringify(this.state), this.version, this.roomId)
        .run();
      return true;
    } catch {
      // In local dev without active D1 binding or in tests, gracefully ignore
      return false;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.sockets.clear();
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// GLOBAL ROOM REGISTRY & FACTORY (Works in Cloudflare DO & Local Dev/Tests)
// ════════════════════════════════════════════════════════════════════════════════

declare global {
  // eslint-disable-next-line no-var
  var __gameRoomDoRegistry: Map<string, GameRoomDurableObject> | undefined;
}

export const gameRoomRegistry: Map<string, GameRoomDurableObject> =
  globalThis.__gameRoomDoRegistry || (globalThis.__gameRoomDoRegistry = new Map());

export function getOrCreateGameRoom(roomId: string, initialStateData?: State, version: number = 1): GameRoomDurableObject {
  let room = gameRoomRegistry.get(roomId);
  if (!room) {
    room = new GameRoomDurableObject(roomId, initialStateData, version);
    gameRoomRegistry.set(roomId, room);
  }
  return room;
}
