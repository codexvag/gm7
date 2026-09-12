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
import { addInventoryItem } from './inventory-utils';
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
      name: 'request_creature_spawn',
      description:
        'Sugere ? engine que uma criatura ou pequeno grupo apare?a por uma raz?o narrativa. A engine decide estat?sticas, balanceamento, posicionamento e se haver? combate.',
      parameters: {
        type: 'object',
        properties: {
          creatureName: {
            type: 'string',
            description: 'Nome ou conceito narrativo da criatura.'
          },
          threat: {
            type: 'string',
            enum: ['baixa', 'moderada', 'alta', 'chefe'],
            description: 'Intensidade narrativa desejada. A engine poder? reduzir conforme o n?vel do grupo.'
          },
          count: {
            type: 'number',
            description: 'Quantidade sugerida. A engine limita automaticamente.'
          },
          reason: {
            type: 'string',
            description: 'Por que esta presen?a faz sentido neste local e momento.'
          }
        },
        required: ['creatureName', 'threat', 'reason']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'request_temporary_npc',
      description:
        'Sugere um NPC contextual ao mundo. A engine decide se pode cri?-lo.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          description: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['name', 'role', 'description', 'reason']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'request_loot',
      description:
        'Sugere uma recompensa narrativa. A IA n?o escolhe ouro exato, XP ou estat?sticas do item; a engine decide.',
      parameters: {
        type: 'object',
        properties: {
          rewardClass: {
            type: 'string',
            enum: ['pequena', 'normal', 'importante']
          },
          rewardKind: {
            type: 'string',
            enum: ['ouro', 'item', 'misto']
          },
          scope: {
            type: 'string',
            enum: ['jogador', 'grupo']
          },
          reason: {
            type: 'string'
          }
        },
        required: ['rewardClass', 'rewardKind', 'reason']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'request_environmental_event',
      description:
        'Sugere um acontecimento ambiental, rumor, press?gio ou mudan?a regional sem mexer nas regras.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Descri??o curta do acontecimento.'
          },
          reason: {
            type: 'string',
            description: 'Causa ou conex?o com o estado atual do mundo.'
          }
        },
        required: ['text', 'reason']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'request_microadventure',
      description:
        'Sugere que a engine ofere?a uma microaventura dispon?vel e coerente com o progresso atual. A engine escolhe qual aventura pode realmente come?ar.',
      parameters: {
        type: 'object',
        properties: {
          theme: {
            type: 'string',
            description: 'Tema narrativo desejado, sem informar ID interno.'
          },
          reason: {
            type: 'string'
          }
        },
        required: ['reason']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'influence_economy',
      description:
        'Sugere uma tend?ncia econ?mica. A engine aplica somente valores seguros.',
      parameters: {
        type: 'object',
        properties: {
          trend: {
            type: 'string',
            enum: ['estavel', 'escassez', 'abundancia']
          },
          reason: {
            type: 'string'
          }
        },
        required: ['trend', 'reason']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'adjust_ecosystem',
      description:
        'Sugere uma manifesta??o ecol?gica segura para dar vida ? regi?o.',
      parameters: {
        type: 'object',
        properties: {
          signal: {
            type: 'string',
            enum: ['rastros_lobos', 'cervos', 'corvos']
          },
          reason: {
            type: 'string'
          }
        },
        required: ['signal', 'reason']
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
          hero.inventory = addInventoryItem(
            hero.inventory || '',
            itemName,
            1
          );
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
