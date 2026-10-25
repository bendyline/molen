/** Physical paving, stair and native-ground controls for the authored cottage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { cadmans } from './structure-cadmans-cottage.mjs';
import { hashBytes, modelInputHash } from './structure-model-files.mjs';

const dir = 'content/worldgen/source/places/r3/r3g/cadmans_cottage',
  runtime = dir.replace('/source/', '/assets/'),
  get = (n) => JSON.parse(fs.readFileSync(`${dir}/${n}`)),
  spec = get('spec.json'),
  frame = get('map-frame.json'),
  site = get('site-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(`${runtime}/asset.json`)),
  req = createRequire(new URL('../package.json', import.meta.url)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));

const retained = {
  'terrain-grid.json': 'sha256:f026c3e4e59901fc52be8af16a2c9b3c2ce9ab98f18b27ab37bd27648ed9c3bd',
  'terrain-review.height.png':
    'sha256:aa207cfac603921dacd7d0cfc19e0510bbdd0cd9ec4aa6cfbf7e4545958d1ac2',
  'terrain-review.terrain.json':
    'sha256:deefa7cc935e92bf674d3463b2f03adef953f4d80cd28521e958198d2580dc64',
};
for (const [name, expected] of Object.entries(retained))
  assert.equal(hashBytes(fs.readFileSync(`${dir}/${name}`)), expected, `unchanged ${name}`);
assert.deepEqual(frame.anchor, [151.2092006, -33.85887]);
assert.equal(frame.heading, 1.28);
assert.deepEqual(frame.terrainContact.local, [0, 4.4]);
assert.equal(frame.terrainContact.modelY, 0);
assert.equal(site.levels.rearDoorThreshold, 3.35);

const inside = (x, z, ring) => {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      yes = !yes;
  }
  return yes;
};
const samples = (ring) => {
  const xs = ring.map((p) => p[0]),
    zs = ring.map((p) => p[1]),
    points = [];
  for (let x = Math.min(...xs) + 0.117; x < Math.max(...xs); x += 0.37)
    for (let z = Math.min(...zs) + 0.163; z < Math.max(...zs); z += 0.37)
      if (inside(x, z, ring)) points.push([x, z]);
  assert(points.length);
  return points;
};
const results = [];
for (let d = 0; d < 4; d++) {
  const builder = new MeshBufferBuilder();
  cadmans(builder, frame, d);
  validateAuthoredMesh(builder.finalize(), `Cadmans source ${d}`);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(`${runtime}/${level.file}`);
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Cadmans runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const material of Array.isArray(o.material) ? o.material : [o.material])
      material.side = T.FrontSide;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= (d ? 8 : 1));
  const stair = site.northStair,
    count = d > 1 ? stair.risers : d ? 10 : 5,
    checks = [
      { name: 'front paving', ring: site.frontCourt.outline, height: () => 0 },
      {
        name: 'north stair',
        ring: spec.geographicProposal.groundCutout.additionalOutlines[0],
        height: (_x, z) =>
          (3.35 * Math.ceil(((stair.frontZ - z) / (stair.frontZ - stair.rearZ)) * count)) / count,
      },
      { name: 'rear court', ring: site.court.outline, height: () => 3.35 },
    ].map(({ name, ring, height }) => {
      const points = samples(ring);
      for (const [x, z] of points) {
        const y = height(x, z),
          hit = new T.Raycaster(
            new T.Vector3(x, y + 0.04, z),
            new T.Vector3(0, -1, 0),
            0,
            0.08,
          ).intersectObject(gltf.scene)[0];
        assert(
          hit && Math.abs(hit.point.y - y) < 0.025,
          `${level.name} ${name}: uncovered ${x},${z} at ${y}`,
        );
      }
      return { name, probes: points.length, missing: 0 };
    });
  const threshold = new T.Raycaster(
    new T.Vector3(0, 3.39, -3.52),
    new T.Vector3(0, -1, 0),
    0,
    0.08,
  ).intersectObject(gltf.scene)[0];
  assert(
    threshold && Math.abs(threshold.point.y - 3.35) < 0.01,
    'raised rear threshold has physical paving',
  );
  results.push({ level: level.name, triangles, drawCalls: level.drawCalls, checks });
}
const report = {
  status: 'passed',
  inputHash: await modelInputHash(dir, spec.assetId),
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  unchangedGroundFiles: Object.keys(retained),
  retainedAnchor: frame.anchor,
  retainedHeading: frame.heading,
  retainedDoorThreshold: 3.35,
  results,
};
fs.mkdirSync('.artifacts/qualla-batch', { recursive: true });
fs.writeFileSync(
  '.artifacts/qualla-batch/cadmans-site-check.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(report);
