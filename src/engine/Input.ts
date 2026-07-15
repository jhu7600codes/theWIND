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

export class InputManager {
  private keys = new Set<string>();
  private keysPressedEdge = new Set<string>();
  private touch: TouchZone | null = null;
  private aimTouch: TouchZone | null = null;
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
      this.aimTouch = null;
      this.touchActive = false;
    });

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        const half = e.clientX < window.innerWidth / 2;
        const zone: TouchZone = { id: e.pointerId, curX: e.clientX, curY: e.clientY };
        if (half && !this.touch) {
          this.touch = zone;
          this.touchActive = true;
        } else if (!this.aimTouch) {
          this.aimTouch = zone;
        }
      } else {
        this.mouseDown = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (this.touch && e.pointerId === this.touch.id) {
        this.touch.curX = e.clientX;
        this.touch.curY = e.clientY;
      }
      if (this.aimTouch && e.pointerId === this.aimTouch.id) {
        this.mouseDelta.x += e.clientX - this.aimTouch.curX;
        this.mouseDelta.y += e.clientY - this.aimTouch.curY;
        this.aimTouch.curX = e.clientX;
        this.aimTouch.curY = e.clientY;
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
      if (this.aimTouch && e.pointerId === this.aimTouch.id) this.aimTouch = null;
      if (e.pointerType !== 'touch') this.mouseDown = false;
    };
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Movement axis for a given control scheme, combining keyboard + (for touch-a) the held touch quadrant. -1..1 per axis. */
  getAxis(scheme: ControlScheme): Vec2 {
    if (scheme.startsWith('touch')) {
      const zone = this.touchZoneActive;
      if (!zone) return { x: 0, y: 0 };
      return { x: (zone.col === 0 ? -1 : 1) * Math.SQRT1_2, y: (zone.row === 0 ? -1 : 1) * Math.SQRT1_2 };
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

  /** Free-look delta since last call (mouse drag / touch drag on the non-movement half of the screen), resets each read. */
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
   * Which of the 4 movement touch zones is currently held, or null if none.
   * Zones tile the left half of the screen in a 2x2 grid: col 0/1 = left/right
   * half of that region, row 0/1 = top/bottom half — so each zone is a
   * discrete diagonal direction (top-left = up+left, etc), recomputed live
   * from the touch's current position so sliding across zones updates it.
   */
  get touchZoneActive(): { col: 0 | 1; row: 0 | 1 } | null {
    if (!this.touch) return null;
    const halfW = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    return {
      col: this.touch.curX < halfW / 2 ? 0 : 1,
      row: this.touch.curY < midY ? 0 : 1,
    };
  }

  endFrame(): void {
    this.keysPressedEdge.clear();
  }
}
