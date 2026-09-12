import assert from 'node:assert/strict';

const port = 10000;
const baseUrl = `http://127.0.0.1:${port}`;
const userCookie = 'lume_session_id=anon_85c1dabbed6f441c';
const userHeroId = 'd26b339e-d710-4038-8854-d12a80b50123';

async function runTest() {
  console.log('🧪 [TEST] Validando correção de combate e progressão no mundo MMO...');

  // 1. Validar que GET /api/game sem ?room= NÃO regride para sala solo vazia
  console.log('1️⃣ Testando fallback de GET /api/game sem ?room=...');
  const fallbackRes = await fetch(`${baseUrl}/api/game`, {
    headers: { Cookie: userCookie }
  });
  assert.strictEqual(fallbackRes.status, 200, 'GET /api/game deve retornar 200');
  const fallbackData = await fallbackRes.json();
  assert.strictEqual(fallbackData.room?.id, 'mmo-world-village', 'Deve retornar mmo-world-village por padrão para quem joga no MMO');
  const heroInFallback = fallbackData.room?.state?.characters?.find((c) => c.id === userHeroId);
  assert(heroInFallback, 'Herói "ve" DEVE estar presente mesmo sem informar ?room=');
  assert.strictEqual(heroInFallback.biome, 'forest', 'Bioma do herói deve ser mantido como forest');
  console.log(`✅ Fallback blindado! Sala carregada: ${fallbackData.room?.id}, Herói: ${heroInFallback.name} (bioma: ${heroInFallback.biome})`);

  // 2. Obter estado atual da sala MMO
  let curRoom = fallbackData.room;
  let hero = heroInFallback;

  // 3. Testar movimentação adjacente ao inimigo na Mata
  const targetEnemy = curRoom.state.enemies.find((e) => e.ownerCharId === userHeroId && e.hp > 0) ||
                      curRoom.state.enemies.find((e) => e.hp > 0 && e.biome === 'forest');
  assert(targetEnemy, 'Deve existir inimigo da Mata para combate');
  console.log(`2️⃣ Posicionando herói adjacente ao inimigo: ${targetEnemy.name} em [${targetEnemy.x}, ${targetEnemy.y}]...`);

  const adjacentX = targetEnemy.x > 0 ? targetEnemy.x - 1 : targetEnemy.x + 1;
  const adjacentY = targetEnemy.y;

  const moveRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: curRoom.version,
      action: 'move',
      character: userHeroId,
      x: adjacentX,
      y: adjacentY
    })
  });
  assert.strictEqual(moveRes.status, 200, 'Movimento deve ser aceito');
  const moveData = await moveRes.json();
  curRoom = moveData.room;
  hero = curRoom.state.characters.find((c) => c.id === userHeroId);
  assert.strictEqual(hero.x, adjacentX, 'Coordenada X do herói deve ser atualizada');
  console.log(`✅ Herói movido para adjacência [${hero.x}, ${hero.y}] com sucesso!`);

  // 4. Testar ação de Ataque corpo a corpo no alcance correto
  console.log(`3️⃣ Desferindo ataque em ${targetEnemy.name}...`);
  const atkRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: curRoom.version,
      action: 'attack',
      character: userHeroId,
      target: targetEnemy.id
    })
  });
  assert.strictEqual(atkRes.status, 200, 'Ataque adjacente deve retornar 200 com sucesso');
  const atkData = await atkRes.json();
  assert(atkData.ok, 'Ataque deve ter ok: true');
  assert(atkData.attackResult, 'Deve retornar attackResult');
  console.log(`✅ Ataque executado com sucesso! Log: ${atkData.attackResult.text}`);
  curRoom = atkData.room;

  // 5. Testar Fim do Turno (action: 'pass')
  console.log('4️⃣ Testando término de turno (action: pass)...');
  const passRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: curRoom.version,
      action: 'pass',
      character: userHeroId
    })
  });
  assert.strictEqual(passRes.status, 200, 'Passar turno deve retornar 200 com sucesso');
  const passData = await passRes.json();
  curRoom = passData.room;
  console.log('✅ Turno passado com sucesso! A IA inimiga executou sem travar.');

  // 6. Testar que um SEGUNDO jogador independente pode iniciar combate em outro bioma/party sem conflito
  console.log('5️⃣ Testando segundo jogador independente no MMO...');
  const player2Cookie = 'lume_session_id=anon_test_p2_' + Date.now();
  const player2HeroId = 'hero_p2_' + Date.now();

  const p2Init = await fetch(`${baseUrl}/api/game?room=mmo-world-village`, {
    headers: { Cookie: player2Cookie }
  });
  const p2InitData = await p2Init.json();

  const p2CharRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: player2Cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: p2InitData.room.version,
      action: 'character',
      character: player2HeroId,
      value: {
        id: player2HeroId,
        owner: p2InitData.user,
        name: 'Mago Valdoriano',
        className: 'Mago',
        species: 'Elfo',
        background: 'Sábio',
        level: 1,
        stats: [10, 14, 12, 16, 12, 10],
        skills: ['Arcanismo'],
        expertise: [],
        saves: [3, 4],
        hp: 8,
        maxHp: 8,
        ac: 12,
        speed: 9,
        attack: 4,
        damage: '1d10',
        weapon: 'Bordo',
        spellAbility: 3,
        slots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
        usedSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        features: '',
        spells: '',
        inventory: 'Bordo\nPoção de Cura',
        notes: '',
        conditions: [],
        x: 4,
        y: 5,
        xp: 0,
        initiative: 0,
        deathSuccess: 0,
        deathFail: 0,
        exhaustion: 0,
        equipment: {},
        gold: 30,
        questProgress: {},
        worldFlags: {},
        act: 1,
        location: 0,
        biome: 'village'
      }
    })
  });
  assert.strictEqual(p2CharRes.status, 200, 'Segundo jogador criado');
  const p2CharData = await p2CharRes.json();

  // Segundo jogador inicia combate com encounter na Vila
  const p2EncRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: player2Cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: p2CharData.room.version,
      action: 'encounter',
      character: player2HeroId
    })
  });
  assert.strictEqual(p2EncRes.status, 200, 'Segundo jogador DEVE conseguir iniciar combate sem erro de conflito global');
  const p2EncData = await p2EncRes.json();
  assert(p2EncData.ok, 'Segundo combate deve iniciar com sucesso');
  console.log('✅ Segundo jogador iniciou combate independentemente sem interferir no herói original!');

  // 7. Validar que o herói 1 continua intacto na floresta com seu bioma e dados salvos
  const finalCheckRes = await fetch(`${baseUrl}/api/game?room=mmo-world-village`, {
    headers: { Cookie: userCookie }
  });
  const finalCheckData = await finalCheckRes.json();
  const finalHero = finalCheckData.room.state.characters.find((c) => c.id === userHeroId);
  assert(finalHero, 'Herói "ve" DEVE permanecer na lista de personagens');
  assert.strictEqual(finalHero.biome, 'forest', 'Bioma deve continuar sendo forest');
  assert.strictEqual(finalHero.location, 1, 'Localização deve continuar sendo 1');

  console.log('🎉 TODOS OS TESTES DE PROGRESSÃO E COMBATE PASSARAM COM 100% DE SUCESSO!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Teste falhou:', err);
  process.exit(1);
});
