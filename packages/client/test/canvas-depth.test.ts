import { describe, expect, it, vi } from 'vitest';
import { canvasDepthIsFloat } from '../src/three/canvas-depth';

const COLOR_BUFFER_BIT = 0x4000;
const DEPTH_BUFFER_BIT = 0x0100;
const ALWAYS = 0x0207;
const GREATER = 0x0204;

type Storage = (depth: number) => number;
const float32: Storage = (depth) => Math.fround(depth);
const fixedPoint =
  (bits: number, round: (value: number) => number): Storage =>
  (depth) =>
    round(depth * (2 ** bits - 1));

/**
 * One pixel of a default framebuffer whose depth buffer stores values through `storage`, behind
 * just enough of WebGL2 for the probe. Every other method records its call and does nothing.
 */
function fakeGl(storage: Storage, overrides: Record<string, unknown> = {}) {
  let color = [0, 0, 0, 0];
  let stored = 0;
  let clearDepth = 1;
  let func = ALWAYS;
  let depth = 0;
  let drawColor = [0, 0, 0, 0];
  const calls: string[] = [];
  const methods: Record<string, unknown> = {
    COLOR_BUFFER_BIT,
    DEPTH_BUFFER_BIT,
    ALWAYS,
    GREATER,
    createProgram: () => ({}),
    createShader: () => ({}),
    createVertexArray: () => ({}),
    getProgramParameter: () => true,
    getUniformLocation: (_program: unknown, name: string) => name,
    clearDepth: (value: number) => {
      clearDepth = value;
    },
    clear: (mask: number) => {
      if (mask & COLOR_BUFFER_BIT) color = [0, 0, 0, 0];
      if (mask & DEPTH_BUFFER_BIT) stored = storage(clearDepth);
    },
    depthFunc: (value: number) => {
      func = value;
    },
    uniform1f: (_location: unknown, value: number) => {
      depth = value;
    },
    uniform4f: (_location: unknown, ...value: number[]) => {
      drawColor = value;
    },
    drawArrays: () => {
      const incoming = storage(depth);
      if (func === ALWAYS || (func === GREATER && incoming > stored)) {
        stored = incoming;
        color = drawColor;
      }
    },
    readPixels: (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _f: number,
      _t: number,
      out: Uint8Array,
    ) => {
      out.set(color.map((channel) => Math.round(channel * 255)));
    },
    ...overrides,
  };
  const gl = new Proxy(methods, {
    get: (target, name: string) => {
      if (name in target) {
        const value = target[name];
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          calls.push(name);
          return (value as (...a: unknown[]) => unknown)(...args);
        };
      }
      if (/^[A-Z_0-9]+$/.test(name)) return 0;
      return (...args: unknown[]) => {
        calls.push(name);
        if (name === 'bindVertexArray' || name === 'useProgram')
          calls.push(`${name}:${args[0] === null}`);
      };
    },
  });
  return { gl: gl as unknown as WebGL2RenderingContext, calls };
}

describe('canvasDepthIsFloat', () => {
  it('finds a floating-point depth buffer (SwiftShader, Apple GPUs)', () => {
    expect(canvasDepthIsFloat(fakeGl(float32).gl)).toBe(true);
  });

  it.each([
    ['24-bit, rounding', fixedPoint(24, Math.round)],
    ['24-bit, truncating', fixedPoint(24, Math.floor)],
    ['16-bit, rounding', fixedPoint(16, Math.round)],
    ['16-bit, truncating', fixedPoint(16, Math.floor)],
  ])('finds a %s fixed-point buffer, where reversed depth gains nothing', (_name, storage) => {
    expect(canvasDepthIsFloat(fakeGl(storage).gl)).toBe(false);
  });

  it('answers false, never throws, when a shader, the link or the context fails', () => {
    expect(canvasDepthIsFloat(fakeGl(float32, { createShader: () => null }).gl)).toBe(false);
    expect(canvasDepthIsFloat(fakeGl(float32, { getProgramParameter: () => false }).gl)).toBe(
      false,
    );
    const lost = () => {
      throw new Error('context lost');
    };
    expect(canvasDepthIsFloat(fakeGl(float32, { readPixels: lost, deleteProgram: lost }).gl)).toBe(
      false,
    );
  });

  it("leaves three's default vertex array and no program bound, and releases what it made", () => {
    const { gl, calls } = fakeGl(float32);
    const remove = vi.fn();
    canvasDepthIsFloat(
      new Proxy(gl, {
        get: (target, name: string) =>
          name.startsWith('delete') ? remove : (target as unknown as Record<string, unknown>)[name],
      }),
    );
    expect(calls.filter((call) => call.startsWith('bindVertexArray:')).at(-1)).toBe(
      'bindVertexArray:true',
    );
    expect(calls.filter((call) => call.startsWith('useProgram:')).at(-1)).toBe('useProgram:true');
    // The vertex array, both shaders and the program.
    expect(remove).toHaveBeenCalledTimes(4);
  });
});
