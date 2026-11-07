import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import {
  INSTANCE_BATCH_COLOR,
  INSTANCE_BATCH_MATRIX_COLUMNS,
  InstanceBatch,
  InstanceMatrixAttribute,
  isInstanceBatch,
  isInstanceBatchGeometry,
} from '../src/three/instance-batch';
import { installWebGpuInstanceBatches } from '../src/three/webgpu-instance-batches';
import { installWebGpuRenderObjectRelease } from '../src/three/webgpu-render-object-release';

const material = new THREE.MeshStandardMaterial();

function placed(batch: THREE.InstancedMesh, positions: [number, number, number][]): void {
  const matrix = new THREE.Matrix4();
  positions.forEach((position, index) => {
    batch.setMatrixAt(index, matrix.makeTranslation(...position));
  });
  batch.instanceMatrix.needsUpdate = true;
}

describe('InstanceBatch', () => {
  it('is an InstancedMesh that draws a geometry of its own over the model', () => {
    const model = new THREE.BoxGeometry(1, 1, 1);
    const batch = new InstanceBatch(model, material, 3);
    expect(batch).toBeInstanceOf(THREE.InstancedMesh);
    expect(batch.isInstancedMesh).toBe(true);
    expect(isInstanceBatch(batch)).toBe(true);
    expect(isInstanceBatch(new THREE.InstancedMesh(model, material, 1))).toBe(false);
    const geometry = batch.geometry as THREE.InstancedBufferGeometry;
    expect(geometry).not.toBe(model);
    expect(geometry.isInstancedBufferGeometry).toBe(true);
    expect(isInstanceBatchGeometry(geometry)).toBe(true);
    expect(isInstanceBatchGeometry(model)).toBe(false);
    expect(batch.sourceGeometry).toBe(model);
    // The model's buffers are shared, not copied.
    expect(geometry.getAttribute('position')).toBe(model.getAttribute('position'));
    expect(geometry.index).toBe(model.index);
    expect(geometry.instanceCount).toBe(3);
  });

  it('keeps its matrices in one interleaved buffer read as four columns', () => {
    const batch = new InstanceBatch(new THREE.BoxGeometry(), material, 2);
    placed(batch, [
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(batch.instanceMatrix).toBeInstanceOf(InstanceMatrixAttribute);
    const data = (batch.instanceMatrix as unknown as InstanceMatrixAttribute).data;
    expect(data).toBeInstanceOf(THREE.InstancedInterleavedBuffer);
    for (const [column, name] of INSTANCE_BATCH_MATRIX_COLUMNS.entries()) {
      const attribute = batch.geometry.getAttribute(name) as THREE.InterleavedBufferAttribute;
      expect(attribute.data).toBe(data);
      expect(attribute.offset).toBe(column * 4);
      expect(attribute.itemSize).toBe(4);
    }
    // Translation is the fourth column.
    const translation = batch.geometry.getAttribute('instanceMatrix3');
    expect([translation.getX(1), translation.getY(1), translation.getZ(1)]).toEqual([4, 5, 6]);
    expect(batch.getMatrixAt(0, new THREE.Matrix4()).elements[12]).toBe(1);
    // `needsUpdate` and `version` reach the buffer both backends upload.
    const before = batch.instanceMatrix.version;
    batch.instanceMatrix.needsUpdate = true;
    expect(batch.instanceMatrix.version).toBe(before + 1);
    expect(data.version).toBe(before + 1);
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    expect(data.usage).toBe(THREE.DynamicDrawUsage);
  });

  it('follows count and colors into its geometry', () => {
    const batch = new InstanceBatch(new THREE.BoxGeometry(), material, 4);
    expect(batch.geometry.getAttribute(INSTANCE_BATCH_COLOR)).toBeUndefined();
    batch.setColorAt(1, new THREE.Color(1, 0, 0));
    expect(batch.instanceColor).not.toBeNull();
    expect(batch.geometry.getAttribute(INSTANCE_BATCH_COLOR)).toBe(batch.instanceColor);
    batch.count = 2;
    expect((batch.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(2);
    batch.instanceColor = null;
    expect(batch.geometry.getAttribute(INSTANCE_BATCH_COLOR)).toBeUndefined();
  });

  it('swaps models while keeping its instances, one geometry of its own per model', () => {
    const near = new THREE.BoxGeometry(1, 1, 1);
    const far = new THREE.BoxGeometry(2, 2, 2);
    const batch = new InstanceBatch(near, material, 2);
    batch.setColorAt(0, new THREE.Color('white'));
    const nearOwn = batch.geometry;
    batch.geometry = far;
    const farOwn = batch.geometry;
    expect(farOwn).not.toBe(nearOwn);
    expect(batch.sourceGeometry).toBe(far);
    expect(farOwn.getAttribute('position')).toBe(far.getAttribute('position'));
    expect(farOwn.getAttribute('instanceMatrix0')).toBeDefined();
    expect(farOwn.getAttribute(INSTANCE_BATCH_COLOR)).toBe(batch.instanceColor);
    batch.geometry = near;
    expect(batch.geometry).toBe(nearOwn);
    // Assigning a batch's own geometry selects its model.
    batch.geometry = farOwn;
    expect(batch.geometry).toBe(farOwn);
    expect(batch.batchGeometries()).toEqual([nearOwn, farOwn]);
    batch.count = 1;
    expect((nearOwn as THREE.InstancedBufferGeometry).instanceCount).toBe(1);
    expect((farOwn as THREE.InstancedBufferGeometry).instanceCount).toBe(1);
  });

  it('shares another batch instances, and refuses a foreign matrix attribute', () => {
    const first = new InstanceBatch(new THREE.BoxGeometry(), material, 2);
    placed(first, [
      [1, 0, 0],
      [2, 0, 0],
    ]);
    const level = new InstanceBatch(new THREE.SphereGeometry(), material, 0);
    level.count = first.count;
    level.instanceMatrix = first.instanceMatrix;
    expect(level.geometry.getAttribute('instanceMatrix3')).toBeDefined();
    expect(
      (level.geometry.getAttribute('instanceMatrix3') as THREE.InterleavedBufferAttribute).data,
    ).toBe((first.instanceMatrix as unknown as InstanceMatrixAttribute).data);
    expect(() => {
      level.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(32), 16);
    }).toThrow(/its own or another batch/);
  });

  it('bounds and raycasts per instance, as InstancedMesh does', () => {
    const batch = new InstanceBatch(new THREE.BoxGeometry(1, 1, 1), material, 2);
    placed(batch, [
      [-10, 0, 0],
      [10, 0, 0],
    ]);
    batch.computeBoundingBox();
    expect(batch.boundingBox?.min.x).toBeCloseTo(-10.5);
    expect(batch.boundingBox?.max.x).toBeCloseTo(10.5);
    batch.updateMatrixWorld();
    const hits: THREE.Intersection[] = [];
    new THREE.Raycaster(new THREE.Vector3(10, 5, 0), new THREE.Vector3(0, -1, 0)).intersectObject(
      batch,
      false,
      hits,
    );
    expect(new Set(hits.map((hit) => hit.instanceId))).toEqual(new Set([1]));
  });

  it('copies and clones into batches of their own', () => {
    const batch = new InstanceBatch(new THREE.BoxGeometry(), material, 2);
    placed(batch, [
      [3, 0, 0],
      [4, 0, 0],
    ]);
    batch.setColorAt(0, new THREE.Color('red'));
    const copy = batch.clone();
    expect(isInstanceBatch(copy)).toBe(true);
    expect(copy.sourceGeometry).toBe(batch.sourceGeometry);
    expect(copy.geometry).not.toBe(batch.geometry);
    expect(copy.count).toBe(2);
    expect(copy.getMatrixAt(1, new THREE.Matrix4()).elements[12]).toBe(4);
    expect(copy.instanceMatrix.array).not.toBe(batch.instanceMatrix.array);
    expect(copy.geometry.getAttribute(INSTANCE_BATCH_COLOR)).toBe(copy.instanceColor);
    expect(copy.instanceColor).not.toBe(batch.instanceColor);
  });

  it('frees only its own buffers when disposed, and stays whole', () => {
    const model = new THREE.BoxGeometry();
    const batch = new InstanceBatch(model, material, 1);
    batch.setColorAt(0, new THREE.Color('white'));
    const own = batch.geometry;
    const seen: string[][] = [];
    const indexed: boolean[] = [];
    own.addEventListener('dispose', () => {
      seen.push(Object.keys(own.attributes).sort());
      indexed.push(own.index !== null);
    });
    const modelDisposed = vi.fn();
    model.addEventListener('dispose', modelDisposed);
    const meshDisposed = vi.fn();
    batch.addEventListener('dispose', meshDisposed);
    batch.dispose();
    expect(meshDisposed).toHaveBeenCalledOnce();
    expect(modelDisposed).not.toHaveBeenCalled();
    expect(seen).toEqual([[INSTANCE_BATCH_COLOR, ...INSTANCE_BATCH_MATRIX_COLUMNS].sort()]);
    expect(indexed).toEqual([false]);
    expect(own.getAttribute('position')).toBe(model.getAttribute('position'));
    expect(own.index).toBe(model.index);
  });

  it('refuses instanced and morphing models', () => {
    expect(() => new InstanceBatch(new THREE.InstancedBufferGeometry(), material, 1)).toThrow(
      /plain model geometry/,
    );
    const morphing = new THREE.BoxGeometry();
    morphing.morphAttributes.position = [morphing.getAttribute('position').clone()];
    expect(() => new InstanceBatch(morphing, material, 1)).toThrow(/morph targets/);
  });
});

/** Three's TSL surface the hooks call, recorded as plain values. */
function fakeNodes() {
  const assigned: [string, unknown][] = [];
  const node = (name: string) => ({
    name,
    assign: (value: unknown) => assigned.push([name, value]),
    mul: (value: unknown) => ({ xyz: ['mul', name, value] }),
  });
  class NodeMaterial {
    setupPosition(builder: unknown): unknown {
      return ['base', builder];
    }
  }
  return {
    assigned,
    nodes: {
      NodeMaterial,
      attribute: (name: string, type: string) => `${name}:${type}`,
      mat4: (...columns: unknown[]) => node(`mat4(${columns.join(',')})`),
      positionLocal: node('positionLocal'),
      normalLocal: node('normalLocal'),
      transformNormal: (normal: unknown, matrix: unknown) => ['transformNormal', normal, matrix],
      varyingProperty: (type: string, name: string) => node(`${type} ${name}`),
    },
  };
}

class FakeRenderObject {
  seen: { isInstancedMesh?: boolean; count?: number; geometry?: unknown }[] = [];
  constructor(public object: THREE.Object3D) {}
  getMaterialCacheKey(): number {
    const object = this.object as THREE.InstancedMesh;
    this.seen.push({
      isInstancedMesh: object.isInstancedMesh,
      count: object.count,
      geometry: object.geometry,
    });
    return object.isInstancedMesh || object.count > 1 ? 1 : 0;
  }
}

describe('WebGPU instance batch hooks', () => {
  it('reads a batch transform and colors from its geometry before the material position', () => {
    const { nodes, assigned } = fakeNodes();
    installWebGpuInstanceBatches({} as WebGPURenderer, nodes);
    installWebGpuInstanceBatches({} as WebGPURenderer, nodes);
    const material = new nodes.NodeMaterial();
    const batch = new InstanceBatch(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 1);
    batch.setColorAt(0, new THREE.Color('white'));
    const has = (object: THREE.Mesh) => (name: string) =>
      object.geometry.getAttribute(name) !== undefined;
    const result = material.setupPosition({ object: batch, hasGeometryAttribute: has(batch) });
    expect(result).toEqual(['base', expect.anything()]);
    const columns = INSTANCE_BATCH_MATRIX_COLUMNS.map((name) => `${name}:vec4`).join(',');
    expect(assigned).toEqual([
      ['positionLocal', ['mul', `mat4(${columns})`, nodes.positionLocal]],
      [
        'normalLocal',
        [
          'transformNormal',
          nodes.normalLocal,
          expect.objectContaining({ name: `mat4(${columns})` }),
        ],
      ],
      ['vec3 vInstanceColor', `${INSTANCE_BATCH_COLOR}:vec3`],
    ]);
    // Patched once, and other meshes keep three's setup alone.
    assigned.length = 0;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
    material.setupPosition({ object: mesh, hasGeometryAttribute: has(mesh) });
    expect(assigned).toEqual([]);
  });

  it('keys a batch render object as a plain mesh, and other meshes as three does', () => {
    const { nodes } = fakeNodes();
    const created: FakeRenderObject[] = [];
    const objects = {
      createRenderObject(object: THREE.Object3D): FakeRenderObject {
        const renderObject = new FakeRenderObject(object);
        created.push(renderObject);
        return renderObject;
      },
    };
    const renderer = { _objects: objects } as unknown as WebGPURenderer;
    installWebGpuInstanceBatches(renderer, nodes);
    installWebGpuInstanceBatches(renderer, nodes);
    const batch = new InstanceBatch(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 5);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 5);
    const forBatch = objects.createRenderObject(batch);
    const forMesh = objects.createRenderObject(mesh);
    expect(forBatch.getMaterialCacheKey()).toBe(0);
    expect(forBatch.seen.at(-1)).toEqual({
      isInstancedMesh: false,
      count: 1,
      geometry: batch.geometry,
    });
    expect(forBatch.object).toBe(batch);
    expect(forMesh.getMaterialCacheKey()).toBe(1);
    expect(forMesh.seen.at(-1)?.isInstancedMesh).toBe(true);
    // The batch itself is untouched.
    expect(batch.isInstancedMesh).toBe(true);
    expect(batch.count).toBe(5);
  });

  it('frees only what a disposing batch geometry still holds', () => {
    const initGeometry = vi.fn();
    const geometries = { initGeometry: initGeometry as (renderObject: unknown) => void };
    installWebGpuRenderObjectRelease({
      _objects: { createRenderObject: () => ({}) },
      _geometries: geometries,
    } as unknown as WebGPURenderer);
    const model = new THREE.BoxGeometry();
    const batch = new InstanceBatch(model, new THREE.MeshBasicMaterial(), 1);
    const own = batch.geometry;
    const listed = Object.values(own.attributes);
    geometries.initGeometry({ geometry: own, getAttributes: () => listed });
    const owner = initGeometry.mock.calls[0]?.[0] as { getAttributes(): unknown[] };
    expect(owner.getAttributes()).toEqual(listed);
    let duringDispose: unknown[] = [];
    own.addEventListener('dispose', () => {
      duringDispose = owner.getAttributes();
    });
    batch.dispose();
    expect(duringDispose).toEqual(
      INSTANCE_BATCH_MATRIX_COLUMNS.map((name) => own.getAttribute(name)),
    );
    expect(duringDispose).not.toContain(model.getAttribute('position'));
  });
});
