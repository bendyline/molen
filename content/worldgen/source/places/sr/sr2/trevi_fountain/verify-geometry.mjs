/** Read-only actual runtime checks: native plans, architectural negative space and physical floor coverage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import { treviFountain } from '../../../../../../../packages/worldgen/scripts/structure-trevi-fountain.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  runtime = new URL('content/worldgen/assets/places/sr/sr2/trevi_fountain/', root),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  frame = read('map-frame.json'),
  opening = read('ground-opening.json'),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:5ad5261fa89cd7127ed48a3250cd348c0c24d2a92213d3c2035fb12ae14804bb',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:10d15ec65bfbda5b85b5f62c19957255fd9affd2fed16fcabc58add232429740',
);
const inside = (p, r) => {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > p[1] !== r[j][1] > p[1] &&
      p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      yes = !yes;
  return yes;
};
const probes = [];
for (let x = -26; x <= 26; x += 0.5)
  for (let z = -4; z <= 29; z += 0.5) if (inside([x, z], opening.outline)) probes.push([x, z]);
const results = [],
  failures = [];
for (let d = 0; d < 4; d++) {
  const source = new MeshBufferBuilder();
  treviFountain(source, undefined, d);
  const m = source.finalize();
  validateAuthoredMesh(m, `Trevi source ${d}`);
  assert(m.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const vertices = [],
    buckets = new Map();
  let count = 0;
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        mat.side = T.DoubleSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Trevi runtime ${d}`,
    );
    count += idx.length / 3;
    for (let i = 0; i < p.count; i++) vertices.push([p.getX(i), p.getY(i), p.getZ(i)]);
    for (let i = 0; i < idx.length; i += 3) {
      const q = Array.from({ length: 3 }, (_, j) => {
          const k = idx[i + j];
          return new T.Vector3(p.getX(k), p.getY(k), p.getZ(k))
            .applyMatrix4(o.matrixWorld)
            .toArray();
        }),
        den = (q[1][2] - q[2][2]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][2] - q[2][2]);
      if (Math.abs(den) < 1e-8) continue;
      const xx = q.map((p) => p[0]),
        zz = q.map((p) => p[2]);
      for (let x = Math.floor(Math.min(...xx) / 4); x <= Math.floor(Math.max(...xx) / 4); x++)
        for (let z = Math.floor(Math.min(...zz) / 4); z <= Math.floor(Math.max(...zz) / 4); z++) {
          const key = `${x},${z}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push({ q, den });
        }
    }
  });
  assert.equal(count, level.triangles);
  const covered = ([x, z]) =>
    (buckets.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []).some(({ q, den }) => {
      const a = ((q[1][2] - q[2][2]) * (x - q[2][0]) + (q[2][0] - q[1][0]) * (z - q[2][2])) / den,
        b = ((q[2][2] - q[0][2]) * (x - q[2][0]) + (q[0][0] - q[2][0]) * (z - q[2][2])) / den;
      return a >= -1e-5 && b >= -1e-5 && a + b <= 1 + 1e-5;
    });
  const missing = probes.filter((p) => !covered(p));
  if (missing.length)
    failures.push({
      level: level.name,
      name: 'physical opening has continuous model-owned floor/base coverage',
      missing: missing.length,
      first: missing.slice(0, 20),
    });
  const ray = (a, b) => {
    const origin = new T.Vector3(...a),
      v = new T.Vector3(...b).sub(origin);
    return new T.Raycaster(
      origin,
      v.clone().normalize(),
      0.00001,
      v.length() - 0.00001,
    ).intersectObject(gltf.scene);
  };
  const controls = [];
  for (const x of [-0.8, 0, 0.8])
    for (const y of [9.5, 10])
      controls.push(
        {
          name: 'central niche is deep and open',
          x,
          y,
          pass: ray([x, y, 2], [x, y, -2]).length === 0,
        },
        {
          name: 'niche has actual rear masonry',
          x,
          y,
          pass: ray([x, y, -2], [x, y, -4.2]).length > 0,
        },
      );
  for (const x of [-7.45, 7.45])
    controls.push(
      {
        name: 'side statue niche has depth',
        x,
        pass: ray([x, 8.6, 0.8], [x, 8.6, -0.9]).length === 0,
      },
      {
        name: 'side statue niche has closed rear',
        x,
        pass: ray([x, 8.6, -0.9], [x, 8.6, -2]).length > 0,
      },
    );
  for (const c of controls) if (!c.pass) failures.push({ level: level.name, ...c });
  let planError = 0;
  for (const [x, z] of frame.geometry.outline.slice(0, -1)) {
    const p = [x, -3.25, z];
    planError = Math.max(
      planError,
      vertices.reduce((v, q) => Math.min(v, Math.hypot(...p.map((x, i) => x - q[i]))), Infinity),
    );
  }
  assert(planError < 0.0001);
  let basinError = 0;
  if (d > 0) {
    for (const [x, z] of frame.geometry.waterOutline.slice(0, -1)) {
      const p = [x, -1.49, z];
      basinError = Math.max(
        basinError,
        vertices.reduce((v, q) => Math.min(v, Math.hypot(...p.map((x, i) => x - q[i]))), Infinity),
      );
    }
    assert(basinError < 0.0001);
  }
  results.push({
    level: level.name,
    hash: level.hash,
    triangles: count,
    drawCalls: level.drawCalls,
    sourceTriangles: m.triangleCount,
    physicalOpeningProbes: probes.length,
    missingCoverage: missing.length,
    negativeSpaceControls: controls.length,
    nativeSiteMaximumFloat32ErrorMeters: planError,
    nativeBasinMaximumFloat32ErrorMeters: d > 0 ? basinError : null,
  });
}
const report = {
  format: 'molen/structure-geometry-review@1',
  assetId: side.id,
  status: failures.length ? 'needs-revision' : 'passed',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  lodRecipeHash: side.runtimeLods.recipeHash,
  openingHash: hashBytes(fs.readFileSync(new URL('ground-opening.json', dir))),
  levels: results,
  failures,
  limitations: [
    'Half-metre sampled physical coverage and specific rays prove these controls, not complete manifold topology or walkable interior/collision.',
    'Native map width and basin traces are quantized controls; sculpture/ornament and vertical levels remain photo interpretations. Actual visual and geographic reviews are separate.',
  ],
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
