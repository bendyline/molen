// On-screen movement stick for touch devices. `TouchStick` is the pure geometry (a press becomes
// the stick center; the drag offset becomes forward/right in -1..1 with a dead zone); the DOM
// binding draws it and writes the result into an InputMap as a software device, so a phone
// drives exactly the same named actions as a keyboard or gamepad.

import type { InputMap } from '../input';
import { NAVIGATION_ACTIONS } from './input-source';

export interface TouchStickOptions {
  /** Knob travel radius in CSS pixels (default 56). */
  radius?: number;
  /** Fraction of the radius ignored around the center (default 0.12). */
  deadZone?: number;
}

/** Stick geometry without a DOM: feed it pointer positions, read axes. */
export class TouchStick {
  private center: { x: number; y: number } | undefined;
  private offset: { x: number; y: number } = { x: 0, y: 0 };
  readonly radius: number;
  private readonly deadZone: number;

  constructor(options: TouchStickOptions = {}) {
    this.radius = options.radius ?? 56;
    this.deadZone = options.deadZone ?? 0.12;
  }

  get active(): boolean {
    return this.center !== undefined;
  }

  /** Knob displacement from the center in CSS pixels, clamped to the radius. */
  get knob(): { x: number; y: number } {
    return { ...this.offset };
  }

  press(x: number, y: number): void {
    this.center = { x, y };
    this.offset = { x: 0, y: 0 };
  }

  drag(x: number, y: number): void {
    if (this.center === undefined) return;
    let dx = x - this.center.x;
    let dy = y - this.center.y;
    const length = Math.hypot(dx, dy);
    if (length > this.radius) {
      dx *= this.radius / length;
      dy *= this.radius / length;
    }
    this.offset = { x: dx, y: dy };
  }

  release(): void {
    this.center = undefined;
    this.offset = { x: 0, y: 0 };
  }

  /** Movement intent: forward is up the screen, both in -1..1 after the dead zone. */
  axes(): { forward: number; right: number } {
    const length = Math.hypot(this.offset.x, this.offset.y) / this.radius;
    if (length <= this.deadZone) return { forward: 0, right: 0 };
    const scale = (length - this.deadZone) / (1 - this.deadZone) / length;
    const right = (this.offset.x / this.radius) * scale;
    const forward = (-this.offset.y / this.radius) * scale;
    return { forward: Math.abs(forward) < 1e-9 ? 0 : forward, right };
  }
}

export interface TouchJoystickOptions extends TouchStickOptions {
  /** Software-device name in the InputMap (default `'touch-joystick'`). */
  source?: string;
  /** Extra class names for styling the root element. */
  className?: string;
}

export interface TouchJoystick {
  readonly element: HTMLElement;
  readonly stick: TouchStick;
  setVisible(visible: boolean): void;
  dispose(): void;
}

const ACTIONS = NAVIGATION_ACTIONS;

/**
 * Add a movement stick to `container` (bottom-left by default styling). The stick captures its
 * own pointer, so the rest of the canvas keeps handling look/zoom gestures.
 */
export function createTouchJoystick(
  container: HTMLElement,
  input: Pick<InputMap, 'setVirtual' | 'clearVirtual'>,
  options: TouchJoystickOptions = {},
): TouchJoystick {
  const stick = new TouchStick(options);
  const source = options.source ?? 'touch-joystick';
  const document = container.ownerDocument;
  const root = document.createElement('div');
  root.className = ['molen-touch-joystick', options.className].filter(Boolean).join(' ');
  root.setAttribute('aria-hidden', 'true');
  const size = stick.radius * 2 + 32;
  Object.assign(root.style, {
    position: 'absolute',
    left: '24px',
    bottom: '24px',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.16)',
    border: '2px solid rgba(255, 255, 255, 0.45)',
    touchAction: 'none',
    userSelect: 'none',
    zIndex: '2',
  });
  const knob = document.createElement('div');
  Object.assign(knob.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '56px',
    height: '56px',
    margin: '-28px 0 0 -28px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.75)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
    pointerEvents: 'none',
  });
  root.append(knob);
  container.append(root);

  let pointer: number | undefined;
  const publish = (): void => {
    const { forward, right } = stick.axes();
    input.setVirtual(source, ACTIONS.forward, Math.max(0, forward));
    input.setVirtual(source, ACTIONS.back, Math.max(0, -forward));
    input.setVirtual(source, ACTIONS.right, Math.max(0, right));
    input.setVirtual(source, ACTIONS.left, Math.max(0, -right));
    const { x, y } = stick.knob;
    knob.style.transform = `translate(${x}px, ${y}px)`;
  };
  const center = (): { x: number; y: number } => {
    const rect = root.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const onDown = (event: PointerEvent): void => {
    if (pointer !== undefined) return;
    event.preventDefault();
    event.stopPropagation();
    pointer = event.pointerId;
    root.setPointerCapture(event.pointerId);
    const { x, y } = center();
    stick.press(x, y);
    stick.drag(event.clientX, event.clientY);
    publish();
  };
  const onMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    event.stopPropagation();
    stick.drag(event.clientX, event.clientY);
    publish();
  };
  const onUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    event.stopPropagation();
    pointer = undefined;
    stick.release();
    input.clearVirtual(source);
    knob.style.transform = '';
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  return {
    element: root,
    stick,
    setVisible(visible: boolean): void {
      root.style.display = visible ? '' : 'none';
      if (!visible) {
        pointer = undefined;
        stick.release();
        input.clearVirtual(source);
      }
    },
    dispose(): void {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      input.clearVirtual(source);
      root.remove();
    },
  };
}
