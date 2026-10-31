/** PA-28-180 Cherokee C. Piper C-series drawing and original handbook panel.
 * Ground datum at main wheels; +Z forward. No later tapered wing or glass cockpit.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
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
export const cherokeeFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.55,
  cy: 1.1,
  ry: 0.67,
  cabinZ: 0.43,
  cabinWidth: 1.06,
  eye: [0.25, 1.56, 0.43],
  panelZ: 1.04,
  floor: 0.64,
});
export function buildCherokee(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Cherokee-ivory', '#e3e1d6', { side: T.DoubleSide }),
    navy = mat('Cherokee-blue', '#253c53', { side: T.DoubleSide }),
    gold = mat('Cherokee-gold', '#b69d60'),
    trim = mat('Cherokee-trim', '#343b3b'),
    metal = mat('Cherokee-metal', '#a8ada8', { metalness: 0.7 }),
    rubber = mat('Cherokee-rubber', '#242929'),
    glass = mat('Cherokee-glazing', '#b0c9cb', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'Cherokee-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // [z, half width, belly, crown, belt, shoulder, shoulder half width]. Slab lower sides up to
  // the window sill (widest), tall side glass leaning slightly in, a rounded crown and radiused
  // belly corners (C-series three-view, front, 3/4 and rear photos); the cowl and tail cone use
  // the same rounding.
  const measured = [
    [2.36, 0.31, 0.82, 1.41, 1.12, 1.32, 0.26],
    [2.18, 0.41, 0.73, 1.44, 1.12, 1.35, 0.35],
    [1.34, 0.49, 0.62, 1.46, 1.15, 1.37, 0.47],
    [0.56, 0.54, 0.57, 1.79, 1.22, 1.71, 0.47],
    // This station sits on the door/rear-window pillar so each window sheet contains its opening.
    [0, 0.55, 0.54, 1.79, 1.22, 1.71, 0.48],
    [-0.42, 0.53, 0.53, 1.73, 1.2, 1.62, 0.46],
    [-1.15, 0.43, 0.55, 1.61, 1.15, 1.47, 0.37],
    [-2.6, 0.25, 0.61, 1.34],
    [-3.68, 0.13, 0.67, 1.15],
    [-4.1, 0.08, 0.72, 1.06],
  ];
  // Points: 0 crown, 1-3 roof arc, 4 shoulder, 5 belt, 6-8 lower side and belly corner, 9 keel.
  const rings = measured.map(
    ([z, w, b, t, belt = b + (t - b) * 0.55, shoulder = b + (t - b) * 0.84, ws = w * 0.8]) => {
      const right = [
        ...[1, 2, 3].map((k) => [
          ws * Math.pow(Math.sin((k * Math.PI) / 8), 2 / 2.2),
          shoulder + (t - shoulder) * Math.pow(Math.cos((k * Math.PI) / 8), 2 / 2.2),
        ]),
        [ws, shoulder],
        [w, belt],
        [w * 0.985, b + (belt - b) * 0.35],
        [w * 0.9, b + Math.min(0.06, (belt - b) * 0.12)],
        [w * 0.62, b - 0.004],
      ];
      return {
        z,
        points: [[0, t], ...right, [0, b - 0.02], ...right.reverse().map(([x, y]) => [-x, y])],
      };
    },
  );
  const count = rings[0].points.length,
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  const roof = [14, 15, 16, 17, 0, 1, 2, 3];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 2 && roof.includes(j)) || ([2, 3, 4, 5].includes(i) && [4, 13].includes(j)),
  });
  for (const j of roof)
    quad(d, p(2, j), p(3, j), p(3, (j + 1) % count), p(2, (j + 1) % count), glass, [0, 1, 1]);
  // Skin half width at a station and height, so windows, doors and trim follow the curved side.
  const ringAt = (z) => {
    let i = rings.findIndex((r, n) => n < rings.length - 1 && z <= r.z && z >= rings[n + 1].z);
    if (i < 0) i = z > rings[0].z ? 0 : rings.length - 2;
    const a = rings[i].points,
      b = rings[i + 1].points,
      u = (z - rings[i].z) / (rings[i + 1].z - rings[i].z);
    return a.map((q, j) => [q[0] + (b[j][0] - q[0]) * u, q[1] + (b[j][1] - q[1]) * u]);
  };
  const halfWidth = (z, y) => {
    const q = ringAt(z);
    for (let j = 0; j < 9; j++)
      if (y <= q[j][1] && y >= q[j + 1][1])
        return q[j][0] + ((q[j + 1][0] - q[j][0]) * (y - q[j][1])) / (q[j + 1][1] - q[j][1] || 1);
    return q[5][0];
  };
  // Rounded window corners, laid out in side view (z, y).
  const rounded = (corners, r) =>
    corners.flatMap((c, n) => {
      const toward = (o) => {
        const dz = o[0] - c[0],
          dy = o[1] - c[1],
          l = Math.hypot(dz, dy);
        return [c[0] + (dz * r) / l, c[1] + (dy * r) / l];
      };
      const a = toward(corners[(n + corners.length - 1) % corners.length]),
        b = toward(corners[(n + 1) % corners.length]);
      return [a, [(a[0] + b[0]) / 4 + c[0] / 2, (a[1] + b[1]) / 4 + c[1] / 2], b];
    });
  // Each surface-following polyline is subdivided so straight runs stay on the curved skin.
  const along = (points, steps, closed = true) =>
    points.flatMap((a, n) => {
      if (!closed && n === points.length - 1) return [a];
      const b = points[(n + 1) % points.length];
      return Array.from({ length: steps }, (_, k) => a.map((v, m) => v + ((b[m] - v) * k) / steps));
    });
  // The one-piece windscreen wraps down the cabin side to the sill, ending at a raked A pillar
  // parallel to the door window's leading edge (Cherokee C three-view).
  const wrap = (side) => [side * halfWidth(0.85, 1.3), 1.3, 0.85];
  outline(
    d,
    [
      p(2, 14),
      wrap(-1),
      ...[...roof, 4].map((j) => p(3, j)),
      wrap(1),
      ...[...roof.slice(1), 4].reverse().map((j) => p(2, j)),
    ],
    0.013,
    paint,
  );
  d.rod(p(2, 0), p(3, 0), 0.014, paint);
  for (const side of [-1, 1]) {
    const top = side > 0 ? 4 : 14,
      sill = side > 0 ? 5 : 13,
      point = (z, y) => [side * halfWidth(z, y), y, z];
    sheet(d, [p(2, top), wrap(side), p(3, top)], glass, [side, 0, 0]);
    // Door window centred on the front seats, then the rear window behind a narrow pillar.
    for (const [i, end, corners] of [
      [
        2,
        4,
        [
          [0.764, 1.295],
          [0.5, 1.68],
          [0.03, 1.65],
          [0.054, 1.248],
        ],
      ],
      [
        4,
        6,
        [
          [-0.065, 1.627],
          [-0.695, 1.509],
          [-0.606, 1.208],
          [-0.046, 1.25],
        ],
      ],
    ]) {
      const edge = [];
      for (let n = i; n <= end; n++) {
        edge.push(p(n, top));
        if (n === 2) edge.push(wrap(side));
      }
      for (let n = end; n >= i; n--) edge.push(p(n, sill));
      const h = rounded(corners, 0.045).map((q) => point(...q));
      sheet(d, edge, paint, [side, 0, 0], [h]);
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.008, metal);
    }
    // Original continuous color belt, following each section rather than floating decals.
    for (let i = 0; i < rings.length - 1; i++) {
      const a = measured[i],
        b = measured[i + 1],
        ta = a[2] + Math.min(0.34, (a[3] - a[2]) * 0.5),
        tb = b[2] + Math.min(0.34, (b[3] - b[2]) * 0.5);
      quad(
        d,
        [side * (halfWidth(a[0], a[2] + 0.19) + 0.002), a[2] + 0.19, a[0]],
        [side * (halfWidth(b[0], b[2] + 0.19) + 0.002), b[2] + 0.19, b[0]],
        [side * (halfWidth(b[0], tb) + 0.002), tb, b[0]],
        [side * (halfWidth(a[0], ta) + 0.002), ta, a[0]],
        navy,
        [side, 0, 0],
      );
      d.rod(
        [side * (halfWidth(a[0], a[2] + 0.24) + 0.005), a[2] + 0.24, a[0]],
        [side * (halfWidth(b[0], b[2] + 0.24) + 0.005), b[2] + 0.24, b[0]],
        0.009,
        gold,
      );
    }
    if (side < 0)
      outline(
        d,
        along(
          [
            [0.54, 1.75],
            [0.0, 1.74],
            [0.0, 0.92],
            [0.9, 0.92],
            [0.9, 1.25],
          ],
          6,
        ).map(([z, y]) => [side * (halfWidth(z, y) + 0.002), y, z]),
        0.003,
        trim,
      );
    d.box([0.018, 0.022, 0.085], [side * (halfWidth(0.12, 1.12) + 0.012), 1.12, 0.12], metal);
  }
  for (const i of [1, 2, 6, 7, 8]) {
    const r = rings[i];
    outline(
      d,
      r.points.map((q) => [q[0] * 1.003, q[1], r.z]),
      0.0028,
      metal,
    );
    for (let j = 0; j < count; j++) {
      const a = p(i, j),
        b = p(i, (j + 1) % count);
      for (const t of [1 / 3, 2 / 3])
        d.add(
          new T.SphereGeometry(0.003, 6, 4),
          metal,
          a.map((v, n) => v + (b[n] - v) * t),
        );
    }
  }
  for (const side of [-1, 1]) {
    // Hershey-bar wing: full-span constant 63-inch chord, 5.5-degree dihedral.
    const y = (x) => 0.75 + Math.abs(x) * 0.096;
    wing(
      d,
      [
        [side * 0.45, y(0.45), 0.72, -0.48, 0.135],
        [side * 2.7, y(2.7), 0.72, -0.48, 0.135],
        [side * 2.72, y(2.72), 0.72, -0.57, 0.135],
        [side * 4.33, y(4.33), 0.72, -0.57, 0.135],
        [side * 4.572, y(4.572), 0.65, -0.83, 0.11],
      ],
      // White like its flaps and ailerons; the blue belongs to the fuselage belt and tail.
      paint,
      0.065,
    );
    const upper = (x, z) => {
      const back = x < 2.71 ? -0.48 : -0.57,
        chord = 0.72 - back;
      const u = (0.72 - z) / chord;
      return u < 0.25
        ? u * 0.54
        : u < 0.75
          ? 0.135 - (u - 0.25) * 0.1296
          : u < 1
            ? (1 - u) * 0.2808
            : 0.008;
    };
    for (let x = 0.75; x < 4.3; x += 0.39) {
      outline(
        d,
        [0.42, 0.2, -0.18, -0.48, -0.84].map((z) => [side * x, y(x) + upper(x, z) + 0.003, z]),
        0.0015,
        metal,
        false,
      );
      for (let z = -0.78; z < 0.42; z += 0.12)
        d.add(new T.SphereGeometry(0.0025, 5, 3), metal, [side * x, y(x) + upper(x, z) + 0.003, z]);
    }
    d.rod([side * 0.6, y(0.6) + 0.07, 0.48], [side * 4.27, y(4.27) + 0.07, 0.48], 0.003, paint);
    d.add(new T.CylinderGeometry(0.045, 0.045, 0.012, 16), metal, [
      side * 1.2,
      y(1.2) + upper(1.2, 0.36) + 0.006,
      0.36,
    ]);
    const fg = group(root, `Cherokee-flap-${side}`, [side * 0.58, y(0.58), -0.48]),
      fd = detailKit(fg, 'flap');
    wing(
      fd,
      [
        [0, 0, 0, -0.42],
        [side * 2.12, 0.2035, 0, -0.42],
      ],
      paint,
      0.045,
    );
    fd.finish();
    flaps.push({ node: fg.name, axis: 'x', multiplier: (-40 * Math.PI) / 180 });
    const ag = group(root, `Cherokee-aileron-${side}`, [side * 2.72, y(2.72), -0.57]),
      ad = detailKit(ag, 'aileron');
    wing(
      ad,
      [
        [0, 0, 0, -0.33],
        [side * 1.57, 0.151, 0, -0.33],
      ],
      paint,
      0.045,
    );
    ad.finish();
    ailerons.push({ node: ag.name, axis: 'x', multiplier: -side * 0.35 });
    for (let x = 0.75; x < 2.6; x += 0.18)
      d.rod([side * x, y(x) + 0.014, -0.56], [side * x, y(x) + 0.008, -0.86], 0.002, trim);
    d.add(new T.SphereGeometry(0.037, 10, 6), side > 0 ? d.red : d.green, [
      side * 4.55,
      y(4.55),
      0.29,
    ]);
    if (side < 0) {
      d.box([0.31, 0.008, 0.88], [-0.69, 0.8, -0.02], trim);
      d.rod([-halfWidth(-0.96, 0.64), 0.64, -0.96], [-0.92, 0.34, -1.05], 0.015, metal);
      d.rod([-0.92, 0.34, -1.05], [-1.11, 0.34, -1.05], 0.015, metal);
    }
  }
  // Low all-moving stabilator, with separate anti-servo trailing tab.
  const st = group(root, 'Cherokee-stabilator', [0, 0.85, -4.0]),
    sd = detailKit(st, 'stabilator');
  for (const side of [-1, 1]) {
    wing(
      sd,
      [
        [0, 0, 0.36, -0.402],
        [side * 1.42, 0, 0.36, -0.402],
        [side * 1.524, 0, 0.28, -0.33],
      ],
      paint,
      0.045,
    );
    sd.rod([side * 0.17, 0.015, -0.25], [side * 1.4, 0.015, -0.25], 0.003, trim);
  }
  sd.finish();
  bindings.push({
    node: st.name,
    source: 'pitchInput',
    property: 'rotation',
    axis: 'x',
    scale: 0.25,
  });
  const fin = [
    [-3.02, 1.12],
    [-3.3, 1.32],
    [-4.04, 2.23],
    [-4.31, 2.17],
    [-3.98, 0.95],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map(([z, y]) => [side * 0.036, y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-0.036, a[1], a[0]],
      [-0.036, b[1], b[0]],
      [0.036, b[1], b[0]],
      [0.036, a[1], a[0]],
      paint,
      [0, 1, 0],
    );
  }
  const rg = group(root, 'Cherokee-rudder', [0, 1.1, -4.13]),
    rd = detailKit(rg, 'rudder');
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.04, -0.1, 0],
        [side * 0.04, 1.05, -0.23],
        [side * 0.04, 1.01, -0.4],
        [side * 0.04, -0.13, -0.16],
      ],
      navy,
      [side, 0, 0],
    );
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  d.add(new T.SphereGeometry(0.026, 8, 6), d.red, [0, 2.254, -4.05]);
  d.rod([0, 1.78, -0.3], [0, 2.02, -0.47], 0.008, metal);
  // C-series flat cowl face, separated cheeks, induction inlet, spinner and two-blade propeller.
  // C-series oval nose-bowl mouth around the spinner, with grille slats and a rolled lip, and
  // the landing light below it (Cherokee C front view).
  const mouth = rounded(
    [
      [-0.265, 1.35],
      [0.265, 1.35],
      [0.265, 1.15],
      [-0.265, 1.15],
    ],
    0.09,
  ).map(([x, y]) => [x, y, 2.363]);
  sheet(d, mouth, trim, [0, 0, 1]);
  outline(d, mouth, 0.01, paint);
  for (const y of [1.2, 1.25, 1.3]) d.rod([-0.245, y, 2.365], [0.245, y, 2.365], 0.004, metal);
  d.add(new T.CircleGeometry(0.05, 16), d.ivory, [0, 1.05, 2.364]);
  d.ring(0.05, 0.008, [0, 1.05, 2.365], metal);
  for (const side of [-1, 1]) {
    d.rod([side * 0.28, 0.78, 1.65], [side * 0.29, 0.65, 1.49], 0.025, metal);
    for (let i = 0; i < 9; i++)
      d.box(
        [0.009, 0.04, 0.022],
        [side * (halfWidth(2.05 - i * 0.04, 0.8) + 0.002), 0.8, 2.05 - i * 0.04],
        trim,
      );
  }
  d.box([0.14, 0.075, 0.02], [0, 0.94, 2.377], trim);
  const eg = group(root, 'engine-1', [0, 1.25, 2.37]),
    pg = group(eg, 'Cherokee-propeller'),
    pd = detailKit(pg, 'propeller');
  pd.add(new T.ConeGeometry(0.16, 0.29, 24).rotateX(Math.PI / 2), paint, [0, 0, 0.145]);
  for (const side of [-1, 1]) {
    const pts = [
      [side * 0.08, -0.025, 0],
      [side * 0.32, -0.07, 0.015],
      [side * 0.79, -0.065, -0.005],
      [side * 0.9652, -0.025, -0.02],
      [side * 0.9652, 0.035, -0.02],
      [side * 0.5, 0.075, 0.015],
      [side * 0.1, 0.035, 0],
    ];
    sheet(pd, pts, trim, [0, 0, 1]);
    sheet(
      pd,
      pts.map((p) => [p[0], p[1], p[2] - 0.015]),
      trim,
      [0, 0, -1],
    );
    pd.box([0.07, 0.065, 0.014], [side * 0.91, 0.005, -0.012], paint);
  }
  pd.finish();
  for (const [x, z, r] of [
    [0, 1.896, 0.22],
    [1.524, 0, 0.23],
    [-1.524, 0, 0.23],
  ]) {
    d.rod([x, 0.75, z - 0.06], [x, r, z], 0.028, metal);
    d.rod([x, 0.72, z - 0.18], [x, 0.36, z - 0.02], 0.024, paint);
    d.add(new T.CylinderGeometry(r, r, 0.14, 24).rotateZ(Math.PI / 2), rubber, [x, r, z]);
    for (const side of [-1, 1])
      d.add(new T.CircleGeometry(r * 0.51, 18).rotateY((side * Math.PI) / 2), metal, [
        x + side * 0.072,
        r,
        z,
      ]);
    // Smooth teardrop wheel pants, open underneath so tires remain grounded.
    const pant = [
      [-0.4, 0.025, 0.33, 0.37],
      [-0.3, 0.095, 0.27, 0.44],
      [-0.12, 0.135, 0.25, 0.49],
      [0.12, 0.14, 0.25, 0.5],
      [0.27, 0.105, 0.27, 0.45],
      [0.35, 0.035, 0.32, 0.4],
    ].map(([zz, w, b, t]) => ({
      z: z + zz,
      points: Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6,
          c = Math.cos(a),
          s = Math.sin(a);
        return [
          x + w * Math.sign(s) * Math.pow(Math.abs(s), 0.85),
          (b + t) / 2 + ((t - b) / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.85),
        ];
      }),
    }));
    loft(d, pant, paint);
  }
  d.finish();
  const interior = cockpit(root, { paint, navy, trim, metal, rings });
  cleanGeometry(root);
  return {
    root,
    frame: cherokeeFrame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.25, 2.37] }],
    visual: {
      rotors: [{ node: pg.name, axis: 'z', multiplier: 1, engine: 'engine-1' }],
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
    d = detailKit(cabin, 'Cherokee-cockpit'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Cherokee');
  const { bindings, derived } = instruments;
  const face = mat('Cherokee-panel', '#a4a394'),
    seat = mat('Cherokee-seats', '#726b5c'),
    belt = mat('Cherokee-belts', '#c5bca3', { side: T.DoubleSide });
  const k = 0.079375 / 110,
    px = (u) => (750 - u) * k,
    py = (v) => 1.38 - (v - 100) * k,
    z = 1.04,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const edge = [
    [15, 340],
    [35, 245],
    [90, 170],
    [180, 125],
    [310, 88],
    [690, 62],
    [735, 25],
    [790, 10],
    [1000, 15],
    [1045, 58],
    [1250, 92],
    [1400, 136],
    [1470, 230],
    [1490, 325],
    [1455, 335],
    [1455, 640],
    [55, 650],
    [55, 350],
  ];
  const apertures = [
    [120, 244, 43],
    [407, 188, 55],
    [575, 202, 54],
  ];
  const holes = (depth) =>
    apertures.map(([u, v, r]) =>
      Array.from({ length: 48 }, (_, i) => {
        const a = (i * Math.PI) / 24;
        return [px(u) + Math.cos(a) * r * k * 0.84, py(v) + Math.sin(a) * r * k * 0.84, z + depth];
      }),
    );
  // The nominal aperture scale exceeds the narrowing nose at the two panel corners.
  // Trim only that outside contour; keep the measured instrument centers/apertures.
  const edgeAt = (u, v, depth = 0) => [Math.max(-0.48, Math.min(0.48, px(u))), py(v), z + depth];
  sheet(
    d,
    edge.map(([u, v]) => edgeAt(u, v)),
    face,
    [0, 0, -1],
    holes(0),
  );
  sheet(
    d,
    edge.map(([u, v]) => edgeAt(u, v, 0.065)),
    m.trim,
    [0, 0, 1],
    holes(0.065),
  );
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i],
      b = edge[(i + 1) % edge.length];
    quad(
      d,
      edgeAt(...a),
      edgeAt(...b),
      edgeAt(...b, 0.065),
      edgeAt(...a, 0.065),
      m.trim,
      [0, 1, 0],
    );
  }
  const brow = edge.slice(0, 14).map(([u, v]) => edgeAt(u, v, -0.025));
  outline(d, brow, 0.012, m.trim, false);
  const forwardDeck = (x) => {
    const xx = Math.max(-0.465, Math.min(0.465, x)),
      a = Math.abs(xx);
    return [
      xx,
      1.455 - (a < 0.3724 ? (a * 0.025) / 0.3724 : 0.025 + ((a - 0.3724) * 0.095) / 0.1176),
      1.34,
    ];
  };
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, forwardDeck(b[0]), forwardDeck(a[0]), m.trim, [0, 1, 0]);
  }
  const sources = {
    trueAirspeed: { component: 'aircraftState', path: ['airspeed'] },
    altitude: { component: 'transform', path: ['pos', 1] },
    roll: { component: 'aircraftState', path: ['roll'] },
    pitch: { component: 'aircraftState', path: ['pitch'] },
    yaw: { component: 'aircraftState', path: ['yaw'] },
    yawRate: { component: 'aircraftState', path: ['yawRate'] },
    propNormalized: { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] },
    verticalSpeed: { component: 'aircraftState', path: ['verticalSpeed'] },
    pitchInput: { component: 'aircraftInput', path: ['pitch'] },
    rollInput: { component: 'aircraftInput', path: ['roll'] },
    yawInput: { component: 'aircraftInput', path: ['yaw'] },
    power: { component: 'aircraftInput', path: ['power'] },
  };
  Object.assign(derived, {
    mph: { op: 'divide', args: ['trueAirspeed', 0.44704] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    propHundreds: { op: 'multiply', args: ['propNormalized', 27] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * Math.PI] },
    climbHundreds: { op: 'multiply', args: ['verticalSpeed', 0.6 / 0.3048] },
    rightYawDegrees: { op: 'multiply', args: ['yawRate', -180 / Math.PI] },
  });
  // Period MPH face, with an explicitly labeled TAS approximation. The low-resolution
  // handbook establishes the face arrangement but not exact dial angles.
  instruments.dial(
    'airspeed',
    at(240, 212, -0.01),
    55 * k,
    'mph',
    [
      [0, 0],
      [40, 0.35],
      [60, 0.85],
      [80, 1.45],
      [100, 2.1],
      [120, 2.75],
      [140, 3.45],
      [160, 4.15],
      [180, 4.8],
      [200, 5.45],
    ],
    [40, 60, 80, 100, 120, 140, 160, 180, 200],
    'TAS MPH',
    { minorStep: 10, responseSeconds: 0.2 },
  );
  instruments.altimeter('altimeter', at(242, 346, -0.01), 55 * k, 'feet');
  instruments.headingDrum('compass', at(120, 244, -0.01), 43 * k, 'trueHeading');
  instruments.headingDrum('heading', at(407, 188, -0.01), 55 * k, 'trueHeading');
  // The pitch card is behind a real hole; the large backing mask stays behind the panel.
  instruments.horizon('attitude', at(575, 202, 0.01), 54 * k * 1.55, 54 * k * 1.55, {
    round: true,
  });
  d.ring(54 * k * 0.92, 0.002, at(575, 202, -0.008), m.metal);
  instruments.dial(
    'tachometer',
    at(1084, 175, -0.01),
    54 * k,
    'propHundreds',
    [
      [0, -2.45],
      [35, 2.45],
    ],
    [0, 5, 10, 15, 20, 25, 30, 35],
    'RPM X100',
    { minorStep: 1, responseSeconds: 0.1 },
  );
  instruments.dial(
    'climb',
    at(242, 480, -0.01),
    55 * k,
    'climbHundreds',
    [
      [-20, -4.2],
      [0, -Math.PI / 2],
      [20, 1.05],
    ],
    [-20, -15, -10, -5, 0, 5, 10, 15, 20],
    'FT/M X100',
    { responseSeconds: 0.7 },
  );
  // Turn-and-bank needle uses body yaw rate. A slip ball needs lateral specific force,
  // which the current telemetry does not provide, so its window stays unavailable.
  pt.gauge(px(409), py(357), z - 0.01, 55 * k, undefined, false);
  instruments.pointer(
    'turn',
    at(409, 357, -0.035),
    55 * k * 0.74,
    'rightYawDegrees',
    [
      [-6, -0.7],
      [-3, -0.35],
      [0, 0],
      [3, 0.35],
      [6, 0.7],
    ],
    { responseSeconds: 0.25 },
  );
  d.text('L   YAW   R', at(409, 390, -0.038), 0.004, Math.PI, instruments.ink);
  for (const sign of [-1, 1]) {
    const a = sign * 0.35,
      r = 55 * k;
    d.rod(
      [px(409) - Math.sin(a) * r * 0.78, py(357) + Math.cos(a) * r * 0.78, z - 0.036],
      [px(409) - Math.sin(a) * r * 0.92, py(357) + Math.cos(a) * r * 0.92, z - 0.036],
      0.001,
      instruments.ink,
    );
  }
  d.text('--', at(409, 382, -0.038), 0.005, Math.PI, instruments.ink);
  // Keep the original instrument locations, but never invent receiver, vacuum or clock data.
  for (const [u, v, r, label] of [
    [712, 207, 52, 'NAV'],
    [119, 377, 40, 'CLOCK'],
    [1338, 233, 41, 'VACUUM'],
    [837, 103, 41, 'ADF'],
  ]) {
    pt.gauge(px(u), py(v), z - 0.01, r * k, undefined, false);
    d.text(label, at(u, v + 19, -0.034), r * k * 0.14, Math.PI, instruments.ink);
    d.text('INOP', at(u, v, -0.034), r * k * 0.21, Math.PI, instruments.amber);
  }
  for (const [u, v] of [
    [1210, 176],
    [1352, 342],
    [575, 355],
    [711, 342],
  ]) {
    d.add(new T.CircleGeometry(0.039, 24).rotateY(Math.PI), m.trim, at(u, v, -0.013));
    d.rod(at(u - 28, v, -0.018), at(u + 28, v, -0.018), 0.002, m.metal);
    pt.knob(px(u), py(v), z - 0.022, 0.007);
  }
  for (const v of [314, 363]) {
    d.box([0.165, 0.028, 0.012], at(1149, v, -0.014), m.trim);
    for (let j = 0; j < 3; j++) {
      const u = 1085 + j * 65;
      d.box([0.042, 0.02, 0.004], at(u, v, -0.023), face);
      for (let q = 0; q < 5; q++)
        d.box([0.001, 0.004, 0.001], at(u - 23 + q * 11, v - 8, -0.027), d.dark);
      d.text('--', at(u, v, -0.027), 0.006, Math.PI, d.dark);
      d.text(['FUEL', 'OIL', 'TEMP'][j], at(u, v + 17, -0.027), 0.004, Math.PI, d.dark);
    }
  }
  // 1960s analog radio stack and horizontal engine-gauge windows.
  for (const [u, v, w, h] of [
    [892, 222, 211, 112],
    [892, 349, 211, 111],
    [892, 462, 211, 94],
    [563, 466, 245, 65],
  ]) {
    d.box([w * k, h * k, 0.018], at(u, v, -0.015), m.trim);
    d.box([w * k * 0.9, h * k * 0.7, 0.006], at(u, v, -0.027), face);
    for (const side of [-1, 1]) pt.knob(px(u + side * w * 0.36), py(v), z - 0.038, 0.012);
    d.box([w * k * 0.5, 0.012, 0.003], at(u, v - 8, -0.034), d.dark);
    d.text('--', at(u, v - 8, -0.038), 0.007, Math.PI, d.ivory);
  }
  for (let i = 0; i < 14; i++) {
    pt.knob(px(340 + i * 32), py(528), z - 0.022, 0.009);
    d.text(String(i + 1), at(340 + i * 32, 548, -0.033), 0.005, Math.PI, d.dark);
  }
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) pt.knob(px(80 + c * 32), py(447 + r * 32), z - 0.023, 0.009);
  for (const [u, v] of [
    [108, 608],
    [214, 608],
    [343, 609],
    [380, 610],
    [414, 611],
    [448, 610],
    [555, 607],
    [650, 608],
    [1030, 606],
    [1175, 605],
    [1240, 605],
    [1313, 604],
  ])
    pt.knob(px(u), py(v), z - 0.024, 0.011);
  for (const [u, v] of [
    [342, 273],
    [463, 271],
    [274, 610],
    [971, 467],
  ])
    pt.vent(px(u), py(v), z - 0.019, 'rect', 0.042);
  d.box([0.174, 0.083, 0.009], at(1282, 482, -0.012), m.trim);
  d.text('CHEROKEE 180', at(1282, 479, -0.02), 0.012, Math.PI, d.ivory);
  // Twin period yokes: narrow shaft, open U grips, no opaque steering wheels.
  for (const u of [409, 1084]) {
    const x = px(u),
      y = py(460),
      g = group(cabin, `Cherokee-yoke-${u}`, [x, y, 0.89]),
      dd = detailKit(g, 'yoke');
    dd.rod([0, 0, 0.15], [0, 0, -0.2], 0.017, m.metal);
    outline(
      dd,
      [
        [-0.135, 0.075, -0.2],
        [-0.125, -0.015, -0.2],
        [-0.06, -0.055, -0.2],
        [0.06, -0.055, -0.2],
        [0.125, -0.015, -0.2],
        [0.135, 0.075, -0.2],
      ],
      0.015,
      m.trim,
      false,
    );
    dd.box([0.055, 0.046, 0.03], [0, -0.038, -0.2], m.trim);
    dd.text('PIPER', [0, -0.033, -0.22], 0.007, Math.PI, dd.ivory);
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.04 },
    );
  }
  // Push-pull throttle/mixture below the panel, manual flap lever and roof trim crank.
  for (const [x, col] of [
    [0.08, m.trim],
    [-0.04, d.red],
  ]) {
    const control = group(cabin, x > 0 ? 'Cherokee-throttle' : 'Cherokee-mixture', [x, 1.03, 1.04]);
    const cd = detailKit(control, control.name);
    cd.rod([0, 0, 0], [0, 0, -0.18], 0.009, m.metal);
    cd.add(new T.SphereGeometry(0.024, 12, 8), col, [0, 0, -0.19]);
    if (x > 0)
      control.userData.aircraftControl = {
        action: 'power',
        motion: { property: 'position', axis: 'z', scale: 0.07 },
      };
    cd.finish();
  }
  const flapLever = group(cabin, 'Cherokee-flap-lever', [0, 0.68, 0.1]);
  const fd = detailKit(flapLever, flapLever.name);
  fd.rod([0, 0, 0], [0, 0.14, 0.28], 0.013, m.metal);
  fd.box([0.055, 0.025, 0.065], [0, 0.14, 0.28], m.trim);
  flapLever.userData.aircraftControl = {
    action: 'flaps',
    motion: { property: 'rotation', axis: 'x', scale: -0.45 },
  };
  fd.finish();
  d.rod([0, 1.76, 0.2], [0, 1.7, 0.2], 0.009, m.metal);
  d.rod([0, 1.7, 0.2], [0.1, 1.7, 0.2], 0.008, m.metal);
  d.rod([0.1, 1.7, 0.2], [0.1, 1.66, 0.2], 0.01, m.trim);
  // The floor follows the radiused belly corners; the rear seats sit inside the narrower aft cabin.
  fittedFloor(d, m.rings, m.trim, { y: 0.6575, front: 0.84, back: -0.96, width: 1.0 });
  for (const zz of [0.24, -0.61])
    for (const x of zz > 0 ? [-0.26, 0.26] : [-0.225, 0.225]) {
      const w = zz > 0 ? 0.43 : 0.4;
      beveledBox(d, [w, 0.1, 0.45], [x, 0.83, zz], seat);
      beveledBox(d, [w, 0.51, 0.11], [x, 1.1, zz - 0.19], seat);
      for (const side of [-1, 1]) {
        d.rod([x + side * 0.16, 0.67, zz - 0.1], [x + side * 0.16, 0.79, zz - 0.1], 0.014, m.metal);
        sheet(
          d,
          [
            [x + side * 0.16, 0.9, zz - 0.13],
            [x + side * 0.12, 0.9, zz - 0.13],
            [x + 0.02, 0.9, zz + 0.17],
            [x - 0.02, 0.9, zz + 0.17],
          ],
          belt,
          [0, 1, 0],
        );
      }
      d.box([0.055, 0.015, 0.04], [x, 0.91, zz + 0.17], m.metal);
    }
  for (const side of [-1, 1]) {
    d.box([0.022, 0.2, 1.1], [side * 0.5, 0.86, 0.1], seat);
    d.rod([side * 0.49, 1.03, 0.33], [side * 0.49, 1.03, -0.02], 0.018, m.trim);
    for (const j of [-1, 1]) {
      const pedal = group(cabin, `Cherokee-pedal-${side}-${j}`, [
        side * 0.25 + j * 0.08,
        0.74,
        1.2,
      ]);
      const pd = detailKit(pedal, pedal.name);
      pd.box([0.12, 0.06, 0.05], [0, 0, 0], m.metal);
      pedal.userData.aircraftControl = {
        action: 'yaw',
        motion: { property: 'position', axis: 'z', scale: j * 0.035 },
      };
      pd.finish();
    }
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
