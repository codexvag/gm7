// lib/audio-manager.ts
/**
 * Gerenciador de Áudio e Música de Fundo para CRPG D&D 5e
 * Suporta reprodução em loop contínuo, crossfade suave de volume entre faixas,
 * desbloqueio transparente de autoplay de navegadores e persistência de preferências em localStorage.
 */

export type MusicTrack = 'cidades' | 'batalha_media' | 'batalha_alta' | 'silencio';

export interface GameSettings {
  masterVolume: number; // 0..100
  musicVolume: number;  // 0..100
  sfxVolume: number;    // 0..100
  masterMuted: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
  showGridExploration: boolean;
  showFloatingDamage: boolean;
  autoEndTurn: boolean;
  fastVfx: boolean;
  confirmEndTurn: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 65,
  sfxVolume: 85,
  masterMuted: false,
  musicMuted: false,
  sfxMuted: false,
  showGridExploration: true,
  showFloatingDamage: true,
  autoEndTurn: false,
  fastVfx: false,
  confirmEndTurn: false
};

const STORAGE_KEY = 'crpg_game_settings';

export const TRACK_PATHS: Record<Exclude<MusicTrack, 'silencio'>, string> = {
  cidades: '/music/cidades.mp3',
  batalha_media: '/music/batalha_media.mp3',
  batalha_alta: '/music/batalha_alta.mp3'
};

class AudioManager {
  private currentTrack: MusicTrack = 'silencio';
  private channelA: HTMLAudioElement | null = null;
  private channelB: HTMLAudioElement | null = null;
  private activeChannelIndex: 0 | 1 = 0; // 0 = A, 1 = B
  private crossfadeTimer: any = null;
  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  private listeners: Set<(settings: GameSettings) => void> = new Set();
  private isUnlocked: boolean = false;
  private pendingTrack: MusicTrack | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadSettings();
      this.initChannels();
      this.setupAutoplayUnlock();
    }
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<GameSettings>): GameSettings {
    this.settings = { ...this.settings, ...partial };
    this.persistSettings();
    this.applyVolumeToActiveChannel();
    this.notifyListeners();
    return { ...this.settings };
  }

  public subscribe(fn: (settings: GameSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notifyListeners() {
    for (const fn of this.listeners) {
      try { fn(this.settings); } catch {}
    }
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = { ...DEFAULT_GAME_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = { ...DEFAULT_GAME_SETTINGS };
    }
  }

  private persistSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {}
  }

  public getEffectiveMusicVolume(): number {
    if (this.settings.masterMuted || this.settings.musicMuted) return 0;
    const master = Math.max(0, Math.min(100, this.settings.masterVolume)) / 100;
    const music = Math.max(0, Math.min(100, this.settings.musicVolume)) / 100;
    return master * music;
  }

  public getEffectiveSfxVolume(): number {
    if (this.settings.masterMuted || this.settings.sfxMuted) return 0;
    const master = Math.max(0, Math.min(100, this.settings.masterVolume)) / 100;
    const sfx = Math.max(0, Math.min(100, this.settings.sfxVolume)) / 100;
    return master * sfx;
  }

  private initChannels() {
    if (typeof Audio === 'undefined') return;
    this.channelA = new Audio();
    this.channelB = new Audio();
    [this.channelA, this.channelB].forEach((audio) => {
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
    });
  }

  private setupAutoplayUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.isUnlocked = true;
      if (this.pendingTrack) {
        const track = this.pendingTrack;
        this.pendingTrack = null;
        this.playMusic(track);
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
  }

  public getCurrentTrack(): MusicTrack {
    return this.currentTrack;
  }

  public playMusic(track: MusicTrack) {
    if (typeof window === 'undefined') return;
    if (this.currentTrack === track) return;

    this.pendingTrack = track;
    this.currentTrack = track;

    if (!this.channelA || !this.channelB) {
      this.initChannels();
    }

    const currentChannel = this.activeChannelIndex === 0 ? this.channelA : this.channelB;
    const nextChannel = this.activeChannelIndex === 0 ? this.channelB : this.channelA;

    if (!currentChannel || !nextChannel) return;

    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }

    if (track === 'silencio') {
      this.fadeOutAndStop(currentChannel);
      return;
    }

    const targetSrc = TRACK_PATHS[track];
    nextChannel.src = targetSrc;
    nextChannel.currentTime = 0;
    nextChannel.loop = true;
    nextChannel.volume = 0;

    const playPromise = nextChannel.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isUnlocked = true;
          this.crossfade(currentChannel, nextChannel);
          this.activeChannelIndex = this.activeChannelIndex === 0 ? 1 : 0;
        })
        .catch(() => {
          // Autoplay was blocked; will resume on first user interaction
        });
    }
  }

  private crossfade(outgoing: HTMLAudioElement, incoming: HTMLAudioElement) {
    const durationMs = 1200;
    const steps = 24;
    const intervalMs = durationMs / steps;
    const targetVolume = this.getEffectiveMusicVolume();
    let step = 0;

    const startOutVol = outgoing.volume;

    this.crossfadeTimer = setInterval(() => {
      step++;
      const progress = step / steps;
      outgoing.volume = Math.max(0, startOutVol * (1 - progress));
      incoming.volume = Math.min(1, targetVolume * progress);

      if (step >= steps) {
        clearInterval(this.crossfadeTimer);
        this.crossfadeTimer = null;
        outgoing.pause();
        outgoing.currentTime = 0;
        incoming.volume = this.getEffectiveMusicVolume();
      }
    }, intervalMs);
  }

  private fadeOutAndStop(channel: HTMLAudioElement) {
    const durationMs = 800;
    const steps = 16;
    const intervalMs = durationMs / steps;
    const startVol = channel.volume;
    let step = 0;

    this.crossfadeTimer = setInterval(() => {
      step++;
      channel.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearInterval(this.crossfadeTimer);
        this.crossfadeTimer = null;
        channel.pause();
        channel.currentTime = 0;
      }
    }, intervalMs);
  }

  private applyVolumeToActiveChannel() {
    const active = this.activeChannelIndex === 0 ? this.channelA : this.channelB;
    if (active && !this.crossfadeTimer) {
      active.volume = this.getEffectiveMusicVolume();
    }
  }
}

// Singleton global
export const audioManager = new AudioManager();

/**
 * Avalia o estado do jogo e retorna a faixa recomendada:
 * - 'batalha_alta': Chefes, dragões, elites com alta ameaça
 * - 'batalha_media': Combate tático normal
 * - 'cidades': Exploração, paz, vilas e masmorras exploratórias sem combate
 */
export function computeRecommendedTrack(state: {
  combat?: boolean;
  enemies?: Array<{ hp: number; name?: string; cr?: number; aiStyle?: string }>;
  isDragonCombatActive?: boolean;
  activeAct?: number;
}): MusicTrack {
  if (!state.combat) {
    return 'cidades';
  }

  const enemies = state.enemies || [];
  const aliveEnemies = enemies.filter((e) => e && e.hp > 0);

  const isBossFight =
    Boolean(state.isDragonCombatActive) ||
    aliveEnemies.some((e) => {
      const style = e.aiStyle?.toLowerCase() || '';
      const name = e.name?.toLowerCase() || '';
      return (
        style === 'boss' ||
        style === 'dragon' ||
        name.includes('lorde') ||
        name.includes('chefe') ||
        name.includes('dragão') ||
        name.includes('malakor') ||
        name.includes('sentinela de cinzas') ||
        name.includes('guardião espectral') ||
        (e.cr !== undefined && e.cr >= 4)
      );
    });

  return isBossFight ? 'batalha_alta' : 'batalha_media';
}
