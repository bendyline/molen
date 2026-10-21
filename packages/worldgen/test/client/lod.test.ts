import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createInstancedPlacementLod } from '../../src/client/instanced-lod';
import { ModelLibrary, type PreparedModel } from '../../src/client/instanced-models';
import { disposeWorldgenObject } from '../../src/client/upload';
import { PLACEMENT_STRIDE, type PlacementSet } from '../../src/kernel/types';

describe('camera-distance instance LOD', () => {
  it('preserves placement transforms and tint, reduces distant triangles, and survives rebasing', async () => {
    const library = new ModelLibrary();
    const ref = 'builtin:tree.deciduous.oak';
    const fine = await library.prepare(ref);
    const medium = await library.prepare(ref, true);
    const distant = await library.prepare(ref, 'distant');
    expect(distant.geometry.getAttribute('position').count).toBeLessThan(
      fine.geometry.getAttribute('position').count / 10,
    );
    const set: PlacementSet = {
      setId: 'forest',
      modelRef: ref,
      count: 2,
      data: new Float32Array([
        10, 5, 10, 0.7, 1, 2, 1, 0.3, 0.4, 0.5, 1020, 8, 10, 0, 1, 1, 1, 1, 1, 1,
      ]),
    };
    const copy = set.data.slice();
    const root = createInstancedPlacementLod(set, [fine, medium, distant]);
    expect(root.children).toHaveLength(2);
    const lod = root.children[0] as THREE.LOD;
    expect(lod.levels).toHaveLength(3);
    const near = lod.levels[0]?.object as THREE.InstancedMesh;
    const far = lod.levels[2]?.object as THREE.InstancedMesh;
    expect(far.instanceMatrix).toBe(near.instanceMatrix);
    expect(far.instanceColor).toBe(near.instanceColor);
    root.updateMatrixWorld(true);
    const transform = new THREE.Matrix4();
    near.getMatrixAt(0, transform);
    transform.premultiply(near.matrixWorld);
    expect(
      new THREE.Vector3().setFromMatrixPosition(transform).distanceTo(new THREE.Vector3(10, 5, 10)),
    ).toBeLessThan(1e-5);
    expect(set.data).toEqual(copy);
    expect(set.data.length).toBe(2 * PLACEMENT_STRIDE);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10000);
    camera.position.copy(lod.position);
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(near.visible).toBe(true);
    camera.position.x += 2000;
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(near.visible).toBe(false);
    expect(far.visible).toBe(true);
    const farTriangles = (distant.geometry.getAttribute('position').count / 3) * far.count;
    expect(farTriangles).toBe(20);

    // Moving just inside the nominal threshold keeps the far level until the hysteresis band.
    const threshold = lod.levels[2]?.distance as number;
    camera.position.copy(lod.position).add(new THREE.Vector3(threshold * 0.95, 0, 0));
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(far.visible).toBe(true);
    root.position.x -= 9_000_000;
    camera.position.x -= 9_000_000;
    root.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(far.visible).toBe(true);

    // Spatial cells can be independently rejected by the view frustum.
    camera.position.set(-9_000_000, 20, 10);
    camera.lookAt(-9_000_000 + 10, 5, 10);
    camera.far = 200;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    expect(frustum.intersectsObject(near)).toBe(true);
    expect(
      frustum.intersectsObject(
        (root.children[1] as THREE.LOD).levels[0]?.object as THREE.InstancedMesh,
      ),
    ).toBe(false);
    disposeWorldgenObject(root);
    library.dispose();
  });

  it('keeps every placement in one batch with an infinite cell size', async () => {
    const library = new ModelLibrary();
    const ref = 'builtin:tree.deciduous.oak';
    const models = [
      await library.prepare(ref),
      await library.prepare(ref, true),
      await library.prepare(ref, 'distant'),
    ] as const;
    // Placements on both sides of the origin and far apart would otherwise span several cells.
    const set: PlacementSet = {
      setId: 'forest',
      modelRef: ref,
      count: 3,
      data: new Float32Array([
        -3, 0, -2, 0, 1, 1, 1, 1, 1, 1, 1020, 0, 10, 0, 1, 1, 1, 1, 1, 1, 400, 0, 2000, 0, 1, 1, 1,
        1, 1, 1,
      ]),
    };
    const root = createInstancedPlacementLod(set, models, { cellSize: Number.POSITIVE_INFINITY });
    expect(root.children).toHaveLength(1);
    expect(((root.children[0] as THREE.LOD).levels[0]?.object as THREE.InstancedMesh).count).toBe(
      3,
    );
    expect(() => createInstancedPlacementLod(set, models, { cellSize: Number.NaN })).toThrow();
    expect(() => createInstancedPlacementLod(set, models, { cellSize: 0 })).toThrow();
    disposeWorldgenObject(root);
    library.dispose();
  });

  it('switches one instanced mesh between shared level geometries, by the view camera only', async () => {
    const library = new ModelLibrary();
    const ref = 'builtin:tree.deciduous.oak';
    const models = [
      await library.prepare(ref),
      await library.prepare(ref, true),
      await library.prepare(ref, 'distant'),
    ] as const;
    const set: PlacementSet = {
      setId: 'forest',
      modelRef: ref,
      count: 2,
      data: new Float32Array([10, 5, 10, 0, 1, 1, 1, 1, 1, 1, 30, 5, 10, 0, 1, 1, 1, 1, 1, 1]),
    };
    const policy = { viewportHeight: 900, maxPixelError: 2 };
    const root = createInstancedPlacementLod(set, models, {
      cellSize: Number.POSITIVE_INFINITY,
      screenSpace: policy,
    });
    const lod = root.children[0] as THREE.LOD;
    // One mesh, so WebGPU builds one node program for the set instead of one per level.
    const meshes: THREE.InstancedMesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o as THREE.InstancedMesh);
    });
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0] as THREE.InstancedMesh;
    mesh.castShadow = true;
    root.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100_000);
    camera.position.copy(lod.position).add(new THREE.Vector3(0, 10, 0));
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(mesh.geometry).toBe(models[0].geometry);
    expect(lod.getCurrentLevel()).toBe(0);
    camera.position.x += 50_000;
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(mesh.geometry).toBe(models[2].geometry);
    expect(mesh.castShadow).toBe(false);
    // A shadow pass's orthographic camera does not reselect while the view camera is active.
    const shadow = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    shadow.position.copy(lod.position);
    shadow.updateMatrixWorld();
    lod.update(shadow);
    expect(mesh.geometry).toBe(models[2].geometry);
    camera.position.copy(lod.position);
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(mesh.geometry).toBe(models[0].geometry);
    expect(mesh.castShadow).toBe(true);
    disposeWorldgenObject(root);
    library.dispose();
  });

  it('measures detail distance to a wide batch from its bounds, not its bounding sphere', async () => {
    const library = new ModelLibrary();
    const ref = 'builtin:tree.deciduous.oak';
    const models = [
      await library.prepare(ref),
      await library.prepare(ref, true),
      await library.prepare(ref, 'distant'),
    ] as const;
    // Two trees 1.2 km apart: the batch's sphere reaches about 600 m above the ground.
    const set: PlacementSet = {
      setId: 'forest',
      modelRef: ref,
      count: 2,
      data: new Float32Array([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1200, 0, 0, 0, 1, 1, 1, 1, 1, 1]),
    };
    const root = createInstancedPlacementLod(set, models, {
      cellSize: Number.POSITIVE_INFINITY,
      screenSpace: { viewportHeight: 900, maxPixelError: 2 },
    });
    const lod = root.children[0] as THREE.LOD;
    root.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100_000);
    // Standing among the trees keeps near detail across the whole batch.
    camera.position.copy(lod.position).add(new THREE.Vector3(0, 2, 0));
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(lod.getCurrentLevel()).toBe(0);
    // 400 m overhead is inside the sphere but far above every tree.
    camera.position.copy(lod.position).add(new THREE.Vector3(0, 400, 0));
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(lod.getCurrentLevel()).toBe(1);
    disposeWorldgenObject(root);
    library.dispose();
  });

  it('bounds a spread set to a grid of batches', () => {
    const material = new THREE.MeshStandardMaterial();
    const model: PreparedModel = {
      ref: 'plant',
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material,
      bounds: new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1)),
      builtin: false,
    };
    // Sixteen plants spread over 1.5 km, far past a two-by-two grid of 100 m cells.
    const data = new Float32Array(16 * PLACEMENT_STRIDE);
    for (let i = 0; i < 16; i++)
      data.set(
        [(i % 4) * 500, 0, Math.floor(i / 4) * 500, 0, 1, 1, 1, 1, 1, 1],
        i * PLACEMENT_STRIDE,
      );
    const set: PlacementSet = { setId: 'plants', modelRef: 'plant', count: 16, data };
    const root = createInstancedPlacementLod(set, [model, model, model], {
      cellSize: 100,
      cellGrid: { cellsPerAxis: 2 },
      screenSpace: { viewportHeight: 900, maxPixelError: 2 },
    });
    expect(root.children).toHaveLength(4);
    material.dispose();
  });

  it('draws a level without leaf cards with an opaque twin of an alpha-tested material', () => {
    const material = new THREE.MeshStandardMaterial({ alphaTest: 0.5, alphaToCoverage: true });
    const model = (u: number, size: number): PreparedModel => {
      const geometry = new THREE.BoxGeometry(size, size, size);
      const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, i === 0 ? u : 0.97, 0.5);
      return {
        ref: 'plant',
        geometry,
        material,
        bounds: new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)),
        builtin: false,
      };
    };
    // Near and medium carry a card (a vertex left of the atlas's solid block); far does not.
    const models = [model(0.2, 2), model(0.2, 1.5), model(0.97, 1)] as const;
    const set: PlacementSet = {
      setId: 'forest',
      modelRef: 'plant',
      count: 1,
      data: new Float32Array([0, 0, 0, 0, 1, 1, 1, 1, 1, 1]),
    };
    const root = createInstancedPlacementLod(set, models, {
      cellSize: Number.POSITIVE_INFINITY,
      screenSpace: { viewportHeight: 900, maxPixelError: 2 },
    });
    const lod = root.children[0] as THREE.LOD;
    const mesh = lod.children[0] as THREE.InstancedMesh;
    root.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100_000);
    camera.position.set(0, 2, 10);
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(lod.getCurrentLevel()).toBe(0);
    expect(mesh.material).toBe(material);
    camera.position.set(0, 2, 20_000);
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(lod.getCurrentLevel()).toBe(2);
    const opaque = mesh.material as THREE.MeshStandardMaterial;
    expect(opaque).not.toBe(material);
    expect(opaque.alphaTest).toBe(0);
    expect(opaque.alphaToCoverage).toBe(false);
    // Coming back restores the card material.
    camera.position.set(0, 2, 10);
    camera.updateMatrixWorld();
    lod.update(camera);
    expect(mesh.material).toBe(material);
    disposeWorldgenObject(root);
    material.dispose();
  });
});
