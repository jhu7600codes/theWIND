import type { ControlScheme, Vec2 } from '../types.ts';

const SCHEME_KEYS: Record<Exclude<ControlScheme, `touch-${string}`>, { up: string[]; down: string[]; left: string[]; right: string[] }> = {
  wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
  arrows: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] },
  ijkl: { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'] },
  numpad: { up: ['Numpad8'], down: ['Numpad5', 'Numpad2'], left: ['Numpad4'], right: ['Numpad6'] },
};

interface TouchZone {
  id: number;
  curX: number;
  curY: number;
}

/** Column boundaries as a fraction of screen width: edges are narrow dedicated
 *  left/right zones, the wide middle column is split top/bottom for up/down. */
const COL_LEFT_EDGE = 1 / 6;
const COL_RIGHT_EDGE = 5 / 6;

export class InputManager {
  private keys = new Set<string>();
  private keysPressedEdge = new Set<string>();
  private touch: TouchZone | null = null;
  private mouseDown = false;
  private mouseDelta: Vec2 = { x: 0, y: 0 };
  private lastMouse: Vec2 | null = null;
  public touchActive = false;

  constructor(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.keysPressedEdge.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch = null;
      this.touchActive = false;
    });

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        if (!this.touch) {
          this.touch = { id: e.pointerId, curX: e.clientX, curY: e.clientY };
          this.touchActive = true;
        }
      } else {
        this.mouseDown = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (this.touch && e.pointerId === this.touch.id) {
        this.mouseDelta.x += e.clientX - this.touch.curX;
        this.mouseDelta.y += e.clientY - this.touch.curY;
        this.touch.curX = e.clientX;
        this.touch.curY = e.clientY;
      }
      if (this.mouseDown && this.lastMouse) {
        this.mouseDelta.x += e.clientX - this.lastMouse.x;
        this.mouseDelta.y += e.clientY - this.lastMouse.y;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    const clear = (e: PointerEvent) => {
      if (this.touch && e.pointerId === this.touch.id) {
        this.touch = null;
        this.touchActive = false;
      }
      if (e.pointerType !== 'touch') this.mouseDown = false;
    };
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Movement axis for a given control scheme, combining keyboard + (for touch-a) the held touch zone. -1..1 per axis. */
  getAxis(scheme: ControlScheme): Vec2 {
    if (scheme.startsWith('touch')) {
      const zone = this.touchZoneActive;
      if (!zone) return { x: 0, y: 0 };
      if (zone.col === 0) return { x: -1, y: 0 };
      if (zone.col === 2) return { x: 1, y: 0 };
      return { x: 0, y: zone.row === 0 ? -1 : 1 };
    }
    const map = SCHEME_KEYS[scheme as Exclude<ControlScheme, `touch-${string}`>];
    if (!map) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (map.left.some((k) => this.keys.has(k))) x -= 1;
    if (map.right.some((k) => this.keys.has(k))) x += 1;
    if (map.up.some((k) => this.keys.has(k))) y -= 1;
    if (map.down.some((k) => this.keys.has(k))) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  /** Free-look delta since last call (mouse drag, or touch drag — for modes that don't use the movement touch zones, like Human Mode's camera aim), resets each read. */
  consumeAim(): Vec2 {
    const d = this.mouseDelta;
    this.mouseDelta = { x: 0, y: 0 };
    return d;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Programmatically trigger a one-frame "just pressed" edge (e.g. from a touch button). */
  simulatePress(code: string): void {
    this.keysPressedEdge.add(code);
  }

  wasPressed(code: string): boolean {
    if (this.keysPressedEdge.has(code)) {
      this.keysPressedEdge.delete(code);
      return true;
    }
    return false;
  }

  /**
   * Which movement touch zone is currently held, or null if none. The screen
   * tiles into 3 columns x 2 rows: the narrow left/right edge columns are
   * each one dedicated zone (bank left / bank right, either row), and the
   * wide middle column splits top/bottom into up/down. Recomputed live from
   * the touch's current position, so sliding across zones updates it.
   */
  get touchZoneActive(): { col: 0 | 1 | 2; row: 0 | 1 } | null {
    if (!this.touch) return null;
    const w = window.innerWidth;
    const col = this.touch.curX < w * COL_LEFT_EDGE ? 0 : this.touch.curX > w * COL_RIGHT_EDGE ? 2 : 1;
    const row = this.touch.curY < window.innerHeight / 2 ? 0 : 1;
    return { col, row };
  }

  endFrame(): void {
    this.keysPressedEdge.clear();
  }
}
