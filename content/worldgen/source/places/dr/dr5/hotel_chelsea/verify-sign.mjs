/** Targeted sign geometry and unchanged hotel/site controls; no whole-exterior approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  chelsea,
  chelseaDistrict,
  chelseaSkyline,
  chelseaStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-hotel-chelsea.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/dr5/hotel_chelsea/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  baseline = read('retained-sign-surroundings-rgb.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
const inside = (p) =>
  Math.abs(p[0]) < 0.25 && p[1] > 12 && p[1] < 26.2 && p[2] > 13.8 && p[2] < 18.5;
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
const results = [];
for (const [d, build] of [chelseaSkyline, chelseaDistrict, chelseaStreet, chelsea].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Chelsea source ${d}`);
  const h = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3));
    if (d > 1 && ids.every((i) => inside(Array.from(source.positions.slice(i * 3, i * 3 + 3)))))
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
        h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
  }
  const attributeHash = `sha256:${h.digest('hex')}`;
  assert.equal(attributeHash, baseline.levels[d].attributeHash);
  assert.equal(retainedTriangles, baseline.levels[d].retainedTriangles);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const g = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  g.scene.updateMatrixWorld(true);
  let triangles = 0,
    physicalLetterSideTriangles = 0;
  g.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Chelsea runtime ${d}`,
    );
    triangles += indices.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    for (let k = 0; k < indices.length; k += 3) {
      const points = Array.from(indices.slice(k, k + 3), (i) => [p.getX(i), p.getY(i), p.getZ(i)]);
      if (
        points.every(inside) &&
        points.some((p) => Math.abs(Math.abs(p[0]) - 0.1) < 0.00001) &&
        points.some((p) => Math.abs(Math.abs(p[0]) - 0.145) < 0.00001)
      )
        physicalLetterSideTriangles++;
    }
  });
  assert.equal(triangles, level.triangles);
  assert.equal(triangles, source.triangleCount);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= 6);
  const controls = [],
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    },
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        delta = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        delta.clone().normalize(),
        0.000001,
        delta.length() - 0.000001,
      ).intersectObject(g.scene);
    };
  check('exact original surrounding source triangle attributes retained', true, {
    attributeHash,
    retainedTriangles,
  });
  check('closed glyph physical side triangles', physicalLetterSideTriangles === (d > 1 ? 752 : 0), {
    physicalLetterSideTriangles,
  });
  if (d > 1) {
    const cx = 16.16125,
      cy = 22.175;
    check(
      'front oval counter remains open before signboard',
      ray([0.4, cy, cx], [0.09, cy, cx]).length === 0,
    );
    check(
      'front oval upper corner remains outside ellipse',
      ray([0.4, 23.0075, 15.604375], [0.09, 23.0075, 15.604375]).length === 0,
    );
    const rim = ray([0.4, cy, 16.7], [0.09, cy, 16.7]);
    check(
      'front oval is a physical raised face',
      rim.length > 0 && Math.abs(rim[0].point.x - 0.145) < 0.00001,
    );
    const inner = ray([0.1225, cy, cx], [0.1225, cy, 16.75]);
    check(
      'oval counter has physical inward side depth',
      inner.length > 0 && Math.abs(inner[0].point.z - 16.62) < 0.015,
    );
    const body = ray([0.4, cy, cx], [0.02, cy, cx]);
    check(
      'original solid blade behind oval counter retained',
      body.length > 0 && Math.abs(body[0].point.x - 0.08) < 0.00001,
    );
    const stem = ray([0.4, 24.2, 16.78], [0.09, 24.2, 16.78]);
    check(
      'H stem has physical front face',
      stem.length > 0 && Math.abs(stem[0].point.x - 0.145) < 0.00001,
    );
    const edge = ray([0.1225, 24.2, 17], [0.1225, 24.2, 16.7]);
    check(
      'H stem has solid end-to-face side depth',
      edge.length > 0 && Math.abs(edge[0].point.z - 16.86) < 0.0001,
    );
    check(
      'reverse oval counter remains open',
      ray([-0.4, cy, 15.71875], [-0.09, cy, 15.71875]).length === 0,
    );
    const reverse = ray([-0.4, cy, 16.25], [-0.09, cy, 16.25]);
    check(
      'reverse oval raised face present',
      reverse.length > 0 && Math.abs(reverse[0].point.x + 0.145) < 0.00001,
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    controls: controls.length,
    failed: 0,
    physicalLetterSideTriangles,
    retainedTriangles,
    attributeHash,
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
      results,
      scope:
        'Physical closed blade lettering and oval O only. Exact original skyline/district and surrounding street/close source geometry retained. Whole exterior remains unapproved under current public-domain fidelity policy.',
    },
    null,
    2,
  ),
);
