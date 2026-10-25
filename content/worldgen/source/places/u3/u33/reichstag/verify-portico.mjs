/** Changed physical portico, imported attributes and retained original site controls. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  reichstag,
  reichstagDistrict,
  reichstagSkyline,
  reichstagStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-reichstag.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/u3/u33/reichstag/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
assert.deepEqual(frame.anchor, [13.376111111111111, 52.51861111111111]);
assert.equal(frame.heading, -Math.PI / 2);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
for (const [d, build] of [
  reichstagSkyline,
  reichstagDistrict,
  reichstagStreet,
  reichstag,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Reichstag source ${d}`);
  assert(source.triangleCount <= [1000, 4000, 16000, 64000][d]);
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
      `Reichstag runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
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
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(gltf.scene);
    },
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    };
  for (const x of [-4, 1.6, 7.2]) {
    check('open approach between columns', ray([x, 8, 53], [x, 8, 44]).length === 0, { x });
    for (const z of [47, 50, 55, 62]) {
      const h = ray([x, 3.6, z], [x, 3.1, z])[0];
      check(
        'continuous physical portico and upper stair landing',
        !!h && Math.abs(h.point.y - 3.4) < 0.002,
        { x, z, y: h?.point.y },
      );
    }
  }
  if (d) {
    for (const dx of [-9, -4.5, 0, 4.5, 9]) {
      const x = 1.6 + dx,
        h = ray([x, 12, 43.8], [x, 12, 43.3])[0];
      check('solid vertical entrance frame front', !!h && Math.abs(h.point.z - 43.47) < 0.002, {
        x,
        z: h?.point.z,
      });
      check(
        'vertical frame has inward side depth',
        ray([x + 0.3, 12, 43.36], [x, 12, 43.36]).length > 0,
        { x },
      );
    }
    for (const y of [10.07, 15.07, 20.07]) {
      const h = ray([3.7, y, 43.8], [3.7, y, 43.3])[0];
      check('solid horizontal entrance frame', !!h && Math.abs(h.point.z - 43.47) < 0.002, {
        y,
        z: h?.point.z,
      });
    }
    const h = ray([3.7, 12, 44], [3.7, 12, 43.22])[0];
    check(
      'opaque exterior glazing boundary behind frames',
      !!h && Math.abs(h.point.z - 43.25) < 0.002,
      { z: h?.point.z },
    );
    for (const dx of [-8.4, -2.8, 2.8, 8.4]) {
      const x = 1.6 + dx,
        h = ray([x, 22.2, 48.1], [x, 22.8, 48.1])[0];
      check('solid primary ceiling beam underside', !!h && Math.abs(h.point.y - 22.55) < 0.002, {
        x,
        y: h?.point.y,
      });
      check('primary beam side depth', ray([x + 0.5, 22.8, 48.1], [x, 22.8, 48.1]).length > 0, {
        x,
      });
    }
    const z = d === 1 ? 49.6 : 49.5,
      tie = ray([1.6, 22.4, z], [1.6, 22.9, z])[0];
    check('solid crossing ceiling tie underside', !!tie && Math.abs(tie.point.y - 22.67) < 0.002, {
      y: tie?.point.y,
    });
    check('open coffer air between beams', ray([1.6, 22.6, 48.1], [1.6, 22.9, 48.1]).length === 0);
    const soffit = ray([1.6, 22.8, 45], [1.6, 23.2, 45])[0];
    check(
      'continuous rear ceiling closes coffer above',
      !!soffit && Math.abs(soffit.point.y - 23.05) < 0.002,
      { y: soffit?.point.y },
    );
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass).length,
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
        'Physical west entrance frame depth, ceiling beams/coffer air and continuous portico/landing floor; source/imported normals/winding/UVs and original map/ground. Concealed connections, member dimensions and exact proportions remain estimates.',
    },
    null,
    2,
  ),
);
