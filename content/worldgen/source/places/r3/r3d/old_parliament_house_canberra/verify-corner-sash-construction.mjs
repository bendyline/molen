/** Verify recessed southeast-corner white sash windows with exact original full surroundings, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  oldParliamentDistrict,
  oldParliamentModel,
  oldParliamentSkyline,
  oldParliamentStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-old-parliament-house-canberra.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/r3/r3d/old_parliament_house_canberra/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-corner-sash-surroundings.json'),
  c = read('corner-sash-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  oldParliamentSkyline,
  oldParliamentDistrict,
  oldParliamentStreet,
  oldParliamentModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `OldParliament source${d}`);
  const h = createHash('sha256'),
    added = { cornerWall: 0, cornerReveal: 0, cornerSash: 0, cornerGlass: 0, cornerSill: 0 };
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
      ? { cornerWall: 84, cornerReveal: 144, cornerSash: 2304, cornerGlass: 432, cornerSill: 216 }
      : { cornerWall: 0, cornerReveal: 0, cornerSash: 0, cornerGlass: 0, cornerSill: 0 },
  );
  if (d === 3) {
    for (const slot of ['cornerSash', 'cornerGlass', 'cornerSill']) {
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
        `${slot} closed physical stocks`,
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
      `OldParliament import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('plaster_lime')) concreteSurface = true;
      if (JSON.stringify(m.userData).includes('metal_painted')) woodSurface = true;
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
    'all original attributes outside1904removed corner-wall-window-duplicated-rail triangles exact',
    true,
  );
  if (d === 3) {
    check(
      'original shared plaster and painted joinery bindings present',
      concreteSurface && woodSurface,
    );
    const k = c.windows;
    const hit = (name, A, B, q) => {
      const h = ray(A, B)[0];
      check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.000035, {
        expected: q,
        actual: h?.point.toArray(),
      });
      return h;
    };
    for (const f of c.faces) {
      const dx = f.b[0] - f.a[0],
        dz = f.b[1] - f.a[1],
        len = Math.hypot(dx, dz),
        nx = dz / len,
        nz = -dx / len,
        cx = (f.a[0] + f.b[0]) / 2,
        cz = (f.a[1] + f.b[1]) / 2,
        toWorld = (u, y, v) => [cx + u * nz + v * nx, y, cz - u * nx + v * nz];
      const front = (name, u, y, v) =>
          hit(name, toWorld(u, y, v + 0.018), toWorld(u, y, v - 0.012), toWorld(u, y, v)),
        back = (name, u, y, v) =>
          hit(name, toWorld(u, y, v - 0.012), toWorld(u, y, v + 0.008), toWorld(u, y, v));
      for (let j = 0; j < f.bays; j++)
        for (const [y, h] of k.bands) {
          const x = len / 2 - ((j + 0.5) * len) / f.bays,
            l = x - k.width / 2,
            r = x + k.width / 2,
            top = y + h;
          check(
            'each actual recessed window clears original structural wall',
            ray(toWorld(x + 0.23, y + h * 0.25, 0.15), toWorld(x + 0.23, y + h * 0.25, -0.015))
              .length === 0,
          );
          for (const upper of [false, true]) {
            const frontZ = (upper ? k.upperFront : k.lowerFront) - k.glassBehindFace,
              yy = y + h * (upper ? 0.75 : 0.25);
            const pane = hit(
              'each uninterrupted single-width pane is visible through the aperture',
              toWorld(x, yy, 0.15),
              toWorld(x, yy, frontZ - 0.01),
              toWorld(x, yy, frontZ),
            );
            back('each pane has actual closed thickness', x, yy, frontZ - k.glassThickness);
            check(
              'old unsupported central vertical mullion removed',
              Math.abs(pane.point.y - yy) < 0.00003,
            );
            const stockFront = upper ? k.upperFront : k.lowerFront,
              stockBack = upper ? k.upperBack : k.lowerBack,
              sy = upper ? top - 0.025 - k.sashWidth / 2 : y + 0.025 + k.sashWidth / 2;
            const painted = front(
                'each white staggered sash has a physical front',
                x,
                sy,
                stockFront,
              ),
              color = painted.object.geometry.getAttribute('color'),
              idx = painted.face.a;
            check(
              'native-supported white sash color survives import',
              color.getX(idx) > 0.8 && color.getY(idx) > 0.8 && color.getZ(idx) > 0.75,
            );
            back('each staggered sash has closed back', x, sy, stockBack);
          }
          const outer = front(
            'each outer white surround projects from wall',
            l - 0.04,
            y + h * 0.4,
            k.frameFront,
          );
          back('each outer surround has embedded back', l - 0.04, y + h * 0.4, k.frameBack);
          const color = outer.object.geometry.getAttribute('color'),
            idx = outer.face.a;
          check(
            'outer surround is white rather than old dark stock',
            color.getX(idx) > 0.8 && color.getY(idx) > 0.8,
          );
          for (const [point, inside] of [
            [
              [l, y + h * 0.6, -0.16],
              [1, 0, 0],
            ],
            [
              [r, y + h * 0.6, -0.16],
              [-1, 0, 0],
            ],
            [
              [x + 0.3, y, -0.16],
              [0, 1, 0],
            ],
            [
              [x + 0.3, top, -0.16],
              [0, -1, 0],
            ],
          ]) {
            hit(
              'each window has four real physical reveals',
              toWorld(...point.map((v, i) => v + inside[i] * 0.012)),
              toWorld(...point.map((v, i) => v - inside[i] * 0.012)),
              toWorld(...point),
            );
          }
          const v = 0.14,
            sy = y + 0.01 - (0.045 * (v + 0.06)) / (k.sillDepth + 0.06);
          hit(
            'each sill has a real outward sloping top',
            toWorld(x + 0.3, sy + 0.03, v),
            toWorld(x + 0.3, sy - 0.02, v),
            toWorld(x + 0.3, sy, v),
          );
          front('each sill has physical projecting front', x + 0.3, y - 0.1, k.sillDepth);
          back('each sill has closed embedded back', x + 0.3, y - 0.1, -0.06);
          hit(
            'each sill has a downward closed underside',
            toWorld(x + 0.3, y - 0.16, v),
            toWorld(x + 0.3, y - 0.12, v),
            toWorld(x + 0.3, y - 0.14, v),
          );
          if (y < 3)
            check(
              'unsupported duplicated corner balconies removed',
              ray(toWorld(x + 0.3, 4.65, 0.35), toWorld(x + 0.3, 4.65, 0.12)).length === 0,
            );
        }
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
      model: 'old_parliament_house_canberra',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
