/** Whole Jerusalem citadel: exact outer/courtyard plan, keeps, galleries and minaret. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sv/sv9/tower_of_david/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = {
    wall: rgb('b9ad91'),
    trim: rgb('c8bda5'),
    old: rgb('a69679'),
    metal: rgb('4a4b43'),
    dark: rgb('383a31'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.98, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.97, metallic: 0 },
    old: { slot: 'wall', graph: 'stone_drywall', roughness: 0.99, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.15 },
    dark: { slot: 'door', localRef: ref, roughness: 0.96, metallic: 0 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => (Math.abs(nn[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
const area = (r) =>
    r.reduce((s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0),
  ccw = (r) => (area(r) > 0 ? r : [...r].reverse());
function cap(o, s, rings, y, up = true) {
  const pts = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((a, r) => a + r.length, 0)),
    ix = earcut(pts.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [pts[k][0], y, pts[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function frame(a, b, inward = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = inward ? [-u[1], u[0]] : [u[1], -u[0]];
  return {
    len,
    u,
    n: [n[0], 0, n[1]],
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
function prism(o, s, r, y0, y1) {
  cap(o, s, [r], y0, false);
  cap(o, s, [r], y1);
  r = ccw(r);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    Q(o, s, [f.P(0, y0), f.P(f.len, y0), f.P(f.len, y1), f.P(0, y1)], f.n);
  }
}
function box(o, s, x, y, z, w, h, l) {
  prism(
    o,
    s,
    [
      [x - w / 2, z - l / 2],
      [x + w / 2, z - l / 2],
      [x + w / 2, z + l / 2],
      [x - w / 2, z + l / 2],
    ],
    y,
    y + h,
  );
}
function strip(o, s, f, x, y, w, h, z = 0, col = C[s]) {
  Q(
    o,
    s,
    [
      f.P(x - w / 2, y, z),
      f.P(x + w / 2, y, z),
      f.P(x + w / 2, y + h, z),
      f.P(x - w / 2, y + h, z),
    ],
    f.n,
    col,
  );
}
function segment(o, s, f, x0, x1, y0, y1, depth = 1, z = 0) {
  prism(
    o,
    s,
    [
      [f.P(x0, y0, z)[0], f.P(x0, y0, z)[2]],
      [f.P(x1, y0, z)[0], f.P(x1, y0, z)[2]],
      [f.P(x1, y0, z - depth)[0], f.P(x1, y0, z - depth)[2]],
      [f.P(x0, y0, z - depth)[0], f.P(x0, y0, z - depth)[2]],
    ],
    y0,
    y1,
  );
}
function pointed(x, y, w, h, d) {
  const r = w / 2,
    s = y + h - w * 0.62,
    steps = d === 3 ? 6 : 3,
    pts = [
      [x - r, y],
      [x + r, y],
      [x + r, s],
    ];
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    pts.push([x + r * (1 - t), s + (y + h - s) * Math.sin((t * Math.PI) / 2)]);
  }
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    pts.push([x - r * t, s + (y + h - s) * Math.cos((t * Math.PI) / 2)]);
  }
  return pts;
}
function facade(o, f, y0, y1, holes, d, s = 'wall', depth = 0.9) {
  const rect = [
      [0, y0],
      [f.len, y0],
      [f.len, y1],
      [0, y1],
    ],
    pts = [rect, ...holes].flat(),
    ix = earcut(
      pts.flat(),
      holes.map((_, i) => 4 + holes.slice(0, i).reduce((a, h) => a + h.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...pts[k])),
      f.n,
    );
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length];
      Q(o, 'trim', [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)]);
    }
    if (d === 0) continue;
    const inds = earcut(h.flat());
    for (let i = 0; i < inds.length; i += 3)
      T(
        o,
        'dark',
        inds.slice(i, i + 3).map((k) => f.P(...h[k], -depth)),
        f.n,
      );
  }
}
function crenels(o, f, y, d, tower = false) {
  if (d === 0) {
    if (tower && y >= 25) {
      const n = Math.max(2, Math.round(f.len / 7));
      for (let i = 0; i < n; i++)
        segment(o, 'wall', f, ((i + 0.12) * f.len) / n, ((i + 0.68) * f.len) / n, y, y + 1.3, 0.8);
    }
    return;
  }
  const n = Math.max(1, Math.round(f.len / (d === 1 ? 5.5 : 3.5)));
  segment(o, 'wall', f, 0, f.len, y, y + 0.6, 0.9);
  for (let i = 0; i < n; i++)
    segment(
      o,
      'wall',
      f,
      ((i + 0.08) * f.len) / n,
      ((i + 0.66) * f.len) / n,
      y + 0.6,
      y + 1.9,
      0.9,
    );
}
function masonry(o, f, y0, y1, d, s = 'wall') {
  if (d < 2) return;
  const ch = d === 3 ? 0.82 : 1.4,
    w = d === 3 ? 1.65 : 3.5;
  for (let j = 0, y = y0 + 0.12; y < y1 - 0.3; j++, y += ch) {
    strip(
      o,
      s,
      f,
      f.len / 2,
      y,
      f.len,
      0.035,
      0.016,
      C[s].map((v) => v * 0.82),
    );
    const n = Math.ceil(f.len / w);
    for (let i = 0; i < n; i++) {
      const x = (i + (j % 2) * 0.5) * w;
      if (x > 0.1 && x < f.len - 0.1)
        strip(
          o,
          s,
          f,
          x,
          y,
          0.035,
          Math.min(ch, y1 - y),
          0.018,
          C[s].map((v) => v * 0.84),
        );
    }
  }
}
function curtain(o, d) {
  const out = ccw(p.outline),
    hole = ccw(p.holes[0]);
  cap(o, 'wall', [out, hole], 0, false);
  cap(o, 'trim', [out, hole], 12);
  for (let i = 0; i < out.length; i++) {
    const f = frame(out[i], out[(i + 1) % out.length]),
      holes = [];
    if (d > 1 && f.len > 7)
      for (let x = 3.5; x < f.len - 1.8; x += d === 1 ? 12 : 7.5)
        holes.push([
          [x - 0.28, 8.6],
          [x + 0.28, 8.6],
          [x + 0.28, 9.7],
          [x - 0.28, 9.7],
        ]);
    facade(o, f, 0, 12, holes, d);
    crenels(o, f, 12, d);
    if (d > 0) {
      const lo = [f.P(0, 0, 2.5), f.P(f.len, 0, 2.5), f.P(f.len, 4), f.P(0, 4)];
      Q(o, 'old', lo, f.n);
      masonry(o, f, 4, 8, d);
    } else Q(o, 'old', [f.P(0, 0, 1.8), f.P(f.len, 0, 1.8), f.P(f.len, 4), f.P(0, 4)], f.n);
  }
  for (let i = 0; i < hole.length; i++) {
    const f = frame(hole[i], hole[(i + 1) % hole.length], true),
      holes = [];
    if (f.len > 7) {
      const n = Math.max(1, Math.round(f.len / (d === 0 ? 15 : 6.8)));
      for (let k = 0; k < n; k++) {
        const x = ((k + 0.5) * f.len) / n,
          w = Math.min(3.8, (f.len / n) * 0.65);
        if (d <= 1) strip(o, 'dark', f, x, 5.2, w, 4.3, 0.02);
        else holes.push(pointed(x, 4.7, w, 4.7, d));
        if (d >= 2 && k % 2 === 0) holes.push(pointed(x, 0.8, 1.7, 2.6, d));
      }
    }
    facade(o, f, 0, 12, holes, d, 'wall', 1.3);
    if (d >= 2) {
      strip(o, 'trim', f, f.len / 2, 10.1, f.len, 0.25, 0.14);
      strip(o, 'trim', f, f.len / 2, 3.9, f.len, 0.25, 0.12);
      for (let x = 0.5; x < f.len; x += d === 3 ? 0.95 : 2)
        beam(o, 'metal', f.P(x, 10.4, 0.15), f.P(x, 11.1, 0.15), 0.055, 0.065, C.metal);
      beam(o, 'metal', f.P(0, 11.1, 0.15), f.P(f.len, 11.1, 0.15), 0.07, 0.07, C.metal);
    }
  }
}
function tower(o, r, base, top, d) {
  r = ccw(r);
  cap(o, 'trim', [r], top);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]),
      holes = [];
    if (d > 0 && f.len > 4) {
      const n = Math.max(1, Math.floor(f.len / 8));
      for (let k = 0; k < n; k++) {
        const x = ((k + 0.5) * f.len) / n;
        holes.push([
          [x - 0.35, top - 4],
          [x + 0.35, top - 4],
          [x + 0.35, top - 2.8],
          [x - 0.35, top - 2.8],
        ]);
        if (d >= 2) holes.push(pointed(x, base + 1.4, 1.8, 2.8, d));
      }
    }
    facade(o, f, base, top, holes, d);
    crenels(o, f, top, d, true);
    masonry(o, f, base, top - 4, d);
  }
}
function radial(o, s, cx, cz, levels, n) {
  for (let j = 0; j < levels.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = (tau * i) / n,
        b = (tau * (i + 1)) / n,
        [y0, r0] = levels[j],
        [y1, r1] = levels[j + 1];
      Q(o, s, [
        [cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0],
        [cx + Math.cos(b) * r0, y0, cz + Math.sin(b) * r0],
        [cx + Math.cos(b) * r1, y1, cz + Math.sin(b) * r1],
        [cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1],
      ]);
    }
}
function minaret(o, d) {
  const [x, z] = p.minaret,
    n = [6, 10, 16, 24][d];
  radial(
    o,
    'wall',
    x,
    z,
    [
      [16, 2.7],
      [18.4, 2.05],
      [31.1, 1.9],
      [31.3, 2.3],
      [32.6, 2.3],
      [32.8, 1.4],
      [34.8, 1.4],
      [36.5, 0],
    ],
    n,
  );
  if (d >= 1)
    for (const y of [20.3, 23.3, 26.3, 29.3])
      radial(
        o,
        'metal',
        x,
        z,
        [
          [y, 2.02],
          [y + 0.12, 2.02],
        ],
        n,
      );
  if (d >= 2) {
    radial(
      o,
      'metal',
      x,
      z,
      [
        [33.5, 2.32],
        [33.57, 2.32],
      ],
      n,
    );
    for (let i = 0; i < n; i++) {
      const a = (tau * i) / n;
      beam(
        o,
        'metal',
        [x + 2.3 * Math.cos(a), 32.7, z + 2.3 * Math.sin(a)],
        [x + 2.3 * Math.cos(a), 33.5, z + 2.3 * Math.sin(a)],
        0.06,
        0.06,
        C.metal,
      );
    }
    for (const y of [21.6, 27.9]) {
      const f = frame([x - 0.45, z + 1.92], [x + 0.45, z + 1.92]);
      strip(o, 'dark', f, 0.45, y, 0.38, 0.8, 0.02);
    }
    if (d === 3)
      for (let j = 0; j < 15; j++) {
        const y = 18.7 + j * 0.78;
        radial(
          o,
          'trim',
          x,
          z,
          [
            [y, 2.01],
            [y + 0.035, 2.01],
          ],
          n,
        );
      }
  }
  beam(o, 'metal', [x, 36.5, z], [x, 37.5, z], 0.11, 0.11, C.metal);
}
function ruins(o, d) {
  if (d === 0) {
    const c = [-1, -17],
      n = 8;
    radial(
      o,
      'old',
      ...c,
      [
        [0, 5],
        [2, 5],
      ],
      n,
    );
    radial(
      o,
      'old',
      ...c,
      [
        [2, 4.1],
        [0, 4.1],
      ],
      n,
    );
    return;
  }
  const fragments = [
    [-9, -22, 11, 2.4, 0.8],
    [-8, -6, 14, 1.6, 0.9],
    [4, -4, 18, 1.1, 0.7],
    [5, 9, 9, 1.3, 0.7],
  ];
  for (const [x, z, w, h, t] of fragments) {
    box(o, 'old', x, 0, z, w, h, t);
    if (d >= 2)
      for (let k = 0; k < Math.floor(w / 1.3); k++)
        box(o, 'old', x - w / 2 + (k + 0.5) * 1.3, h, z, 1.1, (k % 3) * 0.15 + 0.12, t * 0.9);
  }
  for (const [x, z, l] of [
    [-11, -15, 13],
    [-1, -1, 21],
    [12, -4, 18],
    [4, 6, 11],
  ])
    box(o, 'old', x, 0, z, 0.8, 1.5, l);
  const n = d === 3 ? 24 : 12,
    cx = -1,
    cz = -22,
    r = 5;
  for (let i = 0; i < n; i++) {
    if (i > n * 0.65 && i < n * 0.88) continue;
    const a = (tau * i) / n,
      b = (tau * (i + 1)) / n,
      ring = [
        [cx + r * Math.cos(a), cz + r * Math.sin(a)],
        [cx + r * Math.cos(b), cz + r * Math.sin(b)],
        [cx + (r - 0.8) * Math.cos(b), cz + (r - 0.8) * Math.sin(b)],
        [cx + (r - 0.8) * Math.cos(a), cz + (r - 0.8) * Math.sin(a)],
      ];
    prism(o, 'old', ring, 0, 2.3 + (i % 3) * 0.22);
  }
  if (d >= 2) {
    const f = frame([-7, 2], [-1, 2]),
      outer = pointed(3, 0, 6, 6, d),
      inner = pointed(3, 0.1, 4.5, 5.1, d),
      pts = [outer, inner].flat(),
      ix = earcut(pts.flat(), [outer.length]);
    for (const zz of [-0.4, 0.4])
      for (let i = 0; i < ix.length; i += 3)
        T(
          o,
          'old',
          ix.slice(i, i + 3).map((k) => f.P(...pts[k], zz)),
          [0, 0, zz > 0 ? 1 : -1],
        );
    for (const h of [outer, inner])
      for (let i = 0; i < h.length; i++)
        Q(o, 'old', [
          f.P(...h[i], -0.4),
          f.P(...h[(i + 1) % h.length], -0.4),
          f.P(...h[(i + 1) % h.length], 0.4),
          f.P(...h[i], 0.4),
        ]);
  }
}
function stairs(o, d) {
  if (d < 1) return;
  for (const [x, z, y, len] of [
    [23, -42, 12, 12],
    [-10, -39, 12, 10],
    [-9, 15, 12, 11],
  ]) {
    const n = d === 1 ? 4 : d === 2 ? 12 : 20;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;
      box(o, 'trim', x, y * t - 0.18, z + len * (1 - t), 1.8, 0.18, len / n);
    }
    if (d >= 2)
      for (const dx of [-1, 1]) {
        beam(o, 'metal', [x + dx, 0.9, z + len], [x + dx, y + 0.9, z], 0.07, 0.07, C.metal);
        for (let i = 0; i <= 5; i++) {
          const t = i / 5;
          beam(
            o,
            'metal',
            [x + dx, y * t, z + len * (1 - t)],
            [x + dx, y * t + 0.9, z + len * (1 - t)],
            0.06,
            0.06,
            C.metal,
          );
        }
      }
  }
}
function build(o, _f, d = 3) {
  curtain(o, d);
  tower(o, p.keep, 12, 26, d);
  tower(o, p.northwestTower, 12, 21, d);
  tower(o, p.northeastTower, 12, 18, d);
  tower(o, p.southwestTower, 12, 17, d);
  tower(o, p.southeastTower, 12, 16, d);
  minaret(o, d);
  ruins(o, d);
  stairs(o, d);
}
export const citadelSkyline = (o, f) => build(o, f, 0),
  citadelDistrict = (o, f) => build(o, f, 1),
  citadelStreet = (o, f) => build(o, f, 2),
  citadelCloseup = (o, f) => build(o, f, 3);
export const citadelModel = {
  id: 'tower_of_david',
  key: 'tower_of_david',
  cell: 'sv/sv9',
  recipe: 'structure-tower-of-david.mjs',
  title: 'Tower of David, Jerusalem Citadel',
  category: 'fortress',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-180, 110, 185],
  lookAt: [5, 13, -12],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 4, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-native-citadel-keep-minaret-and-open-courtyard',
      position: [145, 160, 180],
      lookAt: [7, 10, -12],
      reviewLod: 'skyline',
    },
    {
      name: 'southwest-minaret-annular-balcony-and-battered-tower',
      position: [-70, 36, 75],
      lookAt: [-22, 25, 28],
    },
    {
      name: 'pointed-courtyard-galleries-and-low-ruin-walls',
      position: [31, 22, -7],
      lookAt: [-11, 7, -17],
    },
    {
      name: 'north-keep-barbican-and-whole-rear-envelope',
      position: [135, 90, -150],
      lookAt: [18, 14, -39],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield frozen beforegeometry; compatiblehostgrade andthreshold/archaeologicalattachment unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-tower-of-david.mjs',
    level: 'skyline',
    export: 'citadelSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'citadelDistrict', errorMeters: 1.3, surfaces },
      street: { export: 'citadelStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'citadelCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole34vertexouter/18vertexopencourt nativecitadel with allprincipalfortifiedwings/towers/NEkeep/SWminaret.12mcurtain/26mkeep/37.5mminaret and internalpartpartition/batter widths/currentfinefinish are boundedphotographicestimates, not measuredsurvey. No minaretonly orancientreplicacastle substitute.',
    'Qualla-first30familieschecked; publishedcourtyardimage inspected but missinglocalmachineboundPD-basis omitted, no metadata edits. Five exact ownphotographerPD-self/Ownworknativeoriginals individuallyinspected/SHA1matched/grantsbound:Mattes2011courtyard/keep/galleries/ruins/wholeuppercourtyard andBertholdWerner2008exterior/minaret/batter. GaryToddcandidates notadopted; existingpolicy unchanged. No restrictedoperatorphotos/diagrams/phototextures/generatedbitmap/downloadedmesh/signartwork.',
    'Allnativecourtyardvertices physicallyretained. Detailedpointedarcades/blindrecesses/slitopenings havetruejambs/soffits/darksetback, merlons separatevolumes, roofstairs/railsintrinsic. Distantlevels reducearch/masonrycensus. Coarse lowarchaeologicalroundtower/wallfragments/openarch are originalboundedlayout/rubbleestimates, not archaeologicallysurveyedstrata/exactstonecensus; absentvegetation/fineunderground/interiorrooms/showhardware/stagechairs/tempawnings.',
    'NeighboringJaffaGate/OldCitywalls/Kishle/detachedmuseumannexes/streets/outermoatlandscape excluded. Intrinsicbatteredfootings are structuregeometry, no whole-site floor orrectangularsitebase. Minaretposition/annularbalcony/cap/bands and finialcoarseoriginalarchitecturalsilhouette, no surveyedstonepattern.',
    'Independent400m129x129field/16641originalvalues/rawtilebytes frozen beforegeometry andunchanged. UrbancompositeDEMmayinterpolatestructures/trees/coarsersourceheights; actualcourtyardfloor/moat/thresholdclassification notsurveyed. Portable/shared/contextflatstage separate; ordinarynativepreview/replaceFootprint=false; livehostgrade/contactnotcertified.',
  ],
};
