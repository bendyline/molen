/** Original Cremorne Theatre, circa1934: historical exterior from the published archival view. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/r7/r7h/cremorne_theatre/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  wall: rgb('aaa99e'),
  frame: rgb('b6b8ac'),
  roof: rgb('858b82'),
  vent: rgb('555f56'),
  entry: rgb('c2c6b9'),
  shadow: rgb('505d55'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'fabric_canvas', roughness: 0.99, metallic: 0 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.93, metallic: 0.12 },
  vent: { slot: 'trim', graph: 'wood_plain', roughness: 0.98, metallic: 0 },
  entry: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  shadow: { slot: 'door', localRef: ref, roughness: 0.9, metallic: 0 },
};
function tri(o, s, p, n) {
  p = p.map((p) => p.map(Math.fround));
  if (n && normalFor(...p).reduce((v, q, i) => v + q * n[i], 0) < 0) p = [p[0], p[2], p[1]];
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
  tri(o, s, [p[0], p[1], p[2]], n);
  tri(o, s, [p[0], p[2], p[3]], n);
}
const area = (r) =>
    r.reduce((v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - p[1] * r[(i + 1) % r.length][0], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse()),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
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
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((v, r) => v + r.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n,
    );
}
function reveal(o, s, r, f, front, back) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, s, [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)]);
  }
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function box(o, s, x0, x1, y0, y1, z0, z1) {
  const r = cw([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
  for (let i = 0; i < r.length; i++) {
    const f = F(r[i], r[(i + 1) % r.length]);
    panel(o, s, rect(f.len / 2, y0, f.len, y1 - y0), f);
  }
  cap(o, s, r, y0, false);
  cap(o, s, r, y1);
}
function border(o, f, x, y, w, h, d) {
  if (d <= 1) {
    for (const xx of [x - w / 2, x + w / 2]) panel(o, 'frame', rect(xx, y, 0.075, h), f, 0.035);
    for (const yy of [y, y + h]) panel(o, 'frame', rect(x, yy - 0.0275, w, 0.055), f, 0.035);
    return;
  }
  for (const xx of [x - w / 2, x + w / 2])
    beam(
      o,
      'frame',
      f.P(xx, y, 0.025),
      f.P(xx, y + h, 0.025),
      d > 1 ? 0.055 : 0.075,
      0.06,
      C.frame,
    );
  for (const yy of [y, y + h])
    beam(o, 'frame', f.P(x - w / 2, yy, 0.025), f.P(x + w / 2, yy, 0.025), 0.055, 0.06, C.frame);
}
function louvers(o, f, r, d) {
  const xs = r.map((p) => p[0]),
    ys = r.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    lo = Math.min(...ys),
    hi = Math.max(...ys),
    w = x1 - x0,
    h = hi - lo;
  if (d > 1) {
    reveal(o, 'frame', r, f, 0, -0.18);
    panel(o, 'shadow', r, f, -0.18);
  } else panel(o, 'vent', r, f, 0.008);
  if (d) {
    const count = d > 2 ? Math.ceil(h / 0.125) : d > 1 ? Math.ceil(h / 0.2) : Math.ceil(h / 0.4),
      step = h / count;
    for (let i = 0; i < count; i++) {
      const y = lo + (i + 0.48) * step;
      Q(
        o,
        'vent',
        [
          f.P(x0, y, 0.025),
          f.P(x1, y, 0.025),
          f.P(x1, y + step * 0.7, -0.095),
          f.P(x0, y + step * 0.7, -0.095),
        ],
        f.n,
      );
      if (d > 1)
        Q(
          o,
          'vent',
          [
            f.P(x0, y, 0.025),
            f.P(x0, y - 0.026, 0.025),
            f.P(x1, y - 0.026, 0.025),
            f.P(x1, y, 0.025),
          ],
          f.n,
        );
    }
  }
  if (d) border(o, f, (x0 + x1) / 2, lo, w, h, d);
}
function hall(o, d) {
  const r = cw(plan.hallOutline);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = F(a, b),
      bays = Math.round(f.len / 2.7),
      step = f.len / bays,
      holes = [];
    for (let k = 0; k < bays; k++) holes.push(rect((k + 0.5) * step, 7.6, step - 0.12, 1.85));
    for (let k = 0; k < bays; k++) holes.push(rect((k + 0.5) * step, 4.8, step - 0.12, 1.45));
    panel(o, 'wall', rect(f.len / 2, 0, f.len, 9.8), f, 0, d > 1 ? holes : []);
    for (const h of holes) louvers(o, f, h, d);
    if (d) {
      for (let k = 0; k <= bays; k++) {
        const x = Math.min(f.len - 0.025, Math.max(0.025, k * step));
        beam(o, 'frame', f.P(x, 0.05, 0.015), f.P(x, 9.8, 0.015), 0.055, 0.055, C.frame);
      }
      for (const y of [4.7, 6.35, 7.5, 9.58])
        beam(o, 'frame', f.P(0, y, 0.02), f.P(f.len, y, 0.02), 0.055, 0.06, C.frame);
    }
  }
  cap(o, 'entry', r, 0);
  cap(o, 'entry', r, -0.12, false);
  // A modest pitched cap is a concealed-roof estimate; archival photograph establishes only the eaves/envelope.
  const e = 9.8,
    h = 10.75,
    x0 = -15.22,
    x1 = 15.22,
    z = 9.2;
  Q(
    o,
    'roof',
    [
      [x0, e, -z],
      [x1, e, -z],
      [x1, h, 0],
      [x0, h, 0],
    ],
    [0, 1, -0.1],
  );
  Q(
    o,
    'roof',
    [
      [x0, h, 0],
      [x1, h, 0],
      [x1, e, z],
      [x0, e, z],
    ],
    [0, 1, 0.1],
  );
  for (const x of [-15, 15])
    tri(
      o,
      'wall',
      [
        [x, e, -9],
        [x, e, 9],
        [x, h, 0],
      ],
      [Math.sign(x), 0, 0],
    );
  if (d) {
    for (const zz of [-9.2, 9.2]) beam(o, 'frame', [x0, e, zz], [x1, e, zz], 0.12, 0.13, C.frame);
    beam(o, 'roof', [x0, h, 0], [x1, h, 0], 0.09, 0.12, C.roof);
  }
  if (d > 2) {
    for (let x = -14.5; x < 15; x += 1.8)
      for (const side of [-1, 1])
        beam(o, 'roof', [x, e + 0.01, side * 9.1], [x, h + 0.01, 0], 0.035, 0.035, C.roof);
  }
}
function pointed(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h * 0.67],
    [x, y + h],
    [x - w / 2, y + h * 0.67],
  ];
}
function doors(o, f, x, y, w, h, d) {
  const hole = rect(x, y, w, h);
  if (d > 1) {
    reveal(o, 'entry', hole, f, 0, -0.19);
    panel(o, 'shadow', hole, f, -0.19);
  } else panel(o, 'shadow', hole, f, 0.006);
  if (!d) return;
  border(o, f, x, y, w, h, d);
  for (const u of [x - w / 2 + w / 2])
    beam(o, 'frame', f.P(u, y, 0.018), f.P(u, y + h, 0.018), 0.045, 0.05, C.frame);
  const split = y + h * 0.43;
  beam(
    o,
    'frame',
    f.P(x - w / 2, split, 0.018),
    f.P(x + w / 2, split, 0.018),
    0.055,
    0.05,
    C.frame,
  );
  if (d > 1) {
    for (let k = 1; k < 4; k++) {
      const yy = split + ((y + h - split) * k) / 4;
      beam(o, 'frame', f.P(x - w / 2, yy, -0.08), f.P(x + w / 2, yy, -0.08), 0.027, 0.032, C.frame);
    }
    for (let k = 1; k < 4; k++) {
      const xx = x - w / 2 + (w * k) / 4;
      beam(o, 'frame', f.P(xx, split, -0.08), f.P(xx, y + h, -0.08), 0.027, 0.032, C.frame);
    }
  }
  if (d > 2) {
    for (let k = 1; k < 12; k++) {
      const xx = x - w / 2 + (w * k) / 12;
      beam(
        o,
        'frame',
        f.P(xx, y + 0.03, -0.11),
        f.P(xx, split - 0.035, -0.11),
        0.014,
        0.02,
        C.frame,
      );
    }
  }
}
function annex(o, d) {
  const r = cw(plan.annexOutline);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = F(a, b),
      front = Math.abs(a[1] - 13) < 1e-7 && Math.abs(b[1] - 13) < 1e-7;
    if (front) {
      const openings = Array.from({ length: 6 }, (_, k) => rect(1.05 + k * 2.15, 0.12, 1.9, 3.08));
      panel(o, 'entry', rect(f.len / 2, 0, f.len, 3.65), f, 0, d > 1 ? openings : []);
      for (let k = 0; k < 6; k++) doors(o, f, 1.05 + k * 2.15, 0.12, 1.9, 3.08, d);
    } else {
      const y0 = 3.65 + (13 - a[1]) * 0.15,
        y1 = 3.65 + (13 - b[1]) * 0.15;
      panel(
        o,
        'entry',
        [
          [0, 0],
          [f.len, 0],
          [f.len, y1],
          [0, y0],
        ],
        f,
      );
    }
  }
  cap(o, 'entry', r, 0);
  cap(o, 'entry', r, -0.12, false);
  Q(
    o,
    'roof',
    [
      [1.85, 4.25, 9],
      [15.15, 4.25, 9],
      [15.15, 3.65, 13.18],
      [1.85, 3.65, 13.18],
    ],
    [0, 1, 0.1],
  );
  // Own short return beside the principal entry; two narrow pointed vents are visible in the source.
  const a = [-1.4, 12.95],
    b = [2, 12.95],
    f = F(a, b),
    holes = [pointed(0.9, 1.75, 0.22, 0.75), pointed(2.3, 1.75, 0.22, 0.75)];
  panel(
    o,
    'entry',
    [
      [0, 0],
      [3.4, 0],
      [3.4, 3.7],
      [0, 3.2],
    ],
    f,
    0,
    d > 1 ? holes : [],
  );
  for (const h of holes) {
    if (d > 1) {
      reveal(o, 'entry', h, f, 0, -0.15);
      panel(o, 'shadow', h, f, -0.15);
    } else if (d) panel(o, 'shadow', h, f, 0.01);
  }
  cap(
    o,
    'entry',
    [
      [-1.4, 9],
      [2, 9],
      [2, 12.95],
      [-1.4, 12.95],
    ],
    0,
  );
  // Intrinsic low connector behind this return, rather than an unsupported facade panel.
  Q(
    o,
    'roof',
    [
      [-1.4, 3.2, 12.95],
      [2, 3.7, 12.95],
      [2, 4.25, 9],
      [-1.4, 4.25, 9],
    ],
    [0, 1, 0.1],
  );
  Q(
    o,
    'entry',
    [
      [-1.4, 0, 9],
      [-1.4, 0, 12.95],
      [-1.4, 3.2, 12.95],
      [-1.4, 4.25, 9],
    ],
    [-1, 0, 0],
  );
  if (d)
    for (const x of [2.1, 14.9])
      beam(o, 'frame', [x, 0, 13.035], [x, 6.1, 13.035], 0.1, 0.09, C.frame);
}
function parapet(o, d) {
  const f = F([2, 13.08], [15, 13.08]),
    r = [
      [0, 3.65],
      [13, 3.65],
      [13, 6.0],
      [12.75, 6.0],
      [12.75, 6.35],
      [12.4, 6.35],
      [12.2, 6.55],
      [0.8, 6.55],
      [0.6, 6.35],
      [0.25, 6.35],
      [0.25, 6.0],
      [0, 6.0],
    ];
  panel(o, 'entry', r, f, 0.045);
  reveal(o, 'entry', r, f, 0.045, -0.12);
  panel(o, 'entry', r, f, -0.12);
  if (d) {
    for (const y of [3.85, 5.95, 6.5])
      beam(o, 'frame', f.P(0.2, y, 0.09), f.P(12.8, y, 0.09), 0.08, 0.09, C.frame);
    for (const x of [0.27, 12.73])
      beam(o, 'frame', f.P(x, 3.8, 0.09), f.P(x, 6.2, 0.09), 0.12, 0.1, C.frame);
  }
  if (d > 1) {
    for (let x = 1.1; x < 12.5; x += 2.1)
      beam(o, 'frame', f.P(x, 3.95, 0.075), f.P(x, 5.87, 0.075), 0.035, 0.035, C.frame);
  }
  // The historic lettering/posters are intentionally not reproduced; panel geometry remains.
}
function canopy(o, d) {
  box(o, 'roof', 2, 15.2, 3.25, 3.38, 13.05, 15.75);
  beam(o, 'frame', [2, 3.22, 15.65], [15.2, 3.22, 15.65], 0.13, 0.14, C.frame);
  for (const x of [2.2, 5.4, 8.6, 11.8, 15.0]) {
    beam(o, 'frame', [x, 0.02, 15.6], [x, 3.28, 15.6], 0.095, 0.095, C.frame);
    if (d) {
      beam(o, 'frame', [x, 2.62, 15.6], [x, 3.2, 15.08], 0.05, 0.05, C.frame);
      beam(o, 'frame', [x, 3.2, 13.05], [x, 3.2, 15.7], 0.075, 0.08, C.frame);
    }
  }
  if (d > 2)
    for (const x of [2.2, 5.4, 8.6, 11.8, 15])
      box(o, 'frame', x - 0.065, x + 0.065, 0, 0.2, 15.53, 15.67);
}
function build(o, _f, d = 3) {
  hall(o, d);
  annex(o, d);
  parapet(o, d);
  canopy(o, d);
}
export const cremorneSkyline = (o, f) => build(o, f, 0);
export const cremorneDistrict = (o, f) => build(o, f, 1);
export const cremorneStreet = (o, f) => build(o, f, 2);
export const cremorneTheatreModel = {
  id: 'cremorne_theatre',
  key: 'cremorne_theatre',
  recipe: 'structure-cremorne-theatre.mjs',
  cell: 'r7/r7h',
  title: 'Cremorne Theatre, Brisbane (circa1934)',
  category: 'performance-sport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Historical circa1934 original Cremorne Theatre: whole tall hall/canvas-like wall panels, continuous dense upper and lower louvre banks, gently pitched roof, own low entrance annex/sloping cap, blank stepped/scalloped parapet, gridded door leaves/two pointed vents and thin projecting canopy on slender posts. Approximate photo-ratio footprint/roof/color/facing and archival site anchor. Historical1934only; no modern QPAC venue/gallery or street context mesh.',
  camera: [42, 21, 44],
  lookAt: [0, 4.8, 2],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 1.6, groundY: -0.16 },
  qaCameras: [
    {
      name: 'whole-tall-hall-louvres-and-own-entrance-assembly',
      position: [-35, 16, 39],
      lookAt: [0, 4.7, 2],
    },
    {
      name: 'upper-double-louvre-banks-and-gently-pitched-roof',
      position: [-23, 10, 20],
      lookAt: [-9, 7.3, 5],
    },
    {
      name: 'blank-stepped-parapet-canopy-open-underpass-and-gridded-doors',
      position: [22, 7, 27],
      lookAt: [8.6, 3.0, 13],
    },
    {
      name: 'whole-estimated-rear-and-left-end-envelope',
      position: [-31, 20, -35],
      lookAt: [0, 5, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent96m modern terrain frozen before geometry; historic grade and current host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cremorne-theatre.mjs',
    level: 'skyline',
    export: 'cremorneSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'cremorneDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'cremorneStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Historical-only representative1934appearance, valid1934-01-01through1935-01-01for dated opt-in. Native archival citation says circa1934, not2014capture. Original burned1954and never rebuilt; no modern QPAC namesake/gallery/streets/neighbor shops or interior represented.',
    'Only exact already-published1000x744 SLQ/John Oxley Library1934 exterior, native SHA19ad8bc9f9324a49c307cca073f2ecdf938280d6c and explicit PD-Australia matched. Six source families inventoried without conflicts. Other posters/performer/interior/attribution images unused; no supplemental photography/copied pixels/generated bitmap.',
    'All dimensions are estimates from one monochrome exterior:30x18m complete hall/10.75m ridge, low own annex/6.55m blank entrance parapet, louvre bays/blades, door leaves/frames, hidden rear/roof profile and canopy/post census. Muted canvas/lime/painted timber/metal roof and glazing colors are medium-fi interpretations, not a historic color/material survey. Recessed closed louvre backs avoid fabricating an interior.',
    'Exact archival site coordinate retained as approximate anchor with about30m uncertainty; original corners/footprint/facing are not mapped. Current tunnel line is modern orientation context only; visualization front approximate by60degrees. Own bounded photo-reconstructed extent, no false original native outline or contemporary geographic activation.',
    'Independent96m129x129at0.75m modern terrain, fixed approach[9,18], provider9.7675m, full relative[-2.6316,4.0578]. Raw tile/grid/PNG unchanged without fitting/flattening/clipping. Oversamples4.24m output pixels/coarser DEM; current gallery grading differs from1934, precise historic foot/threshold/host contact unknown. replaceFootprint=false.',
  ],
};
