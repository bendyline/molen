// One-axis touch controls for on-screen levers, handles and switches. `TouchLever` is the
// geometry: a drag moves a value by the thumb's travel along one axis, relative to where the
// thumb landed, so touching a lever never makes it jump. The zones are invisible elements over a
// rectangle that capture their own pointer (two thumbs work two controls at once) and report
// values; the host draws the control (the vehicle console draws the vehicle's own lever in 3D).

export interface TouchLeverOptions {
  /** Screen axis the thumb moves along: `'y'` (up is more, the default) or `'x'` (right is more). */
  axis?: 'x' | 'y';
  /** CSS pixels of thumb travel across the whole range. */
  travel: number;
  /** Range of the value (default 0..1). */
  min?: number;
  max?: number;
  /** Where the value returns when the thumb lifts, for a spring-centred control (rudder pedals). */
  spring?: number;
  /** Positions the value settles on when the thumb lifts (flap notches); the nearest wins. */
  detents?: readonly number[];
}

/** Lever geometry without a DOM: feed it pointer positions, read the value. */
export class TouchLever {
  readonly axis: 'x' | 'y';
  /** CSS pixels of thumb travel across the whole range; may change between presses. */
  travel: number;
  readonly min: number;
  readonly max: number;
  private readonly spring: number | undefined;
  private readonly detents: readonly number[] | undefined;
  private start: { x: number; y: number; value: number } | undefined;
  /** The value the last press, drag or release left. */
  value = 0;

  constructor(options: TouchLeverOptions) {
    this.axis = options.axis ?? 'y';
    this.travel = Math.max(1, options.travel);
    this.min = options.min ?? 0;
    this.max = options.max ?? 1;
    this.spring = options.spring;
    this.detents = options.detents;
  }

  get active(): boolean {
    return this.start !== undefined;
  }

  /** A thumb lands at x, y on a control currently at `value`. */
  press(x: number, y: number, value: number): void {
    this.value = this.clamp(value);
    this.start = { x, y, value: this.value };
  }

  /** The thumb moved: returns the new value. */
  drag(x: number, y: number): number {
    if (this.start === undefined) return this.value;
    const moved = this.axis === 'x' ? x - this.start.x : this.start.y - y;
    this.value = this.clamp(this.start.value + (moved / this.travel) * (this.max - this.min));
    return this.value;
  }

  /** The thumb lifted: returns the value after any spring or detent. */
  release(): number {
    this.start = undefined;
    if (this.spring !== undefined) this.value = this.clamp(this.spring);
    else if (this.detents !== undefined && this.detents.length > 0)
      this.value = this.detents.reduce((best, detent) =>
        Math.abs(detent - this.value) < Math.abs(best - this.value) ? detent : best,
      );
    return this.value;
  }

  private clamp(value: number): number {
    return Math.max(this.min, Math.min(this.max, Number.isFinite(value) ? value : this.min));
  }
}

/** A rectangle in CSS pixels from the container's top-left corner. */
export interface TouchZoneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** An invisible touch zone placed over a drawn control. */
export interface TouchZone {
  readonly element: HTMLElement;
  /** Move the zone over a control's rectangle. */
  place(rect: TouchZoneRect): void;
  /** Hiding a zone also releases a thumb on it. */
  setVisible(visible: boolean): void;
  dispose(): void;
}

export interface TouchLeverZoneOptions extends Omit<TouchLeverOptions, 'travel'> {
  /** CSS pixels of thumb travel across the range, or a function read at each press. */
  travel: number | (() => number);
  /** Refocus the keyboard surface on press (e.g. after using a HUD button). */
  focusTarget?: Pick<HTMLElement, 'focus'>;
  /** Extra class names for the zone element. */
  className?: string;
  /** The control's value when a thumb lands. */
  read(): number;
  /** A drag moved the value. */
  change(value: number): void;
  /** The thumb lifted or was cancelled: the settled value (after any spring or detent). */
  release?(value: number): void;
  /** A thumb started (`true`) or stopped working the zone. */
  active?(active: boolean): void;
}

/** One pointer at a time: capture it, stop it from reaching the canvas, release it on any end. */
function bindZone(
  container: HTMLElement,
  className: string,
  handlers: {
    focusTarget?: Pick<HTMLElement, 'focus'> | undefined;
    down(event: PointerEvent): void;
    move(event: PointerEvent): void;
    up(): void;
  },
): TouchZone {
  const document = container.ownerDocument;
  const element = document.createElement('div');
  element.className = className;
  // A touch duplicate of keyboard and gamepad controls, like the touch stick.
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    position: 'absolute',
    touchAction: 'none',
    userSelect: 'none',
    webkitUserSelect: 'none',
    pointerEvents: 'auto',
  });
  container.append(element);
  let pointer: number | undefined;
  const end = (): void => {
    const captured = pointer;
    if (captured === undefined) return;
    pointer = undefined;
    if (element.hasPointerCapture(captured)) element.releasePointerCapture(captured);
    handlers.up();
  };
  const onDown = (event: PointerEvent): void => {
    if (pointer !== undefined) return;
    event.preventDefault();
    event.stopPropagation();
    handlers.focusTarget?.focus({ preventScroll: true });
    pointer = event.pointerId;
    element.setPointerCapture(event.pointerId);
    handlers.down(event);
  };
  const onMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    event.stopPropagation();
    handlers.move(event);
  };
  const onUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return;
    event.stopPropagation();
    end();
  };
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  element.addEventListener('lostpointercapture', onUp);
  document.defaultView?.addEventListener('blur', end);
  return {
    element,
    place(rect) {
      Object.assign(element.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    },
    setVisible(visible) {
      element.style.display = visible ? '' : 'none';
      if (!visible) end();
    },
    dispose() {
      end();
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('lostpointercapture', onUp);
      document.defaultView?.removeEventListener('blur', end);
      element.remove();
    },
  };
}

/**
 * An invisible lever zone in `container` (which should be positioned): a drag changes the
 * control's value by the thumb's travel, relative to where it landed. Place it with `place`.
 */
export function createTouchLeverZone(
  container: HTMLElement,
  options: TouchLeverZoneOptions,
): TouchZone {
  const travel = (): number =>
    typeof options.travel === 'function' ? options.travel() : options.travel;
  const lever = new TouchLever({ ...options, travel: travel() });
  return bindZone(container, ['molen-touch-lever', options.className].filter(Boolean).join(' '), {
    focusTarget: options.focusTarget,
    down(event) {
      lever.travel = Math.max(1, travel());
      lever.press(event.clientX, event.clientY, options.read());
      options.active?.(true);
    },
    move(event) {
      const before = lever.value;
      const value = lever.drag(event.clientX, event.clientY);
      if (value !== before) options.change(value);
    },
    up() {
      const value = lever.release();
      options.release?.(value);
      options.active?.(false);
    },
  });
}

export interface TouchButtonZoneOptions {
  focusTarget?: Pick<HTMLElement, 'focus'>;
  className?: string;
  /** A thumb pressed the zone. */
  press(): void;
  /** The thumb lifted or was cancelled. */
  release?(): void;
}

/** An invisible button zone in `container`, for a switch or pedal drawn under it. */
export function createTouchButtonZone(
  container: HTMLElement,
  options: TouchButtonZoneOptions,
): TouchZone {
  return bindZone(container, ['molen-touch-button', options.className].filter(Boolean).join(' '), {
    focusTarget: options.focusTarget,
    down: () => options.press(),
    move: () => {},
    up: () => options.release?.(),
  });
}
