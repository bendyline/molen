/** 2015 Bonanza G36, E-4063–4080 equipment. Main axle origin; +Z nose, +X pilot left.
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

export const bonanzaFrame = () => ({
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
export function buildBonanza(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Bonanza-ivory', '#e6e6df', { side: T.DoubleSide }),
    accent = mat('Bonanza-navy', '#234367', { side: T.DoubleSide }),
    metal = mat('Bonanza-alloy', '#a7afaf', { metalness: 0.7 }),
    dark = mat('Bonanza-trim', '#262c31'),
    rubber = mat('Bonanza-tires', '#202728'),
    glass = mat('Bonanza-glazing', '#b2cbd0', {
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'Bonanza-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Stations follow the side-view roof/belly and independent plan-view half widths.
  const stations = [
    [2.6, 0.39, 0.79, 1.57],
    [2.38, 0.47, 0.68, 1.63],
    [1.42, 0.58, 0.59, 1.72],
    [0.6, 0.625, 0.59, 2.14],
    [-0.08, 0.625, 0.59, 2.12],
    [-0.78, 0.61, 0.59, 2.02],
    [-1.38, 0.57, 0.59, 1.91],
    [-2.03, 0.52, 0.6, 1.8],
    [-2.75, 0.43, 0.65, 1.73],
    [-3.75, 0.3, 0.76, 1.59],
    [-4.75, 0.15, 0.9, 1.4],
    [-5.402, 0.025, 1.11, 1.19],
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
      (i === 2 && [0, 1, 8, 9].includes(j)) || ([2, 3, 4, 5, 6].includes(i) && [2, 7].includes(j)),
  });
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
    for (let i = 0; i < stations.length - 1; i++) {
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
    const y = (x) => 0.77 + Math.abs(x) * Math.tan(Math.PI / 30),
      chord = (x) => 2.185 - (1.075 * Math.abs(x)) / 5.08,
      le = (x) => 0.77 - (2.185 - chord(x)) * 0.25,
      te = (x) => le(x) - chord(x),
      hinge = (x) => te(x) + chord(x) * 0.23;
    wing(
      d,
      [
        [side * 0.52, y(0.52), le(0.52), hinge(0.52), 0.12],
        [side * 2.75, y(2.75), le(2.75), hinge(2.75), 0.09],
        [side * 4.86, y(4.86), le(4.86), hinge(4.86), 0.058],
        [side * 5.08, y(5.08), le(5.08) - 0.035, te(5.08) + 0.05, 0.035],
      ],
      paint,
    );
    for (const [kind, begin, end] of [
      ['flap', 0.58, 2.75],
      ['aileron', 2.78, 4.87],
    ]) {
      const g = group(root, `Bonanza-${kind}-${side}`, [side * begin, y(begin), hinge(begin)]),
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
    for (let x = 0.8; x < 4.88; x += 0.35) {
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
      [side * 5.0804, y(5.08), 0.32],
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
    for (let x = 2.9; x < 4.8; x += 0.24)
      d.box([0.006, 0.025, 0.037], [side * x, y(x) + 0.06, le(x) - 0.1], paint);
    const leTail = (x) => -3.98 - Math.abs(x) * 0.11,
      teTail = (x) => -5.1 + Math.abs(x) * 0.06;
    wing(
      d,
      [
        [0, 1.27, leTail(0), -4.64, 0.06],
        [side * 1.7, 1.27, leTail(1.7), -4.64, 0.036],
        [side * 1.8542, 1.27, leTail(1.8542) - 0.06, teTail(1.8542) + 0.08, 0.02],
      ],
      paint,
    );
    const eg = group(root, `Bonanza-elevator-${side}`, [0, 1.27, -4.65]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.12, 0, 0, teTail(0.12) + 4.65, 0.018],
        [side * 1.7, 0, 0, teTail(1.7) + 4.65, 0.012],
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
    [-4.71, 2.55],
    [-4.85, 2.58],
    [-5.26, 2.5],
    [-4.94, 1.26],
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
  const rg = group(root, 'Bonanza-rudder', [0, 1.26, -4.94]),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1]) {
    sheet(
      rd,
      [
        [side * 0.035, 0, 0],
        [side * 0.035, 1.24, -0.32],
        [side * 0.035, 1.21, -0.462],
        [side * 0.035, -0.08, -0.29],
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
  d.add(new T.CylinderGeometry(0.025, 0.025, 0.036, 12), d.red, [0, 2.5982, -4.83]);
  d.rod([0, 2.11, -0.4], [0, 2.4, -0.64], 0.008, paint);
  d.rod([0, 1.91, -1.5], [0, 2.09, -1.65], 0.006, paint);
  for (const side of [-1, 1]) {
    ellipsoid(d, [side * 0.22, 1.42, 2.606], [0.14, 0.085, 0.016], dark, 16);
    d.rod([side * 0.29, 0.66, 1.67], [side * 0.31, 0.52, 1.43], 0.024, metal);
    d.box([0.13, 0.014, 0.26], [side * 0.3, 0.65, 1.46], paint);
    for (let i = 0; i < 4; i++)
      d.rod(
        [side * 0.475, 1.18, 2.17 - i * 0.065],
        [side * 0.475, 1.04, 2.17 - i * 0.065],
        0.006,
        dark,
      );
  }
  ellipsoid(d, [0, 1.11, 2.609], [0.1, 0.055, 0.014], dark, 16);
  const engine = group(root, 'engine-1', [0, 1.43, 2.61]),
    prop = group(engine, 'Bonanza-propeller'),
    pd = detailKit(prop, prop.name);
  pd.add(new T.ConeGeometry(0.15, 0.37, 24).rotateX(Math.PI / 2), metal, [0, 0, 0.185]);
  for (let i = 0; i < 3; i++) {
    const g = group(prop, `Bonanza-prop-blade-${i}`);
    g.rotation.z = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    const dd = detailKit(g, g.name);
    const pts = [
      [0.12, -0.04, 0],
      [0.35, -0.075, 0.01],
      [0.86, -0.045, 0],
      [1.016, -0.015, -0.01],
      [1.016, 0.04, -0.01],
      [0.62, 0.075, 0.005],
      [0.13, 0.04, 0],
    ];
    sheet(dd, pts, dark, [0, 0, 1]);
    sheet(
      dd,
      pts.map((p) => [p[0], p[1], p[2] - 0.014]),
      dark,
      [0, 0, -1],
    );
    dd.box([0.045, 0.06, 0.016], [0.979, 0.012, -0.009], paint);
    dd.finish();
  }
  pd.finish();
  // Actual main struts retract inboard; nose leg retracts aft. Doors stay attached to their legs.
  for (const [index, x, z, top, r] of [
    [0, 0, 2.46, 0.8, 0.205],
    [1, 1.4605, 0, 0.91, 0.24],
    [2, -1.4605, 0, 0.91, 0.24],
  ]) {
    const g = group(root, `Bonanza-gear-${index}`, [x, top, z]),
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
    frame: bonanzaFrame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.43, 2.61] }],
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
    d = detailKit(cabin, 'Bonanza-cabin'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Bonanza');
  const { bindings, derived, ink, black, red } = instruments,
    face = mat('Bonanza-panel', '#383e40'),
    seat = mat('Bonanza-leather', '#41494c'),
    headliner = mat('Bonanza-headliner', '#cbc9be'),
    blue = mat('Bonanza-prop-control', '#3f8cab');
  // Panel diagram at 1376px width, calibrated with the physical 11.8-inch display bezel.
  const k = 0.29972 / 318,
    px = (u) => (690 - u) * k,
    py = (v) => 1.61 - (v - 585) * k,
    z = 1.12,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [145, 736],
    [145, 622],
    [200, 468],
    [270, 410],
    [1015, 410],
    [1112, 450],
    [1182, 525],
    [1239, 679],
    [1239, 718],
    [1210, 740],
    [1050, 740],
    [1020, 769],
    [430, 772],
    [404, 746],
    [374, 746],
    [340, 772],
    [164, 772],
  ];
  const centers = [
    [px(397), py(585)],
    [px(790), py(585)],
  ];
  const holes = centers.map(([x, y]) => rect(x, y, 0.213, 0.16));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(1016) + Math.cos((i * Math.PI) / 20) * 0.035,
      py(581) + Math.sin((i * Math.PI) / 20) * 0.035,
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
    [160, 591],
    [191, 490],
    [230, 438],
    [278, 420],
    [366, 410],
    [1010, 410],
    [1090, 419],
    [1137, 441],
    [1170, 491],
    [1215, 620],
  ].map((p) => at(...p, -0.014));
  outline(d, brow, 0.016, headliner, false);
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
    prefix: 'Bonanza',
    pfd: centers[0],
    mfd: centers[1],
    z,
    maxRpm: 2700,
  });
  Object.assign(sources, {
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  });
  d.box([0.03302, 0.19558, 0.012], at(594, 585, -0.008), black);
  for (let row = 0; row < 11; row++)
    for (const side of [-1, 1])
      d.box([0.009, 0.005, 0.004], at(594 + side * 7, 505 + row * 14, -0.018), m.dark);
  pt.knob(px(594), py(677), z - 0.02, 0.006);
  instruments.dial(
    'standby-speed',
    at(1016, 486, -0.006),
    0.038,
    'knots',
    [
      [0, 0.25],
      [40, 0.65],
      [80, 1.8],
      [120, 3.3],
      [160, 4.5],
      [200, 5.45],
      [220, 5.85],
    ],
    [40, 80, 120, 160, 200],
    'TAS',
    { responseSeconds: 0.2, minorStep: 10 },
  );
  instruments.horizon('standby-attitude', at(1016, 581, 0.008), 0.06, 0.06, { round: true });
  d.ring(0.035, 0.004, at(1016, 581, -0.005), black);
  instruments.altimeter('standby-altimeter', at(1016, 679, -0.006), 0.038, 'feet');
  d.box([0.035, 0.052, 0.015], at(1130, 548, -0.015), m.metal);
  d.box([0.018, 0.027, 0.02], at(1130, 548, -0.027), red);
  d.text('ELT', at(1130, 583, -0.025), 0.005, Math.PI, ink);
  // Center glareshield standby compass: rotating cylindrical card behind a real aperture.
  instruments.headingDrum('compass', at(690, 353, -0.015), 0.025, 'trueHeading');
  d.rod(at(690, 390, 0.01), at(690, 375, 0.01), 0.012, m.metal);
  // Subpanels are a separate plane under the yoke shafts; three center ventilation outlets.
  d.box([1.08, 0.19, 0.025], at(690, 870, 0.006), face);
  for (const [u, v] of [
    [683, 883],
    [748, 883],
    [814, 883],
  ])
    pt.vent(px(u), py(v), z - 0.01, 'round', 0.042);
  for (const [u, v] of [
    [171, 839],
    [198, 839],
    [226, 839],
    [253, 839],
    [298, 839],
    [324, 839],
    [352, 839],
    [267, 895],
    [291, 895],
    [316, 895],
    [340, 895],
    [364, 895],
    [431, 895],
    [455, 895],
    [479, 895],
    [503, 895],
    [475, 839],
    [503, 839],
  ]) {
    pt.knob(px(u), py(v), z - 0.02, 0.005);
    d.rod(at(u, v, -0.025), at(u, v - 9, -0.037), 0.0027, m.metal);
  }
  for (const u of [195, 238, 281, 324]) pt.knob(px(u), py(954), z - 0.025, 0.009);
  d.text('BAT  ALT  AVIONICS', at(257, 818, -0.026), 0.005, Math.PI, ink);
  d.text('LIGHTS', at(465, 868, -0.026), 0.005, Math.PI, ink);
  for (let i = 0; i < 19; i++) pt.knob(px(862 + i * 20), py(950), z - 0.025, 0.0045);
  beveledBox(d, [0.17, 0.145, 0.018], at(1144, 834, -0.004), m.dark, 0.012);
  d.box([0.047, 0.04, 0.008], at(1106, 835, -0.019), m.metal);
  d.box([0.06, 0.052, 0.01], at(617, 814, -0.014), black);
  d.text('SUCTION', at(617, 805, -0.023), 0.004, Math.PI, ink);
  d.text('INOP', at(617, 826, -0.023), 0.005, Math.PI, ink);
  // Gear lamps reflect locked-down state, not merely the pilot's selected handle position.
  derived.gearLocked = { op: 'greater', args: ['gear', 0.999] };
  derived.gearOffStop = { op: 'greater', args: ['gear', 0.001] };
  derived.gearNotLocked = { op: 'less', args: ['gear', 0.999] };
  derived.gearInTransit = { op: 'and', args: ['gearOffStop', 'gearNotLocked'] };
  for (const [index, u, v] of [
    [0, 538, 830],
    [1, 530, 844],
    [2, 547, 844],
  ]) {
    d.add(new T.CircleGeometry(0.006, 12).rotateY(Math.PI), black, at(u, v, -0.025));
    const lamp = group(cabin, `Bonanza-gear-lamp-${index}`, at(u, v, -0.027)),
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
  const transit = group(cabin, 'Bonanza-gear-transit', at(565, 837, -0.027)),
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
  const gearLever = group(cabin, 'Bonanza-gear-handle', at(550, 879, -0.045)),
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
    [0, 805],
    [0.4, 822],
    [1, 839],
  ]) {
    const key = `flap.${value}`;
    derived[`${key}.delta`] = { op: 'subtract', args: ['flapPosition', value] };
    derived[`${key}.distance`] = { op: 'abs', args: [`${key}.delta`] };
    derived[key] = { op: 'less', args: [`${key}.distance`, 0.02] };
    const g = group(cabin, `Bonanza-flap-lamp-${Math.round(value * 100)}`, at(865, v, -0.023)),
      dd = detailKit(g, g.name);
    dd.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), instruments.amber);
    dd.finish();
    bindings.push({ node: g.name, source: key, property: 'visible', scale: 1, missing: 'hide' });
  }
  const fl = group(cabin, 'Bonanza-flap-handle', at(906, 851, -0.035)),
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
  for (const u of [391, 992]) {
    const g = group(cabin, `Bonanza-yoke-${u}`, at(u, 777, -0.17)),
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
    sheet(
      dd,
      [
        [-0.055, -0.041, -0.092],
        [-0.038, 0.052, -0.092],
        [0.035, 0.052, -0.092],
        [0.058, -0.041, -0.092],
      ],
      black,
      [0, 0, -1],
    );
    outline(
      dd,
      [
        [-0.055, -0.041, -0.092],
        [-0.038, 0.052, -0.092],
        [0.035, 0.052, -0.092],
        [0.058, -0.041, -0.092],
      ],
      0.003,
      m.metal,
    );
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
  const pedestal = group(cabin, 'Bonanza-pedestal', [0, 1.06, 0.96]),
    dd = detailKit(pedestal, pedestal.name);
  beveledBox(dd, [0.27, 0.3, 0.34], [0, 0, 0], face, 0.025);
  dd.ring(0.074, 0.01, [0.137, -0.02, -0.1], black, 'x');
  dd.text('TRIM', [0.09, 0.07, -0.181], 0.009, Math.PI, ink);
  for (const [x, label, col] of [
    [0.07, 'throttle', black],
    [0, 'propeller', blue],
    [-0.07, 'mixture', red],
  ]) {
    const g = group(pedestal, `Bonanza-${label}`, [x, 0.13, 0.04]),
      ld = detailKit(g, g.name);
    ld.rod([0, 0, 0], [0, 0.12, -0.045], 0.006, m.metal);
    beveledBox(ld, [0.038, 0.026, 0.034], [0, 0.12, -0.045], col, 0.005);
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
  dd.rod([-0.08, -0.06, -0.18], [-0.08, -0.13, -0.19], 0.004, m.metal);
  dd.box([0.03, 0.016, 0.02], [-0.08, -0.13, -0.19], black);
  dd.finish();
  d.box([1.06, 0.035, 3.05], [0, 0.75, -0.38], m.dark);
  d.box([0.18, 0.03, 0.3], [0.24, 0.79, 0.42], face);
  d.ring(0.045, 0.005, [0.24, 0.81, 0.42], m.metal, 'y');
  d.rod([0.24, 0.82, 0.42], [0.27, 0.82, 0.45], 0.008, red);
  // Six seats: front pair, aft-facing middle pair, forward-facing rear pair.
  for (const [row, zz, facing] of [
    [0, 0.17, 0],
    [1, -0.53, Math.PI],
    [2, -1.52, 0],
  ])
    for (const side of [-1, 1]) {
      const x = side * 0.275,
        g = group(cabin, `Bonanza-seat-${row}-${side}`, [x, 0.97, zz]);
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
      const g = group(cabin, `Bonanza-pedal-${side}-${j}`, [side * 0.28 + j * 0.075, 0.84, 1.25]),
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
