import { NextRequest, NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/lib/room-db';
import { isOriginAllowed } from '@/lib/auth-origin';
import {
  initialState,
  starterState,
  newCharacter,
  entry,
  validateCharacter,
  calculateEquippedStats,
  canLevelUp,
  getXpForNextLevel,
  isAsiLevel,
  getSpellSlotsForClass,
  classes,
  attack,
  resolveAttack,
  spendSpellSlot,
  shortRestHeal,
  d20,
  roll,
  mod,
  prof,
  locations,
  getGridDistance,
  validateAttackRange,
  validateSpellRange,
  validateMovement,
  ITEMS_CATALOG,
  type State,
  type Character,
  type GroundCorpse,
  type AttackResult,
  type Enemy
} from '@/lib/game-engine';
import { generateMobLoot, registerProceduralItem, type ProceduralItem } from '@/lib/procedural-items';
import { readCompactWorldContext, evaluateDirectorPacing, executeDirectorIntent } from '@/lib/sandbox-director';
import { isGridTileWalkable, MAP_COLLISION_PROFILES, type CollisionPolygon } from '@/lib/collision-system';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { emitRoomUpdate } from '@/lib/room-events';
import { touchChar } from '@/lib/state-merge';

const collisionZoneMemoryCache = new Map<string, { mtime: number; zones: CollisionPolygon[] }>();

function getActiveZonesForBiome(biome: string): CollisionPolygon[] | undefined {
  const profileKey = (biome === 'vila' ? 'village' : biome) as 'village' | 'forest' | 'dungeon';
  const fileName = `${profileKey === 'village' ? 'vila' : profileKey}-collision.json`;
  const candidates = [
    path.join(process.cwd(), 'public', 'maps', fileName),
    path.join('c:/gm/public/maps', fileName)
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        const cached = collisionZoneMemoryCache.get(p);
        if (cached && cached.mtime === stat.mtimeMs) {
          return cached.zones;
        }
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.zones)) {
          collisionZoneMemoryCache.set(p, { mtime: stat.mtimeMs, zones: parsed.zones });
          return parsed.zones;
        }
      }
    } catch {}
  }
  return MAP_COLLISION_PROFILES[profileKey]?.customZones;
}

type Room = { id: string; owner: string; name: string; state: string; version: number; code: string };

function withUserSession(res: NextResponse, user: { cookieHeaderValue?: string } | null): NextResponse {
  if (user?.cookieHeaderValue) {
    res.headers.set('Set-Cookie', user.cookieHeaderValue);
  }
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getChatGPTUser();
    if (!user) return NextResponse.json({ signedIn: false, rooms: [] });
    const db = await database();
    let rooms = await db
      .prepare('SELECT r.id,r.name FROM rooms r JOIN members m ON m.room=r.id WHERE m.user=?')
      .bind(user.userId)
      .all();
    const isWipe = req.nextUrl.searchParams.get('wipe') === '1';
    if (isWipe) {
      const userRooms = await db
        .prepare('SELECT room FROM members WHERE user=?')
        .bind(user.userId)
        .all<{ room: string }>();
      const roomIds = userRooms.results?.map((r) => r.room) || [];
      for (const roomId of roomIds) {
        await db.prepare('DELETE FROM members WHERE room=?').bind(roomId).run();
        await db.prepare('DELETE FROM rooms WHERE id=?').bind(roomId).run();
      }
      await db.prepare('DELETE FROM members WHERE user=?').bind(user.userId).run();
      await db.prepare('DELETE FROM rooms WHERE owner=?').bind(user.userId).run();
      rooms = { results: [], success: true, meta: {} } as any;
    }

    if (!rooms.results || rooms.results.length === 0) {
      const id = crypto.randomUUID();
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      const name = 'Vila do Rio Verde';
      await db.batch([
        db.prepare('INSERT INTO rooms(id,owner,name,state,code) VALUES(?,?,?,?,?)')
          .bind(id, user.userId, name, JSON.stringify(initialState()), code),
        db.prepare('INSERT INTO members(room,user) VALUES(?,?)').bind(id, user.userId)
      ]);
      rooms = await db
        .prepare('SELECT r.id,r.name FROM rooms r JOIN members m ON m.room=r.id WHERE m.user=?')
        .bind(user.userId)
        .all();
    }
    const MMO_ROOM_ID = 'mmo-world-village';
    const MMO_ROOM_NAME = 'ðŸŒ Aethelgard: Vila do Rio Verde (Mundo MMO)';

    const requestedId = req.nextUrl.searchParams.get('room');

    if (requestedId === MMO_ROOM_ID) {
      if (isWipe) {
        await db.prepare('UPDATE rooms SET state=?, version=version+1 WHERE id=?')
          .bind(JSON.stringify(initialState()), MMO_ROOM_ID)
          .run();
      }
      const existingMmo = await db.prepare('SELECT id FROM rooms WHERE id=?').bind(MMO_ROOM_ID).first();
      if (!existingMmo) {
        await db.prepare('INSERT INTO rooms(id,owner,name,state,code) VALUES(?,?,?,?,?)')
          .bind(MMO_ROOM_ID, 'world_server', MMO_ROOM_NAME, JSON.stringify(initialState()), 'mmo-village')
          .run();
      }
      await db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)')
        .bind(MMO_ROOM_ID, user.userId)
        .run();
    }

    const userRooms = (rooms.results || []) as { id: string; name: string }[];
    const roomList = userRooms.some((r) => r.id === MMO_ROOM_ID)
      ? userRooms
      : [{ id: MMO_ROOM_ID, name: MMO_ROOM_NAME }, ...userRooms];

    const targetId = requestedId || (userRooms[0] ? (userRooms[0].id as string) : null);
    let room: Room | null = null;
    if (targetId) {
      room = await db
        .prepare('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?')
        .bind(targetId, user.userId)
        .first<Room>();

      if (!room) {
        const existing = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(targetId).first<Room>();
        if (existing) {
          await db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)')
            .bind(targetId, user.userId)
            .run();
          room = existing;
        }
      }
    }

    if (!room && userRooms[0]) {
      room = await db
        .prepare('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?')
        .bind(userRooms[0].id, user.userId)
        .first<Room>();
    }

    if (!room) {
      const id = requestedId || crypto.randomUUID();
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      const name = 'Vila do Rio Verde';
      const freshState = initialState();
      await db.batch([
        db.prepare('INSERT OR REPLACE INTO rooms(id,owner,name,state,code,version) VALUES(?,?,?,?,?,?)')
          .bind(id, user.userId, name, JSON.stringify(freshState), code, 0),
        db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)')
          .bind(id, user.userId)
      ]);
      room = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(id).first<Room>();
    }
    let parsedState = room ? JSON.parse(room.state) : null;
    if (parsedState && room?.id === MMO_ROOM_ID && Array.isArray(parsedState.characters)) {
      const now = Date.now();
      const initialCount = parsedState.characters.length;
      parsedState.characters = parsedState.characters.filter((ch: Character) => {
        if (ch.owner === user.userId) return true;
        if (!ch.lastSeen) return true;
        return (now - ch.lastSeen) < 60000;
      });
      if (parsedState.characters.length !== initialCount) {
        void db.prepare('UPDATE rooms SET state=? WHERE id=?')
          .bind(JSON.stringify(parsedState), MMO_ROOM_ID)
          .run()
          .catch(() => {});
      }
    }

    return withUserSession(NextResponse.json({
      signedIn: true,
      user: user.userId,
      rooms: roomList,
      room: room ? { ...room, state: parsedState } : null
    }), user);
  } catch (err) {
    console.error('[GET /api/game Error]:', err);
    return NextResponse.json({ error: 'NÃ£o foi possÃ­vel carregar a mesa. Tente novamente.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getChatGPTUser>> = null;
  try {
    user = await getChatGPTUser();
    if (!user) return NextResponse.json({ error: 'Entre para salvar sua aventura.' }, { status: 401 });
    if (!isOriginAllowed(req)) {
      return NextResponse.json({ error: 'Origem invÃ¡lida.' }, { status: 403 });
    }
    const raw = await req.text();
    if (raw.length > 100000) throw Error('Dados muito grandes.');
    const a = JSON.parse(raw);
    const db = await database();

    if (a.action === 'wipe' || a.action === 'resetAll') {
      const userRooms = await db
        .prepare('SELECT room FROM members WHERE user=?')
        .bind(user.userId)
        .all<{ room: string }>();
      const roomIds = userRooms.results?.map((r) => r.room) || [];
      for (const roomId of roomIds) {
        await db.prepare('DELETE FROM members WHERE room=?').bind(roomId).run();
        await db.prepare('DELETE FROM rooms WHERE id=?').bind(roomId).run();
      }
      await db.prepare('DELETE FROM members WHERE user=?').bind(user.userId).run();
      await db.prepare('DELETE FROM rooms WHERE owner=?').bind(user.userId).run();

      const id = crypto.randomUUID();
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      const name = 'Vila do Rio Verde';
      const freshState = initialState();
      await db.batch([
        db.prepare('INSERT INTO rooms(id,owner,name,state,code) VALUES(?,?,?,?,?)')
          .bind(id, user.userId, name, JSON.stringify(freshState), code),
        db.prepare('INSERT INTO members(room,user) VALUES(?,?)').bind(id, user.userId)
      ]);
      return withUserSession(NextResponse.json({
        ok: true,
        id,
        room: {
          id,
          owner: user.userId,
          name,
          code,
          version: 1,
          state: freshState
        }
      }), user);
    }

    if (a.action === 'create') {
      const id = crypto.randomUUID();
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      const name = String(a.name || 'Vila do Rio Verde').slice(0, 80);
      await db.batch([
        db.prepare('INSERT INTO rooms(id,owner,name,state,code) VALUES(?,?,?,?,?)')
          .bind(id, user.userId, name, JSON.stringify(initialState()), code),
        db.prepare('INSERT INTO members(room,user) VALUES(?,?)').bind(id, user.userId)
      ]);
      return withUserSession(NextResponse.json({ id }), user);
    }

    if (a.action === 'join') {
      const room = await db.prepare('SELECT id FROM rooms WHERE code=?').bind(String(a.code).trim()).first<{ id: string }>();
      if (!room) throw Error('CÃ³digo de convite invÃ¡lido.');
      await db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)').bind(room.id, user.userId).run();
      return withUserSession(NextResponse.json({ id: room.id }), user);
    }

    if (a.room === 'mmo-world-village') {
      const existingMmo = await db.prepare('SELECT id FROM rooms WHERE id=?').bind('mmo-world-village').first();
      if (!existingMmo) {
        await db.prepare('INSERT INTO rooms(id,owner,name,state,code) VALUES(?,?,?,?,?)')
          .bind('mmo-world-village', 'world_server', 'ðŸŒ Aethelgard: Vila do Rio Verde (Mundo MMO)', JSON.stringify(initialState()), 'mmo-village')
          .run();
      }
      await db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)')
        .bind('mmo-world-village', user.userId)
        .run();
    }

    const requestedRoomId = typeof a.room === 'string' && a.room.trim() ? a.room.trim() : null;
    let r: Room | null = null;

    if (requestedRoomId) {
      r = await db
        .prepare('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?')
        .bind(requestedRoomId, user.userId)
        .first<Room>();

      if (!r) {
        const existing = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(requestedRoomId).first<Room>();
        if (existing) {
          await db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)')
            .bind(requestedRoomId, user.userId)
            .run();
          r = existing;
        }
      }
    }

    if (!r) {
      // Look for any existing room the user is a member of
      r = await db
        .prepare('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE m.user=? ORDER BY r.rowid DESC')
        .bind(user.userId)
        .first<Room>();
    }

    if (!r) {
      // Auto-create room for the user to guarantee it exists
      const id = requestedRoomId || crypto.randomUUID();
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
      const name = 'Vila do Rio Verde';
      const freshState = initialState();
      await db.batch([
        db.prepare('INSERT OR REPLACE INTO rooms(id,owner,name,state,code,version) VALUES(?,?,?,?,?,?)')
          .bind(id, user.userId, name, JSON.stringify(freshState), code, 0),
        db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)')
          .bind(id, user.userId)
      ]);
      r = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(id).first<Room>();
    }

    if (!r) {
      return withUserSession(NextResponse.json({ error: 'Mesa indisponÃ­vel no momento.' }, { status: 503 }), user);
    }

    const isMmo = r.id === 'mmo-world-village';
    if (a.version !== undefined && r.version !== a.version && a.action !== 'character' && !isMmo && a.action !== 'move' && a.action !== 'pass' && a.action !== 'location' && a.action !== 'attack' && a.action !== 'check' && a.action !== 'useItem' && a.action !== 'respawn') {
      return withUserSession(NextResponse.json({
        error: 'A mesa mudou. Os dados foram atualizados; tente sua aÃ§Ã£o novamente.',
        room: { ...r, state: JSON.parse(r.state) }
      }, { status: 409 }), user);
    }

    let s: State = JSON.parse(r.state);
    const currentUserId = user?.userId;
    const owner = isMmo || (currentUserId ? r.owner === currentUserId : false);

    // Prune stale characters in MMO world (inactivity > 60s)
    if (isMmo && Array.isArray(s.characters)) {
      const now = Date.now();
      s.characters = s.characters.filter((ch: Character) => {
        if (currentUserId && ch.owner === currentUserId) return true;
        if (!ch.lastSeen) return true;
        return (now - ch.lastSeen) < 60000;
      });
    }

    let c = s.characters.find((c) => c.id === a.character);
    // If c does not belong to user in MMO, or if c was not found, auto-find user's own character!
    if ((!c || (isMmo && c.owner && c.owner !== user!.userId)) && s.characters.length > 0) {
      const userChar = s.characters.find((ch) => ch.owner === user!.userId);
      if (userChar) {
        c = userChar;
        a.character = userChar.id;
      } else if (!c) {
        c = s.characters.find((ch) => !ch.owner || ch.owner === user!.userId) || s.characters[0];
        if (c) a.character = c.id;
      }
    }
    if (c && (c.owner === user!.userId || !c.owner)) {
      touchChar(c);
    }
    const own = () => {
      if (!c) throw Error('Personagem nÃ£o encontrado.');
      if (isMmo) {
        if (c.owner && c.owner !== user!.userId) throw Error('Escolha um personagem seu.');
      } else if (!owner && c.owner !== user!.userId) {
        throw Error('Escolha um personagem seu.');
      }
      return c;
    };
    const gm = () => {
      if (!owner && !isMmo) throw Error('Somente o anfitriÃ£o pode realizar esta aÃ§Ã£o.');
    };
    const log = (text: string, kind: 'gm' | 'roll' | 'player' | 'system' = 'system') =>
      s.logs.push(entry(text, kind));

    let clientAttackResult: AttackResult | null = null;
    let clientHealResult: { targetId: string; targetName: string; healAmount: number; hpAfter: number; maxHp: number } | null = null;

    switch (a.action) {
      case 'character': {
        const rawChar = (a.value || a.character) as Character;
        const old = s.characters.find((x) => x.id === rawChar?.id);
        const isEquipmentUpdate = Boolean(old && JSON.stringify(old.equipment) !== JSON.stringify(rawChar?.equipment));
        const isHpOrConditionUpdate = Boolean(old && (old.hp !== rawChar?.hp || JSON.stringify(old.conditions) !== JSON.stringify(rawChar?.conditions)));
        if (s.combat && !isEquipmentUpdate && !isHpOrConditionUpdate && !owner) throw Error('Encerre o combate antes de editar atributos da ficha.');
        let next = validateCharacter(rawChar);
        next = calculateEquippedStats(next);
        touchChar(next);
        if (old && (isMmo ? old.owner && old.owner !== user.userId : (!owner && old.owner !== user.userId))) {
          throw Error('Esta ficha pertence a outro jogador.');
        }
        if (old) {
          s.characters = s.characters.map((x) =>
  x.id === old.id
    ? {
        ...next,
        id: old.id,
        owner: old.owner,
        x: old.x,
        y: old.y,
      }
    : x
);
        } else {
          if (isMmo) {
            const existing = s.characters.find((x) => x.owner === user!.userId);
            if (existing) {
              s.characters = s.characters.map((x) => (x.id === existing.id ? { ...next, id: existing.id, owner: existing.owner } : x));
              log(`${next.name} atualizou sua ficha de aventureiro.`);
              break;
            }
          }
          const maxChars = isMmo ? 32 : 12;
          if (s.characters.length >= maxChars) throw Error(`Limite de ${maxChars} personagens atingido.`);
          s.characters.push({ ...next, id: next.id || crypto.randomUUID(), owner: user!.userId });
        }
        log(`${next.name} ${old ? (isEquipmentUpdate ? 'ajustou seus equipamentos' : 'atualizou sua ficha') : 'entrou na aventura'}.`);
        break;
      }
      case 'roll': {
        const result = roll(String(a.formula));
        log(`${user.displayName}: ${a.formula} â†’ [${result.results.join(', ')}] ${result.bonus ? '+ (' + result.bonus + ') ' : ''}= ${result.total}`, 'roll');
        break;
      }
      case 'check': {
        const p = own();
        const ability = Number(a.ability);
        if (!Number.isInteger(ability) || ability < 0 || ability > 5) throw Error('Atributo invÃ¡lido.');
        const result = d20(a.mode);
        const bonus =
          mod(p.stats[ability]) +
          (a.skill && p.skills.includes(a.skill) ? prof(p.level) : 0) +
          (a.skill && p.expertise.includes(a.skill) ? prof(p.level) : 0) -
          2 * p.exhaustion;
        log(`${p.name}: ${String(a.label).slice(0, 60)} [${result.dice.join(', ')}] ${bonus >= 0 ? '+' : ''}${bonus} = ${result.raw + bonus}`, 'roll');
        break;
      }
      case 'encounter': {
        gm();
        if (s.combat) throw Error('JÃ¡ existe um combate em andamento.');
        if (!s.characters.some((x) => x.hp > 0)) throw Error('Crie um personagem consciente primeiro.');
        s.enemies = [
          {
            id: crypto.randomUUID(),
            name: 'Sentinela de Cinzas',
            hp: 9,
            maxHp: 9,
            ac: 11,
            attack: 2,
            damage: '1d4+1',
            initiative: d20().raw + 1,
            x: 7,
            y: 3
          }
        ];
        for (const p of s.characters) p.initiative = d20().raw + mod(p.stats[1]) + 3 - 2 * p.exhaustion; // +3 hero preparation bonus
        for (const p of s.characters) touchChar(p);
        for (const e of s.enemies) touchChar(e);
        s.order = [...s.characters.filter((x) => x.hp > 0), ...s.enemies]
          .sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id))
          .map((x) => x.id);
        s.combat = true;
        s.round = 1;
        s.turn = 0;
        s.actionUsed = false;
        log(
          'Combate iniciado! Iniciativa 5e: ' +
            s.order
              .map((id) => {
                const x = [...s.characters, ...s.enemies].find((x) => x.id === id)!;
                return x.name + ' (' + x.initiative + ')';
              })
              .join(' â€¢ '),
          'roll'
        );
        executeEnemyAI(s);
        break;
      }
      case 'startCombat': {
        const p = own();
        s.combat = true;
        s.combatMode = 'tactical';
        s.round = 1;
        const partyMembers = p.partyId
          ? s.characters.filter((c) => c.partyId === p.partyId && c.hp > 0)
          : [p];
        s.combatPartyId = p.partyId || p.id;

        for (const char of partyMembers) {
          char.initiative = d20().raw + mod(char.stats[1]) + 3 - 2 * (char.exhaustion || 0);
          touchChar(char);
        }

        const livingEnemies = s.enemies.filter((e) => e.hp > 0);
        for (const enemy of livingEnemies) {
          enemy.initiative = d20().raw + 1;
          touchChar(enemy);
        }

        s.order = [...partyMembers, ...livingEnemies]
          .sort((a, b) => (b.initiative || 0) - (a.initiative || 0) || a.id.localeCompare(b.id))
          .map((x) => x.id);

        s.turn = 0;
        s.actionUsed = false;
        s.movementUsed = 0;
        log(
          `⚔️ Batalha Tática Iniciada! Ordem de Iniciativa 5e: ` +
            s.order
              .map((id) => {
                const x = [...s.characters, ...s.enemies].find((x) => x.id === id);
                return x ? `${x.name} (${x.initiative})` : id;
              })
              .join(' • '),
          'roll'
        );
        executeEnemyAI(s);
        break;
      }
      case 'joinCombat': {
        const p = own();
        if (!s.combat) throw Error('Não há batalha tática ativa no momento.');
        if (s.order.includes(p.id)) throw Error(`${p.name} já está participando desta batalha.`);

        p.initiative = d20().raw + mod(p.stats[1]) - 2 * (p.exhaustion || 0);
        touchChar(p);

        let insertIdx = s.order.length;
        for (let i = 0; i < s.order.length; i++) {
          const actor = [...s.characters, ...s.enemies].find((x) => x.id === s.order[i]);
          const init = actor ? (actor.initiative || 0) : 0;
          if (p.initiative > init) {
            insertIdx = i;
            break;
          }
        }
        s.order.splice(insertIdx, 0, p.id);
        if (insertIdx <= s.turn) {
          s.turn++;
        }
        log(`🛡️ ${p.name} entrou na batalha com o grupo! Iniciativa rolada: ${p.initiative}`, 'roll');
        break;
      }
      case 'attack': {
        const p = own();
        if (p.hp <= 0) throw Error('Este personagem está inconsciente.');

        // If player explicitly wants to start tactical battle on attack
        if (a.startTactical && !s.combat) {
          s.combat = true;
          s.combatMode = 'tactical';
          s.round = 1;
          const partyMembers = p.partyId
            ? s.characters.filter((c) => c.partyId === p.partyId && c.hp > 0)
            : [p];
          s.combatPartyId = p.partyId || p.id;
          for (const char of partyMembers) {
            char.initiative = d20().raw + mod(char.stats[1]) + 3 - 2 * (char.exhaustion || 0);
            touchChar(char);
          }
          for (const enemy of s.enemies.filter((e) => e.hp > 0)) {
            enemy.initiative = d20().raw + 1;
            touchChar(enemy);
          }
          s.order = [...partyMembers, ...s.enemies.filter((e) => e.hp > 0)]
            .sort((a, b) => (b.initiative || 0) - (a.initiative || 0) || a.id.localeCompare(b.id))
            .map((x) => x.id);
          s.turn = s.order.indexOf(p.id);
          if (s.turn === -1) {
            s.order.unshift(p.id);
            s.turn = 0;
          }
          s.actionUsed = false;
          log(`⚔️ ${p.name} iniciou o combate tático de grupo!`, 'roll');
        } else if (s.combat) {
          // If already in tactical combat, check if hero is in the order
          if (!s.order.includes(p.id)) {
            // Seamless join
            p.initiative = d20().raw + mod(p.stats[1]) - 2 * (p.exhaustion || 0);
            touchChar(p);
            let insertIdx = s.order.length;
            for (let i = 0; i < s.order.length; i++) {
              const actor = [...s.characters, ...s.enemies].find((x) => x.id === s.order[i]);
              const init = actor ? (actor.initiative || 0) : 0;
              if (p.initiative > init) {
                insertIdx = i;
                break;
              }
            }
            s.order.splice(insertIdx, 0, p.id);
            if (insertIdx <= s.turn) s.turn++;
            log(`⚔️ ${p.name} atacou e entrou na iniciativa da batalha! (Iniciativa: ${p.initiative})`, 'roll');
          }

          // Strict D&D 5e Action Economy enforcement for combatants
          const curTurnId = s.order[s.turn];
          if (curTurnId && curTurnId !== p.id) {
            const activeCreature = [...s.characters, ...s.enemies].find((x) => x.id === curTurnId);
            throw Error(`Não é o turno de ${p.name}. Turno atual: ${activeCreature ? activeCreature.name : 'Inimigo'}.`);
          }
          if (s.actionUsed) {
            throw Error('Você já utilizou sua Ação neste turno. Mova-se pelo terreno ou clique em "Fim do Turno" para passar a vez.');
          }
        }

        // Resilient target selection: exact target or fallback to closest living enemy
        let targetId = a.target || a.targetId;
        let target = s.enemies.find((e) => e.id === targetId && e.hp > 0);
        if (!target) {
          const living = s.enemies.filter((e) => e.hp > 0);
          if (living.length > 0) {
            target = living.sort((a, b) => {
              const distA = Math.hypot(p.x - a.x, p.y - a.y);
              const distB = Math.hypot(p.x - b.x, p.y - b.y);
              return distA - distB;
            })[0];
          }
        }
        if (!target) throw Error('Nenhum alvo inimigo ativo encontrado na área.');

        // Server-Authoritative Spatial Range Validation
        const rangeCheck = validateAttackRange(p, target);
        if (!rangeCheck.inRange) {
          throw Error(`Alvo fora do alcance da arma (${rangeCheck.distance} quadrados / ${(rangeCheck.distance * 1.5).toFixed(1)}m). Alcance máximo: ${rangeCheck.maxRange} quadrado(s).`);
        }

        // Server authoritative SRD attack resolution
        const dmgFormula = String(a.damageFormula || p.damage);
        const attackBonus = p.attack - 2 * (p.exhaustion || 0);
        const res = resolveAttack(
          { name: p.name, attack: attackBonus, damage: dmgFormula, conditions: p.conditions },
          { id: target.id, name: target.name, ac: target.ac, hp: target.hp, conditions: target.conditions },
          a.mode
        );
        clientAttackResult = res;
        target.hp = res.hpAfter;
        touchChar(target);
        if (s.combat) {
          s.actionUsed = true;
        }
        log(res.text, 'roll');

        // Free Open World Combat: if enemy survived, counter-attacks immediately!
        if (!s.combat && target.hp > 0) {
          executeSingleEnemyRevenge(target, p, s);
        }

        if (target.hp <= 0) {
          log(`💀 ${target.name} foi derrotado!`, 'gm');
          const xpReward = target.name.includes('Malakor') ? 500 : target.name.includes('Guardião') ? 250 : 150;
          if (isMmo) {
            const recipients = p.partyId
              ? s.characters.filter((char) => char.partyId === p.partyId)
              : [p];
            for (const char of recipients) {
              char.xp = (char.xp || 0) + xpReward;
              touchChar(char);
            }
            log(`✨ ${p.partyId ? 'O grupo de ' + p.name : p.name + ' (Solo)'} recebeu +${xpReward} XP pela vitória contra ${target.name}!`, 'gm');
          } else {
            for (const char of s.characters) {
              char.xp = (char.xp || 0) + xpReward;
              touchChar(char);
            }
            log(`✨ Os heróis receberam +${xpReward} XP pela vitória contra ${target.name}!`, 'gm');
          }

          // Spawn interactive lootable corpse
          try {
            const mobLoot = generateMobLoot(target.name, target.maxHp || 10, (s.act || 1) as any);
            if (!s.corpses) s.corpses = [];
            const corpse: GroundCorpse = {
              id: `corpse-${target.id}-${Date.now()}`,
              name: `Restos de ${target.name}`,
              enemyName: target.name,
              x: target.x ?? 4,
              y: target.y ?? 4,
              gold: mobLoot.gold,
              items: mobLoot.items.map((it) => it.id),
              biome: s.biome,
              slainBy: p.name,
              createdAt: Date.now()
            };
            s.corpses.push(corpse);
            log(`💀 ${target.name} tombou no chão [X:${corpse.x} Y:${corpse.y}]! Deixou ${corpse.gold} PO${mobLoot.items.length ? ' e ' + mobLoot.items.map((it) => it.name).join(', ') : ''}. Aproxime-se para saquear!`, 'gm');
          } catch (err) {
            console.error('[Corpse spawn error]:', err);
          }
        }

        if (s.enemies.length > 0 && s.enemies.every((e) => e.hp <= 0)) {
          if (!s.questProgress) s.questProgress = {};
          if (s.biome === 'forest' || s.location === 1) {
            s.questProgress.forest_cleared = true;
          } else if (s.biome === 'dungeon' || s.location === 2) {
            s.questProgress.malakor_defeated = true;
          }
          s.combat = false;
          s.actionUsed = false;
          log('âš”ï¸ Todos os inimigos foram vencidos! VitÃ³ria do grupo!', 'gm');
        }

        // If client specified immediate end of turn, advance
        if (a.endTurn) {
          s.actionUsed = false;
          advance(s);
          executeEnemyAI(s);
        }
        break;
      }
      case 'spell': {
        const p = own();
        if (p.hp <= 0) throw Error('Este personagem está inconsciente.');

        if (a.startTactical && !s.combat) {
          s.combat = true;
          s.combatMode = 'tactical';
          s.round = 1;
          const partyMembers = p.partyId
            ? s.characters.filter((c) => c.partyId === p.partyId && c.hp > 0)
            : [p];
          s.combatPartyId = p.partyId || p.id;
          for (const char of partyMembers) {
            char.initiative = d20().raw + mod(char.stats[1]) + 3 - 2 * (char.exhaustion || 0);
            touchChar(char);
          }
          for (const enemy of s.enemies.filter((e) => e.hp > 0)) {
            enemy.initiative = d20().raw + 1;
            touchChar(enemy);
          }
          s.order = [...partyMembers, ...s.enemies.filter((e) => e.hp > 0)]
            .sort((a, b) => (b.initiative || 0) - (a.initiative || 0) || a.id.localeCompare(b.id))
            .map((x) => x.id);
          s.turn = s.order.indexOf(p.id);
          if (s.turn === -1) {
            s.order.unshift(p.id);
            s.turn = 0;
          }
          s.actionUsed = false;
          log(`✨ ${p.name} iniciou combate tático com magia!`, 'roll');
        } else if (s.combat) {
          if (!s.order.includes(p.id)) {
            p.initiative = d20().raw + mod(p.stats[1]) - 2 * (p.exhaustion || 0);
            touchChar(p);
            let insertIdx = s.order.length;
            for (let i = 0; i < s.order.length; i++) {
              const actor = [...s.characters, ...s.enemies].find((x) => x.id === s.order[i]);
              const init = actor ? (actor.initiative || 0) : 0;
              if (p.initiative > init) {
                insertIdx = i;
                break;
              }
            }
            s.order.splice(insertIdx, 0, p.id);
            if (insertIdx <= s.turn) s.turn++;
            log(`✨ ${p.name} conjurou magia e entrou na iniciativa da batalha! (Iniciativa: ${p.initiative})`, 'roll');
          }

          const curTurnId = s.order[s.turn];
          if (curTurnId && curTurnId !== p.id) {
            const activeCreature = [...s.characters, ...s.enemies].find((x) => x.id === curTurnId);
            throw Error(`Não é o turno de ${p.name}. Turno atual: ${activeCreature ? activeCreature.name : 'Inimigo'}.`);
          }
          if (s.actionUsed) {
            throw Error('Você já utilizou sua Ação neste turno. Mova-se pelo terreno ou clique em "Fim do Turno" para passar a vez.');
          }
        }

        const spellLevel = Number(a.spellLevel || 0);
        const spellName = String(a.spellName || 'Magia');

        if (spellLevel > 0) {
          const spent = spendSpellSlot(p, spellLevel);
          if (!spent) {
            throw Error(`Sem espaços de magia de nível ${spellLevel} restantes para ${p.name}!`);
          }
        }

        const targetId = a.target || a.targetId;
        if (targetId) {
          let target = s.enemies.find((e) => e.id === targetId && e.hp > 0);
          if (!target) {
            const living = s.enemies.filter((e) => e.hp > 0);
            if (living.length > 0) {
              target = living.sort((a, b) => {
                const distA = Math.hypot(p.x - a.x, p.y - a.y);
                const distB = Math.hypot(p.x - b.x, p.y - b.y);
                return distA - distB;
              })[0];
            }
          }
          if (!target) throw Error('Nenhum alvo inimigo ativo encontrado na área.');

          // Server-Authoritative Spell Range Validation
          const rangeCheck = validateSpellRange(p, target, spellName);
          if (!rangeCheck.inRange) {
            throw Error(`Alvo fora do alcance da magia (${rangeCheck.distance} quadrados / ${(rangeCheck.distance * 1.5).toFixed(1)}m). Alcance máximo: ${rangeCheck.maxRange} quadrados.`);
          }
          const dmgFormula = String(a.damageFormula || '1d10');
          const spellAtkBonus = prof(p.level) + mod(p.stats[p.spellAbility || 3]) - 2 * (p.exhaustion || 0);
          const res = resolveAttack(
            { name: p.name, attack: spellAtkBonus, damage: dmgFormula, conditions: p.conditions },
            { id: target.id, name: target.name, ac: target.ac, hp: target.hp, conditions: target.conditions },
            a.mode
          );
          clientAttackResult = res;
          target.hp = res.hpAfter;
          touchChar(target);
          if (s.combat) {
            s.actionUsed = true;
          }
          log(`✨ [${spellName}${spellLevel > 0 ? ' • Nível ' + spellLevel : ' • Truque'}] ${res.text}`, 'roll');

          // Free Open World: retaliation
          if (!s.combat && target.hp > 0) {
            executeSingleEnemyRevenge(target, p, s);
          }

          if (target.hp <= 0) {
            log(`💀 ${target.name} foi derrotado pela magia!`, 'gm');
            const xpReward = target.name.includes('Malakor') ? 500 : target.name.includes('Guardião') ? 250 : 150;
            if (isMmo) {
              const recipients = p.partyId
                ? s.characters.filter((char) => char.partyId === p.partyId)
                : [p];
              for (const char of recipients) {
                char.xp = (char.xp || 0) + xpReward;
                touchChar(char);
              }
              log(`✨ ${p.partyId ? 'O grupo de ' + p.name : p.name + ' (Solo)'} recebeu +${xpReward} XP pela vitória contra ${target.name}!`, 'gm');
            } else {
              for (const char of s.characters) {
                char.xp = (char.xp || 0) + xpReward;
                touchChar(char);
              }
              log(`✨ Os heróis receberam +${xpReward} XP pela vitória contra ${target.name}!`, 'gm');
            }

            // Spawn interactive lootable corpse
            try {
              const mobLoot = generateMobLoot(target.name, target.maxHp || 10, (s.act || 1) as any);
              if (!s.corpses) s.corpses = [];
              const corpse: GroundCorpse = {
                id: `corpse-${target.id}-${Date.now()}`,
                name: `Restos de ${target.name}`,
                enemyName: target.name,
                x: target.x ?? 4,
                y: target.y ?? 4,
                gold: mobLoot.gold,
                items: mobLoot.items.map((it) => it.id),
                biome: s.biome,
                slainBy: p.name,
                createdAt: Date.now()
              };
              s.corpses.push(corpse);
              log(`💀 ${target.name} tombou no chão [X:${corpse.x} Y:${corpse.y}]! Deixou ${corpse.gold} PO${mobLoot.items.length ? ' e ' + mobLoot.items.map((it) => it.name).join(', ') : ''}. Aproxime-se para saquear!`, 'gm');
            } catch (err) {
              console.error('[Corpse spawn error]:', err);
            }
          }

          if (s.enemies.length > 0 && s.enemies.every((e) => e.hp <= 0)) {
            if (!s.questProgress) s.questProgress = {};
            if (s.biome === 'forest' || s.location === 1) {
              s.questProgress.forest_cleared = true;
            } else if (s.biome === 'dungeon' || s.location === 2) {
              s.questProgress.malakor_defeated = true;
            }
            s.combat = false;
            s.actionUsed = false;
            log('âš”ï¸ Todos os inimigos foram vencidos! VitÃ³ria do grupo!', 'gm');
          }
        } else if (a.healFormula) {
          const targetChar = s.characters.find((c) => c.id === (a.targetId || p.id));
          if (!targetChar) throw Error('Alvo invÃ¡lido para cura.');
          const healRoll = roll(a.healFormula);
          const oldHp = targetChar.hp;
          targetChar.hp = Math.min(targetChar.maxHp, targetChar.hp + healRoll.total);
          touchChar(targetChar);
          const healed = targetChar.hp - oldHp;
          clientHealResult = {
            targetId: targetChar.id,
            targetName: targetChar.name,
            healAmount: healed,
            hpAfter: targetChar.hp,
            maxHp: targetChar.maxHp
          };
          s.actionUsed = true;
          log(`âœ¨ ${p.name} conjurou ${spellName} em ${targetChar.name}: [${healRoll.results.join(', ')}] + ${healRoll.bonus} = recuperou ${healed} PV! (${targetChar.hp}/${targetChar.maxHp} PV)`, 'roll');
        } else {
          s.actionUsed = true;
          log(`âœ¨ ${p.name} conjurou ${spellName}${spellLevel > 0 ? ' (EspaÃ§o de nÃ­vel ' + spellLevel + ' gasto)' : ''}.`, 'roll');
        }

        if (a.endTurn && s.combat) {
          s.actionUsed = false;
          advance(s);
          executeEnemyAI(s);
        }
        break;
      }
      case 'useItem': {
        const p = own();
        const itemId = String(a.itemId || 'pocao-cura');
        const targetId = a.targetId || p.id;
        const targetChar = s.characters.find((x) => x.id === targetId);
        if (!targetChar) throw Error('Alvo invÃ¡lido para o item.');
        if (targetChar.id !== p.id && getGridDistance(p, targetChar) > 1) {
          throw Error(`Alvo muito distante para aplicar o item. Alcance de toque: 1 quadrado (1.5m).`);
        }

        if (s.combat) {
          const curTurnId = s.order[s.turn];
          if (curTurnId && curTurnId !== p.id) {
            throw Error(`NÃ£o Ã© o turno de ${p.name}. Aguarde sua vez na ordem de iniciativa.`);
          }
          if (s.actionUsed) {
            throw Error('VocÃª jÃ¡ utilizou sua AÃ§Ã£o neste turno. Mova-se ou passe o turno.');
          }
          s.actionUsed = true;
        }

        let healRoll = { total: 0, results: [0], bonus: 0 };
        let itemName = 'PoÃ§Ã£o de Cura';
        if (itemId === 'pocao-cura-maior') {
          healRoll = roll('4d4+4');
          itemName = 'PoÃ§Ã£o de Cura Maior';
        } else {
          healRoll = roll('2d4+2');
        }

        const healAmount = healRoll.total;
        const oldHp = targetChar.hp;
        targetChar.hp = Math.min(targetChar.maxHp, targetChar.hp + healAmount);
        touchChar(targetChar);
        const actualHealed = targetChar.hp - oldHp;

        log(
          `${p.name} consumiu ${itemName} em ${targetChar.name}: [${healRoll.results.join(', ')}] + ${healRoll.bonus} = recuperou ${actualHealed} PV! (${targetChar.hp}/${targetChar.maxHp} PV)`,
          'roll'
        );

        clientHealResult = {
          targetId: targetChar.id,
          targetName: targetChar.name,
          healAmount: actualHealed,
          hpAfter: targetChar.hp,
          maxHp: targetChar.maxHp
        };

        if (a.endTurn && s.combat) {
          s.actionUsed = false;
          advance(s);
          executeEnemyAI(s);
        }
        break;
      }
      case 'lootCorpse': {
        const p = own();
        const corpseId = String(a.corpseId || '');
        if (!s.corpses) s.corpses = [];
        const corpseIndex = s.corpses.findIndex((c) => c.id === corpseId);
        if (corpseIndex === -1) throw Error('Corpo ou restos não encontrados (já foram saqueados).');
        const corpse = s.corpses[corpseIndex];

        // Adjacent distance check (up to 1 square distance, including diagonal)
        const dx = Math.abs(p.x - corpse.x);
        const dy = Math.abs(p.y - corpse.y);
        if (dx > 1 || dy > 1) {
          throw Error(`Você está muito distante dos restos de ${corpse.enemyName}. Aproxime-se a 1 quadrado (1.5m) para saquear.`);
        }

        // Transfer gold
        const lootedGold = corpse.gold || 0;
        p.gold = (p.gold || 0) + lootedGold;

        // Transfer items into hero inventory
        const lootedItemNames: string[] = [];
        for (const itemId of corpse.items) {
          const itemDef = ITEMS_CATALOG[itemId];
          const itemName = itemDef ? itemDef.name : itemId;
          lootedItemNames.push(itemName);
          p.inventory = p.inventory ? `${p.inventory}\n${itemName}` : itemName;
        }

        touchChar(p);
        s.corpses.splice(corpseIndex, 1);

        log(`💰 ${p.name} saqueou os restos de ${corpse.enemyName}: +${lootedGold} PO${lootedItemNames.length ? ' e obteve [' + lootedItemNames.join(', ') + ']' : ''}!`, 'player');
        break;
      }
      case 'enemy': {
        gm();
        executeEnemyAI(s);
        break;
      }
      case 'pass': {
        const activeChar = s.characters.find((x) => x.id === s.order[s.turn]);
        if (activeChar) {
          if (a.character) {
            const p = own();
            if (p.id !== activeChar.id) throw Error('NÃ£o Ã© seu turno.');
          } else {
            if (!isMmo && !owner && activeChar.owner && activeChar.owner !== user.userId) {
              throw Error('Aguarde o jogador ativo passar a vez.');
            }
          }
        } else {
          gm();
        }
        log(`Turno de ${activeChar?.name || c?.name || 'criatura'} concluÃ­do.`);
        s.actionUsed = false;
        advance(s);
        executeEnemyAI(s);
        break;
      }
      case 'endCombat': {
        gm();
        s.combat = false;
        s.order = [];
        s.actionUsed = false;
        log('O anfitriÃ£o encerrou o combate.');
        break;
      }
      case 'move': {
        const p = own();
        const x = Number(a.x);
        const y = Number(a.y);
        const biome = (s.biome || 'village') as 'village' | 'forest' | 'dungeon';
        const defaultBound = biome === 'village' ? 7 : 15;
        const maxBound = Number(a.maxBound ?? defaultBound);
        const validation = validateMovement(p, { x, y }, s, maxBound);
        if (!validation.valid) {
          throw Error(validation.reason || 'PosiÃ§Ã£o invÃ¡lida.');
        }

        // Server-Side Obstacle Collision Validation
        const gridSize = a.gridSize ? Number(a.gridSize) : maxBound + 1;
        const activeZones = getActiveZonesForBiome(biome);
        if (!isGridTileWalkable(biome, x, y, gridSize, activeZones)) {
          throw Error('Destino intransponÃ­vel ou bloqueado por obstÃ¡culo.');
        }

        p.x = x;
        p.y = y;
        touchChar(p);
        if (s.combat) {
          s.movementUsed = (s.movementUsed || 0) + validation.distance;
        }
        break;
      }
      case 'shortRest': {
        if (s.combat) throw Error('NÃ£o Ã© possÃ­vel descansar em combate.');
        let logMsg = 'Descanso Curto (1h): ';
        for (const p of s.characters) {
          if (p.hp > 0 && p.hp < p.maxHp) {
            const res = shortRestHeal(p);
            touchChar(p);
            logMsg += `${p.name} ${res.rollText}. `;
          }
        }
        if (!logMsg.includes('recuperou')) {
          logMsg += 'Todos os herÃ³is jÃ¡ estavam com vida mÃ¡xima.';
        }
        log(logMsg, 'roll');
        break;
      }
      case 'rest': {
        gm();
        if (s.combat) throw Error('NÃ£o Ã© possÃ­vel descansar em combate.');
        for (const p of s.characters) {
          p.hp = p.maxHp;
          p.usedSlots = p.usedSlots.map(() => 0);
          p.deathFail = 0;
          p.deathSuccess = 0;
          p.exhaustion = Math.max(0, p.exhaustion - 1);
          touchChar(p);
        }
        log('O grupo concluiu um descanso longo (8h). PV e espaÃ§os de magia restaurados.', 'roll');
        break;
      }
      case 'location': {
        if (s.combat) throw Error('Encerre o combate antes de viajar.');
        const n = Number(a.location);
        if (!locations[n]) throw Error('Local invÃ¡lido.');

        // ─── Progression gating: auto-advance narrative ───
        if (!s.questProgress) s.questProgress = {};
        const biomeTarget = locations[n]?.biome || 'forest';
        if (biomeTarget === 'forest' && !s.questProgress.doran_talked) {
          s.questProgress.doran_talked = true;
          log('📜 Você segue para a Floresta dos Sussurros com a missão do Ancião Doran.', 'gm');
        }

        s.location = n;
        s.biome = locations[n].biome;
        s.act = (n + 1) as 1 | 2 | 3;

        // Reposition heroes to safe, walkable entrance coordinates in the new biome
        const spawnCoords: Record<string, { x: number; y: number }> = {
          village: { x: 4, y: 5 },
          forest: { x: 3, y: 3 },
          ruins: { x: 3, y: 6 },
          dungeon: { x: 4, y: 6 },
          canyon: { x: 3, y: 6 },
          lair: { x: 3, y: 6 }
        };
        const pos = spawnCoords[s.biome] || { x: 4, y: 5 };
        for (let i = 0; i < s.characters.length; i++) {
          s.characters[i].x = pos.x + (i % 2);
          s.characters[i].y = pos.y + Math.floor(i / 2);
          touchChar(s.characters[i]);
        }

        // Configure enemies appropriate for the destination biome
        // Enemies are placed but combat does NOT auto-start — exploration first!
        if (s.biome === 'forest') {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'Sentinela de Cinzas',
              hp: 9,
              maxHp: 9,
              ac: 11,
              attack: 2,
              damage: '1d4+1',
              initiative: 0,
              x: 7,
              y: 3
            },
            {
              id: crypto.randomUUID(),
              name: 'Lobo das Sombras',
              hp: 8,
              maxHp: 8,
              ac: 11,
              attack: 2,
              damage: '1d4+1',
              initiative: 0,
              x: 6,
              y: 2
            }
          ];
        } else if (s.biome === 'ruins') {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'Fanático do Fogo Negro',
              hp: 16,
              maxHp: 16,
              ac: 13,
              attack: 4,
              damage: '1d6+2',
              initiative: 0,
              x: 6,
              y: 3
            },
            {
              id: crypto.randomUUID(),
              name: 'Cultista Brutamontes',
              hp: 14,
              maxHp: 14,
              ac: 12,
              attack: 3,
              damage: '1d8+1',
              initiative: 0,
              x: 7,
              y: 4
            }
          ];
        } else if (s.biome === 'dungeon') {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'Guardião Espectral',
              hp: 18,
              maxHp: 18,
              ac: 13,
              attack: 3,
              damage: '1d6+2',
              initiative: 0,
              x: 5,
              y: 2
            },
            {
              id: crypto.randomUUID(),
              name: 'Escriba Sombrio',
              hp: 11,
              maxHp: 11,
              ac: 11,
              attack: 2,
              damage: '1d6',
              initiative: 0,
              x: 6,
              y: 4
            }
          ];
        } else if (s.biome === 'canyon') {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'Wyrmling Vermelho da Fenda',
              hp: 24,
              maxHp: 24,
              ac: 14,
              attack: 5,
              damage: '2d6+2',
              initiative: 0,
              x: 7,
              y: 3
            },
            {
              id: crypto.randomUUID(),
              name: 'Guerreiro Draconiano',
              hp: 16,
              maxHp: 16,
              ac: 13,
              attack: 4,
              damage: '1d8+2',
              initiative: 0,
              x: 6,
              y: 4
            }
          ];
        } else if (s.biome === 'lair') {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'Ignisrax, o Dragão Vermelho',
              hp: 55,
              maxHp: 55,
              ac: 16,
              attack: 6,
              damage: '2d8+3',
              initiative: 0,
              x: 6,
              y: 2
            },
            {
              id: crypto.randomUUID(),
              name: 'Sentinela de Obsidiana',
              hp: 18,
              maxHp: 18,
              ac: 14,
              attack: 4,
              damage: '1d8+2',
              initiative: 0,
              x: 4,
              y: 3
            }
          ];
        } else {
          // Peaceful village hub — never enemies
          s.enemies = [];
        }

        // Do NOT auto-start combat â€” player explores first, attacks to engage
        s.combat = false;
        s.order = [];
        s.actionUsed = false;
        s.movementUsed = 0;
        s.round = 0;
        s.turn = 0;

        if (s.biome === 'dungeon' || s.location === 2) {
          s.questProgress.dungeon_entered = true;
        }

        log(`O grupo viajou para ${locations[n].name}. ${locations[n].text}`, 'gm');
        if (s.enemies.length > 0) {
          log(`âš ï¸ Criaturas hostis espreitam os arredores. Prepare-se para o combate ou explore a Ã¡rea.`, 'gm');
        }
        break;
      }
      case 'advanceAct': {
        const nextAct = Number(a.act) as 1 | 2 | 3;
        if (![1, 2, 3].includes(nextAct)) throw Error('Ato invÃ¡lido.');

        // â”€â”€ Full tactical state reset â”€â”€
        s.location = nextAct - 1;
        s.biome = locations[s.location].biome;
        s.act = nextAct;
        s.combat = false;
        s.order = [];
        s.actionUsed = false;
        s.bonusActionUsed = false;
        s.movementUsed = 0;
        s.round = 0;
        s.turn = 0;

        if (!s.questProgress) s.questProgress = {};
        if (nextAct >= 2) {
          s.questProgress.dungeon_entered = true;
        }

        // Reposition heroes to safe entrance coordinates
        for (let i = 0; i < s.characters.length; i++) {
          s.characters[i].x = 4 + (i % 2);
          s.characters[i].y = 6 + Math.floor(i / 2);
        }

        // Spawn act-appropriate enemies (exploration first â€” no auto-combat)
        if (nextAct === 2) {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'GuardiÃ£o Espectral',
              hp: 18,
              maxHp: 18,
              ac: 13,
              attack: 3,
              damage: '1d6+2',
              initiative: 0,
              x: 5,
              y: 2
            },
            {
              id: crypto.randomUUID(),
              name: 'Escriba Sombrio',
              hp: 11,
              maxHp: 11,
              ac: 11,
              attack: 2,
              damage: '1d6',
              initiative: 0,
              x: 6,
              y: 4
            }
          ];
          log('O grupo desce Ã s Catacumbas das TrÃªs InscriÃ§Ãµes (Ato II). O ar cheira a poeira e ozÃ´nio arcano. âš ï¸ Criaturas hostis espreitam.', 'gm');
        } else if (nextAct === 3) {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'Malakor, o Lorde das Cinzas',
              hp: 30,
              maxHp: 30,
              ac: 15,
              attack: 5,
              damage: '1d10+3',
              initiative: 0,
              x: 4,
              y: 1
            },
            {
              id: crypto.randomUUID(),
              name: 'Sentinela Abissal',
              hp: 12,
              maxHp: 12,
              ac: 12,
              attack: 3,
              damage: '1d6+1',
              initiative: 0,
              x: 2,
              y: 3
            }
          ];
          log('O grupo alcanÃ§a o SantuÃ¡rio do Vazio (Ato III). Malakor ergue-se do trono de pedra negra! âš ï¸ O confronto final se aproxima.', 'gm');
        } else {
          s.enemies = [
            {
              id: crypto.randomUUID(),
              name: 'Sentinela de Cinzas',
              hp: 9,
              maxHp: 9,
              ac: 11,
              attack: 2,
              damage: '1d4+1',
              initiative: 0,
              x: 5,
              y: 2
            }
          ];
          log('O grupo retorna ao claustro da superfÃ­cie (Ato I).', 'gm');
        }
        break;
      }
      case 'notes':
        gm();
        s.notes = String(a.notes).slice(0, 10000);
        break;
      case 'npc':
        gm();
        if (s.npcs.length >= 50) throw Error('Limite de NPCs atingido.');
        s.npcs.push({
          id: crypto.randomUUID(),
          name: String(a.name).slice(0, 60),
          role: String(a.role).slice(0, 100),
          description: String(a.description).slice(0, 3000)
        });
        break;
      case 'message': {
        log(String(a.text).slice(0, 3000), 'player');
        break;
      }
      case 'questStep': {
        const stepKey = String(a.step || '');
        if (!s.questProgress) s.questProgress = {};
        if (stepKey) {
          s.questProgress[stepKey] = true;
        }
        if (a.logText) {
          log(String(a.logText), 'system');
        }
        break;
      }
      case 'equip': {
        const p = own();
        const nextEquipment = { ...(p.equipment || {}), ...(a.equipment || {}) };
        p.equipment = nextEquipment;
        const recalculated = calculateEquippedStats(p);
        Object.assign(p, recalculated);
        log(`${p.name} reorganizou seu equipamento de combate.`, 'player');
        break;
      }
      case 'levelup': {
        const p = own();
        if (!canLevelUp(p)) {
          throw Error(`XP insuficiente para subir de nÃ­vel (${p.xp || 0}/${getXpForNextLevel(p.level)} XP necessÃ¡rios).`);
        }
        if (p.level >= 20) throw Error('Este personagem jÃ¡ atingiu o nÃ­vel mÃ¡ximo (20).');

        const oldLevel = p.level;
        const newLevel = oldLevel + 1;
        p.level = newLevel;

        // Dado de vida da classe (D&D 5e oficial)
        const classTuple = classes.find((cl) => cl[0] === p.className);
        const hitDieSides = classTuple ? classTuple[1] : 8;
        const conMod = mod(p.stats[2]);
        // Incremento de PV pela mÃ©dia ou valor fornecido
        const hpGain = Math.max(1, Math.floor(hitDieSides / 2) + 1 + conMod);
        p.maxHp += hpGain;
        p.hp = Math.min(p.maxHp, p.hp + hpGain);

        // AtualizaÃ§Ã£o de espaÃ§os de magia para conjuradores
        p.slots = getSpellSlotsForClass(p.className, newLevel);
        if (!p.usedSlots) p.usedSlots = [0, 0, 0, 0, 0, 0, 0, 0, 0];

        // ASI: Aumento no Valor de Atributo (distribuiÃ§Ã£o de 2 pontos nos nÃ­veis 4, 8, etc.)
        if (isAsiLevel(p.className, newLevel) && Array.isArray(a.statIncreases)) {
          for (const statIdx of a.statIncreases) {
            const idx = Number(statIdx);
            if (idx >= 0 && idx <= 5 && p.stats[idx] < 20) {
              p.stats[idx] += 1;
            }
          }
        }

        // Recalcular bÃ´nus de proficiÃªncia, ataque, CA com os novos atributos e nÃ­vel
        const recalculated = calculateEquippedStats(p);
        Object.assign(p, recalculated);

        log(`ðŸŒŸ LEVEL UP! ${p.name} alcanÃ§ou o NÃVEL ${newLevel}! (+${hpGain} PV MÃ¡x). ParabÃ©ns!`, 'gm');
        break;
      }
      case 'respawn': {
        const hero = own();
        hero.hp = hero.maxHp;
        hero.conditions = [];
        hero.deathSuccess = 0;
        hero.deathFail = 0;
        hero.x = 4;
        hero.y = 6;
        s.combat = false;
        s.order = [];
        s.actionUsed = false;
        s.location = 0;
        s.biome = 'village';
        s.enemies = [];
        log(`ðŸ•Šï¸ ${hero.name} recuperou a consciÃªncia no santuÃ¡rio da Vila do Rio Verde, curado pelas Ã¡guas e oraÃ§Ãµes.`, 'gm');
        break;
      }
      case 'chat': {
        const text = String(a.text || '').trim().slice(0, 500);
        if (!text) throw Error('Mensagem vazia.');
        const senderChar = s.characters.find((ch) => ch.owner === user!.userId || ch.id === a.character);
        const charName = String(a.characterName || (senderChar ? senderChar.name : 'Aventureiro')).slice(0, 50);
        log(`ðŸ’¬ ${charName}: "${text}"`, 'player');
        break;
      }
      case 'partyInvite': {
        const senderChar = s.characters.find((ch) => ch.owner === user!.userId) ||
          s.characters.find((ch) => (isMmo ? ch.owner === user!.userId : true) && (ch.id === a.character || ch.id === a.fromCharId)) ||
          s.characters.find((ch) => ch.id === a.character) ||
          s.characters[0];
        if (!senderChar) throw Error('Crie um personagem antes de enviar convites.');
        
        const targetId = String(a.targetCharId || a.target || '');
        const targetChar = s.characters.find((ch) => ch.id === targetId);
        if (!targetChar) throw Error('Aventureiro nÃ£o encontrado.');
        if (targetChar.id === senderChar.id) throw Error('VocÃª nÃ£o pode convidar a si mesmo.');
        if (targetChar.partyId && senderChar.partyId && targetChar.partyId === senderChar.partyId) {
          throw Error(`${targetChar.name} jÃ¡ faz parte do seu grupo.`);
        }

        if (!s.partyInvites) s.partyInvites = [];
        const now = Date.now();
        s.partyInvites = s.partyInvites.filter((inv) => now - inv.timestamp < 60000);

        const existing = s.partyInvites.find((inv) => inv.fromCharId === senderChar.id && inv.toCharId === targetChar.id);
        if (existing) {
          throw Error(`Convite jÃ¡ enviado para ${targetChar.name}. Aguarde.`);
        }

        const invite = {
          id: 'inv_' + crypto.randomUUID().slice(0, 8),
          fromCharId: senderChar.id,
          fromCharName: senderChar.name,
          fromUserId: user!.userId,
          toCharId: targetChar.id,
          toCharName: targetChar.name,
          toUserId: targetChar.owner || '',
          timestamp: now
        };
        s.partyInvites.push(invite);
        log(`ðŸ›¡ï¸ ${senderChar.name} convidou ${targetChar.name} para formar um grupo!`, 'player');
        break;
      }
      case 'partyAccept': {
        if (!s.partyInvites) s.partyInvites = [];
        const inviteId = String(a.inviteId || '');
        const inviteIdx = s.partyInvites.findIndex((inv) => inv.id === inviteId || inv.toUserId === user!.userId);
        if (inviteIdx === -1) throw Error('Nenhum convite de grupo pendente encontrado.');
        const invite = s.partyInvites[inviteIdx];
        s.partyInvites.splice(inviteIdx, 1);

        const inviter = s.characters.find((ch) => ch.id === invite.fromCharId);
        const receiver = s.characters.find((ch) => ch.id === invite.toCharId);
        if (!inviter || !receiver) throw Error('Personagem do convite nÃ£o encontrado.');

        const partyId = inviter.partyId || ('party_' + crypto.randomUUID().slice(0, 8));
        inviter.partyId = partyId;
        receiver.partyId = partyId;

        log(`ðŸ¤ ${receiver.name} aceitou o convite e juntou-se ao grupo de ${inviter.name}!`, 'player');
        break;
      }
      case 'partyDecline': {
        if (!s.partyInvites) s.partyInvites = [];
        const inviteId = String(a.inviteId || '');
        const inviteIdx = s.partyInvites.findIndex((inv) => inv.id === inviteId || inv.toUserId === user!.userId);
        if (inviteIdx !== -1) {
          const invite = s.partyInvites[inviteIdx];
          s.partyInvites.splice(inviteIdx, 1);
          log(`âŒ ${invite.toCharName} recusou o convite de grupo de ${invite.fromCharName}.`, 'player');
        }
        break;
      }
      case 'partyLeave': {
        const p = own();
        if (!p.partyId) throw Error('VocÃª nÃ£o estÃ¡ em nenhum grupo.');
        const oldPartyId = p.partyId;
        p.partyId = undefined;
        const remaining = s.characters.filter((ch) => ch.partyId === oldPartyId);
        if (remaining.length === 1) {
          remaining[0].partyId = undefined;
        }
        log(`ðŸšª ${p.name} saiu do grupo e agora segue como aventureiro solo.`, 'player');
        break;
      }
      case 'leave': {
        const targetCharId = a.character || a.characterId;
        const initialCount = s.characters.length;
        if (targetCharId) {
          s.characters = s.characters.filter((ch) => ch.id !== targetCharId);
        } else if (user) {
          const leaveUid = user.userId;
          s.characters = s.characters.filter((ch) => ch.owner !== leaveUid);
        }
        if (s.characters.length !== initialCount) {
          log(`ðŸ‘‹ Um aventureiro partiu da Ã¡rea e descansou na taverna.`, 'system');
        }
        break;
      }
      case 'buyItem': {
        const p = own();
        const rawItem = a.item as ProceduralItem | undefined;
        const itemId = String(a.itemId || rawItem?.id || '');
        const catalogDef = ITEMS_CATALOG[itemId];
        const itemToBuy = rawItem || (catalogDef ? {
          id: catalogDef.id,
          name: catalogDef.name,
          type: catalogDef.type,
          rarity: catalogDef.rarity || 'comum',
          description: catalogDef.description,
          value: catalogDef.value || 10,
          weight: catalogDef.weight || 1
        } : null);

        if (!itemToBuy) throw Error('Item não encontrado no estoque do mercador.');

        const priceMult = s.economyContext?.priceMultiplier || 1.0;
        const finalPrice = Math.max(1, Math.round((a.price ?? itemToBuy.value ?? 10) * priceMult));

        if ((p.gold || 0) < finalPrice) {
          throw Error(`Ouro insuficiente. Você possui ${p.gold || 0} PO, mas o item custa ${finalPrice} PO.`);
        }

        p.gold = (p.gold || 0) - finalPrice;
        const currentInv = (p.inventory || '').trim();
        p.inventory = currentInv ? `${currentInv}\n${itemToBuy.name}` : itemToBuy.name;

        if (rawItem) {
          registerProceduralItem(rawItem);
        }
        touchChar(p);
        log(`🛒 ${p.name} comprou "${itemToBuy.name}" por ${finalPrice} PO. (Saldo: ${p.gold} PO)`, 'player');
        break;
      }
      case 'sellItem': {
        const p = own();
        const itemName = String(a.itemName || '').trim();
        if (!itemName) throw Error('Nome do item inválido para venda.');

        const invLines = (p.inventory || '').split('\n').map((l) => l.trim()).filter(Boolean);
        const itemIndex = invLines.findIndex(
          (l) => l.toLowerCase() === itemName.toLowerCase() || l.toLowerCase().includes(itemName.toLowerCase())
        );

        if (itemIndex === -1) {
          throw Error(`Você não possui "${itemName}" no inventário.`);
        }

        const removedItemLine = invLines[itemIndex];
        invLines.splice(itemIndex, 1);
        p.inventory = invLines.join('\n');

        // Base value lookup or default
        const catalogEntry = Object.values(ITEMS_CATALOG).find(
          (it) => it.name.toLowerCase() === removedItemLine.toLowerCase()
        );
        const baseValue = catalogEntry?.value || Number(a.baseValue) || 10;
        const priceMult = s.economyContext?.priceMultiplier || 1.0;
        // Standard D&D 5e: merchant buys at 50% value
        const salePrice = Math.max(1, Math.round(baseValue * 0.5 * priceMult));

        p.gold = (p.gold || 0) + salePrice;
        touchChar(p);
        log(`💰 ${p.name} vendeu "${removedItemLine}" ao mercador por +${salePrice} PO. (Saldo: ${p.gold} PO)`, 'player');
        break;
      }
      case 'heartbeat': {
        if (c) {
          touchChar(c);
        }
        // Periodic SandboxDirector evaluation (non-intrusive, bounded narrative)
        try {
          const ctx = readCompactWorldContext(s, r.id);
          const pacing = evaluateDirectorPacing(ctx, r.id);
          if (pacing.canAct) {
            const rollChoice = Math.random();
            if (rollChoice < 0.35) {
              const requestedMult = 0.90 + Math.random() * 0.25;
              executeDirectorIntent(
                'influence_economy',
                { multiplier: requestedMult, reason: 'Ajuste orgânico de comércio e rotas de suprimentos' },
                s,
                r.id
              );
            } else if (rollChoice < 0.70) {
              const critters: ('lobos_rastros' | 'cervos' | 'corvos')[] = ['cervos', 'corvos', 'lobos_rastros'];
              const picked = critters[Math.floor(Math.random() * critters.length)];
              executeDirectorIntent('adjust_ecosystem', { critterType: picked, reason: 'Ritmo da fauna do bioma' }, s, r.id);
            } else {
              const envEvents = [
                'Nuvens baixas cobrem o topo das árvores e o ar fica carregado de eletricidade.',
                'O som de um sino distante ecoa pelas montanhas, lembrando os heróis da antiga vigília de Valdoria.',
                'Uma brisa morna sopra cinzas leves que dançam no ar antes de tocar o chão.'
              ];
              const pickedText = envEvents[Math.floor(Math.random() * envEvents.length)];
              executeDirectorIntent('request_environmental_event', { text: pickedText }, s, r.id);
            }
          }
        } catch (err) {
          console.warn('[SandboxDirector Heartbeat Evaluation]', err);
        }
        break;
      }
      default:
        throw Error('AÃ§Ã£o desconhecida.');
    }

    s.logs = s.logs.slice(-200);
    let result = await db
      .prepare('UPDATE rooms SET state=?,version=version+1 WHERE id=? AND version=?')
      .bind(JSON.stringify(s), r.id, r.version)
      .run();

    if (!(result?.meta?.changes ?? result?.changes ?? 0)) {
      if (a.action === 'character') {
        const fresh = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(r.id).first<Room>();
        if (fresh) {
          const freshState: State = JSON.parse(fresh.state);
          const rawChar = (a.value || a.character) as Character;
          let nextChar = validateCharacter(rawChar);
          nextChar = calculateEquippedStats(nextChar);
          const existingIdx = freshState.characters.findIndex((x) => x.id === nextChar.id);
          if (existingIdx >= 0) {
            freshState.characters[existingIdx] = { ...nextChar, id: freshState.characters[existingIdx].id, owner: freshState.characters[existingIdx].owner };
          } else {
            freshState.characters.push({ ...nextChar, id: nextChar.id || crypto.randomUUID(), owner: user!.userId });
          }
          freshState.logs.push(entry(`${nextChar.name} entrou na aventura.`, 'system'));
          freshState.logs = freshState.logs.slice(-200);
          await db.prepare('UPDATE rooms SET state=?,version=version+1 WHERE id=?')
            .bind(JSON.stringify(freshState), fresh.id)
            .run();
          r = fresh;
          s = freshState;
        }
      } else {
        const latest = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(r.id).first<Room>();
        return withUserSession(NextResponse.json({
          error: 'Outra aÃ§Ã£o chegou primeiro. Atualize e tente novamente.',
          room: latest ? { ...latest, state: JSON.parse(latest.state) } : undefined
        }, { status: 409 }), user);
      }
    }

    const updatedRoom: Room = {
      ...r,
      state: JSON.stringify(s),
      version: r.version + 1
    };

    // Instant real-time broadcast to all SSE stream subscribers
    try {
      let actionPayload: any = undefined;
      if (a.action === 'move' && c) {
        actionPayload = {
          characterId: c.id,
          x: c.x,
          y: c.y,
          waypoints: a.waypoints || [{ x: c.x, y: c.y }],
          seq: Date.now()
        };
      } else if (a.action === 'attack') {
        actionPayload = {
          characterId: a.character,
          targetId: a.target || a.targetId,
          attackResult: clientAttackResult
        };
      }

      emitRoomUpdate(r.id, {
        version: r.version + 1,
        state: s,
        originUserId: user?.userId,
        actionType: String(a.action || ''),
        actionPayload
      });
    } catch (err) {
      console.warn('Real-time emit notice:', err);
    }

    return withUserSession(NextResponse.json({
      ok: true,
      room: { ...updatedRoom, state: s },
      attackResult: clientAttackResult,
      healResult: clientHealResult
    }), user);
  } catch (e) {
    console.error('[API Error]:', e);
    return withUserSession(NextResponse.json(
      { error: e instanceof Error ? e.message : 'NÃ£o foi possÃ­vel salvar. Seu conteÃºdo foi preservado.' },
      { status: 400 }
    ), user);
  }
}

function advance(s: State) {
  if (s.enemies.every((x) => x.hp <= 0)) {
    s.combat = false;
    s.order = [];
    s.actionUsed = false;
    s.movementUsed = 0;
    s.logs.push(entry('VitÃ³ria! Todos os inimigos foram derrotados na masmorra.', 'gm'));
    return;
  }
  if (s.characters.every((x) => x.hp <= 0)) {
    s.combat = false;
    s.actionUsed = false;
    s.movementUsed = 0;
    s.logs.push(entry('O grupo caiu inconsciente. A aventura precisa de socorro ou descanso!', 'gm'));
    return;
  }
  let safety = 0;
  do {
    s.turn = (s.turn + 1) % s.order.length;
    if (s.turn === 0) s.round++;
    safety++;
    if (safety > s.order.length + 2) {
      // All entities are dead or missing â€” end combat
      s.combat = false;
      s.order = [];
      s.actionUsed = false;
      s.movementUsed = 0;
      s.logs.push(entry('O combate terminou â€” nenhuma criatura ativa restante.', 'gm'));
      return;
    }
    const entity = [...s.characters, ...s.enemies].find((x) => x.id === s.order[s.turn]);
    if (!entity) continue; // Entity no longer exists â€” skip
    if (entity.hp > 0) break; // Found alive entity
  } while (true);

  // Ready action for newly active entity
  s.actionUsed = false;
  s.movementUsed = 0;
}

function executeSingleEnemyRevenge(enemy: Enemy, attacker: Character, s: State) {
  if (enemy.hp <= 0 || attacker.hp <= 0) return;
  const dist = Math.max(Math.abs(attacker.x - enemy.x), Math.abs(attacker.y - enemy.y));
  if (dist > 1) {
    const nextX = enemy.x + Math.sign(attacker.x - enemy.x);
    const nextY = enemy.y + Math.sign(attacker.y - enemy.y);
    if (nextX >= 0 && nextX <= 15 && nextY >= 0 && nextY <= 15) {
      enemy.x = nextX;
      enemy.y = nextY;
      touchChar(enemy);
    }
  }
  const revengeDist = Math.max(Math.abs(attacker.x - enemy.x), Math.abs(attacker.y - enemy.y));
  if (revengeDist <= 1) {
    const counterLog = attack(enemy, attacker);
    s.logs.push(entry(`⚡ [Reação Imediata do Inimigo] ${counterLog}`, 'roll'));
    touchChar(attacker);
  }
}

function executeEnemyAI(s: State) {
  let safety = 0;
  const attackedTargets = new Set<string>(); // Track who was already attacked this round for target distribution
  while (s.combat && safety < 10) {
    safety++;
    const curId = s.order[s.turn];
    if (!curId) break;
    const enemy = s.enemies.find((e) => e.id === curId && e.hp > 0);
    if (!enemy) break;
    const activeHeroes = s.characters.filter((c) => c.hp > 0);
    if (activeHeroes.length === 0) {
      s.combat = false;
      s.actionUsed = false;
      s.movementUsed = 0;
      break;
    }

    // Smart target selection: distribute attacks among different heroes
    // Prefer heroes NOT already attacked this round, unless only 1 hero remains
    const notYetAttacked = activeHeroes.filter((h) => !attackedTargets.has(h.id));
    const candidates = notYetAttacked.length > 0 ? notYetAttacked : activeHeroes;
    const target = candidates.sort((a, b) => {
      const distA = Math.abs(a.x - enemy.x) + Math.abs(a.y - enemy.y);
      const distB = Math.abs(b.x - enemy.x) + Math.abs(b.y - enemy.y);
      return distA - distB;
    })[0];
    attackedTargets.add(target.id);

    const dist = Math.max(Math.abs(target.x - enemy.x), Math.abs(target.y - enemy.y));
    if (dist > 1) {
      const nextX = enemy.x + Math.sign(target.x - enemy.x);
      const nextY = enemy.y + Math.sign(target.y - enemy.y);
      if (nextX >= 0 && nextX <= 15 && nextY >= 0 && nextY <= 15) {
        enemy.x = nextX;
        enemy.y = nextY;
      }
    }
    const attackLog = attack(enemy, target);
    s.logs.push(entry(attackLog, 'roll'));
    advance(s);
  }
  if (s.combat) {
    s.actionUsed = false;
    s.movementUsed = 0;
  }
}

