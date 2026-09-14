import {
  NextRequest,
  NextResponse
} from 'next/server';

import {
  getChatGPTUser
} from '@/app/chatgpt-auth';

import {
  database
} from '@/lib/room-db';

import {
  isOriginAllowed
} from '@/lib/auth-origin';

import {
  GM_PROMPT
} from '@/lib/gm-prompt';

import {
  readCompactWorldContext
} from '@/lib/sandbox-director';

import {
  NPC_DIALOGUE_SYSTEM,
  enrichNpcIdentity,
  buildNpcFallbackReply
} from '@/lib/npc-life';

import type {
  State
} from '@/lib/game-engine';

async function resolveAiKey(
  rawKey?: string
): Promise<string> {
  if (
    rawKey &&
    rawKey.trim()
  ) {
    return rawKey.trim();
  }

  for (
    const key of
    [
      'GROQ_API_KEY',
      'groq_api_key',
      'GROQ_KEY',
      'GEMINI_API_KEY'
    ]
  ) {
    const value =
      process.env[key];

    if (
      value &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return '';
}

function sanitizeConversation(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-14)
    .map(
      (entry: any) => ({
        role:
          entry?.role === 'npc'
            ? 'npc'
            : 'player',

        text:
          String(
            entry?.text ||
            ''
          ).slice(
            0,
            700
          )
      })
    )
    .filter(
      (entry) =>
        Boolean(
          entry.text.trim()
        )
    );
}

function parseModelJson(
  raw: string
): {
  reply: string;
  choices: string[];
  memory: string;
} | null {
  let text =
    String(raw || '')
      .replace(
        /<think>[\s\S]*?<\/think>/gi,
        ''
      )
      .trim();

  text =
    text
      .replace(
        /^\`\`\`(?:json)?/i,
        ''
      )
      .replace(
        /\`\`\`$/i,
        ''
      )
      .trim();

  const start =
    text.indexOf('{');

  const end =
    text.lastIndexOf('}');

  if (
    start < 0 ||
    end <= start
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        text.slice(
          start,
          end + 1
        )
      );

    const reply =
      String(
        parsed.reply ||
        ''
      ).trim();

    if (!reply) {
      return null;
    }

    return {
      reply:
        reply.slice(
          0,
          1800
        ),

      choices:
        Array.isArray(
          parsed.choices
        )
          ? parsed.choices
              .map(
                (choice: unknown) =>
                  String(choice)
                    .trim()
                    .slice(0, 180)
              )
              .filter(Boolean)
              .slice(0, 3)
          : [],

      memory:
        String(
          parsed.memory ||
          ''
        )
          .trim()
          .slice(
            0,
            320
          )
    };
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getChatGPTUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            'Entre para conversar com os NPCs.'
        },
        {
          status: 401
        }
      );
    }

    if (
      !isOriginAllowed(req)
    ) {
      return NextResponse.json(
        {
          error:
            'Origem invalida.'
        },
        {
          status: 403
        }
      );
    }

    const raw =
      await req.text();

    if (
      raw.length >
      30000
    ) {
      throw new Error(
        'Conversa muito longa.'
      );
    }

    const body =
      JSON.parse(raw);

    const roomId =
      String(
        body.room ||
        ''
      );

    const npcId =
      String(
        body.npcId ||
        ''
      );

    const playerText =
      String(
        body.text ||
        ''
      )
        .trim()
        .slice(
          0,
          1200
        );

    if (
      !roomId ||
      !npcId ||
      !playerText
    ) {
      throw new Error(
        'NPC, sala ou fala ausente.'
      );
    }

    const db =
      await database();

    let room =
      await db
        .prepare(
          'SELECT r.id,r.state,r.version FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?'
        )
        .bind(
          roomId,
          user.userId
        )
        .first<{
          id: string;
          state: string;
          version: number;
        }>();

    if (!room) {
      throw new Error(
        'Mesa nao encontrada.'
      );
    }

    const state: State =
      JSON.parse(
        room.state
      );

    const npc =
      state.npcs.find(
        (candidate) =>
          candidate.id ===
          npcId
      );

    if (!npc) {
      throw new Error(
        'NPC nao encontrado no mundo.'
      );
    }

    enrichNpcIdentity(
      npc,
      state
    );

    const hero =
      state.characters.find(
        (character) =>
          character.owner ===
          user.userId
      ) ||
      state.characters[0];

    const world =
      readCompactWorldContext(
        state,
        room.id,
        hero
      );

    const conversation =
      sanitizeConversation(
        body.conversation
      );

    const key =
      await resolveAiKey(
        typeof body.key ===
          'string'
          ? body.key
          : undefined
      );

    let result:
      | {
          reply: string;
          choices: string[];
          memory: string;
        }
      | null =
      null;

    if (key) {
      const payload = {
        npc: {
          nome:
            npc.name,
          especie:
            npc.species,
          papel:
            npc.role,
          descricao:
            npc.description,
          personalidade:
            npc.personality,
          historia:
            npc.history,
          objetivoAtual:
            npc.currentGoal,
          segredoPrivado:
            npc.secret,
          relacionamentos:
            npc.relationships,
          memorias:
            npc.memories
              ?.slice(-8)
              .map(
                (memory) =>
                  memory.summary
              ) ||
            []
        },

        jogador: hero
          ? {
              id:
                hero.id,
              nome:
                hero.name,
              classe:
                hero.className,
              nivel:
                hero.level,
              bioma:
                hero.biome ||
                state.biome
            }
          : null,

        mundo:
          world,

        campanha: {
          progresso:
            hero?.questProgress ||
            state.questProgress ||
            {},

          consequencias:
            hero?.worldFlags ||
            state.worldFlags ||
            {},

          economia:
            state.economyContext ||
            null
        },

        conversaAtual:
          conversation,

        falaDoJogador:
          playerText,

        acontecimentosRecentes:
          (state.logs || [])
            .slice(-10)
            .map(
              (log) =>
                log.text.slice(
                  0,
                  300
                )
            )
      };

      const system =
        GM_PROMPT +
        '\n\n' +
        NPC_DIALOGUE_SYSTEM;

      let rawAnswer = '';

      const isGroq =
        key.startsWith('gsk_') ||
        !key.startsWith('AIza');

      if (isGroq) {
        const models = [
          'openai/gpt-oss-20b',
          'qwen/qwen3.6-27b'
        ];

        for (
          const model of
          models
        ) {
          try {
            const response =
              await fetch(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                  method: 'POST',

                  headers: {
                    'Content-Type':
                      'application/json',

                    Authorization:
                      'Bearer ' +
                      key
                  },

                  body:
                    JSON.stringify({
                      model,

                      messages: [
                        {
                          role:
                            'system',
                          content:
                            system
                        },
                        {
                          role:
                            'user',
                          content:
                            JSON.stringify(
                              payload
                            )
                        }
                      ],

                      temperature:
                        0.88,

                      max_tokens:
                        650
                    }),

                  signal:
                    AbortSignal.timeout(
                      15000
                    )
                }
              );

            if (
              response.ok
            ) {
              const data: any =
                await response.json();

              rawAnswer =
                data
                  ?.choices
                  ?.[0]
                  ?.message
                  ?.content ||
                '';

              if (
                rawAnswer
              ) {
                break;
              }
            }
          } catch {}
        }
      } else {
        try {
          const response =
            await fetch(
              'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
              {
                method:
                  'POST',

                headers: {
                  'Content-Type':
                    'application/json',

                  'x-goog-api-key':
                    key
                },

                body:
                  JSON.stringify({
                    system_instruction: {
                      parts: [
                        {
                          text:
                            system
                        }
                      ]
                    },

                    contents: [
                      {
                        role:
                          'user',

                        parts: [
                          {
                            text:
                              JSON.stringify(
                                payload
                              )
                          }
                        ]
                      }
                    ],

                    generationConfig: {
                      maxOutputTokens:
                        900,

                      temperature:
                        0.85,

                      responseMimeType:
                        'application/json'
                    }
                  }),

                signal:
                  AbortSignal.timeout(
                    20000
                  )
              }
            );

          if (
            response.ok
          ) {
            const data: any =
              await response.json();

            rawAnswer =
              data
                ?.candidates
                ?.[0]
                ?.content
                ?.parts
                ?.map(
                  (part: any) =>
                    part.text ||
                    ''
                )
                .join(
                  '\n'
                ) ||
              '';
          }
        } catch {}
      }

      result =
        parseModelJson(
          rawAnswer
        );
    }

    if (!result) {
      const fallback =
        buildNpcFallbackReply(
          npc,
          playerText
        );

      result = {
        ...fallback,

        memory:
          (
            hero?.name ||
            'Um aventureiro'
          ) +
          ' falou sobre: ' +
          playerText.slice(
            0,
            180
          )
      };
    }

    if (
      result.choices.length <
      1
    ) {
      result.choices = [
        'O que mudou por aqui recentemente?',
        'Existe algo que eu deveria saber antes de seguir viagem?',
        'E voce? Como veio parar aqui?'
      ];
    }

    npc.memories = [
      ...(
        npc.memories ||
        []
      ),
      {
        timestamp:
          Date.now(),

        heroId:
          hero?.id,

        heroName:
          hero?.name,

        summary:
          (
            result.memory ||
            (
              playerText +
              ' / ' +
              result.reply
            )
          ).slice(
            0,
            320
          )
      }
    ].slice(-16);

    npc.lastInteractionAt =
      Date.now();

    /*
     * Persistencia otimista.
     * Em conflito de versao, a conversa ainda responde,
     * mas nunca sobrescreve uma acao mecanica mais nova.
     */
    // POLISH_B_NPC_MEMORY_RETRY
    const memoryWrite =
      await db
        .prepare(
          'UPDATE rooms SET state=?,version=version+1 WHERE id=? AND version=?'
        )
        .bind(
          JSON.stringify(
            state
          ),
          room.id,
          room.version
        )
        .run();

    if (
      !(
        memoryWrite?.meta?.changes ??
        memoryWrite?.changes ??
        0
      )
    ) {
      const fresh =
        await db
          .prepare(
            'SELECT state,version FROM rooms WHERE id=?'
          )
          .bind(
            room.id
          )
          .first<{
            state: string;
            version: number;
          }>();

      if (fresh) {
        const latestState:
          State =
          JSON.parse(
            fresh.state
          );

        const latestNpc =
          latestState.npcs.find(
            (candidate) =>
              candidate.id ===
              npc.id
          );

        if (latestNpc) {
          const memoryMap =
            new Map<
              string,
              any
            >();

          for (
            const memory of
            [
              ...(latestNpc.memories ||
                []),
              ...(npc.memories ||
                [])
            ]
          ) {
            const key =
              String(
                memory.timestamp ||
                0
              ) +
              '|' +
              String(
                memory.summary ||
                ''
              );

            memoryMap.set(
              key,
              memory
            );
          }

          latestNpc.memories =
            Array.from(
              memoryMap.values()
            )
              .sort(
                (left, right) =>
                  (
                    left.timestamp ||
                    0
                  ) -
                  (
                    right.timestamp ||
                    0
                  )
              )
              .slice(-16);

          latestNpc.lastInteractionAt =
            Math.max(
              latestNpc.lastInteractionAt ||
                0,
              npc.lastInteractionAt ||
                0
            );

          latestNpc.personality =
            npc.personality ||
            latestNpc.personality;

          latestNpc.history =
            npc.history ||
            latestNpc.history;

          latestNpc.currentGoal =
            npc.currentGoal ||
            latestNpc.currentGoal;

          latestNpc.secret =
            npc.secret ||
            latestNpc.secret;

          await db
            .prepare(
              'UPDATE rooms SET state=?,version=version+1 WHERE id=? AND version=?'
            )
            .bind(
              JSON.stringify(
                latestState
              ),
              room.id,
              fresh.version
            )
            .run();
        }
      }
    }

    return NextResponse.json({
      ok:
        true,

      answer:
        result.reply,

      choices:
        result.choices,

      npc: {
        id:
          npc.id,
        personality:
          npc.personality,
        currentGoal:
          npc.currentGoal
      }
    });
  } catch (error) {
    console.error(
      '[NPC Dialogue]',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel conversar com este NPC.'
      },
      {
        status: 400
      }
    );
  }
}
