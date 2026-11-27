/** 2021 Grand Caravan EX, four-blade McCauley propeller, G1000 NXi, commuter cabin.
 * Main axle origin; +Y up, +Z nose, +X pilot left. See the per-aircraft reference review.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import {
  bar,
  contour,
  flapSelectorGeometry,
  lathe,
  leverGeometry,
  loftUp,
  parkingBrakeGeometry,
  partPalette,
  place,
  roundedBox,
  switchGeometry,
  tube,
} from './cockpit-parts.mjs';
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

/** The lofted skin's ring at station z (linear between the authored rings). */
function ringAt(rings, z) {
  let i = rings.findIndex((r, n) => n < rings.length - 1 && z <= r.z && z >= rings[n + 1].z);
  if (i < 0) i = z > rings[0].z ? 0 : rings.length - 2;
  const a = rings[i].points,
    b = rings[i + 1].points,
    u = Math.min(1, Math.max(0, (z - rings[i].z) / (rings[i + 1].z - rings[i].z)));
  return a.map((q, j) => [q[0] + (b[j][0] - q[0]) * u, q[1] + (b[j][1] - q[1]) * u]);
}
/** Skin half width at station z and height y; cabin trim is kept inside it. */
function skinHalfWidth(rings, z, y) {
  const q = ringAt(rings, z);
  let x = 0;
  for (let j = 0; j < q.length; j++) {
    const [ax, ay] = q[j],
      [bx, by] = q[(j + 1) % q.length];
    if ((ay - y) * (by - y) <= 0 && ay !== by)
      x = Math.max(x, Math.abs(ax + ((bx - ax) * (y - ay)) / (by - ay)));
  }
  return x;
}
/** Skin roof height at station z and lateral offset x. */
function skinRoof(rings, z, x) {
  const q = ringAt(rings, z);
  let y = -Infinity;
  for (let j = 0; j < q.length; j++) {
    const [ax, ay] = q[j],
      [bx, by] = q[(j + 1) % q.length];
    if ((ax - x) * (bx - x) <= 0 && ax !== bx)
      y = Math.max(y, ay + ((by - ay) * (x - ax)) / (bx - ax));
  }
  return y;
}
/** Clamp an instrument's fixed mask (a square larger than its aperture) below a panel top:
 * otherwise the black square stands above the glareshield in the pilot's view. */
function trimMask(frame, top) {
  frame.traverse((mesh) => {
    if (!mesh.isMesh) return;
    let offset = 0;
    for (let node = mesh; node !== frame; node = node.parent) {
      if (/-bank$/.test(node.name)) return;
      offset += node.position.y;
    }
    const position = mesh.geometry.getAttribute('position'),
      limit = top - frame.position.y - offset;
    for (let i = 0; i < position.count; i++) if (position.getY(i) > limit) position.setY(i, limit);
    position.needsUpdate = true;
  });
}

/** Cessna rudder pedal, origin at the pad centre (`out` = +1 when its outboard side is +X): a
 * cast plate widening toward the top, leaning its top forward, with the toe-brake lip rolled
 * forward across its top and a stiffening rib down its face; an arm down to the floor torque tube,
 * the hinge bar at its foot and the brake cylinder running forward from the pedal top. */
function caravanPedal(d, P, out, lean = 0.26) {
  const leaned = (geometry, extra = 0) => place(geometry, [0, 0, 0], [lean + extra, 0, 0]);
  // The plate: a trapezoid with eased corners, one flat face front and back (the console reads
  // a pedal's lean from its broad face, so the plate must hold most of its surface).
  const outline = new T.Shape();
  for (const [i, [x, y]] of [
    [-0.045, -0.05],
    [0.045, -0.05],
    [0.06, 0.034],
    [-0.06, 0.034],
  ].entries())
    i ? outline.lineTo(x, y) : outline.moveTo(x, y);
  const plate = new T.ExtrudeGeometry(outline, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.003,
    bevelSegments: 1,
  }).translate(0, 0, -0.004);
  plate.deleteAttribute('uv');
  d.add(leaned(plate), P.steel);
  // Toe-brake roll across the top and the hinge bar at the foot.
  d.add(leaned(bar([-0.06, 0.04, 0.001], [0.06, 0.04, 0.001], 0.0065, 12)), P.alloy);
  d.add(leaned(bar([-0.045, -0.05, 0.008], [0.045, -0.05, 0.008], 0.006, 12)), P.steel);
  d.add(bar([0, -0.045, 0.0], [0, -0.135, 0.07], 0.006, 10), P.steel);
  d.add(bar([-0.03, -0.135, 0.07], [0.03, -0.135, 0.07], 0.01, 12), P.steel);
  d.add(bar([out * 0.04, 0.025, 0.02], [out * 0.04, -0.08, 0.12], 0.005, 10), P.alloy);
}
/** A horn grip lofted up from its foot. */
const caravanHorn = (h) =>
  loftUp([
    { y: 0, points: contour(0, 0, 0.0135, 0.0165, 14, 2.2) },
    { y: h * 0.35, points: contour(0, 0.001, 0.016, 0.019, 14, 2.2) },
    { y: h * 0.75, points: contour(0, 0.002, 0.0165, 0.0195, 14, 2.2) },
    { y: h * 0.93, points: contour(0, 0.001, 0.0135, 0.016, 14, 2.2) },
    { y: h, points: contour(0, 0, 0.006, 0.007, 14, 2.2) },
  ]);
/** Caravan control wheel in its yoke group (wheel plane at z, hub at the origin): a tall squared
 * hub with the chrome name plate, arms sweeping down and out to ram's-horn grips canted outward,
 * the electric trim and autopilot disconnect on the left horn, push-to-talk on the right, all on
 * a chrome tube running forward into the panel. */
function caravanYoke(d, P, z) {
  d.add(bar([0, -0.008, 0.25], [0, -0.008, z + 0.02], 0.0145, 16), P.alloy);
  d.add(
    place(
      loftUp([
        { y: -0.066, points: contour(0, 0, 0.03, 0.017, 16, 3) },
        { y: -0.058, points: contour(0, 0, 0.04, 0.022, 16, 3) },
        { y: 0.04, points: contour(0, 0, 0.04, 0.022, 16, 3) },
        { y: 0.05, points: contour(0, 0, 0.031, 0.017, 16, 3) },
      ]),
      [0, 0, z],
    ),
    P.grip,
  );
  d.add(place(roundedBox([0.052, 0.03, 0.003], 0.005, 1), [0, 0.012, z - 0.0225]), P.alloy);
  for (const s of [-1, 1]) {
    d.add(
      tube(
        [
          [s * 0.036, -0.03, z],
          [s * 0.09, -0.056, z - 0.002],
          [s * 0.14, -0.047, z - 0.004],
          [s * 0.162, -0.012, z - 0.006],
        ],
        0.0135,
        14,
      ),
      P.grip,
    );
    d.add(place(caravanHorn(0.13), [s * 0.163, -0.02, z - 0.006], [0, 0, -s * 0.12]), P.grip);
  }
  d.add(
    place(roundedBox([0.012, 0.006, 0.018], 0.002, 1), [0.177, 0.111, z - 0.008], [0, 0, -0.12]),
    P.black,
  );
  d.add(
    place(
      new T.CylinderGeometry(0.0048, 0.0048, 0.006, 12),
      [0.158, 0.088, z - 0.006],
      [0, 0, Math.PI / 2],
    ),
    P.red,
  );
  d.add(
    place(roundedBox([0.006, 0.016, 0.011], 0.002, 1), [-0.158, 0.08, z - 0.006], [0, 0, 0.12]),
    P.black,
  );
}
/** Crew-station trim inside the skin's flat side bays (loft points 2 to 3): the crew-door bay
 * lined round its window, the windscreen-side bay lined below and above its pane, and the
 * headliner over the crew, 12 mm inside the skin, with dark reveals out to the glass so no
 * painted skin shows round the windows. `rings` are the fuselage loft rings. */
function caravanLiner(d, rings, material, reveal, floor) {
  const inset = 0.012,
    [r3, r4, r5] = [rings[3], rings[4], rings[5]],
    lerp = (a, b, f) => a + (b - a) * f,
    bayAt = (z) => (z >= r4.z ? [r3, r4] : [r4, r5]),
    at = (z, j) => {
      const [a, b] = bayAt(z),
        f = (a.z - z) / (a.z - b.z);
      return [lerp(a.points[j][0], b.points[j][0], f), lerp(a.points[j][1], b.points[j][1], f)];
    },
    shoulder = (z) => at(z, 2)[1],
    wall =
      (s) =>
      ([z, y]) => [s * (at(z, 2)[0] - inset), y, z];
  // Window outlines in side view [z, y]. The crew door's is authored in bay fractions.
  const pane = [
    [2.8, 2.07],
    [2.62, 2.12],
    [1.73, 2.53],
    [1.7, 2.49],
    [1.95, 1.99],
    [2.7, 2.04],
  ];
  const door = [
    [0.36, 0.07],
    [0.9, 0.07],
    [0.94, 0.11],
    [0.94, 0.44],
    [0.9, 0.48],
    [0.05, 0.48],
    [0.02, 0.44],
  ].map(([u, v]) => {
    const z = lerp(r4.z, r5.z, u),
      top = shoulder(z),
      bottom = at(z, 3)[1];
    return [z, top - v * (top - bottom)];
  });
  const paneBottom = (z) => lerp(1.99, 2.04, (z - 1.95) / 0.75);
  for (const s of [-1, 1]) {
    const w = wall(s),
      normal = [-s, 0, 0];
    // Crew-door bay with its window.
    sheet(
      d,
      [
        [r4.z, floor],
        [r5.z, floor],
        [r5.z, shoulder(r5.z) - 0.004],
        [r4.z, shoulder(r4.z) - 0.004],
      ].map(w),
      material,
      normal,
      [door.map(w)],
    );
    // Windscreen-side bay: below the pane back to the firewall, and the wedge above it.
    sheet(
      d,
      [
        [2.66, paneBottom(2.66)],
        [1.95, 1.99],
        [r4.z, 2.49],
        [r4.z, floor],
        [2.66, floor],
      ].map(w),
      material,
      normal,
    );
    sheet(
      d,
      [
        [2.8, 2.07],
        [2.62, 2.12],
        [1.73, 2.53],
        [r4.z, 2.49],
        [r4.z, shoulder(r4.z) - 0.004],
        [2.8, shoulder(2.8) - 0.004],
      ].map(w),
      material,
      normal,
    );
    // Dark reveals from the lining out to the glass, which sits on the skin line: round the door
    // window, and along the windscreen-side pane back of the firewall.
    const glass = ([z, y]) => [s * (at(z, 2)[0] + 0.003), y, z];
    for (const [outline, closed, centre] of [
      [door, true, [1.44, 2.2]],
      [[...pane.slice(0, 5), [2.66, paneBottom(2.66)]], false, [2.2, 2.25]],
    ])
      for (let i = 0; i < outline.length - (closed ? 0 : 1); i++) {
        const a = outline[i],
          b = outline[(i + 1) % outline.length];
        quad(d, w(a), w(b), glass(b), glass(a), reveal, [
          0,
          centre[1] - (a[1] + b[1]) / 2,
          centre[0] - (a[0] + b[0]) / 2,
        ]);
      }
    // A floor-coloured sill along the wall foot hides the slot between the floor and the lining.
    for (const [za, zb] of [
      [2.66, r4.z],
      [r4.z, r5.z],
    ]) {
      const sill = (z, inward) => [s * (at(z, 2)[0] - inset - inward), floor + 0.0025, z];
      quad(d, sill(za, 0), sill(zb, 0), sill(zb, 0.07), sill(za, 0.07), reveal, [0, 1, 0]);
    }
    // Headliner over the crew-door bay: the roof shoulder (point 2 to 1) and the roof (1 to 0).
    const roof = (z, j) => {
      const [x, y] = at(z, j);
      return [s * Math.max(0, x - (j ? inset : 0)), y - inset, z];
    };
    quad(d, roof(r4.z, 2), roof(r5.z, 2), roof(r5.z, 1), roof(r4.z, 1), material, [-s, -1, 0]);
    quad(d, roof(r4.z, 1), roof(r5.z, 1), roof(r5.z, 0), roof(r4.z, 0), material, [
      -s * 0.2,
      -1,
      0,
    ]);
  }
}
export const caravanFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.875,
  cy: 1.9,
  ry: 0.85,
  cabinZ: 1.65,
  cabinWidth: 1.63,
  eye: [0.4, 2.5, 1.65],
  panelZ: 2.45,
  floor: 1.32,
});

export function buildCaravan(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Caravan-white', '#e3e7e4', { side: T.DoubleSide }),
    blue = mat('Caravan-blue', '#22546f', { side: T.DoubleSide }),
    metal = mat('Caravan-alloy', '#989f9d', { metalness: 0.65 }),
    dark = mat('Caravan-trim', '#252e30'),
    rubber = mat('Caravan-tires', '#252929'),
    glass = mat('Caravan-glazing', '#a7c4cd', {
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.16,
    }),
    // Tinted passenger windows: every EX photo shows them as dark rounded rectangles.
    tinted = mat('Caravan-cabin-glass', '#26313a', {
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: T.DoubleSide,
      metalness: 0.35,
      roughness: 0.1,
    });
  const d = detailKit(root, 'Caravan-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Individually measured contour stations, with the tall box cabin and long turbine cowling.
  const stations = [
    // Rounded intake lip, a chin rising toward it and a cowl top climbing to the windscreen;
    // the roof stays level instead of peaking over the windscreen (N673EX side profile).
    [4.65, 0.33, 1.46, 2.07],
    [4.4, 0.42, 1.38, 2.13],
    [3.65, 0.53, 1.25, 2.2],
    [2.85, 0.69, 1.11, 2.25],
    [1.7, 0.78, 1.08, 2.74],
    [1.18, 0.84, 1.06, 2.77],
    [0.63, 0.875, 1.04, 2.77],
    [0, 0.875, 1.02, 2.74],
    [-0.9, 0.87, 1.01, 2.7],
    [-1.75, 0.855, 1.02, 2.66],
    [-2.38, 0.84, 1.04, 2.65],
    [-2.99, 0.8, 1.1, 2.64],
    [-3.6, 0.72, 1.2, 2.63],
    [-5.8, 0.36, 1.48, 2.61],
    [-6.8, 0.2, 1.69, 2.52],
    [-7.5, 0.055, 2.02, 2.27],
  ];
  // The cowl rings blend from the cabin's boxy section toward a round superellipse (the cowl
  // is a rounded nose bowl in every photo); the cabin rings stay as measured.
  const roundness = [1, 1, 0.6];
  const rings = stations.map(([z, w, b, t], i) => {
    const box = [
        [0, t],
        [w * 0.74, t - 0.035],
        [w, t - 0.17],
        [w, b + 0.22],
        [w * 0.7, b],
        [0, b - 0.035],
      ],
      k = roundness[i] ?? 0,
      cy = (t + b - 0.035) / 2,
      h = (t - b + 0.035) / 2,
      right = box.map(([x, y], j) => {
        const a = ([0, 38, 75, 110, 145, 180][j] * Math.PI) / 180,
          s = Math.sin(a),
          c = Math.cos(a),
          rx = w * Math.pow(Math.abs(s), 2 / 2.4),
          ry = cy + Math.sign(c) * h * Math.pow(Math.abs(c), 2 / 2.4);
        return [x + (rx - x) * k, y + (ry - y) * k];
      });
    return {
      z,
      points: [
        ...right,
        ...right
          .slice(1, 5)
          .reverse()
          .map(([x, y]) => [-x, y]),
      ],
    };
  });
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  // Skin half width at height y on ring i (stripes and rivets follow the rounded cowl).
  const halfAt = (i, y) => {
    const q = rings[i].points;
    for (let j = 0; j < 5; j++)
      if ((q[j][1] - y) * (q[j + 1][1] - y) <= 0 && q[j][1] !== q[j + 1][1])
        return q[j][0] + ((q[j + 1][0] - q[j][0]) * (y - q[j][1])) / (q[j + 1][1] - q[j][1]);
    return stations[i][1];
  };
  loft(d, rings, paint, {
    skip: (i, j) =>
      i < 3 || (i === 3 && [0, 1, 8, 9].includes(j)) || (i >= 3 && i <= 11 && [2, 7].includes(j)),
  });
  loft(d, rings.slice(0, 4), paint, { caps: false, smooth: true });
  for (const j of [0, 1, 8, 9])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 10), p(3, (j + 1) % 10), glass, [0, 1, 1]);
  outline(
    d,
    [p(3, 8), p(4, 8), p(4, 9), p(4, 0), p(4, 1), p(4, 2), p(3, 2), p(3, 1), p(3, 0), p(3, 9)],
    0.018,
    paint,
  );
  d.rod(p(3, 0), p(4, 0), 0.017, paint);
  for (const side of [-1, 1]) {
    const j = side > 0 ? 2 : 7;
    // Windscreen side pane, pilot door plus seven passenger window bays. The roof shoulder is
    // separate from glazing.
    for (let i = 3; i <= 11; i++) {
      const a = p(i, j),
        b = p(i + 1, j),
        c = p(i + 1, j + 1),
        e = p(i, j + 1);
      const q = (u, v) => {
        const t = side > 0 ? v : 1 - v;
        return a.map(
          (_, n) => (a[n] * (1 - u) + b[n] * u) * (1 - t) + (e[n] * (1 - u) + c[n] * u) * t,
        );
      };
      // Bay fractions (u aft along the bay, v down from the roof shoulder) of a side-view point.
      const uv = ([z, y]) => {
        const u = (rings[i].z - z) / (rings[i].z - rings[i + 1].z),
          top = p(i, 2)[1] * (1 - u) + p(i + 1, 2)[1] * u,
          bottom = p(i, 3)[1] * (1 - u) + p(i + 1, 3)[1] * u;
        return [u, (top - y) / (top - bottom)];
      };
      const pts =
        i === 3
          ? // The windscreen wraps down the side to the cowl line ahead of the crew door
            // (N727EX and PS-CNC photos); this panel was solid skin.
            [
              [2.8, 2.07],
              [2.62, 2.12],
              [1.73, 2.53],
              [1.7, 2.49],
              [1.95, 1.99],
              [2.7, 2.04],
            ].map(uv)
          : i === 4
            ? // Crew door window: large, its front edge raked parallel to the door frame.
              [
                [0.36, 0.07],
                [0.9, 0.07],
                [0.94, 0.11],
                [0.94, 0.44],
                [0.9, 0.48],
                [0.05, 0.48],
                [0.02, 0.44],
              ]
            : // Rounded rectangles (corner arcs in bay fractions), not chamfered octagons.
              [
                [0.81, 0.38, 0],
                [0.2, 0.38, 1],
                [0.2, 0.25, 2],
                [0.81, 0.25, 3],
              ].flatMap(([u, v, k]) =>
                [0, 1, 2, 3].map((n) => {
                  const angle = ((k + n / 3) * Math.PI) / 2;
                  return [u + 0.07 * Math.cos(angle), v + 0.07 * Math.sin(angle)];
                }),
              );
      const h = pts.map(([u, v]) => q(u, v));
      sheet(d, [a, b, c, e], paint, [side, 0, 0], [h]);
      sheet(d, h, i <= 4 ? glass : tinted, [side, 0, 0]);
      outline(d, h, 0.005, dark);
    }
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1],
        yy = (q) => q[2] + 0.29,
        x = (k, q, dy = 0) => halfAt(k, yy(q) + dy) + 0.002;
      quad(
        d,
        [side * x(i, a), yy(a), a[0]],
        [side * x(i + 1, b), yy(b), b[0]],
        [side * x(i + 1, b, 0.11), yy(b) + 0.11, b[0]],
        [side * x(i, a, 0.11), yy(a) + 0.11, a[0]],
        blue,
        [side, 0, 0],
      );
      for (let t = 0; t < 1; t += 0.18 / Math.abs(b[0] - a[0]))
        d.add(new T.SphereGeometry(0.003, 4, 2), metal, [
          side * (x(i, a, -0.04) + (x(i + 1, b, -0.04) - x(i, a, -0.04)) * t + 0.001),
          yy(a) + (yy(b) - yy(a)) * t - 0.04,
          a[0] + (b[0] - a[0]) * t,
        ]);
    }
    for (const i of [1, 3, 5, 7, 9, 12, 13, 14])
      outline(
        d,
        rings[i].points.map((q) => [...q, rings[i].z]),
        0.0018,
        metal,
      );
    outline(
      d,
      [
        [side * 0.78, 2.56, 1.7],
        [side * 0.84, 2.59, 1.18],
        [side * 0.84, 1.33, 1.18],
        [side * 0.73, 1.3, 2.3],
      ],
      0.0035,
      dark,
    );
    d.box([0.022, 0.025, 0.19], [side * 0.845, 2.03, 1.48], metal);
    d.box([0.31, 0.045, 0.27], [side * 0.94, 0.92, 1.42], metal);
    // The aft right airstair and left wide cargo door have different seams.
    const end = side > 0 ? -3.95 : -3.8,
      begin = side > 0 ? -2.6 : -3.0;
    outline(
      d,
      [
        [side * 0.82, 2.65, begin],
        [side * 0.7, 2.61, end],
        [side * 0.7, 1.32, end],
        [side * 0.82, 1.25, begin],
      ],
      0.004,
      dark,
    );
    d.box([0.02, 0.025, 0.15], [side * 0.75, 1.89, end + 0.25], metal);
    // The 2021 wing is tapered continuously; lift strut and jury braces meet the two spars.
    const y = (x) => 2.65 + (Math.abs(x) - 0.86) * Math.tan(Math.PI / 60);
    const le = (x) => 0.895 - (Math.abs(x) - 0.86) * 0.06,
      te = (x) => -1.096 + (Math.abs(x) - 0.86) * 0.048;
    const hinge = (x) => te(x) + (x < 5.75 ? 0.42 : 0.32);
    wing(
      d,
      [
        [side * 0.76, y(0.86), le(0.86), hinge(0.86), 0.17],
        [side * 5.72, y(5.72), le(5.72), hinge(5.72), 0.13],
        [side * 5.74, y(5.74), le(5.74), hinge(5.74), 0.13],
        [side * 7.78, y(7.78), le(7.78), hinge(7.78), 0.095],
        [side * 7.91, y(7.91), le(7.91) - 0.04, te(7.91) + 0.03, 0.065],
      ],
      paint,
    );
    for (const [kind, start, end] of [
      ['flap', 0.88, 5.72],
      ['aileron', 5.74, 7.78],
    ]) {
      const g = group(root, `Caravan-${kind}-${side}`, [side * start, y(start), hinge(start)]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(start) - hinge(start), 0.023],
          [
            side * (end - start),
            y(end) - y(start),
            hinge(end) - hinge(start),
            te(end) - hinge(start),
            0.018,
          ],
        ],
        paint,
      );
      for (let x = start + 0.06; x < end; x += 0.17)
        dd.rod(
          [side * (x - start), y(x) - y(start) + 0.013, -0.035],
          [side * (x - start), y(x) - y(start) + 0.008, te(x) - hinge(start) + 0.02],
          0.0022,
          metal,
        );
      dd.finish();
      (kind === 'flap' ? flaps : ailerons).push({
        node: g.name,
        axis: 'x',
        multiplier: kind === 'flap' ? -Math.PI / 6 : -side * 0.4,
      });
    }
    for (let x = 1.15; x < 7.7; x += 0.45) {
      const h = 0.17 - (x - 0.86) * 0.011;
      for (let u = 0.12; u < 0.9; u += 0.13) {
        const upper =
          u < 0.25
            ? (h * u) / 0.25
            : u < 0.75
              ? h * (1 - (u - 0.25) * 0.96)
              : (h * 0.52 * (1 - u)) / 0.25;
        d.add(new T.SphereGeometry(0.0028, 4, 2), metal, [
          side * x,
          y(x) + upper + 0.003,
          le(x) - u * (le(x) - hinge(x)),
        ]);
      }
    }
    const a = new T.Vector3(side * 0.85, 1.19, 0.64),
      b = new T.Vector3(side * 3.15, y(3.15) - 0.04, 0.69),
      v = b.clone().sub(a);
    const strut = d.box(
      [0.075, v.length(), 0.23],
      a.clone().addScaledVector(v, 0.5).toArray(),
      paint,
    );
    strut.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    for (const z of [0.85, -0.1])
      d.rod([side * 2.2, 2.27, 0.68], [side * 2.2, y(2.2), z], 0.018, metal);
    // A single radome fairing on the right wing; symmetric pitot tubes remain separate.
    if (side < 0) ellipsoid(d, [side * 4.2, y(4.2) + 0.01, le(4.2)], [0.15, 0.12, 0.32], paint, 12);
    d.add(new T.SphereGeometry(0.028, 10, 6), side > 0 ? d.red : d.green, [
      side * 7.91,
      y(7.91),
      0.52,
    ]);
    d.rod(
      [side * 4.73, y(4.73) - 0.05, le(4.73)],
      [side * 4.73, y(4.73) - 0.18, le(4.73) + 0.39],
      0.013,
      metal,
    );
    // Stabilizer, separate elevator and hinge line.
    wing(
      d,
      [
        [side * 0.16, 2.28, -5.98, -6.92, 0.105],
        [side * 3.1242, 2.28, -6.34, -7.02, 0.065],
      ],
      paint,
    );
    const eg = group(root, `Caravan-elevator-${side}`, [side * 0.16, 2.28, -6.92]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.43, 0.021],
        [side * 2.9642, 0, -0.1, -0.36, 0.018],
      ],
      paint,
    );
    ed.finish();
    bindings.push({ node: eg.name, source: 'elevator', property: 'rotation', axis: 'x', scale: 1 });
    for (let x = 0.32; x < 3.05; x += 0.25)
      d.rod([side * x, 2.3, -6.99], [side * x, 2.3, -7.23], 0.002, metal);
  }
  const fin = [
    [-3.75, 2.65],
    [-5.96, 3.03],
    [-6.9, 4.58],
    [-7.36, 4.55],
    [-7.14, 2.18],
  ];
  // Fin and rudder are tapered sections (12 % of the combined chord, at most 0.17 m thick over
  // the dorsal fillet), not constant-thickness slabs.
  const rudderOutline = [
      [0, 0],
      [-0.21, 2.33],
      [-0.47, 2.31],
      [-0.43, 0.02],
    ],
    span = (outline, y) => {
      const [front, back] = chordAt(outline, y);
      return front - back;
    },
    finHalf = (y) =>
      Math.min(0.085, Math.max(0.014, 0.06 * (span(fin, y) + span(rudderOutline, y - 2.22))));
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
  const rud = group(root, 'Caravan-rudder', [0, 2.22, -7.15]),
    rd = detailKit(rud, rud.name);
  foil(
    rd,
    outlineRibs(rudderOutline).map(([y, f, b]) => {
      const h = finHalf(y + 2.22);
      return [y, f, b, h * 0.5, h * 0.55, 0.003];
    }),
    blue,
  );
  rd.finish();
  bindings.push({
    node: rud.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.4,
  });
  d.add(new T.SphereGeometry(0.035, 10, 6), d.red, [0, 4.6, -6.92]);
  for (const [z, y] of [
    [0.55, 2.78],
    [-3.65, 2.64],
  ])
    d.rod([0, y, z], [0, y + 0.28, z - 0.22], 0.01, metal);
  // Belly cargo pod, fitted to most 208Bs in service (Lacoste three-view, PRF PR-FYC and FAH 889
  // side photos): a blunt rounded nose behind the nose leg, a flat floor 0.58 m up to 1.5 m
  // behind the main axle, a long curved ramp up to the tail cone and four side doors. The top
  // edge is buried in the fuselage floor.
  const keel = (z) => {
    const i = Math.max(
        1,
        stations.findIndex(([sz]) => sz <= z),
      ),
      [za, , ba] = stations[i - 1],
      [zb, , bb] = stations[i];
    return ba + ((bb - ba) * (z - za)) / (zb - za);
  };
  const podStations = [
    [3.0, 0.3, 0.9],
    [2.95, 0.44, 0.72],
    [2.86, 0.53, 0.625],
    [2.72, 0.58, 0.588],
    [2.52, 0.6, 0.58],
    [-1.5, 0.6, 0.58],
    [-1.75, 0.595, 0.605],
    [-2.0, 0.58, 0.65],
    [-2.25, 0.56, 0.71],
    [-2.5, 0.53, 0.79],
    [-2.73, 0.49, 0.875],
    [-2.95, 0.44, 0.96],
    [-3.1, 0.39, 1.025],
    [-3.25, 0.33, 1.08],
    [-3.37, 0.26, 1.125],
    [-3.48, 0.18, 1.16],
  ];
  const pod = podStations.map(([z, w, y0]) => {
    const y1 = keel(z) + 0.04,
      r = Math.min(0.15, w * 0.4, (y1 - y0) * 0.45),
      right = [
        [w, y1],
        [w, (y1 + y0 + r) / 2],
        [w, y0 + r],
        [w - r + r * Math.cos(Math.PI / 6), y0 + r - r * Math.sin(Math.PI / 6)],
        [w - r + r * Math.cos(Math.PI / 3), y0 + r - r * Math.sin(Math.PI / 3)],
        [w - r, y0],
        [w * 0.45, y0 - 0.008],
      ];
    return {
      z,
      points: [[0, y1], ...right, [0, y0 - 0.012], ...right.reverse().map(([x, y]) => [-x, y])],
    };
  });
  loft(d, pod, paint);
  // Pod half width and floor height along its length.
  const podAt = (z, k) => {
    const i = Math.max(
        1,
        podStations.findIndex(([sz]) => sz <= z),
      ),
      a = podStations[i - 1],
      b = podStations[i];
    return a[k] + ((b[k] - a[k]) * (z - a[0])) / (b[0] - a[0]);
  };
  for (const side of [-1, 1])
    for (const [front, back] of [
      [2.45, 1.71],
      [1.45, 0.71],
      [-0.3, -1.04],
      [-1.26, -2.04],
    ])
      outline(
        d,
        [
          [front, 1.06],
          [back, 1.06],
          [back, Math.max(0.68, podAt(back, 2) + 0.1)],
          [front, Math.max(0.68, podAt(front, 2) + 0.1)],
        ].map(([z, y]) => [side * (podAt(z, 1) + 0.003), y, z]),
        0.004,
        dark,
      );
  // EX single right-side exhaust: hollow angled outlet, not a black box.
  const exhaust = group(root, 'Caravan-exhaust', [-0.49, 1.4, 3.64]);
  exhaust.rotation.z = -0.52;
  const xd = detailKit(exhaust, exhaust.name);
  xd.add(new T.CylinderGeometry(0.12, 0.14, 0.46, 18, 1, true), metal, [0, -0.1, 0]);
  xd.add(new T.CircleGeometry(0.116, 18).rotateX(Math.PI / 2), dark, [0, -0.321, 0]);
  xd.finish();
  // Elliptical lower intake with a rolled lip and screen bars, under the spinner (it was a flat
  // dark box).
  d.add(new T.CircleGeometry(1, 24).scale(0.16, 0.048, 1), dark, [0, 1.512, 4.668]);
  outline(
    d,
    Array.from({ length: 24 }, (_, i) => [
      Math.cos((i * Math.PI) / 12) * 0.165,
      1.512 + Math.sin((i * Math.PI) / 12) * 0.053,
      4.672,
    ]),
    0.011,
    paint,
  );
  for (let i = 0; i < 5; i++) d.box([0.006, 0.06, 0.012], [-0.08 + i * 0.04, 1.512, 4.672], metal);
  const eng = group(root, 'engine-1', [0, 1.77, 4.68]),
    pg = group(eng, 'Caravan-propeller'),
    pd = detailKit(pg, pg.name);
  pd.add(new T.ConeGeometry(0.24, 0.377, 24).rotateX(Math.PI / 2), metal, [0, 0, 0.1885]);
  for (let n = 0; n < 4; n++) {
    const blade = group(pg, `Caravan-blade-${n}`);
    blade.rotation.z = (n * Math.PI) / 2 + 0.38;
    const bd = detailKit(blade, blade.name),
      pts = [
        [0.15, -0.05, 0.02],
        [0.48, -0.1, 0.01],
        [1.13, -0.055, -0.035],
        [1.2954, 0.015, -0.045],
        [1.27, 0.095, -0.045],
        [0.87, 0.15, -0.01],
        [0.28, 0.1, 0.02],
      ];
    sheet(bd, pts, dark, [0, 0, 1]);
    sheet(
      bd,
      pts.map((p) => [p[0], p[1], p[2] - 0.018]),
      dark,
      [0, 0, -1],
    );
    bd.box([0.07, 0.09, 0.018], [1.21, 0.035, -0.04], paint);
    bd.finish();
  }
  pd.finish();
  for (const [x, z, r] of [
    [0, 4.0513, 0.2794],
    [1.778, 0, 0.36],
    [-1.778, 0, 0.36],
  ]) {
    if (x === 0) {
      d.rod([0, 1.35, z - 0.24], [0, r, z], 0.045, metal);
      d.rod([0, 1.05, z - 0.35], [0, 0.55, z], 0.025, metal);
    } else {
      const a = new T.Vector3(Math.sign(x) * 0.82, 1.2, 0.2),
        b = new T.Vector3(x, r, 0),
        v = b.clone().sub(a);
      const leg = d.box(
        [0.09, v.length(), 0.24],
        a.clone().addScaledVector(v, 0.5).toArray(),
        paint,
      );
      leg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    }
    d.add(new T.CylinderGeometry(r, r, x === 0 ? 0.2 : 0.23, 28).rotateZ(Math.PI / 2), rubber, [
      x,
      r,
      z,
    ]);
    for (const sign of [-1, 1])
      d.add(new T.CircleGeometry(r * 0.53, 20).rotateY((sign * Math.PI) / 2), metal, [
        x + sign * (x === 0 ? 0.102 : 0.117),
        r,
        z,
      ]);
  }
  d.finish();
  const interior = cockpit(root, { paint, metal, dark, rings });
  cleanGeometry(root);
  return {
    root,
    frame: caravanFrame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.77, 4.68] }],
    visual: {
      rotors: [{ node: pg.name, axis: 'z', multiplier: 1, engine: 'engine-1' }],
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
    d = detailKit(cabin, 'Caravan-cabin'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Caravan'),
    { bindings, derived, ink, black } = instruments;
  const face = mat('Caravan-panel', '#828985'),
    seat = mat('Caravan-seats', '#3e484a'),
    propBlue = mat('Caravan-prop-blue', '#3e7bb2'),
    liner = mat('Caravan-liner', '#c4c4b7');
  const P = partPalette({ grip: m.dark, alloy: m.metal });
  const k = 0.29972 / 320,
    px = (u) => (875 - u) * k,
    py = (v) => 2.23 - (v - 215) * k,
    z = 2.45,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [130, 560],
    [135, 330],
    [165, 210],
    [240, 100],
    [340, 64],
    [520, 47],
    [875, 44],
    [1285, 60],
    [1390, 95],
    [1475, 160],
    [1575, 320],
    [1580, 560],
  ];
  const screens = [
      [480, 213],
      [865, 213],
      [1230, 213],
    ],
    sw = 0.211328,
    sh = 0.158496;
  const holes = screens.map(([u, v]) => rect(px(u), py(v), sw, sh));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(827) + Math.cos((i * Math.PI) / 20) * 0.032,
      py(386) + Math.sin((i * Math.PI) / 20) * 0.032,
      z,
    ]),
  );
  // Panel, brow and coaming corners stay inside the windscreen and cowl skin.
  const fit = ([x, y, zz], margin = 0.014) => {
    const limit = skinHalfWidth(m.rings, zz, y) - margin;
    return [Math.abs(x) > limit ? Math.sign(x) * limit : x, y, zz];
  };
  sheet(
    d,
    edge.map((p) => fit(at(...p))),
    face,
    [0, 0, -1],
    holes,
  );
  sheet(
    d,
    edge.map((p) => fit(at(...p, 0.07))),
    m.dark,
    [0, 0, 1],
  );
  const brow = edge.slice(1, -1).map((p) => fit(at(...p, -0.018), 0.035));
  outline(d, brow, 0.018, m.dark, false);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1],
      forward = (x) =>
        fit([
          x,
          2.24 -
            (Math.abs(x) < 0.51
              ? (0.035 * Math.abs(x)) / 0.51
              : 0.035 + (Math.abs(x) - 0.51) * 0.75),
          2.84,
        ]);
    quad(d, a, b, forward(b[0]), forward(a[0]), m.dark, [0, 1, 0]);
    // Padded glareshield hood overhanging the displays toward the crew (cockpit photos: a deep
    // black hood, not a bare rail along the panel top).
    if (a[1] > 2.2 && b[1] > 2.2) {
      const lip = (q) => [q[0], q[1] - 0.012, q[2] - 0.13],
        drop = (q) => [q[0], q[1] - 0.04, q[2] - 0.125];
      quad(d, a, b, lip(b), lip(a), m.dark, [0, 1, 0]);
      quad(d, lip(a), lip(b), drop(b), drop(a), m.dark, [0, 0, -1]);
    }
  }
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
    for (const sign of [-1, 1])
      for (const yy of [-0.072, -0.035, 0.035, 0.072])
        pt.knob(x + sign * 0.13, y + yy, z - 0.018, 0.008);
    for (let i = 0; i < 12; i++)
      d.box([0.01, 0.005, 0.004], [x + 0.098 - i * 0.018, y - 0.088, z - 0.014], m.dark);
    for (const sign of [-1, 1])
      for (const yy of [-0.089, 0.089]) pt.knob(x + sign * 0.143, y + yy, z - 0.013, 0.0026);
  }
  const sources = {
    trueAirspeed: { component: 'aircraftState', path: ['airspeed'] },
    altitude: { component: 'transform', path: ['pos', 1] },
    roll: { component: 'aircraftState', path: ['roll'] },
    pitch: { component: 'aircraftState', path: ['pitch'] },
    yaw: { component: 'aircraftState', path: ['yaw'] },
    propNormalized: { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] },
    verticalSpeed: { component: 'aircraftState', path: ['verticalSpeed'] },
    elevator: { component: 'aircraftState', path: ['elevator'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
    pitchInput: { component: 'aircraftInput', path: ['pitch'] },
    rollInput: { component: 'aircraftInput', path: ['roll'] },
    yawInput: { component: 'aircraftInput', path: ['yaw'] },
    power: { component: 'aircraftInput', path: ['power'] },
  };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    propRpm: { op: 'multiply', args: ['propNormalized', 1900] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
  });
  // Duplicate displays share sensor expressions; they do not invent independent AHRS systems.
  // Each PFD is built, not cloned: a clone loses the batched lettering, and its outline text
  // cost 11,000 triangles more than the pilot's display.
  const buildPfd = (position) => {
    const pfd = group(cabin, 'Caravan-PFD', position),
      pd = detailKit(pfd, 'Caravan-PFD-face'),
      pi = instrumentGeometry(pfd, 'Caravan-PFD');
    trimMask(pi.horizon('horizon', [0, 0.022, 0.014], 0.13, 0.085), py(44) - py(213) - 0.012);
    sheet(
      pd,
      rect(0, 0, sw, sh, 0.008),
      black,
      [0, 0, -1],
      [rect(0, 0.022, 0.13, 0.085, 0.008), rect(0.084, 0.022, 0.03, 0.071, 0.008)],
    );
    const tape = group(pfd, 'Caravan-PFD-speed-tape', [0.084, 0.022, 0.009]);
    pi.bindings.push({
      node: tape.name,
      source: 'knots',
      property: 'position',
      axis: 'y',
      scale: -0.001,
    });
    for (let value = 20; value <= 220; value += 10) {
      const row = group(tape, `Caravan-PFD-speed-tape-${value}`, [0, value * 0.001, 0]),
        rd = detailKit(row, row.name);
      rd.text(String(value), [0.002, 0, 0], 0.0045, Math.PI, pi.ink);
      rd.rod([-0.009, 0, 0], [-0.014, 0, 0], 0.0004, pi.ink);
      rd.finish();
      const distance = `Caravan.tape.${value}.distance`,
        absolute = `Caravan.tape.${value}.absolute`,
        show = `Caravan.tape.${value}.show`;
      pi.derived[distance] = { op: 'subtract', args: ['knots', value] };
      pi.derived[absolute] = { op: 'abs', args: [distance] };
      pi.derived[show] = { op: 'less', args: [absolute, 34] };
      pi.bindings.push({
        node: row.name,
        source: show,
        property: 'visible',
        scale: 1,
        missing: 'hide',
      });
    }
    pd.box([0.03, 0.014, 0.002], [0.084, 0.022, 0.005], black);
    pi.readout('speed', [0.084, 0.022, 0.004], 'knots', 3, 0.01, pi.ink, false, true);
    pi.readout('altitude', [-0.081, 0.022, 0.004], 'feet', 5, 0.0075, pi.ink, true, true);
    pd.text('TAS', [0.083, 0.064, 0.003], 0.005, Math.PI, pi.ink, 'display');
    pd.text('GEO FT', [-0.081, 0.05, 0.003], 0.005, Math.PI, pi.ink, 'display');
    const rose = group(pfd, 'Caravan-PFD-rose', [0, -0.045, 0.003]),
      rr = detailKit(rose, rose.name);
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
      rr.rod(p(deg % 30 ? 0.021 : 0.019), p(0.025), 0.0005, pi.ink);
      if (deg % 30 === 0)
        rr.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(0.015),
          0.004,
          Math.PI,
          pi.ink,
        );
    }
    rr.finish();
    pi.bindings.push({
      node: rose.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: Math.PI * 2,
      responseSeconds: 0.15,
    });
    pi.available('heading', 'trueHeading', rose.name);
    pd.rod([0, -0.017, 0.002], [0, -0.025, 0.002], 0.0008, pi.amber);
    pd.text('TRUE', [0, -0.01, 0.002], 0.004, Math.PI, pi.ink, 'display');
    pd.text('NAV -- COM --', [0, 0.071, 0.003], 0.005, Math.PI, pi.ink, 'display');
    const vg = group(pfd, 'Caravan-PFD-vsi', [-0.101, 0.022, 0.003]),
      vd = detailKit(vg, vg.name);
    vd.rod([-0.002, 0, 0], [0.002, 0.002, 0], 0.0008, pi.ink);
    vd.finish();
    pi.bindings.push({
      node: vg.name,
      source: 'verticalFpm',
      property: 'position',
      axis: 'y',
      scale: 0.00001,
      min: -0.03,
      max: 0.03,
      responseSeconds: 0.6,
    });
    pi.available('vsi', 'verticalFpm', vg.name);
    for (const value of [-3000, -2000, -1000, 0, 1000, 2000, 3000])
      pd.rod(
        [-0.1, 0.022 + value * 0.00001, 0.003],
        [-0.097, 0.022 + value * 0.00001, 0.003],
        0.0004,
        pi.ink,
      );
    pd.finish();
    return { pfd, pi };
  };
  const { pfd, pi } = buildPfd(at(480, 213));
  bindings.push(...pi.bindings);
  Object.assign(derived, pi.derived);
  const { pfd: copilot } = buildPfd(at(1230, 213));
  // Share the pilot display's materials, as the clone did, and suffix every node name.
  const shared = new Map();
  pfd.traverse((node) => {
    if (node.isMesh) shared.set(node.material.name, node.material);
  });
  copilot.traverse((node) => {
    node.name = `${node.name}-copilot`;
    if (node.isMesh && shared.has(node.material.name))
      node.material = shared.get(node.material.name);
  });
  bindings.push(...pi.bindings.map((b) => ({ ...b, node: `${b.node}-copilot` })));
  const mx = px(865),
    my = py(213);
  sheet(d, rect(mx, my, sw, sh, z + 0.004), black, [0, 0, -1]);
  instruments.dial(
    'prop-rpm',
    [mx + 0.075, my + 0.043, z],
    0.025,
    'propRpm',
    [
      [0, -2.35],
      [2000, 2.35],
    ],
    [0, 1000, 2000],
    'PROP RPM',
    { responseSeconds: 0.1 },
  );
  instruments.readout(
    'rpm-number',
    [mx + 0.072, my + 0.005, z - 0.015],
    'propRpm',
    4,
    0.006,
    ink,
    false,
    true,
  );
  for (const [label, yy] of [
    ['TRQ --', -0.014],
    ['ITT --', -0.03],
    ['NG --', -0.046],
    ['OIL --', -0.063],
  ])
    d.text(label, [mx + 0.073, my + yy, z + 0.002], 0.0045, Math.PI, ink);
  d.rod([mx + 0.04, my - 0.073, z], [mx + 0.04, my + 0.074, z], 0.0006, ink);
  d.text('MAP DATA', [mx - 0.026, my + 0.01, z], 0.008, Math.PI, ink, 'display');
  d.text('UNAVAILABLE', [mx - 0.026, my - 0.005, z], 0.006, Math.PI, ink, 'display');
  // Three mechanical standby instruments and a wet torque gauge below the center MFD.
  instruments.dial(
    'standby-speed',
    at(735, 386, -0.008),
    0.037,
    'knots',
    [
      [0, 0],
      [40, 0.52],
      [60, 1.05],
      [80, 1.65],
      [100, 2.2],
      [120, 2.9],
      [140, 3.65],
      [160, 4.35],
      [180, 4.9],
      [200, 5.4],
    ],
    [40, 60, 80, 100, 120, 140, 160, 180, 200],
    'TAS',
    { responseSeconds: 0.2 },
  );
  instruments.horizon('standby-attitude', at(827, 386, 0.012), 0.061, 0.061, { round: true });
  d.ring(0.035, 0.002, at(827, 386, -0.006), m.metal);
  instruments.altimeter('standby-altimeter', at(920, 386, -0.008), 0.038, 'feet');
  pt.gauge(px(1004), py(386), z - 0.008, 0.027, undefined, false);
  d.text('TRQ --', at(1004, 386, -0.032), 0.005, Math.PI, ink);
  // Dual audio columns, upper AFCS, left electrical controls and lower lighting strip.
  for (const u of [672, 1044]) {
    d.box([0.033, 0.1956, 0.012], at(u, 213, -0.01), black);
    for (let i = 0; i < 11; i++)
      for (const sign of [-1, 1])
        d.box([0.009, 0.005, 0.004], at(u + sign * 9, 130 + i * 12, -0.02), m.dark);
    pt.knob(px(u), py(290), z - 0.023, 0.007);
  }
  d.box([0.255, 0.043, 0.018], at(865, 80, -0.012), black);
  for (let i = 0; i < 7; i++) {
    pt.knob(px(755 + i * 35), py(89), z - 0.028, 0.006);
    d.text(
      ['HDG', 'CRS', 'NAV', 'ALT', 'VS', 'AP', 'FD'][i],
      at(755 + i * 35, 70, -0.03),
      0.004,
      Math.PI,
      ink,
    );
  }
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const u = 200 + col * 38,
        v = 165 + row * 44;
      pt.knob(px(u), py(v), z - 0.026, 0.006);
      d.rod(at(u, v, -0.027), at(u, v - 9, -0.038), 0.0024, m.metal);
    }
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 8; col++)
      pt.knob(px(290 + col * 35), py(420 + row * 50), z - 0.026, 0.006);
  for (let i = 0; i < 15; i++) pt.knob(px(610 + i * 35), py(543), z - 0.025, i < 7 ? 0.009 : 0.006);
  d.text('GRAND CARAVAN EX', at(1310, 495, -0.02), 0.011, Math.PI, m.dark);
  // Starter/engine master rocker and parking-brake T-handle on the lower left panel, both
  // outboard of and above the pilot's yoke sightline.
  const starter = group(cabin, 'Caravan-starter', at(255, 335, -0.006)),
    starterKit = detailKit(starter, starter.name);
  switchGeometry(starterKit, { style: 'toggle', palette: P, scale: 1.25 });
  d.box([0.03, 0.044, 0.004], at(255, 333, -0.004), black);
  d.text('STARTER', at(255, 312, -0.007), 0.0045, Math.PI, ink);
  starter.userData.aircraftControl = {
    action: 'engine',
    motion: { property: 'rotation', axis: 'x', scale: -0.5 },
  };
  starterKit.finish();
  const parkingBrake = group(cabin, 'Caravan-parking-brake', at(150, 500, -0.003)),
    bd = detailKit(parkingBrake, parkingBrake.name);
  parkingBrakeGeometry(bd, { style: 'tee', palette: { ...P, red: black }, scale: 1.2 });
  parkingBrake.userData.aircraftControl = {
    action: 'brake',
    motion: { property: 'position', axis: 'z', scale: -0.022 },
  };
  bd.finish();
  d.text('PARK BRAKE', at(150, 470, -0.012), 0.005, Math.PI, ink);
  for (const u of [210, 1510]) {
    d.box([0.075, 0.04, 0.008], at(u, 386, -0.006), black);
    d.text('INOP', at(u, 386, -0.011), 0.008, Math.PI, ink);
  }
  // Central pedestal carries power, propeller, condition and flap controls; only available inputs move.
  const ped = group(cabin, 'Caravan-pedestal', [0, 1.78, 2.17]);
  ped.rotation.x = 0.65;
  const td = detailKit(ped, ped.name);
  // The quadrant and trim housing are dark grey, not the panel paint (FedEx Caravan photo).
  const pedFace = mat('Caravan-pedestal', '#3d4446');
  beveledBox(td, [0.28, 0.44, 0.09], [0, 0, 0], pedFace);
  // Power lever with its broad grip and reverse latch, the ribbed blue propeller knob, the fuel
  // condition lever's banded red knob and the flap selector's wing-shaped knob (EX pedestal).
  for (const [x, label, source] of [
    [0.085, 'power', 'power'],
    [0.015, 'prop', undefined],
    [-0.055, 'condition', undefined],
    [-0.11, 'flap', 'flapPosition'],
  ]) {
    td.box([0.013, 0.22, 0.007], [x, 0.06, -0.05], black);
    const g = group(ped, `Caravan-lever-${label}`, [x, 0, -0.06]),
      // The library levers stand on +Y; the arm turns them out of the sloped face.
      arm = group(g, `${g.name}-arm`);
    arm.rotation.x = -0.96;
    const dd = detailKit(arm, g.name);
    if (label === 'flap')
      flapSelectorGeometry(dd, { style: 'lever', height: 0.1, scale: 0.72, palette: P });
    else
      leverGeometry(dd, {
        style: { power: 'power-turboprop', prop: 'prop', condition: 'condition' }[label],
        height: 0.115,
        palette: { ...P, blue: propBlue, grip: label === 'condition' ? td.red : P.grip },
      });
    dd.finish();
    if (source)
      bindings.push({
        node: g.name,
        source,
        property: 'rotation',
        axis: 'x',
        scale: label === 'flap' ? -0.6 : 0.7,
      });
  }
  td.text('PWR PROP COND FLAP', [0, 0.19, -0.05], 0.009, Math.PI, ink);
  td.add(
    new T.CylinderGeometry(0.027, 0.027, 0.025, 12).rotateX(Math.PI / 2),
    black,
    [-0.09, -0.15, -0.067],
  );
  td.text('FRICTION', [-0.09, -0.19, -0.051], 0.007, Math.PI, ink);
  // The big elevator trim wheel on the lower left of the pedestal: a ribbed black drum turning on
  // a lateral axle, its front half standing out of a dark slot plate and its back half sunk in
  // the pedestal.
  const trim = [0.092, -0.13, -0.045],
    trimR = 0.09;
  td.add(new T.CylinderGeometry(trimR, trimR, 0.046, 40).rotateZ(Math.PI / 2), black, trim);
  for (let i = 0; i < 30; i++) {
    const a = (i * Math.PI * 2) / 30;
    // Ribs on the sunk half would never show.
    if (Math.sin(a) > 0.2) continue;
    td.add(new T.BoxGeometry(0.04, 0.005, 0.005).rotateX(a), black, [
      trim[0],
      trim[1] + Math.cos(a) * trimR,
      trim[2] + Math.sin(a) * trimR,
    ]);
  }
  // Its takeoff index across the rim, facing the pilot at neutral.
  td.box([0.047, 0.004, 0.003], [trim[0], trim[1], trim[2] - trimR - 0.001], ink);
  td.box([0.074, 0.19, 0.004], [trim[0], -0.128, -0.047], m.dark);
  for (const [label, y] of [
    ['NOSE DN', -0.07],
    ['ELEV TRIM', -0.13],
    ['NOSE UP', -0.19],
  ])
    td.text(label, [0.035, y, -0.0465], label === 'ELEV TRIM' ? 0.006 : 0.005, Math.PI, ink);
  td.finish();
  for (const u of [480, 1230]) {
    const x = px(u),
      g = group(cabin, `Caravan-yoke-${u}`, [x, 2.11, 2.2]),
      dd = detailKit(g, g.name);
    caravanYoke(dd, { ...P, red: dd.red }, -0.23);
    // The rubber boot where the control tube leaves the panel.
    d.add(
      place(
        lathe(
          [
            [0.036, 0],
            [0.031, 0.007],
            [0.033, 0.013],
            [0.026, 0.021],
            [0.028, 0.027],
            [0.02, 0.035],
            [0.017, 0.04],
          ],
          16,
        ),
        [x, 2.102, z - 0.002],
        [-Math.PI / 2, 0, 0],
      ),
      P.tread,
    );
    dd.text('CESSNA', [0, 0.012, -0.2545], 0.0065, Math.PI, m.dark);
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.05 },
    );
  }
  // Firewall kick panel behind the pedals: the footwell showed the bare inside of the cowl skin.
  const firewall = [1.32, 1.45, 1.6, 1.75, 1.93].map((y) => [
    skinHalfWidth(m.rings, 2.66, y) - 0.015,
    y,
  ]);
  sheet(
    d,
    [
      ...firewall.map(([x, y]) => [x, y, 2.66]),
      ...firewall.toReversed().map(([x, y]) => [-x, y, 2.66]),
    ],
    face,
    [0, 0, -1],
  );
  // Cabin floor trimmed to the skin: the flat 1.6 m slab stood out of the cowl and tail cone.
  fittedFloor(d, m.rings, m.dark, { y: 1.32, front: 2.675, back: -3.675, width: 1.6 });
  // Line the crew station so no painted skin shows from the seats.
  caravanLiner(d, m.rings, mat('Caravan-sidewall', '#a3a7a2'), m.dark, 1.32);
  for (const zz of [1.5, 0.3, -0.65, -1.6, -2.55, -3.5])
    for (const x of [-0.44, 0.44]) {
      // Pilot seats ride high on their rails: eye 0.8 m above the cushion, thighs under the yoke.
      const lift = zz === 1.5 ? 0.05 : 0;
      beveledBox(d, [0.49, 0.11, 0.48], [x, 1.58 + lift, zz], seat, 0.035);
      const back = group(cabin, `Caravan-seat-${x}-${zz}`, [x, 1.94 + lift, zz - 0.2]);
      back.rotation.x = -0.08;
      const sd = detailKit(back, back.name);
      beveledBox(sd, [0.47, 0.6, 0.16], [0, 0, 0], seat, 0.05);
      // Separate back pocket, piping and headrest posts remain readable from the next row.
      beveledBox(sd, [0.39, 0.23, 0.015], [0, -0.13, -0.09], m.dark, 0.004);
      sd.rod([-0.18, -0.01, -0.103], [0.18, -0.01, -0.103], 0.003, liner);
      for (const dx of [-0.1, 0.1]) sd.rod([dx, 0.27, 0], [dx, 0.38, 0], 0.009, m.metal);
      beveledBox(sd, [0.37, 0.18, 0.15], [0, 0.41, 0], seat, 0.047);
      sd.finish();
      for (const sign of [-1, 1])
        d.rod([x + sign * 0.19, 1.33, zz], [x + sign * 0.19, 1.52 + lift, zz], 0.016, m.metal);
      d.rod([x - 0.19, 1.65 + lift, zz - 0.12], [x + 0.16, 1.65 + lift, zz + 0.18], 0.018, liner);
      d.box([0.055, 0.015, 0.045], [x + 0.04, 1.67 + lift, zz + 0.09], m.metal);
    }
  for (const sign of [-1, 1]) {
    // Sidewall liner follows the skin as the cabin narrows aft (a straight panel cut through
    // the tail cone from outside).
    const wall = [];
    for (let zz = 1.505; zz > -3.75; zz -= 0.25) wall.push(Math.max(zz, -3.745));
    const inside = (zz) =>
      Math.min(
        0.82,
        skinHalfWidth(m.rings, zz, 1.425) - 0.025,
        skinHalfWidth(m.rings, zz, 1.675) - 0.025,
      );
    for (let i = 0; i < wall.length - 1; i++) {
      const a = wall[i],
        b = wall[i + 1],
        xa = sign * inside(a),
        xb = sign * inside(b);
      quad(d, [xa, 1.425, a], [xb, 1.425, b], [xb, 1.675, b], [xa, 1.675, a], liner, [-sign, 0, 0]);
      quad(
        d,
        [xa, 1.675, a],
        [xb, 1.675, b],
        [xb + sign * 0.012, 1.675, b],
        [xa + sign * 0.012, 1.675, a],
        liner,
        [0, 1, 0],
      );
    }
    d.rod([sign * 0.74, 1.8, 1.85], [sign * 0.74, 1.8, 1.25], 0.024, m.dark);
    // Rudder pedals with toe brakes for both seats. Right rudder pushes the right pedal (-X)
    // of each pair forward.
    for (const off of [-0.1, 0.1]) {
      const pedal = group(cabin, `Caravan-pedal-${sign}-${off < 0 ? 'a' : 'b'}`, [
          sign * 0.4 + off,
          1.455,
          2.43,
        ]),
        pk = detailKit(pedal, pedal.name);
      caravanPedal(pk, P, Math.sign(off));
      pk.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: off < 0 ? 0.035 : -0.035,
      });
    }
    for (let z = -3.3; z < 1.4; z += 0.95) {
      // Passenger vents and lights hang under the headliner, never through the roof.
      const ceiling = Math.min(2.67 + Math.max(0, z) * 0.1, skinRoof(m.rings, z, 0.63) - 0.035);
      d.box([0.14, 0.025, 0.23], [sign * 0.56, ceiling, z], liner);
      d.add(new T.CylinderGeometry(0.032, 0.032, 0.018, 12), m.dark, [
        sign * 0.56,
        ceiling - 0.02,
        z,
      ]);
    }
  }
  // Pilot-side electrical cabinet and the photographed overhead fuel-selector console.
  const electrical = group(cabin, 'Caravan-electrical', [0.64, 1.76, 2.08]);
  electrical.rotation.y = -0.35;
  const ed = detailKit(electrical, electrical.name);
  beveledBox(ed, [0.19, 0.5, 0.11], [0, 0, 0], face);
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 5; col++)
      ed.add(new T.CylinderGeometry(0.006, 0.006, 0.012, 8).rotateX(Math.PI / 2), black, [
        -0.065 + col * 0.032,
        0.19 - row * 0.061,
        -0.06,
      ]);
  ed.finish();
  const overhead = group(cabin, 'Caravan-overhead', [0, 2.675, 1.52]);
  const od = detailKit(overhead, overhead.name);
  beveledBox(od, [0.47, 0.055, 0.35], [0, 0, 0], liner);
  for (const side of [-1, 1]) {
    od.add(new T.CylinderGeometry(0.04, 0.04, 0.02, 12), m.metal, [side * 0.13, -0.037, 0.07]);
    od.add(new T.CylinderGeometry(0.027, 0.027, 0.025, 12), black, [side * 0.13, -0.039, 0.07]);
    od.box([0.05, 0.025, 0.065], [side * 0.1, -0.045, -0.09], black);
    od.rod([side * 0.1, -0.045, -0.09], [side * 0.1, -0.068, -0.04], 0.009, m.metal);
    // Sun visors stowed flat on the ceiling behind the header; deployed they fill the seat view.
    const visor = group(cabin, `Caravan-visor-${side}`, [side * 0.4, 2.662, 1.58]);
    visor.rotation.x = Math.PI / 2;
    const vd = detailKit(visor, visor.name);
    vd.box([0.36, 0.13, 0.012], [0, 0, 0], m.dark);
    vd.finish();
  }
  od.finish();
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
