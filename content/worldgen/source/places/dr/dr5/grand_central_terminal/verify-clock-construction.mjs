/** Check the actual imported physical clock and immutable original surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  grandCentralTerminalDistrict,
  grandCentralTerminalModel,
  grandCentralTerminalSkyline,
  grandCentralTerminalStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-grand-central-terminal.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/dr5/grand_central_terminal/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-clock-surroundings-v2.json'),
  c = read('clock-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [],
  addedSlots = { clockContactStone: 648, clockStone: 768, clockGlazing: 1696, clockBrass: 3636 };
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
for (const [d, build] of [
  grandCentralTerminalSkyline,
  grandCentralTerminalDistrict,
  grandCentralTerminalStreet,
  grandCentralTerminalModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const s = b.finalize();
  validateAuthoredMesh(s, `Grand Central source${d}`);
  const h = createHash('sha256'),
    added = {};
  let retained = 0;
  for (const g of s.groups) {
    if (g.slot in addedSlots) {
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
        assert(area > 1e-9, `${g.slot}: degenerate UV`);
        for (let j = 0; j < 3; j++) {
          const edge = [key(ps[j]), key(ps[(j + 1) % 3])].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      for (const [e, n] of edges)
        assert(n >= 2 && n % 2 === 0, `${g.slot}: unclosed edge ${e} ${n}`);
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
        const i = s.indices[k],
          a = s[key].slice(i * stride, i * stride + stride);
        h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
  }
  assert.equal(`sha256:${h.digest('hex')}`, base.levels[d].retainedAttributeHash);
  assert.equal(retained, base.levels[d].retainedTriangles);
  assert.deepEqual(added, d === 3 ? addedSlots : {});
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
      `Grand Central imported${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, s.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 8, 8, 8][d]);
  let controls = 1;
  const ray = (x, y, a, b) =>
      new T.Raycaster(
        new T.Vector3(x, y, a),
        new T.Vector3(0, 0, Math.sign(b - a)),
        1e-6,
        Math.abs(b - a) - 1e-6,
      ).intersectObject(gltf.scene),
    hasZ = (x, y, target, from, to, label) => {
      const hits = ray(x, y, from, to);
      assert(
        hits.some((h) => Math.abs(h.point.z - target) < 0.0001),
        `${label}: ${hits.map((h) => h.point.z)}`,
      );
      controls++;
    },
    clear = (x, y, from, to, label) => {
      assert.equal(ray(x, y, from, to).length, 0, label);
      controls++;
    };
  if (d === 3) {
    // Compare frontmost imported intersections with the clock stock alone so
    // retained sculpture cannot hide a correct but invisible clock surface.
    const positions = [];
    for (const g of s.groups)
      if (g.slot in addedSlots && g.slot !== 'clockContactStone')
        for (let k = g.start; k < g.start + g.count; k++)
          positions.push(...s.positions.slice(s.indices[k] * 3, s.indices[k] * 3 + 3));
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    const onlyClock = new T.Mesh(geometry, new T.MeshBasicMaterial({ side: T.FrontSide }));
    onlyClock.updateMatrixWorld(true);
    for (let ix = -13; ix <= 13; ix++)
      for (let iy = -13; iy <= 13; iy++) {
        const x = ix * 0.145,
          y = iy * 0.145;
        if (Math.hypot(x, y) > 1.97) continue;
        const origin = new T.Vector3(c.center[0] + x, c.center[1] + y, c.center[2] + 1),
          caster = new T.Raycaster(origin, new T.Vector3(0, 0, -1), 1e-6, 1.1),
          expected = caster.intersectObject(onlyClock)[0],
          actual = caster.intersectObject(gltf.scene)[0];
        assert(
          expected && actual && Math.abs(expected.point.z - actual.point.z) < 0.0001,
          `sculpture blocks clock at ${x},${y}: ${expected?.point.z}/${actual?.point.z}`,
        );
        controls++;
      }
    geometry.dispose();
    onlyClock.material.dispose();
    const [cx, cy, z] = c.center,
      tau = Math.PI * 2;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const x = cx + 2.3 * Math.cos(a),
        y = cy + 2.3 * Math.sin(a);
      hasZ(
        x,
        y,
        z + 0.03 + ((2.34 - 2.3) / 0.17) * 0.04,
        z + 0.12,
        z - 0.29,
        'profiled stone face',
      );
      hasZ(x, y, z - 0.3, z - 0.35, z - 0.2, 'closed stone back');
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 2 - (i * tau) / 12,
        ca = Math.cos(a),
        sa = Math.sin(a),
        local = (u, v) => [cx + 1.65 * ca + u * sa + v * ca, cy + 1.65 * sa - u * ca + v * sa],
        [x, y] = local(0, 0.29);
      hasZ(x, y, z + 0.055, z + 0.12, z - 0.01, 'burgundy oval front');
      hasZ(x, y, z + 0.025, z + 0.021, z + 0.06, 'closed burgundy oval back');
      clear(x, y, z + 0.104, z + 0.057, 'real oval frame counter');
      const [u, v] = local(0.265, 0);
      hasZ(u, v, z + 0.1, z + 0.13, z + 0.06, 'oval brass rim front');
      hasZ(u, v, z + 0.05, z + 0.04, z + 0.08, 'oval brass rim return');
      const f = a + tau / 24;
      for (const [r, front, back] of [
        [2.02, 0.095, 0.025],
        [1.285, 0.105, 0.035],
      ]) {
        const x = cx + r * Math.cos(f),
          y = cy + r * Math.sin(f);
        hasZ(x, y, z + front, z + 0.13, z + 0.01, 'gold annular rim front');
        hasZ(x, y, z + back, z + 0.021, z + 0.115, 'gold annular rim back');
      }
      const sx = cx + 1.5 * Math.cos(f),
        sy = cy + 1.5 * Math.sin(f);
      hasZ(sx, sy, z + 0.11, z + 0.13, z + 0.045, 'raised radial spoke');
      hasZ(sx, sy, z + 0.05, z + 0.04, z + 0.12, 'closed radial spoke back');
      const romans = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      let cursor = -(romans[i].length - 1) * 0.066;
      for (const ch of romans[i]) {
        const strokes =
          ch === 'I'
            ? [
                [
                  [0, -0.235],
                  [0, 0.235],
                ],
              ]
            : ch === 'V'
              ? [
                  [
                    [-0.05, 0.235],
                    [0, -0.235],
                  ],
                  [
                    [0, -0.235],
                    [0.05, 0.235],
                  ],
                ]
              : [
                  [
                    [-0.05, -0.235],
                    [0.05, 0.235],
                  ],
                  [
                    [-0.05, 0.235],
                    [0.05, -0.235],
                  ],
                ];
        for (const [p, q] of strokes) {
          const [x, y] = local(cursor + (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
          hasZ(x, y, z + 0.095, z + 0.115, z + 0.06, 'radially oriented ivory numeral');
        }
        cursor += 0.132;
      }
      let prev = [cx + 0.22 * ca, cy + 0.22 * sa];
      for (let j = 1; j <= 4; j++) {
        const r = 0.22 + j * 0.235,
          b = a + 0.11 * Math.sin((j * Math.PI) / 2),
          next = [cx + r * Math.cos(b), cy + r * Math.sin(b)],
          x = (prev[0] + next[0]) / 2,
          y = (prev[1] + next[1]) / 2;
        hasZ(x, y, z + 0.065, z + 0.08, z + 0.03, 'physical simplified vine front');
        hasZ(x, y, z + 0.035, z + 0.03, z + 0.07, 'closed simplified vine back');
        prev = next;
      }
    }
    for (const [len, a, back] of [
      [1.96, Math.PI * 0.31, 0.14],
      [1.43, Math.PI * 0.17, 0.2],
    ]) {
      const x = cx + (len - 0.06) * Math.cos(a),
        y = cy + (len - 0.06) * Math.sin(a);
      hasZ(x, y, z + back + 0.07, z + 0.3, z + 0.13, 'raised arrow hand front');
      hasZ(x, y, z + back, z + 0.13, z + 0.3, 'closed arrow hand back');
    }
    hasZ(cx, cy, z + 0.335, z + 0.4, z + 0.3, 'raised central hub');
    hasZ(cx + 0.42, cy - 0.1, z + 0.02, z + 0.03, z - 0.01, 'recessed blue dial field');
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    failed: 0,
  });
  gltf.scene.traverse((o) => o.geometry?.dispose());
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'grand_central_terminal',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
