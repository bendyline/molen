/** Civilian Wright-powered DC-3; UAL DC-3/DST manual (1942 revision),
 * Boeing dimensions and Knoxville museum photographs. All positions in flight datum. */
import { dc3Cockpit } from './dc-3-cockpit.mjs';
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

const angle = (11.5 * Math.PI) / 180,
  offset = -0.821,
  ppm = 756 / 19.6469;
export const dc3Pose = (p) =>
  new T.Vector3(...p)
    .applyAxisAngle(new T.Vector3(1, 0, 0), -angle)
    .add(new T.Vector3(0, offset, 0))
    .toArray();
const zz = (u) => 9.82345 - (u - 93) / ppm,
  yy = (v) => (362 - v) / ppm;
export const dc3Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 1.24,
  cy: 3.3,
  ry: 1.32,
  cabinZ: dc3Pose([0.56, 4.4, 7.5])[2],
  cabinWidth: 2.3,
  eye: dc3Pose([0.56, 4.4, 7.5]),
  panelZ: dc3Pose([0, 3.9, 8.15])[2],
  floor: 2.18,
});
function radial(body, side, m) {
  const g = group(body, `engine-${side === 1 ? 1 : 2}`, [side * 2.8194, 2.159, 6.57]),
    d = detailKit(g, `DC3-engine-${side}`);
  const ring = (z, r) => ({
    z,
    points: Array.from({ length: 32 }, (_, i) => [
      r * Math.sin((i * Math.PI) / 16),
      r * Math.cos((i * Math.PI) / 16),
    ]),
  });
  const rings = [
    [0.26, 0.765],
    [0.12, 0.835],
    [-0.4, 0.84],
    [-0.82, 0.81],
  ].map((q) => ring(...q));
  loft(d, rings, m.metal, { caps: false });
  const outer = ring(0.262, 0.765).points.map((q) => [...q, 0.262]),
    inner = ring(0.263, 0.69).points.map((q) => [...q, 0.263]);
  sheet(d, outer, m.orange, [0, 0, 1], [inner]);
  for (let i = 0; i < 32; i++)
    quad(
      d,
      inner[i],
      inner[(i + 1) % 32],
      [inner[(i + 1) % 32][0], inner[(i + 1) % 32][1], -0.12],
      [inner[i][0], inner[i][1], -0.12],
      m.dark,
      [0, 0, 1],
    );
  // Nine exposed single-row Cyclone cylinders, paired pushrods and cooling fins.
  ellipsoid(d, [0, 0, 0.045], [0.32, 0.32, 0.27], m.engine, 20);
  for (let j = 0; j < 9; j++) {
    const a = (j * Math.PI * 2) / 9,
      p = (r) => [Math.sin(a) * r, Math.cos(a) * r, -0.02],
      c = group(g, `DC3-cylinder-${side}-${j}`, p(0.46));
    c.rotation.z = -a;
    const cd = detailKit(c, c.name);
    cd.add(new T.CylinderGeometry(0.105, 0.09, 0.35, 10), m.dark, [0, 0, 0]);
    for (let k = 0; k < 9; k++)
      cd.add(new T.CylinderGeometry(0.12, 0.12, 0.008, 10), m.engine, [0, -0.15 + k * 0.035, 0]);
    cd.box([0.2, 0.065, 0.19], [0, 0.19, 0], m.engine);
    cd.finish();
    for (const dx of [-0.045, 0.045])
      d.rod(
        [p(0.26)[0] + dx, p(0.26)[1], 0.15],
        [p(0.61)[0] + dx, p(0.61)[1], 0.09],
        0.009,
        m.metal,
      );
  }
  const tail = [
    [-0.8, 0.78, 0],
    [-1.4, 0.72, -0.05],
    [-2.4, 0.58, 0.15],
    [-3.6, 0.28, 0.15],
    [-4.3, 0.018, -0.15],
  ].map(([z, r, dy]) => ({ z, points: ring(z, r).points.map(([x, y]) => [x, y + dy]) }));
  loft(d, tail, m.metal);
  d.box([0.29, 0.11, 0.75], [0, 0.83, -0.7], m.metal);
  d.box([0.23, 0.07, 0.015], [0, 0.84, -0.31], m.dark);
  for (const sign of [-1, 1]) {
    d.rod([sign * 0.58, -0.52, -0.55], [sign * 0.7, -0.72, -1.3], 0.074, m.engine);
    d.add(new T.CircleGeometry(0.064, 12), m.dark, [sign * 0.7, -0.72, -1.38]);
  }
  for (const z of [-0.72, -1.38, -2.35]) {
    outline(
      d,
      ring(z, z > -0.8 ? 0.813 : z > -1.5 ? 0.725 : 0.59).points.map((q) => [...q, z]),
      0.0025,
      m.dark,
    );
  }
  const prop = group(g, `DC3-propeller-${side}`, [0, 0, 0.5]),
    pd = detailKit(prop, prop.name);
  ellipsoid(pd, [0, 0, 0.13], [0.18, 0.18, 0.24], m.metal, 20);
  pd.ring(0.145, 0.008, [0, 0, 0.25], m.engine);
  for (let j = 0; j < 3; j++) {
    const b = group(prop, `DC3-blade-${side}-${j}`);
    b.rotation.z = (j * Math.PI * 2) / 3;
    const bd = detailKit(b, b.name),
      pts = [
        [0.12, -0.07, 0.02],
        [0.42, -0.12, 0],
        [1.35, -0.12, -0.02],
        [1.7, -0.06, -0.01],
        [1.7526, 0, 0],
        [1.71, 0.055, 0.01],
        [1.3, 0.12, 0.025],
        [0.4, 0.11, 0.02],
        [0.12, 0.07, 0],
      ];
    sheet(bd, pts, m.metal, [0, 0, 1]);
    sheet(
      bd,
      pts.map((q) => [q[0], q[1], q[2] - 0.02]),
      m.dark,
      [0, 0, -1],
    );
    sheet(
      bd,
      [
        [1.61, -0.083, 0.012],
        [1.7, -0.06, 0.012],
        [1.7526, 0, 0.012],
        [1.71, 0.055, 0.012],
        [1.61, 0.077, 0.012],
      ],
      m.orange,
      [0, 0, 1],
    );
    bd.finish();
  }
  pd.finish();
  d.finish();
  return prop;
}
export function buildDC3(s) {
  const root = new T.Group();
  root.name = s.slug;
  const body = group(root, 'DC3-airframe');
  body.rotation.x = -angle;
  body.position.y = offset;
  const m = {
      metal: mat('DC3-aluminium', '#aeb9be', {
        metalness: 0.72,
        roughness: 0.36,
        side: T.DoubleSide,
      }),
      orange: mat('DC3-orange', '#dc6329', { side: T.DoubleSide }),
      blue: mat('DC3-blue', '#203f60', { side: T.DoubleSide }),
      dark: mat('DC3-dark', '#202827', { side: T.DoubleSide }),
      engine: mat('DC3-engine-case', '#6c7c80', { metalness: 0.6 }),
      rubber: mat('DC3-tyre', '#1b2022'),
      fabric: mat('DC3-fabric-controls', '#9ca9ad', { side: T.DoubleSide }),
    },
    glass = mat('DC3-glass', '#a7bec5', {
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    }),
    d = detailKit(body, 'DC3-shell'),
    bindings = [];
  const stations = [
    [93, 0.015, 251, 247],
    [107, 0.38, 266, 231],
    [133, 0.69, 277, 217],
    [153, 0.84, 281, 207],
    [173, 1.02, 284, 189],
    [211, 1.2, 290, 179],
    [280, 1.24, 292, 178],
    [382, 1.24, 291, 178],
    [535, 1.19, 280, 181],
    [630, 1.02, 263, 187],
    [709, 0.69, 244, 197],
    [770, 0.38, 233, 209],
    [828, 0.12, 227, 217],
    [848, 0.012, 223, 222],
  ].map(([u, w, b, t]) => [zz(u), w, yy(b), yy(t)]);
  const rings = stations.map(([z, w, b, t]) => {
      const h = t - b;
      return {
        z,
        points: [
          [0, t],
          [w * 0.58, t - h * 0.035],
          [w * 0.9, t - h * 0.12],
          [w, t - h * 0.26],
          [w, t - h * 0.62],
          [w * 0.82, b + h * 0.08],
          [w * 0.46, b + h * 0.015],
          [0, b],
          [-w * 0.46, b + h * 0.015],
          [-w * 0.82, b + h * 0.08],
          [-w, t - h * 0.62],
          [-w, t - h * 0.26],
          [-w * 0.9, t - h * 0.12],
          [-w * 0.58, t - h * 0.035],
        ],
      };
    }),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, m.metal, {
    skip: (i, j) =>
      (i === 3 && [0, 1, 12, 13].includes(j)) || (i >= 3 && i <= 10 && [2, 3, 10, 11].includes(j)),
  });
  for (const j of [0, 1, 12, 13])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 14), p(3, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [0, 2, 12]) d.rod(p(3, j), p(4, j), 0.023, m.metal);
  for (const i of [3, 4])
    outline(d, [p(i, 12), p(i, 13), p(i, 0), p(i, 1), p(i, 2)], 0.022, m.metal, false);
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
      win = (u, v, w, h) =>
        [
          [u - w / 2, v - h / 2],
          [u + w / 2, v - h / 2],
          [u + w / 2, v + h / 2],
          [u - w / 2, v + h / 2],
        ].map(([u, v]) => pt(zz(u), yy(v)));
    const holes = [
      [
        [154, 217],
        [171, 204],
        [171, 227],
        [154, 228],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      [
        [176, 203],
        [205, 197],
        [205, 227],
        [176, 227],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      ...[293, 331, 369, 407, 445, 483, 521].map((u) => win(u, 231, 21, 17)),
    ];
    for (let i = 3; i <= 10; i++) {
      const hi = side > 0 ? 2 : 12,
        lo = side > 0 ? 4 : 10;
      sheet(
        d,
        [p(i, hi), p(i + 1, hi), p(i + 1, lo), p(i, lo)],
        m.metal,
        [side, 0, 0],
        holes.filter((h) => h.every((q) => q[2] < stations[i][0] && q[2] > stations[i + 1][0])),
      );
    }
    for (const h of holes) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.009, m.blue);
    }
    // Narrow painted lightning stripe; no photographic skin.
    for (let i = 1; i < stations.length - 2; i++) {
      const a = stations[i],
        b = stations[i + 1],
        ha = a[2] + (a[3] - a[2]) * 0.4,
        hb = b[2] + (b[3] - b[2]) * 0.4;
      quad(
        d,
        pt(a[0], ha, 0.009),
        pt(b[0], hb, 0.009),
        pt(b[0], hb + 0.1, 0.009),
        pt(a[0], ha + 0.1, 0.009),
        m.orange,
        [side, 0, 0],
      );
    }
    for (const [u1, u2, v1, v2] of side === -1
      ? [[549, 575, 209, 264]]
      : [
          [179, 203, 229, 263],
          [628, 656, 220, 242],
        ]) {
      const pts = [
        [u1, v2],
        [u1, v1 + 5],
        [u1 + 5, v1],
        [u2 - 5, v1],
        [u2, v1 + 5],
        [u2, v2],
      ].map(([u, v]) => pt(zz(u), yy(v), 0.007));
      outline(d, pts, 0.003, m.dark);
      d.rod(
        pt(zz(u1 + 6), yy((v1 + v2) / 2), 0.02),
        pt(zz(u1 + 13), yy((v1 + v2) / 2), 0.02),
        0.012,
        m.metal,
      );
    }
    for (let z = 8.8; z > -7.8; z -= 0.73) {
      const b = sample(z, 2),
        t = sample(z, 3),
        w = sample(z, 1);
      for (let f = 0.13; f < 0.94; f += 0.07) {
        const y = b + (t - b) * f;
        if (y > 3.15 && y < 3.8 && z < 6 && z > -2) continue;
        d.add(new T.SphereGeometry(0.003, 4, 2), m.metal, [side * w, y, z]);
      }
    }
    for (const z of [8.5, 7.3, 5.0, 3.6, 1.3, -1, -3.5, -5.4, -7.3]) {
      const b = sample(z, 2),
        t = sample(z, 3),
        w = sample(z, 1);
      outline(
        d,
        [
          [0, t + 0.004, z],
          [side * w * 0.58, t - 0.035 * (t - b), z],
          [side * w * 0.9, t - 0.12 * (t - b), z],
          [side * w, t - 0.26 * (t - b), z],
        ],
        0.0018,
        m.engine,
        false,
      );
    }
    const decal = group(body, `DC3-label-${side}`, [side * 1.245, 3.0, 3.7]);
    decal.rotation.y = (side * Math.PI) / 2;
    const dd = detailKit(decal, decal.name);
    dd.text('DOUGLAS  DC-3', [0, 0, 0], 0.17, 0, m.blue);
    dd.finish();
  }
  // 170-inch centre-section chord, 51.5-inch outer-tip chord, five-degree dihedral.
  const join = 3.6068,
    span = 28.956,
    wy = (x) => 2.37 + Math.tan((5 * Math.PI) / 180) * Math.max(0, x - join),
    lead = (x) => 5.05 - Math.max(0, x - join) * 0.295,
    trail = (x) => 0.732;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 1.05, wy(1.05), 5.05, 0.732, 0.32],
        [side * join, wy(join), 5.05, 0.732, 0.32],
        [side * 6.32, wy(6.32), lead(6.32), 1.32, 0.24],
        [side * 13.72, wy(13.72), lead(13.72), 0.732, 0.1],
        [side * 14.12, wy(14.12), 1.95, 0.83, 0.08],
        [side * 14.39, wy(14.39), 1.69, 1.02, 0.045],
        [side * 14.478, wy(14.478), 1.39, 1.24, 0.015],
      ],
      m.metal,
    );
    for (const [kind, a, b] of [
      ['flap', 1.13, 6.3],
      ['aileron', 6.36, 13.69],
    ]) {
      const hinge = kind === 'flap' ? 1.55 : 1.32,
        g = group(body, `DC3-${kind}-${side}`, [side * a, wy(a) - 0.025, hinge]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, 0.732 - hinge, 0.023],
          [side * (b - a), wy(b) - wy(a), 0, 0.732 - hinge, 0.02],
        ],
        m.fabric,
      );
      for (let xx = 0.15; xx < b - a; xx += 0.3)
        dd.rod(
          [side * xx, wy(a + xx) - wy(a) + 0.022, -0.02],
          [side * xx, wy(a + xx) - wy(a) + 0.012, 0.75 - hinge],
          0.002,
          m.engine,
        );
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : side === 1 ? 'aileronL' : 'aileronR',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -Math.PI / 4 : 1,
      });
    }
    for (const xx of [3.65, 6.3, 9.5, 12.5]) {
      const y = wy(xx) + 0.22 * (1 - xx / 17);
      d.rod([side * xx, y, lead(xx) - 0.2], [side * xx, y, 1.37], 0.0025, m.engine);
      for (let z = 1.5; z < lead(xx) - 0.22; z += 0.12)
        d.add(new T.SphereGeometry(0.003, 4, 2), m.metal, [side * (xx + 0.026), y + 0.004, z]);
    }
    // The round fixed stabilizer and separate broad fabric elevator.
    wing(
      d,
      [
        [side * 0.18, 3.77, -6.2, -8.85, 0.1],
        [side * 3.62, 3.77, -8.04, -8.85, 0.065],
        [side * 3.94, 3.77, -8.3, -8.95, 0.045],
        [side * 4.064, 3.77, -8.6, -8.95, 0.012],
      ],
      m.metal,
    );
    const eg = group(body, `DC3-elevator-${side}`, [0, 3.77, -8.85]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.18, 0, 0, -0.86, 0.065],
        [side * 3.64, 0, 0, -0.85, 0.035],
        [side * 3.92, 0, -0.06, -0.65, 0.02],
        [side * 4.04, 0, -0.1, -0.25, 0.01],
      ],
      m.fabric,
    );
    for (let x = 0.4; x < 3.7; x += 0.3)
      ed.rod([side * x, 0.067, -0.03], [side * x, 0.02, -0.8], 0.002, m.engine);
    ed.box([0.65, 0.025, 0.15], [side * 2.8, 0, -0.79], m.metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'elevatorAngle',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const gear = group(body, `DC3-main-gear-${side}`, [side * 2.8194, 2.1, 4.4]),
      gd = detailKit(gear, gear.name);
    for (const sign of [-1, 1]) {
      gd.rod([sign * 0.3, 0, 0], [sign * 0.3, -1.1, -0.18], 0.039, m.metal);
      gd.rod([sign * 0.3, -0.65, -0.11], [sign * 0.3, -1.5, -0.22], 0.03, m.engine);
      gd.rod([sign * 0.3, -1.4, -0.22], [sign * 0.3, -0.15, -1.8], 0.031, m.metal);
    }
    gd.rod([-0.34, -1.5285, -0.22], [0.34, -1.5285, -0.22], 0.05, m.metal);
    gd.add(
      new T.CylinderGeometry(0.5715, 0.5715, 0.4318, 32).rotateZ(Math.PI / 2),
      m.rubber,
      [0, -1.5285, -0.22],
    );
    gd.add(
      new T.CylinderGeometry(0.2032, 0.2032, 0.448, 24).rotateZ(Math.PI / 2),
      m.metal,
      [0, -1.5285, -0.22],
    );
    for (const sign of [-1, 1])
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        gd.add(new T.SphereGeometry(0.014, 6, 4), m.dark, [
          sign * 0.228,
          -1.5285 + 0.15 * Math.sin(a),
          -0.22 + 0.15 * Math.cos(a),
        ]);
      }
    gd.finish();
    bindings.push({
      node: gear.name,
      source: 'gearPosition',
      property: 'rotation',
      axis: 'x',
      scale: 1.3,
      offset: -1.3,
    });
    const lamp = ellipsoid(
      d,
      [side * 5.5, wy(5.5), lead(5.5) - 0.015],
      [0.12, 0.095, 0.04],
      m.dark,
      16,
    );
    lamp.name = `DC3-landing-light-${side}`;
    ellipsoid(d, [side * 5.5, wy(5.5), lead(5.5) + 0.01], [0.085, 0.065, 0.026], m.metal, 12);
  }
  // Fin silhouette follows the manual; rudder hinge and rounded trailing edge are distinct.
  const solid = (dd, pts, material) => {
    for (const side of [-1, 1])
      sheet(
        dd,
        pts.map(([z, y]) => [side * 0.065, y, z]),
        material,
        [side, 0, 0],
      );
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      quad(
        dd,
        [-0.065, a[1], a[0]],
        [0.065, a[1], a[0]],
        [0.065, b[1], b[0]],
        [-0.065, b[1], b[0]],
        material,
        [0, 1, 0],
      );
    }
  };
  solid(
    d,
    [
      [642, 178],
      [675, 173],
      [699, 162],
      [719, 135],
      [744, 99],
      [765, 90],
      [777, 89],
      [777, 199],
      [845, 224],
      [782, 218],
    ].map(([u, v]) => [zz(u), yy(v)]),
    m.metal,
  );
  const rudder = group(body, 'DC3-rudder', [0, yy(199), zz(777)]),
    rd = detailKit(rudder, rudder.name);
  solid(
    rd,
    [
      [777, 199],
      [777, 89],
      [799, 90],
      [830, 96],
      [833, 133],
      [838, 182],
      [841, 213],
      [845, 224],
    ].map(([u, v]) => [zz(u) - zz(777), yy(v) - yy(199)]),
    m.fabric,
  );
  for (let h = 0.2; h < 2.8; h += 0.27)
    rd.rod([0.069, h, -0.02], [0.069, h, -1.2], 0.002, m.engine);
  rd.finish();
  bindings.push({
    node: rudder.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: Math.PI / 6,
  });
  const tail = group(body, 'DC3-tail-wheel', [0, 2.706, -6.35]),
    td = detailKit(tail, tail.name);
  td.rod([0, 0.18, 0.09], [0, -0.12, 0], 0.042, m.metal);
  for (const side of [-1, 1])
    td.rod([side * 0.14, -0.05, 0], [side * 0.14, -0.24, -0.17], 0.024, m.metal);
  td.add(
    new T.CylinderGeometry(0.2794, 0.2794, 0.2286, 24).rotateZ(Math.PI / 2),
    m.rubber,
    [0, -0.26, -0.17],
  );
  td.add(
    new T.CylinderGeometry(0.0762, 0.0762, 0.24, 16).rotateZ(Math.PI / 2),
    m.metal,
    [0, -0.26, -0.17],
  );
  td.finish();
  const props = [radial(body, 1, m), radial(body, -1, m)];
  d.rod([0, 4.78, 6.2], [0, 5.12, 6.0], 0.014, m.metal);
  d.rod([0, 5.12, 6], [0, 6.3, -7.5], 0.002, m.dark);
  for (const side of [-1, 1]) {
    d.rod([side * 0.07, 4.03, 8.3], [side * 0.55, 4.17, 8.08], 0.012, m.dark);
    d.rod([side * 0.4, 4.12, 8.17], [side * 0.77, 4.23, 7.95], 0.009, m.dark);
    d.rod([side * 0.6, 2.1, 8.1], [side * 0.6, 1.78, 8.1], 0.016, m.dark);
    d.rod([side * 0.6, 1.78, 8.1], [side * 0.6, 1.78, 8.45], 0.013, m.metal);
  }
  d.finish();
  const interior = dc3Cockpit(body, m);
  body.getObjectByName('cockpit').position.z = -0.25;
  cleanGeometry(root);
  return {
    root,
    frame: dc3Frame(),
    enginePoints: [
      { id: 'engine-1', position: dc3Pose([2.8194, 2.159, 6.57]) },
      { id: 'engine-2', position: dc3Pose([-2.8194, 2.159, 6.57]) },
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
