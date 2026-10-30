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
  readonly boost: 'nav-boost';
  readonly throttleUp: 'nav-throttle-up';
  readonly throttleDown: 'nav-throttle-down';
  readonly power: 'nav-power';
  readonly yawLeft: 'nav-yaw-left';
  readonly yawRight: 'nav-yaw-right';
  readonly engine: 'nav-engine';
  readonly gear: 'nav-gear';
  readonly flaps: 'nav-flaps';
  readonly vector: 'nav-vector';
  readonly recover: 'nav-recover';
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
  boost: 'nav-boost',
  throttleUp: 'nav-throttle-up',
  throttleDown: 'nav-throttle-down',
  power: 'nav-power',
  yawLeft: 'nav-yaw-left',
  yawRight: 'nav-yaw-right',
  engine: 'nav-engine',
  gear: 'nav-gear',
  flaps: 'nav-flaps',
  vector: 'nav-vector',
  recover: 'nav-recover',
};

/** The navigation modes with a default input profile. */
export type NavigationProfileName = 'orbit' | 'fly' | 'walk' | 'drive' | 'pilot';
const ACTUATOR_KEYS: Readonly<Record<string, string>> = {
  KeyB: 'speedBrake',
  KeyH: 'tailHook',
  KeyO: 'canopy',
  KeyK: 'wipers',
  KeyL: 'headlights',
  Digit1: 'doorFrontLeft',
  Digit2: 'doorFrontRight',
  Digit3: 'doorRearLeft',
  Digit4: 'doorRearRight',
  Digit5: 'hood',
  Digit6: 'trunk',
};
const ACTUATOR_BINDINGS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ACTUATOR_KEYS).map(([key, name]) => [key, `nav-actuator-${name}`]),
);

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
 * drive use E to interact (board or leave a vehicle), Space to jump or brake, Shift to sprint
 * or pull the handbrake, and V to switch the vehicle view. Pilot flies an aircraft: W/S (or ↑/↓) pitch the nose down/up, A/D (or ←/→)
 * bank, Z/C work the rudder or pedals, =/− (or numpad +/−, Page Up/Down) set throttle or
 * collective, I toggles the engine, G the gear, F the flaps, R recovers after an impact, Space
 * brakes, V switches the view and E leaves. T toggles travel boost in walk, drive and pilot.
 * Hosts may replace any profile through
 * `InputMap.defineProfile`.
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
    bindings: {
      ...MOVE_KEYS,
      Space: A.jump,
      KeyE: A.interact,
      KeyF: A.interact,
      KeyV: A.view,
      KeyT: A.boost,
    },
    axes: STICKS,
    buttons: [
      { button: 0, action: A.jump },
      { button: 2, action: A.interact },
      { button: 3, action: A.view },
      { button: 10, action: A.sprint },
    ],
  };
  const pilot: InputProfile = {
    bindings: {
      ...ACTUATOR_BINDINGS,
      KeyW: A.forward,
      ArrowUp: A.forward,
      KeyS: A.back,
      ArrowDown: A.back,
      KeyA: A.left,
      ArrowLeft: A.left,
      KeyD: A.right,
      ArrowRight: A.right,
      KeyZ: A.yawLeft,
      KeyC: A.yawRight,
      Equal: A.throttleUp,
      NumpadAdd: A.throttleUp,
      PageUp: A.throttleUp,
      Minus: A.throttleDown,
      NumpadSubtract: A.throttleDown,
      PageDown: A.throttleDown,
      Space: A.jump,
      KeyE: A.interact,
      KeyV: A.view,
      KeyT: A.boost,
      KeyI: A.engine,
      KeyG: A.gear,
      KeyF: A.flaps,
      KeyJ: A.vector,
      KeyR: A.recover,
    },
    axes: STICKS,
    buttons: [
      { button: 7, action: A.throttleUp },
      { button: 6, action: A.throttleDown },
      { button: 4, action: A.yawLeft },
      { button: 5, action: A.yawRight },
      { button: 0, action: A.jump },
      { button: 2, action: A.interact },
      { button: 3, action: A.view },
      { button: 1, action: A.engine },
    ],
  };
  return {
    orbit: aerial,
    fly: aerial,
    walk: ground,
    drive: { ...ground, bindings: { ...ground.bindings, ...ACTUATOR_BINDINGS, KeyR: A.recover } },
    pilot,
  };
}

/** Flight controls beyond pitch (`-move.forward`) and roll (`move.right`), in the pilot profile. */
export interface PilotInput {
  /** Absolute throttle/collective, 0..1, only while a mapped hardware axis is connected. */
  power?: number;
  /** Held throttle or collective change, -1..1 (more power positive). */
  throttle: number;
  /** Held rudder or pedals, -1..1 (right positive). */
  yaw: number;
  /** Presses since the previous frame (edge-triggered). */
  engine: number;
  gear: number;
  flaps: number;
  /** Powered-lift lever advances through 0, 25, 50, 75, 100 percent on each press. */
  vector?: number;
  recover: number;
}

/** Everything a navigation controller reads in one frame. */
export interface NavigationInput {
  /** Repair presses in the drive profile (R); the host requires a stopped vehicle. */
  recover?: number;
  /** Edge-triggered model mechanism toggles; unsupported mechanisms are ignored by hosts. */
  actuators?: Record<string, number>;
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
  /** Presses of the 4× travel boost toggle (T), edge-triggered. */
  boost?: number;
  /** Clicks/taps in element-relative CSS pixels. */
  taps: Array<{ x: number; y: number }>;
  /** Flight controls, present while the `pilot` profile is active. */
  pilot?: PilotInput;
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
  private boostPresses = 0;
  private actuatorPresses: Record<string, number> = {};
  private profile: NavigationProfileName;
  private readonly pilotPresses = { engine: 0, gear: 0, flaps: 0, vector: 0, recover: 0 };
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
    this.profile = options.profile ?? 'orbit';
    this.unsubscribe = [
      ...Object.values(ACTUATOR_KEYS).map((name) =>
        this.map.onPress(`nav-actuator-${name}`, () => {
          this.actuatorPresses[name] = (this.actuatorPresses[name] ?? 0) + 1;
        }),
      ),
      ...(['engine', 'gear', 'flaps', 'vector', 'recover'] as const).map((name) =>
        this.map.onPress(A[name], () => {
          this.pilotPresses[name]++;
        }),
      ),
      this.map.onPress(A.interact, () => {
        this.interactPresses++;
      }),
      this.map.onPress(A.view, () => {
        this.viewPresses++;
      }),
      this.map.onPress(A.boost, () => {
        this.boostPresses++;
      }),
      this.map.onReset(() => {
        this.pointer.reset();
        this.interactPresses = 0;
        this.viewPresses = 0;
        this.boostPresses = 0;
        this.actuatorPresses = {};
        this.pilotPresses.engine = 0;
        this.pilotPresses.gear = 0;
        this.pilotPresses.flaps = 0;
        this.pilotPresses.vector = 0;
        this.pilotPresses.recover = 0;
      }),
    ];
    this.pointer.setPointerLock(this.profile === 'walk');
    // A focused canvas does not receive the window's blur when the user changes apps.
    const document = options.element.ownerDocument;
    const reset = (): void => this.map.reset();
    document?.defaultView?.addEventListener('blur', reset);
    document?.addEventListener?.('visibilitychange', reset);
    document?.addEventListener?.('pointerlockchange', reset);
    this.unsubscribe.push(() => {
      document?.defaultView?.removeEventListener('blur', reset);
      document?.removeEventListener?.('visibilitychange', reset);
      document?.removeEventListener?.('pointerlockchange', reset);
    });
  }

  setProfile(profile: NavigationProfileName): void {
    this.profile = profile;
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
      ...(this.boostPresses > 0 ? { boost: this.boostPresses } : {}),
      taps: gestures.taps,
      ...(Object.keys(this.actuatorPresses).length
        ? { actuators: { ...this.actuatorPresses } }
        : {}),
      ...(this.profile === 'drive' && this.pilotPresses.recover > 0
        ? { recover: this.pilotPresses.recover }
        : {}),
      ...(this.profile === 'pilot'
        ? {
            pilot: {
              ...(this.map.hasAxis(A.power) ? { power: v(A.power) } : {}),
              throttle: v(A.throttleUp) - v(A.throttleDown),
              yaw: v(A.yawRight) - v(A.yawLeft),
              ...this.pilotPresses,
            },
          }
        : {}),
    };
    this.interactPresses = 0;
    this.viewPresses = 0;
    this.boostPresses = 0;
    this.pilotPresses.engine = 0;
    this.pilotPresses.gear = 0;
    this.pilotPresses.flaps = 0;
    this.pilotPresses.vector = 0;
    this.pilotPresses.recover = 0;
    this.actuatorPresses = {};
    return input;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.pointer.dispose();
    this.map.dispose();
  }
}
