import { NextRequest } from 'next/server';
import { database } from '@/lib/room-db';
import { roomEventBus, type RoomUpdatePayload } from '@/lib/room-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('room') || 'mmo-world-village';

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
      if (eventListener) {
        roomEventBus.off(`room:${roomId}`, eventListener);
        eventListener = null;
      }
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
    }
  });

  // Handle client abort
  req.signal.addEventListener('abort', () => {
    if (eventListener) {
      roomEventBus.off(`room:${roomId}`, eventListener);
      eventListener = null;
    }
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
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
