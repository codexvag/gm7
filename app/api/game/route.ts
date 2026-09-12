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
  syncPartyProgression,
  mergePartyProgress,
  type State,
  type Character,
  type GroundCorpse,
  type AttackResult,
  type Enemy
} from '@/lib/game-engine';
import { generateMobLoot, registerProceduralItem, type ProceduralItem } from '@/lib/procedural-items';
import { getCreatureProfile, prepareEnemyForCombat } from '@/lib/creature-profiles';
import { addInventoryItem, removeInventoryItem, getInventoryQuantity, stripInventoryQuantity } from '@/lib/inventory-utils';
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
      const roomIds = userRooms.results?.map((r: any) => r.room) || [];
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

    let defaultRoomId = userRooms[0]?.id as string;
    // Defend against falling back to empty private room: if user has a hero in MMO, prefer MMO_ROOM_ID
    const mmoRoomRow = await db.prepare('SELECT state FROM rooms WHERE id=?').bind(MMO_ROOM_ID).first<{ state: string }>();
    if (mmoRoomRow) {
      try {
        const mmoState = JSON.parse(mmoRoomRow.state);
        if (Array.isArray(mmoState.characters) && mmoState.characters.some((ch: Character) => ch.owner === user.userId)) {
          defaultRoomId = MMO_ROOM_ID;
        }
      } catch {}
    }
    const targetId = requestedId || defaultRoomId || MMO_ROOM_ID;
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
    if (parsedState && room?.id === MMO_ROOM_ID) {
      let stateChanged = false;
      if (Array.isArray(parsedState.characters)) {
        const now = Date.now();
        const initialCount = parsedState.characters.length;
        parsedState.characters = parsedState.characters.filter((ch: Character) => {
          if (ch.owner === user.userId) return true;
          if (!ch.lastSeen) return true;
          return (now - ch.lastSeen) < 900000;
        });
        if (parsedState.characters.length !== initialCount) stateChanged = true;
      }
      if (Array.isArray(parsedState.corpses)) {
        for (const c of parsedState.corpses) {
          if (c.biome === 'village') {
            c.biome = 'forest';
            stateChanged = true;
          }
        }
      }
      if (Array.isArray(parsedState.enemies)) {
        for (const e of parsedState.enemies) {
          if (!e.biome) {
            e.biome = e.name.includes('Malakor') || e.name.includes('Abissal') ? 'dungeon' : 'forest';
            stateChanged = true;
          }
        }
      }
      if (stateChanged) {
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
      const roomIds = userRooms.results?.map((r: any) => r.room) || [];
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

    // Prune stale characters in MMO world (inactivity > 15min)
    if (isMmo && Array.isArray(s.characters)) {
      const now = Date.now();
      s.characters = s.characters.filter((ch: Character) => {
        if (currentUserId && ch.owner === currentUserId) return true;
        if (!ch.lastSeen) return true;
        return (now - ch.lastSeen) < 900000;
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

    const recordProgression = (char: Character, questUpdates: Record<string, boolean>, flagUpdates?: Record<string, boolean>) => {
      if (!char.questProgress) char.questProgress = {};
      Object.assign(char.questProgress, questUpdates);
      if (flagUpdates) {
        if (!char.worldFlags) char.worldFlags = {};
        Object.assign(char.worldFlags, flagUpdates);
      }
      touchChar(char);
      if (char.partyId) {
        syncPartyProgression(s.characters, char.partyId, questUpdates, flagUpdates);
      }
      if (!s.questProgress) s.questProgress = {};
      Object.assign(s.questProgress, questUpdates);
      if (flagUpdates) {
        if (!s.worldFlags) s.worldFlags = {};
        Object.assign(s.worldFlags, flagUpdates);
      }
    };

    let clientAttackResult: AttackResult | null = null;
    let clientHealResult: { targetId: string; targetName: string; healAmount: number; hpAfter: number; maxHp: number } | null = null;
    let clientLootResult: { gold: number; items: string[]; x: number; y: number } | null = null;

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
        const p = c || own();
        if (!p) throw Error('Crie um personagem consciente primeiro.');
        const heroBiome = (p.biome || s.biome || 'village') as string;
        if (heroBiome === 'village' || (p.location ?? s.location ?? 0) === 0) {
          throw Error('A Vila do Rio Verde é um santuário pacífico e seguro. Não há monstros hostis aqui.');
        }
        const partyId = p.partyId;

        // Check if there are already living enemies for this party/hero in this biome
        let myEnemies = (s.enemies || []).filter((e) => {
          if (e.hp <= 0) return false;
          if (e.biome && e.biome !== heroBiome) return false;
          if (partyId) return !e.partyId || e.partyId === partyId;
          return !e.ownerCharId || e.ownerCharId === p.id;
        });

        // If no enemies exist yet for this party/hero in this biome, spawn biome-appropriate ones
        if (myEnemies.length === 0) {
          const spawnTable: Record<string, { name: string; hp: number; maxHp: number; ac: number; attack: number; damage: string; x: number; y: number }[]> = {
            village: [{ name: 'Espantalho Amaldiçoado', hp: 8, maxHp: 8, ac: 10, attack: 2, damage: '1d4+1', x: 6, y: 3 }],
            forest: [
              { name: 'Sentinela de Cinzas', hp: 9, maxHp: 9, ac: 11, attack: 2, damage: '1d4+1', x: 7, y: 3 },
              { name: 'Lobo das Sombras', hp: 8, maxHp: 8, ac: 11, attack: 2, damage: '1d4+1', x: 6, y: 2 }
            ],
            ruins: [
              { name: 'Fanático do Fogo Negro', hp: 16, maxHp: 16, ac: 13, attack: 4, damage: '1d6+2', x: 6, y: 3 },
              { name: 'Cultista Brutamontes', hp: 14, maxHp: 14, ac: 12, attack: 3, damage: '1d8+1', x: 7, y: 4 }
            ],
            dungeon: [
              { name: 'Guardião Espectral', hp: 18, maxHp: 18, ac: 13, attack: 3, damage: '1d6+2', x: 5, y: 2 },
              { name: 'Escriba Sombrio', hp: 11, maxHp: 11, ac: 11, attack: 2, damage: '1d6', x: 6, y: 4 }
            ]
          };
          const template = spawnTable[heroBiome] || spawnTable.forest;
          const spawned: Enemy[] = template.map((t) => ({
            id: crypto.randomUUID(),
            ...t,
            initiative: 0,
            biome: heroBiome as any,
            partyId,
            ownerCharId: partyId ? undefined : p.id
          }));
          if (!s.enemies) s.enemies = [];
          s.enemies.push(...spawned);
          myEnemies = spawned;
        }

        s.combat = true;
        s.combatMode = 'tactical';
        s.combatPartyId = partyId || p.id;
        s.round = 1;

        const partyMembers = partyId
          ? s.characters.filter((char) => char.partyId === partyId && char.hp > 0)
          : [p];

        for (const char of partyMembers) {
          char.initiative = d20().raw + mod(char.stats[1]) + 3 - 2 * (char.exhaustion || 0);
          touchChar(char);
        }
        for (const enemy of myEnemies) {
          prepareEnemyForCombat(
            enemy,
            partyMembers,
            heroBiome,
            partyId,
            p.id
          );
          enemy.initiative = d20().raw + 1;
          touchChar(enemy);
        }

        s.order = [...partyMembers, ...myEnemies]
          .sort((a, b) => (b.initiative || 0) - (a.initiative || 0) || a.id.localeCompare(b.id))
          .map((x) => x.id);

        s.turn = 0;
        s.actionUsed = false;
        s.movementUsed = 0;
        log(
          `⚔️ Combate iniciado! Iniciativa 5e: ` +
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
      case 'startCombat': {
        const p = own();
        const heroBiome = (p.biome || s.biome || 'village') as string;
        const partyId = p.partyId;

        s.combat = true;
        s.combatMode = 'tactical';
        s.round = 1;
        const partyMembers = partyId
          ? s.characters.filter((c) => c.partyId === partyId && c.hp > 0)
          : [p];
        s.combatPartyId = partyId || p.id;

        for (const char of partyMembers) {
          char.initiative = d20().raw + mod(char.stats[1]) + 3 - 2 * (char.exhaustion || 0);
          touchChar(char);
        }

        // Claim legacy/world enemies for the party that really engages them.
        // Older saves may contain Malakor or other enemies without party scope.
        for (const enemy of (s.enemies || [])) {
          if (enemy.hp <= 0) continue;

          const sameBiome =
            !enemy.biome ||
            enemy.biome === heroBiome;

          const isLegacyMalakor =
            enemy.name.includes('Malakor');

          if (
            !enemy.partyId &&
            !enemy.ownerCharId &&
            (sameBiome || isLegacyMalakor)
          ) {
            prepareEnemyForCombat(
              enemy,
              partyMembers,
              heroBiome,
              partyId,
              p.id
            );
          }
        }

        const livingEnemies = (s.enemies || []).filter((enemy) => {
          if (enemy.hp <= 0) return false;

          if (
            enemy.biome &&
            enemy.biome !== heroBiome
          ) {
            return false;
          }

          if (partyId) {
            return enemy.partyId === partyId;
          }

          return enemy.ownerCharId === p.id;
        });

        if (livingEnemies.length === 0) {
          throw Error(
            'Nao ha criaturas hostis validas para este grupo nesta area.'
          );
        }

        for (const enemy of livingEnemies) {
          prepareEnemyForCombat(
            enemy,
            partyMembers,
            heroBiome,
            partyId,
            p.id
          );

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

        if (!s.combat) {
          throw Error('Nao ha batalha tatica ativa no momento.');
        }

        if (p.hp <= 0) {
          throw Error('Seu personagem precisa estar consciente para retornar.');
        }

        const combatKey = p.partyId || p.id;

        if (
          s.combatPartyId &&
          s.combatPartyId !== combatKey
        ) {
          throw Error('Esta batalha pertence a outro grupo.');
        }

        if ((s.order || []).includes(p.id)) {
          throw Error(p.name + ' ja esta participando desta batalha.');
        }

        const alliesInBattle = (s.characters || []).filter((char) => {
          if (char.id === p.id) return false;
          if (char.hp <= 0) return false;
          if (!(s.order || []).includes(char.id)) return false;

          if (p.partyId) {
            return char.partyId === p.partyId;
          }

          return false;
        });

        if (p.partyId && alliesInBattle.length === 0) {
          throw Error(
            'Nenhum aliado consciente do seu grupo permanece nesta batalha.'
          );
        }

        const enemiesInBattle = (s.enemies || []).filter((enemy) => {
          if (enemy.hp <= 0) return false;
          if (!(s.order || []).includes(enemy.id)) return false;

          if (p.partyId) {
            return enemy.partyId === p.partyId;
          }

          return enemy.ownerCharId === p.id;
        });

        if (enemiesInBattle.length === 0) {
          throw Error(
            'A batalha ja terminou. Nao ha inimigos ativos para retornar.'
          );
        }

        // Reaparece ao lado de um aliado sobrevivente.
        const anchor = alliesInBattle[0];

        if (anchor) {
          p.location = anchor.location ?? p.location ?? s.location;
          p.biome = anchor.biome ?? p.biome ?? s.biome;

          const candidates = [
            { x: anchor.x - 1, y: anchor.y },
            { x: anchor.x + 1, y: anchor.y },
            { x: anchor.x, y: anchor.y - 1 },
            { x: anchor.x, y: anchor.y + 1 }
          ];

          const occupied = new Set(
            [
              ...(s.characters || []),
              ...(s.enemies || [])
            ]
              .filter((entity) => entity.id !== p.id && entity.hp > 0)
              .map((entity) => entity.x + ':' + entity.y)
          );

          const destination =
            candidates.find(
              (pos) =>
                pos.x >= 0 &&
                pos.x <= 15 &&
                pos.y >= 0 &&
                pos.y <= 15 &&
                !occupied.has(pos.x + ':' + pos.y)
            ) || {
              x: anchor.x,
              y: anchor.y
            };

          p.x = destination.x;
          p.y = destination.y;
        }

        p.initiative =
          d20().raw +
          mod(p.stats[1]) -
          2 * (p.exhaustion || 0);

        touchChar(p);

        // Reforcos entram no final do ciclo atual.
        s.order.push(p.id);

        log(
          '??? ' +
            p.name +
            ' retornou ao campo de batalha para ajudar o grupo!',
          'roll'
        );

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
          const combatBiome =
            (p.biome || s.biome || 'village') as string;

          // Scope legacy enemies only to the party/hero that engages them.
          for (const enemy of (s.enemies || [])) {
            if (enemy.hp <= 0) continue;

            const sameBiome =
              !enemy.biome ||
              enemy.biome === combatBiome;

            const isLegacyMalakor =
              enemy.name.includes('Malakor');

            if (
              !enemy.partyId &&
              !enemy.ownerCharId &&
              (sameBiome || isLegacyMalakor)
            ) {
              prepareEnemyForCombat(
                enemy,
                partyMembers,
                combatBiome,
                p.partyId,
                p.id
              );
            }
          }

          const combatEnemies = (s.enemies || []).filter((enemy) => {
            if (enemy.hp <= 0) return false;

            if (
              enemy.biome &&
              enemy.biome !== combatBiome
            ) {
              return false;
            }

            if (p.partyId) {
              return enemy.partyId === p.partyId;
            }

            return enemy.ownerCharId === p.id;
          });

          if (combatEnemies.length === 0) {
            throw Error(
              'Nao ha criaturas hostis validas para este combate.'
            );
          }

          for (const enemy of combatEnemies) {
            prepareEnemyForCombat(
              enemy,
              partyMembers,
              combatBiome,
              p.partyId,
              p.id
            );

            enemy.initiative = d20().raw + 1;
            touchChar(enemy);
          }

          s.order = [...partyMembers, ...combatEnemies]
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
          const isMyCombat = !isMmo || !s.combatPartyId || s.combatPartyId === (p.partyId || p.id);
          if (isMyCombat) {
            const curTurnId = s.order[s.turn];
            if (curTurnId && curTurnId !== p.id) {
              const activeCreature = [...s.characters, ...s.enemies].find((x) => x.id === curTurnId);
              throw Error(`Não é o turno de ${p.name}. Turno atual: ${activeCreature ? activeCreature.name : 'Inimigo'}.`);
            }
            if (s.actionUsed) {
              throw Error('Você já utilizou sua Ação neste turno. Mova-se pelo terreno ou clique em "Fim do Turno" para passar a vez.');
            }
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
          const xpReward = getCreatureProfile(target.name).xpReward;
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
            const corpseBiome = target.biome || p.biome || s.biome || 'forest';
            const corpse: GroundCorpse = {
              id: `corpse-${target.id}-${Date.now()}`,
              name: `Restos de ${target.name}`,
              enemyName: target.name,
              x: target.x ?? 4,
              y: target.y ?? 4,
              gold: mobLoot.gold,
              items: mobLoot.items.map((it) => it.id),
              biome: corpseBiome,
              slainBy: p.name,
              createdAt: Date.now()
            };
            s.corpses.push(corpse);
            log(`💀 ${target.name} tombou no chão [X:${corpse.x} Y:${corpse.y}]! Deixou ${corpse.gold} PO${mobLoot.items.length ? ' e ' + mobLoot.items.map((it) => it.name).join(', ') : ''}. Aproxime-se para saquear!`, 'gm');
          } catch (err) {
            console.error('[Corpse spawn error]:', err);
          }
        }

        const myEnemies = (s.enemies || []).filter((e) => {
          if (p.partyId) return !e.partyId || e.partyId === p.partyId;
          return !e.ownerCharId || e.ownerCharId === p.id;
        });
        if (myEnemies.length > 0 && myEnemies.every((e) => e.hp <= 0)) {
          const curBiome = p.biome || s.biome || 'village';
          const curLoc = p.location ?? s.location ?? 0;
          if (curBiome === 'forest' || curLoc === 1) {
            recordProgression(p, { forest_cleared: true });
          } else if (curBiome === 'dungeon' || curLoc === 2) {
            recordProgression(p, { malakor_defeated: true });
          }
          s.combat = false;
          s.combatPartyId = undefined;
          s.order = (s.order || []).filter((id) => !myEnemies.some((e) => e.id === id) && id !== p.id && (!p.partyId || !s.characters.some((c) => c.partyId === p.partyId && c.id === id)));
          s.actionUsed = false;
          log('⚔️ Todos os inimigos foram vencidos! Vitória do grupo!', 'gm');
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
          const combatBiome =
            (p.biome || s.biome || 'village') as string;

          // Scope legacy enemies only to the party/hero that engages them.
          for (const enemy of (s.enemies || [])) {
            if (enemy.hp <= 0) continue;

            const sameBiome =
              !enemy.biome ||
              enemy.biome === combatBiome;

            const isLegacyMalakor =
              enemy.name.includes('Malakor');

            if (
              !enemy.partyId &&
              !enemy.ownerCharId &&
              (sameBiome || isLegacyMalakor)
            ) {
              prepareEnemyForCombat(
                enemy,
                partyMembers,
                combatBiome,
                p.partyId,
                p.id
              );
            }
          }

          const combatEnemies = (s.enemies || []).filter((enemy) => {
            if (enemy.hp <= 0) return false;

            if (
              enemy.biome &&
              enemy.biome !== combatBiome
            ) {
              return false;
            }

            if (p.partyId) {
              return enemy.partyId === p.partyId;
            }

            return enemy.ownerCharId === p.id;
          });

          if (combatEnemies.length === 0) {
            throw Error(
              'Nao ha criaturas hostis validas para este combate.'
            );
          }

          for (const enemy of combatEnemies) {
            prepareEnemyForCombat(
              enemy,
              partyMembers,
              combatBiome,
              p.partyId,
              p.id
            );

            enemy.initiative = d20().raw + 1;
            touchChar(enemy);
          }

          s.order = [...partyMembers, ...combatEnemies]
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

          const isMyCombat = !isMmo || !s.combatPartyId || s.combatPartyId === (p.partyId || p.id);
          if (isMyCombat) {
            const curTurnId = s.order[s.turn];
            if (curTurnId && curTurnId !== p.id) {
              const activeCreature = [...s.characters, ...s.enemies].find((x) => x.id === curTurnId);
              throw Error(`Não é o turno de ${p.name}. Turno atual: ${activeCreature ? activeCreature.name : 'Inimigo'}.`);
            }
            if (s.actionUsed) {
              throw Error('Você já utilizou sua Ação neste turno. Mova-se pelo terreno ou clique em "Fim do Turno" para passar a vez.');
            }
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
            const xpReward = getCreatureProfile(target.name).xpReward;
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
              const corpseBiome = target.biome || p.biome || s.biome || 'forest';
              const corpse: GroundCorpse = {
                id: `corpse-${target.id}-${Date.now()}`,
                name: `Restos de ${target.name}`,
                enemyName: target.name,
                x: target.x ?? 4,
                y: target.y ?? 4,
                gold: mobLoot.gold,
                items: mobLoot.items.map((it) => it.id),
                biome: corpseBiome,
                slainBy: p.name,
                createdAt: Date.now()
              };
              s.corpses.push(corpse);
              log(`💀 ${target.name} tombou no chão [X:${corpse.x} Y:${corpse.y}]! Deixou ${corpse.gold} PO${mobLoot.items.length ? ' e ' + mobLoot.items.map((it) => it.name).join(', ') : ''}. Aproxime-se para saquear!`, 'gm');
            } catch (err) {
              console.error('[Corpse spawn error]:', err);
            }
          }

        const myEnemies = (s.enemies || []).filter((e) => {
          if (p.partyId) return !e.partyId || e.partyId === p.partyId;
          return !e.ownerCharId || e.ownerCharId === p.id;
        });
        if (myEnemies.length > 0 && myEnemies.every((e) => e.hp <= 0)) {
          const curBiome = p.biome || s.biome || 'village';
          const curLoc = p.location ?? s.location ?? 0;
          if (curBiome === 'forest' || curLoc === 1) {
            recordProgression(p, { forest_cleared: true });
          } else if (curBiome === 'dungeon' || curLoc === 2) {
            recordProgression(p, { malakor_defeated: true });
          }
          s.combat = false;
          s.combatPartyId = undefined;
          s.order = (s.order || []).filter((id) => !myEnemies.some((e) => e.id === id) && id !== p.id && (!p.partyId || !s.characters.some((c) => c.partyId === p.partyId && c.id === id)));
          s.actionUsed = false;
          log('⚔️ Todos os inimigos foram vencidos! Vitória do grupo!', 'gm');
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

        const itemId = String(
          a.itemId || 'pocao-cura'
        );

        const itemDef = ITEMS_CATALOG[itemId];

        if (!itemDef) {
          throw Error('Item nao encontrado.');
        }

        if (!itemDef.healFormula) {
          throw Error(
            'Este item nao e um consumivel de cura utilizavel.'
          );
        }

        const ownedQuantity =
          getInventoryQuantity(
            p.inventory || '',
            itemDef.name
          );

        if (ownedQuantity <= 0) {
          throw Error(
            'Voce nao possui ' +
              itemDef.name +
              ' no inventario.'
          );
        }

        const targetId = a.targetId || p.id;

        const targetChar =
          s.characters.find(
            (char) => char.id === targetId
          );

        if (!targetChar) {
          throw Error('Alvo invalido para o item.');
        }

        if (
          targetChar.id !== p.id &&
          getGridDistance(p, targetChar) > 1
        ) {
          throw Error(
            'Alvo muito distante para aplicar o item.'
          );
        }

        if (targetChar.hp >= targetChar.maxHp) {
          throw Error(
            targetChar.name +
              ' ja esta com os Pontos de Vida no maximo.'
          );
        }

        const isMyCombat =
          !isMmo ||
          !s.combatPartyId ||
          s.combatPartyId === (p.partyId || p.id);

        if (s.combat && isMyCombat) {
          const curTurnId =
            s.order[s.turn];

          if (
            curTurnId &&
            curTurnId !== p.id
          ) {
            throw Error(
              'Nao e o turno de ' +
                p.name +
                '. Aguarde sua vez.'
            );
          }

          if (s.actionUsed) {
            throw Error(
              'Voce ja utilizou sua Acao neste turno.'
            );
          }
        }

        // Consome UMA unidade.
        const consumed =
          removeInventoryItem(
            p.inventory || '',
            itemDef.name,
            1
          );

        if (consumed.removed !== 1) {
          throw Error(
            'Nao foi possivel consumir o item.'
          );
        }

        p.inventory = consumed.inventory;

        const healRoll =
          roll(itemDef.healFormula);

        const oldHp =
          targetChar.hp;

        targetChar.hp =
          Math.min(
            targetChar.maxHp,
            targetChar.hp + healRoll.total
          );

        const actualHealed =
          targetChar.hp - oldHp;

        touchChar(targetChar);
        touchChar(p);

        if (s.combat && isMyCombat) {
          s.actionUsed = true;
        }

        const remaining =
          getInventoryQuantity(
            p.inventory || '',
            itemDef.name
          );

        log(
          '?? ' +
            p.name +
            ' usou ' +
            itemDef.name +
            ' em ' +
            targetChar.name +
            ' e recuperou ' +
            actualHealed +
            ' PV. Restam ' +
            remaining +
            ' unidade(s).',
          'roll'
        );

        clientHealResult = {
          targetId: targetChar.id,
          targetName: targetChar.name,
          healAmount: actualHealed,
          hpAfter: targetChar.hp,
          maxHp: targetChar.maxHp
        };

        if (
          a.endTurn &&
          s.combat &&
          isMyCombat
        ) {
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

          const itemName =
            itemDef
              ? itemDef.name
              : itemId;

          lootedItemNames.push(itemName);

          p.inventory =
            addInventoryItem(
              p.inventory || '',
              itemName,
              1
            );
        }

        touchChar(p);
        clientLootResult = { gold: lootedGold, items: lootedItemNames, x: corpse.x, y: corpse.y };
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
        const p = own();
        const isMyCombat = !isMmo || !s.combatPartyId || s.combatPartyId === (p.partyId || p.id);
        const activeChar = s.characters.find((x) => x.id === s.order[s.turn]);
        if (activeChar && isMyCombat) {
          if (p.id !== activeChar.id && (!owner || !isMmo)) {
            throw Error(`Não é seu turno. Aguarde o turno de ${activeChar.name}.`);
          }
        }
        log(`Turno de ${activeChar?.name || p.name || 'criatura'} concluído.`);
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
        const biome = ((p.biome || s.biome || 'village') as string).toLowerCase() as 'village' | 'forest' | 'dungeon';
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
          p.deathSuccess = 0;
          p.exhaustion = Math.max(0, p.exhaustion - 1);
          touchChar(p);
        }
        log('O grupo concluiu um descanso longo (8h). PV e espaços de magia restaurados.', 'roll');
        break;
      }
      case 'location': {
        const p = own();
        if (s.combat && (s.order || []).includes(p.id)) throw Error('Encerre o seu combate antes de viajar.');
        const n = Number(a.location);
        if (!locations[n]) throw Error('Local inválido.');

        // ─── Progression gating: auto-advance narrative ───
        const biomeTarget = locations[n]?.biome || 'forest';
        if (biomeTarget === 'forest' && (!p.questProgress || !p.questProgress.doran_talked)) {
          recordProgression(p, { doran_talked: true });
          log('📜 Você segue para a Floresta dos Sussurros com a missão do Ancião Doran.', 'gm');
        }

        // Determine which heroes travel: solo hero or party members
        const partyMembers = p.partyId
          ? s.characters.filter((c) => c.partyId === p.partyId)
          : [p];

        for (const member of partyMembers) {
          member.location = n;
          member.biome = locations[n].biome;
          member.act = (n + 1) as 1 | 2 | 3;
          touchChar(member);
        }

        if (!isMmo) {
          s.location = n;
          s.biome = locations[n].biome;
          s.act = (n + 1) as 1 | 2 | 3;
        }

        // Reposition traveling heroes to safe entrance coordinates in the destination biome
        const spawnCoords: Record<string, { x: number; y: number }> = {
          village: { x: 4, y: 5 },
          forest: { x: 3, y: 3 },
          ruins: { x: 3, y: 6 },
          dungeon: { x: 4, y: 6 },
          canyon: { x: 3, y: 6 },
          lair: { x: 3, y: 6 }
        };
        const pos = spawnCoords[locations[n].biome] || { x: 4, y: 5 };
        for (let i = 0; i < partyMembers.length; i++) {
          partyMembers[i].x = pos.x + (i % 2);
          partyMembers[i].y = pos.y + Math.floor(i / 2);
          touchChar(partyMembers[i]);
        }

        // Remove previous enemies belonging to this party / solo player
        const partyId = p.partyId;
        s.enemies = (s.enemies || []).filter((e) => {
          if (partyId && e.partyId === partyId) return false;
          if (!partyId && (e.ownerCharId === p.id || (!e.partyId && !e.ownerCharId && !isMmo))) return false;
          return true;
        });

        // Configure enemies appropriate for destination biome (scoped to this party / hero)
        let newBiomeEnemies: Enemy[] = [];
        if (locations[n].biome === 'forest') {
          newBiomeEnemies = [
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
        } else if (locations[n].biome === 'ruins') {
          newBiomeEnemies = [
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
        } else if (locations[n].biome === 'dungeon') {
          newBiomeEnemies = [
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
        } else if (locations[n].biome === 'canyon') {
          newBiomeEnemies = [
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
        } else if (locations[n].biome === 'lair') {
          newBiomeEnemies = [
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
        }

        for (const e of newBiomeEnemies) {
          e.biome = locations[n].biome;
          e.partyId = partyId;
          e.ownerCharId = partyId ? undefined : p.id;
          touchChar(e);
        }
        s.enemies.push(...newBiomeEnemies);

        // Reset combat for traveling heroes
        s.order = (s.order || []).filter((id) => !partyMembers.some((m) => m.id === id));
        if (!s.characters.some((c) => (s.order || []).includes(c.id))) {
          s.combat = false;
          s.round = 0;
          s.turn = 0;
        }
        s.actionUsed = false;
        s.movementUsed = 0;

        if (locations[n].biome === 'dungeon' || n === 2) {
          recordProgression(p, { dungeon_entered: true });
        }

        const partyLabel = partyMembers.length > 1 ? `O grupo de ${p.name}` : p.name;
        log(`${partyLabel} viajou para ${locations[n].name}. ${locations[n].text}`, 'gm');
        if (newBiomeEnemies.length > 0) {
          log(`⚠️ Criaturas hostis espreitam os arredores. Prepare-se para o combate ou explore a área.`, 'gm');
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
        const p = own();
        if (stepKey) {
          recordProgression(p, { [stepKey]: true });
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

        log(`ðŸŒŸ LEVEL UP! ${p.name} alcanÃ§ou o NÃ VEL ${newLevel}! (+${hpGain} PV MÃ¡x). ParabÃ©ns!`, 'gm');
        break;
      }
      case 'respawn': {
        const hero = own();

        const heroPartyId = hero.partyId;
        const combatKey = heroPartyId || hero.id;

        // Guarda referencia sobre a batalha ANTES de mandar para a vila.
        const wasInCombat =
          s.combat &&
          (s.order || []).includes(hero.id) &&
          (
            !s.combatPartyId ||
            s.combatPartyId === combatKey
          );

        const oldOrder = [...(s.order || [])];
        const removedIndex = oldOrder.indexOf(hero.id);

        if (removedIndex >= 0) {
          s.order = oldOrder.filter((id) => id !== hero.id);

          if (s.order.length === 0) {
            s.turn = 0;
          } else {
            // Se removemos alguem antes do turno atual,
            // compensamos o indice.
            if (removedIndex < s.turn) {
              s.turn = Math.max(0, s.turn - 1);
            }

            if (s.turn >= s.order.length) {
              s.turn = 0;
            }
          }
        }

        hero.hp = hero.maxHp;
        hero.conditions = [];
        hero.deathSuccess = 0;
        hero.deathFail = 0;

        hero.x = 4;
        hero.y = 6;
        hero.location = 0;
        hero.biome = 'village';

        touchChar(hero);

        if (!isMmo) {
          s.combat = false;
          s.combatPartyId = undefined;
          s.order = [];
          s.turn = 0;
          s.round = 0;
          s.actionUsed = false;
          s.movementUsed = 0;
          s.location = 0;
          s.biome = 'village';
          s.enemies = [];

          log(
            '??? ' +
              hero.name +
              ' recuperou a consciencia no Santuario da Vila.',
            'gm'
          );

          break;
        }

        const survivingHeroes = (s.characters || []).filter((char) => {
          if (char.id === hero.id) return false;
          if (char.hp <= 0) return false;
          if (!(s.order || []).includes(char.id)) return false;

          if (heroPartyId) {
            return char.partyId === heroPartyId;
          }

          return false;
        });

        const activeEnemies = (s.enemies || []).filter((enemy) => {
          if (enemy.hp <= 0) return false;
          if (!(s.order || []).includes(enemy.id)) return false;

          if (heroPartyId) {
            return enemy.partyId === heroPartyId;
          }

          return enemy.ownerCharId === hero.id;
        });

        const partyBattleContinues =
          wasInCombat &&
          survivingHeroes.length > 0 &&
          activeEnemies.length > 0;

        if (!partyBattleContinues) {
          const remainingLivingHeroes =
            (s.characters || []).filter(
              (char) =>
                char.hp > 0 &&
                (s.order || []).includes(char.id)
            );

          const remainingLivingEnemies =
            (s.enemies || []).filter(
              (enemy) =>
                enemy.hp > 0 &&
                (s.order || []).includes(enemy.id)
            );

          if (
            remainingLivingHeroes.length === 0 ||
            remainingLivingEnemies.length === 0
          ) {
            s.combat = false;
            s.combatPartyId = undefined;
            s.order = [];
            s.turn = 0;
            s.round = 0;
            s.actionUsed = false;
            s.movementUsed = 0;
          }
        }

        log(
          '??? ' +
            hero.name +
            ' renasceu no Santuario da Vila.' +
            (
              partyBattleContinues
                ? ' O restante do grupo continua lutando; voce pode retornar como reforco.'
                : ''
            ),
          'gm'
        );

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

        // Merge and synchronize progression for party members
        const mergedProg = mergePartyProgress(inviter, receiver);
        inviter.questProgress = { ...mergedProg.questProgress };
        inviter.worldFlags = { ...mergedProg.worldFlags };
        inviter.act = mergedProg.act;
        receiver.questProgress = { ...mergedProg.questProgress };
        receiver.worldFlags = { ...mergedProg.worldFlags };
        receiver.act = mergedProg.act;
        touchChar(inviter);
        touchChar(receiver);

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

        p.inventory =
          addInventoryItem(
            p.inventory || '',
            itemToBuy.name,
            1
          );

        if (rawItem) {
          registerProceduralItem(rawItem);
        }
        touchChar(p);
        log(`🛒 ${p.name} comprou "${itemToBuy.name}" por ${finalPrice} PO. (Saldo: ${p.gold} PO)`, 'player');
        break;
      }
      case 'sellItem': {
        const p = own();

        const itemName =
          stripInventoryQuantity(
            String(a.itemName || '').trim()
          );

        if (!itemName) {
          throw Error(
            'Nome do item invalido para venda.'
          );
        }

        const quantityBefore =
          getInventoryQuantity(
            p.inventory || '',
            itemName
          );

        if (quantityBefore <= 0) {
          throw Error(
            'Voce nao possui "' +
              itemName +
              '" no inventario.'
          );
        }

        const removed =
          removeInventoryItem(
            p.inventory || '',
            itemName,
            1
          );

        if (removed.removed !== 1) {
          throw Error(
            'Nao foi possivel remover o item do inventario.'
          );
        }

        const catalogEntry =
          Object.values(ITEMS_CATALOG).find(
            (item) =>
              item.name.toLowerCase() ===
              itemName.toLowerCase()
          );

        const baseValue =
          catalogEntry?.value ||
          Number(a.baseValue) ||
          10;

        const priceMult =
          s.economyContext?.priceMultiplier ||
          1.0;

        const salePrice =
          Math.max(
            1,
            Math.round(
              baseValue *
                0.5 *
                priceMult
            )
          );

        p.inventory = removed.inventory;
        p.gold = (p.gold || 0) + salePrice;

        touchChar(p);

        log(
          '?? ' +
            p.name +
            ' vendeu 1x "' +
            itemName +
            '" por ' +
            salePrice +
            ' PO. Saldo: ' +
            p.gold +
            ' PO.',
          'player'
        );

        break;
      }
      case 'heartbeat': {
        if (c) {
          touchChar(c);

          reconcileLegacyProgression(
            s,
            c
          );
        }

        try {
          const ctx =
            readCompactWorldContext(
              s,
              r.id
            );

          const pacing =
            evaluateDirectorPacing(
              ctx,
              r.id
            );

          if (
            pacing.canAct &&
            !s.combat
          ) {
            const hero = c;

            const rollChoice =
              Math.random();

            const heroBiome =
              hero?.biome ||
              s.biome ||
              'village';

            const scopedEnemies =
              hero
                ? (
                    s.enemies ||
                    []
                  ).filter(
                    (enemy) => {
                      if (
                        enemy.hp <= 0
                      ) {
                        return false;
                      }

                      if (
                        enemy.biome !==
                        heroBiome
                      ) {
                        return false;
                      }

                      if (
                        hero.partyId
                      ) {
                        return (
                          enemy.partyId ===
                          hero.partyId
                        );
                      }

                      return (
                        enemy.ownerCharId ===
                        hero.id
                      );
                    }
                  )
                : [];

            const canSpawn =
              Boolean(
                hero &&
                heroBiome !==
                  'village' &&
                !hero
                  .activeMicroAdventureId &&
                scopedEnemies.length ===
                  0
              );

            if (
              canSpawn &&
              rollChoice < 0.30
            ) {
              const byBiome: Record<
                string,
                string[]
              > = {
                forest: [
                  'Lobo das Sombras',
                  'Batedor Sombrio',
                  'Lobo Alfa das Cinzas'
                ],

                ruins: [
                  'Arqueiro do Culto',
                  'Ac?lito do Fogo Negro',
                  'Saqueador das Cinzas'
                ],

                dungeon: [
                  'Eco do Vazio',
                  'Guardi?o Espectral',
                  'Escriba Sombrio'
                ],

                canyon: [
                  'Draconiano da Fenda',
                  'Wyrmling Errante'
                ],

                lair: [
                  'Elemental de Magma',
                  'Sentinela de Obsidiana'
                ]
              };

              const table =
                byBiome[
                  heroBiome
                ] ||
                byBiome.forest;

              const creature =
                table[
                  Math.floor(
                    Math.random() *
                    table.length
                  )
                ];

              const oldIds =
                new Set(
                  s.enemies.map(
                    (enemy) =>
                      enemy.id
                  )
                );

              const tier =
                hero!.level >= 5
                  ? 3
                  : hero!.level >= 3
                    ? 2
                    : 1;

              const result =
                executeDirectorIntent(
                  'request_creature_spawn',
                  {
                    creatureName:
                      creature,
                    tier,
                    reason:
                      'Amea?a emergente coerente com a regi?o e o ritmo do mundo.'
                  },
                  s,
                  r.id
                );

              if (
                result.validation
                  .approved
              ) {
                const spawned =
                  [...s.enemies]
                    .reverse()
                    .find(
                      (enemy) =>
                        !oldIds.has(
                          enemy.id
                        )
                    );

                if (
                  spawned &&
                  hero
                ) {
                  spawned.biome =
                    heroBiome as any;

                  if (
                    hero.partyId
                  ) {
                    spawned.partyId =
                      hero.partyId;

                    spawned.ownerCharId =
                      undefined;
                  } else {
                    spawned.ownerCharId =
                      hero.id;

                    spawned.partyId =
                      undefined;
                  }

                  spawned.x =
                    Math.max(
                      0,
                      Math.min(
                        15,
                        hero.x + 4
                      )
                    );

                  spawned.y =
                    Math.max(
                      0,
                      Math.min(
                        15,
                        hero.y + 2
                      )
                    );

                  touchChar(
                    spawned
                  );
                }
              }
            } else if (
              hero &&
              !hero
                .activeMicroAdventureId &&
              rollChoice < 0.48
            ) {
              const oldNpcIds =
                new Set(
                  (
                    s.npcs ||
                    []
                  ).map(
                    (npc) =>
                      npc.id
                  )
                );

              const names =
                heroBiome ===
                  'village'
                  ? [
                      'Mercador Errante',
                      'Batedora da Fronteira',
                      'Mensageiro de Valdoria'
                    ]
                  : [
                      'Explorador Ferido',
                      'Ca?adora Errante',
                      'Cart?grafo Perdido'
                    ];

              const name =
                names[
                  Math.floor(
                    Math.random() *
                    names.length
                  )
                ];

              const result =
                executeDirectorIntent(
                  'request_temporary_npc',
                  {
                    name,
                    role:
                      'NPC de Evento',
                    description:
                      'Uma presen?a tempor?ria ligada aos acontecimentos recentes da regi?o.',
                    reason:
                      'Criar oportunidade social e sensa??o de mundo persistente.'
                  },
                  s,
                  r.id
                );

              if (
                result.validation
                  .approved &&
                hero
              ) {
                const npc =
                  [...(
                    s.npcs ||
                    []
                  )]
                    .reverse()
                    .find(
                      (candidate) =>
                        !oldNpcIds.has(
                          candidate.id
                        )
                    );

                if (npc) {
                  npc.biome =
                    heroBiome as any;

                  npc.x =
                    Math.max(
                      0,
                      Math.min(
                        15,
                        hero.x + 2
                      )
                    );

                  npc.y =
                    Math.max(
                      0,
                      Math.min(
                        15,
                        hero.y + 1
                      )
                    );
                }
              }
            } else if (
              rollChoice < 0.64
            ) {
              executeDirectorIntent(
                'influence_economy',
                {
                  multiplier:
                    Math.random() >
                      0.5
                      ? 1.10
                      : 0.94,
                  reason:
                    'Caravanas, conflitos e atividade regional alteraram temporariamente o com?rcio.'
                },
                s,
                r.id
              );
            } else if (
              rollChoice < 0.82
            ) {
              const critters:
                (
                  | 'lobos_rastros'
                  | 'cervos'
                  | 'corvos'
                )[] = [
                  'cervos',
                  'corvos',
                  'lobos_rastros'
                ];

              executeDirectorIntent(
                'adjust_ecosystem',
                {
                  critterType:
                    critters[
                      Math.floor(
                        Math.random() *
                        critters.length
                      )
                    ],
                  reason:
                    'A fauna responde aos acontecimentos recentes do mundo.'
                },
                s,
                r.id
              );
            } else {
              const endgame =
                Boolean(
                  hero
                    ?.questProgress
                    ?.campaign_completed
                );

              const events =
                endgame
                  ? [
                      'O quadro de contratos da Vila recebe novos pedidos de ca?adores, mercadores e estudiosos.',
                      'Rumores indicam que criaturas est?o tentando ocupar territ?rios deixados vazios ap?s a queda de Ignisrax.',
                      'Uma patrulha relata atividade incomum nas antigas rotas do culto e oferece recompensa por investiga??o.'
                    ]
                  : heroBiome ===
                      'village'
                    ? [
                        'Uma caravana entra na pra?a trazendo not?cias de regi?es distantes.',
                        'Os sinos da guarda anunciam movimento incomum nas estradas.',
                        'Mercadores discutem rumores sobre criaturas migrando entre regi?es.'
                      ]
                    : [
                        'Pegadas recentes cruzam a trilha e desaparecem fora do caminho principal.',
                        'Um som distante quebra o sil?ncio, sugerindo atividade al?m do campo de vis?o.',
                        'A fauna abandona a ?rea repentinamente, como se algo maior estivesse se aproximando.'
                      ];

              executeDirectorIntent(
                'request_environmental_event',
                {
                  text:
                    events[
                      Math.floor(
                        Math.random() *
                        events.length
                      )
                    ],
                  reason:
                    'Evento emergente do mundo persistente.'
                },
                s,
                r.id
              );
            }
          }
        } catch (err) {
          console.warn(
            '[SandboxDirector Heartbeat Evaluation]',
            err
          );
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
      } else if (a.action === 'location' || a.action === 'heartbeat') {
        const fresh = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(r.id).first<Room>();
        if (fresh) {
          await db.prepare('UPDATE rooms SET state=?,version=version+1 WHERE id=?')
            .bind(JSON.stringify(s), fresh.id)
            .run();
          r = fresh;
        }
      } else {
        const latest = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(r.id).first<Room>();
        return withUserSession(NextResponse.json({
          error: 'Outra ação chegou primeiro. Atualize e tente novamente.',
          room: latest ? { ...latest, state: JSON.parse(latest.state) } : undefined
        }, { status: 409 }), user);
      }
    }

    if (!r) {
      return withUserSession(NextResponse.json({ error: 'Mesa não encontrada' }, { status: 404 }), user);
    }

    const updatedRoom: Room = {
      ...r,
      id: r.id,
      owner: r.owner || '',
      name: r.name || '',
      code: r.code || '',
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
      healResult: clientHealResult,
      lootResult: clientLootResult
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
  const orderEnemies = (s.enemies || []).filter((x) => (s.order || []).includes(x.id));
  const orderChars = (s.characters || []).filter((x) => (s.order || []).includes(x.id));
  if (orderEnemies.length > 0 && orderEnemies.every((x) => x.hp <= 0)) {
    s.combat = false;
    s.combatPartyId = undefined;
    s.order = [];
    s.actionUsed = false;
    s.movementUsed = 0;
    s.logs.push(entry('Vitória! Todos os inimigos do combate foram derrotados.', 'gm'));
    return;
  }
  if (orderChars.length > 0 && orderChars.every((x) => x.hp <= 0)) {
    s.combat = false;
    s.combatPartyId = undefined;
    s.order = [];
    s.actionUsed = false;
    s.movementUsed = 0;
    s.logs.push(entry('Os combatentes caíram inconscientes.', 'gm'));
    return;
  }
  if (!s.order || s.order.length === 0) {
    s.combat = false;
    s.combatPartyId = undefined;
    return;
  }
  let safety = 0;
  do {
    s.turn = (s.turn + 1) % s.order.length;
    if (s.turn === 0) s.round++;
    safety++;
    if (safety > s.order.length + 2) {
      // All entities are dead or missing — end combat
      s.combat = false;
      s.combatPartyId = undefined;
      s.order = [];
      s.actionUsed = false;
      s.movementUsed = 0;
      s.logs.push(entry('O combate terminou — nenhuma criatura ativa restante.', 'gm'));
      return;
    }
    const entity = [...s.characters, ...s.enemies].find((x) => x.id === s.order[s.turn]);
    if (!entity) continue; // Entity no longer exists — skip
    if (entity.hp > 0) break; // Found alive entity
  } while (true);

  // Ready action for newly active entity
  s.actionUsed = false;
  s.movementUsed = 0;
}

function executeSingleEnemyRevenge(
  enemy: Enemy,
  attacker: Character,
  s: State
) {
  if (
    enemy.hp <= 0 ||
    attacker.hp <= 0
  ) {
    return;
  }

  const profile =
    getCreatureProfile(
      enemy.name
    );

  const distance = () =>
    Math.max(
      Math.abs(
        attacker.x -
        enemy.x
      ),
      Math.abs(
        attacker.y -
        enemy.y
      )
    );

  let dist =
    distance();

  // Ranged creatures attempt to keep some distance.
  if (
    profile.attackRange > 1 &&
    dist <= 1
  ) {
    for (
      let i = 0;
      i <
      Math.min(
        2,
        profile.moveSquares
      );
      i++
    ) {
      const nx =
        enemy.x -
        Math.sign(
          attacker.x -
          enemy.x
        );

      const ny =
        enemy.y -
        Math.sign(
          attacker.y -
          enemy.y
        );

      if (
        nx < 0 ||
        nx > 15 ||
        ny < 0 ||
        ny > 15
      ) {
        break;
      }

      enemy.x = nx;
      enemy.y = ny;
    }

    touchChar(enemy);
  } else if (
    dist >
    profile.attackRange
  ) {
    const steps =
      Math.min(
        profile.moveSquares,
        Math.max(
          0,
          dist -
          profile.attackRange
        )
      );

    for (
      let i = 0;
      i < steps;
      i++
    ) {
      const nx =
        enemy.x +
        Math.sign(
          attacker.x -
          enemy.x
        );

      const ny =
        enemy.y +
        Math.sign(
          attacker.y -
          enemy.y
        );

      if (
        nx < 0 ||
        nx > 15 ||
        ny < 0 ||
        ny > 15
      ) {
        break;
      }

      enemy.x = nx;
      enemy.y = ny;
    }

    touchChar(enemy);
  }

  dist =
    distance();

  if (
    dist >
    profile.attackRange
  ) {
    s.logs.push(
      entry(
        enemy.name +
          ' se reposiciona, buscando alcance para ' +
          profile.attackName +
          '.',
        'roll'
      )
    );

    return;
  }

  const result =
    resolveAttack(
      {
        name:
          enemy.name +
          ' ? ' +
          profile.attackName,
        attack:
          enemy.attack,
        damage:
          enemy.damage,
        conditions:
          enemy.conditions || [],
        weapon:
          enemy.weapon ||
          profile.attackName
      },
      {
        id:
          attacker.id,
        name:
          attacker.name,
        ac:
          attacker.ac,
        hp:
          attacker.hp,
        conditions:
          attacker.conditions
      },
      'normal',
      profile.attackRange > 1
    );

  attacker.hp =
    result.hpAfter;

  touchChar(attacker);

  s.logs.push(
    entry(
      '? ' +
        result.text,
      'roll'
    )
  );
}

function executeEnemyAI(s: State) {
  let safety = 0;

  const attackedTargets =
    new Set<string>();

  const distance = (
    a: {
      x: number;
      y: number;
    },
    b: {
      x: number;
      y: number;
    }
  ) =>
    Math.max(
      Math.abs(
        a.x - b.x
      ),
      Math.abs(
        a.y - b.y
      )
    );

  const moveRelative = (
    enemy: Enemy,
    target: Character,
    toward: boolean,
    steps: number
  ) => {
    for (
      let i = 0;
      i < steps;
      i++
    ) {
      const sx =
        Math.sign(
          target.x -
          enemy.x
        );

      const sy =
        Math.sign(
          target.y -
          enemy.y
        );

      const nx =
        toward
          ? enemy.x + sx
          : enemy.x - sx;

      const ny =
        toward
          ? enemy.y + sy
          : enemy.y - sy;

      if (
        nx < 0 ||
        nx > 15 ||
        ny < 0 ||
        ny > 15
      ) {
        break;
      }

      enemy.x = nx;
      enemy.y = ny;
    }

    touchChar(enemy);
  };

  while (
    s.combat &&
    safety < 20
  ) {
    safety++;

    const currentId =
      s.order[s.turn];

    if (!currentId) {
      break;
    }

    const enemy =
      s.enemies.find(
        (candidate) =>
          candidate.id ===
            currentId &&
          candidate.hp > 0
      );

    if (!enemy) {
      break;
    }

    const profile =
      getCreatureProfile(
        enemy.name
      );

    const biome =
      enemy.biome ||
      'village';

    const heroes =
      s.characters.filter(
        (hero) => {
          if (
            hero.hp <= 0
          ) {
            return false;
          }

          if (
            !(s.order || [])
              .includes(
                hero.id
              )
          ) {
            return false;
          }

          if (
            (
              hero.biome ||
              'village'
            ) !== biome
          ) {
            return false;
          }

          if (
            enemy.partyId
          ) {
            return (
              hero.partyId ===
              enemy.partyId
            );
          }

          if (
            enemy.ownerCharId
          ) {
            return (
              hero.id ===
              enemy.ownerCharId
            );
          }

          return true;
        }
      );

    if (
      heroes.length === 0
    ) {
      s.combat = false;
      s.combatPartyId =
        undefined;
      s.actionUsed = false;
      s.movementUsed = 0;
      break;
    }

    const notAttacked =
      heroes.filter(
        (hero) =>
          !attackedTargets.has(
            hero.id
          )
      );

    const candidates =
      notAttacked.length
        ? notAttacked
        : heroes;

    const target =
      [...candidates]
        .sort(
          (a, b) => {
            if (
              profile.aiStyle ===
              'boss'
            ) {
              const ah =
                a.hp /
                Math.max(
                  1,
                  a.maxHp
                );

              const bh =
                b.hp /
                Math.max(
                  1,
                  b.maxHp
                );

              if (ah !== bh) {
                return ah - bh;
              }
            }

            if (
              profile.aiStyle ===
                'caster' ||
              profile.aiStyle ===
                'dragon'
            ) {
              if (
                a.ac !== b.ac
              ) {
                return (
                  a.ac -
                  b.ac
                );
              }
            }

            return (
              distance(
                enemy,
                a
              ) -
              distance(
                enemy,
                b
              )
            );
          }
        )[0];

    attackedTargets.add(
      target.id
    );

    let dist =
      distance(
        enemy,
        target
      );

    if (
      profile.attackRange > 1 &&
      dist <= 1
    ) {
      moveRelative(
        enemy,
        target,
        false,
        Math.min(
          2,
          profile.moveSquares
        )
      );
    } else if (
      dist >
      profile.attackRange
    ) {
      moveRelative(
        enemy,
        target,
        true,
        Math.min(
          profile.moveSquares,
          Math.max(
            0,
            dist -
              profile.attackRange
          )
        )
      );
    }

    dist =
      distance(
        enemy,
        target
      );

    const specialReady =
      Boolean(
        profile.specialKind &&
        profile.specialKind !==
          'none' &&
        profile.specialEvery &&
        s.round > 0 &&
        s.round %
          profile.specialEvery ===
          0
      );

    let acted = false;

    if (
      specialReady &&
      (
        profile.specialKind ===
          'breath' ||
        profile.specialKind ===
          'void_burst'
      ) &&
      profile.specialDamage
    ) {
      const specialRange =
        profile.specialRange ||
        4;

      const targets =
        heroes
          .filter(
            (hero) =>
              distance(
                enemy,
                hero
              ) <=
              specialRange
          )
          .sort(
            (a, b) =>
              distance(
                enemy,
                a
              ) -
              distance(
                enemy,
                b
              )
          )
          .slice(
            0,
            profile.aiStyle ===
              'dragon'
              ? 3
              : 2
          );

      if (
        targets.length > 0
      ) {
        const damage =
          roll(
            profile.specialDamage
          ).total;

        const dc =
          profile.saveDc ||
          13;

        const results:
          string[] =
          [];

        for (
          const hero of
          targets
        ) {
          const save =
            d20().raw +
            mod(
              hero.stats[1]
            );

          const saved =
            save >= dc;

          const dealt =
            saved
              ? Math.floor(
                  damage / 2
                )
              : damage;

          hero.hp =
            Math.max(
              0,
              hero.hp -
                dealt
            );

          touchChar(hero);

          results.push(
            hero.name +
              ': -' +
              dealt +
              ' PV' +
              (
                saved
                  ? ' (salvou)'
                  : ''
              )
          );
        }

        s.logs.push(
          entry(
            '?? ' +
              enemy.name +
              ' usa ' +
              (
                profile.specialName ||
                'Ataque Especial'
              ) +
              '! CD ' +
              dc +
              ' DES. ' +
              results.join(
                ' ? '
              ),
            'roll'
          )
        );

        acted = true;
      }
    }

    if (
      specialReady &&
      !acted &&
      profile.specialKind ===
        'arcane' &&
      profile.specialDamage &&
      dist <=
        (
          profile.specialRange ||
          profile.attackRange
        )
    ) {
      const result =
        resolveAttack(
          {
            name:
              enemy.name +
              ' ? ' +
              (
                profile.specialName ||
                'Ataque Especial'
              ),
            attack:
              enemy.attack +
              1,
            damage:
              profile.specialDamage,
            conditions:
              enemy.conditions ||
              [],
            weapon:
              profile.specialName
          },
          {
            id:
              target.id,
            name:
              target.name,
            ac:
              target.ac,
            hp:
              target.hp,
            conditions:
              target.conditions
          },
          'normal',
          true
        );

      target.hp =
        result.hpAfter;

      touchChar(target);

      s.logs.push(
        entry(
          result.text,
          'roll'
        )
      );

      acted = true;
    }

    if (
      specialReady &&
      !acted &&
      profile.specialKind ===
        'bash' &&
      dist <= 1
    ) {
      const result =
        resolveAttack(
          {
            name:
              enemy.name +
              ' ? ' +
              (
                profile.specialName ||
                'Impacto'
              ),
            attack:
              enemy.attack,
            damage:
              profile.specialDamage ||
              enemy.damage,
            conditions:
              enemy.conditions ||
              [],
            weapon:
              profile.specialName
          },
          {
            id:
              target.id,
            name:
              target.name,
            ac:
              target.ac,
            hp:
              target.hp,
            conditions:
              target.conditions
          }
        );

      target.hp =
        result.hpAfter;

      if (
        result.hit &&
        target.hp > 0
      ) {
        const pushX =
          target.x +
          Math.sign(
            target.x -
            enemy.x
          );

        const pushY =
          target.y +
          Math.sign(
            target.y -
            enemy.y
          );

        if (
          pushX >= 0 &&
          pushX <= 15 &&
          pushY >= 0 &&
          pushY <= 15
        ) {
          target.x =
            pushX;

          target.y =
            pushY;
        }
      }

      touchChar(target);

      s.logs.push(
        entry(
          result.text +
            (
              result.hit &&
              target.hp > 0
                ? ' O impacto empurra o alvo para tr?s.'
                : ''
            ),
          'roll'
        )
      );

      acted = true;
    }

    if (
      !acted &&
      dist <=
        profile.attackRange
    ) {
      let mode:
        'normal' |
        'advantage' =
        'normal';

      if (
        profile.aiStyle ===
        'skirmisher'
      ) {
        const packMate =
          s.enemies.some(
            (other) =>
              other.id !==
                enemy.id &&
              other.hp > 0 &&
              other.biome ===
                enemy.biome &&
              distance(
                other,
                target
              ) <= 1
          );

        if (packMate) {
          mode =
            'advantage';
        }
      }

      const result =
        resolveAttack(
          {
            name:
              enemy.name +
              ' ? ' +
              profile.attackName,
            attack:
              enemy.attack,
            damage:
              enemy.damage,
            conditions:
              enemy.conditions ||
              [],
            weapon:
              enemy.weapon ||
              profile.attackName
          },
          {
            id:
              target.id,
            name:
              target.name,
            ac:
              target.ac,
            hp:
              target.hp,
            conditions:
              target.conditions
          },
          mode,
          profile.attackRange > 1
        );

      target.hp =
        result.hpAfter;

      touchChar(target);

      s.logs.push(
        entry(
          result.text,
          'roll'
        )
      );

      acted = true;

      if (
        profile.aiStyle ===
          'skirmisher' &&
        target.hp > 0
      ) {
        moveRelative(
          enemy,
          target,
          false,
          1
        );
      }
    }

    if (!acted) {
      s.logs.push(
        entry(
          enemy.name +
            ' se reposiciona para usar ' +
            profile.attackName +
            '.',
          'roll'
        )
      );
    }

    if (
      target.hp <= 0
    ) {
      s.logs.push(
        entry(
          '?? ' +
            target.name +
            ' caiu diante de ' +
            enemy.name +
            '.',
          'gm'
        )
      );
    }

    advance(s);
  }

  if (s.combat) {
    s.actionUsed = false;
    s.movementUsed = 0;
  }
}
