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

  const campaign =
    await vite.ssrLoadModule(
      '/lib/campaign-progression.ts'
    );

  const progression =
    await vite.ssrLoadModule(
      '/lib/mmo-progression.ts'
    );

  const world =
    await vite.ssrLoadModule(
      '/lib/world-spine.ts'
    );

  const travel =
    await vite.ssrLoadModule(
      '/lib/world-travel.ts'
    );

  const activities =
    await vite.ssrLoadModule(
      '/lib/activity-service.ts'
    );

  const merge =
    await vite.ssrLoadModule(
      '/lib/state-merge.ts'
    );

  const inventory =
    await vite.ssrLoadModule(
      '/lib/inventory-utils.ts'
    );

  function makeHero(
    id = 'hero-polish-b'
  ) {
    const hero =
      engine.newCharacter();

    Object.assign(
      hero,
      {
        id,
        owner:
          'polish-b-user',
        name:
          'Hero Polish B',
        location: 0,
        biome:
          'village',
        questProgress:
          {},
        worldFlags:
          {},
        campaignProof:
          {},
        campaignProofVersion:
          campaign.CAMPAIGN_PROOF_VERSION,
        updatedAt:
          Date.now()
      }
    );

    return hero;
  }

  await test(
    'World Spine cria autoridade e escopo canônico',
    () => {
      const state =
        engine.initialState();

      const hero =
        makeHero();

      state.characters = [
        hero
      ];

      world.ensureWorldSpine(
        state
      );

      assert.equal(
        state.worldSchemaVersion,
        world.WORLD_SCHEMA_VERSION
      );

      assert.ok(
        state.activities
      );

      assert.equal(
        world.getHeroScopeKey(
          hero
        ),
        'hero:' +
          hero.id
      );

      assert.equal(
        world.getCanonicalActForLocation(
          0
        ),
        1
      );

      assert.equal(
        world.getCanonicalActForLocation(
          2
        ),
        2
      );

      assert.equal(
        world.getCanonicalActForLocation(
          5
        ),
        3
      );
    }
  );

  await test(
    'Viagem não concede progresso de campanha e respeita proof',
    () => {
      const state =
        engine.initialState();

      const hero =
        makeHero(
          'hero-travel'
        );

      state.characters = [
        hero
      ];

      let result =
        travel
          .travelPartyToLocation(
            state,
            hero,
            1,
            {
              isMmo: true
            }
          );

      assert.equal(
        result.success,
        false
      );

      campaign
        .markCampaignProof(
          state,
          hero,
          'doran_talked'
        );

      campaign
        .markCampaignProof(
          state,
          hero,
          'elenor_talked'
        );

      campaign
        .markCampaignProof(
          state,
          hero,
          'kaelen_talked'
        );

      result =
        travel
          .travelPartyToLocation(
            state,
            hero,
            1,
            {
              isMmo: true
            }
          );

      assert.equal(
        result.success,
        true
      );

      assert.equal(
        hero.location,
        1
      );

      assert.equal(
        hero.biome,
        'forest'
      );

      assert.equal(
        hero.act,
        1
      );

      assert.equal(
        Boolean(
          hero
            .campaignProof
            ?.forest_cleared
        ),
        false
      );

      assert.ok(
        result.spawned.length >
          0
      );

      const max =
        7;

      for (
        const enemy of
        result.spawned
      ) {
        assert.ok(
          enemy.x >= 0 &&
          enemy.x <= max
        );

        assert.ok(
          enemy.y >= 0 &&
          enemy.y <= max
        );
      }
    }
  );

  await test(
    'Jornada completa usa a mesma progressão canônica',
    () => {
      const state =
        engine.initialState();

      const hero =
        makeHero(
          'hero-journey'
        );

      state.characters = [
        hero
      ];

      for (
        const key of
        [
          'doran_talked',
          'elenor_talked',
          'kaelen_talked'
        ]
      ) {
        campaign
          .markCampaignProof(
            state,
            hero,
            key
          );
      }

      const clearRegion =
        (
          location,
          expectedProof
        ) => {
          const moved =
            travel
              .travelPartyToLocation(
                state,
                hero,
                location,
                {
                  isMmo: true
                }
              );

          assert.equal(
            moved.success,
            true
          );

          assert.ok(
            moved.spawned.length >
              0
          );

          for (
            const enemy of
            moved.spawned
          ) {
            enemy.hp = 0;
          }

          const defeated =
            moved.spawned[
              moved.spawned
                .length - 1
            ];

          progression
            .resolveEnemyDefeatProgression(
              state,
              hero,
              defeated
            );

          assert.equal(
            Boolean(
              hero.campaignProof?.[
                expectedProof
              ]
            ),
            true,
            expectedProof
          );
        };

      clearRegion(
        1,
        'forest_cleared'
      );

      clearRegion(
        2,
        'ruins_cleared'
      );

      clearRegion(
        3,
        'malakor_defeated'
      );

      clearRegion(
        4,
        'canyon_cleared'
      );

      clearRegion(
        5,
        'ignisrax_defeated'
      );

      assert.equal(
        hero
          .questProgress
          ?.campaign_completed,
        true
      );

      assert.equal(
        hero
          .worldFlags
          ?.endgame_unlocked,
        true
      );
    }
  );

  await test(
    'Dungeon vira Activity persistida e extração entrega loot',
    () => {
      const state =
        engine.initialState();

      const hero =
        makeHero(
          'hero-dungeon'
        );

      state.characters = [
        hero
      ];

      const expedition = {
        expeditionId:
          'expedition-polish-b',
        seed: 123,
        mode: 'solo',
        partyIds: [
          hero.id
        ],
        currentFloor: 2,
        maxFloorReached: 2,
        status:
          'exploring',
        accumulatedLoot: {
          gold: 120,
          xp: 80,
          items: [
            {
              id:
                'polish-b-relic',
              name:
                'Relíquia Polish B',
              type:
                'anel',
              rarity:
                'raro',
              description:
                'Relíquia persistente.',
              value: 500,
              weight: 0.1,
              acBonus: 1
            }
          ]
        },
        floorHistory: {
          1: {
            floorNumber: 1
          },
          2: {
            floorNumber: 2
          }
        }
      };

      const activity =
        activities
          .syncDungeonActivity(
            state,
            hero,
            expedition
          );

      assert.equal(
        activity.type,
        'dungeon'
      );

      assert.equal(
        hero.activeActivityId,
        activity.id
      );

      const result =
        activities
          .extractDungeonActivity(
            state,
            hero
          );

      assert.equal(
        result.gold,
        120
      );

      assert.equal(
        result.xp,
        80
      );

      assert.ok(
        hero.inventory.includes(
          'Relíquia Polish B'
        )
      );

      assert.ok(
        hero
          .inventoryItemData
          ?.[
            'polish-b-relic'
          ]
      );

      assert.equal(
        hero.activeActivityId,
        undefined
      );
    }
  );

  await test(
    'Merge concorrente preserva personagens, NPC e flags',
    () => {
      const base =
        engine.initialState();

      const incoming =
        engine.initialState();

      const heroA =
        makeHero('a');

      const heroB =
        makeHero('b');

      heroA.updatedAt =
        100;

      heroB.updatedAt =
        200;

      base.characters = [
        {
          ...heroA,
          hp: 10,
          updatedAt: 100
        },
        {
          ...heroB,
          hp: 20,
          updatedAt: 200
        }
      ];

      incoming.characters = [
        {
          ...heroA,
          hp: 30,
          updatedAt: 300
        },
        {
          ...heroB,
          hp: 1,
          updatedAt: 50
        }
      ];

      base.worldFlags = {
        bridge_cleared:
          true
      };

      incoming.worldFlags = {
        canyon_secured:
          true
      };

      base.npcs = [
        {
          id: 'npc',
          name: 'NPC',
          role: 'Test',
          description: '',
          lastInteractionAt:
            100,
          memories: [
            {
              timestamp: 100,
              summary:
                'mem base'
            }
          ]
        }
      ];

      incoming.npcs = [
        {
          id: 'npc',
          name: 'NPC',
          role: 'Test',
          description: '',
          lastInteractionAt:
            200,
          memories: [
            {
              timestamp: 200,
              summary:
                'mem incoming'
            }
          ]
        }
      ];

      const merged =
        merge.mergeStates(
          base,
          incoming,
          10,
          9
        );

      assert.equal(
        merged.characters.find(
          (character) =>
            character.id ===
            'a'
        )?.hp,
        30
      );

      assert.equal(
        merged.characters.find(
          (character) =>
            character.id ===
            'b'
        )?.hp,
        20
      );

      assert.equal(
        merged
          .worldFlags
          ?.bridge_cleared,
        true
      );

      assert.equal(
        merged
          .worldFlags
          ?.canyon_secured,
        true
      );

      assert.equal(
        merged.npcs[0]
          .memories
          ?.length,
        2
      );
    }
  );

  await test(
    'Inventário aceita formato legado xN e usa serialização única',
    () => {
      const stacks =
        inventory
          .parseInventoryStacks(
            'Poção de Cura (x3)\nPoção de Cura (2)'
          );

      assert.equal(
        stacks.length,
        1
      );

      assert.equal(
        stacks[0].quantity,
        5
      );

      const text =
        inventory
          .formatInventoryStacks(
            stacks
          );

      assert.equal(
        text,
        'Poção de Cura (5)'
      );
    }
  );

  await test(
    'Route usa viagem, derrota e merge canônicos',
    () => {
      const src =
        fs.readFileSync(
          path.join(
            root,
            'app/api/game/route.ts'
          ),
          'utf8'
        );

      assert.ok(
        src.includes(
          'travelPartyToLocation'
        )
      );

      assert.ok(
        src.includes(
          'mergeStates('
        )
      );

      assert.ok(
        src.includes(
          "case 'syncDungeonActivity':"
        )
      );

      assert.ok(
        src.includes(
          "case 'extractDungeonActivity':"
        )
      );

      assert.ok(
        src.includes(
          "rewardSrdEnemyDefeat(\n            p,\n            target,\n            'Ataque'"
        ) ||
        src.includes(
          "rewardSrdEnemyDefeat(p, target, 'Ataque'"
        )
      );

      assert.ok(
        !src.includes(
          'member.act = (n + 1) as 1 | 2 | 3'
        )
      );

      assert.ok(
        !src.includes(
          "recordProgression(p, { doran_talked: true })"
        )
      );

      assert.ok(
        !src.includes(
          'Math.min(\n                        15,\n                        hero.x + 4'
        )
      );
    }
  );

  await test(
    'CampaignTracker cobre toda a campanha até endgame',
    () => {
      const src =
        fs.readFileSync(
          path.join(
            root,
            'components/game/campaign-tracker.tsx'
          ),
          'utf8'
        );

      assert.ok(
        src.includes(
          'travel_ruins'
        )
      );

      assert.ok(
        src.includes(
          'travel_canyon'
        )
      );

      assert.ok(
        src.includes(
          'travel_lair'
        )
      );

      assert.ok(
        src.includes(
          'Epilogo'
        ) ||
        src.includes(
          'Epílogo'
        )
      );
    }
  );

  await test(
    'Realtime autoritativo usa SSE autenticado sem WS nativo aberto',
    () => {
      const stream =
        fs.readFileSync(
          path.join(
            root,
            'app/api/game/stream/route.ts'
          ),
          'utf8'
        );

      const server =
        fs.readFileSync(
          path.join(
            root,
            'server.mjs'
          ),
          'utf8'
        );

      const game =
        fs.readFileSync(
          path.join(
            root,
            'app/game.tsx'
          ),
          'utf8'
        );

      const events =
        fs.readFileSync(
          path.join(
            root,
            'lib/room-events.ts'
          ),
          'utf8'
        );

      assert.ok(
        stream.includes(
          'getChatGPTUser'
        )
      );

      assert.ok(
        stream.includes(
          'JOIN members'
        ) ||
        stream.includes(
          'FROM members'
        )
      );

      assert.ok(
        !server.includes(
          "app.get('/api/game/stream'"
        )
      );

      assert.ok(
        server.includes(
          'POLISH_B_WS_DISABLED'
        )
      );

      assert.ok(
        !game.includes(
          '\n    connectWs();\n'
        )
      );

      assert.ok(
        !events.includes(
          'room:mmo-world-village:all'
        )
      );
    }
  );

  await test(
    'GM procedural loot persiste definição do item',
    () => {
      const gm =
        fs.readFileSync(
          path.join(
            root,
            'app/api/gm/route.ts'
          ),
          'utf8'
        );

      const tools =
        fs.readFileSync(
          path.join(
            root,
            'lib/gm-tools.ts'
          ),
          'utf8'
        );

      assert.ok(
        gm.includes(
          'itemData'
        )
      );

      assert.ok(
        tools.includes(
          'inventoryItemData'
        )
      );
    }
  );

  await test(
    'Dungeon client sincroniza, restaura e extrai atividade pelo servidor',
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
          "action: 'syncDungeonActivity'"
        )
      );

      assert.ok(
        src.includes(
          "action: 'extractDungeonActivity'"
        )
      );

      assert.ok(
        src.includes(
          'activeActivityId'
        )
      );
    }
  );

} finally {
  await vite.close();
}

console.log('');
console.log('============================================');
console.log(' POLISH-B WORLD SPINE TEST REPORT');
console.log('============================================');
console.log('');
console.log('PASS:', passed);
console.log('FAIL:', failed);

if (failed > 0) {
  process.exit(1);
}

console.log('');
console.log('POLISH-B: WORLD SPINE VERDE.');
