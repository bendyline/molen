/** F-15C MSIP, clean airframe, 1992 F100-PW-220 configuration.
 * Main-axle datum, +Z forward, +X pilot left. Separate measured SAC and MSIP panels.
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
export const f15Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.62,
  cy: 2.3,
  ry: 0.65,
  cabinZ: 6.77,
  cabinWidth: 0.88,
  eye: [0, 3.42, 6.77],
  panelZ: 7.64,
  floor: 1.98,
});
// The tables below are in a body datum. The finished airframe sits this far forward of the gear:
// the matched photograph and the drawing both place the nose 6.4 m ahead of the nose gear.
const NOSE_Z = 11.6,
  BODY_SHIFT = 0.22;
// Piecewise-linear lookup in a table sorted by descending z.
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
/** SAC 1992 clean three-view, traced at 46.98 px/m along the body and 51.1 px/m up from the static
 * ground line (the drawing's vertical scale, calibrated by its own 12.00 ft canopy bar), then
 * corrected against a calibrated taxi photograph. The drawing is schematic at the radome, so depth
 * there follows the photograph. Each row: distance aft of the tip, half-breadth, keel, crown. Crown
 * slope only ever falls going aft and the tip is rounded: the radome is a full convex ogive, and a
 * single concave station reads as a needle. */
const forebody = [
  [0, 0.006, 1.933, 1.947],
  [0.02, 0.03, 1.912, 1.972],
  [0.06, 0.052, 1.894, 1.998],
  [0.12, 0.074, 1.876, 2.028],
  [0.2, 0.1, 1.856, 2.064],
  [0.36, 0.15, 1.818, 2.134],
  [0.52, 0.205, 1.78, 2.204],
  [0.7, 0.265, 1.734, 2.278],
  [1.04, 0.365, 1.665, 2.405],
  [1.38, 0.45, 1.61, 2.52],
  [1.72, 0.515, 1.575, 2.615],
  [2.06, 0.56, 1.56, 2.7],
  [2.41, 0.595, 1.555, 2.775],
  [2.75, 0.63, 1.55, 2.85],
  [3.15, 0.66, 1.555, 2.935],
].map(([d, w, b, t]) => [Number((NOSE_Z - d).toFixed(3)), w, b, t]);
/** Canopy stations: z, half-width at the rail, rail height, crown. The 12.00 ft crown sits over
 * the seat; the long aft taper runs into the dorsal spine rather than ending as a bubble. */
const canopy = [
  [8.4, 0.01, 2.945, 2.955],
  [8.17, 0.2, 2.935, 3.1],
  [7.91, 0.396, 2.935, 3.26],
  [7.55, 0.44, 2.95, 3.44],
  [7.32, 0.462, 2.96, 3.52],
  [7.2, 0.47, 2.975, 3.56],
  [6.84, 0.505, 3, 3.625],
  [6.49, 0.52, 3.02, 3.65],
  [6.14, 0.52, 3.05, 3.6576],
  [5.78, 0.52, 3.08, 3.64],
  [5.43, 0.52, 3.11, 3.605],
  [5.07, 0.5, 3.15, 3.555],
  [4.72, 0.45, 3.18, 3.49],
  [4.37, 0.33, 3.225, 3.42],
  [4.15, 0.16, 3.25, 3.34],
  [4.02, 0.01, 3.265, 3.275],
];
const breadth = [
  [8.45, 0.66],
  [7.91, 0.68],
  [5.43, 0.69],
  [5.07, 0.7],
  [4.02, 0.7],
];
const keel = [
  [8.45, 1.555],
  [7.91, 1.55],
  [4.72, 1.55],
  [4.37, 1.57],
  [4.02, 1.6],
];
// Dorsal spine aft of the canopy: z, half-breadth, keel, crown.
const aftbody = [
  [3.75, 0.66, 1.62, 3.26],
  [3.41, 0.64, 1.64, 3.22],
  [2.72, 0.62, 1.64, 3.12],
  [2.04, 0.6, 1.64, 3.02],
  [1.36, 0.58, 1.64, 2.93],
  [0, 0.55, 1.62, 2.86],
  [-2, 0.5, 1.65, 2.84],
  [-3.5, 0.42, 1.7, 2.84],
  [-4.6, 0.24, 1.8, 2.72],
  // The body ends in the notch between the nozzles, not in a spike behind them.
  [-5.2, 0.06, 1.95, 2.55],
];
const SHOULDER = 0.58;
const station = (z, w, b, sw, sy, f) => ({ z, w, b, sw, sy, m: b + f * (sy - b) });
const cockpitStation = ([z, sw, sy]) =>
  station(z, lookup(breadth, z), lookup(keel, z), sw, sy, SHOULDER);
const stations = [
  ...forebody.map(([z, w, b, t], i) =>
    station(z, w, b, 0, t, 0.5 + (0.05 * i) / (forebody.length - 1)),
  ),
  ...canopy.map(cockpitStation),
  ...aftbody.map(([z, w, b, t]) => station(z, w, b, 0, t, SHOULDER)),
];
const RING = 40,
  CAP = 3,
  QUARTER = RING / 4;
// Each ring is a flat cap to the canopy rail, a shoulder to maximum breadth, then a full lower
// lobe. With no rail the cap collapses and the shoulder is the plain upper half of the section.
const ringPoint = (s, k) => {
  if (k <= CAP) return [(s.sw * k) / CAP, s.sy];
  if (k <= QUARTER) {
    const a = ((k - CAP) / (QUARTER - CAP)) * (Math.PI / 2);
    return [s.sw + (s.w - s.sw) * Math.sin(a), s.m + (s.sy - s.m) * Math.cos(a)];
  }
  const a = ((k - QUARTER) / QUARTER) * (Math.PI / 2);
  return [
    s.w * Math.pow(Math.max(0, Math.cos(a)), 0.85),
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
/** Inlet and flank plan, one side: fixed cowl edge, then the flare out to the wing root. */
const inboard = [
  [6, 0.8],
  [4.25, 0.8],
  [3.5, 0.74],
  [0, 0.62],
  [-2, 0.6],
  [-3.64, 0.75],
  [-4.3, 1],
  [-4.9, 1.25],
  [-5.6, 1.52],
  [-6.4, 1.63],
  [-7.75, 1.72],
];
const outboard = [
  [5.9, 1.4],
  [5.43, 1.41],
  [5.07, 1.44],
  [4.72, 1.51],
  [4.37, 1.55],
  [4.02, 1.63],
  [3.67, 1.776],
  [3.31, 1.84],
  [2.96, 1.906],
  [2.6, 1.945],
  [2.24, 1.99],
  [0, 2.04],
  [-2, 2.06],
  [-3.64, 2.08],
  [-4.9, 2.08],
  [-5.2, 2],
  [-5.6, 1.93],
  [-6.4, 1.85],
  [-7.75, 1.76],
];
const deck = [
  [6, 2.7],
  [4.25, 2.7],
  [3.7, 2.74],
  [2, 2.76],
  [0, 2.78],
  [-3.64, 2.76],
  [-4.9, 2.74],
  [-5.6, 2.66],
  [-6.4, 2.52],
  [-7.75, 2.13],
];
const belly = [
  [6, 1.64],
  [4.25, 1.64],
  [3.7, 1.52],
  [2.2, 1.42],
  [0, 1.36],
  [-2, 1.31],
  [-3.64, 1.33],
  [-4.3, 1.55],
  [-4.9, 1.82],
  [-5.6, 1.92],
  [-6.4, 2],
  [-7.75, 2.09],
];
// Unit section of the flank, inboard edge first; the tail booms are the same skin tapered out.
// Nearly square around the inlet, then a long curved fairing from the wing root down to the keel.
const FLANK_INLET = [
  [0.1, 1],
  [0.4, 1],
  [0.7, 1],
  [0.9, 0.985],
  [0.975, 0.93],
  [1, 0.84],
  [1, 0.55],
  [0.995, 0.38],
  [0.95, 0.22],
  [0.84, 0.09],
  [0.66, 0.01],
  [0.4, 0],
  [0.22, 0.03],
  [0.08, 0.12],
  [0.015, 0.28],
  [0, 0.55],
  [0, 0.84],
  [0.03, 0.97],
];
const FLANK_BODY = [
  [0.1, 1],
  [0.4, 1],
  [0.7, 1],
  [0.9, 0.985],
  [0.975, 0.93],
  [1, 0.84],
  [1, 0.68],
  [0.97, 0.53],
  [0.89, 0.38],
  [0.76, 0.23],
  [0.6, 0.1],
  [0.42, 0.015],
  [0.24, 0],
  [0.09, 0.04],
  [0.015, 0.16],
  [0, 0.45],
  [0, 0.8],
  [0.03, 0.97],
];
// The cowl edge rakes 1.65 m aft from the upper corner to the lower lip, so the nose gear sits
// ahead of the lip and the forebody shows below the diagonal.
const lipZ = (y) => 4.25 + (y - 1.62) * 1.528;
// On the ground the cowl rests drooped about 8 degrees from a hinge near the wing: the upper edge
// falls to the apex while the lower lip stays put, which gives the inlet its chevron in side view.
const COWL_HINGE = 3.2,
  COWL_DROOP = 0.137;
const cowl = (y, z) =>
  y - Math.max(0, z - COWL_HINGE) * COWL_DROOP * Math.max(0, Math.min(1, (y - 1.64) / 1.06));
const flankRing = (zs, side) => {
  const b = lookup(belly, zs),
    t = lookup(deck, zs);
  const blend = Math.max(0, Math.min(1, 4.4 - zs));
  return FLANK_INLET.map((p, k) => {
    const fx = p[0] + (FLANK_BODY[k][0] - p[0]) * blend,
      fy = p[1] + (FLANK_BODY[k][1] - p[1]) * blend,
      y = b + fy * (t - b),
      z = Math.min(zs, lipZ(y)),
      i = lookup(inboard, z),
      o = lookup(outboard, z);
    return [side * (i + fx * (o - i)), cowl(y, z), z];
  });
};
const FLANK_STATIONS = [
  5.9, 5.43, 5.07, 4.72, 4.37, 4.02, 3.67, 3.31, 2.96, 2.6, 2.24, 1, -1, -2.5, -3.64, -4.3, -4.9,
  -5.6, -6.4, -7.1, -7.75,
];
// Half-breadth of the cockpit shoulder at a height, so skin lines stay on the surface.
const shoulderX = (z, y) => {
  const s = cockpitStation([
    z,
    lookup(
      canopy.map(([q, w]) => [q, w]),
      z,
    ),
    lookup(
      canopy.map(([q, , h]) => [q, h]),
      z,
    ),
  ]);
  return s.sw + (s.w - s.sw) * Math.sqrt(Math.max(0, 1 - ((y - s.m) / (s.sy - s.m)) ** 2));
};
export function buildF15C(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('F15-gray', '#929ca5', { side: T.DoubleSide }),
    upper = mat('F15-upper', '#737f8a', { side: T.DoubleSide }),
    dark = mat('F15-seals', '#24292d'),
    metal = mat('F15-alloy', '#b1b8bb', { metalness: 0.74 }),
    nozzle = mat('F15-nozzle', '#7a7870', { metalness: 0.5, side: T.DoubleSide }),
    lining = mat('F15-exhaust-lining', '#272726', { side: T.DoubleSide }),
    nose = mat('F15-radome', '#858e95', { side: T.DoubleSide }),
    glass = mat('F15-glazing', '#6d878f', {
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'F15-airframe'),
    bindings = [];
  const rings = stations.map(ring3d),
    index = (z) => stations.findIndex((q) => q.z === z),
    radome = index(9.19),
    open = [index(7.91), index(4.72)],
    outer = (i) => distinct(rings[i].filter((_, j) => j >= CAP && j <= RING - CAP));
  ruled(d, rings.slice(0, radome + 1), nose);
  // Cockpit aperture between the windscreen deck and the bulkhead behind the seat.
  ruled(
    d,
    rings.slice(radome),
    paint,
    (i, j) => i + radome >= open[0] && i + radome < open[1] && (j < CAP || j >= RING - CAP),
  );
  sheet(d, distinct(rings[0]), nose, [0, 0, 1]);
  sheet(d, distinct(rings.at(-1)), paint, [0, 0, -1]);
  for (const z of [9.19, 8.45, 3.41, 0, -3.5])
    outline(
      d,
      outer(index(z)).map(([x, y, q]) => [x * 1.003, y, q]),
      0.003,
      dark,
    );
  // Anti-glare deck ahead of the instrument panel, under the windscreen.
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
  // One-piece canopy on a fixed windscreen; no fuselage roof inside its aperture.
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      b + Math.sin((j * Math.PI) / 16) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  const arch = canopy.findIndex(([z]) => z === 7.32);
  for (const i of [0, arch, cr.length - 1])
    outline(
      d,
      cr[i].points.map((q) => [...q, cr[i].z]),
      i === arch ? 0.03 : 0.018,
      paint,
      false,
    );
  for (const side of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[side], r.z]),
      0.024,
      paint,
      false,
    );
  // The windscreen is one piece: photographs show no frame forward of the arch.
  for (let j = 0; j < 17; j++) {
    const p = cr[arch].points[j];
    d.add(new T.SphereGeometry(0.004, 5, 3), metal, [p[0], p[1] + 0.02, cr[arch].z]);
  }
  const oval = (r, z, cy = 2.18) => ({
    z,
    points: Array.from({ length: 24 }, (_, i) => [
      Math.sin((i * Math.PI) / 12) * r,
      cy + Math.cos((i * Math.PI) / 12) * r,
    ]),
  });
  for (const side of [-1, 1]) {
    const flank = FLANK_STATIONS.map((z) => flankRing(z, side)),
      lip = flankRing(99, side);
    ruled(d, flank, paint);
    // Rectangular ramp inlet: a dark duct behind a raked cowl, separate from the round engine.
    const cx = side * 1.14,
      back = lip.map(([x, y]) => [cx + (x - cx) * 0.8, 2.16 + (y - 2.16) * 0.8, 3.3]);
    for (let j = 0; j < lip.length; j++) {
      const k = (j + 1) % lip.length;
      quad(d, lip[j], lip[k], back[k], back[j], dark, [cx - lip[j][0], 2.16 - lip[j][1], 0]);
    }
    sheet(d, back, dark, [0, 0, 1]);
    outline(d, lip, 0.022, paint);
    quad(
      d,
      [side * 0.86, cowl(2.685, 5.8), 5.8],
      [side * 1.38, cowl(2.685, 5.8), 5.8],
      [side * 1.3, cowl(2.5, 4.2), 4.2],
      [side * 0.92, cowl(2.5, 4.2), 4.2],
      upper,
      [0, -1, 0],
    );
    // Diverter gap between the forebody and the inner cowl wall, closed by the splitter deck.
    sheet(
      d,
      [
        [side * 0.76, cowl(2.7, 5.8), 5.8],
        [side * 0.76, 1.9, 4.7],
        [side * 0.76, 1.75, 3.4],
        [side * 0.76, 2.7, 3.4],
      ],
      dark,
      [side, 0, 0],
    );
    quad(
      d,
      [side * shoulderX(4.4, 2.76), 2.76, 4.4],
      [side * 0.86, cowl(2.704, 4.4), 4.4],
      [side * 0.8, 2.742, 3.6],
      [side * 0.62, 2.8, 3.6],
      paint,
      [0, 1, 0],
    );
    // Closed deck and tunnel roof between the dorsal spine and the flank, aft to the engines.
    quad(
      d,
      [side * 0.3, 2.82, 3.6],
      [side * 0.86, 2.742, 3.6],
      [side * 0.7, 2.778, -1.2],
      [side * 0.3, 2.82, -1.2],
      paint,
      [0, 1, 0],
    );
    quad(
      d,
      [side * 0.4, 1.66, 4.1],
      [side * 0.86, 1.66, 4.1],
      [side * 0.7, 1.62, -1.2],
      [side * 0.4, 1.62, -1.2],
      paint,
      [0, -1, 0],
    );
    // Round engines sit close together between the booms, with a notch between the nozzles.
    const ng = group(root, `F15-engine-${side}`, [side * 0.7, 0, 0]),
      nd = detailKit(ng, ng.name);
    loft(nd, [oval(0.62, -1), oval(0.62, -3.6), oval(0.61, -5), oval(0.6, -5.4)], paint, {
      caps: false,
    });
    loft(nd, [oval(0.6, -5.4), oval(0.62, -5.75)], nozzle, { caps: false });
    // Sixteen flat convergent petals (double-sided), each ending in a shallow point so the
    // exit rim reads serrated rather than as a smooth cone.
    for (let j = 0; j < 16; j++) {
      const a = (j * Math.PI) / 8,
        h = Math.PI / 16,
        p = (r, t, z) => [Math.sin(a + t) * r, 2.18 + Math.cos(a + t) * r, z];
      sheet(
        nd,
        [
          p(0.622, -h, -5.75),
          p(0.622, h, -5.75),
          p(0.522, h, -6.57),
          p(0.522 * Math.cos(h), 0, -6.65),
          p(0.522, -h, -6.57),
        ],
        nozzle,
        [Math.sin(a), Math.cos(a), -0.07],
      );
    }
    nd.add(
      new T.CylinderGeometry(0.44, 0.5, 0.8, 32, 1, true).rotateX(Math.PI / 2),
      lining,
      [0, 2.18, -6.24],
    );
    nd.add(new T.CircleGeometry(0.45, 32).rotateY(Math.PI), dark, [0, 2.18, -5.84]);
    // Exposed actuator rods characteristic of the featherless Eagle exhaust.
    for (let j = 0; j < 16; j++) {
      const a = (j * Math.PI) / 8,
        p = (r, z) => [Math.sin(a) * r, 2.18 + Math.cos(a) * r, z];
      nd.rod(p(0.625, -5.74), p(0.53, -6.63), 0.01, metal);
      nd.rod(p(0.64, -5.78), p(0.59, -6.25), 0.018, nozzle);
    }
    nd.finish();
    // Fixed cropped-delta wing, with actual separate inboard flap and outboard aileron. The
    // aileron stops short of the raked tip, which stays fixed.
    const ws = [
      [1.8, 2.66, 2.39, -3.64, 0.16],
      [2.2, 2.643, 1.99, -3.64, 0.15],
      [4.04, 2.564, 0.15, -3.64, 0.09],
      [5.66, 2.494, -1.47, -3.99, 0.045],
      [5.68, 2.493, -1.49, -4, 0.045],
      [6.1, 2.475, -1.91, -3.64, 0.032],
      [6.35, 2.465, -2.16, -3.3, 0.024],
      [6.5, 2.458, -2.4, -3, 0.016],
      [6.524244, 2.457, -2.7, -2.85, 0.01],
    ];
    const hinge = (q, j) => q[3] + (j <= 3 ? Math.min(0.85, (q[2] - q[3]) * 0.4) : 0);
    wing(
      d,
      ws.map(([x, y, le, , h], j) => [side * x, y, le, hinge(ws[j], j), h]),
      upper,
    );
    for (let j = 0; j < 3; j++) {
      const a = ws[j],
        b = ws[j + 1],
        px = (side * (a[0] + b[0])) / 2,
        py = (a[1] + b[1]) / 2,
        pz = (hinge(a, j) + hinge(b, j + 1)) / 2;
      const g = group(root, `F15-${j < 2 ? 'flap' : 'aileron'}-${side}-${j}`, [px, py, pz]),
        wd = detailKit(g, g.name);
      wing(
        wd,
        [
          [a, j],
          [b, j + 1],
        ].map(([q, n]) => [side * q[0] - px, q[1] - py, hinge(q, n) - pz, q[3] - pz, q[4] * 0.23]),
        paint,
      );
      wd.finish();
      bindings.push({
        node: g.name,
        source: j < 2 ? 'flapPosition' : 'rollInput',
        property: 'rotation',
        axis: 'x',
        scale: j < 2 ? -0.5 : -side * 0.32,
      });
    }
    for (const [x, y, le, te, h] of ws.slice(1, 4))
      d.rod(
        [side * x, y + h + 0.004, le - 0.2],
        [side * x, y + h * 0.52 + 0.004, te + (le - te) * 0.26],
        0.003,
        dark,
      );
    for (let j = 0; j < 55; j++) {
      const x = 2.25 + j * 0.0625,
        t = (x - 2.2) / 3.46;
      d.add(new T.SphereGeometry(0.004, 4, 3), metal, [
        side * x,
        2.643 - 0.149 * t + (0.15 - 0.105 * t) * 0.72,
        1.76 - 3.46 * t,
      ]);
    }
    // Fixed fairing from the engine bay to the boom; its trailing edge curves aft to the boom tip.
    wing(
      d,
      [
        [side * 1.22, 2.32, -4.4, -6.45, 0.2],
        [side * 1.5, 2.3, -4.5, -6.75, 0.17],
        [side * 1.72, 2.28, -4.6, -7.4, 0.12],
      ],
      paint,
    );
    // Low-mounted all-moving tail on the boom, 28.25 ft overall span. The outer panel's leading
    // edge stands forward of the inner one at the dogtooth.
    const tg = group(root, `F15-stabilator-${side}`, [side * 1.73, 2.18, -6.1]),
      td = detailKit(tg, tg.name);
    wing(
      td,
      [
        [1.86, 0, -4.62, -7.54, 0.07],
        [2.54, -0.01, -5.5, -7.62, 0.055],
        [2.56, -0.01, -5.03, -7.62, 0.055],
        [4.24, -0.04, -7.05, -7.83, 0.03],
        [4.3053, -0.04, -7.35, -7.62, 0.015],
      ].map(([l, y, le, te, h]) => [side * (l - 1.73), y, le + 6.1, te + 6.1, h]),
      paint,
    );
    td.finish();
    bindings.push({
      node: tg.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const fg = group(root, `F15-fin-${side}`, [side * 1.73, 2.75, -4.3]),
      fd = detailKit(fg, fg.name);
    // The fin's upper trailing edge overhangs a rudder confined to the lower half.
    const edge = [
      [0, -0.3, 0.5],
      [0, 0, 0.47],
      [0, 2.83, -1.32],
      [0, 2.83, -2.62],
      [0, 1.38, -2.55],
      [0, 1.38, -1.98],
      [0, 0.1, -1.62],
      [0, -0.3, -1.62],
    ];
    for (const x of [-0.055, 0.055])
      sheet(
        fd,
        edge.map(([a, b, c]) => [a + x, b, c]),
        upper,
        [Math.sign(x), 0, 0],
      );
    for (let j = 0; j < edge.length; j++)
      quad(
        fd,
        edge[j].map((v, k) => v + (k === 0 ? -0.055 : 0)),
        edge[(j + 1) % edge.length].map((v, k) => v + (k === 0 ? -0.055 : 0)),
        edge[(j + 1) % edge.length].map((v, k) => v + (k === 0 ? 0.055 : 0)),
        edge[j].map((v, k) => v + (k === 0 ? 0.055 : 0)),
        upper,
        [0, 1, 0],
      );
    const rg = group(fg, `F15-rudder-${side}`, [0, 0, -1.62]),
      rd = detailKit(rg, rg.name);
    sheet(
      rd,
      [
        [0, 0.1, 0],
        [0, 1.38, -0.36],
        [0, 1.38, -0.7],
        [0, 0.1, -0.42],
      ],
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
    fd.rod([0, 2.83, -1.3], [0, 2.83, -2.77], side === 1 ? 0.08 : 0.045, dark);
    fd.finish();
    // Lateral skin access lines follow the local fuselage section, not a floating cage.
    for (const [a, b] of [
      [7.2, 6.14],
      [6.14, 5.07],
    ])
      d.rod(
        [side * shoulderX(a, 2.5) * 1.004, 2.5, a],
        [side * shoulderX(b, 2.5) * 1.004, 2.5, b],
        0.003,
        dark,
      );
    for (let j = 0; j < 29; j++) {
      const z = 5.05 + j * 0.09;
      d.add(new T.SphereGeometry(0.004, 4, 3), metal, [side * shoulderX(z, 2.78) * 1.002, 2.78, z]);
    }
    const label = group(root, `F15-stencils-${side}`, [side * 0.692, 2.42, 6.9]);
    label.rotation.y = (side * Math.PI) / 2;
    const ld = detailKit(label, label.name);
    ld.text('RESCUE', [0, 0, 0], 0.045, 0, d.yellow);
    ld.text('DANGER', [0, -0.13, 0], 0.035, 0, d.red);
    ld.finish();
  }
  // Speed-brake outline on the spine, closed for this model; it follows the dorsal crown.
  const spine = (z) =>
    lookup(
      aftbody.map(([q, , , t]) => [q, t]),
      z,
    );
  outline(
    d,
    [
      [-0.36, spine(3.4) - 0.1, 3.4],
      [0.36, spine(3.4) - 0.1, 3.4],
      [0.44, spine(1.2) - 0.18, 1.2],
      [-0.44, spine(1.2) - 0.18, 1.2],
    ],
    0.006,
    dark,
  );
  // Dorsal blade antennas that break the spine line in side view.
  for (const [z, h, chord] of [
    [3.05, 0.2, 0.2],
    [0.5, 0.16, 0.18],
  ])
    sheet(
      d,
      [
        [0, spine(z), z],
        [0, spine(z - chord), z - chord],
        [0, spine(z) + h, z - chord * 1.05],
      ],
      dark,
      [1, 0, 0],
    );
  for (const [name, x, z, r, w, gy, skin] of [
    ['nose', 0, 5.419344, 0.27, 0.17, 1.86, 0.31],
    ['left', 1.376172, 0, 0.44, 0.25, 1.9, 0.54],
    ['right', -1.376172, 0, 0.44, 0.25, 1.9, 0.54],
  ]) {
    const g = group(root, `F15-gear-${name}`, [x, gy, z]),
      gd = detailKit(g, g.name),
      axle = r - gy;
    gd.add(new T.CylinderGeometry(r, r, w, 28).rotateZ(Math.PI / 2), dark, [0, axle, 0]);
    for (const side of [-1, 1]) {
      gd.add(new T.CylinderGeometry(r * 0.57, r * 0.57, 0.025, 24).rotateZ(Math.PI / 2), metal, [
        side * (w / 2 + 0.01),
        axle,
        0,
      ]);
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        gd.add(new T.SphereGeometry(0.018, 6, 4), dark, [
          side * (w / 2 + 0.025),
          axle + Math.sin(a) * r * 0.35,
          Math.cos(a) * r * 0.35,
        ]);
      }
    }
    gd.rod([0, 0, 0], [0, axle + 0.09, 0], 0.053, metal);
    gd.rod([0, -0.1, -0.65], [0, axle + 0.2, 0], 0.036, paint);
    gd.rod([0, axle + 0.45, -0.08], [0, axle + 0.62, -0.25], 0.025, metal);
    gd.rod([0, axle + 0.62, -0.25], [0, axle + 0.8, -0.06], 0.025, metal);
    gd.box(
      [0.03, 0.5, 0.42],
      [name === 'nose' ? 0.2 : Math.sign(x) * 0.22, -skin - 0.25, -0.12],
      paint,
    );
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: 'x',
      scale: Math.PI / 2,
      offset: -Math.PI / 2,
    });
  }
  d.rod([0, 1.76, -4.6], [0, 1.64, -6.3], 0.03, metal);
  d.finish();
  const interior = f15Cockpit(root, { paint, upper, dark, metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.3] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.12] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  for (const child of root.children)
    if (!child.name.startsWith('F15-gear-')) child.position.z += BODY_SHIFT;
  cleanGeometry(root);
  return {
    root,
    frame: f15Frame(),
    enginePoints: [
      { id: 'engine-1', position: [0.7, 2.18, -5.5 + BODY_SHIFT] },
      { id: 'engine-2', position: [-0.7, 2.18, -5.5 + BODY_SHIFT] },
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

function f15Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'F15-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'F15'),
    { bindings, derived, ink, black, amber } = ins;
  const panel = mat('F15-panel', '#4f575b', { side: T.DoubleSide }),
    seat = mat('F15-seat', '#51584b'),
    belt = mat('F15-harness', '#9a9e90');
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
    altitudeHundreds: { op: 'modulo', args: ['feet', 1000] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    aoaDegrees: { op: 'multiply', args: ['angleOfAttack', 180 / Math.PI] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
  });
  // Pixel coordinates from normalized 2048px MSIP foldout FO-3. Scale from a nominal 3.125in instrument.
  const k = 0.00225,
    z = 7.42,
    at = (u, v, dz = 0) => [(1071 - u) * k, 2.86 - (v - 365) * k, z + dz];
  const circle = (u, v, r) =>
    Array.from({ length: 40 }, (_, j) =>
      at(u + Math.cos((j * Math.PI) / 20) * r, v + Math.sin((j * Math.PI) / 20) * r),
    );
  const box = (u, v, w, h, material = black, depth = 0.012) =>
      d.box([w * k, h * k, depth], at(u, v, -0.025 + depth / 2), material),
    text = (t, u, v, h = 6, material = ink, role = 'panel') =>
      d.text(t, at(u, v, -0.031), h * k, Math.PI, material, role);
  const edge = [
    [888, 327],
    [889, 290],
    [920, 262],
    [981, 230],
    [1040, 210],
    [1100, 210],
    [1163, 238],
    [1225, 272],
    [1260, 302],
    [1258, 440],
    [1121, 440],
    [1121, 559],
    [1021, 559],
    [1021, 486],
    [986, 486],
    [986, 440],
    [886, 440],
  ];
  sheet(
    d,
    edge.map((p) => at(...p)),
    panel,
    [0, 0, -1],
    [circle(1071, 357, 25), circle(1071, 464, 14)],
  );
  outline(
    d,
    edge.map((p) => at(...p, -0.005)),
    0.009,
    black,
  );
  for (let j = 0; j < edge.length; j += 2)
    d.add(new T.SphereGeometry(0.003, 6, 4), m.metal, at(...edge[j], -0.014));
  // ADI and standby attitude remain genuinely recessed through apertures.
  ins.horizon('ADI', at(1071, 357, 0.01), 0.105, 0.105, { round: true, blankBackdrop: true });
  ins.horizon('standby', at(1071, 464, 0.01), 0.055, 0.055, { round: true, blankBackdrop: true });
  ins.dial(
    'airspeed',
    at(998, 351, -0.009),
    21 * k,
    'knots',
    [
      [0, 0],
      [100, 0.6],
      [200, 1.45],
      [300, 2.6],
      [400, 3.6],
      [600, 4.7],
      [800, 5.6],
    ],
    [0, 100, 200, 300, 400, 600, 800],
    'TAS',
    { minorStep: 20, tickLabels: { 0: 0, 100: 1, 200: 2, 300: 3, 400: 4, 600: 6, 800: 8 } },
  );
  ins.dial(
    'altimeter',
    at(1140, 351, -0.009),
    20 * k,
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
  ins.readout('altitude', at(1140, 361, -0.03), 'feet', 5, 0.008, ink, true, true);
  ins.dial(
    'vertical-speed',
    at(1140, 390, -0.009),
    15 * k,
    'verticalFpm',
    [
      [-6000, -Math.PI / 2],
      [0, Math.PI / 2],
      [6000, 1.5 * Math.PI],
    ],
    [-6000, -4000, -2000, 0, 2000, 4000, 6000],
    'FPM',
    { tickLabels: { '-6000': -6, '-4000': -4, '-2000': -2, 0: 0, 2000: 2, 4000: 4, 6000: 6 } },
  );
  ins.dial(
    'AOA',
    at(1002, 389, -0.009),
    14 * k,
    'aoaDegrees',
    [
      [-10, -1],
      [0, 0],
      [40, 4.8],
    ],
    [-10, 0, 10, 20, 30, 40],
    'DEG',
  );
  ins.dial(
    'G',
    at(1002, 424, -0.009),
    14 * k,
    'loadFactor',
    [
      [-5, -2],
      [0, 0],
      [10, 4],
    ],
    [-5, 0, 5, 10],
    'G',
  );
  pt.gauge(...at(1071, 416).slice(0, 2), z - 0.01, 29 * k, black, false);
  const hd = group(cabin, 'F15-heading', at(1071, 416, -0.023)),
    dd = detailKit(hd, hd.name);
  for (let j = 0; j < 72; j++) {
    const a = (j * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    dd.rod(p(j % 6 ? 0.055 : 0.05), p(0.061), 0.0007, ink);
    if (j % 6 === 0) dd.text(String(j / 2), p(0.041), 0.009, Math.PI, ink);
  }
  dd.finish();
  bindings.push({
    node: hd.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: Math.PI * 2,
  });
  ins.available('heading', 'trueHeading', hd.name);
  d.rod(at(1071, 387, -0.028), at(1071, 397, -0.028), 0.0015, ink);
  text('TRUE', 1071, 436, 4, ink, 'display');
  const display = (u, v, w, h, label) => {
    box(u, v, w, h, black, 0.06);
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        box(u + side * (w / 2 - 4), v - h * 0.34 + j * h * 0.135, 4, 5, panel);
        box(u - w * 0.34 + j * w * 0.135, v + side * (h / 2 - 4), 5, 4, panel);
      }
    box(u, v, w * 0.72, h * 0.65, ins.black);
    text(label, u, v - h * 0.22, 5);
    text('INOP', u, v, 8, amber, 'display');
  };
  display(983, 280, 76, 91, 'VSD');
  display(934, 372, 86, 100, 'MPCD');
  box(923, 300, 43, 43, panel);
  for (const [u, v] of [
    [910, 313],
    [933, 313],
    [936, 287],
    [936, 270],
  ]) {
    d.add(
      new T.CylinderGeometry(0.007, 0.008, 0.015, 12).rotateX(Math.PI / 2),
      black,
      at(u, v, -0.04),
    );
    d.rod(at(u, v, -0.049), at(u, v - 3, -0.049), 0.0008, ink);
  }
  text('VSD CONT', 922, 303, 3);
  text('TEST', 923, 284, 3);
  for (const [u, v] of [
    [1034, 347],
    [1034, 374],
    [1110, 344],
    [1110, 372],
    [1110, 398],
  ]) {
    box(u, v, 9, 11);
    text('--', u, v, 3, amber, 'display');
  }
  d.box([35 * k, 43 * k, 0.015], at(1236, 405, 0.005), panel);
  d.box([36 * k, 43 * k, 0.015], at(1248, 459, 0.005), panel);
  pt.gauge(...at(1171, 289).slice(0, 2), z - 0.01, 35 * k, black, false);
  text('TEWS', 1171, 281, 7);
  text('INOP', 1171, 298, 7, amber, 'display');
  // The centrally stacked analog engine indicators stay blank until those quantities exist.
  for (const [v, label] of [
    [341, 'RPM'],
    [369, 'EGT'],
    [398, 'NOZ'],
    [425, 'FF'],
  ])
    for (const u of [1181, 1208]) {
      pt.gauge(...at(u, v).slice(0, 2), z - 0.012, 11 * k, black, false);
      text(label, u, v - 3, 3);
      text('--', u, v + 5, 4, amber, 'display');
    }
  for (const [u, v, r, label] of [
    [1140, 421, 15, 'CLOCK'],
    [1232, 342, 8, 'OIL'],
    [1247, 342, 8, 'OIL'],
    [1232, 363, 8, 'HYD'],
    [1247, 363, 8, 'HYD'],
    [1236, 405, 17, 'FUEL'],
    [1248, 459, 15, 'CABIN'],
  ]) {
    pt.gauge(...at(u, v).slice(0, 2), z - 0.012, r * k, black, false);
    text(label, u, v - 3, 3);
    text('--', u, v + 5, 4, amber, 'display');
  }
  ins.dial(
    'standby-speed',
    at(1037, 464, -0.009),
    14 * k,
    'knots',
    [
      [0, 0],
      [100, 0.6],
      [200, 1.45],
      [400, 3.6],
      [800, 5.6],
    ],
    [0, 200, 400, 800],
    'TAS',
    { tickLabels: { 0: 0, 200: 2, 400: 4, 800: 8 } },
  );
  ins.altimeter('standby-altitude', at(1105, 464, -0.009), 14 * k, 'feet');
  // Center HUD/control panel. No fake radar, targeting data or engine values.
  box(1071, 269, 83, 98, black, 0.09);
  for (const [v, label] of [
    [229, 'COMM'],
    [264, 'HUD'],
    [308, 'STEER'],
  ]) {
    box(1071, v, 75, v === 264 ? 54 : 20, panel);
    text(label, 1071, v - 7, 3);
  }
  for (const [u, v] of [
    [1042, 231],
    [1102, 231],
    [1042, 256],
    [1042, 276],
    [1068, 277],
    [1101, 276],
    [1051, 309],
    [1094, 309],
  ]) {
    d.add(
      new T.CylinderGeometry(0.008, 0.01, 0.013, 12).rotateX(Math.PI / 2),
      black,
      at(u, v, -0.04),
    );
    d.rod(at(u, v, -0.049), at(u, v - 3, -0.049), 0.0009, ink);
  }
  for (const [u, v] of [
    [1060, 232],
    [1077, 232],
    [1061, 251],
    [1079, 251],
    [1093, 251],
  ]) {
    box(u, v, 8, 7);
    d.rod(at(u, v, -0.032), at(u, v - 2, -0.046), 0.002, m.metal);
  }
  text('--', 1082, 280, 5, amber, 'display');
  // The combiner keeps its height above the lowered panel: only its solid mount sits below the
  // over-the-nose line. Clear glass is fine in the sightline.
  const hud = [
    [1030, 205],
    [1034, 112],
    [1052, 102],
    [1099, 102],
    [1110, 115],
    [1113, 204],
  ].map((p) => at(...p, -0.12));
  sheet(d, hud, m.glass, [0, 0, -1]);
  outline(d, hud, 0.009, black);
  box(1071, 210, 81, 17, black, 0.13);
  box(1071, 520, 80, 65);
  for (let j = 0; j < 6; j++) box(1071, 498 + j * 9, 52, 4, panel);
  text('ENVIRONMENT', 1071, 553, 4);
  for (const [u, v] of [
    [837, 448],
    [1291, 439],
  ]) {
    box(u, v, 44, 89);
    for (let row = 0; row < 9; row++)
      for (let col = 0; col < 3; col++) box(u - 13 + col * 13, v - 33 + row * 8, 10, 5, panel);
    text('CAUTION', u, v - 49, 4);
  }
  box(900, 467, 46, 41);
  text('GEAR', 900, 455, 4);
  for (let j = 0; j < 3; j++) {
    const g = group(cabin, `F15-gear-lamp-${j}`, at(888 + j * 12, 470, -0.032)),
      gd = detailKit(g, g.name);
    gd.box([0.013, 0.013, 0.003], [0, 0, 0], d.green);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  // Tub, ACES II seat, harness, side consoles. Top-facing labels follow console mounting.
  // Bulkhead behind the seat closes the tub under the aft canopy, with the avionics deck over the
  // bay between it and the rear of the canopy.
  d.box([0.96, 1, 0.03], [0, 2.47, 5.9], black);
  d.box([0.96, 0.02, 1.18], [0, 2.96, 5.31], panel);
  const bulkhead = canopy.find(([z]) => z === 4.72);
  sheet(
    d,
    [
      [0.48, 1.98, 4.72],
      [0.48, 2.68, 4.72],
      [bulkhead[1] - 0.012, bulkhead[2] - 0.004, 4.72],
      [-(bulkhead[1] - 0.012), bulkhead[2] - 0.004, 4.72],
      [-0.48, 2.68, 4.72],
      [-0.48, 1.98, 4.72],
    ],
    black,
    [0, 0, 1],
  );
  d.box([0.84, 0.035, 2.9], [0, 1.98, 6.22], black);
  for (const side of [-1, 1]) {
    sheet(
      d,
      [
        [side * 0.48, 1.98, 4.72],
        [side * 0.48, 1.98, 7.91],
        [side * 0.48, 2.68, 7.91],
        [side * 0.48, 2.68, 4.72],
      ],
      panel,
      [-side, 0, 0],
    );
    // Upper liner from the console shelf to the canopy rail, which rises toward the seat back.
    const rails = canopy.filter(([z]) => z <= 7.91 && z >= 4.72);
    for (let i = 0; i < rails.length - 1; i++) {
      const [z0, w0, y0] = rails[i],
        [z1, w1, y1] = rails[i + 1];
      quad(
        d,
        [side * 0.48, 2.68, z0],
        [side * 0.48, 2.68, z1],
        [side * (w1 - 0.012), y1 - 0.004, z1],
        [side * (w0 - 0.012), y0 - 0.004, z0],
        panel,
        [-side, 0.2, 0],
      );
    }
    d.box([0.22, 0.4, 1.8], [side * 0.42, 2.33, 6.25], panel);
    const cg = group(cabin, `F15-console-${side}`, [side * 0.42, 2.54, 6.25]);
    cg.rotation.x = Math.PI / 2;
    const cd = detailKit(cg, cg.name);
    for (let j = 0; j < 6; j++) {
      cd.box([0.19, 0.245, 0.012], [0, -0.69 + j * 0.27, 0], black);
      cd.text(
        (side === 1
          ? ['LIGHT', 'COMM', 'SAS', 'ILS', 'RADAR', 'AUDIO']
          : ['ENGINE', 'NAV', 'POWER', 'ECS', 'OXY', 'TEST'])[j],
        [0, -0.74 + j * 0.27, -0.009],
        0.018,
        Math.PI,
        ink,
      );
      for (let q = 0; q < 3; q++) {
        cd.rod(
          [-0.06 + q * 0.06, -0.66 + j * 0.27, -0.01],
          [-0.06 + q * 0.06, -0.66 + j * 0.27, -0.034],
          0.004,
          m.metal,
        );
        cd.add(new T.CylinderGeometry(0.009, 0.01, 0.012, 10).rotateX(Math.PI / 2), panel, [
          -0.06 + q * 0.06,
          -0.6 + j * 0.27,
          -0.017,
        ]);
      }
    }
    cd.finish();
  }
  d.box([0.44, 0.5, 0.5], [0, 2.25, 6.62], black);
  const sg = group(cabin, 'F15-ACES-II', [0, 2.54, 6.43]);
  sg.rotation.x = -0.23;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.5, 0.12, 0.52], [0, 0, 0.2], seat);
  beveledBox(sd, [0.48, 0.77, 0.13], [0, 0.41, -0.07], seat);
  beveledBox(sd, [0.32, 0.29, 0.17], [0, 0.92, -0.07], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.27, -0.1, -0.17], [side * 0.27, 1.02, -0.17], 0.023, m.metal);
    sheet(
      sd,
      [
        [side * 0.1, 0.76, 0.01],
        [side * 0.15, 0.76, 0.01],
        [side * 0.08, 0.12, 0.1],
        [side * 0.03, 0.12, 0.1],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.12, 0.035, 0.28], [side * 0.21, 0.08, 0.18], belt);
  }
  sd.box([0.065, 0.04, 0.025], [0, 0.12, 0.13], m.metal);
  sd.finish();
  const stick = group(cabin, 'F15-stick', [0, 2.04, 6.93]),
    st = detailKit(stick, stick.name);
  st.rod([0, 0, 0], [0, 0.72, -0.06], 0.023, black);
  st.box([0.07, 0.11, 0.07], [0, 0.75, -0.06], black);
  st.add(new T.SphereGeometry(0.011, 8, 6), d.red, [-0.03, 0.79, -0.085]);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.23 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.24 },
  );
  for (const side of [-1, 1]) {
    const g = group(cabin, `F15-pedal-${side}`, [side * 0.14, 2.2, 7.22]),
      gd = detailKit(g, g.name);
    gd.box([0.14, 0.16, 0.04], [0, 0, 0], m.metal);
    for (let j = 0; j < 5; j++) gd.box([0.12, 0.005, 0.004], [0, -0.06 + j * 0.03, -0.023], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  for (let i = 0; i < 2; i++) {
    const g = group(cabin, `F15-throttle-${i}`, [0.37 + i * 0.07, 2.55, 6.76]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, 0.1, 0], 0.014, black);
    gd.box([0.055, 0.06, 0.09], [0, 0.11, 0], black);
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
