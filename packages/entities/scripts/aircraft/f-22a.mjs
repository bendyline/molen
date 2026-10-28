/** F-22A clean airframe. USAF three-view, Lockheed dimensions, NMUSAF EMD cockpit.
 * +Z forward, +X pilot left; ground datum. References and limits are in reference-review.json.
 */
import { cockpitText } from './cockpit-lettering.mjs';
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

export const f22Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.64,
  cy: 2.04,
  ry: 0.68,
  cabinZ: 7.3,
  cabinWidth: 0.92,
  eye: [0, 3.04, 7.3],
  panelZ: 7.94,
  floor: 1.88,
});

// The glazing, painted shoulders and cabin lining share these actual section planes.
const canopySections = [
  [9.45, 0, 2.425, 2.425],
  [9.05, 0.32, 2.52, 2.81],
  [8.55, 0.47, 2.57, 3.09],
  [7.9, 0.55, 2.63, 3.22],
  [7.2, 0.56, 2.69, 3.24],
  [6.55, 0.47, 2.74, 3.13],
  [5.95, 0, 2.781, 2.781],
];
function sectionAt(sections, z) {
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i],
      b = sections[i + 1];
    if (z <= a[0] && z >= b[0]) {
      const t = (z - a[0]) / (b[0] - a[0]);
      return a.map((v, j) => v + (b[j] - v) * t);
    }
  }
  throw Error(`F-22 section out of range: ${z}`);
}

export function buildF22A(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('F22-light-gray', '#9da6a9', { side: T.DoubleSide }),
    upper = mat('F22-gray', '#78848b', { side: T.DoubleSide }),
    dark = mat('F22-seals', '#303638'),
    metal = mat('F22-alloy', '#a2a9a9', { metalness: 0.7 }),
    nozzle = mat('F22-nozzle', '#77756d', { metalness: 0.65, side: T.DoubleSide }),
    lining = mat('F22-duct', '#202528', { side: T.DoubleSide }),
    glass = mat('F22-canopy', '#b7ac79', {
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'F22-airframe'),
    bindings = [];
  // Keep the animated child's rest axes clean; orient a parent to the measured hinge.
  const mountHinge = (node, axis, direction) => {
    const parent = node.parent,
      mount = group(parent, `${node.name}-mount`, node.position.toArray());
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
  // Chine-edged forebody: separate upper and lower facets rather than a round tube.
  const fore = [
    [11.85, 0.007, 1.65, 1.67, 1.66],
    [11.2, 0.28, 1.45, 1.91, 1.65],
    [10.3, 0.49, 1.3, 2.17, 1.7],
    [9.4, 0.63, 1.18, 2.44, 1.72],
    [9.0, 0.68, 1.16, 2.53, 1.73],
    [8.1, 0.72, 1.14, 2.6, 1.75],
    [7.2, 0.75, 1.11, 2.68, 1.78],
    [6.0, 0.78, 1.08, 2.78, 1.84],
    [5.5, 0.85, 1.08, 2.79, 1.9],
  ];
  const stations = [...new Set([...fore, ...canopySections].map(([z]) => z))].sort((a, b) => b - a);
  const rings = stations
    .map((z) => sectionAt(fore, z))
    .map(([z, w, b, t, c]) => ({
      z,
      points: [
        [0, t],
        [w * 0.7, t - 0.08],
        [w * 0.96, c + 0.19],
        [w, c],
        [w * 0.7, b + 0.08],
        [0, b],
        [-w * 0.7, b + 0.08],
        [-w, c],
        [-w * 0.96, c + 0.19],
        [-w * 0.7, t - 0.08],
      ],
    }));
  const opening = (i) => rings[i].z <= 9.45 && rings[i + 1].z >= 5.95;
  loft(d, rings, paint, { skip: (i, j) => opening(i) && (j === 0 || j === 9) });
  const canopy = canopySections;
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 21 }, (_, j) => [
      Math.cos((j * Math.PI) / 20) * w,
      b + Math.sin((j * Math.PI) / 20) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 20 });
  for (const j of [0, 20])
    outline(
      d,
      cr.map((r) => [...r.points[j], r.z]),
      0.022,
      paint,
      false,
    );
  // No transverse windscreen bow: the F-22 has a continuous bubble canopy.
  for (const side of [-1, 1]) {
    for (let i = 0; i < rings.length - 1; i++) {
      if (!opening(i)) continue;
      const a = rings[i],
        b = rings[i + 1],
        q = side === 1 ? 1 : 9;
      const start = sectionAt(canopy, a.z),
        end = sectionAt(canopy, b.z);
      quad(
        d,
        [...a.points[q], a.z],
        [...b.points[q], b.z],
        [side * end[1], end[2], b.z],
        [side * start[1], start[2], a.z],
        paint,
        [side, 1, 0],
      );
    }
    for (let i = 0; i < canopy.length - 1; i++)
      for (let j = 0; j < 6; j++) {
        const a = canopy[i],
          b = canopy[i + 1],
          t = j / 6;
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t),
          a[2] + (b[2] - a[2]) * t + 0.017,
          a[0] + (b[0] - a[0]) * t,
        ]);
      }
  }
  // Broad blended body carries two engine humps. Maximum thickness remains inboard.
  const aft = [
    [6.12, 1.91, 1.08, 2.65],
    [5.45, 1.98, 1.04, 2.73],
    [3.3, 2.18, 1.03, 2.65],
    [2.5, 2.4, 1.03, 2.62],
    [0, 2.48, 1.07, 2.58],
    [-2.4, 2.33, 1.16, 2.53],
    [-4.45, 2.03, 1.45, 2.48],
  ].map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t - 0.09],
      [0.7, t - 0.01],
      [1.17, t],
      [1.58, t - 0.12],
      [w, 2.11],
      [w * 0.9, b + 0.13],
      [1.05, b],
      [0, b],
      [-1.05, b],
      [-w * 0.9, b + 0.13],
      [-w, 2.11],
      [-1.58, t - 0.12],
      [-1.17, t],
      [-0.7, t - 0.01],
    ],
  }));
  loft(d, aft, paint, { caps: false });
  // End the painted fairing before the ducts; a dark internal bulkhead closes the unseen interior.
  sheet(
    d,
    aft.at(-1).points.map((p) => [...p, -4.45]),
    lining,
    [0, 0, -1],
  );
  for (const side of [-1, 1]) {
    // Inlet lips are a raked, trapezoidal aperture, with a dark duct behind them.
    const mouth = [
      [side * 0.86, 2.25, 6.78],
      [side * 1.92, 2.29, 6.12],
      [side * 1.68, 1.13, 6.07],
      [side * 1.03, 1.15, 6.6],
    ];
    const rear = mouth.map(([x, y, z]) => [x * 0.98, y + 0.04, z - 1.2]);
    for (let j = 0; j < 4; j++)
      quad(d, mouth[j], rear[j], rear[(j + 1) % 4], mouth[(j + 1) % 4], lining, [0, 0, 1]);
    sheet(d, rear, lining, [0, 0, 1]);
    outline(d, mouth, 0.035, paint);
    // Join the inlet shoulder to both the forebody and the actual engine-hump
    // contour. The old four-corner plate floated above both of those surfaces.
    const shoulder = (z) => {
      const [, w, , top] = sectionAt(fore, z);
      return [side * w * 0.7, top - 0.08, z];
    };
    const back = [
      shoulder(6.12),
      [side * 0.7, 2.64, 6.12],
      [side * 1.17, 2.65, 6.12],
      [side * 1.58, 2.53, 6.12],
      [side * 1.92, 2.29, 6.12],
    ];
    const front = shoulder(9),
      middle = shoulder(7.05),
      outer = [side * 0.85, 2.48, 7.05];
    const row = back.map((point) => {
      const t = (point[0] - back[0][0]) / (back.at(-1)[0] - back[0][0]);
      return middle.map((v, j) => v + (outer[j] - v) * t);
    });
    for (let j = 0; j < back.length - 1; j++) {
      sheet(d, [front, row[j], row[j + 1]], paint, [0, 1, 0]);
      quad(d, row[j], back[j], back[j + 1], row[j + 1], paint, [0, 1, 0]);
    }
    const [, width, , , chine] = sectionAt(fore, 7.05);
    sheet(d, [front, outer, mouth[1], mouth[0], [side * width * 0.96, chine + 0.19, 7.05]], paint, [
      side,
      0,
      0,
    ]);
    sheet(d, [back[3], back[4], [side * 1.91, 2.11, 6.12]], paint, [0, 0, 1]);
    quad(
      d,
      [side * 1.92, 2.29, 6.12],
      [side * 1.98, 2.11, 5.45],
      [side * 1.98, 1.17, 5.45],
      [side * 1.68, 1.13, 6.07],
      paint,
      [side, 0, 0],
    );
    // Aligned wing planform, separate leading flap and two trailing controls.
    const stations = [
      [2.18, 2.11, 3.3, -3.83, 0.105],
      [2.65, 2.12, 2.54, -3.74, 0.09],
      [6.7818, 1.82, -0.9, -2.05, 0.018],
    ];
    const reflect = (st) => st.map((q) => [q[0] * side, ...q.slice(1)]);
    const main = stations.map(([x, y, a, b, h]) => [
      x,
      y,
      a - (a - b) * 0.11,
      b + (a - b) * 0.22,
      h,
    ]);
    wing(d, reflect(main), upper);
    const leadPivot = [side * 2.18, 2.11, 3.3 - (3.3 + 3.83) * 0.11];
    const lead = group(root, `F22-leading-${side}`, leadPivot),
      ld = detailKit(lead, lead.name);
    wing(
      ld,
      stations.map(([x, y, a, b, h]) => [
        side * x - leadPivot[0],
        y - leadPivot[1],
        a - leadPivot[2],
        a - (a - b) * 0.11 - leadPivot[2],
        h * 0.3,
      ]),
      paint,
    );
    ld.finish();
    const last = stations.at(-1);
    mountHinge(
      lead,
      [1, 0, 0],
      [
        last[0] - 2.18,
        side * (last[1] - 2.11),
        side * (last[2] - (last[2] - last[3]) * 0.11 - leadPivot[2]),
      ],
    );
    bindings.push({
      node: lead.name,
      source: 'flapPosition',
      property: 'rotation',
      axis: 'x',
      scale: 0.12,
    });
    for (const [name, x0, x1, input, gain] of [
      ['flap', 2.18, 4.35, 'flapPosition', -0.42],
      ['aileron', 4.35, 6.7818, 'rollInput', -0.3 * side],
    ]) {
      const interp = (x) => {
        const a = x < 2.65 ? stations[0] : stations[1],
          b = x < 2.65 ? stations[1] : stations[2],
          t = (x - a[0]) / (b[0] - a[0]);
        return a.map((v, i) => (i === 0 ? x : v + (b[i] - v) * t));
      };
      const a = interp(x0),
        b = interp(x1),
        pivot = [side * x0, a[1], a[3] + (a[2] - a[3]) * 0.22],
        g = group(root, `F22-${name}-${side}`, pivot),
        gd = detailKit(g, g.name);
      wing(
        gd,
        [a, b].map(([x, y, le, te, h]) => [
          side * x - pivot[0],
          y - pivot[1],
          te + (le - te) * 0.22 - pivot[2],
          te - pivot[2],
          h * 0.3,
        ]),
        paint,
      );
      gd.finish();
      mountHinge(
        g,
        [1, 0, 0],
        [x1 - x0, side * (b[1] - a[1]), side * (b[3] + (b[2] - b[3]) * 0.22 - pivot[2])],
      );
      bindings.push({ node: g.name, source: input, property: 'rotation', axis: 'x', scale: gain });
    }
    // Panel border strips follow the actual wing edges, not a rectangular decal.
    outline(
      d,
      stations.map(([x, y, a, b, h]) => [side * x, y + h + 0.004, a - (a - b) * 0.12]),
      0.005,
      paint,
      false,
    );
    // Diamond all-moving horizontal tail. Manufacturer independent span 29ft.
    const pivot = [side * 1.6, 2.12, -4.6],
      tg = group(root, `F22-stabilator-${side}`, pivot),
      td = detailKit(tg, tg.name);
    const tail = [
      [1.6, 2.12, -3.93, -5.65, 0.05],
      [3.05, 2.12, -3.93, -7.073, 0.035],
      [4.4196, 2.12, -5.4, -6.62, 0.012],
    ];
    wing(
      td,
      tail.map(([x, y, a, b, h]) => [
        side * x - pivot[0],
        y - pivot[1],
        a - pivot[2],
        b - pivot[2],
        h,
      ]),
      paint,
    );
    sheet(
      td,
      [
        [1.85, -4.2],
        [2.98, -4.2],
        [4.1, -5.5],
        [4.1, -6.45],
        [3.05, -6.78],
        [1.85, -5.5],
      ].map(([x, z]) => [side * x - pivot[0], 0.045, z - pivot[2]]),
      upper,
      [0, 1, 0],
    );
    td.finish();
    bindings.push({
      node: tg.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    // Canted trapezoidal fins, cut at their rudder hinges.
    const height = (5.08 - 2.4) / Math.cos((27 * Math.PI) / 180),
      fg = group(root, `F22-fin-${side}`, [side * 1.55, 2.4, -1.25]);
    fg.rotation.z = (-side * 27 * Math.PI) / 180;
    const fd = detailKit(fg, fg.name);
    for (const x of [-0.035, 0.035])
      sheet(
        fd,
        [
          [x, 0, 0],
          [x, height, -1.35],
          [x, height, -2.13],
          [x, 0.14, -3.84],
        ],
        paint,
        [Math.sign(x), 0, 0],
      );
    const rg = group(fg, `F22-rudder-${side}`, [0, 0.14, -3.84]),
      rd = detailKit(rg, rg.name);
    sheet(
      rd,
      [
        [0, 0, 0],
        [0, height - 0.14, 1.71],
        [0, height - 0.14, 1.22],
        [0, 0, -0.5],
      ],
      upper,
      [side, 0, 0],
    );
    rd.finish();
    mountHinge(rg, [0, 1, 0], [0, height - 0.14, 1.71]);
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.35,
    });
    // Exterior operator identifiers are supplied by the selected livery.
    // Exterior operator identifiers are supplied by the selected livery.
    fd.finish();
    // Rectangular, open exhausts with upper/lower 2D petals. Static neutral nozzle angle:
    // the kernel has no F119 pitch-vector control law, so do not invent pitch-input coupling.
    const ex = group(root, `F22-exhaust-${side}`, [side * 1.0, 2.0, -4.45]),
      ed = detailKit(ex, ex.name);
    const sections = [
      [0, 0.69, 0.43],
      [-0.72, 0.67, 0.37],
      [-1.56, 0.62, 0.29],
    ].map(([z, w, h]) => ({
      z,
      points: [
        [-w, h],
        [w, h],
        [w, -h],
        [-w, -h],
      ],
    }));
    loft(ed, sections, nozzle, { caps: false });
    loft(
      ed,
      sections.map((r) => ({ z: r.z, points: r.points.map(([x, y]) => [x * 0.95, y * 0.88]) })),
      lining,
      { caps: false },
    );
    sheet(
      ed,
      [
        [-0.72, 0.46, 0.01],
        [0.72, 0.46, 0.01],
        [0.72, -0.46, 0.01],
        [-0.72, -0.46, 0.01],
      ],
      lining,
      [0, 0, -1],
    );
    for (const y of [-1, 1])
      for (let j = 0; j < 7; j++)
        ed.rod(
          [-0.57 + j * 0.19, y * 0.433, -0.02],
          [-0.55 + j * 0.183, y * 0.296, -1.56],
          0.006,
          metal,
        );
    for (const x of [-0.66, 0.66])
      outline(
        ed,
        [
          [x, 0.35, -0.7],
          [x, 0.29, -1.56],
          [x, -0.29, -1.56],
          [x, -0.35, -0.7],
        ],
        0.009,
        dark,
        false,
      );
    ed.finish();
  }
  // Main wheels and nose wheel match the three-view track/wheelbase proportions.
  for (const [name, x, z, radius, width, top] of [
    ['left', 1.58, 0, 0.43, 0.28, 1.3],
    ['right', -1.58, 0, 0.43, 0.28, 1.3],
    ['nose', 0, 6.14, 0.3, 0.19, 1.3],
  ]) {
    const g = group(root, `F22-gear-${name}`, [x, top, z]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, radius - top, 0], name === 'nose' ? 0.045 : 0.065, metal);
    gd.rod([0, -0.1, -0.6], [0, radius - top + 0.12, 0], 0.035, metal);
    gd.add(new T.CylinderGeometry(radius, radius, width, 28).rotateZ(Math.PI / 2), dark, [
      0,
      radius - top,
      0,
    ]);
    gd.add(
      new T.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.012, 24).rotateZ(Math.PI / 2),
      metal,
      [0, radius - top, 0],
    );
    const doorSide = name === 'right' ? -1 : 1;
    gd.box([0.025, 0.65, name === 'nose' ? 0.7 : 0.9], [doorSide * 0.2, -0.15, -0.19], paint);
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
  // Selected sawtooth access edges and RAM borders; flush surfaces do not get raised rivet grids.
  const topPoint = (x, z) => {
    const i = Math.max(
      0,
      aft.findIndex((r, j) => j < aft.length - 1 && z <= r.z && z >= aft[j + 1].z),
    );
    const a = aft[i],
      b = aft[i + 1],
      t = Math.max(0, Math.min(1, (a.z - z) / (a.z - b.z)));
    const height = (r) => {
      const pts = r.points.slice(0, 5);
      let j = pts.findIndex((p, k) => k < 4 && Math.abs(x) >= p[0] && Math.abs(x) <= pts[k + 1][0]);
      if (j < 0) j = 3;
      const p = pts[j],
        q = pts[j + 1];
      return p[1] + ((q[1] - p[1]) * (Math.abs(x) - p[0])) / (q[0] - p[0]);
    };
    return [x, height(a) + (height(b) - height(a)) * t + 0.01, z];
  };
  for (const side of [-1, 1]) {
    outline(
      d,
      [
        [side * 0.28, 2.705, 5.35],
        [side * 0.44, 2.7, 5.18],
        [side * 0.28, 2.69, 5.01],
        [side * 0.44, 2.69, 4.84],
        [side * 0.28, 2.68, 4.67],
        [side * 0.44, 2.68, 4.5],
        [side * 0.28, 2.67, 4.33],
      ],
      0.004,
      dark,
      false,
    );
    sheet(
      d,
      [
        [side * 0.38, 2.674, 3.4],
        [side * 0.58, 2.66, 3.16],
        [side * 0.43, 2.655, 2.96],
        [side * 0.23, 2.65, 3.16],
      ],
      dark,
      [0, 1, 0],
    );
    outline(
      d,
      [
        [side * 0.19, 2.65, 2.7],
        [side * 0.33, 2.65, 2.58],
        [side * 0.18, 2.65, 2.45],
        [side * 0.33, 2.65, 2.32],
        [side * 0.18, 2.65, 2.19],
      ],
      0.004,
      paint,
      false,
    );
    for (const centerZ of [2.0, 1.2]) {
      const contour = [
        [-0.22, 0.28],
        [-0.1, 0.36],
        [0, 0.28],
        [0.1, 0.36],
        [0.22, 0.28],
        [0.22, -0.22],
        [0.1, -0.3],
        [0, -0.22],
        [-0.1, -0.3],
        [-0.22, -0.22],
      ].map(([x, z]) => topPoint(side * (0.67 + x), centerZ + z));
      outline(d, contour, 0.003, paint);
    }
    for (const [x, z] of [
      [0.55, 4.83],
      [1.6, 1.0],
    ]) {
      const poly = [
        [-0.13, 0.17],
        [0.12, 0.17],
        [0.18, 0],
        [0.11, -0.16],
        [-0.12, -0.16],
        [-0.18, 0],
      ].map(([dx, dz]) => topPoint(side * (x + dx), z + dz));
      sheet(d, poly, dark, [0, 1, 0]);
      outline(d, poly, 0.012, paint);
    }
    outline(
      d,
      [
        [side * 1.25, 2.4, -3.9],
        [side * 1.45, 2.35, -4.1],
        [side * 1.25, 2.32, -4.3],
      ],
      0.007,
      paint,
      false,
    );
    const skinX = (y, z) => {
      const [, width, , top, chine] = sectionAt(fore, z);
      const t = (top - 0.08 - y) / (top - 0.08 - chine - 0.19);
      return width * (0.7 + 0.26 * t);
    };
    const label = cockpitText(root, `F22-rescue-label-${side}`, 'RESCUE', [0, 0, 0], 0.055, dark);
    const position = label.geometry.getAttribute('position');
    for (let j = 0; j < position.count; j++) {
      const y = 2.27 + position.getY(j),
        z = 8.65 + side * position.getX(j);
      position.setXYZ(j, side * (skinX(y, z) + 0.0015), y, z);
    }
    label.geometry.computeVertexNormals();
    for (let j = 0; j < 12; j++)
      d.add(new T.SphereGeometry(0.0025, 5, 3), dark, [
        side * (skinX(2.3, 8.8 - j * 0.1) + 0.001),
        2.3,
        8.8 - j * 0.1,
      ]);
  }
  d.finish();
  const interior = f22Cockpit(root, { paint, metal, glass }, fore);
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.32] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.13] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: f22Frame(),
    enginePoints: [
      { id: 'engine-1', position: [1, 2, -4.45] },
      { id: 'engine-2', position: [-1, 2, -4.45] },
    ],
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

function f22Cockpit(root, m, fore) {
  const cabin = group(root, 'cockpit'),
    dashboard = group(cabin, 'F22-instrument-panel', [0, -0.11, -0.18]),
    d = detailKit(dashboard, 'F22-panel-detail'),
    ins = instrumentGeometry(dashboard, 'F22'),
    { bindings, derived, ink, black, amber } = ins;
  // Keep the instruments square and their animated children together. The wider,
  // nearer fascia fills the pilot's lower view while remaining inside the canopy.
  dashboard.scale.set(1.1, 1.1, 1);
  const panel = mat('F22-panel', '#434c50', { side: T.DoubleSide }),
    button = mat('F22-key', '#788385'),
    green = mat('F22-display', '#79d792', { emissive: '#265b36', emissiveIntensity: 0.65 }),
    seat = mat('F22-seat', '#5d6659'),
    belt = mat('F22-harness', '#939985');
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
  const z = 8.12,
    rect = (x, y, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([u, v]) => [x + u * w, y + v * h, z + dz]);
  const txt = (t, x, y, h = 0.009, color = ink, dz = -0.028, role = 'panel') =>
    d.text(t, [x, y, z + dz], h, Math.PI, color, role);
  const edge = [
    [-0.41, 2.2],
    [-0.41, 2.43],
    [-0.32, 2.79],
    [0.32, 2.79],
    [0.41, 2.43],
    [0.41, 2.2],
    [0.15, 2.2],
    [0.15, 1.94],
    [-0.15, 1.94],
    [-0.15, 2.2],
  ];
  // Six display housings: 8in center, three 6in neighbors, two upper auxiliary displays.
  sheet(
    d,
    edge.map(([x, y]) => [x, y, z]),
    panel,
    [0, 0, -1],
    [rect(0.225, 2.49, 0.107, 0.077)],
  );
  outline(
    d,
    edge.map(([x, y]) => [x, y, z - 0.004]),
    0.008,
    black,
  );
  for (let j = 0; j < 5; j++) {
    const a = edge[j],
      b = edge[j + 1];
    quad(
      d,
      [...a, z],
      [...b, z],
      [b[0] * 0.82, b[1] - 0.03, z + 0.3],
      [a[0] * 0.82, a[1] - 0.03, z + 0.3],
      black,
      [0, 1, 0],
    );
  }
  const display = (name, x, y, w, h, live = false) => {
    sheet(
      d,
      rect(x, y, w + 0.045, h + 0.045, -0.009),
      black,
      [0, 0, -1],
      live ? [rect(x, y + 0.02, 0.107, 0.077, -0.009)] : [],
    );
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        d.box(
          [0.009, 0.012, 0.006],
          [x + side * (w / 2 + 0.012), y - h * 0.38 + j * h * 0.152, z - 0.018],
          button,
        );
        d.box(
          [0.012, 0.009, 0.006],
          [x - w * 0.38 + j * w * 0.152, y + side * (h / 2 + 0.012), z - 0.018],
          button,
        );
      }
    for (const side of [-1, 1])
      d.add(new T.CylinderGeometry(0.006, 0.007, 0.012, 12).rotateX(Math.PI / 2), button, [
        x + side * (w / 2 + 0.013),
        y + h * 0.37,
        z - 0.023,
      ]);
    txt(name, x, y + h * 0.4, 0.007, green);
  };
  display('FLIGHT / SIM', 0.225, 2.47, 0.1524, 0.1524, true);
  ins.horizon('attitude', [0.225, 2.49, z + 0.01], 0.105, 0.075, { blankBackdrop: true });
  txt('TAS', 0.265, 2.417, 0.006, green, undefined, 'display');
  ins.readout('speed', [0.265, 2.405, z - 0.03], 'knots', 3, 0.009, green);
  txt('GEO FT', 0.185, 2.417, 0.006, green, undefined, 'display');
  ins.readout('altitude', [0.185, 2.405, z - 0.03], 'feet', 5, 0.008, green, true, true);
  display('PMFD', 0, 2.44, 0.2032, 0.2032);
  txt('TACTICAL INOP', 0, 2.44, 0.012, amber, undefined, 'display');
  display('SMFD', -0.225, 2.47, 0.1524, 0.1524);
  txt('SENSORS INOP', -0.225, 2.47, 0.009, amber, undefined, 'display');
  display('NAV / SIM', 0, 2.165, 0.1524, 0.1524);
  const hg = group(dashboard, 'F22-heading', [0, 2.165, z - 0.03]),
    hd = detailKit(hg, hg.name);
  for (let j = 0; j < 72; j++) {
    const a = (j * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(j % 6 ? 0.047 : 0.043), p(0.05), 0.0006, green);
    if (j % 6 === 0) hd.text(String(j / 2), p(0.032), 0.006, Math.PI, green);
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
  txt('TRUE', 0, 2.108, 0.006, green, undefined, 'display');
  d.rod([0, 2.223, z - 0.032], [0, 2.215, z - 0.032], 0.001, ink);
  for (const side of [-1, 1]) {
    display('AUX', side * 0.225, 2.674, 0.1016, 0.0762);
    if (side === 1) {
      txt('FPM', side * 0.225, 2.686, 0.006, green, undefined, 'display');
      ins.readout(
        'vertical-speed',
        [side * 0.225, 2.663, z - 0.03],
        'verticalFpm',
        5,
        0.009,
        green,
        true,
        true,
      );
    } else {
      txt('ENGINE', side * 0.225, 2.684, 0.007);
      txt('--  --', side * 0.225, 2.662, 0.01, amber);
    }
  }
  // Projecting integrated control panel: photograph places it over the upper center display.
  const icp = group(dashboard, 'F22-ICP', [0, 2.66, z - 0.07]),
    cd = detailKit(icp, icp.name);
  beveledBox(cd, [0.235, 0.155, 0.055], [0, 0, 0], black, 0.008);
  for (let j = 0; j < 9; j++)
    cd.box([0.017, 0.013, 0.006], [-0.096 + j * 0.024, 0.058, -0.031], button);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) {
      const x = 0.077 - col * 0.024,
        y = 0.025 - row * 0.025;
      cd.box([0.019, 0.019, 0.006], [x, y, -0.031], button);
      cd.text(String((row * 3 + col + 1) % 10), [x, y, -0.036], 0.009, Math.PI, ink);
    }
  for (let j = 0; j < 5; j++) {
    cd.box([0.078, 0.011, 0.004], [-0.047, 0.034 - j * 0.021, -0.031], panel);
    cd.text('----', [-0.047, 0.034 - j * 0.021, -0.035], 0.007, Math.PI, green);
    cd.add(new T.CylinderGeometry(0.005, 0.005, 0.006, 8).rotateX(Math.PI / 2), button, [
      0.005,
      0.034 - j * 0.021,
      -0.034,
    ]);
  }
  cd.finish();
  for (const side of [-1, 1]) {
    d.box([0.061, 0.032, 0.027], [side * 0.18, 2.763, z - 0.055], black);
    txt(side === 1 ? 'WARN' : 'CAUT', side * 0.18, 2.763, 0.007, amber, -0.072);
  }
  // HUD optical combiner: geometry only, no invented conformal targeting symbology.
  const hud = group(dashboard, 'F22-HUD', [0, 2.827, 8.3]);
  beveledBox(d, [0.23, 0.04, 0.22], [0, 2.81, 8.26], black, 0.008);
  hud.rotation.x = -0.12;
  const ud = detailKit(hud, hud.name);
  const hc = [
    [-0.1, 0, 0],
    [-0.105, 0.12, 0],
    [-0.08, 0.16, 0],
    [0.08, 0.16, 0],
    [0.105, 0.12, 0],
    [0.1, 0, 0],
  ];
  sheet(ud, hc, m.glass, [0, 0, -1]);
  outline(ud, hc, 0.005, black);
  ud.box([0.23, 0.03, 0.18], [0, -0.015, 0.05], black);
  ud.finish();
  // Floor, side ledges and ACES-II inspired seat preserve actual depth around the panel.
  const tub = detailKit(cabin, 'F22-cockpit-tub');
  tub.box([1.04, 0.05, 2.15], [0, 1.855, 7.475], panel);
  const wallSections = [6.4, 6.55, 7.2, 7.9, 8.55, 9.05].map((z) => sectionAt(canopySections, z));
  for (const side of [-1, 1]) {
    const wall = wallSections.map(([z, width, base]) => {
      const [, bodyWidth, , top] = sectionAt(fore, z);
      return [
        [side * (width - 0.025), base - 0.012, z],
        [side * (bodyWidth * 0.7 - 0.025), top - 0.07, z],
        [side * Math.min(0.52, width + 0.15), 2.37, z],
        [side * 0.51, 1.88, z],
      ];
    });
    for (let i = 0; i < wall.length - 1; i++) {
      for (let j = 0; j < wall[i].length - 1; j++)
        quad(tub, wall[i][j], wall[i + 1][j], wall[i + 1][j + 1], wall[i][j + 1], panel, [
          -side,
          0,
          0,
        ]);
      const [za, wa, ya] = wallSections[i],
        [zb, wb, yb] = wallSections[i + 1];
      quad(
        tub,
        wall[i][0],
        wall[i + 1][0],
        [side * wb, yb + 0.006, zb],
        [side * wa, ya + 0.006, za],
        black,
        [0, 1, 0],
      );
    }
    outline(
      tub,
      wall.map((points) => points[0]),
      0.025,
      black,
      false,
    );
    for (const row of wall.slice(1, -1)) {
      outline(tub, row, 0.01, panel, false);
      tub.add(new T.SphereGeometry(0.004, 8, 4), m.metal, [
        row[0][0] - side * 0.008,
        row[0][1] - 0.035,
        row[0][2],
      ]);
    }
  }
  for (const [z, top, halfWidth, normal] of [
    [6.4, 2.738, 0.3275, 1],
    [8.55, 2.558, 0.445, -1],
  ])
    sheet(
      tub,
      [
        [-0.51, 1.88, z],
        [0.51, 1.88, z],
        [0.52, 2.37, z],
        [halfWidth, top, z],
        [0, top, z],
        [-halfWidth, top, z],
        [-0.52, 2.37, z],
      ],
      panel,
      [0, 0, normal],
    );
  // Wrapped glare shield reaches the forward canopy sill, covering the exterior
  // forebody from the pilot's view. Its narrow nose stays below the sightline.
  const cowl = [
    {
      z: 8.23,
      points: [
        [-0.295, 2.926],
        [0, 2.926],
        [0.295, 2.926],
      ],
    },
    {
      z: 8.55,
      points: [
        [-0.445, 2.56],
        [0, 2.79],
        [0.445, 2.56],
      ],
    },
    {
      z: 9.05,
      points: [
        [-0.295, 2.51],
        [0, 2.57],
        [0.295, 2.51],
      ],
    },
    {
      z: 9.45,
      points: [
        [0, 2.425],
        [0, 2.425],
        [0, 2.425],
      ],
    },
  ];
  for (let i = 0; i < cowl.length - 1; i++)
    for (let j = 0; j < 2; j++)
      quad(
        tub,
        [...cowl[i].points[j], cowl[i].z],
        [...cowl[i + 1].points[j], cowl[i + 1].z],
        [...cowl[i + 1].points[j + 1], cowl[i + 1].z],
        [...cowl[i].points[j + 1], cowl[i].z],
        black,
        [0, 1, 0],
      );
  for (const side of [-1, 1]) {
    const cheek = [
      [side * 0.352, 2.959, 7.936],
      [side * 0.451, 2.563, 7.936],
      [side * 0.535, 2.618, 7.9],
      [side * 0.445, 2.56, 8.55],
      [side * 0.295, 2.926, 8.23],
    ];
    sheet(tub, cheek, black, [-side, 1, -1]);
    outline(tub, cheek.slice(0, 3), 0.018, panel, false);
  }
  for (const side of [-1, 1]) {
    tub.box([0.2, 0.14, 1.2], [side * 0.415, 2.13, 7.18], panel);
    const g = group(cabin, `F22-console-${side}`, [side * 0.4, 2.205, 7.18]);
    g.rotation.x = Math.PI / 2;
    const gd = detailKit(g, g.name);
    for (const [j, label] of (side === 1
      ? ['FUEL', 'START', 'POWER', 'COMM']
      : ['ECS', 'LIGHT', 'OXY', 'CANOPY']
    ).entries()) {
      const v = 0.45 - j * 0.27;
      gd.box([0.145, 0.23, 0.008], [0, v, 0], black);
      gd.text(label, [0, v + 0.085, -0.008], 0.009, Math.PI, ink);
      for (const x of [-0.04, 0.04]) {
        gd.add(new T.CylinderGeometry(0.009, 0.01, 0.014, 12).rotateX(Math.PI / 2), button, [
          x,
          v - 0.045,
          -0.014,
        ]);
        gd.rod([x, v + 0.015, -0.012], [x, v + 0.021, -0.032], 0.003, m.metal);
      }
    }
    gd.finish();
  }
  const sg = group(cabin, 'F22-ACES-II', [0, 2.01, 6.83]);
  sg.rotation.x = -0.25;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.47, 0.12, 0.49], [0, 0, 0.18], seat);
  beveledBox(sd, [0.43, 0.68, 0.13], [0, 0.37, -0.08], seat);
  beveledBox(sd, [0.33, 0.24, 0.19], [0, 0.88, -0.08], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.25, -0.12, -0.18], [side * 0.25, 1.03, -0.18], 0.024, m.metal);
    sheet(
      sd,
      [
        [side * 0.08, 0.7, 0.01],
        [side * 0.14, 0.7, 0.01],
        [side * 0.12, 0.12, 0.1],
        [side * 0.06, 0.12, 0.1],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.12, 0.04, 0.2], [side * 0.16, 0.1, 0.16], belt);
  }
  sd.box([0.06, 0.04, 0.025], [0, 0.1, 0.18], m.metal);
  sd.ring(0.043, 0.009, [0, 0.13, 0.41], amber);
  sd.finish();
  const stick = group(cabin, 'F22-stick', [-0.35, 2.23, 7.48]),
    st = detailKit(stick, stick.name);
  st.rod([0, 0, 0], [0, 0.12, -0.025], 0.016, black);
  beveledBox(st, [0.065, 0.115, 0.07], [0, 0.17, -0.025], black, 0.012);
  for (const p of [
    [-0.02, 0.22, -0.06],
    [0.02, 0.2, -0.06],
  ])
    st.add(new T.SphereGeometry(0.009, 8, 6), button, p);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.08 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.08 },
  );
  for (let j = 0; j < 2; j++) {
    const g = group(cabin, `F22-throttle-${j}`, [0.3 + j * 0.065, 2.22, 7.48]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, 0.11, 0], 0.012, black);
    beveledBox(gd, [0.055, 0.055, 0.095], [0, 0.12, 0], black, 0.008);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
  }
  for (const side of [-1, 1]) {
    const g = group(cabin, `F22-pedal-${side}`, [side * 0.14, 1.98, 8.15]),
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
  const lamp = group(dashboard, 'F22-gear-lamp', [0.37, 2.3, z - 0.03]),
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
  txt('GEAR', 0.37, 2.28, 0.006);
  d.finish();
  tub.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
