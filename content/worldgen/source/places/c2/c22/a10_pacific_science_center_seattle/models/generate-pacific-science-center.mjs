/**
 * Pacific Science Center, Seattle Center: Minoru Yamasaki's 1962 United States Science Pavilion.
 * Six brilliant-white precast buildings clustered in a U around a courtyard of two-level
 * reflecting pools, their walls screens of 5 ft ribbed panels with pointed "space gothic" arches
 * and rib tips above the parapets; five 100 ft open-ribbed entrance towers stand offset on the
 * entry walkways over the upper pool; later additions (1996 Discovery Labs, 1998 IMAX theater
 * dome and Ackerley exhibit gallery) close the north corners. Plan from footprint.json (+X east,
 * +Z south; the U opens north toward Seattle Center).
 */

import { readFileSync } from 'node:fs';
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  precast: rgb('eeede6'),
  rib: rgb('f3f2ec'),
  recess: rgb('c3c2b9'),
  porch: rgb('6d7173'),
  glazedPorch: rgb('56656e'),
  roof: rgb('b7b794'),
  paving: rgb('d9d5ca'),
  coping: rgb('e4e1d8'),
  water: rgb('3f5561'),
  glass: rgb('a2b5c1'),
  fascia: rgb('e6e6e0'),
  dome: rgb('f1f1ec'),
  fixture: rgb('4b5055'),
};
const surfaces = {
  precast: { slot: 'wall', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.88, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.15, metallic: 0.2 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0 },
};

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- levels (model metres)
const LOWER = 0.6; // lower courtyard paving
const UPPER = 1.2; // upper pool terrace, 2 ft above the lower
const ENTRY = 5.2; // entry walkways through the towers
const TALL = LOWER + 15.24; // 50 ft buildings
const LOW = LOWER + 9.75; // 32 ft buildings
const PANEL = 1.524; // 5 ft precast wall panels
const TIP = 0.61; // panel ribs rise 2 ft above the parapet

// ---------------------------------------------------------------- helpers
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Quad wound so its normal points along `want`. */
function quadToward(out, slot, a, b, c, d, want, color) {
  const n = cross(sub(b, a), sub(c, a));
  if (dot(n, want) >= 0) quad4(out, slot, a, b, c, d, color);
  else quad4(out, slot, d, c, b, a, color);
}
/** Square-section bar from a to b (3D), its broad faces turned by `up`. */
function bar(out, slot, a, b, w, d, color, up = [0, 1, 0]) {
  const axis = sub(b, a);
  const len = Math.hypot(...axis);
  const t = axis.map((v) => v / len);
  let s = cross(t, up);
  if (Math.hypot(...s) < 1e-3) s = cross(t, [1, 0, 0]);
  const sl = Math.hypot(...s);
  s = s.map((v) => v / sl);
  const r = cross(s, t);
  const corner = (p, i, j) => p.map((v, k) => v + (s[k] * i * w) / 2 + (r[k] * j * d) / 2);
  const ends = [a, b].map((p) => [
    corner(p, -1, -1),
    corner(p, 1, -1),
    corner(p, 1, 1),
    corner(p, -1, 1),
  ]);
  const mid = a.map((v, k) => (v + b[k]) / 2);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const fc = [ends[0][i], ends[0][j], ends[1][j], ends[1][i]];
    const centre = fc.reduce((acc, p) => acc.map((v, k) => v + p[k] / 4), [0, 0, 0]);
    quadToward(out, slot, ...fc, sub(centre, mid), color);
  }
  quadToward(
    out,
    slot,
    ...ends[0],
    t.map((v) => -v),
    color,
  );
  quadToward(out, slot, ...ends[1], t, color);
}
/** Rectangular rib swept along a planar polyline (points in 3D); `side` is the plane normal. */
function sweep(out, slot, points, w, d, side, color) {
  for (let i = 0; i + 1 < points.length; i++)
    bar(out, slot, points[i], points[i + 1], w, d, color, side);
}
function clipToConvex(p0, p1, poly) {
  // Cyrus-Beck clip of segment p0->p1 (2D) against a counterclockwise convex polygon.
  let t0 = 0,
    t1 = 1;
  const d = [p1[0] - p0[0], p1[1] - p0[1]];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const n = [-(b[1] - a[1]), b[0] - a[0]]; // inward for counterclockwise
    const num = n[0] * (p0[0] - a[0]) + n[1] * (p0[1] - a[1]);
    const den = n[0] * d[0] + n[1] * d[1];
    if (Math.abs(den) < 1e-9) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [
    [p0[0] + d[0] * t0, p0[1] + d[1] * t0],
    [p0[0] + d[0] * t1, p0[1] + d[1] * t1],
  ];
}
const inside = (ring, x, z) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i],
      [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

// ---------------------------------------------------------------- precast panel walls
/**
 * Panel screen on the wall from a to b (outside on the facade normal side): 5 ft ribs from y0
 * to the parapet plus 2 ft tips, and per tier a pointed lancet head between ribs. Tier types:
 * 'arch' (solid panels, shallow shaded recess), 'open' (open arches over a porch or walkway),
 * 'glazed' (open arches with glass behind) and 'scallop' (ribs only).
 */
function panelWall(out, a, b, y0, top, tiers) {
  const F = facade(a, [b[0] - a[0], b[1] - a[1]]);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < PANEL * 1.5) return;
  const bays = Math.floor(len / PANEL);
  const start = (len - bays * PANEL) / 2;
  const half = 0.13;
  // Coping band over the panel heads.
  fbox(out, 'precast', F, 0, len, top - 0.25, top, -0.2, 0.32, col.precast);
  for (let k = 0; k <= bays; k++) {
    const u = start + k * PANEL;
    fbox(out, 'precast', F, u - half, u + half, y0, top + TIP, 0, 0.36, col.rib);
  }
  for (const tier of tiers) {
    if (tier.type === 'scallop') continue;
    const tint =
      tier.type === 'open' ? col.porch : tier.type === 'glazed' ? col.glazedPorch : col.recess;
    const depth = 0.3;
    for (let k = 0; k < bays; k++) {
      const u0 = start + k * PANEL + half,
        u1 = start + (k + 1) * PANEL - half;
      const mid = (u0 + u1) / 2,
        hw = (u1 - u0) / 2;
      const rise = tier.rise ?? 1.9;
      const spring = tier.y1 - 0.18 - rise;
      const arch = pointedArch(hw, rise, 2).map(([du, dy]) => [mid + du, spring + dy]);
      // Shaded field below the arch (convex: rectangle with a pointed head).
      fan(
        out,
        tier.type === 'glazed' ? 'glass' : 'precast',
        [[u0, tier.y0], [u1, tier.y0], ...arch.slice().reverse()].map(([pu, py]) =>
          F.P(pu, py, 0.02),
        ),
        tint,
      );
      // Spandrels between the arch and the head of the tier, with soffits into the opening.
      for (let i = 0; i + 1 < arch.length; i++) {
        const [ua, ya] = arch[i],
          [ub, yb] = arch[i + 1];
        quad4(
          out,
          'precast',
          F.P(ua, ya, depth),
          F.P(ub, yb, depth),
          F.P(ub, tier.y1, depth),
          F.P(ua, tier.y1, depth),
          col.precast,
        );
        const inward = [mid - (ua + ub) / 2, spring - (ya + yb) / 2];
        const want = sub(F.P(mid + inward[0], 0, 0), F.P(mid, 0, 0));
        want[1] = inward[1];
        quadToward(
          out,
          'precast',
          F.P(ua, ya, 0),
          F.P(ub, yb, 0),
          F.P(ub, yb, depth),
          F.P(ua, ya, depth),
          want,
          col.precast,
        );
      }
      // Bay sill/band at the foot of an open tier (the floor edge behind).
      if (tier.type !== 'arch' && tier.floor)
        fbox(out, 'precast', F, u0 - 0.02, u1 + 0.02, tier.y0 - 0.5, tier.y0, 0, 0.3, col.precast);
    }
    // Spandrel band top for the tier, closing the gap behind the arch heads.
    fbox(out, 'precast', F, 0, len, tier.y1 - 0.18, tier.y1, -0.05, depth, col.precast);
  }
}

/** Extrude a building, roof it and dress each exposed wall by the facing it presents. */
function building(out, ring, top, dress, others) {
  const base = Math.min(...ring.groundAt) - 1;
  extrude(out, 'precast', ring.outline, base, top, col.precast, {
    topSlot: 'roof',
    topColor: col.roof,
  });
  const r = outwardRing(ring.outline);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3) continue;
    const F = facade(a, [b[0] - a[0], b[1] - a[1]]);
    // Against a neighbour, dress only what rises above it (party walls stay plain).
    const probe = F.P(len / 2, 0, 1.5);
    const against = others.find((o) => inside(o.outline, probe[0], probe[2]));
    if (against && against.top > top - 1) continue;
    const facing =
      Math.abs(F.normal[0]) > Math.abs(F.normal[1])
        ? F.normal[0] > 0
          ? 'east'
          : 'west'
        : F.normal[1] > 0
          ? 'south'
          : 'north';
    panelWall(
      out,
      a,
      b,
      against ? against.top : base,
      top,
      against ? scallop : dress(facing, a, b),
    );
  }
}

// ---------------------------------------------------------------- the 1962 buildings
const ids = {
  site: '35184767044735',
  b1: '35184767044715', // NE, "Horizons of Science", 105 x 120 ft, 50 ft
  b2: '35184767044719', // E, "Methods of Science", 225 x 115 ft, 32 ft
  b3: '35184767044714', // S, rest area / Junior Lab, two storeys on the slope
  laser: '35184767044730', // SW, Spacearium (Laser Dome), 105 x 100 ft, 50 ft
  b4: '35184767044722', // W, "History of Science", 175 x 85 ft, 32 ft
  b5: '35184767044731', // NW, "House of Science" (PACCAR IMAX), 105 x 120 ft, 50 ft
  gallery: '35184767044708', // 1998 Ackerley exhibit gallery (glass)
  imax: '35184767044710', // 1998 Boeing IMAX theater dome
  plinth: '35184767044709',
  labs: '35184767044726', // 1996 Discovery Labs (glass)
};
const feature = (id) => {
  const piece = frame.features.find((f) => f.id === id).pieces[0];
  return { outline: piece.outline, groundAt: piece.groundAtVertices };
};

const solid = (y1, rise = 2.0) => [{ type: 'arch', y0: LOWER + 0.4, y1, rise }];
const scallop = [{ type: 'scallop' }];

function pavilion(out) {
  const all = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, feature(id)]));
  const tops = {
    b1: TALL,
    b2: LOW,
    b3: LOW,
    laser: TALL,
    b4: LOW,
    b5: TALL,
    gallery: Math.max(...all.gallery.groundAt) + 8,
    labs: Math.max(...all.labs.groundAt) + 8,
    imax: Math.max(...all.imax.groundAt) + 2,
    plinth: Math.max(...all.plinth.groundAt) + 2,
  };
  const rings = (except) =>
    Object.entries(all)
      .filter(([k]) => k !== except && k !== 'site')
      .map(([k, f]) => ({ outline: f.outline, top: tops[k] }));
  // Building 5 (NW): high porch of open arches over the entry level, covered walkway below.
  building(
    out,
    all.b5,
    TALL,
    (facing) =>
      facing === 'east'
        ? [
            { type: 'open', y0: LOWER, y1: ENTRY - 0.6, rise: 1.5, floor: false },
            { type: 'open', y0: ENTRY + 0.1, y1: TALL - 0.3, rise: 2.6, floor: true },
          ]
        : facing === 'west'
          ? solid(TALL - 0.3, 2.6)
          : scallop,
    rings('b5'),
  );
  building(
    out,
    all.b4,
    LOW,
    (facing) => (facing === 'east' || facing === 'west' ? solid(LOW - 0.3) : scallop),
    rings('b4'),
  );
  building(
    out,
    all.laser,
    TALL,
    (facing) => (facing === 'north' || facing === 'south' ? solid(TALL - 0.3, 2.6) : scallop),
    rings('laser'),
  );
  // Building 3 (S): open arched screen with glass behind on the courtyard, arched to Denny Way.
  building(
    out,
    all.b3,
    LOW,
    (facing) =>
      facing === 'north'
        ? [{ type: 'glazed', y0: LOWER, y1: LOW - 0.3, rise: 2.0, floor: true }]
        : facing === 'south'
          ? solid(LOW - 0.3)
          : scallop,
    rings('b3'),
  );
  building(
    out,
    all.b2,
    LOW,
    (facing) => (facing === 'west' ? solid(LOW - 0.3) : scallop),
    rings('b2'),
  );
  // Building 1 (NE): open arches over the level 1 walkway, solid arched panels above.
  building(
    out,
    all.b1,
    TALL,
    (facing) =>
      facing === 'west'
        ? [
            { type: 'open', y0: LOWER, y1: ENTRY - 0.6, rise: 1.5, floor: false },
            { type: 'arch', y0: ENTRY + 0.1, y1: TALL - 0.3, rise: 2.6 },
          ]
        : scallop,
    rings('b1'),
  );
  // Floor slab edges where the open tiers meet the entry level.
  for (const [x, z0, z1, n] of [
    [-61.55, -78.9, -42.3, 1],
    [-14.4, -79.0, -42.1, -1],
  ]) {
    const F = facade([x, n > 0 ? z0 : z1], [0, n > 0 ? 1 : -1]);
    fbox(out, 'precast', F, 0, z1 - z0, ENTRY - 0.6, ENTRY + 0.1, 0, 0.45, col.precast);
  }
  return all;
}

// ---------------------------------------------------------------- later additions
function additions(out, all) {
  // Glass pavilions with a white fascia and mullions every 3 m.
  for (const key of ['gallery', 'labs']) {
    const f = all[key];
    const base = Math.min(...f.groundAt) - 1;
    const top = Math.max(...f.groundAt) + 8;
    extrude(out, 'glass', f.outline, base, top - 1.3, col.glass, {
      topSlot: 'roof',
      topColor: col.roof,
    });
    extrude(out, 'precast', f.outline, top - 1.3, top, col.fascia, {
      topSlot: 'roof',
      topColor: col.roof,
    });
    const r = outwardRing(f.outline);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 2.5) continue;
      const F = facade(a, [b[0] - a[0], b[1] - a[1]]);
      const probe = F.P(len / 2, 0, 1.5);
      if (
        [all.b1, all.b2, all.b5, all.imax, all.plinth].some((o) =>
          inside(o.outline, probe[0], probe[2]),
        )
      )
        continue;
      const count = Math.max(1, Math.round(len / 3));
      for (let k = 1; k < count; k++)
        fbox(
          out,
          'precast',
          F,
          (len * k) / count - 0.09,
          (len * k) / count + 0.09,
          base,
          top - 1.3,
          0,
          0.14,
          col.fascia,
        );
    }
  }
  // Boeing IMAX theater: a low drum under a white dome (mapped roof:shape=dome, 10 m of 12 m).
  const dome = all.imax;
  const c = dome.outline.reduce(
    (s, p) => [s[0] + p[0] / dome.outline.length, s[1] + p[1] / dome.outline.length],
    [0, 0],
  );
  const R =
    dome.outline.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) /
    dome.outline.length;
  const g = Math.max(...dome.groundAt);
  const layers = [[Math.min(...dome.groundAt) - 1, R, R]];
  layers.push([g + 2, R, R]);
  for (let k = 1; k <= 7; k++) {
    const t = (k / 7) * (Math.PI / 2);
    const rr = R * Math.cos(t);
    layers.push([g + 2 + 10 * Math.sin(t), Math.max(rr, 0), Math.max(rr, 0)]);
  }
  layers[layers.length - 1] = [g + 12, 0, 0];
  lathe(out, 'precast', c, layers, 32, col.dome, { capTop: false });
  const plinth = all.plinth;
  extrude(
    out,
    'paving',
    plinth.outline,
    Math.min(...plinth.groundAt) - 1,
    Math.max(...plinth.groundAt) + 2,
    col.paving,
  );
}

// ---------------------------------------------------------------- courtyard, pools and walks
// OSM natural=water 1464047117 (the lower pool), amenity=fountain and disused fountains,
// highway=pedestrian 56629867 (walks and the tower platforms), in this frame.
const lowerPool = [
  [-63.4, -38.4],
  [-63.4, -32.6],
  [-14.5, -32.6],
  [-14.3, -38],
  [-7.6, -38.1],
  [-7.6, -1.8],
  [-18.3, -1.7],
  [-18.3, -9.1],
  [-30.7, -9.1],
  [-30.7, -1.7],
  [-34.3, -1.7],
  [-38.8, -3.3],
  [-73.3, -3.3],
  [-73.3, -38.4],
];
// Upper pool: the north half between Buildings 5 and 1, around the tower platforms and the
// entry bridge (unmapped as water; bounded by the mapped walks and buildings).
const upperPool = [
  [-61.6, -32.6],
  [-14.4, -32.6],
  [-14.4, -79.0],
  [-14.4, -93.7],
  [-25.8, -93.7],
  [-25.8, -86.0],
  [-38.3, -86.0],
  [-38.3, -90.0],
  [-61.6, -90.0],
];
const lowerDeck = [
  [-79.8, -42.4],
  [-61.6, -42.4],
  [-61.6, -32.6],
  [-14.4, -32.6],
  [-14.4, -42.1],
  [-1.15, -42.1],
  [-1.15, 16.2],
  [-41.0, 16.2],
  [-41.0, 0.9],
  [-73.0, 0.9],
  [-73.0, 3.2],
  [-79.8, 3.2],
];
const fountains = [
  [-14.2, -23.9, LOWER],
  [-55.9, -23.7, LOWER],
  [-64.9, -14.8, LOWER],
  [-49.9, -11.8, LOWER],
  [-22.3, -17.6, LOWER],
  [-53.7, -75.2, UPPER],
  [-44.4, -83.1, UPPER],
  [-29.1, -47.4, UPPER],
];

/** Flat water just above its terrace with a coping curb around the pool edge. */
function pool(out, ring, floor) {
  const r = outwardRing(ring);
  if (
    !out.addCap(
      'glass',
      'palette:#ffffff',
      r,
      [],
      () => floor + 0.1,
      [0, 1, 0],
      (p) => p,
      col.water,
    )
  )
    throw new Error('pool cap failed');
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    fbox(
      out,
      'paving',
      facade(a, [b[0] - a[0], b[1] - a[1]]),
      -0.2,
      len + 0.2,
      floor,
      floor + 0.3,
      0,
      0.4,
      col.coping,
    );
  }
}

/** Yamasaki's petalled fountain basin on a short stem. */
function fountain(out, x, z, floor) {
  const petals = 16;
  const rim = (y, r, k) => [y, r * k, r * k];
  lathe(
    out,
    'precast',
    [x, z],
    [
      rim(floor, 0.35, 1),
      rim(floor + 0.7, 0.4, 1),
      rim(floor + 0.85, 1.6, 1),
      rim(floor + 1.05, 2.3, 1),
      rim(floor + 1.12, 2.0, 1),
    ],
    petals,
    col.precast,
  );
}

function courtyard(out) {
  extrude(out, 'paving', lowerDeck, LOWER - 3.6, LOWER, col.paving);
  extrude(out, 'paving', upperPool, LOWER - 3.6, UPPER, col.paving);
  pool(out, lowerPool, LOWER);
  pool(out, upperPool, UPPER);
  for (const [x, z, floor] of fountains) fountain(out, x, z, floor);
  // 1993 pool pad and walk across the lower pool, and the "bandstand" platform off Building 3.
  const walk = (ring, y1) => extrude(out, 'paving', ring, LOWER, y1, col.paving);
  walk(
    [
      [-43.2, -32.6],
      [-38.9, -32.6],
      [-38.9, -28.5],
      [-43.2, -24.4],
    ],
    LOWER + 0.35,
  );
  walk(
    [
      [-43.2, -24.4],
      [-38.9, -28.5],
      [-29.9, -19.9],
      [-38.9, -11.3],
      [-47.5, -19.7],
    ],
    LOWER + 0.35,
  );
  walk(
    [
      [-38.9, -11.3],
      [-34.4, -15.5],
      [-34.3, -1.7],
      [-38.8, -3.3],
    ],
    LOWER + 0.35,
  );
  walk(
    [
      [-30.7, -9.1],
      [-18.3, -9.1],
      [-18.3, -1.7],
      [-30.7, -1.7],
    ],
    LOWER + 1.1,
  );
}

// ---------------------------------------------------------------- entrance towers
// Five 40 ft platforms in an offset chain (OSM pedestrian 56629867), centred on Seattle
// Center's north-south axis: towers 1-3 step diagonally from Building 5 to Building 1, 4 and 5
// step off the middle tower to the south and north.
const towers = [
  [-49.6, -55.6],
  [-37.6, -61.6],
  [-25.6, -67.6],
  [-43.5, -43.4],
  [-31.7, -79.8],
];
const HALF = 6.1; // 40 ft square platforms
const LEG = 5.65; // leg centre from the tower axis
const SPRING = 13.0;
const APEX = LOWER + 30.48; // 100 ft

function platform(out, x0, z0, x1, z1, y1, thick) {
  extrude(
    out,
    'paving',
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    y1 - thick,
    y1,
    col.paving,
    { bottom: true },
  );
}

function tower(out, [cx, cz]) {
  // Platforms: the lower (exit) level just over the upper pool and the entry level above.
  platform(out, cx - HALF, cz - HALF, cx + HALF, cz + HALF, UPPER + 0.55, 0.45);
  platform(out, cx - HALF, cz - HALF, cx + HALF, cz + HALF, ENTRY, 0.6);
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([i, j]) => [cx + i * LEG, cz + j * LEG]);
  for (const [x, z] of corners)
    bar(out, 'precast', [x, UPPER, z], [x, SPRING + 0.4, z], 0.9, 0.9, col.rib, [1, 0, 0]);
  // Four face arches with an open diamond lattice in their heads.
  const arch = pointedArch(LEG, APEX - SPRING, 6);
  const latticeFrom = SPRING + 3.5;
  for (let f = 0; f < 4; f++) {
    const a = corners[f],
      b = corners[(f + 1) % 4];
    const along = [(b[0] - a[0]) / (2 * LEG), (b[1] - a[1]) / (2 * LEG)];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const at = (u, y) => [mid[0] + along[0] * u, y, mid[1] + along[1] * u];
    const side = [-along[1], 0, along[0]];
    sweep(
      out,
      'precast',
      arch.map(([u, y]) => at(u, SPRING + y)),
      0.75,
      0.8,
      side,
      col.rib,
    );
    // Lattice: two families of ribs at +-60 degrees clipped to the arch head.
    const poly = [
      [LEG, latticeFrom - SPRING],
      ...arch.filter(([, y]) => y > latticeFrom - SPRING).reverse(),
      [-LEG, latticeFrom - SPRING],
    ];
    // Make the polygon counterclockwise in (u, y).
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    const ccw = area > 0 ? poly : poly.slice().reverse();
    for (const s of [-1, 1])
      for (let k = -6; k <= 6; k++) {
        const dir = [s * 0.5, 0.866];
        const normal = [0.866, -s * 0.5];
        const off = k * 2.8 + 1.4;
        const p0 = [
          normal[0] * off - dir[0] * 30,
          latticeFrom - SPRING + 6 + normal[1] * off - dir[1] * 30,
        ];
        const p1 = [p0[0] + dir[0] * 60, p0[1] + dir[1] * 60];
        const seg = clipToConvex(p0, p1, ccw);
        if (!seg || Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) < 0.6) continue;
        bar(
          out,
          'precast',
          at(seg[0][0], SPRING + seg[0][1]),
          at(seg[1][0], SPRING + seg[1][1]),
          0.3,
          0.36,
          col.rib,
          side,
        );
      }
    // Horizontal tie at the foot of the lattice.
    bar(out, 'precast', at(-LEG, latticeFrom), at(LEG, latticeFrom), 0.4, 0.5, col.rib, side);
  }
  // Cable cross-ties carrying the pendant lantern.
  const hang = SPRING - 2.5;
  for (const [x, z] of corners)
    bar(out, 'metal', [x, SPRING, z], [cx, hang + 1.6, cz], 0.14, 0.14, col.fixture);
  lathe(
    out,
    'metal',
    [cx, cz],
    [
      [hang - 0.4, 0, 0],
      [hang, 0.7, 0.7],
      [hang + 1.3, 0.85, 0.85],
      [hang + 1.6, 0.25, 0.25],
    ],
    8,
    col.fixture,
  );
}

function entry(out) {
  for (const t of towers) tower(out, t);
  // Entry-level bridges to Building 5's porch and Building 1's upper level.
  platform(out, -61.6, -58.8, -55.7, -52.3, ENTRY, 0.6);
  platform(out, -19.7, -71.1, -14.4, -64.4, ENTRY, 0.6);
  // Lower-level walk from tower 4 to the pool divider.
  platform(out, -43.2, -37.3, -38.9, -32.4, UPPER + 0.15, 0.5);
  // Wide stair from the north forecourt up to the entry level, with its support walls.
  const steps = 12;
  const z0 = -86.0,
    z1 = -101.5,
    yLow = 1.0;
  for (let k = 0; k < steps; k++) {
    const za = z0 + ((z1 - z0) * k) / steps,
      zb = z0 + ((z1 - z0) * (k + 1)) / steps;
    const y = ENTRY - ((ENTRY - yLow) * (k + 1)) / steps;
    platform(out, -38.3, zb, -25.8, za, y + (ENTRY - yLow) / steps, 0.35 + (ENTRY - yLow) / steps);
  }
  for (const x of [-38.3, -25.8])
    extrude(
      out,
      'precast',
      [
        [x - 0.3, z0],
        [x + 0.3, z0],
        [x + 0.3, z1],
        [x - 0.3, z1],
      ],
      yLow - 1.5,
      ENTRY - 2.2,
      col.precast,
    );
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A10',
  title: 'Pacific Science Center, Seattle',
  wikidataId: 'Q3848341',
  brief:
    "Minoru Yamasaki's 1962 United States Science Pavilion: six brilliant-white precast concrete buildings in a U around a courtyard of two-level reflecting pools with petalled fountains, their walls screens of 5 ft ribbed panels with pointed 'space gothic' lancet arches and rib tips above the parapets (open arcades on the courtyard porches); five 100 ft open-ribbed lattice arch towers stand offset on the two-level entry walkways over the upper pool; the 1996 Discovery Labs, the 1998 IMAX dome and the glass Ackerley gallery close the north corners.",
  surfaces,
  build(out) {
    const all = pavilion(out);
    additions(out, all);
    courtyard(out);
    entry(out);
  },
  dimensions: [
    {
      fact: 'Plan: the mapped OSM building 35184767044735 (way 394955903) and its parts 35184767044715, -719, -714, -730, -722, -731 (the six 1962 buildings), -708, -726, -710, -709 (1990s additions)',
      source: 'footprint.json',
    },
    {
      fact: 'Building sizes: NW and NE buildings 105 x 120 ft, 50 ft high; Laser Dome 105 x 100 ft, 50 ft; west building 175 x 85 ft, 32 ft; east building 225 x 115 ft, 32 ft; south building 62.5 x 128.75 ft, two storeys on the slope',
      source:
        'https://pauldorpat.com/wp-content/uploads/2023/05/2010-02-26-LPBCurrentNomPacScienceCtrrevised722010.pdf',
    },
    {
      fact: 'Walls of prestressed precast ribbed panels 5 ft wide and 32-50 ft tall, faced in white quartzite aggregate; arched panels carry a central rib 2 ft above the parapet; scalloped infill panels elsewhere',
      source:
        'https://pauldorpat.com/wp-content/uploads/2023/05/2010-02-26-LPBCurrentNomPacScienceCtrrevised722010.pdf',
    },
    {
      fact: 'Five precast concrete 100 ft entry arches topped with open-ribbed vaults on ten 40 x 40 ft slabs (entry level and lower exit level), each carrying a pendant light on cable cross-ties, centred on the Seattle Center north-south axis',
      source:
        'https://pauldorpat.com/wp-content/uploads/2023/05/2010-02-26-LPBCurrentNomPacScienceCtrrevised722010.pdf',
    },
    {
      fact: 'Two-level shallow reflecting pool, the north half about 2 ft above the south; eight petalled fountains (three upper, five lower); 1993 pool pad and walk across the lower pool; raised viewing platform north of the south building',
      source:
        'https://pauldorpat.com/wp-content/uploads/2023/05/2010-02-26-LPBCurrentNomPacScienceCtrrevised722010.pdf',
    },
    {
      fact: 'Pools, fountains and walks: OSM natural=water 1464047117, amenity=fountain 394955860-394955868, highway=pedestrian 56629867 (tower platform chain)',
      source: 'https://www.openstreetmap.org/way/56629867',
    },
    {
      fact: 'Five 100-foot towers with open-ribbed space gothic arches; 475 vertical panels; Yamasaki first planned a single 110 ft tower',
      source: 'https://pacificsciencecenter.org/?p=551',
    },
  ],
  limitations: [
    'Tower arch springing, lattice spacing and rib sizes are estimated from photographs; the published height (100 ft) is used, not the 110 ft of the abandoned single-tower scheme.',
    'Panel tracery is reduced to ribs with one pointed lancet head per 5 ft bay per tier; scalloped panels are ribs only; the curved ribs under the walkway slabs, railings, benches and planters are omitted.',
    'The upper pool outline is inferred from the mapped walks and fountains (OSM maps only the lower pool); pool and walkway levels are estimated relative to the courtyard paving.',
    'The 1990s additions (Discovery Labs, IMAX dome, Ackerley gallery) are simple glass and white masses on their mapped outlines; ticket kiosks and the south entrance bay are omitted.',
  ],
});
