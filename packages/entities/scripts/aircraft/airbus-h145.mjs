/** H145 D3, traced in meter space from Airbus Ground Rescue Booklet 3061-S-00
 * rev.1, page 4. Helionix face follows page 16; see reference-review.json.
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
import { cabinShell } from './robinson-r44.mjs';
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
  panelZ: 2.12,
  floor: 0.56,
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
    // Sliding-door rail under the roof shoulder.
    d.rod(q(0.45, 2.19, 0.016), q(-1.4, 2.11, 0.016), 0.014, metal);
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
    d.text('H145', q(-0.42, 1.15, 0.008), 0.09, (side * Math.PI) / 2, paint);
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
    // The underside follows the roof, so no slab hangs inside the cabin.
    const under = (x) => Math.min(b, shell.at(z, roof(z, x))[1] - 0.03),
      foot = under(w),
      y = t - (t - foot) * 0.62;
    return {
      z,
      points: [
        [-w, foot],
        ...Array.from({ length: 13 }, (_, k) => {
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
        [w, foot],
        ...[0.6, 0, -0.6].map((k) => [k * w, under(k * w) + 0.05]),
      ],
    };
  };
  const cowls = [
    cr(1.48, 0.32, 2.36, 2.62),
    cr(0.68, 0.61, 2.37, 2.99),
    cr(-0.45, 0.65, 2.3, 3.0),
    cr(-1.5, 0.56, 2.23, 2.75),
    cr(-2.6, 0.3, 2.06, 2.35),
  ];
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
  const yz = [
      [2.3, -5.91],
      [3.96, -7.06],
      [4, -8.1],
      [3.03, -7.77],
      [2.1, -8.19],
      [1.05, -7.66],
      [0.98, -6.71],
      [1.63, -6.28],
    ],
    cy = 2.12,
    cz = -7.02,
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
  const interior = cockpit(root, { white, paint, trim, metal }, shell);
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

function cockpit(root, m, shell) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'H145-cockpit'),
    bindings = [],
    face = mat('H145-panel', '#384248'),
    upholstery = mat('H145-seats', '#51616b'),
    belt = mat('H145-harness', '#b1b2a9'),
    z = 2.12,
    k = 1.16 / 910;
  // Coordinates on the 1335px page preview; uniform assumed panel width.
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
    contour.map((p) => [p[0], p[1], z + 0.26]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, [b[0], b[1], z + 0.26], [a[0], a[1], z + 0.26], m.trim, [0, 1, 0]);
  }
  outline(d, contour.slice(0, 8), 0.026, m.trim, false);
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
    const [x, y] = screen(u, 866, 0.239, 0.323, 'attitude');
    const g = group(cabin, `H145-horizon-${u}`, [x, y + 0.057, z - 0.062]),
      dd = detailKit(g, 'horizon');
    dd.box([0.061, 0.0014, 0.001], [0, 0, 0], dd.amber);
    dd.finish();
    bindings.push({ node: g.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 });
  }
  screen(720, 866, 0.239, 0.323, 'engine');
  glassDisplay(d, px(522), py(811), z - 0.018, 0.092, 0.094, 'attitude');
  d.box([0.46, 0.066, 0.025], at(675, 675, -0.006), m.trim);
  for (const u of [515, 780]) {
    d.box([0.031, 0.035, 0.013], at(u, 678, -0.025), d.red);
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
        [0.016, 0.011, 0.006],
        at(625 + c * 23, 668 + r * 17, -0.027),
        r === 0 ? d.amber : d.dark,
      );
  d.text('FIRE', [0, py(635), z - 0.032], 0.013, Math.PI, d.ivory);
  for (const u of [610, 810]) {
    pt.knob(px(u), py(1064), z - 0.04, 0.016);
    d.rod(at(u, 1055, -0.043), at(u, 1083, -0.065), 0.006, d.amber);
  }
  for (const u of [650, 690, 730, 770]) {
    d.box([0.03, 0.045, 0.015], at(u, 1073, -0.018), m.trim);
    d.text('ENG', at(u, 1038, -0.03), 0.007, Math.PI, d.ivory);
  }
  for (const u of [500, 530, 560])
    for (const v of [1045, 1076]) d.box([0.02, 0.022, 0.013], at(u, v, -0.02), m.trim);
  for (const u of [430, 891]) {
    d.ring(0.028, 0.006, at(u, 1060, -0.024), m.trim);
    d.add(new T.CircleGeometry(0.021, 16).rotateY(Math.PI), d.dark, at(u, 1060, -0.025));
  }
  for (const u of [230, 450, 840, 1080])
    for (const v of [655, 1036])
      d.add(new T.CircleGeometry(0.003, 8).rotateY(Math.PI), m.metal, at(u, v, -0.005));
  const pg = group(cabin, 'H145-pedestal', [0, 0.91, 1.71]);
  d.box([0.53, 0.05, 0.22], [0, 1.2, 2.04], face);
  pg.rotation.x = 0.7;
  const pd = detailKit(pg, 'pedestal'),
    ppt = panelTools(pd);
  pd.box([0.55, 0.82, 0.15], [0, 0, 0.06], face);
  d.box([0.48, 0.3, 0.67], [0, 0.72, 1.61], face);
  for (const x of [-0.134, 0.134]) {
    glassDisplay(pd, x, 0.22, -0.033, 0.2, 0.18, 'map');
    ppt.knob(x - 0.09, 0.1, -0.065, 0.012);
  }
  for (let row = 0; row < 3; row++) {
    pd.box([0.46, 0.07, 0.015], [0, -0.02 - row * 0.094, -0.025], m.trim);
    pd.box([0.27, 0.025, 0.003], [0, -0.01 - row * 0.094, -0.035], pd.dark);
    pd.text(
      ['COM 1 124.85', 'NAV 1 114.20', 'TRANSPONDER'][row],
      [0, -0.015 - row * 0.094, -0.04],
      0.011,
      Math.PI,
      pd.green,
    );
    for (const x of [-0.2, 0.2]) ppt.knob(x, -0.02 - row * 0.094, -0.05, 0.015);
  }
  pd.finish();
  // Cabin deck trimmed to the rolled-under belly corners of the shell.
  fittedFloor(
    d,
    [-2, -1.5, -0.6, 0.55, 1.72, 2.25].map((q) => ({
      z: q,
      points: Array.from({ length: 48 }, (_, j) => shell.at(q, -0.5 + j / 48).slice(0, 2)),
    })),
    m.trim,
    { y: 0.58, front: 2.065, back: -1.845, width: 1.6, thickness: 0.04 },
  );
  const addSeat = (x, y, z) => {
    beveledBox(d, [0.43, 0.12, 0.48], [x, y, z], upholstery);
    beveledBox(d, [0.44, 0.65, 0.12], [x, y + 0.32, z - 0.23], upholstery);
    beveledBox(d, [0.25, 0.19, 0.13], [x, y + 0.7, z - 0.24], upholstery);
    for (const side of [-1, 1]) {
      d.rod(
        [x + side * 0.17, y - 0.25, z - 0.1],
        [x + side * 0.17, y - 0.06, z - 0.1],
        0.017,
        m.metal,
      );
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
    addSeat(x, 0.91, 1.36);
    const cg = group(cabin, `H145-cyclic-${side}`, [x, 0.58, 1.75]),
      cd = detailKit(cg, 'cyclic');
    outline(
      cd,
      [
        [0, 0, 0],
        [0, 0.26, 0],
        [0, 0.4, -0.21],
        [0, 0.57, -0.21],
      ],
      0.018,
      m.trim,
      false,
    );
    beveledBox(cd, [0.065, 0.14, 0.07], [0, 0.58, -0.21], m.trim, 0.01);
    cd.box([0.02, 0.018, 0.015], [0, 0.64, -0.25], cd.red);
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `H145-collective-${side}`, [x + 0.25, 0.71, 1.08]),
      ld = detailKit(lg, 'collective');
    ld.rod([0, 0, 0], [0, 0.14, 0.45], 0.021, m.trim);
    ld.box([0.065, 0.06, 0.15], [0, 0.14, 0.45], m.trim);
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const k of [-1, 1]) {
      // Pedals clear the rolled-under nose floor.
      const g = group(cabin, `H145-pedal-${side}-${k}`, [x + k * 0.12, 0.72, 2.2]),
        dd = detailKit(g, 'pedal');
      dd.rod([-0.075, 0, 0], [0.075, 0, 0], 0.017, m.trim);
      dd.rod([0, 0, 0], [0, -0.08, 0.06], 0.012, m.metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -k * 0.04,
      });
    }
  }
  for (const z of [0.06, -1.08]) for (const x of [-0.54, 0, 0.54]) addSeat(x, 0.9, z);
  // Narrow overhead switch bank and rotor brake, visible from the crew seats.
  const og = group(cabin, 'H145-overhead', [0, 2.3, 1.14]),
    od = detailKit(og, 'overhead');
  od.box([0.3, 0.04, 0.72], [0, 0, 0], m.trim);
  for (let r = 0; r < 7; r++)
    for (const x of [-0.085, 0, 0.085])
      od.rod([x, -0.025, -0.25 + r * 0.075], [x, -0.065, -0.24 + r * 0.075], 0.004, m.metal);
  od.finish();
  d.rod([0.12, 1.0, 0.72], [0.12, 1.3, 0.81], 0.012, d.red);
  d.finish();
  return { nodes: ['cockpit'], bindings };
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
