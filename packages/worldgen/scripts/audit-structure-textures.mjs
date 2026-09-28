/** Read-only GLB image/texture inventory; detects shared image bytes without extracting artwork. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from './format-json.mjs';
import {
  inspectStructureMaterials,
  summarizeStructureMaterials,
} from './structure-material-coverage.mjs';
import { writeIndex } from './structure-model-files.mjs';
import { knownSourceEntries } from './structure-source-paths.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pack = resolve(root, 'content/worldgen');
const destination = resolve(
  root,
  process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ??
    'content/worldgen/source/material-library/texture-audit.json',
);
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const models = [];
const catalog = JSON.parse(
  await readFile(resolve(pack, 'source/material-library/catalog.json'), 'utf8'),
);
const canonicalRefs = new Set(catalog.entries.map((entry) => entry.materialRef));
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
        name: image.name,
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
        sharedBaseColorRefs: [
          ...new Set(
            (doc.materials ?? [])
              .filter((material) => {
                const texture = material.pbrMetallicRoughness?.baseColorTexture?.index;
                return texture !== undefined && doc.textures?.[texture]?.source === index;
              })
              .map((material) => material.extras?.molenSurface?.ref)
              .filter(Boolean),
          ),
        ].sort(),
      };
    });
    models.push({
      path: relative(pack, path).replaceAll('\\', '/'),
      sha256: hash(bytes),
      bytes: bytes.length,
      materials: doc.materials?.length ?? 0,
      materialCoverage: inspectStructureMaterials(doc, canonicalRefs),
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
    'Read glTF2 JSON chunks; inventory images, texture records, vertex colors and each explicit shared/local material definition. Validate canonical references, binding slots and UV0 presence. Embedded image bytes are hash-compared; names and colors never authorize automatic substitution.',
  summary: {
    models: models.length,
    modelsWithImages: models.filter((model) => model.images.length > 0).length,
    imageCount: models.reduce((sum, model) => sum + model.images.length, 0),
    uniqueEmbeddedImages: imageHashes.size,
    embeddedImageBytes: models.reduce(
      (sum, model) => sum + model.images.reduce((total, image) => total + (image.bytes ?? 0), 0),
      0,
    ),
    imagesWithSharedBaseColorBindings: models.reduce(
      (sum, model) =>
        sum + model.images.filter((image) => image.sharedBaseColorRefs.length > 0).length,
      0,
    ),
    modelsWithTextureRecords: models.filter((model) => model.textureCount > 0).length,
    modelsWithVertexColors: models.filter((model) => model.vertexColors).length,
    modelsWithSharedMaterials: models.filter((model) => model.sharedMaterialRefs.length > 0).length,
    bindingIssues: models.reduce((sum, model) => sum + model.materialCoverage.issues.length, 0),
  },
  authoredCoverage: summarizeStructureMaterials(models, knownSourceEntries()),
  duplicateImageGroups: [...imageHashes.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([sha256, owners]) => ({ sha256, owners })),
  conclusion: models.every((model) => model.images.length === 0)
    ? 'No image records exist in these GLBs. Reusable architectural texture sources are the canonical material graphs; original vertex-color PBR remains the portable model fallback.'
    : 'Images bound to shared base-color refs can provide portable GLB fallbacks while the world viewer uses the referenced canonical material graph. This inventory records bindings and image-byte duplication, not licensing or visual equivalence; preserve unique artwork and confirm provenance before extraction.',
  models,
};
await mkdir(dirname(destination), { recursive: true });
// The formatter expects JSON values; omit absent image URI/MIME/name fields first.
const serialized = `${formatJson(JSON.parse(JSON.stringify(report)))}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(destination, 'utf8')).replaceAll('\r\n', '\n') !== serialized)
    throw new Error(
      'Structure texture audit is stale; run packages/worldgen/scripts/audit-structure-textures.mjs',
    );
} else await writeIndex(destination, serialized);
console.log(JSON.stringify(report.summary));
if (report.summary.bindingIssues > 0)
  throw new Error(
    `${report.summary.bindingIssues} invalid shared-surface bindings; inspect materialCoverage.issues in the audit`,
  );
