// lib/ai-map-prompts.ts
/**
 * Construtor e Gerenciador de Prompts Estruturados para Mapas Top-Down de RPG por IA
 * Produz prompts padronizados para IAs geradoras de imagem (Stable Diffusion, Midjourney, DALL-E, Imagen)
 * focados em clareza arquitetônica, paredes sólidas, corredores conectados e ausência de elementos de UI/tokens.
 */

export type DungeonBiomeOption =
  | 'catacombs'
  | 'crypt'
  | 'ruins'
  | 'volcanic'
  | 'forest_shrine'
  | 'cavern';

export type DungeonThemeStyle =
  | 'grimdark_stone'
  | 'gothic_obsidian'
  | 'mossy_overgrown'
  | 'arcane_runic'
  | 'torchlit_dungeon';

export type DungeonMapSize = 8 | 12 | 16 | 24;

export interface MapPromptOptions {
  biome: DungeonBiomeOption;
  theme: DungeonThemeStyle;
  size: DungeonMapSize;
  customDescription?: string;
  hasPillars?: boolean;
  hasWaterFeatures?: boolean;
  hasSecretAlcove?: boolean;
  lighting?: 'torchlit' | 'dim_runic' | 'dark' | 'crystal_glow';
}

export const BIOME_DESCRIPTIONS: Record<DungeonBiomeOption, { label: string; details: string }> = {
  catacombs: {
    label: 'Catacumbas Ancestrais',
    details: 'ancient underground catacombs, subterranean stone crypts, burial niches along stone walls, bone ossuaries, weathered flagstone flooring'
  },
  crypt: {
    label: 'Cripta dos Três Selos',
    details: 'gothic stone crypt, ancient stone sarcophagi, vaulted arched ceilings, weathered gray slate masonry, ritual candle stands'
  },
  ruins: {
    label: 'Ruínas Calcinadas da Abadia',
    details: 'sunken stone temple ruins, crumbled stone walls, fallen masonry blocks, cracked cobblestones, ash-covered courtyard floor'
  },
  volcanic: {
    label: 'Covil Vulcânico & Fenda de Magma',
    details: 'obsidian rock dungeon, basalt stone walls, narrow glowing magma fissures, dark volcanic rock floors, sulfur vents'
  },
  forest_shrine: {
    label: 'Santuário Florestal Sombrio',
    details: 'overgrown ancient stone ruin surrounded by dense twisting roots, moss-covered stone path, standing megalith menhirs'
  },
  cavern: {
    label: 'Caverna Alagada dos Escribas',
    details: 'natural limestone cavern, wet stone floors, shallow pools of dark subterranean water, stalagmites forming natural pillars'
  }
};

export const THEME_DESCRIPTIONS: Record<DungeonThemeStyle, { label: string; style: string }> = {
  grimdark_stone: {
    label: 'Pedra Sombria & Realista',
    style: 'dark grimdark fantasy tabletop battlemap art, highly detailed realistic stone textures, deep shadows, atmospheric ambient occlusion'
  },
  gothic_obsidian: {
    label: 'Gótico de Obsidiana',
    style: 'dark gothic architecture, polished black stone slabs, sharp geometric layout, faint violet ambient light'
  },
  mossy_overgrown: {
    label: 'Ruína com Musgo & Umidade',
    style: 'ancient weathered stones overgrown with green moss, damp stone slabs, aged lichen textures, historical ruin aesthetic'
  },
  arcane_runic: {
    label: 'Arcano com Runas Iluminadas',
    style: 'mystic dungeon floors engraved with glowing blue arcane sigils, mystical stone circles, faint magical ambient illumination'
  },
  torchlit_dungeon: {
    label: 'Masmorra Clássica Iluminada por Tochas',
    style: 'classic D&D dungeon crawler aesthetic, warm flickering wall torchlight casting realistic directional shadows on stone corridors'
  }
};

export function buildMapPrompt(options: MapPromptOptions): {
  prompt: string;
  negativePrompt: string;
  summary: string;
  gridRecommendation: number;
} {
  const biomeInfo = BIOME_DESCRIPTIONS[options.biome] || BIOME_DESCRIPTIONS.catacombs;
  const themeInfo = THEME_DESCRIPTIONS[options.theme] || THEME_DESCRIPTIONS.grimdark_stone;

  const features: string[] = [];
  if (options.hasPillars) features.push('sturdy square stone pillars supporting the chambers');
  if (options.hasWaterFeatures) features.push('shallow dark reflective water pools and canals');
  if (options.hasSecretAlcove) features.push('narrow connected corridors leading to a secluded inner sanctum');

  const lightingText =
    options.lighting === 'dim_runic'
      ? 'subtle glowing magical runes emitting soft blue luminescence'
      : options.lighting === 'crystal_glow'
      ? 'faint bioluminescent crystals lighting the walls'
      : options.lighting === 'dark'
      ? 'gloomy shadows with minimal ambient light'
      : 'warm orange wall-mounted torches casting dramatic shadows across stone surfaces';

  const userDesc = options.customDescription?.trim()
    ? `Specific room features: ${options.customDescription.trim()}.`
    : '';

  const prompt = [
    'Top-down 2D tabletop RPG battlemap, perfectly straight overhead orthogonal 90-degree bird-eye view.',
    `Environment: ${biomeInfo.details}.`,
    `Architectural theme: ${themeInfo.style}.`,
    `Lighting: ${lightingText}.`,
    features.length > 0 ? `Chamber features: ${features.join(', ')}.` : '',
    userDesc,
    'Clear architectural floor plan layout: interconnected rectangular rooms connected by narrow hallways, thick solid stone walls separating chambers, visible open doorways, high contrast between walkable floor slabs and impenetrable dark walls.',
    'Crisp clean digital fantasy illustration, high readability for miniature tactical movement.',
    'Strictly NO characters, NO monsters, NO human figures, NO player tokens, NO miniatures, NO overlaid grid lines, NO square grid patterns, NO text, NO labels, NO user interface elements, NO watermark, NO 3D isometric angle.'
  ]
    .filter(Boolean)
    .join(' ');

  const negativePrompt = [
    'isometric, tilted angle, perspective view, 3D render angle, side view, diagonal camera',
    'characters, people, heroes, monsters, creatures, tokens, miniatures, figures, statues of living beings',
    'grid lines, square grid overlay, hex grid, hexes, coordinate numbers, UI, HUD, buttons, health bars, inventory, menus',
    'text, watermarks, signature, title, labels, logos, blur, distorted geometry, modern objects, sci-fi elements'
  ].join(', ');

  const summary = `${biomeInfo.label} (${themeInfo.label}) • Grid ${options.size}x${options.size}`;

  return {
    prompt,
    negativePrompt,
    summary,
    gridRecommendation: options.size
  };
}
