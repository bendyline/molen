import type { JsonValue } from '@bendyline/molen-schema';
import { type ResolvedStylePack, resolveStylePackDocuments } from '../../src/kernel/stylepack';

/** A compact archstyle using palette refs only (no material documents needed). */
export function testStyle(id: string, overrides: Record<string, unknown> = {}): JsonValue {
  return {
    format: 'molen/archstyle@1',
    id,
    title: id,
    version: 1,
    applicability: { classes: ['house', 'building', 'hall'] },
    massing: {
      floorHeight: { min: 2.8, max: 3 },
      heightFallback: [
        { when: { areaMax: 90 }, levels: { min: 1, max: 1 } },
        { levels: { min: 2, max: 2 } },
      ],
      groundFit: 'platform-average',
      foundation: { height: { min: 0.4, max: 0.6 }, exposeOnSlope: true },
      wings: {
        split: 'rectangles',
        maxWingSpan: 14,
        minWingArea: 12,
        secondaryHeightScale: { min: 1, max: 1 },
      },
      setbacks: [],
      respectMinHeight: true,
    },
    roof: {
      perWing: true,
      ridge: 'long-axis',
      overhang: { min: 0.5, max: 0.5 },
      complexFootprint: 'wings',
      choices: [
        { type: 'gable', weight: 6, pitchDeg: { min: 30, max: 40 }, when: { elongationMin: 1.15 } },
        { type: 'hip', weight: 3, pitchDeg: { min: 25, max: 35 } },
        { type: 'flat', weight: 1, parapet: { height: { min: 0.5, max: 0.8 }, thickness: 0.3 } },
      ],
      fallback: 'flat',
    },
    facade: {
      bays: { width: { min: 3, max: 3 }, cornerMargin: 0.5 },
      windows: {
        style: 'punched',
        width: { min: 1, max: 1.4 },
        height: { min: 1.2, max: 1.4 },
        sill: { min: 0.9, max: 0.9 },
        probabilityPerBay: 0.8,
        groundFloor: 'same',
      },
      bands: { base: { height: { min: 0.3, max: 0.4 } }, floorLines: false },
    },
    materials: {
      wall: {
        choices: [
          { ref: 'palette:#c8bfa8', weight: 2 },
          { ref: 'palette:#a9b3c0', weight: 1 },
        ],
        palette: 'wall',
        tint: 'multiply',
        uv: 'meters',
        uvScale: [3, 3],
        uvOffset: 'meters',
        uvMirror: true,
      },
      roof: {
        choices: [{ ref: 'palette:#4a4744', weight: 1 }],
        palette: 'roof',
        tint: 'multiply',
        uv: 'meters',
        uvScale: [2, 2],
        uvOffset: 'meters',
        uvMirror: false,
      },
      trim: {
        choices: [{ ref: 'palette:#f2efe6', weight: 1 }],
        tint: 'none',
        uv: 'meters',
        uvOffset: 'none',
        uvMirror: false,
      },
      foundation: {
        choices: [{ ref: 'palette:#8a8580', weight: 1 }],
        tint: 'none',
        uv: 'meters',
        uvOffset: 'none',
        uvMirror: false,
      },
    },
    palettes: {
      wall: {
        entries: [
          { color: '#8b9a7a', weight: 3 },
          { color: '#5e6b7a', weight: 3 },
          { color: '#ece7dc', weight: 1 },
        ],
        jitter: { hue: 0.02, saturation: 0.05, lightness: 0.05 },
      },
      roof: {
        entries: [
          { color: '#3f4245', weight: 5 },
          { color: '#5a4a3c', weight: 2 },
        ],
        jitter: { hue: 0.01, saturation: 0.04, lightness: 0.05 },
      },
    },
    props: [],
    lod: {
      tiers: [
        {
          minTier: 0,
          keep: ['roof-shape', 'roof-features', 'facade-texture', 'facade-bands', 'props'],
        },
        { minTier: 1, keep: ['roof-shape', 'facade-texture'] },
        { minTier: 2, keep: ['roof-shape'] },
      ],
    },
    ...overrides,
  } as JsonValue;
}

/** Scatter rules over builtin models so tests need no GLB assets. */
export const TEST_SCATTER: JsonValue = {
  format: 'molen/scatter@1',
  id: 'test.pack.scatter.basic',
  title: 'test scatter',
  version: 1,
  surface: { default: '#777777', colors: { forest: '#335533', grass: '#668844' } },
  defaults: {
    avoid: { roads: 4, buildings: 2, water: 1 },
    slopeMax: 0.7,
    lod: { keepByTier: [1, 0.4, 0.1], maxInstancesPerBatch: 5000 },
  },
  rules: [
    {
      id: 'forest',
      classes: ['forest', 'wood'],
      densityPerHectare: 400,
      minSpacing: 2,
      populations: [
        {
          model: 'builtin:tree.conifer',
          weight: 3,
          scale: { min: 0.8, max: 1.2 },
          yaw: 'random',
          align: 'up',
        },
        {
          model: 'builtin:tree.deciduous',
          weight: 1,
          scale: { min: 0.8, max: 1.2 },
          yaw: 'random',
          align: 'up',
        },
      ],
    },
    {
      id: 'meadow',
      classes: ['grass', 'meadow'],
      densityPerHectare: 60,
      minSpacing: 3,
      clustering: { scale: 40, threshold: 0.3, contrast: 1.5, seedOffset: 1 },
      populations: [
        {
          model: 'builtin:shrub',
          weight: 1,
          scale: { min: 0.6, max: 1.4 },
          yaw: 'random',
          align: 'normal',
          tint: { hue: 0.02, saturation: 0.1, lightness: 0.1 },
        },
      ],
    },
  ],
};

export const TEST_PACK_ROOT: JsonValue = {
  format: 'molen/stylepack@1',
  name: 'test-pack',
  version: '1',
  namespace: 'test.pack',
  styles: {
    'test.pack.house': 'house.archstyle.json',
    'test.pack.box': 'box.archstyle.json',
  },
  scatter: { 'test.pack.scatter.basic': 'basic.scatter.json' },
  materials: {},
  assets: {},
  defaults: {
    style: 'test.pack.box',
    scatter: 'test.pack.scatter.basic',
    rules: [{ when: { class: ['house', 'hall'] }, style: 'test.pack.house' }],
  },
  imports: [],
  attribution: [{ text: 'test', license: 'MIT' }],
};

export const TEST_PACK_DOCS: Readonly<Record<string, JsonValue>> = {
  'house.archstyle.json': testStyle('test.pack.house'),
  'box.archstyle.json': testStyle('test.pack.box', {
    applicability: { classes: ['building'] },
    roof: {
      perWing: false,
      ridge: 'long-axis',
      overhang: { min: 0, max: 0 },
      complexFootprint: 'flat',
      choices: [
        { type: 'flat', weight: 1, parapet: { height: { min: 0.6, max: 0.6 }, thickness: 0.3 } },
      ],
      fallback: 'flat',
    },
  }),
  'basic.scatter.json': TEST_SCATTER,
};

export async function createTestPack(): Promise<ResolvedStylePack> {
  return resolveStylePackDocuments(TEST_PACK_ROOT, async (path) => {
    const doc = TEST_PACK_DOCS[path];
    if (doc === undefined) throw new Error(`no test doc ${path}`);
    return structuredClone(doc);
  });
}
