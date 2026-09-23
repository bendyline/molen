import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { ArchStyleDoc } from '../../src/kernel/archstyle-types';
import { generateWorldgenBatch } from '../../src/kernel/batch';
import { type BuildingGenerateInput, generateBuilding } from '../../src/kernel/building';
import { buildOpeningFrames } from '../../src/kernel/facade';
import { distancePointToRing, pointInRing, ringBounds } from '../../src/kernel/geometry2d';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { WHITE_REF } from '../../src/kernel/recipe';
import { resolveStylePackDocuments } from '../../src/kernel/stylepack';
import { FLAT_GROUND, type MeshBuffers, type Vec2 } from '../../src/kernel/types';
import '../../src/kernel';
import { TEST_PACK_DOCS, TEST_PACK_ROOT, testStyle } from '../helpers/pack';
import { SHAPES } from '../helpers/shapes';

const identity = { name: 'test.pack', version: '1' };

const TEXTURED_MATERIALS = {
  wall: {
    choices: [{ ref: 'matgraph:test.pack.wall', weight: 1 }],
    tint: 'none',
    uv: 'meters',
    uvScale: [3, 2],
    uvOffset: 'none',
    uvMirror: false,
  },
  roof: {
    choices: [{ ref: 'matgraph:test.pack.roof', weight: 1 }],
    tint: 'none',
    uv: 'meters',
    uvScale: [2, 2],
    uvOffset: 'none',
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
  window: {
    choices: [{ ref: 'matgraph:test.pack.window', weight: 1 }],
    tint: 'none',
    uv: 'cell',
    uvOffset: 'none',
    uvMirror: false,
  },
};

function style(overrides: Record<string, unknown>): ArchStyleDoc {
  const parsed = validateByKind('archstyle' as never, testStyle('test.pack.facade', overrides));
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as ArchStyleDoc;
}

const GABLE_ONLY = {
  perWing: true,
  ridge: 'long-axis',
  overhang: { min: 0.5, max: 0.5 },
  complexFootprint: 'wings',
  choices: [{ type: 'gable', weight: 1, pitchDeg: { min: 35, max: 35 } }],
  fallback: 'flat',
};

const FLAT_ONLY = {
  perWing: true,
  ridge: 'long-axis',
  overhang: { min: 0.5, max: 0.5 },
  complexFootprint: 'flat',
  choices: [
    { type: 'flat', weight: 1, parapet: { height: { min: 0.6, max: 0.6 }, thickness: 0.3 } },
  ],
  fallback: 'flat',
};

function build(
  doc: ArchStyleDoc,
  overrides: Partial<BuildingGenerateInput> = {},
): ReturnType<typeof generateBuilding> & { buffers: MeshBuffers } {
  const out = new MeshBufferBuilder();
  const result = generateBuilding(
    {
      request: { identity: 'f:1', labels: ['house'], outline: SHAPES.box as Vec2[], levels: 2 },
      style: doc,
      pack: identity,
      ground: FLAT_GROUND,
      tier: 0,
      ...overrides,
    },
    out,
  );
  return { ...result, buffers: out.finalize() };
}

function uvRange(buffers: MeshBuffers, slot: string): { u: number; v: number } {
  let u = 0;
  let v = 0;
  for (const group of buffers.groups) {
    if (group.slot !== slot) continue;
    for (let index = group.start; index < group.start + group.count; index++) {
      const vertex = buffers.indices[index] as number;
      u = Math.max(u, Math.abs(buffers.uvs[vertex * 2] as number));
      v = Math.max(v, Math.abs(buffers.uvs[vertex * 2 + 1] as number));
    }
  }
  return { u, v };
}

describe('facades', () => {
  it('keeps structural door frames open and inexpensive while near frames have real depth', () => {
    const outline: Vec2[] = [
      [0, 0],
      [8, 0],
      [8, 6],
      [0, 6],
    ];
    const opening = { edge: 0, start: 3, end: 5, bottom: 0, top: 2.5, kind: 'door' as const };
    for (const relief of [false, true]) {
      const builder = new MeshBufferBuilder();
      buildOpeningFrames(
        outline,
        [opening],
        { slot: 'trim', ref: WHITE_REF, color: [1, 1, 1] },
        relief,
        builder,
      );
      const mesh = builder.finalize();
      expect(mesh.vertexCount).toBeLessThanOrEqual(relief ? 24 : 12);
      // No triangle covers the doorway or forms a threshold across its bottom.
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const vertices = [...mesh.indices.slice(i, i + 3)];
        const x = vertices.reduce((sum, v) => sum + (mesh.positions[v * 3] ?? 0), 0) / 3;
        const y = vertices.reduce((sum, v) => sum + (mesh.positions[v * 3 + 1] ?? 0), 0) / 3;
        expect(x > opening.start && x < opening.end && y < opening.top).toBe(false);
      }
      expect(Math.min(...mesh.positions.filter((_, i) => i % 3 === 2))).toBeCloseTo(
        relief ? -0.14 : -0.045,
      );
    }
  });

  it('emits punched windows and bands at full detail and drops them at coarser tiers', () => {
    const doc = style({ roof: GABLE_ONLY });
    const full = build(doc);
    expect(full.facade?.windows).toBeGreaterThan(4);
    expect(full.facade?.bands).toBeGreaterThan(0);
    expect(full.buffers.groups.some((group) => group.slot === 'window')).toBe(true);
    expect(full.buffers.groups.some((group) => group.slot === 'trim')).toBe(true);
    const coarse = build(doc, { tier: 2 });
    expect(coarse.facade).toBeUndefined();
    expect(coarse.buffers.groups.some((group) => group.slot === 'window')).toBe(false);
    const again = build(doc);
    expect(again.facade).toEqual(full.facade);
  });

  it('keeps a bounded subset of real windows and the same roof in the budget fallback', () => {
    const doc = style({ roof: GABLE_ONLY, materials: TEXTURED_MATERIALS });
    const request = {
      identity: 'large-facade',
      labels: ['house'],
      outline: [
        [0, 0],
        [60, 0],
        [60, 12],
        [0, 12],
      ] as Vec2[],
      levels: 8,
    };
    const full = build(doc, { request });
    const simple = build(doc, { request, simplified: true });
    expect(simple.record?.roof).toBe(full.record?.roof);
    expect(simple.record?.height).toBe(full.record?.height);
    expect(simple.facade?.windows).toBeGreaterThan(0);
    expect(simple.facade?.windows).toBeLessThanOrEqual(4 * 3 * 2);
    expect(simple.facade?.bands).toBe(0);
    expect(simple.props).toHaveLength(0);
    expect(simple.buffers.vertexCount).toBeLessThan(full.buffers.vertexCount / 2);
    expect(simple.buffers.groups.every((group) => group.materialRef === WHITE_REF)).toBe(true);
    const windowVertices = (buffers: MeshBuffers): number[] =>
      buffers.groups
        .filter((group) => group.slot === 'window')
        .flatMap((group) => [...buffers.indices.slice(group.start, group.start + group.count)]);
    const fullPositions = new Set(
      windowVertices(full.buffers).map((v) =>
        [...full.buffers.positions.slice(v * 3, v * 3 + 3)].join(','),
      ),
    );
    for (const vertex of windowVertices(simple.buffers)) {
      expect(
        fullPositions.has(
          [...simple.buffers.positions.slice(vertex * 3, vertex * 3 + 3)].join(','),
        ),
      ).toBe(true);
      expect(simple.buffers.colors[vertex * 3]).toBeLessThan(80);
    }
    const seamed = build(doc, {
      request: { ...request, clipped: true, seamEdges: [0, 1, 2, 3] },
      simplified: true,
    });
    expect(seamed.record?.roof).toBe('flat');
    expect(seamed.facade?.windows).toBe(0);
    expect(build(doc, { simplified: true, tier: 99 }).box).toBeDefined();
  });

  it('glazes the ground floor as a storefront and skips windows on seam edges', () => {
    const doc = style({
      roof: FLAT_ONLY,
      facade: {
        bays: { width: { min: 3, max: 3 }, cornerMargin: 0.5 },
        windows: {
          style: 'ribbon',
          width: { min: 1, max: 1 },
          height: { min: 1.2, max: 1.2 },
          sill: { min: 0.9, max: 0.9 },
          probabilityPerBay: 1,
          groundFloor: 'storefront',
        },
        bands: { base: { height: { min: 0, max: 0 } }, floorLines: true },
      },
    });
    const result = build(doc);
    const ring = SHAPES.box as Vec2[];
    const expectedWindows = ring.reduce((sum, a, index) => {
      const b = ring[(index + 1) % ring.length] as Vec2;
      return sum + Math.floor((Math.hypot(b[0] - a[0], b[1] - a[1]) - 1) / 3);
    }, 0);
    expect(result.facade?.storefronts).toBe(4);
    expect(result.facade?.windows).toBe(expectedWindows);
    const seamed = build(doc, {
      request: {
        identity: 'f:2',
        labels: ['house'],
        outline: SHAPES.box as Vec2[],
        levels: 2,
        clipped: true,
        seamEdges: [0, 1],
      },
    });
    expect(seamed.facade?.storefronts).toBe(2);
  });

  it('scales metric UVs by uvScale and folds textured refs under collapseMaterials', () => {
    const doc = style({ roof: FLAT_ONLY, materials: TEXTURED_MATERIALS });
    const textured = build(doc, { tier: 2 });
    expect(textured.buffers.groups.map((group) => group.materialRef)).toContain(
      'matgraph:test.pack.wall',
    );
    const walls = uvRange(textured.buffers, 'wall');
    expect(walls.u).toBeCloseTo(12 / 3, 5);
    expect(walls.v).toBeCloseTo((textured.record?.height ?? 0) / 2, 5);
    const collapsed = build(doc, { tier: 2, collapseMaterials: true });
    expect(collapsed.buffers.groups.every((group) => group.materialRef === WHITE_REF)).toBe(true);
    expect(collapsed.buffers.vertexCount).toBe(textured.buffers.vertexCount);
  });

  it('caps mesh groups per batch by collapsing later buildings', async () => {
    const root = structuredClone(TEST_PACK_ROOT) as Record<string, unknown>;
    const docs: Record<string, unknown> = {
      ...structuredClone(TEST_PACK_DOCS),
      'house.archstyle.json': testStyle('test.pack.house', {
        roof: FLAT_ONLY,
        materials: TEXTURED_MATERIALS,
      }),
      'materials/wall.json': {
        format: 'molen/matgraph@1',
        nodes: [{ id: 'n', type: 'const', params: { value: [0.8, 0.8, 0.8, 1] } }],
        outputs: { baseColor: 'n' },
      },
    };
    docs['materials/roof.json'] = docs['materials/wall.json'];
    docs['materials/window.json'] = docs['materials/wall.json'];
    root.materials = {
      'test.pack.wall': 'materials/wall.json',
      'test.pack.roof': 'materials/roof.json',
      'test.pack.window': 'materials/window.json',
    };
    const pack = await resolveStylePackDocuments(root, async (path) => docs[path]);
    const buildings = [0, 1, 2].map((index) => ({
      identity: `f:${index}`,
      labels: ['house'],
      outline: (SHAPES.box as Vec2[]).map(([x, z]): Vec2 => [x + index * 30, z]),
      levels: 2,
    }));
    const loose = generateWorldgenBatch({ buildings, pack, budgets: { maxMaterialGroups: 12 } });
    expect(loose.stats.materialsCollapsed).toBe(0);
    expect(loose.buildings?.groups.length).toBeGreaterThanOrEqual(4);
    const tight = generateWorldgenBatch({ buildings, pack, budgets: { maxMaterialGroups: 3 } });
    expect(tight.stats.materialsCollapsed).toBeGreaterThan(0);
    expect(tight.stats.buildingsRendered).toBe(3);
    expect(tight.buildings?.groups.length).toBeLessThanOrEqual(3);
  });
});

describe('props', () => {
  it('sets ridge props on the ridge line of the dominant wing', () => {
    const doc = style({
      roof: GABLE_ONLY,
      props: [
        {
          id: 'chimney',
          model: 'builtin:box',
          anchor: 'roof-ridge',
          probability: 1,
          count: { min: 1, max: 1 },
          roof: ['gable'],
          spacing: 4,
          margin: 1,
          scale: { min: 1, max: 1 },
          yaw: 'align-wall',
          lodTier: 0,
        },
      ],
    });
    const result = build(doc);
    expect(result.props).toHaveLength(1);
    const prop = result.props?.[0];
    const rise = result.recipe?.roof.rise ?? 0;
    const [minX, minZ, maxX, maxZ] = ringBounds(SHAPES.box as Vec2[]);
    const width = maxX - minX;
    const depth = maxZ - minZ;
    expect(prop?.y).toBeCloseTo(
      (result.record?.height ?? 0) + (Math.min(width, depth) / 2) * rise,
      6,
    );
    expect(pointInRing([prop?.x ?? 0, prop?.z ?? 0], SHAPES.box as Vec2[])).toBe(true);
    if (width >= depth) expect(prop?.z).toBeCloseTo((minZ + maxZ) / 2, 6);
    else expect(prop?.x).toBeCloseTo((minX + maxX) / 2, 6);
    expect(build(doc, { tier: 1 }).props).toHaveLength(0);
  });

  it('keeps flat-roof props inside the outline and edge props on the outline', () => {
    const doc = style({
      roof: FLAT_ONLY,
      props: [
        {
          id: 'hvac',
          model: 'builtin:box',
          anchor: 'roof-flat',
          probability: 1,
          count: { min: 3, max: 3 },
          roof: ['flat'],
          spacing: 2,
          margin: 1,
          scale: { min: 1, max: 1 },
          yaw: 'align-wall',
          lodTier: 0,
        },
        {
          id: 'canale',
          model: 'builtin:rock',
          anchor: 'roof-edge',
          probability: 1,
          count: { min: 4, max: 4 },
          roof: ['flat'],
          spacing: 3,
          margin: 1,
          scale: { min: 1, max: 1 },
          yaw: 'align-wall',
          lodTier: 0,
        },
      ],
    });
    const result = build(doc);
    const ring = SHAPES.box as Vec2[];
    const flat = (result.props ?? []).filter((prop) => prop.model === 'builtin:box');
    const edge = (result.props ?? []).filter((prop) => prop.model === 'builtin:rock');
    expect(flat).toHaveLength(3);
    expect(edge).toHaveLength(4);
    for (const prop of flat) {
      expect(pointInRing([prop.x, prop.z], ring)).toBe(true);
      expect(distancePointToRing([prop.x, prop.z], ring)).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(prop.y).toBeCloseTo(result.record?.height ?? 0, 6);
    }
    for (const prop of edge) {
      expect(distancePointToRing([prop.x, prop.z], ring)).toBeLessThan(1e-6);
      expect(prop.y).toBeCloseTo((result.record?.height ?? 0) + 0.6 - 0.15, 6);
    }
    const batch = generateWorldgenBatch({
      buildings: [{ identity: 'f:1', labels: ['house'], outline: ring, levels: 2 }],
      pack: {
        id: 'x',
        version: '1',
        hash: 'sha256:0',
        root: {
          ...(TEST_PACK_ROOT as object),
          defaults: { style: 'test.pack.facade', rules: [] },
        } as never,
        archstyles: { 'test.pack.facade': doc },
        scatters: {},
        materials: {},
        assets: {},
        warnings: [],
      },
    });
    expect(batch.placements.map((set) => set.setId).sort()).toEqual([
      'props:builtin:box',
      'props:builtin:rock',
    ]);
    expect(batch.stats.placementsByModel['builtin:box']).toBe(3);
  });
});

describe('facade scale', () => {
  function windowRows(buffers: MeshBuffers): number[] {
    const rows = new Set<number>();
    for (const group of buffers.groups) {
      if (group.slot !== 'window') continue;
      for (let i = group.start; i < group.start + group.count; i += 6) {
        const ys = [...buffers.indices.slice(i, i + 6)].map(
          (v) => buffers.positions[v * 3 + 1] as number,
        );
        rows.add(Math.round(Math.min(...ys) * 10000) / 10000);
      }
    }
    return [...rows].sort((a, b) => a - b);
  }
  it.each([1, 2, 4])('honors %s supplied storeys when height would imply more rows', (levels) => {
    const doc = style({ roof: FLAT_ONLY });
    doc.facade.windows.style = 'grid';
    doc.facade.windows.probabilityPerBay = 1;
    doc.facade.bands.floorLines = true;
    const result = build(doc, {
      request: {
        identity: 'tall-storeys',
        labels: ['building'],
        outline: SHAPES.box as Vec2[],
        height: 16,
        levels,
      },
    });
    expect(result.recipe?.floors).toBe(levels);
    expect(result.record?.height).toBe(16);
    expect(windowRows(result.buffers)).toHaveLength(levels);
    const top = Math.max(...Array.from(result.buffers.positions).filter((_, i) => i % 3 === 1));
    expect(top).toBeCloseTo(16, 5);
    const simple = build(doc, {
      request: {
        identity: 'tall-storeys',
        labels: ['building'],
        outline: SHAPES.box as Vec2[],
        height: 16,
        levels,
      },
      simplified: true,
    });
    expect(windowRows(simple.buffers).every((y) => windowRows(result.buffers).includes(y))).toBe(
      true,
    );
  });

  it('keeps storefronts below a solid wall band when upper windows are disabled', () => {
    const doc = style({ roof: FLAT_ONLY });
    doc.facade.windows.style = 'none';
    doc.facade.windows.groundFloor = 'storefront';
    doc.facade.windows.width = { min: 2, max: 2 };
    doc.facade.windows.height = { min: 3, max: 3 };
    const result = build(doc, {
      request: {
        identity: 'tall-retail',
        labels: ['retail'],
        outline: SHAPES.box as Vec2[],
        height: 9,
        levels: 1,
      },
    });
    expect(result.facade?.storefronts).toBe(4);
    expect(result.facade?.windows).toBe(0);
    expect(windowRows(result.buffers)).toEqual([0.25]);
    const glass = result.buffers.groups
      .filter((g) => g.slot === 'window')
      .flatMap((g) => [...result.buffers.indices.slice(g.start, g.start + g.count)]);
    expect(
      Math.max(...glass.map((i) => result.buffers.positions[i * 3 + 1] as number)),
    ).toBeCloseTo(3.25, 5);
    const none = structuredClone(doc);
    none.facade.windows.groundFloor = 'none';
    expect(build(none).facade?.storefronts).toBe(0);
  });
});
