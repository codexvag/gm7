'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  ShoppingBag,
  Coins,
  Shield,
  Sword,
  Sparkles,
  FlaskConical,
  ScrollText,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Character } from '@/lib/game-engine';
import { ITEMS_CATALOG } from '@/lib/game-engine';
import { generateShopStock, type ProceduralItem, type ItemRarity } from '@/lib/procedural-items';
import { playSfx } from '@/lib/sound-effects';

export interface ShopMerchant {
  id: string;
  name: string;
  role: string;
  category: 'alchemy' | 'blacksmith' | 'general';
  avatar?: string;
  dialogue?: string;
}

interface ShopModalProps {
  isOpen: boolean;
  merchant: ShopMerchant | null;
  hero: Character | null;
  priceMultiplier?: number;
  economyNotice?: string;
  onClose: () => void;
  onBuyItem: (item: ProceduralItem, price: number) => Promise<void>;
  onSellItem: (itemName: string, salePrice: number) => Promise<void>;
}

const RARITY_COLORS: Record<ItemRarity, { border: string; bg: string; text: string; label: string }> = {
  comum: { border: 'border-zinc-700', bg: 'bg-zinc-800/60', text: 'text-zinc-300', label: 'Comum' },
  incomum: { border: 'border-emerald-600/70', bg: 'bg-emerald-950/40', text: 'text-emerald-400', label: 'Incomum' },
  raro: { border: 'border-sky-500/80', bg: 'bg-sky-950/40', text: 'text-sky-300', label: 'Raro' },
  muito_raro: { border: 'border-purple-500/80', bg: 'bg-purple-950/40', text: 'text-purple-300', label: 'Muito Raro' },
  lendario: { border: 'border-amber-500/90', bg: 'bg-amber-950/50', text: 'text-amber-300', label: 'Lendário' }
};

export function ShopModal({
  isOpen,
  merchant,
  hero,
  priceMultiplier = 1.0,
  economyNotice,
  onClose,
  onBuyItem,
  onSellItem
}: ShopModalProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate merchant stock dynamically based on merchant category and level tier
  const shopStock = useMemo(() => {
    if (!merchant) return [];

    if (merchant.category === 'alchemy') {
      return [
        {
          id: 'pocao-cura',
          name: 'Poção de Cura',
          type: 'pocao' as const,
          rarity: 'comum' as ItemRarity,
          description: 'Líquido rubi cintilante. Beber restaura 2d4 + 2 Pontos de Vida instantaneamente.',
          value: 50,
          weight: 0.5,
          tier: 1 as const,
          icon: 'FlaskConical'
        },
        {
          id: 'pocao-cura-maior',
          name: 'Poção de Cura Maior',
          type: 'pocao' as const,
          rarity: 'incomum' as ItemRarity,
          description: 'Frasco denso de essência vital. Beber restaura 4d4 + 4 Pontos de Vida.',
          value: 150,
          weight: 0.5,
          tier: 2 as const,
          icon: 'FlaskConical'
        },
        {
          id: 'elixir-forca',
          name: 'Elixir de Força do Gigante',
          type: 'pocao' as const,
          rarity: 'raro' as ItemRarity,
          description: 'Líquido fumegante que eleva o modificador de ataque e dano temporariamente.',
          value: 350,
          weight: 0.5,
          tier: 2 as const,
          icon: 'Zap'
        },
        {
          id: 'pergaminho-misseis',
          name: 'Pergaminho de Mísseis Mágicos',
          type: 'pergaminho' as const,
          rarity: 'comum' as ItemRarity,
          description: 'Pergaminho com 3 dardos de força mágica infalíveis (1d4+1 cada).',
          value: 75,
          weight: 0.2,
          tier: 1 as const,
          icon: 'ScrollText'
        },
        {
          id: 'pergaminho-passo-nebuloso',
          name: 'Pergaminho de Passo Nebuloso',
          type: 'pergaminho' as const,
          rarity: 'incomum' as ItemRarity,
          description: 'Teletransporta o conjurador instantaneamente até 9 metros sem ataques de oportunidade.',
          value: 120,
          weight: 0.2,
          tier: 2 as const,
          icon: 'Footprints'
        },
        {
          id: 'tocha-alquimica',
          name: 'Tocha Alquímica de Valdoria',
          type: 'geral' as const,
          rarity: 'comum' as ItemRarity,
          description: 'Ilumina um raio de 6 metros por 1 hora contínua sem produzir fumaça.',
          value: 5,
          weight: 0.5,
          tier: 1 as const,
          icon: 'Flame'
        }
      ];
    }

    // Weapons & Armors generated procedural D&D 5e SRD
    const tier = hero ? Math.min(4, Math.max(1, Math.ceil(hero.level / 4))) : 1;
    return generateShopStock(tier as any, 9876);
  }, [merchant, hero]);

  // Inventory items parsing for hero
  const heroInventoryList = useMemo(() => {
    if (!hero?.inventory) return [];
    return hero.inventory
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line, idx) => {
        // Look up item in catalog if possible
        const matched = Object.values(ITEMS_CATALOG).find(
          (c) => c.name.toLowerCase() === line.toLowerCase() || line.toLowerCase().startsWith(c.name.toLowerCase())
        );
        const baseValue = matched?.value || 15;
        const salePrice = Math.max(1, Math.round(baseValue * 0.5 * priceMultiplier));
        return {
          uid: `${line}-${idx}`,
          name: line,
          baseValue,
          salePrice,
          type: matched?.type || 'geral',
          rarity: (matched?.rarity || 'comum') as ItemRarity,
          description: matched?.description || 'Item de aventureiro útil na jornada.'
        };
      });
  }, [hero?.inventory, priceMultiplier]);

  if (!isOpen || !merchant || !hero) return null;

  const currentGold = hero.gold ?? 0;

  const triggerFeedback = (text: string, type: 'success' | 'error') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleBuy = async (item: ProceduralItem) => {
    const finalPrice = Math.max(1, Math.round(item.value * priceMultiplier));
    if (currentGold < finalPrice) {
      try { playSfx('error'); } catch {}
      triggerFeedback(`Ouro insuficiente! Você precisa de ${finalPrice} PO.`, 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await onBuyItem(item, finalPrice);
      try { playSfx('loot'); } catch {}
      triggerFeedback(`Comprou "${item.name}" por ${finalPrice} PO!`, 'success');
    } catch (err: any) {
      triggerFeedback(err?.message || 'Falha ao comprar o item.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSell = async (item: { name: string; salePrice: number }) => {
    setIsProcessing(true);
    try {
      await onSellItem(item.name, item.salePrice);
      try { playSfx('loot'); } catch {}
      triggerFeedback(`Vendeu "${item.name}" por +${item.salePrice} PO!`, 'success');
    } catch (err: any) {
      triggerFeedback(err?.message || 'Falha ao vender o item.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] bg-gradient-to-b from-[#141210] via-[#0f0e0c] to-[#0a0908] border-2 border-amber-600/70 rounded-3xl shadow-[0_0_50px_rgba(217,119,6,0.3)] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-amber-900/40 bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-700 via-amber-950 to-black border-2 border-amber-500/80 shadow-md flex items-center justify-center font-serif text-xl font-black text-amber-200 shrink-0">
              {merchant.avatar || (merchant.category === 'alchemy' ? '🧪' : '⚔️')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-serif font-black text-amber-100 tracking-wide">
                  {merchant.name}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {merchant.role}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-serif italic mt-0.5">
                "{merchant.dialogue || 'Seja bem-vindo! Tenho provisões selecionadas para sua jornada.'}"
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/80 transition-colors cursor-pointer"
            title="Fechar Comércio (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Economy & Gold Status Bar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-950/30 via-zinc-900/60 to-amber-950/30 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Market Multiplier / AI Narrative Status */}
          <div className="flex items-center gap-2 text-zinc-300">
            {priceMultiplier > 1.05 ? (
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <TrendingUp size={14} /> Preços Elevados (+{Math.round((priceMultiplier - 1) * 100)}%)
              </span>
            ) : priceMultiplier < 0.95 ? (
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <TrendingDown size={14} /> Abundância (-{Math.round((1 - priceMultiplier) * 100)}%)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-300 font-bold">
                <CheckCircle2 size={14} /> Mercado Equilibrado (1.0x)
              </span>
            )}
            <span className="text-zinc-600 font-mono">•</span>
            <span className="text-zinc-400 text-[11px] truncate max-w-[280px] sm:max-w-md" title={economyNotice}>
              {economyNotice || 'Rotas comerciais livres para a vila.'}
            </span>
          </div>

          {/* Hero Gold Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold font-mono">
            <Coins size={15} className="text-amber-400" />
            <span>{currentGold} PO</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/80 px-4 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('buy')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold font-serif uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'buy'
                ? 'bg-amber-600 text-black shadow-md border-t-2 border-amber-300'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Comprar ({shopStock.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold font-serif uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'sell'
                ? 'bg-amber-600 text-black shadow-md border-t-2 border-amber-300'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <Coins size={14} />
            <span>Vender ({heroInventoryList.length})</span>
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackMsg && (
          <div
            className={`mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/80 text-emerald-200'
                : 'bg-red-950/80 border border-red-500/80 text-red-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {activeTab === 'buy' ? (
            shopStock.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 font-serif">
                O mercador esgotou seus estoques por hoje.
              </div>
            ) : (
              shopStock.map((item) => {
                const finalPrice = Math.max(1, Math.round(item.value * priceMultiplier));
                const canAfford = currentGold >= finalPrice;
                const rarityStyle = RARITY_COLORS[item.rarity] || RARITY_COLORS.comum;

                return (
                  <div
                    key={item.id}
                    className={`p-3 sm:p-3.5 rounded-2xl border ${rarityStyle.border} ${rarityStyle.bg} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:brightness-110`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-black/60 border border-zinc-700 flex items-center justify-center shrink-0 text-amber-400">
                        {item.type === 'pocao' ? (
                          <FlaskConical size={20} />
                        ) : item.type === 'pergaminho' ? (
                          <ScrollText size={20} />
                        ) : item.type === 'armadura' ? (
                          <Shield size={20} />
                        ) : (
                          <Sword size={20} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-zinc-100 font-serif truncate">
                            {item.name}
                          </h4>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${rarityStyle.bg} border ${rarityStyle.border} ${rarityStyle.text}`}>
                            {rarityStyle.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-mono font-bold text-amber-300 text-sm">
                          <Coins size={14} className="text-amber-400" />
                          <span>{finalPrice} PO</span>
                        </div>
                        {priceMultiplier !== 1.0 && (
                          <span className="text-[10px] text-zinc-500 line-through block">
                            Base: {item.value} PO
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleBuy(item)}
                        disabled={!canAfford || isProcessing}
                        className={`px-4 py-2 rounded-xl text-xs font-bold font-serif uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                          canAfford && !isProcessing
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black border border-yellow-200'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                        }`}
                      >
                        <ShoppingBag size={13} />
                        <span>{canAfford ? 'Comprar' : 'Sem Ouro'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* Sell Inventory Tab */
            heroInventoryList.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 font-serif">
                Sua mochila de aventureiro está vazia. Não há itens para vender.
              </div>
            ) : (
              heroInventoryList.map((item) => {
                const rarityStyle = RARITY_COLORS[item.rarity] || RARITY_COLORS.comum;

                return (
                  <div
                    key={item.uid}
                    className="p-3 sm:p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-black/60 border border-zinc-800 flex items-center justify-center shrink-0 text-amber-300">
                        {item.name.toLowerCase().includes('poção') ? (
                          <FlaskConical size={20} />
                        ) : item.name.toLowerCase().includes('escudo') || item.name.toLowerCase().includes('cota') ? (
                          <Shield size={20} />
                        ) : (
                          <Sword size={20} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-200 font-serif truncate">
                            {item.name}
                          </h4>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${rarityStyle.bg} border ${rarityStyle.border} ${rarityStyle.text}`}>
                            {rarityStyle.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-mono font-bold text-emerald-400 text-sm">
                          <Coins size={14} className="text-emerald-400" />
                          <span>+{item.salePrice} PO</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block">
                          50% valor D&D 5e
                        </span>
                      </div>

                      <button
                        onClick={() => handleSell(item)}
                        disabled={isProcessing}
                        className="px-4 py-2 rounded-xl text-xs font-bold font-serif uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/60 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Coins size={13} />
                        <span>Vender</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono shrink-0">
          <span className="flex items-center gap-1">
            <Info size={12} className="text-amber-500" />
            Tabelas e equipamentos certificados D&D 5e SRD 5.2.1
          </span>
          <span>Valdoria • Economia Autorizada</span>
        </div>
      </div>
    </div>
  );
}
