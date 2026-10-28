import { readFileSync } from 'node:fs';
import { BoatState } from '@bendyline/molen-kernel/boats';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { Mounted, mountEntity } from '@bendyline/molen-kernel/vehicles';
import { Transform } from '@bendyline/molen-kernel/world';
import { tagTerrainObject } from '@bendyline/molen-terrain/client';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EarthVehicles } from '../src/client/vehicles';
import { EarthWater } from '../src/client/water';

const types = createTypeLibrary([
  JSON.parse(
    readFileSync(
      new URL('../../../content/entities/types/watercraft.types.json', import.meta.url),
      'utf8',
    ),
  ),
]);
const kind = 'molen.entities.watercraft.speedboat';
function host() {
  return new EarthVehicles({
    root: new THREE.Group(),
    sampleHeight: () => -10,
    types,
    loadModel: async () => new THREE.Group(),
    water: { waves: [], current: [0, 0] },
    waterAt: (x, z) => (Math.abs(x) < 100 && Math.abs(z) < 100 ? { height: 5, depth: 10 } : null),
  });
}
describe('Earth boats', () => {
  it('resolves all authored boats, boards, drives, carries a passenger and retains owned hulls', async () => {
    const h = host();
    try {
      expect(EarthVehicles.boatTypeIds(types)).toHaveLength(8);
      expect(EarthVehicles.typeIds(types)).toEqual([]);
      const id = h.spawn(kind, [0, -10, 0], 0, { retain: true }) as string;
      expect(id).toBeTruthy();
      expect(h.pose(id)?.position[1]).toBe(5);
      expect(h.board(id)).toBe(true);
      const pos = h.world.get('world-player', Transform)?.pos;
      h.world.spawnRaw({ transform: { pos, rot: [0, 0, 0, 1] } }, 'guest');
      expect(mountEntity(h.world, 'guest', id, 'passenger')).toBe(true);
      for (let i = 0; i < 120; i++) h.update(1 / 60, { throttle: 1, steering: 0.3, brake: false });
      expect(h.pose(id)?.speed).toBeGreaterThan(2);
      expect(h.cameraPose()?.position.every(Number.isFinite)).toBe(true);
      expect(h.world.get('guest', Mounted)?.vehicle).toBe(id);
      expect(h.exit()).toBeUndefined();
      h.release();
      expect(h.pose(id)?.occupied).toBe(false);
      expect(h.isOwned(id)).toBe(true);
      await Promise.resolve();
      h.remove(id);
      h.world.step();
      expect(h.world.get('guest', Mounted)).toBeUndefined();
    } finally {
      h.dispose();
    }
  });
  it('refuses a dry launch and never settles a boat onto the ground below its waterline', () => {
    const h = host();
    try {
      expect(h.spawn(kind, [150, 0, 0], 0)).toBeUndefined();
      const id = h.spawn(kind, [0, -10, 0], 0) as string;
      h.update(0.1, { throttle: 0, steering: 0, brake: false });
      expect(h.pose(id)?.position[1]).toBe(5);
      expect(h.world.get(id, BoatState)?.anchored).toBe(true);
    } finally {
      h.dispose();
    }
  });
  it('boards from a gangway and exits onto a dry dock above water, not the lake bed', () => {
    const root = new THREE.Group();
    const dock = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 8), new THREE.MeshBasicMaterial());
    dock.position.set(3.7, 0.5, 0);
    root.add(dock);
    const h = new EarthVehicles({
      root,
      types,
      sampleHeight: () => -10,
      loadModel: async () => new THREE.Group(),
      water: { waves: [] },
      waterAt: () => ({ height: 0, depth: 10 }),
    });
    try {
      const id = h.spawn(kind, [0, 0, 0], 0, { retain: true }) as string;
      expect(id).toBeTruthy();
      expect(h.enter([2.1, 2.3, -0.64])).toBe(true);
      const feet = h.exit();
      expect(feet?.[1]).toBeCloseTo(0.72);
      expect(feet?.[0]).toBeGreaterThan(1.7);
    } finally {
      h.dispose();
      dock.geometry.dispose();
      (dock.material as THREE.Material).dispose();
    }
  });
  it('samples rendered lake height in absolute coordinates through a floating origin and eviction', () => {
    const root = new THREE.Group();
    root.position.set(-1000, 0, -2000);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial());
    water.rotation.x = -Math.PI / 2;
    water.position.set(1000, 48, 2000);
    water.userData.terrainWaterSurface = true;
    tagTerrainObject('water', water);
    root.add(water);
    const field = new EarthWater(root, () => 40);
    field.sync();
    expect(field.sample(1000, 2000)?.height).toBeCloseTo(48);
    expect(field.sample(1030, 2000)).toBeNull();
    root.remove(water);
    expect(field.sample(1000, 2000)).toBeNull();
    water.geometry.dispose();
    (water.material as THREE.Material).dispose();
  });
});
