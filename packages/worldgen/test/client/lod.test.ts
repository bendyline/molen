import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createInstancedPlacementLod } from '../../src/client/instanced-lod';
import { ModelLibrary } from '../../src/client/instanced-models';
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
});
