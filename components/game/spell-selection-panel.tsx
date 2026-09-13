'use client';

import React, {
  useMemo,
  useState
} from 'react';

import {
  BookOpen,
  Check,
  Search,
  Sparkles,
  Lock
} from 'lucide-react';

import {
  findSrdSpell,
  getInitialSpellSelectionRules,
  getLevelUpSpellRequirements,
  getMaxSpellLevelForClass,
  getSpellDisplayName,
  getSpellRangeSquares,
  getSrdSpellsForClass,
  type LevelUpSpellChoices,
  type SpellCharacterLike
} from '@/lib/srd-spellbook';

function SpellCard({
  name,
  selected,
  disabled,
  onToggle
}: {
  name: string;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const spell =
    findSrdSpell(
      name
    );

  if (!spell) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={
        'text-left rounded-xl border p-3 transition-all min-w-0 ' +
        (
          selected
            ? 'border-purple-400 bg-purple-950/35 text-purple-100'
            : disabled
              ? 'border-zinc-900 bg-black/20 text-zinc-600 cursor-not-allowed'
              : 'border-zinc-800 bg-zinc-900/60 hover:border-purple-700 text-zinc-200'
        )
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="text-xs whitespace-normal break-words">
            {getSpellDisplayName(spell.name)}
          </strong>

          <div className="text-[9px] font-mono uppercase text-zinc-500 mt-0.5">
            {spell.level === 0
              ? 'Truque'
              : 'C?rculo ' + spell.level}
            {' ? '}
            {spell.school}
            {' ? '}
            {spell.range || '?'}
          </div>
        </div>

        {selected && (
          <Check
            size={14}
            className="shrink-0 text-purple-300"
          />
        )}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed whitespace-normal break-words text-zinc-400">
        {spell.description}
      </p>

      <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-mono">
        {spell.concentration && (
          <span className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-300">
            Concentra??o
          </span>
        )}

        {spell.ritual && (
          <span className="px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/50 text-cyan-300">
            Ritual
          </span>
        )}

        <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
          {getSpellRangeSquares(spell)}q
        </span>
      </div>
    </button>
  );
}

function SelectionSection({
  title,
  subtitle,
  spells,
  selected,
  max,
  onChange
}: {
  title: string;
  subtitle: string;
  spells: string[];
  selected: string[];
  max: number;
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] =
    useState('');

  const filtered =
    useMemo(
      () => {
        const q =
          search
            .trim()
            .toLowerCase();

        if (!q) {
          return spells;
        }

        return spells.filter(
          (name) => {
            const spell =
              findSrdSpell(
                name
              );

            return (
              name
                .toLowerCase()
                .includes(q) ||
              spell?.school
                ?.toLowerCase()
                .includes(q) ||
              spell?.description
                ?.toLowerCase()
                .includes(q)
            );
          }
        );
      },
      [
        spells,
        search
      ]
    );

  const toggle =
    (
      name: string
    ) => {
      if (
        selected.includes(
          name
        )
      ) {
        onChange(
          selected.filter(
            (value) =>
              value !== name
          )
        );

        return;
      }

      if (
        selected.length >=
        max
      ) {
        return;
      }

      onChange([
        ...selected,
        name
      ]);
    };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-black/20 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-purple-200 flex items-center gap-1.5">
            <Sparkles size={14} />
            {title}
          </h4>

          <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">
            {subtitle}
          </p>
        </div>

        <span
          className={
            'px-2 py-1 rounded-lg text-[10px] font-mono border ' +
            (
              selected.length ===
                max
                ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300'
                : 'border-purple-800/50 bg-purple-950/30 text-purple-300'
            )
          }
        >
          {selected.length}/{max}
        </span>
      </div>

      {spells.length > 8 && (
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-2.5 text-zinc-500"
          />

          <input
            value={search}
            onChange={
              (event) =>
                setSearch(
                  event.target.value
                )
            }
            placeholder="Pesquisar magia..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-8 pr-3 py-2 text-xs text-zinc-200 outline-none focus:border-purple-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[38dvh] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
        {filtered.map(
          (name) => (
            <SpellCard
              key={name}
              name={name}
              selected={
                selected.includes(
                  name
                )
              }
              disabled={
                !selected.includes(
                  name
                ) &&
                selected.length >=
                  max
              }
              onToggle={
                () =>
                  toggle(
                    name
                  )
              }
            />
          )
        )}
      </div>
    </section>
  );
}

export function SpellSelectionPanel({
  className,
  selectedCantrips,
  selectedPrepared,
  selectedSpellbook,
  onCantripsChange,
  onPreparedChange,
  onSpellbookChange
}: {
  className: string;
  selectedCantrips: string[];
  selectedPrepared: string[];
  selectedSpellbook: string[];
  onCantripsChange: (value: string[]) => void;
  onPreparedChange: (value: string[]) => void;
  onSpellbookChange: (value: string[]) => void;
}) {
  const rules =
    getInitialSpellSelectionRules(
      className
    );

  const cantrips =
    getSrdSpellsForClass(
      className,
      0
    )
      .map(
        (spell) =>
          spell.name
      );

  const levelOne =
    getSrdSpellsForClass(
      className,
      1
    )
      .map(
        (spell) =>
          spell.name
      );

  if (
    rules.cantrips === 0 &&
    rules.prepared === 0 &&
    rules.spellbook === 0
  ) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
        <BookOpen
          className="mx-auto text-zinc-600 mb-2"
          size={24}
        />

        <h3 className="font-bold text-zinc-300">
          Esta classe n?o possui Conjura??o no n?vel 1
        </h3>

        <p className="text-xs text-zinc-500 mt-1">
          Nenhuma magia precisa ser selecionada.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-purple-800/50 bg-purple-950/20 p-3">
        <h3 className="font-serif font-bold text-purple-200 flex items-center gap-2">
          <BookOpen size={17} />
          Conjura??o ? N?vel 1
        </h3>

        <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
          Escolha somente o n?mero permitido pela sua classe. Essas escolhas ser?o gravadas na ficha e a HUD n?o mostrar? automaticamente todas as magias da classe.
        </p>
      </div>

      {rules.cantrips > 0 && (
        <SelectionSection
          title="Truques"
          subtitle="Magias de n?vel 0 conhecidas pelo personagem."
          spells={cantrips}
          selected={selectedCantrips}
          max={rules.cantrips}
          onChange={onCantripsChange}
        />
      )}

      {className === 'Mago' ? (
        <>
          <SelectionSection
            title="Grim?rio Inicial"
            subtitle="O Mago inicia com seis magias de n?vel 1 escritas no grim?rio."
            spells={levelOne}
            selected={selectedSpellbook}
            max={6}
            onChange={
              (next) => {
                onSpellbookChange(
                  next
                );

                onPreparedChange(
                  selectedPrepared.filter(
                    (name) =>
                      next.includes(
                        name
                      )
                  )
                );
              }
            }
          />

          <SelectionSection
            title="Magias Preparadas"
            subtitle="Escolha quatro entre as seis magias presentes no seu grim?rio."
            spells={selectedSpellbook}
            selected={selectedPrepared}
            max={4}
            onChange={onPreparedChange}
          />
        </>
      ) : (
        rules.prepared > 0 && (
          <SelectionSection
            title="Magias Preparadas"
            subtitle="Magias de n?vel 1 dispon?veis para conjura??o."
            spells={levelOne}
            selected={selectedPrepared}
            max={rules.prepared}
            onChange={onPreparedChange}
          />
        )
      )}
    </div>
  );
}

export function LevelUpSpellSelectionPanel({
  hero,
  newLevel,
  value,
  onChange
}: {
  hero: SpellCharacterLike;
  newLevel: number;
  value: LevelUpSpellChoices;
  onChange: (value: LevelUpSpellChoices) => void;
}) {
  const requirements =
    getLevelUpSpellRequirements(
      hero.className,
      hero.level,
      newLevel
    );

  const maxSpellLevel =
    getMaxSpellLevelForClass(
      hero.className,
      newLevel
    );

  const knownCantrips =
    new Set(
      hero.knownCantrips ||
      []
    );

  const knownPrepared =
    new Set(
      hero.preparedSpells ||
      []
    );

  const knownBook =
    new Set(
      hero.spellbook ||
      []
    );

  const cantripChoices =
    getSrdSpellsForClass(
      hero.className,
      0
    )
      .map(
        (spell) =>
          spell.name
      )
      .filter(
        (name) =>
          !knownCantrips.has(
            name
          )
      );

  const levelChoices =
    getSrdSpellsForClass(
      hero.className
    )
      .filter(
        (spell) =>
          spell.level >= 1 &&
          spell.level <=
            maxSpellLevel
      )
      .map(
        (spell) =>
          spell.name
      );

  const newBookSet =
    new Set([
      ...(
        hero.spellbook ||
        []
      ),
      ...value.newSpellbook
    ]);

  const preparedChoices =
    hero.className ===
      'Mago'
      ? [
          ...newBookSet
        ].filter(
          (name) =>
            !knownPrepared.has(
              name
            )
        )
      : levelChoices.filter(
          (name) =>
            !knownPrepared.has(
              name
            )
        );

  const spellbookChoices =
    levelChoices.filter(
      (name) =>
        !knownBook.has(
          name
        )
    );

  if (
    requirements.cantrips === 0 &&
    requirements.prepared === 0 &&
    requirements.spellbook === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-purple-700/50 bg-purple-950/25 p-3">
        <h3 className="font-bold text-purple-200 text-sm">
          Desenvolvimento M?gico
        </h3>

        <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
          Seu novo n?vel amplia as escolhas de magia conforme a tabela oficial da classe.
        </p>
      </div>

      {requirements.spellbook > 0 && (
        <SelectionSection
          title="Novas Magias do Grim?rio"
          subtitle="A pesquisa de um novo n?vel de Mago adiciona duas magias eleg?veis ao grim?rio."
          spells={spellbookChoices}
          selected={value.newSpellbook}
          max={requirements.spellbook}
          onChange={
            (next) =>
              onChange({
                ...value,
                newSpellbook:
                  next,

                newPrepared:
                  value
                    .newPrepared
                    .filter(
                      (name) =>
                        (
                          hero.spellbook ||
                          []
                        ).includes(
                          name
                        ) ||
                        next.includes(
                          name
                        )
                    )
              })
          }
        />
      )}

      {requirements.cantrips > 0 && (
        <SelectionSection
          title="Novo Truque"
          subtitle="Escolha o novo truque liberado pelo n?vel."
          spells={cantripChoices}
          selected={value.newCantrips}
          max={requirements.cantrips}
          onChange={
            (next) =>
              onChange({
                ...value,
                newCantrips:
                  next
              })
          }
        />
      )}

      {requirements.prepared > 0 && (
        <SelectionSection
          title="Novas Magias Preparadas"
          subtitle="Escolha novas magias at? atingir o limite liberado neste n?vel."
          spells={preparedChoices}
          selected={value.newPrepared}
          max={requirements.prepared}
          onChange={
            (next) =>
              onChange({
                ...value,
                newPrepared:
                  next
              })
          }
        />
      )}
    </div>
  );
}
