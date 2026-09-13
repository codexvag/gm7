// components/game/level-up-modal.tsx
'use client';

import React, {
  useEffect,
  useState
} from 'react';

import {
  Sparkles,
  Heart,
  Award,
  Plus,
  Minus,
  X
} from 'lucide-react';

import {
  type Character,
  classes,
  abilities,
  mod,
  prof,
  signed,
  isAsiLevel,
  getSpellSlotsForClass
} from '@/lib/game-engine';

import {
  LevelUpSpellSelectionPanel
} from '@/components/game/spell-selection-panel';

import {
  getLevelUpSpellChoicesValidation,
  type LevelUpSpellChoices
} from '@/lib/srd-spellbook';

interface LevelUpModalProps {
  hero: Character;
  isOpen: boolean;
  onClose: () => void;

  onConfirmLevelUp: (
    statIncreases: number[],
    spellChoices:
      LevelUpSpellChoices
  ) =>
    Promise<void> |
    void;

  busy?: boolean;
}

export function LevelUpModal({
  hero,
  isOpen,
  onClose,
  onConfirmLevelUp,
  busy
}: LevelUpModalProps) {
  const newLevel =
    hero.level + 1;

  const classTuple =
    classes.find(
      (entry) =>
        entry[0] ===
        hero.className
    );

  const hitDieSides =
    classTuple
      ? classTuple[1]
      : 8;

  const conMod =
    mod(
      hero.stats[2]
    );

  const avgHpGain =
    Math.max(
      1,
      Math.floor(
        hitDieSides /
        2
      ) +
      1 +
      conMod
    );

  const hasAsi =
    isAsiLevel(
      hero.className,
      newLevel
    );

  const [
    allocatedPoints,
    setAllocatedPoints
  ] =
    useState<number[]>([
      0, 0, 0,
      0, 0, 0
    ]);

  const [
    spellChoices,
    setSpellChoices
  ] =
    useState<LevelUpSpellChoices>({
      newCantrips: [],
      newPrepared: [],
      newSpellbook: []
    });

  useEffect(
    () => {
      setAllocatedPoints([
        0, 0, 0,
        0, 0, 0
      ]);

      setSpellChoices({
        newCantrips: [],
        newPrepared: [],
        newSpellbook: []
      });
    },
    [
      hero.id,
      hero.level,
      isOpen
    ]
  );

  if (!isOpen) {
    return null;
  }

  const totalPointsSpent =
    allocatedPoints.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    );

  const pointsRemaining =
    2 -
    totalPointsSpent;

  const spellValidation =
    getLevelUpSpellChoicesValidation(
      hero,
      hero.level,
      newLevel,
      spellChoices
    );

  const handleAddPoint =
    (
      statIndex:
        number
    ) => {
      if (
        pointsRemaining <=
        0
      ) {
        return;
      }

      if (
        hero.stats[
          statIndex
        ] +
        allocatedPoints[
          statIndex
        ] >=
        20
      ) {
        return;
      }

      const next =
        [
          ...allocatedPoints
        ];

      next[
        statIndex
      ] +=
        1;

      setAllocatedPoints(
        next
      );
    };

  const handleRemovePoint =
    (
      statIndex:
        number
    ) => {
      if (
        allocatedPoints[
          statIndex
        ] <=
        0
      ) {
        return;
      }

      const next =
        [
          ...allocatedPoints
        ];

      next[
        statIndex
      ] -=
        1;

      setAllocatedPoints(
        next
      );
    };

  const handleConfirm =
    async () => {
      if (
        hasAsi &&
        pointsRemaining >
        0
      ) {
        alert(
          'Distribua os 2 pontos do aumento de atributo.'
        );

        return;
      }

      if (
        !spellValidation.ok
      ) {
        alert(
          spellValidation.reason ||
          'Conclua as escolhas de magia.'
        );

        return;
      }

      const statIncreases:
        number[] =
        [];

      allocatedPoints
        .forEach(
          (
            points,
            index
          ) => {
            for (
              let i = 0;
              i < points;
              i++
            ) {
              statIncreases.push(
                index
              );
            }
          }
        );

      await onConfirmLevelUp(
        statIncreases,
        spellChoices
      );

      onClose();
    };

  const newProf =
    prof(
      newLevel
    );

  const newSlots =
    getSpellSlotsForClass(
      hero.className,
      newLevel
    );

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-5 select-none">
      <div className="relative w-full max-w-3xl h-[min(92dvh,900px)] min-h-0 bg-gradient-to-b from-[#181308] via-[#0f0c05] to-[#080602] border-2 border-amber-500/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-amber-500/30 px-4 sm:px-6 py-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
              Ascens?o de Poder ? SRD 5.2.1
            </span>

            <h2 className="font-serif font-black text-xl sm:text-2xl text-amber-100">
              {hero.name} ? N?vel {newLevel}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 scrollbar-thin">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-3">
              <span className="text-xs font-bold text-red-300 flex items-center gap-1">
                <Heart size={14} />
                Pontos de Vida
              </span>

              <strong className="block mt-1 text-red-100">
                +{avgHpGain} PV
              </strong>
            </div>

            <div className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-3">
              <span className="text-xs font-bold text-amber-300">
                Profici?ncia
              </span>

              <strong className="block mt-1 text-amber-100">
                {signed(newProf)}
              </strong>
            </div>

            <div className="rounded-2xl border border-purple-900/50 bg-purple-950/20 p-3">
              <span className="text-xs font-bold text-purple-300">
                Espa?os de Magia
              </span>

              <div className="mt-1 flex flex-wrap gap-1">
                {newSlots.map(
                  (
                    total,
                    index
                  ) =>
                    total > 0
                      ? (
                          <span
                            key={index}
                            className="text-[10px] font-mono text-purple-200"
                          >
                            C{index + 1}:{total}
                          </span>
                        )
                      : null
                )}
              </div>
            </div>
          </div>

          <LevelUpSpellSelectionPanel
            hero={hero}
            newLevel={newLevel}
            value={spellChoices}
            onChange={setSpellChoices}
          />

          {!spellValidation.ok && (
            <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-xs text-amber-200 leading-relaxed">
              {spellValidation.reason}
            </div>
          )}

          {hasAsi && (
            <section className="rounded-2xl border border-amber-600/50 bg-zinc-950/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-amber-200 flex items-center gap-1.5">
                  <Award size={15} />
                  Aumento de Atributo
                </span>

                <span className="text-xs font-mono text-yellow-300">
                  {pointsRemaining} restante(s)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {abilities.map(
                  (
                    ability,
                    index
                  ) => {
                    const added =
                      allocatedPoints[
                        index
                      ];

                    const finalValue =
                      hero.stats[
                        index
                      ] +
                      added;

                    return (
                      <div
                        key={ability}
                        className="rounded-xl border border-zinc-800 bg-black/30 p-2 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase">
                            {ability}
                          </span>

                          <strong className="block text-zinc-100">
                            {finalValue}{' '}
                            <small className="text-amber-400">
                              {signed(
                                mod(
                                  finalValue
                                )
                              )}
                            </small>
                          </strong>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={
                              () =>
                                handleRemovePoint(
                                  index
                                )
                            }
                            disabled={
                              added <= 0
                            }
                            className="w-6 h-6 rounded bg-zinc-800 disabled:opacity-30 flex items-center justify-center"
                          >
                            <Minus size={11} />
                          </button>

                          <span className="w-5 text-center text-xs text-amber-300">
                            +{added}
                          </span>

                          <button
                            onClick={
                              () =>
                                handleAddPoint(
                                  index
                                )
                            }
                            disabled={
                              pointsRemaining <= 0 ||
                              finalValue >= 20
                            }
                            className="w-6 h-6 rounded bg-amber-600 text-black disabled:opacity-30 flex items-center justify-center"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="shrink-0 border-t border-zinc-800 p-4">
          <button
            disabled={
              busy ||
              (
                hasAsi &&
                pointsRemaining >
                0
              ) ||
              !spellValidation.ok
            }
            onClick={handleConfirm}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 disabled:opacity-40 text-black font-black text-sm uppercase flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            Confirmar N?vel {newLevel}
          </button>
        </footer>
      </div>
    </div>
  );
}
