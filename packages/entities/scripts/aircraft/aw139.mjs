/** AW139 short nose, dimensioned from operator/EASA drawings, with Primus Epic cockpit.
 * Own shell stations, glazing apertures and panel layout; no generic helicopter body.
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
export const aw139Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 1.13,
  cy: 1.35,
  ry: 0.95,
  cabinZ: 2.24,
  cabinWidth: 2.1,
  eye: [-0.48, 1.82, 2.24],
  panelZ: 2.88,
  floor: 0.58,
  mainRotorPosition: [0, 3.57, 0],
});
export function buildAW139(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('AW139-white', '#e5e6df', { side: T.DoubleSide }),
    accent = mat('AW139-teal', '#30666b', { side: T.DoubleSide }),
    trim = mat('AW139-trim', '#252e31'),
    metal = mat('AW139-metal', '#a0aaa7', { metalness: 0.65 }),
    rubber = mat('AW139-tire', '#25292a'),
    glass = mat('AW139-glass', '#9cbec6', {
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    }),
    // Eyebrow, chin and lower door panes are dark tinted in the photos.
    tint = mat('AW139-tinted-glass', '#2f464e', {
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'AW139-shell');
  // Side profile and plan keep the fitted stations (radome bulb 0.36 m half-width 0.16 m behind
  // the tip, roof 2.25 m). Head-on (JCG front photo) the cabin is a rounded box: walls widest at
  // the window sills, roof shoulders rolling over about 0.3 m and the belly corners tucked under,
  // so the windscreen, eyebrow and cabin glazing curve with the skin, which runs on into the boom.
  const shell = cabinShell(
    [
      // z, half width, keel, crown, widest at, superellipse exponent above / below it
      [4.42, 0.36, 0.58, 0.98, 0.76, 3, 2.8],
      [4.2, 0.6, 0.47, 1.14, 0.78, 3.4, 3],
      [3.65, 0.84, 0.365, 1.31, 0.84, 3.8, 3.4],
      [3.2, 0.99, 0.355, 1.45, 0.92, 4.2, 3.8],
      [2.22, 1.09, 0.355, 2.16, 1.15, 4.4, 4.2],
      [1.5, 1.13, 0.345, 2.25, 1.28, 4.6, 4.5],
      [0.1, 1.13, 0.345, 2.25, 1.3, 4.6, 4.5],
      [-1.8, 1.13, 0.405, 2.25, 1.32, 4.6, 4.5],
      [-2.85, 0.93, 0.705, 2.18, 1.42, 4, 3.6],
      [-3.55, 0.63, 1.045, 2.12, 1.6, 3.4, 3],
      [-6.95, 0.23, 1.645, 2.01, 1.86, 2.8, 2.4],
      [-8.3, 0.16, 1.905, 2.17, 2.06, 2.6, 2.4],
      [-8.8, 0.08, 2.005, 2.23, 2.13, 2.4, 2.4],
    ],
    [4.58, 0.78, 0.35],
    [-8.9, 2.13, 0.4],
  );
  // Rings every 0.25 m over the cabin, every 0.5 m along the slender boom.
  const zs = [
      ...shell.samples(0.5).filter((z) => z < -3.55),
      ...shell.samples(0.25).filter((z) => z >= -3.55),
    ],
    v = (z, y, side) => shell.vAt(z, y, side),
    roof = (z, x) => Math.sign(x) * shell.vAtX(z, Math.abs(x)),
    onRoof = (z, x, lift = 0) => {
      const a = roof(z, x),
        n = shell.normal(z, a);
      return shell.at(z, a).map((c, k) => c + n[k] * lift);
    };
  // Two wrap-around windscreen panes either side of a broad painted post, with eyebrow windows
  // on the roof shoulders behind their top edge (JCG front, EBACE and Volandia photos).
  const panes = [-1, 1].map((side) =>
      shell.region([
        // The post edge is sampled along its length so the post keeps one width.
        ...[3.2, 2.95, 2.7, 2.45, 2.22].map((z) => [z, roof(z, side * 0.055)]),
        [2.22, v(2.22, 1.98, side)],
        [3.2, v(3.2, 1.27, side)],
      ]),
    ),
    eyebrows = [-1, 1].map((side) =>
      shell.region([
        [2.15, roof(2.15, side * 0.5)],
        [1.62, roof(1.62, side * 0.6)],
        [1.62, v(1.62, 2.06, side)],
        [2.15, v(2.15, 2.0, side)],
      ]),
    );
  // Cabin windows are tall panes with generous corner radii (JCG left-side photos).
  const rounded = (z, y, w, h) => [
    [z - w / 2, y - h / 2],
    [z + w / 2, y - h / 2],
    [z + w / 2, y + h / 2],
    [z - w / 2, y + h / 2],
  ];
  const windows = [-1, 1].flatMap((side) =>
    [
      [
        [
          [3.55, 0.64],
          [3.12, 0.63],
          [2.96, 0.78],
          [3.08, 1.08],
          [3.55, 0.97],
        ],
        0.05,
      ],
      [
        [
          [3.03, 1.15],
          [2.19, 1.98],
          [1.7, 2.02],
          [1.68, 1.12],
        ],
        0.09,
      ],
      [
        [
          [2.98, 0.64],
          [1.72, 0.64],
          [1.72, 0.91],
          [2.77, 0.96],
        ],
        0.05,
      ],
      [rounded(1.13, 1.6, 0.57, 0.78), 0.15],
      [rounded(0.27, 1.59, 0.63, 0.8), 0.15],
      [rounded(-0.58, 1.59, 0.63, 0.8), 0.15],
    ].map(([a, r]) => shell.region(fillet(a, r).map(([z, y]) => [z, y, side]))),
  );
  // Cheat line from the nose under the doors and up the boom, one strip per skin bay.
  const stripe = [
      [-8.3, 2.04],
      [-6.95, 1.77],
      [-3.55, 1.17],
      [-1.85, 0.53],
      [1.5, 0.48],
      [3.6, 0.64],
      [4.32, 0.76],
    ],
    stripeY = (z) => {
      const i = Math.max(
          1,
          stripe.findIndex(([q]) => q >= z),
        ),
        [za, ya] = stripe[i - 1],
        [zb, yb] = stripe[i];
      return ya + ((yb - ya) * (z - za)) / (zb - za);
    },
    stripeZ = zs.filter((z) => z >= -8.3 && z <= 4.32),
    band = (z, side) => [
      [z, stripeY(z), side],
      [z, stripeY(z) + 0.085, side],
    ];
  const bands = [-1, 1].flatMap((side) =>
    stripeZ.slice(1).map((z, i) => shell.region([...band(stripeZ[i], side), ...band(z, side)])),
  );
  shell.build(
    d,
    paint,
    [
      // Per side, windows 0 and 2 are the chin and lower door panes.
      ...[...panes, ...windows.filter((_, i) => i % 6 !== 0 && i % 6 !== 2)].map((poly) => ({
        poly,
        material: glass,
      })),
      ...[...eyebrows, ...windows.filter((_, i) => i % 6 === 0 || i % 6 === 2)].map((poly) => ({
        poly,
        material: tint,
      })),
      ...bands.map((poly) => ({ poly, material: accent })),
    ],
    zs,
    28,
  );
  for (const poly of panes) shell.strip(d, poly, 0.032, trim);
  for (const poly of [...eyebrows, ...windows]) shell.strip(d, poly, 0.03, trim, false);
  for (const side of [-1, 1]) {
    const q = (z, y, lift = 0) => shell.point(z, y, side, lift);
    for (const a of [
      [
        [3.12, 0.56],
        [3.12, 1.2],
        [2.22, 2.12],
        [1.58, 2.15],
        [1.58, 0.56],
      ],
      [
        [1.47, 0.55],
        [1.47, 2.13],
        [0.77, 2.13],
        [0.77, 0.55],
      ],
      [
        [0.7, 0.53],
        [0.7, 2.16],
        [-1.1, 2.16],
        [-1.1, 0.53],
      ],
    ])
      shell.strip(d, shell.region(a.map(([z, y]) => [z, y, side])), 0.008, trim, false);
    // Sliding-door rails follow the roof shoulder and the rolled-under belly.
    for (const [y, r] of [
      [2.2, 0.018],
      [0.52, 0.017],
    ])
      d.rod(q(0.75, y, 0.022), q(-1.72, y, 0.022), r, metal);
    for (const z of [1.55, 0.73, -1.1])
      for (let i = 0; i < 14; i++)
        d.add(new T.SphereGeometry(0.0033, 5, 3), metal, q(z, 0.62 + i * 0.1, 0.001));
    for (const z of [1.75, 1.22, -0.9])
      d.rod(q(z, 0.99, 0.012), q(z + 0.15, 0.99, 0.012), 0.013, metal);
    // Turned with the boom's taper so the whole name stays clear of the skin.
    d.text('AW139', q(-4.6, 1.68, 0.02), 0.11, side * (Math.PI / 2 + 0.12), accent);
    // Stub sponsons enclose the main-gear wells and carry the boarding step.
    const sg = group(root, `AW139-sponson-${side}`, [side * 1.3, 0.67, -1.1]),
      sd = detailKit(sg, 'sponson');
    loft(
      sd,
      [
        [0.87, 0.15],
        [0.55, 0.43],
        [-0.53, 0.45],
        [-0.8, 0.14],
      ].map(([z, w]) => ({
        z,
        // Rounded fairing outboard; the inner edge reaches in under the rolled belly corner.
        points: [
          [-side * 0.36, -0.1],
          ...Array.from({ length: 11 }, (_, k) => {
            const a = ((k - 5) * Math.PI) / 10,
              s = Math.sin(a);
            return [
              side * w * Math.pow(Math.cos(a), 2 / 2.6),
              0.015 + 0.175 * Math.sign(s) * Math.pow(Math.abs(s), 2 / 2.6),
            ];
          }),
          [-side * 0.36, 0.12],
        ],
      })),
      paint,
    );
    sd.box([0.23, 0.015, 0.56], [side * 0.12, -0.166, -0.07], trim);
    sd.finish();
    d.rod([side * 1.18, 0.35, 0.4], [side * 1.44, 0.35, 0.4], 0.02, metal);
    d.rod([side * 1.44, 0.35, 0.4], [side * 1.44, 0.35, -0.9], 0.024, metal);
    d.rod([side * 1.44, 0.35, -0.9], [side * 1.18, 0.35, -0.9], 0.02, metal);
    d.box([0.055, 0.055, 0.07], q(1.37, 2.05, 0.02), side < 0 ? d.green : d.red);
  }
  // Frame joints around the skin.
  for (const z of [1.55, 0.73, -1.1, -1.9, -2.85, -4.6, -6.3])
    shell.strip(
      d,
      Array.from({ length: 16 }, (_, k) => [z, -0.5 + k / 16]),
      0.006,
      metal,
      false,
    );
  // Broad integrated transmission fairing (JCG front photo): flanks leaning in slightly under a
  // rounded crown, its foot following the curved roof so no gap opens at the shoulders.
  const cowl = (z, w, b, t) => {
    // The foot flares out into the roof before the flank rises (JCG front photo); the underside
    // follows the roof, so no slab hangs inside the cabin.
    const under = (x) => Math.min(b, shell.at(z, roof(z, x))[1] - 0.03),
      foot = under(w * 1.12),
      y = t - (t - foot) * 0.62;
    return {
      z,
      points: [
        [-w * 1.12, foot],
        [-w, foot + 0.07],
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
        [w, foot + 0.07],
        [w * 1.12, foot],
        ...[0.6, 0, -0.6].map((k) => [k * w, under(k * w) + 0.05]),
      ],
    };
  };
  const cowls = [
    cowl(2.0, 0.46, 2.12, 2.28),
    cowl(0.65, 0.71, 2.25, 2.89),
    cowl(0.26, 0.66, 2.25, 3.13),
    cowl(-0.55, 0.81, 2.25, 3.13),
    cowl(-1.55, 0.78, 2.23, 2.96),
    cowl(-2.78, 0.62, 2.18, 2.57),
    cowl(-3.2, 0.44, 2.13, 2.28),
  ];
  loft(d, cowls, paint);
  /** Half width of the fairing at station z and height y (its +X flank). */
  const cowlX = (z, y) => {
    const i = Math.max(
        1,
        cowls.findIndex((c) => c.z <= z),
      ),
      a = cowls[i - 1],
      b = cowls[i],
      u = (z - a.z) / (b.z - a.z),
      flank = a.points
        .slice(8, 17)
        .map((p, k) => p.map((c, j) => c + (b.points[k + 8][j] - c) * u));
    for (let k = 0; k < flank.length - 1; k++) {
      const [x0, y0] = flank[k],
        [x1, y1] = flank[k + 1];
      if ((y - y0) * (y - y1) <= 0) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
    return flank.at(-1)[0];
  };
  for (const side of [-1, 1]) {
    // Engine intake grille on the flank, following its lean into the crown.
    for (let i = 0; i < 9; i++) {
      const y = 2.51 + i * 0.035;
      d.rod(
        [side * (cowlX(-0.98, y) + 0.008), y, -0.98],
        [side * (cowlX(-1.42, y) + 0.008), y, -1.42],
        0.005,
        metal,
      );
      if (i < 8)
        quad(
          d,
          [side * (cowlX(-0.98, y) + 0.003), y, -0.98],
          [side * (cowlX(-1.42, y) + 0.003), y, -1.42],
          [side * (cowlX(-1.42, y + 0.035) + 0.003), y + 0.035, -1.42],
          [side * (cowlX(-0.98, y + 0.035) + 0.003), y + 0.035, -0.98],
          trim,
          [side, 0, 0],
        );
    }
    // Photos: the outlets sit on the cowling flanks and splay aft-outboard (not rear "eyes").
    const eg = group(root, `AW139-exhaust-${side}`, [side * 0.6, 2.53, -2.5]),
      ed = detailKit(eg, 'exhaust');
    eg.rotation.order = 'YXZ';
    eg.rotation.y = -side * 0.5;
    eg.rotation.x = 0.1;
    ed.add(
      new T.CylinderGeometry(0.19, 0.2, 0.5, 20, 1, true).rotateX(Math.PI / 2),
      metal,
      [0, 0, 0],
    );
    ed.add(new T.CircleGeometry(0.17, 20).rotateY(Math.PI), trim, [0, 0, -0.255]);
    ed.ring(0.19, 0.02, [0, 0, -0.255], metal);
    ed.finish();
  }
  // Swept vertical fin, stabilizer and starboard four-blade tail rotor.
  const yz = [
    [1.88, -7.13],
    [2.2, -7.53],
    [3.66, -8.1],
    [3.77, -8.59],
    [3.53, -9.03],
    [2.18, -8.62],
    [1.98, -7.84],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      yz.map(([y, z]) => [side * 0.12, y, z]),
      accent,
      [side, 0, 0],
    );
  for (let i = 0; i < yz.length; i++) {
    const a = yz[i],
      b = yz[(i + 1) % yz.length];
    quad(d, [-0.12, ...a], [-0.12, ...b], [0.12, ...b], [0.12, ...a], accent, [0, 1, 0]);
  }
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.12, 1.99, -7.22, -8.35],
        [side * 2.11, 2.02, -7.62, -8.23],
      ],
      accent,
      0.045,
    );
    sheet(
      d,
      [
        [side * 1.97, 1.99, -7.63],
        [side * 2.11, 2.36, -7.96],
        [side * 2.11, 2.38, -8.24],
        [side * 1.97, 1.99, -8.24],
      ],
      paint,
      [side, 0, 0],
    );
  }
  // The tail rotor runs on the port (+X) side of the fin (EBACE/JCG left-side photos).
  d.rod([0, 3.63, -8.4], [0.35, 3.63, -8.4], 0.075, metal);
  const tr = group(root, 'tail-rotor', [0.36, 3.63, -8.4]),
    td = detailKit(tr, 'tail-hub');
  td.add(new T.SphereGeometry(0.12, 12, 8), metal, [0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const g = group(tr, `AW139-tail-blade-${i}`),
      dd = detailKit(g, 'tail-blade');
    g.rotation.x = ((i * 90 + 24) * Math.PI) / 180;
    dd.rod([0, 0, 0], [0, 0.3, 0], 0.032, metal);
    dd.box([0.025, 1.06, 0.2], [0, 0.82, 0], paint);
    for (const y of [0.96, 1.16]) dd.box([0.027, 0.075, 0.202], [0, y, 0], accent);
    dd.box([0.028, 0.09, 0.203], [0, 1.305, 0], dd.amber);
    dd.finish();
  }
  td.finish();
  const mast = group(root, 'AW139-mast', [0, 3.57, 0]);
  mast.rotation.x = (4 * Math.PI) / 180;
  const md = detailKit(mast, 'mast');
  md.rod([0, -0.42, 0], [0, 0.01, 0], 0.085, metal);
  md.ring(0.27, 0.03, [0, -0.22, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, 'hub');
  rd.add(new T.SphereGeometry(1, 16, 8).scale(0.28, 0.14, 0.28), paint, [0, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const g = group(rotor, `AW139-blade-${i}`),
      dd = detailKit(g, 'blade');
    g.rotation.y = (-(i * 72 + 16) * Math.PI) / 180;
    dd.rod([0.1, 0, 0], [0.86, 0, 0], 0.054, metal);
    dd.rod([0.2, -0.23, 0.1], [0.72, -0.02, 0.1], 0.019, metal);
    dd.rod([0.25, 0.04, -0.13], [0.7, 0.02, -0.17], 0.028, trim);
    wing(
      dd,
      [
        [0.78, 0, 0.24, -0.24],
        [5.95, -0.06, 0.24, -0.24],
        [6.6, -0.09, 0.18, -0.24],
        [6.9, -0.14, -0.06, -0.23],
      ],
      trim,
      0.045,
    );
    dd.box([0.06, 0.012, 0.28], [6.65, -0.06, -0.06], accent);
    dd.finish();
  }
  rd.finish();
  const gearNodes = [];
  for (const [name, x, z, dual] of [
    ['nose', 0, 3.08, true],
    ['left', 1.52, -1.26, false],
    ['right', -1.52, -1.26, false],
  ]) {
    const g = group(root, `AW139-gear-${name}`, [x, 0.55, z]),
      gd = detailKit(g, 'gear');
    gd.rod([0, 0.06, 0], [0, -0.3, 0], 0.04, metal);
    gd.rod([0, 0.03, 0.22], [0, -0.23, 0], 0.026, paint);
    for (const off of dual ? [-0.115, 0.115] : [0])
      wheel(gd, [off, -0.29, 0], 0.26, dual ? 0.16 : 0.21, rubber, metal, paint);
    gd.box([dual ? 0.32 : 0.26, 0.03, 0.39], [0, 0.06, -0.03], paint);
    gd.finish();
    gearNodes.push(g.name);
  }
  for (const side of [-1, 1]) {
    d.rod(onRoof(3.12, side * 0.42, 0.02), onRoof(2.64, side * 0.78, 0.02), 0.012, trim);
    d.rod(onRoof(2.64, side * 0.78, 0.02), onRoof(2.55, side * 0.96, 0.02), 0.008, trim);
    // Nose lamps sit flush on the radome, facing along its skin normal.
    const lamp = shell.headOn(side * 0.46, 0.71, 0.004),
      facing = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        new T.Vector3(...shell.headOn(side * 0.46, 0.71, 0.104))
          .sub(new T.Vector3(...lamp))
          .normalize(),
      );
    d.ring(0.055, 0.012, lamp, paint).quaternion.copy(facing);
    d.add(new T.CircleGeometry(0.044, 12), metal, lamp).quaternion.copy(facing);
  }
  d.rod([0, 2.28, 1.38], [0, 2.66, 1.64], 0.013, paint);
  d.rod([0, 1.98, -5.47], [0, 2.2, -5.65], 0.012, paint);
  d.box([0.055, 0.06, 0.055], [0, 2.23, -3.03], d.red);
  d.finish();
  const interior = cockpit(root, { paint, accent, trim, metal }, shell);
  cleanGeometry(root);
  return {
    root,
    frame: aw139Frame(),
    enginePoints: [],
    visual: {
      rotors: [
        { node: 'main-rotor', axis: 'y', multiplier: 1 },
        { node: 'tail-rotor', axis: 'x', multiplier: 5 },
      ],
      gearNodes,
      flaps: [],
      ailerons: [],
      animation: { bindings: [] },
      interior,
    },
  };
}
function wheel(d, p, r, w, rubber, metal, paint) {
  d.add(new T.CylinderGeometry(r * 0.84, r * 0.84, w, 20).rotateZ(Math.PI / 2), rubber, p);
  for (const s of [-1, 1]) {
    d.ring(r * 0.82, r * 0.18, [p[0] + s * w * 0.29, p[1], p[2]], rubber, 'x');
    d.add(new T.CylinderGeometry(r * 0.48, r * 0.48, 0.02, 16).rotateZ(Math.PI / 2), paint, [
      p[0] + s * w * 0.52,
      p[1],
      p[2],
    ]);
    d.ring(r * 0.4, 0.009, [p[0] + s * w * 0.57, p[1], p[2]], metal, 'x');
  }
}
function cockpit(root, m, shell) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'AW139-cockpit'),
    bindings = [],
    face = mat('AW139-panel', '#3b4244'),
    seat = mat('AW139-seats', '#777d7a'),
    belt = mat('AW139-harness', '#444b4b'),
    z = 2.88,
    k = 0.2032 / 100,
    px = (u) => (674 - u) * k,
    py = (v) => 1.52 - (v - 1370) * k,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz],
    pt = panelTools(d);
  const contour = [
    [309, 1400],
    [326, 1368],
    [520, 1359],
    [579, 1337],
    [713, 1337],
    [770, 1358],
    [1034, 1373],
    [1051, 1402],
    [1039, 1527],
    [998, 1541],
    [357, 1541],
    [314, 1527],
  ].map(([u, v]) => at(u, v));
  sheet(d, contour, face, [0, 0, -1]);
  // Shallow housing and glareshield: both stay under the windscreen as it falls to the nose.
  const deep = z + 0.1;
  sheet(
    d,
    contour.map((p) => [p[0], p[1], deep]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, [b[0], b[1], deep], [a[0], a[1], deep], m.trim, [0, 1, 0]);
  }
  outline(d, contour, 0.021, m.trim);
  const brow = contour.slice(0, 8).map((p) => [p[0] * 1.025, p[1] + 0.025, p[2] - 0.01]);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0], b[1] - 0.1, z + 0.2], [a[0], a[1] - 0.1, z + 0.2], m.trim, [0, 1, 0]);
  }
  outline(d, brow, 0.025, m.trim, false);
  for (const [u, v, kind] of [
    [380, 1465, 'attitude'],
    [484, 1465, 'map'],
    [857, 1465, 'engine'],
    [969, 1465, 'attitude'],
  ]) {
    const x = px(u),
      y = py(v),
      w = 0.164,
      h = 0.226;
    if (kind === 'engine') {
      d.box([0.2032, 0.254, 0.027], [x, y, z - 0.012], m.trim);
      d.box([w, h, 0.007], [x, y, z - 0.03], d.dark);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const xx = x + (col - 1.5) * 0.031,
            yy = y + 0.073 - row * 0.067;
          d.box([0.002, 0.044, 0.003], [xx, yy, z - 0.04], d.ivory);
          d.box([0.004, 0.027, 0.003], [xx, yy - 0.007, z - 0.044], d.green);
        }
        d.text(
          ['TRQ', 'TGT', 'ENG'][row],
          [x, y + 0.1 - row * 0.067, z - 0.047],
          0.008,
          Math.PI,
          d.ivory,
        );
      }
    } else glassDisplay(d, x, y, z - 0.023, w, h, kind);
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++)
        d.box([0.009, 0.014, 0.01], [x + side * 0.092, y + 0.092 - i * 0.037, z - 0.047], face);
    if (kind === 'attitude') {
      const g = group(cabin, `AW139-horizon-${u}`, [x, y + 0.04, z - 0.068]),
        dd = detailKit(g, 'horizon');
      dd.box([0.056, 0.0015, 0.001], [0, 0, 0], dd.amber);
      dd.finish();
      bindings.push({ node: g.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 });
    }
  }
  glassDisplay(d, px(648), py(1430), z - 0.023, 0.193, 0.137, 'map');
  glassDisplay(d, px(744), py(1381), z - 0.023, 0.044, 0.049, 'attitude');
  for (const [u, v] of [
    [547, 1503],
    [746, 1503],
  ]) {
    pt.display(px(u), py(v - 20), z - 0.025, 0.068, 0.042, 'radio');
    for (const dy of [0, 22])
      for (const dx of [-15, 15]) pt.knob(px(u + dx), py(v + dy), z - 0.04, 0.009);
  }
  pt.gauge(px(552), py(1381), z - 0.019, 0.022, undefined, false);
  pt.gauge(px(744), py(1430), z - 0.019, 0.022, undefined, false);
  for (const u of [372, 483, 855, 967]) {
    d.box([0.06, 0.012, 0.008], at(u, 1384, -0.025), d.dark);
    d.text('AW139', at(u, 1384, -0.032), 0.005, Math.PI, d.ivory);
  }
  d.box([0.066, 0.065, 0.02], at(747, 1470, -0.02), m.trim);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      d.box([0.006, 0.006, 0.006], at(734 + c * 6, 1458 + r * 6, -0.033), d.ivory);
  // Long sloped center console: twin FMS CDUs, engine levers, audio and flight controls.
  const pg = group(cabin, 'AW139-pedestal', [0, 1.16, 2.83]);
  pg.rotation.x = -0.67;
  const pd = detailKit(pg, 'pedestal'),
    pp = panelTools(pd);
  beveledBox(pd, [0.54, 1.0, 0.16], [0, -0.46, 0.035], m.trim, 0.014);
  for (const x of [-0.16, 0.16]) {
    pp.display(x, -0.19, -0.055, 0.17, 0.1, 'radio');
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 5; c++) {
        pd.box([0.02, 0.02, 0.01], [x + (c - 2) * 0.024, -0.275 - r * 0.025, -0.064], face);
        pd.text(
          String((r * 5 + c) % 10),
          [x + (c - 2) * 0.024, -0.275 - r * 0.025, -0.073],
          0.006,
          Math.PI,
          pd.ivory,
        );
      }
  }
  for (const x of [-0.055, 0.055]) {
    pd.box([0.033, 0.16, 0.022], [x, -0.135, -0.06], face);
    pd.rod([x, -0.1, -0.08], [x, -0.09, -0.14], 0.009, m.metal);
    pd.box([0.027, 0.03, 0.024], [x, -0.09, -0.15], pd.red);
  }
  for (let r = 0; r < 4; r++)
    for (const x of [-0.2, -0.1, 0.1, 0.2]) {
      pp.knob(x, -0.51 - r * 0.09, -0.065, 0.012);
      pd.text(
        ['COM', 'AFCS', 'NAV', 'LTS'][r],
        [x, -0.49 - r * 0.09, -0.075],
        0.007,
        Math.PI,
        pd.ivory,
      );
    }
  pd.rod([0.27, -0.17, -0.065], [0.27, -0.1, -0.14], 0.011, m.metal);
  pd.box([0.025, 0.1, 0.025], [0.27, -0.1, -0.15], pd.red);
  pd.finish();
  // Cabin deck trimmed to the rolled-under belly corners of the shell.
  fittedFloor(
    d,
    [-2.3, -1.8, -1, 0, 1, 1.5, 2.22, 2.6, 3].map((q) => ({
      z: q,
      points: Array.from({ length: 48 }, (_, j) => shell.at(q, -0.5 + j / 48).slice(0, 2)),
    })),
    m.trim,
    { y: 0.6025, front: 2.75, back: -2.11, width: 2.02, thickness: 0.045 },
  );
  const addSeat = (x, y, z) => {
    const sd = detailKit(cabin, 'AW139-seat');
    beveledBox(sd, [0.45, 0.115, 0.46], [x, y, z], seat);
    beveledBox(sd, [0.45, 0.6, 0.13], [x, y + 0.32, z - 0.21], seat);
    beveledBox(sd, [0.26, 0.17, 0.14], [x, y + 0.68, z - 0.21], seat);
    for (const s of [-1, 1]) {
      sd.rod(
        [x + s * 0.17, y - 0.21, z - 0.12],
        [x + s * 0.17, y - 0.05, z - 0.12],
        0.018,
        m.metal,
      );
      sheet(
        sd,
        [
          [x + s * 0.15, y + 0.55, z - 0.13],
          [x + s * 0.1, y + 0.55, z - 0.13],
          [x - s * 0.02, y + 0.075, z + 0.16],
          [x + s * 0.02, y + 0.075, z + 0.16],
        ],
        belt,
        [0, 0, 1],
      );
    }
    sd.box([0.06, 0.03, 0.02], [x, y + 0.08, z + 0.17], m.metal);
    sd.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * 0.48;
    addSeat(x, 0.85, 2.05);
    const cg = group(cabin, `AW139-cyclic-${side}`, [x, 0.59, 2.4]),
      cd = detailKit(cg, 'cyclic');
    outline(
      cd,
      [
        [0, 0, 0],
        [0, 0.22, 0],
        [0, 0.36, -0.16],
        [0, 0.5, -0.16],
      ],
      0.018,
      m.trim,
      false,
    );
    beveledBox(cd, [0.075, 0.14, 0.07], [0, 0.53, -0.16], m.trim, 0.012);
    cd.box([0.025, 0.025, 0.018], [0, 0.57, -0.205], cd.red);
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `AW139-collective-${side}`, [x + 0.26, 0.7, 1.83]),
      ld = detailKit(lg, 'collective');
    ld.rod([0, 0, 0], [0, 0.24, 0.37], 0.023, m.trim);
    beveledBox(ld, [0.1, 0.065, 0.17], [0, 0.25, 0.4], m.trim, 0.01);
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const j of [-1, 1]) {
      const g = group(cabin, `AW139-pedal-${side}-${j}`, [x + j * 0.13, 0.68, 3.06]),
        dd = detailKit(g, 'pedal');
      dd.box([0.14, 0.04, 0.08], [0, 0, 0], m.metal);
      dd.rod([0, 0, 0], [0, -0.09, 0.08], 0.014, m.trim);
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
  for (const z of [0.75, -0.17, -1.09])
    for (const x of [-0.76, -0.25, 0.25, 0.76]) addSeat(x, 0.82, z);
  // Overhead console tucked under the roof, behind the windscreen header.
  const og = group(cabin, 'AW139-overhead', [0, 2.1, 1.95]),
    od = detailKit(og, 'overhead');
  od.box([0.19, 0.04, 0.6], [0, 0, 0], m.trim);
  for (let i = 0; i < 5; i++)
    for (const x of [-0.055, 0.055]) {
      od.box([0.04, 0.008, 0.08], [x, -0.025, -0.27 + i * 0.13], face);
      od.rod([x, -0.03, -0.27 + i * 0.13], [x, -0.06, -0.25 + i * 0.13], 0.004, m.metal);
    }
  od.finish();
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
