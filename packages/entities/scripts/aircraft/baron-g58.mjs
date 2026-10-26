/** 2016 Baron G58, TH-2453 onward equipment. Main axle origin; +Z nose, +X pilot left.
 * Manufacturer three-view and panel diagram, with exterior/cabin photographic checks.
 */
import { panelTools } from '../vehicle-interiors.mjs';
import { addG1000Bezels, addG1000Readouts } from './g1000-panel.mjs';
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

export const baronFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.625,
  cy: 1.3,
  ry: 0.76,
  cabinZ: 0.35,
  cabinWidth: 1.07,
  eye: [0.28, 1.88, 0.35],
  panelZ: 1.12,
  floor: 0.75,
});
export function buildBaron(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Baron-ivory', '#e6e6df', { side: T.DoubleSide }),
    accent = mat('Baron-navy', '#234367', { side: T.DoubleSide }),
    metal = mat('Baron-alloy', '#a7afaf', { metalness: 0.7 }),
    dark = mat('Baron-trim', '#262c31'),
    rubber = mat('Baron-tires', '#202728'),
    glass = mat('Baron-glazing', '#b2cbd0', {
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'Baron-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Stations follow the side-view roof/belly and independent plan-view half widths.
  const stations = [
    [3.25, 0.025, 1.19, 1.27],
    [2.6, 0.4, 0.87, 1.58],

    [1.42, 0.58, 0.59, 1.72],
    [0.6, 0.625, 0.59, 2.14],
    [-0.08, 0.625, 0.59, 2.12],
    [-0.78, 0.61, 0.59, 2.02],
    [-1.38, 0.57, 0.59, 1.91],
    [-2.03, 0.52, 0.6, 1.8],
    [-2.75, 0.43, 0.65, 1.73],
    [-3.75, 0.3, 0.76, 1.59],
    [-4.75, 0.15, 0.9, 1.4],
    [-5.8432, 0.025, 1.08, 1.16],
  ];
  const rings = stations.map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.75, t - 0.035],
      [w, t - 0.14],
      [w, b + 0.15],
      [w * 0.65, b],
      [0, b - 0.025],
      [-w * 0.65, b],
      [-w, b + 0.15],
      [-w, t - 0.14],
      [-w * 0.75, t - 0.035],
    ],
  }));
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      i < 2 ||
      (i === 2 && [0, 1, 8, 9].includes(j)) ||
      ([2, 3, 4, 5, 6].includes(i) && [2, 7].includes(j)),
  });
  const noseRings = [
    [3.25, 0.025, 1.19, 1.27],
    [3.18, 0.17, 1.12, 1.39],
    [2.95, 0.31, 0.96, 1.49],
    [2.6, 0.4, 0.87, 1.58],
    [2.1, 0.51, 0.71, 1.65],
    [1.42, 0.58, 0.59, 1.72],
  ].map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.75, t - 0.035],
      [w, t - 0.14],
      [w, b + 0.15],
      [w * 0.65, b],
      [0, b - 0.025],
      [-w * 0.65, b],
      [-w, b + 0.15],
      [-w, t - 0.14],
      [-w * 0.75, t - 0.035],
    ],
  }));
  loft(d, noseRings, paint, { caps: false });
  for (const j of [0, 1, 8, 9])
    quad(d, p(2, j), p(3, j), p(3, (j + 1) % 10), p(2, (j + 1) % 10), glass, [0, 1, 1]);
  outline(
    d,
    [p(2, 8), p(3, 8), p(3, 9), p(3, 0), p(3, 1), p(3, 2), p(2, 2), p(2, 1), p(2, 0), p(2, 9)],
    0.013,
    paint,
  );
  for (const side of [-1, 1]) {
    const j = side > 0 ? 2 : 7;
    const pilotPoint = (z, y) => [
      side * (z > 0.6 ? 0.625 - (z - 0.6) * (0.045 / 0.82) : 0.625),
      y,
      z,
    ];
    const pilotHole = [
      [1.02, 1.56],
      [0.57, 1.98],
      [0.48, 2.0],
      [0.02, 1.98],
      [0.0, 1.92],
      [0.0, 1.55],
      [0.06, 1.52],
      [0.95, 1.52],
    ].map(([z, y]) => pilotPoint(z, y));
    sheet(
      d,
      [p(2, j), p(3, j), p(4, j), p(4, j + 1), p(3, j + 1), p(2, j + 1)],
      paint,
      [side, 0, 0],
      [pilotHole],
    );
    sheet(d, pilotHole, glass, [side, 0, 0]);
    outline(d, pilotHole, 0.006, dark);
    if (side > 0) {
      const weather = [
        [0.97, 1.55],
        [0.97, 1.68],
        [0.74, 1.68],
        [0.74, 1.55],
      ].map(([z, y]) => pilotPoint(z, y));
      outline(d, weather, 0.003, metal);
      d.rod(weather[2], weather[3], 0.004, metal);
    }
    for (let i = 4; i <= 6; i++) {
      const a = p(i, j),
        b = p(i + 1, j),
        c = p(i + 1, j + 1),
        e = p(i, j + 1);
      const q = (u, v) => {
        const t = side > 0 ? v : 1 - v;
        return a.map(
          (_, n) => (a[n] * (1 - u) + b[n] * u) * (1 - t) + (e[n] * (1 - u) + c[n] * u) * t,
        );
      };
      const bottom = 1.48 - (i - 4) * 0.03;
      const hole = [
        q(0.08, 0.06),
        q(0.15, 0.025),
        q(0.85, 0.025),
        q(0.93, 0.075),
        q(0.93, 0.32),
        q(0.87, 0.36),
        q(0.13, 0.36),
        q(0.07, 0.31),
      ];
      for (let h = 4; h < 8; h++) hole[h][1] = bottom + (h === 4 || h === 7 ? 0.035 : 0);
      sheet(d, [a, b, c, e], paint, [side, 0, 0], [hole]);
      sheet(d, hole, glass, [side, 0, 0]);
      outline(d, hole, 0.006, dark);
    }
    // Two longitudinal bands and skin joints, using the local shell width at every station.
    for (let i = 2; i < stations.length - 3; i++) {
      const a = stations[i],
        b = stations[i + 1];
      for (const [offset, h] of [
        [0.28, 0.09],
        [0.43, 0.024],
      ])
        quad(
          d,
          [side * (a[1] + 0.002), a[2] + offset, a[0]],
          [side * (b[1] + 0.002), b[2] + offset, b[0]],
          [side * (b[1] + 0.002), b[2] + offset + h, b[0]],
          [side * (a[1] + 0.002), a[2] + offset + h, a[0]],
          accent,
          [side, 0, 0],
        );
      for (let t = 0; t < 1; t += 0.13 / Math.abs(b[0] - a[0]))
        d.add(new T.SphereGeometry(0.0025, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t + 0.003),
          a[2] + (b[2] - a[2]) * t + 0.22,
          a[0] + (b[0] - a[0]) * t,
        ]);
    }
    for (const i of [1, 2, 7, 8, 9, 10])
      outline(
        d,
        rings[i].points.map((q) => [...q, rings[i].z]),
        0.0016,
        metal,
      );
    if (side < 0) {
      outline(
        d,
        [
          [-0.628, 1.99, 0.57],
          [-0.628, 1.98, -0.08],
          [-0.628, 0.71, -0.08],
          [-0.588, 0.7, 1.15],
        ],
        0.003,
        metal,
      );
      d.box([0.02, 0.025, 0.13], [-0.632, 1.27, 0.02], metal);
      outline(
        d,
        [
          [-0.61, 1.88, -0.78],
          [-0.515, 1.66, -2.03],
          [-0.515, 0.7, -2.03],
          [-0.61, 0.69, -0.78],
        ],
        0.003,
        metal,
      );
      d.rod([-0.572, 1.76, -1.38], [-0.572, 0.68, -1.38], 0.003, metal);
      for (const z of [-1.24, -1.51]) d.box([0.02, 0.04, 0.08], [-0.575, 1.25, z], metal);
      d.box([0.24, 0.009, 0.8], [-0.76, 0.91, -0.31], dark);
      d.rod([-0.54, 0.62, -1.46], [-0.8, 0.31, -1.48], 0.015, metal);
      d.box([0.25, 0.025, 0.12], [-0.88, 0.31, -1.48], dark);
    }
    const y = (x) => 0.9 + Math.abs(x) * Math.tan(Math.PI / 30),
      chord = (x) => 2.27 - (1.32 * Math.abs(x)) / 5.74,
      le = (x) => 0.83 - (2.27 - chord(x)) * 0.25,
      te = (x) => le(x) - chord(x),
      hinge = (x) => te(x) + chord(x) * 0.23;
    wing(
      d,
      [
        [side * 0.52, y(0.52), le(0.52), hinge(0.52), 0.12],
        [side * 3.08, y(3.08), le(3.08), hinge(3.08), 0.09],
        [side * 5.51, y(5.51), le(5.51), hinge(5.51), 0.058],
        [side * 5.74, y(5.74), le(5.74) - 0.035, te(5.74) + 0.05, 0.035],
      ],
      paint,
    );
    // Fixed trailing-edge bay behind the nacelle, between the split flap panels.
    wing(
      d,
      [
        [side * 1.37, y(1.37), hinge(1.37), te(1.37), 0.018],
        [side * 2.12, y(2.12), hinge(2.12), te(2.12), 0.016],
      ],
      paint,
    );
    for (const [kind, begin, end] of [
      ['flap', 0.58, 1.37],
      ['flap', 2.12, 3.08],
      ['aileron', 3.11, 5.52],
    ]) {
      const g = group(root, `Baron-${kind}-${side}-${Math.round(begin * 100)}`, [
          side * begin,
          y(begin),
          hinge(begin),
        ]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(begin) - hinge(begin), 0.018],
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
      for (let x = begin + 0.07; x < end; x += 0.11)
        dd.rod(
          [side * (x - begin), y(x) - y(begin) + 0.015, hinge(x) - hinge(begin) - 0.015],
          [side * (x - begin), y(x) - y(begin) + 0.008, te(x) - hinge(begin) + 0.02],
          0.0018,
          metal,
        );
      dd.finish();
      (kind === 'flap' ? flaps : ailerons).push({
        node: g.name,
        axis: 'x',
        multiplier: kind === 'flap' ? -Math.PI / 6 : -side * 0.28,
      });
    }
    for (let x = 0.8; x < 5.53; x += 0.35) {
      const h = 0.12 - (x - 0.52) * 0.014,
        upper = (u) =>
          u < 0.25
            ? (h * u) / 0.25
            : u < 0.75
              ? h * (1 - (u - 0.25) * 0.96)
              : (h * 0.52 * (1 - u)) / 0.25;
      const line = [0.05, 0.25, 0.5, 0.75, 0.96].map((u) => [
        side * x,
        y(x) + upper(u) + 0.002,
        le(x) - u * (le(x) - hinge(x)),
      ]);
      outline(d, line, 0.0014, metal, false);
      for (let u = 0.1; u < 0.96; u += 0.11)
        d.add(new T.SphereGeometry(0.0023, 5, 3), metal, [
          side * x,
          y(x) + upper(u) + 0.003,
          le(x) - u * (le(x) - hinge(x)),
        ]);
    }
    // Separate tip light, leading-edge lamp, filler and small vortex-generator plates.
    ellipsoid(
      d,
      [side * 5.7404, y(5.74), 0.32],
      [0.025, 0.026, 0.052],
      side > 0 ? d.red : d.green,
      10,
    );
    d.box([0.18, 0.055, 0.015], [side * 3.93, y(3.93), le(3.93) + 0.012], dark);
    for (const dx of [-0.045, 0.045])
      d.add(new T.CircleGeometry(0.022, 12), d.ivory, [
        side * 3.93 + dx,
        y(3.93),
        le(3.93) + 0.021,
      ]);
    d.add(new T.CylinderGeometry(0.045, 0.045, 0.01, 16), metal, [
      side * 1.17,
      y(1.17) + 0.105,
      0.31,
    ]);
    for (let x = 3.2; x < 5.4; x += 0.24)
      d.box([0.006, 0.025, 0.037], [side * x, y(x) + 0.06, le(x) - 0.1], paint);
    const leTail = (x) => -3.82 - Math.abs(x) * 0.11,
      teTail = (x) => -5.08 + Math.abs(x) * 0.06;
    wing(
      d,
      [
        [0, 1.27, leTail(0), -4.34, 0.06],
        [side * 2.26, 1.27, leTail(2.26), -4.34, 0.036],
        [side * 2.4257, 1.27, leTail(2.4257) - 0.06, teTail(2.4257) + 0.08, 0.02],
      ],
      paint,
    );
    const eg = group(root, `Baron-elevator-${side}`, [0, 1.27, -4.35]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.12, 0, 0, teTail(0.12) + 4.35, 0.018],
        [side * 2.26, 0, 0, teTail(2.26) + 4.35, 0.012],
      ],
      paint,
    );
    ed.rod([side * 0.2, 0.016, -0.31], [side * 0.85, 0.016, -0.28], 0.0025, metal);
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
    [-2.45, 1.7],
    [-3.65, 1.68],
    [-4.03, 1.82],
    [-5.04, 2.94],
    [-5.12, 2.94],
    [-5.58, 2.9],
    [-5.05, 1.26],
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
  const rg = group(root, 'Baron-rudder', [0, 1.26, -5.05]),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1]) {
    sheet(
      rd,
      [
        [side * 0.035, 0, 0],
        [side * 0.035, 1.64, -0.53],
        [side * 0.035, 1.62, -0.79],
        [side * 0.035, -0.08, -0.45],
      ],
      accent,
      [side, 0, 0],
    );
    rd.rod([side * 0.038, 0.15, -0.22], [side * 0.038, 0.43, -0.28], 0.003, metal);
    for (let t = 0.05; t < 1; t += 0.055)
      rd.add(new T.SphereGeometry(0.0025, 5, 3), metal, [side * 0.038, t * 1.24, -0.32 * t - 0.02]);
  }
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  d.add(new T.CylinderGeometry(0.025, 0.025, 0.036, 12), d.red, [0, 2.9538, -5.1]);
  d.rod([0, 2.11, -0.4], [0, 2.4, -0.64], 0.008, paint);
  d.rod([0, 1.91, -1.5], [0, 2.09, -1.65], 0.006, paint);
  const enginePoints = [],
    rotors = [];
  for (const [index, side] of [
    [1, 1],
    [2, -1],
  ]) {
    const x = side * 1.85,
      y = 1.35,
      z = 1.88;
    const nacelle = group(root, `Baron-nacelle-${index}`, [x, y, 0]),
      nd = detailKit(nacelle, nacelle.name);
    const sections = [
      [1.86, 0.37, -0.24, 0.26],
      [1.65, 0.43, -0.29, 0.31],
      [0.65, 0.43, -0.38, 0.3],
      [0, 0.38, -0.4, 0.25],
      [-0.35, 0.27, -0.22, 0.12],
      [-0.72, 0.06, -0.06, 0.04],
    ];
    const nr = sections.map(([zz, w, b, t]) => ({
      z: zz,
      points: [
        [0, t],
        [w * 0.75, t],
        [w, t - 0.08],
        [w, b + 0.1],
        [w * 0.6, b],
        [0, b],
        [-w * 0.6, b],
        [-w, b + 0.1],
        [-w, t - 0.08],
        [-w * 0.75, t],
      ],
    }));
    loft(nd, nr, paint);
    for (const zz of [1.66, 0.65, 0]) {
      const ring = nr.find((r) => r.z === zz) || nr[1];
      outline(
        nd,
        ring.points.map((p) => [...p, ring.z]),
        0.002,
        metal,
      );
    }
    for (const sign of [-1, 1]) {
      ellipsoid(nd, [sign * 0.22, 0.08, 1.869], [0.13, 0.075, 0.012], dark, 16);
      nd.rod([sign * 0.3, -0.32, 0.6], [sign * 0.32, -0.48, 0.37], 0.023, metal);
      nd.box([0.19, 0.014, 0.27], [sign * 0.22, -0.35, 0.38], paint);
      for (let zz = 0.72; zz < 1.65; zz += 0.12)
        nd.add(new T.SphereGeometry(0.0028, 5, 3), metal, [sign * 0.433, 0.05, zz]);
    }
    ellipsoid(nd, [0, -0.18, 1.87], [0.095, 0.045, 0.012], dark, 16);
    nd.add(new T.CircleGeometry(0.07, 16), d.ivory, [0, -0.24, 0.45]);
    nd.finish();
    const eg = group(root, `engine-${index}`, [x, y, z]),
      prop = group(eg, `Baron-propeller-${index}`),
      pd = detailKit(prop, prop.name);
    pd.add(new T.ConeGeometry(0.15, 0.35, 24).rotateX(Math.PI / 2), metal, [0, 0, 0.175]);
    for (let i = 0; i < 3; i++) {
      const g = group(prop, `Baron-prop-${index}-blade-${i}`);
      g.rotation.z = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      const dd = detailKit(g, g.name),
        pts = [
          [0.12, -0.04, 0],
          [0.35, -0.075, 0.01],
          [0.86, -0.055, 0],
          [0.965, -0.025, -0.01],
          [0.9779, 0, -0.01],
          [0.965, 0.03, -0.01],
          [0.62, 0.07, 0.005],
          [0.13, 0.04, 0],
        ];
      sheet(dd, pts, dark, [0, 0, 1]);
      sheet(
        dd,
        pts.map((p) => [p[0], p[1], p[2] - 0.014]),
        dark,
        [0, 0, -1],
      );
      dd.box([0.036, 0.05, 0.016], [0.942, 0.003, -0.009], paint);
      dd.finish();
    }
    pd.finish();
    enginePoints.push({ id: eg.name, position: [x, y, z] });
    rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: eg.name });
  }
  // Radar radome, nose baggage hatch and windscreen defrost seams.
  outline(
    d,
    [
      [0.39, 1.56, 2.57],
      [0.43, 1.51, 2.28],
      [0.43, 1.12, 2.28],
      [0.39, 1.1, 2.57],
    ],
    0.003,
    metal,
  );
  d.box([0.015, 0.035, 0.08], [0.435, 1.34, 2.32], dark);
  // Actual main struts retract inboard; nose leg retracts aft. Doors stay attached to their legs.
  for (const [index, x, z, top, r] of [
    [0, 0, 2.46, 0.8, 0.205],
    [1, 1.4605, 0, 0.91, 0.24],
    [2, -1.4605, 0, 0.91, 0.24],
  ]) {
    const g = group(root, `Baron-gear-${index}`, [x, top, z]),
      dd = detailKit(g, g.name),
      h = top - r;
    dd.rod([0, 0, 0], [0, -h, 0], 0.03, metal);
    dd.rod([0, -0.18, -0.08], [0, -h + 0.1, 0], 0.018, dark);
    dd.add(new T.CylinderGeometry(r, r, 0.13, 24).rotateZ(Math.PI / 2), rubber, [0, -h, 0]);
    for (const side of [-1, 1])
      dd.add(new T.CircleGeometry(r * 0.54, 16).rotateY((side * Math.PI) / 2), metal, [
        side * 0.068,
        -h,
        0,
      ]);
    if (x) {
      dd.rod([-0.18 * Math.sign(x), 0, -0.28], [0, -h + 0.12, 0], 0.017, metal);
      sheet(
        dd,
        [
          [Math.sign(x) * 0.095, -0.03, 0.25],
          [Math.sign(x) * 0.095, -0.03, -0.3],
          [Math.sign(x) * 0.095, -h + 0.07, -0.22],
          [Math.sign(x) * 0.095, -h + 0.07, 0.12],
        ],
        paint,
        [Math.sign(x), 0, 0],
      );
    } else {
      for (const side of [-1, 1])
        dd.rod([side * 0.08, -h + 0.15, -0.06], [side * 0.08, -h, 0], 0.016, metal);
      dd.box([0.19, 0.35, 0.018], [0, -0.22, -0.09], paint);
    }
    dd.finish();
    const angle = x ? (-Math.sign(x) * Math.PI) / 2 : Math.PI / 2;
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: x ? 'z' : 'x',
      offset: angle,
      scale: -angle,
    });
  }
  d.finish();
  const interior = cockpit(root, { paint, accent, metal, dark });
  cleanGeometry(root);
  return {
    root,
    frame: baronFrame(),
    enginePoints,
    visual: {
      rotors,
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
    d = detailKit(cabin, 'Baron-cabin'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Baron');
  const { bindings, derived, ink, black, red } = instruments,
    face = mat('Baron-panel', '#383c40'),
    seat = mat('Baron-leather', '#aaa99c'),
    headliner = mat('Baron-headliner', '#d4d0c2'),
    blue = mat('Baron-prop-control', '#3f78bf');
  // 2016 factory cockpit photo, 1376px page: bezel width 282px = 11.8in.
  const k = 0.29972 / 282,
    px = (u) => (686 - u) * k,
    py = (v) => 1.61 - (v - 1090) * k,
    z = 1.12,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [225, 1238],
    [234, 1030],
    [257, 949],
    [310, 925],
    [1030, 925],
    [1085, 949],
    [1112, 1028],
    [1140, 1238],
  ];
  const centers = [
    [px(436), py(1090)],
    [px(779), py(1090)],
  ];
  const holes = centers.map(([x, y]) => rect(x, y, 0.213, 0.16));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(968) + Math.cos((i * Math.PI) / 20) * 0.035,
      py(1084) + Math.sin((i * Math.PI) / 20) * 0.035,
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
  const brow = edge.map((p) => at(...p));
  outline(d, brow, 0.025, m.dark, false);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(
      d,
      a,
      b,
      [b[0], 1.83 - Math.abs(b[0]) * 0.1, 1.43],
      [a[0], 1.83 - Math.abs(a[0]) * 0.1, 1.43],
      m.dark,
      [0, 1, 0],
    );
  }
  addG1000Bezels(d, centers, z, black, m.dark);
  const sources = addG1000Readouts({
    cabin,
    d,
    instruments,
    prefix: 'Baron',
    pfd: centers[0],
    mfd: centers[1],
    z,
    maxRpm: 2700,
    twinEngine: true,
  });
  Object.assign(sources, {
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  });
  d.box([0.03302, 0.19558, 0.012], at(607, 1090, -0.008), black);
  for (let row = 0; row < 11; row++)
    for (const side of [-1, 1])
      d.box([0.009, 0.005, 0.004], at(607 + side * 7, 1010 + row * 14, -0.018), m.dark);
  pt.knob(px(607), py(1180), z - 0.02, 0.006);
  instruments.dial(
    'standby-speed',
    at(968, 999, -0.006),
    0.038,
    'knots',
    [
      [0, 0.2],
      [40, 0.5],
      [80, 1.55],
      [120, 2.8],
      [160, 4.1],
      [200, 5.15],
      [240, 5.8],
    ],
    [40, 80, 120, 160, 200, 240],
    'TAS',
    { responseSeconds: 0.2, minorStep: 10 },
  );
  instruments.horizon('standby-attitude', at(968, 1084, 0.008), 0.06, 0.06, { round: true });
  d.ring(0.035, 0.004, at(968, 1084, -0.005), black);
  instruments.altimeter('standby-altimeter', at(968, 1164, -0.006), 0.038, 'feet');
  d.box([0.035, 0.052, 0.015], at(1070, 1055, -0.015), m.metal);
  d.box([0.018, 0.027, 0.02], at(1070, 1055, -0.027), red);
  d.text('ELT', at(1070, 1024, -0.025), 0.005, Math.PI, ink);
  instruments.headingDrum('compass', at(680, 895, -0.015), 0.025, 'trueHeading');
  d.rod(at(680, 930, 0.01), at(680, 918, 0.01), 0.012, m.metal);
  d.box([1.03, 0.16, 0.025], at(686, 1305, 0.006), face);
  for (const u of [627, 675]) {
    pt.gauge(px(u), py(1272), z - 0.01, 0.025, black, false);
    d.text('INOP', at(u, 1272, -0.022), 0.005, Math.PI, ink);
  }
  for (const u of [675, 733, 790]) pt.vent(px(u), py(1327), z - 0.01, 'round', 0.036);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 9; i++) {
      const u = 260 + i * 29,
        v = 1275 + row * 45;
      pt.knob(px(u), py(v), z - 0.02, 0.005);
      d.rod(at(u, v, -0.025), at(u, v - 8, -0.036), 0.0027, m.metal);
    }
  d.text('BAT ALT LIGHTS', at(380, 1252, -0.026), 0.005, Math.PI, ink);
  for (let i = 0; i < 16; i++) pt.knob(px(819 + i * 19), py(1375), z - 0.025, 0.0045);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++)
      d.add(new T.CylinderGeometry(0.004, 0.004, 0.006, 8).rotateZ(Math.PI / 2), black, [
        0.516,
        1.09 + row * 0.025,
        0.7 + col * 0.036,
      ]);
  derived.gearLocked = { op: 'greater', args: ['gear', 0.999] };
  derived.gearOffStop = { op: 'greater', args: ['gear', 0.001] };
  derived.gearNotLocked = { op: 'less', args: ['gear', 0.999] };
  derived.gearInTransit = { op: 'and', args: ['gearOffStop', 'gearNotLocked'] };
  for (const [index, u, v] of [
    [0, 559, 1288],
    [1, 551, 1300],
    [2, 569, 1300],
  ]) {
    d.add(new T.CircleGeometry(0.006, 12).rotateY(Math.PI), black, at(u, v, -0.025));
    const lamp = group(cabin, `Baron-gear-lamp-${index}`, at(u, v, -0.027)),
      ld = detailKit(lamp, lamp.name);
    ld.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), d.green);
    ld.finish();
    bindings.push({
      node: lamp.name,
      source: 'gearLocked',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  const transit = group(cabin, 'Baron-gear-transit', at(582, 1294, -0.027)),
    td = detailKit(transit, transit.name);
  td.add(new T.CircleGeometry(0.006, 12).rotateY(Math.PI), red);
  td.finish();
  bindings.push({
    node: transit.name,
    source: 'gearInTransit',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  const gearLever = group(cabin, 'Baron-gear-handle', at(569, 1342, -0.045)),
    gd = detailKit(gearLever, gearLever.name);
  gd.rod([0, 0, 0], [0, -0.022, -0.02], 0.003, m.metal);
  gd.add(
    new T.CylinderGeometry(0.012, 0.012, 0.01, 12).rotateX(Math.PI / 2),
    black,
    [0, -0.025, -0.023],
  );
  gd.finish();
  bindings.push({
    node: gearLever.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    offset: -0.7,
    scale: 0.7,
  });
  for (const [value, v] of [
    [0, 1275],
    [0.4, 1288],
    [1, 1300],
  ]) {
    const key = `flap.${value}`;
    derived[`${key}.delta`] = { op: 'subtract', args: ['flapPosition', value] };
    derived[`${key}.distance`] = { op: 'abs', args: [`${key}.delta`] };
    derived[key] = { op: 'less', args: [`${key}.distance`, 0.02] };
    const g = group(cabin, `Baron-flap-lamp-${Math.round(value * 100)}`, at(825, v, -0.023)),
      dd = detailKit(g, g.name);
    dd.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), instruments.amber);
    dd.finish();
    bindings.push({ node: g.name, source: key, property: 'visible', scale: 1, missing: 'hide' });
  }
  const fl = group(cabin, 'Baron-flap-handle', at(845, 1335, -0.035)),
    fld = detailKit(fl, fl.name);
  fld.box([0.02, 0.009, 0.035], [0, 0, 0], ink);
  fld.finish();
  bindings.push({
    node: fl.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'y',
    scale: -0.027,
  });
  for (const u of [365, 998]) {
    const g = group(cabin, `Baron-yoke-${u}`, at(u, 1290, -0.17)),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0.18], [0, 0, -0.055], 0.018, m.metal);
    outline(
      dd,
      [
        [-0.115, 0.1, -0.075],
        [-0.13, -0.035, -0.075],
        [-0.09, -0.045, -0.075],
        [0.09, -0.045, -0.075],
        [0.13, -0.035, -0.075],
        [0.115, 0.1, -0.075],
      ],
      0.016,
      m.metal,
      false,
    );
    const badge = [
      [-0.055, -0.041, -0.092],
      [-0.038, 0.052, -0.092],
      [0.035, 0.052, -0.092],
      [0.058, -0.041, -0.092],
    ];
    sheet(dd, badge, black, [0, 0, -1]);
    outline(dd, badge, 0.003, m.metal);
    dd.text('BEECHCRAFT', [0, -0.018, -0.096], 0.005, Math.PI, ink);
    for (const side of [-1, 1]) {
      beveledBox(dd, [0.027, 0.045, 0.033], [side * 0.115, 0.092, -0.074], headliner, 0.005);
      dd.box([0.015, 0.007, 0.015], [side * 0.115, 0.115, -0.08], black);
    }
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.055 },
    );
  }
  const pedestal = group(cabin, 'Baron-pedestal', [-0.02, 1.12, 1.04]),
    dd = detailKit(pedestal, pedestal.name);
  beveledBox(dd, [0.27, 0.3, 0.37], [0, 0, 0], face, 0.025);
  dd.ring(0.074, 0.01, [0.137, -0.02, -0.1], black, 'x');
  // Three pairs: black throttles, blue propeller governors, red mixtures.
  for (const [pair, x, label, col] of [
    [0, 0.086, 'throttle', black],
    [1, 0, 'propeller', blue],
    [2, -0.086, 'mixture', red],
  ])
    for (let i = 0; i < 2; i++) {
      const g = group(pedestal, `Baron-${label === 'propeller' ? 'prop-lever' : label}-${i + 1}`, [
          x + (i === 0 ? 0.018 : -0.018),
          0.13,
          0.035 - pair * 0.025,
        ]),
        ld = detailKit(g, g.name);
      // Keep each grip above the quadrant throughout its full aft travel.
      const leverHeight = 0.12;
      ld.rod([0, 0, 0], [0, leverHeight, -0.045 - pair * 0.025], 0.005, m.metal);
      beveledBox(ld, [0.029, 0.027, 0.038], [0, leverHeight, -0.045 - pair * 0.025], col, 0.005);
      ld.finish();
      if (label === 'throttle')
        bindings.push({
          node: g.name,
          source: 'power',
          property: 'rotation',
          axis: 'x',
          offset: -0.35,
          scale: 0.7,
        });
    }
  beveledBox(dd, [0.2, 0.08, 0.017], [0, 0.08, -0.2], black, 0.01);
  dd.text('CABIN AIR', [0, 0.105, -0.212], 0.006, Math.PI, ink);
  for (const x of [-0.065, -0.022, 0.022, 0.065]) dd.ring(0.012, 0.002, [x, 0.07, -0.213], m.metal);
  dd.ring(0.035, 0.006, [0, -0.02, -0.14], black, 'y');
  dd.text('RUD TRIM', [0, 0.01, -0.2], 0.006, Math.PI, ink);
  dd.finish();
  d.box([1.06, 0.035, 3.05], [0, 0.75, -0.38], m.dark);
  for (const [row, zz, facing] of [
    [0, 0.17, 0],
    [1, -0.53, Math.PI],
    [2, -1.52, 0],
  ])
    for (const side of [-1, 1]) {
      const g = group(cabin, `Baron-seat-${row}-${side}`, [side * 0.275, 0.97, zz]);
      g.rotation.y = facing;
      const sd = detailKit(g, g.name);
      beveledBox(sd, [0.45, 0.13, 0.48], [0, 0, 0], seat, 0.04);
      beveledBox(sd, [0.43, 0.55, 0.12], [0, 0.32, -0.22], seat, 0.04);
      beveledBox(sd, [0.31, 0.4, 0.014], [0, 0.35, -0.148], seat, 0.025);
      beveledBox(sd, [0.28, 0.17, 0.1], [0, 0.67, -0.21], seat, 0.03);
      for (const j of [-1, 1]) {
        sd.rod([j * 0.08, 0.57, -0.21], [j * 0.08, 0.61, -0.21], 0.007, m.metal);
        sd.rod([j * 0.16, -0.18, 0], [j * 0.16, -0.05, 0], 0.012, m.metal);
        sd.rod([j * 0.19, 0.11, -0.13], [j * 0.19, 0.11, 0.13], 0.022, seat);
      }
      sd.rod([-0.16, 0.08, -0.11], [0.16, 0.08, 0.11], 0.014, black);
      sd.box([0.04, 0.013, 0.034], [0, 0.09, 0], m.metal);
      sd.finish();
    }
  for (const side of [-1, 1]) {
    d.box([0.022, 0.25, 2.6], [side * 0.531, 0.99, -0.35], seat);
    d.box([0.028, 0.035, 2.6], [side * 0.51, 1.12, -0.35], m.dark);
    for (const zz of [-0.7, -1.4]) {
      d.ring(0.033, 0.005, [side * 0.5, 1.145, zz], m.metal, 'y');
      d.box([0.012, 0.04, 0.085], [side * 0.51, 1.02, zz], black);
    }
    for (const j of [-1, 1]) {
      const g = group(cabin, `Baron-pedal-${side}-${j}`, [side * 0.28 + j * 0.075, 0.84, 1.25]),
        dd = detailKit(g, g.name);
      dd.box([0.125, 0.065, 0.04], [0, 0, 0], m.metal);
      for (let i = 0; i < 4; i++)
        dd.box([0.004, 0.05, 0.004], [-0.045 + i * 0.03, 0, -0.024], black);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.035,
      });
    }
    d.box([0.3, 0.025, 0.2], [side * 0.29, 2.06, 0.45], headliner);
    for (const zz of [0, -0.8, -1.4]) {
      d.ring(0.026, 0.005, [side * 0.2, 1.98 + zz * 0.1, zz], m.metal, 'y');
      d.add(new T.SphereGeometry(0.014, 12, 8), black, [side * 0.2, 1.97 + zz * 0.1, zz]);
    }
  }
  beveledBox(d, [0.022, 0.32, 0.46], [-0.505, 1.04, -0.98], headliner, 0.006);
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
