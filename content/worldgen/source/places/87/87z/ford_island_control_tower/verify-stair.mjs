/** Source/imported switchback stair, physical floor/air controls and retained geographic inputs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fordTower,
  fordTowerDistrict,
  fordTowerSkyline,
  fordTowerStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-ford-island-control-tower.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/87/87z/ford_island_control_tower/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
assert.deepEqual(frame.anchor, [-157.96147719025612, 21.36059366963048]);
assert.equal(frame.heading, -2.1183586883302734);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
for (const [d, build] of [
  fordTowerSkyline,
  fordTowerDistrict,
  fordTowerStreet,
  fordTower,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Ford source ${d}`);
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
      `Ford runtime ${d}`,
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
  for (const flight of [0, 1])
    for (let i = 0; i < 10; i++)
      for (const dx of [-0.4, 0, 0.4]) {
        const x = (flight ? 14.65 : 16.1) + dx,
          z = flight ? 17.1 + i * 0.3 : 19.8 - i * 0.3,
          y = flight * 2 + (i + 1) * 0.2,
          h = ray([x, y + 0.35, z], [x, y - 0.35, z])[0];
        check(
          'both flights have upward-facing physical tread or bounded coarse ramp',
          !!h && Math.abs(h.point.y - y) < (d ? 0.003 : 0.2),
          { flight, i, dx, actualY: h?.point.y, expectedY: y },
        );
      }
  for (const [x, y, z, w, d] of [
    [15.4, 2, 16.45, 3.05, 1.1],
    [14.65, 4, 20.35, 1.7, 1.1],
  ])
    for (const dx of [-w * 0.3, 0, w * 0.3])
      for (const dz of [-d * 0.3, 0, d * 0.3]) {
        const h = ray([x + dx, y + 0.25, z + dz], [x + dx, y - 0.25, z + dz])[0];
        check(
          'continuous intermediate and upper landing floor',
          !!h && Math.abs(h.point.y - y) < 0.003,
          { x, y, z, dx, dz, actualY: h?.point.y },
        );
      }
  check(
    'lower stair remains open beneath treads',
    ray([16.1, 0.5, 18.3], [16.1, 0.9, 18.3]).length === 0,
  );
  check(
    'upper stair remains open beneath treads',
    ray([14.65, 2, 18.3], [14.65, 2.7, 18.3]).length === 0,
  );
  check('operations roof retained', ray([-10, 10, 14], [-10, 7, 14]).length > 0);
  check('upper tower cab retained', ray([0, 56, 0], [0, 49, 0]).length > 0);
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
        'New two-flight external switchback stair, intermediate/upper landing floor, beneath-flight air and imported mesh attributes; original mapped frame/ground retained. Dimensions approximate, not navigable interior certification.',
    },
    null,
    2,
  ),
);
