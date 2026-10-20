/** Verify closed turned Ionic columns, spiral capitals and profiled porch with exact full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  taipeiStoryHouseDistrict,
  taipeiStoryHouseModel,
  taipeiStoryHouseSkyline,
  taipeiStoryHouseStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-taipei-story-house.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/ws/wsq/taipei_story_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-ionic-entrance-surroundings.json'),
  c = read('ionic-entrance-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  taipeiStoryHouseSkyline,
  taipeiStoryHouseDistrict,
  taipeiStoryHouseStreet,
  taipeiStoryHouseModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `TaipeiStoryHouse source${d}`);
  const h = createHash('sha256'),
    added = {
      porchProfile: 0,
      ceilingMoulding: 0,
      ionicColumn: 0,
      ionicCapital: 0,
      ionicVolute: 0,
      ionicSpiral: 0,
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
          porchProfile: 934,
          ceilingMoulding: 1280,
          ionicColumn: 12320,
          ionicCapital: 1056,
          ionicVolute: 5056,
          ionicSpiral: 9408,
        }
      : {
          porchProfile: 0,
          ceilingMoulding: 0,
          ionicColumn: 0,
          ionicCapital: 0,
          ionicVolute: 0,
          ionicSpiral: 0,
        },
  );
  if (d === 3) {
    for (const slot of [
      'porchProfile',
      'ceilingMoulding',
      'ionicColumn',
      'ionicCapital',
      'ionicVolute',
      'ionicSpiral',
    ]) {
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
    plasterSurface = false,
    stoneSurface = false;
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `TaipeiStoryHouse import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('plaster_lime')) plasterSurface = true;
      if (JSON.stringify(m.userData).includes('stone_limestone')) stoneSurface = true;
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
    'all original attributes outside808removed entrance-column/flat-scroll/slab triangles exact',
    true,
  );
  if (d === 3) {
    check('original shared plaster/stone bindings retained', plasterSurface && stoneSurface);
    const k = c.columns,
      v = c.volutes;
    const hit = (name, A, B, q) => {
      const h = ray(A, B)[0];
      check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00004, {
        expected: q,
        actual: h?.point.toArray(),
      });
      return h;
    };
    const radialHit = (name, cx, cz, y, r, a) => {
      const n = [Math.cos(a), 0, Math.sin(a)],
        q = [cx + r * n[0], y, cz + r * n[2]];
      return hit(
        name,
        q.map((v, i) => v + n[i] * 0.008),
        q.map((v, i) => v - n[i] * 0.008),
        q,
      );
    };
    for (const [x, z] of k.positions) {
      hit(
        'each column retains its fixed original foot',
        [x + 0.32, k.bottom - 0.005, z + 0.3],
        [x + 0.32, k.bottom + 0.005, z + 0.3],
        [x + 0.32, k.bottom, z + 0.3],
      );
      const painted = hit(
        'each square plinth has a closed front',
        [x + 0.1, k.bottom + 0.06, z + k.plinthWidth / 2 + 0.015],
        [x + 0.1, k.bottom + 0.06, z + k.plinthWidth / 2 - 0.01],
        [x + 0.1, k.bottom + 0.06, z + k.plinthWidth / 2],
      );
      check(
        'new entrance uses matte plaster without inherited masonry joints',
        JSON.stringify(painted.object.material.userData).includes('plaster_lime'),
      );
      for (const [index, t] of [
        [2, 0.5],
        [7, 0.5],
        [10, 0.5],
        [15, 0.55],
      ]) {
        const a = k.profile[index],
          b = k.profile[index + 1],
          y = k.bottom + a[0] + (b[0] - a[0]) * t,
          r = (a[1] + (b[1] - a[1]) * t) * Math.cos(Math.PI / k.segments),
          angle = Math.PI / 2 + Math.PI / k.segments;
        radialHit('each low turned torus/scotia/shaft profile is physical', x, z, y, r, angle);
        radialHit('each turned profile also has a physical rear', x, z, y, r, angle + Math.PI);
      }
      const a = Math.atan2(x - c.porch.center[0], z - c.porch.center[1]);
      hit(
        'each capital has a physical abacus front',
        [x + 0.1, 3.87, z + k.abacusWidth / 2 + 0.012],
        [x + 0.1, 3.87, z + k.abacusWidth / 2 - 0.01],
        [x + 0.1, 3.87, z + k.abacusWidth / 2],
      );
      hit(
        'each capital retains original top connection',
        [x + 0.1, k.top + 0.005, z + 0.1],
        [x + 0.1, k.top - 0.005, z + 0.1],
        [x + 0.1, k.top, z + 0.1],
      );
      hit(
        'each abacus has a closed lower corner',
        [x + 0.34, 3.775, z + 0.34],
        [x + 0.34, 3.785, z + 0.34],
        [x + 0.34, 3.78, z + 0.34],
      );
      for (let i = 0; i < c.echinus.ribs; i++) {
        const angle = a + (i * 2 * Math.PI) / c.echinus.ribs,
          y = (c.echinus.bottom + c.echinus.top) / 2,
          r = 0.297;
        radialHit(
          'every echinus rib has a physical outer face',
          x,
          z,
          y,
          r + c.echinus.depth / 2,
          angle,
        );
        const n = [Math.cos(angle), 0, Math.sin(angle)],
          q = [x + (r - c.echinus.depth / 2) * n[0], y, z + (r - c.echinus.depth / 2) * n[2]];
        hit(
          'every echinus rib has a closed embedded back',
          q.map((v, i) => v - n[i] * 0.003),
          q.map((v, i) => v + n[i] * 0.003),
          q,
        );
      }
      for (let j = 0; j < v.countPerColumn; j++) {
        const angle = a + v.angleOffset + (j * 2 * Math.PI) / v.countPerColumn,
          nx = Math.sin(angle),
          nz = Math.cos(angle),
          cx = x + nx * v.centerRadius,
          cz = z + nz * v.centerRadius,
          toWorld = (u, y, dep) => [cx + u * nz + dep * nx, y, cz - u * nx + dep * nz],
          front = (name, u, y, dep) =>
            hit(name, toWorld(u, y, dep + 0.008), toWorld(u, y, dep - 0.008), toWorld(u, y, dep));
        front('every diagonal scroll has a solid front annulus', 0, v.centerY - 0.125, v.front);
        hit(
          'every diagonal scroll has a closed embedded back',
          toWorld(0, v.centerY - 0.1, v.back - 0.006),
          toWorld(0, v.centerY - 0.1, v.back + 0.006),
          toWorld(0, v.centerY - 0.1, v.back),
        );
        hit(
          'every scroll eye is recessed rather than painted on',
          toWorld(0, v.centerY, v.front + 0.025),
          toWorld(0, v.centerY, v.front - v.eyeDepth - 0.005),
          toWorld(0, v.centerY, v.front - v.eyeDepth),
        );
        const point = (t) => {
          const theta = Math.PI / 2 - t * 2 * Math.PI * v.spiralTurns,
            r = v.spiralOuterRadius + (v.spiralInnerRadius - v.spiralOuterRadius) * t;
          return [r * Math.cos(theta), v.centerY + r * Math.sin(theta)];
        };
        for (const i of [7, 19, 33, 44]) {
          const p = point(i / v.spiralSegments),
            q = point((i + 1) / v.spiralSegments),
            u = (p[0] + q[0]) / 2,
            y = (p[1] + q[1]) / 2,
            depth = (v.spiralDepth / 2) * Math.sin(Math.PI / 3),
            frontDepth = v.spiralPlane + depth,
            backDepth = v.spiralPlane - depth;
          front('every physical spiral has raised front depth', u, y, frontDepth);
          hit(
            'every physical spiral has a closed embedded back',
            toWorld(u, y, backDepth - 0.003),
            toWorld(u, y, backDepth + 0.003),
            toWorld(u, y, backDepth),
          );
        }
      }
    }
    const p = c.porch,
      cz = p.center[1];
    hit(
      'curved porch fascia has an actual projecting profile',
      [p.center[0], 4.055, cz + 2.36 + 0.015],
      [p.center[0], 4.055, cz + 2.36 - 0.01],
      [p.center[0], 4.055, cz + 2.36],
    );
    const s = c.ceiling;
    for (const [rx, rz, , bottom] of s.rings)
      for (const t of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const x = s.center[0] + rx * Math.cos(t),
          z = s.center[1] + rz * Math.sin(t);
        hit(
          'each elliptical ceiling moulding has closed underside',
          [x, bottom - 0.015, z],
          [x, bottom + 0.01, z],
          [x, bottom, z],
        );
      }
    hit(
      'ceiling mouldings leave the actual recessed soffit visible',
      [s.center[0] + 1.2, 3.82, s.center[1]],
      [s.center[0] + 1.2, 3.895, s.center[1]],
      [s.center[0] + 1.2, 3.88, s.center[1]],
    );
    hit(
      'stepped ceiling medallion is a physical closed relief',
      [s.center[0] - 0.45, 3.83, s.center[1]],
      [s.center[0] - 0.45, 3.87, s.center[1]],
      [s.center[0] - 0.45, s.medallionBottom, s.center[1]],
    );

    const stepped = [
      [-0.5, -0.22],
      [-0.4, -0.22],
      [-0.4, -0.34],
      [-0.22, -0.34],
      [-0.22, -0.44],
      [-0.1, -0.44],
      [-0.1, -0.5],
      [0.1, -0.5],
      [0.1, -0.44],
      [0.22, -0.44],
      [0.22, -0.34],
      [0.4, -0.34],
      [0.4, -0.22],
      [0.5, -0.22],
      [0.5, 0.22],
      [0.4, 0.22],
      [0.4, 0.34],
      [0.22, 0.34],
      [0.22, 0.44],
      [0.1, 0.44],
      [0.1, 0.5],
      [-0.1, 0.5],
      [-0.1, 0.44],
      [-0.22, 0.44],
      [-0.22, 0.34],
      [-0.4, 0.34],
      [-0.4, 0.22],
      [-0.5, 0.22],
    ];
    for (let i = 0; i < stepped.length; i++) {
      const a = stepped[i],
        b = stepped[(i + 1) % stepped.length],
        x = s.center[0] + (a[0] + b[0]) * 0.47 * s.medallionSize[0],
        z = s.center[1] + (a[1] + b[1]) * 0.47 * s.medallionSize[1];
      hit(
        'every stepped medallion segment has continuous physical underside',
        [x, 3.83, z],
        [x, 3.87, z],
        [x, s.medallionBottom, z],
      );
    }
    hit(
      'central square moulding is a physical closed stock',
      [s.center[0] + 0.125, 3.83, s.center[1]],
      [s.center[0] + 0.125, 3.87, s.center[1]],
      [s.center[0] + 0.125, s.medallionBottom - 0.006, s.center[1]],
    );
    hit(
      'central moulding has a genuine recessed counter',
      [s.center[0], 3.83, s.center[1]],
      [s.center[0], 3.895, s.center[1]],
      [s.center[0], 3.88, s.center[1]],
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
      model: 'taipei_story_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
