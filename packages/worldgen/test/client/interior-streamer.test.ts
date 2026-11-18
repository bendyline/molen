import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  InteriorStreamer,
  type InteriorStreamingOptions,
} from '../../src/client/interior-streamer';
import { createInteriorSite } from '../../src/kernel/interior-site';
import { FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import { INTERIORS } from '../helpers/content';

function fixture(identity: string, x = 0) {
  const outline: Vec2[] = [
    [x, 0],
    [x + 20, 0],
    [x + 20, 20],
    [x, 20],
  ];
  const site = createInteriorSite(
    { identity, labels: ['supermarket'], outline },
    INTERIORS,
    outline,
    [],
    0,
    3.5,
    FLAT_GROUND,
  );
  if (!site) throw new Error('No site');
  return site;
}
function settle(stream: InteriorStreamer, at: [number, number, number], count = 20): void {
  for (let i = 0; i < count; i++) stream.update(at);
}
describe('lazy interior lifecycle', () => {
  it('shows a prepared interior only once its preparation settles, keeping the covers until then', async () => {
    const region = new THREE.Group();
    new THREE.Group().add(region);
    const site = fixture('prepared');
    const pending: Array<{ object: THREE.Object3D; signal: AbortSignal; resolve: () => void }> = [];
    const stream = new InteriorStreamer({
      catalog: INTERIORS,
      frameBudgetMs: 50,
      prepare: (object, signal, parent) => {
        expect(parent).toBe(region);
        return new Promise<void>((resolve) => pending.push({ object, signal, resolve }));
      },
    });
    stream.register(region, [site]);
    const covers = (region.getObjectByName('worldgen:interior-portals') as THREE.Mesh).geometry;
    // Indices of the covers drawn (the range starts unbounded: every cover).
    const drawn = (): number => Math.min(covers.drawRange.count, covers.index?.count ?? 0);
    const covered = drawn();
    try {
      settle(stream, [10, 1.7, 10]);
      expect(pending).toHaveLength(1);
      expect(stream.stats().resident).toBe(1);
      expect(pending[0]?.object.parent).toBeNull();
      expect(drawn()).toBe(covered);
      pending[0]?.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(pending[0]?.object.parent).toBe(region);
      expect(drawn()).toBeLessThan(covered);
      // Evicted while preparing: cancelled, and never shown.
      settle(stream, [10, 1000, 10]);
      settle(stream, [10, 1.7, 10]);
      expect(pending).toHaveLength(2);
      settle(stream, [10, 1000, 10]);
      expect(pending[1]?.signal.aborted).toBe(true);
      pending[1]?.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(pending[1]?.object.parent).toBeNull();
      expect(drawn()).toBe(covered);
    } finally {
      stream.dispose();
    }
  });

  it('stands covers in for an unloaded roof opening, and lets a host furnish what it publishes', () => {
    const scene = new THREE.Group();
    const region = new THREE.Group();
    scene.add(region);
    const site = fixture('covered');
    const windows = site.openings.filter((opening) => opening.kind === 'window').length;
    site.covers = [
      [
        [4, 6, 4],
        [8, 6, 4],
        [8, 6, 8],
        [4, 6, 8],
      ],
    ];
    const furnish = vi.fn((_plan: unknown, group: THREE.Group) => {
      group.add(new THREE.Group());
    });
    const stream = new InteriorStreamer({ catalog: INTERIORS, frameBudgetMs: 50, furnish });
    stream.register(region, [site]);
    const portals = region.getObjectByName('worldgen:interior-portals') as THREE.Mesh;
    // One quad for each window, and one for the roof; the shut door closes its own doorway.
    expect(portals.geometry.index?.count).toBe((windows + 1) * 6);
    expect(furnish).not.toHaveBeenCalled();
    settle(stream, [10, 2, 10]);
    expect(furnish).toHaveBeenCalledTimes(1);
    expect(portals.geometry.drawRange.count).toBe(0);
    stream.dispose();
  });

  it('keeps an interior whose host cannot furnish it, and does not retry forever', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Group();
    const region = new THREE.Group();
    scene.add(region);
    const furnish = vi.fn(() => {
      throw new Error('no fleet');
    });
    const stream = new InteriorStreamer({ catalog: INTERIORS, frameBudgetMs: 50, furnish });
    stream.register(region, [fixture('bare')]);
    settle(stream, [10, 2, 10]);
    expect(stream.stats().resident).toBe(1);
    expect(stream.stats().failed).toBe(0);
    expect(furnish).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    stream.dispose();
  });

  it('skips footprint queries above a region and restores interiors after descending', () => {
    const scene = new THREE.Group();
    const region = new THREE.Group();
    scene.add(region);
    const site = fixture('flight');
    const stream = new InteriorStreamer({ catalog: INTERIORS, frameBudgetMs: 50 });
    stream.register(region, [site]);
    const outline = site.outline;
    const readOutline = vi.fn(() => outline);
    Object.defineProperty(site, 'outline', { get: readOutline });
    try {
      settle(stream, [10, 1000, 10]);
      expect(readOutline).not.toHaveBeenCalled();
      expect(stream.stats().resident).toBe(0);
      settle(stream, [10, 1.7, 10]);
      expect(stream.stats().resident).toBe(1);
      readOutline.mockClear();
      settle(stream, [10, 1000, 10]);
      expect(readOutline).not.toHaveBeenCalled();
      expect(stream.stats().resident).toBe(0);
      settle(stream, [10, 1.7, 10]);
      expect(stream.stats().resident).toBe(1);
    } finally {
      stream.dispose();
    }
  });
  it('retains upstairs residents, shares textured materials and separates visible steps from collision', () => {
    const scene = new THREE.Group(),
      region = new THREE.Group();
    scene.add(region);
    const a = fixture('home-a'),
      b = fixture('home-b', 40);
    for (const site of [a, b]) {
      site.labels = ['house'];
      site.ceiling = 2.84;
      site.storeys = [
        { floor: site.floor, ceiling: 2.84 },
        { floor: 3, ceiling: 5.8 },
      ];
    }
    const stream = new InteriorStreamer({
      catalog: INTERIORS,
      frameBudgetMs: 50,
      loadDistance: 0.2,
      unloadDistance: 1,
    });
    stream.register(region, [a, b]);
    settle(stream, [10, 4.7, 10], 40);
    expect(stream.stats().resident).toBe(1);
    const root = region.children.find((o) => o.name === 'worldgen:interior:home-a') as THREE.Group;
    const steps = root.children.find((o) => o.name.endsWith(':steps')) as THREE.Mesh;
    const proxy = root.children.find((o) => o.name.endsWith(':collision')) as THREE.Mesh;
    expect(steps.userData.walkIgnore).toBe(true);
    expect(proxy.layers.mask).toBe(0);
    expect(proxy.userData.walkCollisionOnly).toBe(true);
    const textured = (
      root.children.flatMap((o) =>
        Array.isArray((o as THREE.Mesh).material)
          ? (o as THREE.Mesh).material
          : [(o as THREE.Mesh).material],
      ) as THREE.MeshStandardMaterial[]
    ).find((m) => m.map !== null);
    if (!textured?.map) throw new Error('No shared texture');
    expect(textured.isMeshStandardMaterial).toBe(true);
    expect(textured.roughness).toBe(0.9);
    expect(textured.metalness).toBe(0);
    expect(textured.vertexColors).toBe(true);
    const materialDispose = vi.spyOn(textured, 'dispose'),
      textureDispose = vi.spyOn(textured.map, 'dispose');
    settle(stream, [50, 4.7, 10], 40);
    const next = region.children.find((o) => o.name === 'worldgen:interior:home-b') as THREE.Group;
    expect(
      next.children.some(
        (o) =>
          Array.isArray((o as THREE.Mesh).material) &&
          ((o as THREE.Mesh).material as THREE.Material[]).includes(textured),
      ),
    ).toBe(true);
    expect(materialDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    stream.dispose();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
  it('keeps portals closed until ready, exposes nearby rooms, evicts and regenerates deterministically', () => {
    const scene = new THREE.Group(),
      region = new THREE.Group();
    scene.add(region);
    const stream = new InteriorStreamer({ catalog: INTERIORS, frameBudgetMs: 50 });
    const s = fixture('one');
    stream.register(region, [s]);
    const gate = region.children[0] as THREE.Mesh;
    const original = Array.from(gate.geometry.index?.array ?? []);
    settle(stream, [1000, 1.7, 1000]);
    expect(stream.stats().generated).toBe(0);
    expect(gate.geometry.drawRange.count).toBe(Infinity);
    settle(stream, [10, 1.7, -3]);
    expect(stream.stats().resident).toBe(1);
    expect(gate.geometry.drawRange.count).toBe(0);
    const interior = (): THREE.Group =>
      region.children.find((o) => o.name === 'worldgen:interior:one') as THREE.Group;
    const geometry = (interior().children[0] as THREE.Mesh).geometry;
    const positions = Array.from(geometry.getAttribute('position').array);
    const dispose = vi.spyOn(geometry, 'dispose');
    settle(stream, [1000, 1.7, 1000]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(stream.stats().bytes).toBe(0);
    expect(gate.geometry.drawRange.count).toBe(original.length);
    settle(stream, [10, 1.7, -3]);
    expect(
      Array.from((interior().children[0] as THREE.Mesh).geometry.getAttribute('position').array),
    ).toEqual(positions);
    stream.dispose();
    expect(region.children.length).toBe(0);
  });
  it('prioritizes nearby buildings under count limits and handles hidden regions and origin shifts', () => {
    const scene = new THREE.Group(),
      region = new THREE.Group();
    scene.add(region);
    const stream = new InteriorStreamer({ catalog: INTERIORS, maxResident: 1, frameBudgetMs: 50 });
    stream.register(region, [fixture('one'), fixture('two', 40)], [9_000_000, 0]);
    settle(stream, [9_000_010, 1.7, 10]);
    expect(stream.stats().resident).toBe(1);
    expect(region.children.some((o) => o.name.endsWith(':one'))).toBe(true);
    scene.position.x = -9_000_000;
    settle(stream, [9_000_050, 1.7, 10]);
    expect(region.children.some((o) => o.name.endsWith(':two'))).toBe(true);
    region.visible = false;
    stream.update([9_000_050, 1.7, 10]);
    expect(stream.stats().resident).toBe(0);
    stream.unregister(region);
    expect(stream.stats().sites).toBe(0);
    stream.dispose();
  });
  it('cancels unfinished work on removal and obeys memory and altitude budgets', () => {
    const scene = new THREE.Group(),
      region = new THREE.Group();
    scene.add(region);
    const stream = new InteriorStreamer({ catalog: INTERIORS, maxBytes: 1, frameBudgetMs: 50 });
    stream.register(region, [fixture('one')]);
    settle(stream, [10, 1000, 10]);
    expect(stream.stats().generated).toBe(0);
    settle(stream, [10, 1.7, 10]);
    expect(stream.stats().bytes).toBe(0);
    expect(stream.stats().failed).toBe(1);
    stream.unregister(region);
    expect(stream.stats().pending).toBe(0);
    expect(region.children).toEqual([]);
    stream.dispose();
  });

  describe('doors', () => {
    /** A clock the test advances, so swings take a known time. */
    function setup(
      site = fixture('shop'),
      options: Pick<InteriorStreamingOptions, 'maxBytes' | 'prepare'> = {},
    ) {
      const scene = new THREE.Group(),
        region = new THREE.Group();
      scene.add(region);
      let time = 0;
      const stream = new InteriorStreamer({
        catalog: INTERIORS,
        frameBudgetMs: 50,
        now: () => time,
        ...options,
      });
      stream.register(region, [site]);
      const mesh = region.getObjectByName('worldgen:doors') as THREE.Mesh;
      const step = (at: [number, number, number], seconds: number): void => {
        for (let t = 0; t < seconds; t += 1 / 30) {
          time += 1000 / 30;
          stream.update(at);
        }
      };
      return { scene, region, stream, mesh, step, site };
    }
    const outside: [number, number, number] = [10, 1.7, -1];
    const inside: [number, number, number] = [10, 1.7, 1.2];
    const facingIn: [number, number, number] = [0, 0, 1];
    /** How far the leaves reach into (+) or out of (-) the building, in meters. */
    const reach = (mesh: THREE.Mesh): [number, number] => {
      const z = Array.from(mesh.geometry.getAttribute('position').array).filter(
        (_, i) => i % 3 === 2,
      );
      return [Math.min(...z), Math.max(...z)];
    };

    it('closes a doorway with a shut door instead of a cover, found from in front of it', () => {
      const { mesh, stream, site } = setup();
      expect(mesh.isMesh).toBe(true);
      expect(site.openings.some((opening) => opening.kind === 'door')).toBe(true);
      const shut = reach(mesh);
      expect(shut[0]).toBeGreaterThan(-0.2);
      expect(shut[1]).toBeLessThan(0.2);
      const door = stream.doorAt(outside, { facing: facingIn });
      expect(door).toMatchObject({
        id: 'shop#door0',
        identity: 'shop',
        open: false,
        amount: 0,
        waiting: false,
        locked: false,
      });
      expect(door?.distance).toBeCloseTo(1, 5);
      door?.position.forEach((value, i) => {
        expect(value).toBeCloseTo([10, 0.04, 0][i] as number, 6);
      });
      expect(stream.doorAt(outside, { facing: [0, 0, -1] })).toBeUndefined();
      expect(stream.doorAt([10, 1.7, -3])).toBeUndefined();
      expect(stream.doorAt([10, 30, -1])).toBeUndefined();
      stream.dispose();
    });

    it('waits for its rooms, then swings in away from an opener outside and back shut', async () => {
      let release = (): void => {};
      const { mesh, stream, step } = setup(fixture('shop'), {
        prepare: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      });
      const closed = Array.from(mesh.geometry.getAttribute('position').array);
      // Asked from too far out for its rooms to be built, it gives up.
      expect(stream.setDoor('shop#door0', true, [10, 1.7, -80])).toBe(true);
      step([10, 1.7, -80], 0.2);
      expect(stream.doorAt(outside)?.open).toBe(false);
      // Asked while its rooms are being prepared, it waits for them.
      step(outside, 0.3);
      expect(stream.stats().generated).toBe(1);
      expect(stream.setDoor('shop#door0', true, outside)).toBe(true);
      step(outside, 0.5);
      expect(stream.doorAt(outside)).toMatchObject({ open: true, waiting: true, amount: 0 });
      expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(closed);
      release();
      for (let i = 0; i < 4; i++) await Promise.resolve();
      step(outside, 1);
      expect(stream.doorAt(outside, { facing: facingIn })).toMatchObject({
        open: true,
        amount: 1,
        waiting: false,
      });
      // Both leaves of the wide shop door lie into the building, clear of the street.
      const open = reach(mesh);
      expect(open[0]).toBeGreaterThan(-0.2);
      expect(open[1]).toBeGreaterThan(0.9);
      expect(stream.setDoor('shop#door0', false, outside)).toBe(true);
      step(outside, 1);
      expect(stream.doorAt(outside)?.open).toBe(false);
      const back = Array.from(mesh.geometry.getAttribute('position').array);
      back.forEach((value, i) => {
        expect(value).toBeCloseTo(closed[i] as number, 4);
      });
      stream.dispose();
    });

    it('opens outward for someone inside, will not shut on the doorway, and shuts with its rooms', () => {
      const { mesh, stream, step } = setup();
      step(inside, 0.5);
      expect(stream.setDoor('shop#door0', true, inside)).toBe(true);
      step(inside, 1);
      const open = reach(mesh);
      expect(open[0]).toBeLessThan(-0.9);
      expect(open[1]).toBeLessThan(0.2);
      expect(stream.setDoor('shop#door0', false, [10, 0.04, 0])).toBe(false);
      expect(stream.doorAt(inside)?.open).toBe(true);
      // Walking away releases the interior, and the door shuts with it.
      step([10, 1.7, -300], 0.2);
      expect(stream.stats().resident).toBe(0);
      expect(reach(mesh)[0]).toBeGreaterThan(-0.2);
      expect(stream.doorAt(outside)?.open).toBe(false);
      stream.dispose();
    });

    it('stays shut when its rooms cannot be built', () => {
      const { stream, step } = setup(fixture('vault'), { maxBytes: 64 });
      step(outside, 0.5);
      expect(stream.stats().failed).toBe(1);
      expect(stream.doorAt(outside)?.locked).toBe(true);
      expect(stream.setDoor('vault#door0', true, outside)).toBe(false);
      stream.dispose();
    });

    it('gives a house one painted leaf and a parked-car entrance none', () => {
      const outline: Vec2[] = [
        [0, 0],
        [9, 0],
        [9, 8],
        [0, 8],
      ];
      const house = createInteriorSite(
        { identity: 'house', labels: ['house'], outline },
        INTERIORS,
        outline,
        [],
        0,
        2.9,
        FLAT_GROUND,
      );
      if (!house) throw new Error('No site');
      const { stream, mesh } = setup(house);
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(24);
      const door = stream.doorAt([4.5, 1.7, -1]);
      expect(door?.id).toBe('house#door0');
      stream.dispose();
      const garage = { ...fixture('garage'), parking: {} as never };
      const parked = setup(garage);
      expect(parked.mesh).toBeUndefined();
      expect(parked.stream.doorAt([10, 1.7, -1])).toBeUndefined();
      parked.stream.dispose();
    });
  });
});
