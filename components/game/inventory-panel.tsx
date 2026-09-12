'use client';

import React, { useState } from 'react';
import {
  Shield,
  Swords,
  Footprints,
  Sparkles,
  Heart,
  Crown,
  Trash2,
  Check,
  Coins,
  Scale,
  X,
  Plus,
  Flame
} from 'lucide-react';
import {
  Character,
  ITEMS_CATALOG,
  ItemDefinition,
  calculateEquippedStats
} from '@/lib/game-engine';

interface InventoryPanelProps {
  hero: Character;
  onUpdateHero: (updated: Character) => void;
  onClose: () => void;
  onUseItem?: (itemId: string, targetId: string) => void;
}

export function InventoryPanel({ hero, onUpdateHero, onClose, onUseItem }: InventoryPanelProps) {
  const [selectedItem, setSelectedItem] = useState<ItemDefinition | null>(null);
  const [inventoryList, setInventoryList] = useState<string[]>(() => {
    // Parse inventory text or use default catalog items
    const parsed = hero.inventory
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return parsed.length > 0
      ? parsed
      : ['Espada Longa', 'Cota de Malha', 'Escudo de Carvalho e Ferro', 'Poção de Cura (2)', 'Tocha Alquímica'];
  });

  const equipment = hero.equipment || {};

  // Resolve equipped item definitions
  const getEquipped = (slotId?: string) => (slotId ? ITEMS_CATALOG[slotId] : undefined);
  const mainHand = getEquipped(equipment.mainHand);
  const offHand = getEquipped(equipment.offHand);
  const armor = getEquipped(equipment.armor);
  const helm = getEquipped(equipment.helm);
  const boots = getEquipped(equipment.boots);
  const accessory = getEquipped(equipment.accessory);

  // Equip an item
  const handleEquip = (item: ItemDefinition) => {
    const nextEquipment = { ...equipment };

    if (item.type === 'arma') {
      nextEquipment.mainHand = item.id;
    } else if (item.type === 'escudo') {
      nextEquipment.offHand = item.id;
    } else if (item.type === 'armadura') {
      nextEquipment.armor = item.id;
    } else if (item.type === 'elmo') {
      nextEquipment.helm = item.id;
    } else if (item.type === 'botas') {
      nextEquipment.boots = item.id;
    } else if (item.type === 'acessorio') {
      nextEquipment.accessory = item.id;
    }

    const updated = calculateEquippedStats({
      ...hero,
      equipment: nextEquipment
    });

    onUpdateHero(updated);
    setSelectedItem(null);
  };

  // Unequip slot
  const handleUnequip = (slot: keyof typeof equipment) => {
    const nextEquipment = { ...equipment };
    delete nextEquipment[slot];

    const updated = calculateEquippedStats({
      ...hero,
      equipment: nextEquipment
    });

    onUpdateHero(updated);
  };

  // Use consumable (e.g. potion)
  const handleUse = (item: ItemDefinition) => {
    if (onUseItem) {
      onUseItem(item.id, hero.id);
      setSelectedItem(null);
      onClose();
    } else if (item.healFormula) {
      const healAmount = Math.floor(Math.random() * 8) + 3;
      const nextHp = Math.min(hero.maxHp, hero.hp + healAmount);
      onUpdateHero({ ...hero, hp: nextHp });
      setSelectedItem(null);
    }
  };

  // Calculate total weight
  const totalWeight = Object.values(equipment)
    .filter(Boolean)
    .reduce((sum, id) => sum + (ITEMS_CATALOG[id!]?.weight || 0), 12);

  const maxWeight = hero.stats[0] * 7.5; // Strength x 7.5 kg (5e metric)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6 animate-fade-in select-none">
      <div className="relative w-full max-w-4xl bg-zinc-950 border-2 border-amber-900/60 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <h2 className="text-lg sm:text-xl font-bold text-amber-200 tracking-wide font-serif">
              Equipamento & Inventário • {hero.name}
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1 text-amber-400">
              <Coins size={14} /> {hero.gold ?? 50} PO
            </span>
            <span className="flex items-center gap-1">
              <Scale size={14} /> {totalWeight.toFixed(1)} / {maxWeight} kg
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: Paper Doll (Left) & Grid Inventory (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 overflow-y-auto flex-1 p-1 scrollbar-thin">
          {/* LEFT: PAPER DOLL (5 cols on md) */}
          <div className="md:col-span-5 bg-gradient-to-b from-zinc-900/90 to-black/80 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-between relative min-h-[380px]">
            <span className="text-xs uppercase tracking-widest text-amber-400/80 font-bold mb-2">
              Painel de Equipamento
            </span>

            {/* Silhouette Outline Box */}
            <div className="relative w-full max-w-[260px] h-[310px] flex flex-col items-center justify-between py-2">
              {/* Slot: Helmet */}
              <div className="flex justify-center">
                <EquipSlot
                  label="Cabeça"
                  icon={Crown}
                  item={helm}
                  onUnequip={() => handleUnequip('helm')}
                />
              </div>

              {/* Middle Row: Main Hand - Armor - Off Hand */}
              <div className="flex items-center justify-between w-full px-2">
                <EquipSlot
                  label="Arma"
                  icon={Swords}
                  item={mainHand}
                  onUnequip={() => handleUnequip('mainHand')}
                />
                <EquipSlot
                  label="Torso"
                  icon={Shield}
                  item={armor}
                  onUnequip={() => handleUnequip('armor')}
                />
                <EquipSlot
                  label="Secundária"
                  icon={Shield}
                  item={offHand}
                  onUnequip={() => handleUnequip('offHand')}
                />
              </div>

              {/* Bottom Row: Boots & Accessory */}
              <div className="flex items-center justify-around w-full px-6">
                <EquipSlot
                  label="Botas"
                  icon={Footprints}
                  item={boots}
                  onUnequip={() => handleUnequip('boots')}
                />
                <EquipSlot
                  label="Amuleto"
                  icon={Sparkles}
                  item={accessory}
                  onUnequip={() => handleUnequip('accessory')}
                />
              </div>
            </div>

            {/* Live Stats Resulting from Equipment */}
            <div className="w-full bg-black/60 border border-zinc-800 rounded-xl p-2.5 flex items-center justify-around text-xs font-mono">
              <span className="flex items-center gap-1 text-zinc-300">
                <Shield size={13} className="text-amber-400" /> CA: <strong>{hero.ac}</strong>
              </span>
              <span className="flex items-center gap-1 text-zinc-300">
                <Swords size={13} className="text-red-400" /> Atq: <strong>{hero.weapon} ({hero.damage})</strong>
              </span>
            </div>
          </div>

          {/* RIGHT: INVENTORY GRID (7 cols on md) */}
          <div className="md:col-span-7 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">
                Mochila de Aventura ({Object.keys(ITEMS_CATALOG).length} itens catalogados)
              </span>
              <span className="text-[11px] text-amber-400">Toque em um item para equipar ou usar</span>
            </div>

            {/* Grid of Available Items */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto max-h-[330px] p-1 scrollbar-thin">
              {Object.values(ITEMS_CATALOG).map((item) => {
                const isEquipped = Object.values(equipment).includes(item.id);

                const rarityBorders: Record<string, string> = {
                  comum: 'border-zinc-700 bg-zinc-950/70',
                  incomum: 'border-emerald-600/70 bg-emerald-950/20 text-emerald-300',
                  raro: 'border-blue-600/70 bg-blue-950/20 text-blue-300',
                  muito_raro: 'border-purple-600/70 bg-purple-950/20 text-purple-300',
                  epico: 'border-purple-600/70 bg-purple-950/20 text-purple-300',
                  lendario: 'border-amber-500/80 bg-amber-950/30 text-amber-300'
                };
                const borderClass = rarityBorders[item.rarity] || 'border-zinc-700 bg-zinc-950/70';

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`relative flex flex-col p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] ${borderClass} ${
                      selectedItem?.id === item.id ? 'ring-2 ring-amber-400' : ''
                    }`}
                  >
                    {isEquipped && (
                      <span className="absolute top-1 right-1 bg-amber-500 text-black text-[9px] font-black px-1 rounded">
                        EQUIPADO
                      </span>
                    )}
                    <span className="text-xs font-bold text-zinc-100 truncate">{item.name}</span>
                    <span className="text-[10px] text-zinc-400 capitalize">{item.type}</span>
                    <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-zinc-400">
                      <span>{item.weight} kg</span>
                      <span className="text-amber-400">{item.value} PO</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Item Detail / Action Bar */}
            {selectedItem && (
              <div className="mt-auto bg-black/80 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-up">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-amber-200 text-sm truncate">
                      {selectedItem.name}
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {selectedItem.rarity}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 line-clamp-2 mt-0.5">
                    {selectedItem.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedItem.healFormula ? (
                    <button
                      onClick={() => handleUse(selectedItem)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow"
                    >
                      <Heart size={14} />
                      <span>Usar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEquip(selectedItem)}
                      className="bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow"
                    >
                      <Check size={14} />
                      <span>Equipar</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EquipSlot({
  label,
  icon: Icon,
  item,
  onUnequip
}: {
  label: string;
  icon: React.ElementType;
  item?: ItemDefinition;
  onUnequip: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        onClick={() => item && onUnequip()}
        className={`relative w-14 h-14 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
          item
            ? 'border-amber-400/80 bg-gradient-to-br from-amber-950/60 to-zinc-900 shadow-lg group hover:border-red-400'
            : 'border-zinc-800 bg-zinc-950/60 text-zinc-600'
        }`}
        title={item ? `${item.name} (Clique para desequipar)` : `Vazio (${label})`}
      >
        {item ? (
          <>
            <Icon size={20} className="text-amber-300 group-hover:scale-90 transition-transform" />
            <span className="text-[9px] text-zinc-300 font-bold max-w-[50px] truncate">
              {item.name.split(' ')[0]}
            </span>
          </>
        ) : (
          <Icon size={20} />
        )}
      </div>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}
