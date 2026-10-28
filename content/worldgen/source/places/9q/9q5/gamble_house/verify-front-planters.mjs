/** Verify five open tapered front bowls, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  gambleDistrict,
  gambleModel,
  gambleSkyline,
  gambleStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-gamble-house.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q5/gamble_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-planter-surroundings.json'),
  c = read('planter-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  gambleSkyline,
  gambleDistrict,
  gambleStreet,
  gambleModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Gamble source${d}`);
  const h = createHash('sha256'),
    added = { bowl: 0 };
  let retainedTriangles = 0;
  for (const g of source.groups) {
    if (g.slot in added) {
      added[g.slot] += g.count / 3;
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const q = Array.from(source.indices.slice(k, k + 3)).map((i) =>
            Array.from(source.uvs.slice(i * 2, i * 2 + 2)),
          ),
          a = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
        assert(Math.abs(a) > 1e-10, `metric UV ${g.slot}:${k}`);
      }
      continue;
    }
    for (let k = g.start; k < g.start + g.count; k++) {
      const i = source.indices[k];
      for (const [key, stride] of [
        ['positions', 3],
        ['normals', 3],
        ['uvs', 2],
        ['colors', 3],
      ]) {
        const a = source[key].slice(i * stride, i * stride + stride);
        h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
    }
    retainedTriangles += g.count / 3;
  }
  assert.equal(`sha256:${h.digest('hex')}`, base.levels[d].attributeHash);
  assert.equal(retainedTriangles, base.levels[d].retainedTriangles);
  assert.deepEqual(added, d === 3 ? { bowl: 3820 } : { bowl: 0 });
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0,
    concreteSurface = false;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Gamble import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('concrete_plain')) concreteSurface = true;
    }
  });
  assert.equal(triangles, source.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 6, 8, 8][d]);
  const checks = [],
    check = (name, pass, data = {}) => {
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
      checks.push({ name, pass, ...data });
    },
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.000001,
        v.length() - 0.000001,
      ).intersectObject(gltf.scene);
    };
  check('all original attributes outside420replaced upper planter triangles exact', true);
  if (d === 3) {
    check('bowl binds continuous concrete surface', concreteSurface);
    for (const v of c.planters) {
      const P = ([x, y, z]) => [v.x + x, v.y + y, v.z + z],
        R = (a, b) => ray(P(a), P(b)),
        hit = (name, a, b, axis, expected) => {
          const h = R(a, b)[0];
          check(
            name,
            !!h &&
              Math.abs(h.point.getComponent(axis) - [v.x, v.y, v.z][axis] - expected) < 0.00002,
            { planter: v.x, expected, actual: h?.point.getComponent(axis) - [v.x, v.y, v.z][axis] },
          );
        };
      check(
        'mouth is actually open without old wood lid',
        R([0, 1.36, 0], [0, 1.15, 0]).length === 0,
        { planter: v.x },
      );
      for (const x of [-0.12, 0.12])
        for (const z of [-0.12, 0.12])
          hit('cavity reaches physical inner floor', [x, 1.15, z], [x, 0.88, z], 1, 0.91);
      hit('outer base has downward closed underside', [0, 0.752, 0], [0, 0.8, 0], 1, 0.76);
      hit('rounded rim has physical up facing annulus', [0.48, 1.36, 0], [0.48, 1.26, 0], 1, 1.31);
      hit(
        'outer taper front physically present',
        [0, 1.055, 0.56],
        [0, 1.055, 0.38],
        2,
        (0.79 + (0.9 - 0.79) * (0.08 / 0.15)) / 2,
      );
      hit(
        'inner tapered wall faces into real cavity',
        [0, 1.055, 0],
        [0, 1.055, 0.42],
        2,
        (0.6 + (0.88 - 0.6) * (0.145 / 0.4)) / 2,
      );
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2,
          C = Math.cos(a),
          S = Math.sin(a),
          V = ([x, y, z]) => [C * x + S * z, y, -S * x + C * z];
        for (const xx of [-0.23, 0.23]) {
          check(
            'external ornaments do not protrude into the cavity',
            R(V([xx, 1.2, 0]), V([xx, 1.2, 0.3935])).length === 0,
            { planter: v.x, side, xx },
          );
          for (const sign of [-1, 1]) {
            const a = V([xx + sign * 0.055, 1.1, 0.62]),
              b = V([xx + sign * 0.055, 1.1, 0.46]),
              h = R(a, b)[0];
            check('stepped ornament side has closed physical front', !!h, {
              planter: v.x,
              side,
              xx,
              sign,
            });
          }
          const a = V([xx, 1.2, 0.62]),
            b = V([xx, 1.2, 0.52]);
          check('stepped ornament top physically connects sides', R(a, b).length > 0, {
            planter: v.x,
            side,
            xx,
          });
        }
      }
    }
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles,
    added,
    controls: checks.length,
    failed: checks.filter((r) => !r.pass).length,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'gamble_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
