'use client';

import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronRight,
  BookOpen,
  X,
  Swords,
  Shield,
  Award,
  Flame,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { State, Character } from '@/lib/game-engine';

export interface CampaignStep {
  id: number;
  act: number;
  chapterTitle: string;
  stepTitle: string;
  description: string;
  locationHint: string;
  actionLabel?: string;
  actionType?: 'talk_doran' | 'talk_elenor' | 'talk_kaelen' | 'travel_forest' | 'travel_ruins' | 'travel_dungeon' | 'travel_canyon' | 'travel_lair' | 'combat' | 'rest' | 'open_journal';
}

export const CAMPAIGN_STEPS: CampaignStep[] = [
  {
    id: 1,
    act: 0,
    chapterTitle: 'Prólogo • Vila do Rio Verde',
    stepTitle: 'O Chamado do Ancião Doran',
    description: 'Encontre o Ancião Doran e receba a missão que inicia a campanha de Valdoria.',
    locationHint: 'Praça Central da Vila',
    actionLabel: 'Falar com Doran',
    actionType: 'talk_doran'
  },
  {
    id: 2,
    act: 0,
    chapterTitle: 'Prólogo • Vila do Rio Verde',
    stepTitle: 'Provisões da Alquimista Elenor',
    description: 'Prepare a expedição e converse com Elenor antes de deixar a segurança da vila.',
    locationHint: 'Oficina da Alquimista',
    actionLabel: 'Falar com Elenor',
    actionType: 'talk_elenor'
  },
  {
    id: 3,
    act: 0,
    chapterTitle: 'Prólogo • Vila do Rio Verde',
    stepTitle: 'Autorização do Capitão Kaelen',
    description: 'Obtenha a autorização da guarda para atravessar os portões e iniciar a expedição.',
    locationHint: 'Posto de Guarda',
    actionLabel: 'Falar com Kaelen',
    actionType: 'talk_kaelen'
  },
  {
    id: 4,
    act: 1,
    chapterTitle: 'Ato I • Floresta dos Sussurros',
    stepTitle: 'Assegurar a Rota da Floresta',
    description: 'Derrote a Sentinela de Cinzas e as criaturas que controlam a passagem.',
    locationHint: 'Floresta dos Sussurros',
    actionLabel: 'Viajar para a Floresta',
    actionType: 'travel_forest'
  },
  {
    id: 5,
    act: 2,
    chapterTitle: 'Ato II • Ruínas da Abadia',
    stepTitle: 'Expurgar o Culto das Cinzas',
    description: 'Atravesse as ruínas e elimine a força que protege a entrada das catacumbas.',
    locationHint: 'Pátio das Ruínas da Abadia',
    actionLabel: 'Viajar para as Ruínas',
    actionType: 'travel_ruins'
  },
  {
    id: 6,
    act: 2,
    chapterTitle: 'Ato II • Catacumbas dos Três Selos',
    stepTitle: 'Derrotar Malakor',
    description: 'Entre nas catacumbas, vença os guardiões e derrube Malakor, o Lorde das Cinzas.',
    locationHint: 'Catacumbas dos Três Selos',
    actionLabel: 'Entrar nas Catacumbas',
    actionType: 'travel_dungeon'
  },
  {
    id: 7,
    act: 3,
    chapterTitle: 'Ato III • Desfiladeiro da Fenda',
    stepTitle: 'Romper a Vanguarda Dracônica',
    description: 'Destrua os wyrmlings e guerreiros draconianos que bloqueiam o caminho até a cratera.',
    locationHint: 'Desfiladeiro da Fenda Escarpada',
    actionLabel: 'Viajar para o Desfiladeiro',
    actionType: 'travel_canyon'
  },
  {
    id: 8,
    act: 3,
    chapterTitle: 'Ato III • Covil de Ignisrax',
    stepTitle: 'Confrontar Ignisrax',
    description: 'Entre na Cratera Magmática e derrote Ignisrax para encerrar a campanha principal.',
    locationHint: 'Covil de Ignisrax',
    actionLabel: 'Marchar para o Covil',
    actionType: 'travel_lair'
  },
  {
    id: 9,
    act: 3,
    chapterTitle: 'Epílogo • Mundo Persistente',
    stepTitle: 'Valdoria Continua Viva',
    description: 'A campanha principal foi concluída. Contratos, dungeons, economia e eventos do sandbox continuam ativos.',
    locationHint: 'Valdoria',
    actionLabel: 'Abrir Diário',
    actionType: 'open_journal'
  }
];

interface CampaignTrackerProps {
  state: State | null;
  activeHero?: Character | null;
  onTalkNpc: (npcId: string) => void;
  onTravel: (biome: 'village' | 'forest' | 'ruins' | 'dungeon' | 'canyon' | 'lair') => void;
  onStartCombat: () => void;
  onOpenJournal: () => void;
}

export function CampaignTracker({
  state,
  activeHero,
  onTalkNpc,
  onTravel,
  onStartCombat,
  onOpenJournal
}: CampaignTrackerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);

  // Determine current campaign step dynamically based on individual hero or party progression
  const currentStepIndex = React.useMemo(() => {
    if (!state) {
      return 0;
    }

    /*
     * Only authoritative campaign proof advances the guide.
     * biome/location are intentionally NOT read here.
     */
    const proof =
      activeHero?.campaignProof ||
      {};

    if (
      proof.ignisrax_defeated
    ) {
      return 8;
    }

    if (
      proof.canyon_cleared
    ) {
      return 7;
    }

    if (
      proof.malakor_defeated
    ) {
      return 6;
    }

    if (
      proof.ruins_cleared
    ) {
      return 5;
    }

    if (
      proof.forest_cleared
    ) {
      return 4;
    }

    if (
      proof.kaelen_talked
    ) {
      return 3;
    }

    if (
      proof.elenor_talked
    ) {
      return 2;
    }

    if (
      proof.doran_talked
    ) {
      return 1;
    }

    return 0;
  }, [
    state,
    activeHero
  ]);

  const currentStep = CAMPAIGN_STEPS[currentStepIndex] || CAMPAIGN_STEPS[0];
  const progressPercent = Math.round(((currentStepIndex + 1) / CAMPAIGN_STEPS.length) * 100);

  // Auto-open briefing once for new adventurers
  useEffect(() => {
    const seen = localStorage.getItem('campaign_briefing_seen_v1');
    if (!seen) {
      setShowBriefingModal(true);
      localStorage.setItem('campaign_briefing_seen_v1', 'true');
    }
  }, []);

  const handleActionClick = () => {
    if (!currentStep.actionType) return;
    switch (currentStep.actionType) {
      case 'talk_doran':
        onTalkNpc('doran');
        break;
      case 'talk_elenor':
        onTalkNpc('elenor');
        break;
      case 'talk_kaelen':
        onTalkNpc('kaelen');
        break;
      case 'travel_forest':
        onTravel('forest');
        break;
      case 'travel_ruins':
        onTravel('ruins');
        break;
      case 'travel_dungeon':
        onTravel('dungeon');
        break;
      case 'travel_canyon':
        onTravel('canyon');
        break;
      case 'travel_lair':
        onTravel('lair');
        break;
      case 'combat':
        onStartCombat();
        break;
      case 'open_journal':
        onOpenJournal();
        break;
    }
  };

  return (
    <>
      {/* ═══ ON-SCREEN CAMPAIGN STEP TRACKER (Always Visible & Accessible) ═══ */}
      <div className="absolute top-12 sm:top-14 left-2 sm:left-4 z-20 max-w-xs sm:max-w-sm w-[92vw] sm:w-auto pointer-events-auto transition-all duration-200 select-none">
        <div className="bg-[#0b100c]/90 border border-amber-600/70 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.85)] backdrop-blur-xl overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#141c14] border-b border-amber-900/60">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Compass size={14} className="animate-spin-slow text-amber-400 shrink-0" />
              <span className="font-serif font-bold text-xs tracking-wide text-amber-200">
                Guia da Campanha
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.2 rounded border border-amber-500/40">
                {currentStepIndex + 1}/{CAMPAIGN_STEPS.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowBriefingModal(true)}
                className="text-[10px] text-zinc-300 hover:text-amber-200 flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
                title="Ver História Completa e Apresentação"
              >
                <BookOpen size={11} className="text-amber-400" />
                <span className="hidden sm:inline">História</span>
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                title={isMinimized ? 'Expandir Guia' : 'Recolher Guia'}
              >
                {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {/* Body Content */}
          {!isMinimized && (
            <div className="p-2.5 flex flex-col gap-2">
              {/* Current Chapter & Step Title */}
              <div>
                <span className="text-[10px] text-amber-400/90 font-mono uppercase tracking-wider block">
                  {currentStep.chapterTitle}
                </span>
                <strong className="text-xs sm:text-sm font-serif font-bold text-zinc-100 block mt-0.5 leading-snug">
                  {currentStep.stepTitle}
                </strong>
              </div>

              {/* Step Description */}
              <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
                {currentStep.description}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-zinc-700/60">
                <div
                  style={{ width: `${progressPercent}%` }}
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                />
              </div>

              {/* Bottom Row: Location & Direct Action Button */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/80 text-[11px]">
                <span className="flex items-center gap-1 text-zinc-400 text-[10px] truncate max-w-[140px]">
                  <MapPin size={11} className="text-amber-400 shrink-0" />
                  <span className="truncate">{currentStep.locationHint}</span>
                </span>

                {currentStep.actionLabel && (
                  <button
                    onClick={handleActionClick}
                    className="flex items-center gap-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-bold px-2.5 py-1 rounded-xl shadow text-[10px] sm:text-xs transition-all active:scale-95 shrink-0"
                  >
                    <span>{currentStep.actionLabel}</span>
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CAMPAIGN PRESENTATION & PROLOGUE BRIEFING MODAL ═══ */}
      {showBriefingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-fade-in select-none">
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#101712] via-[#0c120e] to-[#070b08] border-2 border-amber-600/80 rounded-3xl p-5 sm:p-7 shadow-[0_0_60px_rgba(0,0,0,0.95)] flex flex-col gap-4 max-h-[92dvh] overflow-hidden text-zinc-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-amber-900/60 pb-3">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Flame size={14} className="text-amber-400" /> Campanha Oficial D&D 5e
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-amber-200 tracking-wide mt-1">
                  Crônicas do Vale Proibido: O Despertar das Cinzas
                </h2>
              </div>
              <button
                onClick={() => setShowBriefingModal(false)}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-amber-700">
              {/* Introduction Story Lore */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs sm:text-sm leading-relaxed text-amber-100/90 font-serif italic">
                &ldquo;Durante séculos, os três selos de Valdoria protegeram o Vale das corrupções ancestrais. No entanto, estranhas cinzas começaram a soprar dos bosques profundos da Floresta dos Sussurros, e as sentinelas de pedra despertaram com fúria sombria. A pacífica Vila do Rio Verde é a última fortaleza de esperança. Vocês foram convocados pelo Ancião Doran para desvendar a violação dos selos, adentrar as catacumbas e erradicar o Conjurador do Vazio antes que a noite eterna recaia sobre o reino.&rdquo;
              </div>

              {/* Roteiro da Campanha: Início, Meio e Fim */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-mono text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={14} /> Roteiro da Campanha (Passo a Passo)
                </h3>

                <div className="grid gap-2">
                  {CAMPAIGN_STEPS.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;

                    return (
                      <div
                        key={step.id}
                        className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                          isCurrent
                            ? 'bg-amber-950/40 border-amber-400/90 shadow-md ring-1 ring-amber-400/30'
                            : isCompleted
                            ? 'bg-zinc-900/40 border-emerald-800/40 text-zinc-400'
                            : 'bg-zinc-950/40 border-zinc-800/60 opacity-65'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : isCurrent ? (
                            <div className="w-4 h-4 rounded-full border-2 border-amber-400 bg-amber-500/20 flex items-center justify-center animate-pulse">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            </div>
                          ) : (
                            <Circle size={16} className="text-zinc-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono uppercase text-amber-400/80">
                              Passo {step.id} • {step.chapterTitle}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] bg-amber-400 text-amber-950 font-black px-1.5 rounded uppercase">
                                Atual
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs sm:text-sm font-serif text-zinc-100">
                            {step.stepTitle}
                          </h4>
                          <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dicas de Jogo D&D 5e */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <strong className="text-zinc-200 block text-xs font-bold">
                  💡 Dicas para Aventureiros:
                </strong>
                <p>• <strong>Economia de Ações:</strong> Em combate, você tem direito a 1 Ação e seu deslocamento por turno.</p>
                <p>• <strong>Uso de Terreno:</strong> Posicione-se atrás de coberturas (árvores e muros) para obter proteção defensiva.</p>
                <p>• <strong>Descanso Curto & Longo:</strong> Recupere seus PVs e espaços de magia ao final de cada embate na aba do grupo.</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                Progresso: {progressPercent}% Concluído
              </span>
              <button
                onClick={() => setShowBriefingModal(false)}
                className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-amber-950 font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-xs sm:text-sm"
              >
                {currentStepIndex === 0 ? 'Entendido, Iniciar Aventura!' : 'Continuar Expedição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
