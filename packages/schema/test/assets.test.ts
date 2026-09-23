import { describe, expect, it } from 'vitest';
import { decodeCollisionTrimesh, encodeCollisionTrimesh } from '../src/assets';

describe('collision trimesh binary boundary', () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint32Array([0, 1, 2]);

  it('round-trips a valid triangle', () => {
    const encoded = encodeCollisionTrimesh(positions, indices);
    const decoded = decodeCollisionTrimesh(
      {
        bin: 'collision.bin',
        positions: encoded.positions,
        indices: encoded.indices,
        hash: `sha256:${'0'.repeat(64)}`,
      },
      encoded.bin,
    );
    expect(decoded.positions).toEqual(positions);
    expect(decoded.indices).toEqual(indices);
  });

  it('rejects truncated, overlapping, misaligned, and non-triangle ranges', () => {
    const encoded = encodeCollisionTrimesh(positions, indices);
    const base = {
      bin: 'collision.bin',
      positions: encoded.positions,
      indices: encoded.indices,
      hash: `sha256:${'0'.repeat(64)}`,
    };
    expect(() => decodeCollisionTrimesh(base, encoded.bin.subarray(0, 8))).toThrow(/exceeds/);
    expect(() =>
      decodeCollisionTrimesh({ ...base, indices: { byteOffset: 4, count: 3 } }, encoded.bin),
    ).toThrow(/overlap/);
    expect(() =>
      decodeCollisionTrimesh({ ...base, positions: { byteOffset: 1, count: 3 } }, encoded.bin),
    ).toThrow(/aligned/);
    expect(() =>
      decodeCollisionTrimesh({ ...base, indices: { ...base.indices, count: 2 } }, encoded.bin),
    ).toThrow(/multiple of 3/);
  });

  it('rejects non-finite positions and out-of-bounds indices', () => {
    expect(() =>
      encodeCollisionTrimesh(new Float32Array([Number.NaN, 0, 0, 1, 0, 0, 0, 1, 0]), indices),
    ).toThrow(/not finite/);
    expect(() => encodeCollisionTrimesh(positions, new Uint32Array([0, 1, 3]))).toThrow(
      /out of bounds/,
    );
  });
});
