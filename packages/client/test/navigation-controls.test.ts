import { describe, expect, it } from 'vitest';
import { createNavigationControls } from '../src/navigation/controls';
import { NAVIGATION_ACTIONS as A, NavigationInputSource } from '../src/navigation/input-source';

/** Just enough of an element for the controls editor to build itself without a DOM. */
function fakeElement(): Record<string, unknown> {
  return {
    style: {},
    ownerDocument: undefined,
    setAttribute() {},
    append() {},
    addEventListener() {},
    removeEventListener() {},
    replaceChildren() {},
    showModal() {},
    close() {},
    remove() {},
    focus() {},
  };
}

function fakeDocument(saved: Record<string, string>) {
  const doc = {
    createElement: fakeElement,
    body: fakeElement(),
    defaultView: {
      localStorage: {
        getItem: (key: string) => saved[key] ?? null,
        setItem: (key: string, value: string) => {
          saved[key] = value;
        },
      },
    },
  };
  return doc;
}

describe('navigation controller settings', () => {
  it('moves saved any-controller look bindings to standard gamepads and keeps custom ones', () => {
    const oldSticks = [
      { axis: 0, action: A.left, mode: 'negative' },
      { axis: 0, action: A.right, mode: 'positive' },
      { axis: 1, action: A.forward, mode: 'negative' },
      { axis: 1, action: A.back, mode: 'positive' },
      { axis: 2, action: A.lookLeft, mode: 'negative' },
      { axis: 2, action: A.lookRight, mode: 'positive' },
      { axis: 3, action: A.lookUp, mode: 'negative' },
      { axis: 3, action: A.lookDown, mode: 'positive' },
    ];
    const custom = {
      axis: 3,
      action: A.lookUp,
      mode: 'negative',
      device: { id: 'Flight stick' },
      invert: true,
      deadZone: 0.2,
    };
    const saved = {
      'test-controls': JSON.stringify({
        fly: { bindings: {}, axes: oldSticks, buttons: [] },
        pilot: { bindings: {}, axes: [custom] },
      }),
    };
    const doc = fakeDocument(saved);
    const container = { ...fakeElement(), ownerDocument: doc };
    const stick = {
      id: 'Flight stick',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0, 0, 0, -1],
      buttons: [],
    };
    const source = new NavigationInputSource({
      element: {
        addEventListener() {},
        removeEventListener() {},
      } as unknown as ConstructorParameters<typeof NavigationInputSource>[0]['element'],
      profile: 'fly',
      getGamepads: () => [stick],
    });
    const controls = createNavigationControls(source, {
      container: container as unknown as HTMLElement,
      focusTarget: fakeElement() as unknown as HTMLElement,
      storageKey: 'test-controls',
    });
    try {
      const fly = source.map.getProfile('fly').axes ?? [];
      expect(fly.slice(0, 4).every((binding) => binding.device === undefined)).toBe(true);
      expect(fly.slice(4).map((binding) => binding.device)).toEqual(
        Array(4).fill({ mapping: 'standard' }),
      );
      // The flight stick's throttle, resting at a stop on axis 3, no longer turns the view.
      expect(source.read(0.5).look).toEqual([0, 0]);
      expect(source.map.getProfile('pilot').axes).toEqual([custom]);
    } finally {
      controls.dispose();
      source.dispose();
    }
  });
});
