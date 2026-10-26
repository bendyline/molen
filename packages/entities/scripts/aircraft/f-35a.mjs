/** F-35A clean CTOL airframe. JPO three-view and cockpit references, reviewed separately.
 * +Z forward, +X pilot left. Public display mock-up guides the panel, not production software.
 */
import { instrumentGeometry } from './instrument-geometry.mjs';
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

export const f35Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.62,
  cy: 1.94,
  ry: 0.66,
  cabinZ: 5.7,
  cabinWidth: 0.88,
  eye: [0, 2.94, 5.7],
  panelZ: 6.55,
  floor: 1.72,
});
export function buildF35A(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('F35-gray', '#777f86', { side: T.DoubleSide }),
    edge = mat('F35-edge', '#9ba0a3', { side: T.DoubleSide }),
    dark = mat('F35-seal', '#282e32'),
    metal = mat('F35-alloy', '#9ca4a6', { metalness: 0.7 }),
    nozzle = mat('F35-nozzle', '#79786d', { side: T.DoubleSide, metalness: 0.7 }),
    lining = mat('F35-duct', '#171e23', { side: T.DoubleSide }),
    glass = mat('F35-canopy', '#b6af86', {
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    }),
    sensor = mat('F35-sensor', '#34515b', { metalness: 0.55, roughness: 0.15 });
  const d = detailKit(root, 'F35-airframe'),
    bindings = [];
  const mountHinge = (node, axis, direction) => {
    const mount = group(node.parent, `${node.name}-mount`, node.position.toArray());
    mount.quaternion.setFromUnitVectors(
      new T.Vector3(...axis),
      new T.Vector3(...direction).normalize(),
    );
    const inverse = mount.quaternion.clone().invert();
    node.traverse((n) => {
      if (n.isMesh) n.geometry.applyQuaternion(inverse);
    });
    mount.add(node);
    node.position.set(0, 0, 0);
  };
  // Narrow chine nose, hollow cockpit aperture, shoulders rising into the single spine.
  const fore = [
    [9.1, 0.008, 1.73, 1.75, 1.74],
    [8.55, 0.26, 1.45, 1.98, 1.73],
    [7.85, 0.46, 1.25, 2.18, 1.74],
    [7.25, 0.56, 1.17, 2.34, 1.78],
    [6.7, 0.61, 1.14, 2.4, 1.8],
    [5.95, 0.64, 1.12, 2.47, 1.85],
    [5.2, 0.66, 1.1, 2.64, 1.9],
    [4.45, 0.69, 1.07, 2.78, 1.92],
    [3.8, 0.8, 1.02, 2.77, 1.93],
  ].map(([z, w, b, t, c]) => ({
    z,
    points: [
      [0, t],
      [w * 0.68, t - 0.06],
      [w * 0.96, c + 0.15],
      [w, c],
      [w * 0.73, b + 0.06],
      [0, b],
      [-w * 0.73, b + 0.06],
      [-w, c],
      [-w * 0.96, c + 0.15],
      [-w * 0.68, t - 0.06],
    ],
  }));
  loft(d, fore, paint, { skip: (i, j) => i >= 3 && i < 7 && (j === 0 || j === 9) });
  const canopy = [
    [7.3, 0.025, 2.33, 2.35],
    [6.9, 0.28, 2.37, 2.73],
    [6.45, 0.43, 2.42, 3.0],
    [5.9, 0.52, 2.48, 3.11],
    [5.35, 0.51, 2.6, 3.09],
    [4.8, 0.39, 2.72, 3.02],
    [4.35, 0.025, 2.78, 2.8],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 21 }, (_, j) => [
      Math.cos((j * Math.PI) / 20) * w,
      b + Math.sin((j * Math.PI) / 20) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 20 });
  // Internal windshield bow is visible in the USAF photograph. The outer acrylic stays continuous.
  outline(
    d,
    cr[2].points.map(([x, y]) => [x * 0.98, y - 0.012, cr[2].z]),
    0.013,
    dark,
    false,
  );
  for (const j of [0, 20])
    outline(
      d,
      cr.map((r) => [...r.points[j], r.z]),
      0.022,
      edge,
      false,
    );
  for (const i of [0, 6])
    outline(
      d,
      cr[i].points.map((p) => [...p, cr[i].z]),
      0.018,
      edge,
      false,
    );
  for (const side of [-1, 1]) {
    const rail = [
      [0.025, 2.34],
      [0.36, 2.4],
      [0.52, 2.48],
      [0.49, 2.64],
      [0.09, 2.78],
    ];
    for (let i = 3; i < 7; i++) {
      const a = fore[i],
        b = fore[i + 1],
        q = side === 1 ? 1 : 9;
      quad(
        d,
        [...a.points[q], a.z],
        [...b.points[q], b.z],
        [side * rail[i - 2][0], rail[i - 2][1], b.z],
        [side * rail[i - 3][0], rail[i - 3][1], a.z],
        paint,
        [side, 1, 0],
      );
    }
    for (let i = 0; i < canopy.length - 1; i++)
      for (let j = 0; j < 5; j++) {
        const a = canopy[i],
          b = canopy[i + 1],
          t = j / 5;
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t),
          a[2] + (b[2] - a[2]) * t + 0.017,
          a[0] + (b[0] - a[0]) * t,
        ]);
      }
  }
  const body = [
    [3.7, 1.65, 0.95, 2.87],
    [1.3, 1.85, 0.89, 2.83],
    [-0.7, 1.87, 0.84, 2.78],
    [-2.6, 1.67, 0.78, 2.72],
    [-3.7, 1.28, 1.0, 2.6],
    [-4.35, 0.71, 1.15, 2.45],
  ].map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [0.43, t - 0.04],
      [w * 0.63, t - 0.2],
      [w, 2.0],
      [w * 0.82, 1.28],
      [w * 0.61, b + 0.06],
      [0, b],
      [-w * 0.61, b + 0.06],
      [-w * 0.82, 1.28],
      [-w, 2.0],
      [-w * 0.63, t - 0.2],
      [-0.43, t - 0.04],
    ],
  }));
  loft(d, body, paint, { caps: false });
  sheet(
    d,
    body.at(-1).points.map((p) => [...p, -4.35]),
    lining,
    [0, 0, -1],
  );
  for (const side of [-1, 1]) {
    // Open raked inlet with an inner diverterless compression bump, no splitter plate.
    quad(
      d,
      [0, 2.78, 4.45],
      [side * 0.69, 2.78, 4.45],
      [side * 0.43, 2.83, 3.7],
      [0, 2.87, 3.7],
      paint,
      [0, 1, 0],
    );
    const mouth = [
      [side * 0.69, 2.27, 4.95],
      [side * 1.46, 2.2, 4.62],
      [side * 1.56, 1.27, 4.35],
      [side * 0.77, 1.15, 4.7],
    ];
    const rear = mouth.map(([x, y, z]) => [x * 0.78, 1.7 + (y - 1.7) * 0.8, z - 1.1]);
    for (let j = 0; j < 4; j++)
      quad(d, mouth[j], rear[j], rear[(j + 1) % 4], mouth[(j + 1) % 4], lining, [0, 0, 1]);
    sheet(d, rear, lining, [0, 0, 1]);
    outline(d, mouth, 0.022, edge);
    const bump = [
      {
        z: 6.05,
        points: [
          [side * 0.59, 2.36],
          [side * 0.62, 1.85],
          [side * 0.62, 1.26],
        ],
      },
      {
        z: 5.38,
        points: [
          [side * 0.68, 2.35],
          [side * 0.94, 1.83],
          [side * 0.73, 1.2],
        ],
      },
      {
        z: 4.7,
        points: [
          [side * 0.74, 2.27],
          [side * 0.96, 1.77],
          [side * 0.79, 1.15],
        ],
      },
      {
        z: 4.1,
        points: [
          [side * 0.72, 2.2],
          [side * 0.82, 1.76],
          [side * 0.77, 1.18],
        ],
      },
    ];
    loft(d, bump, paint, { caps: false });
    quad(
      d,
      [side * 0.61, 2.4, 6.7],
      [side * 0.69, 2.78, 4.45],
      [side * 1.46, 2.2, 4.62],
      [side * 0.69, 2.27, 4.95],
      paint,
      [0, 1, 0],
    );
    quad(
      d,
      [side * 1.46, 2.2, 4.62],
      [side * 1.65, 2, 3.7],
      [side * 1.353, 1.28, 3.7],
      [side * 1.56, 1.27, 4.35],
      paint,
      [side, 0, 0],
    );
    // A-model root extension runs into the shoulder; no B-model lift-fan doors.
    sheet(
      d,
      [
        [side * 0.69, 2.78, 4.45],
        [side * 0.43, 2.83, 3.7],
        [side * 1.0395, 2.67, 3.7],
        [side * 1.65, 2.0, 3.7],
        [side * 1.46, 2.2, 4.62],
        [side * 0.69, 2.27, 4.95],
      ],
      paint,
      [0, 1, 0],
    );
    sheet(
      d,
      [
        [side * 1.56, 1.27, 4.35],
        [side * 1.353, 1.28, 3.7],
        [side * 1.0065, 1.01, 3.7],
        [side * 0.77, 1.15, 4.7],
      ],
      paint,
      [0, -1, 0],
    );
    wing(
      d,
      [
        [side * 1.36, 2.0, 4.2, -3.2, 0.1],
        [side * 1.65, 2.0, 4.05, -3.37, 0.075],
        [side * 2.22, 2.0, 1.05, -3.25, 0.06],
      ],
      paint,
    );
    const st = [
      [2.22, 2, 1.05, -3.25, 0.06],
      [5.334, 2.0, -0.93, -2.47, 0.018],
    ];
    const main = st.map(([x, y, a, b, h]) => [
      side * x,
      y,
      a - (a - b) * 0.12,
      b + (a - b) * 0.23,
      h,
    ]);
    wing(d, main, paint);
    const leadZ = st[0][2] - (st[0][2] - st[0][3]) * 0.12,
      pivot = [side * 2.22, 2, leadZ],
      lg = group(root, `F35-leading-${side}`, pivot),
      ld = detailKit(lg, lg.name);
    wing(
      ld,
      st.map(([x, y, a, b, h]) => [
        side * x - pivot[0],
        y - 2,
        a - leadZ,
        a - (a - b) * 0.12 - leadZ,
        h * 0.3,
      ]),
      edge,
    );
    ld.finish();
    mountHinge(
      lg,
      [1, 0, 0],
      [5.334 - 2.22, 0, side * (st[1][2] - (st[1][2] - st[1][3]) * 0.12 - leadZ)],
    );
    bindings.push({
      node: lg.name,
      source: 'flapPosition',
      property: 'rotation',
      axis: 'x',
      scale: 0.16,
    });
    // One trailing flaperon per wing. Hinge direction is retained under either input.
    const tz = st[0][3] + (st[0][2] - st[0][3]) * 0.23,
      tg = group(root, `F35-flaperon-${side}`, [side * 2.22, 2, tz]),
      td = detailKit(tg, tg.name);
    wing(
      td,
      st.map(([x, y, a, b, h]) => [
        side * (x - 2.22),
        y - 2,
        b + (a - b) * 0.23 - tz,
        b - tz,
        h * 0.3,
      ]),
      edge,
    );
    td.finish();
    mountHinge(
      tg,
      [1, 0, 0],
      [5.334 - 2.22, 0, side * (st[1][3] + (st[1][2] - st[1][3]) * 0.23 - tz)],
    );
    bindings.push({
      node: tg.name,
      source: side === 1 ? 'flaperonLeft' : 'flaperonRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const tp = [side * 0.9, 1.94, -4.8],
      tail = group(root, `F35-stabilator-${side}`, tp),
      ad = detailKit(tail, tail.name);
    const ts = [
      [0.9, 1.94, -3.65, -6.567, 0.05],
      [1.65, 1.94, -4.0, -6.36, 0.038],
      [3.429, 1.94, -5.04, -5.93, 0.014],
    ];
    wing(
      ad,
      ts.map(([x, y, a, b, h]) => [side * x - tp[0], y - tp[1], a - tp[2], b - tp[2], h]),
      paint,
    );
    outline(
      ad,
      ts.map(([x, y, a]) => [side * x - tp[0], y - tp[1] + 0.016, a - tp[2]]),
      0.006,
      edge,
      false,
    );
    ad.finish();
    bindings.push({
      node: tail.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const height = (4.38 - 2.18) / Math.cos((19 * Math.PI) / 180),
      fg = group(root, `F35-fin-${side}`, [side * 1.42, 2.18, -2.45]);
    fg.rotation.z = (-side * 19 * Math.PI) / 180;
    const fd = detailKit(fg, fg.name);
    for (const x of [-0.028, 0.028])
      sheet(
        fd,
        [
          [x, 0, 0],
          [x, height, -1.93],
          [x, height, -2.92],
          [x, 0.12, -1.84],
        ],
        paint,
        [Math.sign(x), 0, 0],
      );
    outline(
      fd,
      [
        [0, 0, 0],
        [0, height, -1.93],
        [0, height, -2.92],
      ],
      0.015,
      edge,
      false,
    );
    const rg = group(fg, `F35-rudder-${side}`, [0, 0.12, -1.84]),
      rd = detailKit(rg, rg.name);
    sheet(
      rd,
      [
        [0, 0, 0],
        [0, height - 0.12, -1.08],
        [0, height - 0.12, -1.52],
        [0, 0, -0.5],
      ],
      edge,
      [side, 0, 0],
    );
    rd.finish();
    mountHinge(rg, [0, 1, 0], [0, height - 0.12, -1.08]);
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.35,
    });
    // Exterior operator identifiers are supplied by the selected livery.
    fd.finish();
    d.box(
      [0.045, 0.025, 0.17],
      [side * 5.31, 2.016, -1.22],
      side === 1
        ? mat('F35-red', '#e34439', { emissive: '#b32118', emissiveIntensity: 0.4 })
        : mat('F35-green', '#53bc85', { emissive: '#158d4d', emissiveIntensity: 0.4 }),
    );
  }
  // Single circular F135 exhaust with faceted petal seams and dark duct; no vectoring.
  const nr = [
    [-4.32, 0.68],
    [-4.65, 0.665],
    [-5.02, 0.51],
  ].map(([z, r]) => ({
    z,
    points: Array.from({ length: 32 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * r,
      1.8 + Math.sin((j * Math.PI) / 16) * r,
    ]),
  }));
  loft(d, nr, nozzle, { caps: false });
  loft(
    d,
    nr.map((r) => ({
      z: r.z,
      points: r.points.map(([x, y]) => [x * 0.94, 1.8 + (y - 1.8) * 0.94]),
    })),
    lining,
    { caps: false },
  );
  sheet(
    d,
    nr[0].points.map((p) => [...p, -4.31]),
    lining,
    [0, 0, -1],
  );
  for (let j = 0; j < 16; j++) {
    const a = (j * Math.PI) / 8;
    outline(
      d,
      [
        [Math.cos(a) * 0.683, 1.8 + Math.sin(a) * 0.683, -4.32],
        [Math.cos(a) * 0.668, 1.8 + Math.sin(a) * 0.668, -4.65],
        [Math.cos(a) * 0.513, 1.8 + Math.sin(a) * 0.513, -5.02],
      ],
      0.007,
      dark,
      false,
    );
  }
  // Faceted EOTS enclosure under the forward nose: optical housing only.
  loft(
    d,
    [
      {
        z: 7.65,
        points: [
          [-0.12, 1.26],
          [0.12, 1.26],
          [0.09, 1.08],
          [-0.09, 1.08],
        ],
      },
      {
        z: 7.16,
        points: [
          [-0.22, 1.18],
          [0.22, 1.18],
          [0.16, 0.99],
          [-0.16, 0.99],
        ],
      },
      {
        z: 6.95,
        points: [
          [-0.17, 1.16],
          [0.17, 1.16],
          [0.12, 1.06],
          [-0.12, 1.06],
        ],
      },
    ],
    sensor,
  );
  for (const [name, x, z, r, w, top] of [
    ['left', 1.28, -0.6, 0.37, 0.25, 1.18],
    ['right', -1.28, -0.6, 0.37, 0.25, 1.18],
    ['nose', 0, 5.65, 0.27, 0.18, 1.2],
  ]) {
    const g = group(root, `F35-gear-${name}`, [x, top, z]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, r - top, 0], name === 'nose' ? 0.045 : 0.065, metal);
    gd.rod([0, -0.1, -0.45], [0, r - top + 0.1, 0], 0.032, metal);
    gd.add(new T.CylinderGeometry(r, r, w, 28).rotateZ(Math.PI / 2), dark, [0, r - top, 0]);
    gd.add(new T.CylinderGeometry(r * 0.58, r * 0.58, w + 0.012, 24).rotateZ(Math.PI / 2), metal, [
      0,
      r - top,
      0,
    ]);
    gd.box(
      [0.025, 0.54, name === 'nose' ? 0.7 : 0.8],
      [name === 'right' ? -0.2 : 0.2, -0.18, -0.18],
      paint,
    );
    gd.finish();
    bindings.push(
      {
        node: g.name,
        source: 'gear',
        property: 'rotation',
        axis: 'x',
        scale: Math.PI / 2,
        offset: -Math.PI / 2,
      },
      { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -0.6, offset: 0.6 },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1 },
    );
  }
  // Selected flush RAM panel edges sit on the actual loft; avoid invented all-over rivet grids.
  const topPoint = (x, z) => {
    let i = body.findIndex((r, j) => j < body.length - 1 && z <= r.z && z >= body[j + 1].z);
    i = Math.max(0, i);
    const a = body[i],
      b = body[i + 1],
      t = Math.max(0, Math.min(1, (a.z - z) / (a.z - b.z)));
    const y = (r) => {
      const pts = r.points.slice(0, 4);
      let k = pts.findIndex((p, j) => j < 3 && Math.abs(x) >= p[0] && Math.abs(x) <= pts[j + 1][0]);
      k = k < 0 ? 2 : k;
      return (
        pts[k][1] +
        ((pts[k + 1][1] - pts[k][1]) * (Math.abs(x) - pts[k][0])) / (pts[k + 1][0] - pts[k][0])
      );
    };
    return [x, y(a) + (y(b) - y(a)) * t + 0.008, z];
  };
  for (const side of [-1, 1]) {
    outline(
      d,
      [
        [side * 0.22, 3.42],
        [side * 0.22, 2.85],
        [side * 0.08, 2.7],
        [side * 0.08, 1.9],
        [side * 0.2, 1.76],
        [side * 0.2, 1.08],
      ].map(([x, z]) => topPoint(x, z)),
      0.004,
      edge,
      false,
    );
    for (const z of [2.2, 0.7, -0.8])
      outline(
        d,
        [
          [-0.2, 0.22],
          [0, 0.32],
          [0.2, 0.22],
          [0.2, -0.22],
          [0, -0.32],
          [-0.2, -0.22],
        ].map(([x, dz]) => topPoint(side * (1.13 + x), z + dz)),
        0.0035,
        edge,
      );
    d.text('RESCUE', [side * 0.603, 2.13, 6.68], 0.065, (side * Math.PI) / 2, edge);
    outline(
      d,
      [
        [side * 0.62, 2.24, 5.9],
        [side * 0.64, 2.36, 5.75],
        [side * 0.64, 2.24, 5.6],
      ],
      0.005,
      edge,
    );
  }
  d.finish();
  const interior = f35Cockpit(root, { metal });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.32] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.13] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
    flapDeflection: { op: 'multiply', args: ['flapPosition', -0.38] },
    aileronDeflection: { op: 'multiply', args: ['rollInput', 0.28] },
    flaperonLeft: { op: 'subtract', args: ['flapDeflection', 'aileronDeflection'] },
    flaperonRight: { op: 'add', args: ['flapDeflection', 'aileronDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: f35Frame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.8, -4.35] }],
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

function f35Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'F35-cabin'),
    ins = instrumentGeometry(cabin, 'F35'),
    { bindings, derived, ink, black, amber } = ins;
  const panel = mat('F35-panel', '#333c40', { side: T.DoubleSide }),
    button = mat('F35-key', '#7b8689'),
    green = mat('F35-display', '#8de0a9', { emissive: '#245b38', emissiveIntensity: 0.6 }),
    seat = mat('F35-seat', '#394139'),
    belt = mat('F35-harness', '#7b826d');
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'gearPosition',
      'flapPosition',
      'loadFactor',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
      { component: 'aircraftState', path: [k] },
    ]),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
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
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  const z = 6.55,
    rect = (x, y, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([u, v]) => [x + u * w, y + v * h, z + dz]),
    txt = (t, x, y, h = 0.009, color = ink, dz = -0.035) =>
      d.text(t, [x, y, z + dz], h, Math.PI, color);
  // The JPO publishes a20x8in active area. Single panoramic face with real horizon apertures.
  const edge = [
    [-0.43, 2.388],
    [-0.43, 2.46],
    [-0.34, 2.54],
    [-0.32, 2.66],
    [-0.29, 2.68],
    [0.29, 2.68],
    [0.32, 2.66],
    [0.34, 2.54],
    [0.43, 2.46],
    [0.43, 2.388],
    [0.13, 2.388],
    [0.13, 2.17],
    [-0.13, 2.17],
    [-0.13, 2.388],
  ];
  const holes = [rect(-0.03, 2.55, 0.102, 0.077), rect(-0.043, 2.3, 0.064, 0.05)];
  sheet(
    d,
    edge.map(([x, y]) => [x, y, z]),
    panel,
    [0, 0, -1],
    holes,
  );
  outline(
    d,
    edge.map(([x, y]) => [x, y, z - 0.005]),
    0.008,
    black,
  );
  for (let j = 0; j < 9; j++) {
    const a = edge[j],
      b = edge[j + 1];
    quad(
      d,
      [...a, z],
      [...b, z],
      [b[0] * 0.88, b[1] - 0.04, z + 0.26],
      [a[0] * 0.88, a[1] - 0.04, z + 0.26],
      black,
      [0, 1, 0],
    );
  }
  sheet(
    d,
    rect(0, 2.54, 0.556, 0.25, -0.012),
    black,
    [0, 0, -1],
    [rect(-0.03, 2.55, 0.102, 0.077, -0.012)],
  );
  outline(d, rect(0, 2.54, 0.508, 0.2032, -0.023), 0.0025, button);
  txt('FLIGHT / SIM', -0.03, 2.628, 0.008, green);
  for (const x of [-0.127, 0.127])
    d.rod([x, 2.443, z - 0.027], [x, 2.632, z - 0.027], 0.0008, button);
  txt('TACTICAL', 0.19, 2.56, 0.008, amber);
  txt('INOP', 0.19, 2.54, 0.012, amber);
  txt('SENSORS', -0.19, 2.56, 0.008, amber);
  txt('INOP', -0.19, 2.54, 0.012, amber);
  ins.horizon('attitude', [-0.03, 2.55, z + 0.012], 0.1, 0.075, { blankBackdrop: true });
  txt('TAS', 0.079, 2.573, 0.006, green);
  ins.readout('speed', [0.079, 2.552, z - 0.036], 'knots', 3, 0.009, green);
  txt('GEO FT', -0.1, 2.506, 0.0055, green);
  ins.readout('altitude', [-0.1, 2.49, z - 0.036], 'feet', 5, 0.006, green, true, true);
  txt('FPM', 0.076, 2.506, 0.006, green);
  ins.readout(
    'vertical-speed',
    [0.076, 2.49, z - 0.036],
    'verticalFpm',
    5,
    0.006,
    green,
    true,
    true,
  );
  const hg = group(cabin, 'F35-heading', [-0.028, 2.473, z - 0.038]),
    hd = detailKit(hg, hg.name);
  for (let j = 0; j < 36; j++) {
    const a = (j * Math.PI) / 18,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(j % 3 ? 0.019 : 0.017), p(0.021), 0.0004, green);
    if (j % 9 === 0) hd.text(['N', 'E', 'S', 'W'][j / 9], p(0.012), 0.004, Math.PI, green);
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
  d.rod([-0.028, 2.499, z - 0.04], [-0.028, 2.495, z - 0.04], 0.0007, ink);
  txt('TRUE', -0.028, 2.445, 0.004, green);
  for (let j = 0; j < 6; j++) {
    const x = 0.21 - j * 0.084;
    outline(d, rect(x, 2.452, 0.075, 0.012, -0.03), 0.0006, button);
    txt(['MENU', 'DATA', 'NAV', 'SYS', 'CNI', 'FUEL'][j], x, 2.452, 0.004, button);
  }
  // Lower integrated standby unit and keypad, physically below the PCD as in the mock-up.
  sheet(
    d,
    rect(0, 2.3, 0.205, 0.119, -0.012),
    black,
    [0, 0, -1],
    [rect(-0.043, 2.3, 0.064, 0.05, -0.012)],
  );
  ins.horizon('standby-attitude', [-0.043, 2.3, z + 0.01], 0.062, 0.048, { blankBackdrop: true });
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) {
      const x = 0.08 - col * 0.026,
        y = 2.334 - row * 0.022;
      d.box([0.019, 0.015, 0.006], [x, y, z - 0.021], button);
      txt(String((row * 3 + col + 1) % 10), x, y, 0.008, black, -0.026);
    }
  for (let j = 0; j < 8; j++)
    for (const side of [-1, 1])
      d.box([0.013, 0.007, 0.006], [0.085 - j * 0.024, 2.3 + side * 0.051, z - 0.021], button);
  txt('STANDBY / SIM', -0.044, 2.339, 0.005, green);
  // No conventional HUD. The real helmet display is not synthesized by this model.
  d.box([0.86, 0.05, 1.9], [0, 1.695, 5.85], panel);
  d.box([0.86, 0.64, 0.035], [0, 2.04, 6.8], panel);
  for (const side of [-1, 1]) {
    quad(
      d,
      [side * 0.48, 1.72, 5.05],
      [side * 0.48, 2.55, 5.05],
      [side * 0.42, 2.38, 6.8],
      [side * 0.42, 1.72, 6.8],
      panel,
      [-side, 0, 0],
    );
    outline(
      d,
      [
        [side * 0.48, 2.55, 5.05],
        [side * 0.42, 2.38, 6.8],
      ],
      0.022,
      black,
      false,
    );
  }
  for (const side of [-1, 1]) {
    d.box([0.18, 0.15, 1.2], [side * 0.36, 1.94, 5.65], panel);
    const g = group(cabin, `F35-console-${side}`, [side * 0.36, 2.02, 5.65]);
    g.rotation.x = Math.PI / 2;
    const gd = detailKit(g, g.name);
    for (const [j, label] of (side === 1
      ? ['POWER', 'COMM', 'FUEL', 'START']
      : ['CANOPY', 'ECS', 'LIGHT', 'OXY']
    ).entries()) {
      const v = 0.46 - j * 0.28;
      gd.box([0.15, 0.24, 0.007], [0, v, 0], black);
      gd.text(label, [0, v + 0.085, -0.009], 0.009, Math.PI, ink);
      for (const x of [-0.04, 0.04]) {
        gd.add(new T.CylinderGeometry(0.008, 0.01, 0.012, 12).rotateX(Math.PI / 2), button, [
          x,
          v - 0.04,
          -0.015,
        ]);
        gd.rod([x, v + 0.02, -0.012], [x, v + 0.028, -0.032], 0.003, m.metal);
      }
    }
    gd.finish();
  }
  const sg = group(cabin, 'F35-US16E-seat', [0, 1.86, 5.2]);
  sg.rotation.x = -0.2;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.46, 0.12, 0.51], [0, 0, 0.2], seat);
  beveledBox(sd, [0.44, 0.68, 0.13], [0, 0.39, -0.08], seat);
  beveledBox(sd, [0.3, 0.3, 0.18], [0, 0.91, -0.08], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.25, -0.1, -0.19], [side * 0.25, 1.09, -0.19], 0.022, m.metal);
    sheet(
      sd,
      [
        [side * 0.08, 0.74, 0.01],
        [side * 0.14, 0.74, 0.01],
        [side * 0.12, 0.12, 0.1],
        [side * 0.06, 0.12, 0.1],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.12, 0.04, 0.21], [side * 0.16, 0.1, 0.18], belt);
    sd.box([0.055, 0.36, 0.12], [side * 0.27, 0.53, -0.15], black);
  }
  sd.box([0.065, 0.045, 0.025], [0, 0.1, 0.21], m.metal);
  sd.ring(0.045, 0.009, [0, 0.14, 0.43], amber);
  sd.finish();
  const stick = group(cabin, 'F35-stick', [-0.34, 2.04, 5.94]),
    st = detailKit(stick, stick.name);
  st.rod([0, 0, 0], [0, 0.1, -0.025], 0.016, black);
  beveledBox(st, [0.062, 0.12, 0.07], [0, 0.17, -0.025], black, 0.012);
  for (const p of [
    [-0.02, 0.23, -0.06],
    [0.02, 0.2, -0.06],
  ])
    st.add(new T.SphereGeometry(0.009, 8, 6), button, p);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.08 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.08 },
  );
  const throttle = group(cabin, 'F35-throttle', [0.34, 2.04, 5.81]),
    td = detailKit(throttle, throttle.name);
  td.rod([0, 0, 0], [0, 0.11, 0], 0.014, black);
  beveledBox(td, [0.11, 0.075, 0.105], [0, 0.13, 0], black, 0.01);
  td.add(new T.SphereGeometry(0.009, 8, 6), button, [-0.05, 0.16, -0.025]);
  td.finish();
  bindings.push({
    node: throttle.name,
    source: 'power',
    property: 'rotation',
    axis: 'x',
    scale: 0.6,
    offset: -0.3,
  });
  for (const side of [-1, 1]) {
    const g = group(cabin, `F35-pedal-${side}`, [side * 0.15, 1.85, 6.55]),
      gd = detailKit(g, g.name);
    gd.box([0.13, 0.13, 0.03], [0, 0, 0], m.metal);
    for (let j = 0; j < 5; j++) gd.box([0.11, 0.004, 0.004], [0, -0.05 + j * 0.025, -0.02], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  const lamp = group(cabin, 'F35-gear-lamp', [0.34, 2.43, z - 0.034]),
    ld = detailKit(lamp, lamp.name);
  ld.box([0.012, 0.012, 0.004], [0, 0, 0], green);
  ld.finish();
  bindings.push({
    node: lamp.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  txt('GEAR', 0.34, 2.411, 0.007);
  txt('ENGINE --', 0.19, 2.473, 0.007, amber);
  txt('FUEL --', -0.19, 2.473, 0.007, amber);
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
