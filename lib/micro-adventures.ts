// lib/micro-adventures.ts
// Sistema de Microaventuras de 10 a 30 Minutos para o Sandbox de Valdoria
// D&D 5e SRD 5.2.1 — Início, Meio, Fim e Consequência no Estado do Mundo

import type { State, Enemy, Character } from './game-engine';
import { entry, d20 } from './game-engine';

export interface MicroAdventureStage {
  stageIndex: number;
  name: string;
  objective: string;
  dialogueNarrative: string;
  spawnEnemies?: {
    name: string;
    hp: number;
    maxHp: number;
    ac: number;
    attack: number;
    damage: string;
    weapon: string;
    x: number;
    y: number;
  }[];
  checkCondition?: (state: State) => boolean;
}

export interface MicroAdventure {
  id: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number; // 10 a 30
  locationIndex: number; // 0: Vila, 1: Floresta, 2: Ruínas, 3: Catacumbas, 4: Desfiladeiro, 5: Covil
  requiredFlags?: string[]; // Flags do mundo necessárias para desbloquear
  hookNpcId: string;
  hookNpcName: string;
  hookNpcDialogue: string;
  stages: MicroAdventureStage[];
  rewards: {
    xp: number;
    gold: number;
    items?: string[];
    titleReward?: string;
  };
  worldConsequences: Record<string, boolean>; // Flags persistentes no mundo
  dialogueVictory: string;
}

export const MICRO_ADVENTURES: Record<string, MicroAdventure> = {
  'bridge-sentinel': {
    id: 'bridge-sentinel',
    title: 'A Ameaça da Ponte Leste',
    subtitle: 'Microaventura 1 • Duração: 10-15 minutos',
    estimatedMinutes: 12,
    locationIndex: 0, // Vila do Rio Verde
    hookNpcId: 'doran',
    hookNpcName: 'Ancião Doran',
    hookNpcDialogue:
      'Aventureiros! Criaturas feitas de cinzas e brasas bloquearam a ponte leste da nossa vila. As caravanas de suprimentos não conseguem passar e a fumaça no horizonte piora a cada hora. Purifiquem a ponte para que possamos reabrir a rota para as antigas ruínas!',
    stages: [
      {
        stageIndex: 0,
        name: 'Início: Alerta na Vila',
        objective: 'Conversar com o Ancião Doran e preparar suprimentos de cura com Elenor.',
        dialogueNarrative:
          'Os sinos da vila ressoam alarmados. Moradores trancam as portas enquanto cinzas quentes sopram do leste sobre o riacho.'
      },
      {
        stageIndex: 1,
        name: 'Meio: Emboscada na Ponte',
        objective: 'Avançar até a ponte leste e derrotar os Sentinelas de Cinzas.',
        dialogueNarrative:
          'Na margem leste do rio, duas figuras de carvão fumegante com olhos cor de brasa bloqueiam o tablado de madeira. Elas desembainham lâminas de ferro fundido!',
        spawnEnemies: [
          {
            name: 'Sentinela de Cinzas',
            hp: 14,
            maxHp: 14,
            ac: 13,
            attack: 4,
            damage: '1d8+2',
            weapon: 'Espada de Cinzas',
            x: 9,
            y: 4
          },
          {
            name: 'Cão de Brasas',
            hp: 9,
            maxHp: 9,
            ac: 12,
            attack: 3,
            damage: '1d6+1',
            weapon: 'Mordida Ígnea',
            x: 10,
            y: 5
          }
        ]
      },
      {
        stageIndex: 2,
        name: 'Fim: Purificação da Rota',
        objective: 'Inspecionar as cinzas dos sentinelas e recolher a chave das ruínas.',
        dialogueNarrative:
          'Com a derrota das criaturas, o fogo se apaga em brasas estalantes. Entre os restos carbonizados, uma chave rúnica com a insígnia da Abadia reluz sob a luz da manhã.'
      }
    ],
    rewards: {
      xp: 150,
      gold: 40,
      items: ['pocao-cura', 'chave-abadia'],
      titleReward: 'Pacificador da Ponte Leste'
    },
    worldConsequences: {
      bridge_cleared: true,
      trade_route_open: true,
      ruins_unlocked: true,
      dragon_rumor_stage1: true
    },
    dialogueVictory:
      'A ponte leste de Vila do Rio Verde está livre! Os mercadores comemoram e o Ancião Doran aponta para o topo das colunas: "As cinzas vêm das ruínas da abadia antiga... algo muito maior despertou nas montanhas."'
  },

  'lost-herbalist': {
    id: 'lost-herbalist',
    title: 'O Herbalista Perdido na Floresta',
    subtitle: 'Microaventura 2 • Duração: 15-20 minutos',
    estimatedMinutes: 18,
    locationIndex: 1, // Floresta dos Sussurros
    requiredFlags: ['bridge_cleared'],
    hookNpcId: 'elenor',
    hookNpcName: 'Alquimista Elenor',
    hookNpcDialogue:
      'Meu aprendiz, Jonan, adentrou a Floresta dos Sussurros procurando musgo-de-lua para produzir poções maiores de cura. Já faz um dia inteiro e ouvimos uivos anormais perto do lago sagrado. Por favor, encontrem-no antes que as sombras da floresta o consumam!',
    stages: [
      {
        stageIndex: 0,
        name: 'Início: Rastreando as Pegadas',
        objective: 'Viajar para a Floresta dos Sussurros e seguir o rastro de ervas deixado por Jonan.',
        dialogueNarrative:
          'A copa dos carvalhos é tão densa que transforma o dia em crepúsculo. Pegadas apressadas seguem em direção ao círculo de pedras do lago.'
      },
      {
        stageIndex: 1,
        name: 'Meio: Emboscada da Alcateia Corrompida',
        objective: 'Proteger o aprendiz e derrotar os Lobos das Cinzas na clareira do lago.',
        dialogueNarrative:
          'Encurralado sobre as raízes de um grande salgueiro, o jovem Jonan empunha uma adaga trêmula enquanto predadores com olhos cor de fogo cercam a árvore!',
        spawnEnemies: [
          {
            name: 'Lobo Alfa das Cinzas',
            hp: 18,
            maxHp: 18,
            ac: 13,
            attack: 5,
            damage: '2d4+3',
            weapon: 'Mordida Dilacerante',
            x: 7,
            y: 5
          },
          {
            name: 'Lobo Cinzento',
            hp: 11,
            maxHp: 11,
            ac: 12,
            attack: 4,
            damage: '1d6+2',
            weapon: 'Mordida Rápida',
            x: 8,
            y: 6
          }
        ]
      },
      {
        stageIndex: 2,
        name: 'Fim: O Segredo do Menir',
        objective: 'Ativar o menir druídico para abençoar a floresta e escoltar Jonan em segurança.',
        dialogueNarrative:
          'Jonan agradece em lágrimas e entrega uma bolsa de musgo raro. Ele aponta para árvores queimadas no cume: "Eu vi uma sombra gigantesca com asas cruzar o desfiladeiro... o fogo está descendo a serra!"'
      }
    ],
    rewards: {
      xp: 220,
      gold: 60,
      items: ['pocao-cura-maior', 'amuleto-druidico'],
      titleReward: 'Guardião dos Bosques'
    },
    worldConsequences: {
      herbalist_rescued: true,
      rare_potions_available: true,
      dragon_rumor_stage2: true
    },
    dialogueVictory:
      'Jonan foi salvo e retornou com segurança para a vila! A Alquimista Elenor agora disponibiliza Poções de Cura Maior no seu estoque, e os relatos de Jonan confirmam: o calor sufocante vem da Fenda Escarpada.'
  },

  'desecrated-abbey': {
    id: 'desecrated-abbey',
    title: 'O Cerco às Ruínas da Abadia',
    subtitle: 'Microaventura 3 • Duração: 20-25 minutos',
    estimatedMinutes: 22,
    locationIndex: 2, // Pátio das Ruínas da Abadia
    requiredFlags: ['ruins_unlocked'],
    hookNpcId: 'kaelen',
    hookNpcName: 'Capitão Kaelen',
    hookNpcDialogue:
      'Cultistas do Fogo Primordial montaram um acampamento no pátio da antiga abadia. Eles estão usando um medalhão dracônico para tentar despertar as cinzas do subterrâneo. Precisamos romper as defesas externas antes que eles concluam o ritual!',
    stages: [
      {
        stageIndex: 0,
        name: 'Início: Infiltração nas Ruínas',
        objective: 'Avançar pelas muralhas caídas do pátio e tomar cobertura entre as colunas.',
        dialogueNarrative:
          'O vento sibila através dos arcos de pedra rachados. Cânticos em dracônico ecoam das fogueiras erguidas ao redor do altar central.'
      },
      {
        stageIndex: 1,
        name: 'Meio: Confronto com o Fanático das Cinzas',
        objective: 'Derrotar o Fanático do Culto e seus guardas antes do término do sacrifício.',
        dialogueNarrative:
          'O líder dos cultistas ergue um cajado envolto em chamas negras: "Vocês não podem deter a ascensão de Ignisrax! Queime em sua honra!"',
        spawnEnemies: [
          {
            name: 'Fanático do Fogo Negro',
            hp: 24,
            maxHp: 24,
            ac: 13,
            attack: 5,
            damage: '1d8+3',
            weapon: 'Raio de Fogo Sagrado',
            x: 8,
            y: 6
          },
          {
            name: 'Cultista Brutamontes',
            hp: 16,
            maxHp: 16,
            ac: 14,
            attack: 4,
            damage: '1d10+2',
            weapon: 'Maça Pesada',
            x: 7,
            y: 5
          }
        ]
      },
      {
        stageIndex: 2,
        name: 'Fim: O Medalhão Dracônico',
        objective: 'Recolher o Medalhão de Obsidiana e inspecionar a descida para as Catacumbas.',
        dialogueNarrative:
          'O fanático cai de joelhos e desfaz-se em fagulhas. Em suas vestes, o medalhão pulsa calor constante, revelando o selo das catacumbas e a rota para o desfiladeiro superior.'
      }
    ],
    rewards: {
      xp: 300,
      gold: 80,
      items: ['medalhao-obsidiana', 'pergaminho-protecao-fogo'],
      titleReward: 'Expurgador do Culto'
    },
    worldConsequences: {
      abbey_cleared: true,
      catacombs_unsealed: true,
      canyon_unlocked: true,
      dragon_rumor_stage3: true
    },
    dialogueVictory:
      'O pátio da abadia foi expurgado dos fanáticos! O medalhão de obsidiana recuperado serve como chave e proteção mágica, abrindo o acesso às catacumbas e ao desfiladeiro da montanha.'
  },

  'canyon-wyrmling': {
    id: 'canyon-wyrmling',
    title: 'A Vanguarda do Dragão no Desfiladeiro',
    subtitle: 'Microaventura 4 • Duração: 20-30 minutos',
    estimatedMinutes: 25,
    locationIndex: 4, // Desfiladeiro da Fenda Escarpada
    requiredFlags: ['canyon_unlocked'],
    hookNpcId: 'doran',
    hookNpcName: 'Ancião Doran',
    hookNpcDialogue:
      'A terra tremeu nesta madrugada. Fumaça densa e labaredas sobem do Desfiladeiro da Fenda Escarpada. Uma cria de dragão (Wyrmling) lidera patrulhas na ravina para proteger a entrada da cratera. Derrotem a vanguarda e preparem o mundo para o confronto final com Ignisrax!',
    stages: [
      {
        stageIndex: 0,
        name: 'Início: Marcha pelo Desfiladeiro',
        objective: 'Atravessar o terreno escarpado até a ponte natural sobre a fenda de enxofre.',
        dialogueNarrative:
          'O calor é quase insuportável. Gotas de suor secam instantaneamente na pele. Rochas incandescentes rolam pelas encostas íngremes de basalto.'
      },
      {
        stageIndex: 1,
        name: 'Meio: Duelo na Ravina de Fogo',
        objective: 'Derrotar o Jovem Wyrmling Vermelho e os sentinelas draconianos na fenda.',
        dialogueNarrative:
          'Um guincho estridente rompe a névoa de enxofre! Batendo asas coriáceas incandescentes, o Wyrmling salta do ninho com escamas vermelho-sangue brilhando em chamas!',
        spawnEnemies: [
          {
            name: 'Wyrmling Vermelho da Fenda',
            hp: 34,
            maxHp: 34,
            ac: 15,
            attack: 6,
            damage: '2d6+3',
            weapon: 'Mordida com Sopro de Fogo',
            x: 8,
            y: 4
          },
          {
            name: 'Guerreiro Draconiano',
            hp: 20,
            maxHp: 20,
            ac: 14,
            attack: 5,
            damage: '1d8+3',
            weapon: 'Lança de Basalto',
            x: 7,
            y: 6
          }
        ]
      },
      {
        stageIndex: 2,
        name: 'Fim: A Revelação do Covil',
        objective: 'Coletar a Escama Ancestral no ninho de brasas e abrir o portal da cratera.',
        dialogueNarrative:
          'Com um último rugido enfraquecido, o Wyrmling tomba na borda da ravina. O caminho íngreme até a cratera de Ignisrax está finalmente aberto diante de vocês!'
      }
    ],
    rewards: {
      xp: 450,
      gold: 120,
      items: ['escama-dragao-rubro', 'pocao-cura-maior'],
      titleReward: 'Caçador de Dracos'
    },
    worldConsequences: {
      canyon_secured: true,
      dragon_lair_unlocked: true,
      dragon_presence_imminent: true
    },
    dialogueVictory:
      'A vanguarda dracônica foi exterminada! A passagem para a Cratera Magmática e o Covil de Ignisrax está desobstruída. O mundo retém a respiração para a batalha que decidirá o destino de Valdoria!'
  }
};

/**
 * Obtém microaventuras disponíveis para o jogador com base nas flags do mundo
 */
export function getAvailableMicroAdventures(worldFlags: Record<string, boolean> = {}): MicroAdventure[] {
  return Object.values(MICRO_ADVENTURES).filter((adv) => {
    if (!adv.requiredFlags || adv.requiredFlags.length === 0) return true;
    return adv.requiredFlags.every((flag) => Boolean(worldFlags[flag]));
  });
}

/**
 * Inicia uma microaventura no estado do jogo (Engine autoritativa)
 */
export function startMicroAdventure(state: State, adventureId: string): { success: boolean; log: string } {
  const adv = MICRO_ADVENTURES[adventureId];
  if (!adv) return { success: false, log: `Microaventura "${adventureId}" não encontrada.` };

  state.activeMicroAdventureId = adv.id;
  state.location = adv.locationIndex;
  state.biome = adv.locationIndex === 0 ? 'village'
    : adv.locationIndex === 1 ? 'forest'
    : adv.locationIndex === 2 ? 'ruins'
    : adv.locationIndex === 3 ? 'dungeon'
    : adv.locationIndex === 4 ? 'canyon'
    : 'lair';

  if (!state.questProgress) state.questProgress = {};
  state.questProgress[`adv-${adv.id}-stage`] = true;

  const stage0 = adv.stages[0];
  const logMessage = `🗺️ [Microaventura Iniciada: ${adv.title}]\n${stage0.dialogueNarrative}\n🎯 Objetivo: ${stage0.objective}`;
  state.logs.push(entry(logMessage, 'gm'));

  return { success: true, log: logMessage };
}

/**
 * Conclui uma microaventura, concedendo recompensas e aplicando consequências no mundo
 */
export function completeMicroAdventure(state: State, adventureId: string): { success: boolean; log: string } {
  const adv = MICRO_ADVENTURES[adventureId];
  if (!adv) return { success: false, log: `Microaventura "${adventureId}" não encontrada.` };

  // 1. Aplicar consequências no estado do mundo
  if (!state.worldFlags) state.worldFlags = {};
  Object.assign(state.worldFlags, adv.worldConsequences);
  state.worldFlags[`completed_${adv.id}`] = true;

  // 2. Conceder XP e ouro para heróis vivos
  const activeHeroes = state.characters.filter((c) => c.hp > 0);
  const recipients = activeHeroes.length > 0 ? activeHeroes : state.characters;

  for (const hero of recipients) {
    hero.xp = (hero.xp || 0) + adv.rewards.xp;
    hero.gold = (hero.gold || 0) + adv.rewards.gold;
    if (adv.rewards.items) {
      for (const item of adv.rewards.items) {
        const cur = hero.inventory ? hero.inventory.trim() : '';
        hero.inventory = cur ? `${cur}, ${item}` : item;
      }
    }
  }

  state.activeMicroAdventureId = undefined;
  const rewardSummary = `+${adv.rewards.xp} XP • +${adv.rewards.gold} PO${adv.rewards.items ? ' • Itens: ' + adv.rewards.items.join(', ') : ''}`;
  const logMessage = `🏆 [Microaventura Concluída: ${adv.title}]\n${adv.dialogueVictory}\n💎 Recompensas ao grupo: ${rewardSummary}`;
  state.logs.push(entry(logMessage, 'gm'));

  return { success: true, log: logMessage };
}
