import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { weldVertices } from '../src/weld-vertices';

/** Deterministic pseudo-random numbers in [0, 1). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Triangles drawn from a small vertex pool, so most vertices repeat: some exactly, some within
 * the weld tolerance, some just across a quantization boundary, with an occasional NaN.
 */
function geometry(seed: number, triangles: number, poolSize: number, tolerance: number) {
  const next = random(seed);
  const sizes = { position: 3, normal: 3, color: 3, detail: 2, blend: 4 } as const;
  const pool = Array.from({ length: poolSize }, () =>
    Object.fromEntries(
      Object.entries(sizes).map(([name, size]) => [
        name,
        Array.from({ length: size }, () => Math.round((next() - 0.5) * 2000) / 7),
      ]),
    ),
  );
  const arrays = Object.fromEntries(
    Object.entries(sizes).map(([name, size]) => [name, new Float32Array(triangles * 3 * size)]),
  );
  for (let vertex = 0; vertex < triangles * 3; vertex++) {
    const source = pool[Math.floor(next() * poolSize)] as Record<string, number[]>;
    for (const [name, size] of Object.entries(sizes)) {
      for (let k = 0; k < size; k++) {
        const roll = next();
        let value = (source[name] as number[])[k] as number;
        if (roll < 0.1) value += tolerance * 0.2;
        else if (roll < 0.15) value += tolerance * 0.9;
        else if (roll < 0.152) value = Number.NaN;
        (arrays[name] as Float32Array)[vertex * size + k] = value;
      }
    }
  }
  const result = new THREE.BufferGeometry();
  for (const [name, size] of Object.entries(sizes))
    result.setAttribute(name, new THREE.Float32BufferAttribute(arrays[name] as Float32Array, size));
  result.addGroup(0, triangles * 3, 1);
  return result;
}

function expectSame(actual: THREE.BufferGeometry, expected: THREE.BufferGeometry): void {
  expect(Object.keys(actual.attributes)).toEqual(Object.keys(expected.attributes));
  for (const name of Object.keys(expected.attributes)) {
    const a = actual.getAttribute(name) as THREE.BufferAttribute;
    const e = expected.getAttribute(name) as THREE.BufferAttribute;
    expect(a.constructor).toBe(e.constructor);
    expect(a.itemSize).toBe(e.itemSize);
    expect(a.normalized).toBe(e.normalized);
    expect(bytes(a.array).equals(bytes(e.array)), name).toBe(true);
  }
  expect(actual.index?.constructor).toBe(expected.index?.constructor);
  expect(actual.index?.array.constructor).toBe(expected.index?.array.constructor);
  if (expected.index !== null)
    expect(
      bytes((actual.index as THREE.BufferAttribute).array).equals(bytes(expected.index.array)),
    ).toBe(true);
  expect(actual.groups).toEqual(expected.groups);
}

/** The bytes of a typed array, compared whole (element-wise equality is slow at this size). */
function bytes(array: THREE.TypedArray): Buffer {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

describe('weldVertices', () => {
  it('matches three mergeVertices exactly, including near-tolerance values and NaN', () => {
    for (const [seed, tolerance] of [
      [1, 1e-5],
      [2, 1e-4],
      [3, 0.01],
      [4, 0.5],
    ] as const) {
      const source = geometry(seed, 3000, 700, tolerance);
      const welded = weldVertices(source, tolerance);
      expectSame(welded, mergeVertices(source, tolerance));
      expect(welded.getAttribute('position').count).toBeLessThan(
        source.getAttribute('position').count,
      );
    }
  });

  it('welds indexed geometry and switches to 32-bit indices past 65534 vertices', {
    timeout: 30_000,
  }, () => {
    const indexed = mergeVertices(geometry(5, 2000, 400, 1e-3), 1e-4);
    expectSame(weldVertices(indexed, 1e-3), mergeVertices(indexed, 1e-3));
    // Nearly every vertex distinct: the welded count crosses the 16-bit primitive-restart limit.
    const large = geometry(6, 23_000, 1_000_000, 1e-6);
    const welded = weldVertices(large, 1e-6);
    expect(welded.index?.array).toBeInstanceOf(Uint32Array);
    expectSame(welded, mergeVertices(large, 1e-6));
  });

  it('defers to three for attributes it does not read directly', () => {
    const source = geometry(7, 50, 20, 1e-4);
    const color = source.getAttribute('color') as THREE.BufferAttribute;
    source.setAttribute(
      'color',
      new THREE.Uint8BufferAttribute(
        Array.from(color.array, (value) => Math.abs(Math.round(value)) % 256),
        3,
        true,
      ),
    );
    expectSame(weldVertices(source, 1e-4), mergeVertices(source, 1e-4));
  });
});
