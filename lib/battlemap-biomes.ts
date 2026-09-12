// lib/battlemap-biomes.ts
// Gerador de Mapas Orgânicos para D&D 5e: Vilas, Florestas, Rios e Catacumbas
// Baseado nas referências visuais de mapas táticos de RPG de mesa

export type OrganicTileType =
  | 'grass'
  | 'road'
  | 'water'
  | 'bridge'
  | 'tree'
  | 'building_wall'
  | 'building_floor'
  | 'door'
  | 'well'
  | 'chest'
  | 'shrine'
  | 'stairs'
  | 'pillar';

export type BiomeType = 'village' | 'forest' | 'ruins' | 'dungeon' | 'canyon' | 'lair';

export interface BattlemapTile {
  x: number;
  y: number;
  type: OrganicTileType;
  label?: string;
  revealed?: boolean;
  interactive?: boolean;
  blocksMovement?: boolean;
  blocksSight?: boolean;
}

export interface Battlemap {
  id: string;
  name: string;
  biome: BiomeType;
  width: number;
  height: number;
  tiles: BattlemapTile[][];
  description: string;
  spawnHero: { x: number; y: number };
  spawnEnemy?: { x: number; y: number };
  interactables: { x: number; y: number; type: OrganicTileType; name: string; description: string }[];
  seed: number;
}

// Pseudo-random number generator
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateBattlemap(
  biome: BiomeType = 'village',
  size: 8 | 12 | 16 = 12,
  customSeed = Date.now()
): Battlemap {
  const rng = mulberry32(customSeed);
  const width = size;
  const height = size;

  const tiles: BattlemapTile[][] = [];

  // Helper to create empty grid
  const initGrid = (defaultType: OrganicTileType) => {
    for (let y = 0; y < height; y++) {
      const row: BattlemapTile[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          x,
          y,
          type: defaultType,
          revealed: true,
          blocksMovement: false,
          blocksSight: false
        });
      }
      tiles.push(row);
    }
  };

  const interactables: Battlemap['interactables'] = [];

  if (biome === 'village') {
    // -------------------------------------------------------------
    // BIOMA 1: VILA DO RIO VERDE (Inspirado nas Referências 1 e 3)
    // Gramado, estradas de terra curvas, rio com pontes, casas com paredes de pedra
    // e piso de madeira, poço central, árvores e caixotes de suprimentos.
    // -------------------------------------------------------------
    initGrid('grass');

    // 1. Rio serpenteando pela lateral leste (x = width - 3 ou curva)
    const riverXOffset = Math.max(3, width - 4);
    for (let y = 0; y < height; y++) {
      // Curva leve no rio
      const rx = riverXOffset + (y % 3 === 0 ? 1 : y % 4 === 1 ? -1 : 0);
      for (let dx = -1; dx <= 0; dx++) {
        const tx = Math.max(0, Math.min(width - 1, rx + dx));
        tiles[y][tx].type = 'water';
        tiles[y][tx].blocksMovement = true;
      }
    }

    // 2. Pontes de madeira cruzando o rio (1 ou 2 pontes)
    const bridgeY1 = Math.floor(height * 0.3);
    const bridgeY2 = Math.floor(height * 0.75);
    [bridgeY1, bridgeY2].forEach((by) => {
      if (by < height) {
        for (let x = 0; x < width; x++) {
          if (tiles[by][x].type === 'water') {
            tiles[by][x].type = 'bridge';
            tiles[by][x].blocksMovement = false;
            tiles[by][x].label = 'Ponte de Madeira';
          }
        }
      }
    });

    // 3. Estradas de terra sinuosas conectando praça, casas e ponte
    const midY = Math.floor(height / 2);
    // Estrada principal Leste-Oeste
    for (let x = 1; x < riverXOffset; x++) {
      if (tiles[midY][x].type !== 'water') {
        tiles[midY][x].type = 'road';
      }
    }
    // Estrada Norte-Sul na margem da vila
    const roadX = Math.floor(width * 0.35);
    for (let y = 1; y < height - 1; y++) {
      if (tiles[y][roadX].type !== 'water' && tiles[y][roadX].type !== 'building_wall') {
        tiles[y][roadX].type = 'road';
      }
    }
    // Caminho para a ponte
    for (let x = roadX; x <= riverXOffset; x++) {
      if (tiles[bridgeY1][x].type !== 'water') tiles[bridgeY1][x].type = 'road';
    }

    // 4. Casas / Construções (Parede de pedra exterior, piso de madeira interior, portas)
    // Casa 1: Canto Noroeste (Taverna / Casa do Ancião)
    const house1W = Math.min(4, Math.floor(width * 0.3));
    const house1H = Math.min(4, Math.floor(height * 0.3));
    for (let y = 1; y <= house1H; y++) {
      for (let x = 1; x <= house1W; x++) {
        const isBorder = y === 1 || y === house1H || x === 1 || x === house1W;
        if (isBorder) {
          // Deixar espaço para porta
          if (y === house1H && x === Math.floor(house1W / 2) + 1) {
            tiles[y][x].type = 'door';
            tiles[y][x].label = 'Porta da Taverna';
          } else {
            tiles[y][x].type = 'building_wall';
            tiles[y][x].blocksMovement = true;
            tiles[y][x].blocksSight = true;
          }
        } else {
          tiles[y][x].type = 'building_floor';
        }
      }
    }

    // Casa 2: Canto Sudoeste (Oficina / Alquimista)
    if (size >= 12) {
      const h2StartY = height - 5;
      for (let y = h2StartY; y < height - 1; y++) {
        for (let x = 1; x <= 4; x++) {
          const isBorder = y === h2StartY || y === height - 2 || x === 1 || x === 4;
          if (isBorder) {
            if (y === h2StartY && x === 3) {
              tiles[y][x].type = 'door';
              tiles[y][x].label = 'Porta da Alquimista';
            } else {
              tiles[y][x].type = 'building_wall';
              tiles[y][x].blocksMovement = true;
              tiles[y][x].blocksSight = true;
            }
          } else {
            tiles[y][x].type = 'building_floor';
          }
        }
      }
    }

    // 5. Elementos de Praça e Cenário
    // Poço de pedra central
    const wellX = roadX + 1;
    const wellY = midY - 1;
    if (wellX < width && wellY < height) {
      tiles[wellY][wellX].type = 'well';
      tiles[wellY][wellX].blocksMovement = true;
      interactables.push({
        x: wellX,
        y: wellY,
        type: 'well',
        name: 'Poço de Pedra da Vila',
        description: 'Água fresca e cristalina. O reflexo revela lendas ancestrais.'
      });
    }

    // Baú de suprimentos / Barracas
    const chestX = roadX;
    const chestY = midY + 2;
    if (chestX < width && chestY < height) {
      tiles[chestY][chestX].type = 'chest';
      interactables.push({
        x: chestX,
        y: chestY,
        type: 'chest',
        name: 'Caixas de Suprimentos da Vila',
        description: 'Contém provisões e poções deixadas para a expedição.'
      });
    }

    // 6. Árvores e Vegetação (copas verdes arredondadas)
    const treePositions = [
      { x: 1, y: midY },
      { x: house1W + 1, y: 1 },
      { x: roadX - 1, y: height - 2 },
      { x: width - 1, y: 2 },
      { x: width - 1, y: height - 3 },
      { x: width - 2, y: Math.floor(height / 2) }
    ];
    treePositions.forEach((tp) => {
      if (tp.x < width && tp.y < height && tiles[tp.y][tp.x].type === 'grass') {
        tiles[tp.y][tp.x].type = 'tree';
        tiles[tp.y][tp.x].blocksMovement = true;
      }
    });

    return {
      id: `map-village-${customSeed}`,
      name: 'Vila do Rio Verde • Valdoria',
      biome: 'village',
      width,
      height,
      tiles,
      description: 'Um assentamento tranquilo cercado por campos verdejantes, caminhos de terra batida, casas de pedra e o Rio Cristalino atravessado por pontes de madeira.',
      spawnHero: { x: roadX, y: midY },
      spawnEnemy: { x: width - 1, y: bridgeY1 },
      interactables,
      seed: customSeed
    };
  } else if (biome === 'forest') {
    // -------------------------------------------------------------
    // BIOMA 2: TRILHA DA FLORESTA & LAGO (Inspirado na Referência 3)
    // Bosque denso, lago com ilha, trilha sinuosa, santuário druídico
    // -------------------------------------------------------------
    initGrid('grass');

    // 1. Grande Lago no Canto Superior
    const lakeW = Math.max(3, Math.floor(width * 0.4));
    const lakeH = Math.max(3, Math.floor(height * 0.4));
    for (let y = 1; y < lakeH; y++) {
      for (let x = 1; x < lakeW; x++) {
        // Ilhota no meio do lago
        if (x === Math.floor(lakeW / 2) && y === Math.floor(lakeH / 2)) {
          tiles[y][x].type = 'grass';
          tiles[y][x].type = 'shrine'; // Santuário na ilha
          interactables.push({
            x,
            y,
            type: 'shrine',
            name: 'Monólito da Ilha Sagrada',
            description: 'Um menir esculpido por druidas antigos irradia luz esmeralda.'
          });
        } else {
          tiles[y][x].type = 'water';
          tiles[y][x].blocksMovement = true;
        }
      }
    }

    // 2. Trilha sinuosa cortando a floresta do Sul até o Leste
    let curX = Math.floor(width / 2);
    for (let y = height - 1; y >= 0; y--) {
      tiles[y][curX].type = 'road';
      if (curX + 1 < width) tiles[y][curX + 1].type = 'road';
      // Desvio orgânico
      if (y % 2 === 0 && curX < width - 3) curX++;
    }

    // 3. Círculo de Pedras / Santuário na Clareira
    const shrineX = width - 3;
    const shrineY = Math.floor(height * 0.4);
    if (shrineX < width && shrineY < height) {
      tiles[shrineY][shrineX].type = 'shrine';
      interactables.push({
        x: shrineX,
        y: shrineY,
        type: 'shrine',
        name: 'Altar da Clareira Druídica',
        description: 'Círculo de pedras envolto em musgo e runas antigas.'
      });
      // Pilares de pedra ao redor
      if (shrineY - 1 >= 0) tiles[shrineY - 1][shrineX].type = 'pillar';
      if (shrineY + 1 < height) tiles[shrineY + 1][shrineX].type = 'pillar';
    }

    // 4. Baú escondido entre raízes
    const chestX = width - 2;
    const chestY = height - 2;
    tiles[chestY][chestX].type = 'chest';
    interactables.push({
      x: chestX,
      y: chestY,
      type: 'chest',
      name: 'Baú Oculto nas Raízes',
      description: 'Baú coberto por hera contendo oferendas da floresta.'
    });

    // 5. Aglomerados de Árvores Densas
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x].type === 'grass') {
          // Probabilidade orgânica de árvores nas bordas
          const distEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
          if (distEdge <= 1 || (x > lakeW && y < 3) || (x < 3 && y > lakeH)) {
            tiles[y][x].type = 'tree';
            tiles[y][x].blocksMovement = true;
          }
        }
      }
    }

    return {
      id: `map-forest-${customSeed}`,
      name: 'Trilha da Floresta dos Sussurros',
      biome: 'forest',
      width,
      height,
      tiles,
      description: 'Bosques profundos com copas altas de carvalho, lago cristalino com menir sagrado e caminhos de terra onde emboscadas espreitam entre as folhagens.',
      spawnHero: { x: Math.floor(width / 2), y: height - 2 },
      spawnEnemy: { x: shrineX, y: shrineY - 1 },
      interactables,
      seed: customSeed
    };
  } else if (biome === 'dungeon') {
    // -------------------------------------------------------------
    // BIOMA 3: CATACUMBAS E TEMPLO MODULAR (Inspirado na Referência 2)
    // Câmaras conectadas, colunas, altares, piscinas de água ritual e escadas
    // -------------------------------------------------------------
    initGrid('pillar'); // Paredes de rocha escavada por padrão
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles[y][x].type = 'building_wall';
        tiles[y][x].blocksMovement = true;
        tiles[y][x].blocksSight = true;
      }
    }

    // Esculpir 4 câmaras modulares conectadas por corredores
    const roomA = { x: 1, y: 1, w: Math.floor(width / 2) - 1, h: Math.floor(height / 2) - 1 };
    const roomB = { x: Math.floor(width / 2) + 1, y: 1, w: Math.floor(width / 2) - 2, h: Math.floor(height / 2) - 1 };
    const roomC = { x: 1, y: Math.floor(height / 2) + 1, w: Math.floor(width / 2) - 1, h: Math.floor(height / 2) - 2 };
    const roomD = { x: Math.floor(width / 2) + 1, y: Math.floor(height / 2) + 1, w: Math.floor(width / 2) - 2, h: Math.floor(height / 2) - 2 };

    [roomA, roomB, roomC, roomD].forEach((rm) => {
      for (let y = rm.y; y < rm.y + rm.h; y++) {
        for (let x = rm.x; x < rm.x + rm.w; x++) {
          if (y < height && x < width) {
            tiles[y][x].type = 'building_floor';
            tiles[y][x].blocksMovement = false;
            tiles[y][x].blocksSight = false;
          }
        }
      }
    });

    // Corredor Central em Cruz
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    for (let x = 1; x < width - 1; x++) {
      tiles[midY][x].type = 'building_floor';
      tiles[midY][x].blocksMovement = false;
      tiles[midY][x].blocksSight = false;
    }
    for (let y = 1; y < height - 1; y++) {
      tiles[y][midX].type = 'building_floor';
      tiles[y][midX].blocksMovement = false;
      tiles[y][midX].blocksSight = false;
    }

    // Piscina de Água Ritual na câmara central (como na Referência 2)
    tiles[midY][midX].type = 'water';
    tiles[midY][midX].label = 'Fonte de Água Arcana';

    // Pilares arquitetônicos nas câmaras
    tiles[roomA.y + 1][roomA.x + 1].type = 'pillar';
    tiles[roomB.y + 1][roomB.x + 1].type = 'pillar';

    // Baú ancestral
    tiles[roomA.y + 1][roomA.x + rmW(roomA) - 1].type = 'chest';
    interactables.push({
      x: roomA.x + rmW(roomA) - 1,
      y: roomA.y + 1,
      type: 'chest',
      name: 'Arca Funerária de Obsidiana',
      description: 'Baú decorado com relevos de crânios contendo relíquias e ouro.'
    });

    // Altar ritual
    tiles[roomB.y + 1][roomB.x + rmW(roomB) - 1].type = 'shrine';
    interactables.push({
      x: roomB.x + rmW(roomB) - 1,
      y: roomB.y + 1,
      type: 'shrine',
      name: 'Altar dos Três Selos',
      description: 'Mesa de sacrifício onde chamas violetas ardem sem combustível.'
    });

    // Escadas para o nível inferior
    const stairsX = width - 2;
    const stairsY = height - 2;
    tiles[stairsY][stairsX].type = 'stairs';
    interactables.push({
      x: stairsX,
      y: stairsY,
      type: 'stairs',
      name: 'Escadaria para o Trono do Vazio',
      description: 'Degraus de pedra fria descendo em espiral para as profundezas.'
    });

    return {
      id: `map-dungeon-${customSeed}`,
      name: 'Catacumbas dos Três Selos',
      biome: 'dungeon',
      width,
      height,
      tiles,
      description: 'Salões funerários de pedra talhada divididos em câmaras modulares, com piscinas de água pura, colunas de sustentação e sarcófagos esquecidos.',
      spawnHero: { x: 1, y: midY },
      spawnEnemy: { x: width - 3, y: midY },
      interactables,
      seed: customSeed
    };
  } else if (biome === 'ruins') {
    // -------------------------------------------------------------
    // BIOMA 4: PÁTIO DA ANTIGA ABADIA (Ruínas Externas)
    // -------------------------------------------------------------
    initGrid('building_floor');

    // Manchas de vegetação rasteira
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((x * 2 + y * 3) % 5 === 0 && x > 1 && x < width - 2 && y > 1 && y < height - 2) {
          tiles[y][x].type = 'grass';
        }
      }
    }

    // Muralhas quebradas com passagens naturais
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    for (let x = 0; x < width; x++) {
      if (x !== midX && x !== midX - 1) {
        tiles[0][x].type = 'building_wall';
        tiles[0][x].blocksMovement = true;
        tiles[0][x].blocksSight = true;
        tiles[height - 1][x].type = 'building_wall';
        tiles[height - 1][x].blocksMovement = true;
        tiles[height - 1][x].blocksSight = true;
      }
    }
    for (let y = 0; y < height; y++) {
      if (y !== midY && y !== midY - 1) {
        tiles[y][0].type = 'building_wall';
        tiles[y][0].blocksMovement = true;
        tiles[y][0].blocksSight = true;
        tiles[y][width - 1].type = 'building_wall';
        tiles[y][width - 1].blocksMovement = true;
        tiles[y][width - 1].blocksSight = true;
      }
    }

    // Colunas de basalto caídas
    const pX1 = Math.floor(width * 0.3);
    const pX2 = Math.floor(width * 0.7);
    const pY1 = Math.floor(height * 0.3);
    const pY2 = Math.floor(height * 0.7);
    [
      { x: pX1, y: pY1 },
      { x: pX2, y: pY1 },
      { x: pX1, y: pY2 },
      { x: pX2, y: pY2 }
    ].forEach((p) => {
      if (p.x < width && p.y < height) {
        tiles[p.y][p.x].type = 'pillar';
        tiles[p.y][p.x].blocksMovement = true;
        tiles[p.y][p.x].blocksSight = true;
      }
    });

    // Altar central calcinado
    tiles[midY][midX].type = 'shrine';
    interactables.push({
      x: midX,
      y: midY,
      type: 'shrine',
      name: 'Altar das Cinzas Ancestrais',
      description: 'Mesa de pedra enegrecida por labaredas arcanas, coberta de oferendas e cinzas frias.'
    });

    // Baú secreto em nicho de pedra
    const chestX = width - 3;
    const chestY = 2;
    tiles[chestY][chestX].type = 'chest';
    interactables.push({
      x: chestX,
      y: chestY,
      type: 'chest',
      name: 'Arca dos Monges Caídos',
      description: 'Caixa de ferro e mogno resistente ao fogo, deixada para trás durante a queda da abadia.'
    });

    // Escadas para as catacumbas
    const stairsX = 2;
    const stairsY = height - 3;
    tiles[stairsY][stairsX].type = 'stairs';
    interactables.push({
      x: stairsX,
      y: stairsY,
      type: 'stairs',
      name: 'Passagem para as Catacumbas',
      description: 'Degraus escavados que descem para os túmulos subterrâneos.'
    });

    return {
      id: `map-ruins-${customSeed}`,
      name: 'Pátio das Ruínas da Abadia',
      biome: 'ruins',
      width,
      height,
      tiles,
      description: 'Antigos claustros sob névoa de fuligem. Paredes derruídas, colunas caídas e o altar central profanado por sacerdotes das cinzas.',
      spawnHero: { x: 1, y: midY },
      spawnEnemy: { x: width - 3, y: midY },
      interactables,
      seed: customSeed
    };
  } else if (biome === 'canyon') {
    // -------------------------------------------------------------
    // BIOMA 5: DESFILADEIRO DA FENDA ESCARPADA (Trilha Vulcânica)
    // -------------------------------------------------------------
    initGrid('road');

    // Paredões rochosos nas margens norte e sul
    for (let x = 0; x < width; x++) {
      tiles[0][x].type = 'building_wall';
      tiles[0][x].blocksMovement = true;
      tiles[0][x].blocksSight = true;
      tiles[height - 1][x].type = 'building_wall';
      tiles[height - 1][x].blocksMovement = true;
      tiles[height - 1][x].blocksSight = true;
    }

    // Fenda profunda central
    const chasmX = Math.floor(width * 0.55);
    for (let y = 1; y < height - 1; y++) {
      tiles[y][chasmX].type = 'water';
      tiles[y][chasmX].blocksMovement = true;
      tiles[y][chasmX].label = 'Fenda de Enxofre';
    }

    // Pontes naturais de rocha sobre a fenda
    const bridgeY1 = Math.floor(height * 0.35);
    const bridgeY2 = Math.floor(height * 0.7);
    [bridgeY1, bridgeY2].forEach((by) => {
      if (by < height) {
        tiles[by][chasmX].type = 'bridge';
        tiles[by][chasmX].blocksMovement = false;
        tiles[by][chasmX].label = 'Ponte Natural de Rocha';
      }
    });

    // Monólito de aviso dracônico
    const shrineX = Math.min(width - 2, chasmX + 2);
    const shrineY = Math.floor(height * 0.3);
    tiles[shrineY][shrineX].type = 'shrine';
    interactables.push({
      x: shrineX,
      y: shrineY,
      type: 'shrine',
      name: 'Monólito das Chamas Dracônicas',
      description: 'Pilar de basalto gravado com asas e garras, emanando calor intenso da crista da montanha.'
    });

    // Ninho de brasas / baú
    const nestX = width - 2;
    const nestY = height - 3;
    tiles[nestY][nestX].type = 'chest';
    interactables.push({
      x: nestX,
      y: nestY,
      type: 'chest',
      name: 'Ninho de Brasas do Wyrmling',
      description: 'Ninho rochoso contendo oferendas roubadas, relíquias calcinadas e escamas brilhantes.'
    });

    // Escadas para a cratera vulcânica
    const stairsX = width - 2;
    const stairsY = 2;
    tiles[stairsY][stairsX].type = 'stairs';
    interactables.push({
      x: stairsX,
      y: stairsY,
      type: 'stairs',
      name: 'Subida da Cratera Vulcânica',
      description: 'Caminho sinuoso e íngreme conduzindo diretamente ao covil do Dragão.'
    });

    const midY = Math.floor(height / 2);
    return {
      id: `map-canyon-${customSeed}`,
      name: 'Desfiladeiro da Fenda Escarpada',
      biome: 'canyon',
      width,
      height,
      tiles,
      description: 'Paredões de basalto escuro com fendas de enxofre ardente. Pontes de pedra estreitas e ninhos de wyrmlings onde patrulhas espreitam.',
      spawnHero: { x: 1, y: midY },
      spawnEnemy: { x: shrineX, y: shrineY + 1 },
      interactables,
      seed: customSeed
    };
  } else {
    // -------------------------------------------------------------
    // BIOMA 6: O COVIL DE IGNISRAX (Cratera Magmática & Arena do Dragão)
    // -------------------------------------------------------------
    initGrid('building_floor');

    // Paredes da câmara vulcânica
    for (let x = 0; x < width; x++) {
      tiles[0][x].type = 'building_wall';
      tiles[0][x].blocksMovement = true;
      tiles[0][x].blocksSight = true;
      tiles[height - 1][x].type = 'building_wall';
      tiles[height - 1][x].blocksMovement = true;
      tiles[height - 1][x].blocksSight = true;
    }
    for (let y = 0; y < height; y++) {
      tiles[y][0].type = 'building_wall';
      tiles[y][0].blocksMovement = true;
      tiles[y][0].blocksSight = true;
      tiles[y][width - 1].type = 'building_wall';
      tiles[y][width - 1].blocksMovement = true;
      tiles[y][width - 1].blocksSight = true;
    }

    // 4 Pilares maciços de basalto para cobertura tática
    const colX1 = Math.floor(width * 0.3);
    const colX2 = Math.floor(width * 0.7);
    const colY1 = Math.floor(height * 0.3);
    const colY2 = Math.floor(height * 0.7);
    [
      { x: colX1, y: colY1 },
      { x: colX2, y: colY1 },
      { x: colX1, y: colY2 },
      { x: colX2, y: colY2 }
    ].forEach((p) => {
      tiles[p.y][p.x].type = 'pillar';
      tiles[p.y][p.x].blocksMovement = true;
      tiles[p.y][p.x].blocksSight = true;
      tiles[p.y][p.x].label = 'Pilar de Basalto';
    });

    // Fendas de magma
    for (let y = 2; y < height - 2; y++) {
      if (y % 2 === 0) {
        const mx = Math.floor(width * 0.5);
        tiles[y][mx].type = 'water';
        tiles[y][mx].blocksMovement = true;
        tiles[y][mx].label = 'Fenda de Magma';
      }
    }

    // Plataforma do Tesouro / Trono de Ignisrax
    const bossPlatformX = Math.floor(width * 0.75);
    const bossPlatformY = Math.floor(height / 2);
    tiles[bossPlatformY][bossPlatformX].type = 'shrine';
    interactables.push({
      x: bossPlatformX,
      y: bossPlatformY,
      type: 'shrine',
      name: 'Monte de Ouro e Cinzas de Ignisrax',
      description: 'Uma montanha cintilante de moedas de ouro antigas, armaduras calcinadas e pedras preciosas aquecidas pelo sopro do Dragão.'
    });

    // Baú lendário do dragão
    const chestY = bossPlatformY + 2 < height - 1 ? bossPlatformY + 2 : bossPlatformY - 2;
    tiles[chestY][bossPlatformX].type = 'chest';
    interactables.push({
      x: bossPlatformX,
      y: chestY,
      type: 'chest',
      name: 'Arca Primordial de Valdoria',
      description: 'Baú lendário de ferro negro selado com runas protetoras, guardado no centro do covil.'
    });

    // Escadaria de saída / retorno
    const midY = Math.floor(height / 2);
    tiles[midY][1].type = 'stairs';
    interactables.push({
      x: 1,
      y: midY,
      type: 'stairs',
      name: 'Passagem para o Desfiladeiro',
      description: 'Túnel estreito de rocha que conduz de volta à encosta do desfiladeiro.'
    });

    return {
      id: `map-lair-${customSeed}`,
      name: 'O Covil de Ignisrax • Cratera Magmática',
      biome: 'lair',
      width,
      height,
      tiles,
      description: 'A colossal câmara vulcânica do Dragão Vermelho. Pilares de basalto oferecem proteção tática contra o sopro de fogo enquanto fendas de magma iluminam o covil.',
      spawnHero: { x: 2, y: midY },
      spawnEnemy: { x: bossPlatformX, y: bossPlatformY },
      interactables,
      seed: customSeed
    };
  }

  function rmW(rm: { w: number }) {
    return Math.max(1, rm.w);
  }
}

