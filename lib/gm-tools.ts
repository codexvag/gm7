// lib/gm-tools.ts
/**
 * Controlled, server-authoritative tools for the interactive AI Game Master.
 * The AI does NOT have direct state access.
 * Only these 5 strict tools are allowed and validated by the server.
 */

import {
  d20,
  mod,
  entry,
  ITEMS_CATALOG,
  type State,
  type Character,
  type Enemy
} from './game-engine';
import { MICRO_ADVENTURES, startMicroAdventure } from './micro-adventures';
import { adjustShopStockWithinBounds, adjustFaunaPresenceWithinBounds } from './sandbox-director';

export interface GmToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * 1. create_encounter (Criar encontro)
 * 2. create_npc (Criar NPC)
 * 3. grant_loot (Conceder loot)
 * 4. set_combat_state (Iniciar ou encerrar combate)
 * 5. update_quest (Atualizar missão)
 */
export const GM_CONTROLLED_TOOLS: GmToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_encounter',
      description:
        'Cria um encontro de combate posicionando um ou mais inimigos no mapa tático e ajustando a iniciativa.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do monstro ou inimigo (ex: Sentinela de Cinzas, Cultista Sombrio)' },
          hp: { type: 'number', description: 'Pontos de vida máximos do inimigo (ex: 9 a 45)' },
          ac: { type: 'number', description: 'Classe de Armadura / CA do inimigo (ex: 10 a 16)' },
          attack: { type: 'number', description: 'Bônus de ataque d20 do inimigo (ex: +2 a +5)' },
          damage: { type: 'string', description: 'Fórmula de dano da criatura (ex: 1d6+1, 1d8+2)' },
          x: { type: 'number', description: 'Coordenada X na grade tática (0 a 15)' },
          y: { type: 'number', description: 'Coordenada Y na grade tática (0 a 15)' },
          startCombat: { type: 'boolean', description: 'Se verdadeiro, inicia combate imediatamente com ordem de iniciativa 5e' }
        },
        required: ['name', 'hp', 'ac', 'attack', 'damage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_npc',
      description:
        'Cria um novo Personagem do Mestre (NPC) interativo no cenário, com diálogo e papel definido.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome completo do NPC' },
          role: { type: 'string', description: 'Papel ou ocupação (ex: Guarda da Vila, Boticária, Ferreiro)' },
          description: { type: 'string', description: 'Aparência e postura física do NPC' },
          dialogue: {
            type: 'array',
            items: { type: 'string' },
            description: 'Falas ou opções de conversa iniciais'
          },
          x: { type: 'number', description: 'Coordenada X opcional no mapa' },
          y: { type: 'number', description: 'Coordenada Y opcional no mapa' }
        },
        required: ['name', 'role', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grant_loot',
      description:
        'Concede recompensas aos heróis (ouro, pontos de experiência XP ou itens como poções e armas).',
      parameters: {
        type: 'object',
        properties: {
          targetHeroId: { type: 'string', description: 'ID do herói beneficiado ou "all" para todo o grupo' },
          itemId: { type: 'string', description: 'Identificador do item (ex: pocao-cura, espada-longa, adaga)' },
          itemName: { type: 'string', description: 'Nome legível do item' },
          gold: { type: 'number', description: 'Quantidade de moedas de ouro concedidas' },
          xp: { type: 'number', description: 'Quantidade de pontos de experiência (XP) concedidos' },
          reason: { type: 'string', description: 'Motivo da recompensa (ex: vitória em combate, baú encontrado)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_combat_state',
      description:
        'Inicia ou encerra o modo de combate formal sob a ordem de iniciativa D&D 5e.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['start', 'end'],
            description: '"start" para rolar iniciativa e iniciar combate, ou "end" para encerrar a batalha'
          },
          reason: { type: 'string', description: 'Motivo narrativo da mudança de estado de combate' }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_quest',
      description:
        'Atualiza o progresso de um objetivo ou marco da campanha no diário de missões.',
      parameters: {
        type: 'object',
        properties: {
          questKey: { type: 'string', description: 'Identificador único da etapa da missão (ex: act1-sentinel, investigate_abbey)' },
          title: { type: 'string', description: 'Título claro do objetivo' },
          completed: { type: 'boolean', description: 'Se o objetivo foi concluído com sucesso' },
          narrativeNote: { type: 'string', description: 'Nota de desdobramento narrativo para o diário de bordo' }
        },
        required: ['questKey', 'title', 'completed']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'trigger_world_event',
      description:
        'Desencadeia um evento ambiental ou narrativo de mundo (como rumores sobre o dragão, tremores na fenda, mudança climática ou início de microaventura pré-definida).',
      parameters: {
        type: 'object',
        properties: {
          eventType: {
            type: 'string',
            enum: ['dragon_rumor', 'earthquake', 'cinders', 'start_microadventure'],
            description: 'Tipo do evento de mundo a disparar'
          },
          detail: { type: 'string', description: 'Descrição vívida do evento para os jogadores' },
          adventureId: { type: 'string', description: 'ID opcional da microaventura a iniciar' }
        },
        required: ['eventType', 'detail']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'influence_economy',
      description:
        'Sugere uma tendência ou contexto narrativo na economia da vila (ex: escassez de suprimentos, atraso de caravana). Os preços e estoques são ajustados dentro de limites rígidos autorizados (0.85x a 1.25x).',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo narrativo da mudança econômica (ex: Caravana atrasada por ataques de goblins)' },
          multiplier: { type: 'number', description: 'Multiplicador sugerido de preços (limitado entre 0.85 e 1.25)' },
          item: { type: 'string', description: 'Item ou categoria específica afetada (opcional)' }
        },
        required: ['reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'adjust_ecosystem',
      description:
        'Sugere dinâmicas sutis de ecossistema e fauna regional (ex: presença de cervos, rastros de lobos ou corvos vigiando) dentro de um teto estrito de segurança.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo narrativo ou observação ambiental' },
          critterType: {
            type: 'string',
            enum: ['lobos_rastros', 'cervos', 'corvos'],
            description: 'Tipo de manifestação ecológica segura'
          }
        },
        required: ['reason']
      }
    }
  }
];

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  message: string;
}

/**
 * Server-authoritative executor for the 5 GM tools.
 * Validates inputs against game constraints and mutates the authoritative State safely.
 */
export function executeServerAuthoritativeGmTool(
  name: string,
  rawArgs: Record<string, any>,
  state: State
): ToolExecutionResult {
  switch (name) {
    case 'create_encounter': {
      const monsterName = String(rawArgs.name || 'Criatura Sombria').slice(0, 60);
      const hp = Math.max(1, Math.min(300, Number(rawArgs.hp) || 10));
      const ac = Math.max(5, Math.min(25, Number(rawArgs.ac) || 11));
      const attackBonus = Math.max(0, Math.min(15, Number(rawArgs.attack) || 2));
      const damage = String(rawArgs.damage || '1d6+1').slice(0, 20);
      const x = Math.max(0, Math.min(15, Number(rawArgs.x ?? 6)));
      const y = Math.max(0, Math.min(15, Number(rawArgs.y ?? 3)));
      const startCombat = rawArgs.startCombat !== false;

      const newEnemy: Enemy = {
        id: crypto.randomUUID(),
        name: monsterName,
        hp,
        maxHp: hp,
        ac,
        attack: attackBonus,
        damage,
        initiative: d20().raw + 1,
        x,
        y
      };

      if (!state.enemies) state.enemies = [];
      state.enemies.push(newEnemy);

      let logText = `⚔️ Um novo inimigo surgiu: ${monsterName} (${hp} PV, CA ${ac}) nas coordenadas [X:${x} Y:${y}].`;

      if (startCombat) {
        state.combat = true;
        state.round = 1;
        state.turn = 0;
        state.actionUsed = false;

        // Roll initiative for conscious characters
        for (const p of state.characters) {
          if (p.hp > 0) {
            p.initiative = d20().raw + mod(p.stats[1]) + 3 - 2 * p.exhaustion;
          }
        }

        state.order = [...state.characters.filter((c) => c.hp > 0), ...state.enemies]
          .sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id))
          .map((c) => c.id);

        logText += ` Combate iniciado! Ordem de Iniciativa calculada.`;
      }

      state.logs.push(entry(logText, 'gm'));

      return {
        tool: name,
        success: true,
        message: logText
      };
    }

    case 'create_npc': {
      if (!state.npcs) state.npcs = [];
      if (state.npcs.length >= 50) {
        return { tool: name, success: false, message: 'Limite de 50 NPCs atingido no cenário.' };
      }

      const npcName = String(rawArgs.name || 'Viajante').slice(0, 60);
      const role = String(rawArgs.role || 'Habitante').slice(0, 80);
      const description = String(rawArgs.description || '').slice(0, 2000);
      const dialogue = Array.isArray(rawArgs.dialogue)
        ? rawArgs.dialogue.map((d: any) => String(d).slice(0, 300))
        : undefined;
      const x = typeof rawArgs.x === 'number' ? Math.max(0, Math.min(15, rawArgs.x)) : undefined;
      const y = typeof rawArgs.y === 'number' ? Math.max(0, Math.min(15, rawArgs.y)) : undefined;

      const newNpc = {
        id: crypto.randomUUID(),
        name: npcName,
        role,
        description,
        dialogue,
        x,
        y
      };

      state.npcs.push(newNpc);
      const logText = `👤 ${npcName} (${role}) foi introduzido à história.`;
      state.logs.push(entry(logText, 'gm'));

      return {
        tool: name,
        success: true,
        message: logText
      };
    }

    case 'grant_loot': {
      const gold = Math.max(0, Number(rawArgs.gold || 0));
      const xp = Math.max(0, Number(rawArgs.xp || 0));
      const rawItemId = String(rawArgs.itemId || '').trim().toLowerCase();
      const itemName = String(rawArgs.itemName || (ITEMS_CATALOG[rawItemId]?.name) || rawItemId);
      const targetId = String(rawArgs.targetHeroId || 'all');
      const reason = String(rawArgs.reason || 'Recompensa do Mestre');

      const recipients = targetId === 'all'
        ? state.characters
        : state.characters.filter((c) => c.id === targetId);

      if (recipients.length === 0) {
        return { tool: name, success: false, message: 'Nenhum herói válido encontrado para receber o loot.' };
      }

      const grantedItems: string[] = [];

      for (const hero of recipients) {
        if (gold > 0) {
          hero.gold = (hero.gold || 0) + gold;
        }
        if (xp > 0) {
          hero.xp = (hero.xp || 0) + xp;
        }
        if (rawItemId) {
          // Append item safely into character inventory string
          const curInv = hero.inventory ? hero.inventory.trim() : '';
          const addition = rawItemId;
          hero.inventory = curInv ? `${curInv}, ${addition}` : addition;
        }
      }

      if (gold > 0) grantedItems.push(`+${gold} PO`);
      if (xp > 0) grantedItems.push(`+${xp} XP`);
      if (rawItemId) grantedItems.push(`Item: ${itemName}`);

      const targetText = targetId === 'all' ? 'ao grupo de heróis' : recipients[0].name;
      const logText = `💎 Loot concedido ${targetText} [${reason}]: ${grantedItems.join(' • ')}`;
      state.logs.push(entry(logText, 'gm'));

      return {
        tool: name,
        success: true,
        message: logText
      };
    }

    case 'set_combat_state': {
      const action = String(rawArgs.action || '').toLowerCase();
      const reason = String(rawArgs.reason || '');

      if (action === 'start') {
        const consciousHeroes = state.characters.filter((c) => c.hp > 0);
        if (consciousHeroes.length === 0) {
          return { tool: name, success: false, message: 'Não há heróis conscientes para iniciar o combate.' };
        }

        state.combat = true;
        state.round = 1;
        state.turn = 0;
        state.actionUsed = false;

        for (const p of state.characters) {
          if (p.hp > 0) {
            p.initiative = d20().raw + mod(p.stats[1]) + 3 - 2 * p.exhaustion;
          }
        }
        for (const e of state.enemies) {
          if (!e.initiative) e.initiative = d20().raw + 1;
        }

        state.order = [...consciousHeroes, ...state.enemies.filter((e) => e.hp > 0)]
          .sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id))
          .map((c) => c.id);

        const logText = `⚔️ Combate iniciado pela narrativa do Mestre! ${reason ? '(' + reason + ')' : ''}`;
        state.logs.push(entry(logText, 'gm'));

        return { tool: name, success: true, message: logText };
      } else if (action === 'end') {
        state.combat = false;
        state.order = [];
        state.actionUsed = false;

        const logText = `🛡️ Combate encerrado pelo Mestre. ${reason ? '(' + reason + ')' : ''}`;
        state.logs.push(entry(logText, 'gm'));

        return { tool: name, success: true, message: logText };
      }

      return { tool: name, success: false, message: `Ação inválida para set_combat_state: ${action}` };
    }

    case 'update_quest': {
      const questKey = String(rawArgs.questKey || '').trim();
      const title = String(rawArgs.title || questKey);
      const completed = Boolean(rawArgs.completed);
      const narrativeNote = String(rawArgs.narrativeNote || '');

      if (!questKey) {
        return { tool: name, success: false, message: 'Identificador de missão (questKey) é obrigatório.' };
      }

      if (!state.questProgress) state.questProgress = {};
      state.questProgress[questKey] = completed;

      const logText = `📜 [Missão Atualizada] "${title}": ${completed ? 'Concluída ✅' : 'Em progresso ⏳'}${narrativeNote ? ' — ' + narrativeNote : ''}`;
      state.logs.push(entry(logText, 'gm'));

      return { tool: name, success: true, message: logText };
    }

    case 'trigger_world_event': {
      const eventType = String(rawArgs.eventType || 'dragon_rumor');
      const detail = String(rawArgs.detail || 'Um presságio misterioso altera a atmosfera do cenário.').slice(0, 500);
      const adventureId = rawArgs.adventureId ? String(rawArgs.adventureId) : undefined;

      if (!state.worldFlags) state.worldFlags = {};

      if (eventType === 'dragon_rumor') {
        state.worldFlags['dragon_rumor_active'] = true;
      } else if (eventType === 'earthquake') {
        state.worldFlags['earthquake_occurred'] = true;
      } else if (eventType === 'cinders') {
        state.worldFlags['cinders_falling'] = true;
      }

      let logText = `🌌 [Evento do Mundo: ${eventType.toUpperCase()}] ${detail}`;

      if (adventureId && MICRO_ADVENTURES[adventureId]) {
        const res = startMicroAdventure(state, adventureId);
        logText += `\n${res.log}`;
      } else {
        state.logs.push(entry(logText, 'gm'));
      }

      return { tool: name, success: true, message: logText };
    }

    case 'influence_economy': {
      const reason = String(rawArgs.reason || 'Adaptação econômica').slice(0, 150);
      const mult = typeof rawArgs.multiplier === 'number' ? rawArgs.multiplier : 1.1;
      const item = rawArgs.item ? String(rawArgs.item).slice(0, 50) : undefined;
      const res = adjustShopStockWithinBounds(state, reason, mult, item);
      return {
        tool: name,
        success: res.approved,
        message: `[Economia Narrativa] Multiplicador ${res.finalMultiplier}x. ${res.notice}`
      };
    }

    case 'adjust_ecosystem': {
      const reason = String(rawArgs.reason || 'Dinâmica ambiental').slice(0, 150);
      const critterType = rawArgs.critterType === 'lobos_rastros' || rawArgs.critterType === 'cervos'
        ? rawArgs.critterType
        : 'corvos';
      const res = adjustFaunaPresenceWithinBounds(state, reason, critterType);
      return {
        tool: name,
        success: res.approved,
        message: res.message
      };
    }

    default:
      return {
        tool: name,
        success: false,
        message: `Ferramenta não autorizada ou desconhecida: "${name}". Apenas as ferramentas autorizadas são permitidas.`
      };
  }
}
