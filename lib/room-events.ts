import { EventEmitter } from 'events';

// Global Room Event Bus for Real-Time Server-Sent Events (SSE) Push
// Ensures sub-millisecond local event dispatch across all connected players
declare global {
  // eslint-disable-next-line no-var
  var __mmoRoomEventBus: EventEmitter | undefined;
}

export const roomEventBus: EventEmitter =
  globalThis.__mmoRoomEventBus || (globalThis.__mmoRoomEventBus = new EventEmitter());
roomEventBus.setMaxListeners(500);

export interface RoomUpdatePayload {
  roomId: string;
  version: number;
  state: any;
  originUserId?: string;
  actionType?: string;
  actionPayload?: any;
  timestamp: number;
}

export function emitRoomUpdate(
  roomId: string,
  payload: {
    version: number;
    state: any;
    originUserId?: string;
    actionType?: string;
    actionPayload?: any;
  }
) {
  const data: RoomUpdatePayload = {
    roomId,
    version: payload.version,
    state: payload.state,
    originUserId: payload.originUserId,
    actionType: payload.actionType,
    actionPayload: payload.actionPayload,
    timestamp: Date.now()
  };
  roomEventBus.emit(`room:${roomId}`, data);
  // Also emit to universal mmo listener if it's the MMO world
  if (roomId === 'mmo-world-village') {
    roomEventBus.emit('room:mmo-world-village:all', data);
  }
}
