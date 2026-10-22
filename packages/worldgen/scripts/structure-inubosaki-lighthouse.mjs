/** Inubosaki's complete masonry tower, gallery and diagonally braced lantern. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import {
  beam,
  cross,
  loft,
  normalFor,
  radialRing,
  sphere,
  torus,
} from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/xn/xnk/inubosaki_lighthouse/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
    white: rgb('e4e4db'),
    trim: rgb('bcbeb4'),
    glass: rgb('b5c7c5'),
    iron: rgb('4b5553'),
    stone: rgb('b4ac94'),
    dark: rgb('434d4c'),
  },
  rust = rgb('a08366');
const surfaces = {
  white: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.6, metallic: 0.08 },
  iron: { slot: 'trim', localRef: ref, roughness: 0.6, metallic: 0.08 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
  dark: { slot: 'door', localRef: ref, roughness: 0.6, metallic: 0.08 },
};
function tri(o, s, p, h, col = C[s]) {
  const q = p.map((p) => p.map(Math.fround)),
    n = cross(
      q[1].map((v, i) => v - q[0][i]),
      q[2].map((v, i) => v - q[0][i]),
    );
  if (Math.hypot(...n) < 1e-10) return;
  if (n.reduce((s, v, i) => s + v * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
const B = (o, s, x, y, z, w, h, dep, col = C[s]) =>
    box(o, s, [x - w / 2, y, z - dep / 2], [x + w / 2, y + h, z + dep / 2], col),
  P = (a, y, r) => [Math.cos(a) * r, y, Math.sin(a) * r];
function plate(o, s, outline, z, col = C[s]) {
  const ix = earcut(outline.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [outline[j][0], outline[j][1], z]),
      [0, 0, 1],
      col,
    );
}
function radius(y) {
  return 2.94 - (2.94 - 2.4) * Math.min(1, Math.max(0, y / 20.5));
}
function round(o, s, profiles, n, col = C[s], cap = true) {
  loft(
    o,
    s,
    profiles.map(([y, r]) => radialRing(y, r, r, n)),
    col,
    { cap },
  );
}
const holes = [
  ...plan.parameters.frontWindows.map((y) => ({ y, top: y + 1.2, angle: 0.1 })),
  { y: 0.35, top: 2.65, angle: 0.22 },
];
function shaft(o, d) {
  const n = [12, 24, 48, 96][d],
    ys =
      d < 2
        ? [0.35, 20.5]
        : [0.35, 2.65, ...plan.parameters.frontWindows.flatMap((y) => [y, y + 1.2]), 20.5].sort(
            (a, b) => a - b,
          ),
    angles = [
      ...new Set([
        ...Array.from({ length: n + 1 }, (_, i) => (i / n) * Math.PI * 2),
        ...(d < 2
          ? []
          : [Math.PI / 2 - 0.22, Math.PI / 2 - 0.1, Math.PI / 2 + 0.1, Math.PI / 2 + 0.22]),
      ]),
    ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < angles.length; i++) {
      const a = angles[i - 1],
        b = angles[i],
        mid = (a + b) / 2,
        y0 = ys[j - 1],
        y1 = ys[j],
        yy = (y0 + y1) / 2,
        cut =
          d > 1 &&
          holes.some((h) => yy > h.y && yy < h.top && Math.abs(mid - Math.PI / 2) < h.angle);
      if (cut) continue;
      Q(
        o,
        'white',
        [P(a, y0, radius(y0)), P(b, y0, radius(y0)), P(b, y1, radius(y1)), P(a, y1, radius(y1))],
        [Math.cos(mid), 0, Math.sin(mid)],
      );
    }
  round(
    o,
    'white',
    [
      [0, 3.22],
      [0.18, 3.22],
      [0.35, 3.05],
    ],
    n,
  );
  round(
    o,
    'white',
    d === 0
      ? [
          [20.5, 2.4],
          [23.1, 3.5],
          [23.8, 3.5],
        ]
      : [
          [20.45, 2.42],
          [20.5, 2.49],
          [20.62, 2.49],
          [20.72, 2.41],
          [21.15, 2.42],
          [21.65, 2.58],
          [22.25, 2.91],
          [22.8, 3.36],
          [23.1, 3.5],
          [23.8, 3.5],
        ],
    n,
  );
  if (d > 1) {
    for (const h of holes) {
      const a = Math.PI / 2 - h.angle,
        b = Math.PI / 2 + h.angle,
        r0 = radius(h.y),
        r1 = radius(h.top),
        dep = 0.35;
      for (const [ang, sign] of [
        [a, -1],
        [b, 1],
      ])
        Q(
          o,
          'white',
          [P(ang, h.y, r0), P(ang, h.top, r1), P(ang, h.top, r1 - dep), P(ang, h.y, r0 - dep)],
          [sign, 0, 0],
        );
      Q(
        o,
        'white',
        [P(a, h.y, r0), P(b, h.y, r0), P(b, h.y, r0 - dep), P(a, h.y, r0 - dep)],
        [0, 1, 0],
      );
      Q(
        o,
        'white',
        [P(a, h.top, r1), P(b, h.top, r1), P(b, h.top, r1 - dep), P(a, h.top, r1 - dep)],
        [0, -1, 0],
      );
    }
  }
  for (const y of plan.parameters.frontWindows) {
    const r = radius(y + 0.6),
      z = d > 1 ? r - 0.36 : r + 0.035;
    plate(
      o,
      'dark',
      [
        [-0.34, y],
        [0.34, y],
        [0.34, y + 1.2],
        [-0.34, y + 1.2],
      ],
      z,
    );
    if (d === 0) continue;
    for (const sign of [-1, 1]) B(o, 'trim', sign * 0.37, y - 0.05, r + 0.03, 0.14, 1.32, 0.2);
    B(o, 'trim', 0, y - 0.15, r + 0.08, 0.96, 0.17, 0.28);
    B(o, 'trim', 0, y + 1.2, r + 0.09, 1.0, 0.18, 0.28);
    if (d > 1) {
      for (const x of [-0.16, 0, 0.16]) B(o, 'iron', x, y + 0.06, r - 0.15, 0.026, 1.08, 0.026);
    }
  }
  const z = radius(1.6),
    back = d > 1 ? z - 0.4 : z + 0.04;
  plate(
    o,
    'dark',
    [
      [-0.66, 0.35],
      [0.66, 0.35],
      [0.66, 2.65],
      [-0.66, 2.65],
    ],
    back,
  );
  if (d > 0) {
    for (const sign of [-1, 1]) B(o, 'stone', sign * 0.84, 0.25, z + 0.09, 0.28, 2.55, 0.34);
    B(o, 'stone', 0, 2.75, z + 0.15, 2.15, 0.19, 0.39);
    plate(
      o,
      'stone',
      [
        [-1.1, 2.93],
        [1.1, 2.93],
        [0.99, 3.15],
        [0, 3.4],
        [-0.99, 3.15],
      ],
      z + 0.35,
    );
    B(o, 'stone', 0, 0.1, z + 0.3, 1.9, 0.25, 0.8);
    if (d > 1) {
      plate(
        o,
        'iron',
        [
          [-0.17, 3.04],
          [0.17, 3.04],
          [0.27, 3.12],
          [0.17, 3.2],
          [-0.17, 3.2],
          [-0.27, 3.12],
        ],
        z + 0.356,
      );
      B(o, 'iron', 0, 0.35, back + 0.03, 0.045, 2.25, 0.06);
    }
  }
}
function gallery(o, d) {
  const n = [12, 24, 48, 64][d];
  round(
    o,
    'white',
    [
      [23.75, 3.5],
      [24.04, 3.55],
    ],
    n,
  );
  round(
    o,
    'white',
    [
      [24.04, 3.55],
      [24.3, 3.55],
    ],
    n,
    C.white,
    false,
  );
  round(
    o,
    'white',
    [
      [24.04, 2.52],
      [25.3, 2.52],
    ],
    n,
  );
  if (d === 0) {
    for (const y of [24.37, 25.35]) {
      const inner = 3.49,
        outer = 3.55;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2,
          b = ((i + 1) / n) * Math.PI * 2;
        Q(o, 'iron', [P(a, y, inner), P(b, y, inner), P(b, y, outer), P(a, y, outer)], [0, 1, 0]);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        p = P(a, 24.3, 3.52);
      B(o, 'iron', p[0], p[1], p[2], 0.05, 1.05, 0.05);
    }
    return;
  }
  for (const y of [24.45, 25.35]) torus(o, 'iron', [0, y, 0], 3.52, 0.045, C.iron, n, 4);
  for (let i = 0; i < n; i++) {
    const p = P((i / n) * Math.PI * 2, 24.3, 3.52);
    B(o, 'iron', p[0], p[1], p[2], 0.04, 1.1, 0.04);
  }
  if (d > 1) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2;
      Q(
        o,
        'trim',
        [P(a, 24.35, 2.535), P(b, 24.35, 2.535), P(b, 25.23, 2.535), P(a, 25.23, 2.535)],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        i % 2 ? C.white : C.trim,
      );
    }
  }
}
function lantern(o, d) {
  const n = [6, 8, 12, 16][d],
    r = 2.24,
    base = 25.3,
    top = 28.7;
  round(
    o,
    'white',
    [
      [25.3, 2.52],
      [25.52, 2.52],
    ],
    n,
  );
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2,
      mid = (a + b) / 2,
      p = [P(a, base + 0.15, r), P(b, base + 0.15, r), P(b, top, r), P(a, top, r)];
    Q(o, 'glass', p, [Math.cos(mid), 0, Math.sin(mid)], i % 4 === 0 ? rgb('809a9d') : C.glass);
    if (d === 0) {
      const c = P(a, base, r);
      B(o, 'white', c[0], base, c[2], 0.09, top - base, 0.09);
      continue;
    }
    beam(o, 'white', P(a, base, r + 0.04), P(a, top, r + 0.04), 0.08, 0.08, C.white);
    beam(
      o,
      'white',
      P(i % 2 ? a : b, base + 0.15, r + 0.045),
      P(i % 2 ? b : a, top, r + 0.045),
      0.067,
      0.067,
      C.white,
    );
    if (d > 1) {
      const p = P(a, base, r + 0.12);
      B(o, 'iron', p[0], base + 0.2, p[2], 0.05, 2.9, 0.05);
    }
  }
  if (d > 0) {
    for (const y of [base + 0.16, 27.0, top])
      torus(o, 'white', [0, y, 0], r + 0.06, 0.06, C.white, n * 2, 4);
    torus(o, 'iron', [0, 25.7, 0], r + 0.12, 0.035, rust, n * 2, 4);
  }
  const nn = [12, 24, 48, 64][d],
    prof =
      d === 0
        ? [
            [28.7, 2.5],
            [29.5, 2.1],
            [30.6, 0.18],
          ]
        : [
            [28.7, 2.5],
            [28.88, 2.57],
            [29.1, 2.46],
            [29.55, 2.06],
            [29.95, 1.53],
            [30.3, 0.87],
            [30.6, 0.18],
          ];
  round(o, 'white', prof, nn);
  round(
    o,
    'white',
    [
      [30.6, 0.19],
      [31.08, 0.09],
    ],
    d === 0 ? 6 : 12,
  );
  sphere(o, 'white', [0, 31.19, 0], [0.1, 0.11, 0.1], C.white, d === 0 ? 4 : 8, 3);
  if (d > 1) {
    for (let i = 0; i < 8; i++) {
      const p = P((i / 8) * Math.PI * 2, 29.05, 2.48);
      sphere(o, 'trim', p, [0.1, 0.09, 0.1], C.white, 6, 3);
    }
  }
}
function maintenance(o, d) {
  if (d < 2) return;
  for (const y of [10.7, 16.9]) {
    const r = radius(y),
      x = -r - 0.47;
    B(o, 'iron', x, y, 0, 1.1, 0.1, 1.15);
    for (const z of [-0.54, 0.54]) {
      beam(o, 'iron', [x - 0.48, y + 0.9, z], [x + 0.48, y + 0.9, z], 0.04, 0.04, C.iron);
      for (const xx of [x - 0.48, x + 0.48]) B(o, 'iron', xx, y, z, 0.04, 0.96, 0.04);
    }
    beam(o, 'iron', [-r, y - 0.8, 0], [-r - 1, y, 0], 0.06, 0.06, C.iron);
  }
  const y0 = 10.8,
    y1 = 24.3;
  for (const z of [-0.26, 0.26])
    beam(
      o,
      'iron',
      [-radius(y0) - 0.25, y0, z],
      [-radius(20.5) - 0.25, y1, z],
      0.045,
      0.045,
      C.iron,
    );
  const n = Math.ceil((y1 - y0) / 0.34);
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n,
      x = -radius(Math.min(y, 20.5)) - 0.25;
    beam(o, 'iron', [x, y, -0.26], [x, y, 0.26], 0.032, 0.032, C.iron);
  }
}
function build(o, _frame, d = 3) {
  shaft(o, d);
  gallery(o, d);
  lantern(o, d);
  maintenance(o, d);
}
export const inubosakiSkyline = (o, f) => build(o, f, 0);
export const inubosakiDistrict = (o, f) => build(o, f, 1);
export const inubosakiStreet = (o, f) => build(o, f, 2);
export const inubosakiLighthouseModel = {
  id: 'inubosaki_lighthouse',
  key: 'inubosaki_lighthouse',
  recipe: 'structure-inubosaki-lighthouse.mjs',
  cell: 'xn/xnk',
  title: 'Inubōsaki Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete white Inubosaki masonry tower: tapered shaft/base, three narrow stone-trimmed stair-window recesses and bounded entrance/pediment, expanding corbelled gallery/solid pale belt/open dark railings, white upper pedestal, diagonally braced polygonal glazed lantern/domed roof/pinnacle, plus bounded side maintenance ladder/two small landings. Operator31.3mstructuralheight, not52msea-to-light. Exact named native point anchors a photographically estimated circular plan; no surveyed footprint or detached station/keeper/museum/mast/compound-wall/landscape geometry.',
  camera: [37, 23, 41],
  lookAt: [0, 15, 0],
  portableGroundY: -0.2,
  mediumFiContext: { scale: 2.2, groundY: -0.2 },
  qaCameras: [
    {
      name: 'three-stair-window-recesses-and-stone-door-pediment',
      position: [13, 11, 23],
      lookAt: [0, 11, 0],
    },
    {
      name: 'corbelled-gallery-open-rails-and-braced-glazed-lantern',
      position: [10, 29, 15],
      lookAt: [0, 26, 0],
    },
    {
      name: 'complete-tapered-tower-and-bounded-side-maintenance-access',
      position: [-16, 17, -24],
      lookAt: [0, 15, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed near-front[0,4.3]/Y0before terrain; bounded base/threshold only, no station/compound/coast slab.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-inubosaki-lighthouse.mjs',
    level: 'skyline',
    export: 'inubosakiSkyline',
    errorMeters: 0.45,
    surfaces,
    authoredLevels: {
      district: { export: 'inubosakiDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'inubosakiStreet', errorMeters: 0.04, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'The complete individual named lighthouse tower is modeled. Detached keeper/signal/communications/ticket/museum/foghorn buildings and masts, compound wall, white postbox, coast/landscape and visitors are separate and excluded. Native map supplies a point only; circular3.22mbase radius/2.94to2.4mshaft taper, WSWfront bearing, window/door sections and collar/gallery/lantern subdivisions are photographic estimates. Native point/story/coarse official coordinates differ roughly10–20m; precise horizontal position/threshold/host contact remain unverified preview estimates.',
    'Operatorstructuralheight31.3m/JapanCoastGuardabout31m, with lightabout27maboveground/52mabovesea, are distinct. Modeltip31.3m and glass centerabout27m preserve that distinction. Fine masonry thickness/paint, optical apparatus/shutters, lens Fresnel segments, exact railing/mullion counts, dome sections, lettering/plaques and fixtures are medium-fi approximations; no exact interior optics or emissive light beam.',
    'Two exact4032x2268August2025Aspereown-workCC0exterior originals and2048x1536Abasaaown-workPD-self2013tower view were inspected first from Qualla. Native imageSHA1/primary same-author dedications match local cleared bytes.2013view supports bounded side ladder/two small landings on otherwise less-visible side; their exact current persistence/sections remain approximate. The separate white postbox close-up, other licensed images/museum-lens displays/paintings and nearby station structures are unused. Operator/CoastGuardtext supplies height facts only; no additional image source or photographic texture.',
    'Three close-detail front windows/door are genuinely recessed; main gallery rails and white diagonally braced lantern frame remain open geometric features. Fine bars/maintenance rungs, roof vents and subdivisions retire progressively with distance. Only a bounded base/threshold is included; raw source relief is retained, without fitted/flattened coastal ground.',
  ],
};
