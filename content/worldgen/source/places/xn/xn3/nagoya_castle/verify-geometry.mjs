/** Read-only actual source/runtime geometry and fixed-ground verification. Run from any cwd. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { nagoyaCastle } from '../../../../../../../packages/worldgen/scripts/structure-nagoya-castle.mjs';

process.chdir(new URL('../../../../../../../', import.meta.url).pathname);
const req = createRequire(
    new URL('../../../../../../../packages/worldgen/package.json', import.meta.url),
  ),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  dir = 'content/worldgen/source/places/xn/xn3/nagoya_castle/',
  rt = 'content/worldgen/assets/places/xn/xn3/nagoya_castle/',
  get = (p) => JSON.parse(fs.readFileSync(p)),
  side = get(`${rt}asset.json`),
  f = get(`${dir}map-frame.json`),
  g = get(`${dir}terrain-grid.json`),
  checks = [],
  failures = [],
  meshChecks = [],
  planErrors = [],
  walkSamples = [];
const rec = (level, name, pass, data = {}) => {
  const r = { level, name, ...data };
  checks.push(r);
  if (!pass) failures.push(r);
};
const part = (i) => f.features.find((x) => x.index === i).rings[0],
  bounds = (r) => ({
    min: [Math.min(...r.map((p) => p[0])), Math.min(...r.map((p) => p[1]))],
    max: [Math.max(...r.map((p) => p[0])), Math.max(...r.map((p) => p[1]))],
  }),
  expand = (r, amount) => {
    const b = bounds(r),
      c = b.min.map((v, i) => (v + b.max[i]) / 2),
      size = b.max.map((v, i) => v - b.min[i]);
    return r.map((p) => p.map((v, i) => c[i] + (v - c[i]) * (1 + (2 * amount) / size[i])));
  };
const edge = (r, i, u, y) => {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    p: [a[0] + u * (b[0] - a[0]), y, a[1] + u * (b[1] - a[1])],
    n: [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len],
  };
};
const ground = (x, z) => {
  const px = (x - g.origin[0]) / g.stepMeters,
    pz = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(px),
    j = Math.floor(pz),
    u = px - i,
    v = pz - j;
  assert(i >= 0 && j >= 0 && i + 1 < g.size[0] && j + 1 < g.size[1]);
  return (
    (g.heightsMeters[j][i] * (1 - u) + g.heightsMeters[j][i + 1] * u) * (1 - v) +
    (g.heightsMeters[j + 1][i] * (1 - u) + g.heightsMeters[j + 1][i + 1] * u) * v -
    g.modelDatumElevationMeters
  );
};
for (let level = 0; level < 4; level++) {
  const b = new MeshBufferBuilder();
  nagoyaCastle(b, f, level);
  const m = b.finalize();
  validateAuthoredMesh(m, `source-${level}`);
  assert(m.triangleCount <= [1000, 4000, 16000, 64000][level]);
  meshChecks.push({ level, triangles: m.triangleCount, sourceFloat32Validated: true });
  const bytes = fs.readFileSync(rt + side.runtimeLods.levels[level].file);
  assert.equal(hashBytes(bytes), side.runtimeLods.levels[level].hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const vertices = [];
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.DoubleSide;
    if (o.geometry) {
      const geo = o.geometry,
        p = geo.getAttribute('position'),
        n = geo.getAttribute('normal'),
        uv = geo.getAttribute('uv');
      validateAuthoredMesh(
        {
          positions: p.array,
          normals: n.array,
          uvs: uv?.array ?? new Float32Array(p.count * 2),
          indices: geo.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i),
          vertexCount: p.count,
        },
        `actual-runtime-${level}`,
      );
      for (let i = 0; i < p.count; i++) vertices.push([p.getX(i), p.getY(i), p.getZ(i)]);
    }
  });
  const ray = (a, b) => {
    const p = new T.Vector3(...a),
      v = new T.Vector3(...b).sub(p);
    return new T.Raycaster(p, v.clone().normalize(), 0.00001, v.length() - 0.00001).intersectObject(
      gltf.scene,
    );
  };
  const offset = (p, n, k) => p.map((v, i) => v + n[i] * k);
  if (level > 0)
    for (const t of [
      { i: 4, lo: 12.48, hi: 16.71 },
      { i: 3, lo: 18.1, hi: 23.57 },
      { i: 5, lo: 27.25, hi: 31.07 },
      { i: 7, lo: 34.4, hi: 37.96 },
      { i: 8, lo: 39.65, hi: 41.9 },
    ]) {
      const r = t.i === 3 ? expand(part(t.i), -0.45) : part(t.i);
      for (let side = 0; side < 4; side++) {
        const a = r[side],
          bb = r[(side + 1) % r.length],
          len = Math.hypot(bb[0] - a[0], bb[1] - a[1]),
          count =
            level === 1
              ? Math.min(3, Math.floor(len / 4))
              : Math.floor(len / (t.i === 8 ? 2.3 : 4.2));
        for (const j of [0, Math.floor(count / 2), count - 1]) {
          const y = t.i === 8 ? t.lo + 0.45 + 0.7 : t.lo + (t.hi - t.lo) * 0.38 + 0.65,
            { p, n } = edge(r, side, (j + 0.5) / count + 0.12 / len, y),
            near = ray(offset(p, n, 0.16), offset(p, n, -0.04)),
            closed = ray(offset(p, n, 0.16), offset(p, n, -0.4));
          rec(level, 'native tier window is actually recessed', near.length === 0, {
            part: t.i,
            side,
            window: j,
          });
          rec(
            level,
            'native tier window has recessed glazing',
            closed.length > 0 && closed[0].distance > 0.3 && closed[0].distance < 0.43,
            { part: t.i, side, window: j, firstDistance: closed[0]?.distance },
          );
          if (t.i === 8) {
            const outside = ray(offset(p, n, 4), offset(p, n, 0.17));
            rec(level, 'top-floor window is visible beyond the roof below', outside.length === 0, {
              side,
              window: j,
              obstruction: outside[0]?.point.toArray() ?? null,
            });
          }
        }
      }
    }
  // Both stone entrances remain actual negative volumes with closures even at skyline.
  for (const ctl of [
    {
      name: 'main raised bridge portal',
      r: part(2),
      side: 3,
      u: 0.28,
      y: 8.85,
      normalPadding: 2.3,
    },
    {
      name: 'small exterior stair portal',
      r: part(24),
      side: 1,
      u: 0.2,
      y: 4.5,
      normalPadding: 2.3,
    },
  ]) {
    const { p, n } = edge(ctl.r, ctl.side, ctl.u, ctl.y),
      hits = ray(offset(p, n, ctl.normalPadding), offset(p, n, -2.1));
    const v = hits[0] ? hits[0].point.toArray() : null,
      depth = v ? v.reduce((s, x, i) => s + (x - p[i]) * n[i], 0) : null;
    rec(level, `${ctl.name} has inset closure`, depth !== null && depth < -0.4, {
      actualDepth: depth,
      point: p,
      first: v,
    });
  }
  for (const p of [
    [8, 28],
    [8, 34],
  ]) {
    const h = ray([p[0], 65, p[1]], [p[0], 7.3, p[1]]);
    rec(
      level,
      'connection remains open sky above own bridge floor',
      h.length > 0 && Math.abs(h[0].point.y - 7.6) < 0.01,
      { p, firstHeight: h[0]?.point.y },
    );
  }
  for (const [index, expected] of [
    [2, 12.48],
    [24, 7.7],
    [26, 16.7],
  ]) {
    let err = 0;
    for (const p of part(index))
      err = Math.max(
        err,
        vertices.reduce(
          (v, q) => Math.min(v, Math.hypot(p[0] - q[0], expected - q[1], p[1] - q[2])),
          Infinity,
        ),
      );
    planErrors.push({ level, index, maximumNativeCapVertexErrorMeters: err });
    rec(level, 'native cap/access plan vertices preserved', err < 0.0001, {
      index,
      errorMeters: err,
    });
  }
  for (const [z, height] of [
    [-7.45, 2.621],
    [7.45, 2.579],
  ]) {
    const near = vertices.filter(
        (p) => Math.abs(p[0]) < 0.6 && Math.abs(p[2] - z) < 1.3 && p[1] > 45,
      ),
      actual = near.reduce((s, p) => Math.max(s, p[1]), -Infinity);
    rec(
      level,
      'north/south gold ornament top follows current operator height',
      Math.abs(actual - (45.3 + height)) < 0.0001,
      { z, expected: 45.3 + height, actual },
    );
  }
  if (level === 3) {
    const controls = [];
    for (let x = 4.05; x <= 11.95; x += 0.4)
      for (let z = 19.7; z <= 40.3; z += 0.4)
        controls.push([x, x >= 6.7 && x <= 9.9 && z >= 39.5 ? 7.7 : 7.6, z]);
    for (const flight of [
      { x: 30.5, z: 40, sign: 1, lo: 1.65, hi: 3.1 },
      { x: 32.15, z: 46, sign: -1, lo: 0.16, hi: 1.65 },
    ])
      for (let j = 0; j < 10; j++)
        for (const dx of [-0.65, 0, 0.65])
          for (const dz of [-0.28, 0, 0.28])
            controls.push([
              flight.x + dx,
              flight.lo + ((flight.hi - flight.lo) * (j + 1)) / 10,
              flight.z + flight.sign * (j + 0.5) * 0.6 + dz,
            ]);
    for (const p of controls) {
      const h = ray([p[0], p[1] + 0.015, p[2]], [p[0], p[1] - 0.015, p[2]]),
        clearance = p[1] - ground(p[0], p[2]);
      walkSamples.push({
        p,
        ground: ground(p[0], p[2]),
        clearance,
        runtimeSurfacePresent: h.length > 0,
      });
    }
  }
}
const paving = {
  samples: walkSamples.length,
  minimumClearanceMeters: Math.min(...walkSamples.map((p) => p.clearance)),
  maximumClearanceMeters: Math.max(...walkSamples.map((p) => p.clearance)),
  missingRuntimeSurfaces: walkSamples.filter((p) => !p.runtimeSurfacePresent).length,
  worst: walkSamples.filter((p) => p.clearance <= 0).slice(0, 12),
  terrainModified: false,
};
if (paving.minimumClearanceMeters <= 0 || paving.missingRuntimeSurfaces)
  failures.push({ name: 'own bridge/stair surfaces must clear held-fixed terrain', paving });
const report = {
  status: failures.length ? 'needs-repair' : 'passed',
  actualRuntimeHash: side.runtimeLods.levels[3].hash,
  lodRecipeHash: side.runtimeLods.recipeHash,
  checks,
  failures,
  meshChecks,
  planErrors,
  paving,
};
if (process.argv.includes('--write-report')) {
  fs.mkdirSync('.artifacts/qualla-batch', { recursive: true });
  fs.writeFileSync(
    '.artifacts/qualla-batch/nagoya-geometry.json',
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
console.log({
  checks: checks.length,
  failures: failures.length,
  firstFailures: failures.slice(0, 10),
  meshChecks,
  paving,
});

if (failures.length) process.exitCode = 1;
