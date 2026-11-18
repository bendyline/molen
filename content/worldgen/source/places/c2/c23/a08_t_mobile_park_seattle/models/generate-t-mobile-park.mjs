/**
 * T-Mobile Park (1999), Seattle: the horseshoe ballpark on the mapped SoDo block in
 * footprint.json (+X east, +Z south, origin at the field). Home plate sits in the south-west
 * corner with the foul lines a few degrees off the street grid; the field opens to the north-east
 * toward downtown. Stepped seat bands wrap the third-base, home and first-base sides under a
 * dark-green steel sun canopy, left-field bleachers sit on the north concourse under the big
 * scoreboard, and a red-and-blond brick facade with arched bays runs round the block to the
 * home-plate rotunda on First Avenue South. The three-panel retractable roof is shown parked
 * (open) over the BNSF tracks east of the field, nested panels on exposed green tri-chord
 * trusses and tripod legs, riding the low north runway and the high south runway.
 */
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  rgb,
  tower,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  brick: rgb('8f4c3a'),
  brickDark: rgb('7b4032'),
  blond: rgb('c3a37d'),
  concrete: rgb('aaa79f'),
  concreteShade: rgb('8e8b84'),
  deck: rgb('8f8d87'),
  steel: rgb('2f4b40'),
  steelLight: rgb('48675a'),
  seat: rgb('2e5948'),
  seatBack: rgb('22443a'),
  aisle: rgb('a5a39b'),
  glass: rgb('46545c'),
  opening: rgb('3a3f42'),
  membrane: rgb('cfd2ce'),
  underside: rgb('a3a8a4'),
  grass: rgb('4c8a3b'),
  grassDark: rgb('457f36'),
  dirt: rgb('9c5e3f'),
  track: rgb('8c5d44'),
  wall: rgb('2c4a3f'),
  screen: rgb('333b44'),
  lamp: rgb('dfe2dc'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.35 },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.6, metallic: 0 },
  seats: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.6, metallic: 0 },
  field: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.25, metallic: 0.2 },
  screen: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0.1 },
};

const REF = 'palette:#ffffff';
const UV3 = [
  [0, 0],
  [1, 0],
  [1, 1],
];
const UV4 = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const deg = Math.PI / 180;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => {
  const d = Math.hypot(...v) || 1;
  return v.map((n) => n / d);
};
const p3 = (q, y) => [q[0], y, q[1]];
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Planar polygon facing `hint` (Newell normal; reversed when it faces away). */
function face(out, slot, points, color, hint) {
  let p = points.filter((q, i) => Math.hypot(...sub(q, points[(i + 1) % points.length])) > 1e-3);
  if (p.length < 3) return;
  let n = [0, 0, 0];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  if (Math.hypot(...n) < 1e-6) return;
  if (hint && dot(n, hint) < 0) {
    p = p.slice().reverse();
    n = n.map((v) => -v);
  }
  n = unit(n);
  if (p.length === 3) out.addTriangle(slot, REF, p, n, UV3, color);
  else if (p.length === 4) out.addQuad(slot, REF, p, n, UV4, color);
  else out.addConvexPolygon(slot, REF, p, n, () => [0, 0], color);
}

/** Square-section member from a to b without end caps (a truss bar or a leg). */
function strut(out, slot, a, b, w, color) {
  const axis = unit(sub(b, a));
  const across = unit(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const other = cross(axis, across);
  const corner = (c, u, v) => c.map((x, i) => x + ((across[i] * u + other[i] * v) * w) / 2);
  const ring = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = ring[i],
      [u1, v1] = ring[(i + 1) % 4];
    const hint = across.map((x, k) => x * (u0 + u1) + other[k] * (v0 + v1));
    face(
      out,
      slot,
      [corner(a, u0, v0), corner(a, u1, v1), corner(b, u1, v1), corner(b, u0, v0)],
      color,
      hint,
    );
  }
}

/** Nearest crossing of the ray from `c` at angle `th` with an open polyline. */
function hit(poly, c, th) {
  const dx = Math.cos(th),
    dz = Math.sin(th);
  let best = Infinity;
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i],
      b = poly[i + 1];
    const ex = b[0] - a[0],
      ez = b[1] - a[1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const ax = a[0] - c[0],
      az = a[1] - c[1];
    const t = (ax * ez - az * ex) / den;
    const s = (ax * dz - az * dx) / den;
    if (t > 1e-6 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
  }
  if (!Number.isFinite(best)) throw new Error(`ray ${(th / deg).toFixed(1)} misses a bowl line`);
  return best;
}
const rays = (a0, a1, count) =>
  Array.from({ length: count + 1 }, (_, i) => (a0 + ((a1 - a0) * i) / count) * deg);
const along = (c, th, t) => [c[0] + Math.cos(th) * t, c[1] + Math.sin(th) * t];

/**
 * Stepped seat bands between matched front and back lines (the medium-fi stadium rule): per
 * aisle section and row a tread in the seat color and a riser in the seat-back color, a front
 * wall down to `base`, sloped concrete aisle strips at `aisles` and stringer walls at the ends.
 */
function tier(out, front, back, h0, h1, rows, { base = 0, aisles = [], ends = [true, true] } = {}) {
  const n = front.length;
  const lines = Array.from({ length: rows + 1 }, (_, k) =>
    front.map((f, i) => lerp2(f, back[i], k / rows)),
  );
  const h = (k) => h0 + ((h1 - h0) * k) / (rows - 1);
  for (let i = 0; i + 1 < n; i++) {
    const toward = [
      front[i][0] - back[i][0] + front[i + 1][0] - back[i + 1][0],
      0,
      front[i][1] - back[i][1] + front[i + 1][1] - back[i + 1][1],
    ];
    face(
      out,
      'concrete',
      [p3(front[i], base), p3(front[i + 1], base), p3(front[i + 1], h0), p3(front[i], h0)],
      col.concreteShade,
      toward,
    );
    for (let k = 0; k < rows; k++) {
      const a = lines[k],
        b = lines[k + 1];
      face(
        out,
        'seats',
        [p3(a[i], h(k)), p3(a[i + 1], h(k)), p3(b[i + 1], h(k)), p3(b[i], h(k))],
        col.seat,
        [0, 1, 0],
      );
      if (k > 0)
        face(
          out,
          'seats',
          [p3(a[i], h(k - 1)), p3(a[i + 1], h(k - 1)), p3(a[i + 1], h(k)), p3(a[i], h(k))],
          col.seatBack,
          toward,
        );
    }
  }
  for (const i of aisles) {
    const prev = front[Math.max(0, i - 1)],
      next = front[Math.min(n - 1, i + 1)];
    const t = unit([next[0] - prev[0], 0, next[1] - prev[1]]);
    const w = 0.7;
    const lip = lines[rows - 1][i];
    const pts = [
      [front[i][0] - t[0] * w, h0 + 0.07, front[i][1] - t[2] * w],
      [front[i][0] + t[0] * w, h0 + 0.07, front[i][1] + t[2] * w],
      [lip[0] + t[0] * w, h1 + 0.07, lip[1] + t[2] * w],
      [lip[0] - t[0] * w, h1 + 0.07, lip[1] - t[2] * w],
    ];
    face(out, 'concrete', pts, col.aisle, [front[i][0] - back[i][0], 3, front[i][1] - back[i][1]]);
  }
  for (const [i, j, use] of [
    [0, 1, ends[0]],
    [n - 1, n - 2, ends[1]],
  ]) {
    if (!use) continue;
    const away = [front[i][0] - front[j][0], 0, front[i][1] - front[j][1]];
    face(
      out,
      'concrete',
      [
        p3(front[i], base),
        p3(back[i], base),
        p3(back[i], h1),
        p3(lines[rows - 1][i], h1),
        p3(front[i], h0),
      ],
      col.concreteShade,
      away,
    );
  }
}

/** Quads between two matched lines at given heights (floors, soffits, canopy faces). */
function strip(out, slot, a, b, ya, yb, color, hint) {
  for (let i = 0; i + 1 < a.length; i++)
    face(out, slot, [p3(a[i], ya), p3(a[i + 1], ya), p3(b[i + 1], yb), p3(b[i], yb)], color, hint);
}

// ---- Mapped plan (footprint.json, heading 0: +X east, +Z south) -----------------------------

// Outer building 52776561141580 (four z15 pieces stitched; the home-plate corner bulge is the
// rotunda drawn below). The north strip west of x = 64 is the low concourse under the bleachers.
const OUTER = [
  [-111, -86],
  [-93, -86],
  [-93, -41],
  [-89, -37],
  [-71, -79],
  [-60, -90],
  [-56, -98],
  [64, -98.6],
  [124, -99],
  [84, 105],
  [-88, 104],
  [-97, 104],
  [-106, 100],
  [-111, 93],
  [-112, 86],
  [-111, 78],
];
// Field-side edge of the outer building (also the back of the lower bowl on the W and S).
const INNER = [
  [-29, -86],
  [-38, -81],
  [-56, -66],
  [-64, -48],
  [-72, -26],
  [-77, -2],
  [-81, 20],
  [-82, 34],
  [-81, 44],
  [-78, 54],
  [-69, 67],
  [-59, 76],
  [-31, 84],
  [19, 83],
  [62, 72],
  [78, 63],
  [92, 48],
  [100, 4],
  [96, -24],
  [73, -78],
  [64, -87],
];
// Upper ring 15 -> 20 m: the west, south and east sides and the north-east block (the north
// strip carrying the left-field bleachers stays at 15 m).
const UPPER = [
  [-38, -81],
  [-60, -90],
  [-71, -79],
  [-89, -37],
  [-93, -41],
  [-93, -86],
  [-111, -86],
  [-111, 78],
  [-112, 86],
  [-111, 93],
  [-106, 100],
  [-97, 104],
  [-88, 104],
  [84, 105],
  [124, -99],
  [64, -98.6],
  [64, -87],
  [73, -78],
  [96, -24],
  [100, 4],
  [92, 48],
  [78, 63],
  [62, 72],
  [19, 83],
  [-31, 84],
  [-59, 76],
  [-69, 67],
  [-78, 54],
  [-81, 44],
  [-82, 34],
  [-81, 20],
  [-77, -2],
  [-72, -26],
  [-64, -48],
  [-56, -66],
];
// Field wall / front of the stands (mapped pitch and warning-track outlines).
const FIELD = [
  [-23.8, -68],
  [-19.6, -71.6],
  [23.7, -70],
  [37.8, -65.7],
  [61.8, -53.1],
  [79.3, -11],
  [78.9, -8.2],
  [73.8, 17.6],
  [68.8, 44.2],
  [61.6, 39.8],
  [46.9, 38.6],
  [45, 40.4],
  [13, 48.8],
  [0.5, 48.2],
  [-27.6, 48],
  [-32.5, 47.4],
  [-35.5, 46.4],
  [-40.7, 43.2],
  [-43, 40.8],
  [-44.6, 38],
  [-45.6, 35.1],
  [-46, 31.7],
  [-45.6, 25.9],
  [-45.8, 21.9],
  [-41.7, -1.9],
  [-40.5, -15.4],
  [-27.4, -45.6],
  [-25.2, -47.2],
];
const GRASS = [
  [-42.3, 30.3],
  [-36.1, -8.2],
  [-35.3, -13.4],
  [-19.6, -48.6],
  [-18.6, -62.3],
  [-15, -65.3],
  [22.1, -64.1],
  [35.8, -60.1],
  [56.9, -48.6],
  [72.8, -10.4],
  [67.6, 17.6],
  [65.4, 29.3],
  [60.3, 34.5],
  [50.3, 33.7],
  [13.6, 43.6],
  [-30.7, 43.6],
  [-35.3, 42.2],
  [-38.9, 39.4],
  [-41.1, 35.9],
];
// Bowl lines for the radial sampling (centre C): stands front, lower-bowl back, upper-deck back.
const C = [10, 0];
const FRONT = [
  [-23.6, -71],
  [-23.8, -68],
  [-25.2, -47.2],
  [-27.4, -45.6],
  [-40.5, -15.4],
  [-41.7, -1.9],
  [-45.8, 21.9],
  [-46, 31.7],
  [-45.6, 35.1],
  [-44.6, 38],
  [-43, 40.8],
  [-40.7, 43.2],
  [-35.5, 46.4],
  [-32.5, 47.4],
  [-27.6, 48],
  [0.5, 48.2],
  [13, 48.8],
  [45, 40.4],
  [61.6, 39.8],
  [68.8, 44.2],
  [73.8, 17.6],
  [78.9, -8.2],
  [79.3, -11],
  [61.8, -53.1],
];
const LOWER_BACK = [
  [-29, -86],
  [-38, -81],
  [-56, -66],
  [-64, -48],
  [-72, -26],
  [-77, -2],
  [-81, 20],
  [-82, 34],
  [-81, 44],
  [-78, 54],
  [-69, 67],
  [-59, 76],
  [-31, 84],
  [19, 83],
  [62, 72],
  [76, 58],
  [82, 41],
  [91, -8],
  [98, -11],
  [96, -24],
  [87, -43],
  [82.5, -52.5],
];
const UPPER_BACK = [
  [-40, -96],
  [-47, -92],
  [-71, -79],
  [-89, -37],
  [-96, -8],
  [-98, 9],
  [-100, 27],
  [-98, 45],
  [-96, 56],
  [-87, 70],
  [-78, 79],
  [-64, 89],
  [-54, 94],
  [-40, 99],
  [19, 99],
  [55, 90],
  [77, 82],
  [91, 70],
  [106, -8],
  [107, -12],
];

// ---- Diamond: home plate in the south-west, foul lines 5.5 deg clockwise of the grid -----------
const HOME = [-31, 30.3];
const DIAMOND = 5.5 * deg;
const U1 = [Math.cos(DIAMOND), Math.sin(DIAMOND)]; // toward first base (east)
const V1 = [Math.sin(DIAMOND), -Math.cos(DIAMOND)]; // toward third base (north)
const dp = (u, v) => [HOME[0] + U1[0] * u + V1[0] * v, HOME[1] + U1[1] * u + V1[1] * v];

function field(out) {
  extrude(out, 'field', FIELD, -0.5, 0.1, col.track);
  extrude(out, 'field', GRASS, -0.4, 0.18, col.grass);
  // Infield skin: home corner plus the 95 ft arc round the pitcher's plate.
  const mound = [13.04, 13.04];
  const skin = [dp(-1.6, -1.6)];
  for (let i = 0; i <= 14; i++) {
    const a = (-27.5 + (145 * i) / 14) * deg;
    skin.push(dp(mound[0] + 29 * Math.cos(a), mound[1] + 29 * Math.sin(a)));
  }
  face(
    out,
    'field',
    skin.map((q) => p3(q, 0.26)),
    col.dirt,
    [0, 1, 0],
  );
  face(
    out,
    'field',
    [dp(1.3, 1.3), dp(25.8, 1.3), dp(25.8, 25.8), dp(1.3, 25.8)].map((q) => p3(q, 0.32)),
    col.grassDark,
    [0, 1, 0],
  );
  const ring = (c, r, y, sides = 16) =>
    Array.from({ length: sides }, (_, i) =>
      p3(
        [
          c[0] + r * Math.cos((i * 2 * Math.PI) / sides),
          c[1] + r * Math.sin((i * 2 * Math.PI) / sides),
        ],
        y,
      ),
    );
  face(out, 'field', ring(HOME, 4.2, 0.36), col.dirt, [0, 1, 0]);
  const m = dp(...mound);
  lathe(
    out,
    'field',
    m,
    [
      [0.3, 2.8, 2.8],
      [0.56, 1.3, 1.3],
    ],
    14,
    col.dirt,
  );
  // Padded outfield fence from the left-field pole to the centre-field bleachers.
  const fence = [
    [-23.8, -68],
    [-19.6, -71.6],
    [23.7, -70],
    [37.8, -65.7],
    [61.8, -53.1],
    [69.2, -35.5],
  ];
  for (let i = 0; i + 1 < fence.length; i++) {
    const F = wallFace(fence[i], fence[i + 1]);
    fbox(out, 'concrete', F, 0, F.length, 0, 3, -0.5, 0, col.wall);
  }
  // Batter's eye behind centre field.
  const eye = wallFace([37.8, -65.7], [61.8, -53.1]);
  fbox(out, 'concrete', eye, 3, eye.length - 3, 0, 8, -8, -4, col.wall);
}

// ---- Bowl ---------------------------------------------------------------------------------------
function bowl(out) {
  // Lower bowl, third base round home to the right-field pole.
  const L1 = rays(243.3, 37, 42);
  const f1 = L1.map((th) => along(C, th, hit(FRONT, C, th)));
  const b1 = L1.map((th) => along(C, th, hit(LOWER_BACK, C, th) - 3));
  const i1 = L1.map((th) => along(C, th, hit(INNER, C, th)));
  tier(out, f1, b1, 1.3, 12, 26, {
    aisles: L1.map((_, i) => i).filter((i) => i % 2 === 0 && i > 0 && i < L1.length - 1),
  });
  strip(out, 'deck', b1, i1, 12, 12, col.deck, [0, 1, 0]);
  // Right-field seats and the centre-field wedge, a short low rake.
  const L2 = rays(37, -32, 14);
  const f2 = L2.map((th) => along(C, th, hit(FRONT, C, th)));
  const b2 = L2.map((th) => along(C, th, hit(LOWER_BACK, C, th)));
  const i2 = L2.map((th) =>
    along(C, th, Math.max(hit(INNER, C, th), hit(LOWER_BACK, C, th) + 0.1)),
  );
  tier(out, f2, b2, 1.3, 5.6, 9, { aisles: [3, 7, 11] });
  strip(out, 'deck', b2, i2, 5.6, 5.6, col.deck, [0, 1, 0]);

  // Upper deck (300 level) on the outer ring, overhanging the lower bowl by 6 m.
  const U = rays(238, -5, 50);
  const tB = U.map((th) => hit(LOWER_BACK, C, th));
  const fu = U.map((th, i) => along(C, th, tB[i] - 6));
  const tU = U.map((th) => hit(UPPER_BACK, C, th));
  const bu = U.map((th, i) => along(C, th, tU[i]));
  const iu = U.map((th, i) => along(C, th, Math.max(hit(INNER, C, th), tB[i])));
  const top = 35;
  tier(out, fu, bu, 20.5, top, 20, {
    base: 19.2,
    aisles: U.map((_, i) => i).filter((i) => i % 2 === 1 && i < U.length - 1),
  });
  strip(out, 'concrete', fu, iu, 20, 20, col.concreteShade, [0, -1, 0]);
  // Club and suite glazing on the ring's field face, under the overhang.
  const glassIn = U.map((th, i) => along(C, th, Math.max(hit(INNER, C, th), tB[i]) - 0.08));
  for (let i = 0; i + 1 < U.length; i++) {
    const lowY = U[i] > 37 * deg ? 12.4 : 6.2;
    const toward = [-Math.cos(U[i]), 0, -Math.sin(U[i])];
    face(
      out,
      'glass',
      [
        p3(glassIn[i], lowY),
        p3(glassIn[i + 1], lowY),
        p3(glassIn[i + 1], 19.6),
        p3(glassIn[i], 19.6),
      ],
      col.glass,
      toward,
    );
  }
  // Back of the upper deck: brick base, glazed upper concourse in a green steel frame, parapet.
  const outward = (i) => [
    Math.cos(U[i]) + Math.cos(U[i + 1]),
    0,
    Math.sin(U[i]) + Math.sin(U[i + 1]),
  ];
  for (let i = 0; i + 1 < U.length; i++) {
    for (const [slot, y0, y1, c] of [
      ['brick', 20, 24.6, col.brick],
      ['glass', 24.6, 34.4, col.glass],
      ['steel', 34.4, top + 1.2, col.steel],
    ])
      face(
        out,
        slot,
        [p3(bu[i], y0), p3(bu[i + 1], y0), p3(bu[i + 1], y1), p3(bu[i], y1)],
        c,
        outward(i),
      );
    face(
      out,
      'concrete',
      [p3(bu[i], top), p3(bu[i + 1], top), p3(bu[i + 1], top + 1.2), p3(bu[i], top + 1.2)],
      col.concrete,
      outward(i).map((v) => -v),
    );
    face(
      out,
      'concrete',
      [
        p3(bu[i], top + 1.2),
        p3(bu[i + 1], top + 1.2),
        p3(along(C, U[i + 1], tU[i + 1] + 0.4), top + 1.2),
        p3(along(C, U[i], tU[i] + 0.4), top + 1.2),
      ],
      col.concrete,
      [0, 1, 0],
    );
  }
  for (let i = 0; i < U.length; i++) {
    const foot = along(C, U[i], tU[i] + 0.35);
    strut(out, 'steel', p3(foot, 20), p3(foot, top + 1.2), 0.8, col.steel);
  }
  // Sun canopy over the top rows on the third-base, home and first-base sides.
  const K = U.filter((th) => th > 40 * deg);
  const kIdx = K.map((th) => U.indexOf(th));
  const cf = kIdx.map((i) => along(C, U[i], tU[i] - 9));
  const cb = kIdx.map((i) => along(C, U[i], tU[i] + 1.2));
  strip(out, 'steel', cf, cb, 38.6, 39.6, col.steel, [0, 1, 0]);
  strip(out, 'steel', cf, cb, 38.2, 39.2, col.steelLight, [0, -1, 0]);
  for (let j = 0; j + 1 < cf.length; j++) {
    const toward = [-Math.cos(K[j]), 0, -Math.sin(K[j])];
    face(
      out,
      'steel',
      [p3(cf[j], 38.2), p3(cf[j + 1], 38.2), p3(cf[j + 1], 38.6), p3(cf[j], 38.6)],
      col.steel,
      toward,
    );
  }
  for (let j = 0; j < kIdx.length; j += 2) {
    const i = kIdx[j];
    const foot = along(C, U[i], tU[i] + 0.3);
    strut(out, 'steel', p3(foot, top + 1.2), p3(foot, 39.3), 0.6, col.steel);
    strut(out, 'steel', p3(foot, top + 1.2), p3(along(C, U[i], tU[i] - 7), 38.3), 0.45, col.steel);
  }
  // Light towers on the canopy.
  for (const a of [228, 200, 158, 118, 82, 50]) {
    const th = a * deg;
    const t = hit(UPPER_BACK, C, th) + 0.6;
    const base = along(C, th, t);
    strut(out, 'steel', p3(base, 39.6), p3(base, 49), 1.1, col.steel);
    const F = facade(along(C, th, t - 0.6), [-Math.sin(th), Math.cos(th)]);
    fbox(out, 'steel', F, -4.6, 4.6, 48, 51.4, -0.2, 0.5, col.steel);
    face(
      out,
      'glass',
      [F.P(-4.3, 48.3, 0.54), F.P(4.3, 48.3, 0.54), F.P(4.3, 51.1, 0.54), F.P(-4.3, 51.1, 0.54)],
      col.lamp,
      [-Math.cos(th), 0.3, -Math.sin(th)],
    );
  }
}

// ---- Left-field bleachers and scoreboard on the north concourse ------------------------------------
function bleachers(out) {
  const xs = [-34, -11, 12, 35, 58];
  const front = xs.map((x) => [x, -81]);
  const back = xs.map((x) => [x, -96.5]);
  tier(out, front, back, 15.6, 24, 11, { base: 14.4, aisles: [1, 2, 3] });
  strip(
    out,
    'concrete',
    xs.map((x) => [x, -81]),
    xs.map((x) => [x, -86]),
    14.4,
    14.4,
    col.concreteShade,
    [0, -1, 0],
  );
  for (const x of [-30, -10, 12, 34, 54])
    strut(out, 'concrete', [x, -0.5, -83], [x, 14.4, -83], 0.9, col.concrete);
  // Glazed concourse fronts (cantina, bullpen lounges) under the bleachers.
  const G = facade([-27, -86.1], [1, 0]);
  face(
    out,
    'glass',
    [G.P(0, 2.4, 0), G.P(89, 2.4, 0), G.P(89, 12.6, 0), G.P(0, 12.6, 0)],
    col.glass,
    [0, 0, 1],
  );
  for (let u = 0; u <= 89; u += 11.125)
    fbox(out, 'steel', G, u - 0.35, u + 0.35, 2.4, 12.6, 0, 0.3, col.steel);
  fbox(out, 'steel', G, 0, 89, 7.2, 7.8, 0, 0.3, col.steel);
  // Scoreboard (2013 HD board, 201.5 x 56.7 ft) above the bleachers in left-centre.
  const F = facade([-3, -97], [1, 0]);
  fbox(out, 'steel', F, 0, 63, 25, 43, -2.2, 0, col.steel);
  face(
    out,
    'screen',
    [F.P(1, 25.9, 0.04), F.P(62, 25.9, 0.04), F.P(62, 42.1, 0.04), F.P(1, 42.1, 0.04)],
    col.screen,
    [0, 0, 1],
  );
  for (const u of [8, 31.5, 55])
    fbox(out, 'steel', F, u - 0.8, u + 0.8, 15, 25, -2, -0.4, col.steel);
}

// ---- Outer building: brick facade with arched bays, rotunda ---------------------------------------
function building(out) {
  extrude(out, 'brick', OUTER, -1, 15, col.brick, {
    holes: [INNER],
    topSlot: 'deck',
    topColor: col.deck,
  });
  extrude(out, 'brick', UPPER, 15, 20, col.brick, { topSlot: 'deck', topColor: col.deck });
  extrude(out, 'deck', INNER, -1, 0.05, col.concrete);
  const ring = outwardRing(OUTER);
  for (let e = 0; e < ring.length; e++) {
    const a = ring[e],
      b = ring[(e + 1) % ring.length];
    const F = wallFace(a, b);
    if (F.length < 3) continue;
    const low = a[1] < -95 && b[1] < -95 && Math.max(a[0], b[0]) <= 64.5;
    const topY = low ? 15 : 20;
    fbox(out, 'brick', F, 0, F.length, -1, 1.6, 0, 0.3, col.blond);
    fbox(out, 'brick', F, 0, F.length, topY - 1.1, topY, 0, 0.6, col.blond);
    fbox(out, 'brick', F, 0, F.length, 11.6, 12.2, 0, 0.25, col.blond);
    const n = Math.floor(F.length / 10.5);
    if (n < 1) continue;
    const bw = F.length / n;
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) * bw;
      const w = Math.min(6, bw - 3.2);
      // Two-storey arched bay: dark opening with a blond keystone arch band.
      const half = w / 2,
        spring = 1.6 + 9.6 - half;
      const outN = [F.normal[0], 0, F.normal[1]];
      const arch = [F.P(u - half, 1.6, 0.05), F.P(u + half, 1.6, 0.05)];
      for (let s = 0; s <= 6; s++) {
        const ang = (s / 6) * Math.PI;
        arch.push(F.P(u + half * Math.cos(ang), spring + half * Math.sin(ang), 0.05));
      }
      face(out, 'glass', arch, col.opening, outN);
      fbox(
        out,
        'brick',
        F,
        u - half - 0.5,
        u + half + 0.5,
        spring + half,
        spring + half + 0.7,
        0,
        0.2,
        col.blond,
      );
      if (!low)
        face(
          out,
          'glass',
          [
            F.P(u - 2, 13.6, 0.04),
            F.P(u + 2, 13.6, 0.04),
            F.P(u + 2, 17.6, 0.04),
            F.P(u - 2, 17.6, 0.04),
          ],
          col.glass,
          outN,
        );
      if (j > 0)
        fbox(out, 'brick', F, j * bw - 0.6, j * bw + 0.6, -1, topY - 1.1, 0, 0.45, col.brickDark);
    }
  }
  // Home-plate rotunda on the First Avenue / Edgar Martinez corner.
  const R = [-97, 88];
  tower(out, 'brick', R, 17, 24, -1, 24, col.brick, { topSlot: 'deck', topColor: col.deck });
  tower(out, 'brick', R, 17.6, 24, 22.6, 24.4, col.blond, { topSlot: 'deck', topColor: col.deck });
  tower(out, 'brick', R, 17.3, 24, -1, 1.8, col.blond, { top: false });
  lathe(
    out,
    'steel',
    R,
    [
      [24.4, 16.2, 16.2],
      [27.6, 9.5, 9.5],
      [28.4, 4.5, 4.5],
    ],
    24,
    col.steel,
  );
  for (const a of [75, 105, 135, 165, 195]) {
    const ang = a * deg;
    const F = facade(
      [R[0] + 17 * Math.cos(ang), R[1] + 17 * Math.sin(ang)],
      [Math.sin(ang), -Math.cos(ang)],
    );
    opening(out, F, 0, a === 135 ? 0 : 4, 4.4, a === 135 ? 17 : 14, {
      head: 'round',
      glassSlot: 'glass',
      frameSlot: 'steel',
      glass: a === 135 ? col.opening : col.glass,
      frame: col.steel,
      frameWidth: 0.5,
      frameDepth: 0.35,
      sill: false,
    });
  }
}

// ---- Parked retractable roof --------------------------------------------------------------------
const SKEW = Math.tan(8 * deg);
const RAIL_N = { z: -99.5, top: 15.5 },
  RAIL_S = { z: 103.5, top: 30.5 };
// Three panels stacked over the tracks: the two 631 ft side panels nested under the 655 ft
// centre panel. Each is an arched deck on two tri-chord trusses spanning north-south; the centre
// panel's deck crowns near the published 275 ft truss top with 217 ft clear beneath it.
const PANELS = [
  { x0: 86, w: 62, zN: -90, zS: 97, yN: 36, yS: 40, yC: 50, dEnd: 3.5, dC: 10 },
  { x0: 67, w: 62, zN: -91, zS: 98, yN: 46, yS: 50, yC: 64, dEnd: 4, dC: 12 },
  { x0: 74, w: 66, zN: -94, zS: 101, yN: 58, yS: 62, yC: 82, dEnd: 6, dC: 16 },
];
const ZC = 5;
const shape = (P, z, end, crown) => {
  const north = z < ZC;
  const u = (z - ZC) / ((north ? P.zN : P.zS) - ZC);
  const e = north ? end[0] : end[1];
  return crown - (crown - e) * u * u;
};
const skinY = (P, z) => shape(P, z, [P.yN, P.yS], P.yC);
const trussD = (P, z) => shape(P, z, [P.dEnd, P.dEnd], P.dC);
const xAt = (P, z) => P.x0 + SKEW * (RAIL_S.z - z);

function roofPanel(out, P) {
  const N = 14;
  const zs = Array.from({ length: N + 1 }, (_, j) => P.zN + ((P.zS - P.zN) * j) / N);
  const W = zs.map((z) => [xAt(P, z), z]);
  const E = zs.map((z) => [xAt(P, z) + P.w, z]);
  for (let j = 0; j < N; j++) {
    const y0 = skinY(P, zs[j]),
      y1 = skinY(P, zs[j + 1]);
    face(
      out,
      'membrane',
      [p3(W[j], y0 + 0.4), p3(E[j], y0 + 0.4), p3(E[j + 1], y1 + 0.4), p3(W[j + 1], y1 + 0.4)],
      col.membrane,
      [0, 1, 0],
    );
    face(
      out,
      'steel',
      [p3(W[j], y0 - 0.7), p3(E[j], y0 - 0.7), p3(E[j + 1], y1 - 0.7), p3(W[j + 1], y1 - 0.7)],
      col.underside,
      [0, -1, 0],
    );
    face(
      out,
      'steel',
      [
        p3(W[j], y0 - 0.7),
        p3(W[j + 1], y1 - 0.7),
        p3(W[j + 1], y0 + 0.4 + (y1 - y0)),
        p3(W[j], y0 + 0.4),
      ],
      col.steel,
      [-1, 0, 0],
    );
    face(
      out,
      'steel',
      [p3(E[j], y0 - 0.7), p3(E[j + 1], y1 - 0.7), p3(E[j + 1], y1 + 0.4), p3(E[j], y0 + 0.4)],
      col.steel,
      [1, 0, 0],
    );
  }
  for (const [j, s] of [
    [0, -1],
    [N, 1],
  ]) {
    const y = skinY(P, zs[j]);
    face(
      out,
      'steel',
      [p3(W[j], y - 0.9), p3(E[j], y - 0.9), p3(E[j], y + 0.6), p3(W[j], y + 0.6)],
      col.steel,
      [0, 0, s],
    );
  }
  // Two tri-chord trusses under the panel edges: twin top chords under the deck, one bottom chord.
  const B = 12;
  const tz = Array.from({ length: B + 1 }, (_, j) => P.zN + ((P.zS - P.zN) * j) / B);
  for (const inset of [2.6, P.w - 2.6]) {
    const node = (j, side) => {
      const z = tz[j];
      const x = xAt(P, z) + inset;
      const y = skinY(P, z);
      return side === 0 ? [x, y - trussD(P, z), z] : [x + side * 1.8, y - 0.9, z];
    };
    for (let j = 0; j < B; j++) {
      strut(out, 'steel', node(j, 0), node(j + 1, 0), 1.4, col.steel);
      for (const side of [-1, 1]) {
        strut(out, 'steel', node(j, side), node(j + 1, side), 1.0, col.steel);
        if (j % 2 === 0) strut(out, 'steel', node(j, side), node(j + 1, 0), 0.6, col.steel);
        else strut(out, 'steel', node(j, 0), node(j + 1, side), 0.6, col.steel);
      }
    }
    for (const j of [0, B])
      for (const side of [-1, 1]) strut(out, 'steel', node(j, side), node(j, 0), 0.7, col.steel);
    // Downturned tripod legs to the runway trucks.
    for (const [j, rail] of [
      [0, RAIL_N],
      [B, RAIL_S],
    ]) {
      const foot = [xAt(P, rail.z) + inset, rail.top + 1.5, rail.z];
      for (const side of [-1, 0, 1])
        strut(out, 'steel', node(j, side), foot, side === 0 ? 1.2 : 1.0, col.steel);
      fbox(
        out,
        'steel',
        facade([foot[0] - 2.4, rail.z + 2.2], [1, 0]),
        0,
        4.8,
        rail.top,
        rail.top + 1.6,
        -4.4,
        0,
        col.steelLight,
      );
    }
  }
}

function runways(out) {
  // South runway (100 ft) along Edgar Martinez Drive, north runway (50 ft) along Royal Brougham.
  for (const [x0, x1, z0, z1, y0, y1, piers, ground] of [
    [-92, 152, 100, 107, 26.5, 30.5, [-80, -50, -20, 10, 40, 70], 20],
    [-64, 178, -102, -97, 12, 15.5, [-60], -0.5],
  ]) {
    const F = facade([x0, z1], [1, 0]);
    fbox(out, 'steel', F, 0, x1 - x0, y0, y1, -(z1 - z0), 0, col.steel, { bottom: true });
    // Lattice on the outer face.
    const outer = z1 > 0 ? z1 + 0.25 : z0 - 0.25;
    for (let x = x0 + 2; x + 12 <= x1; x += 12) {
      strut(out, 'steel', [x, y0 + 0.4, outer], [x + 6, y1 - 0.4, outer], 0.45, col.steelLight);
      strut(
        out,
        'steel',
        [x + 6, y1 - 0.4, outer],
        [x + 12, y0 + 0.4, outer],
        0.45,
        col.steelLight,
      );
    }
    for (const x of piers)
      fbox(
        out,
        'concrete',
        facade([x - 1.4, z1 - 1], [1, 0]),
        0,
        2.8,
        ground,
        y0,
        -(z1 - z0 - 2),
        0,
        col.concrete,
      );
  }
  // Tall piers carrying the runways over the tracks east of the ballpark.
  for (const x of [100, 126, 150])
    fbox(out, 'concrete', facade([x - 2, 106.5], [1, 0]), 0, 4, -1, 26.5, -6, 0, col.concrete);
  for (const x of [140, 160, 176])
    fbox(out, 'concrete', facade([x - 1.5, -97.5], [1, 0]), 0, 3, -1, 12, -4, 0, col.concrete);
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A08',
  title: 'T-Mobile Park, Seattle',
  wikidataId: 'Q1193117',
  brief:
    'Retro ballpark on its SoDo block: a horseshoe of dark-green seat bands wrapping home plate in the south-west corner and the first- and third-base lines, a sun canopy and light towers on the upper deck, left-field bleachers under the big scoreboard, natural grass with a red-brown infield opening north-east toward downtown, a red-and-blond brick facade with arched bays and the home-plate rotunda, and the three-panel retractable roof parked open over the railway on exposed dark-green tri-chord trusses, tripod legs and its north and south runways.',
  surfaces,
  build(out) {
    building(out);
    bowl(out);
    bleachers(out);
    field(out);
    runways(out);
    for (const P of PANELS) roofPanel(out, P);
  },
  dimensions: [
    {
      fact: 'Plan: mapped OSM building 52776561141580 (outer ring), stands 35185823923355, steps 35185823923340-52, left-field bleachers 35185823923344, parked roof 35185823923353/54 and runways 35185823923342/43; field, warning track and infield from the mapped pitch and sand polygons',
      source: 'footprint.json',
    },
    {
      fact: 'Field: 331 ft left, 401 ft centre, 326 ft right, natural grass; home-plate entry rotunda at First Avenue South and South Atlantic Street (the south-west corner)',
      source: 'https://en.wikipedia.org/wiki/T-Mobile_Park',
    },
    {
      fact: 'Roof: three panels, panels 1 and 3 span 631 ft and panel 2 655 ft; 217 ft clear at second base with the centre panel highest, highest truss 275 ft; south runway 100 ft high, north runway 50 ft, lower to keep downtown views; tri-chord trusses with triangular downturned legs on eight-wheel trucks',
      source: 'https://www.djc.com/special/safeco/10053886.htm',
    },
    {
      fact: 'Retractable roof of about 9 acres stacks over the BNSF tracks east of the ballpark, partly over the right-field stands; skewed 8 degrees to suit the field',
      source: 'https://en.wikipedia.org/wiki/T-Mobile_Park',
    },
    {
      fact: 'Exposed steel painted dark green; facade of red and blond brick; four main entrances at the corners; home-plate rotunda',
      source: 'https://portal.djc.com/special/safeco/10053885.htm',
    },
    {
      fact: 'Centre-field scoreboard 56.7 ft high by 201.5 ft wide (2013); bleachers above left field below it',
      source: 'https://pcad.lib.washington.edu/building/4552',
    },
  ],
  limitations: [
    'Home plate, foul lines (5.5 deg off the grid) and the infield are fitted to the mapped infield sand; stand rakes, deck heights (lower bowl to 12 m, upper deck 20.5-35 m, canopy 39 m) and the bleacher level are estimated from the mapped heights and photographs.',
    'Seat tiers are stepped bands of about 1.1 m per row with aisle strips; concourses, suites, the Pen, bullpens and signage are reduced to plain masses, glazing and a dark screen.',
    'The parked roof is an interpretation: panel widths (62-66 m), stacking order and offsets are fitted to the mapped roof outline and the 8 deg skew; trusses are drawn as a few members per bay, and the runways as box girders with face lattice.',
    'The brick facade repeats one arched-bay rhythm on every side; gate canopies, team-store fronts and the parking garage south of Edgar Martinez Drive are not modelled.',
  ],
});
