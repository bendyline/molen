import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MOLEN_CYCLE_ENTITY_IDS,
  MOLEN_REGIONAL_VEHICLE_ENTITY_IDS,
  MOLEN_RV_ENTITY_IDS,
  MOLEN_US_VEHICLE_ENTITY_IDS,
  MOLEN_VARIETY_VEHICLE_ENTITY_IDS,
  MOLEN_VEHICLE_ENTITY_IDS,
  MOLEN_WATERCRAFT_ENTITY_IDS,
} from '../src/index';

const root = fileURLToPath(new URL('../../../content/entities/', import.meta.url));

describe('fleet model contracts', () => {
  it.each([
    ...MOLEN_VEHICLE_ENTITY_IDS,
    ...MOLEN_CYCLE_ENTITY_IDS,
    ...MOLEN_WATERCRAFT_ENTITY_IDS,
  ])('keeps %s small, finite, and bound to its animation pivots', async (id) => {
    const folder = `${root}/assets/${id.replaceAll('.', '/')}`;
    const sidecar = JSON.parse(await readFile(`${folder}/asset.json`, 'utf8'));
    // These are player-view masters. Ambient rendering selects separate instanced proxies.
    const closeViewReference =
      (MOLEN_US_VEHICLE_ENTITY_IDS as readonly string[]).includes(id) ||
      (MOLEN_REGIONAL_VEHICLE_ENTITY_IDS as readonly string[]).includes(id);
    const varietyReference =
      (MOLEN_VARIETY_VEHICLE_ENTITY_IDS as readonly string[]).includes(id) ||
      [
        'molen.entities.vehicle.mini_cooper_countryman_2012',
        'molen.entities.vehicle.acura_mdx_2019',
      ].includes(id);
    expect(sidecar.stats.triangles).toBeLessThanOrEqual(
      (MOLEN_RV_ENTITY_IDS as readonly string[]).includes(id)
        ? 45000
        : varietyReference
          ? 26000
          : closeViewReference
            ? 22000
            : 15000,
    );
    const bytes = await readFile(`${folder}/model.glb`);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    expect(gltf.images ?? []).toHaveLength(0);
    const names = new Set(gltf.nodes.map((n: { name?: string }) => n.name));
    if (!id.includes('.watercraft.')) {
      const wheels = id.endsWith('.lightrail')
        ? ['bogie-front-wheel-front-left', 'bogie-rear-wheel-rear-right']
        : id.includes('.cycle.')
          ? ['wheel-front', 'wheel-rear']
          : ['wheel-front-left', 'wheel-front-right', 'wheel-rear-left', 'wheel-rear-right'];
      for (const wheel of wheels) {
        expect(names.has(wheel), wheel).toBe(true);
        const pivot = gltf.nodes.find((node: { name?: string }) => node.name === wheel);
        const spin = gltf.nodes[pivot.children[0]];
        expect(spin.name, `${wheel}: renderer rotates its first child`).toBe(`${wheel}-spin`);
        const brakes = gltf.nodes.findIndex(
          (node: { name?: string }) => node.name === `${wheel}-brakes`,
        );
        if (brakes !== -1)
          expect(pivot.children, `${wheel}: caliper must not spin with the rim`).toContain(brakes);
      }
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
