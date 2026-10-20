/** Check actual imported mesh levels, courtyard air, supported stairs and source ground. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { oldParliamentHouse } from '../../../../../../../packages/worldgen/scripts/structure-old-parliament-house-canberra.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/r3/r3d/old_parliament_house_canberra/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  ground = read('terrain-grid.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  failures = [],
  results = [];

function height(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = ground.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    ground.modelDatumElevationMeters
  );
}
const ring = frame.geometry.outline,
  probes = [];
for (let i = 0; i < ring.length; i++) {
  const a = ring[i],
    b = ring[(i + 1) % ring.length],
    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    count = Math.max(1, Math.ceil(length / 0.8)),
    normal = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
  // Native outer ring is clockwise in xz, so its outward normal is to the left.
  for (let j = 0; j < count; j++) {
    const t = (j + 0.5) / count,
      point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    probes.push({ point, normal, ground: height(...point) });
  }
}
const signedArea = ring.reduce(
  (s, a, i) => s + a[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * a[1],
  0,
);
if (signedArea < 0) for (const p of probes) p.normal = p.normal.map((v) => -v);

for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  oldParliamentHouse(builder, frame, d);
  const raw = builder.finalize();
  validateAuthoredMesh(raw, `Old Parliament source${d}`);
  assert(raw.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse((object) => {
    if (object.material)
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = T.FrontSide;
    if (!object.geometry) return;
    const p = object.geometry.getAttribute('position'),
      n = object.geometry.getAttribute('normal'),
      uv = object.geometry.getAttribute('uv'),
      idx = object.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Old Parliament runtime${d}`,
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
  for (const court of frame.features[0].rings.slice(1)) {
    const center = [0, 1].map((k) => court.reduce((s, p) => s + p[k], 0) / court.length);
    check(
      'open courtyard through every detail level',
      ray([center[0], 30, center[1]], [center[0], -7, center[1]]).length === 0,
      { center },
    );
  }
  for (const [x, z] of [
    [28, 8],
    [-31, 8],
    [0, -20],
  ]) {
    const hit = ray([x, 30, z], [x, 6, z])[0];
    check('upward roof face remains visible', !!hit && hit.point.y > 8, { x, z, y: hit?.point.y });
  }
  const count = d === 0 ? 3 : 12;
  for (let j = 0; j < count; j++) {
    const top = ((j + 1) * 2.35) / count,
      z = 44.7 - (j * 4) / count;
    const hit = ray([7, top * 0.4, z], [4.5, top * 0.4, z])[0];
    check('stone stair has solid supported side below tread', !!hit, { j, top, z });
  }
  if (d > 0) check('open porch below canopy', ray([-0.5, 3.5, 44], [-0.5, 3.5, 37]).length === 0);
  else
    check(
      'skyline approach air before simplified front range',
      ray([-0.5, 3.5, 44], [-0.5, 3.5, 41.3]).length === 0,
    );
  for (const p of probes) {
    const [x, z] = p.point,
      [nx, nz] = p.normal,
      y = p.ground + 0.35,
      hit = ray([x + nx * 0.45, y, z + nz * 0.45], [x - nx * 0.45, y, z - nz * 0.45])[0];
    check('native exterior wall meets independent ground', !!hit, {
      point: p.point,
      ground: p.ground,
    });
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass),
  });
}
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  failures,
  terrainContact: {
    probes: probes.length,
    relativeGroundRange: [
      Math.min(...probes.map((p) => p.ground)),
      Math.max(...probes.map((p) => p.ground)),
    ],
    source: 'official ACT2020 LiDAR-derived2m contour field; unchanged after acquisition',
    sourceGridHash: hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  },
  scope:
    'Main building, four open courts and own entrance; fixed stair support added from photograph. No terrain fitting.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, 'Old Parliament mesh controls failed');
