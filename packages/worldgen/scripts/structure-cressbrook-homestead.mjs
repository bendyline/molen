/** Cressbrook's two main dwellings, reconstructed from cleared archival exterior photographs. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/r7/r7h/cressbrook_homestead/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const C = {
  wall: rgb('b4b6a0'),
  slab: rgb('8d917c'),
  trim: rgb('d5d8c5'),
  roof: rgb('969e91'),
  brick: rgb('8b7a65'),
  glass: rgb('40574b'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.97, metallic: 0 },
  slab: { slot: 'wall', graph: 'wood_vertical', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.91, metallic: 0.15 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.97, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.7, metallic: 0 },
};
function T(o, s, p, n) {
  p = p.map((p) => p.map(Math.fround));
  const nn = normalFor(...p);
  if (nn.every((v) => v === 0)) return;
  if (n && nn.reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, [p[0], p[1], p[2]], n);
  T(o, s, [p[0], p[2], p[3]], n);
}
const rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ],
  bounds = (r) => [
    Math.min(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[1])),
  ];
function F(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = b.map((v, i) => (v - a[i]) / len),
    n = [-u[1], 0, u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, r, f, z = 0, holes = []) {
  const all = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((a, r) => a + r.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n,
    );
}
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
function reveal(o, s, r, f, a, b) {
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    Q(o, s, [f.P(...p, a), f.P(...q, a), f.P(...q, b), f.P(...p, b)]);
  }
}
function box(o, s, x0, x1, y0, y1, z0, z1) {
  const r = [
    [x0, z1],
    [x1, z1],
    [x1, z0],
    [x0, z0],
  ];
  for (let i = 0; i < 4; i++) {
    const f = F(r[i], r[(i + 1) % 4]);
    panel(o, s, rect(f.len / 2, y0, f.len, y1 - y0), f);
  }
  cap(o, s, r, y0, false);
  cap(o, s, r, y1);
}
function stick(o, s, a, b, w, d) {
  if (d) beam(o, s, a, b, w, w, C[s]);
  else {
    const v = b.map((v, i) => v - a[i]),
      h = Math.hypot(v[0], v[2]),
      u = h ? [v[2] / h, 0, -v[0] / h] : [1, 0, 0],
      v2 = h ? [0, 1, 0] : [0, 0, 1];
    for (const axis of [u, v2]) {
      const p = [
        a.map((v, i) => v - (axis[i] * w) / 2),
        b.map((v, i) => v - (axis[i] * w) / 2),
        b.map((v, i) => v + (axis[i] * w) / 2),
        a.map((v, i) => v + (axis[i] * w) / 2),
      ];
      Q(o, s, p);
      Q(o, s, [...p].reverse());
    }
  }
}
function frame(o, f, r, d) {
  if (!d) return;
  const [l, rgt, lo, hi] = [r[0][0], r[1][0], r[0][1], r[2][1]],
    z = 0.035;
  for (const [a, b] of [
    [
      [l, lo],
      [l, hi],
    ],
    [
      [rgt, lo],
      [rgt, hi],
    ],
    [
      [l, lo],
      [rgt, lo],
    ],
    [
      [l, hi],
      [rgt, hi],
    ],
  ]) {
    if (d > 1) stick(o, 'trim', f.P(...a, z), f.P(...b, z), 0.075, d);
    else {
      const vertical = a[0] === b[0];
      panel(
        o,
        'trim',
        rect(
          (a[0] + b[0]) / 2,
          vertical ? lo : a[1] - 0.035,
          vertical ? 0.07 : rgt - l,
          vertical ? hi - lo : 0.07,
        ),
        f,
        z,
      );
    }
  }
}
function apertures(o, f, width, eave, d, front = false) {
  const n = Math.max(1, Math.floor(width / 3.5)),
    open = [];
  for (let i = 0; i < n; i++) {
    const x = (width * (i + 0.5)) / n;
    if (front && Math.abs(x - width / 2) < (width / n) * 0.6) continue;
    open.push({ r: rect(x, 1.15, 1.0, 1.35), door: false });
  }
  if (front) open.push({ r: rect(width / 2, 0.45, 1.3, 2.05), door: true });
  panel(
    o,
    'wall',
    rect(width / 2, 0.45, width, eave - 0.45),
    f,
    0,
    d > 1 ? open.map((a) => a.r) : [],
  );
  for (const a of open) {
    if (d > 1) reveal(o, 'trim', a.r, f, 0, -0.12);
    panel(o, a.door ? 'slab' : 'glass', a.r, f, d > 1 ? -0.12 : 0.012);
    frame(o, f, a.r, d);
    if (d > 1 && !a.door) {
      const x = (a.r[0][0] + a.r[1][0]) / 2;
      stick(o, 'trim', f.P(x, 1.16, -0.08), f.P(x, 2.49, -0.08), 0.045, d);
      stick(o, 'trim', f.P(a.r[0][0], 1.83, -0.08), f.P(a.r[1][0], 1.83, -0.08), 0.035, d);
      for (const xx of [a.r[0][0] - 0.2, a.r[1][0] + 0.2])
        panel(o, 'slab', rect(xx, 1.1, 0.28, 1.45), f, 0.05);
    }
  }
}
function roof(o, p, d) {
  const [x0, x1, z0, z1] = bounds(p.worldOutline),
    cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    e = p.eave,
    h = p.ridge;
  let polygons;
  if (p.roof === 'gable-z')
    polygons = [
      [
        [x0, e, z0],
        [cx, h, z0],
        [cx, h, z1],
        [x0, e, z1],
      ],
      [
        [cx, h, z0],
        [x1, e, z0],
        [x1, e, z1],
        [cx, h, z1],
      ],
    ];
  else if (p.roof === 'gable-x')
    polygons = [
      [
        [x0, e, z0],
        [x1, e, z0],
        [x1, h, cz],
        [x0, h, cz],
      ],
      [
        [x0, h, cz],
        [x1, h, cz],
        [x1, e, z1],
        [x0, e, z1],
      ],
    ];
  else {
    const a = x0 + p.hipInset,
      b = x1 - p.hipInset;
    polygons = [
      [
        [x0, e, z0],
        [x1, e, z0],
        [b, h, cz],
        [a, h, cz],
      ],
      [
        [x0, e, z1],
        [a, h, cz],
        [b, h, cz],
        [x1, e, z1],
      ],
      [
        [x0, e, z0],
        [a, h, cz],
        [x0, e, z1],
      ],
      [
        [x1, e, z0],
        [x1, e, z1],
        [b, h, cz],
      ],
    ];
  }
  for (const r of polygons) {
    for (let i = 1; i < r.length - 1; i++) T(o, 'roof', [r[0], r[i], r[i + 1]], [0, 1, 0]);
    if (d > 1)
      for (let i = 0; i < r.length; i++)
        stick(
          o,
          'roof',
          r[i].map((v, k) => v + (k === 1 ? 0.025 : 0)),
          r[(i + 1) % r.length].map((v, k) => v + (k === 1 ? 0.025 : 0)),
          0.045,
          d,
        );
  }
  if (p.roof.startsWith('gable'))
    for (const side of [0, 1]) {
      const alongZ = p.roof === 'gable-z',
        f = alongZ
          ? side
            ? F([x0, z1], [x1, z1])
            : F([x1, z0], [x0, z0])
          : side
            ? F([x1, z1], [x1, z0])
            : F([x0, z0], [x0, z1]),
        w = f.len,
        r = [
          [0, e],
          [w, e],
          [w / 2, h],
        ],
        attic = p.id === 'house-main' && side === 1,
        hole = rect(w / 2, 4.25, 2.4, 1.35);
      panel(o, p.slabWall ? 'slab' : 'wall', r, f, 0, attic ? [hole] : []);
      if (attic) {
        reveal(o, 'trim', hole, f, 0, -0.12);
        panel(o, 'glass', hole, f, -0.12);
        frame(o, f, hole, Math.max(1, d));
        if (d > 1) {
          for (const x of [w / 2 - 0.4, w / 2 + 0.4])
            stick(o, 'trim', f.P(x, 4.25, -0.08), f.P(x, 5.6, -0.08), 0.055, d);
          box(o, 'trim', cx - 1.65, cx + 1.65, 4.12, 4.22, z1, z1 + 0.85);
          const bal = F([cx + 1.65, z1 + 0.85], [cx - 1.65, z1 + 0.85]);
          railing(o, bal, 0, 3.3, 4.22, 5.0, d);
        }
      }
      if (d)
        for (let i = 0; i < 2; i++)
          stick(o, 'trim', f.P(...r[i], 0.025), f.P(...r[(i + 1) % 3], 0.025), 0.085, d);
    }
}
function room(o, p, d) {
  const [x0, x1, z0, z1] = bounds(p.worldOutline),
    r = [
      [x0, z1],
      [x1, z1],
      [x1, z0],
      [x0, z0],
    ];
  box(o, 'slab', x0, x1, 0.35, 0.45, z0, z1);
  for (let i = 0; i < 4; i++) {
    const f = F(r[i], r[(i + 1) % 4]);
    if (p.slabWall) {
      panel(o, 'slab', rect(f.len / 2, 0.45, f.len, p.eave - 0.45), f);
      if (d > 1)
        for (let x = 0.25; x < f.len; x += d > 2 ? 0.25 : 0.5)
          stick(o, 'slab', f.P(x, 0.5, 0.025), f.P(x, p.eave - 0.1, 0.025), 0.035, d);
    } else apertures(o, f, f.len, p.eave, d, i === 0);
  }
  for (const [x, z] of d
    ? [
        [x0 + 0.25, z0 + 0.25],
        [x1 - 0.25, z0 + 0.25],
        [x1 - 0.25, z1 - 0.25],
        [x0 + 0.25, z1 - 0.25],
      ]
    : [
        [x0 + 0.25, z0 + 0.25],
        [x1 - 0.25, z1 - 0.25],
      ])
    stick(o, 'slab', [x, 0, z], [x, 0.36, z], 0.18, d);
  roof(o, p, d);
}
function railing(o, f, a, b, y0, y1, d, gap) {
  const segments = gap
    ? [
        [a, gap[0]],
        [gap[1], b],
      ]
    : [[a, b]];
  for (const [l, r] of segments) {
    if (r <= l) continue;
    for (const y of [y0 + 0.12, y1]) {
      if (d > 1) stick(o, 'trim', f.P(l, y), f.P(r, y), 0.07, d);
      else {
        panel(o, 'trim', rect((l + r) / 2, y - 0.03, r - l, 0.06), f);
        panel(o, 'trim', rect((l + r) / 2, y - 0.03, r - l, 0.06), {
          P: f.P,
          n: f.n.map((v) => -v),
        });
      }
    }
    if (d)
      for (let x = l + 0.1; x < r; x += d > 2 ? 0.17 : d > 1 ? 0.48 : 0.85) {
        if (d > 1) stick(o, 'trim', f.P(x, y0), f.P(x, y1), 0.035, d);
        else {
          const r = rect(x, y0, 0.04, y1 - y0);
          panel(o, 'trim', r, f);
          panel(o, 'trim', r, { P: f.P, n: f.n.map((v) => -v) });
        }
      }
  }
}
function veranda(o, p, d) {
  const [x0, x1, z0, z1] = bounds(p.outline);
  box(o, 'slab', x0, x1, 0.29, 0.4, z0, z1);
  let a, b;
  if (p.outward === 'north') {
    a = [x1, z1];
    b = [x0, z1];
  } else if (p.outward === 'south') {
    a = [x0, z0];
    b = [x1, z0];
  } else if (p.outward === 'east') {
    a = [x0, z1];
    b = [x0, z0];
  } else {
    a = [x1, z0];
    b = [x1, z1];
  }
  const f = F(a, b),
    n = Math.ceil(f.len / (d ? 2.5 : 5));
  for (let i = 0; i <= n; i++) {
    const x = (f.len * i) / n;
    stick(o, 'trim', f.P(x, 0.4), f.P(x, p.outerY - 0.025), 0.11, d);
    if (d > 1) {
      stick(
        o,
        'trim',
        f.P(x, p.outerY - 0.6),
        f.P(Math.min(f.len, x + 0.45), p.outerY - 0.04),
        0.05,
        d,
      );
      if (x > 0.45)
        stick(o, 'trim', f.P(x, p.outerY - 0.6), f.P(x - 0.45, p.outerY - 0.04), 0.05, d);
    }
  }
  const center = p.id === 'house-front' ? -30 : p.id === 'cottage-front' ? 30 : null,
    gap = center === null ? null : [a[0] - center - 0.95, a[0] - center + 0.95];
  railing(o, f, 0, f.len, 0.4, 1.3, d, gap);
  if (center !== null) {
    box(o, 'slab', center - 0.9, center + 0.9, 0, 0.15, z1, z1 + 1.0);
    box(o, 'slab', center - 0.9, center + 0.9, 0.15, 0.3, z1, z1 + 0.55);
  }
}
function porchRoofs(o, d) {
  const patches = [
    [
      [-38, 3.6, 48],
      [-22, 3.6, 48],
      [-22, 2.8, 51],
      [-41, 2.8, 51],
    ],
    [
      [-38, 3.6, 36],
      [-38, 3.6, 48],
      [-41, 2.8, 51],
      [-41, 2.8, 36],
    ],
    [
      [-22, 3.1, 47],
      [-6, 3.1, 47],
      [-6, 2.6, 49.5],
      [-22, 2.6, 49.5],
    ],
    [
      [21, 3.7, 48],
      [39, 3.7, 48],
      [42, 2.8, 51],
      [18, 2.8, 51],
    ],
    [
      [39, 3.7, 36],
      [39, 3.7, 48],
      [42, 2.8, 51],
      [42, 2.8, 33],
    ],
    [
      [21, 3.7, 48],
      [21, 3.7, 36],
      [18, 2.8, 33],
      [18, 2.8, 51],
    ],
    [
      [39, 3.7, 36],
      [21, 3.7, 36],
      [18, 2.8, 33],
      [42, 2.8, 33],
    ],
  ];
  for (const p of patches) {
    Q(o, 'roof', p, [0, 1, 0]);
    if (d > 1) {
      for (let i = 2; i < 4; i++) stick(o, 'trim', p[i], p[(i + 1) % 4], 0.07, d);
      const a = p[0],
        b = p[1],
        c = p[3],
        e = p[2],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (d > 2 ? 0.24 : 0.5));
      for (let k = 1; k < n; k++) {
        const t = k / n,
          A = a.map((v, j) => v + (b[j] - v) * t + (j === 1 ? 0.025 : 0)),
          B = c.map((v, j) => v + (e[j] - v) * t + (j === 1 ? 0.025 : 0));
        stick(o, 'roof', A, B, 0.02, d);
      }
    }
  }
}
function chimney(o, x, z, top, d) {
  box(o, 'brick', x - 0.32, x + 0.32, 3.4, top - 0.18, z - 0.35, z + 0.35);
  box(o, 'brick', x - 0.4, x + 0.4, top - 0.18, top, z - 0.43, z + 0.43);
  if (d > 1)
    for (const xx of [x - 0.15, x + 0.15])
      box(o, 'brick', xx - 0.085, xx + 0.085, top, top + 0.27, z - 0.09, z + 0.09);
}
function build(o, _f, d = 3) {
  for (const p of plan.parts) room(o, p, d);
  for (const p of plan.porches) veranda(o, p, d);
  porchRoofs(o, d);
  for (const [x, z, y] of [
    [-33, 39, 8],
    [-21.5, 28, 5.8],
    [25.5, 41, 7.9],
    [34.8, 42, 7.6],
  ])
    chimney(o, x, z, y, d);
}
export const cressbrookHomesteadSkyline = (o, f) => build(o, f, 0);
export const cressbrookHomesteadDistrict = (o, f) => build(o, f, 1);
export const cressbrookHomesteadStreet = (o, f) => build(o, f, 2);
export const cressbrookHomesteadModel = {
  id: 'cressbrook_homestead',
  key: 'cressbrook_homestead',
  recipe: 'structure-cressbrook-homestead.mjs',
  cell: 'r7/r7h',
  title: 'Cressbrook Homestead',
  category: 'historic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Distinct main House and Cottage with complete intrinsic domestic wings: gabled attic House/front window and small white-railed balcony, long low veranda wing and rear slab/kitchen roofs around an open courtyard; broad low hipped Cottage with wrap veranda, service hip, timber posts/rails, doors/windows and paired brick chimneys. Four accepted archival exterior originals. Photographic plans, metric spacing and hidden dimensions are estimates; no parcel slab or separate chapel/farm buildings.',
  camera: [90, 60, 145],
  lookAt: [-2, 3, 40],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 1.8, groundY: -0.16 },
  qaCameras: [
    {
      name: 'whole-distinct-house-and-cottage-with-open-gap',
      position: [10, 38, 132],
      lookAt: [-1, 3, 39],
    },
    {
      name: 'house-attic-gable-window-balcony-and-long-veranda',
      position: [-45, 12, 71],
      lookAt: [-28, 3, 43],
    },
    {
      name: 'cottage-hipped-roof-open-wrap-veranda-and-chimneys',
      position: [58, 13, 69],
      lookAt: [29, 3, 42],
    },
    {
      name: 'house-open-rear-domestic-courtyard-and-slab-wings',
      position: [-26, 11, 9],
      lookAt: [-30, 2.8, 33],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent192m terrain frozen before geometry; fixed north House approach[-30,55]. Exact current floor/stumps/steps and host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cressbrook-homestead.mjs',
    level: 'skyline',
    export: 'cressbrookHomesteadSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'cressbrookHomesteadDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'cressbrookHomesteadStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Both named main dwellings retained with their distinct gabled/attic House and hipped Cottage profiles, domestic wings/verandas and own floors/stumps/steps. Open rear House courtyard and intervening gap; no parcel/site slab, separate chapel/stables/dairy/worker homes/tanks/farm sheds, landscape/river/trees/fence/tennis court/people/interior.',
    'Four exact unconflicted already-published Qualla originals: named Cottage SLQ1 95648, Homestead1930SLQ2 232995, front ca1930SLQ1 92936 and rear1899SLQ1 71327. Native originals/hashes, archive item handles and explicit PD-Australia/StateLibQld-License matched; unrecorded creators established by exact native archive records. Full15source families inventoried. All other media unused; no supplementary imagery, copied pixels or generated bitmap.',
    'Photographs establish exterior roof/veranda/attic/slab/chimney forms; component dimensions, House6.9m/Cottage6.1m roof ridges, House/Cottage60m spacing and relative east/west position, hidden aperture/roof census, current colors/finish and exact ground contact are declared estimates. Neutral timber/metal/brick/glass palette is not a historic/current color survey. Official site centroid anchors a photo reconstruction, not mapped building corners.',
    'Independent192m129x129 field at1.5m,16641 samples from two original Terrarium tiles. Provider87.8798m, whole relative[-1.1564,5.5846]m at fixed approach[-30,55]. Original grid/PNG unchanged without fitting/clipping/flattening. Oversamples4.2544m source pixels; composite rural DEM can include vegetation. Geographic preview only, replaceFootprint=false; exact house-floor/stump/step/host contact unverified.',
  ],
};
