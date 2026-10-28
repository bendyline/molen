/** Standard, unstretched C-130J. USAF rescue drawing and Lockheed flight-station layout.
 * Meter geometry, +Y up, +Z nose, +X pilot left. Reference stations remain approximate.
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
export const c130Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 1.89,
  cy: 2.83,
  ry: 2.07,
  cabinZ: 10.55,
  cabinWidth: 2.5,
  eye: [0.67, 4.33, 10.55],
  panelZ: 11.42,
  floor: 2.72,
});
const rectangle = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
function hingedWing(root, name, stations, material, bindings, source, scale) {
  const a = stations[0],
    b = stations.at(-1),
    mount = group(root, `${name}-mount`, [a[0], a[1], a[2]]),
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
    n.traverse((mesh) => {
      if (mesh.isMesh) mesh.geometry.applyMatrix4(inv);
    });
    g.add(n);
  }
  bindings.push({ node: g.name, source, property: 'rotation', axis: 'x', scale });
  return g;
}
export function buildC130J(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('C130J-airframe', '#929d9b', { side: T.DoubleSide }),
    dark = mat('C130J-trim', '#263136', { side: T.DoubleSide }),
    metal = mat('C130J-alloy', '#9aa9ae', { metalness: 0.7 }),
    rubber = mat('C130J-tire', '#192024'),
    seam = mat('C130J-seam', '#596b6c'),
    glass = mat('C130J-glazing', '#a5c7cf', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'C130J-exterior'),
    bindings = [],
    rotors = [],
    enginePoints = [];
  // Blunt lower radome, raised flight deck, constant cargo barrel, upswept ramp and tail cone.
  const sections = [
    [14.895, 0.025, 2.18, 2.43],
    [14.65, 0.48, 1.81, 2.77],
    [14.05, 0.87, 1.44, 3.04],
    [13.2, 1.18, 1.12, 3.31],
    [12.35, 1.48, 0.89, 3.76],
    [11.35, 1.7, 0.78, 4.7],
    [10.65, 1.81, 0.76, 4.9],
    [9.25, 1.89, 0.76, 4.9],
    [7.4, 1.89, 0.76, 4.9],
    [4.6, 1.89, 0.76, 4.9],
    [1.5, 1.89, 0.76, 4.9],
    [-1.5, 1.89, 0.76, 4.9],
    [-3.6, 1.88, 0.78, 4.9],
    [-5.4, 1.82, 0.82, 4.97],
    [-7.5, 1.48, 1.57, 5.08],
    [-9.8, 1.02, 2.57, 5.12],
    [-12.3, 0.52, 3.65, 5.16],
    [-14.5, 0.15, 4.42, 4.94],
    [-14.895, 0.025, 4.62, 4.7],
  ];
  const rings = sections.map(([z, w, b, t]) => {
    const h = t - b;
    return {
      z,
      points: [
        [0, t],
        [0.58 * w, t - 0.025 * h],
        [0.9 * w, t - 0.115 * h],
        [w, t - 0.28 * h],
        [w, b + 0.25 * h],
        [0.86 * w, b + 0.06 * h],
        [0.5 * w, b],
        [0, b - 0.008 * h],
        [-0.5 * w, b],
        [-0.86 * w, b + 0.06 * h],
        [-w, b + 0.25 * h],
        [-w, t - 0.28 * h],
        [-0.9 * w, t - 0.115 * h],
        [-0.58 * w, t - 0.025 * h],
      ],
    };
  });
  const p = (i, j) => [...rings[i].points[j % 14], rings[i].z];
  const windowFace = (i, j) =>
    (i === 4 && [0, 1, 12, 13].includes(j)) || ([5, 6].includes(i) && [1, 2, 11, 12].includes(j));
  loft(d, rings, paint, { skip: windowFace });
  for (let i = 4; i <= 6; i++)
    for (let j = 0; j < 14; j++)
      if (windowFace(i, j)) {
        const pts = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)],
          n = new T.Vector3(...pts[1])
            .sub(new T.Vector3(...pts[0]))
            .cross(new T.Vector3(...pts[3]).sub(new T.Vector3(...pts[0])))
            .toArray();
        sheet(d, pts, glass, n);
        outline(d, pts, 0.025, dark);
      }
  for (const side of [-1, 1]) {
    d.rod(p(4, side > 0 ? 1 : 13), p(5, side > 0 ? 1 : 13), 0.026, paint);
    d.rod([side * 0.34, 3.9, 12.12], [side * 0.54, 4.58, 11.43], 0.023, paint);
    d.rod([side * 0.3, 3.88, 12.11], [side * 0.54, 4.4, 11.51], 0.012, dark);
    d.rod([side * 0.92, 2.55, 13.94], [side * 1.04, 2.9, 13.5], 0.012, seam);
    d.rod([side * 0.95, 3.15, 13.07], [side * 1.04, 3.2, 13.78], 0.018, metal);
    d.rod([side * 1.04, 3.2, 13.78], [side * 1.04, 3.2, 14.05], 0.012, metal);
  }
  // Selected seams and fasteners follow the actual faceted shell.
  for (const i of [2, 3, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
    const pts = rings[i].points.map(([x, y]) => [x * 1.002, 2.83 + (y - 2.83) * 1.002, rings[i].z]);
    outline(d, pts, 0.006, seam);
    for (let j = 0; j < pts.length; j++)
      for (let k = 1; k < 5; k++) {
        const a = pts[j],
          b = pts[(j + 1) % pts.length];
        d.add(
          new T.SphereGeometry(0.007, 5, 3),
          metal,
          a.map((v, c) => v + ((b[c] - v) * k) / 5),
        );
      }
  }
  for (const side of [-1, 1]) {
    for (const [zz, h, w, yy] of [
      [9.05, 1.65, 0.75, 1.75],
      [-4.2, 1.85, 0.9, 1.85],
    ]) {
      const x = side * 1.895,
        pts = [
          [x, yy - h / 2, zz - w / 2],
          [x, yy + h / 2, zz - w / 2],
          [x, yy + h / 2, zz + w / 2],
          [x, yy - h / 2, zz + w / 2],
        ];
      outline(d, pts, 0.014, seam);
      d.rod([x + side * 0.015, yy, zz + 0.17], [x + side * 0.015, yy, zz + 0.34], 0.016, metal);
    }
    for (const zz of [8.9, 7.45, 6.05, -3.9]) {
      const x = side * 1.895,
        y = 2.46;
      d.add(new T.CircleGeometry(0.12, 20).rotateY((side * Math.PI) / 2), dark, [x, y, zz]);
      d.ring(0.128, 0.012, [x, y, zz], metal, 'x');
    }
    const sp = [
      [5.1, 0.05, 1.7, 0.1],
      [4.6, 0.27, 1.55, 0.39],
      [3.6, 0.42, 1.51, 0.54],
      [0.1, 0.43, 1.53, 0.56],
      [-1.6, 0.34, 1.54, 0.48],
      [-2.5, 0.04, 1.6, 0.1],
    ].map(([zz, rx, cy, ry]) => ({
      z: zz,
      points: Array.from({ length: 16 }, (_, j) => [
        side * 1.95 + Math.sin((j * Math.PI) / 8) * rx,
        cy + Math.cos((j * Math.PI) / 8) * ry,
      ]),
    }));
    loft(d, sp, paint);
    d.box([0.03, 0.3, 0.58], [side * 2.3, 1.68, 3.65], dark);
    for (let j = 0; j < 7; j++)
      d.rod(
        [side * 2.32, 1.56 + j * 0.035, 3.4],
        [side * 2.32, 1.56 + j * 0.035, 3.9],
        0.008,
        metal,
      );
  }
  const station = (x) => {
      const t = Math.max(0, (x - 9.6) / (20.205 - 9.6));
      return [x, 4.82 - 0.012 * x, 3.47 - 0.15 * t, -1.42 + 2.25 * t, 0.36 - (0.25 * x) / 20.205];
    },
    split = (a, b, f) => a + (b - a) * f;
  for (const side of [-1, 1]) {
    wing(
      d,
      [0.8, 9.6, 20.205].map((x) => {
        const [xx, y, le, te, h] = station(x);
        return [side * xx, y, le, split(le, te, 0.73), h];
      }),
      paint,
    );
    wing(
      d,
      [0.8, 9.6, 20.205].map((x) => {
        const [xx, y, le, , h] = station(x);
        return [side * xx, y + 0.006, le, le - 0.19, h * 0.36];
      }),
      dark,
    );
    for (const [label, x0, x1, source, scale] of [
      ['flap', 1.92, 13, 'flapPosition', -0.62 * side],
      ['aileron', 13.06, 19.9, 'rollInput', -0.3],
    ]) {
      const pts = [x0, x1].map((x) => {
        const [xx, y, le, te, h] = station(x);
        return [side * xx, y, split(le, te, 0.73), te, h * 0.28];
      });
      hingedWing(root, `C130J-${label}-${side}`, pts, paint, bindings, source, scale);
    }
    wing(
      d,
      [
        [side * 19.9, 4.58, 2.65, 0.77, 0.04],
        [side * 20.205, 4.577, 3.32, 0.83, 0.02],
      ],
      paint,
    );
    const surf = (x, f) => {
      const [xx, y, le, te, h] = station(x),
        q = f < 0.25 ? f / 0.25 : f < 0.75 ? 1 - (f - 0.25) * 0.96 : 0.52 * (1 - (f - 0.75) / 0.25);
      return [side * xx, y + h * q + 0.009, split(le, split(le, te, 0.73), f)];
    };
    for (const f of [0.25, 0.7]) {
      for (const [a, b] of [
        [2, 9.6],
        [9.6, 20],
      ])
        d.rod(surf(a, f), surf(b, f), 0.006, seam);
      for (let x = 2; x < 20; x += 0.26)
        d.add(new T.SphereGeometry(0.006, 5, 3), metal, surf(x, f));
    }
    for (const x of [3.1, 6.8, 9.6, 12.8, 16.8, 19.3])
      outline(d, [surf(x, 0.25), surf(x, 0.7)], 0.006, seam, false);
    ellipsoid(d, [side * 20.15, 4.63, 2.15], [0.06, 0.05, 0.12], side > 0 ? d.red : d.green, 10);
    for (const x of [14.4, 17.4, 19.5]) {
      const st = station(x);
      d.rod([side * x, st[1], st[3]], [side * x, st[1], st[3] - 0.3], 0.006, dark);
    }
    wing(
      d,
      [
        [side * 0.1, 4.77, -8.95, -13.05, 0.22],
        [side * 8.025, 4.77, -11.0, -12.15, 0.08],
      ],
      paint,
    );
    hingedWing(
      root,
      `C130J-elevator-${side}`,
      [
        [side * 0.1, 4.77, -13.05, -14.35, 0.055],
        [side * 8.025, 4.77, -12.15, -12.55, 0.025],
      ],
      paint,
      bindings,
      'pitchInput',
      side * 0.35,
    );
  }
  const fin = [
    [0, 4.85, -3.4],
    [0, 5.25, -8.05],
    [0, 5.7, -8.8],
    [0, 11.68, -11.45],
    [0, 11.84, -11.9],
    [0, 11.84, -12.84],
    [0, 4.72, -13.62],
  ];
  const thick = (p) => (p[1] > 10 ? 0.08 : 0.16);
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * thick(p), p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length],
      n = new T.Vector3(0, b[2] - a[2], a[1] - b[1]);
    quad(
      d,
      [-thick(a), a[1], a[2]],
      [-thick(b), b[1], b[2]],
      [thick(b), b[1], b[2]],
      [thick(a), a[1], a[2]],
      paint,
      n.toArray(),
    );
  }
  const rg = group(root, 'C130J-rudder', [0, 4.72, -13.62]);
  rg.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    new T.Vector3(0, 7.12, 0.78).normalize(),
  );
  const rd = detailKit(rg, rg.name),
    len = Math.hypot(7.12, 0.78);
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.08, 0, 0],
        [side * 0.035, len, 0],
        [side * 0.035, len, -0.6],
        [side * 0.08, 0.1, -1.22],
      ],
      paint,
      [side, 0, 0],
    );
  quad(
    rd,
    [-0.08, 0.1, -1.22],
    [-0.035, len, -0.6],
    [0.035, len, -0.6],
    [0.08, 0.1, -1.22],
    paint,
    [0, 0, -1],
  );
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.44,
  });
  // Four J-model nacelles and independently driven six-blade propellers, 13ft 6in diameter.
  for (const [i, x] of [10.22, 5.15, -5.15, -10.22].entries()) {
    const id = `engine-${i + 1}`,
      cy = Math.abs(x) > 6 ? 4.085 : 3.89;
    const nr = [
      [6.12, 0.43, cy, 0.45],
      [5.75, 0.54, cy - 0.03, 0.6],
      [4.9, 0.59, cy - 0.04, 0.68],
      [3.3, 0.57, cy, 0.62],
      [1.6, 0.43, cy + 0.18, 0.39],
      [0.4, 0.22, cy + 0.24, 0.22],
    ].map(([z, rx, y, ry]) => ({
      z,
      points: Array.from({ length: 20 }, (_, j) => [
        x + Math.sin((j * Math.PI) / 10) * rx,
        y + Math.cos((j * Math.PI) / 10) * ry,
      ]),
    }));
    loft(d, nr, paint, { caps: false });
    d.add(new T.CircleGeometry(0.255, 24), dark, [x, cy - 0.48, 5.82]);
    d.ring(0.27, 0.028, [x, cy - 0.48, 5.84], metal);
    d.add(new T.CircleGeometry(0.205, 24).rotateY(Math.PI), dark, [x, cy + 0.23, 0.43]);
    d.ring(0.22, 0.025, [x, cy + 0.23, 0.4], metal);
    for (const z of [5.6, 4.5, 3.2])
      outline(
        d,
        Array.from({ length: 20 }, (_, j) => [
          x + Math.sin((j * Math.PI) / 10) * 0.55,
          cy + Math.cos((j * Math.PI) / 10) * 0.6,
          z,
        ]),
        0.009,
        seam,
      );
    const pg = group(root, `C130J-propeller-${i + 1}`, [x, cy, 6.2]),
      pd = detailKit(pg, pg.name);
    ellipsoid(pd, [0, 0, 0.22], [0.34, 0.34, 0.5], paint, 20);
    for (let j = 0; j < 6; j++) {
      const bg = group(pg, `C130J-blade-${i + 1}-${j}`);
      bg.rotation.z = (j * Math.PI) / 3;
      const bd = detailKit(bg, bg.name),
        shape = [
          [-0.1, 0.23, 0],
          [-0.16, 0.6, 0.02],
          [-0.2, 1.24, 0.06],
          [-0.06, 1.78, 0.09],
          [0.17, 2.055, 0.11],
          [0.32, 1.98, 0.12],
          [0.23, 1.56, 0.1],
          [0.12, 0.94, 0.06],
          [0.1, 0.26, 0],
        ];
      sheet(bd, shape, dark, [0, 0, 1]);
      sheet(
        bd,
        shape.map(([xx, yy, zz]) => [xx, yy, zz - 0.035]),
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
      bd.finish();
    }
    pd.finish();
    rotors.push({ node: pg.name, axis: 'z', multiplier: 1, engine: id });
    enginePoints.push({ id, position: [x, cy, 5.6] });
  }
  const wheel = (dd, x, y, z, r, w) => {
    dd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), rubber, [x, y, z]);
    for (const side of [-1, 1]) {
      dd.add(new T.CylinderGeometry(r * 0.56, r * 0.56, 0.022, 20).rotateZ(Math.PI / 2), metal, [
        x + side * (w / 2 + 0.008),
        y,
        z,
      ]);
      dd.ring(r * 0.8, 0.012, [x + side * (w / 2 + 0.014), y, z], dark, 'x');
    }
  };
  for (const side of [-1, 1])
    for (const [ax, zz] of [
      [0, 2.403],
      [1, 0.879],
    ]) {
      const g = group(root, `C130J-main-gear-${side}-${ax}`, [side * 2.172, 0, zz]),
        dd = detailKit(g, g.name);
      wheel(dd, 0, 0.6, 0, 0.6, 0.39);
      dd.rod([0, 0.6, 0], [0, 1.75, 0], 0.067, metal);
      dd.rod([0, 1.08, 0], [side * -0.22, 1.55, 0.18], 0.045, metal);
      dd.box([0.035, 0.58, 1.21], [side * 0.23, 1.15, 0.03], paint);
      dd.finish();
      bindings.push(
        { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -1.1, offset: 1.1 },
        { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
      );
    }
  const ng = group(root, 'C130J-nose-gear', [0, 0, 11.395]),
    nd = detailKit(ng, ng.name);
  for (const side of [-1, 1]) {
    wheel(nd, side * 0.24, 0.445, 0, 0.445, 0.22);
    nd.rod([side * 0.13, 0.445, 0], [side * 0.1, 0.9, 0.08], 0.035, metal);
    nd.box([0.025, 0.18, 1.1], [side * 0.37, 0.86, -0.18], paint);
  }
  nd.rod([0, 0.7, 0], [0, 1.55, -0.18], 0.055, metal);
  nd.rod([0, 1.1, -0.12], [0, 1.3, -0.85], 0.04, metal);
  nd.finish();
  bindings.push(
    { node: ng.name, source: 'gear', property: 'position', axis: 'y', scale: -1, offset: 1 },
    { node: ng.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
  );
  for (const side of [-1, 1])
    outline(
      d,
      [
        [side * 1.53, 0.84, -5.2],
        [side * 1.46, 1.58, -7.5],
        [side * 0.98, 2.59, -9.8],
      ],
      0.018,
      seam,
      false,
    );
  d.rod([-1.53, 0.84, -5.2], [1.53, 0.84, -5.2], 0.02, metal);
  for (const [z, y] of [
    [7.5, 4.9],
    [0.3, 4.9],
    [-6.1, 5.02],
  ])
    sheet(
      d,
      [
        [-0.035, y, z + 0.35],
        [-0.035, y + 0.42, z - 0.1],
        [-0.035, y, z - 0.4],
      ],
      dark,
      [-1, 0, 0],
    );
  ellipsoid(d, [0, 4.96, 3.9], [0.11, 0.08, 0.14], d.red, 10);
  ellipsoid(d, [0, 0.72, 3.9], [0.1, 0.06, 0.12], d.red, 10);
  d.finish();
  const interior = cockpit(root, { paint, dark, metal, glass });
  cleanGeometry(root);
  return {
    root,
    frame: c130Frame(),
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
    d = detailKit(cabin, 'C130J-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'C130J'),
    { bindings, derived, ink, black, amber } = ins;
  const face = mat('C130J-panel', '#394344', { side: T.DoubleSide }),
    liner = mat('C130J-liner', '#7e8781', { side: T.DoubleSide }),
    seat = mat('C130J-seat', '#505b5a'),
    belt = mat('C130J-harness', '#aab3a2'),
    green = mat('C130J-display-green', '#70e894', { emissive: '#247747', emissiveIntensity: 0.6 });
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
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  // Panel pixels sampled from manufacturer's p22 drawing; total 2.12m width is estimated.
  const px = (u) => ((270 - u) * 2.12) / 450,
    py = (v) => 3.62 + ((280 - v) * 2.12) / 450,
    z = 11.42,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const contour = [
    [47, 360],
    [47, 206],
    [145, 206],
    [145, 194],
    [395, 194],
    [395, 206],
    [495, 206],
    [495, 360],
  ].map(([u, v]) => at(u, v));
  const screens = [
      { u: 107, kind: 'PFD' },
      { u: 237, kind: 'ENG' },
      { u: 303, kind: 'NAV' },
      { u: 433, kind: 'PFD' },
    ],
    holes = screens.map(({ u }) => rectangle(px(u), py(277), 0.252, 0.321, z));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(158) + Math.cos((i * Math.PI) / 20) * 0.056,
      py(254) + Math.sin((i * Math.PI) / 20) * 0.056,
      z,
    ]),
  );
  sheet(d, contour, face, [0, 0, -1], holes);
  outline(d, contour, 0.014, m.dark);
  d.box([2.18, 0.06, 0.35], [0, 4.035, 11.56], m.dark);
  for (const { u, kind } of screens) {
    const x = px(u),
      y = py(277),
      w = 0.252,
      h = 0.321;
    sheet(
      d,
      rectangle(x, y, w + 0.045, h + 0.045, z - 0.008),
      m.dark,
      [0, 0, -1],
      [rectangle(x, y, w, h, z - 0.008)],
    );
    for (const side of [-1, 1])
      for (let row = 0; row < 7; row++)
        d.box(
          [0.009, 0.013, 0.009],
          [x + side * (w / 2 + 0.011), y + 0.13 - row * 0.043, z - 0.018],
          m.dark,
        );
    for (const side of [-1, 1]) pt.knob(x + side * 0.112, y - 0.175, z - 0.02, 0.012);
    if (kind === 'PFD') {
      const label = u === 107 ? 'pilot' : 'copilot',
        g = group(cabin, `C130J-${label}-display`, [x, y, z + 0.018]),
        dd = detailKit(g, g.name),
        ii = instrumentGeometry(g, `C130J-${label}`);
      ii.horizon('horizon', [0, 0.058, 0], 0.15, 0.135, { blankBackdrop: true });
      sheet(
        dd,
        rectangle(0, 0, w, h, -0.012),
        black,
        [0, 0, -1],
        [rectangle(0, 0.058, 0.15, 0.135, -0.012)],
      );
      ii.readout('speed', [0.096, 0.06, -0.018], 'knots', 3, 0.009, ink, false, true);
      ii.readout('altitude', [-0.096, 0.06, -0.018], 'feet', 5, 0.007, ink, true, true);
      dd.text('TAS', [0.096, 0.105, -0.019], 0.006, Math.PI, ink, 'display');
      dd.text('GEO FT', [-0.096, 0.105, -0.019], 0.006, Math.PI, ink, 'display');
      const rose = group(g, `C130J-${label}-heading`, [0, -0.075, -0.018]),
        rr = detailKit(rose, rose.name);
      for (let deg = 0; deg < 360; deg += 10) {
        const a = (deg * Math.PI) / 180,
          p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
        rr.rod(p(deg % 30 ? 0.045 : 0.041), p(0.05), 0.0007, green);
        if (deg % 30 === 0)
          rr.text(
            deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
            p(0.032),
            0.006,
            Math.PI,
            green,
          );
      }
      rr.finish();
      ii.bindings.push({
        node: rose.name,
        source: 'trueHeading',
        property: 'rotation',
        axis: 'z',
        scale: -1,
        period: 2 * Math.PI,
        responseSeconds: 0.15,
      });
      ii.available('heading', 'trueHeading', rose.name);
      dd.rod([0, -0.014, -0.02], [0, -0.027, -0.02], 0.001, amber);
      dd.text('TRUE', [0, -0.004, -0.02], 0.006, Math.PI, ink, 'display');
      ii.readout('vertical', [-0.091, -0.075, -0.018], 'verticalFpm', 4, 0.007, ink, true, true);
      dd.text('FPM', [-0.091, -0.11, -0.02], 0.006, Math.PI, ink);
      dd.text('NAV --', [0.09, -0.095, -0.02], 0.006, Math.PI, green, 'display');
      dd.text('SIM FLIGHT', [0, 0.148, -0.019], 0.006, Math.PI, green, 'display');
      dd.finish();
      bindings.push(...ii.bindings);
      Object.assign(derived, ii.derived);
    } else if (kind === 'ENG') {
      sheet(d, rectangle(x, y, w, h, z + 0.008), black, [0, 0, -1]);
      d.text('ENGINES', [x, y + 0.145, z], 0.011, Math.PI, green);
      for (let i = 0; i < 4; i++) {
        const source = `prop${i + 1}`,
          value = `propPercent${i + 1}`;
        sources[source] = {
          component: 'aircraftState',
          path: ['engines', `engine-${i + 1}`, 'rpm'],
        };
        derived[value] = { op: 'multiply', args: [source, 100] };
        const xx = x + 0.09 - i * 0.06;
        d.text(String(i + 1), [xx, y + 0.12, z], 0.008, Math.PI, green);
        ins.dial(
          `prop-${i + 1}`,
          [xx, y + 0.072, z],
          0.022,
          value,
          [
            [0, -2.2],
            [110, 2.2],
          ],
          [0, 100],
          'NP',
          { responseSeconds: 0.12, material: green },
        );
        ins.readout(
          `prop-number-${i + 1}`,
          [xx, y + 0.025, z - 0.016],
          value,
          3,
          0.008,
          green,
          false,
          true,
        );
        for (let row = 0; row < 3; row++) {
          d.add(new T.RingGeometry(0.015, 0.016, 20).rotateY(Math.PI), green, [
            xx,
            y - 0.035 - row * 0.039,
            z,
          ]);
          d.text('--', [xx, y - 0.035 - row * 0.039, z - 0.002], 0.007, Math.PI, green);
        }
      }
      d.text('TRQ ITT NG OIL --', [x, y - 0.145, z], 0.007, Math.PI, green, 'display');
    } else {
      sheet(d, rectangle(x, y, w, h, z + 0.008), black, [0, 0, -1]);
      const g = group(cabin, 'C130J-navigation-heading', [x, y + 0.02, z]),
        rr = detailKit(g, g.name);
      for (let deg = 0; deg < 360; deg += 10) {
        const a = (deg * Math.PI) / 180,
          p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
        rr.rod(p(0.073), p(0.08), 0.001, green);
        if (deg % 30 === 0)
          rr.text(
            deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
            p(0.059),
            0.009,
            Math.PI,
            green,
          );
      }
      rr.finish();
      bindings.push({
        node: g.name,
        source: 'trueHeading',
        property: 'rotation',
        axis: 'z',
        scale: -1,
        period: 2 * Math.PI,
        responseSeconds: 0.15,
      });
      ins.available('nav-heading', 'trueHeading', g.name);
      d.text('TRUE HEADING', [x, y + 0.145, z - 0.01], 0.009, Math.PI, green, 'display');
      d.text('MAP / RADIO INOP', [x, y - 0.12, z - 0.01], 0.008, Math.PI, green);
      d.rod([x, y + 0.113, z - 0.01], [x, y + 0.1, z - 0.01], 0.0015, amber);
    }
  }
  ins.horizon('standby-attitude', at(158, 254, 0.018), 0.112, 0.112, {
    round: true,
    blankBackdrop: true,
  });
  ins.dial(
    'standby-speed',
    at(187, 254, -0.008),
    0.05,
    'knots',
    [
      [0, -2.4],
      [100, -1.3],
      [200, 0.2],
      [350, 2.4],
    ],
    [0, 100, 200, 300],
    'TAS',
  );
  ins.altimeter('standby-altitude', at(237, 348, -0.008), 0.041, 'feet');
  ins.dial(
    'flap-position',
    at(221, 328, -0.008),
    0.027,
    'flapPosition',
    [
      [0, -2],
      [1, 2],
    ],
    [0, 0.5, 1],
    'FLAP',
  );
  for (const [u, w] of [
    [172, 0.132],
    [216, 0.137],
    [260, 0.132],
    [370, 0.137],
  ]) {
    d.box([w, 0.105, 0.02], at(u, 210, -0.018), black);
    d.text('CNI --', at(u, 210, -0.03), 0.01, Math.PI, green, 'display');
    pt.knob(px(u) - w * 0.44, py(222), z - 0.03, 0.009);
  }
  for (const u of [63, 479])
    for (let j = 0; j < 9; j++) d.box([0.045, 0.007, 0.008], at(u, 245 + j * 7, -0.018), black);
  for (const [u, v] of [
    [84, 215],
    [435, 215],
    [292, 330],
    [304, 341],
    [321, 330],
    [335, 341],
    [366, 340],
    [389, 340],
  ])
    pt.knob(px(u), py(v), z - 0.025, 0.011);
  for (let col = 0; col < 5; col++)
    for (let row = 0; row < 3; row++)
      d.box([0.014, 0.014, 0.01], at(282 + col * 5, 199 + row * 5, -0.025), black);
  d.text('C-130J', at(270, 355, -0.025), 0.019, Math.PI, ink);
  // Individual removable lower panels and the blank optional-system bay.
  sheet(d, rectangle(px(368), py(276), 0.285, 0.343, z - 0.012), m.dark, [0, 0, -1]);
  for (const u of [340, 396]) for (const v of [241, 312]) pt.knob(px(u), py(v), z - 0.027, 0.006);
  for (const [u, v, w, h, label] of [
    [174, 340, 0.27, 0.15, 'HYD'],
    [307, 340, 0.24, 0.16, 'GEAR'],
    [370, 340, 0.28, 0.16, 'HYD'],
  ]) {
    sheet(d, rectangle(px(u), py(v), w, h, z - 0.014), face, [0, 0, -1]);
    d.text(label, at(u, v - 10, -0.027), 0.008, Math.PI, ink);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 4; col++) {
        const xx = px(u) + (col - 1.5) * w * 0.19,
          yy = py(v) + 0.012 - row * 0.04;
        d.rod([xx, yy, z - 0.026], [xx, yy + 0.012, z - 0.045], 0.003, m.metal);
      }
  }
  const gearLamp = group(cabin, 'C130J-gear-down', at(318, 352, -0.025)),
    gd = detailKit(gearLamp, gearLamp.name);
  for (const x of [-0.025, 0, 0.025]) gd.box([0.014, 0.014, 0.003], [x, 0, 0], green);
  gd.finish();
  bindings.push({
    node: gearLamp.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  const ped = group(cabin, 'C130J-center-console', [0, 3.02, 10.23]);
  ped.rotation.x = Math.PI / 2;
  const td = detailKit(ped, ped.name),
    tp = panelTools(td);
  beveledBox(td, [0.62, 2.18, 0.2], [0, 0, 0.05], face);
  for (const y of [-0.49, 0.07, 0.76]) {
    td.box([0.59, 0.26, 0.025], [0, y, -0.063], m.dark);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 8; col++)
        tp.knob(-0.25 + col * 0.071, y - 0.07 + row * 0.07, -0.087, 0.009);
  }
  for (const x of [-0.205, 0.205]) {
    td.box([0.18, 0.39, 0.025], [x, 0.34, -0.073], black);
    td.box([0.15, 0.11, 0.008], [x, 0.43, -0.09], m.dark);
    td.text('CNI --', [x, 0.43, -0.096], 0.011, Math.PI, green, 'display');
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 5; col++)
        td.box([0.022, 0.023, 0.009], [x - 0.06 + col * 0.03, 0.34 - row * 0.031, -0.093], m.dark);
  }
  for (let i = 0; i < 4; i++) {
    const x = 0.09 - i * 0.06;
    td.box([0.02, 0.39, 0.008], [x, 0.34, -0.074], black);
    const g = group(ped, `C130J-throttle-${i + 1}`, [x, 0.16, -0.09]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.13, -0.14], 0.012, m.metal);
    beveledBox(dd, [0.053, 0.047, 0.035], [0, 0.13, -0.14], m.dark);
    dd.text(String(i + 1), [0, 0.13, -0.161], 0.009, Math.PI, ink);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.68,
      offset: -0.2,
    });
  }
  td.box([0.21, 0.35, 0.025], [0, -0.83, -0.073], black);
  td.box([0.18, 0.1, 0.008], [0, -0.72, -0.09], m.dark);
  td.text('CNI --', [0, -0.72, -0.096], 0.011, Math.PI, green, 'display');
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++)
      td.box([0.025, 0.022, 0.009], [-0.07 + col * 0.035, -0.8 - row * 0.031, -0.093], m.dark);
  const fg = group(ped, 'C130J-flap-lever', [-0.23, -0.35, -0.09]),
    fd = detailKit(fg, fg.name);
  fd.rod([0, 0, 0], [0, 0, -0.12], 0.012, m.metal);
  fd.box([0.09, 0.027, 0.035], [0, 0, -0.13], liner);
  fd.finish();
  bindings.push({
    node: fg.name,
    source: 'flapPosition',
    property: 'rotation',
    axis: 'x',
    scale: -0.65,
  });
  td.text('POWER', [0, 0.6, -0.08], 0.014, Math.PI, ink);
  td.finish();
  const overhead = group(cabin, 'C130J-overhead', [0, 4.67, 10.38]);
  overhead.rotation.x = -Math.PI / 2;
  const od = detailKit(overhead, overhead.name),
    op = panelTools(od);
  beveledBox(od, [0.93, 1.4, 0.065], [0, 0, 0], face);
  for (const [x, y, w, h, label] of [
    [0, 0.42, 0.31, 0.22, 'START'],
    [0, 0.15, 0.38, 0.22, 'ELECTRICAL'],
    [0, -0.13, 0.38, 0.22, 'FUEL'],
    [0, -0.42, 0.38, 0.2, 'PROP'],
    [0.34, 0.18, 0.2, 0.39, 'BLEED'],
    [-0.34, 0.18, 0.2, 0.39, 'PRESS'],
    [0.34, -0.36, 0.2, 0.43, 'ICE'],
    [-0.34, -0.36, 0.2, 0.43, 'LIGHTS'],
  ]) {
    od.box([w, h, 0.014], [x, y, -0.043], m.dark);
    od.text(label, [x, y + h * 0.36, -0.055], 0.011, Math.PI, ink);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const xx = x + (col - 1) * w * 0.27,
          yy = y + (0.1 - row * 0.36) * h;
        op.knob(xx, yy, -0.057, 0.009);
        od.rod([xx, yy, -0.067], [xx, yy + 0.017, -0.085], 0.003, m.metal);
      }
  }
  for (let i = 0; i < 4; i++)
    beveledBox(od, [0.044, 0.08, 0.025], [-0.1 + i * 0.067, 0.4, -0.067], od.red, 0.005);
  od.finish();
  for (const side of [-1, 1]) {
    const x = side * 0.67;
    d.box([0.26, 0.12, 0.27], [x, 4.54, 11.26], m.dark);
    for (const dx of [-0.13, 0.13])
      d.rod([x + dx, 4.51, 11.32], [x + dx, 4.13, 11.7], 0.015, m.dark);
    sheet(
      d,
      [
        [x - 0.13, 4.17, 11.7],
        [x + 0.13, 4.17, 11.7],
        [x + 0.13, 4.45, 11.43],
        [x - 0.13, 4.45, 11.43],
      ],
      m.glass,
      [0, 1, -1],
    );
    const yg = group(cabin, `C130J-yoke-${side}`, [x, 3.4, 10.75]),
      yd = detailKit(yg, yg.name);
    yd.rod([0, -0.65, 0.28], [0, 0, 0], 0.045, m.metal);
    outline(
      yd,
      [
        [-0.16, 0.12, -0.05],
        [-0.22, 0.08, -0.05],
        [-0.19, -0.1, -0.05],
        [0.19, -0.1, -0.05],
        [0.22, 0.08, -0.05],
        [0.16, 0.12, -0.05],
      ],
      0.028,
      m.dark,
      false,
    );
    beveledBox(yd, [0.15, 0.16, 0.065], [0, -0.01, -0.05], m.dark);
    yd.text('C-130J', [0, 0.02, -0.087], 0.012, Math.PI, ink);
    yd.finish();
    bindings.push(
      { node: yg.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.72 },
      { node: yg.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.09 },
    );
    for (const dx of [-0.16, 0.16]) {
      const g = group(cabin, `C130J-pedal-${side}-${Math.sign(dx)}`, [x + dx, 2.86, 11.3]),
        dd = detailKit(g, g.name);
      dd.box([0.19, 0.08, 0.13], [0, 0, 0], m.dark);
      for (let j = 0; j < 5; j++)
        dd.rod([-0.08, 0.046, -0.05 + j * 0.025], [0.08, 0.046, -0.05 + j * 0.025], 0.003, m.metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: Math.sign(dx) * 0.045,
      });
    }
    d.box([0.43, 0.24, 0.48], [x, 2.88, 10.13], m.metal);
    beveledBox(d, [0.58, 0.14, 0.6], [x, 3.11, 10.13], seat, 0.04);
    const sg = group(cabin, `C130J-seat-back-${side}`, [x, 3.57, 9.86]);
    sg.rotation.x = -0.1;
    const sd = detailKit(sg, sg.name);
    beveledBox(sd, [0.57, 0.81, 0.17], [0, 0, 0], seat, 0.05);
    beveledBox(sd, [0.43, 0.23, 0.17], [0, 0.5, 0], seat, 0.035);
    for (const dx of [-0.16, 0.16]) {
      sd.rod([dx, 0.49, 0.095], [dx * 0.45, -0.35, 0.11], 0.024, belt);
      sd.rod([dx, 0.22, -0.1], [dx, -0.32, -0.1], 0.025, m.metal);
    }
    sd.finish();
    d.rod([x - 0.26, 3.22, 9.98], [x + 0.23, 3.22, 10.3], 0.025, belt);
    d.box([0.075, 0.025, 0.055], [x + 0.02, 3.24, 10.16], m.metal);
    for (const dx of [-0.32, 0.32])
      beveledBox(d, [0.07, 0.08, 0.37], [x + dx, 3.38, 10.05], seat, 0.016);
    d.box([0.13, 0.53, 1.8], [side * 1.31, 3.15, 10.24], face);
    d.box([0.1, 0.21, 0.22], [side * 1.23, 3.6, 10.14], black);
    d.rod([side * 1.25, 3.65, 10.29], [side * 1.22, 3.38, 10.4], 0.014, m.dark);
  }
  d.box([2.5, 0.07, 2.8], [0, 2.71, 10.2], m.dark);
  sheet(
    d,
    [
      [-1.7, 1.1, 8.6],
      [1.7, 1.1, 8.6],
      [1.7, 4.7, 8.6],
      [-1.7, 4.7, 8.6],
    ],
    liner,
    [0, 0, 1],
    [rectangle(0, 2.13, 0.68, 1.9, 8.6)],
  );
  for (let i = 0; i < 4; i++)
    d.box([0.64, 0.08, 0.28], [0, 2.5 - i * 0.35, 8.55 - i * 0.28], m.dark);
  d.box([2.95, 0.04, 13.5], [0, 1.1, 1.4], liner);
  d.finish();
  // The two display faces use one telemetry graph, including digit decoding and validity.
  // There is no second simulated AHRS or air-data computer behind the copilot screen.
  for (const binding of bindings)
    binding.source = binding.source.replace('C130J-copilot.', 'C130J-pilot.');
  for (const key of Object.keys(derived)) if (key.startsWith('C130J-copilot.')) delete derived[key];
  return { nodes: ['cockpit'], sources, derived, bindings };
}
