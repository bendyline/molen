/**
 * Lumen Field (2002), Seattle: the U-shaped football and soccer bowl on the mapped SoDo site in
 * footprint.json (+X east, +Z south, origin near the north end of the pitch). A ring of stepped
 * seat bands wraps the turf; club glazing and a cantilevered upper deck rise on the two
 * sidelines and the south end, and the north end stays low and open toward downtown with the
 * Hawks' Nest bleachers and the scoreboard tower. Two long lens-shaped blue roofs cover the
 * sideline stands, each carried by a steel tied arch that springs 720 ft between concrete pylons
 * at the corners. Salmon concrete masonry base, red brick on the west, a glass curtain wall on
 * the east.
 */
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  facade,
  fbox,
  outwardRing,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  salmon: rgb('c29c88'),
  salmonShade: rgb('a98673'),
  brick: rgb('8c4e3d'),
  deck: rgb('9a958e'),
  concrete: rgb('aaa59d'),
  seat: rgb('5a6472'),
  seatBack: rgb('454d59'),
  aisle: rgb('a8a49c'),
  glass: rgb('4b5e6a'),
  opening: rgb('3b4045'),
  roof: rgb('3f5b79'),
  underside: rgb('a7adb1'),
  steel: rgb('c3c8c7'),
  steelShade: rgb('9aa1a3'),
  turf: rgb('3f7e3c'),
  screen: rgb('343c45'),
  frame: rgb('4a5057'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  plain: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.6, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.5, metallic: 0.35 },
  seats: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.6, metallic: 0 },
  turf: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
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

/** Square-section member from a to b without end caps (truss bars, hangers, columns). */
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

/** Nearest crossing of the ray from `c` at angle `th` with a polyline. */
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
 * wall down to `base`, sloped concrete aisle strips at `aisles` and stringer walls at open ends.
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
      'plain',
      [p3(front[i], base), p3(front[i + 1], base), p3(front[i + 1], h0), p3(front[i], h0)],
      col.concrete,
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
    face(out, 'plain', pts, col.aisle, [front[i][0] - back[i][0], 3, front[i][1] - back[i][1]]);
  }
  for (const [i, j, use] of [
    [0, 1, ends[0]],
    [n - 1, n - 2, ends[1]],
  ]) {
    if (!use) continue;
    const away = [front[i][0] - front[j][0], 0, front[i][1] - front[j][1]];
    face(
      out,
      'plain',
      [
        p3(front[i], base),
        p3(back[i], base),
        p3(back[i], h1),
        p3(lines[rows - 1][i], h1),
        p3(front[i], h0),
      ],
      col.concrete,
      away,
    );
  }
}

/** Quads between two matched lines at given heights (floors, soffits, roofs). */
function strip(out, slot, a, b, ya, yb, color, hint) {
  for (let i = 0; i + 1 < a.length; i++)
    face(out, slot, [p3(a[i], ya), p3(a[i + 1], ya), p3(b[i + 1], yb), p3(b[i], yb)], color, hint);
}

// ---- Mapped plan (footprint.json, heading 0: +X east, +Z south) -----------------------------

// Bowl 52776560439079: the field-side edge (its hole) and the outer edge, two z15 pieces stitched.
const FRONT = [
  [-31, 78],
  [-18, 77],
  [-1, 77.5],
  [16, 77.5],
  [33, 77],
  [36, 78],
  [39, 62],
  [42, 47],
  [43, 31],
  [43, 16],
  [43, 0],
  [42, -15],
  [40, -31],
  [37, -46],
  [26, -48],
  [14, -49],
  [3, -50],
  [-9, -49],
  [-21, -48],
  [-32, -46],
  [-35, -28],
  [-37, -11],
  [-38, 7],
  [-38, 25],
  [-37, 43],
  [-34, 60],
];
const OUTER = [
  [-44, -110],
  [-44, -90],
  [-35, -90],
  [-27, -112],
  [33, -112],
  [40, -91],
  [49, -91],
  [49, -110],
  [57, -106],
  [65, -102],
  [77, -94],
  [87, -86],
  [97, -76],
  [105, -66],
  [113, -35],
  [116, -6],
  [116, 30],
  [113, 62],
  [105, 93],
  [95, 106],
  [83, 116],
  [70, 126],
  [55, 133],
  [40, 139],
  [26, 143],
  [9, 145],
  [-7, 145],
  [-24, 143],
  [-39, 138],
  [-54, 132],
  [-68, 125],
  [-81, 115],
  [-93, 104],
  [-103, 92],
  [-112, 78],
  [-112, -44],
  [-110, -54],
  [-100, -69],
  [-88, -82],
  [-75, -94],
  [-60, -103],
];
const closed = (ring) => [...ring, ring[0]];
const C = [2.5, 14];
const FRONT_L = closed(FRONT);
const OUTER_L = closed(OUTER);
// Roofs 35184830296938 (west) and 35184830296939 (east): inner (field) edge and outer edge by z.
const ROOFS = [
  {
    side: -1,
    inner: [
      [-98, -55],
      [-34, -52],
      [15, -51],
      [62, -52],
      [126, -55],
    ],
    outer: [
      [-98, -59],
      [-91, -68],
      [-81, -81],
      [-72, -90],
      [-52, -99],
      [-34, -105],
      [-12, -110],
      [8, -112],
      [20, -112],
      [48, -108],
      [57, -106],
      [75, -100],
      [97, -90],
      [107, -81],
      [112, -76],
      [116, -69],
      [126, -57],
    ],
  },
  {
    side: 1,
    inner: [
      [-98, 58],
      [-34, 55],
      [12, 54],
      [62, 56],
      [126, 60],
    ],
    outer: [
      [-98, 62],
      [-89, 75],
      [-81, 85],
      [-70, 95],
      [-54, 103],
      [-35, 109],
      [-3, 116],
      [30, 116],
      [48, 113],
      [63, 109],
      [84, 101],
      [99, 94],
      [111, 81],
      [116, 75],
      [124, 64],
      [126, 62],
    ],
  },
];
const interp = (table, z) => {
  if (z <= table[0][0]) return table[0][1];
  for (let i = 0; i + 1 < table.length; i++) {
    const [z0, x0] = table[i],
      [z1, x1] = table[i + 1];
    if (z <= z1) return x0 + ((x1 - x0) * (z - z0)) / (z1 - z0);
  }
  return table.at(-1)[1];
};

// ---- Bowl ---------------------------------------------------------------------------------------
const LOWER_DEPTH = (th) => 22 + 2 * Math.cos(2 * th);
const UPPER_DEPTH = (th) => 46 + 2 * Math.cos(2 * th);
const UP0 = 237,
  UP1 = -57; // upper deck and roofs round the sidelines and the south end; open to the north

function bowl(out) {
  // Lower bowl, all round the pitch.
  const L = rays(0, 360, 72);
  const tF = L.map((th) => hit(FRONT_L, C, th));
  const f = L.map((th, i) => along(C, th, tF[i]));
  const b = L.map((th, i) => along(C, th, tF[i] + LOWER_DEPTH(th) - 2.5));
  const back = L.map((th, i) => along(C, th, tF[i] + LOWER_DEPTH(th)));
  tier(out, f, b, 1.3, 12, 22, {
    aisles: L.map((_, i) => i).filter((i) => i % 2 === 1),
    ends: [false, false],
  });
  strip(out, 'deck', b, back, 12, 12, col.deck, [0, 1, 0]);
  // Concourse base ring (12 m) out to the mapped outer edge.
  const hole = back.slice(0, -1);
  const ring = outwardRing(OUTER);
  for (let e = 0; e < ring.length; e++) {
    const a = ring[e],
      c = ring[(e + 1) % ring.length];
    const F = wallFace(a, c);
    const west = (a[0] + c[0]) / 2 < -95;
    face(
      out,
      west ? 'brick' : 'concrete',
      [p3(a, -1), p3(c, -1), p3(c, 12), p3(a, 12)],
      west ? col.brick : col.salmon,
      [F.normal[0], 0, F.normal[1]],
    );
    if (F.length < 8) continue;
    const n = Math.max(1, Math.floor(F.length / 11));
    const bw = F.length / n;
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) * bw;
      face(
        out,
        'glass',
        [
          F.P(u - 2.6, 0.4, 0.06),
          F.P(u + 2.6, 0.4, 0.06),
          F.P(u + 2.6, 6.6, 0.06),
          F.P(u - 2.6, 6.6, 0.06),
        ],
        col.opening,
        [F.normal[0], 0, F.normal[1]],
      );
      if (j > 0)
        fbox(
          out,
          west ? 'brick' : 'concrete',
          F,
          j * bw - 0.7,
          j * bw + 0.7,
          -1,
          12,
          0,
          0.6,
          west ? col.brick : col.salmonShade,
        );
    }
    fbox(out, 'concrete', F, 0, F.length, 7.4, 8.2, 0, 0.5, col.salmonShade);
  }
  const innerHole = outwardRing(hole).reverse();
  if (
    !out.addCap(
      'deck',
      REF,
      ring,
      [innerHole],
      () => 12,
      [0, 1, 0],
      (p) => p,
      col.deck,
    )
  )
    throw new Error('lumen: concourse cap failed');

  // Upper structure (12 -> 20 m), upper deck, back wall and the 85 ft masonry parapet.
  const U = rays(UP0, UP1, 59);
  const tUF = U.map((th) => hit(FRONT_L, C, th));
  const tB = U.map((th, i) => tUF[i] + LOWER_DEPTH(th));
  const tO = U.map((th) => hit(OUTER_L, C, th));
  const tD = U.map((th, i) => Math.min(tUF[i] + UPPER_DEPTH(th), tO[i] - 6));
  const at = (t) => U.map((th, i) => along(C, th, t[i]));
  const B = at(tB),
    O = at(tO),
    D = at(tD),
    Ui = at(tB.map((t) => t - 8)),
    Oin = at(tO.map((t) => t - 0.6));
  const outward = (i) => [
    Math.cos(U[i]) + Math.cos(U[i + 1]),
    0,
    Math.sin(U[i]) + Math.sin(U[i + 1]),
  ];
  const inward = (i) => outward(i).map((v) => -v);
  const east = (i) => Math.cos((U[i] + U[i + 1]) / 2) > 0.62;
  for (let i = 0; i + 1 < U.length; i++) {
    face(
      out,
      'concrete',
      [p3(O[i], 12), p3(O[i + 1], 12), p3(O[i + 1], 26), p3(O[i], 26)],
      col.salmon,
      outward(i),
    );
    face(
      out,
      'concrete',
      [p3(Oin[i], 20), p3(Oin[i + 1], 20), p3(Oin[i + 1], 26), p3(Oin[i], 26)],
      col.salmonShade,
      inward(i),
    );
    face(
      out,
      'concrete',
      [p3(Oin[i], 26), p3(Oin[i + 1], 26), p3(O[i + 1], 26), p3(O[i], 26)],
      col.salmonShade,
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      [p3(B[i], 12), p3(B[i + 1], 12), p3(B[i + 1], 20), p3(B[i], 20)],
      col.salmonShade,
      inward(i),
    );
    face(
      out,
      'glass',
      [p3(B[i], 12.5), p3(B[i + 1], 12.5), p3(B[i + 1], 19.5), p3(B[i], 19.5)].map((q, k) => [
        q[0] - Math.cos(U[i + (k === 1 || k === 2 ? 1 : 0)]) * 0.08,
        q[1],
        q[2] - Math.sin(U[i + (k === 1 || k === 2 ? 1 : 0)]) * 0.08,
      ]),
      col.glass,
      inward(i),
    );
    // Glass curtain wall on the east (International District) front.
    if (east(i)) {
      const g = (q, k) => [q[0] + Math.cos(U[i + k]) * 0.12, q[2] + Math.sin(U[i + k]) * 0.12];
      face(
        out,
        'glass',
        [
          p3(g(p3(O[i], 0), 0), 13),
          p3(g(p3(O[i + 1], 0), 1), 13),
          p3(g(p3(O[i + 1], 0), 1), 25),
          p3(g(p3(O[i], 0), 0), 25),
        ],
        col.glass,
        outward(i),
      );
      strut(
        out,
        'steel',
        p3(g(p3(O[i], 0), 0), 13),
        p3(g(p3(O[i], 0), 0), 25),
        0.6,
        col.steelShade,
      );
    }
  }
  strip(out, 'deck', D, Oin, 20, 20, col.deck, [0, 1, 0]);
  strip(out, 'concrete', Ui, B, 20, 20, col.salmonShade, [0, -1, 0]);
  for (const [i, sgn] of [
    [0, 1],
    [U.length - 1, -1],
  ]) {
    const j = i + sgn;
    const away = [B[i][0] - B[j][0], 0, B[i][1] - B[j][1]];
    face(
      out,
      'concrete',
      [p3(B[i], 12), p3(O[i], 12), p3(O[i], 20), p3(B[i], 20)],
      col.salmon,
      away,
    );
  }
  const top = 37;
  tier(out, Ui, D, 20.6, top, 26, {
    base: 19.4,
    aisles: U.map((_, i) => i).filter((i) => i % 2 === 1 && i < U.length - 1),
  });
  for (let i = 0; i + 1 < U.length; i++) {
    for (const [slot, y0, y1, c] of [
      ['concrete', 20, 26.5, col.salmon],
      ['glass', 26.5, 34.5, col.glass],
      ['concrete', 34.5, top + 1.2, col.salmon],
    ])
      face(
        out,
        slot,
        [p3(D[i], y0), p3(D[i + 1], y0), p3(D[i + 1], y1), p3(D[i], y1)],
        c,
        outward(i),
      );
    face(
      out,
      'concrete',
      [p3(D[i], top), p3(D[i + 1], top), p3(D[i + 1], top + 1.2), p3(D[i], top + 1.2)],
      col.salmonShade,
      inward(i),
    );
    const Dx = (k) => along(C, U[i + k], tD[i + k] + 0.5);
    face(
      out,
      'concrete',
      [p3(D[i], top + 1.2), p3(D[i + 1], top + 1.2), p3(Dx(1), top + 1.2), p3(Dx(0), top + 1.2)],
      col.salmonShade,
      [0, 1, 0],
    );
  }
}

// ---- North end: Hawks' Nest bleachers and the scoreboard tower ----------------------------------
function northEnd(out) {
  const xL = (z) => -23 + (16 * (-61 - z)) / 38,
    xR = (z) => 28 - (16 * (-61 - z)) / 38;
  const zf = -70,
    zb = -92;
  const front = [0, 1, 2, 3, 4].map((k) => [xL(zf) + ((xR(zf) - xL(zf)) * k) / 4, zf]);
  const back = [0, 1, 2, 3, 4].map((k) => [xL(zb) + ((xR(zb) - xL(zb)) * k) / 4, zb]);
  tier(out, front, back, 12.6, 24, 14, { base: 12, aisles: [1, 2, 3] });
  face(
    out,
    'concrete',
    [p3(back[0], 12), p3(back[4], 12), p3(back[4], 25.2), p3(back[0], 25.2)],
    col.salmon,
    [0, 0, -1],
  );
  // The 13-storey north tower with its vertical video board facing the pitch.
  const T = facade([-7, -93], [1, 0]);
  fbox(out, 'concrete', T, 0, 19, -1, 60, -6, 0, col.salmon);
  fbox(out, 'concrete', T, -0.5, 19.5, 58.6, 60.6, -6.5, 0.5, col.salmonShade);
  // Glazed stair and lift slots on the plaza (north) face and the flanks, banded every few storeys.
  const Tn = facade([12, -99], [-1, 0]);
  for (const [u0, u1] of [
    [2.5, 6.5],
    [12.5, 16.5],
  ]) {
    face(
      out,
      'glass',
      [Tn.P(u0, 13, 0.05), Tn.P(u1, 13, 0.05), Tn.P(u1, 57, 0.05), Tn.P(u0, 57, 0.05)],
      col.glass,
      [0, 0, -1],
    );
    for (let y = 21; y < 57; y += 8)
      fbox(out, 'concrete', Tn, u0, u1, y, y + 0.7, 0, 0.3, col.salmonShade);
  }
  for (const [x, dx] of [
    [-7, -1],
    [12, 1],
  ])
    face(
      out,
      'glass',
      [
        [x + dx * 0.05, 13, -97.6],
        [x + dx * 0.05, 13, -94.4],
        [x + dx * 0.05, 57, -94.4],
        [x + dx * 0.05, 57, -97.6],
      ],
      col.glass,
      [dx, 0, 0],
    );
  fbox(out, 'steel', T, 1.5, 17.5, 24, 56, 0, 0.8, col.frame);
  face(
    out,
    'screen',
    [T.P(2.2, 24.7, 0.84), T.P(16.8, 24.7, 0.84), T.P(16.8, 55.3, 0.84), T.P(2.2, 55.3, 0.84)],
    col.screen,
    [0, 0, 1],
  );
}

// ---- South end scoreboard over the upper deck ----------------------------------------------------
function southBoard(out) {
  const th = 90 * deg;
  const t = hit(FRONT_L, C, th) + UPPER_DEPTH(th) + 1.5;
  const z = C[1] + t;
  const F = facade([C[0] + 9, z], [-1, 0]);
  fbox(out, 'steel', F, 0, 18, 38, 52, 0, 1.6, col.steelShade);
  face(
    out,
    'screen',
    [F.P(1, 38.8, -0.04), F.P(17, 38.8, -0.04), F.P(17, 51.2, -0.04), F.P(1, 51.2, -0.04)],
    col.screen,
    [0, 0, -1],
  );
  for (const u of [3, 15]) fbox(out, 'steel', F, u - 0.6, u + 0.6, 20, 38, 0.2, 1.4, col.frame);
}

// ---- Roofs on tied arches between corner pylons ---------------------------------------------------
const Z0 = -98,
  Z1 = 126,
  ZM = 14;
const roofIn = (z) => 41 + 5 * (1 - Math.pow((z - ZM) / 112, 2));

function roof(out, R) {
  const s = R.side;
  const N = 16;
  const zs = Array.from({ length: N + 1 }, (_, j) => Z0 + ((Z1 - Z0) * j) / N);
  const xi = (z) => interp(R.inner, z);
  const xo = (z) => {
    const x = interp(R.outer, z);
    return s < 0 ? Math.min(x, xi(z) - 2.5) : Math.max(x, xi(z) + 2.5);
  };
  const yAt = (z, x) => roofIn(z) - 0.115 * Math.abs(x - xi(z));
  const I = zs.map((z) => [xi(z), z]);
  const O = zs.map((z) => [xo(z), z]);
  for (let j = 0; j < N; j++) {
    const [a, b] = [j, j + 1];
    const top = (k, P) => [P[k][0], yAt(zs[k], P[k][0]), P[k][1]];
    face(out, 'membrane', [top(a, I), top(b, I), top(b, O), top(a, O)], col.roof, [0, 1, 0]);
    const low = (k, P, d) => {
      const q = top(k, P);
      return [q[0], q[1] - d, q[2]];
    };
    face(
      out,
      'steel',
      [low(a, I, 1.2), low(b, I, 1.2), low(b, O, 1.2), low(a, O, 1.2)],
      col.underside,
      [0, -1, 0],
    );
    face(out, 'steel', [low(a, I, 3), low(b, I, 3), top(b, I), top(a, I)], col.steel, [-s, 0, 0]);
    face(out, 'steel', [low(a, O, 1.2), low(b, O, 1.2), top(b, O), top(a, O)], col.steelShade, [
      s,
      0,
      0,
    ]);
  }
  for (const [k, dz] of [
    [0, -1],
    [N, 1],
  ]) {
    const q0 = [I[k][0], yAt(zs[k], I[k][0]), zs[k]],
      q1 = [O[k][0], yAt(zs[k], O[k][0]), zs[k]];
    face(
      out,
      'steel',
      [q0, q1, [q1[0], q1[1] - 1.2, q1[2]], [q0[0], q0[1] - 3, q0[2]]],
      col.steelShade,
      [0, 0, dz],
    );
  }
  // Tri-chord tie along the leading edge, under the deck.
  const tie = (k, side) => {
    const z = zs[k];
    const x = xi(z) + s * 2;
    const y = yAt(z, x);
    return side === 0 ? [x, y - 6.5, z] : [x + side * 1.6, y - 3, z];
  };
  for (let j = 0; j < N; j++) {
    strut(out, 'steel', tie(j, 0), tie(j + 1, 0), 1.0, col.steel);
    for (const side of [-1, 1]) {
      strut(out, 'steel', tie(j, side), tie(j + 1, side), 0.8, col.steel);
      strut(
        out,
        'steel',
        j % 2 ? tie(j, 0) : tie(j, side),
        j % 2 ? tie(j + 1, side) : tie(j + 1, 0),
        0.5,
        col.steel,
      );
    }
  }
  // The arch: a tri-chord rib rising to about 200 ft over the field, hung with A-frames.
  const AZ0 = -101,
    AZ1 = 129;
  const M = 16;
  const az = Array.from({ length: M + 1 }, (_, j) => AZ0 + ((AZ1 - AZ0) * j) / M);
  const ax = (z) => xi(Math.min(Z1, Math.max(Z0, z))) + s * 7;
  const ay = (z) => 41 + 21 * (1 - Math.pow((z - (AZ0 + AZ1) / 2) / ((AZ1 - AZ0) / 2), 2));
  const rib = (j, side) => {
    const z = az[j];
    return side === 0 ? [ax(z), ay(z) + 3.6, z] : [ax(z) + side * 1.7, ay(z), z];
  };
  for (let j = 0; j < M; j++) {
    strut(out, 'steel', rib(j, 0), rib(j + 1, 0), 1.3, col.steel);
    for (const side of [-1, 1]) {
      strut(out, 'steel', rib(j, side), rib(j + 1, side), 1.1, col.steel);
      strut(
        out,
        'steel',
        j % 2 ? rib(j, 0) : rib(j, side),
        j % 2 ? rib(j + 1, side) : rib(j + 1, 0),
        0.55,
        col.steel,
      );
    }
  }
  for (let j = 1; j < M; j++) {
    const z = az[j];
    if (z <= Z0 + 4 || z >= Z1 - 4) continue;
    const foot = rib(j, 0).map((v, k) => (k === 1 ? ay(z) : v));
    const xa = xi(z) + s * 0.5,
      xb = xi(z) + s * 15;
    strut(out, 'steel', foot, [xa, yAt(z, xa), z], 0.7, col.steel);
    strut(out, 'steel', foot, [xb, yAt(z, xb), z], 0.7, col.steel);
  }
  // Concrete pylons at the arch springings.
  for (const z of [AZ0, AZ1]) {
    const x = ax(z);
    const F = facade([x - 5.5, z + (z < 0 ? 4 : -4)], [1, 0]);
    const d = z < 0 ? [-8, 0] : [0, 8];
    fbox(out, 'concrete', F, 0, 11, -1, 24, d[0], d[1], col.salmon);
    fbox(out, 'concrete', F, 1, 10, 24, 40, d[0] + 1, d[1] - 1, col.salmon);
    fbox(out, 'concrete', F, 0.4, 10.6, 40, 42, d[0] + 0.4, d[1] - 0.4, col.salmonShade);
    // A dark slot down the outer face of each pylon (lower and upper stages).
    const n = z < 0 ? -1 : 1;
    for (const [y0, y1, off] of [
      [2, 24, 4.06],
      [24, 38, 3.06],
    ]) {
      const zf = z + n * off;
      face(
        out,
        'glass',
        [
          [x - 1.2, y0, zf],
          [x + 1.2, y0, zf],
          [x + 1.2, y1, zf],
          [x - 1.2, y1, zf],
        ],
        col.opening,
        [0, 0, n],
      );
    }
  }
  // Columns carrying the roof's outer edge above the masonry base.
  for (let j = 2; j < N - 1; j += 2) {
    const z = zs[j];
    const x = xo(z) - s * 3;
    strut(out, 'steel', [x, 26, z], [x, yAt(z, x) - 1.2, z], 1.0, col.steelShade);
  }
}

function pitch(out) {
  const ring = outwardRing(FRONT);
  if (
    !out.addCap(
      'turf',
      REF,
      ring,
      [],
      () => 0.12,
      [0, 1, 0],
      (p) => p,
      col.turf,
    )
  )
    throw new Error('lumen: pitch cap failed');
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A09',
  title: 'Lumen Field, Seattle',
  wikidataId: 'Q612736',
  brief:
    "U-shaped football and soccer stadium on its SoDo site: a ring of grey-blue seat bands round the green turf, club glazing and a steep cantilevered upper deck on the sidelines and the south end, an open north end toward downtown with the Hawks' Nest bleachers and the scoreboard tower, two long lens-shaped blue roofs over the sideline stands each carried by a light steel tied arch springing between concrete corner pylons, and a salmon-concrete masonry base with red brick on the west and a glass curtain wall on the east.",
  surfaces,
  build(out) {
    pitch(out);
    bowl(out);
    northEnd(out);
    southBoard(out);
    for (const R of ROOFS) roof(out, R);
  },
  dimensions: [
    {
      fact: "Plan: mapped OSM bowl 52776560439079 (outer edge and pitch hole), roofs 35184830296938/39 (= buildings 35185007241382/83), Hawks' Nest part 35184830296935 and north tower 35184830296944 (60 m)",
      source: 'footprint.json',
    },
    {
      fact: 'Roof covers about 70% of the seats and leaves the field open; 720 ft span between concrete pylons at the north and south ends; two arches rise about 200 ft over the field; painted blue in 2010',
      source: 'https://en.wikipedia.org/wiki/Lumen_Field',
    },
    {
      fact: 'Tied-arch roof: a lower tri-chord truss and a steel arch of 16 A-frame components acting together, on friction-pendulum bearings in the pylons',
      source: 'https://www.bdcnetwork.com/nurturing-community',
    },
    {
      fact: '85 ft masonry base of stained concrete and concrete masonry; 56 ft upper-bowl cantilever over the suite level; U-shaped bowl open to the north toward downtown',
      source: 'https://www.bdcnetwork.com/nurturing-community',
    },
    {
      fact: "Salmon-coloured concrete exterior, red brick on part of the west side, glass curtain wall on the east; 13-storey north tower with a vertical scoreboard above the Hawks' Nest; FieldTurf surface",
      source: 'https://en.wikipedia.org/wiki/Lumen_Field',
    },
  ],
  limitations: [
    'Seat rakes, deck heights (lower bowl to 12 m, upper deck 20.6-37 m), the roof deck levels (39-46 m) and the arch crown (about 62 m) are estimated from the mapped 36 m roof height, the 200 ft arch figure and photographs.',
    'Seat tiers are stepped bands of about 1.1-1.8 m per row with aisle strips; suites, concourses and the Toyota fan deck are reduced to glazing, decks and plain masses.',
    'The roof deck is one sloped surface per side on the mapped lens outline; the tied arch, its tri-chord tie and the A-frame hangers are a few members per bay. Painted lettering and lights on the roof are omitted.',
    'The north tower video board and the south-end board are plain dark screens of estimated size; the separate Event Center and garage to the south are not part of this model.',
  ],
});
