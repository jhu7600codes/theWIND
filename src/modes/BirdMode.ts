import type { Engine, GameMode, ModeEvents } from '../engine/Engine.ts';
import { BAG_PARAMS, BIRD_PARAMS, FlightBody } from '../engine/Physics.ts';
import { drawBag, getSkin } from '../entities/Bag.ts';
import { drawBird } from '../entities/Bird.ts';
import { World } from '../entities/World.ts';
import { combinedAxis } from './NormalMode.ts';

const CATCH_DIST = 34;

export class BirdMode implements GameMode {
  id = 'bird';
  private world = new World();
  private bird = new FlightBody({ x: 0, y: 200 });
  private target = new FlightBody({ x: 300, y: 150 });
  private events: ModeEvents = {};
  private caught = 0;
  private flapPhase = 0;
  private holding = false;
  private holdTimer = 0;
  private wobble = 0;

  init(engine: Engine, events: ModeEvents): void {
    this.events = events;
    this.world = new World(Date.now() % 100000);
    this.world.buildingsEnabled = false;
    this.bird = new FlightBody({ x: 0, y: 150 });
    this.spawnTarget(engine);
    this.caught = 0;
    engine.weather.enabled = true;
    engine.camera.x = -engine.width * 0.38;
    engine.camera.y = this.bird.pos.y - engine.height * 0.5;
    events.onObjective?.('Catch the drifting bag. Fly into it!');
    events.onScoreUpdate?.(0, 'catches');
  }

  private spawnTarget(engine: Engine): void {
    const ang = Math.random() * Math.PI * 2;
    const dist = 260 + Math.random() * 160;
    this.target = new FlightBody({
      x: this.bird.pos.x + Math.cos(ang) * dist,
      y: this.bird.pos.y + Math.sin(ang) * dist - 60,
    });
    this.target.vel = { x: 40 + Math.random() * 60, y: (Math.random() - 0.5) * 40 };
    void engine;
  }

  update(engine: Engine, dt: number): void {
    this.flapPhase += dt * 10;
    this.wobble += dt * 5;
    const axis = combinedAxis(engine);
    engine.weather.update(dt);
    engine.dayNight.update(dt);
    this.world.update(dt, engine, engine.camera.x);

    this.bird.update(dt, axis, engine.settings.sensitivity * 1.1, engine.weather.gustVector, 0, BIRD_PARAMS, false);

    if (this.holding) {
      this.holdTimer -= dt;
      this.target.pos.x = this.bird.pos.x;
      this.target.pos.y = this.bird.pos.y + 18;
      if (this.holdTimer <= 0) {
        this.holding = false;
        this.spawnTarget(engine);
      }
    } else {
      const flutter = { x: 0, y: Math.sin(performance.now() * 0.002 + this.target.pos.x) * 0.6 };
      this.target.update(dt, flutter, 1, engine.weather.gustVector, engine.weather.rainWeight * 0.3, BAG_PARAMS, false);
      if (this.target.pos.y + 17 > 880) {
        this.target.pos.y = 880 - 17;
        this.target.vel.y *= -0.3;
      }

      const dx = this.bird.pos.x - this.target.pos.x;
      const dy = this.bird.pos.y - this.target.pos.y;
      if (Math.hypot(dx, dy) < CATCH_DIST) {
        this.caught++;
        this.holding = true;
        this.holdTimer = 0.35;
        engine.audio.catchPop();
        this.events.onScoreUpdate?.(this.caught, 'catches');
      }
    }

    if (Math.random() < dt * 8 && Math.hypot(this.bird.vel.x, this.bird.vel.y) > 200) engine.audio.flap();

    engine.camera.follow(this.bird.pos, dt, { smoothing: 3.5 });
    engine.audio.setWindIntensity(Math.min(1, Math.hypot(this.bird.vel.x, this.bird.vel.y) / 500));
    engine.audio.setRainIntensity(engine.weather.rainIntensity);
    engine.audio.tickPad(dt);
  }

  render(engine: Engine): void {
    const { ctx } = engine;
    this.world.renderSky(engine);
    this.world.renderClouds(engine, 0.4);
    this.world.renderRain(engine);

    const targetScreen = engine.camera.worldToScreen(this.target.pos);
    if (!this.holding) {
      const skin = getSkin(engine.skinId);
      drawBag(ctx, targetScreen.x, targetScreen.y, this.target.angle, 1.1, skin.colors, this.wobble);
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.006) * 0.3;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(targetScreen.x, targetScreen.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const birdScreen = engine.camera.worldToScreen(this.bird.pos);
    drawBird(ctx, birdScreen.x, birdScreen.y, this.bird.angle, this.flapPhase, this.holding);
  }
}
