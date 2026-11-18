/**
 * Pike Place Market: the Main Arcade and North Arcade along the west side of Pike Place, at the
 * foot of Pike Street, with the corner arcade carrying the red neon PUBLIC MARKET CENTER sign
 * and clock, the FARMERS MARKET entrance and the MEET THE PRODUCER building. The arcades are one
 * low storey on Pike Place under a sidewalk canopy with planters; behind them the market drops
 * four storeys down the bluff to Western Avenue (y = 0 is Pike Place at the Main Arcade). Plan
 * from footprint.json: +X runs north-west along Pike Place, +Z faces the street, -Z the bay.
 */

import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  rgb,
  ribbon,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  stucco: rgb('d8ceb2'),
  head: rgb('dbd1b5'),
  cornice: rgb('c4b796'),
  fascia: rgb('e0d8c2'),
  green: rgb('3d6a50'),
  planter: rgb('5b7d3d'),
  roof: rgb('77746d'),
  frame: rgb('e9e7df'),
  grid: rgb('dfe3e3'),
  stalls: rgb('86735d'),
  skylight: rgb('9db2ba'),
  paving: rgb('9e978c'),
  neon: rgb('e2342b'),
  signBack: rgb('3a3433'),
  steel: rgb('34373a'),
  clock: rgb('f0eee6'),
  rim: rgb('2c2c2c'),
  panel: rgb('ece8dd'),
  board: rgb('2f5d4a'),
  boardText: rgb('ece6d4'),
  paint: rgb('4d7773'),
};
const surfaces = {
  stucco: { slot: 'wall', graph: 'stucco', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.25 },
  neon: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0 },
  grid: { slot: 'window', graph: 'window_grid', roughness: 0.25, metallic: 0.1 },
  stalls: { slot: 'window', graph: 'storefront', roughness: 0.4, metallic: 0.1 },
  skylight: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.15, metallic: 0.2 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
};

const REF = 'palette:#ffffff';
const UV3 = [
  [0, 0],
  [1, 0],
  [1, 1],
];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Fan a convex planar polygon facing `n`, dropping slivers that collapse in Float32. */
function polyFan(out, slot, poly, color, n) {
  const normal = unit(n);
  for (let i = 1; i + 1 < poly.length; i++) {
    const t = [poly[0], poly[i], poly[i + 1]].map((q) => q.map(Math.fround));
    if (Math.hypot(...cross3(sub3(t[1], t[0]), sub3(t[2], t[0]))) < 2e-5) continue;
    out.addTriangle(slot, REF, t, normal, UV3, color);
  }
}

/** Keep the part of a plan ring [x, z][] where (p[axis] - c) * sign >= 0. */
function clipPlan(ring, axis, c, sign) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const da = (a[axis] - c) * sign,
      db = (b[axis] - c) * sign;
    if (da >= 0) result.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));
const outline = (id) => frame.features.find((f) => f.id === id).pieces[0].outline;
// Ground at mapped vertices, so rows of windows below the bluff's grade are not drawn.
const groundAt = new Map();
for (const f of frame.features)
  for (const piece of f.pieces)
    for (const [i, p] of piece.outline.entries())
      groundAt.set(`${p[0]},${p[1]}`, piece.groundAtVertices[i]);
const BASE = Math.floor(frame.groundRelative.min) - 1;

const MAIN = outline('35185643742633'); // Main Arcade (1907) over the bluff
const STRIP = outline('35185647971802'); // its covered Pike Place sidewalk
const CORNER = outline('35185647971799'); // corner arcade at the foot of Pike Street
const SOUTH = outline('35184603446492'); // south block down the Pike Street Hillclimb
const HEAD = outline('35185643742632'); // three-storey building with MEET THE PRODUCER
const NORTH = outline('35184603446491'); // North Arcade (1911)

// Pike Place grade under each arcade (the street falls gently to the north) and roof heights.
const FLOOR = { main: 0, north: -1.9 };
const ARCADE = 4.8; // arcade roof above its floor
const CANOPY = [3.75, 4.5]; // sidewalk canopy underside and top above the floor
const HEAD_ROOF = 13.4;

// ---------------------------------------------------------------- lettering
const GLYPHS = {
  A: [
    [0, 0, 0.36, 1],
    [0.36, 1, 0.72, 0],
    [0.14, 0.36, 0.58, 0.36],
  ],
  B: [
    [0, 0, 0, 1],
    [0, 1, 0.52, 1],
    [0.52, 1, 0.66, 0.86],
    [0.66, 0.86, 0.66, 0.66],
    [0.66, 0.66, 0.52, 0.52],
    [0, 0.52, 0.56, 0.52],
    [0.56, 0.52, 0.72, 0.38],
    [0.72, 0.38, 0.72, 0.15],
    [0.72, 0.15, 0.57, 0],
    [0.57, 0, 0, 0],
  ],
  C: [
    [0.72, 0.84, 0.57, 1],
    [0.57, 1, 0.15, 1],
    [0.15, 1, 0, 0.84],
    [0, 0.84, 0, 0.16],
    [0, 0.16, 0.15, 0],
    [0.15, 0, 0.57, 0],
    [0.57, 0, 0.72, 0.16],
  ],
  D: [
    [0, 0, 0, 1],
    [0, 1, 0.5, 1],
    [0.5, 1, 0.72, 0.78],
    [0.72, 0.78, 0.72, 0.22],
    [0.72, 0.22, 0.5, 0],
    [0.5, 0, 0, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 0.72, 1],
    [0, 0.5, 0.6, 0.5],
    [0, 0, 0.72, 0],
  ],
  F: [
    [0, 0, 0, 1],
    [0, 1, 0.72, 1],
    [0, 0.5, 0.6, 0.5],
  ],
  H: [
    [0, 0, 0, 1],
    [0.72, 0, 0.72, 1],
    [0, 0.5, 0.72, 0.5],
  ],
  I: [[0.36, 0, 0.36, 1]],
  K: [
    [0, 0, 0, 1],
    [0, 0.4, 0.72, 1],
    [0.24, 0.6, 0.72, 0],
  ],
  L: [
    [0, 1, 0, 0],
    [0, 0, 0.72, 0],
  ],
  M: [
    [0, 0, 0, 1],
    [0, 1, 0.36, 0.42],
    [0.36, 0.42, 0.72, 1],
    [0.72, 1, 0.72, 0],
  ],
  N: [
    [0, 0, 0, 1],
    [0, 1, 0.72, 0],
    [0.72, 0, 0.72, 1],
  ],
  O: [
    [0.15, 0, 0.57, 0],
    [0.57, 0, 0.72, 0.16],
    [0.72, 0.16, 0.72, 0.84],
    [0.72, 0.84, 0.57, 1],
    [0.57, 1, 0.15, 1],
    [0.15, 1, 0, 0.84],
    [0, 0.84, 0, 0.16],
    [0, 0.16, 0.15, 0],
  ],
  P: [
    [0, 0, 0, 1],
    [0, 1, 0.55, 1],
    [0.55, 1, 0.72, 0.84],
    [0.72, 0.84, 0.72, 0.64],
    [0.72, 0.64, 0.55, 0.48],
    [0.55, 0.48, 0, 0.48],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 0.55, 1],
    [0.55, 1, 0.72, 0.84],
    [0.72, 0.84, 0.72, 0.64],
    [0.72, 0.64, 0.55, 0.48],
    [0.55, 0.48, 0, 0.48],
    [0.34, 0.48, 0.72, 0],
  ],
  S: [
    [0.72, 0.84, 0.57, 1],
    [0.57, 1, 0.15, 1],
    [0.15, 1, 0, 0.84],
    [0, 0.84, 0, 0.64],
    [0, 0.64, 0.15, 0.5],
    [0.15, 0.5, 0.57, 0.5],
    [0.57, 0.5, 0.72, 0.36],
    [0.72, 0.36, 0.72, 0.16],
    [0.72, 0.16, 0.57, 0],
    [0.57, 0, 0.15, 0],
    [0.15, 0, 0, 0.16],
  ],
  T: [
    [0, 1, 0.72, 1],
    [0.36, 1, 0.36, 0],
  ],
  U: [
    [0, 1, 0, 0.16],
    [0, 0.16, 0.15, 0],
    [0.15, 0, 0.57, 0],
    [0.57, 0, 0.72, 0.16],
    [0.72, 0.16, 0.72, 1],
  ],
};
const ADVANCE = 1.06,
  SPACE = 0.6;
const textWidth = (str, h) =>
  [...str].reduce((w, ch) => w + (ch === ' ' ? SPACE : ADVANCE) * h, 0) - 0.28 * h;

/** One letter stroke: a box from a to b in the facade plane (u, y), d0..d1 out from it. */
function stroke(out, slot, F, a, b, t, d0, d1, color, back) {
  const du = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(du, dy);
  const eu = du / len,
    ey = dy / len,
    pu = -ey,
    py = eu,
    h = t / 2;
  const q = [
    [a[0] - eu * h + pu * h, a[1] - ey * h + py * h],
    [b[0] + eu * h + pu * h, b[1] + ey * h + py * h],
    [b[0] + eu * h - pu * h, b[1] + ey * h - py * h],
    [a[0] - eu * h - pu * h, a[1] - ey * h - py * h],
  ];
  const n = [F.normal[0], 0, F.normal[1]];
  polyFan(
    out,
    slot,
    q.map(([u, y]) => F.P(u, y, d1)),
    color,
    n,
  );
  if (back)
    polyFan(
      out,
      slot,
      q.map(([u, y]) => F.P(u, y, d0)),
      back,
      n.map((v) => -v),
    );
  const centre = F.P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
  for (let i = 0; i < 4; i++) {
    const p = q[i],
      r = q[(i + 1) % 4];
    const mid = F.P((p[0] + r[0]) / 2, (p[1] + r[1]) / 2, 0);
    polyFan(
      out,
      slot,
      [F.P(p[0], p[1], d0), F.P(r[0], r[1], d0), F.P(r[0], r[1], d1), F.P(p[0], p[1], d1)],
      color,
      sub3(mid, centre),
    );
  }
}

/** Block capitals on a facade: u0 at the left as seen from the front, y0 the baseline. */
function text(
  out,
  slot,
  F,
  str,
  u0,
  y0,
  height,
  color,
  { weight = 0.17, d0 = 0, d1 = 0.25, back } = {},
) {
  let u = u0;
  for (const ch of str) {
    if (ch === ' ') {
      u += SPACE * height;
      continue;
    }
    for (const [a, b, c, d] of GLYPHS[ch])
      stroke(
        out,
        slot,
        F,
        [u + a * height, y0 + b * height],
        [u + c * height, y0 + d * height],
        weight * height,
        d0,
        d1,
        color,
        back,
      );
    u += ADVANCE * height;
  }
}

// ---------------------------------------------------------------- buildings
function edges(ring) {
  const r = outwardRing(ring);
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length];
    return { a, b, F: wallFace(a, b) };
  });
}
const edgeGround = ({ a, b }) => {
  const g = [a, b].map((p) => groundAt.get(`${p[0]},${p[1]}`)).filter((v) => v !== undefined);
  return g.length ? Math.min(...g) : BASE;
};

/** A row of multi-pane industrial windows (white frames, one glass face each) along a wall. */
function windowRow(out, F, y0, height, { spacing = 4.6, width = 3.5 } = {}) {
  const count = Math.floor((F.length - 1.6 + (spacing - width)) / spacing);
  if (count < 1) return;
  const start = (F.length - (count - 1) * spacing) / 2;
  for (let k = 0; k < count; k++)
    opening(out, F, start + k * spacing, y0, width, height, {
      glassSlot: 'grid',
      frameSlot: 'trim',
      glass: col.grid,
      frame: col.frame,
      frameWidth: 0.26,
      frameDepth: 0.14,
      d: 0.04,
    });
}

/**
 * Bay-side storeys: every wall facing the bluff (or Pike Street) gets the arcade-level row and
 * the Down Under rows where they stand above the mapped grade.
 */
function baySide(out, ring, floor, { skipRow, extraRows = [] } = {}) {
  for (const e of edges(ring)) {
    const [nx, nz] = e.F.normal;
    // Street fronts carry stalls; walls facing +X abut the next arcade.
    if (e.F.length < 5 || nz > 0.6 || nx > 0.95) continue;
    const rows = [
      [floor + 0.9, 2.5],
      [floor - 3.6, 2.3],
      [floor - 7.6, 2.3],
      [floor - 11.6, 2.3],
      ...extraRows,
    ];
    const ground = edgeGround(e);
    for (const [y0, h] of rows) {
      if (y0 + h < ground + 0.6 || y0 < BASE + 0.5) continue;
      if (skipRow?.(e, y0)) continue;
      windowRow(out, e.F, y0, h);
    }
  }
}

/** Stall fronts behind the canopy on every street-facing wall. */
function stallFront(out, ring, floor) {
  for (const e of edges(ring)) {
    if (e.F.normal[1] < 0.6 || e.F.length < 2) continue;
    const F = e.F,
      n = [F.normal[0], 0, F.normal[1]];
    polyFan(
      out,
      'stalls',
      [
        F.P(0.3, floor, 0.05),
        F.P(F.length - 0.3, floor, 0.05),
        F.P(F.length - 0.3, floor + 3.4, 0.05),
        F.P(0.3, floor + 3.4, 0.05),
      ],
      col.stalls,
      n,
    );
  }
}

/** Sidewalk canopy: paving, green cast-iron posts, a cream fascia with a green band, planters. */
function canopy(out, region, floor) {
  extrude(out, 'paving', region, floor - 3, floor + 0.04, col.paving);
  extrude(out, 'stucco', region, floor + CANOPY[0], floor + CANOPY[1], col.fascia, {
    topSlot: 'roof',
    topColor: col.roof,
    bottom: true,
  });
  ribbon(out, 'trim', region, floor + CANOPY[0] + 0.12, floor + CANOPY[0] + 0.34, col.green, {
    offset: 0.03,
    minLength: 1,
    inset: 0.05,
  });
  for (const e of edges(region)) {
    if (e.F.normal[1] < 0.6 || e.F.length < 2) continue;
    const F = e.F;
    fbox(
      out,
      'stucco',
      F,
      0.2,
      F.length - 0.2,
      floor + CANOPY[1],
      floor + CANOPY[1] + 0.45,
      -0.85,
      -0.1,
      col.planter,
    );
    const count = Math.max(1, Math.round(F.length / 4.4));
    for (let k = 0; k <= count; k++) {
      const u = 0.4 + ((F.length - 0.8) * k) / count;
      fbox(out, 'trim', F, u - 0.18, u + 0.18, floor, floor + CANOPY[0], -0.75, -0.39, col.green);
    }
  }
}

function arcades(out) {
  // Main Arcade, the south block and the corner arcade: one storey on Pike Place, the Down Under
  // storeys below on the bluff.
  const roofOpts = { topSlot: 'roof', topColor: col.roof };
  extrude(out, 'stucco', MAIN, BASE, FLOOR.main + ARCADE, col.stucco, roofOpts);
  extrude(out, 'stucco', SOUTH, BASE, FLOOR.main + ARCADE, col.stucco, roofOpts);
  const cornerRoom = clipPlan(CORNER, 1, -2.3, -1);
  extrude(out, 'stucco', cornerRoom, BASE, FLOOR.main + ARCADE, col.stucco, roofOpts);
  canopy(out, clipPlan(CORNER, 1, -2.3, 1), FLOOR.main);
  canopy(out, STRIP, FLOOR.main);
  // North Arcade, a little lower along the street.
  const northRoom = clipPlan(NORTH, 1, -1.6, -1);
  extrude(out, 'stucco', northRoom, BASE, FLOOR.north + ARCADE, col.stucco, roofOpts);
  canopy(out, clipPlan(NORTH, 1, -1.6, 1), FLOOR.north);
  for (const ring of [MAIN, SOUTH, cornerRoom]) stallFront(out, ring, FLOOR.main);
  stallFront(out, northRoom, FLOOR.north);
  // Bay-side windows; the Main Arcade's long west wall carries the painted name instead of the
  // top Down Under row.
  const longest = edges(MAIN).reduce(
    (best, e) => (e.F.normal[1] < 0 && e.F.length > (best?.F.length ?? 0) ? e : best),
    undefined,
  );
  baySide(out, MAIN, FLOOR.main, { skipRow: (e, y0) => e === longest && y0 === FLOOR.main - 3.6 });
  baySide(out, SOUTH, FLOOR.main);
  baySide(out, cornerRoom, FLOOR.main);
  baySide(out, northRoom, FLOOR.north);
  const label = 'PIKE PLACE MARKET',
    h = 2.1;
  text(
    out,
    'neon',
    longest.F,
    label,
    (longest.F.length - textWidth(label, h)) / 2,
    FLOOR.main - 3.4,
    h,
    col.paint,
    { weight: 0.15, d0: 0, d1: 0.05 },
  );
  // Skylit roofs: a glazed monitor down the middle of each arcade.
  gableRoof(
    out,
    'skylight',
    [-21, -14.2],
    [40, -7.0],
    3.6,
    FLOOR.main + ARCADE,
    FLOOR.main + ARCADE + 1.3,
    col.skylight,
    { overhang: 0.15, endSlot: 'stucco', endColor: col.stucco },
  );
  gableRoof(
    out,
    'skylight',
    [52, -5.0],
    [147, -4.9],
    2.6,
    FLOOR.north + ARCADE,
    FLOOR.north + ARCADE + 1.0,
    col.skylight,
    { overhang: 0.15, endSlot: 'stucco', endColor: col.stucco },
  );
}

/** The three-storey market building beside the Farmers Market entrance. */
function headBuilding(out) {
  extrude(out, 'stucco', HEAD, BASE, HEAD_ROOF, col.head, { topSlot: 'roof', topColor: col.roof });
  stallFront(out, HEAD, FLOOR.main);
  baySide(out, HEAD, FLOOR.main, {
    extraRows: [
      [FLOOR.main + 5.6, 2.3],
      [FLOOR.main + 9.2, 2.3],
    ],
  });
  for (const e of edges(HEAD)) {
    const F = e.F;
    if (F.length < 2) continue;
    fbox(
      out,
      'stucco',
      F,
      -0.35,
      F.length + 0.35,
      HEAD_ROOF - 0.9,
      HEAD_ROOF - 0.35,
      0,
      0.55,
      col.cornice,
    );
    fbox(
      out,
      'stucco',
      F,
      -0.2,
      F.length + 0.2,
      HEAD_ROOF - 0.35,
      HEAD_ROOF + 0.6,
      -0.25,
      0.1,
      col.head,
    );
    fbox(out, 'stucco', F, 0, F.length, 4.6, 5.1, 0, 0.3, col.cornice);
  }
  // Upper-floor windows on the street front.
  const front = edges(HEAD).find((e) => e.F.normal[1] > 0.6);
  for (const y0 of [5.6, 9.2])
    windowRow(out, front.F, FLOOR.main + y0, 2.3, { spacing: 3.6, width: 2.2 });
  // MEET THE PRODUCER: green board on the roof edge, cream letters.
  const F = front.F;
  const label = 'MEET THE PRODUCER',
    h = 1.25,
    w = textWidth(label, h);
  fbox(
    out,
    'trim',
    F,
    (F.length - w) / 2 - 0.5,
    (F.length + w) / 2 + 0.5,
    HEAD_ROOF + 0.6,
    HEAD_ROOF + 2.7,
    -0.6,
    -0.3,
    col.board,
  );
  for (const u of [(F.length - w) / 2, (F.length + w) / 2])
    fbox(out, 'trim', F, u - 0.12, u + 0.12, HEAD_ROOF, HEAD_ROOF + 0.6, -0.9, -0.6, col.steel);
  text(out, 'neon', F, label, (F.length - w) / 2, HEAD_ROOF + 1.02, h, col.boardText, {
    weight: 0.16,
    d0: -0.3,
    d1: -0.24,
  });
}

/** FARMERS MARKET: white band over the entrance at the corner, red letters. */
function farmersMarket(out) {
  const F = facade([-57.4, 1.0], [1, 0]);
  const label = 'FARMERS MARKET',
    h = 1.05,
    w = textWidth(label, h);
  const y0 = FLOOR.main + CANOPY[0];
  fbox(out, 'stucco', F, -0.3, w + 1.3, y0, y0 + 2.4, -1.2, 0.05, col.panel);
  for (const u of [-0.3, w + 1.0])
    fbox(out, 'trim', F, u - 0.1, u + 0.4, FLOOR.main, y0 + 2.6, -0.4, 0.15, col.green);
  fbox(out, 'trim', F, -0.4, w + 1.4, y0 + 2.4, y0 + 2.65, -1.3, 0.12, col.green);
  text(out, 'neon', F, label, 0.5, y0 + 0.62, h, col.neon, { weight: 0.15, d0: 0.05, d1: 0.18 });
}

/** The 1930s rooftop sign: PUBLIC / MARKET / CENTER in red neon on a steel frame, with the clock. */
function publicMarketSign(out) {
  // Faces up Pike Street (east-north-east), on the corner arcade's roof.
  const facing = [-0.397, 0.918];
  const along = [facing[1], -facing[0]];
  const F = facade([-68.47, -10.08], along);
  const Y = FLOOR.main + ARCADE + 1.0;
  const rows = [
    ['CENTER', 1.3, 0.3, 1.55],
    ['MARKET', 0.0, 2.4, 1.8],
    ['PUBLIC', 1.9, 4.8, 1.55],
  ];
  for (const [word, u0, y0, h] of rows)
    text(out, 'neon', F, word, u0, Y + y0, h, col.neon, {
      weight: 0.17,
      d0: 0,
      d1: 0.32,
      back: col.signBack,
    });
  // Steel frame: front posts and rails behind the letters, a back frame and diagonal braces.
  const top = Y + 6.8,
    right = 11.1;
  for (const u of [-0.25, 3.6, 7.4, right])
    fbox(out, 'trim', F, u - 0.11, u + 0.11, FLOOR.main + ARCADE, top, -0.45, -0.23, col.steel);
  for (const y of [0.1, 1.1, 2.2, 3.3, 4.5, 5.6, 6.6])
    fbox(out, 'trim', F, -0.4, right + 0.2, Y + y - 0.09, Y + y + 0.09, -0.45, -0.25, col.steel);
  for (const u of [-0.25, right]) {
    fbox(
      out,
      'trim',
      F,
      u - 0.11,
      u + 0.11,
      FLOOR.main + ARCADE,
      top - 1.2,
      -2.6,
      -2.38,
      col.steel,
    );
    beam(
      out,
      'trim',
      F.P(u, FLOOR.main + ARCADE + 0.1, -2.5),
      F.P(u, top - 0.2, -0.35),
      0.16,
      0.16,
      col.steel,
    );
  }
  beam(out, 'trim', F.P(-0.25, Y + 0.2, -2.5), F.P(right, top - 1.4, -2.5), 0.16, 0.16, col.steel);
  beam(out, 'trim', F.P(right, Y + 0.2, -2.5), F.P(-0.25, top - 1.4, -2.5), 0.16, 0.16, col.steel);
  // The clock: white face, dark rim, red marks and hands, on the right of PUBLIC and MARKET.
  const cu = 12.75,
    cy = Y + 4.3,
    r = 1.6,
    sides = 28;
  const n = [F.normal[0], 0, F.normal[1]];
  const ring = (radius, d) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2;
      return F.P(cu + radius * Math.cos(a), cy + radius * Math.sin(a), d);
    });
  polyFan(out, 'neon', ring(r - 0.16, 0.3), col.clock, n);
  polyFan(
    out,
    'neon',
    ring(r, -0.1),
    col.rim,
    n.map((v) => -v),
  );
  const outer = ring(r, 0.32),
    back = ring(r, -0.1),
    inner = ring(r - 0.16, 0.32);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const mid = F.P(
      cu + r * Math.cos(((i + 0.5) / sides) * Math.PI * 2),
      cy + r * Math.sin(((i + 0.5) / sides) * Math.PI * 2),
      0,
    );
    polyFan(
      out,
      'neon',
      [back[i], back[j], outer[j], outer[i]],
      col.rim,
      sub3(mid, F.P(cu, cy, 0)),
    );
    polyFan(out, 'neon', [inner[i], inner[j], outer[j], outer[i]], col.rim, n);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2,
      len = k % 3 === 0 ? 0.42 : 0.26;
    const s = [Math.sin(a), Math.cos(a)];
    stroke(
      out,
      'neon',
      F,
      [cu + s[0] * (r - 0.3 - len), cy + s[1] * (r - 0.3 - len)],
      [cu + s[0] * (r - 0.3), cy + s[1] * (r - 0.3)],
      0.14,
      0.3,
      0.36,
      col.neon,
    );
  }
  for (const [turn, len, width] of [
    [(10 + 8 / 60) / 12, 0.95, 0.17],
    [8 / 60, 1.35, 0.12],
  ]) {
    const a = turn * Math.PI * 2;
    stroke(
      out,
      'neon',
      F,
      [cu, cy],
      [cu + Math.sin(a) * len, cy + Math.cos(a) * len],
      width,
      0.36,
      0.42,
      col.neon,
    );
  }
  fbox(out, 'trim', F, cu - 0.12, cu + 0.12, FLOOR.main + ARCADE, cy - r, -0.4, -0.16, col.steel);
}

await emitPlaceMaster({
  generator: import.meta.url,
  // Review camera up Pike Street, looking at the sign corner (the model is 240 m long and thin).
  camera: { position: [-78.5, 14, 63.4], lookAt: [-59.6, 8, -4] },
  planId: 'A06',
  title: 'Pike Place Market, Seattle',
  wikidataId: 'Q1373418',
  brief:
    'Pike Place Market at the foot of Pike Street: the Main Arcade and North Arcade along the west side of Pike Place as one low storey of open stalls under a sidewalk canopy with green cast-iron posts, cream fascia and planters, with glazed roof monitors; the corner arcade with the red neon PUBLIC MARKET CENTER sign and its clock on a steel frame, the FARMERS MARKET entrance band, the three-storey cream building with the green MEET THE PRODUCER board; and the bay side falling four more storeys down the bluff toward Western Avenue, cream walls with rows of white-framed industrial windows and the painted PIKE PLACE MARKET name.',
  surfaces,
  build(out) {
    arcades(out);
    headBuilding(out);
    farmersMarket(out);
    publicMarketSign(out);
  },
  dimensions: [
    {
      fact: 'Plan: mapped OSM buildings 35185643742633 (Main Arcade), 35185647971802 (its Pike Place sidewalk bay), 35185647971799 (corner arcade at Pike Street), 35184603446492 and 35185643742632 (south blocks), 35184603446491 (North Arcade); ground at each vertex falls 12-16 m from Pike Place to the Western Avenue side',
      source: 'footprint.json',
    },
    {
      fact: 'Main Arcade built 1907 at the foot of Pike Street on the west side of Pike Place, North Arcade 1911; the market drops several floors down the bluff toward Western Avenue (Down Under); the Public Market Center sign and clock, among the first neon signs in Seattle, date from the 1930s',
      source: 'https://en.wikipedia.org/wiki/Pike_Place_Market',
    },
    {
      fact: 'Sign layout (PUBLIC over MARKET over CENTER, clock to the right of PUBLIC and MARKET on an open steel frame on the corner arcade roof) and the FARMERS MARKET and MEET THE PRODUCER signs, from street photographs looking west down Pike Street',
      source: 'https://commons.wikimedia.org/wiki/File:Public_Market_Center_sign_at_Pike_Place.jpg',
    },
    {
      fact: 'West (Western Avenue) facade: cream walls with rows of large white-framed multi-pane windows, five levels, painted Pike Place Market lettering',
      source:
        'https://commons.wikimedia.org/wiki/File:Pike_Place_Market_from_Western_Avenue_in_Seattle.jpg',
    },
  ],
  limitations: [
    'Heights are estimated from photographs: arcade roofs 4.8 m above Pike Place, the canopy at 3.75-4.5 m, the MEET THE PRODUCER building three storeys, the sign about 7.5 m tall and 13 m wide with a 3.5 m clock. Pike Place is modelled level along each arcade (the North Arcade 1.9 m lower).',
    'The Economy Market, Corner Market, Sanitary Market and the other buildings east of Pike Place, the MarketFront and the parking garage on Western Avenue are separate mapped buildings and are not part of this model.',
    'Lettering uses block capitals (the painted name on the bay side is mixed case in reality); the clock has bars instead of numerals; stall fronts, produce tables and the flags along the roof are reduced to a dark storefront band.',
    'The explorer terrain carries a few metres of noise along the bluff edge here (a mound inside the south end of the Main Arcade), so the sidewalk grade under the canopies can differ from the modelled level by up to about 2-3 m.',
  ],
});
