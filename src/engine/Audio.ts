/** Fully procedural sound design — no external audio assets. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  volume = 0.7;
  muted = false;
  private padTimer = 0;
  private padStep = 0;
  private started = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoiseBuffer();
    }
    return this.ctx;
  }

  private makeNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Must be called from a user gesture to unlock audio on mobile browsers. */
  async unlock(): Promise<void> {
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    if (this.started) return;
    this.started = true;
    this.startWindLoop();
    this.startRainLoop();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx!.currentTime, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx!.currentTime, 0.05);
  }

  private startWindLoop(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.02;
    src.connect(filter).connect(this.windGain).connect(this.master!);
    src.start();
  }

  private startRainLoop(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    src.connect(filter).connect(this.rainGain).connect(this.master!);
    src.start();
  }

  /** intensity 0..1 of ambient wind whoosh, speed-linked */
  setWindIntensity(intensity: number): void {
    if (!this.windGain || !this.ctx) return;
    this.windGain.gain.setTargetAtTime(0.015 + intensity * 0.09, this.ctx.currentTime, 0.15);
  }

  setRainIntensity(intensity: number): void {
    if (!this.rainGain || !this.ctx) return;
    this.rainGain.gain.setTargetAtTime(intensity * 0.05, this.ctx.currentTime, 0.4);
  }

  private blip(freq: number, dur: number, type: OscillatorType = 'sine', gainPeak = 0.15, glideTo?: number): void {
    if (!this.started) return;
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  uiClick(): void {
    this.blip(600, 0.06, 'triangle', 0.12);
  }

  uiConfirm(): void {
    this.blip(500, 0.1, 'triangle', 0.14, 900);
  }

  flap(): void {
    this.blip(180, 0.12, 'sawtooth', 0.08, 90);
  }

  catchPop(): void {
    this.blip(300, 0.15, 'square', 0.15, 700);
  }

  shutter(): void {
    if (!this.started) return;
    const ctx = this.ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    src.connect(filter).connect(g).connect(this.master!);
    src.start();
    src.stop(ctx.currentTime + 0.06);
  }

  thud(): void {
    this.blip(120, 0.25, 'sawtooth', 0.2, 40);
  }

  gameOver(): void {
    if (!this.started) return;
    const ctx = this.ensureCtx();
    [440, 349, 293, 220].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.14;
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  highScore(): void {
    if (!this.started) return;
    const ctx = this.ctx!;
    [523, 659, 784, 1047].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  /** Lofi background pad — call every frame with dt; advances a slow arpeggio. */
  tickPad(dt: number): void {
    if (!this.started || !this.ctx) return;
    this.padTimer -= dt;
    if (this.padTimer > 0) return;
    this.padTimer = 1.6 + Math.random() * 0.8;
    const scale = [220, 261.6, 293.7, 329.6, 392, 440];
    const freq = scale[this.padStep % scale.length];
    this.padStep++;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq / 2;
    if (!this.padGain) {
      this.padGain = ctx.createGain();
      this.padGain.gain.value = 0.05;
      this.padGain.connect(this.master!);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
    osc.connect(g).connect(this.padGain);
    osc.start();
    osc.stop(ctx.currentTime + 3.3);
  }
}
