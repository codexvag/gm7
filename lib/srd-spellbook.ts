import {
  SRD_SPELL_DATA
} from './generated/srd-spells-5-2-1';

export type SrdSpellEntry = {
  name: string;
  level: number;
  school: string;
  classes: readonly string[];
  actionType?: string;
  concentration?: boolean;
  ritual?: boolean;
  castingTime?: string;
  range?: string;
  components?: readonly string[];
  material?: string;
  duration?: string;
  description: string;
  higherLevelSlot?: string;
  cantripUpgrade?: string;
};

export type SpellCharacterLike = {
  className: string;
  level: number;
  spells?: string;
  knownCantrips?: string[];
  preparedSpells?: string[];
  spellbook?: string[];
  spellSelectionVersion?: number;
};

export type LevelUpSpellChoices = {
  newCantrips: string[];
  newPrepared: string[];
  newSpellbook: string[];
};

export type SpellProgression = {
  cantrips: number[];
  prepared: number[];
  spellbookAddsPerLevel?: number;
};

const DATA =
  SRD_SPELL_DATA as unknown as
    SrdSpellEntry[];

const PT_TO_SRD_CLASS:
  Record<string, string> = {
    Bardo:
      'bard',

    'Cl\u00E9rigo':
      'cleric',

    Druida:
      'druid',

    Paladino:
      'paladin',

    Patrulheiro:
      'ranger',

    Feiticeiro:
      'sorcerer',

    Bruxo:
      'warlock',

    Mago:
      'wizard'
  };

const SRD_TO_PT_CLASS:
  Record<string, string> = {
    bard:
      'Bardo',

    cleric:
      'Cl\u00E9rigo',

    druid:
      'Druida',

    paladin:
      'Paladino',

    ranger:
      'Patrulheiro',

    sorcerer:
      'Feiticeiro',

    warlock:
      'Bruxo',

    wizard:
      'Mago'
  };

const PT_ALIAS_TO_SRD:
  Record<string, string> = {
    'Raio de Fogo':
      'Fire Bolt',

    'Rajada M\u00EDstica':
      'Eldritch Blast',

    'Toque Chocante':
      'Shocking Grasp',

    'Chama Sagrada':
      'Sacred Flame',

    'Curar Ferimentos':
      'Cure Wounds',

    'M\u00EDsseis M\u00E1gicos':
      'Magic Missile',

    'M\u00E3os Flamejantes':
      'Burning Hands',

    'Onda Trovejante':
      'Thunderwave',

    'Raio Ardente':
      'Scorching Ray',

    'Escudo Arcano':
      'Shield'
  };

const SRD_TO_PT_ALIAS =
  Object.fromEntries(
    Object.entries(
      PT_ALIAS_TO_SRD
    ).map(
      ([pt, srd]) => [
        srd,
        pt
      ]
    )
  );

function normalize(
  value: string
): string {
  return String(
    value || ''
  )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[?']/g,
      ''
    )
    .replace(
      /[^a-zA-Z0-9]+/g,
      ' '
    )
    .trim()
    .toLowerCase();
}

export function slugifySpell(
  value: string
): string {
  return normalize(value)
    .replace(
      /\s+/g,
      '-'
    );
}

export function getAllSrdSpells():
  SrdSpellEntry[] {
  return [
    ...DATA
  ];
}

export function resolveCanonicalSpellName(
  value: string
): string {
  const alias =
    Object.entries(
      PT_ALIAS_TO_SRD
    ).find(
      ([pt]) =>
        normalize(pt) ===
        normalize(value)
    );

  if (alias) {
    return alias[1];
  }

  const found =
    DATA.find(
      (spell) =>
        normalize(
          spell.name
        ) ===
        normalize(value)
    );

  return (
    found?.name ||
    value
  );
}

export function getSpellDisplayName(
  value: string
): string {
  const canonical =
    resolveCanonicalSpellName(
      value
    );

  return (
    SRD_TO_PT_ALIAS[
      canonical
    ] ||
    canonical
  );
}

export function findSrdSpell(
  value: string
):
  | SrdSpellEntry
  | undefined {
  const canonical =
    resolveCanonicalSpellName(
      value
    );

  return DATA.find(
    (spell) =>
      normalize(
        spell.name
      ) ===
      normalize(
        canonical
      )
  );
}

export function getPtClassesForSpell(
  spell: SrdSpellEntry
): string[] {
  return spell.classes
    .map(
      (className) =>
        SRD_TO_PT_CLASS[
          className
            .toLowerCase()
        ]
    )
    .filter(
      Boolean
    );
}

export function getSrdSpellsForClass(
  className: string,
  level?:
    | number
    | null
): SrdSpellEntry[] {
  const srdClass =
    PT_TO_SRD_CLASS[
      className
    ];

  if (!srdClass) {
    return [];
  }

  return DATA
    .filter(
      (spell) =>
        spell.classes
          .map(
            (entry) =>
              entry.toLowerCase()
          )
          .includes(
            srdClass
          ) &&
        (
          level == null ||
          spell.level ===
            level
        )
    )
    .sort(
      (left, right) =>
        left.level -
          right.level ||
        left.name.localeCompare(
          right.name
        )
    );
}

export function getSpellRangeSquares(
  spell:
    | SrdSpellEntry
    | string
):
  number {
  const range =
    typeof spell ===
      'string'
      ? spell
      : spell.range ||
        '';

  const normalized =
    range.toLowerCase();

  if (
    normalized.includes(
      'self'
    )
  ) {
    return 0;
  }

  if (
    normalized.includes(
      'touch'
    )
  ) {
    return 1;
  }

  if (
    normalized.includes(
      'sight'
    )
  ) {
    return 200;
  }

  if (
    normalized.includes(
      'unlimited'
    )
  ) {
    return 999;
  }

  const match =
    /(\d+)\s*feet/i.exec(
      range
    );

  if (!match) {
    return 0;
  }

  return Math.max(
    1,
    Math.ceil(
      Number(
        match[1]
      ) /
      5
    )
  );
}

function firstDiceExpression(
  text: string
):
  | string
  | undefined {
  const match =
    /(\d+d(?:4|6|8|10|12|20)(?:\s*[+-]\s*\d+)?)/i
      .exec(
        text ||
        ''
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

function damageDice(
  spell: SrdSpellEntry
):
  | string
  | undefined {
  const match =
    /(\d+d(?:4|6|8|10|12|20)(?:\s*[+-]\s*\d+)?)\s+[A-Za-z]+\s+damage/i
      .exec(
        spell.description ||
        ''
      );

  return match
    ? match[1]
        .replace(
          /\s+/g,
          ''
        )
    : undefined;
}

function healingDice(
  spell: SrdSpellEntry
):
  | string
  | undefined {
  const text =
    spell.description ||
    '';

  if (
    /can'?t regain hit points|cannot regain hit points/i.test(
      text
    )
  ) {
    return undefined;
  }

  if (
    /melee spell attack|ranged spell attack/i.test(text) &&
    !/willing creature/i.test(text)
  ) {
    return undefined;
  }

  if (
    !/hit points/i.test(
      text
    )
  ) {
    return undefined;
  }

  if (
    !/regain|restore|healing/i.test(
      text
    )
  ) {
    return undefined;
  }

  return firstDiceExpression(
    text
  );
}

function areaRadiusSquares(
  spell: SrdSpellEntry
):
  | number
  | undefined {
  const text =
    (
      spell.description ||
      ''
    ) +
    ' ' +
    (
      spell.range ||
      ''
    );

  const radius =
    /(\d+)[- ]foot[- ]radius/i
      .exec(
        text
      );

  if (radius) {
    return Math.max(
      1,
      Math.ceil(
        Number(
          radius[1]
        ) /
        5
      )
    );
  }

  const cone =
    /(\d+)[- ]foot Cone/i
      .exec(
        text
      );

  if (cone) {
    return Math.max(
      1,
      Math.ceil(
        Number(
          cone[1]
        ) /
        5
      )
    );
  }

  const cube =
    /(\d+)[- ]foot Cube/i
      .exec(
        text
      );

  if (cube) {
    return Math.max(
      1,
      Math.ceil(
        Number(
          cube[1]
        ) /
        5
      )
    );
  }

  return undefined;
}

export type HudSpellEconomy =
  | 'action'
  | 'bonus'
  | 'reaction';

export type HudSpellTargetMode =
  | 'enemy'
  | 'ally'
  | 'self'
  | 'point'
  | 'area';

export function getHudSpellEconomy(
  spell: SrdSpellEntry
): HudSpellEconomy {
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

export function getHudSpellTargetMode(
  spell: SrdSpellEntry
): HudSpellTargetMode {
  const text =
    normalize(
      spell.description ||
      ''
    );

  const range =
    normalize(
      String(
        spell.range ||
        ''
      )
    );

  const name =
    normalize(
      spell.name
    );

  const area =
    areaRadiusSquares(
      spell
    );

  /* Explicit known ally buffs */
  if (
    [
      'bless',
      'guidance',
      'resistance',
      'heroism',
      'aid',
      'beacon of hope',
      'shield of faith',
      'protection from evil and good',
      'protection from energy',
      'death ward',
      'freedom of movement',
      'sanctuary'
    ].includes(name)
  ) {
    return 'ally';
  }

  /* Teleports to point / destination */
  if (
    [
      'misty step',
      'dimension door',
      'teleport',
      'arcane gate'
    ].includes(name) ||
    (
      text.includes('teleport') &&
      (
        text.includes('unoccupied space') ||
        text.includes('space you can see') ||
        text.includes('location within range') ||
        text.includes('destination') ||
        name === 'misty step'
      )
    )
  ) {
    return 'point';
  }

  /* Point-centered areas */
  if (
    area &&
    (
      text.includes('point you choose') ||
      text.includes('point within range') ||
      text.includes('point in space') ||
      text.includes('centered on a point') ||
      text.includes('point you can see')
    )
  ) {
    return 'area';
  }

  if (healingDice(spell)) {
    return 'ally';
  }

  /* Offensive attacks against creatures always target enemy even if range is self (e.g. Vampiric Touch) */
  if (
    name === 'vampiric touch' ||
    text.includes('melee spell attack against a') ||
    text.includes('ranged spell attack against a')
  ) {
    return 'enemy';
  }

  /* Self-only utility/buffs */
  if (
    range.includes('self') &&
    !text.includes('cube originating from you') &&
    !text.includes('cone originating from you') &&
    !text.includes('line originating from you')
  ) {
    return 'self';
  }

  /* Offensive touch / spell attacks / hostile saves */
  if (
    damageDice(spell) ||
    text.includes('spell attack') ||
    text.includes('melee spell attack') ||
    text.includes('ranged spell attack') ||
    (
      text.includes('saving throw') &&
      (
        text.includes('target takes') ||
        text.includes('failed save') ||
        text.includes('hostile')
      )
    )
  ) {
    return 'enemy';
  }

  /* Common beneficial creature-target spells */
  if (
    text.includes('willing creature') ||
    (
      text.includes('creature you touch') &&
      !damageDice(spell) &&
      !text.includes('failed save')
    ) ||
    (
      text.includes('creatures of your choice') &&
      !text.includes('saving throw') &&
      !damageDice(spell)
    )
  ) {
    return 'ally';
  }

  if (range.includes('self')) {
    return 'self';
  }

  return 'enemy';
}

export function toHudSpell(
  spell: SrdSpellEntry
) {
  return {
    id:
      slugifySpell(
        spell.name
      ),

    name:
      getSpellDisplayName(
        spell.name
      ),

    canonicalName:
      spell.name,

    level:
      spell.level,

    school:
      spell.school,

    castTime:
      spell.castingTime ||
      spell.actionType ||
      'Action',

    actionType:
      spell.actionType ||
      'action',

    economyType:
      getHudSpellEconomy(
        spell
      ),

    targetMode:
      getHudSpellTargetMode(
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

    rangeSquares:
      getSpellRangeSquares(
        spell
      ),

    aoeRadiusSquares:
      areaRadiusSquares(
        spell
      ),

    damageFormula:
      damageDice(
        spell
      ),

    healFormula:
      healingDice(
        spell
      ),

    description:
      spell.description,

    duration:
      spell.duration ||
      'Instantaneous',

    classes:
      getPtClassesForSpell(
        spell
      )
  };
}

const FULL_CASTER_PREPARED =
  [
    4, 5, 6, 7, 9,
    10, 11, 12, 14, 15,
    16, 16, 17, 17, 18,
    18, 19, 20, 21, 22
  ];

const HALF_CASTER_PREPARED =
  [
    2, 3, 4, 5, 6,
    6, 7, 7, 9, 9,
    10, 10, 11, 11, 12,
    12, 14, 14, 15, 15
  ];

export const SPELL_PROGRESSIONS:
  Record<
    string,
    SpellProgression
  > = {
    Bardo: {
      cantrips: [
        2, 2, 2, 3, 3,
        3, 3, 3, 3, 4,
        4, 4, 4, 4, 4,
        4, 4, 4, 4, 4
      ],

      prepared:
        FULL_CASTER_PREPARED
    },

    'Cl\u00E9rigo': {
      cantrips: [
        3, 3, 3, 4, 4,
        4, 4, 4, 4, 5,
        5, 5, 5, 5, 5,
        5, 5, 5, 5, 5
      ],

      prepared:
        FULL_CASTER_PREPARED
    },

    Druida: {
      cantrips: [
        2, 2, 2, 3, 3,
        3, 3, 3, 3, 4,
        4, 4, 4, 4, 4,
        4, 4, 4, 4, 4
      ],

      prepared:
        FULL_CASTER_PREPARED
    },

    Paladino: {
      cantrips:
        Array(20)
          .fill(0),

      prepared:
        HALF_CASTER_PREPARED
    },

    Patrulheiro: {
      cantrips:
        Array(20)
          .fill(0),

      prepared:
        HALF_CASTER_PREPARED
    },

    Feiticeiro: {
      cantrips: [
        4, 4, 4, 5, 5,
        5, 5, 5, 5, 6,
        6, 6, 6, 6, 6,
        6, 6, 6, 6, 6
      ],

      prepared: [
        2, 4, 6, 7, 9,
        10, 11, 12, 14, 15,
        16, 16, 17, 17, 18,
        18, 19, 20, 21, 22
      ]
    },

    Bruxo: {
      cantrips: [
        2, 2, 2, 3, 3,
        3, 3, 3, 3, 4,
        4, 4, 4, 4, 4,
        4, 4, 4, 4, 4
      ],

      prepared: [
        2, 3, 4, 5, 6,
        7, 8, 9, 10, 10,
        11, 11, 12, 12, 13,
        13, 14, 14, 15, 15
      ]
    },

    Mago: {
      cantrips: [
        3, 3, 3, 4, 4,
        4, 4, 4, 4, 5,
        5, 5, 5, 5, 5,
        5, 5, 5, 5, 5
      ],

      prepared: [
        4, 5, 6, 7, 9,
        10, 11, 12, 14, 15,
        16, 16, 17, 18, 19,
        21, 22, 23, 24, 25
      ],

      spellbookAddsPerLevel:
        2
    }
  };

function limitAt(
  values: number[],
  level: number
): number {
  return (
    values[
      Math.max(
        0,
        Math.min(
          19,
          level - 1
        )
      )
    ] ||
    0
  );
}

export function getCantripLimit(
  className: string,
  level: number
): number {
  return limitAt(
    SPELL_PROGRESSIONS[
      className
    ]?.cantrips ||
    [],
    level
  );
}

export function getPreparedSpellLimit(
  className: string,
  level: number
): number {
  return limitAt(
    SPELL_PROGRESSIONS[
      className
    ]?.prepared ||
    [],
    level
  );
}

export function getMaxSpellLevelForClass(
  className: string,
  characterLevel: number
): number {
  if (
    [
      'Bardo',
      'Cl\u00E9rigo',
      'Druida',
      'Feiticeiro',
      'Mago'
    ].includes(
      className
    )
  ) {
    if (
      characterLevel >=
      17
    ) {
      return 9;
    }

    return Math.max(
      1,
      Math.ceil(
        characterLevel /
        2
      )
    );
  }

  if (
    [
      'Paladino',
      'Patrulheiro'
    ].includes(
      className
    )
  ) {
    if (
      characterLevel >=
      17
    ) {
      return 5;
    }

    if (
      characterLevel >=
      13
    ) {
      return 4;
    }

    if (
      characterLevel >=
      9
    ) {
      return 3;
    }

    if (
      characterLevel >=
      5
    ) {
      return 2;
    }

    return 1;
  }

  if (
    className ===
    'Bruxo'
  ) {
    if (
      characterLevel >=
      9
    ) {
      return 5;
    }

    if (
      characterLevel >=
      7
    ) {
      return 4;
    }

    if (
      characterLevel >=
      5
    ) {
      return 3;
    }

    if (
      characterLevel >=
      3
    ) {
      return 2;
    }

    return 1;
  }

  return 0;
}

export function getInitialSpellSelectionRules(
  className: string
): {
  cantrips: number;
  prepared: number;
  spellbook: number;
} {
  if (
    !SPELL_PROGRESSIONS[
      className
    ]
  ) {
    return {
      cantrips: 0,
      prepared: 0,
      spellbook: 0
    };
  }

  return {
    cantrips:
      getCantripLimit(
        className,
        1
      ),

    prepared:
      getPreparedSpellLimit(
        className,
        1
      ),

    spellbook:
      className ===
        'Mago'
        ? 6
        : 0
  };
}

export function getLevelUpSpellRequirements(
  className: string,
  oldLevel: number,
  newLevel: number
): {
  cantrips: number;
  prepared: number;
  spellbook: number;
} {
  const oldCantrips =
    getCantripLimit(
      className,
      oldLevel
    );

  const newCantrips =
    getCantripLimit(
      className,
      newLevel
    );

  const oldPrepared =
    getPreparedSpellLimit(
      className,
      oldLevel
    );

  const newPrepared =
    getPreparedSpellLimit(
      className,
      newLevel
    );

  return {
    cantrips:
      Math.max(
        0,
        newCantrips -
        oldCantrips
      ),

    prepared:
      Math.max(
        0,
        newPrepared -
        oldPrepared
      ),

    spellbook:
      className ===
        'Mago' &&
      newLevel >
        oldLevel
        ? 2
        : 0
  };
}

export function getAlwaysPreparedSpells(
  className: string,
  level: number
): string[] {
  const result:
    string[] =
    [];

  if (
    className ===
      'Patrulheiro' &&
    level >= 1
  ) {
    result.push(
      "Hunter's Mark"
    );
  }

  if (
    className ===
      'Paladino' &&
    level >= 2
  ) {
    result.push(
      'Divine Smite'
    );
  }

  if (
    className ===
      'Druida' &&
    level >= 1
  ) {
    result.push(
      'Speak with Animals'
    );
  }

  return result;
}

function uniqueCanonical(
  values:
    | string[]
    | undefined
): string[] {
  return [
    ...new Set(
      (
        values ||
        []
      )
        .map(
          (value) =>
            resolveCanonicalSpellName(
              value
            )
        )
        .filter(
          Boolean
        )
    )
  ];
}

function validForClass(
  name: string,
  className: string,
  level: number
): boolean {
  const spell =
    findSrdSpell(
      name
    );

  if (!spell) {
    return false;
  }

  const classId =
    PT_TO_SRD_CLASS[
      className
    ];

  return (
    Boolean(
      classId
    ) &&
    spell.classes
      .map(
        (value) =>
          value.toLowerCase()
      )
      .includes(
        classId
      ) &&
    spell.level <=
      level
  );
}

export function validateInitialSpellSelection(
  className: string,
  cantrips: string[],
  prepared: string[],
  spellbook: string[]
): {
  ok: boolean;
  reason?: string;
} {
  const rules =
    getInitialSpellSelectionRules(
      className
    );

  const c =
    uniqueCanonical(
      cantrips
    );

  const p =
    uniqueCanonical(
      prepared
    );

  const b =
    uniqueCanonical(
      spellbook
    );

  if (
    c.length !==
    rules.cantrips
  ) {
    return {
      ok: false,
      reason:
        'Escolha exatamente ' +
        rules.cantrips +
        ' truque(s).'
    };
  }

  if (
    p.length !==
    rules.prepared
  ) {
    return {
      ok: false,
      reason:
        'Escolha exatamente ' +
        rules.prepared +
        ' magia(s) preparada(s) de n?vel 1.'
    };
  }

  if (
    b.length !==
    rules.spellbook
  ) {
    return {
      ok: false,
      reason:
        className ===
          'Mago'
          ? 'O grim?rio inicial do Mago deve conter exatamente 6 magias de n?vel 1.'
          : 'Esta classe n?o usa grim?rio inicial.'
    };
  }

  if (
    !c.every(
      (name) => {
        const spell =
          findSrdSpell(
            name
          );

        return (
          spell?.level ===
            0 &&
          validForClass(
            name,
            className,
            0
          )
        );
      }
    )
  ) {
    return {
      ok: false,
      reason:
        'H? um truque inv?lido para esta classe.'
    };
  }

  if (
    !p.every(
      (name) => {
        const spell =
          findSrdSpell(
            name
          );

        return (
          spell?.level ===
            1 &&
          validForClass(
            name,
            className,
            1
          )
        );
      }
    )
  ) {
    return {
      ok: false,
      reason:
        'H? uma magia de n?vel 1 inv?lida para esta classe.'
    };
  }

  if (
    className ===
      'Mago'
  ) {
    if (
      !b.every(
        (name) => {
          const spell =
            findSrdSpell(
              name
            );

          return (
            spell?.level ===
              1 &&
            validForClass(
              name,
              className,
              1
            )
          );
        }
      )
    ) {
      return {
        ok: false,
        reason:
          'O grim?rio cont?m uma magia inv?lida.'
      };
    }

    const bookSet =
      new Set(b);

    if (
      !p.every(
        (name) =>
          bookSet.has(
            name
          )
      )
    ) {
      return {
        ok: false,
        reason:
          'As 4 magias preparadas do Mago precisam estar entre as 6 do grim?rio.'
      };
    }
  }

  return {
    ok: true
  };
}

export function buildLegacySpellString(
  cantrips: string[],
  prepared: string[],
  className?: string,
  level = 1
): string {
  const all =
    uniqueCanonical([
      ...cantrips,
      ...prepared,
      ...getAlwaysPreparedSpells(
        className ||
        '',
        level
      )
    ]);

  return all
    .map(
      (name) =>
        getSpellDisplayName(
          name
        )
    )
    .join(
      '\n'
    );
}

export function ensureCharacterSpellState(
  character:
    SpellCharacterLike
): void {
  if (
    character.spellSelectionVersion
  ) {
    character.knownCantrips =
      uniqueCanonical(
        character.knownCantrips
      );

    character.preparedSpells =
      uniqueCanonical(
        character.preparedSpells
      );

    character.spellbook =
      uniqueCanonical(
        character.spellbook
      );

    return;
  }

  const legacy =
    String(
      character.spells ||
      ''
    )
      .split(
        /\r?\n|,/
      )
      .map(
        (name) =>
          name.trim()
      )
      .filter(
        Boolean
      );

  const cantrips:
    string[] =
    [];

  const prepared:
    string[] =
    [];

  for (
    const name of
    legacy
  ) {
    const spell =
      findSrdSpell(
        name
      );

    if (!spell) {
      continue;
    }

    if (
      spell.level ===
      0
    ) {
      cantrips.push(
        spell.name
      );
    } else {
      prepared.push(
        spell.name
      );
    }
  }

  character.knownCantrips =
    uniqueCanonical(
      cantrips
    );

  character.preparedSpells =
    uniqueCanonical(
      prepared
    );

  character.spellbook =
    character.className ===
      'Mago'
      ? uniqueCanonical(
          prepared
        )
      : [];

  character.spellSelectionVersion =
    1;
}

export function isCharacterSpellPrepared(
  character:
    SpellCharacterLike,
  spellName: string,
  options?: { asRitual?: boolean }
): boolean {
  ensureCharacterSpellState(
    character
  );

  const canonical =
    resolveCanonicalSpellName(
      spellName
    );

  const cantrips =
    new Set(
      uniqueCanonical(
        character
          .knownCantrips
      )
    );

  const prepared =
    new Set(
      uniqueCanonical(
        character
          .preparedSpells
      )
    );

  const always =
    new Set(
      getAlwaysPreparedSpells(
        character.className,
        character.level
      )
        .map(
          resolveCanonicalSpellName
        )
    );

  if (
    cantrips.has(
      canonical
    ) ||
    prepared.has(
      canonical
    ) ||
    always.has(
      canonical
    )
  ) {
    return true;
  }

  /* SRD 5.2.1 Wizard Ritual Adept: ritual from spellbook without preparing */
  if (
    options?.asRitual ||
    character.className === 'Mago'
  ) {
    const spell = findSrdSpell(canonical);
    if (spell?.ritual) {
      const book = new Set(
        uniqueCanonical(character.spellbook)
      );
      if (book.has(canonical)) {
        return true;
      }
    }
  }

  return false;
}

export function getCharacterSpellActions(
  character:
    SpellCharacterLike
) {
  ensureCharacterSpellState(
    character
  );

  const baseNames = [
    ...(
      character
        .knownCantrips ||
      []
    ),
    ...(
      character
        .preparedSpells ||
      []
    ),
    ...getAlwaysPreparedSpells(
      character.className,
      character.level
    )
  ];

  /* For Mago, ritual spells in the spellbook are also available to cast */
  if (
    character.className === 'Mago' &&
    Array.isArray(character.spellbook)
  ) {
    for (const bookSpell of character.spellbook) {
      const spell = findSrdSpell(bookSpell);
      if (spell?.ritual) {
        baseNames.push(spell.name);
      }
    }
  }

  const names =
    uniqueCanonical(baseNames);

  return names
    .map(
      findSrdSpell
    )
    .filter(
      (
        spell
      ): spell is
        SrdSpellEntry =>
        Boolean(spell)
    )
    .map(
      toHudSpell
    );
}

export function reprepareCharacterSpells(
  character: SpellCharacterLike,
  newPreparedSpells: string[]
): { ok: boolean; reason?: string; prepared?: string[] } {
  ensureCharacterSpellState(character);

  if (!SPELL_PROGRESSIONS[character.className]) {
    return { ok: false, reason: 'Esta classe não prepara magias.' };
  }

  const limit = getPreparedSpellLimit(character.className, character.level);
  const canonicalList = uniqueCanonical(newPreparedSpells);

  if (canonicalList.length > limit) {
    return {
      ok: false,
      reason: `Você pode preparar no máximo ${limit} magias para o nível ${character.level}.`
    };
  }

  const maxSlotLevel = getMaxSpellLevelForClass(character.className, character.level);

  if (character.className === 'Mago') {
    const bookSet = new Set(uniqueCanonical(character.spellbook));
    for (const spellName of canonicalList) {
      if (!bookSet.has(spellName)) {
        return {
          ok: false,
          reason: `A magia ${spellName} não está presente no grimório do Mago.`
        };
      }
      const s = findSrdSpell(spellName);
      if (!s || s.level < 1 || s.level > maxSlotLevel) {
        return {
          ok: false,
          reason: `Nível inválido para a magia ${spellName}.`
        };
      }
    }
  } else {
    for (const spellName of canonicalList) {
      const s = findSrdSpell(spellName);
      if (!s || s.level < 1 || !validForClass(spellName, character.className, maxSlotLevel)) {
        return {
          ok: false,
          reason: `Magia ${spellName} inválida para a classe ${character.className} no nível atual.`
        };
      }
    }
  }

  character.preparedSpells = canonicalList;
  character.spells = buildLegacySpellString(
    character.knownCantrips || [],
    character.preparedSpells || [],
    character.className,
    character.level
  );

  return { ok: true, prepared: character.preparedSpells };
}

export function validateCharacterSpellLoadout(
  character:
    SpellCharacterLike
): void {
  ensureCharacterSpellState(
    character
  );

  if (
    !SPELL_PROGRESSIONS[
      character.className
    ]
  ) {
    character.knownCantrips =
      [];

    character.preparedSpells =
      [];

    character.spellbook =
      [];

    character.spells =
      '';

    return;
  }

  const cantripLimit =
    getCantripLimit(
      character.className,
      character.level
    );

  const preparedLimit =
    getPreparedSpellLimit(
      character.className,
      character.level
    );

  if (
    (
      character
        .knownCantrips ||
      []
    ).length >
    cantripLimit
  ) {
    throw new Error(
      'O personagem possui mais truques que o permitido para seu n?vel.'
    );
  }

  if (
    (
      character
        .preparedSpells ||
      []
    ).length >
    preparedLimit
  ) {
    throw new Error(
      'O personagem possui mais magias preparadas que o permitido.'
    );
  }

  const maxLevel =
    getMaxSpellLevelForClass(
      character.className,
      character.level
    );

  for (
    const name of [
      ...(
        character
          .knownCantrips ||
        []
      ),
      ...(
        character
          .preparedSpells ||
        []
      )
    ]
  ) {
    const spell =
      findSrdSpell(
        name
      );

    if (
      !spell ||
      !validForClass(
        name,
        character.className,
        maxLevel
      )
    ) {
      throw new Error(
        'Magia inv?lida para a classe: ' +
        name
      );
    }
  }

  character.spells =
    buildLegacySpellString(
      character
        .knownCantrips ||
        [],

      character
        .preparedSpells ||
        [],

      character.className,
      character.level
    );
}

export function getLevelUpSpellChoicesValidation(
  character:
    SpellCharacterLike,
  oldLevel: number,
  newLevel: number,
  choices:
    LevelUpSpellChoices
): {
  ok: boolean;
  reason?: string;
} {
  ensureCharacterSpellState(
    character
  );

  const req =
    getLevelUpSpellRequirements(
      character.className,
      oldLevel,
      newLevel
    );

  const cantrips =
    uniqueCanonical(
      choices?.newCantrips
    );

  const prepared =
    uniqueCanonical(
      choices?.newPrepared
    );

  const spellbook =
    uniqueCanonical(
      choices?.newSpellbook
    );

  if (
    cantrips.length !==
    req.cantrips
  ) {
    return {
      ok: false,
      reason:
        'Escolha ' +
        req.cantrips +
        ' novo(s) truque(s).'
    };
  }

  if (
    prepared.length !==
    req.prepared
  ) {
    return {
      ok: false,
      reason:
        'Escolha ' +
        req.prepared +
        ' nova(s) magia(s) preparada(s).'
    };
  }

  if (
    spellbook.length !==
    req.spellbook
  ) {
    return {
      ok: false,
      reason:
        character.className ===
          'Mago'
          ? 'O Mago adiciona exatamente 2 novas magias ao grim?rio ao subir de n?vel.'
          : 'Sele??o de grim?rio inv?lida.'
    };
  }

  const maxLevel =
    getMaxSpellLevelForClass(
      character.className,
      newLevel
    );

  for (
    const name of
    cantrips
  ) {
    const spell =
      findSrdSpell(
        name
      );

    if (
      !spell ||
      spell.level !==
        0 ||
      !validForClass(
        name,
        character.className,
        0
      )
    ) {
      return {
        ok: false,
        reason:
          'Novo truque inv?lido: ' +
          name
      };
    }
  }

  for (
    const name of
    [
      ...prepared,
      ...spellbook
    ]
  ) {
    const spell =
      findSrdSpell(
        name
      );

    if (
      !spell ||
      spell.level < 1 ||
      spell.level >
        maxLevel ||
      !validForClass(
        name,
        character.className,
        maxLevel
      )
    ) {
      return {
        ok: false,
        reason:
          'Nova magia inv?lida: ' +
          name
      };
    }
  }

  if (
    character.className ===
      'Mago'
  ) {
    const finalBook =
      new Set([
        ...uniqueCanonical(
          character.spellbook
        ),
        ...spellbook
      ]);

    if (
      !prepared.every(
        (name) =>
          finalBook.has(
            name
          )
      )
    ) {
      return {
        ok: false,
        reason:
          'O Mago s? pode preparar uma nova magia que esteja no grim?rio.'
      };
    }
  }

  return {
    ok: true
  };
}

export function applyLevelUpSpellChoices(
  character:
    SpellCharacterLike,
  oldLevel: number,
  newLevel: number,
  choices:
    | LevelUpSpellChoices
    | undefined
): void {
  ensureCharacterSpellState(
    character
  );

  const requirements =
    getLevelUpSpellRequirements(
      character.className,
      oldLevel,
      newLevel
    );

  const needsChoice =
    requirements.cantrips >
      0 ||
    requirements.prepared >
      0 ||
    requirements.spellbook >
      0;

  const safeChoices =
    choices || {
      newCantrips: [],
      newPrepared: [],
      newSpellbook: []
    };

  if (
    needsChoice
  ) {
    const validation =
      getLevelUpSpellChoicesValidation(
        character,
        oldLevel,
        newLevel,
        safeChoices
      );

    if (
      !validation.ok
    ) {
      throw new Error(
        validation.reason ||
        'Sele??o de novas magias inv?lida.'
      );
    }
  }

  character.knownCantrips =
    uniqueCanonical([
      ...(
        character
          .knownCantrips ||
        []
      ),
      ...(
        safeChoices
          .newCantrips ||
        []
      )
    ]);

  character.spellbook =
    uniqueCanonical([
      ...(
        character
          .spellbook ||
        []
      ),
      ...(
        safeChoices
          .newSpellbook ||
        []
      )
    ]);

  character.preparedSpells =
    uniqueCanonical([
      ...(
        character
          .preparedSpells ||
        []
      ),
      ...(
        safeChoices
          .newPrepared ||
        []
      )
    ]);

  character.level =
    newLevel;

  character.spellSelectionVersion =
    1;

  validateCharacterSpellLoadout(
    character
  );
}
