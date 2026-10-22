import type { BufferAttribute, BufferGeometry, InstancedBufferAttribute, Object3D } from 'three';
import type * as WebGPU from 'three/webgpu';

// Three r184–r186 internals: `InstanceNode._createInstanceMatrixNode`, the renderer's
// `RenderObjects.createRenderObject`, and `RenderObject`'s cache key, bindings and attributes.
interface InstanceNodeInternals {
  instanceMatrix: InstancedBufferAttribute;
  _createInstanceMatrixNode(
    this: InstanceNodeInternals,
    assignBuffer: boolean,
    builder: { renderer?: { backend?: { isWebGPUBackend?: boolean } } },
  ): unknown;
}
type InstancedObject = Object3D & {
  isInstancedMesh?: boolean;
  isBatchedMesh?: boolean;
  isSkinnedMesh?: boolean;
  morphTexture?: unknown;
  morphTargetInfluences?: unknown;
  instanceMatrix: InstancedBufferAttribute;
  instanceColor: InstancedBufferAttribute | null;
};
interface Binding {
  isStorageBuffer?: boolean;
  /** A storage buffer's node itself. */
  nodeUniform?: object;
}
interface RenderObject {
  object: InstancedObject;
  geometry: BufferGeometry;
  initialCacheKey: unknown;
  attributes: BufferAttribute[] | null;
  vertexBuffers: BufferAttribute[];
  _bindings: { bindings: Binding[] }[] | null;
  getCacheKey(): unknown;
  getMaterialCacheKey(this: RenderObject): unknown;
  getBindings(this: RenderObject): { bindings: Binding[] }[];
  getAttributes(this: RenderObject): BufferAttribute[];
}
interface RenderObjects {
  createRenderObject(...args: unknown[]): RenderObject;
}
/** The `three/webgpu` and `three/tsl` values this needs, which only the lazy driver may import. */
export interface SharedInstancingNodes {
  InstanceNode: typeof WebGPU.InstanceNode;
  StorageBufferNode: typeof WebGPU.StorageBufferNode;
  instanceIndex: unknown;
  objectGroup: unknown;
}
// three's typings list no 'mat4' storage buffer, which three itself uses for storage matrices.
type MatrixStorage = new (
  value: InstancedBufferAttribute,
  type: 'mat4',
  count: number,
) => { name: string; groupNode: unknown; element(index: unknown): unknown };

const patched = new WeakSet<object>();
const matrixNodes = new WeakSet<object>();

/**
 * Give every InstancedMesh drawn with one material the same shader and the same node state.
 *
 * Three reads an InstancedMesh's matrices from a uniform array declared with the batch's instance
 * count and named after its node, so each batch compiled a WGSL module and a GPU pipeline of its
 * own; and it keys an instanced mesh's node state by the mesh, so each batch also built that (about
 * 11 ms of main thread for a worldgen plant batch, per draw target and material). Streaming
 * worldgen's plant batches in flight made over a thousand a minute: pipelines created mid-frame,
 * synchronously, stalled the browser's GPU process for seconds, and the builds took a third of
 * the main thread.
 *
 * Matrices now come from a runtime-sized storage buffer under one name, so the shader text is the
 * same for every batch of a material; they upload when the attribute's version changes, as vertex
 * buffers do. Render objects of such meshes share node state across meshes (keyed by whether they
 * have instance colors, not by mesh), and each points its own bindings at its mesh's matrices and
 * its vertex buffers at its mesh's colors. Applies to WebGPU backends only, and not to batched,
 * skinned or morphed meshes; the matrices of the previous frame (velocity) keep three's path.
 */
export function installWebGpuSharedInstancing(
  renderer: WebGPU.WebGPURenderer,
  three: SharedInstancingNodes,
): void {
  patchInstanceNode(three);
  const objects = (renderer as unknown as { _objects?: RenderObjects | null })._objects;
  if (objects == null || patched.has(objects)) return;
  patched.add(objects);
  const create = objects.createRenderObject;
  objects.createRenderObject = (...args) => {
    const renderObject = create.apply(objects, args);
    const prototype = Object.getPrototypeOf(renderObject) as RenderObject;
    if (!patched.has(prototype)) {
      patchRenderObject(prototype);
      // Constructed before the patch: key it as later render objects are.
      if (shareable(renderObject.object)) renderObject.initialCacheKey = renderObject.getCacheKey();
    }
    return renderObject;
  };
}

function patchInstanceNode(three: SharedInstancingNodes): void {
  const prototype = three.InstanceNode.prototype as unknown as InstanceNodeInternals;
  const Storage = three.StorageBufferNode as unknown as MatrixStorage;
  const { instanceIndex, objectGroup } = three;
  if (patched.has(prototype) || typeof prototype._createInstanceMatrixNode !== 'function') return;
  patched.add(prototype);
  const create = prototype._createInstanceMatrixNode;
  prototype._createInstanceMatrixNode = function (assignBuffer, builder) {
    // Storage-attribute matrices are named too: three's storage node marks the attribute it reads
    // as one, so a batch's later builds (another draw target, the shadow pass, another material)
    // find a storage attribute.
    if (!assignBuffer || builder.renderer?.backend?.isWebGPUBackend !== true)
      return create.call(this, assignBuffer, builder);
    const matrices = this.instanceMatrix;
    const node = new Storage(matrices, 'mat4', Math.max(matrices.count, 1));
    // The node's own name: TSL's chained `setName` only names it through a build context.
    node.name = 'instanceMatrices';
    // Bound per draw, as the mesh's other object uniforms are; three binds storage buffers once
    // per render, which shared node state would make one buffer for every mesh.
    node.groupNode = objectGroup;
    matrixNodes.add(node);
    return node.element(instanceIndex);
  };
}

function shareable(object: InstancedObject): boolean {
  return (
    object.isInstancedMesh === true &&
    object.isBatchedMesh !== true &&
    object.isSkinnedMesh !== true &&
    object.morphTexture == null &&
    object.morphTargetInfluences === undefined
  );
}

function patchRenderObject(prototype: RenderObject): void {
  patched.add(prototype);
  const materialCacheKey = prototype.getMaterialCacheKey;
  prototype.getMaterialCacheKey = function () {
    const object = this.object;
    if (!shareable(object)) return materialCacheKey.call(this);
    // Three adds the mesh's uuid for instanced meshes; this stands for every such mesh.
    const uuid = object.uuid;
    object.uuid = object.instanceColor !== null ? 'molen:instances+color' : 'molen:instances';
    try {
      return materialCacheKey.call(this);
    } finally {
      object.uuid = uuid;
    }
  };
  const getBindings = prototype.getBindings;
  prototype.getBindings = function () {
    if (this._bindings !== null) return this._bindings;
    const bindings = getBindings.call(this);
    const object = this.object;
    if (!shareable(object)) return bindings;
    // This render object's copies of the shared state's bindings still read the matrices of the
    // mesh that state was built for; three rebinds a storage buffer when its attribute changes.
    for (const group of bindings)
      for (const binding of group.bindings) {
        const node = binding.nodeUniform;
        if (binding.isStorageBuffer !== true || node === undefined || !matrixNodes.has(node))
          continue;
        Object.defineProperty(binding, 'attribute', {
          configurable: true,
          get: () => object.instanceMatrix,
        });
        Object.defineProperty(binding, 'buffer', {
          configurable: true,
          get: () => object.instanceMatrix.array,
        });
      }
    return bindings;
  };
  const getAttributes = prototype.getAttributes;
  prototype.getAttributes = function () {
    if (this.attributes !== null) return this.attributes;
    const attributes = getAttributes.call(this);
    const { object, geometry } = this;
    const colors = object.instanceColor;
    if (colors === null || !shareable(object)) return attributes;
    // Three reads instance colors through a vertex attribute of its own over the colors of the mesh
    // the shared state was built for: the one instanced attribute the geometry does not hold.
    const own = new Set<unknown>(Object.values(geometry.attributes));
    attributes.forEach((attribute, index) => {
      const instanced = attribute as BufferAttribute & { isInstancedBufferAttribute?: boolean };
      if (instanced.isInstancedBufferAttribute !== true || own.has(attribute)) return;
      attributes[index] = colors;
      const buffer = this.vertexBuffers.indexOf(attribute);
      if (buffer >= 0) this.vertexBuffers[buffer] = colors;
    });
    return attributes;
  };
}
