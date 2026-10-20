/** Verify recessed paired balcony doors and closed ornamental ironwork, preserving the full surroundings. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  blueHouseDistrict,
  blueHouseModel,
  blueHouseSkyline,
  blueHouseStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-blue-house-hong-kong.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/we/wec/blue_house_hong_kong/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  base = read('retained-balcony-door-surroundings-v2.json'),
  c = read('balcony-door-construction-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
for (const [n, h] of Object.entries(c.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h);
const results = [];
for (const [d, build] of [
  blueHouseSkyline,
  blueHouseDistrict,
  blueHouseStreet,
  blueHouseModel.build,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `BlueHouse source${d}`);
  const h = createHash('sha256'),
    added = {
      balconyWood: 0,
      balconyIron: 0,
      doorWall: 0,
      doorReveal: 0,
      doorWood: 0,
      doorGlass: 0,
      doorIron: 0,
    };
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
      ? {
          balconyWood: 216,
          balconyIron: 23020,
          doorWall: 64,
          doorReveal: 240,
          doorWood: 3072,
          doorGlass: 576,
          doorIron: 288,
        }
      : {
          balconyWood: 0,
          balconyIron: 0,
          doorWall: 0,
          doorReveal: 0,
          doorWood: 0,
          doorGlass: 0,
          doorIron: 0,
        },
  );
  if (d === 3) {
    for (const slot of ['balconyWood', 'balconyIron', 'doorWood', 'doorGlass', 'doorIron']) {
      const edges = new Map();
      for (const g of source.groups.filter((g) => g.slot === slot))
        for (let k = g.start; k < g.start + g.count; k += 3) {
          const p = Array.from(source.indices.slice(k, k + 3)).map((i) =>
            Array.from(source.positions.slice(i * 3, i * 3 + 3))
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const key = [p[j], p[(j + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
      assert(
        [...edges.values()].every((n) => n >= 2 && n % 2 === 0),
        slot + ' closed physical stocks',
      );
    }
  }
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
      `BlueHouse import${d}`,
    );
    triangles += idx.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (JSON.stringify(m.userData).includes('metal_painted'))
        assert.equal(m.side, T.DoubleSide, 'retain original rear flat-iron shared material mode');
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
  check('all original attributes outside4252replaced front-wall-door-rail triangles exact', true);
  if (d === 3) {
    check('new concrete/wood shared bindings present', concreteSurface && woodSurface);
    const f = c.front,
      k = c.doors,
      r = c.rails;
    const hit = (name, A, B, q) => {
      const h = ray(A, B)[0];
      check(name, !!h && h.point.distanceTo(new T.Vector3(...q)) < 0.00003, {
        q,
        actual: h?.point.toArray(),
      });
    };
    const hitBack = (name, x, y, z) => hit(name, [x, y, z - 0.02], [x, y, z + 0.01], [x, y, z]);
    for (const x of f.bays)
      for (const floor of f.levels) {
        const y = floor + k.aboveFloor,
          l = x - k.width / 2,
          right = x + k.width / 2,
          top = y + k.height;
        for (const sign of [-1, 1]) {
          const xx = x + sign * 0.85;
          check(
            'actual paired-door pocket open behind original wall plane',
            ray([xx, y + 1, f.z + 0.03], [xx, y + 1, k.leafFrontZ + 0.09]).length === 0,
          );
          hitZ('each active leaf has recessed glazing front', xx, y + 1, k.leafFrontZ);
          hitBack(
            'each active leaf glazing has closed back',
            xx,
            y + 1,
            k.leafFrontZ - k.glassThickness,
          );
          hitZ('each lower wood leaf has physical front', xx, y + 0.25, k.leafFrontZ);
          hitBack('each lower wood leaf has closed back', xx, y + 0.25, k.leafBackZ);
          hitZ('fixed transom glazing is physical and recessed', xx, top - 0.25, k.leafFrontZ);
          hitZ(
            'separate meeting stiles have physical depth',
            x + sign * 0.04,
            y + 1.9,
            k.leafFrontZ + k.barDepth,
          );
          hitZ(
            'leaf horizontal rail retains actual center separation',
            x + sign * 0.2,
            y + k.lowerPanelHeight,
            k.leafFrontZ + k.barDepth,
          );
          hitZ(
            'door handle physically attaches to leaf stile',
            x + sign * 0.055,
            y + 1.13,
            k.leafFrontZ + 0.09,
          );
        }
        check(
          'paired active-leaf seam is genuinely clear',
          ray([x, y + 1, k.leafFrontZ + 0.08], [x, y + 1, k.leafBackZ - 0.01]).length === 0,
        );
        check(
          'paired lower rail is split through center seam',
          ray(
            [x, y + k.lowerPanelHeight, k.leafFrontZ + 0.08],
            [x, y + k.lowerPanelHeight, k.leafBackZ - 0.01],
          ).length === 0,
        );
        const stop = [
          [l + 0.035, y + 0.035],
          [right - 0.035, y + 0.035],
          [right - 0.035, top - 0.035],
          [l + 0.035, top - 0.035],
        ];
        for (let i = 0; i < 4; i++) {
          const a = stop[i],
            b = stop[(i + 1) % 4],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy),
            nx = -dy / len,
            ny = dx / len,
            q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 3.1];
          hit(
            'all four wood-lined pocket reveals are physical',
            [q[0] + nx * 0.022, q[1] + ny * 0.022, q[2]],
            [q[0] - nx * 0.022, q[1] - ny * 0.022, q[2]],
            q,
          );
        }
        hitZ('outer wood frame has physical front', l - 0.05, y + 1.8, k.frameFrontZ);
        hitBack('outer wood frame has closed embedded back', l - 0.05, y + 1.8, k.frameBackZ);
        hit(
          'threshold has real top and depth',
          [x - 0.8, y + 0.06, f.z + 0.22],
          [x - 0.8, y - 0.005, f.z + 0.22],
          [x - 0.8, y + 0.02, f.z + 0.22],
        );
      }
    for (const x of f.bays)
      for (const y of f.levels) {
        hitZ('wood balcony handrail has closed front', x + 0.35, y + 1.05, r.frontZ + 0.035);
        hitBack('wood balcony handrail has closed back', x + 0.35, y + 1.05, r.frontZ - 0.035);
        for (let motif = 0; motif < 2; motif++) {
          const cx = x - r.width / 2 + ((motif + 0.5) * r.width) / 2;
          const shapes = [
            [cx, y + r.motifCenterY, ...r.ellipse, r.largeSegments],
            [cx, y + r.motifCenterY, ...r.circle, r.largeSegments],
            ...[-1, 1].map((sign) => [
              cx + sign * r.sideCircleOffset,
              y + r.motifCenterY,
              r.sideCircleRadius,
              r.sideCircleRadius,
              r.smallSegments,
            ]),
            ...r.minorCenterYs.map((h) => [
              cx,
              y + h,
              r.minorRadius,
              r.minorRadius,
              r.minorSegments,
            ]),
          ];
          for (const [cx, cy, rx, ry, n] of shapes)
            for (const j of [1, Math.floor(n / 2) + 1]) {
              const a = (j * 2 * Math.PI) / n,
                b = ((j + 1) * 2 * Math.PI) / n,
                qx = cx + (rx * (Math.cos(a) + Math.cos(b))) / 2,
                qy = cy + (ry * (Math.sin(a) + Math.sin(b))) / 2;
              hitZ(
                'every ornamental ring has physical front',
                qx,
                qy,
                r.frontZ + 0.015 + r.depth / 2,
              );
              // The side loops intentionally join the diagonal iron bars.
              // Probe the exact ring back inside that overlap rather than
              // stopping on the supporting bar farther behind it.
              const backZ = r.frontZ + 0.015 - r.depth / 2;
              hit(
                'every ornamental ring has closed back',
                [qx, qy, backZ - 0.004],
                [qx, qy, backZ + 0.004],
                [qx, qy, backZ],
              );
            }
          for (const sign of [-1, 1])
            check(
              'small side-loop counter is actual empty space',
              ray(
                [cx + sign * r.sideCircleOffset, y + r.motifCenterY, r.frontZ + 0.07],
                [cx + sign * r.sideCircleOffset, y + r.motifCenterY, r.frontZ - 0.04],
              ).length === 0,
            );
          check(
            'large circle counter is actual empty space between bars',
            ray(
              [cx + 0.18, y + r.motifCenterY + 0.12, r.frontZ + 0.07],
              [cx + 0.18, y + r.motifCenterY + 0.12, r.frontZ - 0.04],
            ).length === 0,
          );
          hitZ(
            'three source-supported central bars are physical',
            cx + 0.105,
            y + 0.77,
            r.frontZ + r.depth / 2,
          );
        }
      }
    for (const x of r.frontPipeXs) {
      const q = [x, 8.9, r.pipeZ + (r.pipeRadius * Math.sqrt(3)) / 2];
      hit(
        'one closed continuous pipe follows each photographed boundary',
        [q[0], q[1], q[2] + 0.02],
        [q[0], q[1], q[2] - 0.01],
        q,
      );
      hit(
        'boundary pipe has closed top cap',
        [x + 0.006, r.pipeTop + 0.02, r.pipeZ + 0.004],
        [x + 0.006, r.pipeTop - 0.01, r.pipeZ + 0.004],
        [x + 0.006, r.pipeTop, r.pipeZ + 0.004],
      );
    }
    for (let i = 0; i < f.bays.length - 1; i++) {
      const x = (f.bays[i] + f.bays[i + 1]) / 2;
      for (const y of f.levels)
        hitZ('neighboring wood handrails join across unit boundary', x, y + 1.05, r.frontZ + 0.035);
    }
    for (const x of r.returnXs)
      for (const y of f.levels) {
        const sign = x < 0 ? -1 : 1,
          n = Math.ceil(r.returnWidth / r.postPitch),
          u = -r.returnWidth / 2 + (3 * r.returnWidth) / n,
          q = [x + (sign * r.depth) / 2, y + 0.6, r.returnCenterZ - sign * u];
        hit(
          'each side-return rail has real closed vertical stock',
          [q[0] + sign * 0.025, q[1], q[2]],
          [q[0] - sign * 0.015, q[1], q[2]],
          q,
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
      model: 'blue_house_hong_kong',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      retainedInputs: c.retainedInputs,
      results,
    },
    null,
    2,
  ),
);
