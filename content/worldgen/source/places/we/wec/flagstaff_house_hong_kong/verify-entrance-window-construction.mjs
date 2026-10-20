/** Verify arched entrance, paired panelled doors and recessed internal louvres, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  flagstaffHouseDistrict,
  flagstaffHouseModel,
  flagstaffHouseSkyline,
  flagstaffHouseStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-flagstaff-house-hong-kong.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/we/wec/flagstaff_house_hong_kong/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-entrance-window-surroundings.json'),
  c = read('entrance-window-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  flagstaffHouseSkyline,
  flagstaffHouseDistrict,
  flagstaffHouseStreet,
  flagstaffHouseModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `FlagstaffHouse source${d}`);
  const h = createHash('sha256'),
    added = {
      frontWall: 0,
      openingReveal: 0,
      darkJoinery: 0,
      whiteJoinery: 0,
      glazingStock: 0,
      doorHardware: 0,
    };
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
          frontWall: 75,
          openingReveal: 242,
          darkJoinery: 1496,
          whiteJoinery: 7020,
          glazingStock: 164,
          doorHardware: 120,
        }
      : {
          frontWall: 0,
          openingReveal: 0,
          darkJoinery: 0,
          whiteJoinery: 0,
          glazingStock: 0,
          doorHardware: 0,
        },
  );
  if (d === 3) {
    for (const slot of ['darkJoinery', 'whiteJoinery', 'glazingStock', 'doorHardware']) {
      const edges = new Map();
      for (const g of source.groups.filter((g) => g.slot === slot))
        for (let k = g.start; k < g.start + g.count; k += 3) {
          const p = Array.from(source.indices.slice(k, k + 3)).map((i) =>
            Array.from(source.positions.slice(i * 3, i * 3 + 3))
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const key = [p[j], p[(j + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
      assert(
        [...edges.values()].every((n) => n >= 2 && n % 2 === 0),
        slot + ' closed physical stocks',
      );
    }
  }
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
      `FlagstaffHouse import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('plaster_lime')) concreteSurface = true;
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
  check(
    'all original attributes outside1246replaced close front/door/window triangles exact',
    true,
  );
  if (d === 3) {
    check('shared plaster and joinery bindings present', concreteSurface && woodSurface);
    const f = c.wall,
      k = c.entrance,
      w = c.windows;
    const hit = (name, A, B, q) => {
      const h = ray(A, B)[0];
      check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00003, {
        expected: q,
        actual: h?.point.toArray(),
      });
    };
    const hitBack = (name, x, y, z) => hit(name, [x, y, z - 0.012], [x, y, z + 0.008], [x, y, z]);
    check(
      'door pocket contains no old wall in front of recessed leaf',
      ray([0.32, 1.48, 8.2], [0.32, 1.48, 7.94]).length === 0,
    );
    check(
      'paired active leaf seam is physically open',
      ray([0, 1.9, 7.94], [0, 1.9, 7.77]).length === 0,
    );
    for (const sign of [-1, 1]) {
      hitZ('each active glazed leaf is recessed', sign * 0.32, 1.48, k.leafFrontZ - 0.025);
      hitBack('each active glazed leaf has closed back', sign * 0.32, 1.48, k.backZ - 0.025);
      hitZ('each bottom panel is physically inset', sign * 0.35, 0.94, k.leafFrontZ - 0.025);
      hitBack('each bottom panel has closed back', sign * 0.35, 0.94, k.backZ + 0.01);
      hitZ(
        'each leaf lower panel moulding projects',
        sign * 0.35,
        k.bottom + 0.095,
        k.leafFrontZ + 0.025,
      );
      hitZ(
        'two round knobs have depth',
        sign * 0.105,
        k.bottom + k.panelHeight - 0.045,
        k.leafFrontZ + 0.1,
      );
      hitBack(
        'two round knobs have closed back',
        sign * 0.105,
        k.bottom + k.panelHeight - 0.045,
        k.leafFrontZ - 0.01,
      );
      hitZ('dark arched outer jamb has front', sign * (k.radius + 0.05), 2.3, k.frameFrontZ);
      hitBack(
        'dark arched outer jamb has embedded back',
        sign * (k.radius + 0.05),
        2.3,
        k.frameBackZ,
      );
      hit(
        'door jamb is a real reveal',
        [sign * (k.radius - 0.012), 2.4, 7.97],
        [sign * (k.radius + 0.012), 2.4, 7.97],
        [sign * k.radius, 2.4, 7.97],
      );
    }
    for (const j of [3, 8, 13, 18, 23, 28]) {
      const t = ((j + 0.5) * Math.PI) / k.segments,
        a = [k.radius * Math.cos(t), k.spring + k.radius * Math.sin(t), 7.97],
        v = [Math.cos(t), Math.sin(t), 0];
      // Use the exact faceted soffit, rather than the smooth mathematical radius.
      const r = k.radius * Math.cos(Math.PI / (2 * k.segments)),
        q = [r * Math.cos(t), k.spring + r * Math.sin(t), 7.97];
      hit(
        'curved soffit has physical depth',
        q.map((p, i) => p - v[i] * 0.015),
        q.map((p, i) => p + v[i] * 0.015),
        q,
      );
    }
    for (let j = 1; j <= k.fanSpokes; j++) {
      const t = (j * Math.PI) / (k.fanSpokes + 1),
        x = 0.83 * Math.cos(t),
        y = k.spring + 0.83 * Math.sin(t);
      hitZ('every fanlight radial is a physical closed stock', x, y, k.leafFrontZ + k.barDepth);
      hitBack('every fanlight radial has closed back', x, y, k.leafFrontZ - 0.005);
    }
    hitZ(
      'closed fan glazing sits behind radial stocks',
      0.15,
      k.spring + 0.82,
      k.leafFrontZ - 0.025,
    );
    hitBack('closed fan glazing has back', 0.15, k.spring + 0.82, k.backZ - 0.025);
    check(
      'no rectangular wall caps the arched entrance',
      ray([0.15, k.spring + 0.82, 8.19], [0.15, k.spring + 0.82, 7.94]).length === 0,
    );
    hit(
      'original step meets physical entrance threshold',
      [0.55, k.bottom + 0.06, 8.16],
      [0.55, k.bottom - 0.04, 8.16],
      [0.55, k.bottom + 0.015, 8.16],
    );
    for (const x of w.centers) {
      const l = x - w.width / 2,
        r = x + w.width / 2,
        y = w.bottom,
        top = y + w.height;
      check(
        'each window is cut through the original front wall',
        ray([x + 0.28, y + 0.47, 8.23], [x + 0.28, y + 0.47, 8.13]).length === 0,
      );
      check(
        'unsupported external white shutter wings removed',
        ray([x + w.width * 0.76, y + 1.1, 8.24], [x + w.width * 0.76, y + 1.1, 8.06]).length === 0,
      );
      hitZ('each dark window frame has front', l - 0.04, y + 1.3, w.frameFrontZ);
      hitBack('each dark window frame has closed back', l - 0.04, y + 1.3, w.frameBackZ);
      hit(
        'each left window jamb is a real reveal',
        [l + 0.012, y + 0.8, 7.96],
        [l - 0.012, y + 0.8, 7.96],
        [l, y + 0.8, 7.96],
      );
      hit(
        'each right window jamb is a real reveal',
        [r - 0.012, y + 0.8, 7.96],
        [r + 0.012, y + 0.8, 7.96],
        [r, y + 0.8, 7.96],
      );
      hit(
        'each window soffit is physical',
        [x + 0.3, top - 0.012, 7.96],
        [x + 0.3, top + 0.012, 7.96],
        [x + 0.3, top, 7.96],
      );
      hitZ('each window central lattice is a closed physical stock', x, y + 1.1, 8.095);
      hitBack('each window central lattice has closed back', x, y + 1.1, w.frontZ + 0.025);
      const angle = (w.slatTiltDegrees * Math.PI) / 180,
        cs = Math.cos(angle),
        sn = Math.sin(angle);
      for (const sign of [-1, 1]) {
        const cx = x + (sign * w.width) / 4;
        for (let sy = y + 0.14; sy < top - 0.1; sy += w.slatPitch) {
          // Probe away from the central dark quarter bar, along the tilted slat's normal.
          const xx = cx + 0.18,
            front = [xx, sy - (sn * w.slatDepth) / 2, w.frontZ + (cs * w.slatDepth) / 2],
            back = [xx, sy + (sn * w.slatDepth) / 2, w.frontZ - (cs * w.slatDepth) / 2],
            n = [0, -sn, cs];
          hit(
            'every internal louvre is physical and tilted',
            front.map((p, i) => p + n[i] * 0.005),
            front.map((p, i) => p - n[i] * 0.005),
            front,
          );
          hit(
            'every internal louvre has a closed back',
            back.map((p, i) => p - n[i] * 0.005),
            back.map((p, i) => p + n[i] * 0.005),
            back,
          );
          if (Math.abs(sy - (y + 0.14)) < 0.00001) {
            const hits = ray(
                front.map((p, i) => p + [-sign * 0.65, 0, 0.35][i]),
                front.map((p, i) => p - [-sign * 0.65, 0, 0.35][i] * 0.01),
              ),
              h = hits[0],
              color = h?.object.geometry.getAttribute('color'),
              idx = h?.face.a;
            check(
              'white louvres remain visible through shallow dark lattice at an oblique angle',
              !!h &&
                !!color &&
                color.getX(idx) > 0.8 &&
                color.getY(idx) > 0.8 &&
                h.point.distanceTo(new T.Vector3(...front)) < 0.00004,
              { actual: h?.point.toArray() },
            );
          }
        }
      }
      hit(
        'each sill has physical top and depth',
        [x + 0.4, y + 0.06, 8.2],
        [x + 0.4, y - 0.02, 8.2],
        [x + 0.4, y + 0.015, 8.2],
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
      model: 'flagstaff_house_hong_kong',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
