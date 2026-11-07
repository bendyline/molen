/** Late F/A-18C, clean configuration. NATOPS dimensions and FO-5 cockpit.
 * Main axle datum; +Z forward, +X pilot left. See reference-review.json.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';
export const fa18Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.59,
  cy: 2.05,
  ry: 0.58,
  cabinZ: 5.7,
  cabinWidth: 0.82,
  eye: [0, 2.98, 5.7],
  panelZ: 6.65,
  floor: 1.66,
});
// Tables are traced from the NASA TM-4786 three-view at 84.4 px/m, which the 56 ft bar, the 5.38 m
// wheelbase and the 10.5 ft canopy bar all agree on. Its drawn fin stands 5% over the annotated
// 15.3 ft, and a photograph solved from gear and fins shows the same ratio; the annotated NATOPS
// height is kept. Its rear view is not to the same scale, so it sets no heights. The LEX edge comes
// from that photograph: it runs well down the flank, leaving tall body sides under the canopy.
const lookup = (rows, z) => {
  if (z >= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++)
    if (z >= rows[i][0]) {
      const [z0, v0] = rows[i - 1],
        [z1, v1] = rows[i];
      return v1 + ((v0 - v1) * (z - z1)) / (z0 - z1);
    }
  return rows.at(-1)[1];
};
/** Nose to windscreen: z, half-breadth, keel, crown. */
const forebody = [
  [10.9, 0.008, 1.5, 1.53],
  [10.7, 0.131, 1.44, 1.665],
  [10.4, 0.215, 1.371, 1.817],
  [10, 0.31, 1.311, 1.96],
  [9.6, 0.385, 1.294, 2.085],
  [9.15, 0.418, 1.29, 2.205],
  [8.7, 0.446, 1.294, 2.33],
  [8.2, 0.464, 1.3, 2.462],
  [7.8, 0.47, 1.312, 2.57],
];
/** Canopy: z, half-width at the rail, rail height, crown. 10 ft 6 in peak over the seat. */
const canopy = [
  [7.62, 0.025, 2.6, 2.62],
  [7.2, 0.24, 2.6, 2.847],
  [6.8, 0.34, 2.635, 3.026],
  [6.5, 0.39, 2.66, 3.13],
  [6.1, 0.43, 2.705, 3.19],
  [5.7, 0.44, 2.75, 3.2004],
  [5.2, 0.43, 2.811, 3.19],
  [4.8, 0.4, 2.853, 3.165],
  [4.4, 0.33, 2.901, 3.115],
  [4.05, 0.2, 2.96, 3.085],
  [3.8, 0.02, 3.06, 3.075],
];
const breadth = [
  [7.8, 0.47],
  [7.2, 0.5],
  [6.6, 0.53],
  [5.7, 0.565],
  [4.8, 0.59],
  [4, 0.61],
  [3.25, 0.64],
  [2.4, 0.66],
  [1.4, 0.66],
  [-0.8, 0.58],
  [-3.1, 0.42],
  [-5, 0.14],
  [-5.75, 0.03],
];
const keel = [
  [7.8, 1.312],
  [6.4, 1.317],
  [5.2, 1.341],
  [4.4, 1.353],
  [3.6, 1.4],
  [2.8, 1.436],
  [1.4, 1.44],
  [-0.8, 1.5],
  [-3.1, 1.7],
  [-5, 1.9],
  [-5.75, 2.02],
];
/** Dorsal crown aft of the canopy. A full spine carries the canopy line back to the tails. */
const spine = [
  [3.25, 3.08],
  [2.4, 3.06],
  [1.6, 3.014],
  [0.8, 2.972],
  [0, 2.93],
  [-0.8, 2.895],
  [-2, 2.79],
  [-3.1, 2.7],
  [-4, 2.64],
  [-5, 2.5],
  [-5.75, 2.2],
];
const SHOULDER = 0.58,
  RING = 40,
  CAP = 3,
  QUARTER = RING / 4;
const station = (z, w, b, sw, sy, f) => ({
  z,
  w,
  b,
  sw,
  sy,
  m: b + f * (sy - b),
});
const stations = [
  ...forebody.map(([z, w, b, t], i) =>
    station(z, w, b, 0, t, 0.5 + (0.08 * i) / (forebody.length - 1)),
  ),
  ...canopy.map(([z, sw, sy]) => station(z, lookup(breadth, z), lookup(keel, z), sw, sy, SHOULDER)),
  ...spine.map(([z, t]) => station(z, lookup(breadth, z), lookup(keel, z), 0, t, SHOULDER)),
];
// A flat cap to the rail, a shoulder to maximum breadth, then a full lower lobe.
const ringPoint = (s, k) => {
  if (k <= CAP) return [(s.sw * k) / CAP, s.sy];
  if (k <= QUARTER) {
    const a = ((k - CAP) / (QUARTER - CAP)) * (Math.PI / 2);
    return [s.sw + (s.w - s.sw) * Math.sin(a), s.m + (s.sy - s.m) * Math.cos(a)];
  }
  const a = ((k - QUARTER) / QUARTER) * (Math.PI / 2);
  return [
    s.w * Math.pow(Math.max(0, Math.cos(a)), 0.8),
    s.m - (s.m - s.b) * Math.pow(Math.sin(a), 0.9),
  ];
};
const ring3d = (s) =>
  Array.from({ length: RING }, (_, i) => {
    const k = i <= RING / 2 ? i : RING - i,
      [x, y] = ringPoint(s, k);
    return [i <= RING / 2 ? x : -x, y, s.z];
  });
const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-7;
const distinct = (points) =>
  points.filter((p, i) => !same(p, points[(i + points.length - 1) % points.length]));
/** Ruled skin between rings of 3D points; unlike loft, each point carries its own z. */
function ruled(d, rings, material, skip = () => false) {
  const n = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    const center = rings[i].reduce((s, q) => [s[0] + q[0] / n, s[1] + q[1] / n], [0, 0]);
    for (let j = 0; j < n; j++) {
      if (skip(i, j)) continue;
      const p = distinct([
        rings[i][j],
        rings[i + 1][j],
        rings[i + 1][(j + 1) % n],
        rings[i][(j + 1) % n],
      ]);
      if (p.length < 3) continue;
      const normal = [0, 0, 0];
      for (let k = 0; k < p.length; k++) {
        const a = p[k],
          b = p[(k + 1) % p.length];
        normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
        normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
        normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
      }
      if (Math.hypot(...normal) < 1e-6) continue;
      const out = (p[0][0] + p[1][0]) / 2 - center[0],
        up = (p[0][1] + p[1][1]) / 2 - center[1];
      sheet(d, p, material, normal[0] * out + normal[1] * up < 0 ? normal.map((v) => -v) : normal);
    }
  }
}
/** Inlet to tail fairing: z, center, half-breadth, bottom, top. The F404s sit 1.04 m apart and
 * the fairings narrow hard behind the wing, rising to meet the nozzles rather than sagging. */
const ENGINE_X = 0.52;
const fairing = [
  [2.08, 0.72, 0.5, 1.22, 2.1],
  [1.6, 0.71, 0.52, 1.21, 2.26],
  [0.8, 0.69, 0.54, 1.234, 2.38],
  [-0.4, 0.64, 0.56, 1.258, 2.48],
  [-1.2, 0.6, 0.56, 1.282, 2.52],
  [-1.7, 0.55, 0.48, 1.33, 2.54],
  [-2.3, 0.49, 0.44, 1.38, 2.55],
  [-3.2, 0.485, 0.44, 1.478, 2.57],
  [-4, 0.5, 0.46, 1.6, 2.55],
  [-4.85, 0.52, 0.455, 1.78, 2.45],
];
export function buildFA18C(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('FA18-gray', '#929da5', { side: T.DoubleSide }),
    upper = mat('FA18-upper', '#7e8b96', { side: T.DoubleSide }),
    dark = mat('FA18-seals', '#292e31'),
    metal = mat('FA18-alloy', '#aeb4b6', { metalness: 0.75 }),
    nozzle = mat('FA18-nozzle', '#696862', {
      metalness: 0.7,
      side: T.DoubleSide,
    }),
    lining = mat('FA18-duct', '#242627', { side: T.DoubleSide }),
    glass = mat('FA18-glass', '#a6c5c9', {
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'FA18-airframe'),
    bindings = [];
  // Radome and cabin shell taper independently from the aft paired engines.
  const rings = stations.map(ring3d),
    index = (z) => stations.findIndex((q) => q.z === z),
    radome = index(9.15),
    open = [index(7.2), index(4.05)],
    outer = (i) => distinct(rings[i].filter((_, j) => j >= CAP && j <= RING - CAP)),
    radomePaint = mat('FA18-radome', '#a6afb4', { side: T.DoubleSide });
  ruled(d, rings.slice(0, radome + 1), radomePaint);
  ruled(
    d,
    rings.slice(radome),
    paint,
    (i, j) => i + radome >= open[0] && i + radome < open[1] && (j < CAP || j >= RING - CAP),
  );
  sheet(d, distinct(rings[0]), radomePaint, [0, 0, 1]);
  sheet(d, distinct(rings.at(-1)), paint, [0, 0, -1]);
  for (const z of [9.15, 8.2, 3.25, 1.6, -0.8])
    outline(
      d,
      outer(index(z)).map(([x, y, q]) => [x * 1.005, y, q]),
      0.0025,
      dark,
    );
  // Anti-glare deck under the windscreen, ahead of the aperture.
  sheet(
    d,
    [
      ...canopy.slice(0, 2).map(([z, w, y]) => [w, y + 0.006, z]),
      ...canopy
        .slice(0, 2)
        .reverse()
        .map(([z, w, y]) => [-w, y + 0.006, z]),
    ],
    dark,
    [0, 1, 0],
  );
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      b + Math.sin((j * Math.PI) / 16) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  const bow = canopy.findIndex(([z]) => z === 6.5);
  for (const i of [0, bow, cr.length - 1])
    outline(
      d,
      cr[i].points.map((p) => [...p, cr[i].z]),
      i === bow ? 0.02 : 0.013,
      paint,
      false,
    );
  for (const side of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[side], r.z]),
      0.02,
      paint,
      false,
    );
  for (let j = 0; j < 17; j++) {
    const p = cr[bow].points[j];
    d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [p[0], p[1] + 0.01, canopy[bow][0]]);
  }
  // Curved LEX, round-sided subsonic inlet lips and tightly paired F404 fairings.
  for (const side of [-1, 1]) {
    const lex = [
      [0.47, 2.24, 7.6, 0.46, 2.3],
      [0.72, 2.19, 6.95, 0.5, 2.29],
      [0.93, 2.15, 5.65, 0.54, 2.28],
      [1.2, 2.08, 3.75, 0.58, 2.3],
      [1.36, 2.03, 2.3, 0.6, 2.36],
    ];
    // The underside is a wedge that drops to the fuselage side, so the LEX reads as the thick
    // shadowed shelf seen from the ground, not a blade. [lower root x, drop below the root].
    const under = [
      [0.42, 0.08],
      [0.47, 0.2],
      [0.53, 0.3],
      [0.59, 0.32],
      [0.62, 0.3],
    ];
    const lexEdge = (q) => [side * q[0], q[1], q[2]],
      lexEdgeLow = (q) => [side * q[0], q[1] - 0.03, q[2]],
      lexRoot = (q) => [side * q[3], q[4], q[2]],
      lexRootLow = (q, i) => [side * under[i][0], q[4] - under[i][1], q[2]];
    for (let i = 0; i < lex.length - 1; i++) {
      const a = lex[i],
        b = lex[i + 1];
      quad(d, lexEdge(a), lexEdge(b), lexRoot(b), lexRoot(a), upper, [0, 1, 0]);
      quad(d, lexEdgeLow(a), lexEdgeLow(b), lexRootLow(b, i + 1), lexRootLow(a, i), paint, [
        side,
        -1,
        0,
      ]);
      quad(d, lexEdge(a), lexEdge(b), lexEdgeLow(b), lexEdgeLow(a), paint, [side, 0, 0]);
    }
    for (const [i, normal] of [
      [0, 1],
      [lex.length - 1, -1],
    ])
      sheet(
        d,
        [lexEdge(lex[i]), lexRoot(lex[i]), lexRootLow(lex[i], i), lexEdgeLow(lex[i])],
        paint,
        [0, 0, normal],
      );
    quad(
      d,
      [side * 0.6, 2.36, 2.3],
      [side * 1.36, 2.03, 2.3],
      [side * 1.3, 2.3, -1.81],
      [side * 0.6, 2.6, -1.81],
      upper,
      [0, 1, 0],
    );
    outline(
      d,
      lex.map((q) => [side * q[0], q[1] + 0.008, q[2]]),
      0.003,
      dark,
      false,
    );
    // LEX fence fitted to production Hornets.
    sheet(
      d,
      [
        [side * 0.99, 2.15, 2.4],
        [side * 0.99, 2.42, 2.1],
        [side * 0.99, 2.42, 1.45],
        [side * 0.99, 2.25, 1.35],
      ],
      paint,
      [side, 0, 0],
    );
    const ng = group(root, `FA18-engine-${side}`, [side * ENGINE_X, 0, 0]),
      nd = detailKit(ng, ng.name);
    const circle = (rx, ry, x, y, z) =>
      Array.from({ length: 24 }, (_, j) => [
        x + Math.sin((j * Math.PI) / 12) * rx,
        y + Math.cos((j * Math.PI) / 12) * ry,
        z,
      ]);
    const nr = fairing.map(([z, cx, w, b, t]) =>
      circle(w, (t - b) / 2, side * (cx - ENGINE_X), (b + t) / 2, z),
    );
    ruled(nd, nr, paint);
    // Round-lipped inlet under the LEX; only its outboard half shows beside the fuselage.
    const lip = nr[0].map(([x, y]) => [x, y, 2.08 + 0.1 * (y - 1.7)]),
      back = nr[0].map(([x, y]) => [x * 0.79, 1.66 + (y - 1.66) * 0.79, 1.2]);
    for (let j = 0; j < 24; j++)
      quad(nd, lip[j], lip[(j + 1) % 24], back[(j + 1) % 24], back[j], lining, [0, 0, 1]);
    sheet(nd, back, lining, [0, 0, 1]);
    outline(nd, lip, 0.035, paint);
    // F404 nozzle axis droops slightly: the photograph puts it at y 2.15 at the base, 1.99 aft.
    const ring = (r, z, y) => ({
      z,
      points: Array.from({ length: 24 }, (_, j) => [
        Math.sin((j * Math.PI) / 12) * r,
        y + Math.cos((j * Math.PI) / 12) * r,
      ]),
    });
    loft(nd, [ring(0.455, -4.85, 2.115), ring(0.47, -5.05, 2.11), ring(0.4, -5.72, 2.04)], nozzle, {
      caps: false,
    });
    loft(nd, [ring(0.385, -5.72, 2.04), ring(0.36, -5.03, 2.11)], lining, {
      caps: false,
    });
    sheet(
      nd,
      ring(0.36, -5.03, 2.11).points.map((p) => [...p, -5.03]),
      lining,
      [0, 0, -1],
    );
    for (let j = 0; j < 24; j += 2) {
      const a = (j * Math.PI) / 12;
      nd.rod(
        [Math.sin(a) * 0.466, 2.11 + Math.cos(a) * 0.466, -5.1],
        [Math.sin(a) * 0.405, 2.04 + Math.cos(a) * 0.405, -5.72],
        0.003,
        dark,
      );
    }
    nd.finish();
    // Fixed trapezoid wing: separate leading flaps, inboard trailing flap and outer aileron.
    const stations = [
      [1.3, 2.18, 2.34, -1.81, 0.16],
      [3.95, 2.06, 1.0, -1.7, 0.075],
      [5.65, 1.98, 0.14, -1.62, 0.025],
    ];
    for (let j = 0; j < 2; j++) {
      const pair = stations.slice(j, j + 2),
        leadHinge = (q) => q[2] - 0.28 * (q[2] - q[3]),
        rearHinge = (q) => q[3] + 0.26 * (q[2] - q[3]);
      wing(
        d,
        pair.map((q) => [q[0] * side, q[1], leadHinge(q), rearHinge(q), q[4]]),
        upper,
      );
      for (const end of ['leading', 'trailing']) {
        const hinge = end === 'leading' ? leadHinge : rearHinge,
          pivot = [side * pair[0][0], pair[0][1], hinge(pair[0])],
          g = group(
            root,
            `FA18-${end === 'leading' ? 'leading' : j === 0 ? 'flap' : 'aileron'}-${side}`,
            pivot,
          ),
          gd = detailKit(g, g.name);
        wing(
          gd,
          pair.map((q) => [
            side * q[0] - pivot[0],
            q[1] - pivot[1],
            (end === 'leading' ? q[2] : hinge(q)) - pivot[2],
            (end === 'leading' ? hinge(q) : q[3]) - pivot[2],
            q[4] * 0.65,
          ]),
          upper,
        );
        gd.finish();
        bindings.push({
          node: g.name,
          source: end === 'leading' || j === 0 ? 'flapPosition' : 'rollInput',
          property: 'rotation',
          axis: 'x',
          scale: end === 'leading' ? 0.25 : j === 0 ? -0.55 : -side * 0.3,
        });
        // Two leading panels have distinct names for stable animation bindings.
        if (end === 'leading') {
          g.name += `-${j}`;
          bindings.at(-1).node = g.name;
        }
      }
      const a = pair[0],
        b = pair[1];
      outline(
        d,
        [
          [side * a[0], a[1] + a[4] + 0.002, leadHinge(a)],
          [side * b[0], b[1] + b[4] + 0.002, leadHinge(b)],
        ],
        0.003,
        dark,
        false,
      );
      for (let k = 0; k < 22; k++) {
        const t = k / 21,
          x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t,
          z = rearHinge(a) + (rearHinge(b) - rearHinge(a)) * t;
        d.add(new T.SphereGeometry(0.0032, 5, 3), metal, [side * x, y + 0.018, z + 0.04]);
      }
    }
    // Empty launch rail is part of the clean wing outline, not a missile.
    d.box([0.13, 0.1, 1.75], [side * 5.65, 1.98, -0.73], paint);
    d.box([0.04, 0.045, 1.5], [side * 5.7, 1.92, -0.73], metal);
    const tg = group(root, `FA18-stabilator-${side}`, [side * 0.95, 2.12, -3.8]),
      td = detailKit(tg, tg.name);
    wing(
      td,
      [
        [0, 0, 1.45, -1.97, 0.055],
        [side * 2.1, -0.03, -1.2, -2.3688, 0.035],
        [side * 2.34184, -0.04, -1.35, -2.25, 0.012],
      ],
      upper,
    );
    td.finish();
    bindings.push({
      node: tg.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const fg = group(root, `FA18-fin-${side}`, [side * 0.97, 2.5, -0.85]);
    fg.rotation.z = (-side * 20 * Math.PI) / 180;
    // The fixed tip overhangs a rudder confined to the lower two thirds, as photographed. The root
    // runs down into the fairing, which narrows inboard of the fin behind the wing.
    const fd = detailKit(fg, fg.name),
      height = (4.6482 - 2.5) / Math.cos((20 * Math.PI) / 180),
      HINGE = [
        [0.15, -2.15],
        [1.575, -2.65],
      ],
      contour = [
        [0, -0.25, 0.22],
        [0, height, -2.02],
        [0, height, -3.15],
        [0, 1.575, -3.15],
        [0, ...HINGE[1]],
        [0, ...HINGE[0]],
        [0, 0.15, -2.75],
        [0, -0.25, -2.75],
      ];
    for (const x of [-0.035, 0.035])
      sheet(
        fd,
        contour.map((p) => [x, p[1], p[2]]),
        paint,
        [Math.sign(x), 0, 0],
      );
    for (let i = 0; i < contour.length; i++)
      quad(
        fd,
        [-0.035, ...contour[i].slice(1)],
        [0.035, ...contour[i].slice(1)],
        [0.035, ...contour[(i + 1) % contour.length].slice(1)],
        [-0.035, ...contour[(i + 1) % contour.length].slice(1)],
        paint,
        [0, contour[i][1], contour[i][2]],
      );
    // The hinge runs up the fin's sweep, so the group is tilted to put local y on it.
    const tilt = Math.atan2(HINGE[1][1] - HINGE[0][1], HINGE[1][0] - HINGE[0][0]),
      hinge = group(fg, `FA18-rudder-hinge-${side}`, [0, ...HINGE[0]]);
    hinge.rotation.x = tilt;
    const rg = group(hinge, `FA18-rudder-${side}`),
      rd = detailKit(rg, rg.name),
      toHinge = ([y, z]) => {
        const dy = y - HINGE[0][0],
          dz = z - HINGE[0][1];
        return [
          0,
          dy * Math.cos(tilt) + dz * Math.sin(tilt),
          -dy * Math.sin(tilt) + dz * Math.cos(tilt),
        ];
      };
    sheet(rd, [HINGE[0], HINGE[1], [1.5, -3], [0.2, -2.72]].map(toHinge), upper, [1, 0, 0]);
    rd.finish();
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.38,
    });
    fd.rod([side * 0.041, ...HINGE[0]], [side * 0.041, ...HINGE[1]], 0.003, dark);
    for (const y of [height - 0.12, 1.82, 1.66]) fd.rod([0, y, -2.95], [0, y, -3.27], 0.035, paint);
    // Exterior operator identifiers are supplied by the selected livery.
    fd.finish();
    // Retractable main gear: wide trailing arm and one wheel per side.
    const gg = group(root, `FA18-gear-${side}`, [side * 0.66, 1.35, 0.22]),
      gd = detailKit(gg, gg.name);
    gd.rod([0, 0, 0], [side * 0.35, -0.68, -0.05], 0.085, metal);
    gd.rod([side * 0.35, -0.68, -0.05], [side * 0.895, -0.97, -0.22], 0.09, paint);
    gd.rod([0, -0.1, 0.48], [side * 0.4, -0.68, -0.05], 0.048, metal);
    gd.add(new T.CylinderGeometry(0.38, 0.38, 0.27, 24).rotateZ(Math.PI / 2), dark, [
      side * 0.895,
      -0.97,
      -0.22,
    ]);
    gd.add(new T.CylinderGeometry(0.21, 0.21, 0.28, 24).rotateZ(Math.PI / 2), metal, [
      side * 0.895,
      -0.97,
      -0.22,
    ]);
    const door = group(gg, `FA18-main-door-${side}`),
      doorKit = detailKit(door, door.name);
    doorKit.box([0.035, 0.6, 0.75], [side * 0.11, -0.23, 0.1], paint);
    doorKit.finish();
    bindings.push({
      node: door.name,
      source: 'gearExposed',
      property: 'visible',
      scale: 1,
    });
    gd.finish();
    bindings.push({
      node: gg.name,
      source: 'gear',
      property: 'rotation',
      axis: 'x',
      scale: Math.PI / 2,
      offset: -Math.PI / 2,
    });
    bindings.push({
      node: gg.name,
      source: 'gear',
      property: 'position',
      axis: 'x',
      scale: side * 0.7,
      offset: -side * 0.7,
    });
    bindings.push({
      node: gg.name,
      source: 'gear',
      property: 'position',
      axis: 'y',
      scale: -0.8,
      offset: 0.8,
    });
    // Once shut, the opaque bay hides the assembly; do not render it through the cabin tub.
    bindings.push({
      node: gg.name,
      source: 'gearExposed',
      property: 'visible',
      scale: 1,
    });
  }
  const ng = group(root, 'FA18-gear-nose', [0, 1.4, 5.38]),
    nd = detailKit(ng, ng.name);
  nd.rod([0, 0, 0], [0, -1.12, 0], 0.052, metal);
  nd.rod([0, -0.15, -0.7], [0, -0.78, 0], 0.035, metal);
  nd.rod([-0.16, -1.12, 0], [0.16, -1.12, 0], 0.03, metal);
  for (const side of [-1, 1]) {
    nd.add(new T.CylinderGeometry(0.28, 0.28, 0.17, 24).rotateZ(Math.PI / 2), dark, [
      side * 0.16,
      -1.12,
      0,
    ]);
    nd.add(new T.CylinderGeometry(0.15, 0.15, 0.18, 20).rotateZ(Math.PI / 2), metal, [
      side * 0.16,
      -1.12,
      0,
    ]);
  }
  nd.rod([0, -0.76, 0.06], [0, -1.06, 0.42], 0.03, metal);
  const noseDoor = group(ng, 'FA18-nose-door'),
    noseDoorKit = detailKit(noseDoor, noseDoor.name);
  // The forward bay door hangs ahead of the leg, with a long low strip door behind it.
  noseDoorKit.box([0.03, 0.34, 0.86], [0.26, -0.26, 1.48], paint);
  noseDoorKit.box([0.03, 0.14, 1], [0.26, -0.16, 0.5], paint);
  noseDoorKit.finish();
  bindings.push({
    node: noseDoor.name,
    source: 'gearExposed',
    property: 'visible',
    scale: 1,
  });
  nd.finish();
  bindings.push({
    node: ng.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    scale: Math.PI / 2,
    offset: -Math.PI / 2,
  });
  bindings.push({
    node: ng.name,
    source: 'gear',
    property: 'position',
    axis: 'y',
    scale: -0.75,
    offset: 0.75,
  });
  bindings.push({
    node: ng.name,
    source: 'gearExposed',
    property: 'visible',
    scale: 1,
  });
  const hook = group(root, 'arresting-hook', [0, 1.62, -3.2]);
  const hd = detailKit(hook, 'hook-skin');
  hd.rod([0, 0, 0], [0, -0.32, -2.1], 0.029, metal);
  hd.rod([0, -0.32, -2.1], [0, -0.28, -2.3], 0.045, metal);
  hd.finish();
  // Speed-brake outline, spine antennae, access seams and selected maintenance marks.
  outline(
    d,
    [
      [-0.3, lookup(spine, -2.4) + 0.012, -2.4],
      [0.3, lookup(spine, -2.4) + 0.012, -2.4],
      [0.1, lookup(spine, -4.2) + 0.012, -4.2],
      [-0.1, lookup(spine, -4.2) + 0.012, -4.2],
    ],
    0.004,
    dark,
  );
  for (const z of [3.2, 1.4])
    sheet(
      d,
      [
        [0, lookup(spine, z) - 0.02, z + 0.15],
        [0, lookup(spine, z) + 0.2, z + 0.1],
        [0, lookup(spine, z) + 0.16, z - 0.12],
        [0, lookup(spine, z) - 0.02, z - 0.18],
      ],
      paint,
      [1, 0, 0],
    );
  for (const side of [-1, 1]) {
    d.text('RESCUE', [side * 0.495, 2.0, 7.55], 0.09, (side * Math.PI) / 2, dark);
    d.text('DANGER', [side * 1.24, 1.7, 0.9], 0.095, (side * Math.PI) / 2, dark);
    for (let i = 0; i < canopy.length - 1; i++)
      for (let j = 0; j < 5; j++) {
        const a = canopy[i],
          b = canopy[i + 1],
          t = j / 5;
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t),
          a[2] + (b[2] - a[2]) * t + 0.018,
          a[0] + (b[0] - a[0]) * t,
        ]);
      }
    for (let j = 0; j < 5; j++)
      d.box([0.008, 0.035, 0.09], [side * 0.455, 1.88, 8.8 - j * 0.13], dark);
  }
  d.finish();
  const interior = fa18Cockpit(root, { paint, dark, metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.3] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.13] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: fa18Frame(),
    enginePoints: [
      { id: 'engine-1', position: [ENGINE_X, 2.1, -4.9] },
      { id: 'engine-2', position: [-ENGINE_X, 2.1, -4.9] },
    ],
    visual: {
      rotors: [],
      gearNodes: [],
      flaps: [],
      ailerons: [],
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

function fa18Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'FA18-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'FA18'),
    { bindings, derived, ink, black, amber } = ins;
  const panel = mat('FA18-panel', '#51595c', { side: T.DoubleSide }),
    seat = mat('FA18-seat', '#60634a'),
    belt = mat('FA18-harness', '#919583'),
    green = mat('FA18-display', '#71d488', {
      emissive: '#2a6038',
      emissiveIntensity: 0.7,
    });
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'angleOfAttack',
      'gearPosition',
      'flapPosition',
      'loadFactor',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
      { component: 'aircraftState', path: [k] },
    ]),
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
    knots: { op: 'multiply', args: ['trueAirspeed', 1.9438444924406] },
    feet: { op: 'multiply', args: ['altitude', 3.2808398950131] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  // Measured positions in 1978px FO-5 foldout; 130px active DDI width = nominal5in.
  const k = 0.127 / 130,
    z = 6.65,
    at = (u, v, dz = 0) => [(707 - u) * k, 2.43 - (v - 550) * k, z + dz];
  const rect = (u, v, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([a, b]) => at(u + a * w, v + b * h, dz)),
    circle = (u, v, r) =>
      Array.from({ length: 40 }, (_, j) =>
        at(u + Math.cos((j * Math.PI) / 20) * r, v + Math.sin((j * Math.PI) / 20) * r),
      );
  const box = (u, v, w, h, material = black, depth = 0.012) =>
      d.box([w * k, h * k, depth], at(u, v, -0.02 + depth / 2), material),
    text = (t, u, v, h = 7, material = ink, role = 'panel') =>
      d.text(t, at(u, v, -0.027), h * k, Math.PI, material, role);
  const edge = [
    [345, 620],
    [345, 448],
    [392, 381],
    [451, 332],
    [524, 302],
    [604, 287],
    [808, 287],
    [880, 303],
    [958, 341],
    [1027, 399],
    [1069, 460],
    [1069, 782],
    [815, 782],
    [815, 1125],
    [597, 1125],
    [597, 782],
    [345, 782],
  ];
  sheet(
    d,
    edge.map((p) => at(...p)),
    panel,
    [0, 0, -1],
    [circle(887, 652, 38), rect(499, 451, 87, 62)],
  );
  outline(
    d,
    edge.map((p) => at(...p, -0.003)),
    0.006,
    black,
  );
  // Coaming continues forward from the arched upper edge rather than a flat box.
  const arc = edge.slice(1, 13);
  for (let j = 0; j < arc.length - 1; j++) {
    const a = at(...arc[j]),
      b = at(...arc[j + 1]);
    quad(
      d,
      a,
      b,
      [b[0], b[1] - 0.02, b[2] + 0.25],
      [a[0], a[1] - 0.02, a[2] + 0.25],
      black,
      [0, 1, 0],
    );
  }
  const display = (u, v, w, h, label, hole = false) => {
    sheet(
      d,
      rect(u, v, w, h, -0.008),
      black,
      [0, 0, -1],
      hole ? [rect(u, v - 5, 87, 62, -0.008)] : [],
    );
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++) {
        box(u + side * (w / 2 - 9), v - h * 0.3 + j * h * 0.15, 13, 17, panel);
        box(u - w * 0.3 + j * w * 0.15, v + side * (h / 2 - 9), 17, 13, panel);
      }
    for (const side of [-1, 1])
      d.add(
        new T.CylinderGeometry(0.008, 0.009, 0.014, 12).rotateX(Math.PI / 2),
        panel,
        at(u + side * (w / 2 - 11), v + h / 2 + 17, -0.03),
      );
    text(label, u, v - h * 0.37, 6, green);
  };
  display(499, 456, 192, 188, 'ATT / SIM', true);
  ins.horizon('DDI-attitude', at(499, 451, 0.012), 0.085, 0.06, {
    blankBackdrop: true,
  });
  ins.readout('DDI-speed', at(458, 510, -0.028), 'knots', 3, 0.01, green);
  text('TAS', 458, 497, 5, green, 'display');
  ins.readout('DDI-altitude', at(535, 510, -0.028), 'feet', 5, 0.008, green, true, true);
  text('GEO FT', 535, 497, 5, green, 'display');
  display(920, 456, 192, 188, 'DDI');
  text('INOP', 920, 456, 13, amber, 'display');
  display(710, 722, 181, 175, 'MPCD');
  // Simplified true-heading presentation, no invented map or navigation solution.
  const hg = group(cabin, 'FA18-heading', at(710, 714, -0.029)),
    hd = detailKit(hg, hg.name);
  for (let j = 0; j < 72; j++) {
    const a = (j * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(j % 6 ? 0.05 : 0.045), p(0.055), 0.0006, green);
    if (j % 6 === 0) hd.text(String(j / 2), p(0.035), 0.007, Math.PI, green);
  }
  hd.finish();
  bindings.push({
    node: hg.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: Math.PI * 2,
  });
  ins.available('heading', 'trueHeading', hg.name);
  text('TRUE', 710, 782, 6, green, 'display');
  d.rod(at(710, 653, -0.03), at(710, 665, -0.03), 0.001, ink);
  ins.horizon('standby', at(887, 652, 0.01), 0.068, 0.068, {
    round: true,
    blankBackdrop: true,
  });
  ins.dial(
    'standby-speed',
    at(866, 738, -0.007),
    32 * k,
    'knots',
    [
      [0, 0],
      [100, 0.65],
      [200, 1.55],
      [300, 2.65],
      [400, 3.7],
      [600, 4.8],
      [800, 5.6],
    ],
    [0, 100, 200, 300, 400, 600, 800],
    'TAS',
    {
      tickLabels: { 0: 0, 100: 1, 200: 2, 300: 3, 400: 4, 600: 6, 800: 8 },
      minorStep: 20,
    },
  );
  ins.altimeter('standby-altitude', at(939, 738, -0.007), 32 * k, 'feet');
  ins.dial(
    'vertical-speed',
    at(1018, 738, -0.007),
    32 * k,
    'verticalFpm',
    [
      [-6000, -Math.PI / 2],
      [0, Math.PI / 2],
      [6000, Math.PI * 1.5],
    ],
    [-6000, -4000, -2000, 0, 2000, 4000, 6000],
    'FPM',
    {
      tickLabels: {
        '-6000': -6,
        '-4000': -4,
        '-2000': -2,
        0: 0,
        2000: 2,
        4000: 4,
        6000: 6,
      },
    },
  );
  pt.gauge(...at(997, 652).slice(0, 2), z - 0.008, 43 * k, black, false);
  text('RWR', 997, 640, 7);
  text('INOP', 997, 660, 8, amber, 'display');
  // UFC keypad, five option fields, scratchpad and physical radio controls.
  box(710, 394, 190, 124);
  box(674, 351, 64, 18, panel);
  text('----', 674, 351, 8, green, 'display');
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) {
      const u = 653 + col * 21,
        v = 374 + row * 21;
      box(u, v, 16, 16, panel);
      text(
        [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['CLR', '0', 'ENT'],
        ][row][col],
        u,
        v,
        row === 3 ? 4 : 7,
      );
    }
  for (let j = 0; j < 5; j++) {
    box(750, 352 + j * 21, 45, 15, panel);
    text('--', 750, 352 + j * 21, 6, green, 'display');
    d.add(
      new T.CylinderGeometry(0.005, 0.006, 0.012, 10).rotateX(Math.PI / 2),
      panel,
      at(717, 352 + j * 21, -0.03),
    );
  }
  for (const u of [630, 786])
    for (const v of [360, 405, 442])
      d.add(
        new T.CylinderGeometry(0.006, 0.007, 0.012, 10).rotateX(Math.PI / 2),
        panel,
        at(u, v, -0.03),
      );
  box(710, 477, 194, 27);
  for (let j = 0; j < 7; j++) {
    box(652 + j * 21, 471, 16, 16, panel);
    text(['AP', 'IFF', 'TCN', 'ILS', 'DL', 'BCN', 'ON'][j], 652 + j * 21, 471, 4);
  }
  box(710, 530, 196, 64);
  text('HUD', 710, 501, 6);
  for (let j = 0; j < 6; j++) {
    const u = 638 + j * 29;
    d.add(
      new T.CylinderGeometry(0.006, 0.007, 0.013, 10).rotateX(Math.PI / 2),
      panel,
      at(u, 523, -0.03),
    );
    text(['BRT', 'ATT', 'ALT', 'W/B', 'VID', 'SYM'][j], u, 539, 4);
  }
  // IFEI has no corresponding engine-core/fuel telemetry: leave its cells unavailable.
  box(495, 670, 194, 142);
  text('L   ENGINE   R', 455, 613, 7);
  text('FUEL', 557, 613, 7);
  for (const [v, label] of [
    [635, 'RPM'],
    [657, 'TEMP'],
    [679, 'FF'],
    [701, 'NOZ'],
  ]) {
    text(label, 455, v, 6);
    text('--', 425, v, 7, amber, 'display');
    text('--', 482, v, 7, amber, 'display');
  }
  text('-----', 555, 648, 10, amber, 'display');
  text('TIME --', 553, 706, 7, amber);
  for (const [u, v, w, h, label] of [
    [378, 481, 35, 126, 'ARM'],
    [1042, 491, 40, 118, 'MAP'],
    [373, 675, 43, 147, 'GEAR'],
    [710, 927, 187, 100, 'ECM'],
    [1140, 974, 69, 150, 'HYD'],
  ]) {
    box(u, v, w, h);
    text(label, u, v - h * 0.36, 5);
    text('--', u, v, 8, amber, 'display');
  }
  for (let j = 0; j < 3; j++) {
    const g = group(cabin, `FA18-gear-lamp-${j}`, at(365 + j * 9, 746, -0.029)),
      gd = detailKit(g, g.name);
    gd.box([0.006, 0.006, 0.002], [0, 0, 0], green);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  for (const [u, v, label] of [
    [498, 328, 'L FIRE'],
    [890, 328, 'APU'],
    [914, 328, 'R FIRE'],
    [530, 327, 'CAUTION'],
  ]) {
    box(u, v, 22, 18);
    text(label, u, v, 3);
  }
  for (const u of [567, 845])
    for (let row = 0; row < 5; row++) {
      box(u, 313 + row * 9, 33, 7);
      text('--', u, 313 + row * 9, 4, ink, 'display');
    }
  // HUD glass is a physical combiner. Symbology needs a separate collimated implementation.
  const hud = [
    [616, 278],
    [624, -38],
    [640, -54],
    [772, -54],
    [788, -38],
    [800, 278],
  ].map((p) => at(...p, -0.1));
  sheet(d, hud, m.glass, [0, 0, -1]);
  outline(d, hud, 0.006, black);
  box(707, 285, 203, 12, black, 0.12);
  for (const side of [-1, 1])
    d.rod(at(707 + side * 89, 281, -0.11), at(707 + side * 80, -34, -0.11), 0.008, m.metal);
  for (const [u, v, r, label] of [
    [778, 990, 33, 'CLOCK'],
    [778, 1060, 33, 'CABIN'],
    [1141, 929, 26, 'RADALT'],
    [1140, 1004, 24, 'HYD'],
  ]) {
    pt.gauge(...at(u, v).slice(0, 2), z - 0.009, r * k, black, false);
    text(label, u, v - 6, 5);
    text('--', u, v + 8, 7, amber, 'display');
  }
  // Distinct console layout from FO-5 sheet2: throttle and communication left; power/ECS/lights right.
  d.box([0.82, 0.03, 2.45], [0, 1.66, 5.5], black);
  d.box([0.86, 0.96, 0.03], [0, 2.14, 5], black);
  sheet(
    d,
    [
      [0.43, 2.61, 5],
      [0.4, 2.61, 4.4],
      [0.365, 2.61, 4.05],
      [-0.365, 2.61, 4.05],
      [-0.4, 2.61, 4.4],
      [-0.43, 2.61, 5],
    ],
    panel,
    [0, 1, 0],
  );
  for (const side of [-1, 1]) {
    sheet(
      d,
      [
        [side * 0.44, 1.66, 4.05],
        [side * 0.44, 1.66, 6.8],
        [side * 0.44, 2.45, 6.8],
        [side * 0.44, 2.45, 4.05],
      ],
      panel,
      [-side, 0, 0],
    );
    // Liner from the shelf to the rail, which climbs aft, so the hollow body never shows.
    const rails = canopy.filter(([z]) => z <= 6.8 && z >= 4.05);
    for (let i = 0; i < rails.length - 1; i++) {
      const [z0, w0, y0] = rails[i],
        [z1, w1, y1] = rails[i + 1];
      quad(
        d,
        [side * 0.44, 2.45, z0],
        [side * 0.44, 2.45, z1],
        [side * (w1 - 0.012), y1 - 0.004, z1],
        [side * (w0 - 0.012), y0 - 0.004, z0],
        panel,
        [-side, 0.2, 0],
      );
    }
    d.box([0.2, 0.32, 1.65], [side * 0.33, 2.01, 5.55], panel);
    const cg = group(cabin, `FA18-console-${side}`, [side * 0.33, 2.175, 5.55]);
    cg.rotation.x = Math.PI / 2;
    const cd = detailKit(cg, cg.name);
    const labels =
      side === 1
        ? ['OBOGS', 'COMM', 'FCS', 'FUEL', 'THROTTLE', 'POWER']
        : ['NVG', 'SENSOR', 'SYSTEM', 'LIGHT', 'ECS', 'ELECT'];
    for (let j = 0; j < 6; j++) {
      const y = -0.68 + j * 0.26;
      cd.box([0.185, 0.24, 0.012], [0, y, 0], black);
      cd.text(labels[j], [0, y + 0.08, -0.009], 0.014, Math.PI, ink);
      const toggle = (x, v) => cd.rod([x, v, -0.01], [x, v + 0.005, -0.032], 0.003, m.metal);
      const knob = (x, v, r = 0.008) => {
        cd.add(new T.CylinderGeometry(r, r * 1.12, 0.01, 10).rotateX(Math.PI / 2), panel, [
          x,
          v,
          -0.016,
        ]);
        cd.rod([x, v, -0.022], [x, v + r * 0.7, -0.022], 0.0007, ink);
      };
      const label = labels[j];
      if (label === 'NVG') {
        cd.box([0.15, 0.17, 0.018], [0, y - 0.015, -0.015], panel);
        cd.box([0.018, 0.035, 0.01], [0.055, y - 0.015, -0.029], m.metal);
      } else if (label === 'THROTTLE') {
        for (const x of [-0.035, 0.035])
          cd.box([0.016, 0.17, 0.003], [x, y - 0.015, -0.009], panel);
      } else if (label === 'COMM' || label === 'LIGHT') {
        for (let row = 0; row < 2; row++)
          for (let q = 0; q < 3; q++) knob(-0.055 + q * 0.055, y - 0.06 + row * 0.08);
      } else if (label === 'ECS') {
        knob(0, y + 0.025, 0.016);
        for (const x of [-0.055, 0.055]) {
          toggle(x, y + 0.025);
          knob(x, y - 0.06);
        }
      } else if (label === 'FCS') {
        knob(-0.035, y - 0.01, 0.015);
        toggle(0.045, y - 0.03);
        cd.text('TRIM', [-0.035, y - 0.07, -0.012], 0.009, Math.PI, ink);
      } else if (label === 'OBOGS') {
        knob(0.04, y - 0.025, 0.014);
        toggle(-0.045, y - 0.025);
      } else {
        for (let q = 0; q < (label === 'POWER' ? 4 : 3); q++) {
          const x = label === 'POWER' ? -0.055 + (q % 2) * 0.11 : -0.055 + q * 0.055;
          toggle(x, y - 0.05 + (label === 'POWER' ? Math.floor(q / 2) * 0.075 : 0));
        }
        if (label !== 'POWER') knob(0, y + 0.025, 0.012);
      }
    }
    cd.finish();
  }
  const sg = group(cabin, 'FA18-SJU17', [0, 2.1, 5.54]);
  sg.rotation.x = -0.2;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.45, 0.12, 0.49], [0, 0, 0.2], seat);
  beveledBox(sd, [0.43, 0.72, 0.13], [0, 0.4, -0.07], seat);
  beveledBox(sd, [0.31, 0.25, 0.17], [0, 0.9, -0.07], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.24, -0.1, -0.15], [side * 0.24, 0.95, -0.15], 0.024, m.metal);
    sheet(
      sd,
      [
        [side * 0.1, 0.74, 0.01],
        [side * 0.15, 0.74, 0.01],
        [side * 0.08, 0.12, 0.1],
        [side * 0.03, 0.12, 0.1],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.13, 0.035, 0.23], [side * 0.17, 0.09, 0.17], belt);
  }
  sd.box([0.06, 0.04, 0.025], [0, 0.12, 0.15], m.metal);
  sd.ring(0.045, 0.009, [0, 0.13, 0.43], amber);
  sd.finish();
  const stick = group(cabin, 'FA18-stick', [0, 1.72, 6.15]),
    st = detailKit(stick, stick.name);
  st.rod([0, 0, 0], [0, 0.55, -0.05], 0.022, black);
  beveledBox(st, [0.075, 0.115, 0.07], [0, 0.61, -0.06], black, 0.01);
  for (const p of [
    [-0.025, 0.66, -0.09],
    [0.025, 0.65, -0.09],
    [0, 0.62, -0.1],
  ])
    st.add(new T.SphereGeometry(0.009, 8, 6), panel, p);
  st.finish();
  bindings.push(
    {
      node: stick.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: -0.22,
    },
    {
      node: stick.name,
      source: 'rollInput',
      property: 'rotation',
      axis: 'z',
      scale: 0.22,
    },
  );
  for (const side of [-1, 1]) {
    const g = group(cabin, `FA18-pedal-${side}`, [side * 0.13, 1.8, 6.4]),
      gd = detailKit(g, g.name);
    gd.box([0.13, 0.15, 0.035], [0, 0, 0], m.metal);
    for (let j = 0; j < 5; j++) gd.box([0.11, 0.004, 0.004], [0, -0.06 + j * 0.03, -0.02], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  for (let j = 0; j < 2; j++) {
    const g = group(cabin, `FA18-throttle-${j}`, [0.28 + j * 0.07, 2.2, 5.91]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, 0.1, 0], 0.012, black);
    gd.box([0.06, 0.05, 0.09], [0, 0.11, 0], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
