/** FNB Stadium: mapped calabash, individual GFRC panels, 120 facade sectors and 60 roof cantilevers. */
import { beam } from './authored-structure-mesh.mjs';
import { fnbPlan } from './fnb-stadium-plan.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  steel = [0.55, 0.57, 0.55],
  concrete = [0.55, 0.54, 0.49],
  cream = [0.88, 0.82, 0.65],
  dark = [0.055, 0.07, 0.07];
const palette = [
  [0.64, 0.22, 0.085],
  [0.53, 0.16, 0.066],
  [0.7, 0.31, 0.13],
  [0.44, 0.23, 0.15],
  [0.52, 0.35, 0.23],
  [0.74, 0.62, 0.4],
  [0.83, 0.73, 0.5],
  [0.63, 0.54, 0.38],
];
function radius(poly, a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let nearest = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
  }
  if (!Number.isFinite(nearest)) throw Error('FNB polygon ray missed');
  return nearest;
}
const P = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
const at = (poly, a, y, offset = 0) => P(a, radius(poly, a) + offset, y);
function skin(a, t, offset = 0) {
  const angle = -1.05 + t * (Math.PI / 2 + 1.05),
    r =
      radius(fnbPlan.roofOuter, a) +
      (radius(fnbPlan.outer, a) - radius(fnbPlan.roofOuter, a)) * Math.cos(angle);
  return P(a, r + offset, 20 + 18 * Math.sin(angle));
}
const azNormal = (a) => [Math.sin(a), 0, Math.cos(a)];
function bearing(lon, lat) {
  const [x, y] = fnbPlan.anchor.map((v) => (v * Math.PI) / 180),
    a = (lon * Math.PI) / 180,
    b = (lat * Math.PI) / 180;
  return Math.atan2(
    Math.sin(a - x) * Math.cos(b),
    Math.cos(y) * Math.sin(b) - Math.sin(y) * Math.cos(b) * Math.cos(a - x),
  );
}
// The ten slots point to the other 2010 venues and Berlin, as described by the architect/steel supplier.
const slots = [
  [29.468, -23.924],
  [27.161, -25.578],
  [28.222, -25.754],
  [28.06, -26.198],
  [26.205, -29.117],
  [18.411, -33.904],
  [25.598, -33.938],
  [31.031, -29.824],
  [30.929, -25.461],
  [13.239, 52.515],
].map((p) => Math.PI - bearing(...p) - fnbPlan.heading);
const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const inSlot = (a) => slots.some((s) => angleDistance(a, s) < 0.0105);
function slab(out, inner, outer, y, color = concrete, slot = 'concrete', n = 480) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    face(out, slot, [inner(a, y), inner(b, y), outer(b, y), outer(a, y)], color, [0, 1, 0]);
  }
}
function handrail(out, fn, color = steel) {
  const ps = Array.from({ length: 481 }, (_, i) => fn((i * TAU) / 480));
  curve(
    out,
    ps.map((p) => [p[0], p[1] + 1.08, p[2]]),
    0.035,
    color,
  );
  for (let i = 0; i < 160; i++) {
    const p = ps[i * 3];
    beam(out, 'metal', p, [p[0], p[1] + 1.1, p[2]], 0.038, 0.038, color);
  }
}
function panels(out) {
  const cols = 768,
    rows = 36;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const a = ((i + 0.012) * TAU) / cols,
        b = ((i + 0.988) * TAU) / cols,
        t = (j + 0.012) / rows,
        u = (j + 0.988) / rows;
      const seed = ((i * 251 + j * 607 + i * j * 17) % 997) / 997;
      const mix = j > 23 ? 0.72 : j > 15 ? 0.32 : 0.11;
      const index = seed < mix ? 5 + ((i + j) % 3) : (i * 13 + j * 7) % 5;
      const color = palette[index],
        slot = inSlot((a + b) / 2);
      if (slot) {
        face(
          out,
          'glassClear',
          [skin(a, t), skin(b, t), skin(b, u), skin(a, u)],
          [0.49, 0.59, 0.6],
          azNormal(a),
        );
        if (j % 4 === 0)
          beam(out, 'metal', skin(a, t, -0.08), skin(b, t, -0.08), 0.06, 0.06, steel);
        continue;
      }
      // The punctured effect comes from genuine short open strips in individual panels.
      const open = j > 3 && j < 25 && seed > 0.74,
        cut = open ? t + (u - t) * 0.25 : t;
      const pts = [skin(a, cut), skin(b, cut), skin(b, u), skin(a, u)];
      face(out, 'concrete', pts, color, azNormal(a));
      face(
        out,
        'concrete',
        pts.map((p) => [p[0] - 0.013 * Math.sin(a), p[1], p[2] - 0.013 * Math.cos(a)]),
        color,
        azNormal(a).map((v) => -v),
      );
      if (open) {
        beam(out, 'metal', skin(a, t, -0.025), skin(b, t, -0.025), 0.025, 0.025, steel);
        beam(out, 'metal', skin(a, cut, -0.025), skin(b, cut, -0.025), 0.025, 0.025, steel);
        for (const ar of [a, b])
          beam(out, 'metal', skin(ar, t, -0.025), skin(ar, cut, -0.025), 0.025, 0.025, steel);
      }
      // Sparse through-fixings correspond to the four-corner panel attachment system.
      if (i % 2 === 0 && j % 2 === 0)
        for (const ar of [a + 0.00035, b - 0.00035])
          for (const tr of [cut + 0.002, u - 0.002]) {
            const p = skin(ar, tr, 0.017);
            tube(out, 'metal', p, P(ar, Math.hypot(p[0], p[2]) + 0.012, p[1]), 0.014, steel, 6);
          }
    }
  // 120 rolled I-section facade ribs, with horizontal RHS panel rails and offset concrete feet.
  for (let i = 0; i < 120; i++) {
    const a = (i * TAU) / 120;
    const t14 = (Math.asin((14 - 20) / 18) + 1.05) / (Math.PI / 2 + 1.05),
      p = skin(a, t14, -0.3),
      foot = P(a, Math.hypot(p[0], p[2]) - 6.5, 0);
    beam(out, 'concrete', foot, p, 0.75, 1.1, concrete);
    for (let j = 0; j < 24; j++) {
      const t = t14 + ((1 - t14) * j) / 24,
        u = t14 + ((1 - t14) * (j + 1)) / 24;
      beam(out, 'metal', skin(a, t, -0.36), skin(a, u, -0.36), 0.4, 0.4, steel);
    }
    for (let j = 0; j <= 36; j++)
      beam(
        out,
        'metal',
        skin(a, j / 36, -0.17),
        skin(a + TAU / 120, j / 36, -0.17),
        0.075,
        0.12,
        steel,
      );
  }
}
function roofPoint(a, t) {
  const ri = radius(fnbPlan.opening, a),
    ro = radius(fnbPlan.roofOuter, a),
    phase = ((((a / TAU) * 60) % 1) + 1) % 1;
  const y = 36.9 + 3.1 * Math.sin(Math.PI * t) * Math.pow(Math.sin(Math.PI * phase), 0.75);
  return P(a, ri + (ro - ri) * t, y);
}
function canopy(out) {
  for (let i = 0; i < 480; i++)
    for (let j = 0; j < 12; j++) {
      const a = (i * TAU) / 480,
        b = ((i + 1) * TAU) / 480,
        t = j / 12,
        u = (j + 1) / 12;
      const ps = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)];
      // Photographed polycarbonate strips bound the undulating PTFE membrane.
      const glazed = j === 0 || j === 11;
      face(
        out,
        glazed ? 'glassClear' : 'membrane',
        ps,
        glazed ? [0.64, 0.73, 0.74] : cream,
        [0, 1, 0],
      );
      if (!glazed)
        face(
          out,
          'membrane',
          ps.map((p) => [p[0], p[1] - 0.12, p[2]]),
          cream,
          [0, -1, 0],
        );
    }
  // Eight-hundred-meter triangular spatial ring truss with 0.71–0.91m chords.
  const ring = (a, k) =>
    at(fnbPlan.roofOuter, a, k === 2 ? 29.8 : 35.1, k === 0 ? -5.4 : k === 1 ? 0 : -2.7);
  for (let k = 0; k < 3; k++)
    curve(
      out,
      Array.from({ length: 481 }, (_, i) => ring((i * TAU) / 480, k)),
      k === 2 ? 0.355 : 0.455,
      steel,
      'metal',
      12,
    );
  for (let i = 0; i < 120; i++) {
    const a = (i * TAU) / 120,
      b = ((i + 1) * TAU) / 120;
    for (let k = 0; k < 2; k++) {
      tube(out, 'metal', ring(a, k), ring(b, 2), 0.19, steel, 10);
      tube(out, 'metal', ring(a, 2), ring(b, k), 0.19, steel, 10);
    }
  }
  const shaftIndices = new Set(Array.from({ length: 12 }, (_, i) => Math.round((i * 28) / 12)));
  for (let i = 0; i < 28; i++) {
    const a = (i * TAU) / 28,
      p = ring(a, 2),
      o = transformed(out, a, [p[0], 0, p[2]]);
    if (shaftIndices.has(i)) box(o, 'concrete', [-1.5, 0, -1.3], [1.5, 29.65, 1.3], concrete);
    else beam(out, 'concrete', [p[0], 0, p[2]], p, 0.85, 0.85, concrete);
    tube(o, 'metal', [-1.72, 29.8, 0], [1.72, 29.8, 0], 0.12, steel, 12);
  }
  for (let i = 0; i < 60; i++) {
    const a = (i * TAU) / 60,
      top = roofPoint(a, 0),
      outer = roofPoint(a, 1);
    beam(out, 'metal', top, outer, 0.3, 0.6, steel);
    const low = [outer[0], 30.2, outer[2]];
    tube(out, 'metal', top, low, 0.19, steel, 10);
    for (let j = 1; j < 6; j++) {
      const t = j / 6,
        p = top.map((v, k) => v + (outer[k] - v) * t),
        q = top.map((v, k) => v + (low[k] - v) * t);
      beam(out, 'metal', p, q, 0.16, 0.16, steel);
      if (j < 5) {
        const r = top.map((v, k) => v + ((low[k] - v) * (j + 1)) / 6);
        beam(out, 'metal', p, r, 0.13, 0.13, steel);
      }
    }
    const o = transformed(out, a, [top[0], top[1] - 0.55, top[2]]);
    for (let k = -2; k <= 2; k++) {
      box(o, 'metal', [k * 0.64 - 0.28, -0.3, -0.44], [k * 0.64 + 0.28, 0.1, 0.05], steel);
      box(
        o,
        'plastic',
        [k * 0.64 - 0.22, -0.25, -0.46],
        [k * 0.64 + 0.22, 0.05, -0.445],
        [0.93, 0.91, 0.75],
      );
    }
  }
}
function rounded(a, hx, hz, r) {
  const sx = Math.sign(Math.sin(a)) || 1,
    sz = Math.sign(Math.cos(a)) || 1,
    dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-8), hz / (dz || 1e-8));
  if (t * dx > hx - r && t * dz > hz - r) {
    const qx = hx - r,
      qz = hz - r,
      d = qx * dx + qz * dz;
    t = d + Math.sqrt(Math.max(0, d * d - qx * qx - qz * qz + r * r));
  }
  return [sx * t * dx, 0, sz * t * dz];
}
function bowl(out) {
  soccerPitch(out);
  const tiers = [
    { x: 48, z: 64, r: 16, y: 0.8, rows: 25, run: 0.8, rise: 0.34 },
    { x: 70, z: 84, r: 31, y: 11, rows: 25, run: 0.8, rise: 0.43 },
    { x: 92, z: 103, r: 50, y: 23.5, rows: 20, run: 0.79, rise: 0.5 },
  ];
  for (let k = 0; k < tiers.length; k++) {
    const t = tiers[k];
    for (let row = 0; row < t.rows; row++) {
      const x = t.x + row * t.run,
        z = t.z + row * t.run,
        r = t.r + row * t.run * 0.6,
        y = t.y + row * t.rise;
      const p = (a, h) => {
          const v = rounded(a, x, z, r);
          v[1] = h;
          return v;
        },
        q = (a, h) => {
          const v = rounded(a, x + t.run, z + t.run, r + t.run * 0.6);
          v[1] = h;
          return v;
        };
      slab(out, p, q, y);
      for (let i = 0; i < 360; i++) {
        const a = (i * TAU) / 360,
          b = ((i + 1) * TAU) / 360;
        face(
          out,
          'concrete',
          [p(a, y - t.rise), p(b, y - t.rise), p(b, y), p(a, y)],
          concrete,
          azNormal(a).map((v) => -v),
        );
      }
      const length = Array.from({ length: 721 }, (_, i) => p((i * TAU) / 720, y)),
        distance = [0];
      for (let i = 1; i < length.length; i++)
        distance.push(
          distance[i - 1] +
            Math.hypot(length[i][0] - length[i - 1][0], length[i][2] - length[i - 1][2]),
        );
      const total = distance.at(-1),
        count = Math.floor(total / 0.54);
      let index = 1;
      for (let i = 0; i < count; i++) {
        const d = (i / count) * total;
        while (distance[index] < d) index++;
        const f = (d - distance[index - 1]) / (distance[index] - distance[index - 1]),
          pos = length[index - 1].map((v, k) => v + (length[index][k] - v) * f),
          a = Math.atan2(pos[0], pos[2]);
        if (Math.abs((i / count) * 44 - Math.round((i / count) * 44)) < 0.052) continue;
        const seat = inSlot(a) ? [0.18, 0.21, 0.21] : [0.86, 0.27, 0.035];
        chair(
          out,
          Math.atan2(
            -(length[index][2] - length[index - 1][2]),
            length[index][0] - length[index - 1][0],
          ),
          pos,
          seat,
        );
      }
    }
    const front = (a) => {
      const p = rounded(a, t.x, t.z, t.r);
      p[1] = t.y;
      return p;
    };
    handrail(out, front);
    for (let i = 0; i < 32; i++) {
      const a = ((i + 0.5) * TAU) / 32,
        y = t.y + t.rows * 0.6 * t.rise,
        p = rounded(
          a,
          t.x + t.rows * 0.6 * t.run,
          t.z + t.rows * 0.6 * t.run,
          t.r + t.rows * 0.36 * t.run,
        ),
        o = transformed(out, a, [p[0], y, p[2]]);
      box(o, 'glass', [-1.45, 0, -0.25], [1.45, 1.7, 0.1], dark);
      box(o, 'concrete', [-1.55, 1.7, -0.35], [1.55, 1.9, 0.15], concrete);
    }
    if (k) {
      const prev = tiers[k - 1],
        y0 = prev.y + prev.rows * prev.rise;
      for (let i = 0; i < 360; i++) {
        const a = (i * TAU) / 360,
          b = ((i + 1) * TAU) / 360,
          p = rounded(
            a,
            prev.x + prev.rows * prev.run,
            prev.z + prev.rows * prev.run,
            prev.r + prev.rows * prev.run * 0.6,
          ),
          q = rounded(
            b,
            prev.x + prev.rows * prev.run,
            prev.z + prev.rows * prev.run,
            prev.r + prev.rows * prev.run * 0.6,
          );
        p[1] = q[1] = y0;
        face(
          out,
          'glass',
          [p, q, front(b), front(a)],
          dark,
          azNormal(a).map((v) => -v),
        );
      }
    }
  }
  // The photographed western hospitality band makes the two long facades unequal.
  for (const band of [
    { x: -68.4, y: 9.35, count: 17 },
    { x: -90.4, y: 21.8, count: 19 },
  ])
    for (let i = 0; i < band.count; i++) {
      const z = (i - (band.count - 1) / 2) * 5.5,
        o = transformed(out, Math.PI / 2, [band.x, band.y, z]);
      // Faces look east into the pitch; the box backs sit behind the tier fascia.
      box(o, 'concrete', [-2.7, 0, -3], [2.7, 1.6, -0.25], cream);
      box(o, 'glass', [-2.55, 0.15, 0.12], [2.55, 1.45, 0.14], [0.17, 0.24, 0.25]);
      for (const x of [-2.64, 0, 2.64])
        box(o, 'metal', [x - 0.04, 0.1, 0.15], [x + 0.04, 1.5, 0.2], steel);
      for (const y of [0.08, 1.52])
        box(o, 'concrete', [-2.75, y, 0], [2.75, y + 0.08, 0.28], cream);
    }
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      p = rounded(a, 48, 64, 16),
      q = rounded(b, 48, 64, 16);
    p[1] = q[1] = 0.001;
    out.addTriangle(
      'concrete',
      'palette:#ffffff',
      [[0, 0.001, 0], p, q],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      concrete,
    );
    face(
      out,
      'concrete',
      [p, q, [q[0], 0.8, q[2]], [p[0], 0.8, p[2]]],
      concrete,
      azNormal(a).map((v) => -v),
    );
  }
  for (const side of [-1, 1]) {
    const o = transformed(out, side < 0 ? 0 : Math.PI, [0, 0, side * 110]);
    box(o, 'metal', [-9.7, 25, -0.6], [9.7, 33.9, 0.1], steel);
    box(o, 'glass', [-9.4, 25.3, 0.11], [9.4, 33.6, 0.15], [0.015, 0.021, 0.024]);
  }
}
function podium(out) {
  slab(
    out,
    (a, y) => at(fnbPlan.outer, a, y, -19),
    (a, y) => at(fnbPlan.outer, a, y, 6),
    0.03,
    concrete,
  );
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24,
      p = at(fnbPlan.outer, a, 0, -5),
      o = transformed(out, a, p);
    box(o, 'concrete', [-7, 0, -11], [7, 2.7, 0.97], concrete);
    for (let j = 0; j < 15; j++)
      box(
        o,
        'concrete',
        [-7, j * 0.18, 5 - j * 0.31],
        [7, (j + 1) * 0.18, 5.31 - j * 0.31],
        concrete,
      );
    for (const x of [-6.7, 0, 6.7]) {
      curve(
        o,
        [
          [x, 1.05, 5.2],
          [x, 3.75, 0.55],
        ],
        0.04,
        steel,
      );
      for (let j = 0; j < 6; j++)
        beam(
          o,
          'metal',
          [x, j * 0.54, 5.2 - j * 0.93],
          [x, j * 0.54 + 1.05, 5.2 - j * 0.93],
          0.04,
          0.04,
          steel,
        );
    }
    for (let k = -5; k <= 5; k++) {
      box(o, 'metal', [k - 0.055, 2.7, -7], [k + 0.055, 5, -6.85], steel);
      beam(o, 'metal', [k, 3.65, -7], [k + 0.4, 3.65, -6.6], 0.025, 0.025, steel);
    }
    box(o, 'concrete', [-1, 0, 8], [1, 2.2, 8.8], cream);
    for (let k = -2; k <= 2; k++)
      box(o, 'metal', [k * 0.33 - 0.1, 0.7, 8.81], [k * 0.33 + 0.1, 1.65, 8.83], dark);
  }
}
export function buildFnb(out) {
  podium(out);
  bowl(out);
  panels(out);
  canopy(out);
}
export const fnbStudy = {
  id: 'N0687',
  key: 'fnb_stadium',
  title: 'FNB Stadium',
  wikidataId: 'Q163521',
  build: buildFnb,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim'],
  previewCamera: { position: [220, 124, 245], lookAt: [0, 17, 0] },
  visualBrief:
    'South African calabash with the mapped near-circular belly and rectangular roof aperture, thousands of earth-tone GFRC panels and genuine short light openings, ten geographic slots, inclined concrete feet, 120 curved ribs, triangular spatial roof ring, sixty undulating PTFE cantilevers, orange three-tier seating and a distinct western hospitality band.',
  size: [315, 41, 315],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center; +Z follows its southward axis. Field and structural foot datum are native Y0; the photographed access podium rises above it.',
  },
  sourceFacts: {
    basis:
      'ExactQ163521 OSM envelope and separate roof/field polygons determine the plan and orientation. Roof designer sbp gives40m above field, roughly300m diameter,36m cantilever and800m triangular ring. Fabrication analyst EnginSoft records three0.71–0.91m tubular ring chords,28support locations including12shafts,60cantilevers and120facade sectors. The GFRC supplier case study records1.2x1.8m,13mm panels in8colors; its60m overall summary conflicts with the roof designer’s40m above-field datum, so the engineering datum governs this model. Five full-resolution sbp construction/completed photos were inspected for curvature, glazing strips, panel openings and roof corrugation. Panel mosaic and smaller connection positions are reconstructed, not an inventory claim.',
  },
  referencePages: [
    'https://www.sbp.de/en/project/soccer-city-stadium/',
    'https://www.enginsoft.com/expertise/johannesburg-2010-world-cup-stadium-roof-and-facade-design.html',
    'https://populous.com/showcases/soccer-city',
    'https://constructalia.arcelormittal.com/en/case_study_gallery/south_africa/soccer-city-stadium-with-arcelormittal-steel',
    'https://dcpd6wotaa0mb.cloudfront.net/mdms/dms/CSB/10018898/Cem-FIL-Architects-Case-Study_Soccer-City-Stadium_11-2013_Rev0_approved.pdf?v=1402892862000',
    'https://www.openstreetmap.org/way/48848017',
    'https://www.openstreetmap.org/relation/1639587',
  ],
  referenceRights:
    'Primary references inform original mesh geometry. No photographic pixels, Getty images or downloaded model are embedded. Map-derived plan is attributed to OpenStreetMap contributors under ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    elevationMode: 'terrain-contact',
    anchor: fnbPlan.anchor,
    heading: fnbPlan.heading,
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'The pitch apron and inclined concrete support centerlines start at native Y0. The finite-width inclined support foot cross-sections extend 0.232m below this plane as embedded footings; this is not a whole-model vertical offset. The entrance podium rises above the same local datum.',
    source: 'https://www.openstreetmap.org/way/48848017',
    featureIds: ['way/48848017', 'relation/952173', 'relation/1639587', 'way/119208355'],
    notes:
      'Exact pitch polygon establishes origin and southward axis; western hospitality strip resolves facade direction. Separate facade and roof loops preserve the circular calabash around the elongated playing field. NativeY0 is the local field/structural-foot reference; exterior podium and access stairs are modeled above that datum. Ten facade slots are oriented by bearings to the nine other2010venue cities and Berlin, following the architect’s concept.',
  },
  limitations: [
    'Photograph-based exterior reconstruction with explicit panel joints/openings and shared physical concrete/steel/membrane surfaces. The8-color mosaic and individual small windows are reconstructed and do not certify every panel’s installed position. Full fabrication bolt inventory, exact spectator count, enclosed VIP interiors and changing event decoration are excluded. Roof designer’s40m above-field dimension is used rather than averaging it with a conflicting supplier summary. External grade transitions and modest podium heights are reconstructed from engineer photos.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-gfrc-panels', position: [176, 20, 35], lookAt: [142, 22, 21] },
    { name: 'near-inclined-feet', position: [152, 5, 69], lookAt: [133, 11, 52] },
    { name: 'near-roof-membrane', position: [78, 69, 98], lookAt: [83, 36, 68] },
    { name: 'near-ring-truss', position: [121, 23, 21], lookAt: [115, 34, 0] },
    { name: 'near-orange-bowl', position: [0, 6, 20], lookAt: [94, 20, 0] },
    { name: 'near-west-hospitality', position: [-47, 19, 9], lookAt: [-90, 22.6, 0] },
    { name: 'far-calabash', position: [-212, 186, 253], lookAt: [0, 16, 0] },
  ],
};
