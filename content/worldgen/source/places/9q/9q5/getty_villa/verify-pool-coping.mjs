/** Verify continuous beveled coping and recessed curved-end pool joints, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  gettyDistrict,
  gettyModel,
  gettySkyline,
  gettyStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-getty-villa.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q5/getty_villa/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-pool-surroundings.json'),
  c = read('pool-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [gettySkyline, gettyDistrict, gettyStreet, gettyModel.build].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Getty source${d}`);
  const h = createHash('sha256'),
    added = { poolStone: 0 };
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
  assert.deepEqual(added, d === 3 ? { poolStone: 696 } : { poolStone: 0 });
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0,
    concreteSurface = false,
    woodSurface = false;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Getty import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('concrete_plain')) concreteSurface = true;
      if (JSON.stringify(m.userData).includes('wood_plain')) woodSurface = true;
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
  check('all original attributes outside468replaced outer-pool triangles exact', true);
  if (d === 3) {
    check('coping and panels bind continuous shared smooth stone', concreteSurface);
    const { x, z, width, length, arcSegments: n } = c.pool,
      r = width * 0.34,
      half = length / 2 - r,
      outer = [];
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / n;
      outer.push([x + Math.cos(a) * r, z + half + Math.sin(a) * r]);
    }
    outer.push([x - width / 2, z + half], [x - width / 2, z - half]);
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i * Math.PI) / n;
      outer.push([x + Math.cos(a) * r, z - half + Math.sin(a) * r]);
    }
    outer.push([x + width / 2, z - half], [x + width / 2, z + half]);
    check('original thirty-segment pool outline retained', outer.length === 30);
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length,
        a = outer[i],
        b = outer[j],
        mid = a.map((v, k) => (v + b[k]) / 2),
        inside = [x + (mid[0] - x) * 0.92, z + (mid[1] - z) * 0.989],
        outside = [x + (mid[0] - x) * 1.005, z + (mid[1] - z) * 1.0005],
        innerTop = [x + (inside[0] - x) * 1.003, z + (inside[1] - z) * 1.0003],
        p = outside.map((v, k) => (v + innerTop[k]) / 2);
      for (const [direction, from, to, expected] of [
        ['top', 1.48, 1.415, 1.43],
        ['underside', 1.33, 1.355, 1.345],
      ]) {
        const h = ray([p[0], from, p[1]], [p[0], to, p[1]])[0];
        check(
          'every coping segment has closed ' + direction,
          !!h && Math.abs(h.point.y - expected) < 0.00002,
          { segment: i, actual: h?.point.y, expected },
        );
      }
    }
    for (const [start, end] of c.endPanels.edgeRanges)
      for (let i = start; i < end; i++) {
        const a = outer[i],
          b = outer[(i + 1) % outer.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz),
          T = [dx / len, dz / len],
          N = [dz / len, -dx / len],
          mid = a.map((v, k) => (v + b[k]) / 2),
          P = (p, d) => [p[0] + N[0] * d, 1.2, p[1] + N[1] * d],
          depth = (h, p) => -(N[0] * (h.point.x - p[0]) + N[1] * (h.point.z - p[1]));
        let h = ray(P(mid, 0.05), P(mid, -0.025))[0];
        check(
          'each curved-end panel has real outer front',
          !!h && Math.abs(depth(h, mid)) < 0.00002,
          { panel: i },
        );
        h = ray(P(mid, -0.1), P(mid, -0.07))[0];
        check(
          'each curved-end panel has closed physical back',
          !!h && Math.abs(depth(h, mid) - 0.08) < 0.00002,
          { panel: i },
        );
        const joint = [a[0] + T[0] * 0.002, a[1] + T[1] * 0.002];
        check(
          'each twenty-millimeter joint is genuinely recessed',
          ray(P(joint, 0.03), P(joint, -0.04)).length === 0,
          { panel: i },
        );
        h = ray(P(joint, 0.03), P(joint, -0.075))[0];
        check(
          'joint reaches physical backing after recess',
          !!h && depth(h, joint) > 0.04 && depth(h, joint) < 0.071,
          { panel: i, actual: h && depth(h, joint) },
        );
        const q = [a[0] - N[0] * 0.03, a[1] - N[1] * 0.03],
          A = [q[0] + T[0] * 0.002, 1.2, q[1] + T[1] * 0.002],
          B = [q[0] + T[0] * 0.018, 1.2, q[1] + T[1] * 0.018];
        check('each panel has physical joint return', ray(A, B).length > 0, { panel: i });
      }
    const water = ray([x, 1.3, z], [x, 1.2, z])[0];
    check(
      'retained pool water is clear inside coping',
      !!water && Math.abs(water.point.y - 1.23) < 0.00002,
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles,
    added,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'getty_villa',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
