/** Actual source/imported entrance air,floor,chamfer and recessed backing;retained original map/terrain. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  faneuil,
  faneuilDistrict,
  faneuilSkyline,
  faneuilStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-faneuil-hall.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/drt/faneuil_hall/', root),
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
assert.deepEqual(frame.anchor, [-71.05623431503773, 42.36003337249992]);
assert.equal(frame.heading, 1.7056862578319953);
for (const [d, build] of [faneuilSkyline, faneuilDistrict, faneuilStreet, faneuil].entries()) {
  const b = new MeshBufferBuilder();
  build(b, frame);
  const source = b.finalize();
  validateAuthoredMesh(source, `Faneuil source ${d}`);
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
      `Faneuil runtime ${d}`,
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
  for (const sign of [-1, 1]) {
    const p = (x, y, z) => [sign * x, y, sign * (15.55 + z)];
    for (const x of site.entrances.centersX) {
      for (const dx of [-0.6, 0.2, 0.6]) {
        check(
          'real air before recessed opaque door',
          ray(p(x + dx, 1.4, 0.5), p(x + dx, 1.4, -0.3)).length === 0,
          { sign, x, dx },
        );
        const h = ray(p(x + dx, 1.4, -0.3), p(x + dx, 1.4, -0.5))[0];
        check(
          'opaque leaves terminate exterior at fixed recess depth',
          !!h && sign * h.point.z >= 15.213 && sign * h.point.z <= 15.242,
          { sign, x, dx, z: h?.point.z },
        );
      }
      for (const z of [0.15, -0.1, -0.25]) {
        const h = ray(p(x + 0.2, 0.4, z), p(x + 0.2, 0, z))[0];
        check('physical threshold floor', !!h && Math.abs(h.point.y - 0.12) < 0.002, {
          sign,
          x,
          z,
          y: h?.point.y,
        });
      }
      for (const dx of [-0.4, 0.4]) {
        check(
          'actual fanlight recess air',
          ray(p(x + dx, 3.4, 0.5), p(x + dx, 3.4, -0.3)).length === 0,
          { sign, x, dx },
        );
        check(
          'glazing closes fanlight behind reveal',
          ray(p(x + dx, 3.4, -0.3), p(x + dx, 3.4, -0.5)).length > 0,
          { sign, x, dx },
        );
      }
      check(
        'curved head has inward-facing physical reveal',
        ray(p(x + 0.2, 3.3, -0.1), p(x + 0.2, 4.3, -0.1)).length > 0,
        { sign, x },
      );
      check(
        'jamb has inward-facing physical reveal',
        ray(p(x, 1.4, -0.1), p(x + 1.1, 1.4, -0.1)).length > 0,
        { sign, x },
      );
    }
    check(
      'brick pier closes wall between doors',
      ray(p(3.2, 1.4, 0.5), p(3.2, 1.4, -0.5)).length > 0,
      { sign },
    );
    check(
      'continuous wall at entrance head seam',
      ray(p(3.2, 4.055, 0.5), p(3.2, 4.055, -0.5)).length > 0,
      { sign },
    );
    check('retained roof', ray(p(8, 30, -5), p(8, 15, -5)).length > 0, { sign });
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
        'Changed six physical entrance recesses, curved inward reveals, opaque doors, fanlights and floors; preserved source frame/ground. East doorway distribution retained as symmetry approximation.',
    },
    null,
    2,
  ),
);
