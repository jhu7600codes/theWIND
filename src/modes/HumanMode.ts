import type { Engine, GameMode, ModeEvents } from '../engine/Engine.ts';
import { BAG_PARAMS, FlightBody } from '../engine/Physics.ts';
import { drawBag, getSkin } from '../entities/Bag.ts';
import { drawHuman } from '../entities/Human.ts';
import { World } from '../entities/World.ts';

const RETICLE_W = 190;
const RETICLE_H = 140;

export class HumanMode implements GameMode {
  id = 'human';
  private world = new World();
  private bag = new FlightBody({ x: 0, y: -200 });
  private events: ModeEvents = {};
  private aim = { x: 0, y: -140 };
  private aimVel = 0;
  private humanX = 0;
  private walkPhase = 0;
  private shots = 0;
  private posted = 0;
  private pendingCapture = false;
  private lastReticle = { x: 0, y: 0, w: RETICLE_W, h: RETICLE_H };
  private flash = 0;

  init(engine: Engine, events: ModeEvents): void {
    this.events = events;
    this.world = new World(Date.now() % 100000);
    this.world.buildingsEnabled = false;
    this.humanX = 0;
    this.walkPhase = 0;
    this.bag = new FlightBody({ x: 250, y: -260 });
    this.bag.vel = { x: 30, y: 0 };
    this.aim = { x: 250, y: -260 };
    this.shots = 0;
    this.posted = 0;
    engine.weather.enabled = true;
    engine.camera.x = -engine.width * 0.5;
    engine.camera.y = -engine.height * 0.55;
    events.onObjective?.('Drag / arrow-keys to aim the camera. Frame the bag, then press SPACE (or tap the shutter) to snap it.');
    events.onScoreUpdate?.(0, 'posts');
  }

  update(engine: Engine, dt: number): void {
    this.walkPhase += dt * 3;
    engine.weather.update(dt);
    engine.dayNight.update(dt);
    this.world.update(dt, engine, engine.camera.x);

    const walkAxis = engine.input.getAxis('wasd').x || engine.input.getAxis('arrows').x;
    this.humanX += walkAxis * 90 * dt;
    this.humanX = Math.max(-260, Math.min(260, this.humanX));

    const aimDelta = engine.input.consumeAim();
    this.aim.x += aimDelta.x * 1.6 * engine.settings.sensitivity;
    this.aim.y += aimDelta.y * 1.6 * engine.settings.sensitivity;
    // keyboard fallback aim with IJKL when not walking with arrows
    const ijkl = engine.input.getAxis('ijkl');
    this.aim.x += ijkl.x * 260 * dt * engine.settings.sensitivity;
    this.aim.y += ijkl.y * 260 * dt * engine.settings.sensitivity;

    this.aim.x = Math.max(-360, Math.min(600, this.aim.x));
    this.aim.y = Math.max(-620, Math.min(-40, this.aim.y));
    this.aimVel = Math.hypot(aimDelta.x, aimDelta.y);

    const flutter = { x: Math.sin(performance.now() * 0.0011) * 0.3, y: Math.sin(performance.now() * 0.0017 + 2) * 0.4 };
    this.bag.update(dt, flutter, 1, engine.weather.gustVector, engine.weather.rainWeight * 0.4, BAG_PARAMS, false);
    if (this.bag.pos.x > 700 || this.bag.pos.x < -500) this.bag.vel.x *= -1;
    if (this.bag.pos.y > -60) this.bag.vel.y -= 40;
    if (this.bag.pos.y < -600) this.bag.vel.y += 40;

    engine.camera.x = this.humanX - engine.width * 0.5;
    engine.camera.y = -engine.height * 0.55;
    engine.audio.setWindIntensity(0.15);
    engine.audio.setRainIntensity(engine.weather.rainIntensity);
    engine.audio.tickPad(dt);

    if (engine.input.wasPressed('Space') && !this.pendingCapture) {
      this.requestShutter(engine);
    }

    if (this.flash > 0) this.flash -= dt * 3;
  }

  private requestShutter(engine: Engine): void {
    const bagScreen = engine.camera.worldToScreen(this.bag.pos);
    const reticleScreen = engine.camera.worldToScreen(this.aim);
    this.lastReticle = { x: reticleScreen.x - RETICLE_W / 2, y: reticleScreen.y - RETICLE_H / 2, w: RETICLE_W, h: RETICLE_H };
    const inFrame =
      bagScreen.x > this.lastReticle.x + 14 &&
      bagScreen.x < this.lastReticle.x + this.lastReticle.w - 14 &&
      bagScreen.y > this.lastReticle.y + 14 &&
      bagScreen.y < this.lastReticle.y + this.lastReticle.h - 14;
    const steady = this.aimVel < 22;
    const framed = inFrame && steady;

    this.shots++;
    engine.audio.shutter();
    this.flash = 1;
    this.pendingCapture = true;
    this.pendingResult = { framed, message: !inFrame ? 'Bag was out of frame.' : !steady ? 'Camera moved — too blurry.' : 'Perfect shot! Posted.' };
    if (framed) {
      this.posted++;
      engine.audio.catchPop();
      this.events.onScoreUpdate?.(this.posted, 'posts');
    }
  }

  private pendingResult: { framed: boolean; message: string } | null = null;

  render(engine: Engine): void {
    const { ctx, width, height } = engine;
    this.world.renderSky(engine);
    this.world.renderClouds(engine, 0.4);
    this.world.renderClouds(engine, 0.2);
    this.world.renderRain(engine);

    const bagScreen = engine.camera.worldToScreen(this.bag.pos);
    const skin = getSkin(engine.skinId);
    drawBag(ctx, bagScreen.x, bagScreen.y, this.bag.angle, 1.2, skin.colors, performance.now() * 0.003);

    const humanScreen = engine.camera.worldToScreen({ x: this.humanX, y: 0 });
    const aimAngleToReticle = Math.atan2(
      engine.camera.worldToScreen(this.aim).y - humanScreen.y,
      engine.camera.worldToScreen(this.aim).x - humanScreen.x,
    );
    drawHuman(ctx, humanScreen.x, humanScreen.y, aimAngleToReticle, this.walkPhase);

    const reticleScreen = engine.camera.worldToScreen(this.aim);
    ctx.save();
    ctx.strokeStyle = '#fefefe';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.9;
    const rx = reticleScreen.x - RETICLE_W / 2;
    const ry = reticleScreen.y - RETICLE_H / 2;
    ctx.strokeRect(rx, ry, RETICLE_W, RETICLE_H);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(rx + (RETICLE_W / 3) * i, ry);
      ctx.lineTo(rx + (RETICLE_W / 3) * i, ry + RETICLE_H);
      ctx.moveTo(rx, ry + (RETICLE_H / 3) * i);
      ctx.lineTo(rx + RETICLE_W, ry + (RETICLE_H / 3) * i);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(width / 2 - 70, height - 30, 140, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`shots ${this.shots} · posted ${this.posted}`, width / 2, height - 16);
    ctx.restore();

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.flash);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (this.pendingCapture) {
      this.pendingCapture = false;
      try {
        const temp = document.createElement('canvas');
        temp.width = this.lastReticle.w;
        temp.height = this.lastReticle.h;
        const tctx = temp.getContext('2d');
        if (tctx) {
          tctx.drawImage(engine.canvas, this.lastReticle.x, this.lastReticle.y, this.lastReticle.w, this.lastReticle.h, 0, 0, this.lastReticle.w, this.lastReticle.h);
          const dataUrl = temp.toDataURL('image/png');
          if (this.pendingResult) this.events.onPhoto?.(dataUrl, this.pendingResult);
        }
      } catch {
        // canvas capture unsupported in this browser context — skip preview
      }
    }
  }
}
