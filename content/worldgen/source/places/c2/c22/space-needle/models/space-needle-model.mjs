/**
 * Space Needle model (the generator next to this file emits it; the runtime LOD generator imports
 * buildSpaceNeedleSkyline). Space Needle, Seattle Center (1962; SkyLine level 1982; base pavilion 2000; Century Project
 * glass 2018): six white steel legs in three pairs that pinch into a plated "shirtwaist" around
 * the 373 ft waist and splay out again under the top house; the dark six-sided core with three
 * outward-facing elevators; the three-winged SkyLine level at 100 ft and the 200 ft platform;
 * and the top house: sunburst underside, the Loupe's glass at 500 ft, the downward-sloping bronze
 * halo, the open 520 ft deck behind outward-tilted glass, the white roof, the pagoda and the
 * penthouse drum under the spire and its 605 ft beacon. Frame: footprint.json (heading 0, so +X
 * is east and +Z south; one leg pair points due south, the others east-northeast and
 * west-northwest, as the mapped SkyLine and 200 ft platform corners show).
 */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const REF = 'palette:#ffffff';
const deg = Math.PI / 180;

const col = {
  white: rgb('e4e1d6'), // Astronaut White legs, top house and roof
  roof: rgb('e0ddd2'),
  soffit: rgb('55585a'), // shaded ceiling between the sunburst fins
  core: rgb('4a4e51'),
  coreBand: rgb('62676a'),
  truss: rgb('505457'),
  rail: rgb('767a7d'),
  gold: rgb('c49a3c'), // elevator cabs
  halo: rgb('ad9462'),
  haloRim: rgb('9a8152'),
  glass: rgb('2f3a42'),
  deckGlass: rgb('3a4a54'),
  barrier: rgb('8aa3ab'),
  skyGlass: rgb('35444d'),
  pavilionGlass: rgb('556a74'),
  deck: rgb('9d9b94'),
  skyRoof: rgb('d3d1c9'),
  pavilionRoof: rgb('b5b4ad'),
  concrete: rgb('a9a69d'),
  spire: rgb('4c4e4f'),
  beacon: rgb('c4312b'),
};

const painted = { slot: 'wall', graph: 'metal_painted', roughness: 0.55, metallic: 0.1 };
const dark = { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0.3 };
const glass = { slot: 'window', localRef: REF, roughness: 0.12, metallic: 0.3 };
export const surfaces = {
  paint: painted,
  paintRound: painted,
  legs: painted,
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.55, metallic: 0.1 },
  dark,
  darkRound: dark,
  halo: { slot: 'trim', graph: 'metal_perforated_square', roughness: 0.5, metallic: 0.4 },
  glass,
  glassRound: glass,
  gold: { slot: 'trim', localRef: REF, roughness: 0.35, metallic: 0.6 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
};

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));
const outline = (id) => frame.features.find((f) => f.id === id).pieces[0].outline;

// Leg pairs point south, west-northwest and east-northeast (angles from +X toward +Z); the
// elevators run up the core between them.
const PAIRS = [90, 210, 330].map((a) => a * deg);
const LIFTS = [30, 150, 270].map((a) => a * deg);

/** Revolve a profile [[r, y], ...]; walking it with the solid on the left faces it outward. */
function revolve(out, slot, profile, color, sides = 64, rotation = 0) {
  lathe(
    out,
    slot,
    [0, 0],
    profile.map(([r, y]) => [y, r, r]),
    sides,
    color,
    { capTop: false, capBottom: false, rotation },
  );
}

/** Vertical facade whose outward normal points along azimuth `a`, u = 0 on that radius. */
const radialFacade = (a, r) =>
  facade([r * Math.cos(a), r * Math.sin(a)], [Math.sin(a), -Math.cos(a)]);

/** Mitered offset of an outward-ordered ring; d > 0 grows it. */
function offsetRing(ring, d) {
  const r = outwardRing(ring);
  const n = r.length;
  const normal = (a, b) => {
    const ex = b[0] - a[0],
      ez = b[1] - a[1],
      len = Math.hypot(ex, ez);
    return [-ez / len, ex / len];
  };
  return r.map((p, i) => {
    const n1 = normal(r[(i + n - 1) % n], p),
      n2 = normal(p, r[(i + 1) % n]);
    const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + k * (n1[0] + n2[0]), p[1] + k * (n1[1] + n2[1])];
  });
}

/** Ruled band between two outward rings with matching vertices (sloped walls). */
function band(out, slot, lower, y0, upper, y1, color) {
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    quad4(
      out,
      slot,
      [lower[i][0], y0, lower[i][1]],
      [lower[j][0], y0, lower[j][1]],
      [upper[j][0], y1, upper[j][1]],
      [upper[i][0], y1, upper[i][1]],
      color,
    );
  }
}

/** Union of a polygon and the polygons that share whole edges with it (the SkyLine wings). */
function mergeShared(base, wings) {
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05;
  const ring = outwardRing(base);
  const merged = [];
  let used = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    merged.push(a);
    for (const wing of wings) {
      const w = outwardRing(wing);
      const j = w.findIndex((p, k) => near(p, b) && near(w[(k + 1) % w.length], a));
      if (j < 0) continue;
      for (let k = 2; k < w.length; k++) merged.push(w[(j + k) % w.length]);
      used++;
    }
  }
  if (used !== wings.length) throw new Error('SkyLine wings do not share edges with the core');
  return merged;
}

/** A box tube swept through horizontal rectangle stations {c, a, hr, ht} (radial/tangential). */
function sweepBox(out, slot, stations, color) {
  const rings = stations.map(({ c, a, hr, ht }) => {
    const r = [Math.cos(a), Math.sin(a)],
      t = [-Math.sin(a), Math.cos(a)];
    return [
      [hr, ht],
      [hr, -ht],
      [-hr, -ht],
      [-hr, ht],
    ].map(([i, j]) => [c[0] + i * r[0] + j * t[0], c[1], c[2] + i * r[1] + j * t[1]]);
  });
  for (let s = 0; s + 1 < rings.length; s++)
    for (let k = 0; k < 4; k++)
      quad4(
        out,
        slot,
        rings[s][k],
        rings[s][(k + 1) % 4],
        rings[s + 1][(k + 1) % 4],
        rings[s + 1][k],
        color,
      );
  fan(out, slot, rings[0].slice().reverse(), color);
  fan(out, slot, rings.at(-1), color);
}

/** A radial blade at azimuth `a`: stations [r, yBottom, yTop], `half` its half thickness. */
function blade(out, slot, a, stations, half, color) {
  const P = (r, y, side) => [
    r * Math.cos(a) - side * half * Math.sin(a),
    y,
    r * Math.sin(a) + side * half * Math.cos(a),
  ];
  for (let i = 0; i + 1 < stations.length; i++) {
    const [r0, b0, t0] = stations[i],
      [r1, b1, t1] = stations[i + 1];
    quad4(out, slot, P(r0, b0, 1), P(r1, b1, 1), P(r1, t1, 1), P(r0, t0, 1), color);
    quad4(out, slot, P(r0, t0, -1), P(r1, t1, -1), P(r1, b1, -1), P(r0, b0, -1), color);
    quad4(out, slot, P(r0, b0, -1), P(r1, b1, -1), P(r1, b1, 1), P(r0, b0, 1), color);
  }
  const [ri, bi, ti] = stations[0],
    [ro, bo, to] = stations.at(-1);
  quad4(out, slot, P(ri, bi, -1), P(ri, bi, 1), P(ri, ti, 1), P(ri, ti, -1), color);
  quad4(out, slot, P(ro, bo, 1), P(ro, bo, -1), P(ro, to, -1), P(ro, to, 1), color);
}

// ---------------------------------------------------------------------------------------------
// Legs. Each pair stands 2.4 m either side of its centreline on the 102 ft (31.1 m) base circle,
// converges until the two columns are plated together from 260 ft (79.25 m) to 420 ft (128 m),
// pinches to the 373 ft (113.7 m) waist and splits again, each column running out to its own
// tip on the top house ring girder: six tips 60° apart on a 9.4 m radius. Section sizes (2.0 m
// face at the ground, 1.9 m in the shirtwaist) are scaled from photographs.
const L = {
  base: 15.55,
  waist: 4.3,
  yWaist: 113.7,
  yShirt: 79.25,
  yFork: 128.0,
  yTip: 148.3,
  tipR: 9.4,
  s0: 2.4,
};
const tipX = L.tipR * Math.cos(30 * deg),
  tipY = L.tipR * Math.sin(30 * deg);

function legRadial(y) {
  if (y <= L.yWaist)
    return L.waist + (L.base - L.waist) * Math.pow((L.yWaist - y) / L.yWaist, 1.35);
  return L.waist + (tipX - L.waist) * Math.pow((y - L.yWaist) / (L.yTip - L.yWaist), 1.8);
}
const legWidth = (y) =>
  y <= L.yShirt ? 1.0 - 0.05 * (y / L.yShirt) : y <= L.yFork ? 0.95 : 0.95 - 0.2 * forkBlend(y);
const legDepth = (y) => (y <= L.yShirt ? 0.85 - 0.07 * (y / L.yShirt) : 0.78 - 0.18 * forkBlend(y));
const forkBlend = (y) => Math.max(0, (y - L.yFork) / (L.yTip - L.yFork));
function legSpread(y) {
  if (y <= L.yShirt) return 0.95 + (L.s0 - 0.95) * Math.pow((L.yShirt - y) / L.yShirt, 1.1);
  if (y <= L.yFork) return 0.95;
  return 0.95 + (tipY - 0.95) * Math.pow(forkBlend(y), 1.5);
}
const pairPoint = (phi, x, t, y) => [
  x * Math.cos(phi) - t * Math.sin(phi),
  y,
  x * Math.sin(phi) + t * Math.cos(phi),
];

function legs(out) {
  const ys = [
    -0.8, 6, 14, 22, 30, 38, 46, 54, 62, 70, 74.5, 77.5, 79.25, 88, 97, 105, 113.7, 121, 128, 131,
    134, 137, 140, 142.5, 144.7, 146.6, 148.3,
  ];
  for (const phi of PAIRS) {
    for (const side of [-1, 1]) {
      const stations = ys.map((y) => {
        const x = legRadial(y),
          t = side * legSpread(y);
        return {
          c: pairPoint(phi, x, t, y),
          a: phi + forkBlend(y) * Math.atan2(t, x),
          hr: legDepth(y),
          ht: legWidth(y),
        };
      });
      sweepBox(out, 'legs', stations, col.white);
      // Footing under the pavilion floor.
      const [fx, , fz] = pairPoint(phi, legRadial(0), side * legSpread(0), 0);
      abox(out, 'concrete', [fx - 1.4, -0.9, fz - 1.4], [fx + 1.4, 0.25, fz + 1.4], col.concrete);
    }
    // Ladder ties between the two columns of the pair below the shirtwaist.
    for (const y of [8.6, 17.2, 25.8, 43.0, 51.6, 61.3, 68.8]) {
      const x = legRadial(y),
        s = legSpread(y);
      const F = facade([x * Math.cos(phi), x * Math.sin(phi)], [-Math.sin(phi), Math.cos(phi)]);
      fbox(out, 'paint', F, -s, s, y - 0.4, y + 0.4, -0.6, 0.6, col.white, { bottom: true });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Core: a six-sided steel shaft (flats toward the legs and the lifts; the 11 ft hollow core and
// its three elevator trusses) with storey bands, guide rails on the lift faces and the cabs: two
// gold 1993 cabs and the first 2025 double-deck glass cab. Solid but mid-grey, since the real
// shaft is open trusswork that reads lighter than a dark wall.
function core(out) {
  lathe(
    out,
    'dark',
    [0, 0],
    [
      [-0.5, 2.2, 2.2],
      [148.0, 2.2, 2.2],
    ],
    6,
    col.core,
    {
      capTop: false,
    },
  );
  for (let y = 3.2; y < 146; y += 6.5)
    revolve(
      out,
      'dark',
      [
        [2.2, y],
        [2.38, y],
        [2.38, y + 0.45],
        [2.2, y + 0.45],
      ],
      col.coreBand,
      6,
    );
  LIFTS.forEach((a, i) => {
    const F = radialFacade(a, 1.75);
    fbox(out, 'dark', F, -1.05, 1.05, -0.5, 147.9, 0, 0.45, col.truss);
    for (const u of [-0.8, 0.8])
      fbox(out, 'dark', F, u - 0.15, u + 0.15, 0.3, 147.6, 0.45, 0.65, col.rail);
    const C = radialFacade(a, 2.45);
    if (i < 2) {
      const y0 = i === 0 ? 104.0 : 46.0;
      fbox(out, 'gold', C, -1.35, 1.35, y0, y0 + 3.7, 0, 1.9, col.gold, { bottom: true });
      fbox(out, 'glass', C, -1.05, 1.05, y0 + 1.0, y0 + 2.9, 1.9, 1.95, col.glass);
    } else {
      const y0 = 139.0;
      fbox(out, 'gold', C, -1.4, 1.4, y0, y0 + 0.45, 0, 2.0, col.gold, { bottom: true });
      fbox(out, 'glass', C, -1.3, 1.3, y0 + 0.45, y0 + 6.3, 0.05, 1.95, col.deckGlass);
      fbox(out, 'gold', C, -1.4, 1.4, y0 + 3.2, y0 + 3.5, 0, 2.0, col.gold);
      fbox(out, 'gold', C, -1.4, 1.4, y0 + 6.3, y0 + 6.75, 0, 2.0, col.gold);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// SkyLine level (1982) at 100–120 ft: the mapped central triangle and its three cantilevered
// wings, with a sloped white soffit, outward-leaning glass and a white roof slab; and the 200 ft
// platform on the second round of tie beams.
function skyline(out) {
  const plan = mergeShared(
    outline('35184766343319'),
    ['35184766343316', '35184766343317', '35184766343318'].map(outline),
  );
  const soffit = offsetRing(plan, -1.3),
    sill = offsetRing(plan, -0.45),
    head = offsetRing(plan, -0.1);
  band(out, 'paint', soffit, 30.48, sill, 31.95, col.white);
  if (
    !out.addCap(
      'paint',
      REF,
      soffit,
      [],
      () => 30.48,
      [0, -1, 0],
      (p) => p,
      col.white,
    )
  )
    throw new Error('SkyLine soffit cap failed');
  band(out, 'glass', sill, 31.95, head, 34.95, col.skyGlass);
  extrude(out, 'paint', offsetRing(plan, 0.3), 34.95, 36.58, col.white, {
    bottom: true,
    topSlot: 'roof',
    topColor: col.skyRoof,
  });

  const deck = outwardRing(outline('35184766343320'));
  const inner = offsetRing(deck, -0.12);
  extrude(out, 'paint', deck, 60.96, 61.55, col.white, {
    bottom: true,
    topSlot: 'concrete',
    topColor: col.deck,
  });
  extrude(out, 'glass', deck, 61.55, 62.6, col.barrier, { holes: [inner], top: false });
  extrude(out, 'paint', offsetRing(deck, 0.03), 62.6, 62.78, col.white, { holes: [inner] });
}

// ---------------------------------------------------------------------------------------------
// Top house. Heights follow the mapped parts (underside 149.96–152.4, Loupe 152.4–156.06, deck
// enclosure 158.1–161.2, pagoda 164.5–166.95) and the 500/520 ft levels; radii follow the mapped
// Loupe (15.5 m) and underside (16.7 m) rings and the 138 ft (42 m) halo.
function topHouse(out) {
  // Bottom ring girder on the six leg tips, the flat soffit inside it and the shaded ceiling
  // between the sunburst fins.
  revolve(
    out,
    'paintRound',
    [
      [8.9, 148.7],
      [8.9, 147.45],
      [9.95, 147.45],
      [9.95, 148.7],
    ],
    col.white,
    48,
  );
  revolve(
    out,
    'darkRound',
    [
      [0, 147.95],
      [8.9, 147.95],
    ],
    col.soffit,
    48,
  );
  const ceiling = [
    [9.95, 148.7],
    [11.5, 148.95],
    [13.0, 149.45],
    [14.4, 150.2],
    [15.5, 151.1],
    [16.2, 151.95],
  ];
  revolve(out, 'darkRound', ceiling, col.soffit, 64);
  // Floor edge, the Loupe's tilted glass, the halo girder band and the 520 ft deck edge.
  revolve(
    out,
    'paintRound',
    [
      [16.2, 151.95],
      [16.95, 151.95],
      [16.95, 152.4],
      [15.3, 152.4],
    ],
    col.white,
  );
  revolve(
    out,
    'glassRound',
    [
      [15.3, 152.4],
      [15.9, 156.06],
    ],
    col.glass,
  );
  revolve(
    out,
    'paintRound',
    [
      [15.9, 156.06],
      [16.15, 156.06],
      [16.15, 156.55],
      [16.45, 156.55],
      [16.45, 157.75],
      [17.6, 157.75],
      [17.6, 158.5],
    ],
    col.white,
  );
  revolve(
    out,
    'concrete',
    [
      [17.6, 158.5],
      [13.7, 158.5],
    ],
    col.deck,
  );
  revolve(
    out,
    'glassRound',
    [
      [13.7, 158.5],
      [13.7, 161.6],
    ],
    col.deckGlass,
  );
  revolve(
    out,
    'paintRound',
    [
      [13.7, 161.6],
      [15.6, 161.6],
      [15.6, 162.0],
    ],
    col.white,
  );
  // Roof, the pagoda's inward-then-outward curve and the penthouse drum.
  revolve(
    out,
    'roof',
    [
      [15.6, 162.0],
      [12.8, 162.75],
      [10.0, 163.4],
      [7.4, 163.95],
      [5.4, 164.3],
    ],
    col.roof,
  );
  revolve(
    out,
    'paintRound',
    [
      [5.4, 164.3],
      [5.0, 164.3],
      [5.0, 164.8],
      [5.3, 165.5],
      [5.85, 166.05],
      [6.5, 166.45],
      [7.0, 166.7],
      [7.0, 166.9],
      [6.75, 167.1],
      [5.35, 167.1],
    ],
    col.white,
    48,
  );
  revolve(
    out,
    'glassRound',
    [
      [5.35, 167.1],
      [5.35, 169.0],
    ],
    col.glass,
    48,
  );
  revolve(
    out,
    'paintRound',
    [
      [5.35, 169.0],
      [5.5, 169.0],
      [5.5, 169.3],
      [0, 169.3],
    ],
    col.white,
    48,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i + 0.5) * 22.5 * deg;
    const [x, z] = [5.42 * Math.cos(a), 5.42 * Math.sin(a)];
    beam(out, 'paint', [x, 167.1, z], [x, 169.0, z], 0.3, 0.3, col.white);
  }

  // Sunburst: 48 white fins hanging under the ceiling, tied at their outer ends by the
  // stacked skirt rings.
  const ceilingAt = (r) => {
    for (let i = 0; i + 1 < ceiling.length; i++) {
      const [r0, y0] = ceiling[i],
        [r1, y1] = ceiling[i + 1];
      if (r <= r1) return y0 + ((r - r0) / (r1 - r0)) * (y1 - y0);
    }
    return 152.1;
  };
  const fin = [
    [9.95, 148.0],
    [11.5, 148.2],
    [13.0, 148.5],
    [14.4, 148.85],
    [15.5, 149.15],
    [16.2, 149.3],
    [16.95, 149.35],
  ].map(([r, y]) => [r, y, Math.min(152.1, r > 16 ? 152.1 : ceilingAt(r) + 0.15)]);
  for (let i = 0; i < 48; i++) blade(out, 'paint', i * 7.5 * deg, fin, 0.15, col.white);
  for (const y of [149.35, 150.2, 151.05])
    revolve(
      out,
      'paintRound',
      [
        [15.0, y + 0.5],
        [15.0, y],
        [16.95, y],
        [16.95, y + 0.5],
        [15.0, y + 0.5],
      ],
      col.white,
      48,
    );

  // Halo: the downward-sloping ring of ribs out to the 138 ft rim, as a perforated cone with
  // radial ribs on top.
  revolve(
    out,
    'halo',
    [
      [16.45, 156.9],
      [20.75, 154.7],
    ],
    col.halo,
  );
  revolve(
    out,
    'paintRound',
    [
      [20.75, 154.7],
      [21.03, 154.7],
      [21.03, 155.6],
      [20.75, 155.6],
    ],
    col.haloRim,
  );
  revolve(
    out,
    'halo',
    [
      [20.75, 155.6],
      [16.45, 157.45],
    ],
    col.halo,
  );
  for (let i = 0; i < 48; i++) {
    const a = (i + 0.5) * 7.5 * deg;
    const p = (r, y) => [r * Math.cos(a), y, r * Math.sin(a)];
    beam(out, 'paint', p(16.5, 157.55), p(20.7, 155.75), 0.25, 0.25, col.haloRim);
  }

  // 2018 structural glass barriers on the open deck, leaning out with the building.
  revolve(
    out,
    'glassRound',
    [
      [17.35, 158.5],
      [18.2, 161.85],
      [18.1, 161.85],
      [17.25, 158.5],
    ],
    col.barrier,
  );

  // Spire: equipment box, the tapering mast and the aircraft beacon at 605 ft.
  abox(out, 'dark', [-1.2, 169.3, -1.2], [1.2, 170.1, 1.2], col.spire);
  lathe(
    out,
    'dark',
    [0, 0],
    [
      [170.1, 0.6, 0.6],
      [183.95, 0.14, 0.14],
    ],
    3,
    col.spire,
    {
      rotation: 90 * deg,
    },
  );
  lathe(
    out,
    'gold',
    [0, 0],
    [
      [183.95, 0.25, 0.25],
      [184.25, 0.25, 0.25],
      [184.4, 0, 0],
    ],
    8,
    col.beacon,
    { capTop: false },
  );
}

// ---------------------------------------------------------------------------------------------
// Pavilion (2000): the two-storey glass drum on the mapped outline round the core (mapped at
// 20 ft; photographs show two storeys rising well above the outer ring) and a lower glass ring
// that wraps the leg footings under a flat roof.
function pavilion(out) {
  const drum = outline('35184766343165');
  extrude(out, 'glass', drum, -0.6, 7.9, col.pavilionGlass, { top: false });
  extrude(out, 'paint', offsetRing(drum, 0.05), 3.9, 4.3, col.white, { top: false });
  extrude(out, 'paint', offsetRing(drum, 0.35), 7.9, 8.5, col.white, {
    bottom: true,
    topSlot: 'concrete',
    topColor: col.pavilionRoof,
  });
  const circle = (r, sides) =>
    Array.from({ length: sides }, (_, i) => [
      r * Math.cos((i / sides) * Math.PI * 2),
      r * Math.sin((i / sides) * Math.PI * 2),
    ]);
  extrude(out, 'glass', circle(19.0, 48), -0.6, 4.1, col.pavilionGlass, { top: false });
  extrude(out, 'paint', circle(19.4, 48), 4.1, 4.55, col.white, {
    holes: [drum],
    bottom: true,
    topSlot: 'concrete',
    topColor: col.pavilionRoof,
  });
  for (let i = 0; i < 24; i++) {
    const a = (i + 0.5) * 15 * deg;
    const [x, z] = [19.12 * Math.cos(a), 19.12 * Math.sin(a)];
    beam(out, 'paint', [x, -0.2, z], [x, 4.1, z], 0.3, 0.3, col.white);
  }
}

/** Smoothing angles per surface for the master. */
export const smooth = {
  paintRound: 25,
  legs: 20,
  roof: 25,
  darkRound: 25,
  halo: 25,
  glassRound: 25,
};

/** The master: legs, core, SkyLine level, top house and base pavilion. */
export function buildSpaceNeedle(out) {
  legs(out);
  core(out);
  skyline(out);
  topHouse(out);
  pavilion(out);
}

/**
 * Hand-authored skyline level (runtimeLodOverlay; at most 1,000 triangles, one palette material):
 * the automatic simplification merged the six legs into a column. Each leg pair is one swept
 * blade from the base circle through the waist to the top-house tips, so the hourglass, the
 * flared halo and the spire survive at distance and whenever the landmark budget falls back here.
 */
export function buildSpaceNeedleSkyline(out) {
  const sides = 12;
  const ys = [-0.8, 20, 45, L.yShirt, L.yWaist, L.yFork, 140, L.yTip];
  for (const phi of PAIRS)
    sweepBox(
      out,
      'legs',
      ys.map((y) => ({
        c: pairPoint(phi, legRadial(y), 0, y),
        a: phi,
        hr: legDepth(y),
        ht: legSpread(y) + legWidth(y),
      })),
      col.white,
    );
  lathe(
    out,
    'dark',
    [0, 0],
    [
      [0, 2.6, 2.6],
      [149, 2.6, 2.6],
    ],
    6,
    col.core,
    { capTop: false },
  );
  // SkyLine level and 200 ft platform: glass bands under pale roofs.
  for (const [y0, y1, r0, r1] of [
    [30.48, 36.58, 12.5, 14.2],
    [60.96, 64.0, 6.8, 7.4],
  ]) {
    lathe(
      out,
      'glass',
      [0, 0],
      [
        [y0, r0, r0],
        [y1, r1, r1],
      ],
      sides,
      col.skyGlass,
      { capTop: false, capBottom: true },
    );
    fan(
      out,
      'roof',
      Array.from({ length: sides }, (_, i) => {
        const a = ((sides - i) / sides) * Math.PI * 2;
        return [r1 * Math.cos(a), y1, r1 * Math.sin(a)];
      }),
      col.skyRoof,
    );
  }
  lathe(
    out,
    'glass',
    [0, 0],
    [
      [0, 19, 19],
      [8.5, 19, 19],
    ],
    sides,
    col.pavilionGlass,
    { capTop: false },
  );
  fan(
    out,
    'roof',
    Array.from({ length: sides }, (_, i) => {
      const a = ((sides - i) / sides) * Math.PI * 2;
      return [19 * Math.cos(a), 8.5, 19 * Math.sin(a)];
    }),
    col.pavilionRoof,
  );
  // Top house, bottom to top: sunburst underside, Loupe glass, the downward-sloping halo, the
  // open deck behind glass, the white roof and pagoda, the penthouse drum.
  revolve(
    out,
    'paint',
    [
      [3, 144],
      [10, 148.5],
      [16.7, 152],
    ],
    col.white,
    sides,
  );
  revolve(
    out,
    'glass',
    [
      [16.7, 152],
      [15.5, 152.6],
      [15.5, 155],
    ],
    col.glass,
    sides,
  );
  revolve(
    out,
    'halo',
    [
      [15.5, 155],
      [21, 154.1],
      [21, 154.8],
      [15.8, 156.3],
    ],
    col.halo,
    sides,
  );
  revolve(
    out,
    'glass',
    [
      [15.8, 156.3],
      [15.2, 158.1],
      [15, 161.2],
    ],
    col.deckGlass,
    sides,
  );
  revolve(
    out,
    'roof',
    [
      [15, 161.2],
      [9.5, 163.4],
      [5.5, 164.6],
      [4.4, 167],
      [3.4, 168.5],
    ],
    col.roof,
    sides,
  );
  revolve(
    out,
    'dark',
    [
      [3.4, 168.5],
      [3.4, 170.3],
      [0, 170.3],
    ],
    col.core,
    6,
  );
  lathe(
    out,
    'dark',
    [0, 0],
    [
      [170.3, 0.6, 0.6],
      [183.6, 0.2, 0.2],
    ],
    6,
    col.spire,
    { capTop: false },
  );
  lathe(
    out,
    'dark',
    [0, 0],
    [
      [183.6, 0.35, 0.35],
      [184.4, 0, 0],
    ],
    6,
    col.beacon,
  );
}
