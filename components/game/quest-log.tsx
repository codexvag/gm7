'use client';

import React from 'react';
import {
  Scroll,
  CheckCircle2,
  Circle,
  X,
  Award,
  Flame,
  Clock,
  Swords,
  Lock,
  RefreshCw,
  Play,
  MapPin
} from 'lucide-react';

import {
  MICRO_ADVENTURES
} from '@/lib/micro-adventures';

import {
  DRAGON_RUMORS,
  IGNISRAX_SRD_STATS
} from '@/lib/dragon-encounter';

interface QuestLogProps {
  onClose: () => void;
  notes: string;
  onSaveNotes: (notes: string) => void;
  isOwner: boolean;
  questProgress?: Record<string, boolean>;
  campaignProof?: Record<string, boolean>;
  worldFlags?: Record<string, boolean>;
  activeAdventureId?: string;
  adventureCompletions?: Record<string, number>;
  adventureCooldowns?: Record<string, number>;
  onStartAdventure?: (advId: string) => void;
  onChallengeDragon?: () => void;
}

export function QuestLog({
  onClose,
  notes,
  questProgress,
  campaignProof,
  worldFlags,
  activeAdventureId,
  adventureCompletions,
  adventureCooldowns,
  onStartAdventure,
  onChallengeDragon
}: QuestLogProps) {
  const qp =
    questProgress ||
    {};

  const proof =
    campaignProof ||
    {};

  const flags =
    worldFlags ||
    {};

  const dragonDefeated =
    Boolean(
      proof.ignisrax_defeated
    );

  const isDragonLairUnlocked =
    Boolean(
      flags.dragon_lair_unlocked ||
      flags.canyon_secured ||
      qp.canyon_cleared ||
      dragonDefeated
    );

  const milestones = [
    {
      label: 'Miss?o recebida de Doran',
      done: Boolean(qp.doran_talked)
    },
    {
      label: 'Provis?es de Elenor',
      done: Boolean(qp.elenor_talked)
    },
    {
      label: 'Port?es liberados por Kaelen',
      done: Boolean(qp.kaelen_talked)
    },
    {
      label: 'Floresta assegurada',
      done: Boolean(qp.forest_cleared)
    },
    {
      label: 'Ru?nas da Abadia expurgadas',
      done: Boolean(qp.ruins_cleared)
    },
    {
      label: 'Malakor derrotado',
      done: Boolean(qp.malakor_defeated)
    },
    {
      label: 'Vanguarda drac?nica destru?da',
      done: Boolean(qp.canyon_cleared)
    },
    {
      label: 'Ignisrax derrotado',
      done: dragonDefeated
    }
  ];

  const completedMilestones =
    milestones.filter(
      (item) => item.done
    ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-5 animate-fade-in select-none">
      <div className="relative w-full max-w-5xl h-[min(92dvh,900px)] min-h-0 bg-zinc-950 border border-amber-800/60 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        <header className="shrink-0 flex items-start justify-between gap-4 px-4 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-950/95">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-amber-300">
              <Scroll size={20} className="shrink-0" />
              <h2 className="text-base sm:text-xl font-bold font-serif leading-tight">
                Di?rio de Valdoria
              </h2>
            </div>

            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 whitespace-normal break-words leading-relaxed">
              Campanha, contratos, microaventuras e atividades persistentes do sandbox.
            </p>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
            aria-label="Fechar di?rio"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-4 sm:py-5 space-y-5 scrollbar-thin">

          <section className="rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/20 via-zinc-900/70 to-emerald-950/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif font-bold text-amber-200">
                  Campanha Principal
                </h3>

                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  O progresso ? persistente e cada marco desbloqueia regi?es, recompensas ou novas atividades.
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-emerald-300 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-700/40">
                {completedMilestones}/{milestones.length}
              </span>
            </div>

            <div className="h-2 rounded-full overflow-hidden bg-zinc-950 border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                style={{
                  width:
                    Math.round(
                      (
                        completedMilestones /
                        milestones.length
                      ) *
                      100
                    ) + '%'
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {milestones.map(
                (milestone) => (
                  <div
                    key={milestone.label}
                    className={
                      'flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed ' +
                      (
                        milestone.done
                          ? 'border-emerald-800/50 bg-emerald-950/20 text-emerald-200'
                          : 'border-zinc-800 bg-black/20 text-zinc-400'
                      )
                    }
                  >
                    {milestone.done ? (
                      <CheckCircle2
                        size={14}
                        className="shrink-0 mt-0.5 text-emerald-400"
                      />
                    ) : (
                      <Circle
                        size={14}
                        className="shrink-0 mt-0.5 text-zinc-600"
                      />
                    )}

                    <span className="whitespace-normal break-words">
                      {milestone.label}
                    </span>
                  </div>
                )
              )}
            </div>

            {dragonDefeated && (
              <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-3 text-xs text-amber-100 leading-relaxed whitespace-normal break-words">
                ?? A campanha principal foi conclu?da. Valdoria permanece ativa em modo persistente com contratos repet?veis, eventos e ca?adas de endgame.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-red-900/50 bg-gradient-to-br from-red-950/25 via-zinc-900/70 to-orange-950/15 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame
                  size={19}
                  className="text-red-400"
                />

                <h3 className="font-serif font-bold text-red-200">
                  Ignisrax, o Flagelo Rubro
                </h3>
              </div>

              <span className="text-[10px] font-mono px-2 py-1 rounded-full border border-red-800/50 bg-red-950/40 text-red-300">
                {dragonDefeated
                  ? 'Derrotado'
                  : isDragonLairUnlocked
                    ? 'Covil revelado'
                    : 'Investiga??o'}
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed whitespace-normal break-words">
              {dragonDefeated
                ? 'Ignisrax foi derrotado, mas a Cratera Magm?tica continua sendo uma regi?o de endgame onde novas criaturas podem disputar seu antigo territ?rio.'
                : 'O drag?o permanece como amea?a central da campanha. Rumores, contratos e acontecimentos regionais revelam gradualmente o caminho para seu covil.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {DRAGON_RUMORS.map(
                (rumor, index) => {
                  const available =
                    index === 0 ||
                    (
                      index === 1 &&
                      Boolean(
                        flags.bridge_cleared ||
                        flags.dragon_rumor_stage1
                      )
                    ) ||
                    (
                      index === 2 &&
                      Boolean(
                        flags.abbey_cleared ||
                        flags.dragon_rumor_stage3
                      )
                    );

                  return (
                    <article
                      key={index}
                      className={
                        'rounded-xl border p-3 text-[11px] leading-relaxed ' +
                        (
                          available
                            ? 'border-amber-700/40 bg-zinc-900/60 text-zinc-300'
                            : 'border-zinc-800 bg-black/20 text-zinc-600'
                        )
                      }
                    >
                      <strong className="block text-[10px] uppercase font-mono text-amber-400 mb-1">
                        Fase {index + 1} ? {rumor.npc}
                      </strong>

                      <p className="whitespace-normal break-words italic">
                        ?{rumor.text}?
                      </p>
                    </article>
                  );
                }
              )}
            </div>

            {isDragonLairUnlocked &&
              !dragonDefeated &&
              onChallengeDragon && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      onChallengeDragon();
                      onClose();
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Swords size={15} />
                    Marchar para o Covil
                  </button>
                </div>
              )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-xs uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
                  <Clock size={14} />
                  Contratos & Microaventuras
                </h3>

                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Cada contrato possui estado pr?prio. ?Continuar? retoma exatamente a atividade que j? est? no servidor.
                </p>
              </div>

              <span className="text-[10px] text-zinc-400 font-mono">
                {Object.values(MICRO_ADVENTURES).length} atividades
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {Object.values(
                MICRO_ADVENTURES
              ).map(
                (adventure) => {
                  const active =
                    activeAdventureId ===
                    adventure.id;

                  const completions =
                    adventureCompletions
                      ?.[adventure.id] ||
                    0;

                  const completed =
                    completions > 0 ||
                    Boolean(
                      flags[
                        'completed_' +
                        adventure.id
                      ]
                    );

                  const cooldownUntil =
                    adventureCooldowns
                      ?.[adventure.id] ||
                    0;

                  const cooling =
                    cooldownUntil >
                    Date.now();

                  const unlocked =
                    !adventure.requiredFlags ||
                    adventure.requiredFlags.length ===
                      0 ||
                    adventure.requiredFlags.every(
                      (flag) =>
                        Boolean(
                          flags[flag]
                        )
                    );

                  return (
                    <article
                      key={adventure.id}
                      className={
                        'rounded-2xl border p-4 flex flex-col gap-3 ' +
                        (
                          active
                            ? 'border-amber-400/70 bg-amber-950/20'
                            : completed
                              ? 'border-emerald-800/50 bg-emerald-950/10'
                              : unlocked
                                ? 'border-zinc-700 bg-zinc-900/55'
                                : 'border-zinc-800 bg-black/25 opacity-65'
                        )
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                          <Clock size={11} />
                          ~{adventure.estimatedMinutes} min
                        </span>

                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-zinc-700 bg-black/30">
                          {active
                            ? 'Em andamento'
                            : cooling
                              ? 'Em recarga'
                              : completed
                                ? 'Conclu?da'
                                : unlocked
                                  ? 'Dispon?vel'
                                  : 'Bloqueada'}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-serif font-bold text-zinc-100 text-sm">
                          {adventure.title}
                        </h4>

                        <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed whitespace-normal break-words">
                          {adventure.hookNpcDialogue}
                        </p>
                      </div>

                      {active && (
                        <div className="rounded-xl border border-amber-800/40 bg-black/25 p-2.5 text-[11px] text-amber-100 leading-relaxed">
                          <strong className="block mb-1">
                            Objetivo atual
                          </strong>

                          {adventure.stages[1]?.objective ||
                            adventure.stages[0]?.objective}
                        </div>
                      )}

                      <div className="mt-auto pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] font-mono text-zinc-400 leading-relaxed">
                          +{adventure.rewards.xp} XP ? +{adventure.rewards.gold} PO
                          {completions > 0 && (
                            <span className="text-emerald-400 ml-1">
                              ? {completions} conclus?o{completions > 1 ? '?es' : ''}
                            </span>
                          )}
                        </div>

                        {unlocked &&
                          onStartAdventure && (
                            <button
                              disabled={
                                cooling &&
                                !active
                              }
                              onClick={() => {
                                onStartAdventure(
                                  adventure.id
                                );
                              }}
                              className={
                                'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ' +
                                (
                                  cooling &&
                                  !active
                                    ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                                    : active
                                      ? 'bg-amber-600 hover:bg-amber-500 text-black'
                                      : 'bg-zinc-800 hover:bg-amber-600 hover:text-black text-zinc-200'
                                )
                              }
                            >
                              {active ? (
                                <>
                                  <Play size={12} />
                                  Continuar
                                </>
                              ) : completed ? (
                                <>
                                  <RefreshCw size={12} />
                                  Repetir
                                </>
                              ) : (
                                <>
                                  <Play size={12} />
                                  Iniciar
                                </>
                              )}
                            </button>
                          )}

                        {!unlocked && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Lock size={11} />
                            Requisitos ainda n?o cumpridos
                          </span>
                        )}
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
            <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">
              Anota??es da Mesa
            </h3>

            <p className="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed mt-2">
              {notes ||
                'Nenhuma anota??o adicional registrada.'}
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
