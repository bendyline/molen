/** Verify physical west reliefs and actual recessed openings, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  hollyhockDistrict,
  hollyhockModel,
  hollyhockSkyline,
  hollyhockStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-hollyhock-house.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q5/hollyhock_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-west-surroundings.json'),
  c = read('west-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  hollyhockSkyline,
  hollyhockDistrict,
  hollyhockStreet,
  hollyhockModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Hollyhock source${d}`);
  const h = createHash('sha256'),
    added = { relief: 0, reveal: 0, recessGlass: 0, recessWood: 0 };
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
      ? { relief: 14664, reveal: 56, recessGlass: 10, recessWood: 492 }
      : { relief: 0, reveal: 0, recessGlass: 0, recessWood: 0 },
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
      `Hollyhock import${d}`,
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
    world = ([x, y, z]) => [c.westFrame.origin[0] - z, y, c.westFrame.origin[1] + x],
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
    zHit = (name, x, y, z) => {
      const hit = ray([x, y, z + 0.04], [x, y, z - 0.025])[0];
      check(name, !!hit && Math.abs(c.westFrame.origin[0] - hit.point.x - z) < 0.00001, {
        x,
        y,
        z,
      });
    };
  check('all original attributes outside1116replaced west triangles exact', true);
  if (d === 3) {
    check('new stone and wood bind continuous shared materials', concreteSurface && woodSurface);
    for (const v of c.openings) {
      const x = v.x === 0 ? 0.7 : v.x,
        y = 2.9;
      check(
        'each opening is actually empty at the original wall face',
        ray([x, y, 0.04], [x, y, -0.15]).length === 0,
        { opening: v.x },
      );
      zHit('each aperture reaches physically recessed glazing', x, y, -0.395);
      zHit('each wood jamb has closed physical depth', v.x - v.width / 2 + 0.035, 2.5, -0.29);
      for (const sign of [-1, 1]) {
        const edge = v.x + (sign * v.width) / 2,
          hit = ray([edge - sign * 0.04, y, -0.15], [edge + sign * 0.04, y, -0.15])[0];
        check(
          'each aperture has a physical side reveal',
          !!hit && Math.abs(hit.point.z - c.westFrame.origin[1] - edge) < 0.00001,
          { opening: v.x, sign },
        );
      }
      for (const bottom of [true, false]) {
        const y = bottom ? c.wall.openingBottom : c.wall.openingTop,
          hit = ray(
            [x, y + (bottom ? 0.03 : -0.03), -0.15],
            [x, y + (bottom ? -0.03 : 0.03), -0.15],
          )[0];
        check(
          'each aperture has a closed sill and soffit',
          !!hit && Math.abs(hit.point.y - y) < 0.00001,
          { opening: v.x, bottom },
        );
      }
    }
    for (const x of [-3.3, 3.3]) zHit('solid facade remains between openings', x, 2.7, 0);
    const fr = c.frieze,
      p = c.piers,
      units = [
        ...Array.from({ length: fr.count }, (_, i) => ({
          x: -fr.width / 2 + ((i + 0.5) * fr.width) / fr.count,
          y: fr.bottom,
          h: fr.height,
          z: fr.front,
          finZ: -0.11,
        })),
        ...p.centers.map((x) => ({
          x,
          y: p.reliefBottom,
          h: p.reliefHeight,
          z: p.reliefFront,
          finZ: 0.225,
        })),
      ];
    assert.equal(units.length, 20);
    for (const [u, v] of units.entries()) {
      const s = v.h / 1.12;
      zHit('closed raised head stalk', v.x, v.y + 0.95 * s, v.z + 0.0725);
      for (let i = 0; i < 6; i++) {
        const yy = 0.16 + i * 0.08,
          ww = i < 3 ? 0.32 : 0.27;
        zHit(
          'each stepped leaf has a real projecting front',
          v.x,
          v.y + (yy + 0.0175) * s,
          v.z + 0.0825,
        );
        for (const sign of [-1, 1])
          zHit(
            'paired leaf returns have actual closed depth',
            v.x + sign * (ww / 2 - 0.018) * s,
            v.y + (yy - 0.04) * s,
            v.z + 0.0725,
          );
      }
      for (let i = 0; i < 12; i++)
        for (const sign of [-1, 1])
          zHit(
            'every paired head tooth is actual solid geometry',
            v.x + sign * 0.039 * s,
            v.y + (0.64 + i * 0.038 + 0.0085) * s,
            v.z + 0.0725,
          );
      const hit = ray([v.x + 0.08 * s, v.y + 0.9 * s, v.finZ], [v.x, v.y + 0.9 * s, v.finZ])[0];
      check(
        'deep backing fin joins the receding wall or pier',
        !!hit && Math.abs(hit.point.z - c.westFrame.origin[1] - v.x - 0.0325 * s) < 0.00001,
        { unit: u },
      );
    }
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
      model: 'hollyhock_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
