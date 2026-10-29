/** Bell 412EP, low gear and conventional fin, 2006 analog equipment fit.
 * Bell 2012 Product Specifications p8/p10; Cam's N7506M cockpit, 29 Dec 2006.
 * Independent meter landmarks, not the UH-1H shell scaled to another rotor.
 */

import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  fittedFloor,
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
export const bell412Frame = () => ({
  heli: true,
  fighter: false,
  large: false,
  radius: 1.2,
  cy: 1.25,
  ry: 0.95,
  cabinZ: 2.12,
  cabinWidth: 2.25,
  eye: [-0.55, 1.94, 2.12],
  panelZ: 2.91,
  floor: 0.55,
  mainRotorPosition: [0, 3.52, 0],
});
export function buildBell412(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('412-ivory', '#e0dfcf', { side: T.DoubleSide }),
    red = mat('412-red', '#9e3435', { side: T.DoubleSide }),
    seam = mat('412-joints', '#414844'),
    metal = mat('412-metal', '#87928f', { metalness: 0.7 }),
    dark = mat('412-black', '#252c2a'),
    glass = mat('412-glass', '#b0ced1', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.17,
    }),
    green = mat('412-roof-glass', '#65836d', {
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      side: T.DoubleSide,
    });
  const d = detailKit(root, '412-exterior');
  const rivets = (points) => {
    for (let i = 0; i < points.length; i++) {
      const a = new T.Vector3(...points[i]),
        b = new T.Vector3(...points[(i + 1) % points.length]),
        n = Math.floor(a.distanceTo(b) / 0.105);
      for (let k = 1; k < n; k++)
        d.add(
          new T.SphereGeometry(0.0038, 5, 3),
          metal,
          a
            .clone()
            .lerp(b, k / n)
            .toArray(),
        );
    }
  };
  const ring = (w, b, t) => [
    [0, t],
    [w * 0.84, t - 0.02],
    [w, t - 0.15],
    [w, b + 0.24],
    [w * 0.84, b + 0.04],
    [0, b],
    [-w * 0.84, b + 0.04],
    [-w, b + 0.24],
    [-w, t - 0.15],
    [-w * 0.84, t - 0.02],
  ];
  const sections = [
    { z: 1.68, points: ring(1.2, 0.52, 2.26) },
    { z: -1.5, points: ring(1.2, 0.49, 2.25) },
    { z: -2.65, points: ring(0.58, 0.91, 2.2) },
  ];
  loft(d, sections, paint, { caps: false, skip: (i, j) => i === 0 && [2, 7].includes(j) });
  for (const side of [-1, 1]) {
    const x = side * 1.2,
      wall = [
        [x, 0.76, 1.68],
        [x, 2.11, 1.68],
        [x, 2.1, -1.5],
        [x, 0.73, -1.5],
      ];
    const holes = [
      [
        [1.52, 1.94],
        [1.19, 1.93],
        [1.19, 1.34],
        [1.52, 1.34],
      ],
      [
        [0.93, 1.91],
        [0.27, 1.89],
        [0.27, 1.29],
        [0.93, 1.3],
      ],
      [
        [-0.04, 1.88],
        [-0.72, 1.86],
        [-0.72, 1.26],
        [-0.04, 1.28],
      ],
    ].map((a) => a.map(([z, y]) => [x, y, z]));
    sheet(d, wall, paint, [side, 0, 0], holes);
    for (const h of holes) {
      glazing(d, h, glass, seam, 0.014, [side, 0, 0]);
      rivets(h);
    }
    for (const [front, back] of [
      [1.65, 1.04],
      [1.04, -1.12],
    ]) {
      const q = [
        [x + side * 0.006, 0.68, front],
        [x + side * 0.006, 2.13, front],
        [x + side * 0.006, 2.13, back],
        [x + side * 0.006, 0.65, back],
      ];
      outline(d, q, 0.006, seam);
      rivets(q);
    }
    d.rod([x, 2.2, 1.1], [x, 2.2, -1.85], 0.018, metal);
    d.rod([x + side * 0.025, 1.06, 0.98], [x + side * 0.025, 1.06, 0.82], 0.013, dark);
    for (const z of [1.62, 1.07])
      for (const y of [0.83, 1.84]) d.box([0.034, 0.075, 0.035], [x + side * 0.018, y, z], metal);
    d.text('412 EP', [x + side * 0.008, 1.12, -0.52], 0.075, (side * Math.PI) / 2, seam);
    const stripe = [
      [x * 1.003, 0.86, 1.68],
      [x * 1.003, 1.01, 1.68],
      [x * 1.003, 1.01, -1.5],
      [x * 1.003, 0.86, -1.5],
    ];
    sheet(d, stripe, red, [side, 0, 0]);
    const aft = [
      [side * 1.2, 0.86, -1.5],
      [side * 1.2, 1.01, -1.5],
      [side * 0.584, 1.48, -2.65],
      [side * 0.584, 1.33, -2.65],
    ];
    sheet(d, aft, red, [side, 0, 0]);
    for (const z of [-1.75, -2.12])
      outline(
        d,
        [
          [side * (1.2 + (z + 1.5) * 0.539), 0.91, z],
          [side * (1.2 + (z + 1.5) * 0.539), 2.18, z],
        ],
        0.004,
        seam,
        false,
      );
  }
  // Rounded lower nose and actual chin apertures.
  const rows = [
      [0.53, 0.64, 3.47],
      [0.64, 0.92, 3.87],
      [0.86, 1.07, 4.03],
      [1.08, 1.1, 3.96],
      [1.27, 1.04, 3.75],
      [1.43, 0.93, 3.48],
    ],
    angles = [-Math.PI / 2, -1.3, -1.05, -0.78, -0.4, 0, 0.4, 0.78, 1.05, 1.3, Math.PI / 2];
  const np = (r, a) => [
    r[1] * Math.sin(a),
    r[0] - Math.max(0, r[0] - 1.1) * 0.55 * Math.sin(a) * Math.sin(a),
    2.92 + (r[2] - 2.92) * Math.cos(a),
  ];
  for (let r = 0; r < rows.length - 1; r++)
    for (let a = 0; a < angles.length - 1; a++)
      quad(
        d,
        np(rows[r], angles[a]),
        np(rows[r], angles[a + 1]),
        np(rows[r + 1], angles[a + 1]),
        np(rows[r + 1], angles[a]),
        r >= 1 && r <= 2 && [1, 2, 3, 6, 7, 8].includes(a) ? glass : paint,
        [Math.sin(angles[a]), 0, 1],
      );
  sheet(d, [...angles.map((a) => np(rows[0], a)), [0, 0.52, 2.92]], paint, [0, -1, 0]);
  for (const side of [-1, 1]) {
    const h = [
      np(rows[1], side * 0.4),
      np(rows[1], side * 1.3),
      np(rows[2], side * 1.3),
      np(rows[3], side * 1.3),
      np(rows[3], side * 0.4),
    ];
    outline(d, h, 0.02, paint);
    const lo = [],
      hi = [];
    for (let i = 0; i <= 5; i++) {
      const u = i / 5;
      lo.push(np(rows[5], side * Math.asin((0.035 + 0.87 * u) / 0.93)));
      hi.push([side * (0.035 + 0.96 * u), 2.25 - 0.045 * u * u, 2.56 - 0.26 * u * u]);
    }
    for (let i = 0; i < 5; i++)
      quad(d, lo[i], lo[i + 1], hi[i + 1], hi[i], glass, [side * 0.2, 0.4, 1]);
    outline(d, [...lo, ...hi.toReversed()], 0.027, paint);
    const corner = [
      [side * 0.93, 1.26, 2.92],
      [side * 1.18, 1.3, 2.8],
      [side * 1.18, 2.11, 2.25],
      [side * 0.995, 2.205, 2.3],
    ];
    glazing(d, corner, glass, paint, 0.025, [side, 0, 0]);
    const door = [
        [side * 1.2, 0.58, 2.8],
        [side * 1.18, 1.3, 2.8],
        [side * 1.18, 2.11, 2.25],
        [side * 1.2, 2.11, 1.68],
        [side * 1.2, 0.58, 1.68],
      ],
      win = [
        [side * 1.195, 1.2, 2.57],
        [side * 1.192, 1.5, 2.57],
        [side * 1.192, 1.98, 2.23],
        [side * 1.205, 1.98, 1.82],
        [side * 1.205, 1.2, 1.82],
      ];
    sheet(d, door, paint, [side, 0, 0], [win]);
    glazing(d, win, glass, seam, 0.014, [side, 0, 0]);
    outline(d, door, 0.006, seam);
    rivets(door);
    d.rod([side * 1.22, 1.04, 1.94], [side * 1.22, 1.04, 2.09], 0.015, dark);
    sheet(
      d,
      [
        [side * 0.93, 1.26, 2.92],
        [side * 1.18, 1.3, 2.8],
        [side * 1.2, 0.58, 2.8],
        np(rows[0], (side * Math.PI) / 2),
      ],
      paint,
      [side, 0, 0],
    );
    const roof = [
        [side * 0.035, 2.25, 2.56],
        [side * 0.995, 2.205, 2.3],
        [side * 1.18, 2.11, 2.25],
        [side * 1.2, 2.11, 1.68],
        [side * 1.0, 2.24, 1.68],
        [side * 0.035, 2.26, 1.68],
      ],
      sky = [
        [side * 0.16, 2.25, 2.42],
        [side * 0.78, 2.225, 2.24],
        [side * 0.92, 2.24, 1.85],
        [side * 0.16, 2.26, 1.85],
      ];
    sheet(d, roof, paint, [0, 1, 0], [sky]);
    glazing(d, sky, green, paint, 0.02, [0, 1, 0]);
    outline(
      d,
      [
        [side * 0.86, 1.56, 3.08],
        [side * 0.72, 1.76, 2.91],
        [side * 0.33, 1.7, 3.13],
      ],
      0.013,
      dark,
      false,
    );
    d.rod([side * 0.92, 1.39, 3.14], [side * 0.91, 1.39, 3.72], 0.012, metal);
  }
  // Close the nose aft underside without filling the cockpit volume.
  sheet(
    d,
    [
      [-1.2, 0.58, 2.8],
      [1.2, 0.58, 2.8],
      [1.2, 0.52, 1.68],
      [-1.2, 0.52, 1.68],
    ],
    paint,
    [0, -1, 0],
  );
  const engine = (z, w, b, t) => ({
    z,
    points: [
      [0, t],
      [w * 0.75, t - 0.025],
      [w, t - 0.14],
      [w, b],
      [-w, b],
      [-w, t - 0.14],
      [-w * 0.75, t - 0.025],
    ],
  });
  loft(
    d,
    [
      engine(1.85, 0.3, 2.25, 2.44),
      engine(0.72, 0.69, 2.25, 2.74),
      engine(-1.55, 0.73, 2.25, 2.74),
      engine(-2.55, 0.55, 2.2, 2.68),
    ],
    paint,
  );
  loft(
    d,
    [engine(0.8, 0.3, 2.74, 3.09), engine(-0.9, 0.36, 2.74, 3.04), engine(-1.25, 0.28, 2.73, 2.9)],
    paint,
  );
  for (const side of [-1, 1]) {
    const inlet = [
      [side * 0.7, 2.29, -1.6],
      [side * 0.7, 2.63, -1.6],
      [side * 0.55, 2.62, -2.44],
      [side * 0.55, 2.37, -2.44],
    ];
    sheet(d, inlet, dark, [side, 0, 0]);
    outline(d, inlet, 0.025, paint);
    for (let i = 0; i < 6; i++)
      d.rod(
        [side * (0.7 - i * 0.024), 2.32, -1.65 - i * 0.13],
        [side * (0.7 - i * 0.024), 2.59, -1.65 - i * 0.13],
        0.006,
        metal,
      );
    for (const z of [-0.1, -0.65, -1.3]) {
      const q = [
        [side * 0.733, 2.31, z],
        [side * 0.733, 2.61, z],
        [side * 0.733, 2.61, z - 0.35],
        [side * 0.733, 2.31, z - 0.35],
      ];
      outline(d, q, 0.005, seam);
      rivets(q);
    }
    d.rod([side * 0.35, 2.53, -2.45], [side * 0.35, 2.54, -2.81], 0.13, metal);
    d.add(new T.CircleGeometry(0.11, 18).rotateY(Math.PI), dark, [side * 0.35, 2.54, -2.82]);
  }
  const boom = (z, w, y, h) => ({
    z,
    points: Array.from({ length: 12 }, (_, i) => [
      w * Math.sin((i * Math.PI) / 6),
      y + h * Math.cos((i * Math.PI) / 6),
    ]),
  });
  loft(
    d,
    [
      boom(-2.65, 0.58, 1.36, 0.45),
      boom(-4.5, 0.34, 1.56, 0.31),
      boom(-6.9, 0.16, 1.75, 0.18),
      boom(-8.6, 0.1, 1.86, 0.105),
      boom(-8.88, 0.06, 1.86, 0.07),
    ],
    paint,
  );
  for (const z of [-2.8, -3.7, -4.7, -5.7, -6.7, -7.6]) {
    const u = (-z - 2.65) / 6,
      q = boom(z, 0.58 * (1 - u) + 0.1 * u, 1.36 + 0.5 * u, 0.45 * (1 - u) + 0.105 * u);
    outline(
      d,
      q.points.map((a) => [...a, z]),
      0.004,
      seam,
    );
  }
  const fin = [
    [-0.07, 1.89, -7.45],
    [-0.07, 3.25, -8.77],
    [-0.07, 3.27, -9.04],
    [-0.07, 1.73, -8.61],
    [-0.07, 1.6, -8.4],
  ];
  sheet(d, fin, red, [-1, 0, 0]);
  sheet(
    d,
    fin.map((a) => [-a[0], a[1], a[2]]),
    red,
    [1, 0, 0],
  );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(d, a, b, [-b[0], b[1], b[2]], [-a[0], a[1], a[2]], red, [0, 1, 0]);
  }
  d.rod([0, 1.68, -8.4], [0, 1.48, -8.88], 0.024, metal);
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.18, 1.66, -5.49, -6.23],
        [side * 1.43, 1.66, -5.54, -6.28],
      ],
      paint,
      0.05,
    );
    d.box([0.045, 0.04, 0.065], [side * 1.43, 1.67, -5.55], side < 0 ? d.green : d.red);
    outline(
      d,
      [
        [side * 1.39, 0.18, 2.65],
        [side * 1.39, 0.06, 2.34],
        [side * 1.39, 0.055, -0.86],
        [side * 1.39, 0.15, -1.04],
      ],
      0.055,
      metal,
      false,
    );
    for (const z of [1.8, -0.9])
      outline(
        d,
        [
          [0, 0.51, z],
          [side * 0.96, 0.46, z],
          [side * 1.25, 0.25, z],
          [side * 1.39, 0.06, z],
        ],
        0.044,
        metal,
        false,
      );
    d.box([0.27, 0.045, 0.56], [side * 1.38, 0.32, 1.5], dark);
    d.box([0.22, 0.035, 0.65], [side * 1.35, 0.22, 0.02], dark);
  }
  const mast = group(root, '412-mast', [0, 3.52, 0]),
    md = detailKit(mast, 'mast');
  md.rod([0, -0.45, 0], [0, 0.02, 0], 0.065, metal);
  md.ring(0.25, 0.035, [0, -0.24, 0], metal, 'y');
  md.finish();
  const rotor = group(mast, 'main-rotor'),
    rd = detailKit(rotor, '412-head');
  rd.box([0.35, 0.14, 0.35], [0, 0, 0], metal);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2,
      c = Math.cos(a),
      sn = Math.sin(a);
    rd.rod([0, 0, 0], [c * 0.65, 0, sn * 0.65], 0.052, metal);
    rd.rod([c * 0.18, -0.25, sn * 0.18], [c * 0.5, 0.02, sn * 0.5], 0.018, metal);
    const blade = group(rotor, `412-blade-${i}`),
      bd = detailKit(blade, 'blade');
    blade.rotation.y = -a;
    wing(
      bd,
      [
        [0.65, 0, 0.2, -0.25],
        [1.1, 0.015, 0.2, -0.25],
        [7.01, 0.12, 0.17, -0.23],
      ],
      dark,
      0.035,
    );
    bd.box([0.2, 0.012, 0.4], [6.88, 0.12, -0.03], paint);
    bd.finish();
  }
  rd.finish();
  const tr = group(root, 'tail-rotor', [0.2, 3.235, -8.88]),
    td = detailKit(tr, '412-tail-rotor');
  td.rod([-0.18, 0, 0], [0.1, 0, 0], 0.06, metal);
  for (const side of [-1, 1]) {
    td.box([0.035, 1.17, 0.23], [0.025, side * 0.72, 0], dark);
    td.box([0.037, 0.16, 0.23], [0.025, side * 1.22, 0], paint);
  }
  td.finish();
  d.finish();
  const interior = cockpit412(root, { paint, red, seam, metal, dark }, [
    { z: 2.8, points: ring(1.2, 0.58, 2.11) },
    ...sections,
  ]);
  cleanGeometry(root);
  return {
    root,
    frame: bell412Frame(),
    enginePoints: [],
    visual: {
      rotors: [
        { node: 'main-rotor', axis: 'y', multiplier: 1 },
        { node: 'tail-rotor', axis: 'x', multiplier: 4.5 },
      ],
      gearNodes: [],
      flaps: [],
      ailerons: [],
      animation: { bindings: [] },
      interior,
    },
  };
}

function cockpit412(root, m, sections) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, '412-cockpit'),
    tools = panelTools(d),
    panel = mat('412-panel-gray', '#b3b8b5'),
    cloth = mat('412-gray-fabric', '#69716d', { roughness: 0.95 }),
    floor = mat('412-floor', '#514d43'),
    bindings = [],
    z = 2.91;
  fittedFloor(d, sections, floor, { y: 0.64, front: 2.65, back: -1.95, width: 2.24 });
  d.box([1.0, 1.3, 0.65], [0, 1.22, -1.92], m.paint);
  const xy = (u, v) => [(900 - u) / 900, 1.73 - v / 900];
  const outlinePixels = [
      [0, 150],
      [240, 65],
      [570, 5],
      [920, 5],
      [1320, 48],
      [1640, 125],
      [1800, 200],
      [1800, 570],
      [0, 540],
    ],
    face = outlinePixels.map(([u, v]) => [...xy(u, v), z]);
  const gaugeOpenings = [];
  sheet(
    d,
    face.map(([x, y]) => [x, y, z + 0.28]),
    m.dark,
    [0, 0, 1],
  );
  for (let i = 0; i < face.length; i++) {
    const a = face[i],
      b = face[(i + 1) % face.length];
    quad(d, a, b, [b[0], b[1], z + 0.28], [a[0], a[1], z + 0.28], m.dark, [0, 1, 0]);
  }
  outline(d, face.slice(0, 7), 0.028, m.dark, false);
  const gauge = (u, v, r, label, source, att = false) => {
    const [x, y] = xy(u, v),
      radius = r / 900;
    gaugeOpenings.push(
      Array.from({ length: 32 }, (_, i) => [
        x + Math.cos((i * Math.PI) / 16) * radius,
        y + Math.sin((i * Math.PI) / 16) * radius,
        z,
      ]),
    );
    tools.gauge(x, y, z - 0.001, radius, undefined, false);
    d.text(label, [x, y - radius * 0.35, z - 0.005], radius * 0.17, Math.PI, d.ivory);
    if (att) {
      const h = group(cabin, `412-horizon-${u}`, [x, y, z - 0.006]),
        hd = detailKit(h, 'attitude');
      const sky = mat('412-attitude-sky', '#628da3'),
        earth = mat('412-attitude-earth', '#81714e');
      hd.add(new T.CircleGeometry(radius * 0.8, 24, 0, Math.PI).rotateY(Math.PI), sky);
      hd.add(new T.CircleGeometry(radius * 0.8, 24, Math.PI, Math.PI).rotateY(Math.PI), earth);
      for (let i = -2; i <= 2; i++)
        hd.rod([-0.035, i * 0.014, -0.003], [0.035, i * 0.014, -0.003], 0.0015, hd.ivory);
      hd.finish();
      bindings.push({ node: h.name, source: 'roll', property: 'rotation', axis: 'z', scale: 1 });
      d.rod([x - radius * 0.7, y, z - 0.012], [x + radius * 0.7, y, z - 0.012], 0.0025, d.amber);
    } else {
      const n = group(cabin, `412-needle-${u}-${v}`, [x, y, z - 0.008]),
        nd = detailKit(n, 'needle');
      nd.rod([0, -radius * 0.2, 0], [0, radius * 0.77, 0], 0.002, nd.ivory);
      nd.finish();
      if (source)
        bindings.push({
          node: n.name,
          source,
          property: 'rotation',
          axis: 'z',
          scale:
            source === 'airspeed'
              ? 0.035
              : source === 'altitude'
                ? 0.0206
                : source === 'heading'
                  ? -1
                  : 2.9,
          offset: source === 'heading' ? 0 : -1.65,
        });
    }
  };
  // Read directly from the rectified N7506M panel, retaining its asymmetric equipment fit.
  for (const [u, v, r, label, source, att] of [
    [163, 184, 47, 'KTS', 'airspeed'],
    [265, 175, 62, 'ATT', null, true],
    [397, 153, 47, 'ALT', 'altitude'],
    [489, 153, 45, 'RPM', 'rotorSpeed'],
    [402, 275, 46, 'VSI'],
    [494, 276, 42, 'TQ', 'power'],
    [265, 352, 64, 'HSI', 'heading'],
    [167, 354, 44, 'NAV'],
    [718, 160, 34, 'HYD'],
    [792, 157, 34, 'HYD'],
    [796, 246, 37, 'FUEL'],
    [653, 326, 32, 'VOLT'],
    [722, 327, 34, 'AMP'],
    [795, 327, 34, 'FUEL'],
    [1048, 125, 52, 'RPM', 'rotorSpeed'],
    [1047, 320, 47, 'NAV'],
    [1184, 130, 52, 'KTS', 'airspeed'],
    [1341, 180, 68, 'ATT', null, true],
    [1485, 181, 52, 'ALT', 'altitude'],
    [1184, 298, 49, 'TQ', 'power'],
    [1341, 381, 70, 'HSI', 'heading'],
    [1483, 308, 49, 'VSI'],
    [1185, 480, 51, 'TURN'],
    [1490, 497, 52, 'RAD ALT', 'altitude'],
  ])
    gauge(u, v, r, label, source, att);
  for (const u of [873, 948])
    for (const [v, label] of [
      [153, 'N1'],
      [239, 'ITT'],
      [325, 'OIL'],
      [410, 'PRESS'],
      [493, 'TEMP'],
    ])
      gauge(u, v, 34, label, 'power');
  sheet(d, face, panel, [0, 0, -1], gaugeOpenings);
  const box = (u, v, w, h, material = m.dark) => {
    const [x, y] = xy(u, v);
    return d.box([w / 900, h / 900, 0.013], [x, y, z - 0.021], material);
  };
  box(680, 454, 215, 155);
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 5; col++) {
      const [x, y] = xy(594 + col * 42, 393 + row * 20);
      d.box([0.039, 0.016, 0.006], [x, y, z - 0.032], row === 0 ? d.amber : m.seam);
    }
  box(440, 445, 190, 160);
  box(440, 435, 159, 115, mat('412-radar', '#1c383b'));
  const [rx, ry] = xy(440, 435);
  for (const r of [0.025, 0.05, 0.075]) d.ring(r, 0.0013, [rx, ry, z - 0.034], d.green);
  for (const [u, v, w, h] of [
    [165, 444, 86, 60],
    [1053, 218, 110, 52],
    [1050, 493, 100, 95],
    [1185, 383, 95, 35],
    [1340, 531, 170, 66],
    [1655, 397, 99, 111],
    [1645, 513, 99, 100],
  ])
    box(u, v, w, h);
  for (const u of [1648, 1655]) {
    const [x, y] = xy(u, u === 1648 ? 510 : 397);
    tools.knob(x, y, z - 0.05, 0.036);
  }
  for (const [u, v] of [
    [1340, 531],
    [165, 445],
    [1050, 494],
  ]) {
    const [x, y] = xy(u, v);
    tools.buttons(x, y, z - 0.04, 4, 0.03);
  }
  for (const u of [625, 859]) {
    box(u, 71, 160, 22, m.red);
    const [x, y] = xy(u, 71);
    d.text('FIRE', [x, y, z - 0.04], 0.017, Math.PI, d.ivory);
  }
  // Switch placards are geometry labels, not copied photographic textures.
  for (const [u, v, label] of [
    [600, 289, 'HYDRAULIC'],
    [1038, 261, 'ROTOR RPM'],
    [1350, 580, 'BELL 412EP'],
    [626, 120, 'MASTER CAUTION'],
  ]) {
    const [x, y] = xy(u, v);
    d.text(label, [x, y, z - 0.032], 0.01, Math.PI, m.seam);
  }
  const console = group(cabin, '412-console', [0, 0.82, 1.9]);
  console.rotation.x = Math.PI / 2 - 0.18;
  const pd = detailKit(console, 'pedestal'),
    pt = panelTools(pd);
  pd.box([0.57, 1.85, 0.12], [0, 0, 0.05], m.dark);
  for (const [y, h] of [
    [0.65, 0.42],
    [0.16, 0.45],
    [-0.37, 0.49],
    [-0.78, 0.23],
  ]) {
    pd.box([0.52, h, 0.012], [0, y, -0.018], m.seam);
    for (const side of [-1, 1])
      for (const yy of [-h * 0.42, h * 0.42])
        pd.add(new T.SphereGeometry(0.005, 5, 3), m.metal, [side * 0.245, y + yy, -0.028]);
  }
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++) {
      const x = (col - 2.5) * 0.072,
        y = 0.79 - row * 0.085;
      pd.rod([x, y, -0.028], [x, y + 0.02, -0.056], 0.005, m.metal);
      pd.text(row === 0 ? 'ON' : '', [x, y - 0.025, -0.03], 0.007, Math.PI, pd.ivory);
    }
  for (const y of [0.3, 0.12, -0.11, -0.34]) {
    pt.buttons(0, y, -0.04, 6, 0.065);
    for (const x of [-0.21, 0.21]) pt.knob(x, y + 0.04, -0.047, 0.018);
    pd.box([0.22, 0.028, 0.008], [0, y + 0.048, -0.03], pd.dark);
    pd.text(y > 0.2 ? '118.00' : 'NAV', [0, y + 0.048, -0.037], 0.012, Math.PI, pd.amber);
  }
  for (const side of [-1, 1]) {
    pd.box([0.045, 0.11, 0.028], [side * 0.14, 0.6, -0.05], m.red);
    pd.rod([side * 0.14, 0.6, -0.07], [side * 0.14, 0.65, -0.09], 0.012, m.red);
  }
  for (let i = 0; i < 10; i++)
    pd.box([0.033, 0.022, 0.008], [(i - 4.5) * 0.046, -0.78, -0.035], pd.ivory);
  pd.finish();
  const overhead = group(cabin, '412-overhead', [0, 2.17, 1.83]);
  overhead.rotation.x = -Math.PI / 2;
  const od = detailKit(overhead, 'overhead');
  od.box([0.56, 0.85, 0.045], [0, 0, 0], m.dark);
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 6; col++) {
      const x = (col - 2.5) * 0.075,
        y = (row - 3) * 0.1;
      od.rod([x, y, -0.03], [x, y + 0.015, -0.065], 0.005, m.metal);
      if (row % 2 === 0) od.text('ON', [x, y - 0.026, -0.032], 0.008, Math.PI, od.ivory);
    }
  od.finish();
  const seat = (x, z, yaw = 0, crew = false) => {
    const g = group(cabin, `412-seat-${x}-${z}`, [x, 0.89, z]);
    g.rotation.y = yaw;
    const sd = detailKit(g, 'seat'),
      w = crew ? 0.48 : 0.42;
    beveledBox(sd, [w, 0.11, 0.46], [0, 0, 0], cloth);
    const b = beveledBox(sd, [w, 0.63, 0.1], [0, 0.31, -0.24], cloth);
    b.rotation.x = -0.1;
    for (const side of [-1, 1]) {
      sd.rod([side * w * 0.39, -0.31, -0.18], [side * w * 0.39, 0, -0.18], 0.018, m.metal);
      sd.rod([side * w * 0.39, -0.31, 0.18], [side * w * 0.39, 0, 0.18], 0.018, m.metal);
      sheet(
        sd,
        [
          [side * 0.16, 0.6, -0.18],
          [side * 0.12, 0.6, -0.18],
          [side * 0.01, 0.09, 0.14],
          [side * 0.05, 0.09, 0.14],
        ],
        m.dark,
        [0, 0, 1],
      );
    }
    sd.box([0.06, 0.04, 0.02], [0, 0.08, 0.15], m.metal);
    sd.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * 0.55;
    seat(x, 2.05, 0, true);
    const stick = group(cabin, `412-cyclic-${side}`, [x, 0.55, 2.38]),
      sd = detailKit(stick, 'cyclic');
    outline(
      sd,
      [
        [0, 0, 0],
        [0, 0.4, 0],
        [0, 0.6, -0.12],
        [0, 0.74, -0.12],
      ],
      0.021,
      m.dark,
      false,
    );
    beveledBox(sd, [0.07, 0.15, 0.07], [0, 0.79, -0.12], m.dark, 0.01);
    sd.box([0.018, 0.018, 0.01], [0, 0.87, -0.16], sd.red);
    sd.finish();
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.16 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.16 },
    );
    const collective = group(cabin, `412-collective-${side}`, [x + 0.26, 0.69, 1.86]),
      cd = detailKit(collective, 'collective');
    cd.rod([0, 0, 0], [0, 0.15, 0.46], 0.025, m.dark);
    cd.box([0.085, 0.065, 0.18], [0, 0.15, 0.46], m.dark);
    for (const xx of [-0.025, 0.025]) cd.box([0.022, 0.013, 0.025], [xx, 0.19, 0.5], cd.red);
    cd.finish();
    bindings.push({
      node: collective.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: -0.4,
    });
    for (const k of [-1, 1]) {
      const pedal = group(cabin, `412-pedal-${side}-${k}`, [x + k * 0.13, 0.65, 3.1]),
        p = detailKit(pedal, 'pedal');
      p.box([0.18, 0.08, 0.04], [0, 0, 0], m.dark);
      p.rod([0, -0.1, 0.1], [0, 0, 0], 0.012, m.metal);
      p.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -k * 0.045,
      });
    }
  }
  for (const x of [-0.85, -0.42, 0.42, 0.85]) seat(x, 0.95);
  for (const x of [-0.87, -0.435, 0, 0.435, 0.87]) seat(x, -0.05);
  for (const side of [-1, 1])
    for (const z of [-1.0, -1.48]) seat(side * 0.75, z, (side * Math.PI) / 2);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
