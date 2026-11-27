/** UH-60M: Army airframe drawings plus exact M-model exterior and cockpit photos.
 * A/L drawings constrain common dimensions, never M avionics or blade geometry.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
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
import { glassDisplay } from './glass-display.mjs';
import { batToggle, partBatch, skinBacking } from './huey.mjs';
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
export const uh60Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 1.1811,
  cy: 1.3,
  ry: 0.9,
  cabinZ: 2.68,
  cabinWidth: 2.2,
  eye: [-0.56, 1.91, 2.68],
  panelZ: 3.4,
  floor: 0.56,
  mainRotorPosition: [0, 3.42, 0],
});
export function buildUH60(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('UH60-olive', '#505348', { side: T.DoubleSide }),
    trim = mat('UH60-trim', '#222829'),
    metal = mat('UH60-metal', '#89928b', { metalness: 0.6 }),
    glass = mat('UH60-glass', '#91b7bd', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    }),
    // The roof windows read dark tinted in the photos.
    tint = mat('UH60-tinted-glass', '#2f464e', {
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    }),
    rubber = mat('UH60-tires', '#272c2a');
  const d = detailKit(root, 'UH60-airframe');
  // Nose rings are rounded (Commons UH-60 orthographic plan: 0.60 m half-width 0.21 m behind
  // the tip, a semi-elliptic nose rather than a wedge) and closed by a dome.
  const measured = [
    [4.6, 0.4, 0.67, 1.165],
    [4.45, 0.63, 0.54, 1.32],
    [4.05, 0.9, 0.47, 1.43],
    [3.6, 1.06, 0.44, 1.57],
    [2.9, 1.12, 0.42, 2.13],
    [2.5, 1.1811, 0.42, 2.2],
    [1.0, 1.1811, 0.42, 2.2],
    [-1.6, 1.1811, 0.42, 2.12],
    // Plan view (Commons orthographic and PD 3-view): the cabin keeps its width to z -2.9,
    // then the transition section tapers to a slender, deep tail cone (about 1.5 m wide at
    // z -3.45, 0.95 m at -4.2). It used to step 0.34 m a side in 0.15 m at the aft bulkhead,
    // which read as a flat wall closing off a box.
    [-2.9, 1.06, 0.46, 2.11],
    [-3.45, 0.76, 0.485, 2.09],
    [-4.2, 0.47, 0.515, 2.0],
    [-7.6, 0.25, 0.62, 1.55],
    [-9.5, 0.17, 0.75, 1.25],
    [-10.0, 0.08, 1, 1.2],
  ];
  // Head-on (Army front photo) the nose is a broad rounded bulb and the cockpit and cabin have
  // rounded roof shoulders and a tucked belly over flat, upright window sides: rounded
  // sections with the flat side between fixed indices (see `section`), smooth-shaded.
  // Behind the aft cabin bulkhead (z -3.15) the tail cone is a deep oval (rear and side
  // photos), not the cabin's rounded box: the box sections there read as a square tube.
  const ring = ([z, w, b, t], i) => ({
    z,
    points:
      i < 3
        ? section(w, b, t, (t - b) * 0.56, (t - b) * 0.42, 3, 2.6)
        : i === 3
          ? section(w, b, t, 0.3, 0.3, 3.2, 2.8)
          : z < -3.1
            ? section(w, b, t, (t - b) * 0.44, (t - b) * 0.5, 2.3, 2.2)
            : section(
                w,
                b,
                t,
                Math.min(0.2, (t - b) * 0.24),
                Math.min(0.24, (t - b) * 0.26),
                3.4,
                2.7,
              ),
  });
  const rings = measured.map(ring),
    n = rings[0].points.length,
    p = (i, j) => [...rings[i].points[(j + n) % n], rings[i].z],
    roof = (j) => j < SIDE_TOP || j >= n - SIDE_TOP;
  // The skin's own section at any z (between lofted rings), and its half width at height y on
  // the side, so seams, stencils and access panels lie on the oval tail cone.
  const skinRing = (z) => {
    let i = rings.findIndex((r, k) => k < rings.length - 1 && z <= r.z && z >= rings[k + 1].z);
    if (i < 0) i = z > rings[0].z ? 0 : rings.length - 2;
    const u = (rings[i].z - z) / (rings[i].z - rings[i + 1].z);
    return rings[i].points.map((q, j) => q.map((v, k) => v + (rings[i + 1].points[j][k] - v) * u));
  };
  const skinX = (z, y) => {
    const q = skinRing(z);
    for (let j = 0; j < n / 2; j++) {
      const a = q[j],
        c = q[j + 1];
      if ((y <= a[1] && y >= c[1]) || (y >= a[1] && y <= c[1]))
        return a[0] + ((c[0] - a[0]) * (y - a[1])) / (c[1] - a[1] || 1);
    }
    return q[SIDE_TOP][0];
  };
  noseDome(d, rings[0].points, 4.6, 4.68, 0.91, paint, 0.3);
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 3 && roof(j)) ||
      ([3, 4, 5, 6].includes(i) && [SIDE_TOP, n - SIDE_TOP - 1].includes(j)) ||
      (i === 4 && [0, n - 1].includes(j)),
  });
  // Three frontal panes wrapping into the roof shoulders, plus roof glazing and pilot doors;
  // all are shell apertures.
  const upper = Array.from({ length: 2 * SIDE_TOP + 1 }, (_, k) => k - SIDE_TOP),
    front = [...upper.map((j) => p(4, j)), ...upper.reverse().map((j) => p(3, j))];
  for (let j = -SIDE_TOP; j < SIDE_TOP; j++)
    quad(d, p(3, j), p(4, j), p(4, j + 1), p(3, j + 1), glass, [0, 1, 1]);
  outline(d, front, 0.018, paint);
  const interpolate = (a, b, u) => a.map((v, i) => v * (1 - u) + b[i] * u);
  for (const side of [-1, 1]) {
    const a = interpolate(p(3, 0), p(3, side), 0.48),
      b = interpolate(p(4, 0), p(4, side), 0.48);
    d.rod(a, b, 0.025, paint);
  }
  for (const j of [0, n - 1]) {
    const a = p(4, j),
      b = p(5, j),
      c = p(5, j + 1),
      e = p(4, j + 1),
      q = (u, v) =>
        a.map((_, k) => (a[k] * (1 - u) + b[k] * u) * (1 - v) + (e[k] * (1 - u) + c[k] * u) * v),
      h = [
        [0.15, 0.2],
        [0.85, 0.2],
        [0.85, 0.88],
        [0.15, 0.88],
      ].map(([u, v]) => q(u, v));
    sheet(d, [a, b, c, e], paint, [0, 1, 0], [h]);
    sheet(d, h, tint, [0, 1, 0]);
    outline(d, h, 0.012, trim);
  }
  const sx = (z, side) => {
    const i = measured.findIndex(
      (a, i) => i < measured.length - 1 && z <= a[0] && z >= measured[i + 1][0],
    );
    if (i < 0) return side * 1.18;
    const a = measured[i],
      b = measured[i + 1],
      u = (a[0] - z) / (a[0] - b[0]);
    return side * (a[1] * (1 - u) + b[1] * u);
  };
  for (const side of [-1, 1]) {
    const q = (z, y) => [sx(z, side), y, z],
      j = side * SIDE_TOP,
      k = side * (SIDE_TOP + 1);
    // Side glazing per the M-model profile drawing and left-side photo: the cockpit door, two
    // narrow gunner windows and the two square sliding-door windows; solid skin aft of the door.
    // Rounded rectangles (four arc steps a corner); chamfered octagons read as pills.
    const rounded = (z0, z1, y0, y1, r) =>
      [
        [z1 + r, y0 + r, -Math.PI / 2],
        [z1 + r, y1 - r, Math.PI],
        [z0 - r, y1 - r, Math.PI / 2],
        [z0 - r, y0 + r, 0],
      ].flatMap(([cz, cy, a0]) =>
        Array.from({ length: 5 }, (_, k) => {
          const a = a0 - (k * Math.PI) / 8;
          return [cz + Math.cos(a) * r, cy + Math.sin(a) * r];
        }),
      );
    const windows = [
      [
        [3.44, 1.37],
        [2.83, 1.97],
        [2.58, 1.98],
        [2.58, 1.3],
      ],
      rounded(1.93, 1.62, 1.3, 1.92, 0.07),
      rounded(1.56, 1.29, 1.3, 1.92, 0.07),
      // Sliding-door windows are taller than wide (about 0.6 by 0.66 m) with a broad solid
      // panel behind them (M-model side photos); they used to run 0.68 m wide to near the door's
      // trailing edge.
      rounded(0.85, 0.24, 1.27, 1.93, 0.08),
      rounded(0.11, -0.5, 1.27, 1.93, 0.08),
    ].map((a) => a.map(([z, y]) => q(z, y)));
    sheet(
      d,
      [p(3, j), p(4, j), p(5, j), p(6, j), p(7, j), p(7, k), p(6, k), p(5, k), p(4, k), p(3, k)],
      paint,
      [side, 0, 0],
      windows,
    );
    for (const a of windows) {
      sheet(d, a, glass, [side, 0, 0]);
      outline(d, a, 0.015, trim);
    }
    for (const a of [
      [
        [3.59, 1.48],
        [2.88, 2.09],
        [2.46, 2.12],
        [2.46, 0.95],
        [3.58, 0.95],
      ],
      [
        [2.3, 2.08],
        [1.22, 2.07],
        [1.22, 0.58],
        [2.3, 0.58],
      ],
      [
        [0.95, 2.06],
        [-0.85, 2.04],
        [-0.85, 0.57],
        [0.95, 0.57],
      ],
    ])
      outline(
        d,
        a.map(([z, y]) => q(z, y)),
        0.004,
        trim,
      );
    d.rod([side * 1.2, 2.15, 1.53], [side * 1.2, 2.1, -2.1], 0.018, metal);
    d.rod([side * 1.2, 0.61, 1.55], [side * 1.2, 0.61, -2.1], 0.018, metal);
    for (const z of [2.6, 0.25])
      d.rod([sx(z, side) * 1.012, 1.15, z], [sx(z, side) * 1.012, 1.15, z + 0.17], 0.012, trim);
    for (const z of [2.46, 1.22, -0.85])
      for (let n = 0; n < 13; n++)
        d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [sx(z, side) * 1.003, 0.68 + n * 0.1, z]);
    // Frame seams circle the whole section: draw them once.
    for (const z of side > 0 ? [-2.1, -3.1, -4.4, -5.9, -7.3] : [])
      outline(
        d,
        skinRing(z).map((q) => [q[0] * 1.002, q[1], z]),
        0.0028,
        trim,
      );
    for (const [z, y, w, h] of [
      [-2.15, 1.73, 0.28, 0.13],
      [-2.45, 1.35, 0.37, 0.21],
      [-3.4, 1.16, 0.15, 0.26],
    ]) {
      const a = [
        [z - w / 2, y - h / 2],
        [z + w / 2, y - h / 2],
        [z + w / 2, y + h / 2],
        [z - w / 2, y + h / 2],
      ].map(([z, y]) => [side * (skinX(z, y) + 0.003), y, z]);
      outline(d, a, 0.004, trim);
    }
    // Operator titles (UNITED STATES ARMY and the like) are livery markings, not geometry.
    d.rod([side * 1.2, 0.54, 1.53], [side * 1.43, 0.54, 0.2], 0.026, trim);
    d.rod([side * 1.43, 0.54, 0.2], [side * 1.2, 0.54, -0.1], 0.026, trim);
    // Main gear upper fairing and exposed oleo/drag brace, without auxiliary stores.
    beveledBox(d, [0.26, 0.22, 0.61], [side * 1.23, 0.88, 1.67], paint, 0.04);
    d.rod([side * 1.2, 0.9, 1.84], [side * 1.35382, 0.35, 1.14], 0.045, metal);
    d.rod([side * 1.12, 0.61, 2.15], [side * 1.35382, 0.33, 1.14], 0.031, paint);
    wheel(d, [side * 1.35382, 0.32, 1.14], 0.32, 0.254, rubber, metal, paint);
    d.box([0.05, 0.05, 0.08], [side * 1.2, 2.15, 1.65], side < 0 ? d.green : d.red);
  }
  // Transmission fairing and paired T700 nacelles. Rounded crown over short upright flanks
  // (front photo), smooth-shaded; it narrows between the engines, which sit against it.
  const cowl = (z, w, b, t) => ({
    z,
    points: [
      [-w, b],
      ...Array.from({ length: 11 }, (_, k) => {
        const a = ((k - 5) * Math.PI) / 10,
          s = Math.sin(a),
          y = t - Math.min(0.3, (t - b) * 0.8);
        return [
          w * Math.sign(s) * Math.pow(Math.abs(s), 2 / 3.2),
          y + (t - y) * Math.pow(Math.cos(a), 2 / 3.2),
        ];
      }),
      [w, b],
    ],
  });
  loft(
    d,
    [
      cowl(2.48, 0.42, 2.12, 2.28),
      cowl(1.55, 0.5, 2.18, 2.48),
      cowl(0.75, 0.46, 2.2, 2.6),
      cowl(0.4, 0.44, 2.2, 2.62),
      cowl(-1.3, 0.42, 2.1, 2.58),
      cowl(-2.45, 0.4, 2.02, 2.38),
      cowl(-3.7, 0.32, 1.89, 2.04),
    ],
    paint,
  );
  // Each nacelle is a long cowling laid along the cabin roof against the transmission fairing:
  // a round crown over skirts that run down into the roof (S-70/UH-60 close-ups and the
  // head-on photo, outer edges about 0.85 m off the centreline), a round intake with a lip and
  // a dark duct at the front, and the HIRSS suppressor behind. They used to be free round pods
  // perched on the roof edges, overhanging the cabin sides.
  const ENGINE_X = 0.7,
    ENGINE_Y = 2.36,
    SKIRT = -0.25;
  const nacelleSection = (z, r, flare = 0.05) => ({
    z,
    points: [
      ...Array.from({ length: 7 }, (_, k) => [
        r * Math.sin((k * Math.PI) / 12),
        r * Math.cos((k * Math.PI) / 12),
      ]),
      [r + flare * 0.35, SKIRT * 0.5],
      [r + flare, SKIRT],
      [0, SKIRT - 0.01],
      [-r - flare, SKIRT],
      [-r - flare * 0.35, SKIRT * 0.5],
      ...Array.from({ length: 6 }, (_, k) => [
        -r * Math.sin(((6 - k) * Math.PI) / 12),
        r * Math.cos(((6 - k) * Math.PI) / 12),
      ]),
    ],
  });
  const INTAKE = 0.21,
    INTAKE_Y = 0.02;
  for (const side of [-1, 1]) {
    const e = group(root, `UH60-engine-${side}`, [side * ENGINE_X, ENGINE_Y, 0]),
      ed = detailKit(e, 'nacelle');
    const sections = [
      nacelleSection(0.78, 0.26, 0.03),
      nacelleSection(0.68, 0.3, 0.05),
      nacelleSection(0.3, 0.32, 0.06),
      nacelleSection(-0.6, 0.325, 0.06),
      nacelleSection(-1.35, 0.315, 0.06),
      nacelleSection(-1.62, 0.3, 0.05),
    ];
    loft(ed, sections, paint, { caps: false });
    // Front face around the intake, a rolled lip and a short dark duct to the engine face.
    const mouth = Array.from({ length: 24 }, (_, k) => [
      Math.sin((k * Math.PI) / 12) * INTAKE,
      INTAKE_Y + Math.cos((k * Math.PI) / 12) * INTAKE,
      0.78,
    ]);
    sheet(
      ed,
      sections[0].points.map(([x, y]) => [x, y, 0.78]),
      paint,
      [0, 0, 1],
      [mouth],
    );
    ed.ring(INTAKE + 0.012, 0.018, [0, INTAKE_Y, 0.785], paint);
    ed.add(
      new T.CylinderGeometry(INTAKE, INTAKE * 0.92, 0.26, 24, 1, true).rotateX(Math.PI / 2),
      trim,
      [0, INTAKE_Y, 0.65],
    );
    ed.add(new T.CircleGeometry(INTAKE * 0.92, 24), trim, [0, INTAKE_Y, 0.52]);
    ed.add(new T.SphereGeometry(1, 12, 6).scale(0.07, 0.07, 0.05), metal, [0, INTAKE_Y, 0.53]);
    // HIRSS (M photos): the nacelle runs on into a flattened duct that settles onto the roof
    // and turns its dark outlet aft and outboard, not a round tailpipe.
    const exhaust = group(e, 'UH60-exhaust', [0, 0, -1.62]);
    const xd = detailKit(exhaust, 'exhaust'),
      duct = [
        // z, outboard shift, centre height, half width, height above / below the centre
        [0.04, 0, 0, 0.3, 0.3, 0.25],
        [-0.45, 0.03, -0.02, 0.3, 0.26, 0.25],
        [-0.95, 0.08, -0.05, 0.27, 0.19, 0.22],
        [-1.3, 0.12, -0.07, 0.23, 0.14, 0.18],
      ].map(([z, dx, cy, w, up, down]) => ({
        z,
        points: Array.from({ length: 16 }, (_, i) => {
          const s = Math.sin((i * Math.PI) / 8),
            c = Math.cos((i * Math.PI) / 8);
          return [
            side * dx + w * Math.sign(s) * Math.pow(Math.abs(s), 2 / 2.6),
            cy + (c > 0 ? up : down) * Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.6),
          ];
        }),
      }));
    loft(xd, duct, paint, { caps: false });
    sheet(
      xd,
      duct.at(-1).points.map(([x, y]) => [x, y, -1.29]),
      trim,
      [side * 0.3, 0, -1],
    );
    xd.finish();
    // Cowl seams over the crown and the outboard louvre bank on its side.
    for (const z of [0.2, -0.85]) {
      const r = 0.325;
      outline(
        ed,
        Array.from({ length: 13 }, (_, k) => [
          r * 1.01 * Math.sin(((k - 6) * Math.PI) / 12),
          r * 1.01 * Math.cos(((k - 6) * Math.PI) / 12),
          z,
        ]),
        0.003,
        metal,
        false,
      );
    }
    for (let i = 0; i < 8; i++) {
      const y = 0.02 + i * 0.03;
      ed.box(
        [0.012, 0.022, 0.12],
        [side * (Math.sqrt(0.325 * 0.325 - y * y) + 0.004), y, -0.5],
        trim,
      );
    }
    ed.finish();
  }
  // Vertical tail follows the common H-60 sweep; M fitting uses a folding stabilator.
  const yz = [
    [1.44, -7.8],
    [3.43, -9.65],
    [3.62, -10.25],
    [3.3, -10.7705],
    [1.9, -9.92],
    [1.3, -10.0],
    [1.1, -8.9],
  ];
  // Thick driveshaft leading edge thinning to the trailing edge (rear photos), not a slab.
  const fin = [0.13, 0.13, 0.12, 0.05, 0.04, 0.06, 0.12];
  for (const side of [-1, 1])
    sheet(
      d,
      yz.map(([y, z], i) => [side * fin[i], y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < yz.length; i++) {
    const a = yz[i],
      b = yz[(i + 1) % yz.length],
      ta = fin[i],
      tb = fin[(i + 1) % yz.length];
    quad(d, [-ta, ...a], [-tb, ...b], [tb, ...b], [ta, ...a], paint, [0, 1, 0]);
  }
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.1, 1.4, -8.72, -9.86],
        [side * 2.1844, 1.4, -8.92, -9.74],
      ],
      paint,
      0.055,
    );
    outline(
      d,
      [
        [side * 1.35, 1.46, -8.86],
        [side * 1.35, 1.46, -9.8],
      ],
      0.006,
      trim,
      false,
    );
  }
  d.rod([0, 0.89, -6.8], [0, 0.25, -7.6992], 0.048, metal);
  d.rod([0, 0.63, -7.75], [0, 0.25, -7.6992], 0.03, paint);
  wheel(d, [0, 0.23, -7.6992], 0.23, 0.15, rubber, metal, paint);
  const mount = group(root, 'UH60-tail-mount', [-0.2, 3.42, -9.9172]);
  mount.rotation.z = (-20 * Math.PI) / 180;
  const td = detailKit(mount, 'tail-support');
  td.rod([0.3, 0, 0], [-0.22, 0, 0], 0.09, metal);
  td.add(new T.SphereGeometry(1, 16, 8).scale(0.18, 0.24, 0.26), paint, [-0.18, 0, 0]);
  td.finish();
  const tr = group(mount, 'tail-rotor', [-0.24, 0, 0]),
    trd = detailKit(tr, 'UH60-tail-rotor');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      g = group(tr, `UH60-tail-blade-${i}`),
      dd = detailKit(g, 'tail-blade');
    g.rotation.x = a;
    dd.box([0.03, 1.45, 0.2], [0, 0.95, 0], trim);
    dd.rod([0, 0, 0], [0, 0.4, 0], 0.035, metal);
    dd.box([0.033, 0.12, 0.2], [0, 1.61, 0], paint);
    dd.finish();
  }
  trd.finish();
  const mast = group(root, 'UH60-mast', [0, 3.42, 0]);
  mast.rotation.x = (3 * Math.PI) / 180;
  const md = detailKit(mast, 'mast');
  md.rod([0, -0.77, 0], [0, 0.03, 0], 0.085, metal);
  md.ring(0.24, 0.035, [0, -0.37, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, 'UH60-main-hub');
  rd.add(new T.SphereGeometry(1, 16, 8).scale(0.25, 0.14, 0.25), metal, [0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = ((i * 90 - 23) * Math.PI) / 180,
      g = group(rotor, `UH60-blade-${i}`),
      dd = detailKit(g, 'wide-chord-blade');
    g.rotation.y = -a;
    dd.rod([0.1, 0, 0], [0.83, 0, 0], 0.06, metal);
    // Pitch link: a short upright rod from the swashplate rim to the blade's pitch horn.
    dd.rod([0.27, -0.36, 0.12], [0.3, -0.06, 0.12], 0.017, metal);
    dd.rod([0.3, -0.06, 0.12], [0.52, -0.02, 0.06], 0.022, metal);
    dd.rod([0.23, 0.06, -0.1], [0.68, 0.07, -0.1], 0.03, trim);
    wing(
      dd,
      [
        [0.72, 0, 0.27, -0.27],
        [7.1, -0.03, 0.31, -0.31],
        [7.72, -0.05, 0.23, -0.4],
        [8.1788, -0.11, -0.05, -0.48],
      ],
      trim,
      0.035,
    );
    dd.box([0.04, 0.012, 0.48], [7.72, -0.03, -0.09], paint);
    dd.finish();
  }
  rd.finish();
  d.rod([0, 2.18, 2.4], [0, 2.61, 1.84], 0.01, paint);
  d.rod([0, 1.62, -5.3], [0, 2.08, -5.65], 0.012, paint);
  d.rod([0, 0.54, -3.4], [0, 0.18, -3.1], 0.012, trim);
  d.box([0.055, 0.06, 0.055], [0, 2.59, -1.75], d.red);
  // Windscreen wipers (front photo): pivoted low on each main pane a third of the way in from
  // its outer edge and parked up toward the centre post, an arm with the blade alongside it,
  // both lying 2-3 cm off the outside of the glass. The old arm ran inside the glazing to eye
  // height and folded back into a Z across the pilot's view.
  const pane = (side, c, v) => {
    const at = (i) => {
      const k = Math.floor(c),
        f = c - k,
        a = p(i, side * k),
        b = p(i, side * (k + 1));
      return a.map((x, m) => x + (b[m] - x) * f);
    };
    const a = at(3),
      b = at(4);
    return a.map((x, m) => x + (b[m] - x) * v);
  };
  const offGlass = (side, c, v, lift) => {
    const q = pane(side, c, v),
      du = pane(side, c + 0.05, v).map((x, m) => x - q[m]),
      dv = pane(side, c, v + 0.05).map((x, m) => x - q[m]),
      nrm = [
        du[1] * dv[2] - du[2] * dv[1],
        du[2] * dv[0] - du[0] * dv[2],
        du[0] * dv[1] - du[1] * dv[0],
      ],
      len = Math.hypot(...nrm) || 1,
      sign = nrm[2] > 0 ? 1 : -1;
    return q.map((x, m) => x + (sign * nrm[m] * lift) / len);
  };
  for (const side of [-1, 1]) {
    d.ring(0.055, 0.015, [side * 0.53, 1.12, 4.45], paint);
    d.add(new T.CircleGeometry(0.043, 12), glass, [side * 0.53, 1.12, 4.465]);
    const pivot = offGlass(side, 2.1, 0.06, 0.02),
      tip = offGlass(side, 0.75, 0.58, 0.02);
    d.rod(pivot, tip, 0.006, trim);
    d.rod(offGlass(side, 1.95, 0.1, 0.034), offGlass(side, 0.68, 0.64, 0.034), 0.0045, trim);
    d.add(new T.SphereGeometry(0.018, 8, 4), trim, pivot);
  }
  d.finish();
  const interior = cockpit(root, { paint, trim, metal });
  cleanGeometry(root);
  return {
    root,
    frame: uh60Frame(),
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
function wheel(d, at, r, w, rubber, metal, paint) {
  d.add(new T.CylinderGeometry(r * 0.85, r * 0.85, w, 24).rotateZ(Math.PI / 2), rubber, at);
  for (const side of [-1, 1]) {
    d.ring(r * 0.82, r * 0.18, [at[0] + side * w * 0.3, at[1], at[2]], rubber, 'x');
    d.add(new T.CylinderGeometry(r * 0.5, r * 0.5, 0.022, 18).rotateZ(Math.PI / 2), paint, [
      at[0] + side * w * 0.51,
      at[1],
      at[2],
    ]);
    d.ring(r * 0.42, 0.009, [at[0] + side * w * 0.56, at[1], at[2]], metal, 'x');
    for (let i = 0; i < 8; i++)
      d.add(new T.SphereGeometry(0.008, 5, 3), metal, [
        at[0] + side * w * 0.57,
        at[1] + Math.sin((i * Math.PI) / 4) * r * 0.3,
        at[2] + Math.cos((i * Math.PI) / 4) * r * 0.3,
      ]);
  }
}
const cylinder = (r, h, at, rotation = [0, 0, 0], sides = 16, r2 = r) =>
  place(new T.CylinderGeometry(r2, r, h, sides), at, rotation);
/**
 * The Black Hawk cyclic grip, base at the origin, up +Y, trigger toward +Z: a thick hand-hold
 * under a broad, flat-topped head. The crown carries the four-way trim hat and the go-around
 * button, the left shoulder the stabilator-release and SAS switches on a raised pad, the right
 * the red cargo-hook release under its cover, and the two-stage radio/ICS trigger sits in front.
 */
function sikorskyGripInto(b, P) {
  const L = (rows) =>
    loftUp(
      rows.map(([y, cz, rx, rz, power = 2.4]) => ({
        y,
        points: contour(0, cz, rx, rz, 16, power),
      })),
    );
  b.add(
    P.alloy,
    lathe(
      [
        [0, -0.024],
        [0.02, -0.024],
        [0.021, 0.004],
        [0.019, 0.012],
        [0, 0.012],
      ],
      14,
    ),
  );
  b.add(
    P.grip,
    L([
      [0.008, 0, 0.02, 0.022, 2.2],
      [0.045, 0.002, 0.0225, 0.024, 2.2],
      [0.085, 0.006, 0.023, 0.026, 2.4],
      [0.112, 0.014, 0.026, 0.032, 2.8],
      [0.135, 0.02, 0.03, 0.036, 3.2],
      [0.152, 0.022, 0.029, 0.035, 3.2],
      [0.158, 0.022, 0.022, 0.028, 3],
    ]),
  );
  // Thumb pad on the left shoulder with two switches; the crown's trim hat and go-around button.
  b.add(
    P.grip,
    place(roundedBox([0.018, 0.03, 0.036], 0.006, 1), [0.03, 0.138, 0.016], [0, 0, -0.25]),
  );
  b.add(P.black, cylinder(0.0045, 0.006, [0.04, 0.142, 0.006], [0, 0, Math.PI / 2 - 0.25], 10));
  b.add(
    P.black,
    place(roundedBox([0.006, 0.01, 0.01], 0.002, 1), [0.04, 0.136, 0.026], [0, 0, -0.25]),
  );
  b.add(P.black, cylinder(0.0065, 0.008, [0.004, 0.161, 0.012], [0, 0, 0], 12));
  b.add(
    P.black,
    place(new T.SphereGeometry(0.005, 10, 6), [0.004, 0.165, 0.012], [0, 0, 0], [1, 0.55, 1]),
  );
  b.add(P.white, cylinder(0.0048, 0.005, [-0.012, 0.16, 0.03], [0, 0, 0], 10));
  b.add(P.red, cylinder(0.005, 0.006, [-0.03, 0.14, 0.02], [0, 0, Math.PI / 2], 10));
  b.add(P.black, place(roundedBox([0.004, 0.016, 0.016], 0.0015, 1), [-0.034, 0.14, 0.02]));
  b.add(
    P.black,
    tube(
      [
        [0, 0.12, 0.05],
        [0, 0.106, 0.064],
        [0, 0.088, 0.06],
      ],
      0.0058,
      8,
    ),
  );
  b.add(
    P.black,
    tube(
      [
        [0, 0.096, 0.03],
        [0, 0.084, 0.044],
        [0, 0.072, 0.04],
      ],
      0.0052,
      8,
    ),
  );
}
/** The Black Hawk cyclic from its floor pivot: a rubber boot, the tube bent aft through `path`
 * and the grip on its end. */
function sikorskyCyclic(d, { path, floor = 0, tubeMaterial, palette }) {
  const P = partPalette(palette),
    b = partBatch();
  const points = [];
  for (let i = 0; i < path.length - 1; i++)
    for (let k = 0; k < (i === path.length - 2 ? 5 : 4); k++) {
      const u = k / 4,
        a = path[i],
        c = path[i + 1];
      points.push(a.map((v, j) => v + (c[j] - v) * u));
    }
  b.add(tubeMaterial ?? P.black, tube(points, 0.0175, 12));
  b.add(
    P.tread,
    lathe(
      [
        [0, floor],
        [0.07, floor],
        [0.068, floor + 0.012],
        [0.05, floor + 0.022],
        [0.048, floor + 0.04],
        [0.034, floor + 0.052],
        [0.032, floor + 0.07],
        [0.024, floor + 0.1],
        [0.022, floor + 0.11],
        [0, floor + 0.11],
      ],
      14,
      28,
    ),
  );
  b.emit(d);
  const top = points.at(-1),
    back = points.at(-2);
  sikorskyGripInto(b, P);
  b.emit(d, top, [Math.atan2(top[2] - back[2], top[1] - back[1]), 0, 0]);
}
/**
 * The Black Hawk collective from its pivot beside the seat to `end` ([0, rise, run]): a plain
 * lever (engine power is on the overhead, so there is no twist grip) ending in a rubber hand
 * grip under the large switch head: the searchlight hat, landing-light and servo switches on its
 * top, the go-around and trim-release buttons at its front and the ICS trigger beneath.
 */
function sikorskyCollective(d, { end, palette, tubeMaterial }) {
  const P = partPalette(palette),
    b = partBatch();
  const length = Math.hypot(end[1], end[2]),
    pitch = Math.atan2(end[1], end[2]),
    along = [Math.PI / 2, 0, 0];
  b.add(
    P.tread,
    lathe(
      [
        [0, -0.04],
        [0.045, -0.04],
        [0.043, -0.022],
        [0.03, -0.008],
        [0.026, 0.02],
        [0, 0.02],
      ],
      12,
    ).rotateX(Math.PI / 2),
  );
  b.add(
    tubeMaterial ?? P.black,
    cylinder(0.019, length - 0.16, [0, 0, (length - 0.16) / 2], along, 14),
  );
  b.add(P.grip, cylinder(0.0235, 0.11, [0, 0, length - 0.105], along, 16, 0.024));
  const head = partBatch(),
    tilt = -0.32;
  head.add(P.grip, place(roundedBox([0.07, 0.066, 0.1], 0.016, 1), [0, 0.012, 0.045]));
  head.add(P.black, place(roundedBox([0.054, 0.006, 0.07], 0.003, 1), [0, 0.046, 0.045]));
  head.add(P.black, cylinder(0.008, 0.01, [0.012, 0.052, 0.06], [0, 0, 0], 12));
  head.add(
    P.black,
    place(new T.SphereGeometry(0.006, 10, 6), [0.012, 0.057, 0.06], [0, 0, 0], [1, 0.55, 1]),
  );
  for (const [x, z] of [
    [-0.014, 0.025],
    [-0.014, 0.055],
    [0.014, 0.028],
  ]) {
    head.add(P.alloy, cylinder(0.0042, 0.004, [x, 0.05, z], [0, 0, 0], 8));
    head.add(
      P.alloy,
      place(new T.CylinderGeometry(0.0014, 0.0022, 0.015, 8), [x, 0.058, z - 0.003], [-0.3, 0, 0]),
    );
  }
  head.add(P.white, cylinder(0.007, 0.008, [0, 0.02, 0.097], along, 12));
  head.add(P.red, cylinder(0.0055, 0.008, [0.037, 0.02, 0.05], [0, 0, Math.PI / 2], 10));
  head.add(
    P.black,
    tube(
      [
        [0, -0.02, 0.03],
        [0, -0.034, 0.042],
        [0, -0.034, 0.062],
      ],
      0.005,
      8,
    ),
  );
  b.emit(d, [0, 0, 0], [-pitch, 0, 0]);
  // The head rides on the lever's tip, cocked up a little more than the lever.
  const tip = [0, Math.sin(pitch) * (length - 0.05), Math.cos(pitch) * (length - 0.05)];
  head.emit(d, tip, [-pitch + tilt, 0, 0]);
}
/** An engine power control lever hanging from the overhead quadrant: a flat bar under a square
 * grip with a finger lift, pivot at the origin, the lever down local +Y. */
function powerControlLever(d, P, length = 0.1) {
  const b = partBatch();
  b.add(P.alloy, place(roundedBox([0.008, length, 0.016], 0.002, 1), [0, length / 2, 0]));
  b.add(P.grip, place(roundedBox([0.03, 0.026, 0.034], 0.007, 1), [0, length + 0.01, 0]));
  b.add(P.white, place(roundedBox([0.031, 0.004, 0.012], 0.0012, 1), [0, length + 0.021, 0.012]));
  b.add(P.black, place(roundedBox([0.02, 0.008, 0.01], 0.002, 1), [0, length - 0.006, -0.018]));
  b.emit(d);
}
function cockpit(root, m) {
  const parts = partPalette();
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'UH60-cockpit'),
    bindings = [],
    face = mat('UH60-instrument-face', '#343c3e'),
    seat = mat('UH60-upholstery', '#434949'),
    // Olive webbing: pale straps read through every cabin window as bright diagonal stripes.
    belt = mat('UH60-harness', '#5c5b4b'),
    z = 3.4,
    // The photograph has no absolute size. Its displays are the UH-60M's 6 by 8 in MFDs, which makes
    // the face 1.25 m wide; the 1.63 m cabin-fit width used before drew them 1.3 times too large.
    k = 1.25 / 1660,
    fit = k / (1.63 / 1660);
  // The scallop's rear lip stands 0.245 m below the eye and clears the windscreen sill forward of it.
  const px = (u) => (912 - u) * k,
    py = (v) => 1.58 - (v - 230) * k,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz],
    pt = panelTools(d);
  // Line the olive skin round the cockpit in the flat dark gray of Army cockpits: the doors below
  // and round their windows, the posts, the roof and the footwells under the panel, where the
  // painted skin's back faces showed.
  {
    const lining = mat('UH60-cockpit-lining', '#33393a', { roughness: 0.93 }),
      ld = detailKit(cabin, 'UH60-lining');
    skinBacking(ld, root, {
      materials: [m.paint],
      inside: ([x, y, ww]) => ww > 1.9 && ww < 4.7 && y > 0.45 && y < 2.25 && Math.abs(x) < 1.2,
      lining: () => lining,
      toward: ([, , ww]) => [0, 1.35, Math.min(ww, 3.3)],
    });
    ld.finish();
  }
  const contour = [
    [80, 290],
    [110, 247],
    [400, 231],
    [760, 220],
    [1080, 229],
    [1410, 252],
    [1690, 290],
    [1725, 538],
    [1708, 605],
    [1500, 630],
    [1300, 651],
    [756, 652],
    [419, 629],
    [111, 600],
    [70, 544],
  ].map(([u, v]) => at(u, v));
  sheet(d, contour, face, [0, 0, -1]);
  // The forward end drops so the box stays under the sloping nose skin.
  const forward = (p) => [p[0], p[1] - 0.14, z + 0.26];
  sheet(d, contour.map(forward), m.trim, [0, 0, 1]);
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i],
      b = contour[(i + 1) % contour.length];
    quad(d, a, b, forward(b), forward(a), m.trim, [0, 1, 0]);
  }
  // The deep scalloped coaming is a separate curved cover above the flat face.
  const brow = [
    [0, 305],
    [45, 177],
    [205, 151],
    [355, 70],
    [595, 40],
    [930, 38],
    [1310, 75],
    [1550, 138],
    [1770, 185],
    [1840, 290],
  ].map(([u, v]) => at(u, 230 - (230 - v) * 0.59, -0.015));
  sheet(d, [...brow, ...contour.slice(0, 7).reverse()], m.trim, [0, 0, -1]);
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, [b[0], b[1] - 0.25, z + 0.3], [a[0], a[1] - 0.25, z + 0.3], m.trim, [0, 1, 0]);
  }
  outline(d, brow, 0.024, m.trim, false);
  const displays = [
    [249, 387, 'attitude'],
    [589, 375, 'map'],
    [1248, 390, 'map'],
    [1575, 420, 'attitude'],
  ];
  for (const [u, v, kind] of displays) {
    const x = px(u),
      y = py(v),
      w = 0.203,
      h = 0.155;
    glassDisplay(d, x, y, z - 0.023, w, h, kind);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++)
        d.box(
          [0.011, 0.012, 0.01],
          [x + side * (w / 2 + 0.014), y + h * (0.44 - i * 0.11), z - 0.042],
          face,
        );
      for (let i = 0; i < 6; i++)
        d.box(
          [0.014, 0.01, 0.008],
          [x + w * (0.43 - i * 0.172), y + side * (h / 2 + 0.014), z - 0.043],
          face,
        );
    }
    pt.knob(x - w * 0.48, y - h * 0.58, z - 0.047, 0.011);
    if (kind === 'attitude') {
      const g = group(cabin, `UH60-horizon-${u}`, [x, y + 0.028, z - 0.068]),
        dd = detailKit(g, 'horizon');
      dd.box([0.05, 0.0015, 0.001], [0, 0, 0], dd.amber);
      dd.finish();
      bindings.push({ node: g.name, source: 'roll', property: 'rotation', axis: 'z', scale: -1 });
    }
  }
  glassDisplay(d, px(917), py(349), z - 0.025, 0.068 * fit, 0.064 * fit, 'attitude');
  pt.gauge(px(917), py(442), z - 0.015, 0.035 * fit, undefined, false);
  for (const u of [590, 1228]) {
    d.box([0.37 * fit, 0.08 * fit, 0.018], at(u, 558, -0.012), m.trim);
    for (let i = 0; i < 3; i++)
      d.box([0.084 * fit, 0.02 * fit, 0.005], at(u - 102 + i * 100, 535, -0.024), d.dark);
    for (let i = 0; i < 5; i++) {
      pt.knob(px(u - 56 + i * 37), py(579), z - 0.04, 0.01);
      d.text(
        ['HDG', 'ALT', 'VS', 'NAV', 'FD'][i],
        at(u - 56 + i * 37, 560, -0.035),
        0.006,
        Math.PI,
        d.ivory,
      );
    }
    for (const v of [540, 580])
      for (const off of [-166, -135]) pt.knob(px(u + off), py(v), z - 0.037, 0.01);
  }
  for (const u of [245, 1580])
    for (let i = 0; i < 5; i++)
      d.box([0.018 * fit, 0.022 * fit, 0.013], at(u + (i - 2) * 30, 563, -0.02), m.trim);
  for (const u of [225, 1608]) {
    d.box([0.16 * fit, 0.04 * fit, 0.06], at(u, 205, -0.05), m.trim);
    for (let i = 0; i < 3; i++)
      d.box([0.043 * fit, 0.022 * fit, 0.005], at(u + (i - 1) * 49, 206, -0.083), d.dark);
  }
  pt.knob(px(919), py(567), z - 0.032, 0.015);
  d.text('UH-60M', at(918, 258, -0.013), 0.009, Math.PI, d.ivory);
  for (const u of [120, 360, 765, 1050, 1430, 1700])
    d.add(new T.CircleGeometry(0.003, 8).rotateY(Math.PI), m.metal, at(u, 600, -0.006));
  const pg = group(cabin, 'UH60-center-console', [0, 0.9, 2.9]);
  pg.rotation.x = 1.1;
  const pd = detailKit(pg, 'console'),
    ppt = panelTools(pd);
  pd.box([0.81, 1.12, 0.17], [0, 0, 0.07], face);
  d.box([0.78, 0.32, 0.56], [0, 0.7, 3.1], face);
  d.box([0.77, 0.1, 0.2], [0, 1.15, 3.37], face);
  for (const x of [-0.26, 0.26]) {
    pd.box([0.23, 0.35, 0.03], [x, 0.24, -0.035], m.trim);
    pd.box([0.15, 0.11, 0.004], [x, 0.33, -0.054], pd.dark);
    pd.text('FMS', [x, 0.33, -0.058], 0.015, Math.PI, pd.green);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 6; c++) {
        pd.box([0.024, 0.02, 0.008], [x + (c - 2.5) * 0.031, 0.23 - r * 0.029, -0.054], face);
        pd.text(
          String((c + r) % 10),
          [x + (c - 2.5) * 0.031, 0.23 - r * 0.029, -0.06],
          0.006,
          Math.PI,
          pd.ivory,
        );
      }
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        pd.box([0.016, 0.016, 0.01], [x + side * 0.102, 0.38 - i * 0.03, -0.055], face);
  }
  const consoleSwitches = partBatch();
  for (let r = 0; r < 7; r++)
    for (const x of [-0.07, 0.07]) {
      batToggle(consoleSwitches, parts, [x, 0.4 - r * 0.11, -0.02], 0.017);
      pd.text(
        ['ENG', 'FUEL', 'GEN', 'SAS', 'BOOST', 'TRIM', 'TEST'][r],
        [x, 0.44 - r * 0.11, -0.066],
        0.006,
        Math.PI,
        pd.ivory,
      );
    }
  for (const x of [-0.29, 0.29]) {
    pd.box([0.19, 0.18, 0.012], [x, -0.16, -0.035], m.trim);
    for (let i = 0; i < 4; i++)
      ppt.knob(x + ((i % 2) - 0.5) * 0.09, -0.11 - Math.floor(i / 2) * 0.1, -0.055, 0.013);
    beveledBox(pd, [0.22, 0.12, 0.1], [x, -0.38, -0.055], m.trim, 0.025);
  }
  // Parking-brake T-handle on its shaft.
  consoleSwitches.add(parts.alloy, bar([0, -0.39, -0.02], [0, -0.39, -0.07], 0.006, 12));
  consoleSwitches.add(
    parts.red,
    place(roundedBox([0.07, 0.018, 0.02], 0.006, 1), [0, -0.39, -0.078]),
  );
  consoleSwitches.emit(pd);
  pd.text('PARK BRK', [0, -0.355, -0.021], 0.008, Math.PI, pd.ivory);
  pd.finish();
  // Cabin floor, stopping short of the nose where the belly narrows (it showed through at z 3.3).
  d.box([1.94, 0.045, 4.95], [0, 0.56, 0.695], m.trim);
  const addSeat = (parent, x, y, z, armored = false) => {
    const sd = detailKit(parent, 'UH60-seat');
    beveledBox(sd, [0.48, 0.12, 0.49], [x, y, z], seat);
    beveledBox(sd, [0.48, 0.65, 0.13], [x, y + 0.34, z - 0.23], seat);
    beveledBox(sd, [0.26, 0.18, 0.14], [x, y + 0.72, z - 0.24], seat);
    for (const side of [-1, 1]) {
      sd.rod(
        [x + side * 0.19, 0.6, z - 0.13],
        [x + side * 0.19, y - 0.07, z - 0.13],
        0.019,
        m.metal,
      );
      sheet(
        sd,
        [
          [x + side * 0.17, y + 0.59, z - 0.15],
          [x + side * 0.12, y + 0.59, z - 0.15],
          [x - side * 0.02, y + 0.08, z + 0.18],
          [x + side * 0.02, y + 0.08, z + 0.18],
        ],
        belt,
        [0, 0, 1],
      );
      if (armored)
        beveledBox(sd, [0.025, 0.66, 0.5], [x + side * 0.255, y + 0.24, z - 0.06], m.paint, 0.009);
    }
    sd.box([0.065, 0.035, 0.02], [x, y + 0.09, z + 0.19], m.metal);
    sd.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * 0.56;
    // Armored crew seats ride high: the cushion sits 0.8 m under the eye.
    addSeat(cabin, x, 1.05, 2.61, true);
    // Floor-mounted cyclic, jogged aft, with the Black Hawk grip (Army UH-60M cockpit photos).
    const cg = group(cabin, `UH60-cyclic-${side}`, [x, 0.58, 2.96]),
      cd = detailKit(cg, 'cyclic');
    sikorskyCyclic(cd, {
      path: [
        [0, 0, 0],
        [0, 0.38, 0],
        [0, 0.5, -0.12],
        [0, 0.58, -0.2],
        [0, 0.66, -0.21],
      ],
      floor: 0.003,
      tubeMaterial: m.trim,
      palette: parts,
    });
    cd.finish();
    bindings.push(
      { node: cg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: cg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const lg = group(cabin, `UH60-collective-${side}`, [x + 0.27, 0.87, 2.39]),
      ld = detailKit(lg, 'collective');
    sikorskyCollective(ld, { end: [0, 0.23, 0.43], tubeMaterial: m.trim, palette: parts });
    ld.finish();
    bindings.push({ node: lg.name, source: 'power', property: 'rotation', axis: 'x', scale: -0.4 });
    for (const j of [-1, 1]) {
      const g = group(cabin, `UH60-pedal-${side}-${j}`, [x + j * 0.14, 0.8, 3.52]),
        dd = detailKit(g, 'pedal');
      pedalGeometry(dd, {
        style: 'heli',
        side: j,
        scale: 1.25,
        drop: 0.09,
        lean: 0.45,
        palette: parts,
      });
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
  // Heel plates under the pedals, rising from the cabin floor's front edge into the nose: the
  // pedals stood over the bare belly.
  for (const side of [-1, 1]) {
    const x0 = side * 0.56;
    quad(
      d,
      [x0 - 0.27, 0.583, 3.17],
      [x0 + 0.27, 0.583, 3.17],
      [x0 + 0.24, 0.655, 3.78],
      [x0 - 0.24, 0.655, 3.78],
      m.trim,
      [0, 1, -0.1],
    );
  }
  for (const side of [-1, 1]) {
    const cg = group(cabin, `UH60-crew-seat-${side}`, [side * 0.86, 0, 1.6]);
    cg.rotation.y = (side * Math.PI) / 2;
    addSeat(cg, 0, 0.88, 0);
  }
  for (const z of [0.2, -0.75, -1.7]) for (const x of [-0.7, 0, 0.7]) addSeat(cabin, x, 0.86, z);
  // Broad center overhead console and structural bow; switches remain diagrammatic. It ends
  // at the windscreen header rather than poking through the glazing.
  const og = group(cabin, 'UH60-overhead', [0, 2.1, 2.33]),
    od = detailKit(og, 'overhead');
  od.box([0.51, 0.055, 1.13], [0, 0, 0], m.trim);
  // Switch panels aft; forward, the engine control quadrant (end of this function).
  for (let r = 0; r < 8; r++)
    for (const x of [-0.17, -0.06, 0.06, 0.17]) {
      od.box([0.075, 0.007, 0.07], [x, -0.032, -0.46 + r * 0.1], face);
      od.add(new T.CylinderGeometry(0.004, 0.004, 0.006, 8), m.metal, [x, -0.038, -0.46 + r * 0.1]);
      const bat = od.add(
        new T.CylinderGeometry(0.0024, 0.0015, 0.017, 8),
        r === 2 ? od.red : m.metal,
        [x, -0.048, -0.457 + r * 0.1],
      );
      bat.rotation.x = 0.35;
    }
  // Quadrant plate with the two power control lever slots and their detents.
  od.box([0.3, 0.012, 0.22], [0, -0.034, 0.42], face);
  for (const x of [-0.06, 0.06]) {
    od.box([0.012, 0.004, 0.16], [x, -0.041, 0.42], od.dark);
    // Facing down, read with the nose up the page.
    for (const [zz, label] of [
      [0.36, 'OFF'],
      [0.42, 'IDLE'],
      [0.48, 'FLY'],
    ])
      od.text(label, [x + 0.028, -0.0415, zz], 0.0065, 0, od.ivory).rotation.set(Math.PI / 2, 0, 0);
  }
  for (const x of [-0.13, 0.13]) {
    // ENG EMER OFF T-handles at the quadrant's outer corners.
    od.add(new T.CylinderGeometry(0.005, 0.005, 0.03, 10), m.metal, [x, -0.055, 0.5]);
    od.box([0.05, 0.014, 0.018], [x, -0.074, 0.5], od.red);
  }
  od.finish();
  // ENG 1 and ENG 2 POWER CONT levers (OFF / IDLE / FLY), moving together as the engine master:
  // forward is FLY. The levers hang from the quadrant, so their rest pose turns them upside down.
  for (const [x, label] of [
    [0.06, 'ENG 1'],
    [-0.06, 'ENG 2'],
  ]) {
    const lever = group(og, `UH60-power-lever-${label.at(-1)}`, [x, -0.04, 0.42]);
    lever.rotation.x = Math.PI;
    const lk = detailKit(lever, lever.name);
    powerControlLever(lk, parts, 0.085);
    // On the grip's aft face, upright to the pilot (the lever frame is upside down).
    lk.text(label, [0, 0.093, 0.0175], 0.0055, 0, lk.ivory).rotation.set(0, 0, Math.PI);
    lk.finish();
    lever.userData.aircraftControl = {
      action: 'engine',
      motion: { property: 'rotation', axis: 'x', scale: -0.7, offset: 0.35 },
    };
  }
  d.finish();
  return { nodes: ['cockpit'], bindings };
}

/** Index of the +X side's upper corner in `section` rings (its mirror is ring length - 5). */
const SIDE_TOP = 5;
/** 22-point fuselage section in the template's point order (top, +X side, keel): superelliptic
 * roof shoulders `upper` tall and belly corners `lower` tall (exponents n, m) joined by a flat,
 * upright side from index SIDE_TOP to SIDE_TOP + 1, so window sheets stay planar. */
function section(w, b, t, upper, lower, n = 4, m = 3) {
  const steps = [18, 36, 54, 72, 90].map((a) => (a * Math.PI) / 180),
    top = steps.map((a) => [
      w * Math.pow(Math.sin(a), 2 / n),
      t - upper + upper * Math.pow(Math.cos(a), 2 / n),
    ]),
    bottom = [...steps]
      .reverse()
      .map((a) => [
        w * Math.pow(Math.sin(a), 2 / m),
        b + lower - lower * Math.pow(Math.cos(a), 2 / m),
      ]),
    half = [...top, ...bottom];
  return [[0, t], ...half, [0, b], ...half.reverse().map(([x, y]) => [-x, y])];
}

/** Nose dome from a fuselage ring at z0 to a rounded tip at z1: quarter-ellipse in plan,
 * blended toward a straight taper in profile by `wedge` (0 = elliptical, 1 = conical). */
function noseDome(d, ring, z0, z1, tipY, material, wedge = 0) {
  const points = ring.flatMap((q, i) => {
    const n = ring[(i + 1) % ring.length];
    return [q, [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]];
  });
  loft(
    d,
    [0, 0.35, 0.62, 0.82, 0.94, 0.99].map((u) => {
      const s = Math.sqrt(1 - u * u),
        sy = s * (1 - wedge) + (1 - u) * wedge;
      return {
        z: z0 + (z1 - z0) * u,
        points: points.map(([x, y]) => [x * s, tipY + (y - tipY) * sy]),
      };
    }),
    material,
  );
}
