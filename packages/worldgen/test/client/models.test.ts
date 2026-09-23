import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { createInstancedPlacements, unitBoxGeometry } from '../../src/client/instanced-box';
import { ModelLibrary, mergeSceneGeometry } from '../../src/client/instanced-models';
import { PLACEMENT_STRIDE, type PlacementSet } from '../../src/kernel/types';

const require = createRequire(import.meta.url);
const FIR = '@bendyline/molen-entities/assets/tree/conifer/fir/model.glb';

async function loadGlb(specifier: string): Promise<THREE.Group> {
  const bytes = await readFile(require.resolve(specifier));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  return gltf.scene;
}

describe('model library', () => {
  it('merges an authored glTF model into one vertex-colored geometry', async () => {
    const scene = await loadGlb(FIR);
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
      }
    });
    expect(materials.size).toBeGreaterThanOrEqual(2);
    const merged = mergeSceneGeometry(scene);
    expect(merged).toBeDefined();
    const geometry = merged as THREE.BufferGeometry;
    expect(geometry.index).toBeNull();
    const colors = geometry.getAttribute('color');
    const positions = geometry.getAttribute('position');
    expect(positions.count).toBeGreaterThan(0);
    expect(colors.count).toBe(positions.count);
    const distinct = new Set<string>();
    for (let index = 0; index < colors.count; index++) {
      distinct.add(
        `${colors.getX(index).toFixed(2)},${colors.getY(index).toFixed(2)},${colors.getZ(index).toFixed(2)}`,
      );
    }
    expect(distinct.size).toBeGreaterThanOrEqual(2);
    const bounds = geometry.boundingBox as THREE.Box3;
    expect(bounds.min.y).toBeGreaterThan(-0.05);
    expect(bounds.max.y).toBeGreaterThan(2);
    geometry.dispose();
  });

  it('prepares each reference once, serves builtins, and rejects unknown builtins', async () => {
    let loads = 0;
    const library = new ModelLibrary(async (ref) => {
      loads++;
      expect(ref).toBe('molen.entities.tree.conifer.fir');
      return loadGlb(FIR);
    });
    const [first, second] = await Promise.all([
      library.prepare('molen.entities.tree.conifer.fir'),
      library.prepare('molen.entities.tree.conifer.fir'),
    ]);
    expect(loads).toBe(1);
    expect(first).toBe(second);
    expect(first.builtin).toBe(false);
    expect(library.get('molen.entities.tree.conifer.fir')).toBe(first);
    for (const name of ['box', 'tree.conifer', 'tree.deciduous', 'shrub', 'rock']) {
      const model = await library.prepare(`builtin:${name}`);
      expect(model.builtin).toBe(true);
      expect(model.geometry.getAttribute('color')).toBeDefined();
      expect(model.bounds.max.y).toBeGreaterThan(0);
      expect(model.material).toBe(first.material);
    }
    await expect(library.prepare('builtin:unknown')).rejects.toThrow('unknown builtin model');
    await expect(new ModelLibrary().prepare('molen.entities.tree.conifer.fir')).rejects.toThrow(
      'needs a model loader',
    );
    library.dispose();
    expect(library.get('molen.entities.tree.conifer.fir')).toBeUndefined();
  });

  it('instances a placement set with per-instance transforms and tints', () => {
    const data = new Float32Array(2 * PLACEMENT_STRIDE);
    data.set([10, 1, -5, Math.PI / 2, 2, 3, 2, 0.5, 0.25, 1], 0);
    data.set([-4, 0, 8, 0, 1, 1, 1, 1, 1, 1], PLACEMENT_STRIDE);
    const set: PlacementSet = { setId: 'test', modelRef: 'builtin:box', count: 2, data };
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const mesh = createInstancedPlacements(set, unitBoxGeometry(), material, 'boxes');
    expect(mesh.count).toBe(2);
    expect(mesh.name).toBe('boxes');
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.getMatrixAt(0, matrix);
    matrix.decompose(position, quaternion, scale);
    expect(position.toArray()).toEqual([10, 1, -5]);
    expect(scale.toArray().map((value) => Math.round(value * 1000) / 1000)).toEqual([2, 3, 2]);
    const heading = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    expect(heading.x).toBeCloseTo(0, 6);
    expect(heading.z).toBeCloseTo(-1, 6);
    const color = new THREE.Color();
    mesh.getColorAt(0, color);
    expect(color.r).toBeCloseTo(0.5, 5);
    expect(color.g).toBeCloseTo(0.25, 5);
    expect(color.b).toBeCloseTo(1, 5);
    expect(mesh.boundingSphere).not.toBeNull();
    mesh.dispose();
    material.dispose();
  });
});

describe('procedural vegetation', () => {
  it('shares opaque geometry and material without loading model assets', async () => {
    const library = new ModelLibrary(() => {
      throw new Error('vegetation must not load a GLB');
    });
    for (const species of [
      'tree.conifer.fir',
      'tree.conifer.pine',
      'tree.deciduous.oak',
      'tree.deciduous.birch',
      'shrub',
      'rock',
    ]) {
      const ref = `builtin:${species}`;
      const first = await library.prepare(ref);
      const second = await library.prepare(ref);
      expect(first).toBe(second);
      expect(first.geometry.groups).toHaveLength(0);
      expect(first.geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(450);
      expect(first.material.transparent).toBe(false);
      const positions = first.geometry.getAttribute('position');
      const normals = first.geometry.getAttribute('normal');
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
      expect(first.geometry.boundingSphere?.radius).toBeGreaterThan(0);
    }
    library.dispose();
  });

  it('occludes the conifer trunk throughout the crown from every heading', async () => {
    const library = new ModelLibrary();
    for (const species of ['fir', 'pine']) {
      const model = await library.prepare(`builtin:tree.conifer.${species}`);
      const mesh = new THREE.Mesh(model.geometry, model.material);
      const ray = new THREE.Raycaster();
      // A horizontal ray must hit an outward-facing leaf surface before reaching the trunk.
      // This catches inverted winding, open crowns, and the old separated-disk silhouette.
      for (let heading = 0; heading < 16; heading++) {
        // Offset rays from exact vertex seams to avoid floating-point edge ambiguity.
        const angle = (heading * Math.PI) / 8 + 0.17;
        for (let fraction = 0.3; fraction < 0.91; fraction += 0.1) {
          const y = model.bounds.max.y * fraction;
          ray.set(
            new THREE.Vector3(Math.cos(angle) * 20, y, Math.sin(angle) * 20),
            new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)),
          );
          const hit = ray.intersectObject(mesh)[0];
          expect(hit, `${species} heading ${heading} at ${fraction}`).toBeDefined();
          const colors = model.geometry.getAttribute('color');
          const vertex = hit?.face?.a ?? 0;
          expect(
            colors.getY(vertex),
            JSON.stringify({ species, heading, fraction, point: hit?.point }),
          ).toBeGreaterThan(colors.getX(vertex));
        }
      }
    }
    library.dispose();
  });
});

it('caches reduced vegetation detail separately while sharing the material', async () => {
  const library = new ModelLibrary();
  for (const species of ['tree.conifer.fir', 'tree.deciduous.oak', 'shrub', 'rock']) {
    const ref = `builtin:${species}`;
    const fine = await library.prepare(ref);
    const coarse = await library.prepare(ref, true);
    expect(coarse.geometry).not.toBe(fine.geometry);
    expect(coarse.material).toBe(fine.material);
    expect(coarse.geometry.getAttribute('position').count).toBeLessThan(
      fine.geometry.getAttribute('position').count * 0.6,
    );
    expect(coarse.bounds.max.y).toBeGreaterThan(fine.bounds.max.y * 0.85);
    expect(library.get(ref, true)).toBe(coarse);
    expect(await library.prepare(ref, true)).toBe(coarse);
  }
  library.dispose();
});
