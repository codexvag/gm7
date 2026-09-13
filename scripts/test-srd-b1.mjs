
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
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
      error &&
      error.stack
        ? error.stack
        : error
    );
  }
}

function freshEnemy(
  id,
  x,
  y,
  hp = 100
) {
  return {
    id,
    name:
      'Goblin de Teste ' +
      id,

    hp,
    maxHp:
      hp,

    ac: 10,
    attack: 2,
    damage: '1d4',
    weapon: 'Adaga',
    initiative: 0,

    x,
    y,

    conditions: [],
    biome: 'forest'
  };
}

try {
  const engine =
    await vite.ssrLoadModule(
      '/lib/game-engine.ts'
    );

  const spellbook =
    await vite.ssrLoadModule(
      '/lib/srd-spellbook.ts'
    );

  const runtime =
    await vite.ssrLoadModule(
      '/lib/srd-spell-runtime.ts'
    );

  const generated =
    await vite.ssrLoadModule(
      '/lib/generated/srd-spells-5-2-1.ts'
    );

  function makeCaster(
    spells,
    options = {}
  ) {
    const caster =
      engine.newCharacter();

    const cantrips = [];
    const prepared = [];

    for (
      const spellName of
      spells
    ) {
      const spell =
        spellbook.findSrdSpell(
          spellName
        );

      assert.ok(
        spell,
        'Magia ausente do catalogo: ' +
        spellName
      );

      if (
        spell.level === 0
      ) {
        cantrips.push(
          spell.name
        );
      } else {
        prepared.push(
          spell.name
        );
      }
    }

    Object.assign(
      caster,
      {
        id:
          options.id ||
          'caster',

        owner:
          'automated-test',

        name:
          options.name ||
          'Mago de Teste',

        className:
          options.className ||
          'Mago',

        level:
          options.level ||
          10,

        stats: [
          14,
          14,
          14,
          18,
          18,
          18
        ],

        spellAbility:
          options.spellAbility ??
          3,

        hp: 50,
        maxHp: 50,
        ac: 15,

        slots: [
          4,
          3,
          3,
          3,
          2,
          1,
          0,
          0,
          0
        ],

        usedSlots: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ],

        knownCantrips:
          cantrips,

        preparedSpells:
          prepared,

        spellbook: [
          ...cantrips,
          ...prepared
        ],

        spellSelectionVersion:
          1,

        spells:
          [
            ...cantrips,
            ...prepared
          ].join('\n'),

        conditions: [],

        x:
          options.x ??
          0,

        y:
          options.y ??
          0,

        biome:
          'forest'
      }
    );

    return caster;
  }

  function makeState(
    characters,
    enemies = []
  ) {
    const state =
      engine.initialState();

    state.characters =
      characters;

    state.enemies =
      enemies;

    state.biome =
      'forest';

    state.combat =
      true;

    state.round =
      1;

    state.turn =
      0;

    state.order =
      [
        ...characters.map(
          (character) =>
            character.id
        ),

        ...enemies.map(
          (enemy) =>
            enemy.id
        )
      ];

    state.actionUsed =
      false;

    state.bonusActionUsed =
      false;

    state.reactionUsedBy =
      {};

    state.spellSlotUsedThisTurn =
      false;

    state.spellEffects =
      [];

    return state;
  }


  /* ==========================================================
     CATALOGO
     ========================================================== */

  await test(
    'Catalogo possui exatamente 339 magias SRD',
    () => {
      assert.equal(
        generated
          .SRD_SPELL_DATA
          .length,
        339
      );
    }
  );


  await test(
    'Fireball existe no catalogo',
    () => {
      assert.ok(
        spellbook.findSrdSpell(
          'Fireball'
        )
      );
    }
  );


  await test(
    'Healing Word e Bonus Action',
    () => {
      const profile =
        runtime
          .getSrdRuntimeSpellProfile(
            'Healing Word'
          );

      assert.ok(profile);

      assert.equal(
        profile.economy,
        'bonus'
      );
    }
  );


  await test(
    'Shield e Reaction',
    () => {
      const profile =
        runtime
          .getSrdRuntimeSpellProfile(
            'Shield'
          );

      assert.ok(profile);

      assert.equal(
        profile.economy,
        'reaction'
      );
    }
  );


  await test(
    'Detect Magic continua Ritual',
    () => {
      const profile =
        runtime
          .getSrdRuntimeSpellProfile(
            'Detect Magic'
          );

      assert.ok(profile);

      assert.equal(
        profile.ritual,
        true
      );
    }
  );


  /* ==========================================================
     FIREBALL
     ========================================================== */

  await test(
    'Fireball causa dano em area',
    () => {
      const caster =
        makeCaster([
          'Fireball'
        ]);

      const e1 =
        freshEnemy(
          'fireball-1',
          4,
          0
        );

      const e2 =
        freshEnemy(
          'fireball-2',
          5,
          1
        );

      const far =
        freshEnemy(
          'fireball-far',
          15,
          0
        );

      const state =
        makeState(
          [caster],
          [
            e1,
            e2,
            far
          ]
        );

      const result =
        runtime
          .resolveSrdSpellRuntime(
            state,
            caster,
            {
              spellName:
                'Fireball',

              spellLevel:
                3,

              targetId:
                e1.id,

              canOccupy:
                () => true
            }
          );

      assert.ok(
        result
          .affectedEnemyIds
          .includes(
            e1.id
          )
      );

      assert.ok(
        result
          .affectedEnemyIds
          .includes(
            e2.id
          )
      );

      assert.ok(
        !result
          .affectedEnemyIds
          .includes(
            far.id
          )
      );

      assert.ok(
        e1.hp < 100
      );

      assert.ok(
        e2.hp < 100
      );

      assert.equal(
        far.hp,
        100
      );
    }
  );


  /* ==========================================================
     HEALING WORD
     ========================================================== */

  await test(
    'Healing Word cura alvo aliado',
    () => {
      const caster =
        makeCaster(
          [
            'Healing Word'
          ],
          {
            className:
              'Bardo',

            spellAbility:
              5
          }
        );

      const ally =
        makeCaster(
          [],
          {
            id:
              'ally-heal',

            name:
              'Aliado Ferido',

            x: 1,
            y: 0
          }
        );

      ally.hp = 5;
      ally.maxHp = 40;

      const state =
        makeState(
          [
            caster,
            ally
          ]
        );

      const result =
        runtime
          .resolveSrdSpellRuntime(
            state,
            caster,
            {
              spellName:
                'Healing Word',

              spellLevel:
                1,

              targetId:
                ally.id
            }
          );

      assert.equal(
        result.economy,
        'bonus'
      );

      assert.ok(
        result.healResult
      );

      assert.ok(
        result
          .healResult
          .healAmount >
          0
      );

      assert.ok(
        ally.hp > 5
      );
    }
  );


  /* ==========================================================
     CONCENTRACAO
     ========================================================== */

  await test(
    'Invisibility cria efeito de concentracao',
    () => {
      const caster =
        makeCaster([
          'Invisibility'
        ]);

      const ally =
        makeCaster(
          [],
          {
            id:
              'ally-invisible',

            x: 1,
            y: 0
          }
        );

      const state =
        makeState(
          [
            caster,
            ally
          ]
        );

      const result =
        runtime
          .resolveSrdSpellRuntime(
            state,
            caster,
            {
              spellName:
                'Invisibility',

              spellLevel:
                2,

              targetId:
                ally.id
            }
          );

      assert.ok(
        result
          .activeEffectIds
          .length >
          0
      );

      assert.ok(
        caster
          .concentrationEffectId
      );

      assert.ok(
        ally.conditions.includes(
          'Invisivel'
        )
      );
    }
  );


  await test(
    'Nova concentracao encerra a anterior',
    () => {
      const caster =
        makeCaster([
          'Invisibility',
          'Fly'
        ]);

      const ally =
        makeCaster(
          [],
          {
            id:
              'ally-concentration',

            x: 1,
            y: 0
          }
        );

      const state =
        makeState(
          [
            caster,
            ally
          ]
        );

      runtime
        .resolveSrdSpellRuntime(
          state,
          caster,
          {
            spellName:
              'Invisibility',

            spellLevel:
              2,

            targetId:
              ally.id
          }
        );

      const firstEffect =
        caster
          .concentrationEffectId;

      assert.ok(
        firstEffect
      );

      assert.ok(
        ally.conditions.includes(
          'Invisivel'
        )
      );

      runtime
        .resolveSrdSpellRuntime(
          state,
          caster,
          {
            spellName:
              'Fly',

            spellLevel:
              3,

            targetId:
              caster.id
          }
        );

      assert.ok(
        caster
          .concentrationEffectId
      );

      assert.notEqual(
        caster
          .concentrationEffectId,
        firstEffect
      );

      assert.ok(
        !state
          .spellEffects
          .some(
            (effect) =>
              effect.id ===
              firstEffect
          )
      );

      assert.ok(
        !ally.conditions.includes(
          'Invisivel'
        )
      );
    }
  );


  /* ==========================================================
     HOLD PERSON
     Como a salvaguarda e aleatoria, repetimos estados isolados
     ate observar uma falha legitima.
     ========================================================== */

  await test(
    'Hold Person pode aplicar Paralisado em falha de salvaguarda',
    () => {
      let paralyzed =
        false;

      for (
        let attempt = 0;
        attempt < 40;
        attempt++
      ) {
        const caster =
          makeCaster([
            'Hold Person'
          ]);

        const enemy =
          freshEnemy(
            'hold-' +
              attempt,
            3,
            0,
            50
          );

        const state =
          makeState(
            [caster],
            [enemy]
          );

        runtime
          .resolveSrdSpellRuntime(
            state,
            caster,
            {
              spellName:
                'Hold Person',

              spellLevel:
                2,

              targetId:
                enemy.id
            }
          );

        if (
          enemy.conditions.includes(
            'Paralisado'
          )
        ) {
          paralyzed =
            true;

          break;
        }
      }

      assert.equal(
        paralyzed,
        true,
        'Nenhuma das 40 tentativas aplicou Paralisado.'
      );
    }
  );


  /* ==========================================================
     MAGIA ABERTA / NARRATIVA
     ========================================================== */

  await test(
    'Detect Magic nunca retorna nao implementada',
    () => {
      const caster =
        makeCaster([
          'Detect Magic'
        ]);

      const state =
        makeState(
          [caster]
        );

      const result =
        runtime
          .resolveSrdSpellRuntime(
            state,
            caster,
            {
              spellName:
                'Detect Magic',

              spellLevel:
                1,

              targetId:
                caster.id
            }
          );

      assert.equal(
        result
          .requiresAdjudication,
        true
      );

      assert.ok(
        result.logs.length >
        0
      );

      assert.ok(
        result
          .activeEffectIds
          .length >
          0
      );
    }
  );


  /* ==========================================================
     LEGACY SPECIAL OVERRIDE
     ========================================================== */

  await test(
    'Fire Bolt continua usando resolver especial legado',
    () => {
      const caster =
        makeCaster([
          'Fire Bolt'
        ]);

      const enemy =
        freshEnemy(
          'firebolt-target',
          4,
          0
        );

      const state =
        makeState(
          [caster],
          [enemy]
        );

      const result =
        runtime
          .resolveSrdSpellRuntime(
            state,
            caster,
            {
              spellName:
                'Fire Bolt',

              targetId:
                enemy.id,

              canOccupy:
                () => true
            }
          );

      assert.ok(
        result.attackResult
      );

      assert.equal(
        result
          .requiresAdjudication,
        false
      );
    }
  );


  /* ==========================================================
     EXPIRACAO DE EFEITO
     ========================================================== */

  await test(
    'tickSrdSpellEffects remove efeito expirado',
    () => {
      const caster =
        makeCaster([]);

      const ally =
        makeCaster(
          [],
          {
            id:
              'expiry-ally'
          }
        );

      ally.conditions.push(
        'Condicao de Teste'
      );

      const state =
        makeState(
          [
            caster,
            ally
          ]
        );

      state.round = 5;

      state.spellEffects = [
        {
          id:
            'expired-effect',

          spellName:
            'Test Spell',

          casterId:
            caster.id,

          spellLevel:
            1,

          concentration:
            false,

          createdRound:
            1,

          expiresAtRound:
            5,

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
                'Condicao de Teste'
            }
          ],

          description:
            'Automated test'
        }
      ];

      runtime
        .tickSrdSpellEffects(
          state
        );

      assert.equal(
        state
          .spellEffects
          .length,
        0
      );

      assert.ok(
        !ally.conditions.includes(
          'Condicao de Teste'
        )
      );
    }
  );


  /* ==========================================================
     ROUTE INTEGRATION STATIC CHECK
     ========================================================== */

  await test(
    'API usa resolvedor universal',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'app/api/game/route.ts'
          ),
          'utf8'
        );

      const start =
        source.indexOf(
          "case 'spell': {"
        );

      const end =
        source.indexOf(
          "case 'useItem': {",
          start
        );

      assert.ok(
        start >= 0 &&
        end > start
      );

      const block =
        source.slice(
          start,
          end
        );

      verifySrdB1C1UniversalChain(block);

      assert.ok(
        !block.includes(
          'Magia ainda nao implementada'
        )
      );

      assert.ok(
        !block.includes(
          'Magia ainda n?o implementada'
        )
      );
    }
  );


} finally {
  await vite.close();
}

console.log('');
console.log('============================================');
console.log(' SRD 3B-B1 AUTOMATED TEST REPORT');
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
  console.error('');
  console.error(
    'AUTOMATED TESTS FAILED.'
  );

  process.exit(1);
}

console.log('');
console.log(
  'ALL SRD 3B-B1 TESTS PASSED.'
);

/* SRD_3B_B1_C1_UNIVERSAL_CHAIN_HELPER */
import b1c1Assert from 'node:assert/strict';
import { readFileSync as b1c1Read } from 'node:fs';
import { join as b1c1Join } from 'node:path';
import { stripTypeScriptTypes as b1c1StripTypes } from 'node:module';
import { runInNewContext as b1c1Run } from 'node:vm';

function verifySrdB1C1UniversalChain(block) {
  b1c1Assert.match(
    block,
    /\bresolveSrdSpellWithAdvancedDamage\s*\(/,
    'O case spell deve chamar o resolvedor C1.'
  );

  const source = b1c1Read(b1c1Join(process.cwd(), 'lib/srd-advanced-combat.ts'), 'utf8');
  b1c1Assert.match(
    source,
    /import\s*\{[^}]*\bresolveSrdSpellRuntime\b[^}]*\}\s*from\s*['"]\.\/srd-spell-runtime['"]/,
    'C1 deve importar o resolvedor universal de srd-spell-runtime.'
  );

  // Run the real C1 function body with a spy for the universal resolver.
  // This verifies fallback delegation; the other B1 cases test spell behavior.
  const signature = 'export function resolveSrdSpellWithAdvancedDamage(';
  const start = source.indexOf(signature);
  b1c1Assert.ok(start >= 0, 'Funcao C1 nao encontrada.');
  const nextExport = source.indexOf('\nexport ', start + signature.length);
  const isolated = source.slice(start, nextExport < 0 ? source.length : nextExport)
    .replace(/^export\s+/, '').trim();
  const executable = b1c1StripTypes(isolated);

  const state = { enemies: [] };
  const caster = { id: 'b1-c1-caster' };
  const args = { spellName: 'Healing Word', spellLevel: 1 };
  const sentinel = { implemented: true, affectedEnemyIds: [], defeatedEnemyIds: [] };
  const calls = [];
  const result = b1c1Run('(' + executable + ')(state, caster, args)', {
    state, caster, args,
    tryResolveAdvancedSrdSpell: () => null,
    resolveSrdSpellRuntime: (...received) => { calls.push(received); return sentinel; },
    inferSrdSpellDamageType: () => undefined,
    unique: (values) => [...new Set(values)]
  }, { timeout: 1000, filename: 'srd-b1-c1-universal-chain.js' });

  b1c1Assert.equal(calls.length, 1, 'C1 deve chamar o universal uma vez quando nao ha resolucao avancada.');
  b1c1Assert.strictEqual(calls[0][0], state, 'O estado deve chegar intacto ao universal.');
  b1c1Assert.strictEqual(calls[0][1], caster, 'O conjurador deve chegar intacto ao universal.');
  b1c1Assert.strictEqual(calls[0][2], args, 'Os argumentos devem chegar intactos ao universal.');
  b1c1Assert.strictEqual(result, sentinel, 'C1 deve retornar a resolucao universal.');
}
