'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import {
  Swords,
  BookOpen,
  Users,
  Map as MapIcon,
  Dices,
  Settings,
  Flame,
  ChevronRight,
  Plus,
  Send,
  Shield,
  Heart,
  Footprints,
  ScrollText,
  Search,
  RefreshCw,
  Moon,
  ArrowUpRight,
  Skull,
  Package,
  Sparkles,
  MessageSquare,
  Compass,
  X,
  Menu,
  Trash2,
  Hand,
  Coffee,
  Clock,
  Crosshair,
  MapPin,
  Crown
} from 'lucide-react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';

import {
  abilities,
  classes,
  species,
  skills,
  conditions,
  mod,
  prof,
  signed,
  newCharacter,
  initialState,
  starterState,
  locations,
  resolveAttack,
  calculateEquippedStats,
  ITEMS_CATALOG,
  SPELLS_CATALOG,
  type Character,
  type State,
  type Enemy,
  type WsServerMessage
} from '@/lib/game-engine';

import type { Point } from '@/lib/collision-system';
import { GM_PROMPT } from '@/lib/gm-prompt';
// New CRPG Digital Video Game Components
import { FloatingTextOverlay, type FloatingNumber } from '@/components/game/floating-text';
import { DiceRoller3D, type DiceRollEvent } from '@/components/game/dice-roller-3d';
import { TopEnemyHud } from '@/components/game/top-enemy-hud';
import { BottomPlayerHud, type ActionSelection } from '@/components/game/bottom-player-hud';
import { TacticalMap, type ProjectileVfx } from '@/components/game/tactical-map';
import { InventoryPanel } from '@/components/game/inventory-panel';
import { ShopModal, type ShopMerchant } from '@/components/game/shop-modal';
import { NpcDialog, type NpcDialogData } from '@/components/game/npc-dialog';
import { ExplorationBar } from '@/components/game/exploration-bar';
import { QuestLog } from '@/components/game/quest-log';
import { CampaignTracker } from '@/components/game/campaign-tracker';
import { MobileDrawer } from '@/components/game/mobile-drawer';
import { MobileActionCluster } from '@/components/game/mobile-action-cluster';
import { CharacterCreator } from '@/components/game/character-creator';
import { CAMPAIGN_ACTS, type CampaignAct } from '@/lib/campaign-data';
import { generateProceduralDungeon, type ProceduralDungeon, type TileType } from '@/lib/dungeon-generator';
import { generateRandomNpc, type GeneratedNpc } from '@/lib/npc-generator';
import { generateBattlemap, type Battlemap, type BiomeType } from '@/lib/battlemap-biomes';
import { PartySidebar } from '@/components/game/party-sidebar';
import { InitiativeRibbon } from '@/components/game/initiative-ribbon';
import { GamemasterSidebar } from '@/components/game/gamemaster-sidebar';
import { LevelUpModal } from '@/components/game/level-up-modal';
import { MICRO_ADVENTURES, startMicroAdventure, completeMicroAdventure } from '@/lib/micro-adventures';
import { spawnDragonBoss, getDragonCombatPhase, executeDragonBreath } from '@/lib/dragon-encounter';
import { playSfx } from '@/lib/sound-effects';

type ApiData = {
  error: string;
  signedIn: boolean;
  user: string;
  rooms: { id: string; name: string }[];
  room: Room;
  id: string;
  searchHtml: string;
  choices?: string[];
  attackResult?: any;
};

type Room = {
  id: string;
  owner: string;
  name: string;
  code: string;
  version: number;
  state: State;
};

const navigation = [
  { icon: Swords, name: 'Aventura' },
  { icon: Users, name: 'Personagens' },
  { icon: BookOpen, name: 'Compêndio' },
  { icon: MapIcon, name: 'Atlas' },
  { icon: Settings, name: 'Mestre de jogo' }
];

function Pick({
  value,
  options,
  onChange,
  label
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <label className="field">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((x) => (
            <SelectItem key={x} value={x}>
              {x}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function createInitialRoom(): Room {
  const st = initialState();
  return {
    id: '',
    owner: '',
    name: 'Vila do Rio Verde',
    code: '',
    version: 0,
    state: st
  };
}

const playCombatSound = (type: 'hit' | 'crit' | 'miss') => {
  try {
    playSfx(type);
  } catch (e) {}
};

export default function Game() {
  const [view, setView] = useState('Aventura');
  const [room, setRoom] = useState<Room | null>(() => createInitialRoom());
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [user, setUser] = useState('');
  const [signedIn, setSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [selectedEnemyId, setSelectedEnemyId] = useState('');
  const [character, setCharacter] = useState<Character | null>(null);
  const [roomDialog, setRoomDialog] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [roomName, setRoomName] = useState('Vila do Rio Verde');
  const [formula, setFormula] = useState('1d20');
  const [mode, setMode] = useState('normal');
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [search, setSearch] = useState(true);
  const [searchHtml, setSearchHtml] = useState('');
  const [notes, setNotes] = useState('');
  const [npcName, setNpcName] = useState('');
  const [npcRole, setNpcRole] = useState('');
  const [npcDesc, setNpcDesc] = useState('');

  // Digital Video Game States
  const [floatingTexts, setFloatingTexts] = useState<FloatingNumber[]>([]);
  const [hitStopType, setHitStopType] = useState<'normal' | 'crit' | null>(null);
  const [currentDiceRoll, setCurrentDiceRoll] = useState<DiceRollEvent | null>(null);
  const [targetingAction, setTargetingAction] = useState<ActionSelection | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpHero, setLevelUpHero] = useState<Character | null>(null);
  const [activeNpcDialog, setActiveNpcDialog] = useState<NpcDialogData | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [shopMerchant, setShopMerchant] = useState<ShopMerchant | null>(null);
  const [aiChoices, setAiChoices] = useState<string[]>([]);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  // New CRPG Campaign, Procedural Dungeon & Mobile States
  const [mobileTab, setMobileTab] = useState<'party' | 'map' | 'gm'>('map');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [showCharacterCreator, setShowCharacterCreator] = useState(false);
  const creatorDismissedRef = React.useRef(false); // Guard: once user closes creator, don't re-open via load()
  const [showWorldSelector, setShowWorldSelector] = useState(false); // World selection screen
  const [interactingPlayer, setInteractingPlayer] = useState<Character | null>(null);
  const actionQueueRef = React.useRef(Promise.resolve<any>(null));
  const localMoveShieldRef = React.useRef<{ [charId: string]: { x: number; y: number; time: number } }>({});
  const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const clientSeqRef = React.useRef<number>(1);
  const isWsConnectedRef = React.useRef<boolean>(false);
  const isSseConnectedRef = React.useRef<boolean>(false);
  const isSyncFetchingRef = React.useRef<boolean>(false);
  const selectedRef = React.useRef<string>(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const selectedEnemyIdRef = React.useRef<string>(selectedEnemyId);
  useEffect(() => {
    selectedEnemyIdRef.current = selectedEnemyId;
  }, [selectedEnemyId]);
  const userRef = React.useRef<string>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [remoteWalkPath, setRemoteWalkPath] = useState<{ characterId: string; waypoints: Point[]; seq: number } | null>(null);
  const [showPartySidebar, setShowPartySidebar] = useState(true);
  const [showGmSidebar, setShowGmSidebar] = useState(false);
  const [showNarrativeBox, setShowNarrativeBox] = useState(true);
  const [activeProjectiles, setActiveProjectiles] = useState<ProjectileVfx[]>([]);

  // Physical token recoil, slash/heal VFX and loot sparkles
  const [tokenRecoils, setTokenRecoils] = useState<Record<string, { dx: number; dy: number; type: 'hit' | 'crit' | 'miss' | 'heal'; timestamp: number }>>({});
  const [slashVfx, setSlashVfx] = useState<Record<string, { timestamp: number }>>({});
  const [healVfx, setHealVfx] = useState<Record<string, { timestamp: number }>>({});
  const [lootSparkles, setLootSparkles] = useState<{ x: number; y: number; id: string }[]>([]);

  const pendingVfxRef = React.useRef<{
    projectile: ProjectileVfx;
    floatingText: FloatingNumber;
    narrateCtx: string;
    shouldNarrate?: boolean;
    targetId?: string;
    attackerPos?: { x: number; y: number };
    targetPos?: { x: number; y: number };
    isMelee?: boolean;
  } | null>(null);
  const [isBottomHudMinimized, setIsBottomHudMinimized] = useState(false);
  const [currentAct, setCurrentAct] = useState<1 | 2 | 3>(1);
  const [dungeonSize, setDungeonSize] = useState<8 | 12 | 16>(12);
  const [dungeonSeed, setDungeonSeed] = useState<number>(() => Date.now());
  const [proceduralDungeon, setProceduralDungeon] = useState<ProceduralDungeon>(() =>
    generateProceduralDungeon(1, 12, 12345)
  );
  const [battlemapBiome, setBattlemapBiome] = useState<BiomeType>('village');
  const [battlemapSeed, setBattlemapSeed] = useState<number>(() => Date.now());
  const [organicBattlemap, setOrganicBattlemap] = useState<Battlemap>(() =>
    generateBattlemap('village', 12, 12345)
  );

  // Trigger tactile token impact recoil
  const triggerRecoil = useCallback((
    targetId: string,
    attackerPos?: { x: number; y: number } | null,
    targetPos?: { x: number; y: number } | null,
    type: 'hit' | 'crit' | 'miss' | 'heal' = 'hit'
  ) => {
    let dx = 0;
    let dy = 0;
    if (type === 'heal') {
      dy = -12;
    } else if (type === 'miss') {
      dx = (Math.random() > 0.5 ? 1 : -1) * 14;
    } else if (attackerPos && targetPos) {
      const angle = Math.atan2(targetPos.y - attackerPos.y, targetPos.x - attackerPos.x);
      const force = type === 'crit' ? 24 : 14;
      dx = Math.cos(angle) * force;
      dy = Math.sin(angle) * force;
    } else {
      dx = (Math.random() - 0.5) * 18;
      dy = (Math.random() - 0.5) * 18;
    }
    setTokenRecoils((prev) => ({
      ...prev,
      [targetId]: { dx, dy, type, timestamp: Date.now() }
    }));
    setTimeout(() => {
      setTokenRecoils((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    }, 450);
  }, []);


  // Escape key listener to exit targeting mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && targetingAction) {
        setTargetingAction(null);
        setIsBottomHudMinimized(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [targetingAction]);

  // Reference to prevent stale closures during async operations
  const roomRef = React.useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Shield local optimistic coordinates against stale network rollbacks
  const applyProtectedRoomState = useCallback((newRoom: Room) => {
    setRoom((prev) => {
      if (!prev) return newRoom;

      const now = Date.now();
      const incomingChars: Character[] = newRoom.state?.characters || [];
      const prevChars = prev.state?.characters || [];

      // Authoritative active character list from server, protected against optimistic rollback
      // for the local player's recent movements (2500ms safety window for Render latency)
      const activeCharIds = new Set(incomingChars.map((c) => c.id));
      const protectedChars = incomingChars.map((char: Character) => {
        const shield = localMoveShieldRef.current[char.id];
        if (shield) {
          if (now - shield.time < 2500) {
            return { ...char, x: shield.x, y: shield.y };
          } else {
            delete localMoveShieldRef.current[char.id];
          }
        }
        return char;
      });

      // Preserve newly created / optimistic hero locally only if currently under an active rollback shield
      for (const c of prevChars) {
        if (!activeCharIds.has(c.id)) {
          const shield = localMoveShieldRef.current[c.id];
          if (shield && now - shield.time < 2500) {
            protectedChars.push({ ...c, x: shield.x, y: shield.y });
          }
        }
      }

      // Authoritative enemy sync:
      // Scope enemies strictly to current player/party biome without blanket village wiping in MMO
      const isMmo = newRoom.id === 'mmo-world-village';
      const curHero = protectedChars.find((c) => c.id === selectedRef.current);
      const heroBiome = curHero?.biome || (isMmo ? 'village' : (newRoom.state?.biome || 'village'));
      let authoritativeEnemies = (newRoom.state?.enemies || []).filter((e) => {
        if (heroBiome === 'village') return false;
        if (e.biome && e.biome !== heroBiome) return false;
        if (curHero?.partyId && e.partyId && e.partyId !== curHero.partyId) return false;
        if (!curHero?.partyId && e.ownerCharId && e.ownerCharId !== curHero?.id) return false;
        return true;
      });

      // Clear selected enemy if no longer in battle
      const curEnemyId = selectedEnemyIdRef.current;
      if (curEnemyId && !authoritativeEnemies.some((e) => e.id === curEnemyId)) {
        setSelectedEnemyId('');
      }

      const protectedRoom: Room = {
        ...newRoom,
        version: Math.max(prev.version, newRoom.version),
        state: {
          ...prev.state,
          ...newRoom.state,
          characters: protectedChars,
          enemies: authoritativeEnemies.sort((a, b) => a.initiative - b.initiative)
        }
      };
      roomRef.current = protectedRoom;
      return protectedRoom;
    });
  }, []);

  // Data Loading
  const load = useCallback(async (id?: string) => {
    try {
      const storedRoom = typeof window !== 'undefined' ? localStorage.getItem('last_active_room_id') : null;
      const targetRoomId = id || roomRef.current?.id || storedRoom || 'mmo-world-village';
      const r = await fetch('/api/game?room=' + encodeURIComponent(targetRoomId));
      const d = (await r.json()) as ApiData;
      if (!r.ok) {
        if (id) {
          console.warn(`Mesa ${id} temporariamente indisponível (${d.error}), mantendo mesa ativa.`);
          return d;
        }
        throw Error(d.error);
      }
      if (!d.signedIn) {
        if (typeof window !== 'undefined') {
          window.location.href = '/signin-with-chatgpt?return_to=' + encodeURIComponent(window.location.pathname);
        }
        return;
      }
      setSignedIn(d.signedIn);
      setUser(d.user || '');
      if (d.rooms && d.rooms.length > 0) setRooms(d.rooms);
      if (d.room) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_active_room_id', d.room.id);
        }
        applyProtectedRoomState(d.room);

        const heroes = d.room.state.characters || [];
        const isMmo = d.room.id === 'mmo-world-village';
        const myHeroes = heroes.filter((c: Character) => isMmo ? c.owner === d.user : (!c.owner || c.owner === d.user));

        // ── Sync currentAct from hero progression in MMO or server room state ──
        const activeHeroAct = myHeroes[0]?.act;
        const serverAct = isMmo ? (activeHeroAct || d.room.state.act || 1) : (d.room.state.act || (d.room.state.location + 1));
        if ([1, 2, 3].includes(serverAct)) {
          setCurrentAct(serverAct as 1 | 2 | 3);
        }
        setSelected((p) => {
          if (p && myHeroes.some((c: Character) => c.id === p)) {
            return p;
          }
          return myHeroes[0]?.id || (!isMmo ? heroes[0]?.id : '') || '';
        });
        setSelectedEnemyId((e) =>
          d.room.state.enemies.some((en: Enemy) => en.id === e)
            ? e
            : d.room.state.enemies[0]?.id || ''
        );
        // Only show character creator if user has NO heroes AND hasn't dismissed it this session
        if ((heroes.length === 0 || (isMmo && myHeroes.length === 0)) && !creatorDismissedRef.current) {
          setShowWorldSelector(true); // Show world selector first, then creator
        }
        // Never re-open creator if user already has heroes
        if (myHeroes.length > 0 || heroes.length > 0) {
          setShowCharacterCreator(false);
        }
      }
      return d;
    } catch (e) {
      console.warn('Sync notice:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyProtectedRoomState]);

  useEffect(() => {
    const initialRoom = (typeof window !== 'undefined' && localStorage.getItem('last_active_room_id')) || 'mmo-world-village';
    void load(initialRoom);
  }, [load]);

  // Handle wipe URL parameter detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('wiped') === '1') {
        creatorDismissedRef.current = false;
        setShowWorldSelector(true);
        url.searchParams.delete('wiped');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    }
  }, []);

  // REAL-TIME MULTIPLAYER SYNCHRONIZATION: Cloudflare WebSocket + Durable Objects (Native Real-Time Push)
  // + Local BroadcastChannel (0ms local cross-window sync) + Automatic Reconnection & Snapshot Sync
  useEffect(() => {
    if (!room?.id || typeof window === 'undefined') return;

    const roomId = room.id;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let fallbackPollingTimer: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let bc: BroadcastChannel | null = null;
    let isDisposed = false;

    // 1. BroadcastChannel for instant (0ms) sync between tabs and windows on the same PC
    try {
      bc = new BroadcastChannel(`mmo_sync_${roomId}`);
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data?.type === 'ROOM_MUTATION' && event.data?.room) {
          applyProtectedRoomState(event.data.room);
        } else if (event.data?.type === 'HERO_MOVE') {
          const { heroId, x, y } = event.data;
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              state: {
                ...prev.state,
                characters: prev.state.characters.map((c) => (c.id === heroId ? { ...c, x, y } : c))
              }
            };
          });
        } else if (event.data?.type === 'HERO_MOVE_PATH') {
          const { heroId, waypoints } = event.data;
          setRemoteWalkPath({
            characterId: heroId,
            waypoints,
            seq: ++clientSeqRef.current
          });
        }
      };
    } catch {
      // BroadcastChannel fallback
    }

    // 2. Fallback Polling Loop (Sub-second 400ms when disconnected from Push)
    const ensureFallbackPolling = () => {
      if (isDisposed || fallbackPollingTimer) return;
      fallbackPollingTimer = setInterval(() => {
        if (!isDisposed && !isSyncFetchingRef.current && !isWsConnectedRef.current && !isSseConnectedRef.current) {
          isSyncFetchingRef.current = true;
          void load(roomId).finally(() => {
            isSyncFetchingRef.current = false;
          });
        }
      }, 400);
    };

    // 3. Server-Sent Events (SSE) Push Transport (100% Cloud-Host Resilient Real-Time Push)
    let es: EventSource | null = null;
    let sseReconnectTimeout: NodeJS.Timeout | null = null;

    const connectSse = () => {
      if (isDisposed) return;
      try {
        const myCharId = selectedRef.current || '';
        const myUserId = userRef.current || '';
        const sseUrl = `/api/game/stream?room=${encodeURIComponent(roomId)}${myUserId ? `&userId=${encodeURIComponent(myUserId)}` : ''}${myCharId ? `&characterId=${encodeURIComponent(myCharId)}` : ''}`;
        es = new EventSource(sseUrl);

        es.onopen = () => {
          if (isDisposed) {
            es?.close();
            return;
          }
          isSseConnectedRef.current = true;
          if (fallbackPollingTimer) {
            clearInterval(fallbackPollingTimer);
            fallbackPollingTimer = null;
          }
        };

        es.addEventListener('update', (event) => {
          if (isDisposed) return;
          try {
            const data = JSON.parse(event.data);
            // 1. Smooth remote hero walk interpolation
            if (data.actionType === 'move' && data.actionPayload?.characterId) {
              const payload = data.actionPayload;
              if (payload.characterId !== selected) {
                setRemoteWalkPath({
                  characterId: payload.characterId,
                  waypoints: payload.waypoints || [{ x: payload.x, y: payload.y }],
                  seq: payload.seq || ++clientSeqRef.current
                });
              }
            }

            // 2. Authoritative protected state sync
            if (data.state) {
              const snapRoom: Room = {
                id: roomId,
                owner: roomRef.current?.owner || '',
                name: roomRef.current?.name || '',
                code: roomRef.current?.code || '',
                version: data.version,
                state: data.state
              };
              applyProtectedRoomState(snapRoom);
            }
          } catch (err) {
            console.warn('SSE payload notice:', err);
          }
        });

        es.onerror = () => {
          isSseConnectedRef.current = false;
          es?.close();
          es = null;
          if (isDisposed) return;
          if (!isWsConnectedRef.current) {
            ensureFallbackPolling();
          }
          if (sseReconnectTimeout) clearTimeout(sseReconnectTimeout);
          sseReconnectTimeout = setTimeout(connectSse, 2500);
        };
      } catch (err) {
        console.warn('SSE stream init notice:', err);
      }
    };

    connectSse();

    // 4. Cloudflare Native WebSocket + Durable Objects Transport
    const connectWs = () => {
      if (isDisposed) return;
      try {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${window.location.host}/api/game/ws?room=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(user || 'anon')}`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) {
            ws?.close();
            return;
          }
          isWsConnectedRef.current = true;
          // When WebSocket is connected, STOP HTTP polling immediately!
          if (fallbackPollingTimer) {
            clearInterval(fallbackPollingTimer);
            fallbackPollingTimer = null;
          }

          // Start 15s keep-alive heartbeat ping
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
            }
          }, 15000);

          ws?.send(
            JSON.stringify({
              type: 'JOIN_ROOM',
              roomId,
              userId: user || 'anon',
              characterId: selected
            })
          );

          // If hero is already selected in current room state, announce presence immediately
          const activeHero = roomRef.current?.state?.characters?.find((c) => c.id === selected);
          if (activeHero) {
            ws?.send(
              JSON.stringify({
                type: 'PLAYER_JOIN',
                roomId,
                userId: user || 'anon',
                character: activeHero
              })
            );
          }
        };

        ws.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const msg = JSON.parse(event.data) as WsServerMessage;
            switch (msg.type) {
              case 'INIT_SNAPSHOT':
              case 'SYNC_SNAPSHOT': {
                const snapRoom: Room = {
                  id: roomId,
                  owner: roomRef.current?.owner || '',
                  name: roomRef.current?.name || '',
                  code: roomRef.current?.code || '',
                  version: msg.version,
                  state: msg.state
                };
                applyProtectedRoomState(snapRoom);
                break;
              }

              case 'PLAYER_JOINED': {
                // Immediately spawn the joined hero in local state without page refresh
                setRoom((prev) => {
                  if (!prev) return prev;
                  const charById = new Map<string, Character>();
                  for (const c of prev.state.characters) charById.set(c.id, c);
                  charById.set(msg.character.id, msg.character);
                  const updatedRoom: Room = {
                    ...prev,
                    version: Math.max(prev.version, msg.version),
                    state: {
                      ...prev.state,
                      characters: Array.from(charById.values())
                    }
                  };
                  roomRef.current = updatedRoom;
                  return updatedRoom;
                });
                break;
              }

              case 'PLAYER_LEFT': {
                // Immediately despawn the disconnected/left hero
                setRoom((prev) => {
                  if (!prev) return prev;
                  const updatedRoom: Room = {
                    ...prev,
                    version: Math.max(prev.version, msg.version),
                    state: {
                      ...prev.state,
                      characters: prev.state.characters.filter((c) => c.id !== msg.characterId)
                    }
                  };
                  roomRef.current = updatedRoom;
                  return updatedRoom;
                });
                break;
              }

              case 'HERO_MOVED': {
                // If this is the local hero and optimistic shield is active, ignore remote echo to prevent rollback on Render
                const isLocalHero = msg.characterId === selectedRef.current;
                const shield = localMoveShieldRef.current[msg.characterId];
                const now = Date.now();
                if (isLocalHero && shield && now - shield.time < 2500) {
                  break;
                }

                // Trigger smooth 340ms waypoint walking animation with token sway
                setRemoteWalkPath({
                  characterId: msg.characterId,
                  waypoints: msg.waypoints,
                  seq: msg.seq
                });

                setRoom((prev) => {
                  if (!prev) return prev;
                  // Se o personagem não existe no nosso estado, isso significa que perdemos um SYNC_SNAPSHOT.
                  // Precisamos forçar o carregamento do banco de dados para puxar sua ficha completa.
                  if (!prev.state.characters.some(c => c.id === msg.characterId)) {
                    void load(roomId);
                    return prev;
                  }
                  
                  return {
                    ...prev,
                    version: prev.version,
                    state: {
                      ...prev.state,
                      characters: prev.state.characters.map((c) =>
                        c.id === msg.characterId ? { ...c, x: msg.finalPos.x, y: msg.finalPos.y } : c
                      )
                    }
                  };
                });
                break;
              }

              case 'MOVE_REJECTED': {
                setError(msg.reason || 'Movimento rejeitado pelo servidor.');
                // Revert to server-authoritative original position only if valid non-zero
                if (msg.originalPos && (msg.originalPos.x > 0 || msg.originalPos.y > 0)) {
                  setRoom((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      state: {
                        ...prev.state,
                        characters: prev.state.characters.map((c) =>
                          c.id === msg.characterId ? { ...c, x: msg.originalPos.x, y: msg.originalPos.y } : c
                        )
                      }
                    };
                  });
                }
                break;
              }

              case 'ATTACK_RESULT': {
                // Render projectile VFX
                if (msg.projectile) {
                  const proj: ProjectileVfx = {
                    id: msg.projectile.id,
                    startX: msg.projectile.from.x,
                    startY: msg.projectile.from.y,
                    targetX: msg.projectile.to.x,
                    targetY: msg.projectile.to.y,
                    type: msg.projectile.type as any
                  };
                  setActiveProjectiles((prev) => [...prev, proj]);
                  setTimeout(() => {
                    setActiveProjectiles((prev) => prev.filter((p) => p.id !== proj.id));
                  }, 900);
                }

                // Render floating damage text
                const target =
                  msg.state.characters.find((c) => c.id === msg.targetId) ||
                  msg.state.enemies.find((e) => e.id === msg.targetId);
                if (target) {
                  const curGrid = battlemapBiome === 'village' ? 8 : dungeonSize;
                  const posX = ((target.x + 0.5) / curGrid) * 100;
                  const posY = ((target.y + 0.5) / curGrid) * 100;
                  const newFloat: FloatingNumber = {
                    id: crypto.randomUUID(),
                    x: posX,
                    y: posY,
                    text: msg.attackResult.hit
                      ? (msg.attackResult.isCrit ? `CRÍTICO! -${msg.attackResult.damage}` : `-${msg.attackResult.damage}`)
                      : 'ERROU!',
                    type: msg.attackResult.isCrit ? 'crit' : msg.attackResult.hit ? 'damage' : 'miss'
                  };
                  setFloatingTexts((prev) => [...prev, newFloat]);
                  
                  if (newFloat.type === 'crit' || newFloat.type === 'damage') {
                    setHitStopType(newFloat.type === 'crit' ? 'crit' : 'normal');
                    playCombatSound(newFloat.type === 'crit' ? 'crit' : 'hit');
                    setTimeout(() => setHitStopType(null), newFloat.type === 'crit' ? 300 : 150);
                  } else if (newFloat.type === 'miss') {
                    playCombatSound('miss');
                  }

                  // Trigger physical recoil & directional slash
                  const recoilType = msg.attackResult.isCrit ? 'crit' : msg.attackResult.hit ? 'hit' : 'miss';
                  const attacker = msg.state.characters.find((c: any) => c.id === msg.actorId) ||
                                   msg.state.enemies.find((e: any) => e.id === msg.actorId);
                  triggerRecoil(
                    msg.targetId,
                    attacker ? { x: attacker.x, y: attacker.y } : null,
                    { x: target.x, y: target.y },
                    recoilType
                  );

                  // Slash sweep effect for melee attacks
                  if (msg.attackResult.hit && (!msg.projectile || (attacker && Math.hypot(target.x - attacker.x, target.y - attacker.y) <= 1.5))) {
                    setSlashVfx((prev) => ({ ...prev, [msg.targetId]: { timestamp: Date.now() } }));
                    setTimeout(() => {
                      setSlashVfx((prev) => {
                        const next = { ...prev };
                        delete next[msg.targetId];
                        return next;
                      });
                    }, 400);
                  }

                  setTimeout(() => {
                    setFloatingTexts((prev) => prev.filter((f) => f.id !== newFloat.id));
                  }, 1600);
                }

                // Apply updated state
                const snapRoom: Room = {
                  id: roomId,
                  owner: roomRef.current?.owner || '',
                  name: roomRef.current?.name || '',
                  code: roomRef.current?.code || '',
                  version: msg.version,
                  state: msg.state
                };
                applyProtectedRoomState(snapRoom);
                break;
              }

              case 'CHAT_MESSAGE': {
                setRoom((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    state: {
                      ...prev.state,
                      logs: [...prev.state.logs, {
                        id: crypto.randomUUID(),
                        text: `${msg.sender}: ${msg.text}`,
                        kind: 'player',
                        time: new Date(msg.timestamp).toLocaleTimeString('pt-BR')
                      }]
                    }
                  };
                });
                break;
              }

              default:
                break;
            }
          } catch (err) {
            console.warn('WebSocket message parse notice:', err);
          }
        };

        ws.onclose = () => {
          isWsConnectedRef.current = false;
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          if (isDisposed) return;
          if (!isSseConnectedRef.current) {
            ensureFallbackPolling();
          }
          reconnectTimeout = setTimeout(connectWs, 2000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        console.warn('WebSocket connection init notice:', err);
      }
    };

    connectWs();

    return () => {
      isDisposed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (sseReconnectTimeout) clearTimeout(sseReconnectTimeout);
      if (fallbackPollingTimer) clearInterval(fallbackPollingTimer);
      if (es) {
        es.close();
      }
      if (ws) {
        ws.close();
        if (wsRef.current === ws) wsRef.current = null;
      }
      if (bc) {
        bc.close();
        if (broadcastChannelRef.current === bc) {
          broadcastChannelRef.current = null;
        }
      }
    };
  }, [room?.id, applyProtectedRoomState, load, user, selected, battlemapBiome, dungeonSize]);

  // Synchronize active hero selection with room WebSocket so all other players immediately see this avatar
  useEffect(() => {
    if (!selected || !room?.id) return;
    const hero = room.state?.characters?.find((c) => c.id === selected);
    if (hero && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'PLAYER_JOIN',
          roomId: room.id,
          userId: user || 'anon',
          character: hero
        })
      );
    }
  }, [selected, room?.id, user, room?.state?.characters]);

  // General server action dispatch with queue to eliminate lag and prevent dropping fast clicks
  async function action(a: Record<string, unknown>): Promise<ApiData | null> {
    setError('');
    const task: Promise<ApiData | null> = actionQueueRef.current.then(async (): Promise<ApiData | null> => {
      setBusy(true);
      try {
        const curRoom = roomRef.current;
        const r = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: curRoom?.id, version: curRoom?.version, ...a })
        });
        const rawText = await r.text();
        let d = {} as ApiData;
        try {
          d = rawText ? (JSON.parse(rawText) as ApiData) : ({} as ApiData);
        } catch {
          throw new Error(rawText?.slice(0, 120) || `Falha de rede (${r.status})`);
        }
        if (!r.ok) {
          if (r.status === 409) {
            if (d.room) {
              applyProtectedRoomState(d.room);
              if (a.action === 'location' && !a._retried) {
                return await action({ ...a, _retried: true, version: d.room.version });
              }
            } else {
              await load(curRoom?.id);
            }
          }
          throw Error(d.error || 'Erro ao sincronizar com a mesa.');
        }
        if (d.room) {
          applyProtectedRoomState(d.room);
          try {
            broadcastChannelRef.current?.postMessage({
              type: 'ROOM_MUTATION',
              room: d.room
            });
          } catch {}

          // Fix: Trigger MMO WebSocket Force Sync immediately after REST mutation
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'FORCE_SYNC' }));
          }
        } else {
          await load(d.id || curRoom?.id);
        }
        return d;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
        if (a.action === 'move') {
          void load(roomRef.current?.id);
        }
        return null;
      } finally {
        setBusy(false);
      }
    });

    actionQueueRef.current = task.catch(() => {});
    return task;
  }

  // Groq AI Narration trigger
  async function narrate(customText?: string, actionCtx?: string) {
    const textToSend = (customText || message).trim();
    if (!textToSend && !actionCtx) return;
    setBusy(true);
    setError('');
    try {
      const curRoom = roomRef.current;
      const r = await fetch('/api/gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: curRoom?.id,
          version: curRoom?.version,
          key,
          text: textToSend,
          actionContext: actionCtx,
          search
        })
      });
      const d = (await r.json()) as ApiData;
      if (!r.ok) throw Error(d.error);
      setSearchHtml(d.searchHtml || '');
      setAiChoices([]);
      if (!customText) setMessage('');
      await load(curRoom?.id);
    } catch (e) {
      console.warn('Narração offline/aviso:', e);
      await load(roomRef.current?.id);
    } finally {
      setBusy(false);
    }
  }

  const state = room?.state;
  const owner = room?.owner === user;
  const isMmoRoom = room?.id === 'mmo-world-village';
  const myHeroes = (state?.characters || []).filter((c) => isMmoRoom ? c.owner === user : (!c.owner || c.owner === user));
  const active = (state?.characters || []).find((c) => c.id === selected && (isMmoRoom ? c.owner === user : true))
    || myHeroes[0]
    || (state?.characters || [])[0];
  const canReturnToPartyBattle = Boolean(
    isMmoRoom &&
    active &&
    active.hp > 0 &&
    active.partyId &&
    state?.combat &&
    state.combatPartyId === active.partyId &&
    !(state.order || []).includes(active.id) &&
    (state.characters || []).some(
      (char) =>
        char.id !== active.id &&
        char.partyId === active.partyId &&
        char.hp > 0 &&
        (state.order || []).includes(char.id)
    )
  );

  const activeLocIdx = active?.location ?? state?.location ?? 0;
  const location = (locations && locations[activeLocIdx]) || locations[0];
  const canEdit = active && (owner || active.owner === user || !isMmoRoom);
  const turnId = state?.order[state.turn];
  const turnEntity = [...(state?.characters || []), ...(state?.enemies || [])].find((c) => c.id === turnId);
  const isHeroTurn = active && turnId === active.id;
  const isActBossDefeated = state?.enemies ? state.enemies.length > 0 && state.enemies.every((e) => e.hp <= 0) : false;
  const curHeroBiome = active?.biome || (isMmoRoom ? 'village' : (state?.biome || 'village'));
  const isHeroInVillage = curHeroBiome === 'village' || activeLocIdx === 0;
  const isHeroInCombat = !isHeroInVillage && Boolean(state?.combat && (state.order?.includes(active?.id || '') || !isMmoRoom));
  const livingEnemies = isHeroInVillage ? [] : (state?.enemies ? state.enemies.filter((e) => {
    if (e.hp <= 0) return false;
    const enemyBiome = e.biome || 'forest';
    if (enemyBiome !== curHeroBiome) return false;
    if (isMmoRoom) {
      if (active?.partyId) return !e.partyId || e.partyId === active.partyId;
      return !e.ownerCharId || e.ownerCharId === active?.id;
    }
    return true;
  }) : []);
  const currentEnemy = livingEnemies.find((e) => e.id === selectedEnemyId) || livingEnemies[0] || null;
  const latestGmLog = state?.logs ? [...state.logs].reverse().find((l) => l.kind === 'gm') : null;

  // Update biome reactively from active hero (supports individual/party biome traveling in MMO)
  useEffect(() => {
    const isMmo = room?.id === 'mmo-world-village';
    const targetBiome = isMmo ? (active?.biome || 'village') : (active?.biome || room?.state?.biome || 'village');
    if (targetBiome && targetBiome !== battlemapBiome) {
      setBattlemapBiome(targetBiome);
      setBattlemapSeed(Date.now());
    }
  }, [active?.biome, room?.state?.biome, room?.id, battlemapBiome]);

  // Update act reactively from active hero or room
  useEffect(() => {
    const targetAct = active?.act || room?.state?.act;
    if (targetAct && targetAct !== currentAct && (targetAct === 1 || targetAct === 2 || targetAct === 3)) {
      setCurrentAct(targetAct as 1 | 2 | 3);
    }
  }, [active?.act, room?.state?.act, currentAct]);

  // Auto-focus user's active hero or current combat turn entity to eliminate requiring preliminary manual clicks
  useEffect(() => {
    if (!state) return;
    if (state.combat && state.order && state.turn !== undefined) {
      const currentTurnId = state.order[state.turn];
      const isMyTurn = myHeroes.some((h) => h.id === currentTurnId);
      if (isMyTurn && selected !== currentTurnId) {
        setSelected(currentTurnId);
        return;
      }
    }
    if (myHeroes.length > 0) {
      const isCurrentSelectedMine = myHeroes.some((h) => h.id === selected);
      if (!isCurrentSelectedMine) {
        setSelected(myHeroes[0].id);
      }
    }
  }, [state?.combat, state?.turn, state?.order, myHeroes, selected]);

  // Clean multiplayer disconnect on window close / navigation
  useEffect(() => {
    const handleUnload = () => {
      const curRoom = roomRef.current;
      const curUser = userRef.current;
      if (curRoom?.id === 'mmo-world-village' && curUser) {
        const charToLeave = selectedRef.current;
        const payload = JSON.stringify({
          room: curRoom.id,
          action: 'leave',
          character: charToLeave
        });
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon('/api/game', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // Periodic MMO heartbeat (every 25s) to refresh lastSeen
  useEffect(() => {
    if (room?.id !== 'mmo-world-village') return;
    const interval = setInterval(() => {
      const curChar = selectedRef.current;
      if (curChar) {
        fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: 'mmo-world-village',
            action: 'heartbeat',
            character: curChar
          })
        }).catch(() => {});
      }
    }, 25000);
    return () => clearInterval(interval);
  }, [room?.id]);

  // Memoized 3D dice dismissal — fires pending VFX AFTER dice disappears
  const handleDiceComplete = useCallback(() => {
    setCurrentDiceRoll(null);

    // Fire pending projectile + floating text that were queued during the attack
    const pending = pendingVfxRef.current;
    if (pending) {
      pendingVfxRef.current = null;

      // Launch projectile VFX
      setActiveProjectiles((prev) => [...prev, pending.projectile]);
      setTimeout(() => {
        setActiveProjectiles((prev) => prev.filter((p) => p.id !== pending.projectile.id));
      }, 550);

      // Show floating combat text after a tiny delay (impact moment)
      setTimeout(() => {
        setFloatingTexts((prev) => [...prev, pending.floatingText]);
        
        if (pending.floatingText.type === 'crit' || pending.floatingText.type === 'damage') {
          setHitStopType(pending.floatingText.type === 'crit' ? 'crit' : 'normal');
          playCombatSound(pending.floatingText.type === 'crit' ? 'crit' : 'hit');
          setTimeout(() => setHitStopType(null), pending.floatingText.type === 'crit' ? 300 : 150);
        } else if (pending.floatingText.type === 'miss') {
          playCombatSound('miss');
        }

        // Trigger physical token recoil & directional slash
        if (pending.targetId) {
          const recoilType = pending.floatingText.type === 'crit' ? 'crit' : pending.floatingText.type === 'damage' ? 'hit' : 'miss';
          triggerRecoil(
            pending.targetId,
            pending.attackerPos,
            pending.targetPos,
            recoilType
          );

          if (pending.isMelee && pending.floatingText.type !== 'miss') {
            setSlashVfx((prev) => ({ ...prev, [pending.targetId!]: { timestamp: Date.now() } }));
            setTimeout(() => {
              setSlashVfx((prev) => {
                const next = { ...prev };
                delete next[pending.targetId!];
                return next;
              });
            }, 400);
          }
        }

        setTimeout(() => {
          setFloatingTexts((prev) => prev.filter((f) => f.id !== pending.floatingText.id));
        }, 1600);
      }, 300);

      // Narrate ONLY on critical hits or lethal boss/elite kills (selective AI director)
      if (pending.shouldNarrate && pending.narrateCtx) {
        void narrate('', pending.narrateCtx);
      }
    }
  }, [triggerRecoil, narrate]);

  // Complete Cache & Account Wipe Handler
  const handleWipeAllData = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Tem certeza que deseja apagar os saves antigos, limpar o cache e iniciar uma nova campanha na Vila do Rio Verde?'
      );
      if (!confirmed) return;
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.href = '/api/wipe';
    }
  };

  // EXECUTE COMBAT ATTACK FLOW - SERVER AUTHORITATIVE RESOLUTION
  // Sequence: Action Choice → Server Roll → Dice 3D → (dice dismiss) → Projectile VFX → Floating Text
  const handleExecuteAttack = async (targetId?: string) => {
    if (busy || !active || !state) return;
    const living = state.enemies.filter((e) => e.hp > 0);
    if (living.length === 0) return;
    const target = (targetId && living.find((e) => e.id === targetId)) ||
      (selectedEnemyId && living.find((e) => e.id === selectedEnemyId)) ||
      living[0];
    if (!target) return;

    const dmgFormula = targetingAction?.damageFormula || active.damage;
    const curTargeting = targetingAction;
    setTargetingAction(null);
    setIsBottomHudMinimized(false);

    // Determine projectile VFX type based on weapon/spell name
    let pType: ProjectileVfx['type'] = 'arrow';
    const actionName = (curTargeting?.name || active.weapon || '').toLowerCase();
    if (actionName.includes('raio de fogo') || actionName.includes('fogo') || actionName.includes('flame') || actionName.includes('mãos flamejantes')) {
      pType = 'fire_bolt';
    } else if (actionName.includes('mísseis') || actionName.includes('mágico') || actionName.includes('missile')) {
      pType = 'magic_missile';
    } else if (actionName.includes('gelo') || actionName.includes('frost')) {
      pType = 'frost_ray';
    } else if (actionName.includes('chama sagrada') || actionName.includes('sagrad')) {
      pType = 'sacred_flame';
    } else if (actionName.includes('eldritch') || actionName.includes('rajada')) {
      pType = 'eldritch';
    } else {
      const dist = Math.max(Math.abs(active.x - target.x), Math.abs(active.y - target.y));
      if (dist <= 1 || !actionName.includes('arco')) {
        pType = 'slash';
      } else {
        pType = 'arrow';
      }
    }

    const dist = Math.max(Math.abs(active.x - target.x), Math.abs(active.y - target.y));
    const isMelee = (curTargeting?.rangeSquares || 1) <= 1.5 && !actionName.includes('arco') && !actionName.includes('besta') && !actionName.includes('raio') && !actionName.includes('fogo') && !actionName.includes('mágico') && !actionName.includes('eldritch') && !actionName.includes('sagrad') && !actionName.includes('gelo');
    if (isMelee && dist > 1) {
      setError(`Alvo fora do alcance corpo a corpo (${dist} quadrados / ${(dist * 1.5).toFixed(1)}m). Aproxime-se a 1 quadrado (1.5m) de ${target.name} para desferir o golpe!`);
      return;
    }

    // Call server action FIRST (authoritative SRD roll + enemy AI counter-attack)
    const res = await action({
      action: 'attack',
      character: active.id,
      target: target.id,
      damageFormula: dmgFormula,
      mode
    });

    if (res && res.attackResult) {
      const r = res.attackResult;

      // 1. Prepare the projectile + floating text to fire AFTER dice dismiss
      const newProj: ProjectileVfx = {
        id: crypto.randomUUID(),
        startX: active.x,
        startY: active.y,
        targetX: target.x,
        targetY: target.y,
        type: pType
      };

      const posX = ((target.x + 0.5) / dungeonSize) * 100;
      const posY = ((target.y + 0.5) / dungeonSize) * 100;
      const newFloat: FloatingNumber = {
        id: crypto.randomUUID(),
        x: posX,
        y: posY,
        text: r.hit ? (r.isCrit ? `CRÍTICO! -${r.damage}` : `-${r.damage}`) : 'ERROU!',
        type: r.isCrit ? 'crit' : r.hit ? 'damage' : 'miss'
      };

      // Selective AI narration trigger (only on crits or boss/elite fatal blows)
      const isBossOrElite =
        target.maxHp >= 20 ||
        target.name.includes('Ignisrax') ||
        target.name.includes('Boss') ||
        target.name.includes('Sentinela') ||
        target.name.includes('Lorde') ||
        target.name.includes('Wyrmling') ||
        target.name.includes('Guardião') ||
        target.name.includes('Alfa');
      const isFatal = r.hpAfter <= 0;
      const shouldNarrate = r.isCrit || (isFatal && isBossOrElite);

      const narrateMessage = shouldNarrate
        ? (r.isCrit && isFatal
            ? `GOLPE CRÍTICO FATAL! ${active.name} desferiu um acerto devastador que eliminou ${target.name} com ${r.damage} de dano!`
            : r.isCrit
            ? `GOLPE CRÍTICO! ${active.name} acerta um ponto vital em ${target.name} causando ${r.damage} de dano estrondoso!`
            : `VITÓRIA CONTRA O CHEFE! O inimigo temível ${target.name} tombou diante de ${active.name}!`)
        : '';

      // Queue VFX to fire when dice roll dismisses
      const isMelee = (curTargeting?.rangeSquares || 1) <= 1.5;
      pendingVfxRef.current = {
        projectile: newProj,
        floatingText: newFloat,
        narrateCtx: narrateMessage,
        shouldNarrate,
        targetId: target.id,
        attackerPos: { x: active.x, y: active.y },
        targetPos: { x: target.x, y: target.y },
        isMelee
      };

      // 2. Show Dice 3D Roll FIRST (fires VFX when it completes via handleDiceComplete)
      setCurrentDiceRoll({
        id: crypto.randomUUID(),
        raw: r.d20Roll,
        modifier: active.attack - 2 * active.exhaustion,
        total: r.totalAttack,
        targetAc: r.targetAc,
        hit: r.hit,
        isCrit: r.isCrit,
        isFumble: r.isFumble,
        label: curTargeting?.name || `Ataque com ${active.weapon}`
      });
    }
  };

  // HANDLE ADVANCE ACT
  const handleAdvanceAct = async () => {
    const next = (currentAct === 1 ? 2 : currentAct === 2 ? 3 : 1) as 1 | 2 | 3;
    const newSeed = Date.now();
    const ok = await action({ action: 'advanceAct', act: next });
    if (ok) {
      // Only update client state AFTER server confirms the act change
      setCurrentAct(next);
      setDungeonSeed(newSeed);
      setProceduralDungeon(generateProceduralDungeon(next, dungeonSize, newSeed));
      const biomeForAct = next === 1 ? 'village' : next === 2 ? 'dungeon' : 'dungeon';
      setBattlemapBiome(biomeForAct as any);
      setBattlemapSeed(newSeed);
      void narrate(
        '',
        `O grupo desce às profundezas e alcança o ${CAMPAIGN_ACTS[next].title}: ${CAMPAIGN_ACTS[next].subtitle}. ${CAMPAIGN_ACTS[next].dialogueIntro}`
      );
    }
  };

  // HANDLE DRINK / USE CONSUMABLE (Healing Potions, etc.)
  const handleUseItem = async (itemId: string, targetId?: string) => {
    if (!active) return;
    const target = targetId ? (state?.characters.find((c) => c.id === targetId) || active) : active;
    const res = await action({
      action: 'useItem',
      character: active.id,
      itemId,
      targetId: target.id
    });

    if (res && (res as any).healResult) {
      const hr = (res as any).healResult;
      const curGrid = battlemapBiome === 'village' ? 8 : dungeonSize;
      const posX = ((target.x + 0.5) / curGrid) * 100;
      const posY = ((target.y + 0.5) / curGrid) * 100;
      const newFloat: FloatingNumber = {
        id: crypto.randomUUID(),
        x: posX,
        y: posY,
        text: `+${hr.healAmount} PV`,
        type: 'heal'
      };
      setFloatingTexts((prev) => [...prev, newFloat]);
      setTimeout(() => {
        setFloatingTexts((prev) => prev.filter((f) => f.id !== newFloat.id));
      }, 1600);

      // Trigger heal visual pulse & upward float
      setHealVfx((prev) => ({ ...prev, [target.id]: { timestamp: Date.now() } }));
      triggerRecoil(target.id, null, null, 'heal');
      setTimeout(() => {
        setHealVfx((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      }, 700);

      void narrate('', `${active.name} consumiu ${itemId.includes('maior') ? 'Poção de Cura Maior' : 'Poção de Cura'} em ${target.name}, restaurando ${hr.healAmount} PV!`);
    }
  };

  // HANDLE INTERACTION & EXPLORATION
  const handleInvestigate = () => {
    if (!active) return;
    void action({
      action: 'check',
      character: active.id,
      ability: 3,
      skill: 'Investigação',
      label: 'Investigar os arredores',
      mode: 'normal'
    }).then((res) => {
      if (res) {
        void narrate('', `${active.name} investiga meticulosamente a área em busca de segredos, armadilhas e pistas.`);
      }
    });
  };

  const handleInteract = () => {
    if (!active) return;
    void narrate(
      '',
      `${active.name} examina as construções de pedra, a ponte de madeira rústica e as águas do riacho de Vila do Rio Verde.`
    );
  };

  const handleTalkNpc = (npcId?: string) => {
    const npcs = state?.npcs || [];
    const chosen = npcId ? npcs.find((n) => n.id === npcId) : (npcs[0] || null);
    if (chosen) {
      const isDoran = chosen.id === 'doran';
      const isElenor = chosen.id === 'elenor';
      const isKaelen = chosen.id === 'kaelen';
      const qp = active?.questProgress || state?.questProgress || {};

      let dialogText = chosen.dialogue ? chosen.dialogue.join(' ') : chosen.description;
      let options: { label: string; actionText: string }[] = [];

      if (isDoran) {
        if (qp.doran_talked) {
          dialogText = 'A bênção sagrada de Valdoria já foi concedida ao seu grupo, bravos aventureiros! Consultem a Alquimista Elenor na oficina para receberem poções de cura e o Capitão Kaelen na ponte para autorização dos portões.';
          options = [
            { label: '🌿 Ir consultar a Alquimista Elenor agora', actionText: 'TALK_ELENOR' },
            { label: '🛡️ Apresentar-se ao Capitão Kaelen na ponte', actionText: 'TALK_KAELEN' },
            { label: 'Agradeço as sábias palavras, Ancião Doran.', actionText: 'O herói reafirma sua determinação ao Ancião Doran.' }
          ];
        } else {
          dialogText = 'Criaturas feitas de cinzas e rancor espreitam além dos nossos muros. Como Ancião de Vila do Rio Verde, rogo a proteção dos deuses sobre vocês. Vão e expurguem a escuridão!';
          options = [
            { label: 'Aceito a missão, Ancião Doran. O que nos aguarda na floresta?', actionText: `Pergunta ao Ancião Doran sobre o selo rompido e as criaturas de cinzas.` },
            { label: 'Conceda a bênção de Valdoria para a nossa expedição.', actionText: `Pede a bênção da vila e conselhos de sobrevivência a Doran.` },
            { label: 'Conversarei com Elenor e Kaelen antes de partir.', actionText: `Agradece ao Ancião e prepara-se com a guarda da vila.` }
          ];
        }
      } else if (isElenor) {
        if (!qp.doran_talked) {
          dialogText = 'Saudações, viajante! Antes de adquirir elixires arcanos, fale com o Ancião Doran na praça central para receber a bênção e a incumbência da vila.';
          options = [
            { label: '🕊️ Procurar o Ancião Doran na praça', actionText: 'TALK_DORAN' },
            { label: '🛒 Abrir Empório Alquímico (Comprar & Vender)', actionText: 'OPEN_SHOP_ELENOR' }
          ];
        } else if (qp.elenor_talked) {
          dialogText = 'As provisões e Poções de Cura já foram entregues ao seu grupo. Apressem-se ao Capitão Kaelen na ponte da vila para abrir os portões!';
          options = [
            { label: '🛡️ Falar com Capitão Kaelen na ponte', actionText: 'TALK_KAELEN' },
            { label: '🛒 Abrir Empório Alquímico (Comprar & Vender)', actionText: 'OPEN_SHOP_ELENOR' },
            { label: 'Como usar as poções durante o combate sob regras 5e?', actionText: `Pergunta a Elenor como administrar poções como 1 Ação de combate.` }
          ];
        } else {
          dialogText = 'Doran avisou-me de sua expedição sagrada! Preparei elixires destilados das raízes de Valdoria. Tomem estas Poções de Cura para sobreviverem aos combates!';
          options = [
            { label: 'Receber Poções de Cura e marchar para o Capitão Kaelen', actionText: 'TALK_KAELEN' },
            { label: '🛒 Abrir Empório Alquímico (Comprar & Vender)', actionText: 'OPEN_SHOP_ELENOR' },
            { label: 'Como usar as poções durante o combate sob regras 5e?', actionText: `Pergunta a Elenor como administrar poções como 1 Ação de combate.` }
          ];
        }
      } else if (isKaelen) {
        if (!qp.elenor_talked) {
          dialogText = 'Alto lá! Não posso autorizar a abertura dos portões sem que o grupo tenha se abastecido de Poções de Cura com a Alquimista Elenor.';
          options = [
            { label: '🌿 Ir falar com a Alquimista Elenor', actionText: 'TALK_ELENOR' },
            { label: '🛒 Abrir Arsenal & Ferraria (Equipamentos 5e)', actionText: 'OPEN_SHOP_KAELEN' }
          ];
        } else if (qp.kaelen_talked) {
          dialogText = 'Os portões da ponte estão abertos para vocês! A trilha da Floresta dos Sussurros conduz ao Menir Sagrado. Destruam a Sentinela de Cinzas!';
          options = [
            { label: '🌲 Marchar imediatamente para a Floresta dos Sussurros (Viajar)', actionText: 'TRAVEL_FOREST' },
            { label: '🛒 Abrir Arsenal & Ferraria (Equipamentos 5e)', actionText: 'OPEN_SHOP_KAELEN' },
            { label: 'Quais são as regras de posicionamento e cobertura?', actionText: `Pede instruções militares sobre terreno e regras de 1 Ação em combate D&D 5e.` }
          ];
        } else {
          dialogText = 'Vejo que receberam a bênção de Doran e as poções de Elenor! A guarda confia na bravura de vocês. Concedo autorização para abrir os portões da ponte!';
          options = [
            { label: '🌲 Marchar para a Floresta dos Sussurros (Viajar)', actionText: 'TRAVEL_FOREST' },
            { label: '🛒 Abrir Arsenal & Ferraria (Equipamentos 5e)', actionText: 'OPEN_SHOP_KAELEN' },
            { label: 'Quais são as regras de posicionamento e cobertura?', actionText: `Pede instruções militares sobre terreno e regras de 1 Ação em combate D&D 5e.` }
          ];
        }
      } else {
        options = [
          { label: 'O que você sabe sobre os arredores?', actionText: `Pergunta sobre a região a ${chosen.name}.` },
          { label: 'Como posso ajudá-lo?', actionText: `Oferece auxílio a ${chosen.name}.` },
          { label: 'Agradeço, continuarei explorando.', actionText: `Despede-se de ${chosen.name}.` }
        ];
      }

      // Flag quest step progress on server (scoped to active hero and their party)
      void action({
        action: 'questStep',
        character: active?.id,
        step: `${chosen.id}_talked`,
        logText: `[Grupo] ${active?.name || 'O herói'} conversou com ${chosen.name}.`
      });

      // If talking to Elenor, grant 2 healing potions to active hero if not already present
      if (chosen.id === 'elenor' && active && !active.inventory?.includes('pocao-cura')) {
        const newInv = active.inventory ? `${active.inventory}, pocao-cura:2` : 'pocao-cura:2';
        void action({
          action: 'character',
          character: active.id,
          value: { ...active, inventory: newInv }
        });
      }

      setActiveNpcDialog({
        id: chosen.id,
        name: chosen.name,
        role: chosen.role,
        dialogText,
        options
      });
    } else {
      const generated = generateRandomNpc();
      setActiveNpcDialog({
        id: generated.id,
        name: generated.name,
        role: generated.role,
        dialogText: `${generated.dialogueIntro} (${generated.description})`,
        options: generated.options
      });
    }
  };

  const handleInteractObject = (type: string, x: number, y: number) => {
    if (!active) return;
    if (type === 'chest') {
      void narrate('', `${active.name} abre as caixas de suprimentos nas coordenadas [${String.fromCharCode(65 + x)}${y + 1}] e encontra provisões e poções de cura!`);
    } else if (type === 'shrine') {
      void narrate('', `${active.name} aproxima-se do monólito sagrado, sentindo as correntes arcanas que protegem as terras de Valdoria.`);
    } else if (type === 'well') {
      void narrate('', `${active.name} retira água fresca do poço de pedra da vila, recompondo o fôlego.`);
    } else if (type === 'stairs') {
      if (isActBossDefeated) {
        void handleAdvanceAct();
      } else {
        void narrate('', `${active.name} aproxima-se da escadaria, mas guardas e selos impedem a passagem enquanto a missão atual não for concluída.`);
      }
    }
  };

  const handleTravel = async (b: BiomeType) => {
    if (!active) return;
    const locIdx =
      b === 'village' ? 0
      : b === 'forest' ? 1
      : b === 'ruins' ? 2
      : b === 'dungeon' ? 3
      : b === 'canyon' ? 4
      : 5;
    const destName = locations[locIdx]?.name || 'Novo Território';
    const ok = await action({ action: 'location', location: locIdx, biome: b, character: active.id });
    if (ok) {
      setBattlemapBiome(b);
      setBattlemapSeed(Date.now());
      setCurrentAct(Math.min(3, Math.max(1, locIdx >= 4 ? 3 : locIdx >= 2 ? 2 : 1)) as 1 | 2 | 3);
    }
  };

  const handleStartAdventure = async (advId: string) => {
    if (!state) return;
    const adv = MICRO_ADVENTURES[advId];
    if (!adv) return;

    const res = startMicroAdventure(state, advId);
    if (res.success) {
      const targetBiome: BiomeType =
        adv.locationIndex === 0 ? 'village'
        : adv.locationIndex === 1 ? 'forest'
        : adv.locationIndex === 2 ? 'ruins'
        : adv.locationIndex === 3 ? 'dungeon'
        : adv.locationIndex === 4 ? 'canyon'
        : 'lair';

      await handleTravel(targetBiome);

      // Spawn adventure stage enemies if present
      const stage1 = adv.stages[1];
      if (stage1?.spawnEnemies && stage1.spawnEnemies.length > 0) {
        state.enemies = stage1.spawnEnemies.map((enemy) => ({
          id: crypto.randomUUID(),
          name: enemy.name,
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          ac: enemy.ac,
          attack: enemy.attack,
          damage: enemy.damage,
          weapon: enemy.weapon,
          initiative: 10,
          x: enemy.x,
          y: enemy.y
        }));
        state.combat = true;
      }
      await action({ action: 'notes', notes: state.notes });
      void narrate('', res.log);
    }
  };

  const handleChallengeDragon = async () => {
    if (!state) return;
    const { boss, log } = spawnDragonBoss(state);
    setBattlemapBiome('lair');
    setBattlemapSeed(Date.now());
    await action({ action: 'location', location: 5, biome: 'lair' });
    void narrate('', log);
  };

  return (
    <SidebarProvider>
      <main className={`game-shell flex flex-col md:flex-row w-full h-[100dvh] max-h-[100dvh] bg-[#050814] text-[#ede9dc] select-none overflow-hidden ${hitStopType === 'crit' ? 'hit-stop-crit' : hitStopType === 'normal' ? 'hit-stop' : ''}`}>
        {/* Navigation Sidebar (Desktop - Apenas exibido fora da tela de Aventura) */}
        {view !== 'Aventura' && (
          <Sidebar collapsible="none" className="navigation hidden md:flex shrink-0 h-full overflow-y-auto">
            <div className="brand flex items-center gap-3">
              <Dices size={30} className="text-amber-400" />
              <span className="font-serif font-black tracking-wider text-amber-200">
                CRÔNICAS<small className="block text-[10px] tracking-widest text-zinc-400">DO VAZIO</small>
              </span>
            </div>
            <p className="eyebrow text-xs text-amber-500/80 font-bold tracking-widest px-3 mt-4">
              SEU UNIVERSO
            </p>
            <SidebarContent>
              <SidebarMenu>
                {navigation.map(({ icon: Icon, name }) => (
                  <SidebarMenuItem key={name}>
                    <SidebarMenuButton
                      className={view === name ? 'nav-item active' : 'nav-item'}
                      isActive={view === name}
                      onClick={() => setView(name)}
                    >
                      <Icon size={18} />
                      <span>{name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
            <div className="nav-bottom mt-auto p-4 border-t border-zinc-800 flex flex-col gap-1.5">
              <span className="edition block text-center mb-1">5e • REGRAS 2024</span>
              <button className="text-button w-full justify-center" onClick={() => setRoomDialog(true)}>
                <Plus size={15} /> Minhas mesas
              </button>
              <a
                href="/admin/map-editor"
                className="text-button w-full justify-center text-zinc-400 hover:text-amber-300 text-xs py-1"
                title="Abrir Editor Administrativo de Mapas"
              >
                <MapPin size={14} /> Editor de Mapas
              </a>
            </div>
          </Sidebar>
        )}

        {/* Mobile Header (Apenas fora de Aventura, pois Aventura tem seu próprio topo) */}
        {view !== 'Aventura' && (
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-[#121612] sticky top-0 z-30 shadow-md shrink-0">
          <div className="flex items-center gap-2">
            {/* Hamburger Button to trigger MobileDrawer */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 rounded-xl shadow active:scale-95 transition-transform"
              title="Menu Principal"
              aria-label="Menu Principal"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <span className="font-serif font-black tracking-wider text-amber-200 text-xs leading-none">
                CRÔNICAS <span className="text-[9px] text-zinc-400 font-mono">5e</span>
              </span>
              <span className="text-[10px] text-amber-400/90 font-bold truncate max-w-[125px]">
                {CAMPAIGN_ACTS[currentAct].title.split(':')[0]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsJournalOpen(!isJournalOpen)}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow active:scale-95 transition-transform"
            >
              <Flame size={13} className="text-amber-400" />
              <span>Mestre</span>
            </button>
            <button
              onClick={() => setShowQuests(true)}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow active:scale-95 transition-transform"
            >
              <ScrollText size={13} className="text-cyan-400" />
              <span>Missões</span>
            </button>
            <button
              onClick={() => setRoomDialog(true)}
              className="p-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs shadow active:scale-95 transition-transform"
              title="Mesas"
            >
              <Users size={14} />
            </button>
            <button
              onClick={handleWipeAllData}
              className="p-1 bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800/60 rounded-lg text-xs shadow active:scale-95 transition-transform"
              title="Wipe: Limpar saves antigos e reiniciar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}

        {/* WORKSPACE / GAMEPLAY CANVAS */}
        <section className={`workspace flex-1 h-full min-h-0 overflow-hidden flex flex-col ${view === 'Aventura' ? 'p-0' : 'p-1 sm:p-2.5'} relative min-w-0`}>
          {/* Header (Desktop - Apenas fora da tela de Aventura) */}
          {/* Header (Exibido nas telas de Personagens, Compêndio, Atlas e Mestre) */}
          {view !== 'Aventura' && (
            <header className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3 shrink-0 gap-3 px-2 sm:px-4 bg-[#0a0f0d]/90 backdrop-blur-md rounded-xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-serif font-black tracking-wide text-zinc-200">Crônicas do Vazio</span>
                  <span className="text-zinc-600 font-mono">•</span>
                  <strong className="text-amber-300 font-bold uppercase tracking-wider text-xs sm:text-sm">
                    {view}
                  </strong>
                </div>
              </div>

              {/* Central Navigation Tabs for Out-of-Adventure Pages */}
              <nav className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800/90 p-1 rounded-xl shadow-inner overflow-x-auto max-w-full">
                {navigation.map(({ icon: Icon, name }) => (
                  <button
                    key={name}
                    onClick={() => setView(name)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
                      view === name
                        ? 'bg-amber-500/25 text-amber-200 border border-amber-500/70 shadow'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Icon size={14} className={view === name ? 'text-amber-400' : 'text-zinc-400'} />
                    <span>{name}</span>
                  </button>
                ))}
                <a
                  href="/admin/map-editor"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 border border-transparent hover:border-sky-700/60 transition-all cursor-pointer"
                  title="Abrir o Editor de Mapas Administrativo em nova aba"
                >
                  <MapPin size={14} />
                  <span>Editor de Mapas</span>
                </a>
              </nav>

              {/* Action: Return to Adventure */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRoomDialog(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-300 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 cursor-pointer"
                  title="Gerenciar mesas e instâncias"
                >
                  <Users size={13} className="text-emerald-400" />
                  <span className="hidden sm:inline">{room?.id === 'mmo-world-village' ? 'Mundo MMO' : (room?.name || 'Mesas')}</span>
                </button>
                <button
                  onClick={() => setView('Aventura')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 border border-amber-400/60 transition-all active:scale-95 cursor-pointer"
                  title="Retornar para o mapa tático da aventura"
                >
                  <Swords size={14} className="stroke-[3]" />
                  <span>Retornar ao Jogo</span>
                </button>
              </div>
            </header>
          )}

          {/* Error Banner */}
          {error && (
            <div role="alert" className="error-banner animate-slide-up mb-2">
              <span>{error}</span>
              <button onClick={() => { setError(''); void load(room?.id); }}>
                <RefreshCw size={15} />
              </button>
            </div>
          )}

          {canReturnToPartyBattle && active && (
            <div className="mx-2 sm:mx-4 mb-2 rounded-xl border border-amber-500/60 bg-amber-950/80 shadow-lg px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-amber-100">
                  ?? Seu grupo ainda est? em combate
                </div>
                <div className="text-xs text-amber-200/80">
                  Voc? renasceu na vila, mas seus aliados continuam lutando.
                </div>
              </div>

              <button
                disabled={busy}
                onClick={() =>
                  void action({
                    action: 'joinCombat',
                    character: active.id
                  })
                }
                className="shrink-0 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-black transition-all active:scale-95"
              >
                Retornar ? batalha
              </button>
            </div>
          )}

          {/* Floating Combat Text Overlay */}
          <FloatingTextOverlay items={floatingTexts} />

          {/* Fast 3D Dice Roller (Stabilized with memoized handler to prevent re-roll loop) */}
          <DiceRoller3D roll={currentDiceRoll} onComplete={handleDiceComplete} />

          {/* Paper Doll & Inventory Modal */}
          {showInventory && active && (
            <InventoryPanel
              hero={active}
              onClose={() => setShowInventory(false)}
              onUpdateHero={(updated) => {
                void action({ action: 'character', value: updated });
              }}
              onUseItem={(itemId, targetId) => void handleUseItem(itemId, targetId)}
            />
          )}

          {/* Quest Log Modal */}
          {showQuests && (
            <QuestLog
              onClose={() => setShowQuests(false)}
              notes={state?.notes || ''}
              onSaveNotes={(n) => void action({ action: 'notes', notes: n })}
              isOwner={owner}
              questProgress={active?.questProgress || state?.questProgress}
              worldFlags={active?.worldFlags || state?.worldFlags}
              activeAdventureId={active?.activeMicroAdventureId || state?.activeMicroAdventureId}
              onStartAdventure={handleStartAdventure}
              onChallengeDragon={handleChallengeDragon}
            />
          )}

          {/* NPC Dialog Modal */}
          <NpcDialog
            npc={activeNpcDialog}
            onClose={() => setActiveNpcDialog(null)}
            onSelectOption={(txt) => void narrate(txt)}
          />

          {/* Character Sheet Inspector/Editor Modal */}
          <CharacterEditor
            value={character}
            onClose={() => setCharacter(null)}
            busy={busy}
            onSave={async (value) => {
              const ok = await action({ action: 'character', value });
              if (ok) setCharacter(null);
            }}
          />

          {/* Full Character Creator Wizard (4 Steps D&D 5e) */}
          <CharacterCreator
            isOpen={showCharacterCreator}
            onClose={() => {
              setShowCharacterCreator(false);
              creatorDismissedRef.current = true; // Don't re-open via load()
            }}
            busy={busy}
            onSave={async (newHero) => {
              creatorDismissedRef.current = true; // Don't re-open via load()
              setShowCharacterCreator(false);
              setSelected(newHero.id);
              setView('Aventura');

              // 1. Instant WebSocket broadcast so other players spawn avatar in 0ms!
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'PLAYER_JOIN',
                    roomId: room?.id || 'mmo-world-village',
                    userId: user || 'anon',
                    character: newHero
                  })
                );
              }

              // 2. Persist character via authoritative API action
              const res = await action({ action: 'character', value: newHero });
              const createdHero = res?.room?.state?.characters?.find((c: Character) => c.name === newHero.name) || res?.room?.state?.characters?.[0];
              const heroId = createdHero?.id || newHero.id;
              setSelected(heroId);
              setShowCharacterCreator(false);
              setView('Aventura');
              void narrate('', `${newHero.name}, um ${newHero.species} ${newHero.className} de nível ${newHero.level}, juntou-se à aventura em Vila do Rio Verde!`);
            }}
          />

          {/* ═══ WORLD SELECTION DIALOG ═══ */}
          {/* Shows before character creator for first-time users — clear Solo vs MMO choice */}
          <Dialog open={showWorldSelector} onOpenChange={setShowWorldSelector}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-serif text-amber-200">
                  ⚔️ Escolha seu Mundo
                </DialogTitle>
                <DialogDescription className="text-center text-zinc-400 text-sm">
                  Como deseja jogar Crônicas do Vazio?
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-2">
                {/* Solo Campaign */}
                <button
                  type="button"
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/80 border-2 border-amber-500/60 hover:border-amber-400 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all active:scale-[0.98] text-left group cursor-pointer"
                  onClick={() => {
                    setShowWorldSelector(false);
                    setShowCharacterCreator(true);
                  }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-3xl shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    ⚔️
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong className="block text-sm font-serif text-amber-200 group-hover:text-amber-100">
                      Campanha Solo
                    </strong>
                    <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                      Aventura privada com 3 atos, NPCs, exploração e combate tático. Seu próprio mundo.
                    </span>
                  </div>
                  <ChevronRight size={20} className="text-amber-400 shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* MMO World */}
                <button
                  type="button"
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-emerald-950/80 border-2 border-emerald-500/60 hover:border-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all active:scale-[0.98] text-left group cursor-pointer"
                  onClick={async () => {
                    setShowWorldSelector(false);
                    await load('mmo-world-village');
                    setShowCharacterCreator(true);
                  }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-3xl shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    🌍
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong className="block text-sm font-serif text-emerald-200 group-hover:text-emerald-100">
                      Mundo MMO Online
                    </strong>
                    <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                      Vila compartilhada com outros jogadores. Explore, lute e forme grupos em tempo real.
                    </span>
                  </div>
                  <ChevronRight size={20} className="text-emerald-400 shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Mobile Drawer (Hamburger Menu & Strategic Tools) */}
          <MobileDrawer
            isOpen={isMobileDrawerOpen}
            onClose={() => setIsMobileDrawerOpen(false)}
            currentView={view}
            onSelectView={(v) => setView(v)}
            campaignAct={CAMPAIGN_ACTS[currentAct]}
            dungeonSize={dungeonSize}
            onChangeDungeonSize={(sz) => {
              setDungeonSize(sz);
              setProceduralDungeon(generateProceduralDungeon(currentAct, sz, dungeonSeed));
            }}
            onGenerateNewDungeon={() => {
              const newSeed = Date.now();
              setDungeonSeed(newSeed);
              setProceduralDungeon(generateProceduralDungeon(currentAct, dungeonSize, newSeed));
              void narrate('', 'Uma nova área da masmorra foi revelada sob a névoa arcaica.');
            }}
            onOpenCharacterCreator={() => setShowCharacterCreator(true)}
            onOpenInventory={() => setShowInventory(true)}
            onOpenQuests={() => setShowQuests(true)}
            onOpenJournal={() => setIsJournalOpen(true)}
            onOpenRoomsDialog={() => setRoomDialog(true)}
            onWipeAllData={handleWipeAllData}
            onShortRest={() => void action({ action: 'rest' })}
            onLongRest={() => void action({ action: 'rest' })}
            onAdvanceAct={handleAdvanceAct}
            canAdvanceAct={isActBossDefeated}
            isOwner={owner}
            busy={busy}
          />

          {/* MAIN VIEW SWITCHER */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-zinc-400 font-mono text-sm">
              Carregando mundo de jogo…
            </div>
          ) : !room && view !== 'Compêndio' && view !== 'Mestre de jogo' ? (
            /* Welcome / No Room Selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-4">
              <div className="w-20 h-20 rounded-3xl bg-amber-950/40 border border-amber-500/50 flex items-center justify-center text-amber-300 shadow-2xl">
                <Dices size={40} />
              </div>
              <h1 className="text-3xl font-serif text-amber-200">Bem-vindo a Crônicas do Vazio</h1>
              <p className="text-zinc-400 max-w-md text-sm leading-relaxed">
                Crie ou entre em uma mesa para iniciar a aventura com automação de regras D&D 5e e narração rápida da Groq por IA.
              </p>
              {signedIn ? (
                <button
                  className="gold-button mt-2"
                  disabled={busy}
                  onClick={() => void action({ action: 'create', name: roomName })}
                >
                  <Plus size={18} /> Criar Mesa de Aventura
                </button>
              ) : (
                <a className="gold-button mt-2" href="/signin-with-chatgpt?return_to=/" target="_top">
                  Entrar e Começar <ChevronRight size={16} />
                </a>
              )}
            </div>
          ) : view === 'Aventura' && room ? (
            /* --- AVENTURA: FULL-SCREEN ELECTRONIC GAME CANVAS WITH FLOATING DARK FANTASY HUD --- */
            <div className="flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden bg-[#0a0d0a] relative select-none">
              {/* ═══ TOP INITIATIVE RIBBON BAR (DARK CHARCOAL & VINTAGE GOLD) ═══ */}
              <div className="flex items-center justify-between px-3 py-1 bg-[#101410]/95 border-b border-[#2e3a2b]/80 z-30 shrink-0 gap-2">
                {/* Left: Quick Location & Status */}
                <div className="flex items-center gap-2 shrink-0">
                  {room?.id === 'mmo-world-village' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                      <strong className="text-xs sm:text-sm font-serif text-emerald-300 truncate max-w-[130px] sm:max-w-[180px]" title="Mundo MMO Público Compartilhado">
                        🌍 Mundo MMO
                      </strong>
                      <span className="text-[10px] bg-emerald-950/90 border border-emerald-600/60 text-emerald-300 px-1.5 py-0.2 rounded-full font-mono font-bold">
                        {state?.characters?.length || 0} online
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <strong className="text-xs sm:text-sm font-serif text-amber-200 truncate max-w-[120px] sm:max-w-[160px]">
                        {room?.name || 'Vila do Rio Verde'}
                      </strong>
                      <button
                        type="button"
                        onClick={() => void load('mmo-world-village')}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/80 text-[10px] text-emerald-300 font-bold transition-all shadow cursor-pointer active:scale-95"
                        title="Entrar no Mundo MMO Online com outros aventureiros"
                      >
                        <span>🌐 Mundo MMO</span>
                      </button>
                    </div>
                  )}
                  <span className="hidden xl:inline text-[11px] text-amber-400/80 font-mono">
                    • {CAMPAIGN_ACTS[currentAct].title.split(':')[0]}
                  </span>
                </div>

                {/* Center: Initiative Ribbon */}
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  {!isHeroInVillage && isHeroInCombat && (
                    <InitiativeRibbon
                      combat={Boolean(state?.combat)}
                      round={state?.round || 1}
                      turn={state?.turn || 0}
                      order={state?.order || []}
                      characters={state?.characters || []}
                      enemies={state?.enemies || []}
                      selectedTargetId={selectedEnemyId}
                      onSelectTarget={(id) => {
                        const isHero = state?.characters.some((c) => c.id === id);
                        if (isHero) setSelected(id);
                        else setSelectedEnemyId(id);
                      }}
                    />
                  )}
                </div>

                {/* Right: Biome Selector & Mobile Tab Switcher */}
                {/* Right: Biome Selector, HUD Toggles & Mobile Tab Switcher */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Biome Selector: Os 6 Mapas de Valdoria */}
                  <div className="hidden lg:flex items-center gap-0.5 bg-zinc-900 border border-[#384333]/80 rounded-xl p-0.5 text-[10px] font-bold">
                    {(
                      [
                        { id: 'village', label: 'Vila' },
                        { id: 'forest', label: 'Mata' },
                        { id: 'ruins', label: 'Ruínas' },
                        { id: 'dungeon', label: 'Catacumbas' },
                        { id: 'canyon', label: 'Fenda' },
                        { id: 'lair', label: 'Covil 🌋' }
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleTravel(b.id)}
                        className={`px-2 py-0.5 rounded-lg transition-colors ${
                          battlemapBiome === b.id ? 'bg-amber-600/35 text-amber-200 font-black' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {/* Desktop Quick HUD Toggles */}
                  <div className="hidden md:flex items-center gap-1">
                    <button
                      onClick={() => setShowPartySidebar(!showPartySidebar)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold transition-all ${
                        showPartySidebar
                          ? 'bg-amber-600/30 text-amber-200 border-amber-500/60 shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                      }`}
                      title="Alternar Painel do Grupo"
                    >
                      <Users size={12} />
                      <span>Grupo</span>
                    </button>

                    <button
                      onClick={() => setShowGmSidebar(!showGmSidebar)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold transition-all ${
                        showGmSidebar
                          ? 'bg-amber-600/30 text-amber-200 border-amber-500/60 shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                      }`}
                      title="Alternar Painel do Mestre e Chat"
                    >
                      <Flame size={12} className={showGmSidebar ? 'text-amber-400' : 'text-zinc-400'} />
                      <span>Mestre</span>
                    </button>

                    <button
                      onClick={() => setShowQuests(true)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-zinc-700 text-xs font-semibold transition-colors"
                      title="Diário de Missões"
                    >
                      <ScrollText size={12} />
                      <span>Missões</span>
                    </button>

                    <button
                      onClick={() => setShowInventory(true)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-xs font-semibold transition-colors"
                      title="Mochila e Equipamentos"
                    >
                      <Package size={12} />
                      <span>Mochila</span>
                    </button>
                  </div>

                  {/* Mobile Tab Switcher */}
                  <div className="flex md:hidden items-center gap-0.5 bg-zinc-900 border border-[#384333]/80 rounded-xl p-0.5 text-[11px] font-bold">
                    <button
                      onClick={() => setMobileTab('party')}
                      className={`px-2 py-0.5 rounded-lg transition-colors ${
                        mobileTab === 'party' ? 'bg-amber-600 text-black font-bold' : 'text-zinc-400'
                      }`}
                    >
                      Grupo
                    </button>
                    <button
                      onClick={() => setMobileTab('map')}
                      className={`px-2 py-0.5 rounded-lg transition-colors ${
                        mobileTab === 'map' ? 'bg-amber-600 text-black font-bold' : 'text-zinc-400'
                      }`}
                    >
                      Mapa
                    </button>
                    <button
                      onClick={() => setMobileTab('gm')}
                      className={`px-2 py-0.5 rounded-lg transition-colors ${
                        mobileTab === 'gm' ? 'bg-amber-600 text-black font-bold' : 'text-zinc-400'
                      }`}
                    >
                      Mestre
                    </button>
                  </div>
                </div>
              </div>

              {/* ═══ COMBAT TURN ANNOUNCEMENT BANNER (PROMINENT & UNMISTAKABLE) ═══ */}
              {state?.combat && (
                <div className={`w-full px-4 py-1.5 flex items-center justify-between z-30 shrink-0 shadow-md border-b transition-all duration-300 ${
                  isHeroTurn
                    ? 'bg-gradient-to-r from-amber-950/95 via-amber-900/90 to-amber-950/95 border-amber-400/90 shadow-[0_0_25px_rgba(251,191,36,0.35)]'
                    : 'bg-gradient-to-r from-red-950/95 via-zinc-950 to-red-950/95 border-red-700/90 shadow-[0_0_25px_rgba(239,68,68,0.35)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {isHeroTurn ? (
                      <Swords size={16} className="text-amber-400 animate-pulse" />
                    ) : (
                      <Flame size={16} className="text-red-500 animate-pulse" />
                    )}
                    <span className={`font-serif font-black text-xs sm:text-sm tracking-wider uppercase ${
                      isHeroTurn ? 'text-amber-200' : 'text-red-200'
                    }`}>
                      {isHeroTurn
                        ? `🛡️ SEU TURNO: ${turnEntity?.name || active?.name}`
                        : `⚔️ TURNO DO INIMIGO: ${turnEntity?.name || 'Inimigo'}`}
                    </span>
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                      isHeroTurn ? 'bg-amber-400 text-black shadow' : 'bg-red-600 text-white shadow'
                    }`}>
                      RODADA {state.round || 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    {isHeroTurn ? (
                      <>
                        <span className={state.actionUsed ? 'text-amber-300 font-bold' : 'text-emerald-300 font-bold animate-pulse'}>
                          {state.actionUsed ? '⏳ Ação Utilizada' : '✨ 1 Ação'}
                        </span>
                        <span className="text-zinc-500 hidden sm:inline">•</span>
                        <span className="text-cyan-300 font-bold hidden sm:inline">{active?.speed || 9}m Deslocamento</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (active) void action({ action: 'pass', character: active.id });
                          }}
                          disabled={busy}
                          className="ml-1 sm:ml-2 px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.6)] border border-yellow-200 transition-all active:scale-95 flex items-center gap-1.5 animate-pulse cursor-pointer"
                          title="Finalizar turno do personagem e passar a vez (D&D 5e)"
                        >
                          <Clock size={13} className="stroke-[3]" />
                          <span>Fim de Turno</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 animate-pulse">Aguardando IA do adversário...</span>
                        {owner && (
                          <button
                            type="button"
                            onClick={() => {
                              void action({ action: 'pass', character: turnId });
                            }}
                            disabled={busy}
                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono border border-zinc-600"
                            title="Mestre: Pular / Avançar Turno"
                          >
                            Pular ▶
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ FULL-SCREEN GAME ARENA WITH FLOATING CRPG HUD ═══ */}
              <div className="flex-1 min-h-0 h-full w-full relative overflow-hidden bg-[#050806]">
                {/* 1. FULL-BLEED TACTICAL DUNGEON BOARD (Fills 100% of Screen Space) */}
                <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
                  <TacticalMap
                    characters={state?.characters || []}
                    enemies={isHeroInVillage ? [] : (state?.enemies || [])}
                    selectedHeroId={active?.id || selected}
                    selectedEnemyId={selectedEnemyId}
                    targetingAction={targetingAction}
                    onCancelTargeting={() => {
                      setTargetingAction(null);
                      setIsBottomHudMinimized(false);
                    }}
                    onSelectToken={(type, id) => {
                      if (type === 'hero') setSelected(id);
                      else setSelectedEnemyId(id);
                    }}
                    onMoveHero={(heroId, x, y) => {
                      const curGrid = battlemapBiome === 'village' ? 8 : dungeonSize;
                      // 1. Arm rollback shield to prevent older incoming snapshots from resetting position
                      localMoveShieldRef.current[heroId] = { x, y, time: Date.now() };

                      // 2. Optimistic Update: instantly update position locally for zero perceived latency!
                      setRoom((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          state: {
                            ...prev.state,
                            characters: prev.state.characters.map((c) => (c.id === heroId ? { ...c, x, y } : c))
                          }
                        };
                      });

                      // 3. Instant local cross-window sync on the same PC (0ms latency)
                      try {
                        broadcastChannelRef.current?.postMessage({
                          type: 'HERO_MOVE',
                          heroId,
                          x,
                          y
                        });
                      } catch {}

                      // Calculate step waypoints for animation and broadcast
                      const hero = state?.characters.find((c) => c.id === heroId);
                      const waypoints: { x: number; y: number }[] = [];
                      if (hero) {
                        let cx = hero.x;
                        let cy = hero.y;
                        while (cx !== x || cy !== y) {
                          cx += Math.sign(x - cx);
                          cy += Math.sign(y - cy);
                          waypoints.push({ x: cx, y: cy });
                        }
                      }
                      if (waypoints.length === 0) waypoints.push({ x, y });

                      // MMO: REST is authoritative and persists movement.
                      // The server broadcasts HERO_MOVED after the database update.
                      if (isMmoRoom) {
                        void action({ action: 'move', character: heroId, x, y, waypoints, maxBound: curGrid - 1, gridSize: curGrid });
                      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                          JSON.stringify({
                            type: 'MOVE_PATH',
                            roomId: room?.id,
                            characterId: heroId,
                            waypoints,
                            seq: ++clientSeqRef.current,
                            maxBound: curGrid - 1,
                            gridSize: curGrid
                          })
                        );
                      } else {
                        void action({ action: 'move', character: heroId, x, y, waypoints, maxBound: curGrid - 1, gridSize: curGrid });
                      }
                    }}
                    onMoveHeroPath={(heroId, waypoints) => {
                      if (waypoints.length === 0) return;
                      const finalDest = waypoints[waypoints.length - 1];
                      const curGrid = battlemapBiome === 'village' ? 8 : dungeonSize;

                      // 1. Arm rollback shield
                      localMoveShieldRef.current[heroId] = { x: finalDest.x, y: finalDest.y, time: Date.now() };

                      // 2. Optimistic Update: instantly update position locally for zero perceived latency!
                      setRoom((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          state: {
                            ...prev.state,
                            characters: prev.state.characters.map((c) => (c.id === heroId ? { ...c, x: finalDest.x, y: finalDest.y } : c))
                          }
                        };
                      });

                      // 3. Instant cross-window broadcast on same PC
                      try {
                        broadcastChannelRef.current?.postMessage({
                          type: 'HERO_MOVE_PATH',
                          heroId,
                          waypoints
                        });
                      } catch {}

                      // MMO: REST is authoritative and persists movement.
                      // The server broadcasts HERO_MOVED after the database update.
                      if (isMmoRoom) {
                        void action({
                          action: 'move',
                          character: heroId,
                          x: finalDest.x,
                          y: finalDest.y,
                          waypoints,
                          maxBound: curGrid - 1,
                          gridSize: curGrid
                        });
                      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                          JSON.stringify({
                            type: 'MOVE_PATH',
                            roomId: room?.id,
                            characterId: heroId,
                            waypoints,
                            seq: ++clientSeqRef.current,
                            maxBound: curGrid - 1,
                            gridSize: curGrid
                          })
                        );
                      } else {
                        void action({
                          action: 'move',
                          character: heroId,
                          x: finalDest.x,
                          y: finalDest.y,
                          waypoints,
                          maxBound: curGrid - 1,
                          gridSize: curGrid
                        });
                      }
                    }}
                    remoteWalkPath={remoteWalkPath}
                    onTargetEnemy={(enemyId) => {
                      handleExecuteAttack(enemyId);
                    }}
                    locationName={location.name}
                    locationLabel={location.label}
                    isCombat={Boolean(state?.combat)}
                    canMove={Boolean(canEdit && (!state?.combat || isHeroTurn))}
                    dungeon={proceduralDungeon}
                    battlemap={organicBattlemap}
                    onInteractObject={handleInteractObject}
                    busy={busy}
                    activeTurnId={state?.combat ? turnId : undefined}
                    npcs={state?.npcs || []}
                    corpses={state?.corpses || []}
                    onLootCorpse={async (corpseId) => {
                      if (!active) return;
                      const corpse = (state?.corpses || []).find((c) => c.id === corpseId);
                      try { playSfx('loot'); } catch {}
                      if (corpse) {
                        const curGrid = battlemapBiome === 'village' ? 8 : dungeonSize;
                        const posX = ((corpse.x + 0.5) / curGrid) * 100;
                        const posY = ((corpse.y + 0.5) / curGrid) * 100;
                        const sparkleId = crypto.randomUUID();
                        setLootSparkles((prev) => [...prev, { x: posX, y: posY, id: sparkleId }]);
                        setTimeout(() => {
                          setLootSparkles((prev) => prev.filter((s) => s.id !== sparkleId));
                        }, 950);

                        const floatId = crypto.randomUUID();
                        const lootText = corpse.gold > 0 ? `+${corpse.gold} PO 🪙` : (corpse.items?.length ? `+${corpse.items[0]} ✨` : 'Saqueado!');
                        setFloatingTexts((prev) => [...prev, {
                          id: floatId,
                          x: posX,
                          y: posY,
                          text: lootText,
                          type: 'loot'
                        }]);
                        setTimeout(() => {
                          setFloatingTexts((prev) => prev.filter((f) => f.id !== floatId));
                        }, 1800);
                      }
                      await action({ action: 'lootCorpse', character: active.id, corpseId });
                    }}
                    onNavigatePortal={async (targetBiome) => {
                      try { playSfx('door'); } catch {}
                      await handleTravel(targetBiome);
                    }}
                    onTalkNpc={handleTalkNpc}
                    projectiles={activeProjectiles}
                    biome={battlemapBiome}
                    movementUsed={state?.movementUsed || 0}
                    onInteractPlayer={(hero) => setInteractingPlayer(hero)}
                    screenShake={hitStopType === 'crit'}
                    tokenRecoils={tokenRecoils}
                    slashVfx={slashVfx}
                    healVfx={healVfx}
                    lootSparkles={lootSparkles}
                  />
                </div>

                {/* ═══ TARGETING SELECTION MODE BANNER (CRPG HIGH VISIBILITY) ═══ */}
                {targetingAction && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-red-950 via-zinc-950 to-red-950 border-2 border-red-500/90 shadow-[0_0_30px_rgba(239,68,68,0.7)] backdrop-blur-xl animate-fade-in pointer-events-auto">
                    <Crosshair size={18} className="text-red-400 animate-spin-slow shrink-0" />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-serif font-black text-amber-200 text-xs sm:text-sm tracking-wide">
                        ALVO: {targetingAction.name}
                      </span>
                      <span className="text-[10px] text-zinc-300 font-mono">
                        ({targetingAction.rangeSquares * 1.5}m) • Selecione um inimigo no tabuleiro
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setTargetingAction(null);
                        setIsBottomHudMinimized(false);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold border border-zinc-600 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <X size={13} />
                      <span>Cancelar (Esc)</span>
                    </button>
                  </div>
                )}

                {/* ═══ CRPG DEFEAT & RESPAWN MODAL ═══ */}
                {active && active.hp <= 0 && (
                  <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in select-none">
                    <div className="relative w-full max-w-md bg-gradient-to-b from-[#1c0e0e] via-[#120808] to-[#080404] border-2 border-red-600/90 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(239,68,68,0.5)] flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-red-950 border-2 border-red-500/80 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse">
                        💀
                      </div>
                      <div>
                        <h2 className="text-2xl font-serif font-black text-red-200 tracking-wider uppercase">
                          Herói Derrotado
                        </h2>
                        <p className="text-xs sm:text-sm text-zinc-300 mt-2 leading-relaxed">
                          Seus pontos de vida chegaram a zero. Os guardas e curandeiros de Vila do Rio Verde resgatam você e o acolhem no Santuário Sagrado.
                        </p>
                      </div>
                      <div className="w-full bg-black/60 border border-zinc-800 rounded-2xl p-2.5 text-xs text-amber-300 font-mono">
                        🕊️ Você renascerá na vila com os Pontos de Vida (PV) totalmente restaurados.
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => {
                          void action({ action: 'respawn', character: active.id });
                        }}
                        className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-sm tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <span>🕊️ Renascer no Santuário da Vila</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ FLOATING TACTICAL & OPEN WORLD COMBAT TURN CONTROLS ═══ */}
                {!isHeroInVillage && state?.combat && isHeroInCombat ? (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#0b0f0b]/95 border-2 border-amber-500/90 shadow-[0_8px_32px_rgba(0,0,0,0.95)] backdrop-blur-xl animate-fade-in pointer-events-auto">
                    <div className="flex items-center gap-1.5 pr-2.5 border-r border-zinc-800 text-xs font-mono">
                      <span className="text-[10px] uppercase font-bold text-zinc-400">Rodada</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                        {state.round || 1}
                      </span>
                    </div>

                    {state.order && state.order.includes(active?.id || '') ? (
                      isHeroTurn ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-serif font-bold text-amber-200 pr-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                            <span>Sua Vez: {active?.name || 'Herói'}</span>
                          </div>

                          {/* Quick Attack Button if enemy exists */}
                          {currentEnemy && (
                            <button
                              type="button"
                              onClick={() => handleExecuteAttack(currentEnemy.id)}
                              disabled={busy}
                              className="px-2.5 py-1 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/80 text-red-100 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow hover:shadow-red-500/20 cursor-pointer"
                              title={`Atacar ${currentEnemy.name} com ${active?.weapon || 'arma'}`}
                            >
                              <Swords size={13} className="text-red-400" />
                              <span className="hidden sm:inline">Atacar</span>
                              <span className="text-[11px] text-red-200">({currentEnemy.name})</span>
                            </button>
                          )}

                          {/* Big Glowing Pass Turn / End Turn Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (active) void action({ action: 'pass', character: active.id });
                            }}
                            disabled={busy}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.7)] border-2 border-yellow-200 transition-all active:scale-95 flex items-center gap-1.5 animate-pulse cursor-pointer"
                            title="Encerrar seu turno e passar a vez para o próximo combatente (D&D 5e)"
                          >
                            <Clock size={15} className="stroke-[3] text-black" />
                            <span>PASSAR O TURNO (FIM)</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-300 font-serif font-bold animate-pulse">
                            ⚔️ Turno de: {turnEntity?.name || 'Inimigo'}
                          </span>
                          {owner && (
                            <button
                              type="button"
                              onClick={() => {
                                void action({ action: 'pass', character: turnId });
                              }}
                              disabled={busy}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono border border-zinc-600 ml-1 shadow cursor-pointer"
                              title="Mestre: Forçar avanço de turno"
                            >
                              Forçar Próximo ▶
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      /* Player in MMO watching ongoing battle */
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs text-amber-200 font-serif">
                          ⚔️ Batalha em Andamento ({turnEntity?.name || 'Inimigo'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (active) void action({ action: 'joinCombat', character: active.id });
                          }}
                          disabled={busy}
                          className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.7)] border border-emerald-300 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                          title="Rolar iniciativa e participar desta batalha"
                        >
                          <Shield size={13} className="text-white" />
                          <span>Entrar na Batalha</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : !isHeroInVillage && livingEnemies.length > 0 ? (
                  /* Open World Free Combat Banner */
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-[#0b0f0b]/95 border border-sky-500/80 shadow-[0_8px_30px_rgba(0,0,0,0.9)] backdrop-blur-xl animate-fade-in pointer-events-auto">
                    <div className="flex items-center gap-1.5 text-xs text-sky-200 font-serif">
                      <Swords size={14} className="text-sky-400 animate-pulse" />
                      <span className="hidden sm:inline font-bold">Combate Aberto (Tempo Real)</span>
                    </div>

                    {currentEnemy && (
                      <button
                        type="button"
                        onClick={() => handleExecuteAttack(currentEnemy.id)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/80 text-red-100 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow cursor-pointer"
                        title={`Atacar ${currentEnemy.name}`}
                      >
                        <span>Golpear {currentEnemy.name}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (active) void action({ action: 'startCombat', character: active.id });
                      }}
                      disabled={busy}
                      className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider shadow border border-yellow-200 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                      title="Iniciar combate formal por turnos e rolar iniciativa com a party (D&D 5e)"
                    >
                      <Crown size={12} className="text-black" />
                      <span className="hidden sm:inline">Iniciar Batalha Tática (Iniciativa)</span>
                      <span className="sm:hidden">Iniciativa</span>
                    </button>
                  </div>
                ) : null}

                {/* 1.1 LIVE GM NARRATION FLOATING WIDGET (Always visible directly on screen) */}
                {latestGmLog && showNarrativeBox && !showGmSidebar && (
                  <div className="absolute top-3 right-3 sm:right-4 z-20 max-w-xs sm:max-w-md bg-[#090e09]/95 border border-amber-500/70 rounded-2xl p-3 shadow-[0_8px_30px_rgba(0,0,0,0.85)] backdrop-blur-xl animate-fade-in pointer-events-auto">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-serif font-bold">
                        <Flame size={14} className="animate-pulse text-amber-400" />
                        <span>Voz do Mestre</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowGmSidebar(true)}
                          className="text-[10px] text-amber-400 hover:text-amber-200 underline font-mono"
                        >
                          Histórico
                        </button>
                        <button
                          onClick={() => setShowNarrativeBox(false)}
                          className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
                          title="Dispensar narração"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-56 sm:max-h-64 overflow-y-auto pr-1.5 custom-scrollbar">
                      <p className="text-xs text-amber-100/95 leading-relaxed font-serif italic whitespace-pre-line">
                        "{latestGmLog.text}"
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. DOCKED LEFT PARTY COLUMN (LATERAL PARTY ROSTER - COLLAPSIBLE) */}
                {showPartySidebar && (
                  <div className={`absolute top-2 left-2 bottom-20 z-20 pointer-events-auto transition-all duration-300 ${
                    mobileTab === 'party' ? 'flex' : 'hidden'
                  } md:flex flex-col`}>
                    <PartySidebar
                      party={state?.characters || []}
                      activeHeroId={selected}
                      onSelectHero={(id) => setSelected(id)}
                      onOpenCharacterSheet={(hero) => setCharacter(structuredClone(hero))}
                      onOpenInventory={() => setShowInventory(true)}
                      onOpenCharacterCreator={() => {
                        if (room?.id === 'mmo-world-village' && state?.characters?.some((c) => c.owner === user)) {
                          setError('Você já possui um personagem ativo neste mundo MMO.');
                          return;
                        }
                        setShowCharacterCreator(true);
                      }}
                      onOpenLevelUp={(hero) => {
                        setLevelUpHero(hero);
                        setShowLevelUp(true);
                      }}
                      onShortRest={() => void action({ action: 'shortRest' })}
                      onWipeData={handleWipeAllData}
                      onSelectView={(v) => setView(v)}
                      busy={busy}
                      currentUserId={user}
                      isMmoRoom={room?.id === 'mmo-world-village'}
                      onInteractPlayer={(hero) => setInteractingPlayer(hero)}
                      onInviteToParty={async (hero) => {
                        const senderCharId = active?.id || myHeroes[0]?.id || selected;
                        await action({ action: 'partyInvite', character: senderCharId, targetCharId: hero.id });
                      }}
                      onLeaveParty={async () => {
                        const senderCharId = active?.id || myHeroes[0]?.id || selected;
                        await action({ action: 'partyLeave', character: senderCharId });
                      }}
                    />
                  </div>
                )}

                {/* 3. DOCKED RIGHT GAMEMASTER DRAWER (CAIXA DE GM RETRÁTIL COM NARRATIVA E CHAT) */}
                {showGmSidebar && (
                  <div className={`absolute top-2 right-2 bottom-20 z-30 pointer-events-auto transition-all duration-300 ${
                    mobileTab === 'gm' ? 'flex' : 'hidden'
                  } md:flex flex-col shadow-2xl`}>
                    <GamemasterSidebar
                      combat={Boolean(state?.combat)}
                      round={state?.round || 1}
                      isHeroTurn={Boolean(isHeroTurn)}
                      activeHero={active || null}
                      currentEnemy={currentEnemy}
                      onAttack={() => {
                        if (active && currentEnemy && currentEnemy.hp > 0) {
                          handleExecuteAttack(currentEnemy.id);
                        } else if (active && livingEnemies.length > 0) {
                          handleExecuteAttack(livingEnemies[0].id);
                        }
                      }}
                      onCastSpell={() => {
                        if (active) {
                          const target = (currentEnemy && currentEnemy.hp > 0) ? currentEnemy : livingEnemies[0];
                          if (target) {
                            void action({
                              action: 'spell',
                              character: active.id,
                              spellName: 'Raio de Fogo',
                              spellLevel: 0,
                              damageFormula: '1d10',
                              target: target.id
                            });
                          }
                        }
                      }}
                      onUsePotion={() => {
                        if (active) void handleUseItem('pocao-cura', active.id);
                      }}
                      onEndTurn={() => {
                        if (active) void action({ action: 'pass', character: active.id });
                      }}
                      onNarrateMessage={(msg) => void narrate(msg)}
                      onRollDice={(formula) => {
                        void action({ action: 'roll', formula }).then((res) => {
                          if (res) void narrate('', `${active?.name || 'Aventureiro'} rolou ${formula}.`);
                        });
                      }}
                      lastRollResult={currentDiceRoll ? { formula: currentDiceRoll.label || '1d20', total: currentDiceRoll.total, detail: `d20 (${currentDiceRoll.raw}) + ${currentDiceRoll.modifier} = ${currentDiceRoll.total}` } : null}
                      logs={state?.logs || []}
                      aiChoices={aiChoices}
                      busy={busy}
                      onClose={() => setShowGmSidebar(false)}
                      onSendChat={(text) => {
                        void action({ action: 'chat', text, characterName: active?.name || user });
                      }}
                      isMmoRoom={room?.id === 'mmo-world-village'}
                    />
                  </div>
                )}

                {/* 4. FLOATING BOTTOM ACTION BAR (ATAQUE, MAGIA, PASSAR TURNO, POÇÃO, ITENS) */}
                {active && (
                  <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[98%] max-w-6xl transition-all ${
                    mobileTab === 'party' || mobileTab === 'gm' ? 'hidden md:block' : 'block'
                  }`}>
                    <BottomPlayerHud
                      activeHero={active}
                      party={state?.characters || []}
                      onSelectHero={(id) => setSelected(id)}
                      isMinimized={isBottomHudMinimized}
                      onToggleMinimized={(v) => setIsBottomHudMinimized(v)}
                      onActionSelect={(act) => {
                        if (act.category === 'attack' || (act.category === 'spell' && !act.healFormula)) {
                          // Minimize bottom console and enter explicit Target Selection Mode on the board
                          setTargetingAction(act);
                          setIsBottomHudMinimized(true);
                        } else if (act.category === 'spell' && act.healFormula) {
                          void action({
                            action: 'spell',
                            character: active.id,
                            spellName: act.name,
                            spellLevel: act.spellLevel || 0,
                            healFormula: act.healFormula,
                            targetId: active.id
                          });
                        } else if (act.category === 'item') {
                          void handleUseItem(act.id, active.id);
                        } else if (act.category === 'skill') {
                          void action({
                            action: 'check',
                            character: active.id,
                            skill: act.name.replace('Teste de ', ''),
                            mode: 'normal'
                          });
                        } else if (act.category === 'action') {
                          void action({ action: 'tactic', character: active.id, tactic: act.id });
                        }
                      }}
                      onOpenInventory={() => setShowInventory(true)}
                      onOpenShop={() => {
                        setShopMerchant({
                          id: 'elenor',
                          name: 'Empório de Valdoria',
                          role: 'Mercado de Provisões & Alquimia',
                          category: 'alchemy',
                          avatar: '🛒',
                          dialogue: 'Poções, armas e suprimentos certificados pelo Ancião Doran para sua jornada.'
                        });
                        setShowShop(true);
                      }}
                      onOpenLevelUp={() => {
                        if (active) {
                          setLevelUpHero(active);
                          setShowLevelUp(true);
                        }
                      }}
                      onOpenCharacterSheet={() => {
                        if (active) setCharacter(structuredClone(active));
                      }}
                      onEndTurn={() => {
                        if (active) void action({ action: 'pass', character: active.id });
                      }}
                      onUseItem={(itemId, targetId) => void handleUseItem(itemId, targetId)}
                      isCombat={Boolean(state?.combat)}
                      isHeroTurn={Boolean(isHeroTurn)}
                      actionUsed={Boolean(state?.actionUsed)}
                      busy={busy}
                    />
                  </div>
                )}

                {/* Act Boss Defeated Victory Banner */}
                {isActBossDefeated && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-md bg-gradient-to-r from-amber-950/95 via-stone-900/95 to-amber-950/95 border border-amber-400/80 rounded-xl p-2 shadow-2xl flex items-center justify-between animate-slide-up backdrop-blur-md">
                    <div className="flex items-center gap-2 text-xs text-amber-200">
                      <Sparkles size={16} className="text-amber-400 animate-spin-slow shrink-0" />
                      <div>
                        <strong className="block text-xs font-serif text-amber-300">
                          Inimigos Derrotados!
                        </strong>
                        <span className="text-[10px] text-zinc-300">
                          A passagem para o próximo nível está liberada.
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleAdvanceAct}
                      className="gold-button text-xs py-1 px-2.5 animate-pulse shrink-0"
                    >
                      <span>Avançar de Ato</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                {/* 1.2 ON-SCREEN CAMPAIGN STEP TRACKER & STORY GUIDE */}
                <CampaignTracker
                  state={state || null}
                  activeHero={active}
                  onTalkNpc={(npcId) => handleTalkNpc(npcId)}
                  onTravel={(b) => handleTravel(b)}
                  onStartCombat={() => {
                    if (active) void action({ action: 'startCombat', character: active.id });
                  }}
                  onOpenJournal={() => setShowQuests(true)}
                />

                {/* Quest Log / Diário de Missões Modal */}
                {showQuests && (
                  <QuestLog
                    onClose={() => setShowQuests(false)}
                    notes={state?.notes || ''}
                    onSaveNotes={(n) => void action({ action: 'notes', notes: n })}
                    isOwner={Boolean(owner)}
                    questProgress={active?.questProgress || state?.questProgress}
                    worldFlags={active?.worldFlags || state?.worldFlags}
                    activeAdventureId={active?.activeMicroAdventureId || state?.activeMicroAdventureId}
                    onStartAdventure={handleStartAdventure}
                    onChallengeDragon={handleChallengeDragon}
                  />
                )}

                {/* Inventory & Equipment Panel Modal */}
                {showInventory && active && (
                  <InventoryPanel
                    hero={active}
                    onUpdateHero={(updated) => void action({ action: 'character', value: updated })}
                    onClose={() => setShowInventory(false)}
                    onUseItem={(itemId, targetId) => void handleUseItem(itemId, targetId)}
                  />
                )}

                {/* D&D 5e Level Up Modal */}
                {showLevelUp && (levelUpHero || active) && (
                  <LevelUpModal
                    hero={levelUpHero || active!}
                    isOpen={showLevelUp}
                    onClose={() => {
                      setShowLevelUp(false);
                      setLevelUpHero(null);
                    }}
                    onConfirmLevelUp={(statIncreases: number[]) => {
                      const target = levelUpHero || active;
                      if (!target) return;
                      void action({
                        action: 'levelup',
                        character: target.id,
                        statIncreases
                      });
                      setShowLevelUp(false);
                      setLevelUpHero(null);
                    }}
                  />
                )}

                {/* NPC Dialogue Modal */}
                {activeNpcDialog && (
                  <NpcDialog
                    npc={activeNpcDialog}
                    onSelectOption={(actionText) => {
                      if (actionText === 'OPEN_SHOP_ELENOR') {
                        setShopMerchant({
                          id: 'elenor',
                          name: 'Alquimista Elenor',
                          role: 'Erborista • Mestre das Poções',
                          category: 'alchemy',
                          avatar: '🧪',
                          dialogue: 'Trago elixires destilados das raízes de Valdoria e pergaminhos arcanos para suas expedições.'
                        });
                        setShowShop(true);
                        setActiveNpcDialog(null);
                        return;
                      }
                      if (actionText === 'OPEN_SHOP_KAELEN') {
                        setShopMerchant({
                          id: 'kaelen',
                          name: 'Capitão Kaelen',
                          role: 'Guarda da Fronteira • Armeiro da Vila',
                          category: 'blacksmith',
                          avatar: '⚔️',
                          dialogue: 'Aço forjado nas colinas e armaduras robustas certificadas para combate.'
                        });
                        setShowShop(true);
                        setActiveNpcDialog(null);
                        return;
                      }
                      if (actionText === 'TALK_DORAN') {
                        setActiveNpcDialog(null);
                        handleTalkNpc('doran');
                        return;
                      }
                      if (actionText === 'TALK_ELENOR') {
                        setActiveNpcDialog(null);
                        handleTalkNpc('elenor');
                        return;
                      }
                      if (actionText === 'TALK_KAELEN') {
                        setActiveNpcDialog(null);
                        handleTalkNpc('kaelen');
                        return;
                      }
                      if (actionText === 'TRAVEL_FOREST') {
                        setActiveNpcDialog(null);
                        void handleTravel('forest');
                        return;
                      }
                      void narrate('', `${active?.name || 'O herói'}: "${actionText}"`);
                      setActiveNpcDialog(null);
                    }}
                    onClose={() => setActiveNpcDialog(null)}
                  />
                )}

                {/* Shop & Commerce Modal */}
                {showShop && shopMerchant && active && (
                  <ShopModal
                    isOpen={showShop}
                    merchant={shopMerchant}
                    hero={active}
                    priceMultiplier={state?.economyContext?.priceMultiplier || 1.0}
                    economyNotice={state?.economyContext?.narrativeNotice}
                    onClose={() => setShowShop(false)}
                    onBuyItem={async (item, price) => {
                      await action({
                        action: 'buyItem',
                        character: active.id,
                        item,
                        price
                      });
                    }}
                    onSellItem={async (itemName, salePrice) => {
                      await action({
                        action: 'sellItem',
                        character: active.id,
                        itemName,
                        salePrice
                      });
                    }}
                  />
                )}
              </div>
            </div>
          ) : view === 'Personagens' && room ? (
            /* --- PERSONAGENS VIEW --- */
            <div className="flex flex-col gap-3">
              {/* Onboarding Banner for Characters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#101410] to-[#121612] border border-amber-500/40 shadow-xl gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 shadow">
                    <Users size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-serif font-black text-amber-200">
                      Câmara dos Aventureiros & Heróis
                    </h2>
                    <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
                      Gerencie as fichas dos seus heróis ou forje um novo personagem com o construtor guiado D&D 5e (SRD 5.2.1). Todos os personagens estão prontos para explorar a aventura e o Mundo MMO.
                    </p>
                  </div>
                </div>
                {(!isMmoRoom || !myHeroes || myHeroes.length === 0) && (
                  <button
                    onClick={() => setShowCharacterCreator(true)}
                    disabled={busy}
                    className="gold-button text-xs py-2 px-3.5 shrink-0 self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={15} className="stroke-[3]" />
                    <span>Criar Novo Personagem</span>
                  </button>
                )}
              </div>

              <Tabs defaultValue="heroes">
                <TabsList>
                  <TabsTrigger value="heroes">Aventureiros ({state?.characters?.length || 0})</TabsTrigger>
                  <TabsTrigger value="npcs">NPCs do Cenário ({state?.npcs?.length || 0})</TabsTrigger>
                </TabsList>
                <TabsContent value="heroes">
                  <div className="character-grid">
                    {state?.characters.map((c) => (
                      <article className="panel character-card" key={c.id}>
                        <div className="character-title">
                          <div className="avatar large">{c.name[0]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h2>{c.name}</h2>
                              {c.owner === user ? (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 font-mono">
                                  Seu Herói
                                </span>
                              ) : (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40 font-mono">
                                  Aliado
                                </span>
                              )}
                            </div>
                            <p>
                              {c.species} • {c.className} {c.level}
                            </p>
                          </div>
                        </div>
                        <div className="vitals">
                          <span>
                            <Heart size={17} />
                            {c.hp}/{c.maxHp} PV
                          </span>
                          <span>
                            <Shield size={17} />
                            {c.ac} CA
                          </span>
                          <span>
                            <Footprints size={17} />
                            {c.speed} m
                          </span>
                        </div>
                        <div className="stats">
                          {abilities.map((x, i) => (
                            <div key={x}>
                              <small>{x.slice(0, 3).toUpperCase()}</small>
                              <strong>{signed(mod(c.stats[i]))}</strong>
                              <span>{c.stats[i]}</span>
                            </div>
                          ))}
                        </div>
                        <div className="button-row">
                          <button
                            className="gold-button"
                            disabled={busy || state.combat || (!owner && c.owner !== user)}
                            onClick={() => setCharacter(structuredClone(c))}
                          >
                            Abrir ficha
                          </button>
                          <button
                            className="text-button"
                            onClick={() => {
                              setSelected(c.id);
                              setView('Aventura');
                            }}
                          >
                            Jogar <ChevronRight size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                    <button
                      className="create-card"
                      disabled={busy || state?.combat}
                      onClick={() => setShowCharacterCreator(true)}
                    >
                      <Plus size={28} />
                      <h2>Um novo aventureiro</h2>
                      <p>Crie a próxima história da sua mesa (Wizard de 4 passos).</p>
                    </button>
                  </div>
                </TabsContent>
                <TabsContent value="npcs">
                  <div className="character-grid">
                    {state?.npcs.map((n) => (
                      <article className="panel" key={n.id}>
                        <p className="eyebrow">{n.role}</p>
                        <h2>{n.name}</h2>
                        <p>{n.description}</p>
                      </article>
                    ))}
                  </div>
                  {owner && (
                    <form
                      className="panel form-grid"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void action({ action: 'npc', name: npcName, role: npcRole, description: npcDesc }).then(
                          (ok) => {
                            if (ok) {
                              setNpcName('');
                              setNpcRole('');
                              setNpcDesc('');
                            }
                          }
                        );
                      }}
                    >
                      <label className="field">
                        Nome
                        <input required maxLength={60} value={npcName} onChange={(e) => setNpcName(e.target.value)} />
                      </label>
                      <label className="field">
                        Papel
                        <input required maxLength={100} value={npcRole} onChange={(e) => setNpcRole(e.target.value)} />
                      </label>
                      <label className="field span-two">
                        História
                        <textarea
                          required
                          value={npcDesc}
                          maxLength={3000}
                          onChange={(e) => setNpcDesc(e.target.value)}
                        />
                      </label>
                      <button disabled={busy} className="gold-button">
                        Adicionar NPC
                      </button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : view === 'Compêndio' ? (
            /* --- COMPÊNDIO VIEW --- */
            <Library />
          ) : view === 'Atlas' && room ? (
            /* --- ATLAS VIEW --- */
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#101612] to-[#121612] border border-emerald-500/40 shadow-xl gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 shadow">
                    <Compass size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-serif font-black text-emerald-200">
                      Atlas de Valdoria • Reinos e Biomas
                    </h2>
                    <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
                      Viaje entre os cenários da campanha: da pacífica Vila do Rio Verde até as densas matas da Floresta dos Sussurros e as profundezas das Catacumbas.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setView('Aventura')}
                  className="gold-button text-xs py-2 px-3 shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Swords size={14} />
                  <span>Explorar no Tabuleiro</span>
                </button>
              </div>

              <div className="atlas-scene scene">
                <div className="scene-caption">
                  <p className="eyebrow">VALDORIA • CAMPANHA ORIGINAL</p>
                  <h2>Três lugares. Um segredo.</h2>
                </div>
              </div>
              <div className="character-grid">
                {locations.map((l, i) => (
                  <article className="panel" key={l.name}>
                    <p className="eyebrow">LOCAL {(i + 1).toString().padStart(2, '0')}</p>
                    <h2>{l.name}</h2>
                    <p>{l.text}</p>
                    {state!.location === i ? (
                      <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-bold font-mono">
                        📍 Localização Atual
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] text-amber-300/80 font-mono">
                          🚪 Acesso via portões e portais do mapa tático da aventura.
                        </span>
                        <button
                          type="button"
                          onClick={() => setView('Aventura')}
                          className="gold-button text-xs py-1.5 px-3 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ir para o Mapa Tático</span> <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : view === 'Mestre de jogo' ? (
            /* --- MESTRE DE JOGO VIEW --- */
            <div className="settings-layout">
              <section className="panel">
                <p className="eyebrow">
                  <Flame size={16} /> INTELIGÊNCIA ARTIFICIAL (GROQ & GEMINI)
                </p>
                <h2>A Voz do seu Mundo</h2>
                <p>
                  A Groq (Llama 3.3 70B) fornece inferência ultrarrápida para videogame, com narrações concisas e opções de ação interativas.
                </p>
                <label className="field">
                  Chave da API (Groq ou Gemini)
                  <input
                    type="password"
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Chave personalizada ou deixe em branco para chave padrão"
                  />
                </label>
                <p className="muted">
                  A chave oficial da Groq já está configurada por padrão no servidor para a sua mesa.
                </p>
              </section>

              <section className="panel">
                <p className="eyebrow">
                  <ScrollText size={16} /> CONTRATO DE REGRAS 5e
                </p>
                <h2>Automação & Narrativa</h2>
                <p>
                  A IA não altera PV, resultados mecânicos ou fichas. Ela reage estritamente ao resultado das rolagens automáticas do motor de regras.
                </p>
              </section>
            </div>
          ) : null}

          {/* Footer Attribution */}
          <footer className="mt-8 text-center text-xs text-zinc-600 border-t border-zinc-900 pt-3">
            This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC. Licenciado sob CC BY 4.0.
          </footer>
        </section>

        {/* Mobile Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#121612]/95 backdrop-blur-md border-t border-zinc-800 flex items-center justify-around py-1.5 px-2 shadow-2xl">
          {navigation.map(({ icon: Icon, name }) => (
            <button
              key={name}
              onClick={() => setView(name)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors text-[10px] font-medium ${
                view === name ? 'text-amber-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={18} className={view === name ? 'text-amber-400' : 'text-zinc-400'} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
      </main>

      {/* Room Manager Dialog */}
      <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suas mesas de aventura</DialogTitle>
            <DialogDescription>Continue uma campanha existente ou comece uma nova.</DialogDescription>
          </DialogHeader>
          {!signedIn ? (
            <a className="gold-button" href="/signin-with-chatgpt?return_to=/" target="_top">
              Entrar para jogar
            </a>
          ) : (
            <>
              {/* Highlighted MMO Shared World Entry */}
              <button
                type="button"
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all shadow-lg group cursor-pointer active:scale-98 border-2 ${
                  room?.id === 'mmo-world-village'
                    ? 'bg-emerald-950/90 border-emerald-400 ring-2 ring-emerald-500/40'
                    : 'bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-emerald-950/70 border-emerald-600/70 hover:border-emerald-400'
                }`}
                onClick={() => void load('mmo-world-village').then(() => setRoomDialog(false))}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0 shadow">
                    🌍
                  </div>
                  <div>
                    <strong className="block text-xs font-serif text-emerald-200 group-hover:text-emerald-100">
                      Mundo MMO: Vila do Rio Verde (Público)
                    </strong>
                    <span className="text-[10px] text-zinc-400">
                      Instância compartilhada • Todos os jogadores jogam e lutam juntos
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {room?.id === 'mmo-world-village' && (
                    <span className="text-[9px] bg-emerald-500 text-black font-black px-1.5 py-0.5 rounded-full uppercase">
                      Atual
                    </span>
                  )}
                  <ChevronRight size={16} className="text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              </button>

              <div className="w-full h-px bg-zinc-800 my-1" />

              {rooms.filter((r) => r.id !== 'mmo-world-village').map((r) => (
                <button
                  className="choice compact"
                  key={r.id}
                  onClick={() => void load(r.id).then(() => setRoomDialog(false))}
                >
                  {r.name}
                  <ChevronRight size={15} />
                </button>
              ))}
              {room && (
                <div className="panel">
                  <p className="eyebrow">CÓDIGO DE CONVITE</p>
                  <code>{room.code}</code>
                  <p className="muted">Compartilhe o código com seus amigos para jogarem juntos.</p>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action({ action: 'create', name: roomName }).then((ok) => {
                    if (ok) setRoomDialog(false);
                  });
                }}
              >
                <label className="field">
                  Nome da nova mesa
                  <input required maxLength={80} value={roomName} onChange={(e) => setRoomName(e.target.value)} />
                </label>
                <button className="gold-button" disabled={busy}>
                  Criar mesa
                </button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action({ action: 'join', code: joinCode }).then((ok) => {
                    if (ok) setRoomDialog(false);
                  });
                }}
              >
                <label className="field">
                  Entrar com código
                  <input required value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                </label>
                <button disabled={busy} className="choice compact">
                  Entrar na mesa
                </button>
              </form>

              <div className="pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setRoomDialog(false);
                    void handleWipeAllData();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-600/70 text-red-200 text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Trash2 size={14} />
                  <span>Wipe: Limpar Saves Antigos e Reiniciar Campanha</span>
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Incoming Party Invite Notification */}
      {(() => {
        const pendingInvite = state?.partyInvites?.find(
          (inv) => inv.toUserId === user || inv.toCharId === active?.id
        );
        if (!pendingInvite) return null;
        return (
          <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-zinc-950 via-emerald-950 to-zinc-950 border-2 border-emerald-500 rounded-2xl p-3 shadow-[0_0_30px_rgba(16,185,129,0.6)] flex items-center gap-3 backdrop-blur-xl animate-fade-in pointer-events-auto">
            <div className="flex items-center gap-2">
              <Shield className="text-emerald-400 animate-pulse shrink-0" size={20} />
              <span className="text-xs sm:text-sm font-serif font-black text-amber-200">
                ⚔️ <strong>{pendingInvite.fromCharName}</strong> convidou você para o grupo!
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await action({ action: 'partyAccept', inviteId: pendingInvite.id });
                }}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs rounded-xl shadow cursor-pointer transition-all active:scale-95"
              >
                Aceitar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await action({ action: 'partyDecline', inviteId: pendingInvite.id });
                }}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl border border-zinc-600 cursor-pointer transition-all"
              >
                Recusar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Interactive Player Action Dialog */}
      {interactingPlayer && (
        <Dialog open={Boolean(interactingPlayer)} onOpenChange={(open) => !open && setInteractingPlayer(null)}>
          <DialogContent className="max-w-md bg-gradient-to-b from-[#141914] via-[#0f120f] to-[#0a0d0a] border border-amber-500/50 text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.9)] p-0 overflow-hidden rounded-2xl">
            <DialogHeader className="p-4 bg-gradient-to-r from-amber-950/60 to-zinc-950 border-b border-zinc-800">
              <DialogTitle className="font-serif font-black text-amber-200 text-lg flex items-center gap-2">
                <Users size={18} className="text-amber-400" />
                <span>{interactingPlayer.name}</span>
                <span className="text-xs font-mono font-normal text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800">
                  Nível {interactingPlayer.level}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {interactingPlayer.species} • {interactingPlayer.className} • {interactingPlayer.background || 'Aventureiro de Valdoria'}
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 space-y-4">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-mono">PONTOS DE VIDA</span>
                  <span className="text-sm font-bold text-emerald-400">{interactingPlayer.hp}/{interactingPlayer.maxHp} PV</span>
                </div>
                <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-mono">CLASSE DE ARMADURA</span>
                  <span className="text-sm font-bold text-amber-300">{interactingPlayer.ac} CA</span>
                </div>
                <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-mono">DESLOCAMENTO</span>
                  <span className="text-sm font-bold text-sky-400">{interactingPlayer.speed || 9}m</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                {(!active?.partyId || !interactingPlayer.partyId || active.partyId !== interactingPlayer.partyId) ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const target = interactingPlayer;
                      setInteractingPlayer(null);
                      const senderCharId = active?.id || myHeroes[0]?.id || selected;
                      await action({ action: 'partyInvite', character: senderCharId, targetCharId: target.id });
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 hover:from-emerald-500 hover:to-green-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
                  >
                    <Users size={16} className="stroke-[2.5]" />
                    <span>Convidar para Grupo (Party)</span>
                  </button>
                ) : (
                  <div className="p-2 rounded-xl bg-sky-950/40 border border-sky-600/40 text-sky-300 text-xs text-center font-mono">
                    🛡️ Este aventureiro já é membro do seu grupo!
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const target = interactingPlayer;
                    setInteractingPlayer(null);
                    setMessage(`/c Olá ${target.name}! `);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageSquare size={15} className="text-amber-400" />
                  <span>Enviar Mensagem no Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = interactingPlayer;
                    setInteractingPlayer(null);
                    setCharacter(structuredClone(target));
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <BookOpen size={15} className="text-purple-400" />
                  <span>Inspecionar Ficha D&D 5e</span>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </SidebarProvider>
  );
}

// Character Sheet Editor
function CharacterEditor({
  value,
  onClose,
  onSave,
  busy
}: {
  value: Character | null;
  onClose: () => void;
  onSave: (c: Character) => Promise<void>;
  busy: boolean;
}) {
  const [c, setC] = useState<Character>(newCharacter());
  useEffect(() => {
    if (value) setC(structuredClone(value));
  }, [value]);

  const update = <K extends keyof Character>(key: K, val: Character[K]) =>
    setC((p) => ({ ...p, [key]: val }));

  const toggle = (key: 'skills' | 'expertise' | 'conditions', v: string) =>
    update(key, c[key].includes(v) ? c[key].filter((x) => x !== v) : [...c[key], v]);

  return (
    <Dialog open={!!value} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="character-dialog max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{value?.id ? 'Ficha de ' + value.name : 'Forje seu aventureiro'}</DialogTitle>
          <DialogDescription>Ficha editável • SRD 5.2.1 • Edição 2024</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="identity">
          <TabsList className="editor-tabs">
            {[
              ['identity', 'Identidade'],
              ['stats', 'Atributos'],
              ['combat', 'Combate'],
              ['magic', 'Magias'],
              ['story', 'História']
            ].map(([id, label]) => (
              <TabsTrigger key={id} value={id}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="identity">
            <div className="form-grid">
              <label className="field">
                Nome
                <input value={c.name} maxLength={60} onChange={(e) => update('name', e.target.value)} />
              </label>
              <Pick label="Classe" value={c.className} options={classes.map((x) => x[0])} onChange={(v) => update('className', v)} />
              <Pick label="Espécie" value={c.species} options={species} onChange={(v) => update('species', v)} />
              <Pick label="Antecedente" value={c.background} options={['Acólito', 'Criminoso', 'Sábio', 'Soldado']} onChange={(v) => update('background', v)} />
              <label className="field">
                Nível
                <input type="number" min={1} max={20} value={c.level} onChange={(e) => update('level', +e.target.value)} />
              </label>
              <label className="field">
                Experiência
                <input type="number" min={0} value={c.xp} onChange={(e) => update('xp', +e.target.value)} />
              </label>
              <label className="field span-two">
                Características e Talentos
                <textarea value={c.features} maxLength={6000} onChange={(e) => update('features', e.target.value)} />
              </label>
            </div>
          </TabsContent>

          <TabsContent value="stats">
            <div className="stats editable">
              {abilities.map((name, i) => (
                <label key={name}>
                  <small>{name}</small>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={c.stats[i]}
                    onChange={(e) => update('stats', c.stats.map((n, j) => (i === j ? +e.target.value : n)))}
                  />
                  <strong>{signed(mod(c.stats[i]))}</strong>
                </label>
              ))}
            </div>
            <p>Bônus de proficiência: <strong>{signed(prof(c.level))}</strong></p>
            <h3>Perícias e especialização</h3>
            <div className="skills-grid">
              {skills.map(([name, i]) => (
                <div className="skill-row" key={name}>
                  <label>
                    <Checkbox checked={c.skills.includes(name)} onCheckedChange={() => toggle('skills', name)} />
                    {name} {signed(mod(c.stats[i]) + (c.skills.includes(name) ? prof(c.level) : 0) + (c.expertise.includes(name) ? prof(c.level) : 0))}
                  </label>
                  <label title="Especialização">
                    <Checkbox checked={c.expertise.includes(name)} onCheckedChange={() => toggle('expertise', name)} />
                    Esp.
                  </label>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="combat">
            <div className="form-grid">
              {([
                ['hp', 'PV atuais'],
                ['maxHp', 'PV máximos'],
                ['ac', 'Classe de armadura'],
                ['speed', 'Deslocamento (m)'],
                ['attack', 'Bônus de ataque'],
                ['exhaustion', 'Exaustão (0–6)']
              ] as const).map(([k, label]) => (
                <label className="field" key={k}>
                  {label}
                  <input type="number" value={c[k]} onChange={(e) => update(k, +e.target.value)} />
                </label>
              ))}
              <label className="field">
                Arma
                <input value={c.weapon} onChange={(e) => update('weapon', e.target.value)} />
              </label>
              <label className="field">
                Dano
                <input value={c.damage} onChange={(e) => update('damage', e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              className="choice compact mt-3"
              onClick={() => {
                const hd = classes.find((x) => x[0] === c.className)![1];
                const hp = hd + mod(c.stats[2]) + (c.level - 1) * Math.max(1, hd / 2 + 1 + mod(c.stats[2]));
                setC({
                  ...c,
                  maxHp: Math.max(1, hp),
                  hp: Math.max(1, hp),
                  attack: prof(c.level) + mod(c.stats[0])
                });
              }}
            >
              Calcular PV e Ataque com base nos Atributos
            </button>
          </TabsContent>

          <TabsContent value="magic">
            <Pick
              label="Atributo de conjuração"
              value={abilities[c.spellAbility]}
              options={abilities}
              onChange={(v) => update('spellAbility', abilities.indexOf(v))}
            />
            <p className="mt-2">
              CD de magia: <strong>{8 + prof(c.level) + mod(c.stats[c.spellAbility])}</strong> • Ataque mágico: <strong>{signed(prof(c.level) + mod(c.stats[c.spellAbility]))}</strong>
            </p>
            <div className="slots mt-3">
              {c.slots.map((n, i) => (
                <label className="field" key={i}>
                  Círculo {i + 1}
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={n}
                    onChange={(e) => update('slots', c.slots.map((v, j) => (i === j ? +e.target.value : v)))}
                  />
                  <input
                    title="Espaços usados"
                    type="number"
                    min={0}
                    max={n}
                    value={c.usedSlots[i]}
                    onChange={(e) => update('usedSlots', c.usedSlots.map((v, j) => (i === j ? +e.target.value : v)))}
                  />
                </label>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="story">
            <label className="field">
              Equipamento e moedas
              <textarea value={c.inventory} maxLength={10000} onChange={(e) => update('inventory', e.target.value)} />
            </label>
            <label className="field">
              História e notas
              <textarea value={c.notes} maxLength={10000} onChange={(e) => update('notes', e.target.value)} />
            </label>
          </TabsContent>
        </Tabs>

        <div className="button-row mt-4">
          <button disabled={busy} className="gold-button" onClick={() => void onSave(c)}>
            {busy ? 'Salvando…' : 'Salvar personagem'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// SRD Compendium Library Component
function Library() {
  const [category, setCategory] = useState('Regras');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<{ page: number; name: string; excerpt?: string }[]>([]);
  const [page, setPage] = useState<{ page: number; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch('/api/library?category=' + encodeURIComponent(category) + '&q=' + encodeURIComponent(q), {
        signal: controller.signal
      })
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json() as Promise<{ results: { page: number; name: string; excerpt?: string }[] }>;
        })
        .then((d) => setItems(d.results))
        .catch((e) => {
          if (e.name !== 'AbortError') setError('Não foi possível carregar o compêndio.');
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [category, q]);

  async function open(n: number) {
    try {
      const r = await fetch('/api/library?page=' + n);
      if (!r.ok) throw Error();
      setPage(await r.json());
    } catch {
      setError('Não foi possível abrir a página.');
    }
  }

  return (
    <>
      {/* Onboarding Banner for Compendium */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#10141b] to-[#121612] border border-sky-500/40 shadow-xl gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/40 flex items-center justify-center text-sky-300 shrink-0 shadow">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-base font-serif font-black text-sky-200">
              Compêndio & Biblioteca Oficial SRD 5.2.1
            </h2>
            <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
              Consulte todas as regras, magias, monstros e equipamentos oficiais das regras 2024 de D&D 5e. Utilize a busca rápida ou filtre por categoria.
            </p>
          </div>
        </div>
        <a className="gold-button text-xs py-2 px-3 shrink-0 flex items-center gap-1 cursor-pointer" href="/SRD-5.2.1.pdf" target="_blank" rel="noreferrer">
          <span>PDF Oficial Completo</span> <ArrowUpRight size={14} />
        </a>
      </div>

      <div className="library-toolbar">
        <Pick
          value={category}
          options={['Regras', 'Classes', 'Origens', 'Equipamento', 'Magias', 'Glossário', 'Itens mágicos', 'Bestiário']}
          onChange={setCategory}
        />
        <label className="search-input">
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar no texto original em inglês…"
            aria-label="Buscar regras"
          />
        </label>
        <a className="text-button" href="/SRD-5.2.1.pdf" target="_blank" rel="noreferrer">
          SRD completo <ArrowUpRight size={16} />
        </a>
      </div>
      <p className="muted">
        {loading ? 'Buscando…' : items.length + ' resultados'} • Texto oficial em inglês. A GM explica em português.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="library-grid">
        {items.map((p, i) => (
          <button className="panel library-card" key={i} onClick={() => void open(p.page)}>
            {category === 'Bestiário' ? <Skull size={23} /> : <BookOpen size={23} />}
            <small>SRD 5.2.1 • PÁGINA {p.page}</small>
            <h3>{p.name}</h3>
            {p.excerpt && <p>{p.excerpt}…</p>}
            <span className="read-link">
              Consultar <ChevronRight size={15} />
            </span>
          </button>
        ))}
      </div>
      {!loading && !items.length && (
        <div className="panel">Nenhum resultado. Tente um termo em inglês, como “concentration” ou “dragon”.</div>
      )}
      <Dialog open={!!page} onOpenChange={(v) => { if (!v) setPage(null); }}>
        <DialogContent className="rule-dialog">
          <DialogHeader>
            <DialogTitle>SRD 5.2.1 • Página {page?.page}</DialogTitle>
            <DialogDescription>Texto extraído da referência oficial.</DialogDescription>
          </DialogHeader>
          <pre className="rule-text">{page?.text}</pre>
          <a className="gold-button" href={'/SRD-5.2.1.pdf#page=' + page?.page} target="_blank" rel="noreferrer">
            Abrir página original <ArrowUpRight size={15} />
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
