/** Independent budgeted Cayan derivatives; original detailed generator is preserved. */
/** Cayan: SOM's stepped helical hexagon, recessed balconies and shaded curtain wall. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  mappedCap,
  mappedSolid,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const silver = [0.71, 0.735, 0.74],
  dark = [0.14, 0.185, 0.205],
  blue = [0.2, 0.31, 0.37],
  pale = [0.62, 0.63, 0.6];
// The architect's typical floor is a faint chevron, not a regular hexagon or a square.
// This trace retains its opposed kinks within the mapped tower envelope; fine offsets are reconstructed.
const plan = clockwise([
  [-17.6, -18.48],
  [17.6, -18.48],
  [16.7, 0],
  [19.96, 18.48],
  [-15.24, 18.48],
  [-19.96, 0],
]);
const base = 6.7,
  pitch = 3.8,
  rows = 75,
  roof = base + pitch * rows;
const yaw = (y) => (Math.max(0, Math.min(1, (y - base) / (roof - base))) * Math.PI) / 2;
const spin = (p, y, d = 0) => {
  const a = yaw(y),
    c = Math.cos(a),
    s = Math.sin(a),
    r = Math.hypot(...p);
  const f = r ? (r + d) / r : 1;
  return [(p[0] * c - p[1] * s) * f, y, (p[0] * s + p[1] * c) * f];
};
const at = (p, y) => [p[0], y, p[1]];
let faceFloor;
function point(i, t, y, depth = 0) {
  const a = plan[i],
    b = plan[(i + 1) % plan.length];
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  const local = [a[0] + dx * t - (dz / l) * depth, a[1] + dz * t + (dx / l) * depth];
  const result = spin(local, y);
  if (faceFloor !== undefined) {
    // SOM's columns lean normal to the face but do not lean sideways within each storey.
    // Their lateral rotation is taken up by a small step hidden in the next floor slab.
    const start = spin(local, faceFloor),
      a = yaw(faceFloor + pitch / 2);
    const tangent = [
      (dx * Math.cos(a) - dz * Math.sin(a)) / l,
      (dx * Math.sin(a) + dz * Math.cos(a)) / l,
    ];
    const slide = (result[0] - start[0]) * tangent[0] + (result[2] - start[2]) * tangent[1];
    result[0] -= tangent[0] * slide;
    result[2] -= tangent[1] * slide;
  }
  return result;
}
function patch(out, slot, i, t0, t1, y0, y1, col, depth = 0) {
  face(
    out,
    slot,
    [
      point(i, t0, y0, depth),
      point(i, t1, y0, depth),
      point(i, t1, y1, depth),
      point(i, t0, y1, depth),
    ],
    col,
  );
}
function crown(out) {
  // The open metal crown continues the last facade frame; no opaque box fills its void.
  for (let i = 0; i < plan.length; i++) {
    const length = Math.hypot(plan[(i + 1) % 6][0] - plan[i][0], plan[(i + 1) % 6][1] - plan[i][1]);
    const n = out.detail.crown ? Math.round(length / 2.7) : 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const a = point(i, t, roof),
        height = 306.1 + 0.3 * Math.cos(t * Math.PI * 2);
      beam(out, 'metal', a, [a[0], height, a[2]], 0.31, 0.42, silver);
      if (!out.detail.braces) continue;
      const d = point(i, t, roof, -2.1);
      beam(out, 'metal', [a[0], roof + 9, a[2]], [d[0], roof, d[2]], 0.12, 0.12, silver);
    }
    for (const y of [roof + 4.0, roof + 8.0, roof + 12.0]) {
      const a = point(i, 0, roof),
        b = point(i, 1, roof);
      beam(out, 'metal', [a[0], y, a[2]], [b[0], y, b[2]], 0.12, 0.18, silver);
    }
  }
  // Set-back mechanical core and rooftop gantry are visible through the open lattice.
  loft(
    out,
    'concrete',
    [
      radialRing(roof, 6.5, 6.5, out.detail.coreSides),
      radialRing(roof + 6.5, 6.5, 6.5, out.detail.coreSides),
    ],
    pale,
  );
  box(out, 'metal', [-5, roof + 6.5, -1], [5, roof + 7.8, 1], silver);
  for (const x of [-4, 4])
    beam(out, 'metal', [x, roof + 7.7, 0], [x, roof + 11, 0], 0.2, 0.25, silver);
  beam(out, 'metal', [-5, roof + 11, 0], [7, roof + 11, 0], 0.3, 0.35, silver);
}
function podiumPlan() {
  const result = [
    [34, -24],
    [34, 35],
    [23, 35],
  ];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI / 2 + ((k / 12) * Math.PI) / 2;
    result.push([20 + 43 * Math.cos(a), -7 + 42 * Math.sin(a)]);
  }
  result.push([-23, -24]);
  return clockwise(result);
}
function baseAndPodium(out) {
  const full = podiumPlan();
  mappedSolid(out, 'stone', full, 0, 0.18, [0.52, 0.53, 0.5]);
  // Tower lobby follows its own six-sided foot, independent of the neighboring parking wing.
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % 6];
    grid(out, [at(a, 0.18), at(b, 0.18), at(b, base), at(a, base)], blue, 2.1, 3.3, 0.09, silver);
    for (let k = 0; k <= 4; k++) {
      const p = [a[0] + ((b[0] - a[0]) * k) / 4, a[1] + ((b[1] - a[1]) * k) / 4];
      beam(out, 'metal', at(p, 0.18), at(p, base), 0.4, 0.5, silver);
    }
  }
  const podium = clockwise([
    [15, -24],
    [34, -24],
    [34, 35],
    [18, 35],
    [11, 31],
    [12, 19],
    [19, 10],
    [18, -10],
  ]);
  mappedCap(out, 'recess', podium, 0.18, dark, [], true);
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i],
      b = podium[(i + 1) % podium.length];
    grid(out, [at(a, 0.2), at(b, 0.2), at(b, 20.7), at(a, 20.7)], blue, 1.5, 3.4, 0.1, silver);
  }
  mappedSolid(out, 'stone', podium, 20.7, 21.1, pale);
  // Roof pool and planted terrace are confirmed by the owner; their fine plan is reconstructed.
  box(out, 'concrete', [22, 21.1, -16], [31, 21.5, 5], pale);
  box(out, 'glass', [22.5, 21.49, -15.5], [30.5, 21.53, 4.5], [0.1, 0.45, 0.58]);
  box(out, 'concrete', [23, 21.1, 8], [29, 21.45, 13], pale);
  box(out, 'glass', [23.4, 21.44, 8.4], [28.6, 21.48, 12.6], [0.17, 0.49, 0.6]);
  for (const z of [-20, 17, 27]) {
    box(out, 'stone', [30, 21.1, z - 1], [32.8, 21.8, z + 1], pale);
    for (let k = 0; k < 3; k++)
      sphere(out, 'foliage', [30.5 + k * 0.8, 22, z], [0.6, 0.5, 0.8], [0.18, 0.3, 0.12], 6, 3);
  }
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i],
      b = podium[(i + 1) % podium.length];
    if (a[0] < 16 && b[0] < 16) continue;
    face(
      out,
      'clear_glass',
      [at(a, 21.1), at(b, 21.1), at(b, 22.2), at(a, 22.2)],
      [0.65, 0.76, 0.78],
    );
    beam(out, 'metal', at(a, 22.2), at(b, 22.2), 0.05, 0.07, silver);
  }
  // Street retail arcade: canopy, glazing and actual supports around the curved own-site edge.
  for (let k = 1; k < 23; k++) {
    const a = Math.PI / 2 + ((k / 24) * Math.PI) / 2,
      b = Math.PI / 2 + (((k + 1) / 24) * Math.PI) / 2;
    const p = [20 + 41.2 * Math.cos(a), -7 + 40.2 * Math.sin(a)],
      q = [20 + 41.2 * Math.cos(b), -7 + 40.2 * Math.sin(b)];
    const inside = (v) => [20 + (v[0] - 20) * 0.91, -7 + (v[1] + 7) * 0.91];
    if (p[0] < -18 || q[0] < -18 || p[1] < 21 || q[1] < 21) continue;
    const r = inside(p),
      s = inside(q);
    mappedSolid(out, 'metal', clockwise([p, q, s, r]), 4.7, 5.0, silver);
    beam(out, 'metal', at(p, 0.18), at(p, 4.7), 0.2, 0.24, silver);
    grid(out, [at(r, 0.18), at(s, 0.18), at(s, 4.7), at(r, 4.7)], blue, 1.3, 3.6, 0.07, silver);
  }
  const portal = clockwise([
    [-19.7, -5],
    [-23, -5],
    [-23, 5],
    [-18.9, 5],
  ]);
  mappedSolid(out, 'metal', portal, 4.2, 4.55, silver);
  for (const z of [-5, 5])
    beam(out, 'metal', [-22.8, 0.18, z], [-22.8, 4.2, z], 0.15, 0.18, silver);
  grid(
    out,
    [
      [-22.7, 0.18, 5],
      [-22.7, 0.18, -5],
      [-22.7, 4.2, -5],
      [-22.7, 4.2, 5],
    ],
    blue,
    1.3,
    3.4,
    0.075,
    silver,
  );
  for (const z of [-5, 5])
    grid(
      out,
      [
        [-22.7, 0.18, z],
        [-18.8, 0.18, z],
        [-18.8, 4.2, z],
        [-22.7, 4.2, z],
      ],
      blue,
      1.3,
      3.4,
      0.075,
      silver,
    );
}

function facade(out) {
  const d = out.detail;
  for (let row = 0; row < rows; row += d.rowStep) {
    const y0 = base + row * pitch,
      y1 = base + Math.min(rows, row + d.rowStep) * pitch;
    for (let i = 0; i < 6; i++) {
      const length = Math.hypot(
          plan[(i + 1) % 6][0] - plan[i][0],
          plan[(i + 1) % 6][1] - plan[i][1],
        ),
        bays = Math.max(1, Math.round(length / d.bayPitch)),
        edge = 0.24 / length;
      faceFloor = undefined;
      if (!d.skyline) {
        patch(out, 'metal', i, 0, 1, y0, y0 + 0.4, silver, 0.28);
        const a = point(i, 0, y0 + 0.4, 0.28),
          b = point(i, 1, y0 + 0.4, 0.28),
          c = point(i, 1, y0 + 0.4, -0.48),
          e = point(i, 0, y0 + 0.4, -0.48);
        face(out, 'metal', [a, b, c, e], silver);
      }
      faceFloor = d.rowStep === 1 ? y0 : undefined;
      if (d.skyline) {
        patch(out, 'glass', i, 0, 1, y0, y1, blue);
        continue;
      }
      for (let bay = 0; bay < bays; bay++) {
        const t0 = bay / bays,
          t1 = (bay + 1) / bays,
          balcony =
            d.balconies &&
            (bay === Math.floor(bays / 2) || bay === bays - 2) &&
            row > 5 &&
            row < 67,
          depth = balcony ? -1.5 : -0.3;
        patch(out, 'glass', i, t0 + edge, t1 - edge, y0 + 0.4, y1, blue, depth);
        patch(out, 'metal', i, t0 - edge, t0 + edge, y0 + 0.4, y1, silver, 0.12);
        for (const t of [t0 + edge, t1 - edge]) {
          const q = [
            point(i, t, y0 + 0.4, depth),
            point(i, t, y1, depth),
            point(i, t, y1, 0.12),
            point(i, t, y0 + 0.4, 0.12),
          ];
          face(out, 'metal', t === t1 - edge ? q.toReversed() : q, silver);
        }
        if (d.transom)
          patch(
            out,
            'metal',
            i,
            t0 + edge,
            t1 - edge,
            y0 + 1.0575,
            y0 + 1.1025,
            silver,
            depth + 0.035,
          );
        if (d.screens) {
          const sw = ((row + bay * 3 + i) % 5 === 0 ? 1.15 : 0.72) / length,
            start = (row + bay + i) % 2 === 0 ? t0 + edge : t1 - edge - sw;
          if (!balcony || row % 3 !== 0)
            patch(
              out,
              'screen',
              i,
              start,
              start + sw,
              y0 + 0.44,
              y1 - 0.08,
              silver,
              depth + 0.1016,
            );
        }
        if (balcony) {
          patch(
            out,
            'glass',
            i,
            t0 + edge,
            t1 - edge,
            y0 + 0.43,
            y0 + 1.52,
            [0.65, 0.75, 0.78],
            -0.08,
          );
          patch(out, 'metal', i, t0 + edge, t1 - edge, y0 + 1.5, y0 + 1.54, silver, -0.05);
        }
      }
    }
  }
  faceFloor = undefined;
  mappedCap(
    out,
    'stone',
    plan.map((p) => {
      const q = spin(p, roof);
      return [q[0], q[2]];
    }),
    roof,
    [0.25, 0.27, 0.27],
  );
}
const settings = {
  skyline: { skyline: true, rowStep: 3, bayPitch: 40, coreSides: 8 },
  district: { rowStep: 8, bayPitch: 12, coreSides: 12 },
  street: { rowStep: 2, bayPitch: 5.4, coreSides: 24, screens: true },
  closeup: {
    rowStep: 1,
    bayPitch: 3.1,
    coreSides: 32,
    screens: true,
    balconies: true,
    transom: true,
    crown: true,
    braces: true,
  },
};
function build(out, name) {
  const d = settings[name],
    mapSlot = (s) =>
      ['concrete', 'foliage', 'recess'].includes(s) ? 'stone' : s === 'clear_glass' ? 'glass' : s,
    means = { metal: [0.908889, 0.908889, 0.908889], stone: [0.701109, 0.701109, 0.701109] };
  const t = {
    detail: d,
    ...Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (slot, r, p, n, uv, c) => {
          slot = mapSlot(slot);
          return name === 'skyline'
            ? out[k](
                'silhouette',
                'palette:#ffffff',
                p,
                n,
                uv,
                means[slot] ? c.map((v, i) => v * means[slot][i]) : c,
              )
            : out[k](slot, r, p, n, uv, c);
        },
      ]),
    ),
  };
  if (d.skyline) {
    mappedSolid(t, 'stone', podiumPlan(), 0, 0.18, [0.52, 0.53, 0.5]);
    mappedSolid(
      t,
      'glass',
      clockwise([
        [15, -24],
        [34, -24],
        [34, 35],
        [18, 35],
        [11, 31],
        [12, 19],
        [19, 10],
        [18, -10],
      ]),
      0.18,
      21.1,
      blue,
    );
    mappedSolid(t, 'glass', plan, 0.18, base, blue);
  } else baseAndPodium(t);
  facade(t);
  crown(t);
}
export const buildCayanReviewedMaster = (out) => build(out, 'closeup');
export const buildCayanSkyline = (out) => build(out, 'skyline');
export const buildCayanDistrict = (out) => build(out, 'district');
export const buildCayanStreet = (out) => build(out, 'street');
export const buildCayanCloseup = (out) => build(out, 'closeup');
