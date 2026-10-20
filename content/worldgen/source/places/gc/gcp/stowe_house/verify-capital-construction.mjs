/** Verify layered closed Corinthian leaf stocks and corner scrolls, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  normalFor,
  validateAuthoredMesh,
} from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  stoweDistrict,
  stoweModel,
  stoweSkyline,
  stoweStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-stowe-house.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/gc/gcp/stowe_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-capital-surroundings.json'),
  c = read('capital-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [stoweSkyline, stoweDistrict, stoweStreet, stoweModel.build].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Stowe source${d}`);
  const h = createHash('sha256'),
    added = { capitalStone: 0 };
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
  assert.deepEqual(added, d === 3 ? { capitalStone: 4224 } : { capitalStone: 0 });
  if (d === 3) {
    const edges = new Map();
    for (const g of source.groups.filter((g) => g.slot === 'capitalStone'))
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const p = Array.from(source.indices.slice(k, k + 3)).map((i) =>
          Array.from(source.positions.slice(i * 3, i * 3 + 3))
            .map((v) => Math.round(v * 1e5))
            .join(','),
        );
        for (let j = 0; j < 3; j++) {
          const a = p[j],
            b = p[(j + 1) % 3],
            key = [a, b].sort().join('|');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
    assert(
      [...edges.values()].every((n) => n === 2),
      'every new leaf/scroll is a closed stock',
    );
  }
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
      `Stowe import${d}`,
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
    },
    hitZ = (name, x, y, z) => {
      const h = ray([x, y, z + 0.025], [x, y, z - 0.015])[0];
      check(name, !!h && Math.abs(h.point.z - z) < 0.00002, { x, y, z, actual: h?.point.z });
    };
  check('all original attributes outside576replaced square capital-leaf triangles exact', true);
  if (d === 3) {
    check('new capital stone has smooth shared binding', concreteSurface);
    const p = c.portico,
      v = c.volutes;
    const probe = (name, q, n) => {
      const A = q.map((x, i) => x + n[i] * 0.018),
        B = q.map((x, i) => x - n[i] * 0.008),
        h = ray(A, B)[0];
      check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.000025, {
        q,
        actual: h?.point.toArray(),
      });
    };
    for (const localX of p.columnXs) {
      const x = p.x + localX,
        z = p.z + p.columnZ,
        top = p.bottom + p.height;
      for (const layer of c.leaves.layers)
        for (let i = 0; i < c.leaves.countPerLayer; i++) {
          const a = layer.angleOffset + (i * 2 * Math.PI) / c.leaves.countPerLayer,
            co = Math.cos(a),
            si = Math.sin(a);
          for (let j = 1; j < layer.profile.length - 1; j++) {
            const A = layer.profile[j],
              B = layer.profile[j + 1],
              q = [
                x + co * ((A[1] + B[1]) / 2 + c.leaves.thickness / 2),
                top + (A[0] + B[0]) / 2,
                z + si * ((A[1] + B[1]) / 2 + c.leaves.thickness / 2),
              ],
              dy = B[0] - A[0],
              dr = B[1] - A[1],
              len = Math.hypot(dy, dr),
              n = [(co * dy) / len, -dr / len, (si * dy) / len];
            probe('every layered leaf has physical splayed outer stock', q, n);
          }
        }
      for (let j = 0; j < v.count; j++) {
        const a = v.angleOffset + (j * 2 * Math.PI) / v.count,
          co = Math.cos(a),
          si = Math.sin(a),
          center = [x + co * v.centerRadius, top + v.heightOffset, z + si * v.centerRadius],
          point = (theta, phi) => {
            const r = v.majorRadius + v.tubeRadius * Math.cos(phi),
              t = r * Math.cos(theta),
              out = v.tubeRadius * Math.sin(phi);
            return [
              center[0] - si * t + co * out,
              center[1] + r * Math.sin(theta),
              center[2] + co * t + si * out,
            ];
          };
        for (let i = 0; i < v.segments; i++) {
          const a = (i * 2 * Math.PI) / v.segments,
            b = ((i + 1) * 2 * Math.PI) / v.segments,
            points = [point(a, 0), point(b, 0), point(b, Math.PI / 2), point(a, Math.PI / 2)],
            q = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / 4),
            n = normalFor(...points);
          if (n[0] * co + n[2] * si < 0) for (let k = 0; k < 3; k++) n[k] *= -1;
          probe('each corner scroll segment has physical closed tube', q, n);
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
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'stowe_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
