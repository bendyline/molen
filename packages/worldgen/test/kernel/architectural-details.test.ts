import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { ArchFacadeDetails, ArchStyleDoc } from '../../src/kernel/archstyle-types';
import { generateBuilding } from '../../src/kernel/building';
import { buildFacade, type FacadeInput } from '../../src/kernel/facade';
import {
  buildFacadeDetails,
  type FacadeDetailEdge,
  type FacadeDetailWindow,
} from '../../src/kernel/facade-details';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { buildRoofDormers } from '../../src/kernel/roof-details';
import { buildWingRoof, type WingRoofInput, type WingRoofKind } from '../../src/kernel/roofs';
import { FLAT_GROUND, type MeshBuffers, type Vec2 } from '../../src/kernel/types';
import '../../src/kernel';
import { testStyle } from '../helpers/pack';

const DETAILS: ArchFacadeDetails = {
  shutters: true,
  balconies: { depth: 0.9, every: 1, railing: 'open' },
  framing: { style: 'timber', width: 0.14 },
  awnings: { depth: 0.7 },
  veranda: { depth: 1.4, columns: true },
};
const EDGE: FacadeDetailEdge = {
  a: [0, 0],
  dir: [1, 0],
  normal: [0, 0, -1],
  length: 15,
  top: 9,
  key: 0,
};
const WINDOWS: FacadeDetailWindow[] = [
  { s0: 2, s1: 3.2, y0: 0.9, y1: 2.1, floor: 0, bay: 0 },
  { s0: 2, s1: 3.2, y0: 3.9, y1: 5.1, floor: 1, bay: 0 },
  { s0: 5, s1: 6.2, y0: 3.9, y1: 5.1, floor: 1, bay: 1 },
];
const INPUT: FacadeInput = {
  rings: [],
  base: 0,
  topAt: () => 9,
  floorHeight: 3,
  groundFloorHeight: 3,
  bayWidth: 3,
  cornerMargin: 0.5,
  salt: 1,
  window: { slot: 'window', ref: 'palette:#ffffff', color: [0.1, 0.2, 0.3] },
  trim: { slot: 'trim', ref: 'palette:#ffffff', color: [0.3, 0.2, 0.1] },
  windows: {
    style: 'punched',
    width: 1.2,
    height: 1.2,
    sill: 0.9,
    probabilityPerBay: 1,
    groundFloor: 'same',
  },
  details: DETAILS,
};

function soundMesh(mesh: MeshBuffers): void {
  expect(mesh.vertexCount).toBeGreaterThan(0);
  expect([...mesh.positions, ...mesh.normals, ...mesh.uvs].every(Number.isFinite)).toBe(true);
  for (let i = 0; i < mesh.normals.length; i += 3)
    expect(
      Math.hypot(mesh.normals[i] ?? 0, mesh.normals[i + 1] ?? 0, mesh.normals[i + 2] ?? 0),
    ).toBeCloseTo(1, 5);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ia = (mesh.indices[i] ?? 0) * 3,
      ib = (mesh.indices[i + 1] ?? 0) * 3,
      ic = (mesh.indices[i + 2] ?? 0) * 3;
    const a = [0, 1, 2].map(
      (axis) => (mesh.positions[ib + axis] ?? 0) - (mesh.positions[ia + axis] ?? 0),
    );
    const b = [0, 1, 2].map(
      (axis) => (mesh.positions[ic + axis] ?? 0) - (mesh.positions[ia + axis] ?? 0),
    );
    const dot =
      ((a[1] ?? 0) * (b[2] ?? 0) - (a[2] ?? 0) * (b[1] ?? 0)) * (mesh.normals[ia] ?? 0) +
      ((a[2] ?? 0) * (b[0] ?? 0) - (a[0] ?? 0) * (b[2] ?? 0)) * (mesh.normals[ia + 1] ?? 0) +
      ((a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0)) * (mesh.normals[ia + 2] ?? 0);
    expect(dot).toBeGreaterThan(0);
  }
}

function details(edge = EDGE, input = INPUT, windows = WINDOWS): MeshBuffers {
  const out = new MeshBufferBuilder();
  buildFacadeDetails(edge, input, windows, out, { remaining: 3600 });
  return out.finalize();
}

describe('adaptive architectural details', () => {
  it.each([0, 0.61, 1.57])('rotates real facade geometry with the wall at %s radians', (angle) => {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const edge: FacadeDetailEdge = { ...EDGE, a: [81, -46], dir: [c, s], normal: [s, 0, -c] };
    const mesh = details(edge);
    soundMesh(mesh);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = (mesh.positions[i] ?? 0) - 81,
        z = (mesh.positions[i + 2] ?? 0) + 46;
      const along = x * c + z * s,
        depth = x * s - z * c;
      expect(along).toBeGreaterThanOrEqual(-0.001);
      expect(along).toBeLessThanOrEqual(15.001);
      expect(depth).toBeGreaterThanOrEqual(-0.001);
      expect(depth).toBeLessThanOrEqual(1.44);
      expect(mesh.positions[i + 1]).toBeGreaterThanOrEqual(0);
      expect(mesh.positions[i + 1]).toBeLessThanOrEqual(9);
    }
  });

  it('keeps structural doors and windows clear including their frames', () => {
    const mesh = details(EDGE, {
      ...INPUT,
      structuralOpenings: [{ edge: 0, start: 4, end: 8, bottom: 0, top: 6 }],
    });
    soundMesh(mesh);
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const indices = [mesh.indices[i] ?? 0, mesh.indices[i + 1] ?? 0, mesh.indices[i + 2] ?? 0];
      const x = indices.map((index) => mesh.positions[index * 3] ?? 0);
      const y = indices.map((index) => mesh.positions[index * 3 + 1] ?? 0);
      expect(Math.max(...x) <= 3.87 || Math.min(...x) >= 8.13 || Math.min(...y) >= 6.13).toBe(true);
    }
  });

  it('omits ground verandas on raised parts and projections into courtyard holes', () => {
    const verandaOnly: FacadeInput = {
      ...INPUT,
      details: { veranda: { depth: 2, columns: true } },
    };
    expect(details(EDGE, { ...verandaOnly, raised: true }).vertexCount).toBe(0);
    expect(details({ ...EDGE, key: 4096 }, verandaOnly).vertexCount).toBe(0);
    expect(
      details({ ...EDGE, key: 4096 }, { ...INPUT, details: { balconies: DETAILS.balconies } })
        .vertexCount,
    ).toBe(0);
  });

  it('bounds ornament complexity on long, tall walls', () => {
    const edge = { ...EDGE, length: 10000, top: 600 };
    const many = Array.from({ length: 10000 }, (_, i) => ({
      ...(WINDOWS[1] as FacadeDetailWindow),
      s0: 2 + i * 3,
      s1: 3.2 + i * 3,
      bay: i,
    }));
    const mesh = details(edge, INPUT, many);
    expect(mesh.vertexCount).toBeGreaterThan(100);
    expect(mesh.vertexCount).toBeLessThanOrEqual(3600);
  });

  it('preserves ornament on every side when the first edges consume their budget', () => {
    const out = new MeshBufferBuilder();
    buildFacade(
      {
        ...INPUT,
        rings: [
          [
            [0, 0],
            [30, 0],
            [30, 20],
            [0, 20],
          ],
        ],
        floorCount: 3,
      },
      out,
    );
    const positions = out.finalize().positions;
    const x = Array.from(positions).filter((_, i) => i % 3 === 0);
    const z = Array.from(positions).filter((_, i) => i % 3 === 2);
    // Glazing alone sits just .03m from the wall. Each side retains actual raised detail.
    expect(Math.min(...x)).toBeLessThan(-0.1);
    expect(Math.max(...x)).toBeGreaterThan(30.1);
    expect(Math.min(...z)).toBeLessThan(-0.1);
    expect(Math.max(...z)).toBeGreaterThan(20.1);
  });
});

describe('adaptive dormers', () => {
  it.each([
    'gable',
    'hip',
    'mansard',
    'gambrel',
  ] as WingRoofKind[])('fits %s dormers inside the host ridge envelope', (kind) => {
    const input: WingRoofInput = {
      wing: {
        u0: 0,
        u1: 24,
        v0: 0,
        v1: 10,
        longAxis: 'u',
        priority: 0,
        endOnOutline: [true, true],
      },
      frame: { ox: 12, oz: -8, c: 0.8, s: 0.6 },
      eave: 7,
      rise: 0.8,
      lowerRise: 1.8,
      overhang: 0.5,
      tier: 0,
      shedDirection: 1,
      surfaces: { wall: INPUT.trim, trim: INPUT.trim, roof: { ...INPUT.trim, slot: 'roof' } },
    };
    const host = new MeshBufferBuilder();
    buildWingRoof(kind, input, host);
    const maximum = host.maxYSince({ lengths: new Map() });
    const out = new MeshBufferBuilder();
    const count = buildRoofDormers(
      kind,
      input,
      { perRidgeMeters: 3.5, style: 'gable' },
      INPUT.window,
      out,
      6,
    );
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(6);
    soundMesh(out.finalize());
    expect(out.maxYSince({ lengths: new Map() })).toBeLessThanOrEqual(maximum);
    const far = new MeshBufferBuilder();
    expect(
      buildRoofDormers(
        kind,
        { ...input, tier: 2 },
        { perRidgeMeters: 3, style: 'shed' },
        INPUT.window,
        far,
        10,
      ),
    ).toBe(0);
    expect(far.vertexCount()).toBe(0);
  });
});

describe('building detail integration', () => {
  const raw = testStyle('test.pack.details') as Record<string, unknown>;
  const parsed = validateByKind('archstyle' as never, {
    ...raw,
    facade: { ...(raw.facade as object), details: DETAILS },
    roof: {
      ...(raw.roof as object),
      choices: [{ type: 'gable', weight: 1, pitchDeg: { min: 38, max: 38 } }],
      features: { dormers: { probability: 1, perRidgeMeters: 3, style: 'gable' } },
    },
  });
  if (!parsed.ok) throw new Error(parsed.formatted);
  const style = parsed.value as ArchStyleDoc;
  const plain = structuredClone(style);
  delete plain.facade.details;
  delete plain.roof.features;
  const build = (doc: ArchStyleDoc, scale: number, tier = 0, simplified = false): MeshBuffers => {
    const out = new MeshBufferBuilder();
    generateBuilding(
      {
        style: doc,
        pack: { name: 'test.pack', version: '1' },
        ground: FLAT_GROUND,
        tier,
        simplified,
        request: {
          identity: 'adaptive',
          labels: ['house'],
          outline: [
            [0, 0],
            [18 * scale, 0],
            [18 * scale, 10 * scale],
            [0, 10 * scale],
          ] as Vec2[],
          height: 12,
          minHeight: 3,
          levels: 3,
        },
      },
      out,
    );
    return out.finalize();
  };
  it.each([0.5, 1, 1.5])('keeps known height/minHeight intact at footprint scale %s', (scale) => {
    const mesh = build(style, scale);
    soundMesh(mesh);
    const heights = Array.from(mesh.positions).filter((_, i) => i % 3 === 1);
    expect(Math.min(...heights)).toBeCloseTo(3, 5);
    expect(Math.max(...heights)).toBeCloseTo(12, 5);
    expect(mesh.vertexCount).toBeGreaterThan(build(plain, scale).vertexCount);
    expect(mesh.positions).toEqual(build(style, scale).positions);
  });
  it('drops optional details exactly at simplified and facade-free tiers', () => {
    for (const [tier, simplified] of [
      [0, true],
      [1, false],
      [2, false],
    ] as const)
      expect(build(style, 1, tier, simplified)).toEqual(build(plain, 1, tier, simplified));
  });
  it('rejects dangerous projections while applying useful defaults', () => {
    const facade = raw.facade as Record<string, unknown>;
    expect(
      validateByKind('archstyle' as never, {
        ...raw,
        facade: { ...facade, details: { veranda: { depth: 30 } } },
      }).ok,
    ).toBe(false);
    const result = validateByKind('archstyle' as never, {
      ...raw,
      facade: { ...facade, details: { balconies: {} } },
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect((result.value as ArchStyleDoc).facade.details?.balconies).toEqual({
        depth: 0.7,
        railing: 'open',
        every: 1,
      });
  });
});
