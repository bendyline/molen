/** Actual source/imported entrance air,floor,chamfer and recessed backing;retained original map/terrain. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  easternState,
  easternStateDistrict,
  easternStateSkyline,
  easternStateStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-eastern-state-penitentiary.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/dr4/eastern_state_penitentiary/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  site = read('site-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
assert.deepEqual(frame.anchor, [-75.1727, 39.9683]);
assert.equal(frame.heading, 0);
for (const [d, build] of [
  easternStateSkyline,
  easternStateDistrict,
  easternStateStreet,
  easternState,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b, frame);
  const source = b.finalize();
  validateAuthoredMesh(source, `Eastern source ${d}`);
  assert(source.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Eastern runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
  const controls = [],
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(gltf.scene);
    },
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    };
  for (const dx of [-0.55, 0.11, 0.55]) {
    const p = (z) => [1.5 + dx, 1.2, z];
    check('entrance has real air in front of barred gate', ray(p(102.15), p(100.7)).length === 0, {
      dx,
    });
  }
  for (const dx of [-0.6, 0.6])
    for (const z of [98.6, 99.5, 101.3]) {
      const h = ray([1.5 + dx, 0.15, z], [1.5 + dx, -0.15, z])[0];
      check('continuous physical entrance floor', !!h && Math.abs(h.point.y) < 0.001, {
        dx,
        z,
        y: h?.point.y,
      });
    }
  const air = ray([2.5, 3.5, 102.15], [2.5, 3.5, 101.6]),
    wedge = ray([2.7, 3.5, 102.15], [2.7, 3.5, 101.6]);
  check('chamfer preserves central headroom', air.length === 0);
  check('upper corner is actual sloping stone', wedge.length > 0);
  const clear = ray([1.61, 1.2, 102.15], [1.61, 1.2, 98.25]);
  check('air continues behind bars toward inner boundary', clear.length === 0);
  const back = ray([1.61, 1.2, 98.3], [1.61, 1.2, 97.8])[0];
  check(
    'opaque inner boundary avoids invented prison interiors',
    !!back && Math.abs(back.point.z - 98.14) < 0.002,
    { z: back?.point.z },
  );
  if (d) {
    const bars = ray([1.5, 1.2, 100.7], [1.5, 1.2, 100.3]);
    check('actual recessed iron bars', bars.length > 0);
    const h = ray([2.4, 7, 98.7], [2.4, 7, 98.3]);
    check('pointed faux-portcullis surround has actual depth', h.length === 0);
  }
  for (const [x, z] of [
    [-94.15, -6.55],
    [101.9, -2.45],
    [6.4, -102.7],
  ])
    check('retained high perimeter walls', ray([x, 20, z], [x, 4, z]).length > 0, { x, z });
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass).length,
    controlResults: controls,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: site.retainedInputs,
      results,
      scope:
        'Changed entrance recess,floor,chamfer and bars plus retained perimeter/source attributes. Other existing prison geometry is retained;not a survey or a claim of navigable interiors.',
    },
    null,
    2,
  ),
);
