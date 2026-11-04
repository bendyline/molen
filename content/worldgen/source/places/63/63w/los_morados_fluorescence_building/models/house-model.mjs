/** Whole independent six-telescope building; original numeric outline, written facts only. */
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
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.2 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.2 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
};
const colors = {
  wall: rgb('e0ddcc'),
  roof: rgb('abb5b1'),
  trim: rgb('c7ccc4'),
  foundation: rgb('a8a79a'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
function cap(o, k, r, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      (p) => (typeof y === 'function' ? y(p) : y),
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid FD roof cap');
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
const roofY = (p) =>
  P.roofBack + ((P.roofFront - P.roofBack) * (p[1] - P.roofBackZ)) / (P.roofFrontZ - P.roofBackZ);
const strut = (o, k, a, b, w = 0.06, tint = colors[k]) => beam(o, k, a, b, w, w, tint);
function wallPatch(o, k, c, u, n, width, y0, y1, depth = 0.06, tint = colors[k]) {
  const p = (s, y, d) => [c[0] + s * u[0] + d * n[0], y, c[1] + s * u[1] + d * n[1]],
    w = width / 2,
    a = [p(-w, y0, 0), p(w, y0, 0), p(w, y1, 0), p(-w, y1, 0)],
    b = [p(-w, y0, depth), p(w, y0, depth), p(w, y1, depth), p(-w, y1, depth)];
  face(o, k, a, [-n[0], 0, -n[1]], tint);
  face(o, k, b, [n[0], 0, n[1]], tint);
  for (let j = 0; j < 4; j++) face(o, k, [a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]], null, tint);
}
export function buildHouse(o, f, lod = 3) {
  componentEvidence.length = 0;
  const r = P.nativeRing,
    sign = Math.sign(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign];
    face(
      o,
      'foundation',
      [
        [a[0], P.foundationBottom, a[1]],
        [b[0], P.foundationBottom, b[1]],
        [b[0], P.floor, b[1]],
        [a[0], P.floor, a[1]],
      ],
      n,
    );
    face(
      o,
      'wall',
      [
        [a[0], P.floor, a[1]],
        [b[0], P.floor, b[1]],
        [b[0], roofY(b), b[1]],
        [a[0], roofY(a), a[1]],
      ],
      n,
    );
    if (lod >= 1)
      strut(o, 'trim', [a[0], roofY(a) + 0.035, a[1]], [b[0], roofY(b) + 0.035, b[1]], 0.1);
  }
  cap(o, 'foundation', r, P.foundationBottom, -1);
  cap(o, 'foundation', r, P.floor, 1);
  cap(o, 'roof', r, roofY, 1);
  const edges = r.slice(0, -1).map((a, i) => {
      const b = r[i + 1],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
        n = [u[1] * sign, -u[0] * sign];
      return { a, b, L, u, n };
    }),
    total = edges.reduce((s, e) => s + e.L, 0),
    bays = [];
  for (let i = 0; i < 6; i++) {
    let t = ((i + 0.5) * total) / 6,
      e;
    for (const q of edges) {
      e = q;
      if (t <= q.L) break;
      t -= q.L;
    }
    const c = [e.a[0] + t * e.u[0] + 0.045 * e.n[0], e.a[1] + t * e.u[1] + 0.045 * e.n[1]],
      u = e.u,
      n = e.n;
    wallPatch(
      o,
      'trim',
      c,
      u,
      n,
      P.shutterWidth + 0.24,
      P.shutterBottom - 0.12,
      P.shutterTop + 0.12,
      0.08,
      rgb('8e9993'),
    );
    for (const s of [-1, 1]) {
      const p = [
        c[0] + ((s * P.shutterWidth) / 4) * u[0] + 0.09 * n[0],
        c[1] + ((s * P.shutterWidth) / 4) * u[1] + 0.09 * n[1],
      ];
      wallPatch(
        o,
        'trim',
        p,
        u,
        n,
        P.shutterWidth / 2 - 0.02,
        P.shutterBottom,
        P.shutterTop,
        0.04,
        rgb('d4d9d1'),
      );
    }
    if (lod >= 2) {
      for (const s of [-1, 1]) {
        const a = [c[0] + s * 0.11 * u[0] + 0.15 * n[0], 2.5, c[1] + s * 0.11 * u[1] + 0.15 * n[1]];
        strut(o, 'trim', a, [a[0], 2.8, a[2]], 0.035, rgb('68756f'));
      }
      for (let j = 1; j < 5; j++) {
        const y = P.shutterBottom + ((P.shutterTop - P.shutterBottom) * j) / 5,
          a = [
            c[0] - 0.5 * P.shutterWidth * u[0] + 0.145 * n[0],
            y,
            c[1] - 0.5 * P.shutterWidth * u[1] + 0.145 * n[1],
          ],
          b = [
            c[0] + 0.5 * P.shutterWidth * u[0] + 0.145 * n[0],
            y,
            c[1] + 0.5 * P.shutterWidth * u[1] + 0.145 * n[1],
          ];
        strut(o, 'trim', a, b, 0.018, rgb('a7afa7'));
      }
    }
    bays.push({ center: c, edgeDirection: u, outward: n });
  }
  const a = r.at(-1),
    b = r[0],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    n = [u[1] * sign, -u[0] * sign],
    c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  wallPatch(o, 'trim', c, u, n, 1.8, P.floor, 2.7, 0.11, rgb('929f99'));
  if (lod >= 1) {
    for (const s of [-1, 1])
      wallPatch(
        o,
        'trim',
        [c[0] + s * 8 * u[0], c[1] + s * 8 * u[1]],
        u,
        n,
        1.4,
        1.5,
        2.4,
        0.08,
        rgb('78867d'),
      );
  }
  if (lod >= 2) {
    for (const i of [1, 3, 5, 7, 9]) {
      const p = r[i];
      strut(o, 'trim', [p[0], P.floor, p[1]], [p[0], roofY(p), p[1]], 0.055, rgb('d0d2c6'));
    }
  }
  componentEvidence.push({
    lod,
    nativeCorners: 11,
    wholeBuilding: true,
    completeRoof: true,
    allOuterWalls: true,
    telescopeBays: 6,
    closedDaylightShutters: true,
    rearEntry: true,
    bays,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [42, 24, 47],
  look = [0, 2.8, 3];
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
  brief:
    'Whole original named eleven-corner semicircular fluorescence building, allwalls/fullroof/base and six daytime closed telescope bays/rearentry. Native numerical outline and written operator architecture only; roof/height/facade/finish estimated.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.63,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'metal_standing_seam',
    'metal_painted',
    'concrete_plain',
  ],
  qaCameras: [
    { name: 'whole-six-telescope-curved-facade', position: [24, 9, 38], lookAt: [0, 2.7, 5] },
    { name: 'whole-backwall-roof-service-entry', position: [-34, 20, -38], lookAt: [0, 2.7, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-six-bay-building-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.25,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.07, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Original OSM native numerical footprint ODbL attribution retained. Operator written engineering facts only; every photo/figure/plan unused.',
};
