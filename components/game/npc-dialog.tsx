'use client';

import React, {
  useEffect,
  useRef,
  useState
} from 'react';

import {
  X,
  ChevronRight,
  Send,
  Sparkles
} from 'lucide-react';

export type NpcDialogOption = {
  label: string;
  actionText: string;
};

export type NpcDialogTurn = {
  role: 'player' | 'npc';
  text: string;
};

export type NpcDialogReply = {
  reply: string;
  options?: NpcDialogOption[];
};

export type NpcDialogData = {
  id: string;
  name: string;
  role: string;
  avatarText?: string;
  dialogText: string;
  options: NpcDialogOption[];
  species?: string;
  personality?: string;
  currentGoal?: string;
};

interface NpcDialogProps {
  npc: NpcDialogData | null;

  onSelectOption: (
    actionText: string,
    conversation: NpcDialogTurn[]
  ) =>
    | Promise<NpcDialogReply | void>
    | NpcDialogReply
    | void;

  onClose: () => void;
}

export function NpcDialog({
  npc,
  onSelectOption,
  onClose
}: NpcDialogProps) {
  const [
    turns,
    setTurns
  ] =
    useState<NpcDialogTurn[]>(
      []
    );

  const [
    options,
    setOptions
  ] =
    useState<NpcDialogOption[]>(
      []
    );

  const [
    freeText,
    setFreeText
  ] =
    useState('');

  const [
    waiting,
    setWaiting
  ] =
    useState(false);

  const bottomRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /*
   * Reinicia apenas ao TROCAR de NPC.
   * Novas respostas nunca fecham nem recriam a janela.
   */
  useEffect(
    () => {
      if (!npc) {
        setTurns([]);
        setOptions([]);
        return;
      }

      setTurns([
        {
          role:
            'npc',

          text:
            npc.dialogText
        }
      ]);

      setOptions(
        npc.options ||
        []
      );

      setFreeText('');
    },
    [npc?.id]
  );

  useEffect(
    () => {
      bottomRef.current
        ?.scrollIntoView({
          behavior:
            'smooth'
        });
    },
    [
      turns,
      waiting
    ]
  );

  if (!npc) {
    return null;
  }

  const sendTurn =
    async (
      text: string
    ) => {
      const clean =
        text.trim();

      if (
        !clean ||
        waiting
      ) {
        return;
      }

      const nextTurns:
        NpcDialogTurn[] = [
          ...turns,
          {
            role:
              'player',

            text:
              clean
          }
        ];

      setTurns(
        nextTurns
      );

      setFreeText('');
      setWaiting(true);

      try {
        const result =
          await onSelectOption(
            clean,
            nextTurns
          );

        if (
          result?.reply
        ) {
          setTurns(
            (previous) => [
              ...previous,
              {
                role:
                  'npc',

                text:
                  result.reply
              }
            ]
          );

          if (
            result.options &&
            result.options.length >
              0
          ) {
            setOptions(
              result.options
            );
          }
        }
      } catch (error) {
        console.error(
          '[NpcDialog]',
          error
        );

        setTurns(
          (previous) => [
            ...previous,
            {
              role:
                'npc',

              text:
                'Um instante... perdi o fio da conversa. Pode repetir isso de outra forma?'
            }
          ]
        );
      } finally {
        setWaiting(false);
      }
    };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6 animate-fade-in"
    >
      <div
        className="relative w-full max-w-3xl max-h-[88dvh] bg-gradient-to-t from-zinc-950 via-zinc-950/98 to-zinc-900 border-2 border-amber-900/70 rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col"
      >
        <button
          onClick={
            onClose
          }
          className="absolute top-4 right-4 z-20 p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
          title="Encerrar conversa"
        >
          <X size={18} />
        </button>

        <div
          className="p-4 sm:p-5 border-b border-amber-900/40 bg-gradient-to-r from-amber-950/20 via-transparent to-transparent"
        >
          <div
            className="flex items-center gap-3.5 pr-10"
          >
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-700 via-amber-950 to-black border-2 border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.2)] flex items-center justify-center font-serif text-2xl font-black text-amber-200 shrink-0"
            >
              {
                npc.avatarText ||
                npc.name[0]
              }
            </div>

            <div
              className="min-w-0"
            >
              <span
                className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90 font-bold block"
              >
                {npc.role}
              </span>

              <h3
                className="text-lg sm:text-xl font-black text-zinc-100 font-serif tracking-wide truncate"
              >
                {npc.name}
              </h3>

              <div
                className="flex flex-wrap gap-1.5 mt-1"
              >
                {npc.species && (
                  <span
                    className="px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-[9px] text-zinc-400"
                  >
                    {npc.species}
                  </span>
                )}

                {npc.currentGoal && (
                  <span
                    className="px-1.5 py-0.5 rounded-md bg-amber-950/30 border border-amber-900/50 text-[9px] text-amber-300"
                    title={
                      npc.currentGoal
                    }
                  >
                    vida persistente
                  </span>
                )}
              </div>
            </div>
          </div>

          {npc.personality && (
            <p
              className="mt-2 text-[10px] text-zinc-500 italic line-clamp-1"
            >
              {npc.personality}
            </p>
          )}
        </div>

        <div
          className="flex-1 min-h-[180px] overflow-y-auto p-4 sm:p-5 space-y-3 bg-[radial-gradient(circle_at_top,rgba(120,80,20,0.08),transparent_45%)]"
        >
          {turns.map(
            (
              turn,
              index
            ) => (
              <div
                key={
                  index
                }
                className={
                  turn.role ===
                  'npc'
                    ? 'flex justify-start'
                    : 'flex justify-end'
                }
              >
                <div
                  className={
                    turn.role ===
                    'npc'
                      ? 'max-w-[88%] rounded-2xl rounded-tl-sm border border-zinc-800 bg-black/55 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-200 font-serif shadow-lg'
                      : 'max-w-[82%] rounded-2xl rounded-tr-sm border border-amber-700/40 bg-amber-950/35 px-3.5 py-2.5 text-sm leading-relaxed text-amber-100'
                  }
                >
                  {turn.text}
                </div>
              </div>
            )
          )}

          {waiting && (
            <div
              className="flex justify-start"
            >
              <div
                className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-zinc-800 bg-black/55 px-3 py-2 text-xs text-amber-300"
              >
                <Sparkles
                  size={13}
                  className="animate-spin"
                />

                <span>
                  {
                    npc.name
                  } pensa...
                </span>
              </div>
            </div>
          )}

          <div
            ref={
              bottomRef
            }
          />
        </div>

        <div
          className="border-t border-zinc-800 bg-zinc-950/98 p-3 sm:p-4"
        >
          {options.length > 0 && (
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mb-3"
            >
              {options.map(
                (
                  option,
                  index
                ) => (
                  <button
                    key={
                      option.actionText +
                      index
                    }
                    disabled={
                      waiting
                    }
                    onClick={
                      () =>
                        void sendTurn(
                          option.actionText
                        )
                    }
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-900/80 hover:bg-amber-950/40 border border-zinc-800 hover:border-amber-500/60 text-zinc-300 hover:text-amber-200 text-[11px] text-left transition-all disabled:opacity-50"
                  >
                    <span>
                      {
                        option.label
                      }
                    </span>

                    <ChevronRight
                      size={14}
                      className="text-amber-500 shrink-0"
                    />
                  </button>
                )
              )}
            </div>
          )}

          <form
            onSubmit={
              (event) => {
                event.preventDefault();

                void sendTurn(
                  freeText
                );
              }
            }
            className="flex items-center gap-2"
          >
            <input
              value={
                freeText
              }
              onChange={
                (event) =>
                  setFreeText(
                    event.target.value
                  )
              }
              disabled={
                waiting
              }
              maxLength={
                800
              }
              placeholder={
                'Fale livremente com ' +
                npc.name +
                '...'
              }
              className="flex-1 min-w-0 rounded-xl bg-black/70 border border-zinc-700 focus:border-amber-500 px-3 py-2.5 text-sm text-zinc-100 outline-none"
            />

            <button
              type="submit"
              disabled={
                waiting ||
                !freeText.trim()
              }
              className="h-10 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-black flex items-center gap-1.5 disabled:opacity-40"
            >
              <Send
                size={15}
              />
              <span
                className="hidden sm:inline"
              >
                Falar
              </span>
            </button>
          </form>

          <div
            className="mt-2 text-center text-[9px] uppercase tracking-wider text-zinc-600"
          >
            A conversa continua nesta janela ate voce fecha-la
          </div>
        </div>
      </div>
    </div>
  );
}
