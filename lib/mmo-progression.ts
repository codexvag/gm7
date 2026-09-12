import {
  ITEMS_CATALOG,
  locations,
  entry,
  type State,
  type Character,
  type Enemy,
  type BiomeType
} from './game-engine';

import {
  MICRO_ADVENTURES
} from './micro-adventures';

import {
  addInventoryItem
} from './inventory-utils';

function membersOf(
  state: State,
  hero: Character
): Character[] {
  if (!hero.partyId) {
    return [hero];
  }

  const members =
    state.characters.filter(
      (candidate) =>
        candidate.partyId ===
        hero.partyId
    );

  return members.length
    ? members
    : [hero];
}

function belongsTo(
  enemy: Enemy,
  hero: Character
): boolean {
  if (hero.partyId) {
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

function heroFlags(
  hero: Character
): Record<string, boolean> {
  return hero.worldFlags || {};
}

function progress(
  state: State,
  hero: Character,
  quests: Record<string, boolean> = {},
  flags: Record<string, boolean> = {}
): void {
  const now = Date.now();

  for (
    const member of membersOf(
      state,
      hero
    )
  ) {
    if (!member.questProgress) {
      member.questProgress = {};
    }

    if (!member.worldFlags) {
      member.worldFlags = {};
    }

    Object.assign(
      member.questProgress,
      quests
    );

    Object.assign(
      member.worldFlags,
      flags
    );

    member.updatedAt = now;
  }

  // Aggregate world state is retained for GM/world context.
  if (!state.questProgress) {
    state.questProgress = {};
  }

  if (!state.worldFlags) {
    state.worldFlags = {};
  }

  Object.assign(
    state.questProgress,
    quests
  );

  Object.assign(
    state.worldFlags,
    flags
  );
}

export function reconcileLegacyProgression(
  state: State,
  hero: Character
): boolean {
  const before =
    JSON.stringify({
      q: hero.questProgress || {},
      f: hero.worldFlags || {}
    });

  const location =
    hero.location ??
    0;

  const history =
    (state.logs || [])
      .slice(-200)
      .map((item) =>
        item.text.toLowerCase()
      )
      .join('\n');

  // Old saves could freely walk through maps.
  // Reconstruct the minimum coherent progression.
  if (location >= 1) {
    progress(
      state,
      hero,
      {
        doran_talked: true,
        elenor_talked: true,
        kaelen_talked: true
      },
      {
        expedition_unlocked: true
      }
    );
  }

  if (location >= 2) {
    progress(
      state,
      hero,
      {
        forest_cleared: true
      },
      {
        bridge_cleared: true,
        trade_route_open: true,
        ruins_unlocked: true,
        dragon_rumor_stage1: true
      }
    );
  }

  if (location >= 3) {
    progress(
      state,
      hero,
      {
        ruins_cleared: true,
        dungeon_entered: true
      },
      {
        abbey_cleared: true,
        catacombs_unsealed: true,
        dungeon_unlocked: true,
        dragon_rumor_stage3: true
      }
    );
  }

  const scopedEnemies =
    (state.enemies || []).filter(
      (enemy) =>
        belongsTo(enemy, hero) ||
        (
          !enemy.partyId &&
          !enemy.ownerCharId
        )
    );

  const deadMalakor =
    scopedEnemies.some(
      (enemy) =>
        enemy.hp <= 0 &&
        enemy.name
          .toLowerCase()
          .includes('malakor')
    ) ||
    (
      history.includes('malakor') &&
      (
        history.includes('derrotado') ||
        history.includes('tombou') ||
        history.includes('vitória')
      )
    );

  if (
    deadMalakor ||
    location >= 4
  ) {
    progress(
      state,
      hero,
      {
        dungeon_cleared: true,
        malakor_defeated: true
      },
      {
        malakor_defeated: true,
        canyon_unlocked: true
      }
    );
  }

  if (location >= 5) {
    progress(
      state,
      hero,
      {
        canyon_cleared: true
      },
      {
        canyon_secured: true,
        dragon_lair_unlocked: true,
        dragon_presence_imminent: true
      }
    );
  }

  const deadIgnisrax =
    scopedEnemies.some(
      (enemy) =>
        enemy.hp <= 0 &&
        enemy.name
          .toLowerCase()
          .includes('ignisrax')
    ) ||
    (
      history.includes('ignisrax') &&
      (
        history.includes('derrotado') ||
        history.includes('tombou') ||
        history.includes('vitória contra o chefe')
      )
    );

  if (deadIgnisrax) {
    progress(
      state,
      hero,
      {
        ignisrax_defeated: true,
        campaign_completed: true
      },
      {
        ignisrax_defeated: true,
        campaign_completed: true,
        valdoria_saved: true,
        endgame_unlocked: true
      }
    );
  }

  const after =
    JSON.stringify({
      q: hero.questProgress || {},
      f: hero.worldFlags || {}
    });

  return before !== after;
}

export function getTravelPermission(
  state: State,
  hero: Character,
  destination: number
): {
  allowed: boolean;
  reason?: string;
} {
  if (
    !Number.isInteger(destination) ||
    destination < 0 ||
    destination >= locations.length
  ) {
    return {
      allowed: false,
      reason: 'Destino inválido.'
    };
  }

  const current =
    hero.location ??
    0;

  if (destination === 0) {
    return { allowed: true };
  }

  // Returning to regions already reached is always allowed.
  if (destination <= current) {
    return { allowed: true };
  }

  const qp =
    hero.questProgress || {};

  const flags =
    heroFlags(hero);

  if (
    destination === 1 &&
    !qp.kaelen_talked
  ) {
    return {
      allowed: false,
      reason:
        'Os portões ainda estão fechados. Fale primeiro com Doran, Elenor e o Capitão Kaelen.'
    };
  }

  if (
    destination === 2 &&
    !qp.forest_cleared &&
    !flags.ruins_unlocked
  ) {
    return {
      allowed: false,
      reason:
        'As Ruínas ainda estão bloqueadas. Elimine a ameaça da Floresta dos Sussurros.'
    };
  }

  if (
    destination === 3 &&
    !qp.ruins_cleared &&
    !flags.catacombs_unsealed
  ) {
    return {
      allowed: false,
      reason:
        'A entrada das Catacumbas continua selada. Expurgue primeiro as Ruínas da Abadia.'
    };
  }

  if (
    destination === 4 &&
    !qp.malakor_defeated
  ) {
    return {
      allowed: false,
      reason:
        'O Desfiladeiro permanece bloqueado enquanto Malakor controlar as Catacumbas.'
    };
  }

  if (
    destination === 5 &&
    !qp.canyon_cleared &&
    !flags.dragon_lair_unlocked
  ) {
    return {
      allowed: false,
      reason:
        'O Covil ainda não pode ser alcançado. Destrua a vanguarda dracônica no Desfiladeiro.'
    };
  }

  return { allowed: true };
}

type Template = {
  name: string;
  hp: number;
  ac: number;
  attack: number;
  damage: string;
  weapon: string;
  x: number;
  y: number;
};

function templatesFor(
  biome: BiomeType,
  hero: Character
): Template[] {
  const qp =
    hero.questProgress || {};

  if (biome === 'forest') {
    if (!qp.forest_cleared) {
      return [
        {
          name: 'Sentinela de Cinzas',
          hp: 15,
          ac: 13,
          attack: 4,
          damage: '1d8+2',
          weapon: 'Lâmina de Cinzas',
          x: 8,
          y: 4
        },
        {
          name: 'Lobo das Sombras',
          hp: 11,
          ac: 12,
          attack: 4,
          damage: '1d6+2',
          weapon: 'Mordida Sombria',
          x: 7,
          y: 6
        }
      ];
    }

    return [
      {
        name: 'Lobo Alfa das Cinzas',
        hp: 20,
        ac: 13,
        attack: 5,
        damage: '2d4+3',
        weapon: 'Mordida Dilacerante',
        x: 8,
        y: 4
      },
      {
        name: 'Batedor Sombrio',
        hp: 14,
        ac: 13,
        attack: 5,
        damage: '1d8+2',
        weapon: 'Arco Sombrio',
        x: 11,
        y: 3
      }
    ];
  }

  if (biome === 'ruins') {
    if (!qp.ruins_cleared) {
      return [
        {
          name: 'Fanático do Fogo Negro',
          hp: 24,
          ac: 13,
          attack: 5,
          damage: '1d8+3',
          weapon: 'Cajado do Fogo Negro',
          x: 8,
          y: 5
        },
        {
          name: 'Arqueiro do Culto',
          hp: 15,
          ac: 13,
          attack: 5,
          damage: '1d8+2',
          weapon: 'Arco do Culto',
          x: 11,
          y: 3
        },
        {
          name: 'Cultista Brutamontes',
          hp: 20,
          ac: 14,
          attack: 4,
          damage: '1d10+2',
          weapon: 'Maça Pesada',
          x: 7,
          y: 6
        }
      ];
    }

    return [
      {
        name: 'Acólito do Fogo Negro',
        hp: 19,
        ac: 13,
        attack: 5,
        damage: '1d8+2',
        weapon: 'Chama Ritual',
        x: 9,
        y: 4
      },
      {
        name: 'Arqueiro do Culto',
        hp: 15,
        ac: 13,
        attack: 5,
        damage: '1d8+2',
        weapon: 'Arco do Culto',
        x: 11,
        y: 3
      }
    ];
  }

  if (biome === 'dungeon') {
    if (!qp.malakor_defeated) {
      return [
        {
          name: 'Malakor, o Lorde das Cinzas',
          hp: 46,
          ac: 15,
          attack: 6,
          damage: '2d6+3',
          weapon: 'Cetro do Vazio',
          x: 9,
          y: 3
        },
        {
          name: 'Guardião Espectral',
          hp: 24,
          ac: 15,
          attack: 5,
          damage: '1d8+3',
          weapon: 'Escudo Espectral',
          x: 7,
          y: 5
        },
        {
          name: 'Escriba Sombrio',
          hp: 17,
          ac: 12,
          attack: 5,
          damage: '1d8+2',
          weapon: 'Rajada Rúnica',
          x: 11,
          y: 5
        }
      ];
    }

    return [
      {
        name: 'Eco do Vazio',
        hp: 28,
        ac: 14,
        attack: 6,
        damage: '2d6+2',
        weapon: 'Toque do Vazio',
        x: 9,
        y: 4
      },
      {
        name: 'Guardião Espectral',
        hp: 24,
        ac: 15,
        attack: 5,
        damage: '1d8+3',
        weapon: 'Escudo Espectral',
        x: 7,
        y: 5
      }
    ];
  }

  if (biome === 'canyon') {
    if (!qp.canyon_cleared) {
      return [
        {
          name: 'Wyrmling Vermelho da Fenda',
          hp: 38,
          ac: 15,
          attack: 6,
          damage: '2d6+3',
          weapon: 'Mordida Dracônica',
          x: 9,
          y: 4
        },
        {
          name: 'Guerreiro Draconiano',
          hp: 25,
          ac: 15,
          attack: 5,
          damage: '1d8+3',
          weapon: 'Lança de Basalto',
          x: 7,
          y: 6
        }
      ];
    }

    return [
      {
        name: 'Draconiano da Fenda',
        hp: 28,
        ac: 15,
        attack: 6,
        damage: '1d10+3',
        weapon: 'Lança Vulcânica',
        x: 8,
        y: 5
      },
      {
        name: 'Wyrmling Errante',
        hp: 32,
        ac: 14,
        attack: 6,
        damage: '2d6+2',
        weapon: 'Mordida Dracônica',
        x: 10,
        y: 3
      }
    ];
  }

  if (biome === 'lair') {
    if (!qp.ignisrax_defeated) {
      return [
        {
          name: 'Ignisrax, o Dragão Vermelho',
          hp: 85,
          ac: 17,
          attack: 8,
          damage: '2d10+6',
          weapon: 'Mordida Ígnea',
          x: 9,
          y: 4
        },
        {
          name: 'Sentinela de Obsidiana',
          hp: 28,
          ac: 16,
          attack: 6,
          damage: '1d10+3',
          weapon: 'Lâmina de Obsidiana',
          x: 7,
          y: 6
        }
      ];
    }

    return [
      {
        name: 'Elemental de Magma',
        hp: 38,
        ac: 15,
        attack: 7,
        damage: '2d8+3',
        weapon: 'Punho de Magma',
        x: 9,
        y: 4
      },
      {
        name: 'Sentinela de Obsidiana',
        hp: 28,
        ac: 16,
        attack: 6,
        damage: '1d10+3',
        weapon: 'Lâmina de Obsidiana',
        x: 7,
        y: 6
      }
    ];
  }

  return [];
}

export function buildCampaignEncounterForHero(
  state: State,
  hero: Character,
  locationIndex?: number
): Enemy[] {
  const index =
    locationIndex ??
    hero.location ??
    1;

  const biome =
    locations[index]?.biome ||
    hero.biome ||
    'forest';

  if (biome === 'village') {
    return [];
  }

  const templates =
    templatesFor(
      biome,
      hero
    );

  return templates.map(
    (template) => ({
      id: crypto.randomUUID(),
      name: template.name,
      hp: template.hp,
      maxHp: template.hp,
      ac: template.ac,
      attack: template.attack,
      damage: template.damage,
      weapon: template.weapon,
      initiative: 0,
      x: template.x,
      y: template.y,
      conditions: [],
      biome,
      partyId: hero.partyId,
      ownerCharId:
        hero.partyId
          ? undefined
          : hero.id,
      updatedAt: Date.now()
    })
  );
}

export function startAdventureForHero(
  state: State,
  hero: Character,
  adventureId: string
): {
  success: boolean;
  log: string;
} {
  const adv =
    MICRO_ADVENTURES[
      adventureId
    ];

  if (!adv) {
    return {
      success: false,
      log: 'Microaventura não encontrada.'
    };
  }

  if (
    state.combat &&
    (
      (state.order || []).includes(
        hero.id
      ) ||
      state.combatPartyId ===
        (
          hero.partyId ||
          hero.id
        )
    )
  ) {
    return {
      success: false,
      log:
        'Termine o combate atual antes de aceitar outro contrato.'
    };
  }

  if (
    hero.activeMicroAdventureId
  ) {
    return {
      success: false,
      log:
        hero.activeMicroAdventureId ===
        adventureId
          ? 'Este contrato já está em andamento.'
          : 'Conclua ou abandone o contrato atual antes de aceitar outro.'
    };
  }

  const flags =
    heroFlags(hero);

  if (
    adventureId ===
      'bridge-sentinel' &&
    !hero.questProgress
      ?.kaelen_talked
  ) {
    return {
      success: false,
      log:
        'Complete o prólogo da Vila e obtenha autorização de Kaelen antes deste contrato.'
    };
  }

  if (
    adv.requiredFlags &&
    !adv.requiredFlags.every(
      (flag) =>
        Boolean(flags[flag])
    )
  ) {
    return {
      success: false,
      log:
        'Este contrato ainda não foi desbloqueado pelo progresso deste personagem ou grupo.'
    };
  }

  const cooldown =
    hero.adventureCooldowns
      ?.[adventureId] ||
    0;

  if (
    cooldown >
    Date.now()
  ) {
    return {
      success: false,
      log:
        'Este contrato ainda está em recarga. Tente novamente em aproximadamente ' +
        Math.ceil(
          (
            cooldown -
            Date.now()
          ) /
          60000
        ) +
        ' min.'
    };
  }

  // Bridge contract is physically played at the east forest/bridge.
  const locationIndex =
    adventureId ===
      'bridge-sentinel'
      ? 1
      : adv.locationIndex;

  const biome =
    locations[
      locationIndex
    ]?.biome ||
    'forest';

  const members =
    membersOf(
      state,
      hero
    );

  // Remove the old encounter belonging only to this party/hero.
  state.enemies =
    (state.enemies || []).filter(
      (enemy) =>
        !belongsTo(
          enemy,
          hero
        )
    );

  for (
    let i = 0;
    i < members.length;
    i++
  ) {
    const member =
      members[i];

    member.location =
      locationIndex;

    member.biome =
      biome;

    member.act =
      (
        locationIndex >= 4
          ? 3
          : locationIndex >= 2
            ? 2
            : 1
      );

    member.x =
      3 + (i % 2);

    member.y =
      5 +
      Math.floor(i / 2);

    member.activeMicroAdventureId =
      adventureId;

    member.activeMicroAdventureStage =
      1;

    member.updatedAt =
      Date.now();
  }

  const combatStage =
    adv.stages.find(
      (stage) =>
        Boolean(
          stage.spawnEnemies
            ?.length
        )
    );

  const enemies: Enemy[] =
    (
      combatStage
        ?.spawnEnemies ||
      []
    ).map(
      (template) => ({
        id:
          crypto.randomUUID(),
        name:
          template.name,
        hp:
          template.hp,
        maxHp:
          template.maxHp,
        ac:
          template.ac,
        attack:
          template.attack,
        damage:
          template.damage,
        weapon:
          template.weapon,
        initiative:
          0,
        x:
          template.x,
        y:
          template.y,
        conditions:
          [],
        biome,
        partyId:
          hero.partyId,
        ownerCharId:
          hero.partyId
            ? undefined
            : hero.id,
        adventureId,
        updatedAt:
          Date.now()
      })
    );

  state.enemies.push(
    ...enemies
  );

  progress(
    state,
    hero,
    {
      [
        'adv-' +
        adventureId +
        '-started'
      ]: true
    }
  );

  const opening =
    adv.stages[0];

  const combatText =
    combatStage
      ? '\n\n' +
        combatStage.dialogueNarrative +
        '\n🎯 ' +
        combatStage.objective
      : '';

  const text =
    '🗺️ [Contrato iniciado: ' +
    adv.title +
    ']\n' +
    opening.dialogueNarrative +
    '\n🎯 ' +
    opening.objective +
    combatText;

  state.logs.push(
    entry(text, 'gm')
  );

  return {
    success: true,
    log: text
  };
}

function awardAdventure(
  state: State,
  hero: Character
): string | null {
  const adventureId =
    hero.activeMicroAdventureId;

  if (!adventureId) {
    return null;
  }

  const adv =
    MICRO_ADVENTURES[
      adventureId
    ];

  if (!adv) {
    hero.activeMicroAdventureId =
      undefined;

    hero.activeMicroAdventureStage =
      undefined;

    return null;
  }

  const remaining =
    (state.enemies || []).filter(
      (enemy) =>
        enemy.hp > 0 &&
        enemy.adventureId ===
          adventureId &&
        belongsTo(
          enemy,
          hero
        )
    );

  if (remaining.length > 0) {
    return null;
  }

  const members =
    membersOf(
      state,
      hero
    );

  const previous =
    hero.adventureCompletions
      ?.[adventureId] ||
    0;

  const first =
    previous === 0;

  const xp =
    first
      ? adv.rewards.xp
      : Math.max(
          25,
          Math.round(
            adv.rewards.xp *
            0.4
          )
        );

  const gold =
    first
      ? adv.rewards.gold
      : Math.max(
          5,
          Math.round(
            adv.rewards.gold *
            0.4
          )
        );

  for (
    const member of members
  ) {
    member.xp =
      (member.xp || 0) +
      xp;

    member.gold =
      (member.gold || 0) +
      gold;

    if (
      first &&
      adv.rewards.items
    ) {
      for (
        const itemId of
        adv.rewards.items
      ) {
        const item =
          ITEMS_CATALOG[
            itemId
          ];

        if (!item) {
          continue;
        }

        member.inventory =
          addInventoryItem(
            member.inventory ||
            '',
            item.name,
            1
          );
      }
    }

    if (
      first &&
      adv.rewards
        .titleReward &&
      !member.features.includes(
        adv.rewards
          .titleReward
      )
    ) {
      member.features =
        (
          member.features
            ? member.features +
              '\n'
            : ''
        ) +
        'Título conquistado: ' +
        adv.rewards
          .titleReward;
    }

    if (
      !member
        .adventureCompletions
    ) {
      member.adventureCompletions =
        {};
    }

    member
      .adventureCompletions[
        adventureId
      ] =
      (
        member
          .adventureCompletions[
            adventureId
          ] ||
        0
      ) + 1;

    if (
      !member
        .adventureCooldowns
    ) {
      member.adventureCooldowns =
        {};
    }

    member
      .adventureCooldowns[
        adventureId
      ] =
      Date.now() +
      5 * 60 * 1000;

    member.activeMicroAdventureId =
      undefined;

    member.activeMicroAdventureStage =
      undefined;

    member.updatedAt =
      Date.now();
  }

  progress(
    state,
    hero,
    {
      [
        'adv-' +
        adventureId +
        '-completed'
      ]: true
    },
    {
      ...(first
        ? adv.worldConsequences
        : {}),
      [
        'completed_' +
        adventureId
      ]: true
    }
  );

  if (
    state.activeMicroAdventureId ===
    adventureId
  ) {
    state.activeMicroAdventureId =
      undefined;
  }

  const text =
    '🏆 [Contrato concluído: ' +
    adv.title +
    ']' +
    (
      first
        ? ''
        : ' [Repetição]'
    ) +
    '\n' +
    adv.dialogueVictory +
    '\n💎 +' +
    xp +
    ' XP • +' +
    gold +
    ' PO' +
    (
      first &&
      adv.rewards
        .titleReward
        ? '\n🏅 Título: ' +
          adv.rewards
            .titleReward
        : ''
    );

  state.logs.push(
    entry(text, 'gm')
  );

  return text;
}

function firstClearReward(
  state: State,
  hero: Character,
  key: string,
  questUpdates: Record<string, boolean>,
  flagUpdates: Record<string, boolean>,
  xp: number,
  gold: number,
  itemId?: string
): string | null {
  const already =
    Boolean(
      hero.questProgress
        ?.[key]
    );

  progress(
    state,
    hero,
    questUpdates,
    flagUpdates
  );

  if (already) {
    return null;
  }

  for (
    const member of membersOf(
      state,
      hero
    )
  ) {
    member.xp =
      (member.xp || 0) +
      xp;

    member.gold =
      (member.gold || 0) +
      gold;

    if (
      itemId &&
      ITEMS_CATALOG[
        itemId
      ]
    ) {
      member.inventory =
        addInventoryItem(
          member.inventory ||
          '',
          ITEMS_CATALOG[
            itemId
          ].name,
          1
        );
    }

    member.updatedAt =
      Date.now();
  }

  return (
    '🎖️ Recompensa de progresso: +' +
    xp +
    ' XP • +' +
    gold +
    ' PO' +
    (
      itemId &&
      ITEMS_CATALOG[itemId]
        ? ' • ' +
          ITEMS_CATALOG[
            itemId
          ].name
        : ''
    )
  );
}

export function resolveEnemyDefeatProgression(
  state: State,
  hero: Character,
  defeated: Enemy
): void {
  if (defeated.hp > 0) {
    return;
  }

  awardAdventure(
    state,
    hero
  );

  const biome =
    (
      defeated.biome ||
      hero.biome ||
      'forest'
    ) as BiomeType;

  const remaining =
    (state.enemies || []).filter(
      (enemy) =>
        enemy.hp > 0 &&
        enemy.biome ===
          biome &&
        belongsTo(
          enemy,
          hero
        )
    );

  if (
    remaining.length > 0
  ) {
    return;
  }

  const scoped =
    (state.enemies || []).filter(
      (enemy) =>
        enemy.biome ===
          biome &&
        belongsTo(
          enemy,
          hero
        )
    );

  const party =
    membersOf(
      state,
      hero
    );

  const ids =
    new Set([
      ...party.map(
        (member) =>
          member.id
      ),
      ...scoped.map(
        (enemy) =>
          enemy.id
      )
    ]);

  if (
    !state.combatPartyId ||
    state.combatPartyId ===
      (
        hero.partyId ||
        hero.id
      )
  ) {
    state.order =
      (state.order || [])
        .filter(
          (id) =>
            !ids.has(id)
        );

    state.combat = false;
    state.combatPartyId =
      undefined;
    state.turn = 0;
    state.round = 0;
    state.actionUsed = false;
    state.bonusActionUsed =
      false;
    state.movementUsed = 0;
  }

  let reward:
    | string
    | null =
    null;

  if (biome === 'forest') {
    reward =
      firstClearReward(
        state,
        hero,
        'forest_cleared',
        {
          forest_cleared: true
        },
        {
          bridge_cleared: true,
          trade_route_open: true,
          ruins_unlocked: true,
          dragon_rumor_stage1: true
        },
        75,
        25,
        'pocao-cura'
      );

    state.logs.push(
      entry(
        '🌲 A rota da Floresta dos Sussurros foi assegurada. As Ruínas da Abadia agora podem ser alcançadas.',
        'gm'
      )
    );
  }

  if (biome === 'ruins') {
    reward =
      firstClearReward(
        state,
        hero,
        'ruins_cleared',
        {
          ruins_cleared: true
        },
        {
          abbey_cleared: true,
          catacombs_unsealed: true,
          dungeon_unlocked: true,
          dragon_rumor_stage3: true
        },
        125,
        40,
        'chave-abadia'
      );

    state.logs.push(
      entry(
        '🏚️ O culto foi expulso das Ruínas. A Chave da Abadia revela a entrada das Catacumbas dos Três Selos.',
        'gm'
      )
    );
  }

  if (biome === 'dungeon') {
    const malakorDead =
      defeated.name
        .toLowerCase()
        .includes('malakor') ||
      scoped.some(
        (enemy) =>
          enemy.hp <= 0 &&
          enemy.name
            .toLowerCase()
            .includes('malakor')
      );

    if (malakorDead) {
      reward =
        firstClearReward(
          state,
          hero,
          'malakor_defeated',
          {
            dungeon_cleared: true,
            malakor_defeated: true
          },
          {
            malakor_defeated: true,
            canyon_unlocked: true
          },
          250,
          75,
          'medalhao-obsidiana'
        );

      state.logs.push(
        entry(
          '☠️ Malakor foi derrotado. O domínio do Vazio enfraquece e o Desfiladeiro da Fenda Escarpada foi desbloqueado.',
          'gm'
        )
      );
    }
  }

  if (biome === 'canyon') {
    reward =
      firstClearReward(
        state,
        hero,
        'canyon_cleared',
        {
          canyon_cleared: true
        },
        {
          canyon_secured: true,
          dragon_lair_unlocked: true,
          dragon_presence_imminent: true
        },
        300,
        100,
        'escama-dragao-rubro'
      );

    state.logs.push(
      entry(
        '🌋 A vanguarda dracônica foi destruída. A passagem até a Cratera Magmática e o Covil de Ignisrax está aberta.',
        'gm'
      )
    );
  }

  if (biome === 'lair') {
    const ignisraxDead =
      defeated.name
        .toLowerCase()
        .includes('ignisrax') ||
      scoped.some(
        (enemy) =>
          enemy.hp <= 0 &&
          enemy.name
            .toLowerCase()
            .includes('ignisrax')
      );

    if (ignisraxDead) {
      reward =
        firstClearReward(
          state,
          hero,
          'ignisrax_defeated',
          {
            ignisrax_defeated: true,
            campaign_completed: true
          },
          {
            ignisrax_defeated: true,
            campaign_completed: true,
            valdoria_saved: true,
            endgame_unlocked: true
          },
          500,
          250,
          'escama-dragao-rubro'
        );

      state.logs.push(
        entry(
          '🐉 Ignisrax tombou. A campanha principal foi concluída. Valdoria agora entra no modo de Mundo Persistente: contratos repetíveis, eventos emergentes, economia, ecossistema e ameaças regionais continuam ativos.',
          'gm'
        )
      );
    }
  }

  if (reward) {
    state.logs.push(
      entry(
        reward,
        'gm'
      )
    );
  }

  state.logs.push(
    entry(
      '⚔️ Encontro concluído. Saqueie os inimigos, organize seus equipamentos e escolha entre retornar à Vila, seguir para a próxima região ou aceitar um novo contrato.',
      'gm'
    )
  );
}