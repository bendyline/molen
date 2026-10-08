/** Author three independent tower source bundles; no runtime/catalog mutation. */

import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { encodeAuthoredAssembly } from './authored-glb-assembly.mjs';
import {
  cross,
  normalize,
  smoothMeshNormals,
  validateAuthoredMesh,
} from './authored-structure-mesh.mjs';
import { embedGraphFallbacks } from './embed-graph-fallbacks.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { signatureTowers } from './signature-tower-models.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import {
  collectionMember,
  readStructureCollections,
  selectedStructureIds,
} from './structure-collections.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const check = process.argv.includes('--check');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const catalog = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/candidates.json'), 'utf8'),
);
const collections = await readStructureCollections(
  resolve(root, 'content/worldgen/source/next-1000/collections.json'),
  catalog.candidates,
);
const expandedSelection = selectedStructureIds(selection, collections);
const evidenceBytes = await readFile(resolve(root, 'content/earth/structures/georeferencing.json'));
const evidence = JSON.parse(evidenceBytes);
const surfaces = {
  rubble: { graph: 'stone_drywall', slot: 'wall', roughness: 0.94, metallic: 0 },
  aggregate: { graph: 'gravel', slot: 'foundation', roughness: 0.98, metallic: 0 },
  frit: { graph: 'glass_frit_triangular', slot: 'wall', roughness: 0.2, metallic: 0 },
  fcp_vision: { slot: 'window', roughness: 0.16, metallic: 0.08, ref: 'palette:#fffefd' },
  bronze_glass: { slot: 'window', roughness: 0.17, metallic: 0.05, ref: 'palette:#fffefe' },
  gold: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  bronze: { graph: 'metal_bronze_cast', slot: 'trim', roughness: 0.65, metallic: 0.7 },
  screen: { graph: 'metal_perforated_round_open', slot: 'wall', roughness: 0.5, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  pink: { graph: 'metal_painted', slot: 'wall', roughness: 0.5, metallic: 0.12 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  travertine: { graph: 'stone_travertine', slot: 'wall', roughness: 0.82, metallic: 0 },
  marble: { graph: 'stone_marble', slot: 'wall', roughness: 0.78, metallic: 0 },
  foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.88, metallic: 0 },
  tile: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.88, metallic: 0 },
  canvas: { graph: 'fabric_canvas', slot: 'roof', roughness: 0.92, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  shingle: { graph: 'shingle_cedar', slot: 'roof', roughness: 0.9, metallic: 0 },
  sandstone: { graph: 'stone_sandstone', slot: 'wall', roughness: 0.85, metallic: 0 },
  basalt: { graph: 'stone_basalt', slot: 'wall', roughness: 0.94, metallic: 0 },
  weathered: {
    graph: 'stone_limestone_weathered',
    slot: 'foundation',
    roughness: 0.9,
    metallic: 0,
  },
  copper: { graph: 'metal_copper', slot: 'roof', roughness: 0.5, metallic: 0.85 },
  // Oxidized copper uses the same shared panels with a mostly dielectric surface.
  patina: { graph: 'metal_copper', slot: 'roof', roughness: 0.8, metallic: 0.05 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  clear_glass: {
    slot: 'window',
    roughness: 0.12,
    metallic: 0.05,
    opacity: 0.52,
    ref: 'palette:#feffff',
  },
  recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
};

function mappedBuilder(builder, used) {
  const prepare = (component, normal) => {
    const surface = surfaces[component];
    if (!surface) throw new Error(`Unmapped component ${component}`);
    const ref = surface.graph
      ? `matgraph:molen.worldgen.material.${surface.graph}`
      : (surface.ref ?? 'palette:#ffffff');
    used.set(`${surface.slot}:${ref}`, surface);
    const n = normalize(normal);
    const u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0];
    const v = normalize(cross(n, u));
    const repeat = surface.graph ? MATERIAL_REPEAT_METERS[surface.graph] : [1, 1];
    if (!repeat) throw new Error(`Missing central repeat for ${surface.graph}`);
    const uv = (p) => [
      p.reduce((s, n, i) => s + n * u[i], 0) / repeat[0],
      p.reduce((s, n, i) => s + n * v[i], 0) / repeat[1],
    ];
    return { surface, ref, uv };
  };
  return {
    addQuad(component, _ref, points, normal, _uv, color) {
      const { surface, ref, uv } = prepare(component, normal);
      builder.addQuad(surface.slot, ref, points, normal, points.map(uv), color);
    },
    addTriangle(component, _ref, points, normal, _uv, color) {
      const { surface, ref, uv } = prepare(component, normal);
      builder.addTriangle(surface.slot, ref, points, normal, points.map(uv), color);
    },
    addConvexPolygon(component, _ref, points, normal, _uv, color) {
      const { surface, ref, uv } = prepare(component, normal);
      builder.addConvexPolygon(surface.slot, ref, points, normal, uv, color);
    },
  };
}

async function emit(path, bytes) {
  let current;
  try {
    current = await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (check) {
    if (
      !current ||
      (!current.equals(bytes) &&
        current.toString('utf8').replaceAll('\r\n', '\n') !== bytes.toString('utf8'))
    )
      throw new Error(`${path}: generated source missing or stale`);
    return;
  }
  if (current?.equals(bytes)) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}

function circleCenter(a, b, c) {
  const aa = a[0] ** 2 + a[1] ** 2,
    bb = b[0] ** 2 + b[1] ** 2,
    cc = c[0] ** 2 + c[1] ** 2;
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  return [
    (aa * (b[1] - c[1]) + bb * (c[1] - a[1]) + cc * (a[1] - b[1])) / d,
    (aa * (c[0] - b[0]) + bb * (a[0] - c[0]) + cc * (b[0] - a[0])) / d,
  ];
}

function geographicProposal(study, mapped) {
  const proposal = {
    status: 'preview-proposal',
    reviewStatus: 'orientation-approximation; real-world visual fit pending',
    anchor: mapped.anchor,
    heading: mapped.heading,
    ground: 'terrain',
    elevationMode: 'terrain-contact',
    source: mapped.featureSources[0],
    groundModelY: 0,
    featureIds: mapped.featureIds,
    wikidataId: study.wikidataId,
    mapGeometrySource: mapped.sourceLocalFrame
      ? 'map-frame.json'
      : 'content/earth/structures/georeferencing.json',
    mapGeometryHash: mapped.sourceLocalFrame?.hash ?? hashEvidenceText(evidenceBytes),
    mapGeometryLicense: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
  };
  if (study.id === 'N0140') {
    proposal.heading += Math.PI / 4;
    proposal.notes =
      'Native X follows one diagonal of the exact-QID square footprint. Heading adds 45 degrees to the cached square frame. Opposite diagonal differs by 90 degrees; chosen roof axis is explicitly provisional pending roof/imagery evidence. Native 58 m structural side is not stretched to the 60 m map envelope.';
  } else if (study.id === 'N0141') {
    proposal.notes =
      'Authored body, apex offset and eastern podium use the cached local footprint coordinates, so its signed frame is retained. The tower center is not the outer-envelope bounding-box center. Eight reconstructed facade planes require visual site-fit verification.';
  } else if (study.id === 'N0144') {
    const outline = mapped.geometry.outline;
    const samples = [
      [24.318, 17.451],
      [3.217, 38.832],
      [-18.525, 30.514],
    ].map((target) => {
      const p = outline.find(
        (p) => Math.abs(p[0] - target[0]) < 0.002 && Math.abs(p[1] - target[1]) < 0.002,
      );
      if (!p) throw new Error('Oriental Pearl map circle evidence changed; review center fitting');
      return p;
    });
    const [x, z] = circleCenter(...samples);
    const east = x * Math.cos(mapped.heading) + z * Math.sin(mapped.heading);
    const south = -x * Math.sin(mapped.heading) + z * Math.cos(mapped.heading);
    const [longitude, latitude] = mapped.anchor;
    proposal.anchor = [
      longitude + east / (111319.49079327358 * Math.cos((latitude * Math.PI) / 180)),
      latitude - south / 111319.49079327358,
    ];
    proposal.mapFrameTowerCenterXZ = [x, z];
    proposal.heading += -Math.atan2(2.1 - x, 40.5 + z);
    proposal.notes =
      'Ground anchor shifted from outer-envelope center to circle center fitted from three points on the mapped central projection. Native -Z points toward the opposite radial arm, adjusted from its mapped end center near [2.1,-40.5]. This is map-derived registration, not a survey; buttress radius and ground plaza remain reconstructed.';
  }
  if (study.geographic) Object.assign(proposal, study.geographic(mapped));
  return proposal;
}

for (const study of signatureTowers.filter(
  (study) => !expandedSelection || expandedSelection.includes(study.id),
)) {
  const member = collectionMember(collections, study.id);
  const candidate = member ?? catalog.candidates.find((entry) => entry.id === study.id);
  let mapped = evidence.candidates.find((entry) => entry.candidateId === study.id);
  if (
    candidate?.wikidataId !== study.wikidataId ||
    (!member && mapped?.wikidataId !== study.wikidataId)
  )
    throw new Error(`${study.id}: exact geographic identity changed`);
  if (member && study.mapFrame !== 'map-frame.json')
    throw new Error(
      `${study.id}: independent collection member needs its own attributed map frame`,
    );
  const key = member?.sourceKey ?? `${study.id.toLowerCase()}_${study.key}`;
  const assetId = `molen.worldgen.structure.${key}`;
  const dir = structureSourceDirectory(key);
  if (study.mapFrame) {
    if (study.mapFrame !== 'map-frame.json')
      throw new Error(`${study.id}: source-local map frame must use map-frame.json`);
    const bytes = await readFile(resolve(dir, study.mapFrame)),
      frame = JSON.parse(bytes);
    if (member && frame.wikidataId !== member.wikidataId)
      throw new Error(`${study.id}: source-local frame has a different member identity`);
    if (
      !frame.anchor?.every(Number.isFinite) ||
      !Number.isFinite(frame.heading) ||
      !frame.geometry?.outline?.length ||
      !frame.sourceUrl
    )
      throw new Error(`${study.id}: incomplete source-local geographic frame`);
    mapped = {
      ...mapped,
      ...frame,
      featureSources: [frame.sourceUrl],
      featureIds: frame.elements.map((p) => `${p.type}/${p.id}`),
      sourceLocalFrame: { hash: hashEvidenceText(bytes), identityStatus: frame.identityStatus },
    };
  }
  const modelPath = resolve(dir, 'models/source.glb');
  let priorDocuments = [];
  try {
    const source = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
    priorDocuments = source.files.documents ?? [];
    if (hash(await readFile(modelPath)) !== source.files.models[0].sha256)
      throw new Error(
        `${study.id}: artist-edited source differs from its baseline; preserve before regeneration`,
      );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const out = new MeshBufferBuilder(),
    used = new Map();
  study.build(mappedBuilder(out, used), mapped);
  const mesh = out.finalize();
  if (study.id === 'N0144') smoothMeshNormals(mesh, ['wall'], 30);
  if (study.smoothSlots) smoothMeshNormals(mesh, study.smoothSlots, 30);
  validateAuthoredMesh(mesh, study.id);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], mesh.positions[i]);
    max[i % 3] = Math.max(max[i % 3], mesh.positions[i]);
  }
  const encoded = Buffer.from(
    study.encodeAssembly
      ? study.encodeAssembly((build, name) => {
          const partBuilder = new MeshBufferBuilder(),
            partUsed = new Map();
          build(mappedBuilder(partBuilder, partUsed));
          const partMesh = partBuilder.finalize();
          validateAuthoredMesh(partMesh, `${study.id}/${name}`);
          return encodeGlb(
            partMesh,
            partMesh.groups.map((group) => {
              const s = partUsed.get(`${group.slot}:${group.materialRef}`);
              return {
                name: `${s.graph ?? group.slot}-${group.slot}`,
                roughness: s.roughness,
                metallic: s.metallic,
                ...(s.opacity !== undefined
                  ? { baseColorFactor: [1, 1, 1, s.opacity], alphaMode: 'BLEND', doubleSided: true }
                  : {}),
                ...(s.graph
                  ? { sharedSurface: { ref: group.materialRef, slot: s.slot, uv: 'repeats' } }
                  : {}),
              };
            }),
            name,
          );
        }, encodeAuthoredAssembly)
      : encodeGlb(
          mesh,
          mesh.groups.map((group) => {
            const s = used.get(`${group.slot}:${group.materialRef}`);
            return {
              name: `${s.graph ?? group.slot}-${group.slot}`,
              roughness: s.roughness,
              metallic: s.metallic,
              ...(s.opacity !== undefined
                ? { baseColorFactor: [1, 1, 1, s.opacity], alphaMode: 'BLEND', doubleSided: true }
                : {}),
              ...(s.graph
                ? { sharedSurface: { ref: group.materialRef, slot: s.slot, uv: 'repeats' } }
                : {}),
            };
          }),
          `Molen original ${study.title}`,
        ),
  );
  const glb = await embedGraphFallbacks(
    encoded,
    (study.embeddedCanonicalGraphs ?? []).map((name) => ({
      ref: `matgraph:molen.worldgen.material.${name}`,
      graphPath: resolve(root, `content/worldgen/materials/${name}.matgraph.json`),
    })),
    root,
  );
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  for (const group of mesh.groups)
    if (
      group.materialRef.startsWith('matgraph:') &&
      !gltf.materials.some((material) => material.extras?.molenSurface?.ref === group.materialRef)
    )
      throw new Error(
        'Built GLB encoder lacks shared-surface metadata; build worldgen before authoring',
      );
  const size = max.map((v, i) => v - min[i]);
  const spec = {
    planId: study.id,
    id: study.id,
    ...(member
      ? { collectionId: collections.find((entry) => entry.members.includes(member)).id }
      : {}),
    assetId,
    title: study.title,
    category: study.category ?? 'skyscraper',
    quality: 'detailed',
    wikidataId: study.wikidataId,
    referenceCoordinate: candidate.referenceCoordinate,
    visualBrief: study.brief,
    ...(study.mediumFiContext ? { mediumFiContext: study.mediumFiContext } : {}),
    size,
    actualBounds: { min, max },
    ...(study.encodeAssembly
      ? {
          assembly: {
            uniqueMeshes: gltf.meshes.length,
            meshInstances: gltf.nodes.reduce((n, node) => {
              const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
              return n + (attributes ? gltf.accessors[Object.values(attributes)[0]].count : 1);
            }, 0),
            storedTriangles: gltf.meshes.reduce(
              (n, m) =>
                n + m.primitives.reduce((s, p) => s + gltf.accessors[p.indices].count / 3, 0),
              0,
            ),
            method:
              'Repeated facade geometry uses EXT_mesh_gpu_instancing; canonical shared surfaces contain no embedded bitmap copies.',
          },
        }
      : {}),
    nativeAxes: study.nativeAxes,
    sourceFacts: study.sourceFacts,
    ...(study.appearance ? { appearance: study.appearance } : {}),
    reconstruction: study.reconstruction,
    referencePages: study.refs,
    geographicProposal: geographicProposal(study, mapped),
    scaleBasis:
      study.scaleBasis ??
      'Published owner/architect/contractor heights and distinguishing construction systems; map footprint for local orientation, with reconstructed details declared separately.',
    geometrySource:
      study.geometrySource ??
      'Original deterministic exterior geometry; no downloaded meshes or copied photographic textures. Footprint-derived registration includes separately attributed OpenStreetMap evidence.',
    sourceLicense:
      study.sourceLicense ??
      'Original reconstruction under repository license. Map-derived plan evidence: © OpenStreetMap contributors, ODbL-1.0. Reference publications are linked, not redistributed.',
    ...(study.dataAttribution ? { dataAttribution: study.dataAttribution } : {}),
    materialMethod: study.embeddedCanonicalGraphs?.length
      ? 'Canonical shared graphs use metric UVs and vertex tint through molenSurface extras. Opted-in alpha screens embed a portable fallback baked from the same canonical graph; the world viewer replaces this copy with the shared texture. Transparent guards retain local PBR alpha.'
      : 'Canonical shared material graphs bound through molenSurface extras with metric coordinates divided by central repeat meters. Vertex colors provide component tint. Glass retains opaque metallic-roughness PBR; no bitmap texture copies per model.',
    sharedSurfaces: [...used.entries()]
      .filter(([, s]) => s.graph)
      .map(([, s]) => ({
        ref: `matgraph:molen.worldgen.material.${s.graph}`,
        slot: s.slot,
        uv: 'repeats',
        repeatMeters: MATERIAL_REPEAT_METERS[s.graph],
      })),
    ...(study.embeddedCanonicalGraphs?.length
      ? { portableCanonicalFallbacks: study.embeddedCanonicalGraphs }
      : {}),
    reviewStatus: 'source-geometry; near/far and shared-material captures pending',
    fidelityTarget: study.fidelityTarget ?? 'maximum',
    fidelityStatus: 'pending',
    limitations: study.limitations,
    qaCameras: study.qaCameras,
    importOptions: { optimize: false },
    importReason:
      study.importReason ??
      'Preserve thin facade frames, panel joints and crown/antenna details until a measured LOD chain is authored.',
    mesh: {
      triangles: mesh.triangleCount,
      vertices: mesh.vertexCount,
      materials: mesh.groups.length,
      bytes: glb.length,
      sha256: hash(glb),
    },
  };
  const extent = Math.max(size[0], size[2]) * 1.6;
  const scene = {
    format: 'molen/scene@3',
    name: `${study.title} asset preview`,
    seed: study.id,
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
          transform: { pos: [0, -0.15, 0], rot: [0, 0, 0, 1], scale: [extent, 0.2, extent] },
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
            ambient:
              study.fidelityTarget === 'medium-fi'
                ? { sky: '#c4dcec', ground: '#7a7258', intensity: 2 }
                : { sky: '#dce5ed', ground: '#6c7473', intensity: 1.15 },
            sun: {
              direction: [-8, 14, 9],
              color: study.fidelityTarget === 'medium-fi' ? '#fff1d8' : '#fff1d3',
              intensity: study.fidelityTarget === 'medium-fi' ? 3.5 : 2.2,
              castShadow: true,
            },
            background: study.fidelityTarget === 'medium-fi' ? '#c4dcec' : '#b5d2df',
            toneMapping: study.fidelityTarget === 'medium-fi' ? 'neutral' : 'agx',
            exposure: study.fidelityTarget === 'medium-fi' ? 1 : 1.08,
            shadows: 'high',
          },
        },
      },
    ],
    camera: { mode: 'fixed', ...study.camera },
    physics: { engine: 'none' },
  };
  if (study.previewGround === false)
    scene.entities = scene.entities.filter((entity) => entity.id !== 'ground');
  const optional = (
    await readdir(dir).catch((e) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    })
  )
    .filter((name) =>
      [
        'capture-report.json',
        'shared-capture-report.json',
        'import-report.json',
        'placement-report.json',
        'qa.json',
        'map-parts.json',
        'map-frame.json',
      ].includes(name),
    )
    .sort();
  const source = {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: study.title,
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
      documents: [
        ...new Set([
          ...priorDocuments,
          'README.md',
          'preview.png',
          ...optional,
          ...(study.sourceDocuments ?? []),
        ]),
      ],
    },
  };
  const readme = `# ${study.title}\n\n![Molen preview](${study.previewImage ?? 'preview.png'})\n\n${study.brief}\n\n## Evidence and reconstruction\n\nPublished dimensions and reconstructed details are separated in spec.json. Primary references:\n\n${study.refs.map((url) => `- [Reference](${url})`).join('\n')}\n\n${study.sourceNotice ?? 'No third-party geometry, photograph or bitmap texture is embedded. Shared surface graphs come from the central library; vertex tints carry model colors. Glazing uses PBR materials; transparent surfaces are declared per model.'}\n\n## Model and axes\n\n${mesh.triangleCount.toLocaleString('en-US')} triangles; ${mesh.vertexCount.toLocaleString('en-US')} vertices; ${mesh.groups.length} material groups; ${glb.length.toLocaleString('en-US')} bytes. Native bounds: ${min.map((v) => v.toFixed(3)).join(', ')} to ${max.map((v) => v.toFixed(3)).join(', ')}. Source hash: \`${hash(glb)}\`.\n\n${JSON.stringify(study.nativeAxes)}\n\nThe geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.\n\n## Reproduce\n\nRun \`node packages/worldgen/scripts/generate-signature-towers.mjs --ids=${study.id}\` (or add \`--check\`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.\n\n## Pending work\n\n${study.limitations.map((line) => `- ${line}`).join('\n')}\n\nThis bundle contains source geometry, not a claim of maximum-fidelity completion. Hash-bound visual acceptance is recorded separately after capture inspection.\n`;
  const geographicReadme = study.geographicNote
    ? readme.replace(
        'The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.',
        study.geographicNote,
      )
    : readme;
  await emit(modelPath, glb);
  for (const [name, data] of [
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
  ])
    await emit(resolve(dir, name), Buffer.from(`${JSON.stringify(data, null, 2)}\n`));
  await emit(
    resolve(dir, 'README.md'),
    Buffer.from(
      (study.fidelityTarget === 'medium-fi'
        ? geographicReadme.replace(
            'This bundle contains source geometry, not a claim of maximum-fidelity completion.',
            'This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately.',
          )
        : geographicReadme) +
        (study.dataAttribution
          ? `\n## Additional geographic data\n\n${study.dataAttribution}\n`
          : ''),
    ),
  );
  console.log(
    `${study.id} ${assetId}: ${mesh.triangleCount} triangles, ${glb.length} bytes, ${hash(glb)}`,
  );
}
