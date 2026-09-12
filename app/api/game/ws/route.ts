import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateGameRoom } from '@/lib/durable-objects/game-room-do';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

// Polyfill / Shim for WebSocketPair when running in environments outside workerd (e.g. Node tests)
class LocalWebSocketPeer extends EventTarget {
  public readyState: number = 1; // 1 = OPEN
  public peer: LocalWebSocketPeer | null = null;

  public send(data: string): void {
    if (this.peer && this.peer.readyState === 1) {
      const event = new MessageEvent('message', { data });
      this.peer.dispatchEvent(event);
      if (typeof (this.peer as any).onmessage === 'function') {
        (this.peer as any).onmessage(event);
      }
    }
  }

  public close(): void {
    this.readyState = 3;
    if (this.peer && this.peer.readyState !== 3) {
      this.peer.readyState = 3;
      const closeEv = new Event('close');
      this.peer.dispatchEvent(closeEv);
      if (typeof (this.peer as any).onclose === 'function') {
        (this.peer as any).onclose(closeEv);
      }
    }
    const selfCloseEv = new Event('close');
    this.dispatchEvent(selfCloseEv);
    if (typeof (this as any).onclose === 'function') {
      (this as any).onclose(selfCloseEv);
    }
  }

  public accept(): void {
    this.readyState = 1;
  }
}

function createWebSocketPair(): [any, any] {
  if (typeof WebSocketPair !== 'undefined') {
    const pair = new WebSocketPair();
    return Object.values(pair) as [any, any];
  }
  const client = new LocalWebSocketPeer();
  const server = new LocalWebSocketPeer();
  client.peer = server;
  server.peer = client;
  return [client, server];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('room') || 'mmo-world-village';

  const upgradeHeader = req.headers.get('Upgrade') || req.headers.get('upgrade');
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    // If not a WebSocket upgrade request, return room health / WS info
    return NextResponse.json({
      status: 'active',
      transport: 'cloudflare-durable-object-websocket',
      roomId,
      timestamp: Date.now()
    });
  }

  // Authoritative user authentication
  let userId = 'anon';
  try {
    const user = await getChatGPTUser();
    if (user?.userId) userId = user.userId;
  } catch {
    // Fall back to anon or query param if available
  }
  const paramUser = searchParams.get('userId');
  if (paramUser && userId === 'anon') userId = paramUser;

  // Obtain or initialize the Durable Object for this room
  const roomDo = getOrCreateGameRoom(roomId);

  // Cloudflare native WebSocketPair connection
  const [clientWs, serverWs] = createWebSocketPair();

  // Accept the server-side socket
  if (typeof serverWs.accept === 'function') {
    serverWs.accept();
  }

  // Register socket with the room DO
  await roomDo.handleConnection(serverWs, userId);

  return new Response(null, {
    status: 101,
    webSocket: clientWs
  } as any);
}
