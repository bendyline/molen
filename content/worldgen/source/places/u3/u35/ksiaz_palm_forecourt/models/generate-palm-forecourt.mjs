/** Rebuild the Palm House entrance garden source GLB with no network or bundled image inputs. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  encodeGlb,
  MeshBufferBuilder,
} from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  cross,
  normalize,
  validateAuthoredMesh,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashEvidenceText } from '../../../../../../../../packages/worldgen/scripts/evidence-text-hash.mjs';
import { biomeJson } from '../../../../../../../../packages/worldgen/scripts/format-json.mjs';
import { MATERIAL_REPEAT_METERS } from '../../../../../../../../packages/worldgen/scripts/standard-materials.mjs';
import { hashBytes } from '../../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { buildPalmForecourt, key, palette, surfaces, title } from './palm-forecourt.mjs';

const dir = new URL('../', import.meta.url);
const check = process.argv.includes('--check');
const read = (file) => readFile(new URL(file, dir));
const old = (file) =>
  read(file).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
async function write(file, value) {
  const url = new URL(file, dir);
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : biomeJson(value, fileURLToPath(url)));
  const previous = await old(file);
  if (
    previous?.equals(bytes) ||
    (!file.endsWith('.glb') && previous && hashEvidenceText(previous) === hashEvidenceText(bytes))
  )
    return;
  if (check) throw Error(`Stale generated output ${url.pathname}`);
  await writeFile(url, bytes);
}
const frameBytes = await read('map-frame.json'),
  frame = JSON.parse(frameBytes),
  assetId = `molen.worldgen.structure.${key}`;
const builder = new MeshBufferBuilder(),
  used = new Map();
const meshOps = Object.fromEntries(
  ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
    name,
    (part, _ref, points, normal, _uv, color) => {
      const s = surfaces[part];
      const ref = s.graph ? `matgraph:molen.worldgen.material.${s.graph}` : 'palette:#ffffff';
      used.set(ref, s);
      const n = normalize(normal),
        u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
        v = normalize(cross(n, u));
      const repeat = s.graph ? MATERIAL_REPEAT_METERS[s.graph] : [1, 1];
      const uv = (p) => [
        p.reduce((t, x, k) => t + x * u[k], 0) / repeat[0],
        p.reduce((t, x, k) => t + x * v[k], 0) / repeat[1],
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
buildPalmForecourt(meshOps);
const mesh = builder.finalize();
validateAuthoredMesh(mesh, key);
const sharedSurface = (ref, s) => ({ ref, slot: s.slot, uv: 'repeats' });
const bytes = Buffer.from(
  encodeGlb(
    mesh,
    mesh.groups.map((g) => {
      const s = used.get(g.materialRef);
      return {
        name: s.graph ?? s.slot,
        roughness: s.roughness,
        metallic: s.metallic,
        ...(s.graph ? { sharedSurface: sharedSurface(g.materialRef, s) } : {}),
      };
    }),
    title,
  ),
);
const min = [Infinity, Infinity, Infinity],
  max = [-Infinity, -Infinity, -Infinity];
for (const [i, p] of mesh.positions.entries()) {
  min[i % 3] = Math.min(min[i % 3], p);
  max[i % 3] = Math.max(max[i % 3], p);
}
const cameras = [
  { name: 'garden-axis-and-urn', position: [0, 3.65, 15], lookAt: [0, 1.45, -0.7] },
  { name: 'three-planted-lawns', position: [23, 29, 17], lookAt: [0, 1, -5] },
  { name: 'west-bench-and-edging', position: [-9, 1.87, 4.3], lookAt: [-5.2, 0.78, -6] },
  { name: 'stone-urn-and-heather', position: [4, 2.35, 7.3], lookAt: [0.2, 0.79, 0.65] },
];
const license =
  'Original authored garden geometry. Map outlines © OpenStreetMap contributors, ODbL 1.0.';
const limits = [
  'The operator photos establish the maintained forecourt. Individual plant sizes, species and fixture positions are visual interpretations.',
  'This bundle covers the Palm House entrance lawns around the mapped loop. Former nursery plots and the wider estate park are separate scope.',
];
const groundContactBasis =
  'The landscaped lawn surfaces and edging follow the retained terrain samples at the landcover surface around the native loop path.';
const spec = {
  id: key,
  planId: key,
  assetId,
  title,
  category: 'formal-garden',
  quality: 'medium-fi-exterior',
  sitePart: frame.sitePart,
  referenceCoordinate: { longitude: frame.anchor[0], latitude: frame.anchor[1] },
  nativeAxes: frame.nativeAxes,
  size: max.map((x, i) => x - min[i]),
  actualBounds: { min, max },
  visualBrief:
    'Three planted lawns frame the loop to the Palm House. The clipped island hedge surrounds a conical yew, globe topiary, heather and a carved urn. Benches and low stone bowls sit along the side planting.',
  sourceGeometry: {
    module: 'content/worldgen/source/places/u3/u35/ksiaz_palm_forecourt/models/palm-forecourt.mjs',
  },
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: Object.fromEntries(
      Object.entries(palette).map(([slot, hex]) => [slot, `#${hex}`]),
    ),
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
  },
  fidelityTarget: 'medium-fi',
  fidelityStatus: 'review-in-qa.json',
  sourceFacts: {
    terrain: 'Retained Terrarium samples',
    mappedLawnIds: frame.evidence.grassIds,
    retainedPaths: [frame.evidence.retainedFootpathId, frame.evidence.retainedAccessRoadId],
  },
  referencePages: [frame.evidence.source, 'https://www.openstreetmap.org/way/263009990'],
  geographicProposal: {
    status: 'preview-proposal',
    anchor: frame.anchor,
    heading: frame.heading,
    ground: 'terrain',
    elevationMode: 'terrain-contact',
    groundModelY: frame.terrainModelHeight,
    groundContactReviewed: true,
    groundContactBasis,
    terrainReference: {
      anchor: frame.anchor,
      modelHeight: frame.terrainModelHeight,
      basis: groundContactBasis,
    },
    bounds: frame.bounds,
    replaceFootprint: false,
    source: frame.evidence.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: hashEvidenceText(frameBytes),
    mapGeometryLicense: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
  },
  sharedSurfaces: [...used].flatMap(([ref, s]) =>
    s.graph ? [{ ...sharedSurface(ref, s), repeatMeters: MATERIAL_REPEAT_METERS[s.graph] }] : [],
  ),
  sourceLicense: license,
  limitations: limits,
  qaCameras: cameras,
  importOptions: { optimize: false },
  mesh: {
    triangles: mesh.triangleCount,
    vertices: mesh.vertexCount,
    materials: mesh.groups.length,
    bytes: bytes.length,
    sha256: hashBytes(bytes),
  },
};
const scene = {
  format: 'molen/scene@3',
  name: title,
  seed: key,
  tickRate: 30,
  entities: [
    {
      id: 'landscape',
      components: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
      },
    },
    {
      id: 'ground',
      components: {
        transform: { pos: [0, -0.87, 0], rot: [0, 0, 0, 1], scale: [110, 0.3, 110] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#8e956f',
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
  camera: { mode: 'fixed', position: cameras[0].position, lookAt: cameras[0].lookAt, fov: 46 },
  physics: { engine: 'none' },
};
const previous = JSON.parse((await old('source.json')) ?? 'null');
const existing = await old('models/source.glb');
if (existing && previous && hashBytes(existing) !== previous.files.models[0].sha256)
  throw Error('Unexpected local edits to the generated forecourt GLB');
const source = {
  format: 'molen/source-bundle@1',
  id: assetId,
  kind: 'static-structure',
  title,
  files: {
    definitions: ['spec.json', 'scene.json'],
    models: [
      {
        path: 'models/source.glb',
        assetId,
        output: `assets/places/u3/u35/${key}/asset.json`,
        pipeline: 'import',
        sha256: hashBytes(bytes),
      },
    ],
    generators: [
      { id: 'generate-palm-forecourt', path: 'models/generate-palm-forecourt.mjs' },
      { id: 'palm-forecourt', path: 'models/palm-forecourt.mjs' },
    ],
    scripts: [],
    textures: [],
    sounds: [],
    documents: [
      ...new Set([
        ...(previous?.files.documents ?? []),
        'README.md',
        'map-frame.json',
        'surface-means.json',
        'preview.png',
      ]),
    ],
  },
};
const doc = [
  `# ${title}`,
  '',
  '![Model preview](preview.png)',
  '',
  spec.visualBrief,
  '',
  ...limits,
  '',
  'The shared stone, wood, painted metal and gravel graphs use metric UVs. Clipped foliage and turf use palette colors.',
  '',
  'Run node content/worldgen/source/places/u3/u35/ksiaz_palm_forecourt/models/generate-palm-forecourt.mjs to regenerate the model. Add --check to verify its source outputs.',
  '',
  '[Placement review](QA-REVIEW.md) · [Operator gallery](https://www.ksiaz.walbrzych.pl/turystyka/palmiarnia)',
  '',
].join('\n');
await write('models/source.glb', bytes);
await write('spec.json', spec);
await write('scene.json', scene);
await write('source.json', source);
await write('README.md', doc);
console.log(key, mesh.triangleCount, bytes.length, spec.mesh.sha256);
