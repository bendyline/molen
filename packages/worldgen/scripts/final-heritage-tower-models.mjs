/** Individually researched late nineteenth-century and modern monument exteriors. */

import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, cross, loft, normalize, radialRing, sphere } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { annulus, archBay, face, tau, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const hermannFrameBytes = readFileSync(
  structureSourcePath('n0571_hermannsdenkmal', 'map-frame.json'),
);

function polygon(out, slot, ring, bottom, top, color) {
  const p = ring.slice();
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.001) p.pop();
  if (
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0) > 0
  )
    p.reverse();
  const y = (v) => (typeof top === 'function' ? top(v) : top);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      out,
      slot,
      [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], y(b), b[1]],
        [a[0], y(a), a[1]],
      ],
      color,
    );
  }
  const ids = earcut(p.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => [p[k][0], y(p[k]), p[k][1]]);
    if ((q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) < 0)
      q.reverse();
    triangle(out, slot, q, color);
    triangle(out, slot, q.map(([x, _y, z]) => [x, bottom, z]).reverse(), color);
  }
}

function limb(out, slot, points, radii, color, sides = 24) {
  const rings = points.map((p, i) => {
    const q = points[Math.min(i + 1, points.length - 1)],
      a = points[Math.max(0, i - 1)];
    const axis = normalize(q.map((v, j) => v - a[j]));
    const u = normalize(cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])),
      v = cross(axis, u);
    return Array.from({ length: sides }, (_, k) =>
      p.map(
        (n, j) =>
          n + (u[j] * Math.cos((k / sides) * tau) + v[j] * Math.sin((k / sides) * tau)) * radii[i],
      ),
    );
  });
  // Curved limb quads are not coplanar; triangulate before calculating face normals.
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < sides; i++) {
      const k = (i + 1) % sides,
        a = rings[j - 1][i],
        b = rings[j - 1][k],
        c = rings[j][k],
        d = rings[j][i];
      triangle(out, slot, [a, b, c], color);
      triangle(out, slot, [a, c, d], color);
    }
  for (const [index, reverse] of [
    [0, true],
    [rings.length - 1, false],
  ])
    for (let i = 1; i < sides - 1; i++)
      triangle(
        out,
        slot,
        reverse
          ? [rings[index][0], rings[index][i + 1], rings[index][i]]
          : [rings[index][0], rings[index][i], rings[index][i + 1]],
        color,
      );
}
function buildHermann(out) {
  const stone = [0.57, 0.52, 0.37],
    trim = [0.69, 0.63, 0.46],
    bronze = [0.35, 0.65, 0.61],
    shade = [0.23, 0.45, 0.42],
    edge = [0.44, 0.71, 0.67];
  // Broad circular stepped foundation and the ten-pier sandstone arcade.
  loft(
    out,
    'limestone',
    [
      [0, 10.25],
      [0.25, 10.25],
      [0.4, 10.03],
      [1.85, 10.03],
      [2.0, 9.8],
      [2.2, 9.8],
    ].map(([y, r]) => radialRing(y, r, r, 80)),
    stone,
  );
  loft(
    out,
    'limestone',
    [
      [2.2, 8.2],
      [2.65, 8.2],
      [2.8, 7.85],
    ].map(([y, r]) => radialRing(y, r, r, 80)),
    trim,
  );
  loft(
    out,
    'limestone',
    [
      [2.7, 4.75],
      [17.8, 4.75],
    ].map(([y, r]) => radialRing(y, r, r, 80)),
    stone,
  );
  for (let i = 0; i < 10; i++) {
    const a = (i * tau) / 10,
      wall = transform(out, a),
      w = 4.37;
    const x = Math.sin(a) * 6.95,
      z = Math.cos(a) * 6.95;
    loft(
      out,
      'limestone',
      [
        [2.7, 1.48],
        [3.12, 1.48],
        [3.4, 1.22],
        [13.5, 1.11],
        [13.8, 1.37],
        [14.16, 1.48],
      ].map(([y, r]) => radialRing(y, r, r, 6, [x, z])),
      stone,
    );
    for (let row = 0; row < 16; row++)
      annulus(
        transform(out, 0, [x, 0, z]),
        'limestone',
        1.075,
        1.135,
        3.6 + row * 0.59,
        3.615 + row * 0.59,
        trim,
        6,
      );
    const bay = transform(out, a + Math.PI / 10);
    archBay(bay, 'limestone', 0, w, 3.1, 14.1, 2.08, 17.75, 6.64, 0.72, stone, {
      back: false,
      trim: 0.23,
    });
    for (const sign of [-1, 1])
      box(
        bay,
        'limestone',
        [sign < 0 ? -w * 0.58 : w * 0.5, 13.98, 5.92],
        [sign < 0 ? -w * 0.5 : w * 0.58, 17.75, 6.64],
        stone,
      );
    box(wall, 'limestone', [-0.95, 16.8, 6.72], [0.95, 17.37, 7.65], trim);
    for (const dx of [-0.47, 0, 0.47])
      box(wall, 'limestone', [dx - 0.13, 17.36, 6.7], [dx + 0.13, 17.83, 7.63], stone);
  }
  for (const [y, r, h] of [
    [17.72, 8.05, 0.32],
    [18.04, 8.3, 0.3],
    [18.34, 8.52, 0.4],
    [18.74, 8.3, 0.19],
  ])
    loft(out, 'limestone', [radialRing(y, r, r, 80), radialRing(y + h, r, r, 80)], trim);
  annulus(out, 'limestone', 5.1, 8.25, 18.9, 19.08, stone, 80);
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * tau,
      x = Math.sin(a) * 8.02,
      z = Math.cos(a) * 8.02;
    beam(out, 'metal', [x, 19.04, z], [x, 19.86, z], 0.045, 0.045, [0.15, 0.19, 0.17]);
  }
  for (const y of [19.35, 19.84])
    annulus(out, 'metal', 7.96, 8.08, y, y + 0.055, [0.16, 0.2, 0.18], 100);
  // The published 7.03 m cupola rises from the 19.86 m substructure datum.
  const profile = [
    [19.08, 5.72],
    [19.86, 5.72],
    [20.1, 5.66],
    [21.1, 5.56],
    [22.15, 5.28],
    [23.3, 4.83],
    [24.4, 4.24],
    [25.42, 3.65],
    [26.58, 3.14],
    [26.89, 3.14],
  ];
  loft(
    out,
    'limestone',
    profile.map(([y, r]) => radialRing(y, r, r, 96)),
    stone,
  );
  for (let i = 0; i < 11; i++) {
    const y = 20 + i * 0.59,
      j = profile.findIndex((p) => p[0] > y),
      p = profile[j - 1],
      q = profile[j];
    const r = p[1] + ((q[1] - p[1]) * (y - p[0])) / (q[0] - p[0]);
    annulus(out, 'limestone', r - 0.03, r + 0.018, y, y + 0.036, trim, 96);
  }
  loft(
    out,
    'copper',
    [
      [26.86, 3.2],
      [27.1, 3.2],
      [27.25, 2.78],
    ].map(([y, r]) => radialRing(y, r, r, 72)),
    bronze,
  );
  // Standing Arminius: bent left knee, raised right arm and sword; +Z is west.
  limb(
    out,
    'copper',
    [
      [-1.05, 27.32, 0.18],
      [-1.02, 30.8, 0.15],
      [-0.95, 33.35, 0.2],
      [-1.03, 36.8, 0],
    ],
    [0.64, 0.66, 0.71, 0.98],
    bronze,
  );
  limb(
    out,
    'copper',
    [
      [1.32, 27.53, -0.42],
      [1.26, 30.7, -0.62],
      [0.77, 33.65, 0.35],
      [0.7, 36.85, 0],
    ],
    [0.6, 0.6, 0.8, 0.99],
    bronze,
  );
  for (const [x, y, z] of [
    [-1.03, 27.46, 0.67],
    [1.34, 27.62, 0.02],
  ])
    sphere(out, 'copper', [x, y, z], [0.77, 0.48, 1.29], bronze, 24, 16);
  for (const side of [-1, 1])
    for (let j = 0; j < 6; j++)
      beam(
        out,
        'copper',
        [side * 1.02 - 0.52 + j * 0.19, 28.15, 0.67],
        [side * 0.97 - 0.52 + j * 0.19, 31.7, 0.64],
        0.095,
        0.06,
        edge,
      );
  const body = [
    [35.7, 2.16, 1.13],
    [36.25, 2.27, 1.18],
    [37.25, 1.85, 1.04],
    [38.2, 1.57, 0.96],
    [40.25, 1.78, 1.1],
    [41.55, 1.91, 1.02],
    [42.25, 1.1, 0.83],
  ];
  loft(
    out,
    'copper',
    body.map(([y, rx, rz]) => radialRing(y, rx, rz, 48)),
    bronze,
  );
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * tau,
      rr = 2.22;
    limb(
      out,
      'copper',
      [
        [Math.cos(a) * rr, 35.9, Math.sin(a) * 1.17],
        [Math.cos(a) * 2.0, 36.75, Math.sin(a) * 1.14],
        [Math.cos(a) * 1.7, 37.3, Math.sin(a) * 1.02],
      ],
      [0.08, 0.095, 0.055],
      shade,
      10,
    );
  }
  loft(out, 'copper', [radialRing(37.9, 1.68, 1.035, 48), radialRing(38.3, 1.69, 1.06, 48)], shade);
  box(out, 'copper', [-0.35, 37.89, 1.02], [0.35, 38.35, 1.16], edge);
  // Cape has its own flowing back contour and broad folds, rather than a rectangular slab.
  loft(
    out,
    'copper',
    [
      [30.2, 1.3, 0.34],
      [33.5, 1.92, 0.44],
      [37.1, 2.06, 0.42],
      [40.3, 1.85, 0.35],
      [41.75, 1.16, 0.25],
    ].map(([y, rx, rz]) => radialRing(y, rx, rz, 32, [0.15, -1.15])),
    shade,
  );
  for (let i = 0; i < 9; i++)
    limb(
      out,
      'copper',
      [
        [(i - 4) * 0.28, 30.7, -1.49],
        [(i - 4) * 0.44, 35, -1.57],
        [(i - 4) * 0.36, 39.7, -1.54],
        [(i - 4) * 0.24, 41.5, -1.38],
      ],
      [0.12, 0.15, 0.13, 0.08],
      bronze,
      12,
    );
  // Right arm reaches above the helmet; left hand rests on the shield's upper rim.
  limb(
    out,
    'copper',
    [
      [-1.62, 41.3, 0.1],
      [-2.37, 43.35, 0.2],
      [-2.76, 45.15, 0.24],
      [-2.89, 46.2, 0.27],
    ],
    [0.77, 0.6, 0.43, 0.42],
    bronze,
  );
  sphere(out, 'copper', [-2.9, 46.42, 0.29], [0.51, 0.65, 0.5], bronze, 24, 16);
  limb(
    out,
    'copper',
    [
      [1.67, 41.12, 0.02],
      [2.15, 39.87, 0.15],
      [2.25, 38.55, 0.56],
      [2.47, 37.49, 0.53],
    ],
    [0.78, 0.65, 0.51, 0.44],
    bronze,
  );
  sphere(out, 'copper', [2.47, 37.35, 0.54], [0.46, 0.56, 0.45], bronze, 24, 16);
  // Ten-metre long shield is seen on the figure's left, with formed rim and boss.
  const shield = transform(out, -0.15, [2.41, 0, 0.39]);
  loft(
    shield,
    'copper',
    [
      [27.15, 0.27, 0.13],
      [27.8, 0.83, 0.21],
      [31.6, 1.08, 0.25],
      [36.75, 1.02, 0.22],
      [37.15, 0.66, 0.16],
    ].map(([y, rx, rz]) => radialRing(y, rx, rz, 40)),
    bronze,
  );
  for (const s of [-1, 1])
    limb(
      shield,
      'copper',
      [
        [s * 0.26, 27.16, 0.13],
        [s * 0.84, 27.81, 0.2],
        [s * 1.08, 31.6, 0.25],
        [s * 1.02, 36.75, 0.22],
        [s * 0.66, 37.15, 0.16],
      ],
      [0.12, 0.12, 0.12, 0.12, 0.12],
      edge,
      12,
    );
  sphere(shield, 'copper', [0, 32.5, 0.23], [0.56, 0.68, 0.27], edge, 24, 16);
  for (let i = 0; i < 5; i++)
    box(shield, 'copper', [-0.56, 28.6 + i * 0.58, 0.247], [0.5, 28.67 + i * 0.58, 0.31], shade);
  // Face, moustache, beard and winged helmet are original polygonal sculpture.
  sphere(out, 'copper', [0, 43.22, 0.11], [0.79, 1.05, 0.76], bronze, 40, 24);
  sphere(out, 'copper', [0, 43.14, 0.82], [0.18, 0.34, 0.28], edge, 24, 16);
  for (const s of [-1, 1]) {
    sphere(out, 'copper', [s * 0.31, 43.49, 0.753], [0.19, 0.075, 0.075], shade, 16, 10);
    limb(
      out,
      'copper',
      [
        [s * 0.04, 42.96, 0.88],
        [s * 0.27, 42.85, 0.85],
        [s * 0.48, 42.9, 0.72],
      ],
      [0.1, 0.13, 0.08],
      shade,
      12,
    );
    for (let i = 0; i < 6; i++)
      limb(
        out,
        'copper',
        [
          [s * (0.23 + i * 0.07), 43.16, -0.15],
          [s * (0.55 + i * 0.035), 42.48, 0.08],
          [s * (0.19 + i * 0.04), 41.92, 0.5],
        ],
        [0.14, 0.16, 0.075],
        bronze,
        12,
      );
  }
  loft(
    out,
    'copper',
    [
      [43.55, 0.9, 0.81],
      [43.87, 0.99, 0.86],
      [44.3, 0.93, 0.81],
      [44.65, 0.63, 0.56],
      [44.82, 0.16, 0.24],
    ].map(([y, rx, rz]) => radialRing(y, rx, rz, 40, [0, 0.05])),
    bronze,
  );
  for (const s of [-1, 1])
    for (let i = 0; i < 8; i++) {
      limb(
        out,
        'copper',
        [
          [s * 0.69, 44, 0.02],
          [s * (1.5 - i * 0.08), 44.35 + i * 0.03, -0.13],
          [s * (1.55 - i * 0.13), 45.45 - i * 0.14, -0.32],
        ],
        [0.2, 0.22, 0.04],
        edge,
        12,
      );
    }
  // Raised straight sword: the official seven metres include the hilt/crossguard.
  beam(out, 'metal', [-2.9, 46.46, 0.3], [-2.9, 52.91, 0.3], 0.28, 0.11, [0.74, 0.72, 0.62]);
  loft(
    transform(out, 0, [-2.9, 0, 0.3]),
    'metal',
    [radialRing(52.88, 0.145, 0.058, 4), radialRing(53.46, 0.008, 0.008, 4)],
    [0.74, 0.72, 0.62],
  );
  box(out, 'metal', [-3.65, 46.72, 0.2], [-2.15, 46.93, 0.39], [0.49, 0.57, 0.44]);
  // Broken Roman standards under the bent leg identify the base group.
  for (let i = 0; i < 7; i++)
    beam(
      out,
      'copper',
      [-0.65 + i * 0.2, 27.3, -1.12],
      [0.45 + i * 0.17, 28.1, -1.35],
      0.14,
      0.14,
      shade,
    );
  sphere(out, 'copper', [1.15, 27.68, -1.16], [0.39, 0.31, 0.46], shade, 20, 12);
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++)
      beam(
        out,
        'copper',
        [1.1, 27.77, -1.13],
        [1.1 + s * (0.4 + i * 0.13), 27.86 + i * 0.055, -1.4 - i * 0.08],
        0.13,
        0.09,
        bronze,
      );
}

function buildVasco(out) {
  const data = JSON.parse(
    readFileSync(
      structureSourcePath('n0577_vasco_da_gama_tower', 'reference-metadata.json'),
      'utf8',
    ),
  );
  const c = Math.cos(data.heading),
    s = Math.sin(data.heading),
    local = (p) => {
      const x = (p.lon - data.anchor[0]) * 111320 * Math.cos((data.anchor[1] * Math.PI) / 180),
        z = -(p.lat - data.anchor[1]) * 111320;
      return [x * c - z * s, x * s + z * c];
    };
  const get = (id) => data.elements.find((e) => e.id === id),
    ring = (id) => get(id).geometry.map(local),
    white = [0.89, 0.91, 0.88],
    concrete = [0.74, 0.73, 0.66],
    glass = [0.31, 0.48, 0.53];
  polygon(out, 'concrete', ring(1387099961), 0, 140, concrete);
  // Two open vertical channels and glazed panoramic lift tracks follow the actual C-shaped mast.
  for (const z of [-5.0, 4.63]) {
    box(out, 'glass', [-6.63, 0, z - 0.46], [-4.1, 109, z + 0.46], glass);
    for (const x of [-6.65, -4.14]) beam(out, 'metal', [x, 0, z], [x, 109, z], 0.13, 0.13, white);
    for (let y = 0.1; y < 109; y += 2.7)
      beam(out, 'metal', [-6.65, y, z - 0.48], [-4.08, y, z - 0.48], 0.07, 0.07, white);
  }
  const ribs = [1387099965, 1387100762, 1387100761, 1387099966, 1387099964, 1387099963, 1387099962];
  const tips = [];
  for (const id of ribs) {
    const e = get(id),
      p = ring(id),
      y = Number(e.tags.min_height),
      tip = p.reduce((a, b) => (a[0] < b[0] ? a : b));
    polygon(out, 'metal', p, y, y + 1, white);
    tips.push([tip[0], y + 0.5, tip[1]]);
  }
  tips.unshift([-38.0, 0.8, -1.2]);
  tips.push([-6.25, 135, -0.18]);
  // Continuous bowed spar and two planes of crossed rigging identify the caravel sail.
  limb(
    out,
    'metal',
    tips,
    tips.map((_, i) => (i < 2 ? 0.79 : 0.57)),
    white,
    24,
  );
  for (let i = 1; i < tips.length - 1; i++)
    for (const z of [-5.55, 5.25]) {
      beam(
        out,
        'metal',
        [tips[i][0], tips[i][1], tips[i][2]],
        [-6.5, tips[i + 1][1], z],
        0.33,
        0.33,
        white,
      );
      beam(
        out,
        'metal',
        [-6.5, tips[i][1], z],
        [tips[i + 1][0], tips[i + 1][1], tips[i + 1][2]],
        0.33,
        0.33,
        white,
      );
    }
  // Exterior service stair alternates flights and railings beside the lift mast.
  for (let j = 0; j < 33; j++) {
    const y = j * 3.25,
      z0 = j % 2 ? -3.9 : 3.9,
      z1 = -z0,
      x = -8.22;
    box(out, 'metal', [x - 1, y, -4.5], [x + 1, y + 0.16, 4.5], white);
    for (let k = 0; k < 18; k++) {
      const t = k / 18,
        z = z0 + (z1 - z0) * t,
        yy = y + 3.25 * t;
      box(out, 'metal', [x - 0.86, yy, z - 0.18], [x + 0.86, yy + 0.07, z + 0.18], white);
      if (k % 3 === 0)
        for (const dx of [-0.85, 0.85])
          beam(out, 'metal', [x + dx, yy, z], [x + dx, yy + 1, z], 0.036, 0.036, white);
    }
    for (const dx of [-0.86, 0.86])
      beam(out, 'metal', [x + dx, y + 1, z0], [x + dx, y + 4.25, z1], 0.045, 0.045, white);
  }
  const disk = ring(709779004),
    xs = disk.map((p) => p[0]),
    zs = disk.map((p) => p[1]),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const pod = transform(out, 0, [cx, 0, cz]),
    r = 11;
  loft(
    pod,
    'metal',
    [
      [109, r],
      [110.8, r],
      [111, r - 0.13],
    ].map(([y, rr]) => radialRing(y, rr, rr, 120)),
    white,
  );
  loft(
    pod,
    'glass',
    [radialRing(111, r - 0.13, r - 0.13, 120), radialRing(114, r - 0.13, r - 0.13, 120)],
    glass,
  );
  loft(
    pod,
    'metal',
    [
      [114, r],
      [116.8, r],
      [117, r - 0.14],
    ].map(([y, rr]) => radialRing(y, rr, rr, 120)),
    white,
  );
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * tau,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    beam(pod, 'metal', [x, 109, z], [x, 117, z], 0.07, 0.07, [0.53, 0.58, 0.58]);
  }
  for (const y of [110.97, 112.5, 114, 115.5, 116.96])
    annulus(pod, 'metal', r - 0.05, r + 0.035, y, y + 0.06, [0.6, 0.64, 0.62], 120);
  const domePoint = (a, b) => [
    Math.cos(a) * 11.055 * Math.cos(b),
    117 + 6.055 * Math.sin(b),
    Math.sin(a) * 11.055 * Math.cos(b),
  ];
  const domeRings = Array.from({ length: 22 }, (_, i) =>
    radialRing(
      117 + 6 * Math.sin(((i / 21) * Math.PI) / 2),
      Math.max(0.025, 11 * Math.cos(((i / 21) * Math.PI) / 2)),
      Math.max(0.025, 11 * Math.cos(((i / 21) * Math.PI) / 2)),
      120,
    ),
  );
  loft(pod, 'glass', domeRings, [0.49, 0.66, 0.71]);
  // Hexagonal joint lattice on the current enclosed observation dome (not the original open deck).
  const step = tau / 36;
  for (let row = 0; row < 7; row++)
    for (let i = 0; i < 36; i++) {
      const ac = (i + (row % 2) * 0.5) * step,
        bc = 0.09 + row * 0.218;
      const points = Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * tau + Math.PI / 6;
        return domePoint(
          ac + (Math.cos(a) * step) / Math.sqrt(3),
          Math.min(Math.PI / 2 - 0.012, Math.max(0, bc + Math.sin(a) * 0.145)),
        );
      });
      for (let k = 0; k < 6; k++)
        if (Math.hypot(...points[k].map((n, j) => n - points[(k + 1) % 6][j])) > 0.01)
          beam(pod, 'metal', points[k], points[(k + 1) % 6], 0.055, 0.055, [0.58, 0.63, 0.64]);
    }
  loft(
    pod,
    'concrete',
    [radialRing(121, 5.65, 5.65, 80), radialRing(125, 5.65, 5.65, 80)],
    concrete,
  );
  for (const [y, radius] of [
    [125, 0.65],
    [140, 0.3],
    [144.95, 0.12],
  ])
    if (y < 144.95)
      loft(
        pod,
        'metal',
        [
          radialRing(y, radius, radius, 24),
          radialRing(y === 125 ? 140 : 145, y === 125 ? 0.3 : 0.11, y === 125 ? 0.3 : 0.11, 24),
        ],
        white,
      );
  // Current attached MYRIAD hotel: preserve its mapped two curved wings and central recess.
  const hotel = ring(709779008);
  for (let level = 0; level < 24; level++) {
    const y = level * 3.75;
    polygon(out, 'metal', hotel, y, y + 2.2, white);
    polygon(out, 'glass', hotel, y + 2.2, y + 3.65, [
      0.34 + 0.025 * (level % 3),
      0.47 + 0.02 * (level % 3),
      0.49 + 0.014 * (level % 3),
    ]);
    polygon(out, 'metal', hotel, y + 3.65, y + 3.75, white);
  }
  for (let i = 1; i < hotel.length; i++) {
    const a = hotel[i - 1],
      b = hotel[i],
      d = Math.hypot(b[0] - a[0], b[1] - a[1]),
      steps = Math.max(1, Math.round(d / 2));
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(out, 'metal', [x, 0, z], [x, 90, z], 0.035, 0.035, [0.75, 0.78, 0.76]);
    }
  }
  for (const id of [1388114627, 1388114628])
    polygon(
      out,
      'metal',
      ring(id),
      90,
      (p) => 90 + 10 * Math.max(0, Math.min(1, (p[0] + 0.6) / 33.85)),
      white,
    );
  // Vertical glass atrium seam, entry canopy and exposed lift connector near the mast.
  box(out, 'glass', [-3.7, 0, -3.3], [0.25, 94, 3.3], [0.42, 0.6, 0.62]);
  for (let y = 0.1; y < 94; y += 3.75)
    for (const z of [-3.32, 3.32])
      beam(out, 'metal', [-3.8, y, z], [0.28, y, z], 0.12, 0.12, white);
  polygon(out, 'glass', ring(1388114626), 0, 10, glass);
  // Open entrance canopies are roofs on posts, not solid three-metre podiums.
  for (const [id, y] of [
    [1388115274, 10.2],
    [709779005, 3],
  ]) {
    const p = ring(id);
    polygon(out, 'metal', p, y - 0.18, y, white);
    for (let i = 0; i < p.length - 1; i += 3)
      beam(out, 'metal', [p[i][0], 0, p[i][1]], [p[i][0], y, p[i][1]], 0.14, 0.14, white);
  }
}

export const finalHeritageTowers = [
  {
    id: 'n0571_hermannsdenkmal',
    planId: 'N0571',
    componentMap: { copper: 'metal' },
    title: 'Hermannsdenkmal',
    wikidata: 'Q664245',
    build: buildHermann,
    authoringFile: 'final-heritage-tower-models.mjs',
    brief:
      'The ten-pier Osning sandstone monument with open round arcade, circular viewing gallery, masonry cupola and a fully modeled copper Arminius: winged helmet, folded cape, raised sword, bent leg, long shield and broken Roman standards.',
    size: [20.5, 53.46, 20.5],
    front: '+Z faces west, as the statue and raised sword do in the published regional account',
    origin: 'Center of the mapped circular ground plinth, Y=0 at the lower sandstone foundation',
    refs: [
      'https://www.hermannsdenkmal.de/wissenswertes/zahlen-und-fakten/',
      'https://www.hermannsdenkmal.de/wp-content/uploads/sites/4/2023/04/Flyer-HD-Fremdsprachen-2023.pdf',
      'https://www.hermannsdenkmal.de/wp-content/uploads/sites/4/2017/05/hermannsdenkmal_historie_skizze.jpg',
      'https://www.westfalen-regional.de/de/hermann_externsteine/',
      'https://www.openstreetmap.org/way/207366382',
    ],
    facts: {
      heightMeters: 53.46,
      substructureHeightMeters: 19.86,
      cupolaHeightMeters: 7.03,
      statueWithSwordHeightMeters: 26.57,
      swordLengthMeters: 7,
      shieldLengthMeters: 10,
      arcadePierCount: 10,
      statueFacing: 'west',
    },
    scaleBasis:
      'The operator publishes the complete vertical dimension chain and a historical construction elevation/plan. Concentric mapped foundation, arcade and cupola outlines constrain their diameters. Current operator photographs determine statue pose, folded clothing, winged helmet, shield and sandstone/copper colors; the western facing is explicitly described by the regional cultural authority.',
    geographicProposal: {
      anchor: [8.83948475, 51.9116545],
      heading: -Math.PI / 2,
      source: 'https://www.openstreetmap.org/way/207366382',
      evidence:
        'The mapped concentric monument parts surround exact-QID identity node 241929305. The circular base gives the anchor, while the published west-facing statue resolves the rotation that a round footprint cannot.',
      orientationConfidence: 'mapped-concentric-foundation-and-published-statue-facing',
      mapGeometrySource: 'map-frame.json',
      mapGeometryHash: hashEvidenceText(hermannFrameBytes),
      mapGeometryLicense: 'ODbL-1.0',
      limitations:
        'The open circular viewing platform is registered from the surrounding ground plinth, not the narrow statue footprint. Neighboring paths and landscape stairs remain map scenery.',
    },
    limits: [
      'The copper figure is an original detailed polygonal reconstruction of the published silhouette, pose, clothing and attributes rather than a scan of the sculpture. Shield text and sword inscription are represented by shallow relief fields without fabricated readable lettering.',
      'Stone course rhythm and minor carved capitals are reconstructed from the operator photographs; the main ten-pier construction and all published vertical dimensions are retained.',
    ],
    cameras: [
      { name: 'sandstone-arcade', position: [20, 14, 25], lookAt: [0, 11, 0] },
      { name: 'statue-front', position: [13, 40, 21], lookAt: [0, 39, 0] },
      { name: 'helmet-sword', position: [12, 49, 20], lookAt: [-1, 47, 0] },
      { name: 'cape-shield', position: [-16, 40, -20], lookAt: [0, 38, 0] },
      { name: 'far-silhouette', position: [63, 32, 82], lookAt: [0, 25, 0] },
    ],
  },
  {
    id: 'n0577_vasco_da_gama_tower',
    planId: 'N0577',
    title: 'Vasco da Gama Tower',
    wikidata: 'Q1756313',
    build: buildVasco,
    authoringFile: 'final-heritage-tower-models.mjs',
    brief:
      'The current Lisbon caravel-shaped observation tower and attached MYRIAD hotel: tall concrete mast, bowed outer spar, seven curved rigging ribs, crossed bracing, open emergency stairs, panoramic lifts, circular viewing room and the modern hexagon-jointed glass dome.',
    size: [100.3, 145, 29.7],
    front: '−X is the western bowed sail; +X is the attached eastern hotel',
    origin:
      'Exact-QID main footprint center; individual mast, ribs, hotel and projecting ground entrance canopies retain their real offsets',
    refs: [
      'https://www.vascodagamatower.com/',
      'https://www.visitportugal.com/pt-pt/content/vasco-da-gama-tower',
      'https://www.vascodagamatower.com/wp-content/uploads/2026/06/Miradouro-Vasco-da-Gama-Tower-2026.jpg',
      'https://www.openstreetmap.org/way/1387098203',
      'https://www.openstreetmap.org/way/1387099961',
      'https://www.openstreetmap.org/way/709779008',
    ],
    facts: {
      heightMeters: 145,
      mappedMastHeightMeters: 140,
      mappedObservationFloorsMeters: [109, 111, 114, 117],
      mappedDomeTopMeters: 123,
      mappedHotelBodyHeightMeters: 90,
      mappedHotelRoofHeightMeters: 100,
      currentDome: 'enclosed glass with hexagonal joint network',
      curvedSailRibs: 7,
    },
    scaleBasis:
      'The operator and Portuguese national tourism authority identify the current 145 m tower and its enclosed dome. Exact building parts supply the C-shaped mast, seven different rib plans and elevations, circular gallery, glass dome and attached hotel wings. Current operator photography establishes crossed rigging, external stair flights, banded glazing and the hexagonal dome network. Marketing describes the attraction as 145 m; the mapped observation floor itself is lower, so the model retains distinct mapped levels rather than moving the gallery to the mast tip.',
    geographicProposal: {
      anchor: [-9.091290235, 38.77474122],
      heading: -0.04046133484,
      source: 'https://www.openstreetmap.org/way/1387098203',
      evidence:
        'Twenty mapped building parts are preserved in reference-metadata.json. Their asymmetric westward rigging and eastern hotel resolve both the actual tower offset within the whole outline and its facing.',
      orientationConfidence: 'exact-mapped-mast-ribs-and-hotel-parts',
      limitations:
        'The main 77 m outline is an overhead union, not a solid ground podium; mapped entrance canopies extend its overall ground bounds to about 100 m. The sail, observation pod and hotel keep distinct ground contacts and overhangs. The western canopy is tagged 3 m; the eastern roof is reconstructed at the adjacent 10 m entrance volume.',
    },
    limits: [
      'The current observation dome, hotel facade and structural rigging follow primary operator photography. Stair railing subdivisions and changing window reflections are original exterior reconstructions. Hotel brand signage is omitted rather than rendered as invented letterforms.',
      'OSM observation-floor and roof-part elevations are recorded separately from the operator’s 145 m overall marketing height. Hexagonal dome joints are reconstructed on the measured dome envelope, not copied from fabrication drawings.',
    ],
    cameras: [
      { name: 'caravel-rigging', position: [-85, 75, 73], lookAt: [-17, 70, 0] },
      { name: 'viewing-dome', position: [-40, 135, 36], lookAt: [-5, 117, 0] },
      { name: 'hotel-facade', position: [72, 47, 72], lookAt: [16, 45, 0] },
      { name: 'mast-lifts', position: [-31, 40, 38], lookAt: [-5, 43, 0] },
      { name: 'far-silhouette', position: [155, 105, 220], lookAt: [0, 69, 0] },
    ],
  },
];
