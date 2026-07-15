import type { Engine, GameMode, ModeEvents } from '../engine/Engine.ts';
import { BAG_PARAMS, FlightBody } from '../engine/Physics.ts';
import { drawBag, getSkin } from '../entities/Bag.ts';
import { World } from '../entities/World.ts';
import { combinedAxis } from './NormalMode.ts';

export class FreeRoamMode implements GameMode {
  id = 'freeroam';
  private world = new World();
  private bag = new FlightBody({ x: 0, y: 200 });
  private events: ModeEvents = {};
  private time = 0;
  private wobble = 0;

  init(engine: Engine, events: ModeEvents): void {
    this.events = events;
    this.world = new World(Date.now() % 100000);
    this.world.buildingsEnabled = false;
    this.bag = new FlightBody({ x: 0, y: 200 });
    this.time = 0;
    engine.weather.enabled = true;
    engine.camera.x = -engine.width * 0.38;
    engine.camera.y = this.bag.pos.y - engine.height * 0.5;
    events.onObjective?.('No fails, no rush. Just drift.');
  }

  update(engine: Engine, dt: number): void {
    this.time += dt;
    this.wobble += dt * 4;
    const axis = combinedAxis(engine);
    engine.weather.update(dt);
    engine.dayNight.update(dt);
    this.world.update(dt, engine, engine.camera.x);
    this.bag.update(dt, axis, engine.settings.sensitivity, engine.weather.gustVector, engine.weather.rainWeight, BAG_PARAMS, false);
    engine.camera.follow(this.bag.pos, dt, { smoothing: 2.6 });
    engine.audio.setWindIntensity(Math.min(1, Math.hypot(this.bag.vel.x, this.bag.vel.y) / 500));
    engine.audio.setRainIntensity(engine.weather.rainIntensity);
    engine.audio.tickPad(dt);
    this.events.onScoreUpdate?.(this.time, 'time');
  }

  render(engine: Engine): void {
    const { ctx } = engine;
    this.world.renderSky(engine);
    this.world.renderClouds(engine, 0.5);
    this.world.renderClouds(engine, 0.25);
    this.world.renderRain(engine);
    const screen = engine.camera.worldToScreen(this.bag.pos);
    const skin = getSkin(engine.skinId);
    drawBag(ctx, screen.x, screen.y, this.bag.angle, 1.5, skin.colors, this.wobble);
  }
}
