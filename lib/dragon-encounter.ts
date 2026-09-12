// lib/dragon-encounter.ts
// O Grande Boss: Ignisrax, o Flagelo Rubro (Jovem Dragão Vermelho - D&D 5e SRD 5.2.1, p. 318)
// Sistema Faseado: Rumores na Vila -> Sinais no Mundo -> Sobrevôo Tático -> Batalha no Covil

import type { State, Enemy, Character } from './game-engine';
import { entry, d20, roll, mod, applyCondition, hasCondition } from './game-engine';

export interface DragonPhaseState {
  stage: 'rumors' | 'signs' | 'flyover' | 'lair_ready' | 'defeated';
  bossPhase: 1 | 2 | 3;
  breathRecharged: boolean;
}

/**
 * Ficha Oficial SRD 5.2.1 (p. 318): Young Red Dragon
 * Calibrado para o sandbox tático de Valdoria (PV 85, CA 17)
 */
export const IGNISRAX_SRD_STATS = {
  name: 'Ignisrax, o Flagelo Rubro',
  srdSource: 'Young Red Dragon • D&D 5e SRD 5.2.1 p. 318',
  maxHp: 85,
  ac: 17,
  speed: 12, // 8 quadrados
  flySpeed: 24, // 16 quadrados
  stats: [23, 10, 21, 14, 11, 19], // FOR, DES, CON, INT, SAB, CAR
  saves: [4, 6], // DES +4, CON +9, SAB +4, CAR +8
  attackBonus: 8,
  biteDamage: '2d10+6',
  clawDamage: '2d6+6',
  breathWeaponDamage: '6d6',
  breathDc: 15,
  frightfulPresenceDc: 13,
  damageImmunities: ['fogo']
};

/**
 * Diálogos de rumores e sinais no mundo
 */
export const DRAGON_RUMORS = [
  {
    stage: 'rumors',
    npc: 'Ancião Doran',
    text: 'Vocês sentiram o vento ontem à noite? Não era a brisa fresca do rio. Cheirava a pedra derretida e cinzas quentes. Os caçadores dizem que a serra de basalto está fumegando... rezo para que a lenda do Flagelo Rubro continue adormecida.'
  },
  {
    stage: 'signs',
    npc: 'Alquimista Elenor',
    text: 'As águas do lago na floresta estão mornas e encontrei estas escamas rubras maiores que o meu escudo perto do desfiladeiro. Isso não pertence a nenhum réptil comum de Valdoria. É a carapaça de um dragão verdadeiro.'
  },
  {
    stage: 'flyover',
    npc: 'Capitão Kaelen',
    text: 'Uma sombra com envergadura de trinta metros cruzou o céu da abadia! Ouvi um rugido que fez as pedras da muralha tremerem. Ignisrax despertou e reivindicou a Cratera Magmática como seu covil!'
  }
];

/**
 * Spawna Ignisrax na arena do Covil (Fase 3: Batalha)
 */
export function spawnDragonBoss(state: State): { boss: Enemy; log: string } {
  const existing = state.enemies.find((e) => e.name.includes('Ignisrax'));
  if (existing && existing.hp > 0) {
    return { boss: existing, log: 'Ignisrax já está presente na arena do covil!' };
  }

  // Remove inimigos mortos anteriores se houver
  state.enemies = state.enemies.filter((e) => !e.name.includes('Ignisrax'));

  const boss: Enemy = {
    id: crypto.randomUUID(),
    name: IGNISRAX_SRD_STATS.name,
    hp: IGNISRAX_SRD_STATS.maxHp,
    maxHp: IGNISRAX_SRD_STATS.maxHp,
    ac: IGNISRAX_SRD_STATS.ac,
    attack: IGNISRAX_SRD_STATS.attackBonus,
    damage: IGNISRAX_SRD_STATS.biteDamage,
    weapon: 'Mordida Ígnea & Garras Dracônicas',
    initiative: d20().raw + 2,
    x: 9,
    y: 6,
    conditions: []
  };

  state.enemies.push(boss);
  state.location = 5; // O Covil de Ignisrax
  state.biome = 'lair';
  state.combat = true;
  state.round = 1;
  state.turn = 0;

  // Rolar iniciativa com presença aterradora
  for (const hero of state.characters) {
    if (hero.hp > 0) {
      hero.initiative = d20().raw + mod(hero.stats[1]);
      // Teste de Sabedoria contra Presença Aterradora (CD 13)
      const wisSave = d20().raw + mod(hero.stats[4]);
      if (wisSave < IGNISRAX_SRD_STATS.frightfulPresenceDc) {
        applyCondition(hero as any, 'Amedrontado');
      }
    }
  }

  state.order = [
    ...state.characters.filter((c) => c.hp > 0),
    ...state.enemies.filter((e) => e.hp > 0)
  ]
    .sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id))
    .map((c) => c.id);

  const logMsg = `🔥 [CONFRONTO FINAL: ${IGNISRAX_SRD_STATS.name}]\n` +
    `Das profundezas da cratera, asas de fogo negro se desdobram! Um rugido titânico ecoa pelas paredes de basalto.\n` +
    `Presença Aterradora ativa (CD 13 Sabedoria). A batalha pelo destino de Valdoria começou!`;

  state.logs.push(entry(logMsg, 'gm'));
  return { boss, log: logMsg };
}

/**
 * Avalia em qual subfase de combate o dragão se encontra
 */
export function getDragonCombatPhase(boss: Enemy): {
  phase: 1 | 2 | 3;
  description: string;
  isRoosting: boolean;
  isEnraged: boolean;
} {
  const hpRatio = boss.hp / boss.maxHp;

  if (hpRatio > 0.6) {
    return {
      phase: 1,
      description: 'Fase 1: Combate Terrestre — Ignisrax investe furiosamente com garras pesadas e mordidas ardentes.',
      isRoosting: false,
      isEnraged: false
    };
  } else if (hpRatio > 0.25) {
    return {
      phase: 2,
      description: 'Fase 2: Poleiro Elevado & Sopro de Fogo — O Dragão ergue voo até o altar central, preparando uma baforada em cone! Usem os pilares como cobertura!',
      isRoosting: true,
      isEnraged: false
    };
  } else {
    return {
      phase: 3,
      description: 'Fase 3: Fúria Vulcânica Extrema — Com o corpo coberto de ferimentos, o chão racha em magma incandescente! Um golpe final é necessário!',
      isRoosting: false,
      isEnraged: true
    };
  }
}

/**
 * Executa o Sopro de Fogo tático em área cônica
 * (D&D 5e: Cone de 9m / 6 quadrados, Destreza CD 15 para metade do dano)
 */
export function executeDragonBreath(
  boss: Enemy,
  state: State
): { targetsHit: string[]; totalDamage: number; log: string } {
  const dmgRoll = roll(IGNISRAX_SRD_STATS.breathWeaponDamage);
  const rawDamage = dmgRoll.total;
  const targetsHit: string[] = [];

  for (const hero of state.characters) {
    if (hero.hp <= 0) continue;

    // Distância até o dragão
    const dist = Math.max(Math.abs(hero.x - boss.x), Math.abs(hero.y - boss.y));

    // Se estiver a até 6 quadrados (cone tático)
    if (dist <= 6) {
      // Teste de Destreza 5e
      const dexMod = mod(hero.stats[1]);
      const dexRoll = d20().raw;
      const dexTotal = dexRoll + dexMod;
      const saved = dexTotal >= IGNISRAX_SRD_STATS.breathDc;

      const finalDamage = saved ? Math.floor(rawDamage / 2) : rawDamage;
      hero.hp = Math.max(0, hero.hp - finalDamage);

      targetsHit.push(`${hero.name} (${saved ? 'Salvou: -' : 'Falhou: -'}${finalDamage} PV)`);
    }
  }

  const logMsg = `🌋 ${boss.name} expele um SOPRO DE FOGO DEVASTADOR em cone! [Dano: ${rawDamage} ígneo, CD ${IGNISRAX_SRD_STATS.breathDc} DES]\n` +
    (targetsHit.length > 0 ? `Atingiu: ${targetsHit.join(', ')}` : 'Nenhum aventureiro estava no cone de fogo.');

  state.logs.push(entry(logMsg, 'gm'));
  return { targetsHit, totalDamage: rawDamage, log: logMsg };
}
