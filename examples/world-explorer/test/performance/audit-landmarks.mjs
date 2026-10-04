/** Inspect existing outputs only; never generates or changes model assets. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const output = resolve(root, '.artifacts/landmark-performance');
const compressGzip = promisify(gzip);
const compressBrotli = promisify(brotliCompress);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

export async function audit() {
  const pack = await readJson(resolve(root, 'content/worldgen/stylepack.json'));
  const source = resolve(root, 'content/worldgen/source/places');
  const candidates = [];
  for (const path of await readdir(source, { recursive: true })) {
    if (!path.endsWith('spec.json')) continue;
    const spec = await readJson(resolve(source, path));
    if (spec.category !== 'skyscraper') continue;
    const sidecarPath = pack.assets[spec.assetId];
    if (!sidecarPath) continue;
    const sidecar = await readJson(resolve(root, 'content/worldgen', sidecarPath));
    candidates.push({
      id: spec.id,
      asset: spec.assetId,
      title: spec.title,
      path: `content/worldgen/${dirname(sidecarPath).replaceAll('\\', '/')}/${sidecar.files.main}`,
      bytes: sidecar.stats.sizeBytes,
      expectedHash: sidecar.hash,
      variants: Object.keys(sidecar.files.variants ?? {}),
    });
  }
  const sapphire = candidates.find((entry) => entry.id === 'N0229');
  if (!sapphire) throw new Error('Build Istanbul Sapphire before running this benchmark.');
  const selected = candidates
    .filter((entry) => entry !== sapphire)
    .sort(
      (a, b) =>
        Math.abs(a.bytes - 10_000_000) - Math.abs(b.bytes - 10_000_000) || a.id.localeCompare(b.id),
    )
    .slice(0, 40);
  if (selected.length !== 40) throw new Error('Need 40 built skyscrapers plus Sapphire.');
  selected.unshift(sapphire);
  await mkdir(output, { recursive: true });
  for (const entry of selected) {
    const bytes = await readFile(resolve(root, entry.path));
    entry.hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (entry.hash !== entry.expectedHash) throw new Error(`${entry.id}: stale sidecar hash`);
    entry.bytes = bytes.length;
    if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('Expected GLB');
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    const positions = new Set();
    const views = new Set();
    const includeAccessor = (index) => {
      const accessor = gltf.accessors[index];
      if (accessor.bufferView !== undefined) views.add(accessor.bufferView);
    };
    let storedTriangles = 0;
    const triangles = gltf.meshes.map((mesh) =>
      mesh.primitives.reduce((sum, primitive) => {
        if ((primitive.mode ?? 4) !== 4) throw new Error('Benchmark expects triangle meshes');
        positions.add(primitive.attributes.POSITION);
        for (const accessor of Object.values(primitive.attributes)) includeAccessor(accessor);
        if (primitive.indices !== undefined) includeAccessor(primitive.indices);
        const count = gltf.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
        storedTriangles += count;
        return sum + count;
      }, 0),
    );
    let expandedTriangles = 0;
    let primitiveInstances = 0;
    const visit = (index) => {
      const node = gltf.nodes[index];
      const attrs = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
      const instances = attrs ? gltf.accessors[Object.values(attrs)[0]].count : 1;
      if (attrs) for (const accessor of Object.values(attrs)) includeAccessor(accessor);
      if (node.mesh !== undefined) {
        expandedTriangles += triangles[node.mesh] * instances;
        primitiveInstances += gltf.meshes[node.mesh].primitives.length;
      }
      for (const child of node.children ?? []) visit(child);
    };
    for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node);
    Object.assign(entry, {
      storedTriangles,
      expandedTriangles,
      uniquePositionVertices: [...positions].reduce(
        (sum, index) => sum + gltf.accessors[index].count,
        0,
      ),
      attributeBufferViewBytes: [...views].reduce(
        (sum, index) => sum + gltf.bufferViews[index].byteLength,
        0,
      ),
      primitiveInstances,
      embeddedImages: gltf.images?.length ?? 0,
      gzipBytes: (await compressGzip(bytes, { level: 6 })).length,
      brotliBytes: (
        await compressBrotli(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      ).length,
    });
    console.log(
      `${entry.id}: ${(entry.bytes / 1e6).toFixed(1)} MB -> ${(entry.gzipBytes / 1e6).toFixed(2)} MB gzip`,
    );
  }
  const sum = (items, key) => items.reduce((value, entry) => value + entry[key], 0);
  const scenarios = [1, 9, 41].map((count) => {
    const entries = selected.slice(0, count);
    return {
      count,
      ids: entries.map((entry) => entry.id),
      ...Object.fromEntries(
        [
          'bytes',
          'gzipBytes',
          'brotliBytes',
          'storedTriangles',
          'expandedTriangles',
          'attributeBufferViewBytes',
          'primitiveInstances',
        ].map((key) => [key, sum(entries, key)]),
      ),
    };
  });
  const report = {
    format: 'molen/landmark-performance-audit@1',
    generatedAt: new Date().toISOString(),
    selection:
      'Istanbul Sapphire plus the 40 other built skyscraper assets nearest 10,000,000 bytes, sorted by absolute difference then ID. Synthetic mixed-city workload, not a geographic city reconstruction.',
    compression:
      'Per-file gzip level 6 and Brotli quality 5; measurements, not an assumption that hosting enables them. No mesh simplification.',
    scenarios,
    models: selected,
  };
  await writeFile(resolve(output, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(scenarios, null, 2));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await audit();
