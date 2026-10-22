/** Whole surviving stone amphitheatre: native perimeter/arena, open arcades and incomplete cavea. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sn/snr/amphitheatre_of_el_jem/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = { stone: rgb('c3ac83'), worn: rgb('a28d6e'), trim: rgb('d3bd98'), arena: rgb('a89a7b') },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
    worn: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 1, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
    arena: { slot: 'foundation', graph: 'earth_rammed', roughness: 1, metallic: 0 },
  },
  center = [0, 1].map(
    (k) => (Math.min(...p.arena.map((q) => q[k])) + Math.max(...p.arena.map((q) => q[k]))) / 2,
  );
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const normal = normalFor(...q),
    uv = Math.abs(normal[1]) > 0.7 ? q.map((v) => [v[0], v[2]]) : q.map((v) => [v[0] + v[2], v[1]]);
  o.addTriangle(s, ref, q, normal, uv, col);
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, rings, y) {
  const pts = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0)),
    ix = earcut(pts.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      [0, 1, 0],
    );
}
function ringBand(o, s, a, b, y0, y1) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      n = [(a[i][0] + a[j][0]) / 2 - center[0], 0, (a[i][1] + a[j][1]) / 2 - center[1]];
    Q(
      o,
      s,
      [
        [...a[i].slice(0, 1), y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [a[j][0], y1, a[j][1]],
        [a[i][0], y1, a[i][1]],
      ],
      n,
    );
    Q(
      o,
      s,
      [
        [b[j][0], y0, b[j][1]],
        [b[i][0], y0, b[i][1]],
        [b[i][0], y1, b[i][1]],
        [b[j][0], y1, b[j][1]],
      ],
      n.map((v) => -v),
    );
    Q(
      o,
      s,
      [
        [a[i][0], y1, a[i][1]],
        [a[j][0], y1, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ],
      [0, 1, 0],
    );
  }
}
/** Ray intersections retain the actual mapped offset arena and irregular outer envelope. */
function polar(ring, a) {
  const u = [Math.cos(a), Math.sin(a)];
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const q = ring[i],
      v = ring[(i + 1) % ring.length],
      e = [v[0] - q[0], v[1] - q[1]],
      w = [q[0] - center[0], q[1] - center[1]],
      det = u[0] * e[1] - u[1] * e[0];
    if (Math.abs(det) < 1e-10) continue;
    const t = (w[0] * e[1] - w[1] * e[0]) / det,
      s = (w[0] * u[1] - w[1] * u[0]) / det;
    if (t > 0 && s >= -1e-8 && s <= 1 + 1e-8) best = Math.min(best, t);
  }
  if (!Number.isFinite(best)) throw Error('Uncovered native perimeter ray');
  return [center[0] + u[0] * best, center[1] + u[1] * best];
}
function at(a, k) {
  const x = polar(p.arena, a),
    z = polar(p.outline, a);
  return [x[0] + (z[0] - x[0]) * k, x[1] + (z[1] - x[1]) * k];
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    sg =
      n[0] * ((a[0] + b[0]) / 2 - center[0]) + n[1] * ((a[1] + b[1]) / 2 - center[1]) < 0 ? -1 : 1;
  return {
    len,
    n: [n[0] * sg, 0, n[1] * sg],
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * sg * z, y, a[1] + u[1] * x + n[1] * sg * z],
  };
}
function archHole(x, y, w, h, steps) {
  const r = w / 2,
    spring = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI;
      return [x + r * Math.cos(a), spring + r * Math.sin(a)];
    }),
  ];
}
function panel(o, s, f, y0, y1, holes, depth, d) {
  const outline = [
      [0, y0],
      [f.len, y0],
      [f.len, y1],
      [0, y1],
    ],
    pts = [outline, ...holes].flat(),
    starts = holes.map(
      (_, i) => outline.length + holes.slice(0, i).reduce((a, r) => a + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (const z of [0, -depth])
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        s,
        ix.slice(i, i + 3).map((j) => f.P(...pts[j], z)),
        f.n.map((v) => (z === 0 ? v : -v)),
      );
  const rings = d === 0 ? [] : [outline, ...holes];
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      Q(o, s, [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)]);
    }
}
function voussoirs(o, f, x, y, w, h, steps) {
  const r = w / 2,
    spring = y + h - r;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI + 0.006,
      b = ((i + 1) / steps) * Math.PI - 0.006;
    Q(
      o,
      'trim',
      [
        f.P(x + r * Math.cos(a), spring + r * Math.sin(a), 0.045),
        f.P(x + (r + 0.36) * Math.cos(a), spring + (r + 0.36) * Math.sin(a), 0.045),
        f.P(x + (r + 0.36) * Math.cos(b), spring + (r + 0.36) * Math.sin(b), 0.045),
        f.P(x + r * Math.cos(b), spring + r * Math.sin(b), 0.045),
      ],
      f.n,
      i % 3 === 0 ? rgb('c2aa83') : C.trim,
    );
  }
}
function pilaster(o, f, x, y0, y1, d) {
  const sides = d === 3 ? 8 : 4,
    r = 0.31;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI,
      b = ((i + 1) / sides) * Math.PI;
    Q(o, 'trim', [
      f.P(x + r * Math.cos(a), y0, r * Math.sin(a) + 0.04),
      f.P(x + r * Math.cos(b), y0, r * Math.sin(b) + 0.04),
      f.P(x + r * Math.cos(b), y1, r * Math.sin(b) + 0.04),
      f.P(x + r * Math.cos(a), y1, r * Math.sin(a) + 0.04),
    ]);
  }
  for (const [y, w, h] of [
    [y0, 0.9, 0.3],
    [y1 - 0.3, 1.15, 0.3],
  ]) {
    if (d === 2)
      Q(
        o,
        'trim',
        [
          f.P(x - w / 2, y, 0.25),
          f.P(x + w / 2, y, 0.25),
          f.P(x + w / 2, y + h, 0.25),
          f.P(x - w / 2, y + h, 0.25),
        ],
        f.n,
      );
    else
      panel(
        o,
        'trim',
        { ...f, len: w, P: (a, b, z = 0) => f.P(x - w / 2 + a, b, z + 0.22) },
        y,
        y + h,
        [],
        0.25,
        1,
      );
  }
}
function crown(a) {
  const t = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
  if (t < 0.42) return 2.3;
  if (t < 0.68) return 10.4;
  if (t < 0.95) return 20.9;
  return 33.2 + 1.45 * Math.sin(a * 9) + 0.9 * Math.cos(a * 17);
}
function arcades(o, d) {
  const count = [8, 18, 64, 64][d],
    steps = [2, 3, 4, 8][d];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * tau,
      b = ((i + 1) / count) * tau,
      mid = (a + b) / 2,
      f = frame(at(a, 1), at(b, 1)),
      height = crown(mid),
      gap = Math.abs(Math.atan2(Math.sin(mid), Math.cos(mid))) < 0.42;
    for (let level = 0; level < 3; level++) {
      const y0 = level * 11 + 0.25,
        y1 = Math.min(level === 2 ? height : (level + 1) * 11 + 0.25, height);
      if (y1 - y0 < 0.5) continue;
      const w = Math.min(f.len * 0.65, d < 2 ? 13.2 : level === 0 ? 4.2 : 4.0),
        h = level === 0 ? 8.0 : 8.6,
        base = y0 + 0.15,
        hasArch = !gap && y1 > base + h + 0.2,
        holes = hasArch ? [archHole(f.len / 2, base, w, h, steps)] : [];
      panel(o, level === 2 ? 'worn' : 'stone', f, y0, y1, holes, d === 0 ? 0.6 : 2.1, d);
      if (d >= 2 && hasArch) {
        voussoirs(o, f, f.len / 2, base, w, h, d === 3 ? 9 : 3);
        pilaster(o, f, 0.12, y0 + 0.15, Math.min(y1, y0 + 8.7), d);
      }
      if (d >= 1 && level < 2 && height > y0 + 10.2)
        panel(
          o,
          'trim',
          { ...f, P: (x, y, z = 0) => f.P(x, y, z + 0.32) },
          y0 + 9.9,
          y0 + 10.6,
          [],
          0.42,
          d,
        );
      if (d === 3 && level === 2 && y1 > 31) {
        const top = y1 + 0.35;
        for (const [x0, x1] of [
          [0, f.len * 0.21],
          [f.len * 0.76, f.len],
        ])
          panel(
            o,
            'worn',
            { ...f, len: x1 - x0, P: (x, y, z = 0) => f.P(x + x0, y, z) },
            y1,
            top,
            [],
            1.8,
            1,
          );
      }
    }
  }
}
function podium(o, d) {
  const count = [8, 20, 48, 64][d],
    steps = [2, 3, 4, 8][d];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * tau,
      b = ((i + 1) / count) * tau,
      f = frame(at(a, 0), at(b, 0)),
      axis = Math.abs(Math.sin((a + b) / 2)) < 0.12,
      hole = archHole(
        f.len / 2,
        0.28,
        Math.min(f.len * 0.66, axis ? 5.5 : 1.45),
        axis ? 5.6 : 2.6,
        steps,
      ),
      top = axis ? 6.6 : 3.8;
    // Inward surface is the arena-side face; actual holes pass through the wall.
    f.n = f.n.map((v) => -v);
    const P = f.P;
    f.P = (x, y, z = 0) => P(x, y, -z);
    panel(o, 'stone', f, 0.2, top, [hole], 0.85, d);
  }
  // Original arena line, including its small irregular western indentation.
  const inset = p.arena.map((q) => [
    q[0] + (q[0] - center[0]) * 0.025,
    q[1] + (q[1] - center[1]) * 0.025,
  ]);
  ringBand(o, 'trim', inset, p.arena, 0, 0.2);
}
function cavea(o, d) {
  const count = [8, 16, 48, 64][d],
    rows = [3, 6, 14, 24][d];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * tau + 0.014,
      b = ((i + 1) / count) * tau - 0.014,
      mid = (a + b) / 2,
      solid = mid > 1.8 && mid < 3.4,
      axis = Math.abs(Math.sin(mid)) < 0.12;
    if (axis) continue;
    if (solid) {
      for (let j = 0; j < rows; j++) {
        const k0 = 0.04 + (j / rows) * 0.62,
          k1 = 0.04 + ((j + 1) / rows) * 0.62,
          y0 = 3.8 + (j / rows) * 17,
          y1 = 3.8 + ((j + 1) / rows) * 17,
          A = at(a, k0),
          B = at(b, k0),
          D = at(a, k1),
          E = at(b, k1);
        Q(o, 'trim', [
          [A[0], y0, A[1]],
          [B[0], y0, B[1]],
          [B[0], y1, B[1]],
          [A[0], y1, A[1]],
        ]);
        Q(
          o,
          'stone',
          [
            [A[0], y1, A[1]],
            [B[0], y1, B[1]],
            [E[0], y1, E[1]],
            [D[0], y1, D[1]],
          ],
          [0, 1, 0],
        );
      }
    } else if (d >= 1) {
      for (let j = 0; j < 3; j++) {
        const k0 = 0.08 + j * 0.23,
          k1 = k0 + 0.14,
          y = 5 + j * 7 + (i % 3) * 0.18,
          A = at(a, k0),
          B = at(b, k0),
          D = at(a, k1),
          E = at(b, k1);
        if (crown(mid) < y + 2) continue;
        Q(
          o,
          'worn',
          [
            [A[0], y, A[1]],
            [B[0], y, B[1]],
            [E[0], y, E[1]],
            [D[0], y, D[1]],
          ],
          [0, 1, 0],
        );
      }
    }
    if (i % [4, 3, 3, 2][d] === 0 && !solid) {
      // The exposed support walls rise with the cavea, never as full-height fins at the arena.
      for (let j = 0; j < (d === 0 ? 1 : 3); j++) {
        const k0 = d === 0 ? 0.04 : 0.04 + j * 0.27,
          k1 = d === 0 ? 0.84 : k0 + 0.27,
          A = at(a, k0),
          B = at(a, k1),
          f = frame(A, B),
          top = Math.min(crown(mid) - 1, d === 0 ? 8 : 5.8 + j * 7.2),
          holes =
            d >= 2 && top > 8.5
              ? [archHole(f.len / 2, 0.3, Math.min(4.8, f.len * 0.6), 6.8, d === 3 ? 6 : 3)]
              : [];
        if (top > 3) panel(o, 'worn', f, 0.2, top, holes, d === 0 ? 0.3 : 0.9, d);
      }
    }
  }
  if (d > 0)
    for (const [k, y0, y1] of [
      [0.3, 4, 11.5],
      [0.61, 12, 21.8],
    ]) {
      const n = d === 1 ? 8 : 32;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * tau,
          b = ((i + 1) / n) * tau,
          mid = (a + b) / 2;
        if (crown(mid) < y1 + 1 || (mid > 1.8 && mid < 3.4)) continue;
        const f = frame(at(a, k), at(b, k)),
          w = Math.min(f.len * 0.64, 3.5),
          h = y1 - y0 - 1.1;
        f.n = f.n.map((v) => -v);
        const P = f.P;
        f.P = (x, y, z = 0) => P(x, y, -z);
        panel(o, 'worn', f, y0, y1, [archHole(f.len / 2, y0 + 0.2, w, h, d === 3 ? 6 : 3)], 1.1, d);
      }
    }
}
function arena(o, d) {
  const z = center[1],
    x = center[0],
    trench = [
      [x - 24, z - 2.3],
      [x + 24, z - 2.3],
      [x + 24, z + 2.3],
      [x - 24, z + 2.3],
    ];
  cap(o, 'arena', [p.arena, trench], 0);
  cap(o, 'arena', [trench], -3.8);
  for (let i = 0; i < 4; i++) {
    const a = trench[i],
      b = trench[(i + 1) % 4];
    Q(o, 'stone', [
      [a[0], -3.8, a[1]],
      [b[0], -3.8, b[1]],
      [b[0], 0, b[1]],
      [a[0], 0, a[1]],
    ]);
  }
  // Two surviving narrow stone crossings above the exposed hypogeum slot.
  if (d > 0)
    for (const xx of [-14, 13]) {
      const a = [
        [x + xx - 0.65, z - 2.3],
        [x + xx + 0.65, z - 2.3],
        [x + xx + 0.65, z + 2.3],
        [x + xx - 0.65, z + 2.3],
      ];
      cap(o, 'stone', [a], 0.12);
    }
}
function build(o, _f, d = 3) {
  const inset = p.outline.map((q) => [
    q[0] + (center[0] - q[0]) * 0.014,
    q[1] + (center[1] - q[1]) * 0.014,
  ]);
  ringBand(o, 'worn', p.outline, inset, 0, 0.22);
  arcades(o, d);
  podium(o, d);
  cavea(o, d);
  arena(o, d);
}
export const elJemSkyline = (o, f) => build(o, f, 0);
export const elJemDistrict = (o, f) => build(o, f, 1);
export const elJemStreet = (o, f) => build(o, f, 2);
export const elJemCloseup = (o, f) => build(o, f, 3);
export const elJemModel = {
  id: 'amphitheatre_of_el_jem',
  key: 'amphitheatre_of_el_jem',
  cell: 'sn/snr',
  recipe: 'structure-amphitheatre-of-el-jem.mjs',
  title: 'Amphitheatre of El Jem',
  category: 'performance-sport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [210, 142, 245],
  lookAt: [0, 12, -5],
  portableGroundY: -4.1,
  mediumFiContext: { scale: 3.0, groundY: -4.1 },
  qaCameras: [
    {
      name: 'whole-three-tier-ruin-native-offset-arena',
      position: [180, 150, 215],
      lookAt: [0, 11, -4],
      reviewLod: 'skyline',
    },
    {
      name: 'western-surviving-arcades-and-broken-crowns',
      position: [-135, 45, 100],
      lookAt: [-30, 15, 8],
    },
    {
      name: 'open-arena-partial-cavea-radial-vaults-and-trench',
      position: [90, 105, 45],
      lookAt: [0, 11, -8],
    },
    {
      name: 'southern-three-storey-real-openings-and-columns',
      position: [-35, 38, 125],
      lookAt: [-18, 16, 16],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400m field frozen before geometry; footprint/approach grade and live host contact remain preview-only.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-amphitheatre-of-el-jem.mjs',
    level: 'skyline',
    export: 'elJemSkyline',
    errorMeters: 4.5,
    surfaces,
    authoredLevels: {
      district: { export: 'elJemDistrict', errorMeters: 2.2, surfaces },
      street: { export: 'elJemStreet', errorMeters: 0.6, surfaces },
      closeup: { export: 'elJemCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole surviving stone amphitheatre with genuine open arcades/arena and incomplete cavea; no ideal ancient roof, pristine full high cylinder or full restored seating. Detailed64bay cadence, skyline8/district18 simplified larger openings are deliberate distance approximations. Original28vertex outerbase and27vertex arenalip retained in allLODs; intermediate gallery/podium/seat partitions are photographic estimates.',
    'Four exact ownPD/CC0native originals by Noomen9, Newworldltd and Ridiculopathy individually inspected/nativeSHA1matched. Qualla-first16publishedfamilies reviewed; older Falbeprint/currency/attribution-license contemporaryphotos excluded. No copied photo/agencyimage/generatedbitmap/mesh used.',
    'Ruined eastern sector azimuth/step heights, individual arch/column/capital census, restoration/erosion contours and hidden vaults are bounded medium-fi interpretations from cleared ground photographs. Operator36mheight/64baycount/nominal147.9x122.2outer and64x39arena corroborate broadscale; exact native footprints are not stretched/recentered to these published ideal dimensions.',
    'Central visible hypogeum trench and two simple crossings are bounded exterior excavation cues, not a navigable complete underground survey. Natural ground, precinct/roads/buildings/vegetation/people/vehicles/cables and detached museum excluded. Intrinsic arena floor and stone footing bands do not include a whole-site base.',
    'Independent400m129x129terrain field acquired at fixed south approach before geometry, original values and source tile bytes retained. CompositeDEMmay include monument/urbanreturns or outliers; no terrain flattening/fitting or surveyed datum claim. Portable/shared/context use separate flat review stage; actual street-level/threshold/arena-floor contact and compatible host attachment unverified; geographic preview/replaceFootprint=false.',
  ],
};
