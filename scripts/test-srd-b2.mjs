
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

  function hudSpell(
    name
  ) {
    const spell =
      spellbook.findSrdSpell(
        name
      );

    assert.ok(
      spell,
      'Spell missing: ' +
      name
    );

    return spellbook.toHudSpell(
      spell
    );
  }

  function makeCaster(
    spellNames
  ) {
    const caster =
      engine.newCharacter();

    const cantrips = [];
    const prepared = [];

    for (
      const name of
      spellNames
    ) {
      const spell =
        spellbook.findSrdSpell(
          name
        );

      assert.ok(spell);

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
          'b2-caster',

        owner:
          'test',

        name:
          'B2 Caster',

        className:
          'Mago',

        level: 10,

        stats: [
          12,
          14,
          14,
          18,
          16,
          16
        ],

        spellAbility: 3,

        hp: 50,
        maxHp: 50,

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

        spells:
          [
            ...cantrips,
            ...prepared
          ].join('\n'),

        spellSelectionVersion:
          1,

        conditions: [],

        x: 0,
        y: 0,

        biome:
          'forest'
      }
    );

    return caster;
  }

  function enemy(
    id,
    x,
    y
  ) {
    return {
      id,
      name:
        'Goblin B2 ' +
        id,

      hp: 100,
      maxHp: 100,

      ac: 10,
      attack: 2,
      damage: '1d4',
      initiative: 0,

      x,
      y,

      conditions: [],

      biome:
        'forest'
    };
  }

  function stateOf(
    caster,
    enemies = []
  ) {
    const state =
      engine.initialState();

    state.characters = [
      caster
    ];

    state.enemies =
      enemies;

    state.biome =
      'forest';

    state.combat =
      true;

    state.round = 1;
    state.turn = 0;

    state.order = [
      caster.id,
      ...enemies.map(
        (entry) =>
          entry.id
      )
    ];

    state.spellEffects =
      [];

    return state;
  }


  /* ==========================================================
     ECONOMY
     ========================================================== */

  await test(
    'Healing Word = Bonus Action',
    () => {
      assert.equal(
        hudSpell(
          'Healing Word'
        ).economyType,
        'bonus'
      );
    }
  );

  await test(
    'Shield = Reaction',
    () => {
      assert.equal(
        hudSpell(
          'Shield'
        ).economyType,
        'reaction'
      );
    }
  );

  await test(
    'Fireball = Action',
    () => {
      assert.equal(
        hudSpell(
          'Fireball'
        ).economyType,
        'action'
      );
    }
  );


  /* ==========================================================
     TARGET MODES
     ========================================================== */

  await test(
    'Fireball targets area point',
    () => {
      assert.equal(
        hudSpell(
          'Fireball'
        ).targetMode,
        'area'
      );
    }
  );

  await test(
    'Misty Step targets destination point',
    () => {
      assert.equal(
        hudSpell(
          'Misty Step'
        ).targetMode,
        'point'
      );
    }
  );

  await test(
    'Cure Wounds targets ally',
    () => {
      assert.equal(
        hudSpell(
          'Cure Wounds'
        ).targetMode,
        'ally'
      );
    }
  );

  await test(
    'Detect Magic targets self',
    () => {
      assert.equal(
        hudSpell(
          'Detect Magic'
        ).targetMode,
        'self'
      );
    }
  );


  /* ==========================================================
     FIREBALL EMPTY-SQUARE CENTER
     ========================================================== */

  await test(
    'Fireball resolves from targetX/targetY without targetId',
    () => {
      const caster =
        makeCaster([
          'Fireball'
        ]);

      const e1 =
        enemy(
          'area-1',
          5,
          5
        );

      const e2 =
        enemy(
          'area-2',
          6,
          5
        );

      const far =
        enemy(
          'area-far',
          14,
          14
        );

      const state =
        stateOf(
          caster,
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

              targetX:
                5,

              targetY:
                5,

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
     MISTY STEP
     ========================================================== */

  await test(
    'Misty Step moves caster to selected square',
    () => {
      const caster =
        makeCaster([
          'Misty Step'
        ]);

      const state =
        stateOf(
          caster
        );

      runtime
        .resolveSrdSpellRuntime(
          state,
          caster,
          {
            spellName:
              'Misty Step',

            spellLevel:
              2,

            targetX:
              3,

            targetY:
              2,

            canOccupy:
              () => true
          }
        );

      assert.equal(
        caster.x,
        3
      );

      assert.equal(
        caster.y,
        2
      );
    }
  );


  /* ==========================================================
     STATIC UI INTEGRATION
     ========================================================== */

  await test(
    'HUD has Action Bonus Reaction SRD filters',
    () => {
      const src =
        fs.readFileSync(
          path.join(
            root,
            'components/game/bottom-player-hud.tsx'
          ),
          'utf8'
        );

      assert.ok(
        src.includes(
          'data-srd-spell-economy'
        )
      );

      assert.ok(
        src.includes(
          'data-srd-bonus-spells'
        )
      );

      assert.ok(
        src.includes(
          'data-srd-reaction-spells'
        )
      );
    }
  );

  await test(
    'HUD exposes concentration and active effects',
    () => {
      const src =
        fs.readFileSync(
          path.join(
            root,
            'components/game/bottom-player-hud.tsx'
          ),
          'utf8'
        );

      assert.ok(
        src.includes(
          'data-srd-active-effects'
        )
      );

      assert.ok(
        src.includes(
          'data-srd-concentration'
        )
      );
    }
  );

  await test(
    'TacticalMap supports hero and square spell targets',
    () => {
      const src =
        fs.readFileSync(
          path.join(
            root,
            'components/game/tactical-map.tsx'
          ),
          'utf8'
        );

      assert.ok(
        src.includes(
          'onTargetHero?:'
        )
      );

      assert.ok(
        src.includes(
          'onTargetSquare?:'
        )
      );

      assert.ok(
        src.includes(
          "targetingAction.targetMode === 'area'"
        )
      );

      assert.ok(
        src.includes(
          "targetingAction.targetMode === 'point'"
        )
      );
    }
  );

  await test(
    'Game sends targetX and targetY',
    () => {
      const src =
        fs.readFileSync(
          path.join(
            root,
            'app/game.tsx'
          ),
          'utf8'
        );

      assert.ok(
        src.includes(
          'const handleExecuteSpellPoint = async'
        )
      );

      assert.ok(
        src.includes(
          'targetX:'
        )
      );

      assert.ok(
        src.includes(
          'targetY:'
        )
      );

      assert.ok(
        src.includes(
          'spellEffects={state?.spellEffects || []}'
        )
      );
    }
  );

} finally {
  await vite.close();
}

console.log('');
console.log('============================================');
console.log(' SRD 3B-B2 AUTOMATED TEST REPORT');
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
  'ALL SRD 3B-B2 TESTS PASSED.'
);
