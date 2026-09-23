import type { PackFile } from '../src/build';
import type { RangeReader } from '../src/source';

export const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Deterministic pseudo-random bytes that don't compress. */
export function noise(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out[i] = state & 0xff;
  }
  return out;
}

/** A small pack's worth of files: JSON docs, a sidecar with its model and variant, a notice. */
export function sampleFiles(): PackFile[] {
  const sidecar = {
    format: 'molen/asset@1',
    id: 'example.vehicle.roadster',
    kind: 'model',
    files: { main: 'model.glb', variants: { ktx2: 'model.ktx2.glb' } },
  };
  return [
    { path: 'NOTICE.md', bytes: encode('# Notice\n\nExample content, CC0.\n') },
    { path: 'types/vehicles.types.json', bytes: encode(JSON.stringify({ a: 1, list: [1, 2, 3] })) },
    { path: 'types/aircraft.types.json', bytes: encode(JSON.stringify({ b: 'two' })) },
    { path: 'models/roadster/asset.json', bytes: encode(JSON.stringify(sidecar)) },
    { path: 'models/roadster/model.glb', bytes: noise(3000, 7) },
    { path: 'models/roadster/model.ktx2.glb', bytes: noise(2000, 9) },
    { path: 'models/roadster/empty.bin', bytes: new Uint8Array(0) },
  ];
}

/** A RangeReader over bytes that records every read. */
export function recordingReader(bytes: Uint8Array): RangeReader & {
  reads: { offset: number; length: number }[];
} {
  const reads: { offset: number; length: number }[] = [];
  return {
    size: bytes.length,
    reads,
    read: async (offset, length) => {
      reads.push({ offset, length });
      return bytes.slice(offset, offset + length);
    },
  };
}
