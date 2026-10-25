/** Verify the physical opening against every actual runtime mesh, independently of authoring helpers. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url);
process.chdir(root.pathname);
const read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
const opening = read('ground-opening.json'),
  layout = read('fort-layout.json'),
  registration = read('plan-registration.json');
const runtime = new URL('content/worldgen/assets/places/de/de2/el_morro/', root),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime)));
const inside = (p, r) => {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (
      r[i][1] > p[1] !== r[j][1] > p[1] &&
      p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      yes = !yes;
  }
  return yes;
};
const world = ([u, v], y = 0) => {
  const m = registration.matrixSourcePixelsToLocalXZ,
    t = registration.translationLocalXZ;
  return [m[0][0] * u + m[0][1] * v + t[0], y, m[1][0] * u + m[1][1] * v + t[1]];
};
const points = [];
for (let x = -140; x <= 140; x++)
  for (let z = -140; z <= 140; z++) if (inside([x, z], opening.outline)) points.push([x, z]);
const joints = [];
for (const v of [788, 790, 792, 1292, 1294, 1296])
  for (let u = 1867; u <= 2048; u += 2.5) {
    const [x, , z] = world([u, v]);
    joints.push([x, z]);
  }
for (let v = 800; v <= 1285; v += 5)
  for (const u of [2040, 2048, 2056]) {
    const [x, , z] = world([u, v]);
    joints.push([x, z]);
  }
const results = [],
  failures = [];
for (const level of side.runtimeLods.levels) {
  const bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const buckets = new Map();
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.DoubleSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      idx = o.geometry.index,
      count = idx ? idx.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const q = Array.from({ length: 3 }, (_, j) => {
          const k = idx ? idx.getX(i + j) : i + j;
          return new T.Vector3(p.getX(k), p.getY(k), p.getZ(k))
            .applyMatrix4(o.matrixWorld)
            .toArray();
        }),
        den = (q[1][2] - q[2][2]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][2] - q[2][2]);
      if (Math.abs(den) < 1e-7) continue;
      const t = { q, den },
        xx = q.map((p) => p[0]),
        zz = q.map((p) => p[2]);
      for (let x = Math.floor(Math.min(...xx) / 5); x <= Math.floor(Math.max(...xx) / 5); x++)
        for (let z = Math.floor(Math.min(...zz) / 5); z <= Math.floor(Math.max(...zz) / 5); z++) {
          const key = `${x},${z}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(t);
        }
    }
  });
  const covered = ([x, z]) =>
    (buckets.get(`${Math.floor(x / 5)},${Math.floor(z / 5)}`) ?? []).some(({ q, den }) => {
      const a = ((q[1][2] - q[2][2]) * (x - q[2][0]) + (q[2][0] - q[1][0]) * (z - q[2][2])) / den,
        b = ((q[2][2] - q[0][2]) * (x - q[2][0]) + (q[0][0] - q[2][0]) * (z - q[2][2])) / den;
      return a >= -1e-5 && b >= -1e-5 && a + b <= 1 + 1e-5;
    });
  const missing = points.filter((p) => !covered(p)),
    missingJoints = joints.filter((p) => !covered(p));
  let galleryRays = 0;
  if (level.name !== 'skyline')
    for (const gallery of layout.galleryReturns)
      for (let i = 0; i + 1 < gallery.front.length; i++) {
        const a = world(gallery.front[i], layout.levels.parade + 1.5),
          b = world(gallery.front[i + 1], layout.levels.parade + 1.5),
          axis = new T.Vector3(...b).sub(new T.Vector3(...a)),
          len = axis.length(),
          normal = new T.Vector3(-axis.z, 0, axis.x).normalize(),
          count = Math.max(1, Math.round(len / 5.6));
        for (let j = 0; j < count; j++) {
          const mid = new T.Vector3(...a).addScaledVector(axis, (j + 0.5) / count),
            start = mid.clone().addScaledVector(normal, -0.85),
            hits = new T.Raycaster(start, normal, 0.00001, 1.7).intersectObject(gltf.scene);
          galleryRays++;
          const expectedSolid = gallery.solidSegments?.includes(i) ?? false;
          if (expectedSolid ? hits.length === 0 : hits.length > 0)
            failures.push({
              level: level.name,
              test: expectedSolid
                ? 'Caballero return remains a solid masonry pier'
                : 'gallery is actually open into porch',
              gallery: gallery.name,
              segment: i,
              bay: j,
              first: hits[0].point.toArray(),
            });
        }
      }
  if (missing.length || missingJoints.length)
    failures.push({
      level: level.name,
      test: 'opening has physical structure coverage',
      missing: missing.slice(0, 10),
      missingJoints: missingJoints.slice(0, 10),
    });
  results.push({
    level: level.name,
    hash: level.hash,
    gridProbes: points.length,
    missingGrid: missing.length,
    criticalJointProbes: joints.length,
    missingJoints: missingJoints.length,
    galleryRays,
  });
}
const report = {
  format: 'molen/structure-opening-geometry-review@1',
  status: failures.length ? 'failed' : 'passed',
  assetId: side.id,
  runtimeHash: side.hash,
  recipeHash: side.runtimeLods.recipeHash,
  openingHash: hashBytes(fs.readFileSync(new URL('ground-opening.json', dir))),
  levels: results,
  failures,
  limitations: [
    'Sampled1m coverage plus sub-metre gallery/curtain joins, not a construction survey or general navigable interior claim.',
    'All geometry is from imported runtime GLBs. Successful geometry alone does not certify geographic placement or image fidelity.',
  ],
};
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else console.log(report);
assert.equal(failures.length, 0, 'Physical ground opening has gaps or blocked gallery porches');
