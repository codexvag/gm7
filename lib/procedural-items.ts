// lib/procedural-items.ts
/**
 * Procedural Item & Equipment Generator adhering to D&D 5e SRD 5.2.1 rules.
 * Generates balanced, limitless weapons, armor, accessories, and consumables
 * across 4 challenge tiers for mob loot, shops, chests, and narrative rewards.
 */

import { ITEMS_CATALOG, type ItemDefinition } from './game-engine';

export type ItemRarity = 'comum' | 'incomum' | 'raro' | 'muito_raro' | 'lendario';
export type ItemTier = 1 | 2 | 3 | 4;

export interface ProceduralItem extends Partial<ItemDefinition> {
  id: string;
  name: string;
  type: 'arma' | 'armadura' | 'escudo' | 'pocao' | 'pergaminho' | 'anel' | 'geral';
  rarity: ItemRarity;
  description: string;
  value: number; // In Gold Pieces (PO)
  weight: number;
  damage?: string;
  baseAc?: number;
  acBonus?: number;
  magicBonus?: number;
  bonusDamage?: string;
  damageType?: 'cortante' | 'perfurante' | 'concussao' | 'fogo' | 'gelo' | 'eletrico' | 'radiante' | 'necrotico';
  finesse?: boolean;
  ranged?: boolean;
  rangeSquares?: number;
  icon?: string;
  tier: ItemTier;
}

// 1. D&D 5e SRD Base Weapons
interface BaseWeaponTemplate {
  name: string;
  damage: string;
  weight: number;
  baseValue: number;
  finesse?: boolean;
  ranged?: boolean;
  rangeSquares?: number;
  twoHanded?: boolean;
  versatile?: string;
  icon: string;
}

const BASE_WEAPONS: BaseWeaponTemplate[] = [
  { name: 'Adaga', damage: '1d4', weight: 0.5, baseValue: 2, finesse: true, rangeSquares: 4, icon: 'Sword' },
  { name: 'Espada Curta', damage: '1d6', weight: 1.0, baseValue: 10, finesse: true, icon: 'Sword' },
  { name: 'Cimitarra', damage: '1d6', weight: 1.5, baseValue: 25, finesse: true, icon: 'Sword' },
  { name: 'Rapieira', damage: '1d8', weight: 1.0, baseValue: 25, finesse: true, icon: 'Sword' },
  { name: 'Espada Longa', damage: '1d8', weight: 1.5, baseValue: 15, versatile: '1d10', icon: 'Sword' },
  { name: 'Machado de Batalha', damage: '1d8', weight: 2.0, baseValue: 10, versatile: '1d10', icon: 'Axe' },
  { name: 'Martelo de Guerra', damage: '1d8', weight: 2.0, baseValue: 15, versatile: '1d10', icon: 'Hammer' },
  { name: 'Espadão', damage: '2d6', weight: 3.0, baseValue: 50, twoHanded: true, icon: 'Sword' },
  { name: 'Machado Grande', damage: '1d12', weight: 3.5, baseValue: 30, twoHanded: true, icon: 'Axe' },
  { name: 'Maça Estrela', damage: '1d8', weight: 2.0, baseValue: 15, icon: 'Hammer' },
  { name: 'Lança Curta', damage: '1d6', weight: 1.5, baseValue: 5, versatile: '1d8', rangeSquares: 4, icon: 'Sword' },
  { name: 'Arco Curto', damage: '1d6', weight: 1.0, baseValue: 25, ranged: true, rangeSquares: 16, icon: 'Crosshair' },
  { name: 'Arco Longo', damage: '1d8', weight: 1.5, baseValue: 50, ranged: true, rangeSquares: 24, twoHanded: true, icon: 'Crosshair' },
  { name: 'Besta Leve', damage: '1d8', weight: 2.5, baseValue: 25, ranged: true, rangeSquares: 16, icon: 'Crosshair' },
  { name: 'Besta Pesada', damage: '1d10', weight: 4.5, baseValue: 50, ranged: true, rangeSquares: 20, twoHanded: true, icon: 'Crosshair' }
];

// 2. D&D 5e SRD Base Armors & Shields
interface BaseArmorTemplate {
  name: string;
  type: 'armadura' | 'geral';
  baseAc?: number;
  acBonus?: number;
  weight: number;
  baseValue: number;
  category: 'leve' | 'media' | 'pesada' | 'escudo';
  icon: string;
}

const BASE_ARMORS: BaseArmorTemplate[] = [
  { name: 'Armadura Acolchoada', type: 'armadura', baseAc: 11, weight: 4.0, baseValue: 5, category: 'leve', icon: 'Shield' },
  { name: 'Armadura de Couro', type: 'armadura', baseAc: 11, weight: 5.0, baseValue: 10, category: 'leve', icon: 'Shield' },
  { name: 'Couro Batido', type: 'armadura', baseAc: 12, weight: 6.0, baseValue: 45, category: 'leve', icon: 'Shield' },
  { name: 'Gibão de Peles', type: 'armadura', baseAc: 12, weight: 6.0, baseValue: 10, category: 'media', icon: 'Shield' },
  { name: 'Camisão de Cota de Malha', type: 'armadura', baseAc: 13, weight: 10.0, baseValue: 50, category: 'media', icon: 'Shield' },
  { name: 'Cota de Escamas', type: 'armadura', baseAc: 14, weight: 20.0, baseValue: 50, category: 'media', icon: 'Shield' },
  { name: 'Peitoral de Aço', type: 'armadura', baseAc: 14, weight: 10.0, baseValue: 400, category: 'media', icon: 'Shield' },
  { name: 'Meia-Armadura', type: 'armadura', baseAc: 15, weight: 20.0, baseValue: 750, category: 'media', icon: 'Shield' },
  { name: 'Cota de Anéis', type: 'armadura', baseAc: 14, weight: 20.0, baseValue: 30, category: 'pesada', icon: 'Shield' },
  { name: 'Cota de Malha', type: 'armadura', baseAc: 16, weight: 25.0, baseValue: 75, category: 'pesada', icon: 'Shield' },
  { name: 'Cota de Talas', type: 'armadura', baseAc: 17, weight: 30.0, baseValue: 200, category: 'pesada', icon: 'Shield' },
  { name: 'Armadura de Placas Completa', type: 'armadura', baseAc: 18, weight: 32.0, baseValue: 1500, category: 'pesada', icon: 'Shield' },
  { name: 'Escudo de Madeira Reforçado', type: 'geral', acBonus: 2, weight: 3.0, baseValue: 10, category: 'escudo', icon: 'Shield' },
  { name: 'Escudo de Aço Forjado', type: 'geral', acBonus: 2, weight: 3.5, baseValue: 15, category: 'escudo', icon: 'Shield' }
];

// 3. Materials & Prefixes
interface MaterialModifier {
  prefix: string;
  minTier: ItemTier;
  rarity: ItemRarity;
  costMult: number;
  bonusAttack?: number;
  bonusAc?: number;
  desc: string;
}

const MATERIALS: MaterialModifier[] = [
  { prefix: 'de Aço Valdoriano', minTier: 1, rarity: 'comum', costMult: 1.0, desc: 'Forjado em forja tradicional das colinas.' },
  { prefix: 'Prateado', minTier: 1, rarity: 'incomum', costMult: 2.2, desc: 'Revestido em prata pura, mortal contra licantropos e aparições.' },
  { prefix: 'de Aço Élfico', minTier: 2, rarity: 'incomum', costMult: 3.0, bonusAttack: 1, desc: 'Lâmina leve como uma pena com fio incrivelmente afiado.' },
  { prefix: 'de Ferro Sombrio', minTier: 2, rarity: 'incomum', costMult: 2.5, desc: 'Extraído das profundezas das catacumbas, opaco e resistente.' },
  { prefix: 'de Adamantina', minTier: 3, rarity: 'raro', costMult: 5.0, bonusAttack: 1, bonusAc: 1, desc: 'Liga lendária indestrutível. Transforma qualquer acerto crítico sofrido em golpe normal.' },
  { prefix: 'de Mithral', minTier: 3, rarity: 'raro', costMult: 4.5, bonusAc: 1, desc: 'Metal nobre ultraleve que não impõe desvantagem em testes de Furtividade.' },
  { prefix: 'de Obsidiana Abissal', minTier: 4, rarity: 'muito_raro', costMult: 8.0, bonusAttack: 2, bonusAc: 2, desc: 'Cristal vulcânico banhado nas chamas de Ignisrax.' }
];

// 4. Elemental & Magical Suffixes
interface SuffixModifier {
  suffix: string;
  minTier: ItemTier;
  rarity: ItemRarity;
  magicBonus: number;
  bonusDamage?: string;
  damageType?: ProceduralItem['damageType'];
  acBonus?: number;
  costAdd: number;
  desc: string;
}

const SUFFIXES: SuffixModifier[] = [
  { suffix: '+1', minTier: 1, rarity: 'incomum', magicBonus: 1, acBonus: 1, costAdd: 250, desc: 'Encantado com bônus de aprimoramento mágico +1.' },
  { suffix: 'das Chamas', minTier: 2, rarity: 'raro', magicBonus: 1, bonusDamage: '1d4', damageType: 'fogo', costAdd: 450, desc: 'Crepita com labaredas de fogo vivo a cada golpe.' },
  { suffix: 'do Gelo Invernal', minTier: 2, rarity: 'raro', magicBonus: 1, bonusDamage: '1d4', damageType: 'gelo', costAdd: 450, desc: 'Exala névoa gélida que congela as feridas dos oponentes.' },
  { suffix: 'do Trovão Rúnico', minTier: 2, rarity: 'raro', magicBonus: 1, bonusDamage: '1d4', damageType: 'eletrico', costAdd: 480, desc: 'Ecoa o estrondo de um trovão ao atingir a carne inimiga.' },
  { suffix: 'Sagrado do Sol', minTier: 2, rarity: 'raro', magicBonus: 1, bonusDamage: '1d6', damageType: 'radiante', costAdd: 600, desc: 'Abençoado pelo santuário de Lume, devastador contra mortos-vivos.' },
  { suffix: '+2', minTier: 3, rarity: 'raro', magicBonus: 2, acBonus: 2, costAdd: 1200, desc: 'Poderoso aprimoramento arcano +2 de mestria antiga.' },
  { suffix: 'do Carniceiro Vorpal', minTier: 3, rarity: 'muito_raro', magicBonus: 2, bonusDamage: '1d8', damageType: 'cortante', costAdd: 2000, desc: 'Extremamente afiado, busca as juntas e pescoço das presas.' },
  { suffix: 'do Lorde das Cinzas', minTier: 4, rarity: 'muito_raro', magicBonus: 2, bonusDamage: '2d6', damageType: 'fogo', costAdd: 3500, desc: 'Forjado nos altares profanados de Malakor.' },
  { suffix: '+3 da Supremacia', minTier: 4, rarity: 'lendario', magicBonus: 3, acBonus: 3, costAdd: 6000, desc: 'Artefato lendário com perfeição artesanal inigualável.' }
];

// 5. Consumables (Potions, Scrolls, Elixirs)
interface ConsumableTemplate {
  name: string;
  type: 'pocao' | 'pergaminho';
  rarity: ItemRarity;
  value: number;
  description: string;
  icon: string;
  tier: ItemTier;
}

const CONSUMABLES: ConsumableTemplate[] = [
  { name: 'Poção de Cura', type: 'pocao', rarity: 'comum', value: 50, description: 'Líquido rubi cintilante. Beber restaura 2d4 + 2 Pontos de Vida instantaneamente.', icon: 'FlaskConical', tier: 1 },
  { name: 'Poção de Cura Maior', type: 'pocao', rarity: 'incomum', value: 150, description: 'Frasco denso de essência vital. Beber restaura 4d4 + 4 Pontos de Vida.', icon: 'FlaskConical', tier: 2 },
  { name: 'Poção de Cura Superior', type: 'pocao', rarity: 'raro', value: 450, description: 'Elixir sagrado brilhante. Beber restaura 8d4 + 8 Pontos de Vida.', icon: 'FlaskConical', tier: 3 },
  { name: 'Elixir de Força do Gigante', type: 'pocao', rarity: 'raro', value: 350, description: 'Líquido fumegante que eleva o modificador de ataque e dano temporariamente.', icon: 'Zap', tier: 2 },
  { name: 'Pergaminho de Mísseis Mágicos', type: 'pergaminho', rarity: 'comum', value: 75, description: 'Pergaminho com 3 dardos de força mágica infalíveis (1d4+1 cada).', icon: 'ScrollText', tier: 1 },
  { name: 'Pergaminho de Bola de Fogo', type: 'pergaminho', rarity: 'raro', value: 300, description: 'Detona uma explosão ardente de 8d6 de dano de fogo.', icon: 'Flame', tier: 2 },
  { name: 'Pergaminho de Passo Nebuloso', type: 'pergaminho', rarity: 'incomum', value: 120, description: 'Teletransporta o conjurador instantaneamente até 9 metros sem gerar ataques de oportunidade.', icon: 'Footprints', tier: 2 }
];

/**
 * Procedural generator RNG helper
 */
function pseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    return (s = (s * 16807) % 2147483647) / 2147483647;
  };
}

/**
 * Generate a single procedural item based on tier and optional seed
 */
export function generateProceduralItem(tier: ItemTier = 1, seed = Date.now()): ProceduralItem {
  const rng = pseudoRandom(seed);
  const rollCategory = rng();

  // 25% chance of Consumable, 45% Weapon, 30% Armor/Shield
  if (rollCategory < 0.25) {
    const availableConsumables = CONSUMABLES.filter((c) => c.tier <= tier);
    const chosen = availableConsumables[Math.floor(rng() * availableConsumables.length)] || CONSUMABLES[0];
    const itemId = `proc-${chosen.type}-${Date.now().toString(36)}-${Math.floor(rng() * 1000)}`;

    const procItem: ProceduralItem = {
      id: itemId,
      name: chosen.name,
      type: chosen.type,
      rarity: chosen.rarity,
      description: chosen.description,
      value: chosen.value,
      weight: 0.5,
      tier: chosen.tier,
      icon: chosen.icon
    };
    registerProceduralItem(procItem);
    return procItem;
  }

  if (rollCategory < 0.70) {
    // Generate Procedural Weapon
    const baseWpn = BASE_WEAPONS[Math.floor(rng() * BASE_WEAPONS.length)];
    const availableMats = MATERIALS.filter((m) => m.minTier <= tier);
    const mat = rng() > 0.4 ? availableMats[Math.floor(rng() * availableMats.length)] : null;

    const availableSuffixes = SUFFIXES.filter((s) => s.minTier <= tier);
    const suffix = rng() > 0.45 ? availableSuffixes[Math.floor(rng() * availableSuffixes.length)] : null;

    let finalName = baseWpn.name;
    if (mat) finalName = `${baseWpn.name} ${mat.prefix}`;
    if (suffix) finalName = `${finalName} ${suffix.suffix}`;

    let rarity: ItemRarity = 'comum';
    if (suffix?.rarity === 'lendario' || mat?.rarity === 'lendario') rarity = 'lendario';
    else if (suffix?.rarity === 'muito_raro' || mat?.rarity === 'muito_raro') rarity = 'muito_raro';
    else if (suffix?.rarity === 'raro' || mat?.rarity === 'raro') rarity = 'raro';
    else if (suffix?.rarity === 'incomum' || mat?.rarity === 'incomum') rarity = 'incomum';

    const magicBonus = (mat?.bonusAttack || 0) + (suffix?.magicBonus || 0);
    const damageFormula = suffix?.bonusDamage
      ? `${baseWpn.damage}+${magicBonus > 0 ? magicBonus + '+' : ''}${suffix.bonusDamage}`
      : magicBonus > 0
      ? `${baseWpn.damage}+${magicBonus}`
      : baseWpn.damage;

    const finalValue = Math.round(
      baseWpn.baseValue * (mat?.costMult || 1) + (suffix?.costAdd || 0)
    );

    const descParts = [
      `Dano: ${damageFormula} (${suffix?.damageType || 'físico'}).`,
      mat ? mat.desc : 'Arma de excelente acabamento.',
      suffix ? suffix.desc : ''
    ].filter(Boolean);

    const itemId = `wpn-${finalName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.floor(rng() * 1000)}`;

    const procItem: ProceduralItem = {
      id: itemId,
      name: finalName,
      type: 'arma',
      rarity,
      description: descParts.join(' '),
      value: Math.max(10, finalValue),
      weight: baseWpn.weight,
      damage: damageFormula,
      magicBonus,
      damageType: suffix?.damageType || 'cortante',
      finesse: baseWpn.finesse,
      ranged: baseWpn.ranged,
      rangeSquares: baseWpn.rangeSquares,
      tier,
      icon: baseWpn.icon
    };
    registerProceduralItem(procItem);
    return procItem;
  }

  // Generate Procedural Armor or Shield
  const baseArm = BASE_ARMORS[Math.floor(rng() * BASE_ARMORS.length)];
  const availableMats = MATERIALS.filter((m) => m.minTier <= tier);
  const mat = rng() > 0.4 ? availableMats[Math.floor(rng() * availableMats.length)] : null;

  const availableSuffixes = SUFFIXES.filter((s) => s.minTier <= tier);
  const suffix = rng() > 0.5 ? availableSuffixes[Math.floor(rng() * availableSuffixes.length)] : null;

  let finalName = baseArm.name;
  if (mat) finalName = `${baseArm.name} ${mat.prefix}`;
  if (suffix && suffix.acBonus) finalName = `${finalName} ${suffix.suffix}`;

  let rarity: ItemRarity = 'comum';
  if (suffix?.rarity === 'lendario' || mat?.rarity === 'lendario') rarity = 'lendario';
  else if (suffix?.rarity === 'muito_raro' || mat?.rarity === 'muito_raro') rarity = 'muito_raro';
  else if (suffix?.rarity === 'raro' || mat?.rarity === 'raro') rarity = 'raro';
  else if (suffix?.rarity === 'incomum' || mat?.rarity === 'incomum') rarity = 'incomum';

  const bonusAc = (mat?.bonusAc || 0) + (suffix?.acBonus || 0);
  const finalAc = baseArm.baseAc ? baseArm.baseAc + bonusAc : undefined;
  const finalAcBonus = baseArm.acBonus ? baseArm.acBonus + bonusAc : (bonusAc > 0 ? bonusAc : undefined);

  const finalValue = Math.round(
    baseArm.baseValue * (mat?.costMult || 1) + (suffix?.costAdd || 0)
  );

  const descParts = [
    finalAc ? `CA Base: ${finalAc}.` : `Bônus de CA: +${finalAcBonus || 2}.`,
    mat ? mat.desc : 'Proteção robusta forjada sob os padrões de Valdoria.',
    suffix ? suffix.desc : ''
  ].filter(Boolean);

  const itemId = `arm-${finalName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.floor(rng() * 1000)}`;

  const procItem: ProceduralItem = {
    id: itemId,
    name: finalName,
    type: baseArm.category === 'escudo' ? 'escudo' : 'armadura',
    rarity,
    description: descParts.join(' '),
    value: Math.max(15, finalValue),
    weight: baseArm.weight,
    baseAc: finalAc,
    acBonus: finalAcBonus,
    tier,
    icon: baseArm.icon
  };
  registerProceduralItem(procItem);
  return procItem;
}

/**
 * Seamlessly registers any generated procedural item into the live ITEMS_CATALOG
 * so equipment calculators, inventory menus, and weapon reach logic recognise it instantly.
 */
export function registerProceduralItem(item: ProceduralItem): void {
  if (!ITEMS_CATALOG[item.id]) {
    ITEMS_CATALOG[item.id] = {
      id: item.id,
      name: item.name,
      type: item.type as any,
      rarity: item.rarity as any,
      description: item.description,
      weight: item.weight,
      value: item.value,
      damage: item.damage,
      baseAc: item.baseAc,
      acBonus: item.acBonus,
      finesse: item.finesse,
      ranged: item.ranged,
      rangeSquares: item.rangeSquares,
      icon: item.icon
    };
  }
}

/**
 * Generate loot drop when a creature is slain (Coins + Procedural Items)
 */
export function generateMobLoot(
  enemyName: string,
  enemyMaxHp: number = 10,
  tier: ItemTier = 1,
  seed = Date.now()
): { gold: number; items: ProceduralItem[] } {
  const rng = pseudoRandom(seed);

  // Gold scaling based on enemy toughness
  let baseGold = Math.floor(rng() * 8) + 2; // 2-10 PO
  if (enemyMaxHp >= 40) baseGold = Math.floor(rng() * 40) + 25; // Boss / Elite
  else if (enemyMaxHp >= 20) baseGold = Math.floor(rng() * 18) + 8; // Tough minion

  const items: ProceduralItem[] = [];

  // Drop chance: 65% chance of dropping at least 1 item
  if (rng() < 0.65 || enemyMaxHp >= 30) {
    items.push(generateProceduralItem(tier, seed + 101));
  }

  // Bosses always drop a second special or consumable item
  if (enemyMaxHp >= 35) {
    items.push(generateProceduralItem(Math.min(4, tier + 1) as ItemTier, seed + 202));
  }

  return { gold: baseGold, items };
}

/**
 * Generate shop inventory balanced for a village or outpost merchant
 */
export function generateShopStock(tier: ItemTier = 1, seed = 42): ProceduralItem[] {
  const stock: ProceduralItem[] = [];
  const rng = pseudoRandom(seed);

  // Always stock healing potions
  stock.push({
    id: 'pocao-cura',
    name: 'Poção de Cura',
    type: 'pocao',
    rarity: 'comum',
    description: 'Restaura 2d4 + 2 PV instantaneamente.',
    value: 50,
    weight: 0.5,
    tier: 1,
    icon: 'FlaskConical'
  });

  // 3-5 procedural equipment pieces
  const count = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    stock.push(generateProceduralItem(tier, seed + (i + 1) * 31));
  }

  return stock;
}
