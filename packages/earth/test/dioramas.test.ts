import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { EarthDioramaDirector } from '../src/client/dioramas';

const visuals = vi.hoisted(() => ({ create: vi.fn(), dispose: vi.fn() }));
vi.mock('@bendyline/molen-dioramas/client', async (original) => ({
  ...(await original<typeof import('@bendyline/molen-dioramas/client')>()),
  createDioramaVisual: visuals.create,
}));

describe('geographic diorama placement', () => {
  it('follows refined terrain under the rotated footprint without restarting playback', async () => {
    visuals.create.mockReset();
    const setPosition = vi.fn();
    visuals.create.mockImplementation(() => ({ update: vi.fn(), dispose: vi.fn(), setPosition }));
    const load = vi.fn(async () => ({
      scene: { format: 'molen/scene@3' as const, name: 'test', entities: [] },
      bounds: {
        min: [-10, -8, -5] as [number, number, number],
        max: [10, 5, 5] as [number, number, number],
      },
    }));
    const director = new EarthDioramaDirector(
      {
        placements: [
          {
            id: 'field',
            latitude: 0,
            longitude: 0,
            yaw: Math.PI / 2,
            groundFootprint: [10, 5],
            load,
          },
        ],
      },
      vi.fn(),
    );
    const frame = {
      root: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      position: [0, 30, 0] as [number, number, number],
      dt: 0.1,
      timeMs: 0,
      toWorld: (): [number, number] => [0, 0],
      groundHeight: (x: number): number => 20 + x,
    };
    director.update(frame);
    await vi.waitFor(() => expect(director.status('field')).toBe('playing'));
    expect(setPosition.mock.lastCall?.[0][1]).toBeCloseTo(25.15);
    director.update({ ...frame, groundHeight: (x: number) => 21 + x });
    expect(setPosition.mock.lastCall?.[0][1]).toBeCloseTo(26.15);
    expect(load).toHaveBeenCalledOnce();
    director.dispose();
  });
  it('waits for ground, anchors once, and rebuilds on a terrain re-anchor', async () => {
    visuals.create.mockReset();
    visuals.dispose.mockReset();
    visuals.create.mockImplementation(() => ({ update: vi.fn(), dispose: visuals.dispose }));
    const load = vi.fn(async () => ({
      scene: { format: 'molen/scene@3' as const, name: 'test', entities: [] },
      bounds: {
        min: [-1, -1, -1] as [number, number, number],
        max: [1, 1, 1] as [number, number, number],
      },
    }));
    const director = new EarthDioramaDirector(
      { placements: [{ id: 'field', latitude: 10, longitude: 20, load }] },
      vi.fn(),
    );
    const frame = {
      root: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      position: [10, 12, 20] as [number, number, number],
      dt: 0.1,
      timeMs: 0,
      toWorld: (lat: number, lon: number): [number, number] => [lat, lon],
      groundHeight: (): number | undefined => undefined,
    };
    director.update(frame);
    expect(load).not.toHaveBeenCalled();
    director.update({ ...frame, groundHeight: () => 12 });
    await vi.waitFor(() => expect(director.status('field')).toBe('playing'));
    expect(visuals.create.mock.calls[0]?.[1].position).toEqual([10, 12, 20]);
    const root = new THREE.Group();
    director.update({ ...frame, root, groundHeight: () => 18 });
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(visuals.dispose).toHaveBeenCalledOnce();
    expect(director.list()).toEqual(['field']);
    director.update({ ...frame, root, position: [1000, 12, 20], groundHeight: () => 18 });
    expect(director.status('field')).toBe('idle');
    expect(visuals.dispose).toHaveBeenCalledTimes(2);
    director.update({ ...frame, root, groundHeight: () => 18 });
    await vi.waitFor(() => expect(director.status('field')).toBe('playing'));
    expect(load).toHaveBeenCalledTimes(3);
    director.remove('field');
    expect(director.list()).toEqual([]);
    director.dispose();
  });
});
