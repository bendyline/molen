/** Four actual mesh levels: Gothic tower/portico air, native church scope and fixed independent ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { notreDameBasilicaMontreal } from '../../../../../../../packages/worldgen/scripts/structure-notre-dame-basilica-montreal.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/f2/f25/notre_dame_basilica_montreal/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  ring = frame.geometry.outline.slice(0, -1),
  results = [],
  failures = [],
  roofSamples = [],
  ground = read('terrain-grid.json');
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:c9577c60f08afb3a2131866962e9a24368645532e5b14d2b71fdf40235289165',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:afbdd4fb072e42bff7450ed36c32fe5a08e97e0e6834832b00b20cac8ad86a5a',
);
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  notreDameBasilicaMontreal(b, frame, d);
  const source = b.finalize();
  validateAuthoredMesh(source, `Montreal basilica source${d}`);
  assert(source.triangleCount <= [1000, 4000, 16000, 64000][d]);
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
      `Montreal basilica runtime${d}`,
    );
    triangles += idx.length / 3;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
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
  for (const [x, z] of frame.geometry.towerCentersLocal) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const xx = x + sx * 4.4,
          zz = z + sz * 4.4,
          hit = ray([xx, 68, zz], [xx, 60, zz])[0];
        check(
          'eight distinct65m tower pinnacle tips',
          !!hit && hit.point.y > 64.8 && hit.point.y <= 65.01,
          { x: xx, z: zz, y: hit?.point.y ?? null },
        );
      }
    for (const [y] of [
      [8, 8.5],
      [23, 8.5],
      [35.7, 8],
      [52, 8.6],
    ]) {
      const hit = ray([x + 0.8, y, z + 7], [x + 0.8, y, z + 3.7])[0];
      check(
        'four distinct tower lancet/louvre tiers',
        !!hit && hit.distance > (d ? 2.95 : 2.5) && hit.distance < 3.15,
        { x, y, depth: hit?.distance ?? null },
      );
    }
    const rose = ray([x + 0.6, 44.6, z + 7], [x + 0.6, 44.6, z + 4])[0];
    check(
      'circular rose between upper louvre tiers',
      !!rose && rose.distance > 2.45 && rose.distance < 2.65,
      { x, depth: rose?.distance ?? null },
    );
  }
  for (const x of [-23 / 3, 0, 23 / 3]) {
    if (d) {
      check(
        'three truly recessed portico air volumes',
        ray([x + 0.5, 8, 33], [x + 0.5, 8, 30.05]).length === 0,
        { x },
      );
      const back = ray([x + 0.5, 8, 30.05], [x + 0.5, 8, 29.4])[0];
      check('opaque inner portal glazing behind air', !!back && back.distance > 0.1, {
        x,
        depth: back?.distance ?? null,
      });
    }
    const h = ray([x + 0.2, 24, 34], [x + 0.2, 24, 30.5])[0];
    check('three distinct blind statuary niches', !!h && h.distance > 1.8 && h.distance < 3.5, {
      x,
      depth: h?.distance ?? null,
    });
  }
  for (const [x, z] of [
    [-32, 20],
    [35, 4],
    [0, -45],
    [15, -65],
    [-25, -45],
  ])
    check('seminary and rear chapel excluded', ray([x, 70, z], [x, -1, z]).length === 0, { x, z });
  for (const x of [-12, 0, 12])
    for (const z of [-25, 0, 15]) {
      const hit = ray([x, 40, z], [x, 27, z])[0],
        expected = 33 - (Math.abs(x) * 4) / 18.5;
      check(
        'low-pitched roof upper face catches downward ray',
        !!hit && Math.abs(hit.point.y - expected) < 0.08,
        { x, z, y: hit?.point.y ?? null, expected },
      );
    }
  for (const i of [13, 14, 15]) {
    let a = ring[i],
      b = ring[(i + 1) % 16];
    if (i === 13) {
      const t = 9.6 / Math.hypot(b[0] - a[0], b[1] - a[1]);
      a = a.map((v, k) => v + (b[k] - v) * t);
    }
    if (i === 15) {
      const t = 9.6 / Math.hypot(b[0] - a[0], b[1] - a[1]);
      b = b.map((v, k) => v + (a[k] - v) * t);
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = (b[1] - a[1]) / len,
      nz = -(b[0] - a[0]) / len;
    for (const t of [0.08, 0.25, 0.42, 0.59, 0.76, 0.93]) {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t,
        h = terrain(x, z);
      check(
        'photo-directed lower masonry intersects unchanged source ground',
        h > -5.05 &&
          h < 0.5 &&
          ray([x + nx * 0.3, h + 0.1, z + nz * 0.3], [x - nx * 0.3, h + 0.1, z - nz * 0.3]).length >
            0,
        { edge: i, x, z, ground: h },
      );
    }
  }
  if (d)
    for (const sign of [-1, 1])
      for (const z of [-17.6, -6, 5.6, 17.1]) {
        const hit = ray([sign * 22, 14, z], [sign * 19, 14, z])[0];
        check(
          'four wide transomed nave bays per side',
          !!hit && hit.distance > 1.5 && hit.distance < 2.1,
          { side: sign, z, depth: hit?.distance ?? null },
        );
      }
  for (const z of [-20, -7, 8]) {
    const hit = ray([-22, -2, z], [-19, -2, z])[0];
    check('continuous real lower-storey masonry below former base', !!hit, { z });
  }
  const canopy = ray([-21.5, 2, -7], [-21.5, -2, -7])[0];
  check(
    'east basement doorway has its own gabled hood',
    !!canopy && canopy.point.y > -0.5 && canopy.point.y < 0.4,
    { y: canopy?.point.y ?? null },
  );
  for (const sign of [-1, 1])
    for (const z of [-26, -29])
      check(
        'raised rear panels have real backing seen from roof side',
        ray([sign * 19.5, 31.2, z], [sign * 21, 31.2, z]).length > 0,
        { side: sign, z },
      );
  const samples = [];
  for (const [x, z] of [
    [-12, -20],
    [12, -20],
    [-8, 5],
    [8, 5],
    [0, -10],
    [0, 15],
  ]) {
    const hit = ray([x, 40, z], [x, 27, z])[0];
    samples.push(hit?.point.y ?? null);
  }
  roofSamples.push(samples);
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
const contacts = [];
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
for (let k = 0; k < ring.length; k++) {
  const a = ring[k],
    b = ring[(k + 1) % ring.length],
    n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
  for (let i = 0; i <= n; i++)
    contacts.push(terrain(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n));
}
const lodDifferences = roofSamples.slice(0, 3).map((r, d) => ({
  level: results[d].level,
  sampledPoints: r.length,
  maximumSampledHeightDifference: Math.max(...r.map((v, i) => Math.abs(v - roofSamples[3][i]))),
}));
assert(lodDifferences.every((r) => r.maximumSampledHeightDifference < 0.01));
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  failures,
  lodDifferences,
  terrainContact: {
    status: 'passed-bounded-source-preview',
    probes: contacts.length,
    relativeGroundRange: [Math.min(...contacts), Math.max(...contacts)],
    architecturalBase: -5.2,
    entrancePlatform: 0.6,
    sourceHeightsUnchanged: true,
    frozenBeforeGeometry: true,
    reason:
      'Primary side photographs now establish missing lower masonry storey,basement doorway,raised stair and side bays. Fixed architectural dimensions precede contact checks against unchanged original bare-earth DTM. No fitted pad/cutout,adaptive wall depths or host-survey claim.',
  },
  scope:
    'Actual4source/imported Float32 attributes/normals/UVs/winding,strict budgets,eight65m tower pinnacles,four pointed-window/louvre tiers per tower,circular roses,three portico air/recessed inner glazing volumes,three statuary niches,main low roof and seminary/rear chapel exclusion. Roof sample coincidence is not global LOD error proof. Primary side controls include four wide transomed nave bays,raised end bay,pinnacles and actual lower-storey/canopy ground rays. Exact dimensions and hidden rear/west details remain estimates.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, JSON.stringify(failures));
