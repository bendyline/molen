import { buildWorld, stateHash } from '@bendyline/molen-kernel';
import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { generateWorldgenBatch } from '../../src/kernel/batch';
import { WORLDGEN_BUILDING_EXAMPLE } from '../../src/kernel/components';
import { createWorldgenIndex } from '../../src/kernel/index-query';
import { installWorldgen, worldgenIndexOf, worldgenScriptApi } from '../../src/kernel/install';
import type { Vec2 } from '../../src/kernel/types';
import '../../src/kernel';
import { createTestPack } from '../helpers/pack';
import { SHAPES } from '../helpers/shapes';

const pack = await createTestPack();

function batch() {
  return generateWorldgenBatch({
    buildings: [0, 1, 2].map((index) => ({
      identity: `f:${index}`,
      labels: ['house'],
      outline: (SHAPES.box as Vec2[]).map(([x, z]): Vec2 => [x + index * 40, z]),
      levels: 2,
    })),
    scatter: {
      polygons: [
        {
          label: 'forest',
          ring: [
            [0, 30],
            [120, 30],
            [120, 90],
            [0, 90],
          ],
        },
      ],
      exclusions: [],
      emitBounds: [0, 30, 120, 90],
      frame: { originX: 0, originZ: 0, unitsPerMeter: 1 },
      keep: 1,
    },
    pack,
  });
}

describe('worldgen index', () => {
  it('answers point and radius queries for buildings and props', () => {
    const output = batch();
    const outlines = new Map<string, Vec2[]>();
    for (const record of output.records) {
      const shift = Number(record.identity.slice(2)) * 40;
      outlines.set(
        record.identity,
        (SHAPES.box as Vec2[]).map(([x, z]) => [x + shift, z]),
      );
    }
    const index = createWorldgenIndex(output.records, output.placements, { outlines });
    expect(index.buildingCount).toBe(3);
    expect(index.propCount).toBeGreaterThan(0);
    expect(index.buildingAt(6, 4)?.identity).toBe('f:0');
    expect(index.buildingAt(46, 4)?.identity).toBe('f:1');
    expect(index.buildingAt(200, 200)).toBeUndefined();
    const near = index.buildingsNear(6, 4, 50);
    expect(near.map((hit) => hit.record.identity)).toEqual(['f:0', 'f:1']);
    expect(near[0]?.distance).toBeLessThan(near[1]?.distance ?? 0);
    const props = index.propsNear(60, 60, 15);
    expect(props.length).toBeGreaterThan(0);
    for (const hit of props) {
      expect(Math.hypot(hit.x - 60, hit.z - 60)).toBeLessThanOrEqual(15);
      expect(hit.modelRef.startsWith('builtin:')).toBe(true);
    }
    expect(props.every((hit, i) => i === 0 || hit.distance >= (props[i - 1]?.distance ?? 0))).toBe(
      true,
    );
    const more = createWorldgenIndex();
    more.add(output.records, []);
    expect(more.buildingCount).toBe(3);
    expect(more.propCount).toBe(0);
  });

  it('installs on a world without touching its state hash and reaches scripts', () => {
    const output = batch();
    const index = createWorldgenIndex(output.records, output.placements);
    const parsed = validate('scene', {
      format: 'molen/scene@3',
      name: 'worldgen-query',
      entities: [{ id: 'probe', components: { tag: { name: 'probe' } } }],
      scripts: [
        {
          id: 's',
          code: `molen.on('tick', () => {
            const hit = molen.worldgen.buildingAt(6, 4);
            molen.set('probe', 'tag', { name: hit ? hit.identity : 'none', near: molen.worldgen.buildingsNear(6, 4, 50).length, props: molen.worldgen.propCount() });
          });`,
        },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.formatted);
    const plain = buildWorld(parsed.value, undefined, { scripts: false });
    const before = stateHash(plain);
    const handle = installWorldgen(plain, index);
    expect(worldgenIndexOf(plain)).toBe(index);
    expect(stateHash(plain)).toBe(before);
    expect(handle.buildingAt(6, 4)?.identity).toBe('f:0');

    const scripted = buildWorld(parsed.value, undefined, {
      scriptExtensions: { worldgen: worldgenScriptApi(installWorldgen(plain, index)) },
    });
    scripted.step();
    const tag = scripted.get('probe', { name: 'tag' } as never) as
      | { name: string; near: number; props: number }
      | undefined;
    expect(tag?.name).toBe('f:0');
    expect(tag?.near).toBe(2);
    expect(tag?.props).toBe(index.propCount);
  });

  it('registers the worldgenBuilding component with a valid example', () => {
    const parsed = validate('scene', {
      format: 'molen/scene@3',
      name: 'hall',
      entities: [
        {
          id: 'hall',
          components: {
            transform: { pos: [0, 0, 0] },
            worldgenBuilding: WORLDGEN_BUILDING_EXAMPLE,
          },
        },
      ],
    });
    expect(parsed.ok, parsed.ok ? '' : parsed.formatted).toBe(true);
    const bad = validate('scene', {
      format: 'molen/scene@3',
      name: 'hall',
      entities: [
        { id: 'hall', components: { worldgenBuilding: { style: 'nope', outline: [[0, 0]] } } },
      ],
    });
    expect(bad.ok).toBe(false);
  });
});
