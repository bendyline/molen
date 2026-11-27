/** 2015 FL-1031+ King Air 350i / Pro Line Fusion. Main axle origin, +Z nose.
 * Factory three-view and cockpit photograph calibrated in reference-review.json.
 */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothSurface } from '../surface-normals.mjs';
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { cockpitBulkhead, cockpitLiner } from './cockpit-fit.mjs';
import {
  bar,
  contour,
  flapSelectorGeometry,
  lathe,
  leverGate,
  leverGeometry,
  loftUp,
  partPalette,
  place,
  roundedBox,
  tube,
} from './cockpit-parts.mjs';
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

/** A tyre with rounded shoulders on a dished rim with a domed hub cap, the axle along X through
 * `at`: radius r, width w. It replaces flat cylinder-and-disc wheels. */
function wheel(d, at, r, w, tyre, rim, cap = rim) {
  const lathe = (points, segments) =>
    new T.LatheGeometry(
      points.map(([x, y]) => new T.Vector2(x, y)),
      segments,
    ).rotateZ(Math.PI / 2);
  d.add(
    lathe(
      // Listed from the -Y bead round to the +Y bead so the lathe faces point outward.
      [
        [r * 0.64, -w * 0.5],
        [r * 0.88, -w * 0.5],
        [r * 0.97, -w * 0.4],
        [r, -w * 0.2],
        [r, w * 0.2],
        [r * 0.97, w * 0.4],
        [r * 0.88, w * 0.5],
        [r * 0.64, w * 0.5],
      ],
      20,
    ),
    tyre,
    at,
  );
  for (const side of [-1, 1]) {
    const mirror = (points) => (side > 0 ? points : points.map(([x, y]) => [x, -y]).reverse());
    d.add(
      lathe(
        mirror([
          [r * 0.64, w * 0.5],
          [r * 0.6, w * 0.34],
          [r * 0.3, w * 0.34],
          [r * 0.22, w * 0.44],
        ]),
        16,
      ),
      rim,
      at,
    );
    d.add(
      lathe(
        mirror(
          Array.from({ length: 5 }, (_, k) => {
            const a = (k * Math.PI) / 8;
            return [r * 0.22 * Math.cos(a), w * 0.44 + r * 0.09 * Math.sin(a)];
          }),
        ),
        12,
      ),
      cap,
      at,
    );
  }
}
/** A rounded ogive spinner of base radius r and length l, along +Z from `at`. */
function spinner(d, at, r, l, material) {
  d.add(
    new T.LatheGeometry(
      Array.from({ length: 10 }, (_, k) => {
        const t = k / 9;
        return new T.Vector2(r * Math.pow(1 - t * t, 0.75), t * l);
      }),
      28,
    ).rotateX(Math.PI / 2),
    material,
    at,
  );
}
/** Front and back z of a side-view outline [[z, y], ...] at height y (0 width outside it). */
function chordAt(outline, y) {
  const zs = [];
  for (let n = 0; n < outline.length; n++) {
    const [za, ya] = outline[n],
      [zb, yb] = outline[(n + 1) % outline.length];
    if ((ya - y) * (yb - y) <= 0 && ya !== yb) zs.push(za + ((zb - za) * (y - ya)) / (yb - ya));
  }
  return zs.length ? [Math.max(...zs), Math.min(...zs)] : [0, 0];
}
/** Horizontal ribs [y, front z, back z] of a side-view outline, at every vertex height. */
function outlineRibs(outline) {
  const ys = [...new Set(outline.map(([, y]) => y))].sort((a, b) => a - b),
    low = ys[0] + 0.004,
    high = ys.at(-1) - 0.004;
  return [low, ...ys.filter((y) => y > low && y < high), high].map((y) => [
    y,
    ...chordAt(outline, y),
  ]);
}
/** A symmetric fin or rudder lofted through ribs [y, front z, back z, half thickness at 30 %
 * chord, front-face half width, back-face half width] and closed at both ends: a tapered
 * section instead of a constant-thickness slab. */
function foil(d, ribs, material) {
  const rings = ribs.map(([y, front, back, half, lead, trail]) => {
    const c = front - back,
      right = [
        [lead, front],
        [half, front - c * 0.3],
        [trail + (half - trail) * 0.45, front - c * 0.75],
        [trail, back],
      ];
    return [...right, ...[...right].reverse().map(([x, z]) => [-x, z])].map(([x, z]) => [x, y, z]);
  });
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < 8; j++) {
      const q = [rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % 8], rings[i][(j + 1) % 8]],
        mid = (k) => q.reduce((sum, p) => sum + p[k], 0) / 4,
        axis = (ribs[i][1] + ribs[i][2] + ribs[i + 1][1] + ribs[i + 1][2]) / 4;
      quad(d, ...q, material, [mid(0), 0, mid(2) - axis]);
    }
  sheet(d, rings[0], material, [0, -1, 0]);
  sheet(d, rings.at(-1), material, [0, 1, 0]);
}

/** A kit proxy that places a library part at `at` / `rotation` inside an existing kit, so small
 * panel parts batch with the panel instead of each taking a node. */
const placed = (d, at, rotation = [0, 0, 0]) => ({
  add: (geometry, material) => d.add(place(geometry, at, rotation), material),
});
/** The 350's control wheel (factory cockpit photographs): a broad hub plate tipped back toward
 * the pilot with the digital clock in it, arms dipping out of its lower corners and tall
 * swept horns rising to switch heads, the "M" seen from the seat. Hub at the origin, horns
 * facing -Z; the column runs forward (+Z) from `column`. */
function kingAirYoke(d, P, { lcd, column }) {
  const hubAt = [0, 0, -0.065],
    hubTilt = [-0.38, 0, 0];
  d.add(
    place(
      loftUp([
        { y: -0.034, points: contour(0, 0.002, 0.04, 0.015, 14, 3) },
        { y: 0.0, points: contour(0, 0, 0.058, 0.017, 14, 3.2) },
        { y: 0.026, points: contour(0, 0, 0.066, 0.017, 14, 3.4) },
        { y: 0.036, points: contour(0, 0.002, 0.06, 0.012, 14, 3) },
      ]),
      hubAt,
      hubTilt,
    ),
    P.grip,
  );
  // Clock window and its two buttons on the hub face.
  d.add(
    place(roundedBox([0.046, 0.017, 0.004], 0.003).translate(0, 0.012, -0.017), hubAt, hubTilt),
    P.black,
  );
  d.add(
    place(roundedBox([0.036, 0.01, 0.002], 0.001).translate(0, 0.012, -0.0195), hubAt, hubTilt),
    lcd,
  );
  for (const x of [-0.011, 0.011])
    d.add(
      place(
        roundedBox([0.012, 0.006, 0.004], 0.0015).translate(x, -0.008, -0.0175),
        hubAt,
        hubTilt,
      ),
      P.alloy,
    );
  for (const s of [-1, 1]) {
    d.add(
      tube(
        [
          [s * 0.042, -0.022, -0.062],
          [s * 0.085, -0.043, -0.07],
          [s * 0.118, -0.04, -0.078],
          [s * 0.134, -0.018, -0.084],
        ],
        0.0125,
        14,
      ),
      P.grip,
    );
    // Horn: an oval grip, swept back and canted outboard, swelling into the switch head.
    const horn = [
      loftUp([
        { y: 0, points: contour(0, 0, 0.0135, 0.016, 12, 2.2) },
        { y: 0.05, points: contour(0, 0.001, 0.0145, 0.018, 12, 2.2) },
        { y: 0.09, points: contour(0, 0.002, 0.0145, 0.018, 12, 2.2) },
        { y: 0.108, points: contour(0, -0.002, 0.018, 0.025, 12, 2.6) },
        { y: 0.128, points: contour(0, -0.004, 0.019, 0.027, 12, 2.6) },
        { y: 0.137, points: contour(0, -0.004, 0.012, 0.018, 12, 2.4) },
      ]),
    ];
    const head = [
      // Trim rocker on top, autopilot disconnect on the outboard face, push-to-talk inboard.
      [P.black, roundedBox([0.012, 0.006, 0.016], 0.002).translate(0, 0.138, -0.006)],
      [
        P.red,
        new T.CylinderGeometry(0.0048, 0.0048, 0.006, 14)
          .rotateZ(Math.PI / 2)
          .translate(s * 0.018, 0.122, -0.012),
      ],
      [P.black, roundedBox([0.006, 0.01, 0.008], 0.002).translate(-s * 0.016, 0.115, -0.012)],
    ];
    const at = [s * 0.136, -0.02, -0.085],
      rotation = [-0.28, 0, -s * 0.1];
    d.add(place(horn[0], at, rotation), P.grip);
    for (const [material, geometry] of head) d.add(place(geometry, at, rotation), material);
  }
  d.add(bar(column, [0, 0.003, -0.055], 0.019, 18), P.grip);
}
/** The 350's pedal (cockpit photographs): a curved, ribbed aluminium pad on an arm rising from
 * its hinge at the floor. Origin at the pad centre; the pad faces the pilot (-Z). */
function kingAirPedal(d, P, side) {
  const rows = [-0.052, -0.035, -0.017, 0, 0.017, 0.035, 0.052];
  const bow = (y) => -0.01 + 0.01 * (y / 0.052) ** 2;
  const pad = loftUp(
    rows.map((y) => ({ y, points: contour(0, bow(y) + 0.003, 0.05, 0.005, 12, 5) })),
    40,
  );
  const lean = [0.3, 0, 0];
  d.add(place(pad, [0, 0, 0], lean), P.alloy);
  for (const y of rows.slice(1, -1))
    d.add(
      place(
        bar([-0.044, y, bow(y) - 0.002], [0.044, y, bow(y) - 0.002], 0.0024, 8),
        [0, 0, 0],
        lean,
      ),
      P.alloy,
    );
  // Toe-brake hinge along the bottom, the arm down to the floor hinge, and the brake cylinder.
  d.add(bar([-0.04, -0.058, 0.012], [0.04, -0.058, 0.012], 0.006, 12), P.steel);
  d.add(
    tube(
      [
        [side * 0.03, -0.05, 0.02],
        [side * 0.03, -0.075, 0.045],
        [side * 0.03, -0.09, 0.06],
      ],
      0.007,
      12,
    ),
    P.steel,
  );
  d.add(bar([-side * 0.022, -0.04, 0.03], [-side * 0.022, -0.085, 0.085], 0.008, 12), P.alloy);
  d.add(bar([side * 0.045, -0.09, 0.06], [-side * 0.04, -0.09, 0.06], 0.009, 12), P.steel);
}
/** A light bat-handle toggle for the busy switch groups: a hex bushing and a tapered lever tipped
 * up toward the pilot (a paddle cap on the start switches). Panel face at `at`, facing -Z. */
function panelToggle(d, P, at, paddle = false) {
  d.add(
    place(new T.CylinderGeometry(0.0052, 0.0052, 0.0035, 6, 1, true).rotateX(Math.PI / 2), [
      at[0],
      at[1],
      at[2] - 0.0017,
    ]),
    P.alloy,
  );
  d.add(
    place(new T.CircleGeometry(0.0052, 6).rotateY(Math.PI), [at[0], at[1], at[2] - 0.0035]),
    P.alloy,
  );
  const tip = [at[0], at[1] + 0.005, at[2] - 0.017];
  d.add(bar([at[0], at[1], at[2] - 0.003], tip, 0.0013, 8, 0.0021), P.alloy);
  if (paddle) d.add(place(roundedBox([0.008, 0.0035, 0.009], 0.0012), tip, [0.3, 0, 0]), P.black);
}
/** Condition lever knob: a red barrel with two white bands turned into it. About +Y from y=0. */
function conditionKnob(P, red) {
  const r = 0.0145;
  return [
    [
      red,
      lathe(
        [
          [0.005, 0],
          [r * 0.85, 0.004],
          [r, 0.012],
          [r, 0.022],
          [r * 0.93, 0.03],
          [r, 0.036],
          [r * 0.8, 0.044],
          [0, 0.046],
        ],
        14,
      ),
    ],
    [
      P.white,
      lathe(
        [
          [r * 1.01, 0.022],
          [r * 1.02, 0.025],
          [r * 0.95, 0.028],
          [r * 0.94, 0.03],
        ],
        14,
      ),
    ],
  ];
}
/** One of a pair of power lever knobs: the two halves form a broad T when side by side, each
 * offset outboard (`side`) of its own lever. Built about +Y from y=0. */
function kingAirPowerKnob(side) {
  return [
    place(roundedBox([0.036, 0.022, 0.03], 0.008), [side * 0.007, 0.012, 0]),
    place(roundedBox([0.016, 0.012, 0.018], 0.004), [0, 0.0, 0]),
  ];
}
export const kingAirFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.8,
  cy: 1.78,
  ry: 0.88,
  cabinZ: 1.9,
  cabinWidth: 1.3716,
  eye: [0.34, 2.43, 1.9],
  panelZ: 2.55,
  floor: 1.2,
});
export function buildKingAir(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('KingAir-ivory', '#e9e9e3', { side: T.DoubleSide }),
    accent = mat('KingAir-navy', '#263b61', { side: T.DoubleSide }),
    metal = mat('KingAir-alloy', '#aeb4b7', { metalness: 0.75 }),
    dark = mat('KingAir-trim', '#252b30', { side: T.DoubleSide }),
    rubber = mat('KingAir-rubber', '#181e20'),
    glass = mat('KingAir-glass', '#b5d0d5', {
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    }),
    // Tinted passenger windows: the 350 photos show them as dark round windows.
    tinted = mat('KingAir-cabin-glass', '#26313a', {
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: T.DoubleSide,
      metalness: 0.35,
      roughness: 0.1,
    });
  const d = detailKit(root, 'KingAir-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Side roof/belly and plan half-widths are independently sampled, not a stretched generic tube.
  const stations = [
    [5.137, 0.025, 1.45, 1.57],
    [4.98, 0.19, 1.3, 1.71],
    [4.62, 0.36, 1.18, 1.89],
    [4.05, 0.53, 1.09, 2.08],
    [3.25, 0.65, 1.0, 2.23],
    [2.5, 0.77, 0.95, 2.67],
    [1.73, 0.8, 0.95, 2.7],
    [0.65, 0.8, 0.95, 2.7],
    [-0.65, 0.79, 0.95, 2.68],
    [-2.12, 0.76, 0.98, 2.62],
    [-3.55, 0.67, 1.05, 2.51],
    [-4.75, 0.55, 1.18, 2.4],
    [-6.1, 0.36, 1.4, 2.28],
    [-7.65, 0.17, 1.7, 2.13],
    [-7.95, 0.018, 1.96, 2.02],
  ];
  // Aft of the cockpit the upper section is an arch (B200 front view, 350 photos): the window
  // band (points 1-3) leans in over a continuous crown instead of a flat roof on vertical walls.
  const rings = stations.map(([z, w, b, t], i) => {
    const h = t - b,
      upper =
        i < 6
          ? [
              [w * 0.6, t - Math.min(0.025, h * 0.04)],
              [w * 0.91, t - Math.min(0.16, h * 0.14)],
              [w, t - Math.min(0.37, h * 0.28)],
            ]
          : [
              [w * 0.6, t - h * 0.025],
              [w * 0.88, t - h * 0.12],
              [w * 0.985, b + h * 0.55],
            ];
    return {
      z,
      points: [
        [0, t],
        ...upper,
        [w, b + Math.min(0.28, h * 0.25)],
        [w * 0.83, b + Math.min(0.06, h * 0.08)],
        [w * 0.48, b],
        [0, b - Math.min(0.015, h * 0.04)],
        [-w * 0.48, b],
        [-w * 0.83, b + Math.min(0.06, h * 0.08)],
        [-w, b + Math.min(0.28, h * 0.25)],
        ...upper.reverse().map(([x, y]) => [-x, y]),
      ],
    };
  });
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      i < 4 ||
      (i === 4 && [0, 1, 2, 11, 12, 13].includes(j)) ||
      ((i === 4 || i === 5) && [3, 10].includes(j)) ||
      (i === 5 && [2, 11].includes(j)) ||
      (i >= 6 && i <= 10 && [1, 2, 11, 12].includes(j)),
  });
  // Rounded radome/avionics nose: 28-point sections blend from the cabin section at the
  // windshield base (shared exactly with ring 4) towards an ellipse at the tip.
  const noseRings = [1, 0.95, 0.8, 0.5, 0].map((k, i) => {
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
  const noseX = (z, y) => {
    const i = Math.max(0, noseRings.findIndex((r, n) => n > 0 && z >= r.z) - 1),
      a = noseRings[i],
      b = noseRings[i + 1],
      f = (a.z - z) / (a.z - b.z),
      ring = a.points.map((q, n) => [
        q[0] * (1 - f) + b.points[n][0] * f,
        q[1] * (1 - f) + b.points[n][1] * f,
      ]);
    for (let n = 0; n < 14; n++) {
      const [x0, y0] = ring[n],
        [x1, y1] = ring[n + 1];
      if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return a.points[7][0];
  };
  for (const j of [0, 1, 2, 11, 12, 13])
    quad(d, p(4, j), p(5, j), p(5, (j + 1) % 14), p(4, (j + 1) % 14), glass, [0, 1, 1]);
  const windshieldFrame = [
    p(4, 11),
    p(5, 11),
    p(5, 12),
    p(5, 13),
    p(5, 0),
    p(5, 1),
    p(5, 2),
    p(5, 3),
    p(4, 3),
    p(4, 2),
    p(4, 1),
    p(4, 0),
    p(4, 13),
    p(4, 12),
  ];
  outline(d, windshieldFrame, 0.016, paint);
  d.rod(p(4, 0), p(5, 0), 0.014, dark);
  const sample = (z, n) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (z <= stations[i][0] && z >= stations[i + 1][0]) {
        const t = (stations[i][0] - z) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][n] * (1 - t) + stations[i + 1][n] * t;
      }
    return stations.at(-1)[n];
  };
  // Skin half width at a station and height on the cabin and tail rings.
  const ringAt = (z) => {
    let i = rings.findIndex((r, n) => n < rings.length - 1 && z <= r.z && z >= rings[n + 1].z);
    if (i < 0) i = z > rings[0].z ? 0 : rings.length - 2;
    const a = rings[i].points,
      b = rings[i + 1].points,
      u = (z - rings[i].z) / (rings[i + 1].z - rings[i].z);
    return a.map((q, j) => [q[0] + (b[j][0] - q[0]) * u, q[1] + (b[j][1] - q[1]) * u]);
  };
  // Profile parameter v of height y: right-side point k plus the fraction towards point k + 1.
  const toV = (z, y) => {
    const q = ringAt(z);
    for (let k = 0; k < 7; k++)
      if (y <= q[k][1] && y >= q[k + 1][1]) return k + (y - q[k][1]) / (q[k + 1][1] - q[k][1] || 1);
    return y > q[0][1] ? 0 : 7;
  };
  const onBand = (side, z, v) => {
    const q = ringAt(z),
      k = Math.min(6, Math.floor(v)),
      f = v - k;
    return [
      side * (q[k][0] + (q[k + 1][0] - q[k][0]) * f),
      q[k][1] + (q[k + 1][1] - q[k][1]) * f,
      z,
    ];
  };
  // The cockpit side sheet runs straight from point 2 to 4 at rings 4 and 5 and over point 3 at
  // ring 6, where the arched cabin starts; its window holes follow the same blend.
  const cockpitX = (z, y) => {
    const chord = (i) => {
      const q = rings[i].points,
        path = i === 6 ? [q[2], q[3], q[4]] : [q[2], q[4]];
      for (let n = 0; n < path.length - 1; n++) {
        const [x0, y0] = path[n],
          [x1, y1] = path[n + 1];
        if ((y - y0) * (y - y1) <= 0) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
      }
      return y > path[0][1] ? path[0][0] : path.at(-1)[0];
    };
    const i = z >= rings[5].z ? 4 : 5,
      u = (rings[i].z - z) / (rings[i].z - rings[i + 1].z);
    return chord(i) * (1 - u) + chord(i + 1) * u;
  };
  // Side band around convex (z, v) window apertures over columns 1-2 (points 1-3) of rings
  // 6-11, by vertical decomposition, so the skin keeps the arch's facets up to each frame.
  const band = (side, windows) => {
    // Collected and smoothed together, so the arch's crease does not bend the window frames.
    const parts = [],
      skin = { add: (geometry) => parts.push(geometry) };
    const edges = windows.flatMap((w) => w.map((a, n) => [a, w[(n + 1) % w.length]]));
    for (let i = 6; i <= 10; i++)
      for (let k = 1; k <= 2; k++) {
        const z0 = rings[i + 1].z,
          z1 = rings[i].z,
          cuts = [z0, z1];
        for (const [[sa, va], [sb, vb]] of edges) {
          if (sa > z0 && sa < z1) cuts.push(sa);
          for (const level of [k, k + 1])
            if ((va - level) * (vb - level) < 0) {
              const s = sa + ((sb - sa) * (level - va)) / (vb - va);
              if (s > z0 && s < z1) cuts.push(s);
            }
        }
        cuts.sort((a, b) => a - b);
        for (let c = 0; c < cuts.length - 1; c++) {
          const sa = cuts[c],
            sb = cuts[c + 1],
            sm = (sa + sb) / 2;
          if (sb - sa < 1e-6) continue;
          const spans = [];
          for (const w of windows) {
            const lines = w
              .map((a, n) => [a, w[(n + 1) % w.length]])
              .filter(([[s0], [s1]]) => (s0 - sm) * (s1 - sm) < 0)
              .map(
                ([[s0, v0], [s1, v1]]) =>
                  (s) =>
                    v0 + ((v1 - v0) * (s - s0)) / (s1 - s0),
              );
            if (lines.length !== 2) continue;
            const [f, g] = lines[0](sm) < lines[1](sm) ? lines : [lines[1], lines[0]];
            if (g(sm) > k && f(sm) < k + 1) spans.push([f, g]);
          }
          spans.sort((a, b) => a[0](sm) - b[0](sm));
          const clamp = (fn) => (s) => Math.min(k + 1, Math.max(k, fn(s)));
          let low = () => k;
          for (const [f, g] of [...spans, [() => k + 1, () => k + 1]]) {
            if (f(sm) > low(sm) + 1e-9) {
              const lo = clamp(low),
                hi = clamp(f);
              quad(
                skin,
                onBand(side, sa, lo(sa)),
                onBand(side, sb, lo(sb)),
                onBand(side, sb, hi(sb)),
                onBand(side, sa, hi(sa)),
                paint,
                [side, 0, 0],
              );
            }
            if (g(sm) > low(sm)) low = g;
          }
        }
      }
    const merged = mergeGeometries(parts);
    d.add(smoothSurface(merged, 50), paint);
    merged.dispose();
    for (const geometry of parts) geometry.dispose();
  };
  // A (z, v) aperture on the skin, split where it crosses columns and stations.
  const aperture = (side, w) =>
    w.flatMap(([s0, v0], n) => {
      const [s1, v1] = w[(n + 1) % w.length],
        ts = [0];
      for (let k = 1; k <= 6; k++) if ((v0 - k) * (v1 - k) < 0) ts.push((k - v0) / (v1 - v0));
      for (const r of rings) if ((s0 - r.z) * (s1 - r.z) < 0) ts.push((r.z - s0) / (s1 - s0));
      return ts
        .sort((a, b) => a - b)
        .map((t) => onBand(side, s0 + (s1 - s0) * t, v0 + (v1 - v0) * t));
    });
  const sideSheets = [];
  for (const side of [-1, 1]) {
    const pt = (z, y, lift = 0) => {
      // Details on the curved (ruled, triangulated) nose sit a little proud of the skin.
      if (z > stations[4][0]) return [side * (noseX(z, y) + 0.012), y, z];
      if (z >= rings[6].z) return [side * (cockpitX(z, y) + lift), y, z];
      return [side * (onBand(1, z, toV(z, y))[0] + lift), y, z];
    };
    const pilot = [
      [3.12, 2.08],
      [2.48, 2.45],
      [2.34, 2.46],
      [2.34, 2.11],
    ].map(([z, y]) => pt(z, y));
    const sideWindow = [
      [2.25, 2.48],
      [1.89, 2.46],
      [1.82, 2.39],
      [1.82, 2.11],
      [1.9, 2.06],
      [2.25, 2.08],
    ].map(([z, y]) => pt(z, y));
    const end = (idx, j) => p(idx, side > 0 ? j : 14 - j);
    const cockpitSide = [
      end(4, 2),
      end(5, 2),
      end(6, 2),
      end(6, 3),
      end(6, 4),
      end(5, 4),
      end(4, 4),
    ];
    sheet(d, cockpitSide, paint, [side, 0, 0], [pilot, sideWindow]);
    // The flight deck lines this sheet from inside, windows and all (kingAirCockpit).
    sideSheets.push({ side, contour: cockpitSide, holes: [pilot, sideWindow] });
    for (const h of [pilot, sideWindow]) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.007, dark);
    }
    // Circular pressure windows, true apertures in the arched skin. Seven passenger windows
    // per side plus the aft lavatory window.
    const windows = [1.17, 0.62, 0.09, -0.44, -0.96, -1.47, -1.98, -3.68].map((z) => {
      // Window tops about 0.22 m under the crown (N1SC side photo).
      const cy = z < -3 ? 2.2 : 2.3;
      return Array.from({ length: 24 }, (_, a) => {
        const zz = z + Math.cos((a * Math.PI) / 12) * 0.175,
          y = cy + Math.sin((a * Math.PI) / 12) * 0.182;
        return [zz, toV(zz, y)];
      });
    });
    band(side, windows);
    for (const w of windows) {
      const h = aperture(side, w);
      sheet(d, h, tinted, [side, 0, 0]);
      outline(d, h, 0.006, dark);
    }
    for (let i = 1; i < 13; i++) {
      outline(
        d,
        (i < 4 ? noseRings : rings)[i].points.map((q) => [...q, rings[i].z]),
        0.0014,
        metal,
      );
      if (i > 4)
        for (let zz = stations[i][0] - 0.06; zz > stations[i + 1][0]; zz -= 0.13)
          d.add(new T.SphereGeometry(0.0025, 5, 3), metal, pt(zz, sample(zz, 2) + 0.35));
      if (i < 12)
        for (const [off, h] of [
          [0.36, 0.075],
          [0.48, 0.021],
        ])
          quad(
            d,
            pt(stations[i][0], stations[i][2] + off, 0.003),
            pt(stations[i + 1][0], stations[i + 1][2] + off, 0.003),
            pt(stations[i + 1][0], stations[i + 1][2] + off + h, 0.003),
            pt(stations[i][0], stations[i][2] + off + h, 0.003),
            accent,
            [side, 0, 0],
          );
    }
    // Port aft airstair and forward avionics hatches; no invented registration number.
    if (side > 0) {
      const corners = [
          [-3.34, 2.43],
          [-4.02, 2.39],
          [-4.02, 1.13],
          [-3.34, 1.12],
        ],
        // Subdivided so the seam stays on the arched upper skin.
        door = corners.flatMap(([za, ya], n) => {
          const [zb, yb] = corners[(n + 1) % 4],
            steps = Math.max(1, Math.ceil(Math.abs(yb - ya) / 0.06));
          return Array.from({ length: steps }, (_, k) =>
            pt(za + ((zb - za) * k) / steps, ya + ((yb - ya) * k) / steps, 0.003),
          );
        });
      outline(d, door, 0.0035, metal);
      d.rod(pt(-3.43, 1.9), pt(-3.57, 1.9), 0.012, dark);
    }
    const hatch = [
      [4.44, 1.85],
      [3.72, 2.02],
      [3.65, 1.38],
      [4.4, 1.3],
    ].map(([z, y]) => pt(z, y));
    outline(d, hatch, 0.003, metal);
    for (let n = 0; n < 6; n++)
      d.rod(pt(3.65 + n * 0.05, 1.56), pt(3.65 + n * 0.05, 1.85), 0.006, dark);
    // Registrations and titles are livery markings (scripts/liveries/aircraft/king-air-350i.mjs).
    // Wiper at wiper scale (1.2 cm); at 1.8 cm it read as a frame bar across the screen.
    d.rod([side * 0.13, 2.25, 3.18], [side * 0.56, 2.33, 2.98], 0.006, dark);
  }
  // Planform: unswept quarter chord, 6-degree dihedral and short upturned winglets.
  const wy = (x) => 1.03 + Math.max(0, x - 0.8) * Math.tan(Math.PI / 30),
    le = (x) => 1.18 - (x - 0.8) * 0.092,
    te = (x) => -1.13 + (x - 0.8) * 0.105,
    hinge = (x) => te(x) + (le(x) - te(x)) * 0.27;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.68, wy(0.68), le(0.68), hinge(0.68), 0.19],
        [side * 2.65, wy(2.65), le(2.65), hinge(2.65), 0.16],
        [side * 8.25, wy(8.25), le(8.25), hinge(8.25), 0.06],
        [side * 8.7, wy(8.7), le(8.7) - 0.1, te(8.7) + 0.06, 0.035],
      ],
      paint,
    );
    for (const [a, b] of [
      [0.68, 0.86],
      [2.23, 2.95],
      [8.08, 8.7],
    ])
      wing(
        d,
        [
          [side * a, wy(a), hinge(a), te(a), 0.025],
          [side * b, wy(b), hinge(b), te(b), 0.02],
        ],
        paint,
      );
    for (const [kind, a, b] of [
      ['flap', 0.86, 2.23],
      ['flap', 2.95, 4.82],
      ['aileron', 4.84, 8.08],
    ]) {
      const g = group(root, `KingAir-${kind}-${side}-${a}`.replaceAll('.', '_'), [
          side * a,
          wy(a),
          hinge(a),
        ]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(a) - hinge(a), 0.025],
          [side * (b - a), wy(b) - wy(a), hinge(b) - hinge(a), te(b) - hinge(a), 0.015],
        ],
        paint,
      );
      for (let x = a + 0.1; x < b; x += 0.19)
        dd.rod(
          [side * (x - a), wy(x) - wy(a) + 0.018, hinge(x) - hinge(a) - 0.01],
          [side * (x - a), wy(x) - wy(a) + 0.005, te(x) - hinge(a) + 0.02],
          0.0015,
          metal,
        );
      dd.finish();
      (kind === 'flap' ? flaps : ailerons).push({
        node: g.name,
        axis: 'x',
        multiplier: kind === 'flap' ? -Math.PI / 6 : -side * 0.3,
      });
    }
    wing(
      d,
      [
        [side * 8.62, wy(8.62), 0.4, -0.21, 0.04],
        [side * 8.8, 2.05, 0.39, -0.2, 0.03],
        [side * 8.8265, 2.47, 0.23, -0.13, 0.012],
      ],
      paint,
    );
    const boot = [0.8, 2.25, 2.97, 5, 8.5].map((x) => [side * x, wy(x) + 0.015, le(x) + 0.003]);
    outline(d, boot, 0.031, dark, false);
    for (let x = 1; x < 8.4; x += 0.48) {
      const h = 0.19 - (x - 0.68) * 0.019;
      for (const u of [0.08, 0.25, 0.45, 0.7])
        d.add(new T.SphereGeometry(0.0026, 5, 3), metal, [
          side * x,
          wy(x) + h * (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) * 0.96),
          le(x) - u * (le(x) - hinge(x)),
        ]);
    }
    ellipsoid(d, [side * 8.8, 1.92, 0.18], [0.025, 0.035, 0.09], side > 0 ? d.red : d.green, 12);
    d.add(new T.CylinderGeometry(0.05, 0.05, 0.012, 16), metal, [side * 3.6, wy(3.6) + 0.12, 0.33]);
    // T-tail area and span come from the specification, not the earlier Baron geometry.
    const tl = (x) => -7.1 - x * 0.36,
      tt = (x) => -8.6379 - x * 0.16,
      th = (x) => tt(x) + 0.34;
    wing(
      d,
      [
        [0, 4.28, tl(0), th(0), 0.075],
        [side * 2.65, 4.28, tl(2.65), th(2.65), 0.034],
        [side * 2.8067, 4.28, tl(2.8067) - 0.07, tt(2.8067), 0.02],
      ],
      paint,
    );
    const g = group(root, `KingAir-elevator-${side}`, [0, 4.28, th(0)]),
      dd = detailKit(g, g.name);
    wing(
      dd,
      [
        [side * 0.12, 0, th(0.12) - th(0), tt(0.12) - th(0), 0.022],
        [side * 2.65, 0, th(2.65) - th(0), tt(2.65) - th(0), 0.012],
      ],
      paint,
    );
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'elevator',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
    outline(
      d,
      [
        [0, 4.3, tl(0)],
        [side * 2.65, 4.3, tl(2.65)],
      ],
      0.018,
      dark,
      false,
    );
  }
  const fin = [
    [-4.8, 2.35],
    [-5.85, 2.39],
    [-7.24, 4.24],
    [-7.55, 4.32],
    [-8.85, 4.28],
    [-7.7, 2.13],
  ];
  // Fin and rudder are tapered sections (10 % of the combined chord, at most 0.15 m thick), not
  // constant-thickness slabs.
  const rudderOutline = [
      [0, 0],
      [-1.15, 2.15],
      [-1.36, 2.13],
      [-0.47, -0.08],
    ],
    chordOf = (outline, y) => {
      const [front, back] = chordAt(outline, y);
      return front - back;
    },
    finHalf = (y) =>
      Math.min(0.075, Math.max(0.015, 0.05 * (chordOf(fin, y) + chordOf(rudderOutline, y - 2.13))));
  foil(
    d,
    outlineRibs(fin).map(([y, f, b]) => [
      y,
      f,
      b,
      finHalf(y),
      finHalf(y) * 0.35,
      finHalf(y) * 0.55,
    ]),
    paint,
  );
  const rudder = group(root, 'KingAir-rudder', [0, 2.13, -7.7]),
    rd = detailKit(rudder, rudder.name);
  foil(
    rd,
    outlineRibs(rudderOutline).map(([y, f, b]) => {
      const h = finHalf(y + 2.13);
      return [y, f, b, h * 0.5, h * 0.55, 0.003];
    }),
    paint,
  );
  rd.finish();
  bindings.push({
    node: rudder.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  d.add(new T.CylinderGeometry(0.025, 0.025, 0.0276, 12), d.ivory, [0, 4.355, -7.63]);
  for (const z of [-2.3, -3.7]) {
    sheet(
      d,
      [
        [0, 2.64, z],
        [0, 2.96, z - 0.2],
        [0, 2.96, z - 0.38],
        [0, 2.61, z - 0.28],
      ],
      paint,
      [1, 0, 0],
    );
  }
  // Twin ventral strakes of the 300/350: swept plates canted 35 degrees below the horizontal
  // from the lower tail cone, reading as a shallow V from behind.
  for (const side of [-1, 1]) {
    const root = [
        [side * 0.43, 1.29, -4.95],
        [side * 0.24, 1.58, -6.65],
      ],
      out = [side * 0.25, -0.175, 0],
      strake = [
        root[0],
        [root[0][0] + out[0], root[0][1] + out[1], -5.6],
        [root[1][0] + out[0], root[1][1] + out[1], -6.55],
        root[1],
      ];
    sheet(d, strake, paint, [side, -1.4, 0]);
    outline(d, strake.slice(1, 3), 0.012, paint, false);
  }
  const enginePoints = [],
    rotors = [];
  for (const [index, side] of [
    [1, 1],
    [2, -1],
  ]) {
    const x = side * 2.6162,
      y = 1.68,
      z = 3.42,
      eg = group(root, `engine-${index}`, [x, y, z]),
      n = group(root, `KingAir-nacelle-${index}`, [x, y, 0]),
      nd = detailKit(n, n.name);
    const ns = [
      [3.42, 0.23, -0.22, 0.18],
      [3.12, 0.32, -0.4, 0.27],
      // The lower nacelle hangs well below the wing over the forward-folding main gear well
      // (350 side photos); it used to stop level with the wing's underside.
      [2.6, 0.36, -0.5, 0.31],
      [0.75, 0.37, -0.7, 0.24],
      [-0.4, 0.36, -0.66, 0.15],
      [-1.22, 0.29, -0.42, 0.03],
      [-1.52, 0.1, -0.14, -0.02],
    ].map(([zz, w, b, t]) => {
      // Rounded superellipse cowl sections (350 front photos), smooth shaded.
      const c = (t + b) / 2,
        h = (t - b) / 2;
      return {
        z: zz,
        c,
        points: Array.from({ length: 10 }, (_, j) => {
          const a = (j * Math.PI) / 5,
            s = Math.sin(a),
            q = Math.cos(a);
          return [
            Math.sign(s) * w * Math.pow(Math.abs(s), 0.8),
            c + Math.sign(q) * h * Math.pow(Math.abs(q), 0.8),
          ];
        }),
      };
    });
    loft(nd, ns, paint, { smooth: true });
    // The navy cowl top sits 4 mm proud of the skin (it z-fought with the cowl).
    const proud = (r, k) => {
      const [x, y] = r.points[k % 10],
        l = Math.hypot(x, y - r.c) || 1;
      return [x + (x / l) * 0.004, y + ((y - r.c) / l) * 0.004, r.z];
    };
    const cap = [],
      capKit = { add: (geometry) => cap.push(geometry) };
    for (let j = 0; j < 3; j++)
      for (const sideIndex of [0, 1, 8, 9])
        quad(
          capKit,
          proud(ns[j], sideIndex),
          proud(ns[j + 1], sideIndex),
          proud(ns[j + 1], sideIndex + 1),
          proud(ns[j], sideIndex + 1),
          accent,
          [0, 1, 0],
        );
    const capGeometry = mergeGeometries(cap);
    nd.add(smoothSurface(capGeometry), accent);
    capGeometry.dispose();
    for (const geometry of cap) geometry.dispose();
    for (const i of [1, 2, 3, 4, 5])
      outline(
        nd,
        ns[i].points.map((p) => [...p, ns[i].z]),
        0.002,
        metal,
      );
    // Lower intake: a scoop fairing under the spinner with a dark mouth and a polished lip (350
    // front 3/4 photos); it was a flat dark lens.
    ellipsoid(nd, [0, -0.27, 3.25], [0.19, 0.09, 0.15], paint, 20);
    const mouth = Array.from({ length: 20 }, (_, i) => {
      const a = (i * Math.PI) / 10;
      return [Math.cos(a) * 0.15, -0.26 + Math.sin(a) * (a < Math.PI ? 0.035 : 0.055), 3.405];
    });
    sheet(nd, mouth, dark, [0, 0, 1]);
    outline(nd, mouth, 0.012, metal);
    for (const sign of [-1, 1]) {
      nd.rod([sign * 0.27, -0.03, 2.75], [sign * 0.51, -0.04, 2.48], 0.093, metal);
      nd.add(new T.CircleGeometry(0.079, 16).rotateY(sign * 0.7), dark, [
        sign * 0.51,
        -0.04,
        2.475,
      ]);
    }
    for (let zz = 0.85; zz < 2.6; zz += 0.15)
      for (const sign of [-1, 1])
        nd.add(new T.SphereGeometry(0.003, 5, 3), metal, [sign * 0.353, 0, zz]);
    nd.finish();
    const prop = group(eg, `KingAir-propeller-${index}`),
      pd = detailKit(prop, prop.name);
    spinner(pd, [0, 0, 0], 0.19, 0.43, metal);
    for (let b = 0; b < 4; b++) {
      const bg = group(prop, `KingAir-prop-${index}-blade-${b}`);
      bg.rotation.z = (b * Math.PI) / 2;
      const bd = detailKit(bg, bg.name),
        pts = [
          [0.15, -0.06, 0],
          [0.46, -0.09, 0.013],
          [1.2, -0.075, 0],
          [1.32, -0.04, 0],
          [1.3335, 0, 0],
          [1.32, 0.05, 0],
          [0.7, 0.085, 0.008],
          [0.15, 0.06, 0],
        ];
      sheet(bd, pts, dark, [0, 0, 1]);
      sheet(
        bd,
        pts.map((p) => [p[0], p[1], p[2] - 0.018]),
        dark,
        [0, 0, -1],
      );
      bd.box([0.045, 0.083, 0.02], [1.29, 0, -0.005], paint);
      bd.finish();
    }
    pd.finish();
    enginePoints.push({ id: eg.name, position: [x, y, z] });
    rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: eg.name });
  }
  // Dual mains fold forward; the single nose leg folds aft (factory specification p.8). Each
  // trunnion sits up inside the nacelle or nose, so retracted legs also rise `lift`: the stowed
  // wheels then sit inside the deep lower nacelle and the nose, not hanging below them.
  for (const [i, x, z, top, r, lift] of [
    [0, 0, 4.62, 1.04, 0.275, 0.31],
    [1, 2.6162, 0, 1.12, 0.285, 0.22],
    [2, -2.6162, 0, 1.12, 0.285, 0.22],
  ]) {
    const g = group(root, `KingAir-gear-${i}`, [x, top, z]),
      dd = detailKit(g, g.name),
      h = top - r;
    dd.rod([0, 0, 0], [0, -h, 0], 0.04, metal);
    dd.rod([0, -0.05, -0.27], [0, -h + 0.18, 0], 0.023, metal);
    dd.rod([0, -0.2, 0.08], [0, -h + 0.08, 0.08], 0.02, dark);
    for (const xx of i ? [-0.115, 0.115] : [0]) {
      wheel(dd, [xx, -h, 0], r, 0.16, rubber, metal);
    }
    if (i) for (const side of [-1, 1]) dd.box([0.017, 0.42, 0.48], [side * 0.24, -0.15, 0], paint);
    else dd.box([0.19, 0.45, 0.018], [0, -0.17, -0.1], paint);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: 'x',
      offset: ((i ? -1 : 1) * Math.PI) / 2,
      scale: ((i ? 1 : -1) * Math.PI) / 2,
    });
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'position',
      axis: 'y',
      keys: [
        [0, lift],
        [0.5, 0],
        [1, 0],
      ],
    });
  }
  d.finish();
  const { stations: controlStations, ...interior } = kingAirCockpit(root, {
    paint,
    accent,
    metal,
    dark,
    sideSheets,
    windshieldFrame,
  });
  cleanGeometry(root);
  return {
    root,
    frame: { ...kingAirFrame(), controlStations },
    enginePoints,
    visual: { rotors, gearNodes: [], flaps, ailerons, animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function kingAirCockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'KingAir-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'KingAir');
  const { bindings, derived, ink, black, amber, red } = ins,
    face = mat('KingAir-panel', '#303337'),
    leather = mat('KingAir-leather', '#b6ab91'),
    headliner = mat('KingAir-headliner', '#d9d2be'),
    wood = mat('KingAir-cabinet', '#634b34');
  // Factory photo at 1376px width: 174px active screen width. 14in diagonal, ~1.6 aspect.
  const sw = 0.3556 / Math.hypot(1, 1 / 1.6),
    sh = sw / 1.6,
    k = sw / 174,
    px = (u) => (691 - u) * k,
    py = (v) => 1.96 - (v - 752) * k,
    z = 2.55,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const centers = [500, 691, 884].map((u) => [px(u), py(752)]);
  const edge = [
    [335, 817],
    [338, 700],
    [355, 654],
    [405, 626],
    [606, 610],
    [642, 585],
    [731, 585],
    [775, 610],
    [976, 627],
    [1024, 660],
    [1039, 818],
  ].map((p) => at(...p));
  const holes = centers.map(([x, y]) => rect(x, y, sw, sh));
  holes.push(rect(px(686), py(615), 0.062, 0.036));
  sheet(d, edge, face, [0, 0, -1], holes);
  sheet(
    d,
    edge.map((p) => [p[0], p[1], p[2] + 0.08]),
    m.dark,
    [0, 0, 1],
  );
  outline(
    d,
    edge.slice(0, -1).map((p) => [p[0], p[1], p[2] - 0.014]),
    0.017,
    black,
    false,
  );
  for (let i = 0; i < edge.length - 1; i++) {
    const a = edge[i],
      b = edge[i + 1];
    if (a[1] > 2.12 && b[1] > 2.12)
      quad(d, a, b, [b[0], b[1] - 0.01, 2.92], [a[0], a[1] - 0.01, 2.92], black, [0, 1, 0]);
  }
  const sources = {
    trueAirspeed: { component: 'aircraftState', path: ['airspeed'] },
    altitude: { component: 'transform', path: ['pos', 1] },
    roll: { component: 'aircraftState', path: ['roll'] },
    pitch: { component: 'aircraftState', path: ['pitch'] },
    yaw: { component: 'aircraftState', path: ['yaw'] },
    verticalSpeed: { component: 'aircraftState', path: ['verticalSpeed'] },
    propNormalized: { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] },
    propNormalized2: { component: 'aircraftState', path: ['engines', 'engine-2', 'rpm'] },
    pitchInput: { component: 'aircraftInput', path: ['pitch'] },
    rollInput: { component: 'aircraftInput', path: ['roll'] },
    yawInput: { component: 'aircraftInput', path: ['yaw'] },
    power: { component: 'aircraftInput', path: ['power'] },
    elevator: { component: 'aircraftState', path: ['elevator'] },
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', Math.PI * 2] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    propRpm: { op: 'multiply', args: ['propNormalized', 1700] },
    propRpm2: { op: 'multiply', args: ['propNormalized2', 1700] },
  });
  for (const [i, [x, y]] of centers.entries()) {
    sheet(
      d,
      rect(x, y, sw + 0.026, sh + 0.026, z - 0.003),
      black,
      [0, 0, -1],
      [rect(x, y, sw, sh, z - 0.003)],
    );
    d.box([sw + 0.03, 0.007, 0.02], [x, y - sh / 2 - 0.015, z - 0.005], m.dark);
    for (const side of [-1, 1])
      for (const yy of [-1, 1])
        pt.knob(x + side * (sw / 2 + 0.006), y + yy * (sh / 2 + 0.006), z - 0.012, 0.0028);
    d.text('COLLINS', [x, y - sh / 2 - 0.009, z - 0.017], 0.004, Math.PI, ink);
    if (i === 1) continue;
    const label = `PFD-${i === 0 ? 'L' : 'R'}`,
      hx = x + (i === 0 ? 0.062 : -0.062),
      hy = y + 0.026;
    ins.horizon(`${label}-horizon`, [hx, hy, z + 0.012], 0.11, 0.094);
    sheet(
      d,
      rect(x, y, sw, sh, z + 0.006),
      black,
      [0, 0, -1],
      [rect(hx, hy, 0.11, 0.094, z + 0.006)],
    );
    const tape = group(cabin, `KingAir-${label}-speed-tape`, [hx + 0.082, hy, z + 0.004]);
    bindings.push({
      node: tape.name,
      source: 'knots',
      property: 'position',
      axis: 'y',
      scale: -0.001,
    });
    ins.available(`${label}-tape`, 'knots', tape.name);
    for (let v = 0; v <= 300; v += 20) {
      const row = group(tape, `KingAir-${label}-speed-tape-${v}`, [0, v * 0.001, 0]),
        dd = detailKit(row, row.name);
      dd.text(String(v), [0.001, 0, 0], 0.0045, Math.PI, ink);
      dd.rod([-0.009, 0, 0], [-0.014, 0, 0], 0.0005, ink);
      dd.rod([-0.011, 0.01, 0], [-0.014, 0.01, 0], 0.0004, ink);
      dd.finish();
      // Both PFDs share these formulas and therefore cannot drift apart.
      derived[`speedTape.${v}.delta`] = { op: 'subtract', args: ['knots', v] };
      derived[`speedTape.${v}.distance`] = { op: 'abs', args: [`speedTape.${v}.delta`] };
      derived[`speedTape.${v}.show`] = { op: 'less', args: [`speedTape.${v}.distance`, 35] };
      bindings.push({
        node: row.name,
        source: `speedTape.${v}.show`,
        property: 'visible',
        scale: 1,
        missing: 'hide',
      });
    }
    d.box([0.03, 0.016, 0.001], [hx + 0.082, hy, z + 0.003], black);
    ins.readout(`${label}-speed`, [hx + 0.082, hy, z + 0.002], 'knots', 3, 0.012, ink, false, true);
    ins.readout(
      `${label}-altitude`,
      [hx - 0.081, hy, z + 0.002],
      'feet',
      5,
      0.008,
      ink,
      true,
      true,
    );
    d.text('TAS', [hx + 0.082, hy + 0.05, z + 0.001], 0.005, Math.PI, ink, 'display');
    d.text('GEO FT', [hx - 0.081, hy + 0.02, z + 0.001], 0.0045, Math.PI, ink, 'display');
    // Half-screen navigation is left blank until route and sensor data exist.
    d.text('NAV INOP', [x + (i === 0 ? -0.08 : 0.08), y + 0.02, z + 0.001], 0.008, Math.PI, amber);
    const rose = group(cabin, `KingAir-${label}-rose`, [hx, y - 0.055, z + 0.002]),
      rd = detailKit(rose, rose.name);
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
      rd.rod(p(deg % 30 ? 0.024 : 0.021), p(0.027), 0.0005, ink);
      if (deg % 30 === 0)
        rd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(0.017),
          0.004,
          Math.PI,
          ink,
        );
    }
    rd.finish();
    bindings.push({
      node: rose.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: 2 * Math.PI,
    });
    ins.available(`${label}-heading`, 'trueHeading', rose.name);
    d.rod([hx, y - 0.022, z + 0.001], [hx, y - 0.029, z + 0.001], 0.001, amber);
    ins.readout(`${label}-heading`, [hx, y - 0.056, z], 'degreesTrue', 3, 0.006, ink, false, true);
    d.text('TRUE', [hx, y - 0.088, z], 0.004, Math.PI, ink, 'display');
    const vsi = group(cabin, `KingAir-${label}-VSI`, [hx - 0.109, hy, z]),
      vd = detailKit(vsi, vsi.name);
    vd.rod([-0.003, 0, 0], [0.002, 0.002, 0], 0.001, ink);
    vd.rod([-0.003, 0, 0], [0.002, -0.002, 0], 0.001, ink);
    vd.finish();
    bindings.push({
      node: vsi.name,
      source: 'verticalFpm',
      property: 'position',
      axis: 'y',
      scale: 0.000012,
      min: -0.036,
      max: 0.036,
      responseSeconds: 0.6,
    });
    ins.available(`${label}-VSI`, 'verticalFpm', vsi.name);
    for (const v of [-2000, 0, 2000])
      d.rod([hx - 0.103, hy + v * 0.000012, z], [hx - 0.099, hy + v * 0.000012, z], 0.0005, ink);
  }
  const [mx, my] = centers[1];
  sheet(d, rect(mx, my, sw, sh, z + 0.006), black, [0, 0, -1]);
  d.text('MAP / NAV INOP', [mx - 0.035, my, z + 0.001], 0.009, Math.PI, amber);
  // Real EICAS column: prop RPM is available; torque, ITT, N1, oil and fuel are not.
  for (const [label, dy] of [
    ['TRQ', 0.075],
    ['ITT', 0.048],
    ['N1', 0.022],
    ['NP RPM', -0.007],
    ['OIL / FUEL', -0.069],
  ])
    d.text(label, [mx + 0.105, my + dy, z + 0.001], 0.005, Math.PI, ink);
  for (const [i, source] of [
    [1, 'propRpm'],
    [2, 'propRpm2'],
  ]) {
    const x = mx + 0.125 - (i - 1) * 0.045;
    ins.readout(`prop-${i}`, [x, my - 0.026, z + 0.001], source, 4, 0.007, ink, false, true);
    for (const dy of [0.061, 0.035, 0.009, -0.084])
      d.text('--', [x, my + dy, z + 0.001], 0.006, Math.PI, amber);
  }
  // Integrated standby unit and flight guidance controller sit in the center brow.
  ins.horizon('ESIS', at(686, 615, 0.008), 0.06, 0.034);
  sheet(
    d,
    rect(px(686), py(615), 0.13, 0.089, z - 0.004),
    black,
    [0, 0, -1],
    [rect(px(686), py(615), 0.062, 0.036, z - 0.004)],
  );
  pt.knob(px(726), py(628), z - 0.02, 0.006);
  d.box([0.416, 0.056, 0.026], at(687, 663, -0.008), m.dark);
  for (const u of [587, 626, 655, 692, 728, 754, 789]) {
    pt.knob(px(u), py(668), z - 0.026, 0.007);
    d.box([0.011, 0.008, 0.006], at(u, 652, -0.026), black);
  }
  for (const [u, label] of [
    [587, 'CRS'],
    [655, 'HDG'],
    [692, 'NAV'],
    [728, 'ALT'],
    [789, 'CRS'],
  ])
    d.text(label, at(u, 645, -0.026), 0.0045, Math.PI, ink);
  // Lower panel, audio controllers, switch groups and gear indications.
  d.box([1.17, 0.175, 0.035], at(691, 866, 0.015), face);
  for (const u of [378, 999])
    for (let i = 0; i < 6; i++) pt.knob(px(u), py(713 + i * 17), z - 0.019, 0.005);
  for (const u of [415, 950]) {
    d.box([0.12, 0.026, 0.012], at(u, 836, -0.01), black);
    for (let n = 0; n < 5; n++) pt.knob(px(u - 25 + n * 13), py(836), z - 0.022, 0.004);
  }
  // Subpanel switch groups: real bat-handle toggles (cockpit-parts), one set per group. The
  // master switch gang (BAT, the engine master station, then both generators) sits above the
  // start group; the subpanel face is 2.5 mm proud of the panel plane.
  const P = partPalette();
  const face2 = z - 0.0025;
  const toggle = (x, y, paddle = false) => panelToggle(d, P, [x, y, face2], paddle);
  for (const u of [505, 530]) toggle(px(u), py(838));
  d.box([0.1, 0.004, 0.004], [px(505), py(838) + 0.017, face2 - 0.016], m.metal);
  d.text('GEN', at(518, 826, -0.0035), 0.0045, Math.PI, ink);
  for (const [u, label] of [
    [383, 'IGNITION'],
    [454, 'START'],
    [526, 'ANTI ICE'],
    [784, 'ENVIR'],
    [839, 'BLEED AIR'],
  ]) {
    const x = px(u),
      y = py(880);
    outline(d, rect(x, y, 0.072, 0.073, face2 - 0.0008), 0.0008, ink);
    d.text(label, [x, y + 0.029, face2 - 0.001], 0.004, Math.PI, ink);
    for (const side of [-1, 1])
      for (const v of [-0.016, 0.01]) toggle(x + side * 0.018, y + v, v < 0);
  }
  // Round fresh-air outlets, set into the subpanel (they stood 2 cm proud of it).
  for (const u of [767, 798, 827, 861]) pt.vent(px(u), py(899), face2 + 0.004, 'round', 0.029);
  for (const u of [646, 682, 718]) {
    pt.gauge(px(u), py(908), face2 - 0.0005, 0.023, black, false);
    d.text('INOP', [px(u), py(908), face2 - 0.0075], 0.0045, Math.PI, ink);
  }
  derived.gearLocked = { op: 'greater', args: ['gear', 0.999] };
  derived.gearOffStop = { op: 'greater', args: ['gear', 0.001] };
  derived.gearNotLocked = { op: 'less', args: ['gear', 0.999] };
  derived.gearTransit = { op: 'and', args: ['gearOffStop', 'gearNotLocked'] };
  for (const [n, u, v] of [
    [0, 607, 856],
    [1, 598, 869],
    [2, 616, 869],
  ]) {
    // Lamps sit in the subpanel face; they floated 2 cm proud of it.
    d.add(new T.CircleGeometry(0.0055, 12).rotateY(Math.PI), black, [px(u), py(v), face2 - 0.0005]);
    const g = group(cabin, `KingAir-gear-lamp-${n}`, [px(u), py(v), face2 - 0.001]),
      dd = detailKit(g, g.name);
    dd.add(new T.CircleGeometry(0.0045, 12).rotateY(Math.PI), d.green);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'gearLocked',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  const transit = group(cabin, 'KingAir-gear-transit', [px(607), py(888), face2 - 0.001]),
    td = detailKit(transit, transit.name);
  td.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), red);
  td.finish();
  bindings.push({
    node: transit.name,
    source: 'gearTransit',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  const gear = group(cabin, 'KingAir-gear-handle', at(586, 888, -0.04)),
    gd = detailKit(gear, gear.name);
  // The 350's gear handle: a lever with a wheel knob whose red lamp lights in transit, pivoted
  // at the subpanel face (2.5 mm proud of the panel plane) and hanging a little down at rest.
  {
    const handle = placed(gd, [0, 0, face2 - gear.position.z], [-0.2, 0, 0]);
    handle.add(bar([0, 0, 0], [0, 0, -0.054], 0.0042, 12), P.alloy);
    handle.add(roundedBox([0.01, 0.012, 0.014], 0.003).translate(0, 0, -0.005), P.alloy);
    // Wheel knob: a white tyre-shaped disc round the red transit lamp.
    handle.add(
      lathe(
        [
          [0, -0.007],
          [0.012, -0.0072],
          [0.0168, -0.0055],
          [0.0175, 0],
          [0.0168, 0.0055],
          [0.012, 0.0072],
          [0, 0.007],
        ],
        20,
      )
        .rotateX(Math.PI / 2)
        .translate(0, 0, -0.062),
      P.white,
    );
    handle.add(
      new T.CylinderGeometry(0.0065, 0.0065, 0.0152, 14)
        .rotateX(Math.PI / 2)
        .translate(0, 0, -0.062),
      P.lamp,
    );
  }
  gd.finish();
  leverGate(placed(d, [px(586), py(888), face2]), { size: [0.026, 0.07], marks: 2 });
  d.text('UP', [px(586) - 0.024, py(888) + 0.026, face2 - 0.001], 0.0045, Math.PI, ink);
  d.text('DN', [px(586) - 0.024, py(888) - 0.026, face2 - 0.001], 0.0045, Math.PI, ink);
  d.text('LDG GEAR', [px(586), py(888) + 0.043, face2 - 0.001], 0.0042, Math.PI, ink);
  bindings.push({
    node: gear.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    offset: -0.7,
    scale: 0.7,
  });
  // The 350's control wheels: an M of swept horns off a broad clock hub (kingAirYoke), on a black
  // column that runs into the subpanel through a fixed escutcheon. Pitch and bank travel.
  const clock = mat('KingAir-clock', '#6f8f64', { emissive: '#1f3a1c', emissiveIntensity: 0.5 });
  for (const u of [433, 938]) {
    const g = group(cabin, `KingAir-yoke-${u}`, at(u, 850, -0.18)),
      dd = detailKit(g, g.name);
    kingAirYoke(dd, P, { lcd: clock, column: [0, -0.0895, 0.24] });
    dd.finish();
    // Column line: through the hub and (0, -0.055, 0.13) from the pivot, so it meets the
    // subpanel face 7 cm under the pivot.
    d.add(new T.CylinderGeometry(0.028, 0.032, 0.006, 20).rotateX(Math.PI / 2), m.dark, [
      px(u),
      py(850) - 0.0699,
      face2 - 0.002,
    ]);
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.06 },
    );
  }
  // Long center pedestal, six lever quadrant, trim wheels, keypad and cursor controls.
  const pedestal = group(cabin, 'KingAir-pedestal', [0, 1.51, 2.06]),
    pd = detailKit(pedestal, pedestal.name);
  beveledBox(pd, [0.3, 0.34, 1.1], [0, 0, 0], face, 0.025);
  pd.ring(0.08, 0.012, [0.158, 0.14, 0.3], black, 'x');
  for (const [pair, x, label] of [
    [0, 0.095, 'power'],
    [1, 0, 'prop'],
    [2, -0.095, 'condition'],
  ])
    for (let i = 0; i < 2; i++) {
      const g = group(pedestal, `KingAir-${label === 'prop' ? 'prop-lever' : label}-${i + 1}`, [
          x + (i ? -0.019 : 0.019),
          0.16,
          0.3 - pair * 0.035,
        ]),
        dd = detailKit(g, g.name),
        h = pair === 2 ? 0.08 : 0.18,
        outboard = i ? -1 : 1;
      // Quadrant knobs after the 350: broad T power levers whose halves meet as a pair, ribbed
      // blue propeller knobs and red-banded condition levers.
      if (pair === 0) {
        const tilt = Math.atan2(-0.07, h);
        dd.add(
          place(
            roundedBox([0.01, Math.hypot(h, 0.07), 0.018], 0.002, 1),
            [0, h / 2, -0.035],
            [tilt, 0, 0],
          ),
          P.alloy,
        );
        for (const knob of kingAirPowerKnob(outboard))
          dd.add(place(knob, [0, h, -0.07], [tilt, 0, 0]), P.black);
      } else if (pair === 1)
        leverGeometry(dd, { style: 'prop', height: h, rake: -0.07, shaft: 'round' });
      else {
        dd.add(bar([0, 0, 0], [0, h, -0.07], 0.0045, 12), P.alloy);
        for (const [material, knob] of conditionKnob(P, red))
          dd.add(place(knob, [0, h, -0.07], [Math.atan2(-0.07, h), 0, 0]), material);
      }
      dd.finish();
      if (pair === 2) {
        // The condition levers are the engines' run/cut-off controls (LOW IDLE forward).
        g.userData.aircraftControl = {
          action: 'engine',
          engine: `engine-${i + 1}`,
          motion: { property: 'rotation', axis: 'x', scale: 0.55, offset: -0.55 },
        };
      }
      if (pair === 0)
        bindings.push({
          node: g.name,
          source: 'power',
          property: 'rotation',
          axis: 'x',
          offset: -0.35,
          scale: 0.7,
        });
    }
  const flap = group(pedestal, 'KingAir-flap-handle', [-0.09, 0.2, -0.02]),
    fd = detailKit(flap, flap.name);
  // Airfoil-knobbed flap lever in its slot on the pedestal's right side (UP / APPROACH / DOWN).
  flapSelectorGeometry(placed(fd, [0, -0.03, 0]), { style: 'lever', height: 0.03, scale: 0.72 });
  fd.finish();
  pd.box([0.009, 0.002, 0.1], [-0.09, 0.1705, -0.055], black);
  bindings.push({
    node: flap.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'z',
    scale: -0.07,
  });
  pd.ring(0.054, 0.01, [0.04, 0.19, -0.08], black, 'y');
  pd.ring(0.04, 0.009, [-0.06, 0.19, -0.23], black, 'y');
  const keypad = group(pedestal, 'KingAir-keyboard', [0, 0.185, -0.4]);
  keypad.rotation.x = -Math.PI / 2;
  const kd = detailKit(keypad, keypad.name);
  beveledBox(kd, [0.21, 0.12, 0.015], [0, 0, 0], black, 0.008);
  const keys = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  keys.forEach((row, r) => {
    [...row].forEach((char, c) => {
      const x = 0.087 - c * 0.019,
        y = 0.04 - r * 0.026;
      kd.box([0.015, 0.019, 0.005], [x, y, -0.011], face);
      kd.text(char, [x, y, -0.015], 0.005, Math.PI, ink);
    });
  });
  kd.finish();
  for (const side of [-1, 1])
    pd.add(new T.CylinderGeometry(0.035, 0.035, 0.025, 16), black, [side * 0.125, 0.2, -0.41]);
  pd.finish();
  // Overhead electrical panel follows its own inclined frame; dead meters are explicitly marked.
  // It lies against the ceiling behind the windshield header, not hanging into the view.
  // Narrower and lower than the crown at its outboard corners, which poked through the roof.
  const overhead = group(cabin, 'KingAir-overhead', [0, 2.6, 2.2]);
  overhead.rotation.x = -1.35;
  const od = detailKit(overhead, overhead.name),
    op = panelTools(od);
  beveledBox(od, [0.64, 0.21, 0.025], [0, 0, 0], face, 0.02);
  for (const x of [-0.27, -0.16, -0.04, 0.15]) {
    op.gauge(x, -0.055, -0.02, 0.034, black, false);
    od.text('INOP', [x, -0.055, -0.033], 0.006, Math.PI, ink);
  }
  // Knobs and toggles seated on the panel face (it is 12.5 mm thick about the frame).
  for (let i = 0; i < 8; i++) op.knob(-0.29 + i * 0.082, 0.066, -0.019, 0.009);
  for (let i = 0; i < 5; i++) panelToggle(od, P, [-0.15 + i * 0.075, 0.02, -0.0125]);
  od.finish();
  ins.headingDrum('compass', [0, 2.49, 2.75], 0.025, 'trueHeading');
  // Separate sidewall switch/breaker panels, angled toward the crew.
  for (const side of [-1, 1]) {
    const g = group(cabin, `KingAir-sidepanel-${side}`, [side * 0.62, 1.72, 2.17]);
    g.rotation.y = -side * 0.72;
    const dd = detailKit(g, g.name);
    beveledBox(dd, [0.28, 0.34, 0.018], [0, 0, 0], face, 0.008);
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++)
        dd.add(new T.CylinderGeometry(0.004, 0.004, 0.008, 8).rotateX(Math.PI / 2), black, [
          -0.11 + col * 0.055,
          -0.14 + row * 0.045,
          -0.018,
        ]);
    dd.text(side > 0 ? 'FUEL SYSTEM' : 'CIRCUIT BREAKERS', [0, 0.145, -0.02], 0.006, Math.PI, ink);
    dd.finish();
  }
  d.box([1.2446, 0.035, 5.6], [0, 1.2, 0.0], m.dark);
  // Aft cabin floor inside the tapering tail cone (its corners poked out of the belly).
  d.box([0.94, 0.035, 1.45], [0, 1.2, -3.525], m.dark);
  // Two crew plus eight passengers in two club groups, with a clear center aisle.
  for (const [row, zz, facing] of [
    [0, 1.78, 0],
    [1, 0.7, Math.PI],
    [2, -0.7, 0],
    [3, -1.54, Math.PI],
    [4, -2.94, 0],
  ])
    for (const side of [-1, 1]) {
      const crew = row === 0 ? 0.07 : 0,
        g = group(cabin, `KingAir-seat-${row}-${side}`, [side * 0.36, 1.46 + crew, zz]);
      g.rotation.y = facing;
      const sd = detailKit(g, g.name);
      beveledBox(sd, [0.49, 0.15, 0.52], [0, 0, 0], leather, 0.045);
      beveledBox(sd, [0.46, 0.66, 0.14], [0, 0.37, -0.23], leather, 0.045);
      beveledBox(sd, [0.32, 0.46, 0.02], [0, 0.38, -0.148], leather, 0.025);
      beveledBox(sd, [0.32, 0.17, 0.12], [0, 0.75, -0.21], leather, 0.03);
      for (const s of [-1, 1]) {
        sd.rod([s * 0.205, 0.2, -0.17], [s * 0.205, 0.2, 0.16], 0.027, leather);
        sd.rod([s * 0.15, -0.21 - crew, 0], [s * 0.15, -0.05, 0], 0.014, m.metal);
        sd.rod([s * 0.09, 0.66, -0.21], [s * 0.09, 0.7, -0.21], 0.008, m.metal);
      }
      sd.rod([-0.17, 0.085, -0.12], [0.17, 0.085, 0.12], 0.014, black);
      sd.box([0.04, 0.016, 0.035], [0, 0.094, 0], m.metal);
      sd.finish();
    }
  for (const side of [-1, 1]) {
    d.box([0.045, 0.37, 4.1], [side * 0.6, 1.46, -1.0], wood);
    d.box([0.1, 0.025, 4.1], [side * 0.57, 1.66, -1.0], wood);
    for (const zz of [0.08, -2.15]) {
      beveledBox(d, [0.016, 0.35, 0.61], [side * 0.562, 1.48, zz], leather, 0.006);
      for (const delta of [-0.32, 0.32])
        d.ring(0.039, 0.006, [side * 0.6, 1.68, zz + delta], m.metal, 'y');
    }
    for (const zz of [0.7, -0.7, -1.54, -2.94]) {
      d.ring(0.023, 0.005, [side * 0.31, 2.6, zz], m.metal, 'y');
      ellipsoid(d, [side * 0.31, 2.59, zz], [0.014, 0.01, 0.014], black, 12);
    }
    for (const j of [-1, 1]) {
      // j = +1 is the left pedal of each pair (outboard +X).
      const g = group(cabin, `KingAir-pedal-${side}-${j}`, [side * 0.34 + j * 0.09, 1.3, 2.66]),
        dd = detailKit(g, g.name);
      kingAirPedal(dd, P, j);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.045,
      });
    }
  }
  // Narrow headliner strips and cabinetry keep every pressure window open.
  // Stepped down with the roof so the aft strips stay under the descending crown.
  for (const [front, back, y, strip] of [
    [1.85, -0.65, 2.63, 2.58],
    [-0.65, -2.12, 2.565, 2.505],
    [-2.12, -3.55, 2.455, 2.36],
  ]) {
    d.box([0.72, 0.022, front - back], [0, y, (front + back) / 2], headliner);
    for (const side of [-1, 1])
      d.box([0.06, 0.08, front - back - 0.1], [side * 0.46, strip, (front + back) / 2], headliner);
  }
  // Aft cabinet and side-facing seat kept inside the narrowing tail cone and lower roof.
  beveledBox(d, [0.46, 1.06, 0.31], [-0.29, 1.75, -3.69], wood, 0.035);
  beveledBox(d, [0.46, 0.12, 0.49], [-0.33, 1.47, -4.1], leather, 0.025);
  beveledBox(d, [0.12, 0.58, 0.49], [-0.47, 1.75, -4.1], leather, 0.025);
  for (const side of [-1, 1])
    beveledBox(d, [0.29, 0.85, 0.35], [side * 0.49, 1.64, 1.0], wood, 0.025);
  // Fit the flight deck to the airframe, so no painted skin shows from the seats: a bulkhead
  // around the panel (beside it to the walls, behind its back sheet), a footwell bulkhead ahead
  // of the pedals, cream sidewall liners from the cabin divider to the footwell, cream trim over
  // the inner half of the windshield frame, and a dark deck
  // from the glare shield to the windshield's lower frame (ring 4: 0.39 m / 2.205 m, 0.5915 m /
  // 2.07 m and 0.65 m / 1.886 m out from the 2.23 m centre).
  const sidewall = mat('KingAir-sidewall', '#cbc1a6', { roughness: 0.8 });
  // Knee panel under the pilot's subpanel carrying the parking brake handle.
  beveledBox(d, [0.12, 0.055, 0.02], [0.52, 1.6475, 2.5575], face, 0.004);
  cockpitBulkhead(d, root, { z: 2.636, yFrom: 1.675, yTo: 2.16, material: face });
  // At the floor's forward end (2.8 m); tall enough that no ray under the subpanel passes it.
  cockpitBulkhead(d, root, { z: 2.795, yFrom: 1.2, yTo: 1.95, material: m.dark });
  // The cockpit side sheets (ring 6 forward, 1.73 m) carry the windows: their liner is the same
  // sheet 9 mm inboard with the same apertures. Aft of them, and above and below them, the
  // liners follow the sliced skin; the carpet skirt closes the belly beside the floor.
  for (const { side, contour, holes } of m.sideSheets) {
    const inboard = (q) => [q[0] - side * 0.009, q[1], q[2]];
    sheet(
      d,
      contour.map(inboard),
      sidewall,
      [-side, 0, 0],
      holes.map((h) => h.map(inboard)),
    );
  }
  const inside = new T.Vector3(0, 2.0, 2.2);
  outline(
    d,
    m.windshieldFrame.map((q) => {
      const v = new T.Vector3(...q);
      return v.addScaledVector(inside.clone().sub(v).normalize(), 0.009).toArray();
    }),
    // Thinner than the painted frame (0.016) and offset inboard, so it shows only inside.
    0.0135,
    sidewall,
  );
  const liner = (zFrom, zTo, yFrom, yTo, zSteps, ySteps, material = sidewall) =>
    cockpitLiner(d, root, { zFrom, zTo, yFrom, yTo, material, zSteps, ySteps });
  liner(0.84, 1.73, 1.218, 2.64, 8, 22);
  liner(1.73, 2.795, 1.218, 1.24, 9, 1);
  liner(1.73, 2.795, 2.5, 2.66, 9, 3);
  liner(0.84, 2.795, 1.07, 1.218, 16, 2, m.dark);
  const base = [
      [0, 2.23],
      [0.39, 2.205],
      [0.5915, 2.07],
      [0.65, 1.886],
    ],
    baseY = (x) => {
      const ax = Math.abs(x);
      for (let i = 0; i < base.length - 1; i++)
        if (ax <= base[i + 1][0])
          return (
            base[i][1] +
            ((base[i + 1][1] - base[i][1]) * (ax - base[i][0])) / (base[i + 1][0] - base[i][0])
          );
      return base.at(-1)[1];
    };
  const shield = edge.filter((p) => p[1] > 2.12).map((p) => [p[0], p[1] - 0.01, 2.92]);
  for (let i = 0; i < shield.length - 1; i++) {
    const a = shield[i],
      b = shield[i + 1];
    quad(
      d,
      a,
      b,
      [b[0], baseY(b[0]) - 0.012, 3.245],
      [a[0], baseY(a[0]) - 0.012, 3.245],
      black,
      [0, 1, 0],
    );
  }
  d.finish();
  // Where the 350's remaining controls are: the parking brake T-handle under the pilot's
  // subpanel, the battery switch at the head of the master switch gang (both generators beside
  // it). Each engine's run/cut-off is its condition lever on the pedestal (set above).
  const stations = [
    {
      action: 'brake',
      style: 'tee',
      at: [0.52, 1.648, 2.5455],
      label: 'PARKING BRAKE',
      labelAt: [0, -0.019, -0.001],
      labelHeight: 0.0042,
    },
    {
      action: 'engine',
      style: 'toggle',
      scale: 0.8,
      at: [px(480), py(838), face2],
      label: 'BAT',
      labelAt: [0, 0.021, -0.001],
      labelHeight: 0.0045,
    },
  ];
  // Both crew displays consume the same sensors. Reuse identical named calculations;
  // only their physical node bindings differ. Leave room for authored fixture inputs.
  for (const [name, value] of Object.entries(derived)) {
    if (!name.includes('PFD-R')) continue;
    const shared = name.replaceAll('PFD-R', 'PFD-L');
    const normalized =
      typeof value === 'object'
        ? {
            ...value,
            args: value.args.map((v) =>
              typeof v === 'string' ? v.replaceAll('PFD-R', 'PFD-L') : v,
            ),
          }
        : value;
    if (JSON.stringify(normalized) !== JSON.stringify(derived[shared])) continue;
    for (const binding of bindings) if (binding.source === name) binding.source = shared;
    for (const expression of Object.values(derived))
      if (typeof expression === 'object')
        expression.args = expression.args.map((v) => (v === name ? shared : v));
    delete derived[name];
  }
  return { nodes: ['cockpit'], sources, derived, bindings, stations };
}
