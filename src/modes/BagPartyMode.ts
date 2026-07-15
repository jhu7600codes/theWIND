import type { Engine, GameMode, ModeEvents } from '../engine/Engine.ts';
import { BAG_PARAMS, FlightBody } from '../engine/Physics.ts';
import { ValueNoise } from '../engine/Noise.ts';
import { drawBag } from '../entities/Bag.ts';
import { World } from '../entities/World.ts';
import { GROUND_BOUNCE_Y, PLAYER_SCHEMES, playerColors } from './partyShared.ts';

export class BagPartyMode implements GameMode {
  id = 'bagparty';
  private world = new World();
  private bags: FlightBody[] = [];
  private events: ModeEvents = {};
  private time = 0;
  private wobble = 0;
  private driftNoiseX: ValueNoise[] = [];
  private driftNoiseY: ValueNoise[] = [];
  private managerMag = 0;
  private managerAngle = 0;

  private playerCount: number;

  /** total participants including the manager (2..4) */
  constructor(playerCount: number = 3) {
    this.playerCount = playerCount;
  }

  init(engine: Engine, events: ModeEvents): void {
    this.events = events;
    this.world = new World(9911);
    this.world.buildingsEnabled = false;
    const bagPlayers = Math.max(1, this.playerCount - 1);
    this.bags = [];
    this.driftNoiseX = [];
    this.driftNoiseY = [];
    for (let i = 0; i < bagPlayers; i++) {
      this.bags.push(new FlightBody({ x: (i - (bagPlayers - 1) / 2) * 90, y: 320 }));
      this.driftNoiseX.push(new ValueNoise(i * 31 + 1));
      this.driftNoiseY.push(new ValueNoise(i * 47 + 2));
    }
    this.time = 0;
    engine.weather.enabled = true;
    engine.camera.x = -engine.width * 0.5;
    engine.camera.y = 300 - engine.height * 0.5;
    const managerScheme = PLAYER_SCHEMES[0].toUpperCase();
    const bagSchemes = PLAYER_SCHEMES.slice(1, 1 + bagPlayers)
      .map((s) => s.toUpperCase())
      .join(' · ');
    events.onObjective?.(`Manager (${managerScheme}) blows the wind. Everyone else (${bagSchemes}) steers their own bag through it.`);
    events.onScoreUpdate?.(0, 'time');
  }

  update(engine: Engine, dt: number): void {
    this.time += dt;
    this.wobble += dt * 5;
    engine.weather.update(dt);
    engine.dayNight.update(dt);
    this.world.update(dt, engine, engine.camera.x);

    const managerAxis = engine.input.getAxis(PLAYER_SCHEMES[0]);
    this.managerMag = Math.hypot(managerAxis.x, managerAxis.y);
    this.managerAngle = Math.atan2(managerAxis.y, managerAxis.x);
    const sharedWind = {
      x: managerAxis.x * 300 + engine.weather.gustVector.x,
      y: managerAxis.y * 200 + engine.weather.gustVector.y,
    };
    const idle = this.managerMag < 0.12;

    let cx = 0;
    let cy = 0;
    this.bags.forEach((bag, i) => {
      const axis = engine.input.getAxis(PLAYER_SCHEMES[i + 1]);
      const drift = idle
        ? { x: (this.driftNoiseX[i].sample(this.time * 0.3) - 0.5) * 70, y: (this.driftNoiseY[i].sample(this.time * 0.3) - 0.5) * 50 }
        : { x: 0, y: 0 };
      const wind = { x: sharedWind.x + drift.x, y: sharedWind.y + drift.y };
      bag.update(dt, axis, engine.settings.sensitivity, wind, engine.weather.rainWeight, BAG_PARAMS, false);
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
    engine.audio.setWindIntensity(Math.min(1, this.managerMag + 0.15));
    engine.audio.setRainIntensity(engine.weather.rainIntensity);
    engine.audio.tickPad(dt);
    this.events.onScoreUpdate?.(this.time, 'time');
  }

  render(engine: Engine): void {
    const { ctx, width, height } = engine;
    this.world.renderSky(engine);
    this.world.renderClouds(engine, 0.4);
    this.world.renderRain(engine);

    this.bags.forEach((bag, i) => {
      const screen = engine.camera.worldToScreen(bag.pos);
      drawBag(ctx, screen.x, screen.y, bag.angle, 1.25, playerColors(i + 1), this.wobble + i);
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillText(`P${i + 2}`, screen.x, screen.y - 36);
      ctx.restore();
    });

    // manager wind-fan HUD
    ctx.save();
    const fx = width / 2;
    const fy = height - 54;
    ctx.translate(fx, fy);
    ctx.rotate(this.managerAngle);
    ctx.fillStyle = `rgba(120,190,255,${0.35 + this.managerMag * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 26 + this.managerMag * 18, -0.5, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P1 · WIND', fx, fy + 44);
    ctx.restore();
  }
}
