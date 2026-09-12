'use client';

import React from 'react';

export type FloatingNumber = {
  id: string;
  x: number; // percentage or px
  y: number;
  text: string;
  type: 'damage' | 'crit' | 'heal' | 'miss' | 'info' | 'loot' | 'gold' | 'item';
  icon?: string;
};

interface FloatingTextOverlayProps {
  items: FloatingNumber[];
}

export function FloatingTextOverlay({ items }: FloatingTextOverlayProps) {
  if (!items.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {items.map((item) => {
        const colorClasses = {
          damage: 'text-red-500 text-shadow-damage text-2xl font-black',
          crit: 'text-amber-300 text-shadow-crit text-3xl font-black scale-110 animate-bounce',
          heal: 'text-emerald-400 text-shadow-heal text-2xl font-bold',
          miss: 'text-slate-400 text-lg font-semibold tracking-wider',
          info: 'text-cyan-300 text-sm font-medium',
          loot: 'text-amber-300 font-black text-base sm:text-lg flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/90 border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.9)] animate-bounce tracking-wide',
          gold: 'text-yellow-300 font-black text-sm sm:text-base flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/85 border border-yellow-400 shadow-[0_0_16px_rgba(234,179,8,0.85)] tracking-wide',
          item: 'text-cyan-200 font-bold text-xs sm:text-sm flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/85 border border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.8)] tracking-wide'
        }[item.type];

        return (
          <div
            key={item.id}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            className={`floating-combat-text absolute -translate-x-1/2 -translate-y-1/2 select-none ${colorClasses}`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.text}</span>
          </div>
        );
      })}
    </div>
  );
}
