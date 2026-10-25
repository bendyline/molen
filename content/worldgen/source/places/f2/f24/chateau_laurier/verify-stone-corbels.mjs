/** Check physical corbels and original attributes outside the replaced window rows. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  laurier,
  laurierDistrict,
  laurierSkyline,
  laurierStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-chateau-laurier.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/f2/f24/chateau_laurier/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('corbel-construction-controls.json'),
  base = read('retained-corbel-surroundings-v4.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('retained-corbel-surroundings.json', dir))),
  base.originalBaselineHash,
);
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [laurierSkyline, laurierDistrict, laurierStreet, laurier].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Laurier source ${d}`);
  const h = createHash('sha256');
  let retainedTriangles = 0,
    corbelTriangles = 0;
  for (const g of source.groups) {
    if (g.slot === 'corbel') {
      corbelTriangles += g.count / 3;
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
  assert.equal(
    `sha256:${h.digest('hex')}`,
    base.levels[d].attributeHash,
    `all retained original attributes ${d}`,
  );
  assert.equal(retainedTriangles, base.levels[d].retainedTriangles);
  assert.equal(corbelTriangles, d === 3 ? 4976 : 0);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0,
    corbelMaterial = false;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Laurier import ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('stone_limestone_raw')) corbelMaterial = true;
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
  check(
    'every original attribute outside replaced windows and box ornaments retained exactly',
    true,
  );
  if (d === 3) {
    check('new mouldings bind continuous raw limestone', corbelMaterial);
    for (const [x, z] of c.pendants.centers) {
      // The fourth base faces the court; +X points into its retained wall.
      const angle = x === -18.5 ? Math.PI / 2 : 0;
      const tip = ray([x + 0.01, 19.4, z + 0.01], [x + 0.01, 19.6, z + 0.01]);
      check('closed pendant tip cap', tip.length > 0 && Math.abs(tip[0].point.y - 19.5) < 0.0001, {
        x,
        z,
      });
      for (const y of [19.8, 20.35, 20.75, 21.3]) {
        const j = c.pendants.rings.findIndex((r) => r[0] > y),
          a = c.pendants.rings[j - 1],
          b = c.pendants.rings[j],
          r = a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]),
          hit = ray(
            [x + Math.cos(angle) * 1.6, y, z + Math.sin(angle) * 1.6],
            [x + Math.cos(angle) * 0.1, y, z + Math.sin(angle) * 0.1],
          );
        check(
          'physical layered pendant contour below old flat base',
          hit.length > 0 &&
            Math.abs(
              (hit[0].point.x - x) * Math.cos(angle) + (hit[0].point.z - z) * Math.sin(angle) - r,
            ) < 0.0001,
          { x, z, y, r },
        );
      }
    }
    for (const [x, z, r, top] of c.brackets.towers)
      for (let i = 0; i < c.brackets.count; i++) {
        const a = (i * Math.PI * 2) / c.brackets.count,
          pt = (xx, y, zz) => [
            x + Math.cos(a) * xx + Math.sin(a) * zz,
            y,
            z - Math.sin(a) * xx + Math.cos(a) * zz,
          ],
          y = top - c.brackets.lowFromTop + 0.78,
          allHits = ray(pt(0.07, y, r + 0.35), pt(0.07, y, r - 0.02)),
          // The far sides of complete rings embed in the retained roof. Check
          // their actual imported solid, and separately require the front to be exposed.
          hit = allHits.find((h) => h.object.material.name === 'stone_limestone_raw');
        check(
          'each stepped corbel has a closed projecting front',
          !!hit &&
            Math.abs((hit.point.x - x) * Math.sin(a) + (hit.point.z - z) * Math.cos(a) - r - 0.09) <
              0.0001,
          { tower: x, support: i },
        );
        if (i === 0) check('front corbel is exposed in the complete model', allHits[0] === hit);
        const shelfY = top - c.brackets.lowFromTop + 0.55,
          shelf = ray(pt(0.07, shelfY - 0.05, r + 0.04), pt(0.07, shelfY + 0.05, r + 0.04)).find(
            (h) => h.object.material.name === 'stone_limestone_raw',
          );
        check(
          'each corbel has a physical downward stepped underside',
          !!shelf && Math.abs(shelf.point.y - shelfY) < 0.0001,
          { tower: x, support: i },
        );
      }
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles,
    corbelTriangles,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'chateau_laurier',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
