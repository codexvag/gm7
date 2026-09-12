import type { Character, Enemy, Log, State } from './game-engine';

// Cross-instance (multi-isolate Cloudflare) optimistic merge utilities.
// Local RAM / client state is merged with D1 / server snapshots per-entity by
// freshness (updatedAt), instead of whole-state "highest version wins".
// This prevents players being reset to spawn or disappearing when two
// isolates diverge on the version counter.

export function touchChar(c: { updatedAt?: number; lastSeen?: number }): void {
  const now = Date.now();
  c.updatedAt = now;
  c.lastSeen = now;
}

function isNewer(base: number | undefined, incoming: number | undefined): boolean {
  return (base ?? 0) < (incoming ?? 0);
}

export function mergeCharacters(
  base: Character[],
  incoming: Character[],
  incomingIsAuthoritative: boolean = false
): Character[] {
  if (incomingIsAuthoritative) {
    // When incoming is authoritatively newer (e.g. server removed a disconnected player),
    // incoming is the source of truth for the active entity set.
    const baseMap = new Map<string, Character>();
    for (const c of base) baseMap.set(c.id, c);

    return incoming.map((inc) => {
      const b = baseMap.get(inc.id);
      if (b && isNewer(inc.updatedAt, b.updatedAt)) {
        return b;
      }
      return inc;
    });
  }

  const map = new Map<string, Character>();
  for (const c of base) map.set(c.id, c);
  for (const c of incoming) {
    const existing = map.get(c.id);
    if (!existing) {
      map.set(c.id, c);
    } else if (isNewer(existing.updatedAt, c.updatedAt)) {
      map.set(c.id, c);
    }
  }
  return Array.from(map.values());
}

export function mergeEnemies(base: Enemy[], incoming: Enemy[]): Enemy[] {
  const map = new Map<string, Enemy>();
  for (const e of base) map.set(e.id, e);
  for (const e of incoming) {
    const existing = map.get(e.id);
    if (!existing) {
      map.set(e.id, e);
    } else if (isNewer(existing.updatedAt, e.updatedAt)) {
      map.set(e.id, e);
    }
  }
  return Array.from(map.values());
}

export function mergeLogs(base: Log[], incoming: Log[]): Log[] {
  const map = new Map<string, Log>();
  for (const l of base) map.set(l.id, l);
  for (const l of incoming) {
    if (!map.has(l.id)) map.set(l.id, l);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.time < b.time ? -1 : a.time > b.time ? 1 : 0
  );
}

export function mergeStates(
  base: State,
  incoming: State,
  baseVersion: number,
  incomingVersion: number
): State {
  const baseU = base.updatedAt ?? 0;
  const incU = incoming.updatedAt ?? 0;

  let useIncomingScalars: boolean;
  if (baseU === 0 && incU === 0) {
    // Legacy states without timestamps: fall back to version counter.
    useIncomingScalars = incomingVersion >= baseVersion;
  } else if (incU === 0) {
    useIncomingScalars = false; // base was touched, incoming is stale
  } else if (baseU === 0) {
    useIncomingScalars = true; // incoming was touched
  } else {
    useIncomingScalars = incU >= baseU;
  }

  const winner = useIncomingScalars ? incoming : base;
  const merged: State = {
    ...winner,
    characters: mergeCharacters(base.characters, incoming.characters, useIncomingScalars),
    enemies: mergeEnemies(base.enemies, incoming.enemies),
    logs: mergeLogs(base.logs, incoming.logs).slice(-200)
  };
  return merged;
}