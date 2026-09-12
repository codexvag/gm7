import type {
  Character,
  Enemy
} from './game-engine';

export type EnemyAiStyle =
  | 'brute'
  | 'skirmisher'
  | 'guardian'
  | 'caster'
  | 'boss'
  | 'dragon';

export type EnemySpecialKind =
  | 'none'
  | 'bash'
  | 'arcane'
  | 'void_burst'
  | 'breath';

export type CreatureProfile = {
  aiStyle: EnemyAiStyle;
  recommendedLevel: number;
  moveSquares: number;
  attackRange: number;
  xpReward: number;

  attackName: string;
  tokenGlyph: string;

  specialKind?: EnemySpecialKind;
  specialName?: string;
  specialEvery?: number;
  specialDamage?: string;
  specialRange?: number;
  saveDc?: number;
};

type RuntimeEnemy =
  Enemy & {
    aiStyle?: EnemyAiStyle;
    moveSquares?: number;
    attackRange?: number;
    xpReward?: number;

    balanceKey?: string;

    baseMaxHp?: number;
    baseAttack?: number;
    baseAc?: number;
  };

function normalized(
  value: string
): string {
  return String(
    value || ''
  )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}

const DEFAULT_PROFILE:
  CreatureProfile = {
    aiStyle: 'brute',
    recommendedLevel: 1,
    moveSquares: 2,
    attackRange: 1,
    xpReward: 100,
    attackName: 'Golpe',
    tokenGlyph: '⚔️',
    specialKind: 'none'
  };

export function getCreatureProfile(
  name: string
): CreatureProfile {
  const n =
    normalized(name);

  if (
    n.includes('ignisrax')
  ) {
    return {
      aiStyle: 'dragon',
      recommendedLevel: 5,
      moveSquares: 3,
      attackRange: 1,
      xpReward: 1000,
      attackName:
        'Mordida Ígnea',
      tokenGlyph: '🐉',
      specialKind: 'breath',
      specialName:
        'Sopro de Fogo Devastador',
      specialEvery: 3,
      specialDamage: '6d6',
      specialRange: 6,
      saveDc: 15
    };
  }

  if (
    n.includes('malakor')
  ) {
    return {
      aiStyle: 'boss',
      recommendedLevel: 4,
      moveSquares: 2,
      attackRange: 4,
      xpReward: 550,
      attackName:
        'Cetro do Vazio',
      tokenGlyph: '☠️',
      specialKind:
        'void_burst',
      specialName:
        'Pulso do Vazio',
      specialEvery: 3,
      specialDamage:
        '3d6+2',
      specialRange: 4,
      saveDc: 14
    };
  }

  if (
    n.includes('wyrmling') ||
    n.includes('draco')
  ) {
    return {
      aiStyle: 'dragon',
      recommendedLevel: 4,
      moveSquares: 3,
      attackRange: 1,
      xpReward: 350,
      attackName:
        'Mordida Dracônica',
      tokenGlyph: '🐲',
      specialKind: 'breath',
      specialName:
        'Sopro de Fogo',
      specialEvery: 3,
      specialDamage: '3d6',
      specialRange: 4,
      saveDc: 13
    };
  }

  if (
    n.includes('escriba') ||
    n.includes('acolito') ||
    n.includes('arqueiro') ||
    n.includes('batedor')
  ) {
    const bow =
      n.includes('arqueiro') ||
      n.includes('batedor');

    return {
      aiStyle: 'caster',
      recommendedLevel: 2,
      moveSquares: 2,
      attackRange:
        bow ? 6 : 4,
      xpReward: 175,
      attackName:
        bow
          ? 'Disparo Preciso'
          : 'Rajada Rúnica',
      tokenGlyph:
        bow ? '🏹' : '🔮',
      specialKind: 'arcane',
      specialName:
        bow
          ? 'Flecha Perfurante'
          : 'Explosão Rúnica',
      specialEvery: 3,
      specialDamage:
        '2d6+2',
      specialRange: 5
    };
  }

  if (
    n.includes('guardiao') ||
    n.includes('sentinela') ||
    n.includes('draconiano')
  ) {
    return {
      aiStyle: 'guardian',
      recommendedLevel:
        n.includes('draconiano')
          ? 4
          : 2,
      moveSquares: 2,
      attackRange: 1,
      xpReward:
        n.includes('draconiano')
          ? 250
          : 175,
      attackName:
        'Golpe de Guarda',
      tokenGlyph: '🛡️',
      specialKind: 'bash',
      specialName:
        'Impacto de Escudo',
      specialEvery: 3,
      specialDamage:
        '1d8+3',
      specialRange: 1
    };
  }

  if (
    n.includes('lobo') ||
    n.includes('cao de brasas')
  ) {
    return {
      aiStyle:
        'skirmisher',
      recommendedLevel: 1,
      moveSquares: 4,
      attackRange: 1,
      xpReward: 100,
      attackName:
        'Mordida de Alcateia',
      tokenGlyph: '🐺',
      specialKind: 'none'
    };
  }

  if (
    n.includes('elemental') ||
    n.includes('magma')
  ) {
    return {
      aiStyle: 'brute',
      recommendedLevel: 5,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 325,
      attackName:
        'Punho de Magma',
      tokenGlyph: '🔥',
      specialKind: 'arcane',
      specialName:
        'Erupção de Magma',
      specialEvery: 3,
      specialDamage: '3d6',
      specialRange: 3
    };
  }

  if (
    n.includes('eco do vazio') ||
    n.includes('abissal')
  ) {
    return {
      aiStyle: 'caster',
      recommendedLevel: 4,
      moveSquares: 2,
      attackRange: 4,
      xpReward: 250,
      attackName:
        'Toque do Vazio',
      tokenGlyph: '👁️',
      specialKind:
        'void_burst',
      specialName:
        'Onda Abissal',
      specialEvery: 3,
      specialDamage:
        '2d8+2',
      specialRange: 4,
      saveDc: 13
    };
  }

  if (
    n.includes('fanatico') ||
    n.includes('cultista') ||
    n.includes('saqueador')
  ) {
    return {
      aiStyle: 'brute',
      recommendedLevel: 2,
      moveSquares: 2,
      attackRange: 1,
      xpReward: 150,
      attackName:
        'Golpe Brutal',
      tokenGlyph: '⚔️',
      specialKind: 'none'
    };
  }

  if (
    n.includes('espantalho')
  ) {
    return {
      aiStyle: 'guardian',
      recommendedLevel: 1,
      moveSquares: 1,
      attackRange: 1,
      xpReward: 75,
      attackName:
        'Garras de Palha',
      tokenGlyph: '🌾',
      specialKind: 'none'
    };
  }

  return DEFAULT_PROFILE;
}

function clamp(
  min: number,
  value: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

export function prepareEnemyForCombat(
  enemy: Enemy,
  heroes: Character[],
  biome: string,
  partyId?: string,
  ownerCharId?: string
): Enemy {
  const runtime =
    enemy as RuntimeEnemy;

  const profile =
    getCreatureProfile(
      enemy.name
    );

  runtime.aiStyle =
    profile.aiStyle;

  runtime.moveSquares =
    profile.moveSquares;

  runtime.attackRange =
    profile.attackRange;

  runtime.xpReward =
    profile.xpReward;

  if (!enemy.weapon) {
    enemy.weapon =
      profile.attackName;
  }

  if (
    !enemy.partyId &&
    !enemy.ownerCharId
  ) {
    enemy.biome =
      biome as any;

    if (partyId) {
      enemy.partyId =
        partyId;

      enemy.ownerCharId =
        undefined;
    } else if (
      ownerCharId
    ) {
      enemy.ownerCharId =
        ownerCharId;
    }
  } else if (
    !enemy.biome
  ) {
    enemy.biome =
      biome as any;
  }

  const livingHeroes =
    heroes.filter(
      (hero) =>
        hero.hp > 0
    );

  const partySize =
    Math.max(
      1,
      livingHeroes.length
    );

  const avgLevel =
    Math.max(
      1,
      Math.round(
        livingHeroes.reduce(
          (total, hero) =>
            total +
            Math.max(
              1,
              hero.level || 1
            ),
          0
        ) /
        partySize
      )
    );

  if (
    runtime.baseMaxHp ==
    null
  ) {
    runtime.baseMaxHp =
      Math.max(
        1,
        enemy.maxHp
      );
  }

  if (
    runtime.baseAttack ==
    null
  ) {
    runtime.baseAttack =
      enemy.attack;
  }

  if (
    runtime.baseAc ==
    null
  ) {
    runtime.baseAc =
      enemy.ac;
  }

  const balanceKey =
    avgLevel +
    ':' +
    partySize;

  if (
    runtime.balanceKey !==
    balanceKey
  ) {
    const oldMax =
      Math.max(
        1,
        enemy.maxHp
      );

    const hpRatio =
      clamp(
        0,
        enemy.hp /
          oldMax,
        1
      );

    const levelDelta =
      avgLevel -
      profile.recommendedLevel;

    const levelFactor =
      clamp(
        0.82,
        1 +
          levelDelta *
          0.08,
        1.40
      );

    const perExtraHero =
      profile.aiStyle ===
        'boss' ||
      profile.aiStyle ===
        'dragon'
        ? 0.32
        : 0.16;

    const partyFactor =
      1 +
      Math.max(
        0,
        partySize - 1
      ) *
        perExtraHero;

    enemy.maxHp =
      Math.max(
        1,
        Math.round(
          runtime.baseMaxHp *
            levelFactor *
            partyFactor
        )
      );

    enemy.hp =
      Math.max(
        1,
        Math.round(
          enemy.maxHp *
            hpRatio
        )
      );

    const positiveDelta =
      Math.max(
        0,
        levelDelta
      );

    enemy.attack =
      runtime.baseAttack +
      Math.floor(
        positiveDelta /
        3
      );

    enemy.ac =
      runtime.baseAc +
      Math.floor(
        positiveDelta /
        4
      );

    runtime.balanceKey =
      balanceKey;
  }

  return enemy;
}