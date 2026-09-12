const fs = require('fs');

let content = fs.readFileSync('c:/gm/components/game/tactical-map.tsx', 'utf-8');
const startTag = '                {/* TOKENS */}';
const endTag = '          {/* FLYING COMBAT PROJECTILES OVERLAY */}';

let sIndex = content.indexOf(startTag);
let eIndex = content.indexOf(endTag);

if (sIndex === -1 || eIndex === -1) {
    console.log("NOT FOUND", sIndex, eIndex);
    process.exit(1);
}

// Find the end of the map loop (we know it's a few lines above endTag)
let sub = content.substring(sIndex, eIndex);
let endLoop = '              </div>\\r\\n            );\\r\\n          })}\\r\\n          </div>';
if (!sub.includes('          </div>')) {
    endLoop = '              </div>\\n            );\\n          })}\\n          </div>';
}

let endLoopIdx = content.indexOf('          </div>', sIndex);
// The grid loop ends before the projectiles
let beforeTokens = content.substring(0, sIndex);

let replacement = `              </div>
            );
          })}
          </div>

          {/* ABSOLUTE POSITIONED TOKENS FOR SMOOTH TRANSITIONS */}
          <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
            <DndTokens 
              displayHeroes={displayHeroes} 
              enemies={enemies} 
              npcs={npcs} 
              gridSize={gridSize} 
              selectedHeroId={selectedHeroId} 
              selectedEnemyId={selectedEnemyId}
              activeTurnId={activeTurnId}
              targetingAction={targetingAction}
              isCombat={isCombat}
              activeVfx={activeVfx}
              contextEnemy={contextEnemy}
              setContextEnemy={setContextEnemy}
              onSelectToken={onSelectToken}
              onTargetEnemy={onTargetEnemy}
              onTalkNpc={onTalkNpc}
              onInteractPlayer={onInteractPlayer}
              currentHeroX={currentHeroX}
              currentHeroY={currentHeroY}
            />
          </div>

`;

let afterTokens = content.substring(eIndex);

let newContent = beforeTokens + replacement + afterTokens;

const dndTokensCode = `
function DndTokens({ displayHeroes, enemies, npcs, gridSize, selectedHeroId, selectedEnemyId, activeTurnId, targetingAction, isCombat, activeVfx, contextEnemy, setContextEnemy, onSelectToken, onTargetEnemy, onTalkNpc, onInteractPlayer, currentHeroX, currentHeroY }) {
  const getStatusClass = (condition) => {
    const c = condition.toLowerCase();
    if (c.includes('envenenad') || c.includes('poison')) return 'status-poisoned';
    if (c.includes('queimand') || c.includes('burn') || c.includes('fogo')) return 'status-burning';
    if (c.includes('congelad') || c.includes('frozen') || c.includes('gelo')) return 'status-frozen';
    if (c.includes('atordoad') || c.includes('stun')) return 'status-stunned';
    if (c.includes('abençoad') || c.includes('bless')) return 'status-blessed';
    if (c.includes('invisível') || c.includes('invisible')) return 'status-invisible';
    return '';
  };
  const getStatusDotColor = (condition) => {
    const c = condition.toLowerCase();
    if (c.includes('envenenad') || c.includes('poison')) return 'bg-green-400';
    if (c.includes('queimand') || c.includes('burn')) return 'bg-orange-400';
    if (c.includes('congelad') || c.includes('frozen')) return 'bg-sky-300';
    if (c.includes('atordoad') || c.includes('stun')) return 'bg-yellow-400';
    if (c.includes('abençoad') || c.includes('bless')) return 'bg-amber-300';
    if (c.includes('invisível') || c.includes('invisible')) return 'bg-zinc-400';
    return 'bg-zinc-500';
  };

  const isInRange = (x, y) => {
    if (!targetingAction) return false;
    const dist = Math.max(Math.abs(currentHeroX - x), Math.abs(currentHeroY - y));
    return dist <= targetingAction.rangeSquares;
  };

  return (
    <>
      {displayHeroes.map(hero => {
        const isSelected = hero.id === selectedHeroId;
        const isActiveTurn = isCombat && (hero.id === activeTurnId);
        const hpRatio = hero.hp / hero.maxHp;
        const conditions = hero.conditions || [];
        const statusClasses = conditions.map(c => getStatusClass(c)).filter(Boolean).join(' ');
        
        const leftPerc = (hero.x / gridSize) * 100;
        const topPerc = (hero.y / gridSize) * 100;
        const sizePerc = 100 / gridSize;

        if (hero.hp <= 0) {
          return (
            <div key={hero.id}
                 style={{ left: leftPerc + '%', top: topPerc + '%', width: sizePerc + '%', height: sizePerc + '%', transition: 'left 340ms linear, top 340ms linear' }}
                 className="absolute flex items-center justify-center pointer-events-auto"
                 onClick={(e) => {
                   e.stopPropagation();
                   if (onInteractPlayer && hero.id !== selectedHeroId) onInteractPlayer(hero);
                   else onSelectToken('hero', hero.id);
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
                 if (onInteractPlayer && hero.id !== selectedHeroId) onInteractPlayer(hero);
                 else onSelectToken('hero', hero.id);
               }}>
            <div className={\`relative w-[85%] h-[85%] max-w-[42px] max-h-[42px] rounded-full flex flex-col items-center justify-center cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.6)] transition-transform \${hero.isWalking ? 'token-walking-active scale-110' : 'token-human-sway hover:scale-105'} \${isActiveTurn ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-black scale-115 shadow-[0_0_25px_rgba(251,191,36,0.9)] token-selected-pulse' : isSelected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black scale-110 token-selected-pulse' : \`ring-2 \${ringColor}\`} bg-gradient-to-br \${bgGradient} \${statusClasses}\`}>
              <div className="absolute inset-[2px] rounded-full border border-white/10 pointer-events-none" />
              {isActiveTurn && <div className="absolute -inset-2 rounded-full border-2 border-amber-400 animate-ping opacity-60 pointer-events-none" />}
              {isActiveTurn && <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-black font-black text-[8px] px-1.5 rounded-full uppercase tracking-wider shadow-lg z-30 animate-pulse pointer-events-none whitespace-nowrap">VEZ</div>}
              {activeVfx[hero.id] && <div className={activeVfx[hero.id]} />}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[130%] max-w-[42px] h-[5px] bg-black/95 rounded-full border border-zinc-500/80 overflow-hidden shadow-lg z-20">
                <div style={{ width: \`\${Math.min(100, hpRatio * 100)}%\` }} className={\`h-full transition-all duration-500 ease-out \${hpRatio > 0.5 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : hpRatio > 0.2 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-600 to-red-400'}\`} />
              </div>
              {(isSelected || isActiveTurn) && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-amber-500/60 px-1.5 rounded text-[9px] font-mono font-bold text-amber-200 whitespace-nowrap z-30 shadow-md pointer-events-none">{hero.hp}/{hero.maxHp}</div>
              )}
              {conditions.length > 0 && (
                <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                  {conditions.slice(0, 3).map((c, i) => <div key={i} className={\`w-[6px] h-[6px] rounded-full \${getStatusDotColor(c)} shadow-sm border border-black\`} title={c} />)}
                </div>
              )}
              <span className="font-serif font-black text-sm text-amber-100 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{hero.name[0]}</span>
            </div>
          </div>
        );
      })}

      {enemies.map(enemy => {
        if (enemy.hp <= 0) return null;
        const isSelected = enemy.id === selectedEnemyId;
        const isActiveTurn = isCombat && (enemy.id === activeTurnId);
        const hpRatio = enemy.hp / enemy.maxHp;
        const conditions = enemy.conditions || [];
        const statusClasses = conditions.map(c => getStatusClass(c)).filter(Boolean).join(' ');
        const isTargeted = targetingAction && isInRange(enemy.x, enemy.y);

        const leftPerc = (enemy.x / gridSize) * 100;
        const topPerc = (enemy.y / gridSize) * 100;
        const sizePerc = 100 / gridSize;

        return (
          <div key={enemy.id}
               style={{ left: leftPerc + '%', top: topPerc + '%', width: sizePerc + '%', height: sizePerc + '%', transition: 'left 340ms linear, top 340ms linear', zIndex: isActiveTurn ? 35 : 25 }}
               className="absolute flex items-center justify-center pointer-events-auto"
               onClick={(e) => {
                 e.stopPropagation();
                 if (isTargeted) onTargetEnemy(enemy.id);
                 else { onSelectToken('enemy', enemy.id); setContextEnemy(enemy); }
               }}>
            <div className={\`relative w-[85%] h-[85%] max-w-[42px] max-h-[42px] rounded-full flex flex-col items-center justify-center cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.6)] token-human-sway \${isActiveTurn ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-black scale-115 shadow-[0_0_25px_rgba(239,68,68,0.9)] token-target-pulse' : isSelected ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-black scale-110 token-target-pulse' : isTargeted ? 'ring-2 ring-amber-400/80 ring-offset-1 ring-offset-black scale-105 animate-pulse' : 'ring-[1.5px] ring-red-700/80 hover:scale-105'} bg-gradient-to-br from-red-900 via-red-950 to-zinc-950 transition-transform \${statusClasses}\`}>
              <div className="absolute inset-[1px] rounded-full border border-red-500/30 pointer-events-none" />
              {isActiveTurn && <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-ping opacity-60 pointer-events-none" />}
              {isActiveTurn && <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-[8px] px-1.5 rounded-full uppercase tracking-wider shadow-lg z-30 animate-pulse pointer-events-none whitespace-nowrap">VEZ</div>}
              {activeVfx[enemy.id] && <div className={activeVfx[enemy.id]} />}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[130%] max-w-[42px] h-[5px] bg-black/95 rounded-full border border-zinc-500/80 overflow-hidden shadow-lg z-20">
                <div style={{ width: \`\${Math.min(100, hpRatio * 100)}%\` }} className={\`h-full transition-all duration-500 ease-out \${hpRatio > 0.5 ? 'bg-gradient-to-r from-red-500 to-rose-400' : hpRatio > 0.2 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-red-700 to-red-500'}\`} />
              </div>
              {isSelected && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-red-600/60 px-1.5 rounded text-[9px] font-mono font-bold text-red-200 whitespace-nowrap z-30 shadow-md pointer-events-none">{enemy.hp}/{enemy.maxHp}</div>
              )}
              {conditions.length > 0 && (
                <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                  {conditions.slice(0, 3).map((c, i) => <div key={i} className={\`w-[6px] h-[6px] rounded-full \${getStatusDotColor(c)} shadow-sm border border-black\`} title={c} />)}
                </div>
              )}
              {isTargeted && <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/70 animate-spin-slow pointer-events-none z-15" />}
              <span className="font-serif font-black text-sm text-red-200 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{enemy.name[0]}</span>
            </div>
          </div>
        );
      })}

      {(npcs || []).map(npc => {
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
            <div className={\`relative w-[80%] h-[80%] max-w-[36px] max-h-[36px] rounded-full flex flex-col items-center justify-center cursor-pointer transition-all \${isNear ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black npc-talk-glow shadow-[0_0_18px_rgba(245,158,11,0.7)] scale-105' : 'ring-[1.5px] ring-emerald-500/70 opacity-90 shadow-md hover:scale-105'} bg-gradient-to-br from-[#1b3320] via-[#102415] to-[#0a140c]\`}>
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
    </>
  );
}
`;

newContent = newContent.replace("import React, { useState", dndTokensCode + "\nimport React, { useState");
fs.writeFileSync('c:/gm/components/game/tactical-map.tsx', newContent);
console.log("REPLACED OK");
