/** Build explicit recipes from the authored geographic catalog; no article/image access at build time. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeGlb,
  MeshBufferBuilder,
} from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { brusselsTownHallModel } from './brussels-town-hall-model.mjs';

const authoredPlaceModels = [brusselsTownHallModel];
const buildAuthoredPlace = (out, model, frame) => model.build(out, frame);
const landmarkSurfaces = brusselsTownHallModel.surfaces;

import {
  cross,
  normalize,
  validateAuthoredMesh,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { embedGraphFallbacks } from '../../../../../../../../packages/worldgen/scripts/embed-graph-fallbacks.mjs';
import { hashEvidenceText } from '../../../../../../../../packages/worldgen/scripts/evidence-text-hash.mjs';
import { MATERIAL_REPEAT_METERS } from '../../../../../../../../packages/worldgen/scripts/standard-materials.mjs';
import { structureAssetPathFromSource } from '../../../../../../../../packages/worldgen/scripts/structure-asset-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../../..');
const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const selected = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const check = process.argv.includes('--check');
for (const model of authoredPlaceModels)
  if (
    !/^[a-z][a-z0-9_]*$/.test(model.key) ||
    model.id !== model.key ||
    /qualla/i.test(model.key + model.recipe)
  )
    throw Error(`Structure identity must be an ordinary geographic name: ${model.key}`);
for (const id of selected ?? [])
  if (!authoredPlaceModels.some((m) => m.id === id || m.key === id))
    throw Error(`Unknown structure ${id}`);
function emit(file, value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(bytes)) return;
  if (check) throw Error(`Stale generated output ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
for (const model of authoredPlaceModels.filter(
  (m) => !selected || selected.includes(m.id) || selected.includes(m.key),
)) {
  const sourcePath = `content/worldgen/source/places/${model.cell}/${model.key}`,
    dir = path.join(root, sourcePath),
    frame = JSON.parse(fs.readFileSync(path.join(dir, 'map-frame.json'))),
    refs = JSON.parse(fs.readFileSync(path.join(dir, 'reference-images.json'))),
    assetId = `molen.worldgen.structure.${model.key}`;
  const builder = new MeshBufferBuilder();
  buildAuthoredPlace(builder, model, frame);
  const raw = builder.finalize(),
    out = new MeshBufferBuilder(),
    used = new Map();
  for (const g of raw.groups) {
    const s = (model.surfaces ?? landmarkSurfaces)[g.slot];
    if (!s) throw Error(`Unknown surface ${g.slot}`);
    const ref = s.graph
      ? `matgraph:molen.worldgen.material.${s.graph}`
      : (s.localRef ?? 'palette:#ffffff');
    used.set(ref, s);
    for (let i = g.start; i < g.start + g.count; i += 3) {
      const indices = Array.from(raw.indices.slice(i, i + 3)),
        p = indices.map((j) => Array.from(raw.positions.slice(j * 3, j * 3 + 3))),
        normal = normalize(Array.from(raw.normals.slice(indices[0] * 3, indices[0] * 3 + 3))),
        u = Math.abs(normal[1]) < 0.98 ? normalize([normal[2], 0, -normal[0]]) : [1, 0, 0],
        v = normalize(cross(normal, u)),
        repeat = s.graph ? MATERIAL_REPEAT_METERS[s.graph] : [1, 1];
      if (!repeat) throw Error(`Unknown material ${s.graph}`);
      const uv = p.map((q) => [
          q.reduce((a, n, j) => a + n * u[j], 0) / repeat[0],
          q.reduce((a, n, j) => a + n * v[j], 0) / repeat[1],
        ]),
        color = Array.from(raw.colors.slice(indices[0] * 3, indices[0] * 3 + 3)).map(
          (v) => v / 255,
        );
      out.addTriangle(s.slot, ref, p, normal, uv, color);
    }
  }
  const mesh = out.finalize();
  validateAuthoredMesh(mesh, model.id);
  const encoded = Buffer.from(
    encodeGlb(
      mesh,
      mesh.groups.map((g) => {
        const s = used.get(g.materialRef);
        return {
          name: s.graph ?? g.slot,
          roughness: s.roughness,
          metallic: s.metallic,
          ...Object.fromEntries(
            ['baseColorFactor', 'alphaMode', 'alphaCutoff', 'doubleSided']
              .filter((field) => s[field] !== undefined)
              .map((field) => [field, s[field]]),
          ),
          ...(s.graph
            ? { sharedSurface: { ref: g.materialRef, slot: s.slot, uv: 'repeats' } }
            : {}),
        };
      }),
      model.title,
    ),
  );
  const bytes = await embedGraphFallbacks(
    encoded,
    (model.embeddedCanonicalGraphs ?? []).map((name) => ({
      ref: `matgraph:molen.worldgen.material.${name}`,
      graphPath: path.resolve(root, `content/worldgen/materials/${name}.matgraph.json`),
    })),
    root,
  );
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], mesh.positions[i]);
    max[i % 3] = Math.max(max[i % 3], mesh.positions[i]);
  }
  const size = max.map((v, i) => v - min[i]),
    center = min.map((v, i) => (v + max[i]) / 2),
    span = Math.max(...size);
  const look = model.lookAt ?? [center[0], Math.max(2, center[1] * 0.7), center[2]],
    camera = { position: model.camera, lookAt: look, fov: 43 };
  const hasTerrain = fs.existsSync(path.join(dir, 'terrain-grid.json'));
  const usePortableTerrain = hasTerrain && model.portableGroundY === undefined;
  if (model.portableGroundY !== undefined && !Number.isFinite(model.portableGroundY))
    throw Error(`${model.id}: invalid isolated review ground datum`);
  const limitations = model.limitations ?? [
    'Draft exterior: approximate photographic proportions and simplified ornament. It is not a survey, photogrammetric reconstruction or approved current geographic replacement.',
    frame.notes,
    'Terrain sampling/contact, geographic alignment and site activation remain pending. Runtime LODs are produced by the registered after-import pipeline and require visual review.',
    'Reference photos remain in the local Qualla corpus; only provenance, paths and hashes are retained here.',
  ];
  const spec = {
    planId: model.id,
    id: model.id,
    assetId,
    title: model.title,
    wikidataId: model.wikidataId,
    category: model.category ?? 'landmark',
    quality: model.quality ?? 'draft-exterior',
    referenceCoordinate: { longitude: frame.anchor[0], latitude: frame.anchor[1] },
    size,
    actualBounds: { min, max },
    visualBrief: model.brief,
    nativeAxes: frame.nativeAxes,
    appearance: {
      standard: 'docs-src/guide/medium-fi.md',
      colorEncoding: 'sRGB palette decoded to linear COLOR_0',
      materialBudget: 6,
      ...(model.appearance ?? {}),
    },
    referencePages: [
      ...new Set(
        [...refs.references, ...(refs.externalReferences ?? [])]
          .map((r) => r.sourceUrl)
          .filter(Boolean),
      ),
    ],
    stories: refs.stories.map((s) => ({ id: s.id, url: s.url })),
    referenceInputHash: refs.inputHash,
    sourceGeometry: { module: `${sourcePath}/models/${model.recipe}` },
    recipeDependencies: Object.fromEntries(
      [
        'landmark-model-helpers.mjs',
        'authored-structure-mesh.mjs',
        'structure-mesh.mjs',
        ...(model.recipeDependencies ?? []),
      ].map((name) => [
        name,
        hashEvidenceText(fs.readFileSync(path.join(root, 'packages/worldgen/scripts', name))),
      ]),
    ),
    ...(model.runtimeLodOverlay ? { runtimeLodOverlay: model.runtimeLodOverlay } : {}),
    ...(model.embeddedCanonicalGraphs?.length
      ? { portableCanonicalFallbacks: model.embeddedCanonicalGraphs }
      : {}),
    fidelityTarget: 'medium-fi',
    ...(model.mediumFiContext ? { mediumFiContext: model.mediumFiContext } : {}),
    fidelityStatus: model.quality === 'medium-fi-exterior' ? 'review-in-qa.json' : 'pending',
    reviewStatus: model.reviewStatus ?? 'draft-needs-fidelity-and-placement-review',
    geographicProposal: {
      orientationPolicy: model.orientationPolicy,
      status: model.geographicStatus ?? 'research-only',
      ...(model.groundContactBasis
        ? { groundContactReviewed: true, groundContactBasis: model.groundContactBasis }
        : {}),
      anchor: frame.anchor,
      heading: frame.heading,
      ground: 'terrain',
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      ...(frame.terrainContact
        ? {
            terrainReference: {
              anchor: [
                frame.anchor[0] +
                  (Math.cos(frame.heading) * frame.terrainContact.local[0] +
                    Math.sin(frame.heading) * frame.terrainContact.local[1]) /
                    (111320 * Math.cos((frame.anchor[1] * Math.PI) / 180)),
                frame.anchor[1] -
                  (-Math.sin(frame.heading) * frame.terrainContact.local[0] +
                    Math.cos(frame.heading) * frame.terrainContact.local[1]) /
                    111320,
              ],
              modelHeight: frame.terrainContact.modelY,
              basis:
                frame.terrainContact.basis ??
                'Front ground reference in the signed local map frame; separately preserved terrain-grid.json.',
            },
          }
        : {}),
      replaceFootprint: false,
      ...(model.groundCutout ? { groundCutout: model.groundCutout } : {}),
      featureIds: frame.features.map((f) => f.id),
      source: frame.sourceUrl,
      mapGeometrySource: 'map-frame.json',
      mapGeometryHash: hashEvidenceText(fs.readFileSync(path.join(dir, 'map-frame.json'))),
      notes: frame.notes,
    },
    sharedSurfaces: [...used]
      .filter(([, s]) => s.graph)
      .map(([ref, s]) => ({
        ref,
        slot: s.slot,
        uv: 'repeats',
        repeatMeters: MATERIAL_REPEAT_METERS[s.graph],
      })),
    limitations,
    sourceLicense:
      'Original authored geometry under repository license; map controls © OpenStreetMap contributors, ODbL-1.0. Creator-public-domain reference originals are retained as local provenance inputs and are never embedded as textures.',
    qaCameras: model.qaCameras ?? [
      {
        name: 'front',
        position: [center[0], Math.max(size[1] * 0.65, 6), max[2] + span * 1.5],
        lookAt: look,
      },
      {
        name: 'back',
        position: [center[0], Math.max(size[1] * 0.8, 8), min[2] - span * 1.5],
        lookAt: look,
      },
    ],
    importOptions: { optimize: false },
    mesh: {
      triangles: mesh.triangleCount,
      vertices: mesh.vertexCount,
      materials: mesh.groups.length,
      bytes: bytes.length,
      sha256: hash(bytes),
    },
  };
  const scene = {
    format: 'molen/scene@3',
    name: `${model.title} model review`,
    seed: model.id,
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
            pos: [center[0], model.portableGroundY ?? -0.18, center[2]],
            rot: [0, 0, 0, 1],
            scale: [span * 1.8, 0.3, span * 1.8],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#b4b4a6',
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'environment',
        components: {
          environment: {
            ambient: { sky: '#c4dcec', ground: '#7a7258', intensity: 2 },
            sun: { direction: [-8, 14, 9], color: '#fff1d8', intensity: 3.5, castShadow: true },
            background: '#c4dcec',
            toneMapping: 'neutral',
            exposure: 1,
            shadows: 'high',
          },
        },
      },
    ],
    camera: { mode: 'fixed', ...camera },
    ...(usePortableTerrain
      ? {
          terrain: {
            descriptor: 'terrain-review.terrain.json',
            heightmap: 'terrain-review.height.png',
          },
        }
      : {}),
    physics: { engine: 'none' },
  };
  if (usePortableTerrain) scene.entities = scene.entities.filter((e) => e.id !== 'ground');
  const sourceFile = path.join(dir, 'source.json'),
    previous = fs.existsSync(sourceFile) ? JSON.parse(fs.readFileSync(sourceFile)) : null;
  const source = {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: model.title,
    files: {
      definitions: ['spec.json', 'scene.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId,
          output: structureAssetPathFromSource(sourcePath),
          pipeline: 'import',
          sha256: hash(bytes),
        },
      ],
      generators: [
        { id: 'generate-brussels-town-hall', path: 'models/generate-brussels-town-hall.mjs' },
        { id: 'brussels-town-hall-model', path: 'models/brussels-town-hall-model.mjs' },
      ],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [
        ...new Set([
          ...(previous?.files.documents ?? []),
          'README.md',
          'map-frame.json',
          'reference-images.json',
          ...(hasTerrain
            ? ['terrain-grid.json', 'terrain-review.terrain.json', 'terrain-review.height.png']
            : []),
          'preview.png',
        ]),
      ],
    },
  };
  for (const [name, value] of [
    ['models/source.glb', bytes],
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
    [
      'README.md',
      `# ${model.title}\n\n${model.brief}\n\n![Molen preview](preview.png)\n\nAuthoring state: **${model.reviewStatus ?? 'draft exterior; geographic activation pending'}**. Current completion evidence is in [qa.json](qa.json) and the [${model.progressLedger ? 'completion ledger' : 'local 100 ledger'}](../../../../qualla-structures/batches/${model.progressLedger ?? 'PROGRESS.md'}).\n\n${refs.stories.map((s) => `- [${s.title}](${s.url})`).join('\n')}\n\n${limitations.join('\n\n')}\n\nBuild: \`node ${sourcePath}/models/generate-brussels-town-hall.mjs\`. Add \`--check\` to verify exact regeneration. ${mesh.triangleCount} triangles; ${mesh.groups.length} materials; no embedded photographs.\n`,
    ],
  ])
    emit(path.join(dir, name), value);
  console.log(model.id, model.key, mesh.triangleCount, 'triangles', hash(bytes));
}
