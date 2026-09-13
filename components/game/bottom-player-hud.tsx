'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Heart,
  Footprints,
  Swords,
  Sparkles,
  Zap,
  Package,
  ShoppingBag,
  Clock,
  ChevronUp,
  ChevronDown,
  Crosshair,
  Compass,
  AlertTriangle,
  Flame,
  Wind,
  Award,
  CheckCircle2,
  Dices,
  RotateCcw,
  ShieldAlert,
  EyeOff,
  Activity,
  Target
} from 'lucide-react';
import {
  Character,
  type ActiveSpellEffect,
  TACTICAL_ACTIONS,
  ITEMS_CATALOG,
  mod,
  prof,
  signed,
  canLevelUp,
  getXpForNextLevel
} from '@/lib/game-engine';

import {
  getCharacterSpellActions
} from '@/lib/srd-spellbook';

export type ActionSelection = {
  id: string;
  name: string;
  category: 'attack' | 'spell' | 'skill' | 'item' | 'action';
  rangeSquares: number;
  damageFormula?: string;
  healFormula?: string;
  aoeRadius?: number;
  spellLevel?: number;
  description: string;
  economyType?: 'action' | 'bonus' | 'movement' | 'reaction';
  targetMode?: 'enemy' | 'ally' | 'self' | 'point' | 'area';
  canonicalName?: string;
  concentration?: boolean;
};

// All 18 official D&D 5e skills with their key attribute index (0:FOR, 1:DES, 2:CON, 3:INT, 4:SAB, 5:CAR)
const ALL_5E_SKILLS: { name: string; attrIdx: number; attrName: string }[] = [
  { name: 'Acrobacia', attrIdx: 1, attrName: 'DES' },
  { name: 'Adestrar Animais', attrIdx: 4, attrName: 'SAB' },
  { name: 'Arcanismo', attrIdx: 3, attrName: 'INT' },
  { name: 'Atletismo', attrIdx: 0, attrName: 'FOR' },
  { name: 'Atuação', attrIdx: 5, attrName: 'CAR' },
  { name: 'Enganação', attrIdx: 5, attrName: 'CAR' },
  { name: 'Furtividade', attrIdx: 1, attrName: 'DES' },
  { name: 'História', attrIdx: 3, attrName: 'INT' },
  { name: 'Intimidação', attrIdx: 5, attrName: 'CAR' },
  { name: 'Intuição', attrIdx: 4, attrName: 'SAB' },
  { name: 'Investigação', attrIdx: 3, attrName: 'INT' },
  { name: 'Medicina', attrIdx: 4, attrName: 'SAB' },
  { name: 'Natureza', attrIdx: 3, attrName: 'INT' },
  { name: 'Percepção', attrIdx: 4, attrName: 'SAB' },
  { name: 'Persuasão', attrIdx: 5, attrName: 'CAR' },
  { name: 'Prestidigitação', attrIdx: 1, attrName: 'DES' },
  { name: 'Religião', attrIdx: 3, attrName: 'INT' },
  { name: 'Sobrevivência', attrIdx: 4, attrName: 'SAB' }
];

interface BottomPlayerHudProps {
  activeHero: Character;
  party: Character[];
  spellEffects?: ActiveSpellEffect[];
  onSelectHero: (id: string) => void;
  onActionSelect: (action: ActionSelection) => void;
  onOpenInventory: () => void;
  onOpenShop?: () => void;
  onOpenCharacterSheet: () => void;
  onOpenLevelUp?: () => void;
  onEndTurn?: () => void;
  onUseItem?: (itemId: string, targetId?: string) => void;
  isCombat: boolean;
  isHeroTurn: boolean;
  actionUsed?: boolean;
  bonusActionUsed?: boolean;
  reactionUsed?: boolean;
  movementUsed?: number;
  movementBonusSquares?: number;
  busy?: boolean;
  isMinimized?: boolean;
  onToggleMinimized?: (minimized: boolean) => void;
}

export function BottomPlayerHud({
  activeHero,
  party,
  spellEffects = [],
  onSelectHero,
  onActionSelect,
  onOpenInventory,
  onOpenShop,
  onOpenCharacterSheet,
  onOpenLevelUp = () => {},
  onEndTurn,
  onUseItem,
  isCombat,
  isHeroTurn,
  actionUsed,
  bonusActionUsed = false,
  reactionUsed = false,
  movementUsed = 0,
  movementBonusSquares = 0,
  busy,
  isMinimized: isMinimizedProp,
  onToggleMinimized
}: BottomPlayerHudProps) {
  const [activeTab, setActiveTab] = useState<'action' | 'bonus' | 'movement' | 'reaction' | 'skills'>('action');
  const [internalMinimized, setInternalMinimized] = useState(false);
  const isMinimized = isMinimizedProp !== undefined ? isMinimizedProp : internalMinimized;
  const setMinimized = (val: boolean) => {
    setInternalMinimized(val);
    onToggleMinimized?.(val);
  };

  const handleSelectAction = (act: ActionSelection) => {
    if (act.category === 'attack' || act.category === 'spell') {
      setMinimized(true);
    }
    onActionSelect(act);
  };

  const [tooltip, setTooltip] = useState<ActionSelection | null>(null);

  // Dynamic HP bar with deferred damage animation
  const [delayedHp, setDelayedHp] = useState(activeHero.hp);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDelayedHp(activeHero.hp);
    }, 400);
    return () => clearTimeout(timer);
  }, [activeHero.hp]);

  const maxHp = Math.max(1, activeHero.maxHp);
  const currentHp = Math.max(0, activeHero.hp);
  const hpPct = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));
  const delayedHpPct = Math.min(100, Math.max(0, (delayedHp / maxHp) * 100));

  // Only spells actually known/prepared by THIS character.
  const heroSpells =
    getCharacterSpellActions(
      activeHero
    );


  const activeSpellEffects =
    spellEffects.filter(
      (effect) =>
        effect.casterId ===
          activeHero.id ||
        effect.characterTargetIds
          .includes(
            activeHero.id
          )
    );

  const concentrationEffect =
    activeSpellEffects.find(
      (effect) =>
        effect.concentration &&
        (
          effect.casterId ===
            activeHero.id ||
          effect.id ===
            activeHero
              .concentrationEffectId
        )
    );

  const renderSpellCard = (
    s:
      ReturnType<
        typeof getCharacterSpellActions
      >[number]
  ) => {
    const isCantrip =
      s.level === 0;

    const availableSlots =
      isCantrip
        ? 99
        : Math.max(
            0,
            (
              activeHero.slots[
                s.level - 1
              ] ||
              0
            ) -
            (
              activeHero.usedSlots[
                s.level - 1
              ] ||
              0
            )
          );

    const isDepleted =
      !isCantrip &&
      availableSlots <= 0;

    const economySpent =
      isCombat &&
      (
        (
          s.economyType ===
            'action' &&
          actionUsed
        ) ||
        (
          s.economyType ===
            'bonus' &&
          bonusActionUsed
        ) ||
        (
          s.economyType ===
            'reaction' &&
          reactionUsed
        )
      );

    const unavailable =
      isDepleted ||
      economySpent ||
      Boolean(busy);

    const economyLabel =
      s.economyType ===
        'bonus'
        ? 'Bonus'
        : s.economyType ===
            'reaction'
          ? 'Reacao'
          : 'Acao';

    return (
      <div
        key={s.id}
        data-srd-spell-economy={s.economyType}
        data-srd-target-mode={s.targetMode}
        onClick={() => {
          if (unavailable) {
            return;
          }

          handleSelectAction({
            id:
              s.id,

            name:
              s.name,

            canonicalName:
              s.canonicalName,

            category:
              'spell',

            spellLevel:
              s.level,

            rangeSquares:
              s.rangeSquares,

            damageFormula:
              s.damageFormula,

            healFormula:
              s.healFormula,

            aoeRadius:
              s.aoeRadiusSquares,

            description:
              s.description,

            economyType:
              s.economyType,

            targetMode:
              s.targetMode,

            concentration:
              s.concentration
          });
        }}
        className={
          'p-2 rounded-xl border shadow-sm transition-all flex flex-col justify-between ' +
          (
            unavailable
              ? 'bg-stone-950/60 border-stone-800 opacity-50 cursor-not-allowed'
              : 'bg-stone-900/90 hover:bg-stone-850 border-stone-700/80 hover:border-purple-400/80 cursor-pointer'
          )
        }
      >
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 truncate">
            <Sparkles
              size={13}
              className={
                isCantrip
                  ? 'text-cyan-400'
                  : 'text-purple-400'
              }
            />

            <strong className="text-stone-100 text-xs font-semibold truncate">
              {s.name}
            </strong>
          </div>

          <span className="text-[9px] font-mono font-bold px-1 rounded shrink-0 bg-purple-950 text-purple-300 border border-purple-800/60">
            {isCantrip
              ? 'Truque'
              : 'C' + s.level}
            {' / '}
            {economyLabel}
          </span>
        </div>

        <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
          {s.description}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
          {s.damageFormula ? (
            <span className="text-red-400 font-bold">
              {s.damageFormula} Dano
            </span>
          ) : s.healFormula ? (
            <span className="text-emerald-400 font-bold">
              {s.healFormula} Cura
            </span>
          ) : (
            <span className="text-stone-400">
              {s.concentration
                ? 'Concentracao'
                : 'Magia SRD'}
            </span>
          )}

          <span className="text-stone-400">
            {s.rangeSquares * 1.5}m
          </span>
        </div>
      </div>
    );
  };



  return (
    <div className="w-full flex flex-col items-center gap-1 select-none z-30 shrink-0 pointer-events-auto">
      {/* Tooltip Overlay */}
      {tooltip && (
        <div className="fixed bottom-36 sm:bottom-44 bg-zinc-950/95 border border-amber-500/60 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-sm pointer-events-none z-50 animate-fade-in text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1.5">
            <span className="font-bold text-amber-300 text-sm">{tooltip.name}</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
              {tooltip.category === 'attack'
                ? 'Ataque de Arma'
                : tooltip.category === 'spell'
                ? `Círculo ${tooltip.spellLevel || 0}`
                : tooltip.category === 'skill'
                ? 'Teste D&D 5e'
                : tooltip.category}
            </span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{tooltip.description}</p>
          <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-zinc-400 border-t border-zinc-800/80 pt-1">
            {tooltip.damageFormula && (
              <span className="text-red-400 font-bold">Dano: {tooltip.damageFormula}</span>
            )}
            {tooltip.healFormula && (
              <span className="text-emerald-400 font-bold">Cura: {tooltip.healFormula}</span>
            )}
            <span>Alcance: {tooltip.rangeSquares * 1.5}m</span>
          </div>
        </div>
      )}

      {/* Main Wide CRPG Console Container */}
      <div className="w-full max-w-6xl mx-auto bg-[#0a0f0a]/95 border-2 border-[#384333]/90 rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-300">
        {/* ═══ TIER 1: HERO VITALS & TOP DOCK HEADER (~42px) ═══ */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#121812] border-b border-[#2a3528]">
          {/* Active Hero Portrait & Vitals */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar Button */}
            <div
              onClick={onOpenCharacterSheet}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-600 via-amber-900 to-zinc-950 border-2 border-amber-400/80 shadow-md flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform shrink-0"
              title="Abrir Ficha de Personagem Completa"
            >
              <span className="font-serif font-black text-amber-200 text-lg">
                {activeHero.name[0]}
              </span>
              <div className="absolute -bottom-1 -right-1 bg-zinc-950 border border-amber-400/80 rounded-full px-1 text-[9px] font-black text-amber-300 leading-tight shadow">
                {activeHero.level}
              </div>
            </div>

            {/* Name, Class & Large HP Bar */}
            <div className="flex-1 min-w-0 max-w-sm flex flex-col justify-center">
              <div className="flex items-center justify-between gap-1 leading-tight mb-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-zinc-100 text-xs sm:text-sm truncate">
                    {activeHero.name}
                  </span>
                  <span className="text-[11px] text-amber-400/90 hidden sm:inline font-serif">
                    • {activeHero.species} {activeHero.className}
                  </span>
                </div>

                {/* Numeric HP */}
                <div className="flex items-center gap-1 text-xs font-mono font-bold shrink-0">
                  <Heart size={12} className="text-emerald-400" />
                  <span className={currentHp <= maxHp * 0.3 ? 'text-red-400' : 'text-emerald-300'}>
                    {currentHp}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-300">{maxHp} PV</span>
                </div>
              </div>

              {/* Dynamic Health Bar */}
              <div className="relative w-full h-2 sm:h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-emerald-950/80 shadow-inner">
                <div
                  style={{ width: `${delayedHpPct}%` }}
                  className="absolute inset-y-0 left-0 bg-emerald-200/60 transition-all duration-700 ease-out"
                />
                <div
                  style={{ width: `${hpPct}%` }}
                  className={`absolute inset-y-0 left-0 transition-all duration-300 ease-out ${
                    hpPct < 30
                      ? 'bg-gradient-to-r from-red-600 via-red-500 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-600 via-green-500 to-teal-400'
                  }`}
                />
              </div>
            </div>

            {/* Badges: AC, Speed, Initiative & Spell Slots */}
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-300 shrink-0">
              <span className="flex items-center gap-1 bg-zinc-900/95 px-2 py-0.5 rounded-lg border border-zinc-700/80 shadow-sm" title="Classe de Armadura">
                <Shield size={12} className="text-amber-400" />
                <span className="font-bold font-mono">{activeHero.ac} CA</span>
              </span>
              <span className="flex items-center gap-1 bg-zinc-900/95 px-2 py-0.5 rounded-lg border border-zinc-700/80 shadow-sm" title="Deslocamento">
                <Footprints size={12} className="text-cyan-400" />
                <span className="font-bold font-mono">{activeHero.speed}m</span>
              </span>
              <span className="flex items-center gap-1 bg-zinc-900/95 px-2 py-0.5 rounded-lg border border-zinc-700/80 shadow-sm" title="Iniciativa (Destreza)">
                <Clock size={12} className="text-purple-400" />
                <span className="font-bold font-mono">{signed(mod(activeHero.stats[1]))}</span>
              </span>

              {/* Spell Slots Indicators */}
              {activeHero.slots.some((s) => s > 0) && (
                <div className="flex items-center gap-1.5 bg-purple-950/40 border border-purple-800/60 px-2 py-0.5 rounded-lg shadow-sm">
                  <Sparkles size={12} className="text-purple-400" />
                  <div className="flex items-center gap-1">
                    {activeHero.slots.map((total, lvl) => {
                      if (total === 0) return null;
                      const used = activeHero.usedSlots[lvl] || 0;
                      const remaining = Math.max(0, total - used);
                      return (
                        <div key={lvl} className="flex items-center gap-0.5" title={`Espaços Círculo ${lvl + 1}: ${remaining}/${total}`}>
                          <span className="text-[9px] text-purple-300 font-mono font-bold mr-0.5">C{lvl + 1}:</span>
                          {Array.from({ length: total }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-2 h-2 rounded-full transition-all ${
                                i < remaining ? 'bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.9)]' : 'bg-zinc-800 border border-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* XP Progress & Level Up Button */}
              <div className="hidden lg:flex items-center gap-2 shrink-0 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-sm">
                <div className="flex flex-col gap-0.5 min-w-[80px]" title={`XP: ${activeHero.xp || 0} / ${getXpForNextLevel(activeHero.level)}`}>
                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                    <span>XP</span>
                    <span className="text-amber-300 font-bold">{activeHero.xp || 0} / {getXpForNextLevel(activeHero.level)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                    <div
                      style={{ width: `${Math.min(100, ((activeHero.xp || 0) / getXpForNextLevel(activeHero.level)) * 100)}%` }}
                      className="h-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-300 transition-all duration-500"
                    />
                  </div>
                </div>

                {canLevelUp(activeHero) && (
                  <button
                    onClick={() => onOpenLevelUp?.()}
                    className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-[10px] uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.8)] border border-yellow-200 animate-bounce cursor-pointer flex items-center gap-1"
                    title="Subir de Nível (D&D 5e)"
                  >
                    <Sparkles size={11} className="text-black fill-black" />
                    <span>LEVEL UP!</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Party Quick Switcher, Inventory & Minimize Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Party Mini Avatars */}
            <div className="flex items-center gap-1">
              {party.map((hero) => {
                const isSelected = hero.id === activeHero.id;
                return (
                  <button
                    key={hero.id}
                    onClick={() => onSelectHero(hero.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                        : 'border-zinc-800 bg-zinc-900/70 opacity-70 hover:opacity-100 hover:border-zinc-600'
                    }`}
                    title={`${hero.name} (${hero.hp}/${hero.maxHp} PV)`}
                  >
                    <span className="font-serif font-black text-xs text-amber-200">
                      {hero.name[0]}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-300 hidden lg:inline">
                      {hero.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onOpenInventory}
              className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-xl flex items-center gap-1.5 text-xs font-semibold shadow transition-colors cursor-pointer"
              title="Mochila e Equipamentos"
            >
              <Package size={14} />
              <span className="hidden sm:inline">Mochila</span>
            </button>

            {onOpenShop && (
              <button
                onClick={onOpenShop}
                className="p-1 px-2.5 bg-zinc-900 hover:bg-amber-950/50 text-amber-400 hover:text-amber-300 border border-zinc-700 hover:border-amber-600/70 rounded-xl flex items-center gap-1.5 text-xs font-semibold shadow transition-colors cursor-pointer"
                title="Comércio e Mercadores de Valdoria"
              >
                <ShoppingBag size={14} />
                <span className="hidden sm:inline">Loja</span>
              </button>
            )}

            <button
              onClick={() => setMinimized(!isMinimized)}
              className="p-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 border border-zinc-700 rounded-xl flex items-center gap-1 text-xs font-semibold shadow transition-colors"
              title={isMinimized ? 'Expandir console de ações' : 'Minimizar para visão desobstruída do tabuleiro'}
            >
              {isMinimized ? <ChevronUp size={16} className="text-amber-400" /> : <ChevronDown size={16} />}
              <span className="text-[10px] hidden sm:inline">{isMinimized ? 'Expandir' : 'Minimizar'}</span>
            </button>
          </div>
        </div>

        {/* ═══ TIER 2: COMPACT 5E ACTION BAR (AÇÃO, BÔNUS, MOVIMENTO, REAÇÃO & PERÍCIAS) ═══ */}
        {!isMinimized && (
          <div className="flex flex-col p-2 gap-1.5 bg-[#0b0f0c] border-t border-[#1e271c]">
            {/* Action Category Navigation Ribbon with 5E Economy Tabs */}
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-1 gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'action', label: 'Ação (Padrão)', icon: Swords, badge: '1/turno' },
                  { id: 'bonus', label: 'Ação Bônus', icon: Zap, badge: '1/turno' },
                  { id: 'movement', label: 'Movimento', icon: Footprints, badge: `${activeHero.speed}m` },
                  { id: 'reaction', label: 'Reação', icon: Shield, badge: 'Reativo' },
                  { id: 'skills', label: 'Perícias 5e', icon: Compass, badge: '18' }
                ].map(({ id, label, icon: Icon, badge }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      activeTab === id
                        ? 'bg-amber-950/40 border-amber-500/70 text-amber-200 shadow-sm'
                        : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                    }`}
                  >
                    <Icon size={13} className={activeTab === id ? 'text-amber-400' : 'text-stone-500'} />
                    <span>{label}</span>
                    <span className="text-[10px] font-mono opacity-60">[{badge}]</span>
                  </button>
                ))}
              </div>

              {/* 5E Action Economy Status Indicators */}
              <div className="flex items-center gap-2 flex-wrap">
                {isCombat ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                      <span className="text-stone-400 hidden sm:inline">Economia 5e:</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          actionUsed
                            ? 'bg-red-950/80 text-red-400 border border-red-900/80'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                        }`}
                        title="Ação padrão no turno"
                      >
                        Ação: {actionUsed ? 'Gasta' : 'Pronta'}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60"
                        title="Ação bônus no turno"
                      >
                        Bônus: Livre
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60"
                        title="Deslocamento total do personagem"
                      >
                        Mov: {Math.max(
                          0,
                          Math.floor(activeHero.speed / 1.5) +
                            movementBonusSquares -
                            movementUsed
                        )}q
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-800/60 hidden md:inline"
                        title="Reação disponível para ataques de oportunidade e magias reativas"
                      >
                        Reação: Pronta
                      </span>
                    </div>

                    {isHeroTurn && onEndTurn && (
                      <button
                        disabled={busy}
                        onClick={onEndTurn}
                        className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-stone-950 font-black px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.4)] active:scale-95 transition-all shrink-0 cursor-pointer"
                        title="Encerrar seu turno e passar a vez ao próximo combatente"
                      >
                        <Swords size={13} />
                        <span>FIM DO TURNO</span>
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-stone-400 font-mono hidden sm:inline">
                    Exploração Livre • Clique no mapa para mover
                  </span>
                )}
              </div>
            </div>

            {activeSpellEffects.length > 0 && (
              <div
                data-srd-active-effects="true"
                className="w-full px-2 py-1 flex items-center gap-1.5 overflow-x-auto border-b border-purple-900/40 bg-purple-950/20"
              >
                {concentrationEffect && (
                  <span
                    data-srd-concentration="true"
                    className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border border-purple-500/70 bg-purple-950/80 text-purple-200"
                    title={concentrationEffect.description}
                  >
                    {'Concentra\u00E7\u00E3o: '}
                    {concentrationEffect.spellName}
                  </span>
                )}

                {activeSpellEffects
                  .filter(
                    (effect) =>
                      !concentrationEffect ||
                      effect.id !==
                        concentrationEffect.id
                  )
                  .map(
                    (effect) => (
                      <span
                        key={effect.id}
                        className="shrink-0 px-2 py-0.5 rounded-full text-[10px] border border-cyan-900/70 bg-cyan-950/40 text-cyan-200"
                        title={effect.description}
                      >
                        {effect.spellName}
                      </span>
                    )
                  )}
              </div>
            )}

            {/* Action Cards Area — Compact Height (~130px) so the Map Commands the Screen */}
            <div className="w-full h-34 sm:h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-700">
              {/* ═══ TAB 1: AÇÃO PADRÃO (ATAQUES, MAGIAS DE 1 AÇÃO, CONSUMÍVEIS, TÁTICAS) ═══ */}
              {activeTab === 'action' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {/* Main Weapon Attack */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'attack-weapon',
                        name: `Atacar com ${activeHero.weapon}`,
                        category: 'attack',
                        rangeSquares: activeHero.weapon.includes('Arco') ? 16 : 1,
                        damageFormula: activeHero.damage,
                        description: `Desfere um ataque oficial com ${activeHero.weapon}.`,
                        economyType: 'action'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-amber-500/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Swords size={13} className="text-amber-400 shrink-0" />
                        <strong className="text-stone-100 text-xs font-semibold truncate">{activeHero.weapon}</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded shrink-0">
                        {signed(activeHero.attack)}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Ataque com arma principal (1 Ação).
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-red-400 font-bold">{activeHero.damage} Dano</span>
                      <span className="text-stone-400">{activeHero.weapon.includes('Arco') ? '24m (Distância)' : '1.5m (C.a.C)'}</span>
                    </div>
                  </div>

                  {/* Secondary Attack / Dagger */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'attack-dagger',
                        name: 'Golpe com Adaga',
                        category: 'attack',
                        rangeSquares: 4,
                        damageFormula: `1d4${signed(mod(activeHero.stats[1]))}`,
                        description: 'Golpe ágil de lâmina curta ou arremesso.',
                        economyType: 'action'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-stone-600 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <Crosshair size={13} className="text-amber-300/80 shrink-0" />
                        <strong className="text-stone-200 text-xs font-semibold truncate">Adaga Ágil</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-stone-800 text-stone-300 px-1 rounded shrink-0">
                        {signed(prof(activeHero.level) + mod(activeHero.stats[1]))}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Lâmina leve com acuidade (1 Ação).
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-red-400 font-bold">1d4{signed(mod(activeHero.stats[1]))} Dano</span>
                      <span className="text-stone-400">6m (Arremesso)</span>
                    </div>
                  </div>

                  {/* SRD Action Spells */}
                  {heroSpells
                    .filter(
                      (s) =>
                        s.economyType ===
                        'action'
                    )
                    .map(
                      renderSpellCard
                    )}

                  {/* Consumable Potion */}
                  <div
                    onClick={() => {
                      if (onUseItem) onUseItem('pocao-cura', activeHero.id);
                      else handleSelectAction({
                        id: 'pocao-cura',
                        name: 'Poção de Cura',
                        category: 'item',
                        rangeSquares: 1,
                        healFormula: '2d4+2',
                        description: 'Bebe uma poção mágica revigorante (1 Ação).',
                        economyType: 'action'
                      });
                    }}
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-emerald-500/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Heart size={13} className="text-emerald-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Poção de Cura</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1 rounded">
                        1 Ação
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Restaura instantaneamente 2d4+2 PV.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-emerald-400 font-bold">+2d4+2 PV</span>
                      <span className="text-stone-400">Pessoal</span>
                    </div>
                  </div>

                  {/* Dodge (Esquivar) */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'esquivar',
                        name: 'Esquivar',
                        category: 'action',
                        rangeSquares: 0,
                        description: 'Foca totalmente em se defender. Ataques contra você têm desvantagem até seu próximo turno.',
                        economyType: 'action'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-cyan-500/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert size={13} className="text-cyan-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Esquivar</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-1 rounded">
                        1 Ação
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Impõe desvantagem a todos os ataques sofridos.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-cyan-300 font-bold">Defesa 5e</span>
                      <span className="text-stone-400">1 rodada</span>
                    </div>
                  </div>

                  {/* Hide (Esconder-se) */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'esconder',
                        name: 'Esconder-se',
                        category: 'action',
                        rangeSquares: 0,
                        description: 'Faz um teste de Destreza (Furtividade) para se ocultar dos inimigos.',
                        economyType: 'action'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-stone-600 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <EyeOff size={13} className="text-stone-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Esconder-se</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-stone-800 text-stone-300 px-1 rounded">
                        1 Ação
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Teste de Furtividade para ficar oculto.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-amber-400 font-bold">Furtividade</span>
                      <span className="text-stone-400">Tático</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ TAB 2: AÇÃO BÔNUS (HABILIDADES DE CLASSE, ARMA SECUNDÁRIA, RETOMAR FÔLEGO, ETC.) ═══ */}
              {activeTab === 'bonus' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  <React.Fragment>
                    <div className="hidden" data-srd-bonus-spells="true" />

                    {heroSpells
                      .filter(
                        (s) =>
                          s.economyType ===
                          'bonus'
                      )
                      .map(
                        renderSpellCard
                      )}
                  </React.Fragment>
                  {/* Fighter Class: Second Wind */}
                  {activeHero.className === 'Guerreiro' && (
                    <div
                      onClick={() =>
                        handleSelectAction({
                          id: 'retomar-folego',
                          name: 'Retomar o Fôlego',
                          category: 'action',
                          rangeSquares: 0,
                          healFormula: `1d10+${activeHero.level}`,
                          description: 'No seu turno, você pode usar uma ação bônus para recuperar 1d10 + nível em pontos de vida (1x por descanso curto).',
                          economyType: 'bonus'
                        })
                      }
                      className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-amber-600/70 hover:border-amber-400 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <Activity size={13} className="text-amber-400" />
                          <strong className="text-stone-100 text-xs font-semibold">Retomar o Fôlego</strong>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-700/60 px-1 rounded">
                          Bônus
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                        Guerreiro: Cura 1d10 + {activeHero.level} PV no próprio turno.
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                        <span className="text-emerald-400 font-bold">+1d10+{activeHero.level} PV</span>
                        <span className="text-stone-400">Descanso Curto</span>
                      </div>
                    </div>
                  )}

                  {/* Barbarian Class: Rage */}
                  {activeHero.className === 'Bárbaro' && (
                    <div
                      onClick={() =>
                        handleSelectAction({
                          id: 'furia-barbara',
                          name: 'Entrar em Fúria',
                          category: 'action',
                          rangeSquares: 0,
                          description: 'Entra em fúria como ação bônus: ganha vantagem em testes de Força, +2 no dano corpo a corpo e resistência a dano cortante/perfurante/concussão.',
                          economyType: 'bonus'
                        })
                      }
                      className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-red-600/70 hover:border-red-400 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <Flame size={13} className="text-red-400" />
                          <strong className="text-stone-100 text-xs font-semibold">Fúria Primitiva</strong>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-red-950 text-red-300 border border-red-700/60 px-1 rounded">
                          Bônus
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                        +2 Dano corpo a corpo e resistência a dano físico.
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                        <span className="text-red-400 font-bold">+2 Dano / Resist.</span>
                        <span className="text-stone-400">At? 10 min</span>
                      </div>
                    </div>
                  )}

                  {/* Rogue Class: Cunning Action */}
                  {activeHero.className === 'Ladino' && (
                    <div
                      onClick={() =>
                        handleSelectAction({
                          id: 'acao-ardilosa-desengajar',
                          name: 'Ação Ardilosa: Desengajar',
                          category: 'action',
                          rangeSquares: 0,
                          description: 'Ladino: Você pode Desengajar, Disparar ou Esconder-se como uma Ação Bônus em cada um dos seus turnos.',
                          economyType: 'bonus'
                        })
                      }
                      className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-purple-600/70 hover:border-purple-400 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <Wind size={13} className="text-purple-400" />
                          <strong className="text-stone-100 text-xs font-semibold">Ação Ardilosa</strong>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-700/60 px-1 rounded">
                          Bônus
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                        Desengaja sem provocar ataques como ação bônus.
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                        <span className="text-purple-300 font-bold">Ladino 5e</span>
                        <span className="text-stone-400">Ilimitado</span>
                      </div>
                    </div>
                  )}

                  {/* Two-Weapon Fighting Offhand Attack */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'attack-offhand',
                        name: 'Golpe com Arma Secundária',
                        category: 'attack',
                        rangeSquares: 1,
                        damageFormula: '1d4',
                        description: 'Ataque veloz com arma secundária leve na mão inábil usando uma Ação Bônus.',
                        economyType: 'bonus'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-amber-400/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Swords size={13} className="text-amber-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Arma Secundária</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-700/60 px-1 rounded">
                        Bônus
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Combate com duas armas (sem bônus de atributo no dano).
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-red-400 font-bold">1d4 Dano</span>
                      <span className="text-stone-400">1.5m</span>
                    </div>
                  </div>

                  {/* Quick Pocket Potion */}
                  <div
                    onClick={() => {
                      if (onUseItem) onUseItem('pocao-cura', activeHero.id);
                    }}
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-emerald-500/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Heart size={13} className="text-emerald-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Poção Rápida</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1 rounded">
                        Bônus
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Bebe rapidamente uma poção do cinto no combate.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-emerald-400 font-bold">+2d4+2 PV</span>
                      <span className="text-stone-400">Consumível</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ TAB 3: MOVIMENTO (ORÇAMENTO, DISPARAR, DESENGAJAR, ROTA) ═══ */}
              {activeTab === 'movement' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {/* Speed Overview Card */}
                  <div className="p-2 rounded-xl bg-stone-900/90 border border-cyan-700/70 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Footprints size={13} className="text-cyan-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Deslocamento Base</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-1 rounded">
                        {activeHero.speed}m
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-300 leading-tight mb-1">
                      Equivale a <strong>{Math.round(activeHero.speed / 1.5)} quadrados</strong> (1.5m / 5 pés cada).
                    </div>
                    <div className="text-[10px] font-mono text-cyan-300 border-t border-stone-800 pt-0.5">
                      Clique no mapa para traçar rota com A*
                    </div>
                  </div>

                  {/* Dash (Disparar) */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'disparar',
                        name: 'Disparar (Dash)',
                        category: 'action',
                        rangeSquares: 0,
                        description: 'Você ganha deslocamento extra no turno atual igual à sua velocidade (dobra o movimento).',
                        economyType: 'action'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-cyan-400/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Footprints size={13} className="text-amber-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Disparar (Dash)</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60 px-1 rounded">
                        1 Ação
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Dobra seu deslocamento no turno atual (+{activeHero.speed}m).
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-amber-300 font-bold">+{activeHero.speed}m extra</span>
                      <span className="text-stone-400">Regra 5e</span>
                    </div>
                  </div>

                  {/* Disengage (Desengajar) */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'desengajar',
                        name: 'Desengajar',
                        category: 'action',
                        rangeSquares: 0,
                        description: 'Seu movimento não provoca ataques de oportunidade de inimigos pelo restante do turno.',
                        economyType: 'action'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-cyan-400/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Wind size={13} className="text-cyan-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Desengajar</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-1 rounded">
                        1 Ação
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Evita ataques de oportunidade ao se afastar.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-cyan-300 font-bold">Recuo Seguro</span>
                      <span className="text-stone-400">1 Turno</span>
                    </div>
                  </div>

                  {/* Stand Up (Levantar-se) */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'levantar',
                        name: 'Levantar-se',
                        category: 'action',
                        rangeSquares: 0,
                        description: 'Levanta-se do chão gastando metade do seu deslocamento total no turno.',
                        economyType: 'movement'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-stone-600 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <RotateCcw size={13} className="text-stone-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Levantar-se</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-stone-800 text-stone-300 px-1 rounded">
                        Custo: Metade
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Custa {Math.round(activeHero.speed / 2)}m para se levantar se caído.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-stone-300 font-bold">5e Caído</span>
                      <span className="text-stone-400">Imediato</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ TAB 4: REAÇÃO (ATAQUE DE OPORTUNIDADE, ESCUDO ARCANO, PREPARAR) ═══ */}
              {activeTab === 'reaction' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {/* Opportunity Attack */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'ataque-oportunidade',
                        name: 'Ataque de Oportunidade',
                        category: 'action',
                        rangeSquares: 1,
                        damageFormula: activeHero.damage,
                        description: 'Reação: Você pode desferir um ataque corpo a corpo quando uma criatura hostil que você possa ver sai do seu alcance (1.5m).',
                        economyType: 'reaction'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-purple-700/70 hover:border-purple-400/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Swords size={13} className="text-purple-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Ataque de Oportunidade</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/60 px-1 rounded">
                        Reação
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Ataca quando o inimigo sai do seu alcance de 1.5m.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-red-400 font-bold">{activeHero.damage} Dano</span>
                      <span className="text-stone-400">Automático</span>
                    </div>
                  </div>

                  {/* SRD Reaction Spells */}
                  <React.Fragment>
                    <div className="hidden" data-srd-reaction-spells="true" />

                    {heroSpells
                      .filter(
                        (s) =>
                          s.economyType ===
                          'reaction'
                      )
                      .map(
                        renderSpellCard
                      )}
                  </React.Fragment>

                  {/* Ready Action (Preparar Ação) */}
                  <div
                    onClick={() =>
                      handleSelectAction({
                        id: 'preparar-acao',
                        name: 'Preparar Ação (Ready)',
                        category: 'action',
                        rangeSquares: 0,
                        description: 'Você prepara uma ação no seu turno para ser disparada como reação quando um gatilho específico acontecer antes do seu próximo turno.',
                        economyType: 'reaction'
                      })
                    }
                    className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-850 border border-stone-700/80 hover:border-amber-400/80 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Target size={13} className="text-amber-400" />
                        <strong className="text-stone-100 text-xs font-semibold">Preparar Ação</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60 px-1 rounded">
                        Reação
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-tight mb-1 truncate">
                      Define gatilho para disparar ação fora da vez.
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-stone-800 pt-0.5">
                      <span className="text-amber-300 font-bold">Gatilho Tático</span>
                      <span className="text-stone-400">1 Rodada</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ TAB 5: TODAS AS 18 PERÍCIAS OFICIAIS D&D 5E ═══ */}
              {activeTab === 'skills' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                  {ALL_5E_SKILLS.map((sk) => {
                    const isProf = activeHero.skills.includes(sk.name);
                    const isExp = activeHero.expertise.includes(sk.name);
                    const attrMod = mod(activeHero.stats[sk.attrIdx]);
                    const totalBonus = attrMod + (isProf ? prof(activeHero.level) : 0) + (isExp ? prof(activeHero.level) : 0);

                    return (
                      <button
                        key={sk.name}
                        disabled={busy}
                        onClick={() =>
                          onActionSelect({
                            id: `skill-${sk.name}`,
                            name: `Teste de ${sk.name}`,
                            category: 'skill',
                            rangeSquares: 0,
                            description: `Realiza um teste oficial de ${sk.name} (${sk.attrName}) com modificador ${signed(totalBonus)}.`
                          })
                        }
                        className={`p-1.5 rounded-lg border text-left transition-all shadow-sm flex flex-col justify-between cursor-pointer active:scale-95 ${
                          isExp
                            ? 'bg-amber-950/40 border-amber-500/80 text-amber-200'
                            : isProf
                            ? 'bg-stone-900 border-stone-700 text-stone-100 hover:border-amber-400/70'
                            : 'bg-stone-950/80 border-stone-800/80 text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-semibold truncate">{sk.name}</span>
                          {isExp ? (
                            <span title="Especialista"><Award size={11} className="text-amber-400 shrink-0" /></span>
                          ) : isProf ? (
                            <span title="Proficiente"><CheckCircle2 size={10} className="text-emerald-400 shrink-0" /></span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-stone-500">{sk.attrName}</span>
                          <span className="font-bold text-amber-400 text-xs">{signed(totalBonus)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
