/** Independent native-plan controls and actual Float32 imported LOD geometry, including unchanged source ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { bradburyBuilding } from '../../../../../../../packages/worldgen/scripts/structure-bradbury-building.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q5/bradbury_building/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:151100a3b78f687916a5bd567951e28f1a61736f472c80837363c4f59b408e61',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:4800f4504db05312696d3f7b2e63dd48a2b2c75cac409ed43f1e65604f71c964',
);
const ring = frame.geometry.outline.slice(0, -1),
  ground = read('terrain-grid.json'),
  results = [],
  failures = [],
  roofs = [],
  limits = [1000, 4000, 16000, 64000];
function terrain(x, z) {
  const u = x - ground.origin[0],
    v = z - ground.origin[1],
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = ground.heightsMeters;
  return (
    (h[j][i] * (1 - a) + h[j][i + 1] * a) * (1 - b) +
    (h[j + 1][i] * (1 - a) + h[j + 1][i + 1] * a) * b -
    ground.modelDatumElevationMeters
  );
}
const contacts = [];
for (let k = 0; k < ring.length; k++) {
  const a = ring[k],
    b = ring[(k + 1) % ring.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.ceil(len / 0.5);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n,
      z = a[1] + ((b[1] - a[1]) * i) / n,
      h = terrain(x, z);
    contacts.push({ edge: k, x, z, h });
    assert(h >= -0.65 && h <= 0.45, JSON.stringify(contacts.at(-1)));
  }
}
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  bradburyBuilding(b, frame, d);
  const source = b.finalize();
  validateAuthoredMesh(source, `Bradbury source${d}`);
  assert(source.triangleCount <= limits[d]);
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
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Bradbury runtime${d}`,
    );
    triangles += idx.length / 3;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 8);
  const controls = [],
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      if (!pass) failures.push({ level: level.name, name, ...data });
    },
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(gltf.scene);
    },
    edgePoint = (index, x, y, z) => {
      const a = ring[index],
        b = ring[(index + 1) % ring.length],
        w = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dx = (b[0] - a[0]) / w,
        dz = (b[1] - a[1]) / w;
      return [(a[0] + b[0]) / 2 - dx * x + dz * z, y, (a[1] + b[1]) / 2 - dz * x - dx * z];
    };
  for (let k = 0; k < ring.length; k++) {
    const q = (x, y, z) => edgePoint(k, x, y, z),
      hits = ray(q(0, 12, 1), q(0, 12, -0.3));
    check('native wall position', hits.length > 0 && hits[0].distance < 1.25, {
      edge: k,
      hit: hits[0]?.point.toArray() ?? null,
    });
    const base = ray(q(0, -0.3, 0.2), q(0, -0.3, -0.2));
    check('continuous native wall foot', base.length > 0, { edge: k });
    const roof = ray(q(0, 29, -0.1), q(0, 24, -0.1));
    check(
      'native perimeter roof',
      roof.length > 0 && roof[0].point.y >= 25.24 && roof[0].point.y <= 25.81,
      { edge: k, y: roof[0]?.point.y ?? null },
    );
  }
  for (const p of [
    [-22, 8],
    [-21, -20],
    [-7, 26],
  ])
    check(
      'native concave recess remains empty',
      ray([p[0], 30, p[1]], [p[0], -0.5, p[1]]).length === 0,
      { x: p[0], z: p[1] },
    );
  // Counts observed independently in the selected two whole exterior photographs.
  for (const [k, counts, topCount] of [
    [9, [3, 2, 2, 2, 3, 2], 14],
    [11, [1, 1, 1, 2, 2, 2, 2, 2, 2, 1], 21],
    [10, [1], 1],
  ]) {
    const a = ring[k],
      b = ring[(k + 1) % ring.length],
      w = Math.hypot(b[0] - a[0], b[1] - a[1]),
      q = (x, y, z) => edgePoint(k, x, y, z),
      xs = counts.flatMap((n, i) =>
        Array.from(
          { length: n },
          (_, j) =>
            -w / 2 + ((i + 0.5) * w) / counts.length + (j - (n - 1) / 2) * (n === 3 ? 1.45 : 1.85),
        ),
      );
    for (const [bay, x] of xs.entries())
      for (let f = 0; f < 3; f++) {
        const hit = ray(q(x + 0.18, 6.8 + f * 4.5, 0.3), q(x + 0.18, 6.8 + f * 4.5, -0.1))[0];
        check(
          'photographic middle-window count and recess',
          !!hit && Math.abs(hit.distance - 0.275) < 0.005,
          { edge: k, bay, floor: f + 2, depth: hit?.distance ?? null },
        );
      }
    const topXs =
      k === 11
        ? Array.from({ length: topCount }, (_, i) => -w / 2 + 2 + (i * (w - 4)) / (topCount - 1))
        : xs;
    assert.equal(topXs.length, topCount);
    for (const [bay, x] of topXs.entries()) {
      const hit = ray(q(x + 0.18, 22.4, 0.3), q(x + 0.18, 22.4, -0.1))[0];
      check(
        'photographic upper-arched-window count',
        !!hit && Math.abs(hit.distance - 0.275) < 0.005,
        { edge: k, bay, depth: hit?.distance ?? null },
      );
    }
  }
  const portal = ray(
    edgePoint(
      9,
      -Math.hypot(ring[10][0] - ring[9][0], ring[10][1] - ring[9][1]) / 12 + 0.4,
      1.7,
      0.5,
    ),
    edgePoint(
      9,
      -Math.hypot(ring[10][0] - ring[9][0], ring[10][1] - ring[9][1]) / 12 + 0.4,
      1.7,
      -0.1,
    ),
  );
  check(
    'Broadway door glass recessed within portal',
    portal.length > 0 && Math.abs(portal[0].distance - 0.36) < 0.005,
    { depth: portal[0]?.distance ?? null },
  );
  if (d >= 2) {
    const a = ring[11],
      b = ring[12],
      w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const sign of [-1, 1])
      for (let f = 1; f <= 4; f++) {
        const x = sign * w * 0.22 - 1.2,
          y = 5.45 + (f - 1) * 4.5 + 0.6;
        check(
          'open fire-escape rail gaps',
          ray(edgePoint(11, x, y, 1.7), edgePoint(11, x, y, 1.48)).length === 0,
          { side: sign, floor: f + 1 },
        );
      }
  }
  const samples = [];
  for (const [x, z] of [
    [-0.5, -10],
    [-0.5, 0],
    [-0.5, 10],
    [-4, 0],
    [3, 0],
    [10, -15],
    [-12, -15],
    [12, 18],
    [-20, 20],
  ]) {
    const hit = ray([x, 32, z], [x, 24, z])[0];
    check('roof envelope present', !!hit, { x, z, y: hit?.point.y ?? null });
    samples.push(hit?.point.y ?? null);
  }
  roofs.push(samples);
  results.push({
    level: level.name,
    hash: level.hash,
    triangles,
    drawCalls: level.drawCalls,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass).length,
    controlResults: controls,
  });
}
const lodDifferences = roofs.slice(0, 3).map((r, d) => ({
  level: results[d].level,
  sampledRoofPoints: r.length,
  maximumSampledHeightDifference: Math.max(...r.map((h, i) => Math.abs(h - roofs[3][i]))),
}));
assert(lodDifferences.every((d) => d.maximumSampledHeightDifference < 0.06));
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  lodDifferences,
  terrainContact: {
    probes: contacts.length,
    relativeGroundRange: [
      Math.min(...contacts.map((c) => c.h)),
      Math.max(...contacts.map((c) => c.h)),
    ],
    architecturalWallBase: -0.65,
    raisedThreshold: 0.45,
    sourceGroundUnchanged: true,
  },
  failures,
  scope:
    'Actual Float32 source/imported attributes and bounded independent native-plan/window/concavity/roof/fire-escape/ground controls. Nine sampled roof heights are not global Hausdorff error; omitted ornament and railing detail remain declared LOD approximation.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, JSON.stringify(failures));
