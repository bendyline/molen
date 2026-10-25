/** Actual Float32 source/imported geometry: native controls, exterior air, roof terraces and frozen independent ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hayashiDepartmentStore } from '../../../../../../../packages/worldgen/scripts/structure-hayashi-department-store.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/ws/wsj/hayashi_department_store/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:5ed45f12ed13d6bb6b74c158ebb44a5c41cea5160686b74eaa1a9815485c165e',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:97de909c9f0445f6d511f260e1fdb40a53b1ac8d43ff01b33cb59df76fe62a0a',
);
const ring = frame.geometry.outline.slice(0, -1),
  r = ring,
  limits = [1000, 4000, 16000, 64000],
  results = [],
  failures = [],
  roofSamples = [],
  ground = read('terrain-grid.json'),
  heights = ground.heightsMeters;
function terrain(x, z) {
  const u = x - ground.origin[0],
    v = z - ground.origin[1],
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (heights[j][i] * (1 - a) + heights[j][i + 1] * a) * (1 - b) +
    (heights[j + 1][i] * (1 - a) + heights[j + 1][i + 1] * a) * b -
    ground.modelDatumElevationMeters
  );
}
// Independent planar metric controls use the retained map, not the generated buffers.
function roundedControl(index) {
  const prev = r[(index + r.length - 1) % r.length],
    p = r[index],
    next = r[(index + 1) % r.length],
    u = p.map((v, k) => v - prev[k]),
    v = next.map((n, k) => n - p[k]),
    ul = Math.hypot(...u),
    vl = Math.hypot(...v),
    a = u.map((n) => n / ul),
    b = v.map((n) => n / vl),
    turn = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]),
    radius = 1.15,
    t = radius * Math.tan(turn / 2),
    start = p.map((n, k) => n - a[k] * t),
    end = p.map((n, k) => n + b[k] * t),
    centre = [start[0] - a[1] * radius, start[1] + a[0] * radius],
    theta = Math.atan2(start[1] - centre[1], start[0] - centre[0]) + turn / 2,
    n = [Math.cos(theta), Math.sin(theta)];
  return {
    start,
    end,
    centre,
    normal: n,
    point: [centre[0] + radius * n[0], centre[1] + radius * n[1]],
  };
}
const c1 = roundedControl(2),
  c2 = roundedControl(3),
  edges = [
    [r[1], c1.start],
    [c2.end, r[4]],
    [c1.end, c2.start],
  ],
  edgePoint = (edge, x, y, z) => {
    const [a, b] = edge,
      l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [-(b[0] - a[0]) / l, -(b[1] - a[1]) / l],
      n = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
    return [(a[0] + b[0]) / 2 + u[0] * x + n[0] * z, y, (a[1] + b[1]) / 2 + u[1] * x + n[1] * z];
  };
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  hayashiDepartmentStore(builder, frame, d);
  const source = builder.finalize();
  validateAuthoredMesh(source, `Hayashi source${d}`);
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
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Hayashi runtime${d}`,
    );
    triangles += indices.length / 3;
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
  // Five native corner neighborhoods are covered by the actual architectural base, with a small inset at photographic fillets.
  for (const [x, z] of r) {
    const l = Math.hypot(x, z),
      xx = x - (x / l) * 0.35,
      zz = z - (z / l) * 0.35,
      hits = ray([xx, 0.7, zz], [xx, -0.7, zz]);
    check(
      'native base coverage',
      hits.some((hit) => Math.abs(hit.point.y - 0.15) < 0.001),
      {
        x: xx,
        z: zz,
        y: hits[0]?.point.y ?? null,
      },
    );
  }
  for (let edge = 0; edge < 3; edge++) {
    const e = edges[edge],
      w = Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]),
      q = (x, y, z) => edgePoint(e, x, y, z);
    check(
      'ground arcade remains open',
      ray(q(-w / 2 + 0.5, 1.6, -0.8), q(w / 2 - 0.5, 1.6, -0.8)).length === 0,
      { edge },
    );
    if (d > 0)
      for (let floor = 1; floor <= 4; floor++) {
        const y = 3.8 + (floor - 1) * 3.4;
        check(
          'balcony air behind railing',
          ray(q(-w / 2 + 0.55, y + 0.4, 0.35), q(w / 2 - 0.55, y + 0.4, 0.35)).length === 0,
          { edge, floor },
        );
      }
    if (d > 0 && edge < 2)
      for (let i = 0; i < 5; i++) {
        const x = -w / 2 + ((i + 0.5) * w) / 5,
          hits = ray(q(x, 18.03, 0.5), q(x, 18.03, -0.6));
        check('roof parapet square opening', hits.length === 0, {
          edge,
          i,
          first: hits[0]?.point.toArray() ?? null,
        });
      }
  }
  for (const [ci, c] of [c1, c2].entries())
    for (let i = 0; i < 4; i++) {
      const y = 3.8 + i * 3.4 + 1.7,
        p = (t) => [c.point[0] + c.normal[0] * t, y, c.point[1] + c.normal[1] * t];
      if (d > 0) {
        const hits = ray(p(0.2), p(-0.15));
        check('rounded shoulder true porthole recess', hits.length === 0, {
          shoulder: ci,
          floor: i + 2,
          first: hits[0]?.point.toArray() ?? null,
        });
      }
      check(
        'porthole remains opaque backed exterior',
        ray(p(d ? -0.16 : 0.2), p(-0.4)).length > 0,
        {
          shoulder: ci,
          floor: i + 2,
        },
      );
    }
  if (d > 0) {
    const e = edges[2],
      w = Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]);
    for (let i = 0; i < 5; i++) {
      const x = ((i - 2) * w * 0.82) / 5,
        hits = ray(edgePoint(e, x, 18.125, 1.35), edgePoint(e, x, 18.125, 0.65));
      check('five circular observation rail holes', hits.length === 0, {
        hole: i,
        first: hits[0]?.point.toArray() ?? null,
      });
    }
  }
  for (const [x, z] of [
    [-7, 0],
    [-3, 3],
    [-9, 3],
  ]) {
    check('fifth-floor terrace remains open to sky', ray([x, 25, z], [x, 14.2, z]).length === 0, {
      x,
      z,
    });
    const h = ray([x, 14.2, z], [x, 13.5, z]);
    check('fifth-floor own terrace floor', h.length > 0 && Math.abs(h[0].point.y - 14) < 0.001, {
      x,
      z,
      y: h[0]?.point.y ?? null,
    });
  }
  check('torii genuine opening', ray([7.8, 19.1, 5], [9.2, 19.1, 5]).length === 0);
  for (const [x, z] of [
    [-6, -8],
    [3, -7],
    [7, 0],
    [8, 8],
  ]) {
    const hits = ray([x, 18.0, z], [x, 16.9, z]);
    check(
      'two restaurant roof wings',
      hits.length > 0 && Math.abs(hits[0].point.y - 17.4) < 0.001,
      { x, z, y: hits[0]?.point.y ?? null },
    );
  }
  const samples = [];
  for (const [x, z] of [
    [-8, -9],
    [-3, -9],
    [3, -9],
    [8, -6],
    [8, 1],
    [8, 8],
    [-6, 0],
    [-3, 4],
    [-7, 8],
  ]) {
    const hits = ray([x, 26, z], [x, 13.6, z]);
    check('roof silhouette samples retained', hits.length > 0, { x, z });
    samples.push({ x, z, y: hits[0]?.point.y ?? null });
  }
  roofSamples.push(samples);
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass),
    checks: controls,
  });
}
const contact = [];
for (let side = 0; side < r.length; side++) {
  const a = r[side],
    b = r[(side + 1) % r.length];
  for (let i = 0; i <= 40; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / 40,
      z = a[1] + ((b[1] - a[1]) * i) / 40,
      h = terrain(x, z),
      pass = h > -0.6 && h < 0.15;
    contact.push({ x, z, ground: h, pass });
    if (!pass) failures.push({ name: 'ground contact', x, z, height: h });
  }
}
const lodDifferences = roofSamples.slice(0, 3).map((r, d) => {
  const max = Math.max(
      ...r.map((p, i) =>
        p.y !== null && roofSamples[3][i].y !== null ? Math.abs(p.y - roofSamples[3][i].y) : 0,
      ),
    ),
    budget = side.runtimeLods.levels[d].errorMeters;
  assert(max <= budget + 0.001, `${d} sampled height deviation ${max}>${budget}`);
  return {
    level: side.runtimeLods.levels[d].name,
    sampledMaximumRoofHeightDifference: max,
    budget,
  };
});
const report = {
  format: 'molen/structure-geometry-review@1',
  status: failures.length ? 'failed' : 'passed',
  asset: side.id,
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  lodDifferences,
  terrainContact: {
    probes: contact.length,
    ownFoundationBottom: -0.6,
    ownFloor: 0.15,
    relativeGroundRange: [
      Math.min(...contact.map((p) => p.ground)),
      Math.max(...contact.map((p) => p.ground)),
    ],
    failures: contact.filter((p) => !p.pass),
    sourceGroundUnchanged: true,
  },
  failures,
  scope:
    'Four actual imported LODs and source buffers. Native footprint coverage; true ground arcade, detailed balcony/porthole/rail/parapet openings; two roof wings and open fifth terrace. Opaque window backings checked separately. Existing floor/base and original independent source field; no terrain flattening, cutout or fitted pad. Detailed opening controls apply district/street/closeup; skyline uses ordinary opaque silhouette proxies. Photo-estimated exterior, not a measured height/roof plan, global geometric error bound or navigable interior.',
};
const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
if (out) fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log({
  levels: results.map((r) => ({
    level: r.level,
    triangles: r.triangles,
    controls: r.controls,
    failures: r.failed.length,
  })),
  lodDifferences,
  terrainContact: report.terrainContact,
  failures,
});
assert.equal(failures.length, 0);
