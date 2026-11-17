/**
 * Emit one dedicated place master from a geometry recipe: shared-surface UVs, smoothed normals
 * where a surface asks for them, the source GLB, spec, review scene, source manifest and README.
 *
 * A recipe builds into a plain MeshBufferBuilder using its surface names as slots (the
 * structure-mesh helpers pass a placeholder material). Every triangle is then reprojected onto
 * its surface: a shared material graph gets world-metre UVs at the graph's repeat, a local
 * material keeps a flat palette. Geometry stays in the bundle's own frame (footprint.json):
 * +Y up from the ground at the anchor, +X along the placement heading.
 */
import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { cross, normalize, validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { biomeJson } from './format-json.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const slotOrder = ['wall', 'roof', 'trim', 'foundation', 'window', 'door'];
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const posix = (value) => value.replaceAll('\\', '/');

/** Smooth coincident normals across modest angles, for the selected recipe surfaces only. */
function smoothSurfaces(mesh, angles) {
  const selected = new Map();
  for (const group of mesh.groups) {
    const angle = angles[group.slot];
    if (angle === undefined) continue;
    for (let i = group.start; i < group.start + group.count; i++)
      selected.set(mesh.indices[i], Math.cos((angle * Math.PI) / 180));
  }
  const buckets = new Map();
  for (const index of selected.keys()) {
    const key = [0, 1, 2]
      .map((axis) => Math.round(mesh.positions[index * 3 + axis] * 10000))
      .join(',');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(index);
  }
  const original = mesh.normals.slice();
  for (const bucket of buckets.values())
    for (const index of bucket) {
      const cosine = selected.get(index);
      const sum = [0, 0, 0];
      for (const other of bucket) {
        let dot = 0;
        for (let axis = 0; axis < 3; axis++)
          dot += original[index * 3 + axis] * original[other * 3 + axis];
        if (dot < cosine) continue;
        for (let axis = 0; axis < 3; axis++) sum[axis] += original[other * 3 + axis];
      }
      const smooth = normalize(sum);
      for (let axis = 0; axis < 3; axis++) mesh.normals[index * 3 + axis] = smooth[axis];
    }
}

/** Reproject a recipe mesh onto glTF material groups with per-surface UVs and colors. */
function project(raw, surfaces, smooth, name) {
  const parts = new Map();
  for (const group of raw.groups) {
    const surface = surfaces[group.slot];
    if (!surface) throw new Error(`${name}: unknown surface "${group.slot}"`);
    if (!slotOrder.includes(surface.slot))
      throw new Error(`${name}: surface "${group.slot}" has invalid slot ${surface.slot}`);
    const ref = surface.graph
      ? `matgraph:molen.worldgen.material.${surface.graph}`
      : (surface.localRef ?? 'palette:#ffffff');
    const repeat = surface.graph ? MATERIAL_REPEAT_METERS[surface.graph] : [1, 1];
    if (!repeat) throw new Error(`${name}: no repeat for material graph ${surface.graph}`);
    const key = `${surface.slot}\u0000${ref}`;
    let part = parts.get(key);
    if (!part) {
      part = { slot: surface.slot, ref, surface, positions: [], normals: [], uvs: [], colors: [] };
      parts.set(key, part);
    } else
      for (const field of ['roughness', 'metallic', 'doubleSided', 'alphaMode'])
        if (part.surface[field] !== surface[field])
          throw new Error(`${name}: surfaces sharing ${surface.slot}/${ref} disagree on ${field}`);
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const ids = [raw.indices[i], raw.indices[i + 1], raw.indices[i + 2]];
      const p = ids.map((id) => Array.from(raw.positions.subarray(id * 3, id * 3 + 3)));
      const face = normalize(
        cross(
          p[1].map((v, axis) => v - p[0][axis]),
          p[2].map((v, axis) => v - p[0][axis]),
        ),
      );
      const u = Math.abs(face[1]) < 0.98 ? normalize([face[2], 0, -face[0]]) : [1, 0, 0];
      const v = normalize(cross(face, u));
      for (const [corner, id] of ids.entries()) {
        const q = p[corner];
        part.positions.push(...q);
        part.normals.push(
          ...(smooth[group.slot] === undefined
            ? face
            : Array.from(raw.normals.subarray(id * 3, id * 3 + 3))),
        );
        part.uvs.push(
          (q[0] * u[0] + q[1] * u[1] + q[2] * u[2]) / repeat[0],
          (q[0] * v[0] + q[1] * v[1] + q[2] * v[2]) / repeat[1],
        );
        part.colors.push(...raw.colors.subarray(id * 3, id * 3 + 3));
      }
    }
  }
  const ordered = [...parts.values()].sort(
    (a, b) =>
      slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot) ||
      (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0),
  );
  const vertexCount = ordered.reduce((sum, part) => sum + part.positions.length / 3, 0);
  const mesh = {
    positions: new Float32Array(vertexCount * 3),
    normals: new Float32Array(vertexCount * 3),
    uvs: new Float32Array(vertexCount * 2),
    colors: new Uint8Array(vertexCount * 3),
    indices: new Uint32Array(vertexCount),
    groups: [],
    vertexCount,
    triangleCount: vertexCount / 3,
    bytes: 0,
  };
  let offset = 0;
  for (const part of ordered) {
    const count = part.positions.length / 3;
    mesh.positions.set(part.positions, offset * 3);
    mesh.normals.set(part.normals, offset * 3);
    mesh.uvs.set(part.uvs, offset * 2);
    mesh.colors.set(part.colors, offset * 3);
    for (let i = 0; i < count; i++) mesh.indices[offset + i] = offset + i;
    mesh.groups.push({ start: offset, count, slot: part.slot, materialRef: part.ref });
    offset += count;
  }
  mesh.bytes =
    mesh.positions.byteLength +
    mesh.normals.byteLength +
    mesh.uvs.byteLength +
    mesh.colors.byteLength +
    mesh.indices.byteLength;
  return { mesh, parts: ordered };
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  const round = (value) => Math.round(value * 1000) / 1000;
  return { min: min.map(round), max: max.map(round) };
}

function reviewScene(assetId, title, box, camera) {
  const size = box.max.map((v, i) => v - box.min[i]);
  const center = box.min.map((v, i) => (v + box.max[i]) / 2);
  const span = Math.max(size[0], size[2]);
  const far = Math.max(span * 0.95, size[1] * 1.25);
  const round = (value) => Math.round(value * 100) / 100;
  return {
    format: 'molen/scene@3',
    name: `${title} model review`,
    seed: assetId,
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
            pos: [round(center[0]), -0.16, round(center[2])],
            rot: [0, 0, 0, 1],
            scale: [round(span * 1.6), 0.3, round(span * 1.6)],
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
    camera: {
      mode: 'fixed',
      position: camera?.position ?? [
        round(center[0] + far * 0.7),
        round(Math.max(size[1] * 0.75, 14)),
        round(center[2] + far * 0.9),
      ],
      lookAt: camera?.lookAt ?? [round(center[0]), round(size[1] * 0.4), round(center[2])],
      fov: 42,
    },
    physics: { engine: 'none' },
  };
}

/**
 * @param {object} model
 * @param {string} model.generator import.meta.url of `<bundle>/models/generate-*.mjs`
 * @param {string} model.planId catalog identity kept by the bundle (e.g. A12)
 * @param {string} [model.assetKey] asset key when it differs from the bundle folder name
 * @param {string} model.title
 * @param {string} model.brief one-paragraph visual brief: what the model shows
 * @param {string} [model.wikidataId]
 * @param {Record<string, {slot: string, graph?: string, localRef?: string, roughness: number, metallic: number, doubleSided?: boolean}>} model.surfaces
 * @param {(out: MeshBufferBuilder) => void} model.build geometry in metres, slots = surface names
 * @param {Record<string, number>} [model.smooth] surface name -> max smoothing angle (degrees)
 * @param {{fact: string, source: string}[]} model.dimensions sourced controls the recipe follows
 * @param {string[]} model.limitations what is estimated or omitted
 * @param {{position: number[], lookAt: number[]}} [model.camera] review-scene camera
 */
export async function emitPlaceMaster(model) {
  const generatorPath = fileURLToPath(model.generator);
  const dir = path.resolve(path.dirname(generatorPath), '..');
  const key = path.basename(dir);
  // Catalog bundles are named after their asset (a12_…); older reference bundles such as
  // space-needle keep a folder name that differs from their asset key.
  const assetId = `molen.worldgen.structure.${model.assetKey ?? key}`;
  const sourcePath = posix(path.relative(root, dir));
  const generatorName = path.basename(generatorPath);
  const check = process.argv.includes('--check');
  if (!model.assetKey && !key.startsWith(model.planId.toLowerCase()))
    throw new Error(`${key}: bundle does not belong to plan entry ${model.planId}`);
  const frame = JSON.parse(fs.readFileSync(path.join(dir, 'footprint.json'), 'utf8'));

  const out = new MeshBufferBuilder();
  model.build(out);
  const raw = out.finalize();
  if (model.smooth) {
    const before = raw.normals.slice();
    smoothSurfaces(raw, model.smooth);
    if (before.length !== raw.normals.length) throw new Error(`${key}: smoothing changed layout`);
  }
  const { mesh, parts } = project(raw, model.surfaces, model.smooth ?? {}, key);
  validateAuthoredMesh(mesh, key);
  const glb = Buffer.from(
    encodeGlb(
      mesh,
      parts.map(({ surface, ref, slot }) => ({
        name: surface.graph ?? `${slot}-${ref.replace(/^palette:#/, '')}`,
        roughness: surface.roughness,
        metallic: surface.metallic,
        ...(surface.doubleSided ? { doubleSided: true } : {}),
        ...(surface.graph ? { sharedSurface: { ref, slot, uv: 'repeats' } } : {}),
      })),
      model.title,
    ),
  );
  const box = bounds(mesh.positions);
  const size = box.max.map((v, i) => Math.round((v - box.min[i]) * 100) / 100);
  const limitations = [
    ...model.limitations,
    'Original deterministic geometry from mapped footprints, published dimensions and general knowledge of the building; not a survey, photogrammetric reconstruction or replica of any third-party model. No photographs or generated bitmaps are embedded.',
  ];
  const spec = {
    planId: model.planId,
    id: assetId,
    title: model.title,
    ...(model.wikidataId ? { wikidataId: model.wikidataId } : {}),
    visualBrief: model.brief,
    size,
    actualBounds: box,
    scaleBasis:
      'Measured: plan from the mapped footprint in footprint.json, heights from the sourced dimensions below.',
    geometrySource: `Original deterministic Molen mesh generator models/${generatorName}; no third-party model or bitmap texture.`,
    dimensions: model.dimensions,
    geographicFrame: {
      anchor: frame.anchor,
      heading: frame.heading,
      groundAtAnchor: frame.groundAtAnchor,
      basis: 'footprint.json',
    },
    appearance: {
      standard: 'docs-src/guide/medium-fi.md',
      colorEncoding: 'sRGB palette decoded to linear COLOR_0',
    },
    sharedSurfaces: parts
      .filter(({ surface }) => surface.graph)
      .map(({ ref, slot, surface }) => ({
        ref,
        slot,
        uv: 'repeats',
        repeatMeters: MATERIAL_REPEAT_METERS[surface.graph],
      })),
    limitations,
    importOptions: { optimize: false },
    mesh: {
      triangles: mesh.triangleCount,
      vertices: mesh.vertexCount,
      materials: parts.length,
      bytes: glb.length,
      sha256: hash(glb),
    },
  };
  const previous = fs.existsSync(path.join(dir, 'source.json'))
    ? JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8'))
    : undefined;
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
          output: structureAssetSidecarPath(assetId),
          pipeline: 'import',
          sha256: hash(glb),
        },
      ],
      generators: [{ id: path.basename(generatorName, '.mjs'), path: `models/${generatorName}` }],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [
        'README.md',
        'footprint.json',
        ...(previous?.files?.documents ?? []).filter(
          (name) =>
            name !== 'README.md' &&
            name !== 'footprint.json' &&
            fs.existsSync(path.join(dir, name)),
        ),
      ],
    },
  };
  const preview = fs.existsSync(path.join(dir, 'preview.png'))
    ? '\n![Molen preview](preview.png)\n'
    : '';
  const readme = `# ${model.title} — ${model.planId}

${model.brief}
${preview}
Built by \`${sourcePath}/models/${generatorName}\` with the shared emitter
\`packages/worldgen/scripts/place-master-emitter.mjs\`: ${mesh.triangleCount} triangles,
${parts.length} materials, no embedded bitmaps. The runtime asset is \`${assetId}\`; its runtime
levels come from the landmark LOD generator after import.

## Frame

\`footprint.json\` holds the mapped outlines this recipe follows, already in the model frame: +X
along heading ${frame.heading} rad from the anchor [${frame.anchor.join(', ')}], +Y up from the
ground there (${frame.groundAtAnchor} m). The placement in
\`content/earth/source/placements\` uses the same anchor and heading.

## Dimensions

${model.dimensions.map((d) => `- ${d.fact} (${d.source})`).join('\n')}

## Limitations

${limitations.map((line) => `- ${line}`).join('\n')}

## Rebuild

\`\`\`sh
node ${sourcePath}/models/${generatorName}          # add --check to verify
\`\`\`
`;
  const files = [
    ['models/source.glb', glb],
    ['spec.json', spec],
    ['scene.json', reviewScene(assetId, model.title, box, model.camera)],
    ['source.json', source],
    ['README.md', readme],
  ];
  for (const [name, value] of files) {
    const file = path.join(dir, name);
    const json = !Buffer.isBuffer(value) && typeof value !== 'string';
    if (check) {
      if (!fs.existsSync(file)) throw new Error(`${file}: missing generated output`);
      const old = fs.readFileSync(file);
      const same = json
        ? JSON.stringify(JSON.parse(old.toString('utf8'))) === JSON.stringify(value)
        : Buffer.isBuffer(value)
          ? old.equals(value)
          : old.toString('utf8').replaceAll('\r\n', '\n') === value;
      if (!same) throw new Error(`${file}: generated place source is stale`);
      continue;
    }
    const bytes = json
      ? Buffer.from(biomeJson(value, file))
      : Buffer.isBuffer(value)
        ? value
        : Buffer.from(value);
    if (fs.existsSync(file) && fs.readFileSync(file).equals(bytes)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  console.log(
    JSON.stringify({
      key,
      triangles: mesh.triangleCount,
      materials: parts.length,
      size,
      sha256: hash(glb),
    }),
  );
  return { mesh, spec };
}
