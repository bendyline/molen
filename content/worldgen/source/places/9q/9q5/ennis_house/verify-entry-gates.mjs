/** Imported solid gates, source-supported entrance levels and retained exterior geometry. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  ennis,
  ennisDistrict,
  ennisSkyline,
  ennisStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-ennis-house.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q5/ennis_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-entrance-surroundings.json'),
  c = read('gate-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [ennisSkyline, ennisDistrict, ennisStreet, ennis].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Ennis source${d}`);
  const h = createHash('sha256');
  let retainedTriangles = 0,
    ironTriangles = 0,
    wallTriangles = 0;
  for (const g of source.groups) {
    if (['gateIron', 'gateWall'].includes(g.slot)) {
      if (g.slot === 'gateIron') ironTriangles += g.count / 3;
      else wallTriangles += g.count / 3;
      // Every new face has a surface-aligned non-degenerate metric UV triangle.
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const q = Array.from(source.indices.slice(k, k + 3)).map((i) =>
            Array.from(source.uvs.slice(i * 2, i * 2 + 2)),
          ),
          area =
            (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
        assert(Math.abs(area) > 1e-10, `metric UV ${g.slot}:${k}`);
      }
    }
    for (let k = g.start; k < g.start + g.count; k += 3) {
      const ids = Array.from(source.indices.slice(k, k + 3));
      if (
        ids.some((i) =>
          [0, 1, 2].every(
            (j) =>
              source.positions[i * 3 + j] >= base.box[0][j] &&
              source.positions[i * 3 + j] <= base.box[1][j],
          ),
        )
      )
        continue;
      h.update(g.slot);
      for (const i of ids) {
        for (const [key, stride] of [
          ['positions', 3],
          ['normals', 3],
          ['uvs', 2],
          ['colors', 3],
        ]) {
          const a = source[key].slice(i * stride, i * stride + stride);
          h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
        }
      }
      retainedTriangles++;
    }
  }
  assert.equal(`sha256:${h.digest('hex')}`, base.levels[d].attributeHash);
  assert.equal(retainedTriangles, base.levels[d].retainedTriangles);
  assert.equal(ironTriangles, d === 3 ? 3384 : 0);
  assert.equal(wallTriangles, d === 3 ? 72 : 0);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0,
    ironSurface = false,
    wallSurface = false;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Ennis import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (
        JSON.stringify(m.userData).includes('metal_painted') &&
        Math.abs(m.roughness - 0.68) < 0.000001 &&
        Math.abs(m.metalness - 0.4) < 0.000001
      )
        ironSurface = true;
      if (JSON.stringify(m.userData).includes('concrete_plain')) wallSurface = true;
    }
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
    world = ([x, y, z]) => [
      c.entranceFrame.origin[0] - x,
      y + c.entranceFrame.baseY,
      c.entranceFrame.origin[1] - z,
    ],
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
    zHit = (name, x, y, expected, reverse = false) => {
      const hit = ray(
        [x, y, expected + (reverse ? -0.07 : 0.07)],
        [x, y, expected + (reverse ? 0.04 : -0.04)],
      )[0];
      check(name, !!hit && Math.abs(c.entranceFrame.origin[1] - hit.point.z - expected) < 0.00001, {
        x,
        y,
        expected,
      });
    };
  check('all original attributes outside bounded entrance repair exact', true);
  const vertical = (x, z, y = 8) =>
    new T.Raycaster(new T.Vector3(x, y, z), new T.Vector3(0, -1, 0), 0, 20).intersectObject(
      gltf.scene,
    )[0];
  for (const [z, expected] of [
    [-11.5, 1.5214285714],
    [-9, 1.0514851485],
    [-4, 0.4275],
  ]) {
    const hit = vertical(-20.1, z, 2);
    check(
      'solid sloping entrance floor exists',
      !!hit && Math.abs(hit.point.y - expected) < 0.0001,
      { z, expected, actual: hit?.point.y },
    );
  }
  for (const x of [-23.9, -20.1, -15.6]) {
    for (const z of [-11.8, -8, -2.2]) {
      const hit = vertical(x, z, 2);
      check(
        'bounded ground opening has a matching solid model floor',
        !!hit && hit.point.y >= 0.14 && hit.point.y <= 1.65,
        { x, z, actual: hit?.point.y },
      );
    }
  }
  for (const z of [-9.6, -5.6]) {
    const hit = vertical(-20.1, z);
    check(
      'broad raised bridge retains its observed depth and deck',
      !!hit && Math.abs(hit.point.y - 4.15) < 0.0001,
      { z, actual: hit?.point.y },
    );
  }
  if (d === 3) {
    check('physical iron and masonry bind expected shared surfaces', ironSurface && wallSurface);
    const outer = c.outerWidth / 2,
      inner = outer - c.postWidth,
      leafWidth = inner - 0.01,
      front = c.ironPlaneZ + c.ironDepth / 2,
      back = c.ironPlaneZ - c.ironDepth / 2;
    assert(Math.abs(c.outerWidth - 4.84505) < 1e-8);
    for (const sign of [-1, 1]) {
      const center = sign * (leafWidth / 2 + 0.01),
        left = center - leafWidth / 2,
        right = center + leafWidth / 2;
      for (const [x, y] of [
        [center, c.bottom],
        [center, c.bottom + c.leafHeight],
        [left, 0.5],
        [right, 1.4],
        [center, c.bottom + 0.88],
      ]) {
        zHit('paired leaf member has a physical exposed front', x, y, front);
        zHit('paired leaf member has a closed back', x, y, back, true);
      }
      for (let i = 1; i <= 4; i++) {
        const x = left + (leafWidth * i) / 5;
        zHit('each elongated loop has actual solid depth', x, 1.35, front);
      }
      for (const i of [1.5, 2.5, 3.5]) {
        const x = left + (leafWidth * i) / 5;
        check(
          'paired leaves preserve actual open lattice gaps',
          ray([x, 1.4, 0.4], [x, 1.4, -0.1]).length === 0,
          { x },
        );
      }
      const post = sign * (outer - c.postWidth / 2),
        figureX = post + sign * 0.025;
      zHit('flank figure plate has a physical front', figureX, 1.95, c.ironPlaneZ + 0.06 + 0.0225);
      zHit(
        'flank figure plate is closed at rear',
        figureX,
        1.95,
        c.ironPlaneZ + 0.06 - 0.0225,
        true,
      );
    }
    zHit('continuous upper portal member exists', 0, c.portalHeight - 0.035, front);
    for (const x of [-inner + 0.3, inner - 0.3])
      zHit('stepped corner keywork has physical depth', x, 2.39, front);
    for (const x of [
      c.service.center - c.service.width / 2 + 0.04,
      c.service.center + c.service.width / 2 - 0.04,
    ])
      zHit('service leaf side has physical depth', x, 1.4, front);
    for (const x of [c.service.center - 0.15, c.service.center + 0.15])
      zHit('service elongated loop has physical depth', x, 1.5, front);
    for (const x of [c.service.center - 0.28, c.service.center, c.service.center + 0.28])
      check(
        'service gate masonry opening and lattice stay clear',
        ray([x, 1.5, 0.4], [x, 1.5, -0.1]).length === 0,
        { x },
      );
    for (const [x, y] of [
      [-3.95, 1.4],
      [3.3, 1.4],
      [0, 2.85],
    ])
      zHit('surrounding infill is physical masonry', x, y, c.wallDepth / 2);
    const cap = ray([0, 3.05, 0], [0, 2.95, 0])[0];
    check(
      'masonry lintel has a closed top',
      !!cap && Math.abs(cap.point.y - (3 + c.entranceFrame.baseY)) < 0.00001,
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles,
    ironTriangles,
    wallTriangles,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'ennis_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
