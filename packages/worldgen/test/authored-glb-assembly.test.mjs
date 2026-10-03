import { expect, test } from 'vitest';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { encodeAuthoredAssembly } from '../scripts/authored-glb-assembly.mjs';

const decode = (bytes) =>
  JSON.parse(
    Buffer.from(bytes)
      .subarray(20, 20 + Buffer.from(bytes).readUInt32LE(12))
      .toString(),
  );
function part(x) {
  const builder = new MeshBufferBuilder();
  builder.addTriangle(
    'wall',
    'matgraph:molen.worldgen.material.brick',
    [
      [x, 0, 0],
      [x + 1, 0, 0],
      [x, 1, 0],
    ],
    [0, 0, 1],
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [0.5, 0.4, 0.3],
  );
  return Buffer.from(
    encodeGlb(builder.finalize(), [
      {
        name: 'brick',
        roughness: 0.8,
        sharedSurface: {
          ref: 'matgraph:molen.worldgen.material.brick',
          slot: 'wall',
          uv: 'repeats',
        },
      },
    ]),
  );
}

test('assembly reuses mesh buffers, remaps every accessor and shares complete material definitions', () => {
  const a = part(0),
    b = part(9);
  const output = encodeAuthoredAssembly([
    { name: 'rib', glb: a, instances: [{}, { translation: [4, 5, 6], angle: Math.PI / 2 }] },
    { name: 'wall', glb: b, instances: [{ translation: [7, 0, 0] }] },
  ]);
  const doc = decode(output),
    da = decode(a),
    db = decode(b);
  expect(doc.nodes.map((n) => n.mesh)).toEqual([0, 0, 1]);
  expect(doc.scenes[0].nodes).toEqual([0, 1, 2]);
  expect(doc.nodes[1].translation).toEqual([4, 5, 6]);
  expect(doc.nodes[1].rotation[1]).toBeCloseTo(Math.SQRT1_2);
  expect(doc.materials).toEqual(da.materials);
  expect(doc.materials[0].extras.molenSurface.ref).toBe('matgraph:molen.worldgen.material.brick');
  expect(doc.meshes[1].primitives[0].material).toBe(0);
  expect(doc.meshes[1].primitives[0].indices).toBe(
    db.meshes[0].primitives[0].indices + da.accessors.length,
  );
  const binaryOffset = 28 + output.readUInt32LE(12);
  const attributes = doc.meshes[1].primitives[0].attributes;
  for (const [key, id] of Object.entries(attributes)) {
    const accessor = doc.accessors[id],
      view = doc.bufferViews[accessor.bufferView];
    const original = db.accessors[db.meshes[0].primitives[0].attributes[key]],
      originalView = db.bufferViews[original.bufferView];
    const start = binaryOffset + view.byteOffset,
      originalStart = 28 + b.readUInt32LE(12) + (originalView.byteOffset ?? 0);
    expect(output.subarray(start, start + view.byteLength)).toEqual(
      b.subarray(originalStart, originalStart + originalView.byteLength),
    );
    expect(view.byteOffset % 4).toBe(0);
  }
  const binA = a.readUInt32LE(20 + a.readUInt32LE(12)),
    binB = b.readUInt32LE(20 + b.readUInt32LE(12));
  expect(doc.buffers[0].byteLength).toBe(binA + binB);
  expect(output.readUInt32LE(8)).toBe(output.length);
});

test('assembly refuses ambiguous names, missing instances and nonfinite transforms', () => {
  const valid = { name: 'rib', glb: part(0), instances: [{}] };
  expect(() => encodeAuthoredAssembly([])).toThrow('at least one');
  expect(() => encodeAuthoredAssembly([valid, valid])).toThrow('unique');
  expect(() => encodeAuthoredAssembly([{ ...valid, instances: [] }])).toThrow('no instances');
  expect(() => encodeAuthoredAssembly([{ ...valid, instances: [{ angle: NaN }] }])).toThrow(
    'invalid transform',
  );
  expect(() =>
    encodeAuthoredAssembly([{ ...valid, glb: valid.glb.subarray(0, valid.glb.length - 4) }]),
  ).toThrow('invalid generated GLB');
});

test('GPU repetitions share one mesh and encode explicit translation/rotation accessor bytes', () => {
  const output = encodeAuthoredAssembly([
    {
      name: 'perforation',
      glb: part(0),
      gpuInstances: true,
      instances: [{}, { translation: [2, 3, 4], angle: Math.PI / 2 }],
    },
  ]);
  const doc = decode(output),
    binary = 28 + output.readUInt32LE(12);
  expect(doc.nodes).toHaveLength(1);
  expect(doc.meshes).toHaveLength(1);
  expect(doc.extensionsRequired).toEqual(['EXT_mesh_gpu_instancing']);
  const attributes = doc.nodes[0].extensions.EXT_mesh_gpu_instancing.attributes;
  const values = (id) => {
    const a = doc.accessors[id],
      v = doc.bufferViews[a.bufferView];
    expect(a.count).toBe(2);
    expect(v.byteOffset % 4).toBe(0);
    return Array.from({ length: v.byteLength / 4 }, (_, i) =>
      output.readFloatLE(binary + v.byteOffset + i * 4),
    );
  };
  expect(values(attributes.TRANSLATION)).toEqual([0, 0, 0, 2, 3, 4]);
  const rotation = values(attributes.ROTATION);
  expect(rotation.slice(0, 4)).toEqual([0, 0, 0, 1]);
  expect(rotation[5]).toBeCloseTo(Math.SQRT1_2, 6);
  expect(rotation[7]).toBeCloseTo(Math.SQRT1_2, 6);
  expect(output.length).toBe(binary + doc.buffers[0].byteLength);
});
