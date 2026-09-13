import {
  d20,
  roll,
  mod,
  prof,
  resolveAttack,
  getGridDistance,
  type Character,
  type Enemy,
  type State,
  type AttackResult
} from './game-engine';

import {
  getCreatureProfile
} from './creature-profiles';

import {
  isCharacterSpellPrepared
} from './srd-spellbook';

export type SrdSpellMode =
  | 'attack'
  | 'multi-attack'
  | 'save'
  | 'auto-hit'
  | 'heal'
  | 'aoe-save';

export type SrdSpellRule = {
  id: string;
  name: string;
  level: number;
  classes: string[];
  rangeSquares: number;
  mode: SrdSpellMode;
  saveAbility?: 'Destreza' | 'Constitui??o';
  areaShape?: 'cone' | 'cube';
  areaSizeSquares?: number;
  halfOnSave?: boolean;
  pushSquares?: number;
};

export type SrdHealResult = {
  targetId: string;
  targetName: string;
  healAmount: number;
  hpAfter: number;
  maxHp: number;
};

export type SrdSpellResolution = {
  rule: SrdSpellRule;
  attackResult: AttackResult | null;
  healResult: SrdHealResult | null;
  affectedEnemyIds: string[];
  defeatedEnemyIds: string[];
  reactionLockedIds: string[];
  logs: string[];
};

const RULES: SrdSpellRule[] = [
  {
    id: 'raio-de-fogo',
    name: 'Raio de Fogo',
    level: 0,
    classes: ['Mago', 'Feiticeiro'],
    rangeSquares: 24,
    mode: 'attack'
  },
  {
    id: 'rajada-mistica',
    name: 'Rajada M?stica',
    level: 0,
    classes: ['Bruxo'],
    rangeSquares: 24,
    mode: 'multi-attack'
  },
  {
    id: 'toque-chocante',
    name: 'Toque Chocante',
    level: 0,
    classes: ['Mago', 'Feiticeiro'],
    rangeSquares: 1,
    mode: 'attack'
  },
  {
    id: 'chama-sagrada',
    name: 'Chama Sagrada',
    level: 0,
    classes: ['Cl?rigo'],
    rangeSquares: 12,
    mode: 'save',
    saveAbility: 'Destreza'
  },
  {
    id: 'curar-ferimentos',
    name: 'Curar Ferimentos',
    level: 1,
    classes: [
      'Bardo',
      'Cl?rigo',
      'Druida',
      'Paladino',
      'Patrulheiro'
    ],
    rangeSquares: 1,
    mode: 'heal'
  },
  {
    id: 'missoes-magicos',
    name: 'M?sseis M?gicos',
    level: 1,
    classes: ['Mago', 'Feiticeiro'],
    rangeSquares: 24,
    mode: 'auto-hit'
  },
  {
    id: 'maos-flamejantes',
    name: 'M?os Flamejantes',
    level: 1,
    classes: ['Mago', 'Feiticeiro'],
    rangeSquares: 3,
    mode: 'aoe-save',
    saveAbility: 'Destreza',
    areaShape: 'cone',
    areaSizeSquares: 3,
    halfOnSave: true
  },
  {
    id: 'onda-trovejante',
    name: 'Onda Trovejante',
    level: 1,
    classes: [
      'Bardo',
      'Druida',
      'Mago',
      'Feiticeiro'
    ],
    rangeSquares: 3,
    mode: 'aoe-save',
    saveAbility: 'Constitui??o',
    areaShape: 'cube',
    areaSizeSquares: 3,
    halfOnSave: true,
    pushSquares: 2
  },
  {
    id: 'raio-ardente',
    name: 'Raio Ardente',
    level: 2,
    classes: ['Mago', 'Feiticeiro'],
    rangeSquares: 24,
    mode: 'multi-attack'
  }
];

function normalize(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getSrdSpellRule(
  value: string
): SrdSpellRule | undefined {
  const needle = normalize(value);

  return RULES.find(
    (rule) =>
      normalize(rule.id) === needle ||
      normalize(rule.name) === needle
  );
}

export function getCantripMultiplier(
  level: number
): number {
  if (level >= 17) return 4;
  if (level >= 11) return 3;
  if (level >= 5) return 2;
  return 1;
}

export function getSpellcastingAbilityIndex(
  caster: Character
): number {
  if (
    Number.isInteger(
      caster.spellAbility
    )
  ) {
    return caster.spellAbility as number;
  }

  if (
    ['Cl?rigo', 'Druida', 'Patrulheiro']
      .includes(caster.className)
  ) {
    return 4;
  }

  if (
    [
      'Bardo',
      'Bruxo',
      'Feiticeiro',
      'Paladino'
    ].includes(caster.className)
  ) {
    return 5;
  }

  return 3;
}

export function getSpellcastingModifier(
  caster: Character
): number {
  return mod(
    caster.stats[
      getSpellcastingAbilityIndex(
        caster
      )
    ]
  );
}

export function getSpellAttackBonus(
  caster: Character
): number {
  return (
    prof(caster.level) +
    getSpellcastingModifier(caster) -
    2 * (caster.exhaustion || 0)
  );
}

export function getSpellSaveDc(
  caster: Character
): number {
  return (
    8 +
    prof(caster.level) +
    getSpellcastingModifier(caster)
  );
}

export function getSecondWindMaxUses(
  level: number
): number {
  if (level >= 10) return 4;
  if (level >= 4) return 3;
  return 2;
}

export function getRageMaxUses(
  level: number
): number {
  if (level >= 17) return 6;
  if (level >= 12) return 5;
  if (level >= 6) return 4;
  if (level >= 3) return 3;
  return 2;
}

export function getRageDamageBonus(
  level: number
): number {
  if (level >= 16) return 4;
  if (level >= 9) return 3;
  return 2;
}

export function addFormulaBonus(
  formula: string,
  bonus: number
): string {
  if (!bonus) {
    return formula;
  }

  return (
    formula +
    (bonus > 0 ? '+' : '') +
    bonus
  );
}

function spellIsKnown(
  caster: Character,
  rule: SrdSpellRule
): boolean {
  return isCharacterSpellPrepared(
    caster,
    rule.name
  );
}


function scopedEnemy(
  caster: Character,
  enemy: Enemy
): boolean {
  if (
    enemy.hp <= 0
  ) {
    return false;
  }

  const casterBiome =
    caster.biome;

  if (
    casterBiome &&
    enemy.biome &&
    enemy.biome !== casterBiome
  ) {
    return false;
  }

  if (caster.partyId) {
    return (
      !enemy.partyId ||
      enemy.partyId ===
        caster.partyId
    );
  }

  return (
    !enemy.ownerCharId ||
    enemy.ownerCharId ===
      caster.id
  );
}

function enemySaveBonus(
  enemy: Enemy,
  ability:
    | 'Destreza'
    | 'Constitui??o'
): number {
  const profile =
    getCreatureProfile(
      enemy.name
    );

  if (
    ability === 'Destreza'
  ) {
    if (
      profile.aiStyle ===
        'skirmisher'
    ) {
      return 3;
    }

    if (
      profile.aiStyle ===
        'caster' ||
      profile.aiStyle ===
        'dragon'
    ) {
      return 2;
    }

    if (
      profile.aiStyle ===
        'boss'
    ) {
      return 1;
    }

    return 0;
  }

  if (
    profile.aiStyle ===
      'dragon' ||
    profile.aiStyle ===
      'boss'
  ) {
    return 3;
  }

  if (
    profile.aiStyle ===
      'guardian' ||
    profile.aiStyle ===
      'brute'
  ) {
    return 2;
  }

  if (
    profile.aiStyle ===
      'skirmisher'
  ) {
    return 1;
  }

  return 0;
}

function makeSyntheticResult(
  caster: Character,
  target: Enemy,
  hpBefore: number,
  hpAfter: number,
  damage: number,
  text: string,
  d20Roll = 0,
  total = 0,
  dc = target.ac,
  hit = damage > 0
): AttackResult {
  return {
    text,
    hit,
    isCrit: false,
    isFumble: false,
    d20Roll,
    totalAttack: total,
    targetAc: dc,
    damage,
    attackerName: caster.name,
    targetName: target.name,
    targetId: target.id,
    hpBefore,
    hpAfter
  };
}

function getDirection(
  caster: Character,
  target: Enemy
): {
  x: number;
  y: number;
} {
  let dx =
    Math.sign(
      target.x - caster.x
    );

  let dy =
    Math.sign(
      target.y - caster.y
    );

  if (
    dx === 0 &&
    dy === 0
  ) {
    dx = 1;
  }

  return {
    x: dx,
    y: dy
  };
}

function directionalTargets(
  caster: Character,
  primary: Enemy,
  enemies: Enemy[],
  shape: 'cone' | 'cube',
  size: number
): Enemy[] {
  const direction =
    getDirection(
      caster,
      primary
    );

  const result =
    enemies.filter(
      (enemy) => {
        const rx =
          enemy.x -
          caster.x;

        const ry =
          enemy.y -
          caster.y;

        const distance =
          getGridDistance(
            caster,
            enemy
          );

        if (
          distance < 1 ||
          distance > size
        ) {
          return false;
        }

        const forward =
          rx *
            direction.x +
          ry *
            direction.y;

        if (
          forward <= 0
        ) {
          return false;
        }

        const lateral =
          Math.abs(
            rx *
              direction.y -
            ry *
              direction.x
          );

        if (
          shape === 'cone'
        ) {
          return (
            lateral <=
            Math.max(
              1,
              distance
            )
          );
        }

        return (
          forward <=
            size *
              (
                direction.x !== 0 &&
                direction.y !== 0
                  ? 2
                  : 1
              ) &&
          lateral <= 2
        );
      }
    );

  if (
    !result.some(
      (enemy) =>
        enemy.id ===
        primary.id
    ) &&
    getGridDistance(
      caster,
      primary
    ) <= size
  ) {
    result.push(primary);
  }

  return result;
}

function pushAway(
  state: State,
  caster: Character,
  enemy: Enemy,
  squares: number,
  canOccupy?: (
    x: number,
    y: number
  ) => boolean
): void {
  const dx =
    Math.sign(
      enemy.x -
      caster.x
    );

  const dy =
    Math.sign(
      enemy.y -
      caster.y
    );

  if (
    dx === 0 &&
    dy === 0
  ) {
    return;
  }

  for (
    let i = 0;
    i < squares;
    i++
  ) {
    const nx =
      enemy.x + dx;

    const ny =
      enemy.y + dy;

    if (
      nx < 0 ||
      ny < 0 ||
      nx > 15 ||
      ny > 15
    ) {
      break;
    }

    const occupied =
      [
        ...state.characters,
        ...state.enemies
      ].some(
        (entity) =>
          entity.id !==
            enemy.id &&
          entity.hp > 0 &&
          entity.x === nx &&
          entity.y === ny
      );

    if (
      occupied ||
      (
        canOccupy &&
        !canOccupy(
          nx,
          ny
        )
      )
    ) {
      break;
    }

    enemy.x = nx;
    enemy.y = ny;
  }
}

export function resolveSrdSpell(
  state: State,
  caster: Character,
  args: {
    spellName: string;
    spellLevel?: number;
    targetId?: string;
    canOccupy?: (
      x: number,
      y: number
    ) => boolean;
  }
): SrdSpellResolution {
  const rule =
    getSrdSpellRule(
      args.spellName
    );

  if (!rule) {
    throw new Error(
      'Magia n?o implementada no motor SRD: ' +
      args.spellName
    );
  }

  if (
    !spellIsKnown(
      caster,
      rule
    )
  ) {
    throw new Error(
      caster.name +
      ' n?o conhece ' +
      rule.name +
      '.'
    );
  }

  const slotLevel =
    rule.level === 0
      ? 0
      : Math.max(
          rule.level,
          Number(
            args.spellLevel ||
            rule.level
          )
        );

  const logs: string[] = [];
  const affectedEnemyIds: string[] = [];
  const defeatedEnemyIds: string[] = [];
  const reactionLockedIds: string[] = [];

  let attackResult:
    AttackResult | null =
    null;

  let healResult:
    SrdHealResult | null =
    null;

  if (
    rule.mode === 'heal'
  ) {
    const target =
      state.characters.find(
        (character) =>
          character.id ===
          (
            args.targetId ||
            caster.id
          )
      );

    if (!target) {
      throw new Error(
        'Alvo inv?lido para ' +
        rule.name +
        '.'
      );
    }

    const distance =
      getGridDistance(
        caster,
        target
      );

    if (
      distance >
      rule.rangeSquares
    ) {
      throw new Error(
        rule.name +
        ' possui alcance de Toque. A criatura precisa estar em voc? ou em um quadrado adjacente.'
      );
    }

    const ability =
      getSpellcastingModifier(
        caster
      );

    const diceCount =
      Math.max(
        2,
        slotLevel * 2
      );

    const formula =
      addFormulaBonus(
        String(diceCount) +
          'd8',
        ability
      );

    const healing =
      roll(formula);

    const hpBefore =
      target.hp;

    target.hp =
      Math.min(
        target.maxHp,
        target.hp +
          healing.total
      );

    const actual =
      target.hp -
      hpBefore;

    healResult = {
      targetId:
        target.id,
      targetName:
        target.name,
      healAmount:
        actual,
      hpAfter:
        target.hp,
      maxHp:
        target.maxHp
    };

    logs.push(
      caster.name +
      ' conjura ' +
      rule.name +
      ' em ' +
      target.name +
      ' e restaura ' +
      actual +
      ' PV.'
    );

    return {
      rule,
      attackResult,
      healResult,
      affectedEnemyIds,
      defeatedEnemyIds,
      reactionLockedIds,
      logs
    };
  }

  const enemies =
    state.enemies.filter(
      (enemy) =>
        scopedEnemy(
          caster,
          enemy
        )
    );

  const primary =
    enemies.find(
      (enemy) =>
        enemy.id ===
        args.targetId
    );

  if (!primary) {
    throw new Error(
      'Selecione uma criatura hostil v?lida para ' +
      rule.name +
      '.'
    );
  }

  const distance =
    getGridDistance(
      caster,
      primary
    );

  if (
    distance >
    rule.rangeSquares
  ) {
    throw new Error(
      'Alvo fora do alcance de ' +
      rule.name +
      ': ' +
      distance +
      ' quadrados. Alcance m?ximo: ' +
      rule.rangeSquares +
      '.'
    );
  }

  const spellAttack =
    getSpellAttackBonus(
      caster
    );

  const cantripScale =
    getCantripMultiplier(
      caster.level
    );

  if (
    rule.mode === 'attack' ||
    rule.mode ===
      'multi-attack'
  ) {
    let attacks = 1;
    let damageFormula =
      '1d10';

    if (
      rule.id ===
      'raio-de-fogo'
    ) {
      damageFormula =
        String(
          cantripScale
        ) +
        'd10';
    }

    if (
      rule.id ===
      'toque-chocante'
    ) {
      damageFormula =
        String(
          cantripScale
        ) +
        'd8';
    }

    if (
      rule.id ===
      'rajada-mistica'
    ) {
      attacks =
        cantripScale;
      damageFormula =
        '1d10';
    }

    if (
      rule.id ===
      'raio-ardente'
    ) {
      attacks =
        slotLevel + 1;
      damageFormula =
        '2d6';
    }

    const hpBefore =
      primary.hp;

    const results:
      AttackResult[] =
      [];

    for (
      let index = 0;
      index < attacks;
      index++
    ) {
      const result =
        resolveAttack(
          {
            name:
              caster.name +
              ' ? ' +
              rule.name,
            attack:
              spellAttack,
            damage:
              damageFormula,
            conditions:
              caster.conditions,
            weapon:
              rule.name
          },
          {
            id:
              primary.id,
            name:
              primary.name,
            ac:
              primary.ac,
            hp:
              primary.hp,
            conditions:
              primary.conditions
          },
          'normal',
          rule.id !==
            'toque-chocante'
        );

      primary.hp =
        result.hpAfter;

      results.push(
        result
      );

      if (
        rule.id ===
          'toque-chocante' &&
        result.hit
      ) {
        reactionLockedIds.push(
          primary.id
        );
      }
    }

    const damage =
      hpBefore -
      primary.hp;

    const anyHit =
      results.some(
        (result) =>
          result.hit
      );

    const anyCrit =
      results.some(
        (result) =>
          result.isCrit
      );

    const last =
      results[
        results.length - 1
      ];

    attackResult = {
      ...last,
      text:
        caster.name +
        ' conjura ' +
        rule.name +
        ': ' +
        attacks +
        ' ataque(s), ' +
        damage +
        ' de dano total em ' +
        primary.name +
        '.',
      hit:
        anyHit,
      isCrit:
        anyCrit,
      damage,
      hpBefore,
      hpAfter:
        primary.hp
    };

    affectedEnemyIds.push(
      primary.id
    );

    if (
      hpBefore > 0 &&
      primary.hp <= 0
    ) {
      defeatedEnemyIds.push(
        primary.id
      );
    }

    logs.push(
      attackResult.text
    );
  }

  if (
    rule.mode ===
    'auto-hit'
  ) {
    const hpBefore =
      primary.hp;

    const darts =
      slotLevel + 2;

    let totalDamage = 0;

    for (
      let index = 0;
      index < darts;
      index++
    ) {
      totalDamage +=
        roll(
          '1d4+1'
        ).total;
    }

    primary.hp =
      Math.max(
        0,
        primary.hp -
          totalDamage
      );

    const actual =
      hpBefore -
      primary.hp;

    const text =
      caster.name +
      ' conjura ' +
      rule.name +
      ': ' +
      darts +
      ' dardos acertam automaticamente ' +
      primary.name +
      ' e causam ' +
      actual +
      ' de dano de For?a.';

    attackResult =
      makeSyntheticResult(
        caster,
        primary,
        hpBefore,
        primary.hp,
        actual,
        text,
        0,
        0,
        primary.ac,
        true
      );

    affectedEnemyIds.push(
      primary.id
    );

    if (
      hpBefore > 0 &&
      primary.hp <= 0
    ) {
      defeatedEnemyIds.push(
        primary.id
      );
    }

    logs.push(text);
  }

  if (
    rule.mode === 'save'
  ) {
    const dc =
      getSpellSaveDc(
        caster
      );

    const raw =
      d20().raw;

    const bonus =
      enemySaveBonus(
        primary,
        rule.saveAbility ||
          'Destreza'
      );

    const total =
      raw + bonus;

    const saved =
      total >= dc;

    const hpBefore =
      primary.hp;

    let damage = 0;

    if (!saved) {
      damage =
        roll(
          String(
            cantripScale
          ) +
            'd8'
        ).total;

      primary.hp =
        Math.max(
          0,
          primary.hp -
            damage
        );
    }

    const actual =
      hpBefore -
      primary.hp;

    const text =
      primary.name +
      ' faz salvaguarda de ' +
      (
        rule.saveAbility ||
        'Destreza'
      ) +
      ' contra CD ' +
      dc +
      ': ' +
      total +
      '. ' +
      (
        saved
          ? 'Sucesso, nenhum dano.'
          : 'Falha, sofre ' +
            actual +
            ' de dano.'
      );

    attackResult =
      makeSyntheticResult(
        caster,
        primary,
        hpBefore,
        primary.hp,
        actual,
        text,
        raw,
        total,
        dc,
        !saved
      );

    affectedEnemyIds.push(
      primary.id
    );

    if (
      hpBefore > 0 &&
      primary.hp <= 0
    ) {
      defeatedEnemyIds.push(
        primary.id
      );
    }

    logs.push(text);
  }

  if (
    rule.mode ===
    'aoe-save'
  ) {
    const dc =
      getSpellSaveDc(
        caster
      );

    const targets =
      directionalTargets(
        caster,
        primary,
        enemies,
        rule.areaShape ||
          'cone',
        rule.areaSizeSquares ||
          3
      );

    if (
      targets.length === 0
    ) {
      throw new Error(
        'Nenhuma criatura est? na ?rea de ' +
        rule.name +
        '.'
      );
    }

    let damageFormula =
      '3d6';

    if (
      rule.id ===
      'maos-flamejantes'
    ) {
      damageFormula =
        String(
          slotLevel + 2
        ) +
        'd6';
    }

    if (
      rule.id ===
      'onda-trovejante'
    ) {
      damageFormula =
        String(
          slotLevel + 1
        ) +
        'd8';
    }

    const sharedDamage =
      roll(
        damageFormula
      ).total;

    for (
      const enemy of targets
    ) {
      const hpBefore =
        enemy.hp;

      const raw =
        d20().raw;

      const bonus =
        enemySaveBonus(
          enemy,
          rule.saveAbility ||
            'Destreza'
        );

      const total =
        raw + bonus;

      const saved =
        total >= dc;

      const damage =
        saved
          ? (
              rule.halfOnSave
                ? Math.floor(
                    sharedDamage /
                    2
                  )
                : 0
            )
          : sharedDamage;

      enemy.hp =
        Math.max(
          0,
          enemy.hp -
            damage
        );

      if (
        !saved &&
        rule.pushSquares
      ) {
        pushAway(
          state,
          caster,
          enemy,
          rule.pushSquares,
          args.canOccupy
        );
      }

      const actual =
        hpBefore -
        enemy.hp;

      affectedEnemyIds.push(
        enemy.id
      );

      if (
        hpBefore > 0 &&
        enemy.hp <= 0
      ) {
        defeatedEnemyIds.push(
          enemy.id
        );
      }

      const text =
        enemy.name +
        ': salvaguarda de ' +
        (
          rule.saveAbility ||
          'Destreza'
        ) +
        ' ' +
        total +
        ' vs CD ' +
        dc +
        ' ? ' +
        (
          saved
            ? 'sucesso'
            : 'falha'
        ) +
        ' ? ' +
        actual +
        ' dano' +
        (
          !saved &&
          rule.pushSquares
            ? ' ? empurrado ' +
              rule.pushSquares +
              ' quadrado(s)'
            : ''
        );

      logs.push(text);

      if (
        enemy.id ===
        primary.id
      ) {
        attackResult =
          makeSyntheticResult(
            caster,
            enemy,
            hpBefore,
            enemy.hp,
            actual,
            text,
            raw,
            total,
            dc,
            !saved
          );
      }
    }
  }

  return {
    rule,
    attackResult,
    healResult,
    affectedEnemyIds,
    defeatedEnemyIds,
    reactionLockedIds,
    logs
  };
}

/**
 * SRD 5.2.1 / 2024: Favored Enemy grants free castings of Hunter's Mark per Long Rest
 * equal to the Ranger's Proficiency Bonus (2 at lvl 1-4, 3 at lvl 5-8, etc.).
 */
export function getRangerFreeHuntersMarkMaxUses(level: number): number {
  return prof(Math.max(1, level));
}

/**
 * SRD 5.2.1: Arcane Recovery allows a Wizard once per Long Rest on a Short Rest
 * to recover spell slots with combined level <= ceil(wizardLevel / 2), up to level 5 slots.
 */
export function getWizardArcaneRecoveryLimit(level: number): number {
  return Math.max(1, Math.ceil(Math.max(1, level) / 2));
}

/**
 * SRD 5.2.1: Mystic Arcanum spell levels granted at Warlock levels 11, 13, 15, 17.
 */
export function getMysticArcanumEligibleSpellLevels(level: number): number[] {
  const result: number[] = [];
  if (level >= 11) result.push(6);
  if (level >= 13) result.push(7);
  if (level >= 15) result.push(8);
  if (level >= 17) result.push(9);
  return result;
}

export function hasMysticArcanumAvailable(character: Character, spellLevel: number): boolean {
  if (character.className !== 'Bruxo') return false;
  const eligible = getMysticArcanumEligibleSpellLevels(character.level || 1);
  if (!eligible.includes(spellLevel)) return false;
  const spent = character.mysticArcanumSpent || [];
  return !spent.includes(spellLevel);
}
