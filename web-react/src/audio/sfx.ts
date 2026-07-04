/* global OscillatorNode, GainNode, BiquadFilterNode */
import { readStorage } from "../storage.ts";

type AudioWindow = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export function normalizeVolumeValue(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function parseStoredVolumeValue(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return normalizeVolumeValue(Number(trimmed));
}

class SoundFX {
  private ctx: AudioContext | null = null;
  private volume = 0.5;
  private muted = false;
  private ambientOscs: OscillatorNode[] = [];
  private ambientGain: GainNode | null = null;
  // Sound effects share a single master gain so the slider scales everything.
  private masterGain: GainNode | null = null;

  private init() {
    if (this.ctx) return;
    if (typeof window === "undefined") return;
    const browserWindow = window as AudioWindow;
    const AudioContextClass = browserWindow.AudioContext || browserWindow.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      const master = this.ctx.createGain();
      master.gain.value = this.getGainMultiplier();
      master.connect(this.ctx.destination);
      this.masterGain = master;
    }
  }

  private resumeIfNeeded() {
    if (!this.ctx || this.ctx.state !== "suspended") return;
    void this.ctx.resume().catch(() => undefined);
  }

  setVolume(vol: number) {
    const next = normalizeVolumeValue(vol);
    if (next === null) return;
    this.volume = next;
    this.updateAmbientVolume();
    this.updateMasterVolume();
  }

  setMuted(mute: boolean) {
    this.muted = mute;
    this.updateAmbientVolume();
    this.updateMasterVolume();
  }

  getVolume() {
    return this.volume;
  }

  isMuted() {
    return this.muted;
  }

  private getGainMultiplier() {
    return this.muted ? 0 : this.volume;
  }

  private updateAmbientVolume() {
    // Ambient output is governed by the master gain (volume slider + mute)
    // because the ambient bus now routes through it. The per-gain value
    // stays at the headroom level so the slider scales ambient and one-shots
    // uniformly.
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(0.012, this.ctx.currentTime, 0.15);
    }
  }

  private updateMasterVolume() {
    if (this.masterGain && this.ctx) {
      const mult = this.getGainMultiplier();
      // setTargetAtTime avoids clicks when the user drags the slider.
      this.masterGain.gain.setTargetAtTime(mult, this.ctx.currentTime, 0.02);
    }
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private envelope(
    gain: GainNode,
    peak: number,
    attack: number,
    decay: number,
    startOffset = 0,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = this.now() + startOffset;
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  private playTone({
    frequency,
    type = "sine",
    peak = 0.6,
    attack = 0.005,
    decay = 0.18,
    filter,
    filterFreq,
    sweepTo,
    sweepDuration,
    gainMultiplier = 1,
  }: {
    frequency: number;
    type?: OscillatorType;
    peak?: number;
    attack?: number;
    decay?: number;
    filter?: BiquadFilterType;
    filterFreq?: number;
    sweepTo?: number;
    sweepDuration?: number;
    gainMultiplier?: number;
  }) {
    this.init();
    this.resumeIfNeeded();
    if (!this.ctx || !this.masterGain) return;
    if (this.muted) return;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.now());

    let node: AudioNode = osc;
    if (filter) {
      const filt = this.ctx.createBiquadFilter();
      filt.type = filter;
      const center = filterFreq ?? frequency;
      filt.frequency.setValueAtTime(center, this.now());
      if (typeof sweepTo === "number" && typeof sweepDuration === "number") {
        filt.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), this.now() + sweepDuration);
      }
      osc.connect(filt);
      node = filt;
    }

    const env = this.ctx.createGain();
    env.gain.value = 0;
    node.connect(env);
    env.connect(this.masterGain);
    this.envelope(env, peak * gainMultiplier, attack, decay);

    const stopAt = this.now() + attack + decay + 0.05;
    osc.start(this.now());
    osc.stop(stopAt);
    osc.onended = () => {
      try {
        osc.disconnect();
      } catch {
        // already disconnected
      }
    };
  }

  private playNoiseBurst({
    peak = 0.4,
    attack = 0.003,
    decay = 0.18,
    filterFreq = 2400,
    gainMultiplier = 1,
  }: {
    peak?: number;
    attack?: number;
    decay?: number;
    filterFreq?: number;
    gainMultiplier?: number;
  }) {
    this.init();
    this.resumeIfNeeded();
    if (!this.ctx || !this.masterGain) return;
    if (this.muted) return;

    // Generate a short white-noise buffer for card swishes.
    const duration = Math.max(attack + decay + 0.05, 0.2);
    const sampleCount = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      // Simple decaying noise: random [-1, 1] with exponential decay envelope.
      const t = i / sampleCount;
      const envelope = Math.pow(1 - t, 1.4);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(filterFreq, this.now());
    filt.Q.setValueAtTime(0.7, this.now());

    const env = this.ctx.createGain();
    env.gain.value = 0;

    source.connect(filt);
    filt.connect(env);
    env.connect(this.masterGain);
    this.envelope(env, peak * gainMultiplier, attack, decay);

    source.start(this.now());
    source.stop(this.now() + duration);
  }

  startAmbientSoundscape(skin = "classic") {
    this.init();
    if (!this.ctx) return;
    this.resumeIfNeeded();
    this.stopAmbientSoundscape();

    const now = this.ctx.currentTime;

    // Route the ambient bus through the master gain so the volume slider
    // and mute toggle apply to ambient sounds too. Without this hop the
    // ambient loop would always play at the raw 0.012 level regardless of
    // the user’s volume setting.
    const gainNode = this.ctx.createGain();
    if (this.masterGain) {
      gainNode.connect(this.masterGain);
    } else {
      gainNode.connect(this.ctx.destination);
    }
    // `masterGain` already encodes the volume slider / mute toggle, so the
    // ambient headroom stays at 0.012 unconditionally. Updating it here as
    // well would stack the multiplier and over-attenuate ambient output.
    gainNode.gain.setValueAtTime(0.012, now);
    this.ambientGain = gainNode;

    if (skin === "classic") {
      const freqs = [82.41, 98.0, 123.47, 146.83];
      this.ambientOscs = freqs.map((f) => {
        const osc = this.ctx!.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);

        const pGain = this.ctx!.createGain();
        pGain.connect(gainNode);
        pGain.gain.setValueAtTime(0.25, now);

        osc.connect(pGain);
        osc.start(now);
        return osc;
      });
    } else if (skin === "cyber") {
      const freqs = [65.41, 98.0];
      this.ambientOscs = freqs.map((f) => {
        const osc = this.ctx!.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, now);

        const filter = this.ctx!.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(120, now);

        osc.connect(filter);
        filter.connect(gainNode);
        osc.start(now);
        return osc;
      });
    } else {
      const freqs = [392.0, 493.88];
      this.ambientOscs = freqs.map((f, i) => {
        const osc = this.ctx!.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);

        const filter = this.ctx!.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(f + Math.sin(i) * 12, now);

        osc.connect(filter);
        filter.connect(gainNode);
        osc.start(now);
        return osc;
      });
    }
  }

  stopAmbientSoundscape() {
    this.ambientOscs.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // ignore
      }
      try {
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.ambientOscs = [];
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch {
        // ignore
      }
      this.ambientGain = null;
    }
  }

  // Short percussive pluck used for button presses, picking a card, and the
  // "Test Sound" button in the audio panel.
  playPluck() {
    this.playTone({
      frequency: 880,
      type: "triangle",
      peak: 0.55,
      attack: 0.002,
      decay: 0.13,
      filter: "lowpass",
      filterFreq: 1800,
      sweepTo: 600,
      sweepDuration: 0.13,
      gainMultiplier: 0.85,
    });
  }

  // Soft airy swish used for card selection, chat sends, and lobby chrome.
  playSwish() {
    this.playNoiseBurst({
      peak: 0.32,
      attack: 0.005,
      decay: 0.16,
      filterFreq: 2200,
      gainMultiplier: 0.7,
    });
  }

  // Bell-like chime for special cards (+2, +4, WILD) and the game-over sting.
  playChime() {
    const gainMultiplier = 0.9;
    // Two-note shimmer (perfect fifth) for a celebratory timbre.
    this.playTone({
      frequency: 880,
      type: "sine",
      peak: 0.4,
      attack: 0.005,
      decay: 0.45,
      filter: "lowpass",
      filterFreq: 3200,
      gainMultiplier,
    });
    this.playTone({
      frequency: 1318.51,
      type: "sine",
      peak: 0.3,
      attack: 0.005,
      decay: 0.45,
      filter: "lowpass",
      filterFreq: 3600,
      gainMultiplier,
    });
  }

  // Distinctive rising alert played once when the local player's turn starts.
  playTurnAlert() {
    const gainMultiplier = 1;
    this.playTone({
      frequency: 523.25,
      type: "triangle",
      peak: 0.5,
      attack: 0.005,
      decay: 0.18,
      filter: "lowpass",
      filterFreq: 2000,
      gainMultiplier,
    });
    this.playTone({
      frequency: 659.25,
      type: "triangle",
      peak: 0.5,
      attack: 0.005,
      decay: 0.18,
      filter: "lowpass",
      filterFreq: 2400,
      gainMultiplier,
    });
  }

  // Low pulsing heartbeat used when the turn deadline is about to expire.
  playHeartbeat() {
    this.playTone({
      frequency: 110,
      type: "sine",
      peak: 0.55,
      attack: 0.01,
      decay: 0.18,
      filter: "lowpass",
      filterFreq: 320,
      gainMultiplier: 0.85,
    });
  }

  // UNO call / win sting: punchy bright cue.
  playUno() {
    const gainMultiplier = 1.1;
    this.playTone({
      frequency: 660,
      type: "square",
      peak: 0.5,
      attack: 0.002,
      decay: 0.16,
      filter: "lowpass",
      filterFreq: 2400,
      gainMultiplier,
    });
    this.playTone({
      frequency: 990,
      type: "triangle",
      peak: 0.5,
      attack: 0.002,
      decay: 0.22,
      filter: "lowpass",
      filterFreq: 3200,
      gainMultiplier,
    });
  }

  // Error feedback: descending tone for rejected actions.
  playError() {
    this.playTone({
      frequency: 320,
      type: "sawtooth",
      peak: 0.4,
      attack: 0.005,
      decay: 0.22,
      filter: "lowpass",
      filterFreq: 900,
      sweepTo: 180,
      sweepDuration: 0.22,
      gainMultiplier: 0.9,
    });
  }
}

export const sfx = new SoundFX();

const savedVol = readStorage("uno_volume");
const normalizedVol = parseStoredVolumeValue(savedVol);
if (normalizedVol !== null) {
  sfx.setVolume(normalizedVol);
}
const savedMuted = readStorage("uno_muted");
if (savedMuted === "true") sfx.setMuted(true);
