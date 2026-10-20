/** Verify the imported copper stacks, physical louvers and retained surrounding hotel. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  frontenac,
  frontenacDistrict,
  frontenacSkyline,
  frontenacStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-chateau-frontenac.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/f2/f2m/chateau_frontenac/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  c = read('roof-vent-construction-controls.json'),
  base = read('retained-roof-surroundings.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  inside = (ps) =>
    ps.every(
      (p) =>
        Math.abs(p[0]) >= 2.89 &&
        Math.abs(p[0]) <= 6.56 &&
        Math.abs(p[2]) <= 4.31 &&
        p[1] >= 59.29 &&
        p[1] <= 65.91,
    ) ||
    ps.every(
      (p) =>
        p[0] >= -3.51 &&
        p[0] <= 3.51 &&
        p[2] >= -1.21 &&
        p[2] <= 8.71 &&
        p[1] >= 63.99 &&
        p[1] <= 75.51,
    ),
  transform = (p, a, center = [0, 0]) => [
    center[0] + Math.cos(a) * p[0] + Math.sin(a) * p[2],
    p[1],
    center[1] - Math.sin(a) * p[0] + Math.cos(a) * p[2],
  ];
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  frontenacSkyline,
  frontenacDistrict,
  frontenacStreet,
  frontenac,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Frontenac source ${d}`);
  const hash = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3));
    if (d === 3 && inside(ids.map((i) => Array.from(source.positions.slice(i * 3, i * 3 + 3)))))
      continue;
    retainedTriangles++;
    for (const i of ids)
      for (const [key, stride] of [
        ['positions', 3],
        ['normals', 3],
        ['uvs', 2],
        ['colors', 3],
      ]) {
        const a = source[key].slice(i * stride, i * stride + stride);
        hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
  }
  assert.equal(`sha256:${hash.digest('hex')}`, base.levels[d].attributeHash, `retained ${d}`);
  assert.equal(retainedTriangles, base.levels[d].retainedTriangles);
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
      `Frontenac import ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
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
  check('exact three lower levels or all original surrounding attributes retained', true);
  if (d === 3) {
    const [x, z] = c.westStack.center,
      cap = ray([x + 0.3, 75.4, z + 0.1], [x + 0.3, 75, z + 0.1]);
    check(
      'closed octagonal cap below original spike skyline',
      cap.length > 0 && Math.abs(cap[0].point.y - 75.2) < 0.0001,
    );
    for (const y of [68.2, 70.9, 73.1])
      check(
        'closed octagonal copper shaft side',
        ray([x - 1.1, y, z + 0.12], [x - 0.5, y, z + 0.12]).length > 0,
        { y },
      );
    for (const center of c.eastStacks.centers) {
      const pt = (p) => transform(p, Math.PI / 2, center),
        shaft = ray(pt([0.2, 69, 1]), pt([0.2, 69, 0.5]));
      check('closed rectangular copper vent shaft', shaft.length > 0, { center });
      for (let i = 0; i < 6; i++) {
        const y = 70.6 + i * 0.18,
          t = (y - 70.4) / 1.4,
          z = 0.95 - t * 0.37 + 0.055,
          hit = ray(pt([0, y + 0.02, z + 0.12]), pt([0, y + 0.02, z - 0.02]));
        check('physical tapered hood louver front edge', hit.length > 0, { center, blade: i });
      }
    }
    const b = c.banks;
    for (const angle of b.angles) {
      const pt = (p) => transform(p, angle),
        projection = (p) => Math.sin(angle) * p.x + Math.cos(angle) * p.z;
      for (const x of b.bayCenters)
        for (let i = 0; i < b.bladeCount; i++) {
          const y = b.bladeFirstY + i * b.bladePitch,
            hit = ray(
              pt([x + 0.13, y, b.bladeFront + 0.21]),
              pt([x + 0.13, y, b.bladeFront + 0.09]),
            );
          check(
            'each louver is a closed projecting solid',
            hit.length > 0 && Math.abs(projection(hit[0].point) - (b.bladeFront + 0.15)) < 0.0001,
            { angle, bay: x, blade: i },
          );
          check(
            'real open space above the blade front edge',
            ray(
              pt([x + 0.13, y + 0.08, b.bladeFront + 0.21]),
              pt([x + 0.13, y + 0.08, b.bladeFront + 0.1]),
            ).length === 0,
            { angle, bay: x, blade: i },
          );
        }
      for (const x of b.bayCenters) {
        const y = b.bladeFirstY + 0.08,
          back = ray(pt([x + 0.13, y, 6.18]), pt([x + 0.13, y, 6.1]));
        check(
          'recessed dark backing behind blade gaps',
          back.length > 0 && Math.abs(projection(back[0].point) - 6.16) < 0.0001,
          { angle, bay: x },
        );
      }
      for (const x of [-2.25, -0.75, 0.75, 2.25]) {
        const hit = ray(pt([x, 61.7, 6.5]), pt([x, 61.7, 6.25]));
        check(
          'solid copper pier separates vent bays',
          hit.length > 0 && Math.abs(projection(hit[0].point) - 6.4) < 0.0001,
          { angle, x },
        );
      }
      const hood = ray(pt([0.1, 65, 5]), pt([0.1, 64, 5]));
      check(
        'sloped copper hood closes above louver bank',
        hood.length > 0 && hood[0].point.y > 64.4 && hood[0].point.y < 64.7,
        { angle },
      );
      for (const x of [-1.9916, 1.9916]) {
        check(
          'both old central mid-tier dormer panes removed behind new bank',
          ray(pt([x, 62.2, 5.97]), pt([x, 62.2, 5.94])).length === 0,
          { angle, x },
        );
        check(
          'old dormer peaks do not protrude through the new hood',
          ray(pt([x, 63.85, 6.12]), pt([x, 63.85, 6.04])).length === 0,
          { angle, x },
        );
      }
    }
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    addedTriangles: triangles - base.levels[d].originalTriangles,
    retainedTriangles,
    controls: checks.length,
    failed: 0,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      model: 'chateau_frontenac',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
