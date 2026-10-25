/** Current imported levels: retained supported footing and unfilled full-tower window/corbel reveals. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { whiteTowerOfThessaloniki } from '../../../../../../../packages/worldgen/scripts/structure-white-tower-of-thessaloniki.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/sx/sx0/white_tower_of_thessaloniki/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  grid = read('terrain-grid.json'),
  before = read('terrain-sources/before-deltadtm.json').snapshot,
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  failures = [],
  results = [],
  allHeights = [];
const retained = read('corbel-arch-construction-controls.json').retainedInputs;
for (const [name, hash] of Object.entries(retained))
  assert.equal(hashBytes(fs.readFileSync(new URL(name, dir))), hash);
assert.equal(side.sourceHash, read('source.json').files.models[0].sha256);
assert.deepEqual(frame.anchor, before.anchor);
assert.equal(frame.heading, before.heading);
assert.deepEqual(frame.terrainContact, before.terrainContact);

function ground(x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = grid.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    grid.modelDatumElevationMeters
  );
}
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  whiteTowerOfThessaloniki(builder, frame, d);
  validateAuthoredMesh(builder.finalize(), `White Tower source${d}`);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  assert(level.triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= 6);
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
      indices = object.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `White Tower runtime${d}`,
    );
    triangles += indices.length / 3;
  });
  assert.equal(triangles, level.triangles);
  const checks = [],
    check = (name, pass, data = {}) => {
      checks.push({ name, pass, ...data });
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
  const n = [8, 16, 48, 96][d],
    footHeights = [];
  for (let i = 0; i < n; i++) {
    const a = (-i * Math.PI * 2) / n,
      b = (-(i + 1) * Math.PI * 2) / n,
      start = [10.96 * Math.cos(a), 10.96 * Math.sin(a)],
      end = [10.96 * Math.cos(b), 10.96 * Math.sin(b)],
      normal = [Math.cos((a + b) / 2), Math.sin((a + b) / 2)],
      count = Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 0.4);
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        x = start[0] * (1 - t) + end[0] * t,
        z = start[1] * (1 - t) + end[1] * t,
        y = ground(x, z),
        hit = ray(
          [x + normal[0] * 0.15, y + 0.008, z + normal[1] * 0.15],
          [x - normal[0] * 0.15, y + 0.008, z - normal[1] * 0.15],
        )[0];
      footHeights.push(y);
      check(
        'unchanged physical polygonal footing meets source ground',
        y >= -0.65 && y <= 0.12 && !!hit,
        { x, z, ground: y },
      );
    }
  }
  allHeights.push(...footHeights);
  const openings = [{ name: 'main door reveal', a: [0.13, 1.2, 11.2], b: [0.13, 1.2, 10.1] }];
  if (d > 0) {
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7 - 0.45,
        p = (r) => [r * Math.sin(a), 3.6 + ((i % 3) - 1) * 0.23, r * Math.cos(a)];
      openings.push({ name: 'low window reveal', a: p(11), b: p(10.5) });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6 + 0.2,
        p = (r) => [r * Math.sin(a), 29.1, r * Math.cos(a)];
      openings.push({ name: 'upper turret window', a: p(6.2), b: p(5.75) });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 38,
        p = (r) => [r * Math.sin(a), 26.1, r * Math.cos(a)];
      openings.push({ name: 'arched corbel niche', a: p(11.5), b: p(10.98) });
    }
  }
  for (const p of openings) check(p.name, ray(p.a, p.b).length === 0);
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    hash: level.hash,
    controls: checks.length,
    footProbes: footHeights.length,
    relativeGroundRange: [Math.min(...footHeights), Math.max(...footHeights)],
    failed: checks.filter((c) => !c.pass),
  });
}
const report = {
  status: failures.length ? 'failed' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  failures,
  terrainContact: {
    probes: results.reduce((n, r) => n + r.footProbes, 0),
    relativeGroundRange: [Math.min(...allHeights), Math.max(...allHeights)],
    source: 'Original DeltaDTM v1.1.1 one arcsecond pixels; bounded32m land review',
    sourceGridHash: hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
    originalFootingMapAndGroundUnchanged: true,
  },
  scope:
    'Standalone fortification and own footing; sea and surrounding square excluded. Sampled mesh coverage; not surveyed floor accuracy or measured global LOD error.',
};
console.log(JSON.stringify(report, null, 2));
assert.equal(failures.length, 0, 'White Tower geometry controls failed');
