/** Reproducible source-only authoring for the researched Willis Tower exterior. */

import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import {
  cross,
  normalize,
  smoothMeshNormals,
  validateAuthoredMesh,
} from './authored-structure-mesh.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';
import { willisStudies } from './willis-tower-model.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const check = process.argv.includes('--check');
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
for (const arg of process.argv.slice(2))
  if (arg !== '--check' && !arg.startsWith('--ids=')) throw new Error(`Unknown argument ${arg}`);
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const candidates = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/candidates.json'), 'utf8'),
).candidates;
const studies = willisStudies;
const surfaces = {
  clear_glass: {
    slot: 'window',
    roughness: 0.12,
    metallic: 0.05,
    opacity: 0.26,
    ref: 'palette:#feffff',
  },
  foliage: { slot: 'roof', roughness: 0.95, metallic: 0 },
  stone: { graph: 'stone_drywall', slot: 'wall', roughness: 0.95, metallic: 0, cylinder: true },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.92, metallic: 0, cylinder: true },
  lead: {
    graph: 'metal_standing_seam',
    slot: 'roof',
    roughness: 0.62,
    metallic: 0.78,
    cylinder: true,
  },
  gold: { slot: 'trim', roughness: 0.35, metallic: 0.9 },
  ashlar_round: {
    graph: 'stone_ashlar',
    slot: 'wall',
    roughness: 0.9,
    metallic: 0,
    cylinder: true,
  },
  ashlar: { graph: 'stone_ashlar', slot: 'wall', roughness: 0.9, metallic: 0 },
  granite: { graph: 'stone_granite', slot: 'trim', roughness: 0.88, metallic: 0 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.94, metallic: 0 },
  concrete: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.92, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.62, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', roughness: 0.24, metallic: 0.14 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.9, metallic: 0 },
  rubble: { graph: 'stone', slot: 'wall', roughness: 0.94, metallic: 0 },
  tiles: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.85, metallic: 0 },
};
function surfaceBuilder(builder, used) {
  const prepare = (component, normal, points) => {
    const surface = surfaces[component];
    if (!surface) throw new Error(`Unknown Willis tower surface ${component}`);
    const ref = surface.graph
      ? `matgraph:molen.worldgen.material.${surface.graph}`
      : (surface.ref ?? 'palette:#ffffff');
    used.set(`${surface.slot}:${ref}`, surface);
    const n = normalize(normal),
      u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
      v = normalize(cross(n, u));
    const repeat = surface.graph ? MATERIAL_REPEAT_METERS[surface.graph] : [1, 1];
    let uv = (p) => [
      p.reduce((s, x, i) => s + x * u[i], 0) / repeat[0],
      p.reduce((s, x, i) => s + x * v[i], 0) / repeat[1],
    ];
    const center = points.reduce((p, q) => [p[0] + q[0], 0, p[2] + q[2]], [0, 0, 0]);
    const radialDot =
      (n[0] * center[0] + n[2] * center[2]) /
      (Math.hypot(n[0], n[2]) * Math.hypot(center[0], center[2]) || 1);
    // Jambs point along the tangent: cylindrical U would collapse to one coordinate.
    if (surface.cylinder && Math.abs(n[1]) < 0.95 && radialDot > 0.95) {
      const start = Math.atan2(points[0][2], points[0][0]);
      uv = (p) => {
        let a = Math.atan2(p[2], p[0]);
        while (a - start > Math.PI) a -= 2 * Math.PI;
        while (a - start < -Math.PI) a += 2 * Math.PI;
        return [(a * Math.hypot(points[0][0], points[0][2])) / repeat[0], p[1] / repeat[1]];
      };
    }
    return { surface, ref, uv };
  };
  return {
    addQuad(component, _ref, p, n, _uv, color) {
      const i = prepare(component, n, p);
      const repeats = i.surface.graph ? MATERIAL_REPEAT_METERS[i.surface.graph] : [1, 1];
      const uv =
        _ref === 'metric:uv' ? _uv.map((v) => [v[0] / repeats[0], v[1] / repeats[1]]) : p.map(i.uv);
      builder.addQuad(i.surface.slot, i.ref, p, n, uv, color);
    },
    addTriangle(component, _ref, p, n, _uv, color) {
      const i = prepare(component, n, p);
      builder.addTriangle(i.surface.slot, i.ref, p, n, p.map(i.uv), color);
    },
    addConvexPolygon(component, _ref, p, n, _uv, color) {
      const i = prepare(component, n, p);
      builder.addConvexPolygon(i.surface.slot, i.ref, p, n, i.uv, color);
    },
  };
}
async function emit(path, bytes) {
  let previous;
  try {
    previous = await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (check) {
    if (
      !previous ||
      (!previous.equals(bytes) &&
        previous.toString('utf8').replaceAll('\r\n', '\n') !== bytes.toString('utf8'))
    )
      throw new Error(`${path}: stale or missing source`);
    return;
  }
  if (previous?.equals(bytes)) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}
for (const id of selected ?? [])
  if (!studies.some((study) => study.id === id)) throw new Error(`Unknown Willis tower id ${id}`);
for (const asset of studies.filter((study) => !selected || selected.includes(study.id))) {
  if (candidates.find((candidate) => candidate.id === asset.id)?.wikidataId !== asset.wikidataId)
    throw new Error(`${asset.id}: catalog identity changed`);
  const key = `${asset.id.toLowerCase()}_${asset.key}`,
    assetId = `molen.worldgen.structure.${key}`,
    dir = structureSourceDirectory(key),
    modelPath = resolve(dir, 'models/source.glb');
  try {
    const source = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
    if (hash(await readFile(modelPath)) !== source.files.models[0].sha256)
      throw new Error(
        `${asset.id}: source master differs from generator baseline; preserve artist edits before regenerating`,
      );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const out = new MeshBufferBuilder(),
    used = new Map();
  asset.build(surfaceBuilder(out, used));
  const mesh = out.finalize();
  smoothMeshNormals(mesh, ['trim', 'foundation'], 32);
  validateAuthoredMesh(mesh, asset.id);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], mesh.positions[i]);
    max[i % 3] = Math.max(max[i % 3], mesh.positions[i]);
  }
  const materials = mesh.groups.map((group) => {
    const material = used.get(`${group.slot}:${group.materialRef}`);
    if (!material) throw new Error(`Unknown GLB surface ${JSON.stringify(group)}`);
    return {
      name:
        material.graph ??
        (material.slot === 'window' ? 'bronze-and-clear-glazing' : 'roof-planting'),
      roughness: material.roughness,
      metallic: material.metallic,
      ...(material.opacity !== undefined
        ? { baseColorFactor: [1, 1, 1, material.opacity], alphaMode: 'BLEND', doubleSided: true }
        : {}),
      ...(material.graph
        ? { sharedSurface: { ref: group.materialRef, slot: material.slot, uv: 'repeats' } }
        : {}),
    };
  });
  const glb = Buffer.from(encodeGlb(mesh, materials, `Molen original ${asset.title}`));
  const { build, ...data } = asset;
  const spec = {
    ...data,
    assetId,
    category: 'skyscraper',
    quality: 'detailed',
    actualBounds: { min, max },
    geometrySource:
      'Original component-authored exterior mesh using cited dimensional evidence and separately described photo/map reconstructions. No downloaded mesh, texture or reference image is embedded.',
    sourceLicense:
      'Original geometry under the repository license. Cited sources retain their own rights; OSM-derived axes/footprint evidence © OpenStreetMap contributors, ODbL 1.0.',
    materialMethod:
      'Shared canonical material graphs with metric UV repeats in extras.molenSurface; portable glTF PBR factors and vertex colors remain. Dark recesses/lantern panels retain local fallback materials.',
    sharedSurfaces: materials
      .filter((material) => material.sharedSurface)
      .map((material) => ({
        ref: material.sharedSurface.ref,
        slot: material.sharedSurface.slot,
        repeatMeters: MATERIAL_REPEAT_METERS[material.name],
      })),
    reviewStatus:
      'Source geometry ready; fallback/shared renders, maximum fidelity and geographic fit require separate review.',
    importOptions: { optimize: false },
    importReason:
      'Keep thin gallery rails, lightning conductors, window reveals and small anchors until a measured LOD chain is reviewed.',
  };
  const h = max[1],
    extent = Math.max(max[0] - min[0], h, max[2] - min[2]);
  const scene = {
    format: 'molen/scene@3',
    name: `${asset.title} asset preview`,
    seed: key,
    tickRate: 30,
    entities: [
      {
        id: 'structure',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          // Keep the full-height preview free of broad shadow-map acne; the ground still receives its cast shadow.
          renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: false } },
        },
      },
      {
        id: 'ground',
        components: {
          transform: {
            pos: [0, -0.14, 0],
            rot: [0, 0, 0, 1],
            scale: [extent * 1.6, 0.2, extent * 1.6],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#858878',
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'environment',
        components: {
          environment: {
            ambient: { sky: '#dce5ed', ground: '#6c7473', intensity: 1.15 },
            sun: { direction: [-8, 14, 9], color: '#fff1d3', intensity: 2.2, castShadow: true },
            background: '#b5d2df',
            toneMapping: 'agx',
            exposure: 1.08,
            shadows: 'high',
          },
        },
      },
    ],
    camera: {
      mode: 'fixed',
      position: [extent * 0.68, h * 0.64, extent * 1.2],
      lookAt: [0, h * 0.47, 0],
      fov: 38,
    },
    physics: { engine: 'none' },
  };
  const optional = (
    await readdir(dir).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    })
  )
    .filter((name) =>
      [
        'import-report.json',
        'capture-report.json',
        'shared-capture-report.json',
        'placement-report.json',
        'qa.json',
        'map-evidence.json',
      ].includes(name),
    )
    .sort();
  const source = {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: asset.title,
    files: {
      definitions: ['spec.json', 'scene.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId,
          output: structureAssetSidecarPath(assetId),
          pipeline: 'import',
          sha256: hash(glb),
        },
      ],
      generators: [],
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['README.md', 'preview.png', ...optional],
    },
  };
  const readme = `# ${asset.title} — ${asset.id}\n\n![Lit Molen preview](preview.png)\n\n${asset.visualBrief}\n\n## Identity and evidence\n\nExact catalog identity **${asset.wikidataId}**. Source facts: \`${JSON.stringify(asset.sourceFacts)}\`. The source specification keeps published dimensions separate from reconstructed details.\n\n${asset.referencePages.map((url) => `- ${url}`).join('\n')}\n\n${asset.referenceRights}\n\n## Authored geometry and materials\n\n${mesh.triangleCount.toLocaleString('en-US')} triangles, ${mesh.vertexCount.toLocaleString('en-US')} vertices, ${mesh.groups.length} surface groups; ${glb.length.toLocaleString('en-US')} source bytes. SHA-256: \`${hash(glb)}\`. Actual bounds: ${min.map((n) => n.toFixed(3)).join(', ')} to ${max.map((n) => n.toFixed(3)).join(', ')} m.\n\n${spec.materialMethod} Shared references: ${spec.sharedSurfaces.map((surface) => `\`${surface.ref}\` (${surface.repeatMeters.join(' × ')} m)`).join(', ')}. Model-native axes: ${JSON.stringify(asset.nativeAxes)}.\n\n## Placement proposal\n\n${asset.geographicProposal.notes} Proposed anchor ${asset.geographicProposal.anchor.join(', ')} (longitude, latitude), heading ${asset.geographicProposal.heading} radians. Elevation policy: **${asset.geographicProposal.elevationMode}**. This is a reviewable proposal, not a completed site-fit certification. The tower uses terrain contact at its outside paving grade.\n\n## Limitations and review\n\n${asset.limitations.map((note) => `- ${note}`).join('\n')}\n\nNear/far fixtures are in \`spec.qaCameras\`. Float32 finite geometry, triangle degeneracy and winding are checked by the generator. Rendering, shared-material alignment, maximum-fidelity and geographic reviews remain pending until their hash-bound reports exist.\n\nRegenerate with \`node packages/worldgen/scripts/generate-willis-tower.mjs --ids=${asset.id}\`; add \`--check\` for reproducibility. Editable component recipes are in \`packages/worldgen/scripts/willis-tower-model.mjs\`. The generator protects artist-edited master hashes and preserves import/capture/shared-capture/QA documents.\n`;
  await emit(modelPath, glb);
  for (const [name, value] of [
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
  ])
    await emit(resolve(dir, name), Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(
    `${asset.id} ${assetId}: ${mesh.triangleCount} triangles, ${glb.length} bytes; bounds ${JSON.stringify({ min, max })}`,
  );
}
