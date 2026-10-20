/** Verify recessed south-end windows and closed stepped stone/wood frames, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  chatsworthDistrict,
  chatsworthModel,
  chatsworthSkyline,
  chatsworthStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-chatsworth-house.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/gc/gcq/chatsworth_house/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-south-window-surroundings.json'),
  c = read('south-window-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  chatsworthSkyline,
  chatsworthDistrict,
  chatsworthStreet,
  chatsworthModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Chatsworth source${d}`);
  const h = createHash('sha256'),
    added = { windowStone: 0, windowGlass: 0, windowWood: 0 };
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
      ? { windowStone: 1068, windowGlass: 144, windowWood: 1248 }
      : { windowStone: 0, windowGlass: 0, windowWood: 0 },
  );
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
      `Chatsworth import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.side = T.FrontSide;
      if (JSON.stringify(m.userData).includes('concrete_plain')) concreteSurface = true;
      if (JSON.stringify(m.userData).includes('wood_plain')) woodSurface = true;
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
    },
    hitZ = (name, x, y, z) => {
      const h = ray([x, y, z + 0.025], [x, y, z - 0.015])[0];
      check(name, !!h && Math.abs(h.point.z - z) < 0.00002, { x, y, z, actual: h?.point.z });
    };
  check('all original attributes outside532replaced south projection-window triangles exact', true);
  if (d === 3) {
    check('new stone/wood shared bindings present', concreteSurface && woodSurface);
    const f = c.facade,
      k = c.windows,
      t = c.stone,
      baseZ = f.frontZ,
      pane = baseZ + f.projectionFrontZ - k.recess;
    const hit = (name, A, B, q) => {
      const h = ray(A, B)[0];
      check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.000025, {
        actual: h?.point.toArray(),
        expected: q,
      });
    };
    for (const i of k.bays)
      for (const row of k.rows) {
        const x = f.centerX - f.width / 2 + ((i + 0.5) * f.width) / f.bays,
          y = row.bottom,
          top = y + row.height,
          left = x - k.width / 2,
          right = x + k.width / 2;
        const cellX = left + k.width / 6,
          cellY = y + row.height / 10;
        check(
          'actual pocket is open behind original projection front',
          ray([cellX, cellY, baseZ + 0.54], [cellX, cellY, baseZ + 0.37]).length === 0,
          { bay: i, row: y },
        );
        hitZ('closed glazing has recessed front', cellX, cellY, pane);
        hit(
          'closed glazing has physical back',
          [cellX, cellY, pane - 0.06],
          [cellX, cellY, pane - 0.02],
          [cellX, cellY, pane - k.glassThickness],
        );
        const hole = [
          [left, y],
          [right, y],
          [right, top],
          [left, top],
        ];
        for (let j = 0; j < 4; j++) {
          const a = hole[j],
            b = hole[(j + 1) % 4],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy),
            nx = -dy / len,
            ny = dx / len,
            q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, baseZ + 0.41];
          hit(
            'all four pocket reveals are real and face inward',
            [q[0] + nx * 0.035, q[1] + ny * 0.035, q[2]],
            [q[0] - nx * 0.035, q[1] - ny * 0.035, q[2]],
            q,
          );
        }
        hitZ(
          'shouldered stone stock has physical front',
          right + t.shoulderWidth - 0.04,
          top + 0.1,
          baseZ + t.baseFrontZ,
        );
        hit(
          'stone architrave has closed wall-embedded back',
          [right + 0.13, y + 1, baseZ + t.backZ - 0.025],
          [right + 0.13, y + 1, baseZ + t.backZ + 0.01],
          [right + 0.13, y + 1, baseZ + t.backZ],
        );
        hitZ(
          'joined inner trim has physical relief front',
          right + t.trimWidth / 2,
          y + 1,
          baseZ + t.trimFrontZ,
        );
        const trim = [
          [left - t.trimWidth, y - t.trimWidth],
          [right + t.trimWidth, y - t.trimWidth],
          [right + t.trimWidth, top + t.trimWidth],
          [left - t.trimWidth, top + t.trimWidth],
        ];
        for (let j = 0; j < 4; j++) {
          const a = trim[j],
            b = trim[(j + 1) % 4],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy),
            nx = dy / len,
            ny = -dx / len,
            q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, baseZ + (t.baseFrontZ + t.trimFrontZ) / 2];
          // The keystone intersects the center of the head; probe its quarter instead.
          if (j === 2) q[0] = left + 0.35;
          hit(
            'joined molding relief has closed step return',
            [q[0] + nx * 0.025, q[1] + ny * 0.025, q[2]],
            [q[0] - nx * 0.025, q[1] - ny * 0.025, q[2]],
            q,
          );
        }
        hitZ('tapered keystone has closed front', x, top + 0.4, baseZ + t.keystoneFrontZ);
        hit(
          'tapered keystone returns to original wall',
          [x, top + 0.4, baseZ + t.keystoneBackZ - 0.025],
          [x, top + 0.4, baseZ + t.keystoneBackZ + 0.01],
          [x, top + 0.4, baseZ + t.keystoneBackZ],
        );
        hitZ(
          'joined sash perimeter has physical front',
          left + k.woodWidth / 2,
          y + row.height * 0.31,
          pane + k.woodDepth,
        );
        hit(
          'joined sash perimeter has closed back',
          [left + k.woodWidth / 2, y + row.height * 0.31, pane - 0.018],
          [left + k.woodWidth / 2, y + row.height * 0.31, pane + 0.002],
          [left + k.woodWidth / 2, y + row.height * 0.31, pane - 0.005],
        );
        for (let j = 1; j < k.columns; j++) {
          const xx = left + k.woodWidth / 2 + (j * (k.width - k.woodWidth)) / k.columns;
          hitZ('physical vertical sash stock', xx, y + row.height * 0.1, pane + k.woodDepth);
        }
        for (let j = 1; j < k.rowsCount; j++) {
          const yy = y + k.woodWidth / 2 + (j * (row.height - k.woodWidth)) / k.rowsCount;
          hitZ('physical horizontal sash stock', cellX, yy, pane + k.woodDepth);
        }
        check(
          'glazed counter is open ahead of recessed pane',
          ray([cellX, cellY, pane + k.woodDepth + 0.015], [cellX, cellY, pane + 0.015]).length ===
            0,
        );
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
      model: 'chatsworth_house',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
