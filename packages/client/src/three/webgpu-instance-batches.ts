import type { Object3D } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import {
  INSTANCE_BATCH_COLOR,
  INSTANCE_BATCH_MATRIX_COLUMNS,
  isInstanceBatch,
} from './instance-batch';

/** TSL values the hooks need; only the lazy WebGPU driver may import `three/tsl`. */
export interface InstanceBatchNodes {
  NodeMaterial: { prototype: object };
  attribute(name: string, type: string): unknown;
  mat4(...columns: unknown[]): unknown;
  positionLocal: unknown;
  normalLocal: unknown;
  transformNormal(normal: unknown, matrix: unknown): unknown;
  varyingProperty(type: string, name: string): unknown;
}

// Three r184–r186 internals: NodeMaterial's position setup, and the renderer's render objects.
interface NodeBuilderLike {
  object: Object3D | null;
  hasGeometryAttribute(name: string): boolean;
}
interface NodeMaterialInternals {
  setupPosition(this: NodeMaterialInternals, builder: NodeBuilderLike): unknown;
}
interface TslNode {
  assign(value: unknown): unknown;
  mul(value: unknown): TslNode & { xyz: unknown };
}
interface RenderObjectInternals {
  object: Object3D;
  getMaterialCacheKey(this: RenderObjectInternals): number;
}
interface RenderObjects {
  createRenderObject(...args: unknown[]): RenderObjectInternals;
}

const patchedMaterials = new WeakSet<object>();
const patchedRenderObjects = new WeakSet<object>();
const patchedFactories = new WeakSet<object>();
const keyViews = new WeakMap<Object3D, Object3D>();

/**
 * Draw `InstanceBatch`es with one node build per material and model layout (see `InstanceBatch`).
 *
 * - Position setup reads a batch's instance matrix (and color) from its geometry by attribute name,
 *   as three's instanced mesh node does from the mesh's own buffer. Every node material and the
 *   shadow pass's material run it, so a batch casts its instances' shadows.
 * - A render object's cache key names its mesh when that mesh is instanced (r184–r186 append its
 *   `uuid`), because three's instance node is bound to the mesh. A batch's instances are vertex
 *   buffers each render object binds for itself, so its key is computed as a plain mesh's.
 *
 * Three's render objects are reached through the first one the renderer creates; a batch drawn
 * before that keeps a key of its own, which is correct, only not shared.
 */
export function installWebGpuInstanceBatches(
  renderer: WebGPURenderer,
  nodes: InstanceBatchNodes,
): void {
  installPositionSetup(nodes);
  const objects = (renderer as unknown as { _objects?: RenderObjects | null })._objects;
  if (objects == null || patchedFactories.has(objects)) return;
  patchedFactories.add(objects);
  const create = objects.createRenderObject;
  objects.createRenderObject = (...args) => {
    const renderObject = create.apply(objects, args);
    installCacheKey(Object.getPrototypeOf(renderObject) as RenderObjectInternals);
    return renderObject;
  };
}

function installPositionSetup(nodes: InstanceBatchNodes): void {
  const prototype = nodes.NodeMaterial.prototype as Partial<NodeMaterialInternals>;
  const setupPosition = prototype.setupPosition;
  if (typeof setupPosition !== 'function' || patchedMaterials.has(prototype)) return;
  patchedMaterials.add(prototype);
  const { attribute, mat4, transformNormal, varyingProperty } = nodes;
  const positionLocal = nodes.positionLocal as TslNode;
  const normalLocal = nodes.normalLocal as TslNode;
  prototype.setupPosition = function (builder) {
    // Before the material's own position work, as three places its instance node.
    if (isInstanceBatch(builder.object)) {
      const matrix = mat4(
        ...INSTANCE_BATCH_MATRIX_COLUMNS.map((name) => attribute(name, 'vec4')),
      ) as TslNode;
      positionLocal.assign(matrix.mul(positionLocal).xyz);
      if (builder.hasGeometryAttribute('normal'))
        normalLocal.assign(transformNormal(normalLocal, matrix));
      // Three's diffuse color multiplies by this varying for a mesh with `instanceColor`.
      if (builder.hasGeometryAttribute(INSTANCE_BATCH_COLOR))
        (varyingProperty('vec3', 'vInstanceColor') as TslNode).assign(
          attribute(INSTANCE_BATCH_COLOR, 'vec3'),
        );
    }
    return setupPosition.call(this, builder);
  };
}

function installCacheKey(prototype: RenderObjectInternals): void {
  if (patchedRenderObjects.has(prototype)) return;
  patchedRenderObjects.add(prototype);
  const getMaterialCacheKey = prototype.getMaterialCacheKey;
  if (typeof getMaterialCacheKey !== 'function') return;
  prototype.getMaterialCacheKey = function () {
    const object = this.object;
    if (!isInstanceBatch(object)) return getMaterialCacheKey.call(this);
    this.object = keyView(object);
    try {
      return getMaterialCacheKey.call(this);
    } finally {
      this.object = object;
    }
  };
}

/** The batch as its cache key should see it: a plain mesh with one instance. */
function keyView(object: Object3D): Object3D {
  let view = keyViews.get(object);
  if (view === undefined) {
    view = Object.create(object, {
      isInstancedMesh: { value: false },
      count: { value: 1 },
    }) as Object3D;
    keyViews.set(object, view);
  }
  return view;
}
