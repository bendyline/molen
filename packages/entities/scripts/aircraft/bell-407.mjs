/** Bell 407GX, standard low gear: Bell 2013 specifications pp8/10 and EASA OEB
 * 2012 pp10–12, with Waerfelu's CC BY 3.0 GX cockpit photo. Meter landmarks.
 * This is its own seven-seat shell, glazing, rotor head, stabilizer and glass panel.
 */

import { panelTools } from '../vehicle-interiors.mjs';
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
export const bell407Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 0.75,
  cy: 1.1,
  ry: 0.7,
  cabinZ: 1.16,
  cabinWidth: 1.42,
  eye: [-0.36, 1.68, 1.14],
  panelZ: 1.78,
  floor: 0.48,
  mainRotorPosition: [0, 2.9, 0],
});
export function buildBell407(s) {
  const root = new T.Group();
  root.name = s.slug;
  const red = mat('407-wine-red', '#8b2937', { side: T.DoubleSide }),
    white = mat('407-ivory', '#e6dfcd', { side: T.DoubleSide }),
    trim = mat('407-trim', '#232a2d'),
    metal = mat('407-machined', '#8a9599', { metalness: 0.7 }),
    glass = mat('407-glass', '#a9c2c4', {
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    }),
    gold = mat('407-stripe', '#b5a16b');
  const d = detailKit(root, '407-airframe');
  const measured = [
    [3.28, 0.045, 0.67, 0.84],
    [3.06, 0.36, 0.47, 1.03],
    [2.65, 0.65, 0.43, 1.15],
    [1.65, 0.735, 0.4, 1.76],
    [0.55, 0.75, 0.41, 1.78],
    [-0.7, 0.75, 0.41, 1.73],
    [-1.9, 0.6, 0.58, 1.78],
    [-2.9, 0.22, 1.37, 1.86],
  ];
  const sections = measured.map(([z, w, b, t]) => {
    const upper = t - Math.min(0.14, (t - b) * 0.22),
      lower = b + Math.min(0.16, (t - b) * 0.22);
    return {
      z,
      points: [
        [0, t],
        [w * 0.78, t - 0.015],
        [w, upper],
        [w, lower],
        [w * 0.73, b],
        [-w * 0.73, b],
        [-w, lower],
        [-w, upper],
        [-w * 0.78, t - 0.015],
      ],
    };
  });
  const p = (i, j) => [...sections[i].points[j], sections[i].z];
  loft(d, sections, white, {
    skip: (i, j) =>
      (i === 1 && [2, 3, 5, 6].includes(j)) ||
      (i === 2 && [0, 1, 7, 8].includes(j)) ||
      ([2, 3, 4, 5].includes(i) && [2, 6].includes(j)),
  });
  // Compound windshield curves up to the roof; lower observation panes remain real openings.
  const wind = (j, u) => {
    const a = p(2, j),
      b = p(3, j);
    return [
      a[0] * (1 - u) + b[0] * u,
      a[1] * (1 - u) + b[1] * u + 0.1 * Math.sin(u * Math.PI),
      a[2] * (1 - u) + b[2] * u,
    ];
  };
  for (const j of [0, 1, 7, 8])
    for (let k = 0; k < 4; k++)
      quad(
        d,
        wind(j, k / 4),
        wind(j, (k + 1) / 4),
        wind((j + 1) % 9, (k + 1) / 4),
        wind((j + 1) % 9, k / 4),
        glass,
        [0, 1, 1],
      );
  for (const i of [2, 3])
    outline(d, [p(i, 7), p(i, 8), p(i, 0), p(i, 1), p(i, 2)], 0.017, red, false);
  for (const j of [0, 2, 7])
    outline(
      d,
      [0, 0.25, 0.5, 0.75, 1].map((u) => wind(j, u)),
      0.017,
      red,
      false,
    );
  for (const j of [2, 3, 5, 6]) {
    const pane = [p(1, j), p(2, j), p(2, j + 1), p(1, j + 1)];
    sheet(d, pane, glass, [j < 4 ? 1 : -1, -1, 0]);
    outline(d, pane, 0.013, trim);
  }
  for (const side of [-1, 1]) {
    const sx = (z) => {
      const i = measured.findIndex(
        (q, i) => i < measured.length - 1 && z <= q[0] && z >= measured[i + 1][0],
      );
      if (i < 0) return side * 0.75;
      const a = measured[i],
        b = measured[i + 1],
        u = (a[0] - z) / (a[0] - b[0]);
      return side * (a[1] * (1 - u) + b[1] * u);
    };
    const q = (z, y) => [sx(z), y, z],
      j = side > 0 ? 2 : 7,
      k = side > 0 ? 3 : 6;
    const contours = [
      [
        [1.57, 1.56],
        [1.06, 1.55],
        [1.18, 0.98],
        [2.0, 1.03],
      ],
      [
        [0.91, 1.57],
        [0.43, 1.56],
        [0.53, 1.01],
        [1.04, 1.01],
      ],
      [
        [0.28, 1.54],
        [-0.58, 1.5],
        [-0.46, 0.95],
        [0.43, 1.0],
      ],
    ];
    const holes = contours.map((a) => a.map(([z, y]) => q(z, y)));
    sheet(
      d,
      [p(2, j), p(3, j), p(4, j), p(5, j), p(6, j), p(6, k), p(5, k), p(4, k), p(3, k), p(2, k)],
      red,
      [side, 0, 0],
      holes,
    );
    for (const hole of holes) {
      sheet(d, hole, glass, [side, 0, 0]);
      outline(d, hole, 0.015, trim);
    }
    for (const door of [
      [
        [1.7, 1.65],
        [0.97, 1.65],
        [1.13, 0.64],
        [2.2, 0.67],
      ],
      [
        [0.93, 1.65],
        [0.33, 1.64],
        [0.46, 0.63],
        [1.07, 0.62],
      ],
      [
        [0.3, 1.64],
        [-0.69, 1.6],
        [-0.56, 0.62],
        [0.42, 0.62],
      ],
    ])
      outline(
        d,
        door.map(([z, y]) => q(z, y)),
        0.0045,
        trim,
      );
    for (const z of [1.22, 0.55, -0.4]) {
      d.rod([sx(z) * 1.01, 0.87, z - 0.05], [sx(z) * 1.01, 0.87, z + 0.05], 0.012, metal);
      for (const y of [0.76, 1.4]) d.box([0.026, 0.045, 0.055], [sx(z) * 1.01, y, z + 0.42], metal);
    }
    // The lower cream band and gold beltline follow the side stations.
    for (let i = 2; i < 6; i++) {
      const a = p(i, k),
        b = p(i + 1, k),
        wa = a[0] * 1.004,
        wb = b[0] * 1.004;
      quad(d, [wa, a[1], a[2]], [wb, b[1], b[2]], [wb, 0.82, b[2]], [wa, 0.82, a[2]], white, [
        side,
        0,
        0,
      ]);
      d.rod([wa, 0.827, a[2]], [wb, 0.827, b[2]], 0.006, gold);
    }
    const hatch = [
      [side * 0.72, 0.7, -0.91],
      [side * 0.62, 0.8, -1.74],
      [side * 0.62, 1.3, -1.74],
      [side * 0.72, 1.22, -0.91],
    ];
    outline(d, hatch, 0.005, trim);
    d.rod([side * 0.725, 0.92, -1.0], [side * 0.725, 0.92, -1.1], 0.013, metal);
    d.text('407 GX', [side * 0.756, 0.88, -0.15], 0.065, (side * Math.PI) / 2, gold);
  }
  const engine = (z, w, b, t) => {
    const shoulder = Math.max(b + (t - b) * 0.4, t - 0.12);
    return {
      z,
      points: [
        [0, t],
        [w * 0.7, t - Math.min(0.015, (t - b) * 0.2)],
        [w, shoulder],
        [w, b],
        [-w, b],
        [-w, shoulder],
        [-w * 0.7, t - Math.min(0.015, (t - b) * 0.2)],
      ],
    };
  };
  loft(
    d,
    [
      engine(1.45, 0.18, 1.76, 1.78),
      engine(0.94, 0.33, 1.77, 2.12),
      engine(0.38, 0.37, 1.78, 2.35),
      engine(-1.18, 0.41, 1.73, 2.24),
      engine(-2.65, 0.28, 1.78, 2.01),
      engine(-2.9, 0.22, 1.86, 1.88),
    ],
    red,
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++)
      d.box([0.014, 0.15, 0.08], [side * 0.414, 2.08, -0.55 - i * 0.14], trim);
    d.rod([side * 0.25, 2.19, -0.82], [side * 0.25, 2.4, -0.92], 0.07, metal);
    d.add(new T.CircleGeometry(0.056, 16).rotateX(-Math.PI / 2), trim, [side * 0.25, 2.44, -0.92]);
    for (let i = 0; i < 29; i++)
      d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [side * 0.754, 0.89, 1.6 - i * 0.078]);
  }
  const boom = (z, w, y, h) => ({
    z,
    points: Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      return [Math.sin(a) * w, y + Math.cos(a) * h];
    }),
  });
  loft(
    d,
    [
      boom(-2.9, 0.22, 1.615, 0.245),
      boom(-4.8, 0.14, 1.72, 0.17),
      boom(-6.65, 0.08, 1.87, 0.1),
      boom(-7.11, 0.025, 1.84, 0.025),
    ],
    red,
  );
  for (const z of [-3.1, -4, -5, -6]) {
    const u = (-z - 2.9) / 3.75,
      q = boom(z, 0.22 - u * 0.14, 1.615 + u * 0.255, 0.245 - u * 0.145);
    outline(
      d,
      q.points.map((p) => [...p, z]),
      0.003,
      trim,
    );
  }
  const fin = [
    [-0.038, 1.88, -6.4],
    [-0.038, 3.1, -6.89],
    [-0.038, 3.07, -7.1],
    [-0.038, 1.86, -6.82],
    [-0.038, 1.08, -7.08],
    [-0.038, 1.03, -6.73],
    [-0.038, 1.8, -6.4],
  ];
  sheet(d, fin, red, [-1, 0, 0]);
  sheet(
    d,
    fin.map((p) => [-p[0], p[1], p[2]]),
    red,
    [1, 0, 0],
  );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(d, a, b, [-b[0], b[1], b[2]], [-a[0], a[1], a[2]], red, [0, 1, 0]);
  }
  d.rod([0, 1.04, -7.08], [0, 0.96, -7.29], 0.015, metal);
  d.box([0.045, 0.06, 0.055], [0, 3.13, -6.93], d.red);
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.13, 1.82, -4.49, -5.11],
        [side * 1.11, 1.82, -4.51, -5.13],
      ],
      red,
      0.045,
    );
    const ep = [
      [side * 1.11, 2.21, -4.66],
      [side * 1.11, 2.21, -4.93],
      [side * 1.11, 1.8, -4.77],
      [side * 1.11, 1.37, -5.15],
      [side * 1.11, 1.37, -4.83],
      [side * 1.11, 1.78, -4.44],
    ];
    sheet(d, ep, red, [side, 0, 0]);
    outline(d, ep, 0.012, red);
    d.box([0.026, 0.025, 0.06], [side * 1.12, 1.84, -4.53], side < 0 ? d.green : d.red);
    outline(
      d,
      [
        [side * 1.185, 0.17, 2.03],
        [side * 1.185, 0.055, 1.8],
        [side * 1.185, 0.05, -0.98],
      ],
      0.05,
      metal,
      false,
    );
    for (const z of [1.23, -0.7])
      outline(
        d,
        [
          [0, 0.47, z],
          [side * 0.65, 0.46, z],
          [side * 1.03, 0.26, z],
          [side * 1.185, 0.07, z - 0.06],
        ],
        0.035,
        metal,
        false,
      );
  }
  const mast = group(root, '407-mast', [0, 2.9, 0]);
  mast.rotation.x = (5 * Math.PI) / 180;
  const md = detailKit(mast, '407-mast');
  md.rod([0, -0.7, 0], [0, -0.02, 0], 0.042, metal);
  md.ring(0.19, 0.026, [0, -0.42, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, '407-head');
  rd.add(new T.SphereGeometry(1, 16, 8).scale(0.32, 0.075, 0.32), red, [0, 0.06, 0]);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2,
      c = Math.cos(a),
      sn = Math.sin(a);
    rd.rod([c * 0.12, 0, sn * 0.12], [c * 0.46, 0, sn * 0.46], 0.037, metal);
    rd.rod([c * 0.16, -0.4, sn * 0.16], [c * 0.35, -0.02, sn * 0.35], 0.013, metal);
    const blade = group(rotor, `407-blade-${i}`),
      bd = detailKit(blade, 'blade');
    blade.rotation.y = -a;
    wing(
      bd,
      [
        [0.38, 0, 0.14, -0.16],
        [0.7, 0.015, 0.14, -0.16],
        [5.335, 0.11, 0.12, -0.15],
      ],
      trim,
      0.025,
    );
    bd.box([0.16, 0.009, 0.27], [5.22, 0.116, -0.015], white);
    bd.finish();
  }
  rd.finish();
  const tail = group(root, 'tail-rotor', [0.17, 1.88, -6.65]),
    td = detailKit(tail, '407-tail');
  td.rod([-0.13, 0, 0], [0.1, 0, 0], 0.037, metal);
  for (const side of [-1, 1]) {
    td.box([0.025, 0.76, 0.12], [0.02, side * 0.44, 0], trim);
    td.box([0.028, 0.08, 0.12], [0.02, side * 0.78, 0], white);
  }
  td.finish();
  d.finish();
  const interior = add407Cockpit(root, { red, white, trim, metal });
  cleanGeometry(root);
  return {
    root,
    frame: bell407Frame(),
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

function add407Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    panel = mat('407-panel', '#c0bdb0'),
    seat = mat('407-upholstery', '#b3a58b', { roughness: 0.92 }),
    belt = mat('407-belts', '#5b6263'),
    bindings = [];
  const d = detailKit(cabin, '407-cockpit'),
    tools = panelTools(d),
    z = 1.78;
  d.box([1.3, 0.035, 2.2], [0, 0.48, 0.55], m.trim);
  d.box([1.14, 0.035, 1.02], [0, 0.64, -1.06], m.trim);
  const face = [
    [-0.59, 1.5, z],
    [-0.24, 1.5, z],
    [-0.13, 1.63, z],
    [0.34, 1.63, z],
    [0.54, 1.53, z],
    [0.61, 1.42, z],
    [0.61, 0.9, z],
    [0.18, 0.9, z],
    [-0.18, 0.96, z],
    [-0.31, 1.04, z],
    [-0.59, 1.04, z],
  ];
  sheet(d, face, panel, [0, 0, -1]);
  sheet(
    d,
    face.map(([x, y]) => [x, y, z + 0.16]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < face.length; i++) {
    const a = face[i],
      b = face[(i + 1) % face.length];
    quad(d, a, b, [b[0], b[1], z + 0.16], [a[0], a[1], z + 0.16], m.trim, [0, 1, 0]);
  }
  outline(d, face.slice(0, 6), 0.024, m.trim, false);
  // Two GX displays: navigation on the left, pilot flight display on the right.
  for (const x of [-0.29, 0.29]) {
    glassDisplay(d, x, 1.23, z - 0.012, 0.43, 0.29, x < 0 ? 'attitude' : 'map');
    for (const edge of [-1, 1]) {
      for (let i = 0; i < 5; i++)
        d.box([0.013, 0.012, 0.01], [x + edge * 0.245, 1.31 - i * 0.047, z - 0.025], m.trim);
      for (const y of [1.36, 1.08]) {
        d.add(new T.CylinderGeometry(0.018, 0.018, 0.025, 10).rotateX(Math.PI / 2), m.trim, [
          x + edge * 0.245,
          y,
          z - 0.036,
        ]);
      }
    }
    for (let i = 0; i < 9; i++)
      d.box([0.028, 0.009, 0.012], [x + (i - 4) * 0.045, 1.025, z - 0.028], m.trim);
  }
  const h = group(cabin, '407-flight-horizon', [-0.29, 1.21, z - 0.028]),
    hd = detailKit(h, '407-flight-horizon');
  hd.box([0.19, 0.003, 0.002], [0, 0, 0], hd.amber);
  hd.box([0.003, 0.05, 0.002], [0, -0.015, 0], hd.amber);
  hd.finish();
  bindings.push(
    { node: h.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 },
    {
      node: h.name,
      source: 'pitch',
      property: 'position',
      axis: 'y',
      scale: -0.09,
      min: -0.065,
      max: 0.065,
    },
  );
  for (const [x, source] of [
    [0.13, 'airspeed'],
    [-0.046, 'altitude'],
  ]) {
    tools.gauge(x, 1.52, z - 0.012, 0.066);
    const n = group(cabin, `407-standby-${source}`, [x, 1.52, z - 0.028]),
      nd = detailKit(n, '407-standby');
    nd.rod([0, -0.012, 0], [0, 0.05, 0], 0.002, nd.ivory);
    nd.finish();
    bindings.push({
      node: n.name,
      source,
      property: 'rotation',
      axis: 'z',
      scale: source === 'airspeed' ? 0.045 : 0.0206,
      offset: -1.7,
    });
  }
  d.box([0.47, 0.075, 0.012], [0.04, 0.96, z - 0.014], m.trim);
  for (let i = 0; i < 6; i++)
    d.add(
      new T.CylinderGeometry(0.014, 0.014, 0.016, 10).rotateX(Math.PI / 2),
      i === 5 ? d.red : m.metal,
      [0.22 - i * 0.072, 0.96, z - 0.032],
    );
  d.box([0.035, 0.06, 0.025], [-0.25, 0.98, z - 0.025], d.red);
  d.box([0.045, 0.02, 0.01], [-0.21, 1.415, z - 0.025], d.red);
  const pedestal = group(cabin, '407-pedestal', [0, 0.7, 1.24]);
  pedestal.rotation.x = Math.PI / 2 - 0.18;
  const pd = detailKit(pedestal, '407-pedestal');
  pd.box([0.35, 0.96, 0.12], [0, 0, 0.05], m.trim);
  pd.box([0.28, 0.13, 0.012], [0, 0.33, -0.019], panel);
  for (let i = 0; i < 8; i++)
    pd.box(
      [0.022, 0.017, 0.01],
      [((i % 4) - 1.5) * 0.047, 0.35 - Math.floor(i / 4) * 0.04, -0.035],
      pd.dark,
    );
  for (const x of [-0.13, 0.13])
    pd.add(new T.CylinderGeometry(0.023, 0.023, 0.025, 10).rotateX(Math.PI / 2), pd.dark, [
      x,
      0.32,
      -0.04,
    ]);
  pd.box([0.29, 0.43, 0.015], [0, -0.03, -0.019], panel);
  pd.box([0.24, 0.15, 0.035], [0, -0.35, -0.04], m.trim);
  for (const x of [-0.08, 0, 0.08]) pd.rod([x, -0.35, -0.06], [x, -0.33, -0.095], 0.005, m.metal);
  pd.finish();
  const addSeat = (x, y, z, facing = 1) => {
    const frame = group(cabin, `407-seat-${x}-${z}`, [x, y, z]);
    if (facing < 0) frame.rotation.y = Math.PI;
    const sd = detailKit(frame, '407-seat');
    beveledBox(sd, [0.43, 0.1, 0.47], [0, 0, 0], seat);
    const b = beveledBox(sd, [0.43, 0.59, 0.085], [0, 0.29, -0.23], seat);
    b.rotation.x = -0.12;
    for (const side of [-1, 1]) {
      sd.rod([side * 0.18, -0.23, -0.16], [side * 0.18, -0.045, -0.16], 0.018, m.metal);
      sheet(
        sd,
        [
          [side * 0.14, 0.53, -0.17],
          [side * 0.1, 0.53, -0.17],
          [side * 0.005, 0.07, 0.14],
          [side * 0.045, 0.07, 0.14],
        ],
        belt,
        [0, 0, 1],
      );
      sd.rod([side * 0.12, 0.1, -0.15], [side * 0.12, 0.47, -0.19], 0.0025, belt);
    }
    sd.box([0.06, 0.04, 0.025], [0, 0.08, 0.15], m.metal);
    sd.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * 0.36;
    addSeat(x, 0.77, 1.1);
    addSeat(x, 0.77, 0.0, -1);
    const stick = group(cabin, `407-cyclic-${side}`, [x, 0.49, 1.53]),
      sd = detailKit(stick, 'cyclic');
    outline(
      sd,
      [
        [0, 0, 0],
        [0, 0.23, 0],
        [0, 0.37, -0.15],
        [0, 0.5, -0.18],
      ],
      0.018,
      m.trim,
      false,
    );
    sd.box([0.05, 0.13, 0.05], [0, 0.55, -0.18], m.trim);
    sd.box([0.016, 0.014, 0.016], [0, 0.62, -0.19], sd.red);
    sd.finish();
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lever = group(cabin, `407-collective-${side}`, [x + 0.24, 0.6, 0.96]),
      ld = detailKit(lever, 'collective');
    ld.rod([0, 0, 0], [0, 0.11, 0.38], 0.022, m.trim);
    ld.box([0.06, 0.06, 0.15], [0, 0.11, 0.38], m.trim);
    ld.finish();
    bindings.push({
      node: lever.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: -0.4,
    });
    for (const k of [-1, 1]) {
      const g = group(cabin, `407-pedal-${side}-${k}`, [x + k * 0.11, 0.58, 1.98]),
        gd = detailKit(g, 'pedal');
      gd.rod([-0.07, 0, 0], [0.07, 0, 0], 0.018, m.trim);
      gd.rod([0, -0.09, 0.1], [0, 0, 0], 0.012, m.metal);
      gd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -k * 0.04,
      });
    }
  }
  for (const x of [-0.46, 0, 0.46]) addSeat(x, 0.9, -1.18);
  d.box([0.21, 0.035, 0.55], [0, 1.73, 0.67], m.trim);
  for (let i = 0; i < 8; i++)
    d.rod([0, 1.7, 0.44 + i * 0.055], [0, 1.67, 0.45 + i * 0.055], 0.004, m.metal);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
