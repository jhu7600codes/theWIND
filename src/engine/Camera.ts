import type { Vec2 } from '../types.ts';

export class Camera {
  x = 0;
  y = 0;
  width = 800;
  height = 600;

  follow(target: Vec2, dt: number, opts: { leadX?: number; smoothing?: number; groundY?: number } = {}): void {
    const smoothing = opts.smoothing ?? 4.5;
    const leadX = opts.leadX ?? 120;
    const targetX = target.x - this.width * 0.38 + leadX;
    let targetY = target.y - this.height * 0.5;
    if (opts.groundY !== undefined) {
      targetY = Math.min(targetY, opts.groundY - this.height * 0.72);
    }
    const t = 1 - Math.exp(-smoothing * dt);
    this.x += (targetX - this.x) * t;
    this.y += (targetY - this.y) * t;
  }

  worldToScreen(p: Vec2): Vec2 {
    return { x: p.x - this.x, y: p.y - this.y };
  }
}
