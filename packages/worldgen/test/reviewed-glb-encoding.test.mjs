import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { historicalRgbEncoding, reviewedGlbEncoding } from '../scripts/reviewed-glb-encoding.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

// A fixed one-vertex fixture in the former and corrected layouts. The historical hash must
// be derived independently of the compatibility reader being tested.
function fixture(aligned, { color = 7, name = 'unchanged', padding = 0, texture = false } = {}) {
  const doc = {
    asset: { version: '2.0', generator: 'fixture' },
    meshes: [{ name, primitives: [{ attributes: { COLOR_0: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5121, normalized: true, count: 1, type: 'VEC3' }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: aligned ? 4 : 3,
        target: 34962,
        ...(aligned ? { byteStride: 4 } : {}),
      },
    ],
    buffers: [{ byteLength: 4 }],
  };
  if (texture) {
    doc.bufferViews.push({ buffer: 0, byteOffset: 4, byteLength: 1 });
    doc.buffers[0].byteLength = 5;
    doc.images = [{ bufferView: 1, mimeType: 'image/png' }];
  }
  const text = Buffer.from(JSON.stringify(doc));
  const jsonLength = (text.length + 3) & ~3;
  const binaryLength = texture ? 8 : 4;
  const bytes = Buffer.alloc(28 + jsonLength + binaryLength);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(jsonLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.fill(0x20, 20, 20 + jsonLength);
  text.copy(bytes, 20);
  bytes.writeUInt32LE(binaryLength, 20 + jsonLength);
  bytes.writeUInt32LE(0x004e4942, 24 + jsonLength);
  bytes.set([color, 8, 9, padding], 28 + jsonLength);
  if (texture) bytes[32 + jsonLength] = 23;
  return bytes;
}

describe('historical review binding across RGB alignment', () => {
  it('reconstructs the exact historical bytes and accepts both source hashes', () => {
    const before = fixture(false),
      after = fixture(true);
    expect(historicalRgbEncoding(after)).toEqual({ hash: hash(before), byteLength: before.length });
    const binding = reviewedGlbEncoding(after, hash(after));
    expect(binding.matchesSource(hash(before))).toBe(true);
    expect(binding.matchesSource(hash(after))).toBe(true);
    expect(binding.matchesSource(undefined)).toBe(false);
    expect(historicalRgbEncoding(before)).toBeUndefined();
  });

  it('does not carry approval across changed vertex data, scene metadata or padding', () => {
    const previous = hash(fixture(false));
    for (const options of [{ color: 6 }, { name: 'changed' }, { padding: 1 }]) {
      const source = fixture(true, options);
      expect(reviewedGlbEncoding(source, hash(source)).matchesSource(previous)).toBe(false);
    }
  });

  it('retains the unpadded payload length used by embedded texture fallbacks', () => {
    const before = fixture(false, { texture: true });
    const after = fixture(true, { texture: true });
    expect(historicalRgbEncoding(after)).toEqual({ hash: hash(before), byteLength: before.length });
  });

  it('allows only the proven source hash and size changes in captured specs', () => {
    const before = fixture(false),
      after = fixture(true);
    const spec = (source, heading = 0) =>
      Buffer.from(
        JSON.stringify(
          {
            heading,
            mesh: { bytes: source.length, sha256: hash(source) },
          },
          null,
          2,
        ),
      );
    const binding = reviewedGlbEncoding(after, hash(after));
    expect(binding.matchesSpec(spec(after), hash(spec(before)))).toBe(true);
    expect(binding.matchesSpec(spec(after, 20), hash(spec(before)))).toBe(false);
    expect(binding.matchesSpec(spec(after), undefined)).toBe(false);
  });
});
