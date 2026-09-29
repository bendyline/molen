/** Embed portable copies of canonical material-graph base colors. Runtime sharing still owns residency. */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const aligned = (n) => (n + 3) & ~3;

export async function embedGraphFallbacks(input, refs, root) {
  if (!refs.length) return input;
  const jsonLength = input.readUInt32LE(12);
  const doc = JSON.parse(input.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 28 + jsonLength;
  const originalBin = input.subarray(
    binaryStart,
    binaryStart + input.readUInt32LE(20 + jsonLength),
  );
  const chunks = [originalBin];
  let length = originalBin.length;
  doc.images ??= [];
  doc.textures ??= [];
  doc.samplers ??= [];
  const sampler = doc.samplers.length;
  doc.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
  let cutoutSampler;
  for (const { ref, graphPath } of refs) {
    const graph = JSON.parse(await readFile(graphPath, 'utf8'));
    const name = ref.split('.').at(-1);
    // A private directory per bake: generators run in parallel and may share a graph.
    const bakeDir = await mkdtemp(join(tmpdir(), 'molen-graph-bake-'));
    const pngPath = join(bakeDir, `${name}.png`);
    let png;
    try {
      await run(
        process.execPath,
        [
          resolve(root, 'packages/tooling/dist/cli.mjs'),
          'material',
          'bake',
          graphPath,
          '-o',
          pngPath,
        ],
        { cwd: root },
      );
      png = await readFile(pngPath);
    } finally {
      await rm(bakeDir, { recursive: true, force: true });
    }
    const pad = aligned(length) - length;
    if (pad) chunks.push(Buffer.alloc(pad));
    length += pad;
    const view = doc.bufferViews.length;
    doc.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: png.length });
    chunks.push(png);
    length += png.length;
    const image = doc.images.length;
    doc.images.push({
      name: `Canonical ${name} fallback`,
      mimeType: 'image/png',
      bufferView: view,
    });
    const texture = doc.textures.length;
    let textureSampler = sampler;
    if (graph.alphaTest !== undefined) {
      // Match the shared graph's linear sampling. Ordinary mip averaging closes
      // sub-centimeter holes when their mean alpha exceeds the material cutoff.
      if (cutoutSampler === undefined) {
        cutoutSampler = doc.samplers.length;
        doc.samplers.push({ magFilter: 9729, minFilter: 9729, wrapS: 10497, wrapT: 10497 });
      }
      textureSampler = cutoutSampler;
    }
    doc.textures.push({ source: image, sampler: textureSampler });
    let found = false;
    for (const material of doc.materials) {
      if (material.extras?.molenSurface?.ref !== ref) continue;
      material.pbrMetallicRoughness.baseColorTexture = { index: texture };
      if (graph.alphaTest !== undefined) {
        material.alphaMode = 'MASK';
        material.alphaCutoff = graph.alphaTest;
      }
      found = true;
    }
    if (!found) throw Error(`Canonical fallback ref is absent from GLB: ${ref}`);
  }
  doc.buffers[0].byteLength = length;
  const json = Buffer.from(JSON.stringify(doc));
  const jl = aligned(json.length),
    bl = aligned(length);
  const output = Buffer.alloc(28 + jl + bl);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jl, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  output.fill(0x20, 20, 20 + jl);
  json.copy(output, 20);
  output.writeUInt32LE(bl, 20 + jl);
  output.writeUInt32LE(0x004e4942, 24 + jl);
  Buffer.concat(chunks).copy(output, 28 + jl);
  return output;
}
