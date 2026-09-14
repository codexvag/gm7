import {
  entry,
  locations,
  type BiomeType,
  type Character,
  type Enemy,
  type State
} from './game-engine';

import {
  buildCampaignEncounterForHero,
  getTravelPermission
} from './mmo-progression';

import {
  clampGridPoint,
  normalizeEnemyMapPosition
} from './map-bounds';

import {
  enemyBelongsToScope,
  ensureWorldSpine,
  getCanonicalActForLocation,
  getHeroScopeKey,
  getScopeMembers,
  projectLegacyWorldView
} from './world-spine';

const SPAWN_BY_BIOME:
  Record<
    BiomeType,
    {
      x: number;
      y: number;
    }
  > = {
    village: {
      x: 4,
      y: 5
    },
    forest: {
      x: 3,
      y: 3
    },
    ruins: {
      x: 3,
      y: 6
    },
    dungeon: {
      x: 4,
      y: 6
    },
    canyon: {
      x: 3,
      y: 6
    },
    lair: {
      x: 3,
      y: 6
    }
  };

export function travelPartyToLocation(
  state: State,
  hero: Character,
  destination: number,
  options?: {
    isMmo?: boolean;
  }
): {
  success: boolean;
  reason: string;
  spawned: Enemy[];
} {
  ensureWorldSpine(
    state
  );

  if (
    !Number.isInteger(
      destination
    ) ||
    !locations[destination]
  ) {
    return {
      success: false,
      reason:
        'Destino inválido.',
      spawned: []
    };
  }

  const permission =
    getTravelPermission(
      state,
      hero,
      destination
    );

  if (
    !permission.allowed
  ) {
    return {
      success: false,
      reason:
        permission.reason ||
        'Esta região ainda não foi desbloqueada.',
      spawned: []
    };
  }

  const members =
    getScopeMembers(
      state,
      hero
    );

  const combatants =
    new Set(
      state.order || []
    );

  if (
    state.combat &&
    members.some(
      (member) =>
        combatants.has(
          member.id
        )
    )
  ) {
    return {
      success: false,
      reason:
        'Encerre o combate do grupo antes de viajar.',
      spawned: []
    };
  }

  const target =
    locations[
      destination
    ];

  const biome =
    target.biome;

  const oldEnemyIds =
    new Set(
      (state.enemies || [])
        .filter(
          (enemy) =>
            enemyBelongsToScope(
              enemy,
              hero
            )
        )
        .map(
          (enemy) =>
            enemy.id
        )
    );

  state.enemies =
    (state.enemies || [])
      .filter(
        (enemy) =>
          !oldEnemyIds.has(
            enemy.id
          )
      );

  const spawn =
    SPAWN_BY_BIOME[
      biome
    ];

  const now =
    Date.now();

  for (
    let index = 0;
    index < members.length;
    index++
  ) {
    const member =
      members[index];

    const point =
      clampGridPoint(
        biome,
        spawn.x +
          (
            index % 2
          ),
        spawn.y +
          Math.floor(
            index / 2
          )
      );

    member.location =
      destination;

    member.biome =
      biome;

    member.act =
      getCanonicalActForLocation(
        destination
      );

    member.x =
      point.x;

    member.y =
      point.y;

    member.questProgress =
      member.questProgress ||
      {};

    if (
      destination > 0
    ) {
      member.questProgress[
        biome +
          '_entered'
      ] = true;
    }

    member.updatedAt =
      now;
  }

  const scopeKey =
    getHeroScopeKey(
      hero
    );

  const removalIds =
    new Set([
      ...members.map(
        (member) =>
          member.id
      ),
      ...oldEnemyIds
    ]);

  state.order =
    (state.order || [])
      .filter(
        (id) =>
          !removalIds.has(id)
      );

  if (
    state.combatPartyId ===
      (
        hero.partyId ||
        hero.id
      )
  ) {
    state.combat =
      false;

    state.combatPartyId =
      undefined;

    state.turn =
      0;

    state.round =
      0;
  }

  state.actionUsed =
    false;

  state.bonusActionUsed =
    false;

  state.movementUsed =
    0;

  state.movementBonusSquares =
    0;

  state.spellSlotUsedThisTurn =
    false;

  const spawned =
    destination === 0
      ? []
      : buildCampaignEncounterForHero(
          state,
          hero,
          destination
        ).map(
          (enemy) =>
            normalizeEnemyMapPosition(
              {
                ...enemy,
                biome
              },
              biome
            )
        );

  if (
    spawned.length > 0
  ) {
    state.enemies.push(
      ...spawned
    );
  }

  projectLegacyWorldView(
    state,
    hero,
    Boolean(
      options?.isMmo
    )
  );

  state.logs.push(
    entry(
      (
        members.length > 1
          ? 'O grupo de ' +
            hero.name
          : hero.name
      ) +
        ' viajou para ' +
        target.name +
        '. ' +
        target.text,
      'gm'
    )
  );

  if (
    spawned.length > 0
  ) {
    state.logs.push(
      entry(
        '⚠️ Encontro canônico ativado para ' +
          scopeKey +
          '. A região só será concluída por vitória real.',
        'gm'
      )
    );
  }

  return {
    success: true,
    reason:
      'Viagem concluída.',
    spawned
  };
}
