import {
  locations,
  type BiomeType,
  type Character,
  type Enemy,
  type State
} from './game-engine';

export const WORLD_SCHEMA_VERSION = 1;

export function getCanonicalActForLocation(
  locationIndex: number
): 1 | 2 | 3 {
  if (locationIndex >= 4) return 3;
  if (locationIndex >= 2) return 2;
  return 1;
}

export function getHeroScopeKey(
  hero: Character
): string {
  return hero.partyId
    ? `party:${hero.partyId}`
    : `hero:${hero.id}`;
}

export function getScopeMembers(
  state: State,
  hero: Character
): Character[] {
  if (!hero.partyId) {
    return [hero];
  }

  const members = state.characters.filter(
    (candidate) =>
      candidate.partyId === hero.partyId
  );

  return members.length
    ? members
    : [hero];
}

export function enemyBelongsToScope(
  enemy: Enemy,
  hero: Character
): boolean {
  if (hero.partyId) {
    return enemy.partyId === hero.partyId;
  }

  return enemy.ownerCharId === hero.id;
}

export function getScopedEnemies(
  state: State,
  hero: Character,
  options?: {
    aliveOnly?: boolean;
    biome?: BiomeType;
  }
): Enemy[] {
  const biome =
    options?.biome ||
    hero.biome ||
    locations[hero.location ?? 0]?.biome ||
    'village';

  return (state.enemies || []).filter((enemy) => {
    if (
      options?.aliveOnly &&
      enemy.hp <= 0
    ) {
      return false;
    }

    if (
      enemy.biome &&
      enemy.biome !== biome
    ) {
      return false;
    }

    return enemyBelongsToScope(
      enemy,
      hero
    );
  });
}

export function getHeroBiome(
  state: State,
  hero?: Character | null
): BiomeType {
  if (hero?.biome) {
    return hero.biome;
  }

  const byLocation =
    hero?.location != null
      ? locations[hero.location]?.biome
      : undefined;

  return (
    byLocation ||
    state.biome ||
    'village'
  );
}

export function getHeroLocation(
  state: State,
  hero?: Character | null
): number {
  if (
    hero?.location != null &&
    Number.isInteger(hero.location)
  ) {
    return hero.location;
  }

  return Number.isInteger(state.location)
    ? state.location
    : 0;
}

export function ensureWorldSpine(
  state: State
): State {
  state.worldSchemaVersion =
    WORLD_SCHEMA_VERSION;

  state.activities =
    state.activities || {};

  state.corpses =
    state.corpses || [];

  state.questProgress =
    state.questProgress || {};

  state.worldFlags =
    state.worldFlags || {};

  state.economyContext =
    state.economyContext || {
      inflationMultiplier: 1,
      priceMultiplier: 1,
      scarcityNotes:
        'Mercado e suprimentos estáveis.',
      updatedAt: Date.now()
    };

  if (
    state.economyContext.updatedAt == null
  ) {
    state.economyContext.updatedAt =
      Date.now();
  }

  return state;
}

export function projectLegacyWorldView(
  state: State,
  hero: Character,
  isMmo: boolean
): void {
  if (isMmo) {
    return;
  }

  const location =
    hero.location ?? 0;

  state.location =
    location;

  state.biome =
    hero.biome ||
    locations[location]?.biome ||
    'village';

  state.act =
    getCanonicalActForLocation(
      location
    );
}

export function describeHeroWorldContext(
  state: State,
  hero?: Character | null
) {
  const biome =
    getHeroBiome(state, hero);

  const location =
    getHeroLocation(state, hero);

  return {
    biome,
    location,
    locationName:
      locations[location]?.name ||
      'Território de Valdoria',
    scopeKey:
      hero
        ? getHeroScopeKey(hero)
        : 'world',
    act:
      getCanonicalActForLocation(
        location
      )
  };
}
