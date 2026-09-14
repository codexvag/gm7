import {
  ITEMS_CATALOG,
  entry,
  type Character,
  type ItemDefinition,
  type State,
  type WorldActivityState
} from './game-engine';

import {
  addInventoryItem
} from './inventory-utils';

import {
  ensureWorldSpine,
  getHeroScopeKey,
  getScopeMembers
} from './world-spine';

function cloneJson<T>(
  value: T
): T {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function activityId(
  type: WorldActivityState['type'],
  hero: Character
): string {
  return (
    type +
    ':' +
    getHeroScopeKey(hero)
  );
}

function markActiveForScope(
  state: State,
  hero: Character,
  id?: string
): void {
  const now =
    Date.now();

  for (
    const member of
    getScopeMembers(
      state,
      hero
    )
  ) {
    member.activeActivityId =
      id;

    member.updatedAt =
      now;
  }
}

export function getHeroActivity(
  state: State,
  hero: Character,
  type?: WorldActivityState['type']
): WorldActivityState | undefined {
  ensureWorldSpine(state);

  const preferred =
    hero.activeActivityId
      ? state.activities?.[
          hero.activeActivityId
        ]
      : undefined;

  if (
    preferred &&
    (!type ||
      preferred.type === type)
  ) {
    return preferred;
  }

  const scopeKey =
    getHeroScopeKey(hero);

  return Object.values(
    state.activities || {}
  ).find(
    (activity) =>
      activity.scopeKey ===
        scopeKey &&
      (!type ||
        activity.type === type) &&
      activity.status !==
        'completed' &&
      activity.status !==
        'abandoned'
  );
}

export function upsertActivity(
  state: State,
  next: WorldActivityState
): WorldActivityState {
  ensureWorldSpine(state);

  const previous =
    state.activities?.[next.id];

  const merged:
    WorldActivityState = {
      ...previous,
      ...next,
      createdAt:
        previous?.createdAt ||
        next.createdAt ||
        Date.now(),
      updatedAt:
        next.updatedAt ||
        Date.now()
    };

  state.activities![
    merged.id
  ] = merged;

  return merged;
}

export function syncMicroAdventureActivity(
  state: State,
  hero: Character,
  adventureId: string
): WorldActivityState {
  const existing =
    getHeroActivity(
      state,
      hero
    );

  if (
    existing &&
    existing.type !==
      'microadventure' &&
    existing.status ===
      'active'
  ) {
    throw new Error(
      'Conclua a atividade atual antes de iniciar outro contrato.'
    );
  }

  const id =
    activityId(
      'microadventure',
      hero
    );

  const result =
    upsertActivity(
      state,
      {
        id,
        type:
          'microadventure',
        scopeKey:
          getHeroScopeKey(
            hero
          ),
        status:
          'active',
        title:
          adventureId,
        payload: {
          adventureId
        },
        createdAt:
          Date.now(),
        updatedAt:
          Date.now()
      }
    );

  markActiveForScope(
    state,
    hero,
    id
  );

  return result;
}

function sanitizeDungeonPayload(
  raw: any
): any {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    throw new Error(
      'Expedição de dungeon ausente.'
    );
  }

  const expeditionId =
    String(
      raw.expeditionId ||
      ''
    ).slice(0, 120);

  if (!expeditionId) {
    throw new Error(
      'Expedição inválida.'
    );
  }

  const currentFloor =
    Math.max(
      1,
      Math.min(
        50,
        Math.trunc(
          Number(
            raw.currentFloor ||
            1
          )
        )
      )
    );

  const maxFloorReached =
    Math.max(
      currentFloor,
      Math.min(
        50,
        Math.trunc(
          Number(
            raw.maxFloorReached ||
            currentFloor
          )
        )
      )
    );

  const payload =
    cloneJson(raw);

  payload.expeditionId =
    expeditionId;

  payload.mode =
    raw.mode === 'party'
      ? 'party'
      : 'solo';

  payload.currentFloor =
    currentFloor;

  payload.maxFloorReached =
    maxFloorReached;

  payload.status =
    ['exploring',
      'combat',
      'extracted',
      'wiped'
    ].includes(
      String(raw.status)
    )
      ? String(raw.status)
      : 'exploring';

  payload.partyIds =
    Array.isArray(
      raw.partyIds
    )
      ? raw.partyIds
          .map(String)
          .slice(0, 12)
      : [];

  if (
    !payload.floorHistory ||
    typeof payload.floorHistory !==
      'object'
  ) {
    payload.floorHistory =
      {};
  }

  const floorKeys =
    Object.keys(
      payload.floorHistory
    );

  for (
    const key of
    floorKeys.slice(20)
  ) {
    delete payload.floorHistory[
      key
    ];
  }

  const loot =
    raw.accumulatedLoot &&
    typeof raw.accumulatedLoot ===
      'object'
      ? raw.accumulatedLoot
      : {};

  payload.accumulatedLoot = {
    gold:
      Math.max(
        0,
        Math.min(
          50000,
          Math.trunc(
            Number(
              loot.gold || 0
            )
          )
        )
      ),
    xp:
      Math.max(
        0,
        Math.min(
          50000,
          Math.trunc(
            Number(
              loot.xp || 0
            )
          )
        )
      ),
    items:
      Array.isArray(
        loot.items
      )
        ? cloneJson(
            loot.items.slice(
              0,
              100
            )
          )
        : []
  };

  return payload;
}

export function syncDungeonActivity(
  state: State,
  hero: Character,
  expedition: unknown
): WorldActivityState {
  const existing =
    getHeroActivity(
      state,
      hero
    );

  if (
    existing &&
    existing.type !==
      'dungeon' &&
    existing.status ===
      'active'
  ) {
    throw new Error(
      'Conclua a atividade atual antes de iniciar uma expedição.'
    );
  }

  const payload =
    sanitizeDungeonPayload(
      expedition
    );

  const id =
    activityId(
      'dungeon',
      hero
    );

  const result =
    upsertActivity(
      state,
      {
        id,
        type:
          'dungeon',
        scopeKey:
          getHeroScopeKey(
            hero
          ),
        status:
          payload.status ===
            'extracted'
            ? 'completed'
            : 'active',
        title:
          'Expedição nas Catacumbas',
        payload,
        createdAt:
          Date.now(),
        updatedAt:
          Date.now()
      }
    );

  markActiveForScope(
    state,
    hero,
    result.status ===
      'active'
      ? id
      : undefined
  );

  return result;
}

function normalizeLootItem(
  raw: unknown
): ItemDefinition | null {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  const item =
    raw as Record<
      string,
      unknown
    >;

  const id =
    String(
      item.id || ''
    ).slice(0, 160);

  const name =
    String(
      item.name || ''
    ).slice(0, 160);

  if (
    !id ||
    !name
  ) {
    return null;
  }

  return {
    ...(item as any),
    id,
    name
  } as ItemDefinition;
}

export function extractDungeonActivity(
  state: State,
  hero: Character
): {
  gold: number;
  xp: number;
  items: string[];
} {
  const activity =
    getHeroActivity(
      state,
      hero,
      'dungeon'
    );

  if (
    !activity ||
    activity.status !==
      'active'
  ) {
    throw new Error(
      'Nenhuma expedição ativa foi encontrada.'
    );
  }

  const payload =
    sanitizeDungeonPayload(
      activity.payload
    );

  const loot =
    payload.accumulatedLoot;

  const members =
    getScopeMembers(
      state,
      hero
    );

  const gold =
    Math.max(
      0,
      Math.trunc(
        loot.gold || 0
      )
    );

  const xp =
    Math.max(
      0,
      Math.trunc(
        loot.xp || 0
      )
    );

  const eachGold =
    members.length > 0
      ? Math.floor(
          gold /
          members.length
        )
      : gold;

  const eachXp =
    members.length > 0
      ? Math.floor(
          xp /
          members.length
        )
      : xp;

  for (
    const member of
    members
  ) {
    member.gold =
      (member.gold || 0) +
      eachGold;

    member.xp =
      (member.xp || 0) +
      eachXp;

    member.updatedAt =
      Date.now();
  }

  const names:
    string[] = [];

  for (
    const rawItem of
    loot.items
  ) {
    const item =
      normalizeLootItem(
        rawItem
      );

    if (!item) {
      continue;
    }

    hero.inventory =
      addInventoryItem(
        hero.inventory || '',
        item.name,
        1
      );

    hero.inventoryItemData = {
      ...(hero.inventoryItemData ||
        {}),
      [item.id]: {
        ...(
          ITEMS_CATALOG[
            item.id
          ] ||
          item
        )
      }
    };

    names.push(
      item.name
    );
  }

  hero.updatedAt =
    Date.now();

  activity.status =
    'completed';

  activity.payload = {
    ...payload,
    status:
      'extracted'
  };

  activity.updatedAt =
    Date.now();

  markActiveForScope(
    state,
    hero,
    undefined
  );

  state.logs.push(
    entry(
      '🏆 Expedição extraída: +' +
        gold +
        ' PO no grupo, +' +
        xp +
        ' XP e ' +
        names.length +
        ' item(ns) preservado(s).',
      'gm'
    )
  );

  return {
    gold,
    xp,
    items:
      names
  };
}

export function reconcileHeroActivity(
  state: State,
  hero: Character
): void {
  const activity =
    getHeroActivity(
      state,
      hero
    );

  if (!activity) {
    return;
  }

  if (
    activity.type ===
      'microadventure' &&
    !hero.activeMicroAdventureId
  ) {
    activity.status =
      'completed';

    activity.updatedAt =
      Date.now();

    markActiveForScope(
      state,
      hero,
      undefined
    );
  }
}
