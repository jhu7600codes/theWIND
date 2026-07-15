import type { Engine } from '../engine/Engine.ts';
import { seededRandom } from '../engine/Noise.ts';

export const GROUND_Y = 900;
export const CEILING_Y = -1650; // near-space: plane engine intake territory
export const WARNING_CEILING_Y = -1250;

const BUILDING_SEG = 240;
const CLOUD_SEG = 420;

interface Building {
  x: number;
  w: number;
  h: number;
  hue: number;
  windows: { x: number; y: number; lit: boolean }[];
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  puff: number;
}

interface Raindrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

export class World {
  buildingsEnabled = true;
  private buildingCache = new Map<number, Building>();
  private cloudCache = new Map<number, Cloud>();
  private rain: Raindrop[] = [];
  planeX = -99999;
  planeY = CEILING_Y - 80;
  planeDir = 1;
  private planeTimer = 6;
  seed: number;

  constructor(seed = 1337) {
    this.seed = seed;
  }

  private getBuilding(index: number): Building {
    let b = this.buildingCache.get(index);
    if (b) return b;
    const rand = seededRandom(this.seed + index * 97);
    const h = 120 + rand() * 420;
    const w = 90 + rand() * 90;
    const windows: Building['windows'] = [];
    const cols = Math.floor(w / 22);
    const rows = Math.floor(h / 28);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        windows.push({ x: 10 + c * 22, y: 14 + r * 28, lit: rand() > 0.6 });
      }
    }
    b = { x: index * BUILDING_SEG + rand() * 20, w, h, hue: 210 + rand() * 40, windows };
    this.buildingCache.set(index, b);
    return b;
  }

  private getCloud(index: number): Cloud {
    let c = this.cloudCache.get(index);
    if (c) return c;
    const rand = seededRandom(this.seed + 5000 + index * 53);
    c = { x: index * CLOUD_SEG + rand() * 120, y: -400 - rand() * 900, scale: 0.6 + rand() * 1.3, puff: rand() };
    this.cloudCache.set(index, c);
    return c;
  }

  buildingsInRange(minX: number, maxX: number): Building[] {
    if (!this.buildingsEnabled) return [];
    const startIdx = Math.floor(minX / BUILDING_SEG) - 1;
    const endIdx = Math.ceil(maxX / BUILDING_SEG) + 1;
    const out: Building[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const rand = seededRandom(this.seed + i * 97 + 1);
      if (rand() < 0.35) continue; // gap between buildings
      out.push(this.getBuilding(i));
    }
    return out;
  }

  update(dt: number, engine: Engine, camWorldX: number): void {
    // rain particles
    const target = Math.floor(engine.weather.rainIntensity * 220);
    while (this.rain.length < target) {
      this.rain.push({
        x: camWorldX + Math.random() * engine.width,
        y: -Math.random() * engine.height,
        len: 10 + Math.random() * 14,
        speed: 500 + Math.random() * 300,
      });
    }
    while (this.rain.length > target) this.rain.pop();
    for (const d of this.rain) {
      d.y += d.speed * dt;
      d.x += engine.weather.gustVector.x * 0.4 * dt;
      if (d.y > GROUND_Y + 40) {
        d.y = -20;
        d.x = camWorldX + Math.random() * engine.width;
      }
    }

    // occasional plane crossing near the ceiling
    this.planeTimer -= dt;
    if (this.planeTimer <= 0) {
      this.planeTimer = 14 + Math.random() * 18;
      this.planeDir = Math.random() > 0.5 ? 1 : -1;
      this.planeX = this.planeDir > 0 ? camWorldX - 400 : camWorldX + engine.width + 400;
      this.planeY = CEILING_Y - 40 - Math.random() * 260;
    }
    if (this.planeX > -99000) {
      this.planeX += this.planeDir * 260 * dt;
    }
  }

  renderSky(engine: Engine): void {
    const { ctx, width, height, dayNight } = engine;
    const sky = dayNight.sky;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    if (sky.stars > 0.02) {
      ctx.save();
      ctx.globalAlpha = sky.stars;
      ctx.fillStyle = '#fff';
      const rand = seededRandom(99);
      for (let i = 0; i < 80; i++) {
        const sx = rand() * width;
        const sy = rand() * height * 0.65;
        const tw = 0.6 + Math.sin(performance.now() * 0.002 + i) * 0.4;
        ctx.globalAlpha = sky.stars * tw;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();
    }
  }

  renderClouds(engine: Engine, parallax: number): void {
    const { ctx, camera, width } = engine;
    const camX = camera.x * parallax;
    const startIdx = Math.floor(camX / CLOUD_SEG) - 1;
    const endIdx = Math.ceil((camX + width) / CLOUD_SEG) + 1;
    ctx.save();
    ctx.fillStyle = engine.dayNight.isNight ? 'rgba(180,190,210,0.55)' : 'rgba(255,255,255,0.85)';
    for (let i = startIdx; i <= endIdx; i++) {
      const c = this.getCloud(i);
      const sx = c.x - camX;
      const sy = c.y - camera.y * parallax * 0.3 + 500;
      this.puff(ctx, sx, sy, c.scale);
    }
    ctx.restore();
  }

  private puff(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.beginPath();
    ctx.ellipse(x, y, 55 * scale, 26 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 40 * scale, y + 6 * scale, 40 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 40 * scale, y + 8 * scale, 38 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  renderGround(engine: Engine): void {
    const { ctx, camera, width } = engine;
    const groundScreenY = GROUND_Y - camera.y;
    if (groundScreenY > engine.height + 40 || groundScreenY < -40) return;
    ctx.save();
    ctx.fillStyle = engine.dayNight.isNight ? '#151a22' : '#39424d';
    ctx.fillRect(0, groundScreenY, width, Math.max(0, engine.height - groundScreenY));
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    const offset = camera.x % 60;
    for (let x = -offset; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, groundScreenY + 6);
      ctx.lineTo(x + 30, groundScreenY + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderBuildings(engine: Engine): void {
    if (!this.buildingsEnabled) return;
    const { ctx, camera, width } = engine;
    const buildings = this.buildingsInRange(camera.x - 100, camera.x + width + 100);
    const night = engine.dayNight.isNight;
    for (const b of buildings) {
      const sx = b.x - camera.x;
      const sy = GROUND_Y - b.h - camera.y;
      ctx.fillStyle = `hsl(${b.hue}, ${night ? 18 : 22}%, ${night ? 12 : 34}%)`;
      ctx.fillRect(sx, sy, b.w, GROUND_Y - camera.y - sy + 4);
      for (const win of b.windows) {
        ctx.fillStyle = win.lit && night ? '#ffd97a' : night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(sx + win.x, sy + win.y, 10, 14);
      }
    }
  }

  renderRain(engine: Engine): void {
    if (engine.weather.rainIntensity < 0.02) return;
    const { ctx, camera } = engine;
    ctx.save();
    ctx.strokeStyle = `rgba(190,210,240,${0.25 + engine.weather.rainIntensity * 0.35})`;
    ctx.lineWidth = 1.4;
    for (const d of this.rain) {
      const sx = d.x - camera.x;
      const sy = d.y - camera.y;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 3, sy + d.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderPlane(engine: Engine): void {
    if (this.planeX < -99000) return;
    const { ctx, camera } = engine;
    const sx = this.planeX - camera.x;
    const sy = this.planeY - camera.y;
    if (sx < -200 || sx > engine.width + 200) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(this.planeDir, 1);
    ctx.fillStyle = '#c7d2e0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 60, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-30, -26);
    ctx.lineTo(-14, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-70, 0, 30, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
