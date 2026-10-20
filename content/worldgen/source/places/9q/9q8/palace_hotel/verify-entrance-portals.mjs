/** Verify real imported entrance recesses without changing the surrounding hotel. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  palace,
  palaceDistrict,
  palaceSkyline,
  palaceStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-palace-hotel.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q8/palace_hotel/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('portal-construction-controls.json'),
  base = read('retained-portal-surroundings.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  local = ([x, y, z]) => [z, y, -x - 39.46],
  world = ([x, y, z]) => [-39.46 - z, y, x],
  inside = (ps) =>
    ps
      .map(local)
      .every(
        (p) =>
          Math.abs(p[2]) < 0.0001 &&
          p[1] >= -0.0001 &&
          p[1] <= 6.2001 &&
          p[0] >= -51.201 &&
          p[0] <= 48.801,
      ) ||
    ps
      .map(local)
      .every(
        (p) =>
          Math.abs(p[0]) <= 9 && p[1] >= -0.201 && p[1] <= 5.951 && p[2] >= -0.9 && p[2] <= 4.01,
      );
for (const [name, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(name, dir))), h);
const results = [];
for (const [d, build] of [palaceSkyline, palaceDistrict, palaceStreet, palace].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Palace source ${d}`);
  const hash = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3));
    if (d === 3 && inside(ids.map((i) => Array.from(source.positions.slice(i * 3, i * 3 + 3)))))
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
      `Palace import ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
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
    };
  check('exact lower levels or original geometry outside bounded wall/portal region', true);
  if (d === 3) {
    for (const [x, w] of c.portals) {
      check(
        'actual opening cut into front structural wall',
        ray([x + 0.3, 1.7, 0.04], [x + 0.3, 1.7, -0.56]).length === 0,
        { x },
      );
      const glass = ray([x + 0.3, 1.7, -0.57], [x + 0.3, 1.7, -0.8]);
      check(
        'recessed rear glazing closes portal',
        glass.length > 0 && Math.abs(local(glass[0].point.toArray())[2] + c.depth) < 0.0001,
        { x },
      );
      const post = ray([x, 1.7, -0.5], [x, 1.7, -0.7]);
      check(
        'physical central door frame ahead of glazing',
        post.length > 0 &&
          Math.abs(local(post[0].point.toArray())[2] - (-c.depth + c.doorFrameDepth)) < 0.0001,
        { x },
      );
      for (const sg of [-1, 1]) {
        const jamb = ray(
          [x + sg * (w / 2 - 0.03), 1.7, -0.35],
          [x + sg * (w / 2 + 0.03), 1.7, -0.35],
        );
        check(
          'physical stone recess jamb',
          jamb.length > 0 &&
            Math.abs(Math.abs(local(jamb[0].point.toArray())[0] - x) - w / 2) < 0.0001,
          { x, sg },
        );
      }
      const soffit = ray([x, 5.25, -0.35], [x, 5.5, -0.35]);
      check(
        'physical curved stone soffit above opening',
        soffit.length > 0 && Math.abs(soffit[0].point.y - c.top) < 0.0001,
        { x },
      );
      const floor = ray([x + 0.3, 0.04, -0.35], [x + 0.3, -0.04, -0.35]);
      check(
        'original foundation floor supports portal',
        floor.length > 0 && Math.abs(floor[0].point.y) < 0.0001,
        { x },
      );
      for (const drop of [0, c.transomDrop])
        for (const i of [3, 7, 11]) {
          const a = Math.PI - (i * Math.PI) / c.archSegments,
            b = Math.PI - ((i + 1) * Math.PI) / c.archSegments,
            px = x + (w * (Math.cos(a) + Math.cos(b))) / 4,
            py =
              c.top -
              w * c.archRiseFactor +
              (w * c.archRiseFactor * (Math.sin(a) + Math.sin(b))) / 2 -
              drop,
            hit = ray([px, py, -0.5], [px, py, -0.7]);
          check(
            'closed curved outer and transom frame sections',
            hit.length > 0 && local(hit[0].point.toArray())[2] > -c.depth + 0.1,
            { x, drop, segment: i },
          );
        }
    }
    for (const x of [-30, -15, 15, 30]) {
      const hit = ray([x, 5.5, 0.04], [x, 5.5, -0.04]);
      check(
        'surrounding ground-floor front wall remains closed',
        hit.length > 0 && Math.abs(local(hit[0].point.toArray())[2]) < 0.0001,
        { x },
      );
    }
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
      model: 'palace_hotel',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
