import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { type AircraftInstrumentView, createAircraftInstrumentDisplay } from '../src/aircraft';

afterEach(() => vi.restoreAllMocks());

/** A canvas that counts context requests and has none to give (Node has no WebGL). */
function canvasWithoutWebGl() {
  const getContext = vi.fn(() => null);
  const canvas = {
    getContext,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    clientWidth: 248,
    clientHeight: 124,
    width: 0,
    height: 0,
    style: {},
  } as unknown as HTMLCanvasElement;
  return { canvas, getContext };
}

const view: AircraftInstrumentView = {
  kind: 'speed',
  node: 'needle-airspeed',
  scene: new THREE.Scene(),
  camera: new THREE.OrthographicCamera(),
  sync: () => undefined,
};

it('makes no context until there are instruments to draw', () => {
  const { canvas, getContext } = canvasWithoutWebGl();
  const display = createAircraftInstrumentDisplay(canvas);
  expect(display.update(undefined, 0)).toBe(false);
  expect(display.update([], 16)).toBe(false);
  expect(getContext).not.toHaveBeenCalled();
  display.dispose();
});

it('stays hidden, once warned, where WebGL is unavailable', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { canvas, getContext } = canvasWithoutWebGl();
  const display = createAircraftInstrumentDisplay(canvas);
  expect(display.update([view], 0)).toBe(false);
  const asked = getContext.mock.calls.length;
  expect(asked).toBeGreaterThan(0);
  expect(display.update([view], 100)).toBe(false);
  expect(getContext.mock.calls.length).toBe(asked);
  expect(warn).toHaveBeenCalledTimes(1);
  display.dispose();
  display.dispose();
  expect(display.update([view], 200)).toBe(false);
});
