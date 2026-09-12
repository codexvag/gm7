import assert from 'node:assert/strict';

const port = 10000;
const baseUrl = `http://127.0.0.1:${port}`;

async function test() {
  console.log('Testing MMO combat actions...');
  const initRes = await fetch(`${baseUrl}/api/game?room=mmo-world-village`);
  const setCookie = initRes.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0] : '';
  const initData = await initRes.json();
  const userId = initData.user;
  console.log('User:', userId);

  const heroId = `combat_hero_${Date.now()}`;
  const fullHero = {
    id: heroId,
    owner: userId,
    name: 'Guerreiro Teste',
    className: 'Guerreiro',
    species: 'Humano',
    background: 'Soldado',
    level: 1,
    stats: [16, 14, 14, 10, 10, 10],
    skills: ['Atletismo'],
    expertise: [],
    saves: [0, 2],
    hp: 12,
    maxHp: 12,
    ac: 16,
    speed: 9,
    attack: 5,
    damage: '1d8+3',
    weapon: 'Espada Longa',
    spellAbility: 3,
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    usedSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: '',
    spells: '',
    inventory: 'Espada Longa\nPoção de Cura',
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
    gold: 50,
    questProgress: { doran_talked: true },
    worldFlags: {},
    act: 1,
    location: 0,
    biome: 'village'
  };

  // 1. Create hero
  const cRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      action: 'character',
      value: fullHero,
      character: heroId
    })
  });
  const cData = await cRes.json();
  console.log('Hero created:', cData.ok, 'version:', cData.room?.version);

  // 2. Travel to forest
  const tRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: cData.room.version,
      action: 'location',
      location: 1,
      biome: 'forest',
      character: heroId
    })
  });
  const tData = await tRes.json();
  console.log('Traveled to forest:', tData.ok, 'version:', tData.room?.version);
  const heroAfterTravel = tData.room?.state?.characters?.find(c => c.id === heroId);
  console.log('Hero after travel:', heroAfterTravel?.biome, 'enemies count:', tData.room?.state?.enemies?.length);

  // 3. Start combat via 'encounter' (the button in CampaignTracker)
  console.log('\n--- Calling action: encounter ---');
  const encRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: tData.room.version,
      action: 'encounter',
      character: heroId
    })
  });
  console.log('Encounter status:', encRes.status);
  const encData = await encRes.json();
  console.log('Encounter response:', encData);

  if (encData.room) {
    const heroAfterEnc = encData.room.state.characters.find(c => c.id === heroId);
    console.log('Hero after encounter:', heroAfterEnc ? `${heroAfterEnc.name} (biome: ${heroAfterEnc.biome})` : 'NOT FOUND!');
    console.log('Combat state:', encData.room.state.combat, 'order:', encData.room.state.order, 'turn:', encData.room.state.turn);
    console.log('Enemies:', encData.room.state.enemies);
  }

  // 4. Try attack
  console.log('\n--- Calling action: attack ---');
  const atkRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: encData.room?.version,
      action: 'attack',
      character: heroId
    })
  });
  console.log('Attack status:', atkRes.status);
  const atkData = await atkRes.json();
  console.log('Attack response:', atkData);

  // 5. Try move
  console.log('\n--- Calling action: move ---');
  const mvRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: (atkData.room || encData.room)?.version,
      action: 'move',
      character: heroId,
      x: (heroAfterTravel?.x || 3) + 1,
      y: heroAfterTravel?.y || 3
    })
  });
  console.log('Move status:', mvRes.status);
  const mvData = await mvRes.json();
  console.log('Move response:', mvData);

  // 6. Try pass
  console.log('\n--- Calling action: pass ---');
  const passRes = await fetch(`${baseUrl}/api/game`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: 'mmo-world-village',
      version: (mvData.room || atkData.room || encData.room)?.version,
      action: 'pass',
      character: heroId
    })
  });
  console.log('Pass status:', passRes.status);
  const passData = await passRes.json();
  console.log('Pass response:', passData);
}

test().catch(console.error);
