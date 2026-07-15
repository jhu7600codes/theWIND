interface Keyframe {
  t: number; // 0..1 through the day
  top: [number, number, number];
  bottom: [number, number, number];
  light: number; // 0..1 ambient brightness
  stars: number; // 0..1 star opacity
}

const KEYFRAMES: Keyframe[] = [
  { t: 0.0, top: [10, 12, 30], bottom: [30, 26, 55], light: 0.25, stars: 0.9 }, // deep night
  { t: 0.2, top: [40, 40, 80], bottom: [230, 140, 110], light: 0.55, stars: 0.15 }, // dawn
  { t: 0.32, top: [110, 170, 230], bottom: [250, 210, 170], light: 0.85, stars: 0 }, // sunrise
  { t: 0.5, top: [95, 175, 235], bottom: [200, 225, 235], light: 1, stars: 0 }, // noon
  { t: 0.68, top: [110, 170, 230], bottom: [250, 210, 170], light: 0.85, stars: 0 }, // afternoon
  { t: 0.82, top: [60, 45, 90], bottom: [240, 120, 90], light: 0.5, stars: 0.2 }, // dusk
  { t: 0.92, top: [16, 16, 40], bottom: [60, 35, 70], light: 0.3, stars: 0.7 }, // late dusk
  { t: 1.0, top: [10, 12, 30], bottom: [30, 26, 55], light: 0.25, stars: 0.9 }, // deep night
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

export class DayNightCycle {
  /** full cycle length in seconds */
  cycleLength = 240;
  time = 0.28; // start mid-morning
  frozen = false;

  update(dt: number): void {
    if (this.frozen) return;
    this.time = (this.time + dt / this.cycleLength) % 1;
  }

  private frame(): { top: string; bottom: string; light: number; stars: number } {
    const t = this.time;
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      const a = KEYFRAMES[i];
      const b = KEYFRAMES[i + 1];
      if (t >= a.t && t <= b.t) {
        const localT = (t - a.t) / (b.t - a.t);
        return {
          top: lerpColor(a.top, b.top, localT),
          bottom: lerpColor(a.bottom, b.bottom, localT),
          light: lerp(a.light, b.light, localT),
          stars: lerp(a.stars, b.stars, localT),
        };
      }
    }
    const last = KEYFRAMES[KEYFRAMES.length - 1];
    return { top: lerpColor(last.top, last.top, 0), bottom: lerpColor(last.bottom, last.bottom, 0), light: last.light, stars: last.stars };
  }

  get sky(): { top: string; bottom: string; light: number; stars: number } {
    return this.frame();
  }

  get isNight(): boolean {
    return this.time < 0.16 || this.time > 0.86;
  }

  get label(): string {
    const t = this.time;
    if (t < 0.16 || t > 0.92) return 'Night';
    if (t < 0.32) return 'Dawn';
    if (t < 0.68) return 'Day';
    if (t < 0.86) return 'Dusk';
    return 'Night';
  }
}
