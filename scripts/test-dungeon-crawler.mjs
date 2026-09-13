import assert from 'node:assert/strict';
import { createServer } from 'vite';

const root = process.cwd();
const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true },
  resolve: {
    alias: [{ find: '@', replacement: root }]
  }
});

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed++;
    console.error(`[FAIL] ${name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

try {
  // Carregar módulos TS via Vite SSR
  const {
    createDungeonExpedition,
    generateDungeonFloor,
    checkRoomDiscovery,
    checkRoomCombatEncounter,
    interactDungeonObject,
    getDungeonObstacleCoordinates
  } = await vite.ssrLoadModule('/lib/dungeon-crawler.ts');

  const {
    buildMapPrompt,
    BIOME_DESCRIPTIONS,
    THEME_DESCRIPTIONS
  } = await vite.ssrLoadModule('/lib/ai-map-prompts.ts');

  const {
    audioManager,
    computeRecommendedTrack,
    DEFAULT_GAME_SETTINGS
  } = await vite.ssrLoadModule('/lib/audio-manager.ts');

  const {
    findPathWithCustomPolygons,
    isPointWalkableWithPolygons
  } = await vite.ssrLoadModule('/lib/collision-system.ts');

  console.log('--- EXECUTANDO TESTES DO DUNGEON CRAWLER, ÁUDIO & MAPAS IA ---');

  // ==========================================
  // 1. ÁUDIO & MÚSICAS EM LOOP
  // ==========================================
  await test('1. AudioManager: volumes e cálculo efetivo', async () => {
    const initialSettings = audioManager.getSettings();
    assert.strictEqual(initialSettings.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume);
    assert.strictEqual(initialSettings.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume);

    audioManager.updateSettings({ masterVolume: 80, musicVolume: 50, masterMuted: false, musicMuted: false });
    const eff = audioManager.getEffectiveMusicVolume();
    assert.strictEqual(Number(eff.toFixed(2)), 0.40);

    audioManager.updateSettings({ masterMuted: true });
    assert.strictEqual(audioManager.getEffectiveMusicVolume(), 0);
    audioManager.updateSettings({ masterMuted: false });
  });

  await test('2. AudioManager: seleção reativa de faixas por estado', async () => {
    // A) Exploração / Paz -> cidades.mp3
    assert.strictEqual(computeRecommendedTrack({ combat: false }), 'cidades');

    // B) Combate Normal -> batalha_media.mp3
    assert.strictEqual(
      computeRecommendedTrack({
        combat: true,
        enemies: [{ hp: 14, name: 'Lobo Cinzento', cr: 1, aiStyle: 'skirmisher' }]
      }),
      'batalha_media'
    );

    // C) Combate Chefe / Alta Intensidade -> batalha_alta.mp3
    assert.strictEqual(
      computeRecommendedTrack({
        combat: true,
        enemies: [{ hp: 80, name: 'Lorde Malakor das Cinzas', cr: 6, aiStyle: 'boss' }]
      }),
      'batalha_alta'
    );

    assert.strictEqual(
      computeRecommendedTrack({
        combat: true,
        isDragonCombatActive: true
      }),
      'batalha_alta'
    );
  });

  // ==========================================
  // 2. CONSTRUTOR DE PROMPTS DE IA
  // ==========================================
  await test('3. AI Map Prompts: estrutura top-down e negative prompts', async () => {
    const promptResult = buildMapPrompt({
      biome: 'catacombs',
      theme: 'grimdark_stone',
      size: 12,
      hasPillars: true,
      hasWaterFeatures: false,
      hasSecretAlcove: true
    });

    assert.ok(promptResult.prompt.includes('Top-down 2D tabletop RPG battlemap'));
    assert.ok(promptResult.prompt.includes('NO characters'));
    assert.ok(promptResult.prompt.includes('NO overlaid grid lines'));
    assert.ok(promptResult.negativePrompt.includes('isometric'));
    assert.strictEqual(promptResult.gridRecommendation, 12);
  });

  // ==========================================
  // 3. MOTOR PROCEDURAL DUNGEON CRAWLER
  // ==========================================
  await test('4. Dungeon Crawler: geração de andar e salas com propósito', async () => {
    const seed = 998877;
    const expedition = createDungeonExpedition(seed, 'solo', ['hero-aldric']);

    assert.strictEqual(expedition.currentFloor, 1);
    assert.strictEqual(expedition.status, 'exploring');

    const floor1 = expedition.floorHistory[1];
    assert.ok(floor1);
    assert.strictEqual(floor1.width, 12);
    assert.strictEqual(floor1.height, 12);
    assert.ok(floor1.rooms.length >= 4);

    const purposes = floor1.rooms.map((r) => r.purpose);
    assert.ok(purposes.includes('shrine'));
    assert.ok(purposes.includes('combat'));
    assert.ok(purposes.includes('boss'));

    // Sala de entrada segura
    const entryRoom = floor1.rooms.find((r) => r.id.includes('room-entry'));
    assert.ok(entryRoom);
    assert.strictEqual(entryRoom.revealed, true);
    assert.strictEqual(entryRoom.cleared, true);
    assert.strictEqual(entryRoom.enemies.length, 0);

    // Sala de combate inicia oculta com sentinelas
    const combatRoom = floor1.rooms.find((r) => r.purpose === 'combat');
    assert.ok(combatRoom);
    assert.strictEqual(combatRoom.revealed, false);
    assert.ok(combatRoom.enemies.length > 0);

    // Revelação ao adentrar a sala
    const disc = checkRoomDiscovery(floor1, combatRoom.x + 1, combatRoom.y + 1);
    assert.strictEqual(disc.updated, true);
    assert.strictEqual(combatRoom.revealed, true);

    // Detecção de combate
    const encounter = checkRoomCombatEncounter(floor1, combatRoom.x + 1, combatRoom.y + 1);
    assert.strictEqual(encounter.shouldTriggerCombat, true);
    assert.strictEqual(encounter.enemiesToFight.length, combatRoom.enemies.length);
  });

  await test('5. Dungeon Crawler: portas dinâmicas e interações', async () => {
    const floor1 = generateDungeonFloor(555, 1, 'solo');
    const combatRoom = floor1.rooms.find((r) => r.purpose === 'combat');
    const dummyHero = {
      id: 'hero-aldric',
      name: 'Aldric',
      hp: 20,
      maxHp: 28,
      stats: { dexterity: 14 }
    };

    // Obstáculos com portas fechadas
    const obstacleCoords = getDungeonObstacleCoordinates(floor1);
    const closedDoor = combatRoom.doors.find((d) => !d.isOpen);
    if (closedDoor) {
      assert.ok(obstacleCoords.has(`${closedDoor.x},${closedDoor.y}`));

      // Interagir abre a porta
      const doorRes = interactDungeonObject(floor1, closedDoor.x, closedDoor.y, dummyHero);
      assert.strictEqual(doorRes.type, 'door');
      assert.strictEqual(closedDoor.isOpen, true);
    }

    // Santuário
    const shrineRoom = floor1.rooms.find((r) => r.shrines.length > 0);
    const shrine = shrineRoom.shrines[0];
    const shrineRes = interactDungeonObject(floor1, shrine.x, shrine.y, dummyHero);
    assert.strictEqual(shrineRes.type, 'shrine');
    assert.strictEqual(shrineRes.success, true);
    assert.strictEqual(shrine.isUsed, true);

    // Baú de Tesouro
    const chestRoom = floor1.rooms.find((r) => r.chests.length > 0);
    const chest = chestRoom.chests[0];
    const chestRes = interactDungeonObject(floor1, chest.x, chest.y, dummyHero);
    assert.strictEqual(chestRes.type, 'chest');
    assert.strictEqual(chestRes.success, true);
    assert.strictEqual(chest.isOpened, true);

    // Escada de descida e ponto de extração
    const stairsRes = interactDungeonObject(floor1, floor1.stairsDown.x, floor1.stairsDown.y, dummyHero);
    assert.strictEqual(stairsRes.type, 'stairs');

    const extractRes = interactDungeonObject(floor1, floor1.extractionPoint.x, floor1.extractionPoint.y, dummyHero);
    assert.strictEqual(extractRes.type, 'extraction');
    assert.strictEqual(extractRes.success, true);
  });

  await test('6. Dungeon Crawler: escalabilidade solo vs grupo', async () => {
    const soloFloor3 = generateDungeonFloor(444, 3, 'solo');
    const partyFloor3 = generateDungeonFloor(444, 3, 'party');

    const soloBoss = soloFloor3.rooms.find((r) => r.purpose === 'boss').enemies[0];
    const partyBoss = partyFloor3.rooms.find((r) => r.purpose === 'boss').enemies[0];

    assert.ok(partyBoss.maxHp > soloBoss.maxHp, 'Chefe em grupo deve ter mais PV');
    const partyBossRoom = partyFloor3.rooms.find((r) => r.purpose === 'boss');
    assert.ok(partyBossRoom.enemies.length > 1, 'Chefe em grupo deve ter aliados extras no 3º andar');
  });

  // ==========================================
  // 4. PATHFINDING A* COM POLÍGONOS DE COLISÃO
  // ==========================================
  await test('7. Collision System: A* contorna polígonos de obstáculos', async () => {
    const testPolygons = [
      {
        id: 'wall-1',
        name: 'Muralha Central',
        type: 'bloqueado',
        points: [
          [0.4, 0.2],
          [0.6, 0.2],
          [0.6, 0.8],
          [0.4, 0.8]
        ]
      }
    ];

    assert.strictEqual(isPointWalkableWithPolygons(0.5, 0.5, testPolygons), false);
    assert.strictEqual(isPointWalkableWithPolygons(0.1, 0.5, testPolygons), true);

    const path = findPathWithCustomPolygons({ x: 1, y: 5 }, { x: 10, y: 5 }, testPolygons, 12);
    assert.ok(path.length > 2, 'A* deve encontrar caminho contornando obstáculo');
    assert.strictEqual(path[0].x, 1);
    assert.strictEqual(path[0].y, 5);
    assert.strictEqual(path[path.length - 1].x, 10);
    assert.strictEqual(path[path.length - 1].y, 5);
  });

  console.log('\n======================================================');
  console.log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
} finally {
  await vite.close();
}
