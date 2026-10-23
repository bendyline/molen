/** Late F/A-18C, clean configuration. NATOPS dimensions and FO-5 cockpit.
 * Main axle datum; +Z forward, +X pilot left. See reference-review.json.
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
export const fa18Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.59,
  cy: 2.05,
  ry: 0.58,
  cabinZ: 5.7,
  cabinWidth: 0.82,
  eye: [0, 2.98, 5.7],
  panelZ: 6.65,
  floor: 1.66,
});
export function buildFA18C(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('FA18-gray', '#929da5', { side: T.DoubleSide }),
    upper = mat('FA18-upper', '#7e8b96', { side: T.DoubleSide }),
    dark = mat('FA18-seals', '#292e31'),
    metal = mat('FA18-alloy', '#aeb4b6', { metalness: 0.75 }),
    nozzle = mat('FA18-nozzle', '#696862', { metalness: 0.7, side: T.DoubleSide }),
    lining = mat('FA18-duct', '#242627', { side: T.DoubleSide }),
    glass = mat('FA18-glass', '#a6c5c9', {
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'FA18-airframe'),
    bindings = [];
  // Radome and cabin shell taper independently from the aft paired engines.
  const sections = [
    [10.9, 0.008, 1.5, 1.53],
    [10.45, 0.16, 1.43, 1.76],
    [9.8, 0.31, 1.36, 2.02],
    [9.15, 0.43, 1.34, 2.25],
    [8.5, 0.47, 1.34, 2.45],
    [7.75, 0.49, 1.34, 2.58],
    [6.6, 0.55, 1.35, 2.63],
    [5.7, 0.58, 1.35, 2.68],
    [4.0, 0.61, 1.36, 2.85],
    [3.25, 0.67, 1.35, 2.94],
    [1.4, 0.66, 1.32, 2.86],
    [-0.8, 0.58, 1.35, 2.73],
    [-3.1, 0.4, 1.55, 2.6],
    [-5.0, 0.12, 1.78, 2.46],
    [-5.7, 0.03, 1.99, 2.2],
  ];
  const rings = sections.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 24 }, (_, j) => [
      Math.sin((j * Math.PI) / 12) * w,
      (b + t) / 2 + (Math.cos((j * Math.PI) / 12) * (t - b)) / 2,
    ]),
  }));
  loft(d, rings, paint, { skip: (i, j) => i < 3 || (i >= 5 && i < 8 && (j < 5 || j >= 19)) });
  loft(d, rings.slice(0, 4), mat('FA18-radome', '#a6afb4'));
  for (const i of [3, 4, 9, 10, 12])
    outline(
      d,
      rings[i].points.map(([x, y]) => [x * 1.005, y, rings[i].z]),
      0.0025,
      dark,
    );
  const canopy = [
    [7.7, 0.025, 2.56, 2.58],
    [7.05, 0.3, 2.59, 2.86],
    [6.5, 0.42, 2.62, 3.15],
    [6.2, 0.44, 2.64, 3.2004],
    [5.45, 0.44, 2.7, 3.17],
    [4.5, 0.35, 2.78, 3.08],
    [3.9, 0.025, 2.87, 2.9],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      b + Math.sin((j * Math.PI) / 16) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  for (const i of [0, 2, 6])
    outline(
      d,
      cr[i].points.map((p) => [...p, cr[i].z]),
      i === 2 ? 0.02 : 0.013,
      paint,
      false,
    );
  for (const side of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[side], r.z]),
      0.02,
      paint,
      false,
    );
  // Shoulder patches close the shell outside the true canopy opening.
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const a = rings[5 + i],
        b = rings[6 + i],
        j = side === 1 ? 5 : 19;
      const rail = [
        [0.025, 2.56, 7.75],
        [0.42, 2.62, 6.6],
        [0.44, 2.68, 5.7],
        [0.05, 2.86, 4.0],
      ];
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
  for (let j = 0; j < 17; j++) {
    const p = cr[2].points[j];
    d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [p[0], p[1] + 0.01, 6.5]);
  }
  // Curved LEX, round-sided subsonic inlet lips and tightly paired F404 fairings.
  for (const side of [-1, 1]) {
    const lex = [
      [0.47, 2.57, 7.65, 0.46, 2.52],
      [0.7, 2.52, 6.95, 0.5, 2.49],
      [0.93, 2.45, 5.65, 0.54, 2.5],
      [1.2, 2.35, 3.75, 0.58, 2.61],
      [1.39, 2.29, 2.3, 0.59, 2.61],
    ];
    for (let i = 0; i < lex.length - 1; i++) {
      const a = lex[i],
        b = lex[i + 1];
      for (const lower of [false, true])
        quad(
          d,
          [side * a[0], a[1] - (lower ? 0.018 : 0), a[2]],
          [side * b[0], b[1] - (lower ? 0.018 : 0), b[2]],
          [side * b[3], b[4] - (lower ? 0.018 : 0), b[2]],
          [side * a[3], a[4] - (lower ? 0.018 : 0), a[2]],
          upper,
          [0, lower ? -1 : 1, 0],
        );
    }
    quad(
      d,
      [side * 0.6, 2.6, 2.3],
      [side * 1.39, 2.29, 2.3],
      [side * 1.3, 2.26, -1.81],
      [side * 0.6, 2.65, -1.81],
      upper,
      [0, 1, 0],
    );
    outline(
      d,
      lex.map((q) => [side * q[0], q[1] + 0.008, q[2]]),
      0.003,
      dark,
      false,
    );
    // LEX fence fitted to production Hornets.
    sheet(
      d,
      [
        [side * 0.99, 2.44, 2.4],
        [side * 0.99, 2.67, 2.1],
        [side * 0.99, 2.67, 1.45],
        [side * 0.99, 2.43, 1.35],
      ],
      paint,
      [side, 0, 0],
    );
    const ng = group(root, `FA18-engine-${side}`, [side * 0.58, 0, 0]),
      nd = detailKit(ng, ng.name);
    const nr = [
      [2.08, 0.55, 1.16, 2.29],
      [1.2, 0.63, 1.1, 2.39],
      [-0.7, 0.64, 1.12, 2.5],
      [-2.5, 0.6, 1.23, 2.54],
      [-4.95, 0.5, 1.49, 2.49],
    ].map(([z, w, b, t]) => ({
      z,
      points: Array.from({ length: 24 }, (_, j) => [
        Math.sin((j * Math.PI) / 12) * w,
        (b + t) / 2 + (Math.cos((j * Math.PI) / 12) * (t - b)) / 2,
      ]),
    }));
    loft(nd, nr, paint, { caps: false });
    const lip = nr[0].points.map(([x, y]) => [x, y, 2.08 + 0.1 * (y - 1.7)]),
      back = nr[0].points.map(([x, y]) => [x * 0.79, 1.75 + (y - 1.75) * 0.79, 1.2]);
    for (let j = 0; j < 24; j++)
      quad(nd, lip[j], lip[(j + 1) % 24], back[(j + 1) % 24], back[j], lining, [0, 0, 1]);
    sheet(nd, back, lining, [0, 0, 1]);
    outline(nd, lip, 0.035, paint);
    const ring = (r, z) => ({
      z,
      points: Array.from({ length: 24 }, (_, j) => [
        Math.sin((j * Math.PI) / 12) * r,
        1.99 + Math.cos((j * Math.PI) / 12) * r,
      ]),
    });
    loft(nd, [ring(0.5, -4.95), ring(0.52, -5.15), ring(0.42, -5.72)], nozzle, { caps: false });
    loft(nd, [ring(0.405, -5.72), ring(0.38, -5.03)], lining, { caps: false });
    sheet(
      nd,
      ring(0.38, -5.03).points.map((p) => [...p, -5.03]),
      lining,
      [0, 0, -1],
    );
    for (let j = 0; j < 24; j++) {
      const a = (j * Math.PI) / 12;
      nd.rod(
        [Math.sin(a) * 0.516, 1.99 + Math.cos(a) * 0.516, -5.15],
        [Math.sin(a) * 0.425, 1.99 + Math.cos(a) * 0.425, -5.72],
        0.003,
        dark,
      );
    }
    nd.finish();
    // Fixed trapezoid wing: separate leading flaps, inboard trailing flap and outer aileron.
    const stations = [
      [1.3, 2.26, 2.34, -1.81, 0.09],
      [3.95, 2.1, 1.0, -1.7, 0.065],
      [5.65, 2.0, 0.14, -1.62, 0.025],
    ];
    for (let j = 0; j < 2; j++) {
      const pair = stations.slice(j, j + 2),
        leadHinge = (q) => q[2] - 0.28 * (q[2] - q[3]),
        rearHinge = (q) => q[3] + 0.26 * (q[2] - q[3]);
      wing(
        d,
        pair.map((q) => [q[0] * side, q[1], leadHinge(q), rearHinge(q), q[4]]),
        upper,
      );
      for (const end of ['leading', 'trailing']) {
        const hinge = end === 'leading' ? leadHinge : rearHinge,
          pivot = [side * pair[0][0], pair[0][1], hinge(pair[0])],
          g = group(
            root,
            `FA18-${end === 'leading' ? 'leading' : j === 0 ? 'flap' : 'aileron'}-${side}`,
            pivot,
          ),
          gd = detailKit(g, g.name);
        wing(
          gd,
          pair.map((q) => [
            side * q[0] - pivot[0],
            q[1] - pivot[1],
            (end === 'leading' ? q[2] : hinge(q)) - pivot[2],
            (end === 'leading' ? hinge(q) : q[3]) - pivot[2],
            q[4] * 0.65,
          ]),
          upper,
        );
        gd.finish();
        bindings.push({
          node: g.name,
          source: end === 'leading' || j === 0 ? 'flapPosition' : 'rollInput',
          property: 'rotation',
          axis: 'x',
          scale: end === 'leading' ? 0.25 : j === 0 ? -0.55 : -side * 0.3,
        });
        // Two leading panels have distinct names for stable animation bindings.
        if (end === 'leading') {
          g.name += `-${j}`;
          bindings.at(-1).node = g.name;
        }
      }
      const a = pair[0],
        b = pair[1];
      outline(
        d,
        [
          [side * a[0], a[1] + a[4] + 0.002, leadHinge(a)],
          [side * b[0], b[1] + b[4] + 0.002, leadHinge(b)],
        ],
        0.003,
        dark,
        false,
      );
      for (let k = 0; k < 22; k++) {
        const t = k / 21,
          x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t,
          z = rearHinge(a) + (rearHinge(b) - rearHinge(a)) * t;
        d.add(new T.SphereGeometry(0.0032, 5, 3), metal, [side * x, y + 0.018, z + 0.04]);
      }
    }
    // Empty launch rail is part of the clean wing outline, not a missile.
    d.box([0.13, 0.1, 1.75], [side * 5.65, 2.0, -0.73], paint);
    d.box([0.04, 0.045, 1.5], [side * 5.7, 1.94, -0.73], metal);
    const tg = group(root, `FA18-stabilator-${side}`, [side * 1.05, 2.08, -3.8]),
      td = detailKit(tg, tg.name);
    wing(
      td,
      [
        [0, 0, 1.45, -1.97, 0.055],
        [side * 2.0, -0.03, -1.2, -2.3688, 0.035],
        [side * 2.24184, -0.04, -1.35, -2.25, 0.012],
      ],
      upper,
    );
    td.finish();
    bindings.push({
      node: tg.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const fg = group(root, `FA18-fin-${side}`, [side * 1.06, 2.5, -0.85]);
    fg.rotation.z = (-side * 20 * Math.PI) / 180;
    const fd = detailKit(fg, fg.name),
      height = (4.6482 - 2.5) / Math.cos((20 * Math.PI) / 180),
      contour = [
        [0, 0, 0],
        [0, height, -2.02],
        [0, height, -3.03],
        [0, height - 0.1, -3.02],
        [0, height - 0.1, -2.68],
        [0, 0.15, -2.3],
        [0, 0.15, -2.76],
        [0, 0, -2.75],
      ];
    for (const x of [-0.035, 0.035])
      sheet(
        fd,
        contour.map((p) => [x, p[1], p[2]]),
        paint,
        [Math.sign(x), 0, 0],
      );
    for (let i = 0; i < contour.length; i++)
      quad(
        fd,
        [-0.035, ...contour[i].slice(1)],
        [0.035, ...contour[i].slice(1)],
        [0.035, ...contour[(i + 1) % contour.length].slice(1)],
        [-0.035, ...contour[(i + 1) % contour.length].slice(1)],
        paint,
        [0, contour[i][1], contour[i][2]],
      );
    const rg = group(fg, `FA18-rudder-${side}`, [0, 0.15, -2.3]),
      rd = detailKit(rg, rg.name);
    sheet(
      rd,
      [
        [0, 0, 0],
        [0, height - 0.25, -0.38],
        [0, height - 0.25, -0.72],
        [0, 0, -0.46],
      ],
      upper,
      [1, 0, 0],
    );
    rd.finish();
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.38,
    });
    fd.rod([side * 0.041, 0.15, -2.3], [side * 0.041, height - 0.1, -2.68], 0.003, dark);
    for (let j = 0; j < 3; j++)
      fd.rod(
        [0, height - 0.07 - j * 0.13, -2.9],
        [0, height - 0.07 - j * 0.13, -3.13],
        0.035,
        paint,
      );
    fd.text('NAVY', [side * 0.042, 0.63, -1.75], 0.17, (side * Math.PI) / 2, dark);
    fd.finish();
    // Retractable main gear: wide trailing arm and one wheel per side.
    const gg = group(root, `FA18-gear-${side}`, [side * 0.66, 1.35, 0.22]),
      gd = detailKit(gg, gg.name);
    gd.rod([0, 0, 0], [side * 0.35, -0.68, -0.05], 0.055, metal);
    gd.rod([side * 0.35, -0.68, -0.05], [side * 0.82, -0.96, -0.22], 0.065, paint);
    gd.rod([0, -0.1, 0.48], [side * 0.4, -0.68, -0.05], 0.035, metal);
    gd.add(new T.CylinderGeometry(0.39, 0.39, 0.23, 24).rotateZ(Math.PI / 2), dark, [
      side * 0.82,
      -0.96,
      -0.22,
    ]);
    gd.add(new T.CylinderGeometry(0.23, 0.23, 0.24, 24).rotateZ(Math.PI / 2), metal, [
      side * 0.82,
      -0.96,
      -0.22,
    ]);
    const door = group(gg, `FA18-main-door-${side}`),
      doorKit = detailKit(door, door.name);
    doorKit.box([0.035, 0.6, 0.75], [side * 0.11, -0.23, 0.1], paint);
    doorKit.finish();
    bindings.push({ node: door.name, source: 'gearExposed', property: 'visible', scale: 1 });
    gd.finish();
    bindings.push({
      node: gg.name,
      source: 'gear',
      property: 'rotation',
      axis: 'x',
      scale: Math.PI / 2,
      offset: -Math.PI / 2,
    });
    bindings.push({
      node: gg.name,
      source: 'gear',
      property: 'position',
      axis: 'x',
      scale: side * 0.7,
      offset: -side * 0.7,
    });
    bindings.push({
      node: gg.name,
      source: 'gear',
      property: 'position',
      axis: 'y',
      scale: -0.8,
      offset: 0.8,
    });
    // Once shut, the opaque bay hides the assembly; do not render it through the cabin tub.
    bindings.push({ node: gg.name, source: 'gearExposed', property: 'visible', scale: 1 });
  }
  const ng = group(root, 'FA18-gear-nose', [0, 1.4, 5.38]),
    nd = detailKit(ng, ng.name);
  nd.rod([0, 0, 0], [0, -1.08, 0], 0.052, metal);
  nd.rod([0, -0.15, -0.7], [0, -0.78, 0], 0.035, metal);
  for (const side of [-1, 1]) {
    nd.add(new T.CylinderGeometry(0.32, 0.32, 0.13, 24).rotateZ(Math.PI / 2), dark, [
      side * 0.13,
      -1.08,
      0,
    ]);
    nd.add(new T.CylinderGeometry(0.19, 0.19, 0.14, 20).rotateZ(Math.PI / 2), metal, [
      side * 0.13,
      -1.08,
      0,
    ]);
  }
  nd.rod([0, -0.76, 0.06], [0, -1.02, 0.42], 0.03, metal);
  const noseDoor = group(ng, 'FA18-nose-door'),
    noseDoorKit = detailKit(noseDoor, noseDoor.name);
  noseDoorKit.box([0.03, 0.65, 0.85], [0.23, -0.25, -0.24], paint);
  noseDoorKit.finish();
  bindings.push({ node: noseDoor.name, source: 'gearExposed', property: 'visible', scale: 1 });
  nd.finish();
  bindings.push({
    node: ng.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    scale: Math.PI / 2,
    offset: -Math.PI / 2,
  });
  bindings.push({
    node: ng.name,
    source: 'gear',
    property: 'position',
    axis: 'y',
    scale: -0.75,
    offset: 0.75,
  });
  bindings.push({ node: ng.name, source: 'gearExposed', property: 'visible', scale: 1 });
  d.rod([0, 1.43, -3.0], [0, 1.2, -5.2], 0.029, metal);
  d.rod([0, 1.2, -5.2], [0, 1.25, -5.43], 0.045, metal);
  // Speed-brake outline, spine antennae, access seams and selected maintenance marks.
  outline(
    d,
    [
      [-0.4, 2.62, -2.4],
      [0.4, 2.62, -2.4],
      [0.35, 2.49, -4.6],
      [-0.35, 2.49, -4.6],
    ],
    0.004,
    dark,
  );
  for (const z of [3.5, 1.4])
    sheet(
      d,
      [
        [0, 2.92, z + 0.15],
        [0, 3.14, z + 0.1],
        [0, 3.1, z - 0.12],
        [0, 2.9, z - 0.18],
      ],
      paint,
      [1, 0, 0],
    );
  for (const side of [-1, 1]) {
    d.text('RESCUE', [side * 0.505, 2.23, 7.55], 0.09, (side * Math.PI) / 2, dark);
    d.text('DANGER', [side * 0.96, 1.66, 2.2], 0.095, (side * Math.PI) / 2, dark);
    for (let i = 0; i < canopy.length - 1; i++)
      for (let j = 0; j < 5; j++) {
        const a = canopy[i],
          b = canopy[i + 1],
          t = j / 5;
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t),
          a[2] + (b[2] - a[2]) * t + 0.018,
          a[0] + (b[0] - a[0]) * t,
        ]);
      }
    for (let j = 0; j < 5; j++)
      d.box([0.008, 0.035, 0.09], [side * 0.5, 1.88, 8.8 - j * 0.13], dark);
  }
  d.finish();
  const interior = fa18Cockpit(root, { paint, dark, metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.3] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.13] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: fa18Frame(),
    enginePoints: [
      { id: 'engine-1', position: [0.58, 1.99, -4.9] },
      { id: 'engine-2', position: [-0.58, 1.99, -4.9] },
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

function fa18Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'FA18-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'FA18'),
    { bindings, derived, ink, black, amber } = ins;
  const panel = mat('FA18-panel', '#51595c', { side: T.DoubleSide }),
    seat = mat('FA18-seat', '#60634a'),
    belt = mat('FA18-harness', '#919583'),
    green = mat('FA18-display', '#71d488', { emissive: '#2a6038', emissiveIntensity: 0.7 });
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
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  // Measured positions in 1978px FO-5 foldout; 130px active DDI width = nominal5in.
  const k = 0.127 / 130,
    z = 6.65,
    at = (u, v, dz = 0) => [(707 - u) * k, 2.43 - (v - 550) * k, z + dz];
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
      d.box([w * k, h * k, depth], at(u, v, -0.02 + depth / 2), material),
    text = (t, u, v, h = 7, material = ink) =>
      d.text(t, at(u, v, -0.027), h * k, Math.PI, material);
  const edge = [
    [345, 620],
    [345, 448],
    [392, 381],
    [451, 332],
    [524, 302],
    [604, 287],
    [808, 287],
    [880, 303],
    [958, 341],
    [1027, 399],
    [1069, 460],
    [1069, 782],
    [815, 782],
    [815, 1125],
    [597, 1125],
    [597, 782],
    [345, 782],
  ];
  sheet(
    d,
    edge.map((p) => at(...p)),
    panel,
    [0, 0, -1],
    [circle(887, 652, 38), rect(499, 451, 87, 62)],
  );
  outline(
    d,
    edge.map((p) => at(...p, -0.003)),
    0.006,
    black,
  );
  // Coaming continues forward from the arched upper edge rather than a flat box.
  const arc = edge.slice(1, 13);
  for (let j = 0; j < arc.length - 1; j++) {
    const a = at(...arc[j]),
      b = at(...arc[j + 1]);
    quad(
      d,
      a,
      b,
      [b[0], b[1] - 0.02, b[2] + 0.25],
      [a[0], a[1] - 0.02, a[2] + 0.25],
      black,
      [0, 1, 0],
    );
  }
  const display = (u, v, w, h, label, hole = false) => {
    sheet(
      d,
      rect(u, v, w, h, -0.008),
      black,
      [0, 0, -1],
      hole ? [rect(u, v - 5, 87, 62, -0.008)] : [],
    );
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++) {
        box(u + side * (w / 2 - 9), v - h * 0.3 + j * h * 0.15, 13, 17, panel);
        box(u - w * 0.3 + j * w * 0.15, v + side * (h / 2 - 9), 17, 13, panel);
      }
    for (const side of [-1, 1])
      d.add(
        new T.CylinderGeometry(0.008, 0.009, 0.014, 12).rotateX(Math.PI / 2),
        panel,
        at(u + side * (w / 2 - 11), v + h / 2 + 17, -0.03),
      );
    text(label, u, v - h * 0.37, 6, green);
  };
  display(499, 456, 192, 188, 'ATT / SIM', true);
  ins.horizon('DDI-attitude', at(499, 451, 0.012), 0.085, 0.06, { blankBackdrop: true });
  ins.readout('DDI-speed', at(458, 510, -0.028), 'knots', 3, 0.01, green);
  text('TAS', 458, 497, 5, green);
  ins.readout('DDI-altitude', at(535, 510, -0.028), 'feet', 5, 0.008, green, true, true);
  text('GEO FT', 535, 497, 5, green);
  display(920, 456, 192, 188, 'DDI');
  text('INOP', 920, 456, 13, amber);
  display(710, 722, 181, 175, 'MPCD');
  // Simplified true-heading presentation, no invented map or navigation solution.
  const hg = group(cabin, 'FA18-heading', at(710, 714, -0.029)),
    hd = detailKit(hg, hg.name);
  for (let j = 0; j < 72; j++) {
    const a = (j * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(j % 6 ? 0.05 : 0.045), p(0.055), 0.0006, green);
    if (j % 6 === 0) hd.text(String(j / 2), p(0.035), 0.007, Math.PI, green);
  }
  hd.finish();
  bindings.push({
    node: hg.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: Math.PI * 2,
  });
  ins.available('heading', 'trueHeading', hg.name);
  text('TRUE', 710, 782, 6, green);
  d.rod(at(710, 653, -0.03), at(710, 665, -0.03), 0.001, ink);
  ins.horizon('standby', at(887, 652, 0.01), 0.068, 0.068, { round: true, blankBackdrop: true });
  ins.dial(
    'standby-speed',
    at(866, 738, -0.007),
    32 * k,
    'knots',
    [
      [0, 0],
      [100, 0.65],
      [200, 1.55],
      [300, 2.65],
      [400, 3.7],
      [600, 4.8],
      [800, 5.6],
    ],
    [0, 100, 200, 300, 400, 600, 800],
    'TAS',
    { tickLabels: { 0: 0, 100: 1, 200: 2, 300: 3, 400: 4, 600: 6, 800: 8 }, minorStep: 20 },
  );
  ins.altimeter('standby-altitude', at(939, 738, -0.007), 32 * k, 'feet');
  ins.dial(
    'vertical-speed',
    at(1018, 738, -0.007),
    32 * k,
    'verticalFpm',
    [
      [-6000, -Math.PI / 2],
      [0, Math.PI / 2],
      [6000, Math.PI * 1.5],
    ],
    [-6000, -4000, -2000, 0, 2000, 4000, 6000],
    'FPM',
    { tickLabels: { '-6000': -6, '-4000': -4, '-2000': -2, 0: 0, 2000: 2, 4000: 4, 6000: 6 } },
  );
  pt.gauge(...at(997, 652).slice(0, 2), z - 0.008, 43 * k, black, false);
  text('RWR', 997, 640, 7);
  text('INOP', 997, 660, 8, amber);
  // UFC keypad, five option fields, scratchpad and physical radio controls.
  box(710, 394, 190, 124);
  box(674, 351, 64, 18, panel);
  text('----', 674, 351, 8, green);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) {
      const u = 653 + col * 21,
        v = 374 + row * 21;
      box(u, v, 16, 16, panel);
      text(
        [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['CLR', '0', 'ENT'],
        ][row][col],
        u,
        v,
        row === 3 ? 4 : 7,
      );
    }
  for (let j = 0; j < 5; j++) {
    box(750, 352 + j * 21, 45, 15, panel);
    text('--', 750, 352 + j * 21, 6, green);
    d.add(
      new T.CylinderGeometry(0.005, 0.006, 0.012, 10).rotateX(Math.PI / 2),
      panel,
      at(717, 352 + j * 21, -0.03),
    );
  }
  for (const u of [630, 786])
    for (const v of [360, 405, 442])
      d.add(
        new T.CylinderGeometry(0.006, 0.007, 0.012, 10).rotateX(Math.PI / 2),
        panel,
        at(u, v, -0.03),
      );
  box(710, 477, 194, 27);
  for (let j = 0; j < 7; j++) {
    box(652 + j * 21, 471, 16, 16, panel);
    text(['AP', 'IFF', 'TCN', 'ILS', 'DL', 'BCN', 'ON'][j], 652 + j * 21, 471, 4);
  }
  box(710, 530, 196, 64);
  text('HUD', 710, 501, 6);
  for (let j = 0; j < 6; j++) {
    const u = 638 + j * 29;
    d.add(
      new T.CylinderGeometry(0.006, 0.007, 0.013, 10).rotateX(Math.PI / 2),
      panel,
      at(u, 523, -0.03),
    );
    text(['BRT', 'ATT', 'ALT', 'W/B', 'VID', 'SYM'][j], u, 539, 4);
  }
  // IFEI has no corresponding engine-core/fuel telemetry: leave its cells unavailable.
  box(495, 670, 194, 142);
  text('L   ENGINE   R', 455, 613, 7);
  text('FUEL', 557, 613, 7);
  for (const [v, label] of [
    [635, 'RPM'],
    [657, 'TEMP'],
    [679, 'FF'],
    [701, 'NOZ'],
  ]) {
    text(label, 455, v, 6);
    text('--', 425, v, 7, amber);
    text('--', 482, v, 7, amber);
  }
  text('-----', 555, 648, 10, amber);
  text('TIME --', 553, 706, 7, amber);
  for (const [u, v, w, h, label] of [
    [378, 481, 35, 126, 'ARM'],
    [1042, 491, 40, 118, 'MAP'],
    [373, 675, 43, 147, 'GEAR'],
    [710, 927, 187, 100, 'ECM'],
    [1140, 974, 69, 150, 'HYD'],
  ]) {
    box(u, v, w, h);
    text(label, u, v - h * 0.36, 5);
    text('--', u, v, 8, amber);
  }
  for (let j = 0; j < 3; j++) {
    const g = group(cabin, `FA18-gear-lamp-${j}`, at(365 + j * 9, 746, -0.029)),
      gd = detailKit(g, g.name);
    gd.box([0.006, 0.006, 0.002], [0, 0, 0], green);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  for (const [u, v, label] of [
    [498, 328, 'L FIRE'],
    [890, 328, 'APU'],
    [914, 328, 'R FIRE'],
    [530, 327, 'CAUTION'],
  ]) {
    box(u, v, 22, 18);
    text(label, u, v, 3);
  }
  for (const u of [567, 845])
    for (let row = 0; row < 5; row++) {
      box(u, 313 + row * 9, 33, 7);
      text('--', u, 313 + row * 9, 4);
    }
  // HUD glass is a physical combiner. Symbology needs a separate collimated implementation.
  const hud = [
    [616, 278],
    [624, 193],
    [788, 193],
    [800, 278],
  ].map((p) => at(...p, -0.1));
  sheet(d, hud, m.glass, [0, 0, -1]);
  outline(d, hud, 0.006, black);
  box(707, 285, 203, 12, black, 0.12);
  for (const side of [-1, 1])
    d.rod(at(707 + side * 89, 281, -0.11), at(707 + side * 80, 197, -0.11), 0.008, m.metal);
  for (const [u, v, r, label] of [
    [778, 990, 33, 'CLOCK'],
    [778, 1060, 33, 'CABIN'],
    [1141, 929, 26, 'RADALT'],
    [1140, 1004, 24, 'HYD'],
  ]) {
    pt.gauge(...at(u, v).slice(0, 2), z - 0.009, r * k, black, false);
    text(label, u, v - 6, 5);
    text('--', u, v + 8, 7, amber);
  }
  // Distinct console layout from FO-5 sheet2: throttle and communication left; power/ECS/lights right.
  d.box([0.82, 0.03, 2.45], [0, 1.66, 5.5], black);
  for (const side of [-1, 1]) {
    sheet(
      d,
      [
        [side * 0.44, 1.66, 4.2],
        [side * 0.44, 1.66, 6.8],
        [side * 0.44, 2.48, 6.8],
        [side * 0.44, 2.5, 4.2],
      ],
      panel,
      [-side, 0, 0],
    );
    d.box([0.2, 0.22, 1.65], [side * 0.33, 1.96, 5.55], panel);
    const cg = group(cabin, `FA18-console-${side}`, [side * 0.33, 2.075, 5.55]);
    cg.rotation.x = Math.PI / 2;
    const cd = detailKit(cg, cg.name);
    const labels =
      side === 1
        ? ['OBOGS', 'COMM', 'FCS', 'FUEL', 'THROTTLE', 'POWER']
        : ['NVG', 'SENSOR', 'SYSTEM', 'LIGHT', 'ECS', 'ELECT'];
    for (let j = 0; j < 6; j++) {
      const y = -0.68 + j * 0.26;
      cd.box([0.185, 0.24, 0.012], [0, y, 0], black);
      cd.text(labels[j], [0, y + 0.08, -0.009], 0.014, Math.PI, ink);
      const toggle = (x, v) => cd.rod([x, v, -0.01], [x, v + 0.005, -0.032], 0.003, m.metal);
      const knob = (x, v, r = 0.008) => {
        cd.add(new T.CylinderGeometry(r, r * 1.12, 0.01, 10).rotateX(Math.PI / 2), panel, [
          x,
          v,
          -0.016,
        ]);
        cd.rod([x, v, -0.022], [x, v + r * 0.7, -0.022], 0.0007, ink);
      };
      const label = labels[j];
      if (label === 'NVG') {
        cd.box([0.15, 0.17, 0.018], [0, y - 0.015, -0.015], panel);
        cd.box([0.018, 0.035, 0.01], [0.055, y - 0.015, -0.029], m.metal);
      } else if (label === 'THROTTLE') {
        for (const x of [-0.035, 0.035])
          cd.box([0.016, 0.17, 0.003], [x, y - 0.015, -0.009], panel);
      } else if (label === 'COMM' || label === 'LIGHT') {
        for (let row = 0; row < 2; row++)
          for (let q = 0; q < 3; q++) knob(-0.055 + q * 0.055, y - 0.06 + row * 0.08);
      } else if (label === 'ECS') {
        knob(0, y + 0.025, 0.016);
        for (const x of [-0.055, 0.055]) {
          toggle(x, y + 0.025);
          knob(x, y - 0.06);
        }
      } else if (label === 'FCS') {
        knob(-0.035, y - 0.01, 0.015);
        toggle(0.045, y - 0.03);
        cd.text('TRIM', [-0.035, y - 0.07, -0.012], 0.009, Math.PI, ink);
      } else if (label === 'OBOGS') {
        knob(0.04, y - 0.025, 0.014);
        toggle(-0.045, y - 0.025);
      } else {
        for (let q = 0; q < (label === 'POWER' ? 4 : 3); q++) {
          const x = label === 'POWER' ? -0.055 + (q % 2) * 0.11 : -0.055 + q * 0.055;
          toggle(x, y - 0.05 + (label === 'POWER' ? Math.floor(q / 2) * 0.075 : 0));
        }
        if (label !== 'POWER') knob(0, y + 0.025, 0.012);
      }
    }
    cd.finish();
  }
  const sg = group(cabin, 'FA18-SJU17', [0, 1.91, 5.13]);
  sg.rotation.x = -0.2;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.45, 0.12, 0.49], [0, 0, 0.2], seat);
  beveledBox(sd, [0.43, 0.72, 0.13], [0, 0.4, -0.07], seat);
  beveledBox(sd, [0.31, 0.25, 0.17], [0, 0.94, -0.07], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.24, -0.1, -0.15], [side * 0.24, 1.08, -0.15], 0.024, m.metal);
    sheet(
      sd,
      [
        [side * 0.1, 0.74, 0.01],
        [side * 0.15, 0.74, 0.01],
        [side * 0.08, 0.12, 0.1],
        [side * 0.03, 0.12, 0.1],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.13, 0.035, 0.23], [side * 0.17, 0.09, 0.17], belt);
  }
  sd.box([0.06, 0.04, 0.025], [0, 0.12, 0.15], m.metal);
  sd.ring(0.045, 0.009, [0, 0.13, 0.43], amber);
  sd.finish();
  const stick = group(cabin, 'FA18-stick', [0, 1.72, 5.95]),
    st = detailKit(stick, stick.name);
  st.rod([0, 0, 0], [0, 0.35, -0.04], 0.022, black);
  beveledBox(st, [0.075, 0.115, 0.07], [0, 0.41, -0.05], black, 0.01);
  for (const p of [
    [-0.025, 0.46, -0.08],
    [0.025, 0.45, -0.08],
    [0, 0.42, -0.09],
  ])
    st.add(new T.SphereGeometry(0.009, 8, 6), panel, p);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.22 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.22 },
  );
  for (const side of [-1, 1]) {
    const g = group(cabin, `FA18-pedal-${side}`, [side * 0.13, 1.78, 6.67]),
      gd = detailKit(g, g.name);
    gd.box([0.13, 0.15, 0.035], [0, 0, 0], m.metal);
    for (let j = 0; j < 5; j++) gd.box([0.11, 0.004, 0.004], [0, -0.06 + j * 0.03, -0.02], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  for (let j = 0; j < 2; j++) {
    const g = group(cabin, `FA18-throttle-${j}`, [0.28 + j * 0.07, 2.1, 5.91]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, 0.1, 0], 0.012, black);
    gd.box([0.06, 0.05, 0.09], [0, 0.11, 0], black);
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
