import {
  d20,
  roll,
  getGridDistance,
  type State,
  type Character,
  type Enemy,
  type AttackResult,
  type ActiveSpellEffect,
  type ActiveSpellAppliedCondition
} from './game-engine';

import {
  getCreatureProfile
} from './creature-profiles';

import {
  findSrdSpell,
  getSpellDisplayName,
  getSpellRangeSquares,
  isCharacterSpellPrepared,
  type SrdSpellEntry
} from './srd-spellbook';

import {
  getSrdSpellRule,
  resolveSrdSpell,
  getCantripMultiplier,
  getSpellAttackBonus,
  getSpellSaveDc,
  getSpellcastingModifier,
  addFormulaBonus
} from './srd-combat';

export type SrdCastEconomy =
  | 'action'
  | 'bonus'
  | 'reaction';

export type SrdRuntimeSpellProfile = {
  canonicalName: string;
  displayName: string;
  level: number;
  rangeSquares: number;
  economy: SrdCastEconomy;
  concentration: boolean;
  ritual: boolean;
  duration: string;
};

export type SrdRuntimeResolution = {
  spellName: string;
  spellLevel: number;
  economy: SrdCastEconomy;
  attackResult: AttackResult | null;
  healResult: {
    targetId: string;
    targetName: string;
    healAmount: number;
    hpAfter: number;
    maxHp: number;
  } | null;
  affectedEnemyIds: string[];
  defeatedEnemyIds: string[];
  reactionLockedIds: string[];
  changedCharacterIds: string[];
  activeEffectIds: string[];
  requiresAdjudication: boolean;
  logs: string[];
};

function normalize(
  value: string
): string {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}

function unique(
  values: string[]
): string[] {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ];
}

function castEconomy(
  spell: SrdSpellEntry
): SrdCastEconomy {
  const text =
    normalize(
      String(
        spell.castingTime ||
        spell.actionType ||
        ''
      )
    );

  if (
    text.includes(
      'reaction'
    )
  ) {
    return 'reaction';
  }

  if (
    text.includes(
      'bonus'
    )
  ) {
    return 'bonus';
  }

  return 'action';
}

export function getSrdRuntimeSpellProfile(
  value: string
):
  | SrdRuntimeSpellProfile
  | undefined {
  const spell =
    findSrdSpell(value);

  if (!spell) {
    return undefined;
  }

  return {
    canonicalName:
      spell.name,

    displayName:
      getSpellDisplayName(
        spell.name
      ),

    level:
      spell.level,

    rangeSquares:
      getSpellRangeSquares(
        spell
      ),

    economy:
      castEconomy(
        spell
      ),

    concentration:
      Boolean(
        spell.concentration
      ),

    ritual:
      Boolean(
        spell.ritual
      ),

    duration:
      String(
        spell.duration ||
        'Instantaneous'
      )
  };
}

function firstDice(
  text: string
):
  | string
  | undefined {
  const match =
    /(\d+d(?:4|6|8|10|12|20)(?:\s*[+-]\s*\d+)?)/i
      .exec(
        text || ''
      );

  if (!match) {
    return undefined;
  }

  return match[1]
    .replace(
      /\s+/g,
      ''
    );
}

function damageFormula(
  spell: SrdSpellEntry
):
  | string
  | undefined {
  const text =
    spell.description ||
    '';

  const direct =
    /(\d+d(?:4|6|8|10|12|20)(?:\s*[+-]\s*\d+)?)\s+[A-Za-z]+\s+damage/i
      .exec(text);

  if (direct) {
    return direct[1]
      .replace(
        /\s+/g,
        ''
      );
  }

  if (
    /takes?\s+damage/i.test(
      text
    )
  ) {
    return firstDice(text);
  }

  return undefined;
}

function healingFormula(
  spell: SrdSpellEntry
):
  | string
  | undefined {
  const text =
    spell.description ||
    '';

  if (
    /can'?t regain hit points|cannot regain hit points/i.test(text) ||
    (/melee spell attack|ranged spell attack/i.test(text) && !/willing creature/i.test(text))
  ) {
    return undefined;
  }

  if (
    !/hit points/i.test(
      text
    ) ||
    !/regain|restore|healing/i.test(
      text
    )
  ) {
    return undefined;
  }

  return firstDice(text);
}

function temporaryHpFormula(
  spell: SrdSpellEntry
):
  | string
  | undefined {
  const text =
    spell.description ||
    '';

  if (
    !/temporary hit points/i.test(
      text
    )
  ) {
    return undefined;
  }

  return firstDice(text);
}

function diceParts(
  value:
    | string
    | undefined
):
  | {
      count: number;
      sides: number;
      bonus: number;
    }
  | undefined {
  if (!value) {
    return undefined;
  }

  const match =
    /^(\d+)d(4|6|8|10|12|20)([+-]\d+)?$/
      .exec(
        value.replace(
          /\s+/g,
          ''
        )
      );

  if (!match) {
    return undefined;
  }

  return {
    count:
      Number(match[1]),

    sides:
      Number(match[2]),

    bonus:
      Number(
        match[3] ||
        0
      )
  };
}

function formatDice(
  parts: {
    count: number;
    sides: number;
    bonus: number;
  }
): string {
  return (
    String(parts.count) +
    'd' +
    String(parts.sides) +
    (
      parts.bonus === 0
        ? ''
        : (
            parts.bonus > 0
              ? '+'
              : ''
          ) +
          String(parts.bonus)
    )
  );
}

function scaleCantripFormula(
  formula: string,
  casterLevel: number
): string {
  const parts =
    diceParts(formula);

  if (!parts) {
    return formula;
  }

  parts.count *=
    getCantripMultiplier(
      casterLevel
    );

  return formatDice(parts);
}

function scaleSlotFormula(
  formula: string,
  spell: SrdSpellEntry,
  slotLevel: number
): string {
  if (
    spell.level <= 0 ||
    slotLevel <=
      spell.level ||
    !spell.higherLevelSlot
  ) {
    return formula;
  }

  const base =
    diceParts(formula);

  const increment =
    diceParts(
      firstDice(
        spell.higherLevelSlot
      )
    );

  if (
    !base ||
    !increment ||
    base.sides !==
      increment.sides
  ) {
    return formula;
  }

  base.count +=
    increment.count *
    (
      slotLevel -
      spell.level
    );

  return formatDice(base);
}

type SaveAbility =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma';

function saveAbility(
  spell: SrdSpellEntry
):
  | SaveAbility
  | undefined {
  const text =
    spell.description ||
    '';

  const match =
    /(?:make|succeed on)\s+(?:a|an)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i
      .exec(text);

  if (!match) {
    return undefined;
  }

  return match[1]
    .toLowerCase() as
    SaveAbility;
}

function enemySaveBonus(
  enemy: Enemy,
  ability: SaveAbility
): number {
  const style =
    getCreatureProfile(
      enemy.name
    ).aiStyle;

  if (
    ability ===
      'strength'
  ) {
    if (
      style === 'brute' ||
      style === 'guardian' ||
      style === 'dragon'
    ) {
      return 3;
    }

    if (
      style === 'boss'
    ) {
      return 2;
    }

    return 0;
  }

  if (
    ability ===
      'dexterity'
  ) {
    if (
      style ===
      'skirmisher'
    ) {
      return 3;
    }

    if (
      style === 'caster' ||
      style === 'dragon'
    ) {
      return 2;
    }

    return 0;
  }

  if (
    ability ===
      'constitution'
  ) {
    if (
      style === 'dragon' ||
      style === 'boss' ||
      style === 'guardian'
    ) {
      return 3;
    }

    if (
      style === 'brute'
    ) {
      return 2;
    }

    return 0;
  }

  if (
    ability ===
      'intelligence'
  ) {
    return style ===
      'caster'
      ? 3
      : style ===
        'boss'
        ? 2
        : 0;
  }

  if (
    ability ===
      'wisdom'
  ) {
    return (
      style === 'caster' ||
      style === 'boss'
    )
      ? 2
      : 0;
  }

  return (
    style === 'boss' ||
    style === 'dragon'
  )
    ? 2
    : 0;
}

function durationRounds(
  spell: SrdSpellEntry
):
  | number
  | undefined {
  const text =
    normalize(
      String(
        spell.duration ||
        ''
      )
    );

  if (
    !text ||
    text.includes(
      'instant'
    )
  ) {
    return undefined;
  }

  if (
    text.includes(
      'until the start of your next turn'
    ) ||
    text.includes(
      'until the end of your next turn'
    )
  ) {
    return 1;
  }

  const round =
    /(\d+)\s+round/
      .exec(text);

  if (round) {
    return Number(
      round[1]
    );
  }

  const minute =
    /(\d+)\s+minute/
      .exec(text);

  if (minute) {
    return Number(
      minute[1]
    ) * 10;
  }

  const hour =
    /(\d+)\s+hour/
      .exec(text);

  if (hour) {
    return Number(
      hour[1]
    ) * 600;
  }

  return undefined;
}

type ConditionSpec = {
  english: string;
  portuguese: string;
};

const CONDITIONS:
  ConditionSpec[] = [
    {
      english:
        'blinded',
      portuguese:
        'Cego'
    },
    {
      english:
        'charmed',
      portuguese:
        'Enfeiticado'
    },
    {
      english:
        'deafened',
      portuguese:
        'Surdo'
    },
    {
      english:
        'frightened',
      portuguese:
        'Amedrontado'
    },
    {
      english:
        'grappled',
      portuguese:
        'Agarrado'
    },
    {
      english:
        'incapacitated',
      portuguese:
        'Incapacitado'
    },
    {
      english:
        'invisible',
      portuguese:
        'Invisivel'
    },
    {
      english:
        'paralyzed',
      portuguese:
        'Paralisado'
    },
    {
      english:
        'petrified',
      portuguese:
        'Petrificado'
    },
    {
      english:
        'poisoned',
      portuguese:
        'Envenenado'
    },
    {
      english:
        'prone',
      portuguese:
        'Caido'
    },
    {
      english:
        'restrained',
      portuguese:
        'Impedido'
    },
    {
      english:
        'stunned',
      portuguese:
        'Atordoado'
    },
    {
      english:
        'unconscious',
      portuguese:
        'Inconsciente'
    }
  ];

function inferConditions(
  spell: SrdSpellEntry
): string[] {
  const text =
    normalize(
      spell.description ||
      ''
    );

  const result:
    string[] =
    [];

  for (
    const condition of
    CONDITIONS
  ) {
    const key =
      condition.english;

    const patterns = [
      'has the ' +
        key +
        ' condition',

      'have the ' +
        key +
        ' condition',

      'gains the ' +
        key +
        ' condition',

      'is ' +
        key,

      'becomes ' +
        key
    ];

    if (
      patterns.some(
        (pattern) =>
          text.includes(
            pattern
          )
      )
    ) {
      result.push(
        condition.portuguese
      );
    }
  }

  return unique(result);
}

type AreaInfo = {
  shape:
    | 'sphere'
    | 'radius'
    | 'cone'
    | 'cube'
    | 'line';
  sizeSquares: number;
};

function areaInfo(
  spell: SrdSpellEntry
):
  | AreaInfo
  | undefined {
  const text =
    String(
      spell.description ||
      ''
    ) +
    ' ' +
    String(
      spell.range ||
      ''
    );

  const radius =
    /(\d+)[- ]foot[- ]radius/i
      .exec(text);

  if (radius) {
    return {
      shape: 'radius',
      sizeSquares:
        Math.max(
          1,
          Math.ceil(
            Number(
              radius[1]
            ) /
            5
          )
        )
    };
  }

  const sphere =
    /(\d+)[- ]foot[- ]radius sphere/i
      .exec(text);

  if (sphere) {
    return {
      shape: 'sphere',
      sizeSquares:
        Math.max(
          1,
          Math.ceil(
            Number(
              sphere[1]
            ) /
            5
          )
        )
    };
  }

  const cone =
    /(\d+)[- ]foot cone/i
      .exec(text);

  if (cone) {
    return {
      shape: 'cone',
      sizeSquares:
        Math.max(
          1,
          Math.ceil(
            Number(
              cone[1]
            ) /
            5
          )
        )
    };
  }

  const cube =
    /(\d+)[- ]foot cube/i
      .exec(text);

  if (cube) {
    return {
      shape: 'cube',
      sizeSquares:
        Math.max(
          1,
          Math.ceil(
            Number(
              cube[1]
            ) /
            5
          )
        )
    };
  }

  const line =
    /(\d+)[- ]foot[- ]long/i
      .exec(text);

  if (
    line &&
    /line/i.test(text)
  ) {
    return {
      shape: 'line',
      sizeSquares:
        Math.max(
          1,
          Math.ceil(
            Number(
              line[1]
            ) /
            5
          )
        )
    };
  }

  return undefined;
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

  if (
    caster.biome &&
    enemy.biome &&
    caster.biome !==
      enemy.biome
  ) {
    return false;
  }

  if (
    caster.partyId
  ) {
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

function enemiesInArea(
  caster: Character,
  primary: Enemy | undefined,
  enemies: Enemy[],
  area:
    | AreaInfo
    | undefined,
  selfOrigin:
    boolean
): Enemy[] {
  if (!area) {
    return primary
      ? [primary]
      : [];
  }

  const center =
    selfOrigin ||
    !primary
      ? caster
      : primary;

  if (
    area.shape ===
      'radius' ||
    area.shape ===
      'sphere' ||
    area.shape ===
      'cube'
  ) {
    return enemies.filter(
      (enemy) =>
        getGridDistance(
          center,
          enemy
        ) <=
        area.sizeSquares
    );
  }

  if (!primary) {
    return [];
  }

  const dx =
    primary.x -
    caster.x;

  const dy =
    primary.y -
    caster.y;

  const sx =
    dx === 0
      ? 0
      : dx > 0
        ? 1
        : -1;

  const sy =
    dy === 0
      ? 0
      : dy > 0
        ? 1
        : -1;

  if (
    area.shape ===
      'line'
  ) {
    return enemies.filter(
      (enemy) => {
        const ex =
          enemy.x -
          caster.x;

        const ey =
          enemy.y -
          caster.y;

        const forward =
          ex * sx +
          ey * sy;

        const lateral =
          Math.abs(
            ex * sy -
            ey * sx
          );

        return (
          forward > 0 &&
          forward <=
            area.sizeSquares &&
          lateral <= 1
        );
      }
    );
  }

  /*
   * Grid cone approximation:
   * width grows as it moves away from caster.
   */
  return enemies.filter(
    (enemy) => {
      const ex =
        enemy.x -
        caster.x;

      const ey =
        enemy.y -
        caster.y;

      const forward =
        ex * sx +
        ey * sy;

      const lateral =
        Math.abs(
          ex * sy -
          ey * sx
        );

      return (
        forward > 0 &&
        forward <=
          area.sizeSquares &&
        lateral <=
          forward
      );
    }
  );
}

function applyDamage(
  enemy: Enemy,
  damage: number
): {
  actual: number;
  before: number;
  after: number;
} {
  const before =
    enemy.hp;

  let remaining =
    Math.max(
      0,
      damage
    );

  if (
    (
      enemy.temporaryHp ||
      0
    ) > 0
  ) {
    const absorbed =
      Math.min(
        enemy.temporaryHp ||
        0,
        remaining
      );

    enemy.temporaryHp =
      Math.max(
        0,
        (
          enemy.temporaryHp ||
          0
        ) -
        absorbed
      );

    remaining -=
      absorbed;
  }

  enemy.hp =
    Math.max(
      0,
      enemy.hp -
        remaining
    );

  return {
    actual:
      before -
      enemy.hp,

    before,

    after:
      enemy.hp
  };
}

function applyCondition(
  target:
    | Character
    | Enemy,
  condition: string
): void {
  target.conditions =
    target.conditions ||
    [];

  if (
    !target.conditions
      .includes(
        condition
      )
  ) {
    target.conditions.push(
      condition
    );
  }
}

function teleportDestinationRangeSquares(
  spell: SrdSpellEntry,
  fallbackRangeSquares: number
): number {
  /*
   * Misty Step tem Range: Self, mas o destino real
   * fica a ate 30 pes no texto da magia.
   */
  if (
    normalize(
      spell.name
    ) ===
      'misty step'
  ) {
    return 6;
  }

  const description =
    String(
      spell.description ||
      ''
    );

  /*
   * Suporte generico para teleportes cujo texto diga
   * "up to X feet" ou "within X feet".
   */
  const distanceMatch =
    /(?:up to|within)\s+(\d+)\s+(?:feet|foot)/i
      .exec(
        description
      );

  if (
    distanceMatch
  ) {
    return Math.max(
      1,
      Math.ceil(
        Number(
          distanceMatch[1]
        ) /
        5
      )
    );
  }

  return Math.max(
    1,
    fallbackRangeSquares
  );
}

function isSelfOrigin(
  spell: SrdSpellEntry
): boolean {
  return normalize(
    String(
      spell.range ||
      ''
    )
  )
    .includes(
      'self'
    );
}

function pushDistanceSquares(
  spell: SrdSpellEntry
): number {
  const match =
    /pushed\s+(\d+)\s+feet/i
      .exec(
        spell.description ||
        ''
      );

  return match
    ? Math.max(
        1,
        Math.ceil(
          Number(
            match[1]
          ) /
          5
        )
      )
    : 0;
}

function pushAway(
  caster: Character,
  enemy: Enemy,
  squares: number,
  allEntities:
    Array<
      Character |
      Enemy
    >,
  canOccupy?:
    (
      x: number,
      y: number
    ) => boolean
): void {
  const sx =
    enemy.x ===
      caster.x
      ? 0
      : enemy.x >
        caster.x
        ? 1
        : -1;

  const sy =
    enemy.y ===
      caster.y
      ? 0
      : enemy.y >
        caster.y
        ? 1
        : -1;

  for (
    let step = 0;
    step < squares;
    step++
  ) {
    const nx =
      enemy.x +
      sx;

    const ny =
      enemy.y +
      sy;

    const occupied =
      allEntities.some(
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

function makeAttackResult(
  caster: Character,
  target: Enemy,
  data: {
    before: number;
    after: number;
    damage: number;
    roll: number;
    total: number;
    targetNumber: number;
    hit: boolean;
    critical?: boolean;
    text: string;
  }
): AttackResult {
  return {
    text:
      data.text,

    hit:
      data.hit,

    isCrit:
      Boolean(
        data.critical
      ),

    isFumble:
      data.roll === 1,

    d20Roll:
      data.roll,

    totalAttack:
      data.total,

    targetAc:
      data.targetNumber,

    damage:
      data.damage,

    attackerName:
      caster.name,

    targetName:
      target.name,

    targetId:
      target.id,

    hpBefore:
      data.before,

    hpAfter:
      data.after
  };
}

function effectId(): string {
  return (
    'spell-' +
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function otherEffectStillOwnsCondition(
  state: State,
  removingId: string,
  applied:
    ActiveSpellAppliedCondition
): boolean {
  return (
    state.spellEffects ||
    []
  ).some(
    (effect) =>
      effect.id !==
        removingId &&
      (
        effect
          .appliedConditions ||
        []
      ).some(
        (candidate) =>
          candidate.targetType ===
            applied.targetType &&
          candidate.targetId ===
            applied.targetId &&
          candidate.condition ===
            applied.condition
      )
  );
}

function removeEffect(
  state: State,
  effect:
    ActiveSpellEffect
): void {
  const remaining =
    (
      state.spellEffects ||
      []
    ).filter(
      (candidate) =>
        candidate.id !==
        effect.id
    );

  /*
   * Temporarily assign remaining effects so we can know
   * whether another spell still owns the same condition.
   */
  state.spellEffects =
    remaining;

  for (
    const applied of
    effect.appliedConditions ||
    []
  ) {
    if (
      otherEffectStillOwnsCondition(
        state,
        effect.id,
        applied
      )
    ) {
      continue;
    }

    const target =
      applied.targetType ===
        'character'
        ? state.characters.find(
            (character) =>
              character.id ===
              applied.targetId
          )
        : state.enemies.find(
            (enemy) =>
              enemy.id ===
              applied.targetId
          );

    if (!target) {
      continue;
    }

    target.conditions =
      (
        target.conditions ||
        []
      ).filter(
        (condition) =>
          condition !==
          applied.condition
      );
  }

  const caster =
    state.characters.find(
      (character) =>
        character.id ===
        effect.casterId
    );

  if (
    caster?.concentrationEffectId ===
      effect.id
  ) {
    caster.concentrationEffectId =
      undefined;
  }
}

/* SRD_3B_B3_PERSISTENT_COMBAT_EFFECTS */

function hasSrdCondition(
  entity: {
    conditions?: string[];
  },
  ...markers: string[]
): boolean {
  const values =
    (
      entity.conditions ||
      []
    ).map(
      (condition) =>
        normalize(
          condition
        )
    );

  return markers.some(
    (marker) => {
      const normalizedMarker =
        normalize(
          marker
        );

      return values.some(
        (condition) =>
          condition.includes(
            normalizedMarker
          )
      );
    }
  );
}

export type SrdSavingThrowResolution = {
  raw: number;
  abilityModifier: number;
  proficiencyBonus: number;
  exhaustionPenalty: number;
  blessBonus: number;
  banePenalty: number;
  total: number;
  dc: number;
  saved: boolean;
};

export function rollSrdCharacterSavingThrow(
  character: Character,
  abilityIndex: number,
  dc: number,
  options: {
    forcedD20?: number;
    forcedD4?: number;
  } = {}
): SrdSavingThrowResolution {
  const index =
    Math.max(
      0,
      Math.min(
        5,
        Math.trunc(
          abilityIndex
        )
      )
    );

  const raw =
    Number.isFinite(
      options.forcedD20
    )
      ? Math.max(
          1,
          Math.min(
            20,
            Math.trunc(
              Number(
                options.forcedD20
              )
            )
          )
        )
      : d20().raw;

  const abilityModifier =
    Math.floor(
      (
        (
          character.stats[
            index
          ] ||
          10
        ) -
        10
      ) /
      2
    );

  const proficiencyBonus =
    (
      Array.isArray(
        character.saves
      ) &&
      character.saves.includes(
        index
      )
    )
      ? (
          2 +
          Math.floor(
            (
              Math.max(
                1,
                character.level ||
                1
              ) -
              1
            ) /
            4
          )
        )
      : 0;

  const exhaustionPenalty =
    2 *
    Math.max(
      0,
      character.exhaustion ||
      0
    );

  const conditionDie =
    () =>
      Number.isFinite(
        options.forcedD4
      )
        ? Math.max(
            1,
            Math.min(
              4,
              Math.trunc(
                Number(
                  options.forcedD4
                )
              )
            )
          )
        : roll(
            '1d4'
          ).total;

  const blessBonus =
    hasSrdCondition(
      character,
      'bless',
      'abencoado'
    )
      ? conditionDie()
      : 0;

  const banePenalty =
    hasSrdCondition(
      character,
      'bane',
      'amaldicoado'
    )
      ? conditionDie()
      : 0;

  const total =
    raw +
    abilityModifier +
    proficiencyBonus -
    exhaustionPenalty +
    blessBonus -
    banePenalty;

  return {
    raw,
    abilityModifier,
    proficiencyBonus,
    exhaustionPenalty,
    blessBonus,
    banePenalty,
    total,
    dc,
    saved:
      total >= dc
  };
}

export type SrdCharacterDamageResolution = {
  incomingDamage: number;
  temporaryHpBefore: number;
  temporaryHpAbsorbed: number;
  temporaryHpAfter: number;
  hpBefore: number;
  hpDamage: number;
  hpAfter: number;
  concentrationChecked: boolean;
  concentrationDc?: number;
  concentrationSave?: SrdSavingThrowResolution;
  concentrationBroken: boolean;
};

export function applySrdCharacterDamage(
  state: State,
  target: Character,
  damage: number,
  options: {
    forcedConcentrationD20?: number;
    forcedConditionD4?: number;
  } = {}
): SrdCharacterDamageResolution {
  const incomingDamage =
    Math.max(
      0,
      Math.trunc(
        Number(
          damage
        ) ||
        0
      )
    );

  const temporaryHpBefore =
    Math.max(
      0,
      target.temporaryHp ||
      0
    );

  const temporaryHpAbsorbed =
    Math.min(
      temporaryHpBefore,
      incomingDamage
    );

  const temporaryHpAfter =
    temporaryHpBefore -
    temporaryHpAbsorbed;

  target.temporaryHp =
    temporaryHpAfter;

  const remainingDamage =
    Math.max(
      0,
      incomingDamage -
      temporaryHpAbsorbed
    );

  const hpBefore =
    Math.max(
      0,
      target.hp
    );

  target.hp =
    Math.max(
      0,
      target.hp -
      remainingDamage
    );

  const hpAfter =
    target.hp;

  const hpDamage =
    hpBefore -
    hpAfter;

  let concentrationChecked =
    false;

  let concentrationDc:
    | number
    | undefined;

  let concentrationSave:
    | SrdSavingThrowResolution
    | undefined;

  let concentrationBroken =
    false;

  if (
    incomingDamage > 0 &&
    target.concentrationEffectId
  ) {
    concentrationChecked =
      true;

    if (
      target.hp <= 0
    ) {
      breakSrdConcentration(
        state,
        target.id
      );

      concentrationBroken =
        true;
    } else {
      concentrationDc =
        Math.max(
          10,
          Math.floor(
            incomingDamage /
            2
          )
        );

      concentrationSave =
        rollSrdCharacterSavingThrow(
          target,
          2,
          concentrationDc,
          {
            forcedD20:
              options
                .forcedConcentrationD20,

            forcedD4:
              options
                .forcedConditionD4
          }
        );

      if (
        !concentrationSave.saved
      ) {
        breakSrdConcentration(
          state,
          target.id
        );

        concentrationBroken =
          true;
      }
    }
  }

  return {
    incomingDamage,
    temporaryHpBefore,
    temporaryHpAbsorbed,
    temporaryHpAfter,
    hpBefore,
    hpDamage,
    hpAfter,
    concentrationChecked,
    concentrationDc,
    concentrationSave,
    concentrationBroken
  };
}

export function applySrdMarkedAttackDamage(
  state: State,
  attackerId: string,
  targetId: string,
  result: AttackResult
): number {
  if (
    !result.hit
  ) {
    return 0;
  }

  const effect =
    (
      state.spellEffects ||
      []
    ).find(
      (candidate) =>
        candidate.casterId ===
          attackerId &&
        (
          candidate.spellName ===
            "Hunter's Mark" ||
          candidate.spellName ===
            'Hex'
        ) &&
        candidate.enemyTargetIds
          .includes(
            targetId
          )
    );

  if (!effect) {
    return 0;
  }

  /*
   * O dado extra faz parte do ataque e portanto
   * tambem dobra num acerto critico.
   */
  const extra =
    roll(
      '1d6',
      Boolean(
        result.isCrit
      )
    ).total;

  result.damage +=
    extra;

  result.hpAfter =
    Math.max(
      0,
      result.hpAfter -
      extra
    );

  result.text +=
    ' ' +
    (
      effect.spellName ===
        "Hunter's Mark"
        ? "Hunter's Mark"
        : 'Hex'
    ) +
    ': +' +
    extra +
    ' de dano.';

  return extra;
}

export function breakSrdConcentration(
  state: State,
  casterId: string
): void {
  const effect =
    (
      state.spellEffects ||
      []
    ).find(
      (candidate) =>
        candidate.casterId ===
          casterId &&
        candidate.concentration
    );

  if (effect) {
    removeEffect(
      state,
      effect
    );
  }

  const caster =
    state.characters.find(
      (character) =>
        character.id ===
        casterId
    );

  if (caster) {
    caster.concentrationEffectId =
      undefined;
  }
}

export function tickSrdSpellEffects(
  state: State
): void {
  state.spellEffects =
    state.spellEffects ||
    [];

  const expired =
    state.spellEffects.filter(
      (effect) => {
        const caster =
          state.characters.find(
            (character) =>
              character.id ===
              effect.casterId
          );

        if (
          effect.concentration &&
          (
            !caster ||
            caster.hp <= 0
          )
        ) {
          return true;
        }

        return (
          Number.isFinite(
            effect.expiresAtRound
          ) &&
          Number(
            effect.expiresAtRound
          ) <=
            (
              state.round ||
              0
            )
        );
      }
    );

  for (
    const effect of
    expired
  ) {
    removeEffect(
      state,
      effect
    );
  }
}

function registerEffect(
  state: State,
  caster: Character,
  spell: SrdSpellEntry,
  slotLevel: number,
  characterTargetIds: string[],
  enemyTargetIds: string[],
  appliedConditions:
    ActiveSpellAppliedCondition[],
  requiresAdjudication: boolean
):
  | string
  | undefined {
  const rounds =
    durationRounds(
      spell
    );

  const concentration =
    Boolean(
      spell.concentration
    );

  const persistent =
    concentration ||
    rounds !==
      undefined ||
    appliedConditions.length >
      0 ||
    requiresAdjudication;

  if (!persistent) {
    return undefined;
  }

  if (concentration) {
    breakSrdConcentration(
      state,
      caster.id
    );
  }

  state.spellEffects =
    state.spellEffects ||
    [];

  const id =
    effectId();

  const effect:
    ActiveSpellEffect = {
      id,

      spellName:
        spell.name,

      casterId:
        caster.id,

      spellLevel:
        slotLevel,

      concentration,

      createdRound:
        state.round ||
        0,

      expiresAtRound:
        rounds !==
          undefined
          ? (
              state.round ||
              0
            ) +
            rounds
          : undefined,

      characterTargetIds:
        unique(
          characterTargetIds
        ),

      enemyTargetIds:
        unique(
          enemyTargetIds
        ),

      appliedConditions,

      description:
        spell.description,

      requiresAdjudication
    };

  state.spellEffects.push(
    effect
  );

  if (concentration) {
    caster.concentrationEffectId =
      id;
  }

  return id;
}

function legacyResolution(
  state: State,
  caster: Character,
  spell: SrdSpellEntry,
  args: {
    spellName: string;
    spellLevel?: number;
    targetId?: string;
    canOccupy?: (
      x: number,
      y: number
    ) => boolean;
  }
):
  | SrdRuntimeResolution
  | undefined {
  const rule =
    getSrdSpellRule(
      args.spellName
    ) ||
    getSrdSpellRule(
      getSpellDisplayName(
        spell.name
      )
    );

  if (!rule) {
    return undefined;
  }

  const resolution =
    resolveSrdSpell(
      state,
      caster,
      {
        spellName:
          rule.name,

        spellLevel:
          args.spellLevel,

        targetId:
          args.targetId,

        canOccupy:
          args.canOccupy
      }
    );

  return {
    spellName:
      rule.name,

    spellLevel:
      rule.level === 0
        ? 0
        : Math.max(
            rule.level,
            Number(
              args.spellLevel ||
              rule.level
            )
          ),

    economy:
      castEconomy(
        spell
      ),

    attackResult:
      resolution.attackResult,

    healResult:
      resolution.healResult,

    affectedEnemyIds:
      resolution
        .affectedEnemyIds,

    defeatedEnemyIds:
      resolution
        .defeatedEnemyIds,

    reactionLockedIds:
      resolution
        .reactionLockedIds,

    changedCharacterIds:
      resolution.healResult
        ? [
            resolution
              .healResult
              .targetId
          ]
        : [],

    activeEffectIds:
      [],

    requiresAdjudication:
      false,

    logs:
      resolution.logs
  };
}

export function resolveSrdSpellRuntime(
  state: State,
  caster: Character,
  args: {
    spellName: string;
    spellLevel?: number;
    targetId?: string;
    targetX?: number;
    targetY?: number;
    canOccupy?: (
      x: number,
      y: number
    ) => boolean;
  }
): SrdRuntimeResolution {
  tickSrdSpellEffects(
    state
  );

  const spell =
    findSrdSpell(
      args.spellName
    );

  if (!spell) {
    throw new Error(
      'Magia ausente do catalogo SRD: ' +
      args.spellName
    );
  }

  if (
    !isCharacterSpellPrepared(
      caster,
      spell.name
    )
  ) {
    throw new Error(
      caster.name +
      ' nao possui ' +
      getSpellDisplayName(
        spell.name
      ) +
      ' preparada.'
    );
  }

  const special =
    legacyResolution(
      state,
      caster,
      spell,
      args
    );

  if (special) {
    return special;
  }

  const slotLevel =
    spell.level === 0
      ? 0
      : Math.max(
          spell.level,
          Number(
            args.spellLevel ||
            spell.level
          )
        );

  const profile =
    getSrdRuntimeSpellProfile(
      spell.name
    )!;

  const logs:
    string[] =
    [];

  const affectedEnemyIds:
    string[] =
    [];

  const defeatedEnemyIds:
    string[] =
    [];

  const reactionLockedIds:
    string[] =
    [];

  const changedCharacterIds:
    string[] =
    [];

  const activeEffectIds:
    string[] =
    [];

  const appliedConditions:
    ActiveSpellAppliedCondition[] =
    [];

  let attackResult:
    AttackResult | null =
    null;

  let healResult:
    SrdRuntimeResolution[
      'healResult'
    ] =
    null;

  let didMechanicalWork =
    false;

  const enemies =
    state.enemies.filter(
      (enemy) =>
        scopedEnemy(
          caster,
          enemy
        )
    );

  const primaryEnemy =
    enemies.find(
      (enemy) =>
        enemy.id ===
        args.targetId
    );

  const coordinateTarget:
    | Enemy
    | undefined =
    Number.isFinite(
      args.targetX
    ) &&
    Number.isFinite(
      args.targetY
    )
      ? {
          id:
            '__spell_point__',

          name:
            'Spell Target Point',

          hp: 1,
          maxHp: 1,
          ac: 0,
          attack: 0,
          damage: '0',
          initiative: 0,

          x:
            Number(
              args.targetX
            ),

          y:
            Number(
              args.targetY
            ),

          conditions: [],

          biome:
            caster.biome
        }
      : undefined;

  const friendly =
    state.characters.find(
      (character) =>
        character.id ===
        (
          args.targetId ||
          caster.id
        )
    );

  const description =
    spell.description ||
    '';

  const normalizedDescription =
    normalize(description);

  let damage =
    damageFormula(
      spell
    );

  let healing =
    healingFormula(
      spell
    );

  const tempHp =
    temporaryHpFormula(
      spell
    );

  const save =
    saveAbility(
      spell
    );

  const conditions =
    inferConditions(
      spell
    );

  /* SRD_3B_B3_BANE_CONDITION */
  if (
    spell.name ===
      'Bane' &&
    !conditions.some(
      (condition) =>
        normalize(
          condition
        ).includes(
          'bane'
        )
    )
  ) {
    conditions.push(
      'Amaldicoado (Bane)'
    );
  }

  const area =
    areaInfo(
      spell
    );

  if (
    damage &&
    spell.level === 0
  ) {
    damage =
      scaleCantripFormula(
        damage,
        caster.level
      );
  }

  if (
    damage &&
    spell.level > 0
  ) {
    damage =
      scaleSlotFormula(
        damage,
        spell,
        slotLevel
      );
  }

  if (
    healing &&
    spell.level > 0
  ) {
    healing =
      scaleSlotFormula(
        healing,
        spell,
        slotLevel
      );
  }

  if (
    healing &&
    /spellcasting ability modifier/i
      .test(description)
  ) {
    healing =
      addFormulaBonus(
        healing,
        getSpellcastingModifier(
          caster
        )
      );
  }

  /*
   * HEALING
   */
  if (
    healing &&
    friendly
  ) {
    const range =
      profile.rangeSquares;

    if (
      friendly.id !==
        caster.id &&
      range > 0 &&
      getGridDistance(
        caster,
        friendly
      ) > range
    ) {
      throw new Error(
        'Alvo fora do alcance de ' +
        profile.displayName +
        '.'
      );
    }

    const amount =
      roll(
        healing
      ).total;

    const before =
      friendly.hp;

    friendly.hp =
      Math.min(
        friendly.maxHp,
        friendly.hp +
          amount
      );

    const actual =
      friendly.hp -
      before;

    healResult = {
      targetId:
        friendly.id,

      targetName:
        friendly.name,

      healAmount:
        actual,

      hpAfter:
        friendly.hp,

      maxHp:
        friendly.maxHp
    };

    changedCharacterIds.push(
      friendly.id
    );

    didMechanicalWork =
      true;

    logs.push(
      caster.name +
      ' conjura ' +
      profile.displayName +
      ' em ' +
      friendly.name +
      ' e restaura ' +
      actual +
      ' PV.'
    );
  }

  /*
   * TEMPORARY HIT POINTS
   */
  if (
    tempHp &&
    friendly
  ) {
    let formula =
      tempHp;

    if (
      /spellcasting ability modifier/i
        .test(description)
    ) {
      formula =
        addFormulaBonus(
          formula,
          getSpellcastingModifier(
            caster
          )
        );
    }

    const amount =
      roll(formula)
        .total;

    friendly.temporaryHp =
      Math.max(
        friendly.temporaryHp ||
        0,
        amount
      );

    changedCharacterIds.push(
      friendly.id
    );

    didMechanicalWork =
      true;

    logs.push(
      friendly.name +
      ' recebe ' +
      amount +
      ' PV temporarios de ' +
      profile.displayName +
      '.'
    );
  }

  /*
   * TELEPORTATION:
   * server accepts targetX/targetY. Current UI can start
   * using these coordinates without changing the rules layer.
   */
  if (
    /teleport/i.test(
      description
    ) &&
    Number.isFinite(
      args.targetX
    ) &&
    Number.isFinite(
      args.targetY
    )
  ) {
    const mover =
      friendly ||
      caster;

    const targetX =
      Number(
        args.targetX
      );

    const targetY =
      Number(
        args.targetY
      );

    const distance =
      Math.max(
        Math.abs(
          mover.x -
          targetX
        ),
        Math.abs(
          mover.y -
          targetY
        )
      );

    const maxDistance =
      teleportDestinationRangeSquares(
        spell,
        profile.rangeSquares
      );

    if (
      distance >
      maxDistance
    ) {
      throw new Error(
        'Destino de teleporte fora do alcance.'
      );
    }

    if (
      args.canOccupy &&
      !args.canOccupy(
        targetX,
        targetY
      )
    ) {
      throw new Error(
        'O destino de teleporte nao pode ser ocupado.'
      );
    }

    mover.x =
      targetX;

    mover.y =
      targetY;

    changedCharacterIds.push(
      mover.id
    );

    didMechanicalWork =
      true;

    logs.push(
      mover.name +
      ' se teleporta por ' +
      profile.displayName +
      '.'
    );
  }

  /*
   * OFFENSIVE TARGETS
   */
  const normName = normalize(spell.name);
  const isExplicitBuff = [
    'resistance', 'bless', 'guidance', 'aid', 'heroism', 'beacon of hope', 'shield of faith',
    'protection from evil and good', 'protection from energy', 'death ward', 'freedom of movement',
    'sanctuary', 'enlarge reduce', 'resilient sphere', 'polymorph'
  ].includes(normName);

  const isTeleportOrUtility = [
    'dimension door', 'teleport', 'arcane gate', 'plane shift', 'dream', 'astral projection',
    'clone', 'wish', 'commune', 'scrying', 'arcane eye', 'contact other plane', 'sending',
    'animal messenger', 'locate animals or plants', 'locate creature', 'locate object'
  ].includes(normName) || /teleport/i.test(description);

  const offensive =
    !isExplicitBuff &&
    !isTeleportOrUtility &&
    Boolean(
      damage ||
      (save && !friendly) ||
      (
        conditions.length >
        0 &&
        !friendly
      )
    );

  if (
    offensive &&
    !primaryEnemy &&
    !(
      coordinateTarget &&
      area
    ) &&
    !isSelfOrigin(spell) &&
    !isTeleportOrUtility
  ) {
    throw new Error(
      'Selecione uma criatura hostil valida para ' +
      profile.displayName +
      '.'
    );
  }

  if (
    primaryEnemy &&
    profile.rangeSquares > 0 &&
    !isSelfOrigin(spell) &&
    getGridDistance(
      caster,
      primaryEnemy
    ) >
      profile.rangeSquares
  ) {
    throw new Error(
      'Alvo fora do alcance de ' +
      profile.displayName +
      '.'
    );
  }

  if (
    coordinateTarget &&
    area &&
    profile.rangeSquares > 0 &&
    !isSelfOrigin(spell) &&
    getGridDistance(
      caster,
      coordinateTarget
    ) >
      profile.rangeSquares
  ) {
    throw new Error(
      'Ponto alvo fora do alcance de ' +
      profile.displayName +
      '.'
    );
  }

  const offensiveTargets =
    enemiesInArea(
      caster,
      (
        coordinateTarget &&
        area
          ? coordinateTarget
          : primaryEnemy
      ),
      enemies,
      area,
      isSelfOrigin(
        spell
      )
    );

  /*
   * SPELL ATTACKS
   */
  const attackSpell =
    /spell attack/i
      .test(description);

  if (
    damage &&
    attackSpell &&
    !area
  ) {
    if (!primaryEnemy) {
      throw new Error(
        'Selecione um alvo para ' +
        profile.displayName +
        '.'
      );
    }

    const before =
      primaryEnemy.hp;

    const attackRoll =
      d20();

    const attackBonus =
      getSpellAttackBonus(
        caster
      );

    const total =
      attackRoll.raw +
      attackBonus;

    const critical =
      attackRoll.raw ===
      20;

    const hit =
      critical ||
      (
        attackRoll.raw !== 1 &&
        total >=
          primaryEnemy.ac
      );

    const rolledDamage =
      hit
        ? roll(
            damage,
            critical
          ).total
        : 0;

    const applied =
      applyDamage(
        primaryEnemy,
        rolledDamage
      );

    const text =
      caster.name +
      ' conjura ' +
      profile.displayName +
      ' contra ' +
      primaryEnemy.name +
      ': d20 ' +
      attackRoll.raw +
      ' + ' +
      attackBonus +
      ' = ' +
      total +
      ' vs CA ' +
      primaryEnemy.ac +
      '. ' +
      (
        hit
          ? (
              critical
                ? 'CRITICO! '
                : ''
            ) +
            applied.actual +
            ' de dano.'
          : 'Errou.'
      );

    attackResult =
      makeAttackResult(
        caster,
        primaryEnemy,
        {
          before,
          after:
            primaryEnemy.hp,
          damage:
            applied.actual,
          roll:
            attackRoll.raw,
          total,
          targetNumber:
            primaryEnemy.ac,
          hit,
          critical,
          text
        }
      );

    affectedEnemyIds.push(
      primaryEnemy.id
    );

    if (
      before > 0 &&
      primaryEnemy.hp <= 0
    ) {
      defeatedEnemyIds.push(
        primaryEnemy.id
      );
    }

    didMechanicalWork =
      true;

    logs.push(text);
  }

  /*
   * DAMAGE WITH SAVING THROW / GENERIC AREA DAMAGE
   */
  if (
    damage &&
    !attackSpell
  ) {
    const targets =
      offensiveTargets.length >
        0
        ? offensiveTargets
        : primaryEnemy
          ? [primaryEnemy]
          : [];

    if (
      targets.length >
      0
    ) {
      const shared =
        roll(damage)
          .total;

      const dc =
        getSpellSaveDc(
          caster
        );

      const halfOnSave =
        /half as much damage/i
          .test(description);

      for (
        const enemy of
        targets
      ) {
        const before =
          enemy.hp;

        let saved =
          false;

        let raw =
          0;

        let total =
          0;

        if (save) {
          raw =
            d20().raw;

          total =
            raw +
            enemySaveBonus(
              enemy,
              save
            );

          saved =
            total >= dc;
        }

        const finalDamage =
          saved
            ? (
                halfOnSave
                  ? Math.floor(
                      shared /
                      2
                    )
                  : 0
              )
            : shared;

        const applied =
          applyDamage(
            enemy,
            finalDamage
          );

        affectedEnemyIds.push(
          enemy.id
        );

        if (
          before > 0 &&
          enemy.hp <= 0
        ) {
          defeatedEnemyIds.push(
            enemy.id
          );
        }

        const text =
          caster.name +
          ' conjura ' +
          profile.displayName +
          ' em ' +
          enemy.name +
          (
            save
              ? (
                  ': salvaguarda ' +
                  raw +
                  ' -> ' +
                  total +
                  ' vs CD ' +
                  dc +
                  '. '
                )
              : ': '
          ) +
          applied.actual +
          ' de dano.';

        logs.push(text);

        if (!attackResult) {
          attackResult =
            makeAttackResult(
              caster,
              enemy,
              {
                before,
                after:
                  enemy.hp,
                damage:
                  applied.actual,
                roll:
                  raw,
                total:
                  total,
                targetNumber:
                  save
                    ? dc
                    : enemy.ac,
                hit:
                  save
                    ? !saved
                    : true,
                text
              }
            );
        }

        if (
          !saved &&
          pushDistanceSquares(
            spell
          ) > 0
        ) {
          pushAway(
            caster,
            enemy,
            pushDistanceSquares(
              spell
            ),
            [
              ...state.characters,
              ...state.enemies
            ],
            args.canOccupy
          );
        }
      }

      didMechanicalWork =
        true;
    }
  }

  /*
   * CONDITIONS.
   *
   * With a save, conditions are only applied when the
   * selected enemy fails. Without a save, a friendly
   * target receives buff-like conditions.
   */
  if (
    conditions.length >
    0
  ) {
    if (
      save &&
      primaryEnemy &&
      !damage
    ) {
      const dc =
        getSpellSaveDc(
          caster
        );

      const raw =
        d20().raw;

      /* SRD_3B_B3_BANE_ENEMY_SAVE */
      const primaryEnemyBanePenalty =
        hasSrdCondition(
          primaryEnemy,
          'bane',
          'amaldicoado'
        )
          ? roll(
              '1d4'
            ).total
          : 0;

      const total =
        raw +
        enemySaveBonus(
          primaryEnemy,
          save
        ) -
        primaryEnemyBanePenalty;

      const saved =
        total >= dc;

      logs.push(
        primaryEnemy.name +
        ' realiza salvaguarda contra ' +
        profile.displayName +
        ': ' +
        total +
        ' vs CD ' +
        dc +
        '.'
      );

      if (!saved) {
        for (
          const condition of
          conditions
        ) {
          applyCondition(
            primaryEnemy,
            condition
          );

          appliedConditions.push({
            targetType:
              'enemy',
            targetId:
              primaryEnemy.id,
            condition
          });
        }

        affectedEnemyIds.push(
          primaryEnemy.id
        );

        didMechanicalWork =
          true;
      }
    } else if (
      !save &&
      friendly
    ) {
      for (
        const condition of
        conditions
      ) {
        applyCondition(
          friendly,
          condition
        );

        appliedConditions.push({
          targetType:
            'character',
          targetId:
            friendly.id,
          condition
        });
      }

      changedCharacterIds.push(
        friendly.id
      );

      didMechanicalWork =
        true;
    } else if (
      !save &&
      primaryEnemy
    ) {
      for (
        const condition of
        conditions
      ) {
        applyCondition(
          primaryEnemy,
          condition
        );

        appliedConditions.push({
          targetType:
            'enemy',
          targetId:
            primaryEnemy.id,
          condition
        });
      }

      affectedEnemyIds.push(
        primaryEnemy.id
      );

      didMechanicalWork =
        true;
    }
  }

  /*
   * Frequently used effects that are represented in the
   * existing combat engine as conditions.
   */
  if (
    spell.name ===
      'Bless' &&
    friendly
  ) {
    const condition =
      'Abencoado (Bless)';

    applyCondition(
      friendly,
      condition
    );

    appliedConditions.push({
      targetType:
        'character',
      targetId:
        friendly.id,
      condition
    });

    changedCharacterIds.push(
      friendly.id
    );

    didMechanicalWork =
      true;
  }

  if (
    spell.name ===
      'Invisibility' &&
    friendly
  ) {
    const condition =
      'Invisivel';

    applyCondition(
      friendly,
      condition
    );

    appliedConditions.push({
      targetType:
        'character',
      targetId:
        friendly.id,
      condition
    });

    changedCharacterIds.push(
      friendly.id
    );

    didMechanicalWork =
      true;
  }

  if (
    spell.name ===
      "Hunter's Mark" &&
    primaryEnemy
  ) {
    const condition =
      "Marcado por Hunter's Mark";

    applyCondition(
      primaryEnemy,
      condition
    );

    appliedConditions.push({
      targetType:
        'enemy',
      targetId:
        primaryEnemy.id,
      condition
    });

    affectedEnemyIds.push(
      primaryEnemy.id
    );

    didMechanicalWork =
      true;
  }

  if (
    spell.name ===
      'Hex' &&
    primaryEnemy
  ) {
    const condition =
      'Hex';

    applyCondition(
      primaryEnemy,
      condition
    );

    appliedConditions.push({
      targetType:
        'enemy',
      targetId:
        primaryEnemy.id,
      condition
    });

    affectedEnemyIds.push(
      primaryEnemy.id
    );

    didMechanicalWork =
      true;
  }

  /*
   * If the spell has no deterministic primitive we can apply
   * safely, it still CASTS and becomes a structured SRD effect.
   * The GM/narrative layer can adjudicate the open-ended text.
   */
    const requiresAdjudication =
    !didMechanicalWork;

  if (
    requiresAdjudication
  ) {
    logs.push(
      caster.name +
      ' conjura ' +
      profile.displayName +
      '. O efeito SRD foi registrado para adjudicacao narrativa: ' +
      description
    );
  }

  const effect =
    registerEffect(
      state,
      caster,
      spell,
      slotLevel,
      unique(
        changedCharacterIds
      ),
      unique(
        affectedEnemyIds
      ),
      appliedConditions,
      requiresAdjudication
    );

  if (effect) {
    activeEffectIds.push(
      effect
    );
  }

  if (
    spell.concentration &&
    effect
  ) {
    logs.push(
      caster.name +
      ' esta concentrando-se em ' +
      profile.displayName +
      '.'
    );
  }

  return {
    spellName:
      profile.displayName,

    spellLevel:
      slotLevel,

    economy:
      profile.economy,

    attackResult,

    healResult,

    affectedEnemyIds:
      unique(
        affectedEnemyIds
      ),

    defeatedEnemyIds:
      unique(
        defeatedEnemyIds
      ),

    reactionLockedIds,

    changedCharacterIds:
      unique(
        changedCharacterIds
      ),

    activeEffectIds,

    requiresAdjudication,

    logs
  };
}
