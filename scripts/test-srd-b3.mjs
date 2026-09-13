import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createServer
} from 'vite';

const root =
  process.cwd();

const vite =
  await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',

    server: {
      middlewareMode: true
    },

    resolve: {
      alias: [
        {
          find: '@',
          replacement: root
        }
      ]
    }
  });

let passed = 0;
let failed = 0;

async function test(
  name,
  fn
) {
  try {
    await fn();

    passed++;

    console.log(
      '[PASS] ' +
      name
    );
  } catch (error) {
    failed++;

    console.error(
      '[FAIL] ' +
      name
    );

    console.error(
      error?.stack ||
      error
    );
  }
}

function makeHero(
  engine,
  id = 'hero'
) {
  const hero =
    engine.newCharacter();

  Object.assign(
    hero,
    {
      id,
      owner:
        'automated-test',

      name:
        'Hero ' +
        id,

      level: 5,

      stats: [
        10,
        10,
        10,
        10,
        10,
        10
      ],

      saves: [],

      hp: 30,
      maxHp: 30,

      conditions: [],

      x: 0,
      y: 0,

      biome:
        'forest',

      exhaustion: 0
    }
  );

  return hero;
}

function makeEnemy(
  id = 'enemy'
) {
  return {
    id,

    name:
      'Goblin de Teste',

    hp: 50,
    maxHp: 50,

    ac: 10,
    attack: 3,
    damage: '1d6',
    initiative: 0,

    x: 2,
    y: 0,

    conditions: [],

    biome:
      'forest'
  };
}

function makeAttackResult(
  targetId,
  options = {}
) {
  return {
    text:
      'Ataque de teste.',

    hit:
      options.hit ??
      true,

    isCrit:
      options.isCrit ??
      false,

    isFumble:
      false,

    d20Roll: 15,
    totalAttack: 20,
    targetAc: 10,

    damage:
      options.damage ??
      5,

    attackerName:
      'Hero',

    targetName:
      'Enemy',

    targetId,

    hpBefore: 50,

    hpAfter:
      50 -
      (
        options.damage ??
        5
      )
  };
}

try {
  const engine =
    await vite.ssrLoadModule(
      '/lib/game-engine.ts'
    );

  const runtime =
    await vite.ssrLoadModule(
      '/lib/srd-spell-runtime.ts'
    );


  /* ==========================================================
     TEMPORARY HP
     ========================================================== */

  await test(
    'PV temporarios absorvem dano antes dos PV reais',
    () => {
      const hero =
        makeHero(
          engine,
          'temp-hp'
        );

      const state =
        engine.initialState();

      state.characters = [
        hero
      ];

      hero.temporaryHp = 10;

      const first =
        runtime
          .applySrdCharacterDamage(
            state,
            hero,
            7
          );

      assert.equal(
        hero.hp,
        30
      );

      assert.equal(
        hero.temporaryHp,
        3
      );

      assert.equal(
        first
          .temporaryHpAbsorbed,
        7
      );

      const second =
        runtime
          .applySrdCharacterDamage(
            state,
            hero,
            8
          );

      assert.equal(
        hero.temporaryHp,
        0
      );

      assert.equal(
        hero.hp,
        25
      );

      assert.equal(
        second.hpDamage,
        5
      );
    }
  );


  /* ==========================================================
     CONCENTRATION FAIL
     ========================================================== */

  await test(
    'Falha de Concentracao encerra efeito e remove condicao',
    () => {
      const caster =
        makeHero(
          engine,
          'conc-fail'
        );

      const ally =
        makeHero(
          engine,
          'conc-ally'
        );

      ally.conditions = [
        'Invisivel'
      ];

      const state =
        engine.initialState();

      state.characters = [
        caster,
        ally
      ];

      state.spellEffects = [
        {
          id:
            'conc-effect',

          spellName:
            'Invisibility',

          casterId:
            caster.id,

          spellLevel: 2,

          concentration:
            true,

          createdRound: 1,

          characterTargetIds: [
            ally.id
          ],

          enemyTargetIds: [],

          appliedConditions: [
            {
              targetType:
                'character',

              targetId:
                ally.id,

              condition:
                'Invisivel'
            }
          ],

          description:
            'test'
        }
      ];

      caster
        .concentrationEffectId =
        'conc-effect';

      const result =
        runtime
          .applySrdCharacterDamage(
            state,
            caster,
            12,
            {
              forcedConcentrationD20:
                1
            }
          );

      assert.equal(
        result
          .concentrationChecked,
        true
      );

      assert.equal(
        result
          .concentrationBroken,
        true
      );

      assert.equal(
        caster
          .concentrationEffectId,
        undefined
      );

      assert.equal(
        state
          .spellEffects
          .length,
        0
      );

      assert.ok(
        !ally.conditions.includes(
          'Invisivel'
        )
      );
    }
  );


  await test(
    'Sucesso de Concentracao mantem efeito',
    () => {
      const caster =
        makeHero(
          engine,
          'conc-pass'
        );

      const state =
        engine.initialState();

      state.characters = [
        caster
      ];

      state.spellEffects = [
        {
          id:
            'conc-pass-effect',

          spellName:
            'Bless',

          casterId:
            caster.id,

          spellLevel: 1,

          concentration:
            true,

          createdRound: 1,

          characterTargetIds: [
            caster.id
          ],

          enemyTargetIds: [],

          appliedConditions: [],

          description:
            'test'
        }
      ];

      caster
        .concentrationEffectId =
        'conc-pass-effect';

      const result =
        runtime
          .applySrdCharacterDamage(
            state,
            caster,
            12,
            {
              forcedConcentrationD20:
                20
            }
          );

      assert.equal(
        result
          .concentrationBroken,
        false
      );

      assert.equal(
        state
          .spellEffects
          .length,
        1
      );

      assert.equal(
        caster
          .concentrationEffectId,
        'conc-pass-effect'
      );
    }
  );


  await test(
    'Concentracao usa CD 10 ou metade do dano',
    () => {
      const caster =
        makeHero(
          engine,
          'conc-dc'
        );

      /*
       * Mantem o personagem consciente depois de 30 de dano
       * para realmente testar a CD de Concentracao:
       * max(10, floor(30 / 2)) = 15.
       */
      caster.hp = 100;
      caster.maxHp = 100;

      const state =
        engine.initialState();

      state.characters = [
        caster
      ];

      state.spellEffects = [
        {
          id:
            'conc-dc-effect',

          spellName:
            'Bless',

          casterId:
            caster.id,

          spellLevel: 1,

          concentration:
            true,

          createdRound: 1,

          characterTargetIds: [],
          enemyTargetIds: [],
          appliedConditions: [],

          description:
            'test'
        }
      ];

      caster
        .concentrationEffectId =
        'conc-dc-effect';

      const result =
        runtime
          .applySrdCharacterDamage(
            state,
            caster,
            30,
            {
              forcedConcentrationD20:
                20
            }
          );

      assert.equal(
        result
          .concentrationDc,
        15
      );
    }
  );


  /* ==========================================================
     BLESS / BANE SAVES
     ========================================================== */

  await test(
    'Bless soma 1d4 em salvaguarda',
    () => {
      const hero =
        makeHero(
          engine,
          'bless-save'
        );

      hero.conditions = [
        'Abencoado (Bless)'
      ];

      const result =
        runtime
          .rollSrdCharacterSavingThrow(
            hero,
            2,
            12,
            {
              forcedD20: 10,
              forcedD4: 2
            }
          );

      assert.equal(
        result.blessBonus,
        2
      );

      assert.equal(
        result.total,
        12
      );

      assert.equal(
        result.saved,
        true
      );
    }
  );


  await test(
    'Bane subtrai 1d4 em salvaguarda',
    () => {
      const hero =
        makeHero(
          engine,
          'bane-save'
        );

      hero.conditions = [
        'Amaldicoado (Bane)'
      ];

      const result =
        runtime
          .rollSrdCharacterSavingThrow(
            hero,
            2,
            10,
            {
              forcedD20: 10,
              forcedD4: 2
            }
          );

      assert.equal(
        result.banePenalty,
        2
      );

      assert.equal(
        result.total,
        8
      );

      assert.equal(
        result.saved,
        false
      );
    }
  );


  /* ==========================================================
     BANE ATTACK ROLL
     ========================================================== */

  await test(
    'Bane reduz attack roll no game-engine',
    () => {
      const result =
        engine.resolveAttack(
          {
            name:
              'Atacante Banido',

            attack: 100,
            damage: '1',

            conditions: [
              'Amaldicoado (Bane)'
            ],

            weapon:
              'Espada'
          },

          {
            id:
              'bane-target',

            name:
              'Alvo',

            ac: 1,
            hp: 20,

            conditions: []
          },

          'normal',
          false
        );

      const noBane =
        result.d20Roll +
        100;

      assert.ok(
        result.totalAttack <
        noBane
      );

      assert.ok(
        result.totalAttack >=
        noBane -
        4
      );
    }
  );


  /* ==========================================================
     HUNTERS MARK OWNERSHIP
     ========================================================== */

  await test(
    "Hunter's Mark pertence ao conjurador correto",
    () => {
      const a =
        makeHero(
          engine,
          'ranger-a'
        );

      const b =
        makeHero(
          engine,
          'ranger-b'
        );

      const enemy =
        makeEnemy(
          'marked-enemy'
        );

      const state =
        engine.initialState();

      state.characters = [
        a,
        b
      ];

      state.enemies = [
        enemy
      ];

      state.spellEffects = [
        {
          id:
            'hunters-mark-effect',

          spellName:
            "Hunter's Mark",

          casterId:
            a.id,

          spellLevel: 1,
          concentration: true,
          createdRound: 1,

          characterTargetIds: [],

          enemyTargetIds: [
            enemy.id
          ],

          appliedConditions: [],

          description:
            'test'
        }
      ];

      const correct =
        makeAttackResult(
          enemy.id
        );

      const extra =
        runtime
          .applySrdMarkedAttackDamage(
            state,
            a.id,
            enemy.id,
            correct
          );

      assert.ok(
        extra >= 1 &&
        extra <= 6
      );

      assert.equal(
        correct.damage,
        5 +
        extra
      );

      const wrongCaster =
        makeAttackResult(
          enemy.id
        );

      const wrongExtra =
        runtime
          .applySrdMarkedAttackDamage(
            state,
            b.id,
            enemy.id,
            wrongCaster
          );

      assert.equal(
        wrongExtra,
        0
      );

      assert.equal(
        wrongCaster.damage,
        5
      );
    }
  );


  await test(
    'Hex tambem pertence ao conjurador correto',
    () => {
      const caster =
        makeHero(
          engine,
          'warlock'
        );

      const other =
        makeHero(
          engine,
          'other-warlock'
        );

      const enemy =
        makeEnemy(
          'hex-enemy'
        );

      const state =
        engine.initialState();

      state.characters = [
        caster,
        other
      ];

      state.enemies = [
        enemy
      ];

      state.spellEffects = [
        {
          id:
            'hex-effect',

          spellName:
            'Hex',

          casterId:
            caster.id,

          spellLevel: 1,
          concentration: true,
          createdRound: 1,

          characterTargetIds: [],

          enemyTargetIds: [
            enemy.id
          ],

          appliedConditions: [],

          description:
            'test'
        }
      ];

      const result =
        makeAttackResult(
          enemy.id
        );

      const extra =
        runtime
          .applySrdMarkedAttackDamage(
            state,
            caster.id,
            enemy.id,
            result
          );

      assert.ok(
        extra >= 1 &&
        extra <= 6
      );

      const otherResult =
        makeAttackResult(
          enemy.id
        );

      assert.equal(
        runtime
          .applySrdMarkedAttackDamage(
            state,
            other.id,
            enemy.id,
            otherResult
          ),
        0
      );
    }
  );


  await test(
    'Critico dobra o dado extra de Mark ou Hex',
    () => {
      const caster =
        makeHero(
          engine,
          'crit-ranger'
        );

      const enemy =
        makeEnemy(
          'crit-enemy'
        );

      const state =
        engine.initialState();

      state.characters = [
        caster
      ];

      state.enemies = [
        enemy
      ];

      state.spellEffects = [
        {
          id:
            'crit-mark',

          spellName:
            "Hunter's Mark",

          casterId:
            caster.id,

          spellLevel: 1,
          concentration: true,
          createdRound: 1,

          characterTargetIds: [],

          enemyTargetIds: [
            enemy.id
          ],

          appliedConditions: [],

          description:
            'test'
        }
      ];

      const result =
        makeAttackResult(
          enemy.id,
          {
            isCrit: true
          }
        );

      const extra =
        runtime
          .applySrdMarkedAttackDamage(
            state,
            caster.id,
            enemy.id,
            result
          );

      assert.ok(
        extra >= 2 &&
        extra <= 12
      );
    }
  );


  /* ==========================================================
     ROUTE INTEGRATION
     ========================================================== */

  await test(
    'Route usa dano autoritativo nos ataques contra personagens',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'app/api/game/route.ts'
          ),
          'utf8'
        );

      assert.ok(
        source.includes(
          'function applyAuthoritativeCharacterDamage('
        )
      );

      assert.ok(
        source.includes(
          'SRD_3B_B3_SPECIAL_DAMAGE'
        )
      );

      assert.ok(
        source.includes(
          'SRD_3B_B3_MOVE_DAMAGE'
        )
      );

      assert.ok(
        source.includes(
          'SRD_3B_B3_SPECIAL_SAVE'
        )
      );
    }
  );


  await test(
    'Shield exige magia preparada e expira no turno seguinte',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'app/api/game/route.ts'
          ),
          'utf8'
        );

      assert.ok(
        source.includes(
          "isCharacterSpellPrepared(\n      target,\n      'Shield'"
        )
      );

      const advancePos =
        source.indexOf(
          'function advance('
        );

      assert.ok(
        advancePos >= 0
      );

      const advanceBlock =
        source.slice(
          advancePos,
          advancePos +
          9000
        );

      assert.ok(
        advanceBlock.includes(
          'escudo arcano'
        )
      );
    }
  );

} finally {
  await vite.close();
}

console.log('');
console.log('============================================');
console.log(' SRD 3B-B3 AUTOMATED TEST REPORT');
console.log('============================================');
console.log('');
console.log(
  'PASS:',
  passed
);
console.log(
  'FAIL:',
  failed
);

if (
  failed > 0
) {
  process.exit(1);
}

console.log('');
console.log(
  'ALL SRD 3B-B3 TESTS PASSED.'
);
