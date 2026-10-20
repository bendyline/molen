/** Test the imported paired stair solids and preserve the original hotel outside them. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  banff,
  banffDistrict,
  banffSkyline,
  banffStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-banff-springs-hotel.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/c3/c3j/banff_springs_hotel/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('stair-construction-controls.json'),
  base = read('retained-stair-surroundings.json'),
  c = site.stairs,
  rise = c.stepsPerFlight * c.risePerStep,
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  co = Math.cos(site.pavilionFrame.angle),
  si = Math.sin(site.pavilionFrame.angle),
  [ox, oz] = site.pavilionFrame.origin,
  world = ([x, y, z]) => [ox + co * x + si * z, y, oz - si * x + co * z],
  local = ([x, y, z]) => [co * (x - ox) - si * (z - oz), y, si * (x - ox) + co * (z - oz)],
  inside = (ps) =>
    ps
      .map(local)
      .every((p) =>
        ['x', 'y', 'z'].every(
          (key, i) =>
            p[i] >= base.excludedAtStreetAndClose[key][0] &&
            p[i] <= base.excludedAtStreetAndClose[key][1],
        ),
      ),
  direction = (a, b) => {
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / n, (b[1] - a[1]) / n];
  },
  shift = (a, u, t) => [a[0] + u[0] * t, a[1] + u[1] * t];

for (const [name, hash] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(name, dir))), hash);
const results = [];
for (const [d, build] of [banffSkyline, banffDistrict, banffStreet, banff].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Banff source ${d}`);
  const hash = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3));
    if (d > 1 && inside(ids.map((i) => Array.from(source.positions.slice(i * 3, i * 3 + 3)))))
      continue;
    retainedTriangles++;
    for (const i of ids)
      for (const [key, stride] of [
        ['positions', 3],
        ['normals', 3],
        ['uvs', 2],
        ['colors', 3],
      ]) {
        const a = source[key].slice(i * stride, i * stride + stride);
        hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
  }
  assert.equal(`sha256:${hash.digest('hex')}`, base.levels[d].attributeHash, `retained ${d}`);
  assert.equal(retainedTriangles, base.levels[d].retainedTriangles);
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
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Banff import ${d}`,
    );
    triangles += idx.length / 3;
    for (const material of Array.isArray(o.material) ? o.material : [o.material])
      material.side = T.FrontSide;
  });
  assert.equal(triangles, source.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 6, 8, 8][d]);
  const checks = [],
    check = (name, pass, data = {}) => {
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
      checks.push({ name, pass, ...data });
    },
    ray = (a, b) => {
      const p = new T.Vector3(...world(a)),
        v = new T.Vector3(...world(b)).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.000001,
        v.length() - 0.000001,
      ).intersectObject(gltf.scene);
    },
    floor = (p, expected) => {
      const hit = ray([p[0], expected + 0.04, p[1]], [p[0], expected - 0.04, p[1]]);
      return hit.length > 0 && Math.abs(hit[0].point.y - expected) < 0.0001;
    };
  check('exact original geometry outside south stair and lowest bay window region', true);
  if (d > 1) {
    for (const branch of c.sides) {
      const u = direction(branch.foot, branch.middle),
        v = direction(branch.middle, branch.upper),
        lowEnd = shift(branch.middle, u, -c.turnSetback),
        upperStart = shift(branch.middle, v, c.turnSetback);
      for (const [flight, a, end, y] of [
        ['lower', branch.foot, lowEnd, 0],
        ['upper', upperStart, branch.upper, rise],
      ]) {
        const f = direction(a, end),
          length = Math.hypot(end[0] - a[0], end[1] - a[1]),
          pt = (x, yy, z) => [a[0] + f[1] * x + f[0] * z, yy, a[1] - f[0] * x + f[1] * z];
        for (let i = 0; i < c.stepsPerFlight; i++) {
          const z = ((i + 0.5) * length) / c.stepsPerFlight,
            top = y + (i + 1) * c.risePerStep,
            p = pt(0.13, top, z);
          check('each actual tread has a solid upward surface', floor([p[0], p[2]], top), {
            branch: branch.sign,
            flight,
            tread: i,
          });
          const riser = ray(
            pt(0.13, top - 0.07, (i * length) / c.stepsPerFlight - 0.02),
            pt(0.13, top - 0.07, (i * length) / c.stepsPerFlight + 0.02),
          );
          check('each actual tread has a closed riser', riser.length > 0, {
            branch: branch.sign,
            flight,
            tread: i,
          });
        }
        for (const sg of [-1, 1]) {
          const z = length * 0.43,
            h = y + rise * 0.43,
            x = sg * (c.width / 2 + c.wallThickness / 2),
            wallHit = ray(pt(sg * 0.7, h + 0.4, z), pt(sg * 1.13, h + 0.4, z)),
            capHit = ray(
              pt(x, h + c.wallHeight + c.capThickness + 0.04, z),
              pt(x, h + c.wallHeight - 0.04, z),
            );
          check('solid sloping side parapet', wallHit.length > 0, {
            branch: branch.sign,
            flight,
            sg,
          });
          check(
            'physical pale parapet cap',
            capHit.length > 0 &&
              Math.abs(capHit[0].point.y - h - c.wallHeight - c.capThickness) < 0.0001,
            { branch: branch.sign, flight, sg },
          );
        }
      }
      const mid = [(lowEnd[0] + upperStart[0]) / 2, (lowEnd[1] + upperStart[1]) / 2],
        top = shift(branch.upper, v, 0.22);
      check('solid turn landing between both flights', floor(mid, rise), { branch: branch.sign });
      check('solid upper landing connects toward projecting bay', floor(top, rise * 2), {
        branch: branch.sign,
      });
      for (const [port, portDirection] of [
        [lowEnd, u],
        [upperStart, v],
      ]) {
        const a = shift(port, portDirection, -0.04),
          b = shift(port, portDirection, 0.04);
        check(
          'turn landing stair port is open above the floor',
          ray([a[0], rise + 0.3, a[1]], [b[0], rise + 0.3, b[1]]).length === 0,
          { branch: branch.sign, port },
        );
      }
    }
    check(
      'removed old central straight flight leaves the space between paired stairs open',
      ray([0, 0.5, 18.5], [0, 0.5, 20.8]).length === 0,
    );
    check(
      'retained central projecting bay wall behind stairs',
      ray([0.3, 4.1, 16], [0.3, 4.1, 15.4]).length > 0,
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    addedTriangles: triangles - base.levels[d].originalTriangles,
    retainedTriangles,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'banff_springs_hotel',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: site.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
