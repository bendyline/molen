/** Current imported hollow tile covers, carved spouts and unchanged complete tower/ground. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  cross,
  normalize,
  validateAuthoredMesh,
} from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  towerOfTheWindsDistrict,
  towerOfTheWindsModel,
  towerOfTheWindsSkyline,
  towerOfTheWindsStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-tower-of-the-winds.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/sw/swb/tower_of_the_winds/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-roof-cornice-surroundings.json'),
  c = read('roof-cornice-construction-controls.json'),
  grid = read('terrain-grid.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  slots = ['roofCover', 'corniceProfile', 'lionMask', 'lionCarving'],
  results = [],
  allGround = [];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const ground = (x, z) => {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = grid.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    grid.modelDatumElevationMeters
  );
};
for (const [d, build] of [
  towerOfTheWindsSkyline,
  towerOfTheWindsDistrict,
  towerOfTheWindsStreet,
  towerOfTheWindsModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Winds source${d}`);
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
  assert.deepEqual(
    added,
    d === 3
      ? { roofCover: 20800, corniceProfile: 156, lionMask: 5376, lionCarving: 5472 }
      : { roofCover: 0, corniceProfile: 0, lionMask: 0, lionCarving: 0 },
  );
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
      `Winds imported${d}`,
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
    },
    hit = (name, A, B, q) => {
      const h = ray(A, B)[0];
      check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00005, {
        q,
        actual: h?.point.toArray(),
      });
      return h;
    };
  check(
    'all original full-tower attributes outside2100removed close roof/cornice/spout triangles exact',
    true,
  );
  for (const p of c.preservedOpenings.filter((p) => p.level === d))
    check(p.name, ray(p.a, p.b).length === 0);
  let contacts = 0;
  const localGround = [];
  for (let face = 0; face < 8; face++)
    for (let j = 0; j < 16; j++) {
      const a = (face * Math.PI) / 4,
        P = (x, y, z) => [Math.cos(a) * x + Math.sin(a) * z, y, -Math.sin(a) * x + Math.cos(a) * z],
        u = (j + 0.5) / 16 - 0.5;
      let found = false;
      for (const [r, lo, hi] of [
        [4.7263, -0.45, 0],
        [4.5563, 0, 0.45],
        [4.3863, 0.45, 0.9],
        [4.2463, 0.9, 9.65],
      ]) {
        const x = 2 * r * Math.sin(Math.PI / 8) * u,
          z = r * Math.cos(Math.PI / 8),
          point = P(x, 0, z),
          y = ground(point[0], point[2]);
        if (y < lo || y > hi) continue;
        hit(
          'unchanged original stair/body face meets independent source ground',
          P(x, y, z + 0.008),
          P(x, y, z - 0.008),
          P(x, y, z),
        );
        contacts++;
        localGround.push(y);
        found = true;
        break;
      }
      check('original native perimeter contact covered', found, { face, j });
    }
  allGround.push(...localGround);
  if (d === 3) {
    const k = c.roof;
    for (let i = 0; i < k.ribs; i++) {
      const face = Math.floor(i / 3),
        t = (i % 3) / 3,
        a = (face * Math.PI) / 4 - Math.PI / 8,
        b = ((face + 1) * Math.PI) / 4 - Math.PI / 8,
        A = [
          (1 - t) * k.outerRadius * Math.sin(a) + t * k.outerRadius * Math.sin(b),
          k.outerY,
          (1 - t) * k.outerRadius * Math.cos(a) + t * k.outerRadius * Math.cos(b),
        ],
        B = [A[0] * k.innerRatio, k.innerY, A[2] * k.innerRatio],
        axis = normalize(B.map((v, j) => v - A[j])),
        u = normalize([axis[2], 0, -axis[0]]),
        v = cross(axis, u),
        L = Math.hypot(...B.map((v, j) => v - A[j])),
        P = (s, x, y) =>
          A.map((n, j) => n + axis[j] * s + u[j] * x + v[j] * (k.baseNormalOffset + y)),
        N = i % 3 === 0 ? k.hipSections : k.sections;
      for (let j = 0; j < N; j++) {
        const lo = (j * L) / N + (j ? k.jointGap / 2 : 0),
          hi = ((j + 1) * L) / N - (j < N - 1 ? k.jointGap / 2 : 0),
          s = (lo + k.bevelLength + hi) / 2;
        const h = hit(
          'each hollow cover has a physical curved top',
          P(s, 0, k.height + 0.004),
          P(s, 0, k.height - 0.004),
          P(s, 0, k.height),
        );
        check(
          'new individual ochre covers use continuous fired clay without false grout',
          JSON.stringify(h.object.material.userData).includes('clay_fired'),
        );
        hit(
          'each cover has an actual arched underside',
          P(s, 0, k.innerHeight - 0.004),
          P(s, 0, k.innerHeight + 0.004),
          P(s, 0, k.innerHeight),
        );
        check(
          'each hollow cover has actual air under its arch',
          ray(P(s - 0.012, 0, 0.035), P(s + 0.012, 0, 0.035)).length === 0,
        );
        check(
          'each cover end has an actual open arch mouth',
          ray(P(lo - 0.003, 0, 0.035), P(lo + 0.04, 0, 0.035)).length === 0,
        );
        hit(
          'original marble slab physically supports each tile',
          P(s, 0, 0.02),
          P(s, 0, -0.015),
          P(s, 0, -k.baseNormalOffset),
        );
      }
    }
    for (let face = 0; face < 8; face++) {
      const a = (face * Math.PI) / 4,
        P = (x, y, z) => [Math.cos(a) * x + Math.sin(a) * z, y, -Math.sin(a) * x + Math.cos(a) * z];
      for (let j = 0; j < c.cornice.profile.length - 1; j++) {
        const p = c.cornice.profile[j],
          n = c.cornice.profile[j + 1],
          y = (p[0] + n[0]) / 2,
          z = ((p[1] + n[1]) / 2) * Math.cos(Math.PI / 8);
        hit(
          'closed stepped cornice front profile',
          P(0.5, y, z + 0.004),
          P(0.5, y, z - 0.004),
          P(0.5, y, z),
        );
      }
      hit(
        'physical cornice overhang underside',
        P(0.5, 11.236, 3.94),
        P(0.5, 11.244, 3.94),
        P(0.5, 11.24, 3.94),
      );
      const k = c.spouts,
        Q = (x, y, z) => P(x, y, k.anchorRadius + z);
      for (const x of k.offsets) {
        check(
          'each lion mouth has real recessed air',
          ray(Q(x, k.centerY + k.mouth.centerY, 0.2), Q(x, k.centerY + k.mouth.centerY, 0.02))
            .length === 0,
        );
        hit(
          'each mouth has a physical inner return',
          Q(x + 0.03, k.centerY + k.mouth.centerY, 0.05),
          Q(x + 0.04, k.centerY + k.mouth.centerY, 0.05),
          Q(x + k.mouth.rx, k.centerY + k.mouth.centerY, 0.05),
        );
        const angle = (Math.PI * 2) / k.segments,
          xx = x + ((k.mouth.rx + k.outerProfile.at(-1)[1]) * (1 + Math.cos(angle))) / 4,
          yy =
            k.centerY +
            k.mouth.centerY / 2 +
            ((k.mouth.ry + k.outerProfile.at(-1)[2]) * Math.sin(angle)) / 4,
          lip = ray(Q(xx, yy, 0.164), Q(xx, yy, 0.157))[0];
        check('closed lion muzzle annular front', !!lip, { x, face });
        hit(
          'actual projecting carved nose',
          Q(x + 0.005, k.centerY + 0.035, 0.178),
          Q(x + 0.005, k.centerY + 0.035, 0.17),
          Q(x + 0.005, k.centerY + 0.035, 0.174),
        );
        for (const sign of [-1, 1]) {
          hit(
            'physical brow overhang',
            Q(x + sign * 0.077, k.centerY + 0.057, 0.154),
            Q(x + sign * 0.077, k.centerY + 0.057, 0.146),
            Q(x + sign * 0.077, k.centerY + 0.057, 0.15),
          );
          hit(
            'physical lion ear crest',
            Q(x + sign * 0.105, k.centerY + 0.136, 0.065),
            Q(x + sign * 0.105, k.centerY + 0.128, 0.065),
            Q(x + sign * 0.105, k.centerY + 0.132, 0.065),
          );
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
    groundContacts: contacts,
    relativeGroundRange: [Math.min(...localGround), Math.max(...localGround)],
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'tower_of_the_winds',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
      terrainContact: {
        probes: results.reduce((n, r) => n + r.groundContacts, 0),
        relativeGroundRange: [Math.min(...allGround), Math.max(...allGround)],
        sourceGridHash: hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
        originalMapGroundFootingAndPlacementUnchanged: true,
      },
    },
    null,
    2,
  ),
);
