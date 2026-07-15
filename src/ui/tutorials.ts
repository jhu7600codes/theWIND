import type { ModeId } from '../types.ts';

export interface TutorialStep {
  title: string;
  body: string;
}

export const MODE_META: Record<ModeId, { title: string; blurb: string; icon: string }> = {
  normal: { title: 'Normal', blurb: 'Endless survival. Ride the wind, dodge the world.', icon: '🌬️' },
  freeroam: { title: 'Free Roam', blurb: 'No fails, no obstacles. Just chill flight.', icon: '☁️' },
  bird: { title: 'Bird Mode', blurb: 'Be the bird. Snatch bags from the sky.', icon: '🐦' },
  human: { title: 'Human Mode', blurb: 'Frame the bag, snap the shot, post it.', icon: '📷' },
  story: { title: 'Story Mode', blurb: 'A set path. The bag has something to say.', icon: '💬' },
  multiplayer: { title: 'Multiplayer', blurb: 'Local co-op — combined input, shared wind.', icon: '🎉' },
  bagparty: { title: 'Bag Party', blurb: 'One manager, many bags, one gust of wind.', icon: '🎈' },
};

export const TUTORIALS: Record<ModeId, TutorialStep[]> = {
  normal: [
    { title: 'You are the wind\'s passenger', body: 'Move with WASD, arrow keys, or a touch joystick. Pushing up catches more wind and lifts you; pushing down dives.' },
    { title: 'Stay out of trouble', body: "Touching the ground or a building ends the run. Flap around too erratically and you'll spook people below — also game over." },
    { title: "Don't fly too high", body: 'Climb too close to the clouds and you risk getting pulled into a passing plane engine. Watch the red warning bar.' },
    { title: 'Score', body: 'Score is distance survived. Weather (rain, gusts) makes it harder — and more fun.' },
  ],
  freeroam: [
    { title: 'Just drift', body: 'Same controls as Normal mode, but there are no buildings, no humans, no planes, and no way to lose. Pure chill flight.' },
  ],
  bird: [
    { title: 'You are the bird', body: 'Fly with WASD / arrows / touch joystick and chase the drifting paper bag.' },
    { title: 'Snatch it', body: 'Fly into the bag to catch it — a new one spawns immediately after. Keep the streak going!' },
  ],
  human: [
    { title: 'Aim your camera', body: 'Drag (mouse or touch) or use IJKL to pan your phone camera around the sky.' },
    { title: 'Frame the shot', body: 'Get the bag fully inside the viewfinder and hold the camera steady.' },
    { title: 'Snap it', body: 'Press SPACE or tap the shutter button to take the photo and post it.' },
  ],
  story: [
    { title: 'A set path', body: 'Fly the same way as Normal mode, but this time there\'s an end point — and the bag talks along the way.' },
    { title: 'Listen in', body: "Speech bubbles will pop up with the bag's thoughts as you pass through the level. Reach the end to finish the story." },
  ],
  multiplayer: [
    { title: 'Everyone flies together', body: "Each player picks up a control scheme (WASD / Arrows / IJKL / Numpad) on the same keyboard." },
    { title: 'One shared wind', body: 'All inputs combine into a single wind force — the whole flock of bags drifts diagonally together. Coordinate with your friends!' },
  ],
  bagparty: [
    { title: 'One manager, many bags', body: 'Player 1 (WASD) is the wind manager — their input alone generates the gust that pushes everyone.' },
    { title: 'Everyone else flies', body: 'The remaining players (Arrows / IJKL / Numpad) each steer their own bag, riding the wind the manager creates.' },
    { title: 'Idle drift', body: "When the manager isn't blowing, bags drift gently on their own. Party mode, chill and chaotic." },
  ],
};
