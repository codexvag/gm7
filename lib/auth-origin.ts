import { NextRequest } from 'next/server';

export function isOriginAllowed(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
    const requestHost = hostHeader.split(':')[0].toLowerCase();
    const originHost = originUrl.hostname.toLowerCase();

    // Direct hostname match (handles http/https proxying and ports)
    if (originHost === requestHost) return true;

    // Direct nextUrl origin match
    if (origin === req.nextUrl.origin) return true;

    // Production Render, Fly.io domains & local development
    if (
      originHost === 'localhost' ||
      originHost === '127.0.0.1' ||
      originHost.endsWith('.onrender.com') ||
      originHost.endsWith('.fly.dev')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
