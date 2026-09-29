// Pointer gestures over one element, accumulated between frames: drag-look, pan, wheel/pinch
// zoom, two-finger twist, and taps. Listeners attach to the element you pass (a canvas), never
// to window, so a host page keeps full control of its own input.

/** The slice of a DOM element the gesture tracker needs; tests pass a fake. */
export interface NavigationPointerSurface {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
  hasPointerCapture?(pointerId: number): boolean;
  getBoundingClientRect?(): { left: number; top: number; width: number; height: number };
  requestPointerLock?(): unknown;
  focus?(options?: { preventScroll?: boolean }): void;
  ownerDocument?: { pointerLockElement?: unknown; exitPointerLock?(): void } | null;
}

/** The pointer-event fields the tracker reads. */
export interface NavigationPointerEvent {
  pointerId: number;
  pointerType?: string;
  button?: number;
  buttons?: number;
  clientX: number;
  clientY: number;
  movementX?: number;
  movementY?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  preventDefault?(): void;
}

export interface NavigationWheelEvent {
  deltaY: number;
  /** 0 pixels, 1 lines, 2 pages. */
  deltaMode?: number;
  clientX?: number;
  clientY?: number;
  preventDefault?(): void;
}

/** Gestures accumulated since the previous `consume()`. */
export interface NavigationGestures {
  /** Drag or pointer-lock movement, in CSS pixels (right/down positive). */
  look: [number, number];
  /** Secondary-button, shift-drag or two-finger movement, in CSS pixels. */
  pan: [number, number];
  /** Log-scale zoom: positive zooms in (wheel up, pinch out). */
  zoom: number;
  /** Two-finger rotation in radians, clockwise positive. */
  twist: number;
  /** Clicks/taps that did not become drags, in element-relative CSS pixels. */
  taps: Array<{ x: number; y: number }>;
}

export interface NavigationPointerOptions {
  /** Movement (CSS px) before a press becomes a drag instead of a tap (default 6). */
  tapSlop?: number;
  /** Longest press (ms) still counted as a tap (default 350). */
  tapMilliseconds?: number;
  /** Wheel pixels per e-fold of zoom (default 400). */
  wheelScale?: number;
  /** Clock for tap timing; injectable for tests (default performance.now). */
  now?: () => number;
}

interface TrackedPointer {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
  pan: boolean;
}

function emptyGestures(): NavigationGestures {
  return { look: [0, 0], pan: [0, 0], zoom: 0, twist: 0, taps: [] };
}

/**
 * Tracks pointer gestures on a surface. One mouse button or finger drags to look; the secondary
 * or middle button, shift-drag, or two fingers pan; the wheel or a two-finger pinch zooms; two
 * fingers rotating twist. Enable pointer lock for mouse-look (walk mode) with `setPointerLock`.
 */
export class NavigationPointer {
  private readonly pointers = new Map<number, TrackedPointer>();
  private pending: NavigationGestures = emptyGestures();
  private pointerLock = false;
  private readonly listeners: Array<[string, (event: Event) => void]> = [];
  private readonly tapSlop: number;
  private readonly tapMilliseconds: number;
  private readonly wheelScale: number;
  private readonly now: () => number;

  constructor(
    private readonly surface: NavigationPointerSurface,
    options: NavigationPointerOptions = {},
  ) {
    this.tapSlop = options.tapSlop ?? 6;
    this.tapMilliseconds = options.tapMilliseconds ?? 350;
    this.wheelScale = options.wheelScale ?? 400;
    this.now = options.now ?? (() => performance.now());
    this.listen('pointerdown', (event: NavigationPointerEvent) => this.down(event));
    this.listen('pointermove', (event: NavigationPointerEvent) => this.move(event));
    this.listen('pointerup', (event: NavigationPointerEvent) => this.up(event, true));
    this.listen('pointercancel', (event: NavigationPointerEvent) => this.up(event, false));
    this.listen('wheel', (event: NavigationWheelEvent) => this.wheel(event), { passive: false });
    this.listen('contextmenu', (event: { preventDefault?(): void }) => event.preventDefault?.());
  }

  /** Drop the accumulated gestures and return them. Call once per frame. */
  consume(): NavigationGestures {
    const gestures = this.pending;
    this.pending = emptyGestures();
    return gestures;
  }

  /** Request pointer lock on the next press (mouse-look); releasing unlocks immediately. */
  setPointerLock(enabled: boolean): void {
    this.pointerLock = enabled;
    const document = this.surface.ownerDocument;
    if (!enabled && document?.pointerLockElement === this.surface) document.exitPointerLock?.();
  }

  /** Forget held pointers and pending gestures (e.g. on blur or a mode change). */
  reset(): void {
    this.pointers.clear();
    this.pending = emptyGestures();
  }

  dispose(): void {
    for (const [type, listener] of this.listeners) this.surface.removeEventListener(type, listener);
    this.listeners.length = 0;
    this.setPointerLock(false);
    this.reset();
  }

  private listen<E>(
    type: string,
    handler: (event: E) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    // DOM events carry every field the typed handlers read.
    const listener = handler as unknown as (event: Event) => void;
    this.surface.addEventListener(type, listener, options);
    this.listeners.push([type, listener]);
  }

  private locked(): boolean {
    return this.surface.ownerDocument?.pointerLockElement === this.surface;
  }

  private down(event: NavigationPointerEvent): void {
    this.surface.focus?.({ preventScroll: true });
    if (this.pointerLock && event.pointerType !== 'touch' && !this.locked()) {
      // Drag-look keeps working when the host or browser declines pointer lock.
      const request = this.surface.requestPointerLock?.();
      if (request instanceof Promise) request.catch(() => {});
    }
    const button = event.button ?? 0;
    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: this.now(),
      moved: false,
      pan: button === 1 || button === 2 || event.shiftKey === true,
    });
    this.surface.setPointerCapture?.(event.pointerId);
  }

  private move(event: NavigationPointerEvent): void {
    if (this.locked() && this.pointers.size <= 1) {
      this.pending.look[0] += event.movementX ?? 0;
      this.pending.look[1] += event.movementY ?? 0;
      return;
    }
    const pointer = this.pointers.get(event.pointerId);
    if (pointer === undefined) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (
      !pointer.moved &&
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > this.tapSlop
    ) {
      pointer.moved = true;
    }
    if (this.pointers.size >= 2) {
      this.twoFinger(event.pointerId, event.clientX, event.clientY);
    } else if (pointer.pan) {
      this.pending.pan[0] += dx;
      this.pending.pan[1] += dy;
    } else {
      this.pending.look[0] += dx;
      this.pending.look[1] += dy;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }

  private twoFinger(movedId: number, x: number, y: number): void {
    const [first, second] = [...this.pointers.entries()];
    if (first === undefined || second === undefined) return;
    const before = [first[1], second[1]];
    const after = [first, second].map(([id, pointer]) =>
      id === movedId ? { x, y } : { x: pointer.x, y: pointer.y },
    ) as [{ x: number; y: number }, { x: number; y: number }];
    const [a0, b0] = before as [TrackedPointer, TrackedPointer];
    const [a1, b1] = after;
    const distance0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
    const distance1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
    if (distance0 > 0 && distance1 > 0) this.pending.zoom += Math.log(distance1 / distance0);
    const angle0 = Math.atan2(b0.y - a0.y, b0.x - a0.x);
    const angle1 = Math.atan2(b1.y - a1.y, b1.x - a1.x);
    let twist = angle1 - angle0;
    if (twist > Math.PI) twist -= Math.PI * 2;
    if (twist < -Math.PI) twist += Math.PI * 2;
    this.pending.twist += twist;
    this.pending.pan[0] += (a1.x + b1.x - a0.x - b0.x) / 2;
    this.pending.pan[1] += (a1.y + b1.y - a0.y - b0.y) / 2;
    for (const pointer of this.pointers.values()) pointer.moved = true;
  }

  private up(event: NavigationPointerEvent, completed: boolean): void {
    const pointer = this.pointers.get(event.pointerId);
    if (pointer === undefined) return;
    this.pointers.delete(event.pointerId);
    if (this.surface.hasPointerCapture?.(event.pointerId) === true) {
      this.surface.releasePointerCapture?.(event.pointerId);
    }
    const quick = this.now() - pointer.startTime <= this.tapMilliseconds;
    if (completed && !pointer.moved && quick && this.pointers.size === 0) {
      const rect = this.surface.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      this.pending.taps.push({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  }

  private wheel(event: NavigationWheelEvent): void {
    event.preventDefault?.();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
    this.pending.zoom -= pixels / this.wheelScale;
  }
}
