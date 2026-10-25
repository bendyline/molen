/** Verify closed imported entrance sections, clear glazing gaps and unchanged surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  hemingwayDistrict,
  hemingwayModel,
  hemingwaySkyline,
  hemingwayStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-hemingway-house.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dh/dhm/hemingway_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-entrance-surroundings.json'),
  c = read('entrance-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  hemingwaySkyline,
  hemingwayDistrict,
  hemingwayStreet,
  hemingwayModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Hemingway source${d}`);
  const h = createHash('sha256');
  let retainedTriangles = 0,
    ironTriangles = 0;
  const sections = [];
  for (const g of source.groups) {
    if (g.slot === 'doorIron') {
      ironTriangles += g.count / 3;
      for (let k = g.start + 196 * 3; k < g.start + g.count; k += 36) {
        const ids = Array.from(source.indices.slice(k, k + 36)),
          ps = ids.map((i) => Array.from(source.positions.slice(i * 3, i * 3 + 3))),
          lo = [0, 1, 2].map((a) => Math.min(...ps.map((p) => p[a]))),
          hi = [0, 1, 2].map((a) => Math.max(...ps.map((p) => p[a])));
        assert.equal(ids.length, 36);
        assert(Math.abs(hi[2] - lo[2] - c.beamDepth) < 0.00001);
        sections.push(lo.map((v, a) => (v + hi[a]) / 2));
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
  assert.equal(ironTriangles, d === 3 ? 2020 : 0);
  assert.equal(sections.length, d === 3 ? 152 : 0);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0,
    paintedIron = false;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Hemingway import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (
        JSON.stringify(m.userData).includes('metal_painted') &&
        Math.abs(m.roughness - 0.65) < 0.000001 &&
        Math.abs(m.metalness - 0.25) < 0.000001
      )
        paintedIron = true;
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
    ray = (x, y, z0, z1) =>
      new T.Raycaster(
        new T.Vector3(x, y, z0),
        new T.Vector3(0, 0, Math.sign(z1 - z0)),
        0.000001,
        Math.abs(z1 - z0) - 0.000001,
      ).intersectObject(gltf.scene);
  check('all original attributes outside two replaced flat door infills exact', true);
  if (d === 3) {
    check('new physical sections bind painted metal', paintedIron);
    const spring = c.bottom + c.height - c.width * 0.36;
    for (let i = 0; i < 24; i++)
      for (const reverse of [false, true]) {
        const a = ((i + 0.5) * Math.PI) / 24,
          z = c.wallZ + 0.19,
          expected = z + ((reverse ? -1 : 1) * c.beamDepth) / 2,
          hit = ray(
            c.centerX + 0.7 * Math.cos(a),
            spring + 0.5 * Math.sin(a),
            z + (reverse ? -1 : 1) * 0.12,
            z,
          )[0];
        check(
          'joined curved arch has physical front and rear faces',
          !!hit && Math.abs(hit.point.z - expected) < 0.00001,
          { segment: i, reverse },
        );
      }
    for (const [i, p] of sections.entries())
      for (const reverse of [false, true]) {
        const z = p[2],
          expected = z + ((reverse ? -1 : 1) * c.beamDepth) / 2,
          hits = ray(p[0], p[1], z + (reverse ? -1 : 1) * 0.12, z),
          hit = hits[0];
        check(
          reverse
            ? 'each section has a closed rear face'
            : 'each section has an exposed physical front face',
          !!hit && Math.abs(hit.point.z - expected) < 0.00001,
          { section: i },
        );
      }
    for (const a of [Math.PI / 8, (Math.PI * 3) / 8, (Math.PI * 5) / 8, (Math.PI * 7) / 8]) {
      const x = c.centerX + 0.43 * Math.cos(a),
        y = spring + 0.3 * Math.sin(a),
        hit = ray(x, y, c.wallZ + 0.4, c.wallZ + 0.02)[0];
      check(
        'fanlight sector stays open to retained dark glazing',
        !!hit && Math.abs(hit.point.z - (c.wallZ + 0.07)) < 0.00001,
        { angle: a },
      );
    }
    for (const center of c.panelCenters)
      for (const dx of [-0.08, 0.08]) {
        const x = c.centerX + center + dx,
          y = (c.panelBottom + c.panelTop) / 2,
          hit = ray(x, y, c.wallZ + 0.4, c.wallZ + 0.02)[0];
        check(
          'lower grille has a real clear opening instead of the old flat white fill',
          !!hit && Math.abs(hit.point.z - (c.wallZ + 0.07)) < 0.00001,
          { leaf: center, dx },
        );
      }
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles,
    ironTriangles,
    closedSections: sections.length,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'hemingway_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
