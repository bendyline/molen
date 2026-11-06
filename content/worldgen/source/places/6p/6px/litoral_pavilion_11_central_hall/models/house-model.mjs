/** Whole mapped roofed block; all appearance details are bounded non-photographic estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.93, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.14 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.91, metallic: 0.1 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.94, metallic: 0.05 },
};
const colors = {
  wall: rgb('dddcd0'),
  roof: rgb('acb1a9'),
  foundation: rgb('a6aa9f'),
  trim: rgb('7d8b88'),
  door: rgb('adb8ae'),
  window: rgb('34474a'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid block cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const R = P.nativeRing,
    sign = Math.sign(
      R.reduce((s, a, i) => {
        const b = R[(i + 1) % R.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    );
  polygon(o, 'foundation', R, P.foundationBottom, P.floor);
  cap(o, 'wall', R, P.floor, -1);
  polygon(o, 'roof', R, P.eave, P.roofTop);
  let recesses = 0,
    windows = 0,
    entries = 0;
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [((b[1] - a[1]) / L) * sign, 0, (-(b[0] - a[0]) / L) * sign],
      at = (t, y, offset = 0) => [
        a[0] + ((b[0] - a[0]) * t) / L + normal[0] * offset,
        y,
        a[1] + ((b[1] - a[1]) * t) / L + normal[2] * offset,
      ],
      patch = (x0, x1, y0, y1) => {
        if (x1 - x0 > 1e-6 && y1 - y0 > 1e-6)
          face(o, 'wall', [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)], normal);
      },
      openings = [];
    if (L > 20) {
      const count = Math.max(6, Math.round(L / 4));
      for (let n = 0; n < count; n++) {
        const mid = ((n + 1) * L) / (count + 1);
        openings.push({
          x0: mid - 0.62,
          x1: mid + 0.62,
          y0: P.floor + 2.6,
          y1: P.floor + 3.45,
          kind: 'window',
        });
      }
    } else if (i === P.entryEdge) {
      openings.push({
        x0: L / 2 - 0.8,
        x1: L / 2 + 0.8,
        y0: P.floor,
        y1: P.floor + 2.35,
        kind: 'door',
      });
    } else if (L >= 3)
      openings.push({
        x0: L / 2 - 0.7,
        x1: L / 2 + 0.7,
        y0: P.floor + 2.8,
        y1: P.floor + 3.5,
        kind: 'window',
      });
    if (lod < 2) patch(0, L, P.floor, P.eave);
    else {
      let cursor = 0;
      for (const w of openings) {
        patch(cursor, w.x0, P.floor, P.eave);
        patch(w.x0, w.x1, P.floor, w.y0);
        patch(w.x0, w.x1, w.y1, P.eave);
        cursor = w.x1;
      }
      patch(cursor, L, P.floor, P.eave);
    }
    for (const w of openings) {
      const depth = lod > 1 ? -0.12 : 0.012,
        pts = [
          at(w.x0, w.y0, depth),
          at(w.x1, w.y0, depth),
          at(w.x1, w.y1, depth),
          at(w.x0, w.y1, depth),
        ];
      face(o, w.kind, pts, normal);
      if (w.kind === 'door') entries++;
      else windows++;
      if (lod > 1) {
        recesses++;
        const front = [at(w.x0, w.y0), at(w.x1, w.y0), at(w.x1, w.y1), at(w.x0, w.y1)];
        for (let q = 0; q < 4; q++) {
          const n = (q + 1) % 4;
          face(o, 'wall', [front[q], pts[q], pts[n], front[n]]);
        }
        for (const t of [w.x0, w.x1])
          beam(o, 'trim', at(t, w.y0, 0.015), at(t, w.y1, 0.015), 0.045, 0.045, colors.trim);
        beam(o, 'trim', at(w.x0, w.y0, 0.018), at(w.x1, w.y0, 0.018), 0.045, 0.045, colors.trim);
        beam(o, 'trim', at(w.x0, w.y1, 0.018), at(w.x1, w.y1, 0.018), 0.045, 0.045, colors.trim);
        if (w.kind === 'window') {
          const bars = lod === 2 ? 3 : 5;
          for (let q = 1; q <= bars; q++) {
            const t = w.x0 + ((w.x1 - w.x0) * q) / (bars + 1);
            beam(o, 'trim', at(t, w.y0, 0.03), at(t, w.y1, 0.03), 0.024, 0.024, colors.trim);
          }
          beam(
            o,
            'trim',
            at(w.x0, (w.y0 + w.y1) / 2, 0.03),
            at(w.x1, (w.y0 + w.y1) / 2, 0.03),
            0.022,
            0.022,
            colors.trim,
          );
        }
      }
      if (w.kind === 'door') {
        const left = at(w.x0 - 0.3, P.floor + 2.55, 0.04),
          right = at(w.x1 + 0.3, P.floor + 2.55, 0.04),
          rr = [
            [left[0], left[2]],
            [right[0], right[2]],
            [right[0] + normal[0] * 0.85, right[2] + normal[2] * 0.85],
            [left[0] + normal[0] * 0.85, left[2] + normal[2] * 0.85],
          ];
        polygon(o, 'roof', rr, P.floor + 2.55, P.floor + 2.67);
        if (lod > 0)
          for (const t of [w.x0 - 0.15, w.x1 + 0.15])
            beam(
              o,
              'trim',
              at(t, P.floor + 2.15, 0.04),
              at(t, P.floor + 2.55, 0.72),
              0.045,
              0.045,
              colors.trim,
            );
      }
    }
    beam(
      o,
      'wall',
      at(0, P.roofTop + 0.11, -0.07),
      at(L, P.roofTop + 0.11, -0.07),
      0.14,
      0.22,
      colors.wall,
    );
  }
  componentEvidence.push({
    lod,
    wholeIndependentBlock: true,
    nativeControls: P.nativeRing.length,
    allExteriorWalls: true,
    wholeClosedRoof: true,
    foundation: true,
    closedEntries: entries,
    windowCensus: windows,
    physicalRecesses: recesses,
    openCompoundYardsPreserved: true,
    notWholePrisonProxy: true,
    numericalHeightMedian: P.numericalHeightMedian,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const span = Math.max(
  ...[0, 1].map(
    (k) => Math.max(...P.nativeRing.map((p) => p[k])) - Math.min(...P.nativeRing.map((p) => p[k])),
  ),
);
const root = 'content/worldgen/source/places/6p/6px/litoral_pavilion_11_central_hall',
  camera = [span * 1.1, Math.max(18, span * 0.5), span * 0.95],
  look = [0, (P.floor + P.roofTop) * 0.42, 0];
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
  brief: P.limitations.join(' '),
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -1.35,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stucco', 'membrane', 'metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'whole-independent-roofed-block-and-windows', position: camera, lookAt: look },
    {
      name: 'opposite-closed-entry-and-roof',
      position: [-camera[0], camera[1] * 0.93, -camera[2]],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-pavilion-block-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic exterior geometry under repository license. Structured Overture/Microsoft footprint and Google numerical relative-height data credited ODbL; SNAI written construction facts. Every photograph, satellite image, map image, figure, drawing and appearance texture unused. All original corners and estimated numerical relative height retained; facade, roof section, finish, floor census, condition and ground contact explicitly approximate.',
};
