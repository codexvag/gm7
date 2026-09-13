// components/game/game-settings-modal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Music,
  Sparkles,
  Sliders,
  Eye,
  Swords,
  RotateCcw,
  Check,
  X,
  Play
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  audioManager,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  type MusicTrack
} from '@/lib/audio-manager';
import { playSfx } from '@/lib/sound-effects';

interface GameSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GameSettingsModal({ open, onOpenChange }: GameSettingsModalProps) {
  const [settings, setSettings] = useState<GameSettings>(() => audioManager.getSettings());
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>(() => audioManager.getCurrentTrack());

  useEffect(() => {
    const unsub = audioManager.subscribe((newSettings) => {
      setSettings(newSettings);
      setCurrentTrack(audioManager.getCurrentTrack());
    });
    return unsub;
  }, []);

  const update = (partial: Partial<GameSettings>) => {
    const updated = audioManager.updateSettings(partial);
    setSettings(updated);
  };

  const handleTestSfx = (type: 'attack' | 'crit' | 'loot' | 'spell') => {
    playSfx(type);
  };

  const handleTestMusicTrack = (track: MusicTrack) => {
    audioManager.playMusic(track);
    setCurrentTrack(track);
  };

  const handleResetDefaults = () => {
    const reset = audioManager.updateSettings(DEFAULT_GAME_SETTINGS);
    setSettings(reset);
    playSfx('click');
  };

  const trackLabels: Record<MusicTrack, string> = {
    cidades: 'Cidades & Vilas (cidades.mp3)',
    batalha_media: 'Combate Padrão (batalha_media.mp3)',
    batalha_alta: 'Combate Chefe/Intenso (batalha_alta.mp3)',
    silencio: 'Silêncio'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950/95 border-amber-500/40 text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        <DialogHeader className="border-b border-zinc-800 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Sliders size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-serif font-bold text-amber-300 tracking-wide">
                  Configurações do Jogo
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Ajuste o áudio, músicas em loop, efeitos e preferências do jogo.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="audio" className="w-full mt-2">
          <TabsList className="grid grid-cols-3 bg-zinc-900/80 border border-zinc-800 text-zinc-400 p-1">
            <TabsTrigger
              value="audio"
              className="flex items-center gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 text-xs font-semibold"
            >
              <Volume2 size={14} />
              <span>Áudio & Música</span>
            </TabsTrigger>
            <TabsTrigger
              value="interface"
              className="flex items-center gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 text-xs font-semibold"
            >
              <Eye size={14} />
              <span>Interface & Mapa</span>
            </TabsTrigger>
            <TabsTrigger
              value="combat"
              className="flex items-center gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 text-xs font-semibold"
            >
              <Swords size={14} />
              <span>Combate & Turnos</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ÁUDIO & MÚSICA */}
          <TabsContent value="audio" className="space-y-4 pt-3">
            {/* Master Volume */}
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-zinc-200 font-medium">
                  {settings.masterMuted ? (
                    <VolumeX size={17} className="text-red-400" />
                  ) : (
                    <Volume2 size={17} className="text-amber-400" />
                  )}
                  <span>Volume Geral (Master)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-amber-300 font-bold w-10 text-right">
                    {settings.masterMuted ? 'MUDO' : `${settings.masterVolume}%`}
                  </span>
                  <button
                    onClick={() => update({ masterMuted: !settings.masterMuted })}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                      settings.masterMuted
                        ? 'bg-red-950/80 border-red-700 text-red-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {settings.masterMuted ? 'Desmutar' : 'Mutar'}
                  </button>
                </div>
              </div>
              <Slider
                value={[settings.masterVolume]}
                min={0}
                max={100}
                step={1}
                disabled={settings.masterMuted}
                onValueChange={([val]) => update({ masterVolume: val })}
                className="py-1 cursor-pointer"
              />
            </div>

            {/* Background Music Volume */}
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-zinc-200 font-medium">
                  <Music size={17} className={settings.musicMuted ? 'text-zinc-500' : 'text-purple-400'} />
                  <span>Música de Fundo (MP3 Loop)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-purple-300 font-bold w-10 text-right">
                    {settings.musicMuted ? 'MUDO' : `${settings.musicVolume}%`}
                  </span>
                  <button
                    onClick={() => update({ musicMuted: !settings.musicMuted })}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                      settings.musicMuted
                        ? 'bg-red-950/80 border-red-700 text-red-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {settings.musicMuted ? 'Desmutar' : 'Mutar'}
                  </button>
                </div>
              </div>
              <Slider
                value={[settings.musicVolume]}
                min={0}
                max={100}
                step={1}
                disabled={settings.musicMuted}
                onValueChange={([val]) => update({ musicVolume: val })}
                className="py-1 cursor-pointer"
              />

              {/* Current Track status & quick test buttons */}
              <div className="pt-1.5 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Ativa:</span>
                  <span className="font-mono text-amber-200 font-semibold truncate max-w-[200px]">
                    {trackLabels[currentTrack]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleTestMusicTrack('cidades')}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-300 font-medium"
                    title="Tocar música de cidades e exploração"
                  >
                    Cidades
                  </button>
                  <button
                    onClick={() => handleTestMusicTrack('batalha_media')}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-300 font-medium"
                    title="Tocar música de combate médio"
                  >
                    Batalha Média
                  </button>
                  <button
                    onClick={() => handleTestMusicTrack('batalha_alta')}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-300 font-medium"
                    title="Tocar música de combate intenso/chefe"
                  >
                    Chefe
                  </button>
                </div>
              </div>
            </div>

            {/* Sound Effects (SFX) */}
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-zinc-200 font-medium">
                  <Sparkles size={17} className={settings.sfxMuted ? 'text-zinc-500' : 'text-emerald-400'} />
                  <span>Efeitos Sonoros (SFX)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-emerald-300 font-bold w-10 text-right">
                    {settings.sfxMuted ? 'MUDO' : `${settings.sfxVolume}%`}
                  </span>
                  <button
                    onClick={() => update({ sfxMuted: !settings.sfxMuted })}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                      settings.sfxMuted
                        ? 'bg-red-950/80 border-red-700 text-red-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {settings.sfxMuted ? 'Desmutar' : 'Mutar'}
                  </button>
                </div>
              </div>
              <Slider
                value={[settings.sfxVolume]}
                min={0}
                max={100}
                step={1}
                disabled={settings.sfxMuted}
                onValueChange={([val]) => update({ sfxVolume: val })}
                className="py-1 cursor-pointer"
              />

              {/* SFX Quick Test Buttons */}
              <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Testar Efeito:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleTestSfx('attack')}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-200"
                  >
                    Ataque
                  </button>
                  <button
                    onClick={() => handleTestSfx('crit')}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-200"
                  >
                    Crítico
                  </button>
                  <button
                    onClick={() => handleTestSfx('spell')}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-200"
                  >
                    Magia
                  </button>
                  <button
                    onClick={() => handleTestSfx('loot')}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] text-zinc-200"
                  >
                    Espólios
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: INTERFACE & MAPA */}
          <TabsContent value="interface" className="space-y-3 pt-3">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-zinc-200">Exibir Grade Tática na Exploração</div>
                <div className="text-xs text-zinc-400">
                  Mostra as linhas da grade tática de 1.5m mesmo fora de combate.
                </div>
              </div>
              <Switch
                checked={settings.showGridExploration}
                onCheckedChange={(checked) => update({ showGridExploration: checked })}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-zinc-200">Números Flutuantes de Dano e Cura</div>
                <div className="text-xs text-zinc-400">
                  Exibe indicadores flutuantes animados sobre os tokens ao receber dano ou cura.
                </div>
              </div>
              <Switch
                checked={settings.showFloatingDamage}
                onCheckedChange={(checked) => update({ showFloatingDamage: checked })}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-zinc-200">Animações Aceleradas de Projéteis</div>
                <div className="text-xs text-zinc-400">
                  Reduz pela metade o tempo dos projéteis voadores e arcos de corte para partidas mais rápidas.
                </div>
              </div>
              <Switch
                checked={settings.fastVfx}
                onCheckedChange={(checked) => update({ fastVfx: checked })}
              />
            </div>
          </TabsContent>

          {/* TAB 3: COMBATE & TURNOS */}
          <TabsContent value="combat" className="space-y-3 pt-3">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-zinc-200">Passar Turno Automaticamente</div>
                <div className="text-xs text-zinc-400">
                  Encerra o turno do personagem automaticamente quando não houver mais ações ou movimento disponíveis.
                </div>
              </div>
              <Switch
                checked={settings.autoEndTurn}
                onCheckedChange={(checked) => update({ autoEndTurn: checked })}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-zinc-200">Confirmar Fim de Turno</div>
                <div className="text-xs text-zinc-400">
                  Solicita confirmação caso o jogador clique em encerrar turno ainda possuindo ações válidas.
                </div>
              </div>
              <Switch
                checked={settings.confirmEndTurn}
                onCheckedChange={(checked) => update({ confirmEndTurn: checked })}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors py-1 px-2 rounded hover:bg-zinc-900 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Restaurar Padrões</span>
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-bold text-xs tracking-wide shadow-md transition-all cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
