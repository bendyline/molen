/** Chihaya's surviving upper enclosure: original current ground, no restored castle. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const G = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
export const surfaces = {
  earth: { slot: 'foundation', graph: 'gravel', roughness: 0.99, metallic: 0 },
  closure: { slot: 'foundation', graph: 'earth_rammed', roughness: 1, metallic: 0 },
};
const colors = { earth: rgb('b29b79'), closure: rgb('8e7958') };
export const componentEvidence = [];
export function sourceGround(x, z) {
  const u = (x - G.origin[0]) / G.stepMeters,
    v = (z - G.origin[1]) / G.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  if (i < 0 || j < 0 || i + 1 >= G.size[0] || j + 1 >= G.size[1])
    throw Error('Outside original numerical source field');
  const h = G.heightsMeters;
  return (
    (a + b <= 1
      ? h[j][i] * (1 - a - b) + h[j][i + 1] * a + h[j + 1][i] * b
      : h[j][i + 1] * (1 - b) + h[j + 1][i] * (1 - a) + h[j + 1][i + 1] * (a + b - 1)) -
    G.modelDatumElevationMeters
  );
}
export const underside =
  Math.min(...P.planRing.map((p) => sourceGround(...p))) - P.undersideDepthBelowMinimumMeters;
function triangle(o, slot, p, expected) {
  p = p.map((q) => q.map(Math.fround));
  let n = normalFor(...p);
  if (expected && n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    n = normalFor(...p);
  }
  const a = p[1].map((v, i) => v - p[0][i]),
    b = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
    1e-8
  )
    return;
  o.addTriangle(
    slot,
    'palette:#ffffff',
    p,
    n,
    p.map((q) => [q[0], q[2]]),
    colors[slot],
  );
}
const controlCap = new MeshBufferBuilder();
controlCap.addCap(
  'earth',
  'palette:#ffffff',
  P.planRing,
  [],
  () => 0,
  [0, 1, 0],
  (p) => p,
  colors.earth,
);
const controlFlat = controlCap.finalize(),
  controlPoints = Array.from({ length: controlFlat.positions.length / 3 }, (_, i) => [
    controlFlat.positions[i * 3],
    controlFlat.positions[i * 3 + 2],
  ]),
  controlTriangles = Array.from({ length: controlFlat.indices.length / 3 }, (_, i) =>
    Array.from(controlFlat.indices.slice(i * 3, i * 3 + 3)),
  ),
  controlPieces = controlTriangles.map((ids) => ids.map((i) => controlPoints[i]));
function mergeConvex(pieces) {
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-5;
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < pieces.length; i++)
      for (let j = i + 1; j < pieces.length; j++) {
        const p = pieces[i],
          q = pieces[j];
        for (let a = 0; a < p.length; a++)
          for (let b = 0; b < q.length; b++)
            if (same(p[a], q[(b + 1) % q.length]) && same(p[(a + 1) % p.length], q[b])) {
              const merged = Array.from({ length: p.length }, (_, k) => p[(a + 1 + k) % p.length]);
              for (let k = 2; k < q.length; k++) merged.push(q[(b + k) % q.length]);
              let sign = 0,
                convex = true;
              for (let k = 0; k < merged.length; k++) {
                const a = merged[k],
                  b = merged[(k + 1) % merged.length],
                  c = merged[(k + 2) % merged.length],
                  cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
                if (Math.abs(cross) > 1e-5) {
                  sign ||= Math.sign(cross);
                  if (cross * sign < 0) convex = false;
                }
              }
              if (convex) {
                pieces[i] = merged;
                pieces.splice(j, 1);
                changed = true;
                break outer;
              }
            }
      }
  }
  return pieces;
}
const convexPieces = mergeConvex(controlPieces);
const inside = (p) => {
  let found = false;
  const r = P.planRing;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      found = !found;
  }
  return found;
};
const intersects = (a, b, c, d) => {
  const turn = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return (
    turn(a, b, c) * turn(a, b, d) <= 0 &&
    turn(c, d, a) * turn(c, d, b) <= 0 &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
  );
};
const signedArea = (r) =>
  r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0) / 2;
function clipped(subject, clip) {
  let ring = subject;
  const sign = Math.sign(signedArea(clip));
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length],
      dist = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])),
      out = [];
    for (let j = 0; j < ring.length; j++) {
      const p = ring[j],
        q = ring[(j + 1) % ring.length],
        u = dist(p),
        v = dist(q);
      if (u >= -1e-9) out.push(p);
      if ((u > 1e-9 && v < -1e-9) || (u < -1e-9 && v > 1e-9)) {
        const t = u / (u - v);
        out.push(p.map((x, k) => x + (q[k] - x) * t));
      }
    }
    ring = out.filter(
      (p, j) =>
        Math.hypot(
          p[0] - out[(j + out.length - 1) % out.length][0],
          p[1] - out[(j + out.length - 1) % out.length][1],
        ) > 1e-7,
    );
    if (ring.length < 3) return [];
  }
  return Math.abs(signedArea(ring)) > 1e-8 ? ring : [];
}
function surfaceCap(o, slot, ring, height, up) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      slot,
      'palette:#ffffff',
      ring,
      [],
      () => 0,
      [0, up, 0],
      (p) => p,
      colors[slot],
    )
  ) {
    if (Math.abs(signedArea(ring)) > 1e-5)
      throw Error(`Invalid clipped original surface ${JSON.stringify(ring)}`);
    return;
  }
  const m = builder.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    triangle(
      o,
      slot,
      Array.from(m.indices.slice(i, i + 3)).map((j) => {
        const x = m.positions[j * 3],
          z = m.positions[j * 3 + 2];
        return [x, height(x, z), z];
      }),
      [0, up, 0],
    );
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const r = P.planRing,
    lo = [0, 1].map((k) => Math.min(...r.map((p) => p[k]))),
    hi = [0, 1].map((k) => Math.max(...r.map((p) => p[k]))),
    leaves = [],
    maxCell = P.meshLOD.maximumCellMeters[lod],
    tolerance = P.meshLOD.maximumSourceInterpolationMeters[lod];
  function cell(x, z, size) {
    if (x > hi[0] || z > hi[1] || x + size < lo[0] || z + size < lo[1]) return;
    const a = sourceGround(x, z),
      b = sourceGround(x + size, z),
      c = sourceGround(x, z + size),
      d = sourceGround(x + size, z + size),
      at = (px, pz) => {
        const u = (px - x) / size,
          v = (pz - z) / size;
        return u + v <= 1
          ? a * (1 - u - v) + b * u + c * v
          : b * (1 - v) + c * (1 - u) + d * (u + v - 1);
      };
    let error = 0;
    if (size > 2)
      for (let px = x; px <= x + size; px += 2)
        for (let pz = z; pz <= z + size; pz += 2)
          error = Math.max(error, Math.abs(at(px, pz) - sourceGround(px, pz)));
    if (size > 2 && error > tolerance) {
      const n = size / 2;
      for (const dx of [0, n]) for (const dz of [0, n]) cell(x + dx, z + dz, n);
    } else leaves.push({ x, z, size, at, error });
  }
  for (
    let x = G.origin[0] + Math.floor((lo[0] - G.origin[0]) / maxCell) * maxCell;
    x < hi[0];
    x += maxCell
  )
    for (
      let z = G.origin[1] + Math.floor((lo[1] - G.origin[1]) / maxCell) * maxCell;
      z < hi[1];
      z += maxCell
    )
      cell(x, z, maxCell);
  const boundary = r.map(() => []);
  let topPieces = 0;
  for (const leaf of leaves) {
    const { x, z, size, at } = leaf;
    for (const tri of [
      [
        [x, z],
        [x, z + size],
        [x + size, z],
      ],
      [
        [x + size, z],
        [x, z + size],
        [x + size, z + size],
      ],
    ]) {
      const full =
        tri.every(inside) &&
        !r.some((p, i) =>
          tri.some((a, j) => intersects(p, r[(i + 1) % r.length], a, tri[(j + 1) % 3])),
        );
      for (const p of full
        ? [tri]
        : convexPieces.map((piece) => clipped(piece, tri)).filter((p) => p.length >= 3)) {
        surfaceCap(o, 'earth', p, (x, z) => at(x, z) + P.sourceSurfaceSeparationMeters, 1);
        topPieces++;
        for (const q of p)
          for (let e = 0; e < r.length; e++) {
            const a = r[e],
              b = r[(e + 1) % r.length],
              dx = b[0] - a[0],
              dz = b[1] - a[1],
              L = dx * dx + dz * dz,
              t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L;
            if (
              t >= -1e-6 &&
              t <= 1 + 1e-6 &&
              Math.abs(dx * (q[1] - a[1]) - dz * (q[0] - a[0])) / Math.sqrt(L) < 1e-5
            )
              boundary[e].push({ t, p: [q[0], at(...q) + P.sourceSurfaceSeparationMeters, q[1]] });
          }
      }
    }
  }
  const sg = Math.sign(signedArea(r));
  let closureFaces = 0;
  for (let e = 0; lod > 0 && e < r.length; e++) {
    const a = r[e],
      b = r[(e + 1) % r.length],
      out = [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
      allPoints = boundary[e]
        .sort((p, q) => p.t - q.t)
        .filter((p, i, a) => i === 0 || p.t - a[i - 1].t > 1e-6),
      points =
        lod === 0
          ? allPoints.filter((_, i) => i === 0 || i === allPoints.length - 1)
          : allPoints.filter((_, i) => i % [1, 4, 2, 1][lod] === 0 || i === allPoints.length - 1);
    for (let j = 1; j < points.length; j++) {
      const p = points[j - 1].p,
        q = points[j].p,
        u = [p[0], underside, p[2]],
        v = [q[0], underside, q[2]];
      triangle(o, 'closure', [u, v, q], out);
      triangle(o, 'closure', [u, q, p], out);
      closureFaces += 2;
    }
  }
  if (lod > 0) surfaceCap(o, 'closure', r, () => underside, -1);
  componentEvidence.push({
    lod,
    planControls: r.length,
    originalSourceGridTopology: true,
    adaptiveSourceCellMeters: maxCell,
    maximumSourceCellInterpolationMeters: tolerance,
    sourceLeaves: leaves.length,
    topPieces,
    closureFaces,
    wholeDeclaredEnclosure: true,
    sourceGroundUnchanged: true,
    surfaceSeparationMeters: P.sourceSurfaceSeparationMeters,
    closedUndersideOnly: lod > 0,
    skylineDropsBuriedClosure: lod === 0,
    flatFloor: false,
    restoredKeep: false,
    modernShrineOrSignProxy: false,
    wholeCastleCompleted: false,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const center = [0, 1].map((k) => P.planRing.reduce((s, p) => s + p[k] / P.planRing.length, 0)),
  y = sourceGround(...center),
  look = [center[0], y - 1, center[1]],
  camera = [center[0] + 88, y + 62, center[1] + 75],
  root = `content/worldgen/source/places/xn/xn0/${P.model}`;
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: underside - 2,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['gravel', 'earth_rammed'],
  qaCameras: [
    { name: 'whole-upper-current-earthwork-and-edge-slopes', position: camera, lookAt: look },
    {
      name: 'opposite-original-upper-enclosure-profile',
      position: [center[0] - 85, y + 55, center[1] - 70],
      lookAt: look,
    },
    {
      name: 'current-source-upper-surface',
      position: [center[0] + 4, y + 95, center[1] + 0.1],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `original-earthwork-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.041,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.02, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.008, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.002, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense: 'Original deterministic present-earthwork geometry under repository license. Original OSM numerical route and building context credited ODbL, GSI factual elevation data credited to GSI. Precinct perimeters are explicit new estimates from primary textual identity/order and native context, not traced plans or measured medieval roof outlines. Exact published Qualla creatorPD-self originals supply ground character; no photographic texture or restored keep/moat/shrine proxy.',
};
