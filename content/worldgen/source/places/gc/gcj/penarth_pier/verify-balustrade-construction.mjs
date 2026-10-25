/** Check imported physical castings, counters, deck contacts and unchanged full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  penarthPier,
  penarthPierDistrict,
  penarthPierSkyline,
  penarthPierStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-penarth-pier.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/gc/gcj/penarth_pier/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('balustrade-construction-controls.json'),
  baseline = read('retained-balustrade-surroundings.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
for (const [d, build] of [
  penarthPierSkyline,
  penarthPierDistrict,
  penarthPierStreet,
  penarthPier,
].entries()) {
  const builder = new MeshBufferBuilder();
  build(builder);
  const s = builder.finalize();
  validateAuthoredMesh(s, `Penarth source ${d}`);
  const h = createHash('sha256'),
    added = {};
  let retained = 0;
  for (const g of s.groups) {
    if (['railWhite', 'railGreen'].includes(g.slot)) {
      added[g.slot] = g.count / 3;
      const edges = new Map(),
        key = (p) => p.map((v) => Math.round(v * 1e6)).join(',');
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const ids = Array.from(s.indices.slice(k, k + 3)),
          ps = ids.map((i) => Array.from(s.positions.slice(i * 3, i * 3 + 3))),
          uv = ids.map((i) => Array.from(s.uvs.slice(i * 2, i * 2 + 2)));
        assert(
          Math.abs(
            (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) -
              (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]),
          ) > 1e-10,
          'degenerate UV',
        );
        for (let j = 0; j < 3; j++) {
          const e = [key(ps[j]), key(ps[(j + 1) % 3])].sort().join('|');
          edges.set(e, (edges.get(e) ?? 0) + 1);
        }
      }
      for (const [e, n] of edges)
        assert(n >= 2 && n % 2 === 0, `${g.slot}:unpaired edge ${e}/${n}`);
      continue;
    }
    retained += g.count / 3;
    for (let k = g.start; k < g.start + g.count; k++)
      for (const [key, n] of [
        ['positions', 3],
        ['normals', 3],
        ['uvs', 2],
        ['colors', 3],
      ]) {
        const v = s[key].slice(s.indices[k] * n, s.indices[k] * n + n);
        h.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
      }
  }
  assert.equal(`sha256:${h.digest('hex')}`, baseline.levels[d].retainedAttributeHash);
  assert.equal(retained, baseline.levels[d].retainedTriangles);
  assert.deepEqual(added, d === 3 ? { railGreen: 4500, railWhite: 20064 } : {});
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
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Penarth runtime ${d}`,
    );
    triangles += indices.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, s.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 8, 8, 8][d]);
  let controls = 1,
    openingChecks = 0,
    counters = 0,
    panels = 0,
    postContacts = 0;
  const hits = (a, b) => {
      const start = new T.Vector3(...a),
        delta = new T.Vector3(...b).sub(start);
      return new T.Raycaster(
        start,
        delta.clone().normalize(),
        1e-6,
        delta.length() - 1e-6,
      ).intersectObject(gltf.scene);
    },
    match = (a, b, p, label) => {
      assert(
        hits(a, b).some((h) => h.point.distanceTo(new T.Vector3(...p)) < 0.00035),
        label,
      );
      controls++;
    };
  for (const p of c.originalOpeningControls.filter((p) => p.level === d)) {
    assert.equal(hits(p.a, p.b).length, 0, p.name);
    controls++;
    openingChecks++;
  }
  if (d === 3)
    for (const seg of c.segments) {
      const dx = (seg.b[0] - seg.a[0]) / seg.length,
        dz = (seg.b[1] - seg.a[1]) / seg.length,
        pitch = seg.length / seg.panels,
        point = (x, y, z) => [
          (seg.a[0] + seg.b[0]) / 2 + dx * x - dz * z,
          y,
          (seg.a[1] + seg.b[1]) / 2 + dz * x + dx * z,
        ];
      for (let i = 0; i < seg.panels; i++) {
        const x = -seg.length / 2 + (i + 0.5) * pitch,
          width = pitch - c.postWidth;
        for (const ring of c.counterCoordinates) {
          const u = ring.reduce((n, p) => n + p[0], 0) / 3,
            v = ring.reduce((n, p) => n + p[1], 0) / 3,
            y = c.panelBaseY + v * c.panelHeight;
          assert.equal(
            hits(point(x + u * width, y, 0.09), point(x + u * width, y, -0.09)).length,
            0,
            'fan counter must be genuinely open',
          );
          controls++;
          counters++;
          const a = ring[0],
            b = ring[1],
            mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
            area = ring.reduce(
              (n, a, i) =>
                n + a[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * a[1],
              0,
            ),
            vx = (b[0] - a[0]) * width,
            vy = (b[1] - a[1]) * c.panelHeight,
            l = Math.hypot(vx, vy),
            inward = [(-vy / l) * Math.sign(area), (vx / l) * Math.sign(area)],
            cx = x + mid[0] * width,
            cy = c.panelBaseY + mid[1] * c.panelHeight;
          match(
            point(cx + inward[0] * 0.01, cy + inward[1] * 0.01, 0),
            point(cx - inward[0] * 0.01, cy - inward[1] * 0.01, 0),
            point(cx, cy, 0),
            'physical counter inner return',
          );
        }
        for (const sign of [-1, 1])
          match(
            point(x, c.panelBaseY + 0.07, sign * 0.09),
            point(x, c.panelBaseY + 0.07, -sign * 0.09),
            point(x, c.panelBaseY + 0.07, (sign * c.panelDepth) / 2),
            'physical casting front/back',
          );
        panels++;
      }
      for (let i = 0; i <= seg.panels; i++) {
        const x = -seg.length / 2 + i * pitch;
        for (const sign of [-1, 1])
          match(
            point(x, 1.3, sign * 0.09),
            point(x, 1.3, -sign * 0.09),
            point(x, 1.3, (sign * c.postWidth) / 2),
            'physical green post',
          );
        const shift = i === seg.panels ? -0.07 : 0.07;
        assert(
          [-1, 1].some((sign) =>
            hits(point(x + shift, 0.62, sign * 0.09), point(x + shift, 0.55, sign * 0.09)).some(
              (h) => Math.abs(h.point.y - c.deckY) < 0.00035,
            ),
          ),
          'post needs retained deck contact',
        );
        assert(c.postBaseY < c.deckY && c.postTopY > c.panelTopY);
        controls++;
        postContacts++;
      }
    }
  results.push({
    level: baseline.levels[d].level,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    originalOpeningChecks: openingChecks,
    castPanels: panels,
    openFanCounters: counters,
    postDeckContacts: postContacts,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'penarth_pier',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
