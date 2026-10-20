/** Jefferson Memorial: Qualla photographs, mapped envelope and 1994 HABS elevations. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  white = rgb('dedbd0'),
  pale = rgb('ece9df'),
  granite = rgb('d2d0c6'),
  joint = rgb('b6b5ac'),
  bronze = rgb('414b47');
const floor = 4.62,
  columnHeight = 12.519025,
  architrave = floor + columnHeight;
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uu = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uu[pp.indexOf(p)], c);
    },
  };
}
function ring(o, slot, r0, r1, y0, y1, n, color, a0 = 0, a1 = Math.PI * 2, bottomCap = true) {
  const p = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n,
      b = a0 + ((a1 - a0) * (i + 1)) / n,
      m = (a + b) / 2;
    quad(
      o,
      slot,
      [p(r1, y0, a), p(r1, y0, b), p(r1, y1, b), p(r1, y1, a)],
      [Math.sin(m), 0, Math.cos(m)],
      color,
    );
    if (r0 > 0)
      quad(
        o,
        slot,
        [p(r0, y0, b), p(r0, y0, a), p(r0, y1, a), p(r0, y1, b)],
        [-Math.sin(m), 0, -Math.cos(m)],
        color,
      );
    for (const [y, ny] of [
      [y0, -1],
      [y1, 1],
    ]) {
      if (ny < 0 && !bottomCap) continue;
      if (r0 > 0)
        quad(o, slot, [p(r0, y, a), p(r1, y, a), p(r1, y, b), p(r0, y, b)], [0, ny, 0], color);
      else
        o.addTriangle(
          slot,
          ref,
          [[0, y, 0], p(r1, y, a), p(r1, y, b)],
          [0, ny, 0],
          [
            [0, 0],
            [0, 1],
            [1, 1],
          ],
          color,
        );
    }
  }
  if (a1 - a0 < Math.PI * 2 - 0.001)
    for (const [a, sign] of [
      [a0, -1],
      [a1, 1],
    ])
      quad(
        o,
        slot,
        [p(r0, y0, a), p(r1, y0, a), p(r1, y1, a), p(r0, y1, a)],
        [sign * Math.cos(a), 0, -sign * Math.sin(a)],
        color,
      );
}
function jointBand(o, r, y, n, a0 = 0, a1 = Math.PI * 2) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n,
      b = a0 + ((a1 - a0) * (i + 1)) / n,
      m = (a + b) / 2;
    quad(
      o,
      'marble',
      [
        [Math.sin(a) * r, y, Math.cos(a) * r],
        [Math.sin(b) * r, y, Math.cos(b) * r],
        [Math.sin(b) * r, y + 0.018, Math.cos(b) * r],
        [Math.sin(a) * r, y + 0.018, Math.cos(a) * r],
      ],
      [Math.sin(m), 0, Math.cos(m)],
      joint,
    );
  }
}
function spiralLine(o, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    x = (-dy / l) * 0.018,
    y = (dx / l) * 0.018;
  quad(
    o,
    'marble',
    [
      [a[0] + x, a[1] + y, a[2]],
      [b[0] + x, b[1] + y, b[2]],
      [b[0] - x, b[1] - y, b[2]],
      [a[0] - x, a[1] - y, a[2]],
    ],
    [0, 0, Math.sign(a[2])],
    joint,
  );
}
function column(o, x, z, a, d) {
  const t = facing(o, a, x, z),
    n = d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 8 : 16;
  if (d === 0) {
    loft(
      t,
      'marble',
      [radialRing(floor, 0.8, 0.8, n), radialRing(architrave, 0.68, 0.68, n)],
      white,
      { cap: false },
    );
    return;
  }
  const profiles =
    d === 1
      ? [
          [0, 0.8],
          [columnHeight - 0.25, 0.68],
        ]
      : d === 2
        ? [
            [0, 0.96],
            [0.5, 0.8],
            [columnHeight - 0.5, 0.68],
            [columnHeight - 0.25, 0.89],
          ]
        : [
            [0, 1.02],
            [0.14, 1.02],
            [0.19, 0.92],
            [0.3, 0.96],
            [0.42, 0.87],
            [0.54, 0.8],
            [columnHeight - 0.65, 0.68],
            [columnHeight - 0.5, 0.82],
            [columnHeight - 0.25, 0.89],
          ];
  loft(
    t,
    'marble',
    profiles.map(([y, r]) => radialRing(floor + y, r, r, n)),
    white,
    { cap: false },
  );
  B(t, 'marble', 0, architrave - 0.25, 0, 2.2, 0.25, 1.65, pale);
  if (d > 1) {
    // Horizontal Ionic cushions and visible spiral volutes, rather than Doric caps.
    B(t, 'marble', 0, architrave - 0.55, 0, 1.8, 0.3, 1.4, pale);
    for (const x of [-0.87, 0.87]) {
      const rr = Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n;
        return [x + Math.sin(a) * 0.34, architrave - 0.36 + Math.cos(a) * 0.34, -0.8];
      });
      loft(t, 'marble', [rr, rr.map((p) => [p[0], p[1], 0.8])], pale);
      if (d > 2)
        for (const z of [-0.815, 0.815])
          for (let i = 0; i < 14; i++) {
            const a = (i * Math.PI * 3.5) / 14,
              b = ((i + 1) * Math.PI * 3.5) / 14,
              r = 0.29 * (1 - i / 18),
              s = 0.29 * (1 - (i + 1) / 18);
            spiralLine(
              t,
              [x + Math.sin(a) * r, architrave - 0.36 + Math.cos(a) * r, z],
              [x + Math.sin(b) * s, architrave - 0.36 + Math.cos(b) * s, z],
            );
          }
    }
    if (d > 2)
      for (let i = 1; i < 7; i++) jointBand(t, 0.8 - i * 0.015, floor + 0.54 + i * 1.62, n);
  }
}
function steps(o, z0, z1, lo, hi, w, d) {
  const n = d === 0 ? 1 : d === 1 ? 4 : Math.round((hi - lo) / 0.17);
  for (let i = 0; i < n; i++) {
    const dep = (z1 - z0) / n,
      y = lo + ((hi - lo) * (i + 1)) / n;
    B(o, 'granite', 0, -1, z1 - dep * (i + 0.5), w, y + 1, dep + 0.01, granite);
  }
}
function statue(o, d) {
  if (d === 0) return;
  B(o, 'granite', 0, floor, 0, 3.9, 0.25, 3.9, rgb('55554c'));
  B(o, 'granite', 0, floor + 0.25, 0, 3.2, 1.58, 3.2, rgb('3c403c'));
  const y = floor + 1.83;
  if (d < 2) {
    B(o, 'bronze', 0, y, 0, 1.4, 5.79, 0.7, bronze);
    return;
  }
  B(o, 'bronze', 0, y, 0, 2.1, 0.18, 1.4, bronze);
  for (const s of [-1, 1]) {
    beam(o, 'bronze', [s * 0.46, y + 0.25, 0.12], [s * 0.4, y + 2.35, 0], 0.47, 0.5, bronze);
    B(o, 'bronze', s * 0.46, y + 0.14, 0.25, 0.55, 0.3, 1.0, bronze);
  }
  loft(
    o,
    'bronze',
    [
      [y + 1.25, 0.95, 0.52],
      [y + 2.5, 0.7, 0.5],
      [y + 4.4, 1.02, 0.57],
      [y + 4.65, 0.7, 0.38],
    ].map(([h, rx, rz]) => radialRing(h, rx, rz, d > 2 ? 20 : 12)),
    bronze,
  );
  sphere(
    o,
    'bronze',
    [0, y + 5.13, 0.02],
    [0.52, 0.66, 0.47],
    bronze,
    d > 2 ? 24 : 12,
    d > 2 ? 12 : 8,
  );
  sphere(o, 'bronze', [0, y + 5.35, -0.13], [0.58, 0.45, 0.5], rgb('303b36'), d > 2 ? 20 : 10, 8);
  for (const s of [-1, 1]) {
    beam(o, 'bronze', [s * 0.85, y + 4.35, 0], [s * 1.05, y + 3.15, 0.12], 0.4, 0.45, bronze);
    beam(o, 'bronze', [s * 1.05, y + 3.15, 0.12], [s * 0.94, y + 2.6, 0.4], 0.32, 0.36, bronze);
    sphere(o, 'bronze', [s * 0.94, y + 2.55, 0.4], [0.2, 0.27, 0.2], bronze, 10, 6);
  }
  B(o, 'bronze', 0.95, y + 2.15, 0.45, 0.24, 0.8, 0.18, rgb('62675b'));
  if (d > 2)
    for (const s of [-1, 1])
      beam(
        o,
        'bronze',
        [s * 0.2, y + 4.7, 0.36],
        [s * 0.68, y + 3.8, 0.55],
        0.24,
        0.12,
        rgb('556059'),
      );
}
function dome(o, d, n) {
  const profiles =
    d === 0
      ? [
          [floor + 15.3, 18.75],
          [floor + 18.5, 18.0],
          [floor + 23.2, 13.5],
          [floor + 27.6, 7],
          [floor + 29.165, 0.05],
        ]
      : [
          [floor + 15.3, 18.75],
          [floor + 16.65, 18.75],
          [floor + 16.65, 17.8],
          [floor + 18.1, 17.8],
        ];
  if (d > 0) {
    for (let j = 0; j < 6; j++) {
      const y = floor + 18.1 + j * 0.52,
        r = 17.6 - j * 0.43;
      profiles.push([y, r], [y + 0.52, r]);
    }
    const r = 15.02,
      y0 = floor + 21.22,
      h = 7.945,
      levels = d === 1 ? 5 : d === 2 ? 10 : 18;
    for (let j = 0; j <= levels; j++) {
      const a = ((j / levels) * Math.PI) / 2;
      profiles.push([y0 + h * Math.sin(a), Math.max(0.04, r * Math.cos(a))]);
    }
  }
  loft(
    o,
    'marble',
    profiles.map(([y, r]) => radialRing(y, r, r, n)),
    pale,
    { cap: false },
  );
  // A hollow inner shell preserves an open chamber beneath the outer dome.
  if (d > 0) {
    const levels = d > 2 ? 14 : d === 1 ? 4 : 8;
    for (let j = 0; j < levels; j++)
      for (let i = 0; i < n; i++) {
        const p = (u, v) => {
          const a = (u * Math.PI) / 2,
            b = v * Math.PI * 2,
            r = Math.max(0.03, 15.5 * Math.cos(a));
          return [Math.sin(b) * r, floor + 15.0 + 13.6 * Math.sin(a), Math.cos(b) * r];
        };
        const pts = [
            p(j / levels, i / n),
            p(j / levels, (i + 1) / n),
            p((j + 1) / levels, (i + 1) / n),
            p((j + 1) / levels, i / n),
          ],
          nn = normalFor(...pts).map((v) => -v);
        quad(o, 'marble', pts, nn, white);
      }
  }
  if (d > 2) {
    // Thin horizontal masonry joints; no photographic texture pixels are baked in.
    for (let j = 1; j < 16; j++) {
      const a = (j * Math.PI) / 32,
        y = floor + 21.22 + 7.945 * Math.sin(a),
        r = 15.02 * Math.cos(a);
      jointBand(o, r + 0.01, y, n);
    }
  }
}
function memorial(o, _frame, d = 3) {
  const n = d === 0 ? 12 : d === 1 ? 16 : d === 2 ? 36 : 80;
  // Circular upper stairs and north portico on their immediate raised terrace.
  // Immediate raised terrace: lawn plane, retaining wall and open stair throat.
  const a0 = (50 * Math.PI) / 180,
    a1 = (310 * Math.PI) / 180,
    tn = d === 0 ? 12 : d === 1 ? 24 : d === 2 ? 40 : 64;
  for (let i = 0; i < tn; i++) {
    const a = a0 + ((a1 - a0) * i) / tn,
      b = a0 + ((a1 - a0) * (i + 1)) / tn,
      p = (r, a) => [Math.sin(a) * r, 2.05, Math.cos(a) * r];
    quad(o, 'grass', [p(29, a), p(44.8, a), p(44.8, b), p(29, b)], [0, 1, 0], rgb('7a855f'));
  }
  // The underside lies beneath the independently checked ground; omit its hidden cap.
  ring(o, 'marble', 44.8, 45.05, -1, 2.15, tn, white, a0, a1, false);
  if (d > 0) ring(o, 'marble', 44.6, 45.2, 2.15, 2.3, tn, pale, a0, a1);
  for (const sign of [-1, 1]) {
    beam(o, 'marble', [sign * 34.32, 0.6, 28.8], [sign * 26.4, 0.6, 31.5], 0.45, 3.0, white);
    if (d > 0)
      beam(o, 'marble', [sign * 34.32, 2.2, 28.8], [sign * 26.4, 2.2, 31.5], 0.8, 0.2, pale);
    const pts = [
      [sign * 26.8, 2.05, 31.5],
      [sign * 34.32, 2.05, 28.8],
      [sign * 22.22, 2.05, 18.64],
      [sign * 16.8, 2.05, 31.5],
    ];
    quad(o, 'grass', pts, [0, 1, 0], rgb('7a855f'));
  }
  const count = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 7 : 15;
  for (let i = 0; i < count; i++) {
    const r = 29.05 - (i * 3.3) / count,
      y = 2.05 + ((floor - 2.05) * (i + 1)) / count;
    ring(o, 'granite', 0, r, -1, y, n, granite);
  }
  B(o, 'granite', 0, -1, 22.7, 31.8, floor + 1, 14.4, granite);
  // The native approach outline expands twice toward the basin; it is not a52m rectangle.
  steps(facing(o, 0, -0.225, 0), 46.4, 51.6, 0, 2.05, 62.75, d);
  B(o, 'granite', -0.35, -1, 44.1, 61.1, 3.05, 4.6, granite);
  B(o, 'granite', -0.15, -1, d === 0 ? 36.5 : 37.4, 52.3, 3.05, d === 0 ? 10.6 : 8.8, granite);
  if (d > 0) B(o, 'granite', 0, -1, 32.1, 52, 3.05, 1.8, granite);
  steps(o, 29.4, 31.2, 2.05, floor, 33.4, d);
  for (const [rear, middle, front] of [
    [-26.1, -30.7, -31.5],
    [25.8, 30.0, 31.0],
  ]) {
    const path =
      d === 0
        ? [
            [rear, 30.3],
            [rear, 41.8],
            [front, 41.8],
            [front, 51.7],
          ]
        : [
            [rear, 30.3],
            [rear, 41.8],
            [middle, 41.8],
            [middle, 46.0],
            [front, 46.0],
            [front, 51.7],
          ];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      beam(o, 'granite', [a[0], 0.75, a[1]], [b[0], 0.75, b[1]], 1.1, 3.5, granite);
      if (d > 0) beam(o, 'granite', [a[0], 2.6, a[1]], [b[0], 2.6, b[1]], 1.4, 0.2, pale);
    }
  }
  // Four curved piers leave four broad axial openings, each with four inner columns.
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    ring(
      o,
      'marble',
      15.4,
      18.4,
      floor,
      architrave,
      n / 4,
      white,
      a + Math.PI / 9,
      a + Math.PI / 2 - Math.PI / 9,
    );
    const t = facing(o, a);
    for (const x of [-5.4, -1.8, 1.8, 5.4]) column(t, x, 15.7, 0, d);
    if (d > 2)
      for (let y = floor + 0.7; y < architrave; y += 1.0)
        jointBand(o, 18.409, y, n / 4, a + Math.PI / 9, a + Math.PI / 2 - Math.PI / 9);
  }
  for (let i = 0; i < 26; i++) {
    const a = ((50 + (i * 260) / 25) * Math.PI) / 180;
    column(o, Math.sin(a) * 23, Math.cos(a) * 23, a, d);
  }
  for (let i = 0; i < 8; i++) column(o, -13.2 + (i * 26.4) / 7, 28.2, 0, d);
  for (const x of [-13.2, 13.2]) for (const z of [23.9, 19.6]) column(o, x, z, 0, d);
  // The annular attic joins the inner chamber wall to the outer dome's springing.
  // Its inward face closes the former sky slit without blocking the chamber below.
  ring(o, 'marble', 15.4, 24.65, architrave, floor + 15.3, n, white);
  if (d > 0) {
    ring(o, 'marble', 24.1, 25.05, architrave + 2.55, architrave + 2.85, n, pale);
    ring(o, 'marble', 24.6, 24.9, architrave + 2.85, architrave + 3.5, n, white);
  }
  const roofY = architrave + 2.85;
  B(o, 'marble', 0, architrave, 22.95, 31.09, 2.5, 13.72, white);
  B(o, 'marble', 0, architrave + 2.5, 22.95, 31.8, 0.35, 14.1, pale);
  // Pediment and shallow gable retain the broad octastyle portico silhouette.
  const tip = roofY + 3.048,
    z = 30.02,
    w = 31.09;
  for (const zz of [z, 16.09])
    o.addTriangle(
      'marble',
      ref,
      [
        [-w / 2, roofY, zz],
        [w / 2, roofY, zz],
        [0, tip, zz],
      ],
      [0, 0, zz === z ? 1 : -1],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      white,
    );
  for (const s of [-1, 1]) {
    const pts = [
      [(s * w) / 2, roofY, z],
      [0, tip, z],
      [0, tip, 16.09],
      [(s * w) / 2, roofY, 16.09],
    ];
    quad(o, 'marble', pts, [s * 0.2, 1, 0], pale);
    if (d > 0)
      beam(o, 'marble', [(s * w) / 2, roofY, z + 0.1], [0, tip, z + 0.1], 0.35, 0.35, pale);
  }
  dome(o, d, n);
  if (d > 1) {
    for (let i = 0; i < Math.round(w / 0.42); i++)
      B(o, 'marble', -w / 2 + (i + 0.5) * 0.42, architrave + 2.25, 30.08, 0.19, 0.25, 0.3, pale);
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n;
      if (Math.cos(a) > 0.73) continue;
      const t = facing(o, a, Math.sin(a) * 24.7, Math.cos(a) * 24.7);
      B(t, 'marble', 0, architrave + 2.25, 0, 0.2, 0.25, 0.3, pale);
    }
    // Original low relief drafting committee, intentionally without readable lettering.
    for (const [x, h] of [
      [-5, 1.0],
      [-2.8, 1.25],
      [0, 1.9],
      [2.8, 1.25],
      [5, 1],
    ]) {
      B(o, 'marble', x, roofY + 0.12, z + 0.04, 0.5, h, 0.18, pale);
      sphere(o, 'marble', [x, roofY + h + 0.25, z + 0.13], [0.22, 0.27, 0.18], pale, 10, 6);
    }
    B(o, 'marble', 0, roofY + 0.55, z + 0.2, 3.8, 0.16, 0.25, pale);
  }
  statue(o, d);
}
export function jeffersonSkyline(o) {
  memorial(o, undefined, 0);
}
export function jeffersonDistrict(o) {
  memorial(o, undefined, 1);
}
export function jeffersonStreet(o) {
  memorial(o, undefined, 2);
}
const surfaces = {
  marble: { ...landmarkSurfaces.stone, graph: 'stone_marble', slot: 'wall' },
  granite: { ...landmarkSurfaces.stone, graph: 'stone_granite' },
  bronze: { ...landmarkSurfaces.metal, graph: 'metal_bronze_cast' },
  grass: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
};
export const jeffersonModel = {
  id: 'jefferson_memorial',
  recipe: 'structure-jefferson-memorial.mjs',
  key: 'jefferson_memorial',
  cell: 'dq/dqc',
  title: 'Jefferson Memorial',
  brief:
    'Circular marble memorial with 26 outer Ionic columns, eight-column north pedimented portico and four axial inner openings, stepped dome, circular stairs and bronze standing silhouette.',
  camera: [105, 65, 130],
  lookAt: [0, 12, 7],
  qaCameras: [
    { name: 'front', position: [0, 22, 140], lookAt: [0, 15, 5] },
    { name: 'portico-detail', position: [19, 19, 43], lookAt: [9, 15.5, 27] },
    { name: 'chamber-detail', position: [0, 9, 12], lookAt: [0, 9, 0] },
    { name: 'back', position: [90, 55, -110], lookAt: [0, 14, 0] },
  ],
  build: memorial,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'North approach [0,52] at the mapped main stair flight; independent terrain unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-jefferson-memorial.mjs',
    level: 'skyline',
    export: 'jeffersonSkyline',
    errorMeters: 2.6,
    surfaces,
    authoredLevels: {
      district: { export: 'jeffersonDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'jeffersonStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Started with three cleared published Qualla CC0 aerials, supplemented by a verified creator-CC0 front photograph, explicit NPS public-domain cleaned-dome original and native original HABS1994 north elevation/longitudinal section. All native title blocks and drawing credits inspected; earlier attribution-licensed images excluded from current approval. Not a survey or photogrammetric reconstruction.',
    'NPS text establishes26 outer,12 portico and16 inner columns. Map part counts are incomplete. The measured north elevation supplies12.519025m stylobate-to-architrave height; the longitudinal section supplies approximately29.16555m main-floor-to-dome height. The elevation chain instead totals29.708475m; this0.542925m original-source discrepancy is retained in survey-controls.json. Overall model proportions follow the section. Fine volutes, dome masonry and hidden pier openings are simplified.',
    'Main circular steps, north stair flight and immediate raised supporting terrace included; wider gardens, Tidal Basin, distant approachway, undercroft and modern accessibility equipment excluded. Vertical stair levels are approximate relative to the independent terrain contact.',
    'Standing statue and pediment relief are original simplified silhouettes, not portrait-quality sculptures. Inscriptions, exact coffer pattern and detailed interiors are excluded; no photo pixels are embedded.',
    'Independent terrain is preserved unchanged and foundation extends beneath it. Another host DEM can change exact ground contact.',
  ],
};
