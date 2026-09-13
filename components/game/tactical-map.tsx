// components/game/tactical-map.tsx
'use client';

import {
  getCreatureProfile
} from '@/lib/creature-profiles';


function getEnemyTokenVisual(
  name: string
) {
  const profile =
    getCreatureProfile(
      name
    );

  if (
    profile.aiStyle ===
    'dragon'
  ) {
    return {
      glyph:
        profile.tokenGlyph ||
        '??',
      bg:
        'bg-gradient-to-br from-orange-500 via-red-800 to-black',
      ring:
        'ring-orange-400/90'
    };
  }

  if (
    profile.aiStyle ===
    'boss'
  ) {
    return {
      glyph:
        profile.tokenGlyph ||
        '??',
      bg:
        'bg-gradient-to-br from-purple-500 via-violet-950 to-black',
      ring:
        'ring-purple-400/90'
    };
  }

  if (
    profile.aiStyle ===
    'caster'
  ) {
    return {
      glyph:
        profile.tokenGlyph ||
        '??',
      bg:
        'bg-gradient-to-br from-violet-600 via-indigo-950 to-black',
      ring:
        'ring-violet-400/80'
    };
  }

  if (
    profile.aiStyle ===
    'skirmisher'
  ) {
    return {
      glyph:
        profile.tokenGlyph ||
        '??',
      bg:
        'bg-gradient-to-br from-zinc-500 via-slate-800 to-black',
      ring:
        'ring-slate-300/80'
    };
  }

  if (
    profile.aiStyle ===
    'guardian'
  ) {
    return {
      glyph:
        profile.tokenGlyph ||
        '???',
      bg:
        'bg-gradient-to-br from-stone-500 via-zinc-900 to-black',
      ring:
        'ring-stone-300/80'
    };
  }

  return {
    glyph:
      profile.tokenGlyph ||
      '??',
    bg:
      'bg-gradient-to-br from-red-700 via-red-950 to-black',
    ring:
      'ring-red-500/80'
  };
}

function DndTokens({
  displayHeroes,
  enemies,
  npcs,
  corpses,
  onLootCorpse,
  currentBiome,
  gridSize,
  selectedHeroId,
  selectedEnemyId,
  activeTurnId,
  targetingAction,
  isCombat,
  activeVfx,
  tokenRecoils,
  slashVfx,
  healVfx,
  lootSparkles,
  contextEnemy,
  setContextEnemy,
  onSelectToken,
  onTargetEnemy,
  onTargetHero,
  onTargetSquare,
  onTalkNpc,
  onInteractPlayer,
  currentHeroX,
  currentHeroY
}: any) {
  const getStatusClass = (condition: string) => {
    const c = condition.toLowerCase();
    if (c.includes('envenenad') || c.includes('poison')) return 'status-poisoned';
    if (c.includes('queimand') || c.includes('burn') || c.includes('fogo')) return 'status-burning';
    if (c.includes('congelad') || c.includes('frozen') || c.includes('gelo')) return 'status-frozen';
    if (c.includes('atordoad') || c.includes('stun')) return 'status-stunned';
    if (c.includes('abençoad') || c.includes('bless')) return 'status-blessed';
    if (c.includes('invisível') || c.includes('invisible')) return 'status-invisible';
    return '';
  };
  const getStatusDotColor = (condition: string) => {
    const c = condition.toLowerCase();
    if (c.includes('envenenad') || c.includes('poison')) return 'bg-green-400';
    if (c.includes('queimand') || c.includes('burn')) return 'bg-orange-400';
    if (c.includes('congelad') || c.includes('frozen')) return 'bg-sky-300';
    if (c.includes('atordoad') || c.includes('stun')) return 'bg-yellow-400';
    if (c.includes('abençoad') || c.includes('bless')) return 'bg-amber-300';
    if (c.includes('invisível') || c.includes('invisible')) return 'bg-zinc-400';
    return 'bg-zinc-500';
  };

  const isInRange = (x: number, y: number) => {
    const dist = Math.max(Math.abs(currentHeroX - x), Math.abs(currentHeroY - y));
    if (targetingAction) return dist <= targetingAction.rangeSquares;
    return dist <= 1;
  };

  const getRecoilStyle = (id: string) => {
    const recoil = tokenRecoils?.[id];
    if (!recoil) return undefined;
    const isCrit = recoil.type === 'crit';
    const isMiss = recoil.type === 'miss';
    const isHeal = recoil.type === 'heal';
    return {
      transform: `translate(${recoil.dx}px, ${recoil.dy}px) ${isCrit ? 'scale(1.25)' : isMiss ? 'scale(0.92)' : isHeal ? 'scale(1.12)' : 'scale(1.08)'}`,
      filter: isCrit
        ? 'brightness(2.2) drop-shadow(0 0 16px rgba(239,68,68,1)) drop-shadow(0 0 25px rgba(245,158,11,0.9))'
        : isHeal
        ? 'brightness(1.6) drop-shadow(0 0 16px rgba(52,211,153,0.95))'
        : isMiss
        ? 'brightness(1.2) drop-shadow(0 0 8px rgba(147,197,253,0.8))'
        : 'brightness(1.8) drop-shadow(0 0 12px rgba(239,68,68,0.9))',
      transition: 'transform 70ms cubic-bezier(0.1, 0.9, 0.2, 1), filter 70ms ease'
    };
  };

  const visibleHeroes = (displayHeroes || []).filter((hero: any) => {
    if (!hero) return false;
    if (currentBiome === 'village') return !hero.biome || hero.biome === 'village';
    return hero.biome === currentBiome;
  });

  const selectedHero = (displayHeroes || []).find((h: any) => h.id === selectedHeroId);
  const visibleEnemies = (enemies || []).filter((enemy: any) => {
    if (!enemy || enemy.hp <= 0) return false;
    if (currentBiome === 'village') return false;
    const enemyBiome = enemy.biome || 'forest';
    if (enemyBiome !== currentBiome) return false;
    if (selectedHero?.partyId && enemy.partyId && enemy.partyId !== selectedHero.partyId) return false;
    if (!selectedHero?.partyId && enemy.ownerCharId && enemy.ownerCharId !== selectedHero?.id) return false;
    return true;
  });

  return (
    <>
      {visibleHeroes.map((hero: any) => {
        const isSelected = hero.id === selectedHeroId;
        const isActiveTurn = isCombat && (hero.id === activeTurnId);
        const hpRatio = hero.hp / hero.maxHp;
        const conditions = hero.conditions || [];
        const statusClasses = conditions.map((c: string) => getStatusClass(c)).filter(Boolean).join(' ');
        
        const leftPerc = (hero.x / gridSize) * 100;
        const topPerc = (hero.y / gridSize) * 100;
        const sizePerc = 100 / gridSize;
        const recoilStyle = getRecoilStyle(hero.id);

        if (hero.hp <= 0) {
          return (
            <div key={hero.id}
                 style={{ left: leftPerc + '%', top: topPerc + '%', width: sizePerc + '%', height: sizePerc + '%', transition: 'left 340ms linear, top 340ms linear' }}
                 className="absolute flex items-center justify-center pointer-events-auto"
                 onClick={(e) => {
                   e.stopPropagation();
                   if (targetingAction) {
                     if (
                       (
                         targetingAction.targetMode === 'area' ||
                         targetingAction.targetMode === 'point'
                       ) &&
                       onTargetSquare &&
                       isInRange(hero.x, hero.y)
                     ) {
                       onTargetSquare(hero.x, hero.y);
                     } else if (
                       (
                         targetingAction.targetMode === 'ally' ||
                         targetingAction.targetMode === 'self'
                       ) &&
                       onTargetHero
                     ) {
                       onTargetHero(hero.id);
                     } else {
                       onSelectToken('hero', hero.id);
                     }
                   } else if (onInteractPlayer && hero.id !== selectedHeroId) {
                     onInteractPlayer(hero);
                   } else {
                     onSelectToken('hero', hero.id);
                   }
                 }}>
              <div className="relative w-[85%] h-[85%] max-w-[36px] max-h-[36px] rounded-full flex flex-col items-center justify-center ring-2 ring-red-700 bg-gradient-to-br from-zinc-950 via-red-950 to-black grayscale opacity-80 shadow-lg cursor-pointer">
                <span className="text-sm select-none drop-shadow">💀</span>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-950 border border-red-700 text-red-300 font-mono text-[7px] px-1 rounded-full uppercase tracking-tight whitespace-nowrap z-20">0 PV</div>
              </div>
            </div>
          );
        }

        let ringColor = 'ring-amber-600/70';
        let bgGradient = 'from-[#2d2417] via-[#1a1711] to-black';
        if (hero.className === 'Mago' || hero.className === 'Feiticeiro') { ringColor = 'ring-purple-600/70'; bgGradient = 'from-[#2d172d] via-[#1a111a] to-black'; }
        if (hero.className === 'Ladino') { ringColor = 'ring-zinc-600/70'; bgGradient = 'from-[#1a1a1a] via-[#111] to-black'; }
        if (hero.className === 'Clérigo' || hero.className === 'Paladino') { ringColor = 'ring-yellow-500/70'; bgGradient = 'from-[#3a3015] via-[#221c0b] to-black'; }
        if (hero.className === 'Druida' || hero.className === 'Patrulheiro') { ringColor = 'ring-emerald-600/70'; bgGradient = 'from-[#172d1a] via-[#0f1d11] to-black'; }

        return (
          <div key={hero.id}
               style={{ left: leftPerc + '%', top: topPerc + '%', width: sizePerc + '%', height: sizePerc + '%', transition: 'left 340ms linear, top 340ms linear', zIndex: isActiveTurn ? 40 : 30 }}
               className="absolute flex items-center justify-center pointer-events-auto group"
               onClick={(e) => {
                 e.stopPropagation();
                 if (targetingAction) {
                     if (
                       (
                         targetingAction.targetMode === 'area' ||
                         targetingAction.targetMode === 'point'
                       ) &&
                       onTargetSquare &&
                       isInRange(hero.x, hero.y)
                     ) {
                       onTargetSquare(hero.x, hero.y);
                     } else if (
                       (
                         targetingAction.targetMode === 'ally' ||
                         targetingAction.targetMode === 'self'
                       ) &&
                       onTargetHero
                     ) {
                       onTargetHero(hero.id);
                     } else {
                       onSelectToken('hero', hero.id);
                     }
                   } else if (onInteractPlayer && hero.id !== selectedHeroId) {
                     onInteractPlayer(hero);
                   } else {
                     onSelectToken('hero', hero.id);
                   }
               }}>
            <div style={recoilStyle} className={`relative w-[85%] h-[85%] max-w-[42px] max-h-[42px] rounded-full flex flex-col items-center justify-center cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.6)] transition-transform ${hero.isWalking ? 'token-walking-active scale-110' : 'token-human-sway hover:scale-105'} ${isActiveTurn ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-black scale-115 shadow-[0_0_25px_rgba(251,191,36,0.9)] token-selected-pulse' : isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black scale-110 token-selected-pulse' : `ring-2 ${ringColor}`} bg-gradient-to-br ${bgGradient} ${statusClasses}`}>
              <div className="absolute inset-[2px] rounded-full border border-white/10 pointer-events-none" />
              {isActiveTurn && <div className="absolute -inset-2 rounded-full border-2 border-amber-400 animate-ping opacity-60 pointer-events-none" />}
              {isActiveTurn && <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-black font-black text-[8px] px-1.5 rounded-full uppercase tracking-wider shadow-lg z-30 animate-pulse pointer-events-none whitespace-nowrap">VEZ</div>}
              {activeVfx?.[hero.id] && <div className={activeVfx[hero.id]} />}
              {slashVfx?.[hero.id] && (
                <div className="absolute -inset-4 pointer-events-none z-45 flex items-center justify-center animate-slash-sweep">
                  <div className="w-16 h-1.5 bg-gradient-to-r from-transparent via-amber-200 to-transparent shadow-[0_0_20px_rgba(251,191,36,1)] rounded-full rotate-[-45deg] scale-125" />
                </div>
              )}
              {healVfx?.[hero.id] && (
                <div className="absolute -inset-3 pointer-events-none z-45 flex items-center justify-center heal-rise-anim">
                  <div className="w-full h-full rounded-full border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.95)] animate-ping" />
                  <span className="absolute -top-4 font-black text-xs text-emerald-300 drop-shadow">+PV</span>
                </div>
              )}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[130%] max-w-[42px] h-[5px] bg-black/95 rounded-full border border-zinc-500/80 overflow-hidden shadow-lg z-20">
                <div style={{ width: `${Math.min(100, hpRatio * 100)}%` }} className={`h-full transition-all duration-500 ease-out ${hpRatio > 0.5 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : hpRatio > 0.2 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`} />
              </div>
              {(isSelected || isActiveTurn) && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-amber-500/60 px-1.5 rounded text-[9px] font-mono font-bold text-amber-200 whitespace-nowrap z-30 shadow-md pointer-events-none">{hero.hp}/{hero.maxHp}</div>
              )}
              {conditions.length > 0 && (
                <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                  {conditions.slice(0, 3).map((c: string, i: number) => <div key={i} className={`w-[6px] h-[6px] rounded-full ${getStatusDotColor(c)} shadow-sm border border-black`} title={c} />)}
                </div>
              )}
              <span className="font-serif font-black text-sm text-amber-100 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{hero.name[0]}</span>
            </div>
          </div>
        );
      })}

      {visibleEnemies.map((enemy: any) => {
        const isSelected = enemy.id === selectedEnemyId;
        const isActiveTurn = isCombat && (enemy.id === activeTurnId);
        const hpRatio = enemy.hp / enemy.maxHp;
        const conditions = enemy.conditions || [];
        const statusClasses = conditions.map((c: string) => getStatusClass(c)).filter(Boolean).join(' ');
        const isTargeted = targetingAction && isInRange(enemy.x, enemy.y);

        /*
         * Ultima barreira visual:
         * mesmo um save legado nunca desenha inimigo fora do canvas.
         */
        const safeEnemyX =
          Math.max(
            0,
            Math.min(
              gridSize - 1,
              Number(enemy.x) || 0
            )
          );

        const safeEnemyY =
          Math.max(
            0,
            Math.min(
              gridSize - 1,
              Number(enemy.y) || 0
            )
          );

        const leftPerc =
          (safeEnemyX / gridSize) * 100;

        const topPerc =
          (safeEnemyY / gridSize) * 100;
        const sizePerc = 100 / gridSize;
        const recoilStyle = getRecoilStyle(enemy.id);
        const visual = getEnemyTokenVisual(enemy.name);

        return (
          <div key={enemy.id}
               style={{ left: leftPerc + '%', top: topPerc + '%', width: sizePerc + '%', height: sizePerc + '%', transition: 'left 340ms linear, top 340ms linear', zIndex: isActiveTurn ? 35 : 25 }}
               className="absolute flex items-center justify-center pointer-events-auto"
               onClick={(e) => {
                 e.stopPropagation();
                 onSelectToken('enemy', enemy.id);
                 setContextEnemy(enemy);

                 if (
                   targetingAction &&
                   (
                     targetingAction.targetMode === 'area' ||
                     targetingAction.targetMode === 'point'
                   ) &&
                   onTargetSquare &&
                   isInRange(enemy.x, enemy.y)
                 ) {
                   onTargetSquare(
                     enemy.x,
                     enemy.y
                   );
                 } else if (isTargeted) {
                   onTargetEnemy(enemy.id);
                 } else if (isInRange(enemy.x, enemy.y)) {
                   onTargetEnemy(enemy.id);
                 }
               }}>
            <div style={recoilStyle} className={`relative w-[85%] h-[85%] max-w-[42px] max-h-[42px] rounded-full flex flex-col items-center justify-center cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.6)] token-human-sway ${isActiveTurn ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-black scale-115 shadow-[0_0_25px_rgba(239,68,68,0.9)] token-target-pulse' : isSelected ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-black scale-110 token-target-pulse' : isTargeted ? 'ring-2 ring-amber-400/80 ring-offset-1 ring-offset-black scale-105 animate-pulse' : 'ring-[1.5px] ring-red-700/80 hover:scale-105'} ${visual.bg} ${visual.ring} transition-transform ${statusClasses}`}>
              <div className="absolute inset-[1px] rounded-full border border-red-500/30 pointer-events-none" />
              {isActiveTurn && <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-ping opacity-60 pointer-events-none" />}
              {isActiveTurn && <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-[8px] px-1.5 rounded-full uppercase tracking-wider shadow-lg z-30 animate-pulse pointer-events-none whitespace-nowrap">VEZ</div>}
              {activeVfx?.[enemy.id] && <div className={activeVfx[enemy.id]} />}
              {slashVfx?.[enemy.id] && (
                <div className="absolute -inset-4 pointer-events-none z-45 flex items-center justify-center animate-slash-sweep">
                  <div className="w-16 h-1.5 bg-gradient-to-r from-transparent via-amber-200 to-transparent shadow-[0_0_20px_rgba(251,191,36,1)] rounded-full rotate-[-45deg] scale-125" />
                </div>
              )}
              {healVfx?.[enemy.id] && (
                <div className="absolute -inset-3 pointer-events-none z-45 flex items-center justify-center heal-rise-anim">
                  <div className="w-full h-full rounded-full border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.95)] animate-ping" />
                  <span className="absolute -top-4 font-black text-xs text-emerald-300 drop-shadow">+PV</span>
                </div>
              )}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[130%] max-w-[42px] h-[5px] bg-black/95 rounded-full border border-zinc-500/80 overflow-hidden shadow-lg z-20">
                <div style={{ width: `${Math.min(100, hpRatio * 100)}%` }} className={`h-full transition-all duration-500 ease-out ${hpRatio > 0.5 ? 'bg-gradient-to-r from-red-500 to-rose-400' : hpRatio > 0.2 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-red-700 to-red-500'}`} />
              </div>
              {isSelected && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-red-600/60 px-1.5 rounded text-[9px] font-mono font-bold text-red-200 whitespace-nowrap z-30 shadow-md pointer-events-none">{enemy.hp}/{enemy.maxHp}</div>
              )}
              {conditions.length > 0 && (
                <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                  {conditions.slice(0, 3).map((c: string, i: number) => <div key={i} className={`w-[6px] h-[6px] rounded-full ${getStatusDotColor(c)} shadow-sm border border-black`} title={c} />)}
                </div>
              )}
              {isTargeted && <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/70 animate-spin-slow pointer-events-none z-15" />}
              <span className="font-serif font-black text-sm text-red-200 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{visual.glyph}</span>
            </div>
          </div>
        );
      })}

      {/* LOOT SPARKLES POPPING ANIMATION OVER RECENTLY LOOTED TILES */}
      {(lootSparkles || []).map((sp: any) => {
        const leftP = (sp.x / gridSize) * 100;
        const topP = (sp.y / gridSize) * 100;
        return (
          <div
            key={sp.id}
            style={{ left: `${leftP}%`, top: `${topP}%` }}
            className="absolute z-50 pointer-events-none loot-sparkle-anim flex flex-col items-center"
          >
            <span className="text-xl filter drop-shadow-[0_0_12px_rgba(245,158,11,1)]">✨🪙✨</span>
          </div>
        );
      })}

      {(npcs || [])
        .filter((npc: any) => {
          if (npc.biome) return npc.biome === currentBiome;
          return currentBiome === 'village';
        })
        .map((npc: any) => {
          const dist = Math.max(Math.abs(currentHeroX - (npc.x || 0)), Math.abs(currentHeroY - (npc.y || 0)));
          const isNear = dist <= 1;
          const leftPerc = ((npc.x || 0) / gridSize) * 100;
          const topPerc = ((npc.y || 0) / gridSize) * 100;
          const sizePerc = 100 / gridSize;

          return (
            <div key={npc.id}
                 style={{ left: leftPerc + '%', top: topPerc + '%', width: sizePerc + '%', height: sizePerc + '%', transition: 'left 340ms linear, top 340ms linear', zIndex: 20 }}
                 className="absolute flex items-center justify-center pointer-events-auto"
                 onClick={(e) => {
                   e.stopPropagation();
                   if (isNear) onTalkNpc?.(npc.id);
                 }}>
              <div className={`relative w-[80%] h-[80%] max-w-[36px] max-h-[36px] rounded-full flex flex-col items-center justify-center cursor-pointer transition-all ${isNear ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black npc-talk-glow shadow-[0_0_18px_rgba(245,158,11,0.7)] scale-105' : 'ring-[1.5px] ring-emerald-500/70 opacity-90 shadow-md hover:scale-105'} bg-gradient-to-br from-[#1b3320] via-[#102415] to-[#0a140c]`}>
                <div className="absolute inset-[1px] rounded-full border border-emerald-500/20 pointer-events-none" />
                {isNear && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onTalkNpc?.(npc.id); }} className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-black font-black text-[9px] shadow-[0_0_12px_rgba(245,158,11,0.9)] cursor-pointer active:scale-95 transition-all whitespace-nowrap">💬 Falar</button>
                )}
                <span className="text-sm drop-shadow-md select-none">{npc.id === 'doran' ? '🧙' : npc.id === 'elenor' ? '🧪' : npc.id === 'kaelen' ? '🛡️' : '👤'}</span>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-emerald-500/60 text-emerald-300 font-serif font-bold text-[8px] px-1.5 py-0 rounded-full tracking-tight whitespace-nowrap z-20 shadow pointer-events-none">{npc.name.split(' ')[0]}</div>
              </div>
            </div>
          );
        })}

      {/* RENDER GROUND CORPSES WITH PROCEDURAL LOOT */}
      {(corpses || [])
        .filter((c: any) => {
          if (!c) return false;
          const corpseBiome = c.biome || 'forest';
          return corpseBiome === currentBiome;
        })
        .map((corpse: any) => {
          const dist = Math.max(Math.abs(currentHeroX - corpse.x), Math.abs(currentHeroY - corpse.y));
          const isNear = dist <= 1;
          const leftPerc = (corpse.x / gridSize) * 100;
          const topPerc = (corpse.y / gridSize) * 100;
          const sizePerc = 100 / gridSize;

          return (
            <div
              key={corpse.id}
              style={{
                left: leftPerc + '%',
                top: topPerc + '%',
                width: sizePerc + '%',
                height: sizePerc + '%',
                transition: 'left 340ms linear, top 340ms linear',
                zIndex: 22
              }}
              className="absolute flex items-center justify-center pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                if (isNear && onLootCorpse) {
                  onLootCorpse(corpse.id);
                }
              }}
            >
              <div
                className={`relative w-[85%] h-[85%] max-w-[38px] max-h-[38px] rounded-full flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isNear
                    ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-black shadow-[0_0_15px_rgba(234,179,8,0.8)] scale-110 animate-bounce'
                    : 'ring-1 ring-amber-600/70 opacity-90 shadow-md hover:scale-105'
                } bg-gradient-to-br from-amber-950 via-zinc-950 to-black`}
                title={`${corpse.name} • ${corpse.gold} PO • Clique para saquear`}
              >
                <span className="text-xs select-none">💀</span>
                <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-yellow-950 border border-yellow-500/80 text-yellow-300 font-mono text-[7px] px-1 rounded-full whitespace-nowrap shadow z-20">
                  {corpse.gold} PO
                </div>
                {isNear && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLootCorpse?.(corpse.id);
                    }}
                    className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-black text-[9px] shadow-[0_0_12px_rgba(245,158,11,0.9)] cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                  >
                    💰 Saquear
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </>
  );
}

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Crosshair,
  Footprints,
  Sparkles,
  Shield,
  Layers,
  X,
  Package,
  ArrowDownCircle,
  Gem,
  Swords,
  Info,
  Droplets,
  Heart,
  Zap,
  Flame,
  Snowflake,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Mic
} from 'lucide-react';
import type { Character, Enemy, GroundCorpse } from '@/lib/game-engine';
import { playSfx } from '@/lib/sound-effects';
import type { ActionSelection } from './bottom-player-hud';
import type { ProceduralDungeon, TileType } from '@/lib/dungeon-generator';
import type { Battlemap, OrganicTileType, BiomeType } from '@/lib/battlemap-biomes';
import { type DungeonFloor, type DungeonCrawlerTile, findDungeonPathAStar } from '@/lib/dungeon-crawler';
import {
  MAP_COLLISION_PROFILES,
  isGridTileWalkable,
  findPathAStar,
  calculateMovementBudget,
  type Point,
  type CollisionPolygon
} from '@/lib/collision-system';

// Physical Adventure Portals connected organically between biomes
export const BIOME_PORTALS: Record<string, { label: string; x: number; y: number; targetBiome: BiomeType; targetLocationIndex: number; icon: string }[]> = {
  village: [
    { label: 'Portão Norte: Floresta dos Sussurros', x: 4, y: 0, targetBiome: 'forest', targetLocationIndex: 1, icon: '🌲' }
  ],
  forest: [
    { label: 'Trilha Sul: Retornar à Vila', x: 2, y: 7, targetBiome: 'village', targetLocationIndex: 0, icon: '🏡' },
    { label: 'Portal Antigo: Ruínas da Abadia', x: 7, y: 0, targetBiome: 'ruins', targetLocationIndex: 2, icon: '🏛️' }
  ],
  ruins: [
    { label: 'Caminho Sul: Floresta dos Sussurros', x: 4, y: 7, targetBiome: 'forest', targetLocationIndex: 1, icon: '🌲' },
    { label: 'Descida: Catacumbas dos Três Selos', x: 7, y: 7, targetBiome: 'dungeon', targetLocationIndex: 3, icon: '🗝️' }
  ],
  dungeon: [
    { label: 'Escadas: Pátio das Ruínas', x: 0, y: 4, targetBiome: 'ruins', targetLocationIndex: 2, icon: '🏛️' },
    { label: 'Fenda Vulcânica: Desfiladeiro Escarpado', x: 7, y: 0, targetBiome: 'canyon', targetLocationIndex: 4, icon: '🌋' }
  ],
  canyon: [
    { label: 'Trilha Baixa: Catacumbas', x: 0, y: 7, targetBiome: 'dungeon', targetLocationIndex: 3, icon: '🗝️' },
    { label: 'Portal de Obsidiana: Covil de Ignisrax', x: 7, y: 0, targetBiome: 'lair', targetLocationIndex: 5, icon: '🐉' }
  ],
  lair: [
    { label: 'Fenda de Retorno: Desfiladeiro', x: 4, y: 7, targetBiome: 'canyon', targetLocationIndex: 4, icon: '🌋' }
  ]
};

// Map action/weapon/spell names to VFX CSS class
function getVfxClass(actionName: string): string {
  const n = actionName.toLowerCase();
  if (n.includes('arco') || n.includes('besta') || n.includes('dardo')) return 'vfx-arrow';
  if (n.includes('lança') || n.includes('rapier') || n.includes('estoque')) return 'vfx-thrust';
  if (n.includes('raio de fogo') || n.includes('fire bolt')) return 'vfx-fire-bolt';
  if (n.includes('chama sagrada') || n.includes('sacred flame')) return 'vfx-sacred-flame';
  if (n.includes('raio de gelo') || n.includes('frost') || n.includes('gelo')) return 'vfx-frost-ray';
  if (n.includes('mísseis mágicos') || n.includes('magic missile')) return 'vfx-magic-missile';
  if (n.includes('eldritch') || n.includes('rajada')) return 'vfx-eldritch-blast';
  if (n.includes('cura') || n.includes('heal') || n.includes('poção')) return 'vfx-heal';
  if (n.includes('escudo') || n.includes('shield') || n.includes('bênção')) return 'vfx-shield';
  // Default melee slash
  return 'vfx-slash';
}

// Map condition names to status indicator CSS class
function getStatusClass(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('envenenad') || c.includes('poison')) return 'status-poisoned';
  if (c.includes('queimand') || c.includes('burn') || c.includes('fogo')) return 'status-burning';
  if (c.includes('congelad') || c.includes('frozen') || c.includes('gelo')) return 'status-frozen';
  if (c.includes('atordoad') || c.includes('stun') || c.includes('incapacitad')) return 'status-stunned';
  if (c.includes('abençoad') || c.includes('bless')) return 'status-blessed';
  if (c.includes('invisível') || c.includes('invisible')) return 'status-invisible';
  return '';
}

// Status effect indicator dot color
function getStatusDotColor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('envenenad') || c.includes('poison')) return 'bg-green-400';
  if (c.includes('queimand') || c.includes('burn') || c.includes('fogo')) return 'bg-orange-400';
  if (c.includes('congelad') || c.includes('frozen') || c.includes('gelo')) return 'bg-sky-300';
  if (c.includes('atordoad') || c.includes('stun') || c.includes('incapacitad')) return 'bg-yellow-400';
  if (c.includes('abençoad') || c.includes('bless')) return 'bg-amber-300';
  if (c.includes('invisível') || c.includes('invisible')) return 'bg-zinc-400';
  if (c.includes('amedrontad') || c.includes('frighten')) return 'bg-purple-400';
  if (c.includes('prone') || c.includes('derribad') || c.includes('caído')) return 'bg-stone-400';
  return 'bg-zinc-500';
}

export interface ProjectileVfx {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  type: 'arrow' | 'fire_bolt' | 'magic_missile' | 'sacred_flame' | 'frost_ray' | 'eldritch' | 'slash';
}

export interface MapNpc {
  id: string;
  name: string;
  role: string;
  description: string;
  dialogue?: string[];
  x?: number;
  y?: number;
  icon?: string;
  biome?: BiomeType;
}

interface TacticalMapProps {
  characters: Character[];
  enemies: Enemy[];
  selectedHeroId: string;
  selectedEnemyId: string;
  targetingAction: ActionSelection | null;
  onCancelTargeting: () => void;
  onSelectToken: (type: 'hero' | 'enemy', id: string) => void;
  onMoveHero: (heroId: string, x: number, y: number) => void;
  onMoveHeroPath?: (heroId: string, waypoints: Point[]) => void;
  remoteWalkPath?: { characterId: string; waypoints: Point[]; seq: number } | null;
  onTargetEnemy: (enemyId: string) => void;
  onTargetHero?: (heroId: string) => void;
  onTargetSquare?: (x: number, y: number) => void;
  locationName: string;
  locationLabel: string;
  isCombat: boolean;
  canMove: boolean;
  dungeon?: ProceduralDungeon;
  battlemap?: Battlemap;
  dungeonFloor?: DungeonFloor | null;
  onInteractObject?: (type: string, x: number, y: number) => void;
  busy?: boolean;
  activeTurnId?: string;
  npcs?: MapNpc[];
  corpses?: GroundCorpse[];
  onLootCorpse?: (corpseId: string) => void;
  onNavigatePortal?: (targetBiome: BiomeType, targetLocationIndex: number) => void;
  onTalkNpc?: (npcId: string) => void;
  projectiles?: ProjectileVfx[];
  movementUsed?: number;
  movementBonusSquares?: number;
  biome?: BiomeType;
  onInteractPlayer?: (hero: Character) => void;
  screenShake?: boolean;
  tokenRecoils?: Record<string, { dx: number; dy: number; type: 'hit' | 'crit' | 'miss' | 'heal'; timestamp: number }>;
  slashVfx?: Record<string, { timestamp: number }>;
  healVfx?: Record<string, { timestamp: number }>;
  lootSparkles?: { x: number; y: number; id: string }[];
}

export function TacticalMap({
  characters,
  enemies,
  selectedHeroId,
  selectedEnemyId,
  targetingAction,
  onCancelTargeting,
  onSelectToken,
  onMoveHero,
  onMoveHeroPath,
  remoteWalkPath,
  onTargetEnemy,
  onTargetHero,
  onTargetSquare,
  locationName,
  locationLabel,
  isCombat,
  canMove,
  dungeon,
  battlemap,
  dungeonFloor,
  onInteractObject,
  busy,
  activeTurnId,
  npcs,
  corpses,
  onLootCorpse,
  onNavigatePortal,
  onTalkNpc,
  projectiles,
  movementUsed = 0,
  movementBonusSquares = 0,
  biome = 'village',
  onInteractPlayer,
  screenShake,
  tokenRecoils,
  slashVfx,
  healVfx,
  lootSparkles
}: TacticalMapProps) {
  const [fogOfWar, setFogOfWar] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number; y: number } | null>(null);
  const [contextEnemy, setContextEnemy] = useState<Enemy | null>(null);
  // VFX state: maps entityId -> vfx CSS class, auto-clears after animation
  const [activeVfx, setActiveVfx] = useState<Record<string, string>>({});
  // Track previous HP to detect damage/heal and trigger VFX
  const prevHpRef = useRef<Record<string, number>>({});

  // Reset pan and center hero on turn / combat change
  const handleCenterHero = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoomScale(1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Permite arrastar segurando botão do meio, espaço/alt ou clicando no fundo
    if (e.button === 1 || e.button === 0 && (e.altKey || (e.target as HTMLElement).getAttribute('data-board-bg') === 'true')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoomScale((z) => Math.max(1.0, Math.min(2.2, Number((z + delta).toFixed(2)))));
  };

  // Detect HP changes and trigger VFX
  useEffect(() => {
    const allEntities = [...characters, ...enemies];
    const newVfx: Record<string, string> = {};
    for (const e of allEntities) {
      const prevHp = prevHpRef.current[e.id];
      if (prevHp !== undefined && prevHp !== e.hp) {
        if (e.hp < prevHp) {
          // Took damage - show hit VFX
          newVfx[e.id] = 'vfx-hit';
        } else if (e.hp > prevHp) {
          // Healed - show heal VFX
          newVfx[e.id] = 'vfx-heal';
        }
      }
      prevHpRef.current[e.id] = e.hp;
    }
    if (Object.keys(newVfx).length > 0) {
      setActiveVfx((prev) => ({ ...prev, ...newVfx }));
      // Auto-clear VFX after animation duration
      const timer = setTimeout(() => {
        setActiveVfx((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(newVfx)) delete next[id];
          return next;
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [characters, enemies]);

  const [customGridSize, setCustomGridSize] = useState<number | null>(null);
  const [customZonesLoaded, setCustomZonesLoaded] = useState<boolean>(false);

  // Determine current active biome
  const currentBiome: BiomeType =
    biome ||
    (battlemap?.biome as any) ||
    (locationName.toLowerCase().includes('floresta')
      ? 'forest'
      : locationName.toLowerCase().includes('ruina') || locationName.toLowerCase().includes('abadia')
      ? 'ruins'
      : locationName.toLowerCase().includes('canyon') || locationName.toLowerCase().includes('fenda') || locationName.toLowerCase().includes('desfiladeiro')
      ? 'canyon'
      : locationName.toLowerCase().includes('covil') || locationName.toLowerCase().includes('cratera')
      ? 'lair'
      : locationName.toLowerCase().includes('dungeon') || locationName.toLowerCase().includes('catacumba')
      ? 'dungeon'
      : 'village');

  const collisionProfile = MAP_COLLISION_PROFILES[currentBiome] || MAP_COLLISION_PROFILES.village;
  const gridSize = dungeonFloor ? dungeonFloor.width : customGridSize || collisionProfile.gridSize || (battlemap ? battlemap.width : dungeon ? dungeon.width : 8);
  const activeHero = characters.find((c) => c.id === selectedHeroId) || characters[0];

  const [debugCollisions, setDebugCollisions] = useState(false);

  // Custom zones from map editor (loads from localStorage, API, or fallback collision profile)
  const [customMapZones, setCustomMapZones] = useState<CollisionPolygon[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`lume_map_zones_${currentBiome}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          const zones = Array.isArray(parsed) ? parsed : parsed.zones;
          if (zones && Array.isArray(zones)) return zones;
        }
      } catch {}
    }
    return MAP_COLLISION_PROFILES[currentBiome]?.customZones || [];
  });

  useEffect(() => {
    const handleMapUpdated = (e: any) => {
      if (e.detail?.zones && Array.isArray(e.detail.zones)) {
        setCustomMapZones(e.detail.zones);
        setCustomZonesLoaded(true);
        if (e.detail.gridSize) setCustomGridSize(Number(e.detail.gridSize));
      } else if (Array.isArray(e.detail)) {
        setCustomMapZones(e.detail);
        setCustomZonesLoaded(true);
      }
    };
    window.addEventListener('lume-map-updated', handleMapUpdated);

    fetch(`/api/map-collision?biome=${currentBiome}`)
      .then((res) => res.json())
      .then((data: any) => {
        if (data?.zones && Array.isArray(data.zones)) {
          setCustomMapZones(data.zones);
          setCustomZonesLoaded(true);
        }
        if (data?.gridSize) {
          setCustomGridSize(Number(data.gridSize));
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('lume-map-updated', handleMapUpdated);
  }, [currentBiome]);

  const activeZones = useMemo(() => {
    if (customZonesLoaded) return customMapZones;
    if (customMapZones.length > 0) return customMapZones;
    return MAP_COLLISION_PROFILES[currentBiome]?.customZones || [];
  }, [customZonesLoaded, customMapZones, currentBiome]);

  const activePortals = useMemo(() => {
    return BIOME_PORTALS[currentBiome] || [];
  }, [currentBiome]);

  // Impactful Exploration -> Combat transition banner
  const [combatTransition, setCombatTransition] = useState(false);
  const wasCombatRef = useRef(isCombat);
  useEffect(() => {
    if (!wasCombatRef.current && isCombat) {
      setCombatTransition(true);
      const timer = setTimeout(() => setCombatTransition(false), 2400);
      return () => clearTimeout(timer);
    }
    wasCombatRef.current = isCombat;
  }, [isCombat]);

  // Movement budget in combat (D&D 5e: Speed / 1.5m)
  const moveBudget = useMemo(() => {
    const speed =
      (activeHero?.speed || 9) +
      movementBonusSquares * 1.5;

    return calculateMovementBudget(
      speed,
      movementUsed
    );
  }, [
    activeHero?.speed,
    movementUsed,
    movementBonusSquares
  ]);

  // Set of occupied tiles (living entities other than active hero)
  const occupiedTiles = useMemo(() => {
    const set = new Set<string>();
    for (const c of characters) {
      if (c.id !== activeHero?.id && c.hp > 0) {
        set.add(`${c.x},${c.y}`);
      }
    }
    for (const e of enemies) {
      if (e.hp > 0) {
        set.add(`${e.x},${e.y}`);
      }
    }
    return set;
  }, [characters, enemies, activeHero?.id]);

  // Fluid MMO-like Walk State with 340ms human neutral cadence & body sway
  const [walkingHeroes, setWalkingHeroes] = useState<Record<string, { x: number; y: number; isWalking?: boolean }>>({});
  const walkTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastRemoteSeqRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(walkTimersRef.current)) {
        clearInterval(timer);
      }
    };
  }, []);

  const activeWalk = activeHero ? walkingHeroes[activeHero.id] : undefined;
  const currentHeroX = activeWalk ? activeWalk.x : activeHero?.x ?? 0;
  const currentHeroY = activeWalk ? activeWalk.y : activeHero?.y ?? 0;

  // Clean up completed walking states once server coordinates catch up
  useEffect(() => {
    setWalkingHeroes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, walk] of Object.entries(prev)) {
        if (!walk.isWalking) {
          const char = characters.find((c) => c.id === id);
          if (char && char.x === walk.x && char.y === walk.y) {
            delete next[id];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [characters]);

  const displayHeroes = useMemo(() => {
    return characters.map((c) => {
      const walk = walkingHeroes[c.id];
      if (walk && walk.isWalking) {
        return { ...c, x: walk.x, y: walk.y, isWalking: true } as Character & { isWalking?: boolean };
      }
      return { ...c, isWalking: false } as Character & { isWalking?: boolean };
    });
  }, [characters, walkingHeroes]);

  const animateHeroPath = (heroId: string, path: Point[], isLocalInitiator: boolean = true) => {
    if (path.length <= 1) return;

    if (walkTimersRef.current[heroId]) {
      clearInterval(walkTimersRef.current[heroId]);
      delete walkTimersRef.current[heroId];
    }

    let step = 0;
    // Human neutral walking cadence: 340ms per tile (~2.94 squares/sec)
    const stepInterval = 340;

    // Set initial position
    setWalkingHeroes((prev) => ({
      ...prev,
      [heroId]: { x: path[0].x, y: path[0].y, isWalking: true }
    }));

    walkTimersRef.current[heroId] = setInterval(() => {
      step++;
      if (step < path.length) {
        try { playSfx('step', 0.25); } catch {}
        setWalkingHeroes((prev) => ({
          ...prev,
          [heroId]: { x: path[step].x, y: path[step].y, isWalking: true }
        }));
      } else {
        if (walkTimersRef.current[heroId]) {
          clearInterval(walkTimersRef.current[heroId]);
          delete walkTimersRef.current[heroId];
        }
        const finalDest = path[path.length - 1];
        if (isLocalInitiator) {
          onMoveHero(heroId, finalDest.x, finalDest.y);
        }
        // Clean up walkingHeroes cache so the token position is governed purely by characters state
        setWalkingHeroes((prev) => {
          const next = { ...prev };
          delete next[heroId];
          return next;
        });
      }
    }, stepInterval);
  };

  // Sync remote player walks received via WebSocket Durable Object
  useEffect(() => {
    if (remoteWalkPath && remoteWalkPath.waypoints && remoteWalkPath.waypoints.length > 0) {
      if (remoteWalkPath.seq !== lastRemoteSeqRef.current) {
        lastRemoteSeqRef.current = remoteWalkPath.seq;
        if (remoteWalkPath.waypoints.length > 1) {
          const isCurrentHeroWalking = walkingHeroes[remoteWalkPath.characterId]?.isWalking;
          if (!isCurrentHeroWalking) {
            animateHeroPath(remoteWalkPath.characterId, remoteWalkPath.waypoints, false);
          }
        } else {
          // Single square step: clean up any stale walk cache so token reflects final coordinates
          setWalkingHeroes((prev) => {
            const next = { ...prev };
            delete next[remoteWalkPath.characterId];
            return next;
          });
        }
      }
    }
  }, [remoteWalkPath, walkingHeroes]);

  // A* calculated path from active hero to hovered square navigating obstacles
  const activePath = useMemo(() => {
    if (!hoveredSquare || !activeHero || targetingAction) return [];
    if (currentHeroX === hoveredSquare.x && currentHeroY === hoveredSquare.y) return [];
    if (dungeonFloor) {
      return findDungeonPathAStar(
        { x: currentHeroX, y: currentHeroY },
        hoveredSquare,
        dungeonFloor,
        occupiedTiles
      );
    }
    return findPathAStar(
      { x: currentHeroX, y: currentHeroY },
      hoveredSquare,
      currentBiome,
      gridSize,
      occupiedTiles,
      activeZones
    );
  }, [activeHero, currentHeroX, currentHeroY, hoveredSquare, targetingAction, dungeonFloor, currentBiome, gridSize, occupiedTiles, activeZones]);

  const pathStepCount = activePath.length > 0 ? activePath.length - 1 : 0;
  const pathMeters = (pathStepCount * 1.5).toFixed(1);
  const isPathAffordable = !isCombat || pathStepCount <= moveBudget.remainingSquares;

  // Calculate vision / illumination around heroes (radius = 5 squares)
  const isIlluminated = (x: number, y: number) => {
    if (!fogOfWar) return true;
    return displayHeroes.some((c) => {
      const dist = Math.max(Math.abs(c.x - x), Math.abs(c.y - y));
      return dist <= 5;
    });
  };

  // Check if square is in range of targeting action
  const isInRange = (x: number, y: number) => {
    if (!targetingAction || !activeHero) return false;
    const dist = Math.max(Math.abs(activeHero.x - x), Math.abs(activeHero.y - y));
    return dist <= targetingAction.rangeSquares;
  };

  // Helper to determine tile type and walkability
  const isTileWalkable = (x: number, y: number): boolean => {
    if (dungeonFloor) {
      if (x < 0 || x >= dungeonFloor.width || y < 0 || y >= dungeonFloor.height) return false;
      const t = dungeonFloor.tiles?.[y]?.[x];
      if (!t) return false;
      if (t.type === 'wall') return false;
      if (t.type === 'door') {
        const door = t.door;
        if (door?.isSecret && !door.isOpen) return false;
        if (!door?.isOpen) return false;
      }
      return true;
    }
    return isGridTileWalkable(currentBiome, x, y, gridSize, activeZones);
  };

  const getTileInfo = (x: number, y: number) => {
    if (dungeonFloor && dungeonFloor.tiles?.[y]?.[x]) {
      const dt = dungeonFloor.tiles[y][x];
      const isDoorBlocked = dt.type === 'door' && (!dt.door?.isOpen || (dt.door?.isSecret && !dt.door?.isOpen));
      return {
        type: dt.type as string,
        blocksMovement: dt.type === 'wall' || isDoorBlocked,
        blocksSight: dt.type === 'wall' || isDoorBlocked,
        label: dt.door?.name || dt.chest?.name || dt.shrine?.name || undefined
      };
    }
    if (battlemap && battlemap.tiles[y]?.[x]) {
      const t = battlemap.tiles[y][x];
      return {
        type: t.type as string,
        blocksMovement: t.blocksMovement,
        blocksSight: t.blocksSight,
        label: t.label
      };
    }
    if (dungeon && dungeon.tiles[y]?.[x]) {
      const dt = dungeon.tiles[y][x];
      return {
        type: dt.type as string,
        blocksMovement: dt.type === 'wall' || dt.type === 'pillar',
        blocksSight: dt.type === 'wall',
        label: undefined
      };
    }
    return { type: 'grass', blocksMovement: false, blocksSight: false, label: undefined };
  };

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden cursor-default"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      data-board-bg="true"
    >
      {/* Battle Map Grid Board — FULL-BLEED CANVAS */}
      <div
        className="relative w-full h-full bg-[#050806] overflow-hidden"
        data-board-bg="true"
      >
        {/* In-Game Location Pill (Floating Top-Left) */}
        <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 bg-zinc-950/85 border border-zinc-700/80 rounded-full px-2.5 py-1 text-xs backdrop-blur-md shadow-lg pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-serif font-bold text-amber-200 tracking-wide text-xs truncate max-w-[130px] sm:max-w-[200px]">
            {locationName}
          </span>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/40 font-mono">
            {gridSize}x{gridSize}
          </span>
        </div>

        {/* In-Game Vision & Scale Controls + Collision Debug Toggle (Floating Top-Right) */}
        <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 bg-[#111612]/90 border border-zinc-700/80 rounded-full px-2 py-1 text-xs backdrop-blur-md shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={handleCenterHero}
            className="p-1 rounded-full text-zinc-400 hover:text-amber-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Centralizar Câmera no Herói"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(1.0, Number((z - 0.1).toFixed(2))))}
            className="p-1 rounded-full text-zinc-400 hover:text-amber-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Diminuir Zoom (-)"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-[10px] font-mono text-amber-300/80 px-0.5">{Math.round(zoomScale * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(2.2, Number((z + 0.1).toFixed(2))))}
            className="p-1 rounded-full text-zinc-400 hover:text-amber-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Aumentar Zoom (+)"
          >
            <ZoomIn size={13} />
          </button>
          <div className="w-[1px] h-3.5 bg-zinc-700/80 mx-0.5" />
          <button
            type="button"
            onClick={() => setFogOfWar(!fogOfWar)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
              fogOfWar
                ? 'border-amber-500/60 bg-amber-950/50 text-amber-300 shadow-sm'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400'
            }`}
            title="Alternar Névoa de Guerra / Visão"
          >
            {fogOfWar ? <Eye size={11} className="text-amber-400" /> : <EyeOff size={11} className="text-zinc-400" />}
            <span className="hidden sm:inline">Névoa</span>
          </button>
          <button
            type="button"
            onClick={() => setDebugCollisions(!debugCollisions)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
              debugCollisions
                ? 'border-emerald-500/80 bg-emerald-950/70 text-emerald-300 shadow-sm ring-1 ring-emerald-500/50'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Alternar Modo Debug de Colisões (Polígonos 2D de Obstáculos)"
          >
            <Shield size={11} className={debugCollisions ? 'text-emerald-400' : 'text-zinc-400'} />
            <span className="hidden sm:inline">Colisão</span>
          </button>
        </div>

        {/* In-Game Targeting Bar (Floating Top-Center) */}
        {targetingAction && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-35 bg-gradient-to-r from-red-950 via-amber-950 to-red-950 border border-amber-400/90 rounded-full px-3.5 py-1 flex items-center gap-3 animate-fade-in shadow-[0_0_20px_rgba(239,68,68,0.5)] backdrop-blur-md pointer-events-auto">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
              <Crosshair size={13} className="text-red-400 animate-spin-slow" />
              <span className="tracking-wide">ALVO: {targetingAction.name}</span>
              <span className="text-[10px] font-normal text-amber-300/80 hidden md:inline">
                ({targetingAction.rangeSquares * 1.5}m)
              </span>
            </div>
            <button
              onClick={onCancelTargeting}
              className="flex items-center gap-1 bg-black/70 hover:bg-black text-zinc-300 hover:text-white px-2 py-0.5 rounded-full text-[11px] border border-zinc-700 transition-colors cursor-pointer"
            >
              <X size={11} />
              <span>Cancelar</span>
            </button>
          </div>
        )}

        {/* In-Game Coordinates, Path Distance & Movement Budget Badge (Floating Bottom-Left) */}
        {hoveredSquare && (
          <div className="absolute bottom-2.5 left-2.5 z-30 bg-zinc-950/90 border border-zinc-700/80 rounded-xl px-3 py-1 text-xs font-mono text-zinc-300 backdrop-blur-md pointer-events-none shadow-xl flex items-center gap-2">
            <span className="text-zinc-400 font-bold">X:{hoveredSquare.x} Y:{hoveredSquare.y}</span>
            {activePath.length > 1 ? (
              <span className={isPathAffordable ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                • Rota: {pathMeters}m ({pathStepCount}q)
                {isCombat && ` • ${moveBudget.remainingMeters}m restantes`}
              </span>
            ) : !isGridTileWalkable(currentBiome, hoveredSquare.x, hoveredSquare.y, gridSize, activeZones) ? (
              <span className="text-red-400 font-semibold">• Obstáculo / Intransponível</span>
            ) : null}
          </div>
        )}

        {/* ═══ IMPACTFUL CINEMATIC EXPLORATION -> COMBAT TRANSITION BANNER ═══ */}
        {combatTransition && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none combat-intro-anim select-none">
            <div className="absolute inset-0 bg-red-950/25 border-4 border-red-600/70 shadow-[inset_0_0_100px_rgba(239,68,68,0.6)]" />
            <div className="relative flex flex-col items-center gap-2 px-8 py-4 rounded-3xl bg-[#120808]/95 border-2 border-amber-500/90 shadow-[0_0_60px_rgba(239,68,68,0.8)] backdrop-blur-xl">
              <div className="flex items-center gap-3 text-red-300 font-serif font-black text-lg sm:text-xl tracking-widest uppercase">
                <Swords size={24} className="text-amber-400 animate-bounce" />
                <span>COMBATE INICIADO!</span>
                <Swords size={24} className="text-amber-400 animate-bounce" />
              </div>
              <span className="text-xs text-amber-200 font-mono tracking-wide">
                Ordem de Iniciativa 5e Ativa • 1 Ação e Deslocamento por turno
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Grid Container — Edge-to-Edge Full Screen Game Board */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" data-board-bg="true">
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="relative w-full max-w-6xl aspect-[16/9] mx-auto touch-manipulation pointer-events-auto select-none rounded-2xl overflow-hidden shadow-2xl border border-stone-800/80"
          >
            {/* 1. Base Illustrated Map Artwork */}
            {dungeonFloor ? (
              <div className="absolute inset-0 w-full h-full bg-[#050806] select-none pointer-events-none z-0 overflow-hidden">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${dungeonFloor.width}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${dungeonFloor.height}, minmax(0, 1fr))`
                  }}
                  className="w-full h-full"
                >
                  {dungeonFloor.tiles.flatMap((row, ry) =>
                    row.map((cell, rx) => {
                      const isWall = cell.type === 'wall';
                      let bgClass = 'bg-[#0a0f0d] border border-stone-800/30';
                      if (isWall) {
                        bgClass = 'bg-gradient-to-b from-[#18201a] via-[#101612] to-[#070b09] border border-[#232c25] shadow-inner';
                      } else if (cell.roomPurpose === 'shrine') {
                        bgClass = 'bg-[#071813] border border-emerald-800/25';
                      } else if (cell.roomPurpose === 'combat') {
                        bgClass = 'bg-[#15110d] border border-amber-900/25';
                      } else if (cell.roomPurpose === 'secret' || cell.roomPurpose === 'treasure') {
                        bgClass = 'bg-[#120b1c] border border-purple-900/25';
                      } else if (cell.roomPurpose === 'boss') {
                        bgClass = 'bg-[#1d0808] border border-red-900/30';
                      }
                      return (
                        <div key={`${rx}-${ry}`} className={`relative w-full h-full ${bgClass}`}>
                          {isWall && (
                            <div className="absolute inset-0.5 border-t border-l border-white/10 rounded-xs" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <img
                src={collisionProfile.imageSrc}
                alt="Mapa Ilustrado"
                className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none z-0"
              />
            )}

            {/* 2. Ambient Lighting & Atmospheric Fantasy Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/35 pointer-events-none z-[1]" />

            {/* 3. SVG Layer for Pathfinding Polyline, Waypoints & Collision Debug Polygons */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              style={{ overflow: 'visible' }}
            >
              {/* Collision Debug Polygons (When Debug Mode is Enabled) */}
              {debugCollisions && (
                <g opacity="0.85">
                  {activeZones.map((zone) => {
                    const pointsStr = zone.points.map(([px, py]) => `${px * 100},${py * 100}`).join(' ');
                    const firstPoint = zone.points[0];
                    let stroke = '#ef4444';
                    let fill = 'rgba(239, 68, 68, 0.35)';
                    let labelColor = '#fca5a5';
                    if (zone.type === 'agua' || zone.type === 'water') {
                      stroke = '#0ea5e9';
                      fill = 'rgba(14, 165, 233, 0.35)';
                      labelColor = '#7dd3fc';
                    } else if (zone.type === 'caminhavel' || zone.type === 'walkable') {
                      stroke = '#22c55e';
                      fill = 'rgba(34, 197, 94, 0.25)';
                      labelColor = '#86efac';
                    } else if (zone.type === 'porta') {
                      stroke = '#f59e0b';
                      fill = 'rgba(245, 158, 11, 0.4)';
                      labelColor = '#fde68a';
                    } else if (zone.type === 'ponte') {
                      stroke = '#06b6d4';
                      fill = 'rgba(6, 182, 212, 0.4)';
                      labelColor = '#67e8f9';
                    }
                    return (
                      <g key={zone.id}>
                        <polygon
                          points={pointsStr}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth="0.7"
                          strokeDasharray={zone.type === 'bloqueado' ? 'none' : '2 1'}
                        />
                        <text
                          x={firstPoint[0] * 100 + 1}
                          y={firstPoint[1] * 100 + 3.5}
                          fill={labelColor}
                          fontSize="2"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {zone.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Dynamic A* Route Preview Line */}
              {activePath.length > 1 && (
                <g>
                  {/* Glow under-path */}
                  <polyline
                    points={activePath.map((p) => `${((p.x + 0.5) / gridSize) * 100},${((p.y + 0.5) / gridSize) * 100}`).join(' ')}
                    fill="none"
                    stroke={isPathAffordable ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Main dashed animated path line */}
                  <polyline
                    points={activePath.map((p) => `${((p.x + 0.5) / gridSize) * 100},${((p.y + 0.5) / gridSize) * 100}`).join(' ')}
                    fill="none"
                    stroke={isPathAffordable ? '#f59e0b' : '#ef4444'}
                    strokeWidth="1.1"
                    strokeDasharray="2 1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="route-dash-anim"
                  />
                  {/* Waypoint markers */}
                  {activePath.map((p, idx) => {
                    if (idx === 0) return null; // Don't draw on hero
                    const isEnd = idx === activePath.length - 1;
                    const cx = ((p.x + 0.5) / gridSize) * 100;
                    const cy = ((p.y + 0.5) / gridSize) * 100;
                    return (
                      <circle
                        key={`${p.x}-${p.y}`}
                        cx={cx}
                        cy={cy}
                        r={isEnd ? 1.4 : 0.8}
                        fill={isPathAffordable ? '#fbbf24' : '#f87171'}
                        stroke="#000"
                        strokeWidth="0.3"
                      />
                    );
                  })}
                </g>
              )}
            </svg>

            {/* 4. Interactive Tactical Grid Layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
              }}
              className="absolute inset-0 w-full h-full z-10"
            >
            {Array.from({ length: gridSize * gridSize }).map((_, i) => {
              const x = i % gridSize;
              const y = Math.floor(i / gridSize);

              const illuminated = isIlluminated(x, y);
              const inRange = isInRange(x, y);
              const isHovered = hoveredSquare?.x === x && hoveredSquare?.y === y;

              const isVillage = battlemap?.biome === 'village' || locationName.toLowerCase().includes('vila');
              const tileNpcs = (npcs || []).filter((n) => {
                if (n.x !== x || n.y !== y) return false;
                if (n.biome) return n.biome === currentBiome;
                return currentBiome === 'village';
              });
              const tileHeroes = displayHeroes.filter((c) => c.x === x && c.y === y);
              const tileEnemies = enemies.filter((e) => e.x === x && e.y === y && e.hp > 0);
              const hasEntities = tileHeroes.length > 0 || tileEnemies.length > 0 || tileNpcs.length > 0;

              const isTileActiveHero = isCombat && tileHeroes.some((h) => h.id === activeTurnId);
              const isTileActiveEnemy = isCombat && tileEnemies.some((e) => e.id === activeTurnId);

              const tile = getTileInfo(x, y);
              const tType = tile.type;

              const isWalkable = isTileWalkable(x, y);
              const isOnActivePath = activePath.some((p) => p.x === x && p.y === y);

              // Translucent tactical cell styling over the illustrated map
              let tileBg = 'bg-transparent border-stone-700/20 hover:bg-amber-400/10 hover:border-amber-400/50';
              if (!isWalkable) {
                tileBg = 'bg-black/20 border-black/30';
              }
              if (isOnActivePath) {
                tileBg = isPathAffordable
                  ? 'bg-amber-500/15 border-amber-400/40'
                  : 'bg-red-500/15 border-red-500/40';
              }

              const isAoE =
                targetingAction?.aoeRadius &&
                hoveredSquare &&
                Math.max(Math.abs(hoveredSquare.x - x), Math.abs(hoveredSquare.y - y)) <=
                  targetingAction.aoeRadius;

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredSquare({ x, y })}
                  onMouseLeave={() => setHoveredSquare(null)}
                  onClick={() => {
                    if (targetingAction) {
                      if (
                        (
                          targetingAction.targetMode ===
                            'area' ||
                          targetingAction.targetMode ===
                            'point'
                        ) &&
                        inRange &&
                        onTargetSquare
                      ) {
                        onTargetSquare(
                          x,
                          y
                        );
                      } else if (
                        (
                          targetingAction.targetMode ===
                            'ally' ||
                          targetingAction.targetMode ===
                            'self'
                        ) &&
                        tileHeroes.length > 0 &&
                        onTargetHero
                      ) {
                        onTargetHero(
                          tileHeroes[0].id
                        );
                      } else {
                        const enemyTarget =
                          tileEnemies[0];

                        if (
                          enemyTarget &&
                          inRange
                        ) {
                          onTargetEnemy(
                            enemyTarget.id
                          );
                        }
                      }
                    } else if (tileNpcs.length > 0) {
                      const npc = tileNpcs[0];
                      const dist = activeHero ? Math.max(Math.abs(currentHeroX - x), Math.abs(currentHeroY - y)) : 99;
                      if (dist <= 1) {
                        onTalkNpc?.(npc.id);
                      } else if (canMove && activeHero && isWalkable) {
                        if (!isCombat && activePath.length > 1) {
                          onMoveHeroPath?.(activeHero.id, activePath);
                          animateHeroPath(activeHero.id, activePath, false);
                        } else {
                          onMoveHero(activeHero.id, x, y);
                        }
                      }
                    } else if (tileEnemies.length > 0) {
                      const enemy = tileEnemies[0];
                      setContextEnemy(enemy);
                      onSelectToken('enemy', enemy.id);
                      const dist = activeHero ? Math.max(Math.abs(currentHeroX - x), Math.abs(currentHeroY - y)) : 99;
                      if (dist <= 1) {
                        onTargetEnemy(enemy.id);
                      }
                    } else if (activePortals.some((p) => p.x === x && p.y === y)) {
                      const pObj = activePortals.find((p) => p.x === x && p.y === y)!;
                      if (onNavigatePortal) {
                        try { playSfx('door'); } catch {}
                        onNavigatePortal(pObj.targetBiome, pObj.targetLocationIndex);
                      }
                    } else if (['chest', 'shrine', 'stairs', 'well', 'door', 'trap', 'extraction', 'dungeon_entrance'].includes(tType)) {
                      onInteractObject?.(tType, x, y);
                    } else if (canMove && activeHero && !hasEntities) {
                      if (isWalkable) {
                        if (!isCombat) {
                          if (activePath.length > 1) {
                            onMoveHeroPath?.(activeHero.id, activePath);
                            animateHeroPath(activeHero.id, activePath, false);
                          } else {
                            onMoveHero(activeHero.id, x, y);
                          }
                        } else if (pathStepCount > 0 && isPathAffordable) {
                          if (activePath.length > 1) {
                            onMoveHeroPath?.(activeHero.id, activePath);
                            animateHeroPath(activeHero.id, activePath, false);
                          } else {
                            onMoveHero(activeHero.id, x, y);
                          }
                        }
                      }
                    }
                  }}
                  className={`relative flex items-center justify-center border transition-all cursor-pointer overflow-visible ${
                    !illuminated
                      ? 'bg-black/85 border-black opacity-40'
                      : inRange && targetingAction
                      ? 'bg-amber-500/20 border-amber-400/80 shadow-[inset_0_0_8px_rgba(251,191,36,0.4)]'
                      : isAoE
                      ? 'bg-orange-500/25 border-orange-500/60 animate-pulse'
                      : isTileActiveHero
                      ? 'bg-amber-500/15 border-amber-400/70 shadow-[inset_0_0_12px_rgba(251,191,36,0.3)]'
                      : isTileActiveEnemy
                      ? 'bg-red-500/15 border-red-500/70 shadow-[inset_0_0_12px_rgba(239,68,68,0.3)]'
                      : tileBg
                  }`}
                >
                {/* ═══ INTERACTIVE OBJECTS FOR DUNGEON CRAWLER FLOOR ═══ */}
                {dungeonFloor && tType === 'door' && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteractObject?.('door', x, y);
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto z-15"
                    title={tile.label || 'Porta'}
                  >
                    {dungeonFloor.tiles?.[y]?.[x]?.door?.isOpen ? (
                      <div className="w-full h-full flex items-center justify-center opacity-60 bg-emerald-950/20 border border-emerald-500/30 rounded">
                        <span className="text-xs">🚪</span>
                      </div>
                    ) : dungeonFloor.tiles?.[y]?.[x]?.door?.isSecret ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-purple-950/80 border-2 border-purple-500 rounded shadow-[0_0_15px_rgba(168,85,247,0.7)] animate-pulse">
                        <span className="text-xs">👁️</span>
                        <span className="text-[7px] text-purple-200 font-bold">Passagem</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-950 via-stone-900 to-amber-950 border-2 border-amber-600/80 rounded shadow-md group hover:border-amber-400">
                        <span className="text-xs">🚪</span>
                        <span className="text-[7px] text-amber-300 font-bold">Abrir</span>
                      </div>
                    )}
                  </div>
                )}

                {dungeonFloor && tType === 'chest' && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteractObject?.('chest', x, y);
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto z-15 group"
                    title={tile.label || 'Baú Rúnico'}
                  >
                    {dungeonFloor.tiles?.[y]?.[x]?.chest?.isOpened ? (
                      <div className="w-full h-full flex items-center justify-center opacity-40">
                        <span className="text-sm">📦</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-amber-950/60 border border-amber-400/80 rounded shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse group-hover:scale-110 transition-transform">
                        <span className="text-sm">🪙</span>
                        <span className="text-[7px] text-amber-300 font-bold">Baú</span>
                      </div>
                    )}
                  </div>
                )}

                {dungeonFloor && tType === 'shrine' && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteractObject?.('shrine', x, y);
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto z-15 group"
                    title={tile.label || 'Fonte Sagrada'}
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-950/60 border border-emerald-400/80 rounded shadow-[0_0_18px_rgba(16,185,129,0.7)] animate-pulse group-hover:scale-110 transition-transform">
                      <span className="text-sm">🌿</span>
                      <span className="text-[7px] text-emerald-300 font-bold">Fonte</span>
                    </div>
                  </div>
                )}

                {dungeonFloor && tType === 'trap' && (dungeonFloor.tiles?.[y]?.[x]?.trap?.isRevealed || dungeonFloor.tiles?.[y]?.[x]?.trap?.isTriggered) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-15">
                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-950/60 border border-red-500/80 rounded shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse">
                      <span className="text-xs">⚡</span>
                      <span className="text-[7px] text-red-300 font-mono font-bold">Glifo</span>
                    </div>
                  </div>
                )}

                {dungeonFloor && tType === 'stairs' && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteractObject?.('stairs', x, y);
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto z-20 group"
                    title={dungeonFloor.stairsDown.isUnlocked ? 'Descer para o Próximo Andar' : 'Escadaria Selada (Vença o Chefe)'}
                  >
                    {dungeonFloor.stairsDown.isUnlocked ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-amber-500/40 via-yellow-500/20 to-transparent border-2 border-amber-300 rounded shadow-[0_0_25px_rgba(245,158,11,0.9)] animate-bounce group-hover:scale-110 transition-transform">
                        <span className="text-base">✨</span>
                        <span className="text-[7px] text-amber-200 font-bold whitespace-nowrap bg-black/80 px-1 rounded border border-amber-400">
                          Andar {dungeonFloor.floorNumber + 1}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950/80 border border-red-500/70 rounded opacity-80">
                        <span className="text-xs">🔒</span>
                        <span className="text-[7px] text-red-300 font-bold">Selada</span>
                      </div>
                    )}
                  </div>
                )}

                {dungeonFloor && tType === 'extraction' && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteractObject?.('extraction', x, y);
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto z-20 group"
                    title="Ponto de Extração (Salvar Loot e Retornar)"
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-950/40 border border-emerald-400/80 rounded shadow-[0_0_20px_rgba(16,185,129,0.8)] animate-pulse group-hover:scale-110 transition-transform">
                      <span className="text-sm">🛡️</span>
                      <span className="text-[7px] text-emerald-200 font-bold whitespace-nowrap bg-black/80 px-1 rounded border border-emerald-400">
                        Extrair
                      </span>
                    </div>
                  </div>
                )}

                {/* ═══ DESCIDA PARA AS CATACUMBAS PROFUNDAS NO MAPA BASE ═══ */}
                {!dungeonFloor && currentBiome === 'dungeon' && x === 6 && y === 6 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onInteractObject?.('dungeon_entrance', 6, 6);
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto group z-25"
                    title="Adentrar as Catacumbas Profundas (Dungeon Crawler)"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600/70 via-zinc-900 to-black border-2 border-amber-400 flex items-center justify-center text-lg shadow-[0_0_25px_rgba(245,158,11,0.9)] animate-bounce group-hover:scale-125 transition-transform">
                      <span>💀</span>
                    </div>
                    <div className="absolute -bottom-5 bg-zinc-950/95 border border-amber-400 text-amber-300 font-serif text-[8px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-xl">
                      Descida: Masmorra Sem Fim
                    </div>
                  </div>
                )}
                {/* Physical Adventure Portals rendered cleanly on the map */}
                {illuminated && activePortals.filter((p) => p.x === x && p.y === y).map((portal, pIdx) => (
                  <div
                    key={pIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onNavigatePortal) {
                        try { playSfx('door'); } catch {}
                        onNavigatePortal(portal.targetBiome, portal.targetLocationIndex);
                      }
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-auto group z-20"
                    title={`Passar pelo portal: ${portal.label}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/40 via-yellow-500/30 to-amber-700/50 border-2 border-amber-300 flex items-center justify-center text-base shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse group-hover:scale-125 transition-transform">
                      <span>{portal.icon}</span>
                    </div>
                    <div className="absolute -bottom-5 bg-zinc-950/95 border border-amber-400 text-amber-200 font-serif text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-lg group-hover:opacity-100 opacity-90 transition-opacity">
                      {portal.label.split(':')[0]}
                    </div>
                  </div>
                ))}

                {/* Movement distance preview tooltip with D&D 5e distance standards */}
                {isHovered && activePath.length > 1 && !hasEntities && illuminated && (
                  <div className="absolute -top-7 z-30 pointer-events-none bg-black/95 border border-zinc-700 px-2 py-0.5 rounded text-[9px] font-mono text-zinc-200 whitespace-nowrap shadow-md flex items-center gap-1">
                    <span className={isPathAffordable ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {pathMeters}m ({pathStepCount}q • 1.5m/q)
                    </span>
                  </div>
                )}

              </div>
            );
          })}
          </div>

          {/* ABSOLUTE POSITIONED TOKENS FOR SMOOTH TRANSITIONS */}
          <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
            <DndTokens 
              displayHeroes={displayHeroes} 
              enemies={enemies} 
              npcs={npcs} 
              corpses={corpses}
              onLootCorpse={onLootCorpse}
              currentBiome={currentBiome}
              gridSize={gridSize} 
              selectedHeroId={selectedHeroId} 
              selectedEnemyId={selectedEnemyId}
              activeTurnId={activeTurnId}
              targetingAction={targetingAction}
              isCombat={isCombat}
              activeVfx={activeVfx}
              tokenRecoils={tokenRecoils}
              slashVfx={slashVfx}
              healVfx={healVfx}
              lootSparkles={lootSparkles}
              contextEnemy={contextEnemy}
              setContextEnemy={setContextEnemy}
              onSelectToken={onSelectToken}
              onTargetEnemy={onTargetEnemy}
              onTargetHero={onTargetHero}
              onTargetSquare={onTargetSquare}
              onTalkNpc={onTalkNpc}
              onInteractPlayer={onInteractPlayer}
              currentHeroX={currentHeroX}
              currentHeroY={currentHeroY}
            />
          </div>

          {/* FLYING COMBAT PROJECTILES OVERLAY */}
          {projectiles && projectiles.map((p) => {
            const startLeft = ((p.startX + 0.5) / gridSize) * 100 + '%';
            const startTop = ((p.startY + 0.5) / gridSize) * 100 + '%';
            const targetLeft = ((p.targetX + 0.5) / gridSize) * 100 + '%';
            const targetTop = ((p.targetY + 0.5) / gridSize) * 100 + '%';
            const dx = p.targetX - p.startX;
            const dy = p.targetY - p.startY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            if (p.type === 'slash') {
              return (
                <div
                  key={p.id}
                  className="slash-arc-anim"
                  style={{ left: targetLeft, top: targetTop }}
                >
                  <div className="w-12 h-12 border-r-4 border-t-4 border-red-500 rounded-full shadow-[0_0_20px_#ef4444]" />
                </div>
              );
            }

            if (p.type === 'sacred_flame') {
              return (
                <div
                  key={p.id}
                  className="sacred-flame-anim"
                  style={{ left: targetLeft, top: targetTop }}
                >
                  <div className="w-6 h-24 bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-500 rounded-full shadow-[0_0_30px_#fef08a]" />
                </div>
              );
            }

            return (
              <React.Fragment key={p.id}>
                <div
                  className="projectile-fly-anim"
                  style={{
                    '--proj-start-x': startLeft,
                    '--proj-start-y': startTop,
                    '--proj-target-x': targetLeft,
                    '--proj-target-y': targetTop,
                    '--proj-angle': `${angle}deg`
                  } as React.CSSProperties}
                >
                  {p.type === 'fire_bolt' ? (
                    <div className="relative flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600 shadow-[0_0_18px_#f97316] animate-spin" />
                      <div className="absolute right-3 w-10 h-2 bg-gradient-to-l from-orange-500/90 to-transparent blur-[1px] rounded-full" />
                    </div>
                  ) : p.type === 'magic_missile' ? (
                    <div className="relative flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-violet-400 via-purple-500 to-fuchsia-400 shadow-[0_0_18px_#a855f7] animate-pulse" />
                      <div className="absolute right-3 w-12 h-2 bg-gradient-to-l from-fuchsia-500/80 to-transparent blur-[1px] rounded-full" />
                    </div>
                  ) : p.type === 'frost_ray' ? (
                    <div className="relative flex items-center justify-center">
                      <div className="w-7 h-2 rounded-full bg-gradient-to-r from-cyan-300 to-white shadow-[0_0_16px_#38bdf8]" />
                      <div className="absolute right-2 w-9 h-2 bg-gradient-to-l from-sky-400/80 to-transparent blur-[1px]" />
                    </div>
                  ) : p.type === 'eldritch' ? (
                    <div className="relative flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_18px_#10b981] animate-spin-slow" />
                      <div className="absolute right-3 w-10 h-2 bg-gradient-to-l from-emerald-500/80 to-transparent blur-[1px]" />
                    </div>
                  ) : (
                    /* Default Arrow */
                    <div className="relative flex items-center">
                      <div className="w-7 h-1 bg-gradient-to-r from-transparent via-amber-200 to-white shadow-[0_0_10px_#eab308]" />
                      <div className="w-2.5 h-2.5 -ml-1.5 rotate-45 bg-amber-300 shadow" />
                    </div>
                  )}
                </div>

                {/* Impact Ring at target */}
                <div
                  className="impact-ring-anim border-2 border-amber-400"
                  style={{
                    left: targetLeft,
                    top: targetTop,
                    width: '36px',
                    height: '36px'
                  }}
                />
              </React.Fragment>
            );
          })}
          </div>
        </div>

      </div>
    </div>
  );
}
