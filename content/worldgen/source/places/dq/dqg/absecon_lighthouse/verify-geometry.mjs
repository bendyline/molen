/** Imported geometry proof: native tower opening, original terrain, open porch, recessed sashes and bounded stair risers. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { abseconLighthouse } from '../../../../../../../packages/worldgen/scripts/structure-absecon-lighthouse.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  runtime = new URL('content/worldgen/assets/places/dq/dqg/absecon_lighthouse/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  f = read('map-frame.json'),
  g = read('terrain-grid.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:9f8fbee3bcc2068d5d068039b3a76b2cc446d9b82580fade316175545b95b1fa',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:357372b10b7766db7dc9c097c2c6a12953380429bc518640b017d443729ad124',
);
const inside = (p, r) => {
  let b = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      q = r[j];
    if (
      a[1] > p[1] !== q[1] > p[1] &&
      p[0] < ((q[0] - a[0]) * (p[1] - a[1])) / (q[1] - a[1]) + a[0]
    )
      b = !b;
  }
  return b;
};
const groundAt = ([x, z]) => {
  x -= g.origin[0];
  z -= g.origin[1];
  const i = Math.floor(x),
    j = Math.floor(z),
    u = x - i,
    v = z - j,
    h = g.heightsMeters;
  return (
    (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
    (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v -
    g.modelDatumElevationMeters
  );
};
const coverage = [];
for (let x = -3.2; x <= 3.2; x += 0.4)
  for (let z = -3.2; z <= 3.2; z += 0.4)
    if (inside([x, z], f.geometry.outline)) coverage.push([x, z]);
const houseCoverage = [];
for (let x = -8; x < 11.3; x += 0.5)
  for (let z = 11.5; z < 28.7; z += 0.5)
    if (inside([x, z], f.geometry.parts[1].outline)) houseCoverage.push([x, z]);
const columns = [
    ...[-7.5, -4, -0.4, 3.7, 7.3, 10.9].map((x) => [x, 28.45]),
    ...[15, 18.4, 21.8, 25.2].map((z) => [11.05, z]),
    ...[23.3, 25.8].map((z) => [-7.8, z]),
  ],
  footing = Array.from({ length: 64 }, (_, i) => {
    const a = (i * Math.PI) / 32;
    return [4.2 * Math.sin(a), 4.2 * Math.cos(a)];
  });
const results = [],
  failures = [];
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  abseconLighthouse(b, undefined, d);
  const mesh = b.finalize();
  validateAuthoredMesh(mesh, `Absecon source${d}`);
  assert(mesh.triangleCount <= [1000, 4000, 16000, 64000][d]);
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
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.DoubleSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Absecon runtime${d}`,
    );
    triangles += indices.length / 3;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 8);
  const ray = (a, b) => {
    const o = new T.Vector3(...a),
      v = new T.Vector3(...b).sub(o);
    return new T.Raycaster(o, v.clone().normalize(), 0.00001, v.length() - 0.00001).intersectObject(
      gltf.scene,
    );
  };
  const controls = [],
    check = (name, pass, info = {}) => {
      controls.push({ name, pass, ...info });
      if (!pass) failures.push({ level: level.name, name, ...info });
    };
  const missing = coverage.filter(([x, z]) => ray([x, 55, z], [x, -2, z]).length === 0);
  check('every native tower ground-opening point has physical cover', !missing.length, {
    probes: coverage.length,
    missing: missing.length,
  });
  const houseMissing = houseCoverage.filter(
    ([x, z]) => ray([x, 1.01, z], [x, 0.6, z]).length === 0,
  );
  check('native keeper-house group has actual raised floor coverage', !houseMissing.length, {
    probes: houseCoverage.length,
    missing: houseMissing.length,
    first: houseMissing.slice(0, 6),
  });
  const unsupported = footing.filter(([x, z]) => {
    const y = groundAt([x, z]) + 0.06,
      r = Math.hypot(x, z);
    return ray([(x / r) * 4.5, y, (z / r) * 4.5], [(x / r) * 3.8, y, (z / r) * 3.8]).length === 0;
  });
  check('tower narrow footing contacts original unmodified terrain', !unsupported.length, {
    probes: 64,
    missing: unsupported.length,
    first: unsupported.slice(0, 6),
  });
  const expectedColumns =
    d === 0
      ? [
          [-7.5, 28.45],
          [-0.4, 28.45],
          [3.7, 28.45],
          [10.9, 28.45],
        ]
      : columns;
  for (const [x, z] of expectedColumns) {
    const y = groundAt([x, z]) + 0.04;
    check(
      'porch own column plinth meets original ground',
      ray([x - 0.5, y, z], [x + 0.5, y, z]).length > 0,
      { x, z, terrain: groundAt([x, z]) },
    );
  }
  const Y = -0.12,
    r = (y) => 4.1 - (1.9 * (y - Y)) / 44;
  const towerSashes =
    d === 0
      ? [[0, Y + 14.9]]
      : [
          [0, Y + 14.9],
          [0, Y + 37.9],
          [Math.PI, Y + 3.8],
          [Math.PI, Y + 25.7],
          [Math.PI / 2, Y + 8.3],
          [Math.PI / 2, Y + 33.7],
          [-Math.PI / 2, Y + 21.1],
          [-Math.PI / 2, Y + 41.7],
        ];
  for (const [a, y] of towerSashes)
    for (const u of [-0.12, 0.12]) {
      const n = [Math.sin(a), Math.cos(a)],
        t = [Math.cos(a), -Math.sin(a)],
        p = (depth) => [n[0] * (r(y) - depth) + t[0] * u, y, n[1] * (r(y) - depth) + t[1] * u];
      check('tower sash front air remains recessed', ray(p(-0.03), p(0.15)).length === 0, {
        a,
        y,
        u,
      });
      check('tower sash has real recessed rear glazing', ray(p(0.17), p(0.38)).length > 0, {
        a,
        y,
        u,
      });
    }
  if (d > 0) {
    for (const x of [-3.85, -2.05, 1.65, 5.45, 7.25])
      for (const u of [-0.16, 0.16]) {
        check(
          'upper front sash is physically recessed',
          ray([x + u, 5.55, 26.025], [x + u, 5.55, 25.86]).length === 0,
          { x, u },
        );
        check(
          'upper front sash has real glazing',
          ray([x + u, 5.55, 25.85], [x + u, 5.55, 25.75]).length > 0,
          { x, u },
        );
      }
    for (const x of [-2.95, 6.25])
      check(
        'lower front round light has a real recess',
        ray([x, 2.2, 26.03], [x, 2.2, 25.86]).length === 0,
        { x },
      );
    for (const y of [1.55, 2.3, 3.05])
      check(
        'porch entrance remains clear ahead of inset door',
        ray([1.65, y, 28.2], [1.65, y, 26.025]).length === 0,
        { y },
      );
    for (const y of [2.25, 2.9])
      check(
        'front porch is open along its length',
        ray([-6, y, 27.2], [10, y, 27.2]).length === 0,
        { y },
      );
    const stairHeights = [];
    for (let i = 0; i < 5; i++) {
      const z = 30.45 - i * 0.4,
        hits = ray([1.65, 2.1, z], [1.65, -0.2, z]),
        top = hits[0]?.point.y;
      stairHeights.push(top);
      check(
        'entrance tread meets the expected bounded rise',
        Number.isFinite(top) && Math.abs(top - (0.21 + i * 0.17)) < 0.015,
        { i, z, actual: top, expected: 0.21 + i * 0.17 },
      );
    }
    check('top tread meets porch finished floor', Math.abs(stairHeights[4] - 0.91) < 0.03, {
      top: stairHeights[4],
      floor: 0.91,
    });
  }
  // Front-side rays prove these surfaces face their visible exterior, not merely double-sided fallback.
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  for (const y of [10, 22, 29, 35, 40])
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.31) * Math.PI) / 6,
        n = [Math.sin(a), Math.cos(a)];
      check(
        'shaft exterior faces outward continuously',
        ray(
          [n[0] * (r(y) + 0.15), y, n[1] * (r(y) + 0.15)],
          [n[0] * (r(y) - (d === 0 ? 0.3 : 0.1)), y, n[1] * (r(y) - (d === 0 ? 0.3 : 0.1))],
        ).length > 0,
        { a, y },
      );
    }
  const ga = Math.PI / 10,
    gp = (radius) => [Math.cos(ga) * radius, 45.53, Math.sin(ga) * radius];
  check('gallery rail gap is physical air outside watchroom', ray(gp(3.3), gp(2.5)).length === 0);
  const box = new T.Box3().setFromObject(gltf.scene);
  check('operator171ft approximate tower top retained', Math.abs(box.max.y - 52.0008) < 0.01, {
    top: box.max.y,
  });
  results.push({
    level: level.name,
    hash: level.hash,
    triangles,
    drawCalls: level.drawCalls,
    coverageProbes: coverage.length,
    houseFloorProbes: houseCoverage.length,
    footingProbes: 64,
    columnGroundProbes: expectedColumns.length,
    controls,
    failed: controls.filter((c) => !c.pass).length,
  });
  gltf.scene.traverse((o) => {
    o.geometry?.dispose();
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}
const report = {
  format: 'molen/structure-geometry-proof@1',
  structure: 'absecon_lighthouse',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  terrainValuesUnchanged: true,
  footingRelativeGroundRange: footing.reduce(
    (a, p) => [Math.min(a[0], groundAt(p)), Math.max(a[1], groundAt(p))],
    [Infinity, -Infinity],
  ),
  results,
  failures,
  status: failures.length ? 'failed' : 'passed',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0);
