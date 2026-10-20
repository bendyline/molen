/** Changed support air/feet plus independently retained exact Float32 letter panel triangles. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  hollywood,
  hollywoodDistrict,
  hollywoodSkyline,
  hollywoodStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-hollywood-sign.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/9q/9q5/hollywood_sign/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  site = read('site-construction-controls.json'),
  ground = read('terrain-grid.json'),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  parse = async (bytes) => {
    const g = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    g.scene.updateMatrixWorld(true);
    return g.scene;
  },
  digest = (v) => `sha256:${createHash('sha256').update(JSON.stringify(v)).digest('hex')}`;
const letters = frame.features.map((f) => {
  const [a, b] = f.line,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    direction = [dx / length, dz / length],
    center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    width = f.letterOrder === 2 ? 9.5 : f.letterOrder === 4 ? 9.2 : length,
    bottom = 1.8 + site.construction.unchangedPanelOffsets[f.letterOrder - 1];
  return {
    order: f.letterOrder,
    name: f.name,
    direction,
    center,
    width,
    bottom,
    point: (x, y, z) => [
      center[0] + direction[0] * x - direction[1] * z,
      y,
      center[1] + direction[1] * x + direction[0] * z,
    ],
  };
});
function panels(scene) {
  const found = letters.map(() => []);
  scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    for (let i = 0; i < idx.length; i += 3) {
      const pts = Array.from(idx.slice(i, i + 3), (v) =>
        new T.Vector3(p.getX(v), p.getY(v), p.getZ(v)).applyMatrix4(o.matrixWorld).toArray(),
      );
      for (const [k, l] of letters.entries()) {
        const valid = pts.every(([x, y, z]) => {
          const dx = x - l.center[0],
            dz = z - l.center[1],
            xx = dx * l.direction[0] + dz * l.direction[1],
            zz = -dx * l.direction[1] + dz * l.direction[0];
          return (
            Math.abs(Math.abs(zz) - 0.08) < 0.0001 &&
            Math.abs(xx) <= l.width / 2 + 0.001 &&
            y >= l.bottom - 0.001 &&
            y <= l.bottom + 13.717
          );
        });
        if (valid) found[k].push(JSON.stringify(pts.map((p) => JSON.stringify(p)).sort()));
      }
    }
  });
  return found.map((triangles, i) => ({
    order: letters[i].order,
    name: letters[i].name,
    triangles: triangles.length,
    hash: digest(triangles.sort()),
  }));
}
if (process.argv.includes('--record-panels')) {
  const bytes = fs.readFileSync(new URL('models/source.glb', dir)),
    expected = panels(await parse(bytes));
  assert(expected.every((p) => p.triangles > 10));
  fs.writeFileSync(
    new URL('retained-panel-controls.json', dir),
    `${JSON.stringify(
      {
        format: 'molen/retained-letter-panels@1',
        baselineSourceHash: hashBytes(bytes),
        basis:
          'Recorded from existing source GLB before regenerating changed supports. Hashes cover exact sorted Float32 world-position triangles of front, back and edge panels, not steel framing.',
        expected,
      },
      null,
      2,
    )}\n`,
  );
  console.log(expected);
  process.exit(0);
}
const baseline = read('retained-panel-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  results = [];
assert.deepEqual(frame.anchor, [-118.32168815, 34.134047800000005]);
assert.equal(frame.heading, 0);
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
const elevation = (x, z) => {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = ground.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    ground.modelDatumElevationMeters
  );
};
for (const [d, build] of [
  hollywoodSkyline,
  hollywoodDistrict,
  hollywoodStreet,
  hollywood,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Hollywood source ${d}`);
  assert(source.triangleCount <= [1000, 4000, 16000, 64000][d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const scene = await parse(bytes);
  let triangles = 0;
  scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      idx = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices: idx, vertexCount: p.count },
      `Hollywood runtime ${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
  });
  assert.equal(triangles, level.triangles);
  assert(level.drawCalls <= 6);
  const retained = panels(scene);
  assert.deepEqual(retained, baseline.expected, 'nine exact original letter panel meshes');
  const controls = [],
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(scene);
    },
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    };
  for (const l of letters) {
    for (const fraction of l.name === 'W' ? [-0.43, -0.15, 0.15, 0.43] : [-0.39, 0.39]) {
      const x = l.width * fraction,
        p = l.point(x, 0, -0.38),
        y = elevation(p[0], p[2]);
      for (const dx of [-0.24, 0.24]) {
        const h = ray(l.point(x + dx, y + 0.3, -0.38), l.point(x + dx, y - 0.2, -0.38))[0];
        check(
          'original independent-ground footing surface retained',
          !!h && Math.abs(h.point.y - y - 0.05) < 0.003,
          { order: l.order, fraction, dx, expectedY: y + 0.05, actualY: h?.point.y },
        );
      }
    }
    if (l.name === 'O') {
      for (const fraction of [-0.39, 0.39])
        check(
          'diagonal braces do not project above O corners',
          ray(
            l.point(l.width * fraction, l.bottom + 13.516, -1),
            l.point(l.width * fraction, l.bottom + 13.516, -0.1),
          ).length === 0,
          { order: l.order, fraction },
        );
    }
    if (l.name === 'L') {
      for (const fraction of [0.1, 0.39])
        for (const yy of [4, 8, 12])
          check(
            'L upper negative space has no invented full rectangle',
            ray(
              l.point(l.width * fraction, l.bottom + yy, -2),
              l.point(l.width * fraction, l.bottom + yy, 0.3),
            ).length === 0,
            { order: l.order, fraction, yy },
          );
      check(
        'physical tall-stem rear support retained',
        ray(
          l.point(-l.width * 0.39, l.bottom + 7, -1),
          l.point(-l.width * 0.39, l.bottom + 7, -0.1),
        ).length > 0,
        { order: l.order },
      );
      check(
        'physical short-foot rear support retained',
        ray(l.point(l.width * 0.39, l.bottom + 1, -1), l.point(l.width * 0.39, l.bottom + 1, -0.1))
          .length > 0,
        { order: l.order },
      );
    }
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    retainedPanels: retained,
    controls: controls.length,
    failed: controls.filter((c) => !c.pass).length,
    controlResults: controls,
  });
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: site.retainedInputs,
      baselinePanelSourceHash: baseline.baselineSourceHash,
      results,
      scope:
        'Profile-aware support/girt/ladder extents and L stem/foot braces; exact pre-change panel triangles and twenty independent-ground footing locations retained. Hidden engineering and member sections approximate.',
    },
    null,
    2,
  ),
);
