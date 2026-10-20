/** Focused actual-GLB checks for Fallingwater's modeled stream, rock interface and landing. Run from the repository root after building this model. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { decodePng16 } from '../../terrain/dist/kernel.mjs';
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import * as recipe from './structure-fallingwater.mjs';
import { hashBytes, modelInputHash } from './structure-model-files.mjs';

const dir = 'content/worldgen/source/places/dp/dpp/fallingwater',
  root = dir.replace('/source/', '/assets/'),
  read = (p) => JSON.parse(fs.readFileSync(p)),
  get = (n) => read(`${dir}/${n}`),
  side = read(`${root}/asset.json`),
  spec = get('spec.json'),
  g = get('terrain-grid.json'),
  desc = get('terrain-review.terrain.json'),
  png = decodePng16(fs.readFileSync(`${dir}/terrain-review.height.png`)),
  h = Array.from(png.data, (v) =>
    Math.fround(desc.height.min + v * (desc.height.max - desc.height.min)),
  ),
  outline = spec.geographicProposal.groundCutout.outline;
const req = createRequire(new URL('../package.json', import.meta.url)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js'));
const ground = (x, z) => {
  const fx = x - g.origin[0],
    fz = z - g.origin[1],
    ix = Math.floor(fx),
    iz = Math.floor(fz),
    u = fx - ix,
    v = fz - iz,
    n = g.size[0],
    a = h[iz * n + ix],
    b = h[iz * n + ix + 1],
    d = h[(iz + 1) * n + ix],
    e = h[(iz + 1) * n + ix + 1];
  return u + v <= 1 ? a + (b - a) * u + (d - a) * v : e + (d - e) * (1 - u) + (b - e) * (1 - v);
};
const inside = (x, z, ring = outline) => {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      yes = !yes;
  }
  return yes;
};
const samples = [];
for (let x = -22.91; x < 22; x += 0.6)
  for (let z = 5.13; z < 31; z += 0.6) if (inside(x, z)) samples.push([x, z]);
const results = [];
for (const [i, l] of side.runtimeLods.levels.entries()) {
  const bytes = fs.readFileSync(`${root}/${l.file}`);
  assert.equal(hashBytes(bytes), l.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const bed = [],
    water = [];
  gltf.scene.traverse((o) => {
    if (!o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) m.side = T.DoubleSide;
    if (
      mats.some(
        (m) =>
          m.name === 'stone_sandstone_raw' ||
          m.userData.molenSurface?.ref?.endsWith('stone_sandstone_raw'),
      )
    )
      bed.push(o);
    if (mats.some((m) => m.name === 'window' || m.name === 'local-architectural-surface'))
      water.push(o);
  });
  if (!i) {
    const b = new MeshBufferBuilder();
    recipe.fallingwaterSkyline(b, get('map-frame.json'));
    const m = b.finalize();
    const key = (p) =>
      p
        .map((v) => v.map((n) => n.toFixed(5)).join(','))
        .sort()
        .join('|');
    const pick = (slot) => {
      const group = m.groups.find((g) => g.slot === slot),
        keys = new Set();
      for (let j = group.start; j < group.start + group.count; j += 3)
        keys.add(
          key(
            Array.from(m.indices.slice(j, j + 3), (v) =>
              Array.from(m.positions.slice(v * 3, v * 3 + 3)),
            ),
          ),
        );
      const positions = [];
      gltf.scene.traverse((o) => {
        if (!o.geometry) return;
        const geom = o.geometry,
          p = geom.getAttribute('position'),
          idx = geom.index?.array ?? Uint32Array.from({ length: p.count }, (_, j) => j);
        for (let j = 0; j < idx.length; j += 3) {
          const vs = Array.from(idx.slice(j, j + 3), (k) =>
            new T.Vector3().fromBufferAttribute(p, k).applyMatrix4(o.matrixWorld).toArray(),
          );
          if (keys.has(key(vs))) positions.push(...vs.flat());
        }
      });
      assert.equal(positions.length / 9, group.count / 3, `actual skyline ${slot} triangles`);
      const geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      return new T.Mesh(geom, new T.MeshBasicMaterial({ side: T.DoubleSide }));
    };
    bed.push(pick('bedrock'));
    water.push(pick('glass'));
  }
  assert(bed.length, 'actual rock material');
  const ray = (x, z, objects, top = 40) =>
    new T.Raycaster(
      new T.Vector3(x, top, z),
      new T.Vector3(0, -1, 0),
      0.000001,
      60,
    ).intersectObjects(objects)[0];
  const missing = samples.filter(([x, z]) => !ray(x, z, bed));
  assert.equal(missing.length, 0, JSON.stringify({ level: l.name, missing }));
  let boundaryVertices = 0,
    maxVertexJoinError = 0;
  for (const mesh of bed) {
    const p = mesh.geometry.getAttribute('position');
    for (const j of new Set(
      mesh.geometry.index?.array ?? Array.from({ length: p.count }, (_, j) => j),
    )) {
      const v = new T.Vector3().fromBufferAttribute(p, j).applyMatrix4(mesh.matrixWorld);
      let edge = false;
      for (let k = 0; k < outline.length; k++) {
        const a = outline[k],
          b = outline[(k + 1) % outline.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len2 = dx * dx + dz * dz,
          t = ((v.x - a[0]) * dx + (v.z - a[1]) * dz) / len2;
        if (t < -0.00001 || t > 1.00001) continue;
        const dist = Math.hypot(v.x - a[0] - dx * t, v.z - a[1] - dz * t);
        if (dist < 0.00001) {
          edge = true;
          break;
        }
      }
      if (edge) {
        boundaryVertices++;
        if (Math.abs(v.y - ground(v.x, v.z)) > maxVertexJoinError) {
          maxVertexJoinError = Math.abs(v.y - ground(v.x, v.z));
        }
      }
    }
  }
  assert(
    maxVertexJoinError < 0.0001,
    `${l.name} native boundary vertex error ${maxVertexJoinError}`,
  );
  let maxBoundaryInterpolationError = 0;
  const area = outline.reduce(
      (sum, a, k) =>
        sum +
        a[0] * outline[(k + 1) % outline.length][1] -
        outline[(k + 1) % outline.length][0] * a[1],
      0,
    ),
    sign = area > 0 ? 1 : -1;
  for (let e = 0; e < outline.length; e++) {
    const a = outline[e],
      b = outline[(e + 1) % outline.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    for (let j = 1; j < 20; j++) {
      const x = a[0] + (dx * j) / 20 - ((sign * dz) / len) * 0.001,
        z = a[1] + (dz * j) / 20 + ((sign * dx) / len) * 0.001,
        hit = ray(x, z, bed);
      assert(hit, 'boundary sample missing');
      maxBoundaryInterpolationError = Math.max(
        maxBoundaryInterpolationError,
        Math.abs(hit.point.y - ground(x, z)),
      );
    }
  }
  assert(
    maxBoundaryInterpolationError < (i < 2 ? 0.04 : 0.005),
    'actual native-edge interpolation',
  );
  const platform = new T.Raycaster(
      new T.Vector3(9.26, -2.1, 8.95),
      new T.Vector3(0, -1, 0),
      0.00001,
      2,
    ).intersectObject(gltf.scene)[0],
    wet = ray(9.26, 8.95, water, -2.1),
    rock = ray(9.26, 8.95, bed, -1);
  assert(platform && Math.abs(platform.point.y + 2.16) < 0.02, 'actual platform height');
  assert(wet && wet.point.y < platform.point.y - 0.15, 'water below platform');
  assert(rock && rock.point.y < platform.point.y - 0.03, 'channel bank does not bury the platform');
  const siteCoverage = spec.geographicProposal.groundCutout.additionalOutlines.map(
    (ring, index) => {
      const xs = ring.map((p) => p[0]),
        zs = ring.map((p) => p[1]),
        probes = [];
      for (let x = Math.min(...xs) + 0.173; x < Math.max(...xs); x += 0.73)
        for (let z = Math.min(...zs) + 0.217; z < Math.max(...zs); z += 0.73)
          if (inside(x, z, ring)) probes.push([x, z]);
      assert(probes.length > 0, `${l.name} opening ${index}: interior probes`);
      const missing = probes.filter(([x, z]) => !ray(x, z, index < 2 ? bed : [gltf.scene]));
      assert.equal(missing.length, 0, JSON.stringify({ level: l.name, opening: index, missing }));
      return {
        opening: index,
        probes: probes.length,
        missing: 0,
        surface: index < 2 ? 'physical-rock' : 'architecture',
      };
    },
  );
  results.push({
    level: l.name,
    triangles: l.triangles,
    drawCalls: l.drawCalls,
    physicalRockCoverageSamples: samples.length,
    missingSurfaces: 0,
    boundaryVertices,
    maxNativeBoundaryVertexError: maxVertexJoinError,
    maxBoundaryInterpolationError,
    platformY: platform.point.y,
    waterY: wet.point.y,
    rockBelowPlatformY: rock?.point.y,
    platformWaterClearance: platform.point.y - wet.point.y,
    siteCoverage,
  });
}
const controls = get('rock-channel-controls.json');
assert.equal(
  hashEvidenceText(fs.readFileSync(`${dir}/terrain-grid.json`)),
  controls.nativeGridSha256,
);
assert.equal(
  hashBytes(fs.readFileSync(`${dir}/terrain-sources/usgs-1m-native-window.tif`)),
  controls.nativeRasterSha256,
);
let unchangedFiles = null;
const freezePath = '.artifacts/qualla-batch/fallingwater-before-rock-channel.json';
if (fs.existsSync(freezePath)) {
  const freeze = read(freezePath);
  for (const [n, v] of Object.entries(freeze.groundHashes).filter(([n]) => n !== 'map-frame.json'))
    assert.equal(hashBytes(fs.readFileSync(`${dir}/${n}`)).slice(7), v, `${n} changed`);
  unchangedFiles = Object.keys(freeze.groundHashes).length - 1;
}
const mapGeometry = get('map-frame.json');
delete mapGeometry.notes;
delete mapGeometry.limitations;
delete mapGeometry.terrainContact.basis;
// Reconstructing the previous three prose fields reproduced the frozen frame's
// exact ffbac657... digest. This canonical digest retains every geographic value.
assert.equal(
  hashEvidenceText(JSON.stringify(mapGeometry)),
  'sha256:8f757cb5276183bab2b4afc96eba139704761131b1127076377727cb55ba25de',
);
const report = {
  status: 'rock-channel-geometry-passed',
  inputHash: await modelInputHash(dir, side.id),
  sourceHash: side.sourceHash,
  runtimeHash: side.hash,
  results,
  sourceSceneFrameGroundFilesUnchanged: unchangedFiles,
  openingVertices: outline.length,
  mapFrameGeographyUnchanged: true,
  mapFrameChanges:
    'Three prose fields describe the completed construction; coordinates and native map geometry remain unchanged.',
  openingScope:
    'Separate river, stair/bridge rock cuts, guest/theater floors and car-court apron; the rejected broad whole-house opening is inactive.',
  notes:
    'Boundary vertices and342additional actual edge samples per level compare with the unchanged rendered source heightfield. Coarse sampled edge differences stay below4cm and closer differences below5mm. These are sampled interface checks, not native DEM accuracy or a global distance certificate. Other excavation joins remain separate.',
};
const output = '.artifacts/fallingwater/channel-check.json';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log({
  status: report.status,
  levels: results.map((r) => ({
    level: r.level,
    triangles: r.triangles,
    coverage: r.physicalRockCoverageSamples,
    maxJoinVertexError: r.maxNativeBoundaryVertexError,
    maxEdgeError: r.maxBoundaryInterpolationError,
    stairWaterClearance: r.platformWaterClearance,
  })),
});
