/** Read-only actual source/runtime geometry and fixed-ground verification. Run from any cwd. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { fortZeelandia } from '../../../../../../../packages/worldgen/scripts/structure-fort-zeelandia.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

process.chdir(new URL('../../../../../../../', import.meta.url).pathname);
const req = createRequire(
    new URL('../../../../../../../packages/worldgen/package.json', import.meta.url),
  ),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  dir = 'content/worldgen/source/places/ws/wsj/fort_zeelandia/',
  rt = 'content/worldgen/assets/places/ws/wsj/fort_zeelandia/',
  get = (p) => JSON.parse(fs.readFileSync(p)),
  side = get(`${rt}asset.json`),
  f = get(`${dir}map-frame.json`),
  g = get(`${dir}terrain-grid.json`),
  layout = get(`${dir}surviving-wall-layout.json`),
  checks = [],
  failures = [],
  meshChecks = [],
  planErrors = [],
  walkSamples = [],
  wallSamples = [];
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
  fortZeelandia(builder, f, level);
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

  const dirs = [
    ['south', [1, 6.5, 12], [1, 6.5, 8]],
    ['west', [-12, 6.5, 1.1], [-9.5, 6.5, 1.1]],
  ];
  for (const [direction, a, b] of dirs) {
    const h = ray(a, b);
    rec(level, 'actual open hall arcade', h.length === 0, {
      direction,
      first: h[0]?.point.toArray() ?? null,
    });
  }
  const coreWest = ray([-9.2, 5.3, 0], [-8.5, 5.3, 0]);
  rec(level, 'hall core west wall is enclosed behind the open veranda', coreWest.length > 0, {
    first: coreWest[0]?.point.toArray() ?? null,
  });
  for (const [a, b] of [
    [
      [-9.7, -5],
      [4.4, -4.5],
    ],
    [
      [9.35, -1.8],
      [8.85, 10.05],
    ],
    [
      [8.85, 10.05],
      [-10.75, 9.1],
    ],
    [
      [-10.75, 9.1],
      [-9.7, -5],
    ],
  ]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = level === 0 ? 1 : Math.max(1, Math.round(len / 3.4)),
      u = 0.5 / count,
      p = [a[0] + (b[0] - a[0]) * u, 8.4, a[1] + (b[1] - a[1]) * u],
      n = [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len],
      infill = ray(offset(p, n, 0.06), offset(p, n, -0.03));
    rec(level, 'arcade spandrel closes the gap below the roof', infill.length > 0, {
      side: a,
      first: infill[0]?.point.toArray() ?? null,
    });
  }
  const cx = f.towerControl.center[0],
    cz = f.towerControl.center[1],
    ct = Math.cos(-f.heading),
    st = Math.sin(-f.heading),
    world = (p) => [cx + ct * p[0] + st * p[2], p[1], cz - st * p[0] + ct * p[2]],
    rotate = (p, a) => [
      Math.cos(a) * p[0] + Math.sin(a) * p[2],
      p[1],
      -Math.sin(a) * p[0] + Math.cos(a) * p[2],
    ];
  for (let sideIndex = 0; sideIndex < 4; sideIndex++) {
    const y = 14.8,
      h = 3 + ((y - 13.2) / 3) * 0.5,
      p = world(rotate([0.2 * h, y, h], (sideIndex * Math.PI) / 2)),
      nn = rotate([0, -1 / 6, 1], (sideIndex * Math.PI) / 2),
      n = [ct * nn[0] + st * nn[2], nn[1], -st * nn[0] + ct * nn[2]],
      near = ray(offset(p, n, 0.12), offset(p, n, -0.02)),
      closed = ray(offset(p, n, 0.12), offset(p, n, -0.25));
    rec(level, 'splayed cabin glazing is actually recessed', near.length === 0, {
      side: sideIndex,
      first: near[0]?.point.toArray() ?? null,
    });
    rec(
      level,
      'splayed cabin glazing has real closure',
      closed.length > 0 && closed[0].distance > 0.2 && closed[0].distance < 0.32,
      { side: sideIndex, firstDistance: closed[0]?.distance },
    );
  }
  for (const [name, r, height] of [
    ['platform', f.geometry.outline, 4.8],
    ['hall plinth', f.features.find((t) => t.index === 0).rings[0], 5.05],
  ]) {
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
    rec(level, 'native cap coordinates preserved', error < 0.0001, {
      component: name,
      errorMeters: error,
    });
  }
  const runs = [
    ['south', layout.south, true],
    ['north', layout.north, false],
    ['southwest-west', layout.southwestBastion.slice(0, 2), false],
    ['southwest-south', layout.southwestBastion.slice(1), false],
  ];
  for (const [name, run, south] of runs) {
    const first = run[0],
      last = run.at(-1),
      length = Math.hypot(last[0] - first[0], last[1] - first[1]),
      angle = Math.atan2(-(last[1] - first[1]), last[0] - first[0]),
      c = Math.cos(angle),
      s = Math.sin(angle),
      localWorld = (p) => [first[0] + c * p[0] + s * p[2], p[1], first[1] - s * p[0] + c * p[2]],
      all = run.map((p) => [Math.hypot(p[0] - first[0], p[1] - first[1]), p[2]]),
      profile =
        level === 0
          ? [all[0], all[Math.floor(all.length / 2)], all.at(-1)].filter(
              (p, i, a) => i === 0 || p[0] - a[i - 1][0] > 0.01,
            )
          : all,
      height = (x) => {
        for (let i = 1; i < profile.length; i++)
          if (x <= profile[i][0]) {
            const a = profile[i - 1],
              b = profile[i];
            return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
          }
        return profile.at(-1)[1];
      };
    if (south) {
      const x = length * layout.southDoor.fraction,
        a = localWorld([x, 0.95, 1.8]),
        b = localWorld([x, 0.95, -1.8]),
        gate = ray(a, b),
        threshold = ray(localWorld([x, 0.3, 0]), localWorld([x, -0.1, 0]));
      rec(level, 'southern wall gate is a full-depth negative volume', gate.length === 0, {
        first: gate[0]?.point.toArray() ?? null,
      });
      rec(
        level,
        'southern gate has its own above-ground threshold',
        threshold.length > 0 &&
          Math.abs(threshold[0].point.y - layout.southDoor.baseY) < 0.0001 &&
          layout.southDoor.baseY > ground(a[0], a[2]),
        { height: threshold[0]?.point.y },
      );
    }
    if (level > 0 && (south || name === 'north')) {
      const count = south ? (level === 1 ? 2 : level === 2 ? 7 : 11) : level === 1 ? 2 : 5,
        x = (length * 0.6) / (count + 0.4),
        y = south ? 2.475 : 0.825,
        p = [x, y, (south ? 0.82 : 0.52) - 0.035 * y],
        n = [0, 0.035, 1],
        near = ray(localWorld(offset(p, n, 0.15)), localWorld(offset(p, n, -0.02))),
        closed = ray(localWorld(offset(p, n, 0.15)), localWorld(offset(p, n, -0.36)));
      rec(level, 'historic wall pocket is a real recess', near.length === 0, {
        run: name,
        first: near[0]?.point.toArray() ?? null,
      });
      rec(
        level,
        'historic wall pocket is blind with brick closure',
        closed.length > 0 && closed[0].distance > 0.39 && closed[0].distance < 0.44,
        { run: name, firstDistance: closed[0]?.distance },
      );
    }
    for (const fraction of [0.12, 0.43, 0.71]) {
      const x = length * fraction,
        p = localWorld([x, 0, 0]),
        h = height(x),
        terrain = ground(p[0], p[2]),
        cap = ray([p[0], h + 0.5, p[2]], [p[0], h - 0.3, p[2]]),
        base = ray([p[0], terrain - 0.05, p[2]], [p[0], -3.2, p[2]]),
        capHeight = cap[0]?.point.y,
        baseHeight = base[0]?.point.y;
      rec(
        level,
        'ragged historic wall cap exists above independent ground',
        Number.isFinite(capHeight) && Math.abs(capHeight - h) < 0.25 && capHeight > terrain,
        { run: name, fraction, expected: h, actual: capHeight, ground: terrain },
      );
      rec(
        level,
        'historic wall body embeds below held-fixed ground',
        Number.isFinite(baseHeight) && Math.abs(baseHeight + 3) < 0.0001,
        { run: name, fraction, base: baseHeight, ground: terrain },
      );
      wallSamples.push({
        level,
        run: name,
        fraction,
        capHeight,
        ground: terrain,
        capClearanceMeters: capHeight - terrain,
        baseHeight,
      });
    }
  }
  if (level === 3) {
    const controls = [];
    for (let j = 0; j < 19; j++)
      for (const dx of [-2.2, 0, 2.2])
        for (const dz of [-0.1, 0, 0.1])
          controls.push([
            -0.2 + dx,
            1.65 + (3.15 * (j + 1)) / 19,
            22.3 + ((19 - j - 0.5) * 7) / 19 + dz,
          ]);
    for (let j = 0; j < 27; j++)
      for (const dz of [-3.2, 0, 3.2])
        for (const dx of [-0.1, 0, 0.1])
          controls.push([-22 - ((27 - j - 0.5) * 10) / 27 + dx, 0.3 + (4.5 * (j + 1)) / 27, dz]);
    for (let x = -9.2; x <= 7.6; x += 0.4)
      for (let z = 8.3; z <= 9.0; z += 0.3) controls.push([x, 5.05, z]);
    for (let z = -3.5; z <= 8.4; z += 0.4) controls.push([-9.7, 5.05, z]);
    for (const p of controls) {
      const h = ray([p[0], p[1] + 0.012, p[2]], [p[0], p[1] - 0.012, p[2]]);
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
  worst: walkSamples.filter((p) => p.clearance <= 0 || !p.runtimeSurfacePresent).slice(0, 12),
  terrainModified: false,
};
if (paving.minimumClearanceMeters <= 0 || paving.missingRuntimeSurfaces)
  failures.push({ name: 'own walk surfaces must clear held-fixed ground', paving });
const scopeComplete =
  layout.state === 'reviewed-current-wall-layout' &&
  layout.south.length > 1 &&
  layout.north.length > 1 &&
  layout.southwestBastion.length > 1;
const report = {
  status: failures.length
    ? 'needs-repair'
    : scopeComplete
      ? 'geometry-passed-review-still-required'
      : 'partial-geometry-passed-scope-incomplete',
  scopeComplete,
  actualRuntimeHash: side.runtimeLods.levels[3].hash,
  lodRecipeHash: side.runtimeLods.recipeHash,
  checks,
  failures,
  meshChecks,
  planErrors,
  paving,
  wallSamples,
};
if (process.argv.includes('--write-report')) {
  fs.mkdirSync('.artifacts/qualla-batch', { recursive: true });
  fs.writeFileSync(
    '.artifacts/qualla-batch/fort-zeelandia-geometry.json',
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
console.log({
  status: report.status,
  scopeComplete,
  checks: checks.length,
  failures: failures.length,
  firstFailures: failures.slice(0, 8),
  meshChecks,
  paving,
});
if (failures.length) process.exitCode = 1;
