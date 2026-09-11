import { isGridTileWalkable, type CollisionPolygon } from './collision-system';

export const abilities = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
export const classes = [
  ['Bárbaro', 12], ['Bardo', 8], ['Bruxo', 8], ['Clérigo', 8], ['Druida', 8],
  ['Feiticeiro', 6], ['Guerreiro', 10], ['Ladino', 8], ['Mago', 6], ['Monge', 8],
  ['Paladino', 10], ['Patrulheiro', 10]
] as const;
export const species = ['Anão', 'Draconato', 'Elfo', 'Gnomo', 'Golias', 'Humano', 'Orc', 'Pequenino', 'Tiferino'];
export const skills: [string, number][] = [
  ['Acrobacia', 1], ['Adestrar Animais', 4], ['Arcanismo', 3], ['Atletismo', 0],
  ['Atuação', 5], ['Enganação', 5], ['Furtividade', 1], ['História', 3],
  ['Intimidação', 5], ['Intuição', 4], ['Investigação', 3], ['Medicina', 4],
  ['Natureza', 3], ['Percepção', 4], ['Persuasão', 5], ['Prestidigitação', 1],
  ['Religião', 3], ['Sobrevivência', 4]
];
export const conditions = [
  'Amedrontado', 'Agarrado', 'Atordoado', 'Caído', 'Cego', 'Enfeitiçado',
  'Envenenado', 'Impedido', 'Incapacitado', 'Inconsciente', 'Invisível',
  'Paralisado', 'Petrificado', 'Surdo'
];

export const mod = (n: number) => Math.floor((n - 10) / 2);
export const prof = (level: number) => 2 + Math.floor((level - 1) / 4);
export const signed = (n: number) => (n >= 0 ? '+' : '') + n;

export type EquipmentSlots = {
  helm?: string;
  armor?: string;
  mainHand?: string;
  offHand?: string;
  boots?: string;
  accessory?: string;
};

export type ItemRarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario';
export type ItemType = 'arma' | 'armadura' | 'escudo' | 'elmo' | 'botas' | 'acessorio' | 'consumivel' | 'outro';

export type ItemDefinition = {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  weight: number;
  value: number; // in gold (po)
  damage?: string;
  finesse?: boolean;
  ranged?: boolean;
  rangeSquares?: number;
  baseAc?: number;
  acBonus?: number;
  healFormula?: string;
  icon?: string;
};

export const ITEMS_CATALOG: Record<string, ItemDefinition> = {
  'espada-longa': {
    id: 'espada-longa',
    name: 'Espada Longa',
    type: 'arma',
    rarity: 'comum',
    description: 'Lâmina de aço temperado versátil (1d8 uma mão / 1d10 duas mãos).',
    weight: 1.5,
    value: 15,
    damage: '1d8',
    icon: 'Sword'
  },
  'espadão': {
    id: 'espadão',
    name: 'Espadão de Batalha',
    type: 'arma',
    rarity: 'incomum',
    description: 'Arma de duas mãos devastadora.',
    weight: 3.0,
    value: 50,
    damage: '2d6',
    icon: 'Sword'
  },
  'rapieira': {
    id: 'rapieira',
    name: 'Rapieira Élfica',
    type: 'arma',
    rarity: 'raro',
    description: 'Lâmina perfurante refinada com acuidade.',
    weight: 1.0,
    value: 75,
    damage: '1d8',
    finesse: true,
    icon: 'Sword'
  },
  'adaga': {
    id: 'adaga',
    name: 'Adaga de Prata',
    type: 'arma',
    rarity: 'incomum',
    description: 'Lâmina rápida, arremessável e com acuidade.',
    weight: 0.5,
    value: 20,
    damage: '1d4',
    finesse: true,
    icon: 'Sword'
  },
  'arco-longo': {
    id: 'arco-longo',
    name: 'Arco Longo da Guarda',
    type: 'arma',
    rarity: 'comum',
    description: 'Arma de longo alcance precisa (alcance 18 quadrados).',
    weight: 1.0,
    value: 50,
    damage: '1d8',
    ranged: true,
    rangeSquares: 18,
    icon: 'Crosshair'
  },
  'cajado-runico': {
    id: 'cajado-runico',
    name: 'Cajado Rúnico de Carvalho',
    type: 'arma',
    rarity: 'raro',
    description: 'Canalizador arcano com entalhes luminosos.',
    weight: 2.0,
    value: 100,
    damage: '1d6',
    icon: 'Wand'
  },
  'cota-de-malha': {
    id: 'cota-de-malha',
    name: 'Cota de Malha',
    type: 'armadura',
    rarity: 'comum',
    description: 'Armadura pesada de anéis entrelaçados (CA 16).',
    weight: 25.0,
    value: 75,
    baseAc: 16,
    icon: 'Shield'
  },
  'armadura-de-couro': {
    id: 'armadura-de-couro',
    name: 'Armadura de Couro Batido',
    type: 'armadura',
    rarity: 'comum',
    description: 'Armadura leve maleável (CA 12 + DES).',
    weight: 6.0,
    value: 45,
    baseAc: 12,
    icon: 'Shield'
  },
  'armadura-de-placas': {
    id: 'armadura-de-placas',
    name: 'Placas Completas de Aço-Negro',
    type: 'armadura',
    rarity: 'epico',
    description: 'Proteção impenetrável de cavaleiro (CA 18).',
    weight: 30.0,
    value: 1500,
    baseAc: 18,
    icon: 'Shield'
  },
  'escudo': {
    id: 'escudo',
    name: 'Escudo de Carvalho e Ferro',
    type: 'escudo',
    rarity: 'comum',
    description: 'Empunhado na mão inábil (+2 na CA).',
    weight: 3.0,
    value: 10,
    acBonus: 2,
    icon: 'Shield'
  },
  'elmo-vigilante': {
    id: 'elmo-vigilante',
    name: 'Elmo do Sentinela Vigilante',
    type: 'elmo',
    rarity: 'incomum',
    description: 'Concede firmeza mental e +1 na CA.',
    weight: 2.0,
    value: 120,
    acBonus: 1,
    icon: 'Crown'
  },
  'botas-sombra': {
    id: 'botas-sombra',
    name: 'Botas dos Passos Silenciosos',
    type: 'botas',
    rarity: 'raro',
    description: 'Aumenta o deslocamento em +1,5m e abafa passos.',
    weight: 1.0,
    value: 200,
    icon: 'Footprints'
  },
  'amuleto-valente': {
    id: 'amuleto-valente',
    name: 'Amuleto Esmeralda da Abadia',
    type: 'acessorio',
    rarity: 'raro',
    description: 'Pulsa com energia protetora (+1 em salvaguardas).',
    weight: 0.2,
    value: 250,
    acBonus: 1,
    icon: 'Sparkles'
  },
  'pocao-cura': {
    id: 'pocao-cura',
    name: 'Poção de Cura',
    type: 'consumivel',
    rarity: 'comum',
    description: 'Fluido rubi efervescente. Restaura 2d4 + 2 PV.',
    weight: 0.5,
    value: 50,
    healFormula: '2d4+2',
    icon: 'Heart'
  },
  'pocao-cura-maior': {
    id: 'pocao-cura-maior',
    name: 'Poção de Cura Maior',
    type: 'consumivel',
    rarity: 'incomum',
    description: 'Restaura 4d4 + 4 PV instantaneamente.',
    weight: 0.5,
    value: 150,
    healFormula: '4d4+4',
    icon: 'Heart'
  },
  'tocha': {
    id: 'tocha',
    name: 'Tocha Alquímica',
    type: 'outro',
    rarity: 'comum',
    description: 'Ilumina um raio de 6 metros por 1 hora.',
    weight: 0.5,
    value: 1,
    icon: 'Flame'
  }
};

export type SpellDefinition = {
  id: string;
  name: string;
  level: number; // 0 = Truque
  school: string;
  castTime: string;
  rangeSquares: number;
  aoeRadiusSquares?: number;
  damageFormula?: string;
  healFormula?: string;
  savingThrow?: string;
  description: string;
  icon: string;
  classes?: string[];
};

export const SPELLS_CATALOG: SpellDefinition[] = [
  {
    id: 'raio-de-fogo',
    name: 'Raio de Fogo',
    level: 0,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 12,
    damageFormula: '1d10',
    description: 'Dispara um feixe incandescente. Ataque mágico à distância.',
    icon: 'Flame',
    classes: ['Mago', 'Feiticeiro']
  },
  {
    id: 'rajada-mistica',
    name: 'Rajada Mística',
    level: 0,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 12,
    damageFormula: '1d10',
    description: 'Um raio de energia crepitante atinge o inimigo.',
    icon: 'Zap',
    classes: ['Bruxo']
  },
  {
    id: 'toque-chocante',
    name: 'Toque Chocante',
    level: 0,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 1,
    damageFormula: '1d8',
    description: 'Eletricidade estala nas pontas dos seus dedos no combate corpo a corpo.',
    icon: 'Zap',
    classes: ['Mago', 'Feiticeiro', 'Bruxo']
  },
  {
    id: 'chama-sagrada',
    name: 'Chama Sagrada',
    level: 0,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 12,
    damageFormula: '1d8',
    savingThrow: 'Destreza',
    description: 'Chamas radiantes descem sobre o alvo sob comando divino.',
    icon: 'Sun',
    classes: ['Clérigo']
  },
  {
    id: 'curar-ferimentos',
    name: 'Curar Ferimentos',
    level: 1,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 1,
    healFormula: '1d8+3',
    description: 'Uma criatura tocada recupera pontos de vida.',
    icon: 'Heart',
    classes: ['Clérigo', 'Bardo', 'Druida', 'Paladino']
  },
  {
    id: 'missoes-magicos',
    name: 'Mísseis Mágicos',
    level: 1,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 12,
    damageFormula: '3d4+3',
    description: 'Três dardos luminosos acertam infalivelmente seus alvos.',
    icon: 'Sparkles',
    classes: ['Mago', 'Feiticeiro']
  },
  {
    id: 'maos-flamejantes',
    name: 'Mãos Flamejantes',
    level: 1,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 3,
    aoeRadiusSquares: 2,
    damageFormula: '3d6',
    savingThrow: 'Destreza',
    description: 'Uma onda cônica de chamas irrompe das suas mãos.',
    icon: 'Flame',
    classes: ['Mago', 'Feiticeiro']
  },
  {
    id: 'onda-trovejante',
    name: 'Onda Trovejante',
    level: 1,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 3,
    aoeRadiusSquares: 2,
    damageFormula: '2d8',
    savingThrow: 'Constituição',
    description: 'Uma onda estrondosa de trovão sacode e repele os inimigos adjacentes.',
    icon: 'Wind',
    classes: ['Bardo', 'Druida', 'Mago', 'Feiticeiro']
  },
  {
    id: 'raio-ardente',
    name: 'Raio Ardente',
    level: 2,
    school: 'Evocação',
    castTime: '1 Ação',
    rangeSquares: 12,
    damageFormula: '4d6',
    description: 'Três raios de fogo atingem alvos com força tremenda.',
    icon: 'Flame',
    classes: ['Mago', 'Feiticeiro']
  }
];

export type ActionDefinition = {
  id: string;
  name: string;
  type: 'ataque' | 'acao' | 'bonus' | 'reacao';
  description: string;
  icon: string;
};

export const TACTICAL_ACTIONS: ActionDefinition[] = [
  { id: 'disparar', name: 'Disparar', type: 'acao', description: 'Ganha deslocamento extra no turno atual.', icon: 'Footprints' },
  { id: 'desengajar', name: 'Desengajar', type: 'acao', description: 'Seu movimento não provoca ataques de oportunidade.', icon: 'Wind' },
  { id: 'esquivar', name: 'Esquivar', type: 'acao', description: 'Ataques contra você têm desvantagem até seu próximo turno.', icon: 'ShieldAlert' },
  { id: 'empurrar', name: 'Empurrar', type: 'ataque', description: 'Tenta empurrar uma criatura a 1,5m ou deixá-la caída.', icon: 'Hand' },
  { id: 'esconder', name: 'Esconder', type: 'acao', description: 'Faz um teste de Destreza (Furtividade) para se ocultar.', icon: 'EyeOff' }
];

export type Character = {
  id: string;
  owner: string;
  name: string;
  className: string;
  species: string;
  background: string;
  level: number;
  stats: number[];
  skills: string[];
  expertise: string[];
  saves: number[];
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  attack: number;
  damage: string;
  weapon: string;
  spellAbility: number;
  slots: number[];
  usedSlots: number[];
  features: string;
  spells: string;
  inventory: string;
  notes: string;
  conditions: string[];
  x: number;
  y: number;
  xp: number;
  initiative: number;
  deathSuccess: number;
  deathFail: number;
  exhaustion: number;
  equipment?: EquipmentSlots;
  gold?: number;
  partyId?: string;
};

export type PartyInvite = {
  id: string;
  fromCharId: string;
  fromCharName: string;
  fromUserId: string;
  toCharId: string;
  toCharName: string;
  toUserId: string;
  timestamp: number;
};

export type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  attack: number;
  damage: string;
  initiative: number;
  x: number;
  y: number;
  conditions?: string[];
};

export type Log = {
  id: string;
  text: string;
  kind: 'gm' | 'roll' | 'player' | 'system';
  time: string;
  sources?: { title: string; url: string }[];
};

export type State = {
  characters: Character[];
  enemies: Enemy[];
  logs: Log[];
  round: number;
  turn: number;
  order: string[];
  combat: boolean;
  location: number;
  notes: string;
  npcs: { id: string; name: string; role: string; description: string; dialogue?: string[]; x?: number; y?: number; icon?: string }[];
  questProgress?: Record<string, boolean>;
  actionUsed?: boolean;
  bonusActionUsed?: boolean;
  movementUsed?: number;
  biome?: 'village' | 'forest' | 'dungeon';
  partyInvites?: PartyInvite[];
  act?: 1 | 2 | 3;
};

export const locations = [
  {
    name: 'Vila do Rio Verde',
    label: 'Prólogo • Assentamento de Valdoria',
    biome: 'village' as const,
    text: 'O sol da manhã ilumina as colinas de Vila do Rio Verde. As águas do riacho correm límpidas sob as pontes de madeira rústica. Na praça central, o Ancião Doran e a guarda reúnem bravos aventureiros para uma missão urgente.'
  },
  {
    name: 'A Floresta dos Sussurros',
    label: 'Ato I • Bosques Profundos & Menir Sagrado',
    biome: 'forest' as const,
    text: 'As copas altas dos carvalhos bloqueiam quase toda a luz do sol. O cheiro de terra úmida preenche o ar. Diante do lago sereno e do círculo de pedras sagradas, sombras rastejantes e sentinelas espreitam entre as folhagens.'
  },
  {
    name: 'Catacumbas dos Três Selos',
    label: 'Ato II • Câmaras Subterrâneas & Santuário',
    biome: 'dungeon' as const,
    text: 'Passos ecoam sob as lajes antigas de pedra e as piscinas rituais de água fria. O ar cheira a ozônio arcano e cinzas ancestrais. No coração do santuário, Malakor ergue-se em guarda dos segredos proibidos.'
  }
];

export function initialState(): State {
  return {
    characters: [],
    enemies: [],
    logs: [entry(locations[0].text, 'gm')],
    round: 0,
    turn: 0,
    order: [],
    combat: false,
    location: 0,
    notes: '',
    actionUsed: false,
    bonusActionUsed: false,
    movementUsed: 0,
    biome: 'village',
    questProgress: {},
    act: 1,
    npcs: [
      {
        id: 'doran',
        name: 'Ancião Doran',
        role: 'Líder da Vila • Patrono da Missão',
        description: 'Líder sábio de Vila do Rio Verde. Conhece as lendas antigas sobre o selo partido na Floresta dos Sussurros.',
        x: 6,
        y: 4,
        icon: 'Crown',
        dialogue: [
          'Agradeço por terem vindo! Estranhas criaturas de cinzas foram avistadas rondando a ponte leste da nossa vila.',
          'Dizem que os selos da antiga floresta foram rompidos. Se vocês puderem purificar o santuário, a vila recompensará vocês com ouro e honra.',
          'Falem com a Alquimista Elenor antes de partir para garantir poções de cura para a jornada.'
        ]
      },
      {
        id: 'elenor',
        name: 'Alquimista Elenor',
        role: 'Erborista • Mestre das Poções',
        description: 'Especialista em ervas e poções de cura. Fornece elixires e ensina técnicas de primeiros socorros em combate.',
        x: 2,
        y: 3,
        icon: 'FlaskConical',
        dialogue: [
          'Saudações, aventureiros! A floresta lá fora é implacável com os desatentos.',
          'Guardem estas Poções de Cura na mochila. Quando precisarem, basta beber ou aplicar no aliado tocando na poção: restaura 2d4 + 2 PV instantaneamente!',
          'Em combate, lembrem-se: usar uma poção consome sua Ação daquele turno segundo as regras de D&D 5e.'
        ]
      },
      {
        id: 'kaelen',
        name: 'Capitão Kaelen',
        role: 'Guarda da Fronteira • Instrutor Tático',
        description: 'Veterano de guerra condecorado. Instrui os heróis sobre posicionamento tático e regras de combate.',
        x: 9,
        y: 6,
        icon: 'Shield',
        dialogue: [
          'Atenção, combatentes! Em batalha sob as regras táticas 5e, cada um tem direito a 1 Ação e seu deslocamento por turno.',
          'Nunca gastem seu ataque sem verificar a cobertura do terreno. Árvores e muros concedem vantagem tática.',
          'Quando estiverem prontos para a marcha, deem a ordem e abriremos os portões em direção à Floresta dos Sussurros!'
        ]
      }
    ]
  };
}

export function starterState(ownerId = 'local-hero'): State {
  const hero1: Character = {
    ...newCharacter(),
    id: 'hero-valerius',
    owner: ownerId,
    name: 'Valerius, o Guardião',
    className: 'Guerreiro',
    species: 'Humano',
    background: 'Soldado',
    level: 1,
    hp: 12,
    maxHp: 12,
    ac: 18,
    speed: 9,
    attack: 5,
    damage: '1d8+3',
    weapon: 'Espada Longa',
    stats: [16, 14, 14, 10, 12, 8],
    skills: ['Atletismo', 'Intimidação', 'Percepção'],
    x: 4,
    y: 6,
    equipment: {
      armor: 'cota-de-malha',
      mainHand: 'espada-longa',
      offHand: 'escudo',
      helm: 'elmo-aco'
    },
    inventory: 'Cota de Malha\nEspada Longa\nEscudo de Carvalho e Ferro\nMochila de Aventureiro\nPoção de Cura (2)',
    gold: 60
  };

  const hero2: Character = {
    ...newCharacter(),
    id: 'hero-lyra',
    owner: ownerId,
    name: 'Lyra Umbracanto',
    className: 'Mago',
    species: 'Elfo',
    background: 'Sábio',
    level: 1,
    hp: 8,
    maxHp: 8,
    ac: 13,
    speed: 9,
    attack: 4,
    damage: '1d10',
    weapon: 'Raio de Fogo',
    spellAbility: 3,
    slots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    usedSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    stats: [8, 14, 12, 16, 13, 10],
    skills: ['Arcanismo', 'História', 'Investigação'],
    x: 4,
    y: 7,
    equipment: {
      mainHand: 'cajado-arcano',
      accessory: 'amuleto-protecao'
    },
    inventory: 'Cajado Arcano\nLivro de Magias\nBolsa de Componentes\nPoção de Cura (1)',
    gold: 45
  };

  return {
    characters: [hero1, hero2],
    enemies: [],
    logs: [
      entry(locations[0].text, 'gm'),
      entry('O Ancião Doran, a Alquimista Elenor e o Capitão Kaelen aguardam vocês na praça da vila para iniciar a expedição.', 'gm')
    ],
    round: 0,
    turn: 0,
    order: [],
    combat: false,
    location: 0,
    notes: 'Prólogo em Vila do Rio Verde: conversar com o Ancião Doran, estocar poções com Elenor e receber instruções táticas de Kaelen.',
    actionUsed: false,
    bonusActionUsed: false,
    movementUsed: 0,
    biome: 'village',
    questProgress: {},
    act: 1,
    npcs: [
      {
        id: 'doran',
        name: 'Ancião Doran',
        role: 'Líder da Vila • Patrono da Missão',
        description: 'Líder sábio de Vila do Rio Verde. Conhece as lendas antigas sobre o selo partido na Floresta dos Sussurros.',
        x: 6,
        y: 4,
        icon: 'Crown',
        dialogue: [
          'Agradeço por terem vindo! Estranhas criaturas de cinzas foram avistadas rondando a ponte leste da nossa vila.',
          'Dizem que os selos da antiga floresta foram rompidos. Se vocês puderem purificar o santuário, a vila recompensará vocês com ouro e honra.',
          'Falem com a Alquimista Elenor antes de partir para garantir poções de cura para a jornada.'
        ]
      },
      {
        id: 'elenor',
        name: 'Alquimista Elenor',
        role: 'Erborista • Mestre das Poções',
        description: 'Especialista em ervas e poções de cura. Fornece elixires e ensina técnicas de primeiros socorros em combate.',
        x: 2,
        y: 3,
        icon: 'FlaskConical',
        dialogue: [
          'Saudações, aventureiros! A floresta lá fora é implacável com os desatentos.',
          'Guardem estas Poções de Cura na mochila. Quando precisarem, basta beber ou aplicar no aliado tocando na poção: restaura 2d4 + 2 PV instantaneamente!',
          'Em combate, lembrem-se: usar uma poção consome sua Ação daquele turno segundo as regras de D&D 5e.'
        ]
      },
      {
        id: 'kaelen',
        name: 'Capitão Kaelen',
        role: 'Guarda da Fronteira • Instrutor Tático',
        description: 'Veterano de guerra condecorado. Instrui os heróis sobre posicionamento tático e regras de combate.',
        x: 9,
        y: 6,
        icon: 'Shield',
        dialogue: [
          'Atenção, combatentes! Em batalha sob as regras táticas 5e, cada um tem direito a 1 Ação e seu deslocamento por turno.',
          'Nunca gastem seu ataque sem verificar a cobertura do terreno. Árvores e muros concedem vantagem tática.',
          'Quando estiverem prontos para a marcha, deem a ordem e abriremos os portões em direção à Floresta dos Sussurros!'
        ]
      }
    ]
  };
}

export function entry(text: string, kind: Log['kind'] = 'system'): Log {
  return {
    id: crypto.randomUUID(),
    text,
    kind,
    time: new Date().toISOString()
  };
}

export function die(sides: number) {
  const bound = Math.floor(4294967296 / sides) * sides;
  const b = new Uint32Array(1);
  do {
    crypto.getRandomValues(b);
  } while (b[0] >= bound);
  return 1 + (b[0] % sides);
}

export function roll(expression: string, critical = false) {
  const clean = expression.replace(/\s/g, '');
  const m = /^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/.exec(clean);
  if (m && +m[1] >= 1 && +m[1] <= 30) {
    const results = Array.from({ length: +m[1] * (critical ? 2 : 1) }, () => die(+m[2]));
    const bonus = Number(m[3] || 0);
    return { results, bonus, total: Math.max(0, results.reduce((a, b) => a + b, 0) + bonus) };
  }
  const flatMatch = /^(\d+)([+-]\d+)?$/.exec(clean);
  if (flatMatch) {
    const base = Number(flatMatch[1]);
    const bonus = flatMatch[2] ? Number(flatMatch[2]) : 0;
    const total = Math.max(0, base + bonus);
    return { results: [total], bonus: 0, total };
  }
  throw Error('Use uma fórmula como 1d20+5 ou 2d6+3 (até 30 dados).');
}

export function d20(mode: string = 'normal') {
  const a = die(20), b = mode === 'normal' ? a : die(20);
  return {
    raw: mode === 'advantage' ? Math.max(a, b) : mode === 'disadvantage' ? Math.min(a, b) : a,
    dice: mode === 'normal' ? [a] : [a, b]
  };
}

export function validateCharacter(c: Character): Character {
  if (!c.name?.trim() || c.name.length > 60) throw Error('Informe um nome de até 60 caracteres.');
  if (!classes.some(x => x[0] === c.className) || !species.includes(c.species)) throw Error('Classe ou espécie inválida.');
  if (!Number.isInteger(c.level) || c.level < 1 || c.level > 20 || c.stats.length !== 6 || c.stats.some(x => !Number.isInteger(x) || x < 1 || x > 30)) {
    throw Error('Confira o nível e os seis atributos.');
  }
  for (const n of [c.hp, c.maxHp, c.ac, c.speed, c.attack, c.spellAbility, c.exhaustion]) {
    if (!Number.isFinite(n)) throw Error('Valor numérico inválido.');
  }
  if (c.maxHp < 1 || c.maxHp > 1000 || c.ac < 1 || c.ac > 40 || c.speed < 0 || c.speed > 150 || c.attack < -10 || c.attack > 30 || c.spellAbility < 0 || c.spellAbility > 5 || c.exhaustion < 0 || c.exhaustion > 6) {
    throw Error('Valor fora do intervalo permitido.');
  }
  roll(c.damage);
  return { ...c, hp: Math.max(0, Math.min(c.hp, c.maxHp)), name: c.name.trim() };
}

export function newCharacter(): Character {
  return {
    id: '',
    owner: '',
    name: '',
    className: 'Guerreiro',
    species: 'Humano',
    background: 'Soldado',
    level: 1,
    stats: [15, 14, 13, 12, 10, 8],
    skills: ['Atletismo', 'Intimidação'],
    expertise: [],
    saves: [0, 2],
    hp: 11,
    maxHp: 11,
    ac: 18,
    speed: 9,
    attack: 4,
    damage: '1d8+2',
    weapon: 'Espada Longa',
    spellAbility: 3,
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    usedSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: '',
    spells: '',
    inventory: 'Cota de Malha\nEspada Longa\nEscudo de Carvalho e Ferro\nMochila de Aventureiro\nTochas (10)\nPoção de Cura (2)',
    notes: '',
    conditions: [],
    x: 2,
    y: 6,
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
    gold: 50
  };
}

export const DND_5E_XP_TABLE = [
  0,        // Nível 1
  300,      // Nível 2
  900,      // Nível 3
  2700,     // Nível 4 (ASI)
  6500,     // Nível 5 (Prof +3)
  14000,    // Nível 6 (Guerreiro ASI)
  23000,    // Nível 7
  34000,    // Nível 8 (ASI)
  48000,    // Nível 9 (Prof +4)
  64000,    // Nível 10 (Ladino ASI)
  85000,    // Nível 11
  100000,   // Nível 12 (ASI)
  120000,   // Nível 13 (Prof +5)
  140000,   // Nível 14 (Guerreiro ASI)
  165000,   // Nível 15
  195000,   // Nível 16 (ASI)
  225000,   // Nível 17 (Prof +6)
  265000,   // Nível 18
  305000,   // Nível 19 (ASI)
  355000    // Nível 20
];

export function getXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= 20) return DND_5E_XP_TABLE[19];
  return DND_5E_XP_TABLE[currentLevel] || 300;
}

export function canLevelUp(character: Character): boolean {
  if (!character || character.level >= 20) return false;
  const req = getXpForNextLevel(character.level);
  return (character.xp || 0) >= req;
}

export function isAsiLevel(className: string, level: number): boolean {
  const standard = [4, 8, 12, 16, 19];
  if (standard.includes(level)) return true;
  if (className === 'Guerreiro' && (level === 6 || level === 14)) return true;
  if (className === 'Ladino' && level === 10) return true;
  return false;
}

export function getSpellSlotsForClass(className: string, level: number): number[] {
  const slots = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const fullCasters = ['Mago', 'Clérigo', 'Druida', 'Feiticeiro', 'Bardo'];
  const halfCasters = ['Paladino', 'Patrulheiro'];

  if (fullCasters.includes(className)) {
    if (level === 1) slots[0] = 2;
    else if (level === 2) slots[0] = 3;
    else if (level === 3) { slots[0] = 4; slots[1] = 2; }
    else if (level === 4) { slots[0] = 4; slots[1] = 3; }
    else if (level >= 5) { slots[0] = 4; slots[1] = 3; slots[2] = 2; }
  } else if (halfCasters.includes(className)) {
    if (level === 2) slots[0] = 2;
    else if (level === 3) slots[0] = 3;
    else if (level === 4) slots[0] = 3;
    else if (level >= 5) { slots[0] = 4; slots[1] = 2; }
  } else if (className === 'Bruxo') {
    if (level === 1) slots[0] = 1;
    else if (level === 2) slots[0] = 2;
    else if (level >= 3 && level < 5) slots[1] = 2;
    else if (level >= 5) slots[2] = 2;
  }
  return slots;
}

/**
 * Recalcula atributos do personagem ao equipar itens no Paper Doll
 */
export function calculateEquippedStats(c: Character): Character {
  const next = { ...c };
  const eq = next.equipment || {};

  // 1. Arma Principal
  const mainHandItem = eq.mainHand ? ITEMS_CATALOG[eq.mainHand] : undefined;
  if (mainHandItem && mainHandItem.type === 'arma') {
    next.weapon = mainHandItem.name;
    const strMod = mod(next.stats[0]);
    const dexMod = mod(next.stats[1]);
    const atkAbilityMod = (mainHandItem.finesse || mainHandItem.ranged) ? Math.max(strMod, dexMod) : strMod;
    
    next.attack = prof(next.level) + atkAbilityMod;
    const bonusStr = atkAbilityMod !== 0 ? signed(atkAbilityMod) : '';
    next.damage = `${mainHandItem.damage || '1d4'}${bonusStr}`;
  } else if (!eq.mainHand) {
    if (!c.weapon || c.weapon === 'Desarmado') {
      next.weapon = 'Desarmado';
      next.attack = prof(next.level) + mod(next.stats[0]);
      next.damage = `1${signed(mod(next.stats[0]))}`;
    }
  }

  // 2. Armadura e CA (incluindo Defesa sem Armadura oficial 5e)
  let calculatedAc = 10 + mod(next.stats[1]); // CA base sem armadura
  const armorItem = eq.armor ? ITEMS_CATALOG[eq.armor] : undefined;
  if (!armorItem || !armorItem.baseAc) {
    // Unarmored Defense
    if (next.className === 'Bárbaro') {
      // Bárbaro 5e: 10 + DES + CON (escudo permitido)
      calculatedAc = 10 + mod(next.stats[1]) + mod(next.stats[2]);
    } else if (next.className === 'Monge' && !eq.offHand) {
      // Monge 5e: 10 + DES + SAB (sem escudo)
      calculatedAc = 10 + mod(next.stats[1]) + mod(next.stats[4]);
    }
  } else if (armorItem && armorItem.type === 'armadura' && armorItem.baseAc) {
    if (armorItem.baseAc >= 16) {
      // Armadura pesada (ex: cota de malha 16, placas 18) - sem bônus de destreza
      calculatedAc = armorItem.baseAc;
    } else if (armorItem.baseAc >= 14) {
      // Armadura média - adiciona Destreza até o limite de +2
      calculatedAc = armorItem.baseAc + Math.min(2, Math.max(0, mod(next.stats[1])));
    } else {
      // Armadura leve - adiciona modificador de Destreza total
      calculatedAc = armorItem.baseAc + mod(next.stats[1]);
    }
  }

  // 3. Escudo na mão secundária (+2 CA oficial 5e)
  const offHandItem = eq.offHand ? ITEMS_CATALOG[eq.offHand] : undefined;
  if (offHandItem && offHandItem.acBonus) {
    calculatedAc += offHandItem.acBonus;
  }

  // 4. Elmo / Acessório
  const helmItem = eq.helm ? ITEMS_CATALOG[eq.helm] : undefined;
  if (helmItem && helmItem.acBonus) calculatedAc += helmItem.acBonus;

  const accItem = eq.accessory ? ITEMS_CATALOG[eq.accessory] : undefined;
  if (accItem && accItem.acBonus) calculatedAc += accItem.acBonus;

  // 5. Botas e Deslocamento
  const baseSpeed = next.species === 'Anão' || next.species === 'Pequenino' || next.species === 'Halfling' || next.species === 'Gnomo' ? 7.5 : 9;
  const bootsItem = eq.boots ? ITEMS_CATALOG[eq.boots] : undefined;
  if (bootsItem && bootsItem.id === 'botas-sombra') {
    next.speed = baseSpeed + 1.5;
  } else {
    next.speed = baseSpeed;
  }

  next.ac = calculatedAc;
  return next;
}

export type AttackResult = {
  text: string;
  hit: boolean;
  isCrit: boolean;
  isFumble: boolean;
  d20Roll: number;
  totalAttack: number;
  targetAc: number;
  damage: number;
  attackerName: string;
  targetName: string;
  targetId: string;
  hpBefore: number;
  hpAfter: number;
};

/**
 * Calcula o modo de rolagem (normal, vantagem, desvantagem) considerando as condições 5e
 */
export function determineAttackMode(
  attackerConditions: string[] = [],
  targetConditions: string[] = [],
  explicitMode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
  isRanged: boolean = false
): 'normal' | 'advantage' | 'disadvantage' {
  if (explicitMode !== 'normal') return explicitMode;

  let advantage = false;
  let disadvantage = false;

  const aConds = attackerConditions.map((c) => c.toLowerCase());
  const tConds = targetConditions.map((c) => c.toLowerCase());

  // Condições do atacante
  if (aConds.some((c) => c.includes('envenenad') || c.includes('amedrontad') || c.includes('impedido') || c.includes('cego'))) {
    disadvantage = true;
  }
  if (aConds.some((c) => c.includes('invisível') || c.includes('escondid'))) {
    advantage = true;
  }

  // Condições do alvo
  if (tConds.some((c) => c.includes('inconsciente') || c.includes('paralisad') || c.includes('atordoad') || c.includes('impedido') || c.includes('cego'))) {
    advantage = true;
  }
  if (tConds.some((c) => c.includes('caído') || c.includes('prone'))) {
    // Regra 5e: ataques corpo a corpo têm Vantagem; ataques à distância têm Desvantagem
    if (isRanged) {
      disadvantage = true;
    } else {
      advantage = true;
    }
  }
  if (tConds.some((c) => c.includes('esquiv') || c.includes('dodge') || c.includes('invisível'))) {
    disadvantage = true;
  }

  if (advantage && !disadvantage) return 'advantage';
  if (disadvantage && !advantage) return 'disadvantage';
  return 'normal';
}

export function resolveAttack(
  attacker: { name: string; attack: number; damage: string; conditions?: string[]; weapon?: string },
  target: { id?: string; name: string; ac: number; hp: number; conditions?: string[] },
  mode = 'normal',
  isRangedOverride?: boolean
): AttackResult {
  const isRanged = isRangedOverride !== undefined ? isRangedOverride : getWeaponMaxRange(attacker.weapon).isRanged;
  const finalMode = determineAttackMode(attacker.conditions, target.conditions, mode as any, isRanged);
  const r = d20(finalMode);
  const isTargetIncapacitated = (target.conditions || []).some((c) => {
    const s = c.toLowerCase();
    return s.includes('inconsciente') || s.includes('paralisad');
  });
  const isCrit = r.raw === 20 || (isTargetIncapacitated && r.raw >= 2);
  const isFumble = r.raw === 1;

  // Bênção (Bless): +1d4
  let blessBonus = 0;
  if ((attacker.conditions || []).some((c) => c.toLowerCase().includes('abençoad') || c.toLowerCase().includes('bless'))) {
    blessBonus = die(4);
  }

  const totalAttack = r.raw + attacker.attack + blessBonus;
  const hit = isCrit || (!isFumble && totalAttack >= target.ac);
  const damage = hit ? Math.max(0, roll(attacker.damage, isCrit).total) : 0;
  const hpBefore = target.hp;
  const hpAfter = Math.max(0, target.hp - damage);
  target.hp = hpAfter;

  const modeTag = finalMode === 'advantage' ? ' (Vantagem)' : finalMode === 'disadvantage' ? ' (Desvantagem)' : '';
  const blessTag = blessBonus > 0 ? ` +1d4(${blessBonus})[Bênção]` : '';
  const text = `${attacker.name} → ${target.name}: d20 [${r.dice.join(', ')}]${modeTag}${blessTag} ${signed(attacker.attack)} = ${totalAttack} vs CA ${target.ac}. ${
    hit ? (isCrit ? 'CRÍTICO! ' : '') + damage + ' de dano.' : 'Errou.'
  }`;

  return {
    text,
    hit,
    isCrit,
    isFumble,
    d20Roll: r.raw,
    totalAttack,
    targetAc: target.ac,
    damage,
    attackerName: attacker.name,
    targetName: target.name,
    targetId: target.id || '',
    hpBefore,
    hpAfter
  };
}

export function attack(
  attacker: { name: string; attack: number; damage: string; conditions?: string[]; weapon?: string },
  target: { name: string; ac: number; hp: number; conditions?: string[] },
  mode = 'normal'
) {
  const result = resolveAttack(attacker, target, mode);
  return result.text;
}

/**
 * Consome um espaço de magia do nível especificado (1-9)
 */
export function spendSpellSlot(c: Character, level: number): boolean {
  if (level < 1 || level > 9) return true; // Truques não gastam slots
  const idx = level - 1;
  const total = c.slots[idx] || 0;
  const used = c.usedSlots[idx] || 0;
  if (used >= total) return false;
  c.usedSlots[idx] = used + 1;
  return true;
}

/**
 * Executa cura de descanso curto gastando Dado de Vida da classe
 */
export function shortRestHeal(c: Character): { healed: number; rollText: string } {
  const classTuple = classes.find((cl) => cl[0] === c.className);
  const hitDieSides = classTuple ? classTuple[1] : 8;
  const conBonus = mod(c.stats[2]);
  const dieRoll = die(hitDieSides);
  const totalHealed = Math.max(1, dieRoll + conBonus);
  const oldHp = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + totalHealed);
  const actualHealed = c.hp - oldHp;
  const rollText = `1d${hitDieSides} [${dieRoll}] ${signed(conBonus)} = recuperou ${actualHealed} PV (${c.hp}/${c.maxHp})`;
  return { healed: actualHealed, rollText };
}

// ════════════════════════════════════════════════════════════════════════════════
// TACTICAL COMBAT POSITIONING & SERVER-SIDE SPATIAL VALIDATION ENGINE
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Tactical grid distance (D&D 5e Chebyshev metric where diagonals cost 1 square)
 */
export function getGridDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.max(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y));
}

/**
 * Real spatial distance in meters (1 grid square = 1.5m / 5 feet)
 */
export function getDistanceMeters(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Number((getGridDistance(p1, p2) * 1.5).toFixed(1));
}

/**
 * Returns weapon attack reach and type
 */
export function getWeaponMaxRange(weaponIdOrName?: string): { rangeSquares: number; isRanged: boolean } {
  if (!weaponIdOrName) return { rangeSquares: 1, isRanged: false };
  const w = weaponIdOrName.toLowerCase();

  // Reach weapons (2 squares / 3m)
  if (w.includes('lança') || w.includes('alabarda') || w.includes('glaive') || w.includes('chicote') || w.includes('reach')) {
    return { rangeSquares: 2, isRanged: false };
  }

  // Ranged weapons
  if (w.includes('arco-longo') || w.includes('arco longo')) return { rangeSquares: 18, isRanged: true };
  if (w.includes('arco-curto') || w.includes('arco curto')) return { rangeSquares: 12, isRanged: true };
  if (w.includes('besta-pesada') || w.includes('besta pesada')) return { rangeSquares: 16, isRanged: true };
  if (w.includes('besta')) return { rangeSquares: 12, isRanged: true };
  if (w.includes('dardo') || w.includes('adaga') || w.includes('arremesso')) {
    return { rangeSquares: 4, isRanged: true };
  }

  // Check ITEMS_CATALOG by ID or name
  const catalogItem = ITEMS_CATALOG[weaponIdOrName] || Object.values(ITEMS_CATALOG).find((i) => i.name.toLowerCase() === w);
  if (catalogItem && catalogItem.ranged && catalogItem.rangeSquares) {
    return { rangeSquares: catalogItem.rangeSquares, isRanged: true };
  }

  // Default standard melee (1 square / 1.5m)
  return { rangeSquares: 1, isRanged: false };
}

/**
 * Returns spell maximum casting range in squares
 */
export function getSpellMaxRange(spellNameOrId?: string): number {
  if (!spellNameOrId) return 12;
  const s = spellNameOrId.toLowerCase();
  const found = SPELLS_CATALOG.find(
    (sp) => sp.id.toLowerCase() === s || sp.name.toLowerCase() === s
  );
  if (found) return found.rangeSquares;
  return 12; // Default 18m / 12 squares
}

/**
 * Validates attack reach and line of sight on the board
 */
export function validateAttackRange(
  attacker: { x: number; y: number; weapon?: string },
  target: { x: number; y: number }
): { inRange: boolean; distance: number; maxRange: number; isRanged: boolean } {
  const distance = getGridDistance(attacker, target);
  const { rangeSquares, isRanged } = getWeaponMaxRange(attacker.weapon);
  return {
    inRange: distance <= rangeSquares,
    distance,
    maxRange: rangeSquares,
    isRanged
  };
}

/**
 * Validates spell casting range
 */
export function validateSpellRange(
  caster: { x: number; y: number },
  target: { x: number; y: number },
  spellName?: string
): { inRange: boolean; distance: number; maxRange: number } {
  const distance = getGridDistance(caster, target);
  const maxRange = getSpellMaxRange(spellName);
  return {
    inRange: distance <= maxRange,
    distance,
    maxRange
  };
}

/**
 * Validates character movement on the tactical board (bounds, speed budget, active turn)
 */
export function validateMovement(
  character: Character,
  destination: { x: number; y: number },
  state: State,
  maxBound: number = 15
): { valid: boolean; reason?: string; distance: number } {
  const { x, y } = destination;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > maxBound || y < 0 || y > maxBound) {
    return { valid: false, reason: 'Coordenadas fora dos limites do tabuleiro.', distance: 0 };
  }

  const distance = getGridDistance({ x: character.x, y: character.y }, destination);
  if (distance === 0) {
    return { valid: true, distance: 0 };
  }

  // Incapacitated / Stunned cannot move
  if (hasCondition(character, 'incapacitado') || hasCondition(character, 'atordoado') || hasCondition(character, 'paralisado')) {
    return { valid: false, reason: 'Personagem incapacitado ou atordoado não pode se mover.', distance };
  }

  // Combat Turn & Movement Budget validation
  if (state.combat) {
    const activeTurnId = state.order[state.turn];
    if (activeTurnId !== character.id) {
      return { valid: false, reason: 'Aguarde o seu turno para se mover no combate.', distance };
    }

    const maxBudgetSquares = Math.floor(character.speed / 1.5);
    const movementUsed = state.movementUsed || 0;
    if (movementUsed + distance > maxBudgetSquares) {
      const remaining = Math.max(0, maxBudgetSquares - movementUsed);
      return {
        valid: false,
        reason: `Deslocamento insuficiente neste turno. Restam ${remaining} quadrados (${(remaining * 1.5).toFixed(1)}m), movimento solicitado de ${distance} quadrados (${(distance * 1.5).toFixed(1)}m).`,
        distance
      };
    }
  }

  return { valid: true, distance };
}

// ════════════════════════════════════════════════════════════════════════════════
// STRUCTURED CONDITIONS ENGINE
// ════════════════════════════════════════════════════════════════════════════════

export type StructuredCondition =
  | 'Amedrontado'
  | 'Agarrado'
  | 'Atordoado'
  | 'Caído'
  | 'Cego'
  | 'Enfeitiçado'
  | 'Envenenado'
  | 'Impedido'
  | 'Incapacitado'
  | 'Inconsciente'
  | 'Invisível'
  | 'Paralisado'
  | 'Petrificado'
  | 'Surdo'
  | 'Abençoado'
  | 'Queimando'
  | 'Congelado';

export function hasCondition(entity: { conditions?: string[] }, conditionName: string): boolean {
  if (!entity.conditions || entity.conditions.length === 0) return false;
  const target = conditionName.toLowerCase();
  return entity.conditions.some((c) => c.toLowerCase().includes(target));
}

export function applyCondition(entity: { conditions: string[] }, conditionName: string): boolean {
  if (!entity.conditions) entity.conditions = [];
  if (!hasCondition(entity, conditionName)) {
    entity.conditions.push(conditionName);
    return true;
  }
  return false;
}

export function removeCondition(entity: { conditions: string[] }, conditionName: string): boolean {
  if (!entity.conditions || entity.conditions.length === 0) return false;
  const target = conditionName.toLowerCase();
  const prevLen = entity.conditions.length;
  entity.conditions = entity.conditions.filter((c) => !c.toLowerCase().includes(target));
  return entity.conditions.length < prevLen;
}

// ════════════════════════════════════════════════════════════════════════════════
// SERVER-AUTHORITATIVE WAYPOINT PATH VALIDATION
// ════════════════════════════════════════════════════════════════════════════════

export interface WaypointValidationResult {
  valid: boolean;
  reason?: string;
  finalPos: { x: number; y: number };
  distance: number;
  validatedWaypoints: { x: number; y: number }[];
}

/**
 * Server-authoritative validation for multi-step waypoint movement paths.
 * Validates bounds, step contiguity (Chebyshev dx, dy <= 1), incapacitated conditions,
 * obstacle collisions via isGridTileWalkable, and combat turn + movement budget (5e Speed / 1.5m).
 */
export function validateWaypointPath(
  character: Character,
  waypoints: { x: number; y: number }[],
  state: State,
  maxBound: number = 15,
  gridSize?: number,
  customPolygons?: CollisionPolygon[]
): WaypointValidationResult {
  if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
    return {
      valid: false,
      reason: 'Nenhum waypoint fornecido.',
      finalPos: { x: character.x, y: character.y },
      distance: 0,
      validatedWaypoints: []
    };
  }

  // Incapacitated / Stunned / Paralyzed cannot move
  if (
    hasCondition(character, 'incapacitado') ||
    hasCondition(character, 'atordoado') ||
    hasCondition(character, 'paralisado')
  ) {
    return {
      valid: false,
      reason: 'Personagem incapacitado, atordoado ou paralisado não pode se mover.',
      finalPos: { x: character.x, y: character.y },
      distance: 0,
      validatedWaypoints: []
    };
  }

  const biome = (state.biome || 'village') as 'village' | 'forest' | 'dungeon';
  const effectiveGridSize = gridSize || (maxBound + 1);

  // Normalize path: ignore initial point if it's the current position
  let currentPos = { x: character.x, y: character.y };
  const steps: { x: number; y: number }[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (
      typeof wp?.x !== 'number' ||
      typeof wp?.y !== 'number' ||
      !Number.isInteger(wp.x) ||
      !Number.isInteger(wp.y) ||
      wp.x < 0 ||
      wp.x > maxBound ||
      wp.y < 0 ||
      wp.y > maxBound
    ) {
      return {
        valid: false,
        reason: `Coordenada de waypoint inválida ou fora dos limites do tabuleiro (${wp?.x}, ${wp?.y}).`,
        finalPos: currentPos,
        distance: steps.length,
        validatedWaypoints: steps
      };
    }

    // If first waypoint is exact current position, skip
    if (i === 0 && wp.x === currentPos.x && wp.y === currentPos.y) {
      continue;
    }

    const dx = Math.abs(wp.x - currentPos.x);
    const dy = Math.abs(wp.y - currentPos.y);

    // Duplicate consecutive point, skip
    if (dx === 0 && dy === 0) {
      continue;
    }

    // Step must be contiguous (Chebyshev distance <= 1)
    if (dx > 1 || dy > 1) {
      if (!state.combat || waypoints.length === 1) {
        // Expand/interpolate intermediate steps to reach destination
        let cx = currentPos.x;
        let cy = currentPos.y;
        let blocked = false;
        while (cx !== wp.x || cy !== wp.y) {
          const stepX = Math.sign(wp.x - cx);
          const stepY = Math.sign(wp.y - cy);
          cx += stepX;
          cy += stepY;
          if (isGridTileWalkable(biome, cx, cy, effectiveGridSize, customPolygons)) {
            steps.push({ x: cx, y: cy });
          } else {
            blocked = true;
            break;
          }
        }
        if (blocked && steps.length === 0) {
          return {
            valid: false,
            reason: `Caminho bloqueado por obstáculo ou terreno intransponível em (${cx}, ${cy}).`,
            finalPos: currentPos,
            distance: steps.length,
            validatedWaypoints: steps
          };
        }
        currentPos = steps.length > 0 ? steps[steps.length - 1] : currentPos;
        continue;
      }
      return {
        valid: false,
        reason: `Passo não contíguo detectado de (${currentPos.x}, ${currentPos.y}) para (${wp.x}, ${wp.y}). Saltos de mais de 1 quadrado não são permitidos.`,
        finalPos: currentPos,
        distance: steps.length,
        validatedWaypoints: steps
      };
    }

    // Server-side obstacle / collision check
    if (!isGridTileWalkable(biome, wp.x, wp.y, effectiveGridSize, customPolygons)) {
      return {
        valid: false,
        reason: `Caminho bloqueado por obstáculo ou terreno intransponível em (${wp.x}, ${wp.y}).`,
        finalPos: currentPos,
        distance: steps.length,
        validatedWaypoints: steps
      };
    }

    currentPos = { x: wp.x, y: wp.y };
    steps.push(currentPos);
  }

  if (steps.length === 0) {
    return {
      valid: true,
      finalPos: { x: character.x, y: character.y },
      distance: 0,
      validatedWaypoints: []
    };
  }

  const totalDistance = steps.length;

  // Combat Turn & Movement Budget validation
  if (state.combat) {
    const activeTurnId = state.order[state.turn];
    if (activeTurnId !== character.id) {
      return {
        valid: false,
        reason: 'Aguarde o seu turno para se mover no combate.',
        finalPos: { x: character.x, y: character.y },
        distance: 0,
        validatedWaypoints: []
      };
    }

    const maxBudgetSquares = Math.floor(character.speed / 1.5);
    const movementUsed = state.movementUsed || 0;
    if (movementUsed + totalDistance > maxBudgetSquares) {
      const remaining = Math.max(0, maxBudgetSquares - movementUsed);
      return {
        valid: false,
        reason: `Deslocamento insuficiente neste turno. Restam ${remaining} quadrados (${(remaining * 1.5).toFixed(1)}m), mas o caminho solicitado requer ${totalDistance} quadrados (${(totalDistance * 1.5).toFixed(1)}m).`,
        finalPos: { x: character.x, y: character.y },
        distance: 0,
        validatedWaypoints: []
      };
    }
  } else {
    // Non-combat sanity check: prevent malicious unbounded waypoints packet
    if (totalDistance > 50) {
      return {
        valid: false,
        reason: 'Caminho longo demais em uma única ação (limite: 50 quadrados).',
        finalPos: { x: character.x, y: character.y },
        distance: 0,
        validatedWaypoints: []
      };
    }
  }

  return {
    valid: true,
    finalPos: steps[steps.length - 1],
    distance: totalDistance,
    validatedWaypoints: steps
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// CLOUDFLARE WEBSOCKET & DURABLE OBJECT REAL-TIME PROTOCOL TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface ProjectileVFX {
  id: string;
  type: 'arrow' | 'fire_bolt' | 'magic_missile' | 'sacred_flame' | 'frost_ray' | 'eldritch' | 'slash' | 'heal';
  from: { x: number; y: number };
  to: { x: number; y: number };
  hit: boolean;
  damage?: number;
}

export type WsClientMessage =
  | { type: 'JOIN_ROOM'; roomId: string; userId: string; characterId?: string }
  | { type: 'MOVE_PATH'; roomId: string; characterId: string; waypoints: { x: number; y: number }[]; seq: number; gridSize?: number; maxBound?: number }
  | { type: 'ATTACK'; roomId: string; actorId: string; targetId: string; weaponIndex?: number; seq: number }
  | { type: 'CAST_SPELL'; roomId: string; actorId: string; targetId?: string; spellName: string; level?: number; seq: number }
  | { type: 'ACTION'; roomId: string; action: string; payload?: Record<string, unknown>; seq: number }
  | { type: 'CHAT'; roomId: string; sender: string; text: string }
  | { type: 'PING'; timestamp: number };

export type WsServerMessage =
  | { type: 'INIT_SNAPSHOT'; roomId: string; state: State; version: number; seq: number; serverTime: number }
  | { type: 'SYNC_SNAPSHOT'; roomId: string; state: State; version: number; seq: number }
  | { type: 'HERO_MOVED'; roomId: string; characterId: string; waypoints: { x: number; y: number }[]; finalPos: { x: number; y: number }; seq: number }
  | { type: 'MOVE_REJECTED'; roomId: string; characterId: string; originalPos: { x: number; y: number }; reason: string; seq: number }
  | { type: 'ATTACK_RESULT'; roomId: string; actorId: string; targetId: string; projectile?: ProjectileVFX; attackResult: AttackResult; state: State; version: number; seq: number }
  | { type: 'ACTION_RESULT'; roomId: string; action: string; state: State; version: number; seq: number }
  | { type: 'CHAT_MESSAGE'; roomId: string; sender: string; text: string; timestamp: number }
  | { type: 'PONG'; timestamp: number }
  | { type: 'ERROR'; message: string; code?: string; seq?: number };



