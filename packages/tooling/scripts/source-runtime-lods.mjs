/** Source-local runtime overlays avoid putting every model in a shared recipe table. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { compactPrimitive, prune, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { embedGraphFallbacks } from '../../worldgen/scripts/embed-graph-fallbacks.mjs';
import { hashEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';
import {
  readOptionalJson,
  root,
  writeIndex,
} from '../../worldgen/scripts/structure-model-files.mjs';
import {
  isStructureRecipePath,
  knownSourceEntries,
} from '../../worldgen/scripts/structure-source-paths.mjs';
import {
  landmarkLodRecipeHash as baseHash,
  buildModelLandmarkLods as buildBase,
} from './authored-landmark-lods.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const withGraphFallbacks = (bytes, definition) =>
  embedGraphFallbacks(
    Buffer.from(bytes),
    (definition.embeddedCanonicalGraphs ?? []).map((name) => ({
      ref: `matgraph:molen.worldgen.material.${name}`,
      graphPath: resolve(root, `content/worldgen/materials/${name}.matgraph.json`),
    })),
    root,
  );
const implementation = hashEvidenceText(
  (await readFile(new URL(import.meta.url), 'utf8')) +
    (await readFile(new URL('../../worldgen/scripts/joined-path.mjs', import.meta.url), 'utf8')),
);
async function overlay(id) {
  const entry = knownSourceEntries().find((e) => e.assetId === id);
  const spec = entry
    ? await readOptionalJson(resolve(root, entry.sourcePath, 'spec.json'))
    : undefined;
  const definition = spec?.runtimeLodOverlay;
  if (!definition) return undefined;
  const path = resolve(root, definition.module);
  if (
    !isStructureRecipePath(definition.module, entry.sourcePath) ||
    definition.level !== 'skyline' ||
    typeof definition.export !== 'string' ||
    !Number.isFinite(definition.errorMeters) ||
    definition.errorMeters < 0
  )
    throw new Error(`${id}: invalid source-local runtime overlay`);
  for (const [name, cap] of Object.entries(definition.caps ?? {}))
    if (
      !['district', 'street', 'closeup'].includes(name) ||
      !Number.isInteger(cap.triangles) ||
      cap.triangles < 1 ||
      cap.triangles > { district: 4000, street: 16000, closeup: 64000 }[name] ||
      !Number.isFinite(cap.errorMeters) ||
      cap.errorMeters < 0
    )
      throw new Error(`${id}: invalid derivative cap`);
  for (const [name, detail] of Object.entries(definition.authoredLevels ?? {}))
    if (
      !['district', 'street', 'closeup'].includes(name) ||
      typeof detail.export !== 'string' ||
      !Number.isFinite(detail.errorMeters) ||
      detail.errorMeters < 0 ||
      !detail.surfaces
    )
      throw new Error(`${id}: invalid authored derivative`);
  return { definition, path };
}

async function authoredDerivative(path, level, definition, module) {
  const build = module[definition.export];
  if (typeof build !== 'function') throw new Error(`Missing authored ${level.name} export`);
  const builder = new MeshBufferBuilder();
  const authoring = createArchitecturalSurfaceAuthoring(definition.surfaces);
  build(authoring.wrap(builder));
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `source-${level.name}`);
  if (mesh.triangleCount > { district: 4000, street: 16000, closeup: 64000 }[level.name])
    throw new Error(`${level.name}: authored derivative exceeds its triangle ceiling`);
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
  const document = await io.readBinary(
    await withGraphFallbacks(
      encodeGlb(mesh, authoring.materials(mesh.groups), `source-${level.name}`),
      definition,
    ),
  );
  await document.transform(weld({ tolerance: 0 }), prune({ keepAttributes: true }));
  const bytes = Buffer.from(await io.writeBinary(document));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const memory = gltf.bufferViews.reduce((n, v) => n + v.byteLength, 0);
  await writeIndex(path, bytes);
  return {
    ...level,
    hash: hash(bytes),
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 6 }).length,
    triangles: mesh.triangleCount,
    cpuBytes: memory,
    gpuBytes: memory,
    errorMeters: definition.errorMeters,
    drawCalls: mesh.groups.length,
  };
}

/** Small explicitly error-bounded reductions; preserve every material and vertex stream. */
async function capDerivative(path, level, cap) {
  if (level.triangles <= cap.triangles) return level;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
  const document = await io.read(path);
  const ratio = Math.min(1, (cap.triangles / level.triangles) * 0.985);
  let triangles = 0,
    deviation = 0;
  for (const mesh of document.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives()) {
      const index = primitive.getIndices(),
        positions = primitive.getAttribute('POSITION');
      if (!index || positions.getElementSize() !== 3)
        throw new Error('Cap requires indexed triangle geometry');
      const [reduced, error] = MeshoptSimplifier.simplify(
        new Uint32Array(index.getArray()),
        new Float32Array(positions.getArray()),
        3,
        Math.max(3, Math.floor((index.getCount() * ratio) / 3) * 3),
        cap.errorMeters,
        ['ErrorAbsolute', ...(cap.prune ? ['Prune'] : [])],
      );
      if (!reduced.length) throw new Error('Cap removed an entire surface group');
      index.setArray(reduced);
      compactPrimitive(primitive);
      triangles += reduced.length / 3;
      deviation = Math.max(deviation, error, cap.prune ? cap.errorMeters : 0);
    }
  if (triangles > cap.triangles)
    throw new Error(
      `Cannot meet ${cap.triangles} triangles within ${cap.errorMeters}m: ${triangles}`,
    );
  await document.transform(prune({ keepAttributes: true }));
  const bytes = Buffer.from(await io.writeBinary(document));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const memory = gltf.bufferViews.reduce((n, v) => n + v.byteLength, 0);
  await writeIndex(path, bytes);
  return {
    ...level,
    hash: hash(bytes),
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 6 }).length,
    triangles,
    cpuBytes: memory,
    gpuBytes: memory,
    errorMeters: level.errorMeters + deviation,
  };
}
export async function landmarkLodRecipeHash(id) {
  const data = await overlay(id),
    base = await baseHash(id);
  return data
    ? hash(
        JSON.stringify({
          base,
          implementation,
          definition: data.definition,
          source: hashEvidenceText(await readFile(data.path)),
        }),
      )
    : base;
}
export async function buildModelLandmarkLods(sidecarPath, options = {}) {
  const before = JSON.parse(await readFile(sidecarPath));
  const data = await overlay(before.id);
  if (!data) return buildBase(sidecarPath, options);
  const recipeHash = await landmarkLodRecipeHash(before.id);
  const directory = dirname(sidecarPath);
  if (hash(await readFile(resolve(directory, before.files.main))) !== before.hash)
    throw new Error(`${before.id}: stale master import`);
  if (
    !options.force &&
    before.runtimeLods?.recipeHash === recipeHash &&
    before.runtimeLods.masterHash === before.hash &&
    before.runtimeLods.levels.length === 4
  ) {
    const current = await Promise.all(
      before.runtimeLods.levels.map(async (level) => {
        try {
          return hash(await readFile(resolve(directory, level.file))) === level.hash;
        } catch (e) {
          if (e.code === 'ENOENT') return false;
          throw e;
        }
      }),
    );
    if (current.every(Boolean)) return before.runtimeLods;
  }
  await buildBase(sidecarPath, options);
  const sidecar = JSON.parse(await readFile(sidecarPath));
  const builder = new MeshBufferBuilder();
  const authoring = data.definition.surfaces
    ? createArchitecturalSurfaceAuthoring(data.definition.surfaces)
    : undefined;
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (_slot, _ref, ...args) => builder[name]('wall', 'palette:#ffffff', ...args),
    ]),
  );
  const module = await import(pathToFileURL(data.path).href);
  const build = module[data.definition.export];
  if (typeof build !== 'function') throw new Error(`${before.id}: missing runtime overlay export`);
  build(authoring ? authoring.wrap(builder) : mapped);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `${before.id}/source-skyline`);
  if (mesh.triangleCount > 1000) throw new Error(`${before.id}: skyline exceeds1000triangles`);
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
  const document = await io.readBinary(
    await withGraphFallbacks(
      encodeGlb(
        mesh,
        authoring
          ? authoring.materials(mesh.groups)
          : [{ name: 'source-skyline', roughness: 0.85, metallic: 0 }],
        before.id,
      ),
      data.definition,
    ),
  );
  await document.transform(weld({ tolerance: 0 }), prune({ keepAttributes: true }));
  const bytes = Buffer.from(await io.writeBinary(document));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const memory = gltf.bufferViews.reduce((n, v) => n + v.byteLength, 0),
    file = 'model.skyline.glb';
  await writeIndex(resolve(directory, file), bytes);
  sidecar.files.variants.skyline = file;
  sidecar.runtimeLods.levels[0] = {
    name: 'skyline',
    file,
    hash: hash(bytes),
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 6 }).length,
    triangles: mesh.triangleCount,
    cpuBytes: memory,
    gpuBytes: memory,
    errorMeters: data.definition.errorMeters,
    drawCalls: mesh.groups.length,
  };
  for (const [name, detail] of Object.entries(data.definition.authoredLevels ?? {})) {
    const index = sidecar.runtimeLods.levels.findIndex((l) => l.name === name);
    if (index < 0) throw new Error(`Missing derivative ${name}`);
    const level = sidecar.runtimeLods.levels[index];
    sidecar.runtimeLods.levels[index] = await authoredDerivative(
      resolve(directory, level.file),
      level,
      detail,
      module,
    );
  }
  for (const [name, cap] of Object.entries(data.definition.caps ?? {})) {
    const index = sidecar.runtimeLods.levels.findIndex((l) => l.name === name),
      level = sidecar.runtimeLods.levels[index];
    if (!level) throw new Error(`Missing derivative ${name}`);
    sidecar.runtimeLods.levels[index] = await capDerivative(
      resolve(directory, level.file),
      level,
      cap,
    );
  }
  sidecar.runtimeLods.recipeHash = recipeHash;
  await writeIndex(sidecarPath, JSON.stringify(sidecar, null, 2) + '\n');
  return sidecar.runtimeLods;
}
