/** Imported closed corbel arches, physical counter air and immutable full tower surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  whiteTowerOfThessalonikiDistrict,
  whiteTowerOfThessalonikiModel,
  whiteTowerOfThessalonikiSkyline,
  whiteTowerOfThessalonikiStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-white-tower-of-thessaloniki.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/sx/sx0/white_tower_of_thessaloniki/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-corbel-arch-surroundings.json'),
  c = read('corbel-arch-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const slots = ['archVoussoir', 'archSpandrel', 'steppedCorbel'];
for (const [d, build] of [
  whiteTowerOfThessalonikiSkyline,
  whiteTowerOfThessalonikiDistrict,
  whiteTowerOfThessalonikiStreet,
  whiteTowerOfThessalonikiModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `WhiteTower source${d}`);
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
      `WhiteTower imported${d}`,
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
  check('all full original non-corbel-band attribute triangles exact', true);
  if (d === 3) {
    const P = (a, p, r = c.radius) => [
        Math.cos(a) * p[0] + Math.sin(a) * (r + p[2]),
        p[1],
        -Math.sin(a) * p[0] + Math.cos(a) * (r + p[2]),
      ],
      pitch = (Math.PI * 2) / c.arches;
    for (let i = 0; i < c.arches; i++) {
      const a = i * pitch,
        hit = (name, p, from = 1) => {
          const q = P(a, p),
            A = P(a, [p[0], p[1], p[2] + from * 0.005]),
            B = P(a, [p[0], p[1], p[2] - from * 0.005]),
            h = ray(A, B)[0];
          check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00005, {
            q,
            actual: h?.point.toArray(),
          });
          return h;
        };
      for (const j of [0, 3, 6, 9, 12]) {
        const aa = (Math.PI * j) / c.voussoirs + (j === 0 ? 0 : c.jointRadians / 2),
          bb = (Math.PI * (j + 1)) / c.voussoirs - (j === c.voussoirs - 1 ? 0 : c.jointRadians / 2),
          angle = (aa + bb) / 2,
          r = 0.5 * (c.halfWidth + c.outerWidth),
          h = 0.5 * (c.innerHeight + c.outerHeight);
        const face = hit('each physical voussoir front', [
          r * Math.cos(angle),
          c.spring + h * Math.sin(angle),
          c.front,
        ]);
        check(
          'new stone uses raw limestone without false joints',
          JSON.stringify(face.object.material.userData).includes('stone_limestone_raw'),
        );
        hit(
          'each physical voussoir closed rear',
          [r * Math.cos(angle), c.spring + h * Math.sin(angle), c.back],
          -1,
        );
      }
      hit('closed spandrel front', [0.79, 26.72, c.front - 0.022]);
      hit('closed spandrel rear', [0.79, 26.72, c.back], -1);
      check(
        'actual empty corbel niche centre',
        ray(P(a, [0, 26.1, 0.3]), P(a, [0, 26.1, -0.2])).length === 0,
      );
      check(
        'actual open arch intrados counter',
        ray(P(a, [0.15, 26.4, 0.2]), P(a, [0.15, 26.4, -0.2])).length === 0,
      );
      // Bounded upward ray hits the actual inner arch polygon, not its nominal ellipse.
      const x = 0.12,
        j = Math.floor((Math.acos(x / c.halfWidth) / Math.PI) * c.voussoirs),
        aa = (Math.PI * j) / c.voussoirs + (j === 0 ? 0 : c.jointRadians / 2),
        bb = (Math.PI * (j + 1)) / c.voussoirs - (j === c.voussoirs - 1 ? 0 : c.jointRadians / 2),
        angles = Array.from(
          { length: c.archSubsegments + 1 },
          (_, k) => aa + ((bb - aa) * k) / c.archSubsegments,
        );
      let pair;
      for (let k = 0; k < angles.length - 1; k++)
        if (x <= c.halfWidth * Math.cos(angles[k]) && x >= c.halfWidth * Math.cos(angles[k + 1]))
          pair = [angles[k], angles[k + 1]];
      assert(pair);
      const x0 = c.halfWidth * Math.cos(pair[0]),
        x1 = c.halfWidth * Math.cos(pair[1]),
        y0 = c.spring + c.innerHeight * Math.sin(pair[0]),
        y1 = c.spring + c.innerHeight * Math.sin(pair[1]),
        y = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0),
        q = P(a, [x, y, -0.14]),
        h = ray(P(a, [x, y - 0.004, -0.14]), P(a, [x, y + 0.004, -0.14]))[0];
      check(
        'actual closed curved arch underside',
        !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00005,
        { q, actual: h?.point.toArray() },
      );
      const b = a + pitch / 2,
        k = c.brackets,
        r = k.radius;
      for (const [index, t] of [
        [0, 0.5],
        [2, 0.5],
        [4, 0.5],
        [6, 0.5],
        [7, 0.5],
        [9, 0.5],
      ]) {
        const p = k.rings[index],
          v = k.rings[index + 1],
          y = p[0] + t * (v[0] - p[0]),
          z = p[3] + t * (v[3] - p[3]),
          q = P(b, [0.02, y, z], r),
          h = ray(P(b, [0.02, y, z + 0.004], r), P(b, [0.02, y, z - 0.004], r))[0];
        check(
          'stepped closed corbel profile front',
          !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00005,
          { q, actual: h?.point.toArray() },
        );
      }
      const cap = P(b, [0.02, 25, -0.12], r),
        bottom = ray(P(b, [0.02, 24.996, -0.12], r), P(b, [0.02, 25.004, -0.12], r))[0];
      check(
        'physical corbel downward bottom',
        !!bottom && bottom.point.distanceTo(new T.Vector3(...cap)) < 0.00005,
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
      model: 'white_tower_of_thessaloniki',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
