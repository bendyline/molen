import type { LiveryData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { AssetCache } from '../src/assets';
import { applyLivery, liveryGraphicTexture } from '../src/livery';
import { SceneMirror } from '../src/sync';
import { ThreeSceneBackend } from '../src/three/backend';

const graphic = {
  label: 'bar',
  shapes: [
    {
      color: '#eeeadd',
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as [number, number][],
    },
  ],
};
const data: LiveryData = {
  selected: 'red',
  slots: { body: { materials: ['paint'] } },
  anchors: {
    side: {
      slot: 'body',
      position: [1, 0.5, 0.5],
      size: [0.5, 0.5, 0.1],
      rotation: [0, Math.PI / 2, 0],
    },
  },
  variants: [
    {
      id: 'red',
      label: 'Red',
      paints: { body: { color: '#bb4433' } },
      markings: [{ anchor: 'side', graphic }],
      provenance: { kind: 'original', note: 'Test', references: [] },
    },
    {
      id: 'camo',
      label: 'Camo',
      paints: {
        body: {
          color: '#ffffff',
          camouflage: { colors: ['#556644', '#aa9977'], scale: 1, seed: 19 },
        },
      },
      provenance: { kind: 'original', note: 'Test', references: [] },
    },
    {
      id: 'authored',
      label: 'Authored',
      paints: {},
      provenance: { kind: 'original', note: 'Test', references: [] },
    },
  ],
};
function fixture() {
  const root = new THREE.Group(),
    door = new THREE.Group();
  door.name = 'door';
  const material = new THREE.MeshStandardMaterial({ color: '#909090' });
  material.name = 'paint';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  mesh.name = 'body';
  door.add(mesh);
  root.add(door);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#556677' }),
  );
  glass.position.y = 2;
  root.add(glass);
  return { root, door, mesh, glass, material };
}
it('isolates paint and decals, excludes glass, follows moving parts and restores resources', () => {
  const { root, door, mesh, glass, material } = fixture();
  const sibling = root.clone(true),
    originalGeometry = mesh.geometry;
  const appearance = applyLivery(root, data);
  expect(appearance.warnings).toEqual([]);
  expect(mesh.material).not.toBe(material);
  expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('bb4433');
  expect((sibling.getObjectByName('body') as THREE.Mesh).material).toBe(material);
  expect(glass.children).toHaveLength(0);
  const decal = mesh.children[0] as THREE.Mesh;
  const local = Array.from(decal.geometry.getAttribute('position').array);
  const texture = (decal.material as THREE.MeshStandardMaterial).map as THREE.DataTexture;
  const dispose = vi.spyOn(texture, 'dispose'),
    geometryDispose = vi.spyOn(decal.geometry, 'dispose');
  door.rotation.y = 1;
  appearance.dispose();
  appearance.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(geometryDispose).toHaveBeenCalledTimes(1);
  expect(mesh.material).toBe(material);
  expect(mesh.geometry).toBe(originalGeometry);
  expect(mesh.children).toHaveLength(0);
  const next = applyLivery(root, data);
  expect(
    Array.from((mesh.children[0] as THREE.Mesh).geometry.getAttribute('position').array),
  ).toEqual(local);
  next.dispose();
});
it('projects camouflage on a private UV channel, preserves source UVs and is reproducible', () => {
  const { root, mesh } = fixture(),
    original = mesh.geometry;
  const a = applyLivery(root, { ...data, selected: 'camo' });
  expect(mesh.geometry).not.toBe(original);
  expect(mesh.geometry.getAttribute('uv3')).toBeDefined();
  const tex = (mesh.material as THREE.MeshStandardMaterial).map as THREE.DataTexture;
  expect(tex.channel).toBe(3);
  const bytes = Array.from(tex.image.data);
  a.dispose();
  expect(mesh.geometry).toBe(original);
  const b = applyLivery(root, { ...data, selected: 'camo' });
  expect(
    Array.from(((mesh.material as THREE.MeshStandardMaterial).map as THREE.DataTexture).image.data),
  ).toEqual(bytes);
  b.dispose();
  expect(liveryGraphicTexture(graphic).image.data.slice(0, 4)).toEqual(
    new Uint8Array([238, 234, 221, 255]),
  );
});
it('reports stale material/anchor bindings rather than silently accepting a model revision', () => {
  const { root } = fixture();
  const visual = applyLivery(root, { ...data, slots: { body: { materials: ['renamed-paint'] } } });
  expect(visual.warnings.join(' ')).toContain('no matching surface');
  visual.dispose();
});

it('preserves vertex trim masks when the body and tires share a paint material', () => {
  const { root, mesh, material } = fixture();
  const colors = new Float32Array(mesh.geometry.getAttribute('position').count * 3).fill(0.04);
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  material.vertexColors = true;
  const visual = applyLivery(root, data);
  expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  expect(mesh.geometry.getAttribute('color').array).toBe(colors);
  visual.dispose();
});

it('chooses a free camouflage UV channel without disturbing a model normal map', () => {
  const { root, mesh, material } = fixture();
  material.normalMap = new THREE.Texture();
  material.normalMap.channel = 3;
  mesh.geometry.setAttribute('uv3', mesh.geometry.getAttribute('uv').clone());
  const original = mesh.geometry.toNonIndexed();
  const visual = applyLivery(root, { ...data, selected: 'camo' });
  expect((mesh.material as THREE.MeshStandardMaterial).map?.channel).toBe(2);
  expect((mesh.material as THREE.MeshStandardMaterial).normalMap).toBe(material.normalMap);
  expect(mesh.geometry.getAttribute('uv3').array).toEqual(original.getAttribute('uv3').array);
  visual.dispose();
  original.dispose();
  material.normalMap.dispose();
});

it('projects onto inward-wound two-sided shells without painting the opposite wall', () => {
  const { root, mesh, material } = fixture();
  const geometry = mesh.geometry.toNonIndexed();
  const normals = geometry.getAttribute('normal');
  for (let i = 0; i < normals.count; i++)
    normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
  mesh.geometry = geometry;
  material.side = THREE.DoubleSide;
  const visual = applyLivery(root, data);
  expect(visual.warnings).toEqual([]);
  const decal = mesh.children[0] as THREE.Mesh;
  const p = decal.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) expect(p.getX(i)).toBeCloseTo(1);
  visual.dispose();
});
it('reconciles latest selection during loading, changes without a reload and restores on removal', async () => {
  const { root } = fixture();
  let finish: (gltf: unknown) => void = () => {};
  const load = vi.fn(async () => new ArrayBuffer(1));
  const cache = new AssetCache({ load, loadText: async () => '' }, {
    parse: (_b: ArrayBuffer, _p: string, done: (gltf: unknown) => void) => {
      finish = done;
    },
  } as never);
  const scene = new THREE.Scene(),
    backend = new ThreeSceneBackend(scene, cache),
    sync = new SceneMirror();
  sync.applyKeyframe({
    format: 'molen/keyframe@1',
    tick: 0,
    entities: { a: { renderable: { kind: 'gltf', ref: 'car' }, livery: data } },
  } as never);
  sync.reconcile(backend);
  await Promise.resolve();
  backend.setLivery('a', { ...data, selected: 'camo' });
  finish({ scene: root, animations: [] });
  await cache.whenIdle();
  const mesh = scene.getObjectByName('body') as THREE.Mesh;
  expect((mesh.material as THREE.MeshStandardMaterial).map).not.toBeNull();
  backend.setLivery('a', { ...data, selected: 'red' });
  expect(mesh.children).toHaveLength(1);
  expect(load).toHaveBeenCalledTimes(1);
  backend.setLivery('a', undefined);
  expect(mesh.children).toHaveLength(0);
  expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('909090');
  backend.destroy('a');
  cache.dispose();
});
