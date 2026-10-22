import type { InstancedBufferAttribute } from 'three';
import type * as WebGPU from 'three/webgpu';

// Three r184–r186 internals: `InstanceNode._createInstanceMatrixNode`.
interface InstanceNodeInternals {
  instanceMatrix: InstancedBufferAttribute;
  _createInstanceMatrixNode(
    this: InstanceNodeInternals,
    assignBuffer: boolean,
    builder: { renderer?: { backend?: { isWebGPUBackend?: boolean } } },
  ): unknown;
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

/**
 * Give every InstancedMesh drawn with one material the same shader. Three reads an InstancedMesh's
 * matrices from a uniform array declared with the batch's instance count and named after its node,
 * so each batch compiled a WGSL module and a GPU pipeline of its own. Streaming worldgen's plant
 * batches in flight made hundreds a minute, and those created mid-frame, synchronously, stalled the
 * browser's GPU process for seconds. A runtime-sized storage buffer under one name makes the shader
 * text identical, and three's pipeline cache serves every batch after the first; matrices upload
 * when the attribute's version changes, as vertex buffers do. Each batch still builds its node
 * state on the CPU, since three keys that by mesh. (Sharing that state across meshes, each render
 * object binding its own mesh's buffers, broke the WebGPU scene optimizer's render bundles: whole
 * buildings stopped drawing.) Applies to WebGPU backends only; the matrices of the previous frame
 * (velocity) keep three's own path.
 */
export function installWebGpuSharedInstancing(three: SharedInstancingNodes): void {
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
    // Bound with the mesh's other object uniforms, as an instance array belongs to its mesh.
    node.groupNode = objectGroup;
    return node.element(instanceIndex);
  };
}
