/** Check newly built solid lamps, retained surroundings and imported contacts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  hippodrome,
  santaMonicaPier,
  santaMonicaPierDistrict,
  santaMonicaPierSkyline,
  santaMonicaPierStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-santa-monica-pier.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q5/santa_monica_pier/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('lamp-construction-controls.json'),
  base = read('retained-lamp-surroundings-v3.json'),
  exterior = read('tower-exterior-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
assert.equal(exterior.originalRecipeHash, base.originalRecipeHash);
const body = new MeshBufferBuilder();
hippodrome(body, 3);
const bodySource = body.finalize(),
  geometry = new T.BufferGeometry();
geometry.setAttribute('position', new T.BufferAttribute(bodySource.positions, 3));
geometry.setIndex(new T.BufferAttribute(bodySource.indices, 1));
const bodyMesh = new T.Mesh(geometry, new T.MeshBasicMaterial({ side: T.FrontSide }));
bodyMesh.updateMatrixWorld(true);
let preservedExteriorRays = 0;
for (const p of exterior.controls) {
  const target = new T.Vector3(...p.target),
    normal = new T.Vector3(...p.normal);
  for (const [i, d] of [normal, normal.clone().negate(), new T.Vector3(0, 1, 0)].entries()) {
    const start = target.clone().addScaledVector(d, exterior.originDistance),
      hit = new T.Raycaster(start, d.clone().negate(), 1e-6, 90).intersectObject(bodyMesh)[0];
    assert(
      hit && Math.abs(hit.distance - p.distances[i]) < 0.00005,
      'original exterior first hit changed',
    );
    preservedExteriorRays++;
  }
}
assert.equal(preservedExteriorRays, 3096);
const frame = read('map-frame.json'),
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
  };
for (const p of c.removedLampPositions)
  assert(inside(p.position, frame.features.find((f) => f.id === p.insideMappedBuilding).rings[0]));
for (const [d, build] of [
  santaMonicaPierSkyline,
  santaMonicaPierDistrict,
  santaMonicaPierStreet,
  santaMonicaPier,
].entries()) {
  const builder = new MeshBufferBuilder();
  build(builder);
  const s = builder.finalize();
  validateAuthoredMesh(s, `Santa Monica source${d}`);
  const hash = createHash('sha256'),
    added = {},
    edges = new Map(),
    key = (p) => p.map((v) => Math.round(v * 1e5) / 1e5).join(',');
  let retained = 0;
  for (const g of s.groups) {
    if (['lampMetal', 'lampGlass'].includes(g.slot)) {
      added[g.slot] = g.count / 3;
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const ids = Array.from(s.indices.slice(k, k + 3)),
          p = ids.map((i) => Array.from(s.positions.slice(i * 3, i * 3 + 3))),
          uv = ids.map((i) => Array.from(s.uvs.slice(i * 2, i * 2 + 2)));
        assert(
          Math.abs(
            (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) -
              (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]),
          ) > 1e-10,
          'zero lamp UV',
        );
        for (let j = 0; j < 3; j++) {
          const e = [key(p[j]), key(p[(j + 1) % 3])].sort().join('|');
          const old = edges.get(e);
          edges.set(e, { n: (old?.n ?? 0) + 1, p: [p[j], p[(j + 1) % 3]] });
        }
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
  assert.deepEqual(added, d === 3 ? { lampMetal: 4959, lampGlass: 342 } : {});
  let embeddedEdges = 0;
  for (const { n, p } of edges.values()) {
    if (n % 2 === 0) {
      assert(n >= 2);
      continue;
    }
    assert.equal(n, 1);
    assert(
      c.lampPositions.some(([x, z]) =>
        p.every((v) => {
          const px = v[0] - x,
            pz = v[2] - z;
          if (Math.abs(v[1] - 2.98) < 0.0001) return Math.abs(px) + Math.abs(pz) < 0.221;
          if (Math.abs(v[1] - 7.88) < 0.04 && Math.hypot(px, pz) < 0.04)
            return v[1] < 7.9001 && Math.abs(px) + Math.abs(pz) < 0.0651;
          if (Math.abs(v[1] - 7.65) < 0.04 && Math.hypot(px, pz) < 0.04)
            return Math.abs(px) + Math.abs(pz) < 0.0651;
          const r = (0.3 * (7.98 - v[1])) / 0.33;
          if (v[1] > 7.84 && v[1] < 7.98 && Math.abs(px - 2.8) < 0.04 && Math.abs(pz) < 0.04)
            return Math.hypot(px - 2.8, pz) < r * Math.cos(Math.PI / 6) + 0.0001;
          return false;
        }),
      ),
      'open boundary is not embedded in original deck or closed lamp stock',
    );
    embeddedEdges++;
  }
  assert.equal(embeddedEdges, d === 3 ? 741 : 0);
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
      `Santa Monica imported${d}`,
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
    deckContacts = 0,
    lampSurfaces = 0;
  const hits = (a, b) => {
    const start = new T.Vector3(...a),
      delta = new T.Vector3(...b).sub(start);
    return new T.Raycaster(
      start,
      delta.clone().normalize(),
      1e-6,
      delta.length() - 1e-6,
    ).intersectObject(gltf.scene);
  };
  for (const p of c.originalOpeningControls.filter((p) => p.level === d)) {
    assert.equal(hits(p.a, p.b).length, 0, p.name);
    controls++;
    openings++;
  }
  for (const p of c.originalSurfaceControls.filter((p) => p.level === d)) {
    assert(
      hits([p.x, p.y + 0.1, p.z], [p.x, p.y - 0.1, p.z]).some(
        (h) => Math.abs(h.point.y - p.topY) < 0.0005,
      ),
      p.name,
    );
    controls++;
  }
  if (d === 3)
    for (const [x, z] of c.lampPositions) {
      // The post foot overlaps the unchanged wood deck; sample beside its base.
      assert(
        hits([x + 0.26, 3.08, z], [x + 0.26, 2.92, z]).some(
          (h) => Math.abs(h.point.y - 3) < 0.0004,
        ),
        'lamp on original deck',
      );
      controls++;
      deckContacts++;
      const point = (p) => [p[0] + x, p[1], p[2] + z],
        surface = (p) => {
          assert(
            hits(point([p[0], p[1], 0.35]), point([p[0], p[1], -0.35])).some(
              (h) => Math.abs(h.point.x - p[0] - x) < 0.0004,
            ),
            'solid lamp stock',
          );
          controls++;
          lampSurfaces++;
        };
      for (const y of [3.13, 3.7, 6.8]) surface([0, y, 0]);
      const arch = Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI - (i * Math.PI) / 6;
        return [1.4 + 1.4 * Math.cos(a), 7.9 + 1.4 * Math.sin(a) - (i === 0 ? 0.02 : 0), 0];
      });
      for (let i = 0; i < 6; i++) surface(arch[i].map((v, k) => (v + arch[i + 1][k]) / 2));
      const hook = c.hookPath.map((p) => [p[0], p[1] + 3, p[2]]);
      for (let i = 0; i < 3; i++) surface(hook[i].map((v, k) => (v + hook[i + 1][k]) / 2));
      for (const y of [7.4, 7.78]) {
        assert(
          hits(point([2.8, y, 0.4]), point([2.8, y, -0.4])).length > 0,
          'physical glass/shade',
        );
        controls++;
        lampSurfaces++;
      }
      assert.equal(
        hits(point([1.8, 8.2, 0.08]), point([1.8, 8.2, -0.08])).length,
        0,
        'open gooseneck counter',
      );
      controls++;
    }
  results.push({
    level: base.levels[d].level,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    originalOpeningChecks: openings,
    deckContacts,
    lampSurfaceChecks: lampSurfaces,
    embeddedBoundaryEdges: embeddedEdges,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'santa_monica_pier',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      preservedExteriorRays,
      removedHiddenTriangles: 1032,
      results,
    },
    null,
    2,
  ),
);
