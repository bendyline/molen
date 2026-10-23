/** Original DHC-2 Mk.I landplane, PSM 1-2-1 Fig 1-3/1-4/1-10.
 * Dimensions/contours are reference-authored; no photograph textures.
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

const angle = Math.atan2(54, 325),
  ppm = 444 / 9.2456,
  zz = (u) => 4.6228 - (u - 461) / ppm,
  yy = (v) => (1306 - v) / ppm,
  groundOffset = -Math.sin(angle) * zz(543);
const pose = (p) =>
  new T.Vector3(...p)
    .applyAxisAngle(new T.Vector3(1, 0, 0), -angle)
    .add(new T.Vector3(0, groundOffset, 0))
    .toArray();
export const beaverFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.75,
  cy: 1.7,
  ry: 0.9,
  cabinZ: pose([0, 2.68, 2.35])[2],
  cabinWidth: 1.4,
  eye: pose([0.34, 2.68, 2.35]),
  panelZ: pose([0, 2.1, 3.14])[2],
  floor: 1.04,
});
const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
export function buildBeaver(s) {
  const root = new T.Group();
  root.name = s.slug;
  const airframe = group(root, 'Beaver-airframe', [0, groundOffset, 0]);
  airframe.rotation.x = -angle;
  const paint = mat('Beaver-ivory', '#dfdfd5', { side: T.DoubleSide }),
    accent = mat('Beaver-burgundy', '#8b322b', { side: T.DoubleSide }),
    metal = mat('Beaver-alloy', '#a6aeae', { metalness: 0.75 }),
    dark = mat('Beaver-trim', '#252c2e', { side: T.DoubleSide }),
    rubber = mat('Beaver-tyre', '#1b2021'),
    glass = mat('Beaver-glazing', '#a8c6ce', {
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.14,
    });
  const d = detailKit(airframe, 'Beaver-shell'),
    bindings = [];
  const stations = [
    [521, 0.68, 1258, 1195],
    [531, 0.71, 1258, 1190],
    [555, 0.735, 1258, 1170],
    [576, 0.75, 1258, 1169],
    [632, 0.68, 1258, 1180],
    [660, 0.6, 1255, 1183],
    [692, 0.5, 1251, 1186],
    [753, 0.32, 1246, 1192],
    [813, 0.18, 1238, 1191],
    [866, 0.1, 1231, 1210],
    [905, 0.012, 1222, 1219],
  ].map(([u, w, b, t]) => [zz(u), w, yy(b), yy(t)]);
  const rings = stations.map(([z, w, b, t]) => {
      const h = t - b;
      return {
        z,
        points: [
          [0, t],
          [w * 0.65, t - 0.015 * h],
          [w * 0.94, t - 0.11 * h],
          [w, t - 0.26 * h],
          [w, b + 0.21 * h],
          [w * 0.8, b + 0.05 * h],
          [w * 0.4, b],
          [0, b],
          [-w * 0.4, b],
          [-w * 0.8, b + 0.05 * h],
          [-w, b + 0.21 * h],
          [-w, t - 0.26 * h],
          [-w * 0.94, t - 0.11 * h],
          [-w * 0.65, t - 0.015 * h],
        ],
      };
    }),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 1 && [0, 1, 12, 13].includes(j)) || (i >= 1 && i <= 5 && [2, 3, 10, 11].includes(j)),
  });
  for (const j of [0, 1, 12, 13])
    quad(d, p(1, j), p(2, j), p(2, (j + 1) % 14), p(1, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [0, 2, 12]) d.rod(p(1, j), p(2, j), 0.018, dark);
  for (const i of [1, 2])
    outline(d, [p(i, 12), p(i, 13), p(i, 0), p(i, 1), p(i, 2)], 0.018, paint, false);
  const sample = (z, k) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (z <= stations[i][0] && z >= stations[i + 1][0]) {
        const t = (stations[i][0] - z) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][k] * (1 - t) + stations[i + 1][k] * t;
      }
    return stations.at(-1)[k];
  };
  for (const side of [-1, 1]) {
    const pt = (z, y, off = 0) => [side * (sample(z, 1) + off), y, z],
      h1 = [
        [535, 1204],
        [560, 1187],
        [569, 1232],
        [541, 1234],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      h2 = [
        [586, 1211],
        [599, 1192],
        [615, 1192],
        [631, 1211],
        [630, 1238],
        [588, 1238],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      h3 = Array.from({ length: 20 }, (_, j) =>
        pt(
          zz(644) + Math.sin((j * Math.PI) / 10) * 0.135,
          yy(1197) + Math.cos((j * Math.PI) / 10) * 0.135,
        ),
      );
    const upper = side > 0 ? 2 : 12,
      lower = side > 0 ? 4 : 10;
    sheet(
      d,
      [
        ...[1, 2, 3, 4, 5, 6].map((i) => p(i, upper)),
        ...[6, 5, 4, 3, 2, 1].map((i) => p(i, lower)),
      ],
      paint,
      [side, 0, 0],
      [h1, h2, h3],
    );
    for (const h of [h1, h2, h3]) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.009, dark);
    }
    for (const a of [
      [
        [534, 1200],
        [563, 1183],
        [578, 1253],
        [538, 1255],
      ],
      [
        [582, 1187],
        [633, 1189],
        [633, 1252],
        [588, 1254],
      ],
    ])
      outline(
        d,
        a.map(([u, v]) => pt(zz(u), yy(v), 0.003)),
        0.0025,
        dark,
      );
    d.rod(pt(zz(568), yy(1239), 0.02), pt(zz(560), yy(1239), 0.02), 0.012, metal);
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1];
      quad(
        d,
        pt(a[0], a[2] + 0.12, 0.003),
        pt(b[0], b[2] + 0.12, 0.003),
        pt(b[0], b[2] + 0.28, 0.003),
        pt(a[0], a[2] + 0.28, 0.003),
        accent,
        [side, 0, 0],
      );
    }
    for (const z of [1.9, 1.1, 0.3, -0.5, -1.4, -2.3, -3.2]) {
      const b = sample(z, 2),
        t = sample(z, 3);
      d.rod(pt(z, b + 0.08, 0.003), pt(z, t - 0.2, 0.003), 0.0014, metal);
      for (let y = b + 0.13; y < t - 0.2; y += 0.095)
        d.add(new T.SphereGeometry(0.0028, 5, 3), metal, pt(z + 0.018, y, 0.005));
    }
    const label = group(airframe, `Beaver-lettering-${side}`, [side * 0.53, 1.57, -0.15]);
    label.rotation.y = (side * Math.PI) / 2;
    const ld = detailKit(label, label.name);
    ld.text('DHC 2', [0, 0, 0], 0.1, 0, accent);
    ld.finish();
    d.rod([side * 0.8, 1.05, 1.05], [side * 0.97, 0.76, 1.1], 0.02, metal);
    d.rod([side * 0.97, 0.76, 1.1], [side * 0.97, 0.76, 0.7], 0.02, metal);
    d.rod([side * 0.97, 0.76, 0.7], [side * 0.8, 1.05, 0.7], 0.02, metal);
  }
  // Open radial cowling, recessed nine-cylinder Wasp Junior, visible cooling fins and pushrods.
  const engine = group(airframe, 'engine-1', [0, 1.65, 3.96]),
    nd = detailKit(engine, 'Beaver-engine');
  const ns = [
    [0.26, 0.575],
    [0.18, 0.66],
    [-0.1, 0.68],
    [-0.64, 0.68],
    [-0.74, 0.65],
  ].map(([z, r]) => ({
    z,
    points: Array.from({ length: 32 }, (_, j) => [
      Math.sin((j * Math.PI) / 16) * r,
      Math.cos((j * Math.PI) / 16) * r,
    ]),
  }));
  loft(nd, ns, paint, { caps: false });
  const outer = ns[0].points.map((q) => [...q, 0.26]),
    inner = ns[0].points.map((q) => [q[0] * 0.83, q[1] * 0.83, 0.26]);
  sheet(nd, outer, metal, [0, 0, 1], [inner]);
  for (let j = 0; j < 32; j++)
    quad(
      nd,
      inner[j],
      inner[(j + 1) % 32],
      [inner[(j + 1) % 32][0], inner[(j + 1) % 32][1], -0.08],
      [inner[j][0], inner[j][1], -0.08],
      dark,
      [0, 0, 1],
    );
  nd.add(new T.CircleGeometry(0.56, 32), dark, [0, 0, -0.18]);
  ellipsoid(nd, [0, 0, 0.13], [0.21, 0.21, 0.18], metal, 20);
  for (let j = 0; j < 9; j++) {
    const g = group(engine, `Beaver-cylinder-${j}`);
    g.rotation.z = (j * 2 * Math.PI) / 9;
    const dd = detailKit(g, g.name);
    dd.add(new T.CylinderGeometry(0.09, 0.085, 0.25, 12), dark, [0, 0.36, 0]);
    for (let y = 0.26; y < 0.49; y += 0.025)
      dd.add(new T.CylinderGeometry(0.105, 0.105, 0.008, 12), metal, [0, y, 0]);
    dd.rod([-0.07, 0.16, 0.17], [-0.05, 0.45, 0.1], 0.012, metal);
    dd.rod([0.07, 0.16, 0.17], [0.05, 0.45, 0.1], 0.012, metal);
    dd.finish();
  }
  for (const r of ns.slice(1, -1))
    outline(
      nd,
      r.points.map((q) => [...q, r.z]),
      0.0018,
      metal,
    );
  for (let j = 0; j < 12; j++) {
    const a = (j * Math.PI) / 6;
    nd.add(new T.SphereGeometry(0.003, 5, 3), metal, [
      Math.sin(a) * 0.684,
      Math.cos(a) * 0.684,
      -0.61,
    ]);
  }
  ellipsoid(nd, [0, -0.69, -0.5], [0.23, 0.12, 0.35], accent, 14);
  nd.rod([0.29, -0.46, -0.7], [0.42, -0.69, -0.95], 0.065, metal);
  nd.add(new T.CircleGeometry(0.055, 16).rotateY(0.6), dark, [0.42, -0.69, -0.96]);
  nd.finish();
  const prop = group(engine, 'Beaver-propeller', [0, 0, 0.44]),
    pd = detailKit(prop, prop.name);
  ellipsoid(pd, [0, 0, 0.11], [0.15, 0.15, 0.24], metal, 20);
  for (const side of [-1, 1]) {
    const bg = group(prop, `Beaver-prop-blade-${side}`);
    bg.rotation.z = side === 1 ? 0.72 : 0.72 + Math.PI;
    const bd = detailKit(bg, bg.name),
      pts = [
        [0.12, -0.06, 0],
        [0.42, -0.1, 0.02],
        [1.19, -0.065, 0],
        [1.295, -0.025, 0],
        [1.295, 0.025, 0],
        [1.19, 0.065, 0],
        [0.5, 0.09, -0.02],
        [0.12, 0.06, 0],
      ];
    sheet(bd, pts, metal, [0, 0, 1]);
    sheet(
      bd,
      pts.map((q) => [q[0], q[1], q[2] - 0.018]),
      dark,
      [0, 0, -1],
    );
    bd.box([0.075, 0.1, 0.02], [1.24, 0, 0], paint);
    bd.finish();
  }
  pd.finish();
  const wy = (x) => 2.74 + Math.tan((2 * Math.PI) / 180) * Math.max(0, x - 0.73);
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.7, wy(0.7), 2.7, 1.47, 0.14],
        [side * 6.94, wy(6.94), 2.7, 1.47, 0.13],
        [side * 7.18, wy(7.18), 2.59, 1.43, 0.11],
        [side * 7.315, wy(7.315), 2.35, 1.33, 0.06],
      ],
      paint,
    );
    for (const [kind, a, b] of [
      ['flap', 0.78, 4.2],
      ['aileron', 4.24, 6.94],
    ]) {
      const g = group(airframe, `Beaver-${kind}-${side}`, [side * a, wy(a), 1.47]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, -0.42, 0.027],
          [side * (b - a), wy(b) - wy(a), 0, -0.42, 0.024],
        ],
        accent,
      );
      for (let x = a + 0.12; x < b; x += 0.13)
        dd.rod([side * (x - a), 0.02, -0.03], [side * (x - a), 0.008, -0.38], 0.002, metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : `aileron${side > 0 ? 'L' : 'R'}`,
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -0.55 : 1,
      });
    }
    for (let x = 0.95; x < 6.9; x += 0.42)
      for (let u = 0.12; u < 0.8; u += 0.13) {
        const h = 0.135 * (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) * 0.96);
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * x,
          wy(x) + h + 0.003,
          2.7 - u * 1.23,
        ]);
      }
    const a = new T.Vector3(side * 0.72, 1.02, 0.92),
      b = new T.Vector3(side * 3.0, wy(3) - 0.06, 1.98),
      v = b.clone().sub(a),
      strut = d.box([0.07, v.length(), 0.22], a.clone().addScaledVector(v, 0.5).toArray(), accent);
    strut.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    d.rod([side * 1.95, 2.1, 1.6], [side * 1.95, wy(1.95) - 0.03, 1.6], 0.015, metal);
    ellipsoid(d, [side * 7.28, wy(7.28), 1.75], [0.04, 0.04, 0.07], side > 0 ? d.red : d.green, 8);
    wing(
      d,
      [
        [side * 0.12, 1.89, -3.78, -4.23, 0.075],
        [side * 2.27, 1.89, -3.43, -4.05, 0.067],
        [side * 2.413, 1.89, -3.6, -4.05, 0.045],
      ],
      paint,
    );
    const eg = group(airframe, `Beaver-elevator-${side}`, [side * 0.12, 1.89, -4.23]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.35, 0.022],
        [side * 2.15, 0, 0.18, -0.16, 0.019],
      ],
      accent,
    );
    for (let x = 0.15; x < 2.15; x += 0.13)
      ed.rod([side * x, 0.018, 0.08 * x - 0.025], [side * x, 0.005, 0.08 * x - 0.3], 0.002, metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
  }
  const fin = [
      [-0.8, 2.38],
      [-1.8, 2.38],
      [-2.45, 2.52],
      [-2.8, 2.76],
      [-3.18, 3.36],
      [-3.45, 3.65],
      [-3.58, 3.7],
      [-3.56, 3.46],
      [-3.56, 2.1],
    ],
    solid = (dd, pts, m) => {
      for (const side of [-1, 1])
        sheet(
          dd,
          pts.map(([z, y]) => [side * 0.045, y, z]),
          m,
          [side, 0, 0],
        );
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        quad(
          dd,
          [-0.045, a[1], a[0]],
          [-0.045, b[1], b[0]],
          [0.045, b[1], b[0]],
          [0.045, a[1], a[0]],
          m,
          [0, 1, 0],
        );
      }
    };
  solid(d, fin, paint);
  const rud = group(airframe, 'Beaver-rudder', [0, 2.1, -3.56]),
    g = group(rud, 'Beaver-rudder-moving'),
    rd = detailKit(g, g.name);
  solid(
    rd,
    [
      [0, 0],
      [0, 1.36],
      [0.02, 1.59],
      [-0.12, 1.58],
      [-0.22, 1.49],
      [-0.33, 1.3],
      [-0.52, 0.76],
      [-0.73, 0.04],
    ],
    accent,
  );
  for (let y = 0.13; y < 1.45; y += 0.12)
    rd.rod([0.05, y, -0.03], [0.05, y, -(0.71 - 0.39 * y)], 0.002, metal);
  rd.finish();
  bindings.push({ node: g.name, source: 'yawInput', property: 'rotation', axis: 'y', scale: 0.42 });
  // Fixed wheel geometry is authored in flight datum, then rigidly posed against the
  // manual's sloping ground line. All three tyres meet the local ground in that stance.
  for (const side of [-1, 1]) {
    const x = side * 1.5494,
      z = zz(543),
      r = 0.292;
    const gd = detailKit(group(airframe, `Beaver-main-gear-${side}`), 'Beaver-main-gear');
    gd.rod([side * 0.64, 1.07, z - 0.08], [x, r, z], 0.12, accent);
    gd.rod([side * 0.68, 1.08, z - 0.9], [x, r + 0.05, z], 0.045, metal);
    gd.add(new T.CylinderGeometry(r, r, 0.2, 28).rotateZ(Math.PI / 2), rubber, [x, r, z]);
    for (const sign of [-1, 1]) {
      gd.add(new T.CircleGeometry(0.18, 24).rotateY((sign * Math.PI) / 2), metal, [
        x + sign * 0.102,
        r,
        z,
      ]);
      gd.add(new T.CircleGeometry(0.07, 18).rotateY((sign * Math.PI) / 2), dark, [
        x + sign * 0.104,
        r,
        z,
      ]);
    }
    gd.finish();
  }
  const tailZ = zz(869),
    tailY = (0.16 - groundOffset - Math.sin(angle) * tailZ) / Math.cos(angle),
    td = detailKit(group(airframe, 'Beaver-tailwheel'), 'Beaver-tailwheel');
  td.rod([0, yy(1235), tailZ + 0.24], [0, tailY + 0.18, tailZ], 0.038, metal);
  for (const side of [-1, 1])
    td.rod([side * 0.075, tailY + 0.2, tailZ + 0.05], [side * 0.075, tailY, tailZ], 0.019, metal);
  td.add(new T.CylinderGeometry(0.16, 0.16, 0.12, 24).rotateZ(Math.PI / 2), rubber, [
    0,
    tailY,
    tailZ,
  ]);
  td.finish();
  d.rod([0, 2.93, 2.05], [0, 3.15, 2.02], 0.014, dark);
  d.rod([0, 3.15, 2.02], [0, 3.65, -3.55], 0.002, dark);
  d.finish();
  const interior = beaverCockpit(airframe, { paint, accent, metal, dark });
  Object.assign(interior.derived, {
    aileronDroop: { op: 'multiply', args: ['flapPosition', -0.18] },
    rollLeft: { op: 'multiply', args: ['rollInput', -0.32] },
    rollRight: { op: 'multiply', args: ['rollInput', 0.32] },
    aileronL: { op: 'add', args: ['aileronDroop', 'rollLeft'] },
    aileronR: { op: 'add', args: ['aileronDroop', 'rollRight'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: beaverFrame(),
    enginePoints: [{ id: 'engine-1', position: pose([0, 1.65, 3.96]) }],
    visual: {
      rotors: [{ node: prop.name, engine: 'engine-1', axis: 'z', multiplier: 1 }],
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
function beaverCockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Beaver-cockpit'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'Beaver'),
    { bindings, derived, ink, black } = ins;
  const face = mat('Beaver-panel', '#87948e'),
    liner = mat('Beaver-liner', '#c2c1b0'),
    seat = mat('Beaver-upholstery', '#655c4f');
  const k = 0.00165,
    x = (u) => (542 - u) * k,
    y = (v) => 2.12 + (540 - v) * k,
    z = 3.14,
    at = (u, v, dz = 0) => [x(u), y(v), z + dz];
  const edge = [
    [162, 780],
    [160, 550],
    [177, 515],
    [244, 491],
    [452, 460],
    [500, 445],
    [580, 445],
    [716, 469],
    [890, 501],
    [919, 540],
    [915, 780],
  ].map((q) => at(...q));
  sheet(d, edge, face, [0, 0, -1], [rect(x(350), y(562), 0.083, 0.083, z)]);
  sheet(
    d,
    edge.map((q) => [q[0], q[1], q[2] + 0.12]),
    black,
    [0, 0, 1],
  );
  outline(d, edge.slice(1, 10), 0.021, m.dark, false);
  quad(
    d,
    [-0.62, 2.14, z],
    [0.62, 2.14, z],
    [0.65, 2.28, 3.5],
    [-0.65, 2.28, 3.5],
    m.dark,
    [0, 1, 0],
  );
  // Raised six-pack on pilot's left, blank copilot map panel, engine stack at center.
  for (const [u, v, w, h] of [
    [338, 591, 220, 172],
    [739, 595, 214, 170],
  ]) {
    sheet(
      d,
      rect(x(u), y(v), w * k, h * k, z - 0.006),
      m.dark,
      [0, 0, -1],
      u === 338 ? [rect(x(350), y(562), 0.086, 0.086, z - 0.006)] : [],
    );
    outline(d, rect(x(u), y(v), w * k + 0.008, h * k + 0.008, z - 0.008), 0.003, m.metal);
  }
  const sources = {};
  for (const [name, component, path] of [
    ['trueAirspeed', 'aircraftState', ['airspeed']],
    ['altitude', 'transform', ['pos', 1]],
    ['yaw', 'aircraftState', ['yaw']],
    ['pitch', 'aircraftState', ['pitch']],
    ['roll', 'aircraftState', ['roll']],
    ['verticalSpeed', 'aircraftState', ['verticalSpeed']],
    ['yawRate', 'aircraftState', ['yawRate']],
    ['flapPosition', 'aircraftState', ['flapPosition']],
    ['engine1', 'aircraftState', ['engines', 'engine-1', 'rpm']],
    ['pitchInput', 'aircraftInput', ['pitch']],
    ['rollInput', 'aircraftInput', ['roll']],
    ['yawInput', 'aircraftInput', ['yaw']],
    ['power', 'aircraftInput', ['power']],
  ])
    sources[name] = { component, path };
  Object.assign(derived, {
    mph: { op: 'multiply', args: ['trueAirspeed', 3600 / 1609.344] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', Math.PI * 2] },
    engineRpm: { op: 'multiply', args: ['engine1', 2300] },
    turnDegrees: { op: 'multiply', args: ['yawRate', 180 / Math.PI] },
  });
  ins.dial(
    'speed',
    at(280, 573, -0.014),
    0.046,
    'mph',
    [
      [0, 0],
      [25, 0.5],
      [50, 1.1],
      [75, 1.7],
      [100, 2.3],
      [125, 2.9],
      [150, 3.5],
      [175, 4.1],
      [200, 4.7],
      [225, 5.3],
      [250, 5.9],
    ],
    [0, 50, 100, 150, 200, 250],
    'TAS MPH',
    { responseSeconds: 0.2 },
  );
  ins.horizon('attitude', at(350, 562, 0.011), 0.083, 0.083, { round: true, blankBackdrop: true });
  d.ring(0.046, 0.003, at(350, 562, -0.014), m.metal);
  ins.dial(
    'vsi',
    at(421, 573, -0.014),
    0.044,
    'verticalFpm',
    [
      [-2000, -2.4],
      [0, 0],
      [2000, 2.4],
    ],
    [-2000, -1000, 0, 1000, 2000],
    'FT MIN',
    { responseSeconds: 0.5 },
  );
  ins.altimeter('altimeter', at(280, 640, -0.014), 0.045, 'feet');
  ins.headingDrum('heading', at(350, 640, -0.014), 0.042, 'trueHeading');
  ins.dial(
    'turn',
    at(421, 640, -0.014),
    0.043,
    'turnDegrees',
    [
      [-6, -0.6],
      [0, 0],
      [6, 0.6],
    ],
    [-3, 0, 3],
    'TURN DEG S',
    { responseSeconds: 0.2 },
  );
  d.text('SIM DATUM', at(350, 602, -0.02), 0.006, Math.PI, ink);
  // Late installation engine instrument positions, as the manual explicitly permits.
  const panel = rect(x(542), y(670), 0.255, 0.34, z - 0.012);
  sheet(d, panel, face, [0, 0, -1]);
  outline(d, panel, 0.003, m.metal);
  ins.dial(
    'rpm',
    at(576, 641, -0.026),
    0.043,
    'engineRpm',
    [
      [0, 0],
      [500, 0.9],
      [1000, 1.8],
      [1500, 2.7],
      [2000, 3.6],
      [2500, 4.5],
    ],
    [0, 500, 1000, 1500, 2000, 2500],
    'RPM',
    { responseSeconds: 0.2 },
  );
  for (const [u, v, label] of [
    [509, 641, 'MAP --'],
    [509, 704, 'OIL --'],
    [576, 704, 'FUEL --'],
    [509, 758, 'CARB --'],
    [576, 758, 'CHT --'],
  ]) {
    pt.gauge(x(u), y(v), z - 0.025, v === 758 ? 0.034 : 0.041, undefined, false);
    d.text(label, at(u, v, -0.049), 0.008, Math.PI, ink);
  }
  // Mechanical quadrant at the top of the center pedestal, not overhead.
  const q = group(cabin, 'Beaver-quadrant', [0, 2.11, 2.99]),
    qd = detailKit(q, q.name);
  beveledBox(qd, [0.26, 0.1, 0.23], [0, 0, 0], m.metal);
  for (const [i, xx, label, color, source] of [
    [0, 0.09, 'THROTTLE', black, 'power'],
    [1, 0, 'PROP', m.metal, null],
    [2, -0.09, 'MIXTURE', m.accent, null],
  ]) {
    qd.box([0.018, 0.009, 0.18], [xx, 0.056, 0], black);
    const g = group(q, `Beaver-quadrant-${i}`, [xx, 0.05, 0]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.12, 0], 0.007, m.metal);
    ellipsoid(dd, [0, 0.145, 0], [0.025, 0.035, 0.025], color, 12);
    dd.finish();
    if (source)
      bindings.push({ node: g.name, source, property: 'rotation', axis: 'x', scale: 0.65 });
    qd.text(label, [xx, 0.058, -0.08], 0.005, Math.PI, black);
    qd.add(new T.CylinderGeometry(0.018, 0.018, 0.022, 12).rotateX(Math.PI / 2), black, [
      xx,
      -0.055,
      -0.13,
    ]);
  }
  qd.finish();
  ins.pointer('flap-indicator', at(412, 485, -0.025), 0.022, 'flapPosition', [
    [0, -1.1],
    [1, 1.1],
  ]);
  d.text('FLAPS', at(412, 466, -0.026), 0.007, Math.PI, ink);
  // Radios and electrical switchboard below the copilot map storage recess.
  for (const [v, label] of [
    [711, 'COM --'],
    [737, 'NAV --'],
  ]) {
    d.box([0.31, 0.032, 0.018], at(746, v, -0.02), black);
    for (const u of [661, 827]) pt.knob(x(u), y(v), z - 0.038, 0.008);
    d.text(label, at(746, v, -0.032), 0.009, Math.PI, ink);
  }
  for (let i = 0; i < 10; i++) {
    const u = 638 + i * 25;
    d.rod(at(u, 770, -0.027), at(u, 763, -0.043), 0.003, m.metal);
    d.text(['BAT', 'GEN', 'PITOT', 'LTS', 'NAV'][i % 5], at(u, 753, -0.028), 0.0045, Math.PI, ink);
  }
  for (const [u, v, w, h, label] of [
    [229, 719, 70, 63, 'FUEL'],
    [324, 719, 95, 63, 'CHECKLIST'],
    [420, 719, 75, 63, 'IGNITION'],
  ]) {
    d.box([w * k, h * k, 0.012], at(u, v, -0.014), m.dark);
    d.text(label, at(u, v - 14, -0.025), 0.008, Math.PI, ink);
    if (label !== 'CHECKLIST') pt.knob(x(u), y(v + 5), z - 0.04, 0.018);
    else
      for (let j = 0; j < 5; j++)
        d.rod(at(u - 35, v - 4 + j * 7, -0.025), at(u + 35, v - 4 + j * 7, -0.025), 0.0008, ink);
  }
  // Throw-over column and one control wheel, neutral left seat configuration.
  const col = group(cabin, 'Beaver-column', [0, 1.16, 2.5]),
    cd = detailKit(col, col.name);
  cd.rod([0, 0, 0], [0, 0.45, 0], 0.052, m.metal);
  ellipsoid(cd, [0, 0.4, 0], [0.11, 0.2, 0.11], black, 16);
  cd.rod([0, 0.44, 0], [0.38, 0.67, 0.04], 0.047, liner);
  cd.finish();
  bindings.push({
    node: col.name,
    source: 'pitchInput',
    property: 'rotation',
    axis: 'x',
    scale: -0.14,
  });
  const wheel = group(col, 'Beaver-wheel', [0.38, 0.67, 0.02]),
    wd = detailKit(wheel, wheel.name);
  outline(
    wd,
    [
      [-0.17, 0.1, 0],
      [-0.19, 0.06, 0],
      [-0.17, -0.065, 0],
      [0.17, -0.065, 0],
      [0.19, 0.06, 0],
      [0.17, 0.1, 0],
    ],
    0.018,
    black,
    false,
  );
  wd.rod([-0.16, -0.04, 0], [0, 0, 0], 0.012, m.metal);
  wd.rod([0.16, -0.04, 0], [0, 0, 0], 0.012, m.metal);
  ellipsoid(wd, [0, 0, -0.01], [0.03, 0.03, 0.018], m.metal, 12);
  wd.finish();
  bindings.push({
    node: wheel.name,
    source: 'rollInput',
    property: 'rotation',
    axis: 'z',
    scale: 0.65,
  });
  // Roof trim handwheels, floor flap pump and oil filler are modeled as mechanical details.
  for (const x of [-0.045, 0.045])
    d.add(new T.TorusGeometry(0.058, 0.008, 6, 24).rotateY(Math.PI / 2), black, [x, 2.73, 2.28]);
  d.add(new T.TorusGeometry(0.048, 0.007, 6, 24).rotateY(Math.PI / 2), black, [0, 2.73, 2.05]);
  const pump = group(cabin, 'Beaver-flap-pump', [-0.14, 1.11, 2.2]),
    fd = detailKit(pump, pump.name);
  fd.rod([0, 0, 0], [0, 0.32, -0.18], 0.015, m.metal);
  fd.rod([-0.04, 0.32, -0.18], [0.04, 0.32, -0.18], 0.02, black);
  fd.finish();
  bindings.push({
    node: pump.name,
    source: 'flapPosition',
    property: 'rotation',
    axis: 'x',
    scale: 0.45,
  });
  d.add(new T.CylinderGeometry(0.067, 0.067, 0.06, 20), m.accent, [-0.2, 1.14, 2.65]);
  d.box([1.33, 0.035, 2.95], [0, 1.04, 1.5], m.dark);
  for (const side of [-1, 1]) {
    d.box([0.025, 0.3, 1.2], [side * 0.7, 1.4, 2.1], liner);
    d.rod([side * 0.67, 1.68, 2.6], [side * 0.67, 1.68, 2.12], 0.021, m.dark);
    for (const sign of [-1, 1]) {
      const pedal = group(cabin, `Beaver-pedal-${side}-${sign}`, [
          side * 0.33 + sign * 0.09,
          1.16,
          3.02,
        ]),
        dd = detailKit(pedal, pedal.name);
      dd.box([0.14, 0.11, 0.022], [0, 0, 0], m.metal);
      for (let j = 0; j < 4; j++)
        dd.rod(
          [-0.06, -0.035 + j * 0.022, -0.014],
          [0.06, -0.035 + j * 0.022, -0.014],
          0.0025,
          black,
        );
      dd.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: sign * 0.04,
      });
    }
  }
  for (const [x, z] of [
    [0.34, 2.1],
    [-0.34, 2.1],
    [0.34, 1.15],
    [-0.34, 1.15],
    [0.34, 0.25],
    [-0.34, 0.25],
  ]) {
    beveledBox(d, [0.48, 0.11, 0.45], [x, 1.32, z], seat, 0.04);
    beveledBox(d, [0.46, 0.6, 0.13], [x, 1.65, z - 0.2], seat, 0.04);
    for (const side of [-1, 1])
      d.rod([x + side * 0.19, 1.07, z], [x + side * 0.19, 1.28, z], 0.018, m.metal);
    d.rod([x - 0.2, 1.4, z - 0.14], [x + 0.18, 1.4, z + 0.13], 0.013, liner);
    d.box([0.05, 0.014, 0.03], [x + 0.04, 1.415, z + 0.04], m.metal);
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
