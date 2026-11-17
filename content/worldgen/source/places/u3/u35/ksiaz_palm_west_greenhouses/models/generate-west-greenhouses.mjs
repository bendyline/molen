/** Rebuild the western greenhouse source GLB with no network or bundled image inputs. */
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
import { buildWestGreenhouses, key, palette, surfaces, title } from './west-greenhouses.mjs';

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
buildWestGreenhouses(meshOps);
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
const fit = frame.siteFit;
const terrainReference = {
  anchor: fit.contact.anchor,
  modelHeight: fit.contact.modelHeight,
  basis: frame.reconstruction.registration,
};
const cameras = [
  { name: 'three-glazed-ranges', position: [-50, 24, 39], lookAt: [-4, 2, 0] },
  { name: 'east-connector-and-framing', position: [53, 20, -35], lookAt: [13, 2, 0] },
  { name: 'two-open-slots', position: [-18, 104, 2], lookAt: [-2, 1, 0] },
  { name: 'south-service-door', position: [11, 3.2, 23], lookAt: [9, 1.22, 18] },
];
const references = [
  frame.sourceUrl,
  'https://fotopolska.eu/2794063,walbrzych-ul-wroclawska-palmiarnia,zdjecie.html',
  'https://fotopolska.eu/669114,walbrzych-ul-wroclawska-palmiarnia,zdjecie.html',
];
const limitations = [
  frame.reconstruction.appearance,
  'Exterior shell only. Former garden planting and interiors are outside this model.',
];
const spec = {
  planId: key,
  id: key,
  assetId,
  title,
  category: 'historic-glasshouse',
  quality: 'medium-fi-exterior',
  sitePart: frame.sitePart,
  referenceCoordinate: { longitude: frame.anchor[0], latitude: frame.anchor[1] },
  size: max.map((x, i) => x - min[i]),
  actualBounds: { min, max },
  nativeAxes: frame.nativeAxes,
  visualBrief:
    'Three low glazed ranges share an east connector with two open western slots. Pale steel frames, raised ridge ventilators, a brick plinth and an inset south service door give each elevation depth.',
  sourceGeometry: {
    module: `content/worldgen/source/places/u3/u35/${key}/models/west-greenhouses.mjs`,
  },
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: Object.fromEntries(Object.entries(palette).map(([s, v]) => [s, `#${v}`])),
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 4,
  },
  sourceFacts: {
    mapFeature: frame.sourceUrl,
    mappedOsmType: 'way',
    mappedOsmId: 263009991,
    geometryBasis: 'Protomaps PMTiles z15 with OSM attribution',
    photoDates: [1931, 1981],
    heightAndRoofSurveyed: false,
  },
  referencePages: references,
  reconstruction: frame.reconstruction,
  fidelityTarget: 'medium-fi',
  fidelityStatus: 'review-in-qa.json',
  mediumFiContext: { neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
  geographicProposal: {
    status: 'preview-proposal',
    anchor: frame.anchor,
    heading: frame.heading,
    ground: 'terrain',
    elevationMode: 'terrain-contact',
    groundModelY: fit.contact.modelHeight,
    groundContactReviewed: true,
    groundContactBasis: frame.reconstruction.registration,
    terrainReference,
    bounds: fit.bounds,
    replaceFootprint: false,
    buildingCutout: fit.buildingCutout,
    groundCutout: fit.groundCutout,
    featureIds: ['way/263009991'],
    source: frame.sourceUrl,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: hashEvidenceText(frameBytes),
    mapGeometryLicense: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
  },
  sharedSurfaces: [...used].flatMap(([ref, s]) =>
    s.graph ? [{ ...sharedSurface(ref, s), repeatMeters: MATERIAL_REPEAT_METERS[s.graph] }] : [],
  ),
  sourceLicense:
    'Original authored geometry under the repository license. Mapped outline © OpenStreetMap contributors, ODbL 1.0.',
  limitations,
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
  name: `${title} source review`,
  seed: key,
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
        transform: { pos: [0, -0.18, 0], rot: [0, 0, 0, 1], scale: [160, 0.26, 160] },
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
  camera: { mode: 'fixed', position: cameras[0].position, lookAt: cameras[0].lookAt, fov: 44 },
  physics: { engine: 'none' },
};
const previous = JSON.parse((await old('source.json')) ?? 'null');
const existing = await old('models/source.glb');
if (existing && previous && hashBytes(existing) !== previous.files.models[0].sha256)
  throw Error('Unexpected local edits to the generated greenhouse GLB');
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
      { id: 'generate-west-greenhouses', path: 'models/generate-west-greenhouses.mjs' },
      { id: 'west-greenhouses', path: 'models/west-greenhouses.mjs' },
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
const markdown = [
  `# ${title}`,
  '',
  '![Model preview](preview.png)',
  '',
  spec.visualBrief,
  '',
  frame.reconstruction.registration,
  '',
  ...limitations,
  '',
  'The frame, brick and sandstone use the existing shared material graphs. The four detail levels preserve the roof and open bays. Tinted glass is opaque in the viewer.',
  '',
  'Regenerate with `node content/worldgen/source/places/u3/u35/ksiaz_palm_west_greenhouses/models/generate-west-greenhouses.mjs`. Add `--check` to verify the generated files.',
  '',
  `[Footprint](${references[0]}) · [1931 aerial photo](${references[1]}) · [1981 site photo](${references[2]}) · [Placement review](QA-REVIEW.md)`,
  '',
].join('\n');
await write('models/source.glb', bytes);
await write('spec.json', spec);
await write('scene.json', scene);
await write('source.json', source);
await write('README.md', markdown);
console.log(`${key} ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${spec.mesh.sha256}`);
