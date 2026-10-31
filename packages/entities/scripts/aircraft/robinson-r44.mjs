/** R44 Raven II. Robinson POH 1-3 (2024), 7-21 (2015), Dtom cockpit photograph.
 * Meter landmarks are tied to the dimension sheet. Panel pitch is an explicit estimate.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  fittedFloor,
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
  // Side profile and plan keep the fitted stations (bubble half-width 0.38 m 0.14 m behind the
  // tip, 0.52 m at 0.31 m). Head-on the R44 is a rounded box (R44 Raven I front photo): sides
  // widest just below the door windows, roof shoulders about 0.3 m across and 0.4 m tall, so the
  // door glazing curves in toward the roof and the bubble is glass down to the landing lights.
  const shell = cabinShell(
    [
      // z, half width, keel, crown, widest at, superellipse exponent above / below it
      [2.22, 0.38, 0.6, 1.12, 0.88, 2.6, 2.6],
      [2.05, 0.52, 0.5, 1.31, 0.9, 3, 3],
      [1.9, 0.575, 0.44, 1.47, 0.92, 3.4, 3.6],
      [1.2, 0.635, 0.39, 1.78, 0.93, 4.6, 4.5],
      [0.35, 0.64, 0.42, 1.83, 0.93, 5, 4.5],
      [-0.6, 0.57, 0.45, 1.72, 0.98, 4.5, 4],
      [-1.4, 0.4, 0.59, 1.53, 1.05, 3, 3],
      [-1.8, 0.22, 0.7, 1.4, 1.05, 2.6, 2.6],
    ],
    [2.36, 0.9, 0.15],
    // The engine bay rounds off under the boom root instead of ending in a flat bulkhead.
    [-1.9, 1.06, 0.1],
  );
  const zs = shell.samples(0.25);
  // Bubble glazing: down to the lights in front, back to the door posts and the roof at z 1.2.
  const bubbleSide = (side) =>
    [
      [2.36, side * 0.262],
      [1.9, 0.86, side],
      [1.55, 1.0, side],
      [1.2, 1.64, side],
    ].map((c) => (c.length === 3 ? [c[0], shell.vAt(c[0], c[1], c[2])] : c));
  const bubble = [...bubbleSide(-1), ...bubbleSide(1).reverse()];
  const doors = [
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
  ];
  const windows = [-1, 1].flatMap((side) =>
    [
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
    ].map((a) => shell.region(a.map(([z, y]) => [z, y, side]))),
  );
  // Cheat line just below the glazing, one strip per skin bay so each piece stays convex.
  const stripeZ = zs.filter((z) => z >= -1.8 && z <= 2.05),
    band = (z, side) => {
      const [, b, t] = shell.size(z),
        y = b + (t - b) * 0.36;
      return [
        [z, y, side],
        [z, y + 0.045, side],
      ];
    };
  const stripe = [-1, 1].flatMap((side) =>
    stripeZ.slice(1).map((z, i) => shell.region([...band(stripeZ[i], side), ...band(z, side)])),
  );
  shell.build(
    d,
    white,
    [
      { poly: shell.region(bubble), material: glass },
      ...windows.map((poly) => ({ poly, material: glass })),
      ...stripe.map((poly) => ({ poly, material: blue })),
    ],
    zs,
    24,
  );
  outline(d, shell.trace(bubble, false), 0.01, trim, false);
  outline(
    d,
    shell.trace(
      [
        [1.2, 0],
        [2.36, 0],
      ],
      false,
      0.012,
    ),
    0.018,
    white,
    false,
  );
  for (const poly of windows) shell.strip(d, poly, 0.026, trim);
  // Painted V between the bubble halves, above the landing lights.
  const vee = [
    [-0.15, 0.885],
    [0.15, 0.885],
    [0, 0.99],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; i + j < 3; j++)
      for (const tri of [
        [
          [i, j],
          [i + 1, j],
          [i, j + 1],
        ],
        ...(i + j < 2
          ? [
              [
                [i + 1, j],
                [i + 1, j + 1],
                [i, j + 1],
              ],
            ]
          : []),
      ])
        sheet(
          d,
          tri.map(([a, b]) =>
            shell.headOn(
              vee[0][0] + ((vee[1][0] - vee[0][0]) * a + (vee[2][0] - vee[0][0]) * b) / 3,
              vee[0][1] + ((vee[1][1] - vee[0][1]) * a + (vee[2][1] - vee[0][1]) * b) / 3,
              0.003,
            ),
          ),
          white,
          [0, 0, 1],
        );
  for (const side of [-1, 1]) {
    const q = (z, y, lift = 0) => shell.point(z, y, side, lift);
    for (const door of doors)
      shell.strip(d, shell.region(door.map(([z, y]) => [z, y, side])), 0.008, trim, false);
    for (const z of [0.32, 1.17]) {
      d.rod(q(z, 0.9, 0.006), q(z + 0.075, 0.9, 0.006), 0.008, metal);
      for (const y of [1.43, 0.87]) d.box([0.022, 0.05, 0.035], q(z + 0.3, y), metal);
    }
    for (let i = 0; i < 7; i++)
      d.rod(q(-1.42, 0.94 + i * 0.045, 0.004), q(-1.2, 1.0 + i * 0.045, 0.004), 0.012, trim);
    // Twin landing lights under the painted V between the bubble halves.
    d.add(new T.SphereGeometry(0.038, 8, 6), d.ivory, shell.headOn(side * 0.052, 0.76, -0.012));
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
    d.text('R44', q(-0.57, 1.28, 0.003), 0.075, (side * Math.PI) / 2, blue);
  }
  // Tall, tapered transmission fairing and slender rising tail boom.
  // Rounded pylon in plan (front and rear edges as in side view), tapering to the mast top.
  const pylon = [
    [1.76, 0.15, 0.3, -0.45],
    [2.35, 0.11, 0.2, -0.35],
    [2.94, 0.07, 0.1, -0.27],
  ].map(([y, w, front, back]) =>
    Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8,
        s = Math.sin(a),
        c = Math.cos(a);
      return [
        w * Math.sign(s) * Math.pow(Math.abs(s), 2 / 3),
        y,
        (front + back) / 2 + ((front - back) / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.8),
      ];
    }),
  );
  for (let k = 0; k < pylon.length - 1; k++)
    for (let i = 0; i < 16; i++) {
      const a = pylon[k][i],
        b = pylon[k][(i + 1) % 16],
        n = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2 + 0.07];
      quad(d, a, b, pylon[k + 1][(i + 1) % 16], pylon[k + 1][i], white, n);
    }
  sheet(d, pylon[2], white, [0, 1, 0]);
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
  // The R44's only horizontal stabilizer stands out to the right at the fin root (rear photos).
  wing(
    d,
    [
      [-0.03, 2.0, -5.68, -6.1],
      [-0.95, 2.0, -5.79, -6.07],
    ],
    white,
    0.04,
  );
  d.box([0.025, 0.03, 0.05], [-0.95, 2.02, -5.81], d.green);
  d.box([0.025, 0.03, 0.05], [0.045, 1.93, -6.0], d.red);
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
  d.finish();
  const interior = cockpit(root, { white, blue, trim, metal }, shell);
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
function cockpit(root, m, shell) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'R44-cabin'),
    bindings = [],
    z = 1.67,
    seat = mat('R44-gray-leather', '#8a959d'),
    belt = mat('R44-belts', '#4c5358'),
    face = mat('R44-panel', '#333b3f'),
    tools = panelTools(d);
  // Cabin deck trimmed to the rounded lower corners of the shell.
  fittedFloor(
    d,
    [-0.4, 0, 0.4, 0.8, 1.2, 1.5, 1.7].map((z) => ({
      z,
      points: Array.from({ length: 40 }, (_, j) => shell.at(z, -0.5 + j / 40).slice(0, 2)),
    })),
    m.trim,
    { y: 0.483, front: 1.615, back: -0.315, width: 1.12, thickness: 0.026 },
  );
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

/** Monotone cubic through (xs ascending, ys): smooth between stations without overshoot. */
function smoothTable(xs, ys) {
  const n = xs.length,
    h = xs.slice(1).map((x, i) => x - xs[i]),
    s = h.map((dx, i) => (ys[i + 1] - ys[i]) / dx),
    m = xs.map((_, i) =>
      i === 0 ? s[0] : i === n - 1 ? s[n - 2] : s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2,
    );
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / s[i],
      b = m[i + 1] / s[i],
      q = a * a + b * b;
    if (q > 9) {
      m[i] = (3 / Math.sqrt(q)) * a * s[i];
      m[i + 1] = (3 / Math.sqrt(q)) * b * s[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i],
      t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h[i] * m[i] +
      (3 * t2 - 2 * t3) * ys[i + 1] +
      (t3 - t2) * h[i] * m[i + 1]
    );
  };
}

/** Keep the part of a convex (z, v) polygon left of a -> b (or right of it when `keepLeft` is false). */
function clipHalf(poly, a, b, keepLeft = true) {
  const side = (p) =>
    ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * (keepLeft ? 1 : -1);
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      sp = side(p),
      sq = side(q);
    if (sp >= 0) result.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return result;
}
const area2 = (poly) =>
  poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
/** Counter-clockwise convex hull of (z, v) points. */
function hull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
    chain = (list) => {
      const out = [];
      for (const p of list) {
        while (out.length > 1 && turn(out.at(-2), out.at(-1), p) <= 0) out.pop();
        out.push(p);
      }
      return out.slice(0, -1);
    };
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

/**
 * Rounded cabin shell lofted through measured stations, nose first: [z, half width, keel, crown,
 * widest-point height, superellipse exponent above and below it]. Domes close the ends from the
 * first and last stations to `nose` and `tail` [z, y, wedge] (`wedge` blends a dome's profile
 * toward a cone). The ring parameter v runs from the crown (0) over the +X side (0.25) to the keel
 * (±0.5), so glazing and paint are cut as exact regions of the curved skin rather than holes in
 * flat side sheets. Shared with the H125 builder.
 */
export function cabinShell(stations, nose, tail) {
  const rows = [...stations].sort((a, b) => a[0] - b[0]),
    table = [1, 2, 3, 4, 5, 6].map((k) =>
      smoothTable(
        rows.map((r) => r[0]),
        rows.map((r) => r[k]),
      ),
    ),
    front = rows.at(-1)[0],
    back = rows[0][0];
  const ring = (z, v) => {
    const [w, b, t, c, nt, nb] = table.map((f) => f(z)),
      a = 2 * Math.PI * v,
      s = Math.sin(a),
      q = Math.cos(a),
      n = q >= 0 ? nt : nb;
    return [
      w * Math.sign(s) * Math.pow(Math.abs(s), 2 / n),
      c + (q >= 0 ? t - c : c - b) * Math.sign(q) * Math.pow(Math.abs(q), 2 / n),
    ];
  };
  const dome = (z, end, [zEnd, yEnd, wedge = 0], v) => {
    const u = Math.min(1, (z - end) / (zEnd - end)),
      s = Math.sqrt(1 - u * u),
      sy = s * (1 - wedge) + (1 - u) * wedge,
      [x, y] = ring(end, v);
    return [x * s, yEnd + (y - yEnd) * sy, z];
  };
  const at = (z, v) =>
    z > front
      ? dome(z, front, nose, v)
      : tail && z < back
        ? dome(z, back, tail, v)
        : [...ring(z, v), z];
  const normal = (z, v) => {
    const e = 1e-4,
      a = at(z, v - e),
      b = at(z, v + e),
      c = at(Math.min(z + e, nose[0]), v),
      d = at(Math.max(z - e, tail?.[0] ?? back), v);
    const n = new T.Vector3(c[0] - d[0], c[1] - d[1], c[2] - d[2]).cross(
      new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
    );
    if (n.lengthSq() < 1e-18) return [0, 0, z > (front + back) / 2 ? 1 : -1];
    return n.normalize().toArray();
  };
  /** Ring parameter of height y at station z on one side (y falls from crown to keel). */
  const vAt = (z, y, side) => {
    let lo = 0,
      hi = 0.5;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (at(z, m)[1] > y) lo = m;
      else hi = m;
    }
    return (side * (lo + hi)) / 2;
  };
  /** Ring parameter of half width x on the upper +X quarter at station z (roof regions). */
  const vAtX = (z, x) => {
    let lo = 0,
      hi = 0.25;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (at(z, m)[0] < x) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const lifted = (z, v, lift) => {
    const p = at(z, v),
      n = normal(z, v);
    return p.map((c, k) => c + n[k] * lift);
  };
  return {
    at,
    normal,
    vAt,
    vAtX,
    /** Ascending z samples: stations split to at most `step`, then rounded steps over each dome. */
    samples(step) {
      const ends = [0.35, 0.62, 0.8, 0.92, 0.98, 1];
      return [
        ...(tail ? ends.map((u) => back + (tail[0] - back) * u).reverse() : []),
        ...rows.flatMap(([z], i) => {
          if (i === rows.length - 1) return [z];
          const n = Math.ceil((rows[i + 1][0] - z) / step);
          return Array.from({ length: n }, (_, k) => z + ((rows[i + 1][0] - z) * k) / n);
        }),
        ...ends.map((u) => front + (nose[0] - front) * u),
      ];
    },
    /** Station values at z: half width, keel, crown, widest-point height, exponents. */
    size: (z) => table.map((f) => f(z)),
    /** Surface point at station z and height y on one side, lifted along the skin normal. */
    point: (z, y, side, lift = 0) => lifted(z, vAt(z, y, side), lift),
    /** Point on the nose seen head-on at (x, y): where the skin ahead of the cabin passes it. */
    headOn(x, y, lift = 0) {
      const crown = y > nose[1] ? 0 : 0.5;
      let lo = front - 0.5,
        hi = nose[0];
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2,
          reach =
            Math.abs(x) < 1e-6
              ? (at(m, crown)[1] - y) * (crown ? -1 : 1)
              : Math.abs(at(m, vAt(m, y, 1))[0]) - Math.abs(x);
        if (reach > 0) lo = m;
        else hi = m;
      }
      const z = (lo + hi) / 2;
      return lifted(z, Math.abs(x) < 1e-6 ? crown : vAt(z, y, Math.sign(x)), lift);
    },
    /** Convex (z, v) region from side-view corners [z, y, side] or explicit [z, v]. */
    region: (corners) =>
      hull(corners.map((c) => (c.length === 3 ? [c[0], vAt(c[0], c[1], c[2])] : c))),
    /** Polyline on the skin through (z, v) points, split where the skin bends from the chord. */
    trace(points, closed = true, lift = 0.004, tolerance = 0.006, params = false) {
      const result = [],
        last = closed ? points.length : points.length - 1;
      const split = (a, b, depth) => {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          pa = lifted(...a, lift),
          pb = lifted(...b, lift),
          pm = lifted(...m, lift),
          gap = Math.hypot(...pm.map((c, k) => c - (pa[k] + pb[k]) / 2));
        if (depth < 5 && gap > tolerance) {
          split(a, m, depth + 1);
          split(m, b, depth + 1);
        } else result.push(params ? a : pa);
      };
      for (let k = 0; k < last; k++) split(points[k], points[(k + 1) % points.length], 0);
      if (!closed) result.push(params ? points.at(-1) : lifted(...points.at(-1), lift));
      return result;
    },
    /** Flush seal or seam on the skin along (z, v) points: a strip, not a tube (`inside` also
     * faces the cabin). */
    strip(d, points, width, material, inside = true, closed = true, tolerance = 0.004) {
      const path = this.trace(points, closed, 0, tolerance, true),
        n = path.length,
        position = [],
        normals = [];
      const rails = path.map((q, k) => {
        const p = at(...q),
          up = normal(...q),
          a = at(...path[closed ? (k + n - 1) % n : Math.max(k - 1, 0)]),
          b = at(...path[closed ? (k + 1) % n : Math.min(k + 1, n - 1)]),
          across = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
            .cross(new T.Vector3(...up))
            .normalize()
            .multiplyScalar(width / 2);
        return [-1, 1].map((e) => p.map((c, i) => c + up[i] * 0.003 + across.getComponent(i) * e));
      });
      for (let k = 0; k < (closed ? n : n - 1); k++) {
        const [a, b] = rails[k],
          [c, e] = rails[(k + 1) % n],
          up = normal(...path[k]),
          face = new T.Vector3(...c)
            .sub(new T.Vector3(...a))
            .cross(new T.Vector3(...b).sub(new T.Vector3(...a))),
          out = face.dot(new T.Vector3(...up)) > 0;
        for (const flip of inside ? [false, true] : [false]) {
          const tris = out !== flip ? [a, c, b, b, c, e] : [a, b, c, b, e, c];
          position.push(...tris.flat());
          for (let i = 0; i < 6; i++) normals.push(...up.map((v) => (flip ? -v : v)));
        }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      d.add(geometry, material);
    },
    /** Skin cells between the z samples (ascending) and `count` ring steps; each cell is split
     * exactly along the convex `regions` ({ poly, material }, first match wins), the rest is `body`.
     * With `inset` the cells form an inward-facing lining that far inside the skin, and regions
     * with a null material stay open (window apertures). */
    build(d, body, regions, zs, count, inset = 0) {
      const out = new Map(),
        sign = inset ? -1 : 1,
        place = (q) => {
          const p = at(...q),
            n = normal(...q);
          return p.map((c, k) => c - n[k] * inset);
        };
      const emit = (poly, material) => {
        if (!material || Math.abs(area2(poly)) < 1e-10) return;
        const data = out.get(material) ?? { position: [], normal: [] };
        out.set(material, data);
        for (let k = 1; k < poly.length - 1; k++) {
          let tri = [poly[0], poly[k], poly[k + 1]];
          const p = tri.map(place),
            face = new T.Vector3(...p[1])
              .sub(new T.Vector3(...p[0]))
              .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0]))),
            n = normal(
              (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
              (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
            );
          if (face.dot(new T.Vector3(...n)) * sign < 0) tri = [tri[0], tri[2], tri[1]];
          for (const q of tri) {
            data.position.push(...place(q));
            data.normal.push(...normal(...q).map((c) => c * sign));
          }
        }
      };
      // Split every cell along the regions first, then emit. A clip vertex on one piece's edge
      // must also be a vertex of the piece across that edge (same cell or a neighbour, wrapping
      // at the keel), or the curved skin between the two chords opens a hairline crack.
      const cells = new Map(),
        key = (i, j) => i * count + j;
      for (let i = 0; i < zs.length - 1; i++)
        for (let j = 0; j < count; j++) {
          const va = -0.5 + j / count,
            vb = -0.5 + (j + 1) / count,
            cell = [];
          let pieces = [
            [
              [zs[i], va],
              [zs[i + 1], va],
              [zs[i + 1], vb],
              [zs[i], vb],
            ],
          ];
          for (const { poly, material } of regions) {
            const next = [];
            for (const piece of pieces) {
              const zMin = Math.min(...piece.map((p) => p[0])),
                zMax = Math.max(...piece.map((p) => p[0])),
                vMin = Math.min(...piece.map((p) => p[1])),
                vMax = Math.max(...piece.map((p) => p[1]));
              if (
                zMax <= Math.min(...poly.map((p) => p[0])) ||
                zMin >= Math.max(...poly.map((p) => p[0])) ||
                vMax <= Math.min(...poly.map((p) => p[1])) ||
                vMin >= Math.max(...poly.map((p) => p[1]))
              ) {
                next.push(piece);
                continue;
              }
              let inside = piece,
                rest = piece;
              for (let k = 0; k < poly.length && inside.length; k++)
                inside = clipHalf(inside, poly[k], poly[(k + 1) % poly.length]);
              if (inside.length > 2) cell.push({ poly: inside, material });
              for (let k = 0; k < poly.length && rest.length > 2; k++) {
                const outside = clipHalf(rest, poly[k], poly[(k + 1) % poly.length], false);
                if (outside.length > 2 && Math.abs(area2(outside)) > 1e-10) next.push(outside);
                rest = clipHalf(rest, poly[k], poly[(k + 1) % poly.length]);
              }
            }
            pieces = next;
          }
          for (const piece of pieces) cell.push({ poly: piece, material: body });
          cells.set(key(i, j), cell);
        }
      const near = (i, j) => {
        const found = [];
        for (let ii = Math.max(0, i - 1); ii <= Math.min(zs.length - 2, i + 1); ii++)
          for (let jj = j - 1; jj <= j + 1; jj++) {
            const wrap = jj < 0 ? -1 : jj >= count ? 1 : 0;
            for (const { poly } of cells.get(key(ii, jj - wrap * count)))
              for (const p of poly) found.push([p[0], p[1] + wrap]);
          }
        return found;
      };
      /** Vertices strictly inside segment a -> b, in order (T-junctions to close). */
      const between = (a, b, points) => {
        const dz = b[0] - a[0],
          dv = b[1] - a[1],
          l = Math.hypot(dz, dv);
        if (l < 1e-12) return [];
        return points
          .map((p) => [p, ((p[0] - a[0]) * dz + (p[1] - a[1]) * dv) / (l * l)])
          .filter(
            ([p, t]) =>
              t * l > 1e-9 &&
              (1 - t) * l > 1e-9 &&
              Math.abs((p[0] - a[0]) * dv - (p[1] - a[1]) * dz) / l < 1e-9,
          )
          .sort((x, y) => x[1] - y[1])
          .map(([p]) => p)
          .filter(
            (p, k, list) => !k || Math.hypot(p[0] - list[k - 1][0], p[1] - list[k - 1][1]) > 1e-9,
          );
      };
      for (let i = 0; i < zs.length - 1; i++)
        for (let j = 0; j < count; j++) {
          const points = near(i, j);
          for (const { poly, material } of cells.get(key(i, j)))
            emit(
              poly.flatMap((a, k) => [a, ...between(a, poly[(k + 1) % poly.length], points)]),
              material,
            );
        }
      for (const [material, data] of out) {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(data.position, 3));
        geometry.setAttribute('normal', new T.Float32BufferAttribute(data.normal, 3));
        d.add(geometry, material);
      }
    },
  };
}
