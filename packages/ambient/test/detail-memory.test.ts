import type { VehicleData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { VehicleDetail } from '../src/client/detail';

const data = {
  spec: { wheelRadius: 0.3, wheelbase: 2.5 },
  visual: { wheelNodes: [], frontWheelNodes: [], paintMaterial: 'paint' },
} as unknown as VehicleData;
const model = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
const candidate = (i: number) => ({
  id: `car${i}`,
  type: `type${i}`,
  color: '#ffffff',
  distance: 1,
});
describe('vehicle detail residency', () => {
  it('disposes a preparing model once when the pool closes', async () => {
    const disposed = vi.fn();
    let finish: () => void = () => {};
    const m = model();
    m.geometry.addEventListener('dispose', disposed);
    const detail = new VehicleDetail({
      parent: new THREE.Group(),
      models: { vehicle: () => data, load: async () => m },
      prepare: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    detail.select([candidate(0)], () => true);
    await flush();
    detail.dispose();
    finish();
    await flush();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(detail.cacheStats().bytes).toBe(0);
    expect(() => detail.setCacheBudget({ modelBytes: Number.NaN })).toThrow(/finite/);
  });
  it('bounds idle models and disposes evicted geometry during travel', async () => {
    const disposed = vi.fn();
    const detail = new VehicleDetail({
      parent: new THREE.Group(),
      models: {
        vehicle: () => data,
        load: async () => {
          const m = model();
          m.geometry.addEventListener('dispose', disposed);
          return m;
        },
      },
    });
    detail.setMax(1);
    detail.setCacheBudget({ idleModels: 2, modelBytes: 100000 });
    for (let i = 0; i < 30; i++) {
      detail.select([candidate(i)], () => true);
      await flush();
      expect(detail.cacheStats().active).toBeLessThanOrEqual(1);
      expect(detail.cacheStats().idle).toBeLessThanOrEqual(2);
      expect(detail.cacheStats().bytes).toBeLessThanOrEqual(100000);
    }
    expect(disposed.mock.calls.length).toBeGreaterThan(25);
    detail.dispose();
    expect(detail.cacheStats().bytes).toBe(0);
  });
  it('supports zero idle retention and reduced byte budgets', async () => {
    const detail = new VehicleDetail({
      parent: new THREE.Group(),
      models: { vehicle: () => data, load: async () => model() },
    });
    detail.setCacheBudget({ idleModels: 0 });
    detail.select([candidate(0)], () => true);
    await flush();
    expect(detail.count).toBe(1);
    detail.select([], () => true);
    expect(detail.cacheStats().bytes).toBe(0);
    detail.select([candidate(1)], () => true);
    await flush();
    detail.setCacheBudget({ modelBytes: 0 });
    expect(detail.cacheStats().bytes).toBe(0);
    detail.dispose();
  });
  it('caps pending loads, aborts stale work, and disposes late completions', async () => {
    const pending: Array<{ resolve: (m: THREE.Object3D) => void; signal?: AbortSignal }> = [];
    const detail = new VehicleDetail({
      parent: new THREE.Group(),
      models: {
        vehicle: () => data,
        load: (_type, signal) => new Promise((resolve) => pending.push({ resolve, signal })),
      },
    });
    detail.setCacheBudget({ concurrentLoads: 2 });
    const list = Array.from({ length: 8 }, (_, i) => candidate(i));
    for (let i = 0; i < 8; i++) detail.select(list, () => true);
    expect(pending).toHaveLength(2);
    detail.select([], () => true);
    expect(pending.every((p) => p.signal?.aborted)).toBe(true);
    const disposed = vi.fn();
    for (const p of pending) {
      const m = model();
      m.geometry.addEventListener('dispose', disposed);
      p.resolve(m);
    }
    await flush();
    expect(disposed).toHaveBeenCalledTimes(2);
    expect(detail.cacheStats()).toEqual({ active: 0, idle: 0, bytes: 0, pending: 0 });
    detail.dispose();
  });
  it('orders preparation by the waiting car, frees its slot when the car leaves, and keeps the model', async () => {
    const preparing: Array<{ object: THREE.Object3D; finish: () => void }> = [];
    const detail = new VehicleDetail({
      parent: new THREE.Group(),
      models: { vehicle: () => data, load: async () => model() },
      prepare: (object) =>
        new Promise<void>((resolve) => {
          preparing.push({ object, finish: resolve });
        }),
    });
    detail.setCacheBudget({ concurrentLoads: 1 });
    detail.select([{ ...candidate(0), distance: 30 }], () => true);
    await flush();
    const first = preparing[0] as { object: THREE.Object3D; finish: () => void };
    const order = first.object.userData.admissionOrder as () => number;
    // A frame queue reads the nearest waiting car's distance, live.
    expect(order()).toBe(30);
    detail.select([{ ...candidate(0), distance: 12 }], () => true);
    expect(order()).toBe(12);
    // The car drives off: another type takes the slot while the first model still prepares.
    detail.select([candidate(1)], () => true);
    expect(order()).toBe(Number.POSITIVE_INFINITY);
    await flush();
    expect(preparing).toHaveLength(2);
    first.finish();
    await flush();
    expect(first.object.userData.admissionOrder).toBeUndefined();
    expect(detail.has('car0')).toBe(false);
    // The type comes back, and its finished model shows without another load.
    detail.select([candidate(0)], () => true);
    expect(detail.has('car0')).toBe(true);
    expect(preparing).toHaveLength(2);
    detail.dispose();
  });
  it('hides a gone agent model in the frame it leaves, not at the next select', async () => {
    const parent = new THREE.Group();
    const detail = new VehicleDetail({
      parent,
      models: { vehicle: () => data, load: async () => model() },
    });
    detail.select([candidate(0), candidate(1)], () => true);
    await flush();
    detail.select([candidate(0), candidate(1)], () => true);
    await flush();
    expect(detail.has('car0') && detail.has('car1')).toBe(true);
    detail.dropGone((id) => id !== 'car0');
    expect(detail.has('car0')).toBe(false);
    expect(detail.has('car1')).toBe(true);
    const shown = parent
      .getObjectsByProperty('name', 'ambient:detail')[0]
      ?.children.filter((child) => child.visible);
    expect(shown).toHaveLength(1);
    // The pooled model serves the next car of its type at once.
    expect(detail.cacheStats()).toMatchObject({ active: 1, idle: 1 });
    detail.dispose();
  });
});
