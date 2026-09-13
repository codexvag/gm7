import type {
  Character,
  State
} from './game-engine';

export type CampaignProofKey =
  | 'doran_talked'
  | 'elenor_talked'
  | 'kaelen_talked'
  | 'forest_cleared'
  | 'ruins_cleared'
  | 'malakor_defeated'
  | 'canyon_cleared'
  | 'ignisrax_defeated';

export const CAMPAIGN_PROOF_VERSION = 2;

function normalize(
  value: string
): string {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}

function partyMembers(
  state: State,
  hero: Character
): Character[] {
  if (!hero.partyId) {
    return [hero];
  }

  const result =
    state.characters.filter(
      (candidate) =>
        candidate.partyId ===
        hero.partyId
    );

  return result.length
    ? result
    : [hero];
}

export function getCampaignProof(
  hero: Character
): Record<
  CampaignProofKey,
  boolean
> {
  const raw =
    hero.campaignProof ||
    {};

  return {
    doran_talked:
      Boolean(
        raw.doran_talked
      ),

    elenor_talked:
      Boolean(
        raw.elenor_talked
      ),

    kaelen_talked:
      Boolean(
        raw.kaelen_talked
      ),

    forest_cleared:
      Boolean(
        raw.forest_cleared
      ),

    ruins_cleared:
      Boolean(
        raw.ruins_cleared
      ),

    malakor_defeated:
      Boolean(
        raw.malakor_defeated
      ),

    canyon_cleared:
      Boolean(
        raw.canyon_cleared
      ),

    ignisrax_defeated:
      Boolean(
        raw.ignisrax_defeated
      )
  };
}

function syncCompatibility(
  state: State,
  hero: Character
): void {
  const proof =
    getCampaignProof(hero);

  hero.questProgress =
    hero.questProgress ||
    {};

  hero.worldFlags =
    hero.worldFlags ||
    {};

  /*
   * Completion comes ONLY from proof.
   * Current map never completes a quest.
   */
  hero.questProgress.doran_talked =
    proof.doran_talked;

  hero.questProgress.elenor_talked =
    proof.elenor_talked;

  hero.questProgress.kaelen_talked =
    proof.kaelen_talked;

  hero.questProgress.forest_cleared =
    proof.forest_cleared;

  hero.questProgress.ruins_cleared =
    proof.ruins_cleared;

  hero.questProgress.malakor_defeated =
    proof.malakor_defeated;

  hero.questProgress.dungeon_cleared =
    proof.malakor_defeated;

  hero.questProgress.canyon_cleared =
    proof.canyon_cleared;

  hero.questProgress.ignisrax_defeated =
    proof.ignisrax_defeated;

  hero.questProgress.campaign_completed =
    proof.ignisrax_defeated;

  hero.worldFlags.expedition_unlocked =
    proof.kaelen_talked;

  hero.worldFlags.ruins_unlocked =
    proof.forest_cleared;

  hero.worldFlags.bridge_cleared =
    proof.forest_cleared;

  hero.worldFlags.trade_route_open =
    proof.forest_cleared;

  hero.worldFlags.catacombs_unsealed =
    proof.ruins_cleared;

  hero.worldFlags.dungeon_unlocked =
    proof.ruins_cleared;

  hero.worldFlags.abbey_cleared =
    proof.ruins_cleared;

  hero.worldFlags.malakor_defeated =
    proof.malakor_defeated;

  hero.worldFlags.canyon_unlocked =
    proof.malakor_defeated;

  hero.worldFlags.canyon_secured =
    proof.canyon_cleared;

  hero.worldFlags.dragon_lair_unlocked =
    proof.canyon_cleared;

  hero.worldFlags.ignisrax_defeated =
    proof.ignisrax_defeated;

  hero.worldFlags.campaign_completed =
    proof.ignisrax_defeated;

  hero.worldFlags.valdoria_saved =
    proof.ignisrax_defeated;

  hero.worldFlags.endgame_unlocked =
    proof.ignisrax_defeated;

  state.questProgress =
    state.questProgress ||
    {};

  state.worldFlags =
    state.worldFlags ||
    {};

  Object.assign(
    state.questProgress,
    {
      doran_talked:
        proof.doran_talked,

      elenor_talked:
        proof.elenor_talked,

      kaelen_talked:
        proof.kaelen_talked,

      forest_cleared:
        proof.forest_cleared,

      ruins_cleared:
        proof.ruins_cleared,

      dungeon_cleared:
        proof.malakor_defeated,

      malakor_defeated:
        proof.malakor_defeated,

      canyon_cleared:
        proof.canyon_cleared,

      ignisrax_defeated:
        proof.ignisrax_defeated,

      campaign_completed:
        proof.ignisrax_defeated
    }
  );
}

export function markCampaignProof(
  state: State,
  hero: Character,
  key: CampaignProofKey
): void {
  for (
    const member of
    partyMembers(
      state,
      hero
    )
  ) {
    member.campaignProof =
      member.campaignProof ||
      {};

    member.campaignProof[
      key
    ] =
      true;

    member.campaignProofVersion =
      CAMPAIGN_PROOF_VERSION;

    syncCompatibility(
      state,
      member
    );

    member.updatedAt =
      Date.now();
  }
}

function corpseNames(
  state: State
): string[] {
  return (
    state.corpses ||
    []
  ).map(
    (corpse) =>
      normalize(
        corpse.enemyName ||
        corpse.name
      )
  );
}

function deadEnemyNames(
  state: State
): string[] {
  return (
    state.enemies ||
    []
  )
    .filter(
      (enemy) =>
        enemy.hp <= 0
    )
    .map(
      (enemy) =>
        normalize(
          enemy.name
        )
    );
}

function hasName(
  names: string[],
  fragment: string
): boolean {
  const normalizedFragment =
    normalize(fragment);

  return names.some(
    (name) =>
      name.includes(
        normalizedFragment
      )
  );
}

export function rebuildCampaignProofFromEvidence(
  state: State,
  hero: Character
): boolean {
  const before =
    JSON.stringify(
      hero.campaignProof ||
      {}
    );

  hero.campaignProof =
    hero.campaignProof ||
    {};

  /*
   * Migration happens only once.
   * LOCATION IS NEVER USED AS EVIDENCE.
   */
  if (
    hero.campaignProofVersion !==
    CAMPAIGN_PROOF_VERSION
  ) {
    const logText =
      normalize(
        (
          state.logs ||
          []
        )
          .slice(-500)
          .map(
            (item) =>
              item.text
          )
          .join('\n')
      );

    const names =
      [
        ...corpseNames(
          state
        ),
        ...deadEnemyNames(
          state
        )
      ];

    const proof =
      hero.campaignProof;

    if (
      logText.includes(
        'anciao doran'
      ) ||
      logText.includes(
        'falar com doran'
      ) ||
      logText.includes(
        'missao de doran'
      )
    ) {
      proof.doran_talked =
        true;
    }

    if (
      logText.includes(
        'elenor entregou'
      ) ||
      logText.includes(
        'falar com elenor'
      ) ||
      logText.includes(
        'provisoes de elenor'
      )
    ) {
      proof.elenor_talked =
        true;
    }

    if (
      logText.includes(
        'portoes da vila foram abertos'
      ) ||
      logText.includes(
        'falar com kaelen'
      )
    ) {
      proof.kaelen_talked =
        true;
    }

    if (
      logText.includes(
        'rota da floresta dos sussurros foi assegurada'
      ) ||
      (
        hasName(
          names,
          'sentinela de cinzas'
        ) &&
        hasName(
          names,
          'lobo das sombras'
        )
      )
    ) {
      proof.forest_cleared =
        true;
    }

    if (
      logText.includes(
        'culto foi expulso das ruinas'
      ) ||
      logText.includes(
        'ruinas da abadia foi assegurada'
      ) ||
      (
        hasName(
          names,
          'fanatico do fogo negro'
        ) &&
        hasName(
          names,
          'arqueiro do culto'
        ) &&
        hasName(
          names,
          'cultista brutamontes'
        )
      )
    ) {
      proof.ruins_cleared =
        true;
    }

    if (
      hasName(
        names,
        'malakor'
      ) ||
      logText.includes(
        'malakor foi derrotado'
      ) ||
      logText.includes(
        'malakor tombou'
      )
    ) {
      proof.malakor_defeated =
        true;
    }

    if (
      logText.includes(
        'vanguarda draconica foi destruida'
      ) ||
      logText.includes(
        'passagem ate a cratera'
      ) ||
      (
        (
          hasName(
            names,
            'wyrmling vermelho da fenda'
          ) ||
          hasName(
            names,
            'wyrmling errante'
          )
        ) &&
        (
          hasName(
            names,
            'guerreiro draconiano'
          ) ||
          hasName(
            names,
            'draconiano da fenda'
          )
        )
      )
    ) {
      proof.canyon_cleared =
        true;
    }

    if (
      hasName(
        names,
        'ignisrax'
      ) ||
      logText.includes(
        'ignisrax tombou'
      ) ||
      logText.includes(
        'ignisrax foi derrotado'
      )
    ) {
      proof.ignisrax_defeated =
        true;
    }

    /*
     * A later REAL victory proves previous mandatory chapters.
     */

    if (
      proof.ignisrax_defeated
    ) {
      proof.canyon_cleared =
        true;
      proof.malakor_defeated =
        true;
      proof.ruins_cleared =
        true;
      proof.forest_cleared =
        true;
    }

    if (
      proof.canyon_cleared
    ) {
      proof.malakor_defeated =
        true;
      proof.ruins_cleared =
        true;
      proof.forest_cleared =
        true;
    }

    if (
      proof.malakor_defeated
    ) {
      proof.ruins_cleared =
        true;
      proof.forest_cleared =
        true;
    }

    if (
      proof.ruins_cleared
    ) {
      proof.forest_cleared =
        true;
    }

    /*
     * A real chapter victory proves the village prologue
     * happened in an old save.
     */
    if (
      proof.forest_cleared ||
      proof.ruins_cleared ||
      proof.malakor_defeated ||
      proof.canyon_cleared ||
      proof.ignisrax_defeated
    ) {
      proof.doran_talked =
        true;
      proof.elenor_talked =
        true;
      proof.kaelen_talked =
        true;
    }

    hero.campaignProofVersion =
      CAMPAIGN_PROOF_VERSION;
  }

  syncCompatibility(
    state,
    hero
  );

  const after =
    JSON.stringify(
      hero.campaignProof ||
      {}
    );

  return (
    before !== after
  );
}

export function getTravelPermissionFromProof(
  state: State,
  hero: Character,
  destination: number
): {
  allowed: boolean;
  reason?: string;
} {
  if (
    !Number.isInteger(
      destination
    ) ||
    destination < 0 ||
    destination > 5
  ) {
    return {
      allowed: false,
      reason:
        'Destino inv?lido.'
    };
  }

  if (
    destination === 0
  ) {
    return {
      allowed: true
    };
  }

  const current =
    hero.location ??
    0;

  /*
   * Backtracking stays possible.
   * It never completes quests.
   */
  if (
    destination <= current
  ) {
    return {
      allowed: true
    };
  }

  const proof =
    getCampaignProof(
      hero
    );

  if (
    destination === 1 &&
    !proof.kaelen_talked
  ) {
    return {
      allowed: false,
      reason:
        'Os port?es continuam fechados. Conclua o pr?logo com Doran, Elenor e Kaelen.'
    };
  }

  if (
    destination === 2 &&
    !proof.forest_cleared
  ) {
    return {
      allowed: false,
      reason:
        'Derrote a amea?a principal da Floresta antes de seguir ?s Ru?nas.'
    };
  }

  if (
    destination === 3 &&
    !proof.ruins_cleared
  ) {
    return {
      allowed: false,
      reason:
        'Expurgue as Ru?nas antes de entrar nas Catacumbas.'
    };
  }

  if (
    destination === 4 &&
    !proof.malakor_defeated
  ) {
    return {
      allowed: false,
      reason:
        'Malakor ainda controla as Catacumbas.'
    };
  }

  if (
    destination === 5 &&
    !proof.canyon_cleared
  ) {
    return {
      allowed: false,
      reason:
        'A vanguarda drac?nica ainda bloqueia a passagem ao Covil.'
    };
  }

  return {
    allowed: true
  };
}

export function getNextCampaignDestination(
  state: State,
  hero: Character
): {
  location: number | null;
  completed: boolean;
  reason: string;
} {
  rebuildCampaignProofFromEvidence(
    state,
    hero
  );

  const proof =
    getCampaignProof(
      hero
    );

  if (
    !proof.doran_talked
  ) {
    return {
      location: 0,
      completed: false,
      reason:
        'Fale com o Anci?o Doran para iniciar a campanha.'
    };
  }

  if (
    !proof.elenor_talked
  ) {
    return {
      location: 0,
      completed: false,
      reason:
        'Fale com Elenor e prepare suas provis?es.'
    };
  }

  if (
    !proof.kaelen_talked
  ) {
    return {
      location: 0,
      completed: false,
      reason:
        'Fale com o Capit?o Kaelen para abrir os port?es.'
    };
  }

  if (
    !proof.forest_cleared
  ) {
    return {
      location: 1,
      completed: false,
      reason:
        'Objetivo atual: Floresta dos Sussurros.'
    };
  }

  if (
    !proof.ruins_cleared
  ) {
    return {
      location: 2,
      completed: false,
      reason:
        'Objetivo atual: Ru?nas da Abadia.'
    };
  }

  if (
    !proof.malakor_defeated
  ) {
    return {
      location: 3,
      completed: false,
      reason:
        'Objetivo atual: derrotar Malakor nas Catacumbas.'
    };
  }

  if (
    !proof.canyon_cleared
  ) {
    return {
      location: 4,
      completed: false,
      reason:
        'Objetivo atual: destruir a vanguarda drac?nica no Desfiladeiro.'
    };
  }

  if (
    !proof.ignisrax_defeated
  ) {
    return {
      location: 5,
      completed: false,
      reason:
        'Objetivo atual: derrotar Ignisrax.'
    };
  }

  return {
    location: null,
    completed: true,
    reason:
      'Campanha principal conclu?da. O Mundo Persistente est? ativo.'
  };
}

export function isCampaignLocationCompleted(
  hero: Character,
  location: number
): boolean {
  const proof =
    getCampaignProof(
      hero
    );

  if (
    location === 0
  ) {
    return (
      proof.doran_talked &&
      proof.elenor_talked &&
      proof.kaelen_talked
    );
  }

  if (
    location === 1
  ) {
    return (
      proof.forest_cleared
    );
  }

  if (
    location === 2
  ) {
    return (
      proof.ruins_cleared
    );
  }

  if (
    location === 3
  ) {
    return (
      proof.malakor_defeated
    );
  }

  if (
    location === 4
  ) {
    return (
      proof.canyon_cleared
    );
  }

  if (
    location === 5
  ) {
    return (
      proof.ignisrax_defeated
    );
  }

  return false;
}
