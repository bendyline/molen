/** Cheap build gate: inspect GLB JSON chunks, without reading the geometry or image payloads. */
import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectStructureMaterials } from './structure-material-coverage.mjs';
import { knownSourceEntries, sourceRepositoryRoot as root } from './structure-source-paths.mjs';

const content = resolve(root, 'content/worldgen');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json(resolve(content, 'source/material-library/catalog.json'));
const canonicalRefs = new Set(catalog.entries.map((entry) => entry.materialRef));
const pack = await json(resolve(content, 'stylepack.json'));
const paths = knownSourceEntries()
  .filter((entry) => entry.hasModel)
  .map((entry) => resolve(root, entry.sourcePath, 'models/source.glb'));
for (const sidecarPath of Object.values(pack.assets)) {
  const sidecar = await json(resolve(content, sidecarPath));
  paths.push(resolve(content, sidecarPath, '..', sidecar.files.main));
}
const issues = [];
for (const path of new Set(paths)) {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(20);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    const size = (await file.stat()).size;
    if (
      bytesRead !== 20 ||
      header.readUInt32LE(0) !== 0x46546c67 ||
      header.readUInt32LE(4) !== 2 ||
      header.readUInt32LE(8) !== size ||
      header.readUInt32LE(16) !== 0x4e4f534a
    )
      throw new Error(`Invalid GLB2 header: ${path}`);
    const length = header.readUInt32LE(12);
    if (length < 2 || length > size - 20) throw new Error(`Invalid GLB JSON length: ${path}`);
    const bytes = Buffer.alloc(length);
    if ((await file.read(bytes, 0, length, 20)).bytesRead !== length)
      throw new Error(`Incomplete GLB JSON: ${path}`);
    const coverage = inspectStructureMaterials(JSON.parse(bytes.toString('utf8')), canonicalRefs);
    for (const issue of coverage.issues) issues.push({ path, ...issue });
  } finally {
    await file.close();
  }
}
if (issues.length)
  throw new Error(`Invalid shared material bindings:\n${JSON.stringify(issues, null, 2)}`);
console.log(
  `Validated shared surface references, slots and UV0 across ${new Set(paths).size} source/runtime GLBs.`,
);
