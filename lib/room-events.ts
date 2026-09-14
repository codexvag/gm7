import { EventEmitter } from 'events';

declare global {
  // eslint-disable-next-line no-var
  var __mmoRoomEventBus:
    | EventEmitter
    | undefined;
}

export const roomEventBus:
  EventEmitter =
  globalThis.__mmoRoomEventBus ||
  (
    globalThis.__mmoRoomEventBus =
      new EventEmitter()
  );

roomEventBus.setMaxListeners(
  500
);

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
  const data:
    RoomUpdatePayload = {
    roomId,
    version:
      payload.version,
    state:
      payload.state,
    originUserId:
      payload.originUserId,
    actionType:
      payload.actionType,
    actionPayload:
      payload.actionPayload,
    timestamp:
      Date.now()
  };

  /*
   * POLISH-B:
   * one canonical event per room.
   * SSE, same-process relays and future pub/sub adapters
   * subscribe to the same channel and never receive duplicates.
   */
  roomEventBus.emit(
    `room:${roomId}`,
    data
  );
}
