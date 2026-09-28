/** Individual lighthouse exteriors reconstructed from cited primary records and photographs. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell, squareRails } from './lighthouse-expansion-models.mjs';
import {
  lantern,
  lathe,
  panel,
  piercedFacade,
  railRing,
  transformed,
} from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const white = [0.84, 0.825, 0.76],
  stone = [0.53, 0.48, 0.39],
  lightStone = [0.62, 0.56, 0.46],
  iron = [0.11, 0.13, 0.13],
  rust = [0.4, 0.16, 0.075];
const rect = (y, r) => [
  [-r, y, -r],
  [-r, y, r],
  [r, y, r],
  [r, y, -r],
];
function taperedFacade(out, { bottom, top, y0, y1, holes, slot = 'ashlar', color = stone }) {
  // Taper the actual pierced wall and its reveals together, then recompute geometric normals.
  const deform = ([x, y, z]) => {
    const r = bottom + ((top - bottom) * (y - y0)) / (y1 - y0);
    return [(x * r) / bottom, y, (z * r) / bottom];
  };
  const warped = {
    addQuad(s, r, p, _n, uv, c) {
      const ps = p.map(deform);
      out.addQuad(s, r, ps, normalFor(...ps.slice(0, 3)), uv, c);
    },
    addTriangle(s, r, p, _n, uv, c) {
      const ps = p.map(deform);
      out.addTriangle(s, r, ps, normalFor(...ps.slice(0, 3)), uv, c);
    },
  };
  piercedFacade(warped, { half: bottom, y0, y1, z: bottom, holes, slot, color });
}
function squareBand(out, y, r0, r1, h, color = lightStone) {
  loft(out, 'granite', [rect(y, r0), rect(y + h, r1)], color);
}
/** Projecting dentil and corbel cornice, with independent open shadows between brackets. */
function genoaCornice(out, y, r, count) {
  squareBand(out, y, r, r + 0.15, 0.18);
  // Two superposed arcaded corbel rows, visible on the current operator photograph.
  for (let tier = 0; tier < 2; tier++)
    for (let f = 0; f < 4; f++) {
      const o = transformed(out, (f * Math.PI) / 2);
      const base = y + 0.18 + tier * 0.7,
        project = r + 0.38 + tier * 0.47;
      const pitch = (2 * r + tier * 0.55) / count;
      for (let j = 0; j < count; j++) {
        const x = (j - (count - 1) / 2) * pitch,
          half = pitch * 0.32;
        for (const side of [-1, 1])
          box(
            o,
            'granite',
            [x + side * half - 0.065, base, r - 0.08],
            [x + side * half + 0.065, base + 0.29, project],
            lightStone,
          );
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 12,
            b = ((k + 1) * Math.PI) / 12;
          const outerA = [
            x + Math.cos(a) * (half + 0.065),
            base + 0.23 + Math.sin(a) * 0.33,
            project,
          ];
          const outerB = [
            x + Math.cos(b) * (half + 0.065),
            base + 0.23 + Math.sin(b) * 0.33,
            project,
          ];
          const innerA = [
            x + Math.cos(a) * (half - 0.065),
            base + 0.23 + Math.sin(a) * 0.2,
            project,
          ];
          const innerB = [
            x + Math.cos(b) * (half - 0.065),
            base + 0.23 + Math.sin(b) * 0.2,
            project,
          ];
          quad(o, 'granite', [innerA, outerA, outerB, innerB], [0, 0, 1], lightStone);
          quad(
            o,
            'granite',
            [innerA, innerB, [innerB[0], innerB[1], r - 0.06], [innerA[0], innerA[1], r - 0.06]],
            normalFor(innerA, innerB, [innerB[0], innerB[1], r - 0.06]),
            lightStone,
          );
        }
      }
      box(
        o,
        'granite',
        [-r - tier * 0.3, base + 0.56, r - 0.06],
        [r + tier * 0.3, base + 0.7, project + 0.06],
        lightStone,
      );
    }
  squareBand(out, y + 1.5, r + 0.9, r + 0.9, 0.32);
  squareBand(out, y + 1.82, r + 0.9, r + 0.6, 0.2);
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2);
    box(o, 'granite', [-r - 0.62, y + 2.02, r + 0.29], [r + 0.62, y + 2.7, r + 0.62], lightStone);
    for (let j = 0; j < count + 1; j++) {
      const x = -r - 0.22 + (j * (2 * r + 0.44)) / count;
      box(o, 'granite', [x - 0.1, y + 2.08, r + 0.61], [x + 0.1, y + 2.6, r + 0.69], stone);
    }
    box(o, 'granite', [-r - 0.74, y + 2.7, r + 0.2], [r + 0.74, y + 2.88, r + 0.74], lightStone);
  }
}
function genoaArms(out, face) {
  const o = transformed(out, (face * Math.PI) / 2),
    gold = [0.62, 0.4, 0.13];
  // Flat painted shield/cross and the crown silhouette are geometry, not a copied image.
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI * 2) / 48,
      b = ((i + 1) * Math.PI * 2) / 48;
    const ps = [
      [0, 26.2, 5.515],
      [Math.sin(a) * (2.25 + 0.22 * Math.sin(a * 12)), 26.2 + Math.cos(a) * 3.25, 5.515],
      [Math.sin(b) * (2.25 + 0.22 * Math.sin(b * 12)), 26.2 + Math.cos(b) * 3.25, 5.515],
    ];
    o.addTriangle(
      'plaster',
      'palette:#ffffff',
      [ps[0], ps[2], ps[1]],
      [0, 0, 1],
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      gold,
    );
    const inner = [
      [0, 26.2, 5.526],
      [Math.sin(a) * 1.6, 26.2 + Math.cos(a) * 2.55, 5.526],
      [Math.sin(b) * 1.6, 26.2 + Math.cos(b) * 2.55, 5.526],
    ];
    // Ring order above runs clockwise when viewed from outside; explicitly orient it.
    o.addTriangle(
      'plaster',
      'palette:#ffffff',
      [inner[0], inner[2], inner[1]],
      [0, 0, 1],
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      white,
    );
  }
  panel(o, 'plaster', -0.3, 0.3, 23.7, 28.7, 5.54, [0.35, 0.08, 0.07]);
  panel(o, 'plaster', -1.58, 1.58, 25.8, 26.4, 5.545, [0.35, 0.08, 0.07]);
  box(o, 'metal', [-1.3, 29.32, 5.52], [1.3, 29.55, 5.56], gold);
  for (const x of [-1.15, -0.57, 0, 0.57, 1.15]) {
    beam(o, 'metal', [x, 29.45, 5.55], [x * 0.84, 30.12, 5.55], 0.12, 0.05, gold);
    sphere(o, 'metal', [x * 0.84, 30.12, 5.55], [0.13, 0.13, 0.035], gold, 10, 6);
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 24,
        b = ((i + 1) * Math.PI) / 24;
      beam(
        o,
        'metal',
        [side * 0.58 + Math.cos(a) * 0.66, 30.02 + Math.sin(a) * 0.59, 5.57],
        [side * 0.58 + Math.cos(b) * 0.66, 30.02 + Math.sin(b) * 0.59, 5.57],
        0.12,
        0.025,
        gold,
      );
    }
  panel(o, 'metal', -0.07, 0.07, 30.4, 31.02, 5.57, gold);
  panel(o, 'metal', -0.3, 0.3, 30.77, 30.9, 5.57, gold);
}
function buildGenoa(out) {
  squareBand(out, 0, 6.65, 5.5, 2, stone);
  for (let f = 0; f < 4; f++) {
    const holes = [
      { x: 0, y: 12 + (f % 2) * 2, w: 0.53, h: 1.12, trim: 0 },
      { x: 0, y: 20 + (f % 2) * 1.9, w: 0.43, h: 1.08, trim: 0 },
      { x: 0, y: 33.1, w: 0.42, h: 0.75, trim: 0 },
    ];
    if (f === 2) holes.push({ x: 0, y: 2, w: 1.35, h: 2.65, trim: 0.14 });
    piercedFacade(transformed(out, (f * Math.PI) / 2), {
      half: 5.5,
      y0: 2,
      y1: 36.1,
      z: 5.5,
      holes,
      slot: 'ashlar',
      color: stone,
    });
    const o = transformed(out, (f * Math.PI) / 2);
    for (const y of [8.5, 17.4, 32.8])
      box(o, 'granite', [-5.51, y, 5.496], [5.51, y + 0.045, 5.53], [0.36, 0.33, 0.28]);
  }
  genoaArms(out, 2);
  genoaCornice(out, 36.1, 5.5, 12);
  box(out, 'granite', [-6.2, 38.97, -6.2], [6.2, 39.08, 6.2], lightStone);
  squareRails(out, 39.05, 6.04, 6.04, iron);
  for (let f = 0; f < 4; f++) {
    const holes = [
      { x: 0, y: 43.2 + (f % 2) * 1.4, w: 0.46, h: 1.2, trim: 0 },
      { x: 0, y: 52.8 + (f % 2) * 3.2, w: 0.47, h: 1.3, trim: 0 },
      { x: 0, y: 63.1 + (f % 2) * 1.5, w: 0.45, h: 1.3, trim: 0 },
    ];
    if (f === 0) holes.push({ x: 0, y: 39.06, w: 1.05, h: 2.45, trim: 0 });
    piercedFacade(transformed(out, (f * Math.PI) / 2), {
      half: 3.8,
      y0: 39.05,
      y1: 67.7,
      z: 3.8,
      holes,
      slot: 'ashlar',
      color: stone,
    });
  }
  genoaCornice(out, 67.7, 3.8, 9);
  box(out, 'granite', [-4.4, 70.55, -4.4], [4.4, 70.7, 4.4], lightStone);
  squareRails(out, 70.7, 4.24, 4.24, iron);
  lantern(out, {
    bottom: 70.7,
    radius: 2.65,
    height: 4.04,
    color: iron,
    segments: 24,
    roofHeight: 1.05,
  });
  railRing(out, 71, 2.96, 3.45, iron, 36);
  tube(out, 'metal', [0, 76.55, 0], [0, 77, 0], 0.045, iron, 10);
  // Lower rounded access stair buttress visible in the museum photograph.
  const access = transformed(out, 0, [-3.8, 0, -6.2]);
  shell(access, {
    profile: [
      [0, 3.8],
      [2, 3.55],
      [4, 2.8],
      [10, 2.2],
    ],
    slot: 'rubble',
    color: stone,
    segments: 64,
    holes: [{ angle: Math.PI, y: 7.9, w: 0.6, h: 0.9, trimSlot: 'granite' }],
  });
  lathe(
    access,
    'granite',
    [
      [10, 2.33],
      [10.22, 2.33],
    ],
    lightStone,
    64,
  );
  for (let i = 0; i < 12; i++)
    box(
      out,
      'granite',
      [-8.2, 0, -7.8 + i * 0.38],
      [-6.6, (i + 1) * 0.16, -7.4 + i * 0.38],
      lightStone,
    );
}
const jeddahProfile = [
  [77.6, 7.2],
  [79, 10.2],
  [81, 12.9],
  [84, 15.3],
  [88, 17.7],
  [92, 19.05],
  [97, 19.6],
  [101, 19.12],
  [104, 18.2],
  [107, 16.5],
  [110, 13.8],
  [112, 11.1],
  [114, 7.5],
];
function jeddahRadius(y) {
  const i = Math.max(
    1,
    jeddahProfile.findIndex(([h]) => h >= y),
  );
  const a = jeddahProfile[i - 1],
    b = jeddahProfile[i];
  const t = (y - a[0]) / (b[0] - a[0]);
  const prev = jeddahProfile[Math.max(0, i - 2)],
    next = jeddahProfile[Math.min(jeddahProfile.length - 1, i + 1)];
  const m0 = (b[1] - prev[1]) / (b[0] - prev[0]),
    m1 = (next[1] - a[1]) / (next[0] - a[0]);
  return (
    (2 * t * t * t - 3 * t * t + 1) * a[1] +
    (t * t * t - 2 * t * t + t) * (b[0] - a[0]) * m0 +
    (-2 * t * t * t + 3 * t * t) * b[1] +
    (t * t * t - t * t) * (b[0] - a[0]) * m1
  );
}
function jeddahNormalAt(p, slot, _ref, current) {
  if (!['window', 'foundation'].includes(slot) || p[1] <= 77.6001 || p[1] >= 113.9999)
    return undefined;
  const r = Math.hypot(p[0], p[2]),
    expected = jeddahRadius(p[1]);
  if (Math.abs(r - expected) > 0.004) return undefined;
  const slope = (jeddahRadius(p[1] + 0.001) - jeddahRadius(p[1] - 0.001)) / 0.002;
  const n = [p[0] / r, -slope, p[2] / r],
    len = Math.hypot(...n);
  const result = n.map((v) => v / len);
  return current.reduce((sum, v, i) => sum + v * result[i], 0) > 0.8 ? result : undefined;
}
function buildJeddah(out) {
  const body = [0.81, 0.78, 0.66],
    bronze = [0.22, 0.19, 0.12],
    upperGlass = [0.16, 0.2, 0.18];
  // The two opposite sloped base wings are an elongated mapped envelope, not a round podium.
  loft(
    out,
    'concrete',
    [
      radialRing(0, 28.2, 41.2, 128),
      radialRing(1.6, 28.2, 41.2, 128),
      radialRing(3, 26.5, 39.6, 128),
      radialRing(8, 19.3, 27.8, 128),
      radialRing(14, 11.2, 15.7, 128),
      radialRing(20, 7.55, 7.55, 128),
      radialRing(77.6, 7.2, 7.2, 128),
    ],
    body,
  );
  const at = (a, y, d = 0) => [
    Math.sin(a) * (jeddahRadius(y) + d),
    y,
    Math.cos(a) * (jeddahRadius(y) + d),
  ];
  function face(slot, a, b, y00, y01, y11, y10, color) {
    const points = [at(a, y00), at(b, y01), at(b, y11), at(a, y10)];
    const same = (u, v) => Math.hypot(...u.map((x, i) => x - v[i])) < 1e-7;
    const p = points.filter((v, i) => i === 0 || !same(v, points[i - 1]));
    if (p.length > 1 && same(p[0], p.at(-1))) p.pop();
    if (p.length === 3)
      out.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        normalFor(...p),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        color,
      );
    else if (p.length === 4)
      for (const t of [
        [p[0], p[1], p[2]],
        [p[0], p[2], p[3]],
      ])
        out.addTriangle(
          slot,
          'palette:#ffffff',
          t,
          normalFor(...t),
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          color,
        );
  }
  // Lower bronze-glazed spherical zone, finely subdivided so its circular profile reads smoothly.
  for (let y = 77.6; y < 100.3; y += 0.65)
    for (let k = 0; k < 192; k++)
      face(
        'glass',
        (k * Math.PI) / 96,
        ((k + 1) * Math.PI) / 96,
        y,
        y,
        Math.min(y + 0.65, 100.3),
        Math.min(y + 0.65, 100.3),
        bronze,
      );
  // Main vertical ribs terminate under the deep upper arched openings.
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    for (let y = 78; y < 103; y += 0.65)
      beam(out, 'concrete', at(a, y, 0.09), at(a, Math.min(y + 0.65, 103), 0.09), 0.3, 0.2, body);
  }
  for (let y = 80; y < 100.3; y += 1.25)
    ring(
      out,
      'metal',
      y,
      jeddahRadius(y) - 0.012,
      jeddahRadius(y) + 0.055,
      0.065,
      [0.54, 0.48, 0.31],
      192,
    );
  // Forty-eight small rounded arcade lights form the pale belt below sixteen tall arches.
  for (let k = 0; k < 48; k++)
    for (let j = 0; j < 10; j++) {
      const a = ((k + j / 10) * Math.PI) / 24,
        b = ((k + (j + 1) / 10) * Math.PI) / 24;
      const top = (t) => 100.6 + 1.7 * Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.44) ** 2));
      const ya = top(j / 10),
        yb = top((j + 1) / 10);
      face('glass', a, b, 100.35, 100.35, yb, ya, [0.12, 0.17, 0.15]);
      face('concrete', a, b, ya, yb, 103, 103, body);
    }
  ring(
    out,
    'concrete',
    100.3,
    jeddahRadius(100.3) - 0.06,
    jeddahRadius(100.3) + 0.15,
    0.17,
    body,
    192,
  );
  ring(
    out,
    'concrete',
    102.8,
    jeddahRadius(102.8) - 0.07,
    jeddahRadius(102.8) + 0.14,
    0.2,
    body,
    192,
  );
  for (let k = 0; k < 16; k++)
    for (let j = 0; j < 16; j++) {
      const a = ((k + j / 16) * Math.PI) / 8,
        b = ((k + (j + 1) / 16) * Math.PI) / 8;
      const top = (t) => 103.0 + 8.0 * Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.44) ** 2));
      const ya = top(j / 16),
        yb = top((j + 1) / 16);
      if (ya > 103.0001 || yb > 103.0001)
        for (let n = 0; n < 24; n++) {
          const t = n / 24,
            u = (n + 1) / 24;
          face(
            'glass',
            a,
            b,
            103 + (ya - 103) * t,
            103 + (yb - 103) * t,
            103 + (yb - 103) * u,
            103 + (ya - 103) * u,
            upperGlass,
          );
        }
      for (let n = 0; n < 24; n++) {
        const t = n / 24,
          u = (n + 1) / 24;
        face(
          'concrete',
          a,
          b,
          ya + (114 - ya) * t,
          yb + (114 - yb) * t,
          yb + (114 - yb) * u,
          ya + (114 - ya) * u,
          body,
        );
      }
    }
  // Stacked cylindrical control rooms and flat equipment crown, as opposed to a lighthouse dome.
  lathe(
    out,
    'concrete',
    [
      [114, 7.5],
      [118.5, 7.5],
      [119.7, 7.1],
    ],
    body,
    128,
  );
  shell(out, {
    profile: [
      [119.7, 7.0],
      [120.6, 7.0],
    ],
    slot: 'glass',
    color: [0.07, 0.12, 0.12],
    segments: 128,
  });
  lathe(
    out,
    'metal',
    [
      [120.6, 7.2],
      [121, 7.2],
      [125.8, 6.85],
      [126, 6.8],
    ],
    bronze,
    128,
  );
  lathe(
    out,
    'metal',
    [
      [126, 5.65],
      [129.85, 5.65],
      [130.15, 5.45],
    ],
    bronze,
    128,
  );
  for (let k = 0; k < 32; k++) {
    const a = (k * Math.PI) / 16;
    beam(
      out,
      'metal',
      [Math.sin(a) * 7.22, 121, Math.cos(a) * 7.22],
      [Math.sin(a) * 6.88, 125.75, Math.cos(a) * 6.88],
      0.055,
      0.07,
      [0.41, 0.36, 0.24],
    );
  }
  railRing(out, 118.5, 7.55, 0.85, [0.4, 0.35, 0.23], 48);
  tube(out, 'metal', [0, 130.15, 0], [0, 131.4, 0], 0.05, iron, 10);
  // Radial base seams retain the two-axis shell scale without inventing unsupported entrance canopies.
  for (let k = 0; k < 48; k++) {
    const a = (k * Math.PI) / 24;
    const p = [
      [1.65, 28.25, 41.25],
      [3.03, 26.55, 39.65],
      [8.03, 19.35, 27.85],
      [14.03, 11.25, 15.75],
      [20.03, 7.59, 7.59],
    ];
    for (let i = 1; i < p.length; i++)
      beam(
        out,
        'concrete',
        [Math.sin(a) * p[i - 1][1], p[i - 1][0], Math.cos(a) * p[i - 1][2]],
        [Math.sin(a) * p[i][1], p[i][0], Math.cos(a) * p[i][2]],
        0.035,
        0.035,
        [0.72, 0.69, 0.58],
      );
  }
}
function buildRubjerg(out) {
  const wall = [0.81, 0.79, 0.69];
  squareBand(out, 0, 3.4, 3.35, 0.45, wall);
  for (let f = 0; f < 4; f++) {
    const holes =
      f === 0
        ? [
            { x: 0, y: 0.45, w: 1.35, h: 2.32, trim: 0 },
            { x: 0, y: 5.6, w: 0.42, h: 1.15, trim: 0 },
            { x: 0, y: 10.3, w: 0.4, h: 1.1, trim: 0 },
            { x: 0, y: 13.1, w: 0.42, h: 1.15, trim: 0 },
          ]
        : [{ x: 0, y: 8.65 + (f % 2) * 1.4, w: 0.38, h: 1.1, trim: 0 }];
    taperedFacade(transformed(out, (f * Math.PI) / 2), {
      bottom: 3.35,
      top: 2.97,
      y0: 0.45,
      y1: 16.8,
      holes,
      slot: 'plaster',
      color: wall,
    });
  }
  squareBand(out, 16.8, 2.98, 3.13, 0.2, wall);
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2);
    const hs = Array.from({ length: 7 }, (_, i) => ({
      x: (i - 3) * 0.8,
      y: 17.1,
      w: 0.31,
      h: 0.59,
      trim: 0,
      blind: i % 3 !== 1,
      depth: 0.24,
    }));
    piercedFacade(o, {
      half: 3.13,
      y0: 17,
      y1: 17.98,
      z: 3.13,
      holes: hs,
      slot: 'plaster',
      color: white,
    });
    for (const h of hs) {
      // Half-round arch relief over each recessed niche.
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 10,
          b = ((k + 1) * Math.PI) / 10;
        beam(
          o,
          'plaster',
          [h.x + Math.cos(a) * 0.225, 17.69 + Math.sin(a) * 0.225, 3.17],
          [h.x + Math.cos(b) * 0.225, 17.69 + Math.sin(b) * 0.225, 3.17],
          0.08,
          0.09,
          white,
        );
      }
    }
  }
  squareBand(out, 17.98, 3.15, 3.43, 0.2, white);
  box(out, 'granite', [-3.43, 18.18, -3.43], [3.43, 18.35, 3.43], white);
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2);
    box(o, 'plaster', [-3.38, 18.35, 3.06], [3.38, 19.04, 3.38], white);
    for (let j = -3; j <= 3; j++)
      box(
        o,
        'plaster',
        [j * 0.91 - 0.04, 18.4, 3.38],
        [j * 0.91 + 0.04, 18.99, 3.43],
        [0.68, 0.67, 0.59],
      );
    box(o, 'granite', [-3.48, 19.04, 3.02], [3.48, 19.15, 3.48], white);
  }
  squareRails(out, 18.6, 3.25, 3.25, iron);
  // This lantern is open: intermediate framing must be annular, not a capped disc.
  lathe(
    out,
    'metal',
    [
      [18.4, 1.61],
      [18.56, 1.61],
      [18.63, 1.48],
    ],
    rust,
    48,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    tube(
      out,
      'metal',
      [Math.cos(a) * 1.48, 18.57, Math.sin(a) * 1.48],
      [Math.cos(a) * 1.48, 21.65, Math.sin(a) * 1.48],
      0.045,
      rust,
      8,
    );
  }
  for (const y of [20.0575, 21.65]) ring(out, 'metal', y, 1.45, 1.51, 0.055, rust, 48);
  lathe(
    out,
    'metal',
    [
      [21.65, 1.7168],
      [21.79, 1.7168],
      [22, 1.4208],
      [22.226, 0.5624],
      [22.37, 0.065],
    ],
    rust,
    64,
  );
  // The open lantern contains the inverted faceted reflector visible in the 2025 owner image.
  loft(
    out,
    'metal',
    [radialRing(18.7, 0.1, 0.1, 3), radialRing(21.28, 1.05, 1.05, 3)],
    [0.79, 0.78, 0.71],
  );
  for (let f = 0; f < 8; f++) {
    const a = (f * Math.PI) / 4;
    beam(
      out,
      'metal',
      [Math.sin(a) * 1.44, 18.6, Math.cos(a) * 1.44],
      [Math.sin(a + Math.PI / 4) * 1.44, 21.5, Math.cos(a + Math.PI / 4) * 1.44],
      0.035,
      0.035,
      rust,
    );
  }
  lathe(
    out,
    'metal',
    [
      [22.16, 0.48],
      [22.72, 0.48],
    ],
    rust,
    32,
  );
  for (const s of [-1, 1]) {
    beam(out, 'metal', [0, 22.72, 0], [s * 0.12, 22.93, 0], 0.026, 0.026, rust);
    sphere(out, 'metal', [s * 0.12, 22.93, 0], [0.045, 0.045, 0.04], rust, 8, 4);
  }
  tube(out, 'metal', [0, 22.7, 0], [0, 23, 0], 0.02, rust, 8);
}

export const lighthouseCoastalStudies = [
  lighthouseStudy({
    id: 'N0642',
    key: 'lighthouse_of_genoa',
    title: 'Lighthouse of Genoa',
    wikidataId: 'Q776666',
    build: buildGenoa,
    size: [15, 77, 19],
    visualBrief:
      'Two tall square stone stages with deep layered corbel galleries, small staggered openings, painted Genoa cross and crown, rounded access buttress and metal-caged lantern.',
    sourceFacts: {
      heightMeters: 77,
      heightBasis: 'Current operator and Genoa municipal museum, superseding cached 76 m.',
      coreWidthMeters: 11,
      coreBasis: 'Exact-QID OSM relation is approximately 11.23 by 11.00 m; 11 m authored core.',
      currentFormYear: 1543,
    },
    referencePages: [
      'https://www.lanternadigenova.com/storia/',
      'https://www.museidigenova.it/en/museum-lighthouse-la-lanterna',
      'https://www.lanternadigenova.com/wp-content/uploads/2022/10/1200x1047px_LANTERNA_TORRE_A.jpg',
      'https://www.openstreetmap.org/relation/19515124',
      'https://www.lanternadigenova.it/fondazione-labo/',
    ],
    geographicProposal: {
      anchor: [8.9046428, 44.4045519],
      heading: -0.218891149401,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/relation/19515124',
      notes:
        'Main square shaft centered on exact mapped core with parallel axes. Crest is authored on -Z, giving the north-facing facade identified explicitly by operator PHAROS Heritage; the rounded access buttress lies at the northwest base. Height is from local rock contact, not sea level.',
    },
    limitations: [
      'Stage allocation, paired arcaded corbel rows and painted crown/scroll-shield contours are reconstructed from current operator photographs. Adjacent fortification and visitor museum extend beyond this tower model. Stone weathering is represented by the shared physical material rather than photograph-specific stains.',
    ],
    qaCameras: [
      { name: 'near-crest', position: [-16, 28, -28], lookAt: [0, 27, 0] },
      { name: 'near-gallery', position: [13, 42, 20], lookAt: [0, 38, 0] },
      { name: 'near-lantern', position: [10, 75, 15], lookAt: [0, 73, 0] },
      { name: 'far-silhouette', position: [72, 47, 93], lookAt: [0, 38, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0644',
    key: 'jeddah_light',
    title: 'Jeddah Light',
    wikidataId: 'Q1151131',
    build: buildJeddah,
    normalAt: jeddahNormalAt,
    size: [57, 131.4, 83],
    smoothNormalSlots: ['trim', 'foundation', 'window'],
    visualBrief:
      'Pale slender control tower on an elongated two-wing flared base, with bronze lower spherical glazing, a belt of small round arcades, sixteen tall arched windows and stacked cylindrical control rooms.',
    sourceFacts: {
      heightMeters: 131.4,
      heightBasis:
        'Catalog/Wikidata quantity; primary NGA photograph establishes identity and shape but does not independently measure this value.',
      geometryBasis:
        'NGA Sailing Directions Pub172, sector6 p118 and photographer fadlallah original2003 view establish arched capsule openings, small arcade belt, bronze-glazed lower half and flat control crown. Exact-identity OSM building/parts establish elongated base envelope.',
      mappedBaseMeters: [57.4, 82.4],
      mappedCoreAnchor: [39.149702, 21.468607],
    },
    referencePages: [
      'https://msi.nga.mil/api/publications/download?key=16694491%2FSFH00000%2FPub172bk.pdf',
      'https://saudipedia.com/en/jeddah-city',
      'https://www.wikidata.org/wiki/Q1151131',
      'https://commons.wikimedia.org/wiki/File:Jeddah_control_tower.jpg',
      'https://www.openstreetmap.org/way/265419490',
      'https://www.openstreetmap.org/way/265419493',
      'https://www.openstreetmap.org/way/265419494',
    ],
    geographicProposal: {
      anchor: [39.149702, 21.468607],
      heading: 0.18326,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/265419490',
      notes:
        'Tower core centered on mapped upper control-room circular parts. Elongated base +Z axis aligns with mapped opposed sloped wings, north/south roof directions349.5/169.5degrees. Upper tower rotational symmetry has no facade ambiguity; unsupported four-way entry canopies were removed.',
    },
    limitations: [
      'Intermediate capsule radii, arch subdivisions and glazing colors are photo-proportioned to the published total height, with mapped base size. The continuous base envelope is retained without fabricated entrance canopies. Surrounding terminal, port pavement and transient roof equipment are separate site features.',
    ],
    qaCameras: [
      { name: 'near-capsule', position: [43, 107, 53], lookAt: [0, 100, 0] },
      { name: 'near-crown', position: [20, 131, 30], lookAt: [0, 126, 0] },
      { name: 'near-base', position: [66, 31, 87], lookAt: [0, 10, 0] },
      { name: 'far-silhouette', position: [140, 79, 173], lookAt: [0, 65, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0645',
    key: 'rubjerg_knude_lighthouse',
    title: 'Rubjerg Knude lighthouse',
    wikidataId: 'Q2206180',
    build: buildRubjerg,
    size: [6.96, 23, 6.96],
    visualBrief:
      'Isolated pale tapering square tower with sparse narrow windows, recessed arch frieze, paneled stone gallery, open rust-colored lantern cage, faceted reflector and vented cap.',
    sourceFacts: {
      heightMeters: 23,
      relocation: 'Moved approximately 70 m inland on 22 October 2019; only the tower survives.',
      currentExterior:
        '2025 Danish Nature Agency photograph; proposed stair/lantern installation renewal is not presumed completed.',
    },
    referencePages: [
      'https://naturstyrelsen.dk/nyheder/2019/november/nu-bliver-rubjerg-knude-fyr-genaabnet',
      'https://naturstyrelsen.dk/nyheder/2025/marts/danmarksberoemt-fyr-renoveres-med-stoette-fra-realdania',
      'https://naturstyrelsen.dk/media/y5bd2clw/design-uden-navn-14.png',
      'https://www.openstreetmap.org/way/110889245',
      'https://www.openstreetmap.org/node/9353718244',
    ],
    geographicProposal: {
      anchor: [9.775489023, 57.449045721],
      heading: 1.819090002472,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/9353718244',
      notes:
        'Current relocated exact-QID footprint sets the shaft axes. Entrance node9353718244 on the east face resolves square symmetry: authored +Z door faces east with a slight north component.',
    },
    limitations: [
      'Window elevations, frieze relief and reflector folds are photo-proportioned. Eroding dune surface and former keeper buildings are excluded. The 2025 restoration announcement is a future project, so no unverified replacement installation is invented.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [6, 22, 8], lookAt: [0, 20.4, 0] },
      { name: 'near-frieze', position: [7, 18, 10], lookAt: [0, 17.6, 0] },
      { name: 'near-base', position: [9, 6, 12], lookAt: [0, 4, 0] },
      { name: 'far-silhouette', position: [24, 16, 33], lookAt: [0, 11.5, 0] },
    ],
  }),
];
