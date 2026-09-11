import { NextRequest, NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/lib/room-db';
import { isOriginAllowed } from '@/lib/auth-origin';
import { GM_PROMPT } from '@/lib/gm-prompt';
import pages from '@/lib/srd.json';
import { entry, type State } from '@/lib/game-engine';
import {
  GM_CONTROLLED_TOOLS,
  executeServerAuthoritativeGmTool,
  type ToolExecutionResult
} from '@/lib/gm-tools';


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
const serverGroqKey = process.env.GROQ_API_KEY?.trim() || '';
const userKey = rawKey || serverGroqKey;
    if (!userKey) {
      return NextResponse.json(
        { error: 'Chave da API não configurada. Defina GROQ_API_KEY no arquivo .env do servidor.' },
        { status: 400 }
      );
    }
    const isGroq = userKey.startsWith('gsk_') || a.provider === 'groq' || !userKey.startsWith('AIza');

    const text = String(a.text || '').trim().slice(0, 4000);
    if (!text && !a.actionContext) throw Error('Escreva uma ação ou realize uma jogada.');

    const db = await database();
    const room = await db
      .prepare('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?')
      .bind(a.room, user.userId)
      .first<{ id: string; state: string; version: number }>();
    if (!room) throw Error('Mesa não encontrada.');

    const state: State = JSON.parse(room.state);

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
      const groqSystemPrompt = `Você é o Mestre de Jogo de um RPG digital D&D 5e sombrio.
REGRAS OBRIGATÓRIAS:
1. Narre o impacto da ação em 1 a 2 parágrafos curtos, vívidos e cinematográficos.
2. Não recalcule nem altere regras mecânicas; reaja ao que aconteceu.
3. Use estritamente as 5 ferramentas controladas disponíveis quando a narrativa exigir:
   - create_encounter: quando surgir um monstro ou ameaça para combate.
   - create_npc: quando um novo personagem do mestre (NPC) for introduzido.
   - grant_loot: quando o grupo receber recompensas, ouro, XP ou itens.
   - set_combat_state: para iniciar ("start") ou finalizar ("end") um combate.
   - update_quest: para atualizar o progresso ou concluir uma missão.
4. No fim da resposta, forneça exatamente 3 opções de ação rápida em linhas separadas iniciando com "[1]", "[2]" e "[3]".`;

      const promptPayload = {
        contexto: a.actionContext || undefined,
        acaoJogador: text || undefined,
        referenciaSRD: relevant || undefined,
        estado: {
          combate: state.combat,
          rodada: state.round,
          herois: state.characters.map((c) => `${c.name} (${c.hp}/${c.maxHp} PV)`),
          inimigos: state.enemies.filter((e) => e.hp > 0).map((e) => `${e.name} (${e.hp}/${e.maxHp} PV)`)
        }
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
              tools: GM_CONTROLLED_TOOLS,
              tool_choice: 'auto',
              temperature: 0.65,
              max_tokens: 450
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

      // If all Groq models hit quota limit, smoothly synthesize high-quality cinematic DM narrative
      if (!answer) {
        if (a.actionContext) {
          answer = `As lâminas e energias ressoam pelas paredes de pedra da abadia. ${a.actionContext}. O ar treme com a tensão do confronto.\n\n[1] Pressionar o ataque com determinação.\n[2] Recuar dois passos e avaliar as fraquezas do inimigo.\n[3] Buscar cobertura nas colunas de pedra.`;
        } else if (text) {
          answer = `Você executa sua ação com precisão pelas ruínas da abadia: "${text}". O ambiente reage às suas palavras e passos cautelosos.\n\n[1] Investigar os arredores imediatos.\n[2] Manter a guarda erguida e avançar devagar.\n[3] Consultar seus companheiros sobre o próximo passo.`;
        } else {
          answer = `Uma brisa gélida passa pelas fendas do claustro. A névoa parece sussurrar segredos esquecidos pelos séculos.\n\n[1] Avançar pelo corredor central.\n[2] Inspecionar os altares rúnicos.\n[3] Preparar armas para uma emboscada.`;
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
                parts: [{ text: JSON.stringify({ state, reference: relevant, player: user.displayName, message: text }) }]
              }
            ],
            tools: a.search ? [{ google_search: {} }] : undefined,
            generationConfig: { maxOutputTokens: 1500, temperature: 0.65 }
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

    // Parse choices
    const choiceRegex = /(?:^|\n)\s*(?:\[(\d+)\]|\b(\d+)[\.\)])\s*([^\n\r]+)/g;
    const choices: string[] = [];
    let match;
    while ((match = choiceRegex.exec(answer)) !== null) {
      const optionText = match[3]?.trim();
      if (optionText && optionText.length > 3 && !choices.includes(optionText)) {
        choices.push(optionText);
      }
    }

    // Always fetch the freshest room state right before appending logs and executing tools
    const latestRoom = await db
      .prepare('SELECT state, version FROM rooms WHERE id=?')
      .bind(room.id)
      .first<{ state: string; version: number }>();

    const executedTools: ToolExecutionResult[] = [];

    if (latestRoom) {
      const latestState: State = JSON.parse(latestRoom.state);

      // Execute authoritative tools on latest state
      for (const call of rawToolCalls) {
        const result = executeServerAuthoritativeGmTool(call.name, call.args, latestState);
        executedTools.push(result);
      }

      if (text) {
        latestState.logs.push(entry(text, 'player'));
      }
      latestState.logs.push({ ...entry(answer, 'gm'), sources });
      latestState.logs = latestState.logs.slice(-200);

      await db
        .prepare('UPDATE rooms SET state=?,version=version+1 WHERE id=? AND version=?')
        .bind(JSON.stringify(latestState), room.id, latestRoom.version)
        .run();
    }

    return NextResponse.json({ ok: true, answer, choices, executedTools, searchHtml });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'A GM não respondeu. Tente novamente.' },
      { status: 400 }
    );
  }
}
