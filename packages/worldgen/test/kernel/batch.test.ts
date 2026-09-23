import { describe, expect, it } from 'vitest';
import {
  BOX_PLACEMENT_SET_ID,
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
});
