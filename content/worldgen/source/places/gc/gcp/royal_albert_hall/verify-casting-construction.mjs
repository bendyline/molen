/** Imported casting faces, complete rail embedment and preserved whole-model controls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  royalAlbertHall,
  royalAlbertHallDistrict,
  royalAlbertHallSkyline,
  royalAlbertHallStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-royal-albert-hall.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/gc/gcp/royal_albert_hall/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('casting-construction-controls.json'),
  base = read('retained-casting-surroundings.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [],
  [RX, RZ] = c.coreRadii,
  [CX, CZ] = c.coreCenter,
  tau = 2 * Math.PI;
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const polygon = (offset) =>
    Array.from({ length: 60 }, (_, i) => [
      CX + (RX + offset) * Math.sin((i * tau) / 60),
      CZ + (RZ + offset) * Math.cos((i * tau) / 60),
    ]),
  inner = polygon(0),
  outer = polygon(c.balusters.railOffset),
  inside = (p, ring) => {
    let yes = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
      if (
        ring[i][1] > p[1] !== ring[j][1] > p[1] &&
        p[0] <
          ((ring[j][0] - ring[i][0]) * (p[1] - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]
      )
        yes = !yes;
    return yes;
  },
  onRail = (p) => inside([p[0], p[2]], outer) && !inside([p[0], p[2]], inner),
  pose = (a, offset) => {
    const angle = Math.atan2(RZ * Math.sin(a), RX * Math.cos(a)),
      co = Math.cos(angle),
      si = Math.sin(angle),
      x = CX + (RX + offset) * Math.sin(a),
      z = CZ + (RZ + offset) * Math.cos(a);
    return (u, y, v) => [co * u + si * v + x, y, -si * u + co * v + z];
  };
for (const [d, build] of [
  royalAlbertHallSkyline,
  royalAlbertHallDistrict,
  royalAlbertHallStreet,
  royalAlbertHall,
].entries()) {
  const builder = new MeshBufferBuilder();
  build(builder);
  const s = builder.finalize();
  validateAuthoredMesh(s, `Royal Albert source${d}`);
  const hash = createHash('sha256'),
    added = {};
  let retained = 0,
    embeddedEdges = 0;
  for (const g of s.groups) {
    if (['castBaluster', 'corniceConsole'].includes(g.slot)) {
      added[g.slot] = g.count / 3;
      const edges = new Map(),
        key = (p) => p.map((v) => Math.round(v * 1e5)).join(',');
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const ids = Array.from(s.indices.slice(k, k + 3)),
          p = ids.map((i) => Array.from(s.positions.slice(i * 3, i * 3 + 3))),
          uv = ids.map((i) => Array.from(s.uvs.slice(i * 2, i * 2 + 2)));
        assert(
          Math.abs(
            (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) -
              (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]),
          ) > 1e-10,
          'zero casting UV',
        );
        for (let j = 0; j < 3; j++) {
          const e = [key(p[j]), key(p[(j + 1) % 3])].sort().join('|'),
            old = edges.get(e);
          edges.set(e, { n: (old?.n ?? 0) + 1, p: [p[j], p[(j + 1) % 3]] });
        }
      }
      for (const { n, p } of edges.values()) {
        if (n % 2 === 0) {
          assert(n >= 2);
          continue;
        }
        assert.equal(n, 1);
        assert.equal(g.slot, 'castBaluster');
        assert(
          p.every(
            (v) =>
              onRail(v) &&
              (Math.abs(v[1] - c.balusters.profiles[0][0]) < 0.0001 ||
                Math.abs(v[1] - c.balusters.profiles.at(-1)[0]) < 0.0001),
          ),
          'exposed open casting boundary',
        );
        embeddedEdges++;
      }
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
        hash.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
      }
  }
  assert.equal('sha256:' + hash.digest('hex'), base.levels[d].retainedAttributeHash);
  assert.equal(retained, base.levels[d].retainedTriangles);
  assert.deepEqual(added, d === 3 ? { castBaluster: 5400, corniceConsole: 2160 } : {});
  assert.equal(embeddedEdges, d === 3 ? 1800 : 0);
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
      `Royal Albert imported${d}`,
    );
    triangles += indices.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, s.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 8, 8, 8][d]);
  let controls = 0,
    openings = 0,
    balusterFaces = 0,
    railContacts = 0,
    openCounters = 0,
    consoleFaces = 0,
    consoleContacts = 0,
    embeddedEndVertices = 0;
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
        hits(a, b).some((h) => h.point.distanceTo(new T.Vector3(...p)) < 0.0005),
        `${d}:${label}:${JSON.stringify(
          hits(a, b)
            .slice(0, 4)
            .map((h) => h.point.toArray()),
        )}`,
      );
      controls++;
    };
  for (const p of c.originalOpeningControls.filter((p) => p.level === d)) {
    assert.equal(hits(p.a, p.b).length, 0, p.name);
    controls++;
    openings++;
  }
  for (const p of c.originalSurfaceControls.filter((p) => p.level === d))
    match([p.x, p.topY + 0.12, p.z], [p.x, p.topY - 0.12, p.z], [p.x, p.topY, p.z], p.name);
  if (d === 3) {
    const b = c.balusters;
    for (let i = 0; i < b.count; i++) {
      const a = (i * tau) / b.count,
        p = pose(a, b.centerOffset);
      for (const [y, r] of [b.profiles[0], b.profiles.at(-1)])
        for (let j = 0; j < b.sides; j++) {
          const v = p(r * Math.cos((-j * tau) / b.sides), y, r * Math.sin((-j * tau) / b.sides));
          assert(onRail(v), 'complete end-ring embedment in original60-sided stone band');
          embeddedEndVertices++;
        }
      for (const y of [17.63, 17.95, 18.3]) {
        const index = b.profiles.findIndex((p) => p[0] > y),
          lower = b.profiles[index - 1],
          upper = b.profiles[index],
          r = lower[1] + ((upper[1] - lower[1]) * (y - lower[0])) / (upper[0] - lower[0]),
          u = r * 0.25;
        for (const sign of [-1, 1]) {
          match(
            p(u, y, sign * 0.2),
            p(u, y, 0),
            p(u, y, (sign * (r - u)) / Math.sqrt(3)),
            'continuous bellied casting surface',
          );
          balusterFaces++;
        }
      }
      match(
        p(0, 17.6, 0),
        p(0, 17.4, 0),
        p(0, b.lowerRail[1], 0),
        'baluster foot overlaps unchanged lower stone rail',
      );
      match(
        p(0, 18.4, 0),
        p(0, 18.6, 0),
        p(0, b.upperRail[0], 0),
        'baluster head overlaps unchanged upper stone rail',
      );
      railContacts += 2;
      const angle = ((i + 0.5) * tau) / b.count,
        nearPorch = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, tau].some(
          (q) => Math.abs(angle - q) < 0.27,
        );
      if (!nearPorch) {
        const q = pose(angle, 0);
        assert.equal(
          hits(q(0, 18.1, 0.4), q(0, 18.1, -0.4)).length,
          0,
          'real open balustrade counter',
        );
        controls++;
        openCounters++;
      }
    }
    for (let i = 0; i < c.consoles.count; i++) {
      const p = pose((i * tau) / c.consoles.count, c.consoles.centerOffset);
      match(
        p(0, 22.2, 0.4),
        p(0, 22.2, 0.17),
        p(0, 22.2, 0.1 + (0.21 / 0.29) * 0.15),
        'console projecting front',
      );
      match(p(0, 22.05, -0.2), p(0, 22.05, -0.1), p(0, 22.05, -0.14), 'console closed back');
      for (const sign of [-1, 1])
        match(
          p(sign * 0.18, 22.12, 0),
          p(0, 22.12, 0),
          p(sign * 0.11, 22.12, 0),
          'console closed side cap',
        );
      match(
        p(0, 22.08, 0.175),
        p(0, 22.18, 0.175),
        p(0, 22.135, 0.175),
        'console sloping underside',
      );
      consoleFaces += 5;
      match(
        p(0, 22.4, -0.12),
        p(0, 22.2, -0.12),
        p(0, 22.33, -0.12),
        'console rear embeds unchanged cornice band',
      );
      consoleContacts++;
    }
  }
  results.push({
    level: base.levels[d].level,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    originalOpeningChecks: openings,
    balusterSurfaceChecks: balusterFaces,
    originalRailContacts: railContacts,
    openBalustradeCounters: openCounters,
    embeddedEndVertices,
    embeddedBoundaryEdges: embeddedEdges,
    consoleSurfaceChecks: consoleFaces,
    originalCorniceContacts: consoleContacts,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'royal_albert_hall',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
