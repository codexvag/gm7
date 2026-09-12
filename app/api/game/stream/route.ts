import { NextRequest } from 'next/server';
import { database } from '@/lib/room-db';
import { roomEventBus, emitRoomUpdate, type RoomUpdatePayload } from '@/lib/room-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('room') || 'mmo-world-village';
  const userId = req.nextUrl.searchParams.get('userId') || '';
  const characterId = req.nextUrl.searchParams.get('characterId') || '';

  // Verify room exists in DB
  const db = await database();
  const room = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(roomId).first<any>();
  if (!room) {
    return new Response(JSON.stringify({ error: 'Mesa não encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();
  let keepAliveTimer: NodeJS.Timeout | null = null;
  let eventListener: ((data: RoomUpdatePayload) => void) | null = null;

  const handleClientDisconnect = () => {
    if (eventListener) {
      roomEventBus.off(`room:${roomId}`, eventListener);
      eventListener = null;
    }
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }

    if (roomId === 'mmo-world-village' && (characterId || userId)) {
      setTimeout(async () => {
        try {
          const dbInstance = await database();
          const current = await dbInstance.prepare('SELECT state, version FROM rooms WHERE id=?').bind(roomId).first<any>();
          if (current && current.state) {
            const st = JSON.parse(current.state);
            const initialCount = st.characters?.length || 0;
            st.characters = (st.characters || []).filter((ch: any) => {
              if (characterId && ch.id === characterId) return false;
              if (userId && ch.owner === userId && !characterId) return false;
              return true;
            });
            if (st.characters.length !== initialCount) {
              const nextVer = (current.version || 0) + 1;
              await dbInstance.prepare('UPDATE rooms SET state=?, version=? WHERE id=?')
                .bind(JSON.stringify(st), nextVer, roomId)
                .run();
              emitRoomUpdate(roomId, {
                version: nextVer,
                state: st,
                actionType: 'leave',
                actionPayload: { characterId, userId }
              });
            }
          }
        } catch (err) {
          console.warn('SSE disconnect cleanup notice:', err);
        }
      }, 3500);
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial handshake and current state
      try {
        const initialState = JSON.parse(room.state);
        const initPayload = JSON.stringify({
          type: 'init',
          roomId,
          version: room.version,
          state: initialState,
          timestamp: Date.now()
        });
        controller.enqueue(encoder.encode(`event: init\ndata: ${initPayload}\n\n`));
      } catch (err) {
        console.warn('SSE initial state parse notice:', err);
      }

      // 2. Subscribe to real-time room events
      eventListener = (payload: RoomUpdatePayload) => {
        try {
          const msg = JSON.stringify({
            type: 'update',
            ...payload
          });
          controller.enqueue(encoder.encode(`event: update\ndata: ${msg}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      roomEventBus.on(`room:${roomId}`, eventListener);

      // 3. Heartbeat ping every 15s to keep connection alive
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (keepAliveTimer) clearInterval(keepAliveTimer);
        }
      }, 15000);
    },
    cancel() {
      handleClientDisconnect();
    }
  });

  // Handle client abort
  req.signal.addEventListener('abort', () => {
    handleClientDisconnect();
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
