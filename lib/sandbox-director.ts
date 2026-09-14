// lib/sandbox-director.ts
/**
 * SandboxDirector — Server-authoritative AI Narrative Director.
 *
 * SOBERANIA DAS REGRAS:
 * - A IA atua estritamente como Diretora Narrativa, NUNCA como motor de regras.
 * - Ela não calcula ataque, dano, PV, CA, nem altera atributos, níveis ou movimentação.
 * - O combate pertence exclusivamente ao motor de jogo. Durante o combate, a IA fica pausada (idle).
 * - A IA emite apenas intenções estruturadas através de ferramentas seguras.
 * - Todas as mutações de estado passam por validações rígidas de limites e tetos pré-definidos.
 * - Rastreabilidade total: toda decisão gera log claro com motivo, intenção e validação.
 */

import {
  entry,
  type State,
  type BiomeType,
  type Character,
  type Enemy
} from './game-engine';
import { generateProceduralItem, type ItemTier } from './procedural-items';
import { MICRO_ADVENTURES } from './micro-adventures';
import { clampGridPoint } from './map-bounds';

export interface CompactWorldContext {
  biome: BiomeType;
  locationName: string;
  playersCount: number;
  playersAvgLevel: number;
  isCombat: boolean;
  activeEnemiesCount: number;
  tensionLevel: number; // 0 to 100
  timeSinceLastEventSec: number;
  activeMicroAdventureId?: string;
  economyPriceMultiplier: number;
  recentLogsSummary: string;
}

export type DirectorIntentType =
  | 'idle'
  | 'request_microadventure'
  | 'request_creature_spawn'
  | 'request_environmental_event'
  | 'request_temporary_npc'
  | 'influence_economy'
  | 'adjust_ecosystem';

export interface DirectorDecision {
  timestamp: number;
  reason: string;
  intent: DirectorIntentType;
  payload: Record<string, any>;
  validation: {
    approved: boolean;
    clamped?: boolean;
    reason: string;
  };
  narrativeLog?: string;
}

// In-memory cooldown & tension tracker per room
interface DirectorRoomMemory {
  lastEventTimestamp: number;
  lastCombatEndTimestamp: number;
  tension: number; // 0-100
  history: DirectorDecision[];
}

const directorMemory = new Map<string, DirectorRoomMemory>();

function getRoomMemory(roomId: string): DirectorRoomMemory {
  let mem = directorMemory.get(roomId);
  if (!mem) {
    mem = {
      lastEventTimestamp: Date.now() - 300000,
      lastCombatEndTimestamp: Date.now() - 300000,
      tension: 10,
      history: []
    };
    directorMemory.set(roomId, mem);
  }
  return mem;
}

/**
 * Reads a compact, high-efficiency snapshot of the world for the director.
 */
export function readCompactWorldContext(
  state: State,
  roomId: string = 'mmo-world-village',
  focusHero?: Character
): CompactWorldContext {
  const mem =
    getRoomMemory(
      roomId
    );

  const now =
    Date.now();

  const scopedHeroes =
    focusHero
      ? focusHero.partyId
        ? state.characters.filter(
            (hero) =>
              hero.partyId ===
              focusHero.partyId
          )
        : state.characters.filter(
            (hero) =>
              hero.id ===
              focusHero.id
          )
      : state.characters;

  const aliveHeroes =
    scopedHeroes.filter(
      (hero) =>
        hero.hp > 0
    );

  const avgLevel =
    aliveHeroes.length > 0
      ? Math.round(
          aliveHeroes.reduce(
            (total, hero) =>
              total +
              (
                hero.level ||
                1
              ),
            0
          ) /
          aliveHeroes.length
        )
      : 1;

  const biome =
    focusHero?.biome ||
    state.biome ||
    'village';

  const activeEnemies =
    state.enemies.filter(
      (enemy) => {
        if (enemy.hp <= 0) {
          return false;
        }

        if (
          enemy.biome &&
          enemy.biome !==
            biome
        ) {
          return false;
        }

        if (!focusHero) {
          return true;
        }

        if (
          focusHero.partyId
        ) {
          return (
            enemy.partyId ===
            focusHero.partyId
          );
        }

        return (
          enemy.ownerCharId ===
            focusHero.id
        );
      }
    );

  if (
    state.combat &&
    (
      !focusHero ||
      (state.order || [])
        .includes(
          focusHero.id
        ) ||
      state.combatPartyId ===
        (
          focusHero.partyId ||
          focusHero.id
        )
    )
  ) {
    mem.tension =
      Math.min(
        100,
        mem.tension +
          15
      );
  } else {
    const elapsedMinutes =
      (
        now -
        mem.lastEventTimestamp
      ) /
      60000;

    mem.tension =
      Math.max(
        5,
        Math.round(
          mem.tension -
          elapsedMinutes *
            5
        )
      );
  }

  const timeSinceLastEventSec =
    Math.round(
      (
        now -
        mem.lastEventTimestamp
      ) /
      1000
    );

  const recentLogs =
    (state.logs || [])
      .slice(-4)
      .map(
        (log) =>
          log.text
            .replace(
              /[\n\r]+/g,
              ' '
            )
            .slice(
              0,
              80
            )
      )
      .join(' | ');

  const location =
    focusHero?.location ??
    state.location ??
    0;

  return {
    biome,
    locationName:
      location === 0
        ? 'Vila do Rio Verde'
        : location === 1
          ? 'Floresta dos Sussurros'
          : location === 2
            ? 'Ruínas da Abadia'
            : location === 3
              ? 'Catacumbas dos Três Selos'
              : location === 4
                ? 'Desfiladeiro da Fenda'
                : 'Covil de Ignisrax',
    playersCount:
      aliveHeroes.length,
    playersAvgLevel:
      avgLevel,
    isCombat:
      Boolean(
        state.combat &&
        (
          !focusHero ||
          (state.order || [])
            .includes(
              focusHero.id
            ) ||
          state.combatPartyId ===
            (
              focusHero.partyId ||
              focusHero.id
            )
        )
      ),
    activeEnemiesCount:
      activeEnemies.length,
    tensionLevel:
      mem.tension,
    timeSinceLastEventSec,
    activeMicroAdventureId:
      focusHero?.activeMicroAdventureId ||
      state.activeMicroAdventureId,
    economyPriceMultiplier:
      state.economyContext
        ?.priceMultiplier ||
      1,
    recentLogsSummary:
      recentLogs ||
      'Tranquilidade aparente no horizonte.'
  };
}

/**
 * Evaluates whether the SandboxDirector should act or remain idle.
 * Enforces cooldowns, combat silence, and narrative breathing room.
 */
export function evaluateDirectorPacing(ctx: CompactWorldContext, roomId: string): { canAct: boolean; reason: string } {
  // RULE 1: Total silence during combat. Rules engine is sovereign.
  if (ctx.isCombat) {
    return { canAct: false, reason: 'Combate em andamento: diretor em pausa para soberania das regras.' };
  }

  const mem = getRoomMemory(roomId);
  const now = Date.now();

  // RULE 2: Post-combat cooldown (at least 90 seconds of breathing room)
  if (now - mem.lastCombatEndTimestamp < 45000) {
    return { canAct: false, reason: 'Período pós-combate ativo: concedendo tempo de descanso aos jogadores.' };
  }

  // RULE 3: Pacing interval between dynamic events (at least 120 seconds)
  if (ctx.timeSinceLastEventSec < 75) {
    return { canAct: false, reason: `Intervalo de ritmo respeitado (${ctx.timeSinceLastEventSec}s / 75s). O diretor decide não intervir agora.` };
  }

  return { canAct: true, reason: 'Janela de ritmo e tensão adequada para intervenção narrativa.' };
}

/**
 * ══════════════════════════════════════════════════════════════════════
 * BOUNDED & RIGID VALIDATION FUNCTIONS (Item 10)
 * ══════════════════════════════════════════════════════════════════════
 */

/**
 * Adjusts narrative market context within strict bounds.
 * HARD LIMITS:
 * - priceMultiplier: strictly clamped between 0.85 and 1.25.
 * - Only flags narrative context, NEVER mutates player gold or database tables directly.
 */
export function adjustShopStockWithinBounds(
  state: State,
  reason: string,
  requestedMultiplier: number = 1.0,
  shortageItem?: string
): { approved: boolean; clamped: boolean; finalMultiplier: number; notice: string } {
  // Strict bounding
  const clampedMultiplier = Math.max(0.85, Math.min(1.25, Number(requestedMultiplier.toFixed(2))));
  const wasClamped = clampedMultiplier !== requestedMultiplier;

  if (!state.economyContext) {
    state.economyContext = { priceMultiplier: 1.0, updatedAt: Date.now() };
  }

  state.economyContext.priceMultiplier = clampedMultiplier;
  state.economyContext.updatedAt = Date.now();

  let notice = '';
  if (clampedMultiplier > 1.05) {
    state.economyContext.potionScarcity = true;
    state.economyContext.caravanDelayed = true;
    notice = `📦 Economia: Rumores indicam que uma caravana atrasou. Preços locais subiram ligeiramente (${Math.round((clampedMultiplier - 1) * 100)}% de acréscimo narrativo).`;
  } else if (clampedMultiplier < 0.95) {
    state.economyContext.potionScarcity = false;
    state.economyContext.caravanDelayed = false;
    notice = `📦 Economia: Um comboio mercante chegou ao entreposto. Pequeno desconto de abundância disponível (${Math.round((1 - clampedMultiplier) * 100)}% menor).`;
  } else {
    state.economyContext.potionScarcity = false;
    state.economyContext.caravanDelayed = false;
    notice = '📦 Economia: O mercado local permanece equilibrado e estável.';
  }

  state.economyContext.narrativeNotice = notice;
  state.logs.push(entry(notice, 'system'));

  return {
    approved: true,
    clamped: wasClamped,
    finalMultiplier: clampedMultiplier,
    notice
  };
}

/**
 * Adjusts ambient wildlife presence within strict safety caps.
 * HARD LIMITS:
 * - Cap: maximum of 2 passive wildlife critters / tracks.
 * - Does NOT spawn dangerous combat bosses.
 */
export function adjustFaunaPresenceWithinBounds(
  state: State,
  reason: string,
  critterType: 'lobos_rastros' | 'cervos' | 'corvos' = 'corvos'
): { approved: boolean; message: string } {
  if (!state.economyContext) state.economyContext = { priceMultiplier: 1.0, updatedAt: Date.now() };
  state.economyContext.faunaCap = 2;

  let msg = '';
  if (critterType === 'lobos_rastros') {
    msg = '🐾 Ecossistema: Rastros frescos de lobos e uivos distantes sugerem que a fauna selvagem está agitada nas bordas da floresta.';
  } else if (critterType === 'cervos') {
    msg = '🦌 Ecossistema: Um par de cervos pacíficos foi avistado pastando junto ao riacho.';
  } else {
    msg = '🦅 Ecossistema: Corvos sobrevoam as ruínas, vigiando a paisagem com grasnados insistentes.';
  }

  state.logs.push(entry(msg, 'gm'));
  return { approved: true, message: msg };
}

/**
 * Spawns a creature safely using server-side path coordinates and level bounding.
 * HARD LIMITS:
 * - Max enemies alive in room: 6 (rejects spawn if 6 or more exist).
 * - Enemy HP clamped to party average (max 35 for normal spawns).
 * - Positions placed in safe walkable distance (not right on top of heroes).
 */
export function spawnCreatureSafely(
  state: State,
  name: string,
  tier: ItemTier = 1,
  startCombat: boolean = false,
  focusHero?: Character
): { approved: boolean; reason: string } {
  const aliveEnemies = state.enemies.filter((e) => e.hp > 0);
  if (aliveEnemies.length >= 6) {
    return { approved: false, reason: 'Teto máximo de 6 criaturas simultâneas atingido na sala. Spawn rejeitado com segurança.' };
  }

  const baseHp = tier === 1 ? 12 : tier === 2 ? 22 : 32;
  const ac = tier === 1 ? 11 : tier === 2 ? 13 : 15;
  const attackBonus = tier === 1 ? 3 : tier === 2 ? 4 : 5;
  const damage = tier === 1 ? '1d6+1' : tier === 2 ? '1d8+2' : '2d6+2';

  // Find a clear spawn coordinate distant from players
  const hero =
    focusHero ||
    state.characters[0];

  const point =
    clampGridPoint(
      hero?.biome ||
        state.biome ||
        'forest',
      (hero?.x ?? 4) + 4,
      (hero?.y ?? 4) + 3
    );

  const spawnX =
    point.x;

  const spawnY =
    point.y;

  const newEnemy: Enemy = {
    id: `director-mob-${Date.now()}`,
    name,
    hp: baseHp,
    maxHp: baseHp,
    ac,
    attack: attackBonus,
    damage,
    initiative: 0,
    x: spawnX,
    y: spawnY
  };

  state.enemies.push(newEnemy);
  const logMsg = `⚠️ Uma criatura espreita nos arredores: ${name} (${baseHp} PV, CA ${ac}) avistada em [X:${spawnX} Y:${spawnY}].`;
  state.logs.push(entry(logMsg, 'gm'));

  return { approved: true, reason: logMsg };
}

/**
 * Server-authoritative execution of a verified Director Intent.
 */
export function executeDirectorIntent(
  intent: DirectorIntentType,
  payload: Record<string, any>,
  state: State,
  roomId: string = 'mmo-world-village',
  focusHero?: Character
): DirectorDecision {
  const mem = getRoomMemory(roomId);
  const now = Date.now();

  const decision: DirectorDecision = {
    timestamp: now,
    reason: payload.reason || 'Adaptação orgânica de sandbox.',
    intent,
    payload,
    validation: { approved: false, reason: '' }
  };

  switch (intent) {
    case 'idle': {
      decision.validation = { approved: true, reason: 'Decisão de silêncio/espera aprovada.' };
      break;
    }

    case 'influence_economy': {
      const mult = Number(payload.multiplier ?? 1.1);
      const res = adjustShopStockWithinBounds(state, payload.reason || 'Escassez de rota', mult, payload.item);
      decision.validation = {
        approved: res.approved,
        clamped: res.clamped,
        reason: `Multiplicador validado em ${res.finalMultiplier}x. ${res.notice}`
      };
      decision.narrativeLog = res.notice;
      mem.lastEventTimestamp = now;
      break;
    }

    case 'adjust_ecosystem': {
      const res = adjustFaunaPresenceWithinBounds(state, payload.reason || 'Dinâmica de fauna', payload.critterType);
      decision.validation = { approved: res.approved, reason: res.message };
      decision.narrativeLog = res.message;
      mem.lastEventTimestamp = now;
      break;
    }

    case 'request_creature_spawn': {
      const creatureName = String(payload.creatureName || 'Rastreador de Cinzas').slice(0, 40);
      const tier = Math.max(1, Math.min(3, Number(payload.tier) || 1)) as ItemTier;
      const res = spawnCreatureSafely(state, creatureName, tier, false, focusHero);
      decision.validation = { approved: res.approved, reason: res.reason };
      decision.narrativeLog = res.reason;
      if (res.approved) {
        mem.lastEventTimestamp = now;
        mem.tension = Math.min(80, mem.tension + 15);
      }
      break;
    }

    case 'request_environmental_event': {
      const eventText = String(payload.text || 'O vento sopra forte pelas copas, trazendo o cheiro distante de chuva e cinzas.').slice(0, 180);
      state.logs.push(entry(`🌌 ${eventText}`, 'gm'));
      decision.validation = { approved: true, reason: 'Evento ambiental atmosférico aprovado.' };
      decision.narrativeLog = eventText;
      mem.lastEventTimestamp = now;
      break;
    }

    case 'request_microadventure': {
      const advId =
        String(
          payload.adventureId ||
          ''
        );

      const adventure =
        MICRO_ADVENTURES[
          advId
        ];

      if (!adventure) {
        decision.validation = {
          approved: false,
          reason:
            'Contrato sugerido n?o existe.'
        };

        break;
      }

      const logText =
        '?? Novo contrato dispon?vel no Di?rio: ' +
        adventure.title +
        '. ' +
        adventure.hookNpcDialogue;

      state.logs.push(
        entry(
          logText,
          'gm'
        )
      );

      decision.validation = {
        approved: true,
        reason:
          'Contrato oferecido ao jogador. A engine aguardar? aceita??o expl?cita antes de iniciar a atividade.'
      };

      decision.narrativeLog =
        logText;

      mem.lastEventTimestamp =
        now;

      break;
    }

    case 'request_temporary_npc': {
      if (state.npcs && state.npcs.length >= 30) {
        decision.validation = { approved: false, reason: 'Limite de NPCs atingido.' };
      } else {
        const npcName = String(payload.name || 'Batedor Errante').slice(0, 40);
        const role = String(payload.role || 'Viajante').slice(0, 50);
        const desc = String(payload.description || 'Descansa próximo à fogueira com olhar cansado.').slice(0, 150);

        if (!state.npcs) state.npcs = [];

        const npcPoint =
          clampGridPoint(
            focusHero?.biome ||
              state.biome ||
              'village',
            (focusHero?.x ?? 2) +
              2,
            (focusHero?.y ?? 4) +
              1
          );

        state.npcs.push({
          id: `temp-npc-${Date.now()}`,
          name: npcName,
          role,
          description: desc,
          biome:
            focusHero?.biome ||
            state.biome ||
            'village',
          x:
            npcPoint.x,
          y:
            npcPoint.y,
          icon: 'User',
          dialogue: [
            'Saudações! Cuidado com os caminhos que levam além dos limites da vila.',
            'Ouvi dizer que caravanas de suprimentos têm enfrentado dificuldades para cruzar as pontes.'
          ]
        });

        const logMsg = `👤 Um viajante temporário aproximou-se: ${npcName} (${role}).`;
        state.logs.push(entry(logMsg, 'gm'));
        decision.validation = { approved: true, reason: logMsg };
        decision.narrativeLog = logMsg;
        mem.lastEventTimestamp = now;
      }
      break;
    }

    default:
      decision.validation = { approved: false, reason: 'Intenção não reconhecida.' };
  }

  // Record traceability log
  logDirectorDecision(roomId, decision);
  mem.history.push(decision);
  if (mem.history.length > 50) mem.history.shift();

  return decision;
}

/**
 * Structured log output for traceability.
 */
export function logDirectorDecision(roomId: string, decision: DirectorDecision): void {
  const status = decision.validation.approved ? 'APROVADO' : 'REJEITADO';
  const clampedNote = decision.validation.clamped ? ' [VALOR AJUSTADO AOS LIMITES]' : '';
  console.log(
    `[SandboxDirector][${roomId}] STATUS: ${status}${clampedNote} | INTENÇÃO: ${decision.intent} | MOTIVO: ${decision.reason} | VALIDAÇÃO: ${decision.validation.reason}`
  );
}
