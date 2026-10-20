/** Read-only actual source/runtime geometry and fixed-ground verification. Run from any cwd. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { matsumotoCastle } from '../../../../../../../packages/worldgen/scripts/structure-matsumoto-castle.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

process.chdir(new URL('../../../../../../../', import.meta.url).pathname);
const req = createRequire(
    new URL('../../../../../../../packages/worldgen/package.json', import.meta.url),
  ),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  dir = 'content/worldgen/source/places/xn/xn6/matsumoto_castle/',
  rt = 'content/worldgen/assets/places/xn/xn6/matsumoto_castle/',
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
  const builder = new MeshBufferBuilder();
  matsumotoCastle(builder, f, level);
  const m = builder.finalize();
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

  // Bound the whole actual mesh as well as individual recesses; catches stray trim/beam extensions.
  const extent = {
    min: [0, 1, 2].map((i) => vertices.reduce((s, p) => Math.min(s, p[i]), Infinity)),
    max: [0, 1, 2].map((i) => vertices.reduce((s, p) => Math.max(s, p[i]), -Infinity)),
  };
  rec(
    level,
    'all mesh vertices remain within the castle envelope',
    extent.min[0] > -13 &&
      extent.max[0] < 24.5 &&
      extent.min[2] > -27 &&
      extent.max[2] < 17 &&
      extent.min[1] >= -5.0001 &&
      extent.max[1] < 29.401,
    { extent },
  );
  // All three Moon elevations are actual negative volumes, with retained floor, ceiling and west wall.
  for (const y of [5.3, 6.4])
    for (const [name, a, b] of [
      ['north', [18, y, 5], [18, y, 8]],
      ['east', [23, y, 9.2], [19, y, 9.2]],
      ['south', [18, y, 15], [18, y, 11]],
    ]) {
      const hits = ray(a, b);
      rec(level, 'Moon north/east/south remain open', hits.length === 0, {
        direction: name,
        y,
        first: hits[0]?.point.toArray() ?? null,
      });
    }
  for (const [name, a, b, expected] of [
    ['own Moon floor', [18, 6.4, 9.2], [18, 4.4, 9.2], 4.7],
    ['own Moon ceiling', [18, 6.4, 9.2], [18, 8.6, 9.2], 8.18],
  ]) {
    const h = ray(a, b);
    rec(level, name, h.length > 0 && Math.abs(h[0].point.y - expected) < 0.0001, {
      expected,
      actual: h[0]?.point.y ?? null,
    });
  }
  const west = ray([16, 6.4, 9.65], [12, 6.4, 9.65]);
  rec(
    level,
    'Moon west side backs onto the connected wing',
    west.length > 0 && Math.abs(west[0].point.x - 13.92) < 0.001,
    { first: west[0]?.point.toArray() ?? null },
  );
  // Use the original native outline at a portal's middle height, before its 1.4m inset closure.
  const r = f.nativeComponents.watari,
    a = r[1],
    b = r[2],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = (-12 - a[1]) / (b[1] - a[1]),
    n = [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len],
    y = 2.45;
  const spread = level === 0 ? (2.7 * (3.9 - y)) / 8.9 : (0.55 * (3.9 - y)) / 2.4;
  const low = r.reduce((s, p) => s.map((v, i) => Math.min(v, p[i])), [Infinity, Infinity]),
    high = r.reduce((s, p) => s.map((v, i) => Math.max(v, p[i])), [-Infinity, -Infinity]);
  const ex = (p) =>
    p.map(
      (v, i) =>
        (low[i] + high[i]) / 2 +
        (v - (low[i] + high[i]) / 2) * (1 + (2 * spread) / (high[i] - low[i])),
    );
  const aa = ex(a),
    bb = ex(b),
    p = [aa[0] + u * (bb[0] - aa[0]), y, aa[1] + u * (bb[1] - aa[1])],
    gate = ray(offset(p, n, 1.0), offset(p, n, -1.8));
  const depth = gate[0]
    ? gate[0].point.toArray().reduce((s, v, i) => s + (v - p[i]) * n[i], 0)
    : null;
  rec(
    level,
    'Watari stone entrance is recessed with a real closure',
    depth !== null && Math.abs(depth + 1.4) < 0.025,
    { actualDepth: depth, first: gate[0]?.point.toArray() ?? null },
  );
  // A ray from below can enter a stone-drop shutter's undercut before hitting its canted face.
  const under = ray([-10.17, 4.02, 3], [-10.17, 4.65, 3]),
    flap = ray([-10.17, 4.02, 3], [-10.17, 5.3, 3]);
  rec(level, 'stone-drop shutter has an open underside', under.length === 0 && flap.length > 0, {
    first: flap[0]?.point.toArray() ?? null,
  });
  if (level > 0) {
    for (const [side, p, n] of [
      [0, [0.13, 24.65, -3.2], [0, 0, -1]],
      [1, [3.6, 24.65, 0.13], [1, 0, 0]],
      [2, [0.13, 24.65, 3.2], [0, 0, 1]],
      [3, [-3.6, 24.65, 0.13], [-1, 0, 0]],
    ]) {
      const near = ray(offset(p, n, 0.16), offset(p, n, -0.04)),
        closed = ray(offset(p, n, 0.16), offset(p, n, -0.4)),
        outside = ray(offset(p, n, 4), offset(p, n, 0.17));
      rec(level, 'highest enclosed main-floor window is genuinely recessed', near.length === 0, {
        side,
        first: near[0]?.point.toArray() ?? null,
      });
      rec(
        level,
        'highest main-floor window has inset closure',
        closed.length > 0 && closed[0].distance > 0.3 && closed[0].distance < 0.45,
        { side, firstDistance: closed[0]?.distance },
      );
      rec(
        level,
        'highest main-floor window remains visible above lower roof',
        outside.length === 0,
        { side, first: outside[0]?.point.toArray() ?? null },
      );
    }
    for (const [name, p, n] of [
      ['Inui north', [-3.15, 12.7, -22.1], [0, 0, -1]],
      ['Inui west', [-5.95, 12.7, -19.3], [-1, 0, 0]],
      ['Tatsumi north', [10.6, 9.3, 3.9], [0, 0, -1]],
      ['Tatsumi south', [10.6, 9.3, 11.1], [0, 0, 1]],
    ]) {
      const near = ray(offset(p, n, 0.16), offset(p, n, -0.04)),
        closed = ray(offset(p, n, 0.16), offset(p, n, -0.4));
      rec(level, 'smaller-tower window has actual recess', near.length === 0, {
        component: name,
        first: near[0]?.point.toArray() ?? null,
      });
      rec(
        level,
        'smaller-tower window has inset glazing',
        closed.length > 0 && closed[0].distance > 0.3 && closed[0].distance < 0.45,
        { component: name, firstDistance: closed[0]?.distance },
      );
    }
    if (level > 1)
      for (const p of [
        [-2.75, 13.275, -22.1],
        [-5.95, 13.275, -18.9],
      ]) {
        const n = p[2] === -22.1 ? [0, 0, -1] : [-1, 0, 0],
          h = ray(offset(p, n, 0.16), offset(p, n, -0.04));
        rec(level, 'Inui cusp head keeps solid upper corners', h.length > 0, { p });
      }
  }
  for (const [name, r] of Object.entries(f.nativeComponents)) {
    const height = name === 'tsukimi' ? 2.5 : 3.9;
    let error = 0;
    for (const p of r)
      error = Math.max(
        error,
        vertices.reduce(
          (s, q) => Math.min(s, Math.hypot(p[0] - q[0], height - q[1], p[1] - q[2])),
          Infinity,
        ),
      );
    planErrors.push({ level, component: name, maximumNativeCapVertexErrorMeters: error });
    rec(level, 'native component cap coordinates preserved', error < 0.0001, {
      component: name,
      errorMeters: error,
    });
  }
  for (const [name, predicate, expected] of [
    ['main', (p) => Math.abs(p[0]) < 0.8 && p[2] > 2.3 && p[2] < 4, 29.4],
    ['Inui', (p) => p[0] > -7 && p[0] < -4.5 && p[2] > -20 && p[2] < -18.5, 16.8],
    ['Watari', (p) => p[0] > -3.5 && p[0] < -3 && p[2] > -14 && p[2] < -11, 12],
    ['Tatsumi', (p) => p[0] > 9.8 && p[0] < 11.2 && p[2] > 7 && p[2] < 8, 14.7],
    ['Moon', (p) => p[0] > 17 && p[0] < 18 && p[2] > 9 && p[2] < 11.5, 11.1],
  ]) {
    let actual = vertices.filter(predicate).reduce((s, p) => Math.max(s, p[1]), -Infinity);
    const testPoint = { Watari: [-3.25, -12], Tatsumi: [10.5, 7.5], Moon: [17.5, 9.65] }[name];
    if (testPoint) {
      const h = ray(
        [testPoint[0], expected + 0.1, testPoint[1]],
        [testPoint[0], expected - 0.1, testPoint[1]],
      );
      actual = h[0]?.point.y ?? null;
    }
    rec(
      level,
      'approximate guide silhouette height retained',
      actual !== null && Math.abs(actual - expected) < 0.06,
      { component: name, expected, actual },
    );
  }
  if (level === 3) {
    const controls = [];
    for (let x = 0.8; x < 3.5; x += 0.15)
      for (let z = -13.1; z < -10.9; z += 0.15) controls.push([x, 1.15, z]);
    for (let j = 0; j < 4; j++)
      for (const dx of [-0.16, 0, 0.16])
        for (let z = -12.9; z < -11.0; z += 0.15)
          controls.push([3.725 + j * 0.45 + dx, 1 - 0.15 * j, z]);
    for (let x = 13.3; x < 21.75; x += 0.3)
      for (let z = 6.25; z < 13.05; z += 0.3) controls.push([x, 4.7, z]);
    for (const p of controls) {
      const h = ray([p[0], p[1] + 0.015, p[2]], [p[0], p[1] - 0.015, p[2]]);
      walkSamples.push({
        p,
        ground: ground(p[0], p[2]),
        clearance: p[1] - ground(p[0], p[2]),
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
  failures.push({ name: 'own entrance/Moon floor surfaces must clear held-fixed terrain', paving });
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
    '.artifacts/qualla-batch/matsumoto-geometry.json',
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
