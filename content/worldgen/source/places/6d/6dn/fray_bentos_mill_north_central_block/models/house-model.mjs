/** Complete native industrial hall. Photograph context never supplies an invented process identity. */
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
  wall: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.79, metallic: 0.25 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.25 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.25 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.84, metallic: 0.2 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.9, metallic: 0.12 },
};
const colors = {
  wall: rgb('d5d9d8'),
  roof: rgb('a8b4b6'),
  foundation: rgb('a9aaa4'),
  trim: rgb('7a8d96'),
  door: rgb('9aaeb4'),
  window: rgb('38474b'),
};
export const componentEvidence = [];
export const roofY = ([, z]) =>
  P.roofTop - (P.roofRise * Math.abs(z - P.roofMidZ)) / P.roofHalfWidth;
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, height, up) {
  const b = new MeshBufferBuilder();
  if (!b.addCap(k, 'palette:#ffffff', r, [], height, [0, up, 0], (p) => p, colors[k]))
    throw Error('Invalid hall cap');
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
function clip(r, sign) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      v = (a[1] - P.roofMidZ) * sign,
      w = (b[1] - P.roofMidZ) * sign;
    if (v >= -1e-8) out.push(a);
    if (v * w < 0) {
      const t = v / (v - w);
      out.push([a[0] + t * (b[0] - a[0]), P.roofMidZ]);
    }
  }
  return out;
}
function solid(o, k, r, y0, y1) {
  const sg = Math.sign(
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
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
  }
  cap(o, k, r, () => y0, -1);
  cap(o, k, r, () => y1, 1);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const R = P.nativeRing,
    sg = Math.sign(
      R.reduce((s, a, i) => {
        const b = R[(i + 1) % R.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    );
  solid(o, 'foundation', R, P.foundationBottom, P.floor);
  cap(o, 'wall', R, () => P.floor, -1);
  for (const sign of [-1, 1]) {
    const r = clip(R, sign);
    cap(o, 'roof', r, roofY, 1);
    cap(o, 'roof', r, (p) => roofY(p) - 0.15, -1);
  }
  let louvers = 0,
    entries = 0,
    recesses = 0;
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [((b[1] - a[1]) / L) * sg, 0, (-(b[0] - a[0]) / L) * sg],
      at = (t, y, offset = 0) => [
        a[0] + ((b[0] - a[0]) * t) / L + n[0] * offset,
        y,
        a[1] + ((b[1] - a[1]) * t) / L + n[2] * offset,
      ],
      top = (t) => {
        const q = at(t, 0);
        return roofY([q[0], q[2]]) - 0.15;
      },
      ridgeT = ((P.roofMidZ - a[1]) / (b[1] - a[1])) * L;
    const patch = (x0, x1, y0, y1) => {
      if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return;
      const cuts = [x0, ...(ridgeT > x0 + 1e-5 && ridgeT < x1 - 1e-5 ? [ridgeT] : []), x1];
      for (let j = 1; j < cuts.length; j++) {
        const u = cuts[j - 1],
          v = cuts[j];
        face(
          o,
          y0 < P.plinthTop - 0.001 ? 'foundation' : 'wall',
          [at(u, y0), at(v, y0), at(v, Math.min(y1, top(v))), at(u, Math.min(y1, top(u)))],
          n,
        );
      }
    };
    const openings = [];
    if (i === P.entryEdge) {
      openings.push(
        {
          x0: L * 0.46 - 2.4,
          x1: L * 0.46 + 2.4,
          y0: P.floor,
          y1: P.floor + P.serviceDoorHeight,
          kind: 'door',
        },
        { x0: L * 0.75 - 0.6, x1: L * 0.75 + 0.6, y0: P.floor, y1: P.floor + 2.4, kind: 'door' },
      );
    } else if (L >= 12) {
      const count = L > 50 ? Math.max(2, Math.floor(L / 12)) : 2;
      for (let j = 0; j < count; j++) {
        const mid = ((j + 1) * L) / (count + 1);
        openings.push({
          x0: mid - 1.9,
          x1: mid + 1.9,
          y0: P.louverBottom,
          y1: P.louverTop,
          kind: 'window',
        });
      }
    }
    if (lod < 2) {
      patch(0, L, P.floor, P.plinthTop);
      patch(0, L, P.plinthTop, 100);
    } else {
      let cursor = 0;
      for (const w of openings) {
        patch(cursor, w.x0, P.floor, P.plinthTop);
        patch(cursor, w.x0, P.plinthTop, 100);
        patch(w.x0, w.x1, P.floor, Math.min(w.y0, P.plinthTop));
        if (w.y0 > P.plinthTop) patch(w.x0, w.x1, P.plinthTop, w.y0);
        patch(w.x0, w.x1, w.y1, 100);
        cursor = w.x1;
      }
      patch(cursor, L, P.floor, P.plinthTop);
      patch(cursor, L, P.plinthTop, 100);
    }
    for (const w of openings) {
      const depth = lod > 1 ? -0.18 : 0.016,
        pts = [
          at(w.x0, w.y0, depth),
          at(w.x1, w.y0, depth),
          at(w.x1, w.y1, depth),
          at(w.x0, w.y1, depth),
        ];
      face(o, w.kind, pts, n);
      if (w.kind === 'door') entries++;
      else louvers++;
      if (lod > 1) {
        recesses++;
        const front = [at(w.x0, w.y0), at(w.x1, w.y0), at(w.x1, w.y1), at(w.x0, w.y1)];
        for (let j = 0; j < 4; j++)
          face(o, 'trim', [front[j], pts[j], pts[(j + 1) % 4], front[(j + 1) % 4]]);
        for (const t of [w.x0, w.x1])
          beam(o, 'trim', at(t, w.y0, 0.02), at(t, w.y1, 0.02), 0.07, 0.07, colors.trim);
        for (const y of [w.y0, w.y1])
          beam(o, 'trim', at(w.x0, y, 0.02), at(w.x1, y, 0.02), 0.07, 0.07, colors.trim);
        if (w.kind === 'window') {
          const count = lod === 2 ? 4 : 7;
          for (let j = 1; j <= count; j++) {
            const y = w.y0 + ((w.y1 - w.y0) * j) / (count + 1);
            beam(o, 'trim', at(w.x0, y, -0.04), at(w.x1, y, -0.04), 0.035, 0.1, colors.trim);
          }
        } else if (w.x1 - w.x0 > 3) {
          for (let y = w.y0 + 0.5; y < w.y1; y += 0.55)
            beam(o, 'trim', at(w.x0, y, -0.14), at(w.x1, y, -0.14), 0.025, 0.025, colors.trim);
          beam(
            o,
            'trim',
            at(w.x1 - 0.6, P.floor + 1, 0.01),
            at(w.x1 - 0.6, P.floor + 1.2, 0.01),
            0.045,
            0.045,
            colors.trim,
          );
        }
      }
    }
    const stations = [0, ...(ridgeT > 1e-5 && ridgeT < L - 1e-5 ? [ridgeT] : []), L];
    for (let j = 1; j < stations.length; j++) {
      const u = stations[j - 1],
        v = stations[j];
      face(
        o,
        'roof',
        [at(u, top(u)), at(v, top(v)), at(v, top(v) + 0.15), at(u, top(u) + 0.15)],
        n,
      );
      if (lod > 0)
        beam(
          o,
          'trim',
          at(u, top(u) - 0.1, 0.1),
          at(v, top(v) - 0.1, 0.1),
          0.15,
          0.16,
          colors.trim,
        );
    }
    if (lod > 0) {
      const bays = Math.max(1, Math.round(L / 7));
      for (let j = 0; j <= bays; j++) {
        const t = (j * L) / bays;
        beam(
          o,
          'trim',
          at(t, P.plinthTop, 0.035),
          at(t, top(t) - 0.1, 0.035),
          0.09,
          0.075,
          colors.trim,
        );
      }
      if (L > 50)
        for (const t of [0.35, L - 0.35])
          beam(
            o,
            'trim',
            at(t, P.floor, 0.16),
            at(t, top(t) - 0.25, 0.16),
            0.11,
            0.11,
            colors.trim,
          );
    }
  }
  const ridge = clip(R, 1)
    .filter((p) => Math.abs(p[1] - P.roofMidZ) < 1e-7)
    .sort((a, b) => a[0] - b[0]);
  if (lod > 0 && ridge.length >= 2)
    beam(
      o,
      'trim',
      [ridge[0][0], P.roofTop + 0.025, P.roofMidZ],
      [ridge.at(-1)[0], P.roofTop + 0.025, P.roofMidZ],
      0.16,
      0.08,
      colors.trim,
    );
  componentEvidence.push({
    lod,
    wholeIndependentHall: true,
    nativeControls: R.length,
    allExteriorWalls: true,
    wholeClosedRoof: true,
    foundation: true,
    closedEntries: entries,
    louverCensus: louvers,
    physicalRecesses: recesses,
    openFactoryYardsPreserved: true,
    notWholeFactoryProxy: true,
    numericalHeightMedian: P.numericalHeightMedian,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/6d/6dn/fray_bentos_mill_north_central_block',
  span = Math.max(
    ...[0, 1].map(
      (k) =>
        Math.max(...P.nativeRing.map((p) => p[k])) - Math.min(...P.nativeRing.map((p) => p[k])),
    ),
  ),
  camera = [span * 1.3, span * 0.7, span * 1.15],
  look = [0, P.roofTop * 0.4, 0];
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
  embeddedCanonicalGraphs: [
    'metal_corrugated',
    'metal_standing_seam',
    'metal_painted',
    'concrete_plain',
  ],
  qaCameras: [
    { name: 'whole-hall-metal-roof-and-louver-facades', position: camera, lookAt: look },
    {
      name: 'opposite-complete-service-entries-and-concrete-base',
      position: [-camera[0], camera[1] * 0.8, -camera[2]],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-industrial-hall-' + reviewLod,
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
    'Original deterministic exterior geometry under repository license. Overture / Google Open Buildings full numerical footprint and Google numerical relative heights credited under ODbL. Three already-cleared public-domain U.S. Embassy Montevideo staff photographs inform factory-level material vocabulary only; no photo texture, specific hall correspondence or observed facade/roof census claimed. Exact floor, roof section, openings, trim, condition and ground contact estimated.',
};
