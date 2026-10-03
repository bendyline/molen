/**
 * Preserve historical render provenance through the RGB alignment repair. This does not approve
 * a new model: it reconstructs the exact historical GLB and checks its recorded SHA-256. Callers
 * must still check the unchanged runtime hash, capture reports, images and material graphs.
 */
import { createHash } from 'node:crypto';
import { matchesEvidenceText } from './evidence-text-hash.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const align4 = (n) => (n + 3) & ~3;

export function historicalRgbEncoding(bytes) {
  if (!bytes || bytes.length < 28) return undefined;
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (input.readUInt32LE(0) !== 0x46546c67 || input.readUInt32LE(8) !== input.length)
    return undefined;
  const jsonLength = input.readUInt32LE(12);
  const binaryStart = 28 + jsonLength;
  if (binaryStart > input.length) return undefined;
  const doc = JSON.parse(input.subarray(20, 20 + jsonLength).toString());
  if (doc.buffers?.length !== 1 || !doc.bufferViews) return undefined;
  // The portable texture appender records the unpadded payload size; the base encoder records
  // the padded size. Preserve that distinction as well as the actual BIN chunk padding.
  const unpaddedBufferLength = doc.buffers[0].byteLength % 4 !== 0;
  const colors = new Map();
  for (const mesh of doc.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const a = doc.accessors[primitive.attributes?.COLOR_0];
      if (a?.type !== 'VEC3' || a.componentType !== 5121 || !a.normalized || a.byteOffset)
        return undefined;
      const view = doc.bufferViews[a.bufferView];
      if (view.byteStride !== 4 || view.byteLength !== a.count * 4) return undefined;
      colors.set(a.bufferView, a.count);
    }
  }
  if (!colors.size) return undefined;
  const parts = [];
  let offset = 0;
  for (const [index, view] of doc.bufferViews.entries()) {
    if (view.buffer !== 0) return undefined;
    const data = input.subarray(
      binaryStart + view.byteOffset,
      binaryStart + view.byteOffset + view.byteLength,
    );
    if (data.length !== view.byteLength) return undefined;
    let packed = data;
    if (colors.has(index)) {
      packed = Buffer.alloc(colors.get(index) * 3);
      for (let vertex = 0; vertex < colors.get(index); vertex++) {
        if (data[vertex * 4 + 3] !== 0) return undefined;
        data.copy(packed, vertex * 3, vertex * 4, vertex * 4 + 3);
      }
      delete view.byteStride;
    }
    offset = align4(offset);
    view.byteOffset = offset;
    view.byteLength = packed.length;
    parts.push({ offset, data: packed });
    offset += packed.length;
  }
  const binary = Buffer.alloc(align4(offset));
  for (const part of parts) part.data.copy(binary, part.offset);
  doc.buffers[0].byteLength = unpaddedBufferLength ? offset : binary.length;
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.alloc(align4(json.length), 0x20);
  json.copy(padded);
  const old = Buffer.alloc(28 + padded.length + binary.length);
  old.writeUInt32LE(0x46546c67, 0);
  old.writeUInt32LE(2, 4);
  old.writeUInt32LE(old.length, 8);
  old.writeUInt32LE(padded.length, 12);
  old.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(old, 20);
  old.writeUInt32LE(binary.length, 20 + padded.length);
  old.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(old, 28 + padded.length);
  return { hash: hash(old), byteLength: old.length };
}

export function reviewedGlbEncoding(source, currentHash) {
  let historical;
  let computed = false;
  const previous = () => {
    if (!computed) {
      historical = historicalRgbEncoding(source);
      computed = true;
    }
    return historical;
  };
  return {
    matchesSource(expected) {
      return Boolean(expected && (expected === currentHash || expected === previous()?.hash));
    },
    matchesSpec(bytes, expected) {
      if (matchesEvidenceText(bytes, expected)) return true;
      if (!bytes || !expected) return false;
      const old = previous();
      if (!old) return false;
      const spec = JSON.parse(bytes.toString());
      if (spec.mesh?.sha256 !== currentHash || spec.mesh?.bytes !== source.length) return false;
      const restored = bytes
        .toString()
        .replaceAll(currentHash, old.hash)
        .replace(
          /("mesh"\s*:\s*\{[^{}]*"bytes"\s*:\s*)\d+/,
          (_match, prefix) => `${prefix}${old.byteLength}`,
        );
      return matchesEvidenceText(Buffer.from(restored), expected);
    },
  };
}
