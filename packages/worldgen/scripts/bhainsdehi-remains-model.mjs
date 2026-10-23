/** 'N0552': pictured Bhainsdehi hall, carved stumps and low sanctuary, not a restored tower. */
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildBhainsdehiRemains(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    F = r.floorY,
    P = ([x, y, z]) => [r.center[0] + c * x - s * z, y, r.center[1] + s * x + c * z],
    D = ([x, y, z]) => [c * x - s * z, y, s * x + c * z],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    grade = (x, z) => {
      const p = P([x, 0, z]);
      return sample(p[0], p[2]);
    };
  box(f, 'base', 0, r.baseY, 0, 12.2, F - r.baseY - 0.1, 16.4);
  box(f, 'stone', 0, F - 0.1, 0, 12.35, 0.1, 16.55);
  // The approach lies outside the occupied platform; tread heights always exceed their base.
  const start = grade(0, 11.2) + 0.04,
    low = Math.min(r.baseY, start - 0.3);
  for (let i = 0; i < 6; i++) {
    const top = start + ((F - start) * (i + 1)) / 6;
    box(f, 'stone', 0, low, 11.0 - i * 0.49, 2.65, top - low, 0.55);
  }
  // Hollow rear sanctuary. Its low unseen exterior roof is an explicit approximation.
  box(f, 'pale', -2.5, F, -4.8, 0.65, 3.65, 5.8);
  box(f, 'pale', 2.5, F, -4.8, 0.65, 3.65, 5.8);
  box(f, 'pale', 0, F, -7.4, 4.4, 3.65, 0.65);
  for (const x of [-1.8, 1.8]) box(f, 'stone', x, F, -1.9, 1.45, 3.65, 0.7);
  box(f, 'stone', 0, F + 2.65, -1.9, 2.15, 1, 0.7);
  box(f, 'stone', 0, F, -1.9, 2.25, 0.24, 0.9);
  if (detail === 0) {
    box(f, 'stone', 0, F + 3.65, -4.8, 5.7, 0.8, 6.15);
  } else {
    const enclosure = rect(0, -4.8, 5.7, 6.15);
    enclosure.holes = [
      Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        return [Math.cos(a) * 2.2, -4.8 + Math.sin(a) * 2.2];
      }),
    ];
    prism(f, 'stone', enclosure, F + 3.65, F + 4.48);
    // Nested octagonal rings leave a real recessed ceiling rather than a painted disk.
    for (let k = 0; k < 5; k++) {
      const outer = 2.75 - k * 0.45,
        inner = outer - 0.46,
        ring = (radius) =>
          Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4 + Math.PI / 8;
            return [Math.cos(a) * radius, -4.8 + Math.sin(a) * radius];
          });
      prism(
        f,
        'stone',
        { outline: ring(outer), holes: [ring(inner)] },
        F + 3.5 + k * 0.17,
        F + 3.7 + k * 0.17,
      );
    }
    box(f, 'stone', 0, F + 4.3, -4.8, 1, 0.18, 1);
    box(f, 'stone', 0, F + 4.48, -4.8, 5.7, 0.12, 6.15);
  }
  const pier = (x, z, height, broken = false) => {
    if (detail === 0) {
      box(f, 'stone', x, F, z, broken ? 0.72 : 0.8, height, broken ? 0.72 : 0.8);
      return;
    }
    const levels = broken
      ? [
          [0, 1],
          [0.15, 1.05],
          [0.25, 0.79],
          [height - 0.15, 0.64],
          [height, 0.75],
        ]
      : [
          [0, 1],
          [0.14, 1.08],
          [0.28, 0.78],
          [0.44, 0.84],
          [0.55, 0.67],
          [1.35, 0.67],
          [1.46, 0.79],
          [1.57, 0.64],
          [2.6, 0.64],
          [2.7, 0.78],
          [3.3, 0.68],
          [3.55, 0.85],
          [height, 1.12],
        ];
    loft(
      f,
      'stone',
      x,
      z,
      levels.map(([y, w]) => [F + y, w]),
      false,
    );
    if (detail < 2) return;
    // Original small leaf diamonds and banded recesses evoke carving without copying sculpture.
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2,
        n = [Math.sin(a), 0, Math.cos(a)],
        u = [Math.cos(a), 0, -Math.sin(a)],
        q = (t, y, depth) => [x + u[0] * t + n[0] * depth, F + y, z + u[2] * t + n[2] * depth];
      for (const y of broken ? [0.5, 0.85] : [0.85, 1.1, 1.9, 2.25, 2.98]) {
        if (y + 0.12 >= height) continue;
        f(
          'stone',
          [q(-0.12, y, 0.34), q(0, y + 0.16, 0.38), q(0.12, y, 0.34), q(0, y - 0.16, 0.38)],
          n,
        );
      }
      if (detail === 3 && !broken)
        for (const y of [0.7, 1.65, 2.85])
          f(
            'inset',
            [
              q(-0.18, y, 0.341),
              q(0.18, y, 0.341),
              q(0.18, y + 0.07, 0.341),
              q(-0.18, y + 0.07, 0.341),
            ],
            n,
          );
    }
  };
  for (const [x, z] of r.columns) pier(x, z, 3.8);
  for (const [x, height] of r.stumps) pier(x, 6.5, height, true);
  // Modern shelter, independent from the ancient stone ceiling. Open sides remain open.
  for (const x of [-4.5, 4.5]) {
    box(f, 'metal', x, F + 3.8, 1.2, 0.14, 0.12, 7.5);
    for (const z of [-1.8, 4.2]) box(f, 'metal', x, F + 3.8, z, 0.09, 1.13, 0.09);
  }
  for (const z of [-2.5, 0, 2.5, 5]) box(f, 'metal', 0, F + 4.75, z, 10.8, 0.12, 0.1);
  const sheet = (x, z) => [x, F + 4.91 + (1 - Math.abs(x) / 5.5) * 0.2, z];
  for (const [a, b] of [
    [-5.5, 0],
    [0, 5.5],
  ]) {
    f('metal', [sheet(a, -2.6), sheet(b, -2.6), sheet(b, 5.4), sheet(a, 5.4)], [0, 1, 0]);
    f(
      'metal',
      [
        sheet(a, 5.4).map((v, k) => v - (k === 1 ? 0.04 : 0)),
        sheet(b, 5.4).map((v, k) => v - (k === 1 ? 0.04 : 0)),
        sheet(b, -2.6).map((v, k) => v - (k === 1 ? 0.04 : 0)),
        sheet(a, -2.6).map((v, k) => v - (k === 1 ? 0.04 : 0)),
      ],
      [0, -1, 0],
    );
  }
  if (detail >= 2)
    for (let i = 0; i < 28; i++) {
      const x = -5.4 + (i * 10.8) / 27;
      box(f, 'metal', x, sheet(x, 0)[1], 1.4, 0.035, 0.035, 8);
    }
  if (detail >= 1) {
    // Recessed door framing and opened paired grilles, not a black painted opening.
    for (const x of [-1.13, 1.13]) {
      box(f, 'stone', x, F + 0.24, -1.42, 0.16, 2.5, 0.14);
      if (detail >= 2)
        for (let k = 0; k < 6; k++) box(f, 'pale', x, F + 0.24, -1.5 - k * 0.15, 0.028, 2.3, 0.028);
    }
    box(f, 'stone', 0, F + 2.68, -1.42, 2.45, 0.2, 0.2);
    box(f, 'blue', 0, F, 1.5, 1.25, 0.25, 2.15);
    const ellipsoid = (role, center, radii, bands = 4, count = 8) => {
      const p = (i, j) => {
        const a = (i * Math.PI) / bands,
          b = (j * 2 * Math.PI) / count;
        return [
          center[0] + radii[0] * Math.sin(a) * Math.cos(b),
          center[1] + radii[1] * Math.cos(a),
          center[2] + radii[2] * Math.sin(a) * Math.sin(b),
        ];
      };
      for (let i = 0; i < bands; i++)
        for (let j = 0; j < count; j++) {
          const ps = [p(i, j), p(i, j + 1), p(i + 1, j + 1), p(i + 1, j)],
            n = ps[0].map((v, k) => v - center[k]);
          f(role, ps, n);
        }
    };
    // Deliberately original low-poly animal and lingam silhouettes, no replicated statuary.
    ellipsoid('pale', [0, F + 0.7, 1.55], [0.4, 0.37, 0.72]);
    ellipsoid('pale', [0, F + 1.02, 1.4], [0.3, 0.3, 0.35]);
    ellipsoid('pale', [0, F + 1.15, 0.92], [0.24, 0.33, 0.24]);
    for (const x of [-0.24, 0.24]) {
      box(f, 'pale', x, F + 0.25, 1.45, 0.13, 0.35, 1.05);
      loft(
        f,
        'pale',
        x,
        0.92,
        [
          [F + 1.35, 0.12],
          [F + 1.58, 0.025],
        ],
        false,
      );
    }
    ellipsoid('inset', [0, F + 0.55, -4.6], [0.58, 0.14, 0.65], 3, 10);
    ellipsoid('inset', [0, F + 0.8, -4.65], [0.22, 0.4, 0.22], 4, 10);
  }
  if (detail >= 2) {
    // Broad mortar joints are actual shallow color accents; the shared ashlar graph supplies grain.
    for (const y of [F - 0.45, F - 0.9]) {
      box(f, 'inset', 0, y, 8.203, 12.15, 0.018, 0.008);
      for (const x of [-6.103, 6.103]) box(f, 'inset', x, y, 0, 0.008, 0.018, 16.3);
    }
  }
}
