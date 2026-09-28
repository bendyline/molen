/** Standalone researched Gamla bron source authoring; no catalog or runtime mutations. */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import {
  cross,
  normalize,
  smoothMeshNormals,
  validateAuthoredMesh,
} from './authored-structure-mesh.mjs';
import { biomeJson } from './format-json.mjs';
import { gamlaBronStudy as asset, buildGamlaBron } from './gamla-bron-model.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const dir = structureSourceDirectory('n0003_gamla_bron');
const modelPath = resolve(dir, 'models/source.glb');
const check = process.argv.includes('--check');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

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

try {
  const source = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
  const current = await readFile(modelPath);
  if (hash(current) !== source.files.models[0].sha256)
    throw new Error(
      `${asset.id}: artist-edited master differs from generator baseline; preserve it before regenerating`,
    );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const out = new MeshBufferBuilder();
const surfaces = {
  foundation: { graph: 'stone_granite', slot: 'foundation', roughness: 0.94, metallic: 0 },
  trim: { graph: 'metal_painted', slot: 'trim', roughness: 0.72, metallic: 0.2 },
  timber: { graph: 'wood_plain', slot: 'roof', roughness: 0.91, metallic: 0 },
  pole: { graph: 'wood_plain', slot: 'trim', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', roughness: 0.97, metallic: 0 },
  window: { slot: 'window', roughness: 0.45, metallic: 0.08 },
};
const used = new Map();
function prepare(component, n) {
  const s = surfaces[component];
  if (!s) throw Error(`Unmapped Gamla bron component ${component}`);
  const ref = s.graph ? `matgraph:molen.worldgen.material.${s.graph}` : 'palette:#ffffff';
  used.set(`${s.slot}:${ref}`, s);
  n = normalize(n);
  // Boards cross the bridge along Z; orient plain wood grain with their long axis.
  const u =
    component === 'pole' && Math.abs(n[1]) < 0.98
      ? [0, 1, 0]
      : component === 'timber' && Math.abs(n[1]) > 0.98
        ? [0, 0, 1]
        : Math.abs(n[1]) < 0.98
          ? normalize([n[2], 0, -n[0]])
          : [1, 0, 0];
  const v = normalize(cross(n, u)),
    repeat = s.graph ? MATERIAL_REPEAT_METERS[s.graph] : [1, 1];
  return {
    s,
    ref,
    uv: (p) => [
      p.reduce((sum, k, i) => sum + k * u[i], 0) / repeat[0],
      p.reduce((sum, k, i) => sum + k * v[i], 0) / repeat[1],
    ],
  };
}
buildGamlaBron({
  addQuad(c, _ref, p, n, _uv, color) {
    const { s, ref, uv } = prepare(c, n);
    out.addQuad(s.slot, ref, p, n, p.map(uv), color);
  },
  addTriangle(c, _ref, p, n, _uv, color) {
    const { s, ref, uv } = prepare(c, n);
    out.addTriangle(s.slot, ref, p, n, p.map(uv), color);
  },
  addConvexPolygon(c, _ref, p, n, _uv, color) {
    const { s, ref, uv } = prepare(c, n);
    out.addConvexPolygon(s.slot, ref, p, n, uv, color);
  },
});
const mesh = out.finalize();
// Smooth only modest angles: utility pipes and pole cylinders retain their circular profiles,
// while I-beam flanges, deck edges, and masonry course edges keep hard corner normals.
smoothMeshNormals(mesh, ['trim', 'foundation'], 32);
validateAuthoredMesh(mesh, asset.id);
const min = [Infinity, Infinity, Infinity],
  max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < mesh.positions.length; i++) {
  const axis = i % 3;
  min[axis] = Math.min(min[axis], mesh.positions[i]);
  max[axis] = Math.max(max[axis], mesh.positions[i]);
}
const glb = Buffer.from(
  encodeGlb(
    mesh,
    mesh.groups.map((group) => {
      const s = used.get(`${group.slot}:${group.materialRef}`);
      return {
        name: s.graph ?? s.slot,
        roughness: s.roughness,
        metallic: s.metallic,
        ...(s.graph
          ? { sharedSurface: { ref: group.materialRef, slot: s.slot, uv: 'repeats' } }
          : {}),
      };
    }),
    'Molen original Gamla bron, Umeå',
  ),
);
const spec = {
  ...asset,
  category: 'bridge',
  quality: 'detailed',
  actualBounds: { min, max },
  geometrySource:
    'Original deterministic Molen mesh from documented identity, published overall length and span count, plus separately labeled photographic reconstruction. No third-party mesh or image is embedded.',
  sourceLicense:
    'Original geometry under the repository license. OSM dimensional evidence © OpenStreetMap contributors, ODbL. Reference photographs retain the licenses cited below and are not redistributed or used as textures.',
  referencePhotographs: [
    {
      url: asset.referencePages[4],
      author: 'Axel Pettersson',
      date: '2023-10-16',
      license: 'CC BY 4.0',
      usage: 'Visual reference only; not embedded or copied as texture.',
    },
    {
      url: asset.referencePages[5],
      author: 'Mikael Lindmark',
      date: '2007-06-24',
      license: 'CC BY-SA 2.5',
      usage: 'Visual reference only; contemporary model omits historic overhead street-lamp arms.',
    },
    {
      url: asset.referencePages[3],
      author: 'Umeå kommun',
      date: '2022-03-04',
      usage: 'Municipal reference image and ten-arch-pair description; no image redistribution.',
    },
  ],
  materialMethod:
    'Canonical shared granite, painted metal and plain timber with metric UV repeats and component vertex tints. No embedded bitmaps or baked lighting.',
  sharedSurfaces: [...used.entries()]
    .filter(([, s]) => s.graph)
    .map(([, s]) => ({
      ref: `matgraph:molen.worldgen.material.${s.graph}`,
      slot: s.slot,
      uv: 'repeats',
      repeatMeters: MATERIAL_REPEAT_METERS[s.graph],
    })),
  fidelityTarget: 'maximum',
  geographicProposal: asset.geographicProposal,
  reviewStatus: 'Source geometry; rendered visual review and maximum-fidelity review pending.',
  geographicStatus:
    'Signed NNE longitudinal axis from exact bridge outline; downstream pipe and pole line face ESE. Provisional river-surface datum; see proposal.',
  importOptions: { optimize: false },
  importReason:
    'Whole-bridge position quantization at 309 m extent can erase small steel flanges, rail bars, bolt heads and masonry joints. Preserve the authored source until measured LODs are available.',
  qaCameras: [
    { name: 'near-bowstring', position: [-13, 11, 34], lookAt: [-15.05, 7, 0] },
    { name: 'near-trestle-and-pipe', position: [10, 4.4, 17], lookAt: [0, 3.9, 0] },
    { name: 'near-deck', position: [-38, 8.4, 1], lookAt: [-9, 7.2, 0] },
    { name: 'far-crossing', position: [125, 80, 340], lookAt: [0, 6, 0] },
  ],
};
const scene = {
  format: 'molen/scene@3',
  name: 'Gamla bron, Umeå asset preview',
  seed: 'n0003_gamla_bron',
  tickRate: 30,
  entities: [
    {
      id: 'structure',
      components: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'gltf', ref: asset.assetId, shadows: { cast: true, receive: true } },
      },
    },
    {
      id: 'water-reference',
      components: {
        transform: { pos: [0, -0.17, 0], rot: [0, 0, 0, 1], scale: [450, 0.2, 170] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#476b79',
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
  camera: { mode: 'fixed', position: [-45, 18, 48], lookAt: [-4, 5.9, 0], fov: 38 },
  physics: { engine: 'none' },
};
const existing = await readdir(dir).catch((error) => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
const optional = existing
  .filter((name) => name.endsWith('-report.json') || ['qa.json', 'map-frame.json'].includes(name))
  .sort();
const source = {
  format: 'molen/source-bundle@1',
  id: asset.assetId,
  kind: 'static-structure',
  title: asset.title,
  files: {
    definitions: ['spec.json', 'scene.json'],
    models: [
      {
        path: 'models/source.glb',
        assetId: asset.assetId,
        output: structureAssetSidecarPath(asset.assetId),
        pipeline: 'import',
        sha256: hash(glb),
      },
    ],
    scripts: [],
    textures: [],
    sounds: [],
    documents: ['README.md', 'preview.png', ...optional],
  },
};
const readme = `# Gamla bron, Umeå — N0003\n\n![Lit Molen preview](preview.png)\n\n${asset.visualBrief}\n\n## Identity and evidence\n\nThis is **Wikidata Q3603782**, the old bridge in Umeå, Sweden. The municipality dates its opening to 1863. The heritage inventory records **301 m and ten spans**; the current steel structure dates to 1894–1895. Original 2023 and municipal 2022 photographs establish the shallow polygonal bowstring trusses **above** the deck, open steel trestles, rounded masonry piers, utility pipe and pole line.\n\nThe exact-identity OSM outline has a **309.007 × 6.695 m envelope**. That envelope is retained separately from the nominal 301 m structural length. This model divides the published structure into ten equal 30.1 m spans and adds compact abutments to a 309 m full extent; the published structural length and mapped envelope remain distinct; the short abutment extensions are a photographic reconstruction.\n\n## Original geometry\n\nAuthored in \`packages/worldgen/scripts/gamla-bron-model.mjs\`: paired bowstrings and lattice webs, built-up I-section chords and trestles, gussets and bolt heads, deck boards and joists, three-bar railings, masonry course seams, pipe collars and brackets, utility poles and wire, and low lighting fittings.\n\n${mesh.triangleCount.toLocaleString('en-US')} source triangles; ${mesh.vertexCount.toLocaleString('en-US')} vertices; ${mesh.groups.length} material groups; ${glb.length.toLocaleString('en-US')} bytes. SHA-256: \`${hash(glb)}\`. Actual bounds: ${min.map((v) => v.toFixed(3)).join(', ')} to ${max.map((v) => v.toFixed(3)).join(', ')} m.\n\nUp +Y, bridge length +X, transverse +Z. Origin is the horizontal midpoint of the nominal span system. **Y=0 is the reconstructed exposed-pier/river surface**, provisionally sea-level zero in the viewer. Native +X faces NNE toward the city bank, and +Z carries the downstream ESE pipe and pole line. Seasonal river level and exact bank grading depend on host data.\n\n## Sources and rights\n\n${asset.referencePages.map((url) => `- ${url}`).join('\n')}\n\nThe 2023 original photograph is by Axel Pettersson (CC BY 4.0); the 2007 photograph is by Mikael Lindmark (CC BY-SA 2.5). Both are visual research references, with no photographic content embedded or redistributed. Municipal and contractor references retain their own rights. OSM dimensional evidence © OpenStreetMap contributors, ODbL. Geometry is original and follows the repository license.\n\n## Verification and limitations\n\n${asset.limitations.map((value) => `- ${value}`).join('\n')}\n\nThe deck height, truss rise, widths, steel sections, individual stone/fastener patterns, utility fittings and equal span stationing are photo-proportioned estimates. No engineering drawing or vertical survey has validated these details. Surfaces use canonical shared granite, painted metal and plain timber with metric UVs and original component tints. Timber grain runs across the deck along each plank and vertically on the utility poles. This is a detailed exterior reconstruction; current rendered, placement and fidelity approvals are recorded in qa.json.\n\nRegenerate with \`node packages/worldgen/scripts/generate-gamla-bron.mjs\`; verify reproducibility with \`--check\`. The generator protects artist-edited masters against the source-manifest hash, and preserves existing QA/import/capture documents. Import through the normal Molen workflow with optimization disabled. The source scene and named near/far QA cameras are ready for rendered review; see the capture/QA documents when present.\n`;
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
