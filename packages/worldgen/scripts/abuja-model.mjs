/** Abuja National Mosque: mapped stepped hall, gold roofs and four corner minarets. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/s1/s1t/abuja_national_mosque/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const rec = frame.reconstruction,
  plans = rec.plans,
  floor = rec.floorY;
const palette = {
  wall: '#d4b3a0',
  trim: '#e5dac7',
  paving: '#b8b09d',
  roof: '#c3bbab',
  gold: '#e3bb58',
  tile: '#76b7b3',
  glass: '#40515b',
  panel: '#488d90',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
const center = (r) => [0, 1].map((k) => r.reduce((s, p) => s + p[k], 0) / r.length);
const sign = (r) =>
  Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const scaled = (r, t) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * t));
};
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (-i * Math.PI * 2) / n;
    return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
  });
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
export function abujaGround(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Abuja footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
const footing = (p) => Math.min(floor - 0.35, abujaGround(...p) - 0.35);
function writer(out, d) {
  return (slot, p, direction, tint) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction) {
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((s, v, k) => s + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const col = tint ?? colors[slot],
      color = d === 0 ? col.map((v, k) => v * means[slot][k]) : col;
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot) {
  const sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length];
    face(
      slot,
      [at(a, b), at(q, b), at(q, t), at(a, t)],
      [(q[1] - a[1]) * sg, 0, (a[0] - q[0]) * sg],
    );
  }
}
function box(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function profile(face, r, levels, slot) {
  const p = center(r);
  let a = scaled(r, levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const b = scaled(r, levels[i][1]);
    for (let j = 0; j < r.length; j++) {
      const k = (j + 1) % r.length;
      face(
        slot,
        [
          at(a[j], levels[i - 1][0]),
          at(a[k], levels[i - 1][0]),
          at(b[k], levels[i][0]),
          at(b[j], levels[i][0]),
        ],
        [(a[j][0] + a[k][0]) / 2 - p[0], 0, (a[j][1] + a[k][1]) / 2 - p[1]],
      );
    }
    a = b;
  }
  cap(face, a, levels.at(-1)[0], slot);
}
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    return { a, b, length, axis, normal: [axis[1] * sign(r), -axis[0] * sign(r)] };
  });
const topRing = scaled(plans.whole.outline, 0.88);
export function abujaFields() {
  const fields = [];
  for (const [i, e] of edges(plans.whole.outline).entries()) {
    if (e.length < 15) continue;
    const n = Math.max(1, Math.floor(e.length / 9));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n,
        q = e.a.map((v, k) => v + (e.b[k] - v) * t);
      if (q[0] < -34 && Math.abs(q[1]) < 9) continue;
      fields.push({
        name: `recess-${i}-${j}`,
        edge: i,
        t,
        width: 1.6,
        bottom: 3,
        top: 23.3,
        normal: e.normal,
        axis: e.axis,
      });
    }
  }
  return fields;
}
function wallPoint(h, u, y, offset = 0.06) {
  const e = edges(plans.whole.outline)[h.edge],
    a = e.a.map((v, k) => v + (e.b[k] - v) * h.t + e.axis[k] * u),
    b = topRing[h.edge].map(
      (v, k) => v + (topRing[(h.edge + 1) % topRing.length][k] - v) * h.t + e.axis[k] * u,
    ),
    t = (y - 1) / (plans.hallTop - 1);
  return [
    a[0] + (b[0] - a[0]) * t + e.normal[0] * offset,
    floor + y,
    a[1] + (b[1] - a[1]) * t + e.normal[1] * offset,
  ];
}
export const abujaFieldPoint = (h, y) => wallPoint(h, 0, y);
function facades(face, d) {
  if (d === 0) return;
  for (const h of abujaFields()) {
    const p = (u, y, o = 0.07) => wallPoint(h, u, y, o),
      n = [h.normal[0], 0, h.normal[1]],
      w = h.width / 2;
    face('glass', [p(-w, h.bottom), p(w, h.bottom), p(w, h.top), p(-w, h.top)], n);
    if (d >= 2) {
      for (const u of [-w, w])
        face(
          'trim',
          [
            p(u - 0.16, h.bottom, 0.1),
            p(u + 0.16, h.bottom, 0.1),
            p(u + 0.16, h.top, 0.1),
            p(u - 0.16, h.top, 0.1),
          ],
          n,
        );
      for (const y of [8, 15, 21])
        face(
          'trim',
          [
            p(-w, y - 0.12, 0.11),
            p(w, y - 0.12, 0.11),
            p(w, y + 0.12, 0.11),
            p(-w, y + 0.12, 0.11),
          ],
          n,
        );
    }
  }
}
function finial(face, p, b, t, d) {
  profile(
    face,
    circle(p, d === 0 ? 0.16 : 0.11, d === 0 ? 4 : 6),
    d < 2
      ? [
          [b, 1],
          [t, 0],
        ]
      : [
          [b, 1],
          [t - 0.4, 2.1],
          [t - 0.2, 1],
          [t, 0],
        ],
    'gold',
  );
}
function dome(face, p, d, small = false) {
  const n = small ? [6, 8, 12, 16, 20][d] : [8, 12, 24, 32, 40][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 9][d];
  profile(
    face,
    circle(p.center, p.radius, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [p.base + (p.shellTop - p.base) * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'gold',
  );
  finial(face, p.center, p.shellTop, p.totalHeight, d);
  if (d >= 2) {
    const ribs = small ? 8 : d === 2 ? 12 : 20,
      P = (t, a) => [
        p.center[0] + (p.radius * Math.cos(t) + 0.025) * Math.cos(a),
        floor + p.base + (p.shellTop - p.base) * Math.sin(t) + 0.025,
        p.center[1] + (p.radius * Math.cos(t) + 0.025) * Math.sin(a),
      ];
    for (let i = 0; i < ribs; i++)
      for (let j = 0; j < (small ? 2 : 5); j++) {
        const a = (i * Math.PI * 2) / ribs,
          t = (j / (small ? 2 : 5)) * 1.4,
          u = ((j + 1) / (small ? 2 : 5)) * 1.4;
        face(
          'gold',
          [P(t, a - 0.004), P(t, a + 0.004), P(u, a + 0.004), P(u, a - 0.004)],
          [Math.cos(a), 1, Math.sin(a)],
          colors.gold.map((v) => v * 0.85),
        );
      }
  }
}
function minaret(face, p, d) {
  const n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 20,
    r = circle(p.center, p.radius, n);
  box(face, p.outline, footing, p.baseTop, 'trim');
  profile(
    face,
    r,
    [
      [6, 0.82],
      [42, 0.66],
      [43.5, 1.04],
      [44.5, 1.07],
      [45, 0.72],
      [49.1, 0.68],
      [49.4, 0.83],
      [49.8, 0.83],
    ],
    'trim',
  );
  profile(
    face,
    r,
    d <= 1
      ? [
          [49.8, 0.83],
          [52.8, 0.1],
          [53.2, 0.06],
        ]
      : [
          [49.8, 0.83],
          [50.2, 0.7],
          [51.2, 0.4],
          [52.4, 0.16],
          [53.2, 0.07],
        ],
    'trim',
  );
  finial(face, p.center, 53.1, p.totalHeight, d);
  if (d >= 2) {
    for (const e of edges(circle(p.center, p.radius * 0.68, n))) {
      const q = e.a.map((v, k) => (v + e.b[k]) / 2 + e.normal[k] * 0.025),
        P = (u, y) => [q[0] + e.axis[0] * u, floor + y, q[1] + e.axis[1] * u];
      if (e.length < 0.6) continue;
      face(
        'glass',
        [P(-0.16, 46), P(0.16, 46), P(0.16, 48.6), P(-0.16, 48.6)],
        [e.normal[0], 0, e.normal[1]],
      );
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        c = Math.cos(a),
        s = Math.sin(a),
        P = (u, y) => [
          p.center[0] + (p.radius * (0.82 - (0.16 * (y - 6)) / 36) + 0.025) * c - s * u,
          floor + y,
          p.center[1] + (p.radius * (0.82 - (0.16 * (y - 6)) / 36) + 0.025) * s + c * u,
        ];
      face('wall', [P(-0.15, 7), P(0.15, 7), P(0.15, 41.8), P(-0.15, 41.8)], [c, 0, s]);
    }
  }
}
function entry(face, d) {
  const x = plans.entry.x,
    z = plans.entry.z,
    P = (u, y, o = 0) => [x - o, floor + y, z + u];
  box(face, rect(x, -8, x + 4, 8), 0.8, 16, 'trim');
  for (const u of [-5.5, 0, 5.5]) {
    const w = u === 0 ? 2 : 1.5;
    face(
      'gold',
      [P(u - w, 1, 0.08), P(u + w, 1, 0.08), P(u + w, 7, 0.08), P(u - w, 7, 0.08)],
      [-1, 0, 0],
    );
    if (d >= 1) {
      for (const v of [u - w, u + w])
        face(
          'trim',
          [
            P(v - 0.2, 0.9, 0.11),
            P(v + 0.2, 0.9, 0.11),
            P(v + 0.2, 11.2, 0.11),
            P(v - 0.2, 11.2, 0.11),
          ],
          [-1, 0, 0],
        );
      face(
        'tile',
        [P(u - w, 7.5, 0.12), P(u + w, 7.5, 0.12), P(u + w, 10.8, 0.12), P(u - w, 10.8, 0.12)],
        [-1, 0, 0],
        colors.panel,
      );
    }
    if (d >= 2) {
      for (const y of [2.8, 4.8, 6.8])
        face(
          'trim',
          [
            P(u - w + 0.2, y - 0.14, 0.14),
            P(u + w - 0.2, y - 0.14, 0.14),
            P(u + w - 0.2, y + 0.14, 0.14),
            P(u - w + 0.2, y + 0.14, 0.14),
          ],
          [-1, 0, 0],
        );
      face(
        'trim',
        [
          P(u - 0.12, 1.2, 0.14),
          P(u + 0.12, 1.2, 0.14),
          P(u + 0.12, 6.9, 0.14),
          P(u - 0.12, 6.9, 0.14),
        ],
        [-1, 0, 0],
      );
    }
  }
  if (d >= 1)
    for (const y of [7.2, 11.1, 15.5])
      face(
        'wall',
        [
          P(-7.5, y - 0.25, 0.15),
          P(7.5, y - 0.25, 0.15),
          P(7.5, y + 0.25, 0.15),
          P(-7.5, y + 0.25, 0.15),
        ],
        [-1, 0, 0],
      );
}
function parapet(face, d) {
  if (d === 0) return;
  for (const e of edges(topRing)) {
    if (e.length < 8) continue;
    const n = Math.floor(e.length / (d === 1 ? 4 : 2.2));
    for (let i = 0; i < n; i++) {
      const a = e.a.map((v, k) => v + ((e.b[k] - v) * i) / n),
        b = e.a.map((v, k) => v + ((e.b[k] - v) * (i + 1)) / n),
        m = a.map((v, k) => (v + b[k]) / 2);
      face('trim', [at(a, 25.1), at(b, 25.1), at(m, 25.9)], [e.normal[0], 0.1, e.normal[1]]);
    }
  }
}
function build(out, d) {
  const face = writer(out, d),
    r = plans.whole.outline,
    sg = sign(r);
  box(face, r, footing, 1, 'paving');
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = topRing[i],
      v = topRing[(i + 1) % r.length];
    face(
      'wall',
      [at(a, 1), at(b, 1), at(v, plans.hallTop), at(u, plans.hallTop)],
      [(b[1] - a[1]) * sg, 0.05, (a[0] - b[0]) * sg],
    );
  }
  cap(face, topRing, 25, 'roof');
  facades(face, d);
  parapet(face, d);
  box(face, plans.upper.outline, 25, 25.4, 'trim');
  const p = plans.dome,
    n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 24 : 32,
    dr = circle(p.center, p.radius, n);
  box(face, dr, 25.4, p.base, 'trim');
  if (d >= 1)
    for (const e of edges(dr)) {
      const P = (t, y) => [
        e.a[0] + (e.b[0] - e.a[0]) * t + e.normal[0] * 0.04,
        floor + y,
        e.a[1] + (e.b[1] - e.a[1]) * t + e.normal[1] * 0.04,
      ];
      face(
        'glass',
        [P(0.22, 25.6), P(0.78, 25.6), P(0.78, p.base - 0.2), P(0.22, p.base - 0.2)],
        [e.normal[0], 0, e.normal[1]],
      );
    }
  dome(face, p, d);
  for (const q of plans.smallDomes) {
    box(face, circle(q.center, q.radius, d === 0 ? 6 : d === 1 ? 8 : 12), 25, q.base, 'trim');
    dome(face, q, d, true);
  }
  for (const t of plans.towers) minaret(face, t, d);
  entry(face, d);
}
export const buildAbujaSkyline = (o) => build(o, 0),
  buildAbujaDistrict = (o) => build(o, 1),
  buildAbujaStreet = (o) => build(o, 2),
  buildAbujaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({
  name,
  position: [position[0], position[1] + floor, position[2]],
  lookAt: [lookAt[0], lookAt[1] + floor, lookAt[2]],
  fov: 48,
});
export const abujaStudy = {
  id: 'abuja_national_mosque',
  key: 'abuja_national_mosque',
  title: 'Abuja National Mosque',
  category: 'mosque',
  wikidataId: 'Q1430127',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Six existing shared256² sandstone,raw/weathered limestone,membrane,bronze and ceramic graphs;seven merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Original coarse door/panel/roof abstractions;no historic inscriptions or mosaic artwork copied.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Two exterior pictures and an entrance detail guide appearance. Signed facing,facade batter,roof and minaret transitions,small cupolas and current condition remain approximate. Interiors,engineering and physical-device/full-city performance are unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('golden-roofs-and-drum', [-60, 54, -64], [0, 32, 0]),
    cam('battered-walls-and-recesses', [-65, 21, -62], [-3, 13, -22]),
    cam('brass-west-entrance', [-53, 20, -5], [-36.4, 5, 0]),
    cam('four-flared-minarets', [-80, 52, -80], [0, 34, 0]),
    cam('minaret-cap', [-50, 54, -57], [-30, 49, -36]),
    cam('mapped-stepped-envelope', [0, 190, 0.1], [0, 0, 0]),
  ],
};
