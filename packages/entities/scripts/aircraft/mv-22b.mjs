/** MV-22B, from the USAF rescue arrangement and cited cockpit photography.
 * Geometry is original; dimensions without an independent drawing remain estimates. */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  ellipsoid,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';
export const mv22Frame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 1.27,
  cy: 1.9,
  ry: 1.3,
  cabinZ: 5.85,
  cabinWidth: 2.1,
  eye: [0.62, 2.4, 5.65],
  panelZ: 6.65,
  floor: 1.05,
});
const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
function hingedWing(root, name, stations, material, bindings, source, scale) {
  const a = stations[0],
    b = stations.at(-1),
    mount = group(root, `${name}-mount`, a.slice(0, 3)),
    g = group(mount, name);
  mount.quaternion.setFromUnitVectors(
    new T.Vector3(1, 0, 0),
    new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(),
  );
  const inv = new T.Matrix4()
      .compose(mount.position, mount.quaternion, new T.Vector3(1, 1, 1))
      .invert(),
    temp = new T.Group(),
    d = detailKit(temp, name);
  wing(d, stations, material);
  d.finish();
  for (const n of [...temp.children]) {
    n.traverse((m) => {
      if (m.isMesh) m.geometry.applyMatrix4(inv);
    });
    g.add(n);
  }
  bindings.push({ node: name, source, property: 'rotation', axis: 'x', scale });
}
export function buildMV22(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('MV22-airframe', '#89989a', { side: T.DoubleSide }),
    dark = mat('MV22-trim', '#253238', { side: T.DoubleSide }),
    metal = mat('MV22-alloy', '#a9b1b3', { metalness: 0.7 }),
    seam = mat('MV22-seams', '#58696c'),
    rubber = mat('MV22-tires', '#171b1e'),
    glass = mat('MV22-glass', '#9cb9c4', {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'MV22-exterior'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  // Side-profile coordinates in the 1780px-wide rescue-manual raster. The illustrated
  // section widths are reconstructed from the independent frontal photo and plan view.
  const ppm = 1222 / 17.48,
    sz = (u) => 8.74 - (u - 318) / ppm,
    sy = (v) => (1162 - v) / ppm;
  const sections = [
    [318, 0.04, 1071, 1057],
    [352, 0.39, 1116, 1048],
    [400, 0.78, 1127, 1032],
    [450, 1.08, 1130, 966],
    [525, 1.25, 1130, 952],
    [660, 1.27, 1127, 947],
    [850, 1.27, 1123, 936],
    [1100, 1.25, 1116, 943],
    [1250, 1.15, 1090, 938],
    [1380, 0.95, 991, 920],
    [1480, 0.8, 947, 918],
    [1540, 0.03, 929, 924],
  ];
  const rings = sections.map(([u, w, b, t]) => {
    const top = sy(t),
      bottom = sy(b),
      h = top - bottom;
    return {
      z: sz(u),
      points: [
        [0, top],
        [w * 0.55, top - h * 0.025],
        [w * 0.88, top - h * 0.12],
        [w, top - h * 0.3],
        [w, bottom + h * 0.3],
        [w * 0.87, bottom + h * 0.1],
        [w * 0.5, bottom + h * 0.025],
        [0, bottom],
        [-w * 0.5, bottom + h * 0.025],
        [-w * 0.87, bottom + h * 0.1],
        [-w, bottom + h * 0.3],
        [-w, top - h * 0.3],
        [-w * 0.88, top - h * 0.12],
        [-w * 0.55, top - h * 0.025],
      ],
    };
  });
  loft(d, rings, paint, { skip: (i, j) => i >= 2 && i < 5 && (j < 3 || j >= 11) });
  const p = (i, j) => [...rings[i].points[(j + 14) % 14], rings[i].z];
  const bot = [
      [0, 2.13, 7.22],
      [0.81, 2.13, 7.1],
      [1.17, 2.14, 6.22],
      [1.25, 2.13, 5.45],
    ],
    top = [
      [0, 3.01, 6.42],
      [0.77, 3.0, 6.34],
      [1.11, 3.05, 5.94],
      [1.22, 3.02, 5.45],
    ];
  for (const side of [-1, 1]) {
    const b = bot.map((q) => [side * q[0], q[1], q[2]]),
      t = top.map((q) => [side * q[0], q[1], q[2]]);
    sheet(
      d,
      [
        p(2, 0),
        p(2, side),
        p(2, 2 * side),
        p(2, 3 * side),
        p(3, 3 * side),
        p(4, 3 * side),
        p(5, 3 * side),
        ...b.slice().reverse(),
      ],
      paint,
      [side * 0.4, 0.7, 0.5],
    );
    sheet(d, [...t, p(5, 2 * side), p(5, side), p(5, 0)], paint, [side * 0.3, 1, 0]);
    quad(d, b[3], t[3], p(5, 2 * side), p(5, 3 * side), paint, [side, 0, 0]);
    for (let j = 0; j < 3; j++) {
      quad(d, b[j], b[j + 1], t[j + 1], t[j], glass, [side * 0.4, 0.4, 1]);
      outline(d, [b[j], b[j + 1], t[j + 1], t[j]], 0.022, dark);
    }
    d.rod([side * 0.35, 2.17, 7.2], [side * 0.65, 2.58, 6.8], 0.012, dark);
    d.rod([side * 0.65, 2.58, 6.8], [side * 0.81, 2.86, 6.49], 0.01, dark);
  }
  // Distinct bulbous main-gear/fuel sponsons, tapering toward both ends.
  for (const side of [-1, 1]) {
    const rr = [
      [5.9, 0.04, 1.3, 0.05],
      [4.9, 0.56, 1.27, 0.5],
      [2.9, 0.93, 1.23, 0.58],
      [-0.7, 0.94, 1.23, 0.6],
      [-2.5, 0.69, 1.3, 0.48],
      [-4.35, 0.035, 1.65, 0.05],
    ].map(([z, rx, y, ry]) => ({
      z,
      points: Array.from({ length: 16 }, (_, j) => [
        side * 1.38 + Math.sin((j * Math.PI) / 8) * rx,
        y + Math.cos((j * Math.PI) / 8) * ry,
      ]),
    }));
    loft(d, rr, paint);
  }
  ellipsoid(d, [0, 3.3, 1.9], [1.26, 0.6, 2.3], paint, 24);
  // Forward-swept wing, with substantial downward flaperons in hover.
  const ws = [
    [0, 3.55, 2.8, 0.18, 0.18],
    [1.3, 3.57, 2.88, 0.31, 0.18],
    [4, 3.76, 3.24, 0.94, 0.15],
    [7.09, 3.97, 3.66, 1.6, 0.13],
  ];
  for (const side of [-1, 1]) {
    wing(
      d,
      ws.map(([x, y, le, te, h]) => [x * side, y, le, le + (te - le) * 0.69, h]),
      paint,
    );
    for (const [j, lo, hi] of [
      [0, 1.3, 3.98],
      [1, 4.02, 7.05],
    ]) {
      const at = (x) => {
        let i = ws.findIndex((a) => a[0] >= x);
        i = Math.max(i, 1);
        const a = ws[i - 1],
          b = ws[i],
          t = (x - a[0]) / (b[0] - a[0]),
          r = a.map((v, k) => v + (b[k] - v) * t);
        return [x * side, r[1], r[2] + (r[3] - r[2]) * 0.69, r[3], 0.035];
      };
      hingedWing(
        root,
        `MV22-flaperon-${side}-${j}`,
        [at(lo), at(hi)],
        paint,
        bindings,
        side > 0 ? 'leftFlaperon' : 'rightFlaperon',
        -side,
      );
    }
    for (const x of [1.7, 2.8, 4, 5.4, 6.7]) {
      const t = x / 7.09;
      d.rod(
        [side * x, 3.55 + t * 0.42 + 0.14, 2.8 + t * 0.86 - 0.12],
        [
          side * x,
          3.55 + t * 0.42 + 0.1,
          2.8 + t * 0.86 + (0.2 + t * 1.4 - (2.8 + t * 0.86)) * 0.64,
        ],
        0.006,
        seam,
      );
    }
    const tip = group(root, `MV22-wingtip-${side}`, [side * 6.88, 4, 2.5]),
      td = detailKit(tip, tip.name);
    td.add(new T.CylinderGeometry(0.44, 0.44, 0.28, 24).rotateZ(Math.PI / 2), metal);
    td.finish();
  }
  // Tailplane and two tall fins. Their finite thickness survives close edge-on views.
  for (const side of [-1, 1]) {
    const hs = [
      [0, 3.27, -6.32, -8.55, 0.08],
      [2.77, 3.28, -6.12, -8.5, 0.06],
    ];
    wing(
      d,
      hs.map(([x, y, le, te, h]) => [side * x, y, le, -7.85, h]),
      paint,
    );
    hingedWing(
      root,
      `MV22-elevator-${side}`,
      hs.map(([x, y, le, te]) => [side * x, y, -7.85, te, 0.025]),
      paint,
      bindings,
      'pitchInput',
      side * 0.35,
    );
    const contour = [
      [2.77, 2.55, -6.25],
      [2.77, 3.4, -6.04],
      [2.77, 5.47, -6.62],
      [2.77, 5.46, -7.83],
      [2.77, 2.5, -7.83],
    ].map(([x, y, z]) => [side * x, y, z]);
    for (const off of [-0.075, 0.075])
      sheet(
        d,
        contour.map(([x, y, z]) => [x + off, y, z]),
        paint,
        [Math.sign(off), 0, 0],
      );
    for (let j = 0; j < contour.length; j++) {
      const a = contour[j],
        b = contour[(j + 1) % contour.length];
      quad(
        d,
        [a[0] - 0.075, a[1], a[2]],
        [b[0] - 0.075, b[1], b[2]],
        [b[0] + 0.075, b[1], b[2]],
        [a[0] + 0.075, a[1], a[2]],
        paint,
        [0, 1, 1],
      );
    }
    const g = group(root, `MV22-rudder-${side}`, [side * 2.77, 2.53, -7.83]),
      dd = detailKit(g, g.name);
    beveledBox(dd, [0.12, 2.93, 0.64], [0, 1.46, -0.32], paint, 0.025);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: -0.35,
    });
    ellipsoid(d, [side * 2.77, 5.48, -7.6], [0.055, 0.055, 0.1], d.red, 8);
  }
  // Nacelles are authored in airplane coordinates, then rotated as complete assemblies.
  // Each propeller retains a separate local Z rotation inside the moving nacelle.
  for (const [i, side] of [1, -1].entries()) {
    const id = `engine-${i + 1}`,
      g = group(root, `MV22-nacelle-${i + 1}`, [side * 7.09, 3.97, 2.1]),
      nd = detailKit(g, g.name);
    g.rotation.x = -Math.PI / 2;
    const nr = [
      [-2.15, 0.36, 0.3, -0.1],
      [-1.72, 0.52, 0.49, -0.06],
      [-0.8, 0.63, 0.69, 0],
      [0.6, 0.63, 0.7, 0.03],
      [1.45, 0.55, 0.62, 0.03],
      [2.1, 0.4, 0.43, 0],
      [2.36, 0.28, 0.29, 0],
    ].map(([z, rx, ry, y]) => ({
      z,
      points: Array.from({ length: 20 }, (_, j) => [
        Math.sin((j * Math.PI) / 10) * rx,
        y + Math.cos((j * Math.PI) / 10) * ry,
      ]),
    }));
    loft(nd, nr, paint, { caps: false });
    nd.box([0.57, 0.53, 0.18], [0, -0.05, -2.16], dark);
    outline(nd, rect(0, -0.05, 0.61, 0.57, -2.27), 0.022, metal);
    ellipsoid(nd, [0, -0.48, -1.35], [0.37, 0.2, 0.43], dark, 16);
    for (const z of [-1.35, 0.45, 1.5]) {
      const r = z < 0 ? 0.57 : z > 1 ? 0.5 : 0.64;
      outline(
        nd,
        Array.from({ length: 20 }, (_, j) => [
          Math.sin((j * Math.PI) / 10) * r,
          Math.cos((j * Math.PI) / 10) * (r + 0.05),
          z,
        ]),
        0.007,
        seam,
      );
    }
    for (const sideN of [-1, 1]) {
      outline(
        nd,
        [
          [sideN * 0.61, -0.36, -0.5],
          [sideN * 0.61, 0.38, -0.5],
          [sideN * 0.61, 0.38, 0.7],
          [sideN * 0.61, -0.36, 0.7],
        ],
        0.007,
        seam,
      );
      nd.add(new T.CircleGeometry(0.075, 12).rotateY((sideN * Math.PI) / 2), dark, [
        sideN * 0.642,
        0.05,
        0.5,
      ]);
    }
    for (let j = 0; j < 12; j++)
      nd.add(new T.SphereGeometry(0.009, 5, 3), metal, [0.63, -0.34 + j * 0.06, -0.42]);
    nd.finish();
    bindings.push({
      node: g.name,
      source: 'thrustVector',
      property: 'rotation',
      axis: 'x',
      scale: -Math.PI / 2,
      offset: Math.PI / 2,
    });
    const rotor = group(g, `MV22-proprotor-${i + 1}`, [0, 0, 2.43]),
      rd = detailKit(rotor, rotor.name);
    ellipsoid(rd, [0, 0, 0.08], [0.39, 0.39, 0.31], dark, 20);
    rd.ring(0.28, 0.045, [0, 0, -0.1], metal);
    for (let b = 0; b < 3; b++) {
      const blade = group(rotor, `MV22-blade-${i + 1}-${b}`);
      blade.rotation.z = side * ((b * 2 * Math.PI) / 3 - Math.PI / 2);
      const bd = detailKit(blade, blade.name),
        shape = [
          [-0.15, 0.3, 0],
          [-0.25, 0.65, 0.04],
          [-0.36, 1.3, 0.08],
          [-0.35, 3.6, 0.08],
          [-0.22, 5.55, 0.02],
          [-0.06, 5.8, 0],
          [0.22, 5.76, -0.025],
          [0.37, 5.3, -0.06],
          [0.39, 3.2, -0.13],
          [0.23, 1.05, -0.12],
          [0.14, 0.3, 0],
        ].map(([x, y, z]) => [x * side, y, z]);
      sheet(bd, shape, dark, [0, 0, 1]);
      sheet(
        bd,
        shape.map(([x, y, z]) => [x, y, z - 0.045]),
        dark,
        [0, 0, -1],
      );
      for (let j = 0; j < shape.length; j++) {
        const a = shape[j],
          c = shape[(j + 1) % shape.length];
        quad(bd, a, c, [c[0], c[1], c[2] - 0.045], [a[0], a[1], a[2] - 0.045], dark, [
          c[1] - a[1],
          a[0] - c[0],
          0,
        ]);
      }
      bd.rod([side * -0.2, 5.55, 0.04], [side * 0.27, 5.55, 0.01], 0.022, metal);
      bd.rod([0, 0.3, 0], [0, 0.9, 0], 0.075, metal);
      bd.finish();
    }
    rd.finish();
    rotors.push({ node: rotor.name, axis: 'z', multiplier: side, engine: id });
    enginePoints.push({ id, position: [side * 7.09, 3.97, 2.1] });
  }
  const wheel = (dd, x, y, z, r, w) => {
    dd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), rubber, [x, y, z]);
    for (const side of [-1, 1]) {
      dd.add(new T.CylinderGeometry(r * 0.48, r * 0.48, 0.025, 16).rotateZ(Math.PI / 2), metal, [
        x + (side * w) / 2,
        y,
        z,
      ]);
      dd.ring(r * 0.8, 0.01, [x + (side * w) / 2, y, z], seam, 'x');
    }
  };
  for (const [name, x, z, r] of [
    ['nose', 0, 7.3, 0.3],
    ['left', 2.1, -0.6, 0.37],
    ['right', -2.1, -0.6, 0.37],
  ]) {
    const g = group(root, `MV22-gear-${name}`),
      dd = detailKit(g, g.name);
    dd.rod([x, 1.4, z + 0.15], [x, r, z], 0.06, metal);
    dd.rod([x, 0.65, z], [x, 0.9, z - 0.4], 0.03, dark);
    for (const dx of [-0.2, 0.2]) wheel(dd, x + dx, r, z, r, 0.23);
    dd.finish();
    bindings.push(
      { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -0.9, offset: 0.9 },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  // Side hatches and circular cabin windows sit on the actual local skin.
  const skin = (side, y, z) => {
    let i = 0;
    while (i < rings.length - 2 && z < rings[i + 1].z) i++;
    const a = rings[i],
      b = rings[i + 1],
      t = (a.z - z) / (a.z - b.z),
      pts = a.points.map((p, j) => p.map((v, k) => v + (b.points[j][k] - v) * t));
    for (let j = 0; j < 7; j++) {
      const a = pts[j],
        b = pts[j + 1];
      if (y <= a[1] && y >= b[1])
        return [side * (a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + 0.009), y, z];
    }
    return [side * 0.02, y, z];
  };
  for (const side of [-1, 1]) {
    for (const z of [3.6, 0.1, -2.5]) {
      const c = skin(side, 2.35, z);
      d.add(new T.CircleGeometry(0.18, 24).rotateY((side * Math.PI) / 2), dark, c);
      d.ring(0.19, 0.016, c, metal, 'x');
      outline(
        d,
        [
          [1.95, z - 0.32],
          [2.8, z - 0.32],
          [2.8, z + 0.32],
          [1.95, z + 0.32],
        ].map(([y, z]) => skin(side, y, z)),
        0.008,
        seam,
      );
    }
    outline(
      d,
      [
        [0.8, 4.2],
        [2.1, 4.2],
        [2.1, 5.2],
        [0.8, 5.2],
      ].map(([y, z]) => skin(side, y, z)),
      0.009,
      seam,
    );
    outline(
      d,
      [
        [0.67, -2.5],
        [1.0, -4.3],
        [2.48, -6.6],
      ].map(([y, z]) => skin(side, y, z)),
      0.009,
      seam,
      false,
    );
    d.text('MV-22B', [side * 1.285, 2.5, 1.9], 0.16, (side * Math.PI) / 2, dark);
    d.text('RESCUE', [side * 1.285, 1.85, 3.6], 0.075, (side * Math.PI) / 2, d.amber);
  }
  for (const i of [5, 6, 7, 8, 9]) {
    const r = rings[i];
    outline(
      d,
      r.points.map(([x, y]) => [x * 1.004, y + 0.003, r.z]),
      0.005,
      seam,
    );
    for (let j = 0; j < 14; j++)
      for (let k = 0; k < 3; k++) {
        const a = r.points[j],
          b = r.points[(j + 1) % 14],
          t = k / 3;
        d.add(new T.SphereGeometry(0.006, 5, 3), metal, [
          (a[0] + (b[0] - a[0]) * t) * 1.005,
          a[1] + (b[1] - a[1]) * t + 0.003,
          r.z + 0.025,
        ]);
      }
  }
  for (const z of [-2, -4])
    sheet(
      d,
      [
        [0, 3.12, z + 0.25],
        [0, 3.6, z],
        [0, 3.12, z - 0.25],
      ],
      dark,
      [1, 0, 0],
    );
  ellipsoid(d, [0, 1.22, 8.18], [0.23, 0.23, 0.25], dark, 12);
  ellipsoid(d, [0, 3.37, 2], [0.055, 0.065, 0.08], d.red, 8);
  d.finish();
  const interior = cockpit(root, { paint, dark, metal, glass });
  cleanGeometry(root);
  return {
    root,
    frame: mv22Frame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps: [], ailerons: [], animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}
function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'MV22-cabin'),
    ins = instrumentGeometry(cabin, 'MV22'),
    { bindings, derived, ink, black, amber } = ins,
    pt = panelTools(d);
  const face = mat('MV22-panel', '#343f3f', { side: T.DoubleSide }),
    liner = mat('MV22-liner', '#808884', { side: T.DoubleSide }),
    seat = mat('MV22-seat', '#4b5550'),
    belt = mat('MV22-belts', '#aaa99b');
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'gearPosition',
      'flapPosition',
      'thrustVectorPosition',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear', thrustVectorPosition: 'thrustVector' }[k] ??
        k,
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
    unavailable: { op: 'divide', args: [1, 0] },
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', 2 * Math.PI] },
    headingDegrees: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    nacelleDegrees: { op: 'multiply', args: ['thrustVector', 90] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
    hoverFlap: { op: 'multiply', args: ['thrustVector', 1.05] },
    manualFlap: { op: 'multiply', args: ['flapPosition', 0.6] },
    flapBase: { op: 'max', args: ['hoverFlap', 'manualFlap'] },
    rollFlap: { op: 'multiply', args: ['rollInput', 0.23] },
    leftFlaperon: { op: 'add', args: ['flapBase', 'rollFlap'] },
    rightFlaperon: { op: 'subtract', args: ['flapBase', 'rollFlap'] },
  });
  const px = (u) => ((705 - u) * 2.1) / 1310,
    py = (v) => 1.95 + ((630 - v) * 2.1) / 1310,
    z = 6.65,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const contour = [
    [70, 730],
    [70, 540],
    [120, 505],
    [1280, 505],
    [1340, 540],
    [1340, 730],
    [915, 730],
    [915, 805],
    [505, 805],
    [505, 730],
  ].map(([u, v]) => at(u, v));
  const displayUs = [180, 400, 1035, 1255],
    holes = [180, 1255].map((u) => rect(px(u), py(602), 0.17, 0.14, z));
  holes.push(rect(px(783), py(615), 0.085, 0.085, z));
  sheet(d, contour, face, [0, 0, -1], holes);
  outline(d, contour, 0.011, m.dark);
  for (const [i, u] of displayUs.entries()) {
    const x = px(u),
      y = py(630),
      outer = rect(x, y, 0.31, 0.335, z - 0.004),
      hole = i === 0 || i === 3 ? [rect(x, py(602), 0.17, 0.14, z - 0.004)] : [];
    sheet(d, outer, black, [0, 0, -1], hole);
    outline(d, outer, 0.009, face);
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        d.box([0.015, 0.018, 0.012], [x + side * 0.17, y - 0.118 + j * 0.048, z - 0.014], face);
        d.box([0.006, 0.002, 0.001], [x + side * 0.17, y - 0.118 + j * 0.048, z - 0.021], ink);
      }
    for (let j = 0; j < 5; j++)
      d.box([0.025, 0.013, 0.009], [x - 0.12 + j * 0.06, y + 0.184, z - 0.012], face);
    pt.knob(x - 0.145, y - 0.174, z - 0.018, 0.013);
    pt.knob(x + 0.145, y - 0.174, z - 0.018, 0.013);
    if (i === 0 || i === 3) {
      ins.horizon(`pfd-${i}`, at(u, 602, 0.018), 0.17, 0.14, { blankBackdrop: true });
      ins.readout(`tas-${i}`, [x + 0.087, y - 0.045, z - 0.012], 'knots', 3, 0.019);
      ins.readout(`alt-${i}`, [x - 0.065, y - 0.045, z - 0.012], 'feet', 5, 0.018, ink, true);
      ins.readout(`heading-${i}`, [x + 0.075, y - 0.106, z - 0.012], 'headingDegrees', 3, 0.019);
      ins.dial(
        `vsi-${i}`,
        [x - 0.072, y - 0.105, z - 0.012],
        0.033,
        'verticalFpm',
        [
          [-4000, -2.4],
          [0, 0],
          [4000, 2.4],
        ],
        [-4000, 0, 4000],
        'FPM',
        { tickLabels: { '-4000': '-4', 4000: '4' } },
      );
      for (const [text, xx, yy] of [
        ['TAS', x + 0.087, y - 0.024],
        ['GEO FT', x - 0.065, y - 0.024],
        ['TRUE', x + 0.075, y - 0.086],
      ])
        d.text(text, [xx, yy, z - 0.013], 0.009, Math.PI, ink);
    } else {
      for (let j = 1; j <= 2; j++) {
        sources[`engine${j}`] = {
          component: 'aircraftState',
          path: ['engines', `engine-${j}`, 'rpm'],
        };
        derived[`enginePercent${j}`] = { op: 'multiply', args: [`engine${j}`, 100] };
        const xx = x + (j === 1 ? 0.072 : -0.072);
        ins.dial(
          `rpm-${i}-${j}`,
          [xx, y + 0.07, z - 0.012],
          0.05,
          `enginePercent${j}`,
          [
            [0, -2.4],
            [100, 2.4],
          ],
          [0, 50, 100],
          `RPM ${j}`,
        );
      }
      ins.dial(
        `nacelle-gauge-${i}`,
        [x, y - 0.033, z - 0.012],
        0.042,
        'nacelleDegrees',
        [
          [0, -Math.PI / 2],
          [90, 0],
        ],
        [0, 45, 90],
        'NAC',
      );
      d.text('SIM RPM %', [x, y - 0.095, z - 0.013], 0.014, Math.PI, ink, 'display');
      d.text('TEMP / FUEL --', [x, y - 0.112, z - 0.013], 0.012, Math.PI, ink);
    }
  }
  // Offset three-instrument standby cluster, with a blank navigational indicator below.
  ins.horizon('standby', at(783, 615, 0.018), 0.085, 0.085, { round: true, blankBackdrop: true });
  ins.dial(
    'standby-speed',
    at(853, 580, -0.006),
    0.041,
    'knots',
    [
      [0, -2.4],
      [100, -0.7],
      [200, 0.8],
      [350, 2.4],
    ],
    [0, 100, 200, 300],
    'TAS',
  );
  ins.altimeter('standby-altitude', at(853, 645, -0.006), 0.041, 'feet');
  d.add(new T.CircleGeometry(0.056, 28).rotateY(Math.PI), black, at(851, 725, -0.006));
  d.ring(0.057, 0.005, at(851, 725, -0.01), m.metal);
  d.text('NAV --', at(851, 725, -0.012), 0.011, Math.PI, ink, 'display');
  beveledBox(d, [0.27, 0.145, 0.05], at(650, 610, 0.025), m.dark, 0.012);
  d.text('SYSTEM --', at(650, 610, -0.003), 0.018, Math.PI, ink);
  // Upper autoflight controller, fire handle and side radio windows. No invented modes or values.
  beveledBox(d, [0.82, 0.145, 0.12], [0, 2.22, 6.72], face, 0.012);
  for (let i = 0; i < 6; i++) {
    pt.knob(-0.34 + i * 0.135, 2.21, 6.65, 0.017);
    d.box([0.035, 0.026, 0.012], [-0.34 + i * 0.135, 2.17, 6.65], m.dark);
  }
  d.text('AFCS', [0, 2.274, 6.65], 0.015, Math.PI, ink);
  d.box([0.15, 0.033, 0.06], [0, 2.32, 6.7], d.red);
  d.text('APU', [0, 2.32, 6.665], 0.015, Math.PI, ink);
  for (const side of [-1, 1]) {
    beveledBox(d, [0.48, 0.09, 0.12], [side * 0.72, 2.23, 6.72], face, 0.01);
    d.box([0.26, 0.027, 0.01], [side * 0.72, 2.23, 6.654], black);
    pt.knob(side * 0.91, 2.23, 6.64, 0.02);
  }
  d.box([2.1, 0.055, 0.22], [0, 2.155, 6.78], m.dark);
  // Lower central display and two independent keypads on a sloping pedestal.
  const console = group(cabin, 'MV22-console', [0.045, 1.6, 6.36]);
  console.rotation.x = 0.55;
  const cd = detailKit(console, console.name),
    cp = panelTools(cd);
  beveledBox(cd, [0.57, 0.78, 0.09], [0, 0, 0], face, 0.025);
  cd.box([0.34, 0.27, 0.02], [0, 0.2, -0.06], black);
  outline(cd, rect(0, 0.2, 0.39, 0.32, -0.075), 0.01, m.dark);
  cd.text('NAVIGATION --', [0, 0.2, -0.078], 0.022, Math.PI, ink);
  for (const side of [-1, 1])
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 5; col++) {
        const x = side * 0.145 + (col - 2) * 0.042,
          y = -0.02 - row * 0.047;
        cd.box([0.031, 0.028, 0.012], [x, y, -0.065], m.dark);
        cd.text(
          row < 2 ? String((row * 5 + col) % 10) : ['NAV', 'COM', 'ENT', 'CLR', 'FPL'][col],
          [x, y, -0.073],
          0.008,
          Math.PI,
          ink,
        );
      }
  for (const side of [-1, 1]) cp.knob(side * 0.23, 0.32, -0.08, 0.014);
  cd.finish();
  const overhead = group(cabin, 'MV22-overhead', [0, 2.79, 4.5]);
  overhead.rotation.x = -Math.PI / 2;
  const od = detailKit(overhead, overhead.name),
    op = panelTools(od);
  beveledBox(od, [1.45, 1.7, 0.06], [0, 0, 0], face, 0.015);
  // Central controls follow the rescue manual's lighting/APU/engine sequence.
  for (const [label, y, h] of [
    ['LIGHTING', -0.58, 0.44],
    ['APU / ECS', -0.1, 0.46],
    ['ENGINE CONTROL', 0.43, 0.56],
  ]) {
    outline(od, rect(0, y, 0.43, h, -0.035), 0.003, ink);
    od.text(label, [0, y + h / 2 - 0.045, -0.039], 0.017, Math.PI, ink);
  }
  for (const x of [-0.11, 0.11]) {
    op.knob(x, -0.52, -0.05, 0.035);
    op.knob(x, -0.68, -0.05, 0.024);
  }
  op.knob(0.055, -0.12, -0.055, 0.035);
  od.box([0.065, 0.08, 0.035], [-0.12, -0.12, -0.06], d.red);
  od.text('BATT', [-0.12, -0.045, -0.04], 0.015, Math.PI, ink);
  od.text('APU', [0.055, -0.045, -0.04], 0.015, Math.PI, ink);
  for (const side of [-1, 1]) {
    od.box([0.065, 0.22, 0.035], [side * 0.12, 0.4, -0.055], black);
    od.box([0.085, 0.1, 0.045], [side * 0.12, 0.45, -0.078], d.red);
    od.text(side > 0 ? 'LEFT' : 'RIGHT', [side * 0.12, 0.59, -0.04], 0.012, Math.PI, ink);
  }
  od.rod([0, 0.25, -0.05], [0, 0.5, -0.05], 0.012, m.metal);
  od.box([0.07, 0.04, 0.05], [0, 0.32, -0.075], d.red);
  od.text('ROTOR BRAKE', [0, 0.2, -0.04], 0.012, Math.PI, ink);
  // Side banks retain their distinct switch versus circuit-breaker groupings.
  for (const side of [-1, 1])
    for (const [row, y] of [-0.43, 0.35].entries()) {
      const x = side * 0.49;
      outline(od, rect(x, y, 0.42, 0.7, -0.035), 0.003, ink);
      od.text(
        side > 0 ? (row ? 'ELECTRICAL' : 'LIGHTS') : row ? 'CIRCUIT BREAKERS' : 'AIR SYSTEMS',
        [x, y + 0.3, -0.04],
        0.014,
        Math.PI,
        ink,
      );
      for (let r = 0; r < (side < 0 ? 5 : 3); r++)
        for (let col = 0; col < 4; col++) {
          const xx = x - 0.135 + col * 0.09,
            yy = y + 0.19 - r * (side < 0 ? 0.1 : 0.17);
          if (side < 0) {
            od.add(new T.CylinderGeometry(0.014, 0.014, 0.025, 8).rotateX(Math.PI / 2), black, [
              xx,
              yy,
              -0.055,
            ]);
            od.text(String(col + 1), [xx, yy - 0.027, -0.04], 0.01, Math.PI, ink);
          } else {
            od.rod([xx, yy, -0.04], [xx, yy + 0.025, -0.085], 0.006, m.metal);
            od.box([0.04, 0.015, 0.007], [xx, yy - 0.04, -0.04], black);
          }
        }
    }
  od.finish();
  d.box([1.9, 0.04, 1.85], [0, 3.05, 4.65], liner);
  for (const side of [-1, 1]) {
    const x = side * 0.62,
      g = group(cabin, `MV22-seat-${side}`, [x, 1.05, 5.5]),
      dd = detailKit(g, g.name);
    dd.box([0.36, 0.32, 0.45], [0, 0.19, 0], m.metal);
    beveledBox(dd, [0.51, 0.14, 0.56], [0, 0.4, 0], seat, 0.03);
    beveledBox(dd, [0.53, 0.82, 0.14], [0, 0.87, -0.27], seat, 0.025);
    beveledBox(dd, [0.32, 0.25, 0.14], [0, 1.4, -0.27], seat, 0.025);
    for (const dx of [-0.14, 0.14])
      dd.rod([dx, 1.22, -0.18], [dx * 0.35, 0.48, -0.17], 0.024, belt);
    dd.rod([-0.2, 0.49, -0.1], [0.2, 0.49, 0.18], 0.023, belt);
    dd.box([0.065, 0.045, 0.025], [0, 0.49, 0.05], m.metal);
    dd.finish();
    const stick = group(cabin, `MV22-cyclic-${side}`, [x, 1.2, 6.02]),
      sd = detailKit(stick, stick.name);
    sd.rod([0, 0, 0], [0, 0.45, -0.08], 0.023, m.metal);
    beveledBox(sd, [0.065, 0.17, 0.075], [0, 0.51, -0.1], m.dark, 0.015);
    sd.add(new T.CircleGeometry(0.012, 12).rotateY(Math.PI), d.red, [0.013, 0.565, -0.141]);
    sd.finish();
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.22 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.22 },
    );
    // Each pilot's left-hand thrust lever has the nacelle control thumbwheel.
    const lever = group(cabin, `MV22-thrust-${side}`, [x + 0.28, 1.34, 5.7]),
      ld = detailKit(lever, lever.name);
    ld.rod([0, 0, 0], [0, 0.3, 0.16], 0.025, m.metal);
    beveledBox(ld, [0.1, 0.09, 0.15], [0, 0.32, 0.16], m.dark, 0.018);
    ld.finish();
    bindings.push({
      node: lever.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
    });
    const thumb = group(lever, `MV22-nacelle-thumb-${side}`, [0.055, 0.34, 0.16]),
      td = detailKit(thumb, thumb.name);
    td.add(new T.CylinderGeometry(0.025, 0.025, 0.022, 12).rotateZ(Math.PI / 2), m.metal);
    td.finish();
    bindings.push({
      node: thumb.name,
      source: 'thrustVector',
      property: 'rotation',
      axis: 'x',
      scale: -Math.PI / 2,
    });
    for (const dx of [-0.16, 0.16]) {
      const pg = group(cabin, `MV22-pedal-${side}-${Math.sign(dx)}`, [x + dx, 1.22, 6.61]),
        pd = detailKit(pg, pg.name);
      pd.box([0.18, 0.2, 0.045], [0, 0, 0], m.metal);
      for (let j = 0; j < 5; j++)
        pd.rod(
          [-0.075, -0.08 + j * 0.04, -0.028],
          [0.075, -0.08 + j * 0.04, -0.028],
          0.005,
          m.dark,
        );
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: Math.sign(dx) * 0.05,
      });
    }
    const sideboard = group(cabin, `MV22-sideboard-${side}`, [side * 1.05, 1.65, 5.45]);
    sideboard.rotation.y = (side * Math.PI) / 2;
    const bd = detailKit(sideboard, sideboard.name),
      bp = panelTools(bd);
    beveledBox(bd, [1.25, 0.25, 0.08], [0, 0, 0], face, 0.015);
    for (let j = 0; j < 7; j++) {
      bp.knob(-0.5 + j * 0.16, 0.035, -0.06, 0.018);
      bd.box([0.07, 0.035, 0.01], [-0.5 + j * 0.16, -0.07, -0.05], m.dark);
    }
    bd.finish();
  }
  d.box([2.25, 0.05, 3.15], [0, 1.04, 5.1], m.dark);
  sheet(d, rect(0, 2.03, 2.45, 2.05, 3.55), liner, [0, 0, 1], [rect(0, 1.91, 0.7, 1.72, 3.55)]);
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
