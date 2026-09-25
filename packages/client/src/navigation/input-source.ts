// One per-frame navigation input from every device: keyboard, gamepad and software controls
// through an InputMap (named actions), plus pointer gestures from a NavigationPointer. Controllers
// consume the resulting plain `NavigationInput`, so hosts, tests and agents can also synthesize it.

import type { InputProfile } from '@bendyline/molen-schema';
import { type InputGamepad, InputMap } from '../input';
import {
  type NavigationGestures,
  NavigationPointer,
  type NavigationPointerOptions,
  type NavigationPointerSurface,
} from './pointer';

/** Named actions the navigation profiles bind; software controls drive the same names. */
export const NAVIGATION_ACTIONS: {
  readonly forward: 'nav-forward';
  readonly back: 'nav-back';
  readonly left: 'nav-left';
  readonly right: 'nav-right';
  readonly up: 'nav-up';
  readonly down: 'nav-down';
  readonly lookLeft: 'nav-look-left';
  readonly lookRight: 'nav-look-right';
  readonly lookUp: 'nav-look-up';
  readonly lookDown: 'nav-look-down';
  readonly sprint: 'nav-sprint';
  readonly jump: 'nav-jump';
  readonly interact: 'nav-interact';
  readonly view: 'nav-view';
} = {
  forward: 'nav-forward',
  back: 'nav-back',
  left: 'nav-left',
  right: 'nav-right',
  up: 'nav-up',
  down: 'nav-down',
  lookLeft: 'nav-look-left',
  lookRight: 'nav-look-right',
  lookUp: 'nav-look-up',
  lookDown: 'nav-look-down',
  sprint: 'nav-sprint',
  jump: 'nav-jump',
  interact: 'nav-interact',
  view: 'nav-view',
};

/** The navigation modes with a default input profile. */
export type NavigationProfileName = 'orbit' | 'fly' | 'walk' | 'drive';

const A = NAVIGATION_ACTIONS;
const MOVE_KEYS: Record<string, string> = {
  KeyW: A.forward,
  ArrowUp: A.forward,
  KeyS: A.back,
  ArrowDown: A.back,
  KeyA: A.left,
  ArrowLeft: A.left,
  KeyD: A.right,
  ArrowRight: A.right,
  ShiftLeft: A.sprint,
  ShiftRight: A.sprint,
};
// Standard-mapping gamepad: left stick moves, right stick looks.
const STICKS: NonNullable<InputProfile['axes']> = [
  { axis: 0, action: A.left, mode: 'negative' },
  { axis: 0, action: A.right, mode: 'positive' },
  { axis: 1, action: A.forward, mode: 'negative' },
  { axis: 1, action: A.back, mode: 'positive' },
  { axis: 2, action: A.lookLeft, mode: 'negative' },
  { axis: 2, action: A.lookRight, mode: 'positive' },
  { axis: 3, action: A.lookUp, mode: 'negative' },
  { axis: 3, action: A.lookDown, mode: 'positive' },
];

/**
 * Default key/gamepad bindings per navigation mode. Orbit and fly use Q/E for down/up; walk and
 * drive use E to interact (board or leave a vehicle), Space to jump or brake, and V to switch
 * the vehicle view. Hosts may replace any profile through `InputMap.defineProfile`.
 */
export function navigationInputProfiles(): Record<NavigationProfileName, InputProfile> {
  const aerial: InputProfile = {
    bindings: { ...MOVE_KEYS, KeyE: A.up, PageUp: A.up, KeyQ: A.down, PageDown: A.down },
    axes: STICKS,
    buttons: [
      { button: 5, action: A.up },
      { button: 4, action: A.down },
      { button: 10, action: A.sprint },
    ],
  };
  const ground: InputProfile = {
    bindings: { ...MOVE_KEYS, Space: A.jump, KeyE: A.interact, KeyF: A.interact, KeyV: A.view },
    axes: STICKS,
    buttons: [
      { button: 0, action: A.jump },
      { button: 2, action: A.interact },
      { button: 3, action: A.view },
      { button: 10, action: A.sprint },
    ],
  };
  return { orbit: aerial, fly: aerial, walk: ground, drive: ground };
}

/** Everything a navigation controller reads in one frame. */
export interface NavigationInput {
  /** Movement intent, each -1..1 (forward, right, up). */
  move: { forward: number; right: number; up: number };
  /** Look delta in CSS-pixel equivalents (pointer drag plus scaled gamepad stick). */
  look: [number, number];
  /** Pan delta in CSS pixels (secondary-button, shift or two-finger drag). */
  pan: [number, number];
  /** Log-scale zoom; positive zooms in. */
  zoom: number;
  /** Two-finger twist in radians, clockwise positive. */
  twist: number;
  sprint: boolean;
  /** Held jump / brake. */
  jump: boolean;
  /** Presses of interact since the previous frame (edge-triggered). */
  interact: number;
  /** Presses of the view toggle since the previous frame (edge-triggered). */
  view: number;
  /** Clicks/taps in element-relative CSS pixels. */
  taps: Array<{ x: number; y: number }>;
}

/** An input with no intent; controllers treat it as "hold still". */
export function idleNavigationInput(): NavigationInput {
  return {
    move: { forward: 0, right: 0, up: 0 },
    look: [0, 0],
    pan: [0, 0],
    zoom: 0,
    twist: 0,
    sprint: false,
    jump: false,
    interact: 0,
    view: 0,
    taps: [],
  };
}

/** Structural event target for keyboard and focus events (a canvas, a document, a fake). */
export interface NavigationKeyTarget {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

export interface NavigationInputSourceOptions extends NavigationPointerOptions {
  /** Element receiving pointer gestures, usually the canvas. */
  element: NavigationPointerSurface;
  /**
   * Keyboard/focus event target. Defaults to `element`, which then needs to be focusable
   * (`tabindex="0"` on a canvas); presses focus it automatically.
   */
  keyTarget?: NavigationKeyTarget;
  /** Starting profile (default `'orbit'`). */
  profile?: NavigationProfileName;
  /** Gamepad look speed, CSS-pixel equivalents per second at full deflection (default 900). */
  gamepadLookSpeed?: number;
  /** Gamepad source; injectable for tests. */
  getGamepads?: () => readonly (InputGamepad | null)[];
}

/**
 * Combines an InputMap (keys, gamepad, software controls) with pointer gestures into one
 * `NavigationInput` per frame. Switch profiles with `setProfile(mode)` when navigation changes.
 */
export class NavigationInputSource {
  readonly map: InputMap;
  readonly pointer: NavigationPointer;
  private interactPresses = 0;
  private viewPresses = 0;
  private readonly lookSpeed: number;
  private readonly unsubscribe: Array<() => void>;

  constructor(options: NavigationInputSourceOptions) {
    const profiles = navigationInputProfiles();
    this.map = new InputMap({
      ...profiles.orbit,
      profiles,
      profile: options.profile ?? 'orbit',
      target: options.keyTarget ?? (options.element as unknown as NavigationKeyTarget),
      ...(options.getGamepads !== undefined ? { getGamepads: options.getGamepads } : {}),
    });
    this.pointer = new NavigationPointer(options.element, options);
    this.lookSpeed = options.gamepadLookSpeed ?? 900;
    this.unsubscribe = [
      this.map.onPress(A.interact, () => {
        this.interactPresses++;
      }),
      this.map.onPress(A.view, () => {
        this.viewPresses++;
      }),
      this.map.onReset(() => this.pointer.reset()),
    ];
  }

  setProfile(profile: NavigationProfileName): void {
    this.map.setProfile(profile);
    this.pointer.setPointerLock(profile === 'walk');
  }

  /** Poll devices and drain this frame's gestures and presses. `dt` is in seconds. */
  read(dt: number): NavigationInput {
    this.map.update();
    const v = (action: string): number => this.map.value(action);
    const gestures: NavigationGestures = this.pointer.consume();
    const stickX = v(A.lookRight) - v(A.lookLeft);
    const stickY = v(A.lookDown) - v(A.lookUp);
    const input: NavigationInput = {
      move: {
        forward: v(A.forward) - v(A.back),
        right: v(A.right) - v(A.left),
        up: v(A.up) - v(A.down),
      },
      look: [
        gestures.look[0] + stickX * this.lookSpeed * dt,
        gestures.look[1] + stickY * this.lookSpeed * dt,
      ],
      pan: gestures.pan,
      zoom: gestures.zoom,
      twist: gestures.twist,
      sprint: v(A.sprint) !== 0,
      jump: v(A.jump) !== 0,
      interact: this.interactPresses,
      view: this.viewPresses,
      taps: gestures.taps,
    };
    this.interactPresses = 0;
    this.viewPresses = 0;
    return input;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.pointer.dispose();
    this.map.dispose();
  }
}
