import type { LiveryData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { AssetCache } from '../src/assets';
import { applyLivery, liveryGraphicTexture } from '../src/livery';
import { WalkCollision } from '../src/navigation/walk-collision';
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
it('keeps named paint slots on panels moved into separate animation hinges', () => {
  const { root, mesh, material } = fixture();
  const hinge = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  panel.userData.liverySourceNodes = ['body'];
  hinge.add(panel);
  root.add(hinge);
  const appearance = applyLivery(root, {
    ...data,
    slots: { body: { materials: ['paint'], node: 'body' } },
  });
  expect(appearance.warnings).toEqual([]);
  expect((panel.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('bb4433');
  expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('bb4433');
  appearance.dispose();
  expect(panel.material).toBe(material);
});

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
it('stands markings 2 mm off the skin, where no depth mode can tie them with it', () => {
  // Under a logarithmic depth buffer polygon offset does nothing, and a marking flush with the skin
  // fought it in speckles; it stands off along the surface normals instead.
  const { root, mesh } = fixture();
  const appearance = applyLivery(root, data);
  const position = (mesh.children[0] as THREE.Mesh).geometry.getAttribute('position');
  expect(position.count).toBeGreaterThan(0);
  for (let i = 0; i < position.count; i++) expect(position.getX(i)).toBeCloseTo(1.002, 6);
  appearance.dispose();
});

it('keeps markings out of collision, so a vehicle never strikes its own paint', () => {
  const { root, mesh } = fixture();
  // Hosts flag a model's meshes as vehicle geometry before they apply its livery.
  root.traverse((object) => {
    object.userData.vehicleGeometry = true;
  });
  const appearance = applyLivery(root, data);
  expect(mesh.children[0]?.name).toBe('livery:markings');
  const sideways = new THREE.Ray(new THREE.Vector3(3, 0, 0), new THREE.Vector3(-1, 0, 0));
  // An aircraft's or car's own obstacle scan skips vehicles: nothing of this one may remain.
  const own = new WalkCollision({ ignoreVehicles: true });
  own.update(root, 0, 0);
  expect(own.octree.rayIntersect(sideways)).toBeFalsy();
  // A walker still meets the hull under the paint.
  const walker = new WalkCollision();
  walker.update(root, 0, 0);
  expect(walker.octree.rayIntersect(sideways)?.distance).toBeCloseTo(2, 5);
  appearance.dispose();
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

it('rasterizes holes even-odd and anti-aliases shape edges', () => {
  const ring = (a: number, b: number): [number, number][] => [
    [a, a],
    [b, a],
    [b, b],
    [a, b],
  ];
  const texture = liveryGraphicTexture(
    { shapes: [{ color: '#ff0000', points: ring(0.1, 0.9), holes: [ring(0.4, 0.6)] }] },
    64,
  );
  const alpha = (x: number, y: number): number =>
    texture.image.data[(y * 64 + x) * 4 + 3] as number;
  expect(alpha(16, 16)).toBe(255);
  expect(alpha(32, 32)).toBe(0); // inside the hole
  // 0.1 * 64 = 6.4: the edge column is 60% covered, not all or nothing.
  expect(alpha(6, 32)).toBeGreaterThan(120);
  expect(alpha(6, 32)).toBeLessThan(170);
  texture.dispose();
});

it('paints zones over a slot with exact plane splits and restores the authored geometry', () => {
  const { root, mesh, material } = fixture();
  const original = mesh.geometry;
  const zoned: LiveryData = {
    ...data,
    selected: 'two-tone',
    variants: [
      {
        id: 'two-tone',
        label: 'Two tone',
        // The lower 40% of the box gray, a 10% stripe above it blue.
        paints: {
          body: {
            color: '#eeeeee',
            zones: [
              { color: '#777777', planes: [{ normal: [0, -1, 0], offset: -0.4 }] },
              {
                color: '#2244aa',
                planes: [
                  { normal: [0, 1, 0], offset: 0.4 },
                  { normal: [0, -1, 0], offset: -0.5 },
                ],
              },
            ],
          },
        },
        provenance: { kind: 'original', note: 'Test', references: [] },
      },
    ],
  };
  const visual = applyLivery(root, zoned);
  expect(visual.warnings).toEqual([]);
  const materials = mesh.material as THREE.MeshStandardMaterial[];
  expect(materials.map((m) => m.color.getHexString()).sort()).toEqual([
    '2244aa',
    '777777',
    'eeeeee',
  ]);
  const p = mesh.geometry.getAttribute('position');
  for (const group of mesh.geometry.groups) {
    const ys: number[] = [];
    for (let i = group.start; i < group.start + group.count; i++) ys.push(p.getY(i));
    // Box spans y -1..1: gray below -0.2, blue in -0.2..0, white above 0.
    const [lo, hi] = [Math.min(...ys), Math.max(...ys)];
    const color = materials[group.materialIndex ?? 0]?.color.getHexString();
    if (color === '777777') expect(hi).toBeLessThanOrEqual(-0.2 + 1e-6);
    if (color === '2244aa')
      expect([lo, hi]).toEqual([expect.closeTo(-0.2, 5), expect.closeTo(0, 5)]);
    if (color === 'eeeeee') expect(lo).toBeGreaterThanOrEqual(-1e-6);
  }
  visual.dispose();
  expect(mesh.geometry).toBe(original);
  expect(mesh.material).toBe(material);
});

it('shares one marking atlas among instances, flips shared art and frees it with the last user', () => {
  const shared: LiveryData = {
    ...data,
    graphics: { bar: graphic },
    variants: [
      {
        ...(data.variants[0] as LiveryData['variants'][number]),
        markings: [
          { anchor: 'side', graphic: 'bar' },
          { anchor: 'side', graphic: 'bar', flip: true },
        ],
      },
    ],
  };
  const a = fixture(),
    b = fixture();
  const first = applyLivery(a.root, shared),
    second = applyLivery(b.root, shared);
  expect(first.warnings).toEqual([]);
  // Both markings on one mesh merge into one decal draw.
  expect(a.mesh.children).toHaveLength(1);
  const material = (a.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  expect((b.mesh.children[0] as THREE.Mesh).material).toBe(material);
  const uv = (a.mesh.children[0] as THREE.Mesh).geometry.getAttribute('uv');
  const half = uv.count / 2;
  // The flipped copy mirrors u within the same atlas rectangle: u + u' is the same everywhere.
  const sum = uv.getX(0) + uv.getX(half);
  for (let i = 0; i < half; i++) expect(uv.getX(i) + uv.getX(i + half)).toBeCloseTo(sum, 6);
  for (let i = 0; i < half; i++) expect(uv.getY(i)).toBeCloseTo(uv.getY(i + half), 6);
  const dispose = vi.spyOn(material.map as THREE.Texture, 'dispose');
  first.dispose();
  expect(dispose).not.toHaveBeenCalled();
  second.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('draws every camouflage style deterministically with each color represented', () => {
  for (const style of ['blotch', 'splinter', 'digital'] as const) {
    const { root, mesh } = fixture();
    const recipe: LiveryData = {
      ...data,
      selected: 'camo',
      variants: [
        {
          id: 'camo',
          label: 'Camo',
          paints: {
            body: {
              color: '#ffffff',
              camouflage: { colors: ['#556644', '#aa9977', '#332211'], scale: 1, seed: 7, style },
            },
          },
          provenance: { kind: 'original', note: 'Test', references: [] },
        },
      ],
    };
    const visual = applyLivery(root, recipe);
    const bytes = ((mesh.material as THREE.MeshStandardMaterial).map as THREE.DataTexture).image
      .data as Uint8Array;
    const seen = new Set<string>();
    for (let i = 0; i < bytes.length; i += 4)
      seen.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]}`);
    expect(seen.size, style).toBe(3);
    visual.dispose();
  }
});
