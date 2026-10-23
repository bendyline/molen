/** D18S low-cabin Twin Beech. Dimensioned Beech Specification 131 and
 * Art Mills / Paul Matt's earlier Model 18 three-view, checked against Smithsonian N522B photographs. */
import { beech18Cockpit } from './beech-18-cockpit.mjs';
import {
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

const angle = (12.283 * Math.PI) / 180,
  offset = -0.613,
  ppm = 1380 / 10.41;
const pose = (p) =>
  new T.Vector3(...p)
    .applyAxisAngle(new T.Vector3(1, 0, 0), -angle)
    .add(new T.Vector3(0, offset, 0))
    .toArray();
const zz = (u) => 5.205 - (u - 190) / ppm,
  yy = (v) => (1260 - v) / ppm;
export const beech18Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 0.71,
  cy: 1.95,
  ry: 0.78,
  cabinZ: pose([0.34, 2.75, 3.1])[2],
  cabinWidth: 1.31,
  eye: pose([0.34, 2.75, 3.1]),
  panelZ: pose([0, 2, 3.55])[2],
  floor: 1.19,
});
function radial(parent, side, m) {
  const engine = group(parent, `engine-${side === 1 ? 1 : 2}`, [side * 1.9685, 1.584, 4.0]),
    d = detailKit(engine, `Beech18-engine-${side}`);
  const rings = [
    [0.22, 0.56],
    [0.13, 0.64],
    [-0.2, 0.665],
    [-0.69, 0.64],
    [-0.78, 0.6],
  ].map(([z, r]) => ({
    z,
    points: Array.from({ length: 32 }, (_, j) => [
      r * Math.sin((j * Math.PI) / 16),
      r * Math.cos((j * Math.PI) / 16),
    ]),
  }));
  loft(d, rings, m.blue, { caps: false });
  const outer = rings[0].points.map((q) => [...q, 0.22]),
    inner = outer.map((q) => [q[0] * 0.84, q[1] * 0.84, q[2]]);
  sheet(d, outer, m.metal, [0, 0, 1], [inner]);
  for (let j = 0; j < 32; j++)
    quad(
      d,
      inner[j],
      inner[(j + 1) % 32],
      [inner[(j + 1) % 32][0], inner[(j + 1) % 32][1], -0.12],
      [inner[j][0], inner[j][1], -0.12],
      m.dark,
      [0, 0, 1],
    );
  d.add(new T.CircleGeometry(0.55, 32), m.dark, [0, 0, -0.17]);
  ellipsoid(d, [0, 0, 0.12], [0.21, 0.21, 0.17], m.metal, 20);
  for (let j = 0; j < 9; j++) {
    const g = group(engine, `Beech18-cylinder-${side}-${j}`);
    g.rotation.z = (j * 2 * Math.PI) / 9;
    const cd = detailKit(g, g.name);
    cd.add(new T.CylinderGeometry(0.09, 0.085, 0.25, 12), m.dark, [0, 0.35, 0]);
    for (let y = 0.24; y < 0.49; y += 0.027)
      cd.add(new T.CylinderGeometry(0.105, 0.105, 0.008, 12), m.metal, [0, y, 0]);
    for (const a of [-1, 1]) cd.rod([a * 0.07, 0.15, 0.18], [a * 0.05, 0.45, 0.1], 0.012, m.metal);
    cd.finish();
  }
  for (const r of rings.slice(1, -1))
    outline(
      d,
      r.points.map((q) => [...q, r.z]),
      0.0018,
      m.metal,
    );
  for (let j = 0; j < 24; j++) {
    const a = (j * Math.PI) / 12;
    d.add(new T.SphereGeometry(0.003, 5, 3), m.metal, [
      0.646 * Math.sin(a),
      0.646 * Math.cos(a),
      -0.67,
    ]);
  }
  ellipsoid(d, [0, -0.61, -0.53], [0.15, 0.1, 0.26], m.blue, 14);
  d.rod([side * 0.39, -0.43, -0.7], [side * 0.52, -0.62, -1], 0.059, m.metal);
  d.add(new T.CircleGeometry(0.053, 16).rotateY(side * 0.4), m.dark, [side * 0.52, -0.62, -1.005]);
  d.finish();
  const prop = group(engine, `Beech18-propeller-${side}`, [0, 0, 0.43]),
    pd = detailKit(prop, prop.name);
  ellipsoid(pd, [0, 0, 0.05], [0.15, 0.15, 0.14], m.metal, 20);
  for (const sign of [-1, 1]) {
    const g = group(prop, `Beech18-blade-${side}-${sign}`);
    g.rotation.z = (sign === 1 ? 0 : Math.PI) + 0.6;
    const bd = detailKit(g, g.name),
      pts = [
        [0.13, -0.06, 0],
        [0.38, -0.11, 0.02],
        [1.16, -0.09, 0],
        [1.279, -0.04, -0.01],
        [1.295, 0, -0.01],
        [1.279, 0.04, -0.01],
        [1.16, 0.09, 0],
        [0.38, 0.11, -0.02],
        [0.13, 0.06, 0],
      ];
    sheet(bd, pts, m.metal, [0, 0, 1]);
    sheet(
      bd,
      pts.map((q) => [q[0], q[1], q[2] - 0.018]),
      m.dark,
      [0, 0, -1],
    );
    bd.box([0.075, 0.12, 0.02], [1.22, 0, 0], m.white);
    bd.finish();
  }
  pd.finish();
  return prop;
}
export function buildBeech18(s) {
  const root = new T.Group();
  root.name = s.slug;
  const body = group(root, 'Beech18-airframe'),
    m = {
      white: mat('Beech18-ivory', '#e4e4da', { side: T.DoubleSide }),
      blue: mat('Beech18-blue', '#214453', { side: T.DoubleSide }),
      dark: mat('Beech18-dark', '#222a2b', { side: T.DoubleSide }),
      metal: mat('Beech18-alloy', '#aeb7b6', { metalness: 0.75 }),
      rubber: mat('Beech18-tyre', '#1a1e20'),
    },
    glass = mat('Beech18-glass', '#a5bdc5', {
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.14,
    }),
    d = detailKit(body, 'Beech18-shell'),
    bindings = [];
  // All stations are authored for the low-cabin D18S, not the taller E18S.
  const stations = [
    [190, 0.02, 1024, 1021],
    [215, 0.28, 1067, 988],
    [280, 0.49, 1090, 956],
    [365, 0.62, 1101, 940],
    [455, 0.69, 1103, 894],
    [535, 0.71, 1100, 881],
    [735, 0.7, 1114, 881],
    [865, 0.65, 1092, 880],
    [970, 0.57, 1065, 884],
    [1150, 0.39, 1018, 893],
    [1350, 0.2, 974, 902],
    [1460, 0.08, 950, 907],
    [1480, 0.015, 926, 914],
  ].map(([u, w, b, t]) => [zz(u), w, yy(b), yy(t)]);
  body.rotation.x = -angle;
  body.position.y = offset;
  const rings = stations.map(([z, w, b, t]) => {
      const r = Math.min(0.22, w * 0.7);
      return {
        z,
        points: [
          [0, t],
          [w - r, t],
          [w - r * 0.293, t - r * 0.293],
          [w, t - r],
          [w, b + r],
          [w - r * 0.293, b + r * 0.293],
          [w - r, b],
          [0, b],
          [-w + r, b],
          [-w + r * 0.293, b + r * 0.293],
          [-w, b + r],
          [-w, t - r],
          [-w + r * 0.293, t - r * 0.293],
          [-w + r, t],
        ],
      };
    }),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, m.white, {
    skip: (i, j) =>
      (i === 3 && [0, 1, 12, 13].includes(j)) || (i >= 3 && i <= 8 && [2, 3, 10, 11].includes(j)),
  });
  for (const j of [0, 1, 12, 13])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 14), p(3, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [0, 2, 12]) d.rod(p(3, j), p(4, j), 0.018, m.blue);
  for (const i of [3, 4])
    outline(d, [p(i, 12), p(i, 13), p(i, 0), p(i, 1), p(i, 2)], 0.016, m.white, false);
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
      window = (z, y, w, h) =>
        [
          [-w / 2, -h / 2],
          [-w / 2 + 0.055, -h / 2],
          [w / 2 - 0.055, -h / 2],
          [w / 2, -h / 2 + 0.055],
          [w / 2, h / 2 - 0.055],
          [w / 2 - 0.055, h / 2],
          [-w / 2 + 0.055, h / 2],
          [-w / 2, h / 2 - 0.055],
        ].map(([a, b]) => pt(z + a, y + b));
    const holes = [
      [
        [371, 941],
        [450, 897],
        [450, 960],
        [406, 963],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      [
        [462, 897],
        [531, 897],
        [531, 963],
        [461, 963],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      window(zz(595), yy(951), 0.49, 0.25),
      window(zz(703), yy(951), 0.49, 0.25),
      window(zz(815), yy(950), 0.49, 0.25),
      window(zz(911), yy(952), 0.23, 0.23),
      window(zz(1018), yy(944), 0.21, 0.21),
    ];
    sheet(
      d,
      [
        ...[3, 4, 5, 6, 7, 8, 9].map((i) => p(i, side > 0 ? 2 : 12)),
        ...[9, 8, 7, 6, 5, 4, 3].map((i) => p(i, side > 0 ? 4 : 10)),
      ],
      m.white,
      [side, 0, 0],
      holes,
    );
    for (const h of holes) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.008, m.blue);
    }
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1];
      quad(
        d,
        pt(a[0], a[2] + 0.25, 0.004),
        pt(b[0], b[2] + 0.25, 0.004),
        pt(b[0], b[2] + 0.38, 0.004),
        pt(a[0], a[2] + 0.38, 0.004),
        m.blue,
        [side, 0, 0],
      );
    }
    outline(
      d,
      [
        [zz(458), 2.8],
        [zz(538), 2.8],
        [zz(538), 1.3],
        [zz(458), 1.3],
      ].map(([z, y]) => pt(z, y, 0.003)),
      0.0022,
      m.dark,
    );
    d.rod(pt(zz(475), 2.16, 0.015), pt(zz(491), 2.16, 0.015), 0.011, m.metal);
    for (const z of [4.65, 3.7, 2.7, 1.8, 0.8, -0.2, -1.2, -2.2, -3.2]) {
      const b = sample(z, 2),
        t = sample(z, 3);
      for (let y = b + 0.08; y < t - 0.18; y += 0.09)
        d.add(new T.SphereGeometry(0.0028, 5, 3), m.metal, pt(z, y, 0.005));
    }
    for (const z of [4.7, 4.25, 3.27, -2, -3.3]) {
      const i = stations.findIndex((a) => a[0] === z);
      if (i >= 0)
        outline(
          d,
          rings[i].points.map((q) => [...q, z]),
          0.0014,
          m.metal,
        );
    }
    const decal = group(body, `Beech18-decal-${side}`, [side * 0.4, 2.29, -2]);
    decal.rotation.y = (side * Math.PI) / 2;
    const dd = detailKit(decal, decal.name);
    dd.text('D 18 S', [0, 0, 0], 0.11, 0, m.blue);
    dd.finish();
  }
  // Taper and six-degree dihedral checked against the manufacturer's wing dimensions.
  const span = 14.5288,
    wy = (x) => 1.43 + Math.tan(Math.PI / 30) * Math.max(0, x - 1.9685),
    lead = (x) => 3.4 - x * 0.205,
    trail = (x) => -0.032 + x * 0.12;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.62, wy(0.62), lead(0.62), trail(0.62), 0.26],
        [side * 1.8, wy(1.8), lead(1.8), trail(1.8), 0.23],
        [side * 3.43, wy(3.43), lead(3.43), trail(3.43) + 0.42, 0.18],
        [side * 6.95, wy(6.95), lead(6.95), trail(6.95) + 0.3, 0.08],
        [side * 7.17, wy(7.17), 1.8, 0.89, 0.06],
        [(side * span) / 2, wy(span / 2), 1.48, 1.11, 0.025],
      ],
      m.white,
    );
    // Split flaps sit under the original trailing edge, as on the D18S.
    for (const [kind, a, b] of [
      ['flap', 0.74, 3.42],
      ['aileron', 3.48, 6.93],
    ]) {
      const g = group(body, `Beech18-${kind}-${side}`, [side * a, wy(a) - 0.03, trail(a) + 0.42]),
        cd = detailKit(g, g.name);
      wing(
        cd,
        [
          [0, 0, 0, -0.42, 0.015],
          [side * (b - a), wy(b) - wy(a), trail(b) - trail(a), trail(b) - trail(a) - 0.3, 0.012],
        ],
        m.blue,
      );
      for (let x = a + 0.12; x < b; x += 0.14)
        cd.rod(
          [side * (x - a), wy(x) - wy(a), trail(x) - trail(a) - 0.04],
          [side * (x - a), wy(x) - wy(a), trail(x) - trail(a) - 0.29],
          0.0018,
          m.metal,
        );
      cd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : side === 1 ? 'aileronL' : 'aileronR',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -Math.PI / 4 : 1,
      });
    }
    for (let x = 2.1; x < 6.8; x += 0.5)
      for (let t = 0.25; t < 0.8; t += 0.15)
        d.add(new T.SphereGeometry(0.0028, 5, 3), m.metal, [
          side * x,
          wy(x) + (0.23 - (x - 1.8) * 0.028) * (1 - (t - 0.25)),
          lead(x) - (lead(x) - trail(x)) * t,
        ]);
    ellipsoid(d, [side * 7.2, wy(7.2), 1.29], [0.04, 0.04, 0.07], side === 1 ? d.red : d.green, 8);
    // Long streamlined engine nacelles and partially exposed retractable main wheels.
    const ng = group(body, `Beech18-nacelle-${side}`, [side * 1.9685, 1.584, 0]),
      nd = detailKit(ng, ng.name);
    loft(
      nd,
      [
        [3.25, 0.6, 0.57],
        [2.7, 0.6, 0.62],
        [2.1, 0.46, 0.55],
        [1.55, 0.22, 0.34],
        [1.25, 0.025, 0.06],
      ].map(([z, w, h]) => ({
        z,
        points: Array.from({ length: 24 }, (_, j) => [
          w * Math.sin((j * Math.PI) / 12),
          h * Math.cos((j * Math.PI) / 12),
        ]),
      })),
      m.white,
    );
    nd.finish();
    const gear = group(body, `Beech18-main-gear-${side}`, [side * 1.9685, 0.94, 2.84]),
      gd = detailKit(gear, gear.name);
    for (const sign of [-1, 1]) {
      gd.rod([sign * 0.14, 0, 0], [sign * 0.14, -0.55, 0.08], 0.041, m.metal);
      gd.rod([sign * 0.14, -0.15, -0.48], [sign * 0.14, -0.52, 0.08], 0.025, m.metal);
    }
    gd.add(
      new T.CylinderGeometry(0.35, 0.35, 0.25, 28).rotateZ(Math.PI / 2),
      m.rubber,
      [0, -0.57, 0.08],
    );
    for (const sign of [-1, 1])
      gd.add(new T.CircleGeometry(0.18, 24).rotateY((sign * Math.PI) / 2), m.metal, [
        sign * 0.127,
        -0.57,
        0.08,
      ]);
    gd.finish();
    bindings.push({
      node: gear.name,
      source: 'gearPosition',
      property: 'rotation',
      axis: 'x',
      scale: 1.32,
      offset: -1.32,
    });
    // Rounded twin fins, outboard rudders and full-span horizontal stabilizer.
    wing(
      d,
      [
        [side * 0.07, 2.6, -3.43, -4.56, 0.08],
        [side * 1.9, 2.6, -3.51, -4.56, 0.06],
        [side * 2.286, 2.6, -3.77, -4.56, 0.03],
      ],
      m.white,
    );
    const eg = group(body, `Beech18-elevator-${side}`, [side * 0.07, 2.6, -4.56]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.645, 0.025],
        [side * 1.83, 0, 0, -0.6, 0.025],
        [side * 2.216, 0, 0, -0.41, 0.015],
      ],
      m.blue,
    );
    for (let x = 0.15; x < 2.1; x += 0.14)
      ed.rod([side * x, 0.025, -0.06], [side * x, 0.01, -0.52], 0.002, m.metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'elevatorAngle',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const solid = (dd, pts, mat) => {
      for (const a of [-1, 1])
        sheet(
          dd,
          pts.map(([zz, yy]) => [a * 0.036, yy, zz]),
          mat,
          [a, 0, 0],
        );
      for (let j = 0; j < pts.length; j++) {
        const a = pts[j],
          b = pts[(j + 1) % pts.length];
        quad(
          dd,
          [-0.036, a[1], a[0]],
          [0.036, a[1], a[0]],
          [0.036, b[1], b[0]],
          [-0.036, b[1], b[0]],
          mat,
          [0, 1, 0],
        );
      }
    };
    const fg = group(body, `Beech18-fin-${side}`, [side * 2.27, 0, 0]),
      fd = detailKit(fg, fg.name);
    solid(
      fd,
      [
        [1395, 916],
        [1404, 850],
        [1421, 802],
        [1450, 776],
        [1488, 769],
        [1490, 987],
        [1456, 979],
        [1420, 951],
      ].map(([u, v]) => [zz(u), yy(v)]),
      m.white,
    );
    fd.finish();
    const rg = group(body, `Beech18-rudder-${side}`, [side * 2.27, yy(987), zz(1490)]),
      rd = detailKit(rg, rg.name);
    solid(
      rd,
      [
        [1490, 987],
        [1490, 769],
        [1520, 781],
        [1543, 813],
        [1561, 858],
        [1567, 912],
        [1558, 953],
        [1533, 980],
      ].map(([u, v]) => [zz(u) - zz(1490), yy(v) - yy(987)]),
      m.blue,
    );
    for (let yy = 0.15; yy < 1.5; yy += 0.14)
      rd.rod([0.041, yy, -0.03], [0.041, yy, -0.29], 0.0018, m.metal);
    rd.finish();
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.4363,
    });
  }
  const tail = group(body, 'Beech18-tail-gear', [0, 2.205, -4.04]),
    td = detailKit(tail, tail.name);
  td.rod([0, 0.12, 0.1], [0, -0.3, 0], 0.03, m.metal);
  for (const sign of [-1, 1])
    td.rod([sign * 0.065, -0.24, 0], [sign * 0.065, -0.46, -0.13], 0.024, m.metal);
  td.add(
    new T.CylinderGeometry(0.18, 0.18, 0.12, 20).rotateZ(Math.PI / 2),
    m.rubber,
    [0, -0.47, -0.13],
  );
  td.finish();
  bindings.push({
    node: tail.name,
    source: 'gearPosition',
    property: 'rotation',
    axis: 'x',
    scale: -1.2,
    offset: 1.2,
  });
  const props = [radial(body, 1, m), radial(body, -1, m)];
  d.rod([0, 2.83, 2.75], [0, 3.1, 2.75], 0.012, m.metal);
  d.rod([0, 3.1, 2.75], [0, 3.1, 2.3], 0.008, m.dark);
  d.rod([0, 2.76, -0.9], [0, 2.98, -1], 0.01, m.metal);
  d.rod([0, 2.98, -1], [0, 2.52, -4.1], 0.0018, m.dark);
  for (const side of [-1, 1]) {
    d.rod([side * 0.03, 2.46, 3.86], [side * 0.4, 2.67, 3.51], 0.009, m.dark);
    d.rod([side * 0.3, 2.61, 3.62], [side * 0.54, 2.73, 3.35], 0.007, m.dark);
  }
  d.finish();
  const interior = beech18Cockpit(body, m);
  body.getObjectByName('cockpit').position.set(0, 0.55, 0.55);
  cleanGeometry(root);
  return {
    root,
    frame: beech18Frame(),
    enginePoints: [
      { id: 'engine-1', position: pose([1.9685, 1.584, 4.0]) },
      { id: 'engine-2', position: pose([-1.9685, 1.584, 4.0]) },
    ],
    visual: {
      rotors: props.map((p, i) => ({
        node: p.name,
        engine: `engine-${i + 1}`,
        axis: 'z',
        multiplier: 1,
      })),
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
