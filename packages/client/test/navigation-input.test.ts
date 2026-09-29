import { describe, expect, it } from 'vitest';
import { InputMap } from '../src/input';
import {
  NAVIGATION_ACTIONS as A,
  NavigationInputSource,
  navigationInputProfiles,
} from '../src/navigation/input-source';
import { NavigationPointer } from '../src/navigation/pointer';
import { TouchStick } from '../src/navigation/touch-joystick';

type Listener = (event: never) => void;

/** A minimal element: records listeners and lets a test dispatch events to them. */
class FakeSurface {
  readonly listeners = new Map<string, Set<Listener>>();
  captured = new Set<number>();
  focused = 0;
  ownerDocument: { pointerLockElement?: unknown; exitPointerLock?(): void } = {};
  lockRequests = 0;

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }
  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }
  setPointerCapture(id: number): void {
    this.captured.add(id);
  }
  releasePointerCapture(id: number): void {
    this.captured.delete(id);
  }
  hasPointerCapture(id: number): boolean {
    return this.captured.has(id);
  }
  getBoundingClientRect() {
    return { left: 10, top: 20, width: 800, height: 600 };
  }
  requestPointerLock(): void {
    this.lockRequests++;
  }
  focus(): void {
    this.focused++;
  }
  emit(type: string, event: Record<string, unknown>): void {
    for (const listener of this.listeners.get(type) ?? [])
      (listener as (e: unknown) => void)(event);
  }
  count(): number {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

const pointer = (pointerId: number, clientX: number, clientY: number, extra = {}) => ({
  pointerId,
  clientX,
  clientY,
  button: 0,
  pointerType: 'mouse',
  ...extra,
});

describe('navigation pointer gestures', () => {
  it('turns one-button drags into look and secondary drags into pan', () => {
    const surface = new FakeSurface();
    const gestures = new NavigationPointer(surface);
    surface.emit('pointerdown', pointer(1, 100, 100));
    surface.emit('pointermove', pointer(1, 130, 90));
    expect(surface.focused).toBe(1);
    expect(gestures.consume().look).toEqual([30, -10]);
    expect(gestures.consume().look).toEqual([0, 0]);
    surface.emit('pointerup', pointer(1, 130, 90));
    surface.emit('pointerdown', pointer(2, 0, 0, { button: 2 }));
    surface.emit('pointermove', pointer(2, 5, 7));
    const panned = gestures.consume();
    expect(panned.pan).toEqual([5, 7]);
    expect(panned.look).toEqual([0, 0]);
  });

  it('reads a two-finger pinch as zoom, twist and pan', () => {
    const surface = new FakeSurface();
    const gestures = new NavigationPointer(surface);
    surface.emit('pointerdown', pointer(1, 0, 0, { pointerType: 'touch' }));
    surface.emit('pointerdown', pointer(2, 100, 0, { pointerType: 'touch' }));
    surface.emit('pointermove', pointer(2, 0, 200, { pointerType: 'touch' }));
    const pinched = gestures.consume();
    expect(pinched.zoom).toBeCloseTo(Math.log(2), 9);
    expect(pinched.twist).toBeCloseTo(Math.PI / 2, 9);
    expect(pinched.pan).toEqual([-50, 100]);
    expect(pinched.look).toEqual([0, 0]);
  });

  it('zooms with the wheel and reports taps in element coordinates', () => {
    let now = 0;
    const surface = new FakeSurface();
    const gestures = new NavigationPointer(surface, { now: () => now });
    surface.emit('wheel', { deltaY: -400 });
    surface.emit('wheel', { deltaY: 1, deltaMode: 1 });
    surface.emit('pointerdown', pointer(1, 110, 220));
    now = 100;
    surface.emit('pointerup', pointer(1, 112, 221));
    surface.emit('pointerdown', pointer(2, 300, 300));
    now = 1000;
    surface.emit('pointerup', pointer(2, 300, 300));
    const result = gestures.consume();
    expect(result.zoom).toBeCloseTo(1 - 16 / 400, 9);
    // The slow press is a hold, not a tap.
    expect(result.taps).toEqual([{ x: 102, y: 201 }]);
  });

  it('uses pointer-lock movement for mouse look and removes its listeners on dispose', () => {
    const surface = new FakeSurface();
    const gestures = new NavigationPointer(surface);
    gestures.setPointerLock(true);
    surface.emit('pointerdown', pointer(1, 0, 0));
    expect(surface.lockRequests).toBe(1);
    surface.ownerDocument.pointerLockElement = surface;
    surface.emit('pointermove', { ...pointer(1, 0, 0), movementX: 4, movementY: -2 });
    expect(gestures.consume().look).toEqual([4, -2]);
    gestures.dispose();
    expect(surface.count()).toBe(0);
  });
});

describe('navigation input source', () => {
  it('combines keys, gamepad sticks and gestures, and counts interact presses', () => {
    const surface = new FakeSurface();
    const pad = {
      id: 'pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 1, 0],
      buttons: [],
    };
    const source = new NavigationInputSource({
      element: surface,
      profile: 'walk',
      getGamepads: () => [pad],
      gamepadLookSpeed: 100,
    });
    surface.emit('keydown', { code: 'KeyW' });
    surface.emit('keydown', { code: 'KeyE' });
    surface.emit('keyup', { code: 'KeyE' });
    surface.emit('keydown', { code: 'KeyE' });
    surface.emit('pointerdown', pointer(1, 0, 0));
    surface.emit('pointermove', pointer(1, 10, 0));
    const frame = source.read(0.5);
    expect(frame.move.forward).toBe(1);
    expect(frame.interact).toBe(2);
    // Right stick fully right adds 100 px/s * 0.5 s to the 10 px drag.
    expect(frame.look[0]).toBeCloseTo(60, 6);
    expect(source.read(0.5).interact).toBe(0);
    source.dispose();
    expect(surface.count()).toBe(0);
  });

  it('switches bindings per mode: E climbs in flight but interacts on foot', () => {
    const surface = new FakeSurface();
    const source = new NavigationInputSource({ element: surface, profile: 'fly' });
    surface.emit('keydown', { code: 'KeyE' });
    expect(source.read(0).move.up).toBe(1);
    surface.emit('keyup', { code: 'KeyE' });
    source.setProfile('walk');
    surface.emit('keydown', { code: 'KeyE' });
    const walking = source.read(0);
    expect(walking.move.up).toBe(0);
    expect(walking.interact).toBe(1);
    expect(Object.keys(navigationInputProfiles())).toEqual(['orbit', 'fly', 'walk', 'drive']);
  });
});

describe('virtual inputs and the touch stick', () => {
  it('lets software controls drive actions until released or reset', () => {
    const map = new InputMap({ bindings: { KeyW: A.forward } });
    map.setVirtual('stick', A.forward, 0.4);
    map.setVirtual('button', A.forward, 0.9);
    expect(map.value(A.forward)).toBe(0.9);
    map.clearVirtual('button');
    expect(map.value(A.forward)).toBe(0.4);
    map.press('KeyW');
    expect(map.value(A.forward)).toBe(1);
    map.release('KeyW');
    map.setVirtual('stick', A.forward, 0);
    expect(map.value(A.forward)).toBe(0);
    map.setVirtual('stick', A.left, 0.5);
    map.reset();
    expect(map.value(A.left)).toBe(0);
    map.setEnabled(false);
    map.setVirtual('stick', A.left, 0.5);
    expect(map.value(A.left)).toBe(0);
  });

  it('maps stick displacement to forward/right with a dead zone and clamped travel', () => {
    const stick = new TouchStick({ radius: 50, deadZone: 0.2 });
    stick.press(100, 100);
    stick.drag(105, 100);
    expect(stick.axes()).toEqual({ forward: 0, right: 0 });
    stick.drag(100, 0);
    expect(stick.knob).toEqual({ x: 0, y: -50 });
    expect(stick.axes().forward).toBeCloseTo(1, 9);
    stick.drag(125, 100);
    expect(stick.axes().right).toBeCloseTo((0.5 - 0.2) / 0.8, 9);
    stick.release();
    expect(stick.active).toBe(false);
    expect(stick.axes()).toEqual({ forward: 0, right: 0 });
  });
});
