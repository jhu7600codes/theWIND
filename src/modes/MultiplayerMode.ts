import type { Engine, GameMode, ModeEvents } from '../engine/Engine.ts';
import { BAG_PARAMS, FlightBody } from '../engine/Physics.ts';
import { drawBag } from '../entities/Bag.ts';
import { World } from '../entities/World.ts';
import { GROUND_BOUNCE_Y, PLAYER_SCHEMES, playerColors } from './partyShared.ts';

export class MultiplayerMode implements GameMode {
  id = 'multiplayer';
  private world = new World();
  private bags: FlightBody[] = [];
  private events: ModeEvents = {};
  private time = 0;
  private wobble = 0;

  private playerCount: number;

  constructor(playerCount: number = 2) {
    this.playerCount = playerCount;
  }

  init(engine: Engine, events: ModeEvents): void {
    this.events = events;
    this.world = new World(555);
    this.world.buildingsEnabled = false;
    this.bags = [];
    for (let i = 0; i < this.playerCount; i++) {
      this.bags.push(new FlightBody({ x: (i - (this.playerCount - 1) / 2) * 70, y: 300 + (i % 2) * 30 }));
    }
    this.time = 0;
    engine.weather.enabled = true;
    engine.camera.x = -engine.width * 0.5;
    engine.camera.y = 300 - engine.height * 0.5;
    events.onObjective?.(
      `${this.playerCount} players share one keyboard: ${PLAYER_SCHEMES.slice(0, this.playerCount)
        .map((s) => s.toUpperCase())
        .join(' · ')}. Everyone's input blends into one shared wind — the whole flock drifts together.`,
    );
    events.onScoreUpdate?.(0, 'distance');
  }

  update(engine: Engine, dt: number): void {
    this.time += dt;
    this.wobble += dt * 5;
    engine.weather.update(dt);
    engine.dayNight.update(dt);
    this.world.update(dt, engine, engine.camera.x);

    let sx = 0;
    let sy = 0;
    for (let i = 0; i < this.playerCount; i++) {
      const a = engine.input.getAxis(PLAYER_SCHEMES[i]);
      sx += a.x;
      sy += a.y;
    }
    const mag = Math.hypot(sx, sy);
    if (mag > 1) {
      sx /= mag;
      sy /= mag;
    }
    const wind = {
      x: sx * 340 + engine.weather.gustVector.x,
      y: sy * 220 + engine.weather.gustVector.y,
    };

    let cx = 0;
    let cy = 0;
    this.bags.forEach((bag, i) => {
      const jitter = {
        x: Math.sin(this.time * 1.3 + i * 12.4) * 14,
        y: Math.cos(this.time * 1.1 + i * 7.1) * 10,
      };
      bag.update(dt, { x: 0, y: 0 }, engine.settings.sensitivity, { x: wind.x + jitter.x, y: wind.y + jitter.y }, engine.weather.rainWeight, BAG_PARAMS, false);
      if (bag.pos.y + 17 > GROUND_BOUNCE_Y) {
        bag.pos.y = GROUND_BOUNCE_Y - 17;
        bag.vel.y = -Math.abs(bag.vel.y) * 0.4;
      }
      if (bag.pos.y < -1400) bag.pos.y = -1400;
      cx += bag.pos.x;
      cy += bag.pos.y;
    });
    cx /= this.bags.length;
    cy /= this.bags.length;

    engine.camera.follow({ x: cx, y: cy }, dt, { smoothing: 2.4 });
    engine.audio.setWindIntensity(Math.min(1, mag));
    engine.audio.setRainIntensity(engine.weather.rainIntensity);
    engine.audio.tickPad(dt);
    this.events.onScoreUpdate?.(Math.max(0, cx / 10), 'distance');
  }

  render(engine: Engine): void {
    const { ctx } = engine;
    this.world.renderSky(engine);
    this.world.renderClouds(engine, 0.4);
    this.world.renderRain(engine);

    this.bags.forEach((bag, i) => {
      const screen = engine.camera.worldToScreen(bag.pos);
      drawBag(ctx, screen.x, screen.y, bag.angle, 1.25, playerColors(i), this.wobble + i);
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillText(`P${i + 1}`, screen.x, screen.y - 36);
      ctx.restore();
    });
  }
}
