import { describe, expect, it } from 'vitest';
import {
  BOX_PLACEMENT_SET_ID,
  GABLE_ROOF_PLACEMENT_SET_ID,
  generateWorldgenBatch,
  generateWorldgenBatchSteps,
  worldgenTransferables,
} from '../../src/kernel/batch';
import { encodeGlb } from '../../src/kernel/glb';
import {
  type BuildingRequest,
  FLAT_GROUND,
  PLACEMENT_STRIDE,
  type Vec2,
} from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';
import { SHAPES, translate } from '../helpers/shapes';

const pack = await createTestPack();

function requests(): BuildingRequest[] {
  const names = ['box', 'L', 'T', 'U', 'Z', 'stair', 'H', 'plus'];
  return names.map((name, index) => ({
    identity: `f:${index}`,
    labels: index % 2 === 0 ? ['house'] : ['building'],
    outline: translate(SHAPES[name] as Vec2[], index * 30, 0),
  }));
}

describe('batch generation', () => {
  it('is byte-identical across runs and between stepwise and one-shot', () => {
    const a = generateWorldgenBatch({ buildings: requests(), pack });
    const b = generateWorldgenBatch({ buildings: requests(), pack });
    expect(a.hash).toBe(b.hash);
    expect(a.buildings).toBeDefined();
    const stepwise = generateWorldgenBatchSteps({ buildings: requests(), pack }, 2);
    let progress = 0;
    for (;;) {
      const next = stepwise.next();
      if (next.done === true) {
        expect(next.value.hash).toBe(a.hash);
        break;
      }
      progress++;
    }
    expect(progress).toBeGreaterThan(0);
    expect(a.stats.buildingsIn).toBe(8);
    expect(a.stats.buildingsRendered).toBe(8);
    expect(a.records).toHaveLength(8);
    expect(Object.keys(a.stats.styles).sort()).toEqual(['test.pack.box', 'test.pack.house']);
  });

  it('changes with identities, styles, and pack version', () => {
    const base = generateWorldgenBatch({ buildings: requests(), pack });
    const renamed = generateWorldgenBatch({
      buildings: requests().map((request) => ({ ...request, identity: `${request.identity}x` })),
      pack,
    });
    expect(renamed.hash).not.toBe(base.hash);
    const bumped = generateWorldgenBatch({
      buildings: requests(),
      pack: { ...pack, root: { ...pack.root, version: '2' } },
    });
    expect(bumped.hash).not.toBe(base.hash);
  });

  it('honours building and vertex budgets with deterministic degradation', () => {
    const capped = generateWorldgenBatch({
      buildings: requests(),
      pack,
      budgets: { maxBuildings: 3 },
    });
    expect(capped.stats.buildingsRendered + capped.stats.buildingsBoxed).toBe(3);
    expect(capped.stats.buildingsDropped).toBe(5);
    const boxed = generateWorldgenBatch({
      buildings: requests(),
      pack,
      budgets: { maxBuildingVertices: 60 },
    });
    expect(boxed.stats.buildingsBoxed).toBeGreaterThan(0);
    const boxes = boxed.placements.find((set) => set.setId === BOX_PLACEMENT_SET_ID);
    expect(boxes).toBeDefined();
    expect(boxes?.data.length).toBe((boxes?.count ?? 0) * PLACEMENT_STRIDE);
    const detailed = generateWorldgenBatch({
      buildings: requests(),
      pack,
      budgets: { detailedCount: 2 },
    });
    expect(detailed.stats.buildingsBoxed).toBe(0);
    expect(detailed.stats.buildingsRendered).toBe(8);
    expect(detailed.records.some((record) => ['gable', 'hip'].includes(record.roof))).toBe(true);
  });

  it('draws buildings past the count budget as stand-ins, up to maxStandIns', () => {
    const kept = generateWorldgenBatch({
      buildings: requests(),
      pack,
      budgets: { maxBuildings: 3, maxStandIns: 100 },
    });
    expect(kept.stats.buildingsDropped).toBe(0);
    expect(kept.stats.buildingsRendered).toBe(3);
    expect(kept.stats.buildingsBoxed).toBe(5);
    expect(kept.records).toHaveLength(8);
    // One box a stand-in, flat or pitched; a pitched one's roof is in its own set.
    const boxes = kept.placements.filter((set) => set.setId === BOX_PLACEMENT_SET_ID);
    expect(boxes.reduce((sum, set) => sum + set.count, 0)).toBe(5);
    // The three with real geometry are the ones the count budget alone keeps.
    const capped = generateWorldgenBatch({
      buildings: requests(),
      pack,
      budgets: { maxBuildings: 3 },
    });
    expect(kept.buildings?.positions).toEqual(capped.buildings?.positions);
    const some = generateWorldgenBatch({
      buildings: requests(),
      pack,
      budgets: { maxBuildings: 3, maxStandIns: 2 },
    });
    expect(some.stats.buildingsBoxed).toBe(2);
    expect(some.stats.buildingsDropped).toBe(3);
  });

  it('stops building meshes it cannot keep once the vertex budget is spent', () => {
    // 400 small houses and vertices for a few dozen: the rest are stand-ins, every one drawn.
    const many: BuildingRequest[] = Array.from({ length: 400 }, (_, index) => ({
      identity: `row:${index}`,
      labels: ['house'],
      outline: translate(SHAPES.box as Vec2[], (index % 20) * 30, Math.floor(index / 20) * 30),
    }));
    const budget = { maxBuildings: 1000, maxBuildingVertices: 600, detailedCount: 0 };
    const batch = generateWorldgenBatch({ buildings: many, pack, budgets: budget });
    expect(batch.stats.buildingsDropped).toBe(0);
    expect(batch.stats.buildingsRendered + batch.stats.buildingsBoxed).toBe(400);
    expect(batch.stats.buildingsRendered).toBeGreaterThan(0);
    expect(batch.stats.buildingsRendered).toBeLessThan(60);
    expect(batch.stats.vertices).toBeLessThanOrEqual(budget.maxBuildingVertices);
    expect(batch.records).toHaveLength(400);
    expect(generateWorldgenBatch({ buildings: many, pack, budgets: budget }).hash).toBe(batch.hash);
  });

  it('reserves roofs and windows for small houses before embellishing the largest building', () => {
    const buildings = [
      {
        identity: 'large',
        labels: ['building'],
        outline: [
          [0, 0],
          [90, 0],
          [90, 40],
          [0, 40],
        ] as Vec2[],
        levels: 12,
      },
      ...requests().map((request) => ({ ...request, labels: ['house'], levels: 2 })),
    ];
    const baseline = generateWorldgenBatch({ buildings, pack, budgets: { detailedCount: 0 } });
    const input = {
      buildings,
      pack,
      budgets: { maxBuildingVertices: baseline.stats.vertices, maxMaterialGroups: 3 },
    };
    const output = generateWorldgenBatch(input);
    expect(output.stats.buildingsRendered).toBe(buildings.length);
    expect(output.stats.buildingsBoxed).toBe(0);
    expect(output.stats.vertices).toBeLessThanOrEqual(input.budgets.maxBuildingVertices);
    expect(output.buildings?.groups.length).toBeLessThanOrEqual(3);
    expect(output.buildings?.groups.some((group) => group.slot === 'window')).toBe(true);
    expect(
      output.records.map(({ identity, roof, height }) => ({ identity, roof, height })),
    ).toEqual(baseline.records.map(({ identity, roof, height }) => ({ identity, roof, height })));
    const steps = generateWorldgenBatchSteps(input, 1);
    let done = 0;
    for (;;) {
      const next = steps.next();
      if (next.done) {
        expect(next.value.hash).toBe(output.hash);
        break;
      }
      expect(next.value.done).toBeGreaterThan(done);
      expect(next.value.done).toBeLessThanOrEqual(next.value.total);
      done = next.value.done;
    }
  });

  it('retains ground contact with only the flat-ground baseline vertex and material budget', () => {
    const buildings = requests();
    const flat = generateWorldgenBatch({ buildings, pack, budgets: { detailedCount: 0 } });
    const output = generateWorldgenBatch({
      buildings,
      pack,
      ground: { ...FLAT_GROUND, sampleHeight: (x) => x * 0.2 },
      budgets: {
        detailedCount: 0,
        maxBuildingVertices: flat.stats.vertices,
        maxMaterialGroups: flat.buildings?.groups.length ?? 0,
      },
    });
    expect(output.stats.buildingsRendered).toBe(buildings.length);
    expect(output.stats.buildingsBoxed).toBe(0);
    expect(output.stats.vertices).toBe(flat.stats.vertices);
    const positions = output.buildings?.positions as Float32Array;
    for (const request of buildings) {
      for (const [x, z] of request.outline) {
        let bottom = Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          if (
            Math.abs((positions[i] as number) - x) < 1e-4 &&
            Math.abs((positions[i + 2] as number) - z) < 1e-4
          )
            bottom = Math.min(bottom, positions[i + 1] as number);
        }
        expect(bottom).toBeLessThanOrEqual(x * 0.2 + 1e-4);
      }
    }
  });

  it('still uses boxes for exhausted hard budgets and explicitly distant tiers', () => {
    for (const budgets of [{ maxBuildingVertices: 0 }, { maxMaterialGroups: 0 }]) {
      const output = generateWorldgenBatch({ buildings: requests(), pack, budgets });
      expect(output.stats.buildingsBoxed).toBe(8);
      expect(output.buildings).toBeUndefined();
    }
    expect(
      generateWorldgenBatch({ buildings: requests(), pack, tier: 99 }).stats.buildingsBoxed,
    ).toBe(8);
  });

  it('falls back to walls and roof, then a roofed stand-in, before a plain box', () => {
    const houses = requests().map((request) => ({ ...request, labels: ['house'], levels: 2 }));
    const simplified = generateWorldgenBatch({
      buildings: houses,
      pack,
      budgets: { detailedCount: 0 },
    });
    const structural = generateWorldgenBatch({ buildings: houses, pack, tier: 2 });
    expect(structural.stats.vertices).toBeLessThan(simplified.stats.vertices);
    // Room for every house's walls and roof, but not every facade.
    const squeezed = generateWorldgenBatch({
      buildings: houses,
      pack,
      budgets: {
        detailedCount: 0,
        maxBuildingVertices: Math.floor(
          (structural.stats.vertices + simplified.stats.vertices) / 2,
        ),
      },
    });
    expect(squeezed.stats.buildingsBoxed).toBe(0);
    expect(squeezed.stats.buildingsRendered).toBe(houses.length);
    expect(squeezed.records.map((record) => record.roof)).toEqual(
      simplified.records.map((record) => record.roof),
    );
    // No room at all: every house stands in as a box, and each pitched one keeps a roof on it,
    // ridged along its longer side, at its style's slope (25 to 40 degrees in this pack).
    const exhausted = generateWorldgenBatch({
      buildings: houses,
      pack,
      budgets: { maxBuildingVertices: 0 },
    });
    expect(exhausted.stats.buildingsBoxed).toBe(houses.length);
    const walls = exhausted.placements.find((set) => set.setId === BOX_PLACEMENT_SET_ID);
    expect(walls?.modelRef).toBe('builtin:box');
    expect(walls?.count).toBe(houses.length);
    const roofs = exhausted.placements.find((set) => set.setId === GABLE_ROOF_PLACEMENT_SET_ID);
    expect(roofs?.modelRef).toBe('builtin:roof.gable');
    const pitched = simplified.records.filter((record) =>
      ['gable', 'hip', 'pyramid', 'gambrel', 'mansard'].includes(record.roof),
    ).length;
    expect(pitched).toBeGreaterThan(0);
    expect(roofs?.count).toBe(pitched);
    for (let index = 0; index < (roofs?.count ?? 0); index++) {
      const offset = index * PLACEMENT_STRIDE;
      const along = roofs?.data[offset + 4] as number;
      const depth = roofs?.data[offset + 6] as number;
      expect(along).toBeGreaterThanOrEqual(depth);
      const degrees =
        (Math.atan((roofs?.data[offset + 5] as number) / (depth / 2)) * 180) / Math.PI;
      expect(degrees).toBeGreaterThan(24.9);
      expect(degrees).toBeLessThan(40.1);
    }
  });

  it('skips degenerate outlines and reports empty batches', () => {
    const output = generateWorldgenBatch({
      buildings: [{ identity: 'bad', labels: ['house'], outline: SHAPES.sliver as Vec2[] }],
      pack,
    });
    expect(output.buildings).toBeUndefined();
    expect(output.stats.buildingsSkipped).toBe(1);
    expect(output.placements).toHaveLength(0);
    expect(worldgenTransferables(output)).toHaveLength(0);
  });

  it('encodes a GLB with one primitive per material group', () => {
    const output = generateWorldgenBatch({ buildings: requests().slice(0, 2), pack });
    expect(output.buildings).toBeDefined();
    if (output.buildings === undefined) return;
    const glb = encodeGlb(output.buildings);
    const view = new DataView(glb.buffer);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(8, true)).toBe(glb.byteLength);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as {
      meshes: Array<{ primitives: unknown[] }>;
      accessors: Array<{ count: number }>;
    };
    expect(json.meshes[0]?.primitives).toHaveLength(output.buildings.groups.length);
    expect(json.accessors[0]?.count).toBe(output.buildings.vertexCount);
    expect(worldgenTransferables(output).length).toBeGreaterThanOrEqual(5);
  });

  it('preserves transparent and cutout surface metadata without changing opaque defaults', () => {
    const output = generateWorldgenBatch({ buildings: requests().slice(0, 2), pack });
    expect(output.buildings).toBeDefined();
    if (output.buildings === undefined) return;
    expect(output.buildings.groups.length).toBeGreaterThanOrEqual(3);
    const glb = encodeGlb(output.buildings, [
      {
        name: 'clear-glass',
        baseColorFactor: [1, 1, 1, 0.26],
        alphaMode: 'BLEND',
        doubleSided: true,
      },
      { name: 'cutout', alphaMode: 'MASK', alphaCutoff: 0.35 },
    ]);
    const jsonLength = new DataView(glb.buffer).getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)));
    expect(json.materials[0]).toMatchObject({
      alphaMode: 'BLEND',
      doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 0.26] },
    });
    expect(json.materials[0]).not.toHaveProperty('alphaCutoff');
    expect(json.materials[1]).toMatchObject({ alphaMode: 'MASK', alphaCutoff: 0.35 });
    expect(json.materials[2]).toMatchObject({ alphaMode: 'OPAQUE', doubleSided: false });
  });

  it('aligns every RGB vertex to four bytes without adding alpha or changing colors', () => {
    const mesh = generateWorldgenBatch({ buildings: requests().slice(0, 2), pack }).buildings;
    expect(mesh).toBeDefined();
    if (!mesh) return;
    const original = mesh.colors.slice();
    const glb = encodeGlb(mesh);
    const jsonLength = new DataView(glb.buffer).getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)));
    for (const primitive of json.meshes[0].primitives) {
      const accessor = json.accessors[primitive.attributes.COLOR_0];
      const view = json.bufferViews[accessor.bufferView];
      expect(accessor).toMatchObject({ type: 'VEC3', componentType: 5121, normalized: true });
      expect(view.byteStride).toBe(4);
      expect(view.byteOffset % 4).toBe(0);
      const start = 28 + jsonLength + view.byteOffset;
      for (let vertex = 0; vertex < accessor.count; vertex++) {
        expect(glb.subarray(start + vertex * 4, start + vertex * 4 + 3)).toEqual(
          original.subarray(vertex * 3, vertex * 3 + 3),
        );
        expect(glb[start + vertex * 4 + 3]).toBe(0);
      }
    }
    expect(mesh.colors).toEqual(original);
    expect(encodeGlb(mesh)).toEqual(glb);
  });
});
