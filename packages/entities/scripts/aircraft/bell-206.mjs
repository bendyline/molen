/** Bell 206B-3, standard low skids. Bell 2005 dimension sheet, p2, and
 * Gabriel Resende Veiga's CC BY-SA 4.0 Bell 206B panel photograph.
 * Mast z=0. Geometry follows the B-3 sheet; the Commons 206A drawing is secondary.
 */
import {
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

export const bell206Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 0.725,
  cy: 1.05,
  ry: 0.74,
  cabinZ: 1.06,
  cabinWidth: 1.4,
  // Seated eye about 0.77 m above the cushion and 0.26 m under the roof, inside the door glass.
  eye: [-0.34, 1.49, 1.04],
  panelZ: 1.98,
  floor: 0.39,
  mainRotorPosition: [0, 2.83, 0],
});
export function buildBell206(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('206-ivory', '#dddeda', { side: T.DoubleSide }),
    blue = mat('206-blue', '#315878', { side: T.DoubleSide }),
    trim = mat('206-gaskets', '#252b2e'),
    glass = mat('206-glass', '#a5bdc2', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    }),
    metal = mat('206-alloy', '#8b979b', { metalness: 0.65 }),
    seat = mat('206-seat', '#697c83', { roughness: 0.92 });
  const d = detailKit(root, '206-shell');
  // Side profile and plan keep the fitted stations (206A plan view: 0.36 m half-width 0.1 m
  // behind the tip, 0.53 m at 0.3 m). Head-on (OH-58A front view, JetRanger front photos) the
  // cabin is a rounded trapezoid: widest just above the floor, the door glazing leaning in to
  // roof shoulders about 0.3 m round, so windscreen, door and chin windows are cut from that
  // curved skin instead of holes in flat side sheets.
  const shell = cabinShell(
    [
      // z, half width, keel, crown, widest at, superellipse exponent above / below it
      [2.8, 0.36, 0.62, 0.875, 0.74, 3, 3],
      [2.62, 0.53, 0.475, 1.015, 0.74, 3.2, 3.4],
      [2.3, 0.66, 0.39, 1.16, 0.76, 3.4, 4],
      [1.5, 0.7, 0.35, 1.77, 0.8, 4, 4.5],
      [0.35, 0.7, 0.3, 1.71, 0.8, 4, 4.5],
      [-0.85, 0.68, 0.36, 1.65, 0.85, 3.8, 4],
      [-1.65, 0.45, 0.62, 1.59, 1, 3, 3],
      [-2.35, 0.22, 1.05, 1.58, 1.3, 2.6, 2.6],
    ],
    [2.915, 0.745],
  );
  const zs = shell.samples(0.2);
  // Broad two-pane windscreen over the nose, wrapping down the sides to the front door posts.
  const screenSide = (side) =>
    [
      [2.33, 1.07],
      [2.02, 1.04],
      [1.5, 1.6],
    ].map(([z, y]) => [z, shell.vAt(z, y, side)]);
  const screen = [...screenSide(-1), ...screenSide(1).reverse()];
  // Paired lower observation windows wrap under the nose, with an opaque center keel.
  const chin = [-1, 1].map((side) =>
    shell.region([
      [2.2, 0.78, side],
      [2.62, 0.76, side],
      [2.87, 0.71, side],
      [2.86, side * 0.487],
      [2.2, side * 0.487],
    ]),
  );
  const doors = [
    [
      [1.46, 1.63],
      [0.72, 1.57],
      [0.92, 0.55],
      [2.0, 0.59],
      [1.98, 1.02],
    ],
    [
      [0.68, 1.56],
      [-0.25, 1.5],
      [-0.13, 0.56],
      [0.88, 0.51],
    ],
  ];
  const windows = [-1, 1].flatMap((side) =>
    [
      // Door glass runs up close to the door tops (206A drawing: about 1.57 m).
      [
        [1.37, 1.57],
        [0.8, 1.54],
        [0.95, 0.96],
        [1.77, 1.01],
      ],
      [
        [0.64, 1.52],
        [-0.15, 1.47],
        [-0.02, 0.92],
        [0.8, 0.97],
      ],
    ].map((a) => shell.region(a.map(([z, y]) => [z, y, side]))),
  );
  // Blue cheat line just under the glazing, one strip per skin bay so each piece stays convex.
  const stripeZ = zs.filter((z) => z >= -1.65 && z <= 2.62),
    band = (z, side) => [
      [z, 0.84, side],
      [z, 0.93, side],
    ];
  const stripe = [-1, 1].flatMap((side) =>
    stripeZ.slice(1).map((z, i) => shell.region([...band(stripeZ[i], side), ...band(z, side)])),
  );
  shell.build(
    d,
    paint,
    [
      { poly: shell.region(screen), material: glass },
      ...[...chin, ...windows].map((poly) => ({ poly, material: glass })),
      ...stripe.map((poly) => ({ poly, material: blue })),
    ],
    zs,
    32,
  );
  shell.strip(d, screen, 0.028, trim, false);
  for (const poly of chin) shell.strip(d, poly, 0.022, trim, false);
  for (const poly of windows) shell.strip(d, poly, 0.026, trim);
  // Single center post between the windscreen panes.
  outline(
    d,
    shell.trace(
      [
        [1.5, 0],
        [2.33, 0],
      ],
      false,
      0.012,
    ),
    0.018,
    paint,
    false,
  );
  for (const side of [-1, 1]) {
    const q = (z, y, lift = 0) => shell.point(z, y, side, lift);
    // Two doors with window gaskets and sliding vent rails, handles, hinges and drain seams.
    for (const door of doors)
      shell.strip(d, shell.region(door.map(([z, y]) => [z, y, side])), 0.009, trim, false);
    for (const rail of [
      [
        [1.58, 1.25],
        [0.87, 1.23],
      ],
      [
        [0.69, 1.3],
        [-0.11, 1.26],
      ],
    ])
      shell.strip(
        d,
        rail.map(([z, y]) => [z, shell.vAt(z, y, side)]),
        0.02,
        trim,
        true,
        false,
      );
    for (const z of [1.04, 0.0])
      d.rod(q(z - 0.055, 0.83, 0.008), q(z + 0.055, 0.83, 0.008), 0.013, metal);
    for (const [z, y] of [
      [1.84, 0.74],
      [1.43, 1.4],
      [0.83, 0.73],
      [0.67, 1.38],
    ])
      d.box([0.035, 0.04, 0.06], q(z, y, 0.008), metal);
    // Baggage hatch behind the rear door, placed on the tapered flank.
    shell.strip(
      d,
      shell.region(
        [
          [-1.04, 0.63],
          [-1.55, 0.72],
          [-1.55, 1.26],
          [-1.04, 1.28],
        ].map(([z, y]) => [z, y, side]),
      ),
      0.009,
      trim,
      false,
    );
    d.rod(q(-1.08, 0.94, 0.008), q(-1.18, 0.94, 0.008), 0.012, metal);
    for (let j = 0; j < 4; j++) {
      const z = -1.37 - j * 0.055;
      d.rod([side * 0.29, 1.81, z], [side * 0.29, 1.67, z], 0.012, trim);
    }
  }
  // Raised transmission/engine roof, with separate intake lip and two upward exhausts. Its feet
  // sink into the rounded roof so the fairing never floats above the skin.
  const engine = (z, w, b, t) => {
    const shoulder = Math.max(b + (t - b) * 0.4, t - 0.12),
      foot = Math.min(b, shell.at(z, shell.vAtX(z, w))[1] - 0.02),
      // Flat top with rounded edges over upright sides.
      crown = Array.from({ length: 5 }, (_, k) => {
        const a = (k * Math.PI) / 8;
        return [
          w * Math.pow(Math.sin(a), 2 / 3.2),
          shoulder + (t - shoulder) * Math.pow(Math.cos(a), 2 / 3.2),
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
      engine(1.23, 0.18, 1.76, 1.78),
      engine(0.93, 0.29, 1.74, 1.96),
      engine(0.62, 0.35, 1.72, 2.06),
      engine(-0.7, 0.39, 1.66, 2.0),
      engine(-1.37, 0.3, 1.6, 1.93),
      engine(-2.35, 0.19, 1.57, 1.6),
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    d.rod([side * 0.31, 1.94, -0.78], [side * 0.39, 2.1, -0.78], 0.072, metal);
    d.add(new T.CircleGeometry(0.058, 16).rotateX(-Math.PI / 2), trim, [side * 0.39, 2.145, -0.78]);
    d.box([0.014, 0.09, 0.25], [side * 0.355, 1.85, 0.6], trim);
  }
  // Tail boom and the swept dorsal/ventral fin share the B-3 station geometry.
  const boom = (z, w, y, h) => ({
    z,
    points: Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5;
      return [Math.sin(a) * w, y + Math.cos(a) * h];
    }),
  });
  loft(
    d,
    [
      boom(-2.35, 0.22, 1.32, 0.26),
      boom(-4.8, 0.12, 1.43, 0.15),
      boom(-5.85, 0.08, 1.48, 0.11),
      boom(-6.3, 0.025, 1.4, 0.025),
    ],
    paint,
  );
  for (const z of [-3, -4, -5]) {
    const u = (-z - 2.35) / 3.5,
      q = boom(z, 0.22 - 0.14 * u, 1.32 + 0.16 * u, 0.26 - 0.15 * u);
    outline(
      d,
      q.points.map((p) => [...p, z]),
      0.0035,
      trim,
    );
  }
  const fin = [
    [-0.035, 1.48, -5.65],
    [-0.035, 2.52, -6.02],
    [-0.035, 2.52, -6.45],
    [-0.035, 1.52, -6.05],
    [-0.035, 0.73, -6.42],
    [-0.035, 0.72, -6.08],
    [-0.035, 1.32, -5.65],
  ];
  sheet(d, fin, paint, [-1, 0, 0]);
  sheet(
    d,
    fin.map((p) => [-p[0], p[1], p[2]]),
    paint,
    [1, 0, 0],
  );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(d, a, b, [-b[0], b[1], b[2]], [-a[0], a[1], a[2]], paint, [0, 1, 0]);
  }
  d.rod([0, 0.73, -6.42], [0, 0.38, -6.98], 0.018, metal);
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.12, 1.43, -3.57, -4.2],
        [side * 0.98, 1.43, -3.59, -4.21],
      ],
      paint,
      0.045,
    );
    d.box([0.03, 0.02, 0.07], [side * 0.96, 1.46, -3.71], side < 0 ? d.green : d.red);
  }
  // Standard low skids: 1.92 m outside span and 2.47 m rearward measured rail run.
  for (const side of [-1, 1]) {
    outline(
      d,
      [
        [side * 0.92, 0.18, 1.68],
        [side * 0.92, 0.055, 1.48],
        [side * 0.92, 0.045, -0.79],
      ],
      0.04,
      metal,
      false,
    );
    for (const z of [1.03, -0.53])
      outline(
        d,
        [
          [0, 0.39, z],
          [side * 0.63, 0.39, z],
          [side * 0.82, 0.25, z],
          [side * 0.92, 0.07, z - 0.06],
        ],
        0.033,
        metal,
        false,
      );
    d.rod([side * 0.68, 0.5, 0.67], [side * 0.88, 0.5, 0.67], 0.018, metal);
  }
  // Mast is pitched forward five degrees; spinning child retains a local vertical axis.
  const mast = group(root, '206-mast', [0, 2.83, 0]);
  mast.rotation.x = (5 * Math.PI) / 180;
  const md = detailKit(mast, '206-mast');
  md.rod([0, -0.79, 0], [0, -0.02, 0], 0.036, metal);
  md.ring(0.14, 0.025, [0, -0.49, 0], metal, 'y');
  for (const side of [-1, 1])
    md.rod([side * 0.12, -0.48, 0], [side * 0.16, -0.04, 0], 0.012, metal);
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, '206-rotor');
  rd.box([0.54, 0.09, 0.18], [0, 0, 0], metal);
  for (const side of [-1, 1]) {
    wing(
      rd,
      [
        [side * 0.24, 0, 0.12, -0.14],
        [side * 0.62, 0.015, 0.16, -0.17],
        [side * 5.08, 0.075, 0.14, -0.19],
      ],
      trim,
      0.02,
    );
    rd.box([0.14, 0.007, 0.32], [side * 4.98, 0.084, -0.02], d.ivory);
  }
  rd.finish();
  const tail = group(root, 'tail-rotor', [0.16, 1.48, -5.86]),
    td = detailKit(tail, '206-tail-rotor');
  td.rod([-0.12, 0, 0], [0.12, 0, 0], 0.038, metal);
  for (const side of [-1, 1]) {
    td.box([0.025, 0.7, 0.1], [0.02, side * 0.43, 0], trim);
    td.box([0.027, 0.08, 0.1], [0.02, side * 0.75, 0], d.ivory);
  }
  td.finish();
  // Maintenance rivet rows, small readable access labels and anticollision beacon.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 22; i++)
      d.add(new T.SphereGeometry(0.0035, 5, 3), metal, shell.point(1.46 - i * 0.1, 0.52, side));
    d.text('206B', shell.point(-0.3, 0.74, side, 0.004), 0.075, (side * Math.PI) / 2, blue);
  }
  d.box([0.045, 0.045, 0.055], [0, 2.55, -6.2], d.red);
  d.finish();
  const interior = bell206Cockpit(root, { paint, blue, trim, metal, seat }, shell, [
    shell.region(screen),
    ...chin,
    ...windows,
  ]);
  cleanGeometry(root);
  return {
    root,
    frame: bell206Frame(),
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

function bell206Cockpit(root, m, shell, apertures) {
  const cabin = group(root, 'cockpit'),
    // Panel sits low enough that the pilot's level sightline clears its top.
    panelGroup = group(cabin, '206-instrument-panel', [0, -0.15, -0.35]),
    bindings = [];
  let d = detailKit(cabin, '206-floor');
  const panel = mat('206-panel', '#7b8584'),
    face = mat('206-dials', '#142027'),
    ink = mat('206-ink', '#d2dbca'),
    sky = mat('206-horizon-sky', '#558995'),
    earth = mat('206-horizon-earth', '#675f40');
  // Dark cabin trim 3 cm inside the skin, open at every window, so the glazing reads dark.
  shell.build(
    d,
    m.trim,
    apertures.map((poly) => ({ poly, material: null })),
    shell.samples(0.3).filter((z) => z > -1),
    16,
    0.03,
  );
  // Cabin and raised forward decks trimmed to the rounded lower corners of the shell.
  const rings = [-0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.2].map((z) => ({
    z,
    points: Array.from({ length: 32 }, (_, j) => shell.at(z, -0.5 + j / 32).slice(0, 2)),
  }));
  fittedFloor(d, rings, m.trim, {
    y: 0.415,
    front: 1.565,
    back: -0.665,
    width: 1.2,
    thickness: 0.03,
  });
  fittedFloor(d, rings, m.trim, {
    y: 0.495,
    front: 2.095,
    back: 1.545,
    width: 1.1,
    thickness: 0.03,
  });
  d.finish();
  d = detailKit(panelGroup, '206-panel');
  // Compact full instrument face with the taller radio pedestal beneath its center.
  const edge = [
    [-0.63, 1.4, 1.98],
    [-0.59, 1.49, 1.98],
    [-0.52, 1.56, 1.98],
    [0.37, 1.56, 1.98],
    [0.47, 1.5, 1.98],
    [0.5, 1.4, 1.98],
    [0.5, 0.82, 1.98],
    [0.44, 0.76, 1.98],
    [-0.58, 0.76, 1.98],
    [-0.65, 0.82, 1.98],
  ];
  sheet(d, edge, panel, [0, 0, -1]);
  // The housing narrows and drops toward the nose so its shoulders stay under the windscreen,
  // which curves in toward the roof.
  const ahead = edge.map(([x, y]) => [x * 0.85, 0.8 + (y - 0.8) * 0.85, 2.22]);
  sheet(d, ahead, m.trim, [0, 0, 1]);
  for (let i = 0; i < edge.length; i++) {
    const j = (i + 1) % edge.length;
    quad(d, edge[i], edge[j], ahead[j], ahead[i], m.trim, [0, 1, 0]);
  }
  outline(d, edge.slice(0, 7), 0.022, m.trim, false);
  // Relative arrangement from the photographed PT-HUR panel; physical size is cabin-fit.
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 9; c++)
      d.box([0.064, 0.022, 0.005], [0.2 - c * 0.083, 1.484 - r * 0.03, 1.964], face);
  const gauge = (name, x, y, r, source, attitude = false) => {
    d.add(new T.CircleGeometry(r, 24).rotateY(Math.PI), face, [x, y, 1.96]);
    d.ring(r, 0.007, [x, y, 1.955], m.trim);
    if (attitude) {
      d.add(new T.CircleGeometry(r * 0.89, 24, 0, Math.PI).rotateY(Math.PI), sky, [x, y, 1.95]);
      d.add(new T.CircleGeometry(r * 0.89, 24, Math.PI, Math.PI).rotateY(Math.PI), earth, [
        x,
        y,
        1.95,
      ]);
      for (const j of [-2, -1, 1, 2])
        d.box([r * 0.55, 0.002, 0.002], [x, y + j * r * 0.18, 1.945], ink);
    }
    for (let i = 0; i < 24; i++) {
      const a = (-0.25 + (i * 1.5) / 23) * Math.PI;
      d.rod(
        [x + Math.cos(a) * r * 0.76, y + Math.sin(a) * r * 0.76, 1.947],
        [x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88, 1.947],
        0.0013,
        ink,
      );
    }
    if (!attitude)
      for (let i = 0; i < 5; i++) {
        const a = (-0.25 + (i * 1.5) / 4) * Math.PI;
        d.text(
          source === 'heading' ? ['E', 'S', 'W', 'N', 'E'][i] : String(i * 2),
          [x + Math.cos(a) * r * 0.59, y + Math.sin(a) * r * 0.59, 1.944],
          r * 0.15,
          Math.PI,
          ink,
        );
      }
    if (['power', 'rpm'].includes(source))
      for (let i = 0; i < 10; i++) {
        const a = 0.15 + i * 0.09,
          b = a + 0.07;
        d.rod(
          [x + Math.cos(a) * r * 0.91, y + Math.sin(a) * r * 0.91, 1.943],
          [x + Math.cos(b) * r * 0.91, y + Math.sin(b) * r * 0.91, 1.943],
          0.0028,
          d.green,
        );
      }
    d.text(name, [x, y - r * 0.32, 1.943], r * 0.16, Math.PI, ink);
    const n = group(panelGroup, `206-${name.replaceAll(' ', '-')}-pointer`, [x, y, 1.94]),
      nd = detailKit(n, 'pointer');
    if (attitude) nd.box([r * 1.15, 0.004, 0.003], [0, 0, 0], nd.amber);
    else nd.rod([0, -r * 0.15, 0], [0, r * 0.69, 0], 0.002, ink);
    nd.finish();
    bindings.push({
      node: n.name,
      source,
      property: 'rotation',
      axis: 'z',
      scale: attitude
        ? 1
        : source === 'airspeed'
          ? 0.044
          : source === 'altitude'
            ? 0.0206
            : source === 'heading'
              ? -1
              : 3.8,
      offset: attitude ? 0 : -1.8,
    });
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        d.add(new T.CircleGeometry(0.002, 5).rotateY(Math.PI), m.metal, [
          x + sx * r * 0.98,
          y + sy * r * 0.98,
          1.959,
        ]);
  };
  const gauges = [
    ['ENG OIL', 0.18, 1.334, 0.064, 'rpm'],
    ['TORQUE', 0.027, 1.333, 0.064, 'power'],
    ['KNOTS', -0.153, 1.307, 0.085, 'airspeed'],
    ['ATT', -0.346, 1.307, 0.085, 'roll', true],
    ['ALT', -0.535, 1.307, 0.077, 'altitude'],
    ['XMSN', 0.169, 1.187, 0.064, 'rpm'],
    ['TEMP', 0.011, 1.191, 0.064, 'power'],
    ['RPM', -0.176, 1.128, 0.085, 'rpm'],
    ['HDG', -0.382, 1.127, 0.085, 'heading'],
    ['CLIMB', -0.576, 1.151, 0.061, 'verticalSpeed'],
    ['FUEL', 0.156, 1.035, 0.07, 'power'],
    ['N1', 0.006, 1.045, 0.064, 'rpm'],
    ['VOR', -0.204, 0.928, 0.081, 'heading'],
    ['ADF', -0.41, 0.938, 0.081, 'heading'],
    ['TURN', -0.588, 1.022, 0.054, 'yaw'],
    ['FUEL PSI', 0.149, 0.876, 0.065, 'power'],
  ];
  for (const g of gauges) gauge(...g);
  d.box([0.13, 0.09, 0.006], [-0.019, 0.898, 1.96], face);
  d.text('12.00', [-0.019, 0.91, 1.951], 0.022, Math.PI, ink);
  d.box([0.17, 0.12, 0.004], [0.37, 1.29, 1.96], m.trim);
  const master = group(panelGroup, '206-engine-master', [0.37, 1.29, 1.94]);
  master.userData.aircraftControl = {
    action: 'engine',
    motion: { property: 'rotation', axis: 'x', scale: -0.5 },
  };
  const md = detailKit(master, master.name);
  md.box([0.04, 0.06, 0.025], [0, 0, 0], d.red);
  md.finish();
  d.text('ENGINE', [0.37, 1.335, 1.935], 0.012, Math.PI, d.ivory);
  d.box([0.22, 0.16, 0.004], [0.37, 1.04, 1.959], d.ivory);
  d.text('DANGER', [0.37, 1.07, 1.949], 0.024, Math.PI, d.red);
  d.text('TAIL ROTOR', [0.37, 1.025, 1.949], 0.016, Math.PI, m.trim);
  d.box([0.05, 0.075, 0.03], [-0.54, 0.81, 1.94], d.red);
  const radio = group(cabin, '206-radio-pedestal', [0, 0.69, 1.61]);
  radio.rotation.x = 0.55;
  const rd = detailKit(radio, '206-radio');
  rd.box([0.29, 0.42, 0.18], [0, 0, 0.065], m.trim);
  for (let i = 0; i < 3; i++) {
    const y = 0.13 - i * 0.125;
    rd.box([0.26, 0.105, 0.012], [0, y, -0.034], panel);
    rd.box([0.16, 0.037, 0.006], [0.012, y + 0.02, -0.044], face);
    rd.text(
      i === 0 ? '118.00' : i === 1 ? '110.50' : '1200',
      [0, y + 0.021, -0.05],
      0.016,
      Math.PI,
      rd.amber,
    );
    for (const x of [-0.105, 0.105])
      rd.add(new T.CylinderGeometry(0.014, 0.014, 0.018, 8).rotateX(Math.PI / 2), m.trim, [
        x,
        y - 0.026,
        -0.05,
      ]);
  }
  rd.finish();
  d.finish();
  d = detailKit(cabin, '206-cabin');
  for (const side of [-1, 1]) {
    const x = side * 0.34;
    d.box([0.43, 0.12, 0.48], [x, 0.66, 0.98], m.seat);
    const back = d.box([0.43, 0.55, 0.09], [x, 0.97, 0.74], m.seat);
    back.rotation.x = -0.13;
    for (const sx of [-1, 1]) {
      d.rod([x + sx * 0.18, 0.43, 0.79], [x + sx * 0.18, 0.62, 0.79], 0.018, m.metal);
      d.rod([x + sx * 0.13, 1.2, 0.69], [x + sx * 0.025, 0.74, 1.12], 0.015, m.trim);
    }
    d.box([0.065, 0.04, 0.025], [x, 0.75, 1.12], m.metal);
    const stick = group(cabin, `206-cyclic-${side}`, [x, 0.44, 1.39]),
      sd = detailKit(stick, 'cyclic');
    outline(
      sd,
      [
        [0, 0, 0],
        [0, 0.26, 0],
        [0, 0.4, -0.16],
        [0, 0.54, -0.18],
      ],
      0.017,
      m.trim,
      false,
    );
    sd.box([0.045, 0.12, 0.045], [0, 0.57, -0.18], m.trim);
    sd.box([0.015, 0.015, 0.013], [0, 0.64, -0.19], sd.red);
    sd.finish();
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const collective = group(cabin, `206-collective-${side}`, [x + 0.24, 0.5, 0.82]),
      cd = detailKit(collective, 'collective');
    cd.rod([0, 0, 0], [0, 0.15, 0.44], 0.021, m.trim);
    cd.box([0.047, 0.048, 0.13], [0, 0.15, 0.44], m.trim);
    cd.finish();
    bindings.push({
      node: collective.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: -0.4,
    });
    for (const k of [-1, 1]) {
      const pg = group(cabin, `206-pedal-${side}-${k}`, [x + k * 0.11, 0.49, 1.9]),
        pd = detailKit(pg, 'pedal');
      pd.box([0.14, 0.075, 0.02], [0, 0, 0], m.metal);
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -k * 0.04,
      });
    }
  }
  // Three-place rear bench and roof switch strip, separate from the engine cowling.
  d.box([1.22, 0.11, 0.44], [0, 0.65, -0.4], m.seat);
  d.box([1.22, 0.55, 0.08], [0, 0.96, -0.63], m.seat);
  for (const x of [-0.4, 0, 0.4])
    d.rod([x - 0.12, 1.2, -0.67], [x + 0.12, 0.72, -0.16], 0.018, m.trim);
  d.box([0.19, 0.035, 0.46], [0, 1.68, 0.58], m.trim);
  for (let i = 0; i < 8; i++)
    d.rod([0, 1.65, 0.39 + i * 0.047], [0, 1.62, 0.4 + i * 0.047], 0.004, m.metal);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
