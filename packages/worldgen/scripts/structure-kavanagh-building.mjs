/** Kavanagh's complete mapped footprint, stepped Art Deco shaft and faceted window bays. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/69/69y/kavanagh_building/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters,
  tiers = A.upperTierPolygons,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('bfbeb0'),
    trim: rgb('d0cfc1'),
    roof: rgb('aaa99a'),
    glass: rgb('526766'),
    metal: rgb('6c746c'),
    door: rgb('424a45'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.94, metallic: 0 },
    trim: { slot: 'trim', graph: 'stucco', roughness: 0.92, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.3, metallic: 0.15 },
    metal: { slot: 'foundation', graph: 'metal_painted', roughness: 0.8, metallic: 0.4 },
    door: { slot: 'door', localRef: 'palette:#fffffd', roughness: 0.72, metallic: 0.1 },
  },
  sub = (a, b) => a.map((x, k) => x - b[k]),
  tint = (c, s) => c.map((v) => Math.min(1, v * s));
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function ccw(P) {
  const area = P.reduce(
    (a, v, i) => a + v[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * v[1],
    0,
  );
  return area > 0 ? P : P.toReversed();
}
function inside(P, x, z) {
  let b = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i],
      q = P[j];
    if (a[1] > z !== q[1] > z && x < ((q[0] - a[0]) * (z - a[1])) / (q[1] - a[1]) + a[0]) b = !b;
  }
  return b;
}
function faces(P) {
  P = ccw(P);
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      w = Math.hypot(dx, dz);
    return { a, b, w, u: [dx / w, dz / w], n: [dz / w, 0, -dx / w] };
  }).filter((f) => f.w > 0.01);
}
function point(f, u, y, depth = 0) {
  return [f.a[0] + f.u[0] * u + f.n[0] * depth, y, f.a[1] + f.u[1] * u + f.n[2] * depth];
}
const rect = (u, y, w, h) => [
  [u - w / 2, y],
  [u + w / 2, y],
  [u + w / 2, y + h],
  [u - w / 2, y + h],
];
function panel(o, s, f, P, depth = 0, col = C[s]) {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => point(f, ...P[k], depth)),
      f.n,
      col,
    );
}
function fbox(o, s, f, u, y, w, h, depth, col = C[s], offset = 0) {
  const R = rect(u, y, w, h),
    a = R.map((v) => point(f, ...v, offset)),
    b = R.map((v) => point(f, ...v, offset + depth));
  Q(o, s, b, f.n, col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], null, col);
  }
}
function cap(o, P, y, s = 'roof') {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [P[k][0], y, P[k][1]]),
      [0, 1, 0],
    );
}
function windows(f, tier, d) {
  const height = tier.top - tier.bottom,
    crown = tier.bottom >= 111,
    rows = crown ? 1 : Math.max(1, Math.floor((height - 1.1) / [12, 6.5, 4.7, 3.45][d])),
    cols = Math.max(1, Math.floor(f.w / (crown ? [5, 3.5, 2.9, 2.8][d] : [10, 5.3, 4.8, 3.25][d]))),
    out = [];
  if (f.w < 1.7) return out;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const u = ((col + 0.5) * f.w) / cols,
        h = crown ? Math.min(height - 1.3, 3.6) : [2.1, 2.0, 1.9, 1.95][d],
        y = tier.bottom + ((row + 0.5) * height) / rows - h / 2,
        w = crown
          ? Math.min(0.8, (f.w / cols) * 0.45)
          : Math.min(d === 0 ? 2.5 : 1.7, (f.w / cols) * 0.62);
      out.push({ u, y, w, h, row, col });
    }
  return out;
}
function facade(o, f, tier, d, i) {
  const top = tier.top - (i === tiers.length - 1 ? 0.65 : 0),
    F = { ...tier, top },
    entries =
      i === 0 && f.w > 50 && f.n[2] < -0.9
        ? [18, 42].map((u) => ({ u, y: A.floorY + 0.06, w: 2.25, h: 3.29, entry: true }))
        : [],
    W = windows(f, F, d).filter(
      (w) =>
        !entries.some((e) => Math.abs(w.u - e.u) < (w.w + e.w) / 2 + 0.2 && w.y < e.y + e.h + 0.1),
    ),
    openings = [...W, ...entries],
    wallCol = tint(C.wall, 0.985 + (i % 3) * 0.012);
  if (d < 2) {
    panel(
      o,
      'wall',
      f,
      [
        [0, tier.bottom],
        [f.w, tier.bottom],
        [f.w, top],
        [0, top],
      ],
      0,
      wallCol,
    );
  } else {
    const outer = [
        [0, tier.bottom],
        [f.w, tier.bottom],
        [f.w, top],
        [0, top],
      ],
      holes = openings.map((w) => rect(w.u, w.y, w.w, w.h)),
      flat = [...outer, ...holes.flat()],
      starts = holes.map((_, k) => 4 + k * 4),
      ids = earcut(flat.flat(), starts);
    for (let k = 0; k < ids.length; k += 3)
      T(
        o,
        'wall',
        ids.slice(k, k + 3).map((n) => point(f, ...flat[n])),
        f.n,
        wallCol,
      );
  }
  for (const w of openings) {
    const R = rect(w.u, w.y, w.w, w.h),
      depth = d > 1 ? -0.2 : 0.012,
      col = w.entry ? C.door : tint(C.glass, 0.84 + ((w.row * 7 + w.col * 3 + i) % 6) * 0.045);
    panel(o, w.entry ? 'door' : 'glass', f, R, depth, col);
    if (d > 1)
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        Q(
          o,
          'trim',
          [
            point(f, ...R[k]),
            point(f, ...R[j]),
            point(f, ...R[j], depth),
            point(f, ...R[k], depth),
          ],
          null,
          tint(C.trim, 0.88),
        );
      }
    if (d > 0) {
      panel(o, 'trim', f, rect(w.u, w.y, w.w + 0.12, 0.07), 0.024);
      if (d > 1) {
        panel(o, 'metal', f, rect(w.u, w.y + 0.05, 0.045, w.h - 0.1), -0.13);
        if (d === 3) {
          for (const side of [-1, 1])
            panel(o, 'trim', f, rect(w.u + (side * w.w) / 2, w.y, 0.065, w.h), 0.022);
          panel(o, 'trim', f, rect(w.u, w.y + w.h - 0.06, w.w, 0.065), 0.022);
          panel(o, 'metal', f, rect(w.u, w.y + w.h * 0.47, w.w, 0.035), -0.13);
          fbox(o, 'trim', f, w.u, w.y - 0.07, w.w + 0.22, 0.09, 0.16);
        }
      }
    }
    if (w.entry && d > 0) {
      for (const side of [-1, 1])
        fbox(o, 'trim', f, w.u + side * (w.w / 2 + 0.17), A.floorY, 0.25, w.h + 0.25, 0.18);
      fbox(o, 'trim', f, w.u, A.floorY + w.h, w.w + 0.6, 0.23, 0.24);
      panel(o, 'metal', f, rect(w.u, A.floorY + 0.2, 0.07, w.h - 0.4), 0.035);
      if (d > 1) fbox(o, 'roof', f, w.u, A.floorY - 0.1, w.w + 0.6, 0.1, 0.85);
    }
  }
  // Continuous shallow vertical piers, with grouped sash bays between them.
  if (d > 0 && f.w > 3.5) {
    const count = Math.max(1, Math.floor(f.w / (d === 1 ? 8 : 6.5)));
    for (let k = 0; k <= count; k++) {
      const u = 0.2 + (k * (f.w - 0.4)) / count;
      if (d === 1) panel(o, 'trim', f, rect(u, tier.bottom, 0.15, top - tier.bottom), 0.028);
      else fbox(o, 'trim', f, u, tier.bottom, 0.15, top - tier.bottom, 0.1);
    }
  }
  if (d === 3 && i < 5 && f.w > 8) {
    const n = Math.max(1, Math.floor((tier.top - tier.bottom) / 13));
    for (let k = 0; k < n; k++) {
      const u = Math.min(f.w - 0.8, f.w * 0.35 + (k % 2) * f.w * 0.3),
        y = tier.bottom + 3.2 + k * 10;
      if (y + 0.55 >= top) continue;
      fbox(o, 'trim', f, u, y, 0.72, 0.48, 0.34, tint(C.trim, 0.89));
      for (let j = 0; j < 3; j++)
        panel(o, 'metal', f, rect(u, y + 0.08 + j * 0.11, 0.54, 0.025), 0.345);
    }
  }
}
function roofAndParapets(o, tier, next, d, i) {
  const y = tier.top - (i === tiers.length - 1 ? 0.65 : 0);
  cap(o, tier.outline, y);
  if (d === 0) return;
  for (const f of faces(tier.outline)) {
    const N = Math.max(1, Math.ceil(f.w / 3.2));
    for (let k = 0; k < N; k++) {
      const u = ((k + 0.5) * f.w) / N,
        q = point(f, u, 0, -0.12);
      if (next && inside(next.outline, q[0], q[2])) continue;
      const w = f.w / N + 0.015,
        h = i === tiers.length - 1 ? 0.65 : 0.72;
      if (d === 1) panel(o, 'trim', f, rect(u, y, w, h), -0.1);
      else fbox(o, 'trim', f, u, y, w, h, 0.2, C.trim, -0.2);
    }
  }
}
function box(o, s, x, y, z, w, h, l) {
  const P = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  for (const f of faces(P))
    panel(o, s, f, [
      [0, y],
      [f.w, y],
      [f.w, y + h],
      [0, y + h],
    ]);
  cap(o, P, y + h, s);
}
function build(o, _frame, d = 3) {
  const base = tiers[0];
  for (const f of faces(base.outline))
    panel(
      o,
      'roof',
      f,
      [
        [0, A.plinthBottomY],
        [f.w, A.plinthBottomY],
        [f.w, A.floorY],
        [0, A.floorY],
      ],
      0.015,
    );
  tiers.forEach((tier, i) => {
    for (const f of faces(tier.outline)) facade(o, f, tier, d, i);
    roofAndParapets(o, tier, tiers[i + 1], d, i);
  });
  // Only the small original building-top poles; neighboring broadcast towers are excluded.
  const f = faces(tiers.at(-1).outline)[0],
    center = tiers
      .at(-1)
      .outline.reduce(
        (a, v) => [
          a[0] + v[0] / tiers.at(-1).outline.length,
          a[1] + v[1] / tiers.at(-1).outline.length,
        ],
        [0, 0],
      );
  box(o, 'metal', center[0], 119.4, center[1], d === 0 ? 0.14 : 0.085, 5, d === 0 ? 0.14 : 0.085);
  if (d > 0)
    for (const [x, z] of [
      [center[0] - 2, center[1] + 0.3],
      [center[0] + 2, center[1] - 0.4],
    ])
      box(o, 'metal', x, 119.4, z, 0.07, 2.4, 0.07);
  if (d > 1) {
    fbox(o, 'metal', f, f.w * 0.5, 119.8, Math.min(1.5, f.w * 0.6), 0.08, 0.07);
    for (const t of [tiers[1], tiers[2]]) {
      const r = t.outline.reduce(
        (a, v) => [a[0] + v[0] / t.outline.length, a[1] + v[1] / t.outline.length],
        [0, 0],
      );
      if (!inside(tiers[tiers.indexOf(t) + 1].outline, r[0] - 5, r[1] + 2))
        box(o, 'trim', r[0] - 5, t.top, r[1] + 2, 1.8, 0.8, 1.3);
    }
  }
}
export const kavanaghSkyline = (o, f) => build(o, f, 0),
  kavanaghDistrict = (o, f) => build(o, f, 1),
  kavanaghStreet = (o, f) => build(o, f, 2),
  kavanaghCloseup = (o, f) => build(o, f, 3);
export const kavanaghModel = {
  id: 'kavanagh_building',
  key: 'kavanagh_building',
  cell: '69/69y',
  recipe: 'structure-kavanagh-building.mjs',
  title: 'Kavanagh Building',
  category: 'building',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [170, 110, -165],
  lookAt: [0, 58, 3],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  qaCameras: [
    {
      name: 'whole-plaza-side-faceted-tower-and-stepped-low-wings',
      position: [170, 110, -165],
      lookAt: [0, 58, 3],
    },
    {
      name: 'opposite-rear-entire-native-envelope-and-hidden-estimated-setbacks',
      position: [-155, 100, 150],
      lookAt: [0, 54, 3],
    },
    {
      name: 'long-street-front-full-height-ribbed-bays',
      position: [-10, 64, -160],
      lookAt: [-3, 60, -5],
    },
    {
      name: 'high-terrace-faceted-shaft-and-zigzag-parapet-crown',
      position: [65, 112, -54],
      lookAt: [18, 104, -2],
    },
    {
      name: 'recessed-sash-reveals-vertical-piers-and-small-service-units',
      position: [20, 52, -30],
      lookAt: [12, 52, -12.5],
    },
    {
      name: 'stepped-roof-terraces-low-wing-and-whole-native-back-line',
      position: [-65, 90, 75],
      lookAt: [-2, 43, 7],
    },
    {
      name: 'street-entrances-plinth-and-lower-window-bays',
      position: [-8, 5, -31],
      lookAt: [-10, 4, -12.5],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-kavanagh-building.mjs',
    level: 'skyline',
    export: 'kavanaghSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'kavanaghDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'kavanaghStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'kavanaghCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Complete actual11-corner ground envelope, low wings, stepped shoulders/main faceted shaft and crown, roof terraces/parapets, vertical stucco piers, grouped rectangular sash windows, bounded ground entries and original small top poles. Neighbor buildings/hotel/basilica/plaza/street/city broadcast masts/trees/birds/construction fence/text/people/interiors/roof vegetation excluded.',
    'One exact cleared2011 HermannLuyken own-photo/selfCC0 Qualla original controls cream-gray facade, staggered skyline, faceted corner bays and vertical rib/sash character. Photographer and architect credits retain their actual meanings. Mixed-license Rojas image/unknown-author historic photos not used, no questionable source or external photo fetch, photographic texture or borrowed model.',
    'Actual ground footprint and120m native/municipal whole-height control retained. Upper tier planes/heights/window/floor census/hidden rear plan/ground doors/cosmetics/air-conditioners/antenna configuration are bounded original medium-fi estimates, not surveyed separate roof parts or a claim that conflicting30/31/33floor counts agree. Fine bays vary by LOD without changing whole extent or stepped crown.',
    'Six actual canonical material slots: stucco wall/trim, concrete roof/plinth, painted metal window mullions/poles and opaque locally colored glass/doors. Three shared graphs plus two local accents. Near levels have true recessed window apertures/reveals/sash mullions/sills and small service units; no transparent interior or active illumination.',
    'Original16641 independently sampled field/raw tile/PNG frozen before geometry and retained unchanged. Urban terrain artifacts partly cover low wings/thresholds in source views; no fitting/flattening/reacquisition or surrounding ground pad. Approximate geographic preview and replacementfalse; exact host contact unverified.',
  ],
};
