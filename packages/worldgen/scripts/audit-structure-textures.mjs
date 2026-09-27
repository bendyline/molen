/** Read-only GLB image/texture inventory; detects shared image bytes without extracting artwork. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from './format-json.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pack = resolve(root, 'content/worldgen');
const destination = resolve(
  root,
  process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ??
    'content/worldgen/source/material-library/texture-audit.json',
);
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const models = [];
async function walk(dir) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!entry.name.endsWith('.glb')) continue;
    const bytes = await readFile(path);
    if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2)
      throw new Error(`Not a GLB2: ${path}`);
    const jsonLength = bytes.readUInt32LE(12);
    const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
    const binStart = 20 + jsonLength + 8;
    const images = (doc.images ?? []).map((image, index) => {
      const view = image.bufferView === undefined ? undefined : doc.bufferViews?.[image.bufferView];
      return {
        index,
        mimeType: image.mimeType,
        uri: image.uri,
        bytes: view?.byteLength,
        sha256: view
          ? hash(
              bytes.subarray(
                binStart + (view.byteOffset ?? 0),
                binStart + (view.byteOffset ?? 0) + view.byteLength,
              ),
            )
          : undefined,
      };
    });
    models.push({
      path: relative(pack, path).replaceAll('\\', '/'),
      sha256: hash(bytes),
      bytes: bytes.length,
      materials: doc.materials?.length ?? 0,
      textureCount: doc.textures?.length ?? 0,
      images,
      vertexColors: (doc.meshes ?? []).some((mesh) =>
        mesh.primitives.some((primitive) => primitive.attributes.COLOR_0 !== undefined),
      ),
      sharedMaterialRefs: [
        ...new Set(
          (doc.materials ?? [])
            .map((material) => material.extras?.molenSurface?.ref)
            .filter(Boolean),
        ),
      ].sort(),
    });
  }
}
await walk(pack);
const imageHashes = new Map();
for (const model of models)
  for (const image of model.images)
    if (image.sha256) {
      const owners = imageHashes.get(image.sha256) ?? [];
      owners.push(`${model.path}#image-${image.index}`);
      imageHashes.set(image.sha256, owners);
    }
const report = {
  format: 'molen/structure-texture-audit@1',
  scope:
    'Every GLB in content/worldgen, including editable masters and imported runtime assets. Masters/runtime pairs are counted separately.',
  method:
    'Read glTF2 JSON chunks; inventory images, texture records, vertex colors and shared-surface bindings. Embedded image bytes are hash-compared; no images or unique artwork are modified.',
  summary: {
    models: models.length,
    modelsWithImages: models.filter((model) => model.images.length > 0).length,
    imageCount: models.reduce((sum, model) => sum + model.images.length, 0),
    modelsWithTextureRecords: models.filter((model) => model.textureCount > 0).length,
    modelsWithVertexColors: models.filter((model) => model.vertexColors).length,
    modelsWithSharedMaterials: models.filter((model) => model.sharedMaterialRefs.length > 0).length,
  },
  duplicateImageGroups: [...imageHashes.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([sha256, owners]) => ({ sha256, owners })),
  conclusion:
    imageHashes.size === 0
      ? 'No embedded bitmap textures exist to extract. Reusable architectural texture sources are the canonical material graphs; original vertex-color PBR remains the portable model fallback.'
      : 'Embedded images require semantic and licensing review before extracting genuinely reusable surfaces; hash matches alone do not prove interchangeability.',
  models,
};
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${formatJson(report)}\n`);
console.log(JSON.stringify(report.summary));
