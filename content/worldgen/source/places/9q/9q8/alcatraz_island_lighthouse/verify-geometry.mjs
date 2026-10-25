/** Actual source/runtime checks for own footing, unchanged terrain, recessed sashes and open rails. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { alcatrazIslandLighthouse } from '../../../../../../../packages/worldgen/scripts/structure-alcatraz-island-lighthouse.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  runtime = new URL('content/worldgen/assets/places/9q/9q8/alcatraz_island_lighthouse/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  ground = read('terrain-grid.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:04ab74665c58f5f7bbc5f35dddd044d5a8d31ca3511be98c86c55438c06a5899',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:c072c940e0d070b1aa8cfe99a6d81de85d2e0bb90811cad7883944accf6a3a24',
);
assert.equal(frame.geometry.nativeOutline.length, 9);
assert.equal(frame.geometry.outline.length, 5);
const groundAt = ([x, z]) => {
  x -= ground.origin[0];
  z -= ground.origin[1];
  const i = Math.floor(x),
    j = Math.floor(z),
    u = x - i,
    v = z - j,
    h = ground.heightsMeters;
  return (
    (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
    (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v -
    ground.modelDatumElevationMeters
  );
};
const coverage = [];
for (let x = -2.1; x < 2.2; x += 0.25) for (let z = -2.1; z < 2.2; z += 0.25) coverage.push([x, z]);
const perimeter = [];
for (let i = 0; i < 4; i++) {
  const a = frame.geometry.outline[i],
    b = frame.geometry.outline[i + 1],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  for (let j = 0; j < 18; j++) {
    const t = (j + 0.5) / 18,
      p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    perimeter.push({ p, n, y: groundAt(p) + 0.12 });
  }
}
const result = [],
  failures = [];
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  alcatrazIslandLighthouse(builder, undefined, d);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `Lighthouse source${d}`);
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
      `Lighthouse runtime${d}`,
    );
    triangles += indices.length / 3;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 8);
  const ray = (a, b) => {
    const p = new T.Vector3(...a),
      v = new T.Vector3(...b).sub(p);
    return new T.Raycaster(p, v.clone().normalize(), 0.00001, v.length() - 0.00001).intersectObject(
      gltf.scene,
    );
  };
  const controls = [],
    check = (name, pass, details = {}) => {
      controls.push({ name, pass, ...details });
      if (!pass) failures.push({ level: level.name, name, ...details });
    };
  const missing = coverage.filter(([x, z]) => ray([x, 35, z], [x, -2, z]).length === 0);
  check('own clipped footprint has physical model coverage', !missing.length, {
    probes: coverage.length,
    missing: missing.length,
  });
  const unsupported = perimeter.filter(
    ({ p, n, y }) =>
      ray([p[0] + n[0] * 0.5, y, p[1] + n[1] * 0.5], [p[0] - n[0] * 0.5, y, p[1] - n[1] * 0.5])
        .length === 0,
  );
  check('narrow footing meets unmodified independent terrain', !unsupported.length, {
    probes: perimeter.length,
    missing: unsupported.length,
    first: unsupported.slice(0, 4),
  });
  const Y = 0.55,
    r = (y) => 1.91 - ((y - 7.15) * 0.4) / 15.4;
  // Independent photo controls: selected base sash, shaft lights, four upper watchroom sashes.
  for (const [angle, y, a] of [
    [Math.PI / 2, Y + 4.1, 2.0955],
    [Math.PI / 2, Y + 5.9, 2.0955],
    [-Math.PI / 2, Y + 4.2, 2.0955],
    [Math.PI, Y + 1.6, 2.0955],
    [0, Y + 1.5, 2.0955],
    [0, Y + 18.3, r(Y + 18.3)],
    [Math.PI / 2, Y + 16.1, r(Y + 16.1)],
    [Math.PI, Y + 10.3, r(Y + 10.3)],
    [-Math.PI / 2, Y + 12.95, r(Y + 12.95)],
    ...[0, 1, 2, 3].map((i) => [(i * Math.PI) / 2, Y + 23.2, 1.62]),
  ]) {
    const n = [Math.sin(angle), Math.cos(angle)],
      t = [Math.cos(angle), -Math.sin(angle)];
    for (const u of [-0.12, 0.12]) {
      const p = (dep) => [n[0] * (a + dep) + t[0] * u, y, n[1] * (a + dep) + t[1] * u];
      check('sash/door front recess is physically clear', ray(p(0.02), p(-0.18)).length === 0, {
        angle,
        y,
        u,
      });
      check('sash/door has real inset rear surface', ray(p(-0.205), p(-0.31)).length > 0, {
        angle,
        y,
        u,
      });
    }
  }
  const railPoint = (x, y, z) => [x, y, z];
  // Mid-facet air between the three actual gallery bars, outside cylindrical lantern.
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const radius = 1.95 * Math.cos(Math.PI / 8),
      n = [Math.sin(a), Math.cos(a)];
    const p = (rad) => railPoint(n[0] * rad, 25.05 + 0.12 + 0.3, n[1] * rad);
    check(
      'gallery lower rail gap remains open',
      ray(p(radius + 0.12), p(radius - 0.12)).length === 0,
      { angle: a },
    );
  }
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  const cornerFailures = [];
  for (let i = 0; i < 8; i++)
    for (const offset of [-0.006, 0.006])
      for (let y = 7.5; y < 22.4; y += 0.25) {
        const a = Math.PI / 8 + (i * Math.PI) / 4 + offset;
        const p = (radius) => [Math.sin(a) * radius, y, Math.cos(a) * radius];
        if (!ray(p(2.3), p(1.2)).length) cornerFailures.push({ angle: a, y });
      }
  check(
    'shaft facet corner strips have outward facing continuous coverage',
    cornerFailures.length === 0,
    { probes: 960, missing: cornerFailures.length, first: cornerFailures.slice(0, 8) },
  );
  if (d > 0)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        n = [Math.sin(a), Math.cos(a)],
        t = [Math.cos(a), -Math.sin(a)];
      const point = (u, y, depth) => [
        n[0] * (r(y) + depth) + t[0] * u,
        y,
        n[1] * (r(y) + depth) + t[1] * u,
      ];
      const y = 20,
        half = r(y) * Math.tan(Math.PI / 8) - 0.135;
      for (const sign of [-1, 1])
        check(
          'shaft panel side reveal faces into recess',
          ray(point(sign * (half - 0.025), y, -0.018), point(sign * (half + 0.025), y, -0.018))
            .length > 0,
          { facet: i, sign },
        );
      for (const [edge, sign] of [
        [7.51, 1],
        [22.33, -1],
      ])
        check(
          'shaft panel end reveal faces into recess',
          ray(point(0, edge + sign * 0.025, -0.018), point(0, edge - sign * 0.025, -0.018)).length >
            0,
          { facet: i, edge },
        );
    }
  const box = new T.Box3().setFromObject(gltf.scene);
  check('approximate current beacon top retained', Math.abs(box.max.y - 28.03915) < 0.01, {
    topY: box.max.y,
  });
  result.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
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
const report = {
  format: 'molen/structure-geometry-proof@1',
  structure: 'alcatraz_island_lighthouse',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  terrainValuesUnchanged: true,
  groundRangeAtFooting: perimeter.reduce(
    (a, p) => [Math.min(a[0], p.y - 0.12), Math.max(a[1], p.y - 0.12)],
    [Infinity, -Infinity],
  ),
  results: result,
  failures,
  status: failures.length ? 'failed' : 'passed',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0);
