/** Verify the actual imported tower craft, open terminal passages and frozen surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  hobokenTerminalDistrict,
  hobokenTerminalModel,
  hobokenTerminalSkyline,
  hobokenTerminalStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-hoboken-terminal.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/dr5/hoboken_terminal/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-tower-craft-surroundings.json'),
  c = read('tower-craft-construction-controls.json'),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [],
  expectedAdded = {
    towerClockCase: 1536,
    towerDial: 496,
    towerClockInk: 5856,
    towerCornice: 72,
    towerHood: 152,
    towerPilaster: 480,
    towerBracket: 224,
    towerScroll: 1856,
  };
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
for (const [d, build] of [
  hobokenTerminalSkyline,
  hobokenTerminalDistrict,
  hobokenTerminalStreet,
  hobokenTerminalModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b, frame);
  const s = b.finalize();
  validateAuthoredMesh(s, `Hoboken source${d}`);
  const h = createHash('sha256'),
    added = {};
  let retained = 0;
  for (const g of s.groups) {
    if (g.slot in expectedAdded) {
      added[g.slot] = g.count / 3;
      const edges = new Map(),
        key = (p) => p.map((v) => Math.round(v * 1e6)).join(',');
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const ids = Array.from(s.indices.slice(k, k + 3)),
          ps = ids.map((i) => Array.from(s.positions.slice(i * 3, i * 3 + 3))),
          uv = ids.map((i) => Array.from(s.uvs.slice(i * 2, i * 2 + 2))),
          area = Math.abs(
            (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) -
              (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]),
          );
        assert(area > 1e-10, `${g.slot}: zero UV`);
        for (let j = 0; j < 3; j++) {
          const edge = [key(ps[j]), key(ps[(j + 1) % 3])].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      for (const [e, n] of edges) assert(n >= 2 && n % 2 === 0, `${g.slot}: open edge ${e}/${n}`);
      continue;
    }
    retained += g.count / 3;
    for (let k = g.start; k < g.start + g.count; k++)
      for (const [key, stride] of [
        ['positions', 3],
        ['normals', 3],
        ['uvs', 2],
        ['colors', 3],
      ]) {
        const a = s[key].slice(s.indices[k] * stride, s.indices[k] * stride + stride);
        h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
  }
  assert.equal(`sha256:${h.digest('hex')}`, base.levels[d].retainedAttributeHash);
  assert.equal(retained, base.levels[d].retainedTriangles);
  assert.deepEqual(added, d === 3 ? expectedAdded : {});
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
      `Hoboken import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, s.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 8, 8, 8][d]);
  let controls = 1,
    visibilityRays = 0,
    openingChecks = 0;
  const intersections = (a, b, object = gltf.scene) => {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.sub(start),
      distance = delta.length();
    return new T.Raycaster(start, delta.normalize(), 1e-6, distance - 1e-6).intersectObject(object);
  };
  for (const p of c.originalOpeningControls.filter((p) => p.level === d)) {
    assert.equal(intersections(p.a, p.b).length, 0, p.name);
    controls++;
    openingChecks++;
  }
  if (d === 3) {
    const tau = Math.PI * 2,
      y = c.clockY,
      z = c.clockWallZ,
      stockPositions = [];
    for (const g of s.groups)
      if (['towerClockCase', 'towerDial', 'towerClockInk'].includes(g.slot))
        for (let k = g.start; k < g.start + g.count; k++)
          stockPositions.push(...s.positions.slice(s.indices[k] * 3, s.indices[k] * 3 + 3));
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(stockPositions, 3));
    const onlyClocks = new T.Mesh(geometry, new T.MeshBasicMaterial({ side: T.FrontSide }));
    onlyClocks.updateMatrixWorld(true);
    for (let face = 0; face < 4; face++) {
      const a = (face * tau) / 4,
        ca = Math.cos(a),
        sa = Math.sin(a),
        world = (p) => [ca * p[0] + sa * p[2], p[1], -sa * p[0] + ca * p[2]],
        ray = (x, y, a, b) => intersections(world([x, y, a]), world([x, y, b])),
        hit = (x, y, target, from, to, label) => {
          const hits = ray(x, y, from, to);
          assert(
            hits.some(
              (h) =>
                Math.abs(
                  world([0, 0, 1]).reduce((s, v, k) => s + v * h.point.getComponent(k), 0) - target,
                ) < 0.00015,
            ),
            `${face}/${label}: ${hits.map((h) => h.point.toArray())}`,
          );
          controls++;
        },
        clear = (x, y, from, to, label) => {
          assert.equal(ray(x, y, from, to).length, 0, `${face}/${label}`);
          controls++;
        };
      for (let i = 0; i < 32; i++) {
        const a = ((i + 0.5) * tau) / 32;
        hit(
          1.935 * Math.cos(a),
          y + 1.935 * Math.sin(a),
          z + 0.14,
          z + 0.18,
          z + 0.1,
          'stepped clock case front',
        );
        hit(
          1.935 * Math.cos(a),
          y + 1.935 * Math.sin(a),
          z - 0.09,
          z - 0.12,
          z - 0.04,
          'clock case back',
        );
        hit(
          1.3 * Math.cos(a),
          y + 1.3 * Math.sin(a),
          z + 0.058,
          z + 0.063,
          z + 0.03,
          'inner dial ring',
        );
      }
      for (let i = 0; i < 60; i++) {
        const a = Math.PI / 2 - (i * tau) / 60,
          r = ((i % 5 === 0 ? 1.69 : 1.74) + 1.805) / 2,
          x = r * Math.cos(a),
          yy = y + r * Math.sin(a);
        hit(x, yy, z + 0.055, z + 0.065, z + 0.03, 'minute mark front');
        hit(x, yy, z + 0.035, z + 0.032, z + 0.06, 'minute mark back');
      }
      const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let i = 0; i < 12; i++) {
        const a = Math.PI / 2 - (i * tau) / 12,
          ca = Math.cos(a),
          sa = Math.sin(a),
          local = (u, v) => [1.5 * ca + u * sa + v * ca, y + 1.5 * sa - u * ca + v * sa];
        let cursor = -(romans[i].length - 1) * 0.066;
        for (const ch of romans[i]) {
          const strokes =
            ch === 'I'
              ? [
                  [
                    [0, -0.18],
                    [0, 0.18],
                  ],
                ]
              : ch === 'V'
                ? [
                    [
                      [-0.05, 0.18],
                      [0, -0.18],
                    ],
                    [
                      [0, -0.18],
                      [0.05, 0.18],
                    ],
                  ]
                : [
                    [
                      [-0.05, -0.18],
                      [0.05, 0.18],
                    ],
                    [
                      [-0.05, 0.18],
                      [0.05, -0.18],
                    ],
                  ];
          for (const [p, q] of strokes) {
            const [x, yy] = local(cursor + (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
            hit(x, yy, z + 0.06, z + 0.065, z + 0.032, 'radial Roman numeral');
          }
          cursor += 0.132;
        }
      }
      hit(0.35, y - 0.2, z + 0.03, z + 0.033, z - 0.04, 'recessed white dial');
      hit(0, y, z + 0.145, z + 0.16, z + 0.11, 'raised clock hub');
      for (let ix = -9; ix <= 9; ix++)
        for (let iy = -9; iy <= 9; iy++) {
          const x = ix * 0.2,
            yy = iy * 0.2;
          if (Math.hypot(x, yy) > 1.8) continue;
          const start = world([x, y + yy, 4.3]),
            end = world([x, y + yy, 3.38]),
            expected = intersections(start, end, onlyClocks)[0],
            actual = intersections(start, end)[0];
          assert(
            expected && actual && Math.abs(expected.distance - actual.distance) < 0.0002,
            `clock obscured:face${face}/${x}/${yy}`,
          );
          controls++;
          visibilityRays++;
        }
      hit(0, 54.25, 3.86, 3.95, 3.75, 'projecting hood moulding');
      hit(0, 55.0, 3.5, 3.85, 3.4, 'recessed hood tympanum');
      clear(0, 55.0, 3.85, 3.51, 'real hood recess before backing');
      for (const sign of [-1, 1]) {
        hit(sign * 2.42, 58.8, 3.015, 3.08, 2.95, 'returned pilaster face');
        hit(sign * 2.42, 58.8, 2.905, 2.89, 2.94, 'closed pilaster back');
        hit(sign * 2.6, 61.25, 3.14, 3.2, 3.0, 'curved bracket front');
        hit(sign * 2.6, 61.25, 2.86, 2.83, 2.9, 'curved bracket back');
        for (const yy of [48.65, 53.45]) {
          const a = -0.35 + (5 * tau * 1.1) / 14,
            r = 0.3 - (0.245 * 5) / 14,
            x = sign * (2.8 + r * Math.cos(a)),
            y = yy + r * Math.sin(a);
          hit(x, y, 3.8, 3.83, 3.72, 'spiral ribbon front');
          hit(x, y, 3.6, 3.57, 3.64, 'spiral ribbon back');
          clear(sign * (2.8 + 0.175), yy, 3.805, 3.7, 'clear spiral ribbon counter');
        }
      }
      for (const [zp, lo, hi] of [
        [3.6, 56.1625, 56.41428571428571],
        [3.5, 61.70692307692308, 61.906666666666666],
      ]) {
        const down = intersections(world([0, hi + 0.05, zp]), world([0, lo - 0.05, zp])),
          up = intersections(world([0, lo - 0.05, zp]), world([0, hi + 0.05, zp]));
        assert(
          down.some((h) => Math.abs(h.point.y - hi) < 0.00015),
          'stepped cornice top',
        );
        assert(
          up.some((h) => Math.abs(h.point.y - lo) < 0.00015),
          'stepped cornice underside',
        );
        controls += 2;
      }
    }
    geometry.dispose();
    onlyClocks.material.dispose();
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    visibilityRays,
    originalOpeningChecks: openingChecks,
    failed: 0,
  });
  gltf.scene.traverse((o) => o.geometry?.dispose());
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'hoboken_terminal',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
