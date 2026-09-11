// components/game/tactical-map.tsx
'use client';

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
import type { Character, Enemy } from '@/lib/game-engine';
import type { ActionSelection } from './bottom-player-hud';
import type { ProceduralDungeon, TileType } from '@/lib/dungeon-generator';
import type { Battlemap, OrganicTileType } from '@/lib/battlemap-biomes';
import {
  MAP_COLLISION_PROFILES,
  isGridTileWalkable,
  findPathAStar,
  calculateMovementBudget,
  type Point,
  type CollisionPolygon
} from '@/lib/collision-system';

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
  locationName: string;
  locationLabel: string;
  isCombat: boolean;
  canMove: boolean;
  dungeon?: ProceduralDungeon;
  battlemap?: Battlemap;
  onInteractObject?: (type: string, x: number, y: number) => void;
  busy?: boolean;
  activeTurnId?: string;
  npcs?: MapNpc[];
  onTalkNpc?: (npcId: string) => void;
  projectiles?: ProjectileVfx[];
  movementUsed?: number;
  biome?: 'village' | 'forest' | 'dungeon';
  onInteractPlayer?: (hero: Character) => void;
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
  locationName,
  locationLabel,
  isCombat,
  canMove,
  dungeon,
  battlemap,
  onInteractObject,
  busy,
  activeTurnId,
  npcs,
  onTalkNpc,
  projectiles,
  movementUsed = 0,
  biome = 'village',
  onInteractPlayer
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
  const currentBiome: 'village' | 'forest' | 'dungeon' =
    biome ||
    (battlemap?.biome as any) ||
    (locationName.toLowerCase().includes('floresta') ? 'forest' : locationName.toLowerCase().includes('dungeon') || locationName.toLowerCase().includes('catacumba') ? 'dungeon' : 'village');

  const collisionProfile = MAP_COLLISION_PROFILES[currentBiome] || MAP_COLLISION_PROFILES.village;
  const gridSize = customGridSize || collisionProfile.gridSize || (battlemap ? battlemap.width : dungeon ? dungeon.width : 8);
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
    const speed = activeHero?.speed || 9;
    return calculateMovementBudget(speed, movementUsed);
  }, [activeHero?.speed, movementUsed]);

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
      if (walk) {
        return { ...c, x: walk.x, y: walk.y, isWalking: Boolean(walk.isWalking) } as Character & { isWalking?: boolean };
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
        // RETAIN final destination in state so token NEVER rubberbands back
        setWalkingHeroes((prev) => ({
          ...prev,
          [heroId]: { x: finalDest.x, y: finalDest.y, isWalking: false }
        }));
        if (isLocalInitiator) {
          onMoveHero(heroId, finalDest.x, finalDest.y);
        }
      }
    }, stepInterval);
  };

  // Sync remote player walks received via WebSocket Durable Object
  useEffect(() => {
    if (remoteWalkPath && remoteWalkPath.waypoints && remoteWalkPath.waypoints.length > 1) {
      if (remoteWalkPath.seq !== lastRemoteSeqRef.current) {
        lastRemoteSeqRef.current = remoteWalkPath.seq;
        const isCurrentHeroWalking = walkingHeroes[remoteWalkPath.characterId]?.isWalking;
        if (!isCurrentHeroWalking) {
          animateHeroPath(remoteWalkPath.characterId, remoteWalkPath.waypoints, false);
        }
      }
    }
  }, [remoteWalkPath, walkingHeroes]);

  // A* calculated path from active hero to hovered square navigating obstacles
  const activePath = useMemo(() => {
    if (!hoveredSquare || !activeHero || targetingAction) return [];
    if (currentHeroX === hoveredSquare.x && currentHeroY === hoveredSquare.y) return [];
    return findPathAStar(
      { x: currentHeroX, y: currentHeroY },
      hoveredSquare,
      currentBiome,
      gridSize,
      occupiedTiles,
      activeZones
    );
  }, [activeHero, currentHeroX, currentHeroY, hoveredSquare, targetingAction, currentBiome, gridSize, occupiedTiles, activeZones]);

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

  // Helper to determine tile type
  const getTileInfo = (x: number, y: number) => {
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
            <img
              src={collisionProfile.imageSrc}
              alt="Mapa Ilustrado"
              className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none z-0"
            />

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
              const tileNpcs = isVillage ? (npcs || []).filter((n) => n.x === x && n.y === y) : [];
              const tileHeroes = displayHeroes.filter((c) => c.x === x && c.y === y);
              const tileEnemies = enemies.filter((e) => e.x === x && e.y === y && e.hp > 0);
              const hasEntities = tileHeroes.length > 0 || tileEnemies.length > 0 || tileNpcs.length > 0;

              const isTileActiveHero = isCombat && tileHeroes.some((h) => h.id === activeTurnId);
              const isTileActiveEnemy = isCombat && tileEnemies.some((e) => e.id === activeTurnId);

              const tile = getTileInfo(x, y);
              const tType = tile.type;
              const isCenterCampfire = x === Math.floor(gridSize / 2) && y === Math.floor(gridSize / 2);

              const isWalkable = isGridTileWalkable(currentBiome, x, y, gridSize, activeZones);
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
                      const enemyTarget = tileEnemies[0];
                      if (enemyTarget && inRange) {
                        onTargetEnemy(enemyTarget.id);
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
                      setContextEnemy(tileEnemies[0]);
                      onSelectToken('enemy', tileEnemies[0].id);
                    } else if (['chest', 'shrine', 'stairs', 'well'].includes(tType)) {
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
                  {/* Organic Visual Embellishments */}
                {illuminated && (
                  <>
                    {/* Water flow line */}
                    {tType === 'water' && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-40">
                        <Droplets size={10} className="text-sky-300 animate-pulse" />
                      </div>
                    )}

                    {/* Wooden Bridge Planks */}
                    {tType === 'bridge' && (
                      <div className="absolute inset-0 flex flex-col justify-between py-0.5 px-0.5 opacity-60 pointer-events-none">
                        <div className="h-0.5 w-full bg-amber-900" />
                        <div className="h-0.5 w-full bg-amber-900" />
                        <div className="h-0.5 w-full bg-amber-900" />
                      </div>
                    )}

                    {/* Tree Foliage Canopy */}
                    {tType === 'tree' && (
                      <div
                        className="w-4/5 h-4/5 rounded-full bg-emerald-800 border border-emerald-600 shadow-md flex items-center justify-center"
                        title="Árvore / Bosque (Concede cobertura)"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-900/80" />
                      </div>
                    )}

                    {/* Stone Well */}
                    {tType === 'well' && (
                      <div
                        className="w-4/5 h-4/5 rounded-full bg-stone-700 border-2 border-stone-500 flex items-center justify-center shadow"
                        title="Poço da Vila (Água fresca)"
                      >
                        <div className="w-2 h-2 rounded-full bg-sky-500" />
                      </div>
                    )}

                    {/* Chest */}
                    {tType === 'chest' && (
                      <div
                        className="w-5 h-5 rounded-md bg-amber-950/90 border border-amber-400 flex items-center justify-center text-amber-300 animate-bounce"
                        title="Baú de Suprimentos (Examinar)"
                      >
                        <Package size={11} />
                      </div>
                    )}

                    {/* Shrine / Menir */}
                    {tType === 'shrine' && (
                      <div
                        className="w-5 h-5 rounded-full bg-emerald-950/90 border border-emerald-400 flex items-center justify-center text-emerald-300 animate-pulse"
                        title="Altar Sagrado / Menir dos Druidas"
                      >
                        <Sparkles size={11} />
                      </div>
                    )}

                    {/* Stairs */}
                    {tType === 'stairs' && (
                      <div
                        className="w-5 h-5 rounded-md bg-purple-950/90 border border-purple-400 flex items-center justify-center text-purple-300 animate-pulse"
                        title="Escadas para o Próximo Nível"
                      >
                        <ArrowDownCircle size={12} />
                      </div>
                    )}
                    {/* Campfire (Center feature as seen in reference image) */}
                    {isCenterCampfire && (
                      <div className="relative flex items-center justify-center pointer-events-none" title="Fogueira Central">
                        <div className="absolute w-8 h-8 rounded-full campfire-ambient opacity-75 pointer-events-none" />
                        <Flame size={18} className="text-amber-400 animate-bounce relative z-10 drop-shadow-[0_0_10px_rgba(245,158,11,1)]" />
                      </div>
                    )}
                  </>
                )}

                {/* Movement distance preview tooltip */}
                {isHovered && activePath.length > 1 && !hasEntities && illuminated && (
                  <div className="absolute -top-6 z-30 pointer-events-none bg-black/95 border border-zinc-700 px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-200 whitespace-nowrap shadow-md">
                    <span className={isPathAffordable ? 'text-emerald-400' : 'text-red-400'}>
                      {pathMeters}m ({pathStepCount}q)
                    </span>
                  </div>
                )}

                {/* TOKENS */}
                {/* 1. Heroes */}
                {tileHeroes.map((hero) => {
                  const isSelected = hero.id === selectedHeroId;
                  const isActiveTurn = isCombat && (hero.id === activeTurnId);
                  const hpRatio = hero.hp / hero.maxHp;
                  const conditions = (hero as any).conditions || [];
                  const statusClasses = conditions.map((c: string) => getStatusClass(c)).filter(Boolean).join(' ');

                  // Fallen / Dead Hero Token (Do NOT let token disappear into thin air)
                  if (hero.hp <= 0) {
                    return (
                      <div
                        key={hero.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInteractPlayer && hero.id !== selectedHeroId) {
                            onInteractPlayer(hero);
                          } else {
                            onSelectToken('hero', hero.id);
                          }
                        }}
                        className="relative z-10 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex flex-col items-center justify-center cursor-pointer ring-2 ring-red-700 bg-gradient-to-br from-zinc-950 via-red-950 to-black grayscale opacity-80 token-smooth-glide shadow-lg"
                        title={`${hero.name} (INCONSCIENTE / 0 PV)`}
                      >
                        <span className="text-sm select-none drop-shadow">💀</span>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-950 border border-red-700 text-red-300 font-mono text-[7px] px-1 rounded-full uppercase tracking-tight whitespace-nowrap z-20">
                          0 PV
                        </div>
                      </div>
                    );
                  }

                    return (
                      <div
                        key={hero.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInteractPlayer && hero.id !== selectedHeroId) {
                            onInteractPlayer(hero);
                          } else {
                            onSelectToken('hero', hero.id);
                          }
                        }}
                      className={`relative z-10 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex flex-col items-center justify-center cursor-pointer ${(hero as any).isWalking ? 'token-walking-active' : 'token-human-sway'} token-smooth-glide ${
                        isActiveTurn
                          ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-black scale-115 shadow-[0_0_25px_rgba(251,191,36,0.9)] token-selected-pulse'
                          : isSelected
                          ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black scale-110 token-selected-pulse'
                          : 'ring-[1.5px] ring-amber-600/70 shadow-lg hover:scale-105'
                      } bg-gradient-to-br from-[#2d2417] via-[#1a1711] to-black transition-transform ${statusClasses}`}
                      title={`${hero.name} (${hero.hp}/${hero.maxHp} PV)${isActiveTurn ? ' • SEU TURNO ATIVO' : ''}`}
                    >
                      {/* Active Turn Pulsing Halo */}
                      {isActiveTurn && (
                        <div className="absolute -inset-2 rounded-full border-2 border-amber-400 animate-ping opacity-60 pointer-events-none" />
                      )}

                      {/* Turn Badge on Token */}
                      {isActiveTurn && (
                        <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-black font-black text-[7px] sm:text-[8px] px-1 rounded-full uppercase tracking-wider shadow-lg z-30 animate-pulse pointer-events-none whitespace-nowrap">
                          VEZ
                        </div>
                      )}

                      {/* VFX Overlay */}
                      {activeVfx[hero.id] && <div className={activeVfx[hero.id]} />}

                      {/* Mini HP Bar (Dinamica, ACIMA do token) */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[130%] max-w-[42px] h-[5px] bg-black/95 rounded-full border border-zinc-500/80 overflow-hidden shadow-lg z-20">
                        <div
                          style={{ width: `${Math.min(100, hpRatio * 100)}%` }}
                          className={`h-full transition-all duration-500 ease-out ${
                            hpRatio > 0.5 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : hpRatio > 0.2 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-600 to-red-400'
                          }`}
                        />
                      </div>

                      {/* HP Number (appears on hover/selected, above the HP bar) */}
                      {(isSelected || isActiveTurn) && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-amber-500/60 px-1.5 py-0 rounded text-[8px] font-mono font-bold text-amber-200 whitespace-nowrap z-30 shadow-md pointer-events-none">
                          {hero.hp}/{hero.maxHp}
                        </div>
                      )}

                      {/* Status Effect Dots */}
                      {conditions.length > 0 && (
                        <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                          {conditions.slice(0, 3).map((c: string, i: number) => (
                            <div key={i} className={`w-[5px] h-[5px] rounded-full ${getStatusDotColor(c)} shadow-sm`} title={c} />
                          ))}
                        </div>
                      )}

                      {/* Token Letter */}
                      <span className="font-serif font-black text-[11px] sm:text-sm text-amber-100 drop-shadow-sm">
                        {hero.name[0]}
                      </span>
                    </div>
                  );
                })}

                {/* 2. Enemies */}
                {tileEnemies.map((enemy) => {
                  const isSelected = enemy.id === selectedEnemyId;
                  const isActiveTurn = isCombat && (enemy.id === activeTurnId);
                  const hpRatio = enemy.hp / enemy.maxHp;
                  const conditions = (enemy as any).conditions || [];
                  const statusClasses = conditions.map((c: string) => getStatusClass(c)).filter(Boolean).join(' ');
                  const isTargeted = targetingAction && inRange;

                  return (
                    <div
                      key={enemy.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (targetingAction && inRange) {
                          onTargetEnemy(enemy.id);
                        } else {
                          onSelectToken('enemy', enemy.id);
                          setContextEnemy(enemy);
                        }
                      }}
                      className={`relative z-10 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex flex-col items-center justify-center cursor-pointer token-smooth-glide token-human-sway ${
                        isActiveTurn
                          ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-black scale-115 shadow-[0_0_25px_rgba(239,68,68,0.9)] token-target-pulse'
                          : isSelected
                          ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-black scale-110 token-target-pulse'
                          : isTargeted
                          ? 'ring-2 ring-amber-400/80 ring-offset-1 ring-offset-black scale-105 animate-pulse'
                          : 'ring-[1.5px] ring-red-700/80 shadow-lg hover:scale-105'
                      } bg-gradient-to-br from-red-800 via-red-950 to-zinc-950 transition-transform ${statusClasses}`}
                      title={`${enemy.name} (${enemy.hp}/${enemy.maxHp} PV) • CA ${enemy.ac}${isActiveTurn ? ' • TURNO ATIVO' : ''}`}
                    >
                      {/* Active Turn Pulsing Halo */}
                      {isActiveTurn && (
                        <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-ping opacity-60 pointer-events-none" />
                      )}

                      {/* Turn Badge on Token */}
                      {isActiveTurn && (
                        <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-[7px] sm:text-[8px] px-1 rounded-full uppercase tracking-wider shadow-lg z-30 animate-pulse pointer-events-none whitespace-nowrap">
                          VEZ
                        </div>
                      )}

                      {/* VFX Overlay */}
                      {activeVfx[enemy.id] && <div className={activeVfx[enemy.id]} />}

                      {/* Mini HP Bar (Dinamica, ACIMA do token) */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[130%] max-w-[42px] h-[5px] bg-black/95 rounded-full border border-zinc-500/80 overflow-hidden shadow-lg z-20">
                        <div
                          style={{ width: `${Math.min(100, hpRatio * 100)}%` }}
                          className={`h-full transition-all duration-500 ease-out ${
                            hpRatio > 0.5 ? 'bg-gradient-to-r from-red-500 to-rose-400' : hpRatio > 0.2 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-red-700 to-red-500'
                          }`}
                        />
                      </div>

                      {/* HP Number (appears on hover/selected, above the HP bar) */}
                      {isSelected && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-red-600/60 px-1.5 py-0 rounded text-[8px] font-mono font-bold text-red-200 whitespace-nowrap z-30 shadow-md pointer-events-none">
                          {enemy.hp}/{enemy.maxHp}
                        </div>
                      )}

                      {/* Status Effect Dots */}
                      {conditions.length > 0 && (
                        <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                          {conditions.slice(0, 3).map((c: string, i: number) => (
                            <div key={i} className={`w-[5px] h-[5px] rounded-full ${getStatusDotColor(c)} shadow-sm`} title={c} />
                          ))}
                        </div>
                      )}

                      {/* Targeting Reticle Overlay */}
                      {isTargeted && (
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/70 animate-spin-slow pointer-events-none z-15" />
                      )}

                      {/* Token Letter */}
                      <span className="font-serif font-black text-[11px] sm:text-sm text-red-200 drop-shadow-sm">
                        {enemy.name[0]}
                      </span>

                      {/* FLOATING CONTEXT ACTION MENU ANCHORED BESIDE THE TOKEN */}
                      {contextEnemy?.id === enemy.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute z-[60] w-64 sm:w-72 bg-zinc-950/98 border-2 border-red-500/90 rounded-2xl p-3 shadow-[0_0_35px_rgba(239,68,68,0.5)] backdrop-blur-2xl pointer-events-auto cursor-default animate-fade-in text-left ${
                            enemy.x >= 9 ? 'right-full mr-3' : 'left-full ml-3'
                          } ${
                            enemy.y >= 10 ? 'bottom-0' : 'top-1/2 -translate-y-1/2'
                          }`}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-zinc-800/80">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-red-950 border border-red-500/80 flex items-center justify-center font-serif font-black text-red-200 text-sm shadow">
                                {enemy.name[0]}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-red-200 text-xs sm:text-sm leading-tight truncate">
                                  {enemy.name}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                                  <span className="text-red-400 font-bold">{enemy.hp}/{enemy.maxHp} PV</span>
                                  <span className="text-amber-400">CA {enemy.ac}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setContextEnemy(null);
                              }}
                              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Fechar"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {/* Action Buttons based on Hero class */}
                          <div className="flex flex-col gap-1.5">
                            {/* 1. Main Weapon / Attack */}
                            <button
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTargetEnemy(enemy.id);
                                setContextEnemy(null);
                              }}
                              className="w-full flex items-center gap-2 p-2 bg-gradient-to-r from-red-950/90 to-zinc-900 border border-red-600/60 hover:border-red-400 rounded-xl text-left group transition-all cursor-pointer shadow active:scale-98"
                            >
                              <div className="w-7 h-7 rounded-lg bg-red-900/80 border border-red-500/60 flex items-center justify-center text-red-300 shrink-0 group-hover:scale-110 transition-transform">
                                <Swords size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-red-200 truncate">
                                  {activeHero?.weapon || 'Atacar'}
                                </div>
                                <div className="text-[9px] font-mono text-red-400/80">
                                  {activeHero?.damage || '1d8'} dano
                                </div>
                              </div>
                            </button>

                            {/* 2. Spell Attack (ONLY if hero is a spellcaster) */}
                            {['Mago', 'Clérigo', 'Druida', 'Bruxo', 'Bardo', 'Feiticeiro'].includes(activeHero?.className || '') && (
                              <button
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTargetEnemy(enemy.id);
                                  setContextEnemy(null);
                                }}
                                className="w-full flex items-center gap-2 p-2 bg-gradient-to-r from-purple-950/90 to-zinc-900 border border-purple-600/60 hover:border-purple-400 rounded-xl text-left group transition-all cursor-pointer shadow active:scale-98"
                              >
                                <div className="w-7 h-7 rounded-lg bg-purple-900/80 border border-purple-500/60 flex items-center justify-center text-purple-300 shrink-0 group-hover:scale-110 transition-transform">
                                  <Sparkles size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold text-purple-200 truncate">
                                    {activeHero?.className === 'Clérigo'
                                      ? 'Chama Sagrada'
                                      : activeHero?.className === 'Bruxo'
                                      ? 'Rajada Mística'
                                      : 'Raio de Fogo'}
                                  </div>
                                  <div className="text-[9px] font-mono text-purple-400/80">
                                    {activeHero?.className === 'Clérigo' ? '1d8 radiante' : '1d10 mágico'}
                                  </div>
                                </div>
                              </button>
                            )}

                            {/* 3. Inspect target */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectToken('enemy', enemy.id);
                                setContextEnemy(null);
                              }}
                              className="w-full flex items-center gap-2 p-1.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 hover:border-amber-500/60 rounded-xl text-left transition-all cursor-pointer"
                            >
                              <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                                <Info size={12} />
                              </div>
                              <span className="text-[10px] font-medium text-zinc-300">
                                Inspecionar / Focar Alvo
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 3. Village NPCs */}
                {tileNpcs.map((npc) => {
                  const dist = activeHero ? Math.max(Math.abs(activeHero.x - (npc.x ?? -1)), Math.abs(activeHero.y - (npc.y ?? -1))) : 99;
                  const isNear = dist <= 1;

                  return (
                    <div
                      key={npc.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isNear) {
                          onTalkNpc?.(npc.id);
                        }
                      }}
                      className={`relative z-15 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${
                        isNear
                          ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black npc-talk-glow shadow-[0_0_18px_rgba(245,158,11,0.7)] scale-105'
                          : 'ring-[1.5px] ring-emerald-500/70 opacity-90 shadow-md'
                      } bg-gradient-to-br from-[#1b3320] via-[#102415] to-[#0a140c]`}
                      title={`${npc.name} • ${npc.role}${isNear ? ' (Perto: clique para conversar)' : ' (Aproxime-se a 1,5m para conversar)'}`}
                    >
                      {/* Speech bubble button when player is in close proximity */}
                      {isNear && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTalkNpc?.(npc.id);
                          }}
                          className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-black font-black text-[8px] sm:text-[9px] shadow-[0_0_12px_rgba(245,158,11,0.9)] cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                        >
                          <span>💬 Falar</span>
                        </button>
                      )}

                      {/* NPC Token Icon */}
                      <span className="text-xs sm:text-sm drop-shadow-md select-none">
                        {npc.id === 'doran' ? '🧙' : npc.id === 'elenor' ? '🧪' : npc.id === 'kaelen' ? '🛡️' : '👤'}
                      </span>

                      {/* Mini Name Pill beneath token */}
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-emerald-500/60 text-emerald-300 font-serif font-bold text-[7px] sm:text-[8px] px-1 py-0 rounded-full tracking-tight whitespace-nowrap z-20 pointer-events-none shadow">
                        {npc.name.split(' ')[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
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
