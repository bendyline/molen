import { describe, expect, it } from 'vitest';
import { type InputGamepad, InputMap, normalizeInputAxis } from '../src/input';
import { applyInputRules } from '../src/scene-bindings';

function pad(index = 0, id = 'Flight stick'): InputGamepad {
  return {
    id,
    index,
    connected: true,
    mapping: '',
    axes: [0, 0, 0, 0, 0, 0, 0, 0.6],
    buttons: [{ pressed: false, value: 0 }],
  };
}
function press(p: InputGamepad, down: boolean): void {
  p.buttons = [{ pressed: down, value: Number(down) }];
}

describe('controller input profiles', () => {
  it('maps arbitrary axes, calibrates, and combines keyboard and controller sources', () => {
    const stick = pad();
    const map = new InputMap({
      bindings: { KeyD: 'roll' },
      axes: [{ axis: 7, action: 'roll', deadZone: 0.2 }],
      getGamepads: () => [null, stick],
    });
    map.update();
    expect(map.value('roll')).toBeCloseTo(0.5);
    map.press('KeyD');
    expect(map.value('roll')).toBe(1);
    map.release('KeyD');
    expect(map.value('roll')).toBeCloseTo(0.5);
    stick.axes = [0];
    map.update();
    expect(map.value('roll')).toBe(0);
    expect(
      normalizeInputAxis(0.6, {
        action: 'x',
        axis: 0,
        min: -0.8,
        center: 0.2,
        max: 1,
        invert: true,
        deadZone: 0,
      }),
    ).toBeCloseTo(-0.5);
    expect(
      normalizeInputAxis(0.6, {
        action: 'x',
        axis: 0,
        mode: 'negative',
        invert: true,
        deadZone: 0,
        curve: 2,
      }),
    ).toBeCloseTo(0.36);
    expect(normalizeInputAxis(0, { action: 'x', axis: 0, mode: 'unit' })).toBe(0.5);
    expect(normalizeInputAxis(-1, { action: 'x', axis: 0, mode: 'unit', invert: true })).toBe(1);
    expect(normalizeInputAxis(Number.NaN, { action: 'x', axis: 0, mode: 'unit' })).toBe(0);
  });

  it('keeps actions held until all sources release and handles sparse/unplugged devices', () => {
    const stick = pad();
    let pads: (InputGamepad | null)[] = [null, stick];
    const map = new InputMap({
      bindings: { KeyF: 'flaps.up' },
      buttons: [{ button: 0, action: 'flaps.up' }],
      getGamepads: () => pads,
    });
    const edges: string[] = [];
    map.onPress('flaps.up', () => edges.push('press'));
    map.onRelease('flaps.up', () => edges.push('release'));
    press(stick, true);
    map.update();
    map.update();
    map.press('KeyF');
    pads = [];
    map.update();
    expect(map.isActive('flaps.up')).toBe(true);
    map.release('KeyF');
    expect(edges).toEqual(['press', 'release']);
  });

  it('selects exact device identities and indices without assuming standard layouts', () => {
    const a = pad(0);
    const b = pad(3);
    press(a, true);
    const map = new InputMap({
      bindings: {},
      buttons: [{ button: 0, action: 'gear', device: { id: b.id, index: 3 } }],
      getGamepads: () => [a, null, null, b],
    });
    map.update();
    expect(map.isActive('gear')).toBe(false);
    press(b, true);
    map.update();
    expect(map.isActive('gear')).toBe(true);
    const snapshot = map.devices();
    Object.assign(snapshot[1] ?? {}, { axes: [99] });
    expect(map.devices()[1]?.axes[0]).toBe(0);
  });

  it('releases old actions and requires a new press after profile changes or remapping', () => {
    const stick = pad();
    const map = new InputMap({
      bindings: {},
      profiles: {
        walking: { bindings: { Space: 'jump' }, buttons: [{ button: 0, action: 'jump' }] },
        flying: {
          bindings: { Space: 'flaps.up' },
          buttons: [{ button: 0, action: 'flaps.fullUp' }],
        },
      },
      profile: 'walking',
      getGamepads: () => [stick],
    });
    map.press('Space');
    press(stick, true);
    map.update();
    map.setProfile('flying');
    map.update();
    map.press('Space');
    expect(map.activeActions().size).toBe(0);
    map.release('Space');
    press(stick, false);
    map.update();
    map.press('Space');
    press(stick, true);
    map.update();
    expect(map.activeActions()).toEqual(new Set(['flaps.up', 'flaps.fullUp']));
    const profile = map.getProfile();
    profile.bindings.Space = 'gear';
    map.defineProfile('flying', profile);
    map.update();
    expect(map.activeActions().size).toBe(0);
    map.release('Space');
    map.press('Space');
    expect(map.isActive('gear')).toBe(true);
    profile.bindings.Space = 'mutated';
    expect(map.getProfile().bindings.Space).toBe('gear');
    expect(() =>
      map.defineProfile('flying', { bindings: {}, axes: [{ action: 'x', axis: 0, min: 1 }] }),
    ).toThrow();
    expect(() => map.setProfile('missing')).toThrow();
    expect(map.activeProfile).toBe('flying');
    expect(map.getProfile(undefined).bindings).toEqual({});
  });

  it('supports reentrant profile changes from an action handler without firing stale edges', () => {
    const stick = pad();
    press(stick, true);
    const map = new InputMap({
      bindings: {},
      buttons: [
        { action: 'board', button: 0 },
        { action: 'jump', button: 0 },
      ],
      profiles: { flying: { bindings: {} } },
      getGamepads: () => [stick],
    });
    let jumps = 0;
    map.onPress('board', () => map.setProfile('flying'));
    map.onPress('jump', () => jumps++);
    map.update();
    expect(map.activeProfile).toBe('flying');
    expect(jumps).toBe(0);
    expect(map.activeActions().size).toBe(0);
  });

  it('suspends gameplay but keeps discovery available; focus cannot override UI suspension', () => {
    const handlers = new Map<string, (event: unknown) => void>();
    const target = {
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        handlers.set(type, listener),
      removeEventListener: (type: string) => handlers.delete(type),
    };
    const stick = pad();
    const map = new InputMap({
      bindings: { KeyW: 'move' },
      axes: [{ axis: 7, action: 'roll' }],
      buttons: [{ button: 0, action: 'fire' }],
      target,
      getGamepads: () => [stick],
    });
    map.press('KeyW');
    map.update();
    handlers.get('blur')?.({});
    map.update();
    expect(map.activeActions().size).toBe(0);
    const resume = map.suspend();
    handlers.get('focus')?.({});
    press(stick, true);
    map.update();
    expect(map.devices()).toHaveLength(1);
    expect(map.activeActions().size).toBe(0);
    resume();
    resume();
    map.update();
    expect(map.isActive('fire')).toBe(false);
    expect(map.value('roll')).toBeGreaterThan(0);
    press(stick, false);
    map.update();
    press(stick, true);
    map.update();
    expect(map.isActive('fire')).toBe(true);
    map.dispose();
    expect(handlers.size).toBe(0);
    map.press('KeyW');
    map.update();
    expect(map.activeActions().size).toBe(0);
  });

  it('emits scalar and analog movement values and neutralizes immediately on a profile switch', () => {
    const stick = pad();
    stick.axes = [0.6, -0.4];
    const input = {
      bindings: { KeyA: 'left' },
      axes: [
        { action: 'right', axis: 0, deadZone: 0 },
        { action: 'up', axis: 1, mode: 'negative' as const, deadZone: 0 },
      ],
      emit: [
        {
          kind: 'axis2d' as const,
          xPos: 'right',
          xNeg: 'left',
          yPos: 'down',
          yNeg: 'up',
          command: 'move',
          field: 'dir',
        },
      ],
    };
    const map = new InputMap({
      ...input,
      profiles: { flying: { bindings: {} } },
      getGamepads: () => [stick],
    });
    let tick = (): void => {};
    const emitted: unknown[] = [];
    const off = applyInputRules(input, map, (_type, payload) => emitted.push(payload), {
      timer: {
        set: (fn) => {
          tick = fn;
        },
        clear: () => {},
      },
    });
    tick();
    expect(emitted).toEqual([{ dir: [0.6, -0.4] }]);
    map.setProfile('flying'); // no timer advance needed to stop old movement
    expect(emitted.at(-1)).toEqual({ dir: [0, 0] });
    off();
  });

  it('neutralizes after access failures and polls button-only scenes', () => {
    const stick = pad();
    press(stick, true);
    let blocked = false;
    const input = {
      bindings: {},
      buttons: [{ action: 'flaps.fullUp', button: 0 }],
      axes: [{ action: 'pitch', axis: 7, deadZone: 0 }],
      emit: [
        {
          kind: 'press' as const,
          action: 'flaps.fullUp',
          command: 'flaps',
          payload: { position: 0 },
        },
        { kind: 'axis' as const, action: 'pitch', command: 'pitch', field: 'value' },
      ],
    };
    const map = new InputMap({
      ...input,
      getGamepads: () => {
        if (blocked) throw new Error('SecurityError');
        return [stick];
      },
    });
    let tick = (): void => {};
    const emitted: unknown[] = [];
    const off = applyInputRules(input, map, (type, payload) => emitted.push([type, payload]), {
      timer: {
        set: (fn) => {
          tick = fn;
        },
        clear: () => {},
      },
    });
    tick();
    tick();
    blocked = true;
    tick();
    expect(emitted).toEqual([
      ['flaps', { position: 0 }],
      ['pitch', { value: 0.6 }],
      ['pitch', { value: 0 }],
    ]);
    expect(map.gamepadStatus).toBe('blocked');
    off();
    const buttonMap = new InputMap({
      bindings: {},
      buttons: input.buttons,
      getGamepads: () => [stick],
    });
    const buttonOff = applyInputRules(
      { ...input, emit: input.emit.slice(0, 1) },
      buttonMap,
      (type) => emitted.push(type),
      {
        timer: {
          set: (fn) => {
            tick = fn;
          },
          clear: () => {},
        },
      },
    );
    tick();
    expect(emitted.at(-1)).toBe('flaps');
    buttonOff();
  });
});
