/** AV-8B II Plus, clean configuration. Public NATOPS Fig1-2 sheet2 and FO-1.
 * Original geometry. Dimensioned layout and estimated transverse sections are kept separate. */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { cockpitBulkhead, cockpitLiner } from './cockpit-fit.mjs';
import {
  bar,
  contour,
  gearHandleGeometry,
  lathe,
  loftUp,
  partPalette,
  place,
  roundedBox,
  sphere,
  stickGeometry,
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

/** Harrier rudder pedal, drawn at its pad center: a compact plate with a toe strap across it,
 * a heel bar and a straight arm forward to the pedal box. The top leans forward. */
function harrierPedal(kit) {
  const P = partPalette(),
    lean = 0.38;
  const parts = [
    [P.steel, roundedBox([0.082, 0.13, 0.011], 0.009, 1)],
    [P.tread, place(roundedBox([0.066, 0.1, 0.003], 0.007, 1), [0, -0.004, -0.007])],
    [
      P.tread,
      tube(
        [
          [-0.042, 0.02, -0.004],
          [-0.03, 0.026, -0.03],
          [0.03, 0.026, -0.03],
          [0.042, 0.02, -0.004],
        ],
        0.006,
        8,
      ),
    ],
    [P.steel, bar([-0.042, -0.064, -0.016], [0.042, -0.064, -0.016], 0.005, 10)],
    [P.alloy, bar([0, -0.03, 0.008], [0, -0.09, 0.07], 0.0075, 10)],
  ];
  for (const [material, geometry] of parts)
    kit.add(place(geometry, [0, 0, 0], [lean, 0, 0]), material);
}
/** Harrier throttle grip on its arm: a fat, forward-canted grip with a thumb shelf on its
 * inboard side carrying the speed-brake and mic switches; the nozzle lever stands inboard of it
 * (NATOPS: the nozzle control lever is inboard of the throttle). */
function harrierThrottle(kit) {
  const P = partPalette();
  kit.add(place(roundedBox([0.012, 0.065, 0.02], 0.003, 1), [0, 0.0325, 0]), P.alloy);
  kit.add(
    loftUp([
      { y: 0.055, points: contour(0, 0, 0.018, 0.024, 16, 2.6) },
      { y: 0.085, points: contour(-0.002, 0.008, 0.024, 0.032, 16, 2.4) },
      { y: 0.12, points: contour(-0.003, 0.018, 0.025, 0.034, 16, 2.4) },
      { y: 0.14, points: contour(-0.002, 0.024, 0.02, 0.028, 16, 2.4) },
      { y: 0.148, points: contour(-0.001, 0.024, 0.01, 0.014, 16, 2.2) },
    ]),
    P.grip,
  );
  kit.add(
    place(roundedBox([0.018, 0.01, 0.03], 0.003), [-0.024, 0.122, 0.012], [0, 0, -0.3]),
    P.grip,
  );
  for (const [x, z] of [
    [-0.026, 0.004],
    [-0.024, 0.022],
  ])
    kit.add(place(roundedBox([0.008, 0.007, 0.008], 0.002), [x, 0.13, z]), P.black);
  // AV-8B 164549 and up (NATOPS Figure 2-6): the round slew/designate control in a ring on the
  // grip's top, with the ECM dispense knob ahead of it.
  kit.add(
    lathe(
      [
        [0.0128, 0],
        [0.0128, 0.003],
        [0.0104, 0.0042],
        [0, 0.0042],
      ],
      16,
    ),
    P.black,
    [0, 0.1465, 0.024],
  );
  kit.add(place(new T.CylinderGeometry(0.0092, 0.0092, 0.003, 16), [0, 0.1497, 0.024]), P.alloy);
  kit.add(
    place(new T.CylinderGeometry(0.0032, 0.0036, 0.006, 10), [0.009, 0.1445, 0.036]),
    P.black,
  );
}
/** The nozzle control lever: a slim stalk to a black ball knob (NATOPS Figure 2-6; DCS AV-8B
 * N/A cockpit), standing in the slot of the raised nozzle quadrant. */
function harrierNozzleLever(kit) {
  const P = partPalette();
  kit.add(bar([0, 0.002, 0], [0, 0.103, 0.003], 0.0034, 12, 0.0029), P.alloy);
  kit.add(sphere(0.0135, [0, 0.114, 0.003], [1, 1.08, 1], 12, 8), P.black);
}
/** The raised nozzle quadrant inboard of the throttle: a band curved over the nozzle lever's
 * pivot (`zc`), `half` long either way and `rise` above the console face at `y`. Across it (`xs`,
 * ascending x): a plain strip, the lever slot, and the scale strip with the short-takeoff stop's
 * row of detent holes and the nozzle-angle ticks. */
function nozzleQuadrant(d, { xs, y, zc, half, rise, R = 0.3, n = 12, strip, scale, ticks }) {
  const A = Math.asin(half / R),
    yc = y + rise - R,
    at = (a, x, dy = 0) => [x, yc + R * Math.cos(a) + dy, zc + R * Math.sin(a)],
    base = (a, x) => [x, y, zc + R * Math.sin(a)];
  for (let k = 0; k < n; k++) {
    const a = -A + (2 * A * k) / n,
      b = -A + (2 * A * (k + 1)) / n;
    quad(d, at(a, xs[0]), at(a, xs[1]), at(b, xs[1]), at(b, xs[0]), strip, [0, 1, 0]);
    quad(d, at(a, xs[2]), at(a, xs[3]), at(b, xs[3]), at(b, xs[2]), scale, [0, 1, 0]);
    for (const [j, x] of xs.entries())
      quad(d, at(a, x), at(b, x), base(b, x), base(a, x), strip, [j % 2 ? 1 : -1, 0, 0]);
  }
  // The lever slot's floor, and the scale strip's holes and ticks.
  d.box([xs[2] - xs[1], 0.002, 2 * half], [(xs[1] + xs[2]) / 2, y + 0.001, zc], strip);
  for (let i = 0; i < 9; i++) {
    const a = -A * 0.82 + (1.64 * A * i) / 8;
    d.add(
      place(new T.CircleGeometry(0.0021, 8), at(a, xs[2] + 0.0075, 0.0004), [
        a - Math.PI / 2,
        0,
        0,
      ]),
      strip,
    );
    d.add(
      place(new T.BoxGeometry(0.007, 0.0012, 0.0006), at(a, xs[3] - 0.0075, 0.0004), [
        a - Math.PI / 2,
        0,
        0,
      ]),
      ticks,
    );
  }
  return (a, x) => ({ at: at(a, x), angle: a, A });
}
export const av8Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.66,
  cy: 1.85,
  ry: 0.83,
  cabinZ: 3.95,
  cabinWidth: 0.84,
  eye: [0, 3.02, 3.95],
  panelZ: 4.65,
  floor: 1.95,
});
function slopeWing(geometry) {
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.13 * (p.getZ(i) - 1.62));
  geometry.computeVertexNormals();
}
function fixedWing(d, stations, material) {
  const temp = new T.Group(),
    dd = detailKit(temp, 'temporary');
  wing(dd, stations, material);
  dd.finish();
  temp.traverse((m) => {
    if (m.isMesh) {
      slopeWing(m.geometry);
      d.add(m.geometry, material);
    }
  });
}
function hinge(root, name, stations, material, bindings, source, scale, sloped = false) {
  const point = (p) => [p[0], p[1] + (sloped ? 0.13 * (p[2] - 1.62) : 0), p[2]],
    a = point(stations[0]),
    b = point(stations.at(-1)),
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
      if (m.isMesh) {
        if (sloped) slopeWing(m.geometry);
        m.geometry.applyMatrix4(inv);
      }
    });
    g.add(n);
  }
  bindings.push({ node: name, source, property: 'rotation', axis: 'x', scale });
}
/** A superellipse section, [across, up] pairs: `n` 2 is an ellipse, about 3.4 a rounded
 * rectangle. Point 0 faces +across. */
function superellipse(halfAcross, halfUp, n, count = 24) {
  return Array.from({ length: count }, (_, j) => {
    const t = (j / count) * Math.PI * 2,
      c = Math.cos(t),
      s = Math.sin(t);
    return [
      halfAcross * Math.sign(c) * Math.abs(c) ** (2 / n),
      halfUp * Math.sign(s) * Math.abs(s) ** (2 / n),
    ];
  });
}
/** Quads between consecutive 3D rings of equal length, each ring closed on itself. */
function ringSkin(d, rings, material) {
  const count = rings[0].length,
    index = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < count; j++) {
      const a = i * count + j,
        b = i * count + ((j + 1) % count);
      index.push(a, a + count, b, b, a + count, b + count);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(rings.flat(2), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  d.add(geometry, material);
}
/**
 * One Pegasus vectoring nozzle inside its rotating group: the origin is on the bearing axis at
 * the fuselage wall and local -Z is the outlet at rest. A short round collar leaves the skin, a
 * 90 degree elbow eases from the round bearing to a rounded-rectangle outlet, and a straight lip
 * ends in the exit, which shows a dark duct and the turning vanes across it (close-up
 * photographs of the AV-8B and Harrier GR.9 nozzles). `half` is [across, up] at the outlet.
 */
function vectoringNozzle(g, side, { radius, half, bend, lip, vanes }, skin, duct, vane) {
  const nd = detailKit(g, g.name),
    collar = 0.05,
    ring = (centre, across, k, shrink = 1) => {
      const e = k * k * (3 - 2 * k);
      return superellipse(
        (radius + (half[0] - radius) * e) * shrink,
        (radius + (half[1] - radius) * e) * shrink,
        2 + 1.4 * e,
      ).map(([u, v]) => [
        side * (centre[0] + across[0] * u),
        centre[1] + v,
        centre[2] + across[2] * u,
      ]);
    },
    // The elbow's centreline: k 0 at the bearing, 1 where the outlet turns aft.
    at = (k, shrink) => {
      const a = (k * Math.PI) / 2;
      return ring(
        [collar + bend * Math.sin(a), 0, -bend * (1 - Math.cos(a))],
        [Math.sin(a), 0, Math.cos(a)],
        k,
        shrink,
      );
    },
    outlet = (l, shrink) => ring([collar + bend, 0, -bend - l], [1, 0, 0], 1, shrink),
    rings = [
      ring([-0.16, 0, 0], [0, 0, 1], 0),
      ...Array.from({ length: 9 }, (_, i) => at(i / 8)),
      outlet(lip / 2),
      outlet(lip),
    ];
  ringSkin(nd, rings, skin);
  // Bearing flange where the elbow leaves the skin, and the rolled outlet lip.
  outline(nd, ring([collar - 0.01, 0, 0], [0, 0, 1], 0, 1.05), 0.012, skin);
  ringSkin(nd, [outlet(lip), outlet(lip, 0.86)], skin);
  // The duct inside the lip, closed a short way up the elbow.
  const inner = [outlet(lip, 0.86), outlet(0, 0.86), at(0.75, 0.86), at(0.5, 0.86)];
  ringSkin(nd, inner, duct);
  sheet(nd, inner.at(-1), duct, [side * Math.SQRT1_2, 0, Math.SQRT1_2]);
  for (const v of vanes)
    nd.box(
      [half[0] * 1.72, 0.014, 0.17],
      [side * (collar + bend), v * half[1], -bend - lip + 0.1],
      vane,
    );
  nd.finish();
}
export function buildAV8B(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('AV8-gray', '#8c969d', { side: T.DoubleSide }),
    upper = mat('AV8-upper', '#727f89', { side: T.DoubleSide }),
    dark = mat('AV8-seals', '#283137', { side: T.DoubleSide }),
    metal = mat('AV8-alloy', '#a5afb3', { metalness: 0.75 }),
    // Bare hot-section metal: the rear nozzles and the heat shields behind them stay unpainted
    // under every finish (Harrier GR.9 and AV-8B close-ups); the front nozzles are painted.
    heat = mat('AV8-heat-shield', '#8a8780', {
      metalness: 0.3,
      roughness: 0.62,
      side: T.DoubleSide,
    }),
    hot = mat('AV8-hot-nozzle', '#8f897d', { metalness: 0.5, roughness: 0.45, side: T.DoubleSide }),
    duct = mat('AV8-nozzle-duct', '#3b3e3f', { side: T.DoubleSide }),
    rubber = mat('AV8-tires', '#171b1e'),
    glass = mat('AV8-glass', '#91a9b2', {
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'AV8-airframe'),
    bindings = [];
  // Raster positions are documented in reference-review.json. Widths are reconstructed
  // from the plan/front diagrams and independent oblique photograph.
  const ppm = 569 / 14.5542,
    sz = (u) => 7.2771 - (u - 144) / ppm,
    sy = (v) => (443 - v) / ppm;
  // Behind the wing the body droops toward the tail cone: on the 3-view and the side
  // photographs the fin stands about 2 m above the tail cone, with the 3.55 m height kept.
  const tailDrop = (z) => {
    const s = Math.min(1, Math.max(0, (-1.5 - z) / 5.8));
    return -0.28 * s * s * (3 - 2 * s);
  };
  // The APG-65 radome is a blunt, drooped ogive about 0.95m across at its base, its tip level
  // with the intake centres (head-on and side photographs); the forebody stays about 0.95m
  // wide back to the intakes (plan view), not a narrow raised wedge.
  const sections = [
    [144, 0.08, 368, 363],
    [174, 0.37, 377, 348.5],
    [204, 0.46, 380, 342],
    [235, 0.47, 378, 339],
    [255, 0.48, 382, 339],
    [290, 0.5, 387, 332],
    [330, 0.6, 394, 327],
    [380, 0.68, 399, 333],
    [450, 0.62, 406, 342],
    [510, 0.5, 407, 349],
    [570, 0.4, 406, 355],
    // The top line stays level under the fin root back to the tail cone (plan 3-view); it
    // used to fall away and leave the fin and rudder standing off the boom.
    [640, 0.3, 416, 359],
    [680, 0.16, 405, 362.5],
    [713, 0.03, 381, 368],
  ];
  // Behind the hot nozzles the body is a rounded tail tube that tapers into the round tail
  // cone, with a thin ventral fin below it (side, underside and tail photographs), not a tall
  // flat-sided oval with a hull keel. Raster column -> [upper half-width, lower half-width,
  // tube bottom y (m) and fin half-width where the ventral fin hangs below the tube]. The
  // side profile (b, t) is unchanged: b is the fin's lower edge there.
  const boom = {
    510: [0.52, 0.46],
    570: [0.45, 0.36],
    640: [0.36, 0.3, 1.3, 0.05],
    680: [0.25, 0.22, 1.52, 0.04],
    713: [0.15, 0.15],
  };
  const boomPoint = ([wu, wl, tube, fin], b, t, j) => {
    const bottom = tube ?? b,
      yc = (t + bottom) / 2,
      hh = (t - bottom) / 2;
    if (tube && j === 12) return [0, b];
    if (tube && j === 11) return [fin, bottom + hh * 0.01];
    const a = (j * Math.PI) / 12,
      s = (1 - Math.cos(a)) / 2;
    return [Math.pow(Math.sin(a), 0.75) * (wu + (wl - wu) * s * s), yc + Math.cos(a) * hh];
  };
  const rings = sections.map(([u, w, b, t]) => ({
    z: sz(u),
    points: Array.from({ length: 24 }, (_, j) => {
      if (boom[u]) {
        const [x, y] = boomPoint(boom[u], sy(b), sy(t), j > 12 ? 24 - j : j),
          keel = boom[u][2] && j === 12;
        return [j > 12 ? -x : x, y + (keel ? 0 : tailDrop(sz(u)))];
      }
      const a = (j * Math.PI) / 12;
      return [Math.sin(a) * w, sy((b + t) / 2) + (Math.cos(a) * (b - t)) / ppm / 2];
    }),
  }));
  loft(d, rings, paint, { skip: (i, j) => i < 2 || (i >= 2 && i < 6 && (j < 5 || j >= 19)) });
  // Pointed, slightly drooped tangent-ogive radome (Harrier II Plus photographs 05, 09, 12):
  // the section follows the ogive of the radome's own length and base radius, and its axis
  // bends down toward the 1.98 m tip, so the top line falls and the chin stays full.
  const [tip, , base] = rings,
    centre = (r) => (r.points[0][1] + r.points[12][1]) / 2,
    tipY = centre(tip),
    baseY = centre(base),
    L = tip.z - base.z,
    R = base.points[6][0],
    rho = (R * R + L * L) / (2 * R);
  loft(
    d,
    [0, 0.04, 0.1, 0.25, 0.45, 0.7, 1].map((f) => {
      const g = f ? (Math.sqrt(rho * rho - L * L * (1 - f) * (1 - f)) - (rho - R)) / R : 0.02,
        y = tipY + (baseY - tipY) * Math.sqrt(f);
      return {
        z: tip.z + (base.z - tip.z) * f,
        points: base.points.map(([x, py]) => [x * g, y + (py - baseY) * g]),
      };
    }),
    mat('AV8-radome', '#a0a6aa'),
  );
  for (const i of [2, 7, 9, 11])
    outline(
      d,
      rings[i].points.map(([x, y]) => [x * 1.007, y, rings[i].z]),
      0.0025,
      dark,
    );
  // Raised bubble: crown about 0.06 m higher than before (3-view canopy line).
  const canopy = [
    [5.74, 0.015, 2.58, 2.6],
    [5.25, 0.3, 2.6, 2.99],
    [4.46, 0.46, 2.61, 3.3],
    [3.8, 0.46, 2.78, 3.29],
    [3.1, 0.33, 2.94, 3.17],
    [2.6, 0.02, 2.96, 2.98],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      b + Math.sin((j * Math.PI) / 16) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  for (const i of [0, 2, 5])
    outline(
      d,
      cr[i].points.map((p) => [...p, cr[i].z]),
      i === 2 ? 0.03 : 0.016,
      paint,
      false,
    );
  for (const j of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[j], r.z]),
      0.022,
      paint,
      false,
    );
  // Close shell shoulders down to the cabin rails, leaving a true transparent opening.
  for (const side of [-1, 1]) {
    const railAt = (z) => {
      let i = 0;
      while (i < canopy.length - 2 && z < canopy[i + 1][0]) i++;
      const a = canopy[i],
        b = canopy[i + 1],
        t = Math.max(0, Math.min(1, (a[0] - z) / (a[0] - b[0])));
      return [side * (a[1] + (b[1] - a[1]) * t), a[2] + (b[2] - a[2]) * t, z];
    };
    // Split at the canopy rows as well as the body rings: the rail kinks at z 3.8 and 3.1, and
    // straight quads between ring stations left slits under the glass edge (seen from aft).
    const ringAt = (z, j) => {
      const k = Math.min(5, Math.max(2, rings.findIndex((r) => r.z < z) - 1)),
        a = rings[k],
        b = rings[k + 1],
        f = (a.z - z) / (a.z - b.z);
      return [
        a.points[j][0] + (b.points[j][0] - a.points[j][0]) * f,
        a.points[j][1] + (b.points[j][1] - a.points[j][1]) * f,
        z,
      ];
    };
    const zs = [
      ...new Set([
        ...rings.slice(2, 7).map((r) => r.z),
        ...canopy.map(([z]) => z).filter((z) => z < rings[2].z && z > rings[6].z),
      ]),
    ].sort((p, q) => q - p);
    for (let i = 0; i < zs.length - 1; i++) {
      const j = side === 1 ? 5 : 19;
      quad(d, ringAt(zs[i], j), ringAt(zs[i + 1], j), railAt(zs[i + 1]), railAt(zs[i]), paint, [
        side,
        1,
        0,
      ]);
    }
    for (let i = 0; i < canopy.length - 1; i++)
      for (let j = 0; j < 7; j++) {
        const a = canopy[i],
          b = canopy[i + 1],
          t = j / 7;
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t),
          a[2] + (b[2] - a[2]) * t + 0.018,
          a[0] + (b[0] - a[0]) * t,
        ]);
      }
  }
  // The shoulders meet 4 cm apart behind the glass (z 2.52-2.6): close that slit, and glaze the
  // canopy's small aft arch, so neither shows the cockpit from above.
  const tail = canopy.at(-1);
  quad(
    d,
    [tail[1], tail[2], tail[0]],
    [tail[1], tail[2], rings[6].z],
    [-tail[1], tail[2], rings[6].z],
    [-tail[1], tail[2], tail[0]],
    paint,
    [0, 1, 0],
  );
  sheet(
    d,
    cr.at(-1).points.map((p) => [...p, cr.at(-1).z]),
    glass,
    [0, 0, -1],
  );
  // FLIR fairing above the long radar nose; no sensor or targeting behavior.
  const sensor = [
    [0.12, 2.66, 5.73],
    [0.12, 2.62, 6.33],
    [-0.12, 2.62, 6.33],
    [-0.12, 2.66, 5.73],
  ];
  sheet(d, sensor, upper, [0, 1, 0]);
  d.box([0.22, 0.12, 0.06], [0, 2.56, 6.33], dark);
  for (const side of [-1, 1])
    quad(
      d,
      [side * 0.12, 2.66, 5.73],
      [side * 0.12, 2.62, 6.33],
      [side * 0.12, 2.4, 6.33],
      [side * 0.12, 2.5, 5.73],
      paint,
      [side, 0, 0],
    );
  // Large side intakes, open ducts and auxiliary intake-door recesses.
  for (const side of [-1, 1]) {
    const shape = Array.from({ length: 24 }, (_, j) => {
      const a = (j * Math.PI) / 12;
      // Lip height about 1.4m (head-on photograph and side view), width 0.48m outboard.
      return [side * Math.max(0.53, 0.7 + Math.sin(a) * 0.48), 1.93 + Math.cos(a) * 0.7];
    });
    // The cowl keeps swelling behind the lip and only then fairs back, so each intake reads
    // as a round ear rather than a flat-sided box (head-on and 3/4 photographs).
    const first = d.root.children.length,
      scarf = (x) => 0.26 * Math.min(1, Math.max(0, (Math.abs(x) - 0.53) / 0.65));
    const outer = [
      { z: 3.7, points: shape },
      { z: 3.48, points: shape.map(([x, y]) => [x * 1.025, y]) },
      { z: 2.7, points: shape.map(([x, y]) => [x * 1.0, 1.92 + (y - 1.93) * 0.95]) },
      { z: 0.9, points: shape.map(([x, y]) => [x * 0.76, 1.85 + (y - 1.93) * 0.7]) },
      // Aft of the front nozzles the cowl fairs into the body side by the rear nozzles (it
      // used to stop open at z 0.9 under a large fixed pod).
      { z: 0.25, points: shape.map(([x, y]) => [x * 0.65, 1.82 + (y - 1.93) * 0.6]) },
      { z: -0.45, points: shape.map(([x, y]) => [x * 0.54, 1.8 + (y - 1.93) * 0.5]) },
    ];
    loft(d, outer, paint, { caps: false });
    // Thick rolled lip around the mouth.
    outline(
      d,
      shape.map(([x, y]) => [x + side * 0.012, y, 3.7]),
      0.032,
      paint,
    );
    const inside = shape.map(([x, y]) => [
      side * 0.7 + (x - side * 0.7) * 0.88,
      1.93 + (y - 1.93) * 0.88,
    ]);
    // The duct curves outboard of the fuselage skin toward the fan face, so the mouth reads as
    // one dark D from the 3/4 views instead of showing the grey body side inside it.
    const fanFace = inside.map(([x, y]) => [
      side * 0.8 + (x - side * 0.7) * 0.7,
      1.93 + (y - 1.93) * 0.85,
    ]);
    loft(
      d,
      [
        { z: 3.702, points: inside },
        { z: 2.3, points: fanFace },
      ],
      dark,
      { caps: false },
    );
    for (let j = 0; j < 24; j++)
      quad(
        d,
        [...shape[j], 3.7],
        [...shape[(j + 1) % 24], 3.7],
        [...inside[(j + 1) % 24], 3.705],
        [...inside[j], 3.705],
        paint,
        [0, 0, 1],
      );
    // Scarfed mouth: the outer lip sits about 0.26 m aft of the inner one, so the opening
    // faces forward and outboard and stays visible from 3/4 views (photographs 09, 12).
    for (const mesh of d.root.children.slice(first)) {
      const p = mesh.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i);
        if (z > 2.7) p.setZ(i, z - scarf(p.getX(i)) * Math.min(1, z - 2.7));
      }
      p.needsUpdate = true;
    }
    sheet(
      d,
      fanFace.map((p) => [...p, 2.3]),
      rubber,
      [0, 0, 1],
    );
    // Auxiliary inlet doors round the outboard face of the cowl, on its lofted skin at z 3.22
    // (x scaled 1.017 and y 0.983 there) and square to its normal. The old ring sat 1-2 cm
    // inside the skin and ran onto the flat inboard wall, so it showed as dark corner slivers.
    for (let j = 0; j < 8; j++) {
      const a = -1.0 + j * 0.35,
        x = side * (0.712 + Math.cos(a) * 0.488),
        y = 1.9267 + Math.sin(a) * 0.6883,
        normal = Math.atan2(Math.sin(a) / 0.6883, Math.cos(a) / 0.488);
      const g = group(root, `AV8-inlet-door-${side}-${j}`, [x, y, 3.22 - scarf(x) * 0.52]),
        dd = detailKit(g, g.name);
      g.rotation.z = side * (normal - Math.PI / 2);
      dd.box([0.15, 0.006, 0.22], [0, 0.002, 0], dark);
      dd.box([0.13, 0.008, 0.16], [0, 0.006, -0.035], paint);
      dd.finish();
    }
    // The four Pegasus nozzles sit on the engine, front (fan air, painted) and rear (hot, bare
    // metal) bearings about 1.9 m apart, as on the engine (museum Pegasus 11 and 103
    // photographs). Each outlet is a compact rounded rectangle tucked against the body:
    // front 0.50 m tall by 0.36 m across, its outer face about 0.2 m outboard of the intake
    // cowl; rear 0.42 by 0.30 m under the flap (side, head-on and close-up photographs).
    // Earlier they were long round pipes 0.5 m out from the skin with black exits, and the
    // rear pair stood 3.1 m behind the front pair.
    const fairing = [
      // z, across and up scale of the pod section (its inboard edge stays inside the cowl)
      [2.66, 0.18, 0.3],
      [2.5, 0.58, 0.64],
      [2.32, 0.88, 0.92],
      [2.16, 1, 1],
      [1.52, 1, 1],
      [1.44, 0.95, 0.95],
      [1.39, 0.78, 0.84],
      [1.365, 0.45, 0.55],
      [1.358, 0.08, 0.12],
    ];
    // Fixed pod ahead of each front nozzle (it carries the national insignia), ending just
    // ahead of the bearing so the elbow swings clear of it.
    ringSkin(
      d,
      fairing.map(([z, fa, fu]) =>
        superellipse(0.27, 0.22, 2.5).map(([u, v]) => [
          side * (0.74 + fa * (0.27 + u)),
          1.72 + fu * v,
          z,
        ]),
      ),
      paint,
    );
    for (const [i, x, y, z, shape, skin] of [
      [
        0,
        0.87,
        1.68,
        1.13,
        { radius: 0.25, half: [0.18, 0.25], bend: 0.27, lip: 0.2, vanes: [-0.34, 0.34] },
        paint,
      ],
      [
        1,
        0.6,
        1.62,
        -0.77,
        { radius: 0.21, half: [0.15, 0.21], bend: 0.22, lip: 0.14, vanes: [0] },
        hot,
      ],
    ]) {
      const g = group(root, `AV8-nozzle-${side}-${i}`, [side * x, y, z]);
      vectoringNozzle(g, side, shape, skin, duct, i ? hot : metal);
      bindings.push({
        node: g.name,
        source: 'thrustVector',
        property: 'rotation',
        axis: 'x',
        scale: -Math.PI / 2,
      });
    }
    // Bare heat shield on the body side and belly behind each rear nozzle, along the jet: the
    // lofted skin's own columns (j 6-10, side to lower quarter), 6 mm proud of it.
    const bodyAt = (z, j) => {
      const k = Math.min(rings.length - 2, Math.max(0, rings.findIndex((r) => r.z < z) - 1)),
        a = rings[k],
        b = rings[k + 1],
        f = (a.z - z) / (a.z - b.z),
        lerp = (n, q) => a.points[q][n] + (b.points[q][n] - a.points[q][n]) * f,
        q = side === 1 ? j : 24 - j,
        x = lerp(0, q),
        y = lerp(1, q),
        cy = (lerp(1, 0) + lerp(1, 12)) / 2,
        len = Math.hypot(x, y - cy);
      return [x + (x / len) * 0.006, y + ((y - cy) / len) * 0.006, z];
    };
    const shield = [-1.0, -1.32, -1.68, -2.0, -2.25].map((z) =>
      [6, 7, 8, 9, 10].map((j) => bodyAt(z, j)),
    );
    for (let i = 0; i < shield.length - 1; i++)
      for (let j = 0; j < 4; j++)
        quad(d, shield[i][j], shield[i + 1][j], shield[i + 1][j + 1], shield[i][j + 1], heat, [
          side,
          -0.5,
          0,
        ]);
    // Broad anhedral wing with a rounded tip and distinct inboard flap/outboard aileron.
    const ws = [
      [0.45, 2.78, 1.62, -1.92, 0.14],
      [1.2, 2.63, 1.48, -1.98, 0.13],
      [2.75, 2.33, 0.35, -2.0, 0.09],
      [4.35, 2.02, -0.86, -2.28, 0.06],
      [4.62, 1.97, -1.25, -2.29, 0.045],
    ];
    fixedWing(
      d,
      ws.map(([x, y, l, t, h]) => [side * x, y, l, l + (t - l) * 0.72, h]),
      upper,
    );
    for (const [j, a, b, source] of [
      [0, 0, 2, 'flapPosition'],
      [1, 2, 4, 'rollInput'],
    ]) {
      const part = ws
        .slice(a, b + 1)
        .map(([x, y, l, t, h]) => [side * x, y, l + (t - l) * 0.72, t, h * 0.45]);
      hinge(
        root,
        `AV8-${j ? 'aileron' : 'flap'}-${side}`,
        part,
        paint,
        bindings,
        source,
        j ? -0.3 : -side * 0.65,
        true,
      );
    }
    for (let i = 0; i < ws.length - 1; i++) {
      const a = ws[i],
        b = ws[i + 1];
      for (const f of [0.28, 0.58]) {
        const za = a[2] + (a[3] - a[2]) * f,
          zb = b[2] + (b[3] - b[2]) * f;
        d.rod(
          [side * a[0], a[1] + a[4] + 0.003 + 0.13 * (za - 1.62), za],
          [side * b[0], b[1] + b[4] + 0.003 + 0.13 * (zb - 1.62), zb],
          0.002,
          dark,
        );
      }
    }
    // LERX upper shoulder, with the intake opening kept clear.
    wing(
      d,
      [
        [side * 0.48, 2.8, 3.3, 1.62, 0.06],
        [side * 0.92, 2.74, 3.2, 1.54, 0.06],
        [side * 1.18, 2.66, 2.64, 1.46, 0.05],
      ],
      upper,
    );
    // The stabilator root rides down with the drooping tail; the hinge follows its stations.
    const tails = [
      [side * 0.22, 2.02, -4.5, -6.24, 0.07],
      [side * 1.96, 1.48, -6.08, -6.72, 0.05],
      [side * 2.123, 1.43, -6.28, -6.76, 0.03],
    ].map(([x, y, a, b, h]) => [x, y + tailDrop(-5.4), a, b, h]);
    hinge(root, `AV8-stabilator-${side}`, tails, paint, bindings, 'pitchInput', side * 0.3);
    // Clean underside lift-improvement strakes, without optional gun pods or stores.
    const strake = [
      [side * 0.4, 1.1, 2.1],
      [side * 0.4, 0.6, 1.0],
      [side * 0.4, 0.55, -1.55],
      [side * 0.4, 0.91, -2.3],
    ];
    sheet(d, strake, paint, [side, 0, 0]);
    outline(d, strake, 0.012, paint);
    // Operator titles (MARINES, ARMADA, MARINA) are livery markings, not geometry.
    d.text('RESCUE', [side * 0.43, 2.3, 4.4], 0.065, (side * Math.PI) / 2, dark);
    for (const z of [4.3, 4.9]) d.box([0.009, 0.03, 0.29], [side * 0.4, 1.91, z], dark);
    d.add(
      new T.SphereGeometry(0.025, 8, 4),
      mat(`AV8-nav-${side}`, side === 1 ? '#b93939' : '#3d986f', {
        emissive: side === 1 ? '#641b1b' : '#1b5c38',
      }),
      [side * 4.62, 1.54, -1.7],
    );
  }
  // Single fin, with finite-thickness surfaces and a separately hinged rudder. A low dorsal
  // fillet runs into a leading edge swept about 50 deg (3-view), and the tip stays at 3.55 m
  // while the root follows the drooping tail, so the fin stands taller above the body.
  const fin = [
    [0, 2.3 + tailDrop(-3.55), -3.55],
    [0, 2.31 + tailDrop(-4.85), -4.85],
    [0, 2.56 + tailDrop(-5.15), -5.15],
    [0, 3.47, -6.42],
    [0, 3.55, -6.6],
    [0, 3.55, -6.91],
    [0, 2.03 + tailDrop(-6.57), -6.57],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * 0.045, p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-0.045, a[1], a[2]],
      [0.045, a[1], a[2]],
      [0.045, b[1], b[2]],
      [-0.045, b[1], b[2]],
      paint,
      [0, a[1] - 2, a[2] + 5],
    );
  }
  const rudder = group(root, 'AV8-rudder', [0, 2.05, -6.58]),
    rd = detailKit(rudder, rudder.name);
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.036, 0, 0],
        [side * 0.036, 1.5, -0.33],
        [side * 0.036, 1.48, -0.48],
        [side * 0.036, 0, -0.18],
      ],
      upper,
      [side, 0, 0],
    );
  rd.rod([0, 0, -0.17], [0, 1.48, -0.47], 0.025, upper);
  rd.finish();
  bindings.push({
    node: rudder.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.38,
  });
  // Bicycle gear: single nose wheel, paired main wheels and two wing outriggers.
  for (const [name, x, z, r] of [
    ['nose', 0, 2.65, 0.35],
    ['main', 0, -0.831, 0.365],
    ['left', 2.591, -1.517, 0.18],
    ['right', -2.591, -1.517, 0.18],
  ]) {
    const g = group(root, `AV8-gear-${name}`),
      gd = detailKit(g, g.name),
      h = x === 0 ? 1.32 : 1.74;
    gd.rod([x, h, z + 0.19], [x, r, z], x === 0 ? 0.05 : 0.029, metal);
    gd.rod([x, h - 0.15, z + 0.48], [x, r + 0.13, z], 0.024, metal);
    for (const dx of name === 'main' ? [-0.21, 0.21] : [0]) {
      gd.add(new T.CylinderGeometry(r, r, 0.17, 24).rotateZ(Math.PI / 2), rubber, [x + dx, r, z]);
      for (const side of [-1, 1])
        gd.add(new T.CylinderGeometry(r * 0.55, r * 0.55, 0.018, 20).rotateZ(Math.PI / 2), metal, [
          x + dx + side * 0.09,
          r,
          z,
        ]);
    }
    if (x !== 0) {
      ellipsoid(d, [x, 1.76, z + 0.2], [0.13, 0.14, 0.64], paint, 16);
      gd.box([0.025, 0.52, 0.23], [x + 0.1, 1.35, z + 0.06], paint);
    } else gd.box([0.025, 0.45, 0.55], [0.2, 0.95, z + 0.12], paint);
    gd.finish();
    bindings.push(
      { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -0.9, offset: 0.9 },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  // Rounded tail-cone bullet (pitch/yaw reaction-control housing) closing the boom.
  ellipsoid(d, [0, 1.75 + tailDrop(-7.2), -7.2], [0.15, 0.17, 0.12], paint, 16);
  // Spine vents and access lines are geometric, not photograph textures.
  for (let j = 0; j < 7; j++)
    d.box([0.29, 0.012, 0.035], [0, 2.23 + tailDrop(-3.8), -3.6 - j * 0.07], dark);
  for (const z of [-0.3, -3.5])
    sheet(
      d,
      [
        [0, 2.46 + tailDrop(z), z],
        [0, 2.71 + tailDrop(z), z - 0.04],
        [0, 2.65 + tailDrop(z), z - 0.22],
        [0, 2.4 + tailDrop(z), z - 0.28],
      ],
      upper,
      [1, 0, 0],
    );
  d.finish();
  const { stations: controlStations, ...interior } = av8Cockpit(root, {
    paint,
    dark,
    metal,
    glass,
  });
  cleanGeometry(root);
  return {
    root,
    frame: { ...av8Frame(), controlStations },
    enginePoints: [{ id: 'engine-1', position: [0, 1.68, -1.94] }],
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

function av8Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'AV8-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'AV8'),
    { bindings, derived, ink, black, amber } = ins,
    // Medium grey structure and console sides under black sub-panels (AV-8B+ photographs: Flickr
    // 1346172320, Spanish Navy BUNO 165033, and 6761992205).
    panel = mat('AV8-panel', '#7b8387', { side: T.DoubleSide }),
    seat = mat('AV8-upholstery', '#686b50'),
    belt = mat('AV8-harness', '#a5aa96'),
    green = mat('AV8-display', '#79d38d', { emissive: '#295e37', emissiveIntensity: 0.7 });
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'gearPosition',
      'flapPosition',
      'thrustVectorPosition',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear', thrustVectorPosition: 'thrustVector' }[k] ??
        k,
      { component: 'aircraftState', path: [k] },
    ]),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
  sources.engine1 = { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] };
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
    headingDegrees: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    nozzleDegrees: { op: 'multiply', args: ['thrustVector', 90] },
    rpmPercent: { op: 'multiply', args: ['engine1', 100] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
  });
  // FO-1 crop coordinates, uniform estimated panel width. Absolute panel dimensions
  // are not provided by this foldout; see the stated limitation in its review.
  const k = 0.00094,
    z = 4.65,
    at = (u, v, dz = 0) => [(535 - u) * k, 2.4 + (400 - v) * k, z + dz];
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
      d.box([w * k, h * k, depth], at(u, v, -0.012 - depth / 2), material),
    text = (t, u, v, h = 8, material = ink, role = 'panel') =>
      d.text(t, at(u, v, -0.033), h * k, Math.PI, material, role);
  const edge = [
    [125, 400],
    [125, 280],
    [145, 155],
    [210, 60],
    [290, 20],
    [400, 9],
    [650, 9],
    [760, 20],
    [840, 65],
    [905, 155],
    [945, 280],
    [945, 418],
    [922, 418],
    [922, 534],
    [642, 534],
    [642, 922],
    [422, 922],
    [422, 536],
    [143, 536],
    [143, 418],
  ];
  sheet(
    d,
    edge.map((p) => at(...p)),
    panel,
    [0, 0, -1],
    [circle(570, 396, 38), rect(285, 256, 122, 92)],
  );
  outline(
    d,
    edge.map((p) => at(...p, -0.004)),
    0.006,
    black,
  );
  const arc = edge.slice(1, 13);
  for (let j = 0; j < arc.length - 1; j++) {
    const a = at(...arc[j]),
      b = at(...arc[j + 1]);
    quad(
      d,
      a,
      b,
      [b[0] * 0.78, b[1] - 0.02, z + 0.23],
      [a[0] * 0.78, a[1] - 0.02, z + 0.23],
      black,
      [0, 1, 0],
    );
  }
  function screen(u, v, w, h, hole = false) {
    sheet(
      d,
      rect(u, v, w, h, -0.008),
      black,
      [0, 0, -1],
      hole ? [rect(u, v - 3, 122, 92, -0.008)] : [],
    );
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        box(u + side * (w / 2 - 11), v - h * 0.33 + j * h * 0.132, 13, 17, panel);
        box(u - w * 0.33 + j * w * 0.132, v + side * (h / 2 - 11), 17, 13, panel);
      }
  }
  screen(285, 259, 220, 226, true);
  screen(778, 264, 223, 226);
  ins.horizon('MPCD-attitude', at(285, 256, 0.012), 122 * k, 92 * k, { blankBackdrop: true });
  ins.readout('MPCD-speed', at(246, 331, -0.034), 'knots', 3, 0.012, green);
  text('TAS', 246, 315, 7, green, 'display');
  ins.readout('MPCD-altitude', at(330, 331, -0.034), 'feet', 5, 0.009, green, true, true);
  text('GEO FT', 330, 315, 7, green, 'display');
  text('SIM ATT', 285, 176, 8, green, 'display');
  // A true-heading rose occupies the second MPCD; no invented map or radar picture.
  const hg = group(cabin, 'AV8-heading', at(778, 256, -0.03)),
    hd = detailKit(hg, hg.name);
  for (let j = 0; j < 72; j++) {
    const a = (j * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(j % 6 ? 0.065 : 0.06), p(0.07), 0.00065, green);
    if (j % 6 === 0)
      hd.text(
        j === 0 ? 'N' : j === 18 ? 'E' : j === 36 ? 'S' : j === 54 ? 'W' : String(j / 2),
        p(0.049),
        0.008,
        Math.PI,
        green,
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
  ins.available('heading', 'trueHeading', hg.name);
  d.rod(at(778, 175, -0.031), at(778, 187, -0.031), 0.001, ink);
  text('TRUE / SIM', 778, 340, 8, green, 'display');
  ins.horizon('standby', at(570, 396, 0.012), 0.071, 0.071, { round: true, blankBackdrop: true });
  ins.dial(
    'speed',
    at(472, 420, -0.01),
    37 * k,
    'knots',
    [
      [0, 0],
      [100, 0.75],
      [200, 1.7],
      [300, 2.65],
      [400, 3.6],
      [600, 5.5],
    ],
    [0, 100, 200, 300, 400, 600],
    'TAS',
    { tickLabels: { 0: 0, 100: 1, 200: 2, 300: 3, 400: 4, 600: 6 }, minorStep: 20 },
  );
  ins.altimeter('altimeter', at(570, 506, -0.01), 37 * k, 'feet');
  // Actual VVI is offset to the right; standby AOA has no compatible calibrated sensor.
  ins.dial(
    'vertical-speed',
    at(675, 480, -0.01),
    36 * k,
    'verticalFpm',
    [
      [-6000, -Math.PI / 2],
      [0, Math.PI / 2],
      [6000, Math.PI * 1.5],
    ],
    [-6000, -4000, -2000, 0, 2000, 4000, 6000],
    'FPM',
    { tickLabels: { '-6000': -6, '-4000': -4, '-2000': -2, 0: 0, 2000: 2, 4000: 4, 6000: 6 } },
  );
  pt.gauge(...at(472, 506).slice(0, 2), z - 0.01, 36 * k, black, false);
  text('AOA', 472, 496, 7);
  text('--', 472, 516, 9, amber, 'display');
  // UFC, ODU, HUD controls and the distinct upper-right engine display.
  box(535, 121, 184, 198);
  box(535, 42, 108, 18, panel);
  text('----', 535, 42, 10, green, 'display');
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 4; col++) {
      const u = 495 + col * 25,
        v = 74 + row * 25;
      box(u, v, 19, 19, panel);
      text(
        [
          '1',
          '2',
          '3',
          'BRT',
          '4',
          '5',
          '6',
          'VOL',
          '7',
          '8',
          '9',
          'ALT',
          'CLR',
          '0',
          'ENT',
          'ON',
          'COM1',
          'TCN',
          'AWL',
          'COM2',
        ][row * 4 + col],
        u,
        v,
        row === 4 ? 4 : 6,
      );
    }
  for (let row = 0; row < 5; row++) {
    box(417, 60 + row * 31, 28, 24, black);
    text('--', 417, 60 + row * 31, 8, green, 'display');
  }
  box(533, 267, 185, 48);
  for (let j = 0; j < 6; j++) {
    const u = 457 + j * 30;
    d.add(
      new T.CylinderGeometry(0.006, 0.007, 0.012, 10).rotateX(Math.PI / 2),
      panel,
      at(u, 265, -0.031),
    );
    text(['BRT', 'SYM', 'ATT', 'VIDEO', 'ALT', 'BRT'][j], u, 281, 5);
  }
  sheet(
    d,
    [
      [686, 25],
      [767, 25],
      [824, 48],
      [855, 83],
      [864, 127],
      [686, 127],
    ].map((p) => at(...p, -0.018)),
    black,
    [0, 0, -1],
  );
  text('ENGINE', 771, 34, 9);
  for (const [u, v, label] of [
    [731, 60, 'RPM NORM'],
    [810, 60, 'NOZ DEG'],
    [731, 98, 'JPT --'],
    [810, 98, 'OIL --'],
  ])
    text(label, u, v, 6);
  ins.readout('rpm', at(731, 78, -0.034), 'rpmPercent', 3, 0.011, green, false, true);
  ins.readout(
    'nozzle-indicator',
    at(810, 78, -0.034),
    'nozzleDegrees',
    2,
    0.011,
    green,
    false,
    true,
  );
  box(812, 479, 192, 84);
  text('FUEL', 812, 452, 8);
  text('-----', 798, 480, 12, amber, 'display');
  // Over the left MPCD the padded coaming comes down close to its top (AV-8B+ photographs),
  // leaving a narrow band with the display day/night switch and brightness knob.
  sheet(
    d,
    [
      [150, 120],
      [176, 82],
      [212, 58],
      [292, 19],
      [398, 9],
      [398, 120],
    ].map((p) => at(...p, -0.03)),
    black,
    [0, 0, -1],
  );
  d.add(bar(at(152, 120, -0.03), at(398, 120, -0.03), 0.0045, 12), black);
  for (const [u, label] of [
    [215, 'DAY'],
    [262, 'BRT'],
  ]) {
    d.add(
      new T.CylinderGeometry(0.0055, 0.0065, 0.01, 12).rotateX(Math.PI / 2),
      black,
      at(u, 134, -0.022),
    );
    text(label, u + 22, 134, 5);
  }
  // Left of the MPCD: master-mode buttons, a guarded button under a striped guard and the
  // MASTER ARM plate with its bat toggle, all on the yellow-and-black hatching at its foot.
  const AP = partPalette(),
    stripes = (u, v, w, h, n = 3, dz = -0.026) => {
      const len = Math.min(w, h) * 0.95,
        tall = h > w;
      for (let j = 0; j < n; j++) {
        const off = (j - (n - 1) / 2) * ((tall ? h : w) / n);
        d.add(
          place(
            new T.BoxGeometry(len * k * 0.2, len * k, 0.002),
            at(u + (tall ? 0 : off), v + (tall ? off : 0), dz),
            [0, 0, 0.75],
          ),
          black,
        );
      }
    };
  for (const v of [190, 222]) box(158, v, 22, 22, panel, 0.008);
  text('TOL', 158, 172, 5);
  box(158, 262, 28, 28, AP.yellow, 0.01);
  stripes(158, 262, 22, 20, 3, -0.0225);
  box(158, 318, 30, 62, AP.yellow, 0.006);
  stripes(158, 318, 26, 56, 4, -0.0185);
  text('MASTER ARM', 158, 300, 4);
  d.add(bar(at(158, 336, -0.02), at(158, 330, -0.042), 0.0028, 12), m.metal);
  // Armament control panel under the left MPCD (AV-8B+ photographs): MODE, FUZ, QTY, MULT and
  // INTV windows, a row of seven bat toggles, eight round station buttons, the grey rotary at the
  // top right and the red jettison button at the lower left.
  box(280, 475, 273, 106);
  for (const [j, label] of ['MODE', 'FUZ', 'QTY', 'MULT', 'INTV'].entries()) {
    box(178 + j * 44, 442, 30, 12, panel, 0.004);
    text(label, 178 + j * 44, 431, 5);
  }
  d.add(
    new T.CylinderGeometry(0.011, 0.012, 0.012, 14).rotateX(Math.PI / 2),
    m.metal,
    at(390, 444, -0.03),
  );
  for (let j = 0; j < 7; j++) {
    const u = 190 + j * 30;
    d.add(
      new T.CylinderGeometry(0.0055, 0.0055, 0.004, 12).rotateX(Math.PI / 2),
      m.metal,
      at(u, 470, -0.026),
    );
    d.add(bar(at(u, 470, -0.026), at(u, 464, -0.046), 0.0024, 12), m.metal);
  }
  for (let j = 0; j < 8; j++)
    d.add(
      new T.CylinderGeometry(0.0055, 0.0055, 0.006, 14).rotateX(Math.PI / 2),
      j % 7 ? black : panel,
      at(185 + j * 28, 503, -0.027),
    );
  d.add(
    new T.CylinderGeometry(0.0075, 0.0075, 0.008, 14).rotateX(Math.PI / 2),
    AP.red,
    at(158, 505, -0.028),
  );
  // Center pedestal (NATOPS FO-2, AV-8B 163853 and up): the FLIR switch; the miscellaneous
  // switch panel with the INS mode knob and the VRS, MPCD, DMT, DP, probe heat and MC switches;
  // the bureau number plate; the circuit breaker panel below.
  box(534, 703, 195, 270);
  for (const [u, v, label] of [
    [481, 653, 'FLIR'],
    [542, 645, 'VRS'],
    [568, 645, 'MPCD'],
    [542, 679, 'DMT'],
    [568, 679, 'DP'],
    [542, 717, 'PRB HT'],
    [568, 717, 'MC'],
  ]) {
    d.add(bar(at(u, v, -0.024), at(u, v - 6, -0.042), 0.0024, 10, 0.0017), m.metal);
    text(label, u, v - 16, 5);
  }
  d.add(
    new T.CylinderGeometry(0.013, 0.011, 0.014, 16).rotateX(Math.PI / 2),
    panel,
    at(493, 700, -0.031),
  );
  d.box([0.0016, 0.011, 0.002], at(493, 694, -0.0385), AP.white);
  text('INS', 493, 678, 6);
  d.box([28 * k, 50 * k, 0.003], at(610, 649, -0.0255), panel);
  text('BUNO', 610, 640, 4, black);
  for (const [u, v, label] of [
    [478, 766, 'AIL'],
    [504, 766, 'STAB'],
    [532, 766, 'RUD'],
    [559, 766, 'FLAPS'],
    [478, 792, 'SP BR'],
    [505, 792, 'LG'],
    [533, 792, 'PROBE'],
  ]) {
    d.add(
      new T.CylinderGeometry(0.0045, 0.0045, 0.006, 8).rotateX(Math.PI / 2),
      panel,
      at(u, v, -0.027),
    );
    text(label, u, v - 10, 4);
  }
  box(872, 667, 103, 231);
  for (let row = 0; row < 12; row++)
    for (let col = 0; col < 2; col++) {
      box(847 + col * 51, 568 + row * 17, 45, 12, panel);
      text('--', 847 + col * 51, 568 + row * 17, 4, ink, 'display');
    }
  // Lower side panels, distinct from the center pedestal: the black lower left panel beside the
  // stick (AV-8B+ photograph, Flickr 1346172320: EMER JETT, FLAPS, ANTISKID and the gear handle
  // at its foot), V/STOL/radio-altimeter controls right.
  for (const [edge, label, u, v, face = panel] of [
    [
      [
        [140, 560],
        [370, 560],
        [370, 905],
        [140, 905],
      ],
      '',
      0,
      0,
      black,
    ],
    [
      [
        [662, 780],
        [826, 780],
        [826, 918],
        [662, 918],
      ],
      'V/STOL',
      742,
      796,
    ],
    [
      [
        [833, 551],
        [925, 551],
        [925, 790],
        [833, 790],
      ],
      'CAUTION',
      892,
      562,
    ],
  ]) {
    sheet(
      d,
      edge.map((p) => at(...p, -0.006)),
      face,
      [0, 0, -1],
    );
    outline(
      d,
      edge.map((p) => at(...p, -0.008)),
      0.003,
      face === black ? panel : black,
    );
    if (label) text(label, u, v, 6);
  }
  // EMER JETT: the big yellow button in its striped square bezel.
  box(180, 612, 56, 56, AP.yellow, 0.006);
  stripes(180, 612, 50, 50, 4, -0.0185);
  d.add(
    new T.CylinderGeometry(0.019, 0.019, 0.01, 20).rotateX(Math.PI / 2),
    AP.yellow,
    at(180, 612, -0.026),
  );
  stripes(180, 612, 26, 26, 3, -0.0315);
  text('EMER JETT', 180, 575, 5);
  // FLAPS: the mode switch (a station, below) and its second switch.
  text('FLAPS', 272, 578, 6);
  for (const [label, v] of [
    ['CRUISE', 598],
    ['AUTO', 614],
    ['STOL', 630],
  ])
    text(label, 312, v, 4);
  d.add(
    new T.CylinderGeometry(0.006, 0.007, 0.008, 12).rotateX(Math.PI / 2),
    black,
    at(272, 680, -0.024),
  );
  d.add(bar(at(272, 680, -0.026), at(272, 674, -0.045), 0.0024, 12), m.metal);
  // The emergency gear placard over the handle, LDG GEAR lettered down its edge.
  box(268, 772, 44, 40, AP.yellow, 0.004);
  stripes(268, 772, 38, 34, 3, -0.0165);
  text('LDG GEAR', 312, 790, 6).rotation.z = -Math.PI / 2;
  // ANTISKID switch.
  d.add(
    new T.CylinderGeometry(0.006, 0.007, 0.008, 12).rotateX(Math.PI / 2),
    black,
    at(160, 850, -0.024),
  );
  d.add(bar(at(160, 850, -0.026), at(160, 844, -0.045), 0.0024, 12), m.metal);
  text('ANTISKID', 160, 830, 4);
  pt.gauge(...at(164, 767).slice(0, 2), z - 0.012, 27 * k, black, false);
  text('FLAPS', 164, 750, 5);
  ins.pointer('flap-indicator', at(164, 767, -0.032), 20 * k, 'flapPosition', [
    [0, -1.8],
    [1, 1.8],
  ]);
  for (const [u, v] of [
    [741, 830],
    [792, 830],
    [741, 885],
  ]) {
    d.add(
      new T.CylinderGeometry(0.008, 0.009, 0.012, 10).rotateX(Math.PI / 2),
      black,
      at(u, v, -0.03),
    );
    d.rod(at(u, v - 3, -0.04), at(u, v + 3, -0.04), 0.001, ink);
  }
  box(211, 868, 16, 56, AP.black, 0.006);
  // The gear handle: a stem out of its gate to the large light grey wheel-shaped knob.
  const gearLever = group(cabin, 'AV8-gear-lever', at(211, 874, -0.055)),
    gld = detailKit(gearLever, gearLever.name);
  gld.add(
    place(new T.CylinderGeometry(0.0045, 0.0045, 0.044, 12), [0, 0, 0.026], [Math.PI / 2, 0, 0]),
    m.metal,
  );
  gearHandleGeometry(gld, { style: 'jet', scale: 0.8, lamp: false, knobColor: AP.white });
  gld.finish();
  bindings.push({
    node: gearLever.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    scale: -0.7,
    offset: 0.35,
  });
  for (const [u, v, label] of [
    [781, 680, 'BRAKE'],
    [781, 746, 'HYD'],
    [918, 323, 'RWR'],
  ]) {
    pt.gauge(...at(u, v).slice(0, 2), z - 0.01, 32 * k, black, false);
    text(label, u, v - 6, 6);
    text('--', u, v + 9, 9, amber, 'display');
  }
  for (let j = 0; j < 3; j++) {
    const g = group(
        cabin,
        `AV8-gear-lamp-${j}`,
        at(342 + (j === 0 ? 0 : j === 1 ? -15 : 15), 737 + (j === 0 ? 0 : 24), -0.034),
      ),
      gd = detailKit(g, g.name);
    gd.box([0.008, 0.008, 0.002], [0, 0, 0], green);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  {
    const sill = group(cabin, 'AV8-left-sill', [0.407, 2.38, 4.5]);
    sill.rotation.y = Math.PI / 2 - 0.2;
    const sk = detailKit(sill, sill.name);
    sk.box([0.13, 0.065, 0.01], [0, 0, 0], black);
    sk.box([0.05, 0.034, 0.002], [0.03, -0.002, -0.006], AP.white);
    sk.text('LANDING', [-0.022, 0.023, -0.0062], 0.0055, Math.PI, ink);
    // The plate's checks as lettered in the GR9 cockpit photograph (MOD 45151641).
    for (const [j, line] of [
      'GEAR',
      'FLAPS',
      'FUEL',
      'BRAKES',
      'STO',
      'DUCTS',
      'CAUT LTS',
    ].entries())
      sk.text(line, [-0.022, 0.0135 - j * 0.0062, -0.0062], 0.004, Math.PI, ink);
    sk.box([0.03, 0.05, 0.01], [-0.075, 0.005, 0], black);
    sk.add(place(roundedBox([0.022, 0.009, 0.014], 0.003), [-0.075, 0.012, -0.012]), AP.alloy);
    sk.text('H2O', [-0.075, 0.03, -0.0062], 0.005, Math.PI, ink);
    sk.add(
      new T.CylinderGeometry(0.024, 0.024, 0.014, 20).rotateX(Math.PI / 2),
      black,
      [-0.01, 0.075, 0.004],
    );
    sk.add(
      new T.CylinderGeometry(0.019, 0.019, 0.002, 20).rotateX(Math.PI / 2),
      AP.white,
      [-0.01, 0.075, -0.004],
    );
    sk.box([0.0015, 0.016, 0.001], [-0.01, 0.081, -0.0055], black);
    sk.finish();
  }
  {
    // Its twin on the right sill: the black TAKEOFF checklist plate (Harrier II GR9 cockpit
    // photograph, Crown copyright OGL, Commons 45151641: same Harrier II cockpit family).
    const sill = group(cabin, 'AV8-right-sill', [-0.407, 2.38, 4.5]);
    sill.rotation.y = -(Math.PI / 2 - 0.2);
    const sk = detailKit(sill, sill.name);
    sk.box([0.075, 0.068, 0.01], [0, 0, 0], black);
    sk.text('TAKEOFF', [0, 0.024, -0.0062], 0.0055, Math.PI, ink);
    for (const [j, line] of ['FUEL', 'FLAPS', 'STO', 'TRIMS', 'DUCTS', 'CAUT LTS'].entries())
      sk.text(line, [0, 0.0135 - j * 0.0072, -0.0062], 0.0042, Math.PI, ink);
    for (const u of [-0.031, 0.031])
      for (const v of [-0.028, 0.028])
        sk.add(new T.CircleGeometry(0.0022, 8).rotateY(Math.PI), AP.alloy, [u, v, -0.0055]);
    sk.finish();
  }
  // A white ring fitting on each cockpit wall just aft of the checklist plates (same photograph).
  for (const [x, yaw] of [
    [0.414, -Math.PI / 2],
    [-0.404, Math.PI / 2],
  ]) {
    d.add(new T.TorusGeometry(0.014, 0.0032, 6, 20).rotateY(yaw), AP.white, [x, 2.36, 4.3]);
    d.add(new T.CircleGeometry(0.0115, 16).rotateY(yaw), black, [
      x + Math.sign(x) * 0.002,
      2.36,
      4.3,
    ]);
  }
  // Physical combiner and triangulated supports; HUD symbology is not collimated yet.
  const hud = [
    [430, 4],
    [438, -262],
    [470, -283],
    [602, -283],
    [634, -262],
    [642, 4],
  ].map((p) => at(...p, -0.09));
  sheet(d, hud, m.glass, [0, 0, -1]);
  outline(d, hud, 0.004, black);
  for (const side of [-1, 1]) {
    d.rod(at(535 + side * 106, 4, -0.1), at(535 + side * 98, -258, -0.1), 0.008, m.metal);
    d.rod(at(535 + side * 106, 4, 0.1), at(535 + side * 98, -258, -0.1), 0.007, black);
  }
  d.box([0.8, 0.03, 2.2], [0, 1.95, 3.65], black);
  // Aft cockpit bulkhead under the shoulder quads: without it the fan face behind the plenum
  // (turbine disc at z 2.28) showed under the head box, and the lower aft corners let the
  // look-left/right views see out past the tub walls.
  sheet(
    d,
    [
      [-0.4, 1.94, 2.62],
      [0.4, 1.94, 2.62],
      [0.4, 2.51, 2.62],
      [0.03, 2.93, 2.62],
      [-0.03, 2.93, 2.62],
      [-0.4, 2.51, 2.62],
    ],
    black,
    [0, 0, 1],
  );
  // Sidewall liners follow the skin from the floor up to the canopy rail: flat tub walls inboard
  // of the skin left the painted shoulders showing between console and sill, and the nozzle
  // lever stood in the left one.
  // They stand 4.5 cm in, inside the RESCUE markings, which sit within the skin.
  cockpitLiner(d, root, {
    zFrom: 2.64,
    zTo: 4.7,
    yFrom: 1.95,
    yTo: 2.96,
    zSteps: 12,
    ySteps: 14,
    inset: 0.045,
    material: panel,
  });
  // Close the nose behind the panel and the knee wells under it.
  cockpitBulkhead(d, root, { z: 4.7, yFrom: 1.96, yTo: 2.66, material: panel });
  // Side consoles, laid out from the AV-8B NATOPS cockpit foldout (A1-AV8BB-NFM-000, FO-2: AV-8B
  // 163853 and up) and its Figure 2-6 throttle nozzle quadrant, checked against the DCS AV-8B N/A
  // cockpit (RAZBAM pocket guide; Chuck's guide). Left, fore to aft: trim, SAAHS, the throttle
  // nozzle quadrant, fuel, exterior lights and pilot services, with the seat-adjust and
  // exterior-lights master switches on the wall beside the fuel panel. Right: electrical, V/UHF
  // radio set control, ACNIP, interior lights, ECS, the air vent and the NVG and video recorder
  // stowage. Black panels, white legends, silver bats and grey knobs. Spacing follows the
  // foldout, anchored on the throttle and nozzle lever pivots; both consoles end beside the
  // seat, where the liner closes over them.
  for (const side of [-1, 1]) {
    d.box([0.18, 0.21, 1.55], [side * 0.33, 2.16, 3.7], panel);
    const cg = group(cabin, `AV8-console-${side}`, [side * 0.33, 2.275, 3.7]);
    cg.rotation.x = Math.PI / 2;
    const cd = detailKit(cg, cg.name),
      // Console frame: o across the console (+ outboard), zz the model station, h above the face.
      L = (o, zz, h = 0) => [side * o, zz - 3.7, -h],
      unit = (z0, z1, o0 = -0.085, o1 = 0.085, material = black, h = 0) =>
        cd.box([o1 - o0, z1 - z0, 0.01], L((o0 + o1) / 2, (z0 + z1) / 2, h), material),
      label = (t, o, zz, size = 0.0046, hb = 0.005, material = ink) =>
        cd.text(t, L(o, zz, hb + 0.0006), size, Math.PI, material),
      toggle = (o, zz, t, hb = 0.005) => {
        cd.add(bar(L(o, zz, hb), L(o, zz + 0.005, hb + 0.016), 0.0026, 8, 0.0017), m.metal);
        if (t) label(t, o, zz + 0.015, 0.0046, hb);
      },
      knob = (o, zz, t, r = 0.0075, hb = 0.005, sides = 12) => {
        cd.add(
          new T.CylinderGeometry(r * 0.85, r, 0.011, sides).rotateX(-Math.PI / 2),
          panel,
          L(o, zz, hb + 0.0055),
        );
        cd.box([0.0012, r * 0.8, 0.0008], L(o, zz + r * 0.4, hb + 0.0112), AP.white);
        if (t) label(t, o, zz + r + 0.007, 0.0046, hb);
      },
      dial = (o, zz, r = 0.011) => {
        cd.add(
          new T.CylinderGeometry(r, r, 0.004, 16).rotateX(-Math.PI / 2),
          black,
          L(o, zz, 0.007),
        );
        cd.add(new T.TorusGeometry(r, 0.0011, 4, 16), m.metal, L(o, zz, 0.009));
        cd.box([0.0012, r * 0.75, 0.0008], L(o, zz + r * 0.35, 0.0095), AP.white);
      };
    if (side === 1) {
      // Trim: the rudder pedal shaker and landing/taxi light switches, the aileron and rudder trim
      // indicators.
      unit(4.352, 4.475);
      label('TRIM', -0.05, 4.462, 0.0055);
      toggle(0.05, 4.398, 'RPS/YAW');
      toggle(0.01, 4.398, 'APRCH');
      dial(-0.05, 4.437);
      dial(-0.05, 4.386);
      label('AIL', -0.05, 4.418, 0.004);
      label('RUD', -0.05, 4.367, 0.004);
      // Stability augmentation and attitude hold, just forward of the quadrant.
      unit(4.272, 4.35);
      for (const [o, zz, t] of [
        [0.05, 4.322, 'Q FEEL'],
        [0, 4.322, 'ALT HOLD'],
        [-0.05, 4.322, 'AFC'],
        [0.05, 4.284, 'YAW'],
        [0, 4.284, 'ROLL'],
        [-0.05, 4.284, 'PITCH'],
      ])
        toggle(o, zz, t);
      label('SAAHS', -0.074, 4.33, 0.0042);
      // Throttle nozzle quadrant: the throttle's slot outboard with the parking brake lever's
      // detent beside it, the JPTL switch, EMS button, rudder trim and the striped manual fuel
      // switch down the middle, the friction knobs aft and the raised nozzle quadrant inboard.
      unit(4.004, 4.272);
      cd.box([0.012, 0.232, 0.002], L(0.05, 4.14, 0.0055), AP.tread);
      for (const o of [0.0425, 0.0575])
        cd.box([0.0015, 0.232, 0.0015], L(o, 4.14, 0.0058), m.metal);
      cd.box([0.006, 0.07, 0.002], L(0.077, 4.195, 0.0055), AP.tread);
      toggle(0.021, 4.236, 'JPTL');
      cd.add(
        new T.CylinderGeometry(0.0055, 0.0055, 0.004, 14).rotateX(-Math.PI / 2),
        AP.alloy,
        L(0.021, 4.198, 0.007),
      );
      label('EMS', 0.021, 4.21);
      toggle(0.021, 4.13, 'RUD TRIM');
      unit(4.046, 4.104, 0.005, 0.037, AP.yellow, 0.0015);
      for (let i = 0; i < 4; i++)
        cd.add(
          place(
            new T.BoxGeometry(0.004, 0.034, 0.001),
            L(0.021, 4.06 + i * 0.012, 0.0072),
            [0, 0, 0.7],
          ),
          black,
        );
      toggle(0.021, 4.07, '', 0.0065);
      label('MAN FUEL', 0.021, 4.037, 0.0038);
      for (const o of [0.05, -0.035])
        cd.add(
          new T.CylinderGeometry(0.0078, 0.0085, 0.012, 6).rotateX(-Math.PI / 2),
          AP.black,
          L(o, 4.0165, 0.011),
        );
      // Fuel: proportioner, boost pumps, air refuelling probe and wing dump switches.
      unit(3.896, 4.0);
      cd.add(
        new T.CylinderGeometry(0.0085, 0.0095, 0.011, 6).rotateX(-Math.PI / 2),
        panel,
        L(0.048, 3.97, 0.0105),
      );
      label('FUEL PROP', 0.048, 3.988, 0.0038);
      toggle(0.002, 3.968);
      toggle(-0.042, 3.968);
      label('PUMP', -0.02, 3.986);
      toggle(0.048, 3.916, 'A/R');
      toggle(0.002, 3.916);
      toggle(-0.042, 3.916);
      label('DUMP', -0.02, 3.934);
      label('FUEL', -0.074, 3.95, 0.0042);
      // Exterior lights: formation knob, position, anti-collision and auxiliary lights.
      unit(3.828, 3.892);
      knob(0.05, 3.85, 'FORM', 0.0085);
      toggle(0.012, 3.85, 'POS');
      toggle(-0.022, 3.85, 'COLL');
      toggle(-0.056, 3.85, 'AUX');
      // Pilot services: oxygen, water dump, LIDS, engine RPM select and engine fuel control
      // switches outboard, the personal services connector block and its fittings inboard.
      unit(3.615, 3.824);
      toggle(0.062, 3.79, 'OXY');
      toggle(0.03, 3.79, 'H2O');
      toggle(0.062, 3.727, 'LIDS');
      toggle(0.062, 3.66, 'ENG RPM');
      toggle(0.028, 3.66, 'EFC');
      cd.add(
        place(roundedBox([0.046, 0.062, 0.012], 0.004, 1, 1), L(-0.012, 3.727, 0.011)),
        AP.steel,
      );
      cd.add(
        new T.CylinderGeometry(0.0095, 0.0105, 0.008, 14).rotateX(-Math.PI / 2),
        AP.alloy,
        L(-0.012, 3.727, 0.021),
      );
      for (const zz of [3.79, 3.652])
        cd.add(
          new T.CylinderGeometry(0.0115, 0.0125, 0.016, 14).rotateX(-Math.PI / 2),
          AP.steel,
          L(-0.058, zz, 0.013),
        );
    } else {
      // Electrical: battery voltmeter and DC test switch, then the APU generator, engine start,
      // generator and battery switches.
      unit(4.37, 4.475);
      dial(-0.05, 4.448, 0.0105);
      toggle(-0.005, 4.442, 'DC TEST');
      label('ELEC', 0.055, 4.458, 0.0055);
      for (const [o, t] of [
        [-0.06, 'APU GEN'],
        [-0.02, 'ENG ST'],
        [0.02, 'GEN'],
        [0.06, 'BATT'],
      ])
        toggle(o, 4.388, t);
      // V/UHF radio set control: its frequency window and four knobs.
      unit(4.29, 4.368);
      cd.box([0.07, 0.02, 0.002], L(0, 4.345, 0.0055), panel);
      label('251.000', 0, 4.345, 0.0075, 0.0065, black);
      for (const [o, zz, r] of [
        [-0.062, 4.346, 0.005],
        [-0.055, 4.307, 0.008],
        [0.062, 4.346, 0.0055],
        [0.055, 4.307, 0.008],
      ])
        knob(o, zz, '', r);
      label('V/UHF', 0, 4.304);
      // ACNIP: the key display window, mode, KY, zero and IFF switches, code and mode knobs and
      // the volume knob.
      unit(4.1, 4.288);
      cd.box([0.036, 0.036, 0.002], L(-0.048, 4.248, 0.0055), AP.steel);
      toggle(-0.005, 4.252, 'MODE');
      toggle(0.032, 4.252);
      toggle(0.064, 4.252);
      label('KY', 0.048, 4.27);
      toggle(0.032, 4.198, 'ZERO');
      toggle(0.064, 4.198, 'RVI');
      knob(-0.06, 4.186, 'CODE', 0.0065);
      knob(-0.032, 4.186, '', 0.0065);
      knob(-0.05, 4.128, 'VOL', 0.0085);
      toggle(-0.005, 4.128, 'MIC');
      toggle(0.032, 4.128);
      toggle(0.064, 4.128);
      label('IFF', 0.048, 4.146);
      label('ACNIP', -0.074, 4.215, 0.0042);
      // Interior lights: compass/lights test, instrument, console, flood and warning knobs.
      unit(3.955, 4.098);
      toggle(-0.05, 4.062, 'COMP');
      knob(0, 4.062, 'INST', 0.0085);
      knob(0.05, 4.062, 'CONSL', 0.0085);
      knob(0, 3.99, 'FLD', 0.0085);
      knob(0.05, 3.99, 'WARN', 0.0085);
      label('INTR LT', -0.05, 3.985);
      // Environmental control: the large temperature selector, equipment, defog and pressure.
      unit(3.81, 3.953);
      knob(-0.035, 3.87, 'TEMP', 0.0135, 0.005, 16);
      toggle(0.032, 3.912, 'EQUIP');
      toggle(0.066, 3.912, 'DFOG');
      toggle(0.05, 3.842, 'PRESS');
      label('ECS', -0.072, 3.935, 0.0055);
      // The air vent, then the lidded NVG and video recorder stowage, then a blank.
      unit(3.748, 3.808);
      for (let i = 0; i < 4; i++)
        cd.box([0.11, 0.005, 0.004], L(0, 3.758 + i * 0.013, 0.007), AP.steel);
      unit(3.5, 3.746);
      cd.add(
        place(roundedBox([0.15, 0.226, 0.02], 0.004, 1, 1), L(-0.002, 3.623, 0.015)),
        AP.tread,
      );
      knob(-0.03, 3.655, 'LOCK', 0.009, 0.025);
      toggle(0.045, 3.54, 'REC', 0.025);
      label('NVG', 0.03, 3.69, 0.0055, 0.025);
      unit(3.42, 3.498);
    }
    cd.finish();
  }
  {
    // The raised nozzle quadrant on the left console, over the nozzle lever's pivot, with the
    // short-takeoff stop's mushroom knob on its scale strip.
    const onBand = nozzleQuadrant(d, {
      xs: [0.262, 0.285, 0.295, 0.326],
      y: 2.28,
      zc: 4.14,
      half: 0.11,
      rise: 0.022,
      strip: black,
      scale: m.metal,
      ticks: AP.legend,
    });
    const { at: sto, angle } = onBand(Math.asin(-0.066 / 0.3), 0.31);
    d.add(
      place(
        lathe(
          [
            [0.0024, 0],
            [0.0024, 0.011],
            [0.0072, 0.0125],
            [0.0072, 0.016],
            [0.0045, 0.0185],
            [0, 0.019],
          ],
          12,
        ),
        sto,
        [angle, 0, 0],
      ),
      AP.black,
    );
    // Seat-adjust and exterior-lights master switches on the wall beside the fuel panel.
    d.box([0.01, 0.06, 0.088], [0.424, 2.336, 3.94], black);
    for (const [zz, t] of [
      [3.962, 'SEAT ADJ'],
      [3.918, 'EXT LT'],
    ]) {
      d.add(bar([0.419, 2.33, zz], [0.403, 2.336, zz], 0.0026, 8, 0.0017), m.metal);
      d.text(t, [0.4185, 2.352, zz], 0.0042, -Math.PI / 2, ink);
    }
  }
  // SJU-4-style seat structure, harness and center stick. Detail dimensions are estimates.
  const sg = group(cabin, 'AV8-seat', [0, 2.14, 3.78]);
  sg.rotation.x = -0.18;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.43, 0.12, 0.48], [0, 0, 0.2], seat);
  beveledBox(sd, [0.43, 0.66, 0.13], [0, 0.37, -0.07], seat);
  beveledBox(sd, [0.28, 0.26, 0.17], [0, 0.87, -0.09], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.23, -0.1, -0.16], [side * 0.23, 0.93, -0.16], 0.023, m.metal);
    sheet(
      sd,
      [
        [side * 0.1, 0.68, 0.01],
        [side * 0.15, 0.68, 0.01],
        [side * 0.08, 0.11, 0.11],
        [side * 0.03, 0.11, 0.11],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.13, 0.03, 0.23], [side * 0.16, 0.09, 0.17], belt);
  }
  sd.box([0.055, 0.04, 0.025], [0, 0.12, 0.16], m.metal);
  sd.ring(0.045, 0.008, [0, 0.13, 0.43], amber);
  sd.finish();
  // Center stick: the B-8-family grip (trim, bomb release, castle switch, trigger) on a slim
  // column out of a short boot, with the stick-mounted nosewheel-steering button.
  const P = partPalette();
  const stick = group(cabin, 'AV8-stick', [0, 2.0, 4.3]),
    st = detailKit(stick, stick.name);
  stickGeometry(st, { style: 'b8', height: 0.4, rake: -0.05, shaft: 0.012, scale: 1.0 });
  st.add(
    lathe(
      [
        [0.0145, 0],
        [0.0155, 0.01],
        [0.0145, 0.02],
      ],
      14,
    ),
    P.steel,
    [0, 0.3, -0.037],
  );
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.22 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.22 },
  );
  for (const [name, x, source, scale] of [
    ['throttle', 0.38, 'power', 0.7],
    ['nozzle-lever', 0.29, 'thrustVector', -0.9],
  ]) {
    const g = group(cabin, `AV8-${name}`, [x, 2.29, 4.14]),
      dd = detailKit(g, g.name);
    // The throttle carries the HOTAS grip; the nozzle lever inboard of it is a slim stalk with a
    // ball knob, out of the raised nozzle quadrant.
    if (source === 'power') harrierThrottle(dd);
    else harrierNozzleLever(dd);
    dd.finish();
    bindings.push({
      node: g.name,
      source,
      property: 'rotation',
      axis: 'x',
      scale,
      offset: source === 'power' ? -0.35 : 0.45,
    });
  }
  for (const side of [-1, 1]) {
    const g = group(cabin, `AV8-pedal-${side}`, [side * 0.13, 2.06, 4.6]),
      dd = detailKit(g, g.name);
    harrierPedal(dd);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.055,
    });
  }
  {
    // Parking brake lever: a flat black paddle in its detent slot just outboard of the throttle
    // (NATOPS 2.17.6.1, "outboard of the throttle"; Figure 2-6; DCS cockpit). Aft is ON.
    const brake = group(cabin, 'AV8-park-brake', [0.407, 2.281, 4.205]);
    brake.userData.aircraftControl = {
      action: 'brake',
      motion: { property: 'rotation', axis: 'x', scale: -0.45 },
    };
    const bk = detailKit(brake, brake.name);
    bk.add(bar([0, -0.004, 0], [0, 0.022, 0.004], 0.0028, 10), AP.steel);
    bk.add(
      place(roundedBox([0.007, 0.03, 0.026], 0.003), [0, 0.034, 0.006], [0.15, 0, 0]),
      AP.black,
    );
    bk.finish();
  }
  {
    // Fuel shutoff handle on the wall aft of the left console, over the pilot services panel
    // (NATOPS FO-2 item 8; DCS cockpit): a yellow-and-black striped grip on a short arm out of
    // its pivot box, the DECS enable switch on the box. Down is ON.
    d.box([0.026, 0.07, 0.07], [0.407, 2.395, 3.6], black);
    d.add(bar([0.394, 2.422, 3.585], [0.379, 2.427, 3.586], 0.0026, 8, 0.0017), m.metal);
    d.text('DECS', [0.3935, 2.44, 3.585], 0.0042, -Math.PI / 2, ink);
    const fuel = group(cabin, 'AV8-fuel-shutoff', [0.392, 2.39, 3.625]);
    fuel.userData.aircraftControl = {
      action: 'engine',
      motion: { property: 'rotation', axis: 'x', scale: 0.5, offset: -0.25 },
    };
    const fk = detailKit(fuel, fuel.name),
      ax = (zz) => -0.003 - ((zz - 0.05) / 0.068) * 0.004;
    fk.add(bar([0, 0, -0.01], [-0.003, 0, 0.05], 0.0045, 12), AP.alloy);
    fk.add(bar([-0.003, 0, 0.05], [-0.007, 0, 0.118], 0.0088, 12), AP.yellow);
    for (let i = 0; i < 3; i++) {
      const z0 = 0.058 + i * 0.02;
      fk.add(bar([ax(z0), 0, z0], [ax(z0 + 0.008), 0, z0 + 0.008], 0.0091, 12), AP.black);
    }
    fk.add(bar([-0.007, 0, 0.118], [-0.0072, 0, 0.122], 0.004, 10), AP.alloy);
    fk.finish();
  }
  d.finish();
  // Where the controls are (AV-8B NATOPS cockpit, FO-2 and Figure 2-6; AV-8B+ photographs): the
  // flap mode switch at the top of the lower left panel, the speed brake switch on the throttle
  // grip's inboard thumb shelf and the canopy handle on the right sill. The parking brake lever
  // and the fuel shutoff handle are modelled above.
  const stations = [
    { action: 'flaps', style: 'toggle', scale: 1.15, at: at(272, 614, -0.0065) },
    {
      action: 'speedBrake',
      style: 'slider',
      parent: 'AV8-throttle',
      at: [0.356, 2.422, 4.156],
      rotation: [Math.PI / 2, 0, -0.3],
    },
    {
      action: 'canopy',
      style: 'canopy',
      at: [-0.455, 2.42, 4.0],
      rotation: [0, -Math.PI / 2, 0],
      label: 'CANOPY',
      labelAt: [0, -0.03, -0.002],
      labelHeight: 0.0065,
    },
  ];
  return { nodes: ['cockpit'], sources, derived, bindings, stations };
}
