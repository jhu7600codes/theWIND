import type { Engine, GameMode, ModeEvents } from '../engine/Engine.ts';
import { BAG_PARAMS, FlightBody } from '../engine/Physics.ts';
import { drawBag, getSkin } from '../entities/Bag.ts';
import { GROUND_Y, World } from '../entities/World.ts';
import { combinedAxis } from './NormalMode.ts';

const FINISH_X = 6400;

interface Beat {
  atX: number;
  text: string;
  shown: boolean;
}

function makeScript(): Beat[] {
  return [
    { atX: 40, text: "Whoosh — free! No more sitting in that dumpster.", shown: false },
    { atX: 700, text: "Is this... flying? I think this is flying.", shown: false },
    { atX: 1500, text: "Careful — updraft off that rooftop. Hold on to your handles.", shown: false },
    { atX: 2400, text: "Used to hold groceries. Now I just hold onto the sky.", shown: false },
    { atX: 3300, text: "Rain's coming. Don't tell anyone I get soggy, okay?", shown: false },
    { atX: 4200, text: "Somewhere out there, someone's looking for me. Not today.", shown: false },
    { atX: 5100, text: "I could get used to this. Endless, weightless, mine.", shown: false },
    { atX: 5900, text: "One more stretch. Let's stick the landing.", shown: false },
  ];
}

export class StoryMode implements GameMode {
  id = 'story';
  private world = new World();
  private bag = new FlightBody({ x: 0, y: 400 });
  private events: ModeEvents = {};
  private script: Beat[] = [];
  private activeText: string | null = null;
  private activeTimer = 0;
  private finished = false;
  private startTime = 0;
  private time = 0;
  private wobble = 0;

  init(engine: Engine, events: ModeEvents): void {
    this.events = events;
    this.world = new World(4242);
    this.world.buildingsEnabled = true;
    this.bag = new FlightBody({ x: 0, y: 400 });
    this.script = makeScript();
    this.activeText = null;
    this.finished = false;
    this.time = 0;
    this.startTime = performance.now();
    engine.weather.enabled = true;
    engine.camera.x = -engine.width * 0.38;
    engine.camera.y = this.bag.pos.y - engine.height * 0.5;
    events.onObjective?.(`Ride the wind to the end of the block, ${FINISH_X - 0}px away. The bag has thoughts.`);
    events.onDialogue?.(null);
    this.sayBeat(this.script[0]);
  }

  private sayBeat(beat: Beat | undefined): void {
    if (!beat || beat.shown) return;
    beat.shown = true;
    this.activeText = beat.text;
    this.activeTimer = 4.2;
    this.events.onDialogue?.(beat.text, 'Bag');
  }

  update(engine: Engine, dt: number): void {
    if (this.finished) return;
    this.time += dt;
    this.wobble += dt * 5;
    const axis = combinedAxis(engine);
    engine.weather.update(dt);
    engine.dayNight.update(dt);
    this.world.update(dt, engine, engine.camera.x);
    this.bag.update(dt, axis, engine.settings.sensitivity, engine.weather.gustVector, engine.weather.rainWeight, BAG_PARAMS, true);
    if (this.bag.pos.x < 0) this.bag.pos.x = 0;
    if (this.bag.pos.y + 17 >= GROUND_Y) {
      this.bag.pos.y = GROUND_Y - 17;
      this.bag.vel.y = -Math.abs(this.bag.vel.y) * 0.35;
    }

    engine.camera.follow(this.bag.pos, dt, { groundY: GROUND_Y });
    engine.audio.setWindIntensity(Math.min(1, Math.hypot(this.bag.vel.x, this.bag.vel.y) / 500));
    engine.audio.setRainIntensity(engine.weather.rainIntensity);
    engine.audio.tickPad(dt);

    for (const beat of this.script) {
      if (!beat.shown && this.bag.pos.x >= beat.atX) this.sayBeat(beat);
    }
    if (this.activeTimer > 0) {
      this.activeTimer -= dt;
      if (this.activeTimer <= 0) {
        this.activeText = null;
        this.events.onDialogue?.(null);
      }
    }

    this.events.onScoreUpdate?.(Math.min(100, (this.bag.pos.x / FINISH_X) * 100), 'progress');

    if (this.bag.pos.x >= FINISH_X && !this.finished) {
      this.finished = true;
      const elapsed = (performance.now() - this.startTime) / 1000;
      engine.audio.highScore();
      this.events.onDialogue?.('...and just like that, the wind carried me somewhere new. The End.', 'Bag');
      this.events.onGameOver?.(Math.max(1, 600 - elapsed));
    }
  }

  render(engine: Engine): void {
    const { ctx } = engine;
    this.world.renderSky(engine);
    this.world.renderClouds(engine, 0.35);
    this.world.renderPlane(engine);
    this.world.renderBuildings(engine);
    this.world.renderGround(engine);
    this.world.renderRain(engine);

    const screen = engine.camera.worldToScreen(this.bag.pos);
    const skin = getSkin(engine.skinId);
    drawBag(ctx, screen.x, screen.y, this.bag.angle, 1.4, skin.colors, this.wobble);

    if (this.activeText) {
      ctx.save();
      ctx.font = '14px "Segoe UI", sans-serif';
      const padding = 10;
      const maxWidth = 220;
      const words = this.activeText.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth && cur) {
          lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      const bw = maxWidth + padding * 2;
      const bh = lines.length * 18 + padding * 2;
      const bx = screen.x - bw / 2;
      const by = screen.y - 70 - bh;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 10);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(screen.x - 8, by + bh);
      ctx.lineTo(screen.x + 8, by + bh);
      ctx.lineTo(screen.x, by + bh + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#222';
      lines.forEach((line, i) => ctx.fillText(line, bx + padding, by + padding + 14 + i * 18));
      ctx.restore();
    }
  }
}
