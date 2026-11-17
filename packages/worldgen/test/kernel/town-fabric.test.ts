import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { ArchStyleDoc } from '../../src/kernel/archstyle-types';
import { generateBuilding } from '../../src/kernel/building';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { buildDeckRoof, type RoofSurfaces } from '../../src/kernel/roofs';
import {
  type BuildingRequest,
  FLAT_GROUND,
  type MeshBuffers,
  type Vec2,
} from '../../src/kernel/types';
import '../../src/kernel';
import { testStyle } from '../helpers/pack';

const PACK = { name: 'test', version: '1' };
const SURFACES: RoofSurfaces = {
  roof: { slot: 'roof', ref: 'palette:#a8654a', color: [0.66, 0.4, 0.29] },
  trim: { slot: 'trim', ref: 'palette:#eeeeee', color: [0.9, 0.9, 0.9] },
  wall: { slot: 'wall', ref: 'palette:#cccccc', color: [0.8, 0.8, 0.8] },
};
/** An old-town plot: five sides, no two parallel. */
const IRREGULAR: Vec2[] = [
  [0, 0],
  [13, 1.5],
  [15, 9],
  [8, 14],
  [-1, 10],
];

function style(overrides: {
  roof?: Record<string, unknown>;
  details?: Record<string, unknown>;
  wall?: Record<string, unknown>;
}): ArchStyleDoc {
  const raw = testStyle('test.pack.town') as Record<string, Record<string, unknown>>;
  const parsed = validateByKind('archstyle' as never, {
    ...raw,
    roof: { ...raw.roof, ...overrides.roof },
    facade: { ...raw.facade, ...(overrides.details ? { details: overrides.details } : {}) },
    materials: {
      ...raw.materials,
      ...(overrides.wall
        ? { wall: { ...(raw.materials?.wall as object), ...overrides.wall } }
        : {}),
    },
  });
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as ArchStyleDoc;
}

function build(doc: ArchStyleDoc, request: BuildingRequest, tier = 0) {
  const builder = new MeshBufferBuilder();
  const result = generateBuilding(
    { request, style: doc, pack: PACK, ground: FLAT_GROUND, tier },
    builder,
  );
  return { result, mesh: builder.finalize() };
}

function sound(mesh: MeshBuffers): void {
  expect([...mesh.positions, ...mesh.normals, ...mesh.uvs].every(Number.isFinite)).toBe(true);
  for (let i = 0; i < mesh.normals.length; i += 3)
    expect(
      Math.hypot(mesh.normals[i] ?? 0, mesh.normals[i + 1] ?? 0, mesh.normals[i + 2] ?? 0),
    ).toBeCloseTo(1, 5);
}

function maxY(mesh: MeshBuffers): number {
  let top = Number.NEGATIVE_INFINITY;
  for (let i = 1; i < mesh.positions.length; i += 3) top = Math.max(top, mesh.positions[i] ?? 0);
  return top;
}

const HIP = { type: 'hip', weight: 1, pitchDeg: { min: 24, max: 24 } };

describe('deck roofs', () => {
  it('slopes up from every wall of an irregular plan to a level deck', () => {
    const out = new MeshBufferBuilder();
    const deck = buildDeckRoof(
      IRREGULAR,
      [],
      { eave: 6, rise: 0.45, maxHeight: 4.6, overhang: 0.3, span: 13, tier: 0 },
      SURFACES,
      out,
    );
    expect(deck).toBeGreaterThan(7);
    expect(deck).toBeLessThanOrEqual(10.6);
    const mesh = out.finalize();
    sound(mesh);
    // One slope per wall and a cap; every face looks up.
    expect(mesh.groups.every((group) => group.slot === 'roof')).toBe(true);
    for (let i = 1; i < mesh.normals.length; i += 3) expect(mesh.normals[i]).toBeGreaterThan(0.5);
    expect(maxY(mesh)).toBeCloseTo(deck as number, 6);
  });

  it('runs round a courtyard and gives up on a sliver', () => {
    const outer: Vec2[] = [
      [0, 0],
      [30, 0],
      [30, 24],
      [0, 24],
    ];
    // Holes turn the other way, as the footprint analysis hands them over.
    const court: Vec2[] = [
      [10, 8],
      [10, 16],
      [20, 16],
      [20, 8],
    ];
    const out = new MeshBufferBuilder();
    const spec = { eave: 9, rise: 0.5, maxHeight: 4.6, overhang: 0, span: 24, tier: 0 };
    const deck = buildDeckRoof(outer, [court], spec, SURFACES, out);
    expect(deck).toBeGreaterThan(9.5);
    // Slopes fall to the street and to the court: eight of them, plus the ring between.
    expect(out.finalize().triangleCount).toBeGreaterThanOrEqual(8 * 2 + 8);
    const thin = new MeshBufferBuilder();
    expect(
      buildDeckRoof(
        [
          [0, 0],
          [20, 0],
          [20, 0.9],
          [0, 0.9],
        ],
        [],
        { ...spec, span: 0.9 },
        SURFACES,
        thin,
      ),
    ).toBeUndefined();
    expect(thin.isEmpty()).toBe(true);
  });

  it('replaces the flat fallback only for a style that asks for it', () => {
    const request: BuildingRequest = {
      identity: 'plot',
      labels: ['building'],
      outline: IRREGULAR,
      levels: 2,
    };
    const flat = build(style({ roof: { choices: [HIP] } }), request);
    expect(flat.result.record?.roof).toBe('skillion');
    const hipped = build(style({ roof: { choices: [HIP], fallback: 'hipped' } }), request);
    expect(hipped.result.record?.roof).toBe('deck');
    sound(hipped.mesh);
    // A hall too broad for a ridge keeps its pitched choice and takes the deck.
    const hall: BuildingRequest = {
      identity: 'hall',
      labels: ['building'],
      levels: 1,
      outline: [
        [0, 0],
        [40, 0],
        [40, 30],
        [0, 30],
      ],
    };
    expect(build(style({ roof: { choices: [HIP] } }), hall).result.record?.roof).toBe('flat');
    expect(
      build(style({ roof: { choices: [HIP], fallback: 'hipped' } }), hall).result.record?.roof,
    ).toBe('deck');
  });
});

describe('party walls', () => {
  const plot: Vec2[] = [
    [0, 0],
    [6, 0],
    [6, 14],
    [0, 14],
  ];
  const request: BuildingRequest = {
    identity: 'row-house',
    labels: ['building'],
    outline: plot,
    levels: 2,
  };
  const gabled = { choices: [{ type: 'gable', weight: 1, pitchDeg: { min: 35, max: 35 } }] };

  it('keeps windows, trim and the entrance off shared walls', () => {
    const open = build(style({ roof: gabled }), request);
    // The two long walls are shared with the neighbours.
    const row = build(style({ roof: gabled }), { ...request, partyEdges: [1, 3] });
    expect(open.result.facade?.windows).toBeGreaterThan(8);
    expect(row.result.facade?.windows).toBeGreaterThan(0);
    expect(row.result.facade?.windows).toBeLessThan((open.result.facade?.windows ?? 0) / 2);
    expect(row.mesh.vertexCount).toBeLessThan(open.mesh.vertexCount * 0.75);
    // The walls themselves still stand: a neighbour may be lower.
    const walls = (mesh: MeshBuffers) =>
      mesh.groups.filter((group) => group.slot === 'wall').reduce((n, g) => n + g.count, 0);
    expect(walls(row.mesh)).toBeGreaterThanOrEqual(4 * 6);
  });

  it('turns the ridge to the row, and a hip to a gable', () => {
    const along = build(style({ roof: { ...gabled, partyRidge: 'along' } }), {
      ...request,
      partyEdges: [1, 3],
    });
    const between = build(style({ roof: { ...gabled, partyRidge: 'between' } }), {
      ...request,
      partyEdges: [1, 3],
    });
    // Along the party walls the roof spans the 6 m front; between them it spans the 14 m depth,
    // held to a storey and a half. The same identity and style give both the same wall height.
    const eave = along.result.recipe?.totalHeight ?? 0;
    expect(between.result.recipe?.totalHeight).toBe(eave);
    expect(maxY(along.mesh) - eave).toBeCloseTo(3 * Math.tan((35 * Math.PI) / 180), 1);
    expect(maxY(between.mesh) - eave).toBeGreaterThan(maxY(along.mesh) - eave);
    expect(maxY(between.mesh) - eave).toBeLessThanOrEqual(5.2 + 1e-6);
    const hip = build(style({ roof: { choices: [HIP], partyRidge: 'between' } }), {
      ...request,
      partyEdges: [1, 3],
    });
    // Gable ends are walls; a hip has none above the eave.
    const wallTop = (mesh: MeshBuffers): number => {
      let top = 0;
      for (const group of mesh.groups) {
        if (group.slot !== 'wall') continue;
        for (let i = group.start; i < group.start + group.count; i++)
          top = Math.max(top, mesh.positions[(mesh.indices[i] ?? 0) * 3 + 1] ?? 0);
      }
      return top;
    };
    expect(wallTop(hip.mesh)).toBeGreaterThan((hip.result.recipe?.totalHeight ?? 0) + 1);
    const free = build(style({ roof: { choices: [HIP] } }), request);
    expect(wallTop(free.mesh)).toBeCloseTo(free.result.recipe?.totalHeight ?? 0, 3);
  });
});

describe('crowns, porches and paint', () => {
  const hall: BuildingRequest = {
    identity: 'hall',
    labels: ['place_of_worship'],
    levels: 1,
    outline: [
      [0, 0],
      [24, 0],
      [24, 11],
      [0, 11],
    ],
  };
  const plain = style({ roof: { choices: [HIP] } });

  it.each([
    ['spire', 2.2],
    ['belfry', 1.5],
    ['dome', 1.2],
    ['minaret', 2.2],
    ['shikhara', 1.4],
  ] as const)('raises a %s above the roof in the building materials', (crown, factor) => {
    const bare = build(plain, hall);
    const crowned = build(plain, { ...hall, crown: [crown] });
    sound(crowned.mesh);
    expect(maxY(crowned.mesh)).toBeGreaterThan(maxY(bare.mesh) * factor * 0.6);
    expect(maxY(crowned.mesh)).toBeGreaterThan(maxY(bare.mesh) + 1.5);
    expect(crowned.mesh.vertexCount - bare.mesh.vertexCount).toBeLessThan(420);
    // No new material: a crown is wall, roof and glass.
    expect(new Set(crowned.mesh.groups.map((g) => g.slot))).toEqual(
      new Set(bare.mesh.groups.map((g) => g.slot)),
    );
    // The same request builds the same crown.
    expect(build(plain, { ...hall, crown: [crown] }).mesh.positions).toEqual(
      crowned.mesh.positions,
    );
  });

  it('leaves a footprint too small to carry one alone', () => {
    const hut: BuildingRequest = {
      ...hall,
      outline: [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
      ],
    };
    expect(build(plain, { ...hut, crown: ['dome'] }).mesh.vertexCount).toBe(
      build(plain, hut).mesh.vertexCount,
    );
  });

  it('adds a porch to the entrance of the share of buildings a style gives it', () => {
    const entrance = { width: 1.05, height: 2.15, style: 'single' };
    const house: BuildingRequest = {
      identity: 'house',
      labels: ['house'],
      levels: 1,
      outline: [
        [0, 0],
        [11, 0],
        [11, 8],
        [0, 8],
      ],
    };
    const bare = build(style({ details: { entrance } }), house);
    const never = build(
      style({ details: { entrance, porch: { probability: 0, depth: 1.2, canopy: 'pitched' } } }),
      house,
    );
    const always = build(
      style({ details: { entrance, porch: { probability: 1, depth: 1.2, canopy: 'pitched' } } }),
      house,
    );
    expect(never.mesh.vertexCount).toBe(bare.mesh.vertexCount);
    const added = always.mesh.vertexCount - bare.mesh.vertexCount;
    expect(added).toBeGreaterThan(30);
    expect(added).toBeLessThanOrEqual(64);
    sound(always.mesh);
  });

  it('paints the door one of the style colors, the same one every time', () => {
    const entrance = { width: 1.05, height: 2.15, style: 'single' };
    const paint = ['#3f6f9e', '#7a3f3a', '#3a6a5a'];
    const doc = style({ details: { entrance, paint } });
    const picks = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const recipe = build(doc, {
        identity: `door-${i}`,
        labels: ['house'],
        levels: 1,
        outline: [
          [0, 0],
          [9, 0],
          [9, 7],
          [0, 7],
        ],
      }).result.recipe;
      const color = recipe?.facade.paint;
      expect(color).toBeDefined();
      picks.add((color ?? []).map((v) => Math.round(v * 255)).join(','));
    }
    expect(picks.size).toBe(3);
    expect(style({ details: { entrance } }).facade.details?.paint).toBeUndefined();
  });

  it('lets each wall material keep its own course size', () => {
    const doc = style({
      wall: {
        choices: [
          { ref: 'matgraph:test.pack.material.brick', weight: 1, uvScale: [1.92, 0.9] },
          { ref: 'matgraph:test.pack.material.board', weight: 1 },
        ],
        uvScale: [3, 2.4],
      },
    });
    const scales = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const wall = build(doc, {
        identity: `wall-${i}`,
        labels: ['house'],
        levels: 1,
        outline: [
          [0, 0],
          [9, 0],
          [9, 7],
          [0, 7],
        ],
      }).result.recipe?.parts.wall;
      scales.add(`${wall?.ref.split('.').at(-1)}:${wall?.uvScale?.join('x')}`);
    }
    expect(scales).toEqual(new Set(['brick:1.92x0.9', 'board:3x2.4']));
  });
});

describe('lot patterns', () => {
  const raw = testStyle('test.pack.town') as Record<string, unknown>;
  const withLots = (lots: unknown) => validateByKind('archstyle' as never, { ...raw, lots });

  it('lets a style say how the lots it invents line a street', () => {
    const rows = withLots({
      rows: 0.8,
      units: { min: 2, max: 3 },
      setback: { min: 0, max: 0.6 },
      depth: { min: 8, max: 12 },
      levels: { min: 2, max: 4 },
      gap: 0.1,
    });
    expect(rows.ok).toBe(true);
    if (rows.ok) expect((rows.value as ArchStyleDoc).lots?.units).toEqual({ min: 2, max: 3 });
    expect(withLots({ compact: true }).ok).toBe(true);
    expect((validateByKind('archstyle' as never, raw) as { ok: boolean }).ok).toBe(true);
  });

  it('refuses a pattern no street could hold', () => {
    // More than four fronts to a frontage, a share past one, and keys it does not know.
    expect(withLots({ rows: 1, units: { min: 1, max: 5 } }).ok).toBe(false);
    expect(withLots({ rows: 1.2 }).ok).toBe(false);
    expect(withLots({ rows: 0.5, gap: -0.1 }).ok).toBe(false);
    expect(withLots({ rows: 0.5, terraces: true }).ok).toBe(false);
    expect(withLots({ rows: 0.5, depth: { min: 12, max: 8 } }).ok).toBe(false);
  });
});

describe('a guessed height', () => {
  const raw = testStyle('test.pack.town') as Record<string, Record<string, unknown>>;
  const guessing = (heightFallback: unknown): ArchStyleDoc => {
    const parsed = validateByKind('archstyle' as never, {
      ...raw,
      massing: { ...raw.massing, heightFallback },
    });
    if (!parsed.ok) throw new Error(parsed.formatted);
    return parsed.value as ArchStyleDoc;
  };
  const block = (extra: Partial<BuildingRequest> = {}): BuildingRequest => ({
    identity: 'hotel',
    labels: ['building'],
    outline: [
      [0, 0],
      [30, 0],
      [30, 20],
      [0, 20],
    ],
    ...extra,
  });

  it('stays within what the caller says the surroundings justify', () => {
    const tall = guessing([{ levels: { min: 9, max: 12 } }]);
    expect(build(tall, block()).result.recipe?.floors).toBeGreaterThanOrEqual(9);
    const capped = build(tall, block({ fallbackLevelsMax: 4 })).result.recipe;
    expect(capped?.floors).toBe(4);
    expect(capped?.heightSource).toBe('fallback');
    // The wall is four storeys of the style's own height, not twelve squeezed into them.
    const storey = (capped?.totalHeight ?? 0) / 4;
    expect(storey).toBeGreaterThan(2.4);
    expect(storey).toBeLessThan(4.6);
    // A ceiling above the guess changes nothing.
    expect(build(tall, block({ fallbackLevelsMax: 40 })).result.recipe?.floors).toBe(
      build(tall, block()).result.recipe?.floors,
    );
  });

  it('never overrules a supplied height or level count, or a hall', () => {
    const tall = guessing([{ levels: { min: 9, max: 12 } }]);
    expect(build(tall, block({ levels: 9, fallbackLevelsMax: 3 })).result.recipe?.floors).toBe(9);
    const measured = build(tall, block({ height: 40, fallbackLevelsMax: 3 })).result;
    expect(measured.recipe?.heightSource).toBe('height');
    expect(measured.recipe?.floors).toBeGreaterThan(8);
    // A hall's fallback is one tall room, in meters: not storeys to count.
    const hall = guessing([{ height: { min: 11, max: 11 } }]);
    expect(build(hall, block({ fallbackLevelsMax: 1 })).result.recipe?.totalHeight).toBeCloseTo(
      build(hall, block()).result.recipe?.totalHeight ?? 0,
      6,
    );
    expect(
      validateByKind('worldgen-batch' as never, {
        format: 'molen/worldgen-batch@1',
        name: 'ceiling',
        ground: { kind: 'flat' },
        buildings: [block({ fallbackLevelsMax: 0 })],
        tier: 0,
      }).ok,
    ).toBe(false);
  });
});
