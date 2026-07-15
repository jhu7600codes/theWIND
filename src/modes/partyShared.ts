import type { ControlScheme } from '../types.ts';
import { SKINS } from '../types.ts';

export const PLAYER_SCHEMES: ControlScheme[] = ['wasd', 'arrows', 'ijkl', 'numpad'];
export const PLAYER_SCHEME_LABELS: Record<string, string> = {
  wasd: 'WASD',
  arrows: 'Arrow Keys',
  ijkl: 'IJKL',
  numpad: 'Numpad 8456',
};

export function playerColors(index: number): { main: string; shade: string; trim: string } {
  const base = SKINS[index % SKINS.length];
  return base.colors;
}

export const GROUND_BOUNCE_Y = 900;
