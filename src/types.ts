export interface Vec2 {
  x: number;
  y: number;
}

export type ControlScheme = 'wasd' | 'arrows' | 'ijkl' | 'numpad' | 'touch-a' | 'touch-b' | 'touch-c' | 'touch-d';

export type ModeId =
  | 'normal'
  | 'freeroam'
  | 'bird'
  | 'human'
  | 'story'
  | 'multiplayer'
  | 'bagparty';

export interface Settings {
  sensitivity: number; // 0.4 - 2.0
  volume: number; // 0 - 1
  muted: boolean;
  reducedMotion: boolean;
  showTutorials: boolean;
}

export interface ScoreEntry {
  score: number;
  date: string;
}

export type Leaderboard = Record<string, ScoreEntry[]>;

export interface SkinDef {
  id: string;
  name: string;
  unlockScore: number;
  colors: { main: string; shade: string; trim: string };
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  volume: 0.7,
  muted: false,
  reducedMotion: false,
  showTutorials: true,
};

export const SKINS: SkinDef[] = [
  { id: 'kraft', name: 'Kraft Classic', unlockScore: 0, colors: { main: '#e8c78a', shade: '#d9b06e', trim: '#8a6a3a' } },
  { id: 'bodega', name: 'Bodega White', unlockScore: 0, colors: { main: '#f2f2ea', shade: '#d8d8cd', trim: '#9a9a8c' } },
  { id: 'sunset', name: 'Sunset Grocer', unlockScore: 300, colors: { main: '#f2a65a', shade: '#e0793f', trim: '#7a3d1c' } },
  { id: 'mint', name: 'Mint Market', unlockScore: 800, colors: { main: '#a8e6cf', shade: '#7fcfae', trim: '#2f6b52' } },
  { id: 'midnight', name: 'Midnight Run', unlockScore: 1500, colors: { main: '#5b6ee1', shade: '#3f4db8', trim: '#22265c' } },
  { id: 'holo', name: 'Holo Foil', unlockScore: 3000, colors: { main: '#e0aaff', shade: '#c084fc', trim: '#6d28d9' } },
];
