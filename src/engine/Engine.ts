import type { Settings } from '../types.ts';
import { AudioEngine } from './Audio.ts';
import { Camera } from './Camera.ts';
import { DayNightCycle } from './DayNight.ts';
import { InputManager } from './Input.ts';
import { WeatherSystem } from './Weather.ts';

export interface ModeEvents {
  onScoreUpdate?: (score: number, label?: string) => void;
  onGameOver?: (score: number) => void;
  onDialogue?: (text: string | null, speaker?: string) => void;
  onPhoto?: (dataUrl: string, graded: { framed: boolean; message: string }) => void;
  onObjective?: (text: string | null) => void;
}

export interface Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: InputManager;
  audio: AudioEngine;
  camera: Camera;
  weather: WeatherSystem;
  dayNight: DayNightCycle;
  settings: Settings;
  width: number;
  height: number;
  skinId: string;
}

export interface GameMode {
  id: string;
  init(engine: Engine, events: ModeEvents): void;
  update(engine: Engine, dt: number): void;
  render(engine: Engine): void;
  teardown?(): void;
}

export function createEngine(canvas: HTMLCanvasElement, settings: Settings, skinId: string): Engine {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return {
    canvas,
    ctx,
    input: new InputManager(canvas),
    audio: new AudioEngine(),
    camera: new Camera(),
    weather: new WeatherSystem(),
    dayNight: new DayNightCycle(),
    settings,
    width: canvas.width,
    height: canvas.height,
    skinId,
  };
}

export class GameLoop {
  private raf = 0;
  private last = 0;
  private mode: GameMode | null = null;
  private engine: Engine;
  running = false;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  setMode(mode: GameMode, events: ModeEvents): void {
    this.mode?.teardown?.();
    this.mode = mode;
    mode.init(this.engine, events);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      let dt = (t - this.last) / 1000;
      this.last = t;
      dt = Math.min(dt, 1 / 20);
      this.engine.audio.setVolume(this.engine.settings.muted ? 0 : this.engine.settings.volume);
      if (this.mode) {
        this.mode.update(this.engine, dt);
        this.mode.render(this.engine);
      }
      this.renderTouchOverlay();
      this.engine.input.endFrame();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  teardownMode(): void {
    this.mode?.teardown?.();
    this.mode = null;
  }

  private renderTouchOverlay(): void {
    const joy = this.engine.input.joystickVisual;
    if (!joy) return;
    const { ctx } = this.engine;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joy.originX, joy.originY, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#fff';
    const dx = joy.curX - joy.originX;
    const dy = joy.curY - joy.originY;
    const len = Math.min(46, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.arc(joy.originX + Math.cos(ang) * len, joy.originY + Math.sin(ang) * len, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
