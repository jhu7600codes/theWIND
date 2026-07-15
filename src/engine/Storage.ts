import { DEFAULT_SETTINGS, type Leaderboard, type Settings } from '../types.ts';

const NS = 'thewind:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return parsed as T;
    if (fallback && typeof fallback === 'object') return { ...(fallback as object), ...(parsed as object) } as T;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode etc) — fail silently
  }
}

export function loadSettings(): Settings {
  return read('settings', DEFAULT_SETTINGS);
}

export function saveSettings(s: Settings): void {
  write('settings', s);
}

export function loadLeaderboard(): Leaderboard {
  return read('scores', {} as Leaderboard);
}

export function submitScore(mode: string, score: number): { isHighScore: boolean; board: Leaderboard } {
  const board = loadLeaderboard();
  const list = board[mode] ?? [];
  list.push({ score: Math.round(score), date: new Date().toISOString() });
  list.sort((a, b) => b.score - a.score);
  board[mode] = list.slice(0, 10);
  write('scores', board);
  const isHighScore = board[mode][0]?.score === Math.round(score) && list.length > 0;
  return { isHighScore, board };
}

export function loadUnlocks(): Set<string> {
  return new Set(read<string[]>('unlocks', ['kraft', 'bodega']));
}

export function saveUnlocks(unlocks: Set<string>): void {
  write('unlocks', Array.from(unlocks));
}

export function loadSelectedSkin(): string {
  return read<{ id: string }>('skin', { id: 'kraft' }).id;
}

export function saveSelectedSkin(id: string): void {
  write('skin', { id });
}

export function loadFlag(key: string): boolean {
  return read<{ v: boolean }>('flag:' + key, { v: false }).v;
}

export function saveFlag(key: string, value: boolean): void {
  write('flag:' + key, { v: value });
}
