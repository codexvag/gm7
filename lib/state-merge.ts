import type {
  Character,
  Enemy,
  GroundCorpse,
  Log,
  NpcEntity,
  State,
  WorldActivityState
} from './game-engine';

export function touchChar(
  value: {
    updatedAt?: number;
    lastSeen?: number;
  }
): void {
  const now =
    Date.now();

  value.updatedAt =
    now;

  value.lastSeen =
    now;
}

function isNewer(
  base?: number,
  incoming?: number
): boolean {
  return (
    (incoming ?? 0) >
    (base ?? 0)
  );
}

export function mergeCharacters(
  base: Character[],
  incoming: Character[],
  incomingIsAuthoritative = false
): Character[] {
  if (
    incomingIsAuthoritative
  ) {
    const baseMap =
      new Map<
        string,
        Character
      >();

    for (
      const character of
      base
    ) {
      baseMap.set(
        character.id,
        character
      );
    }

    return incoming.map(
      (candidate) => {
        const existing =
          baseMap.get(
            candidate.id
          );

        if (
          existing &&
          isNewer(
            candidate.updatedAt,
            existing.updatedAt
          )
        ) {
          return existing;
        }

        return candidate;
      }
    );
  }

  const result =
    new Map<
      string,
      Character
    >();

  for (
    const character of
    base
  ) {
    result.set(
      character.id,
      character
    );
  }

  for (
    const candidate of
    incoming
  ) {
    const existing =
      result.get(
        candidate.id
      );

    if (
      !existing ||
      isNewer(
        existing.updatedAt,
        candidate.updatedAt
      )
    ) {
      result.set(
        candidate.id,
        candidate
      );
    }
  }

  return Array.from(
    result.values()
  );
}

export function mergeEnemies(
  base: Enemy[],
  incoming: Enemy[]
): Enemy[] {
  const result =
    new Map<
      string,
      Enemy
    >();

  for (
    const enemy of
    base
  ) {
    result.set(
      enemy.id,
      enemy
    );
  }

  for (
    const candidate of
    incoming
  ) {
    const existing =
      result.get(
        candidate.id
      );

    if (
      !existing ||
      isNewer(
        existing.updatedAt,
        candidate.updatedAt
      )
    ) {
      result.set(
        candidate.id,
        candidate
      );
    }
  }

  return Array.from(
    result.values()
  );
}

export function mergeCorpses(
  base: GroundCorpse[] = [],
  incoming: GroundCorpse[] = []
): GroundCorpse[] {
  const result =
    new Map<
      string,
      GroundCorpse
    >();

  for (
    const corpse of
    base
  ) {
    result.set(
      corpse.id,
      corpse
    );
  }

  for (
    const corpse of
    incoming
  ) {
    if (
      !result.has(
        corpse.id
      )
    ) {
      result.set(
        corpse.id,
        corpse
      );
    }
  }

  return Array.from(
    result.values()
  );
}

export function mergeLogs(
  base: Log[],
  incoming: Log[]
): Log[] {
  const result =
    new Map<
      string,
      Log
    >();

  for (
    const log of
    base
  ) {
    result.set(
      log.id,
      log
    );
  }

  for (
    const log of
    incoming
  ) {
    if (
      !result.has(
        log.id
      )
    ) {
      result.set(
        log.id,
        log
      );
    }
  }

  return Array.from(
    result.values()
  )
    .sort(
      (left, right) =>
        left.time <
        right.time
          ? -1
          : left.time >
              right.time
            ? 1
            : 0
    )
    .slice(-200);
}

export function mergeNpcs(
  base: NpcEntity[] = [],
  incoming: NpcEntity[] = []
): NpcEntity[] {
  const result =
    new Map<
      string,
      NpcEntity
    >();

  for (
    const npc of
    base
  ) {
    result.set(
      npc.id,
      npc
    );
  }

  for (
    const candidate of
    incoming
  ) {
    const existing =
      result.get(
        candidate.id
      );

    if (!existing) {
      result.set(
        candidate.id,
        candidate
      );

      continue;
    }

    const existingTime =
      existing.lastInteractionAt ||
      0;

    const incomingTime =
      candidate.lastInteractionAt ||
      0;

    const winner =
      incomingTime >=
        existingTime
        ? candidate
        : existing;

    const memoryMap =
      new Map<
        string,
        any
      >();

    for (
      const memory of
      [
        ...(existing.memories ||
          []),
        ...(candidate.memories ||
          [])
      ]
    ) {
      const key =
        String(
          memory.timestamp ||
          0
        ) +
        '|' +
        String(
          memory.heroId ||
          ''
        ) +
        '|' +
        String(
          memory.summary ||
          ''
        );

      memoryMap.set(
        key,
        memory
      );
    }

    result.set(
      candidate.id,
      {
        ...winner,
        memories:
          Array.from(
            memoryMap.values()
          )
            .sort(
              (left, right) =>
                (
                  left.timestamp ||
                  0
                ) -
                (
                  right.timestamp ||
                  0
                )
            )
            .slice(-16)
      }
    );
  }

  return Array.from(
    result.values()
  );
}

function mergeBooleanRecord(
  base:
    | Record<
        string,
        boolean
      >
    | undefined,
  incoming:
    | Record<
        string,
        boolean
      >
    | undefined
): Record<
  string,
  boolean
> {
  const result = {
    ...(base || {})
  };

  for (
    const [
      key,
      value
    ] of
    Object.entries(
      incoming || {}
    )
  ) {
    result[key] =
      Boolean(
        result[key] ||
        value
      );
  }

  return result;
}

function mergeActivities(
  base:
    | Record<
        string,
        WorldActivityState
      >
    | undefined,
  incoming:
    | Record<
        string,
        WorldActivityState
      >
    | undefined
): Record<
  string,
  WorldActivityState
> {
  const result = {
    ...(base || {})
  };

  for (
    const [
      id,
      activity
    ] of
    Object.entries(
      incoming || {}
    )
  ) {
    const existing =
      result[id];

    if (
      !existing ||
      (
        activity.updatedAt ||
        0
      ) >=
      (
        existing.updatedAt ||
        0
      )
    ) {
      result[id] =
        activity;
    }
  }

  return result;
}

function mergePartyInvites(
  base: any[] = [],
  incoming: any[] = []
): any[] {
  const result =
    new Map<
      string,
      any
    >();

  for (
    const invite of
    [
      ...base,
      ...incoming
    ]
  ) {
    const id =
      String(
        invite?.id ||
        ''
      );

    if (!id) {
      continue;
    }

    const existing =
      result.get(id);

    if (
      !existing ||
      (
        invite.timestamp ||
        0
      ) >=
      (
        existing.timestamp ||
        0
      )
    ) {
      result.set(
        id,
        invite
      );
    }
  }

  return Array.from(
    result.values()
  );
}

export function mergeStates(
  base: State,
  incoming: State,
  baseVersion: number,
  incomingVersion: number
): State {
  const incomingWinsScalars =
    incomingVersion >
      baseVersion ||
    (
      incomingVersion ===
        baseVersion &&
      (
        incoming.updatedAt ||
        0
      ) >
      (
        base.updatedAt ||
        0
      )
    );

  const winner =
    incomingWinsScalars
      ? incoming
      : base;

  const economyBase =
    base.economyContext;

  const economyIncoming =
    incoming.economyContext;

  const economy =
    !economyBase
      ? economyIncoming
      : !economyIncoming
        ? economyBase
        : (
            economyIncoming.updatedAt ||
            0
          ) >=
          (
            economyBase.updatedAt ||
            0
          )
          ? economyIncoming
          : economyBase;

  return {
    ...winner,
    worldSchemaVersion:
      Math.max(
        base.worldSchemaVersion ||
          0,
        incoming.worldSchemaVersion ||
          0
      ),
    characters:
      mergeCharacters(
        base.characters || [],
        incoming.characters || [],
        incomingWinsScalars
      ),
    enemies:
      mergeEnemies(
        base.enemies || [],
        incoming.enemies || []
      ),
    corpses:
      mergeCorpses(
        base.corpses || [],
        incoming.corpses || []
      ),
    npcs:
      mergeNpcs(
        base.npcs || [],
        incoming.npcs || []
      ),
    logs:
      mergeLogs(
        base.logs || [],
        incoming.logs || []
      ),
    questProgress:
      mergeBooleanRecord(
        base.questProgress,
        incoming.questProgress
      ),
    worldFlags:
      mergeBooleanRecord(
        base.worldFlags,
        incoming.worldFlags
      ),
    activities:
      mergeActivities(
        base.activities,
        incoming.activities
      ),
    partyInvites:
      mergePartyInvites(
        base.partyInvites,
        incoming.partyInvites
      ),
    economyContext:
      economy,
    updatedAt:
      Math.max(
        base.updatedAt ||
          0,
        incoming.updatedAt ||
          0
      )
  };
}
