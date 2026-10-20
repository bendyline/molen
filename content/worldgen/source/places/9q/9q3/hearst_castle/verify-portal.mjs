/** Changed entrance exterior, source/imported attributes and retained original map/ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  hearst,
  hearstDistrict,
  hearstSkyline,
  hearstStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-hearst-castle.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q3/hearst_castle/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
assert.deepEqual(frame.anchor, [-121.16806000471115, 35.685240350260685]);
assert.equal(frame.heading, -1.3197933216173452);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
for (const [d, build] of [hearstSkyline, hearstDistrict, hearstStreet, hearst].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Hearst source ${d}`);
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
      `Hearst runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
  const controls = [],
    p = (x, y, z) => [x, y + 3.8, z],
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
  for (const x of [-1.5, 0.13, 1.5]) {
    check(
      'stone base band does not obstruct entrance at threshold',
      ray(p(x, 0.45, 1), p(x, 0.45, 0.91)).length === 0,
      { x },
    );
  }
  for (const x of [-1.5, 0.13, 1.5])
    for (const y of [1.8, 3.2, 5.5]) {
      check(
        'actual entrance recess air ahead of grille',
        ray(p(x, y, 1.7), p(x, y, 1.13)).length === 0,
        { x, y },
      );
      const h = ray(p(x, y, 1), p(x, y, 0.8))[0];
      check('opaque inner boundary at fixed depth', !!h && Math.abs(h.point.z - 0.9) < 0.002, {
        x,
        y,
        z: h?.point.z,
      });
    }
  for (const x of [-1.7, 0, 1.7])
    for (const z of [1, 1.35, 1.65]) {
      const h = ray(p(x, 0.6, z), p(x, 0.2, z))[0];
      check('continuous physical stone threshold', !!h && Math.abs(h.point.y - 4.15) < 0.002, {
        x,
        z,
        y: h?.point.y,
      });
    }
  for (const [z, y] of [
    [2.15, 0.175],
    [1.8, 0.35],
  ]) {
    const h = ray(p(0.13, y + 0.15, z), p(0.13, y - 0.15, z))[0];
    check('physical entrance threshold steps', !!h && Math.abs(h.point.y - y - 3.8) < 0.002, {
      z,
      y,
      actualY: h?.point.y,
    });
  }
  for (const sign of [-1, 1])
    check('inward-facing stone jamb', ray(p(0, 2, 1.2), p(sign * 2.3, 2, 1.2)).length > 0, {
      sign,
    });
  check('rectangular stone lintel underside', ray(p(0.13, 6.2, 1.2), p(0.13, 6.7, 1.2)).length > 0);
  if (d >= 2) {
    check('actual inset metal gate bar', ray(p(0, 2, 1.2), p(0, 2, 1)).length > 0);
    check('real air between gate bars', ray(p(0.13, 2, 1.2), p(0.13, 2, 1)).length === 0);
  }
  check('retained main roof', ray([-1.3, 30, -22], [-1.3, 15, -22]).length > 0);
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
        'Physical rectangular entrance recess, threshold steps, inward stone reveals, inset metal grille and opaque boundary; source/imported geometry attributes and original frame/ground. Fine carvings and exact depths remain estimates.',
    },
    null,
    2,
  ),
);
