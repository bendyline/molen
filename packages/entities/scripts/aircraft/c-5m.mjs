/** C-5M: explicit Galaxy stations and AMP flight deck, +Z nose.
 * General-arrangement proportions are checked against the cited drawings/photos;
 * the older drawing's TF39 engines are replaced by CF6/F138 nacelles. */
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

export const c5Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 3.55,
  cy: 5.6,
  ry: 4.1,
  cabinZ: 31.0,
  cabinWidth: 3.1,
  eye: [0.86, 8.8, 31],
  panelZ: 32,
  floor: 6.95,
});
const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
function hinge(root, name, stations, material, bindings, source, scale) {
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
  return g;
}
export function buildC5M(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('C5-airframe', '#939b9e', { side: T.DoubleSide }),
    dark = mat('C5-trim', '#283137', { side: T.DoubleSide }),
    metal = mat('C5-alloy', '#a7afb0', { metalness: 0.7 }),
    seam = mat('C5-seam', '#637076'),
    rubber = mat('C5-tires', '#171e23'),
    glass = mat('C5-glass', '#b8cdd1', {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.16,
    });
  const d = detailKit(root, 'C5-exterior'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  // Side drawing nose15, aftmost tail1075; uniform75.31m calibration. Widths from plan view.
  const ppm = 1060 / 75.31,
    sz = (u) => 37.655 - (u - 15) / ppm,
    sy = (v) => (308 - v) / ppm;
  const stations = [
    [15, 0.025, 238, 235],
    [28, 0.9, 254, 226],
    [55, 1.65, 266, 207],
    [80, 2.03, 273, 189],
    [105, 2.64, 277, 174],
    [140, 3.18, 282, 171],
    [200, 3.55, 286, 171],
    [300, 3.55, 288, 172],
    [430, 3.55, 289, 174],
    [580, 3.55, 292, 176],
    [650, 3.48, 283, 171],
    [730, 3.25, 268, 167],
    [800, 2.91, 252, 166],
    [865, 2.15, 232, 166],
    [925, 1.33, 214, 173],
    [972, 0.65, 205, 184],
    [999, 0.02, 197, 195],
  ];
  const rings = stations.map(([u, w, b, t]) => {
    const top = sy(t),
      bottom = sy(b),
      h = top - bottom;
    return {
      z: sz(u),
      points: [
        [0, top],
        [0.48 * w, top - 0.025 * h],
        [0.82 * w, top - 0.12 * h],
        [w, top - 0.3 * h],
        [w, bottom + 0.3 * h],
        [0.82 * w, bottom + 0.1 * h],
        [0.48 * w, bottom + 0.02 * h],
        [0, bottom],
        [-0.48 * w, bottom + 0.02 * h],
        [-0.82 * w, bottom + 0.1 * h],
        [-w, bottom + 0.3 * h],
        [-w, top - 0.3 * h],
        [-0.82 * w, top - 0.12 * h],
        [-0.48 * w, top - 0.025 * h],
      ],
    };
  });
  const p = (i, j) => [...rings[i].points[(j + 14) % 14], rings[i].z],
    lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  loft(d, rings, paint, {
    skip: (i, j) => [3, 4].includes(i) && [0, 1, 2, 11, 12, 13].includes(j),
  });
  // One narrow center windshield, two main windscreens, two quarter panes and two side panes.
  // Explicit perimeter stations avoid stretching glazing along the fuselage construction facets.
  const b = [
      [0, 8.43, 33.02],
      [0.3, 8.43, 33.02],
      [1.38, 8.38, 32.45],
      [1.94, 8.31, 31.65],
      [2.47, 8.25, 29.7],
    ],
    t = [
      [0, 9.13, 32.22],
      [0.28, 9.13, 32.22],
      [1.3, 9.09, 31.96],
      [1.83, 9.02, 31.2],
      [2.35, 8.92, 29.5],
    ];
  for (const side of [-1, 1]) {
    const mirror = (q) => [q[0] * side, q[1], q[2]],
      bot = b.map(mirror),
      top = t.map(mirror);
    // Front lower eyebrow and upper roof patches, each joined to the body shell.
    const lower = [
      p(3, 0),
      p(3, side),
      p(3, 2 * side),
      p(3, 3 * side),
      p(4, 3 * side),
      p(5, 3 * side),
      bot[4],
      bot[3],
      bot[2],
      bot[1],
      bot[0],
    ];
    const upper = [
      top[0],
      top[1],
      top[2],
      top[3],
      top[4],
      p(5, 3 * side),
      p(5, 2 * side),
      p(5, side),
      p(5, 0),
    ];
    sheet(d, lower, paint, [side * 0.3, 1, 1]);
    sheet(d, upper, paint, [side * 0.2, 1, 0]);
    for (let j = 0; j < 4; j++) {
      const q = [bot[j], bot[j + 1], top[j + 1], top[j]];
      sheet(d, q, glass, [side * 0.3, 1, 1]);
      d.rod(q[0], q[1], 0.023, dark);
      d.rod(q[2], q[3], 0.023, dark);
      d.rod(q[1], q[2], 0.024, dark);
      if (j > 0) d.rod(q[3], q[0], 0.024, dark);
    }
    d.rod([side * 0.5, 8.47, 32.95], [side * 0.82, 8.68, 32.62], 0.013, dark);
    d.rod([side * 0.82, 8.68, 32.62], [side * 1.08, 8.92, 32.16], 0.011, dark);
  }
  // Main plane with five degrees of anhedral, sweep and rounded outer corners.
  const ws = [
    [0, 9.56, 16.2, 2.35, 0.56],
    [3.55, 9.32, 15.0, 2.2, 0.53],
    [11.85, 8.67, 10.75, 0.47, 0.42],
    [18.65, 8.12, 7.1, -1.05, 0.3],
    [31.4, 7.05, 0.5, -4.6, 0.14],
    [33.945, 6.82, -2.45, -5.0, 0.07],
  ];
  const station = (x) => {
    const i = ws.findIndex((a) => a[0] >= x),
      a = ws[Math.max(0, i - 1)],
      b = ws[Math.max(1, i)],
      t = (x - a[0]) / (b[0] - a[0]);
    return a.map((v, j) => (j === 0 ? x : v + (b[j] - v) * t));
  };
  const cut = (x, side) => {
    const [xx, y, le, te, h] = station(x);
    return [side * xx, y, le + (te - le) * 0.74, te, h * 0.3];
  };
  for (const side of [-1, 1]) {
    wing(
      d,
      ws.map(([x, y, le, te, h]) => [side * x, y, le, le + (te - le) * 0.74, h]),
      paint,
    );
    for (const [j, lo, hi] of [
      [0, 3.56, 11.8],
      [1, 11.84, 20.1],
      [2, 20.14, 27.2],
    ])
      hinge(
        root,
        `C5-flap-${side}-${j}`,
        [lo, hi].map((x) => cut(x, side)),
        paint,
        bindings,
        'flapPosition',
        -side * 0.6,
      );
    hinge(
      root,
      `C5-aileron-${side}`,
      [27.24, 31.4, 33.945].map((x) => cut(x, side)),
      paint,
      bindings,
      'rollInput',
      -0.3,
    );
    for (const x of [5, 9.3, 14.7, 18.7, 23.5, 27.2, 31.4]) {
      const [, y, le, te, h] = station(x);
      d.rod([side * x, y + h * 0.8, le - 0.18], [side * x, y + h * 0.4, te + 0.15], 0.009, seam);
      ellipsoid(d, [side * x, y - 0.08, te - 0.3], [0.1, 0.16, 0.78], paint, 10);
      for (let k = 1; k < 8; k++)
        d.add(new T.SphereGeometry(0.01, 5, 3), metal, [
          side * x,
          y + h * 0.7,
          le + ((te - le) * k) / 9,
        ]);
    }
    for (const frac of [0.12, 0.68])
      outline(
        d,
        ws
          .slice(1)
          .map(([x, y, le, te, h]) => [
            side * x,
            y + h * (frac < 0.3 ? 0.8 : 0.6),
            le + (te - le) * frac,
          ]),
        0.01,
        seam,
        false,
      );
    ellipsoid(d, [side * 33.9, 6.88, -3.35], [0.05, 0.06, 0.2], side > 0 ? d.red : d.green, 10);
  }
  // Tall swept fin and a 68ft9in stabilizer; finite thickness at every exposed edge.
  const fin = [
    [0, 10.13, -21.7],
    [0, 17.38, -26.95],
    [0, 19.35, -26.55],
    [0, 19.25, -34.4],
    [0, 18.1, -33.2],
    [0, 9.15, -28.5],
  ];
  const width = (p) => 0.48 - (p[1] - 9) * 0.032;
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * width(p), p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-width(a), a[1], a[2]],
      [-width(b), b[1], b[2]],
      [width(b), b[1], b[2]],
      [width(a), a[1], a[2]],
      paint,
      [0, 1, 1],
    );
  }
  const rm = group(root, 'C5-rudder-mount', [0, 9.15, -28.5]),
    rud = group(rm, 'C5-rudder');
  rm.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    new T.Vector3(0, 8.95, -4.7).normalize(),
  );
  const inv = new T.Matrix4().compose(rm.position, rm.quaternion, new T.Vector3(1, 1, 1)).invert(),
    rd = detailKit(rud, rud.name),
    rp = [
      [0, 9.15, -28.5],
      [0, 18.1, -33.2],
      [0, 18.13, -35.5],
      [0, 8.6, -30.3],
    ];
  for (const side of [-1, 1])
    sheet(
      rd,
      rp.map((p) => new T.Vector3(side * 0.12, p[1], p[2]).applyMatrix4(inv).toArray()),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < 4; i++) {
    const a = rp[i],
      b = rp[(i + 1) % 4],
      q = [
        [-0.12, a[1], a[2]],
        [-0.12, b[1], b[2]],
        [0.12, b[1], b[2]],
        [0.12, a[1], a[2]],
      ].map((p) => new T.Vector3(...p).applyMatrix4(inv).toArray()),
      n = new T.Vector3(...q[1])
        .sub(new T.Vector3(...q[0]))
        .cross(new T.Vector3(...q[3]).sub(new T.Vector3(...q[0])));
    sheet(rd, q, paint, n.toArray());
  }
  rd.finish();
  bindings.push({
    node: rud.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  const hs = [
    [0.25, 19.21, -28.0, -35.1, 0.24],
    [8.9, 18.55, -33.1, -35.9, 0.1],
    [10.4775, 18.43, -35, -36.25, 0.05],
  ];
  for (const side of [-1, 1]) {
    wing(
      d,
      hs.map(([x, y, le, te, h]) => [side * x, y, le, le + (te - le) * 0.72, h]),
      paint,
    );
    hinge(
      root,
      `C5-elevator-${side}`,
      hs.map(([x, y, le, te, h]) => [side * x, y, le + (te - le) * 0.72, te, h * 0.3]),
      paint,
      bindings,
      'pitchInput',
      side * 0.3,
    );
  }
  ellipsoid(d, [0, 19.3, -31.555], [0.38, 0.54, 6.1], paint, 24);
  // CF6-80C2 nacelles: round intake, visible swept fan and separate aft core cone.
  for (const [i, x] of [18.65, 11.85, -11.85, -18.65].entries()) {
    const outer = Math.abs(x) > 15,
      front = outer ? 14.1 : 17.8,
      cy = outer ? 5.12 : 5.68,
      id = `engine-${i + 1}`;
    const ring = (z, r) => ({
      z,
      points: Array.from({ length: 32 }, (_, j) => [
        x + Math.sin((j * Math.PI) / 16) * r,
        cy + Math.cos((j * Math.PI) / 16) * r,
      ]),
    });
    loft(
      d,
      [
        [front, 1.34],
        [front - 0.15, 1.48],
        [front - 1.4, 1.55],
        [front - 4.2, 1.43],
        [front - 5.6, 1.12],
      ].map(([z, r]) => ring(z, r)),
      paint,
      { caps: false },
    );
    loft(d, [ring(front, 1.34), ring(front - 0.15, 1.21), ring(front - 0.85, 1.18)], metal, {
      caps: false,
    });
    loft(d, [ring(front - 0.85, 1.18), ring(front - 1.1, 1.14)], dark, { caps: false });
    d.add(new T.CircleGeometry(1.18, 32), dark, [x, cy, front - 1.11]);
    const fan = group(root, `C5-engine-fan-${i + 1}`, [x, cy, front - 0.95]),
      fd = detailKit(fan, fan.name);
    for (let j = 0; j < 38; j++) {
      const a = (j * 2 * Math.PI) / 38,
        at = (r, o = 0) => [Math.sin(a + o) * r, Math.cos(a + o) * r, 0];
      sheet(fd, [at(0.27), at(1.16, 0.09), at(1.16, 0.14), at(0.27, 0.1)], metal, [0, 0, 1]);
    }
    ellipsoid(fd, [0, 0, 0.1], [0.28, 0.28, 0.45], dark, 16);
    fd.finish();
    rotors.push({ node: fan.name, axis: 'z', multiplier: 1, engine: id });
    const rear = front - 5.6;
    loft(d, [ring(rear, 1.12), ring(rear - 0.35, 1.03), ring(rear - 0.6, 0.83)], metal, {
      caps: false,
    });
    d.add(new T.CircleGeometry(0.83, 24).rotateY(Math.PI), dark, [x, cy, rear - 0.61]);
    ellipsoid(d, [x, cy, rear - 0.5], [0.43, 0.43, 1.05], dark, 16);
    const [, wy, le, te] = station(Math.abs(x));
    for (const sign of [-1, 1])
      sheet(
        d,
        [
          [x + sign * 0.18, cy + 0.9, rear + 0.6],
          [x + sign * 0.18, wy, te + 0.3],
          [x + sign * 0.18, wy + 0.1, le + 0.4],
          [x + sign * 0.18, cy + 1.35, front - 1.5],
        ],
        paint,
        [sign, 0, 0],
      );
    for (const [z, r] of [
      [front - 0.4, 1.5],
      [front - 3.6, 1.46],
      [front - 4.4, 1.39],
    ])
      d.ring(r, 0.012, [x, cy, z], seam);
    enginePoints.push({ id, position: [x, cy, front - 2.7] });
  }
  // Long low gear fairings. Four tandem bogies, each two wheels forward/four aft.
  for (const side of [-1, 1]) {
    const sp = [
      [15, 0.1, 2.1, 0.1],
      [13.5, 0.65, 1.9, 0.48],
      [10.5, 0.85, 1.8, 0.65],
      [3, 0.85, 1.75, 0.72],
      [-3.3, 0.65, 1.9, 0.5],
      [-5.6, 0.1, 2.0, 0.1],
    ].map(([z, rx, cy, ry]) => ({
      z,
      points: Array.from({ length: 16 }, (_, j) => [
        side * 3.65 + Math.sin((j * Math.PI) / 8) * rx,
        cy + Math.cos((j * Math.PI) / 8) * ry,
      ]),
    }));
    loft(d, sp, paint);
  }
  const wheel = (dd, x, y, z, r, w) => {
    dd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), rubber, [x, y, z]);
    for (const side of [-1, 1]) {
      dd.add(new T.CylinderGeometry(r * 0.55, r * 0.55, 0.024, 16).rotateZ(Math.PI / 2), metal, [
        x + side * (w / 2 + 0.008),
        y,
        z,
      ]);
      dd.ring(r * 0.8, 0.012, [x + side * (w / 2 + 0.012), y, z], dark, 'x');
    }
  };
  for (const side of [-1, 1])
    for (const [j, z] of [7.8, 2.25].entries()) {
      const g = group(root, `C5-main-gear-${side}-${j}`, [side * 4.15, 0, z]),
        dd = detailKit(g, g.name);
      for (const x of [-0.28, 0.28]) wheel(dd, x, 0.61, 0.86, 0.61, 0.43);
      for (const x of [-0.83, -0.28, 0.28, 0.83]) wheel(dd, x, 0.61, -0.86, 0.61, 0.43);
      dd.rod([-0.35, 0.61, 0.86], [0.35, 0.61, 0.86], 0.11, metal);
      dd.rod([-0.9, 0.61, -0.86], [0.9, 0.61, -0.86], 0.11, metal);
      dd.rod([0, 0.7, -0.9], [0, 0.7, 0.9], 0.14, metal);
      dd.rod([0, 0.75, 0], [0, 2.2, 0.1], 0.14, metal);
      dd.rod([0, 1.2, -0.2], [side * -0.8, 2.2, -0.65], 0.065, metal);
      dd.box([0.04, 0.42, 2.6], [side * 0.98, 1.55, 0], paint);
      dd.finish();
      bindings.push(
        {
          node: g.name,
          source: 'gear',
          property: 'position',
          axis: 'y',
          scale: -1.65,
          offset: 1.65,
        },
        { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
      );
    }
  const ng = group(root, 'C5-nose-gear', [0, 0, 26.85]),
    nd = detailKit(ng, ng.name);
  for (const x of [-0.69, -0.23, 0.23, 0.69]) wheel(nd, x, 0.5, 0, 0.5, 0.36);
  nd.rod([-0.75, 0.5, 0], [0.75, 0.5, 0], 0.12, metal);
  nd.rod([0, 0.65, 0], [0, 2.4, -0.2], 0.12, metal);
  nd.rod([0, 1.2, -0.1], [0, 2, -1.25], 0.065, metal);
  for (const side of [-1, 1]) nd.box([0.04, 0.5, 2.1], [side * 0.91, 1.75, -0.35], paint);
  nd.finish();
  bindings.push(
    { node: ng.name, source: 'gear', property: 'position', axis: 'y', scale: -1.6, offset: 1.6 },
    { node: ng.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
  );
  const skin = (side, y, z, off = 0.02) => {
    let i = 0;
    while (i < rings.length - 2 && z < rings[i + 1].z) i++;
    const a = rings[i],
      b = rings[i + 1],
      t = (a.z - z) / (a.z - b.z),
      rr = a.points.map((p, j) => lerp(p, b.points[j], t));
    for (let j = 0; j < 7; j++) {
      const p = rr[j],
        q = rr[j + 1];
      if (y <= p[1] && y >= q[1]) {
        const f = (y - p[1]) / (q[1] - p[1]);
        return [side * (p[0] + (q[0] - p[0]) * f + off), y, z];
      }
    }
    throw Error('C5 fitting outside skin');
  };
  for (const side of [-1, 1]) {
    for (const [z, y, w, h] of [
      [28.9, 3.75, 0.9, 1.9],
      [21.8, 8.35, 0.65, 1.2],
      [-5.1, 8.2, 0.7, 1.25],
      [-5.1, 3.35, 1.0, 1.9],
    ]) {
      outline(
        d,
        [
          [y - h / 2, z - w / 2],
          [y + h / 2, z - w / 2],
          [y + h / 2, z + w / 2],
          [y - h / 2, z + w / 2],
        ].map(([yy, zz]) => skin(side, yy, zz)),
        0.016,
        seam,
      );
      d.rod(skin(side, y, z - 0.15, 0.03), skin(side, y, z + 0.15, 0.03), 0.018, metal);
    }
    // Visor cargo-door seam follows the actual skin; it is not an operating loading mechanism.
    outline(
      d,
      [
        [3.2, 32.15],
        [4.6, 31.5],
        [6.4, 30.7],
        [7.4, 30.3],
      ].map(([y, z]) => skin(side, y, z)),
      0.02,
      seam,
      false,
    );
    outline(
      d,
      rings.slice(10, 16).map((r) => [side * r.points[5][0] * 1.005, r.points[5][1], r.z]),
      0.016,
      seam,
      false,
    );
    // Exterior operator identifiers are supplied by the selected livery.
  }
  for (const index of [6, 8, 10, 12]) {
    const r = rings[index];
    outline(
      d,
      r.points.map(([x, y]) => [x * 1.004, y + 0.006, r.z]),
      0.009,
      seam,
    );
    for (let j = 3; j < 12; j++)
      for (let k = 0; k < 4; k++) {
        const a = r.points[j],
          b = r.points[(j + 1) % 14],
          t = k / 4;
        d.add(new T.SphereGeometry(0.012, 5, 3), metal, [
          (a[0] + (b[0] - a[0]) * t) * 1.005,
          a[1] + (b[1] - a[1]) * t + 0.004,
          r.z + 0.05,
        ]);
      }
  }
  for (const z of [23, 10, -8])
    sheet(
      d,
      [
        [0.025, 9.7, z + 0.3],
        [0.025, 10.2, z - 0.2],
        [0.025, 9.7, z - 0.4],
      ],
      dark,
      [1, 0, 0],
    );
  ellipsoid(d, [0, 9.8, 12], [0.12, 0.08, 0.16], d.red, 10);
  d.finish();
  const interior = cockpit(root, { paint, dark, metal, glass });
  cleanGeometry(root);
  return {
    root,
    frame: c5Frame(),
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
    d = detailKit(cabin, 'C5-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'C5'),
    { bindings, derived, ink, black, amber } = ins;
  const face = mat('C5-panel', '#344047', { side: T.DoubleSide }),
    liner = mat('C5-liner', '#afb5b4', { side: T.DoubleSide }),
    seat = mat('C5-seat', '#3f5167'),
    cushion = mat('C5-cushion', '#b9beb9'),
    belt = mat('C5-belt', '#657582'),
    green = mat('C5-display-green', '#84d2a1', { emissive: '#285c38', emissiveIntensity: 0.5 });
  const sources = Object.fromEntries(
    ['airspeed', 'pitch', 'roll', 'yaw', 'verticalSpeed', 'gearPosition', 'flapPosition'].map(
      (k) => [
        k === 'airspeed' ? 'trueAirspeed' : k === 'gearPosition' ? 'gear' : k,
        { component: 'aircraftState', path: [k] },
      ],
    ),
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
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  // Pixel coordinates from the frontal AMP photograph; panel width3.1m is estimated.
  const px = (u) => ((360 - u) * 3.1) / 690,
    py = (v) => 8.06 + ((170 - v) * 3.1) / 690,
    z = 32,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const contour = [
    [15, 237],
    [15, 130],
    [48, 111],
    [205, 105],
    [205, 92],
    [515, 92],
    [515, 105],
    [700, 111],
    [712, 130],
    [712, 237],
    [520, 237],
    [520, 260],
    [205, 260],
    [205, 237],
  ].map(([u, v]) => at(u, v));
  const screens = [
    { u: 83, v: 177, w: 67, h: 94, kind: 'pilot-nav' },
    { u: 164, v: 179, w: 65, h: 94, kind: 'pilot' },
    { u: 289, v: 164, w: 65, h: 91, kind: 'engine' },
    { u: 370, v: 164, w: 65, h: 91, kind: 'systems' },
    { u: 580, v: 175, w: 65, h: 94, kind: 'copilot-nav' },
    { u: 661, v: 175, w: 65, h: 94, kind: 'copilot' },
  ];
  const holes = screens.map((a) => rect(px(a.u), py(a.v), (a.w * 3.1) / 690, (a.h * 3.1) / 690, z));
  holes.push(rect(px(231), py(128), 0.095, 0.09, z));
  sheet(d, contour, face, [0, 0, -1], holes);
  outline(d, contour, 0.014, m.dark);
  function rose(parent, name, x, y, r, dd) {
    const g = group(parent, `C5-${name}-heading`, [x, y, -0.02]),
      rd = detailKit(g, g.name);
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
      rd.rod(p(r * (deg % 30 ? 0.9 : 0.81)), p(r), 0.0008, ink);
      if (deg % 30 === 0)
        rd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(r * 0.64),
          r * 0.14,
          Math.PI,
          ink,
        );
    }
    rd.finish();
    bindings.push({
      node: g.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: 2 * Math.PI,
      responseSeconds: 0.15,
    });
    ins.available(`${name}-heading`, 'trueHeading', g.name);
    dd.rod([x, y + r + 0.006, -0.022], [x, y + r - 0.008, -0.022], 0.0015, amber);
  }
  for (const a of screens) {
    const x = px(a.u),
      y = py(a.v),
      w = (a.w * 3.1) / 690,
      h = (a.h * 3.1) / 690;
    sheet(
      d,
      rect(x, y, w + 0.035, h + 0.035, z - 0.007),
      m.dark,
      [0, 0, -1],
      [rect(x, y, w, h, z - 0.007)],
    );
    for (let j = 0; j < 6; j++)
      d.box(
        [0.016, 0.011, 0.008],
        [x + w * 0.4 - j * w * 0.16, y - h / 2 - 0.017, z - 0.016],
        m.dark,
      );
    pt.knob(x - w / 2 + 0.015, y - h / 2 + 0.015, z - 0.02, 0.012);
    if (['pilot', 'copilot'].includes(a.kind)) {
      const g = group(cabin, `C5-${a.kind}-display`, [x, y, z + 0.016]),
        dd = detailKit(g, g.name),
        ii = instrumentGeometry(g, `C5-${a.kind}`);
      ii.horizon('horizon', [0, 0.065, 0], 0.18, 0.18, { blankBackdrop: true });
      sheet(dd, rect(0, 0, w, h, -0.012), black, [0, 0, -1], [rect(0, 0.065, 0.18, 0.18, -0.012)]);
      ii.readout('speed', [0.115, 0.065, -0.02], 'knots', 3, 0.01, ink, false, true);
      dd.text('TAS', [0.115, 0.119, -0.022], 0.006, Math.PI, ink);
      ii.readout('altitude', [-0.115, 0.065, -0.02], 'feet', 5, 0.008, ink, true, true);
      dd.text('GEO FT', [-0.115, 0.119, -0.022], 0.006, Math.PI, ink);
      rose(g, a.kind, 0, -0.09, 0.058, dd);
      dd.text('TRUE', [0, -0.016, -0.022], 0.006, Math.PI, ink);
      ii.readout('vertical', [-0.1, -0.1, -0.02], 'verticalFpm', 4, 0.008, ink, true, true);
      dd.text('FPM', [-0.1, -0.15, -0.022], 0.006, Math.PI, ink);
      dd.finish();
      bindings.push(...ii.bindings);
      Object.assign(derived, ii.derived);
    } else if (a.kind.endsWith('nav')) {
      const g = group(cabin, `C5-${a.kind}`, [x, y, z]),
        dd = detailKit(g, g.name);
      dd.box([w, h, 0.005], [0, 0, 0.012], black);
      rose(g, a.kind, 0, -0.015, 0.11, dd);
      dd.text('TRUE HEADING', [0, 0.16, 0], 0.01, Math.PI, green);
      dd.text('NAV --', [0, -0.17, 0], 0.012, Math.PI, green);
      dd.finish();
    } else {
      sheet(d, rect(x, y, w, h, z + 0.009), black, [0, 0, -1]);
      d.text(
        a.kind === 'engine' ? 'SIM ENGINE RPM' : 'AIRCRAFT STATE',
        [x, y + 0.17, z],
        0.009,
        Math.PI,
        green,
      );
      if (a.kind === 'engine') {
        for (let j = 0; j < 4; j++) {
          const source = `engine${j + 1}`,
            value = `enginePercent${j + 1}`,
            xx = x + 0.102 - j * 0.068;
          sources[source] = {
            component: 'aircraftState',
            path: ['engines', `engine-${j + 1}`, 'rpm'],
          };
          derived[value] = { op: 'multiply', args: [source, 100] };
          ins.dial(
            `rpm-${j + 1}`,
            [xx, y + 0.06, z],
            0.027,
            value,
            [
              [0, -2.2],
              [110, 2.2],
            ],
            [0, 100],
            '%',
            { material: green, responseSeconds: 0.15 },
          );
          d.text(String(j + 1), [xx, y + 0.12, z], 0.009, Math.PI, ink);
          for (const yy of [y - 0.02, y - 0.09]) {
            d.add(new T.RingGeometry(0.019, 0.02, 16).rotateY(Math.PI), green, [xx, yy, z]);
            d.text('--', [xx, yy, z - 0.002], 0.008, Math.PI, green);
          }
        }
        d.text('N2 EGT FF --', [x, y - 0.15, z], 0.009, Math.PI, green);
      } else {
        ins.dial(
          'flaps',
          [x, y + 0.04, z],
          0.06,
          'flapPosition',
          [
            [0, -2],
            [1, 2],
          ],
          [0, 0.5, 1],
          'FLAP',
          { material: green },
        );
        const lg = group(cabin, 'C5-gear-down', [x, y - 0.09, z]),
          ld = detailKit(lg, lg.name);
        for (const [xx, yy] of [
          [0, 0.03],
          [-0.03, 0],
          [0.03, 0],
          [-0.03, -0.03],
          [0.03, -0.03],
        ])
          ld.box([0.016, 0.016, 0.003], [xx, yy, 0], green);
        ld.finish();
        bindings.push({
          node: lg.name,
          source: 'gearDown',
          property: 'visible',
          scale: 1,
          missing: 'hide',
        });
        d.text('GEAR', [x, y - 0.16, z], 0.009, Math.PI, green);
      }
    }
  }
  sheet(
    d,
    rect(px(231), py(128), 0.12, 0.12, z - 0.008),
    m.dark,
    [0, 0, -1],
    [rect(px(231), py(128), 0.095, 0.09, z - 0.008)],
  );
  ins.horizon('standby', [px(231), py(128), z + 0.016], 0.095, 0.09, { blankBackdrop: true });
  ins.dial(
    'standby-speed',
    at(231, 160),
    0.047,
    'knots',
    [
      [0, -2.3],
      [500, 2.3],
    ],
    [0, 100, 200, 300, 400, 500],
    'TAS',
  );
  ins.altimeter('standby-altitude', at(231, 190), 0.047, 'feet');
  ins.dial(
    'standby-vsi',
    at(430, 123),
    0.055,
    'verticalFpm',
    [
      [-4000, -2.3],
      [0, 0],
      [4000, 2.3],
    ],
    [-4000, 0, 4000],
    'FPM',
  );
  for (const [u, v, r] of [
    [468, 132, 0.037],
    [474, 167, 0.033],
    [432, 181, 0.038],
  ]) {
    d.add(new T.CircleGeometry(r, 24).rotateY(Math.PI), black, at(u, v, -0.005));
    d.ring(r, 0.004, at(u, v, -0.006), m.metal);
    d.text('--', at(u, v, -0.01), 0.014, Math.PI, ink);
  }
  for (const [u, v] of [
    [26, 190],
    [26, 220],
    [496, 128],
    [496, 159],
    [464, 211],
    [430, 211],
  ])
    pt.knob(px(u), py(v), z - 0.02, 0.021);
  // High shelf with two radio/autoflight units and four distinctive striped fire-handle plates.
  d.box([2.17, 0.2, 0.44], [0, 8.57, 31.99], m.dark);
  for (const side of [-1, 1]) {
    d.box([0.46, 0.19, 0.025], [side * 0.84, 8.58, 31.75], face);
    d.box([0.4, 0.055, 0.006], [side * 0.84, 8.62, 31.731], black);
    d.text('COM --', [side * 0.84, 8.62, 31.725], 0.014, Math.PI, green);
    for (let j = 0; j < 4; j++) pt.knob(side * 0.84 - 0.15 + j * 0.1, 8.53, 31.72, 0.017);
  }
  for (let i = 0; i < 4; i++) {
    const x = 0.39 - i * 0.26;
    d.box([0.23, 0.21, 0.022], [x, 8.58, 31.75], ink);
    for (let j = 0; j < 4; j++) {
      const xx = x - 0.09 + j * 0.055;
      d.rod([xx - 0.035, 8.49, 31.732], [xx + 0.035, 8.67, 31.732], 0.015, amber);
    }
    beveledBox(d, [0.08, 0.16, 0.045], [x, 8.58, 31.7], ins.red, 0.01);
    d.text(String(i + 1), [x, 8.58, 31.673], 0.018, Math.PI, ink);
  }
  // Pedestal: wide four-engine quadrant, paired FMS keypads and aft radio panels.
  const ped = group(cabin, 'C5-center-console', [0, 7.53, 30.9]);
  ped.rotation.x = Math.PI / 2;
  const td = detailKit(ped, ped.name),
    tp = panelTools(td);
  beveledBox(td, [1.18, 2.5, 0.42], [0, 0, 0.08], face);
  for (let i = 0; i < 4; i++) {
    const x = 0.27 - i * 0.18;
    td.box([0.03, 0.65, 0.01], [x, 0.74, -0.14], black);
    const g = group(ped, `C5-throttle-${i + 1}`, [x, 0.55, -0.15]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.1, -0.29], 0.023, m.metal);
    dd.rod([-0.075, 0.1, -0.29], [0.075, 0.1, -0.29], 0.038, m.metal);
    dd.box([0.15, 0.06, 0.07], [0, 0.1, -0.29], m.dark);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.7,
      offset: -0.15,
    });
  }
  for (const x of [-0.41, 0.41]) {
    td.box([0.3, 0.64, 0.025], [x, -0.12, -0.15], m.dark);
    td.box([0.24, 0.13, 0.006], [x, 0.085, -0.17], black);
    td.text('FMS --', [x, 0.085, -0.175], 0.016, Math.PI, green);
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 6; c++)
        td.box([0.026, 0.024, 0.008], [x - 0.11 + c * 0.044, -0.03 - r * 0.043, -0.176], face);
  }
  for (const yy of [0.11, -0.22, -0.54, -0.88]) {
    td.box([0.41, 0.25, 0.02], [0, yy, -0.15], m.dark);
    td.box([0.3, 0.04, 0.006], [0, yy + 0.06, -0.17], black);
    td.text('--', [0, yy + 0.06, -0.176], 0.012, Math.PI, green);
    for (const x of [-0.15, 0, 0.15]) tp.knob(x, yy - 0.04, -0.18, 0.02);
  }
  for (const side of [-1, 1])
    for (const yy of [-0.67, -1.02]) {
      td.box([0.3, 0.23, 0.02], [side * 0.41, yy, -0.15], m.dark);
      for (let i = 0; i < 4; i++) tp.knob(side * 0.41 - 0.1 + i * 0.067, yy, -0.18, 0.017);
    }
  const flap = group(ped, 'C5-flap-lever', [-0.51, 0.58, -0.16]),
    fl = detailKit(flap, flap.name);
  fl.rod([0, 0, 0], [0, 0, -0.2], 0.017, m.metal);
  fl.box([0.12, 0.045, 0.065], [0, 0, -0.2], ink);
  fl.finish();
  bindings.push({
    node: flap.name,
    source: 'flapPosition',
    property: 'rotation',
    axis: 'x',
    scale: -0.55,
  });
  td.finish();
  // Wide overhead densely grouped as in Boisvert's photograph, without invented live warnings.
  const over = group(cabin, 'C5-overhead', [0, 9.18, 29.45]);
  over.rotation.x = -Math.PI / 2;
  const od = detailKit(over, over.name),
    op = panelTools(od);
  beveledBox(od, [1.75, 2.05, 0.1], [0, 0, 0.01], face);
  for (const [row, label] of ['ELECTRICAL', 'HYDRAULIC', 'FUEL', 'AIR', 'LIGHTS'].entries())
    for (const side of [-1, 1]) {
      const x = side * 0.43,
        yy = 0.8 - row * 0.39;
      outline(od, rect(x, yy, 0.79, 0.34, -0.05), 0.004, ink);
      od.text(label, [x, yy + 0.13, -0.06], 0.018, Math.PI, ink);
      for (let j = 0; j < 5; j++) {
        const xx = x - 0.29 + j * 0.145;
        od.box([0.07, 0.045, 0.013], [xx, yy + 0.025, -0.06], black);
        od.rod([xx, yy - 0.06, -0.075], [xx, yy - 0.02, -0.115], 0.009, m.metal);
        if (row % 2 === 0) op.knob(xx, yy - 0.1, -0.08, 0.018);
      }
    }
  od.finish();
  // Full-height columns, U-shaped handwheels, rudder pedals and cloth-covered seats.
  for (const side of [-1, 1]) {
    const x = side * 0.86;
    const col = group(cabin, `C5-column-${side}`, [x, 7.08, 31.35]),
      cd = detailKit(col, col.name);
    cd.rod([0, 0, 0], [0, 0.83, 0.02], 0.06, m.dark);
    for (let j = 0; j < 5; j++)
      beveledBox(cd, [0.25 - j * 0.02, 0.045, 0.23 - j * 0.018], [0, j * 0.05, 0.01], m.dark, 0.01);
    cd.finish();
    bindings.push({
      node: col.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: -0.18,
    });
    const yoke = group(col, `C5-yoke-${side}`, [0, 0.86, 0.02]),
      yd = detailKit(yoke, yoke.name);
    outline(
      yd,
      [
        [-0.22, 0.15, 0],
        [-0.23, -0.06, 0],
        [-0.12, -0.13, 0],
        [0.12, -0.13, 0],
        [0.23, -0.06, 0],
        [0.22, 0.15, 0],
      ],
      0.027,
      m.dark,
      false,
    );
    beveledBox(yd, [0.15, 0.16, 0.07], [0, -0.07, -0.015], m.dark);
    yd.box([0.08, 0.1, 0.008], [0, -0.06, -0.056], seat);
    for (const xx of [-0.22, 0.22]) {
      yd.rod([xx, 0.02, 0], [xx, 0.19, 0], 0.035, m.dark);
      yd.box([0.04, 0.028, 0.024], [xx, 0.19, -0.028], ins.red);
    }
    yd.finish();
    bindings.push({
      node: yoke.name,
      source: 'rollInput',
      property: 'rotation',
      axis: 'z',
      scale: 0.65,
    });
    for (const dx of [-0.18, 0.18]) {
      const pg = group(cabin, `C5-pedal-${side}-${Math.sign(dx)}`, [x + dx, 7.18, 31.95]),
        pd = detailKit(pg, pg.name);
      pd.box([0.23, 0.28, 0.05], [0, 0, 0], m.metal);
      for (let j = 0; j < 7; j++)
        pd.rod([-0.1, -0.11 + j * 0.034, -0.03], [0.1, -0.11 + j * 0.034, -0.03], 0.005, m.dark);
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: Math.sign(dx) * 0.055,
      });
    }
    d.box([0.47, 0.35, 0.57], [x, 7.15, 30.1], m.metal);
    beveledBox(d, [0.67, 0.17, 0.72], [x, 7.45, 30.1], cushion, 0.035);
    const back = group(cabin, `C5-seat-${side}`, [x, 7.98, 29.74]);
    back.rotation.x = -0.12;
    const bd = detailKit(back, back.name);
    beveledBox(bd, [0.67, 1.02, 0.19], [0, 0, 0], seat, 0.035);
    beveledBox(bd, [0.55, 0.88, 0.035], [0, -0.015, 0.12], cushion, 0.015);
    for (const dx of [-0.18, 0.18]) bd.rod([dx, 0.49, 0.13], [dx * 0.4, -0.46, 0.15], 0.027, belt);
    bd.finish();
    for (const dx of [-0.37, 0.37])
      beveledBox(d, [0.08, 0.08, 0.43], [x + dx, 7.68, 30.08], seat, 0.01);
    d.rod([x - 0.27, 7.55, 29.95], [x + 0.22, 7.55, 30.25], 0.027, belt);
    d.box([0.18, 0.55, 2.7], [side * 1.55, 7.55, 30.3], liner);
    for (let j = 0; j < 8; j++)
      d.rod(
        [side * 1.45, 7.9 + j * 0.027, 30.2],
        [side * 1.45, 7.9 + j * 0.027, 30.55],
        0.006,
        m.dark,
      );
  }
  d.box([3.15, 0.08, 5.3], [0, 6.91, 29.7], m.dark);
  // Aft engineer's station keeps the cabin volume and console mass visible from the crew seats.
  const engineer = group(cabin, 'C5-engineer-station', [-1.28, 7.98, 28.4]);
  engineer.rotation.y = -Math.PI / 2;
  const ed = detailKit(engineer, engineer.name),
    ep = panelTools(ed);
  beveledBox(ed, [1.7, 1.1, 0.12], [0, 0, 0], face);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 7; col++) {
      const x = -0.7 + col * 0.23,
        y = 0.38 - row * 0.25;
      ed.add(new T.CircleGeometry(0.065, 16).rotateY(Math.PI), black, [x, y, -0.066]);
      ed.text('--', [x, y, -0.071], 0.018, Math.PI, ink);
      if (row === 3) ep.knob(x, y - 0.08, -0.08, 0.02);
    }
  ed.finish();
  sheet(d, rect(0, 8.0, 5.4, 3.2, 26.95), liner, [0, 0, 1], [rect(0.7, 7.55, 0.8, 1.9, 26.95)]);
  d.box([5.75, 0.06, 35], [0, 2.7, 8], liner);
  d.finish();
  for (const b of bindings) b.source = b.source.replace('C5-copilot.', 'C5-pilot.');
  for (const key of Object.keys(derived)) if (key.startsWith('C5-copilot.')) delete derived[key];
  return { nodes: ['cockpit'], sources, derived, bindings };
}
