/** Imported moulding, hood, joinery and preserved whole-exterior controls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  rymanAuditorium,
  rymanAuditoriumDistrict,
  rymanAuditoriumSkyline,
  rymanAuditoriumStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-ryman-auditorium.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dn/dn6/ryman_auditorium/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('lancet-construction-controls.json'),
  base = read('retained-lancet-surroundings.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [],
  slots = ['lancetMoulding', 'lancetHood', 'windowJoinery'];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const arch = (w, h, n) => {
  const p = [
      [-w / 2, 0],
      [w / 2, 0],
    ],
    base = h - (w * Math.sqrt(3)) / 2;
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI) / 3 / n;
    p.push([-w / 2 + w * Math.cos(a), base + w * Math.sin(a)]);
  }
  for (let i = 1; i <= n; i++) {
    const a = (2 * Math.PI) / 3 + (i * Math.PI) / 3 / n;
    p.push([w / 2 + w * Math.cos(a), base + w * Math.sin(a)]);
  }
  return p;
};
for (const [d, build] of [
  rymanAuditoriumSkyline,
  rymanAuditoriumDistrict,
  rymanAuditoriumStreet,
  rymanAuditorium,
].entries()) {
  const builder = new MeshBufferBuilder();
  build(builder);
  const s = builder.finalize();
  validateAuthoredMesh(s, `Ryman source${d}`);
  const hash = createHash('sha256'),
    added = {};
  let retained = 0;
  for (const g of s.groups) {
    if (slots.includes(g.slot)) {
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
          'zero new stock UV',
        );
        for (let j = 0; j < 3; j++) {
          const e = [key(p[j]), key(p[(j + 1) % 3])].sort().join('|');
          edges.set(e, (edges.get(e) ?? 0) + 1);
        }
      }
      for (const [e, n] of edges) assert(n >= 2 && n % 2 === 0, `${g.slot}:unpaired ${e}/${n}`);
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
  assert.deepEqual(
    added,
    d === 3 ? { lancetMoulding: 912, lancetHood: 408, windowJoinery: 72 } : {},
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
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Ryman imported${d}`,
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
    mouldingFaces = 0,
    hoodFaces = 0,
    glassChecks = 0;
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
        label,
      );
      controls++;
    };
  for (const p of c.originalOpeningControls.filter((p) => p.level === d)) {
    assert.equal(hits(p.a, p.b).length, 0, p.name);
    controls++;
    openings++;
  }
  for (const p of c.originalSurfaceControls.filter((p) => p.level === d))
    match([p.x, p.y + 0.1, p.z], [p.x, p.y - 0.1, p.z], [p.x, p.topY, p.z], p.name);
  if (d === 3)
    for (const op of c.windows) {
      const contours = c.profiles.map(({ pad, z }) =>
        arch(op.w + pad * 2, op.h + pad * 2, c.archSegmentsPerHalf).map(([u, y]) => [
          u + op.x,
          y + op.y - pad,
          z + c.frontZ,
        ]),
      );
      for (let i = 0; i < contours[0].length; i++) {
        const j = (i + 1) % contours[0].length,
          front = contours[1][i].map(
            (_, k) =>
              (contours[1][i][k] + contours[1][j][k] + contours[2][i][k] + contours[2][j][k]) / 4,
          ),
          back = contours[0][i].map(
            (_, k) =>
              (contours[0][i][k] + contours[0][j][k] + contours[3][i][k] + contours[3][j][k]) / 4,
          );
        match(
          [front[0], front[1], c.frontZ + 0.3],
          [front[0], front[1], c.frontZ - 0.04],
          front,
          'stepped front moulding',
        );
        match(
          [back[0], back[1], c.frontZ - 0.04],
          [back[0], back[1], c.frontZ + 0.2],
          back,
          'closed moulding back embedded in unchanged wall',
        );
        mouldingFaces += 2;
      }
      const path = arch(c.hood.w, c.hood.h, c.hood.archSegmentsPerHalf)
        .slice(2)
        .map(([u, y]) => [u + op.x, y + op.y, c.frontZ + c.hood.centerZ]);
      for (let i = 0; i < path.length - 1; i++) {
        const mid = path[i].map((v, k) => (v + path[i + 1][k]) / 2);
        for (const sign of [-1, 1]) {
          const target = [mid[0], mid[1], mid[2] + (sign * c.hood.facadeDepth) / 2];
          match(
            [mid[0], mid[1], target[2] + sign * 0.06],
            [mid[0], mid[1], target[2] - sign * 0.06],
            target,
            'separate solid hood front/back',
          );
          hoodFaces++;
        }
      }
      for (const end of [0, path.length - 1]) {
        const p = path[end],
          q = path[end === 0 ? 1 : end - 1],
          delta = new T.Vector3(...p).sub(new T.Vector3(...q)).normalize(),
          target = new T.Vector3(...p);
        match(
          target.clone().addScaledVector(delta, 0.06).toArray(),
          target.clone().addScaledVector(delta, -0.06).toArray(),
          p,
          'closed hood foot cap',
        );
        hoodFaces++;
      }
      match(
        [op.x, 10.87, c.frontZ + 0.3],
        [op.x, 10.87, c.frontZ - 0.05],
        [op.x, 10.87, c.frontZ],
        'visible brick arch gap separates inner frame and upper hood',
      );
      for (const y of [7.8, 9.3]) {
        assert.equal(
          hits([op.x, y, c.frontZ + 0.2], [op.x, y, c.frontZ - 0.06]).length,
          0,
          'original clear window recess',
        );
        controls++;
        match(
          [op.x, y, c.frontZ - 0.06],
          [op.x, y, c.frontZ - 0.23],
          [op.x, y, c.frontZ - 0.18],
          'retained recessed glass',
        );
        glassChecks++;
      }
      const y = op.y + op.h * c.joinery.fractionY,
        z = c.frontZ + c.joinery.centerZ;
      for (const sign of [-1, 1])
        match(
          [op.x, y, z + sign * 0.09],
          [op.x, y, z - sign * 0.09],
          [op.x, y, z + (sign * c.joinery.facadeDepth) / 2],
          'single physical sash front/back',
        );
      assert(
        c.profiles.some((p) => p.z < 0) && c.hood.centerZ - c.hood.facadeDepth / 2 < 0,
        'new stone stock embeds original wall',
      );
    }
  results.push({
    level: base.levels[d].level,
    triangles,
    drawCalls: level.drawCalls,
    retainedTriangles: retained,
    added,
    controls,
    originalOpeningChecks: openings,
    mouldingSurfaceChecks: mouldingFaces,
    hoodSurfaceAndCapChecks: hoodFaces,
    retainedGlassChecks: glassChecks,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'ryman_auditorium',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
