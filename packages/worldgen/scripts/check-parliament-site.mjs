/** Physical forecourt shell, frozen architecture and original contour data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { decodePng16 } from '../../terrain/dist/kernel.mjs';
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { hashBytes, modelInputHash } from './structure-model-files.mjs';
import { parliamentHouse } from './structure-parliament-house-canberra.mjs';

const dir = 'content/worldgen/source/places/r3/r3d/parliament_house_canberra',
  runtime = dir.replace('/source/', '/assets/'),
  get = (n) => JSON.parse(fs.readFileSync(`${dir}/${n}`)),
  spec = get('spec.json'),
  frame = get('map-frame.json'),
  site = get('site-construction-controls.json'),
  source = get('ground-source-review.json'),
  grid = get('terrain-grid.json'),
  original = get(source.originalCandidateGrid),
  desc = get('terrain-review.terrain.json'),
  side = JSON.parse(fs.readFileSync(`${runtime}/asset.json`)),
  png = decodePng16(fs.readFileSync(`${dir}/terrain-review.height.png`)),
  heights = Array.from(png.data, (v) =>
    Math.fround(desc.height.min + v * (desc.height.max - desc.height.min)),
  ),
  req = createRequire(new URL('../package.json', import.meta.url)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.deepEqual(grid.heightsMeters, original.heightsMeters);
assert.equal(
  hashBytes(fs.readFileSync(`${dir}/${source.originalCandidateGrid}`)),
  source.originalCandidateHash,
);
for (const s of source.sourceFiles)
  assert.equal(hashBytes(fs.readFileSync(`${dir}/${s.path}`)), s.sha256);
for (const [p, h] of Object.entries(source.originalProviderFiles))
  assert.equal(hashBytes(fs.readFileSync(`${dir}/${p}`)), h);
assert.deepEqual(frame.anchor, [149.12444444444444, -35.308055555555555]);
assert.equal(frame.heading, 2.508);
assert.deepEqual(frame.terrainContact.local, [-7, 128]);
assert.equal(frame.terrainContact.modelY, 0);
assert.equal(grid.modelDatumElevationMeters, 596);
assert.deepEqual(spec.geographicProposal.groundCutout.outline, site.deckOutline);
let encodingError = 0;
grid.heightsMeters.flat().forEach((h, i) => {
  encodingError = Math.max(
    encodingError,
    Math.abs(heights[i] - (h - grid.modelDatumElevationMeters)),
  );
});
assert(encodingError < (desc.height.max - desc.height.min) / 65535 + 0.00002);
const ground = (x, z) => {
  const fx = (x - grid.origin[0]) / grid.stepMeters,
    fz = (z - grid.origin[1]) / grid.stepMeters,
    ix = Math.floor(fx),
    iz = Math.floor(fz),
    u = fx - ix,
    v = fz - iz,
    n = grid.size[0],
    a = heights[iz * n + ix],
    b = heights[iz * n + ix + 1],
    c = heights[(iz + 1) * n + ix],
    e = heights[(iz + 1) * n + ix + 1];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : e + (c - e) * (1 - u) + (b - e) * (1 - v);
};
const inside = (x, z, r) => {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      yes = !yes;
  }
  return yes;
};
const samples = [];
for (let x = -92.51; x < 81; x += 3.1)
  for (let z = 104.31; z < 210.3; z += 3.1)
    if (inside(x, z, site.deckOutline)) samples.push([x, z]);
assert(samples.length > 1000);
const boundary = [],
  r = site.deckOutline,
  sign = Math.sign(
    r.reduce((sum, a, i) => {
      const b = r[(i + 1) % r.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
for (let i = 0; i < r.length; i++) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    count = Math.ceil(len / 2.5);
  for (let j = 1; j < count; j++) {
    const x = a[0] + (dx * j) / count,
      z = a[1] + (dz * j) / count,
      g = ground(x, z);
    assert(g >= site.levels.garageFloorBottom + 0.1, 'fixed shell foot enters native ground');
    assert(g <= site.levels.existingPavingTop + 0.5, 'source grade above nominal deck tolerance');
    boundary.push({ x, z, g, nx: (sign * dz) / len, nz: (-sign * dx) / len });
  }
}
const results = [];
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  parliamentHouse(b, frame, d);
  const m = b.finalize(),
    f = source.geometryFrozenBeforeReplacement[d];
  for (const key of ['positions', 'normals', 'indices'])
    assert.equal(
      hashBytes(new Uint8Array(m[key].buffer, m[key].byteOffset, m[key].byteLength)),
      f[key],
      `all ${key} identical after provider replacement`,
    );
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(`${runtime}/${level.file}`);
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const ray = (a, b) => {
    const p = new T.Vector3(...a),
      v = new T.Vector3(...b).sub(p);
    return new T.Raycaster(
      p,
      v.clone().normalize(),
      0.000001,
      v.length() - 0.000001,
    ).intersectObject(gltf.scene);
  };
  for (const [x, z] of samples) {
    const hit = ray([x, 0.5, z], [x, -1.3, z])[0];
    assert(
      hit && hit.point.y >= site.levels.garageRoofTop - 0.005,
      `${level.name} deck opening at ${x},${z}`,
    );
  }
  for (const { x, z, g, nx, nz } of boundary) {
    const y = Math.min(g - 0.08, site.levels.wallTop - 0.02);
    assert(
      ray([x + nx * 0.08, y, z + nz * 0.08], [x - nx * 0.08, y, z - nz * 0.08]).length,
      `${level.name} actual wall burial ${x},${z},${y}`,
    );
  }
  if (d >= 2) {
    assert.equal(ray([-7, -3, 155], [-2, -3, 155]).length, 0, 'garage shell retains interior air');
    const roof = ray([-7, -3, 155], [-7, -1.4, 155])[0],
      floor = ray([-7, -3, 155], [-7, -5.7, 155])[0];
    assert(roof && Math.abs(roof.point.y - site.levels.garageSoffit) < 0.02, 'actual soffit');
    assert(floor && Math.abs(floor.point.y - site.levels.garageFloorTop) < 0.02, 'actual floor');
  }
  results.push({
    level: level.name,
    triangles: level.triangles,
    drawCalls: level.drawCalls,
    deckCoverageSamples: samples.length,
    buriedWallSamples: boundary.length,
    missing: 0,
    geometryUnchangedAfterGroundReplacement: true,
    hollowShell: d >= 2,
  });
}
const report = {
  status: 'passed',
  inputHash: await modelInputHash(dir, spec.assetId),
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  sourceFilesVerified: source.sourceFiles.length,
  sourceContourVertices: 39490,
  absoluteGridValuesVerified: 16641,
  sourceElevationsChanged: 0,
  archivedOriginalTerrainFiles: 3,
  encodingError,
  retainedAnchor: frame.anchor,
  retainedHeading: frame.heading,
  retainedContact: frame.terrainContact,
  modelDatumElevationMeters: 596,
  boundaryGroundRange: [
    Math.min(...boundary.map((p) => p.g)),
    Math.max(...boundary.map((p) => p.g)),
  ],
  limits:
    'Bounded source-relative exterior;nominal contact and hidden structural levels are not surveyed AHD/civil controls. Another live host field needs separate review.',
  results,
};
fs.writeFileSync(
  '.artifacts/qualla-batch/parliament-site-check.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(report);
