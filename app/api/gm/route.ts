import { NextRequest, NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/lib/room-db';
import { isOriginAllowed } from '@/lib/auth-origin';
import { GM_PROMPT } from '@/lib/gm-prompt';
import pages from '@/lib/srd.json';
import { entry, type State } from '@/lib/game-engine';
import { mergeStates } from '@/lib/state-merge';
import { readCompactWorldContext, executeDirectorIntent } from '@/lib/sandbox-director';
import { generateProceduralItem, type ItemTier } from '@/lib/procedural-items';
import { MICRO_ADVENTURES } from '@/lib/micro-adventures';
import {
  GM_CONTROLLED_TOOLS,
  executeServerAuthoritativeGmTool,
  type ToolExecutionResult
} from '@/lib/gm-tools';


async function resolveGroqKey(rawKey?: string): Promise<string> {
  if (rawKey && rawKey.trim()) return rawKey.trim();

  // 1. Process environment variables
  for (const envKey of ['GROQ_API_KEY', 'groq_api_key', 'GROQ_KEY']) {
    const val = process.env[envKey];
    if (val && typeof val === 'string' && val.trim()) return val.trim();
  }

  // 2. Cloudflare Workers module environment removed for Node.js deployment

  // 3. globalThis runtime environment
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as any;
    const gVal = g.env?.GROQ_API_KEY || g.GROQ_API_KEY || g.process?.env?.GROQ_API_KEY;
    if (gVal && typeof gVal === 'string' && gVal.trim()) return gVal.trim();
  }

  return '';
}

export async function POST(req: NextRequest) {
  try {
    const user = await getChatGPTUser();
    if (!user) return NextResponse.json({ error: 'Entre para conversar com a GM.' }, { status: 401 });
    if (!isOriginAllowed(req)) {
      return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
    }
    const raw = await req.text();
    if (raw.length > 25000) throw Error('Mensagem muito longa.');
    const a = JSON.parse(raw);

    const rawKey = typeof a.key === 'string' ? a.key.trim() : '';
    const userKey = await resolveGroqKey(rawKey);

    const text = String(a.text || '').trim().slice(0, 4000);
    if (!text && !a.actionContext) throw Error('Escreva uma ação ou realize uma jogada.');

    const db = await database();
    let room = await db
      .prepare('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?')
      .bind(a.room, user.userId)
      .first<{ id: string; state: string; version: number }>();

    if (!room && a.room) {
      const existing = await db.prepare('SELECT id, state, version FROM rooms WHERE id=?').bind(a.room).first<{ id: string; state: string; version: number }>();
      if (existing) {
        await db.prepare('INSERT OR IGNORE INTO members(room,user) VALUES(?,?)').bind(a.room, user.userId).run();
        room = existing;
      }
    }
    if (!room) {
      room = await db.prepare('SELECT r.id, r.state, r.version FROM rooms r JOIN members m ON m.room=r.id WHERE m.user=? ORDER BY r.rowid DESC').bind(user.userId).first<{ id: string; state: string; version: number }>();
    }
    if (!room) throw Error('Mesa não encontrada.');

    if (!userKey) {
      console.warn(
        '[GM] No GROQ_API_KEY found, providing narrative fallback.'
      );

      const latestRoom =
        await db
          .prepare(
            'SELECT state, version FROM rooms WHERE id=?'
          )
          .bind(room.id)
          .first<{ state: string; version: number }>() ||
        room;

      const fallbackState: State =
        JSON.parse(latestRoom.state);

      let fallbackNarrative = '';

      if (a.actionContext) {
        fallbackNarrative =
          'A cena absorve o impacto do que acabou de acontecer. ' +
          String(a.actionContext) +
          ' O ambiente reage ao resultado j? determinado pela engine, enquanto a tens?o permanece presente.';
      } else if (text) {
        fallbackNarrative =
          'Suas palavras e a??es passam a fazer parte da cena. "' +
          text +
          '" Pessoas, sons e pequenos sinais ao redor respondem de forma coerente com o lugar e com os acontecimentos recentes.';
      } else {
        fallbackNarrative =
          'Valdoria continua viva ao redor dos aventureiros. Rotinas seguem, rumores circulam e acontecimentos distantes avan?am mesmo fora de vista.';
      }

      if (text) {
        fallbackState.logs.push(
          entry(text, 'player')
        );
      }

      fallbackState.logs.push(
        entry(fallbackNarrative, 'gm')
      );

      fallbackState.logs =
        fallbackState.logs.slice(-200);

      await db
        .prepare(
          'UPDATE rooms SET state=?,version=version+1 WHERE id=?'
        )
        .bind(
          JSON.stringify(fallbackState),
          room.id
        )
        .run();

      return NextResponse.json({
        ok: true,
        answer: fallbackNarrative,
        choices: [],
        executedTools: [],
        searchHtml: ''
      });
    }

    const isGroq = userKey.startsWith('gsk_') || a.provider === 'groq' || !userKey.startsWith('AIza');

    const state: State = JSON.parse(room.state);

    const actorHero =
      state.characters.find(
        (hero) =>
          hero.owner === user.userId
      ) ||
      state.characters.find(
        (hero) => hero.hp > 0
      ) ||
      state.characters[0];

    const directorContext =
      readCompactWorldContext(
        state,
        room.id,
        actorHero
      );

    const recentHistory =
      (state.logs || [])
        .slice(-12)
        .map((log) => ({
          tipo: log.kind,
          texto: log.text.slice(0, 500)
        }));

    const queryText = text || a.actionContext || '';
    const words = queryText
      .toLowerCase()
      .split(/\W+/)
      .filter((x: string) => x.length > 3);
    const topMatch = pages
      .filter((p) => p.page > 4)
      .map((p) => ({
        page: p.page,
        text: p.text,
        score: words.reduce((n: number, w: string) => n + (p.text.toLowerCase().includes(w) ? 1 : 0), 0)
      }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    const relevant = topMatch ? `SRD p.${topMatch.page}: ${topMatch.text.slice(0, 250)}...` : '';

    let answer = '';
    let sources: { title: string; url: string }[] = [];
    let searchHtml = '';
    const rawToolCalls: { name: string; args: Record<string, any> }[] = [];

    // Optional direct structured tool call from test or client
    if (a.testToolCall && typeof a.testToolCall.name === 'string') {
      rawToolCalls.push({
        name: a.testToolCall.name,
        args: a.testToolCall.args || {}
      });
    }

    if (isGroq) {
      const groqSystemPrompt =
        GM_PROMPT +
        '\n\nVoc? est? operando com ferramentas de INTEN??O.' +
        '\nA engine decide todos os n?meros e resultados mec?nicos.' +
        '\nDurante combate, nenhuma ferramenta de dire??o de mundo fica dispon?vel.' +
        '\nN?o gere menus [1], [2], [3] e n?o sugira comandos mec?nicos da interface.';

      const promptPayload = {
        idiomaPadrao: 'pt-BR',

        contextoDaEngine:
          a.actionContext ||
          undefined,

        mensagemDoJogador:
          text ||
          undefined,

        referenciaSRD:
          relevant ||
          undefined,

        jogador: actorHero
          ? {
              nome: actorHero.name,
              classe: actorHero.className,
              nivel: actorHero.level,
              bioma:
                actorHero.biome ||
                state.biome,
              local:
                actorHero.location ??
                state.location,
              grupo:
                actorHero.partyId ||
                null
            }
          : null,

        mundo:
          directorContext,

        campanha: {
          microaventuraAtiva:
            state.activeMicroAdventureId ||
            null,

          progresso:
            actorHero?.questProgress ||
            state.questProgress ||
            {},

          consequencias:
            actorHero?.worldFlags ||
            state.worldFlags ||
            {},

          economia:
            state.economyContext ||
            null
        },

        combate: {
          ativo:
            state.combat,

          rodada:
            state.round,

          herois:
            state.characters.map(
              (hero) => ({
                nome: hero.name,
                hp: hero.hp,
                maxHp: hero.maxHp,
                nivel: hero.level,
                bioma:
                  hero.biome ||
                  state.biome
              })
            ),

          inimigosVisiveis:
            state.enemies
              .filter(
                (enemy) =>
                  enemy.hp > 0
              )
              .map(
                (enemy) => ({
                  nome: enemy.name,
                  bioma:
                    enemy.biome ||
                    state.biome
                })
              )
        },

        memoriaRecente:
          recentHistory
      };

      const candidateModels = ['openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-120b'];
      for (const model of candidateModels) {
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userKey}`
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: groqSystemPrompt },
                { role: 'user', content: JSON.stringify(promptPayload) }
              ],
              tools:
                state.combat
                  ? undefined
                  : GM_CONTROLLED_TOOLS,

              tool_choice:
                state.combat
                  ? undefined
                  : 'auto',
              temperature: 0.78,
              max_tokens: 700
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (response.ok) {
            const groqData = (await response.json()) as {
              choices?: {
                message?: {
                  content?: string;
                  tool_calls?: { function?: { name?: string; arguments?: string } }[];
                };
              }[];
            };
            const msg = groqData.choices?.[0]?.message;
            let rawContent = msg?.content || '';
            if (rawContent.includes('</think>')) {
              rawContent = rawContent.split('</think>').pop() || '';
            } else if (rawContent.includes('<think>')) {
              rawContent = rawContent.replace(/<think>[\s\S]*$/gi, '');
            }
            answer = rawContent.trim();

            // Extract OpenAI-compatible tool calls
            if (msg?.tool_calls && Array.isArray(msg.tool_calls)) {
              for (const tc of msg.tool_calls) {
                if (tc.function?.name) {
                  try {
                    const parsedArgs = JSON.parse(tc.function.arguments || '{}');
                    rawToolCalls.push({ name: tc.function.name, args: parsedArgs });
                  } catch {}
                }
              }
            }

            // Fallback parser for markdown JSON tool calls in text
            const jsonToolRegex = /```(?:json|tool)?\s*\{\s*"tool":\s*"([a-zA-Z0-9_]+)"\s*,\s*"args":\s*(\{[\s\S]*?\})\s*\}\s*```/g;
            let match;
            while ((match = jsonToolRegex.exec(rawContent)) !== null) {
              try {
                const tName = match[1];
                const tArgs = JSON.parse(match[2]);
                rawToolCalls.push({ name: tName, args: tArgs });
              } catch {}
            }

            if (answer && answer.length > 20) break;
          }
        } catch {
          // Cascade next model
        }
      }

      // Fallback narrativo caso os modelos Groq n?o retornem texto.
      if (!answer) {
        if (a.actionContext) {
          answer =
            'O resultado da a??o reverbera pela cena. ' +
            String(a.actionContext) +
            ' O ambiente responde ao acontecimento sem alterar qualquer resultado determinado pela engine.';
        } else if (text) {
          answer =
            'A inten??o de "' +
            text +
            '" passa a fazer parte da cena. O mundo reage de forma coerente com o local e com os acontecimentos recentes.';
        } else {
          answer =
            'O mundo continua em movimento. H? rotinas, rumores e mudan?as discretas acontecendo al?m do alcance imediato dos aventureiros.';
        }
      }

    } else {
      // Gemini Fallback
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': userKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: GM_PROMPT }] },
            contents: [
              {
                role: 'user',
                parts: [{ text: JSON.stringify(promptPayload) }]
              }
            ],
            tools: a.search ? [{ google_search: {} }] : undefined,
            generationConfig: { maxOutputTokens: 1500, temperature: 0.75 }
          }),
          signal: AbortSignal.timeout(30000)
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: {
            content?: { parts?: { text?: string }[] };
            groundingMetadata?: {
              groundingChunks?: { web?: { uri?: string; title?: string } }[];
              searchEntryPoint?: { renderedContent?: string };
            };
          }[];
        };
        const candidate = data.candidates?.[0];
        answer = candidate?.content?.parts?.map((x) => x.text || '').join('\n') || '';
        sources =
          candidate?.groundingMetadata?.groundingChunks?.flatMap((x) =>
            x.web?.uri && /^https:\/\//.test(x.web.uri) ? [{ title: x.web.title || 'Fonte', url: x.web.uri }] : []
          ) || [];
        searchHtml = candidate?.groundingMetadata?.searchEntryPoint?.renderedContent || '';
      }
    }

    if (!answer) throw Error('A IA não retornou resposta. Tente novamente.');

    // A GM n?o produz menus de a??es. A interface/engine cuida da jogabilidade.
    answer = answer
      .replace(
        /(?:^|\n)\s*(?:\[\d+\]|\d+[\.\)])\s*[^\n\r]+/g,
        ''
      )
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!answer) {
      answer =
        'A cena permanece aberta ?s decis?es dos aventureiros.';
    }

    const choices: string[] = [];

    // Always fetch the freshest room state right before appending logs and executing tools
    const latestRoom = await db
      .prepare('SELECT state, version FROM rooms WHERE id=?')
      .bind(room.id)
      .first<{ state: string; version: number }>();

    const executedTools: ToolExecutionResult[] = [];

    if (latestRoom) {
      const latestState: State = JSON.parse(latestRoom.state);

      // Execute only safe narrative intentions on the freshest state.
      const latestActorHero =
        latestState.characters.find(
          (hero) =>
            hero.owner === user.userId
        ) ||
        latestState.characters.find(
          (hero) => hero.hp > 0
        ) ||
        latestState.characters[0];

      const safeDirectorTools =
        new Set([
          'request_creature_spawn',
          'request_temporary_npc',
          'request_loot',
          'request_environmental_event',
          'request_microadventure',
          'influence_economy',
          'adjust_ecosystem'
        ]);

      for (const call of rawToolCalls) {
        if (!safeDirectorTools.has(call.name)) {
          executedTools.push({
            tool: call.name,
            success: false,
            message:
              'Inten??o rejeitada: a GM n?o possui autoridade para executar essa opera??o.'
          });
          continue;
        }

        if (latestState.combat) {
          executedTools.push({
            tool: call.name,
            success: false,
            message:
              'Dire??o de mundo pausada durante combate. A engine de combate permanece soberana.'
          });
          continue;
        }

        if (!latestActorHero) {
          executedTools.push({
            tool: call.name,
            success: false,
            message:
              'Nenhum personagem ativo dispon?vel para contextualizar esta inten??o.'
          });
          continue;
        }

        if (call.name === 'request_creature_spawn') {
          const threat =
            String(
              call.args.threat ||
              'moderada'
            );

          const requestedTier =
            threat === 'alta' ||
            threat === 'chefe'
              ? 3
              : threat === 'moderada'
                ? 2
                : 1;

          const maxTier =
            latestActorHero.level >= 8
              ? 3
              : latestActorHero.level >= 4
                ? 2
                : 1;

          const finalTier =
            Math.min(
              requestedTier,
              maxTier
            ) as ItemTier;

          const requestedCount =
            Math.max(
              1,
              Math.min(
                3,
                Math.trunc(
                  Number(call.args.count) || 1
                )
              )
            );

          const count =
            threat === 'chefe'
              ? 1
              : requestedCount;

          let created = 0;
          const messages: string[] = [];

          for (let i = 0; i < count; i++) {
            const existingIds =
              new Set(
                latestState.enemies.map(
                  (enemy) => enemy.id
                )
              );

            const decision =
              executeDirectorIntent(
                'request_creature_spawn',
                {
                  creatureName:
                    String(
                      call.args.creatureName ||
                      'Criatura das Cinzas'
                    ).slice(0, 40),

                  tier:
                    finalTier,

                  reason:
                    String(
                      call.args.reason ||
                      'Evolu??o org?nica do mundo.'
                    ).slice(0, 200)
                },
                latestState,
              room.id,
              latestActorHero
            );

            if (
              decision.validation.approved
            ) {
              created++;

              const spawned =
                [...latestState.enemies]
                  .reverse()
                  .find(
                    (enemy) =>
                      !existingIds.has(
                        enemy.id
                      )
                  );

              if (spawned) {
                spawned.biome =
                  latestActorHero.biome ||
                  latestState.biome ||
                  'forest';

                if (
                  latestActorHero.partyId
                ) {
                  spawned.partyId =
                    latestActorHero.partyId;

                  spawned.ownerCharId =
                    undefined;
                } else {
                  spawned.ownerCharId =
                    latestActorHero.id;

                  spawned.partyId =
                    undefined;
                }

                spawned.x =
                  Math.max(
                    0,
                    Math.min(
                      15,
                      latestActorHero.x +
                        3 +
                        (i % 2)
                    )
                  );

                spawned.y =
                  Math.max(
                    0,
                    Math.min(
                      15,
                      latestActorHero.y +
                        2 +
                        Math.floor(i / 2)
                    )
                  );
              }
            }

            messages.push(
              decision.validation.reason
            );

            if (
              !decision.validation.approved
            ) {
              break;
            }
          }

          executedTools.push({
            tool: call.name,
            success: created > 0,
            message:
              created > 0
                ? 'Engine aprovou ' +
                  created +
                  ' criatura(s) no tier ' +
                  finalTier +
                  '. ' +
                  messages.join(' ')
                : messages.join(' ') ||
                  'Spawn recusado pela engine.'
          });

          continue;
        }

        if (call.name === 'request_temporary_npc') {
          const before =
            new Set(
              (latestState.npcs || []).map(
                (npc) => npc.id
              )
            );

          const decision =
            executeDirectorIntent(
              'request_temporary_npc',
              {
                name:
                  String(
                    call.args.name ||
                    'Viajante'
                  ).slice(0, 40),

                role:
                  String(
                    call.args.role ||
                    'Habitante'
                  ).slice(0, 50),

                description:
                  String(
                    call.args.description ||
                    ''
                  ).slice(0, 150),

                reason:
                  String(
                    call.args.reason ||
                    ''
                  ).slice(0, 180)
              },
              latestState,
              room.id,
              latestActorHero
            );

          if (
            decision.validation.approved
          ) {
            const npc =
              [...(latestState.npcs || [])]
                .reverse()
                .find(
                  (candidate) =>
                    !before.has(candidate.id)
                );

            if (npc) {
              npc.biome =
                latestActorHero.biome ||
                latestState.biome ||
                'village';

              npc.x =
                Math.max(
                  0,
                  Math.min(
                    15,
                    latestActorHero.x + 2
                  )
                );

              npc.y =
                Math.max(
                  0,
                  Math.min(
                    15,
                    latestActorHero.y + 1
                  )
                );
            }
          }

          executedTools.push({
            tool: call.name,
            success:
              decision.validation.approved,
            message:
              decision.validation.reason
          });

          continue;
        }

        if (call.name === 'request_environmental_event') {
          const decision =
            executeDirectorIntent(
              'request_environmental_event',
              {
                text:
                  String(
                    call.args.text ||
                    ''
                  ).slice(0, 180),

                reason:
                  String(
                    call.args.reason ||
                    ''
                  ).slice(0, 180)
              },
              latestState,
              room.id,
              latestActorHero
            );

          executedTools.push({
            tool: call.name,
            success:
              decision.validation.approved,
            message:
              decision.validation.reason
          });

          continue;
        }

        if (call.name === 'request_microadventure') {
          const flags =
            latestState.worldFlags ||
            {};

          const eligible =
            Object.values(
              MICRO_ADVENTURES
            ).filter(
              (adventure) => {
                if (
                  flags[
                    'completed_' +
                      adventure.id
                  ]
                ) {
                  return false;
                }

                if (
                  !adventure.requiredFlags ||
                  adventure.requiredFlags.length === 0
                ) {
                  return true;
                }

                return adventure.requiredFlags.every(
                  (flag) =>
                    Boolean(flags[flag])
                );
              }
            );

          if (
            latestState.activeMicroAdventureId
          ) {
            executedTools.push({
              tool: call.name,
              success: false,
              message:
                'J? existe uma microaventura ativa.'
            });

            continue;
          }

          if (eligible.length === 0) {
            executedTools.push({
              tool: call.name,
              success: false,
              message:
                'Nenhuma microaventura est? dispon?vel para o progresso atual.'
            });

            continue;
          }

          const theme =
            String(
              call.args.theme ||
              ''
            ).toLowerCase();

          const scored =
            eligible
              .map(
                (adventure) => ({
                  adventure,
                  score:
                    theme &&
                    (
                      adventure.title
                        .toLowerCase()
                        .includes(theme) ||
                      adventure.subtitle
                        .toLowerCase()
                        .includes(theme)
                    )
                      ? 1
                      : 0
                })
              )
              .sort(
                (a, b) =>
                  b.score - a.score
              );

          const selectedAdventure =
            scored[0].adventure;

          const decision =
            executeDirectorIntent(
              'request_microadventure',
              {
                adventureId:
                  selectedAdventure.id,

                reason:
                  String(
                    call.args.reason ||
                    'Oportunidade de aventura no mundo.'
                  ).slice(0, 180)
              },
              latestState,
              room.id,
              latestActorHero
            );

          executedTools.push({
            tool: call.name,
            success:
              decision.validation.approved,
            message:
              decision.validation.reason
          });

          continue;
        }

        if (call.name === 'influence_economy') {
          const trend =
            String(
              call.args.trend ||
              'estavel'
            );

          const multiplier =
            trend === 'escassez'
              ? 1.12
              : trend === 'abundancia'
                ? 0.92
                : 1.0;

          const decision =
            executeDirectorIntent(
              'influence_economy',
              {
                multiplier,
                reason:
                  String(
                    call.args.reason ||
                    'Mudan?a natural das rotas comerciais.'
                  ).slice(0, 180)
              },
              latestState,
              room.id,
              latestActorHero
            );

          executedTools.push({
            tool: call.name,
            success:
              decision.validation.approved,
            message:
              decision.validation.reason
          });

          continue;
        }

        if (call.name === 'adjust_ecosystem') {
          const signal =
            String(
              call.args.signal ||
              'corvos'
            );

          const critterType =
            signal === 'rastros_lobos'
              ? 'lobos_rastros'
              : signal === 'cervos'
                ? 'cervos'
                : 'corvos';

          const decision =
            executeDirectorIntent(
              'adjust_ecosystem',
              {
                critterType,
                reason:
                  String(
                    call.args.reason ||
                    'Mudan?a natural do ecossistema.'
                  ).slice(0, 180)
              },
              latestState,
              room.id,
              latestActorHero
            );

          executedTools.push({
            tool: call.name,
            success:
              decision.validation.approved,
            message:
              decision.validation.reason
          });

          continue;
        }

        if (call.name === 'request_loot') {
          const rewardClass =
            String(
              call.args.rewardClass ||
              'normal'
            );

          const requestedTier =
            rewardClass === 'importante'
              ? 3
              : rewardClass === 'normal'
                ? 2
                : 1;

          const maxTier =
            latestActorHero.level >= 8
              ? 3
              : latestActorHero.level >= 4
                ? 2
                : 1;

          const tier =
            Math.min(
              requestedTier,
              maxTier
            ) as ItemTier;

          const kind =
            ['ouro', 'item', 'misto'].includes(
              String(call.args.rewardKind)
            )
              ? String(call.args.rewardKind)
              : 'misto';

          const party =
            latestActorHero.partyId
              ? latestState.characters.filter(
                  (hero) =>
                    hero.partyId ===
                    latestActorHero.partyId
                )
              : [latestActorHero];

          const recipients =
            call.args.scope === 'grupo'
              ? party
              : [latestActorHero];

          const totalGold =
            rewardClass === 'importante'
              ? 60
              : rewardClass === 'normal'
                ? 25
                : 10;

          const eachGold =
            Math.max(
              1,
              Math.floor(
                totalGold /
                Math.max(
                  1,
                  recipients.length
                )
              )
            );

          const resultMessages: string[] = [];
          let success = false;

          if (
            kind === 'ouro' ||
            kind === 'misto'
          ) {
            for (
              const recipient of recipients
            ) {
              const result =
                executeServerAuthoritativeGmTool(
                  'grant_loot',
                  {
                    targetHeroId:
                      recipient.id,

                    gold:
                      eachGold,

                    xp:
                      0,

                    reason:
                      String(
                        call.args.reason ||
                        'Recompensa narrativa.'
                      ).slice(0, 180)
                  },
                  latestState
                );

              success =
                success ||
                result.success;

              resultMessages.push(
                result.message
              );
            }
          }

          if (
            kind === 'item' ||
            kind === 'misto'
          ) {
            const generatedItem =
              generateProceduralItem(
                tier,
                Date.now() +
                  latestState.logs.length
              );

            const result =
              executeServerAuthoritativeGmTool(
                'grant_loot',
                {
                  targetHeroId:
                    latestActorHero.id,

                  itemId:
                    generatedItem.id,

                  itemName:
                    generatedItem.name,

                  itemData:
                    { ...generatedItem },

                  gold:
                    0,

                  xp:
                    0,

                  reason:
                    String(
                      call.args.reason ||
                      'Recompensa narrativa.'
                    ).slice(0, 180)
                },
                latestState
              );

            success =
              success ||
              result.success;

            resultMessages.push(
              result.message
            );
          }

          executedTools.push({
            tool: call.name,
            success,
            message:
              resultMessages.join(' ')
          });

          continue;
        }
      }

      if (text) {
        latestState.logs.push(entry(text, 'player'));
      }
      latestState.logs.push({ ...entry(answer, 'gm'), sources });
      latestState.logs = latestState.logs.slice(-200);

      const updateResult =
        await db
          .prepare(
            'UPDATE rooms SET state=?,version=version+1 WHERE id=? AND version=?'
          )
          .bind(
            JSON.stringify(
              latestState
            ),
            room.id,
            latestRoom.version
          )
          .run();

      if (
        !(
          updateResult?.meta?.changes ??
          updateResult?.changes ??
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
          const merged =
            mergeStates(
              JSON.parse(
                fresh.state
              ),
              latestState,
              fresh.version,
              latestRoom.version +
                1
            );

          await db
            .prepare(
              'UPDATE rooms SET state=?,version=version+1 WHERE id=? AND version=?'
            )
            .bind(
              JSON.stringify(
                merged
              ),
              room.id,
              fresh.version
            )
            .run();
        }
      }
    }

    return NextResponse.json({ ok: true, answer, choices, executedTools, searchHtml });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'A GM não respondeu. Tente novamente.' },
      { status: 400 }
    );
  }
}
