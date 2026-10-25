/** Verify rounded bay and recessed carved paired entrance, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  bachDistrict,
  bachModel,
  bachSkyline,
  bachStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-bach-house.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/u1/u1p/bach_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-facade-surroundings-v2.json'),
  c = read('facade-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [bachSkyline, bachDistrict, bachStreet, bachModel.build].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Bach source${d}`);
  const h = createHash('sha256'),
    added = { facadeStucco: 0, portalStone: 0, portalWood: 0, portalMetal: 0, facadeShutters: 0 };
  let retainedTriangles = 0;
  for (const g of source.groups) {
    if (g.slot in added) {
      added[g.slot] += g.count / 3;
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const q = Array.from(source.indices.slice(k, k + 3)).map((i) =>
            Array.from(source.uvs.slice(i * 2, i * 2 + 2)),
          ),
          a = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
        assert(Math.abs(a) > 1e-10, `metric UV ${g.slot}:${k}`);
      }
      continue;
    }
    for (let k = g.start; k < g.start + g.count; k++) {
      const i = source.indices[k];
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
    retainedTriangles += g.count / 3;
  }
  assert.equal(`sha256:${h.digest('hex')}`, base.levels[d].attributeHash);
  assert.equal(retainedTriangles, base.levels[d].retainedTriangles);
  assert.deepEqual(
    added,
    d === 3
      ? {
          facadeStucco: 60,
          portalStone: 160,
          portalWood: 576,
          portalMetal: 120,
          facadeShutters: 132,
        }
      : { facadeStucco: 0, portalStone: 0, portalWood: 0, portalMetal: 0, facadeShutters: 0 },
  );
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0,
    concreteSurface = false,
    woodSurface = false;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Bach import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('concrete_plain')) concreteSurface = true;
      if (JSON.stringify(m.userData).includes('wood_plain')) woodSurface = true;
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
    },
    hitZ = (name, x, y, z) => {
      const h = ray([x, y, z + 0.025], [x, y, z - 0.015])[0];
      check(name, !!h && Math.abs(h.point.z - z) < 0.00002, { x, y, z, actual: h?.point.z });
    };
  check('all original attributes outside324replaced bay-wall-portal triangles exact', true);
  if (d === 3) {
    for (const x of c.bayShutters.centers)
      for (const sign of [-1, 1])
        hitZ('paired half-width shutter has closed front', x + sign * 0.545 + 0.02, 4.5, 4.95);
    for (const x of [7.125, 8.575])
      check(
        'adjacent upper shutters have actual clear separation',
        ray([x, 4.5, 4.98], [x, 4.5, 4.91]).length === 0,
      );
    check(
      'unsupported lower bay shutter removed',
      ray([6.64, 1.9, 4.5], [6.64, 1.9, 4.43]).length === 0,
    );
    check(
      'new portal has continuous stone and wood shared bindings',
      concreteSurface && woodSurface,
    );
    const b = c.bay,
      p = c.portal;
    for (let i = 0; i < b.segments; i++) {
      const a = (i * Math.PI) / (2 * b.segments),
        z = ((i + 1) * Math.PI) / (2 * b.segments),
        q = [
          8,
          b.bottom + b.radius * (1 - (Math.cos(a) + Math.cos(z)) / 2),
          b.backZ + (b.radius * (Math.sin(a) + Math.sin(z))) / 2,
        ],
        deltaY = b.radius * (Math.cos(a) - Math.cos(z)),
        deltaZ = b.radius * (Math.sin(z) - Math.sin(a)),
        len = Math.hypot(deltaY, deltaZ),
        n = [0, -deltaZ / len, deltaY / len],
        A = q.map((v, k) => v + n[k] * 0.03),
        B = q.map((v, k) => v - n[k] * 0.015),
        h = ray(A, B)[0];
      check(
        'every cove facet is physical and faces down/out',
        !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00002,
        { facet: i },
      );
    }
    check(
      'space below rounded bay is genuinely empty',
      ray([8, 2.75, 5.05], [8, 2.75, 4.78]).length === 0,
    );
    hitZ('bay retains solid projected upper front', 8, 3.4, 4.88);
    for (const [s, x] of [
      [-1, b.left],
      [1, b.right],
    ]) {
      const h = ray([x + s * 0.03, 3.4, 4.7], [x - s * 0.015, 3.4, 4.7])[0];
      check('rounded bay has closed side end', !!h && Math.abs(h.point.x - x) < 0.00002, {
        side: s,
      });
    }
    check(
      'portal is truly open through original wall plane',
      ray([p.x, 2.5, 4.51], [p.x, 2.5, 4.24]).length === 0,
    );
    for (const sign of [-1, 1]) {
      const x = p.x + sign * 0.55;
      hitZ('paired wood leaf has recessed front', x, 2.5, p.doorFrontZ);
      const h = ray([x, 2.5, 4.075], [x, 2.5, 4.12])[0];
      check(
        'each wood leaf has physical closed back',
        !!h && Math.abs(h.point.z - p.doorBackZ) < 0.00002,
        { side: sign },
      );
      hitZ('two physical meeting stiles retain leaf seam', p.x + sign * 0.04, 3.45, 4.225);
    }
    check(
      'leaf seam is actual clear space between closed leaves',
      ray([p.x, 2.5, 4.24], [p.x, 2.5, 4.08]).length === 0,
    );
    const l = p.x - p.width / 2,
      r = p.x + p.width / 2,
      lo = p.bottom,
      top = p.bottom + p.height,
      rr = p.cornerRadius,
      boundary = [
        [l, lo],
        [r, lo],
        [r, top - rr],
      ];
    for (let i = 1; i <= p.cornerSegments; i++) {
      const a = (i * Math.PI) / (2 * p.cornerSegments);
      boundary.push([r - rr + rr * Math.cos(a), top - rr + rr * Math.sin(a)]);
    }
    boundary.push([l + rr, top]);
    for (let i = 1; i <= p.cornerSegments; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / (2 * p.cornerSegments);
      boundary.push([l + rr + rr * Math.cos(a), top - rr + rr * Math.sin(a)]);
    }
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i],
        b = boundary[(i + 1) % boundary.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy),
        n = [-dy / len, dx / len],
        q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        A = [q[0] + n[0] * 0.03, q[1] + n[1] * 0.03, 4.3],
        B = [q[0] - n[0] * 0.03, q[1] - n[1] * 0.03, 4.3],
        h = ray(A, B)[0];
      check(
        'every jamb-floor-soffit segment is physical',
        !!h && Math.hypot(h.point.x - q[0], h.point.y - q[1]) < 0.00002,
        { segment: i },
      );
    }
    hitZ('stone surround has physical front', l - 0.09, 2.6, p.frameFrontZ);
    const back = ray([l - 0.09, 2.6, 4.35], [l - 0.09, 2.6, 4.39])[0];
    check(
      'stone surround has closed back into retained wall',
      !!back && Math.abs(back.point.z - p.frameBackZ) < 0.00002,
    );
    for (const sign of [-1, 1]) {
      const cx = p.x + (sign * p.width) / 4,
        pw = p.width * 0.39;
      for (const xx of [cx - pw / 2, cx + pw / 2])
        hitZ('lower panel has physical vertical molding', xx, 1.7, 4.23);
      for (const yy of [p.bottom + 0.17, p.bottom + 0.84])
        hitZ('lower panel has physical horizontal molding', cx, yy, 4.23);
      const upper = [
        [p.x + sign * 0.12, p.bottom + 1],
        [p.x + sign * (p.width / 2 - 0.15), p.bottom + 1],
        [p.x + sign * (p.width / 2 - 0.15), p.bottom + 2.39],
        [p.x + sign * 0.12, p.bottom + 2.45],
      ];
      for (let i = 0; i < 3; i++)
        hitZ(
          'upper panel molding is continuous closed depth',
          (upper[i][0] + upper[i + 1][0]) / 2,
          (upper[i][1] + upper[i + 1][1]) / 2,
          4.21,
        );
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 24,
          b = ((i + 1) * Math.PI) / 24,
          x = p.x + sign * (0.12 + ((p.width / 2 - 0.27) * (i + 0.5)) / 12),
          y = p.bottom + 1.84 - (0.29 * (Math.sin(a) + Math.sin(b))) / 2;
        hitZ('each waist carving segment has physical front', x, y, 4.23);
      }
    }
    const kx = p.x - 0.32,
      ky = p.bottom + 1.28;
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) * Math.PI) / 6;
      hitZ(
        'knocker is a closed physical annulus',
        kx + 0.055 * Math.cos(a),
        ky + 0.055 * Math.sin(a),
        4.25,
      );
    }
    check(
      'knocker center is open ahead of mounting plate',
      ray([kx, ky, 4.27], [kx, ky, 4.225]).length === 0,
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles,
    added,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'bach_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
