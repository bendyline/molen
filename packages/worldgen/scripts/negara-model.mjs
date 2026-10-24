/** National Mosque of Malaysia: folded turquoise umbrella, low capped ranges and square minaret. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/w2/w28/national_mosque_of_malaysia/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const rec = frame.reconstruction,
  floor = rec.floorY;
const palette = {
  wall: '#d1d3ce',
  trim: '#d8dbd3',
  flat: '#c8c7bf',
  roof: '#6eb6c5',
  door: '#8e7f6b',
  glass: '#647b84',
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
const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
const _lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const center = (r) => [0, 1].map((k) => r.reduce((n, p) => n + p[k], 0) / r.length);
const sign = (r) =>
  Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(-0.35, floor - 0.3, negaraGround(...p) - 0.35);
export function negaraGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Negara footing outside retained terrain');
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
function writer(out, d) {
  return (slot, p, direction, colorOverride) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction) {
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((sum, v, k) => sum + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const _normal = direction ?? normalFor(p[0], p[1], p[2]);
    const tint = colorOverride ?? colors[slot];
    const color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
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
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function beam(face, a, b, w, slot = 'trim') {
  const axis = unit(b.map((v, k) => v - a[k])),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = unit(cross(axis, u)),
    corners = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((n, k) => n + ((u[k] * s + v[k] * t) * w) / 2)),
    lo = corners(a),
    hi = corners(b);
  face(
    slot,
    lo,
    axis.map((v) => -v),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
function profile(face, ring, levels, slot) {
  const origin = center(ring);
  let prev = scaled(ring, levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scaled(ring, levels[i][1]);
    for (let k = 0; k < r.length; k++) {
      const j = (k + 1) % r.length;
      face(
        slot,
        [
          at(prev[k], levels[i - 1][0]),
          at(prev[j], levels[i - 1][0]),
          at(r[j], levels[i][0]),
          at(r[k], levels[i][0]),
        ],
        [(prev[k][0] + prev[j][0]) / 2 - origin[0], 0, (prev[k][1] + prev[j][1]) / 2 - origin[1]],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
export function negaraInside(p, r) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function underside(face, r, y, slot, holes = []) {
  cap((slot, p) => face(slot, p, [0, -1, 0]), r, y, slot, holes);
}
function slab(face, r, b, t, slot, holes = []) {
  sides(face, r, b, t, slot);
  for (const h of holes) sides(face, h, b, t, slot, true);
  cap(face, r, t, slot, holes);
  underside(face, r, b, slot, holes);
}
function post(face, p, b, t, width, d) {
  const r = rect(p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2);
  solid(face, r, b, t, 'wall');
  if (d >= 2)
    solid(
      face,
      rect(p[0] - width * 0.85, p[1] - width * 0.85, p[0] + width * 0.85, p[1] + width * 0.85),
      t - 0.55,
      t,
      'trim',
    );
}
export function negaraRoofCaps(d = 3) {
  if (d === 0) return [];
  const step = d === 1 ? 12 : 6,
    points = [];
  for (let x = -84; x <= 84; x += step)
    for (let z = -72; z <= 72; z += step) {
      const p = [x, z],
        r = 2.35;
      if (distance(p, plans.central) < 35) continue;
      if (rect(x - r, z - r, x + r, z + r).every((q) => negaraInside(q, plans.main.outline)))
        points.push(p);
    }
  return points;
}
function capTile(face, p, d) {
  const r = rect(p[0] - 2.35, p[1] - 2.35, p[0] + 2.35, p[1] + 2.35);
  if (d <= 2) {
    const apex = at(p, 12.05);
    for (let i = 0; i < 4; i++)
      face('trim', [at(r[i], 11), at(r[(i + 1) % 4], 11), apex], [0, 1, 0]);
    return;
  }
  const inset = rect(p[0] - 1.05, p[1] - 1.05, p[0] + 1.05, p[1] + 1.05);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face('trim', [at(r[i], 11), at(r[j], 11), at(inset[j], 12), at(inset[i], 12)], [0, 1, 0]);
  }
  cap(face, inset, 12, 'trim');
}
export function negaraColumns(d = 3) {
  const points = [],
    step = d === 0 ? 24 : d === 1 ? 12 : 6;
  for (const r of [plans.main.outline, plans.connector.outline])
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        len = distance(a, b),
        n = Math.max(1, Math.floor(len / step));
      for (let j = 0; j < n; j++) {
        if (d === 0 && i % 3 !== 0) continue;
        const p = a.map((v, k) => v + ((b[k] - v) * (j + 0.5)) / n);
        if (distance(p, plans.central) < 29 || distance(p, plans.minaret) < 7) continue;
        if (points.some((q) => distance(p, q) < 2)) continue;
        points.push(p);
      }
    }
  return points;
}
function lowRanges(face, d) {
  slab(face, plans.main.outline, 10.35, 11, 'flat', plans.main.holes);
  slab(face, plans.connector.outline, 10.35, 11, 'flat');
  for (const p of negaraColumns(d)) post(face, p, 2.4, 10.35, d === 0 ? 1.2 : 0.8, d);
  for (const p of negaraRoofCaps(d)) capTile(face, p, d);
  // The long mapped connector stays open below its roof. Its lower deck is an estimate.
  slab(face, plans.connector.outline, 2.15, 2.4, 'trim');
  if (d >= 2) {
    for (let x = -82; x <= 80; x += 6) {
      const p = [x, 46];
      if (!negaraInside(p, plans.main.outline)) continue;
      const a = [x, 6.1, 46],
        b = [x + 2.25, 8.9, 46],
        c = [x + 4.5, 6.1, 46],
        e = [x + 2.25, 3.3, 46];
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, e],
        [e, a],
      ])
        beam(
          face,
          u.map((n, k) => (k === 1 ? n + floor : n)),
          v.map((n, k) => (k === 1 ? n + floor : n)),
          0.38,
          'trim',
        );
    }
  }
}
function prayerHall(face, d) {
  const r = circle(plans.central, 26, 16),
    s = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k])),
      n = [axis[1] * s, -axis[0] * s];
    face('wall', [at(a, 2.4), at(b, 2.4), at(b, 11), at(a, 11)], [n[0], 0, n[1]]);
    if (d === 0) continue;
    const inset = 0.7,
      A = a.map((v, k) => v + axis[k] * inset + n[k] * 0.03),
      B = b.map((v, k) => v - axis[k] * inset + n[k] * 0.03);
    face('glass', [at(A, 3.3), at(B, 3.3), at(B, 9.8), at(A, 9.8)], [n[0], 0, n[1]]);
    post(face, a, 2.4, 11, d === 1 ? 1.1 : 0.75, d);
    if (d >= 2) {
      const mid = A.map((v, k) => (v + B[k]) / 2),
        width = distance(A, B),
        offset = (p, y) => [p[0] + n[0] * 0.12, floor + y, p[1] + n[1] * 0.12];
      for (let j = 0; j < 2; j++) {
        const q = mid.map((v, k) => v + axis[k] * (j === 0 ? -width / 4 : width / 4)),
          left = q.map((v, k) => v - (axis[k] * width) / 4),
          right = q.map((v, k) => v + (axis[k] * width) / 4);
        for (const [u, v] of [
          [offset(left, 6.6), offset(q, 9.5)],
          [offset(q, 9.5), offset(right, 6.6)],
          [offset(right, 6.6), offset(q, 3.6)],
          [offset(q, 3.6), offset(left, 6.6)],
        ])
          beam(face, u, v, 0.28, 'trim');
      }
    }
  }
  if (d >= 1) {
    const p = plans.central;
    face(
      'door',
      [
        [p[0] + 25.9, floor + 2.4, p[1] - 2.5],
        [p[0] + 25.9, floor + 2.4, p[1] + 2.5],
        [p[0] + 25.9, floor + 7.8, p[1] + 2.5],
        [p[0] + 25.9, floor + 7.8, p[1] - 2.5],
      ],
      [1, 0, 0],
    );
  }
}
export function negaraFoldRing() {
  return Array.from({ length: 32 }, (_, i) => {
    const a = (-i * Math.PI) / 16,
      r = i % 2 ? 28 : 33;
    return [
      plans.central[0] + Math.cos(a) * r,
      i % 2 ? 11.5 : 15.3,
      plans.central[1] + Math.sin(a) * r,
    ];
  });
}
function umbrella(face, d) {
  const ring = negaraFoldRing(),
    hub = [plans.central[0], 26, plans.central[1]],
    P = (p) => [p[0], floor + p[1], p[2]],
    bottom = (p) => [p[0], floor + p[1] - 0.38, p[2]];
  for (let i = 0; i < 32; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 32];
    face('roof', [P(hub), P(a), P(b)], [0, 1, 0]);
    face('trim', [bottom(hub), bottom(b), bottom(a)], [0, -1, 0]);
    const n = unit([(a[0] + b[0]) / 2 - hub[0], 0, (a[2] + b[2]) / 2 - hub[2]]);
    face('trim', [P(a), bottom(a), bottom(b), P(b)], n);
  }
  if (d >= 1) {
    const tint = '#d4bf83'
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
    const gold = (slot, p, n) => face(slot, p, n, tint);
    for (let i = 0; i < 32; i += 2) {
      const a = P(hub),
        b = P(ring[i]);
      a[1] += 0.12;
      b[1] += 0.12;
      beam(gold, a, b, d === 1 ? 0.6 : 0.5, 'trim');
    }
  }
}
function minaret(face, d) {
  const p = plans.minaret;
  solid(face, plans.tower.outline, 2.4, 7.2, 'wall');
  const shaft = rect(p[0] - 1.8, p[1] - 1.8, p[0] + 1.8, p[1] + 1.8);
  profile(
    face,
    shaft,
    [
      [7.2, 1.25],
      [13, 1],
      [56, 0.9],
    ],
    'wall',
  );
  slab(face, rect(p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), 56, 58.5, 'trim');
  if (d >= 1) {
    const inner = rect(p[0] - 3.45, p[1] - 3.45, p[0] + 3.45, p[1] + 3.45);
    slab(face, rect(p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), 58.5, 59.15, 'trim', [inner]);
  }
  const r = Array.from({ length: 16 }, (_, i) => {
    const a = (-i * Math.PI) / 8,
      rad = i % 2 ? 2.8 : 3.8;
    return [p[0] + Math.cos(a) * rad, p[1] + Math.sin(a) * rad];
  });
  profile(
    face,
    r,
    [
      [59.15, 1],
      [61.2, 1.04],
      [72.7, 0],
    ],
    'wall',
  );
  profile(
    face,
    rect(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12),
    [
      [72.7, 1],
      [73, 0],
    ],
    'trim',
  );
  if (d >= 2)
    for (const sign of [-1, 1])
      solid(
        face,
        rect(p[0] + sign * 1.83 - 0.035, p[1] - 0.35, p[0] + sign * 1.83 + 0.035, p[1] + 0.35),
        16,
        52,
        'glass',
      );
}
function entry(face, d) {
  if (d === 0) return;
  // The mapped southeast arm supplies the entry extent; canopy/stair detailing is picture-led.
  for (let j = 0; j < 6; j++)
    solid(face, rect(-56.7, 81.15 - j, -45.5, 82.15 - j), footing, 0.4 * (j + 1), 'trim');
  if (d >= 2) {
    for (let z = 53; z <= 73; z += 2)
      for (const x of [-57, -45.8])
        solid(face, rect(x - 0.25, z - 0.3, x + 0.25, z + 0.3), 9.7, 11.5, 'trim');
  }
}
function build(out, d) {
  const face = writer(out, d);
  sides(face, plans.whole.outline, footing, 2.4, 'trim');
  cap(face, plans.whole.outline, 2.4, 'trim');
  lowRanges(face, d);
  prayerHall(face, d);
  umbrella(face, d);
  minaret(face, d);
  entry(face, d);
}
export const buildNegaraSkyline = (o) => build(o, 0),
  buildNegaraDistrict = (o) => build(o, 1),
  buildNegaraStreet = (o) => build(o, 2),
  buildNegaraCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const negaraStudy = {
  id: 'national_mosque_of_malaysia',
  key: 'national_mosque_of_malaysia',
  title: 'National Mosque of Malaysia',
  category: 'mosque',
  wikidataId: 'Q1356818',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Reference photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared 256² stucco, marble, membrane, mosaic tile and plain wood graphs serve six merged material roles including local opaque blue-grey glazing. Metric UVs, linear tints, original coarse geometric screen rhythm and no embedded images. No copied facade photograph, inscriptions, fine screen artwork or baked lighting.',
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
    'Medium-fi exterior reconstruction. Main 11 m and tower 73 m current height tags retained. Tall blue folded roof is picture-led above the low roof tag. Three mapped control outlines retained with union-derived paved podium; roof gaps remain open above paving. Detailed hall center, cap grid, columns, lattice rhythm, entry canopy/fingers, stairs and tower tier heights are estimates. Reflecting pools, gardens, fine lettering, furniture, services and furnished interiors omitted. Separate surrounding buildings stay host content. Exact present finish/grade and physical-device timings remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('sixteen-fold-blue-umbrella', [75, 68, 75], [4.3, 13, -6]),
    cam('square-minaret-and-pleated-cap', [-85, 70, 70], [-39, 44, 24]),
    cam('open-connector-and-roof-caps', [-108, 24, 20], [-53, 1, 4]),
    cam('pale-star-screen-and-hall', [54, 0, 7], [28, -2, -5]),
    cam('raised-entry-canopy-and-stairs', [-78, 3, 103], [-52, -3, 73]),
    cam('north-up-three-mapped-controls', [0, 290, 0.1], [0, 5, 0]),
  ],
};
