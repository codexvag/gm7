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

  const inventory =
    await vite.ssrLoadModule(
      '/lib/equipment-inventory.ts'
    );

  const bounds =
    await vite.ssrLoadModule(
      '/lib/map-bounds.ts'
    );

  const npcLife =
    await vite.ssrLoadModule(
      '/lib/npc-life.ts'
    );


  await test(
    'Starter gear equipado nao fica duplicado na mochila',
    () => {
      const hero =
        engine.newCharacter();

      assert.equal(
        hero
          .equipmentInventoryVersion,
        2
      );

      assert.ok(
        !hero.inventory.includes(
          'Espada Longa'
        )
      );

      assert.ok(
        !hero.inventory.includes(
          'Cota de Malha'
        )
      );

      assert.ok(
        !hero.inventory.includes(
          'Escudo de Carvalho'
        )
      );
    }
  );


  await test(
    'Desequipar devolve item para mochila',
    () => {
      const hero =
        engine.newCharacter();

      hero.id =
        'unequip-test';

      const updated =
        inventory
          .unequipInventorySlot(
            hero,
            'mainHand'
          );

      assert.equal(
        updated.equipment
          ?.mainHand,
        undefined
      );

      assert.ok(
        updated.inventory.includes(
          'Espada Longa'
        )
      );
    }
  );


  await test(
    'Equipar remove item da mochila',
    () => {
      let hero =
        engine.newCharacter();

      hero =
        inventory
          .unequipInventorySlot(
            hero,
            'mainHand'
          );

      const sword =
        engine.ITEMS_CATALOG[
          'espada-longa'
        ];

      const updated =
        inventory
          .equipInventoryItem(
            hero,
            sword
          );

      assert.equal(
        updated.equipment
          ?.mainHand,
        'espada-longa'
      );

      assert.ok(
        !updated.inventory.includes(
          'Espada Longa'
        )
      );
    }
  );


  await test(
    'Anel e acessorio usam slot de acessorio',
    () => {
      assert.equal(
        inventory
          .getEquipSlotForItem({
            id: 'ring-test',
            name: 'Anel de Teste',
            type: 'anel',
            rarity: 'comum',
            description: '',
            weight: 0,
            value: 1
          }),
        'accessory'
      );
    }
  );


  await test(
    'Escudo procedural legado tipo geral continua equipavel',
    () => {
      assert.equal(
        inventory
          .getEquipSlotForItem({
            id:
              'legacy-shield',
            name:
              'Escudo Rúnico',
            type:
              'geral',
            rarity:
              'raro',
            description:
              '',
            weight:
              2,
            value:
              20,
            acBonus:
              2
          }),
        'offHand'
      );
    }
  );


  await test(
    'Item procedural persistido afeta atributos equipado',
    () => {
      const hero =
        engine.newCharacter();

      hero.inventoryItemData = {
        'shield-custom': {
          id:
            'shield-custom',
          name:
            'Escudo Custom',
          type:
            'escudo',
          rarity:
            'raro',
          description:
            '',
          weight:
            2,
          value:
            100,
          acBonus:
            3
        }
      };

      hero.equipment = {
        ...(hero.equipment || {}),
        offHand:
          'shield-custom'
      };

      const result =
        engine
          .calculateEquippedStats(
            hero
          );

      assert.ok(
        Number.isFinite(
          result.ac
        )
      );

      assert.ok(
        result.ac >= 3
      );
    }
  );


  await test(
    'Tamanhos oficiais do canvas sao respeitados',
    () => {
      assert.equal(
        bounds.getBiomeGridSize(
          'forest'
        ),
        8
      );

      assert.equal(
        bounds.getBiomeGridSize(
          'dungeon'
        ),
        8
      );

      assert.equal(
        bounds.getBiomeGridSize(
          'ruins'
        ),
        12
      );

      const clamped =
        bounds.clampGridPoint(
          'forest',
          15,
          15
        );

      assert.equal(
        clamped.x,
        7
      );

      assert.equal(
        clamped.y,
        7
      );
    }
  );


  await test(
    'Enemy AI nao usa mais limite hardcoded 15',
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
        !source.includes(
          'nx > 15'
        )
      );

      assert.ok(
        source.includes(
          'isEnemyStepLegal('
        )
      );

      assert.ok(
        source.includes(
          'normalizeEnemyMapPosition('
        )
      );
    }
  );


  await test(
    'TacticalMap possui clamp visual de inimigos',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'components/game/tactical-map.tsx'
          ),
          'utf8'
        );

      assert.ok(
        source.includes(
          'safeEnemyX'
        )
      );

      assert.ok(
        source.includes(
          'safeEnemyY'
        )
      );
    }
  );


  await test(
    'NPC recebe identidade persistente individual',
    () => {
      const state =
        engine.initialState();

      const doran =
        state.npcs.find(
          (npc) =>
            npc.id ===
            'doran'
        );

      assert.ok(
        doran
      );

      npcLife
        .enrichNpcIdentity(
          doran,
          state
        );

      assert.ok(
        doran.personality
      );

      assert.ok(
        doran.history
      );

      assert.ok(
        doran.currentGoal
      );

      assert.ok(
        doran.secret
      );

      assert.ok(
        Array.isArray(
          doran.memories
        )
      );
    }
  );


  await test(
    'NPCs diferentes ganham perfis deterministas diferentes',
    () => {
      const state =
        engine.initialState();

      const a = {
        id: 'npc-a',
        name: 'Arven',
        role: 'Cartografo',
        description: 'Viajante.'
      };

      const b = {
        id: 'npc-b',
        name: 'Mira',
        role: 'Mercadora',
        description: 'Mercadora.'
      };

      npcLife
        .enrichNpcIdentity(
          a,
          state
        );

      npcLife
        .enrichNpcIdentity(
          b,
          state
        );

      assert.notEqual(
        a.personality +
          a.currentGoal +
          a.secret,
        b.personality +
          b.currentGoal +
          b.secret
      );
    }
  );


  await test(
    'Dialogo NPC permanece na mesma janela',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'components/game/npc-dialog.tsx'
          ),
          'utf8'
        );

      assert.ok(
        source.includes(
          'const sendTurn'
        )
      );

      assert.ok(
        source.includes(
          'conversation: NpcDialogTurn[]'
        )
      );

      assert.ok(
        source.includes(
          'Fale livremente'
        )
      );

      assert.ok(
        !source.includes(
          'onSelectOption(opt.actionText);\\n                onClose();'
        )
      );
    }
  );


  await test(
    'Endpoint NPC usa contexto da diretora e memoria',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'app/api/npc-dialogue/route.ts'
          ),
          'utf8'
        );

      assert.ok(
        source.includes(
          'readCompactWorldContext'
        )
      );

      assert.ok(
        source.includes(
          'NPC_DIALOGUE_SYSTEM'
        )
      );

      assert.ok(
        source.includes(
          'npc.memories'
        )
      );
    }
  );


  await test(
    'InventoryPanel usa transacao mochila-equipamento',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'components/game/inventory-panel.tsx'
          ),
          'utf8'
        );

      assert.ok(
        source.includes(
          'equipInventoryItem('
        )
      );

      assert.ok(
        source.includes(
          'unequipInventorySlot('
        )
      );

      assert.ok(
        source.includes(
          'getEquipSlotForItem(selectedItem)'
        )
      );
    }
  );


  await test(
    'Fireball SRD com friendly fire continua coberta pelo C1',
    () => {
      const source =
        fs.readFileSync(
          path.join(
            root,
            'scripts/test-srd-c1.mjs'
          ),
          'utf8'
        );

      assert.ok(
        source.includes(
          'Fireball applies friendly fire inside the area'
        )
      );
    }
  );

} finally {
  await vite.close();
}

console.log('');
console.log('============================================');
console.log(' POLISH-A AUTOMATED TEST REPORT');
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
  'ALL POLISH-A TESTS PASSED.'
);
