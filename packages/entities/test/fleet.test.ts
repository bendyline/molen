import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MOLEN_CYCLE_ENTITY_IDS,
  MOLEN_VEHICLE_ENTITY_IDS,
  MOLEN_WATERCRAFT_ENTITY_IDS,
} from '../src/index';

const root = fileURLToPath(new URL('../../../content/entities/', import.meta.url));

describe('fleet model contracts', () => {
  it.each([
    ...MOLEN_VEHICLE_ENTITY_IDS.slice(5),
    ...MOLEN_CYCLE_ENTITY_IDS,
    ...MOLEN_WATERCRAFT_ENTITY_IDS,
  ])('keeps %s small, finite, and bound to its animation pivots', async (id) => {
    const folder = `${root}/assets/${id.replaceAll('.', '/')}`;
    const sidecar = JSON.parse(await readFile(`${folder}/asset.json`, 'utf8'));
    expect(sidecar.stats.triangles).toBeLessThanOrEqual(2000);
    const bytes = await readFile(`${folder}/model.glb`);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    expect(gltf.images ?? []).toHaveLength(0);
    const names = new Set(gltf.nodes.map((n: { name?: string }) => n.name));
    if (!id.includes('.watercraft.')) {
      const wheels = id.includes('.cycle.')
        ? ['wheel-front', 'wheel-rear']
        : ['wheel-front-left', 'wheel-front-right', 'wheel-rear-left', 'wheel-rear-right'];
      for (const wheel of wheels) expect(names.has(wheel), wheel).toBe(true);
      if (id.includes('.cycle.')) {
        expect(names.has('handlebar')).toBe(true);
        if (id.includes('bicycle'))
          for (const node of ['pedal-crank', 'pedal-left', 'pedal-right'])
            expect(names.has(node), node).toBe(true);
      }
    }
    for (const accessor of gltf.accessors) {
      for (const bound of [...(accessor.min ?? []), ...(accessor.max ?? [])])
        expect(Number.isFinite(bound)).toBe(true);
    }
  });
});
