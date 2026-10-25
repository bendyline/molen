/** Actual source/imported geometry controls; unchanged surface DEM failure is reported separately. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { humayunsTomb } from '../../../../../../../packages/worldgen/scripts/structure-humayuns-tomb.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/tt/ttn/humayuns_tomb/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  ring = frame.geometry.bodyOutline.slice(0, -1),
  results = [],
  failures = [];
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:dac2147bb0bd1af954c482bd958b2cbc2ec5d7e7cb7c7bb801bd671e28d2f760',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:a8134c5f476aa1305df4f2735ff1b396e7d73eba08d094c53b5dba157a5c528c',
);
function point(r, k, x, y, z) {
  const a = r[k],
    b = r[(k + 1) % r.length],
    w = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / w,
    dz = (b[1] - a[1]) / w;
  return [(a[0] + b[0]) / 2 - dx * x + dz * z, y, (a[1] + b[1]) / 2 - dz * x - dx * z];
}
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  humayunsTomb(b, frame, d);
  const source = b.finalize();
  validateAuthoredMesh(source, `Humayun source${d}`);
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
      `Humayun runtime${d}`,
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
    const a = ring[k],
      bb = ring[(k + 1) % ring.length],
      w = Math.hypot(bb[0] - a[0], bb[1] - a[1]),
      p = (x, y, z) => point(ring, k, x, y, z),
      hit = ray(p(w * 0.48, 9, 0.3), p(w * 0.48, 9, -0.3))[0];
    check('native24edge body wall outward face', !!hit, { edge: k });
  }
  for (const k of [2, 8, 14, 20]) {
    const p = (x, y, z) => point(ring, k, x, y, z);
    check('central portal parapet', ray(p(0, 23.4, 0.4), p(0, 23.4, -0.1)).length > 0, { edge: k });
    if (d) {
      check(
        'central pointed iwan has depth and air',
        ray(p(3, 12, 0.1), p(3, 12, -2.8)).length === 0,
        { edge: k },
      );
      const back = ray(p(3, 12, 0.2), p(3, 12, -3.2))[0];
      check(
        'central iwan opaque exterior backing',
        !!back && Math.abs(back.distance - 3.2) < 0.05,
        { edge: k, distance: back?.distance ?? null },
      );
      check(
        'central arch crown not covered by solid box',
        ray(p(0, 20.5, 0.1), p(0, 20.5, -2.8)).length === 0,
        { edge: k },
      );
    }
  }
  for (const id of ['35184885087884', '35184885087885', '35184885087886', '35184885087887']) {
    const rr = frame.geometry.parts.find((p) => p.id.endsWith(`/${id}`)).outline.slice(0, -1),
      x = rr.reduce((s, p) => s + p[0], 0) / rr.length,
      z = rr.reduce((s, p) => s + p[1], 0) / rr.length;
    check('corner chhatri central air', ray([x - 1.7, 22.6, z], [x + 1.7, 22.6, z]).length === 0, {
      id,
    });
    check('corner chhatri roof silhouette', ray([x, 29, z], [x, 24, z]).length > 0, { id });
  }
  const low = frame.geometry.outline.slice(0, -1);
  for (let k = 0; k < low.length; k++) {
    const p = (x, y, z) => point(low, k, x, y, z);
    check(
      'lower platform native edge and architectural wall foot',
      ray(p(5, 0.5, 0.2), p(5, 0.5, -0.2)).length > 0,
      { edge: k },
    );
  }
  const upper = frame.geometry.terraceOutline.slice(0, -1);
  for (let k = 0; k < upper.length; k++) {
    const a = upper[k],
      bb = upper[(k + 1) % upper.length],
      w = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
    if (w < 30) continue;
    for (let bay = 0; bay < 17; bay++) {
      const x = -w / 2 + ((bay + 0.5) * w) / 17,
        p = (y, z) => point(upper, k, x, y, z);
      if (d >= 2) {
        check('terrace17bay pointed recess air', ray(p(3, 0.1), p(3, -0.9)).length === 0, {
          edge: k,
          bay,
        });
        check(
          bay === 8 ? 'central stair niche has no false backing' : 'terrace cell opaque backing',
          ray(p(3, 0.1), p(3, -1.2)).length > 0 === (bay !== 8),
          {
            edge: k,
            bay,
          },
        );
      } else if (bay !== 8)
        check('coarse continuous terrace exterior', ray(p(3, 0.1), p(3, -0.1)).length > 0, {
          edge: k,
          bay,
        });
    }
    const local = (x, y, z) => point(upper, k, x, y, z),
      steps = [2, 3, 16, 26][d];
    check(
      'central stair entrance has physical air beneath vault',
      ray(local(0, 5.4, 0.1), local(0, 5.4, -1.05)).length === 0,
      { edge: k },
    );
    for (let j = 0; j < steps - 1; j++) {
      const z = (-8.4 * (j + 0.5)) / steps;
      if (z > -1.12) continue;
      const hit = ray(local(0, 7.05, z), local(0, 1.2, z))[0],
        expected = 1.3 + (5.7 * (j + 1)) / steps;
      check(
        'open upper deck slot reaches actual stair tread',
        !!hit && Math.abs(hit.point.y - expected) < 0.002,
        { edge: k, step: j, expected, actual: hit?.point.y ?? null },
      );
    }
    for (const x of [-1.3, 1.3]) {
      const hit = ray(local(x, 7.1, -4.2), local(x, 6.8, -4.2))[0];
      check(
        'upper deck remains on both sides of stair exit',
        !!hit && Math.abs(hit.point.y - 7) < 0.002,
        { edge: k, x },
      );
    }
  }
  const dr = frame.geometry.domeOutline.slice(0, -1),
    cx = dr.reduce((s, p) => s + p[0], 0) / dr.length,
    cz = dr.reduce((s, p) => s + p[1], 0) / dr.length;
  for (const [x, z] of [
    [cx + 3, cz],
    [cx - 3, cz],
    [cx, cz + 3],
    [cx, cz - 3],
  ]) {
    const hit = ray([x, 40, z], [x, 33, z])[0];
    check('marble dome crown envelope', !!hit && hit.point.y > 35 && hit.point.y < 38.1, {
      x,
      z,
      height: hit?.point.y ?? null,
    });
  }
  const fin = ray([cx, 44, cz], [cx, 38, cz])[0];
  check('central finial42.5m approximate envelope', !!fin && Math.abs(fin.point.y - 42.5) < 0.001, {
    height: fin?.point.y ?? null,
  });
  for (const [x, z] of [
    [70, 0],
    [0, 75],
    [-75, 0],
    [0, -75],
  ])
    check('separate tombs gates gardens excluded', ray([x, 55, z], [x, -1, z]).length === 0, {
      x,
      z,
    });
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
const ground = read('terrain-grid.json'),
  h = ground.heightsMeters,
  contact = [];
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
const lower = frame.geometry.outline;
for (let k = 0; k < lower.length - 1; k++) {
  const a = lower[k],
    b = lower[k + 1],
    n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n,
      z = a[1] + ((b[1] - a[1]) * i) / n;
    contact.push({ edge: k, x, z, h: terrain(x, z) });
  }
}
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  failures,
  terrainContact: {
    status: 'failed-geographic-completion-held',
    probes: contact.length,
    relativeGroundRange: [
      Math.min(...contact.map((c) => c.h)),
      Math.max(...contact.map((c) => c.h)),
    ],
    architecturalBase: -0.6,
    lowerPlatformTop: 1.3,
    upperTerraceTop: 7,
    sourceHeightsUnchanged: true,
    frozenBeforeGeometry: true,
    reason:
      'Original surface DEM rises through lower platform and terrace. Copernicus also fails. Geometry/source validation does not constitute terrain acceptance. No adaptive wall extension, flattening, cutout or active placement.',
  },
  scope:
    'Actual4source/imported geometry, strict budgets, nativebody and platform long edges, fourdeepmainiwans, fouropenchhatris,16backed cells plus one physical central stair per long terrace face, open upper deck exits, dome/finial and excluded neighboring scenery. Other coarse terrace recesses are opaque proxies; distant stair counts simplify treads. Not a survey or global LOD error proof.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, JSON.stringify(failures));
