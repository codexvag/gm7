import {
  d20,
  roll,
  prof,
  getGridDistance,
  type State,
  type Character,
  type Enemy,
  type AttackResult,
  type ActiveSpellEffect,
  type ActiveSpellAppliedCondition
} from './game-engine';

import {
  findSrdSpell,
  getSpellDisplayName,
  isCharacterSpellPrepared
} from './srd-spellbook';

import {
  getSpellAttackBonus,
  getSpellSaveDc
} from './srd-combat';

import {
  resolveSrdSpellRuntime,
  breakSrdConcentration,
  applySrdCharacterDamage
} from './srd-spell-runtime';

import {
  getCreatureProfile
} from './creature-profiles';

export type SrdDamageType =
  | 'Acid'
  | 'Bludgeoning'
  | 'Cold'
  | 'Fire'
  | 'Force'
  | 'Lightning'
  | 'Necrotic'
  | 'Piercing'
  | 'Poison'
  | 'Psychic'
  | 'Radiant'
  | 'Slashing'
  | 'Thunder';

export type SrdDamageTraitEntity = {
  hp: number;
  maxHp?: number;
  temporaryHp?: number;
  conditions?: string[];
  damageResistances?: string[];
  damageVulnerabilities?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
};

export type SrdTypedDamageResolution = {
  damageType?: SrdDamageType;
  rawDamage: number;
  afterResistance: number;
  finalDamage: number;
  resisted: boolean;
  vulnerable: boolean;
  immune: boolean;
};

export type SrdAppliedEnemyDamage = SrdTypedDamageResolution & {
  temporaryHpBefore: number;
  temporaryHpAbsorbed: number;
  temporaryHpAfter: number;
  hpBefore: number;
  hpDamage: number;
  hpAfter: number;
};

export type AdvancedSpellResolution = {
  spellName: string;
  spellLevel: number;
  economy: 'action' | 'bonus' | 'reaction';
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

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function hasSrdAdvancedCondition(
  entity: { conditions?: string[] },
  ...markers: string[]
): boolean {
  const values = (entity.conditions || []).map(normalizeText);
  return markers.some((marker) => {
    const wanted = normalizeText(marker);
    return values.some((value) => value.includes(wanted));
  });
}

const DAMAGE_ALIASES: Array<[SrdDamageType, string[]]> = [
  ['Acid', ['acid', 'acido']],
  ['Bludgeoning', ['bludgeoning', 'contundente', 'contusao']],
  ['Cold', ['cold', 'frio', 'gelo']],
  ['Fire', ['fire', 'fogo', 'igneo', 'chama']],
  ['Force', ['force', 'forca', 'arcane force']],
  ['Lightning', ['lightning', 'eletrico', 'eletricidade', 'relampago']],
  ['Necrotic', ['necrotic', 'necrotico']],
  ['Piercing', ['piercing', 'perfurante']],
  ['Poison', ['poison', 'veneno']],
  ['Psychic', ['psychic', 'psiquico']],
  ['Radiant', ['radiant', 'radiante']],
  ['Slashing', ['slashing', 'cortante']],
  ['Thunder', ['thunder', 'trovao', 'trovoada']]
];

export function normalizeSrdDamageType(
  value: unknown
): SrdDamageType | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;

  for (const [type, aliases] of DAMAGE_ALIASES) {
    if (
      normalizeText(type) === text ||
      aliases.some((alias) => text === normalizeText(alias))
    ) {
      return type;
    }
  }

  return undefined;
}

export function inferSrdDamageTypeFromText(
  value: unknown
): SrdDamageType | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;

  const explicit: SrdDamageType[] = [];

  for (const [type, aliases] of DAMAGE_ALIASES) {
    const terms = [type, ...aliases].map(normalizeText);
    if (
      terms.some((term) =>
        text.includes(term + ' damage') ||
        text.includes('dano de ' + term) ||
        text.includes('dano ' + term)
      )
    ) {
      explicit.push(type);
    }
  }

  if (explicit.length === 1) {
    return explicit[0];
  }

  const loose: SrdDamageType[] = [];
  for (const [type, aliases] of DAMAGE_ALIASES) {
    const terms = [type, ...aliases].map(normalizeText);
    if (terms.some((term) => text.includes(term))) {
      loose.push(type);
    }
  }

  return unique(loose).length === 1
    ? loose[0]
    : undefined;
}

export function inferSrdSpellDamageType(
  spellName: string,
  preferred?: unknown
): SrdDamageType | undefined {
  const preferredType = normalizeSrdDamageType(preferred);
  if (preferredType) return preferredType;

  const spell = findSrdSpell(spellName);
  if (!spell) return undefined;

  return inferSrdDamageTypeFromText(
    String(spell.description || '') + ' ' + String(spell.name || '')
  );
}

export function inferSrdWeaponDamageType(
  weapon: unknown
): SrdDamageType | undefined {
  const text = normalizeText(weapon);
  if (!text) return undefined;

  if (
    ['arco', 'bow', 'besta', 'crossbow', 'flecha', 'arrow', 'dardo', 'dart', 'rapier', 'estoque', 'dagger', 'adaga', 'spear', 'lanca'].some((term) => text.includes(term))
  ) {
    return 'Piercing';
  }

  if (
    ['espada', 'sword', 'machado', 'axe', 'scimitar', 'cimitarra', 'foice', 'sickle', 'glaive', 'halberd'].some((term) => text.includes(term))
  ) {
    return 'Slashing';
  }

  if (
    ['martelo', 'hammer', 'maca', 'mace', 'clava', 'club', 'cajado', 'staff', 'unarmed', 'desarmado'].some((term) => text.includes(term))
  ) {
    return 'Bludgeoning';
  }

  return inferSrdDamageTypeFromText(text);
}

function traitSet(
  entity: SrdDamageTraitEntity,
  key: 'damageResistances' | 'damageVulnerabilities' | 'damageImmunities'
): Set<SrdDamageType> {
  const values = new Set<SrdDamageType>();

  for (const entry of entity[key] || []) {
    const type = normalizeSrdDamageType(entry);
    if (type) values.add(type);
  }

  const conditions = entity.conditions || [];
  for (const condition of conditions) {
    const normalized = normalizeText(condition);
    for (const [type, aliases] of DAMAGE_ALIASES) {
      const terms = [type, ...aliases].map(normalizeText);
      const containsType = terms.some((term) => normalized.includes(term));
      if (!containsType) continue;

      if (
        key === 'damageResistances' &&
        (normalized.includes('resist') || normalized.includes('resistencia'))
      ) {
        values.add(type);
      }

      if (
        key === 'damageVulnerabilities' &&
        (normalized.includes('vulner') || normalized.includes('vulnerabilidade'))
      ) {
        values.add(type);
      }

      if (
        key === 'damageImmunities' &&
        (normalized.includes('immun') || normalized.includes('imunidade'))
      ) {
        values.add(type);
      }
    }
  }

  return values;
}

export function resolveSrdTypedDamage(
  entity: SrdDamageTraitEntity,
  rawDamage: number,
  damageType?: SrdDamageType
): SrdTypedDamageResolution {
  const raw = Math.max(0, Math.trunc(Number(rawDamage) || 0));
  if (!damageType || raw <= 0) {
    return {
      damageType,
      rawDamage: raw,
      afterResistance: raw,
      finalDamage: raw,
      resisted: false,
      vulnerable: false,
      immune: false
    };
  }

  const resistances = traitSet(entity, 'damageResistances');
  const vulnerabilities = traitSet(entity, 'damageVulnerabilities');
  const immunities = traitSet(entity, 'damageImmunities');

  const immune = immunities.has(damageType);
  const resisted = !immune && resistances.has(damageType);
  const vulnerable = !immune && vulnerabilities.has(damageType);

  if (immune) {
    return {
      damageType,
      rawDamage: raw,
      afterResistance: 0,
      finalDamage: 0,
      resisted: false,
      vulnerable: false,
      immune: true
    };
  }

  const afterResistance = resisted ? Math.floor(raw / 2) : raw;
  const finalDamage = vulnerable ? afterResistance * 2 : afterResistance;

  return {
    damageType,
    rawDamage: raw,
    afterResistance,
    finalDamage,
    resisted,
    vulnerable,
    immune: false
  };
}

export function applySrdTypedEnemyDamage(
  enemy: Enemy,
  rawDamage: number,
  damageType?: SrdDamageType
): SrdAppliedEnemyDamage {
  const typed = resolveSrdTypedDamage(enemy, rawDamage, damageType);
  const temporaryHpBefore = Math.max(0, enemy.temporaryHp || 0);
  const temporaryHpAbsorbed = Math.min(temporaryHpBefore, typed.finalDamage);
  const temporaryHpAfter = temporaryHpBefore - temporaryHpAbsorbed;
  enemy.temporaryHp = temporaryHpAfter;

  const remaining = Math.max(0, typed.finalDamage - temporaryHpAbsorbed);
  const hpBefore = Math.max(0, enemy.hp);
  enemy.hp = Math.max(0, enemy.hp - remaining);
  const hpAfter = enemy.hp;

  return {
    ...typed,
    temporaryHpBefore,
    temporaryHpAbsorbed,
    temporaryHpAfter,
    hpBefore,
    hpDamage: hpBefore - hpAfter,
    hpAfter
  };
}

export function applySrdTypedCharacterDamage(
  state: State,
  target: Character,
  rawDamage: number,
  damageType?: SrdDamageType
) {
  const typed = resolveSrdTypedDamage(target, rawDamage, damageType);
  const base = applySrdCharacterDamage(state, target, typed.finalDamage);
  return {
    ...base,
    ...typed
  };
}

function conditionAdjustmentToAc(entity: { conditions?: string[] }): number {
  let adjustment = 0;
  if (hasSrdAdvancedCondition(entity, 'escudo arcano', 'shield (+5')) adjustment += 5;
  if (hasSrdAdvancedCondition(entity, 'shield of faith', 'escudo da fe')) adjustment += 2;
  if (hasSrdAdvancedCondition(entity, 'haste', 'acelerado')) adjustment += 2;
  if (hasSrdAdvancedCondition(entity, 'slow', 'lentidao')) adjustment -= 2;
  return adjustment;
}

export function getSrdEffectiveArmorClass(
  entity: { ac: number; conditions?: string[] }
): number {
  return Math.max(0, entity.ac + conditionAdjustmentToAc(entity));
}

export function getSrdEffectiveMovementSquares(
  character: { speed: number; conditions?: string[] }
): number {
  let speedMeters = Math.max(0, character.speed || 0);

  if (hasSrdAdvancedCondition(character, 'fly', 'voando')) {
    speedMeters = Math.max(speedMeters, 18);
  }

  if (hasSrdAdvancedCondition(character, 'haste', 'acelerado')) {
    speedMeters *= 2;
  }

  if (hasSrdAdvancedCondition(character, 'slow', 'lentidao')) {
    speedMeters /= 2;
  }

  return Math.max(0, Math.floor(speedMeters / 1.5));
}

export function canUseSrdReaction(
  entity: { conditions?: string[] }
): boolean {
  return !hasSrdAdvancedCondition(entity, 'slow', 'lentidao');
}

export type AdvancedSavingThrowResolution = {
  raw: number;
  dice: number[];
  abilityModifier: number;
  proficiencyBonus: number;
  exhaustionPenalty: number;
  blessBonus: number;
  banePenalty: number;
  slowPenalty: number;
  total: number;
  dc: number;
  saved: boolean;
  mode: 'normal' | 'advantage';
};

export function rollSrdAdvancedCharacterSavingThrow(
  character: Character,
  abilityIndex: number,
  dc: number,
  options: {
    forcedD20?: number;
    forcedSecondD20?: number;
    forcedD4?: number;
  } = {}
): AdvancedSavingThrowResolution {
  const index = Math.max(0, Math.min(5, Math.trunc(abilityIndex)));
  const hasteDex = index === 1 && hasSrdAdvancedCondition(character, 'haste', 'acelerado');
  const mode: 'normal' | 'advantage' = hasteDex ? 'advantage' : 'normal';

  const clampD20 = (value: number) => Math.max(1, Math.min(20, Math.trunc(value)));
  let dice: number[];
  let raw: number;

  if (Number.isFinite(options.forcedD20)) {
    const first = clampD20(Number(options.forcedD20));
    if (hasteDex) {
      const second = Number.isFinite(options.forcedSecondD20)
        ? clampD20(Number(options.forcedSecondD20))
        : first;
      dice = [first, second];
      raw = Math.max(first, second);
    } else {
      dice = [first];
      raw = first;
    }
  } else {
    const rolled = d20(mode);
    dice = rolled.dice;
    raw = rolled.raw;
  }

  const abilityModifier = Math.floor(((character.stats[index] || 10) - 10) / 2);
  const proficiencyBonus = Array.isArray(character.saves) && character.saves.includes(index)
    ? prof(Math.max(1, character.level || 1))
    : 0;
  const exhaustionPenalty = 2 * Math.max(0, character.exhaustion || 0);
  const d4 = () => Number.isFinite(options.forcedD4)
    ? Math.max(1, Math.min(4, Math.trunc(Number(options.forcedD4))))
    : roll('1d4').total;

  const blessBonus = hasSrdAdvancedCondition(character, 'bless', 'abencoado') ? d4() : 0;
  const banePenalty = hasSrdAdvancedCondition(character, 'bane', 'amaldicoado') ? d4() : 0;
  const slowPenalty = index === 1 && hasSrdAdvancedCondition(character, 'slow', 'lentidao') ? 2 : 0;
  const total = raw + abilityModifier + proficiencyBonus - exhaustionPenalty + blessBonus - banePenalty - slowPenalty;

  return {
    raw,
    dice,
    abilityModifier,
    proficiencyBonus,
    exhaustionPenalty,
    blessBonus,
    banePenalty,
    slowPenalty,
    total,
    dc,
    saved: total >= dc,
    mode
  };
}

function enemySaveBonus(enemy: Enemy, abilityIndex: number): number {
  const profile = getCreatureProfile(enemy.name);
  if (profile.aiStyle === 'boss' || profile.aiStyle === 'dragon') return 3;
  if (profile.aiStyle === 'guardian' || profile.aiStyle === 'brute') return abilityIndex === 0 || abilityIndex === 2 ? 2 : 0;
  if (profile.aiStyle === 'skirmisher') return abilityIndex === 1 ? 2 : 1;
  if (profile.aiStyle === 'caster') return abilityIndex >= 3 ? 2 : 0;
  return 0;
}

function rollEnemySave(
  enemy: Enemy,
  abilityIndex: number,
  dc: number
) {
  const raw = d20().raw;
  const banePenalty = hasSrdAdvancedCondition(enemy, 'bane', 'amaldicoado') ? roll('1d4').total : 0;
  const slowPenalty = abilityIndex === 1 && hasSrdAdvancedCondition(enemy, 'slow', 'lentidao') ? 2 : 0;
  const total = raw + enemySaveBonus(enemy, abilityIndex) - banePenalty - slowPenalty;
  return { raw, total, dc, saved: total >= dc, banePenalty, slowPenalty };
}

function spellEconomy(spell: any): 'action' | 'bonus' | 'reaction' {
  const text = normalizeText(spell.castingTime || spell.actionType || '');
  if (text.includes('reaction')) return 'reaction';
  if (text.includes('bonus')) return 'bonus';
  return 'action';
}

function emptyResolution(spell: any, slotLevel: number): AdvancedSpellResolution {
  return {
    spellName: spell.name,
    spellLevel: slotLevel,
    economy: spellEconomy(spell),
    attackResult: null,
    healResult: null,
    affectedEnemyIds: [],
    defeatedEnemyIds: [],
    reactionLockedIds: [],
    changedCharacterIds: [],
    activeEffectIds: [],
    requiresAdjudication: false,
    logs: []
  };
}

function scopedEnemies(state: State, caster: Character): Enemy[] {
  return (state.enemies || []).filter((enemy) => {
    if (enemy.hp <= 0) return false;
    if (enemy.biome && caster.biome && enemy.biome !== caster.biome) return false;
    if (caster.partyId) return !enemy.partyId || enemy.partyId === caster.partyId;
    return !enemy.ownerCharId || enemy.ownerCharId === caster.id;
  });
}

function friendlyCharacters(state: State, caster: Character): Character[] {
  return (state.characters || []).filter((character) => {
    if (character.hp <= 0) return false;
    if (character.biome && caster.biome && character.biome !== caster.biome) return false;
    if (caster.partyId) return character.partyId === caster.partyId;
    return character.id === caster.id || character.owner === caster.owner;
  });
}

function allCharactersInArea(state: State, caster: Character): Character[] {
  return (state.characters || []).filter((character) => {
    if (character.hp <= 0) return false;
    if (character.biome && caster.biome && character.biome !== caster.biome) return false;
    return true;
  });
}

function resolveEnemyById(state: State, caster: Character, id: string): Enemy {
  const target = scopedEnemies(state, caster).find((enemy) => enemy.id === id);
  if (!target) throw new Error('Alvo hostil invalido.');
  return target;
}

function resolveFriendlyById(state: State, caster: Character, id: string): Character {
  const target = friendlyCharacters(state, caster).find((character) => character.id === id);
  if (!target) throw new Error('Alvo aliado invalido.');
  return target;
}

function ensureRange(caster: Character, target: { x: number; y: number }, maxSquares: number, label: string) {
  const distance = getGridDistance(caster, target);
  if (distance > maxSquares) {
    throw new Error(label + ' fora do alcance: ' + distance + ' quadrados; maximo ' + maxSquares + '.');
  }
}

function effectId(): string {
  return 'adv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function applyUniqueCondition(entity: { conditions?: string[] }, condition: string): void {
  entity.conditions = entity.conditions || [];
  if (!entity.conditions.some((entry) => normalizeText(entry) === normalizeText(condition))) {
    entity.conditions.push(condition);
  }
}

function registerAdvancedEffect(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  characterTargetIds: string[],
  enemyTargetIds: string[],
  conditions: ActiveSpellAppliedCondition[],
  rounds: number | undefined,
  concentration: boolean,
  description: string
): string {
  if (concentration) {
    breakSrdConcentration(state, caster.id);
  }

  for (const applied of conditions) {
    const target = applied.targetType === 'character'
      ? state.characters.find((entry) => entry.id === applied.targetId)
      : state.enemies.find((entry) => entry.id === applied.targetId);
    if (target) applyUniqueCondition(target, applied.condition);
  }

  state.spellEffects = state.spellEffects || [];
  const id = effectId();
  const effect: ActiveSpellEffect = {
    id,
    spellName: spell.name,
    casterId: caster.id,
    spellLevel: slotLevel,
    concentration,
    createdRound: state.round || 0,
    expiresAtRound: rounds === undefined ? undefined : (state.round || 0) + rounds,
    characterTargetIds: unique(characterTargetIds),
    enemyTargetIds: unique(enemyTargetIds),
    appliedConditions: conditions,
    description: description || String(spell.description || ''),
    requiresAdjudication: false
  };

  state.spellEffects.push(effect);
  if (concentration) caster.concentrationEffectId = id;
  return id;
}

export function breakSrdInvisibilityForActor(state: State, actorId: string): void {
  const effects = state.spellEffects || [];

  for (const effect of [...effects]) {
    if (effect.spellName !== 'Invisibility' || !effect.characterTargetIds.includes(actorId)) continue;

    effect.characterTargetIds = effect.characterTargetIds.filter((id) => id !== actorId);
    effect.appliedConditions = (effect.appliedConditions || []).filter((applied) => {
      if (applied.targetType !== 'character' || applied.targetId !== actorId) return true;
      const target = state.characters.find((character) => character.id === actorId);
      if (target) {
        target.conditions = (target.conditions || []).filter((condition) => condition !== applied.condition);
      }
      return false;
    });

    if (effect.characterTargetIds.length === 0) {
      state.spellEffects = (state.spellEffects || []).filter((candidate) => candidate.id !== effect.id);
      const caster = state.characters.find((character) => character.id === effect.casterId);
      if (caster?.concentrationEffectId === effect.id) caster.concentrationEffectId = undefined;
    }
  }
}

export function getSrdSpellTargetCapacity(spellName: string, slotLevel: number): number {
  const canonical = findSrdSpell(spellName)?.name || spellName;
  if (canonical === 'Bless' || canonical === 'Bane') return 3 + Math.max(0, slotLevel - 1);
  if (canonical === 'Invisibility') return 1 + Math.max(0, slotLevel - 2);
  if (canonical === 'Fly') return 1 + Math.max(0, slotLevel - 3);
  if (canonical === 'Slow') return 6;
  return 1;
}

export function getSrdScorchingRayCount(slotLevel: number): number {
  return 3 + Math.max(0, slotLevel - 2);
}

export function getSrdMagicMissileDartCount(slotLevel: number): number {
  return 3 + Math.max(0, slotLevel - 1);
}

export function getSrdEldritchBlastBeamCount(characterLevel: number): number {
  if (characterLevel >= 17) return 4;
  if (characterLevel >= 11) return 3;
  if (characterLevel >= 5) return 2;
  return 1;
}

function markHexEffect(state: State, casterId: string, targetId: string) {
  return (state.spellEffects || []).find((effect) =>
    effect.casterId === casterId &&
    (effect.spellName === "Hunter's Mark" || effect.spellName === 'Hex') &&
    effect.enemyTargetIds.includes(targetId)
  );
}

export function applySrdTypedMarkHexDamage(
  state: State,
  casterId: string,
  target: Enemy,
  critical = false
) {
  const effect = markHexEffect(state, casterId, target.id);
  if (!effect) return { extraRolled: 0, extraApplied: 0, damageType: undefined as SrdDamageType | undefined };

  const damageType: SrdDamageType = effect.spellName === "Hunter's Mark" ? 'Force' : 'Necrotic';
  const extraRolled = roll('1d6', critical).total;
  const applied = applySrdTypedEnemyDamage(target, extraRolled, damageType);
  return {
    extraRolled,
    extraApplied: applied.temporaryHpAbsorbed + applied.hpDamage,
    damageType
  };
}

export function applySrdAdvancedAttackToEnemy(
  state: State,
  attacker: Character,
  target: Enemy,
  result: AttackResult,
  sourceText?: unknown,
  explicitDamageType?: unknown
): AttackResult {
  if (!result.hit) {
    result.hpAfter = target.hp;
    return result;
  }

  const damageType = normalizeSrdDamageType(explicitDamageType) || inferSrdWeaponDamageType(sourceText);
  const base = applySrdTypedEnemyDamage(target, result.damage, damageType);
  const mark = applySrdTypedMarkHexDamage(state, attacker.id, target, result.isCrit);
  const applied = base.temporaryHpAbsorbed + base.hpDamage + mark.extraApplied;

  result.damage = applied;
  result.hpAfter = target.hp;

  if (damageType && (base.resisted || base.vulnerable || base.immune)) {
    result.text += ' [' + damageType + ': ' + base.rawDamage + ' -> ' + base.finalDamage + ']';
  }

  if (mark.extraRolled > 0) {
    result.text += ' [' + String(mark.damageType) + ' extra: +' + mark.extraApplied + ']';
  }

  return result;
}

function makeAttackResult(
  caster: Character,
  target: Enemy,
  totalAttack: number,
  raw: number,
  dice: number[],
  hit: boolean,
  crit: boolean,
  damage: number,
  hpBefore: number,
  text: string
): AttackResult {
  return {
    text,
    hit,
    isCrit: crit,
    isFumble: raw === 1,
    d20Roll: raw,
    totalAttack,
    targetAc: getSrdEffectiveArmorClass(target),
    damage,
    attackerName: caster.name,
    targetName: target.name,
    targetId: target.id,
    hpBefore,
    hpAfter: target.hp
  };
}

function resolveScorchingRay(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const rays = getSrdScorchingRayCount(slotLevel);
  const targets = ids.length ? ids : [];
  if (targets.length === 0) throw new Error('Selecione ao menos um alvo para Scorching Ray.');
  if (targets.length !== 1 && targets.length !== rays) {
    throw new Error('Para distribuir Scorching Ray, envie um targetId unico ou um targetIds com exatamente ' + rays + ' entradas.');
  }

  let last: AttackResult | null = null;
  for (let i = 0; i < rays; i++) {
    const target = resolveEnemyById(state, caster, targets.length === 1 ? targets[0] : targets[i]);
    ensureRange(caster, target, 24, 'Scorching Ray');
    const rolled = d20();
    const attackBonus = getSpellAttackBonus(caster);
    const total = rolled.raw + attackBonus;
    const ac = getSrdEffectiveArmorClass(target);
    const crit = rolled.raw === 20;
    const hit = crit || (rolled.raw !== 1 && total >= ac);
    const hpBefore = target.hp;
    let appliedDamage = 0;

    if (hit) {
      const baseRolled = roll('2d6', crit).total;
      const base = applySrdTypedEnemyDamage(target, baseRolled, 'Fire');
      const mark = applySrdTypedMarkHexDamage(state, caster.id, target, crit);
      appliedDamage = base.temporaryHpAbsorbed + base.hpDamage + mark.extraApplied;
      resolution.affectedEnemyIds.push(target.id);
      if (target.hp <= 0) resolution.defeatedEnemyIds.push(target.id);
    }

    const text = 'Scorching Ray ' + (i + 1) + '/' + rays + ' -> ' + target.name + ': ' + total + ' vs CA ' + ac + (hit ? ', ' + appliedDamage + ' dano.' : ', errou.');
    resolution.logs.push(text);
    last = makeAttackResult(caster, target, total, rolled.raw, rolled.dice, hit, crit, appliedDamage, hpBefore, text);
  }

  resolution.attackResult = last;
  resolution.affectedEnemyIds = unique(resolution.affectedEnemyIds);
  resolution.defeatedEnemyIds = unique(resolution.defeatedEnemyIds);
  return resolution;
}

function resolveEldritchBlast(
  state: State,
  caster: Character,
  spell: any,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, 0);
  const beams = getSrdEldritchBlastBeamCount(caster.level || 1);
  const targets = ids.length ? ids : [];
  if (targets.length === 0) throw new Error('Selecione ao menos um alvo para Eldritch Blast.');
  if (targets.length !== 1 && targets.length !== beams) {
    throw new Error('Para distribuir Eldritch Blast, envie um targetId unico ou um targetIds com exatamente ' + beams + ' entradas.');
  }

  let last: AttackResult | null = null;
  for (let i = 0; i < beams; i++) {
    const target = resolveEnemyById(state, caster, targets.length === 1 ? targets[0] : targets[i]);
    ensureRange(caster, target, 24, 'Eldritch Blast');
    const rolled = d20();
    const attackBonus = getSpellAttackBonus(caster);
    const total = rolled.raw + attackBonus;
    const ac = getSrdEffectiveArmorClass(target);
    const crit = rolled.raw === 20;
    const hit = crit || (rolled.raw !== 1 && total >= ac);
    const hpBefore = target.hp;
    let appliedDamage = 0;

    if (hit) {
      const baseRolled = roll('1d10', crit).total;
      const base = applySrdTypedEnemyDamage(target, baseRolled, 'Force');
      const mark = applySrdTypedMarkHexDamage(state, caster.id, target, crit);
      appliedDamage = base.temporaryHpAbsorbed + base.hpDamage + mark.extraApplied;
      resolution.affectedEnemyIds.push(target.id);
      if (target.hp <= 0) resolution.defeatedEnemyIds.push(target.id);
    }

    const text = 'Eldritch Blast ' + (i + 1) + '/' + beams + ' -> ' + target.name + ': ' + total + ' vs CA ' + ac + (hit ? ', ' + appliedDamage + ' dano.' : ', errou.');
    resolution.logs.push(text);
    last = makeAttackResult(caster, target, total, rolled.raw, rolled.dice, hit, crit, appliedDamage, hpBefore, text);
  }

  resolution.attackResult = last;
  resolution.affectedEnemyIds = unique(resolution.affectedEnemyIds);
  resolution.defeatedEnemyIds = unique(resolution.defeatedEnemyIds);
  return resolution;
}

function resolveMagicMissile(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const darts = getSrdMagicMissileDartCount(slotLevel);
  const targets = ids.length ? ids : [];
  if (targets.length === 0) throw new Error('Selecione ao menos um alvo para Magic Missile.');
  if (targets.length !== 1 && targets.length !== darts) {
    throw new Error('Para distribuir Magic Missile, envie um targetId unico ou um targetIds com exatamente ' + darts + ' entradas.');
  }

  for (let i = 0; i < darts; i++) {
    const target = resolveEnemyById(state, caster, targets.length === 1 ? targets[0] : targets[i]);
    ensureRange(caster, target, 24, 'Magic Missile');

    if (hasSrdAdvancedCondition(target, 'escudo arcano', 'shield (+5')) {
      resolution.logs.push('Magic Missile ' + (i + 1) + '/' + darts + ' -> ' + target.name + ': bloqueado por Shield.');
      continue;
    }

    const rolled = roll('1d4+1').total;
    const applied = applySrdTypedEnemyDamage(target, rolled, 'Force');
    const actual = applied.temporaryHpAbsorbed + applied.hpDamage;
    resolution.affectedEnemyIds.push(target.id);
    if (target.hp <= 0) resolution.defeatedEnemyIds.push(target.id);
    resolution.logs.push('Magic Missile ' + (i + 1) + '/' + darts + ' -> ' + target.name + ': ' + actual + ' Force.');
  }

  resolution.affectedEnemyIds = unique(resolution.affectedEnemyIds);
  resolution.defeatedEnemyIds = unique(resolution.defeatedEnemyIds);
  return resolution;
}

function resolveFireball(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  targetId: string | undefined,
  targetX: number | undefined,
  targetY: number | undefined
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  let x = Number.isFinite(targetX) ? Number(targetX) : undefined;
  let y = Number.isFinite(targetY) ? Number(targetY) : undefined;

  if (x === undefined || y === undefined) {
    if (!targetId) throw new Error('Selecione o centro de Fireball.');
    const target = resolveEnemyById(state, caster, targetId);
    x = target.x;
    y = target.y;
  }

  ensureRange(caster, { x, y }, 30, 'Fireball');
  const dice = 8 + Math.max(0, slotLevel - 3);
  const rawDamage = roll(String(dice) + 'd6').total;
  const dc = getSpellSaveDc(caster);
  const radius = 4;

  const inArea = (entity: { x: number; y: number }) =>
    Math.max(Math.abs(entity.x - x), Math.abs(entity.y - y)) <= radius;

  for (const enemy of scopedEnemies(state, caster).filter(inArea)) {
    const save = rollEnemySave(enemy, 1, dc);
    const before = enemy.hp;
    const amount = save.saved ? Math.floor(rawDamage / 2) : rawDamage;
    const applied = applySrdTypedEnemyDamage(enemy, amount, 'Fire');
    const actual = applied.temporaryHpAbsorbed + applied.hpDamage;
    resolution.affectedEnemyIds.push(enemy.id);
    if (enemy.hp <= 0) resolution.defeatedEnemyIds.push(enemy.id);
    resolution.logs.push(enemy.name + ': DES ' + save.total + ' vs CD ' + dc + ', ' + actual + ' Fire' + (save.saved ? ' (metade).' : '.'));
    if (before > 0 && enemy.hp <= 0) resolution.defeatedEnemyIds.push(enemy.id);
  }

  for (const character of allCharactersInArea(state, caster).filter(inArea)) {
    const save = rollSrdAdvancedCharacterSavingThrow(character, 1, dc);
    const amount = save.saved ? Math.floor(rawDamage / 2) : rawDamage;
    const applied = applySrdTypedCharacterDamage(state, character, amount, 'Fire');
    resolution.changedCharacterIds.push(character.id);
    resolution.logs.push(character.name + ': DES ' + save.total + ' vs CD ' + dc + ', ' + applied.finalDamage + ' Fire' + (save.saved ? ' (metade).' : '.'));
  }

  resolution.affectedEnemyIds = unique(resolution.affectedEnemyIds);
  resolution.defeatedEnemyIds = unique(resolution.defeatedEnemyIds);
  resolution.changedCharacterIds = unique(resolution.changedCharacterIds);
  return resolution;
}

function resolveBless(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const targetIds = ids.length ? unique(ids) : [caster.id];
  const capacity = getSrdSpellTargetCapacity('Bless', slotLevel);
  if (targetIds.length > capacity) throw new Error('Bless permite no maximo ' + capacity + ' alvos neste nivel.');

  const applied: ActiveSpellAppliedCondition[] = [];
  for (const id of targetIds) {
    const target = resolveFriendlyById(state, caster, id);
    ensureRange(caster, target, 6, 'Bless');
    applied.push({ targetType: 'character', targetId: target.id, condition: 'Abencoado (Bless)' });
    resolution.changedCharacterIds.push(target.id);
  }

  const effect = registerAdvancedEffect(state, caster, spell, slotLevel, targetIds, [], applied, 10, true, 'Bless: +1d4 em ataques e salvaguardas.');
  resolution.activeEffectIds.push(effect);
  return resolution;
}

function resolveBane(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const targetIds = unique(ids);
  const capacity = getSrdSpellTargetCapacity('Bane', slotLevel);
  if (targetIds.length === 0) throw new Error('Selecione ao menos um alvo para Bane.');
  if (targetIds.length > capacity) throw new Error('Bane permite no maximo ' + capacity + ' alvos neste nivel.');

  const applied: ActiveSpellAppliedCondition[] = [];
  const failed: string[] = [];
  const dc = getSpellSaveDc(caster);

  for (const id of targetIds) {
    const target = resolveEnemyById(state, caster, id);
    ensureRange(caster, target, 6, 'Bane');
    const save = rollEnemySave(target, 5, dc);
    resolution.logs.push(target.name + ': CAR ' + save.total + ' vs CD ' + dc + (save.saved ? ' - resistiu Bane.' : ' - afetado por Bane.'));
    if (!save.saved) {
      failed.push(target.id);
      applied.push({ targetType: 'enemy', targetId: target.id, condition: 'Amaldicoado (Bane)' });
      resolution.affectedEnemyIds.push(target.id);
    }
  }

  const effect = registerAdvancedEffect(state, caster, spell, slotLevel, [], failed, applied, 10, true, 'Bane: -1d4 em ataques e salvaguardas.');
  resolution.activeEffectIds.push(effect);
  return resolution;
}

function resolveInvisibility(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const targetIds = ids.length ? unique(ids) : [caster.id];
  const capacity = getSrdSpellTargetCapacity('Invisibility', slotLevel);
  if (targetIds.length > capacity) throw new Error('Invisibility permite no maximo ' + capacity + ' alvos neste nivel.');

  const applied: ActiveSpellAppliedCondition[] = [];
  for (const id of targetIds) {
    const target = resolveFriendlyById(state, caster, id);
    ensureRange(caster, target, 1, 'Invisibility');
    applied.push({ targetType: 'character', targetId: target.id, condition: 'Invisivel (Invisibility)' });
    resolution.changedCharacterIds.push(target.id);
  }

  const effect = registerAdvancedEffect(state, caster, spell, slotLevel, targetIds, [], applied, 600, true, 'Invisibility: termina para um alvo quando ele ataca ou conjura uma magia.');
  resolution.activeEffectIds.push(effect);
  return resolution;
}

function resolveFly(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const targetIds = ids.length ? unique(ids) : [caster.id];
  const capacity = getSrdSpellTargetCapacity('Fly', slotLevel);
  if (targetIds.length > capacity) throw new Error('Fly permite no maximo ' + capacity + ' alvos neste nivel.');

  const applied: ActiveSpellAppliedCondition[] = [];
  for (const id of targetIds) {
    const target = resolveFriendlyById(state, caster, id);
    ensureRange(caster, target, 1, 'Fly');
    applied.push({ targetType: 'character', targetId: target.id, condition: 'Voando (Fly)' });
    resolution.changedCharacterIds.push(target.id);
  }

  const effect = registerAdvancedEffect(state, caster, spell, slotLevel, targetIds, [], applied, 100, true, 'Fly: deslocamento de voo 60 pes e hover.');
  resolution.activeEffectIds.push(effect);
  return resolution;
}

function resolveHaste(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const id = ids[0] || caster.id;
  const target = resolveFriendlyById(state, caster, id);
  ensureRange(caster, target, 6, 'Haste');
  const applied: ActiveSpellAppliedCondition[] = [
    { targetType: 'character', targetId: target.id, condition: 'Acelerado (Haste)' }
  ];
  const effect = registerAdvancedEffect(state, caster, spell, slotLevel, [target.id], [], applied, 10, true, 'Haste: Speed x2, +2 CA e vantagem em salvaguardas de Destreza.');
  resolution.activeEffectIds.push(effect);
  resolution.changedCharacterIds.push(target.id);
  return resolution;
}

function resolveSlow(
  state: State,
  caster: Character,
  spell: any,
  slotLevel: number,
  ids: string[]
): AdvancedSpellResolution {
  const resolution = emptyResolution(spell, slotLevel);
  const targetIds = unique(ids);
  if (targetIds.length === 0) throw new Error('Selecione ao menos um alvo para Slow.');
  if (targetIds.length > 6) throw new Error('Slow permite no maximo 6 criaturas.');

  const dc = getSpellSaveDc(caster);
  const failed: string[] = [];
  const applied: ActiveSpellAppliedCondition[] = [];

  for (const id of targetIds) {
    const target = resolveEnemyById(state, caster, id);
    ensureRange(caster, target, 24, 'Slow');
    const save = rollEnemySave(target, 4, dc);
    resolution.logs.push(target.name + ': SAB ' + save.total + ' vs CD ' + dc + (save.saved ? ' - resistiu Slow.' : ' - afetado por Slow.'));
    if (!save.saved) {
      failed.push(target.id);
      applied.push({ targetType: 'enemy', targetId: target.id, condition: 'Lentidao (Slow)' });
      resolution.affectedEnemyIds.push(target.id);
    }
  }

  const effect = registerAdvancedEffect(state, caster, spell, slotLevel, [], failed, applied, 10, true, 'Slow: Speed/2, -2 CA e DES saves, sem Reacoes.');
  resolution.activeEffectIds.push(effect);
  return resolution;
}

export function tryResolveAdvancedSrdSpell(
  state: State,
  caster: Character,
  args: {
    spellName: string;
    spellLevel?: number;
    targetId?: string;
    targetIds?: string[];
    targetX?: number;
    targetY?: number;
    damageType?: string;
    canOccupy?: (x: number, y: number) => boolean;
    asRitual?: boolean;
  }
): AdvancedSpellResolution | null {
  const spell = findSrdSpell(args.spellName);
  if (!spell) return null;

  const supported = [
    'Fireball',
    'Scorching Ray',
    'Magic Missile',
    'Eldritch Blast',
    'Bless',
    'Bane',
    'Invisibility',
    'Fly',
    'Haste',
    'Slow'
  ];

  if (!supported.includes(spell.name)) return null;
  if (!isCharacterSpellPrepared(caster, spell.name, { asRitual: args.asRitual })) {
    throw new Error(caster.name + ' nao possui ' + getSpellDisplayName(spell.name) + ' preparada.');
  }

  const slotLevel = spell.level === 0 ? 0 : Math.max(spell.level, Number(args.spellLevel || spell.level));
  const ids = Array.isArray(args.targetIds) && args.targetIds.length
    ? args.targetIds.map(String)
    : args.targetId
      ? [String(args.targetId)]
      : [];

  switch (spell.name) {
    case 'Fireball':
      return resolveFireball(state, caster, spell, slotLevel, args.targetId, args.targetX, args.targetY);
    case 'Scorching Ray':
      return resolveScorchingRay(state, caster, spell, slotLevel, ids);
    case 'Magic Missile':
      return resolveMagicMissile(state, caster, spell, slotLevel, ids);
    case 'Eldritch Blast':
      return resolveEldritchBlast(state, caster, spell, ids);
    case 'Bless':
      return resolveBless(state, caster, spell, slotLevel, ids);
    case 'Bane':
      return resolveBane(state, caster, spell, slotLevel, ids);
    case 'Invisibility':
      return resolveInvisibility(state, caster, spell, slotLevel, ids);
    case 'Fly':
      return resolveFly(state, caster, spell, slotLevel, ids);
    case 'Haste':
      return resolveHaste(state, caster, spell, slotLevel, ids);
    case 'Slow':
      return resolveSlow(state, caster, spell, slotLevel, ids);
    default:
      return null;
  }
}

export function resolveSrdSpellWithAdvancedDamage(
  state: State,
  caster: Character,
  args: {
    spellName: string;
    spellLevel?: number;
    targetId?: string;
    targetIds?: string[];
    targetX?: number;
    targetY?: number;
    damageType?: string;
    canOccupy?: (x: number, y: number) => boolean;
    asRitual?: boolean;
  }
): AdvancedSpellResolution {
  const advanced = tryResolveAdvancedSrdSpell(state, caster, args);
  if (advanced) return advanced;

  const before = new Map<string, { hp: number; temporaryHp: number }>();
  for (const enemy of state.enemies || []) {
    before.set(enemy.id, { hp: enemy.hp, temporaryHp: enemy.temporaryHp || 0 });
  }

  const resolution = resolveSrdSpellRuntime(state, caster, args);
  const damageType = inferSrdSpellDamageType(args.spellName, args.damageType);

  for (const enemyId of resolution.affectedEnemyIds || []) {
    const enemy = state.enemies.find((entry) => entry.id === enemyId);
    const snapshot = before.get(enemyId);
    if (!enemy || !snapshot) continue;

    const rawLost = Math.max(0, snapshot.hp - enemy.hp);
    if (rawLost <= 0) continue;

    enemy.hp = snapshot.hp;
    enemy.temporaryHp = snapshot.temporaryHp;
    const applied = applySrdTypedEnemyDamage(enemy, rawLost, damageType);

    if (resolution.attackResult && resolution.attackResult.targetId === enemy.id) {
      const mark = resolution.attackResult.hit
        ? applySrdTypedMarkHexDamage(state, caster.id, enemy, resolution.attackResult.isCrit)
        : { extraRolled: 0, extraApplied: 0, damageType: undefined };
      resolution.attackResult.damage = applied.temporaryHpAbsorbed + applied.hpDamage + mark.extraApplied;
      resolution.attackResult.hpAfter = enemy.hp;
    }
  }

  resolution.defeatedEnemyIds = unique(
    (resolution.affectedEnemyIds || []).filter((id) => {
      const enemy = state.enemies.find((entry) => entry.id === id);
      return Boolean(enemy && enemy.hp <= 0);
    })
  );

  return resolution as AdvancedSpellResolution;
}

export type CounterspellAttempt = {
  countered: boolean;
  counterspellerId?: string;
  counterspellerName?: string;
  dc?: number;
  saveTotal?: number;
  slotSpent: boolean;
  slotLevel?: number;
};

export function resolveSrdCounterspellAttempt(
  state: State,
  counterspeller: Character,
  targetCaster: Character,
  options: { forcedConSaveD20?: number } = {}
): CounterspellAttempt {
  if (!isCharacterSpellPrepared(counterspeller, 'Counterspell')) {
    return { countered: false, slotSpent: false };
  }
  if (!canUseSrdReaction(counterspeller)) {
    return { countered: false, slotSpent: false };
  }
  if ((state.reactionUsedBy || {})[counterspeller.id]) {
    return { countered: false, slotSpent: false };
  }
  let slotLevel = 0;
  for (let level = 3; level <= 9; level++) {
    const index = level - 1;
    if ((counterspeller.usedSlots[index] || 0) < (counterspeller.slots[index] || 0)) {
      slotLevel = level;
      break;
    }
  }
  if (!slotLevel) {
    return { countered: false, slotSpent: false };
  }
  if (getGridDistance(counterspeller, targetCaster) > 12) {
    return { countered: false, slotSpent: false };
  }

  const dc = getSpellSaveDc(counterspeller);
  const save = rollSrdAdvancedCharacterSavingThrow(targetCaster, 2, dc, {
    forcedD20: options.forcedConSaveD20
  });

  breakSrdInvisibilityForActor(state, counterspeller.id);
  const slotIndex = slotLevel - 1;
  counterspeller.usedSlots[slotIndex] = (counterspeller.usedSlots[slotIndex] || 0) + 1;
  state.reactionUsedBy = state.reactionUsedBy || {};
  state.reactionUsedBy[counterspeller.id] = true;

  return {
    countered: !save.saved,
    counterspellerId: counterspeller.id,
    counterspellerName: counterspeller.name,
    dc,
    saveTotal: save.total,
    slotSpent: true,
    slotLevel
  };
}

export function tryAutoCounterspellCharacterCast(
  state: State,
  targetCaster: Character,
  targetSpellName?: string
): CounterspellAttempt {
  if (targetSpellName) {
    const targetSpell = findSrdSpell(targetSpellName);
    if (targetSpell) {
      const components = String(targetSpell.components || '');
      if (!/[VSM]/i.test(components)) {
        return { countered: false, slotSpent: false };
      }
    }
  }
  state.reactionPolicyBy = state.reactionPolicyBy || {};
  state.reactionUsedBy = state.reactionUsedBy || {};

  const candidates = (state.characters || [])
    .filter((candidate) => {
      if (candidate.id === targetCaster.id || candidate.hp <= 0) return false;
      if (state.reactionPolicyBy?.[candidate.id] !== 'counterspell') return false;
      if (state.reactionUsedBy?.[candidate.id]) return false;
      if (!candidate.partyId || !targetCaster.partyId || candidate.partyId === targetCaster.partyId) return false;
      if (!isCharacterSpellPrepared(candidate, 'Counterspell')) return false;
      if (!canUseSrdReaction(candidate)) return false;
      const hasSlot = candidate.slots.some((total, index) => index >= 2 && (candidate.usedSlots[index] || 0) < (total || 0));
      if (!hasSlot) return false;
      return getGridDistance(candidate, targetCaster) <= 12;
    })
    .sort((a, b) => getGridDistance(a, targetCaster) - getGridDistance(b, targetCaster));

  const counterspeller = candidates[0];
  if (!counterspeller) return { countered: false, slotSpent: false };
  return resolveSrdCounterspellAttempt(state, counterspeller, targetCaster);
}
