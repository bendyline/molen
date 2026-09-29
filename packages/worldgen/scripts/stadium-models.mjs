/** Individually researched stadium exteriors and open bowls. No stock arena substitutions. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  concrete = [0.59, 0.61, 0.58],
  pale = [0.8, 0.82, 0.79],
  steel = [0.35, 0.39, 0.39],
  white = [0.91, 0.92, 0.89],
  dark = [0.035, 0.047, 0.05];
const E = (rx, rz, y, a) => [rx * Math.sin(a), y, rz * Math.cos(a)];
export function face(out, slot, points, color, expected) {
  let ps = points,
    n = normalFor(...ps.slice(0, 3));
  if (expected && n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    ps = [...ps].reverse();
    n = normalFor(...ps.slice(0, 3));
  }
  quad(out, slot, ps, n, color);
}
export function curve(out, points, r = 0.06, color = steel, slot = 'metal', sides = 8) {
  for (let i = 1; i < points.length; i++)
    tube(out, slot, points[i - 1], points[i], r, color, sides);
}
function ellipseCurve(out, rx, rz, y, r, color = steel, n = 240, slot = 'metal') {
  curve(
    out,
    Array.from({ length: n + 1 }, (_, i) => E(rx, rz, y, (i * TAU) / n)),
    r,
    color,
    slot,
  );
}
function annularSlab(
  out,
  { rx, rz, width, y, t = 0.24, color = concrete, n = 240, a0 = 0, a1 = TAU },
) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n,
      b = a0 + ((a1 - a0) * (i + 1)) / n;
    face(
      out,
      'concrete',
      [
        E(rx - width, rz - width, y + t, a),
        E(rx - width, rz - width, y + t, b),
        E(rx, rz, y + t, b),
        E(rx, rz, y + t, a),
      ],
      color,
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      [E(rx, rz, y, a), E(rx, rz, y, b), E(rx, rz, y + t, b), E(rx, rz, y + t, a)],
      color,
      [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
    );
    face(
      out,
      'concrete',
      [
        E(rx - width, rz - width, y, a),
        E(rx - width, rz - width, y + t, a),
        E(rx - width, rz - width, y + t, b),
        E(rx - width, rz - width, y, b),
      ],
      color,
      [-Math.sin((a + b) / 2), 0, -Math.cos((a + b) / 2)],
    );
    face(
      out,
      'concrete',
      [
        E(rx, rz, y, a),
        E(rx, rz, y, b),
        E(rx - width, rz - width, y, b),
        E(rx - width, rz - width, y, a),
      ],
      color,
      [0, -1, 0],
    );
  }
}
function pitchLine(out, points, width = 0.12) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      nx = ((-dz / L) * width) / 2,
      nz = ((dx / L) * width) / 2;
    face(
      out,
      'plastic',
      [
        [a[0] + nx, 0.027, a[1] + nz],
        [b[0] + nx, 0.027, b[1] + nz],
        [b[0] - nx, 0.027, b[1] - nz],
        [a[0] - nx, 0.027, a[1] - nz],
      ],
      white,
      [0, 1, 0],
    );
  }
}
export function soccerPitch(out) {
  box(out, 'turf', [-42, 0, -61], [42, 0.012, 61], [0.15, 0.31, 0.1]);
  for (let i = 0; i < 14; i++)
    face(
      out,
      'turf',
      [
        [-34, 0.016, -52.5 + i * 7.5],
        [34, 0.016, -52.5 + i * 7.5],
        [34, 0.016, -45 + i * 7.5],
        [-34, 0.016, -45 + i * 7.5],
      ],
      i % 2 ? [0.24, 0.39, 0.115] : [0.19, 0.335, 0.086],
      [0, 1, 0],
    );
  pitchLine(out, [
    [-34, -52.5],
    [34, -52.5],
    [34, 52.5],
    [-34, 52.5],
    [-34, -52.5],
  ]);
  pitchLine(out, [
    [-34, 0],
    [34, 0],
  ]);
  pitchLine(
    out,
    Array.from({ length: 97 }, (_, i) => [
      9.15 * Math.cos((i * TAU) / 96),
      9.15 * Math.sin((i * TAU) / 96),
    ]),
  );
  for (const sign of [-1, 1]) {
    const s = (z) => z * sign;
    pitchLine(out, [
      [-20.16, s(52.5)],
      [-20.16, s(36)],
      [20.16, s(36)],
      [20.16, s(52.5)],
    ]);
    pitchLine(out, [
      [-9.16, s(52.5)],
      [-9.16, s(47)],
      [9.16, s(47)],
      [9.16, s(52.5)],
    ]);
    pitchLine(
      out,
      Array.from({ length: 49 }, (_, i) => {
        const a = 0.648 + (i * (Math.PI - 1.296)) / 48;
        return [9.15 * Math.cos(a), s(41.5 - 9.15 * Math.sin(a))];
      }),
    );
    const g = transformed(out, sign > 0 ? 0 : Math.PI, [0, 0, s(52.5)]);
    for (const x of [-3.66, 3.66]) tube(g, 'metal', [x, 0.04, 0], [x, 2.44, 0], 0.06, white, 12);
    tube(g, 'metal', [-3.66, 2.44, 0], [3.66, 2.44, 0], 0.06, white, 12);
    for (const x of [-3.66, 3.66]) {
      curve(
        g,
        [
          [x, 2.44, 0],
          [x, 2.44, 1.35],
          [x, 0.035, 2.0],
        ],
        0.034,
        white,
        'metal',
      );
      for (let z = 0; z <= 2; z += 0.2)
        tube(g, 'plastic', [x, 0.03, z], [x, 2.42 * (1 - z / 2), z], 0.009, [0.8, 0.83, 0.76], 6);
    }
    for (let x = -3.6; x <= 3.61; x += 0.24)
      curve(
        g,
        [
          [x, 2.42, 0],
          [x, 2.42, 1.35],
          [x, 0.035, 2],
        ],
        0.009,
        [0.82, 0.83, 0.78],
        'plastic',
        6,
      );
    for (let y = 0.14; y < 2.45; y += 0.16)
      tube(
        g,
        'plastic',
        [-3.66, y, 2 - (y / 2.44) * 0.65],
        [3.66, y, 2 - (y / 2.44) * 0.65],
        0.009,
        [0.82, 0.83, 0.78],
        6,
      );
  }
}
export function chair(out, angle, p, color) {
  const o = transformed(out, angle, p);
  face(
    o,
    'plastic',
    [
      [-0.225, 0.34, -0.19],
      [0.225, 0.34, -0.19],
      [0.225, 0.34, 0.18],
      [-0.225, 0.34, 0.18],
    ],
    color,
    [0, 1, 0],
  );
  const front = [
    [-0.23, 0.31, 0.16],
    [0.23, 0.31, 0.16],
    [0.205, 0.78, 0.255],
    [-0.205, 0.78, 0.255],
  ];
  face(o, 'plastic', front, color, [0, 0, -1]);
  face(
    o,
    'plastic',
    front.map((v) => [v[0], v[1], v[2] + 0.035]),
    color,
    [0, 0, 1],
  );
}
function mix(row, col) {
  let h = Math.imul(row + 41, 2654435761) ^ Math.imul(col + 97, 1597334677);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function maracanaBowl(out) {
  const segments = 480;
  for (let row = 0; row < 70; row++) {
    const tier = row >= 31 ? 1 : 0,
      gap = tier ? 2.7 : 0,
      rx = 43.5 + row * 0.99 + gap,
      rz = 63.5 + row * 1.02 + gap,
      y = 1.35 + row * 0.415 + (tier ? 1.2 : 0),
      aisles = tier ? 48 : 40;
    const r2x = rx + 0.98,
      r2z = rz + 1.01;
    for (let i = 0; i < segments; i++) {
      const a = (i * TAU) / segments,
        b = ((i + 1) * TAU) / segments;
      face(
        out,
        'concrete',
        [E(rx, rz, y, a), E(rx, rz, y, b), E(r2x, r2z, y, b), E(r2x, r2z, y, a)],
        concrete,
        [0, 1, 0],
      );
      face(
        out,
        'concrete',
        [E(rx, rz, y - 0.41, a), E(rx, rz, y - 0.41, b), E(rx, rz, y, b), E(rx, rz, y, a)],
        concrete,
        [-Math.sin((a + b) / 2), 0, -Math.cos((a + b) / 2)],
      );
    }
    const count = Math.floor((TAU * Math.sqrt((rx * rx + rz * rz) / 2)) / 0.55);
    for (let i = 0; i < count; i++) {
      const a = (i * TAU) / count,
        as = (a / TAU) * aisles,
        near =
          ((Math.abs(as - Math.round(as)) * TAU) / aisles) * Math.sqrt((rx * rx + rz * rz) / 2);
      if (near < 1.22) continue;
      const west = Math.sin(a) < -0.68;
      if (west && row >= 31 && row < 37) continue;
      const rnd = mix(row, i),
        yellow = [0.84, 0.57, 0.065],
        blue = [0.06, 0.4, 0.65],
        gray = [0.67, 0.69, 0.62];
      const c =
        row < 28 ? (rnd < 0.54 ? yellow : blue) : rnd < 0.13 + (row - 28) * 0.015 ? gray : blue;
      chair(out, a, E(rx + 0.5, rz + 0.52, y, a), c);
    }
    if (row === 30)
      annularSlab(out, { rx: rx + 3.65, rz: rz + 3.7, width: 2.68, y: y + 0.02, t: 0.13 });
    // Each radial aisle has intermediate steps between the seating risers.
    for (let i = 0; i < aisles; i++) {
      const a = (i * TAU) / aisles,
        o = transformed(out, a, E(rx + 0.22, rz + 0.22, y - 0.2, a));
      box(o, 'concrete', [-1.16, 0, -0.18], [1.16, 0.2, 0.27], pale);
    }
  }
  // Vomitory mouths and short tunnel ceilings break the continuous bowl.
  for (const [r, y, n] of [
    [18, 8.8, 40],
    [48, 22.5, 48],
  ])
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        rx = 43.5 + r * 0.99 + (r > 30 ? 2.7 : 0),
        rz = 63.5 + r * 1.02 + (r > 30 ? 2.7 : 0),
        o = transformed(out, a, E(rx, rz, y, a));
      face(
        o,
        'glass',
        [
          [-1.28, -2.3, -0.04],
          [1.28, -2.3, -0.04],
          [1.28, 0.05, -0.04],
          [-1.28, 0.05, -0.04],
        ],
        dark,
        [0, 0, -1],
      );
      box(o, 'concrete', [-1.46, 0.05, -0.35], [1.46, 0.3, 1.7], pale);
      for (const x of [-1.39, 1.39])
        box(o, 'concrete', [x - 0.1, -2.3, -0.35], [x + 0.1, 0.2, 1.7], pale);
    }
  // Western press/VIP boxes, intentionally distinct from the continuous east stand.
  for (let i = 0; i < 18; i++) {
    const a = Math.PI * 1.28 + i * 0.024,
      o = transformed(out, a, E(89, 109, 15.65, a));
    box(o, 'concrete', [-2.2, 0, -0.6], [2.2, 2.7, 2.65], pale);
    face(
      o,
      'glass',
      [
        [-2.1, 0.32, -0.615],
        [2.1, 0.32, -0.615],
        [2.1, 2.2, -0.615],
        [-2.1, 2.2, -0.615],
      ],
      [0.12, 0.21, 0.23],
      [0, 0, -1],
    );
  }
}
function maracanaRoof(out) {
  const n = 60,
    inner = [60.2, 80.3],
    outer = [129, 147.5];
  const point = (a, t) => {
    const phase = ((a / TAU) * n) % 1,
      ridge = Math.cos(phase * TAU),
      peak = Math.max(0, t < 0.26 ? t / 0.26 : (1 - t) / 0.74),
      y = 34.5 + peak * (3.6 + ridge * 0.6);
    return E(inner[0] + (outer[0] - inner[0]) * t, inner[1] + (outer[1] - inner[1]) * t, y, a);
  };
  for (let i = 0; i < n * 3; i++)
    for (let j = 0; j < 16; j++) {
      const a = (i * TAU) / (n * 3),
        b = ((i + 1) * TAU) / (n * 3),
        t = j / 16,
        u = (j + 1) / 16,
        ps = [point(a, t), point(b, t), point(b, u), point(a, u)];
      face(out, 'membrane', ps, white, [0, 1, 0]);
      face(
        out,
        'membrane',
        ps.map((v) => [v[0], v[1] - 0.055, v[2]]),
        [0.84, 0.86, 0.8],
        [0, -1, 0],
      );
    }
  // Three tension rings and radial suspension stays visible both above and below the membrane.
  for (const [rx, rz, y] of [
    [60.0, 80.1, 34.31],
    [61, 81.1, 35.23],
    [78, 98, 38.7],
  ])
    ellipseCurve(out, rx, rz, y, 0.115, steel);
  ellipseCurve(out, 129, 147.5, 34.44, 0.38, steel);
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      outerP = E(129, 147.5, 34.4, a),
      highP = E(78, 98, 38.7, a),
      innerP = E(60, 80.1, 34.31, a);
    curve(out, [outerP, highP, innerP], 0.053, steel);
    curve(out, [outerP, E(78, 98, 32.4, a), innerP], 0.046, steel);
    beam(out, 'metal', E(78, 98, 32.4, a), highP, 0.14, 0.14, pale);
    curve(out, [E(129, 147.5, 34.2, a), E(60.2, 80.3, 34.1, a)], 0.074, pale);
    for (let j = 0; j < 5; j++) {
      const a2 = a + (j - 2) * 0.0052,
        p = E(60.15, 80.2, 34.28, a2),
        o = transformed(out, a2, p);
      box(o, 'metal', [-0.25, -0.2, -0.42], [0.25, 0.24, 0.05], steel);
      face(
        o,
        'glass',
        [
          [-0.21, -0.16, -0.435],
          [0.21, -0.16, -0.435],
          [0.21, 0.2, -0.435],
          [-0.21, 0.2, -0.435],
        ],
        [0.8, 0.84, 0.78],
        [0, 0, -1],
      );
    }
  }
  // Photovoltaics form two physical module rows around the compression ring.
  for (let i = 0; i < 360; i++)
    for (const r of [0, 1]) {
      const a = (i * TAU) / 360,
        b = ((i + 0.92) * TAU) / 360,
        r0 = 125.4 + r * 1.7,
        z0 = 143.9 + r * 1.7;
      const ps = [
        E(r0, z0, 35.23, a),
        E(r0, z0, 35.23, b),
        E(r0 + 1.5, z0 + 1.5, 35.08, b),
        E(r0 + 1.5, z0 + 1.5, 35.08, a),
      ];
      face(out, 'glass', ps, [0.13, 0.22, 0.27], [0, 1, 0]);
      curve(out, [...ps, ps[0]], 0.018, pale);
    }
}
function accessRamp(out, sign) {
  const o = transformed(out, sign > 0 ? 0 : Math.PI),
    x0 = 136,
    x1 = 254,
    zs = [-18.5, 18.5];
  for (const z of zs) {
    const w = 8.3,
      a = [x0, 15.5, z],
      b = [x1, 1.4, z];
    face(
      o,
      'concrete',
      [
        [a[0], a[1], z - w],
        [b[0], b[1], z - w],
        [b[0], b[1], z + w],
        [a[0], a[1], z + w],
      ],
      concrete,
      [0, 1, 0],
    );
    for (const zz of [z - w, z + w]) {
      beam(o, 'concrete', [x0, 15.5, zz], [x1, 1.4, zz], 0.27, 1.08, pale);
      curve(
        o,
        [
          [x0, 16.15, zz],
          [x1, 2.05, zz],
        ],
        0.055,
        steel,
      );
    }
    for (let x = x0 + 6; x < x1 - 4; x += 8.6) {
      const y = 15.5 - ((x - x0) / (x1 - x0)) * 14.1;
      for (const zz of [z - w + 0.4, z + w - 0.4])
        box(o, 'concrete', [x - 0.36, 0, zz - 0.38], [x + 0.36, y, zz + 0.38], pale);
    }
  }
  for (let i = 0; i < 28; i++) {
    const a = -0.6 + (i * 1.2) / 28,
      b = -0.6 + ((i + 1) * 1.2) / 28;
    const p = (r, t, y) => [216 + r * Math.cos(t), y, r * Math.sin(t)];
    face(
      o,
      'concrete',
      [p(38, a, 1.4), p(38, b, 1.4), p(48, b, 0.04), p(48, a, 0.04)],
      pale,
      [0, 1, 0],
    );
  }
}
export function buildMaracana(out) {
  soccerPitch(out);
  maracanaBowl(out);
  // Structural underside of the stepped bowl: the outward face must occlude the chairs from outside.
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360;
    face(
      out,
      'concrete',
      [
        E(43.5, 63.5, 0.7, a),
        E(43.5, 63.5, 0.7, b),
        E(115.8, 136.6, 31.0, b),
        E(115.8, 136.6, 31.0, a),
      ],
      concrete,
      [Math.sin((a + b) / 2), -1, Math.cos((a + b) / 2)],
    );
    face(
      out,
      'concrete',
      [
        E(115.8, 136.6, 31.0, a),
        E(115.8, 136.6, 31.0, b),
        E(115.8, 136.6, 32.1, b),
        E(115.8, 136.6, 32.1, a),
      ],
      pale,
      [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
    );
  }

  for (const y of [0.04, 5.35, 10.7, 16.1])
    annularSlab(out, { rx: 139, rz: 159.5, width: 22, y, t: y < 1 ? 0.22 : 0.48, n: 300 });
  for (let i = 0; i < 60; i++) {
    const a = (i * TAU) / 60,
      o = transformed(out, a),
      p0 = E(136, 156.5, 0, a),
      p1 = E(133.5, 153.5, 27.5, a),
      p2 = E(129, 147.5, 34.35, a);
    beam(out, 'concrete', p0, p1, 1.25, 1.7, concrete);
    beam(out, 'concrete', p1, p2, 1.5, 1.8, concrete);
    beam(out, 'concrete', E(117, 137, 16.5, a), p1, 1.0, 1.35, pale);
    // Curved white concrete crowns between original radial ribs, separated from the new membrane.
    const b = a + (TAU / 60) * 0.86,
      c = a + (TAU / 60) * 0.14;
    for (let j = 0; j < 8; j++) {
      const u = j / 8,
        v = (j + 1) / 8,
        p = (t) => E(132.1 + 5 * t, 151 + 6 * t, 32.7 - 5.1 * t * t, a),
        q = (t) => E(132.1 + 5 * t, 151 + 6 * t, 32.7 - 5.1 * t * t, b);
      face(out, 'concrete', [p(u), q(u), q(v), p(v)], pale, [0, 1, 0]);
    }
    for (const y of [5.82, 11.18, 16.58]) {
      tube(
        o,
        'metal',
        E(138, 158.5, y + 0.8, c - a),
        E(138, 158.5, y + 0.8, b - a),
        0.033,
        steel,
        8,
      );
    }
    const g = transformed(out, a, E(118, 138, 0.2, a));
    box(g, 'concrete', [-3.8, 0, -1], [3.8, 4.3, 1], pale);
    face(
      g,
      'glass',
      [
        [-2.9, 0.1, 1.02],
        [2.9, 0.1, 1.02],
        [2.9, 3.45, 1.02],
        [-2.9, 3.45, 1.02],
      ],
      dark,
      [0, 0, 1],
    );
    for (let x = -2.5; x < 2.6; x += 0.5)
      box(g, 'metal', [x - 0.023, 0.1, 1.04], [x + 0.023, 3.45, 1.07], steel);
  }
  // Four rounded diagonal access structures retain the recognizable historic envelope.
  for (const a of [0.43, -0.43, Math.PI + 0.43, Math.PI - 0.43]) {
    for (const y of [0.05, 5.15, 10.3, 15.45])
      annularSlab(out, {
        rx: 150,
        rz: 171,
        width: 14,
        y,
        t: 0.5,
        a0: a - 0.15,
        a1: a + 0.15,
        n: 26,
        color: pale,
      });
    for (let j = 0; j <= 8; j++) {
      const b = a - 0.15 + (j * 0.3) / 8;
      for (const [rx, rz] of [
        [136, 157],
        [149, 170],
      ])
        beam(out, 'concrete', E(rx, rz, 0, b), E(rx, rz, 15.8, b), 0.6, 0.6, pale);
    }
  }
  accessRamp(out, 1);
  accessRamp(out, -1);
  maracanaRoof(out);
  // Four roof-suspended scoreboards, not a solid cap over the pitch opening.
  for (const a of [0.63, -0.63, Math.PI + 0.63, Math.PI - 0.63]) {
    const o = transformed(out, a, E(104, 123, 26, a));
    box(o, 'metal', [-7.5, 0, -0.5], [7.5, 6.4, 0.5], steel);
    face(
      o,
      'glass',
      [
        [-7.14, 0.28, -0.52],
        [7.14, 0.28, -0.52],
        [7.14, 6.13, -0.52],
        [-7.14, 6.13, -0.52],
      ],
      dark,
      [0, 0, -1],
    );
    for (const x of [-5.2, 5.2]) tube(o, 'metal', [x, 6.4, 0], [x, 10, 0], 0.09, pale, 10);
  }
}

export const stadiumStudies = [
  {
    id: 'N0681',
    key: 'maracana',
    title: 'Maracanã',
    wikidataId: 'Q155174',
    build: buildMaracana,
    metricTriangleUv: true,
    size: [530, 39, 344],
    nativeAxes: {
      up: '+Y',
      front: '+Z',
      origin:
        'Mapped playing-pitch center at local pitch/site grade. Native+Z follows the pitch toward the southern goal; +X follows its short axis east-southeast.',
    },
    visualBrief:
      'Historic oval concrete stadium with sixty radial support ribs, open concourse bands, four diagonal access blocks and two long monumental ramps; rebuilt blue/yellow/gray seating bowl, western press boxes, field markings/goals,radially sculpted PTFE roof, three tension rings, radial stays/struts, photovoltaic perimeter and four suspended scoreboards.',
    sourceFacts: {
      roofPlanMeters: [295, 258],
      roofAreaSquareMeters: 46500,
      pitchMeters: [105, 68],
      basis:
        'Roof engineer sbp supplies the roof dimensions, membrane construction and one compression/three tension ring system, with credited detailed photographs of the current structure, seating mosaic and PV rows. Rio state owner installation manual supplies pitch105×68m, six access ramps and western press/VIP organization. Exact OSM pitch corners fix the axis; the building relation fixes the long ramps and diagonal-envelope locations. Roof elevations, chair distribution and smaller structural sections are photo reconstructions rather than engineering shop dimensions.',
    },
    referencePages: [
      'https://www.sbp.de/en/project/stadium-maracana-estadio-jornalista-mario-filho/',
      'https://www.sbp.de/app/uploads/2021/12/RIO_1771_MAX-1920x1280.jpg',
      'https://www.sbp.de/app/uploads/2021/12/RIO_1805_MAX-1920x1280.jpg',
      'https://www.sbp.de/app/uploads/2021/12/RIO_9060_MAX-1920x1280.jpg',
      'https://www.sbp.de/app/uploads/2025/07/IMG_4555_MAX.jpg',
      'https://www.rj.gov.br/casacivil/sites/default/files/arquivos_paginas/08.%20Anexo%20VII%20-%20Manual%20de%20Instala%C3%A7%C3%A3o.pdf',
      'https://www.openstreetmap.org/relation/4587734',
      'https://www.openstreetmap.org/way/1361281074',
    ],
    referenceRights:
      'References are used for dimensional and visual analysis only; no reference photograph, third-party texture, drawing or mesh is embedded. Geometry and component recipes are original. OSM-derived site measurements retain OpenStreetMap contributor attribution under ODbL1.0.',
    geographicProposal: {
      anchor: [-43.23018655, -22.91214575],
      heading: -0.5388188071670772,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      groundContactReviewed: true,
      groundContactBasis:
        'Playing surface and concrete support feet share Y=0. The lowest0.103m is the beveled diagonal concrete support end below its contact point, intentionally embedded at grade; no entire-model elevation offset is appropriate.',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/1361281074',
      notes:
        'The105×68m mapped pitch resolves the local axis independently of the long entrance ramps. Native+Z is the south-southwest goal direction, +X east-southeast. The western press/VIP boxes are on native-X; the two monumental ramps extend both ways along nativeX. Pitch/site datum is common local terrain contact; original earthworks are map terrain.',
    },
    limitations: [
      'Chair color mosaic and row counts are reconstructed from engineer photographs; modeled chair count is not a certified ticket inventory. Membrane shaping matches the visible ridge/valley pattern while cable prestress and exact structural deflection are outside exterior visualization. Advertising sponsors, game-specific equipment and crowds are omitted; the separate Maracanãzinho, athletics stadium and aquatic center remain separate map assets. All visible roofs are deliberately open above the playing field.',
    ],
    previewCamera: { position: [270, 180, 300], lookAt: [0, 14, 0], fov: 46 },
    qaCameras: [
      { name: 'near-roof-cables', position: [105, 49, 95], lookAt: [69, 35, 63] },
      { name: 'near-seating', position: [5, 12, 22], lookAt: [0, 17, 106] },
      { name: 'near-west-boxes', position: [-36, 12, 0], lookAt: [-85, 17, 0] },
      { name: 'near-facade', position: [170, 19, 155], lookAt: [100, 17, 95] },
      { name: 'near-monumental-ramp', position: [262, 38, 83], lookAt: [187, 8, 0] },
      { name: 'far-roof', position: [320, 320, 360], lookAt: [0, 15, 0] },
    ],
  },
];
