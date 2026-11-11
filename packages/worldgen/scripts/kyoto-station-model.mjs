/** Kyōto Station. The Karasuma atrium, two building wings and Hachijō rail terminal. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';
import { lettering } from './stadium-lettering.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/xn/xn0/kyoto_station/layout.json',
      import.meta.url,
    ),
  ),
);
const stone = { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 };
const panel = { slot: 'wall', graph: 'concrete_panel', roughness: 0.88 };
const concrete = { slot: 'wall', graph: 'concrete_plain', roughness: 0.93 };
const steel = { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.14 };
const glass = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.38 };
export const surfaces = {
  floor: stone,
  tread: stone,
  ballast: stone,
  planter: stone,
  gold: stone,
  panel,
  light: panel,
  shadow: panel,
  foundation: concrete,
  underside: concrete,
  steel,
  lightSteel: steel,
  dark: steel,
  rail: steel,
  red: steel,
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.12 },
  glass,
  blueGlass: glass,
  dimGlass: glass,
  clear: {
    slot: 'window',
    localRef: 'palette:#d9eff9',
    roughness: 0.29,
    metallic: 0.04,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.39],
    doubleSided: true,
  },
};
const swatches = {
  floor: [0.66, 0.64, 0.6],
  tread: [0.62, 0.58, 0.54],
  ballast: [0.55, 0.53, 0.5],
  planter: [0.38, 0.49, 0.31],
  gold: [0.78, 0.66, 0.3],
  panel: [0.66, 0.67, 0.67],
  light: [0.82, 0.82, 0.8],
  shadow: [0.39, 0.43, 0.43],
  foundation: [0.62, 0.64, 0.64],
  underside: [0.51, 0.52, 0.53],
  steel: [0.49, 0.55, 0.56],
  lightSteel: [0.8, 0.83, 0.83],
  dark: [0.22, 0.27, 0.28],
  rail: [0.39, 0.43, 0.45],
  red: [0.65, 0.1, 0.07],
  roof: [0.64, 0.67, 0.67],
  glass: [0.35, 0.48, 0.6],
  blueGlass: [0.34, 0.5, 0.66],
  dimGlass: [0.23, 0.33, 0.4],
  clear: [0.63, 0.74, 0.81],
};
const linear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const colors = Object.fromEntries(
  Object.entries(swatches).map(([role, c]) => [role, c.map(linear)]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  north = [0, 0, -1],
  south = [0, 0, 1],
  west = [-1, 0, 0],
  east = [1, 0, 0];
const ref = 'palette:#ffffff',
  mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t)),
  at = ([x, z], y) => [x, y, z];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const tone = (i, j = 0) =>
  0.92 + (((Math.imul(i + 15, 30323) ^ Math.imul(j + 73, 87211)) >>> 7) % 161) / 1010;
const box = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);

function writer(out) {
  return (role, points, dir, tint = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const p = [points[0], points[i], points[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (dot(n, dir) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        role,
        ref,
        p,
        n,
        undefined,
        colors[role].map((v) => Math.min(1, v * tint)),
      );
    }
  };
}
function cap(f, role, polygon, y, dir = up) {
  const rings = [polygon.outline, ...(polygon.holes ?? [])],
    starts = [];
  let offset = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(offset);
    offset += h.length;
  }
  const points = rings.flat(),
    indices = earcut(points.flat(), starts);
  for (let i = 0; i < indices.length; i += 3)
    f(
      role,
      indices.slice(i, i + 3).map((j) => at(points[j], y)),
      dir,
    );
}
function perimeter(P) {
  const ring = P.outline,
    orientation = Math.sign(
      ring.reduce((sum, [x, z], i) => {
        const b = ring[(i + 1) % ring.length];
        return sum + x * b[1] - z * b[0];
      }, 0),
    );
  return ring
    .map((a, i) => {
      const b = ring[(i + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      const normal = [(orientation * dz) / length, 0, (-orientation * dx) / length];
      return {
        a,
        b,
        length,
        normal,
        at: (t, y, d = 0) => [
          mix(a[0], b[0], t) + normal[0] * d,
          y,
          mix(a[1], b[1], t) + normal[2] * d,
        ],
      };
    })
    .filter((E) => E.length > 0.035);
}
function face(f, role, E, lo, hi, a = 0, b = 1, d = 0, tint = 1) {
  if (hi - lo > 0.001 && b - a > 0.0001)
    f(role, [E.at(a, lo, d), E.at(b, lo, d), E.at(b, hi, d), E.at(a, hi, d)], E.normal, tint);
}
function strip(f, role, a, b, w, tint = 1) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    d = Math.hypot(dx, dz);
  if (d < 0.001) return;
  const x = ((-dz / d) * w) / 2,
    z = ((dx / d) * w) / 2;
  f(
    role,
    [
      [a[0] + x, a[1], a[2] + z],
      [b[0] + x, b[1], b[2] + z],
      [b[0] - x, b[1], b[2] - z],
      [a[0] - x, a[1], a[2] - z],
    ],
    up,
    tint,
  );
}
function sample(knots, x) {
  const i = knots.findIndex((p) => p[0] >= x),
    b = knots[i < 0 ? knots.length - 1 : i],
    a = knots[Math.max(0, i < 0 ? knots.length - 2 : i - 1)];
  return a[0] === b[0] ? b[1] : mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}
const bar = (out, role, a, b, w, d = w) => beam(out, role, a, b, w, d, colors[role]);
const railY = (x) => sample(layout.railBed.profile, x);
const four = (x0, x1, y, z0, z1) => [
  [x0, y, z0],
  [x1, y, z0],
  [x1, y, z1],
  [x0, y, z1],
];

function curtain(f, E, lo, hi, tier, mode) {
  const glassRole = mode === 'west' ? 'blueGlass' : 'glass';
  face(f, glassRole, E, lo, hi);
  if (!tier || E.length < 5) return;
  const count = Math.ceil(E.length / (tier === 1 ? 15 : mode === 'hotel' ? 3.6 : 3.09));
  const floors =
    tier === 1 ? 4 : Math.max(3, Math.round((hi - lo) / (mode === 'hotel' ? 3.75 : 3.34)));
  for (let i = 1; i < count; i++) {
    const t = i / count,
      w = (tier === 1 ? 0.22 : 0.077) / E.length;
    face(f, mode === 'hotel' ? 'light' : 'steel', E, lo, hi, t - w, t + w, 0.053);
  }
  for (let i = 1; i < floors; i++) {
    const y = mix(lo, hi, i / floors),
      w = mode === 'hotel' ? (tier === 1 ? 0.38 : 0.52) : 0.11;
    face(f, mode === 'hotel' ? 'panel' : 'steel', E, y - w, y + w, 0, 1, 0.049, tone(i));
  }
  if (mode === 'hotel' && tier >= 2)
    for (let i = 0; i < count; i++)
      for (let j = 0; j < floors; j++) {
        if ((i * 7 + j * 11) % 9 > 2) continue;
        const t = (i + 0.5) / count,
          w = 0.29 / count,
          y = mix(lo, hi, (j + 0.52) / floors),
          h = ((hi - lo) / floors) * 0.27;
        face(f, 'dimGlass', E, y - h, y + h, t - w, t + w, 0.021, tone(i, j));
      }
}
function wings(f, tier) {
  for (const [parts, mode, top] of [
    [layout.wingWest, 'west', 40.2],
    [layout.wingEast, 'hotel', 38.12],
  ]) {
    for (const P of parts) {
      for (const E of perimeter(P)) {
        const exposed = Math.max(E.a[1], E.b[1]) < -13;
        if (!tier) {
          face(f, 'panel', E, exposed ? -4.15 : 3.65, 8.01);
          face(f, mode === 'west' ? 'blueGlass' : 'glass', E, 8.01, top - 0.03);
          continue;
        }
        if (exposed) face(f, 'foundation', E, -4.15, 4.7);
        else face(f, 'underside', E, 3.65, 5.62);
        face(f, 'panel', E, 4.7, 8.01);
        curtain(f, E, 8.01, top - 0.62, tier, mode);
        face(f, 'light', E, top - 0.62, top);
      }
      cap(f, 'roof', P, top - 0.05);
      cap(f, 'underside', P, 3.65, down);
    }
  }
  for (const [x, z, w, d, y] of [
    [-218, -33, 44, 21, 40.24],
    [-169, -27, 31, 21, 40.24],
    [102, -41, 43, 28, 38.18],
    [177, -25, 54, 23, 38.18],
  ]) {
    box(f, 'light', x, z, w, d, y, y + 0.38);
    if (tier >= 2 || (tier === 1 && w > 40)) {
      box(f, 'planter', x, z, w - 1.9, d - 2.1, y + 0.38, y + 0.54);
      if (tier >= 2)
        for (let i = 0; i < 4; i++)
          box(f, 'panel', x - w * 0.37 + 9 * i, z + 6, 3.0, 2.16, y + 0.41, y + 1.27);
    }
  }
  const eastLip = layout.outlines[layout.subsidiaryIds[0]];
  for (const P of eastLip) {
    cap(f, 'roof', P, 5.81);
    cap(f, 'underside', P, 5.3, down);
    for (const E of perimeter(P)) face(f, 'light', E, 5.3, 5.81);
  }
}

function apron(f, profile, outsideZ, insideZ, y, tier) {
  const points = tier ? profile : profile.filter((_, i) => i % 4 === 0);
  for (let i = 1; i < points.length; i++) {
    const [a, lo] = points[i - 1],
      [b, hi] = points[i];
    f(
      'floor',
      [
        [a, lo, outsideZ],
        [b, hi, outsideZ],
        [b, y, insideZ],
        [a, y, insideZ],
      ],
      up,
      tone(i),
    );
    f(
      'foundation',
      [
        [a, lo - 1.55, outsideZ],
        [b, hi - 1.55, outsideZ],
        [b, hi, outsideZ],
        [a, lo, outsideZ],
      ],
      [0, 0, Math.sign(outsideZ - insideZ)],
    );
  }
  for (const [i, [x, h]] of [points[0], points.at(-1)].entries())
    f(
      'foundation',
      [
        [x, h - 1.55, outsideZ],
        [x, y - 1.55, insideZ],
        [x, y, insideZ],
        [x, h, outsideZ],
      ],
      i ? east : west,
    );
}
function facetedSkylight(f, x, z, w, d, base, tier, i) {
  const a = [x - w / 2, base, z - d / 2],
    b = [x + w / 2, base, z - d / 2],
    c = [x + w / 2, base, z + d / 2],
    d0 = [x - w / 2, base, z + d / 2];
  const crest = [x + w * 0.11, base + w * 0.42, z + d * 0.16],
    shoulder = [x - w * 0.28, base + w * 0.26, z + d * 0.3];
  f('glass', [a, b, crest], north, tone(i));
  f('blueGlass', [b, c, crest], east, 0.96);
  f('glass', [c, d0, shoulder, crest], south, 1.14);
  f('blueGlass', [d0, a, crest, shoulder], west, 1.09);
  if (tier >= 2)
    for (const p of [a, b, c, d0]) {
      const q = between(p, crest, 0.5),
        r = between(p, shoulder, 0.5);
      strip(f, 'lightSteel', q, r, 0.19);
    }
}
function northEntrance(f, tier) {
  const N = layout.north,
    y = N.floor,
    z = N.portalZ,
    [a, b] = N.portal;
  apron(f, layout.northApronProfile, -120, -69.93, y, tier);
  for (const [lo, hi] of [
    [-14.2, a],
    [b, 75.35],
  ])
    f(
      'clear',
      [
        [lo, y, z],
        [hi, y, z],
        [hi, N.entranceTop, z],
        [lo, N.entranceTop, z],
      ],
      north,
    );
  box(f, 'light', 31.0, z - 0.39, 89.8, 1.68, N.entranceTop, N.entranceTop + 0.59);
  const columns = tier
    ? [-12.7, -1.6, 16.0, 31.2, 47.3, 65.85, 73.2]
    : [-12.7, -1.6, 31.2, 65.85, 73.2];
  for (const x of columns)
    box(f, 'panel', x, z + 0.11, x === 31.2 ? 0.8 : 1.24, 1.2, y, N.entranceTop + 0.04);
  // The west entrance terrace and the tall opening above its portico.
  for (const [x, w, h] of [
    [-78, 9.6, 40.8],
    [-52.4, 8.3, 40.8],
  ]) {
    box(f, 'panel', x, -80.4, w, 9.3, y, h);
    if (tier >= 2)
      for (let i = 0; i < 4; i++)
        box(f, 'dimGlass', x, -85.08, w * 0.52, 0.06, 27.7 + 2.65 * i, 28.85 + 2.65 * i);
  }
  box(f, 'light', -65.25, -80.4, 35.1, 9.3, 30.35, 40.8);
  box(f, 'panel', -51.5, -77.76, 61, 18.2, 4.42, 6.28);
  cap(f, 'underside', rect(-51.5, -77.76, 61, 18.2), 4.42, down);
  for (const [x, w] of [
    [-79, 6],
    [-41, 4.9],
    [-22.5, 4.4],
  ])
    box(f, 'panel', x, -83.7, w, 5.5, y, 4.52);
  for (const [i, x] of (tier ? [-70.7, -55.9, -39.3, -25.1] : [-64.9, -35.3]).entries())
    facetedSkylight(f, x, -77.95, 11.0, 12.5, 6.32, tier, i);
  for (const [i, x] of (tier
    ? [88, 99.8, 111.6, 123.4, 135.2, 147, 158.8]
    : [88, 111.6, 135.2, 158.8]
  ).entries())
    facetedSkylight(f, x, -79.4, 11.35, 14.75, 5.84, tier, i);
  if (tier) for (const S of layout.karasumaSheds) plazaShelter(f, S, tier);
}

function roofSection(x) {
  const A = layout.atrium,
    z = sample(A.sectionControls, x),
    b = A.back;
  return [
    [x, 4.83, z],
    [x, 16.45, z],
    [x, 26.42, z + 1.28],
    [x, 34.8, z + 6.25],
    [x, 41.98, mix(z, b, 0.44)],
    [x, A.peak, mix(z, b, 0.63)],
    [x, 42.84, mix(z, b, 0.83)],
    [x, 39.65, b],
  ];
}
function atriumCanopy(f, out, tier) {
  const A = layout.atrium;
  const cells = tier === 1 ? 8 : tier === 2 ? 17 : tier === 3 ? 39 : 47;
  const xs = [
    A.x0,
    -128,
    -82,
    -19,
    -5,
    A.x1,
    ...(tier ? Array.from({ length: cells - 1 }, (_, i) => mix(A.x0, A.x1, (i + 1) / cells)) : []),
  ]
    .sort((a, b) => a - b)
    .filter((x, i, arr) => !i || x - arr[i - 1] > 0.07);
  const shell = xs.map(roofSection);
  const inner = (p) => [p[0], p[1] - 0.83, p[2] + 0.54];
  for (let i = 1; i < shell.length; i++) {
    const a = shell[i - 1],
      b = shell[i],
      openWest = xs[i] <= -127.999;
    for (let j = 1; j < a.length; j++) {
      if (openWest && j >= 4) continue;
      const points = [a[j - 1], b[j - 1], b[j], a[j]];
      f(tier >= 2 ? 'clear' : 'blueGlass', points, j < 4 ? north : up, tone(i, j));
      if (tier >= 2) {
        bar(out, 'steel', inner(a[j - 1]), inner(b[j - 1]), tier >= 2 ? 0.21 : 0.14);
        if (j === a.length - 1) bar(out, 'steel', inner(a[j]), inner(b[j]), 0.21);
      }
      if (tier >= 2) {
        if (tier >= 3 || i % 2 === 0)
          bar(out, 'lightSteel', inner(b[j - 1]), inner(b[j]), 0.22, 0.24);
        if (tier >= 3 || i % 2 === 1) bar(out, 'steel', inner(a[j - 1]), inner(b[j]), 0.13, 0.12);
        if (tier >= 3) {
          const lift = (p) => [p[0], p[1] - 1.65, p[2] + 1.15];
          bar(out, 'steel', inner(b[j - 1]), inner(a[j]), 0.12, 0.11);
          bar(out, 'lightSteel', lift(a[j]), lift(b[j]), 0.16, 0.19);
          bar(out, 'steel', lift(a[j]), inner(b[j]), 0.12, 0.12);
          const row1 = between(a[j - 1], b[j - 1], 0.5),
            row2 = between(a[j], b[j], 0.5);
          bar(out, 'steel', inner(row1), inner(row2), 0.076, 0.087);
        }
      }
    }
  }
  if (tier === 1) {
    const ribs = [-128, -82, -19, -5, A.x1].map(roofSection);
    for (let i = 1; i < ribs.length; i++)
      for (const j of [0, 3, 5, 7])
        bar(out, 'steel', inner(ribs[i - 1][j]), inner(ribs[i][j]), 0.16);
    for (const rib of ribs)
      for (let j = 1; j < rib.length; j++)
        bar(out, 'lightSteel', inner(rib[j - 1]), inner(rib[j]), 0.22);
  }
  for (const [i, x] of [-139.7, -119, -97, -75, -53, -31, -10, 11, 33, 54, 73.6].entries()) {
    if (tier < 2 && i % 2) continue;
    const z = roofSection(x)[0][2],
      base = layout.north.floor;
    if (!tier) {
      box(f, 'panel', x, z + 1.13, 2.31, 2.17, base, 15.45);
      continue;
    }
    box(f, 'panel', x, z + 1.13, 2.65, 2.45, base, 5.2);
    const a = [x - 0.87, 5.16, z + 1.0],
      b = [x + 0.88, 5.16, z + 1.0],
      c = [x - 1.75, 15.44, z + 0.25],
      d = [x + 1.75, 15.44, z + 0.25];
    for (const [p, q] of tier === 1
      ? [
          [a, c],
          [b, d],
          [c, d],
        ]
      : [
          [a, c],
          [b, d],
          [c, d],
          [a, d],
          [b, c],
        ])
      bar(out, 'lightSteel', p, q, 0.32, 0.34);
  }
}

function stairs(f, out, tier) {
  const S = layout.stairs,
    steps = [12, 38, 86, S.treads, S.treads][tier],
    a = S.centerZ - S.width / 2,
    b = S.centerZ + S.width / 2;
  for (let i = 0; i < steps; i++) {
    const x = mix(S.start, S.end, i / steps),
      u = mix(S.start, S.end, (i + 1) / steps);
    const y = mix(S.bottom, S.top, i / steps),
      v = mix(S.bottom, S.top, (i + 1) / steps);
    f(
      'tread',
      [
        [x, v, a],
        [u, v, a],
        [u, v, b],
        [x, v, b],
      ],
      up,
      tone(i),
    );
    f(
      i % 8 === 0 ? 'shadow' : 'tread',
      [
        [x, y, a],
        [x, y, b],
        [x, v, b],
        [x, v, a],
      ],
      east,
    );
    if (tier >= 2 && i % 5 === 0)
      strip(
        f,
        'lightSteel',
        [x - 0.057, v + 0.011, a + 0.66],
        [x - 0.057, v + 0.011, b - 0.66],
        0.06,
        0.89,
      );
  }
  for (const z of [a, b])
    f(
      'panel',
      [
        [S.start, S.bottom - 0.48, z],
        [S.end, S.top - 0.7, z],
        [S.end, S.top, z],
        [S.start, S.bottom, z],
      ],
      z === a ? north : south,
    );
  box(f, 'floor', S.end - 5.1, S.centerZ, 10.2, 21.75, S.top - 0.54, S.top);
  box(f, 'floor', S.start + 5.5, S.centerZ, 11.2, 22.7, S.bottom - 0.63, S.bottom);
  if (tier) {
    for (const z of [a - 0.34, b + 0.34])
      bar(out, 'steel', [S.start, S.bottom + 0.98, z], [S.end, S.top + 0.98, z], 0.13, 0.14);
    for (const z of [a + 2.5, b - 2.5])
      if (tier >= 2)
        bar(
          out,
          'lightSteel',
          [S.start, S.bottom + 0.92, z],
          [S.end, S.top + 0.92, z],
          0.075,
          0.083,
        );
  }
  const z = b + 2.73,
    n = tier >= 2 ? 40 : 7;
  for (let i = 0; i < n; i++) {
    const x = mix(S.start, S.end, i / n),
      u = mix(S.start, S.end, (i + 1) / n);
    const h = mix(S.bottom, S.top, (i + 0.85) / n);
    f('dark', four(u, x, h, z - 1.22, z + 1.22), up);
  }
  if (tier)
    for (const s of [-1, 1])
      bar(
        out,
        'lightSteel',
        [S.start, S.bottom + 0.83, z + s * 1.31],
        [S.end, S.top + 0.83, z + s * 1.31],
        0.11,
        0.15,
      );
}
function skyway(f, out, tier) {
  const B = layout.skyway,
    span = B.x1 - B.x0;
  box(f, 'light', B.x0 + span / 2, B.z, span, B.width, B.y - 0.86, B.y);
  cap(f, 'underside', rect(B.x0 + span / 2, B.z, span, B.width), B.y - 0.86, down);
  for (const s of [-1, 1]) {
    const z = B.z + (s * B.width) / 2,
      normal = s > 0 ? south : north;
    f(
      tier >= 2 ? 'clear' : 'glass',
      [
        [B.x0, B.y, z],
        [B.x1, B.y, z],
        [B.x1, B.y + 1.32, z],
        [B.x0, B.y + 1.32, z],
      ],
      normal,
    );
    if (tier) bar(out, 'steel', [B.x0, B.y + 1.35, z], [B.x1, B.y + 1.35, z], 0.135, 0.17);
    if (tier >= 2)
      for (let x = B.x0 + 2; x < B.x1; x += tier === 2 ? 5.3 : 2.65)
        bar(out, 'steel', [x, B.y, z], [x, B.y + 1.32, z], 0.078, 0.083);
  }
  for (const x of tier >= 2 ? [-115, -83, -49, -15, 19, 51] : [-115, -49, 19]) {
    if (tier)
      for (const s of [-1, 1])
        bar(
          out,
          'lightSteel',
          [x, B.y - 0.3, B.z + s * 2.08],
          [x + 1.08, B.y + 7.2, B.z + s * 1.65],
          0.29,
          0.26,
        );
  }
}
function atriumInterior(f, out, tier) {
  const N = layout.north,
    z = -14.64;
  const floor =
    tier >= 2
      ? layout.northFloor
      : [rect(-36.08, -34.9075, 223.9, 40.955), rect(29.65, -62.6575, 91.9, 14.545)];
  for (const P of floor) cap(f, 'floor', P, N.floor);
  box(f, 'panel', -36.2, -8.25, 223.8, 11.65, N.floor, 39.72);
  for (const y of tier ? [4.9, 11.9, 19.65, 27.52, 35.1] : [4.9, 19.65]) {
    box(f, 'panel', -33.2, z - 1.9, 212.0, 4.38, y - 0.57, y);
    if (tier)
      f(
        'clear',
        [
          [-139.2, y, z - 4.12],
          [72.8, y, z - 4.12],
          [72.8, y + 1.1, z - 4.12],
          [-139.2, y + 1.1, z - 4.12],
        ],
        north,
      );
    if (tier >= 2)
      for (let i = 0; i < 19; i++) {
        const x = -132.4 + i * 10.96,
          w = 4.36;
        box(f, i % 4 === 0 ? 'light' : 'dimGlass', x, z - 0.13, w, 0.083, y + 0.86, y + 3.52);
        if (tier >= 3) box(f, 'light', x - w * 0.27, z - 0.197, 0.074, 0.069, y + 0.86, y + 3.52);
      }
  }
  if (tier) {
    const count = tier >= 2 ? 15 : 7;
    for (const [i, [x, r]] of [
      [0, [62.2, 7.6]],
      [1, [42.0, 6.2]],
      [2, [-34.8, 5.0]],
    ]) {
      const zc = -25.4 - i * 3.8,
        hi = i === 2 ? 5.15 : 11.89,
        points = [];
      for (let j = 0; j < count; j++) {
        const a = (Math.PI * 2 * j) / count;
        points.push([x + r * Math.cos(a), zc + r * 0.83 * Math.sin(a)]);
      }
      prism(f, i === 0 ? 'gold' : 'panel', { outline: points }, hi - 0.65, hi, true);
      if (tier >= 2)
        for (const E of perimeter({ outline: points })) face(f, 'clear', E, hi, hi + 1.02);
    }
  }
  if (tier >= 2) {
    for (const [z, x0, x1, y0, y1] of [
      [-36.5, -11.7, -31.05, N.floor, 5.2],
      [-40.1, -11.7, -31.05, N.floor, 5.2],
      [-24.3, 13.5, 35.1, N.floor, 4.9],
    ]) {
      const count = tier === 2 ? 9 : 25;
      for (let i = 0; i < count; i++) {
        const x = mix(x0, x1, i / count),
          u = mix(x0, x1, (i + 1) / count),
          h = mix(y0, y1, (i + 0.99) / count);
        f('dark', four(Math.min(x, u), Math.max(x, u), h, z - 1.17, z + 1.17), up);
      }
      for (const s of [-1, 1]) {
        const side = z + s * 1.24;
        f(
          'steel',
          [
            [x0, y0 - 0.27, side],
            [x1, y1 - 0.27, side],
            [x1, y1 + 0.24, side],
            [x0, y0 + 0.24, side],
          ],
          s > 0 ? south : north,
        );
        bar(out, 'lightSteel', [x0, y0 + 0.92, side], [x1, y1 + 0.92, side], 0.098, 0.1);
      }
    }
    box(f, 'floor', 35.1, -22.06, 5.8, 6.34, 4.43, 4.9);
    box(f, 'shadow', -35.7, -49.35, 6.15, 4.1, 5.18, 5.57);
    const f0 = [-35.7, 5.6, -49.35],
      f1 = [-36.5, 9.49, -49.1],
      f2 = [-34.2, 9.33, -49.66];
    bar(out, 'red', f0, f1, 0.37, 0.61);
    bar(out, 'red', f0, f2, 0.51, 0.46);
    bar(out, 'red', f1, [-34.55, 8.9, -50.08], 0.37, 0.46);
  }
}

function tracksAndSheds(f, tier) {
  const B = layout.railBed;
  f(
    'ballast',
    [
      [-248.5, railY(-248.5), -39],
      [-164, railY(-164), -39],
      [-164, railY(-164), B.z0],
      [-248.5, railY(-248.5), B.z0],
    ],
    up,
  );
  for (let i = 1; i < B.profile.length; i++) {
    const [a, y] = B.profile[i - 1],
      [b, h] = B.profile[i];
    f(
      'ballast',
      [
        [a, y, B.z0],
        [b, h, B.z0],
        [b, h, B.z1],
        [a, y, B.z1],
      ],
      up,
      tone(i),
    );
  }
  for (const z of [B.z0, B.z1]) {
    const normal = z === B.z0 ? north : south;
    for (let i = 1; i < B.profile.length; i++) {
      const [a, y] = B.profile[i - 1],
        [b, h] = B.profile[i];
      f(
        'foundation',
        [
          [a, y - 2.6, z],
          [b, h - 2.6, z],
          [b, h, z],
          [a, y, z],
        ],
        normal,
      );
    }
  }
  for (const [i, S] of layout.sheds.entries()) {
    if (tier === 0 && i > 3) continue;
    for (const P of S.parts) {
      const R = S.roof;
      const x0 = Math.min(...P.outline.map((p) => p[0])),
        x1 = Math.max(...P.outline.map((p) => p[0]));
      const z0 = Math.min(...P.outline.map((p) => p[1])),
        z1 = Math.max(...P.outline.map((p) => p[1]));
      const z = (z0 + z1) / 2,
        w = Math.max(1.9, (z1 - z0) * 0.59);
      const footprint = tier ? P : rect((x0 + x1) / 2, z, x1 - x0, z1 - z0);
      cap(f, 'roof', footprint, R);
      cap(f, 'underside', footprint, R - 0.41, down);
      for (const E of perimeter(footprint)) face(f, 'lightSteel', E, R - 0.41, R);
      if (tier)
        for (let x = x0 + 7; x < x1 - 6; x += tier >= 2 ? 19.5 : 64) {
          const low = railY(x) + 0.68;
          box(f, 'panel', x, z, 0.57, 0.68, low, R - 0.39);
          if (tier >= 2) box(f, 'dark', x + 0.88, z, 0.91, 1.22, low, low + 0.47);
        }
      if (tier)
        f(
          'floor',
          [
            [x0, railY(x0) + 0.66, z - w / 2],
            [x1, railY(x1) + 0.66, z - w / 2],
            [x1, railY(x1) + 0.66, z + w / 2],
            [x0, railY(x0) + 0.66, z + w / 2],
          ],
          up,
        );
    }
  }
  if (tier)
    for (const [i, T] of layout.rails.entries()) {
      const path =
        tier === 1 ? T.path.filter((_, j) => j % 2 === 0 || j === T.path.length - 1) : T.path;
      if (tier === 1 && Math.abs(path.at(-1)[0] - path[0][0]) < 42) continue;
      const gauge = T.high ? 0.7175 : 0.5335;
      const y = (x) => (T.high ? layout.elevated.y : railY(x)) + 0.145;
      for (let j = 1; j < path.length; j++) {
        const [a, z] = path[j - 1],
          [b, v] = path[j];
        const dx = b - a,
          dz = v - z,
          length = Math.hypot(dx, dz);
        if (length < 0.015) continue;
        const nx = -dz / length,
          nz = dx / length;
        for (const s of [-1, 1])
          strip(
            f,
            'rail',
            [a + nx * s * gauge, y(a), z + nz * s * gauge],
            [b + nx * s * gauge, y(b), v + nz * s * gauge],
            tier === 1 ? 0.14 : 0.086,
            1.03,
          );
        if (tier >= 2)
          for (let d = 1; d < length - 0.3; d += tier === 2 ? 16 : tier === 3 ? 4.2 : 3.1) {
            const t = d / length,
              x = mix(a, b, t),
              w = mix(z, v, t),
              h = y(x) - 0.095;
            strip(
              f,
              'shadow',
              [x + nx * 1.12, h, w + nz * 1.12],
              [x - nx * 1.12, h, w - nz * 1.12],
              0.2,
              tone(i, j),
            );
          }
      }
    }
  for (const P of layout.outlines[layout.crossingId]) {
    const top = 8.92;
    cap(f, 'roof', P, top);
    cap(f, 'underside', P, 4.02, down);
    for (const E of perimeter(P)) {
      face(f, 'light', E, 4.02, 5.35);
      curtain(f, E, 5.35, 8.54, tier, 'west');
      face(f, 'panel', E, 8.54, top);
    }
  }
}
function plazaShelter(f, S, tier) {
  for (const P of S.parts) {
    const xs = P.outline.map((p) => p[0]),
      zs = P.outline.map((p) => p[1]);
    const a = Math.min(...xs),
      b = Math.max(...xs),
      z = (Math.min(...zs) + Math.max(...zs)) / 2;
    if (tier < 2) {
      cap(f, 'roof', rect((a + b) / 2, z, b - a, Math.max(...zs) - Math.min(...zs)), S.roof);
      continue;
    }
    cap(f, 'roof', P, S.roof);
    cap(f, 'underside', P, S.roof - 0.22, down);
    for (const R of perimeter(P)) face(f, 'lightSteel', R, S.roof - 0.22, S.roof);
    for (let x = a + 2; x < b - 1; x += tier === 2 ? 23 : 7.2)
      box(f, 'steel', x, z, 0.22, 0.23, S.base - 0.4, S.roof - 0.19);
  }
}
function southTerminal(f, out, tier) {
  const E = layout.elevated,
    S = layout.south;
  box(f, 'foundation', (E.x0 + E.x1) / 2, (E.z0 + E.z1) / 2, E.x1 - E.x0, E.z1 - E.z0, 3.35, E.y);
  cap(
    f,
    'underside',
    rect((E.x0 + E.x1) / 2, (E.z0 + E.z1) / 2, E.x1 - E.x0, E.z1 - E.z0),
    3.35,
    down,
  );
  apron(f, layout.southApronProfile, 136.92, 123.31, S.floor, tier);
  for (const P of layout.hachijo) {
    cap(f, 'roof', P, 18.66);
    cap(f, 'underside', P, 18.18, down);
    for (const R of perimeter(P)) {
      const side = Math.abs(R.normal[2]) > 0.55;
      if (!tier) {
        face(f, 'panel', R, -1.35, 7.54);
        face(f, 'blueGlass', R, 7.54, 18.66);
        continue;
      }
      if (side) {
        face(f, 'panel', R, -1.35, 4.05);
        face(f, 'light', R, 4.05, 7.54);
        curtain(f, R, 7.54, 17.75, tier, 'west');
        if (tier)
          for (let y = 8.9; y < 17.6; y += tier === 1 ? 3.2 : 1.58)
            face(f, 'lightSteel', R, y - 0.05, y + 0.05, 0, 1, 0.13);
        if (tier >= 2 && R.length > 16)
          for (let x = 6; x < R.length - 3; x += 5.6) {
            const t = x / R.length,
              d = 1.78 / R.length;
            face(f, 'dimGlass', R, -0.36, 2.7, t - d, t + d, 0.057, tone(Math.round(x)));
          }
      }
      face(f, 'light', R, 17.74, 18.66);
    }
  }
  const sz = S.portalZ,
    base = S.floor,
    [pa, pb] = S.portal;
  for (const [a, b] of [
    [-153.5, pa],
    [pb, 247.96],
  ])
    f(
      'dimGlass',
      [
        [a, base, sz],
        [b, base, sz],
        [b, S.entranceTop, sz],
        [a, S.entranceTop, sz],
      ],
      south,
    );
  cap(f, 'floor', rect(47.8, 117.555, 84.3, 11.51), base);
  for (const x of tier >= 2
    ? [-145, -120, -95, -70, -44, -22, 4, 26, 60, 85, 110, 135, 161, 186, 212, 237]
    : tier === 1
      ? [-142, -95, -54, -18, 26, 60, 110, 161, 212]
      : [-142, -54, 26, 60, 186])
    box(f, 'foundation', x, sz - 0.54, 1.43, 1.72, base - 0.4, 4.36);
  box(f, 'light', 46.8, sz + 0.28, 83.8, 2.72, S.entranceTop, S.entranceTop + 0.47);
  if (tier >= 2) {
    const paint = (role, _ref, p, n) => {
      if (n[2] > 0.62)
        f(
          role,
          p.map(([x, y, z]) => [x + 46.0, y, z]),
          n,
        );
    };
    const name = 'KY0T0 STATI0N',
      width = 25.3,
      height = 0.89,
      y = 5.34,
      z = sz + 0.15;
    const letters = { addConvexPolygon: paint, addQuad: paint };
    lettering(letters, name, { width, height, y, z, stroke: 0.091, slot: 'lightSteel' });
    const advance = width / name.length,
      position = (u, v) => [(1 - name.length * 0.5 + u * 0.75) * advance, y + v * height, z];
    for (const p of [
      [0, 1],
      [1, 1],
      [0.5, 0],
    ])
      bar(letters, 'lightSteel', position(...p), position(0.5, 0.5), 0.091);
    for (let x = 31; x < 64; x += 6.85)
      box(f, 'lightSteel', x, sz + 0.65, 0.19, 1.36, S.entranceTop - 0.12, S.entranceTop - 0.045);
  }
  for (const P of layout.kintetsu) {
    cap(f, 'roof', P, 17.88);
    cap(f, 'underside', P, 5.7, down);
    for (const R of perimeter(P)) curtain(f, R, 5.7, 17.88, tier, 'hotel');
  }
  for (const P of tier ? layout.southConcourse : [rect(-24.9, 139.3, 57.3, 29.4)]) {
    cap(f, 'roof', P, 6.58);
    cap(f, 'underside', P, 5.92, down);
    for (const R of perimeter(P)) {
      face(f, 'panel', R, 5.92, 6.58);
      if (R.length > 3.0) face(f, 'glass', R, -1.61, 5.93);
    }
    cap(f, 'floor', P, base);
  }
  for (const S of tier ? layout.hachijoSheds : layout.hachijoSheds.slice(0, 1))
    plazaShelter(f, S, tier);
}

const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildKyotoLevel(out, level) {
  const tier = tiers[level],
    f = writer(out);
  wings(f, tier);
  northEntrance(f, tier);
  atriumCanopy(f, out, tier);
  atriumInterior(f, out, tier);
  stairs(f, out, tier);
  skyway(f, out, tier);
  tracksAndSheds(f, tier);
  southTerminal(f, out, tier);
}
export const buildKyotoSkyline = (out) => buildKyotoLevel(out, 'skyline');
export const buildKyotoDistrict = (out) => buildKyotoLevel(out, 'district');
export const buildKyotoStreet = (out) => buildKyotoLevel(out, 'street');
export const buildKyotoCloseup = (out) => buildKyotoLevel(out, 'closeup');
