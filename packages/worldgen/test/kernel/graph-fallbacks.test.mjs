import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { embedGraphFallbacks } from '../../scripts/embed-graph-fallbacks.mjs';
import { encodeGlb } from '../../src/kernel/glb';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

describe('portable canonical graph fallback', () => {
  it('keeps aperture alpha and linear minification while preserving opaque mip sampling', async () => {
    const names = ['metal_perforated_round_open', 'metal_painted'];
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
    const output = await embedGraphFallbacks(
      input,
      names.map((name, i) => ({
        ref: refs[i],
        graphPath: `${root}/content/worldgen/materials/${name}.matgraph.json`,
      })),
      root,
    );
    const jsonLength = output.readUInt32LE(12);
    const doc = JSON.parse(output.subarray(20, 20 + jsonLength));
    expect(doc.materials[0]).toMatchObject({ alphaMode: 'MASK', alphaCutoff: 0.3 });
    expect(doc.materials[1].alphaMode).toBe('OPAQUE');
    expect(doc.samplers[doc.textures[0].sampler].minFilter).toBe(9729);
    expect(doc.samplers[doc.textures[1].sampler].minFilter).toBe(9987);
    for (let i = 0; i < names.length; i++) {
      const view = doc.bufferViews[doc.images[i].bufferView];
      const start = 28 + jsonLength + view.byteOffset;
      const png = await readFile(`${root}/.artifacts/canonical-material-bakes/${names[i]}.png`);
      expect(output.subarray(start, start + view.byteLength)).toEqual(png);
      expect(doc.materials[i].extras.molenSurface.ref).toBe(refs[i]);
    }
    expect(output.readUInt32LE(8)).toBe(output.length);
  }, 30_000);
});
