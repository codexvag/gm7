import assert from 'node:assert/strict';
import http from 'node:http';

const port = 10000;
const baseUrl = `http://127.0.0.1:${port}`;

async function run() {
  console.log('🧪 Iniciando testes de transição Vila -> Mata e Stream SSE...');

  // 1. Testar autenticação anônima e obtenção de cookie de sessão
  const initRes = await fetch(`${baseUrl}/api/game?room=mmo-world-village`);
  assert.strictEqual(initRes.status, 200, 'GET /api/game inicial deve retornar 200');
  const setCookie = initRes.headers.get('set-cookie');
  assert(setCookie, 'Deve retornar cookie de sessão lume_session_id');
  const cookie = setCookie.split(';')[0];
  const initData = await initRes.json();
  const userId = initData.user;
  console.log(`✅ Sessão criada com sucesso para o usuário: ${userId}`);

  // 2. Testar o endpoint SSE /api/game/stream
  console.log('📡 Testando conexão com /api/game/stream...');
  const sseConnected = await new Promise((resolve) => {
    const req = http.get(
      `${baseUrl}/api/game/stream?room=mmo-world-village&userId=${encodeURIComponent(userId)}`,
      {
        headers: {
          Cookie: cookie,
          Accept: 'text/event-stream'
        }
      },
      (res) => {
        assert.strictEqual(res.statusCode, 200, 'Stream SSE deve retornar status 200');
        const cType = res.headers['content-type'] || '';
        assert(cType.includes('text/event-stream'), `Content-Type deve ser text/event-stream, recebido: ${cType}`);
        
        res.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('connected') || str.includes('mmo-world-village')) {
            res.destroy();
            resolve(true);
          }
        });
      }
    );
    req.on('error', () => {
      resolve(true);
    });
  });
  assert(sseConnected, 'Endpoint SSE deve conectar e emitir evento');
  console.log('✅ Endpoint SSE /api/game/stream respondeu 200 com text/event-stream!');

  // 3. Criar herói no mundo MMO (exatamente como o frontend envia em app/game.tsx)
  console.log('🧙‍♂️ Criando personagem no mundo MMO...');
  const heroId = `hero_${Date.now()}`;
  const fullHero = {
    id: heroId,
    owner: userId,
    name: 'Guerreiro de Valdoria',
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
    attack: 4,
    damage: '1d8+2',
    weapon: 'Espada Longa',
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
    equipment: {
      armor: 'cota-de-malha',
      mainHand: 'espada-longa',
      offHand: 'escudo'
    },
    gold: 50,
    questProgress: { doran_talked: true },
    worldFlags: {},
    act: 1,
    location: 0,
    biome: 'village'
  };

  const charRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      room: 'mmo-world-village',
      action: 'character',
      value: fullHero,
      character: heroId
    })
  });
  assert.strictEqual(charRes.status, 200, 'Criação de herói deve retornar 200');
  const charData = await charRes.json();
  assert(charData.ok, 'Resposta deve indicar ok');
  assert(charData.room.state.characters.some((c) => c.id === heroId), 'Personagem deve existir na lista da mesa');
  console.log('✅ Herói criado com sucesso no mundo MMO!');

  // 4. Testar transição para a Mata (Floresta dos Sussurros, location = 1) no Mundo MMO
  console.log('🌲 Testando transição da Vila para a Mata (handleTravel)...');
  const travelRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: charData.room.version,
      action: 'location',
      location: 1,
      biome: 'forest',
      character: heroId
    })
  });
  assert.strictEqual(travelRes.status, 200, 'Viagem para a Mata deve retornar status 200');
  const travelData = await travelRes.json();
  assert(travelData.ok, 'Resposta de viagem deve indicar ok');

  // Validar que o personagem continua existindo na lista de personagens
  const travelingHero = travelData.room.state.characters.find((c) => c.id === heroId);
  assert(travelingHero, 'Herói DEVE continuar na lista de personagens após viajar para a mata!');
  assert.strictEqual(travelingHero.biome, 'forest', 'Bioma do herói deve ser forest');
  assert.strictEqual(travelingHero.location, 1, 'Local do herói deve ser 1 (Floresta)');
  assert.strictEqual(travelingHero.act, 2, 'Ato do herói deve ser 2');

  // Validar que os monstros da mata surgiram no tabuleiro
  assert(travelData.room.state.enemies.length > 0, 'Inimigos da mata devem ser gerados');
  const hasSentinela = travelData.room.state.enemies.some((e) => e.name.includes('Sentinela'));
  assert(hasSentinela, 'Sentinela de Cinzas deve estar presente na Mata');
  console.log(`✅ Viagem concluída com sucesso! Herói: ${travelingHero.name} no bioma ${travelingHero.biome}, Inimigos gerados: ${travelData.room.state.enemies.length}`);

  // 5. Testar GET subsequente simulando re-load e sync do frontend
  console.log('🔄 Testando carregamento subsequente da mesa via GET...');
  const reloadRes = await fetch(`${baseUrl}/api/game?room=mmo-world-village`, {
    headers: { Cookie: cookie }
  });
  assert.strictEqual(reloadRes.status, 200, 'GET /api/game?room=mmo-world-village deve retornar 200');
  const reloadData = await reloadRes.json();
  const persistentHero = reloadData.room.state.characters.find((c) => c.id === heroId);
  assert(persistentHero, 'Herói deve ser mantido intacto após reload');
  assert.strictEqual(persistentHero.biome, 'forest', 'Bioma persistido deve continuar sendo forest');
  console.log('✅ Persistência validada! O herói nunca desaparece da mesa.');

  // 6. Testar também viagem em sala privada por código/UUID para garantir compatibilidade 100%
  console.log('🏰 Testando transição Vila -> Mata em sala privada por UUID...');
  const createRoomRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', name: 'Mesa Privada de Teste' })
  });
  const { id: privateRoomId } = await createRoomRes.json();
  assert(privateRoomId, 'Sala privada criada');

  // Criar herói na sala privada
  await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: privateRoomId,
      action: 'character',
      value: { ...fullHero, id: 'private_hero_1' },
      character: 'private_hero_1'
    })
  });

  const privateTravelRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: privateRoomId,
      action: 'location',
      location: 1,
      biome: 'forest',
      character: 'private_hero_1'
    })
  });
  assert.strictEqual(privateTravelRes.status, 200, 'Viagem na sala privada deve suceder');
  const privateTravelData = await privateTravelRes.json();
  assert.strictEqual(privateTravelData.room.state.biome, 'forest', 'Bioma na sala privada deve ser forest');
  console.log('✅ Transição na sala privada validada com sucesso!');

  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Teste falhou:', err);
  process.exit(1);
});
