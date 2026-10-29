/** CH-47F: dimensioned OPF00001 drawing and US Army CAAS cockpit photographs.
 * Tandem hub spacing, 60-foot rotors and ramp/sponson contours are authored here.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { glassDisplay } from './glass-display.mjs';
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
export const ch47Frame = () => ({
  heli: true,
  fighter: false,
  large: true,
  radius: 1.27,
  cy: 1.9,
  ry: 1.25,
  cabinZ: 6.12,
  cabinWidth: 2.25,
  eye: [-0.57, 2.3, 6.02],
  panelZ: 6.72,
  floor: 1.15,
  mainRotorPosition: [0, 4.03, 5.9309],
});
export function buildCH47(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('CH47-olive', '#666951', { side: T.DoubleSide }),
    trim = mat('CH47-trim', '#252c2a'),
    metal = mat('CH47-metal', '#979c93', { metalness: 0.6 }),
    rubber = mat('CH47-tires', '#222725'),
    glass = mat('CH47-glass', '#a1bcc3', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'CH47-shell');
  const measured = [
    [7.62, 0.14, 1.34, 1.65],
    [7.45, 0.56, 1.1, 1.98],
    [7.12, 0.88, 0.9, 2.15],
    [6.72, 1.04, 0.78, 2.25],
    [6.06, 1.18, 0.72, 3.04],
    [5.35, 1.27, 0.7, 3.24],
    [3.8, 1.27, 0.68, 3.25],
    [-4.5, 1.27, 0.68, 3.25],
    [-6.1, 1.15, 0.85, 3.25],
    [-7.25, 0.93, 1.51, 3.24],
    [-7.8486, 0.6, 2.25, 2.94],
  ];
  const ring = ([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.65, t - 0.07],
      [w, t - 0.34],
      [w, b + 0.49],
      [w * 0.66, b],
      [0, b - 0.05],
      [-w * 0.66, b],
      [-w, b + 0.49],
      [-w, t - 0.34],
      [-w * 0.65, t - 0.07],
    ],
  });
  const rings = measured.map(ring),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  const skip = (i, j) =>
    (i === 3 && [0, 1, 8, 9].includes(j)) ||
    ([2, 3, 4, 5, 6].includes(i) && [2, 7].includes(j)) ||
    (i === 4 && [0, 9].includes(j)) ||
    (i === 2 && [3, 6].includes(j));
  loft(d, rings, paint, { skip });
  const lining = mat('CH47-cockpit-lining', '#666e69', { side: T.DoubleSide });
  const inset = (q) => [q[0] * 0.987, 1.8 + (q[1] - 1.8) * 0.987, q[2]];
  loft(
    d,
    rings
      .slice(0, 7)
      .map((r) => ({ z: r.z, points: r.points.map((q) => inset([...q, r.z]).slice(0, 2)) })),
    lining,
    { skip, caps: false },
  );
  // Three forward panes; the central pane is broader than the narrow structural posts.
  for (const j of [0, 1, 8, 9])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 10), p(3, (j + 1) % 10), glass, [0, 1, 1]);
  const front = [
    p(3, 8),
    p(4, 8),
    p(4, 9),
    p(4, 0),
    p(4, 1),
    p(4, 2),
    p(3, 2),
    p(3, 1),
    p(3, 0),
    p(3, 9),
  ];
  outline(d, front, 0.021, paint);
  for (const side of [-1, 1]) {
    const a = [side * 0.35, 2.24, 6.72],
      b = [side * 0.39, 3.025, 6.06];
    d.rod(a, b, 0.034, paint);
    d.rod([side * 0.66, 2.24, 6.72], [side * 0.57, 2.72, 6.31], 0.012, trim);
  }
  for (const j of [0, 9]) {
    const a = p(4, j),
      b = p(5, j),
      c = p(5, (j + 1) % 10),
      e = p(4, (j + 1) % 10),
      q = (u, v) =>
        a.map((_, k) => (a[k] * (1 - u) + b[k] * u) * (1 - v) + (e[k] * (1 - u) + c[k] * u) * v),
      h = [
        [0.13, 0.23],
        [0.87, 0.23],
        [0.87, 0.88],
        [0.13, 0.88],
      ].map(([u, v]) => q(u, v));
    sheet(d, [a, b, c, e], paint, [0, 1, 0], [h]);
    sheet(d, h, glass, [0, 1, 0]);
    outline(d, h, 0.015, trim);
  }
  const sx = (z, side) => {
    const i = measured.findIndex(
      (a, i) => i < measured.length - 1 && z <= a[0] && z >= measured[i + 1][0],
    );
    if (i < 0) return side * 1.27;
    const a = measured[i],
      b = measured[i + 1],
      u = (a[0] - z) / (a[0] - b[0]);
    return side * (a[1] * (1 - u) + b[1] * u);
  };
  for (const side of [-1, 1]) {
    const q = (z, y) => [sx(z, side), y, z],
      j = side > 0 ? 2 : 8,
      k = side > 0 ? 3 : 7;
    const windows = [
      [
        [7.03, 1.73],
        [6.76, 1.85],
        [6.68, 1.9],
        [6.68, 1.34],
        [6.88, 1.35],
      ],
      [
        [6.6, 2.04],
        [6.02, 2.69],
        [5.55, 2.84],
        [5.55, 2.02],
        [6.6, 1.99],
      ],
      [
        [6.6, 1.9],
        [5.55, 1.9],
        [5.55, 1.25],
        [6.24, 1.28],
        [6.6, 1.4],
      ],
      [
        [5.42, 2.86],
        [4.87, 2.86],
        [4.87, 2.07],
        [5.42, 2.07],
      ],
    ].map((a) => a.map(([z, y]) => q(z, y)));
    for (const z of [3.88, 1.83, -0.22, -2.27, -4.32])
      windows.push(
        Array.from({ length: 24 }, (_, i) =>
          q(z + Math.cos((i * Math.PI) / 12) * 0.255, 2.13 + Math.sin((i * Math.PI) / 12) * 0.255),
        ),
      );
    // Clip openings into each planar side section. A single nonplanar polygon
    // with holes extending beyond its contour produced disconnected triangles.
    const clip = (points, dist) => {
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length],
          da = dist(a),
          db = dist(b);
        if (da >= -1e-9) out.push(a);
        if (da < 0 !== db < 0) out.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
      }
      return out;
    };
    for (let station = 2; station < 7; station++) {
      let pieces = [[p(station, j), p(station + 1, j), p(station + 1, k), p(station, k)]];
      for (const hole of windows) {
        const area = hole.reduce((sum, a, i) => {
            const b = hole[(i + 1) % hole.length];
            return sum + a[2] * b[1] - b[2] * a[1];
          }, 0),
          next = [];
        for (const cell of pieces) {
          let inside = cell;
          for (let i = 0; i < hole.length && inside.length; i++) {
            const a = hole[i],
              b = hole[(i + 1) % hole.length];
            const dist = (q) =>
              Math.sign(area) * ((b[2] - a[2]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[2] - a[2]));
            const out = clip(inside, (q) => -dist(q));
            if (out.length >= 3) next.push(out);
            inside = clip(inside, dist);
          }
          if (inside.length >= 3) sheet(d, inside, glass, [side, 0, 0]);
        }
        pieces = next;
      }
      for (const cell of pieces) {
        sheet(d, cell, paint, [side, 0, 0]);
        if (station < 6) sheet(d, cell.map(inset), lining, [-side, 0, 0]);
      }
    }
    for (const h of windows) {
      outline(d, h, 0.018, trim);
    }
    // Lower chin panels look down beside the nose rather than being opaque decals.
    const a = p(2, side > 0 ? 3 : 7),
      b = p(3, side > 0 ? 3 : 7),
      c = p(3, side > 0 ? 4 : 6),
      e = p(2, side > 0 ? 4 : 6),
      cen = [a, b, c, e].reduce((v, p) => v.map((n, k) => n + p[k] / 4), [0, 0, 0]),
      h = [a, b, c, e].map((p) => p.map((n, k) => cen[k] + (n - cen[k]) * 0.78));
    sheet(d, [a, b, c, e], paint, [side, -1, 1], [h]);
    sheet(d, h, glass, [side, -1, 1]);
    outline(d, h, 0.013, trim);
    for (const zz of [5.48, 4.75]) d.rod(q(zz, 1.17), q(zz, 2.92), 0.004, trim);
    outline(
      d,
      [
        [4.56, 1.09],
        [4.56, 2.85],
        [3.38, 2.85],
        [3.38, 1.09],
      ].map(([z, y]) => q(z, y)),
      0.005,
      trim,
    );
    for (const z of [5.48, 4.55, 3.38, 2.7, 0.65, -1.4, -3.45, -4.9])
      for (let i = 0; i < 16; i++)
        d.add(new T.SphereGeometry(0.004, 5, 3), metal, q(z, 1.12 + i * 0.1));
    for (const y of [1.12, 2.73]) d.rod(q(3.3, y), q(-4.5, y), 0.003, trim);
    d.rod(q(5.5, 1.9), q(5.5, 1.74), 0.014, trim);
    d.rod(q(3.6, 1.55), q(3.8, 1.55), 0.016, trim);
    // Integral long lower fuel sponsons, tapering into the nose and rear ramp.
    const sp = group(root, `CH47-sponson-${side}`),
      sd = detailKit(sp, 'sponson');
    const stations = [
      [5.24, 0.14, 1.28],
      [4.45, 0.42, 1.14],
      [3.5, 0.57, 1.07],
      [-4.6, 0.57, 1.07],
      [-5.7, 0.48, 1.23],
      [-6.7, 0.15, 1.67],
    ];
    loft(
      sd,
      stations.map(([z, r, y]) => ({
        z,
        points: Array.from({ length: 20 }, (_, i) => [
          side * 1.28 + Math.sin((i * Math.PI) / 10) * r,
          y + Math.cos((i * Math.PI) / 10) * 0.48,
        ]),
      })),
      paint,
    );
    for (const z of [3.4, 1.35, -0.7, -2.75, -4.5])
      outline(
        sd,
        Array.from({ length: 20 }, (_, i) => [
          side * 1.28 + Math.sin((i * Math.PI) / 10) * 0.575,
          1.07 + Math.cos((i * Math.PI) / 10) * 0.485,
          z,
        ]),
        0.003,
        trim,
      );
    for (const z of [2.95, -1.1, -4.1]) {
      sd.box([0.01, 0.16, 0.2], [side * 1.856, 1.13, z], paint);
      sd.ring(0.054, 0.009, [side * 1.863, 1.17, z], metal, 'x');
    }
    sd.text('UNITED STATES ARMY', [side * 1.86, 1.3, 0.55], 0.12, (side * Math.PI) / 2, trim);
    sd.finish();
    // Forward twin wheels and aft singles: four oleo legs, not a tailwheel layout.
    for (const [z, x, dual] of [
      [1.63, 1.55, true],
      [-5.228, 1.41, false],
    ]) {
      d.rod([side * x, 1.0, z], [side * x, 0.38, z], 0.058, metal);
      d.rod([side * (x - 0.2), 0.91, z + 0.25], [side * x, 0.46, z], 0.032, paint);
      for (const off of dual ? [-0.145, 0.145] : [0])
        wheel(d, [side * x + off, 0.38, z], 0.38, 0.23, rubber, metal, paint);
    }
    d.box([0.06, 0.06, 0.09], [side * 1.3, 2.93, 4.55], side < 0 ? d.green : d.red);
    d.rod([side * 1.6, 0.7, 4.35], [side * 1.6, 0.7, 3.45], 0.026, trim);
    d.rod([side * 1.27, 1.02, 4.35], [side * 1.6, 0.7, 4.35], 0.02, trim);
    d.rod([side * 1.27, 1.02, 3.45], [side * 1.6, 0.7, 3.45], 0.02, trim);
  }
  // Rear loading ramp: rising lower contour and rectangular hatch seams.
  outline(
    d,
    [
      [-0.94, 1.63, -7.2],
      [0.94, 1.63, -7.2],
      [0.64, 2.23, -7.83],
      [-0.64, 2.23, -7.83],
    ],
    0.006,
    trim,
  );
  for (const side of [-1, 1])
    d.rod([side * 0.79, 1.31, -6.85], [side * 0.59, 2.15, -7.76], 0.022, metal);
  const pylon = (z, w, b, t) => ({
    z,
    points: [
      [0, t],
      [w * 0.72, t - 0.07],
      [w, t - 0.27],
      [w, b],
      [-w, b],
      [-w, t - 0.27],
      [-w * 0.72, t - 0.07],
    ],
  });
  loft(
    d,
    [
      pylon(6.55, 0.34, 2.92, 3.22),
      pylon(6.25, 0.66, 3.04, 3.64),
      pylon(5.68, 0.69, 3.15, 3.66),
      pylon(4.6, 0.61, 3.2, 3.44),
      pylon(4.28, 0.51, 3.2, 3.28),
    ],
    paint,
  );
  loft(
    d,
    [
      pylon(-4.0, 0.48, 3.17, 3.35),
      pylon(-4.72, 0.7, 3.19, 4.8),
      pylon(-5.76, 0.73, 3.16, 4.97),
      pylon(-6.72, 0.65, 3.05, 4.91),
      pylon(-7.45, 0.43, 2.87, 4.45),
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    d.box([0.015, 0.25, 0.36], [side * 0.69, 3.43, 5.59], trim);
    for (const z of [-5.0, -6.0, -7.0])
      for (let i = 0; i < 10; i++)
        d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [
          side * (z < -6.5 ? 0.5 : 0.72),
          3.35 + i * 0.125,
          z,
        ]);
    for (let i = 0; i < 8; i++)
      d.box([0.62, 0.045, 0.018], [side * 0.34, 3.52 + i * 0.105, -4.44 - i * 0.033], trim);
    // T55 engine pods are outboard of the rear pylon with forward intake domes.
    const eg = group(root, `CH47-engine-${side}`, [side * 1.35, 3.21, -5.8]),
      ed = detailKit(eg, 'T55');
    loft(
      ed,
      [
        [0.98, 0.25],
        [0.73, 0.47],
        [-0.5, 0.45],
        [-0.94, 0.32],
      ].map(([z, r]) => ({
        z,
        points: Array.from({ length: 20 }, (_, i) => [
          Math.sin((i * Math.PI) / 10) * r,
          Math.cos((i * Math.PI) / 10) * r,
        ]),
      })),
      paint,
      { caps: false },
    );
    ed.add(new T.SphereGeometry(1, 20, 10).scale(0.43, 0.43, 0.19), paint, [0, 0, 0.74]);
    ed.ring(0.38, 0.028, [0, 0, 0.87], trim);
    ed.rod([0, 0, 0.94], [0, 0, 1.43], 0.05, paint);
    ed.add(
      new T.CylinderGeometry(0.31, 0.31, 0.4, 20, 1, true).rotateX(Math.PI / 2),
      metal,
      [0, 0, -0.98],
    );
    ed.add(new T.CircleGeometry(0.29, 20).rotateY(Math.PI), trim, [0, 0, -1.19]);
    ed.ring(0.31, 0.026, [0, 0, -1.19], metal);
    ed.finish();
  }
  d.rod([0, 3.24, 3.1], [0, 3.56, 3.1], 0.018, trim);
  d.rod([0, 3.56, 3.1], [0, 3.56, 2.7], 0.014, trim);
  d.rod([0, 3.25, -1.8], [0, 3.64, -1.9], 0.02, paint);
  d.box([0.065, 0.07, 0.065], [0, 3.31, 1.2], d.red);
  for (const side of [-1, 1]) {
    d.rod([side * 0.4, 1.36, 7.43], [side * 0.8, 1.37, 7.65], 0.012, trim);
    d.ring(0.065, 0.014, [side * 0.55, 1.48, 7.44], paint);
    d.add(new T.CircleGeometry(0.05, 16), glass, [side * 0.55, 1.48, 7.455]);
  }
  // Intermeshing counter-rotating three-bladed heads at published longitudinal spacing.
  for (const [i, z, y] of [
    [0, 5.9309, 4.03],
    [1, -5.9309, 5.24],
  ]) {
    const mast = group(root, `CH47-mast-${i}`, [0, y, z]),
      md = detailKit(mast, 'mast');
    md.rod([0, -0.43, 0], [0, 0, 0], 0.13, metal);
    md.ring(0.37, 0.04, [0, -0.33, 0], trim, 'y');
    md.ring(0.27, 0.035, [0, -0.16, 0], metal, 'y');
    md.finish();
    const rotor = group(mast, `rotor-${i}`),
      rd = detailKit(rotor, 'hub');
    rd.add(new T.SphereGeometry(1, 16, 8).scale(0.3, 0.17, 0.3), metal, [0, 0, 0]);
    for (let b = 0; b < 3; b++) {
      const bg = group(rotor, `CH47-blade-${i}-${b}`),
        bd = detailKit(bg, 'blade');
      bg.rotation.y = (-(90 + b * 120) * Math.PI) / 180;
      bd.rod([0.1, 0, 0], [1.02, 0, 0], 0.07, metal);
      bd.rod([0.25, -0.3, 0.14], [0.83, -0.02, 0.14], 0.025, metal);
      bd.box([0.3, 0.15, 0.35], [0.67, 0, 0], trim);
      wing(
        bd,
        [
          [0.95, 0, 0.4064, -0.4064],
          [7.6, -0.15, 0.4064, -0.4064],
          [9.144, -0.33, 0.38, -0.4],
        ],
        trim,
        0.04,
      );
      bd.box([0.11, 0.015, 0.77], [8.99, -0.29, -0.01], paint);
      bd.finish();
    }
    rd.finish();
  }
  d.finish();
  const interior = cockpit(root, { paint, trim, metal }, rings);
  cleanGeometry(root);
  return {
    root,
    frame: ch47Frame(),
    enginePoints: [],
    visual: {
      rotors: [
        { node: 'rotor-0', axis: 'y', multiplier: 1 },
        { node: 'rotor-1', axis: 'y', multiplier: -1 },
      ],
      gearNodes: [],
      flaps: [],
      ailerons: [],
      animation: { bindings: [] },
      interior,
    },
  };
}
function wheel(d, p, r, w, rubber, metal, paint) {
  d.add(new T.CylinderGeometry(r * 0.85, r * 0.85, w, 24).rotateZ(Math.PI / 2), rubber, p);
  for (const s of [-1, 1]) {
    d.ring(r * 0.82, r * 0.18, [p[0] + s * w * 0.3, p[1], p[2]], rubber, 'x');
    d.add(new T.CylinderGeometry(r * 0.48, r * 0.48, 0.025, 18).rotateZ(Math.PI / 2), paint, [
      p[0] + s * w * 0.52,
      p[1],
      p[2],
    ]);
    d.ring(r * 0.38, 0.012, [p[0] + s * w * 0.57, p[1], p[2]], metal, 'x');
  }
}
function cockpit(root, m, rings) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'CH47-cockpit'),
    bindings = [],
    face = mat('CH47-panel', '#51564f'),
    seat = mat('CH47-seat', '#4f564a'),
    belt = mat('CH47-harness', '#b5b5a2'),
    z = 6.72,
    k = 0.1524 / 104,
    px = (u) => (887 - u) * k,
    py = (v) => 2.04 - (v - 800) * k,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz],
    pt = panelTools(d);
  // Central MFD scale uses Collins' 6x8-inch active display; outer banks retain photo perspective.
  const contour = [
    [370, 817],
    [690, 807],
    [750, 767],
    [1015, 767],
    [1050, 809],
    [1342, 823],
    [1375, 975],
    [1030, 1007],
    [745, 1008],
    [415, 971],
  ].map(([u, v]) => at(u, v));
  sheet(d, contour, face, [0, 0, -1]);
  sheet(
    d,
    contour.map((p) => [p[0], p[1], z + 0.29]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, [b[0], b[1], z + 0.29], [a[0], a[1], z + 0.29], m.trim, [0, 1, 0]);
  }
  const brow = [
    [225, 800],
    [305, 758],
    [465, 723],
    [575, 721],
    [695, 741],
    [842, 742],
    [1015, 739],
    [1135, 719],
    [1254, 722],
    [1430, 764],
    [1490, 806],
  ].map(([u, v]) => at(u, v, -0.015));
  sheet(d, [...brow, ...contour.slice(0, 6).reverse()], m.trim, [0, 0, -1]);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0], b[1] - 0.12, z + 0.38], [a[0], a[1] - 0.12, z + 0.38], m.trim, [0, 1, 0]);
  }
  outline(d, brow, 0.022, m.trim, false);
  for (const [u, v, kind] of [
    [508, 899, 'attitude'],
    [644, 894, 'map'],
    [887, 919, 'engine'],
    [1109, 895, 'map'],
    [1259, 901, 'attitude'],
  ]) {
    const x = px(u),
      y = py(v),
      w = 0.1524,
      h = 0.2032;
    if (kind === 'engine') {
      d.box([w + 0.045, h + 0.055, 0.027], [x, y, z - 0.015], m.trim);
      d.box([w, h, 0.008], [x, y, z - 0.032], d.dark);
      for (let i = 0; i < 6; i++) {
        const a = x + (i - 2.5) * w * 0.12;
        d.box([0.002, 0.088, 0.002], [a, y + 0.018, z - 0.04], d.ivory);
        d.box([0.004, 0.051, 0.002], [a, y + 0.001, z - 0.043], d.green);
      }
      for (let r = 0; r < 3; r++)
        for (const s of [-1, 1]) {
          d.box([0.05, 0.018, 0.003], [x + s * 0.034, y - 0.05 - r * 0.02, z - 0.04], face);
          d.text(
            String(85 + r * 3),
            [x + s * 0.034, y - 0.05 - r * 0.02, z - 0.046],
            0.008,
            Math.PI,
            d.ivory,
          );
        }
    } else glassDisplay(d, x, y, z - 0.023, w, h, kind);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++)
        d.box(
          [0.01, 0.012, 0.012],
          [x + side * (w / 2 + 0.015), y + h * (0.45 - i * 0.128), z - 0.046],
          face,
        );
      for (let i = 0; i < 6; i++)
        d.box(
          [0.01, 0.009, 0.01],
          [x + w * (0.43 - i * 0.172), y + side * (h / 2 + 0.018), z - 0.046],
          face,
        );
    }
    pt.knob(x - w * 0.55, y - h * 0.57, z - 0.053, 0.012);
    if (kind === 'attitude') {
      const g = group(cabin, `CH47-horizon-${u}`, [x, y + 0.035, z - 0.07]),
        dd = detailKit(g, 'horizon');
      dd.box([0.05, 0.0015, 0.001], [0, 0, 0], dd.amber);
      dd.finish();
      bindings.push({ node: g.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 });
    }
  }
  for (const u of [786, 979]) glassDisplay(d, px(u), py(850), z - 0.026, 0.058, 0.06, 'attitude');
  pt.gauge(px(979), py(916), z - 0.02, 0.034, undefined, false);
  pt.knob(px(979), py(980), z - 0.04, 0.014);
  for (const v of [781, 806]) {
    d.box([0.15, 0.027, 0.024], at(885, v, -0.023), m.trim);
    for (let i = 0; i < 7; i++)
      d.box([0.01, 0.004, 0.004], at(839 + i * 16, v - 8, -0.04), i % 2 ? d.amber : d.ivory);
    d.text(`ENG ${v === 781 ? '1' : '2'}`, at(887, v, -0.042), 0.007, Math.PI, d.ivory);
  }
  // Two CDU keypads descend into a broad inclined pedestal, matching the Army photo.
  const pg = group(cabin, 'CH47-pedestal', [0, 1.72, 6.67]);
  pg.rotation.x = -0.64;
  const pd = detailKit(pg, 'pedestal'),
    pp = panelTools(pd);
  beveledBox(pd, [0.57, 0.95, 0.18], [0, -0.44, 0.04], m.trim, 0.015);
  for (const x of [-0.16, 0.16]) {
    pd.box([0.19, 0.12, 0.012], [x, -0.19, -0.063], pd.dark);
    for (let row = 0; row < 5; row++)
      pd.text(
        ['FMS', 'POS 000', 'ALT 1200', 'GS 120', 'ROUTE'][row],
        [x, -0.15 - row * 0.02, -0.072],
        0.008,
        Math.PI,
        pd.green,
      );
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 5; col++) {
        pd.box([0.021, 0.021, 0.01], [x + (col - 2) * 0.027, -0.3 - row * 0.029, -0.067], face);
        pd.text(
          String((row * 5 + col) % 10),
          [x + (col - 2) * 0.027, -0.3 - row * 0.029, -0.075],
          0.007,
          Math.PI,
          pd.ivory,
        );
      }
  }
  for (let row = 0; row < 3; row++)
    for (const x of [-0.19, -0.06, 0.06, 0.19]) {
      pp.knob(x, -0.61 - row * 0.09, -0.065, 0.013);
      pd.text(
        ['COM', 'NAV', 'ADF'][row],
        [x, -0.59 - row * 0.09, -0.072],
        0.007,
        Math.PI,
        pd.ivory,
      );
    }
  pd.finish();
  fittedFloor(d, rings, m.trim, { y: 1.155, front: 7.3, back: -4.8, width: 2.22, thickness: 0.05 });
  const addSeat = (parent, x, y, z, armored = false) => {
    const sd = detailKit(parent, 'CH47-seat');
    beveledBox(sd, [0.5, 0.13, 0.5], [x, y, z], seat);
    beveledBox(sd, [0.5, 0.64, 0.14], [x, y + 0.36, z - 0.23], seat);
    beveledBox(sd, [0.28, 0.19, 0.15], [x, y + 0.76, z - 0.23], seat);
    for (const s of [-1, 1]) {
      sd.rod([x + s * 0.19, y - 0.29, z - 0.15], [x + s * 0.19, y - 0.06, z - 0.15], 0.02, m.metal);
      sheet(
        sd,
        [
          [x + s * 0.18, y + 0.64, z - 0.14],
          [x + s * 0.13, y + 0.64, z - 0.14],
          [x - s * 0.02, y + 0.09, z + 0.18],
          [x + s * 0.02, y + 0.09, z + 0.18],
        ],
        belt,
        [0, 0, 1],
      );
      if (armored)
        beveledBox(sd, [0.025, 0.66, 0.5], [x + s * 0.265, y + 0.28, z - 0.06], m.paint, 0.008);
    }
    sd.box([0.07, 0.035, 0.02], [x, y + 0.1, z + 0.2], m.metal);
    sd.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * 0.57;
    addSeat(cabin, x, 1.49, 5.96, true);
    const cg = group(cabin, `CH47-cyclic-${side}`, [x, 1.16, 6.27]),
      cd = detailKit(cg, 'cyclic');
    outline(
      cd,
      [
        [0, 0, 0],
        [0, 0.29, 0],
        [0, 0.42, -0.17],
        [0, 0.61, -0.17],
      ],
      0.021,
      m.trim,
      false,
    );
    beveledBox(cd, [0.08, 0.17, 0.08], [0, 0.64, -0.17], m.trim, 0.013);
    cd.box([0.024, 0.02, 0.015], [0, 0.7, -0.22], cd.red);
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `CH47-thrust-${side}`, [x + 0.28, 1.3, 5.72]),
      ld = detailKit(lg, 'thrust');
    ld.rod([0, 0, 0], [0, 0.27, 0.4], 0.026, m.trim);
    beveledBox(ld, [0.12, 0.075, 0.18], [0, 0.29, 0.43], m.trim, 0.01);
    for (const u of [-0.035, 0.035]) ld.box([0.02, 0.015, 0.025], [u, 0.34, 0.45], ld.dark);
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const j of [-1, 1]) {
      const g = group(cabin, `CH47-pedal-${side}-${j}`, [x + j * 0.14, 1.27, 6.94]),
        dd = detailKit(g, 'pedal');
      dd.box([0.16, 0.045, 0.1], [0, 0, 0], m.metal);
      dd.rod([0, 0, 0], [0, -0.1, 0.09], 0.016, m.trim);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.04,
      });
    }
  }
  // Cargo cabin uses the observed inward-facing troop benches and exposed ribs.
  for (const z of [4.3, 2.8, 1.3, -0.2, -1.7, -3.2, -4.7]) {
    outline(
      d,
      [
        [-1.12, 1.2, z],
        [-1.12, 2.7, z],
        [-0.8, 3.02, z],
        [0, 3.12, z],
        [0.8, 3.02, z],
        [1.12, 2.7, z],
        [1.12, 1.2, z],
      ],
      0.025,
      face,
      false,
    );
    for (const side of [-1, 1]) {
      const g = group(cabin, `CH47-troop-seat-${side}-${z}`, [side * 0.95, 0, z]);
      g.rotation.y = (side * Math.PI) / 2;
      addSeat(g, 0, 1.48, 0);
    }
  }
  const og = group(cabin, 'CH47-overhead', [0, 3.02, 5.96]),
    od = detailKit(og, 'overhead');
  od.box([0.69, 0.065, 1.47], [0, 0, 0], m.trim);
  for (let r = 0; r < 9; r++)
    for (const x of [-0.24, -0.08, 0.08, 0.24]) {
      od.box([0.13, 0.009, 0.12], [x, -0.038, -0.61 + r * 0.15], face);
      for (const z of [-0.025, 0.025])
        od.rod(
          [x, -0.045, -0.61 + r * 0.15 + z],
          [x, -0.078, -0.6 + r * 0.15 + z],
          0.004,
          r === 3 ? od.red : m.metal,
        );
    }
  for (const x of [-0.15, 0.15]) {
    od.box([0.1, 0.035, 0.15], [x, -0.058, 0.43], m.trim);
    od.rod([x, -0.07, 0.43], [x, -0.12, 0.47], 0.01, m.metal);
  }
  od.finish();
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
