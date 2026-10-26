/** F-15C MSIP, clean airframe, 1992 F100-PW-220 configuration.
 * Main-axle datum, +Z forward, +X pilot left. Separate measured SAC and MSIP panels.
 */
import { panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
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
export const f15Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.62,
  cy: 2.3,
  ry: 0.65,
  cabinZ: 6.55,
  cabinWidth: 0.88,
  eye: [0, 3.34, 6.55],
  panelZ: 7.42,
  floor: 1.98,
});
export function buildF15C(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('F15-gray', '#929ca5', { side: T.DoubleSide }),
    upper = mat('F15-upper', '#737f8a', { side: T.DoubleSide }),
    dark = mat('F15-seals', '#24292d'),
    metal = mat('F15-alloy', '#b1b8bb', { metalness: 0.74 }),
    nozzle = mat('F15-nozzle', '#74736d', { metalness: 0.7, side: T.DoubleSide }),
    lining = mat('F15-exhaust-lining', '#272726', { side: T.DoubleSide }),
    nose = mat('F15-radome', '#8a9297'),
    glass = mat('F15-glazing', '#9eb7bf', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'F15-airframe'),
    bindings = [];
  const sections = [
    [11.6, 0.01, 2.05, 2.08],
    [10.9, 0.18, 1.93, 2.3],
    [10.05, 0.37, 1.81, 2.57],
    [9.35, 0.49, 1.78, 2.75],
    [8.5, 0.56, 1.76, 2.84],
    [7.75, 0.61, 1.74, 2.91],
    [6.7, 0.63, 1.72, 2.94],
    [5.25, 0.64, 1.68, 2.96],
    [4.4, 0.69, 1.65, 2.99],
    [2.6, 0.84, 1.64, 2.96],
    [0, 0.89, 1.62, 2.9],
    [-2.5, 0.84, 1.65, 2.85],
    [-4.8, 0.62, 1.8, 2.65],
    [-6.7, 0.25, 1.97, 2.42],
    [-7.25, 0.05, 2.12, 2.23],
  ];
  const rings = sections.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 24 }, (_, i) => [
      Math.sin((i * Math.PI) / 12) * w,
      (b + t) / 2 + (Math.cos((i * Math.PI) / 12) * (t - b)) / 2,
    ]),
  }));
  loft(d, rings, paint, { skip: (i, j) => i < 3 || (i >= 5 && i < 8 && (j < 5 || j >= 19)) });
  loft(d, rings.slice(0, 4), nose);
  for (const i of [3, 4, 9, 11, 12])
    outline(
      d,
      rings[i].points.map(([x, y]) => [x * 1.003, y, rings[i].z]),
      0.003,
      dark,
    );
  // Single-seat canopy and fixed windscreen; no fuselage roof inside its aperture.
  const canopy = [
    [8.45, 0.04, 2.82, 2.85],
    [8.0, 0.35, 2.86, 3.15],
    [7.43, 0.5, 2.88, 3.51],
    [7.12, 0.53, 2.9, 3.6],
    [6.5, 0.54, 2.91, 3.6576],
    [5.75, 0.5, 2.92, 3.6],
    [5.1, 0.35, 2.95, 3.35],
    [4.55, 0.02, 2.98, 3.0],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      b + Math.sin((j * Math.PI) / 16) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  for (const i of [0, 2, 7])
    outline(
      d,
      cr[i].points.map((q) => [...q, cr[i].z]),
      i === 2 ? 0.025 : 0.018,
      paint,
      false,
    );
  for (const side of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[side], r.z]),
      0.024,
      paint,
      false,
    );
  for (const side of [-1, 1]) {
    const rail = [
      [0.43, 2.88, 7.75],
      [0.54, 2.91, 6.7],
      [0.4, 2.94, 5.25],
      [0.02, 2.98, 4.4],
    ];
    for (let i = 0; i < 3; i++) {
      const a = rings[5 + i],
        b = rings[6 + i],
        j = side === 1 ? 5 : 19;
      quad(
        d,
        [...a.points[j], a.z],
        [...b.points[j], b.z],
        [side * rail[i + 1][0], rail[i + 1][1], rail[i + 1][2]],
        [side * rail[i][0], rail[i][1], rail[i][2]],
        paint,
        [side, 1, 0],
      );
    }
  }
  // Forward windscreen center pane and side panels share an arched bow.
  for (const j of [5, 11])
    outline(
      d,
      cr.slice(0, 3).map((r) => [...r.points[j], r.z]),
      0.012,
      dark,
      false,
    );
  for (let j = 0; j < 17; j++) {
    const p = cr[2].points[j];
    d.add(new T.SphereGeometry(0.004, 5, 3), metal, [p[0], p[1] + 0.015, 7.43]);
  }
  const oval = (r, z, cy = 2.18) => ({
    z,
    points: Array.from({ length: 24 }, (_, i) => [
      Math.sin((i * Math.PI) / 12) * r,
      cy + Math.cos((i * Math.PI) / 12) * r,
    ]),
  });
  for (const side of [-1, 1]) {
    // Rectangular ramp inlet, separate from the circular aft engine pod.
    const ng = group(root, `F15-engine-${side}`, [side * 1.03, 0, 0]),
      nd = detailKit(ng, ng.name);
    const nr = [
      [5.95, 0.5, 1.72, 3.0],
      [4.6, 0.6, 1.45, 2.99],
      [2.5, 0.67, 1.39, 2.94],
      [0, 0.68, 1.38, 2.89],
      [-2.8, 0.64, 1.48, 2.88],
      [-5.65, 0.58, 1.6, 2.76],
    ].map(([z, w, b, t]) => ({
      z,
      points: [
        [0, t],
        [w * 0.82, t],
        [w, t - 0.14],
        [w, b + 0.13],
        [w * 0.8, b],
        [-w * 0.8, b],
        [-w, b + 0.13],
        [-w, t - 0.14],
        [-w * 0.82, t],
      ],
    }));
    loft(nd, nr.slice(1), paint, { caps: false });
    const leading = nr[0].points.map(([x, y]) => [x, y, 5.15 + ((y - 1.72) / 1.28) * 0.8]);
    for (let j = 0; j < leading.length; j++) {
      const a = leading[j],
        b = leading[(j + 1) % leading.length];
      quad(
        nd,
        a,
        b,
        [...nr[1].points[(j + 1) % leading.length], nr[1].z],
        [...nr[1].points[j], nr[1].z],
        paint,
        [a[0], a[1] - 2.3, 0],
      );
    }
    const mouth = [
        [-0.47, 2.99, 5.95],
        [0.47, 2.99, 5.95],
        [0.5, 2.86, 5.88],
        [0.5, 1.78, 5.15],
        [-0.5, 1.78, 5.15],
        [-0.5, 2.86, 5.88],
      ],
      back = mouth.map(([x, y]) => [x * 0.85, 2.3 + (y - 2.3) * 0.8, 3.55]);
    for (let j = 0; j < mouth.length; j++) {
      const a = mouth[j],
        b = mouth[(j + 1) % mouth.length];
      quad(nd, a, b, back[(j + 1) % mouth.length], back[j], dark, [-a[0], 2.3 - a[1], 0]);
    }
    outline(nd, mouth, 0.025, paint);
    sheet(nd, back, dark, [0, 0, 1]);
    quad(
      nd,
      [-0.45, 2.94, 5.7],
      [0.45, 2.94, 5.7],
      [0.43, 2.7, 4.15],
      [-0.43, 2.7, 4.15],
      upper,
      [0, -1, 0],
    );
    for (const r of nr.slice(1, -1))
      outline(
        nd,
        r.points.map(([x, y]) => [x * 1.004, y, r.z]),
        0.0035,
        dark,
      );
    loft(nd, [oval(0.58, -5.65), oval(0.63, -6.15)], nozzle, { caps: false });
    nd.add(
      new T.CylinderGeometry(0.63, 0.56, 0.95, 32, 1, true).rotateX(Math.PI / 2),
      nozzle,
      [0, 2.18, -6.625],
    );
    nd.add(
      new T.CylinderGeometry(0.46, 0.52, 0.85, 32, 1, true).rotateX(Math.PI / 2),
      lining,
      [0, 2.18, -6.675],
    );
    nd.add(new T.CircleGeometry(0.47, 32).rotateY(Math.PI), dark, [0, 2.18, -6.24]);
    // Exposed actuator rods characteristic of the featherless Eagle exhaust.
    for (let j = 0; j < 16; j++) {
      const a = (j * Math.PI) / 8,
        p = (r, z) => [Math.sin(a) * r, 2.18 + Math.cos(a) * r, z];
      nd.rod(p(0.635, -6.14), p(0.57, -7.08), 0.01, metal);
      nd.rod(p(0.65, -6.18), p(0.61, -6.65), 0.018, nozzle);
    }
    nd.finish();
    // Fixed cropped-delta wing, with actual separate inboard flap and outboard aileron.
    const ws = [
      [1.6, 2.68, 2.1, -4.14, 0.15],
      [2.2, 2.67, 1.5, -4.14, 0.14],
      [4.2, 2.62, -0.5, -4.14, 0.09],
      [5.85, 2.58, -2.15, -4.52, 0.045],
      [6.4, 2.56, -2.78, -3.8, 0.025],
      [6.524244, 2.56, -3.3, -3.65, 0.012],
    ];
    wing(
      d,
      ws.map(([x, y, le, te, h]) => [side * x, y, le, te + Math.min(0.85, (le - te) * 0.4), h]),
      upper,
    );
    for (let j = 0; j < ws.length - 1; j++) {
      const a = ws[j],
        b = ws[j + 1],
        hinge = (q) => q[3] + Math.min(0.85, (q[2] - q[3]) * 0.4),
        px = (side * (a[0] + b[0])) / 2,
        py = (a[1] + b[1]) / 2,
        pz = (hinge(a) + hinge(b)) / 2;
      const g = group(root, `F15-${j < 2 ? 'flap' : 'aileron'}-${side}-${j}`, [px, py, pz]),
        wd = detailKit(g, g.name);
      wing(
        wd,
        [a, b].map((q) => [side * q[0] - px, q[1] - py, hinge(q) - pz, q[3] - pz, q[4] * 0.23]),
        paint,
      );
      wd.finish();
      if (j < 3)
        bindings.push({
          node: g.name,
          source: j < 2 ? 'flapPosition' : 'rollInput',
          property: 'rotation',
          axis: 'x',
          scale: j < 2 ? -0.5 : -side * 0.32,
        });
    }
    for (const [x, y, le, te, h] of ws.slice(1, -1))
      d.rod(
        [side * x, y + h + 0.004, le - 0.2],
        [side * x, y + h * 0.52 + 0.004, te + (le - te) * 0.26],
        0.003,
        dark,
      );
    for (let j = 0; j < 55; j++) {
      const x = 2.25 + j * 0.065,
        t = (x - 2.2) / 3.65,
        y = 2.67 - 0.09 * t;
      d.add(new T.SphereGeometry(0.004, 4, 3), metal, [
        side * x,
        y + 0.1 - 0.06 * t,
        1.5 - 3.65 * t - 0.23,
      ]);
    }
    // Low-mounted, swept all-moving tail, 28.25 ft overall span.
    const tg = group(root, `F15-stabilator-${side}`, [side * 1.65, 2.18, -5.8]),
      td = detailKit(tg, tg.name);
    wing(
      td,
      [
        [0, 0, 0.8, -1.93, 0.08],
        [side * 2.45, -0.04, -0.85, -2.031, 0.035],
        [side * 2.6553, -0.04, -1.36, -1.79, 0.018],
      ],
      paint,
    );
    td.finish();
    bindings.push({
      node: tg.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const fg = group(root, `F15-fin-${side}`, [side * 1.65, 2.77, -4.3]),
      fd = detailKit(fg, fg.name);
    const edge = [
      [0, 0, 0.8],
      [0, 0.48, 0.36],
      [0, 2.82, -1.62],
      [0, 2.893184, -2.8],
      [0, 2.65, -2.73],
      [0, 2.65, -2.45],
      [0, 0.12, -1.85],
    ];
    for (const x of [-0.055, 0.055])
      sheet(
        fd,
        edge.map(([a, b, c]) => [a + x, b, c]),
        upper,
        [Math.sign(x), 0, 0],
      );
    for (let j = 0; j < edge.length; j++)
      quad(
        fd,
        edge[j].map((v, k) => v + (k === 0 ? -0.055 : 0)),
        edge[(j + 1) % edge.length].map((v, k) => v + (k === 0 ? -0.055 : 0)),
        edge[(j + 1) % edge.length].map((v, k) => v + (k === 0 ? 0.055 : 0)),
        edge[j].map((v, k) => v + (k === 0 ? 0.055 : 0)),
        upper,
        [0, 1, 0],
      );
    const rg = group(fg, `F15-rudder-${side}`, [0, 0, -1.85]),
      rd = detailKit(rg, rg.name);
    sheet(
      rd,
      [
        [0, 0.12, 0],
        [0, 2.65, -0.6],
        [0, 2.65, -0.88],
        [0, 0.12, -1.03],
      ],
      paint,
      [side, 0, 0],
    );
    rd.finish();
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.4,
    });
    // Exterior operator identifiers are supplied by the selected livery.
    fd.rod([0, 2.86, -1.68], [0, 2.86, -2.78], side === 1 ? 0.08 : 0.045, dark);
    fd.finish();
    // Lateral skin access lines follow the local fuselage section, not a floating cage.
    for (let i = 4; i < 8; i++) {
      const a = sections[i],
        b = sections[i + 1];
      d.rod(
        [side * a[1], (a[2] + a[3]) / 2, a[0]],
        [side * b[1], (b[2] + b[3]) / 2, b[0]],
        0.003,
        dark,
      );
    }
    for (let j = 0; j < 29; j++)
      d.add(new T.SphereGeometry(0.004, 4, 3), metal, [side * 0.625, 2.72, 5.05 + j * 0.09]);
    const label = group(root, `F15-stencils-${side}`, [side * 0.635, 2.58, 6.9]);
    label.rotation.y = (side * Math.PI) / 2;
    const ld = detailKit(label, label.name);
    ld.text('RESCUE', [0, 0, 0], 0.045, 0, d.yellow);
    ld.text('DANGER', [0, -0.13, 0], 0.035, 0, d.red);
    ld.finish();
  }
  // Speed-brake outline on the upper spine, closed for this model.
  outline(
    d,
    [
      [-0.45, 3.005, 4.25],
      [0.45, 3.005, 4.25],
      [0.7, 2.97, 1.2],
      [-0.7, 2.97, 1.2],
    ],
    0.006,
    dark,
  );
  for (const [name, x, z, r, w] of [
    ['nose', 0, 5.419344, 0.27, 0.17],
    ['left', 1.376172, 0, 0.46, 0.25],
    ['right', -1.376172, 0, 0.46, 0.25],
  ]) {
    const gy = name === 'nose' ? 1.78 : 1.62,
      g = group(root, `F15-gear-${name}`, [x, gy, z]),
      gd = detailKit(g, g.name);
    gd.add(new T.CylinderGeometry(r, r, w, 28).rotateZ(Math.PI / 2), dark, [0, r - gy, 0]);
    for (const side of [-1, 1]) {
      gd.add(new T.CylinderGeometry(r * 0.57, r * 0.57, 0.025, 24).rotateZ(Math.PI / 2), metal, [
        side * (w / 2 + 0.01),
        r - gy,
        0,
      ]);
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        gd.add(new T.SphereGeometry(0.018, 6, 4), dark, [
          side * (w / 2 + 0.025),
          r - gy + Math.sin(a) * r * 0.35,
          Math.cos(a) * r * 0.35,
        ]);
      }
    }
    gd.rod([0, 0, 0], [0, r - gy + 0.09, 0], 0.053, metal);
    gd.rod([0, 0, -0.65], [0, r - gy + 0.2, 0], 0.036, paint);
    gd.rod([0, -0.4, -0.08], [0, -0.65, -0.25], 0.025, metal);
    gd.rod([0, -0.65, -0.25], [0, -0.9, -0.06], 0.025, metal);
    gd.box(
      [0.035, 0.65, 0.65],
      [name === 'nose' ? 0.23 : Math.sign(x) * 0.24, -0.28, -0.17],
      paint,
    );
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: 'x',
      scale: Math.PI / 2,
      offset: -Math.PI / 2,
    });
  }
  d.rod([0, 1.9, -5.4], [0, 1.55, -7.15], 0.03, metal);
  d.finish();
  const interior = f15Cockpit(root, { paint, upper, dark, metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.3] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.12] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: f15Frame(),
    enginePoints: [
      { id: 'engine-1', position: [1.03, 2.18, -5.5] },
      { id: 'engine-2', position: [-1.03, 2.18, -5.5] },
    ],
    visual: {
      rotors: [],
      gearNodes: [],
      flaps: [],
      ailerons: [],
      animation: { bindings },
      interior,
    },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function f15Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'F15-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'F15'),
    { bindings, derived, ink, black, amber } = ins;
  const panel = mat('F15-panel', '#4f575b', { side: T.DoubleSide }),
    seat = mat('F15-seat', '#51584b'),
    belt = mat('F15-harness', '#9a9e90');
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'angleOfAttack',
      'gearPosition',
      'flapPosition',
      'loadFactor',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
      { component: 'aircraftState', path: [k] },
    ]),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
  for (const [k, v] of [
    ['pitchInput', 'pitch'],
    ['rollInput', 'roll'],
    ['yawInput', 'yaw'],
    ['power', 'power'],
  ])
    sources[k] = { component: 'aircraftInput', path: [v] };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 1.9438444924406] },
    feet: { op: 'multiply', args: ['altitude', 3.2808398950131] },
    altitudeHundreds: { op: 'modulo', args: ['feet', 1000] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    aoaDegrees: { op: 'multiply', args: ['angleOfAttack', 180 / Math.PI] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
  });
  // Pixel coordinates from normalized 2048px MSIP foldout FO-3. Scale from a nominal 3.125in instrument.
  const k = 0.00225,
    z = 7.42,
    at = (u, v, dz = 0) => [(1071 - u) * k, 2.94 - (v - 365) * k, z + dz];
  const rect = (u, v, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([a, b]) => at(u + a * w, v + b * h, dz)),
    circle = (u, v, r) =>
      Array.from({ length: 40 }, (_, j) =>
        at(u + Math.cos((j * Math.PI) / 20) * r, v + Math.sin((j * Math.PI) / 20) * r),
      );
  const box = (u, v, w, h, material = black, depth = 0.012) =>
      d.box([w * k, h * k, depth], at(u, v, -0.025 + depth / 2), material),
    text = (t, u, v, h = 6, material = ink) =>
      d.text(t, at(u, v, -0.031), h * k, Math.PI, material);
  const edge = [
    [888, 327],
    [889, 290],
    [920, 262],
    [981, 230],
    [1040, 210],
    [1100, 210],
    [1163, 238],
    [1225, 272],
    [1260, 302],
    [1258, 440],
    [1121, 440],
    [1121, 559],
    [1021, 559],
    [1021, 486],
    [986, 486],
    [986, 440],
    [886, 440],
  ];
  sheet(
    d,
    edge.map((p) => at(...p)),
    panel,
    [0, 0, -1],
    [circle(1071, 357, 25), circle(1071, 464, 14)],
  );
  outline(
    d,
    edge.map((p) => at(...p, -0.005)),
    0.009,
    black,
  );
  for (let j = 0; j < edge.length; j += 2)
    d.add(new T.SphereGeometry(0.003, 6, 4), m.metal, at(...edge[j], -0.014));
  // ADI and standby attitude remain genuinely recessed through apertures.
  ins.horizon('ADI', at(1071, 357, 0.01), 0.105, 0.105, { round: true, blankBackdrop: true });
  ins.horizon('standby', at(1071, 464, 0.01), 0.055, 0.055, { round: true, blankBackdrop: true });
  ins.dial(
    'airspeed',
    at(998, 351, -0.009),
    21 * k,
    'knots',
    [
      [0, 0],
      [100, 0.6],
      [200, 1.45],
      [300, 2.6],
      [400, 3.6],
      [600, 4.7],
      [800, 5.6],
    ],
    [0, 100, 200, 300, 400, 600, 800],
    'TAS',
    { minorStep: 20, tickLabels: { 0: 0, 100: 1, 200: 2, 300: 3, 400: 4, 600: 6, 800: 8 } },
  );
  ins.dial(
    'altimeter',
    at(1140, 351, -0.009),
    20 * k,
    'altitudeHundreds',
    [
      [0, 0],
      [1000, Math.PI * 2],
    ],
    [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    'GEO FT',
    {
      period: Math.PI * 2,
      tickLabels: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i * 100, i])),
    },
  );
  ins.readout('altitude', at(1140, 361, -0.03), 'feet', 5, 0.008, ink, true, true);
  ins.dial(
    'vertical-speed',
    at(1140, 390, -0.009),
    15 * k,
    'verticalFpm',
    [
      [-6000, -Math.PI / 2],
      [0, Math.PI / 2],
      [6000, 1.5 * Math.PI],
    ],
    [-6000, -4000, -2000, 0, 2000, 4000, 6000],
    'FPM',
    { tickLabels: { '-6000': -6, '-4000': -4, '-2000': -2, 0: 0, 2000: 2, 4000: 4, 6000: 6 } },
  );
  ins.dial(
    'AOA',
    at(1002, 389, -0.009),
    14 * k,
    'aoaDegrees',
    [
      [-10, -1],
      [0, 0],
      [40, 4.8],
    ],
    [-10, 0, 10, 20, 30, 40],
    'DEG',
  );
  ins.dial(
    'G',
    at(1002, 424, -0.009),
    14 * k,
    'loadFactor',
    [
      [-5, -2],
      [0, 0],
      [10, 4],
    ],
    [-5, 0, 5, 10],
    'G',
  );
  pt.gauge(...at(1071, 416).slice(0, 2), z - 0.01, 29 * k, black, false);
  const hd = group(cabin, 'F15-heading', at(1071, 416, -0.023)),
    dd = detailKit(hd, hd.name);
  for (let j = 0; j < 72; j++) {
    const a = (j * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    dd.rod(p(j % 6 ? 0.055 : 0.05), p(0.061), 0.0007, ink);
    if (j % 6 === 0) dd.text(String(j / 2), p(0.041), 0.009, Math.PI, ink);
  }
  dd.finish();
  bindings.push({
    node: hd.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: Math.PI * 2,
  });
  ins.available('heading', 'trueHeading', hd.name);
  d.rod(at(1071, 387, -0.028), at(1071, 397, -0.028), 0.0015, ink);
  text('TRUE', 1071, 436, 4);
  const display = (u, v, w, h, label) => {
    box(u, v, w, h, black, 0.06);
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        box(u + side * (w / 2 - 4), v - h * 0.34 + j * h * 0.135, 4, 5, panel);
        box(u - w * 0.34 + j * w * 0.135, v + side * (h / 2 - 4), 5, 4, panel);
      }
    box(u, v, w * 0.72, h * 0.65, ins.black);
    text(label, u, v - h * 0.22, 5);
    text('INOP', u, v, 8, amber);
  };
  display(983, 280, 76, 91, 'VSD');
  display(934, 372, 86, 100, 'MPCD');
  box(923, 300, 43, 43, panel);
  for (const [u, v] of [
    [910, 313],
    [933, 313],
    [936, 287],
    [936, 270],
  ]) {
    d.add(
      new T.CylinderGeometry(0.007, 0.008, 0.015, 12).rotateX(Math.PI / 2),
      black,
      at(u, v, -0.04),
    );
    d.rod(at(u, v, -0.049), at(u, v - 3, -0.049), 0.0008, ink);
  }
  text('VSD CONT', 922, 303, 3);
  text('TEST', 923, 284, 3);
  for (const [u, v] of [
    [1034, 347],
    [1034, 374],
    [1110, 344],
    [1110, 372],
    [1110, 398],
  ]) {
    box(u, v, 9, 11);
    text('--', u, v, 3, amber);
  }
  d.box([35 * k, 43 * k, 0.015], at(1236, 405, 0.005), panel);
  d.box([36 * k, 43 * k, 0.015], at(1248, 459, 0.005), panel);
  pt.gauge(...at(1171, 289).slice(0, 2), z - 0.01, 35 * k, black, false);
  text('TEWS', 1171, 281, 7);
  text('INOP', 1171, 298, 7, amber);
  // The centrally stacked analog engine indicators stay blank until those quantities exist.
  for (const [v, label] of [
    [341, 'RPM'],
    [369, 'EGT'],
    [398, 'NOZ'],
    [425, 'FF'],
  ])
    for (const u of [1181, 1208]) {
      pt.gauge(...at(u, v).slice(0, 2), z - 0.012, 11 * k, black, false);
      text(label, u, v - 3, 3);
      text('--', u, v + 5, 4, amber);
    }
  for (const [u, v, r, label] of [
    [1140, 421, 15, 'CLOCK'],
    [1232, 342, 8, 'OIL'],
    [1247, 342, 8, 'OIL'],
    [1232, 363, 8, 'HYD'],
    [1247, 363, 8, 'HYD'],
    [1236, 405, 17, 'FUEL'],
    [1248, 459, 15, 'CABIN'],
  ]) {
    pt.gauge(...at(u, v).slice(0, 2), z - 0.012, r * k, black, false);
    text(label, u, v - 3, 3);
    text('--', u, v + 5, 4, amber);
  }
  ins.dial(
    'standby-speed',
    at(1037, 464, -0.009),
    14 * k,
    'knots',
    [
      [0, 0],
      [100, 0.6],
      [200, 1.45],
      [400, 3.6],
      [800, 5.6],
    ],
    [0, 200, 400, 800],
    'TAS',
    { tickLabels: { 0: 0, 200: 2, 400: 4, 800: 8 } },
  );
  ins.altimeter('standby-altitude', at(1105, 464, -0.009), 14 * k, 'feet');
  // Center HUD/control panel. No fake radar, targeting data or engine values.
  box(1071, 269, 83, 98, black, 0.09);
  for (const [v, label] of [
    [229, 'COMM'],
    [264, 'HUD'],
    [308, 'STEER'],
  ]) {
    box(1071, v, 75, v === 264 ? 54 : 20, panel);
    text(label, 1071, v - 7, 3);
  }
  for (const [u, v] of [
    [1042, 231],
    [1102, 231],
    [1042, 256],
    [1042, 276],
    [1068, 277],
    [1101, 276],
    [1051, 309],
    [1094, 309],
  ]) {
    d.add(
      new T.CylinderGeometry(0.008, 0.01, 0.013, 12).rotateX(Math.PI / 2),
      black,
      at(u, v, -0.04),
    );
    d.rod(at(u, v, -0.049), at(u, v - 3, -0.049), 0.0009, ink);
  }
  for (const [u, v] of [
    [1060, 232],
    [1077, 232],
    [1061, 251],
    [1079, 251],
    [1093, 251],
  ]) {
    box(u, v, 8, 7);
    d.rod(at(u, v, -0.032), at(u, v - 2, -0.046), 0.002, m.metal);
  }
  text('--', 1082, 280, 5, amber);
  const hud = [
    [1030, 205],
    [1034, 134],
    [1052, 124],
    [1099, 124],
    [1110, 139],
    [1113, 204],
  ].map((p) => at(...p, -0.12));
  sheet(d, hud, m.glass, [0, 0, -1]);
  outline(d, hud, 0.009, black);
  box(1071, 210, 81, 17, black, 0.13);
  box(1071, 520, 80, 65);
  for (let j = 0; j < 6; j++) box(1071, 498 + j * 9, 52, 4, panel);
  text('ENVIRONMENT', 1071, 553, 4);
  for (const [u, v] of [
    [837, 448],
    [1291, 439],
  ]) {
    box(u, v, 44, 89);
    for (let row = 0; row < 9; row++)
      for (let col = 0; col < 3; col++) box(u - 13 + col * 13, v - 33 + row * 8, 10, 5, panel);
    text('CAUTION', u, v - 49, 4);
  }
  box(900, 467, 46, 41);
  text('GEAR', 900, 455, 4);
  for (let j = 0; j < 3; j++) {
    const g = group(cabin, `F15-gear-lamp-${j}`, at(888 + j * 12, 470, -0.032)),
      gd = detailKit(g, g.name);
    gd.box([0.013, 0.013, 0.003], [0, 0, 0], d.green);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  // Tub, ACES II seat, harness, side consoles. Top-facing labels follow console mounting.
  d.box([0.84, 0.035, 2.9], [0, 1.98, 6.22], black);
  for (const side of [-1, 1]) {
    sheet(
      d,
      [
        [side * 0.48, 1.98, 4.75],
        [side * 0.48, 1.98, 7.75],
        [side * 0.48, 2.68, 7.75],
        [side * 0.48, 2.68, 4.75],
      ],
      panel,
      [-side, 0, 0],
    );
    d.box([0.22, 0.28, 1.8], [side * 0.42, 2.27, 6.25], panel);
    const cg = group(cabin, `F15-console-${side}`, [side * 0.42, 2.42, 6.25]);
    cg.rotation.x = Math.PI / 2;
    const cd = detailKit(cg, cg.name);
    for (let j = 0; j < 6; j++) {
      cd.box([0.19, 0.245, 0.012], [0, -0.69 + j * 0.27, 0], black);
      cd.text(
        (side === 1
          ? ['LIGHT', 'COMM', 'SAS', 'ILS', 'RADAR', 'AUDIO']
          : ['ENGINE', 'NAV', 'POWER', 'ECS', 'OXY', 'TEST'])[j],
        [0, -0.74 + j * 0.27, -0.009],
        0.018,
        Math.PI,
        ink,
      );
      for (let q = 0; q < 3; q++) {
        cd.rod(
          [-0.06 + q * 0.06, -0.66 + j * 0.27, -0.01],
          [-0.06 + q * 0.06, -0.66 + j * 0.27, -0.034],
          0.004,
          m.metal,
        );
        cd.add(new T.CylinderGeometry(0.009, 0.01, 0.012, 10).rotateX(Math.PI / 2), panel, [
          -0.06 + q * 0.06,
          -0.6 + j * 0.27,
          -0.017,
        ]);
      }
    }
    cd.finish();
  }
  const sg = group(cabin, 'F15-ACES-II', [0, 2.25, 5.97]);
  sg.rotation.x = -0.23;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.5, 0.12, 0.52], [0, 0, 0.2], seat);
  beveledBox(sd, [0.48, 0.77, 0.13], [0, 0.41, -0.07], seat);
  beveledBox(sd, [0.32, 0.29, 0.17], [0, 0.96, -0.07], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.27, -0.1, -0.17], [side * 0.27, 1.13, -0.17], 0.023, m.metal);
    sheet(
      sd,
      [
        [side * 0.1, 0.76, 0.01],
        [side * 0.15, 0.76, 0.01],
        [side * 0.08, 0.12, 0.1],
        [side * 0.03, 0.12, 0.1],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.12, 0.035, 0.28], [side * 0.21, 0.08, 0.18], belt);
  }
  sd.box([0.065, 0.04, 0.025], [0, 0.12, 0.13], m.metal);
  sd.finish();
  const stick = group(cabin, 'F15-stick', [0, 2.04, 6.72]),
    st = detailKit(stick, stick.name);
  st.rod([0, 0, 0], [0, 0.43, -0.035], 0.023, black);
  st.box([0.07, 0.11, 0.07], [0, 0.46, -0.035], black);
  st.add(new T.SphereGeometry(0.011, 8, 6), d.red, [-0.03, 0.5, -0.06]);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.23 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.24 },
  );
  for (const side of [-1, 1]) {
    const g = group(cabin, `F15-pedal-${side}`, [side * 0.14, 2.12, 7.48]),
      gd = detailKit(g, g.name);
    gd.box([0.14, 0.16, 0.04], [0, 0, 0], m.metal);
    for (let j = 0; j < 5; j++) gd.box([0.12, 0.005, 0.004], [0, -0.06 + j * 0.03, -0.023], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  for (let i = 0; i < 2; i++) {
    const g = group(cabin, `F15-throttle-${i}`, [0.37 + i * 0.07, 2.43, 6.42]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, 0.1, 0], 0.014, black);
    gd.box([0.055, 0.06, 0.09], [0, 0.11, 0], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
