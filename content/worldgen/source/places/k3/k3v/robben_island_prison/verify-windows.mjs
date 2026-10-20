/** Actual imported physical barred-window/sill controls and retained original site. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  prison,
  robbenPrisonDistrict,
  robbenPrisonSkyline,
  robbenPrisonStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-robben-island-prison.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/k3/k3v/robben_island_prison/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
assert.deepEqual(frame.anchor, [18.371111111111112, -33.80027777777778]);
assert.equal(frame.heading, 2.12);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
for (const [d, build] of [
  robbenPrisonSkyline,
  robbenPrisonDistrict,
  robbenPrisonStreet,
  prison,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Prison source ${d}`);
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
      `Prison runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
  const controls = [],
    floor = 0.59499876,
    point = ([x, y, z]) => [-37.7 + z, floor + y, 111.3 - x],
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
    local = (a, b) => ray(point(a), point(b)),
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    };
  check('retained courtyard remains open', ray([-25, 8, 111.3], [-25, 1, 111.3]).length === 0);
  check(
    'retained mapped courtyard block roof',
    ray([-37.7, 8, 111.3], [-37.7, 2, 111.3]).length > 0,
  );
  if (d)
    for (let k = 0; k < 9; k++) {
      const x = -16 + ((k + 0.5) * 32) / 9;
      for (const z of [3.23, 3.4]) {
        const h = local([x + 0.025, 1.6, z], [x + 0.025, 1.1, z])[0],
          expected = floor + 1.43 - ((z - 3.13) * 0.1) / 0.36;
        check(
          'projecting solid sill has sloping top',
          !!h && Math.abs(h.point.y - expected) < 0.002,
          { window: k, z, y: h?.point.y, expected },
        );
      }
      check(
        'sill has physical front thickness',
        local([x + 0.025, 1.29, 3.6], [x + 0.025, 1.29, 3.4]).length > 0,
        { window: k },
      );
      if (d === 3) {
        for (let i = 1; i <= 4; i++) {
          const xx = x - 0.4 + (0.8 * i) / 5,
            h = local([xx, 1.65, 3.5], [xx, 1.65, 3.24])[0];
          check(
            'solid vertical security bar front',
            !!h && Math.abs(h.point.x - (-37.7 + 3.33)) < 0.002,
            { window: k, bar: i, x: h?.point.x },
          );
          check(
            'vertical security bar inward side',
            local([xx + 0.1, 1.65, 3.29], [xx, 1.65, 3.29]).length > 0,
            { window: k, bar: i },
          );
        }
        for (const v of [0.34, 0.68]) {
          const h = local([x, 1.45 + 1.05 * v + 0.015, 3.5], [x, 1.45 + 1.05 * v + 0.015, 3.24])[0];
          check(
            'solid transverse security bar',
            !!h && Math.abs(h.point.x - (-37.7 + 3.33)) < 0.002,
            { window: k, fraction: v },
          );
        }
        check(
          'open exterior gap between security bars',
          local([x, 1.65, 3.5], [x, 1.65, 3.24]).length === 0,
          { window: k },
        );
        const h = local([x, 1.65, 3.24], [x, 1.65, 3.19])[0];
        check(
          'opaque window boundary behind bars',
          !!h && Math.abs(h.point.x - (-37.7 + 3.21)) < 0.002,
          { window: k, x: h?.point.x },
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
        'Nine physical sloping red sills, close security-bar fronts/sides/transverse bars and open air ahead of opaque window boundary on one retained mapped courtyard facade. Source/imported attributes and original map/ground; exact photo-to-court/window identity and engineering sections remain estimates.',
    },
    null,
    2,
  ),
);
