/** Author genuine reusable map-feature models through the same GLB source contract. */

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
import { biomeJson } from './format-json.mjs';
import { mapStructures } from './map-structure-models.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const sourceRoot = resolve(root, 'content/worldgen/source/map-structures');
const check = process.argv.includes('--check');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function surfacesFor(asset) {
  return {
    brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0, projection: 'courses' },
    smock: {
      graph: 'wood_painted_lap',
      slot: 'wall',
      roughness: 0.7,
      metallic: 0,
      projection: 'courses',
    },
    timber: {
      graph: 'wood_plain',
      slot: 'trim',
      roughness: 0.8,
      metallic: 0,
      projection: 'long-edge',
    },
    roof: { graph: 'wood_painted_shingle', slot: 'roof', roughness: 0.79, metallic: 0 },
    canvas: {
      graph: 'fabric_canvas',
      slot: 'roof',
      roughness: 0.96,
      metallic: 0,
      projection: 'long-edge',
    },
    wall: { graph: 'metal_painted', slot: 'wall', roughness: 0.42, metallic: 0.05 },
    foundation: {
      graph: asset.id === 'map_smock_windmill' ? 'stone_granite' : 'concrete_plain',
      slot: 'foundation',
      roughness: 0.9,
      metallic: 0,
    },
    trim: { graph: 'metal_painted', slot: 'trim', roughness: 0.56, metallic: 0.14 },
    window: { slot: 'window', roughness: 0.23, metallic: 0.14 },
  };
}

/** UVs are measured in meters on each face, then divided by the central catalog repeat.
 * A local basis follows each timber's long edge; facade courses share global Y so
 * brick and lap rows stay level through their geometric panels. No texture is copied. */
function metricProjection(points, faceNormal, surface) {
  const n = normalize(faceNormal);
  let u;
  if (surface.projection === 'long-edge') {
    const edges = points.map((point, i) =>
      points[(i + 1) % points.length].map((v, axis) => v - point[axis]),
    );
    const lengthSquared = ([x, y, z]) => x * x + y * y + z * z;
    u = normalize(
      edges.reduce((best, edge) => (lengthSquared(edge) > lengthSquared(best) ? edge : best)),
    );
  } else {
    u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0];
  }
  const v = normalize(cross(n, u));
  const repeat = MATERIAL_REPEAT_METERS[surface.graph];
  if (!repeat || repeat.some((n) => !Number.isFinite(n) || n <= 0))
    throw new Error(`Missing shared repeat for ${surface.graph}`);
  return (point) => [
    point.reduce((sum, value, axis) => sum + value * u[axis], 0) / repeat[0],
    (surface.projection === 'courses' && Math.abs(n[1]) < 0.98
      ? point[1]
      : point.reduce((sum, value, axis) => sum + value * v[axis], 0)) / repeat[1],
  ];
}

/** Semantic component names become legal mesh slots plus distinct shared references. */
function surfaceBuilder(builder, definitions, used) {
  const prepare = (component, points, normal, fallbackUv) => {
    const surface = definitions[component];
    if (!surface) throw new Error(`Unassigned model surface: ${component}`);
    const ref = surface.graph
      ? `matgraph:molen.worldgen.material.${surface.graph}`
      : 'palette:#ffffff';
    used.set(`${surface.slot}:${ref}`, surface);
    return {
      surface,
      ref,
      uv: surface.graph ? metricProjection(points, normal, surface) : fallbackUv,
    };
  };
  return {
    addQuad(component, _ref, points, normal, uv, color) {
      const item = prepare(component, points, normal, (point) => uv[points.indexOf(point)]);
      builder.addQuad(item.surface.slot, item.ref, points, normal, points.map(item.uv), color);
    },
    addTriangle(component, _ref, points, normal, uv, color) {
      const item = prepare(component, points, normal, (point) => uv[points.indexOf(point)]);
      builder.addTriangle(item.surface.slot, item.ref, points, normal, points.map(item.uv), color);
    },
    addConvexPolygon(component, _ref, points, normal, uvOf, color) {
      const item = prepare(component, points, normal, uvOf);
      builder.addConvexPolygon(item.surface.slot, item.ref, points, normal, item.uv, color);
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
      throw new Error(`${path}: stale or missing generated source`);
    return;
  }
  if (previous?.equals(bytes)) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}

for (const asset of mapStructures) {
  const assetId = `molen.worldgen.structure.${asset.id}`;
  const dir = resolve(sourceRoot, asset.id);
  const modelPath = resolve(dir, 'models/source.glb');
  // Protect an artist's modified source master before regeneration.
  try {
    const manifest = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
    const current = await readFile(modelPath);
    if (hash(current) !== manifest.files.models[0].sha256)
      throw new Error(
        `${asset.id}: artist-edited master differs from generator baseline; preserve it before regenerating`,
      );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const out = new MeshBufferBuilder();
  const definitions = surfacesFor(asset),
    used = new Map();
  asset.build(surfaceBuilder(out, definitions, used));
  const mesh = out.finalize();
  if (asset.id === 'map_wind_turbine') smoothMeshNormals(mesh, ['wall'], 38);
  validateAuthoredMesh(mesh, asset.id);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    const n = mesh.positions[i],
      axis = i % 3;
    if (!Number.isFinite(n)) throw new Error(`${asset.id}: non-finite mesh coordinate`);
    min[axis] = Math.min(min[axis], n);
    max[axis] = Math.max(max[axis], n);
  }
  const glb = Buffer.from(
    encodeGlb(
      mesh,
      mesh.groups.map((group) => {
        const surface = used.get(`${group.slot}:${group.materialRef}`);
        if (!surface) throw new Error(`Missing surface metadata for ${group.materialRef}`);
        return {
          name: `${surface.graph ?? 'glazing'}-${surface.slot}`,
          roughness: surface.roughness,
          metallic: surface.metallic,
          ...(surface.graph
            ? { sharedSurface: { ref: group.materialRef, slot: surface.slot, uv: 'repeats' } }
            : {}),
        };
      }),
      `Molen original ${asset.id}`,
    ),
  );
  // An old dist encoder would silently omit these opt-in references. Fail before
  // writing the source master instead of issuing a misleading shared-texture asset.
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  for (const [index, group] of mesh.groups.entries()) {
    if (
      group.materialRef.startsWith('matgraph:') &&
      gltf.materials[index]?.extras?.molenSurface?.ref !== group.materialRef
    )
      throw new Error(
        `${asset.id}: shared surface metadata missing; build @bendyline/molen-worldgen before generation`,
      );
  }
  const spec = {
    id: asset.id,
    assetId,
    title: asset.title,
    category: asset.class,
    quality: 'detailed',
    visualBrief: asset.brief,
    size: asset.size,
    actualBounds: { min, max },
    nativeAxes: {
      up: '+Y',
      front: asset.frontAxis,
      origin: 'Tower base at ground level; rotor axis points toward +Z',
    },
    scaleBasis: asset.scaleBasis,
    referencePages: asset.refs,
    geometrySource:
      'Original deterministic Molen mesh; reference publications inform construction systems and dimensions only. No third-party mesh or image is embedded.',
    sourceLicense:
      'Original geometry under repository license; reference links retain their own rights.',
    materialMethod:
      'Shared material-graph references in GLB material extras with metric repeat UVs; original vertex colors supply tints. Standalone GLB keeps portable PBR fallback materials. Textures are resolved from the shared library and are not duplicated per model.',
    sharedSurfaces: [...used.values()]
      .filter((surface) => surface.graph)
      .map((surface) => ({
        ref: `matgraph:molen.worldgen.material.${surface.graph}`,
        slot: surface.slot,
        uv: 'repeats',
        repeatMeters: MATERIAL_REPEAT_METERS[surface.graph],
        projection: surface.projection ?? 'face-tangent',
      })),
    animation: 'Static rotor pose; no animation clips.',
    limitations: [
      asset.limits,
      'Visual QA and site-specific orientation/height checking are required. This source has not been certified as a maximum-fidelity finished replica.',
    ],
    reviewStatus: 'source-geometry; visual verification required',
    importOptions: { optimize: false },
    importReason:
      'Preserve small sail lattice, bolts and service fittings until a measured LOD chain is authored.',
    qaCameras:
      asset.id === 'map_smock_windmill'
        ? [
            { name: 'near-sails', position: [12, 20, 25], lookAt: [0, 19, 3] },
            { name: 'near-gallery', position: [15, 8, 17], lookAt: [0, 8, 0] },
            { name: 'far-silhouette', position: [44, 24, 61], lookAt: [0, 14, 0] },
          ]
        : [
            { name: 'near-nacelle', position: [18, 98, 28], lookAt: [0, 90, 0] },
            { name: 'near-tower', position: [10, 5, 15], lookAt: [0, 3, 0] },
            { name: 'far-silhouette', position: [130, 95, 240], lookAt: [0, 76, 0] },
          ],
  };
  const h = max[1],
    extent = Math.max(max[0] - min[0], h, max[2] - min[2]);
  const scene = {
    format: 'molen/scene@3',
    name: `${asset.title} asset preview`,
    seed: asset.id,
    tickRate: 30,
    entities: [
      {
        id: 'structure',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
        },
      },
      {
        id: 'ground',
        components: {
          transform: {
            pos: [0, -0.15, 0],
            rot: [0, 0, 0, 1],
            scale: [extent * 1.3, 0.2, extent * 1.3],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#777b72',
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
      position: [extent * 0.55, h * 0.65, extent * 1.9],
      lookAt: [0, h * 0.48, 0],
      fov: 38,
    },
    physics: { engine: 'none' },
  };
  const optionalReports = (
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
        'qa.json',
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
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['README.md', 'preview.png', ...optionalReports],
    },
  };
  const readme = `# ${asset.title}\n\n![Lit Molen preview](preview.png)\n\n${asset.brief}\n\n## Identity and scale\n\nThis is a reusable **${asset.class} category** model, not a named landmark. ${asset.scaleBasis} Front/rotor axis is +Z, up is +Y and ground base is Y=0. Native declared envelope: ${asset.size.join(' × ')} m. Actual static AABB: ${min.map((n) => n.toFixed(3)).join(', ')} to ${max.map((n) => n.toFixed(3)).join(', ')}.\n\n## Source and materials\n\nOriginal deterministic geometry from \`packages/worldgen/scripts/map-structure-models.mjs\`; no downloaded mesh, trademark or photographic texture. ${spec.materialMethod} References: ${asset.refs.map((url) => `[source](${url})`).join(', ')}. Reference documents inform the model and are not redistributed.\n\n${mesh.triangleCount.toLocaleString('en-US')} source triangles, ${mesh.vertexCount.toLocaleString('en-US')} vertices, ${mesh.groups.length} material groups, ${glb.length.toLocaleString('en-US')} bytes. Source SHA-256: \`${hash(glb)}\`.\n\nRegenerate with \`node packages/worldgen/scripts/generate-map-structures.mjs\`; verify reproducibility with \`--check\`. Import through \`import-next-1000-models.mjs\` or the normal \`molen asset import\` workflow with \`--no-optimize\`. Runtime asset: \`${assetId}\`. The generator refuses to overwrite a GLB whose hash differs from its source manifest.\n\n## Remaining limitations\n\n${asset.limits}\n\nThe source scene and near/far camera fixtures support visual review. A valid GLB is not evidence of visual acceptance; see the capture report for inspected views.\n`;
  await emit(modelPath, glb);
  for (const [name, data] of [
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
  ])
    await emit(resolve(dir, name), Buffer.from(biomeJson(data, resolve(dir, name))));
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(
    `${asset.id}: ${mesh.triangleCount} triangles, ${glb.length} bytes; bounds ${JSON.stringify({ min, max })}`,
  );
}
