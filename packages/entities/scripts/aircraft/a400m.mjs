/** A400M Atlas: explicit stations from Airbus's 2025 general-arrangement views.
 * Cockpit layout from Belyakov's ILA2014 and MOD flight-deck photographs. */
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

export const a400Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 2.82,
  cy: 3.65,
  ry: 2.55,
  cabinZ: 18.6,
  cabinWidth: 3.0,
  eye: [0.83, 5.3, 18.6],
  panelZ: 19.45,
  floor: 3.4,
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
  return g;
}
export function buildA400M(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('A400-airframe', '#929b9b', { side: T.DoubleSide }),
    dark = mat('A400-trim', '#28333a', { side: T.DoubleSide }),
    metal = mat('A400-alloy', '#a0a8aa', { metalness: 0.7 }),
    seam = mat('A400-seams', '#626e72'),
    rubber = mat('A400-tires', '#182025'),
    glass = mat('A400-glass', '#accbd1', {
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.16,
    });
  const d = detailKit(root, 'A400-exterior'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  // Side image: nose172px, tail988px, ground322px. Widths cross-checked in top/front.
  const ppm = 816 / 45.1,
    sz = (u) => 22.55 - (u - 172) / ppm,
    sy = (v) => (322 - v) / ppm;
  const stations = [
    [172, 0.025, 267, 264],
    [185, 0.65, 278, 249],
    [200, 1.15, 286, 231],
    [218, 1.32, 291, 216],
    [239, 1.87, 295, 211],
    [259, 2.32, 297, 210],
    [285, 2.75, 300, 209],
    [330, 2.82, 300, 209],
    [390, 2.82, 300, 205],
    [460, 2.82, 300, 199],
    [550, 2.82, 300, 210],
    [630, 2.8, 287, 209],
    [700, 2.6, 266, 205],
    [760, 2.12, 245, 201],
    [810, 1.43, 228, 198],
    [854, 0.75, 212, 198],
    [879, 0.04, 205, 200],
  ];
  const rings = stations.map(([u, w, b, t]) => {
    const top = sy(t),
      bottom = sy(b),
      h = top - bottom;
    return {
      z: sz(u),
      points: [
        [0, top],
        [0.5 * w, top - 0.025 * h],
        [0.86 * w, top - 0.13 * h],
        [w, top - 0.31 * h],
        [w, bottom + 0.32 * h],
        [0.86 * w, bottom + 0.12 * h],
        [0.5 * w, bottom + 0.025 * h],
        [0, bottom],
        [-0.5 * w, bottom + 0.025 * h],
        [-0.86 * w, bottom + 0.12 * h],
        [-w, bottom + 0.32 * h],
        [-w, top - 0.31 * h],
        [-0.86 * w, top - 0.13 * h],
        [-0.5 * w, top - 0.025 * h],
      ],
    };
  });
  const p = (i, j) => [...rings[i].points[(j + 14) % 14], rings[i].z],
    lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  loft(d, rings, paint, {
    skip: (i, j) =>
      i < 2 ||
      ([2, 3].includes(i) && [0, 1, 12, 13].includes(j)) ||
      ([3, 4].includes(i) && [2, 11].includes(j)),
  });
  // Six continuous window panes. Construction facets do not become extra frames.
  for (const side of [-1, 1]) {
    const j = side > 0 ? 2 : 12,
      k = side > 0 ? 1 : 13,
      contour = [p(2, 0), p(3, 0), p(4, 0), p(4, k), p(4, j), p(3, j), p(2, j), p(2, k)];
    const at = (u, v) => lerp(lerp(p(2, 0), p(4, 0), v), lerp(p(2, j), p(4, j), v), u);
    const hole = [at(0.06, 0.17), at(0.06, 0.7), at(0.9, 0.92), at(0.9, 0.42)];
    sheet(d, contour, paint, [side * 0.3, 1, 1], [hole]);
    sheet(d, hole, glass, [side * 0.3, 1, 1]);
    outline(d, hole, 0.022, dark);
    for (const i of [3, 4]) {
      const a = p(i, j),
        b = p(i + 1, j),
        c = p(i + 1, j + side),
        e = p(i, j + side),
        q = (u, v) => lerp(lerp(a, b, u), lerp(e, c, u), v);
      const pane = [q(0.11, 0.1), q(0.88, 0.13), q(0.86, 0.78), q(0.14, 0.83)];
      sheet(d, [a, b, c, e], paint, [side, 1, 0.3], [pane]);
      sheet(d, pane, glass, [side, 1, 0.3]);
      outline(d, pane, 0.022, dark);
    }
    d.rod([side * 0.3, 5.13, 20.45], [side * 0.62, 5.26, 20.1], 0.015, dark);
    d.rod([side * 0.62, 5.26, 20.1], [side * 0.92, 5.38, 19.8], 0.012, dark);
  }
  // Nose radome follows the nose stations rather than an oversized spherical attachment.
  const noseSection = (u, w, b, t) => ({
    z: sz(u),
    points: rings[2].points.map(([x, y]) => [
      (x / 1.15) * w,
      sy(b) + ((y - sy(286)) / (sy(231) - sy(286))) * (sy(t) - sy(b)),
    ]),
  });
  loft(
    d,
    [
      rings[0],
      noseSection(178, 0.32, 274, 255),
      rings[1],
      noseSection(192, 0.95, 283, 240),
      rings[2],
    ],
    dark,
    { caps: false },
  );
  outline(
    d,
    rings[2].points.map(([x, y]) => [x * 1.006, y, rings[2].z + 0.005]),
    0.012,
    seam,
  );
  // Refuelling probe and subtle roof fittings.
  d.rod([0.77, 6.06, 18.2], [0.77, 6.45, 20.3], 0.052, paint);
  d.rod([0.77, 6.45, 20.3], [0.77, 6.22, 22.35], 0.04, metal);
  for (const z of [13, 1, -8])
    sheet(
      d,
      [
        [0.02, 6.15, z + 0.26],
        [0.02, 6.56, z - 0.03],
        [0.02, 6.15, z - 0.3],
      ],
      dark,
      [1, 0, 0],
    );
  // Main gear sponsons, carefully separated from the cargo body.
  for (const side of [-1, 1]) {
    loft(
      d,
      [
        [9.8, 0.12, 1.7, 0.12],
        [8.1, 0.62, 1.7, 0.58],
        [4.3, 0.88, 1.65, 0.78],
        [-0.8, 0.86, 1.65, 0.68],
        [-3.2, 0.45, 1.8, 0.42],
        [-4.1, 0.05, 2, 0.06],
      ].map(([z, r, y, h]) => ({
        z,
        points: Array.from({ length: 16 }, (_, i) => [
          side * (2.45 + Math.sin((i * Math.PI) / 8) * r),
          y + Math.cos((i * Math.PI) / 8) * h,
        ]),
      })),
      paint,
    );
  }
  const ws = [
    [0, 6.58, 9.48, 1.83, 0.31],
    [2.82, 6.55, 9.07, 1.66, 0.3],
    [6.85, 6.25, 7.77, 1.42, 0.26],
    [12.85, 5.81, 5.85, 1.06, 0.19],
    [21.2, 5.13, 2.89, 0.56, 0.08],
  ];
  const interpolate = (x) => {
    let i = 0;
    while (i < ws.length - 2 && x > ws[i + 1][0]) i++;
    const a = ws[i],
      b = ws[i + 1],
      t = (x - a[0]) / (b[0] - a[0]);
    return a.map((v, k) => (k === 0 ? x : v + (b[k] - v) * t));
  };
  for (const side of [-1, 1]) {
    wing(
      d,
      ws.map(([x, y, le, te, h]) => [side * x, y, le, le + (te - le) * 0.73, h]),
      paint,
    );
    for (const [i, lo, hi, kind] of [
      [0, 2.83, 10.3, 'flap'],
      [1, 10.34, 16.7, 'flap'],
      [0, 16.74, 21.2, 'aileron'],
    ]) {
      const st = [lo, ...ws.map((a) => a[0]).filter((x) => x > lo && x < hi), hi].map((x) => {
        const a = interpolate(x);
        return [side * x, a[1], a[2] + (a[3] - a[2]) * 0.73, a[3], a[4] * 0.45];
      });
      hinge(
        root,
        `A400-${kind}-${side}${kind === 'flap' ? `-${i}` : ''}`,
        st,
        paint,
        bindings,
        kind === 'flap' ? 'flapPosition' : 'rollInput',
        kind === 'flap' ? -0.6 * side : -0.35,
      );
    }
    for (const x of [4.3, 8.8, 13.3, 16.3]) {
      const a = interpolate(x);
      ellipsoid(d, [side * x, a[1] - 0.2, a[3] - 0.25], [0.1, 0.17, 0.75], paint, 12);
    }
    for (const f of [0.12, 0.47, 0.71])
      outline(
        d,
        ws.map(([x, y, le, te, h]) => [side * x, y + h * 0.8 + 0.008, le + (te - le) * f]),
        0.009,
        seam,
        false,
      );
    for (const x of [6.85, 12.85, 18.2]) {
      const a = interpolate(x);
      d.rod(
        [side * x, a[1] + a[4] + 0.01, a[2] - 0.4],
        [side * x, a[1] + a[4] * 0.6 + 0.01, a[3] + 0.35],
        0.008,
        seam,
      );
    }
    ellipsoid(d, [side * 21.16, 5.17, 2.75], [0.04, 0.045, 0.12], side > 0 ? d.red : d.green, 10);
  }
  // Tall swept fin and almost level T-tail; dimensions estimated from the manufacturer views.
  const fin = [
      [0, 6.75, -8.75],
      [0, 7.25, -10.1],
      [0, 14.7, -14.1],
      [0, 13.68, -19.8],
      [0, 6.7, -15.3],
    ],
    fth = (p) => (p[1] > 12 ? 0.12 : 0.23);
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * fth(p), p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-fth(a), a[1], a[2]],
      [-fth(b), b[1], b[2]],
      [fth(b), b[1], b[2]],
      [fth(a), a[1], a[2]],
      paint,
      [0, b[2] - a[2], a[1] - b[1]],
    );
  }
  const rm = group(root, 'A400-rudder-mount', [0, 6.7, -15.3]),
    rg = group(rm, 'A400-rudder');
  rm.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    new T.Vector3(0, 6.98, -4.5).normalize(),
  );
  const rd = detailKit(rg, rg.name),
    ri = new T.Matrix4().compose(rm.position, rm.quaternion, new T.Vector3(1, 1, 1)).invert(),
    rp = (x, y, z) => new T.Vector3(x, y, z).applyMatrix4(ri).toArray();
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        rp(side * 0.07, 6.7, -15.3),
        rp(side * 0.045, 13.68, -19.8),
        rp(side * 0.045, 13.68, -20.9),
        rp(side * 0.07, 6.7, -16.6),
      ],
      paint,
      [side, 0, 0],
    );
  quad(
    rd,
    rp(-0.07, 6.7, -16.6),
    rp(-0.045, 13.68, -20.9),
    rp(0.045, 13.68, -20.9),
    rp(0.07, 6.7, -16.6),
    paint,
    [0, 0, -1],
  );
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  for (const side of [-1, 1]) {
    const st = [
      [side * 0.2, 13.63, -13.97, -19.13, 0.25],
      [side * 8.55, 13.63, -20.48, -22.05, 0.1],
      [side * 9.5, 13.58, -21.4, -22.55, 0.035],
    ];
    wing(
      d,
      st.map(([x, y, l, t, h]) => [x, y, l, l + (t - l) * 0.73, h]),
      paint,
    );
    hinge(
      root,
      `A400-elevator-${side}`,
      st.map(([x, y, l, t, h]) => [x, y, l + (t - l) * 0.73, t, h * 0.45]),
      paint,
      bindings,
      'pitchInput',
      side * 0.32,
    );
  }
  ellipsoid(d, [0, 13.8, -17.45], [0.36, 0.48, 3.7], paint, 16);
  // Handed propellers rotate DOWN between engines. Engine numbering is left outer to right outer.
  for (const [i, x] of [12.85, 6.85, -6.85, -12.85].entries()) {
    const outer = Math.abs(x) > 10,
      cy = outer ? 4.58 : 4.98,
      z = outer ? 9.3 : 11.0,
      hand = outer ? Math.sign(x) : -Math.sign(x),
      id = `engine-${i + 1}`;
    const nr = [
      [z - 0.12, 0.52, cy, 0.56],
      [z - 0.7, 0.7, cy - 0.14, 0.89],
      [z - 2, 0.78, cy - 0.07, 0.98],
      [z - 3.7, 0.65, cy + 0.17, 0.83],
      [z - 5.2, 0.34, cy + 0.4, 0.34],
      [z - 5.55, 0.12, cy + 0.48, 0.12],
    ].map(([zz, rx, y, ry]) => ({
      z: zz,
      points: Array.from({ length: 20 }, (_, j) => [
        x + Math.sin((j * Math.PI) / 10) * rx,
        y + Math.cos((j * Math.PI) / 10) * ry,
      ]),
    }));
    loft(d, nr, paint, { caps: false });
    ellipsoid(d, [x, cy - 0.6, z - 0.2], [0.37, 0.28, 0.09], dark, 20);
    d.ring(0.25, 0.022, [x, cy - 0.63, z - 0.14], metal);
    d.add(new T.CircleGeometry(0.26, 20).rotateY(Math.PI), dark, [x, cy + 0.37, z - 5.22]);
    d.ring(0.28, 0.028, [x, cy + 0.37, z - 5.24], metal);
    for (const [z0, rx, y, ry] of [
      [z - 1, 0.72, cy - 0.12, 0.94],
      [z - 3.1, 0.71, cy + 0.08, 0.92],
    ])
      outline(
        d,
        Array.from({ length: 20 }, (_, j) => [
          x + Math.sin((j * Math.PI) / 10) * rx,
          y + Math.cos((j * Math.PI) / 10) * ry,
          z0,
        ]),
        0.009,
        seam,
      );
    const pg = group(root, `A400-propeller-${i + 1}`, [x, cy, z]),
      pd = detailKit(pg, pg.name);
    ellipsoid(pd, [0, 0, 0.33], [0.49, 0.49, 0.65], dark, 20);
    for (let j = 0; j < 8; j++) {
      const bg = group(pg, `A400-blade-${i + 1}-${j}`);
      bg.rotation.z = (j * Math.PI) / 4;
      const bd = detailKit(bg, bg.name),
        shape = [
          [-0.12, 0.4, 0],
          [-0.19, 0.83, 0.025],
          [-0.22, 1.5, 0.075],
          [-0.12, 2.1, 0.1],
          [0.1, 2.6, 0.12],
          [0.24, 2.656, 0.13],
          [0.33, 2.57, 0.13],
          [0.22, 2.2, 0.11],
          [0.15, 1.48, 0.07],
          [0.13, 0.45, 0],
        ].map(([xx, y, zz]) => [xx * hand, y, zz]);
      sheet(bd, shape, dark, [0, 0, 1]);
      sheet(
        bd,
        shape.map(([xx, y, zz]) => [xx, y, zz - 0.035]),
        dark,
        [0, 0, -1],
      );
      for (let k = 0; k < shape.length; k++) {
        const a = shape[k],
          b = shape[(k + 1) % shape.length];
        quad(bd, a, b, [b[0], b[1], b[2] - 0.035], [a[0], a[1], a[2] - 0.035], dark, [
          b[1] - a[1],
          a[0] - b[0],
          0,
        ]);
      }
      bd.rod([0.1 * hand, 2.59, 0.137], [0.29 * hand, 2.61, 0.137], 0.025, d.amber);
      bd.finish();
    }
    pd.finish();
    rotors.push({ node: pg.name, axis: 'z', multiplier: hand, engine: id });
    enginePoints.push({ id, position: [x, cy, z - 1] });
  }
  const wheel = (dd, x, y, z, r, w) => {
    dd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), rubber, [x, y, z]);
    for (const side of [-1, 1]) {
      dd.add(new T.CylinderGeometry(r * 0.51, r * 0.51, 0.025, 18).rotateZ(Math.PI / 2), metal, [
        x + side * (w / 2 + 0.008),
        y,
        z,
      ]);
      dd.ring(r * 0.79, 0.012, [x + (side * w) / 2, y, z], seam, 'x');
      for (let j = 0; j < 6; j++)
        dd.add(new T.SphereGeometry(1, 6, 3).scale(0.016, 0.027, 0.027), dark, [
          x + side * (w / 2 + 0.024),
          y + Math.sin((j * Math.PI) / 3) * r * 0.34,
          z + Math.cos((j * Math.PI) / 3) * r * 0.34,
        ]);
    }
  };
  // Three independent twin-wheel legs each side, not C-17's three-abreast trucks.
  for (const side of [-1, 1]) {
    const g = group(root, `A400-main-gear-${side}`),
      dd = detailKit(g, g.name);
    for (const z of [6.0, 4.2, 2.4]) {
      for (const dx of [-0.31, 0.31]) wheel(dd, side * 3.12 + dx, 0.52, z, 0.52, 0.31);
      dd.rod([side * 3.12, 0.52, z], [side * 2.65, 2, z + 0.2], 0.071, metal);
      dd.rod([side * 2.8, 1.45, z + 0.1], [side * 2.55, 1.9, z - 0.7], 0.04, metal);
      dd.box([0.034, 0.52, 1.15], [side * 3.53, 1.45, z], paint);
    }
    dd.finish();
    bindings.push(
      { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -1.35, offset: 1.35 },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  const ng = group(root, 'A400-nose-gear', [0, 0, 17.52]),
    nd = detailKit(ng, ng.name);
  for (const side of [-1, 1]) {
    wheel(nd, side * 0.25, 0.405, 0, 0.405, 0.22);
    nd.rod([side * 0.16, 0.41, 0], [side * 0.1, 0.95, -0.08], 0.034, metal);
    nd.box([0.025, 0.38, 1.25], [side * 0.4, 1.02, -0.2], paint);
  }
  nd.rod([0, 0.75, 0], [0, 1.75, -0.18], 0.06, metal);
  nd.rod([0, 1.2, -0.1], [0, 1.5, -0.7], 0.035, metal);
  nd.finish();
  bindings.push(
    { node: ng.name, source: 'gear', property: 'position', axis: 'y', scale: -1.25, offset: 1.25 },
    { node: ng.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
  );
  // Door and ramp seams and sparse structural fasteners; no fictitious all-over rivet grid.
  const skin = (side, y, z, offset = 0.014) => {
    let i = 0;
    while (i < rings.length - 2 && z < rings[i + 1].z) i++;
    const a = rings[i],
      b = rings[i + 1],
      t = (a.z - z) / (a.z - b.z),
      ring = a.points.map((p, j) => lerp(p, b.points[j], t));
    for (let j = 0; j < 7; j++) {
      const p = ring[j],
        q = ring[j + 1];
      if (y <= p[1] && y >= q[1]) {
        const f = (y - p[1]) / (q[1] - p[1]);
        return [side * (p[0] + (q[0] - p[0]) * f + offset), y, z];
      }
    }
    throw Error('A400 exterior fitting outside shell');
  };
  for (const side of [-1, 1]) {
    for (const [z, y] of [
      [16.1, 2.6],
      [0.2, 2.95],
    ]) {
      const q = [
        [y - 0.8, z + 0.48],
        [y + 0.8, z + 0.48],
        [y + 1, z + 0.32],
        [y + 1, z - 0.32],
        [y + 0.8, z - 0.48],
        [y - 0.8, z - 0.48],
      ].map(([yy, zz]) => skin(side, yy, zz));
      outline(d, q, 0.016, seam);
      d.rod(
        skin(side, y + 0.2, z - 0.18, 0.025),
        skin(side, y + 0.2, z + 0.05, 0.025),
        0.022,
        metal,
      );
      d.text('EXIT', skin(side, y + 0.68, z, 0.025), 0.09, (side * Math.PI) / 2, d.ivory);
    }
    for (const [z, y] of [
      [13.2, 3.45],
      [-4.2, 4.35],
    ]) {
      d.add(
        new T.CircleGeometry(0.18, 24).rotateY((side * Math.PI) / 2),
        dark,
        skin(side, y, z, 0.025),
      );
      d.ring(0.19, 0.015, skin(side, y, z, 0.035), metal, 'x');
    }
    outline(
      d,
      rings.slice(10, 16).map((r) => [side * r.points[5][0] * 1.004, r.points[5][1] + 0.01, r.z]),
      0.015,
      seam,
      false,
    );
    d.text('A400M', [side * 2.83, 4.7, 12.5], 0.31, (side * Math.PI) / 2, dark);
  }
  for (const index of [6, 8, 11, 13]) {
    const r = rings[index];
    outline(
      d,
      r.points.map(([x, y]) => [x * 1.003, y + 0.006, r.z]),
      0.008,
      seam,
    );
    for (let j = 3; j < 12; j++) {
      const a = r.points[j],
        b = r.points[(j + 1) % 14];
      for (let k = 0; k < 4; k++) {
        const t = k / 4;
        d.add(new T.SphereGeometry(0.012, 6, 3), metal, [
          (a[0] + (b[0] - a[0]) * t) * 1.005,
          a[1] + (b[1] - a[1]) * t + 0.004,
          r.z + 0.045,
        ]);
      }
    }
  }
  ellipsoid(d, [0, 6.28, 12], [0.1, 0.07, 0.13], d.red, 10);
  d.finish();
  const interior = cockpit(root, { paint, dark, metal, glass });
  cleanGeometry(root);
  return {
    root,
    frame: a400Frame(),
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
    d = detailKit(cabin, 'A400-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'A400'),
    { bindings, derived, ink, black, amber } = ins;
  const face = mat('A400-panel', '#697b86', { side: T.DoubleSide }),
    liner = mat('A400-liner', '#abb7b7', { side: T.DoubleSide }),
    seat = mat('A400-seat', '#424f5a'),
    cushion = mat('A400-cushion', '#adb3aa'),
    belt = mat('A400-harness', '#788a90'),
    green = mat('A400-display-green', '#79cc98', { emissive: '#245b38', emissiveIntensity: 0.5 });
  const sources = Object.fromEntries(
    ['airspeed', 'pitch', 'roll', 'yaw', 'verticalSpeed', 'gearPosition', 'flapPosition'].map(
      (k) => [
        { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
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
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', 2 * Math.PI] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  const z = 19.45,
    y = 4.57,
    w = 0.3,
    h = 0.4,
    screenXs = [1.04, 0.68, 0.19, -0.19, -0.68, -1.04];
  const contour = [
    [-1.48, 4.23, z],
    [-1.48, 4.7, z],
    [-1.23, 4.85, z],
    [1.23, 4.85, z],
    [1.48, 4.7, z],
    [1.48, 4.23, z],
    [0.5, 4.23, z],
    [0.5, 4.13, z],
    [-0.5, 4.13, z],
    [-0.5, 4.23, z],
  ];
  sheet(
    d,
    contour,
    face,
    [0, 0, -1],
    [...screenXs.map((x) => rect(x, y, w, h, z)), rect(0.435, 4.675, 0.073, 0.078, z)],
  );
  outline(d, contour, 0.016, m.dark);
  function rose(parent, label, x, yy, r, dd) {
    const g = group(parent, `A400-${label}-heading`, [x, yy, -0.02]),
      rd = detailKit(g, g.name);
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (rr) => [-Math.sin(a) * rr, Math.cos(a) * rr, 0];
      rd.rod(p(r * (deg % 30 ? 0.89 : 0.82)), p(r), 0.0008, ink);
      if (deg % 30 === 0)
        rd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(r * 0.65),
          r * 0.14,
          Math.PI,
          ink,
        );
    }
    rd.finish();
    bindings.push({
      node: g.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: 2 * Math.PI,
      responseSeconds: 0.15,
    });
    ins.available(`${label}-heading`, 'trueHeading', g.name);
    dd.rod([x, yy + r + 0.006, -0.022], [x, yy + r - 0.008, -0.022], 0.0015, amber);
  }
  for (const [i, x] of screenXs.entries()) {
    sheet(
      d,
      rect(x, y, w + 0.035, h + 0.03, z - 0.006),
      m.dark,
      [0, 0, -1],
      [rect(x, y, w, h, z - 0.006)],
    );
    for (const xx of [x - w / 2 + 0.02, x + w / 2 - 0.02])
      for (const yy of [y - h / 2 + 0.02, y + h / 2 - 0.02])
        d.add(new T.CylinderGeometry(0.003, 0.003, 0.002, 6).rotateX(Math.PI / 2), m.metal, [
          xx,
          yy,
          z - 0.014,
        ]);
    if (i === 0 || i === 5) {
      const label = i === 0 ? 'pilot' : 'copilot',
        g = group(cabin, `A400-${label}-display`, [x, y, z + 0.016]),
        dd = detailKit(g, g.name),
        ii = instrumentGeometry(g, `A400-${label}`);
      ii.horizon('horizon', [0, 0.07, 0], 0.185, 0.19, { blankBackdrop: true });
      sheet(dd, rect(0, 0, w, h, -0.012), black, [0, 0, -1], [rect(0, 0.07, 0.185, 0.19, -0.012)]);
      ii.readout('speed', [0.12, 0.07, -0.02], 'knots', 3, 0.011, ink, false, true);
      dd.text('TAS', [0.12, 0.13, -0.022], 0.007, Math.PI, ink);
      ii.readout('altitude', [-0.12, 0.07, -0.02], 'feet', 5, 0.008, ink, true, true);
      dd.text('GEO FT', [-0.12, 0.13, -0.022], 0.006, Math.PI, ink);
      rose(g, label, 0, -0.09, 0.058, dd);
      dd.text('TRUE', [0, -0.013, -0.022], 0.006, Math.PI, ink);
      ii.readout('vertical', [-0.1, -0.09, -0.02], 'verticalFpm', 4, 0.008, ink, true, true);
      dd.text('FPM', [-0.1, -0.135, -0.022], 0.006, Math.PI, ink);
      dd.text('SIM', [0.11, -0.13, -0.022], 0.008, Math.PI, green);
      dd.finish();
      bindings.push(...ii.bindings);
      Object.assign(derived, ii.derived);
    } else if (i === 1 || i === 4) {
      const label = i === 1 ? 'pilot-nav' : 'copilot-nav',
        g = group(cabin, `A400-${label}`, [x, y, z]),
        dd = detailKit(g, g.name);
      dd.box([w, h, 0.005], [0, 0, 0.012], black);
      rose(g, label, 0, -0.02, 0.112, dd);
      dd.text('TRUE HEADING', [0, 0.168, 0], 0.01, Math.PI, green);
      dd.text('NAV --', [0, -0.17, 0], 0.012, Math.PI, green);
      dd.rod([0, -0.01, -0.025], [0, 0.016, -0.025], 0.002, amber);
      dd.finish();
    } else {
      sheet(d, rect(x, y, w, h, z + 0.009), black, [0, 0, -1]);
      if (i === 2) {
        d.text('SIM PROP RPM', [x, y + 0.17, z], 0.01, Math.PI, green);
        for (let j = 0; j < 4; j++) {
          const value = `propRpm${j + 1}`,
            source = `engine${j + 1}`;
          sources[source] = {
            component: 'aircraftState',
            path: ['engines', `engine-${j + 1}`, 'rpm'],
          };
          derived[value] = { op: 'multiply', args: [source, 860] };
          const xx = x + 0.105 - j * 0.07;
          ins.dial(
            `rpm-${j + 1}`,
            [xx, y + 0.07, z],
            0.027,
            value,
            [
              [0, -2.2],
              [946, 2.2],
            ],
            [0, 860],
            'RPM',
            { material: green, responseSeconds: 0.15 },
          );
          d.text(String(j + 1), [xx, y + 0.125, z], 0.009, Math.PI, ink);
          for (const yy of [y - 0.01, y - 0.065]) {
            d.add(new T.RingGeometry(0.019, 0.02, 16).rotateY(Math.PI), green, [xx, yy, z]);
            d.text('--', [xx, yy, z - 0.002], 0.008, Math.PI, green);
          }
        }
        d.text('TRQ ITT NG --', [x, y - 0.125, z], 0.009, Math.PI, green);
      } else {
        d.text('FLIGHT CONTROLS', [x, y + 0.17, z], 0.009, Math.PI, green);
        ins.dial(
          'flaps',
          [x, y + 0.035, z],
          0.06,
          'flapPosition',
          [
            [0, -2],
            [1, 2],
          ],
          [0, 0.5, 1],
          'FLAP',
          { material: green },
        );
        const lg = group(cabin, 'A400-gear-down', [x, y - 0.085, z]),
          ld = detailKit(lg, lg.name);
        for (const xx of [-0.04, 0, 0.04])
          ld.box([0.016, 0.019, 0.003], [xx, xx === 0 ? 0.025 : 0, 0], green);
        ld.finish();
        bindings.push({
          node: lg.name,
          source: 'gearDown',
          property: 'visible',
          scale: 1,
          missing: 'hide',
        });
        d.text('GEAR', [x, y - 0.14, z], 0.009, Math.PI, green);
      }
    }
  }
  // Standby integrated display occupies the narrow strip beside the centre screens.
  const stx = 0.435;
  sheet(
    d,
    rect(stx, 4.675, 0.105, 0.13, z - 0.01),
    m.dark,
    [0, 0, -1],
    [rect(stx, 4.675, 0.073, 0.078, z - 0.01)],
  );
  ins.horizon('standby', [stx, 4.675, z + 0.016], 0.073, 0.078, { blankBackdrop: true });
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 3; col++) {
        const xx = side * (1.28 + col * 0.055),
          yy = 4.59 - row * 0.072;
        d.box([0.043, 0.032, 0.008], [xx, yy, z - 0.01], m.dark);
        if (row % 2 === 0) pt.knob(xx, yy - 0.023, z - 0.021, 0.012);
      }
    // Folding trays below each display pair.
    d.box([0.62, 0.035, 0.28], [side * 0.88, 4.23, 19.2], m.dark);
    d.rod([side * 0.58, 4.22, 19.06], [side * 1.18, 4.22, 19.06], 0.014, m.metal);
  }
  // Deep glare shield, FCU and two radio/HUD control banks.
  d.box([2.77, 0.19, 0.45], [0, 5.0, 19.48], m.dark);
  for (const side of [-1, 1]) {
    d.box([0.63, 0.19, 0.022], [side * 0.92, 5.02, 19.24], face);
    d.box([0.39, 0.044, 0.008], [side * 0.92, 5.05, 19.222], black);
    d.text('COM --', [side * 0.92, 5.05, 19.215], 0.012, Math.PI, green);
    for (let j = 0; j < 6; j++)
      d.box([0.028, 0.021, 0.008], [side * 0.92 - 0.13 + j * 0.051, 4.995, 19.21], m.dark);
    pt.knob(side * 0.92 - 0.27, 5.03, 19.21, 0.024);
    pt.knob(side * 0.92 + 0.27, 5.03, 19.21, 0.024);
    d.box([0.24, 0.3, 0.03], [side * 1.36, 4.98, 19.31], face);
    for (let j = 0; j < 4; j++)
      d.box([0.045, 0.035, 0.01], [side * 1.4, 5.08 - j * 0.065, 19.29], m.dark);
    pt.knob(side * 1.3, 5.0, 19.28, 0.025);
  }
  for (const [x, label] of [
    [0.42, 'SPD'],
    [0.14, 'HDG'],
    [-0.14, 'ALT'],
    [-0.42, 'VS'],
  ]) {
    d.box([0.22, 0.05, 0.008], [x, 5.06, 19.23], black);
    d.text('--', [x, 5.06, 19.222], 0.014, Math.PI, green);
    d.text(label, [x, 4.965, 19.215], 0.01, Math.PI, ink);
    pt.knob(x, 5.0, 19.21, 0.025);
  }
  // Roof-mounted HUDs, unlike the C-17's glare-shield projectors.
  for (const side of [-1, 1]) {
    const x = side * 0.83;
    d.box([0.36, 0.16, 0.5], [x, 5.94, 19.07], m.dark);
    for (const dx of [-0.17, 0.17]) {
      d.rod([x + dx, 5.88, 19.08], [x + dx, 5.45, 19.25], 0.017, m.dark);
      d.rod([x + dx, 5.45, 19.25], [x + dx, 5.27, 19.12], 0.012, m.dark);
    }
    const pane = [
      [x - 0.145, 5.28, 19.13],
      [x + 0.145, 5.28, 19.13],
      [x + 0.17, 5.61, 19.31],
      [x - 0.17, 5.61, 19.31],
    ];
    sheet(d, pane, m.glass, [0, 1, -1]);
    outline(d, pane, 0.008, m.dark);
  }
  // Two sloping system screens, then the four-throttle bank and separate keyboards/trackballs.
  const ped = group(cabin, 'A400-center-console', [0, 3.98, 18.04]);
  ped.rotation.x = Math.PI / 2;
  const td = detailKit(ped, ped.name),
    tp = panelTools(td);
  beveledBox(td, [0.84, 2.3, 0.39], [0, 0, 0.08], face);
  const forward = group(cabin, 'A400-pedestal-screens', [0, 4.22, 18.91]);
  forward.rotation.x = Math.PI / 4;
  const fd = detailKit(forward, forward.name);
  for (const x of [-0.225, 0.225]) {
    beveledBox(fd, [0.39, 0.5, 0.035], [x, 0, 0], m.dark);
    fd.box([0.325, 0.405, 0.008], [x, 0.025, -0.023], black);
    fd.text(x > 0 ? 'SYSTEMS --' : 'FMS --', [x, 0.1, -0.028], 0.018, Math.PI, green);
    for (let j = 0; j < 6; j++)
      fd.box([0.027, 0.02, 0.009], [x - 0.13 + j * 0.052, -0.225, -0.026], m.dark);
  }
  fd.finish();
  for (let i = 0; i < 4; i++) {
    const x = 0.12 - i * 0.08;
    td.box([0.023, 0.61, 0.009], [x, 0.36, -0.12], black);
    const g = group(ped, `A400-throttle-${i + 1}`, [x, 0.28, -0.145]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.08, -0.22], 0.014, m.metal);
    beveledBox(dd, [0.075, 0.057, 0.055], [0, 0.08, -0.22], m.dark);
    dd.text(String(i + 1), [0, 0.08, -0.25], 0.012, Math.PI, ink);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.7,
      offset: -0.16,
    });
  }
  for (const x of [-0.27, 0.27]) {
    td.box([0.235, 0.42, 0.018], [x, -0.03, -0.13], m.dark);
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 5; col++)
        td.box(
          [0.029, 0.026, 0.009],
          [x - 0.084 + col * 0.042, 0.12 - row * 0.054, -0.145],
          m.dark,
        );
    ellipsoid(td, [x, -0.33, -0.17], [0.07, 0.075, 0.042], black, 16);
    for (const yy of [-0.58, -0.86]) {
      td.box([0.25, 0.19, 0.02], [x, yy, -0.13], m.dark);
      td.box([0.2, 0.035, 0.007], [x, yy + 0.055, -0.146], black);
      td.text('--', [x, yy + 0.055, -0.152], 0.012, Math.PI, green);
      for (let j = 0; j < 3; j++) tp.knob(x - 0.08 + j * 0.08, yy - 0.035, -0.16, 0.018);
      for (let j = 0; j < 5; j++)
        td.box([0.024, 0.018, 0.009], [x - 0.083 + j * 0.042, yy + 0.005, -0.15], black);
    }
  }
  for (const [x, name, source] of [
    [0.35, 'speedbrake', 'unavailable'],
    [-0.35, 'flap', 'flapPosition'],
  ]) {
    const g = group(ped, `A400-${name}-lever`, [x, -0.48, -0.16]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.03, -0.15], 0.011, m.metal);
    dd.box([0.065, 0.03, 0.045], [0, 0.03, -0.15], ink);
    dd.finish();
    if (source !== 'unavailable')
      bindings.push({ node: g.name, source, property: 'rotation', axis: 'x', scale: -0.6 });
  }
  td.finish();
  // Overhead groups follow MOD photograph: fire guards aft; fuel/electric/air schematics forward.
  const over = group(cabin, 'A400-overhead', [0, 6.0, 18.1]);
  over.rotation.x = -Math.PI / 2;
  const od = detailKit(over, over.name),
    op = panelTools(od);
  beveledBox(od, [1.17, 1.85, 0.09], [0, 0, 0.01], m.dark);
  for (const [label, x, yy, ww, hh] of [
    ['FIRE', 0.28, 0.63, 0.51, 0.49],
    ['DATA', -0.29, 0.63, 0.5, 0.49],
    ['ELEC', 0.28, 0.12, 0.51, 0.45],
    ['FUEL', -0.29, 0.12, 0.5, 0.45],
    ['HYD', 0.28, -0.37, 0.51, 0.43],
    ['AIR', -0.29, -0.37, 0.5, 0.43],
    ['LIGHT', 0, -0.74, 1.05, 0.24],
  ]) {
    outline(od, rect(x, yy, ww, hh, -0.04), 0.0035, ink);
    od.text(label, [x, yy + hh / 2 - 0.035, -0.05], 0.017, Math.PI, ink);
    if (label === 'FIRE') {
      for (let i = 0; i < 4; i++) {
        const xx = x - 0.135 + (i % 2) * 0.27,
          y0 = yy + 0.07 - Math.floor(i / 2) * 0.19;
        od.box([0.16, 0.085, 0.014], [xx, y0, -0.05], black);
        outline(od, rect(xx, y0, 0.17, 0.095, -0.07), 0.007, ins.red);
        od.text(String(i + 1), [xx, y0, -0.06], 0.017, Math.PI, ink);
        od.rod([xx - 0.087, y0 - 0.045, -0.04], [xx - 0.087, y0 + 0.045, -0.08], 0.005, m.metal);
      }
      continue;
    }
    const cols = label === 'LIGHT' ? 8 : 3,
      rows = label === 'LIGHT' ? 1 : 3;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const xx = x - ww * 0.32 + (col * ww * 0.64) / (cols - 1),
          y0 = yy + hh * 0.22 - row * hh * 0.26;
        od.box([0.062, 0.043, 0.012], [xx, y0, -0.05], black);
        outline(od, rect(xx, y0, 0.065, 0.046, -0.058), 0.0022, label === 'FIRE' ? ins.red : ink);
        od.rod([xx - 0.018, y0 + 0.008, -0.063], [xx + 0.018, y0 + 0.008, -0.063], 0.0015, ink);
        od.rod([xx - 0.012, y0 - 0.008, -0.063], [xx + 0.012, y0 - 0.008, -0.063], 0.0015, ink);
        if (row === 2) op.knob(xx, y0, -0.075, 0.016);
      }
    if (['ELEC', 'FUEL', 'HYD'].includes(label))
      od.rod([x - ww * 0.29, yy + 0.025, -0.066], [x + ww * 0.29, yy + 0.025, -0.066], 0.002, ink);
  }
  od.finish();
  for (const side of [-1, 1]) {
    const x = side * 0.83;
    // Sidestick fixed base/boot and articulated grip.
    d.box([0.3, 0.18, 0.45], [side * 1.34, 4.07, 18.29], face);
    for (let j = 0; j < 4; j++)
      beveledBox(
        d,
        [0.22 - j * 0.025, 0.025, 0.25 - j * 0.025],
        [side * 1.34, 4.18 + j * 0.027, 18.29],
        m.dark,
        0.008,
      );
    const sg = group(cabin, `A400-stick-${side}`, [side * 1.34, 4.28, 18.29]),
      sd = detailKit(sg, sg.name);
    sd.rod([0, 0, 0], [0, 0.25, 0.035], 0.032, m.dark);
    beveledBox(sd, [0.095, 0.14, 0.12], [0, 0.29, 0.03], m.dark);
    ellipsoid(sd, [side * 0.032, 0.37, 0.02], [0.017, 0.012, 0.017], ins.red, 8);
    sd.finish();
    bindings.push(
      { node: sg.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.22 },
      { node: sg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.22 },
    );
    for (const dx of [-0.17, 0.17]) {
      const pg = group(cabin, `A400-pedal-${side}-${Math.sign(dx)}`, [x + dx, 3.65, 19.23]),
        pd = detailKit(pg, pg.name);
      pd.box([0.21, 0.28, 0.05], [0, 0, 0], m.dark);
      for (let j = 0; j < 8; j++)
        pd.rod(
          [-0.09, -0.11 + j * 0.031, -0.028],
          [0.09, -0.11 + j * 0.031, -0.028],
          0.004,
          m.metal,
        );
      pd.finish();
      bindings.push({
        node: pg.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: Math.sign(dx) * 0.05,
      });
    }
    d.box([0.42, 0.3, 0.49], [x, 3.64, 17.86], m.metal);
    beveledBox(d, [0.64, 0.15, 0.66], [x, 3.92, 17.86], cushion, 0.035);
    const back = group(cabin, `A400-seat-${side}`, [x, 4.43, 17.51]);
    back.rotation.x = -0.1;
    const bd = detailKit(back, back.name);
    beveledBox(bd, [0.64, 0.88, 0.19], [0, 0, 0], seat, 0.04);
    beveledBox(bd, [0.5, 0.74, 0.045], [0, -0.02, 0.12], cushion, 0.018);
    beveledBox(bd, [0.43, 0.25, 0.17], [0, 0.52, 0], seat, 0.025);
    for (const dx of [-0.17, 0.17]) bd.rod([dx, 0.5, 0.11], [dx * 0.4, -0.4, 0.15], 0.027, belt);
    bd.finish();
    for (const dx of [-0.35, 0.35])
      beveledBox(d, [0.075, 0.08, 0.39], [x + dx, 4.17, 17.79], seat, 0.015);
    d.rod([x - 0.27, 4.01, 17.68], [x + 0.23, 4.01, 18.02], 0.027, belt);
    d.box([0.07, 0.027, 0.05], [x, 4.035, 17.87], m.metal);
    d.box([0.16, 0.48, 2.2], [side * 1.47, 3.95, 18.15], face);
    d.add(new T.CircleGeometry(0.07, 20).rotateY((side * Math.PI) / 2), black, [
      side * 1.38,
      4.18,
      18.85,
    ]);
    // Cockpit wall ventilation slots and grab handles.
    for (let j = 0; j < 8; j++)
      d.rod(
        [side * 1.43, 4.45 + j * 0.026, 17.1],
        [side * 1.43, 4.45 + j * 0.026, 17.36],
        0.006,
        m.dark,
      );
  }
  d.box([3.0, 0.07, 3.6], [0, 3.365, 17.8], m.dark);
  sheet(d, rect(0, 4.3, 4.3, 3.4, 15.9), liner, [0, 0, 1], [rect(-1.05, 3.6, 0.78, 1.9, 15.9)]);
  for (let i = 0; i < 6; i++)
    d.box([0.72, 0.08, 0.27], [-1.05, 3.2 - i * 0.32, 15.76 - i * 0.26], m.dark);
  d.box([4, 0.05, 17.7], [0, 2.2, 8.35], liner);
  d.finish();
  for (const b of bindings) b.source = b.source.replace('A400-copilot.', 'A400-pilot.');
  for (const key of Object.keys(derived)) if (key.startsWith('A400-copilot.')) delete derived[key];
  return { nodes: ['cockpit'], sources, derived, bindings };
}
