/** Actual imported geometry checks: courtyard sky/floors, open galleries and recessed windows. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  jeronimosMonastery,
  jeronimosMonasteryDistrict,
  jeronimosMonasterySkyline,
  jeronimosMonasteryStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-jeronimos-monastery.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  runtime = new URL('content/worldgen/assets/places/ey/eyc/jeronimos_monastery/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:4a576886a3ab49a36c5a4856c585957cf4d6c93da0c259de1003761f4ab4f45e',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:eba4e2548e7384e4461087a877cae9d32e11a7df348ddb02aaf0190130ae15ba',
);
assert.equal(frame.geometry.parts.length, 5);
assert.equal(frame.geometry.holes.length, 2);
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
for (let x = -232; x <= 65; x++)
  for (let z = -146; z <= 15; z++)
    if (inside([x, z], frame.geometry.outline)) coverage.push([x, z]);
const result = [],
  failures = [],
  builders = [
    jeronimosMonasterySkyline,
    jeronimosMonasteryDistrict,
    jeronimosMonasteryStreet,
    jeronimosMonastery,
  ];
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  builders[d](builder);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `Jerónimos source ${d}`);
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
      `Jerónimos runtime ${d}`,
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
  for (const [name, points, floor] of [
    [
      'principal cloister',
      [
        [-12, -45],
        [-12, -67],
        [10, -45],
        [10, -67],
        [-7, -56],
        [5, -56],
      ],
      2.65,
    ],
    [
      'western court',
      [
        [-180, -85],
        [-180, -55],
        [-110, -85],
        [-110, -55],
        [-150, -60],
        [-95, -70],
      ],
      1.2,
    ],
  ])
    for (const [x, z] of points) {
      check(`${name} open sky`, ray([x, 55, z], [x, 3.05, z]).length === 0, { x, z });
      check(
        `${name} physical court floor`,
        ray([x, floor + 0.09, z], [x, floor - 0.07, z]).length > 0,
        { x, z },
      );
    }
  if (d >= 1) {
    const court = frame.geometry.holes[1].slice(0, -1);
    for (let i = 0; i < court.length; i++) {
      const a = court[i],
        b = court[(i + 1) % court.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
        n = [u[1], -u[0]],
        count = len > 20 ? 5 : 1;
      for (let j = 0; j < count; j++) {
        const t = (j + 0.625) / count,
          p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
        for (const y of [4.6, 9.4]) {
          const pt = (v) => [p[0] + n[0] * v, y, p[1] + n[1] * v];
          check('gallery actual open air depth', ray(pt(-0.2), pt(3.1)).length === 0, {
            side: i,
            bay: j,
            y,
          });
          check('gallery masonry back wall', ray(pt(3.15), pt(4.2)).length > 0, {
            side: i,
            bay: j,
            y,
          });
        }
      }
    }
  }
  const recess = (name, p, n, y, depth) => {
    const at = (k) => [p[0] + n[0] * k, y, p[1] + n[1] * k];
    const front = ray(at(0.12), at(-depth * 0.68)),
      back = ray(at(-depth * 0.68), at(-depth - 0.2));
    check(`${name} clear recess`, front.length === 0, {
      point: p,
      normal: n,
      y,
      first: front
        .slice(0, 2)
        .map((h) => ({ point: h.point.toArray(), material: h.object.material.name })),
    });
    check(`${name} bounded rear`, back.length > 0, { point: p, normal: n, y });
  };
  if (d >= 1) {
    for (const [x, z] of [
      [-209.5, -10.285],
      [-120, -8.84],
    ])
      recess('dormitory arcade', [x, z], [0, 1], 3.6, 1.1);
  }
  if (d >= 2) {
    recess('lower rounded south bell window', [-24.9, 1.635], [0, 1], 4.5, 1.1);
    recess('upper pointed south bell window', [-24.9, 1.635], [0, 1], 14.4, 1.1);
    recess('church pointed south window', [-11.5, 0], [0, 1], 12.4, 1.25);
    recess('south campanile bell opening', [-25.3, 1.1], [0, 1], 28.5, 0.85);
    recess('west axial rose', [-30.62, -12.1], [-1, 0], 16.45, 1.1);
    recess('south chapel oculus', [32.3, 14.435], [0, 1], 13.7, 1.1);
    for (const [x, z] of [
      [-228.15, -10.65],
      [-228.15, -21.3],
      [-42.65, -7.9],
      [-42.65, -18.55],
    ])
      for (const [nx, nz] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ])
        for (const y of [19.2, 20.0, 21.0, 22.0])
          for (const offset of [-0.3, 0, 0.3])
            recess(
              'slender turret real upper window',
              [x + nx * 3.465 - nz * offset, z + nz * 3.465 + nx * offset],
              [nx, nz],
              y,
              0.55,
            );
  }
  result.push({
    level: level.name,
    triangles,
    hash: level.hash,
    coverageProbes: coverage.length,
    controls,
    failed: controls.filter((c) => !c.pass).length,
  });
}
console.log(
  JSON.stringify(
    {
      format: 'molen/structure-geometry-proof@1',
      structure: 'jeronimos_monastery',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      terrainValuesUnchanged: true,
      results: result,
      failures,
      status: failures.length ? 'failed' : 'passed',
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
