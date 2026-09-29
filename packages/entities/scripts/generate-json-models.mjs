/**
 * Encode each entity source bundle's `models/model.json` (named materials and indexed triangle
 * primitives) as its `models/source.glb`. The JSON is the editable source; the GLB is rebuilt.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/entities/source',
);
const check = process.argv.includes('--check');
const align = (n) => (n + 3) & ~3;

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  return { min, max };
}

export function encodeModelJson(model) {
  const keys = Object.keys(model.materials);
  const views = [];
  const accessors = [];
  const chunks = [];
  let length = 0;
  const view = (bytes, target) => {
    views.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, target });
    chunks.push(bytes, Buffer.alloc(align(bytes.length) - bytes.length));
    length = align(length + bytes.length);
    return views.length - 1;
  };
  const primitives = model.primitives.map((primitive) => {
    const count = primitive.positions.length / 3;
    const position = accessors.push({
      bufferView: view(Buffer.from(new Float32Array(primitive.positions).buffer), 34962),
      componentType: 5126,
      count,
      type: 'VEC3',
      ...bounds(primitive.positions),
    });
    const normal = accessors.push({
      bufferView: view(Buffer.from(new Float32Array(primitive.normals).buffer), 34962),
      componentType: 5126,
      count,
      type: 'VEC3',
    });
    const indices = accessors.push({
      bufferView: view(Buffer.from(new Uint16Array(primitive.indices).buffer), 34963),
      componentType: 5123,
      count: primitive.indices.length,
      type: 'SCALAR',
    });
    return {
      attributes: { POSITION: position - 1, NORMAL: normal - 1 },
      indices: indices - 1,
      material: keys.indexOf(primitive.material),
      mode: 4,
    };
  });
  const document = {
    asset: { version: '2.0', generator: '@bendyline/molen-entities deterministic generator' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: model.id, mesh: 0 }],
    meshes: [{ name: model.id, primitives }],
    materials: keys.map((key) => ({
      name: model.materials[key].name,
      pbrMetallicRoughness: {
        baseColorFactor: model.materials[key].color,
        metallicFactor: 0,
        roughnessFactor: 0.92,
      },
      doubleSided: false,
      alphaMode: 'OPAQUE',
    })),
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: length }],
  };
  const text = Buffer.from(JSON.stringify(document));
  const jsonLength = align(text.length);
  const glb = Buffer.alloc(28 + jsonLength + length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonLength, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  glb.fill(0x20, 20, 20 + jsonLength);
  text.copy(glb, 20);
  glb.writeUInt32LE(length, 20 + jsonLength);
  glb.writeUInt32LE(0x004e4942, 24 + jsonLength);
  Buffer.concat(chunks).copy(glb, 28 + jsonLength);
  return glb;
}

const stale = [];
for (const category of await readdir(sourceRoot, { withFileTypes: true })) {
  if (!category.isDirectory()) continue;
  for (const thing of await readdir(resolve(sourceRoot, category.name), { withFileTypes: true })) {
    const directory = resolve(sourceRoot, category.name, thing.name);
    if (!thing.isDirectory()) continue;
    const manifest = JSON.parse(await readFile(resolve(directory, 'source.json'), 'utf8'));
    if (!manifest.files.models.some((model) => model.path === 'models/model.json')) continue;
    const model = JSON.parse(await readFile(resolve(directory, 'models/model.json'), 'utf8'));
    const glb = encodeModelJson(model);
    const path = resolve(directory, 'models/source.glb');
    const previous = await readFile(path).catch((error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    const entry = manifest.files.models.find((m) => m.path === 'models/source.glb');
    const sha256 = `sha256:${createHash('sha256').update(glb).digest('hex')}`;
    if (previous?.equals(glb) && entry?.sha256 === sha256) continue;
    if (check) {
      stale.push(path);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, glb);
    if (entry?.sha256 !== undefined && entry.sha256 !== sha256) {
      // Replace the pinned hash in place so the manifest keeps its reviewed layout.
      const manifestPath = resolve(directory, 'source.json');
      const text = await readFile(manifestPath, 'utf8');
      await writeFile(manifestPath, text.replace(entry.sha256, sha256));
    }
    console.log(`${model.id}: ${glb.length} bytes, ${sha256}`);
  }
}
if (stale.length) throw new Error(`Stale or missing model.json builds:\n${stale.join('\n')}`);
