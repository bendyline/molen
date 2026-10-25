/** Imported physical relief, exact retained lower geometry, and original site. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  biltmoreDistrict,
  biltmoreSkyline,
  biltmoreStreet,
  hotel,
} from '../../../../../../../packages/worldgen/scripts/structure-arizona-biltmore.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9t/9tb/arizona_biltmore/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
async function load(level) {
  const bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const g = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  g.scene.updateMatrixWorld(true);
  return g;
}
function fingerprint(g, excludeCopper = false) {
  const h = createHash('sha256');
  g.scene.traverse((o) => {
    if (!o.geometry) return;
    if (excludeCopper && o.material.name === 'metal_copper') return;
    for (const name of ['position', 'normal', 'uv', 'color']) {
      const a = o.geometry.getAttribute(name)?.array;
      h.update(name);
      if (a) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    }
    const a = o.geometry.index?.array;
    h.update('index');
    if (a) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  });
  return `sha256:${h.digest('hex')}`;
}
if (process.argv.includes('--record-lower')) {
  const file = new URL('retained-lower-detail-controls.json', dir);
  assert(!fs.existsSync(file), 'Do not replace the pre-construction geometry baseline');
  const levels = [];
  for (const l of side.runtimeLods.levels.slice(0, 3))
    levels.push({
      level: l.name,
      originalFileHash: l.hash,
      geometryAttributesHash: fingerprint(await load(l)),
      triangles: l.triangles,
    });
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        format: 'molen/retained-geometry-controls@1',
        recordedOn: '2026-10-18',
        baselineSourceHash: side.sourceHash,
        baselineRuntimeHash: side.hash,
        scope:
          'Original pre-relief skyline/district/street position, normal, UV, color and index arrays, excluding GLB metadata.',
        levels,
      },
      null,
      2,
    )}\n`,
  );
  console.log('Recorded exact pre-construction lower-detail geometry');
  process.exit(0);
}
const baseline = read('retained-lower-detail-controls.json'),
  results = [];
if (process.argv.includes('--record-street-surfaces')) {
  const g = await load(side.runtimeLods.levels[2]),
    file = new URL('retained-street-surfaces.json', dir);
  assert(!fs.existsSync(file), 'Do not replace the original street surface baseline');
  assert.equal(fingerprint(g), baseline.levels[2].geometryAttributesHash);
  fs.writeFileSync(
    file,
    `${JSON.stringify({ format: 'molen/retained-geometry-controls@1', recordedOn: '2026-10-18', originalFullGeometryAttributesHash: fingerprint(g), nonCopperGeometryAttributesHash: fingerprint(g, true), excludedSurface: 'metal_copper', scope: 'Original street attributes proven equal to the pre-construction baseline before clipping only copper rafters at the tower walls.' }, null, 2)}\n`,
  );
  console.log('Recorded original street non-copper surface geometry');
  process.exit(0);
}
const streetSurfaces = read('retained-street-surfaces.json');
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
for (const [d, build] of [biltmoreSkyline, biltmoreDistrict, biltmoreStreet, hotel].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Biltmore source ${d}`);
  assert(source.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    g = await load(level);
  let triangles = 0,
    physicalSideTriangles = 0;
  g.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Biltmore runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    for (let k = 0; k < idx.length; k += 3) {
      const ps = [idx[k], idx[k + 1], idx[k + 2]].map((i) => [p.getX(i), p.getY(i), p.getZ(i)]),
        zs = ps.map((p) => p[2]);
      if (
        ps.some((p) => Math.abs(p[2] - 19.995) < 0.0002) &&
        Math.max(...zs) > 20.075 &&
        Math.max(...zs) < 20.105 &&
        ps.every((p) => p[1] > 8.05 && p[1] < 12.3 && p[0] > -9.15 && p[0] < -6.4)
      )
        physicalSideTriangles++;
    }
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
  const controls = [],
    ray = (a, b) => {
      const q = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(q);
      return new T.Raycaster(
        q,
        v.clone().normalize(),
        0.000001,
        v.length() - 0.000001,
      ).intersectObject(g.scene);
    },
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    };
  if (d < 2)
    check(
      'exact original lower geometry attribute fingerprint retained',
      fingerprint(g) === baseline.levels[d].geometryAttributesHash,
      { expected: baseline.levels[d].geometryAttributesHash },
    );
  check(
    'all72modules have six solid strips with four physical side faces',
    physicalSideTriangles === (d === 3 ? 3456 : 0),
    { physicalSideTriangles },
  );
  check('retained open porte-cochere air', ray([-19.5, 2, 56], [-19.5, 4.3, 56]).length === 0);
  const canopy = ray([-19.5, 4.4, 56], [-19.5, 4.9, 56])[0];
  check(
    'retained solid entrance canopy underside',
    !!canopy && Math.abs(canopy.point.y - 4.75) < 0.002,
    { y: canopy?.point.y },
  );
  check('retained historic tower roof', ray([-7.8, 22, 17], [-7.8, 18, 17]).length > 0);
  if (d === 2)
    check(
      'all original street non-copper geometry attributes retained',
      fingerprint(g, true) === streetSurfaces.nonCopperGeometryAttributesHash,
    );
  if (d > 1) {
    for (const x of [-9.5, -7.8, -4.4, 24.5, 26.2]) {
      const end = x < -0.8 && x > -5.6 ? 19.56 : 20.16;
      check(
        'copper rafters terminate within the solid tower walls',
        ray([x, 10.65, 21.1], [x, 10.65, end]).filter(
          (h) => h.object.material.name === 'metal_copper',
        ).length === 0,
        { x },
      );
    }
    const h = ray([10.05, 10.65, 21.1], [10.05, 10.65, 20.5]).find(
      (h) => h.object.material.name === 'metal_copper',
    );
    check(
      'unblocked veranda rafter retains original projection',
      !!h && Math.abs(h.point.z - 20.7) < 0.002,
      { z: h?.point.z },
    );
  }
  if (d === 3)
    for (const i of [3, 5, 6, 8])
      for (const j of [0, 5, 11]) {
        const x = -10.5 + (i + 0.5) * 0.45,
          y = 8.1 + (j + 0.5) * 0.345,
          s = (i + j) % 2 ? 1 : -1;
        for (let k = 0; k < 3; k++)
          for (const leg of [-1, 1]) {
            const r = 0.15 - k * 0.042,
              a = [x + leg * r, y + s * (0.12 - k * 0.015), 20.08],
              b = [x, y - s * (0.12 - k * 0.06), 20.1],
              mid = a.map((v, k) => (v + b[k]) / 2),
              h = ray([mid[0], mid[1], 20.15], [mid[0], mid[1], 20.075])[0];
            check('physical stepped rib top', !!h && Math.abs(h.point.z - 20.09) < 0.0005, {
              tile: [i, j],
              rib: k,
              leg,
              z: h?.point.z,
            });
            const dx = b[0] - a[0],
              dy = b[1] - a[1],
              len = Math.hypot(dx, dy),
              nx = -dy / len,
              ny = dx / len,
              sideHit = ray(
                [mid[0] + nx * 0.04, mid[1] + ny * 0.04, 20.08],
                [mid[0], mid[1], 20.08],
              )[0];
            check('actual inward-facing rib side depth', !!sideHit, { tile: [i, j], rib: k, leg });
          }
        const gapY = y + s * 0.0272916666667;
        check(
          'open trough ahead of underlying wall between stepped ribs',
          ray([x - 0.075, gapY, 20.15], [x - 0.075, gapY, 20.075]).length === 0,
          { tile: [i, j] },
        );
      }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass).length,
    physicalSideTriangles,
    geometryAttributesHash: fingerprint(g),
    controlResults: controls,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: site.retainedInputs,
      baselineSourceHash: baseline.baselineSourceHash,
      results,
      scope:
        '72three-rib physical concrete relief modules; actual top/side/trough probes,3456side triangles attached to original wall, exact skyline/district and street non-copper geometry fingerprints, clipped tower rafters, retained canopy/tower and original map/ground. Motif, depths and current condition remain approximations, not exact mold replication.',
    },
    null,
    2,
  ),
);
