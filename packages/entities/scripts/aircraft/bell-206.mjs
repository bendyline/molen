/** Bell 206B-3, standard low skids. Bell 2005 dimension sheet, p2, and
 * Gabriel Resende Veiga's CC BY-SA 4.0 Bell 206B panel photograph.
 * Mast z=0. Geometry follows the B-3 sheet; the Commons 206A drawing is secondary.
 */
import {
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

/** Smooth curve through stations; t runs evenly over the spans between them. */
export const through = (points) => {
  const n = points.length - 1;
  return (t) => {
    const at = Math.max(0, Math.min(n - 1e-9, t * n)),
      i = Math.floor(at),
      u = at - i,
      a = points[Math.max(0, i - 1)],
      b = points[i],
      c = points[i + 1],
      e = points[Math.min(n, i + 2)];
    return b.map((v, k) => {
      const m = (c[k] - a[k]) / 2,
        o = (e[k] - v) / 2;
      return v + u * (m + u * (3 * (c[k] - v) - 2 * m - o + u * (2 * (v - c[k]) + m + o)));
    });
  };
};
/** Coons patch: four edge curves shared with the neighboring panels, so seams cannot crack. */
const coons = (low, high, left, right) => {
  const a = low(0),
    b = low(1),
    c = high(0),
    e = high(1);
  return (u, v) => {
    const l = low(u),
      h = high(u),
      p = left(v),
      q = right(v);
    return l.map(
      (_, k) =>
        (1 - v) * l[k] +
        v * h[k] +
        (1 - u) * p[k] +
        u * q[k] -
        (1 - u) * (1 - v) * a[k] -
        u * (1 - v) * b[k] -
        (1 - u) * v * c[k] -
        u * v * e[k],
    );
  };
};
/** Smooth-shaded surface for one side; pick(i, j) names each cell's material. */
function skin(parent, surface, nu, nv, side, pick) {
  const positions = [];
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const [x, y, z] = surface(i / nu, j / nv);
      positions.push(x * side, y, z);
    }
  const cells = new Map();
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i,
        b = a + 1,
        c = a + nu + 2,
        e = a + nu + 1,
        material = pick(i, j);
      if (!cells.has(material)) cells.set(material, []);
      cells.get(material).push(...(side > 0 ? [a, e, c, a, c, b] : [a, c, e, a, b, c]));
    }
  for (const [material, index] of cells) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    parent.add(new T.Mesh(geometry, material));
  }
}
/**
 * The JetRanger family's forward fuselage, shared by the 206 and 407: a one-piece windscreen that
 * wraps down to the door post, a blunt nose, and chin windows set low. Curves are station points
 * [x, y, z] on the +X side, read from the manufacturer's three views.
 */
export function bellNose(d, s, m) {
  // Outside the detail kit, whose merge would flat-shade these curved panels.
  const shell = group(d.root.parent, 'forward-fuselage');
  const windscreen = coons(through(s.lower), through(s.roof), through(s.center), through(s.post)),
    bulged = (u, v) => {
      const p = windscreen(u, v),
        swell = s.bulge * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      return [p[0] + swell, p[1] + swell * 0.5, p[2]];
    },
    tip = () => s.nose[0],
    top = coons(
      through(s.belt),
      through([...s.nose, ...s.lower.slice(1)]),
      tip,
      through([s.rear[0], s.post[0]]),
    ),
    under = coons(through(s.belt), through(s.keel), tip, through(s.rear));
  const [u0, u1, v0, v1] = s.chin,
    nu = 12,
    nv = 6;
  for (const side of [-1, 1]) {
    const flip = (points) => points.map(([x, y, z]) => [x * side, y, z]),
      along = (f, n = 10) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
    skin(shell, bulged, 14, 10, side, () => m.glass);
    skin(shell, top, nu, 4, side, () => m.upper);
    skin(shell, under, nu, nv, side, (i, j) =>
      i >= u0 && i < u1 && j >= v0 && j < v1 ? m.glass : m.lower,
    );
    const pane = [
      ...along((t) => under((u0 + (u1 - u0) * t) / nu, v0 / nv)),
      ...along((t) => under(u1 / nu, (v0 + (v1 - v0) * t) / nv)),
      ...along((t) => under((u1 - (u1 - u0) * t) / nu, v1 / nv)),
      ...along((t) => under(u0 / nu, (v1 - (v1 - v0) * t) / nv)),
    ];
    outline(d, flip(pane), 0.012, m.frame);
    outline(d, flip(along(through(s.lower), 16)), 0.014, m.frame, false);
    outline(d, flip(along(through(s.roof))), 0.017, m.upper, false);
    outline(d, flip(along(through(s.post))), 0.018, m.upper, false);
  }
  outline(
    d,
    Array.from({ length: 11 }, (_, i) => through(s.center)(i / 10)),
    0.018,
    m.upper,
    false,
  );
}
export const bell206Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 0.69,
  cy: 1.05,
  ry: 0.74,
  cabinZ: 1.0,
  cabinWidth: 1.32,
  eye: [-0.34, 1.5, 0.98],
  panelZ: 1.73,
  floor: 0.39,
  mainRotorPosition: [0, 2.83, 0],
});
export function buildBell206(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('206-ivory', '#dddeda', { side: T.DoubleSide }),
    blue = mat('206-blue', '#315878', { side: T.DoubleSide }),
    trim = mat('206-gaskets', '#252b2e'),
    glass = mat('206-glass', '#a5bdc2', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    }),
    metal = mat('206-alloy', '#8b979b', { metalness: 0.65 }),
    seat = mat('206-seat', '#697c83', { roughness: 0.92 });
  const d = detailKit(root, '206-shell');
  // Each section is independently located against the dimensioned side, top and front outlines:
  // the sheet's front view makes the cabin 1.31 m wide and 1.35 m deep. The first section carries
  // only the belly forward of the door post.
  const sections = [
    [1.74, 0.655, 0.43, 1.75],
    [1.33, 0.66, 0.4, 1.72],
    [0.35, 0.66, 0.33, 1.69],
    [-0.85, 0.645, 0.32, 1.63],
    [-1.65, 0.43, 0.62, 1.59],
    [-2.35, 0.22, 1.05, 1.58],
  ].map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [w * 0.83, t - 0.015],
      [w, t - Math.min(0.12, (t - b) * 0.22)],
      [w, b + Math.min(0.13, (t - b) * 0.22)],
      [w * 0.68, b],
      [-w * 0.68, b],
      [-w, b + Math.min(0.13, (t - b) * 0.22)],
      [-w, t - Math.min(0.12, (t - b) * 0.22)],
      [-w * 0.83, t - 0.015],
    ],
  }));
  const p = (i, j) => [...sections[i].points[j], sections[i].z];
  loft(d, sections, paint, {
    caps: false,
    skip: (i, j) => (i === 0 && ![3, 4, 5].includes(j)) || (i < 3 && [2, 6].includes(j)),
  });
  // Curved windscreen wrapping down to the door post, around a single center post, over a blunt
  // nose with paired chin windows and an opaque keel. Stations from the B-3 sheet, p. 2.
  const nose = {
    nose: [
      [0, 0.82, 2.83],
      [0, 0.91, 2.76],
      [0, 0.99, 2.57],
      [0, 1.06, 2.36],
    ],
    center: [
      [0, 1.06, 2.36],
      [0, 1.36, 2.09],
      [0, 1.56, 1.89],
      [0, 1.66, 1.69],
      [0, 1.7, 1.49],
      [0, 1.72, 1.33],
    ],
    lower: [
      [0, 1.06, 2.36],
      [0.28, 1.02, 2.35],
      [0.48, 0.98, 2.28],
      [0.6, 0.93, 2.1],
      [0.652, 0.9, 1.68],
    ],
    roof: [
      [0, 1.72, 1.33],
      [0.28, 1.715, 1.33],
      [0.548, 1.705, 1.33],
      [0.66, 1.6, 1.33],
    ],
    post: [
      [0.652, 0.9, 1.68],
      [0.655, 1.13, 1.57],
      [0.658, 1.37, 1.45],
      [0.66, 1.6, 1.33],
    ],
    belt: [
      [0, 0.82, 2.83],
      [0.16, 0.82, 2.81],
      [0.3, 0.815, 2.76],
      [0.5, 0.8, 2.62],
      [0.593, 0.79, 2.41],
      [0.64, 0.785, 2.17],
      [0.65, 0.78, 1.97],
      [0.652, 0.78, 1.7],
    ],
    keel: [
      [0, 0.82, 2.83],
      [0, 0.66, 2.61],
      [0, 0.54, 2.33],
      [0, 0.46, 1.95],
      [0, 0.43, 1.74],
    ],
    rear: [
      [0.652, 0.78, 1.7],
      [0.655, 0.56, 1.74],
      [0.445, 0.43, 1.74],
      [0, 0.43, 1.74],
    ],
    chin: [2, 9, 1, 5],
    bulge: 0.02,
  };
  bellNose(d, nose, { glass, upper: paint, lower: paint, frame: trim });
  d.rod([0, 0.82, 2.82], [0, 0.82, 2.96], 0.007, metal);
  for (const side of [-1, 1]) {
    // Four doors with transparent apertures, window gaskets, handles, hinges and drain seams.
    const j = side === 1 ? 2 : 7,
      k = side === 1 ? 3 : 6;
    const sx = (z) =>
      side *
      (z > 1.33 ? 0.66 - (z - 1.33) * 0.0125 : z < 0.35 ? 0.66 - ((0.35 - z) / 1.2) * 0.015 : 0.66);
    const q = (z, y) => [sx(z), y, z];
    const holes = [
      [
        [1.27, 1.5],
        [0.8, 1.48],
        [0.95, 0.92],
        [1.45, 0.96],
      ],
      [
        [0.63, 1.45],
        [-0.18, 1.4],
        [-0.05, 0.84],
        [0.74, 0.9],
      ],
    ].map((h) => h.map(([z, y]) => q(z, y)));
    sheet(
      d,
      [
        p(1, j),
        p(2, j),
        p(3, j),
        p(3, k),
        p(2, k),
        p(1, k),
        p(0, k),
        ...[nose.rear[0], ...nose.post.slice(0, -1)].map(([x, y, z]) => [x * side, y, z]),
      ],
      paint,
      [side, 0, 0],
      holes,
    );
    for (const hole of holes) {
      sheet(d, hole, glass, [side, 0, 0]);
      outline(d, hole, 0.014, trim);
    }
    for (const door of [
      [
        [1.27, 1.56],
        [0.72, 1.53],
        [0.93, 0.53],
        [1.74, 0.58],
      ],
      [
        [0.69, 1.52],
        [-0.26, 1.45],
        [-0.13, 0.58],
        [0.89, 0.52],
      ],
    ])
      outline(
        d,
        door.map(([z, y]) => q(z, y)),
        0.005,
        trim,
      );
    for (const z of [1.04, 0.0])
      d.rod([sx(z) * 1.01, 0.83, z - 0.055], [sx(z) * 1.01, 0.83, z + 0.055], 0.013, metal);
    for (const [z, y] of [
      [1.67, 0.82],
      [1.32, 1.4],
      [0.87, 0.76],
      [0.71, 1.38],
    ])
      d.box([0.035, 0.04, 0.06], [sx(z) * 1.01, y, z], metal);
    // Blue lower fuselage stripe follows the measured contour; no photo texture.
    const stripe = sections
      .slice(0, 5)
      .map((q) => [side * (Math.abs(q.points[2][0]) + 0.003), q.points[3][1] + 0.06, q.z]);
    for (let i = 0; i < stripe.length - 1; i++) {
      const a = stripe[i],
        b = stripe[i + 1];
      quad(d, a, b, [b[0], b[1] + 0.095, b[2]], [a[0], a[1] + 0.095, a[2]], blue, [side, 0, 0]);
    }
    // Baggage hatch behind the rear door, placed on the tapered flank.
    const hatch = [
      [side * 0.593, 0.63, -1.04],
      [side * 0.455, 0.72, -1.55],
      [side * 0.455, 1.26, -1.55],
      [side * 0.593, 1.28, -1.04],
    ];
    outline(d, hatch, 0.005, trim);
    d.rod([side * 0.6, 0.94, -1.08], [side * 0.6, 0.94, -1.18], 0.012, metal);
    for (let j = 0; j < 4; j++) {
      const z = -1.37 - j * 0.055;
      d.rod([side * 0.29, 1.81, z], [side * 0.29, 1.67, z], 0.012, trim);
    }
  }
  // Raised transmission/engine roof, with separate intake lip and two upward exhausts.
  const engine = (z, w, b, t) => {
    const shoulder = Math.max(b + (t - b) * 0.4, t - 0.12),
      // Flat top with rounded edges over upright sides.
      crown = Array.from({ length: 5 }, (_, k) => {
        const a = (k * Math.PI) / 8;
        return [
          w * Math.pow(Math.sin(a), 2 / 3.2),
          shoulder + (t - shoulder) * Math.pow(Math.cos(a), 2 / 3.2),
        ];
      });
    return {
      z,
      points: [
        ...crown,
        [w, b],
        [-w, b],
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
      engine(1.23, 0.18, 1.72, 1.73),
      engine(0.93, 0.29, 1.71, 1.96),
      engine(0.62, 0.35, 1.7, 2.06),
      engine(-0.7, 0.39, 1.64, 2.0),
      engine(-1.37, 0.3, 1.59, 1.93),
      engine(-2.35, 0.19, 1.57, 1.6),
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    d.rod([side * 0.31, 1.94, -0.78], [side * 0.39, 2.1, -0.78], 0.072, metal);
    d.add(new T.CircleGeometry(0.058, 16).rotateX(-Math.PI / 2), trim, [side * 0.39, 2.145, -0.78]);
    d.box([0.014, 0.09, 0.25], [side * 0.355, 1.85, 0.6], trim);
  }
  // Tail boom and the swept dorsal/ventral fin share the B-3 station geometry.
  const boom = (z, w, y, h) => ({
    z,
    points: Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5;
      return [Math.sin(a) * w, y + Math.cos(a) * h];
    }),
  });
  loft(
    d,
    [
      boom(-2.35, 0.22, 1.32, 0.26),
      boom(-4.8, 0.12, 1.43, 0.15),
      boom(-5.85, 0.08, 1.48, 0.11),
      boom(-6.3, 0.025, 1.4, 0.025),
    ],
    paint,
  );
  for (const z of [-3, -4, -5]) {
    const u = (-z - 2.35) / 3.5,
      q = boom(z, 0.22 - 0.14 * u, 1.32 + 0.16 * u, 0.26 - 0.15 * u);
    outline(
      d,
      q.points.map((p) => [...p, z]),
      0.0035,
      trim,
    );
  }
  const fin = [
    [-0.035, 1.48, -5.65],
    [-0.035, 2.52, -6.02],
    [-0.035, 2.52, -6.45],
    [-0.035, 1.52, -6.05],
    [-0.035, 0.73, -6.42],
    [-0.035, 0.72, -6.08],
    [-0.035, 1.32, -5.65],
  ];
  sheet(d, fin, paint, [-1, 0, 0]);
  sheet(
    d,
    fin.map((p) => [-p[0], p[1], p[2]]),
    paint,
    [1, 0, 0],
  );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(d, a, b, [-b[0], b[1], b[2]], [-a[0], a[1], a[2]], paint, [0, 1, 0]);
  }
  d.rod([0, 0.73, -6.42], [0, 0.38, -6.98], 0.018, metal);
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.12, 1.43, -3.57, -4.2],
        [side * 0.98, 1.43, -3.59, -4.21],
      ],
      paint,
      0.045,
    );
    d.box([0.03, 0.02, 0.07], [side * 0.96, 1.46, -3.71], side < 0 ? d.green : d.red);
  }
  // Standard low skids: 1.92 m outside span and 2.47 m rearward measured rail run.
  for (const side of [-1, 1]) {
    outline(
      d,
      [
        [side * 0.92, 0.18, 1.68],
        [side * 0.92, 0.055, 1.48],
        [side * 0.92, 0.045, -0.79],
      ],
      0.04,
      metal,
      false,
    );
    for (const z of [1.03, -0.53])
      outline(
        d,
        [
          [0, 0.39, z],
          [side * 0.63, 0.39, z],
          [side * 0.82, 0.25, z],
          [side * 0.92, 0.07, z - 0.06],
        ],
        0.033,
        metal,
        false,
      );
    d.rod([side * 0.68, 0.5, 0.67], [side * 0.88, 0.5, 0.67], 0.018, metal);
  }
  // Mast is pitched forward five degrees; spinning child retains a local vertical axis.
  const mast = group(root, '206-mast', [0, 2.83, 0]);
  mast.rotation.x = (5 * Math.PI) / 180;
  const md = detailKit(mast, '206-mast');
  md.rod([0, -0.79, 0], [0, -0.02, 0], 0.036, metal);
  md.ring(0.14, 0.025, [0, -0.49, 0], metal, 'y');
  for (const side of [-1, 1])
    md.rod([side * 0.12, -0.48, 0], [side * 0.16, -0.04, 0], 0.012, metal);
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, '206-rotor');
  rd.box([0.54, 0.09, 0.18], [0, 0, 0], metal);
  for (const side of [-1, 1]) {
    wing(
      rd,
      [
        [side * 0.24, 0, 0.12, -0.14],
        [side * 0.62, 0.015, 0.16, -0.17],
        [side * 5.08, 0.075, 0.14, -0.19],
      ],
      trim,
      0.02,
    );
    rd.box([0.14, 0.007, 0.32], [side * 4.98, 0.084, -0.02], d.ivory);
  }
  rd.finish();
  const tail = group(root, 'tail-rotor', [0.16, 1.48, -5.86]),
    td = detailKit(tail, '206-tail-rotor');
  td.rod([-0.12, 0, 0], [0.12, 0, 0], 0.038, metal);
  for (const side of [-1, 1]) {
    td.box([0.025, 0.7, 0.1], [0.02, side * 0.43, 0], trim);
    td.box([0.027, 0.08, 0.1], [0.02, side * 0.75, 0], d.ivory);
  }
  td.finish();
  // Maintenance rivet rows, small readable access labels and anticollision beacon.
  for (const side of [-1, 1])
    for (let i = 0; i < 22; i++)
      d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [side * 0.662, 0.52, 1.46 - i * 0.1]);
  d.text('206B', [0.664, 0.74, -0.3], 0.075, Math.PI / 2, blue);
  d.text('206B', [-0.664, 0.74, -0.3], 0.075, -Math.PI / 2, blue);
  d.box([0.045, 0.045, 0.055], [0, 2.55, -6.2], d.red);
  d.finish();
  const interior = bell206Cockpit(root, { paint, blue, trim, metal, seat });
  cleanGeometry(root);
  return {
    root,
    frame: bell206Frame(),
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

function bell206Cockpit(root, m) {
  // The face below is authored at twice life size, in the coordinates of the PT-HUR photograph.
  // Half scale makes its large dials 85 mm over the bezel (3.125 in instruments), so the panel is
  // 0.58 m wide and 0.40 m tall, centered on the aircraft, with its top 0.2 m below the eye.
  const cabin = group(root, 'cockpit'),
    panelGroup = group(cabin, '206-instrument-panel', [0.0375, 0.52, 0.74]),
    bindings = [];
  panelGroup.scale.setScalar(0.5);
  let d = detailKit(cabin, '206-floor');
  const panel = mat('206-panel', '#7b8584'),
    face = mat('206-dials', '#142027'),
    ink = mat('206-ink', '#d2dbca'),
    sky = mat('206-horizon-sky', '#558995'),
    earth = mat('206-horizon-earth', '#675f40');
  d.box([1.0, 0.03, 2.1], [0, 0.47, 0.35], m.trim);
  d.box([0.76, 0.03, 0.5], [0, 0.56, 1.64], m.trim);
  d.finish();
  d = detailKit(panelGroup, '206-panel');
  // Compact full instrument face with the taller radio pedestal beneath its center.
  const edge = [
    [-0.65, 1.43, 1.98],
    [-0.62, 1.53, 1.98],
    [-0.54, 1.56, 1.98],
    [0.37, 1.56, 1.98],
    [0.47, 1.5, 1.98],
    [0.5, 1.4, 1.98],
    [0.5, 0.82, 1.98],
    [0.44, 0.76, 1.98],
    [-0.58, 0.76, 1.98],
    [-0.65, 0.82, 1.98],
  ];
  sheet(d, edge, panel, [0, 0, -1]);
  sheet(
    d,
    edge.map(([x, y]) => [x, y, 2.22]),
    m.trim,
    [0, 0, 1],
  );
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i],
      b = edge[(i + 1) % edge.length];
    quad(d, a, b, [b[0], b[1], 2.22], [a[0], a[1], 2.22], m.trim, [0, 1, 0]);
  }
  outline(d, edge.slice(0, 7), 0.022, m.trim, false);
  // Relative arrangement from the photographed PT-HUR panel; physical size is cabin-fit.
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 9; c++)
      d.box([0.064, 0.022, 0.005], [0.2 - c * 0.083, 1.484 - r * 0.03, 1.964], face);
  const gauge = (name, x, y, r, source, attitude = false) => {
    d.add(new T.CircleGeometry(r, 24).rotateY(Math.PI), face, [x, y, 1.96]);
    d.ring(r, 0.007, [x, y, 1.955], m.trim);
    if (attitude) {
      d.add(new T.CircleGeometry(r * 0.89, 24, 0, Math.PI).rotateY(Math.PI), sky, [x, y, 1.95]);
      d.add(new T.CircleGeometry(r * 0.89, 24, Math.PI, Math.PI).rotateY(Math.PI), earth, [
        x,
        y,
        1.95,
      ]);
      for (const j of [-2, -1, 1, 2])
        d.box([r * 0.55, 0.002, 0.002], [x, y + j * r * 0.18, 1.945], ink);
    }
    for (let i = 0; i < 24; i++) {
      const a = (-0.25 + (i * 1.5) / 23) * Math.PI;
      d.rod(
        [x + Math.cos(a) * r * 0.76, y + Math.sin(a) * r * 0.76, 1.947],
        [x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88, 1.947],
        0.0013,
        ink,
      );
    }
    if (!attitude)
      for (let i = 0; i < 5; i++) {
        const a = (-0.25 + (i * 1.5) / 4) * Math.PI;
        d.text(
          source === 'heading' ? ['E', 'S', 'W', 'N', 'E'][i] : String(i * 2),
          [x + Math.cos(a) * r * 0.59, y + Math.sin(a) * r * 0.59, 1.944],
          r * 0.15,
          Math.PI,
          ink,
        );
      }
    if (['power', 'rpm'].includes(source))
      for (let i = 0; i < 10; i++) {
        const a = 0.15 + i * 0.09,
          b = a + 0.07;
        d.rod(
          [x + Math.cos(a) * r * 0.91, y + Math.sin(a) * r * 0.91, 1.943],
          [x + Math.cos(b) * r * 0.91, y + Math.sin(b) * r * 0.91, 1.943],
          0.0028,
          d.green,
        );
      }
    d.text(name, [x, y - r * 0.32, 1.943], r * 0.16, Math.PI, ink);
    const n = group(panelGroup, `206-${name.replaceAll(' ', '-')}-pointer`, [x, y, 1.94]),
      nd = detailKit(n, 'pointer');
    if (attitude) nd.box([r * 1.15, 0.004, 0.003], [0, 0, 0], nd.amber);
    else nd.rod([0, -r * 0.15, 0], [0, r * 0.69, 0], 0.002, ink);
    nd.finish();
    bindings.push({
      node: n.name,
      source,
      property: 'rotation',
      axis: 'z',
      scale: attitude
        ? 1
        : source === 'airspeed'
          ? 0.044
          : source === 'altitude'
            ? 0.0206
            : source === 'heading'
              ? -1
              : 3.8,
      offset: attitude ? 0 : -1.8,
    });
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        d.add(new T.CircleGeometry(0.002, 5).rotateY(Math.PI), m.metal, [
          x + sx * r * 0.98,
          y + sy * r * 0.98,
          1.959,
        ]);
  };
  const gauges = [
    ['ENG OIL', 0.18, 1.334, 0.064, 'rpm'],
    ['TORQUE', 0.027, 1.333, 0.064, 'power'],
    ['KNOTS', -0.153, 1.307, 0.085, 'airspeed'],
    ['ATT', -0.346, 1.307, 0.085, 'roll', true],
    ['ALT', -0.535, 1.307, 0.077, 'altitude'],
    ['XMSN', 0.169, 1.187, 0.064, 'rpm'],
    ['TEMP', 0.011, 1.191, 0.064, 'power'],
    ['RPM', -0.176, 1.128, 0.085, 'rpm'],
    ['HDG', -0.382, 1.127, 0.085, 'heading'],
    ['CLIMB', -0.576, 1.151, 0.061, 'verticalSpeed'],
    ['FUEL', 0.156, 1.035, 0.07, 'power'],
    ['N1', 0.006, 1.045, 0.064, 'rpm'],
    ['VOR', -0.204, 0.928, 0.081, 'heading'],
    ['ADF', -0.41, 0.938, 0.081, 'heading'],
    ['TURN', -0.588, 1.022, 0.054, 'yaw'],
    ['FUEL PSI', 0.149, 0.876, 0.065, 'power'],
  ];
  for (const g of gauges) gauge(...g);
  d.box([0.13, 0.09, 0.006], [-0.019, 0.898, 1.96], face);
  d.text('12.00', [-0.019, 0.91, 1.951], 0.022, Math.PI, ink);
  d.box([0.17, 0.12, 0.004], [0.37, 1.29, 1.96], m.trim);
  const master = group(panelGroup, '206-engine-master', [0.37, 1.29, 1.94]);
  master.userData.aircraftControl = {
    action: 'engine',
    motion: { property: 'rotation', axis: 'x', scale: -0.5 },
  };
  const md = detailKit(master, master.name);
  md.box([0.04, 0.06, 0.025], [0, 0, 0], d.red);
  md.finish();
  d.text('ENGINE', [0.37, 1.335, 1.935], 0.012, Math.PI, d.ivory);
  d.box([0.22, 0.16, 0.004], [0.37, 1.04, 1.959], d.ivory);
  d.text('DANGER', [0.37, 1.07, 1.949], 0.024, Math.PI, d.red);
  d.text('TAIL ROTOR', [0.37, 1.025, 1.949], 0.016, Math.PI, m.trim);
  d.box([0.05, 0.075, 0.03], [-0.54, 0.81, 1.94], d.red);
  const radio = group(cabin, '206-radio-pedestal', [0, 0.69, 1.61]);
  radio.rotation.x = 0.55;
  const rd = detailKit(radio, '206-radio');
  rd.box([0.29, 0.42, 0.18], [0, 0, 0.065], m.trim);
  for (let i = 0; i < 3; i++) {
    const y = 0.13 - i * 0.125;
    rd.box([0.26, 0.105, 0.012], [0, y, -0.034], panel);
    rd.box([0.16, 0.037, 0.006], [0.012, y + 0.02, -0.044], face);
    rd.text(
      i === 0 ? '118.00' : i === 1 ? '110.50' : '1200',
      [0, y + 0.021, -0.05],
      0.016,
      Math.PI,
      rd.amber,
    );
    for (const x of [-0.105, 0.105])
      rd.add(new T.CylinderGeometry(0.014, 0.014, 0.018, 8).rotateX(Math.PI / 2), m.trim, [
        x,
        y - 0.026,
        -0.05,
      ]);
  }
  rd.finish();
  d.finish();
  d = detailKit(cabin, '206-cabin');
  for (const side of [-1, 1]) {
    const x = side * 0.34;
    d.box([0.43, 0.12, 0.48], [x, 0.66, 0.98], m.seat);
    const back = d.box([0.43, 0.55, 0.09], [x, 0.97, 0.74], m.seat);
    back.rotation.x = -0.13;
    for (const sx of [-1, 1]) {
      d.rod([x + sx * 0.18, 0.43, 0.79], [x + sx * 0.18, 0.62, 0.79], 0.018, m.metal);
      d.rod([x + sx * 0.13, 1.2, 0.69], [x + sx * 0.025, 0.74, 1.12], 0.015, m.trim);
    }
    d.box([0.065, 0.04, 0.025], [x, 0.75, 1.12], m.metal);
    const stick = group(cabin, `206-cyclic-${side}`, [x, 0.44, 1.39]),
      sd = detailKit(stick, 'cyclic');
    outline(
      sd,
      [
        [0, 0, 0],
        [0, 0.26, 0],
        [0, 0.4, -0.16],
        [0, 0.54, -0.18],
      ],
      0.017,
      m.trim,
      false,
    );
    sd.box([0.045, 0.12, 0.045], [0, 0.57, -0.18], m.trim);
    sd.box([0.015, 0.015, 0.013], [0, 0.64, -0.19], sd.red);
    sd.finish();
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.15 },
    );
    const collective = group(cabin, `206-collective-${side}`, [x + 0.24, 0.5, 0.82]),
      cd = detailKit(collective, 'collective');
    cd.rod([0, 0, 0], [0, 0.15, 0.44], 0.021, m.trim);
    cd.box([0.047, 0.048, 0.13], [0, 0.15, 0.44], m.trim);
    cd.finish();
    bindings.push({
      node: collective.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: -0.4,
    });
    for (const k of [-1, 1]) {
      const pg = group(cabin, `206-pedal-${side}-${k}`, [x + k * 0.11, 0.64, 1.86]),
        pd = detailKit(pg, 'pedal');
      pd.box([0.14, 0.075, 0.02], [0, 0, 0], m.metal);
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -k * 0.04,
      });
    }
  }
  // Three-place rear bench and roof switch strip, separate from the engine cowling.
  d.box([1.22, 0.11, 0.44], [0, 0.65, -0.4], m.seat);
  d.box([1.22, 0.55, 0.08], [0, 0.96, -0.63], m.seat);
  for (const x of [-0.4, 0, 0.4])
    d.rod([x - 0.12, 1.2, -0.67], [x + 0.12, 0.72, -0.16], 0.018, m.trim);
  d.box([0.19, 0.035, 0.46], [0, 1.68, 0.58], m.trim);
  for (let i = 0; i < 8; i++)
    d.rod([0, 1.65, 0.39 + i * 0.047], [0, 1.62, 0.4 + i * 0.047], 0.004, m.metal);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
