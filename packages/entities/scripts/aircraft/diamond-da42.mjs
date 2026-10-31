/** DA42-VI, 2024 interior with G1000 NXi and MD302. Main axle datum, +Z nose.
 * Dimensions from 7.01.16-E rev5 and the 2024 factory cabin drawing/photo.
 * Composite skin: joints/access fasteners, not a fictitious sheet-metal rivet grid.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { addG1000Bezels, addG1000Readouts } from './g1000-panel.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  ellipsoid,
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

export const diamondFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.6,
  cy: 1.22,
  ry: 0.73,
  cabinZ: 0.35,
  cabinWidth: 1.06,
  eye: [0.28, 1.8, 0.35],
  panelZ: 1.18,
  floor: 0.76,
});
export function buildDiamond(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('DA42-white', '#e6e8e4', { side: T.DoubleSide }),
    accent = mat('DA42-blue', '#28577b', { side: T.DoubleSide }),
    metal = mat('DA42-alloy', '#a5afb1', { metalness: 0.7 }),
    dark = mat('DA42-trim', '#242d32'),
    rubber = mat('DA42-tire', '#1c2326'),
    glass = mat('DA42-canopy', '#aac5cd', {
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'DA42-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Independent side and plan landmarks; the nose has no central engine cowling.
  // [z, half width, belly, crown, belt, shoulder, shoulder half width]: the bubble canopy and
  // the cabin behind it lean in above the widest (belt) line under a round crown.
  const stations = [
    [3.28, 0.012, 1.03, 1.07],
    [2.94, 0.25, 0.94, 1.19],
    [2.3, 0.45, 0.82, 1.33],
    [1.7, 0.545, 0.72, 1.44, 1.12, 1.33, 0.5],
    [1.1, 0.565, 0.67, 1.77, 1.2, 1.6, 0.53],
    [0.42, 0.595, 0.64, 1.95, 1.22, 1.74, 0.53],
    [-0.15, 0.6, 0.65, 1.94, 1.24, 1.74, 0.53],
    [-0.95, 0.55, 0.7, 1.88, 1.24, 1.66, 0.49],
    [-1.65, 0.41, 0.77, 1.58, 1.2, 1.47, 0.35],
    [-2.65, 0.21, 0.9, 1.32],
    [-3.7, 0.1, 1, 1.22],
    [-4.5, 0.065, 1.0, 1.25],
    [-5.28, 0.015, 0.99, 1.08],
  ];
  // Points: 0 crown, 1-3 roof arc, 4 shoulder, 5 belt, 6-8 lower side, 9 keel, then mirrored.
  const rings = stations.map(
    ([z, w, b, t, belt = b + (t - b) * 0.5, shoulder = b + (t - b) * 0.8, ws = w * 0.74]) => {
      const c = Math.min(0.17, (t - b) * 0.32),
        right = [
          ...[1, 2, 3].map((k) => [
            ws * Math.pow(Math.sin((k * Math.PI) / 8), 2 / 2.8),
            shoulder + (t - shoulder) * Math.pow(Math.cos((k * Math.PI) / 8), 2 / 2.8),
          ]),
          [ws, shoulder],
          [w, belt],
          [w, b + c],
          [w * 0.75, b],
          [w * 0.35, b - 0.015],
        ];
      return {
        z,
        points: [[0, t], ...right, [0, b - 0.025], ...right.reverse().map(([x, y]) => [-x, y])],
      };
    },
  );
  const p = (i, j) => [...rings[i].points[j], rings[i].z],
    topFaces = [14, 15, 16, 17, 0, 1, 2, 3];
  loft(d, rings, paint, {
    skip: (i, j) =>
      i < 3 ||
      (i >= 3 && i <= 5 && topFaces.includes(j)) ||
      (i >= 3 && i <= 7 && [4, 13].includes(j)),
  });
  // Rounded composite nose: 36-point sections blend from the cabin section at the canopy
  // front frame (shared exactly with ring 3) towards an ellipse at the tip.
  const noseRings = [1, 0.85, 0.6, 0].map((k, i) => {
    const [z, w, b, t] = stations[i],
      c = (t + b) / 2,
      h = (t - b) / 2;
    return {
      z,
      points: rings[i].points
        .flatMap((q, j, a) => {
          const n = a[(j + 1) % a.length];
          return [q, [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]];
        })
        .map(([x, y]) => {
          const a = Math.atan2((y - c) / h, x / w);
          return [x * (1 - k) + w * Math.cos(a) * k, y * (1 - k) + (c + h * Math.sin(a)) * k];
        }),
    };
  });
  loft(d, noseRings, paint, { caps: false });
  for (let i = 3; i <= 5; i++)
    for (const j of topFaces)
      quad(d, p(i, j), p(i + 1, j), p(i + 1, (j + 1) % 18), p(i, (j + 1) % 18), glass, [0, 1, 1]);
  // Skin half-width at a station and height (the rounded nose, then the cabin and boom
  // sections), so windows, doors and trim follow the curved side.
  const skinX = (z, y) => {
    const set = z > stations[3][0] ? noseRings : rings.slice(3);
    let i = set.findIndex((r, n) => n < set.length - 1 && z <= r.z && z >= set[n + 1].z);
    if (i < 0) i = z > set[0].z ? 0 : set.length - 2;
    const a = set[i],
      b = set[i + 1],
      f = (a.z - z) / (a.z - b.z),
      ring = a.points.map((q, n) => [
        q[0] * (1 - f) + b.points[n][0] * f,
        q[1] * (1 - f) + b.points[n][1] * f,
      ]);
    for (let n = 0; n < ring.length / 2; n++) {
      const [x0, y0] = ring[n],
        [x1, y1] = ring[n + 1];
      if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return Math.max(...ring.map((q) => q[0]));
  };
  for (const side of [-1, 1]) {
    const j = side > 0 ? 4 : 13,
      point = (z, y) => [side * (skinX(z, y) + (z > stations[3][0] ? 0.006 : 0)), y, z];
    // Front canopy side panes join the curved transparent crown; no opaque backing.
    for (let i = 3; i <= 5; i++) {
      const upper = side > 0 ? 4 : 14,
        lower = side > 0 ? 5 : 13;
      const a = p(i, upper),
        b = p(i + 1, upper),
        c = p(i + 1, lower),
        e = p(i, lower),
        bottom = 1.25;
      // The glazing stops at the sill line on the leaning side, part way down to the belt.
      const sill = (u, l) => {
        const f = (u[1] - Math.min(u[1] - 0.005, bottom)) / (u[1] - l[1]);
        return u.map((v, k) => v + (l[k] - v) * f);
      };
      const aa = sill(a, e),
        bb = sill(b, c);
      quad(d, a, b, bb, aa, glass, [side, 0, 0]);
      quad(d, aa, bb, c, e, paint, [side, 0, 0]);
      outline(d, [aa, bb], 0.012, paint, false);
    }
    const edge = [p(6, j), p(7, j), p(8, j), p(8, j + 1), p(7, j + 1), p(6, j + 1)],
      hole = [
        [-0.25, 1.68],
        [-0.4, 1.69],
        [-0.87, 1.59],
        [-1.25, 1.43],
        [-1.28, 1.38],
        [-0.88, 1.31],
        [-0.29, 1.29],
        [-0.25, 1.34],
      ].map((q) => point(...q));
    sheet(d, edge, paint, [side, 0, 0], [hole]);
    sheet(d, hole, glass, [side, 0, 0]);
    outline(d, hole, 0.007, dark);
    const rail = side > 0 ? 4 : 14;
    outline(d, [p(3, rail), p(4, rail), p(5, rail), p(6, rail)], 0.008, paint, false);
    // Rear passenger door on port side; opposite side has fixed glazing.
    if (side > 0) {
      outline(
        d,
        [
          [-0.18, 1.91],
          [-0.22, 1.18],
          [-1.25, 1.14],
          [-1.52, 1.45],
          [-1.05, 1.75],
        ].map((q) => point(...q)),
        0.0022,
        metal,
      );
      d.box([0.022, 0.025, 0.1], point(-0.35, 1.2), dark);
    }
    const bag = [
      [2.9, 1.04],
      [2.83, 1.22],
      [1.97, 1.36],
      [1.93, 1.07],
      [2.0, 1.01],
    ].map((q) => point(...q));
    outline(d, bag, 0.002, metal);
    d.box([0.014, 0.024, 0.065], point(2.03, 1.12), dark);
    for (let i = 1; i < stations.length - 2; i++) {
      const a = stations[i],
        b = stations[i + 1],
        ya = a[2] + 0.16,
        yb = b[2] + 0.16,
        // Flat stripe quads stand clear of the curved (ruled, triangulated) nose skin.
        sx = (z, y) => side * (skinX(z, y) + (z > stations[3][0] + 0.01 ? 0.014 : 0.002));
      quad(
        d,
        [sx(a[0], ya), ya, a[0]],
        [sx(b[0], yb), yb, b[0]],
        [sx(b[0], yb + 0.034), yb + 0.034, b[0]],
        [sx(a[0], ya + 0.034), ya + 0.034, a[0]],
        accent,
        [side, 0, 0],
      );
    }
    // Walkways and the five-degree wing dihedral. Split flaps at the nacelles.
    const y = (x) => 0.93 + Math.max(0, x - 0.55) * Math.tan((5 * Math.PI) / 180),
      le = (x) => (x < 1.7 ? 1.0 - (x - 0.55) * 0.23 : 0.735 - (x - 1.7) * 0.018),
      te = (x) => (x < 1.7 ? -0.79 + (x - 0.55) * 0.27 : -0.479 + (x - 1.7) * 0.017),
      hinge = (x) => te(x) + (le(x) - te(x)) * 0.22;
    wing(
      d,
      [
        [side * 0.5, y(0.5), le(0.5), hinge(0.5), 0.11],
        [side * 1.7, y(1.7), le(1.7), hinge(1.7), 0.09],
        [side * 6.45, y(6.45), le(6.45), hinge(6.45), 0.06],
        [side * 6.71, y(6.71), le(6.71) - 0.07, te(6.71) + 0.12, 0.03],
      ],
      paint,
    );
    for (const [name, a, b] of [
      ['flap-inner', 0.57, 1.43],
      ['flap-outer', 1.88, 4.9],
      ['aileron', 4.94, 6.43],
    ]) {
      const g = group(root, `DA42-${name}-${side}`, [side * a, y(a), hinge(a)]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(a) - hinge(a), 0.016],
          [side * (b - a), y(b) - y(a), hinge(b) - hinge(a), te(b) - hinge(a), 0.012],
        ],
        paint,
      );
      for (let x = a + 0.12; x < b; x += name === 'aileron' ? 0.45 : 0.48)
        dd.box([0.025, 0.025, 0.065], [side * (x - a), -0.018, hinge(x) - hinge(a) - 0.015], metal);
      dd.finish();
      (name === 'aileron' ? ailerons : flaps).push({
        node: g.name,
        axis: 'x',
        multiplier: name === 'aileron' ? -side * 0.3 : (-42 * Math.PI) / 180,
      });
    }
    // Narrow, swept, nearly vertical winglets follow the plan and frontal drawing.
    for (const dx of [-0.012, 0.012])
      sheet(
        d,
        [
          [side * (6.55 + dx), y(6.55), 0.57],
          [side * (6.71 + dx), y(6.71), -0.31],
          [side * (6.71 + dx), 2.205, -0.8],
          [side * (6.66 + dx), 2.2, -0.55],
        ],
        paint,
        [side, 0, 0],
      );
    ellipsoid(d, [side * 6.758, 1.53, -0.1], [0.017, 0.027, 0.055], side > 0 ? d.red : d.green, 12);
    d.box([0.18, 0.014, 0.87], [side * 0.77, 1.047, 0.22], dark);
    d.add(new T.CylinderGeometry(0.035, 0.035, 0.009, 16), metal, [
      side * 2.2,
      y(2.2) + 0.067,
      0.38,
    ]);
    d.rod([side * 2.48, y(2.48) - 0.02, 0.48], [side * 2.48, y(2.48) - 0.24, 0.53], 0.007, metal);
    if (side > 0)
      d.rod([side * 2.48, y(2.48) - 0.24, 0.53], [side * 2.48, y(2.48) - 0.24, 0.72], 0.006, metal);
    // T-tail: independently measured 3.2m span, 2.35m2 area.
    const tl = (x) => -4.23 - Math.abs(x) * 0.22,
      tt = (x) => -5.24 + Math.abs(x) * 0.07;
    wing(
      d,
      [
        [0, 2.44, tl(0), -4.99, 0.05],
        [side * 1.5, 2.44, tl(1.5), -4.99, 0.025],
        [side * 1.6, 2.44, tl(1.6) - 0.03, tt(1.6) + 0.025, 0.018],
      ],
      paint,
    );
    const eg = group(root, `DA42-elevator-${side}`, [0, 2.44, -5.0]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.1, 0, 0, tt(0.1) + 5, 0.013],
        [side * 1.5, 0, 0, tt(1.5) + 5, 0.008],
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
  }
  // Roll bar and rear canopy frame are full-width structural parts.
  for (const i of [3, 6])
    outline(
      d,
      [14, 15, 16, 17, 0, 1, 2, 3, 4].map((j) => p(i, j)),
      i === 6 ? 0.025 : 0.012,
      paint,
      false,
    );
  const fin = [
    [-2.8, 1.33],
    [-3.83, 1.42],
    [-4.05, 1.55],
    [-4.42, 2.43],
    [-4.98, 2.44],
    [-4.7, 1.03],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map(([z, y]) => [side * 0.038, y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-0.038, a[1], a[0]],
      [-0.038, b[1], b[0]],
      [0.038, b[1], b[0]],
      [0.038, a[1], a[0]],
      paint,
      [0, 1, 0],
    );
  }
  const rg = group(root, 'DA42-rudder', [0, 1.02, -4.71]),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1]) {
    sheet(
      rd,
      [
        [side * 0.039, 0, 0],
        [side * 0.039, 1.41, -0.28],
        [side * 0.039, 1.38, -0.57],
        [side * 0.039, -0.01, -0.57],
      ],
      accent,
      [side, 0, 0],
    );
    rd.rod([side * 0.041, 0.24, -0.48], [side * 0.041, 0.65, -0.48], 0.003, metal);
  }
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.38,
  });
  d.rod([0, 1.67, -1.47], [0, 2.04, -1.75], 0.007, paint);
  d.rod([0, 1.43, -2.2], [0, 1.73, -2.48], 0.006, paint);
  ellipsoid(d, [0, 2.48, -4.73], [0.025, 0.01, 0.04], d.ivory, 10);
  const enginePoints = [],
    rotors = [];
  for (const [index, side] of [
    [1, 1],
    [2, -1],
  ]) {
    const x = side * 1.68,
      cy = 1.18,
      z = 1.64,
      ng = group(root, `DA42-nacelle-${index}`, [x, cy, 0]),
      nd = detailKit(ng, ng.name);
    // AE300 cowl: bulky, deep and blunt. The gearbox puts the spinner high in a broad face that
    // drops about 0.52 m below the propeller axis to a wide chin cooling inlet (D-GOMH close-up;
    // VH-VMX near-profile scaled by the 1.9 m propeller); full width just behind the spinner.
    // Superelliptic sections [z, half width, bottom, top].
    const nc = [
      [1.63, 0.27, -0.49, 0.17],
      [1.57, 0.335, -0.52, 0.245],
      [1.45, 0.375, -0.53, 0.285],
      [1.2, 0.4, -0.52, 0.3],
      [0.9, 0.395, -0.49, 0.28],
      [0.5, 0.36, -0.42, 0.24],
      [0.1, 0.32, -0.28, 0.2],
      [-0.7, 0.27, -0.11, 0.12],
      [-1.03, 0.22, -0.02, 0.06],
    ].map(([zz, w, b, t]) => ({
      z: zz,
      w,
      b,
      t,
      points: Array.from({ length: 20 }, (_, i) => {
        const c = Math.cos((i * Math.PI) / 10),
          s = Math.sin((i * Math.PI) / 10);
        return [
          w * Math.sign(c) * Math.pow(Math.abs(c), 0.8),
          (t + b) / 2 + ((t - b) / 2) * Math.sign(s) * Math.pow(Math.abs(s), 0.8),
        ];
      }),
    }));
    loft(nd, nc, paint);
    // Cowl half width at a station and height (same superellipse as the sections).
    const nx = (zz, yy) => {
      const n = nc.findIndex((r) => r.z < zz),
        i = n < 0 ? nc.length - 2 : Math.max(0, n - 1),
        f = (nc[i].z - zz) / (nc[i].z - nc[i + 1].z),
        [w, b, t] = ['w', 'b', 't'].map((k) => nc[i][k] + (nc[i + 1][k] - nc[i][k]) * f),
        v = Math.min(1, Math.abs((yy - (t + b) / 2) / ((t - b) / 2)));
      return w * Math.pow(1 - Math.pow(v, 2.5), 0.4);
    };
    for (const r of [nc[2], nc[6]])
      outline(
        nd,
        r.points.map((p) => [...p, r.z]),
        0.002,
        metal,
      );
    for (const sign of [-1, 1]) {
      // Large recessed louvred side intakes high behind the spinner.
      const at = (zz, yy, out = 0.004) => [sign * (nx(zz, yy) + out), yy, zz];
      const gill = [at(1.47, -0.08), at(1.45, 0.21), at(1.1, 0.23), at(1.12, -0.05)];
      sheet(nd, gill, dark, [sign, 0, 0]);
      outline(nd, gill, 0.013, paint);
      for (const yy of [-0.02, 0.05, 0.12, 0.18])
        nd.rod(at(1.45, yy, 0.012), at(1.13, yy + 0.03, 0.012), 0.009, metal);
      for (let zz = 0.2; zz < 1.1; zz += 0.13)
        nd.add(new T.SphereGeometry(0.003, 6, 4), metal, at(zz, -0.08, 0.001));
      nd.rod([sign * 0.25, -0.23, 0.17], [sign * 0.29, -0.4, 0.06], 0.024, metal);
    }
    // Wide chin cooling inlet: a short scoop with a polished lip and a dark throat.
    const scoop = (zz, grow) =>
      Array.from({ length: 16 }, (_, i) => [
        (0.18 + grow) * Math.cos((i * Math.PI) / 8),
        -0.385 + (0.075 + grow) * Math.sin((i * Math.PI) / 8),
        zz,
      ]);
    loft(
      nd,
      [1.6, 1.67].map((zz) => ({ z: zz, points: scoop(zz, 0).map(([a, b]) => [a, b]) })),
      paint,
      { caps: false },
    );
    sheet(nd, scoop(1.645, 0), dark, [0, 0, 1]);
    outline(nd, scoop(1.67, 0.004), 0.018, metal);
    nd.box([0.21, 0.016, 0.22], [0, -0.39, 0.8], paint);
    nd.finish();
    const eg = group(root, `engine-${index}`, [x, cy, z]),
      prop = group(eg, `DA42-propeller-${index}`),
      pd = detailKit(prop, prop.name);
    // Long spinner with a slight ogive, 0.37 m diameter, painted so liveries can colour it.
    pd.add(
      new T.LatheGeometry(
        [
          [0.185, 0],
          [0.18, 0.06],
          [0.163, 0.15],
          [0.13, 0.25],
          [0.087, 0.34],
          [0.042, 0.42],
          [0, 0.48],
        ].map(([r, h]) => new T.Vector2(r, h)),
        24,
      ).rotateX(Math.PI / 2),
      paint,
    );
    for (let n = 0; n < 3; n++) {
      const g = group(prop, `DA42-prop-${index}-${n}`);
      g.rotation.z = (n * 2 * Math.PI) / 3 + Math.PI / 2;
      const dd = detailKit(g, g.name),
        pts = [
          [0.12, -0.04, 0],
          [0.38, -0.07, 0.012],
          [0.84, -0.055, 0],
          [0.943, -0.02, -0.015],
          [0.95, 0.015, -0.018],
          [0.86, 0.055, -0.007],
          [0.47, 0.075, 0.01],
          [0.14, 0.04, 0],
        ];
      sheet(dd, pts, dark, [0, 0, 1]);
      sheet(
        dd,
        pts.map((p) => [p[0], p[1], p[2] - 0.012]),
        dark,
        [0, 0, -1],
      );
      dd.box([0.035, 0.06, 0.015], [0.915, 0.008, -0.012], paint);
      dd.finish();
    }
    pd.finish();
    enginePoints.push({ id: eg.name, position: [x, cy, z] });
    rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: eg.name });
  }
  // 2.95m track, 1.735m wheelbase. Main legs fold inboard; nose leg folds forward.
  for (const [index, x, z, top, r] of [
    [0, 0, 1.735, 0.79, 0.18],
    [1, 1.475, 0, 0.98, 0.1905],
    [2, -1.475, 0, 0.98, 0.1905],
  ]) {
    const g = group(root, `DA42-gear-${index}`, [x, top, z]),
      dd = detailKit(g, g.name),
      h = top - r;
    dd.rod([0, 0, 0], [0, -h + 0.12, 0], 0.027, metal);
    dd.rod([0, -h + 0.16, 0], [0, -h, 0], 0.021, metal);
    dd.add(new T.CylinderGeometry(r, r, 0.12, 24).rotateZ(Math.PI / 2), rubber, [0, -h, 0]);
    for (const side of [-1, 1])
      dd.add(new T.CircleGeometry(r * 0.54, 16).rotateY((side * Math.PI) / 2), metal, [
        side * 0.062,
        -h,
        0,
      ]);
    if (index) {
      const sign = Math.sign(x);
      dd.rod([-sign * 0.25, -0.04, -0.15], [0, -h + 0.12, 0], 0.018, metal);
      sheet(
        dd,
        [
          [sign * 0.08, -0.03, 0.22],
          [sign * 0.08, -0.03, -0.21],
          [sign * 0.08, -h + 0.03, -0.17],
          [sign * 0.08, -h + 0.03, 0.17],
        ],
        paint,
        [sign, 0, 0],
      );
    } else {
      for (const side of [-1, 1])
        dd.rod([side * 0.07, -h + 0.18, -0.04], [side * 0.07, -h, 0], 0.016, metal);
      dd.box([0.17, 0.36, 0.015], [0, -0.25, -0.07], paint);
    }
    dd.finish();
    const angle = index ? (-Math.sign(x) * Math.PI) / 2 : -Math.PI / 2;
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: index ? 'z' : 'x',
      offset: angle,
      scale: -angle,
    });
  }
  d.finish();
  const interior = cockpit(root, { paint, accent, metal, dark, skinX, rings });
  cleanGeometry(root);
  return {
    root,
    frame: diamondFrame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps, ailerons, animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'DA42-cabin'),
    pt = panelTools(d),
    inst = instrumentGeometry(cabin, 'DA42'),
    { bindings, derived, ink, black, red } = inst;
  const face = mat('DA42-panel', '#363d42'),
    leather = mat('DA42-leather', '#656a69'),
    headliner = mat('DA42-headliner', '#c3c6bf');
  // Manufacturer 1023px NXi photograph; 164px = 10.4-inch 4:3 active display width.
  const k = 0.211328 / 164,
    px = (u) => (500 - u) * k,
    py = (v) => 1.42 - (v - 327) * k,
    z = 1.18,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [116, 440],
    [116, 310],
    [134, 246],
    [176, 207],
    [235, 186],
    [348, 167],
    [500, 158],
    [669, 169],
    [776, 188],
    [836, 222],
    [869, 283],
    [878, 446],
  ];
  const centers = [
      [px(329), py(327)],
      [px(591), py(327)],
    ],
    md = [px(497), py(212)];
  const holes = centers.map(([x, y]) => rect(x, y, 0.213, 0.16));
  holes.push(rect(md[0] + 0.034, md[1], 0.056, 0.041), rect(md[0] - 0.034, md[1], 0.056, 0.041));
  sheet(
    d,
    edge.map((p) => at(...p)),
    face,
    [0, 0, -1],
    holes,
  );
  sheet(
    d,
    edge.map((p) => at(...p, 0.08)),
    m.dark,
    [0, 0, 1],
  );
  const brow = edge.slice(0, -1).map((p) => at(...p, -0.004));
  d.add(
    new T.TubeGeometry(
      new T.CatmullRomCurve3(brow.map((p) => new T.Vector3(...p))),
      96,
      0.023,
      8,
      false,
    ),
    m.dark,
  );
  for (let i = 1; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0] * 0.8, 1.45, 1.55], [a[0] * 0.8, 1.45, 1.55], m.dark, [0, 1, 0]);
  }
  addG1000Bezels(d, centers, z, black, m.accent);
  const sources = addG1000Readouts({
    cabin,
    d,
    instruments: inst,
    prefix: 'DA42',
    pfd: centers[0],
    mfd: centers[1],
    z: z - 0.009,
    maxRpm: 2300,
    tapeMax: 200,
    mfdReadouts: false,
  });
  Object.assign(sources, {
    propNormalized2: { component: 'aircraftState', path: ['engines', 'engine-2', 'rpm'] },
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  });
  Object.assign(derived, {
    propRpm2: { op: 'multiply', args: ['propNormalized2', 2300] },
    rpmTens2: { op: 'divide', args: ['propRpm2', 10] },
    rpmRound2: { op: 'add', args: ['rpmTens2', 0.5] },
    rpmWhole2: { op: 'floor', args: ['rpmRound2'] },
    rpmDisplay2: { op: 'multiply', args: ['rpmWhole2', 10] },
  });
  // DA42 EIS uses vertical twin sliders, not the Baron/King Air circular tachometer.
  const [mx, my] = centers[1],
    cx = mx + 0.079;
  sheet(d, rect(mx, my, 0.211328, 0.158496, z - 0.003), black, [0, 0, -1]);
  for (const [label, base, high] of [
    ['LOAD %', my + 0.048, 100],
    ['RPM', my + 0.015, 3000],
  ]) {
    const height = 0.024;
    for (const side of [-1, 1]) {
      d.rod(
        [cx + side * 0.012, base - height / 2, z - 0.013],
        [cx + side * 0.012, base + height / 2, z - 0.013],
        0.0009,
        d.green,
      );
      for (let t = 0; t <= 5; t++)
        d.rod(
          [cx + side * 0.012, base - height / 2 + (t * height) / 5, z - 0.014],
          [cx + side * 0.009, base - height / 2 + (t * height) / 5, z - 0.014],
          0.0005,
          ink,
        );
    }
    for (let t = 1; t <= 5; t++)
      d.text(
        String((t * high) / 5),
        [cx, base - height / 2 + (t * height) / 5, z - 0.015],
        0.0028,
        Math.PI,
        ink,
      );
    d.text(label, [cx, base - height / 2 - 0.004, z - 0.015], 0.0035, Math.PI, ink);
    if (label === 'RPM')
      for (const [index, side, source, display] of [
        [1, 1, 'propRpm', 'rpmDisplay'],
        [2, -1, 'propRpm2', 'rpmDisplay2'],
      ]) {
        const g = group(cabin, `DA42-RPM-slider-${index}`, [
            cx + side * 0.017,
            base - height / 2,
            z - 0.016,
          ]),
          dd = detailKit(g, g.name);
        sheet(
          dd,
          [
            [0, 0, 0],
            [-side * 0.004, 0.002, 0],
            [0, 0.003, 0],
          ],
          ink,
          [0, 0, -1],
        );
        dd.finish();
        bindings.push({
          node: g.name,
          source,
          property: 'position',
          axis: 'y',
          scale: height / 3000,
          min: 0,
          max: height,
          responseSeconds: 0.1,
        });
        inst.available(`RPM-slider-${index}`, source, g.name);
        inst.readout(
          `MFD-rpm-${index}`,
          [cx + side * 0.013, base - height / 2 - 0.009, z - 0.017],
          display,
          4,
          0.0038,
        );
        d.rod(
          [cx + side * 0.012, base - height / 2 + (height * 2300) / 3000, z - 0.015],
          [cx + side * 0.012, base + height / 2, z - 0.015],
          0.0011,
          red,
        );
      }
    else {
      d.rod(
        [cx - 0.015, base - 0.01, z - 0.016],
        [cx + 0.015, base + 0.01, z - 0.016],
        0.0008,
        red,
      );
      d.rod(
        [cx + 0.015, base - 0.01, z - 0.016],
        [cx - 0.015, base + 0.01, z - 0.016],
        0.0008,
        red,
      );
    }
  }
  for (const [i, label] of [
    'FUEL FLOW',
    'OIL TEMP',
    'OIL PRES',
    'COOLANT',
    'FUEL TEMP',
    'FUEL QTY',
  ].entries())
    d.text(`${label} --`, [cx, my - 0.019 - i * 0.009, z - 0.015], 0.0034, Math.PI, ink);
  d.rod([mx + 0.045, my - 0.075, z - 0.015], [mx + 0.045, my + 0.075, z - 0.015], 0.0006, ink);
  d.text('MAP DATA', [mx - 0.022, my + 0.005, z - 0.015], 0.008, Math.PI, ink, 'display');
  d.text('UNAVAILABLE', [mx - 0.022, my - 0.009, z - 0.015], 0.006, Math.PI, ink, 'display');
  // Optional MD302 above the radios; independent attitude and air-data apertures.
  sheet(
    d,
    rect(md[0], md[1], 0.14, 0.067, z - 0.006),
    black,
    [0, 0, -1],
    [
      rect(md[0] + 0.034, md[1], 0.056, 0.041, z - 0.006),
      rect(md[0] - 0.034, md[1], 0.056, 0.041, z - 0.006),
    ],
  );
  inst.horizon('MD302-horizon', [md[0] + 0.034, md[1], z + 0.006], 0.056, 0.041);
  d.box([0.056, 0.041, 0.002], [md[0] - 0.034, md[1], z], black);
  inst.readout(
    'MD302-speed',
    [md[0] - 0.025, md[1] + 0.008, z - 0.01],
    'knots',
    3,
    0.007,
    ink,
    false,
    true,
  );
  inst.readout(
    'MD302-altitude',
    [md[0] - 0.034, md[1] - 0.009, z - 0.01],
    'feet',
    5,
    0.0055,
    ink,
    true,
    true,
  );
  d.text('TAS GEO', [md[0] - 0.034, md[1] + 0.019, z - 0.012], 0.003, Math.PI, ink);
  pt.knob(md[0], md[1] - 0.025, z - 0.016, 0.005);
  for (const [u, v] of [
    [176, 330],
    [827, 330],
  ])
    pt.vent(px(u), py(v), z - 0.022, 'round', 0.069);
  inst.headingDrum('compass', at(636, 218, -0.018), 0.025, 'trueHeading');
  pt.gauge(px(765), py(223), z - 0.015, 0.021, black, false);
  d.text('O2 INOP', at(765, 247, -0.018), 0.004, Math.PI, ink);
  // Lights, ECU/voter controls, engine masters and circuit breakers in the photographed banks.
  for (const u of [248, 275]) pt.knob(px(u), py(227), z - 0.023, 0.009);
  for (const u of [304, 320, 335, 350])
    beveledBox(d, [0.011, 0.026, 0.008], at(u, 228, -0.012), headliner, 0.002);
  beveledBox(d, [0.026, 0.045, 0.012], at(375, 225, -0.016), red, 0.004);
  d.text('EMERGENCY', at(375, 246, -0.023), 0.0037, Math.PI, ink);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 4; j++) {
      const u = 152 + j * 18,
        v = 370 + i * 17;
      pt.knob(px(u), py(v), z - 0.019, 0.0035);
      d.rod(at(u, v, -0.021), at(u, v - 4, -0.033), 0.0018, m.metal);
    }
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 8; col++) {
      if (row < 2 && col > 3) continue;
      pt.knob(px(725 + col * 17), py(305 + row * 23), z - 0.019, 0.004);
    }
  for (let col = 0; col < 8; col++) pt.knob(px(725 + col * 17), py(430), z - 0.019, 0.004);
  beveledBox(d, [0.042, 0.086, 0.008], at(737, 306, -0.009), black, 0.003);
  for (const u of [728, 747]) pt.knob(px(u), py(295), z - 0.02, 0.005);
  d.box([0.012, 0.028, 0.009], at(745, 321, -0.017), red);
  beveledBox(d, [0.028, 0.04, 0.008], at(719, 226, -0.012), black, 0.003);
  d.box([0.008, 0.022, 0.008], at(719, 227, -0.017), red);
  const ax = px(461);
  beveledBox(d, [0.026, 0.195, 0.012], [ax, py(327), z - 0.01], black, 0.003);
  for (let row = 0; row < 12; row++)
    for (const dx of [-0.007, 0.007])
      d.box([0.008, 0.004, 0.004], [ax + dx, py(274 + row * 10), z - 0.018], m.accent);
  for (const [u, v, col] of [
    [235, 427, headliner],
    [362, 430, red],
    [382, 430, headliner],
    [527, 430, headliner],
    [544, 430, headliner],
  ])
    beveledBox(d, [0.016, 0.028, 0.008], at(u, v, -0.016), col, 0.002);
  for (const u of [261, 295, 335, 510, 563, 578])
    pt.knob(px(u), py(428), z - 0.022, u === 295 ? 0.01 : 0.006);
  for (const [text, u, v] of [
    ['LIGHTS', 328, 206],
    ['ENGINE MASTER', 297, 413],
    ['GEAR', 418, 414],
    ['FUEL PUMPS', 536, 414],
    ['FLAPS', 641, 413],
    ['ECU / VOTER', 181, 356],
    ['CB', 782, 413],
  ])
    d.text(text, at(u, v, -0.023), 0.004, Math.PI, ink);
  // Three gear lamps follow measured travel, and the red lamp indicates transit only.
  Object.assign(derived, {
    gearDown: { op: 'greater', args: ['gear', 0.995] },
    gearAboveUp: { op: 'greater', args: ['gear', 0.005] },
    gearBelowDown: { op: 'less', args: ['gear', 0.995] },
    gearTransit: { op: 'and', args: ['gearAboveUp', 'gearBelowDown'] },
  });
  for (const [n, u, v] of [
    [0, 415, 434],
    [1, 405, 444],
    [2, 429, 444],
  ]) {
    const g = group(cabin, `DA42-gear-lamp-${n}`, at(u, v, -0.026)),
      dd = detailKit(g, g.name);
    dd.add(new T.CircleGeometry(0.0035, 10).rotateY(Math.PI), d.green);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  const warn = group(cabin, 'DA42-gear-transit', at(417, 425, -0.026)),
    wd = detailKit(warn, warn.name);
  wd.add(new T.CircleGeometry(0.0035, 10).rotateY(Math.PI), red);
  wd.finish();
  bindings.push({
    node: warn.name,
    source: 'gearTransit',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  const gear = group(cabin, 'DA42-gear-selector', at(453, 430, -0.023)),
    gd = detailKit(gear, gear.name);
  gd.rod([0, 0, 0], [0, 0, -0.025], 0.004, m.metal);
  gd.add(
    new T.CylinderGeometry(0.01, 0.01, 0.01, 16).rotateZ(Math.PI / 2),
    headliner,
    [0, 0, -0.03],
  );
  gd.finish();
  bindings.push({
    node: gear.name,
    source: 'gear',
    property: 'position',
    axis: 'y',
    scale: -0.024,
  });
  // Adjacent lights illuminate during transit as described by AFM 7-6.
  derived.flapUpOn = { op: 'less', args: ['flapPosition', 20 / 42 - 0.001] };
  derived.flapAppLow = { op: 'greater', args: ['flapPosition', 0.001] };
  derived.flapAppHigh = { op: 'less', args: ['flapPosition', 0.999] };
  derived.flapAppOn = { op: 'and', args: ['flapAppLow', 'flapAppHigh'] };
  derived.flapLdgOn = { op: 'greater', args: ['flapPosition', 20 / 42 + 0.001] };
  for (const [i, label, source] of [
    [0, 'UP', 'flapUpOn'],
    [1, 'APP', 'flapAppOn'],
    [2, 'LDG', 'flapLdgOn'],
  ]) {
    const pos = at(633, 427 + i * 8, -0.025),
      g = group(cabin, `DA42-flap-lamp-${i}`, pos),
      dd = detailKit(g, g.name);
    dd.add(new T.CircleGeometry(0.0026, 10).rotateY(Math.PI), i ? ink : d.green);
    dd.finish();
    bindings.push({ node: g.name, source, property: 'visible', scale: 1, missing: 'hide' });
    d.text(label, at(620, 427 + i * 8, -0.026), 0.0035, Math.PI, ink);
  }
  const flap = group(cabin, 'DA42-flap-selector', at(653, 427, -0.024)),
    fd = detailKit(flap, flap.name);
  fd.rod([0, 0, 0], [0, 0, -0.025], 0.003, m.metal);
  beveledBox(fd, [0.023, 0.01, 0.022], [0, 0, -0.03], headliner, 0.003);
  fd.finish();
  bindings.push({
    node: flap.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'y',
    scale: -16 * k,
  });
  // Two power levers only: no fictional propeller or mixture levers in an AE300 cockpit.
  beveledBox(d, [0.17, 0.22, 0.98], [0, 0.88, 0.31], face, 0.025);
  const upright = group(cabin, 'DA42-lower-console', [0, 1.12, 1.13]),
    ud = detailKit(upright, upright.name);
  upright.rotation.x = 0.14;
  beveledBox(ud, [0.083, 0.23, 0.03], [0, 0, 0], face, 0.008);
  ud.ring(0.022, 0.004, [0, 0.065, -0.02], m.metal);
  for (const x of [-0.024, 0.024]) {
    ud.box([0.003, 0.08, 0.005], [x, -0.045, -0.02], black);
    ud.box([0.011, 0.009, 0.015], [x, -0.067, -0.027], m.metal);
  }
  ud.finish();
  for (const side of [-1, 1]) {
    const g = group(cabin, `DA42-power-${side}`, [side * 0.035, 1.0, 0.43]),
      ld = detailKit(g, g.name);
    ld.rod([0, 0, 0], [0, 0.085, 0], 0.006, m.metal);
    beveledBox(ld, [0.065, 0.03, 0.034], [0, 0.09, 0], m.dark, 0.008);
    ld.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      offset: -0.35,
      scale: 0.7,
    });
    d.box([0.003, 0.006, 0.29], [side * 0.035, 1.001, 0.43], black);
  }
  d.add(
    new T.CylinderGeometry(0.046, 0.046, 0.026, 24).rotateZ(Math.PI / 2),
    black,
    [0, 1.0, 0.16],
  );
  for (const x of [-0.05, 0.05]) {
    d.ring(0.023, 0.003, [x, 1.002, -0.08], m.metal, 'y');
    d.rod([x, 1.008, -0.1], [x, 1.008, -0.055], 0.006, red);
  }
  for (const side of [-1, 1]) {
    const g = group(cabin, `DA42-stick-${side}`, [side * 0.28, 0.99, 0.5]),
      sd = detailKit(g, g.name);
    sd.add(new T.ConeGeometry(0.045, 0.12, 12), m.dark, [0, 0.06, 0]);
    sd.rod([0, 0.1, 0], [0, 0.32, 0.025], 0.022, m.dark);
    beveledBox(sd, [0.068, 0.095, 0.075], [0, 0.34, 0.02], m.dark, 0.016);
    sd.box([0.018, 0.009, 0.017], [-0.017, 0.394, 0.01], red);
    sd.box([0.018, 0.01, 0.025], [0.014, 0.394, 0.015], m.accent);
    sd.finish();
    bindings.push(
      { node: g.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.26 },
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.3 },
    );
    for (const j of [-1, 1]) {
      const g = group(cabin, `DA42-pedal-${side}-${j}`, [side * 0.27 + j * 0.08, 0.84, 1.21]),
        pd = detailKit(g, g.name);
      beveledBox(pd, [0.12, 0.105, 0.03], [0, 0, 0], m.metal, 0.006);
      for (let i = 0; i < 4; i++)
        pd.box([0.09, 0.006, 0.005], [0, -0.035 + i * 0.023, -0.018], m.dark);
      pd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.04,
      });
    }
    beveledBox(d, [0.025, 0.25, 1.5], [side * 0.54, 1.06, -0.1], leather, 0.008);
    d.rod([side * 0.51, 1.15, 0.46], [side * 0.51, 1.15, -0.1], 0.024, m.dark);
    d.box([0.019, 0.03, 0.11], [side * 0.51, 1.09, 0.23], red);
    d.box([0.21, 0.014, 0.2], [side * 0.25, 1.89, 0.48], m.dark);
    d.rod([side * 0.38, 1.895, 0.44], [side * 0.3, 1.9, 0.44], 0.005, m.metal);
  }
  d.box([1.02, 0.027, 2.38], [0, 0.76, 0.1], m.dark);
  // The firewall and molded side panels close the footwells below the dashboard.
  beveledBox(d, [0.98, 0.46, 0.035], [0, 1.0, 1.36], face, 0.012);
  for (const side of [-1, 1])
    sheet(
      d,
      [
        [side * 0.49, 0.78, 1.34],
        [side * 0.49, 1.27, 1.34],
        [side * 0.545, 1.24, 0.45],
        [side * 0.545, 1.23, -0.97],
        [side * 0.515, 0.78, -0.97],
      ],
      leather,
      [-side, 0, 0],
    );
  for (const [n, x, zz] of [
    [0, 0.28, 0.24],
    [1, -0.28, 0.24],
    [2, 0.29, -0.71],
    [3, -0.29, -0.71],
  ]) {
    const sg = group(cabin, `DA42-seat-${n}`, [x, 0.96, zz]),
      sd = detailKit(sg, sg.name);
    beveledBox(sd, [0.44, 0.1, 0.48], [0, 0, 0], leather, 0.036);
    beveledBox(sd, [0.31, 0.02, 0.36], [0, 0.06, 0.02], m.dark, 0.017);
    const shape = new T.Shape();
    const contour = [
      [-0.18, 0.02],
      [-0.21, 0.13],
      [-0.19, 0.42],
      [-0.12, 0.54],
      [0.12, 0.54],
      [0.19, 0.42],
      [0.21, 0.13],
      [0.18, 0.02],
    ];
    contour.forEach(([x, y], i) => {
      if (i) shape.lineTo(x, y);
      else shape.moveTo(x, y);
    });
    shape.closePath();
    const back = sd.add(
      new T.ExtrudeGeometry(shape, {
        depth: 0.07,
        steps: 1,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.022,
        bevelSegments: 2,
        curveSegments: 1,
      }),
      leather,
      [0, 0, -0.25],
    );
    back.rotation.x = -0.13;
    beveledBox(sd, [0.28, 0.35, 0.025], [0, 0.28, -0.16], m.dark, 0.022);
    beveledBox(sd, [0.28, 0.17, 0.11], [0, 0.6, -0.24], leather, 0.03);
    sd.rod([-0.16, 0.55, -0.12], [0.14, 0.07, -0.05], 0.013, m.dark);
    sd.rod([-0.17, 0.07, -0.1], [0.16, 0.07, 0.14], 0.011, m.dark);
    sd.box([0.034, 0.014, 0.025], [0, 0.085, 0], m.metal);
    sd.finish();
  }
  // Baggage floor trimmed to the tapering aft cabin so it stays inside the skin.
  fittedFloor(d, m.rings, leather, {
    y: 0.8525,
    front: -1.115,
    back: -1.765,
    width: 0.94,
    thickness: 0.025,
  });
  sheet(
    d,
    [0.85, 0.85, 1.45, 1.45].map((y, n) => {
      const x = Math.min(n < 2 ? 0.42 : 0.35, m.skinX(-1.76, y) - 0.015);
      return [n % 3 ? x : -x, y, -1.76];
    }),
    headliner,
    [0, 0, 1],
  );
  for (let i = -3; i <= 3; i++)
    d.rod([i * 0.12, 0.87, -1.13], [i * 0.1, 1.25, -1.65], 0.003, m.dark);
  for (let j = 0; j < 5; j++)
    d.rod(
      [-0.35, 0.87 + j * 0.08, -1.13 - j * 0.11],
      [0.35, 0.87 + j * 0.08, -1.13 - j * 0.11],
      0.003,
      m.dark,
    );
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
