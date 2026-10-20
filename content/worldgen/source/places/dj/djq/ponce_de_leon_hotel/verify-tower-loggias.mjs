/** Imported five-bay tower openings and real spiral shafts, preserving other geometry. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  ponce,
  ponceDistrict,
  ponceSkyline,
  ponceStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-ponce-de-leon-hotel.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dj/djq/ponce_de_leon_hotel/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('loggia-construction-controls.json'),
  base = read('retained-towers-and-upper-gallery.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
const inside = (ps) =>
    ps.every(
      (p) =>
        Math.abs(p[0]) <= 9.6001 &&
        p[1] >= 23.3999 &&
        p[1] <= 28.7001 &&
        p[2] >= -20.6501 &&
        p[2] <= -0.6499,
    ) ||
    site.towers.some(([x, z]) =>
      ps.every(
        (p) =>
          Math.abs(p[0] - x) < 4.25 &&
          Math.abs(p[2] - z) < 4.25 &&
          p[1] >= 31.0999 &&
          p[1] <= 36.431,
      ),
    ),
  transform = ([x, z], a, p) => [
    x + Math.cos(a) * p[0] + Math.sin(a) * p[2],
    p[1],
    z - Math.sin(a) * p[0] + Math.cos(a) * p[2],
  ],
  shaftCenters = site.towers.flatMap((t) =>
    Array.from({ length: 4 }, (_, k) =>
      Array.from({ length: 4 }, (_, i) =>
        transform(t, (k * Math.PI) / 2, [-3.85 + (i + 1) * 1.54, 0, 3.85]),
      ),
    ).flat(),
  );
assert.equal(
  hashBytes(fs.readFileSync(new URL('retained-loggia-surroundings.json', dir))),
  base.originalBaselineHash,
);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [ponceSkyline, ponceDistrict, ponceStreet, ponce].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Ponce source ${d}`);
  const hash = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3));
    if (d > 0 && inside(ids.map((i) => Array.from(source.positions.slice(i * 3, i * 3 + 3)))))
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
  assert.equal('sha256:' + hash.digest('hex'), base.levels[d].attributeHash);
  assert.equal(retainedTriangles, base.levels[d].retainedTriangles);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0,
    shaftSideTriangles = 0,
    shaftCapTriangles = 0;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Ponce import ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    for (let k = 0; k < idx.length; k += 3) {
      const ps = Array.from(idx.slice(k, k + 3), (i) => [p.getX(i), p.getY(i), p.getZ(i)]);
      if (
        !shaftCenters.some((c) =>
          ps.every(
            (p) =>
              p[1] >= 31.6199 && p[1] <= 35.3501 && Math.hypot(p[0] - c[0], p[2] - c[2]) < 0.1401,
          ),
        )
      )
        continue;
      const dy = Math.max(...ps.map((p) => p[1])) - Math.min(...ps.map((p) => p[1]));
      if (dy > 0.01) shaftSideTriangles++;
      else shaftCapTriangles++;
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
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.000001,
        v.length() - 0.000001,
      ).intersectObject(gltf.scene);
    };
  check('exact skyline or original surrounding attributes retained', true);
  if (d > 1)
    for (const tower of site.towers)
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2,
          pt = (p) => transform(tower, a, [p[0], p[1], p[2] + 3.85]);
        for (let i = 0; i < 5; i++) {
          const x = -3.85 + (i + 0.5) * 1.54;
          check(
            'five actual open bays per tower face',
            ray(pt([x, 34, 0.4]), pt([x, 34, -0.4])).length === 0,
            { tower: tower[0], face: k, bay: i },
          );
          const soffit = ray(pt([x, 35.9, 0]), pt([x, 36.19, 0]));
          check(
            'arched covered soffit above each open bay',
            soffit.length > 0 &&
              Math.abs(soffit[0].point.y - (d === 2 ? 35.57 + (0.58 * Math.sqrt(3)) / 2 : 36.15)) <
                0.0001,
            { face: k, bay: i },
          );
          const floor = ray(pt([x, 31.45, -0.3]), pt([x, 31.15, -0.3]));
          check(
            'retained loggia floor closes beneath openings',
            floor.length > 0 && Math.abs(floor[0].point.y - 31.35) < 0.0001,
            { face: k, bay: i },
          );
        }
        for (let i = 1; i < 5; i++) {
          const x = -3.85 + i * 1.54,
            hit = ray(pt([x, 34, 0.5]), pt([x, 34, -0.5]));
          check('physical shaft supports each interior springing', hit.length > 0, {
            face: k,
            column: i,
          });
          if (d === 3) {
            const front = hit[0],
              projection =
                (front.point.x - tower[0]) * Math.sin(a) +
                (front.point.z - tower[1]) * Math.cos(a) -
                3.85;
            check(
              'spiral relief visible ahead of any flat arch trim',
              projection > 0.099 && projection < 0.141,
              { face: k, column: i, projection },
            );
          }
        }
      }
  if (d === 3) {
    check('32spiral shafts have actual side triangles', shaftSideTriangles === 11520, {
      shaftSideTriangles,
    });
    check('all spiral shafts have closed end caps', shaftCapTriangles === 640, {
      shaftCapTriangles,
    });
    for (const c of shaftCenters) {
      const hit = ray([c[0], 34, c[2] + 0.5], [c[0], 34, c[2] - 0.5]);
      check('closed shaft solid at intermediate height', hit.length > 0, { center: c });
    }
  }
  if (d > 1)
    for (const [x, z] of site.towers) {
      const core = ray([x, 34, z + 3.2], [x, 34, z + 1.9]),
        expected = z + (d === 2 ? (2.4 * Math.sqrt(3)) / 2 : 2.4);
      check(
        'recessed white enclosure behind the tower colonnade',
        core.length > 0 && Math.abs(core[0].point.z - expected) < 0.0001,
        { tower: x },
      );
    }
  if (d > 0)
    for (const x of site.centralUpperGallery.centers) {
      if (d < 3) {
        const hit = ray([x, 26, 0], [x, 26, -1]);
        check(
          'nine upper front arch silhouettes at lower levels',
          hit.length > 0 && Math.abs(hit[0].point.z + (d === 2 ? 0.83 : 0.87)) < 0.0001,
          { x },
        );
      } else {
        check(
          'upper gallery arch opening has real depth',
          ray([x, 26, 0], [x, 26, -1.95]).length === 0,
          { x },
        );
        const pane = ray([x + 0.2, 26, -1.9], [x + 0.2, 26, -2.099]);
        check(
          'recessed rear glazing behind each gallery arch',
          pane.length > 0 && Math.abs(pane[0].point.z + 2.095) < 0.0001,
          { x },
        );
        const mullion = ray([x, 26, -1.9], [x, 26, -2.09]);
        check(
          'physical lead frame ahead of rear glazing',
          mullion.length > 0 && Math.abs(mullion[0].point.z + 2.055) < 0.0001,
          { x },
        );
        const back = ray([x + 0.2, 26, -2.096], [x + 0.2, 26, -2.2]);
        check(
          'closed room wall behind open gallery',
          back.length > 0 && Math.abs(back[0].point.z + 2.1) < 0.0001,
          { x },
        );
        const soffit = ray([x, 27.35, -1.4], [x, 27.65, -1.4]);
        check(
          'curved upper gallery soffit',
          soffit.length > 0 && Math.abs(soffit[0].point.y - 27.5) < 0.0001,
          { x },
        );
        const floor = ray([x, 24.15, -1.4], [x, 23.9, -1.4]);
        check(
          'physical upper gallery sill floor',
          floor.length > 0 && Math.abs(floor[0].point.y - 24) < 0.0001,
          { x },
        );
        for (const sg of [-1, 1]) {
          const jamb = ray([x + sg * 0.62, 26, -1.4], [x + sg * 0.72, 26, -1.4]);
          check(
            'physical upper gallery jamb',
            jamb.length > 0 && Math.abs(jamb[0].point.x - x - sg * 0.675) < 0.0001,
            { x, sg },
          );
        }
        if (d === 3)
          for (let i = 0; i < 8; i++) {
            const x = -6.1 + ((i + 0.5) * 12.2) / 8,
              hit = ray([x, 25.7, 0], [x, 25.7, -0.9]);
            check(
              'central spiral shaft has projecting physical relief',
              hit.length > 0 && hit[0].point.z > -0.84 && hit[0].point.z < -0.76,
              { x },
            );
          }
      }
    }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    addedTriangles: triangles - base.levels[d].originalTriangles,
    retainedTriangles,
    shaftSideTriangles,
    shaftCapTriangles,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'ponce_de_leon_hotel',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: site.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
