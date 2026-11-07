/** F-14D, clean airframe. Main-axle datum, +Z forward, +X pilot left.
 * Navy SAC exterior drawing and separate D-model front/RIO panel references.
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
export const f14Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.72,
  cy: 2.1,
  ry: 0.72,
  cabinZ: 7.6,
  cabinWidth: 0.88,
  eye: [0, 3.3, 7.6],
  rearEye: [0, 3.42, 5.9],
  panelZ: 8.28,
  floor: 1.88,
});
// Tables below are traced from the July 1985 SAC three-view, leveled to its own ground line (2.1
// degrees) and scaled 54.1 px/m from the 276.35in wheelbase; the 192in fin height agrees to 0.4%.
// The plan and front views are 54.6 px/m along and across the body, but their drawn wing span is
// 2.5% short, so outer wing and stabilator stations are scaled up to the annotated spans. The front
// view is drawn level to the fuselage, not at ground attitude: use it for widths, never heights. A
// parked 164341 photograph confirms the side view: canopy 0.83 m above the nose-to-fin-tip line.
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
const column = (rows, k) => rows.map((row) => [row[0], row[k]]);
const clamp = (v) => Math.max(0, Math.min(1, v));
/** Nose to windscreen: z, half-breadth, keel, crown. */
const forebody = [
  [12.07, 0.012, 2.065, 2.085],
  [11.7, 0.143, 1.971, 2.239],
  [11.3, 0.275, 1.833, 2.414],
  [10.9, 0.392, 1.752, 2.571],
  [10.5, 0.484, 1.689, 2.689],
  [10, 0.577, 1.662, 2.805],
  [9.7, 0.611, 1.658, 2.877],
  [9.3, 0.655, 1.64, 2.95],
];
/** Canopy: z, half-width at the rail, rail height, crown. The rail is the frame's lower edge. */
const canopy = [
  [9.13, 0.02, 2.965, 2.975],
  [8.9, 0.2, 2.945, 3.146],
  [8.5, 0.34, 2.965, 3.364],
  [8.15, 0.42, 3.02, 3.53],
  [7.7, 0.46, 3.04, 3.646],
  [7.3, 0.475, 3.083, 3.708],
  [6.9, 0.48, 3.108, 3.733],
  [6.5, 0.48, 3.127, 3.727],
  [6.1, 0.48, 3.133, 3.702],
  [5.7, 0.48, 3.146, 3.652],
  [5.3, 0.47, 3.133, 3.583],
  [4.9, 0.45, 3.121, 3.496],
  [4.65, 0.43, 3.1, 3.43],
];
/** The canopy's arch runs on aft as an opaque turtledeck, sinking into the glove deck. */
const turtledeck = [
  [4.65, 0.43, 3.1, 3.43],
  [4.1, 0.41, 3.04, 3.3],
  [3.3, 0.37, 2.95, 3.127],
  [2.5, 0.32, 2.85, 2.964],
  [1.7, 0.26, 2.77, 2.84],
  [0.9, 0.18, 2.7, 2.714],
];
const breadth = [
  [9.3, 0.655],
  [9, 0.684],
  [8.5, 0.712],
  [8, 0.741],
  [7.5, 0.755],
  [7, 0.769],
  [6, 0.769],
  [5.5, 0.755],
  [5, 0.741],
  [4.5, 0.727],
  [4, 0.705],
  [3.4, 0.669],
  [3, 0.641],
  [2.6, 0.612],
  [2.2, 0.569],
  [1.8, 0.527],
  [1.4, 0.469],
  [1, 0.412],
  [0.6, 0.341],
  [0.2, 0.25],
  [-0.7, 0.16],
  [-1.9, 0.06],
];
const keel = [
  [9.3, 1.64],
  [7.3, 1.627],
  [3.7, 1.627],
  [2.2, 1.68],
  [0.9, 1.74],
  [-1.9, 1.78],
];
/** Spine aft of the turtledeck, tapering out between the fins: z, crown. */
const spine = [
  [0.5, 2.633],
  [0.1, 2.577],
  [-0.7, 2.489],
  [-1.9, 2.421],
];
const SHOULDER = 0.56,
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
const railStation = ([z, sw, sy]) =>
  station(z, lookup(breadth, z), lookup(keel, z), sw, sy, SHOULDER);
const stations = [
  ...forebody.map(([z, w, b, t], i) =>
    station(z, w, b, 0, t, 0.5 + (0.05 * i) / (forebody.length - 1)),
  ),
  ...canopy.map(railStation),
  ...turtledeck.slice(1).map(railStation),
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
// Half-breadth of the cockpit shoulder at a height, so skin lines stay on the surface.
const shoulderX = (z, y) => {
  const s = railStation([z, lookup(column(canopy, 1), z), lookup(column(canopy, 2), z)]);
  return s.sw + (s.w - s.sw) * Math.sqrt(Math.max(0, 1 - ((y - s.m) / (s.sy - s.m)) ** 2));
};
/** Nacelle: z, inboard edge, outboard edge, bottom, top. The engines sit 2.8 m apart, not 3.36. */
const ENGINE_X = 1.4,
  ENGINE_Y = 1.69;
const nacelle = [
  [6.1, 0.9, 1.7, 1.46, 2.55],
  [3.4, 0.9, 1.76, 1.46, 2.62],
  [2.9, 0.9, 1.82, 1.37, 2.62],
  [2.1, 0.89, 1.97, 1.26, 2.62],
  [1.3, 0.87, 2.06, 1.17, 2.6],
  [0.5, 0.86, 2.1, 1.09, 2.4],
  [-0.3, 0.84, 2.13, 1.02, 2.28],
  [-1.2, 0.82, 2.16, 0.955, 2.28],
  [-1.9, 0.8, 2.18, 0.99, 2.33],
  [-2.8, 0.79, 2.21, 1.06, 2.47],
  [-3.4, 0.78, 2.227, 1.07, 2.6],
  [-4.2, 0.78, 2.19, 1.06, 2.56],
  [-5, 0.76, 2.112, 1.045, 2.39],
  [-5.4, 0.75, 2.055, 1.075, 2.335],
  [-5.8, 0.82, 1.99, 1.12, 2.28],
  [-6, 0.86, 1.94, 1.16, 2.2],
];
const NACELLE_STATIONS = [
  6.1, 5.6, 5, 4.4, 3.9, 3.4, 2.9, 2.1, 1.3, 0.5, -0.3, -1.2, -1.9, -2.8, -3.4, -4.2, -5, -5.4,
  -5.8, -6,
];
// Unit sections, inboard top first. The mouth is nearly square; the bodies have a rounded belly.
const SECTION_INLET = [
  [0.1, 1],
  [0.4, 1],
  [0.7, 1],
  [0.92, 0.99],
  [0.985, 0.95],
  [1, 0.88],
  [1, 0.55],
  [1, 0.2],
  [0.985, 0.06],
  [0.92, 0.01],
  [0.66, 0],
  [0.4, 0],
  [0.12, 0],
  [0.03, 0.06],
  [0, 0.2],
  [0, 0.55],
  [0, 0.88],
  [0.03, 0.97],
];
const SECTION_BODY = [
  [0.1, 1],
  [0.4, 1],
  [0.7, 1],
  [0.9, 0.985],
  [0.975, 0.93],
  [1, 0.8],
  [0.99, 0.58],
  [0.93, 0.36],
  [0.82, 0.13],
  [0.66, 0.03],
  [0.5, 0],
  [0.34, 0.03],
  [0.18, 0.13],
  [0.07, 0.36],
  [0.01, 0.58],
  [0, 0.8],
  [0.015, 0.93],
  [0.04, 0.98],
];
const SECTION_ROUND = SECTION_BODY.map((_, k) => {
  const a = ((k * 20 - 37) * Math.PI) / 180;
  return [0.5 + 0.5 * Math.sin(a), 0.5 + 0.5 * Math.cos(a)];
});
// The mouth rakes 2.6 m from the upper lip to the lower, and is tilted: its outboard edge rides
// higher and its lower edge lies further outboard, the parallelogram of the SAC front view.
const lipZ = (y) => 3.4 + (y - 1.46) * 2.413;
const nacelleRing = (zs, side) => {
  const at = (k) => lookup(column(nacelle, k), zs),
    i = at(1),
    o = at(2),
    b = at(3),
    t = at(4),
    body = clamp((3.4 - zs) / 2),
    round = clamp((-2 - zs) / 2.6),
    skew = clamp(zs / 3.4);
  return SECTION_INLET.map((p, k) => {
    const bx = p[0] + (SECTION_BODY[k][0] - p[0]) * body,
      by = p[1] + (SECTION_BODY[k][1] - p[1]) * body,
      fx = bx + (SECTION_ROUND[k][0] - bx) * round,
      fy = by + (SECTION_ROUND[k][1] - by) * round,
      y = b + fy * (t - b) + skew * 0.11 * (fx - 0.5);
    return [side * (i + fx * (o - i) + skew * 0.19 * (1 - fy)), y, Math.min(zs, lipZ(y))];
  });
};
/** Center body and beavertail between the nacelles: z, half-breadth, deck, tunnel roof. */
const centerBody = [
  [4.8, 1, 2.62, 1.72],
  [0.9, 1, 2.62, 1.74],
  [0.8, 1, 2.45, 1.74],
  [-0.3, 1, 2.42, 1.74],
  [-1.9, 1, 2.4, 1.75],
  [-3.5, 1, 2.36, 1.75],
  [-4.4, 1, 2.3, 1.74],
  [-5, 0.9, 2.25, 1.73],
  [-5.9, 0.81, 2.12, 1.72],
  [-6.2, 0.56, 2.04, 1.72],
  [-6.56, 0.31, 1.96, 1.72],
];
export function buildF14D(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('F14-gray', '#929b9f', { side: T.DoubleSide }),
    upper = mat('F14-upper', '#7b858e', { side: T.DoubleSide }),
    nose = mat('F14-radome', '#a0a4a2', { side: T.DoubleSide }),
    dark = mat('F14-seals', '#24292c'),
    metal = mat('F14-alloy', '#b4bcc0', { metalness: 0.7 }),
    exhaust = mat('F14-exhaust', '#666866', { metalness: 0.72, side: T.DoubleSide }),
    liner = mat('F14-nozzle-liner', '#2c2b28', {
      metalness: 0.3,
      roughness: 0.8,
      side: T.DoubleSide,
    }),
    glass = mat('F14-glass', '#6f878c', {
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'F14-airframe'),
    bindings = [];
  const rings = stations.map(ring3d),
    index = (z) => stations.findIndex((q) => q.z === z),
    radome = index(10),
    open = [index(8.5), index(4.65)],
    outer = (i) => distinct(rings[i].filter((_, j) => j >= CAP && j <= RING - CAP));
  ruled(d, rings.slice(0, radome + 1), nose);
  // Cockpit aperture from just ahead of the panel to the bulkhead behind the RIO.
  ruled(
    d,
    rings.slice(radome),
    paint,
    (i, j) => i + radome >= open[0] && i + radome < open[1] && (j < CAP || j >= RING - CAP),
  );
  sheet(d, distinct(rings[0]), nose, [0, 0, 1]);
  sheet(d, distinct(rings.at(-1)), paint, [0, 0, -1]);
  d.rod([0, 2.075, 12.07], [0, 2.075, 12.3235], 0.009, metal);
  for (const z of [10, 9.3, 3.3])
    outline(
      d,
      outer(index(z)).map(([x, y, q]) => [x * 1.003, y, q]),
      0.004,
      dark,
    );
  // Anti-glare deck under the windscreen, ahead of the aperture.
  sheet(
    d,
    [
      ...canopy.slice(0, 3).map(([z, w, y]) => [w, y + 0.006, z]),
      ...canopy
        .slice(0, 3)
        .reverse()
        .map(([z, w, y]) => [-w, y + 0.006, z]),
    ],
    dark,
    [0, 1, 0],
  );
  // Windscreen and tandem canopy, then the same arch carried aft in paint.
  const arch = ([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      b + Math.sin((j * Math.PI) / 16) * (t - b),
    ]),
  });
  const cr = canopy.map(arch),
    bow = canopy.findIndex(([z]) => z === 8.15),
    mid = canopy.findIndex(([z]) => z === 6.5);
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  loft(d, turtledeck.map(arch), paint, {
    caps: false,
    skip: (_, j) => j === 16,
  });
  sheet(
    d,
    arch(turtledeck[0]).points.map((q) => [...q, turtledeck[0][0]]),
    paint,
    [0, 0, 1],
  );
  for (const i of [bow, mid, cr.length - 1])
    outline(
      d,
      cr[i].points.map((q) => [...q, cr[i].z]),
      i === bow ? 0.03 : 0.02,
      paint,
      false,
    );
  for (const j of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[j], r.z]),
      0.024,
      paint,
      false,
    );
  // Three-pane windscreen posts stop at the bow, leaving the canopy itself unobstructed.
  for (const j of [5, 11])
    outline(
      d,
      cr.slice(0, bow + 1).map((r) => [...r.points[j], r.z]),
      0.014,
      paint,
      false,
    );
  for (const side of [-1, 1]) {
    // The canopy sill sits below the frame, stepping down onto the shoulder.
    outline(
      d,
      [
        [8.9, 2.808],
        [8.1, 2.908],
        [7.3, 2.933],
        [6.5, 2.958],
        [5.7, 2.996],
        [4.9, 3.014],
      ].map(([z, y]) => [side * shoulderX(z, y) * 1.003, y, z]),
      0.006,
      dark,
      false,
    );
    const lip = nacelleRing(99, side),
      flank = NACELLE_STATIONS.map((z) => nacelleRing(z, side)),
      ng = group(root, `F14-nacelle-${side}`, [side * ENGINE_X, 0, 0]),
      nd = detailKit(ng, ng.name),
      local = ([x, y, z]) => [x - side * ENGINE_X, y, z];
    ruled(
      nd,
      flank.map((ring) => ring.map(local)),
      paint,
    );
    // Dark duct behind the raked lip; the round engine stays out of sight.
    const cx = side * 1.33,
      cy = 2.05,
      back = lip.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.8, 2.4]),
      lipLocal = lip.map(local),
      backLocal = back.map(local);
    for (let j = 0; j < lip.length; j++) {
      const k = (j + 1) % lip.length;
      quad(nd, lipLocal[j], lipLocal[k], backLocal[k], backLocal[j], dark, [
        cx - lip[j][0],
        cy - lip[j][1],
        0,
      ]);
    }
    sheet(nd, backLocal, dark, [0, 0, 1]);
    outline(nd, lipLocal, 0.024, paint);
    // Hinged ramps show under the upper lip of the mouth.
    quad(
      nd,
      local([side * 0.98, 2.42, 5.65]),
      local([side * 1.74, 2.52, 5.65]),
      local([side * 1.7, 2.3, 3.7]),
      local([side * 1.02, 2.2, 3.7]),
      upper,
      [0, -1, 0],
    );
    for (const z of [2.1, -1.9, -5.4])
      outline(
        nd,
        nacelleRing(z, side)
          .map(local)
          .map(([x, y, q]) => [x * 1.003, ENGINE_Y + (y - ENGINE_Y) * 1.003, q]),
        0.004,
        dark,
      );
    const circle = (r, z) => ({
      z,
      points: Array.from({ length: 24 }, (_, j) => [
        Math.sin((j * Math.PI) / 12) * r,
        ENGINE_Y + Math.cos((j * Math.PI) / 12) * r,
      ]),
    });
    // F110 nozzle closing to the SAC's 0.34 m exit at z -6.54.
    loft(nd, [circle(0.54, -6), circle(0.48, -6.25), circle(0.37, -6.54)], exhaust, {
      caps: false,
    });
    // Seen from behind the liner shows its inner face, so it is double-sided.
    loft(nd, [circle(0.34, -6.54), circle(0.34, -6.1)], liner, { caps: false });
    nd.add(new T.CircleGeometry(0.35, 24).rotateY(Math.PI), dark, [0, ENGINE_Y, -6.1]);
    for (let j = 0; j < 24; j += 2) {
      const a = (j * Math.PI) / 12;
      nd.rod(
        [Math.sin(a) * 0.5, ENGINE_Y + Math.cos(a) * 0.5, -6.16],
        [Math.sin(a) * 0.375, ENGINE_Y + Math.cos(a) * 0.375, -6.53],
        0.006,
        metal,
      );
    }
    nd.finish();
    // Fixed upper glove: leading edge traced from the intake to the sweep pivot, trailing edge
    // straight across at z 0.82. D-model glove vanes are omitted.
    wing(
      d,
      [
        [side * 0.74, 2.64, 6.03, 0.82, 0.09],
        [side * 1.72, 2.64, 6.03, 0.82, 0.1],
        [side * 1.85, 2.64, 5, 0.82, 0.1],
        [side * 2.44, 2.62, 3.4, 0.82, 0.085],
        [side * 3.1, 2.56, 1.8, 0.82, 0.05],
        [side * 3.19, 2.55, 1.4, 0.85, 0.03],
      ],
      upper,
    );
    // Lower glove lip: the wing slides between the two.
    wing(
      d,
      [
        [side * 2.05, 2.27, 3.2, -1.82, 0.05],
        [side * 3.19, 2.33, 1.4, 0.85, 0.02],
      ],
      paint,
    );
    // Wing plane sits at the fuselage side, well below the glove top; the panel droops outboard.
    const pivot = [side * 2.8, 2.4, 1.25],
      wg = group(root, `F14-wing-${side}`, pivot),
      wd = detailKit(wg, wg.name);
    const toLocal = (x, y, z) => [side * x - pivot[0], y - pivot[1], z - pivot[2]];
    const edge = (x) => {
      const t = (x - 3.69) / (9.22 - 3.69),
        le = 1.445 - 2.143 * t,
        te = -1.612 - 0.306 * t;
      return { le, te, y: 2.38 - 0.095 * t, h: te + (le - te) * 0.26 };
    };
    const ws = [
      [2.65, 2.4, 1.848, -1.555, 0.12],
      [3.45, 2.39, 1.538, -1.6, 0.1],
      [7.7, 2.31, -0.109, -1.834, 0.055],
      [9.22, 2.285, -0.698, -1.918, 0.03],
      [9.55, 2.28, -1.05, -1.93, 0.02],
      [9.77315, 2.28, -1.62, -1.95, 0.01],
    ];
    // Main wing ends at the hinge line; separately animated trailing-edge flaps.
    wing(
      wd,
      ws.map(([x, y, le, te, h]) => {
        const p = toLocal(x, y, le);
        return [p[0], p[1], p[2], te + (le - te) * 0.26 - pivot[2], h];
      }),
      paint,
    );
    for (let j = 0; j < 3; j++) {
      const lo = [3.45, 5.6, 7.7][j],
        hi = [5.6, 7.7, 9.4][j];
      const a = edge(lo),
        b = edge(hi),
        fg = group(
          wg,
          `F14-flap-${side}-${j}`,
          toLocal((lo + hi) / 2, (a.y + b.y) / 2, (a.h + b.h) / 2),
        ),
        fd = detailKit(fg, fg.name);
      wing(
        fd,
        [
          [
            side * (lo - (lo + hi) / 2),
            a.y - (a.y + b.y) / 2,
            a.h - (a.h + b.h) / 2,
            a.te - (a.h + b.h) / 2,
            0.018,
          ],
          [
            side * (hi - (lo + hi) / 2),
            b.y - (a.y + b.y) / 2,
            b.h - (a.h + b.h) / 2,
            b.te - (a.h + b.h) / 2,
            0.012,
          ],
        ],
        paint,
      );
      fd.finish();
      bindings.push({
        node: fg.name,
        source: 'flapPosition',
        property: 'rotation',
        axis: 'x',
        scale: -0.45,
      });
      const sp = group(
          wg,
          `F14-spoiler-${side}-${j}`,
          toLocal((lo + hi) / 2, (a.y + b.y) / 2 + 0.08, (a.h + b.h) / 2 + 0.35),
        ),
        sd = detailKit(sp, sp.name);
      sd.box([hi - lo - 0.04, 0.016, 0.32], [0, 0, -0.16], upper);
      sd.finish();
      bindings.push({
        node: sp.name,
        source: side === 1 ? 'leftSpoiler' : 'rightSpoiler',
        property: 'rotation',
        axis: 'x',
        scale: 0.55,
      });
    }
    for (const [x, y, le, te] of ws.slice(1, 3)) {
      const a = toLocal(x, y + 0.07, le - 0.15),
        b = toLocal(x, y + 0.07, te + 0.18);
      wd.rod(a, b, 0.004, dark);
    }
    outline(
      wd,
      ws.slice(0, 4).map(([x, y, le]) => toLocal(x, y + 0.025, le)),
      0.005,
      dark,
      false,
    );
    for (let j = 0; j < 25; j++) {
      const x = 3.5 + j * 0.24,
        e = edge(x);
      wd.add(new T.SphereGeometry(0.006, 4, 3), metal, toLocal(x, e.y + 0.07, e.le - 0.2));
    }
    wd.finish();
    bindings.push({
      node: wg.name,
      source: 'sweepAngle',
      property: 'rotation',
      axis: 'y',
      scale: side,
      responseSeconds: 1,
    });
    // All-moving stabilators low on the nacelle, 32 ft 8.5 in overall span.
    const tg = group(root, `F14-stabilator-${side}`, [side * 2.2, 1.78, -4.9]),
      td = detailKit(tg, tg.name);
    wing(
      td,
      [
        [0, 0, 2.33, -1.45, 0.085],
        [side * 2.21, -0.02, -0.28, -1.88, 0.04],
        [side * 2.52, -0.02, -0.7, -1.76, 0.03],
        [side * 2.785, -0.02, -1.15, -1.25, 0.01],
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
    // Twin fins canted five degrees. Root spacing and the annotated 128in tip spacing both fix the
    // plane: 1.39 m out at the nacelle, 1.60 m at the tip.
    const FIN_BASE = 2.38,
      FIN_Z = -4.4,
      HINGE_Y = 2.45,
      HINGE_Z = -4.76,
      HINGE_DY = 2.17,
      HINGE_DZ = -1.56,
      fin = group(root, `F14-fin-${side}`, [side * 1.37, FIN_BASE, FIN_Z]);
    fin.rotation.z = -side * 0.0873;
    const f = detailKit(fin, fin.name);
    const contour = [
      [2.25, -1.9],
      [2.45, -2.2],
      [2.63, -3.1],
      [2.76, -3.23],
      [4.87, -5.72],
      [4.895, -5.85],
      [4.895, -6.79],
      [4.84, -6.79],
      [4.62, -6.76],
      [4.62, -6.32],
      [HINGE_Y, HINGE_Z],
      [2.25, HINGE_Z],
    ].map(([y, z]) => [0, y - FIN_BASE, z - FIN_Z]);
    for (const x of [-0.045, 0.045])
      sheet(
        f,
        contour.map(([a, b, c]) => [a + x, b, c]),
        upper,
        [Math.sign(x), 0, 0],
      );
    for (let j = 0; j < contour.length; j++)
      quad(
        f,
        contour[j].map((v, i) => v + (i === 0 ? -0.045 : 0)),
        contour[(j + 1) % contour.length].map((v, i) => v + (i === 0 ? -0.045 : 0)),
        contour[(j + 1) % contour.length].map((v, i) => v + (i === 0 ? 0.045 : 0)),
        contour[j].map((v, i) => v + (i === 0 ? 0.045 : 0)),
        upper,
        [0, 1, 0],
      );
    // The rudder hinge runs up the fin's sweep, so the group is tilted to put local y on it.
    const hg = group(fin, `F14-rudder-hinge-${side}`, [0, HINGE_Y - FIN_BASE, HINGE_Z - FIN_Z]),
      tilt = Math.atan2(HINGE_DZ, HINGE_DY);
    hg.rotation.x = tilt;
    const rg = group(hg, `F14-rudder-${side}`),
      rd = detailKit(rg, rg.name),
      hingeLocal = ([y, z]) => {
        const dy = y - HINGE_Y,
          dz = z - HINGE_Z;
        return [
          0,
          dy * Math.cos(tilt) + dz * Math.sin(tilt),
          -dy * Math.sin(tilt) + dz * Math.cos(tilt),
        ];
      };
    sheet(
      rd,
      [
        [2.45, -4.76],
        [4.6, -6.3],
        [4.6, -6.73],
        [2.42, -6.06],
      ].map(hingeLocal),
      paint,
      [side, 0, 0],
    );
    rd.finish();
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.4,
    });
    // Exterior operator identifiers are supplied by the selected livery.
    f.finish();
    // Ventral fins hang under the engines, not outboard of them.
    sheet(
      d,
      [
        [side * 1.45, 1.2, -1.5],
        [side * 1.45, 0.43, -1.87],
        [side * 1.45, 0.86, -4.35],
        [side * 1.45, 1.2, -4.6],
      ],
      upper,
      [side, 0, 0],
    );
    // D-model dual chin optics beneath the forward fuselage.
    const cg = group(root, `F14-chin-${side}`, [side * 0.15, 1.5, 9.66]),
      cd = detailKit(cg, cg.name);
    cd.add(new T.CylinderGeometry(0.135, 0.125, 1.18, 12).rotateX(Math.PI / 2), upper, [0, 0, 0]);
    cd.add(new T.CircleGeometry(0.11, 20), dark, [0, 0, 0.595]);
    cd.box([0.1, 0.12, 0.9], [0, 0.13, -0.04], upper);
    cd.finish();
    // The long nose-gear bay door hangs below the keel when the gear is down.
    const dg = group(root, `F14-nose-door-${side}`, [side * 0.27, 1.66, 8.19]),
      dd = detailKit(dg, dg.name);
    dd.box([0.03, 0.37, 1.76], [0, -0.185, 0], paint);
    dd.finish();
    bindings.push({
      node: dg.name,
      source: 'gear',
      property: 'rotation',
      axis: 'z',
      scale: (side * Math.PI) / 2,
      offset: (-side * Math.PI) / 2,
    });
  }
  // Pancake deck, tunnel roof and beavertail between the nacelles.
  ruled(
    d,
    centerBody.map(([z, h, t, b]) => [
      [h, t, z],
      [h, b, z],
      [-h, b, z],
      [-h, t, z],
    ]),
    paint,
  );
  d.rod([0, 1.86, -6.56], [0, 1.86, -6.79], 0.05, dark);
  // Sturdy naval undercarriage: twin nose wheels, single large main wheels and braces.
  for (const [name, x, z, r, w] of [
    ['nose', 0, 7.01929, 0.23, 0.13],
    ['left', 2.5019, 0, 0.48, 0.27],
    ['right', -2.5019, 0, 0.48, 0.27],
  ]) {
    const noseGear = name === 'nose',
      gy = noseGear ? 1.76 : 2.3,
      g = group(root, `F14-gear-${name}`, [x, gy, z]),
      gd = detailKit(g, g.name);
    const wheel = (xx) => {
      gd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), dark, [xx, r - gy, 0]);
      for (const side of [-1, 1]) {
        gd.add(new T.CylinderGeometry(r * 0.56, r * 0.56, 0.018, 20).rotateZ(Math.PI / 2), metal, [
          xx + side * (w / 2 + 0.008),
          r - gy,
          0,
        ]);
        for (let j = 0; j < 8; j++) {
          const a = (j * Math.PI) / 4;
          gd.add(new T.SphereGeometry(0.02, 6, 4), dark, [
            xx + side * (w / 2 + 0.02),
            r - gy + Math.sin(a) * r * 0.38,
            Math.cos(a) * r * 0.38,
          ]);
        }
      }
    };
    if (noseGear) {
      wheel(-0.23);
      wheel(0.23);
      gd.rod([-0.23, r - gy, 0], [0.23, r - gy, 0], 0.03, metal);
    } else wheel(0);
    // Main legs lean up and inboard into the nacelle; the nose leg stands upright.
    const top = noseGear ? [0, 0, 0] : [-Math.sign(x) * 0.62, -0.72, 0];
    gd.rod(top, [0, r - gy + 0.08, 0], noseGear ? 0.055 : 0.075, metal);
    gd.rod([noseGear ? 0 : -Math.sign(x) * 0.7, -0.5, -0.6], [0, r - gy + 0.2, 0], 0.045, paint);
    gd.rod([0, -0.45, -0.15], [0, -0.85, -0.35], 0.033, metal);
    gd.rod([0, -0.85, -0.35], [0, -1.08, -0.08], 0.033, metal);
    // Main legs carry a forward drag brace from the lower strut up to the lower glove.
    if (!noseGear) gd.rod([0, r - gy + 0.75, 0.02], [0, -0.02, 0.95], 0.05, metal);
    if (!noseGear) gd.box([0.035, 0.6, 0.9], [-Math.sign(x) * 0.42, -0.95, -0.1], paint);
    if (noseGear) {
      const bar = group(g, 'F14-launch-bar', [0, r - gy + 0.2, 0]);
      const bd = detailKit(bar, bar.name);
      bd.rod([0, 0, 0], [0, -0.08, 0.85], 0.045, metal);
      bd.finish();
      bindings.push({
        node: bar.name,
        source: 'gear',
        property: 'rotation',
        axis: 'x',
        scale: Math.PI / 2,
        offset: -Math.PI / 2,
      });
    }
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: noseGear ? 'x' : 'z',
      scale: noseGear ? Math.PI / 2 : Math.sign(x) * 1.35,
      offset: noseGear ? -Math.PI / 2 : Math.sign(x) * -1.35,
    });
  }
  const hook = group(root, 'arresting-hook', [0, 1.9, -4.8]);
  const hd = detailKit(hook, 'hook-skin');
  hd.rod([0, 0, 0], [0, -0.25, -1.7], 0.04, metal);
  hd.rod([0, -0.25, -1.7], [0, -0.15, -1.82], 0.055, metal);
  hd.finish();
  for (const side of [-1, 1]) {
    // Access seams and selected fastener rows are geometry, never photographic textures.
    for (const [z, y, w, h] of [
      [8.9, 2.3, 0.42, 0.25],
      [6.8, 2.1, 0.72, 0.28],
    ]) {
      const x = side * shoulderX(z, 2.55) * 1.004;
      outline(
        d,
        [
          [x, y - h / 2, z - w / 2],
          [x, y + h / 2, z - w / 2],
          [x, y + h / 2, z + w / 2],
          [x, y - h / 2, z + w / 2],
        ],
        0.004,
        dark,
      );
    }
    for (let j = 0; j < 20; j++) {
      const z = 4.9 + j * 0.2;
      d.add(new T.SphereGeometry(0.006, 4, 3), metal, [side * shoulderX(z, 2.8) * 1.002, 2.8, z]);
    }
    const decal = group(root, `F14-stencil-${side}`, [side * 0.785, 2.44, 7.75]);
    decal.rotation.y = (side * Math.PI) / 2;
    const dd = detailKit(decal, decal.name);
    dd.text('RESCUE', [0, 0, 0], 0.045, 0, d.yellow);
    dd.text('DANGER', [0, -0.13, 0], 0.04, 0, d.red);
    dd.finish();
  }
  d.finish();
  const interior = f14Cockpits(root, { paint, dark, metal, glass });
  Object.assign(interior.derived, {
    sweepSpeed: { op: 'subtract', args: ['trueAirspeed', 140] },
    sweepFractionRaw: { op: 'divide', args: ['sweepSpeed', 160] },
    sweepFraction: { op: 'clamp', args: ['sweepFractionRaw', 0, 1] },
    sweepAngle: {
      op: 'multiply',
      args: ['sweepFraction', (48 * Math.PI) / 180],
    },
    sweepDeltaDegrees: { op: 'multiply', args: ['sweepFraction', 48] },
    sweepDegrees: { op: 'add', args: [20, 'sweepDeltaDegrees'] },
    negativeRoll: { op: 'multiply', args: ['rollInput', -1] },
    leftSpoiler: { op: 'max', args: ['negativeRoll', 0] },
    rightSpoiler: { op: 'max', args: ['rollInput', 0] },
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.3] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.12] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: f14Frame(),
    enginePoints: [
      { id: 'engine-1', position: [ENGINE_X, ENGINE_Y, -5.5] },
      { id: 'engine-2', position: [-ENGINE_X, ENGINE_Y, -5.5] },
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

function f14Cockpits(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'F14-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'F14');
  const { bindings, derived, ink, black, amber } = ins,
    panel = mat('F14-panel', '#525b5d', { side: T.DoubleSide }),
    seat = mat('F14-cushion', '#4c5348'),
    belt = mat('F14-harness', '#a4a28d');
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
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
      { component: 'aircraftState', path: [k] },
    ]),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
  for (const [key, property] of [
    ['pitchInput', 'pitch'],
    ['rollInput', 'roll'],
    ['yawInput', 'yaw'],
    ['power', 'power'],
  ])
    sources[key] = { component: 'aircraftInput', path: [property] };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 1.9438444924406] },
    feet: { op: 'multiply', args: ['altitude', 3.2808398950131] },
    altitudeHundreds: { op: 'modulo', args: ['feet', 1000] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    headingDegrees: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    aoaDegrees: { op: 'multiply', args: ['angleOfAttack', 180 / Math.PI] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
  });
  // Coordinates are measured from the two different normalized foldouts (FO-3 / FO-4).
  for (const rear of [false, true]) {
    const prefix = rear ? 'RIO' : 'pilot',
      k = rear ? 0.002 : 0.0018,
      cx = rear ? 862 : 754,
      cy = rear ? 420 : 400,
      y0 = rear ? 2.78 : 2.94,
      z = rear ? 6.5 : 8.28;
    const at = (u, v, dz = 0) => [(cx - u) * k, y0 - (v - cy) * k, z + dz];
    const edge = rear
      ? [
          [635, 430],
          [650, 325],
          [737, 325],
          [737, 232],
          [986, 232],
          [986, 325],
          [1031, 322],
          [1078, 360],
          [1088, 428],
          [946, 440],
          [946, 485],
          [921, 499],
          [800, 499],
          [776, 480],
          [776, 431],
        ]
      : [
          [535, 450],
          [540, 369],
          [579, 326],
          [634, 304],
          [686, 330],
          [806, 330],
          [863, 304],
          [908, 326],
          [962, 389],
          [977, 448],
          [904, 459],
          [699, 459],
          [688, 451],
        ];
    const holes = [];
    const box = (u, v, w, h, material = black, depth = 0.015) =>
      d.box([w * k, h * k, depth], at(u, v, -0.03 + depth / 2), material);
    const text = (label, u, v, h = 7, material = ink, role = 'panel') =>
      d.text(label, at(u, v, -0.034), h * k, Math.PI, material, role);
    const circleHole = (u, v, r) =>
      Array.from({ length: 40 }, (_, i) =>
        at(u + Math.cos((i * Math.PI) / 20) * r, v + Math.sin((i * Math.PI) / 20) * r),
      );
    const rect = (u, v, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([a, b]) => at(u + a * w, v + b * h, dz));
    const display = (label, u, v, w, h, live = false) => {
      const outer = [
        [-0.5, -0.38],
        [-0.38, -0.5],
        [0.38, -0.5],
        [0.5, -0.38],
        [0.5, 0.38],
        [0.38, 0.5],
        [-0.38, 0.5],
        [-0.5, 0.38],
      ].map(([a, b]) => at(u + a * w, v + b * h, -0.015));
      const window = rect(u, v, w * 0.76, h * 0.73, -0.015);
      sheet(d, outer, black, [0, 0, -1], live ? [window] : []);
      for (let j = 0; j < outer.length; j++) {
        const a = outer[j],
          b = outer[(j + 1) % outer.length];
        quad(d, a, b, [b[0], b[1], z + 0.06], [a[0], a[1], z + 0.06], black, [
          a[0] - at(u, v)[0],
          a[1] - at(u, v)[1],
          0,
        ]);
      }
      for (const side of [-1, 1])
        for (let j = 0; j < 6; j++) {
          box(u + side * (w / 2 - 5), v - h * 0.36 + j * h * 0.144, 5, 7, m.paint);
          box(u - w * 0.35 + j * w * 0.14, v + side * (h / 2 - 5), 6, 5, m.paint);
        }
      text(label, u, v + h * 0.37, 5);
      if (live) {
        const hpos = at(u, v - 11, 0.015);
        ins.horizon(`${prefix}-${label}`, hpos, w * k * 0.65, h * k * 0.48, {
          blankBackdrop: true,
        });
        ins.readout(
          `${prefix}-${label}-speed`,
          at(u - 30, v + 19, -0.047),
          'knots',
          3,
          0.012,
          ink,
          false,
          true,
        );
        ins.readout(
          `${prefix}-${label}-altitude`,
          at(u + 22, v + 19, -0.047),
          'feet',
          5,
          0.011,
          ink,
          true,
          true,
        );
        text('TAS', u - 30, v + 29, 4, ink, 'display');
        text('GEO FT', u + 22, v + 29, 4, ink, 'display');
      } else text('INOP', u, v, 8, amber, 'display');
    };
    const standby = rear ? [708, 356, 21] : [668, 356, 25];
    holes.push(circleHole(...standby));
    holes.push(
      rear ? rect(1017, 393, 106 * 0.76, 93 * 0.73) : rect(754, 393, 108 * 0.76, 115 * 0.73),
    );
    sheet(
      d,
      edge.map((p) => at(...p)),
      panel,
      [0, 0, -1],
      holes,
    );
    outline(
      d,
      edge.map((p) => at(...p, -0.015)),
      0.009,
      black,
    );
    for (let j = 0; j < edge.length; j += 2) {
      const p = at(...edge[j], -0.021);
      d.add(new T.SphereGeometry(0.0035, 6, 4), m.metal, p);
    }
    ins.horizon(
      `${prefix}-standby`,
      at(standby[0], standby[1], 0.01),
      standby[2] * k * 1.76,
      standby[2] * k * 1.76,
      { round: true, blankBackdrop: true },
    );
    const speed = rear ? [667, 405, 18] : [581, 379, 18],
      alt = rear ? [710, 405, 19] : [581, 418, 18],
      vsi = rear ? [667, 365, 17] : [621, 379, 18];
    ins.dial(
      `${prefix}-airspeed`,
      at(speed[0], speed[1], -0.008),
      speed[2] * k,
      'knots',
      [
        [0, 0],
        [100, 0.65],
        [200, 1.7],
        [400, 3.4],
        [600, 4.6],
        [800, 5.5],
      ],
      [0, 100, 200, 400, 600, 800],
      'TAS',
      {
        tickLabels: { 0: 0, 100: 1, 200: 2, 400: 4, 600: 6, 800: 8 },
        minorStep: 20,
      },
    );
    ins.dial(
      `${prefix}-altimeter`,
      at(alt[0], alt[1], -0.008),
      alt[2] * k,
      'altitudeHundreds',
      [
        [0, 0],
        [1000, Math.PI * 2],
      ],
      [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
      'GEO FT',
      {
        period: Math.PI * 2,
        tickLabels: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i * 100, i])),
      },
    );
    ins.dial(
      `${prefix}-vertical-speed`,
      at(vsi[0], vsi[1], -0.008),
      vsi[2] * k,
      'verticalFpm',
      [
        [-6000, -Math.PI / 2],
        [0, Math.PI / 2],
        [6000, 1.5 * Math.PI],
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
    if (!rear) {
      display('FLIGHT', 754, 393, 108, 115, true);
      display('NAV', 866, 390, 111, 111, false);
      // HUD is physical glass only until a collimated flight-symbol renderer is available.
      const hp = [
        [707, 294],
        [707, 185],
        [726, 175],
        [785, 175],
        [803, 185],
        [803, 294],
      ].map((p) => at(...p, -0.12));
      sheet(d, hp, m.glass, [0, 0, -1]);
      outline(d, hp, 0.012, black);
      box(754, 309, 103, 35, black, 0.12);
      text('HUD', 754, 310, 7);
      box(656, 295, 22, 58, black);
      text('AOA DEG', 656, 322, 4);
      const ag = group(cabin, 'F14-AOA', at(656, 312, -0.035)),
        ad = detailKit(ag, ag.name);
      ad.box([0.023, 0.003, 0.002], [0, 0, 0], ink);
      ad.finish();
      bindings.push({
        node: ag.name,
        source: 'aoaDegrees',
        property: 'position',
        axis: 'y',
        keys: [
          [-10, 0],
          [40, 0.075],
        ],
      });
      box(834, 297, 20, 54, black);
      text('SWEEP', 834, 326, 4);
      const sg = group(cabin, 'F14-sweep-pointer', at(834, 315, -0.035)),
        sd = detailKit(sg, sg.name);
      sd.box([0.025, 0.003, 0.002], [0, 0, 0], ink);
      sd.finish();
      bindings.push({
        node: sg.name,
        source: 'sweepDegrees',
        property: 'position',
        axis: 'y',
        keys: [
          [20, 0],
          [68, 0.075],
        ],
      });
      ins.available('AOA', 'aoaDegrees', ag.name);
      ins.available('sweep', 'sweepDegrees', sg.name);
      for (let j = 0; j < 6; j++) {
        box(656, 312 - j * 8, 10, 1, ink);
        box(834, 315 - j * 8, 10, 1, ink);
      }
      for (const [u, v, r, label] of [
        [621, 418, 18, 'RAD ALT'],
        [848, 247, 20, 'COMPASS'],
      ]) {
        pt.gauge(...at(u, v).slice(0, 2), z - 0.01, r * k, black, false);
        text(label, u, v, 4);
        text('--', u, v + 7, 5, amber, 'display');
      }
      for (const [u, v, w, h, label] of [
        [641, 513, 80, 107, 'ENGINE'],
        [870, 519, 72, 100, 'FUEL'],
        [786, 510, 29, 29, 'CLOCK'],
        [932, 502, 30, 30, 'OXY'],
      ]) {
        box(u, v, w, h);
        text(label, u, v - h * 0.28, 5);
        text('--', u, v, 8, amber, 'display');
      }
      for (const [u, label] of [
        [616, 'RPM'],
        [641, 'EGT'],
        [666, 'FF'],
      ]) {
        text(label, u, 491, 4);
        for (const offset of [-5, 5]) {
          d.rod(at(u + offset, 502, -0.035), at(u + offset, 548, -0.035), 0.0007, ink);
          for (let j = 0; j < 7; j++)
            d.rod(
              at(u + offset, 502 + j * 7, -0.035),
              at(u + offset + 2, 502 + j * 7, -0.035),
              0.0005,
              ink,
            );
        }
        text('--', u, 555, 5, amber, 'display');
      }
      for (const [u, v, label] of [
        [562, 493, 'HYD'],
        [584, 493, 'OIL'],
        [562, 521, 'CABIN'],
        [584, 521, 'BRAKE'],
      ]) {
        pt.gauge(...at(u, v).slice(0, 2), z - 0.02, 10 * k, black, false);
        text(label, u, v + 14, 3);
        text('--', u, v, 4, amber, 'display');
      }
      for (const side of [-1, 1]) {
        text(side === 1 ? 'R' : 'L', 870 + side * 20, 493, 5);
        d.rod(at(870 + side * 20, 502, -0.035), at(870 + side * 20, 545, -0.035), 0.0007, ink);
        for (let j = 0; j < 6; j++)
          d.rod(
            at(870 + side * 20, 502 + j * 8, -0.035),
            at(870 + side * 20 + 3, 502 + j * 8, -0.035),
            0.0005,
            ink,
          );
      }
      // Sloped knee panels continue below the main display edge.
      for (const [u, v, w, h] of [
        [610, 513, 158, 110],
        [755, 513, 122, 110],
        [895, 513, 138, 110],
      ]) {
        sheet(
          d,
          [
            [u - w / 2, v - h / 2],
            [u + w / 2, v - h / 2],
            [u + w / 2, v + h / 2],
            [u - w / 2, v + h / 2],
          ].map((p) => at(...p, 0.025)),
          panel,
          [0, 0, -1],
        );
      }
    } else {
      display('DD', 862, 283, 244, 100);
      display('PTID', 862, 420, 163, 157);
      display('FLIGHT', 1017, 393, 106, 93, true);
      // Separate keypad rows and knobs around the digital display, matching the D layout.
      for (const side of [-1, 1])
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 4; col++)
            box(862 + side * (73 + col * 9), 299 + row * 11, 6, 7, m.paint);
      for (const side of [-1, 1])
        for (let j = 0; j < 4; j++) {
          const p = at(862 + side * (73 + j * 14), 259, -0.035);
          d.add(new T.CylinderGeometry(0.005, 0.006, 0.009, 10).rotateX(Math.PI / 2), m.metal, p);
        }
      box(862, 184, 68, 37);
      text('STATUS', 862, 184, 5);
      d.rod(at(803, 210, -0.08), at(918, 210, -0.08), 0.012, black);
      for (const [u, v, w, h, label] of [
        [738, 484, 77, 90, 'DATA'],
        [981, 483, 66, 93, 'CAUTION'],
        [1064, 542, 82, 80, 'ENTRY'],
      ]) {
        box(u, v, w, h);
        text(label, u, v, 5);
      }
      // RIO control is a display hand-controller, not a second pilot's flight stick.
      box(862, 580, 81, 80);
      const hc = at(862, 579, -0.1);
      d.rod(hc, [hc[0] + 0.025, hc[1] + 0.08, hc[2] - 0.06], 0.017, black);
    }
    const hdg = rear ? [673, 460, 22] : [668, 410, 24];
    pt.gauge(...at(hdg[0], hdg[1]).slice(0, 2), z - 0.012, hdg[2] * k, black, false);
    const hg = group(cabin, `F14-${prefix}-heading`, at(hdg[0], hdg[1], -0.03)),
      hd = detailKit(hg, hg.name),
      r = hdg[2] * k * 0.85;
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (rr) => [-Math.sin(a) * rr, Math.cos(a) * rr, 0];
      hd.rod(p(r * 0.87), p(r), 0.0007, ink);
      if (deg % 30 === 0)
        hd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(r * 0.67),
          0.006,
          Math.PI,
          ink,
        );
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
    ins.available(`${prefix}-heading`, 'trueHeading', hg.name);
    d.rod(
      at(hdg[0], hdg[1] - hdg[2], -0.035),
      at(hdg[0], hdg[1] - hdg[2] + 5, -0.035),
      0.001,
      amber,
    );
    const sz = rear ? 5.9 : 7.6,
      base = rear ? 2.01 : 1.94;
    d.box([0.96, 0.035, 1.55], [0, base, sz + 0.15], black);
    for (const side of [-1, 1]) {
      d.box([0.17, 0.24, 1.35], [side * 0.39, base + 0.29, sz + 0.1], panel);
      const labels = rear
        ? side === 1
          ? ['DATA', 'COOLING', 'ICS', 'SENSOR', 'TACAN', 'V/UHF']
          : ['POWER', 'LIGHTS', 'IFF', 'DATA', 'COMM', 'REMOTE']
        : side === 1
          ? ['VENT', 'ICS', 'COMM', 'TACAN', 'V/UHF', 'TRIM']
          : ['TEST', 'LIGHTS', 'AIR COND', 'GEN', 'OXYGEN', 'CAUTION'];
      for (let j = 0; j < 6; j++) {
        const pg = group(cabin, `F14-${prefix}-console-${side}-${j}`, [
          side * 0.39,
          base + 0.43,
          sz - 0.44 + j * 0.22,
        ]);
        pg.rotation.x = Math.PI / 2;
        const pd = detailKit(pg, pg.name);
        pd.box([0.15, 0.19, 0.014], [0, 0, 0.007], black);
        pd.text(labels[j], [0, 0.065, -0.003], 0.009, Math.PI, ink);
        for (const a of [-1, 1])
          for (const b of [-1, 1])
            pd.add(new T.SphereGeometry(0.0022, 6, 4), m.metal, [a * 0.066, b * 0.082, -0.002]);
        if (labels[j] === 'CAUTION') {
          for (let row = 0; row < 5; row++)
            for (let col = 0; col < 3; col++) {
              pd.box(
                [0.035, 0.018, 0.003],
                [(col - 1) * 0.043, 0.032 - row * 0.024, -0.002],
                m.paint,
              );
              pd.box(
                [0.028, 0.012, 0.004],
                [(col - 1) * 0.043, 0.032 - row * 0.024, -0.004],
                black,
              );
            }
        } else {
          for (let q = 0; q < 2 + (j % 2); q++) {
            const xx = (q - (1 + (j % 2)) / 2) * 0.04;
            pd.add(new T.CylinderGeometry(0.011, 0.013, 0.014, 10).rotateX(Math.PI / 2), m.paint, [
              xx,
              0.025,
              -0.009,
            ]);
            pd.rod([xx - 0.006, 0.025, -0.017], [xx + 0.006, 0.025, -0.017], 0.001, ink);
          }
          for (let q = 0; q < 2 + (j % 3); q++) {
            const xx = (q - (1 + (j % 3)) / 2) * 0.032;
            pd.add(new T.CylinderGeometry(0.006, 0.006, 0.004, 10).rotateX(Math.PI / 2), m.metal, [
              xx,
              -0.032,
              -0.002,
            ]);
            pd.rod([xx, -0.032, -0.004], [xx, -0.04, -0.022], 0.0025, m.metal);
          }
          pd.text(j % 2 ? 'OFF   ON' : 'MODE', [0, -0.067, -0.003], 0.006, Math.PI, ink);
        }
        pd.finish();
      }
    }
    const sg = group(cabin, `F14-${prefix}-seat`, [0, base + 0.45, sz + 0.02]);
    sg.rotation.x = -0.29;
    const sd = detailKit(sg, sg.name);
    beveledBox(sd, [0.46, 0.11, 0.46], [0, 0, 0.13], seat);
    beveledBox(sd, [0.49, 0.74, 0.11], [0, 0.42, -0.14], seat);
    beveledBox(sd, [0.29, 0.24, 0.15], [0, 0.9, -0.14], black);
    for (const side of [-1, 1]) {
      sd.rod([side * 0.25, -0.1, -0.18], [side * 0.25, 1, -0.18], 0.021, m.metal);
      sd.rod([side * 0.17, 0.7, -0.07], [side * 0.04, 0.1, 0.025], 0.025, belt);
    }
    sd.finish();
    if (!rear) {
      const st = group(cabin, 'F14-control-stick', [0, base + 0.12, sz + 0.65]),
        dd = detailKit(st, st.name);
      dd.rod([0, 0, 0], [0, 0.43, -0.06], 0.025, black);
      dd.box([0.065, 0.1, 0.07], [0, 0.46, -0.06], black);
      dd.add(new T.SphereGeometry(0.009, 8, 6), d.red, [0.025, 0.49, -0.1]);
      dd.finish();
      bindings.push(
        {
          node: st.name,
          source: 'pitchInput',
          property: 'rotation',
          axis: 'x',
          scale: -0.18,
        },
        {
          node: st.name,
          source: 'rollInput',
          property: 'rotation',
          axis: 'z',
          scale: 0.25,
        },
      );
      for (const side of [-1, 1]) {
        const p = group(cabin, `F14-pedal-${side}`, [side * 0.15, base + 0.1, sz + 1.01]),
          pd = detailKit(p, p.name);
        pd.box([0.14, 0.16, 0.05], [0, 0, 0], m.metal);
        for (let j = 0; j < 5; j++)
          pd.box([0.12, 0.006, 0.004], [0, -0.06 + j * 0.03, -0.028], black);
        pd.finish();
        bindings.push({
          node: p.name,
          source: 'yawInput',
          property: 'position',
          axis: 'z',
          scale: -side * 0.07,
        });
      }
      for (let j = 0; j < 2; j++) {
        const t = group(cabin, `F14-throttle-${j}`, [0.36 + j * 0.065, base + 0.4, sz + 0.45]),
          td = detailKit(t, t.name);
        td.rod([0, 0, 0], [0, 0.13, 0], 0.012, black);
        td.box([0.055, 0.04, 0.075], [0, 0.15, 0], black);
        td.finish();
        bindings.push({
          node: t.name,
          source: 'power',
          property: 'rotation',
          axis: 'x',
          scale: 0.65,
          offset: -0.3,
        });
      }
      for (let j = 0; j < 3; j++) {
        const l = group(cabin, `F14-gear-lamp-${j}`, at(575 + j * 10, 340, -0.035)),
          ld = detailKit(l, l.name);
        ld.box([0.011, 0.009, 0.002], [0, 0, 0], d.green);
        ld.finish();
        bindings.push({
          node: l.name,
          source: 'gearDown',
          property: 'visible',
          scale: 1,
        });
      }
    }
  }
  // Tub walls rise to a shelf, then a liner follows the canopy rail so nothing shows the hollow body.
  const rails = canopy.filter(([z]) => z <= 8.5 && z >= 4.65);
  for (const side of [-1, 1]) {
    sheet(
      d,
      [
        [side * 0.55, 1.85, 4.65],
        [side * 0.55, 1.85, 8.5],
        [side * 0.55, 2.7, 8.5],
        [side * 0.55, 2.7, 4.65],
      ],
      panel,
      [-side, 0, 0],
    );
    for (let i = 0; i < rails.length - 1; i++) {
      const [z0, w0, y0] = rails[i],
        [z1, w1, y1] = rails[i + 1];
      quad(
        d,
        [side * 0.55, 2.7, z0],
        [side * 0.55, 2.7, z1],
        [side * (w1 - 0.012), y1 - 0.004, z1],
        [side * (w0 - 0.012), y0 - 0.004, z0],
        panel,
        [-side, 0.2, 0],
      );
    }
  }
  // Bulkhead behind the RIO closes the tub under the aft canopy frame.
  const aft = canopy.at(-1);
  sheet(
    d,
    [
      [0.55, 1.85, 4.66],
      [0.55, 2.7, 4.66],
      [aft[1] - 0.012, aft[2] - 0.004, 4.66],
      [-(aft[1] - 0.012), aft[2] - 0.004, 4.66],
      [-0.55, 2.7, 4.66],
      [-0.55, 1.85, 4.66],
    ],
    black,
    [0, 0, 1],
  );
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
