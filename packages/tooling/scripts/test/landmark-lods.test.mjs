import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Document, NodeIO } from '@gltf-transform/core';
import { buildLandmarkLods } from '../landmark-lods.mjs';

test('derivatives preserve masters, reflected winding, narrow extents and material bindings deterministically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'molen-lods-'));
  const doc = new Document(),
    buffer = doc.createBuffer();
  const material = doc
    .createMaterial()
    .setExtras({ molenSurface: { ref: 'matgraph:brick', slot: 'wall', uv: 'repeats' } });
  // A long, thin deck with a reflected node: the generated top must still face up.
  const positions = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1000, 0, 0, 1000, 0, 2, 0, 0, 0, 1000, 0, 2, 0, 0, 2]))
    .setBuffer(buffer);
  const uv = doc
    .createAccessor()
    .setType('VEC2')
    .setArray(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]))
    .setBuffer(buffer);
  const mesh = doc
    .createMesh()
    .addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', positions)
        .setAttribute('TEXCOORD_0', uv)
        .setMaterial(material),
    );
  doc.createScene().addChild(doc.createNode().setMesh(mesh).setScale([-1, 1, 1]));
  const bytes = await new NodeIO().writeBinary(doc);
  const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  await writeFile(join(directory, 'model.glb'), bytes);
  await writeFile(
    join(directory, 'asset.json'),
    JSON.stringify({
      id: 'test',
      hash,
      files: { main: 'model.glb' },
      stats: {},
      bounds: { aabb: { min: [-1000, 0, 0], max: [0, 0, 2] } },
    }),
  );
  const first = await buildLandmarkLods(join(directory, 'asset.json'));
  const second = await buildLandmarkLods(join(directory, 'asset.json'), { force: true });
  assert.deepEqual(first, second);
  assert.deepEqual(await readFile(join(directory, 'model.glb')), Buffer.from(bytes));
  const skyline = await new NodeIO().read(join(directory, first.levels[0].file));
  const primitive = skyline.getRoot().listMeshes()[0].listPrimitives()[0];
  const position = primitive.getAttribute('POSITION');
  const ids = primitive.getIndices();
  const [a, b, c] = [0, 1, 2].map((i) => position.getElement(ids ? ids.getScalar(i) : i, []));
  assert((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) < 0); // reflected deck preserves its downward winding
  const actual = primitive.getAttribute('POSITION');
  assert.deepEqual(actual.getMin([]), [-1000, 0, 0]);
  assert.deepEqual(actual.getMax([]), [0, 0, 2]);
  const detailed = await new NodeIO().read(join(directory, first.levels[3].file));
  assert.equal(
    detailed.getRoot().listMaterials()[0].getExtras().molenSurface.ref,
    'matgraph:brick',
  );
});

test('a dense open structure keeps its shape on the skyline instead of convex blobs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'molen-lods-'));
  const doc = new Document(),
    buffer = doc.createBuffer();
  const material = doc.createMaterial().setBaseColorFactor([0.5, 0.4, 0.3, 1]);
  // A stadium-like ring: four 100 m walls, 20 m high, finely tessellated (3,200 triangles).
  const positions = [];
  const wall = (from, to) => {
    const columns = 40,
      rows = 10;
    const at = (i, j) => [
      from[0] + ((to[0] - from[0]) * i) / columns,
      (20 * j) / rows,
      from[1] + ((to[1] - from[1]) * i) / columns,
    ];
    for (let i = 0; i < columns; i++)
      for (let j = 0; j < rows; j++)
        positions.push(
          ...at(i, j),
          ...at(i + 1, j),
          ...at(i + 1, j + 1),
          ...at(i, j),
          ...at(i + 1, j + 1),
          ...at(i, j + 1),
        );
  };
  wall([-50, 50], [50, 50]);
  wall([50, 50], [50, -50]);
  wall([50, -50], [-50, -50]);
  wall([-50, -50], [-50, 50]);
  const mesh = doc.createMesh().addPrimitive(
    doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array(positions))
          .setBuffer(buffer),
      )
      .setMaterial(material),
  );
  doc.createScene().addChild(doc.createNode().setMesh(mesh));
  const bytes = await new NodeIO().writeBinary(doc);
  await writeFile(join(directory, 'model.glb'), bytes);
  await writeFile(
    join(directory, 'asset.json'),
    JSON.stringify({
      id: 'ring',
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      files: { main: 'model.glb' },
      stats: {},
      bounds: { aabb: { min: [-50, 0, -50], max: [50, 20, 50] } },
    }),
  );
  const lods = await buildLandmarkLods(join(directory, 'asset.json'));
  const skyline = lods.levels[0];
  // Convex cells over this ring are about 9 m across: a 31 m error. The simplified walls are exact.
  assert(skyline.errorMeters < 2, `skyline error ${skyline.errorMeters}`);
  assert(skyline.triangles <= 2000, `skyline triangles ${skyline.triangles}`);
  assert.equal(skyline.drawCalls, 1);
  const level = await new NodeIO().read(join(directory, skyline.file));
  const primitive = level.getRoot().listMeshes()[0].listPrimitives()[0];
  const position = primitive.getAttribute('POSITION');
  const ids = primitive.getIndices();
  const count = ids ? ids.getCount() : position.getCount();
  for (let i = 0; i < count; i += 3) {
    const corners = [0, 1, 2].map((k) =>
      position.getElement(ids ? ids.getScalar(i + k) : i + k, []),
    );
    const x = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
    const z = (corners[0][2] + corners[1][2] + corners[2][2]) / 3;
    assert(Math.abs(x) > 45 || Math.abs(z) > 45, `skyline fills the open middle at ${x}, ${z}`);
  }
});
