// lib/collision-system.ts
/**
 * Collision System & Pathfinding Engine for Illustrated D&D Maps
 * Supports normalized polygon regions, grid-obstacle conversion, A* pathfinding,
 * remaining movement calculation, and collision visualization.
 */

export interface Point {
  x: number;
  y: number;
}

export type MapZoneType = 'obstacle' | 'walkable' | 'water' | 'difficult' | 'bloqueado' | 'agua' | 'caminhavel' | 'porta' | 'ponte';

export interface CollisionPolygon {
  id: string;
  name: string;
  type: MapZoneType;
  // Normalized coordinates from 0.0 to 1.0
  points: [number, number][];
}

export type BiomeType = 'village' | 'forest' | 'ruins' | 'dungeon' | 'canyon' | 'lair';

export interface MapCollisionProfile {
  biome: BiomeType;
  imageSrc: string;
  // Normalized obstacle polygons (blocked to movement)
  obstacles: CollisionPolygon[];
  // Walkable designated bridges/corridors that override obstacles (e.g. bridge over river)
  walkableBridges?: CollisionPolygon[];
  // Complete zones from map editor if available
  customZones?: CollisionPolygon[];
  // Standard grid dimensions for this map profile (default 8)
  gridSize?: number;
}

/**
 * Zonas precisas desenhadas no Map Editor para a Vila (/maps/vila.png)
 */
export const VILLAGE_CUSTOM_ZONES: CollisionPolygon[] = [
  {
    id: "zone-1789083656990",
    name: "Bloqueado (Parede/Obstáculo) 1",
    type: "bloqueado",
    points: [
      [0.0537, 0.1114],
      [0.1319, 0.1114],
      [0.1319, 0.1922],
      [0.0537, 0.1922]
    ]
  },
  {
    id: "zone-1789083659714",
    name: "Bloqueado (Parede/Obstáculo) 2",
    type: "bloqueado",
    points: [
      [0.0447, 0.2409],
      [0.1255, 0.2409],
      [0.1255, 0.3807],
      [0.0447, 0.3807]
    ]
  },
  {
    id: "zone-1789083665572",
    name: "Bloqueado (Parede/Obstáculo) 3",
    type: "bloqueado",
    points: [
      [0.0306, 0.4487],
      [0.1306, 0.4487],
      [0.1306, 0.5513],
      [0.0306, 0.5513]
    ]
  },
  {
    id: "zone-1789083668398",
    name: "Bloqueado (Parede/Obstáculo) 4",
    type: "bloqueado",
    points: [
      [0.0678, 0.5962],
      [0.1627, 0.5962],
      [0.1627, 0.7437],
      [0.0678, 0.7437]
    ]
  },
  {
    id: "zone-1789083670180",
    name: "Bloqueado (Parede/Obstáculo) 5",
    type: "bloqueado",
    points: [
      [0.0909, 0.7937],
      [0.1601, 0.7937],
      [0.1601, 0.8732],
      [0.0909, 0.8732]
    ]
  },
  {
    id: "zone-1789083672404",
    name: "Bloqueado (Parede/Obstáculo) 6",
    type: "bloqueado",
    points: [
      [0.2358, 0.8104],
      [0.3512, 0.8104],
      [0.3512, 0.9014],
      [0.2358, 0.9014]
    ]
  },
  {
    id: "zone-1789083675756",
    name: "Bloqueado (Parede/Obstáculo) 7",
    type: "bloqueado",
    points: [
      [0.3448, 0.5898],
      [0.4064, 0.5898],
      [0.4064, 0.7642],
      [0.3448, 0.7642]
    ]
  },
  {
    id: "zone-1789083678099",
    name: "Bloqueado (Parede/Obstáculo) 8",
    type: "bloqueado",
    points: [
      [0.2281, 0.609],
      [0.3679, 0.609],
      [0.3679, 0.7001],
      [0.2281, 0.7001]
    ]
  },
  {
    id: "zone-1789083680373",
    name: "Bloqueado (Parede/Obstáculo) 9",
    type: "bloqueado",
    points: [
      [0.2294, 0.2242],
      [0.3564, 0.2242],
      [0.3564, 0.323],
      [0.2294, 0.323]
    ]
  },
  {
    id: "zone-1789083682322",
    name: "Bloqueado (Parede/Obstáculo) 10",
    type: "bloqueado",
    points: [
      [0.3461, 0.0986],
      [0.4641, 0.0986],
      [0.4641, 0.1922],
      [0.3461, 0.1922]
    ]
  },
  {
    id: "zone-1789083686087",
    name: "Bloqueado (Parede/Obstáculo) 11",
    type: "bloqueado",
    points: [
      [0.5372, 0.0614],
      [0.6141, 0.0614],
      [0.6141, 0.1858],
      [0.5372, 0.1858]
    ]
  },
  {
    id: "zone-1789083689757",
    name: "Bloqueado (Parede/Obstáculo) 12",
    type: "bloqueado",
    points: [
      [0.4743, 0.609],
      [0.5475, 0.609],
      [0.5475, 0.7206],
      [0.4743, 0.7206]
    ]
  },
  {
    id: "zone-1789083693411",
    name: "Bloqueado (Parede/Obstáculo) 13",
    type: "bloqueado",
    points: [
      [0.4346, 0.7719],
      [0.5475, 0.7719],
      [0.5475, 0.8566],
      [0.4346, 0.8566]
    ]
  },
  {
    id: "zone-1789083709501",
    name: "Bloqueado (Parede/Obstáculo) 14",
    type: "bloqueado",
    points: [
      [0.7309, 0.0473],
      [0.727, 0.1127],
      [0.7039, 0.1563],
      [0.7039, 0.2127],
      [0.7437, 0.2114],
      [0.7437, 0.2473],
      [0.7988, 0.2486],
      [0.8053, 0.2063],
      [0.8437, 0.214],
      [0.8463, 0.1255],
      [0.8104, 0.0473],
      [0.7886, 0.0216],
      [0.7296, 0.0498]
    ]
  },
  {
    id: "zone-1789083718225",
    name: "Bloqueado (Parede/Obstáculo) 15",
    type: "bloqueado",
    points: [
      [0.6411, 0.509],
      [0.6218, 0.577],
      [0.609, 0.6539],
      [0.6834, 0.6757],
      [0.7039, 0.6013],
      [0.7347, 0.6116],
      [0.7488, 0.541],
      [0.6436, 0.509]
    ]
  },
  {
    id: "zone-1789083724406",
    name: "Bloqueado (Parede/Obstáculo) 16",
    type: "bloqueado",
    points: [
      [0.7629, 0.6],
      [0.8771, 0.5898],
      [0.8937, 0.686],
      [0.7758, 0.7078],
      [0.7693, 0.6052]
    ]
  },
  {
    id: "zone-1789083737894",
    name: "Água Profunda 17",
    type: "agua",
    points: [
      [0.7822, 0.7668],
      [0.8809, 0.7629],
      [0.8758, 0.8886],
      [0.9258, 0.8822],
      [0.922, 0.8014],
      [0.9976, 0.8014],
      [0.9976, 0.9694],
      [0.8117, 0.9258],
      [0.7886, 0.8822],
      [0.7847, 0.7693]
    ]
  },
  {
    id: "zone-1789083746548",
    name: "Água Profunda 18",
    type: "agua",
    points: [
      [0.6783, 0.3089],
      [0.8873, 0.4166],
      [0.8694, 0.4833],
      [0.7911, 0.4218],
      [0.7424, 0.4064],
      [0.6693, 0.3692],
      [0.6783, 0.3012]
    ]
  },
  {
    id: "zone-1789083752101",
    name: "Água Profunda 19",
    type: "agua",
    points: [
      [0.9425, 0.4269],
      [0.9951, 0.4333],
      [0.9964, 0.491],
      [0.9361, 0.4897],
      [0.9399, 0.4346]
    ]
  },
  {
    id: "zone-1789083760561",
    name: "Bloqueado (Parede/Obstáculo) 20",
    type: "bloqueado",
    points: [
      [0.5167, 0.2422],
      [0.618, 0.2781],
      [0.5923, 0.3615],
      [0.5, 0.3358],
      [0.5167, 0.2486]
    ]
  },
  {
    id: "zone-1789083859445",
    name: "Caminhável (Passagem) 21",
    type: "caminhavel",
    points: [
      [0.1422, 0.1986],
      [0.1909, 0.1794],
      [0.1909, 0.0755],
      [0.2653, 0.0793],
      [0.2589, 0.1832],
      [0.4731, 0.2089],
      [0.4731, 0.105],
      [0.5218, 0.1127],
      [0.5154, 0.2153],
      [0.8053, 0.2717],
      [0.8129, 0.2307],
      [0.8617, 0.2345],
      [0.8707, 0.2858],
      [0.9951, 0.2781],
      [0.9912, 0.3217],
      [0.8489, 0.3333],
      [0.3743, 0.2307],
      [0.0139, 0.2448],
      [0.0024, 0.1524],
      [0.0473, 0.1563],
      [0.0562, 0.2089],
      [0.1409, 0.2012]
    ]
  },
  {
    id: "zone-1789083891384",
    name: "Caminhável (Passagem) 22",
    type: "caminhavel",
    points: [
      [0, 0.2537],
      [0.0357, 0.2602],
      [0.028, 0.4128],
      [0.1345, 0.4205],
      [0.1345, 0.2563],
      [0.2037, 0.2589],
      [0.196, 0.4333],
      [0.223, 0.9232],
      [0.1729, 0.9168],
      [0.1729, 0.5821],
      [0.1319, 0.5834],
      [0.1345, 0.4448],
      [0.0229, 0.4551],
      [0.0255, 0.5552],
      [0.1255, 0.5616],
      [0.1152, 0.5898],
      [0.0537, 0.5962],
      [0.0614, 0.7437],
      [0.1601, 0.7527],
      [0.1576, 0.7822],
      [0.0768, 0.7834],
      [0.0832, 0.8732],
      [0.1717, 0.9079],
      [0.1383, 0.9553],
      [0.0024, 0.8578],
      [0.0075, 0.2537]
    ]
  },
  {
    id: "zone-1789083965868",
    name: "Caminhável (Passagem) 23",
    type: "caminhavel",
    points: [
      [0.4346, 0.4243],
      [0.2909, 0.4397],
      [0.314, 0.3679],
      [0.4667, 0.3756],
      [0.5257, 0.4564],
      [0.4859, 0.5718],
      [0.3756, 0.5693],
      [0.2974, 0.5051],
      [0.2909, 0.4461],
      [0.3576, 0.4461],
      [0.3499, 0.4974],
      [0.4384, 0.5359],
      [0.4705, 0.4782],
      [0.4372, 0.4307]
    ]
  },
  {
    id: "zone-1789083974606",
    name: "Caminhável (Passagem) 24",
    type: "caminhavel",
    points: [
      [0.2166, 0.4384],
      [0.2717, 0.441],
      [0.2832, 0.4846],
      [0.2178, 0.4808],
      [0.214, 0.4423]
    ]
  },
  {
    id: "zone-1789083984985",
    name: "Caminhável (Passagem) 25",
    type: "caminhavel",
    points: [
      [0.223, 0.7847],
      [0.2845, 0.7783],
      [0.2781, 0.7232],
      [0.3089, 0.7257],
      [0.323, 0.786],
      [0.3987, 0.7783],
      [0.4218, 0.9335],
      [0.3769, 0.9361],
      [0.364, 0.8053],
      [0.223, 0.8129],
      [0.2281, 0.7886]
    ]
  },
  {
    id: "zone-1789083990188",
    name: "Caminhável (Passagem) 26",
    type: "caminhavel",
    points: [
      [0.2332, 0.9207],
      [0.3166, 0.9771],
      [0.3807, 0.9579],
      [0.3564, 0.9194],
      [0.2409, 0.9156]
    ]
  },
  {
    id: "zone-1789084024997",
    name: "Caminhável (Passagem) 27",
    type: "caminhavel",
    points: [
      [0.559, 0.5949],
      [0.6026, 0.4974],
      [0.5167, 0.5013],
      [0.5372, 0.4654],
      [0.6103, 0.4705],
      [0.627, 0.3012],
      [0.6719, 0.3038],
      [0.6462, 0.4833],
      [0.9669, 0.5244],
      [0.9989, 0.7309],
      [0.9784, 0.7899],
      [0.9438, 0.7309],
      [0.7745, 0.7565],
      [0.7706, 0.9002],
      [0.6103, 0.8848],
      [0.627, 0.8489],
      [0.7142, 0.8476],
      [0.7168, 0.7437],
      [0.9425, 0.686],
      [0.9284, 0.5628],
      [0.636, 0.5064],
      [0.6, 0.6693],
      [0.7039, 0.6962],
      [0.7103, 0.6334],
      [0.7642, 0.7091],
      [0.6013, 0.7116],
      [0.6103, 0.8463],
      [0.4423, 0.9348],
      [0.4372, 0.8873],
      [0.5821, 0.8322],
      [0.5628, 0.5962]
    ]
  },
  {
    id: "zone-1789084032791",
    name: "Caminhável (Passagem) 28",
    type: "caminhavel",
    points: [
      [0.4102, 0.7668],
      [0.4602, 0.7321],
      [0.5641, 0.7309],
      [0.5654, 0.7693],
      [0.4141, 0.7706]
    ]
  },
  {
    id: "zone-1789084041101",
    name: "Porta 29",
    type: "porta",
    points: [
      [0.1794, 0.0062],
      [0.1845, 0.0729],
      [0.2743, 0.0703],
      [0.264, 0.0113],
      [0.1755, 0.0088]
    ]
  }
];

/**
 * Normalized collision profiles matching the illustrated maps in public/maps/
 */
export const MAP_COLLISION_PROFILES: Record<BiomeType, MapCollisionProfile> = {
  village: {
    biome: 'village',
    imageSrc: '/maps/vila.png',
    gridSize: 8,
    customZones: VILLAGE_CUSTOM_ZONES,
    obstacles: VILLAGE_CUSTOM_ZONES.filter((z) => z.type === 'bloqueado' || z.type === 'agua'),
    walkableBridges: VILLAGE_CUSTOM_ZONES.filter((z) => z.type === 'caminhavel' || z.type === 'porta' || z.type === 'ponte')
  },

  forest: {
    biome: 'forest',
    imageSrc: '/maps/mata.png',
    obstacles: [
      // Bosque Denso & Espinheiros (Norte)
      {
        id: 'forest-north-thicket',
        name: 'Espinheiro Denso',
        type: 'obstacle',
        points: [
          [0.15, 0.02],
          [0.85, 0.02],
          [0.85, 0.18],
          [0.15, 0.18]
        ]
      },
      // Penhasco & Ruínas Antigas do Oeste
      {
        id: 'ruins-west',
        name: 'Muralha em Ruínas',
        type: 'obstacle',
        points: [
          [0.02, 0.30],
          [0.26, 0.30],
          [0.26, 0.70],
          [0.02, 0.70]
        ]
      },
      // Lagoa Estígia & Pântano do Leste
      {
        id: 'stygian-pond',
        name: 'Charco Tóxico',
        type: 'water',
        points: [
          [0.72, 0.35],
          [0.96, 0.35],
          [0.96, 0.72],
          [0.72, 0.72]
        ]
      },
      // Rochedo das Sombras (Sul)
      {
        id: 'shadow-rocks',
        name: 'Rochedo Obscuro',
        type: 'obstacle',
        points: [
          [0.35, 0.78],
          [0.65, 0.78],
          [0.65, 0.96],
          [0.35, 0.96]
        ]
      }
    ]
  },

  dungeon: {
    biome: 'dungeon',
    imageSrc: '/maps/dungeon.png',
    obstacles: [
      // Muralha Externa Superior
      {
        id: 'dungeon-wall-n',
        name: 'Paredão de Pedra',
        type: 'obstacle',
        points: [
          [0.0, 0.0],
          [1.0, 0.0],
          [1.0, 0.12],
          [0.0, 0.12]
        ]
      },
      // Muralha Externa Esquerda
      {
        id: 'dungeon-wall-w',
        name: 'Paredão Oeste',
        type: 'obstacle',
        points: [
          [0.0, 0.12],
          [0.12, 0.12],
          [0.12, 0.88],
          [0.0, 0.88]
        ]
      },
      // Muralha Externa Direita
      {
        id: 'dungeon-wall-e',
        name: 'Paredão Leste',
        type: 'obstacle',
        points: [
          [0.88, 0.12],
          [1.0, 0.12],
          [1.0, 0.88],
          [0.88, 0.88]
        ]
      },
      // Muralha Externa Inferior (com passagem central)
      {
        id: 'dungeon-wall-s-left',
        name: 'Paredão Sul (Esq)',
        type: 'obstacle',
        points: [
          [0.0, 0.88],
          [0.40, 0.88],
          [0.40, 1.0],
          [0.0, 1.0]
        ]
      },
      {
        id: 'dungeon-wall-s-right',
        name: 'Paredão Sul (Dir)',
        type: 'obstacle',
        points: [
          [0.60, 0.88],
          [1.0, 0.88],
          [1.0, 1.0],
          [0.60, 1.0]
        ]
      },
      // Pilares Rúnicos de Sustentação
      {
        id: 'pillar-nw',
        name: 'Pilar Rúnico',
        type: 'obstacle',
        points: [
          [0.30, 0.32],
          [0.38, 0.32],
          [0.38, 0.40],
          [0.30, 0.40]
        ]
      },
      {
        id: 'pillar-ne',
        name: 'Pilar Rúnico',
        type: 'obstacle',
        points: [
          [0.62, 0.32],
          [0.70, 0.32],
          [0.70, 0.40],
          [0.62, 0.40]
        ]
      },
      {
        id: 'pillar-sw',
        name: 'Pilar Rúnico',
        type: 'obstacle',
        points: [
          [0.30, 0.62],
          [0.38, 0.62],
          [0.38, 0.70],
          [0.30, 0.70]
        ]
      },
      {
        id: 'pillar-se',
        name: 'Pilar Rúnico',
        type: 'obstacle',
        points: [
          [0.62, 0.62],
          [0.70, 0.62],
          [0.70, 0.70],
          [0.62, 0.70]
        ]
      }
    ]
  },
  ruins: {
    biome: 'ruins',
    imageSrc: '/maps/ruinas.png',
    gridSize: 12,
    obstacles: [
      {
        id: 'ruins-wall-top',
        name: 'Muralha Norte',
        type: 'obstacle',
        points: [[0.0, 0.0], [1.0, 0.0], [1.0, 0.08], [0.0, 0.08]]
      },
      {
        id: 'ruins-wall-bottom',
        name: 'Muralha Sul',
        type: 'obstacle',
        points: [[0.0, 0.92], [1.0, 0.92], [1.0, 1.0], [0.0, 1.0]]
      }
    ]
  },
  canyon: {
    biome: 'canyon',
    imageSrc: '/maps/canyon.png',
    gridSize: 12,
    obstacles: [
      {
        id: 'canyon-north-ridge',
        name: 'Paredão Norte',
        type: 'obstacle',
        points: [[0.0, 0.0], [1.0, 0.0], [1.0, 0.08], [0.0, 0.08]]
      },
      {
        id: 'canyon-south-ridge',
        name: 'Paredão Sul',
        type: 'obstacle',
        points: [[0.0, 0.92], [1.0, 0.92], [1.0, 1.0], [0.0, 1.0]]
      }
    ]
  },
  lair: {
    biome: 'lair',
    imageSrc: '/maps/covil.png',
    gridSize: 12,
    obstacles: [
      {
        id: 'lair-perimeter-top',
        name: 'Borda Vulcânica Norte',
        type: 'obstacle',
        points: [[0.0, 0.0], [1.0, 0.0], [1.0, 0.08], [0.0, 0.08]]
      },
      {
        id: 'lair-perimeter-bottom',
        name: 'Borda Vulcânica Sul',
        type: 'obstacle',
        points: [[0.0, 0.92], [1.0, 0.92], [1.0, 1.0], [0.0, 1.0]]
      }
    ]
  }
};

/**
 * Standard Ray-Casting algorithm to test if a point is inside a polygon
 */
export function isPointInsidePolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a normalized coordinate [0..1] is walkable in the given biome
 */
export function isNormalizedCoordWalkable(biome: BiomeType, nx: number, ny: number): boolean {
  const profile = MAP_COLLISION_PROFILES[biome];
  if (!profile) return true;

  if (profile.customZones !== undefined) {
    return isPointWalkableWithPolygons(nx, ny, profile.customZones);
  }

  // Boundary check (1% margin to keep token inside canvas)
  if (nx < 0.01 || nx > 0.99 || ny < 0.01 || ny > 0.99) {
    return false;
  }

  // Check override bridges first (e.g. stone bridge over river)
  if (profile.walkableBridges) {
    for (const bridge of profile.walkableBridges) {
      if (isPointInsidePolygon([nx, ny], bridge.points)) {
        return true;
      }
    }
  }

  // Check obstacle polygons
  for (const obs of profile.obstacles) {
    if (isPointInsidePolygon([nx, ny], obs.points)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a discrete grid tile (x, y) is walkable within a grid of size gridSize.
 * Checks tile center and sub-tile clearance so thin obstacles don't inflate ("estourar") the whole tile.
 */
export function isGridTileWalkable(
  biome: BiomeType,
  gx: number,
  gy: number,
  gridSize: number,
  customPolygons?: CollisionPolygon[]
): boolean {
  if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return false;

  const testPoint = (nx: number, ny: number) => {
    if (customPolygons !== undefined) {
      return isPointWalkableWithPolygons(nx, ny, customPolygons);
    }
    return isNormalizedCoordWalkable(biome, nx, ny);
  };

  const centerNx = (gx + 0.5) / gridSize;
  const centerNy = (gy + 0.5) / gridSize;
  return testPoint(centerNx, centerNy);
}

/**
 * High-Precision A* Pathfinding:
 * Uses a fine navigation sub-grid (at least 24x24 resolution) to allow tokens to navigate
 * tight corridors, alleys, and doorways between polygons and rectangles without collision overflow ("estouro").
 */
export function findPathAStar(
  start: Point,
  goal: Point,
  biome: BiomeType,
  gridSize: number,
  occupiedTiles: Set<string> = new Set(),
  customPolygons?: CollisionPolygon[]
): Point[] {
  const isPointPassable = (nx: number, ny: number) => {
    if (customPolygons !== undefined) {
      return isPointWalkableWithPolygons(nx, ny, customPolygons);
    }
    return isNormalizedCoordWalkable(biome, nx, ny);
  };

  // Sub-division factor to ensure high precision navigation (nav mesh at least 24x24)
  const subDiv = Math.max(1, Math.min(4, Math.round(24 / gridSize)));
  const navSize = gridSize * subDiv;

  const isSubWalkable = (sx: number, sy: number) => {
    if (sx < 0 || sx >= navSize || sy < 0 || sy >= navSize) return false;
    const nx = (sx + 0.5) / navSize;
    const ny = (sy + 0.5) / navSize;
    return isPointPassable(nx, ny);
  };

  // If destination is impassable or out of bounds, fail early
  if (!isGridTileWalkable(biome, goal.x, goal.y, gridSize, customPolygons)) {
    return [];
  }

  // Start equals goal
  if (start.x === goal.x && start.y === goal.y) return [start];

  // Pick best walkable sub-tile inside goal tile
  let goalSub: Point = {
    x: goal.x * subDiv + Math.floor(subDiv / 2),
    y: goal.y * subDiv + Math.floor(subDiv / 2)
  };
  if (!isSubWalkable(goalSub.x, goalSub.y)) {
    let found = false;
    for (let dx = 0; dx < subDiv && !found; dx++) {
      for (let dy = 0; dy < subDiv && !found; dy++) {
        const testX = goal.x * subDiv + dx;
        const testY = goal.y * subDiv + dy;
        if (isSubWalkable(testX, testY)) {
          goalSub = { x: testX, y: testY };
          found = true;
        }
      }
    }
    if (!found) return [];
  }

  // Start sub-cell
  let startSub: Point = {
    x: start.x * subDiv + Math.floor(subDiv / 2),
    y: start.y * subDiv + Math.floor(subDiv / 2)
  };
  if (!isSubWalkable(startSub.x, startSub.y)) {
    for (let dx = 0; dx < subDiv; dx++) {
      for (let dy = 0; dy < subDiv; dy++) {
        const testX = start.x * subDiv + dx;
        const testY = start.y * subDiv + dy;
        if (isSubWalkable(testX, testY)) {
          startSub = { x: testX, y: testY };
          break;
        }
      }
    }
  }

  const heuristic = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  const startKey = `${startSub.x},${startSub.y}`;
  const goalKey = `${goalSub.x},${goalSub.y}`;

  const openSet: Point[] = [startSub];
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>();
  gScore.set(startKey, 0);

  const fScore = new Map<string, number>();
  fScore.set(startKey, heuristic(startSub, goalSub));

  const directions: [number, number][] = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1]
  ];

  let iterations = 0;
  const maxIterations = 2000;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    openSet.sort((a, b) => (fScore.get(`${a.x},${a.y}`) ?? Infinity) - (fScore.get(`${b.x},${b.y}`) ?? Infinity));
    const current = openSet.shift()!;
    const currentKey = `${current.x},${current.y}`;

    if (current.x === goalSub.x && current.y === goalSub.y) {
      // Reconstruct fine path
      const finePath: Point[] = [current];
      let curr = current;
      while (cameFrom.has(`${curr.x},${curr.y}`)) {
        curr = cameFrom.get(`${curr.x},${curr.y}`)!;
        finePath.unshift(curr);
      }

      // Convert fine sub-grid path to unique game grid tile waypoints
      const gridPath: Point[] = [];
      let lastTileKey = '';

      for (const p of finePath) {
        const gx = Math.floor(p.x / subDiv);
        const gy = Math.floor(p.y / subDiv);
        const key = `${gx},${gy}`;
        if (key !== lastTileKey) {
          gridPath.push({ x: gx, y: gy });
          lastTileKey = key;
        }
      }

      // Ensure start and goal are preserved
      if (gridPath.length > 0) {
        gridPath[0] = { x: start.x, y: start.y };
        if (gridPath[gridPath.length - 1].x !== goal.x || gridPath[gridPath.length - 1].y !== goal.y) {
          gridPath.push({ x: goal.x, y: goal.y });
        }
      }
      return gridPath;
    }

    for (const [dx, dy] of directions) {
      const neighbor: Point = { x: current.x + dx, y: current.y + dy };
      const neighborKey = `${neighbor.x},${neighbor.y}`;

      if (!isSubWalkable(neighbor.x, neighbor.y)) continue;

      // Prevent acute corner clipping
      if (dx !== 0 && dy !== 0) {
        const s1 = isSubWalkable(current.x + dx, current.y);
        const s2 = isSubWalkable(current.x, current.y + dy);
        if (!s1 && !s2) continue;
      }

      // Check occupied entity tiles (at parent grid resolution)
      const parentGx = Math.floor(neighbor.x / subDiv);
      const parentGy = Math.floor(neighbor.y / subDiv);
      const parentKey = `${parentGx},${parentGy}`;
      const goalParentKey = `${goal.x},${goal.y}`;
      if (parentKey !== goalParentKey && occupiedTiles.has(parentKey)) {
        continue;
      }

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + heuristic(neighbor, goalSub));

        if (!openSet.some((p) => p.x === neighbor.x && p.y === neighbor.y)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return [];
}

/**
 * Calculates remaining speed and movement in squares/meters
 */
export function calculateMovementBudget(
  speedMeters: number = 9,
  movementUsedSquares: number = 0
): {
  maxSquares: number;
  remainingSquares: number;
  remainingMeters: number;
  speedMeters: number;
} {
  const maxSquares = Math.floor(speedMeters / 1.5);
  const remainingSquares = Math.max(0, maxSquares - movementUsedSquares);
  const remainingMeters = Number((remainingSquares * 1.5).toFixed(1));
  return {
    maxSquares,
    remainingSquares,
    remainingMeters,
    speedMeters
  };
}

/**
 * Evaluates whether a normalized coordinate [nx, ny] is walkable against a custom list of editor polygons.
 * Rules:
 * 1. Out of bounds (< 0.01 or > 0.99) -> false
 * 2. Bridges & walkable overrides ('ponte', 'bridge', 'caminhavel', 'walkable') take precedence -> true
 * 3. Obstacles ('bloqueado', 'obstacle', 'agua', 'water', closed 'porta') -> false
 * 4. Default -> true
 */
export function isPointWalkableWithPolygons(
  nx: number,
  ny: number,
  polygons: CollisionPolygon[]
): boolean {
  if (nx < 0.01 || nx > 0.99 || ny < 0.01 || ny > 0.99) {
    return false;
  }

  // 1. Bridges override everything (cross over water and ravines)
  for (const p of polygons) {
    if ((p.type === 'ponte' || p.name.toLowerCase().includes('ponte')) && isPointInsidePolygon([nx, ny], p.points)) {
      return true;
    }
  }

  // 2. Doorways / Open Portals allow entering/passing
  for (const p of polygons) {
    if ((p.type === 'porta' || p.name.toLowerCase().includes('porta')) && isPointInsidePolygon([nx, ny], p.points)) {
      return true;
    }
  }

  // 3. Obstacles / Walls / Houses are solid - cannot pass!
  for (const p of polygons) {
    if ((p.type === 'bloqueado' || p.type === 'obstacle') && isPointInsidePolygon([nx, ny], p.points)) {
      return false;
    }
  }

  // 4. Water is impassable unless on a bridge (checked in #1)
  for (const p of polygons) {
    if ((p.type === 'agua' || p.type === 'water') && isPointInsidePolygon([nx, ny], p.points)) {
      return false;
    }
  }

  return true;
}

/**
 * A* Pathfinding for custom polygon lists (used by Map Editor Test Mode)
 * Uses high-precision sub-grid resolution to accurately navigate corridors and gaps between rectangles and polygons.
 */
export function findPathWithCustomPolygons(
  start: Point,
  goal: Point,
  polygons: CollisionPolygon[],
  gridSize: number,
  occupiedTiles: Set<string> = new Set()
): Point[] {
  return findPathAStar(start, goal, 'village', gridSize, occupiedTiles, polygons);
}

