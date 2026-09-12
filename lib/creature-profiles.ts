import type { Character, Enemy } from './game-engine';

export type EnemyAiStyle =
  | 'brute'
  | 'skirmisher'
  | 'guardian'
  | 'caster'
  | 'boss'
  | 'dragon';

export type CreatureProfile = {
  aiStyle: EnemyAiStyle;
  recommendedLevel: number;
  moveSquares: number;
  attackRange: number;
  xpReward: number;
};

type RuntimeEnemy = Enemy & {
  aiStyle?: EnemyAiStyle;
  moveSquares?: number;
  attackRange?: number;
  xpReward?: number;
  balanceKey?: string;
  baseMaxHp?: number;
  baseAttack?: number;
  baseAc?: number;
};

function normalized(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const DEFAULT_PROFILE: CreatureProfile = {
  aiStyle: 'brute',
  recommendedLevel: 1,
  moveSquares: 2,
  attackRange: 1,
  xpReward: 100
};

export function getCreatureProfile(name: string): CreatureProfile {
  const n = normalized(name);

  if (n.includes('ignisrax')) {
    return {
      aiStyle: 'dragon',
      recommendedLevel: 5,
      moveSquares: 3,
      attackRange: 4,
      xpReward: 1000
    };
  }

  if (n.includes('malakor')) {
    return {
      aiStyle: 'boss',
      recommendedLevel: 4,
      moveSquares: 2,
      attackRange: 2,
      xpReward: 500
    };
  }

  if (n.includes('wyrmling')) {
    return {
      aiStyle: 'dragon',
      recommendedLevel: 4,
      moveSquares: 3,
      attackRange: 3,
      xpReward: 350
    };
  }

  if (n.includes('escriba')) {
    return {
      aiStyle: 'caster',
      recommendedLevel: 3,
      moveSquares: 1,
      attackRange: 4,
      xpReward: 200
    };
  }

  if (n.includes('guardiao')) {
    return {
      aiStyle: 'guardian',
      recommendedLevel: 3,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 250
    };
  }

  if (n.includes('fanatico')) {
    return {
      aiStyle: 'brute',
      recommendedLevel: 2,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 150
    };
  }

  if (n.includes('cultista')) {
    return {
      aiStyle: 'brute',
      recommendedLevel: 2,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 125
    };
  }

  if (n.includes('lobo')) {
    return {
      aiStyle: 'skirmisher',
      recommendedLevel: 1,
      moveSquares: 3,
      attackRange: 1,
      xpReward: 75
    };
  }

  if (n.includes('draconiano')) {
    return {
      aiStyle: 'guardian',
      recommendedLevel: 4,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 250
    };
  }

  if (n.includes('abissal')) {
    return {
      aiStyle: 'guardian',
      recommendedLevel: 4,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 200
    };
  }

  if (n.includes('sentinela')) {
    return {
      aiStyle: 'guardian',
      recommendedLevel: 1,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 100
    };
  }

  if (n.includes('espantalho')) {
    return {
      aiStyle: 'guardian',
      recommendedLevel: 1,
      moveSquares: 1,
      attackRange: 1,
      xpReward: 75
    };
  }

  return DEFAULT_PROFILE;
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function prepareEnemyForCombat(
  enemy: Enemy,
  heroes: Character[],
  biome: string,
  partyId?: string,
  ownerCharId?: string
): Enemy {
  const runtime = enemy as RuntimeEnemy;
  const profile = getCreatureProfile(enemy.name);

  runtime.aiStyle = profile.aiStyle;
  runtime.moveSquares = profile.moveSquares;
  runtime.attackRange = profile.attackRange;
  runtime.xpReward = profile.xpReward;

  if (!enemy.partyId && !enemy.ownerCharId) {
    (enemy as any).biome = biome;

    if (partyId) {
      enemy.partyId = partyId;
      enemy.ownerCharId = undefined;
    } else if (ownerCharId) {
      enemy.ownerCharId = ownerCharId;
    }
  } else if (!(enemy as any).biome) {
    (enemy as any).biome = biome;
  }

  const livingHeroes = heroes.filter((hero) => hero.hp > 0);
  const partySize = Math.max(1, livingHeroes.length);
  const avgLevel = Math.max(
    1,
    Math.round(
      livingHeroes.reduce((sum, hero) => sum + Math.max(1, hero.level || 1), 0) /
        partySize
    )
  );

  if (runtime.baseMaxHp == null) runtime.baseMaxHp = Math.max(1, enemy.maxHp);
  if (runtime.baseAttack == null) runtime.baseAttack = enemy.attack;
  if (runtime.baseAc == null) runtime.baseAc = enemy.ac;

  const balanceKey = `${avgLevel}:${partySize}`;
  if (runtime.balanceKey !== balanceKey) {
    const oldMaxHp = Math.max(1, enemy.maxHp);
    const hpRatio = clamp(0, enemy.hp / oldMaxHp, 1);

    const levelDelta = avgLevel - profile.recommendedLevel;
    const levelFactor = clamp(0.85, 1 + levelDelta * 0.08, 1.35);
    const extraHeroHp =
      profile.aiStyle === 'boss' || profile.aiStyle === 'dragon'
        ? 0.30
        : 0.15;
    const partyFactor = 1 + Math.max(0, partySize - 1) * extraHeroHp;
    const hpFactor = levelFactor * partyFactor;

    enemy.maxHp = Math.max(1, Math.round(runtime.baseMaxHp * hpFactor));
    enemy.hp = Math.max(1, Math.round(enemy.maxHp * hpRatio));

    const positiveLevelDelta = Math.max(0, levelDelta);
    enemy.attack =
      runtime.baseAttack + Math.floor(positiveLevelDelta / 3);
    enemy.ac =
      runtime.baseAc + Math.floor(positiveLevelDelta / 4);

    runtime.balanceKey = balanceKey;
  }

  return enemy;
}