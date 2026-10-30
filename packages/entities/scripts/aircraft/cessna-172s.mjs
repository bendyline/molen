/** Cessna 172S NAV III / GFC700, 2007 handbook panel. +Z forward; main axle origin.
 * Independent dimensions govern span, length, wheelbase, propeller and display size.
 * The published three-view is schematic: see reference-review.json for residuals.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { finishCockpit } from './cockpit-surfaces.mjs';
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

export const cessna172Frame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.55,
  cy: 1.15,
  ry: 0.72,
  cabinZ: 0.3,
  cabinWidth: 1.02,
  eye: [0.25, 1.62, 0.3],
  panelZ: 1.1,
  floor: 0.61,
});

export function buildCessna172(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Skyhawk-white', '#e7e8e2', { side: T.DoubleSide }),
    blue = mat('Skyhawk-navy', '#254961', { side: T.DoubleSide });
  const metal = mat('Skyhawk-alloy', '#a4aaa9', { metalness: 0.65 }),
    dark = mat('Skyhawk-trim', '#2b3135'),
    rubber = mat('Skyhawk-tire', '#222729');
  const glass = mat('Skyhawk-glazing', '#b1ccd4', {
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: T.DoubleSide,
    roughness: 0.16,
  });
  const d = detailKit(root, 'Skyhawk-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // [z, half width, belly, crown, belt, shoulder, shoulder half width, belly corner radius]:
  // rounded boxes, not chamfered octagons. A flat crown rolls into the side glass, which leans
  // in slightly above the belt (widest); slab lower sides turn under on a radiused belly
  // corner. The cowl is a round-cornered bowl and the tail cone an egg (172S photographs).
  const sections = [
    // Cowl top falls from the windscreen base to a rounded nose bowl; the spinner sits high
    // on the bowl (VH-FWC side profile), not centred on a tall flat face.
    [2.275, 0.37, 0.88, 1.41, 1.2, 1.33, 0.34, 0.2],
    [2.14, 0.46, 0.71, 1.44, 1.15, 1.35, 0.42, 0.28],
    [1.28, 0.52, 0.55, 1.49, 1.2, 1.36, 0.52, 0.24],
    // Cabin roof sits in the wing root: door glazing 1.25-1.62 m, root underside about 1.7 m
    // (VH-FWC photograph and the 172R profile agree once scaled by overall length).
    [0.63, 0.53, 0.53, 1.82, 1.2, 1.69, 0.51],
    [0.36, 0.55, 0.51, 1.86, 1.19, 1.73, 0.52],
    [-0.33, 0.55, 0.5, 1.81, 1.1, 1.68, 0.52],
    [-0.96, 0.49, 0.51, 1.62, 1, 1.49, 0.465],
    [-1.51, 0.39, 0.52, 1.3, 0.9, 1.17, 0.37],
    [-3.87, 0.15, 0.62, 1.27, 0.95, 1.17, 0.12, 0.1],
    [-4.45, 0.105, 0.66, 1.26, 0.96, 1.17, 0.085, 0.07],
    [-5.1, 0.065, 0.76, 1.08, 0.92, 1.02, 0.05, 0.045],
  ];
  // Points: 0 crown, 1-2 roof roll, 3 shoulder, 4 belt, 5-8 belly corner, 9 belly, 10 keel,
  // then mirrored (16 belt, 17 shoulder on the right side).
  const rings = sections.map(([z, w, b, t, belt, shoulder, ws, rc = 0.13], i) => {
    // Roof roll: round on the nose bowl and tail cone, tighter where the cabin meets the wing.
    const n = z < -3 || i < 2 ? 2.7 : 3.6;
    const right = [
      ...[1, 2].map((k) => [
        ws * Math.pow(Math.sin((k * Math.PI) / 6), 2 / n),
        shoulder + (t - shoulder) * Math.pow(Math.cos((k * Math.PI) / 6), 2 / n),
      ]),
      [ws, shoulder],
      [w, belt],
      ...[0, 35, 65, 90].map((deg) => [
        w - rc + rc * Math.cos((deg * Math.PI) / 180),
        b + rc - rc * Math.sin((deg * Math.PI) / 180),
      ]),
      [(w - rc) * 0.5, b - 0.008],
    ];
    return {
      z,
      points: [[0, t], ...right, [0, b - 0.015], ...right.reverse().map(([x, y]) => [-x, y])],
    };
  });
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  const roof = [17, 18, 19, 0, 1, 2];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 2 && roof.includes(j)) ||
      ([2, 3, 4, 5, 6].includes(i) && [3, 16].includes(j)) ||
      (i === 6 && roof.includes(j)),
  });
  for (const j of roof) {
    quad(d, p(2, j), p(3, j), p(3, (j + 1) % 20), p(2, (j + 1) % 20), glass, [0, 1, 1]);
    quad(d, p(6, j), p(7, j), p(7, (j + 1) % 20), p(6, (j + 1) % 20), glass, [0, 1, -1]);
  }
  outline(
    d,
    [
      p(2, 17),
      ...[...roof, 3].map((j) => p(3, j)),
      ...[...roof.slice(1), 3].reverse().map((j) => p(2, j)),
    ],
    0.012,
    paint,
  );
  // One-piece windscreen, no invented center mullion. Aft Omni-Vision glazing has a center rib.
  d.rod(p(6, 0), p(7, 0), 0.012, paint);
  // Skin half width at a station and height: glazing, doors and trim follow the curved side.
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
    return q[4][0];
  };
  // Window heights keep the measured layout: fractions of the side from 0.13 m below the crown
  // (v = 0) to 0.17 m above the belly (v = 1).
  const glazingY = (i, v) => {
    const [, , b, t] = sections[i];
    return t - 0.13 + (b + 0.3 - t) * v;
  };
  // Round each pane corner with a quadratic fillet of radius r in the side's (z, y) plane.
  const fillet = (points, r) =>
    points.flatMap((c, i) => {
      const toward = (q) => {
        const l = Math.hypot(q[0] - c[0], q[1] - c[1]),
          k = Math.min(r, l * 0.4) / l;
        return [c[0] + (q[0] - c[0]) * k, c[1] + (q[1] - c[1]) * k];
      };
      const a = toward(points[(i + points.length - 1) % points.length]),
        b = toward(points[(i + 1) % points.length]);
      return [a, [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4], b];
    });
  for (const side of [-1, 1]) {
    const j = side > 0 ? 3 : 16,
      skin = (z, y, out = 0) => [side * (halfWidth(z, y) + out), y, z];
    // Trim polylines given as [z, y], subdivided so they lie on the curved skin.
    const trace = (points) =>
      points.flatMap(([z, y], i) => {
        const [z2, y2] = points[(i + 1) % points.length];
        return [0, 1, 2, 3, 4, 5].map((k) =>
          skin(z + ((z2 - z) * k) / 6, y + ((y2 - y) * k) / 6, 0.003),
        );
      });
    // The door window runs forward under the windscreen post to the cowl line.
    for (const [start, end, upper, lower, shape] of [
      [
        2,
        3,
        0.07,
        0.45,
        [
          [0.12, 0.06],
          [0.985, 0.05],
          [0.985, 0.45],
          [0.3, 0.21],
        ],
      ],
      [3, 5, 0.05, 0.45],
      [5, 6, 0.11, 0.53],
      [6, 7, 0.05, 0.45],
    ]) {
      const [za] = sections[start],
        [zb] = sections[end];
      const q = (u, v) => [za + (zb - za) * u, glazingY(start, v) * (1 - u) + glazingY(end, v) * u];
      const h = fillet(
        (
          shape ?? [
            [start === 3 ? 0.015 : 0.06, upper],
            [0.94, upper],
            [0.88, lower],
            [start === 3 ? 0.015 : 0.06, lower],
          ]
        ).map(([u, v]) => q(u, v)),
        0.05,
      ).map(([z, y]) => skin(z, y));
      const edge = [];
      for (let i = start; i <= end; i++) edge.push(p(i, j));
      for (let i = end; i >= start; i--) edge.push(p(i, j + 1));
      sheet(d, edge, paint, [side, 0, 0], [h]);
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.008, dark);
    }
    outline(
      d,
      trace([
        [0.64, 1.68],
        [-0.3, 1.67],
        [-0.3, 0.71],
        [1.05, 0.72],
        [1.13, 1.4],
      ]),
      0.003,
      metal,
    );
    d.box([0.018, 0.027, 0.14], skin(-0.13, 1.23, 0.007), metal);
    for (const z of [0.34, -0.04]) d.box([0.022, 0.055, 0.03], skin(z, 1.6, 0.006), metal);
    // Skin seams and rivets follow the cowl joints, cabin belt and tapering rear frames.
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i],
        b = sections[i + 1],
        yy = (q) => q[2] + 0.25,
        steps = Math.ceil(Math.abs(b[0] - a[0]) / 0.15),
        at = (k, dy) => {
          const t = k / steps;
          return skin(a[0] + (b[0] - a[0]) * t, yy(a) + (yy(b) - yy(a)) * t + dy, 0.002);
        };
      for (let k = 0; k < steps; k++)
        quad(d, at(k, 0), at(k + 1, 0), at(k + 1, 0.07), at(k, 0.07), blue, [side, 0, 0]);
      for (let t = 0; t < 1; t += 0.13 / Math.abs(b[0] - a[0]))
        d.add(
          new T.SphereGeometry(0.0027, 5, 3),
          metal,
          skin(a[0] + (b[0] - a[0]) * t, yy(a) + (yy(b) - yy(a)) * t - 0.03, 0.003),
        );
    }
    for (const i of [1, 2, 8, 9])
      outline(
        d,
        rings[i].points.map((v) => [...v, rings[i].z]),
        0.0017,
        metal,
      );
    if (side > 0)
      outline(
        d,
        trace([
          [-1.02, 1.18],
          [-1.48, 1.18],
          [-1.48, 0.61],
          [-1.02, 0.61],
        ]),
        0.003,
        metal,
      );
    const y = (x) => 1.77 + Math.max(0, Math.abs(x) - 0.55) * 0.0262;
    const le = (x) => 0.62 - Math.max(0, Math.abs(x) - 2.55) * 0.045;
    const te = (x) => -1.0 + Math.max(0, Math.abs(x) - 2.55) * 0.13;
    const hinge = (x) => te(x) + (Math.abs(x) < 2.56 ? 0.37 : 0.26);
    wing(
      d,
      [
        [side * 0.48, y(0.48), le(0.48), hinge(0.48), 0.12],
        [side * 2.55, y(2.55), le(2.55), hinge(2.55), 0.11],
        [side * 2.57, y(2.57), le(2.57), hinge(2.57), 0.11],
        [side * 5.3, y(5.3), le(5.3), hinge(5.3), 0.075],
        [side * 5.48, y(5.48), le(5.48) - 0.035, te(5.48) + 0.04, 0.055],
      ],
      paint,
    );
    for (const [kind, begin, end] of [
      ['flap', 0.57, 2.55],
      ['aileron', 2.57, 5.3],
    ]) {
      const g = group(root, `Skyhawk-${kind}-${side}`, [side * begin, y(begin), hinge(begin)]),
        dd = detailKit(g, `${kind}-${side}`);
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
      for (let x = begin + 0.07; x < end; x += 0.085) {
        const a = [side * (x - begin), y(x) - y(begin) + 0.008, hinge(x) - hinge(begin) - 0.025],
          b = [a[0], a[1], te(x) - hinge(begin) + 0.018];
        dd.rod(a, b, 0.0022, metal);
      }
      dd.finish();
      (kind === 'flap' ? flaps : ailerons).push({
        node: g.name,
        axis: 'x',
        multiplier: kind === 'flap' ? -Math.PI / 6 : -side * 0.28,
      });
    }
    for (let x = 0.83; x < 5.15; x += 0.36) {
      const h = x < 2.57 ? 0.12 - (x - 0.48) * 0.0048 : 0.11 - (x - 2.57) * 0.0128;
      const upper = (u) =>
        u < 0.25
          ? (h * u) / 0.25
          : u < 0.75
            ? h * (1 - (u - 0.25) * 0.96)
            : (h * 0.52 * (1 - u)) / 0.25;
      for (let u = 0.12; u < 0.94; u += 0.1)
        d.add(new T.SphereGeometry(0.0023, 5, 3), metal, [
          side * x,
          y(x) + upper(u) + 0.002,
          le(x) - u * (le(x) - hinge(x)),
        ]);
    }
    d.add(new T.CylinderGeometry(0.037, 0.037, 0.008, 16), metal, [
      side * 1.1,
      y(1.1) + 0.117,
      0.27,
    ]);
    // Broad airfoil strut, not a circular pipe; front attachment precedes the doors.
    // Struts lean aft about 20 degrees in side view (fuselage fitting ahead of the spar fitting).
    const a = new T.Vector3(side * 0.5, 0.66, 0.76),
      b = new T.Vector3(side * 3.04, y(3.04) - 0.02, 0.46),
      v = b.clone().sub(a);
    const strut = d.box(
      [0.06, v.length(), 0.17],
      a.clone().addScaledVector(v, 0.5).toArray(),
      paint,
    );
    strut.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    ellipsoid(d, a.toArray(), [0.065, 0.055, 0.18], paint, 12);
    d.add(new T.SphereGeometry(0.028, 10, 6), side > 0 ? d.red : d.green, [
      side * 5.48,
      y(5.48),
      0.25,
    ]);
    d.box([0.19, 0.035, 0.035], [side * 2.77, y(2.77) - 0.015, le(2.77) + 0.007], dark);
    d.box([0.15, 0.026, 0.008], [side * 2.77, y(2.77) - 0.012, le(2.77) + 0.028], d.ivory);
    d.rod([side * 0.65, 0.56, 0.08], [side * 0.76, 0.34, 0.09], 0.014, metal);
    d.box([0.24, 0.024, 0.16], [side * 0.8, 0.34, 0.09], dark);
  }
  // Fixed horizontal stabilizer and separate, corrugated elevators.
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [0, 0.89, -3.8, -4.45, 0.05],
        [side * 1.63, 0.89, -4.08, -4.45, 0.03],
        [side * 1.7272, 0.89, -4.15, -4.6, 0.025],
      ],
      paint,
    );
    const g = group(root, `Skyhawk-elevator-${side}`, [0, 0.89, -4.46]),
      dd = detailKit(g, g.name);
    wing(
      dd,
      [
        [side * 0.13, 0, 0, -0.4, 0.018],
        [side * 1.63, 0, 0, -0.22, 0.015],
      ],
      paint,
    );
    for (let x = 0.22; x < 1.61; x += 0.08)
      dd.rod([side * x, 0.01, -0.02], [side * x, 0.009, -0.38 + x * 0.11], 0.002, metal);
    dd.rod([side * 0.4, 0.016, -0.3], [side * 1.1, 0.016, -0.22], 0.002, dark);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'elevator',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
  }
  const fin = [
    [-3.62, 1.28],
    [-3.91, 1.44],
    [-4.93, 2.35],
    [-5.07, 2.38],
    [-5.36, 2.3],
    [-4.72, 0.91],
    [-4.4, 0.91],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map(([z, y]) => [side * 0.033, y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const [az, ay] = fin[i],
      [bz, by] = fin[(i + 1) % fin.length];
    quad(d, [-0.033, ay, az], [-0.033, by, bz], [0.033, by, bz], [0.033, ay, az], paint, [0, 1, 0]);
  }
  const rudder = group(root, 'Skyhawk-rudder', [0, 0.91, -4.72]),
    rd = detailKit(rudder, 'rudder');
  const rc = [
    [0, 0],
    [-0.64, 1.39],
    [-0.886, 1.33],
    [-0.45, -0.12],
    [-0.13, -0.17],
  ];
  for (const side of [-1, 1]) {
    sheet(
      rd,
      rc.map(([z, y]) => [side * 0.034, y, z]),
      paint,
      [side, 0, 0],
    );
    for (let t = 0.04; t < 1; t += 0.055)
      rd.add(new T.SphereGeometry(0.003, 5, 3), metal, [side * 0.036, t * 1.39, -0.64 * t - 0.025]);
    sheet(
      d,
      [
        [side * 0.036, 1.07, -4.2],
        [side * 0.036, 1.22, -4.35],
        [side * 0.036, 1.28, -4.83],
        [side * 0.036, 1.16, -4.77],
      ],
      blue,
      [side, 0, 0],
    );
  }
  rd.finish();
  bindings.push({
    node: rudder.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  d.add(new T.CylinderGeometry(0.028, 0.029, 0.07, 12), d.red, [0, 2.397, -5.02]);
  for (const side of [-1, 1])
    d.rod([side * 0.02, 2.27, -5.14], [side * 0.35, 2.28, -4.83], 0.005, metal);
  d.rod([0, 1.83, -0.3], [0, 2.13, -0.63], 0.007, paint);
  d.rod([0, 1.28, -1.77], [0, 1.54, -1.92], 0.006, paint);
  // Open induction/cooling mouths: upright rounded inlets with rolled lips either side of the
  // spinner, a filter mouth in the chin; full spinner, 76-inch fixed-pitch propeller.
  for (const side of [-1, 1]) {
    d.add(new T.CircleGeometry(0.072, 20).scale(0.8, 1.15, 1), dark, [side * 0.235, 1.235, 2.279]);
    d.add(new T.TorusGeometry(0.075, 0.016, 5, 20).scale(0.8, 1.15, 1), paint, [
      side * 0.235,
      1.235,
      2.282,
    ]);
    d.rod([side * 0.28, 0.74, 1.65], [side * 0.28, 0.61, 1.51], 0.023, metal);
  }
  ellipsoid(d, [0, 0.97, 2.281], [0.065, 0.032, 0.01], dark, 16);
  const engine = group(root, 'engine-1', [0, 1.25095, 2.285]),
    prop = group(engine, 'Skyhawk-propeller'),
    pd = detailKit(prop, 'propeller');
  const spinner = [0, 0, 0.2, 0.4, 0.6, 0.8, 0.92, 1].map(
    (s, i) => new T.Vector2(i ? 0.155 * (1 - Math.pow(s, 1.5)) : 0, 0.3894 * s),
  );
  pd.add(new T.LatheGeometry(spinner, 24).rotateX(Math.PI / 2), paint);
  for (const side of [-1, 1]) {
    const pts = [
      [side * 0.08, -0.024, 0],
      [side * 0.31, -0.071, 0.014],
      [side * 0.82, -0.053, -0.005],
      [side * 0.9652, -0.025, -0.018],
      [side * 0.9652, 0.028, -0.018],
      [side * 0.53, 0.064, 0.012],
      [side * 0.08, 0.03, 0],
    ];
    sheet(pd, pts, dark, [0, 0, 1]);
    sheet(
      pd,
      pts.map(([x, y, z]) => [x, y, z - 0.012]),
      dark,
      [0, 0, -1],
    );
    pd.box([0.055, 0.058, 0.014], [side * 0.92, 0.002, -0.015], paint);
  }
  pd.finish();
  // 65-inch wheelbase. The published front view omits the stated propeller clearance.
  for (const [x, z, r] of [
    [0, 1.651, 0.22],
    [1.275, 0, 0.25],
    [-1.275, 0, 0.25],
  ]) {
    const side = Math.sign(x);
    if (x) {
      const a = new T.Vector3(side * 0.49, 0.55, -0.07),
        b = new T.Vector3(x, 0.27, z),
        v = b.clone().sub(a);
      const strut = d.box(
        [0.06, v.length(), 0.15],
        a.clone().addScaledVector(v, 0.5).toArray(),
        paint,
      );
      strut.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    } else {
      d.rod([0, 0.72, 1.58], [0, 0.34, z], 0.027, metal);
      for (const s of [-1, 1]) d.rod([s * 0.085, 0.38, z - 0.03], [s * 0.085, r, z], 0.017, paint);
    }
    d.add(new T.CylinderGeometry(r, r, 0.15, 28).rotateZ(Math.PI / 2), rubber, [x, r, z]);
    for (const side of [-1, 1])
      d.add(new T.CircleGeometry(r * 0.47, 20).rotateY((side * Math.PI) / 2), metal, [
        x + side * 0.077,
        r,
        z,
      ]);
    // Egg-shaped speed fairings that close over the tire tops; only the tread shows below.
    const pant = [
      [0.35, 0.04, 0.31, 0.37],
      [0.27, 0.13, 0.25, 0.46],
      [0.03, 0.16, 0.21, 0.53],
      [-0.36, 0.115, 0.24, 0.43],
      [-0.46, 0.025, 0.28, 0.32],
    ].map(([zz, w, b, t]) => ({
      z: z + zz,
      points: Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6,
          c = Math.cos(a),
          s = Math.sin(a);
        return [
          x + w * Math.sign(c) * Math.pow(Math.abs(c), 0.8),
          (b + t) / 2 + ((t - b) / 2) * Math.sign(s) * Math.pow(Math.abs(s), 0.8),
        ];
      }),
    }));
    loft(d, pant, paint);
  }
  d.finish();
  const interior = cockpit(root, { paint, blue, metal, dark });
  cleanGeometry(root);
  return {
    root,
    frame: cessna172Frame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.25095, 2.285] }],
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
    d = detailKit(cabin, 'Skyhawk-cabin'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Skyhawk');
  const { bindings, derived, ink, black, red } = instruments;
  const face = mat('Skyhawk-panel', '#666861'),
    seats = mat('Skyhawk-seats', '#b5afa0'),
    piping = mat('Skyhawk-upholstery-piping', '#898579', { metalness: 0, roughness: 0.9 }),
    belt = mat('Skyhawk-belts', '#454b49', { side: T.DoubleSide });
  const k = 0.29972 / 334,
    px = (u) => (700 - u) * k,
    py = (v) => 1.38 - (v - 200) * k,
    z = 1.1,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const edge = [
    [133, 463],
    [120, 200],
    [143, 100],
    [233, 67],
    [420, 55],
    [700, 53],
    [1080, 57],
    [1204, 89],
    [1258, 151],
    [1251, 463],
  ];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const screens = [
      [425, 215],
      [839, 215],
    ],
    sw = 0.211328,
    sh = 0.158496;
  const holes = screens.map(([u, v]) => rect(px(u), py(v), sw + 0.002, sh + 0.002));
  for (const u of [620, 725, 832])
    holes.push(
      Array.from({ length: 40 }, (_, i) => [
        px(u) + Math.cos((i * Math.PI) / 20) * 0.034,
        py(395) + Math.sin((i * Math.PI) / 20) * 0.034,
        z,
      ]),
    );
  sheet(
    d,
    edge.map(([u, v]) => at(u, v)),
    face,
    [0, 0, -1],
    holes,
  );
  sheet(
    d,
    edge.map(([u, v]) => at(u, v, 0.065)),
    m.dark,
    [0, 0, 1],
  );
  // Panel, coaming and padded rail use the same contour at every bend.
  const brow = edge.map(([u, v]) => at(u, v));
  outline(d, brow, 0.014, m.dark, false);
  const deckY = (x) =>
    1.45 - (Math.abs(x) < 0.4 ? Math.abs(x) * 0.0625 : 0.025 + (Math.abs(x) - 0.4) * 0.92);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0], deckY(b[0]), 1.3], [a[0], deckY(a[0]), 1.3], m.dark, [0, 1, 0]);
  }
  // Actual display and bezel dimensions, fixed physical controls; no decorative map pretending to navigate.
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
    propRpm: { op: 'multiply', args: ['propNormalized', 2700] },
    rpmTens: { op: 'divide', args: ['propRpm', 10] },
    rpmRoundedTens: { op: 'add', args: ['rpmTens', 0.5] },
    rpmWholeTens: { op: 'floor', args: ['rpmRoundedTens'] },
    rpmDisplay: { op: 'multiply', args: ['rpmWholeTens', 10] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', Math.PI * 2] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
  });
  const sx = px(425),
    sy = py(215);
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
  const tape = group(cabin, 'Skyhawk-speed-tape', [sx + 0.083, sy + 0.026, z + 0.009]);
  bindings.push({
    node: tape.name,
    source: 'knots',
    property: 'position',
    axis: 'y',
    scale: -0.001,
  });
  for (let value = 20; value <= 200; value += 10) {
    const row = group(tape, `Skyhawk-speed-tape-${value}`, [0, value * 0.001, 0]),
      dd = detailKit(row, row.name);
    dd.text(String(value), [0.002, 0, 0], 0.0045, Math.PI, ink, 'display');
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
  d.text('TAS', [sx + 0.083, sy + 0.065, z + 0.001], 0.006, Math.PI, ink, 'display');
  d.text('GEO FT', [sx - 0.081, sy + 0.047, z + 0.001], 0.005, Math.PI, ink, 'display');
  const vsi = group(cabin, 'Skyhawk-VSI', [sx - 0.101, sy + 0.025, z + 0.001]),
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
  const rose = group(cabin, 'Skyhawk-heading-rose', [sx, sy - 0.046, z + 0.002]),
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
        'display',
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
  d.text('TRUE', [sx, sy - 0.013, z + 0.001], 0.004, Math.PI, ink, 'display');
  d.rod([sx, sy - 0.024, z - 0.001], [sx, sy - 0.029, z - 0.001], 0.001, instruments.amber);
  d.text('NAV --  COM --', [sx, sy + 0.071, z + 0.001], 0.005, Math.PI, ink, 'display');
  // MFD engine sidebar. Oil, fuel, electrical and map data remain explicitly unavailable.
  const mx = px(839),
    my = py(215);
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
    d.text(label, [mx + 0.072, my + yy, z], 0.005, Math.PI, ink, 'display');
  d.rod([mx + 0.042, my - 0.074, z], [mx + 0.042, my + 0.074, z], 0.0006, ink);
  d.text('MAP DATA', [mx - 0.025, my + 0.012, z], 0.009, Math.PI, ink, 'display');
  d.text('UNAVAILABLE', [mx - 0.025, my - 0.003, z], 0.007, Math.PI, ink, 'display');
  // Central GMA1347: 1.3 x 7.7 inches, double pushbutton rows and two concentric knobs.
  d.box([0.03302, 0.19558, 0.012], at(627, 215, -0.008), black);
  for (let i = 0; i < 11; i++)
    for (const side of [-1, 1])
      d.box([0.009, 0.005, 0.004], at(627 + side * 9, 115 + i * 12, -0.018), m.dark);
  pt.knob(px(627), py(298), z - 0.02, 0.007);
  pt.knob(px(627), py(320), z - 0.02, 0.006);
  // Face angles measured from Marostegui's CC BY-SA 4.0 cockpit photograph; not a linear dial.
  instruments.dial(
    'standby-speed',
    at(620, 395, -0.006),
    0.038,
    'knots',
    [
      [0, 0.34],
      [20, 0.34],
      [40, 0.67],
      [60, 1.2],
      [80, 1.9],
      [100, 2.65],
      [120, 3.55],
      [140, 4.15],
      [160, 4.7],
      [180, 5.08],
      [200, 5.55],
    ],
    [40, 60, 80, 100, 120, 140, 160, 180, 200],
    'TAS',
    {
      responseSeconds: 0.2,
      minorStep: 10,
      bands: [
        [40, 85, '#e9e9dc', 0.93],
        [48, 129, '#3d9552', 0.85],
        [129, 163, '#d8bb37', 0.85],
        [163, 164, '#d74437', 0.93],
      ],
    },
  );
  instruments.horizon('standby-attitude', at(725, 395, 0.008), 0.06, 0.06, { round: true });
  d.ring(0.034, 0.004, at(725, 395, -0.005), black);
  instruments.altimeter('standby-altimeter', at(832, 395, -0.006), 0.038, 'feet');
  // Lower switch/breaker strip and standby battery/master controls.
  d.box([0.94, 0.089, 0.027], at(700, 516, -0.003), black);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 13; col++)
      pt.knob(px(205 + col * 24), py(490 + row * 28), z - 0.02, 0.0038);
  for (let col = 0; col < 7; col++) {
    pt.knob(px(193 + col * 23), py(374), z - 0.02, 0.006);
    d.text(
      ['L', 'B', 'T', 'N', 'S', 'P', 'F'][col],
      at(193 + col * 23, 358, -0.022),
      0.004,
      Math.PI,
      ink,
    );
  }
  for (const u of [182, 211]) {
    const rocker = group(cabin, `Skyhawk-master-${u}`, at(u, 310, -0.013));
    const rd = detailKit(rocker, rocker.name);
    rd.box([0.013, 0.026, 0.01], [0, 0, 0], u === 182 ? red : ink);
    if (u === 182)
      rocker.userData.aircraftControl = {
        action: 'engine',
        motion: { property: 'rotation', axis: 'x', scale: -0.5 },
      };
    rd.finish();
  }
  // Parking-brake T-handle under the lower left panel, outboard of the yoke sightline.
  const parkingBrake = group(cabin, 'Skyhawk-parking-brake', [0.33, 0.97, 1.06]),
    bd = detailKit(parkingBrake, parkingBrake.name);
  bd.rod([0, 0, 0.05], [0, 0, -0.022], 0.005, m.metal);
  bd.box([0.07, 0.016, 0.018], [0, 0, -0.03], black);
  parkingBrake.userData.aircraftControl = {
    action: 'brake',
    motion: { property: 'position', axis: 'z', scale: -0.022 },
  };
  bd.finish();
  d.text('172S', at(1130, 190, -0.01), 0.012, Math.PI, ink);
  d.text('NAV III', at(1130, 215, -0.01), 0.008, Math.PI, ink);
  for (const u of [150, 1210]) pt.vent(px(u), py(360), z - 0.008, 'round', 0.045);
  d.box([0.13, 0.022, 0.015], at(1110, 250, -0.01), black);
  d.text('ELT', at(1080, 112, -0.012), 0.006, Math.PI, ink);
  for (const u of [405, 995]) {
    const g = group(cabin, `Skyhawk-yoke-${u}`, at(u, 428, -0.17)),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0.18], [0, 0, -0.06], 0.015, m.metal);
    outline(
      dd,
      [
        [-0.125, 0.11, -0.085],
        [-0.133, -0.025, -0.085],
        [-0.085, -0.045, -0.085],
        [0.085, -0.045, -0.085],
        [0.133, -0.025, -0.085],
        [0.125, 0.11, -0.085],
      ],
      0.014,
      m.dark,
      false,
    );
    beveledBox(dd, [0.075, 0.115, 0.035], [0, 0.012, -0.085], m.dark, 0.008);
    dd.text('172', [0, -0.02, -0.107], 0.009, Math.PI, ink);
    for (const side of [-1, 1]) dd.box([0.022, 0.012, 0.025], [side * 0.123, 0.107, -0.088], black);
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.05 },
    );
  }
  const throttle = group(cabin, 'Skyhawk-throttle', at(670, 536, -0.065)),
    td = detailKit(throttle, 'throttle');
  td.rod([0, 0, 0.075], [0, 0, -0.065], 0.007, m.metal);
  td.add(
    new T.CylinderGeometry(0.019, 0.019, 0.022, 16).rotateX(Math.PI / 2),
    black,
    [0, 0, -0.071],
  );
  td.finish();
  bindings.push({
    node: throttle.name,
    source: 'power',
    property: 'position',
    axis: 'z',
    scale: 0.055,
  });
  const mixture = group(cabin, 'Skyhawk-mixture', at(741, 536, -0.01));
  const md = detailKit(mixture, mixture.name);
  md.rod([0, 0, 0], [0, 0, -0.074], 0.007, m.metal);
  md.add(new T.CylinderGeometry(0.018, 0.018, 0.025, 10).rotateX(Math.PI / 2), red, [0, 0, -0.085]);
  md.finish();
  const flapSelector = group(cabin, 'Skyhawk-flap-selector', at(870, 500, -0.035));
  const fd = detailKit(flapSelector, flapSelector.name);
  fd.box([0.02, 0.026, 0.025], [0, 0, 0], ink);
  flapSelector.userData.aircraftControl = {
    action: 'flaps',
    motion: { property: 'position', axis: 'y', scale: -0.028 },
  };
  fd.finish();
  d.text('FLAPS', at(870, 529, -0.025), 0.005, Math.PI, ink);
  d.box([0.16, 0.34, 0.23], [0, 0.78, 0.93], black);
  d.ring(0.065, 0.009, [0.06, 0.87, 0.83], black, 'x');
  d.box([0.17, 0.025, 0.46], [0, 0.65, 0.49], m.dark);
  d.ring(0.043, 0.004, [0, 0.67, 0.53], m.metal, 'y');
  d.rod([0, 0.68, 0.53], [-0.03, 0.68, 0.49], 0.008, ink);
  d.text('FUEL', [0, 0.7, 0.73], 0.008, Math.PI, ink);
  d.box([1.0, 0.035, 2.0], [0, 0.61, -0.03], m.dark);
  for (const zz of [0.1, -0.74])
    for (const x of [-0.255, 0.255]) {
      beveledBox(d, [0.43, 0.105, 0.46], [x, 0.81, zz], seats);
      beveledBox(d, [0.43, 0.47, 0.105], [x, 1.06, zz - 0.2], seats);
      beveledBox(d, [0.22, 0.13, 0.09], [x, 1.36, zz - 0.22], seats, 0.014);
      // Sewn cushion channels and perimeter welting; retain the measured seat envelope.
      for (const sx of [-0.16, 0.16]) {
        d.rod([x + sx, 0.865, zz - 0.16], [x + sx, 0.865, zz + 0.17], 0.002, piping);
        d.rod([x + sx, 0.87, zz - 0.145], [x + sx, 1.25, zz - 0.145], 0.002, piping);
      }
      for (const yy of [0.94, 1.04, 1.14])
        d.rod([x - 0.15, yy, zz - 0.146], [x + 0.15, yy, zz - 0.146], 0.0015, piping);
      for (const side of [-1, 1])
        d.rod(
          [x + side * 0.14, 0.64, zz - 0.15],
          [x + side * 0.14, 0.76, zz - 0.15],
          0.013,
          m.metal,
        );
      sheet(
        d,
        [
          [x - 0.17, 0.88, zz - 0.14],
          [x - 0.135, 0.88, zz - 0.14],
          [x + 0.12, 0.88, zz + 0.16],
          [x + 0.085, 0.88, zz + 0.16],
        ],
        belt,
        [0, 1, 0],
      );
      d.box([0.045, 0.014, 0.036], [x, 0.89, zz + 0.08], m.metal);
    }
  for (const side of [-1, 1]) {
    // Sidewall trim sits inside the skin where the cabin narrows aft of the doors.
    d.box([0.025, 0.28, 1.35], [side * 0.497, 0.83, -0.05], seats);
    d.rod([side * 0.49, 1.03, 0.24], [side * 0.49, 1.03, -0.08], 0.016, m.dark);
    for (const j of [-1, 1]) {
      const g = group(cabin, `Skyhawk-pedal-${side}-${j}`, [side * 0.25 + j * 0.075, 0.69, 1.25]),
        dd = detailKit(g, g.name);
      dd.box([0.12, 0.055, 0.04], [0, 0, 0], m.metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.035,
      });
    }
  }
  d.finish();
  finishCockpit(cabin, (mesh) => {
    // Surface preparation may clone materials; names remain stable through batching.
    if (mesh.material.name === face.name) return 'panel';
    if ([seats.name, piping.name].includes(mesh.material.name)) return 'vinyl';
    if (mesh.material.name === belt.name) return 'webbing';
  });
  return { nodes: ['cockpit'], sources, derived, bindings };
}
