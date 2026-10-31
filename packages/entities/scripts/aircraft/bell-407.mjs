/** Bell 407GX, standard low gear: Bell 2013 specifications pp8/10 and EASA OEB
 * 2012 pp10–12, with Waerfelu's CC BY 3.0 GX cockpit photo. Meter landmarks.
 * This is its own seven-seat shell, glazing, rotor head, stabilizer and glass panel.
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
export const bell407Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 0.75,
  cy: 1.1,
  ry: 0.7,
  cabinZ: 1.16,
  cabinWidth: 1.42,
  // Seated eye about 0.73 m above the cushion and 0.22 m under the roof, inside the door glass.
  eye: [-0.36, 1.55, 1.14],
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
  // Side profile keeps the fitted stations. In plan the Commons 407 orthographic nose is a half
  // ellipse about 1 m long (0.59 of the cabin width 0.18 m behind the tip, 0.79 at 0.36 m,
  // read from the outline's pixel rows). Head-on (407GX front 3/4 photos) the
  // cabin is a rounded box whose door glazing leans in to roof shoulders about 0.3 m round, and
  // the bullet nose blends into a deep compound windscreen, so all glazing and paint are
  // regions of that curved skin rather than holes in flat side sheets.
  const shell = cabinShell(
    [
      // z, half width, keel, crown, widest at, superellipse exponent above / below it
      [3.1, 0.44, 0.615, 0.985, 0.76, 2.4, 2.5],
      [2.92, 0.59, 0.5, 1.07, 0.76, 2.7, 2.9],
      [2.65, 0.695, 0.43, 1.15, 0.78, 3.1, 3.6],
      [2.15, 0.73, 0.41, 1.5, 0.8, 3.8, 4.2],
      [1.65, 0.735, 0.4, 1.76, 0.82, 4, 4.5],
      [0.55, 0.75, 0.41, 1.78, 0.84, 4, 4.5],
      [-0.7, 0.75, 0.41, 1.73, 0.86, 4, 4.2],
      [-1.9, 0.6, 0.58, 1.78, 1.02, 3.4, 3.2],
      [-2.9, 0.22, 1.37, 1.86, 1.615, 2.6, 2.6],
    ],
    [3.285, 0.755, 0.55],
  );
  const zs = shell.samples(0.25);
  // Deep compound windscreen from the nose cap up to the roof, wrapping back to the door posts.
  const screenSide = (side) =>
    [
      [2.72, 1.1],
      [2.32, 1.0],
      [2.09, 0.99],
      [1.68, 1.64],
    ].map(([z, y]) => [z, shell.vAt(z, y, side)]);
  const screen = [...screenSide(-1), ...screenSide(1).reverse()];
  // Lower observation windows wrap under the nose either side of an opaque keel.
  const chin = [-1, 1].map((side) =>
    shell.region([
      [2.45, 0.8, side],
      [2.92, 0.75, side],
      [3.16, 0.69, side],
      [3.14, side * 0.486],
      [2.45, side * 0.486],
    ]),
  );
  const doors = [
    [
      [1.7, 1.65],
      [0.97, 1.65],
      [1.13, 0.64],
      [2.2, 0.67],
      [2.04, 1.0],
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
  ];
  const windows = [-1, 1].flatMap((side) =>
    [
      // Window tops run up close to the door tops (407 orthographic).
      [
        [1.57, 1.61],
        [1.06, 1.6],
        [1.18, 0.98],
        [1.96, 1.03],
      ],
      [
        [0.91, 1.61],
        [0.43, 1.6],
        [0.53, 1.01],
        [1.04, 1.01],
      ],
      [
        [0.28, 1.58],
        [-0.58, 1.54],
        [-0.46, 0.95],
        [0.43, 1.0],
      ],
    ].map((a) => shell.region(a.map(([z, y]) => [z, y, side]))),
  );
  // Wine-red flanks from the gold beltline up to the roof shoulders, cream roof and belly; one
  // strip per skin bay so each piece stays convex.
  const flankZ = zs.filter((z) => z >= -1.9 && z <= 2.65),
    flank = (z, side) => [
      [z, 0.835, side],
      [z, shell.size(z)[2] - 0.14, side],
    ];
  const flanks = [-1, 1].flatMap((side) =>
    flankZ.slice(1).map((z, i) => shell.region([...flank(flankZ[i], side), ...flank(z, side)])),
  );
  shell.build(
    d,
    white,
    [
      { poly: shell.region(screen), material: glass },
      ...[...chin, ...windows].map((poly) => ({ poly, material: glass })),
      ...flanks.map((poly) => ({ poly, material: red })),
    ],
    zs,
    28,
  );
  shell.strip(d, screen, 0.03, red, false);
  for (const poly of chin) shell.strip(d, poly, 0.024, trim, false);
  for (const poly of windows) shell.strip(d, poly, 0.028, trim);
  outline(
    d,
    shell.trace(
      [
        [1.68, 0],
        [2.72, 0],
      ],
      false,
      0.012,
    ),
    0.017,
    red,
    false,
  );
  for (const side of [-1, 1]) {
    const q = (z, y, lift = 0) => shell.point(z, y, side, lift);
    for (const door of doors)
      shell.strip(d, shell.region(door.map(([z, y]) => [z, y, side])), 0.009, trim, false);
    for (const z of [1.22, 0.55, -0.4]) {
      d.rod(q(z - 0.05, 0.87, 0.008), q(z + 0.05, 0.87, 0.008), 0.012, metal);
      for (const y of [0.76, 1.4]) d.box([0.026, 0.045, 0.055], q(z + 0.42, y, 0.008), metal);
    }
    // Gold beltline along the top of the cream lower band.
    shell.strip(
      d,
      flankZ.map((z) => [z, shell.vAt(z, 0.83, side)]),
      0.012,
      gold,
      false,
      false,
    );
    shell.strip(
      d,
      shell.region(
        [
          [-0.91, 0.7],
          [-1.74, 0.8],
          [-1.74, 1.3],
          [-0.91, 1.22],
        ].map(([z, y]) => [z, y, side]),
      ),
      0.009,
      trim,
      false,
    );
    d.rod(q(-1.0, 0.92, 0.008), q(-1.1, 0.92, 0.008), 0.013, metal);
    d.text('407 GX', q(-0.15, 0.88, 0.004), 0.065, (side * Math.PI) / 2, gold);
  }
  // Doghouse feet sink into the rounded roof so the fairing never floats above the skin.
  // Its crown is a rounded hump (407GX front photos), not a chamfered box.
  const engine = (z, w, b, t) => {
    const shoulder = Math.max(b + (t - b) * 0.3, t - 0.2),
      foot = Math.min(b, shell.at(z, shell.vAtX(z, w))[1] - 0.02),
      crown = Array.from({ length: 5 }, (_, k) => {
        const a = (k * Math.PI) / 8;
        return [
          w * Math.pow(Math.sin(a), 2 / 2.6),
          shoulder + (t - shoulder) * Math.pow(Math.cos(a), 2 / 2.6),
        ];
      });
    return {
      z,
      points: [
        ...crown,
        [w, foot],
        [-w, foot],
        ...crown
          .slice(1)
          .reverse()
          .map(([x, y]) => [-x, y]),
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
      d.add(new T.SphereGeometry(0.0035, 5, 3), metal, shell.point(1.6 - i * 0.078, 0.89, side));
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
  const interior = add407Cockpit(root, { red, white, trim, metal }, shell, [
    shell.region(screen),
    ...chin,
    ...windows,
  ]);
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

function add407Cockpit(root, m, shell, apertures) {
  const cabin = group(root, 'cockpit'),
    panel = mat('407-panel', '#c0bdb0'),
    seat = mat('407-upholstery', '#b3a58b', { roughness: 0.92 }),
    belt = mat('407-belts', '#5b6263'),
    bindings = [];
  const d = detailKit(cabin, '407-cockpit'),
    tools = panelTools(d),
    z = 1.78;
  // Dark cabin trim 3 cm inside the skin, open at every window, so the glazing reads dark.
  shell.build(
    d,
    m.trim,
    apertures.map((poly) => ({ poly, material: null })),
    shell.samples(0.45).filter((z) => z > -1.8),
    12,
    0.03,
  );
  // Cabin deck and raised aft passenger deck trimmed to the rounded lower corners of the shell.
  const rings = [-1.7, -1.3, -0.9, -0.5, -0.1, 0.3, 0.7, 1.1, 1.5, 1.9].map((z) => ({
    z,
    points: Array.from({ length: 32 }, (_, j) => shell.at(z, -0.5 + j / 32).slice(0, 2)),
  }));
  fittedFloor(d, rings, m.trim, { y: 0.4975, front: 1.65, back: -0.55, width: 1.3 });
  fittedFloor(d, rings, m.trim, { y: 0.6575, front: -0.55, back: -1.57, width: 1.14 });
  const face = [
    [-0.59, 1.5, z],
    [-0.24, 1.5, z],
    // The standby hood rises about 0.13 m above the displays (GX cockpit photo), under the
    // pilot's level sightline.
    [-0.13, 1.51, z],
    [0.34, 1.51, z],
    [0.54, 1.48, z],
    [0.61, 1.42, z],
    [0.61, 0.9, z],
    [0.18, 0.9, z],
    [-0.18, 0.96, z],
    [-0.31, 1.04, z],
    [-0.59, 1.04, z],
  ];
  sheet(d, face, panel, [0, 0, -1]);
  // The housing narrows and drops toward the nose so its shoulders stay under the windscreen,
  // which curves in toward the roof.
  const ahead = face.map(([x, y]) => [x * 0.88, 0.9 + (y - 0.9) * 0.88, z + 0.16]);
  sheet(d, ahead, m.trim, [0, 0, 1]);
  for (let i = 0; i < face.length; i++) {
    const j = (i + 1) % face.length;
    quad(d, face[i], face[j], ahead[j], ahead[i], m.trim, [0, 1, 0]);
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
    tools.gauge(x, 1.435, z - 0.012, 0.05);
    const n = group(cabin, `407-standby-${source}`, [x, 1.435, z - 0.028]),
      nd = detailKit(n, '407-standby');
    nd.rod([0, -0.01, 0], [0, 0.038, 0], 0.002, nd.ivory);
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
  // Rear bench seats close up so their backs clear the rounded aft roof shoulders.
  for (const x of [-0.41, 0, 0.41]) addSeat(x, 0.9, -1.18);
  d.box([0.21, 0.035, 0.55], [0, 1.73, 0.67], m.trim);
  for (let i = 0; i < 8; i++)
    d.rod([0, 1.7, 0.44 + i * 0.055], [0, 1.67, 0.45 + i * 0.055], 0.004, m.metal);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
