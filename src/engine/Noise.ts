/** Small deterministic-ish value-noise helper (no deps). */
export class ValueNoise {
  private seed: number;
  constructor(seed = Math.random() * 10000) {
    this.seed = seed;
  }
  private hash(n: number): number {
    const s = Math.sin(n * 12.9898 + this.seed) * 43758.5453;
    return s - Math.floor(s);
  }
  /** Smooth 1D noise in [0,1] sampled at time t. */
  sample(t: number): number {
    const i = Math.floor(t);
    const f = t - i;
    const a = this.hash(i);
    const b = this.hash(i + 1);
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
}

/** Integer bit-mixing hash (avalanches fully, unlike one LCG step) — used to
 *  scramble arithmetic-progression seeds like `base + i * 97` before they
 *  feed the LCG below, since consecutive raw seeds would otherwise produce
 *  near-linear (badly correlated) first outputs. */
function hashInt(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

export function seededRandom(seed: number): () => number {
  let s = hashInt(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
