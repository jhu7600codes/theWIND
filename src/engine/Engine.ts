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

  /** Human Mode reuses the same touch pointer for camera-aim dragging, not movement zones — skip the grid there. */
  private renderTouchOverlay(): void {
    if (this.mode?.id === 'human') return;
    const zone = this.engine.input.touchZoneActive;
    if (!zone) return;
    const { ctx, width, height } = this.engine;
    const colLeft = width / 6;
    const colRight = (width * 5) / 6;
    const midY = height / 2;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff';
    const cellX = zone.col === 0 ? 0 : zone.col === 1 ? colLeft : colRight;
    const cellW = zone.col === 1 ? colRight - colLeft : colLeft;
    ctx.fillRect(cellX, zone.row === 0 ? 0 : midY, cellW, midY);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(colLeft, 0);
    ctx.lineTo(colLeft, height);
    ctx.moveTo(colRight, 0);
    ctx.lineTo(colRight, height);
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
    ctx.restore();
  }
}
