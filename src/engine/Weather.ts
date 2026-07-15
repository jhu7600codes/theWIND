import { ValueNoise } from './Noise.ts';

export type WeatherKind = 'clear' | 'breezy' | 'gusty' | 'rain';

export class WeatherSystem {
  time = 0;
  private gustNoise = new ValueNoise(11);
  private rainNoise = new ValueNoise(77);
  gustVector = { x: 0, y: 0 };
  rainIntensity = 0;
  kind: WeatherKind = 'clear';
  enabled = true;

  update(dt: number): void {
    this.time += dt;
    if (!this.enabled) {
      this.gustVector = { x: 0, y: 0 };
      this.rainIntensity = 0;
      return;
    }
    const g = this.gustNoise.sample(this.time * 0.08);
    const gustStrength = Math.max(0, g - 0.55) * 3.2;
    this.gustVector = {
      x: gustStrength * (Math.sin(this.time * 0.3) * 0.5 + 0.9) * 55,
      y: Math.sin(this.time * 0.5) * gustStrength * 12,
    };

    const r = this.rainNoise.sample(this.time * 0.02);
    this.rainIntensity = Math.max(0, r - 0.62) * 2.6;
    this.rainIntensity = Math.min(1, this.rainIntensity);

    if (this.rainIntensity > 0.08) this.kind = 'rain';
    else if (gustStrength > 0.5) this.kind = 'gusty';
    else if (gustStrength > 0.15) this.kind = 'breezy';
    else this.kind = 'clear';
  }

  /** Extra downward weight from rain soaking the paper bag. */
  get rainWeight(): number {
    return this.rainIntensity * 55;
  }
}
