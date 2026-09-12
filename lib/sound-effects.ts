// lib/sound-effects.ts
/**
 * Zero-dependency Web Audio API sound synthesizer for CRPG audio juice.
 * Generates punchy, immediate procedural sound effects without relying
 * on external mp3 files that may fail or introduce latency.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export type SfxType =
  | 'attack'
  | 'hit'
  | 'crit'
  | 'miss'
  | 'spell'
  | 'loot'
  | 'coins'
  | 'levelup'
  | 'step'
  | 'door'
  | 'heal'
  | 'click'
  | 'error';

export function playSfx(type: SfxType, volume = 0.35): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    switch (type) {
      case 'attack': {
        // Metallic blade slash / whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }

      case 'hit': {
        // Meaty strike / blunt impact
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }

      case 'crit': {
        // Massive crunch + ringing resonant chime
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(280, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
        subGain.gain.setValueAtTime(0.9, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        subOsc.connect(subGain);
        subGain.connect(masterGain);
        subOsc.start(now);
        subOsc.stop(now + 0.3);

        // High shimmer
        const highOsc = ctx.createOscillator();
        const highGain = ctx.createGain();
        highOsc.type = 'sine';
        highOsc.frequency.setValueAtTime(880, now + 0.05);
        highOsc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
        highGain.gain.setValueAtTime(0.4, now + 0.05);
        highGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        highOsc.connect(highGain);
        highGain.connect(masterGain);
        highOsc.start(now + 0.05);
        highOsc.stop(now + 0.4);
        break;
      }

      case 'miss': {
        // Quick atmospheric whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }

      case 'spell': {
        // Arcane shimmering harmonic
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + i * 0.05 + 0.25);
          gain.gain.setValueAtTime(0.25, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.28);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.28);
        });
        break;
      }

      case 'loot':
      case 'coins': {
        // Bright metallic coin / gemstone jingle
        [987.77, 1318.51, 1567.98].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.3, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.2);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.2);
        });
        break;
      }

      case 'heal': {
        // Luminous soothing chord
        [440, 554.37, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.3, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
        break;
      }

      case 'levelup': {
        // Grand heroic fanfare
        const notes = [261.63, 329.63, 392.0, 523.25];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.09);
          gain.gain.setValueAtTime(0.4, now + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.09 + (i === 3 ? 0.6 : 0.22));
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.09);
          osc.stop(now + i * 0.09 + (i === 3 ? 0.6 : 0.22));
        });
        break;
      }

      case 'door': {
        // Heavy dungeon stone archway rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.4);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }

      case 'step': {
        // Soft footsteps on terrain
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }

      case 'error': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case 'click':
      default: {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }
    }
  } catch {
    // Gracefully ignore audio synthesis errors
  }
}
