import type { MaterialBaker } from './bake-worker';
import { bakeMatGraph } from './matgraph';
import type { MatGraphDoc } from './matgraph-types';
import { bakePixelGrid } from './pixelgrid';
import type { PixelGridDoc } from './pixelgrid-types';
import type { BakedMaterial, RGBAImage } from './types';

/** Persistent storage for baked materials (e.g. IndexedDB), keyed by baker and document. */
export interface BakedMaterialStore {
  get(key: string): Promise<BakedMaterial | undefined>;
  set(key: string, material: BakedMaterial): Promise<void>;
  /** Delete every entry `keep` rejects: output from a baker that has since changed. */
  prune?(keep: (key: string) => boolean): Promise<void>;
}

// Bumped when the stored record shape changes. Baker changes need no bump: they change the
// canary fingerprint below, which namespaces every key.
const RECORD_VERSION = 1;

// Every node type, variant and output slot, at a size that bakes in well under a millisecond.
// A change to any rasterizer changes these pixels, and with them every cache key.
const CANARY_GRAPH: MatGraphDoc = {
  format: 'molen/matgraph@1',
  size: [12, 12],
  seed: 7,
  nodes: [
    { id: 'uv', type: 'uv', params: {} },
    {
      id: 'st',
      type: 'uv-transform',
      input: 'uv',
      params: { scale: 2, offset: [0.1, 0.2], rotateDeg: 30 },
    },
    {
      id: 'simplex',
      type: 'noise',
      input: 'st',
      params: { kind: 'simplex', octaves: 3, lacunarity: 2, gain: 0.5, scale: 3, seedOffset: 1 },
    },
    {
      id: 'value',
      type: 'noise',
      input: 'st',
      params: { kind: 'value', octaves: 2, lacunarity: 2.2, gain: 0.6, scale: 4, seedOffset: 2 },
    },
    { id: 'f1', type: 'worley', input: 'st', params: { scale: 3, jitter: 0.8, output: 'f1' } },
    { id: 'f2', type: 'worley', params: { scale: 4, jitter: 1, output: 'f2' } },
    { id: 'edge', type: 'worley', params: { scale: 2, jitter: 0.6, output: 'f2-f1' } },
    { id: 'linear', type: 'gradient', params: { kind: 'linear', angleDeg: 45 } },
    { id: 'radial', type: 'gradient', params: { kind: 'radial', angleDeg: 0 } },
    { id: 'checker', type: 'checker', params: { scale: 3 } },
    {
      id: 'bricks',
      type: 'bricks',
      params: { rows: 3, cols: 2, mortarWidth: 0.1, offset: 0.5 },
    },
    {
      id: 'ramp',
      type: 'ramp',
      input: 'simplex',
      params: {
        stops: [
          { t: 0, color: '#203040' },
          { t: 1, color: '#c0a080cc' },
        ],
      },
    },
    {
      id: 'mix',
      type: 'blend',
      inputs: { a: 'ramp', b: 'checker' },
      params: { mode: 'mix', factor: 0.4 },
    },
    {
      id: 'multiply',
      type: 'blend',
      inputs: { a: 'mix', b: 'bricks' },
      params: { mode: 'multiply', factor: 0.7 },
    },
    {
      id: 'add',
      type: 'blend',
      inputs: { a: 'multiply', b: 'f1' },
      params: { mode: 'add', factor: 0.3 },
    },
    {
      id: 'screen',
      type: 'blend',
      inputs: { a: 'add', b: 'linear' },
      params: { mode: 'screen', factor: 0.5 },
    },
    {
      id: 'overlay',
      type: 'blend',
      inputs: { a: 'screen', b: 'radial' },
      params: { mode: 'overlay', factor: 0.6 },
    },
    {
      id: 'threshold',
      type: 'threshold',
      input: 'value',
      params: { edge: 0.5, smoothness: 0.2 },
    },
    { id: 'invert', type: 'invert', input: 'threshold', params: {} },
    {
      id: 'levels',
      type: 'levels',
      input: 'f2',
      params: { inMin: 0.1, inMax: 0.9, gamma: 1.4, outMin: 0.05, outMax: 0.95 },
    },
    { id: 'tint', type: 'const', params: { value: [0.2, 0.4, 0.6, 1] } },
    { id: 'occlusion', type: 'const', params: { value: 0.35 } },
    { id: 'normal', type: 'height-to-normal', input: 'edge', params: { strength: 2 } },
  ],
  outputs: {
    baseColor: 'overlay',
    roughness: 'invert',
    metalness: 'levels',
    normal: 'normal',
    emissive: 'tint',
    ao: 'occlusion',
  },
};

const CANARY_GRID: PixelGridDoc = {
  format: 'molen/pixelgrid@1',
  size: [3, 2],
  palette: { a: '#102030', b: 'transparent', c: '#ff8800cc' },
  rows: ['abc', 'cba'],
  slots: { baseColor: true, emissive: true },
  filter: 'nearest',
};

/** 53-bit string hash (cyrb53); cache keys only, never security. */
function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function describeBaked(material: BakedMaterial): string {
  const parts = [JSON.stringify(material.meta)];
  for (const [slot, image] of Object.entries(material.slots)) {
    parts.push(slot, String(image.width), String(image.height), String.fromCharCode(...image.data));
  }
  return parts.join('|');
}

/**
 * Identifies the rasterizers' current output, so stored results from a changed baker are never
 * served. Computed in this thread; worker bakers run the same bundled code.
 */
export function materialBakerFingerprint(): string {
  return `v${RECORD_VERSION}-${hashText(
    `${describeBaked(bakeMatGraph(CANARY_GRAPH))}#${describeBaked(bakePixelGrid(CANARY_GRID))}`,
  )}`;
}

function isImage(value: unknown): value is RGBAImage {
  const image = value as RGBAImage | undefined;
  return (
    image !== undefined &&
    Number.isSafeInteger(image.width) &&
    Number.isSafeInteger(image.height) &&
    image.data instanceof Uint8ClampedArray &&
    image.data.length === image.width * image.height * 4
  );
}

function isBakedMaterial(value: unknown): value is BakedMaterial {
  const material = value as BakedMaterial | undefined;
  return (
    typeof material === 'object' &&
    material !== null &&
    typeof material.slots === 'object' &&
    material.slots !== null &&
    Object.values(material.slots).every(isImage) &&
    (material.meta?.filter === 'nearest' || material.meta?.filter === 'linear')
  );
}

/**
 * Serve bakes from `store` when this baker has produced them before (on any earlier visit), and
 * store new results. Store failures fall back to baking; they never fail a material.
 */
export function withBakedMaterialStore(
  baker: MaterialBaker,
  store: BakedMaterialStore,
): MaterialBaker {
  let namespace: string | undefined;
  const scope = (): string => {
    if (namespace === undefined) {
      namespace = materialBakerFingerprint();
      const prefix = `${namespace}/`;
      void store.prune?.((key) => key.startsWith(prefix)).catch(() => {});
    }
    return namespace;
  };
  return {
    async bake(
      format: 'matgraph' | 'pixelgrid',
      doc: MatGraphDoc | PixelGridDoc,
    ): Promise<BakedMaterial> {
      const key = `${scope()}/${format}/${hashText(JSON.stringify(doc))}`;
      const stored = await store.get(key).catch(() => undefined);
      if (isBakedMaterial(stored)) return stored;
      const material =
        format === 'matgraph'
          ? await baker.bake('matgraph', doc as MatGraphDoc)
          : await baker.bake('pixelgrid', doc as PixelGridDoc);
      void store.set(key, material).catch(() => {});
      return material;
    },
  };
}
