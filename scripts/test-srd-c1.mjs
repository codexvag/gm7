import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true },
  resolve: { alias: [{ find: '@', replacement: root }] }
});

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('[PASS] ' + name);
  } catch (error) {
    failed++;
    console.error('[FAIL] ' + name);
    console.error(error?.stack || error);
  }
}

function makeHero(engine, id = 'hero', owner = 'owner-a') {
  const hero = engine.newCharacter();
  Object.assign(hero, {
    id,
    owner,
    name: 'Hero ' + id,
    className: 'Mago',
    level: 10,
    stats: [12, 14, 14, 18, 12, 12],
    saves: [3, 4],
    hp: 100,
    maxHp: 100,
    ac: 15,
    speed: 9,
    temporaryHp: 0,
    conditions: [],
    slots: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    usedSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    knownCantrips: ['Eldritch Blast'],
    preparedSpells: [
      'Fireball',
      'Scorching Ray',
      'Magic Missile',
      'Bless',
      'Bane',
      'Invisibility',
      'Fly',
      'Haste',
      'Slow',
      'Counterspell'
    ],
    spellbook: [
      'Fireball',
      'Scorching Ray',
      'Magic Missile',
      'Bless',
      'Bane',
      'Invisibility',
      'Fly',
      'Haste',
      'Slow',
      'Counterspell'
    ],
    spellSelectionVersion: 1,
    x: 0,
    y: 0,
    biome: 'forest',
    exhaustion: 0
  });
  return hero;
}

function makeEnemy(id = 'enemy', x = 4, y = 4) {
  return {
    id,
    name: 'Goblin ' + id,
    hp: 200,
    maxHp: 200,
    ac: 10,
    attack: 3,
    damage: '1d6',
    initiative: 0,
    x,
    y,
    conditions: [],
    temporaryHp: 0,
    biome: 'forest'
  };
}

try {
  const engine = await vite.ssrLoadModule('/lib/game-engine.ts');
  const advanced = await vite.ssrLoadModule('/lib/srd-advanced-combat.ts');

  await test('Fire resistance halves typed damage', () => {
    const enemy = makeEnemy('resist');
    enemy.damageResistances = ['Fire'];
    const r = advanced.resolveSrdTypedDamage(enemy, 11, 'Fire');
    assert.equal(r.finalDamage, 5);
    assert.equal(r.resisted, true);
  });

  await test('Cold vulnerability doubles typed damage', () => {
    const enemy = makeEnemy('vuln');
    enemy.damageVulnerabilities = ['Cold'];
    const r = advanced.resolveSrdTypedDamage(enemy, 7, 'Cold');
    assert.equal(r.finalDamage, 14);
    assert.equal(r.vulnerable, true);
  });

  await test('Lightning immunity reduces damage to zero', () => {
    const enemy = makeEnemy('immune');
    enemy.damageImmunities = ['Lightning'];
    const r = advanced.resolveSrdTypedDamage(enemy, 99, 'Lightning');
    assert.equal(r.finalDamage, 0);
    assert.equal(r.immune, true);
  });

  await test('Resistance is applied before temporary HP', () => {
    const hero = makeHero(engine, 'temp-resist');
    hero.damageResistances = ['Fire'];
    hero.temporaryHp = 3;
    const state = engine.initialState();
    state.characters = [hero];
    const r = advanced.applySrdTypedCharacterDamage(state, hero, 10, 'Fire');
    assert.equal(r.finalDamage, 5);
    assert.equal(r.temporaryHpAbsorbed, 3);
    assert.equal(hero.hp, 98);
    assert.equal(hero.temporaryHp, 0);
  });

  await test('Enemy temporary HP also absorbs typed damage', () => {
    const enemy = makeEnemy('enemy-temp');
    enemy.temporaryHp = 4;
    const r = advanced.applySrdTypedEnemyDamage(enemy, 9, 'Force');
    assert.equal(r.temporaryHpAbsorbed, 4);
    assert.equal(enemy.hp, 195);
  });

  await test('Damage type inference recognizes core spell types', () => {
    assert.equal(advanced.inferSrdSpellDamageType('Fireball'), 'Fire');
    assert.equal(advanced.inferSrdSpellDamageType('Magic Missile'), 'Force');
  });

  await test('Haste Shield and Slow modify AC mechanically', () => {
    assert.equal(advanced.getSrdEffectiveArmorClass({ ac: 15, conditions: ['Acelerado (Haste)'] }), 17);
    assert.equal(advanced.getSrdEffectiveArmorClass({ ac: 15, conditions: ['Escudo Arcano (+5 CA)'] }), 20);
    assert.equal(advanced.getSrdEffectiveArmorClass({ ac: 15, conditions: ['Lentidao (Slow)'] }), 13);
  });

  await test('Haste Slow and Fly modify movement mechanically', () => {
    assert.equal(advanced.getSrdEffectiveMovementSquares({ speed: 9, conditions: ['Acelerado (Haste)'] }), 12);
    assert.equal(advanced.getSrdEffectiveMovementSquares({ speed: 9, conditions: ['Lentidao (Slow)'] }), 3);
    assert.equal(advanced.getSrdEffectiveMovementSquares({ speed: 9, conditions: ['Voando (Fly)'] }), 12);
  });

  await test('Slow blocks reactions', () => {
    assert.equal(advanced.canUseSrdReaction({ conditions: ['Lentidao (Slow)'] }), false);
    assert.equal(advanced.canUseSrdReaction({ conditions: [] }), true);
  });

  await test('Haste grants advantage on Dexterity saves', () => {
    const hero = makeHero(engine, 'haste-save');
    hero.conditions = ['Acelerado (Haste)'];
    const r = advanced.rollSrdAdvancedCharacterSavingThrow(hero, 1, 10, {
      forcedD20: 3,
      forcedSecondD20: 17
    });
    assert.equal(r.mode, 'advantage');
    assert.equal(r.raw, 17);
  });

  await test('Upcast capacities are calculated for multi-target spells', () => {
    assert.equal(advanced.getSrdSpellTargetCapacity('Bless', 1), 3);
    assert.equal(advanced.getSrdSpellTargetCapacity('Bless', 4), 6);
    assert.equal(advanced.getSrdSpellTargetCapacity('Invisibility', 4), 3);
    assert.equal(advanced.getSrdSpellTargetCapacity('Fly', 5), 3);
    assert.equal(advanced.getSrdSpellTargetCapacity('Slow', 3), 6);
  });

  await test('Scorching Ray Magic Missile and Eldritch Blast scale attack count', () => {
    assert.equal(advanced.getSrdScorchingRayCount(2), 3);
    assert.equal(advanced.getSrdScorchingRayCount(5), 6);
    assert.equal(advanced.getSrdMagicMissileDartCount(1), 3);
    assert.equal(advanced.getSrdMagicMissileDartCount(4), 6);
    assert.equal(advanced.getSrdEldritchBlastBeamCount(1), 1);
    assert.equal(advanced.getSrdEldritchBlastBeamCount(5), 2);
    assert.equal(advanced.getSrdEldritchBlastBeamCount(11), 3);
    assert.equal(advanced.getSrdEldritchBlastBeamCount(17), 4);
  });

  await test("Hunter's Mark uses Force and honors immunity", () => {
    const caster = makeHero(engine, 'ranger');
    const enemy = makeEnemy('mark-target');
    enemy.damageImmunities = ['Force'];
    const state = engine.initialState();
    state.characters = [caster];
    state.enemies = [enemy];
    state.spellEffects = [{
      id: 'mark-effect',
      spellName: "Hunter's Mark",
      casterId: caster.id,
      spellLevel: 1,
      concentration: true,
      createdRound: 1,
      characterTargetIds: [],
      enemyTargetIds: [enemy.id],
      appliedConditions: [],
      description: 'test'
    }];
    const mark = advanced.applySrdTypedMarkHexDamage(state, caster.id, enemy, false);
    assert.equal(mark.damageType, 'Force');
    assert.equal(mark.extraApplied, 0);
  });

  await test('Hex uses Necrotic and honors immunity', () => {
    const caster = makeHero(engine, 'warlock');
    const enemy = makeEnemy('hex-target');
    enemy.damageImmunities = ['Necrotic'];
    const state = engine.initialState();
    state.characters = [caster];
    state.enemies = [enemy];
    state.spellEffects = [{
      id: 'hex-effect',
      spellName: 'Hex',
      casterId: caster.id,
      spellLevel: 1,
      concentration: true,
      createdRound: 1,
      characterTargetIds: [],
      enemyTargetIds: [enemy.id],
      appliedConditions: [],
      description: 'test'
    }];
    const hex = advanced.applySrdTypedMarkHexDamage(state, caster.id, enemy, false);
    assert.equal(hex.damageType, 'Necrotic');
    assert.equal(hex.extraApplied, 0);
  });

  await test('Weapon pipeline applies resistance and updates AttackResult', () => {
    const caster = makeHero(engine, 'fighter');
    caster.weapon = 'Espada Longa';
    const enemy = makeEnemy('weapon-target');
    enemy.damageResistances = ['Slashing'];
    const state = engine.initialState();
    state.characters = [caster];
    state.enemies = [enemy];
    const result = {
      text: 'hit', hit: true, isCrit: false, isFumble: false,
      d20Roll: 15, totalAttack: 20, targetAc: 10,
      damage: 11, attackerName: caster.name, targetName: enemy.name,
      targetId: enemy.id, hpBefore: enemy.hp, hpAfter: enemy.hp - 11
    };
    advanced.applySrdAdvancedAttackToEnemy(state, caster, enemy, result, caster.weapon);
    assert.equal(enemy.hp, 195);
    assert.equal(result.damage, 5);
    assert.equal(result.hpAfter, 195);
  });

  await test('Fireball applies friendly fire inside the area', () => {
    const caster = makeHero(engine, 'fireball-caster');
    caster.x = 0;
    caster.y = 0;
    const ally = makeHero(engine, 'fireball-ally');
    ally.x = 8;
    ally.y = 8;
    const enemy = makeEnemy('fireball-enemy', 8, 8);
    const state = engine.initialState();
    state.characters = [caster, ally];
    state.enemies = [enemy];
    const result = advanced.resolveSrdSpellWithAdvancedDamage(state, caster, {
      spellName: 'Fireball', spellLevel: 3, targetX: 8, targetY: 8
    });
    assert.ok(enemy.hp < 200);
    assert.ok(ally.hp < 100);
    assert.ok(result.affectedEnemyIds.includes(enemy.id));
    assert.ok(result.changedCharacterIds.includes(ally.id));
  });

  await test('Magic Missile is blocked by Shield', () => {
    const caster = makeHero(engine, 'missile-caster');
    const enemy = makeEnemy('shielded', 2, 0);
    enemy.conditions = ['Escudo Arcano (+5 CA)'];
    const state = engine.initialState();
    state.characters = [caster];
    state.enemies = [enemy];
    advanced.resolveSrdSpellWithAdvancedDamage(state, caster, {
      spellName: 'Magic Missile', spellLevel: 1, targetId: enemy.id
    });
    assert.equal(enemy.hp, 200);
  });

  await test('Bless supports three targets and creates one concentration effect', () => {
    const caster = makeHero(engine, 'bless-caster');
    const a = makeHero(engine, 'bless-a');
    const b = makeHero(engine, 'bless-b');
    caster.x = a.x = b.x = 0;
    caster.y = a.y = b.y = 0;
    const state = engine.initialState();
    state.characters = [caster, a, b];
    const r = advanced.resolveSrdSpellWithAdvancedDamage(state, caster, {
      spellName: 'Bless', spellLevel: 1, targetIds: [caster.id, a.id, b.id]
    });
    assert.equal(r.changedCharacterIds.length, 3);
    assert.ok(caster.conditions.some((x) => x.includes('Bless')));
    assert.ok(a.conditions.some((x) => x.includes('Bless')));
    assert.equal(state.spellEffects.length, 1);
  });

  await test('Upcast Invisibility supports multiple targets and breaks per actor', () => {
    const caster = makeHero(engine, 'invis-caster');
    const a = makeHero(engine, 'invis-a');
    const b = makeHero(engine, 'invis-b');
    caster.x = a.x = b.x = 0;
    caster.y = a.y = b.y = 0;
    const state = engine.initialState();
    state.characters = [caster, a, b];
    advanced.resolveSrdSpellWithAdvancedDamage(state, caster, {
      spellName: 'Invisibility', spellLevel: 3, targetIds: [a.id, b.id]
    });
    assert.ok(a.conditions.some((x) => x.includes('Invisibility')));
    assert.ok(b.conditions.some((x) => x.includes('Invisibility')));
    advanced.breakSrdInvisibilityForActor(state, a.id);
    assert.ok(!a.conditions.some((x) => x.includes('Invisibility')));
    assert.ok(b.conditions.some((x) => x.includes('Invisibility')));
  });

  await test('Revised Counterspell failure cancels spell without spending target slot', () => {
    const counter = makeHero(engine, 'counter', 'owner-counter');
    const target = makeHero(engine, 'target-caster', 'owner-target');
    counter.partyId = 'party-counter';
    target.partyId = 'party-target';
    counter.x = 0;
    counter.y = 0;
    target.x = 1;
    target.y = 0;
    const state = engine.initialState();
    state.characters = [counter, target];
    state.reactionUsedBy = {};
    const targetUsedBefore = [...target.usedSlots];
    const r = advanced.resolveSrdCounterspellAttempt(state, counter, target, {
      forcedConSaveD20: 1
    });
    assert.equal(r.countered, true);
    assert.equal(r.slotSpent, true);
    assert.deepEqual(target.usedSlots, targetUsedBefore);
    assert.equal(state.reactionUsedBy[counter.id], true);
    assert.ok((counter.usedSlots[r.slotLevel - 1] || 0) > 0);
  });

  await test('Successful Constitution save resists Counterspell but counter slot is spent', () => {
    const counter = makeHero(engine, 'counter-pass', 'owner-counter');
    const target = makeHero(engine, 'target-pass', 'owner-target');
    counter.partyId = 'party-counter';
    target.partyId = 'party-target';
    counter.x = 0;
    target.x = 1;
    const state = engine.initialState();
    state.characters = [counter, target];
    state.reactionUsedBy = {};
    const r = advanced.resolveSrdCounterspellAttempt(state, counter, target, {
      forcedConSaveD20: 20
    });
    assert.equal(r.countered, false);
    assert.equal(r.slotSpent, true);
  });

  await test('Route integrates advanced runtime, targetIds and Counterspell policy', () => {
    const src = fs.readFileSync(path.join(root, 'app/api/game/route.ts'), 'utf8');
    assert.ok(src.includes('resolveSrdSpellWithAdvancedDamage('));
    assert.ok(src.includes('SRD_3B_C1_COUNTERSPELL_TRIGGER'));
    assert.ok(src.includes("'counterspell'"));
    assert.ok(src.includes('targetIds:'));
    assert.ok(src.includes('SRD_3B_C1_MAIN_TYPED_PIPELINE'));
  });

  await test('Game engine exposes damage traits and tactical spell movement rules', () => {
    const src = fs.readFileSync(path.join(root, 'lib/game-engine.ts'), 'utf8');
    assert.ok(src.includes('damageResistances?: string[];'));
    assert.ok(src.includes('damageVulnerabilities?: string[];'));
    assert.ok(src.includes('damageImmunities?: string[];'));
    assert.ok(src.includes('SRD_3B_C1_EFFECTIVE_MOVEMENT'));
    assert.ok(src.includes('SRD_3B_C1_EFFECTIVE_AC'));
  });

  await test('Client reserves Counterspell as a reaction policy', () => {
    const src = fs.readFileSync(path.join(root, 'app/game.tsx'), 'utf8');
    assert.ok(src.includes('SRD_3B_C1_COUNTERSPELL_UI'));
    assert.ok(src.includes("spellName === 'Counterspell'"));
    assert.ok(src.includes("'counterspell'"));
  });
} finally {
  await vite.close();
}

console.log('');
console.log('============================================');
console.log(' SRD 3B-C1 AUTOMATED TEST REPORT');
console.log('============================================');
console.log('');
console.log('PASS:', passed);
console.log('FAIL:', failed);

if (failed > 0) process.exit(1);

console.log('');
console.log('ALL SRD 3B-C1 TESTS PASSED.');
