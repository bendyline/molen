import type { GamepadAxisBinding, InputDevice, InputProfile } from '@bendyline/molen-schema';
import { inputProfileIssues, inputProfileSchema } from '@bendyline/molen-schema';

type Unsubscribe = () => void;
export interface InputBindings {
  bindings: Record<string, string>;
}

/** Resolve a key or Mouse<button> code to its bound action. */
export function resolveAction(bindings: Record<string, string>, code: string): string | undefined {
  return Object.hasOwn(bindings, code) ? bindings[code] : undefined;
}

/** Structural Gamepad API snapshot; also usable by custom device adapters and tests. */
export interface InputGamepad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

type EventTargetLike = {
  addEventListener(type: string, listener: (ev: unknown) => void): void;
  removeEventListener(type: string, listener: (ev: unknown) => void): void;
};

export interface InputMapOptions extends InputProfile {
  profiles?: Record<string, InputProfile>;
  profile?: string;
  /** Event source (usually window); injectable for tests. */
  target?: EventTargetLike;
  /** Defaults to navigator.getGamepads. Inject an adapter for other browser facilities. */
  getGamepads?: () => readonly (InputGamepad | null)[];
}

function copyProfile(profile: InputProfile): InputProfile {
  const result = inputProfileSchema.parse(profile);
  const issues = inputProfileIssues(result);
  if (issues.length) throw new Error(issues[0]?.message);
  return result;
}

function matches(device: InputDevice | undefined, pad: InputGamepad): boolean {
  return (
    (device?.id === undefined || device.id === pad.id) &&
    (device?.index === undefined || device.index === pad.index)
  );
}

/** Calibrate and shape a raw axis. Invalid/non-finite hardware readings are neutral. */
export function normalizeInputAxis(raw: number, binding: GamepadAxisBinding): number {
  if (!Number.isFinite(raw)) return 0;
  const min = binding.min ?? -1;
  const max = binding.max ?? 1;
  const center = binding.center ?? 0;
  let value =
    binding.mode === 'unit'
      ? (raw - min) / (max - min)
      : raw >= center
        ? (raw - center) / (max - center)
        : (raw - center) / (center - min);
  value = Math.max(binding.mode === 'unit' ? 0 : -1, Math.min(1, value));
  if (binding.invert) value = binding.mode === 'unit' ? 1 - value : -value;
  if (binding.mode === 'positive') value = Math.max(0, value);
  if (binding.mode === 'negative') value = Math.max(0, -value);
  const zone = binding.deadZone ?? (binding.mode === 'unit' ? 0 : 0.12);
  const magnitude = Math.max(0, (Math.abs(value) - zone) / (1 - zone));
  return Math.sign(value) * magnitude ** (binding.curve ?? 1);
}

/**
 * Keyboard/mouse + browser controllers mapped to numeric named actions. Call update() each
 * frame (applyInputRules does this on its poller). Profiles are complete replacements.
 */
export class InputMap {
  private base: InputProfile;
  private readonly profiles = new Map<string, InputProfile>();
  private current: string | undefined;
  private readonly keys = new Set<string>();
  private readonly blockedKeys = new Set<string>();
  private readonly blockedButtons = new Set<string>();
  private baselineButtons = false;
  private values = new Map<string, number>();
  private padValues = new Map<string, number>();
  private pads: InputGamepad[] = [];
  private enabled = true;
  private disposed = false;
  private focused = true;
  private suspensions = 0;
  private revision = 0;
  private readonly pressHandlers = new Map<string, Set<(action: string) => void>>();
  private readonly releaseHandlers = new Map<string, Set<(action: string) => void>>();
  private readonly changeHandlers = new Set<() => void>();
  private readonly resetHandlers = new Set<() => void>();
  private readonly profileHandlers = new Set<() => void>();
  private readonly target: EventTargetLike | undefined;
  private readonly provider: () => readonly (InputGamepad | null)[];
  private readonly listeners: Array<[string, (ev: unknown) => void]> = [];
  private status: 'available' | 'unavailable' | 'blocked' = 'unavailable';

  constructor(opts: InputMapOptions) {
    // Pick only profile fields: options contain host objects/functions, never serialized data.
    this.base = copyProfile({ bindings: opts.bindings, axes: opts.axes, buttons: opts.buttons });
    for (const [name, profile] of Object.entries(opts.profiles ?? {}))
      this.profiles.set(name, copyProfile(profile));
    if (opts.profile !== undefined && !this.profiles.has(opts.profile))
      throw new Error(`Unknown input profile "${opts.profile}".`);
    this.current = opts.profile;
    this.target = opts.target;
    this.provider =
      opts.getGamepads ??
      (() =>
        typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
          ? navigator.getGamepads()
          : []);
    if (
      opts.getGamepads ||
      (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function')
    )
      this.status = 'available';
    if (this.target) this.attach(this.target);
  }

  private get accepting(): boolean {
    return this.enabled && this.focused && this.suspensions === 0;
  }
  private get profile(): InputProfile {
    return this.current === undefined
      ? this.base
      : (this.profiles.get(this.current) as InputProfile);
  }
  get activeProfile(): string | undefined {
    return this.current;
  }
  get gamepadStatus(): 'available' | 'unavailable' | 'blocked' {
    return this.status;
  }
  profileNames(): string[] {
    return [...this.profiles.keys()];
  }

  /** Detached, serializable copy for custom editors and host-managed persistence. */
  getProfile(...selection: [name?: string]): InputProfile {
    const name = selection.length === 0 ? this.current : selection[0];
    const profile = name === undefined ? this.base : this.profiles.get(name);
    if (!profile) throw new Error(`Unknown input profile "${name}".`);
    return copyProfile(profile);
  }

  /** Atomically validate and replace bindings; no held button becomes a new action. */
  defineProfile(name: string | undefined, profile: InputProfile): void {
    const next = copyProfile(profile);
    if (name === '') throw new Error('Profile names must not be empty.');
    if (name === undefined) this.base = next;
    else this.profiles.set(name, next);
    if (name === this.current) this.reset();
    for (const fn of this.profileHandlers) fn();
  }

  /** Undefined selects the root bindings. Held keys/buttons must be released before reuse. */
  setProfile(name: string | undefined): void {
    if (name !== undefined && !this.profiles.has(name))
      throw new Error(`Unknown input profile "${name}".`);
    if (name === this.current) return;
    this.current = name;
    this.reset();
    for (const fn of this.profileHandlers) fn();
  }

  /** Snapshot of all detected devices and raw values, suitable for an axis/button inspector. */
  devices(): InputGamepad[] {
    return this.pads.map((pad) => ({
      ...pad,
      axes: [...pad.axes],
      buttons: pad.buttons.map((button) => ({ ...button })),
    }));
  }

  /** Poll fresh browser objects; unplugging or losing permission releases affected controls. */
  update(): void {
    if (this.disposed) return;
    try {
      this.pads = this.provider()
        .filter((pad): pad is InputGamepad => pad?.connected === true)
        .map((pad) => ({
          id: pad.id,
          index: pad.index,
          connected: pad.connected,
          mapping: pad.mapping,
          axes: Array.from(pad.axes),
          buttons: Array.from(pad.buttons, (button) => ({
            pressed: button.pressed,
            value: button.value,
          })),
        }));
      if (this.status === 'blocked') this.status = 'available';
    } catch {
      this.pads = [];
      this.status = 'blocked';
    }
    const down = new Set<string>();
    for (const pad of this.pads)
      pad.buttons.forEach((button, index) => {
        if (button.pressed || button.value > 0)
          down.add(JSON.stringify([pad.id, pad.index, index]));
      });
    if (this.baselineButtons || !this.accepting)
      for (const key of down) this.blockedButtons.add(key);
    for (const key of this.blockedButtons) if (!down.has(key)) this.blockedButtons.delete(key);
    this.baselineButtons = false;
    this.padValues.clear();
    if (this.accepting) {
      for (const pad of this.pads) {
        for (const binding of this.profile.axes ?? []) {
          const raw = pad.axes[binding.axis];
          if (matches(binding.device, pad) && raw !== undefined)
            this.contribute(this.padValues, binding.action, normalizeInputAxis(raw, binding));
        }
        for (const binding of this.profile.buttons ?? []) {
          const button = pad.buttons[binding.button];
          const key = JSON.stringify([pad.id, pad.index, binding.button]);
          if (
            matches(binding.device, pad) &&
            button &&
            !this.blockedButtons.has(key) &&
            (button.value >= (binding.threshold ?? 0.5) ||
              (binding.threshold === undefined && button.pressed))
          ) {
            this.contribute(this.padValues, binding.action, 1);
          }
        }
      }
    }
    this.recompute();
  }

  /** Suspend while editing a form/menu; device discovery continues during update(). */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.reset();
  }

  /** Temporarily suppress gameplay while a remapping UI is open; returned release is idempotent. */
  suspend(): Unsubscribe {
    this.suspensions++;
    this.reset();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.suspensions--;
      this.reset();
    };
  }

  private attach(target: EventTargetLike): void {
    const editable = (ev: unknown): boolean => {
      const element = (ev as { target?: { closest?: (selector: string) => unknown } }).target;
      return !!element?.closest?.(
        'input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [data-molen-input-editor]',
      );
    };
    const add = (type: string, fn: (ev: unknown) => void): void => {
      target.addEventListener(type, fn);
      this.listeners.push([type, fn]);
    };
    add('keydown', (ev) => {
      if (!editable(ev)) this.press((ev as { code: string }).code);
    });
    add('keyup', (ev) => this.release((ev as { code: string }).code));
    add('mousedown', (ev) => {
      if (!editable(ev)) this.press(`Mouse${(ev as { button: number }).button}`);
    });
    add('mouseup', (ev) => this.release(`Mouse${(ev as { button: number }).button}`));
    add('blur', () => {
      this.focused = false;
      this.reset();
    });
    add('focus', () => {
      this.focused = true;
      this.blockedKeys.clear();
    });
  }

  press(code: string): void {
    if (this.disposed || !this.accepting || this.blockedKeys.has(code) || this.keys.has(code))
      return;
    this.keys.add(code);
    this.recompute();
  }
  release(code: string): void {
    this.blockedKeys.delete(code);
    if (this.keys.delete(code)) this.recompute();
  }

  /** Numeric action value; strongest absolute contribution wins, keyboard wins ties. */
  value(action: string): number {
    return this.values.get(action) ?? 0;
  }
  isActive(action: string): boolean {
    return this.value(action) !== 0;
  }
  activeActions(): Set<string> {
    return new Set(this.values.keys());
  }

  private contribute(values: Map<string, number>, action: string, value: number): void {
    if (Number.isFinite(value) && Math.abs(value) > Math.abs(values.get(action) ?? 0))
      values.set(action, value);
  }
  private recompute(): void {
    const next = new Map<string, number>();
    if (this.accepting) {
      for (const code of this.keys) {
        const action = resolveAction(this.profile.bindings, code);
        if (action !== undefined) this.contribute(next, action, 1);
      }
      for (const [action, value] of this.padValues) this.contribute(next, action, value);
    }
    this.commit(next);
  }
  private commit(next: Map<string, number>): void {
    const prev = this.values;
    this.values = next;
    const revision = ++this.revision;
    for (const action of new Set([...prev.keys(), ...next.keys()])) {
      const before = prev.get(action) ?? 0;
      const after = next.get(action) ?? 0;
      const handlers =
        before === 0 && after !== 0
          ? this.pressHandlers
          : before !== 0 && after === 0
            ? this.releaseHandlers
            : undefined;
      for (const fn of handlers?.get(action) ?? []) {
        if (this.revision !== revision) return;
        fn(action);
      }
    }
    if (this.revision !== revision) return;
    if (
      [...new Set([...prev.keys(), ...next.keys()])].some(
        (action) => prev.get(action) !== next.get(action),
      )
    ) {
      for (const fn of this.changeHandlers) fn();
    }
  }

  /** Release actions immediately; suppress held physical buttons until released. */
  reset(): void {
    for (const key of this.keys) this.blockedKeys.add(key);
    this.keys.clear();
    this.padValues.clear();
    this.baselineButtons = true;
    this.commit(new Map());
    for (const fn of this.resetHandlers) fn();
  }

  private subscribe(
    map: Map<string, Set<(action: string) => void>>,
    action: string,
    handler: (action: string) => void,
  ): Unsubscribe {
    let set = map.get(action);
    if (!set) {
      set = new Set();
      map.set(action, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }
  onPress(action: string, handler: (action: string) => void): Unsubscribe {
    return this.subscribe(this.pressHandlers, action, handler);
  }
  onRelease(action: string, handler: (action: string) => void): Unsubscribe {
    return this.subscribe(this.releaseHandlers, action, handler);
  }
  /** Action values changed (including neutralization on reset/profile switch). */
  onChange(handler: () => void): Unsubscribe {
    this.changeHandlers.add(handler);
    return () => {
      this.changeHandlers.delete(handler);
    };
  }
  /** Explicit neutralization on reset, focus loss, suspension or profile replacement. */
  onReset(handler: () => void): Unsubscribe {
    this.resetHandlers.add(handler);
    return () => {
      this.resetHandlers.delete(handler);
    };
  }
  /** Profile selection or definitions changed. */
  onProfilesChanged(handler: () => void): Unsubscribe {
    this.profileHandlers.add(handler);
    return () => {
      this.profileHandlers.delete(handler);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.target)
      for (const [type, fn] of this.listeners) this.target.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.reset();
    this.pressHandlers.clear();
    this.releaseHandlers.clear();
    this.changeHandlers.clear();
    this.resetHandlers.clear();
    this.profileHandlers.clear();
    this.pads = [];
  }
}
