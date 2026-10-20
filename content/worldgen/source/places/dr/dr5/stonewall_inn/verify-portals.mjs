/** Actual imported portal voids, depth and retained surrounding structure. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  stonewall,
  stonewallDistrict,
  stonewallSkyline,
  stonewallStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-stonewall-inn.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dr/dr5/stonewall_inn/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  site = read('site-construction-controls.json'),
  baseline = read('retained-visitor-entry-surroundings.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
const inside = (points, slot) =>
  (['brick', 'stone'].includes(slot) &&
    points.every(
      (p) =>
        p[0] > -0.55 &&
        p[0] < 6.8 &&
        p[1] <= (slot === 'brick' ? 3.20001 : 0.10001) &&
        p[2] > 14.25,
    )) ||
  points.every(
    (p) => p[0] > 3.4 && p[0] < 5.6 && p[1] > -0.151 && p[1] < 3 && p[2] > 13.9 && p[2] < 14.9,
  );
for (const [n, h] of Object.entries(site.retainedInputs))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `retained ${n}`);
for (const [n, h] of Object.entries(site.currentGroundInputs ?? {}))
  assert.equal(hashBytes(fs.readFileSync(new URL(n, dir))), h, `current USGS ground ${n}`);
assert.equal(
  hashBytes(fs.readFileSync(new URL('retained-portal-surroundings.json', dir))),
  baseline.originalBaselineHash,
  'immutable original baseline retained',
);
const results = [];
for (const [d, build] of [
  stonewallSkyline,
  stonewallDistrict,
  stonewallStreet,
  stonewall,
].entries()) {
  const b = new MeshBufferBuilder();
  build(b);
  const source = b.finalize();
  validateAuthoredMesh(source, `Stonewall source ${d}`);
  const h = createHash('sha256');
  let retainedTriangles = 0;
  for (let k = 0; k < source.indices.length; k += 3) {
    const ids = Array.from(source.indices.slice(k, k + 3)),
      group = source.groups.find((g) => k >= g.start && k < g.start + g.count);
    if (
      d > 0 &&
      inside(
        ids.map((i) => Array.from(source.positions.slice(i * 3, i * 3 + 3))),
        group.slot,
      )
    )
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
        h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
  }
  const attributeHash = `sha256:${h.digest('hex')}`;
  assert.equal(attributeHash, baseline.levels[d].attributeHash);
  assert.equal(retainedTriangles, baseline.levels[d].retainedTriangles);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const g = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  g.scene.updateMatrixWorld(true);
  let triangles = 0,
    revealTriangles = 0;
  g.scene.traverse((o) => {
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Stonewall imported ${d}`,
    );
    triangles += indices.length / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    for (let k = 0; k < indices.length; k += 3) {
      const points = Array.from(indices.slice(k, k + 3), (i) => [p.getX(i), p.getY(i), p.getZ(i)]);
      if (
        points.some((p) => Math.abs(p[2] - 13.97) < 0.00001) &&
        points.some((p) => p[2] > 14.3) &&
        site.portals.some((q) =>
          points.every(
            (p) => Math.abs(p[0] - q.x) < q.w / 2 + 0.001 && p[1] > 0.119 && p[1] < 2.791,
          ),
        )
      )
        revealTriangles++;
    }
  });
  assert.equal(triangles, source.triangleCount);
  assert.equal(triangles, level.triangles);
  assert(triangles <= [1000, 4000, 16000, 64000][d]);
  assert(level.drawCalls <= [1, 6, 8, 8][d]);
  const controls = [],
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      assert(pass, `${level.name}: ${name}: ${JSON.stringify(data)}`);
    },
    ray = (a, b) => {
      const p = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(p);
      return new T.Raycaster(
        p,
        v.clone().normalize(),
        0.000001,
        v.length() - 0.000001,
      ).intersectObject(g.scene);
    };
  check('exact surrounding source attributes retained', true, { attributeHash, retainedTriangles });
  check(
    'skyline unchanged by visitor entry detail',
    d > 0 || triangles === baseline.levels[d].triangles,
  );
  check('real front-to-back reveal triangles', revealTriangles === [0, 44, 76, 76][d], {
    revealTriangles,
  });
  if (d > 0)
    for (const p of site.portals) {
      const rr = p.w / 2,
        top = p.y + p.stem + p.rise;
      check(
        'entry is open in front of recessed closed leaf',
        ray([p.x, 1.1, 14.5], [p.x, 1.1, 14.1]).length === 0,
        { portal: p.x },
      );
      const leaf = ray([p.x + rr * 0.2, 0.7, 14.5], [p.x + rr * 0.2, 0.7, 13.95]);
      check(
        'actual closed door recessed behind brick facade',
        leaf.length > 0 && leaf[0].point.z < 14.15 && leaf[0].point.z > 13.96,
        { portal: p.x, z: leaf[0]?.point.z },
      );
      for (const sg of [-1, 1]) {
        const hit = ray([p.x + sg * rr * 0.8, 1.4, 14.15], [p.x + sg * rr * 1.1, 1.4, 14.15]);
        check(
          'physical inward-facing jamb',
          hit.length > 0 && Math.abs(hit[0].point.x - (p.x + sg * rr)) < 0.0001,
          { portal: p.x, side: sg },
        );
      }
      const soffit = ray([p.x, top - 0.15, 14.15], [p.x, top + 0.15, 14.15]);
      check(
        'physical arched soffit depth',
        soffit.length > 0 && Math.abs(soffit[0].point.y - top) < 0.0001,
        { portal: p.x, y: soffit[0]?.point.y },
      );
      const floor = ray([p.x, 0.25, 14.15], [p.x, 0.08, 14.15]);
      check(
        'closed sill floor joins original entrance height',
        floor.length > 0 && Math.abs(floor[0].point.y - 0.12) < 0.0001,
        { portal: p.x },
      );
      check(
        'fanlight recess remains open ahead of rear plane',
        ray([p.x, p.y + p.stem + p.rise * 0.6, 14.5], [p.x, p.y + p.stem + p.rise * 0.6, 14.1])
          .length === 0,
        { portal: p.x },
      );
      const outside = ray([p.x + rr * 0.85, top - 0.1, 14.5], [p.x + rr * 0.85, top - 0.1, 14.05]);
      check(
        'solid front wall remains outside arch profile',
        outside.length > 0 && outside[0].point.z > 14.3,
        { portal: p.x },
      );
      const threshold = ray([p.x, 0.25, 14.55], [p.x, 0.05, 14.55]);
      check(
        'original rounded threshold top retained',
        threshold.length > 0 && Math.abs(threshold[0].point.y - 0.12) < 0.0001,
        { portal: p.x },
      );
    }
  if (d > 0) {
    check(
      '51 entrance open ahead of recessed leaf',
      ray([4.48, 1.2, 14.5], [4.48, 1.2, 14.1]).length === 0,
    );
    for (const x of [4.18, 4.78]) {
      const hit = ray([x, 0.7, 14.5], [x, 0.7, 13.95]);
      check('51 paired door leaves behind masonry plane', hit.length > 0 && hit[0].point.z < 14.1);
    }
    const floor = ray([4.48, 0.1, 14.15], [4.48, -0.05, 14.15]);
    check(
      '51 recess floor lowered to original model street datum',
      floor.length > 0 && Math.abs(floor[0].point.y) < 0.0001,
    );
    check(
      '51 old raised rounded stoop removed',
      ray([4.48, 0.2, 14.55], [4.48, 0.001, 14.55]).length === 0,
    );
    const sill = ray([4.48, 0.2, 14.35], [4.48, 0.001, 14.35]);
    check('51 continuous base sill no longer crosses doorway', sill.length === 0);
    const jamb = ray([4.48, 1.4, 14.15], [5.3, 1.4, 14.15]);
    check(
      '51 actual inward-facing jamb',
      jamb.length > 0 && Math.abs(jamb[0].point.x - 5.14) < 0.0001,
    );
  }
  if (d > 1) {
    for (const xx of [-1.69 - 0.38, -1.69 + 0.38]) {
      for (const dx of [-0.09, 0.09]) {
        const hit = ray([xx + dx, 1.32, 14.2], [xx + dx, 1.32, 14.0]);
        check(
          'physical black glazing mullion',
          hit.length > 0 && Math.abs(hit[0].point.z - 14.0425) < 0.0001,
          { leaf: xx, dx },
        );
      }
      const pane = ray([xx, 1.11, 14.2], [xx, 1.11, 13.98]);
      check(
        'glazing pane remains behind physical frame',
        pane.length > 0 && Math.abs(pane[0].point.z - 14.005) < 0.0001,
        { leaf: xx },
      );
      for (const sg of [-1, 1]) {
        const cx = xx + sg * 0.13,
          center = ray([cx, 0.5, 14.2], [cx, 0.5, 13.98]),
          bevel = ray([cx, 0.318, 14.2], [cx, 0.318, 13.98]);
        check(
          'lower panel has real recessed face',
          center.length > 0 && Math.abs(center[0].point.z - 14.005) < 0.0001,
          { leaf: xx, panel: sg },
        );
        check(
          'lower panel has sloped physical molding',
          bevel.length > 0 && bevel[0].point.z > 14.02 && bevel[0].point.z < 14.035,
          { leaf: xx, panel: sg },
        );
      }
    }
    const plain = ray([-7.488, 1.07, 14.2], [-7.488, 1.07, 13.98]);
    check(
      'unsupported diamond decoration removed from plain side leaf',
      plain.length > 0 && Math.abs(plain[0].point.z - 13.99) < 0.0001,
    );
    for (const y of [0.7, 1.85]) {
      const hit = ray([-8.095, y, 14.2], [-8.095, y, 13.98]);
      check(
        'side door hinge has physical depth',
        hit.length > 0 && Math.abs(hit[0].point.z - 14.0375) < 0.0001,
        { y },
      );
    }
  }
  results.push({
    level: level.name,
    triangles,
    drawCalls: level.drawCalls,
    controls: controls.length,
    failed: 0,
    revealTriangles,
    addedTriangles: triangles - baseline.levels[d].triangles,
    retainedTriangles,
    attributeHash,
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
      results,
      scope:
        'Both53portals and all geometry outside the bounded51visitor entry/front-wall triangulation are unchanged. The51segmental opening has a real recess, paired leaves and street-datum sill without the obsolete raised rounded stoop. Native map and independent USGS ground retained. These are geometry checks; full architectural review is recorded separately in qa.json.',
    },
    null,
    2,
  ),
);
