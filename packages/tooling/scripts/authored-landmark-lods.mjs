/** Source-authored silhouettes for landmarks whose open crowns defeat automatic reduction. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { prune, weld } from '@gltf-transform/functions';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  cross,
  normalize,
  validateAuthoredMesh,
} from '../../worldgen/scripts/authored-structure-mesh.mjs';
import {
  buildBaroloRuntime,
  buildBaroloSkyline,
} from '../../worldgen/scripts/barolo-palace-model.mjs';
import { buildChinaWorldSkyline } from '../../worldgen/scripts/china-world-tower-model.mjs';
import { buildGranTorreSkyline } from '../../worldgen/scripts/gran-torre-costanera-model.mjs';
import {
  buildMillenniumRuntime,
  buildMillenniumSkyline,
} from '../../worldgen/scripts/millennium-tower-model.mjs';
import {
  buildMontsoreauRuntime,
  buildMontsoreauSkyline,
} from '../../worldgen/scripts/montsoreau-castle-model.mjs';
import {
  buildNeuschwansteinRuntime,
  buildNeuschwansteinSkyline,
} from '../../worldgen/scripts/neuschwanstein-castle-model.mjs';
import { buildNinaSkyline } from '../../worldgen/scripts/nina-tower-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import { buildLandmarkLods } from './landmark-lods.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const text = async (path) =>
  (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
const baseRecipeHash = hash(
  (await text('./landmark-lods.mjs')) + (await text('./landmark-hulls.mjs')),
);
const recipes = {
  'molen.worldgen.structure.n0237_neuschwanstein_castle': {
    build: buildNeuschwansteinSkyline,
    source: '../../worldgen/scripts/neuschwanstein-castle-model.mjs',
    errorMeters: 4,
    levels: buildNeuschwansteinRuntime,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.n0236_chateau_de_montsoreau': {
    build: buildMontsoreauSkyline,
    source: '../../worldgen/scripts/montsoreau-castle-model.mjs',
    errorMeters: 3,
    levels: buildMontsoreauRuntime,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.n0235_millennium_tower': {
    build: buildMillenniumSkyline,
    source: '../../worldgen/scripts/millennium-tower-model.mjs',
    errorMeters: 4,
    levels: buildMillenniumRuntime,
    surfaces: {
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      stainless: { slot: 'trim', graph: 'metal_stainless', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.n0234_barolo_palace': {
    build: buildBaroloSkyline,
    source: '../../worldgen/scripts/barolo-palace-model.mjs',
    errorMeters: 7,
    // Deliberate detail removal prevents disconnected trim from defeating mesh reduction.
    levels: buildBaroloRuntime,
    surfaces: {
      concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
      marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.78, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      clear_glass: { slot: 'window', roughness: 0.12, metallic: 0.05, opacity: 0.52 },
    },
  },
  'molen.worldgen.structure.n0233_china_world_trade_center_tower_iii': {
    build: buildChinaWorldSkyline,
    source: '../../worldgen/scripts/china-world-tower-model.mjs',
    errorMeters: 20,
  },
  'molen.worldgen.structure.n0232_gran_torre_costanera': {
    build: buildGranTorreSkyline,
    source: '../../worldgen/scripts/gran-torre-costanera-model.mjs',
    errorMeters: 20,
  },
  'molen.worldgen.structure.n0230_nina_tower': {
    build: buildNinaSkyline,
    source: '../../worldgen/scripts/nina-tower-model.mjs',
    // Conservative refinement allowance for omitted crown equipment and facade relief.
    errorMeters: 20,
  },
};
const common =
  (await text('./authored-landmark-lods.mjs')) +
  (await text('../../worldgen/scripts/authored-structure-mesh.mjs')) +
  (await text('../../worldgen/scripts/structure-mesh.mjs')) +
  (await text('../../worldgen/scripts/standard-materials.mjs'));
export async function landmarkLodRecipeHash(id) {
  return recipes[id]
    ? hash(baseRecipeHash + common + (await text(recipes[id].source)))
    : baseRecipeHash;
}

export async function authoredSkyline(id) {
  const recipe = recipes[id];
  if (!recipe) return undefined;
  const builder = new MeshBufferBuilder();
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (_slot, _ref, ...args) => builder[name]('wall', 'palette:#ffffff', ...args),
    ]),
  );
  recipe.build(mapped);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `${id}/authored-skyline`);
  const triangles = mesh.indices.length / 3;
  if (triangles > 1000)
    throw new Error(`${id}: authored skyline exceeds 1000 triangles (${triangles})`);
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
  const document = await io.readBinary(
    encodeGlb(mesh, [{ name: 'authored-skyline', roughness: 0.85, metallic: 0 }], id),
  );
  await document.transform(weld({ tolerance: 0 }), prune({ keepAttributes: true }));
  const bytes = Buffer.from(await io.writeBinary(document));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const geometryBytes = gltf.bufferViews.reduce((n, v) => n + v.byteLength, 0);
  return { bytes, triangles, geometryBytes, errorMeters: recipe.errorMeters, drawCalls: 1 };
}

/** Material-preserving authored runtime levels; source masters are never modified. */
export async function authoredDetail(id, level) {
  const recipe = recipes[id];
  if (!recipe?.levels) return undefined;
  if (!['district', 'street', 'closeup'].includes(level))
    throw new Error(`Unknown authored level ${level}`);
  const builder = new MeshBufferBuilder(),
    used = new Map();
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (component, _ref, points, normal, _uv, color) => {
        const s = recipe.surfaces[component];
        if (!s) throw new Error(`Unmapped authored surface ${component}`);
        const ref = s.graph
          ? `matgraph:molen.worldgen.material.${s.graph}`
          : component === 'clear_glass'
            ? 'palette:#feffff'
            : 'palette:#ffffff';
        used.set(`${s.slot}:${ref}`, s);
        const n = normalize(normal),
          u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
          v = normalize(cross(n, u));
        const repeat = s.graph ? MATERIAL_REPEAT_METERS[s.graph] : [1, 1];
        const uv = (p) => [
          p.reduce((sum, x, i) => sum + x * u[i], 0) / repeat[0],
          p.reduce((sum, x, i) => sum + x * v[i], 0) / repeat[1],
        ];
        builder[name](
          s.slot,
          ref,
          points,
          normal,
          name === 'addConvexPolygon' ? uv : points.map(uv),
          color,
        );
      },
    ]),
  );
  recipe.levels(mapped, level);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `${id}/${level}`);
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
  const document = await io.readBinary(
    encodeGlb(
      mesh,
      mesh.groups.map((group) => {
        const s = used.get(`${group.slot}:${group.materialRef}`);
        return {
          name: `${s.graph ?? group.materialRef}-${s.slot}`,
          roughness: s.roughness,
          metallic: s.metallic,
          ...(s.opacity
            ? { baseColorFactor: [1, 1, 1, s.opacity], alphaMode: 'BLEND', doubleSided: true }
            : {}),
          ...(s.graph
            ? { sharedSurface: { ref: group.materialRef, slot: s.slot, uv: 'repeats' } }
            : {}),
        };
      }),
      `${id}/${level}`,
    ),
  );
  await document.transform(weld({ tolerance: 0 }), prune({ keepAttributes: true }));
  const bytes = Buffer.from(await io.writeBinary(document));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  return {
    bytes,
    triangles: mesh.indices.length / 3,
    geometryBytes: gltf.bufferViews.reduce((n, v) => n + v.byteLength, 0),
    errorMeters: { district: 1.5, street: 0.5, closeup: 0.15 }[level],
    drawCalls: mesh.groups.length,
  };
}

export async function buildModelLandmarkLods(sidecarPath, options = {}) {
  const before = JSON.parse(await readFile(sidecarPath, 'utf8'));
  if (!recipes[before.id]) return buildLandmarkLods(sidecarPath, options);
  const directory = dirname(sidecarPath),
    recipeHash = await landmarkLodRecipeHash(before.id);
  if (hash(await readFile(join(directory, before.files.main))) !== before.hash)
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
          return hash(await readFile(join(directory, level.file))) === level.hash;
        } catch (error) {
          if (error.code === 'ENOENT') return false;
          throw error;
        }
      }),
    );
    if (current.every(Boolean)) return before.runtimeLods;
  }
  if (!recipes[before.id].levels) await buildLandmarkLods(sidecarPath, options);
  const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
  sidecar.runtimeLods ??= { recipe: 1, masterHash: sidecar.hash, levels: [] };
  sidecar.runtimeLods.masterHash = sidecar.hash;
  if (recipes[sidecar.id].levels) sidecar.runtimeLods.levels = [];
  const names = recipes[sidecar.id].levels
    ? ['skyline', 'district', 'street', 'closeup']
    : ['skyline'];
  for (const [index, name] of names.entries()) {
    const output =
        name === 'skyline'
          ? await authoredSkyline(sidecar.id)
          : await authoredDetail(sidecar.id, name),
      file = `model.${name}.glb`;
    await writeFile(join(directory, file), output.bytes);
    sidecar.files.variants ??= {};
    sidecar.files.variants[name] = file;
    sidecar.runtimeLods.levels[index] = {
      name,
      file,
      hash: hash(output.bytes),
      bytes: output.bytes.length,
      gzipBytes: gzipSync(output.bytes, { level: 6 }).length,
      triangles: output.triangles,
      cpuBytes: output.geometryBytes,
      gpuBytes: output.geometryBytes,
      errorMeters: output.errorMeters,
      drawCalls: output.drawCalls,
    };
  }
  sidecar.runtimeLods.recipeHash = recipeHash;
  await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  return sidecar.runtimeLods;
}
