/** Source-only generation of independently addressable components of the Książ ensemble. */
import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { cross, normalize, validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import {
  buildKsiazEntrance,
  ksiazEntranceModels,
  ksiazEntrancePalette,
  ksiazEntranceSurfaces,
} from './ksiaz-entrance-models.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetPathFromSource } from './structure-asset-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..'),
  check = process.argv.includes('--check'),
  selection = process.argv
    .find((v) => v.startsWith('--ids='))
    ?.slice(6)
    .split(','),
  hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
async function emit(path, bytes) {
  const old = await readFile(path).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  if (old?.equals(bytes)) return;
  if (check && path.endsWith('.glb')) throw Error(`${path} is stale (binary mismatch)`);
  if (
    check &&
    old?.toString('utf8').replaceAll('\r\n', '\n') !==
      bytes.toString('utf8').replaceAll('\r\n', '\n')
  )
    throw Error(`${path} is stale`);
  if (check) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}
for (const id of selection ?? [])
  if (!ksiazEntranceModels.some((m) => m.id === id || m.key === id))
    throw Error(`Unknown entrance component ${id}`);
for (const model of ksiazEntranceModels.filter(
  (m) => !selection || selection.includes(m.id) || selection.includes(m.key),
)) {
  const sourcePath = `content/worldgen/source/places/u3/u35/${model.key}`,
    dir = resolve(root, sourcePath),
    frameBytes = await readFile(resolve(dir, 'map-frame.json')),
    frame = JSON.parse(frameBytes),
    assetId = `molen.worldgen.structure.${model.key}`,
    used = new Map(),
    builder = new MeshBufferBuilder();
  let previous;
  try {
    previous = JSON.parse(await readFile(resolve(dir, 'source.json')));
    if (hash(await readFile(resolve(dir, 'models/source.glb'))) !== previous.files.models[0].sha256)
      throw Error(`${model.id}: source was manually edited;preserve before regenerating`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  buildKsiazEntrance(
    {
      addTriangle: (component, _ref, points, normal, _uv, color) => {
        const s = ksiazEntranceSurfaces[component];
        if (!s) throw Error(`Unmapped surface ${component}`);
        const ref = s.graph ? `matgraph:molen.worldgen.material.${s.graph}` : 'palette:#ffffff',
          n = normalize(normal),
          u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
          v = normalize(cross(n, u)),
          repeat = s.graph ? MATERIAL_REPEAT_METERS[s.graph] : [1, 1],
          uv = points.map((p) => [
            p.reduce((sum, x, i) => sum + x * u[i], 0) / repeat[0],
            p.reduce((sum, x, i) => sum + x * v[i], 0) / repeat[1],
          ]);
        used.set(ref, s);
        builder.addTriangle(s.slot, ref, points, normal, uv, color);
      },
    },
    model.key,
  );
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, model.id);
  const bytes = Buffer.from(
    encodeGlb(
      mesh,
      mesh.groups.map((g) => {
        const s = used.get(g.materialRef);
        return {
          name: s.graph ?? g.slot,
          roughness: s.roughness,
          metallic: s.metallic,
          ...(s.graph
            ? { sharedSurface: { ref: g.materialRef, slot: s.slot, uv: 'repeats' } }
            : {}),
        };
      }),
      model.title,
    ),
  );
  const min = [0, 1, 2].map((i) =>
      Math.min(...Array.from(mesh.positions).filter((_, k) => k % 3 === i)),
    ),
    max = [0, 1, 2].map((i) =>
      Math.max(...Array.from(mesh.positions).filter((_, k) => k % 3 === i)),
    ),
    size = max.map((v, i) => v - min[i]);
  const refs = [
    'https://eli.gov.pl/api/acts/DU/2025/1089/text.pdf',
    'https://www.ksiazhotel.pl/hotel',
    'https://ksiazhotel.pl/pokoj-2os-komfort-oficyna',
    'https://commons.wikimedia.org/wiki/File:Ksiaz_w_jesiennej_scenerii.jpg',
    frame.sourceUrl,
  ];
  const front =
      model.id === 'KSI_A01' || model.id === 'KSI_A04'
        ? [55, 14, 0]
        : [5, 13, model.id === 'KSI_A02' ? 65 : -65],
    camera = { position: [48, 30, 49], lookAt: [0, 7, 0], fov: 43 },
    qaCameras = [
      { name: 'principal-facade', position: front, lookAt: [0, 8, 0] },
      {
        name: 'opposite-facade',
        position: front.map((v, i) => (i === 1 ? v : -v)),
        lookAt: [0, 8, 0],
      },
      { name: 'roof-and-footprint', position: [0, 70, 16], lookAt: [0, 5, 0] },
      {
        name: 'facade-and-roof-junction',
        position: model.id === 'KSI_A01' ? [27, 17, 23] : [27, 17, 30],
        lookAt: [5, 9, 0],
      },
    ];
  const spec = {
    planId: model.id,
    id: model.id,
    assetId,
    title: model.title,
    category: 'historic-entrance-building',
    quality: 'detailed',
    sitePart: {
      candidateId: 'N0291',
      componentKey: 'entrance-buildings',
      identity: { type: 'way', id: model.way },
    },
    referenceCoordinate: { longitude: frame.anchor[0], latitude: frame.anchor[1] },
    size,
    actualBounds: { min, max },
    visualBrief:
      model.id === 'KSI_A01'
        ? 'Cream gatehouse with twin octagonal upper towers,dark faceted domes,red central hip and tall arched library window.'
        : model.id === 'KSI_A04'
          ? 'Detached pale hotel with red pitched roof,shallow front pediment and merged dormers.'
          : 'Pale yellow elongated side wing:lower central range with repeated dormers and raised two-floor end pavilions beneath red tile roofs.',
    nativeAxes: frame.nativeAxes,
    appearance: {
      standard: 'docs-src/guide/medium-fi.md',
      paletteSrgb: ksiazEntrancePalette,
      colorEncoding: 'sRGB decoded to linear COLOR_0',
      materialBudget: 5,
    },
    mediumFiContext: { neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
    sourceFacts: {
      mapFeature: frame.sourceUrl,
      mappedTags: frame.elements[0].tags,
      independentWikidataIdKnown: false,
      roofAndDatumSurveyed: false,
      parentSite: 'N0291',
      primaryDescription:
        'The hotel operator identifies three palace annexes;official heritage designation includes entrance buildings. This fourth nearby mapped Hotel Zamkowy is separately identified,with its role in the designated ensemble unconfirmed.',
    },
    reconstruction: frame.reconstruction,
    referencePages: refs,
    fidelityTarget: 'medium-fi',
    fidelityStatus: 'pending',
    reviewStatus: 'source-geometry;captures pending',
    geographicProposal: {
      status: 'research-only',
      anchor: frame.anchor,
      heading: frame.heading,
      ground: 'terrain',
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      replaceFootprint: false,
      featureIds: [`way/${model.way}`],
      source: frame.sourceUrl,
      mapGeometrySource: 'map-frame.json',
      mapGeometryHash: hashEvidenceText(frameBytes),
      mapGeometryLicense: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors',
      notes:
        'Own mapped ring and approach-facing axes;roof/body heights and local ground datum estimated. Inactive until terrain/facade fit reviewed. No independent Wikidata identity claimed.',
    },
    sharedSurfaces: [...used]
      .filter(([, s]) => s.graph)
      .map(([ref, s]) => ({
        ref,
        slot: s.slot,
        uv: 'repeats',
        repeatMeters: MATERIAL_REPEAT_METERS[s.graph],
      })),
    sourceLicense:
      'Original authored geometry under repository license. Mapped outline © OpenStreetMap contributors,ODbL-1.0;linked research photographs are not redistributed.',
    limitations: [
      'One component only;N0291 full site remains incomplete.',
      'Footprint is attributed map geometry;heights,openings,dormers and roof profiles are photographic interpretations.',
      'No independent Wikidata identity.',
      ...(model.id === 'KSI_A04'
        ? ['Hotel Zamkowy inclusion in the official heritage entrance group remains unconfirmed.']
        : []),
      'No interiors,signage,statue likenesses or unique textures. Geographic/terrain fit and physical-device timing pending.',
    ],
    qaCameras,
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
    name: `${model.title} source review`,
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
          transform: { pos: [0, -0.15, 0], rot: [0, 0, 0, 1], scale: [110, 0.2, 110] },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#8aa065',
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
    physics: { engine: 'none' },
  };
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
      scripts: [],
      textures: [],
      sounds: [],
      documents: [
        ...new Set([
          ...(previous?.files.documents ?? []),
          'README.md',
          'map-frame.json',
          'preview.png',
        ]),
      ],
    },
  };
  const readme =
    '# ' +
    model.title +
    '\n\n![Shared Molen preview](shots/shared/angle-0.png)\n\n' +
    spec.visualBrief +
    '\n\n' +
    'Independent component of [Książ Castle and park complex](../n0291_ksiaz_castle_and_park_complex/README.md). Full site scope and geographic activation remain pending.\n\n' +
    '## Sources and reconstruction\n\n' +
    refs.map((url) => `- [Reference](${url})`).join('\n') +
    '\n\n' +
    spec.sourceLicense +
    '\n\n' +
    'Own map footprint;native Y0 is estimated local ground contact. Heights,roof profiles,openings and facade facing are interpretations. No independent Wikidata identity is assigned. Hotel Zamkowy membership is unconfirmed.\n\n' +
    '## Build\n\nRun node packages/worldgen/scripts/generate-ksiaz-entrances.mjs --ids=' +
    model.id +
    ' (or --check).\n\n' +
    mesh.triangleCount +
    ' triangles;' +
    bytes.length +
    ' source bytes;' +
    mesh.groups.length +
    ' merged material groups;no embedded images. Shared plaster,tile,sandstone and gatehouse bronze use metric UVs and linear palette tints. Runtime LODs are separate generated outputs.\n\n' +
    'Source hash: ' +
    hash(bytes) +
    '\n';
  await emit(resolve(dir, 'models/source.glb'), bytes);
  for (const [name, value] of [
    ['spec.json', spec],
    ['source.json', source],
    ['scene.json', scene],
  ])
    await emit(resolve(dir, name), Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(
    model.id +
      ' ' +
      model.key +
      ': ' +
      mesh.triangleCount +
      ' triangles;' +
      bytes.length +
      ' bytes;' +
      hash(bytes),
  );
}
