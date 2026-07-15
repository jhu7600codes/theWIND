import type { Vec2 } from '../types.ts';

export interface FlightParams {
  gravity: number; // downward accel, px/s^2
  drag: number; // 0..1 velocity damping per second
  liftGain: number; // upward accel from holding "up"
  sideGain: number; // horizontal accel from left/right input
  maxSpeed: number;
}

export const BAG_PARAMS: FlightParams = {
  gravity: 70,
  drag: 0.9,
  liftGain: 260,
  sideGain: 220,
  maxSpeed: 620,
};

export const BIRD_PARAMS: FlightParams = {
  gravity: 40,
  drag: 1.6,
  liftGain: 340,
  sideGain: 320,
  maxSpeed: 720,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class FlightBody {
  vel: Vec2 = { x: 0, y: 0 };
  angle = 0;
  angularVel = 0;
  erraticEnergy = 0;
  private prevAxis: Vec2 = { x: 0, y: 0 };
  pos: Vec2;

  constructor(pos: Vec2) {
    this.pos = pos;
  }

  update(
    dt: number,
    axis: Vec2,
    sensitivity: number,
    wind: Vec2,
    rainWeight: number,
    params: FlightParams,
    trackErratic = true,
  ): void {
    const liftInput = Math.max(0, -axis.y) * params.liftGain * sensitivity;
    const diveAssist = Math.max(0, axis.y) * params.gravity * 1.4;

    const ax = axis.x * params.sideGain * sensitivity + wind.x;
    const ay = params.gravity + rainWeight + diveAssist - liftInput + wind.y;

    this.vel.x += ax * dt;
    this.vel.y += ay * dt;

    const dragFactor = Math.max(0, 1 - params.drag * dt);
    this.vel.x *= dragFactor;
    this.vel.y *= dragFactor;

    const speed = Math.hypot(this.vel.x, this.vel.y);
    if (speed > params.maxSpeed) {
      const s = params.maxSpeed / speed;
      this.vel.x *= s;
      this.vel.y *= s;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    const targetAngle = clamp(this.vel.x * 0.0009 - this.vel.y * 0.0016, -0.9, 0.9);
    const wobble = trackErratic ? Math.sin(performance.now() * 0.006) * this.erraticEnergy * 0.5 : 0;
    this.angularVel = (targetAngle + wobble - this.angle) * 6;
    this.angle += this.angularVel * dt;

    if (trackErratic) {
      const jerk = Math.hypot(axis.x - this.prevAxis.x, axis.y - this.prevAxis.y);
      const rising = jerk > 1.1 ? jerk * 0.55 : -0.7 * dt;
      this.erraticEnergy = clamp(this.erraticEnergy + rising * dt * 4, 0, 1);
      this.prevAxis = { x: axis.x, y: axis.y };
    }
  }
}
