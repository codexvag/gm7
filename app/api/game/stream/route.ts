import { NextRequest } from 'next/server';
import { roomEventBus, type RoomUpdatePayload } from '@/lib/room-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('room') || 'mmo-world-village';

  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected event
      const initMsg = `event: connected\ndata: ${JSON.stringify({ roomId, timestamp: Date.now() })}\n\n`;
      controller.enqueue(encoder.encode(initMsg));

      // 2. Listener for room events
      const onUpdate = (payload: RoomUpdatePayload) => {
        try {
          const sseMsg = `event: update\ndata: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(sseMsg));
        } catch {
          // Stream controller might be closed
        }
      };

      const eventName = roomId === 'mmo-world-village' ? 'room:mmo-world-village:all' : `room:${roomId}`;
      roomEventBus.on(eventName, onUpdate);

      // Also listen on standard room id if different
      if (roomId === 'mmo-world-village') {
        roomEventBus.on('room:mmo-world-village', onUpdate);
      }

      // 3. Keep-alive ping interval (15s)
      const pingTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(pingTimer);
        }
      }, 15000);

      cleanup = () => {
        clearInterval(pingTimer);
        roomEventBus.off(eventName, onUpdate);
        if (roomId === 'mmo-world-village') {
          roomEventBus.off('room:mmo-world-village', onUpdate);
        }
      };
    },
    cancel() {
      if (cleanup) cleanup();
    }
  });

  req.signal.addEventListener('abort', () => {
    if (cleanup) cleanup();
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
