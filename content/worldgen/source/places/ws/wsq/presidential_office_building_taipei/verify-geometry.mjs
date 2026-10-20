/** Current GLB geometry proof and frozen-field identity; geographic acceptance also requires current captures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { MeshBufferBuilder } from '../../../../../../../packages/worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';
import {
  presidentialOfficeBuildingTaipei,
  presidentialOfficeBuildingTaipeiDistrict,
  presidentialOfficeBuildingTaipeiSkyline,
  presidentialOfficeBuildingTaipeiStreet,
} from '../../../../../../../packages/worldgen/scripts/structure-presidential-office-building-taipei.mjs';

const root = new URL('../../../../../../../', import.meta.url),
  dir = new URL('.', import.meta.url),
  runtime = new URL(
    'content/worldgen/assets/places/ws/wsq/presidential_office_building_taipei/',
    root,
  ),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  frame = read('map-frame.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three');
const { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-grid.json', dir))),
  'sha256:1c403c80b29bf732cff657e2c583798384ae07bcfa7580060a556d0a41e68fcf',
);
assert.equal(
  hashBytes(fs.readFileSync(new URL('terrain-review.height.png', dir))),
  'sha256:92eefa416b8343d8c64330f2d0c8467d5c504200cc129d7a4e16c5a7e22d6e60',
);
const builds = [
    presidentialOfficeBuildingTaipeiSkyline,
    presidentialOfficeBuildingTaipeiDistrict,
    presidentialOfficeBuildingTaipeiStreet,
    presidentialOfficeBuildingTaipei,
  ],
  limits = [1000, 4000, 16000, 64000],
  results = [],
  failures = [];
const signed = (r) =>
  r.reduce((n, a, i) => {
    const b = r[(i + 1) % r.length];
    return n + a[0] * b[1] - b[0] * a[1];
  }, 0);
const sourceTower = frame.geometry.parts
    .find((p) => p.properties.kind_detail === 'tower')
    .outline.slice(0, -1),
  tower = signed(sourceTower) > 0 ? sourceTower : [...sourceTower].reverse();
for (let d = 0; d < 4; d++) {
  const b = new MeshBufferBuilder();
  builds[d](b, frame);
  const mesh = b.finalize();
  validateAuthoredMesh(mesh, `Presidential source${d}`);
  assert(mesh.triangleCount <= limits[d]);
  const level = side.runtimeLods.levels[d],
    bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  let tris = 0;
  gltf.scene.traverse((o) => {
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = T.FrontSide;
    if (!o.geometry) return;
    const p = o.geometry.getAttribute('position'),
      n = o.geometry.getAttribute('normal'),
      uv = o.geometry.getAttribute('uv'),
      indices = o.geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i);
    validateAuthoredMesh(
      { positions: p.array, normals: n.array, uvs: uv.array, indices, vertexCount: p.count },
      `Presidential runtime${d}`,
    );
    tris += indices.length / 3;
  });
  assert.equal(tris, level.triangles);
  assert(level.drawCalls <= 8);
  const ray = (a, b) => {
      const o = new T.Vector3(...a),
        v = new T.Vector3(...b).sub(o);
      return new T.Raycaster(
        o,
        v.clone().normalize(),
        0.00001,
        v.length() - 0.00001,
      ).intersectObject(gltf.scene);
    },
    controls = [],
    check = (name, pass, data = {}) => {
      controls.push({ name, pass, ...data });
      if (!pass) failures.push({ level: level.name, name, ...data });
    };
  let openCourtProbes = 0;
  for (const sign of [-1, 1])
    for (const x of [17, 21, 25, 29, 33, 37])
      for (const z of [-10, -5, 0, 5, 10]) {
        openCourtProbes++;
        check(
          'courtyard contains no architecture or spanning roof',
          ray([sign * x, 70, z], [sign * x, -1, z]).length === 0,
          { x: sign * x, z },
        );
      }
  check('lower central hall remains below wing roofs', ray([0, 21, 0], [0, 19, 0]).length > 0);
  check(
    'architectural central tower cap reaches60m',
    ray([-0.145, 60.1, 30.33], [-0.145, 59.5, 30.33]).length > 0,
  );
  if (d >= 2) {
    for (let j = 0; j < tower.length; j++) {
      const a = tower[j],
        b = tower[(j + 1) % tower.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len <= 3) continue;
      const nx = dz / len,
        nz = -dx / len,
        cx = (a[0] + b[0]) / 2,
        cz = (a[1] + b[1]) / 2;
      for (const y of [28.1, 34.8, 41.5])
        for (const u of [-0.3, 0.3]) {
          const p = (depth) => [
            cx + (dx / len) * u - nx * depth,
            y,
            cz + (dz / len) * u - nz * depth,
          ];
          check(
            'native cruciform shaft sash is physically recessed',
            ray(p(-0.04), p(0.13)).length === 0,
            { j, y, u },
          );
          check('native shaft sash has actual backing glazing', ray(p(0.14), p(0.3)).length > 0, {
            j,
            y,
            u,
          });
        }
    }
    for (const sign of [-1, 1])
      for (let i = 0; i < 8; i++)
        for (const y of [5.2, 10.8, 15.6]) {
          const x = sign * 31.2 - 18 + (i + 0.5) * 4.5;
          check(
            'front arcade walkway has real air before backing wall',
            ray([x + 0.3, y, 38.25], [x + 0.3, y, 35.65]).length === 0,
            { x, y },
          );
          check(
            'arcade backing window is actually recessed/glazed',
            ray([x + 0.3, y, 35.1], [x + 0.3, y, 34.8]).length > 0,
            { x, y },
          );
        }
  }
  results.push({
    level: level.name,
    triangles: tris,
    drawCalls: level.drawCalls,
    hash: level.hash,
    openCourtProbes,
    controls,
    failed: controls.filter((c) => !c.pass).length,
  });
}
const out = {
  status: failures.length ? 'failed' : 'passed-draft-geometry-only',
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  originalGroundUnchanged: true,
  geographicAcceptance: false,
  originalGroundStatus: 'rejected-composite-site-grade;official20m-source-still-required',
  results,
  failures,
};
console.log(JSON.stringify(out, null, 2));
assert.equal(failures.length, 0, 'See failed geometry controls above');
