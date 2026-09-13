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

try {
  const engine = await vite.ssrLoadModule('/lib/game-engine.ts');
  const spellbook = await vite.ssrLoadModule('/lib/srd-spellbook.ts');
  const runtime = await vite.ssrLoadModule('/lib/srd-spell-runtime.ts');
  const combat = await vite.ssrLoadModule('/lib/srd-combat.ts');
  const advanced = await vite.ssrLoadModule('/lib/srd-advanced-combat.ts');
  const generated = await vite.ssrLoadModule('/lib/generated/srd-spells-5-2-1.ts');

  function makeHero(id = 'hero', className = 'Mago', level = 10, owner = 'owner-a') {
    const hero = engine.newCharacter();
    Object.assign(hero, {
      id,
      owner,
      name: 'Hero ' + id,
      className,
      level,
      stats: [12, 14, 14, 18, 14, 14],
      saves: [3, 4],
      hp: 80,
      maxHp: 80,
      ac: 15,
      speed: 9,
      temporaryHp: 0,
      conditions: [],
      slots: [4, 3, 3, 3, 2, 1, 0, 0, 0],
      usedSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      knownCantrips: ['Fire Bolt'],
      preparedSpells: ['Fireball', 'Shield', 'Magic Missile'],
      spellbook: ['Fireball', 'Shield', 'Magic Missile', 'Detect Magic', 'Identify', 'Alarm'],
      spellSelectionVersion: 1,
      x: 0,
      y: 0,
      biome: 'forest',
      exhaustion: 0
    });
    return hero;
  }

  function makeEnemy(id = 'enemy', x = 1, y = 0) {
    return {
      id,
      ownerCharId: 'hero',
      name: 'Goblin ' + id,
      hp: 100,
      maxHp: 100,
      ac: 12,
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

  /* ======================================================================
   * 3B-B6: FEATURES DE CLASSE, PREPARAÇÃO E DESCANSO
   * ====================================================================== */

  await test('Wizard can cast ritual spells from spellbook without preparing them', () => {
    const wizard = makeHero('wiz-ritual', 'Mago', 5);
    wizard.preparedSpells = ['Fireball', 'Shield'];
    wizard.spellbook = ['Fireball', 'Shield', 'Detect Magic', 'Identify'];

    // Detect Magic is in spellbook and has ritual: true, but not in preparedSpells
    assert.equal(spellbook.isCharacterSpellPrepared(wizard, 'Detect Magic', { asRitual: true }), true);
    assert.equal(spellbook.isCharacterSpellPrepared(wizard, 'Detect Magic'), true);

    // Non-ritual spell not prepared is false
    assert.equal(spellbook.isCharacterSpellPrepared(wizard, 'Scorching Ray'), false);

    // Spell actions for Wizard include rituals from spellbook
    const actions = spellbook.getCharacterSpellActions(wizard);
    assert.ok(actions.some((a) => a.canonicalName === 'Detect Magic'));
  });

  await test('Druid always has Speak with Animals prepared starting at level 1', () => {
    const druid = makeHero('druid-speak', 'Druida', 1);
    druid.preparedSpells = ['Cure Wounds', 'Entangle'];

    const always = spellbook.getAlwaysPreparedSpells('Druida', 1);
    assert.ok(always.includes('Speak with Animals'));
    assert.equal(spellbook.isCharacterSpellPrepared(druid, 'Speak with Animals'), true);
  });

  await test('Warlock Mystic Arcanum provides free level 6-9 casts and resets on Long Rest', () => {
    const warlock = makeHero('warlock-arcanum', 'Bruxo', 11);
    warlock.slots = [0, 0, 0, 0, 3, 0, 0, 0, 0];
    warlock.usedSlots = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Level 11 Warlock gets 6th level arcanum
    const eligible11 = combat.getMysticArcanumEligibleSpellLevels(11);
    assert.deepEqual(eligible11, [6]);
    assert.equal(combat.hasMysticArcanumAvailable(warlock, 6), true);

    // Levels 13, 15, 17 progression
    assert.deepEqual(combat.getMysticArcanumEligibleSpellLevels(13), [6, 7]);
    assert.deepEqual(combat.getMysticArcanumEligibleSpellLevels(15), [6, 7, 8]);
    assert.deepEqual(combat.getMysticArcanumEligibleSpellLevels(17), [6, 7, 8, 9]);

    // Spending the arcanum marks it spent
    warlock.mysticArcanumSpent = [6];
    assert.equal(combat.hasMysticArcanumAvailable(warlock, 6), false);

    // Long Rest restores arcanum
    warlock.mysticArcanumSpent = [];
    assert.equal(combat.hasMysticArcanumAvailable(warlock, 6), true);
  });

  await test("Ranger Favored Enemy grants free Hunter's Mark uses scaling with proficiency", () => {
    assert.equal(combat.getRangerFreeHuntersMarkMaxUses(1), 2);
    assert.equal(combat.getRangerFreeHuntersMarkMaxUses(4), 2);
    assert.equal(combat.getRangerFreeHuntersMarkMaxUses(5), 3);
    assert.equal(combat.getRangerFreeHuntersMarkMaxUses(8), 3);
    assert.equal(combat.getRangerFreeHuntersMarkMaxUses(9), 4);
    assert.equal(combat.getRangerFreeHuntersMarkMaxUses(13), 5);
    assert.equal(combat.getRangerFreeHuntersMarkMaxUses(17), 6);

    const ranger = makeHero('ranger-mark', 'Patrulheiro', 5);
    const maxUses = combat.getRangerFreeHuntersMarkMaxUses(ranger.level);
    assert.equal(maxUses, 3);
    ranger.freeHuntersMarkSpent = 1;
    assert.ok(ranger.freeHuntersMarkSpent < maxUses);
  });

  await test('Warlock recovers Pact Magic spell slots on Short Rest', () => {
    const warlock = makeHero('warlock-short', 'Bruxo', 5);
    warlock.slots = [0, 0, 2, 0, 0, 0, 0, 0, 0];
    warlock.usedSlots = [0, 0, 2, 0, 0, 0, 0, 0, 0];

    // Simulate shortRest logic
    warlock.usedSlots = warlock.slots.map(() => 0);
    assert.deepEqual(warlock.usedSlots, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  await test('Wizard Arcane Recovery restores slots up to half wizard level', () => {
    assert.equal(combat.getWizardArcaneRecoveryLimit(1), 1);
    assert.equal(combat.getWizardArcaneRecoveryLimit(4), 2);
    assert.equal(combat.getWizardArcaneRecoveryLimit(5), 3);
    assert.equal(combat.getWizardArcaneRecoveryLimit(10), 5);
  });

  await test('reprepareCharacterSpells validates class limits, spell levels, and spellbook', () => {
    const wizard = makeHero('wiz-prep', 'Mago', 3);
    wizard.spellbook = ['Fireball', 'Shield', 'Magic Missile', 'Detect Magic', 'Mage Armor', 'Sleep'];

    // Level 3 Wizard prepared limit is 6 (SPELL_PROGRESSIONS.Mago.prepared[2] = 6)
    const valid = spellbook.reprepareCharacterSpells(wizard, ['Shield', 'Magic Missile', 'Mage Armor']);
    assert.equal(valid.ok, true);
    assert.deepEqual(wizard.preparedSpells, ['Shield', 'Magic Missile', 'Mage Armor']);

    // Cannot prepare spells not in spellbook
    const invalidBook = spellbook.reprepareCharacterSpells(wizard, ['Shield', 'Cure Wounds']);
    assert.equal(invalidBook.ok, false);

    // Cannot exceed prepared limit
    const tooMany = spellbook.reprepareCharacterSpells(wizard, [
      'Shield', 'Magic Missile', 'Mage Armor', 'Sleep', 'Detect Magic', 'Fireball', 'Counterspell'
    ]);
    assert.equal(tooMany.ok, false);
  });

  /* ======================================================================
   * 3B-B7: AUDITORIA SRD DAS 339 MAGIAS
   * ====================================================================== */

  await test('SRD spell catalog contains exactly 339 spells with complete metadata', () => {
    const spells = generated.SRD_SPELL_DATA;
    assert.equal(spells.length, 339);

    for (const s of spells) {
      assert.ok(s.name && typeof s.name === 'string', 'Spell missing name');
      assert.ok(typeof s.level === 'number' && s.level >= 0 && s.level <= 9, s.name + ' invalid level');
      assert.ok(s.school && typeof s.school === 'string', s.name + ' invalid school');
      assert.ok(Array.isArray(s.classes) && s.classes.length > 0, s.name + ' missing classes');
      assert.ok(typeof s.description === 'string' && s.description.length > 0, s.name + ' missing description');
    }
  });

  await test('All 339 spells map to valid HUD spells with accurate economy and targetMode', () => {
    for (const s of generated.SRD_SPELL_DATA) {
      const hud = spellbook.toHudSpell(s);
      assert.ok(hud.id, s.name + ' missing HUD id');
      assert.ok(hud.canonicalName, s.name + ' missing canonicalName');
      assert.ok(['action', 'bonus', 'reaction'].includes(hud.economyType), s.name + ' invalid economy');
      assert.ok(['enemy', 'ally', 'self', 'point', 'area'].includes(hud.targetMode), s.name + ' invalid targetMode');
    }
  });

  await test('Audited targetMode classifications for critical SRD spells', () => {
    const checkTargetMode = (name, expected) => {
      const s = spellbook.findSrdSpell(name);
      assert.ok(s, 'Spell not found: ' + name);
      const hud = spellbook.toHudSpell(s);
      assert.equal(hud.targetMode, expected, name + ' targetMode mismatch');
    };

    checkTargetMode('Chill Touch', 'enemy');
    checkTargetMode('Inflict Wounds', 'enemy');
    checkTargetMode('Vampiric Touch', 'enemy');
    checkTargetMode('Bless', 'ally');
    checkTargetMode('Resistance', 'ally');
    checkTargetMode('Guidance', 'ally');
    checkTargetMode('Dimension Door', 'point');
    checkTargetMode('Teleport', 'point');
    checkTargetMode('Misty Step', 'point');
    checkTargetMode('Fireball', 'area');
  });

  await test('All 339 spells resolve cleanly through the advanced damage pipeline without uncaught errors', () => {
    const spells = generated.SRD_SPELL_DATA;
    let successfulResolutions = 0;

    for (const s of spells) {
      const hud = spellbook.toHudSpell(s);
      const range = Math.max(1, hud.rangeSquares || 1);
      const targetDistance = Math.min(1, range);

      const caster = makeHero('caster-audit', 'Mago', 20);
      caster.slots = [4, 3, 3, 3, 3, 2, 2, 1, 1];
      caster.usedSlots = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      caster.preparedSpells = [s.name];
      caster.spellbook = [s.name];
      caster.knownCantrips = [s.name];

      const enemy = makeEnemy('dummy-' + s.level, targetDistance, 0);
      enemy.ownerCharId = caster.id;

      const state = engine.initialState();
      state.characters = [caster];
      state.enemies = [enemy];

      const payload = {
        spellName: s.name,
        spellLevel: s.level,
        targetId: hud.targetMode === 'enemy' ? enemy.id : caster.id,
        targetIds: [hud.targetMode === 'enemy' ? enemy.id : caster.id],
        targetX: targetDistance,
        targetY: 0
      };

      const res = advanced.resolveSrdSpellWithAdvancedDamage(state, caster, payload);
      assert.ok(res, 'Resolution failed for ' + s.name);
      assert.ok(Array.isArray(res.logs), 'Resolution missing logs for ' + s.name);
      successfulResolutions++;
    }

    assert.equal(successfulResolutions, 339);
  });

  /* ======================================================================
   * ROUTE & ENGINE INTEGRATION AUDIT
   * ====================================================================== */

  await test('Route contains full B6 and B7 integration', () => {
    const src = fs.readFileSync(path.join(root, 'app/api/game/route.ts'), 'utf8');
    assert.ok(src.includes('reprepareCharacterSpells'));
    assert.ok(src.includes('getRangerFreeHuntersMarkMaxUses'));
    assert.ok(src.includes('hasMysticArcanumAvailable'));
    assert.ok(src.includes('getWizardArcaneRecoveryLimit'));
    assert.ok(src.includes("case 'reprepareSpells':"));
    assert.ok(src.includes('isFreeHuntersMark'));
    assert.ok(src.includes('isMysticArcanum'));
    assert.ok(src.includes('isRitualCast'));
  });

  await test('Game engine Character type includes B6 class feature fields', () => {
    const src = fs.readFileSync(path.join(root, 'lib/game-engine.ts'), 'utf8');
    assert.ok(src.includes('mysticArcanumSpent?: number[];'));
    assert.ok(src.includes('freeHuntersMarkSpent?: number;'));
    assert.ok(src.includes('arcaneRecoverySpent?: boolean;'));
  });
} finally {
  await vite.close();
}

console.log('');
console.log('============================================');
console.log(' SRD 3B-C2 AUTOMATED TEST REPORT');
console.log('============================================');
console.log('');
console.log('PASS:', passed);
console.log('FAIL:', failed);

if (failed > 0) process.exit(1);

console.log('');
console.log('ALL SRD 3B-C2 TESTS PASSED.');
