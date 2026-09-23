import { describe, expect, it } from 'vitest';
import { InputMap, resolveAction } from '../src/input';

const bindings = {
  KeyW: 'move.up',
  KeyS: 'move.down',
  Space: 'fire',
  Mouse0: 'select',
};

describe('resolveAction', () => {
  it('maps codes to actions', () => {
    expect(resolveAction(bindings, 'KeyW')).toBe('move.up');
    expect(resolveAction(bindings, 'Mouse0')).toBe('select');
    expect(resolveAction(bindings, 'KeyQ')).toBeUndefined();
  });
});

describe('InputMap', () => {
  it('tracks held actions from press/release', () => {
    const im = new InputMap({ bindings });
    im.press('KeyW');
    expect(im.isActive('move.up')).toBe(true);
    expect(im.activeActions()).toEqual(new Set(['move.up']));
    im.release('KeyW');
    expect(im.isActive('move.up')).toBe(false);
  });

  it('fires discrete press callbacks on the rising edge only', () => {
    const im = new InputMap({ bindings });
    let fires = 0;
    im.onPress('fire', () => fires++);
    im.press('Space'); // edge -> fire
    im.press('Space'); // still held -> no new fire
    im.release('Space');
    im.press('Space'); // edge again -> fire
    expect(fires).toBe(2);
  });

  it('ignores unbound codes', () => {
    const im = new InputMap({ bindings });
    im.press('KeyZ');
    expect(im.activeActions().size).toBe(0);
  });

  it('keeps an action active while any of its physical bindings remains held', () => {
    const im = new InputMap({ bindings: { KeyW: 'move', ArrowUp: 'move' } });
    let presses = 0;
    im.onPress('move', () => presses++);
    im.press('KeyW');
    im.press('ArrowUp');
    im.release('KeyW');
    expect(im.isActive('move')).toBe(true);
    expect(presses).toBe(1);
    im.release('ArrowUp');
    expect(im.isActive('move')).toBe(false);
  });

  it('attaches to an injected event target', () => {
    const handlers = new Map<string, (ev: unknown) => void>();
    const target = {
      addEventListener: (type: string, fn: (ev: unknown) => void) => handlers.set(type, fn),
      removeEventListener: (type: string) => handlers.delete(type),
    };
    const im = new InputMap({ bindings, target });
    handlers.get('keydown')?.({ code: 'KeyW' });
    expect(im.isActive('move.up')).toBe(true);
    handlers.get('mousedown')?.({ button: 0 });
    expect(im.isActive('select')).toBe(true);
    handlers.get('blur')?.({});
    expect(im.activeActions()).toEqual(new Set());
    im.dispose();
    expect(handlers.size).toBe(0);
  });
});

describe('InputMap release edges', () => {
  it('fires release callbacks on the falling edge and on reset()', () => {
    const im = new InputMap({ bindings });
    const released: string[] = [];
    im.onRelease('move.up', (a) => released.push(a));
    im.press('KeyW');
    im.release('KeyW');
    im.release('KeyW'); // not held: no second edge
    im.press('KeyW');
    im.reset(); // blur: every held action releases
    expect(released).toEqual(['move.up', 'move.up']);
  });
});
