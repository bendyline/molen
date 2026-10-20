/** Actual Float32 mesh controls: two six-column colonnades, open air, recessed glazing and unchanged native source ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { newYorkStockExchange } from '../../../../../../../packages/worldgen/scripts/structure-new-york-stock-exchange.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/dr5/new_york_stock_exchange/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:e1074fc7974916ef14b607d53de83a380f9063ea7d5f16d2e8b6a0cc08d624dc',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:f758d76e32a39859ab41db3f4de59977f2e6a39a15b92807c42ef934e8b864f2',
);
const ring = frame.geometry.outline.slice(0, -1),
  g = read('terrain-grid.json'),
  results = [],
  failures = [],
  roofSamples = [],
  limits = [1000, 4000, 16000, 64000];
function terrain(x, z) {
  const u = x - g.origin[0],
    v = z - g.origin[1],
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = g.heightsMeters;
  return (
    (h[j][i] * (1 - a) + h[j][i + 1] * a) * (1 - b) +
    (h[j + 1][i] * (1 - a) + h[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
const contacts = [];
for (let k = 0; k < ring.length; k++) {
  const a = ring[k],
    b = ring[(k + 1) % ring.length],
    n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n,
      z = a[1] + ((b[1] - a[1]) * i) / n,
      h = terrain(x, z);
    contacts.push({ edge: k, x, z, h });
    assert(h >= -1.2 && h <= 3.2, JSON.stringify(contacts.at(-1)));
  }
}
const front = [(ring[0][0] + ring[1][0]) / 2 + 3.8, ring[0][1]],
  rear = [(ring[2][0] + ring[3][0]) / 2, (ring[2][1] + ring[3][1]) / 2],
  ra = Math.PI - Math.atan2(ring[2][1] - ring[3][1], ring[2][0] - ring[3][0]),
  local = (rearSide, x, y, z) => {
    const [cx, cz] = rearSide ? rear : front,
      a = rearSide ? ra : 0,
      c = Math.cos(a),
      s = Math.sin(a);
    return [cx + c * x + s * z, y, cz - s * x + c * z];
  };
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  newYorkStockExchange(b, frame, d);
  const raw = b.finalize();
  validateAuthoredMesh(raw, `NYSE source${d}`);
  assert(raw.triangleCount <= limits[d]);
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
      `NYSE runtime${d}`,
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
    };
  for (const rearSide of [false, true]) {
    const q = (x, y, z) => local(rearSide, x, y, z);
    for (const x of [-12.7, -7.62, -2.54, 2.54, 7.62, 12.7]) {
      const hit = ray(q(x, 20, 2), q(x, 20, -1.8))[0];
      check('six distinct column shafts', !!hit && hit.distance > 2 && hit.distance < 2.3, {
        side: rearSide ? 'New Street' : 'Broad Street',
        x,
        depth: hit?.distance ?? null,
      });
    }
    for (const x of [-10.16, -5.08, 0, 5.08, 10.16]) {
      check('true exterior air between columns', ray(q(x, 20, 1.5), q(x, 20, -2.4)).length === 0, {
        side: rearSide ? 'New Street' : 'Broad Street',
        x,
      });
      const hit = ray(q(x + 0.3, 20, -2.4), q(x + 0.3, 20, -3.1))[0];
      check(
        'recessed opaque glazing behind columns',
        !!hit && hit.distance > 0.29 && hit.distance < 0.37,
        { side: rearSide ? 'New Street' : 'Broad Street', x, depth: hit?.distance ?? null },
      );
    }
    check(
      'continuous air gallery behind column shafts',
      ray(q(-14.6, 20, -2.1), q(14.6, 20, -2.1)).length === 0,
      { side: rearSide ? 'New Street' : 'Broad Street' },
    );
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 4.65,
        hit = ray(q(x + 0.2, 7.7, 0.3), q(x + 0.2, 7.7, -0.3))[0];
      check('seven upper podium arches', !!hit && hit.distance > 0.39 && hit.distance < 0.45, {
        side: rearSide ? 'New Street' : 'Broad Street',
        bay: i,
        depth: hit?.distance ?? null,
      });
    }
  }
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k],
      b = ring[(k + 1) % ring.length],
      mx = (a[0] + b[0]) / 2,
      mz = (a[1] + b[1]) / 2,
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = -(b[1] - a[1]) / len,
      nz = (b[0] - a[0]) / len,
      h = terrain(mx, mz),
      hit = ray(
        [mx + nx * 0.3, h + 0.1, mz + nz * 0.3],
        [mx - nx * 0.3, h + 0.1, mz - nz * 0.3],
      )[0];
    check('continuous native perimeter basement above source ground', !!hit, {
      edge: k,
      ground: h,
      hit: hit?.point.toArray() ?? null,
    });
  }
  for (const [x, z] of [
    [-20, -14],
    [-20, -21],
    [27, 0],
    [28, 12],
  ])
    check('excluded neighbor and north annex air', ray([x, 55, z], [x, 0, z]).length === 0, {
      x,
      z,
    });
  const samples = [];
  for (const [x, z] of [
    [-10, -12],
    [10, -12],
    [-10, 10],
    [10, 10],
    [0, -1],
    [18, 0],
    [-15, -10],
    [0, 18],
    [2, 0],
  ]) {
    const hit = ray([x, 52, z], [x, 35, z])[0];
    check('retained old-building roof envelope', !!hit, { x, z, height: hit?.point.y ?? null });
    samples.push(hit?.point.y ?? null);
  }
  roofSamples.push(samples);
  const p = local(false, 0, 33.5, 0.7);
  check(
    'pediment occupies main frontage rather than a detached street object',
    ray([p[0], p[1], p[2] + 0.5], [p[0], p[1], p[2] - 0.8]).length > 0,
  );
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
const lodDifferences = roofSamples.slice(0, 3).map((a, d) => ({
  level: results[d].level,
  sampledRoofPoints: a.length,
  maximumSampledHeightDifference: Math.max(...a.map((v, i) => Math.abs(v - roofSamples[3][i]))),
}));
assert(lodDifferences.every((r) => r.maximumSampledHeightDifference < 0.01));
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
    architecturalBasementFoot: -1.2,
    podiumTop: 11.3,
    sourceHeightsUnchanged: true,
    scope:
      'Documented two-storey podium has varying exposed basement height on sloping streets. Actual native wall/contact rays accompany independent source range; no fitted terrain pad,cutout or defaultDEM assertion.',
  },
  failures,
  scope:
    'Actual source/imported Float32 attributes, strict budgets, both six-column shafts and intercolumn/gallery air,opaque recessed glass,seven arches each side,scope exclusion,native basement ground and nine roof samples. Photos separately verify11pose-directed pediment figures/capitals. Sampled roof coincidence is not global Hausdorff error; declared LOD approximation covers sculpture/ornament.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, JSON.stringify(failures));
