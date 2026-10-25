/** Actual imported quay/stair coverage and retained ground controls. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { gatewayOfIndia } from './structure-gateway-of-india.mjs';
import { hashBytes, modelInputHash } from './structure-model-files.mjs';

const dir = 'content/worldgen/source/places/te/te7/gateway_of_india',
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
  'terrain-grid.json': 'sha256:7017bb0720c70898868379205212f3239a2aab34660a142b84df6570a581e461',
  'terrain-review.height.png':
    'sha256:ecb7fa3f839e2fa524a4b76d5f3839e9b53151377a964693b844ff5ba857e8fd',
  'terrain-review.terrain.json':
    'sha256:a2ae3dae32d3b9c5c122a413e8d2e7fdcd641d022c6415e865cd3319ffb32723',
};
for (const [n, h] of Object.entries(retained))
  assert.equal(hashBytes(fs.readFileSync(`${dir}/${n}`)), h, `unchanged ${n}`);
assert.deepEqual(frame.anchor, [72.834567, 18.921965]);
assert.equal(frame.heading, -2.473);
assert.deepEqual(frame.terrainContact.local, [0, 13.5]);
assert.equal(frame.terrainContact.modelY, 0);
assert.deepEqual(spec.geographicProposal.groundCutout.outline, site.quay.outline);
assert.deepEqual(spec.geographicProposal.groundCutout.additionalOutlines, [site.stair.outline]);
assert(site.quay.masonryBase < site.waterStage.modelY);
assert(site.stair.lowerLevel > site.waterStage.modelY);
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
const sample = (ring) => {
  const xs = ring.map((p) => p[0]),
    zs = ring.map((p) => p[1]),
    points = [];
  for (let x = Math.min(...xs) + 0.213; x < Math.max(...xs); x += 1.37)
    for (let z = Math.min(...zs) + 0.167; z < Math.max(...zs); z += 1.37)
      if (inside(x, z, ring)) points.push([x, z]);
  assert(points.length);
  return points;
};
const results = [];
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  gatewayOfIndia(b, frame, d);
  validateAuthoredMesh(b.finalize(), `Gateway source ${d}`);
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
      `Gateway runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= (d ? 4 : 1));
  const [ur, lr, , ul] = site.stair.outline,
    count = d > 1 ? 20 : d ? 10 : 5,
    checks = [];
  for (const [name, ring, height] of [
    ['quay deck', site.quay.outline, () => 0],
    [
      'sea stair',
      site.stair.outline,
      (x, z) => {
        // The mapped side edges are near parallel; solve their shared ruled parameter.
        const dx = lr[0] - ur[0],
          dz = lr[1] - ur[1],
          ax = ul[0] - ur[0],
          az = ul[1] - ur[1],
          t = ((x - ur[0]) * az - (z - ur[1]) * ax) / (dx * az - dz * ax);
        return (
          site.stair.upperLevel +
          ((site.stair.lowerLevel - site.stair.upperLevel) * Math.ceil(t * count)) / count
        );
      },
    ],
  ]) {
    const points = sample(ring);
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
        `${level.name} ${name}: ${x},${z} expected ${y}`,
      );
    }
    checks.push({ name, probes: points.length, missing: 0 });
  }
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
  retainedDryApproach: frame.terrainContact,
  sourceMeanSeaLevelContext: site.waterStage.modelY,
  seaLandingClearanceAboveContext: site.stair.lowerLevel - site.waterStage.modelY,
  limits:
    'Host ocean is scene-owned. No exact tidal stage,civil levels or submerged seabed contact is certified.',
  results,
};
fs.mkdirSync('.artifacts/qualla-batch', { recursive: true });
fs.writeFileSync(
  '.artifacts/qualla-batch/gateway-site-check.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(report);
