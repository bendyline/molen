/** C-17A: USAF T.O.1C-17A-1 three-view and photographed four-display flight deck.
 * +Z nose, +Y up. Explicit stations, not a scaled generic transport. */
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

export const c17Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 3.43,
  cy: 4.03,
  ry: 3.35,
  cabinZ: 22.55,
  cabinWidth: 3.25,
  eye: [0.87, 5.39, 22.55],
  panelZ: 23.38,
  floor: 3.8,
});
const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
function hinged(root, name, stations, material, bindings, source, scale) {
  const a = stations[0],
    b = stations.at(-1),
    mount = group(root, `${name}-mount`, a.slice(0, 3)),
    g = group(mount, name);
  mount.quaternion.setFromUnitVectors(
    new T.Vector3(1, 0, 0),
    new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(),
  );
  const inverse = new T.Matrix4()
      .compose(mount.position, mount.quaternion, new T.Vector3(1, 1, 1))
      .invert(),
    temp = new T.Group(),
    d = detailKit(temp, name);
  wing(d, stations, material);
  d.finish();
  for (const n of [...temp.children]) {
    n.traverse((m) => {
      if (m.isMesh) m.geometry.applyMatrix4(inverse);
    });
    g.add(n);
  }
  bindings.push({ node: name, source, property: 'rotation', axis: 'x', scale });
  return g;
}
export function buildC17A(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('C17-airframe', '#929d9f', { side: T.DoubleSide }),
    dark = mat('C17-trim', '#29343a', { side: T.DoubleSide }),
    metal = mat('C17-alloy', '#a5aeb1', { metalness: 0.7 }),
    seam = mat('C17-seam', '#617075'),
    rubber = mat('C17-tires', '#1a2024'),
    glass = mat('C17-glass', '#b7d1d4', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'C17-exterior'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  // Outline stations sampled from the flight-manual side/top drawing (53m overall scale).
  const scale = 957 / 53,
    sz = (u) => 26.5 - (u - 203) / scale,
    sy = (v) => (1218 - v) / scale;
  const sections = [
    [203, 0.025, 1157, 1152],
    [209, 0.45, 1173, 1140],
    [222, 0.95, 1185, 1128],
    [242, 1.57, 1194, 1110],
    [260, 1.96, 1199, 1100],
    [285, 2.55, 1204, 1092],
    [320, 3.17, 1207, 1087],
    [345, 3.43, 1207, 1087],
    [420, 3.43, 1207, 1087],
    [520, 3.43, 1207, 1089],
    [620, 3.43, 1205, 1092],
    [700, 3.42, 1198, 1089],
    [800, 3.35, 1181, 1084],
    [875, 2.94, 1162, 1082],
    [950, 2.07, 1140, 1085],
    [1010, 1.15, 1123, 1091],
    [1065, 0.25, 1110, 1098],
    [1074, 0.025, 1106, 1102],
  ];
  const rings = sections.map(([u, w, b, t]) => {
    const top = sy(t),
      bottom = sy(b),
      h = top - bottom;
    return {
      z: sz(u),
      points: [
        [0, top],
        [0.5 * w, top - 0.035 * h],
        [0.86 * w, top - 0.14 * h],
        [w, top - 0.31 * h],
        [w, bottom + 0.31 * h],
        [0.86 * w, bottom + 0.12 * h],
        [0.5 * w, bottom + 0.025 * h],
        [0, bottom],
        [-0.5 * w, bottom + 0.025 * h],
        [-0.86 * w, bottom + 0.12 * h],
        [-w, bottom + 0.31 * h],
        [-w, top - 0.31 * h],
        [-0.86 * w, top - 0.14 * h],
        [-0.5 * w, top - 0.035 * h],
      ],
    };
  });
  const point = (i, j) => [...rings[i].points[(j + 14) % 14], rings[i].z];
  const windowFace = (i, j) =>
    ([2, 3].includes(i) && [0, 1, 12, 13].includes(j)) ||
    ([3, 4].includes(i) && [2, 11].includes(j));
  loft(d, rings, paint, { skip: windowFace });
  const lerp = (a, b, t) => a.map((v, j) => v + (b[j] - v) * t);
  for (const side of [-1, 1]) {
    // Two uninterrupted front panes, with a real painted surround. The shell's construction
    // facets must not become a fictitious spiderweb of window mullions.
    const j = side > 0 ? 2 : 12,
      k = side > 0 ? 1 : 13;
    const contour = [
      point(2, 0),
      point(3, 0),
      point(4, 0),
      point(4, k),
      point(4, j),
      point(3, j),
      point(2, j),
      point(2, k),
    ];
    const p = (u, v) =>
      lerp(lerp(point(2, 0), point(4, 0), v), lerp(point(2, j), point(4, j), v), u);
    const hole = [p(0.055, 0.1), p(0.055, 0.64), p(0.9, 0.94), p(0.9, 0.39)];
    sheet(d, contour, paint, [side * 0.3, 1, 1], [hole]);
    sheet(d, hole, glass, [side * 0.3, 1, 1]);
    outline(d, hole, 0.025, dark);
    for (const i of [3, 4]) {
      const a = point(i, j),
        b = point(i + 1, j),
        c = point(i + 1, j + side),
        e = point(i, j + side),
        quadPts = [a, b, c, e];
      const at = (u, v) => lerp(lerp(a, b, u), lerp(e, c, u), v);
      const h = [at(0.08, 0.12), at(0.92, 0.12), at(0.92, 0.88), at(0.08, 0.88)];
      const n = new T.Vector3(...b)
        .sub(new T.Vector3(...a))
        .cross(new T.Vector3(...e).sub(new T.Vector3(...a)))
        .toArray();
      sheet(d, quadPts, paint, n, [h]);
      sheet(d, h, glass, n);
      outline(d, h, 0.024, dark);
    }
    const wa = lerp(hole[0], hole[3], 0.12),
      wb = lerp(hole[0], hole[3], 0.55),
      wc = lerp(hole[0], hole[3], 0.9);
    for (const q of [wa, wb, wc]) q[2] += 0.018;
    d.rod(wa, wb, 0.015, dark);
    d.rod(wb, wc, 0.011, dark);
  }
  for (const side of [-1, 1]) {
    // Eyebrow windows above the clearview side window are separate small apertures.
    const pts = [
      [side * 0.79, 6.32, 23.24],
      [side * 1.14, 6.25, 22.99],
      [side * 1.17, 6.55, 22.51],
      [side * 0.8, 6.64, 22.72],
    ];
    // Their solid roof was not carved in this low-poly shell; use a flush dark inset.
    sheet(d, pts, dark, [side, 1, 0]);
    outline(d, pts, 0.018, paint);
    d.rod([side * 1.4, 4.5, 24.6], [side * 1.6, 4.55, 24.25], 0.017, metal);
    d.rod([side * 1.6, 4.55, 24.25], [side * 1.65, 4.55, 24.7], 0.013, metal);
  }
  // Selected skin seams, access hatches and fasteners, on the faceted surface.
  for (const i of [2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    const pts = rings[i].points.map(([x, y]) => [x * 1.0015, 4 + (y - 4) * 1.0015, rings[i].z]);
    outline(d, pts, 0.006, seam);
    for (let j = 0; j < 14; j++)
      for (let k = 1; k < 5; k++) {
        const a = pts[j],
          b = pts[(j + 1) % 14];
        d.add(
          new T.SphereGeometry(0.008, 5, 3),
          metal,
          a.map((v, c) => v + ((b[c] - v) * k) / 5),
        );
      }
  }
  for (const side of [-1, 1]) {
    for (const [z, y, w, h] of [
      [20.22, 2.55, 0.75, 1.8],
      [-0.3, 2.7, 1.09, 2.03],
    ]) {
      const x = side * (z > 15 ? 3.33 : 3.44),
        pts = [
          [x, y - h / 2, z - w / 2],
          [x, y + h / 2, z - w / 2],
          [x, y + h / 2, z + w / 2],
          [x, y - h / 2, z + w / 2],
        ];
      outline(d, pts, 0.016, seam);
      d.rod([x + side * 0.016, y, z - 0.15], [x + side * 0.016, y, z + 0.15], 0.019, metal);
      d.box([0.015, 0.18, 0.24], [x + side * 0.012, y + 0.48, z], dark);
    }
    for (const z of [18.9, 16.3, 2.0]) d.box([0.025, 0.32, 0.42], [side * 3.43, 5.9, z], dark);
    const sp = [
      [13, 0.08, 2.45, 0.1],
      [11.8, 0.65, 2.1, 0.7],
      [9.7, 1.19, 1.86, 1.0],
      [5.0, 1.28, 1.7, 1.09],
      [1.7, 1.2, 1.8, 1.1],
      [-1.0, 0.82, 2.1, 0.85],
      [-2.5, 0.06, 2.5, 0.1],
    ].map(([z, rx, cy, ry]) => ({
      z,
      points: Array.from({ length: 16 }, (_, j) => [
        side * 3.75 + Math.sin((j * Math.PI) / 8) * rx,
        cy + Math.cos((j * Math.PI) / 8) * ry,
      ]),
    }));
    loft(d, sp, paint);
    d.box([0.035, 0.35, 0.7], [side * 4.88, 2.23, 8.4], dark);
    for (let j = 0; j < 8; j++)
      d.rod(
        [side * 4.91, 2.08 + j * 0.04, 8.05],
        [side * 4.91, 2.08 + j * 0.04, 8.74],
        0.011,
        metal,
      );
  }
  const ws = [
    [0, 7.15, 14.2, 0.4, 0.4],
    [3.3, 6.95, 12.43, 1.4, 0.4],
    [7.57, 6.54, 10.05, 0.6, 0.35],
    [14.22, 5.88, 6.25, -0.1, 0.25],
    [25.18, 4.38, 0.17, -2.06, 0.11],
  ];
  const station = (x) => {
    const i = ws.findIndex((a) => a[0] >= x),
      a = ws[Math.max(0, i - 1)],
      b = ws[Math.max(1, i)],
      t = (x - a[0]) / (b[0] - a[0]);
    return a.map((v, j) => (j === 0 ? x : v + (b[j] - v) * t));
  };
  const cut = (x, side, back = false) => {
    const [xx, y, le, te, h] = station(x),
      hinge = le + (te - le) * 0.73;
    return [side * xx, y, back ? hinge : le, back ? te : hinge, back ? h * 0.34 : h];
  };
  for (const side of [-1, 1]) {
    wing(
      d,
      ws.map((a) => [side * a[0], a[1], a[2], a[2] + (a[3] - a[2]) * 0.73, a[4]]),
      paint,
    );
    for (const [j, lo, hi] of [
      [0, 3.5, 12.9],
      [1, 13, 18.4],
    ])
      hinged(
        root,
        `C17-flap-${side}-${j}`,
        [lo, hi].map((x) => cut(x, side, true)),
        paint,
        bindings,
        'flapPosition',
        -side * 0.62,
      );
    hinged(
      root,
      `C17-aileron-${side}`,
      [18.48, 25.18].map((x) => cut(x, side, true)),
      paint,
      bindings,
      'rollInput',
      -0.35,
    );
    // Fifteen-degree outward canted winglet, swept aft in side elevation.
    wing(
      d,
      [
        [side * 25.18, 4.38, 0.17, -2.06, 0.11],
        [side * 25.875, 7.1, -2.46, -3.31, 0.045],
      ],
      paint,
    );
    for (const x of [5, 9.3, 13.6, 18.4, 22.2]) {
      const [, y, le, te, h] = station(x);
      d.rod([side * x, y + h, le - 0.12], [side * x, y + h * 0.4, te + 0.12], 0.007, seam);
      for (let k = 1; k < 7; k++)
        d.add(new T.SphereGeometry(0.008, 5, 3), metal, [
          side * x,
          y + h * 0.7,
          le + ((te - le) * k) / 8,
        ]);
      const fair = ellipsoid(d, [side * x, y - 0.08, te - 0.28], [0.09, 0.12, 0.47], paint, 10);
      fair.rotation.x = 0.06;
    }
    for (const frac of [0.15, 0.69])
      outline(
        d,
        ws
          .slice(1)
          .map(([x, y, le, te, h]) => [
            side * x,
            y + h * (frac < 0.3 ? 1 : 0.6),
            le + (te - le) * frac,
          ]),
        0.007,
        seam,
        false,
      );
    ellipsoid(d, [side * 25.88, 7.25, -2.95], [0.045, 0.065, 0.14], side > 0 ? d.red : d.green, 10);
  }
  // Fin and the swept, slightly drooped 65-foot horizontal stabilizer.
  const fin = [
    [0, 7.38, -9.8],
    [0, 7.9, -11.5],
    [0, 15.45, -18.0],
    [0, 16.79, -18.7],
    [0, 16.72, -20.4],
    [0, 15.7, -23.34],
    [0, 7.45, -15.8],
  ];
  const width = (p) => 0.48 - (p[1] - 7.38) * 0.034;
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
      [0, 1, 0.5],
    );
  }
  const rudMount = group(root, 'C17-rudder-mount', [0, 7.45, -15.8]),
    rud = group(rudMount, 'C17-rudder');
  rudMount.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    new T.Vector3(0, 8.25, -7.54).normalize(),
  );
  const inv = new T.Matrix4()
      .compose(rudMount.position, rudMount.quaternion, new T.Vector3(1, 1, 1))
      .invert(),
    rd = detailKit(rud, rud.name);
  const rp = [
    [0, 7.45, -15.8],
    [0, 15.7, -23.34],
    [0, 15.67, -25.5],
    [0, 7.2, -18.6],
  ];
  for (const side of [-1, 1])
    sheet(
      rd,
      rp.map((p) => new T.Vector3(side * 0.12, p[1], p[2]).applyMatrix4(inv).toArray()),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < rp.length; i++) {
    const a = rp[i],
      b = rp[(i + 1) % rp.length];
    const pts = [
      [-0.12, a[1], a[2]],
      [-0.12, b[1], b[2]],
      [0.12, b[1], b[2]],
      [0.12, a[1], a[2]],
    ].map((p) => new T.Vector3(...p).applyMatrix4(inv).toArray());
    const n = new T.Vector3(...pts[1])
      .sub(new T.Vector3(...pts[0]))
      .cross(new T.Vector3(...pts[3]).sub(new T.Vector3(...pts[0])));
    sheet(rd, pts, paint, n.toArray());
  }
  rd.finish();
  bindings.push({
    node: rud.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.4,
  });
  const hs = [
    [0.3, 15.55, -18.4, -24.1, 0.22],
    [9.906, 15.13, -24.0, -26.12, 0.08],
  ];
  for (const side of [-1, 1]) {
    wing(
      d,
      hs.map(([x, y, le, te, h]) => [side * x, y, le, le + (te - le) * 0.72, h]),
      paint,
    );
    hinged(
      root,
      `C17-elevator-${side}`,
      hs.map(([x, y, le, te, h]) => [side * x, y, le + (te - le) * 0.72, te, h * 0.3]),
      paint,
      bindings,
      'pitchInput',
      side * 0.32,
    );
  }
  ellipsoid(d, [0, 15.76, -22.2], [0.45, 0.48, 4.3], paint, 20);
  // Four F117 nacelles. Hollow lips, recessed fan/spinner, core exit and high pylons.
  for (const [i, x] of [14.22, 7.57, -7.57, -14.22].entries()) {
    const outer = Math.abs(x) > 10,
      front = outer ? 11.92 : 15.93,
      cy = outer ? 3.73 : 4.13,
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
        [front, 1.3],
        [front - 0.18, 1.41],
        [front - 1.2, 1.47],
        [front - 3.8, 1.25],
        [front - 4.75, 0.93],
      ].map(([z, r]) => ring(z, r)),
      paint,
      { caps: false },
    );
    loft(d, [ring(front, 1.3), ring(front - 0.13, 1.18), ring(front - 0.75, 1.14)], metal, {
      caps: false,
    });
    loft(d, [ring(front - 0.74, 1.14), ring(front - 1.0, 1.07)], dark, { caps: false });
    d.add(new T.CircleGeometry(1.14, 32), dark, [x, cy, front - 1.05]);
    const fan = group(root, `C17-engine-fan-${i + 1}`, [x, cy, front - 0.9]),
      fd = detailKit(fan, fan.name);
    for (let j = 0; j < 24; j++) {
      const a = (j * Math.PI) / 12,
        at = (r, off = 0) => [Math.sin(a + off) * r, Math.cos(a + off) * r, 0];
      sheet(fd, [at(0.28), at(1.1, 0.18), at(1.1, 0.25), at(0.28, 0.14)], metal, [0, 0, 1]);
    }
    ellipsoid(fd, [0, 0, 0.12], [0.3, 0.3, 0.48], dark, 16);
    fd.finish();
    rotors.push({ node: fan.name, axis: 'z', multiplier: 1, engine: id });
    const rear = front - 4.8;
    loft(d, [ring(rear, 0.93), ring(rear - 0.22, 0.82), ring(rear - 0.45, 0.63)], metal, {
      caps: false,
    });
    d.add(new T.CircleGeometry(0.63, 24).rotateY(Math.PI), dark, [x, cy, rear - 0.46]);
    ellipsoid(d, [x, cy, rear - 0.2], [0.3, 0.3, 0.6], dark, 16);
    const [, wy, le, te] = station(Math.abs(x));
    for (const sign of [-1, 1])
      sheet(
        d,
        [
          [x + sign * 0.16, cy + 0.65, rear + 0.35],
          [x + sign * 0.16, wy + 0.1, te + 0.1],
          [x + sign * 0.16, wy + 0.1, le + 0.5],
          [x + sign * 0.16, cy + 1.2, front - 1.5],
        ],
        paint,
        [sign, 0, 0],
      );
    for (const z of [front - 0.4, front - 2.7, front - 3.8])
      d.ring(z === front - 3.8 ? 1.255 : 1.42, 0.009, [x, cy, z], seam);
    enginePoints.push({ id, position: [x, cy, front - 2.5] });
  }
  const wheel = (dd, x, y, z, r, w) => {
    dd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), rubber, [x, y, z]);
    for (const side of [-1, 1]) {
      dd.add(new T.CylinderGeometry(r * 0.56, r * 0.56, 0.02, 16).rotateZ(Math.PI / 2), metal, [
        x + side * (w / 2 + 0.008),
        y,
        z,
      ]);
      dd.ring(r * 0.82, 0.012, [x + side * (w / 2 + 0.012), y, z], dark, 'x');
    }
  };
  for (const side of [-1, 1]) {
    const g = group(root, `C17-main-gear-${side}`, [side * 4.35, 0, 4.31]),
      dd = detailKit(g, g.name);
    for (const z of [-1.23, 1.23]) {
      for (const x of [-0.6, 0, 0.6]) wheel(dd, x, 0.59, z, 0.59, 0.42);
      dd.rod([-0.62, 0.59, z], [0.62, 0.59, z], 0.11, metal);
      dd.rod([0, 0.7, z], [0, 2.1, z + 0.1], 0.1, metal);
      dd.rod([0, 1.1, z], [side * -0.7, 1.7, z + 0.5], 0.065, metal);
    }
    dd.box([0.045, 0.75, 4.6], [side * 0.84, 1.35, 0], paint);
    dd.finish();
    bindings.push(
      { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -1.6, offset: 1.6 },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  const ng = group(root, 'C17-nose-gear', [0, 0, 23.15]),
    nd = detailKit(ng, ng.name);
  for (const side of [-1, 1]) {
    wheel(nd, side * 0.32, 0.44, 0, 0.44, 0.28);
    nd.rod([side * 0.18, 0.44, 0], [side * 0.15, 1.08, 0.18], 0.055, metal);
    nd.box([0.03, 0.44, 1.7], [side * 0.53, 1.32, -0.14], paint);
  }
  nd.rod([0, 0.8, 0.1], [0, 2, -0.1], 0.08, metal);
  nd.rod([0, 1.2, 0], [0, 1.7, -1.15], 0.055, metal);
  nd.finish();
  bindings.push(
    { node: ng.name, source: 'gear', property: 'position', axis: 'y', scale: -1.6, offset: 1.6 },
    { node: ng.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
  );
  // Closed cargo ramp outline; side doors and maintenance features stay modest at distance.
  for (const side of [-1, 1])
    outline(
      d,
      [
        [side * 2.75, 0.85, -1.6],
        [side * 2.68, 2.1, -7.5],
        [side * 1.78, 4.3, -14.7],
        [side * 0.9, 5.7, -19.4],
      ],
      0.02,
      seam,
      false,
    );
  d.rod([-2.75, 0.85, -1.6], [2.75, 0.85, -1.6], 0.022, metal);
  for (const z of [15, 5, -5])
    sheet(
      d,
      [
        [0.025, 7.3, z + 0.3],
        [0.025, 7.8, z - 0.05],
        [0.025, 7.3, z - 0.35],
      ],
      dark,
      [1, 0, 0],
    );
  ellipsoid(d, [0, 7.32, 10.5], [0.13, 0.09, 0.18], d.red, 12);
  for (const side of [-1, 1]) {
    // Exterior operator identifiers are supplied by the selected livery.
    d.text('NO STEP', [side * 4.6, 2.65, 7], 0.08, (side * Math.PI) / 2, dark);
  }
  d.finish();
  const interior = cockpit(root, { paint, dark, metal, glass });
  cleanGeometry(root);
  return {
    root,
    frame: c17Frame(),
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
    d = detailKit(cabin, 'C17-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'C17'),
    { bindings, derived, ink, black, amber } = ins;
  const face = mat('C17-panel', '#8b9490', { side: T.DoubleSide }),
    liner = mat('C17-liner', '#a1aaa3', { side: T.DoubleSide }),
    seat = mat('C17-seat-blue', '#546f7c'),
    cushion = mat('C17-seat-cushion', '#807f73'),
    belt = mat('C17-harness', '#a0b7bc'),
    green = mat('C17-green-display', '#7bcda5', { emissive: '#285c42', emissiveIntensity: 0.5 });
  const sources = Object.fromEntries(
    ['airspeed', 'pitch', 'roll', 'yaw', 'verticalSpeed', 'gearPosition', 'flapPosition'].map(
      (k) => [
        { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
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
  // Layout coordinates sampled from Landmark9254's 2012 photograph. Width2.70m is estimated.
  const px = (u) => ((955 - u) * 2.7) / 1440,
    py = (v) => 5.16 + ((690 - v) * 2.7) / 1440,
    z = 23.38,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const contour = [
    [235, 780],
    [235, 570],
    [430, 565],
    [430, 554],
    [1450, 554],
    [1450, 565],
    [1665, 570],
    [1665, 780],
    [1100, 780],
    [1100, 815],
    [780, 815],
    [780, 780],
  ].map(([u, v]) => at(u, v));
  const screens = [
    { u: 530, v: 684, w: 160, h: 156, kind: 'pilot' },
    { u: 867, v: 660, w: 158, h: 146, kind: 'engine' },
    { u: 1038, v: 659, w: 158, h: 146, kind: 'systems' },
    { u: 1363, v: 676, w: 160, h: 150, kind: 'copilot' },
  ];
  const holes = screens.map((a) =>
    rect(px(a.u), py(a.v), (a.w * 2.7) / 1440, (a.h * 2.7) / 1440, z),
  );
  for (const u of [662, 1230])
    holes.push(
      Array.from({ length: 32 }, (_, j) => [
        px(u) + Math.cos((j * Math.PI) / 16) * 0.058,
        py(661) + Math.sin((j * Math.PI) / 16) * 0.058,
        z,
      ]),
    );
  sheet(d, contour, face, [0, 0, -1], holes);
  outline(d, contour, 0.015, m.dark);
  for (const a of screens) {
    const x = px(a.u),
      y = py(a.v),
      w = (a.w * 2.7) / 1440,
      h = (a.h * 2.7) / 1440;
    sheet(
      d,
      rect(x, y, w + 0.035, h + 0.035, z - 0.007),
      m.dark,
      [0, 0, -1],
      [rect(x, y, w, h, z - 0.007)],
    );
    for (let j = 0; j < 7; j++)
      d.box(
        [0.015, 0.011, 0.009],
        [x + w * 0.42 - j * w * 0.14, y - h / 2 - 0.018, z - 0.017],
        m.dark,
      );
    pt.knob(x + w / 2 - 0.02, y - h / 2 + 0.02, z - 0.018, 0.013);
    if (a.kind === 'pilot' || a.kind === 'copilot') {
      const g = group(cabin, `C17-${a.kind}-display`, [x, y, z + 0.016]),
        dd = detailKit(g, g.name),
        ii = instrumentGeometry(g, `C17-${a.kind}`);
      ii.horizon('horizon', [0, 0.047, 0], 0.19, 0.15, { blankBackdrop: true });
      sheet(dd, rect(0, 0, w, h, -0.012), black, [0, 0, -1], [rect(0, 0.047, 0.19, 0.15, -0.012)]);
      ii.readout('speed', [0.126, 0.052, -0.019], 'knots', 3, 0.01, ink, false, true);
      dd.text('TAS', [0.126, 0.094, -0.02], 0.007, Math.PI, ink, 'display');
      ii.readout('altitude', [-0.126, 0.052, -0.019], 'feet', 5, 0.008, ink, true, true);
      dd.text('GEO FT', [-0.126, 0.094, -0.02], 0.006, Math.PI, ink, 'display');
      const rose = group(g, `C17-${a.kind}-heading`, [0, -0.081, -0.019]),
        rr = detailKit(rose, rose.name);
      for (let deg = 0; deg < 360; deg += 10) {
        const a = (deg * Math.PI) / 180,
          p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
        rr.rod(p(deg % 30 ? 0.042 : 0.038), p(0.047), 0.0007, ink);
        if (deg % 30 === 0)
          rr.text(
            deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
            p(0.029),
            0.006,
            Math.PI,
            ink,
          );
      }
      rr.finish();
      ii.bindings.push({
        node: rose.name,
        source: 'trueHeading',
        property: 'rotation',
        axis: 'z',
        scale: -1,
        period: 2 * Math.PI,
        responseSeconds: 0.15,
      });
      ii.available('heading', 'trueHeading', rose.name);
      dd.rod([0, -0.026, -0.02], [0, -0.036, -0.02], 0.001, amber);
      dd.text('TRUE', [0, -0.012, -0.02], 0.006, Math.PI, ink, 'display');
      ii.readout('vertical', [-0.117, -0.079, -0.018], 'verticalFpm', 4, 0.008, ink, true, true);
      dd.text('FPM', [-0.117, -0.112, -0.02], 0.006, Math.PI, ink);
      dd.text('SIM', [0.12, -0.09, -0.02], 0.007, Math.PI, green, 'display');
      dd.finish();
      bindings.push(...ii.bindings);
      Object.assign(derived, ii.derived);
    } else {
      sheet(d, rect(x, y, w, h, z + 0.007), black, [0, 0, -1]);
      if (a.kind === 'engine') {
        d.text('SIM RPM', [x, y + h * 0.43, z], 0.012, Math.PI, green, 'display');
        for (let i = 0; i < 4; i++) {
          const source = `engine${i + 1}`,
            value = `rpmPercent${i + 1}`;
          sources[source] = {
            component: 'aircraftState',
            path: ['engines', `engine-${i + 1}`, 'rpm'],
          };
          derived[value] = { op: 'multiply', args: [source, 100] };
          const xx = x + 0.103 - i * 0.069;
          d.text(String(i + 1), [xx, y + 0.087, z], 0.009, Math.PI, ink);
          ins.dial(
            `rpm-${i + 1}`,
            [xx, y + 0.039, z],
            0.026,
            value,
            [
              [0, -2.2],
              [110, 2.2],
            ],
            [0, 100],
            'RPM',
            { material: green, responseSeconds: 0.15 },
          );
          for (let row = 0; row < 2; row++) {
            d.add(new T.RingGeometry(0.019, 0.02, 18).rotateY(Math.PI), green, [
              xx,
              y - 0.03 - row * 0.048,
              z,
            ]);
            d.text('--', [xx, y - 0.03 - row * 0.048, z - 0.002], 0.008, Math.PI, green);
          }
        }
        d.text('EPR N2 EGT --', [x, y - 0.12, z], 0.009, Math.PI, green);
      } else {
        d.text('FLIGHT CONTROLS', [x, y + 0.115, z], 0.01, Math.PI, green);
        ins.dial(
          'flaps',
          [x, y + 0.02, z],
          0.054,
          'flapPosition',
          [
            [0, -2],
            [1, 2],
          ],
          [0, 0.5, 1],
          'FLAP',
          { material: green },
        );
        const lamps = group(cabin, 'C17-gear-down', [x, y - 0.075, z]),
          ld = detailKit(lamps, lamps.name);
        for (const xx of [-0.04, 0, 0.04])
          ld.box([0.016, 0.018, 0.003], [xx, xx === 0 ? 0.028 : 0, 0], green);
        ld.finish();
        bindings.push({
          node: lamps.name,
          source: 'gearDown',
          property: 'visible',
          scale: 1,
          missing: 'hide',
        });
        d.text('GEAR', [x, y - 0.111, z], 0.009, Math.PI, green);
      }
    }
  }
  for (const [side, u] of [
    [1, 662],
    [-1, 1230],
  ]) {
    ins.horizon(`standby-${side}`, at(u, 661, 0.018), 0.116, 0.116, {
      round: true,
      blankBackdrop: true,
    });
    ins.altimeter(`altimeter-${side}`, at(u, 728, -0.008), 0.05, 'feet');
  }
  ins.dial(
    'airspeed',
    at(395, 717, -0.008),
    0.047,
    'knots',
    [
      [0, -2.4],
      [100, -1.4],
      [250, 0.3],
      [450, 2.4],
    ],
    [0, 100, 200, 300, 400],
    'TAS',
  );
  ins.dial(
    'vertical',
    at(1484, 717, -0.008),
    0.047,
    'verticalFpm',
    [
      [-6000, -2.3],
      [0, 0],
      [6000, 2.3],
    ],
    [-6000, 0, 6000],
    'FPM',
  );
  // Separate glareshield: AFCS controls between two radio-management modules, four fire handles above.
  d.box([2.7, 0.18, 0.29], [0, 5.535, 23.4], m.dark);
  for (const u of [689, 1242]) {
    const x = px(u);
    d.box([0.285, 0.195, 0.022], [x, 5.59, 23.228], face);
    d.box([0.19, 0.14, 0.008], [x + 0.015, 5.595, 23.212], black);
    d.text('COM --', [x + 0.015, 5.6, 23.205], 0.013, Math.PI, green, 'display');
    for (let row = 0; row < 5; row++)
      for (const dx of [-0.115, 0.115])
        d.box([0.016, 0.013, 0.007], [x + dx, 5.65 - row * 0.029, 23.202], m.dark);
    pt.knob(x - 0.12, 5.535, 23.198, 0.014);
  }
  d.box([0.72, 0.18, 0.025], [0, 5.59, 23.227], m.dark);
  for (const [u, v] of [
    [802, 522],
    [859, 532],
    [890, 526],
    [916, 526],
    [953, 526],
    [1001, 525],
    [1093, 522],
    [1127, 520],
  ])
    pt.knob(px(u), 5.59 + (526 - v) * 0.001, 23.205, 0.017);
  for (let j = 0; j < 11; j++)
    d.box([0.025, 0.023, 0.009], [0.29 - j * 0.055, 5.53, 23.201], m.dark);
  for (const [x, label] of [
    [0.25, 'SPD'],
    [0.08, 'HDG'],
    [-0.11, 'VS'],
    [-0.27, 'ALT'],
  ]) {
    d.box([0.12, 0.03, 0.006], [x, 5.652, 23.209], black);
    d.text('--', [x, 5.652, 23.203], 0.011, Math.PI, ink);
    d.text(label, [x, 5.623, 23.2], 0.009, Math.PI, ink);
  }
  for (let i = 0; i < 4; i++) {
    const x = 0.27 - i * 0.18;
    d.box([0.16, 0.055, 0.035], [x, 5.73, 23.23], face);
    d.box([0.137, 0.033, 0.015], [x, 5.73, 23.205], ins.red);
    d.text(String(i + 1), [x, 5.73, 23.195], 0.014, Math.PI, ink);
  }
  for (const u of [373, 1493, 716, 1154]) {
    d.box([0.08, 0.065, 0.012], at(u, 604, -0.02), black);
    for (let j = 0; j < 4; j++) d.box([0.024, 0.009, 0.008], at(u, 630 + j * 9, -0.024), m.dark);
  }
  for (const u of [809, 852, 1098])
    ins.dial(
      `aux-${u}`,
      at(u, 774, -0.013),
      0.025,
      'unavailable',
      [
        [0, -2],
        [1, 2],
      ],
      [],
      '--',
    );
  sheet(d, rect(px(952), py(783), 0.22, 0.11, z - 0.014), black, [0, 0, -1]);
  d.text('SYSTEMS --', at(952, 783, -0.018), 0.011, Math.PI, green, 'display');
  // HUDs are physical projector/combiner assemblies. Collimated symbology is not simulated.
  for (const side of [-1, 1]) {
    const x = side * 0.87;
    // The projector is suspended above the combiner, clear of the pilot's eye line.
    d.box([0.33, 0.055, 0.25], [x, 5.94, 23.12], m.dark);
    d.box([0.26, 0.014, 0.19], [x, 5.905, 23.12], black);
    const pts = [
      [x - 0.14, 5.27, 23.12],
      [x + 0.14, 5.27, 23.12],
      [x + 0.165, 5.83, 23.3],
      [x - 0.165, 5.83, 23.3],
    ];
    sheet(d, pts, m.glass, [0, 1, -1]);
    outline(d, pts, 0.009, m.dark);
    for (const dx of [-0.18, 0.18]) {
      d.rod([x + dx, 5.53, 23.2], [x + dx, 5.83, 23.3], 0.012, m.dark);
      d.rod([x + dx, 5.83, 23.3], [x + dx, 5.94, 23.12], 0.01, m.dark);
    }
  }
  const ped = group(cabin, 'C17-center-console', [0, 4.63, 22.28]);
  ped.rotation.x = Math.PI / 2;
  const td = detailKit(ped, ped.name),
    tp = panelTools(td);
  beveledBox(td, [0.76, 2.05, 0.28], [0, 0, 0.1], face);
  for (const x of [-0.245, 0.245]) {
    td.box([0.23, 0.29, 0.024], [x, 0.61, -0.056], black);
    td.text('CNI --', [x, 0.64, -0.071], 0.017, Math.PI, green, 'display');
    td.box([0.23, 0.24, 0.025], [x, 0.15, -0.056], black);
    td.text('FMS --', [x, 0.17, -0.072], 0.016, Math.PI, green);
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 5; col++)
        td.box(
          [0.025, 0.024, 0.008],
          [x - 0.08 + col * 0.04, -0.035 - row * 0.037, -0.062],
          m.dark,
        );
    for (let j = 0; j < 5; j++) tp.knob(x - 0.09 + j * 0.045, -0.31, -0.078, 0.012);
  }
  for (let i = 0; i < 4; i++) {
    const x = 0.105 - i * 0.07;
    td.box([0.023, 0.58, 0.01], [x, 0.35, -0.055], black);
    const g = group(ped, `C17-throttle-${i + 1}`, [x, 0.25, -0.08]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.08, -0.2], 0.015, m.metal);
    beveledBox(dd, [0.062, 0.048, 0.045], [0, 0.08, -0.2], m.dark);
    dd.text(String(i + 1), [0, 0.08, -0.224], 0.012, Math.PI, ink);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.7,
      offset: -0.16,
    });
  }
  const flap = group(ped, 'C17-flap-lever', [-0.12, -0.47, -0.075]),
    fd = detailKit(flap, flap.name);
  fd.rod([0, 0, 0], [0, 0.05, -0.14], 0.011, m.metal);
  fd.box([0.065, 0.025, 0.035], [0, 0.05, -0.14], ink);
  fd.finish();
  bindings.push({
    node: flap.name,
    source: 'flapPosition',
    property: 'rotation',
    axis: 'x',
    scale: -0.62,
  });
  for (const yy of [-0.62, -0.84]) {
    td.box([0.65, 0.16, 0.025], [0, yy, -0.054], m.dark);
    for (let j = 0; j < 7; j++) tp.knob(-0.27 + j * 0.09, yy, -0.08, 0.013);
  }
  td.text('C-17A', [0, -0.95, -0.072], 0.02, Math.PI, ink);
  td.finish();
  // Broad overhead, physically partitioned into electrical, fuel, hydraulic and lighting banks.
  const over = group(cabin, 'C17-overhead', [0, 6.64, 22.63]);
  over.rotation.x = -Math.PI / 2;
  const od = detailKit(over, over.name),
    op = panelTools(od);
  beveledBox(od, [1.22, 1.54, 0.09], [0, 0, 0.02], m.dark);
  for (const [label, x, y, w, h] of [
    ['ELEC', 0.34, 0.4, 0.45, 0.42],
    ['FUEL', -0.2, 0.38, 0.54, 0.45],
    ['HYD', 0.34, -0.1, 0.45, 0.4],
    ['AIR', -0.2, -0.1, 0.54, 0.4],
    ['LIGHT', 0.28, -0.54, 0.53, 0.33],
    ['ICE', -0.3, -0.54, 0.5, 0.33],
  ]) {
    outline(od, rect(x, y, w, h, -0.035), 0.004, ink);
    od.text(label, [x, y + h / 2 - 0.035, -0.044], 0.017, Math.PI, ink);
    for (let col = 0; col < 4; col++)
      for (let row = 0; row < 2; row++) {
        const xx = x - w * 0.34 + col * w * 0.225,
          yy = y + 0.065 - row * 0.14;
        if ((col + row) % 3 === 0) op.knob(xx, yy, -0.05, 0.021);
        else {
          od.box([0.055, 0.028, 0.008], [xx, yy, -0.042], black);
          od.rod([xx, yy, -0.046], [xx, yy + 0.015, -0.083], 0.005, m.metal);
        }
      }
  }
  od.finish();
  const breakers = group(cabin, 'C17-circuit-breakers', [0, 6.69, 21.55]);
  breakers.rotation.x = -Math.PI / 2;
  const bd = detailKit(breakers, breakers.name);
  bd.box([1.18, 0.5, 0.055], [0, 0, 0], face);
  for (let row = 0; row < 5; row++) {
    bd.box([1.1, 0.065, 0.01], [0, -0.2 + row * 0.1, -0.033], black);
    for (let col = 0; col < 17; col++)
      bd.add(new T.CylinderGeometry(0.009, 0.009, 0.016, 6).rotateX(Math.PI / 2), m.dark, [
        -0.51 + col * 0.064,
        -0.2 + row * 0.1,
        -0.047,
      ]);
  }
  bd.finish();
  // Two short control sticks, rudder pedals, blue seat shells and contrasting cushions.
  for (const side of [-1, 1]) {
    const x = side * 0.87;
    const sg = group(cabin, `C17-stick-${side}`, [x, 4.62, 22.86]),
      sd = detailKit(sg, sg.name);
    sd.box([0.17, 0.24, 0.19], [0, 0.05, 0], m.dark);
    sd.rod([0, 0.13, 0], [0, 0.47, -0.055], 0.024, m.metal);
    beveledBox(sd, [0.075, 0.18, 0.085], [0, 0.49, -0.06], m.dark);
    sd.box([0.07, 0.028, 0.04], [0, 0.58, -0.04], m.dark);
    ellipsoid(sd, [0.025, 0.57, -0.108], [0.012, 0.014, 0.007], ins.red, 8);
    sd.finish();
    bindings.push(
      { node: sg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.2 },
      { node: sg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.2 },
    );
    for (const dx of [-0.16, 0.16]) {
      const pg = group(cabin, `C17-pedal-${side}-${Math.sign(dx)}`, [x + dx, 4.39, 23.55]),
        pd = detailKit(pg, pg.name);
      pd.box([0.19, 0.085, 0.15], [0, 0, 0], m.dark);
      for (let j = 0; j < 5; j++)
        pd.rod([-0.08, 0.047, -0.06 + j * 0.027], [0.08, 0.047, -0.06 + j * 0.027], 0.004, m.metal);
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: Math.sign(dx) * 0.055,
      });
    }
    for (const zz of [22.1, 20.6]) {
      const sx = zz < 21 ? side * 1.03 : x;
      for (const dx of [-0.22, 0.22])
        d.rod([sx + dx, 4.33, zz - 0.45], [sx + dx, 4.33, zz + 0.45], 0.025, m.metal);
      d.box([0.44, 0.3, 0.5], [sx, 4.5, zz], m.metal);
      beveledBox(d, [0.63, 0.16, 0.64], [sx, 4.75, zz], cushion, 0.035);
      const back = group(cabin, `C17-seat-${side}-${zz < 21 ? 'observer' : 'pilot'}`, [
        sx,
        5.21,
        zz - 0.32,
      ]);
      back.rotation.x = -0.08;
      const dd = detailKit(back, back.name);
      beveledBox(dd, [0.64, 0.82, 0.18], [0, 0, 0], seat, 0.035);
      beveledBox(dd, [0.5, 0.64, 0.04], [0, -0.02, 0.11], cushion, 0.018);
      beveledBox(dd, [0.46, 0.25, 0.18], [0, 0.5, 0], seat, 0.025);
      for (const dx of [-0.17, 0.17])
        dd.rod([dx, 0.49, 0.115], [dx * 0.4, -0.36, 0.15], 0.025, belt);
      dd.finish();
      for (const dx of [-0.34, 0.34])
        beveledBox(d, [0.07, 0.08, 0.42], [sx + dx, 5.03, zz - 0.06], seat, 0.014);
      d.rod([sx - 0.28, 4.84, zz - 0.15], [sx + 0.23, 4.84, zz + 0.15], 0.025, belt);
      d.box([0.08, 0.027, 0.06], [sx, 4.86, zz], m.metal);
    }
    d.box([0.2, 0.4, 2.3], [side * 1.6, 4.68, 22.24], face);
    d.box([0.15, 0.2, 0.22], [side * 1.53, 4.99, 22.39], black);
    d.rod([side * 1.54, 5.08, 22.47], [side * 1.51, 4.89, 22.54], 0.014, m.dark);
  }
  d.box([3.4, 0.07, 4.4], [0, 4.28, 21.55], m.dark);
  sheet(d, rect(0, 4.95, 4.4, 3.0, 19.2), liner, [0, 0, 1], [rect(-1.35, 4.4, 0.8, 1.7, 19.2)]);
  for (let j = 0; j < 7; j++)
    d.box([0.76, 0.08, 0.27], [-1.35, 4.1 - j * 0.34, 19.08 - j * 0.26], m.dark);
  d.box([5.4, 0.05, 22], [0, 2.22, 3.5], liner);
  d.finish();
  // Both flight displays and duplicate standby altitude instruments share one expression graph.
  for (const b of bindings)
    b.source = b.source
      .replace('C17-copilot.', 'C17-pilot.')
      .replace('C17.altimeter--1-', 'C17.altimeter-1-');
  for (const key of Object.keys(derived))
    if (key.startsWith('C17-copilot.') || key.startsWith('C17.altimeter--1-')) delete derived[key];
  cabin.position.y = -0.5;
  return { nodes: ['cockpit'], sources, derived, bindings };
}
