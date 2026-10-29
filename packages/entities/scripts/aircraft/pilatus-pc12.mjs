/** 2020 PC-12/47E NGX, MSN2001+, PT6E-67XP / Honeywell ACE.
 * Main axle datum; +Z nose, +X pilot left. POH 02406 and factory plans/photos.
 * The model-building plan contains legacy four-blade callouts; the NGX POH wins.
 */
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

export const pc12Frame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.845,
  cy: 1.94,
  ry: 0.915,
  cabinZ: 2.05,
  cabinWidth: 1.52,
  eye: [0.35, 2.65, 2.05],
  panelZ: 2.84,
  floor: 1.25,
});
export function buildPC12(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('PC12-pearl', '#e9ebe7', { side: T.DoubleSide }),
    blue = mat('PC12-blue', '#235b83', { side: T.DoubleSide }),
    metal = mat('PC12-alloy', '#a9b3b8', { metalness: 0.72 }),
    dark = mat('PC12-trim', '#202a30', { side: T.DoubleSide }),
    rubber = mat('PC12-tires', '#1b2022'),
    glass = mat('PC12-glass', '#adced6', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.14,
    });
  const d = detailKit(root, 'PC12-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Independently sampled plan widths and side heights; fuselage sections follow factory frames.
  const stations = [
    [5.28, 0.26, 1.38, 2.01],
    [4.4, 0.53, 1.13, 2.23],
    [3.45, 0.72, 1.04, 2.34],
    [2.4, 0.82, 1.02, 2.83],
    [1.85, 0.845, 1.02, 2.85],
    [0.7, 0.845, 1.02, 2.85],
    [-0.5, 0.845, 1.02, 2.85],
    [-1.7, 0.845, 1.02, 2.85],
    [-2.7, 0.82, 1.04, 2.85],
    [-3.75, 0.72, 1.2, 2.79],
    [-4.8, 0.59, 1.43, 2.69],
    [-5.85, 0.43, 1.69, 2.54],
    [-6.9, 0.28, 1.94, 2.4],
    [-7.65, 0.09, 2.14, 2.27],
    [-8.05, 0.012, 2.2, 2.23],
  ];
  const rings = stations.map(([z, w, b, t]) => {
    const h = t - b;
    return {
      z,
      points: [
        [0, t],
        [w * 0.58, t - h * 0.025],
        [w * 0.9, t - h * 0.115],
        [w, t - h * 0.28],
        [w, b + h * 0.25],
        [w * 0.86, b + h * 0.06],
        [w * 0.5, b],
        [0, b - h * 0.008],
        [-w * 0.5, b],
        [-w * 0.86, b + h * 0.06],
        [-w, b + h * 0.25],
        [-w, t - h * 0.28],
        [-w * 0.9, t - h * 0.115],
        [-w * 0.58, t - h * 0.025],
      ],
    };
  });
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 2 && [0, 1, 2, 11, 12, 13].includes(j)) ||
      (i >= 3 && i <= 8 && [1, 2, 3, 10, 11, 12].includes(j)) ||
      (i === 2 && [3, 10].includes(j)) ||
      (i >= 1 && i < 11 && [4, 9].includes(j)),
  });
  for (const j of [0, 1, 12, 13])
    quad(d, p(2, j), p(3, j), p(3, (j + 1) % 14), p(2, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [3, 10])
    quad(d, p(2, j), p(3, j), p(3, j + 1), p(2, j + 1), paint, [j === 3 ? 1 : -1, 0, 0]);
  for (const side of [-1, 1]) {
    const upper = side === 1 ? 2 : 12,
      lower = side === 1 ? 3 : 11;
    const at = (t, v) =>
      p(2, upper).map(
        (q, i) =>
          ((1 - t) * q + t * p(3, upper)[i]) * (1 - v) +
          ((1 - t) * p(2, lower)[i] + t * p(3, lower)[i]) * v,
      );
    const opening = [at(0.35, 0.1), at(0.95, 0.08), at(0.95, 0.92)];
    sheet(d, [p(2, upper), p(3, upper), p(3, lower), p(2, lower)], paint, [side, 0, 0], [opening]);
    sheet(d, opening, glass, [side, 0, 0]);
    outline(d, opening, 0.012, dark);
  }
  for (const i of [2, 3])
    outline(d, [p(i, 12), p(i, 13), p(i, 0), p(i, 1), p(i, 2)], 0.018, dark, false);
  d.rod(p(2, 0), p(3, 0), 0.016, dark);
  const sample = (z, n) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (z <= stations[i][0] && z >= stations[i + 1][0]) {
        const t = (stations[i][0] - z) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][n] * (1 - t) + stations[i + 1][n] * t;
      }
    return stations.at(-1)[n];
  };
  for (const side of [-1, 1]) {
    const at = (z, y) => [side * (sample(z, 1) + 0.001), y, z];
    const passenger = [];
    // Five NGX rectangles on starboard; the port airstair replaces the forwardmost window.
    for (const z of side === 1 ? [0.67, 0.075, -0.69, -1.68] : [1.34, 0.67, 0.075, -0.69, -1.68]) {
      const w = 0.29,
        h = 0.39,
        r = 0.055,
        y = 2.27;
      passenger.push(
        [
          [z - w / 2 + r, y + h / 2],
          [z + w / 2 - r, y + h / 2],
          [z + w / 2, y + h / 2 - r],
          [z + w / 2, y - h / 2 + r],
          [z + w / 2 - r, y - h / 2],
          [z - w / 2 + r, y - h / 2],
          [z - w / 2, y - h / 2 + r],
          [z - w / 2, y + h / 2 - r],
        ].map((q) => at(...q)),
      );
    }
    const pilot = [
      [2.38, 2.63],
      [2.28, 2.68],
      [2.04, 2.64],
      [1.98, 2.26],
      [2.16, 2.18],
      [2.38, 2.23],
    ].map((q) => at(...q));
    const holes = [pilot, ...passenger];
    const edge = [];
    const upper = (i) => [side * stations[i][1], stations[i][3] - 0.12, stations[i][0]];
    for (let i = 3; i <= 9; i++) edge.push(upper(i));
    for (let i = 9; i >= 3; i--) edge.push(p(i, side === 1 ? 4 : 10));
    sheet(d, edge, paint, [side, 0, 0], holes);
    for (let i = 3; i < 9; i++)
      quad(
        d,
        p(i, side === 1 ? 1 : 13),
        p(i + 1, side === 1 ? 1 : 13),
        upper(i + 1),
        upper(i),
        paint,
        [side, 1, 0],
      );
    // Close the shoulder where the tall window band rejoins the original loft section.
    for (const i of [3, 9])
      sheet(
        d,
        [p(i, side === 1 ? 1 : 13), p(i, side === 1 ? 2 : 12), p(i, side === 1 ? 3 : 11), upper(i)],
        paint,
        [0, 0, i === 3 ? 1 : -1],
      );
    for (const h of holes) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.012, dark);
      outline(
        d,
        h.map((v) => [v[0] + side * 0.003, v[1], v[2]]),
        0.006,
        metal,
      );
    }
    // Door seams, hinges and handles are geometry, without an opaque sheet behind the windows.
    const doors =
      side === 1
        ? [
            [1.33, 1.65, 0.61, 1.35],
            [-1.96, 1.94, 1.35, 1.32],
          ]
        : [[-0.22, 2.2, 0.49, 0.68]];
    for (const [z, y, w, h] of doors) {
      const edge = [
        [z - w / 2, y - h / 2],
        [z + w / 2, y - h / 2],
        [z + w / 2, y + h / 2],
        [z - w / 2, y + h / 2],
      ].map((q) => at(...q));
      outline(d, edge, 0.0025, dark);
      d.rod(at(z - 0.08, y - 0.2), at(z + 0.08, y - 0.2), 0.012, metal);
      for (const v of [-0.28, 0.28]) d.box([0.025, 0.023, 0.1], at(z + v, y + h / 2), metal);
    }
    // Restrained longitudinal skin joints and fasteners, based on the maintenance photographs.
    for (const y of [1.38, 1.96]) {
      const line = [3.25, 2.4, 1.85, 0.7, -0.5, -1.7, -2.7, -3.75].map((z) => at(z, y));
      outline(d, line, 0.0015, metal, false);
      for (let z = -3.6; z < 3.2; z += 0.14)
        d.add(new T.SphereGeometry(0.0023, 5, 3), metal, at(z, y));
    }
    // Lower blue livery, terminating below the glazed aperture band.
    for (let i = 1; i < 11; i++)
      quad(
        d,
        p(i, side === 1 ? 4 : 10),
        p(i + 1, side === 1 ? 4 : 10),
        p(i + 1, side === 1 ? 5 : 9),
        p(i, side === 1 ? 5 : 9),
        blue,
        [side, 0, 0],
      );
    // Twin exhaust outlets behind the spinner, with open dark mouths.
    d.rod([side * 0.36, 1.74, 4.92], [side * 0.56, 1.73, 4.69], 0.09, metal);
    d.add(new T.CircleGeometry(0.073, 16).rotateY(side * 0.8), dark, [side * 0.565, 1.73, 4.68]);
    d.text('PC-12 NGX', [side * 0.847, 1.88, -2.15], 0.075, (side * Math.PI) / 2, blue);
  }
  for (const i of [1, 2, 4, 8, 9, 10, 11])
    outline(
      d,
      rings[i].points.map((q) => [...q, rings[i].z]),
      0.0017,
      metal,
    );
  ellipsoid(d, [0, 1.34, 5.15], [0.24, 0.1, 0.17], dark, 20);
  outline(
    d,
    [
      [-0.25, 1.34, 5.14],
      [0, 1.24, 5.26],
      [0.25, 1.34, 5.14],
    ],
    0.014,
    metal,
    false,
  );
  // Low wing: forward edge nearly unswept, tapered trailing edge, upturned swept tips.
  for (const side of [-1, 1]) {
    const full = [
      [0.7, 1.11, 0.91, -1.29, 0.17],
      [2.265, 1.25, 0.83, -1.1, 0.14],
      [5.75, 1.55, 0.65, -0.72, 0.1],
      [7.55, 1.71, 0.57, -0.55, 0.07],
      [7.86, 1.75, 0.54, -0.53, 0.045],
    ];
    wing(
      d,
      full.map(([x, y, le, te, h]) => [side * x, y, le, te + (x < 5.76 ? 0.43 : 0.24), h]),
      paint,
    );
    wing(
      d,
      full.map(([x, y, le, , h]) => [side * x, y + 0.005, le + 0.005, le - 0.105, h * 0.31]),
      dark,
    );
    const fg = group(root, `PC12-flap-${side}`, [side * 0.86, 1.125, -0.86]),
      fd = detailKit(fg, fg.name);
    wing(
      fd,
      [
        [0, 0, 0, -0.43, 0.035],
        [side * 4.84, 0.415, 0.55, 0.12, 0.025],
      ],
      paint,
    );
    fd.finish();
    // Fowler travel includes aft translation as well as the downward rotation.
    bindings.push(
      {
        node: fg.name,
        source: 'flapPosition',
        property: 'rotation',
        axis: 'x',
        scale: (-40 * Math.PI) / 180,
      },
      { node: fg.name, source: 'flapPosition', property: 'position', axis: 'z', scale: -0.22 },
      { node: fg.name, source: 'flapPosition', property: 'position', axis: 'y', scale: -0.06 },
    );
    const ag = group(root, `PC12-aileron-${side}`, [side * 5.78, 1.55, -0.48]),
      ad = detailKit(ag, ag.name);
    wing(
      ad,
      [
        [0, 0, 0, -0.24, 0.02],
        [side * 1.77, 0.16, 0.17, -0.07, 0.015],
      ],
      paint,
    );
    ad.finish();
    ailerons.push({ node: ag.name, axis: 'x', multiplier: -side * 0.35 });
    wing(
      d,
      [
        [side * 7.86, 1.75, 0.54, -0.53, 0.045],
        [side * 8.02, 1.84, 0.32, -0.62, 0.032],
        [side * 8.155, 2.07, -0.2, -0.76, 0.014],
      ],
      paint,
    );
    for (const x of [1.5, 3.5, 5.3]) {
      ellipsoid(d, [side * x, 1.06 + (x - 0.7) * 0.088, -0.7], [0.065, 0.11, 0.35], paint, 12);
      d.rod(
        [side * x, 1.02 + (x - 0.7) * 0.088, -0.3],
        [side * x, 0.99 + (x - 0.7) * 0.088, -0.93],
        0.018,
        metal,
      );
    }
    for (let x = 1.1; x < 7.7; x += 0.3) {
      const y = 1.11 + (x - 0.7) * 0.088,
        te = -1.29 + (x - 0.7) * 0.106;
      d.add(new T.SphereGeometry(0.0025, 5, 3), metal, [side * x, y + 0.045, te + 0.5]);
    }
    for (const x of [2.4, 6.1]) {
      const z = 0.2,
        y = 1.11 + (x - 0.7) * 0.088 + 0.12;
      d.ring(0.065, 0.002, [side * x, y, z], metal, 'y');
    }
    for (const x of [6.2, 7.3])
      d.rod([side * x, 1.63, -0.64], [side * x, 1.63, -0.83], 0.002, dark);
    ellipsoid(d, [side * 8.05, 1.9, -0.5], [0.045, 0.035, 0.075], side === 1 ? d.red : d.green, 10);
    ellipsoid(d, [side * 1.54, 1.02, -0.45], [0.09, 0.045, 0.035], d.light, 12);
    // Swept T-tail with real elevator separation.
    wing(
      d,
      [
        [side * 0.12, 4.19, -6.73, -7.97, 0.09],
        [side * 2.27, 4.19, -7.12, -7.95, 0.045],
        [side * 2.6, 4.19, -7.51, -8.34, 0.02],
      ],
      paint,
    );
    wing(
      d,
      [
        [side * 0.16, 4.195, -6.72, -6.83, 0.035],
        [side * 2.25, 4.195, -7.12, -7.23, 0.02],
      ],
      dark,
    );
    const eg = group(root, `PC12-elevator-${side}`, [side * 0.15, 4.19, -7.97]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.33, 0.025],
        [side * 2.12, 0, 0.02, -0.25, 0.017],
      ],
      paint,
    );
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.3,
    });
    sheet(
      d,
      [
        [side * 0.1, 2.64, -3.5],
        [side * 0.065, 3.34, -6.12],
        [side * 0.05, 4.21, -7.05],
        [side * 0.035, 4.21, -8.25],
        [side * 0.09, 2.05, -7.28],
      ],
      paint,
      [side, 0, 0],
    );
    sheet(
      d,
      [
        [side * 0.22, 1.55, -4.25],
        [side * 0.13, 1.81, -6.8],
        [side * 0.32, 1.43, -6.5],
      ],
      blue,
      [side, 0, 0],
    );
  }
  const rudder = group(root, 'PC12-rudder', [0, 2.1, -7.3]),
    rd = detailKit(rudder, rudder.name);
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.035, 0, 0],
        [side * 0.02, 2.11, -0.7],
        [side * 0.02, 2.11, -0.95],
        [side * 0.035, 0.05, -0.22],
      ],
      paint,
      [side, 0, 0],
    );
  rd.finish();
  bindings.push({
    node: rudder.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.42,
  });
  ellipsoid(d, [0, 4.19, -7.7], [0.14, 0.07, 1.02], paint, 20);
  // Antennas and dorsal fairing, kept separate from the primary silhouette.
  for (const [z, y] of [
    [-0.5, 2.85],
    [-4.1, 2.78],
  ])
    sheet(
      d,
      [
        [0, y, z],
        [0, y + 0.22, z - 0.17],
        [0, y, z - 0.35],
      ],
      paint,
      [1, 0, 0],
    );
  for (const z of [-0.8, -2.4]) ellipsoid(d, [0, 1.02, z], [0.1, 0.045, 0.2], paint, 12);
  // 105-inch five-blade scimitar Hartzell, unlike the older four-blade drawing.
  const prop = group(root, 'PC12-propeller', [0, 1.69, 5.29]),
    pd = detailKit(prop, prop.name);
  pd.add(new T.ConeGeometry(0.26, 0.56, 28).rotateX(Math.PI / 2), metal, [0, 0, 0.28]);
  for (let i = 0; i < 5; i++) {
    const g = group(prop, `PC12-blade-${i}`);
    g.rotation.z = (i * Math.PI * 2) / 5;
    const dd = detailKit(g, g.name),
      pts = [
        [0.18, -0.06, 0],
        [0.65, -0.09, 0.02],
        [1.1, -0.13, 0.025],
        [1.29, -0.19, 0.02],
        [1.334, -0.14, 0.01],
        [1.3, -0.06, 0],
        [0.85, 0.085, -0.02],
        [0.3, 0.085, 0],
      ];
    sheet(dd, pts, dark, [0, 0, 1]);
    sheet(
      dd,
      pts.map((q) => [q[0], q[1], q[2] - 0.02]),
      dark,
      [0, 0, -1],
    );
    outline(dd, pts.slice(1, 6), 0.008, metal, false);
    dd.finish();
  }
  pd.finish();
  // Single wheels, main legs fold inward; nose leg folds aft (POH 7-4-1).
  for (const [i, x, z, top, r] of [
    [0, 0, 3.48, 1.08, 0.27],
    [1, 2.265, 0, 1.25, 0.31],
    [2, -2.265, 0, 1.25, 0.31],
  ]) {
    const g = group(root, `PC12-gear-${i}`, [x, top, z]),
      dd = detailKit(g, g.name),
      h = top - r;
    dd.rod([0, 0, 0], [0, -h + 0.18, 0.1], 0.043, metal);
    dd.rod([0, -h + 0.18, 0.1], [0, -h, 0], 0.035, metal);
    dd.rod([0, -0.1, 0.2], [0, -h + 0.13, -0.12], 0.018, dark);
    dd.add(new T.CylinderGeometry(r, r, 0.19, 28).rotateZ(Math.PI / 2), rubber, [0, -h, 0]);
    for (const sign of [-1, 1]) {
      dd.add(new T.CircleGeometry(r * 0.61, 20).rotateY((sign * Math.PI) / 2), paint, [
        sign * 0.097,
        -h,
        0,
      ]);
      dd.add(new T.CircleGeometry(0.065, 12).rotateY((sign * Math.PI) / 2), metal, [
        sign * 0.1,
        -h,
        0,
      ]);
    }
    if (i) dd.box([0.018, 0.53, 0.22], [Math.sign(x) * 0.07, -0.22, 0.015], paint);
    else dd.box([0.16, 0.36, 0.018], [0, -0.24, 0.13], paint);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: i ? 'z' : 'x',
      offset: i ? (-Math.sign(x) * Math.PI) / 2 : Math.PI / 2,
      scale: i ? (Math.sign(x) * Math.PI) / 2 : -Math.PI / 2,
    });
  }
  d.finish();
  const interior = pc12Cockpit(root, { paint, blue, metal, dark });
  cleanGeometry(root);
  return {
    root,
    frame: pc12Frame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.69, 5.29] }],
    visual: {
      rotors: [{ node: prop.name, axis: 'z', multiplier: 1, engine: 'engine-1' }],
      gearNodes: [],
      flaps,
      ailerons,
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

function pc12Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'PC12-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'PC12');
  const { bindings, derived, ink, black, amber } = ins,
    face = mat('PC12-panel', '#4b5054'),
    leather = mat('PC12-leather', '#bfbcb0'),
    liner = mat('PC12-liner', '#dad9cc'),
    wood = mat('PC12-cabinet', '#514039');
  // Four 10.4-inch 4:3 display apertures; factory photo has a 165px active width.
  const sw = 0.211328,
    sh = 0.158496,
    k = sw / 165,
    px = (u) => (682 - u) * k,
    py = (v) => 2.32 - (v - 240) * k,
    z = 2.84,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const screens = [
      [414, 274],
      [952, 274],
      [682, 240],
      [682, 400],
    ],
    edge = [
      [194, 476],
      [190, 263],
      [219, 185],
      [279, 143],
      [410, 105],
      [560, 86],
      [682, 78],
      [825, 90],
      [968, 111],
      [1090, 151],
      [1170, 210],
      [1199, 268],
      [1204, 476],
    ].map((q) => at(...q));
  sheet(
    d,
    edge,
    face,
    [0, 0, -1],
    [...screens.map(([u, v]) => rect(px(u), py(v), sw, sh)), rect(px(285), py(289), 0.06, 0.045)],
  );
  sheet(
    d,
    edge.map((q) => [q[0], q[1], q[2] + 0.09]),
    m.dark,
    [0, 0, 1],
  );
  const brow = edge.slice(1, -1).map((q) => new T.Vector3(q[0], q[1], q[2] - 0.025));
  d.add(new T.TubeGeometry(new T.CatmullRomCurve3(brow), 80, 0.018, 8, false), black);
  for (let i = 1; i < edge.length - 2; i++) {
    const a = edge[i],
      b = edge[i + 1];
    quad(d, a, b, [b[0], b[1], 3.19], [a[0], a[1], 3.19], black, [0, 1, 0]);
  }
  const sources = {
    trueAirspeed: { component: 'aircraftState', path: ['airspeed'] },
    altitude: { component: 'transform', path: ['pos', 1] },
    roll: { component: 'aircraftState', path: ['roll'] },
    pitch: { component: 'aircraftState', path: ['pitch'] },
    yaw: { component: 'aircraftState', path: ['yaw'] },
    verticalSpeed: { component: 'aircraftState', path: ['verticalSpeed'] },
    propNormalized: { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] },
    pitchInput: { component: 'aircraftInput', path: ['pitch'] },
    rollInput: { component: 'aircraftInput', path: ['roll'] },
    yawInput: { component: 'aircraftInput', path: ['yaw'] },
    power: { component: 'aircraftInput', path: ['power'] },
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', Math.PI * 2] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    propRpm: { op: 'multiply', args: ['propNormalized', 1700] },
    flapDegrees: { op: 'multiply', args: ['flapPosition', 40] },
    gearDown: { op: 'greater', args: ['gear', 0.995] },
    gearUp: { op: 'less', args: ['gear', 0.005] },
    gearAbove: { op: 'greater', args: ['gear', 0.005] },
    gearBelow: { op: 'less', args: ['gear', 0.995] },
    gearTransit: { op: 'and', args: ['gearAbove', 'gearBelow'] },
  });
  for (const [i, [u, v]] of screens.entries()) {
    const x = px(u),
      y = py(v);
    sheet(
      d,
      rect(x, y, sw + 0.026, sh + 0.026, z - 0.003),
      black,
      [0, 0, -1],
      [rect(x, y, sw, sh, z - 0.003)],
    );
    for (const side of [-1, 1])
      for (let n = 0; n < 7; n++) {
        d.box(
          [0.005, 0.007, 0.005],
          [x + side * (sw / 2 + 0.008), y + 0.06 - n * 0.019, z - 0.008],
          face,
        );
      }
    if (i > 1) {
      sheet(d, rect(x, y, sw, sh, z + 0.006), black, [0, 0, -1]);
      continue;
    }
    const label = i ? 'PFD-R' : 'PFD-L',
      hx = x + (i ? -0.029 : 0.029),
      hy = y + 0.027,
      ex = x + (i ? 0.077 : -0.077);
    ins.horizon(`${label}-horizon`, [hx, hy, z + 0.022], 0.113, 0.08);
    sheet(
      d,
      rect(x, y, sw, sh, z + 0.006),
      black,
      [0, 0, -1],
      [rect(hx, hy, 0.113, 0.08, z + 0.006)],
    );
    // Live air-data readouts occupy the real tape locations; TAS/GEO disclose sensor approximations.
    ins.readout(`${label}-speed`, [hx + 0.055, hy, z + 0.001], 'knots', 3, 0.008, ink, false, true);
    ins.readout(
      `${label}-altitude`,
      [hx - 0.054, hy, z + 0.001],
      'feet',
      5,
      0.005,
      ink,
      true,
      true,
    );
    d.text('TAS', [hx + 0.049, hy + 0.044, z], 0.004, Math.PI, ink, 'display');
    d.text('GEO FT', [hx - 0.047, hy + 0.044, z], 0.0037, Math.PI, ink, 'display');
    const rose = group(cabin, `PC12-${label}-rose`, [hx, y - 0.047, z + 0.002]),
      dd = detailKit(rose, rose.name);
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
      dd.rod(p(deg % 30 ? 0.023 : 0.02), p(0.026), 0.0004, ink);
      if (deg % 30 === 0)
        dd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(0.016),
          0.0036,
          Math.PI,
          ink,
        );
    }
    dd.finish();
    bindings.push({
      node: rose.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: Math.PI * 2,
    });
    ins.available(`${label}-heading`, 'trueHeading', rose.name);
    ins.readout(`${label}-heading`, [hx, y - 0.048, z], 'degreesTrue', 3, 0.005, ink, false, true);
    d.text('TRUE', [hx, y - 0.076, z], 0.0035, Math.PI, ink, 'display');
    const vsi = group(cabin, `PC12-${label}-VSI`, [hx - 0.069, hy, z]),
      vd = detailKit(vsi, vsi.name);
    vd.rod([-0.002, 0, 0], [0.002, 0.002, 0], 0.0007, ink);
    vd.finish();
    bindings.push({
      node: vsi.name,
      source: 'verticalFpm',
      property: 'position',
      axis: 'y',
      scale: 0.00001,
      min: -0.032,
      max: 0.032,
      responseSeconds: 0.6,
    });
    ins.available(`${label}-VSI`, 'verticalFpm', vsi.name);
    for (const value of [-2000, 0, 2000])
      d.rod(
        [hx - 0.069, hy + value * 0.00001, z],
        [hx - 0.065, hy + value * 0.00001, z],
        0.0004,
        ink,
      );
    // NG is the turbine core, not the normalized propeller shaft telemetry.
    for (const [label, dy] of [
      ['TRQ', 0.054],
      ['ITT', 0.026],
      ['NG', -0.003],
      ['NP RPM', -0.031],
    ]) {
      d.text(label, [ex, y + dy, z], 0.0035, Math.PI, ink);
      if (label !== 'NP RPM') d.text('X', [ex, y + dy - 0.012, z], 0.007, Math.PI, amber);
    }
    ins.readout(`${label}-prop-rpm`, [ex, y - 0.046, z], 'propRpm', 4, 0.006, ink, false, true);
    d.text('OIL / FUEL', [ex, y - 0.065, z], 0.0031, Math.PI, ink);
    d.text('--', [ex, y - 0.076, z], 0.005, Math.PI, amber);
  }
  d.text('MAP / NAV INOP', at(682, 240, -0.001), 0.009, Math.PI, amber);
  // Systems MFD: actual gear and flap positions. Trim/environment fields have no invented values.
  const mx = px(682),
    my = py(400);
  for (const [u, v] of [
    [669, 356],
    [661, 368],
    [677, 368],
  ]) {
    const g = group(cabin, `PC12-gear-icon-${u}`, at(u, v, -0.001)),
      dd = detailKit(g, g.name);
    dd.box([0.007, 0.012, 0.001], [0, 0, 0], d.green);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  const transit = group(cabin, 'PC12-gear-transit', at(669, 383, -0.001)),
    td = detailKit(transit, transit.name);
  td.text('TRANSIT', [0, 0, 0], 0.0045, Math.PI, amber);
  td.finish();
  bindings.push({
    node: transit.name,
    source: 'gearTransit',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  d.text('GEAR', at(669, 344), 0.0045, Math.PI, ink);
  d.text('FLAP', at(713, 344), 0.0045, Math.PI, ink);
  for (const value of [0, 15, 30, 40]) {
    const y = my + 0.06 - value * 0.0012;
    d.text(String(value), [mx - 0.043, y, z], 0.004, Math.PI, ink);
    d.rod([mx - 0.032, y, z], [mx - 0.026, y, z], 0.0005, ink);
  }
  const flap = group(cabin, 'PC12-flap-pointer', [mx - 0.019, my + 0.06, z - 0.002]),
    fd = detailKit(flap, flap.name);
  fd.rod([0, 0, 0], [-0.007, 0, 0], 0.001, ink);
  fd.finish();
  bindings.push({
    node: flap.name,
    source: 'flapDegrees',
    property: 'position',
    axis: 'y',
    scale: -0.0012,
  });
  ins.available('flap-pointer', 'flapPosition', flap.name);
  d.text('TRIM / ELEC / CABIN', at(682, 423), 0.005, Math.PI, ink);
  d.text('INOP', at(682, 445), 0.007, Math.PI, amber);
  // Standby display to pilot's left; independent attitude nodes share the same measured signals.
  const sx = px(285),
    sy = py(289);
  ins.horizon('ESIS', [sx, sy, z + 0.009], 0.06, 0.045);
  // A backing plane isolates the standby aperture from the neighboring moving PFD card.
  sheet(d, rect(sx, sy, 0.06, 0.045, z + 0.011), black, [0, 0, -1]);
  sheet(
    d,
    rect(sx, sy, 0.077, 0.067, z - 0.004),
    black,
    [0, 0, -1],
    [rect(sx, sy, 0.06, 0.045, z - 0.004)],
  );
  pt.knob(sx + 0.017, sy - 0.041, z - 0.015, 0.005);
  ins.readout('ESIS-speed', [sx + 0.024, sy, z - 0.006], 'knots', 3, 0.0045, ink, false, true);
  ins.readout('ESIS-altitude', [sx - 0.021, sy, z - 0.006], 'feet', 5, 0.0034, ink, true, true);
  // Brow guidance controller, audio panels and side PFD controllers.
  for (const [u, v, w, h] of [
    [682, 128, 0.27, 0.056],
    [471, 149, 0.17, 0.049],
    [899, 149, 0.17, 0.049],
    [540, 276, 0.053, 0.18],
    [826, 276, 0.053, 0.18],
  ]) {
    beveledBox(d, [w, h, 0.018], at(u, v, -0.012), black, 0.005);
    for (let n = 0; n < 5; n++) {
      const x = px(u) + w * 0.4 - n * w * 0.2;
      pt.knob(x, py(v) - h * 0.23, z - 0.028, 0.004);
      d.box([0.012, 0.006, 0.003], [x, py(v) + h * 0.22, z - 0.024], face);
    }
    if (h > 0.1)
      for (let n = 0; n < 7; n++) {
        pt.knob(px(u), py(v) + 0.07 - n * 0.022, z - 0.025, 0.005);
      }
  }
  for (const [u, label] of [
    [609, 'SPD'],
    [650, 'HDG'],
    [692, 'NAV'],
    [735, 'ALT'],
  ])
    d.text(label, at(u, 113, -0.025), 0.004, Math.PI, ink);
  for (const side of [-1, 1]) {
    const x = px(side === 1 ? 184 : 1182);
    pt.vent(x, py(348), z - 0.04, 'round', 0.028);
    for (let row = 0; row < 2; row++)
      for (let n = 0; n < 5; n++)
        pt.knob(side * 0.24 + (n - 2) * 0.022, 2.11 - row * 0.028, z - 0.02, 0.004);
  }
  const gear = group(cabin, 'PC12-gear-handle', at(552, 442, -0.04)),
    gd = detailKit(gear, gear.name);
  gd.rod([0, 0, 0], [0, -0.022, -0.025], 0.005, m.metal);
  gd.add(
    new T.CylinderGeometry(0.013, 0.013, 0.012, 16).rotateX(Math.PI / 2),
    black,
    [0, -0.025, -0.028],
  );
  gd.finish();
  bindings.push({
    node: gear.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    offset: -0.7,
    scale: 0.7,
  });
  // Distinct silver-center U yokes. Positive roll is right-bank, toward local -X.
  for (const u of [375, 997]) {
    const g = group(cabin, `PC12-yoke-${u}`, at(u, 414, -0.2)),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0.2], [0, 0, -0.03], 0.023, m.metal);
    const path = [
      [-0.132, 0.096, -0.045],
      [-0.145, 0.02, -0.045],
      [-0.126, -0.028, -0.045],
      [-0.052, -0.036, -0.045],
      [0, -0.014, -0.045],
      [0.052, -0.036, -0.045],
      [0.126, -0.028, -0.045],
      [0.145, 0.02, -0.045],
      [0.132, 0.096, -0.045],
    ].map((p) => new T.Vector3(...p));
    dd.add(new T.TubeGeometry(new T.CatmullRomCurve3(path), 48, 0.017, 8, false), black);
    const hub = new T.Shape();
    [
      [-0.025, 0.075],
      [0.025, 0.075],
      [0.045, 0.012],
      [0.028, -0.07],
      [-0.028, -0.07],
      [-0.045, 0.012],
    ].forEach(([x, y], i) => {
      if (i) hub.lineTo(x, y);
      else hub.moveTo(x, y);
    });
    hub.closePath();
    const hg = new T.ExtrudeGeometry(hub, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSize: 0.005,
      bevelThickness: 0.005,
      bevelSegments: 1,
      steps: 1,
    });
    dd.add(hg, m.metal, [0, 0, -0.07]);
    dd.text('PILATUS', [0, 0, -0.078], 0.007, Math.PI, ink);
    for (const side of [-1, 1]) {
      beveledBox(dd, [0.046, 0.035, 0.043], [side * 0.13, 0.097, -0.045], black, 0.008);
      dd.box([0.012, 0.006, 0.013], [side * 0.13, 0.116, -0.045], d.red);
    }
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.06 },
    );
  }
  const pedestal = group(cabin, 'PC12-pedestal', [0, 1.63, 2.2]),
    pd = detailKit(pedestal, pedestal.name);
  beveledBox(pd, [0.29, 0.38, 1.25], [0, 0, 0], face, 0.025);
  // Touchscreen above the single power lever, followed by the cursor controller.
  const touch = group(cabin, 'PC12-touchscreen', [0, 1.93, 2.65]);
  touch.rotation.x = -0.35;
  const dd = detailKit(touch, touch.name);
  beveledBox(dd, [0.147, 0.12, 0.02], [0, 0, 0], black, 0.008);
  dd.text('AVIONICS', [0, 0.03, -0.014], 0.007, Math.PI, ink);
  dd.text('INOP', [0, 0, -0.014], 0.009, Math.PI, amber);
  for (const x of [-0.04, 0, 0.04])
    dd.add(new T.CylinderGeometry(0.005, 0.005, 0.009, 12).rotateX(Math.PI / 2), m.metal, [
      x,
      -0.047,
      -0.02,
    ]);
  dd.finish();
  const power = group(pedestal, 'PC12-power', [0.055, 0.2, 0.06]),
    powerD = detailKit(power, power.name);
  powerD.rod([0, 0, 0], [0, 0.14, -0.055], 0.009, m.metal);
  beveledBox(powerD, [0.085, 0.043, 0.06], [0, 0.14, -0.055], black, 0.012);
  powerD.finish();
  bindings.push({
    node: power.name,
    source: 'power',
    property: 'rotation',
    axis: 'x',
    offset: -0.3,
    scale: 0.65,
  });
  const flapLever = group(pedestal, 'PC12-flap-handle', [-0.09, 0.22, 0.2]),
    flapD = detailKit(flapLever, flapLever.name);
  flapD.rod([0, 0, 0], [0, 0.03, 0], 0.005, m.metal);
  flapD.box([0.034, 0.018, 0.03], [0, 0.035, 0], black);
  flapD.finish();
  bindings.push({
    node: flapLever.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'z',
    scale: -0.08,
  });
  pd.ring(0.035, 0.008, [0, 0.205, -0.37], black, 'y');
  pd.box([0.105, 0.012, 0.09], [0, 0.21, -0.51], black);
  for (const x of [-0.1, 0.1]) pd.box([0.022, 0.01, 0.025], [x, 0.205, -0.36], m.metal);
  pd.finish();
  // Actual cockpit side panels, footwell and overhead equipment.
  for (const side of [-1, 1]) {
    const g = group(cabin, `PC12-side-panel-${side}`, [side * 0.68, 1.73, 2.18]);
    g.rotation.y = -side * 0.95;
    const sd = detailKit(g, g.name);
    beveledBox(sd, [0.28, 0.42, 0.025], [0, 0, 0], face, 0.01);
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 5; col++) {
        const x = -0.11 + col * 0.055,
          y = -0.16 + row * 0.046;
        sd.box([0.029, 0.016, 0.005], [x, y, -0.018], black);
        sd.add(new T.CylinderGeometry(0.0035, 0.0035, 0.005, 8).rotateX(Math.PI / 2), m.metal, [
          x,
          y,
          -0.025,
        ]);
      }
    sd.finish();
    d.box([0.06, 0.4, 1.38], [side * 0.68, 1.48, 2.4], face);
    d.ring(0.05, 0.006, [side * 0.64, 1.7, 1.87], m.metal, 'y');
    for (const j of [-1, 1]) {
      const g = group(cabin, `PC12-pedal-${side}-${j}`, [side * 0.35 + j * 0.09, 1.37, 2.76]),
        dd = detailKit(g, g.name);
      dd.box([0.14, 0.09, 0.04], [0, 0, 0], m.metal);
      for (let n = 0; n < 4; n++)
        dd.box([0.006, 0.06, 0.006], [-0.05 + n * 0.033, 0, -0.023], black);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.045,
      });
    }
  }
  d.box([1.3, 0.03, 6.7], [0, 1.25, -0.3], m.dark);
  d.box([1.3, 0.78, 0.025], [0, 1.64, 3.1], face);
  for (const side of [-1, 1]) {
    beveledBox(d, [0.45, 0.68, 0.03], [side * 0.37, 1.61, 3.075], black, 0.025);
    for (const zz of [2.4, 2.65])
      d.rod([side * 0.52, 1.27, zz], [side * 0.22, 1.27, zz], 0.009, m.metal);
    const x = side * 0.25;
    for (let row = 0; row < 2; row++) {
      const y = 2.11 - row * 0.028;
      d.box([0.14, 0.023, 0.006], [x, y, z - 0.008], black);
      for (let n = 0; n < 5; n++)
        d.text(
          ['BAT', 'GEN', 'ICE', 'LTS', 'TEST'][n],
          [x + 0.052 - n * 0.026, y + 0.012, z - 0.014],
          0.003,
          Math.PI,
          ink,
        );
    }
  }
  const oh = group(cabin, 'PC12-overhead', [0, 2.73, 2.25]);
  oh.rotation.x = -0.7;
  const od = detailKit(oh, oh.name);
  beveledBox(od, [0.26, 0.3, 0.02], [0, 0, 0], face, 0.01);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++)
      od.box([0.035, 0.024, 0.008], [-0.09 + col * 0.06, -0.1 + row * 0.065, -0.02], black);
  od.finish();
  // Two crew and six executive seats, with broad tapered backs and a center aisle.
  for (const [row, zz, facing] of [
    [0, 1.85, 0],
    [1, 0.25, Math.PI],
    [2, -1.32, 0],
    [3, -2.9, 0],
  ])
    for (const side of [-1, 1]) {
      const g = group(cabin, `PC12-seat-${row}-${side}`, [side * 0.39, 1.56, zz]);
      g.rotation.y = facing;
      const dd = detailKit(g, g.name);
      beveledBox(dd, [0.47, 0.15, 0.5], [0, 0, 0], leather, 0.04);
      const backShape = new T.Shape();
      const backContour = [
        [-0.17, 0.04],
        [-0.215, 0.16],
        [-0.205, 0.45],
        [-0.14, 0.64],
        [0.14, 0.64],
        [0.205, 0.45],
        [0.215, 0.16],
        [0.17, 0.04],
      ];
      backContour.forEach(([x, y], i) => {
        if (i) backShape.lineTo(x, y);
        else backShape.moveTo(x, y);
      });
      backShape.closePath();
      const back = dd.add(
        new T.ExtrudeGeometry(backShape, {
          depth: 0.07,
          bevelEnabled: true,
          bevelSize: 0.018,
          bevelThickness: 0.018,
          bevelSegments: 2,
          steps: 1,
        }),
        leather,
        [0, 0, -0.245],
      );
      back.rotation.x = -0.08;
      outline(
        dd,
        backContour.map(([x, y]) => [x * 0.89, y * 0.91 + 0.025, -0.142 - y * 0.08]),
        0.0015,
        wood,
      );
      beveledBox(dd, [0.26, 0.16, 0.11], [0, 0.73, -0.24], leather, 0.035);
      beveledBox(dd, [0.285, 0.35, 0.035], [0, 0.32, -0.15], liner, 0.011);
      for (const yy of [0.19, 0.42]) dd.rod([-0.13, yy, -0.13], [0.13, yy, -0.13], 0.0015, wood);
      for (const x of [-0.21, 0.21]) {
        dd.rod([x, 0.2, -0.13], [x, 0.2, 0.17], 0.026, leather);
        dd.rod([x, -0.22, -0.1], [x, -0.05, -0.1], 0.015, m.metal);
      }
      dd.rod([-0.17, 0.087, -0.12], [0.17, 0.087, 0.1], 0.013, black);
      dd.box([0.035, 0.018, 0.035], [0, 0.092, 0], m.metal);
      dd.finish();
    }
  for (const side of [-1, 1]) {
    d.box([0.04, 0.43, 4.8], [side * 0.72, 1.57, -1.15], liner);
    d.box([0.09, 0.025, 4.8], [side * 0.685, 1.8, -1.15], wood);
    for (const zz of [-0.5, -2.4]) {
      beveledBox(d, [0.018, 0.36, 0.7], [side * 0.68, 1.57, zz], wood, 0.006);
      for (const delta of [-0.35, 0.35])
        d.ring(0.037, 0.005, [side * 0.7, 1.82, zz + delta], m.metal, 'y');
    }
    for (const zz of [0.25, -1.32, -2.9]) {
      d.ring(0.025, 0.005, [side * 0.37, 2.69, zz], m.metal, 'y');
      ellipsoid(d, [side * 0.37, 2.68, zz], [0.015, 0.01, 0.015], black, 10);
    }
  }
  sheet(
    d,
    [
      [-0.5, 2.7, 1.5],
      [0.5, 2.7, 1.5],
      [0.5, 2.7, -2.7],
      [0.37, 2.66, -3.72],
      [-0.37, 2.66, -3.72],
      [-0.5, 2.7, -2.7],
    ],
    liner,
    [0, -1, 0],
  );
  d.box([0.4, 1.2, 0.4], [-0.39, 1.87, -3.45], wood);
  sheet(
    d,
    [
      [-0.61, 1.27, -3.72],
      [-0.61, 2.2, -3.72],
      [-0.5, 2.53, -3.72],
      [-0.37, 2.66, -3.72],
      [0.37, 2.66, -3.72],
      [0.5, 2.53, -3.72],
      [0.61, 2.2, -3.72],
      [0.61, 1.27, -3.72],
    ],
    liner,
    [0, 0, 1],
  );
  beveledBox(d, [0.4, 1.2, 0.025], [0.22, 1.9, -3.7], wood, 0.01);
  d.rod([0.08, 1.85, -3.68], [0.08, 1.94, -3.68], 0.009, m.metal);
  d.box([0.025, 1.38, 0.62], [0.55, 1.94, 0.95], liner);
  d.finish();
  // Identical crew displays share calculations, while retaining independent physical nodes.
  for (const [name, value] of Object.entries(derived)) {
    if (!name.includes('PFD-R')) continue;
    const shared = name.replaceAll('PFD-R', 'PFD-L');
    const normalized =
      typeof value === 'object'
        ? {
            ...value,
            args: value.args.map((v) =>
              typeof v === 'string' ? v.replaceAll('PFD-R', 'PFD-L') : v,
            ),
          }
        : value;
    if (JSON.stringify(normalized) !== JSON.stringify(derived[shared])) continue;
    for (const binding of bindings) if (binding.source === name) binding.source = shared;
    for (const expression of Object.values(derived))
      if (typeof expression === 'object')
        expression.args = expression.args.map((v) => (v === name ? shared : v));
    delete derived[name];
  }
  return { nodes: ['cockpit'], sources, derived, bindings };
}
