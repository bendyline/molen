/** Read-only actual source/runtime mesh, native map, negative-volume and fixed-ground checks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  castleClinton,
  castleClintonControls,
} from '../../../../../../../packages/worldgen/scripts/structure-castle-clinton.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

process.chdir(new URL('../../../../../../../', import.meta.url).pathname);
const req = createRequire(
    new URL('../../../../../../../packages/worldgen/package.json', import.meta.url),
  ),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  dir = 'content/worldgen/source/places/dr/dr5/castle_clinton/',
  runtime = 'content/worldgen/assets/places/dr/dr5/castle_clinton/',
  get = (p) => JSON.parse(fs.readFileSync(p)),
  f = get(`${dir}map-frame.json`),
  g = get(`${dir}terrain-grid.json`),
  side = get(`${runtime}asset.json`),
  c = castleClintonControls(f),
  checks = [],
  failures = [],
  meshChecks = [],
  planErrors = [],
  walkSamples = [];
const rec = (level, name, pass, data = {}) => {
  const q = { level, name, ...data };
  checks.push(q);
  if (!pass) failures.push(q);
};
const ground = (x, z) => {
  const a = (x - g.origin[0]) / g.stepMeters,
    b = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(a),
    j = Math.floor(b),
    u = a - i,
    v = b - j,
    h = g.heightsMeters;
  return (
    (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
    (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v -
    g.modelDatumElevationMeters
  );
};
const inside = (p, r) => {
  let value = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      value = !value;
  }
  return value;
};
const offset = (p, n, k) => p.map((v, i) => v + n[i] * k);
for (let level = 0; level < 4; level++) {
  const builder = new MeshBufferBuilder();
  castleClinton(builder, f, level);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `authored-${level}`);
  assert(mesh.triangleCount <= [1000, 4000, 16000, 64000][level]);
  meshChecks.push({ level, triangles: mesh.triangleCount, sourceFloat32Validated: true });
  const bytes = fs.readFileSync(runtime + side.runtimeLods.levels[level].file);
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
      const p = o.geometry.getAttribute('position'),
        n = o.geometry.getAttribute('normal'),
        uv = o.geometry.getAttribute('uv');
      validateAuthoredMesh(
        {
          positions: p.array,
          normals: n.array,
          uvs: uv?.array ?? new Float32Array(p.count * 2),
          indices: o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i),
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
  for (const [which, a, b] of [
    ['main', [0.7, 1.5, 8], [0.98, 1.5, 25]],
    ['rear', [-0.21, 1.5, -20], [-0.22, 1.5, -32]],
  ]) {
    const h = ray(a, b);
    rec(level, 'mapped entrance path is genuinely open through the building', h.length === 0, {
      which,
      first: h[0]?.point.toArray() ?? null,
    });
  }
  for (const [which, x, z] of [
    ['main', 0.99, 22.6],
    ['rear', -0.22, -29.8],
  ]) {
    const y = ground(x, z),
      h = ray([x, y + 0.9, z], [x, y - 0.02, z]),
      hit = h[0]?.point.y;
    rec(
      level,
      'gate has an actual above-ground walk surface',
      Number.isFinite(hit) && hit > y + 0.015,
      { which, actual: hit, ground: y },
    );
  }
  for (const [name, r, y] of [
    ['outer wall', f.geometry.outline, 6],
    ['open court roof boundary', f.geometry.holes[0], 3.55],
    ...f.features.filter((q) => q.index !== 5).map((q) => [`kiosk-${q.index}`, q.rings[0], 3]),
  ]) {
    let error = 0;
    for (const p of r)
      error = Math.max(
        error,
        vertices.reduce(
          (s, q) => Math.min(s, Math.hypot(p[0] - q[0], y - q[1], p[1] - q[2])),
          Infinity,
        ),
      );
    planErrors.push({ level, component: name, maximumNativeVertexErrorMeters: error });
    rec(level, 'original native plan coordinates preserved', error < 0.0001, {
      component: name,
      errorMeters: error,
    });
  }
  for (let i = 0; i < c.outer.length; i++) {
    if (i === 2) continue;
    const a = c.outer[i],
      b = c.outer[(i + 1) % c.outer.length],
      aa = c.inner[i],
      bb = c.inner[(i + 1) % c.inner.length],
      x = (a[0] + b[0] + aa[0] + bb[0]) / 4,
      z = (a[1] + b[1] + aa[1] + bb[1]) / 4,
      y = ground(x, z),
      h = ray([x, y - 0.12, z], [x, -2.2, z]);
    rec(
      level,
      'thick wall body embeds below unchanged independent ground',
      h.length > 0 && Math.abs(h[0].point.y + 2) < 0.0001,
      { segment: i, firstHeight: h[0]?.point.y, ground: y },
    );
  }
  for (let x = -18; x <= 18; x += 3)
    for (let z = -18; z <= 6; z += 3) {
      if (
        !inside([x, z], c.court) ||
        f.features
          .filter((q) => q.index !== 5)
          .some((q) =>
            inside(
              [x, z],
              q.rings[0].map((p) => {
                const center = [0, 1].map(
                  (k) => q.rings[0].reduce((s, p) => s + p[k], 0) / q.rings[0].length,
                );
                return p.map((v, k) => center[k] + (v - center[k]) * 1.1);
              }),
            ),
          )
      )
        continue;
      const h = ray([x, 12, z], [x, 1.2, z]);
      rec(level, 'parade court is open to the sky', h.length === 0, {
        x,
        z,
        first: h[0]?.point.toArray() ?? null,
      });
    }
  const boundaryRay = (r, a) => {
    const v = [Math.cos(a), Math.sin(a)];
    let nearest = Infinity;
    for (let i = 0; i < r.length; i++) {
      const p = r[i],
        q = r[(i + 1) % r.length],
        w = [q[0] - p[0], q[1] - p[1]],
        den = v[0] * w[1] - v[1] * w[0];
      if (Math.abs(den) < 1e-10) continue;
      const t = (p[0] * w[1] - p[1] * w[0]) / den,
        u = (p[0] * v[1] - p[1] * v[0]) / den;
      if (t > 0 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
    }
    assert(Number.isFinite(nearest));
    return v.map((v) => v * nearest);
  };
  for (let j = 0; j < 24; j++)
    for (const fraction of [0.25, 0.5, 0.75]) {
      const angle = ((j + 0.17) / 24) * Math.PI * 2,
        a = boundaryRay(f.geometry.holes[0], angle),
        b = boundaryRay(c.inner, angle),
        x = a[0] + fraction * (b[0] - a[0]),
        z = a[1] + fraction * (b[1] - a[1]),
        expected = 3.55 + fraction * 1.7,
        h = ray([x, 6.6, z], [x, 3.4, z]),
        actual = h[0]?.point.y;
      rec(
        level,
        'roof crossfall stays within the corresponding wall-to-court band',
        Number.isFinite(actual) && Math.abs(actual - expected) < (level < 2 ? 0.23 : 0.08),
        { angle, fraction, expected, actual, errorMeters: actual - expected },
      );
    }
  if (level > 0) {
    for (const s of c.ports) {
      const i = c.offsets.findIndex((v, j) => j < c.outer.length && s >= v && s < c.offsets[j + 1]),
        u = (s - c.offsets[i] + 0.15) / c.lengths[i],
        a = c.outer[i],
        b = c.outer[(i + 1) % c.outer.length],
        aa = c.inner[i],
        bb = c.inner[(i + 1) % c.inner.length],
        p = [a[0] + (b[0] - a[0]) * u, 1.42, a[1] + (b[1] - a[1]) * u],
        q = [aa[0] + (bb[0] - aa[0]) * u, 1.42, aa[1] + (bb[1] - aa[1]) * u],
        n = new T.Vector3(p[0] - q[0], 0, p[2] - q[2]).normalize().toArray(),
        h = ray(offset(p, n, 0.12), offset(q, n, -0.12));
      rec(level, 'gunport is an actual full-depth negative volume', h.length === 0, {
        s,
        first: h[0]?.point.toArray() ?? null,
      });
    }
    for (const x of [-16, -12, -8, -4, 5.6, 9.6, 13.6, 17]) {
      const p = [x + 0.18, 1.35, 12.5],
        n = [0, 0, -1],
        near = ray(offset(p, n, 0.06), offset(p, n, -0.03)),
        closed = ray(offset(p, n, 0.06), offset(p, n, -0.24));
      rec(level, 'restored-quarter window is recessed', near.length === 0, {
        x,
        first: near[0]?.point.toArray() ?? null,
      });
      rec(
        level,
        'restored-quarter window has actual glazing closure',
        closed.length > 0 && closed[0].distance > 0.2 && closed[0].distance < 0.28,
        { x, firstDistance: closed[0]?.distance },
      );
    }
  }
  if (level === 3) {
    const samples = [];
    for (let x = -28 + 0.37; x <= 28; x += 1)
      for (let z = -28 + 0.31; z <= 12.2; z += 1) {
        if (
          !inside([x, z], c.inner) ||
          f.features.filter((q) => q.index !== 5).some((q) => inside([x, z], q.rings[0]))
        )
          continue;
        samples.push([x, z]);
      }
    for (const x of [-0.1, 0.5, 1.1, 1.7, 2.1])
      for (let z = 12.5; z <= 23; z += 0.4) samples.push([x, z]);
    for (const x of [-0.8, -0.2, 0.4])
      for (let z = -29.8; z <= -21.1; z += 0.4) samples.push([x, z]);
    for (const [x, z] of samples) {
      const y = ground(x, z),
        h = ray([x, y + 0.18, z], [x, y + 0.01, z]);
      walkSamples.push({
        p: [x, z],
        ground: y,
        actual: h[0]?.point.y,
        clearance: h.length ? h[0].point.y - y : null,
        runtimeSurfacePresent: h.length > 0,
      });
    }
  }
}
const paving = {
  samples: walkSamples.length,
  minimumClearanceMeters: Math.min(
    ...walkSamples.filter((p) => p.runtimeSurfacePresent).map((p) => p.clearance),
  ),
  maximumClearanceMeters: Math.max(
    ...walkSamples.filter((p) => p.runtimeSurfacePresent).map((p) => p.clearance),
  ),
  missingRuntimeSurfaces: walkSamples.filter((p) => !p.runtimeSurfacePresent).length,
  worst: walkSamples.filter((p) => !p.runtimeSurfacePresent || p.clearance <= 0.01).slice(0, 12),
  terrainModified: false,
};
if (paving.worst.length)
  failures.push({ name: 'actual own walk surfaces must clear independent ground', paving });
const report = {
  status: failures.length ? 'needs-repair' : 'geometry-passed-review-still-required',
  actualRuntimeHash: side.runtimeLods.levels[3].hash,
  lodRecipeHash: side.runtimeLods.recipeHash,
  checks,
  failures,
  meshChecks,
  planErrors,
  paving,
};
if (process.argv.includes('--write-report'))
  fs.writeFileSync(
    '.artifacts/qualla-batch/castle-clinton-geometry.json',
    `${JSON.stringify(report, null, 2)}\n`,
  );
console.log({
  status: report.status,
  checks: checks.length,
  failures: failures.length,
  firstFailures: failures.slice(0, 10),
  meshChecks,
  paving,
});
if (failures.length) process.exitCode = 1;
