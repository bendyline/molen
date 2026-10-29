/** AW139 short nose, dimensioned from operator/EASA drawings, with Primus Epic cockpit.
 * Own shell stations, glazing apertures and panel layout; no generic helicopter body.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { glassDisplay } from './glass-display.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';
export const aw139Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 1.13,
  cy: 1.35,
  ry: 0.95,
  cabinZ: 2.24,
  cabinWidth: 2.1,
  eye: [-0.48, 1.82, 2.24],
  panelZ: 2.88,
  floor: 0.58,
  mainRotorPosition: [0, 3.57, 0],
});
export function buildAW139(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('AW139-white', '#e5e6df', { side: T.DoubleSide }),
    accent = mat('AW139-teal', '#30666b', { side: T.DoubleSide }),
    trim = mat('AW139-trim', '#252e31'),
    metal = mat('AW139-metal', '#a0aaa7', { metalness: 0.65 }),
    rubber = mat('AW139-tire', '#25292a'),
    glass = mat('AW139-glass', '#9cbec6', {
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'AW139-shell'),
    measured = [
      [4.5, 0.18, 0.64, 0.91],
      [4.25, 0.56, 0.48, 1.12],
      [3.65, 0.84, 0.4, 1.31],
      [3.2, 0.99, 0.39, 1.45],
      [2.22, 1.09, 0.39, 2.16],
      [1.5, 1.13, 0.38, 2.25],
      [0.1, 1.13, 0.38, 2.25],
      [-1.8, 1.13, 0.44, 2.25],
      [-2.85, 0.93, 0.74, 2.18],
      [-3.55, 0.63, 1.08, 2.12],
      [-6.95, 0.23, 1.68, 2.01],
      [-8.3, 0.16, 1.94, 2.17],
      [-8.8, 0.08, 2.04, 2.23],
    ];
  const ring = ([z, w, b, t]) => ({
      z,
      points: [
        [0, t],
        [w * 0.7, t - Math.min(0.035, (t - b) * 0.15)],
        [w, t - Math.min(0.18, (t - b) * 0.2)],
        [w, b + Math.min(0.2, (t - b) * 0.24)],
        [w * 0.63, b],
        [0, b - 0.035],
        [-w * 0.63, b],
        [-w, b + Math.min(0.2, (t - b) * 0.24)],
        [-w, t - Math.min(0.18, (t - b) * 0.2)],
        [-w * 0.7, t - Math.min(0.035, (t - b) * 0.15)],
      ],
    }),
    rings = measured.map(ring),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 3 && [0, 1, 8, 9].includes(j)) ||
      ([2, 3, 4, 5, 6].includes(i) && [2, 7].includes(j)) ||
      (i === 4 && [0, 9].includes(j)),
  });
  for (const j of [0, 1, 8, 9])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 10), p(3, (j + 1) % 10), glass, [0, 1, 1]);
  outline(
    d,
    [p(3, 8), p(4, 8), p(4, 9), p(4, 0), p(4, 1), p(4, 2), p(3, 2), p(3, 1), p(3, 0), p(3, 9)],
    0.019,
    paint,
  );
  d.rod(p(3, 0), p(4, 0), 0.024, paint);
  for (const j of [0, 9]) {
    const a = p(4, j),
      b = p(5, j),
      c = p(5, (j + 1) % 10),
      e = p(4, (j + 1) % 10),
      q = (u, v) =>
        a.map((_, k) => (a[k] * (1 - u) + b[k] * u) * (1 - v) + (e[k] * (1 - u) + c[k] * u) * v),
      h = [
        [0.14, 0.2],
        [0.84, 0.2],
        [0.86, 0.82],
        [0.2, 0.87],
      ].map(([u, v]) => q(u, v));
    sheet(d, [a, b, c, e], paint, [0, 1, 0], [h]);
    sheet(d, h, glass, [0, 1, 0]);
    outline(d, h, 0.013, trim);
  }
  const sx = (z, side) => {
    const i = measured.findIndex(
      (a, i) => i < measured.length - 1 && z <= a[0] && z >= measured[i + 1][0],
    );
    if (i < 0) return side * 1.13;
    const a = measured[i],
      b = measured[i + 1],
      u = (a[0] - z) / (a[0] - b[0]);
    return side * (a[1] * (1 - u) + b[1] * u);
  };
  for (const side of [-1, 1]) {
    const q = (z, y) => [sx(z, side), y, z],
      j = side > 0 ? 2 : 8,
      k = side > 0 ? 3 : 7;
    const rounded = (z, y, w, h) => [
      [z - w / 2 + 0.06, y - h / 2],
      [z + w / 2 - 0.06, y - h / 2],
      [z + w / 2, y - h / 2 + 0.07],
      [z + w / 2, y + h / 2 - 0.07],
      [z + w / 2 - 0.06, y + h / 2],
      [z - w / 2 + 0.06, y + h / 2],
      [z - w / 2, y + h / 2 - 0.07],
      [z - w / 2, y - h / 2 + 0.07],
    ];
    const windows = [
      [
        [3.55, 0.64],
        [3.12, 0.63],
        [2.96, 0.78],
        [3.08, 1.08],
        [3.55, 0.97],
      ],
      [
        [3.03, 1.15],
        [2.19, 1.98],
        [1.7, 2.02],
        [1.68, 1.12],
      ],
      [
        [2.98, 0.64],
        [1.72, 0.64],
        [1.72, 0.91],
        [2.77, 0.96],
      ],
      rounded(1.13, 1.6, 0.57, 0.78),
      rounded(0.27, 1.59, 0.63, 0.8),
      rounded(-0.58, 1.59, 0.63, 0.8),
    ].map((a) => a.map(([z, y]) => q(z, y)));
    sheet(
      d,
      [
        p(2, j),
        p(3, j),
        p(4, j),
        p(5, j),
        p(6, j),
        p(7, j),
        p(7, k),
        p(6, k),
        p(5, k),
        p(4, k),
        p(3, k),
        p(2, k),
      ],
      paint,
      [side, 0, 0],
      windows,
    );
    for (const h of windows) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.017, trim);
    }
    for (const a of [
      [
        [3.12, 0.56],
        [3.12, 1.2],
        [2.22, 2.12],
        [1.58, 2.15],
        [1.58, 0.56],
      ],
      [
        [1.47, 0.55],
        [1.47, 2.13],
        [0.77, 2.13],
        [0.77, 0.55],
      ],
      [
        [0.7, 0.53],
        [0.7, 2.16],
        [-1.1, 2.16],
        [-1.1, 0.53],
      ],
    ])
      outline(
        d,
        a.map(([z, y]) => q(z, y)),
        0.004,
        trim,
      );
    for (const z of [1.55, 0.73, -1.1, -1.9, -2.85, -4.6, -6.3]) {
      const i = measured.findIndex(
        (a, i) => i < measured.length - 1 && z <= a[0] && z >= measured[i + 1][0],
      );
      const a = measured[i],
        b = measured[i + 1],
        u = (a[0] - z) / (a[0] - b[0]),
        v = a.map((n, k) => n * (1 - u) + b[k] * u);
      outline(
        d,
        ring(v).points.map((p) => [...p, z]),
        0.0028,
        metal,
      );
    }
    for (const z of [1.55, 0.73, -1.1])
      for (let i = 0; i < 14; i++)
        d.add(new T.SphereGeometry(0.0033, 5, 3), metal, q(z, 0.62 + i * 0.1));
    for (const z of [1.75, 1.22, -0.9]) d.rod(q(z, 0.99), q(z + 0.15, 0.99), 0.013, metal);
    d.rod([side * 1.15, 2.2, 0.75], [side * 1.15, 2.2, -1.72], 0.018, metal);
    d.rod([side * 1.15, 0.5, 0.75], [side * 1.15, 0.5, -1.72], 0.017, metal);
    const stripe = [
      [4.32, 0.76],
      [3.6, 0.64],
      [1.5, 0.48],
      [-1.85, 0.53],
      [-3.55, 1.17],
      [-6.95, 1.77],
      [-8.3, 2.04],
    ];
    for (let i = 0; i < stripe.length - 1; i++) {
      const [z, y] = stripe[i],
        [zz, yy] = stripe[i + 1];
      quad(
        d,
        [sx(z, side) * 1.003, y, z],
        [sx(zz, side) * 1.003, yy, zz],
        [sx(zz, side) * 1.003, yy + 0.085, zz],
        [sx(z, side) * 1.003, y + 0.085, z],
        accent,
        [side, 0, 0],
      );
    }
    d.text('AW139', [sx(-3.82, side) * 1.01, 1.67, -3.82], 0.11, (side * Math.PI) / 2, accent);
    // Stub sponsons enclose the main-gear wells and carry the boarding step.
    const sg = group(root, `AW139-sponson-${side}`, [side * 1.3, 0.67, -1.1]),
      sd = detailKit(sg, 'sponson');
    loft(
      sd,
      [
        [0.87, 0.15],
        [0.55, 0.43],
        [-0.53, 0.45],
        [-0.8, 0.14],
      ].map(([z, w]) => ({
        z,
        points: [
          [0, 0.19],
          [side * w, 0.09],
          [side * w, -0.1],
          [0, -0.16],
          [-side * 0.18, -0.1],
          [-side * 0.18, 0.12],
        ],
      })),
      paint,
    );
    sd.box([0.23, 0.015, 0.56], [side * 0.12, -0.166, -0.07], trim);
    sd.finish();
    d.rod([side * 1.18, 0.35, 0.4], [side * 1.44, 0.35, 0.4], 0.02, metal);
    d.rod([side * 1.44, 0.35, 0.4], [side * 1.44, 0.35, -0.9], 0.024, metal);
    d.rod([side * 1.44, 0.35, -0.9], [side * 1.18, 0.35, -0.9], 0.02, metal);
    d.box([0.055, 0.055, 0.07], [side * 1.13, 2.05, 1.37], side < 0 ? d.green : d.red);
  }
  // Broad integrated transmission fairing and paired, rear-facing exhausts.
  const cowl = (z, w, b, t) => ({
    z,
    points: [
      [0, t],
      [w * 0.72, t - 0.06],
      [w, t - 0.19],
      [w, b],
      [-w, b],
      [-w, t - 0.19],
      [-w * 0.72, t - 0.06],
    ],
  });
  loft(
    d,
    [
      cowl(2.0, 0.46, 2.12, 2.28),
      cowl(0.65, 0.71, 2.25, 2.89),
      cowl(0.26, 0.66, 2.25, 3.13),
      cowl(-0.55, 0.81, 2.25, 3.13),
      cowl(-1.55, 0.78, 2.23, 2.96),
      cowl(-2.78, 0.62, 2.18, 2.57),
      cowl(-3.2, 0.44, 2.13, 2.28),
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    const q = [side * 0.795, 2.67, -1.2];
    d.box([0.014, 0.36, 0.48], q, trim);
    for (let i = 0; i < 9; i++)
      d.rod(
        [side * 0.806, 2.51 + i * 0.035, -0.98],
        [side * 0.806, 2.51 + i * 0.035, -1.42],
        0.005,
        metal,
      );
    const eg = group(root, `AW139-exhaust-${side}`, [side * 0.56, 2.55, -2.73]),
      ed = detailKit(eg, 'exhaust');
    eg.rotation.x = 0.12;
    ed.add(
      new T.CylinderGeometry(0.22, 0.23, 0.52, 20, 1, true).rotateX(Math.PI / 2),
      metal,
      [0, 0, 0],
    );
    ed.add(new T.CircleGeometry(0.2, 20).rotateY(Math.PI), trim, [0, 0, -0.265]);
    ed.ring(0.22, 0.022, [0, 0, -0.265], metal);
    ed.finish();
  }
  // Swept vertical fin, stabilizer and starboard four-blade tail rotor.
  const yz = [
    [1.88, -7.13],
    [2.2, -7.53],
    [3.66, -8.1],
    [3.77, -8.59],
    [3.53, -9.03],
    [2.18, -8.62],
    [1.98, -7.84],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      yz.map(([y, z]) => [side * 0.12, y, z]),
      accent,
      [side, 0, 0],
    );
  for (let i = 0; i < yz.length; i++) {
    const a = yz[i],
      b = yz[(i + 1) % yz.length];
    quad(d, [-0.12, ...a], [-0.12, ...b], [0.12, ...b], [0.12, ...a], accent, [0, 1, 0]);
  }
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.12, 1.99, -7.22, -8.35],
        [side * 2.11, 2.02, -7.62, -8.23],
      ],
      accent,
      0.045,
    );
    sheet(
      d,
      [
        [side * 1.97, 1.99, -7.63],
        [side * 2.11, 2.36, -7.96],
        [side * 2.11, 2.38, -8.24],
        [side * 1.97, 1.99, -8.24],
      ],
      paint,
      [side, 0, 0],
    );
  }
  d.rod([0, 3.63, -8.4], [-0.35, 3.63, -8.4], 0.075, metal);
  const tr = group(root, 'tail-rotor', [-0.36, 3.63, -8.4]),
    td = detailKit(tr, 'tail-hub');
  td.add(new T.SphereGeometry(0.12, 12, 8), metal, [0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const g = group(tr, `AW139-tail-blade-${i}`),
      dd = detailKit(g, 'tail-blade');
    g.rotation.x = ((i * 90 + 24) * Math.PI) / 180;
    dd.rod([0, 0, 0], [0, 0.3, 0], 0.032, metal);
    dd.box([0.025, 1.06, 0.2], [0, 0.82, 0], paint);
    for (const y of [0.96, 1.16]) dd.box([0.027, 0.075, 0.202], [0, y, 0], accent);
    dd.box([0.028, 0.09, 0.203], [0, 1.305, 0], dd.amber);
    dd.finish();
  }
  td.finish();
  const mast = group(root, 'AW139-mast', [0, 3.57, 0]);
  mast.rotation.x = (4 * Math.PI) / 180;
  const md = detailKit(mast, 'mast');
  md.rod([0, -0.42, 0], [0, 0.01, 0], 0.085, metal);
  md.ring(0.27, 0.03, [0, -0.22, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, 'hub');
  rd.add(new T.SphereGeometry(1, 16, 8).scale(0.28, 0.14, 0.28), paint, [0, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const g = group(rotor, `AW139-blade-${i}`),
      dd = detailKit(g, 'blade');
    g.rotation.y = (-(i * 72 + 16) * Math.PI) / 180;
    dd.rod([0.1, 0, 0], [0.86, 0, 0], 0.054, metal);
    dd.rod([0.2, -0.23, 0.1], [0.72, -0.02, 0.1], 0.019, metal);
    dd.rod([0.25, 0.04, -0.13], [0.7, 0.02, -0.17], 0.028, trim);
    wing(
      dd,
      [
        [0.78, 0, 0.24, -0.24],
        [5.95, -0.06, 0.24, -0.24],
        [6.6, -0.09, 0.18, -0.24],
        [6.9, -0.14, -0.06, -0.23],
      ],
      trim,
      0.045,
    );
    dd.box([0.06, 0.012, 0.28], [6.65, -0.06, -0.06], accent);
    dd.finish();
  }
  rd.finish();
  const gearNodes = [];
  for (const [name, x, z, dual] of [
    ['nose', 0, 3.08, true],
    ['left', 1.52, -1.26, false],
    ['right', -1.52, -1.26, false],
  ]) {
    const g = group(root, `AW139-gear-${name}`, [x, 0.55, z]),
      gd = detailKit(g, 'gear');
    gd.rod([0, 0.06, 0], [0, -0.3, 0], 0.04, metal);
    gd.rod([0, 0.03, 0.22], [0, -0.23, 0], 0.026, paint);
    for (const off of dual ? [-0.115, 0.115] : [0])
      wheel(gd, [off, -0.29, 0], 0.26, dual ? 0.16 : 0.21, rubber, metal, paint);
    gd.box([dual ? 0.32 : 0.26, 0.03, 0.39], [0, 0.06, -0.03], paint);
    gd.finish();
    gearNodes.push(g.name);
  }
  for (const side of [-1, 1]) {
    d.rod([side * 0.42, 1.46, 3.2], [side * 0.78, 1.85, 2.64], 0.012, trim);
    d.rod([side * 0.78, 1.85, 2.64], [side * 0.96, 1.88, 2.55], 0.008, trim);
    d.ring(0.055, 0.012, [side * 0.46, 0.71, 4.19], paint);
    d.add(new T.CircleGeometry(0.044, 12), glass, [side * 0.46, 0.71, 4.205]);
  }
  d.rod([0, 2.28, 1.38], [0, 2.66, 1.64], 0.013, paint);
  d.rod([0, 1.98, -5.47], [0, 2.2, -5.65], 0.012, paint);
  d.box([0.055, 0.06, 0.055], [0, 2.23, -3.03], d.red);
  d.finish();
  const interior = cockpit(root, { paint, accent, trim, metal });
  cleanGeometry(root);
  return {
    root,
    frame: aw139Frame(),
    enginePoints: [],
    visual: {
      rotors: [
        { node: 'main-rotor', axis: 'y', multiplier: 1 },
        { node: 'tail-rotor', axis: 'x', multiplier: 5 },
      ],
      gearNodes,
      flaps: [],
      ailerons: [],
      animation: { bindings: [] },
      interior,
    },
  };
}
function wheel(d, p, r, w, rubber, metal, paint) {
  d.add(new T.CylinderGeometry(r * 0.84, r * 0.84, w, 20).rotateZ(Math.PI / 2), rubber, p);
  for (const s of [-1, 1]) {
    d.ring(r * 0.82, r * 0.18, [p[0] + s * w * 0.29, p[1], p[2]], rubber, 'x');
    d.add(new T.CylinderGeometry(r * 0.48, r * 0.48, 0.02, 16).rotateZ(Math.PI / 2), paint, [
      p[0] + s * w * 0.52,
      p[1],
      p[2],
    ]);
    d.ring(r * 0.4, 0.009, [p[0] + s * w * 0.57, p[1], p[2]], metal, 'x');
  }
}
function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'AW139-cockpit'),
    bindings = [],
    face = mat('AW139-panel', '#3b4244'),
    seat = mat('AW139-seats', '#777d7a'),
    belt = mat('AW139-harness', '#444b4b'),
    z = 2.88,
    k = 0.2032 / 100,
    px = (u) => (674 - u) * k,
    py = (v) => 1.52 - (v - 1370) * k,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz],
    pt = panelTools(d);
  const contour = [
    [309, 1400],
    [326, 1368],
    [520, 1359],
    [579, 1337],
    [713, 1337],
    [770, 1358],
    [1034, 1373],
    [1051, 1402],
    [1039, 1527],
    [998, 1541],
    [357, 1541],
    [314, 1527],
  ].map(([u, v]) => at(u, v));
  sheet(d, contour, face, [0, 0, -1]);
  sheet(
    d,
    contour.map((p) => [p[0], p[1], z + 0.26]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, [b[0], b[1], z + 0.26], [a[0], a[1], z + 0.26], m.trim, [0, 1, 0]);
  }
  outline(d, contour, 0.021, m.trim);
  const brow = contour.slice(0, 8).map((p) => [p[0] * 1.025, p[1] + 0.025, p[2] - 0.01]);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0], b[1] - 0.08, z + 0.31], [a[0], a[1] - 0.08, z + 0.31], m.trim, [0, 1, 0]);
  }
  outline(d, brow, 0.025, m.trim, false);
  for (const [u, v, kind] of [
    [380, 1465, 'attitude'],
    [484, 1465, 'map'],
    [857, 1465, 'engine'],
    [969, 1465, 'attitude'],
  ]) {
    const x = px(u),
      y = py(v),
      w = 0.164,
      h = 0.226;
    if (kind === 'engine') {
      d.box([0.2032, 0.254, 0.027], [x, y, z - 0.012], m.trim);
      d.box([w, h, 0.007], [x, y, z - 0.03], d.dark);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const xx = x + (col - 1.5) * 0.031,
            yy = y + 0.073 - row * 0.067;
          d.box([0.002, 0.044, 0.003], [xx, yy, z - 0.04], d.ivory);
          d.box([0.004, 0.027, 0.003], [xx, yy - 0.007, z - 0.044], d.green);
        }
        d.text(
          ['TRQ', 'TGT', 'ENG'][row],
          [x, y + 0.1 - row * 0.067, z - 0.047],
          0.008,
          Math.PI,
          d.ivory,
        );
      }
    } else glassDisplay(d, x, y, z - 0.023, w, h, kind);
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++)
        d.box([0.009, 0.014, 0.01], [x + side * 0.092, y + 0.092 - i * 0.037, z - 0.047], face);
    if (kind === 'attitude') {
      const g = group(cabin, `AW139-horizon-${u}`, [x, y + 0.04, z - 0.068]),
        dd = detailKit(g, 'horizon');
      dd.box([0.056, 0.0015, 0.001], [0, 0, 0], dd.amber);
      dd.finish();
      bindings.push({ node: g.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 });
    }
  }
  glassDisplay(d, px(648), py(1430), z - 0.023, 0.193, 0.137, 'map');
  glassDisplay(d, px(744), py(1381), z - 0.023, 0.044, 0.049, 'attitude');
  for (const [u, v] of [
    [547, 1503],
    [746, 1503],
  ]) {
    pt.display(px(u), py(v - 20), z - 0.025, 0.068, 0.042, 'radio');
    for (const dy of [0, 22])
      for (const dx of [-15, 15]) pt.knob(px(u + dx), py(v + dy), z - 0.04, 0.009);
  }
  pt.gauge(px(552), py(1381), z - 0.019, 0.022, undefined, false);
  pt.gauge(px(744), py(1430), z - 0.019, 0.022, undefined, false);
  for (const u of [372, 483, 855, 967]) {
    d.box([0.06, 0.012, 0.008], at(u, 1384, -0.025), d.dark);
    d.text('AW139', at(u, 1384, -0.032), 0.005, Math.PI, d.ivory);
  }
  d.box([0.066, 0.065, 0.02], at(747, 1470, -0.02), m.trim);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      d.box([0.006, 0.006, 0.006], at(734 + c * 6, 1458 + r * 6, -0.033), d.ivory);
  // Long sloped center console: twin FMS CDUs, engine levers, audio and flight controls.
  const pg = group(cabin, 'AW139-pedestal', [0, 1.16, 2.83]);
  pg.rotation.x = -0.67;
  const pd = detailKit(pg, 'pedestal'),
    pp = panelTools(pd);
  beveledBox(pd, [0.54, 1.0, 0.16], [0, -0.46, 0.035], m.trim, 0.014);
  for (const x of [-0.16, 0.16]) {
    pp.display(x, -0.19, -0.055, 0.17, 0.1, 'radio');
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 5; c++) {
        pd.box([0.02, 0.02, 0.01], [x + (c - 2) * 0.024, -0.275 - r * 0.025, -0.064], face);
        pd.text(
          String((r * 5 + c) % 10),
          [x + (c - 2) * 0.024, -0.275 - r * 0.025, -0.073],
          0.006,
          Math.PI,
          pd.ivory,
        );
      }
  }
  for (const x of [-0.055, 0.055]) {
    pd.box([0.033, 0.16, 0.022], [x, -0.135, -0.06], face);
    pd.rod([x, -0.1, -0.08], [x, -0.09, -0.14], 0.009, m.metal);
    pd.box([0.027, 0.03, 0.024], [x, -0.09, -0.15], pd.red);
  }
  for (let r = 0; r < 4; r++)
    for (const x of [-0.2, -0.1, 0.1, 0.2]) {
      pp.knob(x, -0.51 - r * 0.09, -0.065, 0.012);
      pd.text(
        ['COM', 'AFCS', 'NAV', 'LTS'][r],
        [x, -0.49 - r * 0.09, -0.075],
        0.007,
        Math.PI,
        pd.ivory,
      );
    }
  pd.rod([0.27, -0.17, -0.065], [0.27, -0.1, -0.14], 0.011, m.metal);
  pd.box([0.025, 0.1, 0.025], [0.27, -0.1, -0.15], pd.red);
  pd.finish();
  d.box([2.02, 0.045, 4.86], [0, 0.58, 0.32], m.trim);
  const addSeat = (x, y, z) => {
    const sd = detailKit(cabin, 'AW139-seat');
    beveledBox(sd, [0.45, 0.115, 0.46], [x, y, z], seat);
    beveledBox(sd, [0.45, 0.6, 0.13], [x, y + 0.32, z - 0.21], seat);
    beveledBox(sd, [0.26, 0.17, 0.14], [x, y + 0.68, z - 0.21], seat);
    for (const s of [-1, 1]) {
      sd.rod(
        [x + s * 0.17, y - 0.21, z - 0.12],
        [x + s * 0.17, y - 0.05, z - 0.12],
        0.018,
        m.metal,
      );
      sheet(
        sd,
        [
          [x + s * 0.15, y + 0.55, z - 0.13],
          [x + s * 0.1, y + 0.55, z - 0.13],
          [x - s * 0.02, y + 0.075, z + 0.16],
          [x + s * 0.02, y + 0.075, z + 0.16],
        ],
        belt,
        [0, 0, 1],
      );
    }
    sd.box([0.06, 0.03, 0.02], [x, y + 0.08, z + 0.17], m.metal);
    sd.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * 0.48;
    addSeat(x, 0.85, 2.05);
    const cg = group(cabin, `AW139-cyclic-${side}`, [x, 0.59, 2.4]),
      cd = detailKit(cg, 'cyclic');
    outline(
      cd,
      [
        [0, 0, 0],
        [0, 0.22, 0],
        [0, 0.36, -0.16],
        [0, 0.5, -0.16],
      ],
      0.018,
      m.trim,
      false,
    );
    beveledBox(cd, [0.075, 0.14, 0.07], [0, 0.53, -0.16], m.trim, 0.012);
    cd.box([0.025, 0.025, 0.018], [0, 0.57, -0.205], cd.red);
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `AW139-collective-${side}`, [x + 0.26, 0.7, 1.83]),
      ld = detailKit(lg, 'collective');
    ld.rod([0, 0, 0], [0, 0.24, 0.37], 0.023, m.trim);
    beveledBox(ld, [0.1, 0.065, 0.17], [0, 0.25, 0.4], m.trim, 0.01);
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const j of [-1, 1]) {
      const g = group(cabin, `AW139-pedal-${side}-${j}`, [x + j * 0.13, 0.68, 3.06]),
        dd = detailKit(g, 'pedal');
      dd.box([0.14, 0.04, 0.08], [0, 0, 0], m.metal);
      dd.rod([0, 0, 0], [0, -0.09, 0.08], 0.014, m.trim);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.04,
      });
    }
  }
  for (const z of [0.75, -0.17, -1.09])
    for (const x of [-0.76, -0.25, 0.25, 0.76]) addSeat(x, 0.82, z);
  const og = group(cabin, 'AW139-overhead', [0, 2.16, 2.1]),
    od = detailKit(og, 'overhead');
  od.box([0.19, 0.04, 0.7], [0, 0, 0], m.trim);
  for (let i = 0; i < 5; i++)
    for (const x of [-0.055, 0.055]) {
      od.box([0.04, 0.008, 0.08], [x, -0.025, -0.27 + i * 0.13], face);
      od.rod([x, -0.03, -0.27 + i * 0.13], [x, -0.06, -0.25 + i * 0.13], 0.004, m.metal);
    }
  od.finish();
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
