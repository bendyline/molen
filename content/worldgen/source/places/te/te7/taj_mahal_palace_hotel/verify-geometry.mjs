/** Native high-roof U, photographic arcade/oriel/lantern controls and actual imported Float32 meshes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { tajMahalPalaceHotel } from '../../../../../../../packages/worldgen/scripts/structure-taj-mahal-palace-hotel.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/te/te7/taj_mahal_palace_hotel/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  ring = frame.geometry.outline.slice(0, -1),
  frontZ = ring[7][1],
  cx = (ring[7][0] + ring[8][0]) / 2,
  width = ring[7][0] - ring[8][0],
  results = [],
  failures = [],
  roofSamples = [];
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:ed71a426234aae31c081e66097559e7d898c1c0b3a4b9d3d16dc1ec48ff3afc3',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:24286bb02f96f04a478c71063d619c0ebd282f5da785c18e6075cbefadcd4274',
);
const point = (k, x, y, z) => {
  const a = ring[k],
    b = ring[(k + 1) % ring.length],
    w = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / w,
    dz = (b[1] - a[1]) / w;
  return [(a[0] + b[0]) / 2 - dx * x + dz * z, y, (a[1] + b[1]) / 2 - dz * x - dx * z];
};
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  tajMahalPalaceHotel(b, frame, d);
  const source = b.finalize();
  validateAuthoredMesh(source, `Palace source${d}`);
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
      `Palace runtime${d}`,
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
  for (let k = 0; k < ring.length; k++) {
    if (k === 6) continue;
    const a = ring[k],
      bb = ring[(k + 1) % ring.length],
      w = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
    for (const t of [-0.3, 0.2]) {
      const p = (y, z) => point(k, t * w, y, z);
      check(
        'native historic wall edge above low terrace',
        ray(p(34, 0.25), p(34, -0.25)).length > 0,
        { edge: k, t },
      );
    }
  }
  for (const [x, z] of [
    [-5, -25],
    [10, -18],
    [0, -38],
  ])
    check(
      'courtyard remains open, not filled parent block',
      ray([x, 90, z], [x, -1, z]).length === 0,
      { x, z },
    );
  for (const [x, z] of [
    [80, -20],
    [90, -45],
    [70, 10],
    [-80, 20],
  ])
    check(
      'modern Tower connectors and neighbors excluded',
      ray([x, 95, z], [x, -1, z]).length === 0,
      { x, z },
    );
  for (const sx of [-1, 1])
    for (const x of [14, 19.6, 25.2, 30.8, 36.4, 42])
      for (const y of [15.5, 21.5, 27.5]) {
        const xx = cx + sx * x;
        if (d) {
          const hit = ray([xx, y, frontZ + 2], [xx, y, frontZ + 0.8])[0];
          check('twelve three-storey oriel projections', !!hit, { x: xx, y });
        } else
          check(
            'skyline oriel rhythm proxy',
            ray([xx, y, frontZ + 0.3], [xx, y, frontZ + 0.1]).length > 0,
            { x: xx, y },
          );
      }
  if (d)
    for (const sx of [-1, 1])
      for (const x of [16.8, 22.4, 28, 33.6, 39.2])
        check(
          'air between projecting oriel stacks',
          ray([cx + sx * x, 21, frontZ + 1.3], [cx + sx * x, 21, frontZ + 0.4]).length === 0,
          { x: cx + sx * x },
        );
  for (let i = 1; i < 18; i++) {
    const x = cx - width / 2 + ((i + 0.5) * width) / 19;
    for (const inset of [0.3, 1, 1.9]) {
      const hit = ray([x, 0.4, frontZ - inset], [x, -0.1, frontZ - inset])[0];
      check(
        'continuous actual arcade floor above unchanged foundation',
        !!hit && Math.abs(hit.point.y - 0.15) < 0.001,
        { bay: i, inset, y: hit?.point.y ?? null },
      );
    }
    if (d) {
      check(
        'waterfront arcade air before opaque vestibule',
        ray([x, 2.5, frontZ + 0.2], [x, 2.5, frontZ - 1.8]).length === 0,
        { bay: i },
      );
      check(
        'opaque vestibule backing avoids invented interior',
        ray([x, 2.5, frontZ + 0.2], [x, 2.5, frontZ - 2.3]).length > 0,
        { bay: i },
      );
    } else
      check(
        'skyline nineteen-bay rhythm proxy',
        ray([x, 2.5, frontZ + 0.1], [x, 2.5, frontZ - 0.1]).length > 0,
        { bay: i },
      );
  }
  if (d)
    for (const x of [-6, 0, 6]) {
      const hit = ray([cx + x + 0.3, 34, frontZ + 0.3], [cx + x + 0.3, 34, frontZ + 0.11])[0];
      check(
        'central upper row projects in front of arched stone surround',
        !!hit && hit.point.z > frontZ + 0.135,
        { x: cx + x + 0.3, z: hit?.point.z ?? null },
      );
    }
  const zc = frontZ - 12.9;
  check('main lantern actually open', ray([cx - 0.75, 66, zc], [cx + 0.75, 66, zc]).length === 0);
  check('main lantern upper cover', ray([cx, 70, zc], [cx, 68, zc]).length > 0);
  const fin = ray([cx, 75, zc], [cx, 71, zc])[0];
  check(
    'published height interpreted as approximate finial envelope',
    !!fin && Math.abs(fin.point.y - 73.152) < 0.001,
    { y: fin?.point.y ?? null },
  );
  for (const [index, p] of [ring[0], ring[5], ring[7], ring[8]].entries()) {
    const hit = ray([p[0], 54, p[1]], [p[0], 48, p[1]])[0];
    check('four corner onion crowns retained', !!hit && hit.point.y > 51 && hit.point.y < 53, {
      corner: index,
      y: hit?.point.y ?? null,
    });
  }
  const low = ray([0, 20, -1], [0, 12, -1])[0];
  check('photo-directed low courtyard terrace', !!low && Math.abs(low.point.y - 13.65) < 0.01, {
    y: low?.point.y ?? null,
  });
  const samples = [];
  for (const [x, z] of [
    [-39, -22],
    [45, -19],
    [25, 16],
    [-25, 16],
    [10, 24],
    [-10, 24],
  ]) {
    const hit = ray([x, 46, z], [x, 38, z])[0];
    check(
      'three hipped roof wings stay inside historic U',
      !!hit && hit.point.y >= 39.4 && hit.point.y <= 43.1,
      { x, z, y: hit?.point.y ?? null },
    );
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
const lodDifferences = roofSamples.slice(0, 3).map((r, d) => ({
  level: results[d].level,
  sampledPoints: r.length,
  maximumSampledHeightDifference: Math.max(...r.map((v, i) => Math.abs(v - roofSamples[3][i]))),
}));
const ground = read('terrain-grid.json'),
  h = ground.heightsMeters,
  contacts = [];
function terrain(x, z) {
  const u = x - ground.origin[0],
    v = z - ground.origin[1],
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
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
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n,
      z = a[1] + ((b[1] - a[1]) * i) / n;
    contacts.push({ edge: k, x, z, h: terrain(x, z) });
  }
}
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  failures,
  lodDifferences,
  terrainContact: {
    status: 'failed-geographic-completion-held',
    probes: contacts.length,
    relativeGroundRange: [
      Math.min(...contacts.map((c) => c.h)),
      Math.max(...contacts.map((c) => c.h)),
    ],
    architecturalBase: -0.65,
    threshold: 0.15,
    sourceHeightsUnchanged: true,
    frozenBeforeGeometry: true,
    reason:
      'Urban/coastal surface DEM mixes structures, land and bathymetry. Do not adapt foundation to fit. No accepted placement or completed annotation.',
  },
  scope:
    'Actual4source/imported geometry, strict budgets, native historic U with explicit inferred north boundary, open courtyard,12three-storey oriel stacks/air gaps,17inner waterfront bays/backed vestibules, open main lantern,4corner crowns,low terrace and6sampled roof points. Two extreme waterfront bays are wrapped by opaque corner turrets. Detail counts/positions are photographic estimates, not a survey or global LOD error certificate.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, JSON.stringify(failures));
