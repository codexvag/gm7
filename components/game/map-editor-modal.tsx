// components/game/map-editor-modal.tsx
'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  MapPin,
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  Shield,
  Footprints,
  Compass,
  Download,
  Upload,
  RefreshCw,
  Maximize2,
  X,
  Sliders
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  buildMapPrompt,
  BIOME_DESCRIPTIONS,
  THEME_DESCRIPTIONS,
  type DungeonBiomeOption,
  type DungeonThemeStyle,
  type DungeonMapSize,
  type MapPromptOptions
} from '@/lib/ai-map-prompts';
import {
  type CollisionPolygon,
  type MapZoneType,
  findPathWithCustomPolygons,
  isPointWalkableWithPolygons,
  VILLAGE_CUSTOM_ZONES
} from '@/lib/collision-system';
import { playSfx } from '@/lib/sound-effects';

interface MapEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBiome?: string;
}

export function MapEditorModal({ open, onOpenChange, currentBiome = 'dungeon' }: MapEditorModalProps) {
  // ═══ ABA 1: PROMPT BUILDER IA ═══
  const [promptBiome, setPromptBiome] = useState<DungeonBiomeOption>('catacombs');
  const [promptTheme, setPromptTheme] = useState<DungeonThemeStyle>('grimdark_stone');
  const [promptSize, setPromptSize] = useState<DungeonMapSize>(12);
  const [customDesc, setCustomDesc] = useState('');
  const [hasPillars, setHasPillars] = useState(true);
  const [hasWater, setHasWater] = useState(false);
  const [hasSecret, setHasSecret] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);

  const generatedPrompt = useMemo(() => {
    return buildMapPrompt({
      biome: promptBiome,
      theme: promptTheme,
      size: promptSize,
      customDescription: customDesc,
      hasPillars,
      hasWaterFeatures: hasWater,
      hasSecretAlcove: hasSecret,
      lighting: 'torchlit'
    });
  }, [promptBiome, promptTheme, promptSize, customDesc, hasPillars, hasWater, hasSecret]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt.prompt);
    setCopiedPrompt(true);
    playSfx('click');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyNegative = () => {
    navigator.clipboard.writeText(generatedPrompt.negativePrompt);
    setCopiedNegative(true);
    playSfx('click');
    setTimeout(() => setCopiedNegative(false), 2000);
  };

  // ═══ ABA 2: EDITOR VISUAL DE POLÍGONOS ═══
  const [mapImageUrl, setMapImageUrl] = useState('/maps/dungeon.png');
  const [zones, setZones] = useState<CollisionPolygon[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`lume_map_zones_${currentBiome}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return VILLAGE_CUSTOM_ZONES;
  });

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [activeDrawType, setActiveDrawType] = useState<MapZoneType>('bloqueado');
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState<[number, number][]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testStart, setTestStart] = useState<{ x: number; y: number } | null>({ x: 1, y: 1 });
  const [testGoal, setTestGoal] = useState<{ x: number; y: number } | null>({ x: 10, y: 10 });
  const [editorGridSize, setEditorGridSize] = useState<number>(12);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Calcula caminho A* do teste ao vivo
  const liveTestPath = useMemo(() => {
    if (!isTestMode || !testStart || !testGoal) return [];
    try {
      return findPathWithCustomPolygons(testStart, testGoal, zones, editorGridSize);
    } catch {
      return [];
    }
  }, [isTestMode, testStart, testGoal, zones, editorGridSize]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, Number(((e.clientX - rect.left) / rect.width).toFixed(4))));
    const ny = Math.max(0, Math.min(1, Number(((e.clientY - rect.top) / rect.height).toFixed(4))));

    if (isTestMode) {
      const gx = Math.floor(nx * editorGridSize);
      const gy = Math.floor(ny * editorGridSize);
      if (!testStart) {
        setTestStart({ x: gx, y: gy });
      } else {
        setTestGoal({ x: gx, y: gy });
      }
      playSfx('step');
      return;
    }

    // Modo Desenho de Polígono
    setCurrentPolygonPoints((prev) => [...prev, [nx, ny]]);
    playSfx('click');
  };

  const handleFinishPolygon = () => {
    if (currentPolygonPoints.length < 3) return;
    const newZone: CollisionPolygon = {
      id: `zone-${Date.now()}`,
      name: `${activeDrawType === 'bloqueado' ? 'Parede' : activeDrawType === 'porta' ? 'Porta' : 'Zona'} ${zones.length + 1}`,
      type: activeDrawType,
      points: currentPolygonPoints
    };
    const updated = [...zones, newZone];
    setZones(updated);
    setCurrentPolygonPoints([]);
    playSfx('loot');
  };

  const handleDeleteZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    if (selectedZoneId === id) setSelectedZoneId(null);
    playSfx('click');
  };

  const handleSaveZones = () => {
    try {
      localStorage.setItem(`lume_map_zones_${currentBiome}`, JSON.stringify(zones));
      window.dispatchEvent(
        new CustomEvent('lume-map-updated', {
          detail: { zones, gridSize: editorGridSize }
        })
      );
      playSfx('levelup');
      alert(`Polígonos de colisão salvos com sucesso para ${currentBiome}!`);
    } catch {
      alert('Erro ao salvar no localStorage.');
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(zones, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `collision_zones_${currentBiome}.json`);
    dlAnchorElem.click();
  };

  const zoneColors: Record<MapZoneType, { stroke: string; fill: string; label: string }> = {
    bloqueado: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.4)', label: 'Parede / Bloqueado' },
    obstacle: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.4)', label: 'Obstáculo' },
    caminhavel: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.3)', label: 'Caminhável' },
    walkable: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.3)', label: 'Caminhável' },
    porta: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.45)', label: 'Porta / Passagem' },
    ponte: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.45)', label: 'Ponte / Passarela' },
    agua: { stroke: '#0ea5e9', fill: 'rgba(14, 165, 233, 0.4)', label: 'Água Profunda' },
    water: { stroke: '#0ea5e9', fill: 'rgba(14, 165, 233, 0.4)', label: 'Água Profunda' },
    difficult: { stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.35)', label: 'Terreno Difícil' }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-zinc-950/95 border-amber-500/40 text-zinc-100 shadow-[0_0_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-zinc-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Compass size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-serif font-bold text-amber-300 tracking-wide">
                  Gerador de Mapas IA & Editor de Colisão
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Gere prompts para mapas top-down e desenhe polígonos de colisão sobre a imagem.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="editor" className="w-full mt-2">
          <TabsList className="grid grid-cols-2 bg-zinc-900/80 border border-zinc-800 text-zinc-400 p-1">
            <TabsTrigger
              value="editor"
              className="flex items-center gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 text-xs font-semibold"
            >
              <Shield size={14} />
              <span>Editor de Polígonos & Teste A*</span>
            </TabsTrigger>
            <TabsTrigger
              value="prompts"
              className="flex items-center gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 text-xs font-semibold"
            >
              <Sparkles size={14} />
              <span>Gerador de Prompts IA Top-Down</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══ ABA 1: EDITOR VISUAL DE POLÍGONOS ═══ */}
          <TabsContent value="editor" className="space-y-4 pt-3">
            {/* Toolbar do Editor */}
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-zinc-400 font-semibold">Tipo de Zona:</span>
                {(['bloqueado', 'caminhavel', 'porta', 'ponte', 'agua'] as MapZoneType[]).map((t) => {
                  const active = activeDrawType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setActiveDrawType(t);
                        setIsTestMode(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-sm'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {t === 'bloqueado' ? 'Parede / Bloqueado' : t === 'porta' ? 'Porta' : t === 'caminhavel' ? 'Caminhável' : t === 'ponte' ? 'Ponte' : 'Água'}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTestMode(!isTestMode)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold border transition-all ${
                    isTestMode
                      ? 'border-emerald-500 bg-emerald-950 text-emerald-300 ring-1 ring-emerald-500'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white'
                  }`}
                >
                  <Footprints size={14} />
                  <span>{isTestMode ? 'Modo Teste A* Ativo' : 'Testar Rota A*'}</span>
                </button>

                {currentPolygonPoints.length >= 3 && (
                  <button
                    onClick={handleFinishPolygon}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                  >
                    Fechar Polígono ({currentPolygonPoints.length} pts)
                  </button>
                )}

                {currentPolygonPoints.length > 0 && (
                  <button
                    onClick={() => setCurrentPolygonPoints([])}
                    className="px-2 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>

            {/* Imagem do Mapa com Canvas SVG Interativo */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <div
                  ref={mapContainerRef}
                  onClick={handleMapClick}
                  className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-zinc-700 shadow-2xl cursor-crosshair select-none bg-black"
                >
                  {/* Imagem Base */}
                  <img
                    src={mapImageUrl}
                    alt="Mapa para Colisão"
                    className="w-full h-full object-fill pointer-events-none"
                  />

                  {/* SVG de Polígonos */}
                  <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
                    {/* Polígonos Salvos */}
                    {zones.map((zone) => {
                      const cfg = zoneColors[zone.type] || zoneColors.bloqueado;
                      const pointsStr = zone.points.map(([px, py]) => `${px * 100},${py * 100}`).join(' ');
                      const isSelected = selectedZoneId === zone.id;
                      return (
                        <g key={zone.id}>
                          <polygon
                            points={pointsStr}
                            fill={cfg.fill}
                            stroke={isSelected ? '#ffffff' : cfg.stroke}
                            strokeWidth={isSelected ? '1.2' : '0.6'}
                          />
                        </g>
                      );
                    })}

                    {/* Polígono em Construção */}
                    {currentPolygonPoints.length > 0 && (
                      <polyline
                        points={currentPolygonPoints.map(([px, py]) => `${px * 100},${py * 100}`).join(' ')}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="1"
                        strokeDasharray="2 1"
                      />
                    )}

                    {/* Vértices do polígono ativo */}
                    {currentPolygonPoints.map(([px, py], idx) => (
                      <circle
                        key={idx}
                        cx={px * 100}
                        cy={py * 100}
                        r="1.2"
                        fill="#fbbf24"
                        stroke="#000"
                        strokeWidth="0.3"
                      />
                    ))}

                    {/* Rota A* de Teste */}
                    {liveTestPath.length > 1 && (
                      <polyline
                        points={liveTestPath.map((p) => `${((p.x + 0.5) / editorGridSize) * 100},${((p.y + 0.5) / editorGridSize) * 100}`).join(' ')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="2 1"
                      />
                    )}
                  </svg>
                </div>

                <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
                  <span>Clique sobre o mapa para adicionar vértices do polígono. Com 3+ pontos, clique em "Fechar Polígono".</span>
                  <span>Grid: {editorGridSize}x{editorGridSize}</span>
                </div>
              </div>

              {/* Lista Lateral de Polígonos */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2 max-h-[420px] overflow-y-auto">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-300 pb-1 border-b border-zinc-800">
                  <span>Zonas ({zones.length})</span>
                  <button
                    onClick={() => setZones([])}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    Limpar Tudo
                  </button>
                </div>

                {zones.map((zone) => {
                  const cfg = zoneColors[zone.type] || zoneColors.bloqueado;
                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        selectedZoneId === zone.id
                          ? 'bg-zinc-800 border-amber-400 text-white'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <div className="font-semibold truncate">{zone.name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cfg.stroke }}
                          />
                          <span>{cfg.label}</span>
                          <span>• {zone.points.length} pts</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteZone(zone.id);
                        }}
                        className="p-1 rounded hover:bg-red-950 text-zinc-400 hover:text-red-400"
                        title="Excluir Zona"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ações de Salvamento e Exportação */}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
                >
                  <Download size={13} />
                  <span>Exportar JSON</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveZones}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-bold text-xs tracking-wide shadow-lg"
                >
                  Salvar Colisões no Jogo
                </button>
              </div>
            </div>
          </TabsContent>

          {/* ═══ ABA 2: GERADOR DE PROMPTS IA ═══ */}
          <TabsContent value="prompts" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Bioma */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Bioma da Masmorra</label>
                <select
                  value={promptBiome}
                  onChange={(e) => setPromptBiome(e.target.value as DungeonBiomeOption)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                >
                  {Object.entries(BIOME_DESCRIPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Tema / Estilo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Estilo Arquitetônico</label>
                <select
                  value={promptTheme}
                  onChange={(e) => setPromptTheme(e.target.value as DungeonThemeStyle)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                >
                  {Object.entries(THEME_DESCRIPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Tamanho */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Dimensão do Grid</label>
                <select
                  value={promptSize}
                  onChange={(e) => setPromptSize(Number(e.target.value) as DungeonMapSize)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                >
                  <option value={8}>8x8 (Tático Rápido / Arena)</option>
                  <option value={12}>12x12 (Padrão 3-4 Salas)</option>
                  <option value={16}>16x16 (Masmorra Completa)</option>
                  <option value={24}>24x24 (Labirinto Profundo)</option>
                </select>
              </div>
            </div>

            {/* Checkboxes de Características */}
            <div className="flex items-center gap-4 text-xs text-zinc-300 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPillars}
                  onChange={(e) => setHasPillars(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500"
                />
                <span>Pilares de Sustentação</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWater}
                  onChange={(e) => setHasWater(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500"
                />
                <span>Poças d'Água / Canais</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSecret}
                  onChange={(e) => setHasSecret(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500"
                />
                <span>Alcova / Câmara Secreta</span>
              </label>
            </div>

            {/* Descrição Opcional */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Detalhes Narrativos Extras (Opcional)</label>
              <input
                type="text"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Ex: altar de sacrifício central com pedras de obsidiana e ossadas"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            {/* Prompt Gerado */}
            <div className="space-y-2 p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                <span>Prompt Pronto para Geração de Imagem (Top-Down):</span>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 transition-colors"
                >
                  {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedPrompt ? 'Copiado!' : 'Copiar Prompt'}</span>
                </button>
              </div>
              <p className="font-mono text-[11px] text-zinc-300 leading-relaxed bg-black/40 p-2.5 rounded-lg border border-zinc-800/80 select-all">
                {generatedPrompt.prompt}
              </p>
            </div>

            {/* Negative Prompt */}
            <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
                <span>Negative Prompt (Evita personagens, UI e perspectiva 3D):</span>
                <button
                  onClick={handleCopyNegative}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px]"
                >
                  {copiedNegative ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedNegative ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="font-mono text-[10px] text-zinc-400 bg-black/30 p-2 rounded border border-zinc-800/50 select-all">
                {generatedPrompt.negativePrompt}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
