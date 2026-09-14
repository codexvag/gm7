import {
  NextRequest
} from 'next/server';

import {
  getChatGPTUser
} from '@/app/chatgpt-auth';

import {
  database
} from '@/lib/room-db';

import {
  roomEventBus,
  type RoomUpdatePayload
} from '@/lib/room-events';

export const dynamic =
  'force-dynamic';

export async function GET(
  req: NextRequest
) {
  const user =
    await getChatGPTUser();

  if (!user) {
    return new Response(
      'Unauthorized',
      {
        status: 401
      }
    );
  }

  const {
    searchParams
  } =
    new URL(
      req.url
    );

  const roomId =
    searchParams.get(
      'room'
    ) ||
    'mmo-world-village';

  const db =
    await database();

  const membership =
    await db
      .prepare(
        'SELECT room FROM members WHERE room=? AND user=?'
      )
      .bind(
        roomId,
        user.userId
      )
      .first<{
        room: string;
      }>();

  if (!membership) {
    return new Response(
      'Forbidden',
      {
        status: 403
      }
    );
  }

  const encoder =
    new TextEncoder();

  let cleanup:
    | (() => void)
    | null = null;

  const stream =
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: connected\n' +
            'data: ' +
            JSON.stringify({
              roomId,
              timestamp:
                Date.now()
            }) +
            '\n\n'
          )
        );

        const onUpdate =
          (
            payload:
              RoomUpdatePayload
          ) => {
            try {
              controller.enqueue(
                encoder.encode(
                  'event: update\n' +
                  'data: ' +
                  JSON.stringify(
                    payload
                  ) +
                  '\n\n'
                )
              );
            } catch {
              // stream closed
            }
          };

        const eventName =
          `room:${roomId}`;

        roomEventBus.on(
          eventName,
          onUpdate
        );

        const pingTimer =
          setInterval(
            () => {
              try {
                controller.enqueue(
                  encoder.encode(
                    ': ping\n\n'
                  )
                );
              } catch {
                clearInterval(
                  pingTimer
                );
              }
            },
            15000
          );

        cleanup = () => {
          clearInterval(
            pingTimer
          );

          roomEventBus.off(
            eventName,
            onUpdate
          );
        };
      },

      cancel() {
        cleanup?.();
      }
    });

  req.signal.addEventListener(
    'abort',
    () => {
      cleanup?.();
    }
  );

  const headers =
    new Headers({
      'Content-Type':
        'text/event-stream',
      'Cache-Control':
        'no-cache, no-transform',
      Connection:
        'keep-alive',
      'X-Accel-Buffering':
        'no'
    });

  if (
    user.cookieHeaderValue
  ) {
    headers.set(
      'Set-Cookie',
      user.cookieHeaderValue
    );
  }

  return new Response(
    stream,
    {
      status: 200,
      headers
    }
  );
}
