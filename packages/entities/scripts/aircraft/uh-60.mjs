/** UH-60M: Army airframe drawings plus exact M-model exterior and cockpit photos.
 * A/L drawings constrain common dimensions, never M avionics or blade geometry.
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
export const uh60Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 1.1811,
  cy: 1.3,
  ry: 0.9,
  cabinZ: 2.8,
  cabinWidth: 2.2,
  eye: [-0.56, 1.8, 2.67],
  panelZ: 3.18,
  floor: 0.56,
  mainRotorPosition: [0, 3.42, 0],
});
export function buildUH60(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('UH60-olive', '#505348', { side: T.DoubleSide }),
    trim = mat('UH60-trim', '#222829'),
    metal = mat('UH60-metal', '#89928b', { metalness: 0.6 }),
    glass = mat('UH60-glass', '#91b7bd', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    }),
    rubber = mat('UH60-tires', '#272c2a');
  const d = detailKit(root, 'UH60-airframe');
  const measured = [
    [4.66, 0.2, 0.72, 1.1],
    [4.45, 0.65, 0.54, 1.32],
    [4.05, 0.9, 0.47, 1.43],
    [3.6, 1.06, 0.44, 1.57],
    [2.9, 1.12, 0.42, 2.13],
    [2.5, 1.1811, 0.42, 2.2],
    [1.0, 1.1811, 0.42, 2.2],
    [-1.6, 1.1811, 0.42, 2.12],
    [-3.7, 0.83, 0.49, 2.1],
    [-4.4, 0.61, 0.54, 1.87],
    [-7.6, 0.35, 0.62, 1.55],
    [-9.5, 0.22, 0.75, 1.25],
    [-10.0, 0.1, 1, 1.2],
  ];
  const ring = ([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.72, t - Math.min(0.04, (t - b) * 0.2)],
      [w, t - Math.min(0.2, (t - b) * 0.24)],
      [w, b + Math.min(0.2, (t - b) * 0.24)],
      [w * 0.66, b],
      [-w * 0.66, b],
      [-w, b + Math.min(0.2, (t - b) * 0.24)],
      [-w, t - Math.min(0.2, (t - b) * 0.24)],
      [-w * 0.72, t - Math.min(0.04, (t - b) * 0.2)],
    ],
  });
  const rings = measured.map(ring),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 3 && [0, 1, 7, 8].includes(j)) ||
      ([3, 4, 5, 6].includes(i) && [2, 6].includes(j)) ||
      (i === 4 && [0, 8].includes(j)),
  });
  // Three frontal panes, plus roof glazing and pilot doors; all are shell apertures.
  const front = [
    p(3, 7),
    p(4, 7),
    p(4, 8),
    p(4, 0),
    p(4, 1),
    p(4, 2),
    p(3, 2),
    p(3, 1),
    p(3, 0),
    p(3, 8),
  ];
  for (const j of [0, 1, 7, 8])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 9), p(3, (j + 1) % 9), glass, [0, 1, 1]);
  outline(d, front, 0.018, paint);
  const interpolate = (a, b, u) => a.map((v, i) => v * (1 - u) + b[i] * u);
  for (const side of [-1, 1]) {
    const a = interpolate(p(3, 0), p(3, side > 0 ? 1 : 8), 0.37),
      b = interpolate(p(4, 0), p(4, side > 0 ? 1 : 8), 0.37);
    d.rod(a, b, 0.025, paint);
  }
  for (const j of [0, 8]) {
    const a = p(4, j),
      b = p(5, j),
      c = p(5, (j + 1) % 9),
      e = p(4, (j + 1) % 9),
      q = (u, v) =>
        a.map((_, k) => (a[k] * (1 - u) + b[k] * u) * (1 - v) + (e[k] * (1 - u) + c[k] * u) * v),
      h = [
        [0.15, 0.2],
        [0.85, 0.2],
        [0.85, 0.88],
        [0.15, 0.88],
      ].map(([u, v]) => q(u, v));
    sheet(d, [a, b, c, e], paint, [0, 1, 0], [h]);
    sheet(d, h, glass, [0, 1, 0]);
    outline(d, h, 0.012, trim);
  }
  const sx = (z, side) => {
    const i = measured.findIndex((a, i) => i < 12 && z <= a[0] && z >= measured[i + 1][0]);
    if (i < 0) return side * 1.18;
    const a = measured[i],
      b = measured[i + 1],
      u = (a[0] - z) / (a[0] - b[0]);
    return side * (a[1] * (1 - u) + b[1] * u);
  };
  for (const side of [-1, 1]) {
    const q = (z, y) => [sx(z, side), y, z],
      j = side > 0 ? 2 : 7,
      k = side > 0 ? 3 : 6;
    const windows = [
      [
        [3.44, 1.37],
        [2.83, 1.97],
        [2.58, 1.98],
        [2.58, 1.3],
      ],
      [
        [2.33, 1.95],
        [1.64, 1.94],
        [1.64, 1.29],
        [2.33, 1.29],
      ],
      [
        [1.4, 1.94],
        [0.22, 1.93],
        [0.22, 1.27],
        [1.4, 1.27],
      ],
      [
        [-0.01, 1.92],
        [-1.3, 1.88],
        [-1.3, 1.26],
        [-0.01, 1.26],
      ],
    ].map((a) => a.map(([z, y]) => q(z, y)));
    sheet(
      d,
      [p(3, j), p(4, j), p(5, j), p(6, j), p(7, j), p(7, k), p(6, k), p(5, k), p(4, k), p(3, k)],
      paint,
      [side, 0, 0],
      windows,
    );
    for (const a of windows) {
      sheet(d, a, glass, [side, 0, 0]);
      outline(d, a, 0.015, trim);
    }
    for (const a of [
      [
        [3.59, 1.48],
        [2.88, 2.09],
        [2.46, 2.12],
        [2.46, 0.95],
        [3.58, 0.95],
      ],
      [
        [2.38, 2.08],
        [1.56, 2.07],
        [1.56, 0.58],
        [2.38, 0.58],
      ],
      [
        [1.49, 2.06],
        [-1.45, 2.02],
        [-1.45, 0.57],
        [1.49, 0.57],
      ],
    ])
      outline(
        d,
        a.map(([z, y]) => q(z, y)),
        0.004,
        trim,
      );
    d.rod([side * 1.2, 2.15, 1.53], [side * 1.2, 2.1, -2.1], 0.018, metal);
    d.rod([side * 1.2, 0.61, 1.55], [side * 1.2, 0.61, -2.1], 0.018, metal);
    for (const z of [2.6, 0.25])
      d.rod([sx(z, side) * 1.012, 1.15, z], [sx(z, side) * 1.012, 1.15, z + 0.17], 0.012, trim);
    for (const z of [2.46, 1.51, -1.45])
      for (let n = 0; n < 13; n++)
        d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [sx(z, side) * 1.003, 0.68 + n * 0.1, z]);
    for (const z of [-2.1, -3.1, -4.4, -5.9, -7.3]) {
      const i = measured.findIndex((a, i) => i < 12 && z <= a[0] && z >= measured[i + 1][0]);
      const a = measured[i],
        b = measured[i + 1],
        u = (a[0] - z) / (a[0] - b[0]),
        v = a.map((n, k) => n * (1 - u) + b[k] * u);
      outline(
        d,
        ring(v).points.map((q) => [...q, z]),
        0.0028,
        trim,
      );
    }
    for (const [z, y, w, h] of [
      [-2.15, 1.73, 0.28, 0.13],
      [-2.45, 1.35, 0.37, 0.21],
      [-3.4, 1.16, 0.15, 0.26],
    ]) {
      const a = [
        [z - w / 2, y - h / 2],
        [z + w / 2, y - h / 2],
        [z + w / 2, y + h / 2],
        [z - w / 2, y + h / 2],
      ].map(([z, y]) => q(z, y));
      outline(d, a, 0.004, trim);
    }
    d.text(
      'UNITED STATES ARMY',
      [sx(-4.65, side) * 1.01, 1.21, -4.65],
      0.09,
      (side * Math.PI) / 2,
      trim,
    );
    d.rod([side * 1.2, 0.54, 1.53], [side * 1.43, 0.54, 0.2], 0.026, trim);
    d.rod([side * 1.43, 0.54, 0.2], [side * 1.2, 0.54, -0.1], 0.026, trim);
    // Main gear upper fairing and exposed oleo/drag brace, without auxiliary stores.
    beveledBox(d, [0.26, 0.22, 0.61], [side * 1.23, 0.88, 1.67], paint, 0.04);
    d.rod([side * 1.2, 0.9, 1.84], [side * 1.35382, 0.35, 1.14], 0.045, metal);
    d.rod([side * 1.12, 0.61, 2.15], [side * 1.35382, 0.33, 1.14], 0.031, paint);
    wheel(d, [side * 1.35382, 0.32, 1.14], 0.32, 0.254, rubber, metal, paint);
    for (const z of [3.82, 3.22])
      d.rod([side * 0.95, 1.67, z], [side * 1.15, 1.68, z + 0.35], 0.009, metal);
    d.box([0.05, 0.05, 0.08], [side * 1.2, 2.15, 1.65], side < 0 ? d.green : d.red);
  }
  // Transmission fairing and paired T700 nacelles with open intakes and upward exhausts.
  const cowl = (z, w, b, t) => ({
    z,
    points: [
      [0, t],
      [w * 0.75, t - 0.08],
      [w, t - 0.22],
      [w, b],
      [-w, b],
      [-w, t - 0.22],
      [-w * 0.75, t - 0.08],
    ],
  });
  loft(
    d,
    [
      cowl(2.48, 0.42, 2.12, 2.28),
      cowl(1.55, 0.62, 2.18, 2.48),
      cowl(0.4, 0.63, 2.2, 2.62),
      cowl(-1.3, 0.62, 2.1, 2.58),
      cowl(-2.45, 0.55, 2.02, 2.38),
      cowl(-3.7, 0.4, 1.89, 2.04),
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    const e = group(root, `UH60-engine-${side}`, [side * 0.94, 2.42, 0]),
      ed = detailKit(e, 'nacelle');
    loft(
      ed,
      [
        {
          z: 0.65,
          points: Array.from({ length: 16 }, (_, i) => [
            Math.sin((i * Math.PI) / 8) * 0.33,
            Math.cos((i * Math.PI) / 8) * 0.34,
          ]),
        },
        {
          z: -1.23,
          points: Array.from({ length: 16 }, (_, i) => [
            Math.sin((i * Math.PI) / 8) * 0.36,
            Math.cos((i * Math.PI) / 8) * 0.35,
          ]),
        },
        {
          z: -1.65,
          points: Array.from({ length: 16 }, (_, i) => [
            Math.sin((i * Math.PI) / 8) * 0.29,
            Math.cos((i * Math.PI) / 8) * 0.27,
          ]),
        },
      ],
      paint,
      { caps: false },
    );
    ed.ring(0.31, 0.034, [0, 0, 0.66], paint);
    ed.add(new T.CircleGeometry(0.28, 20), trim, [0, 0, 0.52]);
    ed.add(
      new T.CylinderGeometry(0.24, 0.28, 0.14, 20, 1, true).rotateX(Math.PI / 2),
      trim,
      [0, 0, 0.59],
    );
    const exhaust = group(e, 'UH60-exhaust', [0, 0.12, -1.58]);
    exhaust.rotation.x = 0.45;
    const xd = detailKit(exhaust, 'exhaust');
    xd.add(
      new T.CylinderGeometry(0.23, 0.28, 0.46, 16, 1, true).rotateX(Math.PI / 2),
      metal,
      [0, 0, 0],
    );
    xd.add(new T.CircleGeometry(0.205, 16).rotateY(Math.PI), trim, [0, 0, -0.24]);
    xd.finish();
    for (const z of [0.2, -0.85]) ed.ring(0.353, 0.003, [0, 0, z], metal);
    for (let i = 0; i < 8; i++)
      ed.box([0.012, 0.04, 0.12], [side * 0.345, -0.12 + i * 0.04, -0.5], trim);
    ed.finish();
  }
  // Vertical tail follows the common H-60 sweep; M fitting uses a folding stabilator.
  const yz = [
    [1.44, -7.8],
    [3.43, -9.65],
    [3.62, -10.25],
    [3.3, -10.7705],
    [1.9, -9.92],
    [1.3, -10.0],
    [1.1, -8.9],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      yz.map(([y, z]) => [side * 0.13, y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < yz.length; i++) {
    const a = yz[i],
      b = yz[(i + 1) % yz.length];
    quad(d, [-0.13, ...a], [-0.13, ...b], [0.13, ...b], [0.13, ...a], paint, [0, 1, 0]);
  }
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.1, 1.4, -8.85, -10.4],
        [side * 2.1844, 1.4, -9.1, -10.2],
      ],
      paint,
      0.055,
    );
    outline(
      d,
      [
        [side * 1.35, 1.48, -9.02],
        [side * 1.35, 1.48, -10.28],
      ],
      0.006,
      trim,
      false,
    );
  }
  d.rod([0, 0.89, -6.8], [0, 0.25, -7.6992], 0.048, metal);
  d.rod([0, 0.63, -7.75], [0, 0.25, -7.6992], 0.03, paint);
  wheel(d, [0, 0.23, -7.6992], 0.23, 0.15, rubber, metal, paint);
  const mount = group(root, 'UH60-tail-mount', [-0.2, 3.42, -9.9172]);
  mount.rotation.z = (-20 * Math.PI) / 180;
  const td = detailKit(mount, 'tail-support');
  td.rod([0.3, 0, 0], [-0.22, 0, 0], 0.09, metal);
  td.add(new T.SphereGeometry(1, 16, 8).scale(0.18, 0.24, 0.26), paint, [-0.18, 0, 0]);
  td.finish();
  const tr = group(mount, 'tail-rotor', [-0.24, 0, 0]),
    trd = detailKit(tr, 'UH60-tail-rotor');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      g = group(tr, `UH60-tail-blade-${i}`),
      dd = detailKit(g, 'tail-blade');
    g.rotation.x = a;
    dd.box([0.03, 1.45, 0.2], [0, 0.95, 0], trim);
    dd.rod([0, 0, 0], [0, 0.4, 0], 0.035, metal);
    dd.box([0.033, 0.12, 0.2], [0, 1.61, 0], paint);
    dd.finish();
  }
  trd.finish();
  const mast = group(root, 'UH60-mast', [0, 3.42, 0]);
  mast.rotation.x = (3 * Math.PI) / 180;
  const md = detailKit(mast, 'mast');
  md.rod([0, -0.77, 0], [0, 0.03, 0], 0.085, metal);
  md.ring(0.24, 0.035, [0, -0.37, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, 'UH60-main-hub');
  rd.add(new T.SphereGeometry(1, 16, 8).scale(0.25, 0.14, 0.25), metal, [0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = ((i * 90 - 23) * Math.PI) / 180,
      g = group(rotor, `UH60-blade-${i}`),
      dd = detailKit(g, 'wide-chord-blade');
    g.rotation.y = -a;
    dd.rod([0.1, 0, 0], [0.83, 0, 0], 0.06, metal);
    dd.rod([0.2, -0.38, 0.12], [0.75, -0.01, 0.12], 0.019, metal);
    dd.rod([0.23, 0.06, -0.1], [0.68, 0.07, -0.1], 0.03, trim);
    wing(
      dd,
      [
        [0.72, 0, 0.27, -0.27],
        [7.1, -0.03, 0.31, -0.31],
        [7.72, -0.05, 0.23, -0.4],
        [8.1788, -0.11, -0.05, -0.48],
      ],
      trim,
      0.035,
    );
    dd.box([0.04, 0.012, 0.48], [7.72, -0.03, -0.09], paint);
    dd.finish();
  }
  rd.finish();
  d.rod([0, 2.18, 2.4], [0, 2.61, 1.84], 0.01, paint);
  d.rod([0, 1.62, -5.3], [0, 2.08, -5.65], 0.012, paint);
  d.rod([0, 0.54, -3.4], [0, 0.18, -3.1], 0.012, trim);
  d.box([0.055, 0.06, 0.055], [0, 2.59, -1.75], d.red);
  for (const side of [-1, 1]) {
    d.ring(0.055, 0.015, [side * 0.53, 1.12, 4.45], paint);
    d.add(new T.CircleGeometry(0.043, 12), glass, [side * 0.53, 1.12, 4.465]);
    d.rod([side * 0.8, 1.56, 3.58], [side * 0.44, 1.87, 3.14], 0.01, trim);
    d.rod([side * 0.44, 1.87, 3.14], [side * 0.65, 2.01, 2.97], 0.007, trim);
  }
  d.finish();
  const interior = cockpit(root, { paint, trim, metal });
  cleanGeometry(root);
  return {
    root,
    frame: uh60Frame(),
    enginePoints: [],
    visual: {
      rotors: [
        { node: 'main-rotor', axis: 'y', multiplier: 1 },
        { node: 'tail-rotor', axis: 'x', multiplier: 5 },
      ],
      gearNodes: [],
      flaps: [],
      ailerons: [],
      animation: { bindings: [] },
      interior,
    },
  };
}
function wheel(d, at, r, w, rubber, metal, paint) {
  d.add(new T.CylinderGeometry(r * 0.85, r * 0.85, w, 24).rotateZ(Math.PI / 2), rubber, at);
  for (const side of [-1, 1]) {
    d.ring(r * 0.82, r * 0.18, [at[0] + side * w * 0.3, at[1], at[2]], rubber, 'x');
    d.add(new T.CylinderGeometry(r * 0.5, r * 0.5, 0.022, 18).rotateZ(Math.PI / 2), paint, [
      at[0] + side * w * 0.51,
      at[1],
      at[2],
    ]);
    d.ring(r * 0.42, 0.009, [at[0] + side * w * 0.56, at[1], at[2]], metal, 'x');
    for (let i = 0; i < 8; i++)
      d.add(new T.SphereGeometry(0.008, 5, 3), metal, [
        at[0] + side * w * 0.57,
        at[1] + Math.sin((i * Math.PI) / 4) * r * 0.3,
        at[2] + Math.cos((i * Math.PI) / 4) * r * 0.3,
      ]);
  }
}
function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'UH60-cockpit'),
    bindings = [],
    face = mat('UH60-instrument-face', '#343c3e'),
    seat = mat('UH60-upholstery', '#434949'),
    belt = mat('UH60-harness', '#9b9b8c'),
    z = 3.18,
    k = 1.63 / 1660;
  const px = (u) => (912 - u) * k,
    py = (v) => 1.63 - (v - 230) * k,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz],
    pt = panelTools(d);
  const contour = [
    [80, 290],
    [110, 247],
    [400, 231],
    [760, 220],
    [1080, 229],
    [1410, 252],
    [1690, 290],
    [1725, 538],
    [1708, 605],
    [1500, 630],
    [1300, 651],
    [756, 652],
    [419, 629],
    [111, 600],
    [70, 544],
  ].map(([u, v]) => at(u, v));
  sheet(d, contour, face, [0, 0, -1]);
  sheet(
    d,
    contour.map((p) => [p[0], p[1], z + 0.28]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, [b[0], b[1], z + 0.28], [a[0], a[1], z + 0.28], m.trim, [0, 1, 0]);
  }
  // The deep scalloped coaming is a separate curved cover above the flat face.
  const brow = [
    [0, 305],
    [45, 177],
    [205, 151],
    [355, 70],
    [595, 40],
    [930, 38],
    [1310, 75],
    [1550, 138],
    [1770, 185],
    [1840, 290],
  ].map(([u, v]) => at(u, v, -0.015));
  sheet(d, [...brow, ...contour.slice(0, 7).reverse()], m.trim, [0, 0, -1]);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0], b[1] - 0.24, z + 0.36], [a[0], a[1] - 0.24, z + 0.36], m.trim, [0, 1, 0]);
  }
  outline(d, brow, 0.024, m.trim, false);
  const displays = [
    [249, 387, 'attitude'],
    [589, 375, 'map'],
    [1248, 390, 'map'],
    [1575, 420, 'attitude'],
  ];
  for (const [u, v, kind] of displays) {
    const x = px(u),
      y = py(v),
      w = 0.264,
      h = 0.202;
    glassDisplay(d, x, y, z - 0.023, w, h, kind);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++)
        d.box(
          [0.011, 0.012, 0.01],
          [x + side * (w / 2 + 0.014), y + h * (0.44 - i * 0.11), z - 0.042],
          face,
        );
      for (let i = 0; i < 6; i++)
        d.box(
          [0.014, 0.01, 0.008],
          [x + w * (0.43 - i * 0.172), y + side * (h / 2 + 0.014), z - 0.043],
          face,
        );
    }
    pt.knob(x - w * 0.48, y - h * 0.58, z - 0.047, 0.011);
    if (kind === 'attitude') {
      const g = group(cabin, `UH60-horizon-${u}`, [x, y + 0.036, z - 0.068]),
        dd = detailKit(g, 'horizon');
      dd.box([0.067, 0.0015, 0.001], [0, 0, 0], dd.amber);
      dd.finish();
      bindings.push({ node: g.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 });
    }
  }
  glassDisplay(d, px(917), py(349), z - 0.025, 0.068, 0.064, 'attitude');
  pt.gauge(px(917), py(442), z - 0.015, 0.035, undefined, false);
  for (const u of [590, 1228]) {
    d.box([0.37, 0.08, 0.018], at(u, 558, -0.012), m.trim);
    for (let i = 0; i < 3; i++)
      d.box([0.084, 0.02, 0.005], at(u - 102 + i * 100, 535, -0.024), d.dark);
    for (let i = 0; i < 5; i++) {
      pt.knob(px(u - 56 + i * 37), py(579), z - 0.04, 0.01);
      d.text(
        ['HDG', 'ALT', 'VS', 'NAV', 'FD'][i],
        at(u - 56 + i * 37, 560, -0.035),
        0.006,
        Math.PI,
        d.ivory,
      );
    }
    for (const v of [540, 580])
      for (const off of [-166, -135]) pt.knob(px(u + off), py(v), z - 0.037, 0.01);
  }
  for (const u of [245, 1580])
    for (let i = 0; i < 5; i++)
      d.box([0.018, 0.022, 0.013], at(u + (i - 2) * 30, 563, -0.02), m.trim);
  for (const u of [225, 1608]) {
    d.box([0.16, 0.04, 0.08], at(u, 170, -0.12), m.trim);
    for (let i = 0; i < 3; i++)
      d.box([0.043, 0.022, 0.005], at(u + (i - 1) * 49, 171, -0.163), d.dark);
  }
  pt.knob(px(919), py(567), z - 0.032, 0.015);
  d.text('UH-60M', at(918, 258, -0.013), 0.009, Math.PI, d.ivory);
  for (const u of [120, 360, 765, 1050, 1430, 1700])
    d.add(new T.CircleGeometry(0.003, 8).rotateY(Math.PI), m.metal, at(u, 600, -0.006));
  const pg = group(cabin, 'UH60-center-console', [0, 0.9, 2.56]);
  pg.rotation.x = 1.1;
  const pd = detailKit(pg, 'console'),
    ppt = panelTools(pd);
  pd.box([0.81, 1.12, 0.17], [0, 0, 0.07], face);
  d.box([0.78, 0.32, 1.08], [0, 0.7, 2.64], face);
  d.box([0.77, 0.1, 0.31], [0, 1.15, 3.19], face);
  for (const x of [-0.26, 0.26]) {
    pd.box([0.23, 0.35, 0.03], [x, 0.24, -0.035], m.trim);
    pd.box([0.15, 0.11, 0.004], [x, 0.33, -0.054], pd.dark);
    pd.text('FMS', [x, 0.33, -0.058], 0.015, Math.PI, pd.green);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 6; c++) {
        pd.box([0.024, 0.02, 0.008], [x + (c - 2.5) * 0.031, 0.23 - r * 0.029, -0.054], face);
        pd.text(
          String((c + r) % 10),
          [x + (c - 2.5) * 0.031, 0.23 - r * 0.029, -0.06],
          0.006,
          Math.PI,
          pd.ivory,
        );
      }
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        pd.box([0.016, 0.016, 0.01], [x + side * 0.102, 0.38 - i * 0.03, -0.055], face);
  }
  for (let r = 0; r < 7; r++)
    for (const x of [-0.07, 0.07]) {
      pd.rod(
        [x, 0.4 - r * 0.11, -0.03],
        [x, 0.41 - r * 0.11, -0.066],
        0.004,
        r === 2 ? pd.red : m.metal,
      );
      pd.text(
        ['ENG', 'FUEL', 'GEN', 'SAS', 'BOOST', 'TRIM', 'TEST'][r],
        [x, 0.44 - r * 0.11, -0.066],
        0.006,
        Math.PI,
        pd.ivory,
      );
    }
  for (const x of [-0.29, 0.29]) {
    pd.box([0.19, 0.18, 0.012], [x, -0.16, -0.035], m.trim);
    for (let i = 0; i < 4; i++)
      ppt.knob(x + ((i % 2) - 0.5) * 0.09, -0.11 - Math.floor(i / 2) * 0.1, -0.055, 0.013);
    beveledBox(pd, [0.22, 0.12, 0.1], [x, -0.38, -0.055], m.trim, 0.025);
  }
  pd.rod([0, -0.39, -0.03], [0, -0.39, -0.15], 0.015, m.metal);
  pd.box([0.13, 0.025, 0.03], [0, -0.39, -0.16], m.trim);
  pd.text('PARK', [0, -0.35, -0.16], 0.008, Math.PI, pd.ivory);
  pd.finish();
  d.box([2.1, 0.045, 5.1], [0, 0.56, 0.77], m.trim);
  const addSeat = (parent, x, y, z, armored = false) => {
    const sd = detailKit(parent, 'UH60-seat');
    beveledBox(sd, [0.48, 0.12, 0.49], [x, y, z], seat);
    beveledBox(sd, [0.48, 0.65, 0.13], [x, y + 0.34, z - 0.23], seat);
    beveledBox(sd, [0.26, 0.18, 0.14], [x, y + 0.72, z - 0.24], seat);
    for (const side of [-1, 1]) {
      sd.rod(
        [x + side * 0.19, y - 0.26, z - 0.13],
        [x + side * 0.19, y - 0.07, z - 0.13],
        0.019,
        m.metal,
      );
      sheet(
        sd,
        [
          [x + side * 0.17, y + 0.59, z - 0.15],
          [x + side * 0.12, y + 0.59, z - 0.15],
          [x - side * 0.02, y + 0.08, z + 0.18],
          [x + side * 0.02, y + 0.08, z + 0.18],
        ],
        belt,
        [0, 0, 1],
      );
      if (armored)
        beveledBox(sd, [0.025, 0.66, 0.5], [x + side * 0.255, y + 0.24, z - 0.06], m.paint, 0.009);
    }
    sd.box([0.065, 0.035, 0.02], [x, y + 0.09, z + 0.19], m.metal);
    sd.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * 0.56;
    addSeat(cabin, x, 0.88, 2.61, true);
    const cg = group(cabin, `UH60-cyclic-${side}`, [x, 0.58, 2.96]),
      cd = detailKit(cg, 'cyclic');
    outline(
      cd,
      [
        [0, 0, 0],
        [0, 0.25, 0],
        [0, 0.39, -0.2],
        [0, 0.58, -0.2],
      ],
      0.02,
      m.trim,
      false,
    );
    beveledBox(cd, [0.075, 0.16, 0.075], [0, 0.6, -0.2], m.trim, 0.012);
    cd.box([0.025, 0.02, 0.015], [0, 0.67, -0.245], cd.red);
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `UH60-collective-${side}`, [x + 0.27, 0.7, 2.39]),
      ld = detailKit(lg, 'collective');
    ld.rod([0, 0, 0], [0, 0.23, 0.43], 0.026, m.trim);
    beveledBox(ld, [0.11, 0.07, 0.2], [0, 0.24, 0.45], m.trim, 0.01);
    for (const u of [-0.035, 0.035]) ld.box([0.02, 0.014, 0.025], [u, 0.29, 0.48], ld.dark);
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const j of [-1, 1]) {
      const g = group(cabin, `UH60-pedal-${side}-${j}`, [x + j * 0.14, 0.68, 3.52]),
        dd = detailKit(g, 'pedal');
      dd.box([0.15, 0.05, 0.09], [0, 0, 0], m.metal);
      dd.rod([0, 0, 0], [0, -0.1, 0.1], 0.016, m.trim);
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
  for (const side of [-1, 1]) {
    const cg = group(cabin, `UH60-crew-seat-${side}`, [side * 0.86, 0, 1.6]);
    cg.rotation.y = (side * Math.PI) / 2;
    addSeat(cg, 0, 0.88, 0);
  }
  for (const z of [0.2, -0.75, -1.7]) for (const x of [-0.7, 0, 0.7]) addSeat(cabin, x, 0.86, z);
  // Broad center overhead console and structural bow; switches remain diagrammatic.
  const og = group(cabin, 'UH60-overhead', [0, 2.1, 2.56]),
    od = detailKit(og, 'overhead');
  od.box([0.51, 0.055, 1.13], [0, 0, 0], m.trim);
  for (let r = 0; r < 10; r++)
    for (const x of [-0.17, -0.06, 0.06, 0.17]) {
      od.box([0.075, 0.007, 0.07], [x, -0.032, -0.46 + r * 0.1], face);
      od.rod(
        [x, -0.04, -0.46 + r * 0.1],
        [x, -0.075, -0.45 + r * 0.1],
        0.004,
        r === 2 ? od.red : m.metal,
      );
    }
  od.finish();
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
