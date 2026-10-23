/** Cessna 182T NAV III / GFC700, 2007 handbook fit. Main axle origin, +Z nose.
 * Independently measured airframe and panel; see the per-model reference review.
 */
import { panelTools } from '../vehicle-interiors.mjs';
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
export const cessna182Frame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.6,
  cy: 1.18,
  ry: 0.74,
  cabinZ: 0.5,
  cabinWidth: 1.07,
  eye: [0.28, 1.81, 0.5],
  panelZ: 1.5,
  floor: 0.62,
});
export function buildCessna182(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Skylane-white', '#e6e7df', { side: T.DoubleSide }),
    accent = mat('Skylane-green', '#315653', { side: T.DoubleSide }),
    metal = mat('Skylane-alloy', '#a3aaa6', { metalness: 0.65 }),
    dark = mat('Skylane-trim', '#292f31'),
    rubber = mat('Skylane-tires', '#232929'),
    glass = mat('Skylane-glazing', '#b1c9d0', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.16,
    });
  const d = detailKit(root, 'Skylane-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  const sections = [
    [2.72, 0.37, 0.92, 1.49],
    [2.54, 0.46, 0.71, 1.54],
    [1.5, 0.565, 0.55, 1.58],
    [0.82, 0.58, 0.53, 2.02],
    [0.4, 0.6, 0.51, 2.06],
    [-0.27, 0.6, 0.51, 2.02],
    [-1.13, 0.53, 0.55, 1.83],
    [-1.52, 0.46, 0.59, 1.55],
    [-3.65, 0.21, 0.92, 1.57],
    [-4.7, 0.125, 1.14, 1.55],
    [-5.1, 0.06, 1.39, 1.51],
  ];
  const rings = sections.map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.78, t - 0.025],
      [w, t - 0.14],
      [w, b + 0.16],
      [w * 0.67, b],
      [0, b - 0.025],
      [-w * 0.67, b],
      [-w, b + 0.16],
      [-w, t - 0.14],
      [-w * 0.78, t - 0.025],
    ],
  }));
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 2 && [0, 1, 8, 9].includes(j)) ||
      ([3, 4, 5].includes(i) && [2, 7].includes(j)) ||
      (i === 6 && [0, 1, 8, 9].includes(j)),
  });
  for (const j of [0, 1, 8, 9]) {
    quad(d, p(2, j), p(3, j), p(3, (j + 1) % 10), p(2, (j + 1) % 10), glass, [0, 1, 1]);
    quad(d, p(6, j), p(7, j), p(7, (j + 1) % 10), p(6, (j + 1) % 10), glass, [0, 1, -1]);
  }
  outline(
    d,
    [p(2, 8), p(3, 8), p(3, 9), p(3, 0), p(3, 1), p(3, 2), p(2, 2), p(2, 1), p(2, 0), p(2, 9)],
    0.012,
    paint,
  );
  d.rod(p(6, 0), p(7, 0), 0.01, paint);
  for (const side of [-1, 1]) {
    const j = side > 0 ? 2 : 7;
    for (const [start, end] of [
      [3, 5],
      [5, 6],
    ]) {
      const a = p(start, j),
        b = p(end, j),
        c = p(end, j + 1),
        e = p(start, j + 1);
      const q = (u, v) => {
        const t = side > 0 ? v : 1 - v;
        return a.map(
          (_, n) => (a[n] * (1 - u) + b[n] * u) * (1 - t) + (e[n] * (1 - u) + c[n] * u) * t,
        );
      };
      const uv =
        start === 3
          ? [
              [0.09, 0.12],
              [0.15, 0.07],
              [0.88, 0.07],
              [0.93, 0.13],
              [0.93, 0.38],
              [0.86, 0.43],
              [0.12, 0.43],
              [0.07, 0.36],
            ]
          : [
              [0.08, 0.12],
              [0.75, 0.14],
              [0.94, 0.25],
              [0.77, 0.39],
              [0.07, 0.42],
            ];
      const h = uv.map(([u, v]) => q(u, v));
      const contour = [a, b, c, e];
      if (start === 3) {
        contour.splice(1, 0, p(4, j));
        contour.splice(4, 0, p(4, j + 1));
      }
      sheet(d, contour, paint, [side, 0, 0], [h]);
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.007, dark);
    }
    outline(
      d,
      [
        [side * 0.586, 1.88, 0.8],
        [side * 0.605, 1.87, -0.27],
        [side * 0.605, 0.67, -0.27],
        [side * 0.57, 0.62, 0.73],
      ],
      0.003,
      metal,
    );
    d.box([0.02, 0.024, 0.15], [side * 0.608, 1.17, -0.08], metal);
    for (const z of [0.62, 0.17]) d.box([0.02, 0.05, 0.026], [side * 0.59, 1.82, z], metal);
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i],
        b = sections[i + 1],
        y = (q) => q[2] + 0.27;
      quad(
        d,
        [side * (a[1] + 0.003), y(a), a[0]],
        [side * (b[1] + 0.003), y(b), b[0]],
        [side * (b[1] + 0.003), y(b) + 0.08, b[0]],
        [side * (a[1] + 0.003), y(a) + 0.08, a[0]],
        accent,
        [side, 0, 0],
      );
      for (let t = 0; t < 1; t += 0.13 / Math.abs(b[0] - a[0]))
        d.add(new T.SphereGeometry(0.0026, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t + 0.004),
          y(a) + (y(b) - y(a)) * t - 0.04,
          a[0] + (b[0] - a[0]) * t,
        ]);
    }
    for (const i of [1, 2, 7, 8, 9])
      outline(
        d,
        rings[i].points.map((q) => [...q, rings[i].z]),
        0.0018,
        metal,
      );
    if (side > 0)
      outline(
        d,
        [
          [0.51, 1.35, -1.02],
          [0.44, 1.35, -1.58],
          [0.44, 0.67, -1.58],
          [0.51, 0.62, -1.02],
        ],
        0.003,
        metal,
      );
    const y = (x) => 1.93 + Math.max(0, Math.abs(x) - 0.6) * 0.0262,
      le = (x) => 0.72 - Math.max(0, Math.abs(x) - 2.55) * 0.045,
      te = (x) => -0.9 + Math.max(0, Math.abs(x) - 2.55) * 0.13,
      hinge = (x) => te(x) + (x < 2.56 ? 0.36 : 0.27);
    wing(
      d,
      [
        [side * 0.55, y(0.55), le(0.55), hinge(0.55), 0.11],
        [side * 2.55, y(2.55), le(2.55), hinge(2.55), 0.11],
        [side * 2.57, y(2.57), le(2.57), hinge(2.57), 0.11],
        [side * 5.3, y(5.3), le(5.3), hinge(5.3), 0.07],
        [side * 5.4584, y(5.4584), le(5.4584) - 0.035, te(5.4584) + 0.03, 0.05],
      ],
      paint,
    );
    for (const [kind, begin, end] of [
      ['flap', 0.61, 2.55],
      ['aileron', 2.57, 5.3],
    ]) {
      const g = group(root, `Skylane-${kind}-${side}`, [side * begin, y(begin), hinge(begin)]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(begin) - hinge(begin), 0.015],
          [
            side * (end - begin),
            y(end) - y(begin),
            hinge(end) - hinge(begin),
            te(end) - hinge(begin),
            0.013,
          ],
        ],
        paint,
      );
      for (let x = begin + 0.07; x < end; x += 0.085)
        dd.rod(
          [side * (x - begin), y(x) - y(begin) + 0.008, hinge(x) - hinge(begin) - 0.025],
          [side * (x - begin), y(x) - y(begin) + 0.008, te(x) - hinge(begin) + 0.018],
          0.002,
          metal,
        );
      dd.finish();
      (kind === 'flap' ? flaps : ailerons).push({
        node: g.name,
        axis: 'x',
        multiplier: kind === 'flap' ? -Math.PI / 6 : -side * 0.28,
      });
    }
    for (let x = 0.8; x < 5.2; x += 0.3)
      for (let u = 0.1; u < 0.91; u += 0.12) {
        const h = 0.11 - Math.max(0, x - 2.55) * 0.014;
        const yy =
          u < 0.25
            ? (h * u) / 0.25
            : u < 0.75
              ? h * (1 - (u - 0.25) * 0.96)
              : (h * 0.52 * (1 - u)) / 0.25;
        d.add(new T.SphereGeometry(0.0025, 5, 3), metal, [
          side * x,
          y(x) + yy + 0.002,
          le(x) - u * (le(x) - hinge(x)),
        ]);
      }
    const a = new T.Vector3(side * 0.57, 0.68, 0.76),
      b = new T.Vector3(side * 2.7, y(2.7) - 0.015, 0.55),
      v = b.clone().sub(a);
    const strut = d.box(
      [0.065, v.length(), 0.19],
      a.clone().addScaledVector(v, 0.5).toArray(),
      paint,
    );
    strut.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    ellipsoid(d, a.toArray(), [0.065, 0.05, 0.17], paint, 12);
    d.add(new T.SphereGeometry(0.028, 10, 6), side > 0 ? d.red : d.green, [
      side * 5.4584,
      y(5.4584),
      0.3,
    ]);
    if (side > 0) {
      d.box([0.19, 0.045, 0.036], [3.62, y(3.62), le(3.62) + 0.012], dark);
      for (const dx of [-0.046, 0.046])
        d.add(new T.CircleGeometry(0.019, 12), d.ivory, [3.62 + dx, y(3.62), le(3.62) + 0.032]);
    }
    d.rod([side * 0.59, 0.56, 0.2], [side * 0.8, 0.35, 0.18], 0.014, metal);
    d.box([0.24, 0.025, 0.15], [side * 0.83, 0.35, 0.18], dark);
    wing(
      d,
      [
        [0, 1.47, -3.69, -4.4, 0.065],
        [side * 1.64, 1.47, -3.86, -4.4, 0.04],
        [side * 1.778, 1.47, -3.93, -4.61, 0.026],
      ],
      paint,
    );
    const eg = group(root, `Skylane-elevator-${side}`, [0, 1.47, -4.41]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.13, 0, 0, -0.5, 0.019],
        [side * 1.64, 0, 0, -0.34, 0.016],
      ],
      paint,
    );
    for (let x = 0.2; x < 1.62; x += 0.08)
      ed.rod([side * x, 0.015, -0.02], [side * x, 0.015, -0.49 + x * 0.095], 0.002, metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'elevator',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
  }
  const fin = [
    [-2.08, 1.56],
    [-3.82, 1.68],
    [-4.12, 1.82],
    [-5.05, 2.76],
    [-5.22, 2.79],
    [-5.48, 2.73],
    [-4.85, 1.45],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map(([z, y]) => [side * 0.034, y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-0.034, a[1], a[0]],
      [-0.034, b[1], b[0]],
      [0.034, b[1], b[0]],
      [0.034, a[1], a[0]],
      paint,
      [0, 1, 0],
    );
  }
  const rud = group(root, 'Skylane-rudder', [0, 1.45, -4.85]),
    rd = detailKit(rud, rud.name);
  const rc = [
    [0, 0],
    [-0.63, 1.28],
    [-0.86, 1.25],
    [-0.32, -0.12],
    [-0.08, -0.18],
  ];
  for (const side of [-1, 1]) {
    sheet(
      rd,
      rc.map(([z, y]) => [side * 0.035, y, z]),
      paint,
      [side, 0, 0],
    );
    for (let t = 0.05; t < 1; t += 0.055)
      rd.add(new T.SphereGeometry(0.0027, 5, 3), metal, [
        side * 0.038,
        t * 1.28,
        -0.63 * t - 0.025,
      ]);
  }
  rd.finish();
  bindings.push({
    node: rud.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  d.add(new T.CylinderGeometry(0.028, 0.028, 0.06, 12), d.red, [0, 2.815, -5.15]);
  for (const side of [-1, 1]) {
    d.rod([side * 0.025, 2.36, -5.04], [side * 0.35, 2.36, -4.78], 0.005, metal);
    d.rod([side * 0.12, 2.04, -0.1], [side * 0.12, 2.32, -0.42], 0.007, paint);
    ellipsoid(d, [side * 0.19, 1.34, 2.728], [0.135, 0.075, 0.014], dark, 16);
    d.rod([side * 0.29, 0.7, 1.83], [side * 0.29, 0.56, 1.7], 0.024, metal);
  }
  d.rod([0, 1.57, -1.85], [0, 1.83, -2.02], 0.007, paint);
  ellipsoid(d, [0, 1.02, 2.734], [0.09, 0.055, 0.012], dark, 16);
  const engine = group(root, 'engine-1', [0, 1.279525, 2.735]),
    prop = group(engine, 'Skylane-propeller'),
    pd = detailKit(prop, prop.name);
  pd.add(new T.ConeGeometry(0.15, 0.3942, 24).rotateX(Math.PI / 2), metal, [0, 0, 0.1971]);
  for (let n = 0; n < 3; n++) {
    const bg = group(prop, `Skylane-prop-blade-${n}`);
    bg.rotation.z = (n * Math.PI * 2) / 3 + Math.PI / 2;
    const bd = detailKit(bg, bg.name),
      pts = [
        [0.1, -0.035, 0],
        [0.35, -0.07, 0.01],
        [0.86, -0.05, 0],
        [1.0033, -0.018, -0.012],
        [1.0033, 0.035, -0.012],
        [0.6, 0.085, 0.01],
        [0.13, 0.04, 0],
      ];
    sheet(bd, pts, dark, [0, 0, 1]);
    sheet(
      bd,
      pts.map((p) => [p[0], p[1], p[2] - 0.014]),
      dark,
      [0, 0, -1],
    );
    bd.box([0.055, 0.06, 0.016], [0.965, 0.01, -0.012], paint);
    bd.finish();
  }
  pd.finish();
  for (const [x, z, r] of [
    [0, 1.6891, 0.22],
    [1.3716, 0, 0.25],
    [-1.3716, 0, 0.25],
  ]) {
    if (x) {
      const a = new T.Vector3(Math.sign(x) * 0.54, 0.55, -0.07),
        b = new T.Vector3(x, 0.28, 0),
        v = b.clone().sub(a);
      const leg = d.box(
        [0.065, v.length(), 0.17],
        a.clone().addScaledVector(v, 0.5).toArray(),
        paint,
      );
      leg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    } else {
      d.rod([0, 0.72, 1.62], [0, 0.33, z], 0.028, metal);
      for (const side of [-1, 1])
        d.rod([side * 0.085, 0.38, z - 0.03], [side * 0.085, r, z], 0.018, paint);
    }
    d.add(new T.CylinderGeometry(r, r, 0.16, 28).rotateZ(Math.PI / 2), rubber, [x, r, z]);
    for (const side of [-1, 1])
      d.add(new T.CircleGeometry(r * 0.5, 20).rotateY((side * Math.PI) / 2), metal, [
        x + side * 0.082,
        r,
        z,
      ]);
    const pant = [
      [0.4, 0.035, 0.3, 0.37],
      [0.28, 0.145, 0.24, 0.45],
      [0.02, 0.17, 0.21, 0.48],
      [-0.38, 0.13, 0.24, 0.39],
      [-0.52, 0.025, 0.28, 0.32],
    ].map(([zz, w, b, t]) => ({
      z: z + zz,
      points: [
        [x, t],
        [x + w * 0.7, t - 0.02],
        [x + w, t - 0.06],
        [x + w * 0.8, b],
        [x, b],
        [x - w * 0.8, b],
        [x - w, t - 0.06],
        [x - w * 0.7, t - 0.02],
      ],
    }));
    loft(d, pant, paint);
  }
  d.finish();
  const interior = cockpit(root, { paint, accent, metal, dark });
  cleanGeometry(root);
  return {
    root,
    frame: cessna182Frame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.279525, 2.735] }],
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
function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Skylane-cabin'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Skylane');
  const { bindings, derived, ink, black, red } = instruments;
  const face = mat('Skylane-panel', '#757b74'),
    seats = mat('Skylane-seats', '#b9b5a7'),
    propBlue = mat('Skylane-prop-blue', '#3e8ba1');
  const k = 0.29972 / 232,
    px = (u) => (607 - u) * k,
    py = (v) => 1.4 - (v - 550) * k,
    z = 1.5,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [181, 728],
    [172, 558],
    [193, 500],
    [247, 455],
    [380, 450],
    [607, 450],
    [929, 451],
    [982, 497],
    [1007, 552],
    [985, 728],
  ];
  const screens = [
      [411, 550],
      [681, 550],
    ],
    sw = 0.211328,
    sh = 0.158496;
  const holes = screens.map(([u, v]) => rect(px(u), py(v), sw + 0.002, sh + 0.002));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(607) + Math.cos((i * Math.PI) / 20) * 0.034,
      py(672) + Math.sin((i * Math.PI) / 20) * 0.034,
      z,
    ]),
  );
  sheet(
    d,
    edge.map((p) => at(...p)),
    face,
    [0, 0, -1],
    holes,
  );
  sheet(
    d,
    edge.map((p) => at(...p, 0.065)),
    m.dark,
    [0, 0, 1],
  );
  const brow = [
    [181, 700],
    [165, 552],
    [185, 493],
    [242, 443],
    [607, 436],
    [945, 440],
    [1002, 498],
    [1025, 552],
    [1006, 692],
  ].map((p) => at(...p, -0.012));
  outline(d, brow, 0.014, m.dark, false);
  const deckY = (x) =>
    1.573 - (Math.abs(x) < 0.44 ? Math.abs(x) * 0.057 : 0.025 + (Math.abs(x) - 0.44) * 0.92);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0], deckY(b[0]), 1.51], [a[0], deckY(a[0]), 1.51], m.dark, [0, 1, 0]);
  }
  for (const [u, v] of screens) {
    const x = px(u),
      y = py(v);
    sheet(
      d,
      rect(x, y, 0.29972, 0.19558, z - 0.006),
      black,
      [0, 0, -1],
      [rect(x, y, sw, sh, z - 0.006)],
    );
    for (const side of [-1, 1])
      for (const yy of [-0.073, -0.039, 0.036, 0.075])
        pt.knob(x + side * 0.13, y + yy, z - 0.016, 0.009);
    for (let i = 0; i < 12; i++)
      d.box([0.01, 0.006, 0.004], [x + 0.098 - i * 0.018, y - 0.088, z - 0.013], m.dark);
    for (let i = 0; i < 5; i++)
      d.box([0.011, 0.005, 0.004], [x - 0.13, y - 0.011 + i * 0.009, z - 0.013], m.dark);
    for (const side of [-1, 1])
      for (const yy of [-0.089, 0.089]) pt.knob(x + side * 0.143, y + yy, z - 0.011, 0.0028);
  }
  // These sources also drive ordinary mountExperience/CLI scenes, without an Earth-only bridge.
  const sources = {
    trueAirspeed: { component: 'aircraftState', path: ['airspeed'] },
    altitude: { component: 'transform', path: ['pos', 1] },
    roll: { component: 'aircraftState', path: ['roll'] },
    pitch: { component: 'aircraftState', path: ['pitch'] },
    yaw: { component: 'aircraftState', path: ['yaw'] },
    propNormalized: { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] },
    verticalSpeed: { component: 'aircraftState', path: ['verticalSpeed'] },
    pitchInput: { component: 'aircraftInput', path: ['pitch'] },
    rollInput: { component: 'aircraftInput', path: ['roll'] },
    yawInput: { component: 'aircraftInput', path: ['yaw'] },
    power: { component: 'aircraftInput', path: ['power'] },
    elevator: { component: 'aircraftState', path: ['elevator'] },
  };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    propRpm: { op: 'multiply', args: ['propNormalized', 2400] },
    rpmTens: { op: 'divide', args: ['propRpm', 10] },
    rpmRoundedTens: { op: 'add', args: ['rpmTens', 0.5] },
    rpmWholeTens: { op: 'floor', args: ['rpmRoundedTens'] },
    rpmDisplay: { op: 'multiply', args: ['rpmWholeTens', 10] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', Math.PI * 2] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
  });
  const sx = px(411),
    sy = py(550);
  // Horizon is behind the cut-out panel/screen mask, so it cannot bleed outside the display.
  instruments.horizon('PFD-horizon', [sx, sy + 0.026, z + 0.012], 0.11, 0.068);
  const screenMask = rect(sx, sy, sw, sh, z + 0.007);
  sheet(
    d,
    screenMask,
    black,
    [0, 0, -1],
    [
      rect(sx, sy + 0.026, 0.11, 0.068, z + 0.007),
      rect(sx + 0.083, sy + 0.026, 0.031, 0.062, z + 0.007),
    ],
  );
  // The speed tape uses one translation plus per-row visibility; static geometry, no glyph churn.
  const tape = group(cabin, 'Skylane-speed-tape', [sx + 0.083, sy + 0.026, z + 0.009]);
  bindings.push({
    node: tape.name,
    source: 'knots',
    property: 'position',
    axis: 'y',
    scale: -0.001,
  });
  for (let value = 20; value <= 200; value += 10) {
    const row = group(tape, `Skylane-speed-tape-${value}`, [0, value * 0.001, 0]),
      dd = detailKit(row, row.name);
    dd.text(String(value), [0.002, 0, 0], 0.0045, Math.PI, ink);
    dd.rod([-0.008, 0, 0], [-0.014, 0, 0], 0.0004, ink);
    dd.finish();
    const distance = `tape.${value}.distance`,
      absolute = `tape.${value}.absolute`,
      show = `tape.${value}.show`;
    derived[distance] = { op: 'subtract', args: ['knots', value] };
    derived[absolute] = { op: 'abs', args: [distance] };
    derived[show] = { op: 'less', args: [absolute, 29] };
    bindings.push({ node: row.name, source: show, property: 'visible', scale: 1, missing: 'hide' });
  }
  d.box([0.029, 0.012, 0.001], [sx + 0.083, sy + 0.025, z + 0.004], black);
  // Readouts retain the real PFD locations. Small TAS/GEO labels disclose the current approximation.
  instruments.readout(
    'PFD-speed',
    [sx + 0.083, sy + 0.025, z + 0.002],
    'knots',
    3,
    0.01,
    ink,
    false,
    true,
  );
  instruments.readout(
    'PFD-altitude',
    [sx - 0.08, sy + 0.025, z + 0.002],
    'feet',
    5,
    0.0075,
    ink,
    true,
    true,
  );
  d.text('TAS', [sx + 0.083, sy + 0.065, z + 0.001], 0.006, Math.PI, ink);
  d.text('GEO FT', [sx - 0.081, sy + 0.047, z + 0.001], 0.005, Math.PI, ink);
  const vsi = group(cabin, 'Skylane-VSI', [sx - 0.101, sy + 0.025, z + 0.001]),
    vd = detailKit(vsi, 'VSI');
  vd.rod([-0.002, 0, 0], [0.002, 0.002, 0], 0.0008, ink);
  vd.rod([-0.002, 0, 0], [0.002, -0.002, 0], 0.0008, ink);
  vd.finish();
  bindings.push({
    node: vsi.name,
    source: 'verticalFpm',
    property: 'position',
    axis: 'y',
    scale: 0.000012,
    min: -0.024,
    max: 0.024,
    responseSeconds: 0.6,
  });
  instruments.available('VSI', 'verticalFpm', vsi.name);
  for (const fpm of [-2000, -1000, 0, 1000, 2000])
    d.rod(
      [sx - 0.097, sy + 0.025 + fpm * 0.000012, z + 0.002],
      [sx - 0.1, sy + 0.025 + fpm * 0.000012, z + 0.002],
      0.0004,
      ink,
    );
  const rose = group(cabin, 'Skylane-heading-rose', [sx, sy - 0.046, z + 0.002]),
    hr = detailKit(rose, 'heading-rose');
  for (let deg = 0; deg < 360; deg += 10) {
    const a = (deg * Math.PI) / 180,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hr.rod(p(deg % 30 ? 0.023 : 0.021), p(0.025), 0.0005, ink);
    if (deg % 30 === 0)
      hr.text(
        deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
        p(0.017),
        0.004,
        Math.PI,
        ink,
      );
  }
  hr.finish();
  bindings.push({
    node: rose.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: 2 * Math.PI,
    responseSeconds: 0.15,
  });
  instruments.available('heading', 'trueHeading', rose.name);
  d.text('TRUE', [sx, sy - 0.013, z + 0.001], 0.004, Math.PI, ink);
  d.rod([sx, sy - 0.024, z - 0.001], [sx, sy - 0.029, z - 0.001], 0.001, instruments.amber);
  d.text('NAV --  COM --', [sx, sy + 0.071, z + 0.001], 0.005, Math.PI, ink);
  // MFD engine sidebar. Oil, fuel, electrical and map data remain explicitly unavailable.
  const mx = px(681),
    my = py(550);
  sheet(d, rect(mx, my, sw, sh, z + 0.003), black, [0, 0, -1]);
  instruments.dial(
    'MFD-tach',
    [mx + 0.076, my + 0.041, z - 0.001],
    0.024,
    'propRpm',
    [
      [0, -2.35],
      [3000, 2.35],
    ],
    [0, 1000, 2000, 3000],
    'RPM',
    { responseSeconds: 0.1 },
  );
  instruments.readout('MFD-rpm', [mx + 0.076, my + 0.006, z - 0.016], 'rpmDisplay', 4, 0.006);
  for (const [label, yy] of [
    ['OIL --', -0.016],
    ['FUEL --', -0.031],
    ['VOLTS --', -0.046],
  ])
    d.text(label, [mx + 0.072, my + yy, z], 0.005, Math.PI, ink);
  d.rod([mx + 0.042, my - 0.074, z], [mx + 0.042, my + 0.074, z], 0.0006, ink);
  d.text('MAP DATA', [mx - 0.025, my + 0.012, z], 0.009, Math.PI, ink);
  d.text('UNAVAILABLE', [mx - 0.025, my - 0.003, z], 0.007, Math.PI, ink);

  d.box([0.03302, 0.19558, 0.012], at(542, 550, -0.008), black);
  for (let i = 0; i < 11; i++)
    for (const side of [-1, 1])
      d.box([0.009, 0.005, 0.004], at(542 + side * 7, 480 + i * 9, -0.018), m.dark);
  pt.knob(px(542), py(607), z - 0.02, 0.007);
  pt.knob(px(542), py(623), z - 0.02, 0.006);
  instruments.dial(
    'standby-speed',
    at(532, 672, -0.006),
    0.038,
    'knots',
    [
      [0, 0.25],
      [20, 0.3],
      [40, 0.7],
      [60, 1.25],
      [80, 1.9],
      [100, 2.65],
      [120, 3.5],
      [140, 4.12],
      [160, 4.65],
      [180, 5.1],
      [200, 5.55],
    ],
    [40, 60, 80, 100, 120, 140, 160, 180, 200],
    'TAS',
    { responseSeconds: 0.2, minorStep: 10 },
  );
  instruments.horizon('standby-attitude', at(607, 672, 0.008), 0.06, 0.06, { round: true });
  d.ring(0.034, 0.004, at(607, 672, -0.005), black);
  instruments.altimeter('standby-altimeter', at(680, 672, -0.006), 0.038, 'feet');
  d.box([1.04, 0.1, 0.027], at(607, 768, -0.003), black);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 14; col++)
      pt.knob(px(275 + col * 18), py(749 + row * 13), z - 0.02, 0.0038);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 6; col++) {
      const u = 278 + col * 22,
        v = 653 + row * 22;
      pt.knob(px(u), py(v), z - 0.022, 0.005);
      d.rod(at(u, v, -0.024), at(u, v - 8, -0.035), 0.0025, m.metal);
    }
  for (const u of [220, 253])
    d.box([0.017, 0.03, 0.011], at(u, 614, -0.012), u === 220 ? red : ink);
  d.box([0.18, 0.034, 0.015], at(902, 593, -0.01), black);
  d.text('ADF INOP', at(902, 593, -0.02), 0.008, Math.PI, ink);
  d.text('ELT', at(836, 488, -0.012), 0.006, Math.PI, ink);
  d.text('182T', at(915, 666, -0.012), 0.012, Math.PI, ink);
  for (const u of [206, 975]) pt.vent(px(u), py(645), z - 0.008, 'round', 0.04);
  for (const u of [397, 805]) {
    const g = group(cabin, `Skylane-yoke-${u}`, at(u, 701, -0.17)),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0.18], [0, 0, -0.06], 0.017, m.metal);
    outline(
      dd,
      [
        [-0.12, 0.11, -0.085],
        [-0.14, -0.025, -0.085],
        [-0.085, -0.045, -0.085],
        [0.085, -0.045, -0.085],
        [0.14, -0.025, -0.085],
        [0.12, 0.11, -0.085],
      ],
      0.017,
      m.dark,
      false,
    );
    beveledBox(dd, [0.075, 0.115, 0.035], [0, 0.012, -0.085], m.dark, 0.009);
    dd.text('182', [0, -0.02, -0.107], 0.009, Math.PI, ink);
    for (const side of [-1, 1]) dd.box([0.024, 0.016, 0.026], [side * 0.12, 0.108, -0.088], black);
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.05 },
    );
  }
  for (const [u, label, col] of [
    [576, 'throttle', black],
    [630, 'prop', propBlue],
    [677, 'mixture', red],
  ]) {
    const g = group(cabin, `Skylane-${label}`, at(u, 784, -0.065)),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0.075], [0, 0, -0.065], 0.007, m.metal);
    dd.add(
      new T.CylinderGeometry(0.019, 0.019, 0.025, label === 'mixture' ? 10 : 16).rotateX(
        Math.PI / 2,
      ),
      col,
      [0, 0, -0.071],
    );
    dd.finish();
    if (label === 'throttle')
      bindings.push({
        node: g.name,
        source: 'power',
        property: 'position',
        axis: 'z',
        scale: 0.055,
      });
  }
  const flap = group(cabin, 'Skylane-flap', at(723, 761, -0.036)),
    fd = detailKit(flap, flap.name);
  fd.box([0.02, 0.026, 0.025], [0, 0, 0], ink);
  fd.finish();
  sources.flapPosition = { component: 'aircraftState', path: ['flapPosition'] };
  bindings.push({
    node: flap.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'y',
    scale: -0.035,
  });
  d.text('FLAPS', at(723, 792, -0.025), 0.005, Math.PI, ink);
  const pedestal = group(cabin, 'Skylane-pedestal', [0, 0.85, 1.19]),
    dd = detailKit(pedestal, pedestal.name);
  beveledBox(dd, [0.17, 0.48, 0.2], [0, 0, 0], black);
  dd.ring(0.068, 0.009, [0.07, 0.09, -0.105], black, 'x');
  dd.ring(0.045, 0.007, [0, -0.02, -0.12], m.metal, 'y');
  dd.rod([0, -0.02, -0.13], [0.03, -0.02, -0.14], 0.006, ink);
  dd.box([0.028, 0.02, 0.045], [-0.04, -0.1, -0.13], black);
  dd.text('RUDDER TRIM', [0, 0.03, -0.13], 0.007, Math.PI, ink);
  dd.finish();
  d.box([0.17, 0.025, 0.45], [0, 0.65, 0.76], m.dark);
  d.ring(0.043, 0.004, [0, 0.67, 0.76], m.metal, 'y');
  d.rod([0, 0.68, 0.76], [-0.03, 0.68, 0.72], 0.008, ink);
  d.text('FUEL', [0, 0.7, 0.96], 0.008, Math.PI, ink);
  d.box([1.07, 0.035, 2.1], [0, 0.62, 0], m.dark);
  for (const zz of [0.3, -0.63])
    for (const x of [-0.28, 0.28]) {
      beveledBox(d, [0.46, 0.105, 0.48], [x, 0.83, zz], seats, 0.03);
      const back = group(cabin, `Skylane-seat-${x}-${zz}`, [x, 1.1, zz - 0.2]);
      back.rotation.x = -0.08;
      const sd = detailKit(back, back.name);
      beveledBox(sd, [0.45, 0.5, 0.15], [0, 0, 0], seats, 0.045);
      beveledBox(sd, [0.36, 0.19, 0.015], [0, -0.12, -0.084], m.dark, 0.004);
      for (const dx of [-0.08, 0.08]) sd.rod([dx, 0.23, 0], [dx, 0.32, 0], 0.008, m.metal);
      beveledBox(sd, [0.27, 0.14, 0.11], [0, 0.36, 0], seats, 0.03);
      sd.finish();
      for (const side of [-1, 1])
        d.rod([x + side * 0.15, 0.65, zz], [x + side * 0.15, 0.77, zz], 0.013, m.metal);
      d.rod([x - 0.18, 0.89, zz - 0.13], [x + 0.14, 0.89, zz + 0.17], 0.016, m.dark);
      d.box([0.045, 0.014, 0.036], [x, 0.9, zz + 0.08], m.metal);
    }
  for (const side of [-1, 1]) {
    d.box([0.025, 0.28, 1.45], [side * 0.562, 0.85, 0.05], seats);
    d.rod([side * 0.54, 1.06, 0.4], [side * 0.54, 1.06, 0.05], 0.017, m.dark);
    for (const j of [-1, 1]) {
      const g = group(cabin, `Skylane-pedal-${side}-${j}`, [side * 0.28 + j * 0.08, 0.71, 1.54]),
        pd = detailKit(g, g.name);
      pd.box([0.13, 0.06, 0.04], [0, 0, 0], m.metal);
      for (let t = 0; t < 4; t++)
        pd.box([0.003, 0.05, 0.004], [-0.047 + t * 0.031, 0, -0.023], black);
      pd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.035,
      });
    }
    d.box([0.3, 0.025, 0.26], [side * 0.33, 1.98, 0.75], seats);
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
