/** 2020 SR22T G6, optional 12-inch Perspective+ and MD302; stock 78-inch three-blade.
 * Main wheel axle datum, +Z nose, +X pilot left. Composite shell and true window apertures.
 * POH 13772-007 three-view/cabin plan and 2020 factory cockpit photograph.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { addG1000Readouts } from './g1000-panel.mjs';
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

export const cirrusFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.68,
  cy: 1.35,
  ry: 0.72,
  cabinZ: 0.45,
  cabinWidth: 1.25222,
  eye: [0.31, 1.89, 0.45],
  panelZ: 1.16,
  floor: 0.72,
});
export function buildCirrus(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Cirrus-pearl', '#e7e8e4', { side: T.DoubleSide }),
    accent = mat('Cirrus-graphite', '#3e4c59', { side: T.DoubleSide }),
    metal = mat('Cirrus-alloy', '#a7b1b5', { metalness: 0.7 }),
    dark = mat('Cirrus-trim', '#242c30'),
    rubber = mat('Cirrus-tire', '#192023'),
    glass = mat('Cirrus-glazing', '#aecbd3', {
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'Cirrus-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // [z, half width, belly, crown, belt, shoulder, shoulder half width]. The cabin is an oval
  // bubble: full lower sides up to the belt (widest), side glass leaning in above it under a
  // round crown (G6/G7 front and 3/4 photos). The cowl and tail cone are rounded ovals.
  const stations = [
    // Long tapered cowl: round lip behind a long spinner, chin sweeping up to the lip and the
    // windscreen sill well aft of the nose (EC-ONS telephoto profile).
    // The lip is broad in plan: the two round inlets sit at its outer corners (front photo).
    [2.76, 0.46, 1.04, 1.42, 1.22, 1.35, 0.36],
    [2.45, 0.56, 0.82, 1.5, 1.17, 1.41, 0.46],
    [1.6, 0.62, 0.7, 1.57, 1.18, 1.45, 0.52],
    [1.3, 0.65, 0.65, 1.81, 1.3, 1.65, 0.62],
    [0.65, 0.68, 0.63, 2.05, 1.45, 1.94, 0.54],
    [-0.2, 0.68, 0.65, 2.04, 1.45, 1.93, 0.54],
    [-1, 0.63, 0.68, 1.92, 1.43, 1.76, 0.49],
    [-1.8, 0.43, 0.77, 1.75, 1.3, 1.58, 0.32],
    [-2.7, 0.2, 0.92, 1.62],
    [-3.6, 0.065, 1.04, 1.55],
    [-4.1, 0.04, 1.12, 1.35],
    [-4.38, 0.012, 1.22, 1.27],
  ];
  // Points: 0 crown, 1-3 roof arc, 4 shoulder, 5 belt, 6-9 lower side, 10 keel, then mirrored.
  const rings = stations.map(
    ([z, w, b, t, belt = b + (t - b) * 0.5, shoulder = b + (t - b) * 0.8, ws = w * 0.74]) => {
      const right = [
        ...[1, 2, 3].map((k) => [
          ws * Math.pow(Math.sin((k * Math.PI) / 8), 2 / 2.4),
          shoulder + (t - shoulder) * Math.pow(Math.cos((k * Math.PI) / 8), 2 / 2.4),
        ]),
        [ws, shoulder],
        [w, belt],
        [w * 0.99, b + (belt - b) * 0.5],
        [w * 0.94, b + (belt - b) * 0.12],
        [w * 0.76, b + (belt - b) * 0.015],
        [w * 0.4, b - 0.018],
      ];
      return {
        z,
        points: [[0, t], ...right, [0, b - 0.025], ...right.reverse().map(([x, y]) => [-x, y])],
      };
    },
  );
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  const roof = [16, 17, 18, 19, 0, 1, 2, 3];
  loft(d, rings, paint, {
    skip: (i, j) =>
      ([2, 3].includes(i) && roof.includes(j)) || ([3, 4, 5].includes(i) && [4, 15].includes(j)),
  });
  for (const i of [2, 3])
    for (const j of roof)
      quad(d, p(i, j), p(i + 1, j), p(i + 1, (j + 1) % 20), p(i, (j + 1) % 20), glass, [0, 1, 1]);
  outline(
    d,
    [
      p(2, 16),
      p(3, 16),
      ...[...roof, 4].map((j) => p(4, j)),
      p(3, 4),
      ...[...roof.slice(1), 4].reverse().map((j) => p(2, j)),
    ],
    0.012,
    paint,
  );
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
    for (let j = 0; j < 10; j++)
      if (y <= q[j][1] && y >= q[j + 1][1])
        return q[j][0] + ((q[j + 1][0] - q[j][0]) * (y - q[j][1])) / (q[j + 1][1] - q[j][1] || 1);
    return q[5][0];
  };
  const crownAt = (z, x) => {
    const q = ringAt(z);
    for (let j = 0; j < 4; j++)
      if (x >= q[j][0] && x <= q[j + 1][0])
        return q[j][1] + ((q[j + 1][1] - q[j][1]) * (x - q[j][0])) / (q[j + 1][0] - q[j][0] || 1);
    return q[4][1];
  };
  for (const side of [-1, 1]) {
    const j = side > 0 ? 4 : 15,
      point = (z, y) => [side * halfWidth(z, y), y, z];
    for (const [start, end, coords] of [
      [
        3,
        5,
        [
          [1.22, 1.57],
          [0.69, 1.9],
          [0.58, 1.92],
          [0.02, 1.91],
          [-0.08, 1.84],
          [-0.08, 1.53],
          [0.03, 1.49],
          [1.04, 1.51],
        ],
      ],
      [
        5,
        6,
        [
          [-0.29, 1.85],
          [-0.46, 1.83],
          [-0.74, 1.76],
          [-0.94, 1.68],
          [-0.94, 1.6],
          [-0.84, 1.55],
          [-0.38, 1.52],
          [-0.28, 1.58],
        ],
      ],
    ]) {
      const edge = [];
      for (let i = start; i <= end; i++) edge.push(p(i, j));
      for (let i = end; i >= start; i--) edge.push(p(i, j + 1));
      const hole = coords.map((q) => point(...q));
      sheet(d, edge, paint, [side, 0, 0], [hole]);
      sheet(d, hole, glass, [side, 0, 0]);
      outline(d, hole, 0.007, dark);
    }
    // Seams are subdivided in side view and lifted off the skin so they follow the curved side.
    const trace = (points) =>
      points.flatMap((a, n) => {
        const b = points[(n + 1) % points.length];
        return [0, 0.25, 0.5, 0.75].map((t) => {
          const z = a[0] + (b[0] - a[0]) * t,
            y = a[1] + (b[1] - a[1]) * t;
          return [side * (halfWidth(z, y) + 0.003), y, z];
        });
      });
    // Doors, service hatches and cowling fasteners; no fictitious metal skin rivet grid.
    outline(
      d,
      trace([
        [0.72, 1.99],
        [-0.16, 1.97],
        [-0.27, 1.12],
        [-0.15, 1.05],
        [0.88, 1.05],
        [1.04, 1.12],
        [1.27, 1.56],
      ]),
      0.0023,
      metal,
    );
    d.box([0.018, 0.03, 0.12], point(-0.05, 1.16), metal);
    for (const z of [0.71, 0.45])
      d.box([0.035, 0.015, 0.055], [side * (halfWidth(z, 1.99) + 0.004), 1.99, z], metal);
    if (side > 0) {
      const bag = trace(
        [
          [-1.52, 1.4],
          [-1.52, 0.94],
          [-1.62, 0.91],
          [-1.98, 0.94],
          [-2.03, 1.35],
          [-1.93, 1.42],
        ].map(([z, y]) => [z + 0.5, y]),
      );
      outline(d, bag, 0.002, metal);
      d.box([0.02, 0.022, 0.08], point(-1.18, 1.35), dark);
    }
    for (let i = 0; i < stations.length - 2; i++) {
      const a = stations[i],
        b = stations[i + 1],
        ya = a[2] + Math.min(0.27, (a[3] - a[2]) * 0.45),
        yb = b[2] + Math.min(0.27, (b[3] - b[2]) * 0.45),
        ta = ya + Math.min(0.045, (a[3] - a[2]) * 0.1),
        tb = yb + Math.min(0.045, (b[3] - b[2]) * 0.1);
      quad(
        d,
        [side * (halfWidth(a[0], ya) + 0.002), ya, a[0]],
        [side * (halfWidth(b[0], yb) + 0.002), yb, b[0]],
        [side * (halfWidth(b[0], tb) + 0.002), tb, b[0]],
        [side * (halfWidth(a[0], ta) + 0.002), ta, a[0]],
        accent,
        [side, 0, 0],
      );
    }
    for (const i of [1, 2])
      outline(
        d,
        rings[i].points.map((q) => [...q, rings[i].z]),
        0.0015,
        metal,
      );
    for (let z = 2; z < 2.8; z += 0.12)
      d.add(new T.SphereGeometry(0.003, 6, 4), metal, [side * halfWidth(z, 1.14), 1.14, z]);
    // Round induction inlets either side of the spinner, with a rolled lip.
    d.ring(0.088, 0.022, [side * 0.29, 1.215, 2.775], paint);
    d.add(new T.CircleGeometry(0.085, 20), dark, [side * 0.29, 1.215, 2.768]);
    d.rod([side * 0.3, 0.7, 1.76], [side * 0.34, 0.57, 1.62], 0.024, metal);
    d.box([0.16, 0.012, 0.29], [side * 0.35, 0.69, 1.55], accent);
    // The G6 retains the characteristic outboard cuff in its discontinuous leading edge.
    const y = (x) => 0.72 + x * 0.052,
      le = (x) => (x < 3.3 ? 0.87 - x * 0.018 : 0.9 - (x - 3.3) * 0.05),
      te = (x) => -0.65 + x * 0.097,
      hinge = (x) => te(x) + 0.24 * (le(x) - te(x));
    wing(
      d,
      [
        [side * 0.52, y(0.52), le(0.52), hinge(0.52), 0.1],
        [side * 3.28, y(3.28), le(3.28), hinge(3.28), 0.075],
        [side * 3.3, y(3.3), le(3.3), hinge(3.3), 0.075],
        [side * 5.49, y(5.49), le(5.49), hinge(5.49), 0.046],
        [side * 5.72, y(5.72), le(5.72) - 0.025, te(5.72), 0.033],
        [side * 5.83692, y(5.83692), le(5.83692) - 0.25, te(5.83692) + 0.025, 0.009],
      ],
      paint,
    );
    for (const [kind, a, b] of [
      ['flap', 0.64, 3.58],
      ['aileron', 3.61, 5.06],
    ]) {
      const g = group(root, `Cirrus-${kind}-${side}`, [side * a, y(a), hinge(a)]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(a) - hinge(a), 0.018],
          [side * (b - a), y(b) - y(a), hinge(b) - hinge(a), te(b) - hinge(a), 0.012],
        ],
        paint,
      );
      for (let x = a + 0.2; x < b; x += 0.28)
        dd.rod(
          [side * (x - a), y(x) - y(a) + 0.012, hinge(x) - hinge(a) - 0.025],
          [side * (x - a), y(x) - y(a) + 0.007, te(x) - hinge(a) + 0.02],
          0.0013,
          metal,
        );
      dd.finish();
      (kind === 'flap' ? flaps : ailerons).push({
        node: g.name,
        axis: 'x',
        multiplier: kind === 'flap' ? (-35.5 * Math.PI) / 180 : -side * 0.28,
      });
    }
    wing(
      d,
      [
        [side * 5.07, y(5.07), hinge(5.07), te(5.07), 0.015],
        [side * 5.49, y(5.49), hinge(5.49), te(5.49), 0.012],
      ],
      paint,
    );
    for (const x of [1.01, 2.15, 3.31]) {
      d.rod([side * x, y(x) - 0.04, hinge(x)], [side * x, y(x) - 0.14, te(x) + 0.05], 0.01, metal);
    }
    d.add(new T.CylinderGeometry(0.045, 0.045, 0.008, 16), metal, [
      side * 2.65,
      y(2.65) + 0.07,
      0.28,
    ]);
    d.box([0.22, 0.008, 0.6], [side * 0.8, y(0.8) + 0.058, -0.13], dark);
    const lamp = [side * 5.67, y(5.67), le(5.67) - 0.01];
    d.box([0.17, 0.04, 0.02], lamp, dark);
    for (const dx of [-0.05, 0, 0.05])
      d.add(new T.CircleGeometry(0.016, 12), d.ivory, [lamp[0] + dx, lamp[1], lamp[2] + 0.014]);
    ellipsoid(
      d,
      [side * 5.81, y(5.81), 0.32],
      [0.023, 0.024, 0.065],
      side > 0 ? d.red : d.green,
      10,
    );
    for (const x of [4.3, 4.8, 5.3])
      d.rod([side * x, y(x), te(x)], [side * x, y(x), te(x) - 0.13], 0.002, dark);
    const ty = 1.31,
      tl = (x) => -3.23 - x * 0.11,
      tt = (x) => -4.04 + x * 0.05;
    wing(
      d,
      [
        [0, ty, tl(0), -3.77, 0.055],
        [side * 1.82, ty, tl(1.82), -3.77, 0.025],
        [side * 1.965, ty, tl(1.965) - 0.08, tt(1.965) + 0.025, 0.007],
      ],
      paint,
    );
    const eg = group(root, `Cirrus-elevator-${side}`, [0, ty, -3.78]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.1, 0, 0, tt(0.1) + 3.78, 0.012],
        [side * 1.82, 0, 0, tt(1.82) + 3.78, 0.007],
      ],
      paint,
    );
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'elevator',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
    d.rod([side * 0.56, 0.74, -0.67], [side * 0.8, 0.38, -0.86], 0.017, metal);
    d.box([0.25, 0.025, 0.13], [side * 0.87, 0.38, -0.86], accent);
  }
  // Swept fin with a broad curved dorsal fairing, separate tapered rudder.
  const fin = [
    [-1.7, 1.77],
    [-2.7, 1.62],
    [-3.2, 1.63],
    [-3.52, 1.75],
    [-3.75, 2.04],
    [-4.05, 2.59],
    [-4.19, 2.71272],
    [-4.52, 2.71272],
    [-4.04, 1.22],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map(([z, y]) => [side * 0.031, y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-0.031, a[1], a[0]],
      [-0.031, b[1], b[0]],
      [0.031, b[1], b[0]],
      [0.031, a[1], a[0]],
      paint,
      [0, 1, 0],
    );
  }
  const rg = group(root, 'Cirrus-rudder', [0, 1.22, -4.04]),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.032, 0, 0],
        [side * 0.032, 1.49272, -0.48],
        [side * 0.032, 1.49272, -0.6448],
        [side * 0.032, 0.12, -0.36],
        [side * 0.032, 0, -0.22],
      ],
      accent,
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
  // CAPS cover, GPS, communication antenna, static ports and pitot; all original geometry.
  outline(
    d,
    [
      ...[-0.2, -0.1, 0, 0.1, 0.2].map((x) => [x, crownAt(-1.42, Math.abs(x)) + 0.004, -1.42]),
      ...[0.18, 0.09, 0, -0.09, -0.18].map((x) => [x, crownAt(-1.72, Math.abs(x)) + 0.004, -1.72]),
    ],
    0.0025,
    metal,
  );
  beveledBox(d, [0.13, 0.03, 0.19], [0, 2.06, -0.04], paint, 0.01);
  d.rod([0, 1.83, -1.45], [0, 2.03, -1.58], 0.007, paint);
  d.rod([1.56, 0.76, 0.6], [1.56, 0.43, 0.6], 0.009, metal);
  d.rod([1.56, 0.43, 0.6], [1.56, 0.43, 0.8], 0.009, metal);
  const engine = group(root, 'engine-1', [0, 1.2, 2.8]),
    prop = group(engine, 'Cirrus-propeller'),
    pd = detailKit(prop, prop.name);
  pd.add(new T.ConeGeometry(0.165, 0.44, 24).rotateX(Math.PI / 2), metal, [0, 0, 0.22]);
  for (let i = 0; i < 3; i++) {
    const g = group(prop, `Cirrus-prop-blade-${i}`);
    g.rotation.z = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const dd = detailKit(g, g.name),
      pts = [
        [0.13, -0.04, 0],
        [0.36, -0.08, 0.012],
        [0.74, -0.064, 0],
        [0.96, -0.018, -0.024],
        [0.9906, 0.025, -0.026],
        [0.92, 0.055, -0.014],
        [0.61, 0.09, 0.004],
        [0.15, 0.045, 0],
      ];
    sheet(dd, pts, dark, [0, 0, 1]);
    sheet(
      dd,
      pts.map((q) => [q[0], q[1], q[2] - 0.012]),
      dark,
      [0, 0, -1],
    );
    dd.box([0.04, 0.045, 0.016], [0.958, 0.018, -0.023], paint);
    dd.finish();
  }
  pd.finish();
  // Fixed spring struts and tapered wheel fairings leave the tires visible below.
  for (const [n, x, z, r] of [
    [0, 0, 2.12, 0.17],
    [1, 1.38684, 0, 0.19],
    [2, -1.38684, 0, 0.19],
  ]) {
    d.add(new T.CylinderGeometry(r, r, 0.115, 24).rotateZ(Math.PI / 2), rubber, [x, r, z]);
    for (const side of [-1, 1])
      d.add(new T.CircleGeometry(r * 0.53, 16).rotateY((side * Math.PI) / 2), metal, [
        x + side * 0.059,
        r,
        z,
      ]);
    const fair = [
      [z + 0.34, 0.018, r * 0.9, r * 1.15],
      [z + 0.26, 0.1, r * 0.62, r * 1.65],
      [z + 0.12, 0.145, r * 0.4, r * 2.0],
      [z - 0.1, 0.15, r * 0.4, r * 1.85],
      [z - 0.33, 0.085, r * 0.65, r * 1.45],
      [z - 0.53, 0.012, r * 0.9, r * 1.1],
    ].map(([zz, w, b, t]) => ({
      z: zz,
      points: Array.from({ length: 12 }, (_, i) => [
        x + w * Math.cos((i * Math.PI) / 6),
        (b + t) / 2 + ((t - b) / 2) * Math.sin((i * Math.PI) / 6),
      ]),
    }));
    loft(d, fair, paint);
    if (n) {
      sheet(
        d,
        [
          [Math.sign(x) * 0.64, 0.74, -0.03],
          [Math.sign(x) * 0.75, 0.74, -0.18],
          [x, 0.27, -0.14],
          [x, 0.27, 0.02],
        ],
        paint,
        [0, 0, 1],
      );
      sheet(
        d,
        [
          [Math.sign(x) * 0.64, 0.74, -0.065],
          [Math.sign(x) * 0.75, 0.74, -0.215],
          [x, 0.27, -0.175],
          [x, 0.27, -0.015],
        ],
        paint,
        [0, 0, -1],
      );
    } else {
      d.rod([0, 0.77, 1.57], [0, 0.32, 2.15], 0.032, metal);
      for (const side of [-1, 1])
        d.rod([side * 0.065, 0.34, 2.15], [side * 0.065, 0.17, 2.12], 0.017, metal);
    }
    outline(
      d,
      [
        [x - 0.14, r * 0.8, z + 0.17],
        [x - 0.15, r * 0.8, z - 0.12],
        [x - 0.025, r * 0.9, z - 0.53],
      ],
      0.002,
      metal,
      false,
    );
  }
  d.finish();
  const interior = cockpit(root, { paint, accent, metal, dark, halfWidth });
  cleanGeometry(root);
  return {
    root,
    frame: cirrusFrame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.2, 2.8] }],
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
    d = detailKit(cabin, 'Cirrus-cabin'),
    pt = panelTools(d),
    inst = instrumentGeometry(cabin, 'CirrusStandby'),
    { bindings, derived, ink, black, red } = inst;
  const face = mat('Cirrus-panel', '#353c3e'),
    leather = mat('Cirrus-upholstery', '#b5b3a8'),
    insert = mat('Cirrus-seat-inserts', '#535b5d');
  // Factory 2020 photograph: 180px active display width, 12-inch 4:3 diagonal.
  const k = 0.24384 / 180,
    px = (u) => (740 - u) * k,
    py = (v) => 1.65 - (v - 167) * k,
    z = 1.16,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [300, 205],
    [319, 124],
    [350, 76],
    [397, 56],
    [500, 42],
    [750, 40],
    [917, 51],
    [982, 75],
    [1015, 124],
    [1030, 244],
    [1015, 271],
    [399, 278],
    [344, 263],
  ];
  const centers = [
    [px(557), py(167)],
    [px(812), py(167)],
  ];
  sheet(
    d,
    edge.map((p) => at(...p)),
    face,
    [0, 0, -1],
    centers.map(([x, y]) => rect(x, y, 0.246, 0.185)),
  );
  sheet(
    d,
    edge.map((p) => at(...p, 0.065)),
    m.dark,
    [0, 0, 1],
  );
  const brow = edge.slice(0, 9).map((p) => at(...p, -0.006));
  outline(d, brow, 0.016, m.dark, false);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0] * 0.85, 1.5, 1.5], [a[0] * 0.85, 1.5, 1.5], m.dark, [0, 1, 0]);
  }
  for (const [n, [x, y]] of centers.entries()) {
    sheet(
      d,
      rect(x - 0.008, y, 0.326, 0.222, z - 0.006),
      black,
      [0, 0, -1],
      [rect(x, y, 0.24384, 0.18288, z - 0.006)],
    );
    for (let i = 0; i < 12; i++)
      d.box([0.009, 0.005, 0.004], [x + 0.11 - i * 0.019, y - 0.105, z - 0.013], m.accent);
    const column = n === 0 ? x - 0.143 : x + 0.145;
    for (const yy of [-0.084, -0.045, 0.003, 0.05, 0.088])
      pt.knob(column, y + yy, z - 0.015, 0.008);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 2; col++)
        d.box(
          [0.009, 0.005, 0.004],
          [column + col * 0.011 - 0.005, y - 0.057 - row * 0.01, z - 0.015],
          m.accent,
        );
    d.text('GARMIN', [x, y + 0.103, z - 0.012], 0.0045, Math.PI, ink);
  }
  // Scale the adaptable PFD geometry uniformly to a 12-inch display; physical bezels remain type-specific.
  const displays = group(cabin, 'Cirrus-displays', [0, 0, z]);
  displays.scale.setScalar(12 / 10.4);
  const dd = detailKit(displays, 'Cirrus-display-surfaces'),
    di = instrumentGeometry(displays, 'Cirrus'),
    q = 10.4 / 12;
  const sources = addG1000Readouts({
    cabin: displays,
    d: dd,
    instruments: di,
    prefix: 'Cirrus',
    pfd: centers[0].map((v) => v * q),
    mfd: centers[1].map((v) => v * q),
    z: 0,
    maxRpm: 2500,
    tapeMax: 240,
    mfdReadouts: false,
  });
  const [mx, my] = centers[1].map((v) => v * q);
  sheet(dd, rect(mx, my, 0.211328, 0.158496, 0.003), di.black, [0, 0, -1]);
  for (const [label, dy] of [
    ['POWER --', 0.06],
    ['RPM', 0.037],
    ['MAN --', 0.005],
    ['FF --', -0.015],
    ['OIL --', -0.035],
    ['FUEL --', -0.055],
  ])
    dd.text(label, [mx + 0.077, my + dy, -0.002], 0.0045, Math.PI, di.ink);
  di.readout('MFD-rpm', [mx + 0.075, my + 0.023, -0.003], 'rpmDisplay', 4, 0.0075, di.ink);
  dd.rod([mx + 0.045, my - 0.074, 0], [mx + 0.045, my + 0.074, 0], 0.0006, di.ink);
  dd.text('MAP DATA', [mx - 0.025, my + 0.01, 0], 0.009, Math.PI, di.ink, 'display');
  dd.text('UNAVAILABLE', [mx - 0.025, my - 0.006, 0], 0.007, Math.PI, di.ink, 'display');
  dd.finish();
  Object.assign(sources, { flapPosition: { component: 'aircraftState', path: ['flapPosition'] } });
  // Switch bolster and center keypad, AFCS and audio panel. All unsupported selections stay unlit.
  d.box([0.83, 0.04, 0.05], at(705, 278, 0.012), m.dark);
  for (let i = 0; i < 12; i++) {
    pt.knob(px(432 + i * 14), py(264), z - 0.025, 0.0045);
    d.rod(at(432 + i * 14, 264, -0.026), at(432 + i * 14, 258, -0.04), 0.0022, m.metal);
  }
  for (const [u, v] of [
    [406, 140],
    [969, 140],
    [632, 343],
    [848, 342],
  ])
    pt.vent(px(u), py(v), z - 0.02, 'round', v > 300 ? 0.068 : 0.049);
  pt.knob(px(390), py(222), z - 0.025, 0.012);
  d.text('IGNITION', at(391, 193, -0.02), 0.005, Math.PI, ink);
  for (const [u, v] of [
    [982, 203],
    [983, 241],
  ])
    pt.knob(px(u), py(v), z - 0.026, 0.018);
  d.text('CABIN AIR', at(980, 174, -0.024), 0.005, Math.PI, ink);
  const lowerEdge = [
    [342, 279],
    [640, 279],
    [665, 294],
    [812, 294],
    [839, 280],
    [1035, 279],
    [1035, 394],
    [820, 397],
    [816, 450],
    [671, 450],
    [666, 396],
    [359, 395],
  ];
  const md = [px(511), py(345)],
    hw = 0.074,
    hh = 0.041;
  sheet(
    d,
    lowerEdge.map((p) => at(...p, -0.03)),
    face,
    [0, 0, -1],
    [
      rect(md[0] + 0.034, md[1], 0.057, 0.043, z - 0.03),
      rect(md[0] - 0.04, md[1], 0.059, 0.043, z - 0.03),
    ],
  );
  // MD302 left attitude / right air-data windows, with real holes for the moving horizon.
  sheet(
    d,
    rect(md[0], md[1], hw * 2, hh * 2, z - 0.034),
    black,
    [0, 0, -1],
    [
      rect(md[0] + 0.034, md[1], 0.057, 0.043, z - 0.034),
      rect(md[0] - 0.04, md[1], 0.059, 0.043, z - 0.034),
    ],
  );
  inst.horizon('MD302-horizon', [md[0] + 0.034, md[1], z - 0.025], 0.057, 0.043);
  d.box([0.059, 0.043, 0.003], [md[0] - 0.04, md[1], z - 0.028], black);
  inst.readout(
    'MD302-speed',
    [md[0] - 0.027, md[1] + 0.008, z - 0.036],
    'knots',
    3,
    0.008,
    ink,
    false,
    true,
  );
  inst.readout(
    'MD302-altitude',
    [md[0] - 0.04, md[1] - 0.009, z - 0.036],
    'feet',
    5,
    0.006,
    ink,
    true,
    true,
  );
  d.text('TAS GEO', [md[0] - 0.04, md[1] + 0.019, z - 0.037], 0.0035, Math.PI, ink);
  pt.knob(md[0] + 0.005, md[1] - 0.028, z - 0.043, 0.006);
  const pedestal = group(cabin, 'Cirrus-console', [0, 1.15, 1.27]),
    cd = detailKit(pedestal, pedestal.name);
  beveledBox(cd, [0.19, 0.44, 0.16], [0, 0.18, 0], m.dark, 0.018);
  cd.finish();
  for (const [u, v, w, h] of [
    [740, 337, 141, 126],
    [741, 425, 141, 53],
    [741, 473, 141, 31],
  ]) {
    beveledBox(d, [w * k, h * k, 0.016], at(u, v, -0.04), black, 0.005);
  }
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 10; col++) {
      const u = 691 + col * 11.7,
        v = 352 + row * 16;
      d.box([0.011, 0.01, 0.006], at(u, v, -0.052), m.accent);
      d.text(
        ['QWERTYUIOP', 'ASDFGHJKL ', 'ZXCVBNM   '][row][col],
        at(u, v, -0.056),
        0.005,
        Math.PI,
        ink,
      );
    }
  for (const [u, v] of [
    [694, 288],
    [740, 288],
    [793, 288],
    [692, 415],
    [793, 415],
  ])
    pt.knob(px(u), py(v), z - 0.06, 0.009);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 6; col++)
      d.box([0.013, 0.008, 0.004], at(710 + col * 15, 285 + row * 15, -0.056), m.accent);
  d.box([0.017, 0.012, 0.006], at(743, 419, -0.058), mat('Cirrus-level-button', '#398dba'));
  d.text('LVL', at(743, 419, -0.062), 0.004, Math.PI, ink);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 6; col++)
      d.box([0.012, 0.006, 0.004], at(702 + col * 15, 465 + row * 12, -0.055), m.accent);
  d.text('FMS / AFCS INOP', at(742, 398, -0.057), 0.004, Math.PI, ink);
  // Live flap annunciators are based on measured travel, with a dark interval between detents.
  const consoleFace = group(cabin, 'Cirrus-inclined-console', [0, 1.1, 0.87]),
    consoleDetail = detailKit(consoleFace, consoleFace.name);
  consoleFace.rotation.x = 1.2;
  beveledBox(consoleDetail, [0.21, 0.56, 0.02], [0, 0, 0], face, 0.008);
  for (const side of [-1, 1])
    quad(
      d,
      [side * 0.105, 0.85, 0.61],
      [side * 0.105, 0.85, 1.14],
      [side * 0.105, 1.2, 1.14],
      [side * 0.105, 1, 0.61],
      face,
      [side, 0, 0],
    );
  const flap = group(consoleFace, 'Cirrus-flap-selector', [-0.03, 0.08, -0.02]),
    fd = detailKit(flap, flap.name);
  fd.rod([0, 0, 0], [0, 0, -0.035], 0.004, m.metal);
  beveledBox(fd, [0.04, 0.014, 0.025], [0, 0, -0.04], leather, 0.004);
  fd.finish();
  bindings.push({
    node: flap.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'y',
    scale: -0.07,
  });
  for (const [i, label, target] of [
    [0, 'UP', 0],
    [1, '50', 0.5],
    [2, '100', 1],
  ]) {
    const delta = `flap${i}Delta`,
      abs = `flap${i}Absolute`,
      on = `flap${i}On`;
    derived[delta] = { op: 'subtract', args: ['flapPosition', target] };
    derived[abs] = { op: 'abs', args: [delta] };
    derived[on] = { op: 'less', args: [abs, 0.012] };
    const pos = [-0.07, 0.105 - i * 0.035, -0.012],
      lamp = group(consoleFace, `Cirrus-flap-lamp-${i}`, pos),
      ld = detailKit(lamp, lamp.name);
    ld.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), i ? inst.amber : d.green);
    ld.finish();
    bindings.push({ node: lamp.name, source: on, property: 'visible', scale: 1, missing: 'hide' });
    consoleDetail.text(label, [pos[0] + 0.045, pos[1], pos[2] - 0.003], 0.006, Math.PI, ink);
  }
  consoleDetail.finish();
  beveledBox(d, [0.21, 0.24, 0.9], [0, 0.87, 0.43], face, 0.03);
  beveledBox(d, [0.19, 0.07, 0.34], [0, 1.01, 0.06], leather, 0.025);
  for (const [x, label, col] of [
    [0.045, 'power', black],
    [-0.045, 'mixture', red],
  ]) {
    const g = group(cabin, `Cirrus-${label}`, [x, 1, 0.56]),
      ld = detailKit(g, g.name);
    ld.rod([0, 0, 0], [0, 0.095, 0.02], 0.007, m.metal);
    ellipsoid(ld, [0, 0.095, 0.02], [0.022, 0.026, 0.018], col, 12);
    ld.finish();
    if (label === 'power')
      bindings.push({
        node: g.name,
        source: 'power',
        property: 'rotation',
        axis: 'x',
        offset: -0.35,
        scale: 0.7,
      });
  }
  d.ring(0.032, 0.004, [0, 1.005, 0.27], m.metal, 'y');
  d.rod([0, 1.014, 0.27], [0.026, 1.014, 0.28], 0.007, red);
  for (const side of [-1, 1]) {
    // A Cirrus side yoke translates for pitch and rotates about its shaft for roll.
    const g = group(cabin, `Cirrus-side-yoke-${side}`, [side * 0.56, 1.32, 0.86]),
      yd = detailKit(g, g.name);
    yd.rod([0, 0, 0.13], [0, 0, -0.05], 0.025, m.metal);
    yd.rod([0, 0, -0.06], [-side * 0.055, 0.11, -0.11], 0.027, m.dark);
    ellipsoid(yd, [-side * 0.055, 0.13, -0.11], [0.046, 0.023, 0.045], m.dark, 12);
    yd.box([0.018, 0.01, 0.017], [-side * 0.04, 0.151, -0.1], red);
    yd.box([0.012, 0.013, 0.02], [-side * 0.071, 0.153, -0.12], m.accent);
    yd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.06 },
    );
    for (const j of [-1, 1]) {
      const pg = group(cabin, `Cirrus-pedal-${side}-${j}`, [side * 0.3 + j * 0.085, 0.82, 1.23]),
        pd = detailKit(pg, pg.name);
      beveledBox(pd, [0.135, 0.11, 0.035], [0, 0, 0], m.metal, 0.007);
      for (let n = 0; n < 4; n++)
        pd.box([0.095, 0.006, 0.005], [0, -0.035 + n * 0.023, -0.02], m.dark);
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.04,
      });
    }
    beveledBox(d, [0.035, 0.3, 1.4], [side * 0.61, 1.04, 0.13], leather, 0.01);
    d.rod([side * 0.585, 1.16, -0.13], [side * 0.585, 1.16, 0.5], 0.025, m.dark);
    d.box([0.02, 0.03, 0.14], [side * 0.578, 1.11, 0.27], m.metal);
    d.box([0.24, 0.015, 0.23], [side * 0.3, 1.95, 0.54], m.dark);
    d.rod([side * 0.4, 1.96, 0.56], [side * 0.41, 2.01, 0.56], 0.006, m.metal);
  }
  d.box([1.2, 0.035, 2.28], [0, 0.72, 0.06], m.dark);
  // Five-seat cabin: two deeply bolstered front seats and a rear 60/40 bench with center belt.
  for (const [n, x, zz, w] of [
    [0, 0.31, 0.28, 0.48],
    [1, -0.31, 0.28, 0.48],
    [2, 0.345, -0.73, 0.4],
    [3, 0, -0.73, 0.29],
    [4, -0.345, -0.73, 0.4],
  ]) {
    const sg = group(cabin, `Cirrus-seat-${n}`, [x, 0.95, zz]),
      sd = detailKit(sg, sg.name);
    beveledBox(sd, [w, 0.13, 0.49], [0, 0, 0], leather, 0.04);
    beveledBox(sd, [w * 0.72, 0.025, 0.38], [0, 0.075, 0.015], insert, 0.015);
    const back = beveledBox(sd, [w, 0.56, 0.12], [0, 0.32, -0.2], leather, 0.04);
    back.rotation.x = -0.12;
    beveledBox(sd, [w * 0.65, 0.41, 0.025], [0, 0.34, -0.129], insert, 0.025);
    if (n !== 3) beveledBox(sd, [w * 0.64, 0.18, 0.11], [0, 0.69, -0.25], leather, 0.03);
    sd.rod([-w * 0.36, 0.09, -0.12], [w * 0.34, 0.09, 0.13], 0.012, m.dark);
    sd.box([0.034, 0.014, 0.025], [0.02, 0.105, 0], m.metal);
    if (n !== 3) sd.rod([-w * 0.35, 0.61, -0.13], [w * 0.29, 0.1, -0.09], 0.014, m.dark);
    sd.finish();
  }
  d.box([0.98, 0.03, 0.55], [0, 0.83, -1.45], m.accent);
  sheet(
    d,
    [0.84, 1.64].flatMap((y, n) => {
      const x = m.halfWidth(-1.74, y) - 0.015;
      return n
        ? [
            [x, y, -1.74],
            [-x, y, -1.74],
          ]
        : [
            [-x, y, -1.74],
            [x, y, -1.74],
          ];
    }),
    leather,
    [0, 0, 1],
  );
  beveledBox(d, [0.15, 0.025, 0.2], [0, 2.015, 0.41], leather, 0.012);
  d.box([0.075, 0.015, 0.06], [0, 1.997, 0.41], red);
  d.text('CAPS', [0, 1.98, 0.35], 0.009, Math.PI, ink);
  inst.headingDrum('compass', [0, 1.96, 0.65], 0.021, 'trueHeading');
  d.rod([0, 1.98, 0.68], [0, 2.025, 0.65], 0.008, m.metal);
  d.finish();
  return {
    nodes: ['cockpit'],
    sources,
    derived: { ...di.derived, ...derived },
    bindings: [...di.bindings, ...bindings],
  };
}
