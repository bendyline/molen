/** Imported stair handrails, unchanged treads and exact surrounding geometry. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  frauncesDistrict,
  frauncesSkyline,
  frauncesStreet,
  tavern,
} from '../../../../../../../packages/worldgen/scripts/structure-fraunces-tavern.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/dr5/fraunces_tavern/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  baseline = read('retained-stair-surroundings.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  co = Math.cos(site.frontFrame.angle),
  si = Math.sin(site.frontFrame.angle),
  origin = site.frontFrame.origin;
const world = (p) => [co * p[0] + si * p[2] + origin[0], p[1], -si * p[0] + co * p[2] + origin[1]],
  inside = (p) => {
    const x = p[0] - origin[0],
      z = p[2] - origin[1],
      lx = co * x - si * z,
      lz = si * x + co * z;
    return Math.abs(lx) < 1.8 && p[1] > 0.1 && p[1] < 2.1 && lz > 0.6 && lz < 2.4;
  };
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
const results = [];
for (const [d, build] of [frauncesSkyline, frauncesDistrict, frauncesStreet, tavern].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Fraunces source ${d}`);
  const h = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3));
    if (d > 0 && ids.every((i) => inside(Array.from(source.positions.slice(i * 3, i * 3 + 3)))))
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
  let triangles = 0;
  g.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Fraunces imported ${d}`,
    );
    triangles += indices.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, source.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= 6);
  const controls = [],
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    },
    ray = (a, b) => {
      const p = new T.Vector3(...world(a)),
        v = new T.Vector3(...world(b)).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.000001,
        v.length() - 0.000001,
      ).intersectObject(g.scene);
    };
  check('original surrounding source geometry attributes retained', true, {
    attributeHash,
    retainedTriangles,
  });
  check(
    'only the expected closed handrail members added',
    triangles - baseline.levels[d].triangles === [0, 120, 192, 192][d],
    { addedTriangles: triangles - baseline.levels[d].triangles },
  );
  for (const [z, y] of [
    [2.11, 0.2],
    [1.83, 0.4],
    [1.55, 0.6],
    [1.39, 0.8],
    [1, 0.97],
  ]) {
    const hit = ray([0, 2, z], [0, 0, z]);
    check(
      'original center tread and landing retained',
      hit.length > 0 && Math.abs(hit[0].point.y - y) < 0.0001,
      { z, expectedY: y, actualY: hit[0]?.point.y },
    );
  }
  check(
    'original portico remains open above stairs',
    ray([0, 1.7, 1.1], [0, 1.7, 1.3]).length === 0,
  );
  if (d > 0)
    for (const x of [-1.43, 1.43]) {
      for (const z of [1.8, 1.4, 0.9]) {
        const y = z > 1.23 ? 0.95 + ((2.2 - z) * 0.87) / 0.97 : 1.82,
          hit = ray([x, y + 0.15, z], [x, y - 0.15, z]);
        check(
          'solid descending handrail and level return',
          hit.length > 0 && Math.abs(hit[0].point.y - y) < 0.04,
          { x, z, y },
        );
      }
      for (const [i, [z, baseY]] of site.rails.postBases.entries()) {
        if (d === 1 && ![0, 4, 5].includes(i)) continue;
        const top = z > 1.23 ? 0.95 + ((2.2 - z) * 0.87) / 0.97 : 1.82,
          y = (baseY + top) / 2;
        check(
          'physical stair post above its original tread',
          ray([x - 0.1, y, z], [x + 0.1, y, z]).length > 0,
          { x, z, baseY },
        );
      }
      check(
        'air remains between stair posts',
        ray([x - 0.1, 0.9, 1.68], [x + 0.1, 0.9, 1.68]).length === 0,
        { x },
      );
    }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    controls: controls.length,
    failed: 0,
    addedTriangles: triangles - baseline.levels[d].triangles,
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
        'Physical iron stair handrails, posts and landing returns. Original stairs, source geometry outside small rail box, complete skyline, map and terrain retained. Rail sizes/hidden connections/current condition remain estimates from exact2008public-domain exterior.',
    },
    null,
    2,
  ),
);
