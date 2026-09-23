import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from '../../../../packages/tooling/node_modules/pngjs/lib/png.js';

const { PNG } = pngjs;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const textureDir = resolve(root, 'textures');
const baseColorPath = resolve(textureDir, 'weathered-red-wood-basecolor.png');
const normalPath = resolve(textureDir, 'weathered-red-wood-normal.png');
const roughnessPath = resolve(textureDir, 'weathered-red-wood-roughness.png');
const modelPath = resolve(root, 'models/source.glb');

const sourcePng = PNG.sync.read(await readFile(baseColorPath));
const normalPng = new PNG({ width: sourcePng.width, height: sourcePng.height });
const roughnessPng = new PNG({ width: sourcePng.width, height: sourcePng.height });

function pixelOffset(x, y) {
  const wrappedX = (x + sourcePng.width) % sourcePng.width;
  const wrappedY = (y + sourcePng.height) % sourcePng.height;
  return (wrappedY * sourcePng.width + wrappedX) * 4;
}

function heightAt(x, y) {
  const offset = pixelOffset(x, y);
  const r = sourcePng.data[offset] / 255;
  const g = sourcePng.data[offset + 1] / 255;
  const b = sourcePng.data[offset + 2] / 255;
  return r * 0.24 + g * 0.66 + b * 0.1;
}

for (let y = 0; y < sourcePng.height; y++) {
  for (let x = 0; x < sourcePng.width; x++) {
    const offset = pixelOffset(x, y);
    const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 4.2;
    const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * 4.2;
    const length = Math.hypot(dx, dy, 1);
    normalPng.data[offset] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
    normalPng.data[offset + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
    normalPng.data[offset + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
    normalPng.data[offset + 3] = 255;

    const localContrast = Math.min(1, Math.abs(dx) + Math.abs(dy));
    const roughness = Math.max(0.72, Math.min(0.98, 0.82 + localContrast * 0.13));
    const channel = Math.round(roughness * 255);
    roughnessPng.data[offset] = channel;
    roughnessPng.data[offset + 1] = channel;
    roughnessPng.data[offset + 2] = 0;
    roughnessPng.data[offset + 3] = 255;
  }
}

const normalBytes = PNG.sync.write(normalPng);
const roughnessBytes = PNG.sync.write(roughnessPng);
await writeFile(normalPath, normalBytes);
await writeFile(roughnessPath, roughnessBytes);

const materials = [
  {
    name: 'weathered-red-boards',
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      metallicRoughnessTexture: { index: 1 },
      baseColorFactor: [0.92, 0.92, 0.92, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
    },
    normalTexture: { index: 2, scale: 0.78 },
  },
  {
    name: 'darker-weathered-door-boards',
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      metallicRoughnessTexture: { index: 1 },
      baseColorFactor: [0.72, 0.63, 0.58, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
    },
    normalTexture: { index: 2, scale: 0.9 },
  },
  {
    name: 'aged-cream-trim',
    pbrMetallicRoughness: {
      baseColorFactor: [0.82, 0.78, 0.65, 1],
      metallicFactor: 0,
      roughnessFactor: 0.88,
    },
  },
  {
    name: 'charcoal-metal-roof',
    pbrMetallicRoughness: {
      baseColorFactor: [0.12, 0.15, 0.16, 1],
      metallicFactor: 0.42,
      roughnessFactor: 0.66,
    },
  },
  {
    name: 'dark-window-glass',
    pbrMetallicRoughness: {
      baseColorFactor: [0.035, 0.065, 0.07, 1],
      metallicFactor: 0.18,
      roughnessFactor: 0.2,
    },
  },
  {
    name: 'rough-stone-foundation',
    pbrMetallicRoughness: {
      baseColorFactor: [0.32, 0.33, 0.31, 1],
      metallicFactor: 0,
      roughnessFactor: 0.98,
    },
  },
];

const groups = materials.map(() => ({ positions: [], normals: [], uvs: [], indices: [] }));
const identityAxes = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function transform(local, center, axes) {
  return [
    center[0] + axes[0][0] * local[0] + axes[1][0] * local[1] + axes[2][0] * local[2],
    center[1] + axes[0][1] * local[0] + axes[1][1] * local[1] + axes[2][1] * local[2],
    center[2] + axes[0][2] * local[0] + axes[1][2] * local[1] + axes[2][2] * local[2],
  ];
}

function addQuad(material, corners, normal, uvRepeat = [1, 1]) {
  const group = groups[material];
  const base = group.positions.length / 3;
  for (const point of corners) group.positions.push(...point);
  for (let i = 0; i < 4; i++) group.normals.push(...normal);
  const [u, v] = uvRepeat;
  group.uvs.push(0, 0, u, 0, u, v, 0, v);
  group.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function addTriangle(material, points, normal, uvs) {
  const group = groups[material];
  const base = group.positions.length / 3;
  for (const point of points) group.positions.push(...point);
  for (let i = 0; i < 3; i++) group.normals.push(...normal);
  group.uvs.push(...uvs);
  group.indices.push(base, base + 1, base + 2);
}

function addBox(material, center, size, axes = identityAxes, textured = false) {
  const [hx, hy, hz] = size.map((value) => value / 2);
  const p = (x, y, z) => transform([x, y, z], center, axes);
  const n = (axis, sign) => axes[axis].map((value) => value * sign);
  const repeat = (width, height) => (textured ? [Math.max(0.45, width / 5), height / 6] : [1, 1]);

  addQuad(
    material,
    [p(hx, -hy, hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(hx, hy, hz)],
    n(0, 1),
    repeat(size[2], size[1]),
  );
  addQuad(
    material,
    [p(-hx, -hy, -hz), p(-hx, -hy, hz), p(-hx, hy, hz), p(-hx, hy, -hz)],
    n(0, -1),
    repeat(size[2], size[1]),
  );
  addQuad(
    material,
    [p(-hx, hy, hz), p(hx, hy, hz), p(hx, hy, -hz), p(-hx, hy, -hz)],
    n(1, 1),
    repeat(size[0], size[2]),
  );
  addQuad(
    material,
    [p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, -hy, hz), p(-hx, -hy, hz)],
    n(1, -1),
    repeat(size[0], size[2]),
  );
  addQuad(
    material,
    [p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz)],
    n(2, 1),
    repeat(size[0], size[1]),
  );
  addQuad(
    material,
    [p(hx, -hy, -hz), p(-hx, -hy, -hz), p(-hx, hy, -hz), p(hx, hy, -hz)],
    n(2, -1),
    repeat(size[0], size[1]),
  );
}

function zRotation(angle) {
  return [
    [Math.cos(angle), Math.sin(angle), 0],
    [-Math.sin(angle), Math.cos(angle), 0],
    [0, 0, 1],
  ];
}

function sideWindow(centerZ) {
  const sideAxes = [
    [0, 0, -1],
    [0, 1, 0],
    [1, 0, 0],
  ];
  addBox(4, [5.09, 3.85, centerZ], [1.8, 1.55, 0.13], sideAxes);
  addBox(2, [5.17, 4.67, centerZ], [2.04, 0.16, 0.16], sideAxes);
  addBox(2, [5.17, 3.03, centerZ], [2.04, 0.16, 0.16], sideAxes);
  addBox(2, [5.17, 3.85, centerZ - 0.98], [0.16, 1.8, 0.16], sideAxes);
  addBox(2, [5.17, 3.85, centerZ + 0.98], [0.16, 1.8, 0.16], sideAxes);
  addBox(2, [5.18, 3.85, centerZ], [0.12, 1.55, 0.17], sideAxes);
  addBox(2, [5.18, 3.85, centerZ], [1.8, 0.12, 0.17], sideAxes);
}

// Foundation and red plank shell.
addBox(5, [0, 0.25, 0], [10.5, 0.5, 14.5]);
addBox(0, [0, 3.25, 0], [10, 6, 14], identityAxes, true);

// Front/back gable boards.
addTriangle(
  0,
  [
    [-5, 6.25, 7.01],
    [5, 6.25, 7.01],
    [0, 10.25, 7.01],
  ],
  [0, 0, 1],
  [0, 0, 2, 0, 1, 0.72],
);
addTriangle(
  0,
  [
    [5, 6.25, -7.01],
    [-5, 6.25, -7.01],
    [0, 10.25, -7.01],
  ],
  [0, 0, -1],
  [0, 0, 2, 0, 1, 0.72],
);

// Pitched roof, overhang, and ridge cap.
const run = 5.45;
const rise = 4.08;
const slope = Math.hypot(run, rise);
const cosine = run / slope;
const sine = rise / slope;
addBox(
  3,
  [run / 2, 8.21, 0],
  [slope, 0.24, 14.9],
  [
    [cosine, -sine, 0],
    [sine, cosine, 0],
    [0, 0, 1],
  ],
);
addBox(
  3,
  [-run / 2, 8.21, 0],
  [slope, 0.24, 14.9],
  [
    [cosine, sine, 0],
    [-sine, cosine, 0],
    [0, 0, 1],
  ],
);
addBox(3, [0, 10.28, 0], [0.32, 0.34, 15.05]);

// Corner boards and eave fascia.
for (const x of [-4.9, 4.9]) {
  for (const z of [-7.08, 7.08]) addBox(2, [x, 3.3, z], [0.24, 6.15, 0.18]);
}
for (const x of [-5.16, 5.16]) addBox(2, [x, 6.2, 0], [0.18, 0.28, 14.45]);

// Front sliding doors and cream braces.
for (const x of [-1.43, 1.43]) {
  addBox(1, [x, 2.8, 7.1], [2.72, 4.85, 0.16], identityAxes, true);
  const braceLength = Math.hypot(2.28, 4.08);
  const braceAngle = Math.atan2(4.08, 2.28);
  addBox(2, [x, 2.8, 7.22], [braceLength, 0.15, 0.14], zRotation(braceAngle));
  addBox(2, [x, 2.8, 7.23], [braceLength, 0.15, 0.14], zRotation(-braceAngle));
}
addBox(2, [-2.91, 2.8, 7.2], [0.2, 5.15, 0.18]);
addBox(2, [2.91, 2.8, 7.2], [0.2, 5.15, 0.18]);
addBox(2, [0, 2.8, 7.21], [0.18, 5.05, 0.18]);
addBox(2, [0, 5.34, 7.2], [6.02, 0.2, 0.18]);
addBox(3, [0, 5.55, 7.26], [6.2, 0.1, 0.12]);

// Loft window with frame and muntins.
addBox(4, [0, 7.73, 7.1], [1.55, 1.48, 0.13]);
addBox(2, [0, 8.5, 7.2], [1.83, 0.16, 0.18]);
addBox(2, [0, 6.96, 7.2], [1.83, 0.16, 0.18]);
addBox(2, [-0.86, 7.73, 7.2], [0.16, 1.7, 0.18]);
addBox(2, [0.86, 7.73, 7.2], [0.16, 1.7, 0.18]);
addBox(2, [0, 7.73, 7.22], [0.12, 1.48, 0.18]);
addBox(2, [0, 7.73, 7.22], [1.55, 0.12, 0.18]);

// White fascia follows the front gable slopes.
const fasciaLength = Math.hypot(5.18, 4.14);
const fasciaAngle = Math.atan2(4.14, 5.18);
addBox(2, [-2.57, 8.25, 7.17], [fasciaLength, 0.19, 0.19], zRotation(fasciaAngle));
addBox(2, [2.57, 8.25, 7.17], [fasciaLength, 0.19, 0.19], zRotation(-fasciaAngle));

// Two framed windows on the camera-facing side wall.
sideWindow(-3.3);
sideWindow(3.25);

function aligned(value) {
  return (value + 3) & ~3;
}

function floatBytes(values) {
  const bytes = Buffer.allocUnsafe(values.length * 4);
  values.forEach((value, index) => {
    bytes.writeFloatLE(value, index * 4);
  });
  return bytes;
}

function indexBytes(values) {
  const bytes = Buffer.allocUnsafe(values.length * 2);
  values.forEach((value, index) => {
    bytes.writeUInt16LE(value, index * 2);
  });
  return bytes;
}

function minMax(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], values[i + axis]);
      max[axis] = Math.max(max[axis], values[i + axis]);
    }
  }
  return { min, max };
}

const chunks = [];
const bufferViews = [];
const accessors = [];
let byteLength = 0;

function addChunk(bytes, target) {
  byteLength = aligned(byteLength);
  const index = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset: byteLength,
    byteLength: bytes.byteLength,
    ...(target ? { target } : {}),
  });
  chunks.push({ offset: byteLength, bytes });
  byteLength += bytes.byteLength;
  return index;
}

function addAccessor(bufferView, componentType, count, type, bounds) {
  const index = accessors.length;
  accessors.push({ bufferView, componentType, count, type, ...(bounds ?? {}) });
  return index;
}

const primitives = [];
for (let material = 0; material < groups.length; material++) {
  const group = groups[material];
  if (group.indices.length === 0) continue;
  const bounds = minMax(group.positions);
  const positionAccessor = addAccessor(
    addChunk(floatBytes(group.positions), 34962),
    5126,
    group.positions.length / 3,
    'VEC3',
    bounds,
  );
  const normalAccessor = addAccessor(
    addChunk(floatBytes(group.normals), 34962),
    5126,
    group.normals.length / 3,
    'VEC3',
  );
  const uvAccessor = addAccessor(
    addChunk(floatBytes(group.uvs), 34962),
    5126,
    group.uvs.length / 2,
    'VEC2',
  );
  const indexAccessor = addAccessor(
    addChunk(indexBytes(group.indices), 34963),
    5123,
    group.indices.length,
    'SCALAR',
  );
  primitives.push({
    attributes: { POSITION: positionAccessor, NORMAL: normalAccessor, TEXCOORD_0: uvAccessor },
    indices: indexAccessor,
    material,
    mode: 4,
  });
}

const imageBytes = [await readFile(baseColorPath), roughnessBytes, normalBytes];
const imageViews = imageBytes.map((bytes) => addChunk(bytes));
byteLength = aligned(byteLength);
const binary = Buffer.alloc(byteLength);
for (const chunk of chunks) chunk.bytes.copy(binary, chunk.offset);

const gltf = {
  asset: { version: '2.0', generator: 'molen red-barn end-to-end asset generator' },
  scene: 0,
  scenes: [{ name: 'Red Barn', nodes: [0] }],
  nodes: [{ name: 'weathered-red-barn', mesh: 0 }],
  meshes: [{ name: 'weathered-red-barn', primitives }],
  materials,
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: imageViews.map((bufferView, index) => ({
    name: [
      'weathered-red-wood-basecolor',
      'weathered-red-wood-roughness',
      'weathered-red-wood-normal',
    ][index],
    bufferView,
    mimeType: 'image/png',
  })),
  textures: [0, 1, 2].map((source) => ({ sampler: 0, source })),
  accessors,
  bufferViews,
  buffers: [{ byteLength: binary.byteLength }],
};

const jsonBytes = Buffer.from(JSON.stringify(gltf));
const paddedJsonLength = aligned(jsonBytes.byteLength);
const totalLength = 12 + 8 + paddedJsonLength + 8 + binary.byteLength;
const glb = Buffer.alloc(totalLength);
glb.writeUInt32LE(0x46546c67, 0);
glb.writeUInt32LE(2, 4);
glb.writeUInt32LE(totalLength, 8);
glb.writeUInt32LE(paddedJsonLength, 12);
glb.writeUInt32LE(0x4e4f534a, 16);
glb.fill(0x20, 20, 20 + paddedJsonLength);
jsonBytes.copy(glb, 20);
const binaryHeader = 20 + paddedJsonLength;
glb.writeUInt32LE(binary.byteLength, binaryHeader);
glb.writeUInt32LE(0x004e4942, binaryHeader + 4);
binary.copy(glb, binaryHeader + 8);
await writeFile(modelPath, glb);

const digest = createHash('sha256').update(glb).digest('hex');
console.log(`Generated ${modelPath}`);
console.log(`Texture size: ${sourcePng.width}x${sourcePng.height}`);
console.log(`GLB bytes: ${glb.byteLength}`);
console.log(`GLB sha256: ${digest}`);
