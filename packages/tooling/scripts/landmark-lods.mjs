// Deterministic runtime derivatives. Canonical imports and source masters are read-only.
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Document, NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { copyToDocument, prune, uninstance, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { convexDerivative } from './landmark-hulls.mjs';

export const LANDMARK_LOD_RECIPE = 1;
export const LANDMARK_LOD_LEVELS = [
  { name: 'skyline', triangles: 1000 },
  { name: 'district', triangles: 4000 },
  { name: 'street', triangles: 16000 },
  { name: 'closeup', triangles: 64000 },
];
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const MAX_EXACT_DRAW_CALLS = 12;
const recipeHash = hash(
  (
    (await readFile(new URL(import.meta.url), 'utf8')) +
    (await readFile(new URL('./landmark-hulls.mjs', import.meta.url), 'utf8'))
  ).replace(/\r\n?/g, '\n'),
);
const logger = { debug() {}, info() {}, warn: console.warn, error: console.error };
const io = () =>
  new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(logger)
    .setVertexLayout(VertexLayout.SEPARATE);

function transform(point, matrix) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function instances(document) {
  const result = [];
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (!scene) throw new Error('Model has no scene');
  scene.traverse((node) => {
    if (node.getSkin()) throw new Error('Landmark LODs require static models');
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (primitive.getMode() !== 4 || primitive.listTargets().length)
        throw new Error('Landmark LODs require static triangles');
      result.push({ primitive, matrix });
    }
  });
  return result;
}

function removeSharedFallbackImages(document) {
  for (const material of document.getRoot().listMaterials()) {
    if (!material.getExtras().molenSurface?.ref) continue;
    material
      .setBaseColorTexture(null)
      .setMetallicRoughnessTexture(null)
      .setNormalTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null);
  }
}

/** Material-preserving spatial welding removes subpixel disconnected trim before QEM.
 * Merely simplifying the master leaves millions of disconnected window-frame triangles.
 * UVs and vertex tint are sampled from the retained source vertices; source material extras
 * (including shared-surface references) are copied unchanged. No bounding-box substitutes.
 */
function cluster(parts, grid, bounds, flat = false, minimumCells = 12) {
  // Long bridges must keep their narrow decks instead of collapsing onto a line.
  const steps = bounds.max.map((value, axis) =>
    Math.min(grid, Math.max(0.00001, (value - bounds.min[axis]) / minimumCells)),
  );
  const groups = new Map();
  for (const { primitive, matrix } of parts) {
    const mirrored =
      matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
        matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
        matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2]) <
      0;
    const originalMaterial = primitive.getMaterial();
    const material = flat ? null : originalMaterial;
    const factor = flat ? (originalMaterial?.getBaseColorFactor() ?? [1, 1, 1, 1]) : [1, 1, 1, 1];
    let group = groups.get(material);
    if (!group) {
      group = { material, vertices: [], indices: [], keys: new Map(), faces: new Set() };
      groups.set(material, group);
    }
    const position = primitive.getAttribute('POSITION');
    const uv = primitive.getAttribute('TEXCOORD_0');
    const color = primitive.getAttribute('COLOR_0');
    const indices = primitive.getIndices();
    const count = indices?.getCount() ?? position.getCount();
    const cache = new Int32Array(position.getCount()).fill(-1);
    const get = (index) => {
      if (cache[index] >= 0) return cache[index];
      const p = transform(position.getElement(index, []), matrix);
      const cell = p.map((value, axis) => Math.round((value - bounds.min[axis]) / steps[axis]));
      const key = cell.join(',');
      let found = group.keys.get(key);
      if (found === undefined) {
        found = group.vertices.length;
        group.keys.set(key, found);
        group.vertices.push({
          position: [...p],
          samples: 1,
          minimum: [...p],
          maximum: [...p],
          uv: uv?.getElement(index, []) ?? [0, 0],
          color: (color?.getElement(index, []) ?? [1, 1, 1]).map(
            (value, axis) => value * factor[axis],
          ),
        });
      } else {
        const vertex = group.vertices[found];
        vertex.samples++;
        for (let axis = 0; axis < 3; axis++) {
          vertex.position[axis] += p[axis];
          vertex.minimum[axis] = Math.min(vertex.minimum[axis], p[axis]);
          vertex.maximum[axis] = Math.max(vertex.maximum[axis], p[axis]);
        }
      }
      cache[index] = found;
      return found;
    };
    for (let i = 0; i < count; i += 3) {
      const a = get(indices ? indices.getScalar(i) : i);
      const b = get(indices ? indices.getScalar(i + 1) : i + 1);
      const c = get(indices ? indices.getScalar(i + 2) : i + 2);
      if (a === b || b === c || c === a) continue;
      const key = [a, b, c].sort((x, y) => x - y).join(',');
      if (group.faces.has(key)) continue;
      group.faces.add(key);
      group.indices.push(a, mirrored ? c : b, mirrored ? b : c);
    }
  }
  for (const group of groups.values())
    for (const vertex of group.vertices)
      vertex.position = vertex.position.map((value, axis) => {
        // Keep bridge endpoints and skyline extrema at their surveyed extent.
        if (Math.abs(vertex.minimum[axis] - bounds.min[axis]) < 0.001) return vertex.minimum[axis];
        if (Math.abs(vertex.maximum[axis] - bounds.max[axis]) < 0.001) return vertex.maximum[axis];
        return value / vertex.samples;
      });
  return [...groups.values()].filter((group) => group.indices.length);
}

/** Largest geometric error a level may take to meet its triangle target, as extent fractions. */
const MAXIMUM_ERROR = { 4000: 0.02, 16000: 0.006, 64000: 0.0015 };

const componentCache = new WeakMap();
function reduceComponents(parts, bounds, target) {
  const extent = Math.max(...bounds.max.map((v, a) => v - bounds.min[a]));
  let data = componentCache.get(parts);
  if (!data) {
    const groups = cluster(parts, Math.max(1e-6, extent * 1e-8), bounds, false);
    const components = [];
    for (const group of groups) {
      group.positions = new Float32Array(group.vertices.flatMap((v) => v.position));
      const parent = Int32Array.from({ length: group.vertices.length }, (_, i) => i);
      const find = (value) => {
        while (parent[value] !== value) {
          parent[value] = parent[parent[value]];
          value = parent[value];
        }
        return value;
      };
      for (let i = 0; i < group.indices.length; i += 3) {
        const a = find(group.indices[i]);
        parent[find(group.indices[i + 1])] = a;
        parent[find(group.indices[i + 2])] = a;
      }
      const found = new Map();
      for (let i = 0; i < group.indices.length; i += 3) {
        const ids = group.indices.slice(i, i + 3),
          root = find(ids[0]);
        let component = found.get(root);
        if (!component) {
          component = {
            group,
            indices: [],
            area: 0,
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
          };
          found.set(root, component);
          components.push(component);
        }
        component.indices.push(...ids);
        const [a, b, c] = ids.map((id) => group.vertices[id].position),
          u = b.map((v, d) => v - a[d]),
          v = c.map((v, d) => v - a[d]);
        for (const p of [a, b, c])
          for (let axis = 0; axis < 3; axis++) {
            component.min[axis] = Math.min(component.min[axis], p[axis]);
            component.max[axis] = Math.max(component.max[axis], p[axis]);
          }
        component.area += Math.hypot(
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        );
      }
      // The exact weld's lookup maps are no longer needed after connected components exist.
      group.keys.clear();
      group.faces.clear();
      group.indices = [];
    }
    components.sort((a, b) => b.area - a.area);
    data = { groups, components };
    componentCache.set(parts, data);
  }
  const threshold = extent / (Math.sqrt(target) * 16);
  const select = (width, allowance, smallestFirst) => {
    const areas = new Map();
    for (const component of data.components) {
      const current = areas.get(component.group) ?? { total: 0, removed: 0 };
      current.total += component.area;
      areas.set(component.group, current);
    }
    const retained = new Map();
    const order = smallestFirst ? [...data.components].reverse() : data.components;
    for (const component of order) {
      const span = component.max.map((v, a) => v - component.min[a]).sort((a, b) => a - b);
      const area = areas.get(component.group);
      if (span[1] < width && area.removed + component.area <= area.total * allowance) {
        area.removed += component.area;
        continue;
      }
      let list = retained.get(component.group);
      if (!list) {
        list = [];
        retained.set(component.group, list);
      }
      for (const id of component.indices) list.push(id);
    }
    return retained;
  };
  const simplify = (retained, budget, flags) => {
    const count = [...retained.values()].reduce((sum, list) => sum + list.length, 0) / 3;
    const ratio = Math.min(1, target / count);
    const groups = [];
    let error = threshold;
    for (const [group, list] of retained) {
      const [indices, deviation] = MeshoptSimplifier.simplify(
        new Uint32Array(list),
        group.positions,
        3,
        Math.max(3, Math.floor((list.length * ratio) / 3) * 3),
        budget,
        flags,
      );
      error = Math.max(error, threshold + deviation, flags.includes('Prune') ? budget : 0);
      if (indices.length) groups.push({ ...group, indices });
    }
    return {
      groups,
      triangles: groups.reduce((sum, g) => sum + g.indices.length / 3, 0),
      grid: error,
    };
  };
  // Drop narrow trim only within a 2% surface-area allowance for its material, then simplify
  // at the level's natural error. A level that keeps its main surfaces that way is done.
  const trimmed = select(threshold, 0.02, false);
  let result = simplify(trimmed, threshold, ['ErrorAbsolute']);
  // A dense master (seat rows, mullions, lattice, cables) is not: medium-fi levels must meet
  // their triangle targets, so the error budget doubles and meshoptimizer prunes isolated parts
  // that fall under it. The recorded error grows with it, so the streamer uses the level from
  // farther away. The cap depends on how close a level is seen: up to 2% of the model's extent
  // for district, 0.6% for street, and 0.15% for the closeup, which has no finer level behind it.
  const maximum = extent * (MAXIMUM_ERROR[target] ?? 0.02);
  for (
    let budget = threshold * 2;
    result.triangles > target * 1.15 && budget <= maximum * 2;
    budget *= 2
  )
    result = simplify(trimmed, Math.min(budget, maximum), ['ErrorAbsolute', 'Prune']);
  // Full-height fins and frames are long, so pruning keeps them, yet too thin to see at the
  // level's error, and a box cannot simplify below twelve triangles. Drop components thinner
  // than the error, smallest first, up to a quarter of each material's surface.
  if (result.triangles > target * 1.15)
    result = simplify(select(maximum, 0.25, true), maximum, ['ErrorAbsolute', 'Prune']);
  return result;
}

async function derivative(source, parts, bounds, target, flat = false) {
  const sourceTriangles = parts.reduce(
    (sum, { primitive }) =>
      sum +
      (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3,
    0,
  );
  // Sparse authored models already fit the first-download budget. Keep their openings,
  // supports and antennae instead of enclosing those features in convex cells.
  const extent = Math.max(...bounds.max.map((v, a) => v - bounds.min[a]));
  const best = flat
    ? sourceTriangles <= 3000
      ? {
          groups: cluster(parts, Math.max(1e-6, extent * 1e-8), bounds, true),
          triangles: sourceTriangles,
          grid: extent / 1000,
        }
      : convexDerivative(parts, bounds, target, true)
    : reduceComponents(parts, bounds, target);
  if (!best?.triangles) throw new Error('Reduction removed the whole model');
  const errorMeters = best.grid * (flat ? 2 : 1);
  const result = new Document().setLogger(logger);
  const buffer = result.createBuffer();
  const scene = result.createScene();
  result.getRoot().setDefaultScene(scene);
  const mesh = result.createMesh('runtime-landmark');
  scene.addChild(result.createNode('runtime-landmark').setMesh(mesh));
  const materials = [...new Set(best.groups.map((group) => group.material).filter(Boolean))];
  const copied = copyToDocument(result, source, materials);
  const skylineMaterial = flat
    ? result.createMaterial('landmark-skyline').setRoughnessFactor(0.85)
    : undefined;
  let triangles = 0;
  for (const group of best.groups) {
    if (!group.indices.length) continue;
    const p = [],
      n = [],
      uv = [],
      tint = [];
    for (let i = 0; i < group.indices.length; i += 3) {
      const vertices = Array.from(group.indices.slice(i, i + 3), (index) => group.vertices[index]);
      const [a, b, c] = vertices.map((vertex) => vertex.position);
      const u = b.map((value, axis) => value - a[axis]);
      const v = c.map((value, axis) => value - a[axis]);
      const normal = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      const length = Math.hypot(...normal);
      if (length < 1e-12) continue;
      triangles++;
      for (const vertex of vertices) {
        p.push(...vertex.position);
        n.push(...normal.map((value) => value / length));
        uv.push(...vertex.uv.slice(0, 2));
        tint.push(
          ...vertex.color
            .slice(0, 3)
            .map((value) => Math.round(Math.min(1, Math.max(0, value)) * 255)),
        );
      }
    }
    if (!p.length) continue;
    const attribute = (type, array) =>
      result.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const primitive = result
      .createPrimitive()
      .setAttribute('POSITION', attribute('VEC3', new Float32Array(p)))
      .setAttribute('COLOR_0', attribute('VEC3', new Uint8Array(tint)).setNormalized(true));
    // The distant silhouette has no textures. GLTFLoader derives flat face normals
    // in the shader when NORMAL is omitted, avoiding two unused attribute streams.
    if (!flat)
      primitive
        .setAttribute('NORMAL', attribute('VEC3', new Float32Array(n)))
        .setAttribute('TEXCOORD_0', attribute('VEC2', new Float32Array(uv)));
    if (group.material) primitive.setMaterial(copied.get(group.material));
    else if (skylineMaterial) primitive.setMaterial(skylineMaterial);
    mesh.addPrimitive(primitive);
  }
  await result.transform(
    weld({ tolerance: 0 }),
    prune({ keepAttributes: true, keepSolidTextures: true }),
  );
  const bytes = await io().writeBinary(result);
  // Separate attribute streams are uploaded once each, even with mixed component types.
  const encoded = Buffer.from(bytes);
  const gltf = JSON.parse(encoded.toString('utf8', 20, 20 + encoded.readUInt32LE(12)));
  const geometryBytes = gltf.bufferViews.reduce((sum, view) => sum + view.byteLength, 0);
  return {
    bytes,
    triangles,
    sourceTriangles,
    geometryBytes,
    errorMeters,
    grid: best.grid,
    drawCalls: mesh.listPrimitives().length,
  };
}

export async function buildLandmarkLods(sidecarPath, { force = false } = {}) {
  await MeshoptSimplifier.ready;
  const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
  const directory = dirname(sidecarPath);
  const master = await readFile(join(directory, sidecar.files.main));
  if (hash(master) !== sidecar.hash) throw new Error(`${sidecar.id}: stale master import`);
  if (
    !force &&
    sidecar.runtimeLods?.recipe === LANDMARK_LOD_RECIPE &&
    sidecar.runtimeLods.recipeHash === recipeHash &&
    sidecar.runtimeLods.masterHash === sidecar.hash
  ) {
    let current = true;
    for (const level of sidecar.runtimeLods.levels) {
      try {
        if (hash(await readFile(join(directory, level.file))) !== level.hash) current = false;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        current = false;
      }
    }
    if (current && sidecar.runtimeLods.levels.length === 4) return sidecar.runtimeLods;
  }
  const source = await io().readBinary(master);
  if (source.getRoot().listAnimations().length)
    throw new Error('Animated assets need authored LODs');
  removeSharedFallbackImages(source);
  await source.transform(prune({ keepAttributes: true, keepSolidTextures: true }), uninstance());
  const parts = instances(source);
  const triangleCount = parts.reduce(
    (sum, { primitive }) =>
      sum +
      (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3,
    0,
  );
  const positions = new Set(
    source
      .getRoot()
      .listMeshes()
      .flatMap((mesh) =>
        mesh.listPrimitives().map((primitive) => primitive.getAttribute('POSITION')),
      ),
  );
  sidecar.stats.vertices = [...positions].reduce((sum, position) => sum + position.getCount(), 0);
  // A master under the closeup target is shipped as is, unless it would draw more than the
  // medium-fi closeup's 12 calls: an assembly of instanced parts then gets the material-merged
  // derivative instead. GPU-instanced meshes draw once per primitive, not once per instance.
  const masterDocument = await io().readBinary(master);
  const masterDrawCalls = masterDocument
    .getRoot()
    .listMeshes()
    .reduce((sum, mesh) => sum + mesh.listPrimitives().length, 0);
  let exact;
  if (
    triangleCount <= LANDMARK_LOD_LEVELS.at(-1).triangles &&
    masterDrawCalls <= MAX_EXACT_DRAW_CALLS
  ) {
    const original = await io().readBinary(master);
    removeSharedFallbackImages(original);
    await original.transform(prune({ keepAttributes: true, keepSolidTextures: true }));
    const bytes = await io().writeBinary(original);
    const gltf = JSON.parse(
      Buffer.from(bytes).toString(
        'utf8',
        20,
        20 + new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true),
      ),
    );
    const views = new Set();
    for (const mesh of gltf.meshes)
      for (const primitive of mesh.primitives) {
        for (const accessor of [
          ...Object.values(primitive.attributes),
          ...(primitive.indices === undefined ? [] : [primitive.indices]),
        ])
          views.add(gltf.accessors[accessor].bufferView);
      }
    const geometryBytes = [...views].reduce(
      (sum, index) => sum + gltf.bufferViews[index].byteLength,
      0,
    );
    let instanceBytes = 0;
    for (const node of gltf.nodes ?? []) {
      const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
      if (attributes) instanceBytes += gltf.accessors[Object.values(attributes)[0]].count * 128;
    }
    exact = {
      bytes,
      triangles: triangleCount,
      geometryBytes: geometryBytes + instanceBytes,
      errorMeters: 0,
      drawCalls: masterDrawCalls,
    };
  }
  const levels = [];
  for (const level of LANDMARK_LOD_LEVELS) {
    const output =
      level.name !== 'skyline' && exact && triangleCount <= level.triangles
        ? exact
        : await derivative(
            source,
            parts,
            sidecar.bounds.aabb,
            level.triangles,
            level.name === 'skyline',
          );
    const file = `model.${level.name}.glb`;
    await writeFile(join(directory, file), output.bytes);
    sidecar.files.variants ??= {};
    sidecar.files.variants[level.name] = file;
    levels.push({
      name: level.name,
      file,
      hash: hash(output.bytes),
      bytes: output.bytes.length,
      gzipBytes: gzipSync(output.bytes, { level: 6 }).length,
      triangles: output.triangles,
      cpuBytes: output.geometryBytes,
      gpuBytes: output.geometryBytes,
      errorMeters: output.errorMeters,
      drawCalls: output.drawCalls,
    });
  }
  sidecar.runtimeLods = {
    recipe: LANDMARK_LOD_RECIPE,
    recipeHash,
    masterHash: sidecar.hash,
    levels,
  };
  await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  return sidecar.runtimeLods;
}
