/** Series 400 Twin Otter. Viking 01-18 three-view and Bidini C-GOVN cockpit.
 * Hand-authored contours in metres; photo/reference calibration is in reference-review.json.
 */
import { panelTools } from '../vehicle-interiors.mjs';
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
export const twinOtterFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.915,
  cy: 1.92,
  ry: 1.04,
  cabinZ: 4.64,
  cabinWidth: 1.75,
  eye: [0.43, 2.57, 4.64],
  panelZ: 5.28,
  floor: 1.04,
});
const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
export function buildTwinOtter(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('TwinOtter-ivory', '#e9e6db', { side: T.DoubleSide }),
    accent = mat('TwinOtter-red', '#a93426', { side: T.DoubleSide }),
    dark = mat('TwinOtter-trim', '#263039', { side: T.DoubleSide }),
    metal = mat('TwinOtter-alloy', '#aeb5b6', { metalness: 0.7 }),
    rubber = mat('TwinOtter-tyres', '#1a2023'),
    glass = mat('TwinOtter-glazing', '#a5c4ce', {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    });
  const d = detailKit(root, 'TwinOtter-shell'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  const ppm = 655 / 15.77,
    z = (u) => 7.885 - (u - 270) / ppm,
    y = (v) => (1348 - v) / ppm;
  // Side roof/belly samples and independent plan widths; the large rectangular cabin
  // is not an ellipse. The forward roof panels are replaced by real window apertures.
  const samples = [
    [270, 0.015, 1290, 1278],
    [285, 0.24, 1298, 1267],
    [320, 0.53, 1305, 1255],
    [355, 0.76, 1310, 1246],
    [378, 0.88, 1313, 1228],
    [410, 0.915, 1314, 1223],
    [450, 0.915, 1314, 1225],
    [490, 0.915, 1314, 1227],
    [575, 0.915, 1312, 1227],
    [643, 0.87, 1306, 1230],
    [722, 0.62, 1294, 1234],
    [783, 0.42, 1284, 1239],
    [898, 0.12, 1267, 1250],
    [925, 0.014, 1261, 1259],
  ];
  const stations = samples.map(([u, w, b, t]) => [z(u), w, y(b), y(t)]);
  const rings = stations.map(([zz, w, b, t]) => ({
    z: zz,
    points: [
      [0, t],
      [w * 0.67, t - 0.025],
      [w * 0.94, t - 0.17],
      [w, t - 0.39],
      [w, b + 0.29],
      [w * 0.82, b + 0.07],
      [w * 0.45, b],
      [0, b - 0.01],
      [-w * 0.45, b],
      [-w * 0.82, b + 0.07],
      [-w, b + 0.29],
      [-w, t - 0.39],
      [-w * 0.94, t - 0.17],
      [-w * 0.67, t - 0.025],
    ],
  }));
  // Scale corner radii down at the thin nose/tail tips.
  rings.forEach((r, i) => {
    const [zz, w, b, t] = stations[i];
    if (t - b < 0.6) r.points = r.points.map(([x, yy]) => [x, Math.max(b, Math.min(t, yy))]);
  });
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 3 && [0, 1, 2, 11, 12, 13].includes(j)) ||
      (i >= 4 && i <= 9 && [2, 3, 10, 11].includes(j)),
  });
  for (const j of [0, 1, 2, 11, 12, 13])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 14), p(3, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [0, 3, 11]) d.rod(p(3, j), p(4, j), 0.017, dark);
  outline(
    d,
    [p(3, 3), p(3, 2), p(3, 1), p(3, 0), p(3, 13), p(3, 12), p(3, 11)],
    0.018,
    paint,
    false,
  );
  outline(
    d,
    [p(4, 3), p(4, 2), p(4, 1), p(4, 0), p(4, 13), p(4, 12), p(4, 11)],
    0.018,
    paint,
    false,
  );
  const sample = (zz, k) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (zz <= stations[i][0] && zz >= stations[i + 1][0]) {
        const t = (stations[i][0] - zz) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][k] * (1 - t) + stations[i + 1][k] * t;
      }
    return stations.at(-1)[k];
  };
  for (const side of [-1, 1]) {
    const pt = (zz, yy, off = 0) => [side * (sample(zz, 1) + off), yy, zz];
    const holes = [];
    const cockpit = [
      [380, 1248],
      [384, 1238],
      [401, 1239],
      [393, 1269],
      [380, 1273],
    ].map(([u, v]) => pt(z(u), y(v)));
    holes.push(cockpit);
    // Seven port and eight starboard windows; rear door has its own single aperture.
    const windows =
      side > 0 ? [441, 471, 501, 531, 561, 594, 673] : [441, 471, 501, 531, 561, 594, 624, 673];
    for (const u of windows) {
      const zz = z(u),
        yy = y(u > 650 ? 1266 : 1255),
        w = 0.39,
        h = 0.43,
        r = 0.065;
      const hole = [
        [-w / 2 + r, -h / 2],
        [w / 2 - r, -h / 2],
        [w / 2, -h / 2 + r],
        [w / 2, h / 2 - r],
        [w / 2 - r, h / 2],
        [-w / 2 + r, h / 2],
        [-w / 2, h / 2 - r],
        [-w / 2, -h / 2 + r],
      ].map(([dz, dy]) => pt(zz + dz, yy + dy));
      holes.push(hole);
    }
    const upper = side > 0 ? 2 : 12,
      lower = side > 0 ? 4 : 10;
    sheet(
      d,
      [
        ...[4, 5, 6, 7, 8, 9, 10].map((i) => p(i, upper)),
        ...[10, 9, 8, 7, 6, 5, 4].map((i) => p(i, lower)),
      ],
      paint,
      [side, 0, 0],
      holes,
    );
    for (const hole of holes) {
      sheet(d, hole, glass, [side, 0, 0]);
      outline(d, hole, 0.008, dark);
    }
    // Cockpit door, asymmetric cargo/service doors, original stencil labels and seams.
    for (const points of [
      [
        [373, 1241],
        [408, 1231],
        [399, 1304],
        [372, 1304],
      ],
      side > 0
        ? [
            [581, 1241],
            [641, 1242],
            [641, 1303],
            [581, 1306],
          ]
        : [
            [654, 1246],
            [687, 1248],
            [687, 1297],
            [654, 1300],
          ],
      [
        [294, 1270],
        [344, 1256],
        [345, 1297],
        [294, 1291],
      ],
    ]) {
      outline(
        d,
        points.map(([u, v]) => pt(z(u), y(v), 0.003)),
        0.0023,
        dark,
      );
    }
    d.rod(pt(z(399), y(1270), 0.025), pt(z(399), y(1277), 0.025), 0.013, metal);
    for (const zz of [2.7, 1.9, 0.9, -0.1, -1.15, -2.25, -3.4, -4.7]) {
      const b = sample(zz, 2),
        t = sample(zz, 3);
      d.rod(pt(zz, b + 0.16, 0.002), pt(zz, t - 0.2, 0.002), 0.0015, metal);
      for (let yy = b + 0.18; yy < t - 0.24; yy += 0.11)
        d.add(new T.SphereGeometry(0.0028, 5, 3), metal, pt(zz + 0.025, yy, 0.004));
    }
    for (let i = 2; i < stations.length - 2; i++) {
      const a = stations[i],
        b = stations[i + 1];
      quad(
        d,
        pt(a[0], a[2] + 0.13, 0.002),
        pt(b[0], b[2] + 0.13, 0.002),
        pt(b[0], b[2] + 0.38, 0.002),
        pt(a[0], a[2] + 0.38, 0.002),
        accent,
        [side, 0, 0],
      );
    }
    const label = group(root, `TwinOtter-label-${side}`, [side * 0.921, 1.56, -0.7]);
    label.rotation.y = (side * Math.PI) / 2;
    const ld = detailKit(label, label.name);
    ld.text('DHC 6 400', [0, 0, 0], 0.11, 0, accent);
    ld.finish();
    d.rod(pt(z(397), y(1306), 0.05), [side * 1.15, 0.71, z(397)], 0.024, metal);
    d.box([0.22, 0.04, 0.28], [side * 1.15, 0.69, z(397)], dark);
  }
  // Wing, double-slot flaps, ailerons and 3-degree dihedral. Black de-icing leading edges.
  const wy = (x) => 2.82 + Math.tan((3 * Math.PI) / 180) * Math.max(0, x - 0.915),
    le = (x) => 2.62,
    te = (x) => 0.63;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.86, wy(0.86), le(0.86), 1.15, 0.16],
        [side * 9.55, wy(9.55), le(9.55), 1.15, 0.14],
        [side * 9.905, wy(9.905), 2.34, 0.86, 0.09],
      ],
      paint,
    );
    wing(
      d,
      [
        [side * 0.94, wy(0.94) + 0.004, 2.628, 2.36, 0.042],
        [side * 9.5, wy(9.5) + 0.004, 2.628, 2.36, 0.039],
      ],
      dark,
    );
    for (const [kind, a, b] of [
      ['flap', 0.98, 6.27],
      ['aileron', 6.32, 9.5],
    ]) {
      const g = group(root, `TwinOtter-${kind}-${side}`, [side * a, wy(a), 1.15]);
      const dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(a) - 1.15, 0.035],
          [side * (b - a), wy(b) - wy(a), 0, te(b) - 1.15, 0.031],
        ],
        paint,
      );
      if (kind === 'flap')
        for (let x = a + 0.3; x < b; x += 1.08) {
          dd.rod([side * (x - a), -0.05, -0.07], [side * (x - a), -0.16, -0.38], 0.02, metal);
          dd.rod([side * (x - a), -0.16, -0.38], [side * (x - a), -0.09, -0.48], 0.025, dark);
        }
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : 'rollInput',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -0.65 : -side * 0.32,
      });
    }
    for (let x = 1.1; x < 9.5; x += 0.55)
      for (let u = 0.14; u < 0.8; u += 0.13) {
        const h = 0.15 * (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) * 0.96);
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * x,
          wy(x) + h + 0.003,
          2.62 - u * 1.47,
        ]);
      }
    const a = new T.Vector3(side * 0.88, 1.1, 1.1),
      b = new T.Vector3(side * 4.1, wy(4.1) - 0.08, 1.52),
      v = b.clone().sub(a),
      strut = d.box([0.09, v.length(), 0.27], a.clone().addScaledVector(v, 0.5).toArray(), paint);
    strut.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    d.rod([side * 3, 2.1, 1.38], [side * 3, wy(3) - 0.05, 1.38], 0.019, metal);
    ellipsoid(
      d,
      [side * 9.87, wy(9.87), 1.45],
      [0.05, 0.045, 0.09],
      side > 0 ? d.red : d.green,
      10,
    );
    d.rod([side * 7.9, wy(7.9) - 0.07, 2.5], [side * 7.9, wy(7.9) - 0.12, 3.1], 0.013, metal);
    wing(
      d,
      [
        [side * 0.19, 3.04, -5.2, -6.25, 0.095],
        [side * 3.06, 3.04, -5.2, -6.25, 0.09],
        [side * 3.145, 3.04, -5.36, -6.23, 0.065],
      ],
      paint,
    );
    const e = group(root, `TwinOtter-elevator-${side}`, [side * 0.2, 3.04, -6.25]),
      ed = detailKit(e, e.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.43, 0.025],
        [side * 2.87, 0, 0, -0.4, 0.022],
      ],
      accent,
    );
    ed.finish();
    bindings.push({
      node: e.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
  }
  const fin = [
    [-4.4, 2.66],
    [-4.72, 2.9],
    [-6.24, 5.84],
    [-6.43, 5.94],
    [-7.7, 5.82],
    [-7.15, 2.02],
  ];
  const finPart = (dd, pts, m) => {
    for (const side of [-1, 1])
      sheet(
        dd,
        pts.map(([zz, yy]) => [side * 0.065, yy, zz]),
        m,
        [side, 0, 0],
      );
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      quad(
        dd,
        [-0.065, a[1], a[0]],
        [-0.065, b[1], b[0]],
        [0.065, b[1], b[0]],
        [0.065, a[1], a[0]],
        m,
        [0, 1, 0],
      );
    }
  };
  finPart(
    d,
    fin.map(([zz, yy], i) => (i === 4 ? [zz + 0.37, yy] : i === 5 ? [zz + 0.47, yy] : [zz, yy])),
    paint,
  );
  const rud = group(root, 'TwinOtter-rudder', [0, 2.02, -6.68]);
  rud.rotation.x = -Math.atan2(0.65, 3.8);
  const moving = group(rud, 'TwinOtter-rudder-moving'),
    rd = detailKit(moving, moving.name);
  finPart(
    rd,
    [
      [0, 0],
      [0, 3.86],
      [-0.39, 3.86],
      [-0.47, 0],
    ],
    accent,
  );
  rd.finish();
  bindings.push({
    node: moving.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.4,
  });
  for (const side of [-1, 1])
    for (let yy = 2.3; yy < 5.7; yy += 0.21)
      d.rod(
        [side * 0.068, yy, -6.73 - (yy - 2) * 0.17],
        [side * 0.068, yy, -7.0 - (yy - 2) * 0.17],
        0.002,
        metal,
      );
  // Nacelles are low-slung PT6 cowls, three blades, 2.59 m diameter, 1.52 m clearance.
  for (const [i, side] of [1, -1].entries()) {
    const x = side * 2.815,
      ey = 2.815,
      ez = 4.1,
      eg = group(root, `engine-${i + 1}`, [x, ey, ez]),
      nd = detailKit(eg, `TwinOtter-nacelle-${i}`);
    const ns = [
      [0.03, 0.29, -0.43, 0.24],
      [-0.38, 0.35, -0.52, 0.29],
      [-0.95, 0.36, -0.55, 0.3],
      [-1.65, 0.34, -0.4, 0.3],
      [-2.55, 0.24, -0.13, 0.24],
      [-2.9, 0.025, 0, 0.07],
    ].map(([zz, w, b, t]) => ({
      z: zz,
      points: Array.from({ length: 16 }, (_, j) => {
        const a = (j * Math.PI) / 8;
        return [Math.sin(a) * w, (b + t) / 2 + (Math.cos(a) * (t - b)) / 2];
      }),
    }));
    loft(nd, ns, paint);
    ellipsoid(nd, [0, -0.32, 0.04], [0.205, 0.19, 0.025], dark, 20);
    for (const r of ns.slice(1, -1))
      outline(
        nd,
        r.points.map((q) => [...q, r.z]),
        0.002,
        metal,
      );
    for (const sign of [-1, 1]) {
      nd.rod([sign * 0.25, -0.04, -0.53], [sign * 0.45, -0.08, -0.7], 0.085, metal);
      nd.add(new T.CircleGeometry(0.075, 14).rotateY(sign * 0.8), dark, [
        sign * 0.45,
        -0.08,
        -0.715,
      ]);
    }
    nd.finish();
    const prop = group(eg, `TwinOtter-propeller-${i}`, [0, 0, 0.05]),
      pd = detailKit(prop, prop.name);
    pd.add(new T.ConeGeometry(0.22, 0.48, 24).rotateX(Math.PI / 2), metal, [0, 0, 0.24]);
    for (let j = 0; j < 3; j++) {
      const blade = group(prop, `TwinOtter-blade-${i}-${j}`);
      blade.rotation.z = (j * Math.PI * 2) / 3;
      const bd = detailKit(blade, blade.name),
        pts = [
          [0.14, -0.055, 0],
          [0.55, -0.1, 0.02],
          [1.24, -0.065, 0],
          [1.295, -0.035, 0],
          [1.295, 0.035, 0],
          [0.68, 0.09, -0.015],
          [0.14, 0.055, 0],
        ];
      sheet(bd, pts, dark, [0, 0, 1]);
      sheet(
        bd,
        pts.map((q) => [q[0], q[1], q[2] - 0.018]),
        dark,
        [0, 0, -1],
      );
      bd.box([0.055, 0.09, 0.02], [1.26, 0, -0.003], paint);
      bd.finish();
    }
    pd.finish();
    enginePoints.push({ id: eg.name, position: [x, ey, ez] });
    rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: eg.name });
  }
  // Fixed single tyres. 4.53 m wheelbase and 3.70 m track, no false retraction animation.
  for (const [i, x, zz, r, top] of [
    [0, 0, 5.98, 0.34, 1.04],
    [1, 1.85, 1.45, 0.38, 1.15],
    [2, -1.85, 1.45, 0.38, 1.15],
  ]) {
    const g = group(root, `TwinOtter-gear-${i}`),
      gd = detailKit(g, g.name);
    gd.rod([i ? Math.sign(x) * 0.85 : 0, top, zz + 0.08], [x, r, zz], i ? 0.085 : 0.045, metal);
    if (i) gd.rod([Math.sign(x) * 0.84, 1.08, zz - 0.68], [x, r + 0.07, zz], 0.055, dark);
    else {
      gd.rod([0.14, 0.94, zz - 0.12], [0.14, r, zz], 0.027, metal);
      gd.rod([-0.14, 0.94, zz - 0.12], [-0.14, r, zz], 0.027, metal);
    }
    gd.add(new T.CylinderGeometry(r, r, 0.21, 32).rotateZ(Math.PI / 2), rubber, [x, r, zz]);
    for (const side of [-1, 1]) {
      gd.add(new T.CircleGeometry(r * 0.52, 24).rotateY((side * Math.PI) / 2), metal, [
        x + side * 0.108,
        r,
        zz,
      ]);
      for (let j = 0; j < 8; j++)
        ellipsoid(
          gd,
          [
            x + side * 0.111,
            r + Math.cos((j * Math.PI) / 4) * r * 0.35,
            zz + Math.sin((j * Math.PI) / 4) * r * 0.35,
          ],
          [0.006, 0.013, 0.013],
          dark,
          6,
        );
    }
    gd.finish();
  }
  d.rod([0, 3.03, 3.1], [0, 3.38, 2.98], 0.02, dark);
  d.rod([0, 2.88, -2.6], [0, 3.18, -2.8], 0.016, dark);
  d.rod([0, 3.18, -2.8], [0, 5.77, -6.37], 0.003, dark);
  d.finish();
  const interior = twinOtterCockpit(root, { paint, accent, dark, metal });
  cleanGeometry(root);
  return {
    root,
    frame: twinOtterFrame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps: [], ailerons: [], animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function twinOtterCockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'TwinOtter-cabin'),
    ins = instrumentGeometry(cabin, 'TwinOtter'),
    pt = panelTools(d),
    { bindings, derived, ink, black } = ins;
  const face = mat('TwinOtter-panel', '#647783'),
    liner = mat('TwinOtter-liner', '#d2d3c8'),
    seat = mat('TwinOtter-seat', '#59646a');
  const k = 0.00162,
    px = (u) => (650 - u) * k,
    py = (v) => 2.03 + (370 - v) * k,
    z = 5.28,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const edge = [
    [218, 446],
    [210, 352],
    [235, 306],
    [310, 275],
    [485, 235],
    [545, 218],
    [757, 218],
    [872, 244],
    [1062, 280],
    [1114, 326],
    [1126, 449],
  ].map((q) => at(...q));
  const screens = [
    [393, 370, 160, 111],
    [654, 328, 135, 103],
    [654, 436, 135, 92],
    [953, 373, 158, 110],
  ];
  const holes = screens.map(([u, v, w, h]) => rect(px(u), py(v), w * k, h * k, z));
  holes.push(rect(px(534), py(300), 0.065, 0.053, z));
  sheet(d, edge, face, [0, 0, -1], holes);
  sheet(
    d,
    edge.map((q) => [q[0], q[1], q[2] + 0.14]),
    black,
    [0, 0, 1],
  );
  outline(d, edge.slice(1, 11), 0.026, m.dark, false);
  // The deep coaming joins the panel arch to the forward windshield sill, concealing
  // the inside of the nose without blocking the pilot's horizontal sightline.
  for (const side of [-1, 1])
    quad(
      d,
      [0, 2.284, 5.28],
      [side * 0.7, 2.18, 5.28],
      [side * 0.7, 2.3, 5.84],
      [0, 2.456, 5.84],
      m.dark,
      [0, 1, 0],
    );
  d.box([1.46, 0.14, 0.026], [0, 1.81, z - 0.006], face);
  for (const side of [-1, 1]) d.box([0.59, 0.07, 0.026], [side * 0.44, 1.9, z - 0.006], face);
  const sources = {};
  for (const [name, component, path] of [
    ['trueAirspeed', 'aircraftState', ['airspeed']],
    ['altitude', 'transform', ['pos', 1]],
    ['yaw', 'aircraftState', ['yaw']],
    ['roll', 'aircraftState', ['roll']],
    ['pitch', 'aircraftState', ['pitch']],
    ['verticalSpeed', 'aircraftState', ['verticalSpeed']],
    ['flapPosition', 'aircraftState', ['flapPosition']],
    ['power', 'aircraftInput', ['power']],
    ['pitchInput', 'aircraftInput', ['pitch']],
    ['rollInput', 'aircraftInput', ['roll']],
    ['yawInput', 'aircraftInput', ['yaw']],
    ['engine1', 'aircraftState', ['engines', 'engine-1', 'rpm']],
    ['engine2', 'aircraftState', ['engines', 'engine-2', 'rpm']],
  ])
    sources[name] = { component, path };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * Math.PI] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    rpm1: { op: 'multiply', args: ['engine1', 100] },
    rpm2: { op: 'multiply', args: ['engine2', 100] },
  });
  for (const [i, [u, v, w, h]] of screens.entries()) {
    const x = px(u),
      y = py(v),
      sw = w * k,
      sh = h * k;
    sheet(
      d,
      rect(x, y, sw + 0.025, sh + 0.025, z - 0.004),
      m.dark,
      [0, 0, -1],
      [rect(x, y, sw, sh, z - 0.004)],
    );
    for (const side of [-1, 1]) {
      pt.knob(x + side * (sw / 2 + 0.008), y - sh / 2 - 0.006, z - 0.017, 0.008);
      for (let j = 0; j < 7; j++)
        d.box(
          [0.006, 0.004, 0.004],
          [x + side * (sw / 2 + 0.008), y + sh * 0.38 - j * sh * 0.11, z - 0.015],
          ink,
        );
    }
    if (i === 0 || i === 3) {
      const hx = x - 0.012,
        hy = y + 0.018;
      sheet(
        d,
        rect(x, y, sw, sh, z + 0.006),
        black,
        [0, 0, -1],
        [rect(hx, hy, 0.12, 0.085, z + 0.006)],
      );
      ins.horizon(`PFD-${i}-attitude`, [hx, hy, z + 0.011], 0.12, 0.085, { blankBackdrop: true });
      ins.readout(`PFD-${i}-speed`, [x + 0.098, hy, z - 0.009], 'knots', 3, 0.01, ink, false, true);
      ins.readout(
        `PFD-${i}-altitude`,
        [x - 0.091, hy, z - 0.009],
        'feet',
        5,
        0.007,
        ink,
        true,
        true,
      );
      d.text('TAS', [x + 0.097, y + 0.067, z - 0.012], 0.0045, Math.PI, ink);
      d.text('GEO FT', [x - 0.09, y + 0.067, z - 0.012], 0.004, Math.PI, ink);
      ins.dial(
        `PFD-${i}-VSI`,
        [x + 0.096, y - 0.048, z - 0.015],
        0.02,
        'verticalFpm',
        [
          [-3000, -2.2],
          [0, 0],
          [3000, 2.2],
        ],
        [-3000, 0, 3000],
        'VSI',
      );
      d.text('SIM ATT', [hx, y + 0.074, z - 0.012], 0.004, Math.PI, ink);
      const rose = group(cabin, `TwinOtter-PFD-${i}-rose`, [hx, y - 0.047, z - 0.015]),
        rd = detailKit(rose, rose.name);
      for (let deg = 0; deg < 360; deg += 30) {
        const a = (deg * Math.PI) / 180,
          p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
        rd.rod(p(0.019), p(0.025), 0.0007, ink);
        if (deg % 90 === 0) rd.text(['N', 'E', 'S', 'W'][deg / 90], p(0.014), 0.004, Math.PI, ink);
      }
      rd.finish();
      bindings.push({
        node: rose.name,
        source: 'trueHeading',
        property: 'rotation',
        axis: 'z',
        scale: -1,
        period: 2 * Math.PI,
        responseSeconds: 0.15,
      });
      ins.available(`PFD-${i}-heading`, 'trueHeading', rose.name);
      d.text('TRUE', [hx, y - 0.08, z - 0.016], 0.004, Math.PI, ink);
    } else {
      sheet(d, rect(x, y, sw, sh, z + 0.005), black, [0, 0, -1]);
      if (i === 1) {
        d.text('NAV DATA', [x, y + 0.03, z - 0.01], 0.013, Math.PI, ink);
        d.text('UNAVAILABLE', [x, y, z - 0.01], 0.011, Math.PI, ink);
        d.text('COM --  NAV --', [x, y - 0.045, z - 0.01], 0.008, Math.PI, ink);
      } else {
        for (const [j, dx] of [0.046, -0.046].entries())
          ins.dial(
            `engine-${j}-indicator`,
            [x + dx, y + 0.015, z - 0.012],
            0.029,
            `rpm${j + 1}`,
            [
              [0, -2.3],
              [100, 2.3],
            ],
            [0, 50, 100],
            'RPM %',
          );
        d.text('TRQ -- ITT -- NG --', [x, y - 0.036, z - 0.014], 0.006, Math.PI, ink);
        d.text('FUEL -- OIL --', [x, y - 0.052, z - 0.014], 0.006, Math.PI, ink);
      }
    }
  }
  ins.horizon('standby-attitude', at(534, 300, 0.012), 0.065, 0.053, { blankBackdrop: true });
  ins.dial(
    'standby-heading',
    at(782, 301, -0.014),
    0.027,
    'degreesTrue',
    [
      [0, 0],
      [360, Math.PI * 2],
    ],
    [0, 90, 180, 270],
    'TRUE',
    { period: 2 * Math.PI },
  );
  // Upper AFCS/fire controls, dual audio controllers, two electrical sub-panels.
  for (const [u, v, w, h, label] of [
    [650, 245, 148, 31, 'AFCS'],
    [440, 290, 95, 29, 'AUDIO'],
    [877, 290, 96, 29, 'AUDIO'],
  ]) {
    d.box([w * k, h * k, 0.014], at(u, v, -0.014), black);
    for (let j = 0; j < 8; j++) {
      pt.knob(px(u - w * 0.39 + j * w * 0.11), py(v), z - 0.029, 0.0035);
      d.box([0.008, 0.003, 0.004], at(u - w * 0.39 + j * w * 0.11, v - 7, -0.027), ink);
    }
    d.text(label, at(u, v + 10, -0.029), 0.0045, Math.PI, ink);
  }
  for (const u of [549, 768]) {
    d.box([0.034, 0.031, 0.012], at(u, 244, -0.015), m.accent);
    d.text('FIRE', at(u, 244, -0.022), 0.007, Math.PI, ink);
  }
  for (const [u0, label] of [
    [428, 'ELECTRICAL'],
    [880, 'ENVIRONMENT'],
  ]) {
    d.text(label, at(u0, 477, -0.027), 0.008, Math.PI, ink);
    for (let j = 0; j < 10; j++) {
      const u = u0 - 85 + j * 19;
      d.rod(at(u, 503, -0.024), at(u, 495, -0.04), 0.0028, m.metal);
      d.text(['GEN', 'BAT', 'BUS', 'LTS', 'EXT'][j % 5], at(u, 487, -0.025), 0.0038, Math.PI, ink);
    }
  }
  for (const u of [507, 561, 782]) {
    d.box([0.034, 0.037, 0.012], at(u, 354, -0.012), black);
    pt.knob(px(u), py(351), z - 0.028, 0.006);
  }
  // Common pitch column with split ram-horn wheels, photographed geometry rather than two sticks.
  const column = group(cabin, 'TwinOtter-column', [0, 1.35, 4.55]),
    cd = detailKit(column, column.name);
  cd.rod([0, 0, 0], [0, 0.32, 0], 0.055, m.metal);
  for (const side of [-1, 1]) {
    cd.rod([0, 0.32, 0], [side * 0.47, 0.55, 0.04], 0.041, liner);
    const g = group(column, `TwinOtter-yoke-${side}`, [side * 0.47, 0.55, 0.01]),
      gd = detailKit(g, g.name);
    outline(
      gd,
      [
        [-0.17, 0.12, 0],
        [-0.18, -0.02, 0],
        [-0.12, -0.055, 0],
        [0, 0.045, 0],
        [0.12, -0.055, 0],
        [0.18, -0.02, 0],
        [0.17, 0.12, 0],
      ],
      0.018,
      liner,
      false,
    );
    for (const sign of [-1, 1]) {
      gd.rod([sign * 0.17, 0.01, -0.005], [sign * 0.17, 0.13, -0.005], 0.018, m.dark);
      gd.box([0.027, 0.016, 0.018], [sign * 0.17, 0.145, -0.008], m.metal);
    }
    ellipsoid(gd, [0, 0.045, -0.015], [0.032, 0.032, 0.021], m.metal, 12);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'rollInput',
      property: 'rotation',
      axis: 'z',
      scale: 0.65,
    });
  }
  cd.finish();
  bindings.push({
    node: column.name,
    source: 'pitchInput',
    property: 'rotation',
    axis: 'x',
    scale: -0.12,
  });
  const ped = group(cabin, 'TwinOtter-pedestal', [0, 1.65, 4.9]);
  ped.rotation.x = 0.5;
  const pd = detailKit(ped, ped.name);
  beveledBox(pd, [0.22, 0.32, 0.16], [0, 0, 0], face);
  pd.box([0.19, 0.18, 0.012], [0, 0.05, -0.09], black);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 8; c++)
      pd.box([0.014, 0.012, 0.004], [-0.078 + c * 0.022, 0.12 - r * 0.03, -0.099], m.dark);
  for (const side of [-1, 1]) {
    pd.box([0.07, 0.5, 0.035], [side * 0.08, -0.39, 0.025], black);
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 3; c++)
        ellipsoid(
          pd,
          [side * 0.08 - 0.02 + c * 0.02, -0.18 - r * 0.045, 0],
          [0.004, 0.004, 0.004],
          ink,
          5,
        );
  }
  pd.finish();
  // Paired power/propeller/condition levers remain overhead. Series 400 switches
  // moved to lower panel; the old crowded overhead switchboard is deliberately absent.
  const oh = group(cabin, 'TwinOtter-overhead', [0, 2.88, 4.55]);
  oh.rotation.x = -Math.PI / 2;
  const od = detailKit(oh, oh.name);
  beveledBox(od, [0.34, 0.46, 0.055], [0, 0, 0], liner);
  for (const [i, x, col, source] of [
    [0, 0.12, m.dark, 'power'],
    [1, 0.07, m.dark, 'power'],
    [2, 0.025, metalColor(), null],
    [3, -0.025, metalColor(), null],
    [4, -0.07, m.accent, null],
    [5, -0.12, m.accent, null],
  ]) {
    od.box([0.012, 0.29, 0.006], [x, 0, -0.031], black);
    const g = group(oh, `TwinOtter-overhead-lever-${i}`, [x, 0, -0.035]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.03, -0.11], 0.007, m.metal);
    beveledBox(dd, [0.038, 0.047, 0.027], [0, 0.03, -0.12], col);
    dd.finish();
    if (source)
      bindings.push({ node: g.name, source, property: 'rotation', axis: 'x', scale: 0.65 });
  }
  od.text('POWER PROP COND', [0, 0.18, -0.04], 0.012, Math.PI, black);
  od.finish();
  function metalColor() {
    return m.metal;
  }
  // Floor, two pilot seats, belts, pedals, side door trim and 19-seat utility cabin.
  d.box([1.68, 0.035, 6.15], [0, 1.04, 1.5], m.dark);
  for (const side of [-1, 1]) {
    d.box([0.025, 0.28, 1.15], [side * 0.88, 1.36, 4.46], liner);
    d.rod([side * 0.84, 1.66, 4.75], [side * 0.84, 1.66, 4.23], 0.019, m.dark);
    for (const off of [-0.105, 0.105]) {
      const pedal = group(cabin, `TwinOtter-pedal-${side}-${off < 0 ? 'a' : 'b'}`, [
          side * 0.43 + off,
          1.18,
          5.18,
        ]),
        dd = detailKit(pedal, pedal.name);
      dd.box([0.16, 0.12, 0.035], [0, 0, 0], m.metal);
      for (let j = 0; j < 5; j++)
        dd.rod([-0.07, -0.04 + j * 0.02, -0.02], [0.07, -0.04 + j * 0.02, -0.02], 0.003, m.dark);
      dd.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: off < 0 ? -0.04 : 0.04,
      });
    }
  }
  const seats = [
    [0.43, 4.22],
    [-0.43, 4.22],
  ];
  for (let row = 0; row < 6; row++) {
    seats.push([0.58, 3.15 - row * 0.79], [-0.22, 3.15 - row * 0.79], [-0.66, 3.15 - row * 0.79]);
  }
  seats.push([0.58, -1.6]);
  seats.forEach(([x, zz], i) => {
    const pilot = i < 2,
      w = pilot ? 0.44 : 0.39;
    beveledBox(d, [w, 0.11, 0.42], [x, 1.38, zz], seat, 0.035);
    beveledBox(d, [w, 0.54, 0.12], [x, 1.7, zz - 0.19], seat, 0.04);
    beveledBox(d, [w * 0.7, 0.17, 0.13], [x, 2.02, zz - 0.19], seat, 0.035);
    for (const sign of [-1, 1])
      d.rod([x + sign * w * 0.38, 1.07, zz], [x + sign * w * 0.38, 1.34, zz], 0.017, m.metal);
    d.rod([x - w * 0.38, 1.45, zz - 0.14], [x + w * 0.36, 1.45, zz + 0.13], 0.012, liner);
    d.box([0.04, 0.013, 0.03], [x + 0.04, 1.465, zz + 0.04], m.metal);
  });
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
