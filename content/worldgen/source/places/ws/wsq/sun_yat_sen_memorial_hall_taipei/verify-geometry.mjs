/** Independent checks of the actual source/imported GLBs, native controls and frozen ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  sunYatSenMemorialHallTaipei,
  sunYatSenMemorialHallTaipeiDistrict,
  sunYatSenMemorialHallTaipeiSkyline,
  sunYatSenMemorialHallTaipeiStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-sun-yat-sen-memorial-hall-taipei.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  runtime = new URL(
    'content/worldgen/assets/places/ws/wsq/sun_yat_sen_memorial_hall_taipei/',
    root,
  ),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:de56b983c71a235f40dc724a7eccb01e556dd105d250d4c0f2883c3477b54d14',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:1549e8da92d532e4d8b9bdb50f191e60ab450e5268145b61c8fed5883b4c9292',
);
const builds = [
    sunYatSenMemorialHallTaipeiSkyline,
    sunYatSenMemorialHallTaipeiDistrict,
    sunYatSenMemorialHallTaipeiStreet,
    sunYatSenMemorialHallTaipei,
  ],
  limits = [1000, 4000, 16000, 64000],
  results = [],
  failures = [],
  heightSamples = [];
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  builds[d](b, frame);
  const source = b.finalize();
  validateAuthoredMesh(source, `Hall source${d}`);
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
      `Hall runtime${d}`,
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
      const o = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(o);
      return new T.Raycaster(
        o,
        v.clone().normalize(),
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(gltf.scene);
    },
    rotate = (p, a) => [
      Math.cos(a) * p[0] + Math.sin(a) * p[2],
      p[1],
      -Math.sin(a) * p[0] + Math.cos(a) * p[2],
    ];
  // Native curled corners must meet an elevated roof, not merely the broad low terrace.
  for (const [x, z] of frame.controls.nativeLocalCorners) {
    const hits = ray([x, 35, z], [x, 10, z]);
    check('native corner has raised roof/cornice', hits.length > 0, {
      x,
      z,
      y: hits[0]?.point.y ?? null,
    });
  }
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    for (const y of [3, 9]) {
      const ranges =
        side === 0
          ? [
              [-38, -18],
              [18, 38],
            ]
          : [[-38, 38]];
      for (const [x0, x1] of ranges)
        check(
          'outer colonnade remains clear',
          ray(rotate([x0, y, 44.5], a), rotate([x1, y, 44.5], a)).length === 0,
          { side, y, x0, x1 },
        );
    }
    for (const u of [30, 34, 38, 42, 46, 50, 53]) {
      const p = rotate([u, 35, u], a),
        q = rotate([u, 10, u], a),
        hits = ray(p, q);
      check('hip diagonal contains continuous roof', hits.length > 0, {
        side,
        u,
        y: hits[0]?.point.y ?? null,
      });
    }
    for (const x of [-36, -24, 24, 36]) {
      const hits = ray(rotate([x, 2.0, 44.5], a), rotate([x, 1.0, 44.5], a));
      check(
        'own terrace remains below colonnade',
        hits.length > 0 && Math.abs(hits[0].point.y - 1.5) < 0.001,
        { side, x, y: hits[0]?.point.y ?? null },
      );
    }
  }
  for (const [x, z] of [
    [0, 0],
    [-20, -20],
    [20, 20],
  ]) {
    const hits = ray([x, 35, z], [x, 25, z]);
    check(
      'flat red roof deck retained',
      hits.length > 0 && Math.abs(hits[0].point.y - 29.5) < 0.04,
      { x, z, y: hits[0]?.point.y ?? null },
    );
  }
  for (const x of [-10, 0, 10]) {
    const hits = ray([x, 35, 57.8], [x, 20, 57.8]);
    check('high projecting entrance roof retained', hits.length > 0 && hits[0].point.y > 26, {
      x,
      y: hits[0]?.point.y ?? null,
    });
  }
  const samples = [];
  for (const x of [-48, -40, -30, 0, 30, 40, 48])
    for (const z of [-48, -40, -30, 0, 30, 40, 48]) {
      const hits = ray([x, 35, z], [x, 10, z]);
      check('roof coverage at independent footprint grid', hits.length > 0, { x, z });
      samples.push({ x, z, y: hits[0]?.point.y ?? null });
    }
  heightSamples.push(samples);
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
const lodDifferences = heightSamples.slice(0, 3).map((rows, d) => {
  let maximum = 0;
  for (let i = 0; i < rows.length; i++)
    if (rows[i].y !== null && heightSamples[3][i].y !== null)
      maximum = Math.max(maximum, Math.abs(rows[i].y - heightSamples[3][i].y));
  const budget = side.runtimeLods.levels[d].errorMeters;
  assert(
    maximum <= budget + 0.001,
    `${side.runtimeLods.levels[d].name} sampled roof height deviation${maximum}>${budget}`,
  );
  return {
    level: side.runtimeLods.levels[d].name,
    sampledMaximumRoofHeightDifference: maximum,
    budget,
  };
});
const ground = read('terrain-grid.json'),
  rows = ground.heightsMeters,
  terrainProbes = [];
function terrain(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (rows[j][i] * (1 - a) + rows[j][i + 1] * a) * (1 - b) +
    (rows[j + 1][i] * (1 - a) + rows[j + 1][i + 1] * a) * b -
    ground.modelDatumElevationMeters
  );
}
const insideNative = (x, z) => {
  let inside = false;
  const r = frame.geometry.outline;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
};
for (let side = 0; side < 4; side++)
  for (const z of [44, 46, 49, 52, 54.8])
    for (let x = -40; x <= 40; x += 2) {
      if (side === 0 && Math.abs(x) < 16) continue;
      const a = (side * Math.PI) / 2,
        xx = Math.cos(a) * x + Math.sin(a) * z,
        zz = -Math.sin(a) * x + Math.cos(a) * z,
        h = terrain(xx, zz);
      terrainProbes.push({ x: xx, z: zz, height: h, coveredNativeFootprint: insideNative(xx, zz) });
      assert(insideNative(xx, zz) || h < 1.5, `Terrain obscures own terrace:${xx},${zz}:${h}`);
      assert(h > -0.4, `Terrace foundation unsupported:${xx},${zz}:${h}`);
    }
const terrainContact = {
  probes: terrainProbes.length,
  ownTerraceFloorMeters: 1.5,
  ownFoundationBaseMeters: -0.4,
  relativeGroundRange: [
    Math.min(...terrainProbes.map((p) => p.height)),
    Math.max(...terrainProbes.map((p) => p.height)),
  ],
  sourceFieldUnchanged: true,
  coveredNativeProbes: terrainProbes.filter((p) => p.coveredNativeFootprint).length,
  exteriorUncutGroundRange: [
    Math.min(...terrainProbes.filter((p) => !p.coveredNativeFootprint).map((p) => p.height)),
    Math.max(...terrainProbes.filter((p) => !p.coveredNativeFootprint).map((p) => p.height)),
  ],
  scope:
    'Visible outer colonnade/terrace footprint only; closed interior and hidden basements not certified.',
};
const result = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  lodDifferences,
  failures,
  terrainContact,
  scope:
    'Actual geometry attributes and independent native/roof/terrace/clear-passage controls. Sampled exterior checks; not manifold, structural engineering, unseen interior or survey certification.',
};
console.log(JSON.stringify(result, null, 2));
assert.equal(failures.length, 0);
