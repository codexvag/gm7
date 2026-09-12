'use client';

import React from 'react';
import {
  Scroll,
  CheckCircle2,
  Circle,
  X,
  MapPin,
  Award,
  Flame,
  Clock,
  Swords,
  ShieldAlert,
  Sparkles,
  Lock
} from 'lucide-react';
import { MICRO_ADVENTURES } from '@/lib/micro-adventures';
import { DRAGON_RUMORS, IGNISRAX_SRD_STATS } from '@/lib/dragon-encounter';

export type QuestItem = {
  id: string;
  title: string;
  location: string;
  description: string;
  objectives: { text: string; completed: boolean }[];
  completed?: boolean;
};

interface QuestLogProps {
  onClose: () => void;
  notes: string;
  onSaveNotes: (notes: string) => void;
  isOwner: boolean;
  questProgress?: Record<string, boolean>;
  worldFlags?: Record<string, boolean>;
  activeAdventureId?: string;
  onStartAdventure?: (advId: string) => void;
  onChallengeDragon?: () => void;
}

export function QuestLog({
  onClose,
  notes,
  isOwner,
  questProgress,
  worldFlags,
  activeAdventureId,
  onStartAdventure,
  onChallengeDragon
}: QuestLogProps) {
  const qp = questProgress || {};
  const flags = worldFlags || {};

  const isDragonLairUnlocked = Boolean(flags.dragon_lair_unlocked || flags.canyon_secured);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in select-none">
      <div className="relative w-full max-w-4xl bg-zinc-950 border-2 border-amber-900/60 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Scroll size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-amber-200 font-serif tracking-wide flex items-center gap-2">
                Diário de Valdoria • Sandbox & Microaventuras
              </h2>
              <span className="text-[11px] text-zinc-400">
                Missões rápidas de 10 a 30 min com consequências persistentes no mundo
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Tabs / Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 scrollbar-thin">
          {/* 1. SEÇÃO: O GRANDE BOSS — IGNISRAX, O FLAGELO RUBRO */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/40 via-zinc-900/80 to-amber-950/30 border border-red-500/40 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-red-400 animate-pulse" />
                <h3 className="text-sm sm:text-base font-serif font-black text-red-200">
                  A Ameaça de Ignisrax ({IGNISRAX_SRD_STATS.srdSource})
                </h3>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border border-red-500/50 bg-red-950/60 text-red-300 font-bold">
                {isDragonLairUnlocked ? 'Covil Revelado 🌋' : 'Rumores & Sinais ⏳'}
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              O lendário Jovem Dragão Vermelho repousa na Cratera Magmática. Para enfrentá-lo com chances de vitória, o grupo precisa expurgar a vanguarda e reunir pistas através das microaventuras do sandbox.
            </p>

            {/* Dragon Rumors Progress */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-red-900/40">
              {DRAGON_RUMORS.map((r, i) => {
                const isActive =
                  i === 0
                    ? true
                    : i === 1
                    ? Boolean(flags.bridge_cleared || flags.dragon_rumor_stage1)
                    : Boolean(flags.abbey_cleared || flags.dragon_rumor_stage3);

                return (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl border text-[11px] flex flex-col gap-1 ${
                      isActive
                        ? 'bg-zinc-900/60 border-amber-500/40 text-zinc-200'
                        : 'bg-zinc-950/40 border-zinc-800 text-zinc-600 opacity-60'
                    }`}
                  >
                    <span className="font-mono text-[9px] uppercase text-amber-400 font-bold">
                      Fase {i}: {r.npc}
                    </span>
                    <p className="line-clamp-3 leading-relaxed italic">&ldquo;{r.text}&rdquo;</p>
                  </div>
                );
              })}
            </div>

            {/* Action to Challenge Dragon */}
            {isDragonLairUnlocked && onChallengeDragon && (
              <div className="pt-2 flex items-center justify-end">
                <button
                  onClick={() => {
                    onChallengeDragon();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Swords size={16} />
                  <span>Marchar para o Covil de Ignisrax (Confronto Final)</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. SEÇÃO: MICROAVENTURAS DE VALDORIA (10 A 30 MINUTOS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest text-amber-400/90 font-bold flex items-center gap-1.5">
                <Clock size={14} /> Microaventuras Reutilizáveis (10 a 30 min)
              </h3>
              <span className="text-[10px] text-zinc-400 font-mono">
                {Object.values(MICRO_ADVENTURES).length} Aventuras Disponíveis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.values(MICRO_ADVENTURES).map((adv) => {
                const isCompleted = Boolean(flags[`completed_${adv.id}`]);
                const isCurrentActive = activeAdventureId === adv.id;
                const isUnlocked =
                  !adv.requiredFlags || adv.requiredFlags.length === 0
                    ? true
                    : adv.requiredFlags.every((f) => Boolean(flags[f]));

                return (
                  <div
                    key={adv.id}
                    className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all shadow-md ${
                      isCurrentActive
                        ? 'bg-amber-950/30 border-amber-400 ring-1 ring-amber-400/40'
                        : isCompleted
                        ? 'bg-zinc-900/40 border-emerald-800/50'
                        : isUnlocked
                        ? 'bg-zinc-900/60 border-zinc-700/80 hover:border-amber-500/50'
                        : 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono text-amber-400 font-bold flex items-center gap-1">
                          <Clock size={11} /> ~{adv.estimatedMinutes} min
                        </span>
                        {isCompleted ? (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded border border-emerald-500/40">
                            Concluída ✅
                          </span>
                        ) : isCurrentActive ? (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-500/40 animate-pulse">
                            Em Andamento ⏳
                          </span>
                        ) : !isUnlocked ? (
                          <span className="text-[9px] bg-zinc-800 text-zinc-400 font-mono px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Lock size={9} /> Bloqueada
                          </span>
                        ) : (
                          <span className="text-[9px] bg-sky-500/20 text-sky-300 font-mono px-1.5 py-0.5 rounded border border-sky-500/40">
                            Disponível ⚔️
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-zinc-100 font-serif">
                        {adv.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed line-clamp-2">
                        {adv.hookNpcDialogue}
                      </p>
                    </div>

                    {/* Recompensas e Botão */}
                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-zinc-400 font-mono">
                        +{adv.rewards.xp} XP • +{adv.rewards.gold} PO
                      </div>

                      {isUnlocked && onStartAdventure && (
                        <button
                          onClick={() => {
                            onStartAdventure(adv.id);
                            onClose();
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-transform active:scale-95 cursor-pointer ${
                            isCurrentActive
                              ? 'bg-amber-600 text-black font-black'
                              : 'bg-zinc-800 hover:bg-amber-600 hover:text-black text-zinc-200 border border-zinc-700'
                          }`}
                        >
                          {isCurrentActive ? 'Continuar' : isCompleted ? 'Repetir' : 'Iniciar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. SEÇÃO: ANOTAÇÕES LIVRES */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2">
            <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">
              Anotações Livres da Mesa
            </h3>
            <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {notes || 'Nenhuma anotação adicional registrada no momento.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

