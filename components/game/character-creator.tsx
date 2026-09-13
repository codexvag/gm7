// components/game/character-creator.tsx
'use client';

import React, { useState } from 'react';
import {
  Shield,
  Swords,
  Sparkles,
  Heart,
  Footprints,
  Dices,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  User,
  BookOpen,
  Award
} from 'lucide-react';
import {
  abilities,
  classes,
  species,
  skills,
  mod,
  prof,
  signed,
  newCharacter,
  calculateEquippedStats,
  getSpellSlotsForClass,
  POINT_BUY_COSTS,
  TOTAL_POINT_BUY_POINTS,
  calculatePointBuyScoreCost,
  calculateTotalPointBuyCost,
  type Character
} from '@/lib/game-engine';

import {
  SpellSelectionPanel
} from '@/components/game/spell-selection-panel';

import {
  buildLegacySpellString,
  validateInitialSpellSelection
} from '@/lib/srd-spellbook';

interface CharacterCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Character) => Promise<void> | void;
  busy?: boolean;
}

const SPECIES_TRAITS: Record<string, { desc: string; statsBonus: [number, number, number, number, number, number]; speed: number }> = {
  Humano: { desc: '+1 em todos os atributos. Versátil, ambicioso e determinado.', statsBonus: [1, 1, 1, 1, 1, 1], speed: 9 },
  Elfo: { desc: '+2 DES, +1 INT. Visão no Escuro, sentidos aguçados e imunidade a sono mágico.', statsBonus: [0, 2, 0, 1, 0, 0], speed: 9 },
  Anão: { desc: '+2 CON, +1 FOR. Visão no Escuro, resiliência contra venenos e +1 PV por nível.', statsBonus: [1, 0, 2, 0, 0, 0], speed: 7.5 },
  Pequenino: { desc: '+2 DES, +1 CAR. Sortudo (rerrola 1 no d20) e ágil entre os inimigos.', statsBonus: [0, 2, 0, 0, 0, 1], speed: 7.5 },
  Halfling: { desc: '+2 DES, +1 CAR. Sortudo (rerrola 1 no d20) e ágil entre os inimigos.', statsBonus: [0, 2, 0, 0, 0, 1], speed: 7.5 },
  Draconato: { desc: '+2 FOR, +1 CAR. Ancestralidade dracônica com arma de sopro elemental.', statsBonus: [2, 0, 0, 0, 0, 1], speed: 9 },
  Tiferino: { desc: '+2 CAR, +1 INT. Visão no Escuro e resistência inerente a chamas infernais.', statsBonus: [0, 0, 0, 1, 0, 2], speed: 9 },
  Tiefling: { desc: '+2 CAR, +1 INT. Visão no Escuro e resistência inerente a chamas infernais.', statsBonus: [0, 0, 0, 1, 0, 2], speed: 9 },
  Gnomo: { desc: '+2 INT, +1 CON. Astúcia Gnômica (vantagem em salvaguardas mentais) e Visão no Escuro.', statsBonus: [0, 0, 1, 2, 0, 0], speed: 7.5 },
  Golias: { desc: '+2 FOR, +1 CON. Constituição Poderosa (capacidade de carga dupla) e Resguardo de Pedra.', statsBonus: [2, 0, 1, 0, 0, 0], speed: 9 },
  Orc: { desc: '+2 FOR, +1 CON. Agressividade feroz e Resistência Implacável (cai a 1 PV ao invés de 0).', statsBonus: [2, 0, 1, 0, 0, 0], speed: 9 }
};

const CLASS_CONFIGS: Record<string, {
  hitDie: number;
  primaryStat: number;
  saves: [number, number];
  weapon: string;
  damage: string;
  armor: string;
  shield?: string;
  skillsCount: number;
  availableSkills: string[];
  slots: [number, number, number, number, number, number, number, number, number];
  features: string;
  spells?: string;
  spellAbility?: number;
}> = {
  Guerreiro: {
    hitDie: 10,
    primaryStat: 0,
    saves: [0, 2],
    weapon: 'espada-longa',
    damage: '1d8+3',
    armor: 'cota-de-malha',
    shield: 'escudo',
    skillsCount: 2,
    availableSkills: ['Atletismo', 'Acrobacia', 'Intimidação', 'Percepção', 'Sobrevivência', 'História'],
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Estilo de Luta (Defesa), Retomar o Fôlego (1d10+1 PV por descanso curto).',
    spells: ''
  },
  Mago: {
    hitDie: 6,
    primaryStat: 3,
    saves: [3, 4],
    weapon: 'cajado-runico',
    damage: '1d10',
    armor: '',
    skillsCount: 2,
    availableSkills: ['Arcanismo', 'História', 'Investigação', 'Intuição', 'Religião'],
    slots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Conjuração Arcana (INT), Recuperação Arcana de espaços de magia durante descanso.',
    spells: 'Raio de Fogo\nToque Chocante\nMísseis Mágicos\nMãos Flamejantes',
    spellAbility: 3
  },
  Clérigo: {
    hitDie: 8,
    primaryStat: 4,
    saves: [4, 5],
    weapon: 'espada-longa',
    damage: '1d8+2',
    armor: 'cota-de-malha',
    shield: 'escudo',
    skillsCount: 2,
    availableSkills: ['História', 'Intuição', 'Medicina', 'Persuasão', 'Religião'],
    slots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Domínio Divino (Vida), Canalizar Divindade, Preces Curativas.',
    spells: 'Chama Sagrada\nCurar Ferimentos',
    spellAbility: 4
  },
  Ladino: {
    hitDie: 8,
    primaryStat: 1,
    saves: [1, 3],
    weapon: 'rapieira',
    damage: '1d8+3',
    armor: 'armadura-de-couro',
    skillsCount: 4,
    availableSkills: ['Acrobacia', 'Atletismo', 'Enganação', 'Furtividade', 'Intimidação', 'Investigação', 'Percepção', 'Prestidigitação'],
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Ataque Furtivo (+1d6 em vantagem), Especialização em Perícias, Ação Ardilosa.',
    spells: ''
  },
  Paladino: {
    hitDie: 10,
    primaryStat: 0,
    saves: [4, 5],
    weapon: 'espada-longa',
    damage: '1d8+3',
    armor: 'cota-de-malha',
    shield: 'escudo',
    skillsCount: 2,
    availableSkills: ['Atletismo', 'Intuição', 'Intimidação', 'Medicina', 'Persuasão', 'Religião'],
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Sentido Divino, Cura pelas Mãos (5 PV), Destruição Divina.',
    spells: '',
    spellAbility: 5
  },
  Bárbaro: {
    hitDie: 12,
    primaryStat: 0,
    saves: [0, 2],
    weapon: 'espadão',
    damage: '2d6+3',
    armor: '',
    skillsCount: 2,
    availableSkills: ['Adestrar Animais', 'Atletismo', 'Intimidação', 'Natureza', 'Percepção', 'Sobrevivência'],
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Fúria (+2 dano corpo a corpo, resistência a impacto/corte/perfuração), Defesa sem Armadura (10+DES+CON).',
    spells: ''
  },
  Bardo: {
    hitDie: 8,
    primaryStat: 5,
    saves: [1, 5],
    weapon: 'rapieira',
    damage: '1d8+2',
    armor: 'armadura-de-couro',
    skillsCount: 3,
    availableSkills: ['Acrobacia', 'Atuação', 'Enganação', 'História', 'Intuição', 'Investigação', 'Percepção', 'Persuasão'],
    slots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Inspiração de Bardo (1d6), Conhecimento de Todas as Coisas, Canção de Descanso.',
    spells: 'Curar Ferimentos\nOnda Trovejante',
    spellAbility: 5
  },
  Bruxo: {
    hitDie: 8,
    primaryStat: 5,
    saves: [4, 5],
    weapon: 'adaga',
    damage: '1d4+2',
    armor: 'armadura-de-couro',
    skillsCount: 2,
    availableSkills: ['Arcanismo', 'Enganação', 'História', 'Intimidação', 'Investigação', 'Natureza', 'Religião'],
    slots: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Pacto Sobrenatural, Rajada Mística, Espaços de Magia restaurados em descanso curto.',
    spells: 'Rajada Mística\nToque Chocante',
    spellAbility: 5
  },
  Druida: {
    hitDie: 8,
    primaryStat: 4,
    saves: [3, 4],
    weapon: 'cajado-runico',
    damage: '1d6+1',
    armor: 'armadura-de-couro',
    shield: 'escudo',
    skillsCount: 2,
    availableSkills: ['Adestrar Animais', 'Arcanismo', 'Intuição', 'Medicina', 'Natureza', 'Percepção', 'Religião', 'Sobrevivência'],
    slots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Druídico, Conjuração Primitiva, Forma Selvagem.',
    spells: 'Curar Ferimentos\nOnda Trovejante',
    spellAbility: 4
  },
  Feiticeiro: {
    hitDie: 6,
    primaryStat: 5,
    saves: [2, 5],
    weapon: 'adaga',
    damage: '1d4+2',
    armor: '',
    skillsCount: 2,
    availableSkills: ['Arcanismo', 'Enganação', 'Intuição', 'Intimidação', 'Persuasão', 'Religião'],
    slots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Origem de Feitiçaria Inata, Fontes Arcanas de Poder e Metamagia.',
    spells: 'Raio de Fogo\nMísseis Mágicos',
    spellAbility: 5
  },
  Monge: {
    hitDie: 8,
    primaryStat: 1,
    saves: [0, 1],
    weapon: 'cajado-runico',
    damage: '1d6+2',
    armor: '',
    skillsCount: 2,
    availableSkills: ['Acrobacia', 'Atletismo', 'História', 'Intuição', 'Religião', 'Furtividade'],
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Artes Marciais (dano desarmado), Defesa sem Armadura (10+DES+SAB), Energia Ki.',
    spells: ''
  },
  Patrulheiro: {
    hitDie: 10,
    primaryStat: 1,
    saves: [0, 1],
    weapon: 'arco-longo',
    damage: '1d8+2',
    armor: 'armadura-de-couro',
    skillsCount: 3,
    availableSkills: ['Adestrar Animais', 'Atletismo', 'Furtividade', 'Intuição', 'Investigação', 'Natureza', 'Percepção', 'Sobrevivência'],
    slots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    features: 'Inimigo Favorito, Explorador Natural, Precisão com Arco e Rastreamento.',
    spells: '',
    spellAbility: 4
  }
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function CharacterCreator({ isOpen, onClose, onSave, busy }: CharacterCreatorProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Character Draft State
  const [name, setName] = useState('');
  const [chosenSpecies, setChosenSpecies] = useState('Humano');
  const [chosenClass, setChosenClass] = useState('Guerreiro');
  const [background, setBackground] = useState('Soldado');
  const [baseStats, setBaseStats] = useState<number[]>([15, 14, 13, 12, 10, 8]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Atletismo', 'Intimidação']);
  const [backstory, setBackstory] = useState('');

  const [
    selectedCantrips,
    setSelectedCantrips
  ] =
    useState<string[]>([]);

  const [
    selectedPreparedSpells,
    setSelectedPreparedSpells
  ] =
    useState<string[]>([]);

  const [
    selectedSpellbook,
    setSelectedSpellbook
  ] =
    useState<string[]>([]);

  if (!isOpen) return null;

  const speciesInfo = SPECIES_TRAITS[chosenSpecies] || SPECIES_TRAITS.Humano;
  const classInfo = CLASS_CONFIGS[chosenClass] || CLASS_CONFIGS.Guerreiro;

  const spellSelectionValidation =
    validateInitialSpellSelection(
      chosenClass,
      selectedCantrips,
      selectedPreparedSpells,
      selectedSpellbook
    );

  // Final attributes with racial bonus
  const finalStats = baseStats.map((val, idx) => val + speciesInfo.statsBonus[idx]);
  const conMod = mod(finalStats[2]);
  const maxHp = classInfo.hitDie + conMod;

  const handleToggleSkill = (skName: string) => {
    if (selectedSkills.includes(skName)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skName));
    } else {
      if (selectedSkills.length < classInfo.skillsCount) {
        setSelectedSkills([...selectedSkills, skName]);
      }
    }
  };

  const currentPointCost = calculateTotalPointBuyCost(baseStats);
  const remainingPoints = TOTAL_POINT_BUY_POINTS - currentPointCost;
  const isStep2Valid = remainingPoints >= 0 && baseStats.every((v) => v >= 8 && v <= 15);

  const handleIncreaseStat = (idx: number) => {
    const currentVal = baseStats[idx];
    if (currentVal >= 15) return;
    const nextVal = currentVal + 1;
    const costDiff = calculatePointBuyScoreCost(nextVal) - calculatePointBuyScoreCost(currentVal);
    if (remainingPoints < costDiff) return;
    const next = [...baseStats];
    next[idx] = nextVal;
    setBaseStats(next);
  };

  const handleDecreaseStat = (idx: number) => {
    const currentVal = baseStats[idx];
    if (currentVal <= 8) return;
    const next = [...baseStats];
    next[idx] = currentVal - 1;
    setBaseStats(next);
  };

  const handleApplyPreset = (stats: number[]) => {
    setBaseStats([...stats]);
  };

  const handleRollRandomStats = () => {
    // 4d6 drop lowest for 6 stats
    const rolled = Array.from({ length: 6 }, () => {
      const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      dice.sort((a, b) => b - a);
      return dice[0] + dice[1] + dice[2];
    });
    rolled.sort((a, b) => b - a);
    setBaseStats(rolled);
  };

  const handleFinish = async () => {
    if (!isStep2Valid) {
      alert('Distribuição de atributos excede o limite de 27 pontos ou possui atributos base fora do intervalo 8 a 15 permitido pelas regras oficiais de D&D 5e.');
      return;
    }
    const heroName = name.trim() || `Herói de ${chosenSpecies}`;
    const baseHero: Character = {
      ...newCharacter(),
      id: crypto.randomUUID(),
      name: heroName,
      className: chosenClass,
      species: chosenSpecies,
      background,
      level: 1,
      stats: finalStats as [number, number, number, number, number, number],
      skills: selectedSkills,
      saves: classInfo.saves,
      hp: maxHp,
      maxHp,
      speed: speciesInfo.speed,
      slots:
        getSpellSlotsForClass(
          chosenClass,
          1
        ),

      usedSlots:
        [0,0,0,0,0,0,0,0,0],
      features: `${speciesInfo.desc}\n\n${classInfo.features}`,
      knownCantrips:
        selectedCantrips,

      preparedSpells:
        selectedPreparedSpells,

      spellbook:
        selectedSpellbook,

      spellSelectionVersion:
        1,

      spells:
        buildLegacySpellString(
          selectedCantrips,
          selectedPreparedSpells,
          chosenClass,
          1
        ),
      spellAbility: classInfo.spellAbility !== undefined ? classInfo.spellAbility : 3,
      notes: backstory,
      equipment: {
        mainHand: classInfo.weapon,
        armor: classInfo.armor,
        offHand: classInfo.shield
      }
    };

    const calculatedHero = calculateEquippedStats(baseHero);
    await onSave(calculatedHero);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-3xl bg-zinc-950 border-2 border-amber-900/70 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-gradient-to-r from-zinc-950 to-zinc-900">
          <div className="flex items-center gap-2">
            <User size={20} className="text-amber-400" />
            <h2 className="font-serif font-bold text-amber-200 text-base sm:text-lg">
              Forjar Novo Aventureiro • Passo {step} de 5
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Tabs Indicator */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-zinc-800/80 text-xs font-semibold">
          {[
            { s: 1, label: 'Identidade & Classe' },
            { s: 2, label: 'Atributos' },
            { s: 3, label: 'Per?cias' },
            { s: 4, label: 'Magias' },
            { s: 5, label: 'Resumo' }
          ].map((item) => (
            <button
              key={item.s}
              onClick={() => setStep(item.s as any)}
              className={`flex items-center gap-1 transition-colors ${
                step === item.s
                  ? 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5'
                  : step > item.s
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">
                {item.s}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Wizard Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
          {step === 1 && (
            <div className="space-y-4 animate-slide-up">
              <div>
                <label className="block text-xs uppercase tracking-wider text-amber-400 font-bold mb-1">
                  Nome do Personagem
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Valerius, o Destemido"
                  maxLength={50}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:border-amber-400 outline-none"
                />
              </div>

              {/* Species Selection */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                  Escolha a Espécie
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {species.map((sp) => (
                    <button
                      key={sp}
                      onClick={() => setChosenSpecies(sp)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        chosenSpecies === sp
                          ? 'border-amber-400 bg-amber-950/40 text-amber-200 shadow-lg'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <strong className="block text-sm">{sp}</strong>
                      <span className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                        {SPECIES_TRAITS[sp]?.desc || 'Aventureiro de Valdoria.'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Selection */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                  Escolha a Classe
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.keys(CLASS_CONFIGS).map((cl) => (
                    <button
                      key={cl}
                      onClick={() => {
                        setChosenClass(cl);

                        setSelectedSkills(
                          CLASS_CONFIGS[
                            cl
                          ].availableSkills.slice(
                            0,
                            CLASS_CONFIGS[
                              cl
                            ].skillsCount
                          )
                        );

                        setSelectedCantrips(
                          []
                        );

                        setSelectedPreparedSpells(
                          []
                        );

                        setSelectedSpellbook(
                          []
                        );
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        chosenClass === cl
                          ? 'border-amber-400 bg-amber-950/40 text-amber-200 shadow-lg'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="block text-sm">{cl}</strong>
                        <span className="text-[10px] font-mono text-amber-400">d{CLASS_CONFIGS[cl].hitDie}</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                        {CLASS_CONFIGS[cl].features}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-slide-up">
              {/* Header with Title and Point Buy Budget Counter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-zinc-900/80 border border-amber-900/60 rounded-2xl">
                <div>
                  <h3 className="text-sm font-bold text-amber-200 flex items-center gap-1.5">
                    <Sparkles size={16} className="text-amber-400" />
                    Atributos • Compra de Pontos (D&D 5e)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Bônus de {chosenSpecies} somados. Base de 8 a 15 (8-13 custam 1 pt, 14-15 custam 2 pts).
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center justify-between sm:justify-end gap-2 border self-start sm:self-auto ${
                  remainingPoints === 0
                    ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                    : remainingPoints > 0
                    ? 'bg-amber-950/70 border-amber-500/60 text-amber-300'
                    : 'bg-red-950/70 border-red-500/60 text-red-300'
                }`}>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-300">Pontos Restantes:</span>
                  <span className="text-sm font-black">{remainingPoints} / 27</span>
                </div>
              </div>

              {/* Quick Preset Buttons (Standard Array & Class Archetypes) */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                  Distribuição Rápida (Exatamente 27 Pontos)
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([15, 14, 13, 12, 10, 8])}
                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg transition-colors font-medium"
                    title="Matriz Padrão clássica D&D 5e: 15, 14, 13, 12, 10, 8"
                  >
                    Matriz Padrão [15,14,13,12,10,8]
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([15, 13, 14, 8, 12, 10])}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-lg transition-colors text-[11px]"
                    title="Foco em Força e Constituição (Guerreiro / Bárbaro / Paladino)"
                  >
                    Físico (FOR)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([10, 15, 14, 12, 13, 8])}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-lg transition-colors text-[11px]"
                    title="Foco em Destreza e Agilidade (Ladino / Patrulheiro / Monge)"
                  >
                    Ágil (DES)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([8, 14, 13, 15, 12, 10])}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-lg transition-colors text-[11px]"
                    title="Foco em Intelecto e Magia (Mago)"
                  >
                    Mental (INT)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([12, 10, 14, 8, 15, 13])}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-lg transition-colors text-[11px]"
                    title="Foco em Sabedoria e Fé (Clérigo / Druida)"
                  >
                    Divino (SAB)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([8, 14, 13, 10, 12, 15])}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-lg transition-colors text-[11px]"
                    title="Foco em Carisma e Presença (Bardo / Feiticeiro / Bruxo)"
                  >
                    Carisma (CAR)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([8, 8, 8, 8, 8, 8])}
                    className="px-2 py-1 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded-lg transition-colors text-[11px]"
                    title="Resetar todos os atributos base para 8 (27 pontos livres)"
                  >
                    Resetar (8)
                  </button>
                </div>
              </div>

              {/* 6 Attribute Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {abilities.map((abName, idx) => {
                  const baseVal = baseStats[idx];
                  const racial = speciesInfo.statsBonus[idx];
                  const total = baseVal + racial;
                  const m = mod(total);
                  const costCurrent = POINT_BUY_COSTS[baseVal] ?? 0;
                  const incCost = baseVal < 15 ? (POINT_BUY_COSTS[baseVal + 1] - POINT_BUY_COSTS[baseVal]) : 0;
                  const canIncrease = baseVal < 15 && remainingPoints >= incCost;
                  const canDecrease = baseVal > 8;

                  return (
                    <div
                      key={abName}
                      className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col items-center gap-1 shadow-md hover:border-zinc-700 transition-colors"
                    >
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        {abName}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canDecrease}
                          onClick={() => handleDecreaseStat(idx)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                            canDecrease
                              ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 active:scale-95 shadow cursor-pointer'
                              : 'bg-zinc-900/60 text-zinc-600 cursor-not-allowed border border-zinc-800'
                          }`}
                          title={canDecrease ? `Diminuir ${abName} (devolve pontos)` : 'Mínimo de 8 atingido (regra oficial D&D 5e)'}
                        >
                          -
                        </button>
                        <span className="font-serif font-black text-2xl text-amber-300 w-9 text-center">
                          {total}
                        </span>
                        <button
                          type="button"
                          disabled={!canIncrease}
                          onClick={() => handleIncreaseStat(idx)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                            canIncrease
                              ? 'bg-zinc-800 text-zinc-200 hover:bg-amber-900/50 hover:text-amber-200 active:scale-95 shadow cursor-pointer'
                              : 'bg-zinc-900/60 text-zinc-600 cursor-not-allowed border border-zinc-800'
                          }`}
                          title={
                            baseVal >= 15
                              ? 'Máximo de 15 base atingido (regra oficial D&D 5e)'
                              : !canIncrease
                              ? `Pontos insuficientes (requer +${incCost} pts)`
                              : `Aumentar ${abName} (custa ${incCost} pt${incCost > 1 ? 's' : ''})`
                          }
                        >
                          +
                        </button>
                      </div>

                      <div className="flex flex-col items-center gap-0.5 text-[10px] text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <span>Mod: <strong className="text-zinc-200 font-bold">{signed(m)}</strong></span>
                          {racial > 0 && <span className="text-emerald-400 font-semibold">+{racial} raça</span>}
                        </div>
                        <span className="text-zinc-500 font-mono">
                          Base: {baseVal} ({costCurrent} pts)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status and Summary */}
              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-around text-xs font-mono text-zinc-300">
                <span className="flex items-center gap-1">
                  <Heart size={14} className="text-red-400" /> PV Máximos: <strong>{maxHp}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Footprints size={14} className="text-amber-400" /> Deslocamento: <strong>{speciesInfo.speed}m</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Award size={14} className="text-cyan-400" /> Bônus Proficiência: <strong>+2</strong>
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-slide-up">
              <div>
                <h3 className="text-sm font-bold text-zinc-200">
                  Perícias de {chosenClass} (Escolha até {classInfo.skillsCount})
                </h3>
                <p className="text-xs text-zinc-400">
                  Selecionadas: {selectedSkills.length} de {classInfo.skillsCount}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {classInfo.availableSkills.map((skName) => {
                  const isSelected = selectedSkills.includes(skName);
                  return (
                    <button
                      key={skName}
                      onClick={() => handleToggleSkill(skName)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 font-bold'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <span>{skName}</span>
                      {isSelected ? <Check size={14} className="text-emerald-400" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">
                  Antecedente & História
                </label>
                <textarea
                  rows={3}
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  placeholder="Descreva a origem, motivação ou votos sagrados do seu herói..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-200 focus:border-amber-400 outline-none resize-none"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-slide-up">
              <SpellSelectionPanel
                className={chosenClass}
                selectedCantrips={selectedCantrips}
                selectedPrepared={selectedPreparedSpells}
                selectedSpellbook={selectedSpellbook}
                onCantripsChange={setSelectedCantrips}
                onPreparedChange={setSelectedPreparedSpells}
                onSpellbookChange={setSelectedSpellbook}
              />

              {!spellSelectionValidation.ok && (
                <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200 leading-relaxed">
                  {spellSelectionValidation.reason}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-slide-up">
              <div className="p-4 bg-gradient-to-br from-zinc-900 to-black border border-amber-900/60 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-black text-xl text-amber-200">
                    {name.trim() || 'Herói sem Nome'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {chosenSpecies} • {chosenClass} Nível 1 • {background}
                  </p>
                </div>
                <div className="text-right font-mono text-xs text-zinc-300">
                  <span className="block text-red-400 font-bold">{maxHp} PV</span>
                  <span className="block text-amber-300 font-bold">{classInfo.shield ? 'CA 18' : 'CA 13+'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">Equipamento Padrão</span>
                  <p className="text-zinc-200 capitalize font-medium">{classInfo.weapon.replace('-', ' ')}</p>
                  {classInfo.armor && <p className="text-zinc-300 capitalize">{classInfo.armor.replace('-', ' ')}</p>}
                  {classInfo.shield && <p className="text-zinc-300 capitalize">Escudo de Aço (+2 CA)</p>}
                </div>
                <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">Perícias Treinadas</span>
                  <p className="text-zinc-200">{selectedSkills.join(', ') || 'Nenhuma'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 bg-zinc-950">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-colors"
            >
              <ChevronLeft size={14} /> Voltar
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              disabled={(step === 2 && !isStep2Valid) || (step === 4 && !spellSelectionValidation.ok)}
              onClick={() => setStep((step + 1) as any)}
              className={`flex items-center gap-1 text-xs py-1.5 px-4 rounded-xl font-bold transition-all ${
                step === 2 && !isStep2Valid
                  ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800'
                  : 'gold-button'
              }`}
              title={step === 2 && !isStep2Valid ? 'Distribua os pontos dentro do limite oficial de 27 pts (D&D 5e)' : ''}
            >
              Próximo <ChevronRight size={14} />
            </button>
          ) : (
            <button
              disabled={busy || !isStep2Valid || !spellSelectionValidation.ok}
              onClick={handleFinish}
              className={`flex items-center gap-1.5 text-xs py-2 px-5 font-bold shadow-lg rounded-xl transition-all ${
                busy || !isStep2Valid
                  ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800'
                  : 'gold-button'
              }`}
            >
              <Sparkles size={14} /> {busy ? 'Forjando…' : 'Concluir & Jogar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
