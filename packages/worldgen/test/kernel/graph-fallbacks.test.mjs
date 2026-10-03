import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bakeGraphPng, embedGraphFallbacks } from '../../scripts/embed-graph-fallbacks.mjs';
import { encodeGlb } from '../../src/kernel/glb';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

describe('portable canonical graph fallback', () => {
  it('exports hard masks and fractional coverage with their distinct portable alpha modes', async () => {
    const names = ['metal_perforated_round_open', 'metal_painted', 'metal_perforated_square'];
    const refs = names.map((name) => `matgraph:molen.worldgen.material.${name}`);
    const builder = new MeshBufferBuilder();
    for (const ref of refs)
      builder.addQuad(
        'wall',
        ref,
        [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
        ],
        [0, 0, 1],
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        [1, 1, 1],
      );
    const input = Buffer.from(
      encodeGlb(
        builder.finalize(),
        refs.map((ref) => ({
          sharedSurface: { ref, slot: 'wall', uv: 'repeats' },
        })),
      ),
    );
    const graphPaths = names.map(
      (name) => `${root}/content/worldgen/materials/${name}.matgraph.json`,
    );
    const output = await embedGraphFallbacks(
      input,
      names.map((_, i) => ({ ref: refs[i], graphPath: graphPaths[i] })),
      root,
    );
    const jsonLength = output.readUInt32LE(12);
    const doc = JSON.parse(output.subarray(20, 20 + jsonLength));
    expect(doc.materials[0]).toMatchObject({ alphaMode: 'MASK', alphaCutoff: 0.3 });
    expect(doc.materials[1].alphaMode).toBe('OPAQUE');
    expect(doc.samplers[doc.textures[0].sampler].minFilter).toBe(9729);
    expect(doc.samplers[doc.textures[1].sampler].minFilter).toBe(9987);
    expect(doc.materials[2].alphaMode).toBe('BLEND');
    expect(doc.materials[2].alphaCutoff).toBeUndefined();
    expect(doc.samplers[doc.textures[2].sampler].minFilter).toBe(9987);
    for (let i = 0; i < names.length; i++) {
      const view = doc.bufferViews[doc.images[i].bufferView];
      const start = 28 + jsonLength + view.byteOffset;
      const png = await bakeGraphPng(graphPaths[i], names[i], root);
      expect(output.subarray(start, start + view.byteLength)).toEqual(png);
      expect(doc.materials[i].extras.molenSurface.ref).toBe(refs[i]);
    }
    expect(output.readUInt32LE(8)).toBe(output.length);
  }, 30_000);
});
