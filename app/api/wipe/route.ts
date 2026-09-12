// app/api/wipe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/lib/room-db';
import { initialState } from '@/lib/game-engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getChatGPTUser();
    const db = await database();
    if (user) {
      const userRooms = await db
        .prepare('SELECT room FROM members WHERE user=?')
        .bind(user.userId)
        .all<{ room: string }>();
      const roomIds = userRooms.results?.map((r: any) => r.room) || [];
      for (const roomId of roomIds) {
        await db.prepare('DELETE FROM members WHERE room=?').bind(roomId).run();
        await db.prepare('DELETE FROM rooms WHERE id=?').bind(roomId).run();
      }
      await db.prepare('DELETE FROM members WHERE user=?').bind(user.userId).run();
      await db.prepare('DELETE FROM rooms WHERE owner=?').bind(user.userId).run();

      // Seed brand new clean adventure room with ZERO characters
      const id = crypto.randomUUID();
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      const name = 'Vila do Rio Verde';
      const cleanState = initialState();
      await db.batch([
        db.prepare('INSERT INTO rooms(id,owner,name,state,code) VALUES(?,?,?,?,?)')
          .bind(id, user.userId, name, JSON.stringify(cleanState), code),
        db.prepare('INSERT INTO members(room,user) VALUES(?,?)').bind(id, user.userId)
      ]);
    }
    // Also clean local-hero fallback rooms
    await db.prepare('DELETE FROM members WHERE user=?').bind('local-hero').run();
    await db.prepare('DELETE FROM rooms WHERE owner=?').bind('local-hero').run();

    const res = NextResponse.redirect(new URL('/?wiped=1', req.url));
    if (user?.cookieHeaderValue) {
      res.headers.set('Set-Cookie', user.cookieHeaderValue);
    }
    return res;
  } catch {
    const res = NextResponse.redirect(new URL('/?wiped=1', req.url));
    return res;
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
