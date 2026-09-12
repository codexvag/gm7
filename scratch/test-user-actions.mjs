const port = 10000;
const baseUrl = `http://127.0.0.1:${port}`;
const cookie = 'lume_session_id=anon_85c1dabbed6f441c';
const heroId = 'd26b339e-d710-4038-8854-d12a80b50123';

async function testUserActions() {
  console.log('Testing actions for user anon_85c1dabbed6f441c...');

  // 1. GET room state
  const r = await fetch(`${baseUrl}/api/game?room=mmo-world-village`, {
    headers: { Cookie: cookie }
  });
  const d = await r.json();
  console.log('GET room ok:', d.signedIn, 'user:', d.user, 'version:', d.room.version);
  const myHero = d.room.state.characters.find(c => c.id === heroId);
  console.log('My hero:', myHero?.name, 'biome:', myHero?.biome, 'location:', myHero?.location);
  console.log('Combat:', d.room.state.combat, 'turn:', d.room.state.turn, 'order:', d.room.state.order);

  // 2. Try attack
  console.log('\n--- Calling attack ---');
  const atkRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: d.room.version,
      action: 'attack',
      character: heroId,
      target: '136bd650-8c44-4946-bf54-2f4490b2ffa8'
    })
  });
  console.log('Attack status:', atkRes.status);
  const atkData = await atkRes.json();
  console.log('Attack response:', atkData);

  // 3. What if hero moves?
  console.log('\n--- Calling move ---');
  const mvRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: (atkData.room || d.room).version,
      action: 'move',
      character: heroId,
      x: 4,
      y: 4
    })
  });
  console.log('Move status:', mvRes.status);
  const mvData = await mvRes.json();
  console.log('Move response:', mvData);
}

testUserActions().catch(console.error);
