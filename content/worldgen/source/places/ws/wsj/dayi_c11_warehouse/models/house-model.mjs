/** Whole native industrial envelope; every elevation is an explicit local-family estimate. */
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
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85, metallic: 0.2 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.28 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.98, metallic: 0 },
};
const colors = {
  wall: rgb('aaa99a'),
  roof: rgb('454b50'),
  foundation: rgb('98998c'),
  steel: rgb('657271'),
  brick: rgb('99694f'),
};
export const componentEvidence = [];
const ring = P.nativeRing,
  sg = Math.sign(
    ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  ),
  xmin = Math.min(...ring.map((p) => p[0])),
  xmax = Math.max(...ring.map((p) => p[0])),
  mid = (xmin + xmax) / 2,
  half = (xmax - xmin) / 2;
const roof = (p) => P.eave + (P.ridge - P.eave) * (1 - Math.abs(p[0] - mid) / half);
const edges = ring.map((a, i) => {
  const b = ring[(i + 1) % ring.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    a,
    b,
    L,
    t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    n: [((b[1] - a[1]) / L) * sg, (-(b[0] - a[0]) / L) * sg],
  };
});
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
    throw Error('Invalid whole native polygon cap');
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
function prism(o, k, r, y0, y1) {
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
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const strut = (o, k, a, b, w = 0.08, tint) => beam(o, k, a, b, w, w, tint ?? colors[k]);
function split(r, side) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      aa = (a[0] - mid) * side >= 0,
      bb = (b[0] - mid) * side >= 0;
    if (aa) out.push(a);
    if (aa !== bb) {
      const t = (mid - a[0]) / (b[0] - a[0]);
      out.push([mid, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
// Offset each original edge and intersect neighboring offset lines. Bounded miters
// preserve the clipped corner and narrow rear wing without a rectangular roof proxy.
const roofRing = edges.map((e, i) => {
  const p = edges[(i + edges.length - 1) % edges.length],
    a = [e.a[0] + p.n[0] * P.roofOverhang, e.a[1] + p.n[1] * P.roofOverhang],
    b = [e.a[0] + e.n[0] * P.roofOverhang, e.a[1] + e.n[1] * P.roofOverhang],
    den = p.t[0] * e.t[1] - p.t[1] * e.t[0];
  if (Math.abs(den) < 1e-8) return b;
  const d = [b[0] - a[0], b[1] - a[1]],
    t = (d[0] * e.t[1] - d[1] * e.t[0]) / den,
    q = [a[0] + p.t[0] * t, a[1] + p.t[1] * t];
  if (Math.hypot(q[0] - e.a[0], q[1] - e.a[1]) > P.roofOverhang * 5)
    throw Error('Unbounded roof corner');
  return q;
});
const along = (e, d, y, out = 0) => [
  e.a[0] + e.t[0] * d + e.n[0] * out,
  y,
  e.a[1] + e.t[1] * d + e.n[1] * out,
];
function panel(o, e, d, w, y0, y1, lod, window) {
  const at = 0.14,
    p = (s, y, out = at) => along(e, d + s, y, out);
  face(
    o,
    'steel',
    [p(-w / 2, y0), p(w / 2, y0), p(w / 2, y1), p(-w / 2, y1)],
    [e.n[0], 0, e.n[1]],
    window ? rgb('294959') : rgb('838c86'),
  );
  if (lod >= 1) {
    for (const x of [-w / 2, w / 2])
      strut(o, 'foundation', p(x, y0 - 0.08, at + 0.03), p(x, y1 + 0.08, at + 0.03), 0.14);
    for (const y of [y0, y1])
      strut(o, 'foundation', p(-w / 2 - 0.1, y, at + 0.03), p(w / 2 + 0.1, y, at + 0.03), 0.14);
    if (window) {
      strut(o, 'steel', p(0, y0, at + 0.06), p(0, y1, at + 0.06), 0.065);
      strut(
        o,
        'steel',
        p(-w / 2, (y0 + y1) / 2, at + 0.06),
        p(w / 2, (y0 + y1) / 2, at + 0.06),
        0.065,
      );
    }
  }
  if (lod === 3 && !window)
    for (let i = 1; i < 12; i++) {
      const y = y0 + ((y1 - y0) * i) / 12;
      strut(o, 'steel', p(-w / 2, y, at + 0.07), p(w / 2, y, at + 0.07), 0.035, rgb('818b86'));
    }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  prism(o, 'foundation', ring, P.foundationBottom, P.floor);
  const body = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    body.push(a);
    if ((a[0] - mid) * (b[0] - mid) < 0) {
      const t = (mid - a[0]) / (b[0] - a[0]);
      body.push([mid, a[1] + t * (b[1] - a[1])]);
    }
  }
  for (let i = 0; i < body.length; i++) {
    const a = body[i],
      b = body[(i + 1) % body.length];
    face(
      o,
      'wall',
      [
        [a[0], P.floor, a[1]],
        [b[0], P.floor, b[1]],
        [b[0], roof(b), b[1]],
        [a[0], roof(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
    );
  }
  cap(o, 'wall', ring, P.floor, -1);
  for (const side of [-1, 1]) cap(o, 'roof', split(roofRing, side), (p) => roof(p) + 0.12, 1);
  let windows = 0,
    rollers = 0,
    pilasters = 0;
  const facadeEdges = [];
  for (const [eindex, e] of edges.entries()) {
    const longitudinal = Math.abs(e.t[1]) > 0.9,
      bays = longitudinal ? Math.max(1, Math.round(e.L / 4.7)) : 1,
      side = { nativeEdge: eindex, bays, windows: 0, rollers: 0 };
    // Structural piers remain at every native corner and at each estimated longwall bay.
    for (let i = 0; i <= bays; i++) {
      const d = (e.L * i) / bays,
        p = along(e, d, 0, 0.045),
        top = Math.min(P.eave, roof([p[0], p[2]]));
      strut(o, 'foundation', [p[0], P.floor, p[2]], [p[0], top, p[2]], 0.29);
      pilasters++;
    }
    for (const y of [P.eave - 0.37, P.eave - 0.045])
      strut(o, 'foundation', along(e, 0, y, 0.05), along(e, e.L, y, 0.05), 0.19);
    if (longitudinal) {
      for (let i = 0; i < bays; i++) {
        const d = (e.L * (i + 0.5)) / bays,
          door = bays >= 5 && (i === 2 || i === 5),
          w = Math.min(door ? 2.45 : 2.1, e.L / bays - 0.6);
        panel(o, e, d, w, door ? P.floor + 0.03 : 1.05, door ? 3.5 : 3.45, lod, !door);
        if (door) {
          rollers++;
          side.rollers++;
        } else {
          windows++;
          side.windows++;
        }
        if (lod >= 2 && i % 2 === 0) {
          const a = along(e, d - w / 2, 0.3, 0.145),
            b = along(e, d - w / 2 + 0.55, 0.3, 0.145);
          face(o, 'brick', [a, b, [b[0], 0.58, b[2]], [a[0], 0.58, a[2]]], [e.n[0], 0, e.n[1]]);
        }
      }
    }
    if (lod >= 2) {
      const a = roofRing[eindex],
        b = roofRing[(eindex + 1) % roofRing.length];
      if ((a[0] - mid) * (b[0] - mid) >= 0)
        strut(o, 'steel', [a[0], roof(a) + 0.12, a[1]], [b[0], roof(b) + 0.12, b[1]], 0.12);
      if (longitudinal)
        for (const d of [0.4, e.L - 0.4])
          strut(
            o,
            'steel',
            along(e, d, P.eave - 0.05, 0.24),
            along(e, d, P.floor + 0.04, 0.24),
            0.075,
          );
    }
    facadeEdges.push(side);
  }
  // Two closed entries belong to actual wide native end edges, not a rectangular cap.
  const gables = edges
    .filter((e) => Math.abs(e.t[0]) > 0.9 && e.L > 3.4)
    .sort((a, b) => a.a[1] + a.b[1] - (b.a[1] + b.b[1]));
  for (const [i, e] of [gables[0], gables.at(-1)].entries()) {
    if (!e) throw Error('Missing native end edge');
    panel(o, e, e.L / 2, i ? 2.7 : 4.7, P.floor + 0.02, P.floor + (i ? 3.05 : 4), lod, false);
  }
  // Ridge and higher-detail roof seams follow the actual offset outline.
  const zs = roofRing.map((p) => p[1]),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs);
  function intervals(z) {
    const xs = [];
    for (let i = 0; i < roofRing.length; i++) {
      const a = roofRing[i],
        b = roofRing[(i + 1) % roofRing.length];
      if ((a[1] <= z && b[1] > z) || (b[1] <= z && a[1] > z)) {
        const t = (z - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((a, b) => a - b);
    return Array.from({ length: xs.length / 2 }, (_, i) => [xs[i * 2], xs[i * 2 + 1]]);
  }
  if (lod >= 1) {
    const ends = [];
    for (let i = 0; i < roofRing.length; i++) {
      const a = roofRing[i],
        b = roofRing[(i + 1) % roofRing.length];
      if ((a[0] - mid) * (b[0] - mid) <= 0 && a[0] !== b[0])
        ends.push(a[1] + ((mid - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
    }
    ends.sort((a, b) => a - b);
    for (let i = 0; i + 1 < ends.length; i += 2)
      strut(o, 'steel', [mid, P.ridge + 0.15, ends[i]], [mid, P.ridge + 0.15, ends[i + 1]], 0.14);
  }
  if (lod === 3) {
    const seams = Math.ceil((z1 - z0) / 0.7);
    for (let i = 1; i < seams; i++) {
      const z = z0 + ((z1 - z0) * i) / seams;
      for (const [a, b] of intervals(z)) {
        const points = [a, ...(a < mid && b > mid ? [mid] : []), b];
        for (let j = 0; j + 1 < points.length; j++) {
          const a = [points[j], z],
            b = [points[j + 1], z];
          strut(
            o,
            'roof',
            [a[0], roof(a) + 0.15, z],
            [b[0], roof(b) + 0.15, z],
            0.026,
            rgb('525a5c'),
          );
        }
      }
    }
  }
  componentEvidence.push({
    lod,
    nativeCorners: ring.length,
    wholeBody: true,
    allWalls: true,
    fullGabledRoof: true,
    fullGableEnds: true,
    foundation: true,
    nativeIrregularOutlineRetained: true,
    allRoofAndFacadeCornersFollowNativeEdges: true,
    longwallPilasters: pilasters,
    estimatedTotalWindowPanels: windows,
    estimatedTotalRollerDoors: rollers,
    facadeEdges,
    closedGableServiceEntries: 2,
    broadGableEntry: true,
    allElevationsEstimated: true,
    notWholePier2Proxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [-54, 31, 59],
  look = [0, 4, 1];
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
  portableGroundY: P.floor - 0.18,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'metal_corrugated',
    'concrete_plain',
    'metal_painted',
    'brick',
  ],
  qaCameras: [
    { name: 'whole-native-front-longwall-and-roof', position: [-54, 26, 49], lookAt: look },
    { name: 'whole-native-opposite-and-rear-extension', position: [52, 28, -54], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-native-warehouse-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry/repository license. All numerical native OSM outer controls retained with ODbL attribution. Exact53500205916/137596559@N07/2015-11-29CC0original supplies general neighboring C5construction family only. All own elevations, roof pitch, sections and opening census explicitly estimated. Protected graphics, art, people and photo textures unused.',
};
