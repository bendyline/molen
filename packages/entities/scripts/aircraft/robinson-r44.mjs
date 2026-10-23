/** R44 Raven II. Robinson POH 1-3 (2024), 7-21 (2015), Dtom cockpit photograph.
 * Meter landmarks are tied to the dimension sheet. Panel pitch is an explicit estimate.
 */

import { panelTools } from '../vehicle-interiors.mjs';
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
export const r44Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 0.64,
  cy: 1.1,
  ry: 0.7,
  cabinZ: 1.05,
  cabinWidth: 1.2,
  eye: [-0.3, 1.43, 1.05],
  panelZ: 1.67,
  floor: 0.47,
  mainRotorPosition: [0, 3.19, 0],
});
export function buildR44(s) {
  const root = new T.Group();
  root.name = s.slug;
  const white = mat('R44-ivory', '#e9e6d9', { side: T.DoubleSide }),
    blue = mat('R44-deep-blue', '#234f74', { side: T.DoubleSide }),
    trim = mat('R44-trim', '#22282c'),
    metal = mat('R44-metal', '#939da0', { metalness: 0.7 }),
    glass = mat('R44-glass', '#b9ced1', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.16,
    });
  const d = detailKit(root, 'R44-shell');
  const measured = [
    [2.34, 0.015, 0.8, 0.86],
    [2.2, 0.28, 0.56, 1.1],
    [1.9, 0.5, 0.44, 1.47],
    [1.2, 0.635, 0.39, 1.78],
    [0.35, 0.64, 0.42, 1.83],
    [-0.6, 0.57, 0.45, 1.72],
    [-1.4, 0.4, 0.59, 1.53],
    [-1.8, 0.22, 0.7, 1.4],
  ];
  const sections = measured.map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.73, t - Math.min(0.025, (t - b) * 0.2)],
      [w, t - Math.min(0.14, (t - b) * 0.25)],
      [w, b + Math.min(0.16, (t - b) * 0.25)],
      [w * 0.74, b],
      [-w * 0.74, b],
      [-w, b + Math.min(0.16, (t - b) * 0.25)],
      [-w, t - Math.min(0.14, (t - b) * 0.25)],
      [-w * 0.73, t - Math.min(0.025, (t - b) * 0.2)],
    ],
  }));
  for (const i of [0, 1, 2]) {
    sections[i].points[3][1] = Math.min(0.84, measured[i][3] - 0.015);
    sections[i].points[6][1] = sections[i].points[3][1];
  }
  const p = (i, j) => [
    ...sections[i].points[j],
    sections[i].z + (i === 7 && [3, 4, 5, 6].includes(j) ? 0.3 : 0),
  ];
  loft(d, sections, white, {
    skip: (i, j) => (i < 3 && [0, 1, 7, 8].includes(j)) || (i < 5 && [2, 6].includes(j)),
  });
  // The windshield is the shell itself: no painted body behind the transparent bubble.
  for (let i = 0; i < 3; i++)
    for (const j of [0, 1, 7, 8])
      quad(d, p(i, j), p(i + 1, j), p(i + 1, (j + 1) % 9), p(i, (j + 1) % 9), glass, [0, 1, 1]);
  outline(
    d,
    [0, 1, 2, 3].map((i) => p(i, 0)),
    0.012,
    trim,
    false,
  );
  outline(d, [p(3, 7), p(3, 8), p(3, 0), p(3, 1), p(3, 2)], 0.018, blue, false);
  const sx = (z, side) => {
    const i = measured.findIndex(
      (q, i) => i < measured.length - 1 && z <= q[0] && z >= measured[i + 1][0],
    );
    if (i < 0) return side * 0.64;
    const a = measured[i],
      b = measured[i + 1],
      u = (a[0] - z) / (a[0] - b[0]);
    return side * (a[1] * (1 - u) + b[1] * u);
  };
  for (const side of [-1, 1]) {
    const q = (z, y) => [sx(z, side), y, z],
      j = side > 0 ? 2 : 7,
      k = side > 0 ? 3 : 6;
    const holes = [
      [
        [1.15, 1.62],
        [0.66, 1.64],
        [0.9, 1.06],
        [1.51, 1.02],
      ],
      [
        [0.57, 1.64],
        [0.09, 1.6],
        [0.13, 1.12],
        [0.78, 1.09],
      ],
    ].map((a) => a.map(([z, y]) => q(z, y)));
    const corner = q(1.55, 1.0),
      noseCorner = q(1.9, 0.84);
    for (let i = 0; i < 2; i++)
      quad(d, p(i, j), p(i + 1, j), p(i + 1, k), p(i, k), glass, [side, 0, 0]);
    sheet(d, [p(2, j), p(3, j), corner, noseCorner], glass, [side, 0, 0]);
    outline(d, [p(0, k), p(1, k), noseCorner, corner, p(3, j)], 0.012, trim, false);
    sheet(
      d,
      [corner, p(3, j), p(4, j), p(5, j), p(5, k), p(4, k), p(3, k), p(2, k)],
      white,
      [side, 0, 0],
      holes,
    );
    for (const hole of holes) {
      sheet(d, hole, glass, [side, 0, 0]);
      outline(d, hole, 0.012, trim);
    }
    for (const door of [
      [
        [1.21, 1.69],
        [0.61, 1.7],
        [0.78, 0.72],
        [1.64, 0.69],
      ],
      [
        [0.57, 1.7],
        [0.035, 1.65],
        [0.06, 0.79],
        [0.79, 0.69],
      ],
    ])
      outline(
        d,
        door.map(([z, y]) => q(z, y)),
        0.004,
        trim,
      );
    for (const z of [0.32, 1.17]) {
      d.rod([sx(z, side) * 1.006, 0.9, z], [sx(z, side) * 1.006, 0.9, z + 0.075], 0.008, metal);
      for (const y of [1.43, 0.87])
        d.box([0.022, 0.05, 0.035], [sx(z + 0.3, side), y, z + 0.3], metal);
    }
    for (let i = 1; i < 7; i++) {
      const a = measured[i],
        b = measured[i + 1],
        ya = a[2] + (a[3] - a[2]) * 0.36,
        yb = b[2] + (b[3] - b[2]) * 0.36;
      quad(
        d,
        [a[1] * side * 1.004, ya, a[0]],
        [b[1] * side * 1.004, yb, b[0]],
        [b[1] * side * 1.004, yb + 0.045, b[0]],
        [a[1] * side * 1.004, ya + 0.045, a[0]],
        blue,
        [side, 0, 0],
      );
    }
    for (let i = 0; i < 7; i++)
      d.rod(
        [side * 0.43, 0.94 + i * 0.045, -1.34],
        [side * 0.46, 1.0 + i * 0.045, -1.12],
        0.012,
        trim,
      );
    outline(
      d,
      [
        [side * 1.04, 0.18, 1.65],
        [side * 1.04, 0.075, 1.46],
        [side * 1.04, 0.05, 1.32],
        [side * 1.04, 0.05, -0.93],
      ],
      0.05,
      trim,
      false,
    );
    for (const z of [0.7, -0.67]) {
      d.rod([side * 0.4, 0.47, z], [side * 1.04, 0.08, z], 0.038, white);
      d.rod([side * 0.4, 0.47, z + 0.04], [side * 1.04, 0.08, z + 0.04], 0.018, metal);
    }
    d.text('R44', [side * 0.574, 1.28, -0.57], 0.075, (side * Math.PI) / 2, blue);
  }
  // Tall, tapered transmission fairing and slender rising tail boom.
  const mastBase = [
      [-0.14, 1.8, 0.29],
      [0.14, 1.8, 0.29],
      [0.16, 1.78, -0.43],
      [-0.16, 1.78, -0.43],
    ],
    mastTop = [
      [-0.07, 2.94, 0.1],
      [0.07, 2.94, 0.1],
      [0.07, 2.94, -0.27],
      [-0.07, 2.94, -0.27],
    ];
  for (let i = 0; i < 4; i++)
    quad(d, mastBase[i], mastBase[(i + 1) % 4], mastTop[(i + 1) % 4], mastTop[i], white, [
      i === 1 ? 1 : i === 3 ? -1 : 0,
      0,
      i === 0 ? 1 : -1,
    ]);
  sheet(d, mastTop, white, [0, 1, 0]);
  const boom = (z, w, y, h) => ({
    z,
    points: Array.from({ length: 12 }, (_, i) => [
      Math.sin((i * Math.PI) / 6) * w,
      y + Math.cos((i * Math.PI) / 6) * h,
    ]),
  });
  loft(
    d,
    [
      boom(-0.53, 0.27, 1.62, 0.19),
      boom(-1.8, 0.2, 1.64, 0.23),
      boom(-4.0, 0.1, 1.9, 0.14),
      boom(-5.85, 0.062, 2.03, 0.072),
      boom(-6.12, 0.04, 2.02, 0.045),
    ],
    blue,
  );
  for (const z of [-1.9, -3, -4.1, -5.2]) {
    const u = (-z - 1.8) / 4.05;
    outline(
      d,
      boom(z, 0.2 - u * 0.138, 1.64 + u * 0.39, 0.23 - u * 0.158).points.map((p) => [...p, z]),
      0.0025,
      metal,
    );
  }
  d.rod([0, 1.68, -1.3], [0, 2.23, -1.65], 0.008, trim);
  const fin = [
    [-0.025, 2.03, -5.62],
    [-0.025, 3.02, -6.04],
    [-0.025, 3.01, -6.26],
    [-0.025, 2.01, -6.08],
    [-0.025, 1.29, -6.35],
    [-0.025, 1.3, -5.97],
  ];
  sheet(d, fin, white, [-1, 0, 0]);
  sheet(
    d,
    fin.map((p) => [-p[0], p[1], p[2]]),
    white,
    [1, 0, 0],
  );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(d, a, b, [-b[0], b[1], b[2]], [-a[0], a[1], a[2]], white, [0, 1, 0]);
  }
  outline(
    d,
    [
      [0, 1.8, -4.59],
      [0, 1.48, -4.82],
      [0, 1.31, -5.12],
      [0, 1.29, -5.75],
      [0, 1.34, -6.63],
    ],
    0.014,
    metal,
    false,
  );
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.08, 1.86, -4.63, -4.94],
        [side * 0.85, 1.86, -4.63, -4.94],
      ],
      white,
      0.04,
    );
    d.box([0.025, 0.03, 0.05], [side * 0.85, 1.88, -4.65], side < 0 ? d.green : d.red);
  }
  d.box([0.038, 0.065, 0.045], [0, 2.08, -4.43], d.red);
  const mast = group(root, 'R44-mast', [0, 3.19, 0]);
  mast.rotation.x = 0.055;
  const md = detailKit(mast, 'R44-mast');
  md.rod([0, -0.35, 0], [0, 0.035, 0], 0.038, metal);
  md.ring(0.115, 0.02, [0, -0.2, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, 'R44-head');
  rd.box([0.37, 0.07, 0.11], [0, 0, 0], metal);
  for (const side of [-1, 1]) {
    rd.rod([side * 0.09, -0.19, 0], [side * 0.25, 0, 0], 0.012, metal);
    wing(
      rd,
      [
        [side * 0.25, 0, 0.12, -0.12],
        [side * 0.5, 0.01, 0.13, -0.13],
        [side * 5.03, 0.035, 0.127, -0.127],
      ],
      trim,
      0.025,
    );
    rd.box([0.12, 0.006, 0.25], [side * 4.96, 0.041, 0], white);
  }
  rd.finish();
  const tr = group(root, 'tail-rotor', [0.12, 2.04, -5.85]),
    td = detailKit(tr, 'R44-tail-rotor');
  td.rod([-0.1, 0, 0], [0.07, 0, 0], 0.026, metal);
  for (const side of [-1, 1]) {
    td.box([0.018, 0.67, 0.13], [0.03, side * 0.4, 0], trim);
    for (const y of [0.3, 0.5, 0.7]) td.box([0.022, 0.06, 0.13], [0.03, side * y, 0], white);
  }
  td.finish();
  d.add(new T.SphereGeometry(0.045, 10, 6), d.ivory, [0, 0.75, 2.32]);
  d.finish();
  const interior = cockpit(root, { white, blue, trim, metal });
  cleanGeometry(root);
  return {
    root,
    frame: r44Frame(),
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
function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'R44-cabin'),
    bindings = [],
    z = 1.67,
    seat = mat('R44-gray-leather', '#8a959d'),
    belt = mat('R44-belts', '#4c5358'),
    face = mat('R44-panel', '#333b3f'),
    tools = panelTools(d);
  d.box([1.12, 0.026, 1.93], [0, 0.47, 0.65], m.trim);
  const panel = [
    [-0.245, 1.28, z],
    [-0.22, 1.335, z],
    [0.22, 1.335, z],
    [0.245, 1.28, z],
    [0.23, 0.99, z],
    [0.18, 0.955, z],
    [-0.18, 0.955, z],
    [-0.23, 0.99, z],
  ];
  sheet(d, panel, face, [0, 0, -1]);
  sheet(
    d,
    panel.map((p) => [p[0], p[1], z + 0.1]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < panel.length; i++) {
    const a = panel[i],
      b = panel[(i + 1) % panel.length];
    quad(d, a, b, [b[0], b[1], z + 0.1], [a[0], a[1], z + 0.1], m.trim, [0, 1, 0]);
  }
  outline(d, panel, 0.008, m.trim);
  const gauges = [
    ['VSI', 0.1575, 1.22, 'verticalSpeed'],
    ['ATT', 0.0525, 1.22, 'roll'],
    ['KTS', -0.0525, 1.22, 'airspeed'],
    ['RPM', -0.1575, 1.22, 'rpm'],
    ['VOR', 0.1575, 1.115, 'heading'],
    ['HDG', 0.0525, 1.115, 'heading'],
    ['ALT', -0.0525, 1.115, 'altitude'],
    ['MAP', -0.1575, 1.115, 'power'],
  ];
  for (const [name, x, y, source] of gauges) {
    tools.gauge(x, y, z - 0.006, 0.04, undefined, false);
    d.text(name, [x, y - 0.018, z - 0.018], 0.006, Math.PI, d.ivory);
    if (source === 'roll') {
      d.add(
        new T.CircleGeometry(0.031, 20, 0, Math.PI).rotateY(Math.PI),
        mat('R44-horizon-sky', '#406b8d'),
        [x, y, z - 0.015],
      );
      d.add(
        new T.CircleGeometry(0.031, 20, Math.PI, Math.PI).rotateY(Math.PI),
        mat('R44-horizon-earth', '#785238'),
        [x, y, z - 0.015],
      );
    }
    const g = group(cabin, `R44-${name}-needle`, [x, y, z - 0.025]),
      gd = detailKit(g, 'needle');
    if (source === 'roll') gd.box([0.048, 0.002, 0.001], [0, 0, 0], gd.amber);
    else gd.rod([0, -0.006, 0], [0, 0.028, 0], 0.0013, gd.ivory);
    gd.finish();
    bindings.push({
      node: g.name,
      source,
      property: 'rotation',
      axis: 'z',
      scale:
        source === 'roll'
          ? 1
          : source === 'heading'
            ? -1
            : source === 'altitude'
              ? 0.0206
              : source === 'airspeed'
                ? 0.045
                : 3.6,
      offset: ['roll', 'heading'].includes(source) ? 0 : -1.8,
    });
  }
  tools.gauge(0.1575, 1.014, z - 0.006, 0.027);
  for (let i = 0; i < 16; i++) {
    d.add(new T.CircleGeometry(0.005, 8).rotateY(Math.PI), i < 8 ? d.amber : d.red, [
      0.1875 - i * 0.025,
      1.303,
      z - 0.012,
    ]);
    d.text(
      [
        'CLT',
        'TMP',
        'MCH',
        'CO',
        'STR',
        'TCH',
        'FUL',
        'RPM',
        'FLT',
        'PMP',
        'ALT',
        'FIR',
        'OIL',
        'GOV',
        'THR',
        'BRK',
      ][i],
      [0.1875 - i * 0.025, 1.32, z - 0.014],
      0.004,
      Math.PI,
      d.ivory,
    );
  }
  for (const x of [-0.14, -0.19]) tools.knob(x, 1.015, z - 0.025, 0.012);
  const pedestal = group(cabin, 'R44-pedestal', [0, 0.8, 1.38]);
  pedestal.rotation.x = 0.64;
  const pd = detailKit(pedestal, 'R44-pedestal'),
    pt = panelTools(pd);
  pd.box([0.28, 0.64, 0.19], [0, 0, 0.06], face);
  for (let i = 0; i < 4; i++) {
    const y = 0.23 - i * 0.145;
    pd.box([0.25, 0.12, 0.012], [0, y, -0.042], m.trim);
    if (i < 2) {
      for (let c = 0; c < 2; c++) {
        const x = (c - 0.5) * 0.13;
        pt.gauge(x, y, -0.054, 0.023, undefined, false);
        pd.text(
          i === 0 ? (c ? 'FUEL' : 'OIL') : c ? 'CHT' : 'MAP',
          [x, y - 0.035, -0.065],
          0.007,
          Math.PI,
          pd.ivory,
        );
        pd.rod([x, y, -0.069], [x + 0.014, y + 0.009, -0.069], 0.0012, pd.ivory);
      }
    } else {
      pd.box([0.16, 0.045, 0.005], [0, y + 0.02, -0.052], pd.dark);
      pd.text(i === 2 ? 'COM' : 'XPDR', [0, y + 0.02, -0.057], 0.013, Math.PI, pd.ivory);
      pt.buttons(0, y - 0.027, -0.055, 6, 0.028);
      for (const x of [-0.103, 0.103]) pt.knob(x, y + 0.018, -0.06, 0.012);
    }
  }
  pd.box([0.035, 0.055, 0.024], [-0.085, 0.02, -0.075], pd.red);
  pd.finish();
  const cyclic = group(cabin, 'R44-T-bar-cyclic', [0, 0.48, 0.88]),
    cd = detailKit(cyclic, 'R44-T-bar');
  cd.rod([0, 0, 0], [0, 0.54, 0], 0.018, m.metal);
  for (const side of [-1, 1]) {
    outline(
      cd,
      [
        [0, 0.54, 0],
        [side * 0.24, 0.54, 0],
        [side * 0.3, 0.45, -0.07],
      ],
      0.016,
      m.metal,
      false,
    );
    cd.rod([side * 0.3, 0.45, -0.07], [side * 0.3, 0.33, -0.08], 0.025, m.trim);
    cd.box([0.018, 0.012, 0.02], [side * 0.3, 0.45, -0.09], cd.red);
  }
  cd.finish();
  bindings.push(
    { node: cyclic.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.14 },
    { node: cyclic.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.14 },
  );
  for (const row of [0, 1])
    for (const side of [-1, 1]) {
      const x = side * 0.3,
        sz = row ? -0.3 : 0.8;
      beveledBox(d, [0.45, 0.1, 0.47], [x, 0.68, sz], seat);
      const back = beveledBox(d, [0.45, 0.54, 0.08], [x, 0.96, sz - 0.23], seat);
      back.rotation.x = -0.12;
      for (const e of [-1, 1]) {
        sheet(
          d,
          [
            [x + e * 0.16, 1.19, sz - 0.24],
            [x + e * 0.12, 1.19, sz - 0.24],
            [x - e * 0.025, 0.75, sz + 0.14],
            [x + e * 0.025, 0.75, sz + 0.14],
          ],
          belt,
          [0, 0, 1],
        );
        d.rod([x + e * 0.14, 0.8, sz - 0.19], [x + e * 0.14, 1.17, sz - 0.2], 0.002, face);
      }
      d.box([0.055, 0.035, 0.022], [x, 0.76, sz + 0.14], m.metal);
      if (row) continue;
      const cg = group(cabin, `R44-collective-${side}`, [x + 0.235, 0.55, sz - 0.15]),
        ld = detailKit(cg, 'collective');
      ld.rod([0, 0, 0], [0, 0.12, 0.35], 0.02, m.trim);
      ld.box([0.04, 0.04, 0.12], [0, 0.12, 0.35], m.trim);
      ld.finish();
      bindings.push({
        node: cg.name,
        source: 'power',
        property: 'rotation',
        axis: 'x',
        scale: -0.35,
      });
      for (const k of [-1, 1]) {
        const pg = group(cabin, `R44-pedal-${side}-${k}`, [x + k * 0.1, 0.56, 1.7]),
          dd = detailKit(pg, 'pedal');
        dd.rod([-0.07, 0, 0], [0.07, 0, 0], 0.014, m.metal);
        dd.rod([0, 0, 0], [0, -0.07, 0.06], 0.01, m.trim);
        dd.finish();
        bindings.push({
          node: pg.name,
          source: 'yawInput',
          property: 'position',
          axis: 'z',
          scale: -k * 0.035,
        });
      }
    }
  d.box([0.095, 0.07, 0.06], [0, 1.56, 1.46], m.trim);
  tools.gauge(0, 1.56, 1.425, 0.026);
  d.rod([0, 1.6, 1.46], [0, 1.72, 1.4], 0.009, m.trim);
  for (const side of [-1, 1]) {
    d.rod([side * 0.52, 1.12, 0.1], [side * 0.52, 1.12, 0.22], 0.009, m.metal);
    d.box([0.025, 0.1, 0.08], [side * 0.53, 0.68, 0.55], m.trim);
  }
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
