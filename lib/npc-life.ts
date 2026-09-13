import type {
  NpcEntity,
  State
} from './game-engine';

function hashText(
  value: string
): number {
  let hash = 2166136261;

  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    hash ^=
      value.charCodeAt(i);

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return Math.abs(
    hash >>> 0
  );
}

function pick(
  values: string[],
  seed: number,
  offset = 0
): string {
  return values[
    (
      seed +
      offset
    ) %
    values.length
  ];
}

const SPECIES = [
  'Humano',
  'Elfo',
  'Anao',
  'Halfling',
  'Tiefling',
  'Draconato'
];

const PERSONALITIES = [
  'Prudente e observador; mede as palavras antes de confiar em desconhecidos.',
  'Caloroso, curioso e levemente supersticioso; lembra rostos e pequenos favores.',
  'Direto e pragmÃ¡tico; respeita competencia, coragem e promessas cumpridas.',
  'Reservado e melancolico; fala como quem carrega historias que prefere nao reviver.',
  'Vivaz e astuto; usa humor seco para esconder preocupacoes reais.',
  'Gentil, culto e atento aos detalhes; evita julgar alguem antes de ouvir.'
];

const GOALS = [
  'Manter sua comunidade segura enquanto tenta compreender as mudancas recentes de Valdoria.',
  'Descobrir quem esta lucrando com a instabilidade das rotas e das ruinas.',
  'Proteger uma pessoa importante sem chamar atencao para ela.',
  'Juntar informacoes suficientes para sobreviver ao proximo grande acontecimento.',
  'Resolver uma divida antiga ligada a esta regiao.',
  'Encontrar uma forma de melhorar sua vida sem abandonar aqueles que dependem dele.'
];

const SECRETS = [
  'Viu uma figura conhecida viajando por uma rota que deveria estar abandonada.',
  'Possui uma pequena divida com alguem ligado aos acontecimentos da regiao.',
  'Conhece um atalho perigoso que evita mencionar a pessoas irresponsaveis.',
  'Escutou um rumor verdadeiro misturado a duas versoes falsas que circulam entre viajantes.',
  'Guarda um objeto sem valor mecanico, mas de grande importancia emocional.',
  'Reconhece um simbolo antigo que aparece em relatos recentes, embora nao saiba toda a verdade.'
];

const HISTORIES = [
  'Passou anos viajando entre povoados de Valdoria e aprendeu que guerras deixam cicatrizes muito depois do ultimo combate.',
  'Nasceu perto desta regiao e acompanhou caravanas, patrulhas e mudancas politicas desde jovem.',
  'Chegou a Valdoria fugindo de um fracasso pessoal e construiu aqui uma nova reputacao.',
  'Serviu durante anos a uma guilda, templo ou companhia antes de escolher uma vida mais independente.',
  'Perdeu pessoas importantes para perigos das estradas e por isso observa aventureiros com cautela.',
  'Construiu seus contatos negociando informacoes e favores entre viajantes, guardas e moradores.'
];

const FIXED: Record<
  string,
  Partial<NpcEntity>
> = {
  doran: {
    species: 'Humano',
    personality:
      'Sereno, paternal e diplomatico. Doran prefere convencer a ordenar, mas assume firmeza quando a vila esta em risco.',
    history:
      'Doran passou decadas mediando disputas de Vila do Rio Verde e preservando relatos sobre os antigos selos de Valdoria.',
    currentGoal:
      'Proteger a vila e descobrir por que os selos antigos voltaram a falhar.',
    secret:
      'Teme que documentos antigos da vila tenham omitido deliberadamente parte da historia dos selos.'
  },

  elenor: {
    species: 'Elfa',
    personality:
      'Curiosa, inteligente e energica. Elenor transforma quase toda conversa em observacao pratica sobre ervas, criaturas ou sobrevivencia.',
    history:
      'Estudou botÃ¢nica e alquimia com curandeiros itinerantes antes de fixar sua oficina em Vila do Rio Verde.',
    currentGoal:
      'Manter aventureiros vivos e identificar como a corrupcao regional esta alterando plantas e criaturas.',
    secret:
      'Algumas plantas recolhidas recentemente apresentam uma alteracao que ela ainda nao contou aos moradores.'
  },

  kaelen: {
    species: 'Humano',
    personality:
      'Disciplinado, seco e protetor. Kaelen fala pouco, observa postura e equipamento e demonstra respeito por competencia real.',
    history:
      'Veterano de patrulhas de fronteira, Kaelen perdeu soldados em expedicoes mal preparadas e se tornou obcecado por disciplina.',
    currentGoal:
      'Impedir que a ameaca alem dos portoes alcance civis e preparar a guarda para uma crise maior.',
    secret:
      'Reconheceu taticas recentes dos inimigos como semelhantes a um conflito que acreditava encerrado.'
  }
};

export function enrichNpcIdentity(
  npc: NpcEntity,
  state?: State
): NpcEntity {
  const fixed =
    FIXED[npc.id];

  const identityKey =
    npc.id +
    '|' +
    npc.name +
    '|' +
    npc.role;

  // Use um hash independente por atributo. Dois NPCs podem ter
  // hashes-base diferentes e ainda assim cair no mesmo resto de uma
  // lista curta; o sal por campo evita que essa colisao replique o
  // perfil inteiro de forma deterministica.
  const seedFor = (
    field: string
  ): number =>
    hashText(
      identityKey +
      '|' +
      field
    );

  npc.species =
    npc.species ||
    fixed?.species ||
    pick(
      SPECIES,
      seedFor('species')
    );

  npc.personality =
    npc.personality ||
    fixed?.personality ||
    pick(
      PERSONALITIES,
      seedFor('personality')
    );

  npc.history =
    npc.history ||
    fixed?.history ||
    pick(
      HISTORIES,
      seedFor('history')
    );

  npc.currentGoal =
    npc.currentGoal ||
    fixed?.currentGoal ||
    pick(
      GOALS,
      seedFor('goal')
    );

  npc.secret =
    npc.secret ||
    fixed?.secret ||
    pick(
      SECRETS,
      seedFor('secret')
    );

  npc.relationships =
    npc.relationships ||
    [];

  npc.memories =
    npc.memories ||
    [];

  /*
   * A identidade pode reagir ao mundo,
   * mas nao altera mecanica alguma.
   */
  if (
    state?.combat
  ) {
    npc.currentGoal =
      npc.currentGoal ||
      'Sobreviver ao conflito em andamento.';
  }

  return npc;
}

export function buildNpcFallbackReply(
  npc: NpcEntity,
  playerText: string
): {
  reply: string;
  choices: string[];
} {
  const text =
    String(
      playerText ||
      ''
    ).toLowerCase();

  let reply = '';

  if (
    text.includes('ajud') ||
    text.includes('precisa')
  ) {
    reply =
      npc.currentGoal ||
      npc.description;
  } else if (
    text.includes('hist') ||
    text.includes('passado')
  ) {
    reply =
      npc.history ||
      npc.description;
  } else if (
    text.includes('segredo') ||
    text.includes('esconde')
  ) {
    reply =
      'Ha coisas que eu nao conto a qualquer viajante. Confianca se constroi com tempo e atitudes, nao apenas perguntas.';
  } else {
    reply =
      (
        npc.dialogue?.[
          hashText(playerText) %
          Math.max(
            1,
            npc.dialogue?.length || 1
          )
        ] ||
        npc.description
      ) +
      ' ' +
      (
        npc.personality
          ? 'Minha forma de ver isso e simples: ' +
            npc.personality
              .split(';')[0]
              .toLowerCase() +
            '.'
          : ''
      );
  }

  return {
    reply:
      reply.trim(),

    choices: [
      'O que mudou por aqui nos ultimos dias?',
      'O que voce sabe sobre os perigos desta regiao?',
      'Conte-me algo sobre voce e sobre as pessoas daqui.'
    ]
  };
}

export const NPC_DIALOGUE_SYSTEM =
  `
Voce representa um NPC vivo dentro de Valdoria, sob direcao da GM IA.

REGRAS ABSOLUTAS:
- Fale SOMENTE como o NPC indicado.
- Nunca aja como narrador onisciente.
- Preserve personalidade, historia, objetivo, relacionamentos e memorias do NPC.
- O NPC conhece apenas aquilo que faria sentido ele conhecer.
- Segredos nao devem ser revelados sem confianca, contexto ou motivo plausivel.
- Considere acontecimentos recentes, regiao, campanha, economia e estado do mundo fornecidos.
- Nao altere PV, CA, dano, slots, ouro, inventario, XP, posicao ou qualquer regra.
- Nao conceda recompensas mecanicas. A engine e soberana.
- Um NPC pode mentir, hesitar, lembrar, desconfiar, criar opinioes e mudar de humor.
- Evite repetir a mesma saudacao e a mesma informacao a cada turno.
- Continue exatamente a conversa recebida.
- Responda em pt-BR natural e em personagem.

Retorne APENAS JSON valido:
{
  "reply": "fala do NPC",
  "choices": [
    "sugestao natural 1",
    "sugestao natural 2",
    "sugestao natural 3"
  ],
  "memory": "resumo curto do que este NPC deve lembrar desta conversa"
}
`;
