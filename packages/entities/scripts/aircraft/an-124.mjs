/** An-124-100: individual Ruslan stations, ten main struts and six-place analog flight deck.
 * See reference-review.json for diagram discrepancies and estimated cockpit dimensions. */
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

export const an124Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 3.7,
  cy: 6.2,
  ry: 4.1,
  cabinZ: 27.0,
  cabinWidth: 3.0,
  eye: [0.98, 9.45, 27],
  panelZ: 28.4,
  floor: 7.55,
});
const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
function hinge(root, name, stations, material, bindings, source, scale) {
  const a = stations[0],
    b = stations.at(-1),
    mount = group(root, `${name}-mount`, a.slice(0, 3)),
    g = group(mount, name);
  mount.quaternion.setFromUnitVectors(
    new T.Vector3(1, 0, 0),
    new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(),
  );
  const inv = new T.Matrix4()
      .compose(mount.position, mount.quaternion, new T.Vector3(1, 1, 1))
      .invert(),
    temp = new T.Group(),
    d = detailKit(temp, name);
  wing(d, stations, material);
  d.finish();
  for (const n of [...temp.children]) {
    n.traverse((m) => {
      if (m.isMesh) m.geometry.applyMatrix4(inv);
    });
    g.add(n);
  }
  bindings.push({ node: name, source, property: 'rotation', axis: 'x', scale });
}
export function buildAn124(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('AN124-airframe', '#dce0df', { side: T.DoubleSide }),
    dark = mat('AN124-trim', '#283237', { side: T.DoubleSide }),
    metal = mat('AN124-alloy', '#acb5b8', { metalness: 0.7 }),
    seam = mat('AN124-seam', '#78858c'),
    rubber = mat('AN124-tire', '#171d20'),
    blue = mat('AN124-stripe', '#236b9b'),
    glass = mat('AN124-glass', '#a5c2ca', {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'AN124-exterior'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  // Side coordinates from the cited public-domain drawing; overall length69.1m.
  const ppm = 1074 / 69.1,
    sz = (u) => 34.55 - (u - 866) / ppm,
    sy = (v) => (1042 - v) / ppm;
  const sections = [
    [866, 0.025, 970, 969],
    [880, 0.85, 990, 946],
    [920, 1.85, 1001, 923],
    [950, 2.42, 1007, 914],
    [974, 2.8, 1011, 893],
    [990, 3.05, 1013, 891],
    [1040, 3.43, 1017, 891],
    [1168, 3.72, 1018, 890],
    [1305, 3.72, 1019, 889],
    [1440, 3.67, 1018, 888],
    [1570, 3.48, 1008, 888],
    [1680, 2.92, 987, 888],
    [1770, 2.25, 960, 887],
    [1845, 1.48, 934, 887],
    [1904, 0.65, 918, 893],
    [1940, 0.025, 902, 902],
  ];
  const rings = sections.map(([u, w, b, t]) => {
    const top = sy(t),
      bottom = sy(b),
      h = top - bottom;
    return {
      z: sz(u),
      points: [
        [0, top],
        [0.5 * w, top - 0.025 * h],
        [0.82 * w, top - 0.12 * h],
        [w, top - 0.32 * h],
        [w, bottom + 0.32 * h],
        [0.85 * w, bottom + 0.1 * h],
        [0.5 * w, bottom + 0.025 * h],
        [0, bottom],
        [-0.5 * w, bottom + 0.025 * h],
        [-0.85 * w, bottom + 0.1 * h],
        [-w, bottom + 0.32 * h],
        [-w, top - 0.32 * h],
        [-0.82 * w, top - 0.12 * h],
        [-0.5 * w, top - 0.025 * h],
      ],
    };
  });
  const p = (i, j) => [...rings[i].points[(j + 14) % 14], rings[i].z],
    lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  loft(d, rings, paint, {
    skip: (i, j) => [3, 4].includes(i) && [0, 1, 2, 11, 12, 13].includes(j),
  });
  const bot = [
      [0, 9.22, 28.95],
      [0.75, 9.19, 28.84],
      [1.43, 9.14, 28.15],
      [1.87, 9.12, 26.65],
    ],
    top = [
      [0, 9.96, 28.09],
      [0.69, 9.94, 27.99],
      [1.32, 9.9, 27.47],
      [1.78, 9.72, 26.5],
    ];
  for (const side of [-1, 1]) {
    const b = bot.map((q) => [side * q[0], q[1], q[2]]),
      t = top.map((q) => [side * q[0], q[1], q[2]]);
    sheet(
      d,
      [
        p(3, 0),
        p(3, side),
        p(3, 2 * side),
        p(3, 3 * side),
        p(4, 3 * side),
        p(5, 3 * side),
        ...b.slice().reverse(),
      ],
      paint,
      [side * 0.4, 0.7, 0.5],
    );
    sheet(d, [...t, p(5, 3 * side), p(5, 2 * side), p(5, side), p(5, 0)], paint, [
      side * 0.3,
      1,
      0,
    ]);
    for (let j = 0; j < 3; j++) {
      quad(d, b[j], b[j + 1], t[j + 1], t[j], glass, [side * 0.4, 0.4, 1]);
      outline(d, [b[j], b[j + 1], t[j + 1], t[j]], 0.031, dark);
    }
    d.rod([side * 0.4, 9.25, 28.92], [side * 0.7, 9.52, 28.59], 0.012, dark);
    d.rod([side * 0.7, 9.52, 28.59], [side * 0.95, 9.75, 28.1], 0.01, dark);
  }
  // Plan-view calibrated stations, marked anhedral. Main engine span stations use operator dimensions.
  const ws = [
    [0, 9.55, 15.2, 0.5, 0.5],
    [3.7, 9.45, 13.9, -0.2, 0.48],
    [9.932, 8.7, 9.35, -2.25, 0.4],
    [17.688, 7.65, 4.25, -5.55, 0.3],
    [28.5, 6.25, -3.15, -8.75, 0.17],
    [35.1, 5.4, -7.45, -10.8, 0.1],
    [36.65, 5.2, -9.3, -11.5, 0.055],
  ];
  const station = (x) => {
    const i = ws.findIndex((a) => a[0] >= x),
      a = ws[Math.max(0, i - 1)],
      b = ws[Math.max(1, i)],
      t = (x - a[0]) / (b[0] - a[0]);
    return a.map((v, j) => (j === 0 ? x : v + (b[j] - v) * t));
  };
  const cut = (x, side) => {
    const [xx, y, le, te, h] = station(x);
    return [side * xx, y, le + (te - le) * 0.76, te, h * 0.3];
  };
  for (const side of [-1, 1]) {
    wing(
      d,
      ws.map(([x, y, le, te, h]) => [side * x, y, le, le + (te - le) * 0.76, h]),
      paint,
    );
    for (const [j, lo, hi] of [
      [0, 3.71, 13.2],
      [1, 13.24, 22.5],
      [2, 22.54, 28.4],
    ])
      hinge(
        root,
        `AN124-flap-${side}-${j}`,
        [lo, hi].map((x) => cut(x, side)),
        paint,
        bindings,
        'flapPosition',
        -side * 0.6,
      );
    hinge(
      root,
      `AN124-aileron-${side}`,
      [28.45, 35.1, 36.65].map((x) => cut(x, side)),
      paint,
      bindings,
      'rollInput',
      -0.3,
    );
    for (const x of [5.1, 9.3, 13.2, 17.7, 22.5, 28.4, 33]) {
      const [, y, le, te, h] = station(x);
      d.rod([side * x, y + h * 0.8, le - 0.12], [side * x, y + h * 0.4, te + 0.15], 0.008, seam);
      ellipsoid(d, [side * x, y - 0.14, te - 0.25], [0.11, 0.22, 0.7], paint, 8);
      for (let j = 1; j < 8; j++)
        d.add(new T.SphereGeometry(0.011, 5, 3), metal, [
          side * x,
          y + h * 0.7,
          le + ((te - le) * j) / 9,
        ]);
    }
    for (const frac of [0.1, 0.7])
      outline(
        d,
        ws.slice(1).map(([x, y, le, te, h]) => [side * x, y + h * 0.75, le + (te - le) * frac]),
        0.009,
        seam,
        false,
      );
    ellipsoid(d, [side * 36.59, 5.29, -10.5], [0.06, 0.07, 0.2], side > 0 ? d.red : d.green, 8);
  }
  // Conventional low horizontal tail, swept tall fin, separate canted rudder hinge.
  const fin = [
      [0, 10, -17],
      [0, 10.5, -19.2],
      [0, 20.65, -28.6],
      [0, 21.08, -29.7],
      [0, 21.08, -32.8],
      [0, 20.75, -31],
      [0, 10, -27.1],
    ],
    fw = (p) => 0.42 - (p[1] - 10) * 0.025;
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * fw(p), p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-fw(a), a[1], a[2]],
      [-fw(b), b[1], b[2]],
      [fw(b), b[1], b[2]],
      [fw(a), a[1], a[2]],
      paint,
      [0, 1, 1],
    );
  }
  const rm = group(root, 'AN124-rudder-mount', [0, 10, -27.1]),
    rud = group(rm, 'AN124-rudder');
  rm.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    new T.Vector3(0, 10.75, -3.9).normalize(),
  );
  const inv = new T.Matrix4().compose(rm.position, rm.quaternion, new T.Vector3(1, 1, 1)).invert(),
    rd = detailKit(rud, rud.name),
    rp = [
      [0, 10, -27.1],
      [0, 20.75, -31],
      [0, 20.75, -32.71],
      [0, 10, -29.6],
    ];
  for (const side of [-1, 1])
    sheet(
      rd,
      rp.map((p) => new T.Vector3(side * 0.12, p[1], p[2]).applyMatrix4(inv).toArray()),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < 4; i++) {
    const a = rp[i],
      b = rp[(i + 1) % 4],
      q = [
        [-0.12, a[1], a[2]],
        [-0.12, b[1], b[2]],
        [0.12, b[1], b[2]],
        [0.12, a[1], a[2]],
      ].map((p) => new T.Vector3(...p).applyMatrix4(inv).toArray());
    const n = new T.Vector3(...q[1])
      .sub(new T.Vector3(...q[0]))
      .cross(new T.Vector3(...q[3]).sub(new T.Vector3(...q[0])));
    sheet(rd, q, paint, n.toArray());
  }
  rd.finish();
  bindings.push({
    node: rud.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  const hs = [
    [0.4, 8.3, -21.8, -31.1, 0.28],
    [2.25, 8.35, -22.4, -31.5, 0.26],
    [13.8, 8.8, -31.15, -34.2, 0.09],
    [14.65, 8.84, -32.65, -34.55, 0.045],
  ];
  for (const side of [-1, 1]) {
    wing(
      d,
      hs.map(([x, y, le, te, h]) => [side * x, y, le, le + (te - le) * 0.7, h]),
      paint,
    );
    hinge(
      root,
      `AN124-elevator-${side}`,
      hs.map(([x, y, le, te, h]) => [side * x, y, le + (te - le) * 0.7, te, h * 0.3]),
      paint,
      bindings,
      'pitchInput',
      side * 0.3,
    );
  }
  // D-18T: short round fan cowls, stepped exposed rear core and pylons.
  for (const [i, x] of [17.688, 9.932, -9.932, -17.688].entries()) {
    const outer = Math.abs(x) > 15,
      front = outer ? 10.3 : 14.6,
      // Intake-center heights cross-checked against Massey's frontal photograph.
      // The operator's ambiguous3.3/4m annotations are not treated as centerline heights.
      cy = outer ? 4.65 : 5.25,
      id = `engine-${i + 1}`;
    const ring = (z, r) => ({
      z,
      points: Array.from({ length: 32 }, (_, j) => [
        x + Math.sin((j * Math.PI) / 16) * r,
        cy + Math.cos((j * Math.PI) / 16) * r,
      ]),
    });
    loft(
      d,
      [
        [front, 1.39],
        [front - 0.16, 1.51],
        [front - 1.5, 1.58],
        [front - 4.8, 1.5],
        [front - 5.4, 1.22],
      ].map(([z, r]) => ring(z, r)),
      paint,
      { caps: false },
    );
    loft(d, [ring(front, 1.39), ring(front - 0.14, 1.28), ring(front - 0.75, 1.25)], metal, {
      caps: false,
    });
    d.add(new T.CircleGeometry(1.25, 32), dark, [x, cy, front - 0.91]);
    const fan = group(root, `AN124-engine-fan-${i + 1}`, [x, cy, front - 0.82]),
      fd = detailKit(fan, fan.name);
    for (let j = 0; j < 33; j++) {
      const a = (j * 2 * Math.PI) / 33,
        p = (r, o = 0) => [Math.sin(a + o) * r, Math.cos(a + o) * r, 0];
      sheet(fd, [p(0.3), p(1.24, 0.08), p(1.24, 0.15), p(0.3, 0.12)], metal, [0, 0, 1]);
    }
    ellipsoid(fd, [0, 0, 0.12], [0.32, 0.32, 0.52], dark, 16);
    fd.finish();
    rotors.push({ node: fan.name, axis: 'z', multiplier: 1, engine: id });
    const rear = front - 5.4;
    loft(d, [ring(rear, 1.22), ring(rear - 0.7, 0.95), ring(rear - 1.25, 0.85)], metal, {
      caps: false,
    });
    d.add(new T.CircleGeometry(0.85, 24).rotateY(Math.PI), dark, [x, cy, rear - 1.26]);
    ellipsoid(d, [x, cy, rear - 1.1], [0.4, 0.4, 0.7], dark, 16);
    const [, wy, le, te] = station(Math.abs(x));
    for (const side of [-1, 1])
      sheet(
        d,
        [
          [x + side * 0.2, cy + 1, rear],
          [x + side * 0.2, wy, te + 0.4],
          [x + side * 0.2, wy + 0.05, le + 0.1],
          [x + side * 0.2, cy + 1.45, front - 1.6],
        ],
        paint,
        [side, 0, 0],
      );
    for (const [z, r] of [
      [front - 0.35, 1.54],
      [front - 3.7, 1.54],
      [front - 4.8, 1.51],
    ])
      d.ring(r, 0.013, [x, cy, z], seam);
    enginePoints.push({ id, position: [x, cy, front - 2.8] });
  }
  const wheel = (dd, x, y, z, r, w) => {
    dd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), rubber, [x, y, z]);
    for (const side of [-1, 1]) {
      dd.add(new T.CylinderGeometry(r * 0.54, r * 0.54, 0.025, 16).rotateZ(Math.PI / 2), metal, [
        x + side * (w / 2 + 0.01),
        y,
        z,
      ]);
      dd.ring(r * 0.8, 0.012, [x + side * (w / 2 + 0.015), y, z], dark, 'x');
    }
  };
  // Five independently suspended twin-wheel axles per side, and two twin-wheel nose struts.
  for (const side of [-1, 1]) {
    loft(
      d,
      [
        [9.2, 0.2, 2.6, 0.2],
        [7.6, 0.75, 2.2, 0.65],
        [3, 0.88, 2, 0.8],
        [-4, 0.86, 2, 0.8],
        [-9.1, 0.55, 2.3, 0.4],
        [-10.6, 0.1, 2.5, 0.1],
      ].map(([z, rx, cy, ry]) => ({
        z,
        points: Array.from({ length: 16 }, (_, j) => [
          side * 3.55 + Math.sin((j * Math.PI) / 8) * rx,
          cy + Math.cos((j * Math.PI) / 8) * ry,
        ]),
      })),
      paint,
    );
    for (let j = 0; j < 5; j++) {
      const z = 5.35 - j * 1.8,
        g = group(root, `AN124-main-gear-${side}-${j}`, [side * 4, 0, z]),
        dd = detailKit(g, g.name);
      for (const dx of [-0.29, 0.29]) wheel(dd, dx, 0.635, 0, 0.635, 0.48);
      dd.rod([-0.39, 0.635, 0], [0.39, 0.635, 0], 0.13, metal);
      dd.rod([0, 0.72, 0], [0, 2.45, 0.15], 0.14, metal);
      dd.rod([0, 1.25, 0], [-side * 0.65, 2.45, -0.6], 0.07, metal);
      dd.box([0.05, 0.8, 1.55], [side * 0.63, 1.72, 0], paint);
      dd.finish();
      bindings.push(
        {
          node: g.name,
          source: 'gear',
          property: 'position',
          axis: 'y',
          scale: -1.65,
          offset: 1.65,
        },
        { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
      );
    }
    const ng = group(root, `AN124-nose-gear-${side}`, [side * 0.68, 0, 24.65]),
      nd = detailKit(ng, ng.name);
    for (const dx of [-0.25, 0.25]) wheel(nd, dx, 0.5, 0, 0.5, 0.37);
    nd.rod([-0.34, 0.5, 0], [0.34, 0.5, 0], 0.11, metal);
    nd.rod([0, 0.6, 0], [0, 2.5, -0.15], 0.12, metal);
    nd.rod([0, 1.2, -0.1], [0, 2.3, -1], 0.06, metal);
    nd.box([0.04, 0.55, 1.8], [side * 0.58, 1.8, -0.3], paint);
    nd.finish();
    bindings.push(
      { node: ng.name, source: 'gear', property: 'position', axis: 'y', scale: -1.6, offset: 1.6 },
      { node: ng.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  const skin = (side, y, z, off = 0.018) => {
    let i = 0;
    while (i < rings.length - 2 && z < rings[i + 1].z) i++;
    const a = rings[i],
      b = rings[i + 1],
      t = (a.z - z) / (a.z - b.z),
      rr = a.points.map((p, j) => lerp(p, b.points[j], t));
    for (let j = 0; j < 7; j++) {
      const p = rr[j],
        q = rr[j + 1];
      if (y <= p[1] && y >= q[1])
        return [side * (p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]) + off), y, z];
    }
    return [side * off, y, z];
  };
  for (const side of [-1, 1]) {
    // Closed visor seam and aft cargo-door boundary follow the skin rather than floating outside it.
    outline(
      d,
      [
        [3.2, 26.7],
        [4.1, 26.7],
        [5.4, 26.7],
        [6.8, 26.7],
        [8.5, 26.7],
        [9.12, 26.65],
      ].map(([y, z]) => skin(side, y, z)),
      0.017,
      seam,
      false,
    );
    outline(
      d,
      [
        [2.4, -3.5],
        [3, -9],
        [3.8, -14],
        [5.4, -21],
        [7.4, -28],
      ].map(([y, z]) => skin(side, y, z)),
      0.017,
      seam,
      false,
    );
    for (const z of [23.1, -5.2, -15.3])
      outline(
        d,
        [
          [3.1, z - 0.55],
          [4.8, z - 0.55],
          [4.8, z + 0.55],
          [3.1, z + 0.55],
        ].map(([y, z]) => skin(side, y, z)),
        0.015,
        seam,
      );
    // Original two-tone stripe; no operator identity or photographic texture.
    const stripe = rings.slice(3, 12).map((r) => r.z);
    for (let j = 0; j < stripe.length - 1; j++)
      quad(
        d,
        skin(side, 5.15, stripe[j], 0.025),
        skin(side, 5.15, stripe[j + 1], 0.025),
        skin(side, 5.7, stripe[j + 1], 0.025),
        skin(side, 5.7, stripe[j], 0.025),
        blue,
        [side, 0, 0],
      );
    d.text('AN-124', [side * 3.73, 6.7, 13.8], 0.48, (side * Math.PI) / 2, blue);
  }
  for (const i of [6, 7, 9, 11, 13]) {
    const r = rings[i];
    outline(
      d,
      r.points.map(([x, y]) => [x * 1.004, y + 0.006, r.z]),
      0.009,
      seam,
    );
    for (let j = 2; j < 13; j++)
      for (let k = 0; k < 4; k++) {
        const a = r.points[j],
          b = r.points[(j + 1) % 14],
          t = k / 4;
        d.add(new T.SphereGeometry(0.012, 5, 3), metal, [
          (a[0] + (b[0] - a[0]) * t) * 1.005,
          a[1] + (b[1] - a[1]) * t + 0.004,
          r.z + 0.045,
        ]);
      }
  }
  for (const z of [22, 14, -2])
    sheet(
      d,
      [
        [0, 10.1, z + 0.3],
        [0, 10.65, z - 0.1],
        [0, 10.1, z - 0.5],
      ],
      dark,
      [1, 0, 0],
    );
  ellipsoid(d, [0, 10.3, 14], [0.14, 0.1, 0.17], d.red, 8);
  d.finish();
  const interior = cockpit(root, { paint, dark, metal, glass });
  cleanGeometry(root);
  return {
    root,
    frame: an124Frame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps: [], ailerons: [], animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'AN124-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'AN124'),
    { bindings, derived, ink, black, amber } = ins;
  const face = mat('AN124-panel', '#4989a7', { side: T.DoubleSide }),
    liner = mat('AN124-liner', '#c4c3ba', { side: T.DoubleSide }),
    seat = mat('AN124-seat', '#343d47'),
    cushion = mat('AN124-cushion', '#697e87'),
    belt = mat('AN124-belt', '#aaa99e'),
    wood = mat('AN124-desktop', '#805332');
  const sources = Object.fromEntries(
    ['airspeed', 'pitch', 'roll', 'yaw', 'verticalSpeed', 'gearPosition', 'flapPosition'].map(
      (k) => [
        k === 'airspeed' ? 'trueAirspeed' : k === 'gearPosition' ? 'gear' : k,
        { component: 'aircraftState', path: [k] },
      ],
    ),
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
    unavailable: { op: 'divide', args: [1, 0] },
    kmh: { op: 'multiply', args: ['trueAirspeed', 3.6] },
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', 2 * Math.PI] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  // Relative coordinates from RAF-YYC's frontal photograph;3m panel span is an estimate.
  const px = (u) => ((880 - u) * 3) / 1040,
    py = (v) => 8.6 + ((670 - v) * 3) / 1040,
    z = 28.4,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const contour = [
    [360, 810],
    [360, 620],
    [420, 555],
    [760, 550],
    [760, 540],
    [1040, 540],
    [1040, 555],
    [1340, 555],
    [1400, 620],
    [1400, 810],
    [1030, 810],
    [1030, 755],
    [745, 755],
    [745, 810],
  ].map(([u, v]) => at(u, v));
  const horizons = [
      [556, 630],
      [1220, 635],
      [772, 625],
    ],
    holes = horizons.map(([u, v], i) =>
      rect(px(u), py(v), i === 2 ? 0.12 : 0.18, i === 2 ? 0.12 : 0.18, z),
    );
  sheet(d, contour, face, [0, 0, -1], holes);
  outline(d, contour, 0.013, m.dark);
  const blank = (name, u, v, r = 0.065) => {
    d.add(new T.CylinderGeometry(r, r, 0.012, 24).rotateX(Math.PI / 2), black, at(u, v, -0.009));
    d.ring(r * 0.97, 0.004, at(u, v, -0.017), m.metal);
    d.text('--', at(u, v, -0.02), r * 0.3, Math.PI, ink);
  };
  for (const [i, side] of ['pilot', 'copilot'].entries()) {
    const shift = i ? 664 : 0,
      uu = (u) => u + shift;
    const hg = group(cabin, `AN124-${side}-horizon`, at(uu(556), i ? 635 : 630, 0.018)),
      hi = instrumentGeometry(hg, `AN124-${side}`);
    hi.horizon('attitude', [0, 0, 0], 0.18, 0.18, { round: true, blankBackdrop: true });
    bindings.push(...hi.bindings);
    Object.assign(derived, hi.derived);
    ins.dial(
      `${side}-speed`,
      at(i ? 1140 : 485, i ? 635 : 641),
      0.075,
      'kmh',
      [
        [0, -2.4],
        [200, -1.2],
        [500, 0.5],
        [900, 2.4],
      ],
      [0, 200, 400, 600, 800],
      'TAS KM/H',
      { minorStep: 50 },
    );
    ins.dial(
      `${side}-altitude`,
      at(i ? 1069 : 674, i ? 637 : 603),
      0.074,
      'altitude',
      [
        [0, -2.5],
        [12000, 2.5],
      ],
      [0, 3000, 6000, 9000, 12000],
      'GEO M',
    );
    ins.dial(
      `${side}-vsi`,
      at(i ? 1069 : 672, i ? 703 : 667),
      0.072,
      'verticalSpeed',
      [
        [-30, -2.4],
        [0, 0],
        [30, 2.4],
      ],
      [-30, -15, 0, 15, 30],
      'M/S',
    );
    const hh = group(cabin, `AN124-${side}-heading`, at(uu(556), 711, -0.015)),
      hd = detailKit(hh, hh.name);
    d.add(new T.CircleGeometry(0.086, 32).rotateY(Math.PI), black, at(uu(556), 711, -0.01));
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
      hd.rod(p(deg % 30 ? 0.072 : 0.065), p(0.08), 0.0009, ink);
      if (deg % 30 === 0)
        hd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(0.05),
          0.012,
          Math.PI,
          ink,
        );
    }
    hd.finish();
    bindings.push({
      node: hh.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: 2 * Math.PI,
      responseSeconds: 0.15,
    });
    ins.available(`${side}-heading`, 'trueHeading', hh.name);
    d.rod(at(uu(556), 680, -0.018), at(uu(556), 690, -0.018), 0.002, amber);
    for (const [u, v] of [
      [431, 704],
      [431, 765],
      [619, 700],
      [619, 763],
    ])
      blank(`${side}-${u}`, i ? { 431: 1338, 619: 1134 }[u] : u, v, 0.062);
    for (const [u, v] of [
      [485, 580],
      [550, 580],
      [685, 746],
    ]) {
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 4; col++)
          d.box(
            [0.024, 0.013, 0.007],
            at(uu(u) + col * 11, v + row * 7, -0.01),
            row === 2 ? m.dark : liner,
          );
    }
  }
  ins.horizon('standby', at(772, 625, 0.018), 0.12, 0.12, { round: true, blankBackdrop: true });
  blank('standby-nav', 772, 694, 0.071);
  // Two original vertical instrument housings with four independently driven simulator RPM pointers.
  for (let i = 0; i < 4; i++) {
    sources[`engine${i + 1}`] = {
      component: 'aircraftState',
      path: ['engines', `engine-${i + 1}`, 'rpm'],
    };
    derived[`enginePercent${i + 1}`] = { op: 'multiply', args: [`engine${i + 1}`, 100] };
    const x = px(858 + i * 22),
      y = py(622);
    d.box([0.053, 0.21, 0.015], [x, y, z - 0.013], black);
    for (let k = 0; k <= 10; k++)
      d.rod(
        [x - 0.018, y - 0.085 + k * 0.017, z - 0.024],
        [x + (k % 2 ? -0.005 : 0.006), y - 0.085 + k * 0.017, z - 0.024],
        0.0007,
        ink,
      );
    const g = group(cabin, `AN124-rpm-${i + 1}`, [x, y - 0.085, z - 0.028]),
      dd = detailKit(g, g.name);
    dd.rod([-0.017, 0, 0], [0.017, 0, 0], 0.0025, ink);
    dd.finish();
    bindings.push({
      node: g.name,
      source: `engine${i + 1}`,
      property: 'position',
      axis: 'y',
      scale: 0.17,
      responseSeconds: 0.15,
    });
    ins.available(`rpm-${i + 1}`, `engine${i + 1}`, g.name);
    d.text(String(i + 1), [x, y + 0.127, z - 0.023], 0.015, Math.PI, ink);
  }
  d.text('SIM RPM', at(891, 565, -0.025), 0.014, Math.PI, ink);
  for (const u of [846, 934]) {
    d.box([0.23, 0.12, 0.015], at(u, 699, -0.006), black);
    d.text('--', at(u, 699, -0.02), 0.018, Math.PI, ink);
  }
  for (const [u, v] of [
    [990, 595],
    [995, 638],
    [997, 680],
    [997, 716],
  ])
    pt.knob(px(u), py(v), z - 0.03, 0.021);
  const lg = group(cabin, 'AN124-gear-down', at(966, 601, -0.02)),
    ld = detailKit(lg, lg.name);
  for (let i = 0; i < 3; i++) ld.box([0.015, 0.02, 0.006], [(i - 1) * 0.025, 0, 0], d.green);
  ld.finish();
  bindings.push({
    node: lg.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  // Glareshield radios/autoflight housings, separate from the roof-mounted panel.
  d.box([3.1, 0.13, 0.24], [0, 9.04, 28.4], m.dark);
  d.box([1.28, 0.24, 0.22], [0, 9.25, 28.37], m.dark);
  for (const side of [-1, 1]) {
    d.box([0.57, 0.2, 0.025], [side * 0.31, 9.25, 28.24], side > 0 ? m.dark : face);
    d.box([0.27, 0.06, 0.008], [side * 0.31, 9.29, 28.22], black);
    d.text('--', [side * 0.31, 9.29, 28.21], 0.018, Math.PI, ink);
    for (let j = 0; j < 4; j++) pt.knob(side * 0.31 - 0.21 + j * 0.14, 9.2, 28.21, 0.018);
  }
  d.box([0.36, 0.16, 0.09], [0, 9.45, 28.36], m.dark);
  d.text('NAV --', [0, 9.45, 28.31], 0.02, Math.PI, ink);
  // Long pedestal with four tall ivory levers, low radar scopes and offset flap handle.
  const ped = group(cabin, 'AN124-pedestal', [0, 8.12, 27.4]);
  ped.rotation.x = Math.PI / 2;
  const td = detailKit(ped, ped.name),
    tp = panelTools(td);
  beveledBox(td, [0.88, 2.2, 0.3], [0, 0, 0.08], face, 0.035);
  for (let i = 0; i < 4; i++) {
    const x = 0.18 - i * 0.12;
    td.box([0.025, 0.68, 0.009], [x, 0.5, -0.08], black);
    const g = group(ped, `AN124-throttle-${i + 1}`, [x, 0.54, -0.1]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.1, -0.42], 0.014, m.metal);
    beveledBox(dd, [0.105, 0.12, 0.05], [0, 0.1, -0.42], liner, 0.008);
    dd.text(String(i + 1), [0, 0.1, -0.449], 0.014, Math.PI, m.dark);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.7,
      offset: -0.15,
    });
  }
  for (const side of [-1, 1]) {
    td.box([0.36, 0.26, 0.015], [side * 0.22, 0.9, -0.09], black);
    td.text('RADAR --', [side * 0.22, 0.9, -0.103], 0.018, Math.PI, ink);
  }
  for (const [yy, n] of [
    [-0.1, 5],
    [-0.36, 4],
    [-0.62, 6],
    [-0.86, 4],
  ]) {
    for (let j = 0; j < n; j++) tp.knob(-0.29 + (j * 0.58) / (n - 1), yy, -0.11, 0.018);
    td.rod([-0.38, yy + 0.1, -0.1], [0.38, yy + 0.1, -0.1], 0.003, ink);
  }
  for (const x of [-0.33, 0.33]) {
    const g = group(ped, `AN124-${x > 0 ? 'trim' : 'flap'}-lever`, [x, 0.42, -0.12]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0, -0.22], 0.013, m.metal);
    dd.box([0.12, 0.05, 0.07], [0, 0, -0.22], liner);
    dd.finish();
    if (x < 0)
      bindings.push({
        node: g.name,
        source: 'flapPosition',
        property: 'rotation',
        axis: 'x',
        scale: -0.55,
      });
  }
  td.finish();
  // Overhead, two ventilation fans and narrow sun visors around the main windshield.
  const over = group(cabin, 'AN124-overhead', [0, 9.48, 25.2]);
  over.rotation.x = -Math.PI / 2;
  const od = detailKit(over, over.name),
    op = panelTools(od);
  beveledBox(od, [2.3, 1.4, 0.1], [0, 0, 0], face);
  for (const side of [-1, 1])
    for (let row = 0; row < 3; row++) {
      const x = side * 0.57,
        y = 0.48 - row * 0.44;
      outline(od, rect(x, y, 1, 0.38, -0.055), 0.003, ink);
      for (let j = 0; j < 6; j++) {
        const xx = x - 0.4 + j * 0.16;
        op.knob(xx, y - 0.055, -0.065, 0.015);
        od.box([0.055, 0.025, 0.009], [xx, y + 0.065, -0.065], m.dark);
      }
    }
  od.finish();
  for (const side of [-1, 1]) {
    const fan = group(cabin, `AN124-cabin-fan-${side}`, [side * 0.52, 9.72, 28.04]),
      fd = detailKit(fan, fan.name);
    fd.rod([0, 0.19, 0.04], [0, 0, 0], 0.014, m.metal);
    fd.ring(0.11, 0.01, [0, 0, 0], m.dark);
    for (let j = 0; j < 3; j++) {
      const a = (j * Math.PI * 2) / 3;
      ellipsoid(fd, [Math.sin(a) * 0.055, Math.cos(a) * 0.055, 0], [0.05, 0.067, 0.012], m.dark, 8);
    }
    ellipsoid(fd, [0, 0, -0.01], [0.03, 0.03, 0.035], m.dark, 8);
    fd.finish();
    d.box([0.55, 0.025, 0.28], [side * 1.3, 9.62, 27.5], m.dark);
  }
  // Columns, U-shaped handwheels, pedal pairs and six seats.
  function seatAt(name, x, z, rotation = 0) {
    const g = group(cabin, `AN124-seat-${name}`, [x, 7.55, z]);
    g.rotation.y = rotation;
    const dd = detailKit(g, g.name);
    dd.box([0.45, 0.35, 0.55], [0, 0.22, 0], m.metal);
    beveledBox(dd, [0.67, 0.17, 0.7], [0, 0.52, 0], cushion, 0.03);
    beveledBox(dd, [0.67, 0.94, 0.19], [0, 1.04, -0.34], seat, 0.035);
    beveledBox(dd, [0.48, 0.23, 0.2], [0, 1.6, -0.38], seat, 0.03);
    for (const dx of [-0.36, 0.36]) beveledBox(dd, [0.08, 0.07, 0.44], [dx, 0.78, 0], seat, 0.012);
    for (const dx of [-0.17, 0.17]) dd.rod([dx, 1.5, -0.22], [dx * 0.5, 0.61, -0.21], 0.025, belt);
    dd.rod([-0.26, 0.62, -0.2], [0.24, 0.62, 0.2], 0.025, belt);
    dd.finish();
  }
  for (const side of [-1, 1]) {
    const x = side * 0.98,
      col = group(cabin, `AN124-column-${side}`, [x, 7.65, 27.85]),
      cd = detailKit(col, col.name);
    cd.rod([0, 0, 0], [0, 0.91, -0.1], 0.07, m.dark);
    for (let j = 0; j < 8; j++) cd.ring(0.075, 0.012, [0, 0.55 + j * 0.04, -0.06], m.dark, 'y');
    cd.finish();
    bindings.push({
      node: col.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: -0.18,
    });
    const yoke = group(col, `AN124-yoke-${side}`, [0, 0.96, -0.1]),
      yd = detailKit(yoke, yoke.name);
    outline(
      yd,
      [
        [-0.24, 0.17, 0],
        [-0.24, -0.02, 0],
        [-0.14, -0.14, 0],
        [0.14, -0.14, 0],
        [0.24, -0.02, 0],
        [0.24, 0.17, 0],
      ],
      0.029,
      m.dark,
      false,
    );
    beveledBox(yd, [0.16, 0.19, 0.08], [0, -0.04, -0.02], m.dark);
    for (const xx of [-0.24, 0.24]) yd.rod([xx, 0.04, 0], [xx, 0.2, 0], 0.033, liner);
    yd.finish();
    bindings.push({
      node: yoke.name,
      source: 'rollInput',
      property: 'rotation',
      axis: 'z',
      scale: 0.65,
    });
    for (const dx of [-0.18, 0.18]) {
      const pg = group(cabin, `AN124-pedal-${side}-${Math.sign(dx)}`, [x + dx, 7.79, 28.37]),
        pd = detailKit(pg, pg.name);
      pd.box([0.23, 0.28, 0.05], [0, 0, 0], m.metal);
      for (let j = 0; j < 6; j++)
        pd.rod([-0.1, -0.1 + j * 0.04, -0.03], [0.1, -0.1 + j * 0.04, -0.03], 0.005, m.dark);
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: Math.sign(dx) * 0.055,
      });
    }
    seatAt(`pilot-${side}`, x, 26.7);
    for (const [j, zz] of [24.3, 22.6].entries())
      seatAt(`crew-${side}-${j}`, side * 1.06, zz, (-side * Math.PI) / 2);
  }
  // Distinct paired radio/navigation and engineer desks; grouped switches follow the cabin photos.
  for (const side of [-1, 1]) {
    d.box([0.75, 0.09, 4.2], [side * 1.64, 8.22, 23.9], wood);
    for (const upper of [false, true]) {
      const g = group(cabin, `AN124-systems-${side}-${upper}`, [
        side * (upper ? 1.74 : 2.14),
        upper ? 8.94 : 8.45,
        23.9,
      ]);
      // Tilt about the panel's fore/aft local axis after mounting it on the sidewall.
      g.rotation.order = 'YXZ';
      g.rotation.y = (side * Math.PI) / 2;
      g.rotation.x = upper ? -0.34 : 0;
      const dd = detailKit(g, g.name),
        pp = panelTools(dd);
      beveledBox(dd, [4.15, upper ? 1.03 : 1.05, 0.1], [0, 0, 0], face, 0.015);
      for (let col = 0; col < 6; col++) {
        const xx = -1.71 + col * 0.68;
        outline(dd, rect(xx, 0, 0.62, 0.94, -0.06), 0.003, ink);
        dd.text(
          side > 0 ? (upper ? 'RADIO' : 'NAV') : upper ? 'ELECTRICAL' : 'ENGINES',
          [xx, 0.41, -0.065],
          0.022,
          Math.PI,
          ink,
        );
        if (!upper && side < 0 && col < 4) {
          for (let row = 0; row < 3; row++) {
            const yy = 0.24 - row * 0.26;
            dd.add(new T.CircleGeometry(0.085, 24).rotateY(Math.PI), black, [
              xx - 0.12,
              yy,
              -0.065,
            ]);
            dd.ring(0.083, 0.004, [xx - 0.12, yy, -0.067], m.metal);
            dd.text('--', [xx - 0.12, yy, -0.07], 0.02, Math.PI, ink);
            pp.knob(xx + 0.17, yy, -0.075, 0.018);
          }
        } else if (!upper && side > 0 && col < 2) {
          dd.box([0.5, 0.43, 0.025], [xx, 0.1, -0.06], m.dark);
          dd.text('--', [xx, 0.1, -0.08], 0.03, Math.PI, ink);
          for (let j = 0; j < 4; j++) pp.knob(xx - 0.2 + j * 0.13, -0.28, -0.08, 0.021);
        } else
          for (let row = 0; row < 4; row++)
            for (let j = 0; j < 4; j++) {
              const x = xx - 0.22 + j * 0.145,
                y = 0.25 - row * 0.18;
              dd.rod([x, y, -0.065], [x, y + 0.03, -0.11], 0.008, m.metal);
              if (row === 3) dd.box([0.06, 0.035, 0.008], [x, y - 0.06, -0.07], m.dark);
            }
      }
      dd.finish();
    }
    for (const zz of [23, 25]) {
      d.box([0.36, 0.012, 0.46], [side * 1.58, 8.28, zz], liner);
      for (let j = 0; j < 6; j++)
        d.rod(
          [side * 1.43, 8.288, zz - 0.16 + j * 0.05],
          [side * 1.71, 8.288, zz - 0.16 + j * 0.05],
          0.003,
          m.dark,
        );
    }
  }
  d.box([4.35, 0.08, 7.7], [0, 7.51, 24.7], m.dark);
  d.box([3.0, 0.05, 3.2], [0, 9.48, 22.8], liner);
  for (const zz of [21.5, 22.7, 23.9])
    d.rod([-1.48, 9.445, zz], [1.48, 9.445, zz], 0.008, m.metal);
  sheet(d, rect(0, 8.7, 4.4, 2.35, 20.9), liner, [0, 0, 1], [rect(0, 8.5, 0.8, 1.9, 20.9)]);

  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
