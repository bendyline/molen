/** H125: Airbus external dimensions (2020), current TXi cockpit photo and Garmin
 * screen dimensions. Individually authored airframe; no reference-image textures.
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
export const h125Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 0.935,
  cy: 1.4,
  ry: 0.8,
  cabinZ: 1.45,
  cabinWidth: 1.7,
  eye: [-0.42, 2.03, 1.45],
  panelZ: 2.0,
  floor: 0.7,
  mainRotorPosition: [0, 3.16, 0],
});
export function buildH125(s) {
  const root = new T.Group();
  root.name = s.slug;
  const white = mat('H125-white', '#e5e4d9', { side: T.DoubleSide }),
    blue = mat('H125-blue', '#296990', { side: T.DoubleSide }),
    trim = mat('H125-trim', '#252c31'),
    metal = mat('H125-metal', '#969f9f', { metalness: 0.7 }),
    glass = mat('H125-glass', '#a7c9d1', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'H125-airframe');
  const measured = [
    [3.28, 0.035, 1.08, 1.2],
    [3.1, 0.4, 0.84, 1.3],
    [2.65, 0.75, 0.68, 1.47],
    [1.75, 0.9, 0.62, 2.17],
    [0.65, 0.935, 0.59, 2.22],
    [-0.7, 0.9, 0.62, 2.16],
    [-1.65, 0.68, 0.83, 1.89],
    [-2, 0.43, 1.1, 1.9],
  ];
  const sections = measured.map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.76, t - Math.min(0.04, (t - b) * 0.2)],
      [w, t - Math.min(0.15, (t - b) * 0.22)],
      [w, b + Math.min(0.17, (t - b) * 0.22)],
      [w * 0.73, b],
      [-w * 0.73, b],
      [-w, b + Math.min(0.17, (t - b) * 0.22)],
      [-w, t - Math.min(0.15, (t - b) * 0.22)],
      [-w * 0.76, t - Math.min(0.04, (t - b) * 0.2)],
    ],
  }));
  const p = (i, j) => [...sections[i].points[j], sections[i].z];
  loft(d, sections, white, {
    skip: (i, j) =>
      (i === 2 && [0, 1, 7, 8].includes(j)) ||
      (i === 3 && [0, 8].includes(j)) ||
      ([2, 3, 4].includes(i) && [2, 6].includes(j)) ||
      (i === 1 && [2, 3, 5, 6].includes(j)),
  });
  for (const j of [0, 8]) {
    const q = (u, v) => {
      const a = p(3, j),
        b = p(4, j),
        c = p(4, (j + 1) % 9),
        e = p(3, (j + 1) % 9);
      return a.map(
        (_, k) => (a[k] * (1 - u) + b[k] * u) * (1 - v) + (e[k] * (1 - u) + c[k] * u) * v,
      );
    };
    const aperture = [
      [0.15, 0.2],
      [0.75, 0.2],
      [0.75, 0.85],
      [0.15, 0.85],
    ].map(([u, v]) => q(u, v));
    sheet(
      d,
      [p(3, j), p(4, j), p(4, (j + 1) % 9), p(3, (j + 1) % 9)],
      white,
      [0, 1, 0],
      [aperture],
    );
    sheet(d, aperture, glass, [0, 1, 0]);
    outline(d, aperture, 0.012, trim);
  }
  const wind = (j, u) => {
    const a = p(2, j),
      b = p(3, j);
    return [
      a[0] * (1 - u) + b[0] * u,
      a[1] * (1 - u) + b[1] * u + 0.06 * Math.sin(u * Math.PI),
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
    outline(d, [p(i, 7), p(i, 8), p(i, 0), p(i, 1), p(i, 2)], 0.015, trim, false);
  for (const j of [0, 2, 7])
    outline(
      d,
      [0, 0.25, 0.5, 0.75, 1].map((u) => wind(j, u)),
      0.014,
      white,
      false,
    );
  for (const j of [2, 3, 5, 6]) {
    const a = [p(1, j), p(2, j), p(2, j + 1), p(1, j + 1)];
    sheet(d, a, glass, [j < 4 ? 1 : -1, 0, 0]);
    outline(d, a, 0.012, trim);
  }
  const sx = (z, side) => {
    const i = measured.findIndex((a, i) => i < 7 && z <= a[0] && z >= measured[i + 1][0]);
    if (i < 0) return side * 0.935;
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
        [1.68, 1.98],
        [1.12, 2.0],
        [1.26, 1.43],
        [2.0, 1.4],
      ],
      [
        [2.08, 1.29],
        [1.34, 1.3],
        [1.42, 1.04],
        [2.19, 1.03],
      ],
      [
        [0.98, 2.0],
        [0.3, 1.96],
        [0.36, 1.46],
        [1.1, 1.46],
      ],
    ].map((a) => a.map(([z, y]) => q(z, y)));
    sheet(
      d,
      [p(2, j), p(3, j), p(4, j), p(5, j), p(5, k), p(4, k), p(3, k), p(2, k)],
      white,
      [side, 0, 0],
      windows,
    );
    for (const a of windows) {
      sheet(d, a, glass, [side, 0, 0]);
      outline(d, a, 0.016, trim);
    }
    for (const a of [
      [
        [1.76, 2.09],
        [1.05, 2.12],
        [1.18, 0.82],
        [2.38, 0.87],
      ],
      [
        [1.0, 2.12],
        [0.22, 2.08],
        [0.25, 0.82],
        [1.15, 0.82],
      ],
    ])
      outline(
        d,
        a.map(([z, y]) => q(z, y)),
        0.004,
        trim,
      );
    for (const z of [1.26, 0.4]) {
      d.rod([sx(z, side) * 1.008, 1.36, z], [sx(z, side) * 1.008, 1.36, z + 0.1], 0.009, metal);
      for (const y of [1.03, 1.83])
        d.box([0.025, 0.035, 0.06], [sx(z + 0.4, side), y, z + 0.4], metal);
    }
    for (let i = 2; i < 6; i++) {
      const a = measured[i],
        b = measured[i + 1];
      quad(
        d,
        [a[1] * side * 1.005, a[2] + 0.13, a[0]],
        [b[1] * side * 1.005, b[2] + 0.13, b[0]],
        [b[1] * side * 1.005, b[2] + 0.22, b[0]],
        [a[1] * side * 1.005, a[2] + 0.22, a[0]],
        blue,
        [side, 0, 0],
      );
    }
    const hatch = [
      [side * 0.89, 0.89, -0.62],
      [side * 0.72, 0.98, -1.49],
      [side * 0.72, 1.58, -1.49],
      [side * 0.89, 1.65, -0.62],
    ];
    outline(d, hatch, 0.005, trim);
    d.rod([side * 0.81, 1.18, -1.1], [side * 0.81, 1.18, -1.22], 0.01, metal);
    d.rod([side * 0.95, 0.48, 1.9], [side * 0.95, 0.48, -0.83], 0.035, white);
    for (const z of [0.7, -0.69]) {
      d.rod([side * 0.72, 0.69, z], [side * 0.95, 0.48, z], 0.026, metal);
      d.rod([side * 0.63, 0.68, z], [side * 1.09, 0.1, z], 0.04, white);
    }
    outline(
      d,
      [
        [side * 1.09, 0.23, 2.22],
        [side * 1.09, 0.08, 1.89],
        [side * 1.09, 0.05, 1.68],
        [side * 1.09, 0.05, -0.91],
      ],
      0.05,
      white,
      false,
    );
    for (let i = 0; i < 17; i++)
      d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [side * 0.9, 0.94, 1.0 - i * 0.11]);
    d.text('H125', [side * 0.902, 1.82, -0.55], 0.072, (side * Math.PI) / 2, blue);
  }
  // Boxed Arriel cowling, forward intake and rear exhaust distinct from the cabin.
  const cowl = (z, w, b, t) => ({
    z,
    points: [
      [0, t],
      [w * 0.72, t - 0.035],
      [w, t - 0.11],
      [w, b],
      [-w, b],
      [-w, t - 0.11],
      [-w * 0.72, t - 0.035],
    ],
  });
  loft(
    d,
    [
      cowl(0.9, 0.22, 2.18, 2.3),
      cowl(0.45, 0.43, 2.19, 2.69),
      cowl(-1.15, 0.44, 2.07, 2.69),
      cowl(-1.55, 0.34, 1.93, 2.35),
      cowl(-1.85, 0.29, 1.85, 2.17),
    ],
    blue,
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++)
      d.box([0.014, 0.11, 0.06], [side * 0.444, 2.43, -0.2 - i * 0.14], trim);
    d.rod([side * 0.29, 2.68, -0.1], [side * 0.29, 2.68, -1.03], 0.0025, metal);
  }
  d.box([0.28, 0.15, 0.035], [0, 2.54, 0.454], trim);
  d.rod([0, 2.23, -1.49], [0, 2.28, -2.05], 0.14, metal);
  d.add(new T.CircleGeometry(0.115, 16).rotateY(Math.PI), trim, [0, 2.28, -2.06]);
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
      boom(-1.8, 0.43, 1.5, 0.4),
      boom(-3.7, 0.22, 1.57, 0.27),
      boom(-5.3, 0.11, 1.7, 0.14),
      boom(-7.28, 0.035, 1.8, 0.035),
    ],
    blue,
  );
  for (const z of [-2.1, -3.1, -4.1, -5.1, -6.1]) {
    const u = (-z - 1.8) / 5.48;
    outline(
      d,
      boom(z, 0.43 - u * 0.395, 1.5 + u * 0.3, 0.4 - u * 0.365).points.map((p) => [...p, z]),
      0.0025,
      metal,
    );
  }
  const fin = [
    [-0.03, 1.85, -6.3],
    [-0.03, 3.24, -7.32],
    [-0.03, 3.24, -7.6],
    [-0.03, 1.82, -6.99],
    [-0.03, 1.05, -7.12],
    [-0.03, 1.08, -6.75],
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
      [0, 1.11, -6.83],
      [0, 0.8, -7.3],
      [0, 0.75, -7.65],
    ],
    0.015,
    metal,
    false,
  );
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.12, 1.5, -4.73, -5.22],
        [side * 1.265, 1.5, -4.73, -5.22],
      ],
      white,
      0.04,
    );
    d.box([0.03, 0.025, 0.05], [side * 1.265, 1.52, -4.75], side < 0 ? d.green : d.red);
  }
  d.rod([0, 2.24, 1.6], [0, 2.82, 1.2], 0.009, trim);
  d.rod([0, 1.55, -3.2], [0, 1.15, -3.55], 0.007, trim);
  d.box([0.04, 0.05, 0.05], [0, 3.27, -7.33], d.red);
  const mast = group(root, 'H125-mast', [0, 3.16, 0]);
  mast.rotation.x = (2 * Math.PI) / 180;
  const md = detailKit(mast, 'H125-mast');
  md.rod([0, -0.48, 0], [0, 0.02, 0], 0.055, metal);
  md.ring(0.16, 0.025, [0, -0.26, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, 'H125-starflex');
  rd.add(new T.SphereGeometry(1, 18, 8).scale(0.29, 0.1, 0.29), white, [0, 0.07, 0]);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3,
      c = Math.cos(a),
      sn = Math.sin(a);
    rd.rod([c * 0.1, -0.02, sn * 0.1], [c * 0.55, -0.02, sn * 0.55], 0.045, metal);
    rd.rod([c * 0.16, -0.28, sn * 0.16], [c * 0.43, 0, sn * 0.43], 0.015, metal);
    const g = group(rotor, `H125-blade-${i}`),
      dd = detailKit(g, 'blade');
    g.rotation.y = -a;
    wing(
      dd,
      [
        [0.45, 0, 0.15, -0.16],
        [0.8, 0, 0.17, -0.17],
        [5.345, 0.03, 0.17, -0.17],
      ],
      trim,
      0.025,
    );
    dd.box([0.13, 0.008, 0.34], [5.26, 0.04, 0], white);
    dd.finish();
  }
  rd.finish();
  const tr = group(root, 'tail-rotor', [-0.17, 1.85, -6.27]),
    td = detailKit(tr, 'H125-tail');
  td.rod([0.15, 0, 0], [-0.07, 0, 0], 0.034, metal);
  for (const side of [-1, 1]) {
    td.box([0.022, 0.85, 0.16], [-0.03, side * 0.505, 0], trim);
    td.box([0.025, 0.12, 0.16], [-0.03, side * 0.87, 0], white);
  }
  td.finish();
  d.finish();
  const interior = cockpit(root, { white, blue, trim, metal });
  cleanGeometry(root);
  return {
    root,
    frame: h125Frame(),
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
    d = detailKit(cabin, 'H125-cockpit'),
    bindings = [],
    face = mat('H125-panel', '#3b4247'),
    seat = mat('H125-seats', '#3d474d'),
    belt = mat('H125-belts', '#a6abad'),
    z = 2.0,
    k = 0.230378 / 480;
  const px = (u) => (800 - u) * k,
    py = (v) => 1.9 - (v - 200) * k,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz],
    tools = panelTools(d);
  const contour = [
    [0, 345],
    [100, 285],
    [350, 225],
    [650, 192],
    [950, 190],
    [1230, 225],
    [1460, 275],
    [1510, 370],
    [1540, 960],
    [0, 910],
  ].map(([u, v]) => at(u, v));
  sheet(d, contour, face, [0, 0, -1]);
  sheet(
    d,
    contour.map((p) => [p[0], p[1], z + 0.2]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, [b[0], b[1], z + 0.2], [a[0], a[1], z + 0.2], m.trim, [0, 1, 0]);
  }
  outline(d, contour.slice(0, 8), 0.018, m.trim, false);
  // TXi split display, dimensioned from its active screen; geometry-only original graphics.
  const gx = px(1190),
    gy = py(644),
    gw = 0.230378,
    gh = 0.138176;
  d.box([gw + 0.035, gh + 0.03, 0.025], [gx, gy, z - 0.007], m.trim);
  glassDisplay(d, gx + gw * 0.3, gy, z - 0.018, gw * 0.38, gh * 0.93, 'map');
  glassDisplay(d, gx - gw * 0.2, gy, z - 0.019, gw * 0.58, gh * 0.93, 'attitude');
  for (const x of [gx - gw * 0.57, gx + gw * 0.57]) tools.knob(x, gy - gh * 0.51, z - 0.04, 0.012);
  const horizon = group(cabin, 'H125-flight-horizon', [gx - gw * 0.2, gy + 0.025, z - 0.05]),
    hd = detailKit(horizon, 'horizon');
  hd.box([0.047, 0.0015, 0.001], [0, 0, 0], hd.amber);
  hd.finish();
  bindings.push({ node: horizon.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 });
  const engineScreen = (u, v) => {
    const [x, y] = at(u, v);
    d.box([0.112, 0.089, 0.012], [x, y, z - 0.007], m.trim);
    for (let i = 0; i < 3; i++) {
      const cx = x + (i - 1) * 0.029,
        cy = y + (i === 1 ? 0.014 : -0.013);
      for (let j = 0; j < 12; j++) {
        const a = (0.1 + j * 0.08) * Math.PI,
          b = a + 0.05;
        d.rod(
          [cx + Math.cos(a) * 0.018, cy + Math.sin(a) * 0.018, z - 0.018],
          [cx + Math.cos(b) * 0.018, cy + Math.sin(b) * 0.018, z - 0.018],
          0.0009,
          j > 9 ? d.amber : d.green,
        );
      }
      d.rod([cx, cy, z - 0.02], [cx + 0.012, cy + 0.011, z - 0.02], 0.0008, d.ivory);
    }
    d.text('ENGINE', [x, y - 0.03, z - 0.022], 0.006, Math.PI, d.ivory);
  };
  engineScreen(665, 425);
  engineScreen(665, 620);
  d.box([0.16, 0.225, 0.018], [px(690), py(520), z + 0.011], face);
  for (let i = 0; i < 9; i++) d.box([0.014, 0.008, 0.01], at(800, 350 + i * 40, -0.016), m.trim);
  const sg = at(433, 470);
  tools.gauge(sg[0], sg[1], z - 0.008, 0.035, undefined, false);
  d.add(
    new T.CircleGeometry(0.029, 24, 0, Math.PI).rotateY(Math.PI),
    mat('H125-standby-sky', '#3377a0'),
    [sg[0], sg[1], z - 0.025],
  );
  d.add(
    new T.CircleGeometry(0.029, 24, Math.PI, Math.PI).rotateY(Math.PI),
    mat('H125-standby-earth', '#735639'),
    [sg[0], sg[1], z - 0.025],
  );
  for (let i = -2; i <= 2; i++)
    d.box([i === 0 ? 0.042 : 0.018, 0.001, 0.001], [sg[0], sg[1] + i * 0.007, z - 0.029], d.ivory);
  tools.gauge(px(1060), py(355), z - 0.009, 0.032, undefined, false);
  const ng = group(cabin, 'H125-rpm-needle', at(1060, 355, -0.025)),
    nd = detailKit(ng, 'needle');
  nd.rod([0, 0, 0], [0.021, 0.009, 0], 0.0012, nd.ivory);
  nd.finish();
  bindings.push({
    node: ng.name,
    source: 'rpm',
    property: 'rotation',
    axis: 'z',
    scale: 3.5,
    offset: -1.7,
  });
  d.box([0.155, 0.071, 0.012], at(1300, 382, -0.008), m.trim);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 8; c++) {
      const x = px(1180 + c * 32),
        y = py(335 + r * 31);
      d.box([0.012, 0.008, 0.002], [x, y, z - 0.017], r === 0 && c < 3 ? d.amber : d.dark);
    }
  glassDisplay(d, px(690), py(822), z - 0.013, 0.11, 0.045, 'map');
  for (const u of [620, 710]) tools.knob(px(u), py(255), z - 0.025, 0.009);
  for (const v of [292, 412]) d.box([0.016, 0.025, 0.015], at(920, v, -0.018), d.red);
  for (const [u, v] of [
    [30, 883],
    [247, 895],
    [471, 905],
    [705, 919],
    [1505, 930],
    [1485, 292],
    [866, 210],
  ])
    d.add(new T.CircleGeometry(0.003, 8).rotateY(Math.PI), m.metal, at(u, v, -0.004));
  const pg = group(cabin, 'H125-console', [0.02, 1.26, 1.75]);
  pg.rotation.x = 0.62;
  const pd = detailKit(pg, 'H125-console'),
    pt = panelTools(pd);
  pd.box([0.3, 0.75, 0.17], [0, 0, 0.06], face);
  d.box([0.28, 0.35, 0.45], [0.02, 0.9, 1.63], face);
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.044;
    pd.rod([x, 0.31, -0.033], [x, 0.33, -0.06], 0.004, i === 0 ? pd.red : m.metal);
    pd.text(
      ['BAT', 'GEN', 'BCN', 'HORN', 'AV', 'LT'][i],
      [x, 0.345, -0.061],
      0.007,
      Math.PI,
      pd.ivory,
    );
  }
  pt.buttons(0, 0.23, -0.04, 6, 0.044);
  pd.box([0.25, 0.1, 0.01], [0, 0.12, -0.034], m.trim);
  pd.box([0.15, 0.04, 0.004], [0, 0.13, -0.043], pd.dark);
  pd.text('RADIO', [0, 0.13, -0.048], 0.012, Math.PI, pd.green);
  for (const x of [-0.105, 0.105]) pt.knob(x, 0.1, -0.05, 0.013);
  for (let i = 0; i < 9; i++)
    pd.box([0.025, 0.024, 0.01], [-0.128, -0.01 - i * 0.035, -0.04], i === 6 ? pd.red : m.trim);
  pd.finish();
  d.box([1.62, 0.035, 2.72], [0, 0.7, 0.63], m.trim);
  d.box([1.55, 0.04, 0.84], [0, 0.9, -0.7], m.trim);
  const addSeat = (x, y, z) => {
    beveledBox(d, [0.42, 0.1, 0.48], [x, y, z], seat);
    const b = beveledBox(d, [0.43, 0.64, 0.1], [x, y + 0.32, z - 0.23], seat);
    b.rotation.x = -0.1;
    beveledBox(d, [0.24, 0.17, 0.11], [x, y + 0.69, z - 0.27], seat);
    for (const s of [-1, 1]) {
      sheet(
        d,
        [
          [x + s * 0.14, y + 0.59, z - 0.22],
          [x + s * 0.1, y + 0.59, z - 0.22],
          [x - s * 0.02, y + 0.06, z + 0.16],
          [x + s * 0.02, y + 0.06, z + 0.16],
        ],
        belt,
        [0, 0, 1],
      );
      d.rod([x + s * 0.16, y - 0.25, z - 0.16], [x + s * 0.16, y - 0.04, z - 0.16], 0.017, m.metal);
    }
    d.box([0.06, 0.035, 0.02], [x, y + 0.08, z + 0.17], m.metal);
  };
  for (const side of [-1, 1]) {
    const x = side * 0.42;
    addSeat(x, 1.02, 1.25);
    const cg = group(cabin, `H125-cyclic-${side}`, [x, 0.72, 1.63]),
      cd = detailKit(cg, 'cyclic');
    outline(
      cd,
      [
        [0, 0, 0],
        [0, 0.25, 0],
        [0, 0.38, -0.18],
        [0, 0.55, -0.2],
      ],
      0.017,
      m.trim,
      false,
    );
    beveledBox(cd, [0.06, 0.15, 0.06], [0, 0.57, -0.2], m.trim, 0.01);
    cd.box([0.018, 0.015, 0.015], [0, 0.64, -0.235], cd.red);
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `H125-collective-${side}`, [x + 0.24, 0.83, 1.05]),
      ld = detailKit(lg, 'collective');
    ld.rod([0, 0, 0], [0, 0.14, 0.42], 0.021, m.trim);
    ld.box([0.05, 0.055, 0.13], [0, 0.14, 0.42], m.trim);
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const k of [-1, 1]) {
      const g = group(cabin, `H125-pedal-${side}-${k}`, [x + k * 0.13, 0.8, 2.1]),
        dd = detailKit(g, 'pedal');
      dd.rod([-0.08, 0, 0], [0.08, 0, 0], 0.017, m.trim);
      dd.rod([0, 0, 0], [0, -0.08, 0.1], 0.012, m.metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -k * 0.04,
      });
    }
  }
  for (const x of [-0.63, -0.21, 0.21, 0.63]) addSeat(x, 1.06, -0.65);
  d.box([0.23, 0.045, 0.58], [0, 2.12, 1.1], m.trim);
  for (let i = 0; i < 6; i++)
    d.rod([0.06, 2.08, 0.9 + i * 0.06], [0.06, 2.04, 0.91 + i * 0.06], 0.005, m.metal);
  d.rod([-0.06, 2.08, 1.08], [-0.06, 1.96, 1.22], 0.012, d.red);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
