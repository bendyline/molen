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
