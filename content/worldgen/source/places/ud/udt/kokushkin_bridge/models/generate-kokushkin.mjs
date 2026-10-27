/** Rebuild the original Kokushkin Bridge from its editable, source-local recipe. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  encodeGlb,
  MeshBufferBuilder,
} from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../../../../../../../packages/worldgen/scripts/architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashEvidenceText } from '../../../../../../../../packages/worldgen/scripts/evidence-text-hash.mjs';
import { biomeJson } from '../../../../../../../../packages/worldgen/scripts/format-json.mjs';
import { structureAssetSidecarPath } from '../../../../../../../../packages/worldgen/scripts/structure-asset-paths.mjs';
import {
  hashBytes,
  readOptionalJson,
  writeIndex,
} from '../../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { structureSourceDirectory } from '../../../../../../../../packages/worldgen/scripts/structure-source-paths.mjs';
import * as kokushkin from './kokushkin-model.mjs';

const recipes = [['kokushkin_bridge', kokushkin]];
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selected?.some((id) => !recipes.some(([key]) => key === id)))
  throw new Error('Unknown authored bridge ID');
const check = process.argv.includes('--check');
async function emit(path, bytes) {
  const old = await readFile(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (check) {
    assert(old?.equals(bytes), `Stale authored bridge output: ${path}`);
  } else if (!old?.equals(bytes)) await writeIndex(path, bytes);
}
const json = (path, value) => emit(path, Buffer.from(biomeJson(value, path)));
for (const [id, module] of recipes.filter(([id]) => !selected || selected.includes(id))) {
  const dir = structureSourceDirectory(id);
  const brief = JSON.parse(await readFile(resolve(dir, 'model-brief.json')));
  const placement = JSON.parse(await readFile(resolve(dir, 'placement-draft.json')));
  const frameBytes = await readFile(resolve(dir, 'map-frame.json'));
  const builder = new MeshBufferBuilder();
  const authoring = createArchitecturalSurfaceAuthoring(brief.surfaces);
  module[brief.builder](authoring.wrap(builder), 'master');
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, id);
  const materials = authoring.materials(mesh.groups);
  const bytes = Buffer.from(encodeGlb(mesh, materials, brief.exportLabel));
  const sourceHash = hashBytes(bytes);
  // Moving a reviewed recipe must not quietly alter the reviewed geometry or materials.
  assert.equal(sourceHash, brief.expectedDraftMasterHash, `${id}: saved master changed`);
  const sourcePath = resolve(dir, 'models/source.glb');
  const oldManifest = await readOptionalJson(resolve(dir, 'source.json'));
  const prior = await readFile(sourcePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (prior && oldManifest)
    assert.equal(hashBytes(prior), oldManifest.files.models[0].sha256, 'Preserve edited source');
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  mesh.positions.forEach((value, index) => {
    const axis = index % 3;
    bounds.min[axis] = Math.min(bounds.min[axis], value);
    bounds.max[axis] = Math.max(bounds.max[axis], value);
  });
  const size = bounds.max.map((value, axis) => value - bounds.min[axis]);
  const assetId = `molen.worldgen.structure.${id}`;
  const geographic = {
    status: placement.status === 'draft' ? 'draft' : 'preview-proposal',
    anchor: placement.anchor,
    heading: placement.heading,
    elevationMode: placement.datum,
    elevationMeters: placement.elevation,
    replaceFootprint: false,
    ...(placement.replaceRoads ? { replaceRoads: placement.replaceRoads } : {}),
    ...(placement.groundCutout ? { groundCutout: placement.groundCutout } : {}),
    ...(placement.buildingCutout ? { buildingCutout: placement.buildingCutout } : {}),
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: hashEvidenceText(frameBytes),
    mapGeometryLicense: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
    source: placement.source,
    wikidataId: brief.wikidataId,
    ...(brief.reviewSurface ? { reviewSurface: brief.reviewSurface } : {}),
  };
  const spec = {
    planId: id,
    id,
    assetId,
    title: brief.title,
    category: 'bridge',
    quality: 'detailed',
    wikidataId: brief.wikidataId,
    referenceCoordinate: brief.referenceCoordinate,
    visualBrief: brief.visualBrief,
    size,
    actualBounds: bounds,
    nativeAxes: brief.nativeAxes,
    sourceFacts: brief.sourceFacts,
    referencePages: brief.references.map((r) => (typeof r === 'string' ? r : (r.url ?? r.page))),
    geographicProposal: geographic,
    fidelityTarget: 'medium-fi',
    fidelityStatus: 'pending',
    reviewStatus:
      'Source-generation baseline. Current visual and geographic decisions are recorded in qa.json when present.',
    geometrySource:
      'Original deterministic exterior recipe; no downloaded meshes or photograph pixels.',
    materialMethod:
      'Existing shared material graphs, metric UV repeats and linear vertex tints. No private or embedded images.',
    sharedSurfaces: materials.flatMap((material) =>
      material.sharedSurface ? [material.sharedSurface] : [],
    ),
    runtimeLodOverlay: brief.runtimeLodOverlay,
    ...(brief.mediumFiContext ? { mediumFiContext: brief.mediumFiContext } : {}),
    ...(brief.appearance ? { appearance: brief.appearance } : {}),
    ...(brief.qaLodCameras ? { qaLodCameras: brief.qaLodCameras } : {}),
    limitations: brief.limitations,
    qaCameras: brief.cameras,
    importOptions: { optimize: false },
    mesh: {
      triangles: mesh.triangleCount,
      vertices: mesh.vertexCount,
      materials: mesh.groups.length,
      bytes: bytes.length,
      sha256: sourceHash,
    },
  };
  const scene = {
    format: 'molen/scene@3',
    name: `${brief.title} preview`,
    seed: id,
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
            scale: [size[0] * 1.2, 0.2, Math.max(100, size[2] * 1.5)],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#53777c',
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
      position: brief.cameras[0].position,
      lookAt: brief.cameras[0].lookAt,
      fov: brief.cameras[0].fov,
    },
    physics: { engine: 'none' },
  };
  const source = {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: brief.title,
    files: {
      definitions: [
        'spec.json',
        'scene.json',
        'model-brief.json',
        ...(brief.sourceDefinitions ?? []),
      ],
      models: [
        {
          path: 'models/source.glb',
          assetId,
          output: structureAssetSidecarPath(assetId),
          pipeline: 'import',
          sha256: sourceHash,
        },
      ],
      generators: [
        { id: 'source-build', path: `models/${basename(brief.generator)}` },
        { id: 'bridge-model', path: `models/${basename(brief.module)}` },
      ],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [
        ...new Set([
          'README.md',
          'preview.png',
          'map-frame.json',
          'placement-draft.json',
          'integration-review.json',
          'mapped-features.json',
          'native-fit.json',
          ...(oldManifest?.files.documents ?? []),
        ]),
      ],
    },
  };
  const readme = `# ${brief.title}\n\n![Molen preview](preview.png)\n\n${brief.visualBrief}\n\nEditable geometry lives in models/; model-brief.json records the material library, four authored runtime levels, reference pictures and reconstruction limits. The detailed master is reproducible from this editable recipe; inspection and readiness decisions are recorded separately. All GLBs are ignored generated outputs.\n\nRegenerate with \`node ${brief.generator} --ids=${id}\`. Append \`--check\` to verify exact reconstruction. Import with \`node packages/worldgen/scripts/import-structure-models.mjs --ids=${id}\`, then generate runtime levels with \`node packages/tooling/scripts/generate-landmark-lods.mjs --ids=${id}\`.\n\n## Review status\n\nCurrent completion decisions are in qa.json and QA-REVIEW.md when present; the readiness catalog is authoritative. integration-review.json retains the earlier source-promotion checkpoint, including its original pending work. placement-draft.json preserves the proposed orientation, datum and bounded replacement rules. A source build alone grants no visual or geographic approval.\n\nOriginal geometry uses the repository license. Map-derived controls: © OpenStreetMap contributors, ODbL-1.0. Reference photos retain their own rights and are not model textures.\n`;
  await mkdir(resolve(dir, 'models'), { recursive: true });
  await emit(sourcePath, bytes);
  await json(resolve(dir, 'spec.json'), spec);
  await json(resolve(dir, 'scene.json'), scene);
  await json(resolve(dir, 'source.json'), source);
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(`${id}: ${mesh.triangleCount} triangles; ${sourceHash}; saved master reproduced`);
}
