import type { Engine, GameMode, ModeEvents } from '../engine/Engine.ts';
import { BAG_PARAMS, FlightBody } from '../engine/Physics.ts';
import { drawBag, getSkin } from '../entities/Bag.ts';
import { CEILING_Y, GROUND_Y, WARNING_CEILING_Y, World } from '../entities/World.ts';

const BAG_RADIUS = 17;

export class NormalMode implements GameMode {
  id = 'normal';
  private world = new World();
  private bag = new FlightBody({ x: 0, y: 500 });
  private events: ModeEvents = {};
  private ended = false;
  private erraticHoldTime = 0;
  private ceilingHoldTime = 0;
  private time = 0;
  private wobble = 0;

  init(engine: Engine, events: ModeEvents): void {
    this.events = events;
    this.world = new World(Date.now() % 100000);
    this.world.buildingsEnabled = true;
    this.bag = new FlightBody({ x: 0, y: 500 });
    this.ended = false;
    this.erraticHoldTime = 0;
    this.ceilingHoldTime = 0;
    this.time = 0;
    engine.weather.enabled = true;
    engine.camera.x = -engine.width * 0.38;
    engine.camera.y = this.bag.pos.y - engine.height * 0.5;
    events.onObjective?.('Ride the wind. Avoid the ground, buildings, and flying too high or too wild.');
  }

  private endGame(engine: Engine): void {
    if (this.ended) return;
    this.ended = true;
    engine.audio.gameOver();
    this.events.onGameOver?.(this.time * 12);
  }

  update(engine: Engine, dt: number): void {
    if (this.ended) return;
    this.time += dt;
    this.wobble += dt * 5;

    const axis = combinedAxis(engine);
    engine.weather.update(dt);
    engine.dayNight.update(dt);
    this.world.update(dt, engine, engine.camera.x);

    this.bag.update(dt, axis, engine.settings.sensitivity, engine.weather.gustVector, engine.weather.rainWeight, BAG_PARAMS, true);

    engine.camera.follow(this.bag.pos, dt, { groundY: GROUND_Y });
    engine.audio.setWindIntensity(Math.min(1, Math.hypot(this.bag.vel.x, this.bag.vel.y) / 500));
    engine.audio.setRainIntensity(engine.weather.rainIntensity);
    engine.audio.tickPad(dt);

    this.events.onScoreUpdate?.(this.time * 12, 'distance');

    // ground collision
    if (this.bag.pos.y + BAG_RADIUS >= GROUND_Y) {
      engine.audio.thud();
      this.endGame(engine);
      return;
    }

    // building collision
    const buildings = this.world.buildingsInRange(this.bag.pos.x - 60, this.bag.pos.x + 60);
    for (const b of buildings) {
      const top = GROUND_Y - b.h;
      if (this.bag.pos.x + BAG_RADIUS > b.x && this.bag.pos.x - BAG_RADIUS < b.x + b.w && this.bag.pos.y + BAG_RADIUS > top) {
        engine.audio.thud();
        this.endGame(engine);
        return;
      }
    }

    // erratic flying
    if (this.bag.erraticEnergy > 0.85) {
      this.erraticHoldTime += dt;
      if (this.erraticHoldTime > 1.3) {
        this.endGame(engine);
        return;
      }
    } else {
      this.erraticHoldTime = Math.max(0, this.erraticHoldTime - dt * 2);
    }

    // ceiling / plane engine
    if (this.bag.pos.y < CEILING_Y) {
      this.ceilingHoldTime += dt;
      if (this.ceilingHoldTime > 0.6) {
        engine.audio.thud();
        this.endGame(engine);
        return;
      }
    } else {
      this.ceilingHoldTime = Math.max(0, this.ceilingHoldTime - dt * 2);
    }
  }

  render(engine: Engine): void {
    const { ctx, width, height } = engine;
    this.world.renderSky(engine);
    this.world.renderClouds(engine, 0.35);
    this.world.renderPlane(engine);
    this.world.renderBuildings(engine);
    this.world.renderGround(engine);
    this.world.renderRain(engine);

    const screen = engine.camera.worldToScreen(this.bag.pos);
    const skin = getSkin(engine.skinId);
    drawBag(ctx, screen.x, screen.y, this.bag.angle, 1.4, skin.colors, this.wobble);

    // altitude warning vignette
    if (this.bag.pos.y < WARNING_CEILING_Y) {
      const t = Math.min(1, (WARNING_CEILING_Y - this.bag.pos.y) / (WARNING_CEILING_Y - CEILING_Y));
      ctx.save();
      ctx.globalAlpha = 0.35 * t;
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(0, 0, width, 10);
      ctx.restore();
    }

    // erratic meter
    if (this.bag.erraticEnergy > 0.4) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#111';
      ctx.fillRect(width / 2 - 60, height - 34, 120, 10);
      ctx.fillStyle = this.bag.erraticEnergy > 0.85 ? '#ff4d4d' : '#ffd166';
      ctx.fillRect(width / 2 - 60, height - 34, 120 * this.bag.erraticEnergy, 10);
      ctx.restore();
    }
  }
}

export function combinedAxis(engine: Engine): { x: number; y: number } {
  const a = engine.input.getAxis('wasd');
  const b = engine.input.getAxis('arrows');
  const c = engine.input.getAxis('touch-a');
  let x = a.x || b.x || c.x;
  let y = a.y || b.y || c.y;
  x = Math.max(-1, Math.min(1, x));
  y = Math.max(-1, Math.min(1, y));
  return { x, y };
}
