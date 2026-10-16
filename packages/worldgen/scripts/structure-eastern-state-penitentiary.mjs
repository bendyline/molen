/** Eastern State: surviving radial prison, later infill, castellated gatehouse and perimeter. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, c, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const framePath = new URL(
  '../../../content/worldgen/source/places/dr/dr4/eastern_state_penitentiary/map-frame.json',
  import.meta.url,
);
const stone = rgb('898778'),
  weather = rgb('74766b'),
  pale = rgb('b7b5a7'),
  roofColor = rgb('555a59');
function oriented(r, positive = true) {
  r = cleanRing(r);
  const area = r.reduce(
    (s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
    0,
  );
  if (area > 0 !== positive) r.reverse();
  return r;
}
function prism(o, rings, y0, y1, color = stone, capColor = roofColor, slot = 'stone') {
  const rr = rings.map((r, i) => oriented(r, i === 0));
  for (const r of rr)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      quad(
        o,
        slot,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        [dz, 0, -dx],
        color,
      );
    }
  const points = rr.flat(),
    holes = [];
  let n = rr[0].length;
  for (const r of rr.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ii = earcut(points.flat(), holes);
  for (const [y, normal, col] of [
    [y0, [0, -1, 0], color],
    [y1, [0, 1, 0], capColor],
  ])
    for (let i = 0; i < ii.length; i += 3) {
      const p = ii.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]);
      o.addTriangle(
        'concrete',
        'palette:#ffffff',
        p,
        normal,
        p.map((q) => [q[0], q[2]]),
        col,
      );
    }
}
function bar(o, a, b, y, h, w, color = stone, slot = 'stone') {
  beam(o, slot, [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]], w, h, color);
}
function rect(a, b, w) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    nx = dz / len,
    nz = -dx / len;
  return [a, b].flatMap((p, i) =>
    i === 0
      ? [
          [p[0] + (nx * w) / 2, p[1] + (nz * w) / 2],
          [p[0] - (nx * w) / 2, p[1] - (nz * w) / 2],
        ]
      : [
          [p[0] - (nx * w) / 2, p[1] - (nz * w) / 2],
          [p[0] + (nx * w) / 2, p[1] + (nz * w) / 2],
        ],
  );
}
function planeWindow(o, x, y, z, w, h, nx, nz, detail) {
  const tx = nz,
    tz = -nx,
    pp = (u, v, d = 0.05) => [x + tx * u + nx * d, y + v, z + tz * u + nz * d];
  quad(o, 'glass', [pp(-w / 2, 0), pp(w / 2, 0), pp(w / 2, h), pp(-w / 2, h)], [nx, 0, nz], c.dark);
  if (detail < 2) return;
  for (const u of [-w / 2 - 0.09, w / 2 + 0.09])
    beam(o, 'stone', pp(u, -0.1, 0.1), pp(u, h + 0.1, 0.1), 0.16, 0.18, pale);
  for (const v of [-0.1, h + 0.1])
    beam(o, 'stone', pp(-w / 2 - 0.18, v, 0.12), pp(w / 2 + 0.18, v, 0.12), 0.18, 0.18, pale);
  beam(o, 'metal', pp(0, 0, 0.15), pp(0, h, 0.15), 0.05, 0.05, c.dark);
  if (detail > 2)
    for (const v of [0.35, 0.7])
      beam(o, 'metal', pp(-w / 2, h * v, 0.16), pp(w / 2, h * v, 0.16), 0.055, 0.055, pale);
}
function pitched(o, a, b, w, eave, rise, detail, lights = true) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    tx = dx / len,
    tz = dz / len,
    nx = tz,
    nz = -tx;
  for (const sign of [-1, 1]) {
    const p = [
      [a[0] + (sign * nx * w) / 2, eave, a[1] + (sign * nz * w) / 2],
      [b[0] + (sign * nx * w) / 2, eave, b[1] + (sign * nz * w) / 2],
      [b[0], eave + rise, b[1]],
      [a[0], eave + rise, a[1]],
    ];
    if (sign > 0) p.reverse();
    quad(o, 'roof', p, normalFor(...p), roofColor);
  }
  for (const [p, sign] of [
    [a, -1],
    [b, 1],
  ])
    o.addConvexPolygon(
      'stone',
      'palette:#ffffff',
      [
        [p[0] + (nx * w) / 2, eave, p[1] + (nz * w) / 2],
        [p[0] - (nx * w) / 2, eave, p[1] - (nz * w) / 2],
        [p[0], eave + rise, p[1]],
      ],
      [tx * sign, 0, tz * sign],
      (p) => [p[0], p[1]],
      stone,
    );
  if (!detail || !lights) return;
  const count = Math.max(1, Math.floor(len / (detail === 1 ? 13 : 6.4)));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.55) / count,
      x = a[0] + dx * t,
      z = a[1] + dz * t;
    // Paired cell skylights and the raised corridor lanterns are characteristic of the surviving roofs.
    for (const sign of [-1, 1]) {
      const cx = x + nx * sign * w * 0.29,
        cz = z + nz * sign * w * 0.29,
        yy = eave + rise * 0.42;
      const aa = [cx - tx * 0.7, cz - tz * 0.7],
        bb = [cx + tx * 0.7, cz + tz * 0.7];
      prism(o, [rect(aa, bb, 1.3)], yy, yy + 0.55, pale, c.glass, 'concrete');
    }
    if (detail > 1 && i % 3 === 0) {
      const aa = [x - tx * 1.1, z - tz * 1.1],
        bb = [x + tx * 1.1, z + tz * 1.1];
      prism(o, [rect(aa, bb, 1.3)], eave + rise, eave + rise + 0.65, weather, c.glass, 'metal');
    }
  }
}
const wings = [
  { name: 'Cellblock 1', a: [7, 5], b: [82, 80], w: 21, e: 5.2, r: 4.1 },
  { name: 'Cellblock 2', a: [11, -1], b: [91, -1], w: 20, e: 5.1, r: 3.9 },
  { name: 'Cellblock 3 / hospital', a: [10, -17], b: [88, -87], w: 18, e: 7.5, r: 4.4 },
  { name: 'Cellblock 4', a: [4, -20], b: [5, -94], w: 18, e: 5.4, r: 4 },
  { name: 'Cellblock 5', a: [-18, -18], b: [-76, -88], w: 23, e: 7.4, r: 4.6 },
  { name: 'Cellblock 6', a: [-17, -8], b: [-85, -8], w: 22, e: 6.7, r: 4.4 },
  { name: 'Cellblock 7', a: [-7, 8], b: [-79, 74], w: 22, e: 7.3, r: 4.6 },
];
const added = [
  { a: [8, 12], b: [55, 79], w: 14, e: 4.6, r: 1.8 }, // Cellblock 9
  { a: [-3, 13], b: [-51, 78], w: 13, e: 4.6, r: 1.8 }, // Cellblock 8
  { a: [15, 6], b: [86, 31], w: 14, e: 4.6, r: 2.2 }, // Cellblock 10
  { a: [16, -8], b: [87, -44], w: 14, e: 4.6, r: 2.4 }, // Cellblock 11
  { a: [17, -15], b: [89, -66], w: 11, e: 5.2, r: 2.3 }, // Cellblock 14
  { a: [-25, 9], b: [-83, 28], w: 11, e: 6.3, r: 3.5 }, // Cellblock 12
  { a: [22, 19], b: [87, 51], w: 9, e: 4.8, r: 2.4 }, // Cellblock 13
];
const corners = [
  [-97.1, 91.3],
  [99.8, 96.1],
  [104, -101],
  [-91.2, -104.4],
];
function castleBlock(o, x, z, w, d, height, detail) {
  B(o, 'stone', x, -3, z, w, height + 3, d, stone);
  B(o, 'concrete', x, height - 0.4, z, w + 0.5, 0.4, d + 0.5, pale);
  if (detail)
    for (const sign of [-1, 1])
      for (let j = 0; j < 3; j++) {
        B(
          o,
          'stone',
          x + (j - 1) * w * 0.34,
          height,
          z + sign * (d / 2 - 0.35),
          w * 0.2,
          1.2,
          0.75,
          weather,
        );
        B(
          o,
          'stone',
          x + sign * (w / 2 - 0.35),
          height,
          z + (j - 1) * d * 0.34,
          0.75,
          1.2,
          d * 0.2,
          weather,
        );
      }
}
function gatehouse(o, frame, detail) {
  const f = frame.features.find((f) => f.id === 'buildings/35184422281912');
  if (detail) prism(o, f.rings, -3, 9.5, stone);
  else B(o, 'stone', 1, -3, 91, 63, 13.5, 12, stone);
  // Projecting towers flank the low, crenellated entrance elevation.
  for (const x of [-25.5, 27]) {
    castleBlock(o, x, 91, 8.2, 12.7, 14.5, detail);
    if (detail)
      for (const yy of [1.2, 6.2, 11.2])
        for (const dx of [-2, 0, 2])
          planeWindow(o, x + dx, yy, 97.4, 0.7, yy > 10 ? 1.8 : 3.2, 0, 1, detail);
  }
  bar(o, [-21.5, 96.9], [23, 98], 0, 12.4, 1.2, stone);
  if (detail) {
    bar(o, [-22, 96.9], [23, 98], 12.2, 0.45, 1.7, pale, 'concrete');
    for (let i = 0; i < 15; i++) {
      const t = i / 14;
      B(o, 'stone', -21.5 + t * 44.5, 12.65, 96.9 + t * 1.1, 1.8, 1.25, 1.3, weather);
    }
    for (const x of [-18, -12, -6, 9, 15, 21])
      planeWindow(o, x, 3.1, 97.55 + ((x + 21.5) / 44.5) * 1.1, 0.85, 6.4, -0.0247, 0.9997, detail);
  }
  castleBlock(o, 2.3, 85.8, 7.8, 8.6, 22.5, detail);
  if (detail) {
    planeWindow(o, 2.3, 15.3, 90.15, 0.8, 4.8, 0, 1, detail);
    planeWindow(o, 6.25, 15.3, 85.8, 0.8, 4.8, 1, 0, detail);
  }
  // A tall pointed portal is visible above the later low rectangular entrance barbican.
  if (detail) {
    const x = 1.5,
      z = 98.8;
    const p = [
      [x - 2.1, 0, z],
      [x + 2.1, 0, z],
      [x + 2.1, 8, z],
      [x, 10.3, z],
      [x - 2.1, 8, z],
    ];
    o.addConvexPolygon('glass', 'palette:#ffffff', p, [0, 0, 1], (q) => [q[0], q[1]], c.dark);
    for (const sign of [-1, 1]) {
      bar(o, [x + sign * 3, 97.5], [x + sign * 3, 100.2], 0, 12.8, 0.8, weather);
      beam(o, 'stone', [x + sign * 3, 12.8, 98.5], [x + sign * 3, 14.7, 98.5], 0.65, 0.65, pale);
    }
    for (const sign of [-1, 1])
      beam(o, 'stone', [x + sign * 2.25, 8, 98.9], [x, 10.5, 98.9], 0.4, 0.4, pale);
    B(o, 'stone', x, 0, 100.1, 9.8, 5.2, 3.4, weather);
    B(o, 'glass', x, 0, 101.83, 2.6, 3.7, 0.08, 'dark');
    for (const dx of [-1.55, 1.55]) B(o, 'stone', x + dx, 0, 101.89, 0.45, 4, 0.4, pale);
    B(o, 'stone', x, 3.75, 101.9, 3.6, 0.5, 0.4, pale);
    for (const xx of [-14, 16])
      for (const zz of [84, 90]) B(o, 'stone', xx, 10, zz, 1.1, 2.3, 1.3, weather);
  }
}
function build(o, frame, detail) {
  if (detail) prism(o, frame.features[0].rings, -3, 4.2, weather);
  for (const w of wings) {
    prism(o, [rect(w.a, w.b, w.w)], detail ? 4.1 : -3, w.e, stone);
    pitched(o, w.a, w.b, w.w + 0.6, w.e, w.r, detail);
    if (detail > 1) {
      const dx = w.b[0] - w.a[0],
        dz = w.b[1] - w.a[1],
        len = Math.hypot(dx, dz),
        nx = dz / len,
        nz = -dx / len,
        n = Math.floor(len / 4.7);
      for (let i = 1; i < n; i++)
        for (const sign of [-1, 1]) {
          const t = i / n,
            x = w.a[0] + dx * t + nx * sign * (w.w / 2 + 0.02),
            z = w.a[1] + dz * t + nz * sign * (w.w / 2 + 0.02);
          planeWindow(o, x, 1.6, z, 0.65, 1.5, nx * sign, nz * sign, detail === 3 ? 2 : 1);
        }
    }
  }
  for (const w of added) {
    prism(o, [rect(w.a, w.b, w.w)], detail ? 4.1 : -3, w.e, weather);
    pitched(o, w.a, w.b, w.w, w.e, w.r, detail > 1 ? 1 : 0);
  }
  // Hub roof and its low surveillance lantern; the tall historic illustration turret is not restored.
  const hub = radialRing(0, 8.4, 8.4, 8, [-2, -5]).map((p) => [p[0], p[2]]);
  prism(o, [hub], 4, 9.2, stone);
  loft(
    o,
    'roof',
    [radialRing(9.2, 9, 9, 8, [-2, -5]), radialRing(11.3, 2.7, 2.7, 8, [-2, -5])],
    roofColor,
  );
  B(o, 'metal', -2, 11.2, -5, 3.5, 0.7, 3.5, weather);
  if (detail)
    for (const f of frame.features.slice(1, 7)) {
      if (f.id === 'buildings/35184422281912') continue;
      prism(o, f.rings, -3, 5, stone);
      const r = f.rings[0],
        min = [0, 1].map((k) => Math.min(...r.map((p) => p[k]))),
        max = [0, 1].map((k) => Math.max(...r.map((p) => p[k])));
      pitched(
        o,
        [(min[0] + max[0]) / 2, min[1]],
        [(min[0] + max[0]) / 2, max[1]],
        max[0] - min[0],
        5,
        2,
        0,
        false,
      );
    }
  // Separate 30-foot perimeter follows three mapped corner towers; northeast closure is an interpreted continuation.
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    if (i === 0) {
      bar(o, a, [-30.5, 92.9], -3, 12.1, 1.8, stone);
      bar(o, [31.7, 94.6], b, -3, 12.1, 1.8, stone);
    } else bar(o, a, b, -3, 12.1, 1.8, stone);
    if (detail && i !== 0) bar(o, a, b, 9.05, 0.3, 2.15, pale, 'concrete');
  }
  for (const [x, z] of corners) {
    const n = detail ? 8 : 6;
    loft(
      o,
      'stone',
      [radialRing(-3, 3.75, 3.75, n, [x, z]), radialRing(10.4, 3.75, 3.75, n, [x, z])],
      stone,
    );
    if (detail) {
      loft(
        o,
        'concrete',
        [radialRing(10.4, 4.1, 4.1, 8, [x, z]), radialRing(10.8, 4.1, 4.1, 8, [x, z])],
        pale,
      );
      B(o, 'brick', x, 10.8, z, 3.6, 3.1, 3.6, 'brick');
      B(o, 'roof', x, 13.9, z, 4, 0.25, 4, 'dark');
      for (const sign of [-1, 1]) {
        planeWindow(o, x, 11.4, z + sign * 1.82, 2.5, 1.7, 0, sign, detail);
        planeWindow(o, x + sign * 1.82, 11.4, z, 2.5, 1.7, sign, 0, detail);
      }
    }
  }
  gatehouse(o, frame, detail);
}
export function easternState(o, frame) {
  build(o, frame, 3);
}
export function easternStateSkyline(o) {
  // Match the darker shared masonry/slate appearance after those graphs disappear at skyline distance.
  const flat = Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, ...args) => {
        const color = args.at(-1);
        if (Array.isArray(color))
          args[args.length - 1] = color.map((v) => v * (slot === 'roof' ? 0.3 : 0.65));
        o[name](slot, ref, ...args);
      },
    ]),
  );
  build(flat, JSON.parse(fs.readFileSync(framePath)), 0);
}
export function easternStateDistrict(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 1);
}
export function easternStateStreet(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 2);
}
const surfaces = {
  ...landmarkSurfaces,
  glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
};
export const easternStateModel = {
  id: 'eastern_state_penitentiary',
  recipe: 'structure-eastern-state-penitentiary.mjs',
  key: 'eastern_state_penitentiary',
  cell: 'dr/dr4',
  title: 'Eastern State Penitentiary',
  brief:
    'Surviving radial prison with seven original cellblock roofs, later infill blocks, central hub, castellated Fairmount Avenue gatehouse, high stone perimeter and watch boxes.',
  camera: [265, 180, 320],
  mediumFiContext: { scale: 2.5 },
  build: easternState,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Fairmount Avenue entry [0,99] defines the 27.45 m Terrarium datum. Preserved coarse host elevations span -1.512113..3.535385 m across the mapped footprint; lower closures extend to -3 m. These are not surveyed pavement levels.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-eastern-state-penitentiary.mjs',
    level: 'skyline',
    export: 'easternStateSkyline',
    errorMeters: 4,
    authoredLevels: {
      district: { export: 'easternStateDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'easternStateStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'Original medium-fi surviving exterior from local Qualla masonry/courtyard photographs, generalized current footprints, museum map and inspected archival HABS exterior views; not a measured survey or an exact 2026 condition inventory.',
    'Seven original radial wings, later infill and separate gatehouse are differentiated. Detailed decay, exact skylight counts, hidden roof joins, smaller yard partitions and service fixtures are generalized.',
    'The 1855 hero lithograph is rejected as current form evidence; its historic central turret and rows of separate exercise yards are not restored.',
    'Three mapped corner controls establish the perimeter; northeast corner closure, roof heights and unseen rear details remain photographic interpretations. Ground contact uses coarse host terrain, not surveyed pavement levels.',
    'No interiors, surrounding streets, temporary visitor attractions or reference-photo textures are included. Research images remain local and are not embedded in runtime packs.',
  ],
};
