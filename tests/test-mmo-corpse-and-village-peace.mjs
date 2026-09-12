import assert from 'node:assert';

const baseUrl = 'http://127.0.0.1:10000';

async function run() {
  console.log('🚀 Iniciando teste: Corpos mortos, biomas e respeito à Vila pacífica no MMO...');

  // 1. Obter estado atual da sala mmo-world-village
  const res = await fetch(`${baseUrl}/api/game?room=mmo-world-village`);
  assert.strictEqual(res.status, 200, 'GET /api/game deve retornar 200');
  const sessionCookie = res.headers.get('set-cookie')?.split(';')[0] || '';
  const data = await res.json();
  const room = data.room;
  assert.ok(room, 'Sala deve existir');
  const state = room.state;
  const userId = data.user;

  console.log('1. Verificando corpos existentes no banco de dados...');
  assert.ok(Array.isArray(state.corpses), 'state.corpses deve ser array');
  console.log(`   Total de corpos encontrados: ${state.corpses.length}`);
  for (const corpse of state.corpses) {
    console.log(`   - Corpos: "${corpse.name}" [Biome: ${corpse.biome}, X: ${corpse.x}, Y: ${corpse.y}, Gold: ${corpse.gold}]`);
    assert.strictEqual(corpse.biome, 'forest', 'Corpo de criatura da floresta deve ter biome forest');
  }

  // 2. Criar ou usar um personagem na vila
  console.log('2. Criando herói de teste...');
  const heroId = `hero_${Date.now()}`;
  const fullHero = {
    id: heroId,
    owner: userId,
    name: 'Valerius de Valdoria',
    className: 'Guerreiro',
    species: 'Humano',
    background: 'Soldado',
    level: 1,
    stats: [15, 14, 13, 12, 10, 8],
    skills: ['Atletismo', 'Intimidação'],
    expertise: [],
    saves: [0, 2],
    hp: 12,
    maxHp: 12,
    ac: 16,
    speed: 9,
    attack: 20,
    damage: '10d10+10',
    weapon: 'Arco Longo',
    spellAbility: 3,
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    usedSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: '',
    spells: '',
    inventory: 'Espada Longa\nCota de Malha\nPoção de Cura',
    notes: '',
    conditions: [],
    x: 4,
    y: 5,
    xp: 0,
    initiative: 0,
    deathSuccess: 0,
    deathFail: 0,
    exhaustion: 0,
    gold: 50,
    questProgress: {},
    worldFlags: {},
    act: 1,
    location: 0,
    biome: 'village'
  };

  const createHeroRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      room: 'mmo-world-village',
      action: 'character',
      value: fullHero,
      character: heroId
    })
  });
  assert.strictEqual(createHeroRes.status, 200, 'createCharacter deve ter sucesso');
  console.log('   ✅ Herói criado com sucesso na Vila!');

  // 3. Tentar iniciar encounter na Vila -> DEVE FALHAR (Safe Hub)
  console.log('3. Testando tentativa de encounter na Vila pacífica...');
  const villageEncounterRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      room: 'mmo-world-village',
      action: 'encounter',
      character: heroId
    })
  });
  assert.strictEqual(villageEncounterRes.status, 400, 'Encounter na vila deve retornar erro 400');
  const villageEncounterErr = await villageEncounterRes.json();
  assert.ok(villageEncounterErr.error.includes('santuário pacífico e seguro'), 'Erro deve indicar santuário seguro');
  console.log('   ✅ Vila protegida com sucesso contra invasões e combates!');

  // 4. Viajar para a Floresta (Mata)
  console.log('4. Viajando para a Floresta (Mata)...');
  const travelRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      room: 'mmo-world-village',
      action: 'location',
      character: heroId,
      location: 1 // Floresta
    })
  });
  assert.strictEqual(travelRes.status, 200, 'Viagem para floresta deve ter sucesso');
  const travelData = await travelRes.json();
  const forestHero = travelData.room.state.characters.find((c) => c.id === heroId);
  assert.strictEqual(forestHero.biome, 'forest', 'Herói deve estar em biome forest');
  console.log(`   Herói está em: ${forestHero.biome}`);

  // Encontrar um inimigo na floresta
  const forestEnemies = travelData.room.state.enemies.filter((e) => e.biome === 'forest' && (e.ownerCharId === heroId || !e.ownerCharId));
  assert.ok(forestEnemies.length > 0, 'Devem existir inimigos na floresta');
  const targetEnemy = forestEnemies[0];
  console.log(`   Inimigo alvo na floresta: ${targetEnemy.name} (HP: ${targetEnemy.hp})`);

  // 5. Posicionar herói adjacente ao monstro (X:6, Y:3) e combater
  console.log('5. Posicionando herói adjacente ao monstro e iniciando combate...');
  fullHero.x = 6;
  fullHero.y = 3;
  fullHero.biome = 'forest';
  fullHero.location = 1;
  await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ room: 'mmo-world-village', action: 'character', value: fullHero, character: heroId })
  });

  for (let tries = 0; tries < 8; tries++) {
    // Passar turno para liberar ação se necessário
    await fetch(`${baseUrl}/api/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ room: 'mmo-world-village', action: 'pass', character: heroId })
    });

    const killRes = await fetch(`${baseUrl}/api/game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie
      },
      body: JSON.stringify({
        room: 'mmo-world-village',
        action: 'attack',
        character: heroId,
        target: targetEnemy.id
      })
    });
    const kData = await killRes.json();
    if (!kData.room) {
      console.log('   [Attack info]:', kData.error);
      continue;
    }
    const updatedEnemy = kData.room.state.enemies.find((e) => e.id === targetEnemy.id);
    if (!updatedEnemy || updatedEnemy.hp <= 0) {
      console.log(`   ✅ ${targetEnemy.name} foi abatido!`);
      const newCorpse = kData.room.state.corpses.find((c) => c.enemyName === targetEnemy.name);
      assert.ok(newCorpse, 'Novo corpo deve ser gerado no mapa');
      assert.strictEqual(newCorpse.biome, 'forest', 'Novo corpo DEVE ter biome forest!');
      console.log(`   ✅ Novo corpo gerado com sucesso: "${newCorpse.name}" [Biome: ${newCorpse.biome}, Gold: ${newCorpse.gold} PO]`);
      break;
    }
  }

  // 6. Testar Respawn após morte
  console.log('6. Testando morte do herói e respawn limpo na Vila...');
  const respawnRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      room: 'mmo-world-village',
      action: 'respawn',
      character: heroId
    })
  });
  assert.strictEqual(respawnRes.status, 200, 'Respawn deve ter sucesso');
  const respawnData = await respawnRes.json();
  const respawnedHero = respawnData.room.state.characters.find((c) => c.id === heroId);
  assert.strictEqual(respawnedHero.biome, 'village', 'Herói renascido deve estar na vila');
  assert.strictEqual(respawnedHero.location, 0, 'Herói renascido deve ter location 0');
  assert.strictEqual(respawnedHero.hp, respawnedHero.maxHp, 'Herói renascido deve ter HP restaurado');
  assert.ok(!respawnData.room.state.order?.includes(heroId), 'Herói não deve constar na ordem de combate após respawn');
  console.log('   ✅ Herói renasceu na Vila do Rio Verde, curado e completamente fora de combate!');

  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
