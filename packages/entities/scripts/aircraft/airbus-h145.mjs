/** H145 D3, traced in meter space from Airbus Ground Rescue Booklet 3061-S-00
 * rev.1, page 4. Helionix face follows page 16; see reference-review.json.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import {
  bar,
  lathe,
  loftUp,
  partPalette,
  pedalGeometry,
  place,
  roundedBox,
  contour as superellipse,
  tube,
} from './cockpit-parts.mjs';
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
import {
  addParts,
  authoredControl,
  cabinShell,
  gripBody,
  posedKit,
  turbineCollective,
} from './robinson-r44.mjs';
export const h145Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 0.865,
  cy: 1.45,
  ry: 0.95,
  cabinZ: 1.55,
  cabinWidth: 1.65,
  eye: [-0.43, 2.08, 1.55],
  panelZ: 2.24,
  floor: 0.86,
  mainRotorPosition: [0, 3.46, 0],
});
export function buildH145(s) {
  const root = new T.Group();
  root.name = s.slug;
  const white = mat('H145-white', '#e6e4db', { side: T.DoubleSide }),
    paint = mat('H145-blue', '#34667b', { side: T.DoubleSide }),
    trim = mat('H145-trim', '#232c30'),
    metal = mat('H145-metal', '#9ba5a6', { metalness: 0.72 }),
    glass = mat('H145-glass', '#a9c9d1', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.16,
    }),
    // The chin windows read dark tinted in the photos.
    tint = mat('H145-tinted-glass', '#2f464e', {
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'H145-airframe');
  // Side profile and plan keep the fitted stations (nose half-width 0.36 m 0.12 m behind the tip
  // and 0.56 m at 0.35 m, roof 2.4 m). Head-on (Juno, Polizei and DRF photos) the cabin is a
  // rounded pod: widest at the window sills, with marked tumblehome to a narrower roof and a
  // flat, rolled-under belly. The wrap-around windscreen runs down to a dark nose cap with chin
  // windows below it, and all glazing curves with the skin.
  const shell = cabinShell(
    [
      // z, half width, keel, crown, widest at, superellipse exponent above / below it
      [3.38, 0.36, 1.1, 1.62, 1.36, 2.6, 2.4],
      [3.15, 0.56, 0.95, 1.845, 1.32, 2.8, 2.8],
      [2.86, 0.7, 0.78, 2.09, 1.26, 3.1, 4],
      [2.25, 0.8, 0.6, 2.36, 1.28, 3.3, 4.6],
      [1.72, 0.86, 0.51, 2.4, 1.3, 3.4, 4.8],
      [0.55, 0.865, 0.45, 2.38, 1.28, 3.4, 5],
      [-0.6, 0.865, 0.45, 2.32, 1.28, 3.4, 5],
      [-1.5, 0.78, 0.54, 2.25, 1.32, 3.2, 4.6],
      [-2.67, 0.36, 1.3, 2.13, 1.72, 2.6, 2.6],
    ],
    [3.51, 1.32, 0.45],
    // The clamshell doors round off under the boom root instead of ending in a flat bulkhead.
    [-2.8, 1.78, 0.5],
  );
  const zs = shell.samples(0.25),
    v = (z, y, side) => shell.vAt(z, y, side),
    roof = (z, x) => Math.sign(x) * shell.vAtX(z, Math.abs(x)),
    onRoof = (z, x, lift = 0) => {
      const a = roof(z, x),
        n = shell.normal(z, a);
      return shell.at(z, a).map((c, k) => c + n[k] * lift);
    };
  // Two windscreen halves either side of a slim post, wrapping round to the door posts. The
  // post edge is sampled along its length so it keeps one width down to the nose cap.
  const panes = [-1, 1].map((side) =>
      shell.region([
        ...[3.34, 3.1, 2.8, 2.45, 2.1, 1.72].map((z) => [z, roof(z, side * 0.035)]),
        [1.72, v(1.72, 2.22, side)],
        [2.25, v(2.25, 2.17, side)],
        [2.86, v(2.86, 1.88, side)],
        [3.12, v(3.12, 1.52, side)],
        [3.34, v(3.34, 1.4, side)],
      ]),
    ),
    chins = [-1, 1].map((side) =>
      shell.region(
        fillet(
          [
            [3.1, 1.42],
            [2.88, 1.8],
            [2.74, 0.9],
            [3.02, 1.02],
          ],
          0.06,
        ).map(([z, y]) => [z, y, side]),
      ),
    ),
    cap = shell.region([
      [3.36, -0.5],
      [3.6, -0.5],
      [3.6, 0.5],
      [3.36, 0.5],
    ]);
  const windows = [-1, 1].flatMap((side) =>
    [
      [
        [2.67, 1.76],
        [2.35, 2.0],
        [1.83, 2.12],
        [1.85, 1.43],
        [2.65, 1.47],
      ],
      [
        [1.64, 2.15],
        [0.68, 2.1],
        [0.69, 1.49],
        [1.64, 1.51],
      ],
      [
        [0.4, 2.03],
        [-0.23, 2.0],
        [-0.26, 1.53],
        [0.4, 1.54],
      ],
      [
        [-0.56, 1.97],
        [-0.94, 1.94],
        [-0.85, 1.54],
        [-0.57, 1.54],
      ],
      // Rounded corners on every pane (EAAA profile photo).
    ].map((a, i) => shell.region(fillet(a, i ? 0.09 : 0.1).map(([z, y]) => [z, y, side]))),
  );
  // Blue band low on the sides, one strip per skin bay so each piece stays convex.
  const bandZ = zs.filter((z) => z >= -2.67 && z <= 2.86),
    band = (z, side) => {
      const [, b] = shell.size(z);
      return [
        [z, b + 0.08, side],
        [z, b + 0.22, side],
      ];
    };
  const bands = [-1, 1].flatMap((side) =>
    bandZ.slice(1).map((z, i) => shell.region([...band(bandZ[i], side), ...band(z, side)])),
  );
  shell.build(
    d,
    white,
    [
      ...[...panes, ...windows].map((poly) => ({ poly, material: glass })),
      ...chins.map((poly) => ({ poly, material: tint })),
      { poly: cap, material: trim },
      ...bands.map((poly) => ({ poly, material: paint })),
    ],
    zs,
    28,
  );
  // The dark nose cap is single-sided trim: from the crew seats it vanished and the ground
  // showed through the nose beside the glareshield. An inward lining closes it.
  shell.build(d, trim, [], [3.345, ...zs.filter((z) => z > 3.345)], 28, 0.004);
  for (const poly of panes) shell.strip(d, poly, 0.028, trim);
  for (const poly of [...chins, ...windows]) shell.strip(d, poly, 0.026, trim, false);
  for (const side of [-1, 1]) {
    const q = (z, y, lift = 0) => shell.point(z, y, side, lift);
    for (const a of [
      [
        [2.78, 1.72],
        [2.3, 2.2],
        [1.76, 2.23],
        [1.76, 0.93],
        [2.77, 0.99],
      ],
      [
        [1.7, 2.27],
        [0.57, 2.25],
        [0.57, 0.91],
        [1.7, 0.92],
      ],
      [
        [0.5, 2.2],
        [-1.24, 2.1],
        [-1.34, 0.8],
        [0.5, 0.8],
      ],
    ])
      shell.strip(d, shell.region(a.map(([z, y]) => [z, y, side])), 0.008, trim, false);
    d.rod(q(0.67, 1.33, 0.017), q(0.89, 1.33, 0.017), 0.015, metal);
    d.rod(q(1.9, 1.32, 0.013), q(2.04, 1.32, 0.013), 0.012, metal);
    // Sliding-door rail under the roof shoulder, standing off the skin far enough that the
    // faceted shoulder does not let it show inside the cabin.
    d.rod(q(0.45, 2.19, 0.026), q(-1.4, 2.11, 0.026), 0.014, metal);
    for (const z of [0.55, -0.8])
      for (const y of [0.98, 1.95]) d.box([0.035, 0.03, 0.07], q(z, y, 0.008), metal);
    for (const z of [1.41, -0.48]) {
      // Cross tubes leave the rolled belly corner (not the old flat wall line).
      d.rod([side * 0.55, 0.56, z], [side * 1.15, 0.06, z], 0.045, trim);
      d.rod([side * 0.9, 0.45, z + 0.15], [side * 1.15, 0.08, z + 0.15], 0.02, metal);
    }
    outline(
      d,
      [
        [side * 1.15, 0.21, 2.05],
        [side * 1.15, 0.08, 1.84],
        [side * 1.15, 0.05, 1.6],
        [side * 1.15, 0.05, -0.84],
      ],
      0.05,
      trim,
      false,
    );
    d.box([0.26, 0.04, 0.62], [side * 1.02, 0.38, 0.2], trim);
    for (const z of [1.7, 0.55, -1.2])
      for (let n = 0; n < 10; n++)
        d.add(new T.SphereGeometry(0.0035, 5, 3), metal, q(z, 0.99 + n * 0.1, 0.002));
    // Titles and registrations are livery lettering (liveries/aircraft/airbus-h145.mjs).
    // Rear clamshell seam and hinges, following the upward-sloping aft floor.
    const rear = [
      [-1.85, 0.85],
      [-2.6, 1.4],
      [-2.6, 2.06],
      [-1.85, 2.18],
    ];
    shell.strip(d, shell.region(rear.map(([z, y]) => [z, y, side])), 0.012, trim, false);
    for (const y of [1.5, 1.9]) d.box([0.045, 0.07, 0.04], q(-2.6, y, 0.015), metal);
  }
  // Twin engine cowlings stand above the cabin: upright flanks leaning in slightly under a
  // rounded crown, their foot following the roof as it rolls over the shoulders.
  const cr = (z, w, b, t) => {
    const foot = Math.min(b, shell.at(z, roof(z, w))[1] - 0.03),
      y = t - (t - foot) * 0.62;
    return {
      z,
      w,
      arc: Array.from({ length: 13 }, (_, k) => {
        const a = ((k - 6) * Math.PI) / 12,
          s = Math.sin(a),
          h = y + (t - y) * Math.pow(Math.cos(a), 2 / 2.6);
        return [
          w *
            (1 - (0.08 * (h - foot)) / (t - foot)) *
            Math.sign(s) *
            Math.pow(Math.abs(s), 2 / 2.6),
          h,
        ];
      }),
    };
  };
  // The flanks keep their shape (feet 3 cm under the roof), but the side walls stop on
  // the skin and the underside rides 15 mm over it, re-fitted every 0.2 m between the stations
  // (each in-between arc on the old straight loft). The old straight underside ran below the
  // curved roof for 10-15 cm in from each foot: broad blue bands on the cabin ceiling.
  const section = ({ z, w, arc }) => {
    const roofY = (x) => shell.at(z, roof(z, x))[1],
      base = roofY(w) + 0.001;
    return {
      z,
      points: [
        [-w, base],
        ...arc,
        [w, base],
        ...[0.9, 0.75, 0.6, 0.4, 0.2, 0, -0.2, -0.4, -0.6, -0.75, -0.9].map((k) => [
          k * w,
          roofY(k * w) + 0.015,
        ]),
      ],
    };
  };
  const stations = [
    cr(1.48, 0.32, 2.36, 2.62),
    cr(0.68, 0.61, 2.37, 2.99),
    cr(-0.45, 0.65, 2.3, 3.0),
    cr(-1.5, 0.56, 2.23, 2.75),
    cr(-2.6, 0.3, 2.06, 2.35),
  ];
  const cowls = stations.flatMap((a, i) => {
    const b = stations[i + 1];
    if (!b) return [section(a)];
    const n = Math.ceil((a.z - b.z) / 0.2);
    return Array.from({ length: n }, (_, k) => {
      const u = k / n,
        mix = (p, q) => p + (q - p) * u;
      return section({
        z: mix(a.z, b.z),
        w: mix(a.w, b.w),
        arc: a.arc.map((p, j) => p.map((c, m) => mix(c, b.arc[j][m]))),
      });
    });
  });
  loft(d, cowls, paint);
  /** Half width of the cowling at station z and height y (its +X flank). */
  const cowlX = (z, y) => {
    const i = Math.max(
        1,
        cowls.findIndex((c) => c.z <= z),
      ),
      a = cowls[i - 1],
      b = cowls[i],
      u = (z - a.z) / (b.z - a.z),
      flank = a.points
        .slice(7, 15)
        .map((p, k) => p.map((c, j) => c + (b.points[k + 7][j] - c) * u));
    for (let k = 0; k < flank.length - 1; k++) {
      const [x0, y0] = flank[k],
        [x1, y1] = flank[k + 1];
      if ((y - y0) * (y - y1) <= 0) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
    return flank.at(-1)[0];
  };
  for (const side of [-1, 1]) {
    // Flank intake grille and its slats, following the cowling's lean into the crown.
    for (let i = 0; i < 7; i++) {
      const y = 2.49 + i * 0.04;
      if (i < 6) {
        const x0 = cowlX(-0.05, y + 0.02),
          x1 = cowlX(-0.25, y + 0.02);
        quad(
          d,
          [side * (x0 + 0.004), y, -0.05],
          [side * (x1 + 0.004), y, -0.25],
          [side * (x1 + 0.004), y + 0.04, -0.25],
          [side * (x0 + 0.004), y + 0.04, -0.05],
          trim,
          [side, 0, 0],
        );
      }
      d.rod(
        [side * (cowlX(-0.05, y) + 0.01), y, -0.05],
        [side * (cowlX(-0.25, y) + 0.01), y, -0.25],
        0.006,
        metal,
      );
    }
    d.rod([side * 0.47, 2.62, -1.3], [side * 0.49, 2.64, -1.83], 0.115, metal);
    d.add(new T.CircleGeometry(0.096, 16).rotateY(Math.PI), trim, [side * 0.49, 2.64, -1.84]);
    outline(
      d,
      [
        [0.48, 2.83],
        [-0.4, 2.83],
        [-1.6, 2.63],
      ].map(([z, y]) => [side * (cowlX(z, y) + 0.003), y, z]),
      0.003,
      metal,
      false,
    );
  }
  const boom = (z, w, y, h) => ({
    z,
    points: Array.from({ length: 12 }, (_, i) => [
      Math.sin((i * Math.PI) / 6) * w,
      y + Math.cos((i * Math.PI) / 6) * h,
    ]),
  });
  loft(
    d,
    [
      boom(-2.4, 0.31, 2.1, 0.28),
      boom(-4.3, 0.19, 2.1, 0.22),
      boom(-5.8, 0.16, 2.09, 0.19),
      boom(-6.4, 0.14, 2.1, 0.15),
    ],
    paint,
  );
  for (const z of [-2.7, -3.7, -4.7, -5.7]) {
    const u = (-z - 2.4) / 4;
    outline(
      d,
      boom(z, 0.31 - u * 0.17, 2.1, 0.28 - u * 0.13).points.map((p) => [...p, z]),
      0.0025,
      metal,
    );
  }
  // Fenestron has a real through-duct; no opaque disk behind its ten blades. The shroud is
  // 0.4 m thick round the duct and its faces bevel down to a slim rim, so from the rear it
  // reads as a faired duct, not a plate; the fin above it thins toward the tip.
  // The shroud rounds off behind and under the duct (side photographs): the booklet trace's
  // four corners there made a hexagon of it.
  const cy = 2.12,
    cz = -7.02,
    yz = [
      [2.3, -5.91],
      [3.96, -7.06],
      [4, -8.1],
      ...[45, 63, 81, 99, 117, 135, 153, 171, 186, 200].map((deg) => {
        const a = (deg * Math.PI) / 180,
          rr = deg < 120 ? 1.16 : 1.16 + (0.04 * (deg - 120)) / 80;
        return [cy + rr * Math.cos(a), cz - rr * Math.sin(a)];
      }),
      [1.63, -6.28],
    ],
    r = 0.575,
    half = (y) => (y <= 2.75 ? 0.2 : 0.2 - (0.08 * (y - 2.75)) / 1.25),
    rim = (y) => half(y) * 0.4;
  const circle = (x) =>
    Array.from({ length: 40 }, (_, i) => [
      x,
      cy + Math.sin((i * Math.PI) / 20) * r,
      cz + Math.cos((i * Math.PI) / 20) * r,
    ]);
  // Inward (y, z) normal of an outline edge, and the outline mitred 0.1 m inward.
  const turn = Math.sign(
      yz.reduce((sum, p, i) => {
        const q = yz[(i + 1) % yz.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ),
    inward = (p, q) => {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return [(-(q[1] - p[1]) / l) * turn, ((q[0] - p[0]) / l) * turn];
    },
    inset = yz.map((p, i) => {
      const a = inward(yz[(i + yz.length - 1) % yz.length], p),
        b = inward(p, yz[(i + 1) % yz.length]),
        m = [a[0] + b[0], a[1] + b[1]],
        l = Math.hypot(...m),
        k = 0.1 / ((m[0] / l) * a[0] + (m[1] / l) * a[1]);
      return [p[0] + (m[0] / l) * k, p[1] + (m[1] / l) * k];
    });
  for (const side of [-1, 1]) {
    sheet(
      d,
      inset.map(([y, z]) => [side * half(y), y, z]),
      paint,
      [side, 0, 0],
      [circle(side * 0.2)],
    );
    outline(d, circle(side * 0.205), 0.03, white);
    for (let i = 0; i < yz.length; i++) {
      const j = (i + 1) % yz.length,
        n = inward(yz[i], yz[j]);
      quad(
        d,
        [side * rim(yz[i][0]), ...yz[i]],
        [side * rim(yz[j][0]), ...yz[j]],
        [side * half(inset[j][0]), ...inset[j]],
        [side * half(inset[i][0]), ...inset[i]],
        paint,
        [side, -n[0], -n[1]],
      );
    }
  }
  for (let i = 0; i < yz.length; i++) {
    const a = yz[i],
      b = yz[(i + 1) % yz.length],
      n = inward(a, b);
    quad(d, [-rim(a[0]), ...a], [-rim(b[0]), ...b], [rim(b[0]), ...b], [rim(a[0]), ...a], paint, [
      0,
      -n[0],
      -n[1],
    ]);
  }
  const l = circle(-0.2),
    rr = circle(0.2);
  for (let i = 0; i < 40; i++)
    quad(d, l[i], l[(i + 1) % 40], rr[(i + 1) % 40], rr[i], trim, [
      0,
      -Math.sin((i * Math.PI) / 20),
      -Math.cos((i * Math.PI) / 20),
    ]);
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.15, 2.1, -5.18, -5.76],
        [side * 1.27, 2.1, -5.18, -5.76],
      ],
      white,
      0.07,
    );
    sheet(
      d,
      [
        [side * 1.355, 2.06, -5.1],
        [side * 1.355, 2.26, -5.2],
        [side * 1.355, 2.26, -5.83],
        [side * 1.355, 2.06, -5.86],
      ],
      paint,
      [side, 0, 0],
    );
    d.rod([side * 1.27, 2.1, -5.19], [side * 1.355, 2.1, -5.19], 0.014, white);
    d.box([0.035, 0.04, 0.05], [side * 1.355, 2.22, -5.25], side < 0 ? d.green : d.red);
  }
  const tr = group(root, 'tail-rotor', [0, cy, cz]),
    td = detailKit(tr, 'H145-fenestron');
  const fan = mat('H145-fan-blades', '#232c30', { side: T.DoubleSide });
  td.rod([-0.2, 0, 0], [0.23, 0, 0], 0.09, metal);
  for (const deg of [0, 32, 70, 108, 141, 180, 212, 250, 288, 321]) {
    const a = (deg * Math.PI) / 180,
      q = (r, t) => [0, Math.sin(a) * r + Math.cos(a) * t, Math.cos(a) * r - Math.sin(a) * t];
    sheet(td, [q(0.1, -0.035), q(0.55, -0.035), q(0.55, 0.035), q(0.1, 0.06)], fan, [1, 0, 0]);
  }
  td.finish();
  for (const a of [0, 2.1, 4.2])
    d.rod([0.13, cy, cz], [0.13, cy + Math.sin(a) * 0.57, cz + Math.cos(a) * 0.57], 0.025, metal);
  const mast = group(root, 'H145-mast', [0, 3.46, 0]),
    md = detailKit(mast, 'mast');
  md.rod([0, -0.58, 0], [0, 0.03, 0], 0.055, metal);
  md.ring(0.18, 0.025, [0, -0.28, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, 'H145-five-blade-head');
  rd.add(new T.SphereGeometry(1, 20, 8).scale(0.34, 0.12, 0.34), paint, [0, 0.04, 0]);
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 + 28) * Math.PI) / 180,
      g = group(rotor, `H145-blade-${i}`),
      dd = detailKit(g, 'blade');
    g.rotation.y = -a;
    dd.rod([0.12, -0.03, 0], [0.62, 0, 0], 0.04, metal);
    dd.rod([0.2, -0.27, 0.05], [0.5, 0, 0.09], 0.016, metal);
    wing(
      dd,
      [
        [0.46, 0, 0.15, -0.18],
        [1.6, 0, 0.17, -0.17],
        [5.2, 0.03, 0.15, -0.15],
        [5.4, 0.045, 0.1, -0.13],
      ],
      trim,
      0.035,
    );
    dd.box([0.12, 0.007, 0.27], [5.3, 0.053, -0.01], white);
    dd.finish();
  }
  rd.finish();
  d.rod([0, 2.37, 1.5], [0, 2.73, 1.0], 0.008, trim);
  d.rod([0, 2.3, -3.6], [0, 2.8, -3.8], 0.008, trim);
  d.box([0.055, 0.05, 0.055], [0, 4.025, -7.1], d.red);
  for (const side of [-1, 1]) {
    d.rod(onRoof(3.2, side * 0.2, 0.014), onRoof(2.65, side * 0.5, 0.014), 0.008, trim);
    d.rod(onRoof(2.65, side * 0.5, 0.014), onRoof(2.45, side * 0.68, 0.014), 0.006, trim);
  }
  d.finish();
  const interior = cockpit(root, { white, paint, trim, metal }, shell, [
    ...panes,
    ...windows,
    ...chins,
  ]);
  cleanGeometry(root);
  return {
    root,
    frame: h145Frame(),
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

function cockpit(root, m, shell, apertures) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'H145-cockpit'),
    bindings = [],
    // Neutral near-black panel and cabin trim (H145 and UH-72B cockpit photographs), not the
    // blue slate it was.
    face = mat('H145-panel', '#303437'),
    upholstery = mat('H145-seats', '#51616b'),
    belt = mat('H145-harness', '#b1b2a9'),
    z = 2.24,
    // The screens are 6 by 8 in Helionix MFDs, which makes the face 0.74 m wide. The 1.16 m assumed
    // before drew them 1.57 times too large; a front-quarter photograph shows a compact hood.
    fit = 0.1524 / 0.239,
    k = (1.16 / 910) * fit;
  // Coordinates on the 1335px page preview.
  const px = (u) => (665 - u) * k,
    py = (v) => 1.85 - (v - 640) * k,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz],
    pt = panelTools(d);
  const contour = [
    [215, 715],
    [220, 664],
    [260, 644],
    [470, 636],
    [825, 636],
    [1058, 649],
    [1105, 686],
    [1110, 1024],
    [1088, 1047],
    [908, 1067],
    [877, 1115],
    [448, 1125],
    [421, 1091],
    [246, 1051],
    [210, 1010],
  ].map(([u, v]) => at(u, v));
  sheet(d, contour, face, [0, 0, -1]);
  sheet(
    d,
    contour.map((p) => [p[0], p[1], z + 0.2]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, [b[0], b[1], z + 0.2], [a[0], a[1], z + 0.2], m.trim, [0, 1, 0]);
  }
  // The Helionix glare visor (H145 and UH-72B cockpit photographs): a broad black hood wider than
  // the panel that overhangs the screens by some 20 cm, its ears dropping to mid-screen at the
  // panel face and sweeping up to a shallow rolled lip at its aft edge.
  {
    const visor = mat('H145-visor', '#1e2225', { side: T.DoubleSide, roughness: 0.8 }),
      half = 0.405,
      top = py(636) + 0.016,
      r = 0.035,
      arc = (cx, cy, a0, a1) =>
        [0, 1, 2, 3].map((i) => {
          const a = a0 + ((a1 - a0) * i) / 3;
          return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        }),
      sections = [2.26, 2.2, 2.14, 2.09, 2.055, 2.035].map((zz) => {
        const t = (zz - 2.035) / 0.225,
          bottom = top - 0.04 - 0.22 * t ** 1.4;
        return [
          [half, bottom],
          ...arc(half - r, top - r, 0, Math.PI / 2),
          [0, top + 0.008],
          ...arc(-half + r, top - r, Math.PI / 2, Math.PI),
          [-half, bottom],
        ].map(([x, y]) => [x, y, zz]);
      });
    for (let i = 0; i + 1 < sections.length; i++)
      for (let j = 0; j + 1 < sections[i].length; j++) {
        const a = sections[i][j],
          b = sections[i][j + 1],
          c = sections[i + 1][j + 1],
          e = sections[i + 1][j];
        quad(d, a, b, c, e, visor, [0, 1, 0]);
      }
    // Rolled lip along the aft edge.
    outline(d, sections.at(-1), 0.012, visor, false);
  }
  const screen = (u, v, w, h, kind) => {
    const x = px(u),
      y = py(v);
    if (kind === 'engine') {
      d.box([w + 0.045, h + 0.055, 0.027], [x, y, z - 0.012], m.trim);
      d.box([w, h, 0.008], [x, y, z - 0.03], d.dark);
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 2; col++) {
          const xx = x + (col - 0.5) * w * 0.5,
            yy = y + h * (0.3 - row * 0.24);
          for (let n = 0; n < 13; n++) {
            const a = (0.04 + n * 0.075) * Math.PI,
              b = a + 0.05;
            d.rod(
              [xx + Math.cos(a) * w * 0.18, yy + Math.sin(a) * w * 0.18, z - 0.041],
              [xx + Math.cos(b) * w * 0.18, yy + Math.sin(b) * w * 0.18, z - 0.041],
              0.001,
              d.ivory,
            );
          }
          d.rod([xx, yy, z - 0.043], [xx + w * 0.1, yy + w * 0.12, z - 0.043], 0.0015, d.green);
        }
      for (let i = 0; i < 4; i++) {
        d.box(
          [w * 0.09, h * 0.22, 0.002],
          [x + (i - 1.5) * w * 0.21, y - h * 0.19, z - 0.041],
          d.ivory,
        );
        d.box(
          [w * 0.05, h * 0.16, 0.003],
          [x + (i - 1.5) * w * 0.21, y - h * 0.17, z - 0.044],
          d.green,
        );
      }
      d.text('ENG 1   ENG 2', [x, y - h * 0.43, z - 0.047], 0.013, Math.PI, d.ivory);
    } else glassDisplay(d, x, y, z - 0.018, w, h, kind);
    for (const side of [-1, 1])
      for (let i = 0; i < 11; i++)
        d.box(
          [0.012, 0.014, 0.01],
          [x + side * (w / 2 + 0.014), y + h * (0.47 - i * 0.094), z - 0.033],
          face,
        );
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++)
        d.box(
          [0.014, 0.012, 0.01],
          [x + w * (0.45 - i * 0.15), y + side * (h / 2 + 0.014), z - 0.033],
          face,
        );
    pt.knob(x - w * 0.48, y - h * 0.56, z - 0.04, 0.011);
    return [x, y];
  };
  for (const u of [339, 980]) {
    const [x, y] = screen(u, 866, 0.239 * fit, 0.323 * fit, 'attitude');
    const g = group(cabin, `H145-horizon-${u}`, [x, y + 0.057 * fit, z - 0.062]),
      dd = detailKit(g, 'horizon');
    dd.box([0.061 * fit, 0.0014, 0.001], [0, 0, 0], dd.amber);
    dd.finish();
    bindings.push({ node: g.name, source: 'roll', property: 'rotation', axis: 'z', scale: -1 });
  }
  screen(720, 866, 0.239 * fit, 0.323 * fit, 'engine');
  glassDisplay(d, px(522), py(811), z - 0.018, 0.092 * fit, 0.094 * fit, 'attitude');
  d.box([0.46 * fit, 0.066 * fit, 0.025], at(675, 675, -0.006), m.trim);
  for (const u of [515, 780]) {
    d.box([0.031 * fit, 0.035 * fit, 0.013], at(u, 678, -0.025), d.red);
    outline(
      d,
      [
        at(u - 17, 660, -0.035),
        at(u + 17, 660, -0.035),
        at(u + 17, 696, -0.035),
        at(u - 17, 696, -0.035),
      ],
      0.002,
      m.metal,
    );
  }
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      d.box(
        [0.016 * fit, 0.011 * fit, 0.006],
        at(625 + c * 23, 668 + r * 17, -0.027),
        r === 0 ? d.amber : d.dark,
      );
  d.text('FIRE', [0, py(635), z - 0.032], 0.013, Math.PI, d.ivory);
  // Engine main switches (FLIGHT / IDLE / OFF) at the ends of the engine control panel under
  // the centre display (VFS photograph of N515AH, Heli-Expo 2019; ADAC ground rescue booklet):
  // yellow levers, each with its red flip guard outboard. Together they are the engine master.
  for (const [n, u] of [
    [1, 612],
    [2, 808],
  ]) {
    d.box([0.006, 0.034, 0.02], at(u + 16, 1060, -0.045), d.red);
    d.add(
      new T.CylinderGeometry(0.0075, 0.0075, 0.012, 14).rotateX(Math.PI / 2),
      m.metal,
      at(u, 1060, -0.039),
    );
    const { d: lever } = authoredControl(
      cabin,
      `H145-eng-mode-${n}`,
      at(u, 1060, -0.044),
      [0, Math.PI / 2, 0],
      {
        action: 'engine',
        motion: { property: 'rotation', axis: 'z', scale: 1.05, offset: -1.05 },
      },
    );
    engineMainSwitch(lever);
    lever.finish();
  }
  for (const u of [650, 690, 730, 770]) {
    d.box([0.03 * fit, 0.045 * fit, 0.015], at(u, 1073, -0.018), m.trim);
    d.text('ENG', at(u, 1038, -0.03), 0.007, Math.PI, d.ivory);
  }
  for (const u of [500, 530, 560])
    for (const v of [1045, 1076]) d.box([0.02 * fit, 0.022 * fit, 0.013], at(u, v, -0.02), m.trim);
  for (const u of [430, 891]) {
    d.ring(0.028 * fit, 0.004, at(u, 1060, -0.024), m.trim);
    d.add(new T.CircleGeometry(0.021 * fit, 16).rotateY(Math.PI), d.dark, at(u, 1060, -0.025));
  }
  for (const u of [230, 450, 840, 1080])
    for (const v of [655, 1036])
      d.add(new T.CircleGeometry(0.003, 8).rotateY(Math.PI), m.metal, at(u, v, -0.005));
  const pg = group(cabin, 'H145-pedestal', [0, 1.15, 1.96]);
  d.box([0.39, 0.05, 0.05], [0, 1.46, 2.225], face);
  pg.rotation.x = 0.7;
  const pd = detailKit(pg, 'pedestal'),
    ppt = panelTools(pd);
  pd.box([0.55, 0.82, 0.15], [0, 0, 0.06], face);
  d.box([0.48, 0.22, 0.27], [0, 0.98, 2.105], face);
  for (const x of [-0.134, 0.134]) {
    glassDisplay(pd, x, 0.22, -0.033, 0.2, 0.18, 'map');
    ppt.knob(x - 0.09, 0.1, -0.065, 0.012);
  }
  // Under the navigators (VFS photograph of N515AH, Heli-Expo 2019; AERO 2016 H145): the ELT
  // strip with its red switch and a small selector beside it, then the two crew audio
  // panels side by side, each a row of eight receiver volume knobs above and below the
  // transmit selector, intercom volume, red back-up switch and test/voice buttons.
  pd.box([0.2, 0.034, 0.012], [0.03, -0.003, -0.025], m.trim);
  pd.text('ELT', [0.105, -0.003, -0.0315], 0.009, Math.PI, pd.ivory);
  pd.box([0.022, 0.012, 0.007], [0.03, -0.003, -0.0345], pd.red);
  pd.box([0.06, 0.034, 0.012], [-0.13, -0.003, -0.025], m.trim);
  ppt.knob(-0.13, -0.003, -0.0375, 0.009);
  for (const x0 of [-0.116, 0.116]) {
    pd.box([0.222, 0.21, 0.015], [x0, -0.14, -0.025], m.trim);
    for (const y of [-0.065, -0.215])
      for (let i = 0; i < 8; i++) ppt.knob(x0 - 0.0875 + i * 0.025, y, -0.039, 0.0075);
    ppt.knob(x0, -0.14, -0.039, 0.011);
    ppt.knob(x0 - 0.065, -0.14, -0.039, 0.012);
    pd.text('TX', [x0, -0.115, -0.0335], 0.007, Math.PI, pd.ivory);
    pd.box([0.016, 0.016, 0.006], [x0 + 0.045, -0.135, -0.0355], pd.dark);
    pd.box([0.006, 0.006, 0.012], [x0 + 0.045, -0.135, -0.0435], pd.red);
    for (const y of [-0.12, -0.155])
      pd.box([0.018, 0.013, 0.006], [x0 + 0.087, y, -0.0355], pd.dark);
  }
  pd.finish();
  // Crew sit high in the photographs: 0.3 m above the belly, the cushion is 0.8 m under the eye.
  // The raised deck is trimmed to the shell's belly corners.
  fittedFloor(
    d,
    [-2, -1.5, -0.6, 0.55, 1.72, 2.25].map((q) => ({
      z: q,
      points: Array.from({ length: 48 }, (_, j) => shell.at(q, -0.5 + j / 48).slice(0, 2)),
    })),
    m.trim,
    { y: 0.88, front: 2.065, back: -1.845, width: 1.6, thickness: 0.04 },
  );
  // Cabin lining 2 cm inside the skin, open at every window, with reveals round each opening.
  // The headliner and door skins are light grey (UH-72A/B and H145M cabin photographs); the
  // reveals round the windows and the windscreen post keep the dark grey of the posts.
  const lining = mat('H145-cabin-lining', '#b9bcb8');
  shell.build(
    d,
    lining,
    apertures.map((poly) => ({ poly, material: null })),
    shell.samples(0.35).filter((q) => q > -2.32 && q < 3.36),
    22,
    0.02,
  );
  for (const poly of apertures) shell.reveal(d, poly, 0.021, face);
  // The slim post between the windscreen halves, seen from the seats: dark inside the glass.
  shell.strip(
    d,
    [
      [1.7, 0],
      [3.36, 0],
    ],
    0.09,
    face,
    true,
    false,
    0.004,
    -0.006,
  );
  const addSeat = (x, y, z) => {
    beveledBox(d, [0.43, 0.12, 0.48], [x, y, z], upholstery);
    beveledBox(d, [0.44, 0.65, 0.12], [x, y + 0.32, z - 0.23], upholstery);
    beveledBox(d, [0.25, 0.19, 0.13], [x, y + 0.7, z - 0.24], upholstery);
    for (const side of [-1, 1]) {
      d.rod([x + side * 0.17, 0.88, z - 0.1], [x + side * 0.17, y - 0.06, z - 0.1], 0.017, m.metal);
      sheet(
        d,
        [
          [x + side * 0.16, y + 0.58, z - 0.16],
          [x + side * 0.12, y + 0.58, z - 0.16],
          [x - side * 0.02, y + 0.08, z + 0.17],
          [x + side * 0.02, y + 0.08, z + 0.17],
        ],
        belt,
        [0, 0, 1],
      );
    }
    d.box([0.06, 0.035, 0.022], [x, y + 0.09, z + 0.18], m.metal);
  };
  for (const side of [-1, 1]) {
    const x = side * 0.43;
    addSeat(x, 1.22, 1.36);
    // Cranked cyclic with the Helionix grip: four-way trim beeper on the head, the AP/trim
    // release and the red cargo-hook guard under the thumb, the radio trigger in front.
    const cg = group(cabin, `H145-cyclic-${side}`, [x, 0.88, 1.82]),
      cd = detailKit(cg, 'cyclic');
    addParts(cd, [
      [
        m.trim,
        lathe(
          [
            [0, 0],
            [0.05, 0],
            [0.047, 0.014],
            [0.035, 0.024],
            [0.033, 0.036],
            [0.023, 0.05],
            [0.02, 0.065],
            [0, 0.065],
          ],
          18,
          28,
        ),
      ],
      [
        cd.dark,
        tube(
          [
            [0, 0.05, 0],
            [0, 0.25, 0],
            [0, 0.31, -0.07],
            [0, 0.38, -0.18],
            [0, 0.43, -0.207],
            [0, 0.505, -0.21],
          ],
          0.014,
          14,
        ),
      ],
    ]);
    h145Grip(posedKit(cd, [0, 0.5, -0.21]));
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `H145-collective-${side}`, [x + 0.25, 1.01, 1.08]),
      ld = detailKit(lg, 'collective');
    turbineCollective(posedKit(ld, [0, 0, 0], [Math.atan2(0.45, 0.14), 0, 0]), {
      head: 'h145',
      length: 0.52,
      side: -1,
    });
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const j of [-1, 1]) {
      const g = group(cabin, `H145-pedal-${side}-${j}`, [x + j * 0.12, 0.98, 2.2]),
        dd = detailKit(g, 'pedal');
      pedalGeometry(dd, { style: 'heli', side: j, scale: 1.12, lean: 0.25, drop: 0.04 });
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
  for (const z of [0.06, -1.08]) for (const x of [-0.54, 0, 0.54]) addSeat(x, 1.2, z);
  // Overhead console (UH-72B photographs, SC National Guard 2023; UH-72A, DVIDS 2024; the H145
  // D3 keeps this upper console): one dark moulded console on the centreline, a shield widest
  // over the crew's heads that narrows into a neck running forward along the windscreen post
  // between the upper panes. Circuit breakers in two blocks either side of a spine fill its aft
  // two-thirds; rows of silver bat toggles cross its forward end. No engine controls here.
  const og = group(cabin, 'H145-overhead', [0, 0, 0]),
    od = detailKit(og, 'overhead'),
    OP = partPalette(),
    plan = [
      // [z, half width, underside y, top y]
      [1.06, 0.16, 2.305, 2.372],
      [1.075, 0.212, 2.292, 2.372],
      [1.1, 0.235, 2.288, 2.372],
      [1.3, 0.23, 2.288, 2.372],
      [1.48, 0.2, 2.289, 2.372],
      [1.6, 0.152, 2.295, 2.372],
      [1.7, 0.092, 2.305, 2.372],
      [1.8, 0.06, 2.317, 2.372],
      [1.95, 0.048, 2.333, 2.37],
      [2.08, 0.045, 2.343, 2.359],
    ];
  od.add(
    place(
      loftUp(
        plan.map(([zz, w, under, over]) => ({
          y: zz,
          points: superellipse(0, -(under + over) / 2, w, (over - under) / 2, 24, 6),
        })),
      ),
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
    ),
    face,
  );
  const under = 2.2875,
    halfAt = (zz) => {
      const i = plan.findIndex(([pz]) => pz > zz);
      const [z0, w0] = plan[i - 1],
        [z1, w1] = plan[i];
      return w0 + ((w1 - w0) * (zz - z0)) / (z1 - z0);
    },
    plate = (z0, z1, x0, x1, material) =>
      sheet(
        od,
        [
          [x0, under - 0.001, z0],
          [x1, under - 0.001, z0],
          [x1, under - 0.001, z1],
          [x0, under - 0.001, z1],
        ],
        material,
        [0, -1, 0],
      );
  // Breaker blocks: black plates, rows of breaker heads over white legend lines.
  for (const side of [-1, 1]) {
    plate(1.1, 1.405, side * 0.018, side * 0.198, OP.black);
    for (let r = 0; r < 8; r++) {
      const zz = 1.122 + r * 0.038;
      od.box([0.17, 0.0015, 0.0025], [side * 0.108, under - 0.0017, zz - 0.012], od.ivory);
      for (let j = 0; j < 8; j++)
        od.box([0.0105, 0.007, 0.0105], [side * (0.036 + j * 0.0205), under - 0.004, zz], od.dark);
    }
  }
  // Toggle rows at the forward end, on a black plate that follows the narrowing shield.
  sheet(
    od,
    [
      [halfAt(1.43) - 0.02, under - 0.001, 1.43],
      [-halfAt(1.43) + 0.02, under - 0.001, 1.43],
      [-halfAt(1.585) + 0.02, under - 0.0005, 1.585],
      [halfAt(1.585) - 0.02, under - 0.0005, 1.585],
    ],
    OP.black,
    [0, -1, 0],
  );
  for (const [zz, count] of [
    [1.45, 11],
    [1.495, 10],
    [1.545, 8],
  ]) {
    const span = 0.034;
    for (let j = 0; j < count; j++) {
      const x = (j - (count - 1) / 2) * span;
      od.add(bar([x, under - 0.002, zz], [x, under - 0.019, zz - 0.006], 0.0022, 8), OP.alloy);
      od.box([0.012, 0.0015, 0.003], [x, under - 0.0017, zz + 0.014], od.ivory);
    }
  }
  // Guards over the battery master and generator switches, red at the aft centre.
  for (const x of [0.085, -0.085])
    od.box([0.016, 0.012, 0.022], [x, under - 0.007, 1.45], OP.black);
  od.box([0.022, 0.006, 0.03], [0, under - 0.004, 1.12], d.red);
  od.finish();
  // Rotor brake (ADAC ground rescue booklet): a floor lever outboard of the pilot's (right)
  // seat, pulled back to brake: rubber boot, grey shaft with a yellow band, release knob on top.
  addParts(
    d,
    [
      [
        d.dark,
        lathe(
          [
            [0.03, 0],
            [0.028, 0.012],
            [0.016, 0.04],
            [0.011, 0.06],
            [0, 0.062],
          ],
          14,
        ).translate(0, 0.9, 0),
      ],
      [m.metal, bar([0, 0.92, 0], [0, 1.3, 0.11], 0.0095, 12)],
      [d.amber, bar([0, 1.13, 0.051], [0, 1.18, 0.066], 0.0105, 12)],
      [d.dark, place(roundedBox([0.03, 0.05, 0.03], 0.01), [0, 1.31, 0.115], [0.28, 0, 0])],
    ].map(([material, geometry]) => [material, geometry.translate(-0.715, 0, 1.18)]),
  );
  // Header over the clamshell doors: the tail boom's root, inside the pod's rear dome, showed
  // from the cabin as a blue disc under the ceiling.
  const header = shell.vAt(-2.3, 1.76, 1);
  sheet(
    d,
    Array.from({ length: 25 }, (_, j) => {
      const [x, y] = shell.at(-2.3, -header + (2 * header * j) / 24);
      return [x * 0.985, 1.76 + (y - 1.76) * 0.97, -2.3];
    }),
    face,
    [0, 0, 1],
  );
  d.finish();
  return { nodes: ['cockpit'], bindings };
}

/** An engine main switch from its pivot, in a mount turned so local +X points at the crew and
 * the bound rotation about local Z swings it from FLIGHT (up) through IDLE to OFF (down): an
 * alloy stem and the yellow teardrop paddle, its broad face toward the crew. */
function engineMainSwitch(d) {
  const P = partPalette(),
    up = 0.5,
    tip = [Math.cos(up) * 0.01, Math.sin(up) * 0.01, 0];
  addParts(d, [
    [P.alloy, bar([0, 0, 0], tip, 0.0026, 10)],
    [
      P.yellow,
      place(
        lathe(
          [
            [0, 0],
            [0.0042, 0.002],
            [0.0046, 0.011],
            [0.0072, 0.021],
            [0.0078, 0.027],
            [0.0052, 0.033],
            [0, 0.034],
          ],
          14,
        ),
        tip,
        [0, 0, up - Math.PI / 2],
        [0.55, 1, 1],
      ),
    ],
  ]);
}

/** The Helionix cyclic grip from its base (+Y up, trigger forward +Z, the pilot at -Z). */
function h145Grip(d) {
  const P = partPalette();
  addParts(d, [
    [
      P.alloy,
      lathe(
        [
          [0, 0],
          [0.017, 0],
          [0.018, 0.012],
          [0, 0.012],
        ],
        16,
      ),
    ],
    [
      P.grip,
      gripBody([
        [0.01, 0, 0.017, 0.019, 2],
        [0.045, 0.002, 0.0195, 0.022, 2],
        [0.085, 0.004, 0.0195, 0.022, 2.1],
        [0.11, 0.01, 0.023, 0.026, 2.4],
        [0.13, 0.016, 0.027, 0.03, 2.8],
        [0.147, 0.018, 0.026, 0.029, 2.8],
        [0.155, 0.018, 0.015, 0.018, 2.4],
      ]),
    ],
    // Four-way beeper: a cross hat on a boss, under the thumb on the head.
    [P.black, place(new T.CylinderGeometry(0.008, 0.009, 0.006, 16), [0.004, 0.157, 0.006])],
    [P.black, place(roundedBox([0.016, 0.004, 0.006], 0.0015), [0.004, 0.161, 0.006])],
    [P.black, place(roundedBox([0.006, 0.004, 0.016], 0.0015), [0.004, 0.161, 0.006])],
    // AP/trim release on the back of the head, the red cargo release under its guard.
    [
      P.black,
      place(
        new T.CylinderGeometry(0.0055, 0.0055, 0.008, 14),
        [-0.008, 0.142, -0.012],
        [Math.PI / 2, 0, 0],
      ),
    ],
    [P.red, place(roundedBox([0.01, 0.01, 0.008], 0.002), [0.02, 0.138, -0.006])],
    [P.black, place(roundedBox([0.003, 0.016, 0.016], 0.001), [0.027, 0.14, -0.004])],
    [P.yellow, place(roundedBox([0.01, 0.008, 0.008], 0.002), [-0.022, 0.133, 0.012])],
    // Radio trigger in front.
    [
      P.black,
      tube(
        [
          [0, 0.112, 0.026],
          [0, 0.1, 0.036],
          [0, 0.088, 0.032],
        ],
        0.005,
        10,
      ),
    ],
  ]);
}

/** Convex (z, y) outline with every corner rounded off `r` along both of its edges. */
function fillet(points, r) {
  return points.flatMap((p, i) => {
    const toward = (q) => {
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]),
          k = Math.min(r, l * 0.45) / l;
        return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      },
      s = toward(points[(i + points.length - 1) % points.length]),
      e = toward(points[(i + 1) % points.length]);
    return [0, 0.25, 0.5, 0.75, 1].map((t) =>
      [0, 1].map((k) => (1 - t) * (1 - t) * s[k] + 2 * t * (1 - t) * p[k] + t * t * e[k]),
    );
  });
}
