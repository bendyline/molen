/** Read-only actual runtime checks: native plans, architectural negative space and physical floor coverage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { belemTower } from '../../../../../../../packages/worldgen/scripts/structure-belem-tower.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  runtime = new URL('content/worldgen/assets/places/ey/eyc/belem_tower/', root),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  frame = read('map-frame.json'),
  opening = read('ground-opening.json'),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:758b3563da933414eb1d2103bcb0a11eb5ea7c1dd4cd4e51170ce2e0b85040aa',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:98f0786d967efb59e7fbcee92da2882433e769cfbce623431dd813d08c759860',
);
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
const probes = [];
for (let x = -15; x <= 15; x += 0.5)
  for (let z = -9; z <= 36; z += 0.5) if (inside([x, z], opening.outline)) probes.push([x, z]);
const results = [],
  failures = [];
for (let d = 0; d < 4; d++) {
  const source = new MeshBufferBuilder();
  belemTower(source, undefined, d);
  const m = source.finalize();
  validateAuthoredMesh(m, `Belém source ${d}`);
  assert(m.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const vertices = [],
    buckets = new Map();
  let count = 0;
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        mat.side = T.DoubleSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Belém runtime ${d}`,
    );
    count += idx.length / 3;
    for (let i = 0; i < p.count; i++) vertices.push([p.getX(i), p.getY(i), p.getZ(i)]);
    for (let i = 0; i < idx.length; i += 3) {
      const q = Array.from({ length: 3 }, (_, j) => {
          const k = idx[i + j];
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
  assert.equal(count, level.triangles);
  const covered = ([x, z]) =>
    (buckets.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []).some(({ q, den }) => {
      const a = ((q[1][2] - q[2][2]) * (x - q[2][0]) + (q[2][0] - q[1][0]) * (z - q[2][2])) / den,
        b = ((q[2][2] - q[0][2]) * (x - q[2][0]) + (q[0][0] - q[2][0]) * (z - q[2][2])) / den;
      return a >= -1e-5 && b >= -1e-5 && a + b <= 1 + 1e-5;
    });
  const missing = probes.filter((p) => !covered(p));
  if (missing.length)
    failures.push({
      level: level.name,
      name: 'physical opening has continuous model-owned floor/base coverage',
      missing: missing.length,
      first: missing.slice(0, 20),
    });
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
    datum = 5.1389;
  const nativeRay = (a, b) =>
    ray(
      a.map((v, i) => v - (i === 1 ? datum : 0)),
      b.map((v, i) => v - (i === 1 ? datum : 0)),
    );
  for (const x of [-1, 0, 1])
    for (const z of [12, 16, 20]) {
      controls.push({
        name: 'court open sky below terrace',
        x,
        z,
        pass: nativeRay([x, 15, z], [x, 3.35, z]).length === 0,
      });
      controls.push({
        name: 'court has lower masonry floor',
        x,
        z,
        pass: nativeRay([x, 3.35, z], [x, 3.1, z]).length > 0,
      });
    }
  if (d > 0) {
    // Native face endpoints give a control axis independent of model mesh export.
    const body = frame.geometry.parts
      .find((p) => p.id.endsWith('/35184490579137'))
      .outline.slice(0, -1);
    const a = body[1],
      b = body[2],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
    const checkHole = (p, n, y, depth, name) => {
      const point = (k) => [p[0] + n[0] * k, y, p[1] + n[1] * k];
      controls.push({
        name: `${name} real recess`,
        pass: nativeRay(point(0.08), point(-depth * 0.7)).length === 0,
      });
      controls.push({
        name: `${name} closed rear`,
        pass: nativeRay(point(-depth * 0.7), point(-depth - 0.15)).length > 0,
      });
    };
    for (const [offset, y] of [
      [0, 8.5],
      [-0.55, 14.3],
      [0.55, 14.3],
      ...(d > 1
        ? [
            [-0.55, 19.9],
            [0.55, 19.9],
          ]
        : []),
    ]) {
      const t = 0.5 + offset / len;
      checkHole([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n, y, 0.85, 'north window');
    }
    const c = body[3],
      e = body[0],
      ll = Math.hypot(e[0] - c[0], e[1] - c[1]),
      nn = [(e[1] - c[1]) / ll, -(e[0] - c[0]) / ll];
    for (let j = 0; j < 7; j++) {
      const t = (j + 0.5) / 7;
      checkHole(
        [c[0] + (e[0] - c[0]) * t, c[1] + (e[1] - c[1]) * t],
        nn,
        14.4,
        1.25,
        'river loggia arch',
      );
    }
    const fort = frame.geometry.parts
        .find((p) => p.id.endsWith('/52776577266815'))
        .outline.slice(0, -1),
      counts = { 4: 5, 5: 2, 6: 2, 7: 2, 8: 5 };
    for (const [key, count] of Object.entries(counts)) {
      const i = +key,
        a = fort[i],
        b = fort[(i + 1) % fort.length],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count;
        checkHole(
          [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
          n,
          3.95,
          1.05,
          'artillery port',
        );
      }
    }
  }
  const sourceGround = read('terrain-grid.json'),
    at = (x, z) => {
      const a = (x - sourceGround.origin[0]) / sourceGround.stepMeters,
        b = (z - sourceGround.origin[1]) / sourceGround.stepMeters,
        i = Math.floor(a),
        j = Math.floor(b),
        u = a - i,
        v = b - j,
        h = sourceGround.heightsMeters;
      return (
        (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
        (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v
      );
    };
  const bridgePoints = [];
  for (let x = 13; x <= 27; x += 0.5)
    for (const z of [-3.84, -2.94, -2.04]) bridgePoints.push([x, z, 3.24]);
  for (let z = -3.5; z >= -42; z -= 0.5)
    for (const x of [26.1, 27, 27.9])
      bridgePoints.push([x, z, 3.24 + ((at(27, -42) + 0.08 - 3.24) * (-2.94 - z)) / 39.06]);
  let bridgeMinimumClearance = Infinity,
    bridgeMaximumRuntimeError = 0;
  for (const [x, z, y] of bridgePoints) {
    const intersections = nativeRay([x, y + 0.3, z], [x, y - 0.3, z]);
    const error = intersections.length ? Math.abs(intersections[0].point.y + 5.1389 - y) : Infinity;
    bridgeMaximumRuntimeError = Math.max(bridgeMaximumRuntimeError, error);
    bridgeMinimumClearance = Math.min(bridgeMinimumClearance, y - at(x, z));
  }
  controls.push({
    name: 'bridge actual continuous deck',
    pass: bridgeMaximumRuntimeError < 0.025,
  });
  controls.push({
    name: 'bridge clears unchanged terrain across width',
    pass: bridgeMinimumClearance >= 0.06,
  });
  for (const c of controls) if (!c.pass) failures.push({ level: level.name, ...c });
  let planError = 0,
    courtError = 0;
  for (const [r, y, key] of [
    [frame.geometry.foundationOutline.slice(0, -1), 1.2 - 5.1389, 'base'],
    [
      frame.geometry.parts.find((p) => p.id.endsWith('/35185759050920')).outline.slice(0, -1),
      3.24 - 5.1389,
      'court',
    ],
  ]) {
    for (const [x, z] of r) {
      const p = [x, y, z],
        error = vertices.reduce(
          (v, q) => Math.min(v, Math.hypot(...p.map((x, i) => x - q[i]))),
          Infinity,
        );
      if (key === 'base') planError = Math.max(planError, error);
      else courtError = Math.max(courtError, error);
    }
  }
  assert(planError < 0.0001);
  assert(courtError < 0.0001);
  results.push({
    level: level.name,
    hash: level.hash,
    triangles: count,
    drawCalls: level.drawCalls,
    sourceTriangles: m.triangleCount,
    physicalOpeningProbes: probes.length,
    missingCoverage: missing.length,
    negativeSpaceControls: controls.length,
    bridgeTerrainProbes: bridgePoints.length,
    bridgeMinimumClearanceMeters: bridgeMinimumClearance,
    bridgeMaximumRuntimeErrorMeters: bridgeMaximumRuntimeError,
    bridgeSurfaceToleranceMeters: 0.025,
    nativeSiteMaximumFloat32ErrorMeters: planError,
    nativeCourtMaximumFloat32ErrorMeters: courtError,
  });
}
const report = {
  format: 'molen/structure-geometry-review@1',
  assetId: side.id,
  status: failures.length ? 'needs-revision' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  lodRecipeHash: side.runtimeLods.recipeHash,
  openingHash: hashBytes(fs.readFileSync(new URL('ground-opening.json', dir))),
  levels: results,
  failures,
  limitations: [
    'Bridge surface controls allow0.025m for12mm planks and the small overlap at the sloping L-joint; they do not permit missing deck surfaces.',
    'Half-metre sampled physical coverage and specific rays prove these controls, not complete manifold topology or walkable interior/collision.',
    'Native foundation/court traces are quantized controls; bridge, sculpture, ornament and vertical controls remain photographic interpretations. Actual visual and geographic reviews are separate.',
  ],
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
