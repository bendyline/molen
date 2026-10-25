/** Imported physical ironwork, air counters and immutable full monument surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  washingtonMonumentBaltimoreDistrict,
  washingtonMonumentBaltimoreModel,
  washingtonMonumentBaltimoreSkyline,
  washingtonMonumentBaltimoreStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-washington-monument-baltimore.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dq/dqc/washington_monument_baltimore/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-ironwork-surroundings.json'),
  c = read('ironwork-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const slots = ['railStock', 'railSpear', 'railMedallion', 'railRosette', 'gateFasces', 'gateCrest'];
for (const [d, build] of [
  washingtonMonumentBaltimoreSkyline,
  washingtonMonumentBaltimoreDistrict,
  washingtonMonumentBaltimoreStreet,
  washingtonMonumentBaltimoreModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Baltimore source${d}`);
  const h = createHash('sha256'),
    added = Object.fromEntries(slots.map((s) => [s, 0]));
  let retainedTriangles = 0;
  for (const g of source.groups) {
    if (g.slot in added) {
      added[g.slot] += g.count / 3;
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const q = Array.from(source.indices.slice(k, k + 3)).map((i) =>
            Array.from(source.uvs.slice(i * 2, i * 2 + 2)),
          ),
          a = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
        assert(Math.abs(a) > 1e-10, `metricUV${g.slot}:${k}`);
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
  for (const slot of slots) {
    const edges = new Map();
    for (const g of source.groups.filter((g) => g.slot === slot))
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const p = Array.from(source.indices.slice(k, k + 3)).map((i) =>
          Array.from(source.positions.slice(i * 3, i * 3 + 3))
            .map((v) => Math.round(v * 1e5))
            .join(','),
        );
        for (let j = 0; j < 3; j++) {
          const key = [p[j], p[(j + 1) % 3]].sort().join('|');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
    assert(
      [...edges.values()].every((n) => n >= 2 && n % 2 === 0),
      `${slot}closedstocks`,
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
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Baltimore imported${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, source.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 6, 8, 8][d]);
  const checks = [],
    check = (name, pass, data = {}) => {
      assert(pass, `${level.name}:${name}:${JSON.stringify(data)}`);
      checks.push({ name, pass });
    },
    ray = (A, B) => {
      const p = new T.Vector3(...A),
        v = new T.Vector3(...B).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.000001,
        v.length() - 0.000001,
      ).intersectObject(gltf.scene);
    };
  check('all full original non-enclosure attribute triangles exact', true);
  if (d > 1) {
    const N = c.cells[d === 3 ? 'close' : 'street'],
      span = Math.PI / 2 - 2 * c.sectorStart;
    for (let sector = 0; sector < 4; sector++)
      for (let j = 0; j < N; j++) {
        const a = (sector * Math.PI) / 2 + c.sectorStart + (span * j) / N,
          b = (sector * Math.PI) / 2 + c.sectorStart + (span * (j + 1)) / N,
          m = (a + b) / 2,
          w = 2 * c.radius * Math.sin((b - a) / 2),
          z = c.radius * Math.cos((b - a) / 2),
          P = (p) => [
            Math.cos(m) * p[0] + Math.sin(m) * p[2],
            p[1],
            -Math.sin(m) * p[0] + Math.cos(m) * p[2],
          ],
          hit = (name, x, y, zz) => {
            const q = P([x, y, zz]),
              h = ray(P([x, y, zz + 0.004]), P([x, y, zz - 0.004]))[0];
            check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00004, {
              q,
              actual: h?.point.toArray(),
            });
            return h;
          },
          back = (name, x, y, zz) => {
            const q = P([x, y, zz]),
              h = ray(P([x, y, zz - 0.004]), P([x, y, zz + 0.004]))[0];
            check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00004, {
              q,
              actual: h?.point.toArray(),
            });
          },
          air = (name, x, y) =>
            check(name, ray(P([x, y, z + 0.08]), P([x, y, z - 0.08])).length === 0),
          decor = d === 3 && (j < 2 || j >= N - 2);
        const h = hit('real closed upper rail front', w * 0.16, c.top, z + 0.02);
        check(
          'new rails retain shared painted iron',
          JSON.stringify(h.object.material.userData).includes('metal_painted'),
        );
        back('real closed upper rail back', w * 0.16, c.top, z - 0.02);
        hit('real closed lower rail front', w * 0.16, c.bottom, z + 0.02);
        if (decor) {
          const angle = Math.PI / 24,
            r = (c.medallionOuter + c.medallionInner) / 2;
          hit(
            'open medallion front stock',
            r * Math.cos(angle),
            c.middle + r * Math.sin(angle),
            z + 0.026,
          );
          back(
            'open medallion rear stock',
            r * Math.cos(angle),
            c.middle + r * Math.sin(angle),
            z - 0.026,
          );
          const r2 = (c.medallionSecondOuter + c.medallionSecondInner) / 2;
          hit(
            'inner annular stock',
            r2 * Math.cos(angle),
            c.middle + r2 * Math.sin(angle),
            z + 0.0225,
          );
          air(
            'actual open ring counter',
            0.212 * Math.cos(Math.PI / 8),
            c.middle + 0.212 * Math.sin(Math.PI / 8),
          );
          air(
            'actual air between rosette leaves',
            0.12 * Math.cos(Math.PI / 8),
            c.middle + 0.12 * Math.sin(Math.PI / 8),
          );
          hit('physical rosette centre button', 0.01, c.middle + 0.01, z + 0.04);
          hit('actual top mounting stem', 0.005, 1.74, z + 0.0225);
          hit('actual bottom mounting stem', 0.005, 0.82, z + 0.0225);
          for (let t = 0; t < 8; t++) {
            const a = (t * Math.PI) / 4;
            hit(
              'actual radial ring connector',
              0.216 * Math.cos(a),
              c.middle + 0.216 * Math.sin(a),
              z + 0.012,
            );
          }
        } else {
          const x = -w * 0.25,
            y = c.bottom + (c.top - c.bottom) * 0.25;
          hit('physical rising lattice front', x, y, z + c.barWidth / 2);
          back('physical rising lattice back', x, y, z - c.barWidth / 2);
          air('actual lattice air pocket', w * 0.3, c.middle + 0.18);
        }
        if (d === 3) {
          hit('closed vertical picket', -w / 2, 1.75, z + 0.021);
          hit('physical lance front', -w / 2, 2.035, z + 0.023);
          back('physical lance rear', -w / 2, 2.035, z - 0.023);
        }
      }
    for (let sector = 0; sector < 4; sector++) {
      const a = (sector * Math.PI) / 2,
        cs = Math.cos(a),
        sn = Math.sin(a),
        P = (p) => [cs * p[0] + sn * p[2], p[1], -sn * p[0] + cs * p[2]];
      for (const sign of [-1, 1]) {
        const x = sign * c.gateHalfWidth,
          z = c.gatePostZ;
        if (d === 3) {
          const q = P([x + 0.0475, 0.9, z + 0.1225]),
            h = ray(P([x + 0.0475, 0.9, z + 0.126]), P([x + 0.0475, 0.9, z + 0.119]))[0];
          check(
            'physical bundled entrance rod',
            !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00004,
          );
        } else
          check(
            'physical simplified entrance post',
            ray(P([x, 1.2, z + 0.09]), P([x, 1.2, z + 0.07])).length > 0,
          );
      }
      check(
        'retained open entrance approach',
        ray(P([0, 1.15, 14.6]), P([0, 1.15, 13.9])).length === 0,
      );
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
      model: 'washington_monument_baltimore',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
