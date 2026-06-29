// Xylophone-style generative sound engine — pure Web Audio API, zero dependencies.
// Each "tone" is a mallet hit: sine fundamental + brief 4× partial + short bandpassed
// noise transient. No wet feedback reverb; only a single short delay tap for air.

export type SoundType =
  | 'click'
  | 'hover'
  | 'success'
  | 'error'
  | 'navigation'
  | 'toggle-on'
  | 'toggle-off'
  | 'celebration'
  | 'alarm'
  | 'hum'
  | 'pop'
  | 'ring';

// C pentatonic scale frequencies
const PENTATONIC_C5 = [523.25, 587.33, 659.25, 783.99, 880.0];
const PENTATONIC_C4 = [261.63, 293.66, 329.63, 392.0, 440.0];
const PENTATONIC_C3 = PENTATONIC_C4.map((f) => f / 2);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickIndex(len: number): number {
  return Math.floor(Math.random() * len);
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private busInput: GainNode | null = null;
  private _volume = 0.55;
  private _muted = false;
  private _tempo = 1.0;

  get volume() {
    return this._volume;
  }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.syncGain();
  }

  get muted() {
    return this._muted;
  }
  set muted(m: boolean) {
    this._muted = m;
    this.syncGain();
  }

  get tempo() {
    return this._tempo;
  }
  set tempo(t: number) {
    this._tempo = t;
  }

  private syncGain() {
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
    }
  }

  /** Initialize AudioContext — call from a user gesture handler */
  init(): boolean {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
      this.masterGain.connect(this.ctx.destination);
      this.buildBus();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return true;
    } catch (e) {
      console.warn('SoundEngine: failed to init AudioContext', e);
      return false;
    }
  }

  /**
   * Build the mixing bus. Voices connect to `busInput`. The bus has:
   *  - dry path straight to master (the dominant signal)
   *  - one short delay tap with a highpass, no feedback — adds spatial air
   *    without the long wet wash a feedback loop would create.
   */
  private buildBus() {
    if (!this.ctx || !this.masterGain) return;
    if (this.busInput) {
      try { this.busInput.disconnect(); } catch { /* ok */ }
    }

    const input = this.ctx.createGain();
    input.gain.value = 1;

    // Dry path — the dominant signal.
    input.connect(this.masterGain);

    // Air: single short delay, no feedback, highpass to keep it transparent.
    const air = this.ctx.createDelay(0.06);
    air.delayTime.value = 0.022;
    const airHp = this.ctx.createBiquadFilter();
    airHp.type = 'highpass';
    airHp.frequency.value = 600;
    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.09;

    input.connect(air);
    air.connect(airHp);
    airHp.connect(airGain);
    airGain.connect(this.masterGain);

    // Reverb: feedback delay for a warm ambient tail — subtle wash, no slap
    const revDelay = this.ctx.createDelay(0.3);
    revDelay.delayTime.value = 0.12;
    const revMix = this.ctx.createGain();
    revMix.gain.value = 0.18;
    const revFb = this.ctx.createGain();
    revFb.gain.value = 0.25;
    const revHp = this.ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 300;
    const revLp = this.ctx.createBiquadFilter();
    revLp.type = 'lowpass';
    revLp.frequency.value = 4000;

    input.connect(revDelay);
    revDelay.connect(revMix);
    revMix.connect(revHp);
    revHp.connect(revLp);
    revLp.connect(this.masterGain);
    // Feedback tap — feeds back into the delay
    revLp.connect(revFb);
    revFb.connect(revDelay);

    this.busInput = input;
  }

  private scale(): number[] {
    return this._tempo < 1 ? PENTATONIC_C3 : PENTATONIC_C4;
  }

  private dur(base: number): number {
    return base / this._tempo;
  }

  /**
   * Xylophone-style mallet hit. Layers:
   *  1) Sine fundamental — short attack, exponential decay
   *  2) Sine partial at 4× — quick shimmer, decays faster
   *  3) Bandpassed noise transient at strike time — the "mallet click"
   */
  private mallet(
    freq: number,
    startTime: number,
    decay = 0.32,
    gainPeak = 0.55,
  ) {
    const ctx = this.ctx;
    const dest = this.busInput;
    if (!ctx || !dest) return;

    const attack = 0.003;
    const safeStart = Math.max(startTime, ctx.currentTime + 0.001);

    // Fundamental
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, safeStart);
    oscGain.gain.exponentialRampToValueAtTime(gainPeak, safeStart + attack);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, safeStart + attack + decay);
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(safeStart);
    osc.stop(safeStart + attack + decay + 0.05);

    // 4× partial — gives the bar-like brightness, fades quickly
    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = freq * 4;
    const partialGain = ctx.createGain();
    const partialDecay = Math.max(0.08, decay * 0.35);
    partialGain.gain.setValueAtTime(0.0001, safeStart);
    partialGain.gain.exponentialRampToValueAtTime(gainPeak * 0.18, safeStart + attack);
    partialGain.gain.exponentialRampToValueAtTime(0.0001, safeStart + attack + partialDecay);
    partial.connect(partialGain);
    partialGain.connect(dest);
    partial.start(safeStart);
    partial.stop(safeStart + attack + partialDecay + 0.05);

    // Mallet click — ultra-short bandpassed noise burst
    const noiseLen = Math.max(1, Math.floor(ctx.sampleRate * 0.012));
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(8000, freq * 2.6);
    bp.Q.value = 1.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, safeStart);
    noiseGain.gain.exponentialRampToValueAtTime(gainPeak * 0.14, safeStart + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, safeStart + 0.014);
    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(safeStart);
    noise.stop(safeStart + 0.04);
  }

  play(type: SoundType) {
    const ctx = this.ctx;
    if (!ctx || this._muted) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime + 0.02;
    const scale = this.scale();

    switch (type) {
      case 'click': {
        // Creamy, thocky typing sound — rich low-end body + soft-top click
        const clickStart = now;

        // 1. Creamy body — warm sine thump for the "thock"
        const body = ctx.createOscillator();
        body.type = 'sine';
        body.frequency.value = 180 + Math.random() * 80;
        const bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(0.0001, clickStart);
        bodyGain.gain.exponentialRampToValueAtTime(0.18, clickStart + 0.003);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, clickStart + 0.04);
        body.connect(bodyGain);
        bodyGain.connect(this.busInput!);
        body.start(clickStart);
        body.stop(clickStart + 0.05);

        // 2. Soft top-click — lower bandpass noise for a rounded "thock"
        const clickLen = Math.max(1, Math.floor(ctx.sampleRate * 0.008));
        const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
        const clickData = clickBuf.getChannelData(0);
        for (let i = 0; i < clickLen; i++) clickData[i] = Math.random() * 2 - 1;
        const clickSource = ctx.createBufferSource();
        clickSource.buffer = clickBuf;

        const bp2 = ctx.createBiquadFilter();
        bp2.type = 'bandpass';
        bp2.frequency.value = 1200 + Math.random() * 600;
        bp2.Q.value = 0.8;

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.0001, clickStart);
        clickGain.gain.exponentialRampToValueAtTime(0.22 + Math.random() * 0.1, clickStart + 0.001);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, clickStart + 0.014);

        clickSource.connect(bp2);
        bp2.connect(clickGain);
        clickGain.connect(this.busInput!);
        clickSource.start(clickStart);
        clickSource.stop(clickStart + 0.02);

        // 3. Bottom-out thud — subtle low-end weight
        const thudLen = Math.max(1, Math.floor(ctx.sampleRate * 0.01));
        const thudBuf = ctx.createBuffer(1, thudLen, ctx.sampleRate);
        const thudData = thudBuf.getChannelData(0);
        for (let i = 0; i < thudLen; i++) thudData[i] = Math.random() * 2 - 1;
        const thudSource = ctx.createBufferSource();
        thudSource.buffer = thudBuf;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 250;

        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.0001, clickStart + 0.003);
        thudGain.gain.exponentialRampToValueAtTime(0.12, clickStart + 0.005);
        thudGain.gain.exponentialRampToValueAtTime(0.0001, clickStart + 0.018);

        thudSource.connect(lp);
        lp.connect(thudGain);
        thudGain.connect(this.busInput!);
        thudSource.start(clickStart + 0.003);
        thudSource.stop(clickStart + 0.022);
        break;
      }

      case 'hover': {
        this.mallet(pick(PENTATONIC_C5), now, this.dur(0.12), 0.15);
        break;
      }

      case 'success': {
        // Ascending 3-note arpeggio
        const startIdx = pickIndex(scale.length - 2);
        for (let i = 0; i < 3; i++) {
          this.mallet(scale[startIdx + i], now + i * this.dur(0.1), this.dur(0.3), 0.5);
        }
        break;
      }

      case 'error': {
        // Two-note minor-second drop — subtle dissonance, no harshness
        const freq = pick(scale);
        this.mallet(freq, now, this.dur(0.26), 0.42);
        this.mallet(freq * 0.944, now + this.dur(0.13), this.dur(0.3), 0.36);
        break;
      }

      case 'navigation': {
        // Two-note P5 ascend — calm, like a marimba flourish
        const base = pick(scale) / 2;
        this.mallet(base, now, this.dur(0.28), 0.32);
        this.mallet(base * 1.5, now + this.dur(0.05), this.dur(0.32), 0.28);
        break;
      }

      case 'toggle-on': {
        // Ascending pair across the pentatonic
        this.mallet(scale[0], now, this.dur(0.24), 0.42);
        this.mallet(scale[2], now + this.dur(0.09), this.dur(0.28), 0.4);
        break;
      }

      case 'toggle-off': {
        // Descending pair
        this.mallet(scale[2], now, this.dur(0.24), 0.42);
        this.mallet(scale[0], now + this.dur(0.09), this.dur(0.28), 0.4);
        break;
      }

      case 'hum': {
        // Octave below hover — the same gentle tap, lower
        this.mallet(pick(scale) / 4, now, this.dur(0.22), 0.2);
        break;
      }

      case 'celebration': {
        // Full pentatonic run + a high octave sparkle on top
        for (let i = 0; i < scale.length; i++) {
          this.mallet(scale[i], now + i * this.dur(0.08), this.dur(0.36), 0.5);
        }
        const sparkleStart = now + scale.length * this.dur(0.08);
        const top = scale[scale.length - 1];
        this.mallet(top * 2, sparkleStart, this.dur(0.4), 0.42);
        this.mallet(PENTATONIC_C5[2], sparkleStart + this.dur(0.07), this.dur(0.5), 0.38);
        break;
      }

      case 'pop': {
        // Satisfying balloon pop: bright crack + musical body + rubber snap
        const t0 = now;

        // 1. Crack — short bandpassed noise burst
        const crackLen = Math.max(1, Math.floor(ctx.sampleRate * 0.018));
        const crackBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
        const crackData = crackBuf.getChannelData(0);
        for (let i = 0; i < crackLen; i++) crackData[i] = Math.random() * 2 - 1;
        const crackSource = ctx.createBufferSource();
        crackSource.buffer = crackBuf;

        const crackBp = ctx.createBiquadFilter();
        crackBp.type = 'bandpass';
        crackBp.frequency.value = 2800;
        crackBp.Q.value = 1.1;

        const crackGain = ctx.createGain();
        crackGain.gain.setValueAtTime(0.0001, t0);
        crackGain.gain.exponentialRampToValueAtTime(0.38, t0 + 0.001);
        crackGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.02);

        crackSource.connect(crackBp);
        crackBp.connect(crackGain);
        crackGain.connect(this.busInput!);
        crackSource.start(t0);
        crackSource.stop(t0 + 0.025);

        // 2. Body — short musical tone for satisfying weight
        const body = ctx.createOscillator();
        body.type = 'sine';
        body.frequency.setValueAtTime(720, t0 + 0.002);
        body.frequency.exponentialRampToValueAtTime(520, t0 + 0.04);
        const bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(0.0001, t0 + 0.002);
        bodyGain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.005);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        body.connect(bodyGain);
        bodyGain.connect(this.busInput!);
        body.start(t0 + 0.002);
        body.stop(t0 + 0.055);

        // 3. Snap — quick bright harmonic for that rubbery "sproing"
        const snap = ctx.createOscillator();
        snap.type = 'sine';
        snap.frequency.setValueAtTime(1800, t0 + 0.006);
        snap.frequency.exponentialRampToValueAtTime(2400, t0 + 0.015);
        const snapGain = ctx.createGain();
        snapGain.gain.setValueAtTime(0.0001, t0 + 0.006);
        snapGain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.009);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);
        snap.connect(snapGain);
        snapGain.connect(this.busInput!);
        snap.start(t0 + 0.006);
        snap.stop(t0 + 0.026);
        break;
      }

      case 'alarm': {
        // Attention-grabbing but still mallet-clean
        const base = scale[3];
        this.mallet(base, now, this.dur(0.22), 0.42);
        this.mallet(base * 1.5, now + this.dur(0.11), this.dur(0.24), 0.36);
        this.mallet(base * 2, now + this.dur(0.24), this.dur(0.3), 0.32);
        break;
      }

      case 'ring': {
        // Melodic 4-note descending motif — a pretty ringtone phrase
        // Uses the pentatonic scale for a guaranteed pleasant tune
        const top = scale.length - 1;
        this.mallet(scale[top], now, this.dur(0.14), 0.42);
        this.mallet(scale[top - 1], now + this.dur(0.11), this.dur(0.14), 0.38);
        this.mallet(scale[top - 2], now + this.dur(0.22), this.dur(0.16), 0.35);
        this.mallet(scale[top], now + this.dur(0.33), this.dur(0.18), 0.32);
        break;
      }
    }
  }

  destroy() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.busInput = null;
    }
  }
}
