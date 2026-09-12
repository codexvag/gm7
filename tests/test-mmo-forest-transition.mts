import assert from 'node:assert/strict';
import http from 'node:http';

// Test against the running Node server (or spawn server if needed)
// First let's check if port 10000 is running
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
  const initData = await initRes.json() as any;
  const userId = initData.user;
  console.log(`✅ Sessão criada com sucesso para o usuário: ${userId}`);

  // 2. Testar o endpoint SSE /api/game/stream (garantir status 200, text/event-stream e evento connected)
  console.log('📡 Testando conexão com /api/game/stream...');
  const sseConnected = await new Promise<boolean>((resolve, reject) => {
    const req = http.request(
      `${baseUrl}/api/game/stream?room=mmo-world-village&userId=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          Cookie: cookie,
          Accept: 'text/event-stream'
        }
      },
      (res) => {
        assert.strictEqual(res.statusCode, 200, 'Stream SSE deve retornar status 200');
        const cType = res.headers['content-type'] || '';
        assert(cType.includes('text/event-stream'), `Content-Type deve ser text/event-stream, recebido: ${cType}`);
        
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          if (buf.includes('event: connected') || buf.includes('mmo-world-village')) {
            req.destroy();
            resolve(true);
          }
        });
      }
    );
    req.on('error', (err) => {
      // If destroyed on purpose after reading connected event, ignore
      if (req.destroyed) return;
      reject(err);
    });
    req.end();
  });
  assert(sseConnected, 'Endpoint SSE deve conectar e emitir evento de boas-vindas');
  console.log('✅ Endpoint SSE /api/game/stream respondeu 200 com text/event-stream!');

  // 3. Criar herói no mundo MMO
  console.log('🧙‍♂️ Criando personagem no mundo MMO...');
  const heroId = `hero_${Date.now()}`;
  const charRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      room: 'mmo-world-village',
      action: 'character',
      character: {
        id: heroId,
        name: 'Guerreiro de Valdoria',
        className: 'Guerreiro',
        species: 'Humano',
        level: 1,
        hp: 12,
        maxHp: 12,
        ac: 16,
        speed: 9,
        stats: [16, 12, 14, 10, 10, 10],
        equipment: ['espada-longa', 'cota-de-malha', 'escudo'],
        inventory: 'Poção de Cura',
        x: 4,
        y: 5
      }
    })
  });
  assert.strictEqual(charRes.status, 200, 'Criação de herói deve retornar 200');
  const charData = await charRes.json() as any;
  assert(charData.ok, 'Resposta deve indicar ok');
  assert(charData.room.state.characters.some((c: any) => c.id === heroId), 'Personagem deve existir na lista da mesa');
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
  const travelData = await travelRes.json() as any;
  assert(travelData.ok, 'Resposta de viagem deve indicar ok');

  // Validar que o personagem continua existindo na lista de personagens
  const travelingHero = travelData.room.state.characters.find((c: any) => c.id === heroId);
  assert(travelingHero, 'Herói DEVE continuar na lista de personagens após viajar para a mata!');
  assert.strictEqual(travelingHero.biome, 'forest', 'Bioma do herói deve ser forest');
  assert.strictEqual(travelingHero.location, 1, 'Local do herói deve ser 1 (Floresta)');
  assert.strictEqual(travelingHero.act, 2, 'Ato do herói deve ser 2');

  // Validar que os monstros da mata surgiram no tabuleiro
  assert(travelData.room.state.enemies.length > 0, 'Inimigos da mata devem ser gerados');
  const hasSentinela = travelData.room.state.enemies.some((e: any) => e.name.includes('Sentinela'));
  assert(hasSentinela, 'Sentinela de Cinzas deve estar presente na Mata');
  console.log(`✅ Viagem concluída com sucesso! Herói: ${travelingHero.name} no bioma ${travelingHero.biome}, Inimigos gerados: ${travelData.room.state.enemies.length}`);

  // 5. Testar GET subsequente simulando re-load e sync do frontend
  console.log('🔄 Testando carregamento subsequente da mesa via GET...');
  const reloadRes = await fetch(`${baseUrl}/api/game?room=mmo-world-village`, {
    headers: { Cookie: cookie }
  });
  assert.strictEqual(reloadRes.status, 200, 'GET /api/game?room=mmo-world-village deve retornar 200');
  const reloadData = await reloadRes.json() as any;
  const persistentHero = reloadData.room.state.characters.find((c: any) => c.id === heroId);
  assert(persistentHero, 'Herói deve ser mantido intacto após reload');
  assert.strictEqual(persistentHero.biome, 'forest', 'Bioma persistido deve continuar sendo forest');
  console.log('✅ Persistência validada! O herói nunca desaparece da mesa.');

  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
}

run().catch((err) => {
  console.error('❌ Teste falhou:', err);
  process.exit(1);
});
