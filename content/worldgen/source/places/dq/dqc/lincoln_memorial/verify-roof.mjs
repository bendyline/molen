/** Actual imported peristyle coverage, pitched roof volumes and retained original site. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  lincolnDistrict,
  lincolnSkyline,
  lincolnStreet,
  memorial,
} from '../../../../../../../packages/worldgen/scripts/structure-lincoln-memorial.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dq/dqc/lincoln_memorial/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
assert.deepEqual(frame.anchor, [-77.05017149448395, 38.88927185085194]);
assert.equal(frame.heading, Math.PI / 2);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
for (const [d, build] of [lincolnSkyline, lincolnDistrict, lincolnStreet, memorial].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Lincoln source ${d}`);
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
      `Lincoln runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
  const controls = [],
    ray = (a, b) => {
      const q = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(q);
      return new T.Raycaster(
        q,
        v.clone().normalize(),
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(gltf.scene);
    },
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    };
  for (const [x, z] of [
    [0, 14.1],
    [0, -14.1],
    [24.5, 0],
    [-24.5, 0],
    [24.5, 14.5],
    [-24.5, 14.5],
    [24.5, -14.5],
    [-24.5, -14.5],
  ]) {
    const h = ray([x, 19.7, z], [x, 20.3, z])[0];
    check(
      'continuous physical peristyle soffit closes previous roof gap',
      !!h && Math.abs(h.point.y - 20.11) < 0.002,
      { x, z, y: h?.point.y },
    );
    check('walkway air below covered peristyle', ray([x, 9, z], [x, 19.7, z]).length === 0, {
      x,
      z,
    });
    const floor = ray([x, 6.9, z], [x, 6.5, z])[0];
    check('retained continuous temple floor', !!floor && Math.abs(floor.point.y - 6.7) < 0.002, {
      x,
      z,
      y: floor?.point.y,
    });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const x = -27.55 + (i * 55.1) / 11,
        z = s * 16.93;
      check(
        'retained mapped long-face outer column',
        ray([x, 8.7, z + s * 1.5], [x, 8.7, z]).length > 0,
        { x, z },
      );
    }
    for (let i = 1; i < 7; i++) {
      const x = s * 27.55,
        z = -16.93 + (i * 33.86) / 7;
      check(
        'retained mapped short-face outer column',
        ray([x + s * 1.5, 8.7, z], [x, 8.7, z]).length > 0,
        { x, z },
      );
    }
    check(
      'retained inner entrance column',
      ray([s * 2.5, 8.7, 14], [s * 2.5, 8.7, 12.5]).length > 0,
      { side: s },
    );
  }
  check('retained central portal air', ray([0, 9, 19], [0, 9, 0]).length === 0);
  if (d) {
    for (const [x, w] of [
      [-15, 10.4],
      [0, 18.3],
      [15, 10.4],
    ]) {
      for (const f of [-0.75, -0.25, 0.25, 0.75]) {
        const xx = x + (f * w) / 2,
          h = ray([xx, 30.5, 0.27], [xx, 27.1, 0.27])[0],
          expected = 29.2 - Math.abs(f) * 1.8;
        check('actual rooflight pitched plane', !!h && Math.abs(h.point.y - expected) < 0.004, {
          field: x,
          f,
          y: h?.point.y,
          expected,
        });
      }
      for (const s of [-1, 1]) {
        const h = ray([x, 28, s * 11.4], [x, 28, s * 10.8])[0];
        check('rooflight closed physical gable end', !!h && Math.abs(h.point.z - s * 11) < 0.002, {
          field: x,
          side: s,
          z: h?.point.z,
        });
      }
    }
    for (const x of [-9.45, 9.45]) {
      check(
        'open roof terrace air between separate rooflight volumes',
        ray([x, 30, 0], [x, 27.5, 0]).length === 0,
        { x },
      );
      const h = ray([x, 27.6, 0], [x, 27.1, 0])[0];
      check(
        'physical membrane terrace below rooflights',
        !!h && Math.abs(h.point.y - 27.36) < 0.002,
        { x, y: h?.point.y },
      );
    }
  }
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
        'Continuous covered peristyle floor/air/ceiling,38retained mapped column positions and central portal, actual pitched rooflight planes/closed gable ends/separate terrace. Source/imported attributes and original frame/ground; new roof dimensions remain photographic estimates.',
    },
    null,
    2,
  ),
);
