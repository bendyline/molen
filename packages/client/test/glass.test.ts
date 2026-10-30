import type { GlassData, GlassStateData, GlassSurfaceState } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AssetCache, type AssetProvider } from '../src/assets';
import { createGlassVisual } from '../src/glass';
import { ThreeSceneBackend } from '../src/three/backend';

const data: GlassData = {
  surfaces: [
    {
      id: 'front',
      material: 'laminated',
      center: [0, 1, 1],
      rotation: [0, 0, 0, 1],
      size: [1.4, 0.7],
      thickness: 0.005,
      nodes: ['windshield'],
    },
  ],
};
const shattered: GlassSurfaceState = {
  fracture: 'shattered',
  retained: true,
  damage: 1,
  retentionDamage: 0,
  peakStress: 1e8,
  point: [0, 0],
};
const state = (surface = shattered): GlassStateData => ({ surfaces: { front: surface } });
const released = (): GlassSurfaceState => ({
  ...shattered,
  retained: false,
  release: {
    time: 2,
    position: [10, 2, 5],
    rotation: [0, 0, 0, 1],
    velocity: [1, 2, 3],
    fragmentSpeed: 1,
  },
});
function model(): { root: THREE.Group; window: THREE.Mesh; body: THREE.Mesh } {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const window = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), material);
  window.name = 'windshield';
  window.position.set(0, 1, 1);
  const body = new THREE.Mesh(new THREE.BoxGeometry(), material);
  root.add(window, body);
  return { root, window, body };
}

describe('glass visual ownership and lifetime', () => {
  it('applies damage received before a GLB loads, without damaging another cached instance', async () => {
    const base = model();
    const provider: AssetProvider = {
      load: async () => new ArrayBuffer(1),
      loadText: async () => '',
    };
    const loader = {
      parse: (
        _bytes: ArrayBuffer,
        _path: string,
        onLoad: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void,
      ) => onLoad({ scene: base.root, animations: [] }),
    };
    const cache = new AssetCache(provider, loader as never);
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene, cache);
    backend.create('broken', { kind: 'gltf', ref: 'car' });
    backend.create('intact', { kind: 'gltf', ref: 'car' });
    backend.setGlass('broken', data, state(released()));
    backend.setGlass('intact', data, undefined);
    backend.setAnimationTick(180, 60);
    await cache.whenIdle();
    await backend.whenReady();
    expect(scene.getObjectByName('broken')?.getObjectByName('windshield')?.visible).toBe(false);
    expect(scene.getObjectByName('intact')?.getObjectByName('windshield')?.visible).toBe(true);
    expect(base.window.visible).toBe(true);
    backend.dispose();
    cache.dispose();
  });

  it('keeps a shattered laminate in place, draws cracks, and restores an intact pane on repair', () => {
    const { root, window, body } = model();
    const visual = createGlassVisual(root, data);
    visual.update(state(), 1);
    expect(window.visible).toBe(true);
    expect(body.visible).toBe(true);
    expect(root.getObjectByName('glass-cracks:front')?.visible).toBe(true);
    visual.update(undefined, 2);
    expect(window.visible).toBe(true);
    expect(root.getObjectByName('glass-cracks:front')?.visible).toBe(false);
    visual.dispose();
    expect(root.children).toHaveLength(2);
  });

  it('moves a released laminate as a sheet independently of its owner and honors shifted parents', () => {
    const { root, window } = model();
    const parent = new THREE.Group();
    parent.position.set(-1000, 20, 400);
    parent.rotation.y = 0.4;
    parent.add(root);
    root.position.set(10, 0, 4);
    const visual = createGlassVisual(root, data);
    visual.update(state(released()), 2.5);
    root.position.set(50, 0, 30);
    root.rotation.y = 1;
    visual.update(state(released()), 2.5);
    parent.updateMatrixWorld(true);
    const expected = parent.localToWorld(new THREE.Vector3(10.5, 2 + 1 - 0.5 * 9.81 * 0.25, 6.5));
    expect(
      root
        .getObjectByName('glass:front')
        ?.getWorldPosition(new THREE.Vector3())
        .distanceTo(expected),
    ).toBeLessThan(1e-8);
    expect(window.visible).toBe(false);
    expect(root.getObjectByName('glass-sheet:front')?.visible).toBe(true);
    visual.update(state(released()), 11);
    expect(root.getObjectByName('glass:front')?.visible).toBe(false);
    visual.dispose();
    expect(window.visible).toBe(true);
  });

  it('reproduces bounded small tempered fragments after seeking, without altering shared meshes', () => {
    const { root, window } = model();
    const original = Array.from(window.geometry.getAttribute('position').array);
    const geometryDispose = vi.spyOn(window.geometry, 'dispose');
    const materialDispose = vi.spyOn(window.material as THREE.Material, 'dispose');
    const visual = createGlassVisual(root, {
      surfaces: data.surfaces.map((s) => ({ ...s, material: 'tempered' })),
    });
    const broken = state(released());
    visual.update(broken, 3);
    const debris = root.getObjectByName('glass-pane:front') as THREE.Mesh;
    const first = Array.from(debris.geometry.getAttribute('position').array);
    expect(first.length).toBeLessThanOrEqual(12 * 8 * 6 * 3);
    expect(window.visible).toBe(false);
    expect(root.getObjectByName('glass-sheet:front')?.visible).toBe(false);
    visual.update(broken, 4);
    expect(Array.from(debris.geometry.getAttribute('position').array)).not.toEqual(first);
    visual.update(broken, 3);
    expect(Array.from(debris.geometry.getAttribute('position').array)).toEqual(first);
    expect(Array.from(window.geometry.getAttribute('position').array)).toEqual(original);
    visual.dispose();
    visual.dispose();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
  });

  it('binds standalone glass in the scene backend, updates releases on transform, and removes resources', () => {
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene);
    backend.create('glass', { kind: 'glass', ref: 'glass' });
    const procedural: GlassData = { surfaces: data.surfaces.map(({ nodes: _nodes, ...s }) => s) };
    backend.setGlass('glass', procedural, state(released()));
    backend.setAnimationTick(150, 60);
    backend.setTransform('glass', { pos: [50, 0, 30], rot: [0, 0, 0, 1] });
    scene.updateMatrixWorld(true);
    expect(
      backend
        .getObject('glass')
        ?.getObjectByName('glass:front')
        ?.getWorldPosition(new THREE.Vector3()).x,
    ).toBeCloseTo(10.5);
    backend.setGlass('glass', undefined, undefined);
    expect(backend.getObject('glass')?.children).toHaveLength(0);
    backend.destroy('glass');
    expect(scene.children).toHaveLength(0);
    backend.dispose();
  });
});
