/** Whole1976 Hong Kong GPO: native two-part mass, splayed office windows and open scalloped canopy. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/we/wec/general_post_office_hong_kong/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('dfded6'),
    trim: rgb('e4e4dc'),
    roof: rgb('a0a599'),
    glass: rgb('424b48'),
    metal: rgb('555f59'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_boardformed', roughness: 0.98, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.07 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.1 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const N = normalFor(...q);
  if (N.every((v) => v === 0)) return;
  if (n && N.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
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
function B(o, s, x0, y0, z0, x1, y1, z1) {
  box(o, s, [x0, y0, z0], [x1, y1, z1], C[s]);
}
const area = (r) =>
  r.reduce((v, a, i) => v + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0);
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function F(a, b, n) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function edgeFrame(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    sign = Math.sign(area(r)),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return F(a, b, [(sign * (b[1] - a[1])) / len, 0, (-sign * (b[0] - a[0])) / len]);
}
function rect(o, s, f, x0, y0, x1, y1, z = 0) {
  if (x1 - x0 < 0.0001 || y1 - y0 < 0.0001) return;
  Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n);
}
function prism(o, s, r, y0, y1) {
  cap(o, s, r, y0, false);
  cap(o, s, r, y1);
  for (let i = 0; i < r.length; i++) {
    const f = edgeFrame(r, i);
    rect(o, s, f, 0, y0, f.len, y1);
  }
}
function frameBox(o, s, f, x0, y0, x1, y1, z0, z1) {
  const A = (x, y, z) => f.P(x, y, z);
  Q(o, s, [A(x0, y0, z1), A(x1, y0, z1), A(x1, y1, z1), A(x0, y1, z1)], f.n);
  Q(
    o,
    s,
    [A(x0, y0, z0), A(x0, y1, z0), A(x1, y1, z0), A(x1, y0, z0)],
    f.n.map((v) => -v),
  );
  Q(o, s, [A(x0, y0, z0), A(x1, y0, z0), A(x1, y0, z1), A(x0, y0, z1)], [0, -1, 0]);
  Q(o, s, [A(x0, y1, z0), A(x0, y1, z1), A(x1, y1, z1), A(x1, y1, z0)], [0, 1, 0]);
  for (const [x, n] of [
    [x0, [-f.n[2], 0, f.n[0]]],
    [x1, [f.n[2], 0, -f.n[0]]],
  ])
    Q(o, s, [A(x, y0, z0), A(x, y0, z1), A(x, y1, z1), A(x, y1, z0)], n);
}
function opening(o, f, x0, x1, y0, y1, depth, splay, d, hall = false) {
  const a = x0 + splay,
    b = x1 - splay,
    c = y0 + (splay ? 0.1 : 0),
    e = y1 - (splay ? 0.1 : 0),
    outer = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    inner = [
      [a, c],
      [b, c],
      [b, e],
      [a, e],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, 'wall', [
      f.P(...outer[i]),
      f.P(...outer[j]),
      f.P(...inner[j], -depth),
      f.P(...inner[i], -depth),
    ]);
  }
  const glassColor = C.glass.map(
    (v, k) => v + ((Math.floor(x0 * 3) + Math.floor(y0)) % 5) * 0.004 * (k === 1 ? 1 : 0.5),
  );
  Q(
    o,
    'glass',
    [f.P(a, c, -depth), f.P(b, c, -depth), f.P(b, e, -depth), f.P(a, e, -depth)],
    f.n,
    glassColor,
  );
  if (d > 1) {
    const y = hall ? y0 + (y1 - y0) * 0.55 : y0 + (y1 - y0) * 0.3;
    frameBox(o, 'metal', f, a, y - 0.035, b, y + 0.035, -depth, -depth + 0.06);
    if (hall)
      frameBox(o, 'metal', f, (a + b) / 2 - 0.03, c, (a + b) / 2 + 0.03, e, -depth, -depth + 0.06);
    if (d > 2) {
      for (const x of [a, b - 0.035])
        frameBox(o, 'metal', f, x, c, x + 0.035, e, -depth, -depth + 0.055);
      frameBox(o, 'metal', f, a, c, b, c + 0.045, -depth, -depth + 0.07);
      frameBox(o, 'trim', f, x0 - 0.035, y0 - 0.09, x1 + 0.035, y0 - 0.02, -0.04, 0.07);
    }
  }
}
function row(o, f, y0, y1, count, width, d, depth = 0.65, splay = 0.2, hall = false) {
  const step = f.len / count,
    blank = (step - width) / 2;
  let prev = 0;
  for (let i = 0; i < count; i++) {
    const a = i * step + blank,
      b = a + width;
    rect(o, 'wall', f, prev, y0, a, y1);
    opening(o, f, a, b, y0, y1, depth, splay, d, hall);
    prev = b;
  }
  rect(o, 'wall', f, prev, y0, f.len, y1);
}
function facade(o, f, d, kind = 'front') {
  const front = kind === 'front',
    back = kind === 'back',
    count = front ? [4, 24, 48, 48][d] : back ? [4, 12, 24, 24][d] : [1, 3, 6, 6][d],
    hallCount = front ? [4, 12, 24, 24][d] : back ? [1, 6, 12, 12][d] : [0, 2, 5, 5][d],
    rows = [...p.parameters.officeRows];
  let y = 5.4;
  if (hallCount) {
    rect(o, 'wall', f, 0, y, f.len, 5.7);
    row(
      o,
      f,
      5.7,
      12.6,
      hallCount,
      front ? (f.len / hallCount) * 0.78 : back ? (f.len / hallCount) * 0.6 : 0.9,
      d,
      0.85,
      front ? 0.08 : 0.03,
      true,
    );
    y = 12.6;
  }
  rect(o, 'wall', f, 0, y, f.len, 17.2);
  if (d === 0 && kind !== 'front') rect(o, 'wall', f, 0, 17.2, f.len, 18.5);
  else {
    rect(o, 'wall', f, 0, 17.2, 0.32, 18.5);
    rect(o, 'wall', f, f.len - 0.32, 17.2, f.len, 18.5);
    opening(o, f, 0.32, f.len - 0.32, 17.2, 18.5, 0.45, 0, Math.min(d, 1));
    if (d > 1)
      for (let x = 2; x < f.len - 0.5; x += 2.1)
        frameBox(o, 'metal', f, x - 0.03, 17.22, x + 0.03, 18.48, -0.46, -0.4);
  }
  y = 18.5;
  for (const [a, b] of rows) {
    rect(o, 'wall', f, 0, y, f.len, a);
    const width = front
      ? Math.min((f.len / count) * 0.72, d === 0 ? 15 : 2.4)
      : back
        ? (f.len / count) * 0.68
        : Math.min(1.05, (f.len / count) * 0.7);
    row(o, f, a, b, count, width, d, 0.7, d === 0 ? 0.08 : front ? 0.23 : 0.18);
    y = b;
  }
  rect(o, 'wall', f, 0, y, f.len, 29.25);
}
const front = F(p.front[0], p.front[1], [0, 0, 1]),
  east = F(p.high[2], p.high[0], [1, 0, 0]),
  west = F(p.high[7], p.high[5], [-1, 0, 0]),
  back = F(p.high[0], p.high[7], [0, 0, -1]);
function canopy(o, d) {
  const count = 8,
    step = front.len / count,
    n = [2, 4, 12, 24][d],
    yTop = 5.4,
    depth = 3.4;
  for (let i = 0; i < count; i++)
    for (let k = 0; k < n; k++) {
      const t = k / n,
        u = (k + 1) / n,
        a = i * step + t * step,
        b = i * step + u * step,
        arch = (t) => 4.25 + 0.85 * (1 - (2 * t - 1) * (2 * t - 1)),
        ya = arch(t),
        yb = arch(u);
      Q(o, 'trim', [front.P(a, ya), front.P(b, yb), front.P(b, yTop), front.P(a, yTop)], [0, 0, 1]);
      Q(
        o,
        'trim',
        [
          front.P(a, ya, -depth),
          front.P(a, yTop, -depth),
          front.P(b, yTop, -depth),
          front.P(b, yb, -depth),
        ],
        [0, 0, -1],
      );
      Q(
        o,
        'trim',
        [front.P(a, ya), front.P(a, ya, -depth), front.P(b, yb, -depth), front.P(b, yb)],
        [0, -1, 0],
      );
      Q(
        o,
        'trim',
        [front.P(a, yTop), front.P(b, yTop), front.P(b, yTop, -depth), front.P(a, yTop, -depth)],
        [0, 1, 0],
      );
    }
  for (let i = 0; i <= count; i++) {
    const x = i === 0 ? 0.48 : i === count ? front.len - 0.48 : i * step;
    frameBox(o, 'wall', front, x - 0.47, -1.1, x + 0.47, 4.3, -2.2, -0.75);
  }
  if (d > 1)
    for (let i = 1; i < count; i++) {
      const x = i * step;
      frameBox(o, 'wall', front, x - 0.55, 4.0, x + 0.55, 4.28, -2.28, -0.68);
    }
}
function parapet(o, r, y0, y1, d, slotted = false) {
  for (let i = 0; i < r.length; i++) {
    const f = edgeFrame(r, i);
    if (slotted && d) {
      frameBox(o, 'trim', f, 0, y0, f.len, y0 + 0.35, -0.3, 0);
      frameBox(o, 'trim', f, 0, y1 - 0.25, f.len, y1, -0.3, 0);
      const n = Math.max(1, Math.round(f.len / 7));
      for (let k = 0; k <= n; k++) {
        const x = (k * f.len) / n;
        frameBox(
          o,
          'trim',
          f,
          Math.max(0, x - 0.12),
          y0 + 0.35,
          Math.min(f.len, x + 0.12),
          y1 - 0.25,
          -0.3,
          0,
        );
      }
    } else frameBox(o, 'trim', f, 0, y0, f.len, y1, -0.3, 0);
  }
}
function baseAndRear(o, d) {
  prism(o, 'roof', p.outline, -1.1, 0.06);
  const core = p.high.map(([x, z]) => [x, z > p.frontZ - 4.8 ? p.frontZ - 4.8 : z]);
  prism(o, 'wall', core, -1.1, 5.4);
  if (d) {
    const f = F(
      [p.front[0][0] + 1, p.frontZ - 4.81],
      [p.front[1][0] - 1, p.frontZ - 4.81],
      [0, 0, 1],
    );
    rect(o, 'glass', f, 0, 0.35, f.len, 4.3, 0.015);
    for (let i = 1; i < Math.round(f.len / 4); i++) {
      const x = i * 4;
      frameBox(o, 'metal', f, x - 0.045, 0.35, x + 0.045, 4.3, 0.02, 0.1);
    }
  }
  for (const f of [east, west, back]) rect(o, 'wall', f, 0, 0.06, f.len, 5.4);
  prism(o, 'wall', p.low, -1.1, 17.5);
  cap(o, 'roof', p.low, 17.52);
  parapet(o, p.low, 17.52, 18.1, d);
  if (d)
    for (const i of [2, 3, 4]) {
      const f = edgeFrame(p.low, i);
      if (f.len < 8) continue;
      for (const y of [5.4, 10.7, 14.9]) {
        const count = Math.max(1, Math.floor(f.len / [30, 8, 5, 5][d]));
        for (let k = 0; k < count; k++) {
          const x = ((k + 0.5) * f.len) / count;
          rect(o, 'glass', f, x - 0.8, y, x + 0.8, y + 1.3, 0.025);
          if (d > 1) frameBox(o, 'trim', f, x - 0.88, y - 0.07, x + 0.88, y, 0.02, 0.12);
        }
      }
    }
  const z = p.high[0][1] + 5;
  B(o, 'wall', 4, 29.25, z, 14, 32.0, z + 4.1);
  B(o, 'roof', 3.85, 32.0, z - 0.15, 14.15, 32.12, z + 4.25);
  if (d)
    for (let i = 0; i < [0, 3, 7, 12][d]; i++) {
      const x = 5 + (i * 8) / [1, 3, 7, 12][d];
      B(o, 'metal', x, 30.0, z + 4.101, x + 0.28, 31.2, z + 4.12);
    }
}
function build(o, _f, d = 3) {
  baseAndRear(o, d);
  facade(o, front, d);
  facade(o, east, d, 'east');
  facade(o, west, d, 'west');
  facade(o, back, d, 'back');
  cap(o, 'wall', p.high, 5.4, false);
  cap(o, 'roof', p.high, 29.25);
  parapet(o, p.high, 29.25, 30.1, d, true);
  canopy(o, d);
}
export const generalPostOfficeHongKongSkyline = (o, f) => build(o, f, 0),
  generalPostOfficeHongKongDistrict = (o, f) => build(o, f, 1),
  generalPostOfficeHongKongStreet = (o, f) => build(o, f, 2),
  generalPostOfficeHongKongCloseup = (o, f) => build(o, f, 3);
export const generalPostOfficeHongKongModel = {
  id: 'general_post_office_hong_kong',
  key: 'general_post_office_hong_kong',
  cell: 'we/wec',
  recipe: 'structure-general-post-office-hong-kong.mjs',
  title: 'General Post Office, Hong Kong',
  category: 'civic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [100, 65, 105],
  lookAt: [3, 13, 0],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.15, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-five-storey-office-and-lower-rear-wing',
      position: [92, 57, 102],
      lookAt: [3, 13, 0],
    },
    {
      name: 'deep-splayed-office-window-reveals-and-two-upper-rows',
      position: [12, 24, 35],
      lookAt: [4, 23, 19.4],
    },
    {
      name: 'tall-hall-windows-and-shallow-scalloped-canopy',
      position: [39, 10, 44],
      lookAt: [18, 7.5, 19.4],
    },
    {
      name: 'open-ground-piloti-and-recessed-lobby',
      position: [0, 2.2, 24.5],
      lookAt: [1, 2.5, 14.7],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400m field frozen before geometry unchanged. Original coastal composite contains implausible negative pits, not reliable bathymetry or foundation controls. Actual host grade/threshold attachment is unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-general-post-office-hong-kong.mjs',
    level: 'skyline',
    export: 'generalPostOfficeHongKongSkyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'generalPostOfficeHongKongDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'generalPostOfficeHongKongStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'generalPostOfficeHongKongCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Qualla-first95 families/zero conflicts. Two published creatorCC0 originals show only interior counter/sign and are not used for exterior. Two exact supplemental own-work/self-cc-zero exterior originals by Poonumia Liurellb2024 and Luksongm MWLLOPPEE2026 individually inspected/nativeSHA1 matched/grants bound; existing supplemental policy passes unchanged. No official-source imagery, source photo textures/generated bitmap/downloaded mesh or copied banners/lettering.',
    'Whole native13-vertex building and9/6-vertex office parts retained. Principal30.1m parapet follows unsurveyed map height; low roof17.5m/parapet18.1m, canopy5.4m, tall hall5.7–12.6m, ribbon17.2–18.5m/two office rows19.4–22.8m and24.5–27.9m and rooftop plant32.12m are original estimates. Eight scalloped canopy bays/24 tall hall bays/48 splayed office bays represent photographic rhythm; exact census/depth/rear/roof plant and present cosmetics bounded. Three-storey rear fenestration is approximate; not an interior reconstruction.',
    'Government text identifies1976 building and planned redevelopment demolition; no verified completed demolition is asserted. Represents photographed2024/2026 form. Separate IFC/Jardine House, old1911 predecessor, connecting public walkways, flags/sign letters/banners, urban street/site floor/gardens/construction/people/vehicles excluded. Ground piloti/curved underside physically open; own building floor only.',
    'Independent400m129x129/16641 samples/two original Terrarium tiles frozen before geometry. Provider datum14.3467m and whole absolute[-679.8011,66.6877]m retained unchanged/no fit/flatten/reacquire. Implausible deep negative coastal composite values are not harbor bathymetry or foundation controls; review PNG quantization max0.00573m is encoding precision only. Flat portable/shared/context fixtures separate. Native preview/replaceFootprint=false, actual host urban grade/threshold contact unverified.',
  ],
};
