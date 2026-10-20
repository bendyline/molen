/** Verify imported pierced metalwork, attached span ties and immutable full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  clevedonPier,
  clevedonPierDistrict,
  clevedonPierSkyline,
  clevedonPierStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-clevedon-pier.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/gc/gcj/clevedon_pier/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-tracery-surroundings.json'),
  c = read('tracery-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [],
  newSlots = ['balconyIron', 'crestIron', 'spanTies', 'spanNodes'];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
for (const [d, build] of [
  clevedonPierSkyline,
  clevedonPierDistrict,
  clevedonPierStreet,
  clevedonPier,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const s = b.finalize();
  validateAuthoredMesh(s, `Clevedon source${d}`);
  const h = createHash('sha256'),
    added = {};
  let retained = 0;
  for (const g of s.groups) {
    if (newSlots.includes(g.slot)) {
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
        assert(area > 1e-10, `${g.slot}:zero UV`);
        for (let j = 0; j < 3; j++) {
          const edge = [key(ps[j]), key(ps[(j + 1) % 3])].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      if (d === 3)
        for (const [e, n] of edges) assert(n >= 2 && n % 2 === 0, `${g.slot}:open edge${e}/${n}`);
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
  assert.deepEqual(
    added,
    d === 3
      ? { balconyIron: 17064, crestIron: 3136, spanTies: 384, spanNodes: 448 }
      : d === 2
        ? { spanTies: 64 }
        : {},
  );
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
      `Clevedon import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, s.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 8, 8, 8][d]);
  let controls = 1,
    originalOpeningChecks = 0,
    balconyCounters = 0,
    crestCounters = 0,
    floorContacts = 0,
    tieContacts = 0;
  const intersections = (a, b) => {
      const start = new T.Vector3(...a),
        end = new T.Vector3(...b),
        delta = end.sub(start),
        distance = delta.length();
      return new T.Raycaster(start, delta.normalize(), 1e-6, distance - 1e-6).intersectObject(
        gltf.scene,
      );
    },
    match = (a, b, target, label) => {
      const hits = intersections(a, b),
        want = new T.Vector3(...target);
      assert(
        hits.some((h) => h.point.distanceTo(want) < 0.00025),
        `${label}:${hits.map((h) => h.point.toArray())}`,
      );
      controls++;
    };
  for (const p of c.originalOpeningControls.filter((p) => p.level === d)) {
    assert.equal(intersections(p.a, p.b).length, 0, p.name);
    controls++;
    originalOpeningChecks++;
  }
  if (d >= 2) {
    const t = c.ties,
      shore = -t.neckLength / 2,
      inset = (y) =>
        (t.rakedLegFootOffset * (y - t.rakedLegTopY)) / (t.rakedLegFootY - t.rakedLegTopY),
      cross = (a, b) => a[0] * b[1] - a[1] * b[0];
    for (let k = 0; k < t.spans; k++)
      for (const z of t.planes) {
        const start = shore + (k * t.neckLength) / t.spans,
          end = shore + ((k + 1) * t.neckLength) / t.spans,
          A = [k === 0 ? shore + t.shoreXOffset : start + inset(t.top), t.top],
          B = [end - inset(t.bottom), t.bottom],
          C = [
            k === 0 ? shore + t.shoreXOffset : start + inset(t.bottom),
            k === 0 ? t.shoreBottom : t.bottom,
          ],
          D = [end - inset(t.top), t.top];
        for (const [a, b] of [
          [A, B],
          [C, D],
        ]) {
          for (const u of [0.25, 0.75]) {
            const x = a[0] + (b[0] - a[0]) * u,
              y = a[1] + (b[1] - a[1]) * u;
            if (d === 3) {
              match(
                [x, y, z + 0.1],
                [x, y, z - 0.1],
                [x, y, z + t.width / 2],
                'physical cross-span tie front',
              );
              match(
                [x, y, z - 0.1],
                [x, y, z + 0.1],
                [x, y, z - t.width / 2],
                'physical cross-span tie back',
              );
            } else {
              const hits = [
                ...intersections([x, y, z + 0.08], [x, y, z - 0.08]),
                ...intersections([x, y, z - 0.08], [x, y, z + 0.08]),
              ];
              assert(
                hits.some((h) => Math.abs(h.point.z - z) < 0.00015),
                'street tie strip',
              );
              controls++;
            }
          }
          if (d === 3)
            for (const [j, [x, y]] of [a, b].entries()) {
              if (k === 0 && j === 0)
                match(
                  [shore + 0.2, y, z],
                  [shore - 0.2, y, z],
                  [shore + 0.05, y, z],
                  'shore tie embeds retained abutment',
                );
              else {
                const hits = intersections([x, y, z + 0.16], [x, y, z - 0.16]);
                assert(
                  hits.some((h) => Math.abs(h.point.z - (z + 0.11)) < 0.00025),
                  `tie endpoint meets retained raked leg:${k}/${x}/${y}`,
                );
                controls++;
              }
              tieContacts++;
            }
        }
        const r = B.map((v, i) => v - A[i]),
          ss = D.map((v, i) => v - C[i]),
          u =
            cross(
              C.map((v, i) => v - A[i]),
              ss,
            ) / cross(r, ss),
          x = A[0] + u * r[0],
          y = A[1] + u * r[1];
        if (d === 3) {
          match(
            [x, y, z + 0.1],
            [x, y, z - 0.1],
            [x, y, z + t.nodeDepth / 2],
            'crossing boss front',
          );
          match(
            [x, y, z - 0.1],
            [x, y, z + 0.1],
            [x, y, z - t.nodeDepth / 2],
            'crossing boss back',
          );
        }
        assert.equal(
          intersections([(start + end) / 2, -4, z + 0.15], [(start + end) / 2, -4, z - 0.15])
            .length,
          0,
          'open counter above crossed ties',
        );
        controls++;
      }
  }
  if (d === 3) {
    const head = c.headFrame,
      headWorld = (p) => [
        head.x + Math.cos(head.angle) * p[0] + Math.sin(head.angle) * p[2],
        p[1],
        head.z - Math.sin(head.angle) * p[0] + Math.cos(head.angle) * p[2],
      ],
      frame = (angle, x, z) => (p) =>
        headWorld([
          x + Math.cos(angle) * p[0] + Math.sin(angle) * p[2],
          p[1],
          z - Math.sin(angle) * p[0] + Math.cos(angle) * p[2],
        ]),
      bc = c.balcony;
    for (const [a, x, z, length] of [
      [Math.PI, 0, -bc.frontZ, bc.frontLength],
      [0, 0, bc.frontZ, bc.frontLength],
      [-Math.PI / 2, -bc.sideX, 0, bc.sideLength],
      [Math.PI / 2, bc.sideX, 0, bc.sideLength],
    ]) {
      const world = frame(a, x, z),
        n = Math.round(length / bc.modulePitch),
        pitch = length / n,
        hit = (x, y, target, from, to, label) =>
          match(world([x, y, from]), world([x, y, to]), world([x, y, target]), label);
      for (let i = 0; i < n; i++) {
        const x = -length / 2 + (i + 0.5) * pitch,
          y = bc.y;
        hit(x, y + 0.48 + bc.flowerYAspect * 0.16, 0.02, 0.026, 0.01, 'quatrefoil front');
        hit(x, y + 0.48 + bc.flowerYAspect * 0.16, -0.02, -0.026, -0.01, 'quatrefoil rear');
        assert.equal(
          intersections(world([x, y + 0.48, 0.026]), world([x, y + 0.48, -0.026])).length,
          0,
          'real quatrefoil counter',
        );
        controls++;
        balconyCounters++;
        for (const points of [
          [
            [x, y + 0.738],
            [x + 0.08, y + 0.84],
            [x, y + bc.height],
          ],
          [
            [x, y + 0.222],
            [x - 0.08, y + 0.11],
            [x, y],
          ],
        ])
          for (let j = 1; j < points.length; j++) {
            const xx = (points[j - 1][0] + points[j][0]) / 2,
              yy = (points[j - 1][1] + points[j][1]) / 2;
            hit(xx, yy, 0.02, 0.026, 0.01, 'returned flourish front');
            hit(xx, yy, -0.02, -0.026, -0.01, 'returned flourish back');
          }
      }
      for (let i = 0; i <= n; i++) {
        const x = -length / 2 + i * pitch;
        hit(x, bc.y + 0.5, 0.02, 0.026, 0.01, 'railing post front');
        hit(x, bc.y + 0.5, -0.02, -0.026, -0.01, 'railing post back');
        match(
          world([x, 3.82, 0]),
          world([x, 3.76, 0]),
          world([x, 3.8, 0]),
          'post embeds retained balcony floor',
        );
        floorContacts++;
      }
    }
    const cw = 3.354,
      cy = 8.92,
      cc = c.crest;
    for (let face = 0; face < 4; face++) {
      const a = (face * Math.PI) / 2,
        world = frame(a, (Math.sin(a) * cw) / 2, (Math.cos(a) * cw) / 2);
      for (let i = 0; i < cc.modulesPerSide; i++) {
        const x = -cw / 2 + ((i + 0.5) * cw) / cc.modulesPerSide;
        assert.equal(
          intersections(
            world([x, cy + cc.holeHeight, 0.026]),
            world([x, cy + cc.holeHeight, -0.026]),
          ).length,
          0,
          'real crest round counter',
        );
        controls++;
        crestCounters++;
        match(
          world([x, cy + 0.26, 0.026]),
          world([x, cy + 0.26, 0.01]),
          world([x, cy + 0.26, 0.02]),
          'crest stock front',
        );
        match(
          world([x, cy + 0.26, -0.026]),
          world([x, cy + 0.26, -0.01]),
          world([x, cy + 0.26, -0.02]),
          'crest stock rear',
        );
        match(
          world([x, cy + cc.holeHeight, 0]),
          world([x + 0.08, cy + cc.holeHeight, 0]),
          world([x + cc.holeRadius, cy + cc.holeHeight, 0]),
          'crest circular hole return',
        );
        match(
          world([x, cy + 0.11, 0]),
          world([x, cy + 0.07, 0]),
          world([x, cy + 0.1, 0]),
          'crest panel embeds retained base rail',
        );
      }
    }
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    originalOpeningChecks,
    balconyCounters,
    crestCounters,
    balconyFloorContacts: floorContacts,
    tieContacts,
    failed: 0,
  });
  gltf.scene.traverse((o) => o.geometry?.dispose());
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'clevedon_pier',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
