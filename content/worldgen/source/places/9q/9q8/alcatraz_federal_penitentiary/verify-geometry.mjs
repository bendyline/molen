/** Actual imported geometry checks: physical building coverage, unchanged original ground contact and actual recessed apertures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  alcatrazFederalPenitentiary,
  alcatrazFederalPenitentiaryDistrict,
  alcatrazFederalPenitentiarySkyline,
  alcatrazFederalPenitentiaryStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-alcatraz-federal-penitentiary.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  runtime = new URL('content/worldgen/assets/places/9q/9q8/alcatraz_federal_penitentiary/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:aece7095819496c890bb73866d4cfd16889b01e9755030a1357963b381f60880',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:a29f826387a69ffc15f0527fc46f043bd086957d5a3af766f10326fba0444b5a',
);
assert.equal(frame.geometry.parts.length, 3);
assert.equal(frame.geometry.outline.length, 20);
const inside = (p, r) => {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > p[1] !== r[j][1] > p[1] &&
      p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      yes = !yes;
  return yes;
};
const ground = read('terrain-grid.json'),
  datum = ground.modelDatumElevationMeters;
const groundAt = ([x, z]) => {
  x = (x - ground.origin[0]) / ground.stepMeters;
  z = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(x),
    j = Math.floor(z),
    u = x - i,
    v = z - j,
    h = ground.heightsMeters;
  return (
    (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
    (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v -
    datum
  );
};
const perimeter = [];
for (let i = 0; i < frame.geometry.outline.length - 1; i++) {
  const a = frame.geometry.outline[i],
    b = frame.geometry.outline[i + 1],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
    count = Math.ceil(len / 2);
  for (let j = 0; j < count; j++) {
    const t = (j + 0.5) / count,
      p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    perimeter.push({ p, n, y: groundAt(p) + 0.15, edge: i });
  }
}
const coverage = [];
for (let x = -31; x <= 20; x++)
  for (let z = -118; z <= 15; z++)
    if (inside([x, z], frame.geometry.outline)) coverage.push([x, z]);
const result = [],
  failures = [],
  builders = [
    alcatrazFederalPenitentiarySkyline,
    alcatrazFederalPenitentiaryDistrict,
    alcatrazFederalPenitentiaryStreet,
    alcatrazFederalPenitentiary,
  ];
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  builders[d](builder);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `Alcatraz source ${d}`);
  assert(mesh.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const buckets = new Map();
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        mat.side = T.DoubleSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Alcatraz runtime ${d}`,
    );
    triangles += indices.length / 3;
    for (let i = 0; i < indices.length; i += 3) {
      const q = Array.from({ length: 3 }, (_, j) => {
          const k = indices[i + j];
          return new T.Vector3(p.getX(k), p.getY(k), p.getZ(k))
            .applyMatrix4(o.matrixWorld)
            .toArray();
        }),
        den = (q[1][2] - q[2][2]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][2] - q[2][2]);
      if (Math.abs(den) < 1e-8) continue;
      const xx = q.map((p) => p[0]),
        zz = q.map((p) => p[2]);
      for (let x = Math.floor(Math.min(...xx) / 4); x <= Math.floor(Math.max(...xx) / 4); x++)
        for (let z = Math.floor(Math.min(...zz) / 4); z <= Math.floor(Math.max(...zz) / 4); z++) {
          const key = `${x},${z}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push({ q, den });
        }
    }
  });
  assert.equal(triangles, level.triangles);
  const missing = coverage.filter(
    ([x, z]) =>
      !(buckets.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []).some(({ q, den }) => {
        const a = ((q[1][2] - q[2][2]) * (x - q[2][0]) + (q[2][0] - q[1][0]) * (z - q[2][2])) / den,
          b = ((q[2][2] - q[0][2]) * (x - q[2][0]) + (q[0][0] - q[2][0]) * (z - q[2][2])) / den;
        return a >= -1e-5 && b >= -1e-5 && a + b <= 1.00001;
      }),
  );
  const ray = (a, b) => {
    const origin = new T.Vector3(...a),
      v = new T.Vector3(...b).sub(origin);
    return new T.Raycaster(
      origin,
      v.clone().normalize(),
      0.00001,
      v.length() - 0.00001,
    ).intersectObject(gltf.scene);
  };
  const controls = [],
    check = (name, pass, details = {}) => {
      controls.push({ name, pass, ...details });
      if (!pass) failures.push({ level: level.name, name, ...details });
    };
  check('every clipped native ground sample has physical model coverage', missing.length === 0, {
    probes: coverage.length,
    missing: missing.length,
    first: missing.slice(0, 8),
  });
  const unsupported = perimeter.filter(
    ({ p, n, y }) =>
      ray(
        [p[0] + n[0] * (d === 0 ? 4 : 0.4), y, p[1] + n[1] * (d === 0 ? 4 : 0.4)],
        [p[0] - n[0] * (d === 0 ? 4 : 3.2), y, p[1] - n[1] * (d === 0 ? 4 : 3.2)],
      ).length === 0,
  );
  check('native perimeter meets unchanged source terrain', unsupported.length === 0, {
    probes: perimeter.length,
    missing: unsupported.length,
    first: unsupported.slice(0, 10),
  });
  if (d) {
    // Independent expected facade controls taken from the native edges and inspected photos.
    for (const [edge, bays, ys] of [
      [5, 9, [6.1, 11.5]],
      [0, 14, [4.1, 10.4]],
      [7, 14, [4.1, 10.4]],
      [17, 12, [3.1, 9.0]],
      [11, 12, [3.1, 9.0]],
      [14, 4, [3.1, 9.0]],
    ]) {
      const a = frame.geometry.outline[edge],
        b = frame.geometry.outline[edge + 1],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        u = [dx / len, dz / len],
        n = [-dz / len, dx / len];
      for (let bay = 0; bay < bays; bay++)
        for (const y of ys) {
          const x = (len * (bay + 0.5)) / bays,
            door = edge === 5 && bay === 4 && y < 8;
          for (const offset of [-0.22, 0.22]) {
            const p = [a[0] + u[0] * (x + offset), a[1] + u[1] * (x + offset)],
              point = (depth) => [p[0] - n[0] * depth, y, p[1] - n[1] * depth];
            check(
              'facade recess has clear front air',
              ray(point(-0.015), point(0.19)).length === 0,
              { edge, bay, y, offset },
            );
            check(
              'facade recess has physical rear surface',
              ray(point(door ? 0.6 : 0.29), point(door ? 0.85 : 0.5)).length > 0,
              { edge, bay, y, offset },
            );
          }
        }
    }
  }
  result.push({
    level: level.name,
    triangles,
    hash: level.hash,
    drawCalls: level.drawCalls,
    coverageProbes: coverage.length,
    perimeterProbes: perimeter.length,
    controls,
    failed: controls.filter((c) => !c.pass).length,
  });
  gltf.scene.traverse((o) => {
    o.geometry?.dispose();
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}
const out = {
  format: 'molen/structure-geometry-proof@1',
  structure: 'alcatraz_federal_penitentiary',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  terrainValuesUnchanged: true,
  results: result,
  failures,
  status: failures.length ? 'failed' : 'passed',
};
console.log(JSON.stringify(out, null, 2));
assert.equal(failures.length, 0);
