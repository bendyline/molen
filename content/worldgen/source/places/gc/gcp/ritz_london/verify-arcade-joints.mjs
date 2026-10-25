/** Verify changed Ritz geometry, exact retained levels and real imported joint depth. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  ritz,
  ritzDistrict,
  ritzSkyline,
  ritzStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-ritz-london.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/gc/gcp/ritz_london/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('arcade-construction-controls.json'),
  baseline = read('retained-arcade-surroundings-v2.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
const inside = (ps, slot) =>
  site.piers.some(([a, b]) =>
    ps.every(
      (p) =>
        p[0] >= a - 1e-4 &&
        p[0] <= b + 1e-4 &&
        ((slot === 'granite' &&
          p[1] >= -2.4001 &&
          p[1] <= 6.5001 &&
          p[2] >= 20.9799 &&
          p[2] <= 24.1301) ||
          (slot === 'iron' && p[1] >= 0.4999 && p[1] <= 3.3981 && Math.abs(p[2] - 24.14) < 1e-4)),
    ),
  );
assert.equal(
  hashBytes(fs.readFileSync(new URL('retained-arcade-surroundings.json', dir))),
  baseline.originalBaselineHash,
);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `unchanged ${n}`);
const results = [];
for (const [d, build] of [ritzSkyline, ritzDistrict, ritzStreet, ritz].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Ritz source ${d}`);
  const h = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3)),
      slot = source.groups.find((g) => k >= g.start && k < g.start + g.count).slot;
    if (
      d === 3 &&
      inside(
        ids.map((i) => Array.from(source.positions.slice(i * 3, i * 3 + 3))),
        slot,
      )
    )
      continue;
    retainedTriangles++;
    for (const i of ids)
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
  assert.equal(
    'sha256:' + h.digest('hex'),
    baseline.levels[d].attributeHash,
    'original surrounding attributes',
  );
  assert.equal(retainedTriangles, baseline.levels[d].retainedTriangles);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const g = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  g.scene.updateMatrixWorld(true);
  let triangles = 0,
    jointShelfTriangles = 0,
    jointBackTriangles = 0;
  g.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Ritz import ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    for (let k = 0; k < idx.length; k += 3) {
      const ps = Array.from(idx.slice(k, k + 3), (i) => [p.getX(i), p.getY(i), p.getZ(i)]);
      if (!site.piers.some(([a, b]) => ps.every((p) => p[0] >= a - 1e-4 && p[0] <= b + 1e-4)))
        continue;
      if (
        site.jointYs.some((y) =>
          ps.every((p) => Math.abs(p[1] - y) < 1e-4 || Math.abs(p[1] - (y + 0.018)) < 1e-4),
        ) &&
        ps.some((p) => Math.abs(p[2] - 24.13) < 1e-4) &&
        ps.some((p) => Math.abs(p[2] - 24.105) < 1e-4) &&
        Math.max(...ps.map((p) => p[1])) - Math.min(...ps.map((p) => p[1])) < 1e-4
      )
        jointShelfTriangles++;
      if (
        site.jointYs.some((y) => ps.every((p) => p[1] >= y - 1e-4 && p[1] <= y + 0.0181)) &&
        ps.every((p) => Math.abs(p[2] - 24.105) < 1e-4)
      )
        jointBackTriangles++;
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
      ).intersectObject(g.scene);
    };
  check('exact original lower level or retained close surroundings', true);
  if (d === 3) {
    check('all112joints have two actual horizontal shelf faces', jointShelfTriangles === 448, {
      jointShelfTriangles,
    });
    check('all112joints have physical recessed back faces', jointBackTriangles === 224, {
      jointBackTriangles,
    });
    for (const [a, b] of site.piers) {
      const x = (a + b) / 2;
      for (const y of site.jointYs) {
        const back = ray([x, y + 0.009, 24.2], [x, y + 0.009, 24.0]);
        check(
          'joint back lies25mm behind front',
          back.length > 0 && Math.abs(back[0].point.z - 24.105) < 1e-4,
          { x, y },
        );
        const face = ray([x, y + 0.05, 24.2], [x, y + 0.05, 24.0]);
        check(
          'stone course retains original front plane',
          face.length > 0 && Math.abs(face[0].point.z - 24.13) < 1e-4,
          { x, y },
        );
        const floor = ray([x, y + 0.015, 24.1175], [x, y - 0.01, 24.1175]);
        check(
          'joint has a physical lower ledge',
          floor.length > 0 && Math.abs(floor[0].point.y - y) < 1e-4,
          { x, y },
        );
        const top = ray([x, y + 0.003, 24.1175], [x, y + 0.03, 24.1175]);
        check(
          'joint has a physical upper ledge',
          top.length > 0 && Math.abs(top[0].point.y - y - 0.018) < 1e-4,
          { x, y },
        );
      }
    }
  }
  for (const x of site.archCenters) {
    check(
      'original passage stays open before glazing',
      ray([x, 2, 24.5], [x, 2, 21.2]).length === 0,
      { x },
    );
    const floor = ray([x, 0.15, 22.4], [x, -0.1, 22.4]);
    check('original arcade floor retained', floor.length > 0 && Math.abs(floor[0].point.y) < 1e-4, {
      x,
    });
    const soffit = ray([x, 5.2, 22.4], [x, 5.6, 22.4]);
    check('original covered arch soffit retained', soffit.length > 0 && soffit[0].point.y > 5.4, {
      x,
    });
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    addedTriangles: triangles - baseline.levels[d].originalTriangles,
    retainedTriangles,
    jointShelfTriangles,
    jointBackTriangles,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'ritz_london',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: site.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
