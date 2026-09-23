import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { InteriorStreamer } from '../../src/client/interior-streamer';
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
      ) as THREE.MeshLambertMaterial[]
    ).find((m) => m.map !== null);
    if (!textured?.map) throw new Error('No shared texture');
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
    const resident = region.children[1] as THREE.Group;
    const geometry = (resident.children[0] as THREE.Mesh).geometry;
    const positions = Array.from(geometry.getAttribute('position').array);
    const dispose = vi.spyOn(geometry, 'dispose');
    settle(stream, [1000, 1.7, 1000]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(stream.stats().bytes).toBe(0);
    expect(gate.geometry.drawRange.count).toBe(original.length);
    settle(stream, [10, 1.7, -3]);
    expect(
      Array.from(
        ((region.children[1] as THREE.Group).children[0] as THREE.Mesh).geometry.getAttribute(
          'position',
        ).array,
      ),
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
});
