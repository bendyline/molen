/** UH-1H: TM 55-1520-210-10 figs 2-2, 2-4, 2-5 and cited photographs.
 * Rotor mast is z=0. The nose is 11 ft 8.65 in forward, independently of rotor envelope.
 * Construction landmarks are meters; window apertures and panels are individually authored.
 */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  bar,
  contour,
  lathe,
  loftUp,
  partPalette,
  pedalGeometry,
  place,
  roundedBox,
  tube,
} from './cockpit-parts.mjs';
import {
  cleanGeometry,
  detailKit,
  ellipsoid,
  glazing,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';

const HUEY_CABIN_WIDEN = 1.14;
export function hueyFrame() {
  return {
    heli: true,
    fighter: false,
    large: false,
    radius: 1.05,
    cy: 1.24,
    ry: 1.08,
    cabinZ: 2.05,
    cabinWidth: 1.98,
    eye: [-0.47, 1.9, 1.65],
    panelZ: 2.66,
    floor: 0.48,
    mainRotorPosition: [0, 3.98, 0],
  };
}
export function buildHuey(s) {
  const root = new T.Group();
  root.name = s.slug;
  const f = hueyFrame();
  let d = detailKit(root, 'huey-airframe');
  const paint = mat('huey-olive-drab', '#59634a', { side: T.DoubleSide }),
    seam = mat('huey-joints', '#323a2e'),
    metal = mat('huey-machined-metal', '#858b85', { metalness: 0.7, roughness: 0.42 }),
    rubber = mat('huey-rubber', '#202623'),
    glass = mat('huey-glazing', '#9bb9bb', {
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      roughness: 0.16,
      side: T.DoubleSide,
    }),
    // The chin windows are tinted and reflective from outside; clear glass over the dark
    // footwell read as an open mouth under the nose.
    chinGlass = mat('huey-chin-glazing', '#3c5250', {
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      roughness: 0.1,
      metalness: 0.2,
      side: T.DoubleSide,
    }),
    roofGlass = mat('huey-green-skylights', '#355b3c', {
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      side: T.DoubleSide,
    });
  const fasteners = (points, spacing = 0.13) => {
    for (let i = 0; i < points.length; i++) {
      const a = new T.Vector3(...points[i]),
        b = new T.Vector3(...points[(i + 1) % points.length]),
        n = Math.max(1, Math.floor(a.distanceTo(b) / spacing));
      for (let j = 1; j < n; j++)
        d.add(
          new T.SphereGeometry(0.0045, 6, 3),
          metal,
          a
            .clone()
            .lerp(b, j / n)
            .toArray(),
        );
    }
  };
  // Main cabin: flat door sides between rounded roof and belly corners (JGSDF front and
  // Evergreen rear photos), no generic elliptical pod. The aft rings close round into the boom.
  // Seven points to each rounded corner (15 degree steps): with four, the roof and belly
  // corners showed as flat bands and polygonal edges in flight (owner report 11-26).
  const CORNER = 7;
  const cabinRing = (w, bottom, top, side = 1.06, rx = w * 0.2, rt = 0.25) => {
    const corner = (cx, cy, ax, ay, from) =>
      Array.from({ length: CORNER }, (_, k) => {
        const c = Math.cos(from - (k * Math.PI) / (2 * (CORNER - 1))),
          s = Math.sin(from - (k * Math.PI) / (2 * (CORNER - 1)));
        return [
          cx + ax * Math.sign(c) * Math.pow(Math.abs(c), 0.8),
          cy + ay * Math.sign(s) * Math.pow(Math.abs(s), 0.8),
        ];
      });
    const half = [
      ...corner(w - rx, top - rt, rx, rt - 0.025, Math.PI / 2),
      ...corner(w - rx, side, rx, side - bottom, 0),
    ];
    return [[0, top], ...half, [0, bottom], ...half.toReversed().map(([x, y]) => [-x, y])];
  };
  const sections = [
    { z: 1.45, points: cabinRing(1.05, 0.66, 2.68) },
    { z: -0.85, points: cabinRing(1.05, 0.67, 2.68) },
    // Behind the doors the aft fuselage swells round into the belly and roof as it tapers to
    // the boom (Evergreen rear photo), rather than continuing the flat door sides. The belly
    // starts rising at the sliding door's aft edge and sweeps up evenly to the boom (TM fig 2-2),
    // rather than staying down to the last 0.35 m and turning up as a bulb.
    { z: -1.65, points: cabinRing(1.05, 0.74, 2.68) },
    { z: -2.0, points: cabinRing(0.99, 0.82, 2.56, 1.25, 0.34, 0.4) },
    { z: -2.35, points: cabinRing(0.88, 0.99, 2.35, 1.5, 0.48, 0.58) },
    { z: -2.7, points: cabinRing(0.57, 1.2, 2.14, 1.55, 0.3, 0.4) },
  ];
  // The flat sides (between each upper corner's last point and the lower corner's first) are
  // the window walls below.
  loft(d, sections, paint, {
    caps: false,
    skip: (i, j) => i <= 1 && (j === CORNER || j === 3 * CORNER + 1),
  });
  // Cargo compartment aft wall behind the troop seat; the tapering aft fuselage behind it is a
  // closed bay, not a tunnel to the boom root seen from the crew seats.
  sheet(
    d,
    cabinRing(1.05, 0.67, 2.68).map(([x, y]) => [x * 0.995, 1.67 + (y - 1.67) * 0.995, -0.9]),
    paint,
    [0, 0, 1],
  );
  // Aft bulkhead around the boom root (the boom is smaller than the aft fuselage end).
  sheet(
    d,
    sections.at(-1).points.map(([x, y]) => [x, y, -2.7]),
    paint,
    [0, 0, -1],
  );
  // Side sheets have actual holes for two sliding-door windows.
  for (const side of [-1, 1]) {
    const x = side * 1.05;
    const wall = [
      [x, 1.06, 1.45],
      [x, 2.43, 1.45],
      [x, 2.43, -1.65],
      [x, 1.06, -1.65],
    ];
    // Sliding-door windows with rounded corners (JGSDF 41659 side photos). TM fig 2-2 puts the
    // hinged panel right behind the crew door and the sliding door from 1.1 m ahead of the mast
    // to 0.8 m behind it, its two windows straddling the mast, with a long plain flank behind.
    const windows = [0.57, -0.29].map((z) =>
      roundedRegion(z - 0.34, z + 0.34, 1.58, 2.23, 0.08, 0.08, 3).map(([u, y]) => [x, y, u]),
    );
    sheet(d, wall, paint, [side, 0, 0], windows);
    for (const window of windows) {
      glazing(d, window, glass, seam, 0.017, [side, 0, 0]);
      fasteners(window);
    }
    // Hinged panel and sliding door boundaries, top track and handles.
    const onDoor = (y, z) => [x + 0.006 * side, y, z];
    outline(
      d,
      [onDoor(2.49, 1.44), onDoor(2.49, -0.84), onDoor(0.92, -0.84), onDoor(0.92, 1.44)],
      0.007,
      seam,
      false,
    );
    outline(d, [onDoor(2.49, 1.1), onDoor(0.92, 1.1)], 0.007, seam, false);
    // The two access panels on the flank behind the door (fig 2-2).
    for (const [y0, y1] of [
      [1.42, 1.8],
      [1.1, 1.36],
    ])
      outline(
        d,
        [onDoor(y0, -0.98), onDoor(y1, -0.98), onDoor(y1, -1.6), onDoor(y0, -1.6)],
        0.005,
        seam,
      );
    d.rod([x, 2.55, 1.25], [x, 2.55, -1.85], 0.018, paint);
    d.rod([x + 0.025 * side, 1.4, 0.98], [x + 0.025 * side, 1.4, 0.8], 0.015, metal);
    d.rod([x + 0.025 * side, 1.4, -0.71], [x + 0.025 * side, 1.4, -0.53], 0.015, metal);
  }
  // Rounded nose bulb and broad curved chin windows, fitted to the TM side/front views and the
  // JGSDF 41659/41702 and Korean Navy photos: tip about 1.1 m above the ground, windscreen base
  // about 1.6 m on the centre line, chin windows from the keel strip round to the side panels.
  // Rows: height, half-width, forward extent; the skin runs smoothly through them.
  // Below the tip the bulb stays full: in the JGSDF 41659 side photograph and TM fig 2-2 the
  // chin face is still within about 6 cm of the tip 0.4 m lower, then rounds into a broad, nearly
  // flat underside that continues the belly. The old rows fell steadily back from the tip (0.33 m
  // behind it at that depth), leaving a long sloping chin under the upper nose: a duck bill
  // (owner report 11-26).
  const noseRows = [
    [0.7, 0.74, 3.06],
    [0.86, 0.9, 3.33],
    [1.0, 0.97, 3.47],
    [1.16, 1.01, 3.535],
    [1.3, 1.04, 3.566],
    [1.4, 1.05, 3.57251],
    [1.55, 1.02, 3.53],
    [1.7, 0.98, 3.43],
    [1.82, 0.94, 3.29],
    [1.91, 0.91, 3.12],
  ];
  const noseAt = waterlines(noseRows),
    nosePoint = (row, a) => [
      row[1] * Math.sin(a),
      row[0] - Math.max(0, row[0] - 1.4) * 0.9 * Math.sin(a) * Math.sin(a),
      2.88 + (row[2] - 2.88) * Math.cos(a),
    ],
    noseSkin = (t, a) => nosePoint(noseAt(t), a);
  const rowSteps = Array.from({ length: 28 }, (_, i) => (i * (noseRows.length - 1)) / 27),
    angleSteps = Array.from({ length: 25 }, (_, i) => ((i - 12) * Math.PI) / 24);
  // Chin windows: rounded panes either side of the keel strip, wrapping back to the side panels.
  const chin = [-1, 1].map((side) => {
    const poly = roundedRegion(0.75, 4.75, 0.22, 1.5, 0.45, 0.13);
    return side > 0 ? poly : poly.map(([t, a]) => [t, -a]).reverse();
  });
  const skinNormal = skinPatch(
    d,
    noseSkin,
    rowSteps,
    angleSteps,
    paint,
    chin.map((poly) => ({ poly, material: chinGlass })),
    [0, 1.25, 2.6],
  );
  // Footwell lining 3.5 cm inside the nose, facing the cabin and open behind the chin windows:
  // through the clear chin glass the pedals and the dark far side of the footwell show, instead
  // of a dark panel or the lit inside of the far skin.
  skinPatch(
    d,
    (t, a) => {
      const p = noseSkin(t, a),
        n = skinNormal(t, a);
      return p.map((c, k) => c - n[k] * 0.035);
    },
    rowSteps,
    angleSteps,
    seam,
    chin.map((poly) => ({ poly, material: null })),
    [0, 1.25, 2.6],
    true,
  );
  for (const poly of chin)
    outline(
      d,
      poly.map(([t, a]) => {
        const p = noseSkin(t, a),
          n = skinNormal(t, a);
        return p.map((c, k) => c + n[k] * 0.004);
      }),
      // A slim riveted frame, as on the aircraft; the old 16 mm tube read as a lip.
      0.009,
      paint,
    );
  // Behind the bulb the lower cabin keeps the main ring's flat side and rounded belly corner.
  const cabinHalf = (y) => {
    const q = Math.min(1, Math.max(0, (1.06 - y) / 0.4));
    return 0.84 + 0.21 * Math.pow(Math.sqrt(1 - Math.pow(q, 2.5)), 0.8);
  };
  const noseContour = [
    [0, noseRows.at(-1)[0]],
    ...rowSteps.toReversed().map((t) => [noseAt(t)[1], noseSkin(t, Math.PI / 2)[1]]),
    [0, 0.66],
    ...rowSteps.map((t) => [-noseAt(t)[1], noseSkin(t, Math.PI / 2)[1]]),
  ];
  // The side reaches the door plane at the door's front edge (z 2.52). Behind it the flat door
  // sheet is the skin above the belly corner: a second, coplanar layer there flickered against
  // the door and stood 1 mm behind the door window's lower half as an opaque olive panel.
  const cockpitRing = noseContour.map(([x, y]) => [Math.sign(x) * cabinHalf(y), y]),
    // The flat side starts at 1.06 m; the door sheet takes over from the first ring point there.
    sill = Math.min(...cockpitRing.filter(([x, y]) => x > 0 && y >= 1.06).map(([, y]) => y));
  loft(
    d,
    [
      { z: 2.88, points: noseContour },
      { z: 2.52, points: cockpitRing },
      { z: 1.45, points: cockpitRing },
    ],
    paint,
    {
      caps: false,
      skip: (i, j) =>
        j === 0 ||
        j === noseContour.length - 1 ||
        (i === 1 && Math.min(cockpitRing[j][1], cockpitRing[j + 1][1]) >= sill),
    },
  );
  sheet(d, [...angleSteps.map((a) => noseSkin(0, a)), [0, 0.66, 2.88]], paint, [0, -1, 0]);
  const top = noseRows.at(-1),
    // Windscreen header from the centre post (u 0) to the corner pane (u 1).
    screenHeader = (side, u) => [
      side * (0.035 + 0.785 * u),
      2.63 - 0.06 * u * u,
      2.54 - 0.27 * u * u,
    ];
  for (const side of [-1, 1]) {
    // Windscreen and corner pane, individually located rather than cut from an oval shell.
    // The lower edge takes the nose skin's own angle steps, so pane and skin share one edge; a
    // coarser chord stood up to 3 cm clear of the curved skin and opened a slot at the corner.
    const inner = Math.asin(0.035 / top[1]),
      angles = [inner, ...angleSteps.filter((a) => a > inner)],
      lower = [],
      upper = [];
    for (const a of angles) {
      const u = (top[1] * Math.sin(a) - 0.035) / (top[1] - 0.035);
      lower.push(nosePoint(top, side * a));
      upper.push(screenHeader(side, u));
    }
    for (let i = 0; i < angles.length - 1; i++)
      quad(d, lower[i], lower[i + 1], upper[i + 1], upper[i], glass, [side * 0.25, 0.35, 1]);
    const front = [...lower, ...upper.toReversed()];
    outline(d, front, 0.032, paint);
    fasteners(front, 0.09);
    const corner = [
      [side * 0.91, 1.45, 2.88],
      [side * 1.05, 1.55, 2.52],
      [side * 1.02, 2.43, 2.05],
      [side * 0.82, 2.57, 2.27],
    ];
    glazing(d, corner, glass, paint, 0.025, [side, 0.2, 0.3]);
    // Closes the wedge between the nose side's top edge and the corner pane's rising lower edge.
    sheet(
      d,
      [
        [side * noseContour[1][0], noseContour[1][1], 2.88],
        [side * 1.05, 1.55, 2.52],
        [side * cockpitRing[1][0], cockpitRing[1][1], 2.52],
      ],
      paint,
      [side, 0.2, 0.3],
    );
    // The door sheet is the flat side above the sill; the belly corner below it is the loft, and
    // the seam runs on round it to the 0.76 m door bottom.
    const belly = (z) => [0.76, 0.86, 0.96].map((y) => [side * (cabinHalf(y) + 0.004), y, z]),
      door = [
        [side * 1.05, sill, 2.52],
        [side * 1.05, 1.55, 2.52],
        [side * 1.02, 2.43, 2.05],
        [side * 1.05, 2.43, 1.45],
        [side * 1.05, sill, 1.45],
      ],
      doorEdge = [
        ...belly(2.52),
        ...door.slice(0, 4),
        [side * 1.05, sill, 1.45],
        ...belly(1.45).toReversed(),
      ];
    // Flat door uses a slightly inset window; the lower skin stays opaque.
    const win = [
      [side * 1.051, 1.25, 2.4],
      [side * 1.051, 1.55, 2.4],
      [side * 1.031, 2.32, 2.0],
      [side * 1.051, 2.32, 1.57],
      [side * 1.051, 1.25, 1.57],
    ];
    sheet(d, door, paint, [side, 0, 0], [win]);
    glazing(d, win, glass, seam, 0.014, [side, 0, 0]);
    outline(d, doorEdge, 0.012, seam);
    d.rod([side * 1.08, 1.08, 1.72], [side * 1.08, 1.08, 1.92], 0.016, metal);
    // Roof quarter and tinted overhead window. Its front edge is the windscreen's curved header,
    // not the chord between its ends, which left a crescent slot open onto the rotor overhead.
    // Each quarter runs to the centre line: the 7 cm strip between them was open from the
    // header back to the overhead console, and showed the rotor above the centre post.
    const roof = [
      [0, 2.63, 2.54],
      ...upper,
      [side * 1.02, 2.43, 2.05],
      [side * 0.84, 2.655, 1.45],
      [0, 2.68, 1.45],
    ];
    const sky = [
      [side * 0.18, 2.645, 2.36],
      [side * 0.67, 2.62, 2.18],
      [side * 0.76, 2.65, 1.65],
      [side * 0.18, 2.675, 1.65],
    ];
    sheet(d, roof, paint, [0, 1, 0], [sky]);
    glazing(d, sky, roofGlass, paint, 0.025, [0, 1, 0]);
    sheet(
      d,
      [
        [side * 1.02, 2.43, 2.05],
        ...sections[0].points
          .slice(1, CORNER + 1)
          .toReversed()
          .map(([x, y]) => [side * x, y, 1.45]),
      ],
      paint,
      [side, 0.5, 0],
    );
    // Wiper parked along the header on the outside of the pane (front photos): a pivot on the
    // frame, a slim arm and a blade lying level just under the header. The blade used to float
    // 11 cm inside the glass, at twice a blade's thickness, across the pilot's view.
    const pane = (u, f) => {
        const lo = nosePoint(top, side * Math.asin((0.035 + (top[1] - 0.035) * u) / top[1])),
          hi = screenHeader(side, u);
        return lo.map((c, k) => c + (hi[k] - c) * f);
      },
      onGlass = (u, f, lift) => {
        const e = 0.01,
          p = pane(u, f),
          du = new T.Vector3(...pane(u + e, f)).sub(new T.Vector3(...pane(u - e, f))),
          df = new T.Vector3(...pane(u, f + e)).sub(new T.Vector3(...pane(u, f - e))),
          n = du.cross(df).normalize();
        if (n.z < 0) n.negate();
        return p.map((c, k) => c + n.getComponent(k) * lift);
      };
    d.rod(onGlass(0.62, 0.972, 0.004), onGlass(0.62, 0.972, 0.03), 0.014, seam);
    d.rod(onGlass(0.62, 0.968, 0.022), onGlass(0.2, 0.912, 0.014), 0.005, seam);
    d.rod(onGlass(0.1, 0.9, 0.012), onGlass(0.6, 0.9, 0.012), 0.0065, rubber);
  }
  d.rod([0, top[0] - 0.01, top[2]], [0, 2.63, 2.54], 0.033, paint);
  // Engine/transmission cowling above the cabin, with a raised forward fairing and aft exhaust.
  // Authored at final width: the cabin widening below is divided back out of the cowling.
  // Upright sides under a rounded crown (rear and rear 3/4 photos), not a chamfered box.
  const cowl = (z, w0, low, high, w = w0 / HUEY_CABIN_WIDEN) => {
    const shoulder = Math.min(low + 0.15, (low + high) / 2),
      // Nine crown points: the five-point crown fell under the loft's smoothing threshold and
      // rendered as flat chamfers.
      crown = Array.from({ length: 9 }, (_, k) => {
        const a = (k * Math.PI) / 16;
        return [
          w * Math.pow(Math.sin(a), 2 / 2.5),
          shoulder + (high - shoulder) * Math.pow(Math.cos(a), 2 / 2.5),
        ];
      });
    return {
      z,
      points: [
        ...crown,
        [w, low],
        [-w, low],
        ...crown
          .slice(1)
          .reverse()
          .map(([x, y]) => [-x, y]),
      ],
    };
  };
  loft(
    d,
    [
      cowl(0.67, 0.18, 2.67, 2.78),
      cowl(0.23, 0.58, 2.68, 3.08),
      cowl(-0.63, 0.62, 2.67, 3.16),
      cowl(-1.72, 0.53, 2.48, 3.01),
      cowl(-2.15, 0.34, 2.3, 2.82),
    ],
    paint,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 9; i++)
      d.box([0.015, 0.1, 0.026], [(side * 0.604) / HUEY_CABIN_WIDEN, 2.91, -0.5 - i * 0.065], seam);
  d.add(
    new T.CylinderGeometry(0.245, 0.28, 0.42, 24, true)
      .rotateX(Math.PI / 2)
      .scale(1 / HUEY_CABIN_WIDEN, 1, 1),
    metal,
    [0, 2.74, -2.28],
  );
  d.add(
    new T.CircleGeometry(0.237, 24).rotateY(Math.PI).scale(1 / HUEY_CABIN_WIDEN, 1, 1),
    rubber,
    [0, 2.74, -2.5],
  );
  // Cabin datum: ground to roof is approximately 2.39 m in the dimensioned side view.
  // Keep the rotor and tail datums independent; cabin coordinates above use a local origin.
  d.finish();
  // TM fig 2-2 front/plan views: the cabin is nearly as wide as the 8 ft 6.6 in skid gear
  // (about 2.4 m over the doors), so the authored 2.1 m shell is widened about the centre line.
  for (const mesh of d.root.children) if (mesh.isMesh) mesh.geometry.scale(HUEY_CABIN_WIDEN, 1, 1);
  d.root.position.y = -0.29;
  d = detailKit(root, 'huey-running-structure');
  // Tapered tail boom; its section and raised tail-fin junction are structurally distinct.
  // Rounded-square section (Evergreen UH-1H rear photo), smooth rather than an octagon.
  const boom = (z, w, cy, h) => ({
    z,
    points: Array.from({ length: 16 }, (_, i) => {
      const s = Math.sin((i * Math.PI) / 8),
        c = Math.cos((i * Math.PI) / 8);
      return [
        w * Math.sign(s) * Math.pow(Math.abs(s), 0.8),
        cy + h * Math.sign(c) * Math.pow(Math.abs(c), 0.8),
      ];
    }),
  });
  loft(
    d,
    [
      boom(-2.43, 0.58, 1.39, 0.48),
      boom(-4.4, 0.39, 1.55, 0.34),
      boom(-6.6, 0.235, 1.69, 0.235),
      boom(-8.15, 0.14, 1.82, 0.16),
      boom(-8.63, 0.09, 1.93, 0.12),
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    const fin = [
      [side * 0.075, 1.76, -7.79],
      [side * 0.055, 2.03, -8.16],
      [side * 0.045, 3.26, -8.93],
      [side * 0.045, 3.27, -9.05],
      [side * 0.06, 1.91, -8.85],
    ];
    sheet(d, fin, paint, [side, 0, 0]);
    outline(d, fin, 0.023, paint);
    wing(
      d,
      [
        [side * 0.26, 1.72, -5.7, -6.48],
        [side * 1.4262, 1.72, -5.74, -6.46],
      ],
      paint,
      0.045,
    );
  }
  d.rod([0, 1.73, -8.13], [0, 1.54, -8.86], 0.025, seam);
  d.rod([0, 1.54, -8.86], [0, 1.57, -9.05], 0.025, seam);
  // Low skids, bowed cross tubes, and curved forward toes. No triangular strut substitution.
  for (const side of [-1, 1]) {
    outline(
      d,
      [
        [side * 1.23802, 0.38, 2.58],
        [side * 1.23802, 0.21, 2.4],
        [side * 1.23802, 0.07, 2.12],
        [side * 1.23802, 0.07, -1.12],
      ],
      0.065,
      metal,
      false,
    );
    // Cross tubes run under the belly and bow round and down onto the skids (JGSDF front photos).
    for (const z of [1.6, -0.62])
      outline(
        d,
        [
          [side * 0.55, 0.36, z],
          [side * 0.82, 0.355, z],
          [side * 0.99, 0.325, z],
          [side * 1.1, 0.27, z],
          [side * 1.18, 0.195, z],
          [side * 1.225, 0.12, z],
        ],
        0.047,
        metal,
        false,
      );
    d.box([0.16, 0.03, 0.28], [side * 1.14, 0.38, 1.75], seam);
  }
  // Mast, rotating two-blade teetering hub and stabilizer bar.
  d.add(new T.CylinderGeometry(0.085, 0.12, 0.88, 16), metal, [0, 3.26, 0]);
  d.rod([0, 3.65, 0], [0, 3.99, 0], 0.065, metal);
  for (const [radius, y] of [
    [0.25, 2.88],
    [0.21, 2.99],
    [0.15, 3.66],
  ])
    d.ring(radius, 0.028, [0, y, 0], metal, 'y');
  for (const side of [-1, 1])
    d.rod([side * 0.2, 2.97, 0.12], [side * 0.14, 3.76, 0.09], 0.018, metal);
  const rotor = group(root, 'main-rotor', [0, 3.98, 0]),
    rd = detailKit(rotor, 'main-rotor-detail');
  rd.box([0.66, 0.15, 0.2], [0, 0, 0], metal);
  for (const side of [-1, 1]) {
    rd.rod([side * 0.24, 0, 0], [side * 0.98, 0.025, 0], 0.045, metal);
    wing(
      rd,
      [
        [side * 0.77, 0, 0.24, -0.24],
        [side * 1.35, 0.005, 0.28, -0.26],
        [side * 7.27, 0.06, 0.25, -0.23],
        [side * 7.315, 0.06, 0.2, -0.19],
      ],
      rubber,
      0.018,
    );
    rd.box([0.15, 0.012, 0.43], [side * 7.14, 0.073, 0.01], rd.amber);
    rd.rod([0, 0.17, 0], [0, 0.17, side * 1.26], 0.024, metal);
    rd.box([0.16, 0.1, 0.29], [0, 0.17, side * 1.23], metal);
    rd.rod([side * 0.24, 0.06, 0], [0, 0.17, side * 0.55], 0.017, metal);
  }
  rd.finish();
  d.rod([0, 3.13, -8.88], [0.36, 3.13, -8.88], 0.065, metal);
  const tail = group(root, 'tail-rotor', [0.37, 3.13, -8.88]),
    td = detailKit(tail, 'tail-rotor-detail');
  for (const side of [-1, 1]) {
    td.rod([0, 0, 0], [0, side * 0.22, 0], 0.032, metal);
    td.box([0.035, 1.13, 0.16], [0, side * 0.73, 0], rubber);
    td.box([0.04, 0.14, 0.16], [0, side * 1.23, 0], td.red);
  }
  td.finish();
  // Navigation fittings and service joints are deliberately subordinate to the outline.
  d.rod([0.24, 2.39, 1.88], [0.24, 2.6, 2.04], 0.015, metal);
  d.rod([0, 2.82, -1.16], [0, 3.21, -1.46], 0.012, seam);
  for (const side of [-1, 1])
    ellipsoid(
      d,
      [side * 1.075 * HUEY_CABIN_WIDEN, 1.46, 1.27],
      [0.035, 0.048, 0.075],
      side < 0 ? d.green : d.red,
      12,
    );
  for (const z of [-3.1, -4.8, -6.55]) {
    const section =
      z === -3.1
        ? boom(z, 0.51, 1.44, 0.43)
        : z === -4.8
          ? boom(z, 0.36, 1.58, 0.31)
          : boom(z, 0.24, 1.69, 0.24);
    outline(
      d,
      section.points.map((p) => [...p, z]),
      0.003,
      seam,
    );
  }
  d.finish();
  const { stations: controlStations, ...interior } = addHueyCockpit(root, paint);
  cleanGeometry(root);
  return {
    root,
    frame: { ...f, controlStations },
    enginePoints: [],
    visual: {
      rotors: [
        { node: 'main-rotor', axis: 'y', multiplier: 1 },
        { node: 'tail-rotor', axis: 'x', multiplier: 5 },
      ],
      gearNodes: [],
      flaps: [],
      ailerons: [],
      animation: { bindings: [] },
      interior,
    },
  };
}

function addHueyCockpit(root, paint) {
  const cabin = group(root, 'cockpit', [0, -0.29, 0]),
    d = detailKit(cabin, 'huey-cockpit'),
    parts = partPalette();
  // Line the olive-drab skin inside the cockpit (doors, posts below the roof, the roof between the
  // eyebrow windows) in lusterless interior black-green, as Army cockpits are finished; the nose
  // footwell already has its own lining. Model-frame coordinates (the cabin group sits 0.29 m low).
  {
    const lining = mat('huey-cockpit-lining', '#30362e', { roughness: 0.95 }),
      ld = detailKit(cabin, 'huey-lining');
    skinBacking(ld, root, {
      materials: [paint],
      // The forward limit takes whole faces (every corner aft of it), so the slender side-skin
      // faces there leave no sawtooth edge.
      inside: ([x, y, z], corners) =>
        z > 0.95 &&
        Math.max(...corners.map((p) => p[2])) < 2.86 &&
        y > 0.5 &&
        y < 2.62 &&
        Math.abs(x) < 1.2,
      lining: () => lining,
      toward: ([, , z]) => [0, 1.55, Math.min(z, 2.6)],
    });
    ld.finish();
  }
  const panel = mat('huey-panel', '#343a36'),
    coaming = mat('huey-coaming', '#202622', { roughness: 0.95, side: T.DoubleSide }),
    floor = mat('huey-floor', '#495044'),
    seat = mat('huey-seat-webbing', '#7c8061', { roughness: 0.95 }),
    face = mat('huey-gauge-face', '#101a17'),
    ink = mat('huey-gauge-ink', '#bec8a7'),
    sky = mat('huey-attitude-sky', '#7896a1'),
    earth = mat('huey-attitude-earth', '#69573f');
  const bindings = [];
  // The cargo floor ends at the aft cabin wall (z -0.9); behind it lies the closed aft fuselage.
  d.box([1.7, 0.055, 3.28], [0, 0.83, 0.735], floor);
  // Side benches, the canvas troop seat across the aft wall and internal door panels, visible
  // through the side windows.
  for (const side of [-1, 1]) {
    d.box([0.42, 0.1, 0.865], [side * 0.73, 1.03, -0.0075], seat);
    d.box([0.09, 0.45, 0.865], [side * 0.91, 1.3, -0.0075], seat);
    for (const z of [0.25, -0.3])
      d.rod([side * 0.73, 0.81, z], [side * 0.73, 0.98, z], 0.023, d.metal);
  }
  d.box([1.9, 0.1, 0.42], [0, 1.03, -0.65], seat);
  d.box([1.9, 0.5, 0.06], [0, 1.33, -0.86], seat);
  for (const x of [-0.7, 0, 0.7]) d.rod([x, 0.81, -0.62], [x, 0.98, -0.62], 0.023, d.metal);
  // Figure 2-4, PDF page 77 rasterized to 1700 px high. The figure carries no dimensions, so its
  // scale comes from the instruments it shows: the 53 px flight dials are 3.125 in (79.4 mm), which
  // also makes the 34 px engine dials 2 in and the face 1.05 m wide. The 1.76 m width used before
  // was a cabin-fit guess that drew every dial 1.7 times too large.
  // Keeping source image coordinates makes the relative outline/instrument layout auditable.
  const drawingScale = 0.0794 / 53;
  // The hood top sits 1.60 m above ground, 0.3 m below the eye, as a matched front photograph puts it.
  const panelDrawing = (x, y) => [(689.5 - x) * drawingScale, 1.385 + (715 - y) * drawingScale];
  const panelOutline = [
    [338, 500],
    [425, 467],
    [550, 447],
    [690, 439],
    [825, 449],
    [960, 475],
    [1041, 502],
    [1041, 679],
    [1027, 705],
    [995, 715],
    [530, 715],
    [490, 704],
    [371, 704],
    [345, 694],
    [338, 675],
  ].map(([x, y]) => panelDrawing(x, y));
  const panelPoint = (x, y, z = 2.68) => [x, y, z + (1.62 - y) * 0.12];
  sheet(
    d,
    panelOutline.map(([x, y]) => panelPoint(x, y)),
    panel,
    [0, 0, -1],
  );
  sheet(
    d,
    panelOutline.map(([x, y]) => panelPoint(x, y, 2.86)),
    coaming,
    [0, 0, 1],
  );
  for (let i = 0; i < panelOutline.length; i++) {
    const a = panelOutline[i],
      b = panelOutline[(i + 1) % panelOutline.length];
    quad(
      d,
      panelPoint(...a),
      panelPoint(...b),
      panelPoint(...b, 2.86),
      panelPoint(...a, 2.86),
      panel,
      [a[0], a[1] - 1.6, 0],
    );
  }
  // Rounded hood wraps around, with visible forward depth, rather than a rectangular shelf.
  const hood = [
    [334, 599],
    [302, 539],
    [287, 477],
    [302, 444],
    [376, 413],
    [482, 387],
    [594, 376],
    [690, 375],
    [802, 379],
    [917, 396],
    [1018, 427],
    [1082, 459],
    [1100, 483],
    [1085, 541],
    [1062, 599],
  ].map(([px, py]) => {
    const [x, y] = panelDrawing(px, py);
    // Pull only the overhanging ears inward; preserve the opening around the panel.
    const width = Math.min(Math.abs(x), 0.88) + Math.max(0, Math.abs(x) - 0.88) * 0.25;
    return [Math.sign(x) * width, y];
  });
  for (let i = 0; i < hood.length - 1; i++) {
    const a = panelPoint(...hood[i], 2.59),
      b = panelPoint(...hood[i + 1], 2.59),
      c = panelPoint(...hood[i + 1], 2.84),
      e = panelPoint(...hood[i], 2.84);
    quad(d, a, b, c, e, coaming, [0, 1, 0]);
  }
  d.path(
    hood.map((p) => panelPoint(...p, 2.59)),
    0.016,
    coaming,
  );
  const hoodInner = [
    [338, 599],
    [338, 500],
    [425, 467],
    [550, 447],
    [690, 439],
    [825, 449],
    [960, 475],
    [1041, 502],
    [1041, 599],
  ].map(([x, y]) => panelDrawing(x, y));
  sheet(
    d,
    [...hood, ...hoodInner.toReversed()].map(([x, y]) => panelPoint(x, y, 2.59)),
    coaming,
    [0, 0, -1],
  );
  // The forward wall closes the shell, so the hood reads as solid from outside the windscreen.
  sheet(
    d,
    [...hood, ...hoodInner.toReversed()].map(([x, y]) => panelPoint(x, y, 2.84)),
    coaming,
    [0, 0, 1],
  );
  const instrument = (x, y, r, name, source = 'rpm', style = 'dial') => {
    const z = panelPoint(x, y)[2] - 0.015;
    d.box([r * 2.16, r * 2.16, 0.018], [x, y, z], coaming);
    d.ring(r, 0.008, [x, y, z - 0.014], d.dark);
    d.add(new T.CircleGeometry(r * 0.91, 28).rotateY(Math.PI), face, [x, y, z - 0.017]);
    if (style === 'attitude') {
      d.add(new T.CircleGeometry(r * 0.86, 24, 0, Math.PI).rotateY(Math.PI), sky, [x, y, z - 0.02]);
      d.add(new T.CircleGeometry(r * 0.86, 24, Math.PI, Math.PI).rotateY(Math.PI), earth, [
        x,
        y,
        z - 0.02,
      ]);
      for (const q of [-2, -1, 1, 2])
        d.box([r * 0.55, 0.002, 0.001], [x, y + q * r * 0.19, z - 0.023], ink);
    }
    for (let i = 0; i < 24; i++) {
      const angle = Math.PI * (-0.25 + (i * 1.5) / 23),
        outer = r * 0.84,
        inner = r * (i % 4 === 0 ? 0.68 : 0.77);
      d.rod(
        [x + Math.cos(angle) * inner, y + Math.sin(angle) * inner, z - 0.023],
        [x + Math.cos(angle) * outer, y + Math.sin(angle) * outer, z - 0.023],
        0.0016,
        ink,
      );
    }
    if (style !== 'attitude')
      for (let i = 0; i < 5; i++) {
        const angle = Math.PI * (-0.25 + (i * 1.5) / 4);
        d.text(
          source === 'heading' ? ['E', 'S', 'W', 'N', 'E'][i] : String(i * 2),
          [x + Math.cos(angle) * r * 0.58, y + Math.sin(angle) * r * 0.58, z - 0.025],
          r * 0.19,
          Math.PI,
          ink,
        );
      }
    const label = name.includes('altimeter')
      ? 'ALT'
      : name.includes('speed')
        ? 'KNOTS'
        : name.includes('torque')
          ? 'TORQUE'
          : name.includes('hsi')
            ? 'HDG'
            : name.includes('vsi')
              ? 'CLIMB'
              : name.includes('tachometer')
                ? 'RPM'
                : name.includes('oil')
                  ? 'OIL'
                  : name.includes('fuel')
                    ? 'FUEL'
                    : '';
    if (label) d.text(label, [x, y - r * 0.35, z - 0.026], r * 0.12, Math.PI, ink);
    const pointer = group(cabin, `huey-${name}-pointer`, [x, y, z - 0.026]),
      pd = detailKit(pointer, `huey-${name}-needle`);
    if (style === 'attitude') {
      pd.box([r * 1.15, 0.004, 0.003], [0, 0, 0], pd.amber);
      pd.box([0.006, r * 0.22, 0.003], [0, -r * 0.1, 0], pd.amber);
    } else {
      pd.rod([0, -r * 0.15, 0], [0, r * 0.69, 0], 0.0022, ink);
      if (name === 'dual-tachometer') pd.rod([0, 0, 0], [r * 0.58, r * 0.1, 0], 0.002, pd.amber);
      pd.add(new T.CircleGeometry(r * 0.09, 12).rotateY(Math.PI), ink, [0, 0, -0.002]);
    }
    pd.finish();
    bindings.push({
      node: pointer.name,
      source,
      property: 'rotation',
      axis: 'z',
      // +Z rotation is clockwise on these -Z faces: the horizon bar turns against the bank.
      scale:
        style === 'attitude'
          ? -1
          : source === 'airspeed'
            ? 0.043
            : source === 'altitude'
              ? 0.0206
              : source === 'heading'
                ? -1
                : 3.7,
      offset: style === 'attitude' ? 0 : -1.8,
    });
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        d.add(new T.CircleGeometry(0.0028, 6).rotateY(Math.PI), d.metal, [
          x + sx * r * 0.96,
          y + sy * r * 0.96,
          z - 0.011,
        ]);
  };
  // Manual instrument centers/radii in pixels. Pilot is right (-X); left panel differs.
  for (const [px, py, pr, name, source, style] of [
    [384, 532, 26, 'copilot-speed', 'airspeed'],
    [450, 531, 29, 'copilot-attitude', 'roll', 'attitude'],
    [520, 533, 27, 'copilot-altimeter', 'altitude'],
    [449, 600, 27, 'copilot-heading', 'heading'],
    [519, 601, 27, 'copilot-vsi', 'verticalSpeed'],
    [844, 533, 27, 'pilot-speed', 'airspeed'],
    [922, 533, 35, 'pilot-attitude', 'roll', 'attitude'],
    [999, 533, 26, 'pilot-altimeter', 'altitude'],
    [999, 600, 26, 'pilot-vsi', 'verticalSpeed'],
    [920, 622, 29, 'pilot-hsi', 'heading'],
    [832, 605, 24, 'pilot-rpm', 'rpm'],
    [832, 672, 24, 'pilot-turn', 'yaw'],
    [1002, 657, 19, 'clock', 'rpm'],
    [624, 514, 17, 'fuel-pressure', 'power'],
    [665, 513, 17, 'fuel-quantity', 'power'],
    [624, 552, 17, 'oil-pressure', 'rpm'],
    [665, 553, 17, 'oil-temperature', 'rpm'],
    [624, 595, 17, 'transmission-pressure', 'rpm'],
    [666, 594, 17, 'transmission-temperature', 'rpm'],
    [771, 529, 25, 'dual-tachometer', 'rpm'],
    [771, 588, 17, 'gas-producer', 'rpm'],
    [771, 632, 17, 'torque', 'power'],
    [771, 677, 17, 'exhaust-temperature', 'power'],
    [669, 642, 18, 'dc-voltage', 'rpm'],
    [670, 686, 18, 'ac-voltage', 'rpm'],
  ]) {
    const [x, y] = panelDrawing(px, py);
    instrument(x, y, pr * drawingScale, name, source, style);
  }
  for (const [px, py] of [
    [421, 441],
    [678, 417],
    [833, 424],
    [967, 449],
  ]) {
    const [x, y] = panelDrawing(px, py);
    d.box([0.05, 0.021, 0.012], panelPoint(x, y, 2.58), d.dark);
    d.box([0.033, 0.008, 0.003], panelPoint(x, y, 2.572), d.amber);
  }
  // Distinct blanking, warning and HSI control panels occupy the remaining reference areas.
  for (const [px, py, pw, ph] of [
    [579, 528, 37, 50],
    [548, 661, 99, 50],
    [563, 705, 65, 16],
    [622, 640, 28, 27],
    [622, 680, 28, 27],
    [716, 548, 51, 23],
    [724, 657, 60, 13],
    [919, 688, 79, 22],
  ]) {
    const [x, y] = panelDrawing(px, py);
    d.box([pw * drawingScale, ph * drawingScale, 0.012], panelPoint(x, y, 2.655), coaming);
  }
  // Radio/control pedestal slopes down toward the seats; it is separate from the flight panel.
  const pedestal = group(cabin, 'huey-center-pedestal', [0, 1.3, 1.93]);
  pedestal.rotation.x = Math.PI / 2 - 0.1;
  const cd = detailKit(pedestal, 'huey-pedestal');
  cd.box([0.41, 1.47, 0.46], [0, 0, 0.21], panel);
  // Radio knobs: a skirted base under a fluted cap with its index line (MS knob shapes).
  const knob = (x, y, r = 0.017) => {
    cd.add(
      lathe(
        [
          [0, 0],
          [r, 0],
          [r, 0.004],
          [r * 0.7, 0.008],
          [r * 0.62, 0.021],
          [0, 0.021],
        ],
        10,
      ).rotateX(-Math.PI / 2),
      cd.dark,
      [x, y, -0.03],
    );
    cd.box([0.002, r * 0.5, 0.002], [x, y + r * 0.3, -0.0515], ink);
  };
  const switches = partBatch(),
    toggle = (x, y) => batToggle(switches, parts, [x, y, -0.03]);
  // Fuel/system switches, paired communications controllers, navigation receiver and audio.
  // Exact radio installations vary; these groupings follow the cited Greek Army cockpit.
  cd.box([0.37, 0.21, 0.008], [0, 0.57, -0.026], coaming);
  for (const x of [-0.13, -0.07, 0, 0.07, 0.13]) toggle(x, 0.55);
  // The MAIN FUEL switch at [0.07, 0.62] is a control station (end of this function).
  cd.text('MAIN FUEL', [0.07, 0.655, -0.0305], 0.009, Math.PI, ink);
  knob(-0.12, 0.64, 0.025);
  for (const y of [0.31, 0.12]) {
    cd.box([0.37, 0.17, 0.008], [0, y, -0.026], coaming);
    cd.box([0.16, 0.04, 0.008], [0.015, y + 0.033, -0.035], face);
    for (const x of [-0.14, -0.055, 0.065, 0.14]) knob(x, y - 0.035, x === -0.14 ? 0.025 : 0.015);
    cd.text(y > 0.2 ? 'VHF' : 'UHF', [0, y + 0.057, -0.041], 0.014, Math.PI, ink);
  }
  cd.box([0.37, 0.21, 0.008], [0, -0.1, -0.026], coaming);
  cd.add(new T.CircleGeometry(0.038, 16).rotateY(Math.PI), face, [-0.09, -0.09, -0.036]);
  knob(-0.15, -0.16);
  knob(0.13, -0.14, 0.022);
  cd.box([0.14, 0.035, 0.006], [0.06, -0.055, -0.038], ink);
  for (const x of [-0.025, 0.025, 0.075, 0.125]) toggle(x, -0.14);
  cd.box([0.37, 0.18, 0.008], [0, -0.31, -0.026], coaming);
  for (let i = 0; i < 7; i++) toggle((i - 3) * 0.043, -0.3);
  knob(-0.13, -0.36, 0.013);
  knob(0.13, -0.36, 0.013);
  // Map-case lid and latch occupy the aft end instead of another cloned radio.
  cd.box([0.37, 0.29, 0.025], [0, -0.56, -0.033], panel);
  cd.rod([-0.07, -0.56, -0.055], [0.07, -0.56, -0.055], 0.009, cd.metal);
  switches.emit(cd);
  cd.finish();
  // Seat frames, fabric pads, armor sides, four-point harness and floor-mounted curved cyclics.
  // The eye is fixed by the side view; the cushion sits 0.8 m under it on raised seat legs.
  const seatLift = 0.2,
    seatAft = 0.16;
  for (const side of [-1, 1]) {
    const x = side * 0.47;
    d.box([0.43, 0.11, 0.49], [x, 1.14 + seatLift, 1.78 - seatAft], seat);
    const back = d.box([0.44, 0.62, 0.095], [x, 1.48 + seatLift, 1.53 - seatAft], seat);
    back.rotation.x = -0.08;
    for (const edge of [-1, 1]) {
      d.rod(
        [x + edge * 0.22, 0.79, 1.57 - seatAft],
        [x + edge * 0.22, 1.17 + seatLift, 1.57 - seatAft],
        0.024,
        d.metal,
      );
      d.rod(
        [x + edge * 0.17, 0.79, 1.95 - seatAft],
        [x + edge * 0.17, 1.1 + seatLift, 1.95 - seatAft],
        0.024,
        d.metal,
      );
      d.box([0.025, 0.62, 0.32], [x + edge * 0.25, 1.48 + seatLift, 1.55 - seatAft], floor);
      d.rod(
        [x + edge * 0.12, 1.77 + seatLift, 1.47 - seatAft],
        [x + edge * 0.035, 1.19 + seatLift, 1.91 - seatAft],
        0.018,
        coaming,
      );
      d.rod(
        [x + edge * 0.22, 1.18 + seatLift, 1.7 - seatAft],
        [x + edge * 0.035, 1.19 + seatLift, 1.91 - seatAft],
        0.022,
        coaming,
      );
    }
    d.box([0.065, 0.042, 0.025], [x, 1.2 + seatLift, 1.92 - seatAft], d.metal);
    // The long bent cyclic out of its floor gaiter, the UH-1 grip on top (TM 55-1520-210-10).
    const stick = group(cabin, `huey-cyclic-${side}`, [x, 0.8, 2.16]),
      sd = detailKit(stick, 'cyclic');
    hueyCyclic(sd, {
      path: [
        [0, 0, 0],
        [0, 0.36, 0.004],
        [0, 0.52, -0.07],
        [0, 0.65, -0.165],
        [0, 0.75, -0.19],
      ],
      floor: 0.0575,
      tubeMaterial: sd.dark,
      palette: parts,
    });
    sd.finish();
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.13 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.12 },
    );
    const collective = group(cabin, `huey-collective-${side}`, [x + 0.26, 0.95, 1.57]),
      ld = detailKit(collective, 'collective');
    // Twist-grip throttle and the pilot's switch box, cocked up like a pistol, on the tip.
    hueyCollective(ld, { end: [0, 0.31, 0.48], tubeMaterial: ld.dark, palette: parts });
    ld.finish();
    bindings.push({
      node: collective.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: -0.35,
    });
    for (const pedalSide of [-1, 1]) {
      const pedal = group(cabin, `huey-pedal-${side}-${pedalSide}`, [
          x + pedalSide * 0.13,
          0.91,
          2.61,
        ]),
        pd = detailKit(pedal, 'pedal');
      pedalGeometry(pd, {
        style: 'heli',
        side: pedalSide,
        scale: 1.12,
        drop: 0.12,
        lean: 0.42,
        palette: parts,
      });
      pd.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -pedalSide * 0.045,
      });
    }
  }
  // Overhead: separate breaker banks and paired lighting/engine control columns.
  d.box([0.53, 0.05, 0.66], [0, 2.58, 1.97], panel);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      d.add(new T.CylinderGeometry(0.0065, 0.0065, 0.012, 8), d.dark, [
        (c - 3.5) * 0.055,
        2.549,
        1.71 + r * 0.042,
      ]);
  for (const x of [-0.14, 0.14])
    for (let r = 0; r < 3; r++) d.box([0.23, 0.008, 0.115], [x, 2.549, 1.94 + r * 0.12], coaming);
  for (const x of [0.08, 0.2])
    for (const z of [1.92, 2.04, 2.16]) {
      d.add(new T.CylinderGeometry(0.022, 0.022, 0.019, 8), d.dark, [x, 2.535, z]);
      d.box([0.005, 0.006, 0.025], [x, 2.522, z], ink);
    }
  // Overhead toggles hang down, tipped forward.
  for (const z of [1.92, 2.04, 2.16])
    for (const x of [-0.2, -0.08]) {
      d.add(new T.CylinderGeometry(0.0042, 0.0042, 0.006, 12), d.metal, [x, 2.548, z]);
      const bat = d.add(new T.CylinderGeometry(0.0025, 0.0015, 0.018, 10), d.metal, [
        x,
        2.537,
        z + 0.003,
      ]);
      bat.rotation.x = -0.35;
    }
  d.finish();
  // MAIN FUEL switch on the pedestal's engine panel, guarded (TM 55-1520-210-10, fig 2-5).
  root.updateMatrixWorld(true);
  const stations = [
    {
      action: 'engine',
      style: 'guarded',
      at: pedestal.localToWorld(new T.Vector3(0.07, 0.62, -0.03)).toArray(),
      rotation: [pedestal.rotation.x, 0, 0],
      scale: 1.15,
    },
  ];
  return { nodes: ['cockpit'], bindings, stations };
}

/** Monotone cubic through samples at row index 0..n-1: smooth between rows, no overshoot. */
function monotoneRows(ys) {
  const n = ys.length,
    s = ys.slice(1).map((y, i) => y - ys[i]),
    m = ys.map((_, i) =>
      i === 0 ? s[0] : i === n - 1 ? s[n - 2] : s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2,
    );
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / s[i],
      b = m[i + 1] / s[i],
      q = a * a + b * b;
    if (q > 9) {
      m[i] = (3 / Math.sqrt(q)) * a * s[i];
      m[i + 1] = (3 / Math.sqrt(q)) * b * s[i];
    }
  }
  return (t) => {
    const i = Math.min(n - 2, Math.max(0, Math.floor(t))),
      u = Math.min(1, Math.max(0, t - i)),
      u2 = u * u,
      u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * ys[i] +
      (u3 - 2 * u2 + u) * m[i] +
      (3 * u2 - 2 * u3) * ys[i + 1] +
      (u3 - u2) * m[i + 1]
    );
  };
}

/** Nose waterlines [height, half-width, forward extent] read at a fractional row index. */
export function waterlines(rows) {
  const columns = [0, 1, 2].map((k) => monotoneRows(rows.map((r) => r[k])));
  return (t) => columns.map((f) => f(t));
}

/** Convex rounded rectangle in a patch's (u, v) parameters, corner radii `ru`, `rv`. */
export function roundedRegion(u0, u1, v0, v1, ru, rv, steps = 4) {
  const corners = [
    [u1 - ru, v1 - rv, 0],
    [u0 + ru, v1 - rv, 1],
    [u0 + ru, v0 + rv, 2],
    [u1 - ru, v0 + rv, 3],
  ];
  return corners.flatMap(([u, v, k]) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((k + i / steps) * Math.PI) / 2;
      return [u + ru * Math.cos(a), v + rv * Math.sin(a)];
    }),
  );
}

/** Keep the part of a convex (u, v) polygon left of a -> b (right of it when `keepLeft` is false). */
function clipHalf(poly, a, b, keepLeft = true) {
  const side = (p) =>
    ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * (keepLeft ? 1 : -1);
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      sp = side(p),
      sq = side(q);
    if (sp >= 0) result.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return result;
}
const area2 = (poly) =>
  poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);

/**
 * Smooth skin over a parametric patch `point(u, v)` between the ascending `us` and `vs`
 * samples. Each convex region ({ poly: counter-clockwise (u, v) points, material }) takes the
 * exact part of every cell it covers; the rest is `body`. Normals come from the surface itself
 * (oriented away from `inside`), so a rounded nose shades round instead of as flat panels.
 * A region with a null material stays open; `inward` turns the faces toward `inside` (linings).
 * Returns the surface normal function for seals that follow the skin.
 */
export function skinPatch(d, point, us, vs, body, regions, inside, inward = false) {
  const [u0, u1, v0, v1] = [us[0], us.at(-1), vs[0], vs.at(-1)];
  const normal = (u, v) => {
    const e = 1e-4,
      a = point(Math.max(u - e, u0), v),
      b = point(Math.min(u + e, u1), v),
      c = point(u, Math.max(v - e, v0)),
      f = point(u, Math.min(v + e, v1)),
      p = point(u, v),
      n = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(
        new T.Vector3(f[0] - c[0], f[1] - c[1], f[2] - c[2]),
      );
    if (n.lengthSq() < 1e-18) n.set(p[0] - inside[0], p[1] - inside[1], p[2] - inside[2]);
    n.normalize();
    if (n.x * (p[0] - inside[0]) + n.y * (p[1] - inside[1]) + n.z * (p[2] - inside[2]) < 0)
      n.negate();
    return n.toArray();
  };
  const out = new Map(),
    facing = (u, v) => normal(u, v).map((c) => (inward ? -c : c));
  const emit = (poly, material) => {
    if (!material || Math.abs(area2(poly)) < 1e-12) return;
    const data = out.get(material) ?? { position: [], normal: [] };
    out.set(material, data);
    for (let k = 1; k < poly.length - 1; k++) {
      let tri = [poly[0], poly[k], poly[k + 1]];
      const p = tri.map((q) => point(...q)),
        face = new T.Vector3(...p[1])
          .sub(new T.Vector3(...p[0]))
          .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0]))),
        n = facing(
          (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
          (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
        );
      if (face.dot(new T.Vector3(...n)) < 0) tri = [tri[0], tri[2], tri[1]];
      for (const q of tri) {
        data.position.push(...point(...q));
        data.normal.push(...facing(...q));
      }
    }
  };
  for (let i = 0; i < us.length - 1; i++)
    for (let j = 0; j < vs.length - 1; j++) {
      let pieces = [
        [
          [us[i], vs[j]],
          [us[i + 1], vs[j]],
          [us[i + 1], vs[j + 1]],
          [us[i], vs[j + 1]],
        ],
      ];
      for (const { poly, material } of regions) {
        const next = [];
        for (const piece of pieces) {
          let inside = piece,
            rest = piece;
          for (let k = 0; k < poly.length && inside.length > 2; k++)
            inside = clipHalf(inside, poly[k], poly[(k + 1) % poly.length]);
          if (inside.length < 3 || Math.abs(area2(inside)) < 1e-12) {
            next.push(piece);
            continue;
          }
          emit(inside, material);
          for (let k = 0; k < poly.length && rest.length > 2; k++) {
            const outside = clipHalf(rest, poly[k], poly[(k + 1) % poly.length], false);
            if (outside.length > 2 && Math.abs(area2(outside)) > 1e-12) next.push(outside);
            rest = clipHalf(rest, poly[k], poly[(k + 1) % poly.length]);
          }
        }
        pieces = next;
      }
      for (const piece of pieces) emit(piece, body);
    }
  for (const [material, data] of out) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(data.position, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(data.normal, 3));
    d.add(geometry, material);
  }
  return normal;
}

const cylinder = (r, h, at, rotation = [0, 0, 0], sides = 16, r2 = r) =>
  place(new T.CylinderGeometry(r2, r, h, sides), at, rotation);
/** A knurled round grip up local +Y from `y`: `ribs` shallow flutes round radius `r`. */
const knurled = (r, h, ribs = 20, depth = 0.08, y = 0) =>
  loftUp(
    [0, h * 0.06, h * 0.94, h].map((dy, i) => ({
      y: y + dy,
      points: Array.from({ length: ribs * 2 }, (_, j) => {
        const a = (j / (ribs * 2)) * Math.PI * 2,
          rr = r * (j % 2 ? 1 - depth : 1) * (i === 0 || i === 3 ? 0.93 : 1);
        return [Math.cos(a) * rr, Math.sin(a) * rr];
      }),
    })),
    30,
  );
/** A bat toggle on its hex nut and bushing, facing -Z from `at` and tipped up. */
export function batToggle(b, P, at, length = 0.018) {
  b.add(P.alloy, cylinder(0.0062, 0.003, [at[0], at[1], at[2] - 0.0015], [Math.PI / 2, 0, 0], 6));
  b.add(P.alloy, cylinder(0.0042, 0.004, [at[0], at[1], at[2] - 0.005], [Math.PI / 2, 0, 0], 8));
  const tip = [at[0], at[1] + Math.sin(0.35) * length, at[2] - 0.007 - Math.cos(0.35) * length];
  b.add(P.alloy, bar([at[0], at[1], at[2] - 0.006], tip, 0.0015, 8, 0.0025));
}
/**
 * The UH-1 family's cyclic grip (UH-1H, 212/412), base at the origin, up +Y, trigger toward +Z:
 * a thick hand-hold under a broad head canted forward. The crown plate carries the force-trim
 * button, the hoist switch and the red cargo-release button under its guard; the two-stage
 * radio/ICS trigger sits under the forefinger. `glass` adds the 412's coolie-hat trim switch.
 */
export function hueyGripInto(b, P, variant = 'uh-1h') {
  const L = (rows) =>
    loftUp(
      rows.map(([y, cz, rx, rz, power = 2.2]) => ({
        y,
        points: contour(0, cz, rx, rz, 16, power),
      })),
    );
  b.add(
    P.alloy,
    lathe(
      [
        [0, -0.02],
        [0.0175, -0.02],
        [0.0185, -0.004],
        [0.02, 0.006],
        [0.0172, 0.012],
        [0, 0.012],
      ],
      14,
    ),
  );
  b.add(
    P.grip,
    L([
      [0.008, 0, 0.0185, 0.02],
      [0.04, 0.002, 0.0205, 0.022],
      [0.078, 0.004, 0.021, 0.0225],
      [0.103, 0.01, 0.0215, 0.026, 2.4],
      [0.122, 0.018, 0.0235, 0.031, 2.8],
      [0.136, 0.022, 0.023, 0.032, 3],
      [0.143, 0.022, 0.019, 0.027, 3],
      [0.146, 0.022, 0.012, 0.018, 2.6],
    ]),
  );
  // Crown plate, the switches standing on it.
  b.add(P.black, place(roundedBox([0.04, 0.004, 0.05], 0.004), [0, 0.146, 0.022], [0.12, 0, 0]));
  b.add(P.black, cylinder(0.006, 0.008, [0.009, 0.151, 0.01], [0.12, 0, 0], 14));
  b.add(
    P.black,
    place(new T.SphereGeometry(0.0045, 12, 8), [0.009, 0.155, 0.01], [0, 0, 0], [1, 0.55, 1]),
  );
  b.add(P.red, cylinder(0.0048, 0.006, [-0.01, 0.15, 0.03], [0.12, 0, 0], 12));
  b.add(
    P.yellow,
    place(roundedBox([0.015, 0.012, 0.004], 0.0015), [-0.01, 0.154, 0.039], [0.7, 0, 0]),
  );
  b.add(
    P.black,
    place(roundedBox([0.008, 0.009, 0.012], 0.002), [0.009, 0.151, 0.034], [0.12, 0, 0]),
  );
  if (variant === '412') {
    b.add(P.black, cylinder(0.0042, 0.006, [-0.01, 0.152, 0.008], [0.12, 0, 0], 12));
    b.add(
      P.alloy,
      place(roundedBox([0.006, 0.014, 0.01], 0.002), [-0.025, 0.132, 0.02], [0, 0, 0.2]),
    );
  }
  // Two-stage radio / ICS trigger, and the trigger guard below it.
  b.add(
    P.black,
    tube(
      [
        [0, 0.112, 0.041],
        [0, 0.1, 0.053],
        [0, 0.084, 0.05],
      ],
      0.0052,
      10,
    ),
  );
  b.add(
    P.alloy,
    tube(
      [
        [0, 0.12, 0.04],
        [0, 0.11, 0.066],
        [0, 0.074, 0.062],
        [0, 0.064, 0.024],
      ],
      0.0028,
      10,
    ),
  );
  // Left-side thumb switch (force-trim release).
  b.add(P.black, cylinder(0.005, 0.007, [0.023, 0.126, 0.012], [0, 0, Math.PI / 2], 12));
}
/**
 * A UH-1 family cyclic from its floor pivot: a rubber gaiter at `floor`, the tube bent through
 * `path` (smoothed, 12-sided) and the UH-1 grip on its end, aligned with the tube's last run.
 */
export function hueyCyclic(
  d,
  { path, floor = 0, radius = 0.015, tubeMaterial, palette, grip = 'uh-1h' },
) {
  const P = partPalette(palette),
    b = partBatch();
  const points = smoothPath(path, 12);
  b.add(tubeMaterial ?? P.black, tube(points, radius, 12));
  b.add(
    P.tread,
    lathe(
      [
        [0, floor],
        [0.055, floor],
        [0.053, floor + 0.01],
        [0.038, floor + 0.018],
        [0.036, floor + 0.03],
        [0.026, floor + 0.04],
        [0.025, floor + 0.052],
        [radius * 1.35, floor + 0.075],
        [radius * 1.3, floor + 0.085],
        [0, floor + 0.085],
      ],
      14,
      28,
    ),
  );
  b.emit(d);
  const top = points.at(-1),
    back = points.at(-3);
  hueyGripInto(b, P, grip);
  b.emit(d, top, [Math.atan2(top[2] - back[2], top[1] - back[1]), 0, 0]);
}
/** Catmull-Rom points through a polyline's stations, `count` + 1 of them. */
function smoothPath(points, count) {
  const n = points.length - 1;
  return Array.from({ length: count + 1 }, (_, s) => {
    const at = Math.min(n - 1e-9, (s / count) * n),
      i = Math.floor(at),
      u = at - i,
      a = points[Math.max(0, i - 1)],
      p = points[i],
      c = points[i + 1],
      e = points[Math.min(n, i + 2)];
    return p.map((v, k) => {
      const m = (c[k] - a[k]) / 2,
        o = (e[k] - v) / 2;
      return v + u * (m + u * (3 * (c[k] - v) - 2 * m - o + u * (2 * (v - c[k]) + m + o)));
    });
  });
}
/**
 * A UH-1 family collective from its pivot beside the seat, lying forward and up to `end`
 * ([0, rise, run]): the lever tube with its friction collar, the knurled twist-grip throttle
 * (two in a row on the twin-engine 212/412) and the pilot's switch box on the tip, angled up
 * from the lever like a pistol: landing and search light switches and the governor-RPM switch on
 * its face, the idle-stop release on its side and the starter trigger under it.
 */
export function hueyCollective(d, { end, palette, tubeMaterial, twin = false }) {
  const P = partPalette(palette);
  const length = Math.hypot(end[1], end[2]),
    pitch = Math.atan2(end[1], end[2]),
    along = [Math.PI / 2, 0, 0],
    b = partBatch();
  const grips = twin ? 2 : 1,
    gripLength = twin ? 0.1 : 0.13,
    start = length - grips * (gripLength + 0.012) - 0.02;
  b.add(
    P.tread,
    lathe(
      [
        [0, -0.035],
        [0.04, -0.035],
        [0.038, -0.02],
        [0.027, -0.008],
        [0.023, 0.016],
        [0, 0.016],
      ],
      12,
    ).rotateX(Math.PI / 2),
  );
  b.add(tubeMaterial ?? P.black, cylinder(0.018, start, [0, 0, start / 2], along, 16));
  b.add(P.steel, place(knurled(0.027, 0.03, 10, 0.12), [0, 0, 0.08], along));
  for (let i = 0; i < grips; i++) {
    const z = start + i * (gripLength + 0.012);
    b.add(P.alloy, cylinder(0.021, 0.012, [0, 0, z + 0.006], along, 16));
    b.add(P.grip, place(knurled(0.023, gripLength, 16, 0.07), [0, 0, z + 0.012], along));
    b.add(P.white, place(roundedBox([0.0025, 0.002, 0.03], 0.0008), [0, 0.0228, z + 0.05]));
  }
  // The switch box, cocked up 0.45 rad from the lever on a short neck.
  const tip = length - 0.01,
    cock = -0.45,
    box = (size, at, material, r = 0.008) =>
      b.add(material, place(roundedBox(size, r, 1), at, [cock, 0, 0]));
  // A point in the box's frame (origin on the lever tip, cocked up) in the lever's frame.
  const at = (x, y, z) => [
    x,
    y * Math.cos(cock) - z * Math.sin(cock),
    tip + y * Math.sin(cock) + z * Math.cos(cock),
  ];
  b.add(P.black, cylinder(0.02, 0.03, [0, 0, tip], along, 14));
  box([0.06, 0.055, 0.1], at(0, 0.02, 0.05), P.grip, 0.012);
  box([0.05, 0.006, 0.08], at(0, 0.049, 0.05), P.black, 0.003);
  for (const [x, z] of [
    [-0.015, 0.02],
    [0.015, 0.02],
    [-0.015, 0.055],
    [0.015, 0.055],
  ]) {
    const p = at(x, 0.052, z);
    b.add(P.alloy, cylinder(0.0045, 0.004, p, [cock, 0, 0], 8));
    b.add(
      P.alloy,
      place(new T.CylinderGeometry(0.0014, 0.0022, 0.016, 8), at(x, 0.06, z - 0.003), [
        cock - 0.3,
        0,
        0,
      ]),
    );
  }
  b.add(P.white, cylinder(0.008, 0.008, at(0, 0.054, 0.085), [cock, 0, 0], 16));
  b.add(P.black, cylinder(0.0055, 0.008, at(0.032, 0.02, 0.04), [0, 0, Math.PI / 2], 12));
  // Starter trigger, curled under the box like a pistol's.
  const t0 = at(0, -0.008, 0.03),
    t1 = at(0, -0.03, 0.04),
    t2 = at(0, -0.035, 0.062);
  b.add(P.black, tube([t0, t1, t2], 0.005, 10));
  b.add(
    P.alloy,
    tube(
      [at(0, -0.008, 0.012), at(0, -0.045, 0.03), at(0, -0.046, 0.075), at(0, -0.008, 0.085)],
      0.003,
      10,
    ),
  );
  b.emit(d, [0, 0, 0], [-pitch, 0, 0]);
}

/** Collect part geometry by material, then add it to a kit once, rotated (XYZ) and moved as a
 * whole: a grip drawn upright can stand on the end of a bent tube. */
export function partBatch() {
  const byMaterial = new Map();
  return {
    add(material, ...geometries) {
      if (!byMaterial.has(material)) byMaterial.set(material, []);
      byMaterial.get(material).push(...geometries);
    },
    emit(d, at = [0, 0, 0], rotation = [0, 0, 0]) {
      const turn = new T.Matrix4().compose(
        new T.Vector3(...at),
        new T.Quaternion().setFromEuler(new T.Euler(...rotation)),
        new T.Vector3(1, 1, 1),
      );
      for (const [material, list] of byMaterial) {
        const parts = list.map((g) => {
          const flat = g.index ? g.toNonIndexed() : g;
          flat.deleteAttribute('uv');
          if (!flat.getAttribute('normal')) flat.computeVertexNormals();
          return flat;
        });
        d.add(mergeGeometries(parts).applyMatrix4(turn), material);
      }
      byMaterial.clear();
    },
  };
}

/**
 * Line the inside of the airframe's own opaque skin within a cabin region. The fuselage paint is
 * double-sided, so from the seats the cabin showed the painted skin's back faces (near-white on a
 * white aircraft) round the panel, in the footwells and below the sills. Every triangle drawn in
 * one of `materials`, outside any node named in `exclude`, whose model-frame centroid passes
 * `inside(c, corners)` gets a copy `inset` inside the skin, facing `toward(c)` (a point inside the cabin),
 * in the material `lining(c)` returns (null leaves that face bare). A face that other skin hides
 * from `toward(c)`, or that has skin within 9 cm straight through it (a tube, rail or frame), is
 * left bare: their linings stood outside the skin and showed from outside. Corner normals are averaged over the
 * faces that share them, so neighbouring faces stay joined after the inset. Call it after the
 * exterior kits finish; `d` is a kit inside the cabin group.
 */
export function skinBacking(
  d,
  root,
  { materials, inside, lining, toward, inset = 0.006, exclude = ['cockpit'] },
) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert(),
    toKit = d.root.matrixWorld.clone().invert().multiply(root.matrixWorld),
    names = new Set(materials.map((m) => (typeof m === 'string' ? m : m.name)));
  const all = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material) || !names.has(mesh.material.name)) return;
    for (let p = mesh; p && p !== root; p = p.parent) if (exclude.includes(p.name)) return;
    const matrix = toRoot.clone().multiply(mesh.matrixWorld),
      position = mesh.geometry.getAttribute('position'),
      index = mesh.geometry.index,
      count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const v = [0, 1, 2].map((k) =>
        new T.Vector3()
          .fromBufferAttribute(position, index ? index.getX(i + k) : i + k)
          .applyMatrix4(matrix),
      );
      all.push({ v, c: v[0].clone().add(v[1]).add(v[2]).divideScalar(3) });
    }
  });
  const candidates = [],
    box = new T.Box3();
  for (const face of all) {
    const c = [face.c.x, face.c.y, face.c.z];
    if (
      !inside(
        c,
        face.v.map((p) => p.toArray()),
      )
    )
      continue;
    face.material = lining(c);
    if (!face.material) continue;
    const n = face.v[1].clone().sub(face.v[0]).cross(face.v[2].clone().sub(face.v[0]));
    if (n.lengthSq() < 1e-14) continue;
    face.from = new T.Vector3(...toward(c));
    if (n.dot(face.from.clone().sub(face.c)) < 0) n.negate();
    face.n = n;
    candidates.push(face);
    box.expandByPoint(face.c).expandByPoint(face.from);
  }
  box.expandByScalar(0.05);
  // Möller-Trumbore against the skin near the cabin: is anything between the point and the face?
  const blockers = all.filter((f) => f.v.some((p) => box.containsPoint(p)));
  const e1 = new T.Vector3(),
    e2 = new T.Vector3(),
    h = new T.Vector3(),
    s0 = new T.Vector3(),
    q = new T.Vector3(),
    dir = new T.Vector3();
  const hit = (face, origin, length) => {
    for (const other of blockers) {
      if (other === face) continue;
      const [a, b, c] = other.v;
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      h.crossVectors(dir, e2);
      const det = e1.dot(h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det;
      s0.subVectors(origin, a);
      const u = f * s0.dot(h);
      if (u < 0 || u > 1) continue;
      q.crossVectors(s0, e1);
      const w = f * dir.dot(q);
      if (w < 0 || u + w > 1) continue;
      const t = f * e2.dot(q);
      if (t > 0 && t < length) return true;
    }
    return false;
  };
  const hidden = (face) => {
    dir.copy(face.c).sub(face.from);
    const length = dir.length();
    dir.divideScalar(length);
    // Skin within 3 cm of the face (a fold it lies beside) does not hide it.
    if (hit(face, face.from, length - 0.03)) return true;
    // A tube, rail or frame has its own far side within 9 cm straight out through it (the far
    // half faces away from the cabin and is hidden behind the near half). Looking outward only:
    // inward, the skin beyond a sharp fold (the nose's beltline) would count too.
    dir.copy(face.n).normalize().negate();
    // From just inside the face, so a second skin lying on it counts too.
    return hit(face, face.c.clone().addScaledVector(dir, -0.002), 0.092);
  };
  const faces = [],
    corners = new Map(),
    key = (p) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
  for (const face of candidates) {
    if (hidden(face)) continue;
    const { v, n, material } = face;
    // Area-weighted corner normals (the cross product's length is twice the area).
    for (const p of v) {
      const k = key(p);
      corners.set(k, (corners.get(k) ?? new T.Vector3()).add(n));
    }
    faces.push({ v, n: n.clone().normalize(), material });
  }
  const out = new Map();
  for (const { v, n, material } of faces) {
    const moved = v.map((p) => {
      const m = corners.get(key(p)).clone().normalize();
      return p.clone().addScaledVector(m.dot(n) > 0.4 ? m : n, inset);
    });
    if (moved[1].clone().sub(moved[0]).cross(moved[2].clone().sub(moved[0])).dot(n) < 0)
      [moved[1], moved[2]] = [moved[2], moved[1]];
    const list = out.get(material) ?? [];
    out.set(material, list);
    for (const p of moved) list.push(...p.applyMatrix4(toKit).toArray());
  }
  for (const [material, list] of out) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(list, 3));
    geometry.computeVertexNormals();
    d.add(geometry, material);
  }
}
