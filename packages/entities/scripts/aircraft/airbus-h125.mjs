/** H125: Airbus external dimensions (2020), current TXi cockpit photo and Garmin
 * screen dimensions. Individually authored airframe; no reference-image textures.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { glassDisplay } from './glass-display.mjs';
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
import { cabinShell } from './robinson-r44.mjs';
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
  // Side stations follow the CC0 AS355 profile silhouette (same cabin/boom as the AS350/H125):
  // a full, high glazed nose (1.69 m at 0.5 m behind the tip), a belly that rises from the
  // rear doors, and a thick boom whose top stays level at about 2.04 m. Head-on (H125 front
  // photo) the cabin is a rounded box: roof shoulders about 0.35 m across and 0.45 m tall, sides
  // widest at the door sills, so the windscreen and door glazing curve with the skin.
  const shell = cabinShell(
    [
      // z, half width, keel, crown, widest at, superellipse exponent above / below it
      [3.16, 0.55, 0.92, 1.38, 1.22, 2.6, 2.2],
      [3.0, 0.77, 0.84, 1.52, 1.3, 3, 2.3],
      [2.78, 0.87, 0.77, 1.7, 1.33, 3.4, 2.8],
      [1.75, 0.92, 0.635, 2.3, 1.35, 4, 4.2],
      [0.65, 0.935, 0.63, 2.32, 1.35, 4.2, 4.5],
      [-0.7, 0.9, 0.7, 2.26, 1.4, 4, 4],
      [-1.65, 0.62, 1.08, 2.06, 1.55, 3, 3],
      [-2, 0.44, 1.15, 1.99, 1.57, 2.6, 2.6],
    ],
    [3.285, 1.14],
  );
  const zs = shell.samples(0.25);
  // Window and door corners from the AS355 profile (checked on the AS350 B3 left-side photo).
  const screenSide = (side) =>
    [
      [3.02, 1.47, side],
      [2.7, 1.42, side],
      [2.28, 1.37, side],
      [2.0, 2.11, side],
    ].map(([z, y]) => [z, shell.vAt(z, y, side)]);
  const screen = [...screenSide(-1), ...screenSide(1).reverse()];
  const panes = [
    // Front door upper and lower windows, rear door window, chin window. The door windows run
    // up to 2.09 m, above the pilot eye (2.03 m), so the side view at eye level is glass.
    [
      [1.86, 2.09],
      [1.57, 2.09],
      [1.63, 1.39],
      [2.18, 1.39],
    ],
    [
      [2.24, 1.31],
      [1.7, 1.31],
      [1.69, 1.0],
      [2.35, 0.99],
    ],
    [
      [1.32, 2.09],
      [0.635, 2.09],
      [0.67, 1.45],
      [1.45, 1.43],
    ],
    [
      [2.41, 1.235],
      [2.95, 1.22],
      [3.04, 1.0],
      [2.85, 0.8],
      [2.59, 0.8],
    ],
  ];
  const doors = [
    [
      [2.0, 2.13],
      [1.5, 2.14],
      [1.5, 0.82],
      [2.62, 0.84],
    ],
    [
      [1.47, 2.14],
      [0.52, 2.12],
      [0.52, 0.8],
      [1.47, 0.8],
    ],
  ];
  const windows = [-1, 1].flatMap((side) => [
    ...panes.map((a) => shell.region(a.map(([z, y]) => [z, y, side]))),
    // Roof eyebrow window over each front seat.
    shell.region(
      [
        [1.6, 0.15],
        [1.95, 0.15],
        [1.95, 0.6],
        [1.6, 0.62],
      ].map(([z, x]) => [z, side * shell.vAtX(z, x)]),
    ),
  ]);
  // Blue band along the lower side, one strip per skin bay so each piece stays convex.
  const bandZ = zs.filter((z) => z >= -1.65 && z <= 2.78),
    band = (z, side) => {
      const [, b] = shell.size(z);
      return [
        [z, b + 0.13, side],
        [z, b + 0.22, side],
      ];
    };
  const bands = [-1, 1].flatMap((side) =>
    bandZ.slice(1).map((z, i) => shell.region([...band(bandZ[i], side), ...band(z, side)])),
  );
  shell.build(
    d,
    white,
    [
      { poly: shell.region(screen), material: glass },
      ...windows.map((poly) => ({ poly, material: glass })),
      ...bands.map((poly) => ({ poly, material: blue })),
    ],
    zs,
    24,
  );
  sheet(
    d,
    Array.from({ length: 32 }, (_, j) => shell.at(-2, -0.5 + j / 32)),
    white,
    [0, 0, -1],
  );
  shell.strip(d, screen, 0.03, trim, false);
  outline(
    d,
    shell.trace(
      [
        [2.0, 0],
        [3.02, 0],
      ],
      false,
      0.014,
    ),
    0.022,
    white,
    false,
  );
  for (const poly of windows) shell.strip(d, poly, 0.03, trim, false);
  for (const side of [-1, 1]) {
    const q = (z, y, lift = 0) => shell.point(z, y, side, lift);
    for (const door of doors)
      shell.strip(d, shell.region(door.map(([z, y]) => [z, y, side])), 0.008, trim, false);
    // Handles at the doors' rear edges, hinges along their front edges.
    for (const z of [1.56, 0.58]) d.rod(q(z, 1.36, 0.008), q(z + 0.1, 1.36, 0.008), 0.009, metal);
    for (const y of [1.03, 1.83]) {
      d.box([0.025, 0.035, 0.06], q(2.0 + ((2.13 - y) / 1.29) * 0.62 - 0.06, y), metal);
      d.box([0.025, 0.035, 0.06], q(1.42, y), metal);
    }
    shell.strip(
      d,
      shell.region(
        [
          [-0.62, 0.89],
          [-1.49, 0.98],
          [-1.49, 1.58],
          [-0.62, 1.65],
        ].map(([z, y]) => [z, y, side]),
      ),
      0.008,
      trim,
      false,
    );
    d.rod(q(-1.1, 1.18, 0.008), q(-1.22, 1.18, 0.008), 0.01, metal);
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
      d.add(new T.SphereGeometry(0.0035, 5, 3), metal, q(1.0 - i * 0.11, 0.94, 0.002));
    d.text('H125', q(-0.55, 1.82, 0.003), 0.072, (side * Math.PI) / 2, blue);
  }
  // Rounded Arriel cowling (superelliptic crown over upright sides), forward intake and rear
  // exhaust distinct from the cabin.
  const cowl = (z, w, b, t) => {
    const y = t - (t - b) * 0.6;
    return {
      z,
      points: [
        [-w, b],
        ...Array.from({ length: 11 }, (_, k) => {
          const a = ((k - 5) * Math.PI) / 10,
            s = Math.sin(a);
          return [
            w * Math.sign(s) * Math.pow(Math.abs(s), 2 / 3),
            y + (t - y) * Math.pow(Math.cos(a), 2 / 3),
          ];
        }),
        [w, b],
      ],
    };
  };
  // The fairing rises smoothly from the cabin roof (2.5 m at z 1.2) to a 2.77 m crest.
  loft(
    d,
    [
      cowl(1.55, 0.26, 2.24, 2.36),
      cowl(1.15, 0.41, 2.24, 2.54),
      cowl(0.6, 0.45, 2.2, 2.74),
      cowl(-0.6, 0.45, 2.1, 2.775),
      cowl(-1.15, 0.42, 2.0, 2.66),
      cowl(-1.55, 0.34, 1.93, 2.5),
      cowl(-1.95, 0.28, 1.85, 2.3),
    ],
    blue,
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++)
      d.box([0.014, 0.11, 0.06], [side * 0.455, 2.5, -0.2 - i * 0.14], trim);
    d.rod([side * 0.29, 2.745, -0.1], [side * 0.29, 2.715, -0.9], 0.0025, metal);
  }
  d.box([0.28, 0.035, 0.2], [0, 2.655, 0.88], trim).rotation.x = 0.33;
  d.rod([0, 2.23, -1.49], [0, 2.28, -2.05], 0.14, metal);
  d.add(new T.CircleGeometry(0.115, 16).rotateY(Math.PI), trim, [0, 2.28, -2.06]);
  const boom = (z, w, y, h) => ({
    z,
    points: Array.from({ length: 12 }, (_, i) => [
      Math.sin((i * Math.PI) / 6) * w,
      y + Math.cos((i * Math.PI) / 6) * h,
    ]),
  });
  // Boom stations: level top near 2.04 m, keel rising from 1.13 m to 1.56 m at z -5.3.
  const boomStations = [
    [-1.8, 0.42, 1.58, 0.45],
    [-3.7, 0.31, 1.7, 0.34],
    [-5.3, 0.21, 1.79, 0.23],
    [-7.28, 0.05, 1.86, 0.06],
  ];
  loft(
    d,
    boomStations.map((q) => boom(...q)),
    blue,
  );
  for (const z of [-2.1, -3.1, -4.1, -5.1, -6.1]) {
    const k = boomStations.findIndex((q, i) => z <= q[0] && z >= boomStations[i + 1][0]),
      a = boomStations[k],
      b = boomStations[k + 1],
      u = (a[0] - z) / (a[0] - b[0]);
    outline(
      d,
      boom(z, ...[1, 2, 3].map((n) => a[n] * (1 - u) + b[n] * u)).points.map((p) => [...p, z]),
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
        [side * 0.12, 1.74, -4.73, -5.22],
        [side * 1.265, 1.74, -4.73, -5.22],
      ],
      white,
      0.04,
    );
    d.box([0.03, 0.025, 0.05], [side * 1.265, 1.76, -4.75], side < 0 ? d.green : d.red);
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
  const tr = group(root, 'tail-rotor', [-0.17, 1.93, -6.27]),
    td = detailKit(tr, 'H125-tail');
  td.rod([0.15, 0, 0], [-0.07, 0, 0], 0.034, metal);
  for (const side of [-1, 1]) {
    td.box([0.022, 0.85, 0.16], [-0.03, side * 0.505, 0], trim);
    td.box([0.025, 0.12, 0.16], [-0.03, side * 0.87, 0], white);
  }
  td.finish();
  d.finish();
  const interior = cockpit(root, { white, blue, trim, metal }, shell, [
    shell.region(screen),
    ...windows,
  ]);
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
function cockpit(root, m, shell, apertures) {
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
  // Dark cabin trim 3 cm inside the skin, open at every window, so the glazing reads dark.
  shell.build(
    d,
    face,
    apertures.map((poly) => ({ poly, material: null })),
    shell.samples(0.35).filter((z) => z > -1),
    16,
    0.03,
  );
  // Cabin deck trimmed to the rounded lower corners of the shell.
  fittedFloor(
    d,
    [-0.5, 0, 0.5, 1, 1.5, 2].map((z) => ({
      z,
      points: Array.from({ length: 32 }, (_, j) => shell.at(z, -0.5 + j / 32).slice(0, 2)),
    })),
    m.trim,
    { y: 0.7175, front: 1.99, back: -0.45, width: 1.62, thickness: 0.035 },
  );
  fittedFloor(
    d,
    [-1.3, -1.1, -0.9, -0.7, -0.5, -0.3, -0.1].map((z) => ({
      z,
      points: Array.from({ length: 32 }, (_, j) => shell.at(z, -0.5 + j / 32).slice(0, 2)),
    })),
    m.trim,
    { y: 0.92, front: -0.28, back: -1.12, width: 1.55, thickness: 0.04 },
  );
  // Seat legs stand on their deck (`floor`) rather than through the rounded belly.
  const addSeat = (x, y, z, floor) => {
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
      d.rod([x + s * 0.16, floor, z - 0.16], [x + s * 0.16, y - 0.04, z - 0.16], 0.017, m.metal);
    }
    d.box([0.06, 0.035, 0.02], [x, y + 0.08, z + 0.17], m.metal);
  };
  for (const side of [-1, 1]) {
    const x = side * 0.42;
    addSeat(x, 1.02, 1.25, 0.7175);
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
  for (const x of [-0.6, -0.2, 0.2, 0.6]) addSeat(x, 1.06, -0.65, 0.92);
  d.box([0.23, 0.045, 0.58], [0, 2.12, 1.1], m.trim);
  for (let i = 0; i < 6; i++)
    d.rod([0.06, 2.08, 0.9 + i * 0.06], [0.06, 2.04, 0.91 + i * 0.06], 0.005, m.metal);
  d.rod([-0.06, 2.08, 1.08], [-0.06, 1.96, 1.22], 0.012, d.red);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
