// lib/dungeon-crawler.ts
/**
 * Motor de Dungeon Crawler Procedural Avançado para D&D 5e
 * Suporta múltiplos andares, escalabilidade solo vs grupo, salas temáticas
 * (combate, tesouro, armadilha, santuário, evento, secreta, chefe),
 * portas dinâmicas, armadilhas interativas, névoa por salas e ciclo de extração.
 */

import { type Enemy, type Character, type ItemDefinition, ITEMS_CATALOG } from './game-engine';
import { type Point } from './collision-system';

export type RoomPurpose = 'combat' | 'treasure' | 'trap' | 'shrine' | 'event' | 'secret' | 'boss';

export interface DungeonDoor {
  id: string;
  x: number;
  y: number;
  isOpen: boolean;
  isLocked: boolean;
  isSecret: boolean;
  keyRequired?: string;
  name?: string;
}

export interface DungeonTrap {
  id: string;
  x: number;
  y: number;
  name: string;
  type: 'dardo' | 'lajes' | 'chamas' | 'glifo';
  dc: number;
  damageFormula: string;
  damageType: string;
  isDisarmed: boolean;
  isTriggered: boolean;
  isRevealed: boolean;
}

export interface DungeonChest {
  id: string;
  x: number;
  y: number;
  name: string;
  isOpened: boolean;
  isLocked: boolean;
  gold: number;
  items: ItemDefinition[];
}

export interface DungeonShrine {
  id: string;
  x: number;
  y: number;
  name: string;
  isUsed: boolean;
  blessingName: string;
  blessingDescription: string;
  healHp?: number;
  temporaryHp?: number;
}

export interface DungeonCrawlerRoom {
  id: string;
  name: string;
  purpose: RoomPurpose;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  revealed: boolean;
  cleared: boolean;
  doors: DungeonDoor[];
  traps: DungeonTrap[];
  chests: DungeonChest[];
  shrines: DungeonShrine[];
  enemies: Enemy[];
}

export interface DungeonFloor {
  floorNumber: number;
  seed: number;
  width: number;
  height: number;
  rooms: DungeonCrawlerRoom[];
  spawnHero: Point;
  stairsDown: Point & { isUnlocked: boolean };
  extractionPoint: Point;
  cleared: boolean;
}

export interface DungeonExpeditionState {
  expeditionId: string;
  seed: number;
  mode: 'solo' | 'party';
  partyIds: string[];
  currentFloor: number;
  maxFloorReached: number;
  status: 'exploring' | 'combat' | 'extracted' | 'wiped';
  accumulatedLoot: {
    gold: number;
    items: ItemDefinition[];
    xp: number;
  };
  floorHistory: Record<number, DungeonFloor>;
}

// Pseudo-random number generator with seed
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cria uma expedição procedural para o jogador solo ou grupo
 */
export function createDungeonExpedition(
  seed: number = Date.now(),
  mode: 'solo' | 'party' = 'solo',
  partyIds: string[] = []
): DungeonExpeditionState {
  const initialFloor = generateDungeonFloor(seed, 1, mode);
  return {
    expeditionId: `expedition-${seed}`,
    seed,
    mode,
    partyIds,
    currentFloor: 1,
    maxFloorReached: 1,
    status: 'exploring',
    accumulatedLoot: {
      gold: 0,
      items: [],
      xp: 0
    },
    floorHistory: {
      1: initialFloor
    }
  };
}

/**
 * Gera um andar de masmorra conectado com salas temáticas, portas e obstáculos
 */
export function generateDungeonFloor(
  masterSeed: number,
  floorNumber: number,
  mode: 'solo' | 'party' = 'solo'
): DungeonFloor {
  const floorSeed = masterSeed + floorNumber * 7919;
  const rng = mulberry32(floorSeed);
  const gridSize = 12; // Grid tático 12x12

  // Configuração das salas do andar
  const rooms: DungeonCrawlerRoom[] = [];

  // Sala 1: Entrada / Hall de Chegada (Sempre segura)
  rooms.push({
    id: `floor-${floorNumber}-room-entry`,
    name: 'Vestíbulo das Lajes Rachadas',
    purpose: 'shrine',
    x: 1,
    y: 1,
    width: 4,
    height: 4,
    description: 'Um arco de pedra com brasões antigos. O ar aqui é frio e fresco.',
    revealed: true,
    cleared: true,
    doors: [
      {
        id: `door-entry-east`,
        x: 4,
        y: 2,
        isOpen: true,
        isLocked: false,
        isSecret: false,
        name: 'Passagem do Corredor Central'
      }
    ],
    traps: [],
    chests: [],
    shrines: [
      {
        id: `shrine-entry`,
        x: 2,
        y: 2,
        name: 'Fonte da Vitalidade Purificadora',
        isUsed: false,
        blessingName: 'Bênção da Fonte de Valdoria',
        blessingDescription: 'Restaura 10 PV e concede 5 PV temporários.',
        healHp: 10,
        temporaryHp: 5
      }
    ],
    enemies: []
  });

  // Sala 2: Câmara de Combate (Inimigos patrulheiros)
  const combatEnemyHp = mode === 'solo' ? 12 + floorNumber * 4 : 18 + floorNumber * 6;
  const combatEnemyAc = 12 + Math.min(3, Math.floor(floorNumber / 2));
  const enemyCount = mode === 'solo' ? 1 : 2;

  const room2Enemies: Enemy[] = [];
  for (let i = 0; i < enemyCount; i++) {
    room2Enemies.push({
      id: `dungeon-mob-${floorNumber}-1-${i}`,
      name: `Sentinela das Sombras ${i > 0 ? 'Batedor' : 'Guarda'}`,
      hp: combatEnemyHp,
      maxHp: combatEnemyHp,
      ac: combatEnemyAc,
      attack: 3 + Math.floor(floorNumber / 2),
      damage: '1d6+2',
      initiative: 12 + i,
      x: 7 + i,
      y: 2 + i,
      cr: floorNumber,
      aiStyle: 'skirmisher'
    });
  }

  rooms.push({
    id: `floor-${floorNumber}-room-combat`,
    name: 'Câmara dos Escribas Caídos',
    purpose: 'combat',
    x: 6,
    y: 1,
    width: 5,
    height: 4,
    description: 'Estantes de pedra partidas e pergaminhos calcinados. Sentinelas espreitam na escuridão.',
    revealed: false,
    cleared: false,
    doors: [
      {
        id: `door-combat-west`,
        x: 6,
        y: 2,
        isOpen: false,
        isLocked: false,
        isSecret: false,
        name: 'Porta de Madeira Reforçada'
      },
      {
        id: `door-combat-south`,
        x: 8,
        y: 4,
        isOpen: false,
        isLocked: false,
        isSecret: false,
        name: 'Arco de Pedra do Sul'
      }
    ],
    traps: [],
    chests: [],
    shrines: [],
    enemies: room2Enemies
  });

  // Sala 3: Sala Secreta / Tesouro
  const hasSecret = rng() > 0.3;
  const chestItems: ItemDefinition[] = [
    ITEMS_CATALOG['pocao-cura-maior'] || ITEMS_CATALOG['pocao-cura'],
    rng() > 0.5 ? ITEMS_CATALOG['amuleto-valente'] : ITEMS_CATALOG['elmo-vigilante']
  ].filter(Boolean);

  rooms.push({
    id: `floor-${floorNumber}-room-secret`,
    name: hasSecret ? 'Cripta Oculta dos Anciãos' : 'Altar de Relíquias Guardadas',
    purpose: hasSecret ? 'secret' : 'treasure',
    x: 1,
    y: 6,
    width: 4,
    height: 5,
    description: 'Um nicho secreto protegido por runas tênues. Um baú de carvalho ornamentado repousa no centro.',
    revealed: false,
    cleared: false,
    doors: [
      {
        id: `door-secret-north`,
        x: 2,
        y: 6,
        isOpen: false,
        isLocked: hasSecret,
        isSecret: hasSecret,
        name: hasSecret ? 'Parede Falsa com Fenda de Pedra' : 'Porta de Bronze'
      }
    ],
    traps: [
      {
        id: `trap-secret-chest`,
        x: 2,
        y: 8,
        name: 'Glifo Elétrico Oculto',
        type: 'glifo',
        dc: 13,
        damageFormula: '2d6',
        damageType: 'elétrico',
        isDisarmed: false,
        isTriggered: false,
        isRevealed: false
      }
    ],
    chests: [
      {
        id: `chest-secret-${floorNumber}`,
        x: 2,
        y: 9,
        name: 'Baú Rúnico dos Três Selos',
        isOpened: false,
        isLocked: true,
        gold: 40 + Math.floor(rng() * 30) * floorNumber,
        items: chestItems
      }
    ],
    shrines: [],
    enemies: []
  });

  // Sala 4: Câmara do Chefe do Andar (Mini-chefe a cada andar, Chefe Maior no 3º)
  const isFinalBossFloor = floorNumber % 3 === 0;
  const bossHp = mode === 'solo' ? (isFinalBossFloor ? 65 : 35) : (isFinalBossFloor ? 110 : 60);
  const bossAc = isFinalBossFloor ? 16 : 14;

  const bossEnemy: Enemy = {
    id: `dungeon-boss-${floorNumber}`,
    name: isFinalBossFloor
      ? `Lorde Supremo das Catacumbas (Andar ${floorNumber})`
      : `Sentinela Chefe de Cinzas (Andar ${floorNumber})`,
    hp: bossHp,
    maxHp: bossHp,
    ac: bossAc,
    attack: 5 + Math.floor(floorNumber / 2),
    damage: isFinalBossFloor ? '2d8+4' : '1d10+3',
    initiative: 15,
    x: 9,
    y: 8,
    cr: floorNumber + 2,
    aiStyle: isFinalBossFloor ? 'boss' : 'guardian'
  };

  const bossRoomEnemies: Enemy[] = [bossEnemy];
  if (mode === 'party' && isFinalBossFloor) {
    bossRoomEnemies.push({
      id: `dungeon-boss-minion-${floorNumber}`,
      name: 'Acólito da Chama Sombria',
      hp: 22,
      maxHp: 22,
      ac: 13,
      attack: 4,
      damage: '1d6+2',
      initiative: 11,
      x: 7,
      y: 9,
      cr: floorNumber,
      aiStyle: 'caster'
    });
  }

  rooms.push({
    id: `floor-${floorNumber}-room-boss`,
    name: isFinalBossFloor ? 'O Sepulcro do Lorde Sombrio' : 'Arena dos Guardiões Pétreos',
    purpose: 'boss',
    x: 6,
    y: 6,
    width: 5,
    height: 5,
    description: 'Uma abóbada grandiosa iluminada por fogo violeta. O chefe da masmorra aguarda os intrusos.',
    revealed: false,
    cleared: false,
    doors: [
      {
        id: `door-boss-north`,
        x: 8,
        y: 6,
        isOpen: false,
        isLocked: false,
        isSecret: false,
        name: 'Grande Portão de Ferro Negro'
      }
    ],
    traps: [],
    chests: [
      {
        id: `chest-boss-${floorNumber}`,
        x: 10,
        y: 10,
        name: 'Cofre do Guardião',
        isOpened: false,
        isLocked: true,
        gold: 80 * floorNumber,
        items: [
          ITEMS_CATALOG['rapieira'] || ITEMS_CATALOG['espada-longa'],
          ITEMS_CATALOG['pocao-cura-maior']
        ].filter(Boolean)
      }
    ],
    shrines: [],
    enemies: bossRoomEnemies
  });

  // Pontos de interesse
  const spawnHero = { x: 2, y: 3 };
  const stairsDown = { x: 10, y: 7, isUnlocked: false };
  const extractionPoint = { x: 1, y: 2 }; // No vestíbulo inicial

  return {
    floorNumber,
    seed: floorSeed,
    width: gridSize,
    height: gridSize,
    rooms,
    spawnHero,
    stairsDown,
    extractionPoint,
    cleared: false
  };
}

/**
 * Revela a sala em que o herói está e abre portas secretas se detectadas
 */
export function checkRoomDiscovery(
  floor: DungeonFloor,
  heroX: number,
  heroY: number,
  passivePerception: number = 12
): { updated: boolean; discoveredRoom?: DungeonCrawlerRoom; revealedSecretDoor?: DungeonDoor } {
  let updated = false;
  let discoveredRoom: DungeonCrawlerRoom | undefined;
  let revealedSecretDoor: DungeonDoor | undefined;

  for (const room of floor.rooms) {
    const inside =
      heroX >= room.x &&
      heroX < room.x + room.width &&
      heroY >= room.y &&
      heroY < room.y + room.height;

    if (inside && !room.revealed) {
      room.revealed = true;
      discoveredRoom = room;
      updated = true;
    }

    // Detecta portas secretas próximas (distância <= 2 quadrados)
    for (const door of room.doors) {
      if (door.isSecret && !door.isOpen) {
        const dist = Math.max(Math.abs(door.x - heroX), Math.abs(door.y - heroY));
        if (dist <= 2 && passivePerception >= 12) {
          door.isSecret = false;
          door.isOpen = true; // passagem revelada
          revealedSecretDoor = door;
          updated = true;
        }
      }
    }
  }

  return { updated, discoveredRoom, revealedSecretDoor };
}

/**
 * Interage com objetos físicos no chão da masmorra (porta, baú, santuário, armadilha)
 */
export function interactDungeonObject(
  floor: DungeonFloor,
  x: number,
  y: number,
  character: Character
): {
  success: boolean;
  message: string;
  type: 'door' | 'chest' | 'shrine' | 'trap' | 'stairs' | 'extraction' | 'none';
  goldFound?: number;
  itemsFound?: ItemDefinition[];
  hpRestored?: number;
  tempHpGained?: number;
  trapTriggered?: boolean;
} {
  // 1. Verificar se é Ponto de Extração
  if (floor.extractionPoint.x === x && floor.extractionPoint.y === y) {
    return {
      success: true,
      message: 'Você alcançou o Ponto de Extração das Catacumbas!',
      type: 'extraction'
    };
  }

  // 2. Verificar se é Escada de Descida
  if (floor.stairsDown.x === x && floor.stairsDown.y === y) {
    const bossRoom = floor.rooms.find((r) => r.purpose === 'boss');
    const bossAlive = bossRoom?.enemies.some((e) => e.hp > 0);
    if (bossAlive) {
      return {
        success: false,
        message: 'A passagem para o próximo andar está selada pela barreira rúnica do Chefe.',
        type: 'stairs'
      };
    }
    floor.stairsDown.isUnlocked = true;
    return {
      success: true,
      message: 'A passagem para as profundezas está aberta!',
      type: 'stairs'
    };
  }

  // 3. Verificar Portas em todas as salas
  for (const room of floor.rooms) {
    const door = room.doors.find((d) => d.x === x && d.y === y);
    if (door) {
      if (door.isLocked) {
        door.isLocked = false;
        door.isOpen = true;
        return {
          success: true,
          message: `Você destrancou e abriu a ${door.name || 'porta'}!`,
          type: 'door'
        };
      }
      door.isOpen = !door.isOpen;
      return {
        success: true,
        message: door.isOpen ? `Você abriu a ${door.name || 'porta'}.` : `Você fechou a ${door.name || 'porta'}.`,
        type: 'door'
      };
    }

    // 4. Verificar Baús
    const chest = room.chests.find((c) => c.x === x && c.y === y);
    if (chest) {
      if (chest.isOpened) {
        return {
          success: false,
          message: 'Este baú já foi saqueado e está vazio.',
          type: 'chest'
        };
      }
      chest.isOpened = true;
      chest.isLocked = false;
      return {
        success: true,
        message: `Você abriu o ${chest.name} e encontrou ${chest.gold} PO e ${chest.items.length} itens!`,
        type: 'chest',
        goldFound: chest.gold,
        itemsFound: chest.items
      };
    }

    // 5. Verificar Santuários
    const shrine = room.shrines.find((s) => s.x === x && s.y === y);
    if (shrine) {
      if (shrine.isUsed) {
        return {
          success: false,
          message: 'A energia sagrada desta fonte já foi consumida.',
          type: 'shrine'
        };
      }
      shrine.isUsed = true;
      return {
        success: true,
        message: `Você rezou junto a ${shrine.name}. ${shrine.blessingDescription}`,
        type: 'shrine',
        hpRestored: shrine.healHp || 0,
        tempHpGained: shrine.temporaryHp || 0
      };
    }

    // 6. Verificar Armadilhas
    const trap = room.traps.find((t) => t.x === x && t.y === y);
    if (trap) {
      if (trap.isDisarmed) {
        return {
          success: false,
          message: 'Esta armadilha já foi desarmada com segurança.',
          type: 'trap'
        };
      }
      // Tentativa de desarmar (DC de Ladinagem / Destreza)
      const dexMod = Math.floor(((character.stats?.dexterity ?? 10) - 10) / 2);
      const roll = Math.floor(Math.random() * 20) + 1 + dexMod;
      if (roll >= trap.dc) {
        trap.isDisarmed = true;
        return {
          success: true,
          message: `Sucesso! Você desarmou a armadilha (${trap.name}) com rolagem ${roll} contra DC ${trap.dc}.`,
          type: 'trap'
        };
      } else {
        trap.isTriggered = true;
        return {
          success: false,
          message: `Falha! A armadilha (${trap.name}) disparou!`,
          type: 'trap',
          trapTriggered: true
        };
      }
    }
  }

  return {
    success: false,
    message: 'Nenhum objeto interativo nesta posição.',
    type: 'none'
  };
}

/**
 * Avalia se o combate na sala deve ser acionado ao adentrar as coordenadas
 */
export function checkRoomCombatEncounter(
  floor: DungeonFloor,
  heroX: number,
  heroY: number
): { shouldTriggerCombat: boolean; room?: DungeonCrawlerRoom; enemiesToFight: Enemy[] } {
  for (const room of floor.rooms) {
    if (room.cleared) continue;

    const inside =
      heroX >= room.x &&
      heroX < room.x + room.width &&
      heroY >= room.y &&
      heroY < room.y + room.height;

    if (inside) {
      const aliveEnemies = room.enemies.filter((e) => e.hp > 0);
      if (aliveEnemies.length > 0) {
        return {
          shouldTriggerCombat: true,
          room,
          enemiesToFight: aliveEnemies
        };
      } else {
        room.cleared = true;
      }
    }
  }

  return { shouldTriggerCombat: false, enemiesToFight: [] };
}

/**
 * Converte portas fechadas e paredes de masmorra em conjunto de coordenadas bloqueadas
 */
export function getDungeonObstacleCoordinates(floor: DungeonFloor): Set<string> {
  const blocked = new Set<string>();

  // Portas fechadas bloqueiam passagem
  for (const room of floor.rooms) {
    for (const door of room.doors) {
      if (!door.isOpen) {
        blocked.add(`${door.x},${door.y}`);
      }
    }
  }

  return blocked;
}
