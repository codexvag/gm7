import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now(),
    service: 'gm7-rpg'
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
