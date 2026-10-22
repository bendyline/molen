import { InstancedBufferAttribute } from 'three';
import { instanceIndex, objectGroup } from 'three/tsl';
import { InstanceNode, type NodeBuilder, StorageBufferNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { installWebGpuSharedInstancing } from '../src/three/webgpu-shared-instancing';

const nodes = { StorageBufferNode, instanceIndex, objectGroup };
// The r184 implementation has this private hook, but its declarations omit it.
class LegacyNode extends InstanceNode {
  declare _createInstanceMatrixNode: (assignBuffer: boolean, builder: NodeBuilder) => object;
}
const builder = (webgpu: boolean): NodeBuilder =>
  ({
    renderer: { backend: { isWebGPUBackend: webgpu } },
    getUniformBufferLimit: () => 65536,
  }) as unknown as NodeBuilder;

describe('WebGPU shared instancing compatibility', () => {
  it('leaves newer Three implementations without the legacy hook alone', () => {
    expect(() => installWebGpuSharedInstancing(nodes)).not.toThrow();
    const prototype = {};
    installWebGpuSharedInstancing({ ...nodes, InstanceNode: { prototype } });
    expect(prototype).toEqual({});
  });

  it('keeps r184 matrix buffers separate while sharing their shader binding name', () => {
    class LegacyInstanceNode extends LegacyNode {}
    installWebGpuSharedInstancing({ ...nodes, InstanceNode: LegacyInstanceNode });
    const create = LegacyInstanceNode.prototype._createInstanceMatrixNode;
    installWebGpuSharedInstancing({ ...nodes, InstanceNode: LegacyInstanceNode });
    expect(LegacyInstanceNode.prototype._createInstanceMatrixNode).toBe(create);
    for (const count of [0, 2, 5]) {
      const matrices = new InstancedBufferAttribute(new Float32Array(count * 16), 16);
      const instance = new LegacyInstanceNode(count, matrices);
      const element = instance._createInstanceMatrixNode(true, builder(true));
      expect(element).toMatchObject({
        node: {
          isStorageBufferNode: true,
          name: 'instanceMatrices',
          bufferCount: Math.max(count, 1),
        },
      });
      expect(Reflect.get(element, 'node').value).toBe(matrices);
      expect(Reflect.get(element, 'node').groupNode).toBe(objectGroup);
      expect(Reflect.get(element, 'indexNode')).toBe(instanceIndex);
    }
  });

  it('preserves Three’s matrix path for WebGL and previous-frame data', () => {
    class LegacyInstanceNode extends LegacyNode {}
    installWebGpuSharedInstancing({ ...nodes, InstanceNode: LegacyInstanceNode });
    for (const [assignBuffer, webgpu] of [
      [true, false],
      [false, true],
    ] as const) {
      const matrices = new InstancedBufferAttribute(new Float32Array(32), 16);
      const instance = new LegacyInstanceNode(2, matrices);
      const element = instance._createInstanceMatrixNode(assignBuffer, builder(webgpu));
      expect(Reflect.get(element, 'node').isStorageBufferNode).not.toBe(true);
      expect(Reflect.get(element, 'node').value).toBe(matrices.array);
      expect('isStorageInstancedBufferAttribute' in matrices).toBe(false);
    }
  });
});
