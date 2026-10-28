/** JAS 39C: single-seat, RM12, portrait CMFD cockpit. See reference-review.json.
 * Metres, +Y up, +Z forward, +X pilot left. No external stores.
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

export const gripenFrame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.57,
  cy: 1.78,
  ry: 0.62,
  cabinZ: 2.9,
  cabinWidth: 0.88,
  eye: [0, 2.48, 2.9],
  panelZ: 3.85,
  floor: 1.15,
});

export function buildGripenC(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Gripen-gray', '#959fa4', { side: T.DoubleSide }),
    radome = mat('Gripen-radome', '#818b91'),
    seam = mat('Gripen-seal', '#414a4e'),
    metal = mat('Gripen-alloy', '#a8afb0', { metalness: 0.7 }),
    dark = mat('Gripen-duct', '#10191c', { side: T.DoubleSide }),
    hot = mat('Gripen-nozzle', '#77766c', { side: T.DoubleSide, metalness: 0.7 }),
    glass = mat('Gripen-glass', '#acbebd', {
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'Gripen-airframe'),
    bindings = [];
  const hinged = (g, axis, dir) => {
    const mount = group(g.parent, `${g.name}-mount`, g.position.toArray());
    mount.quaternion.setFromUnitVectors(new T.Vector3(...axis), new T.Vector3(...dir).normalize());
    const inv = mount.quaternion.clone().invert();
    g.traverse((n) => {
      if (n.isMesh) n.geometry.applyQuaternion(inv);
    });
    mount.add(g);
    g.position.set(0, 0, 0);
  };
  // Forebody stations from the side/top references; the cockpit roof is an actual aperture.
  const foreData = [
    [7.1, 0.006, 1.33, 1.35],
    [6.85, 0.11, 1.3, 1.46],
    [6.2, 0.27, 1.16, 1.68],
    [5.36, 0.46, 1.08, 1.9],
    [4.9, 0.49, 1.08, 2.02],
    [3.7, 0.52, 1.07, 2.08],
    [2.05, 0.55, 1.1, 2.28],
    [1.05, 0.55, 1.1, 2.46],
    [0.25, 0.59, 1.09, 2.44],
  ];
  const ellipses = (data) =>
    data.map(([z, w, b, t]) => ({
      z,
      points: Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return [Math.sin(a) * w, (b + t) / 2 + (Math.cos(a) * (t - b)) / 2];
      }),
    }));
  const fore = ellipses(foreData);
  loft(d, fore.slice(0, 4), radome);
  loft(d, fore.slice(3, 5), paint, { caps: false });
  loft(d, fore.slice(4, 8), paint, { caps: false, skip: (_, j) => j < 4 || j >= 20 });
  loft(d, fore.slice(7), paint, { caps: false });
  outline(
    d,
    fore[3].points.map((p) => [...p, 5.36]),
    0.004,
    seam,
  );
  d.rod([0, 1.34, 7.1], [0, 1.31, 7.9], 0.009, metal);
  const canopy = [
    [4.9, 0.02, 2.02, 2.03],
    [3.85, 0.4, 2.075, 2.57],
    [3.45, 0.44, 2.11, 2.68],
    [2.65, 0.44, 2.2, 2.65],
    [2.05, 0.4, 2.28, 2.55],
    [1.05, 0.02, 2.46, 2.47],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 21 }, (_, i) => [
      Math.cos((i * Math.PI) / 20) * w,
      b + Math.sin((i * Math.PI) / 20) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 20 });
  for (const k of [0, 20])
    outline(
      d,
      cr.map((r) => [...r.points[k], r.z]),
      0.018,
      paint,
      false,
    );
  for (const i of [0, 1, 5])
    outline(
      d,
      cr[i].points.map((p) => [...p, cr[i].z]),
      i === 1 ? 0.023 : 0.013,
      paint,
      false,
    );
  // Thin canopy sill bridges close the shell without putting a solid block through the pilot.
  const foreAt = (z) => {
    let i = foreData.findIndex(
      (a, k) => k < foreData.length - 1 && z <= a[0] && z >= foreData[k + 1][0],
    );
    if (i < 0) i = foreData.length - 2;
    const a = foreData[i],
      b = foreData[i + 1],
      u = (a[0] - z) / (a[0] - b[0]);
    return a.map((v, k) => v + (b[k] - v) * u);
  };
  for (const side of [-1, 1])
    for (let i = 0; i < canopy.length - 1; i++) {
      const a = canopy[i],
        b = canopy[i + 1],
        fa = foreAt(a[0]),
        fb = foreAt(b[0]);
      const p = (r) => [
        side * r[1] * Math.sin(Math.PI / 3),
        (r[2] + r[3]) / 2 + (r[3] - r[2]) * 0.25,
        r[0],
      ];
      quad(d, p(fa), p(fb), [side * b[1], b[2], b[0]], [side * a[1], a[2], a[0]], paint, [
        side,
        1,
        0,
      ]);
      for (let j = 0; j < 6; j++) {
        const u = j / 6;
        d.add(new T.SphereGeometry(0.0028, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * u),
          a[2] + (b[2] - a[2]) * u + 0.016,
          a[0] + (b[0] - a[0]) * u,
        ]);
      }
    }
  // Intake shoulders blend into the single engine, with a narrow raised dorsal spine.
  const aftData = [
    [1.05, 0.96, 1.1, 2.46],
    [0.25, 1.02, 1.08, 2.44],
    [-1.65, 0.98, 1.18, 2.44],
    [-2.88, 0.93, 1.29, 2.46],
    [-4.84, 0.72, 1.32, 2.28],
    [-6.1, 0.53, 1.32, 2.28],
  ];
  const aft = aftData.map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [0.27, t - 0.015],
      [0.46, t - 0.22],
      [w * 0.95, t - 0.39],
      [w, (b + t) / 2],
      [w * 0.83, b + 0.1],
      [w * 0.45, b],
      [0, b],
      [-w * 0.45, b],
      [-w * 0.83, b + 0.1],
      [-w, (b + t) / 2],
      [-w * 0.95, t - 0.39],
      [-0.46, t - 0.22],
      [-0.27, t - 0.015],
    ],
  }));
  loft(d, aft, paint, { caps: false });
  const atSide = (side, y, z) => {
    let i = aft.findIndex((r, k) => k < aft.length - 1 && z <= r.z && z >= aft[k + 1].z);
    i = Math.max(0, i);
    const a = aft[i],
      b = aft[i + 1],
      u = (a.z - z) / (a.z - b.z),
      ps = a.points.map((p, j) => p.map((v, k) => v + (b.points[j][k] - v) * u));
    for (let j = 0; j < 7; j++) {
      const p = ps[j],
        q = ps[j + 1];
      if (y <= p[1] && y >= q[1])
        return [side * (p[0] + ((q[0] - p[0]) * (p[1] - y)) / (p[1] - q[1]) + 0.003), y, z];
    }
    return [side * 0.5, y, z];
  };
  for (const side of [-1, 1]) {
    const mouth = [
      [0.57, 1.94],
      [0.84, 1.94],
      [0.94, 1.91],
      [1.0, 1.82],
      [1.0, 1.34],
      [0.94, 1.2],
      [0.83, 1.16],
      [0.57, 1.16],
    ].map(([x, y]) => [side * x, y, 3.05 + (y - 1.55) * 0.1]);
    const inside = mouth.map(([x, y, z]) => [x * 0.98, 1.55 + (y - 1.55) * 0.91, z - 0.8]);
    const back = mouth.map(([x, y]) => [x * 1.06, 1.58 + (y - 1.55) * 1.2, 1.05]);
    for (let i = 0; i < mouth.length; i++) {
      const j = (i + 1) % mouth.length;
      const face = (a, b, c, e, material) => {
        const normal = new T.Vector3(...b)
          .sub(new T.Vector3(...a))
          .cross(new T.Vector3(...e).sub(new T.Vector3(...a)));
        quad(d, a, b, c, e, material, normal.toArray());
      };
      face(mouth[i], mouth[j], inside[j], inside[i], dark);
      face(mouth[i], back[i], back[j], mouth[j], paint);
    }
    sheet(d, inside, dark, [0, 0, 1]);
    outline(d, mouth, 0.019, paint);
    // Thin inner splitter, with a visible boundary-layer gap beside the forward fuselage.
    quad(
      d,
      [side * 0.545, 1.16, 3.22],
      [side * 0.545, 1.96, 3.24],
      [side * 0.545, 2.0, 2.62],
      [side * 0.545, 1.16, 2.62],
      paint,
      [side, 0, 0],
    );
    wing(
      d,
      [
        [side * 0.4, 1.74, 1.05, -5.25, 0.09],
        [side * 1.0, 1.72, 0.32, -4.6, 0.075],
      ],
      paint,
    );
    const name = side === 1 ? 'left' : 'right';
    const a = [1.0, 1.72, 0.32, -4.6, 0.075],
      b = [4.18, 1.69, -3.17, -4.45, 0.017],
      mix = (u) => a.map((v, i) => v + (b[i] - v) * u),
      mid = mix(0.53),
      cut = (p, f) => p[2] + (p[3] - p[2]) * f;
    wing(
      d,
      [a, b].map((p) => [side * p[0], p[1], cut(p, 0.1), cut(p, 0.79), p[4]]),
      paint,
    );
    for (const [j, ss] of [
      [0, [a, mid]],
      [1, [mid, b]],
    ]) {
      const pivot = [side * ss[0][0], ss[0][1], cut(ss[0], 0.79)],
        g = group(root, `Gripen-elevon-${name}-${j}`, pivot),
        gd = detailKit(g, g.name);
      wing(
        gd,
        ss.map((p) => [
          side * p[0] - pivot[0],
          p[1] - pivot[1],
          cut(p, 0.79) - pivot[2],
          p[3] - pivot[2],
          p[4] * 0.5,
        ]),
        paint,
      );
      gd.finish();
      hinged(
        g,
        [1, 0, 0],
        [
          ss[1][0] - ss[0][0],
          side * (ss[1][1] - ss[0][1]),
          side * (cut(ss[1], 0.79) - cut(ss[0], 0.79)),
        ],
      );
      bindings.push({
        node: g.name,
        source: side === 1 ? 'elevonLeft' : 'elevonRight',
        property: 'rotation',
        axis: 'x',
        scale: 1,
      });
    }
    const sp = [side * a[0], a[1], cut(a, 0.1)],
      sl = group(root, `Gripen-slat-${name}`, sp),
      sd = detailKit(sl, sl.name);
    wing(
      sd,
      [a, b].map((p) => [
        side * p[0] - sp[0],
        p[1] - sp[1],
        p[2] - sp[2],
        cut(p, 0.1) - sp[2],
        p[4] * 0.35,
      ]),
      paint,
    );
    sd.finish();
    hinged(sl, [1, 0, 0], [b[0] - a[0], side * (b[1] - a[1]), side * (cut(b, 0.1) - cut(a, 0.1))]);
    bindings.push({
      node: sl.name,
      source: 'flapPosition',
      property: 'rotation',
      axis: 'x',
      scale: 0.16,
    });
    const cg = group(root, `Gripen-canard-${name}`, [side * 0.94, 2.1, 1.65]),
      cd = detailKit(cg, cg.name);
    wing(
      cd,
      [
        [0, 0, 1.1, -0.9, 0.035],
        [side * 1.34, -0.03, -0.99, -1.41, 0.012],
      ],
      paint,
    );
    cd.finish();
    bindings.push({
      node: cg.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: -0.26,
    });
    // Wingtip fairing only: missiles and drawing's weapons pylons are excluded.
    beveledBox(d, [0.04, 0.07, 1.37], [side * 4.18, 1.7, -3.81], paint, 0.01);
    for (const f of [0.105, 0.785])
      outline(
        d,
        [a, b].map((p) => [side * p[0], p[1] + p[4] + 0.002, cut(p, f)]),
        0.003,
        seam,
        false,
      );
    for (const u of [0.23, 0.53, 0.78]) {
      const p = mix(u);
      outline(
        d,
        [
          [side * p[0], p[1] + p[4] + 0.002, cut(p, 0.16)],
          [side * p[0], p[1] + p[4] + 0.002, cut(p, 0.73)],
        ],
        0.0025,
        seam,
        false,
      );
    }
    for (const [za, zb, ya, yb] of [
      [0.1, -1.3, 2.14, 1.93],
      [-1.6, -2.7, 2.23, 2.02],
      [-3.2, -4.7, 2.06, 1.83],
    ]) {
      outline(
        d,
        [
          [ya, za],
          [ya, zb],
          [yb, zb],
          [yb, za],
        ].map(([y, z]) => atSide(side, y, z)),
        0.003,
        seam,
      );
      for (let j = 0; j < 8; j++)
        d.add(
          new T.SphereGeometry(0.0025, 5, 3),
          metal,
          atSide(side, ya, za + ((zb - za) * j) / 8),
        );
    }
    const nav = mat(`Gripen-nav-${name}`, side === 1 ? '#bb3535' : '#42b671', {
      emissive: side === 1 ? '#aa2020' : '#26a64b',
      emissiveIntensity: 0.7,
    });
    d.add(new T.SphereGeometry(0.025, 10, 6), nav, [side * 1.015, 1.7, 2.2]);
  }
  // Tall single fin with near-vertical trailing edge and separate rudder.
  const fin = [
    [0, 2.43, -2.75],
    [0, 4.5, -5.33],
    [0, 4.5, -5.92],
    [0, 3.72, -5.94],
    [0, 3.72, -5.54],
    [0, 2.27, -5.4],
  ];
  const solidFin = (kit, poly) => {
    for (const side of [-1, 1])
      sheet(
        kit,
        poly.map((p) => [side * 0.035, p[1], p[2]]),
        paint,
        [side, 0, 0],
      );
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      quad(
        kit,
        [-0.035, a[1], a[2]],
        [0.035, a[1], a[2]],
        [0.035, b[1], b[2]],
        [-0.035, b[1], b[2]],
        paint,
        [0, 1, 0],
      );
    }
  };
  solidFin(d, fin);
  const rg = group(root, 'Gripen-rudder', [0, 2.27, -5.4]),
    rd = detailKit(rg, rg.name);
  solidFin(rd, [
    [0, 0, 0],
    [0, 1.45, -0.14],
    [0, 1.45, -0.54],
    [0, 0, -0.7],
  ]);
  // Main rudder occupies the lower aft fin, below the fixed fin-top sensor.
  rd.finish();
  hinged(rg, [0, 1, 0], [0, 1.45, -0.14]);
  bindings.push({ node: rg.name, source: 'yawInput', property: 'rotation', axis: 'y', scale: 0.3 });
  beveledBox(d, [0.2, 0.18, 1.8], [0, 3.94, -5.02], paint, 0.045);
  d.rod([0, 3.22, -3.95], [0, 3.22, -3.05], 0.008, metal);
  for (const [z, y, h] of [
    [0.05, 2.43, 0.36],
    [-1.6, 2.44, 0.1],
    [-3.2, 2.42, 0.09],
  ])
    sheet(
      d,
      [
        [0, y, z],
        [0, y + h, z + 0.17],
        [0, y + h, z + 0.05],
        [0, y, z - 0.18],
      ],
      paint,
      [1, 0, 0],
    );
  const rings = [
    [-6.1, 0.53],
    [-6.36, 0.49],
    [-7, 0.43],
  ].map(([z, r]) => ({
    z,
    points: Array.from({ length: 28 }, (_, i) => [
      Math.sin((i * Math.PI) / 14) * r,
      1.8 + Math.cos((i * Math.PI) / 14) * r,
    ]),
  }));
  loft(d, rings, hot, { caps: false });
  loft(
    d,
    [
      rings.at(-1),
      { z: -6.22, points: rings.at(-1).points.map(([x, y]) => [x * 0.9, 1.8 + (y - 1.8) * 0.9]) },
    ],
    dark,
    { caps: false },
  );
  d.add(new T.CircleGeometry(0.38, 28).rotateY(Math.PI), dark, [0, 1.8, -6.21]);
  for (let i = 0; i < 14; i++)
    outline(
      d,
      rings.map((r) => [...r.points[i * 2], r.z]),
      0.004,
      seam,
      false,
    );
  // Low-visibility Swedish roundel geometry, not a photographic decal.
  for (const side of [-1, 1]) {
    const g = group(root, `Gripen-roundel-${side}`, [side * 0.495, 1.72, 4.65]);
    g.rotation.y = (side * Math.PI) / 2;
    const gd = detailKit(g, g.name);
    gd.ring(0.13, 0.006, [0, 0, 0], seam);
    for (const [x, y] of [
      [-0.042, 0.035],
      [0.042, 0.035],
      [0, -0.042],
    ])
      sheet(
        gd,
        [
          [x - 0.025, y - 0.012, 0],
          [x - 0.025, y + 0.02, 0],
          [x - 0.012, y + 0.008, 0],
          [x, y + 0.026, 0],
          [x + 0.012, y + 0.008, 0],
          [x + 0.025, y + 0.02, 0],
          [x + 0.025, y - 0.012, 0],
        ],
        seam,
        [0, 0, 1],
      );
    gd.finish();
  }
  for (const [name, x, z, r, w, top] of [
    ['left', 1.02, -1.55, 0.34, 0.22, 1.2],
    ['right', -1.02, -1.55, 0.34, 0.22, 1.2],
    ['nose', 0, 3.43, 0.19, 0.13, 1.13],
  ]) {
    const g = group(root, `Gripen-gear-${name}`, [x, top, z]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, -0.13], [0, r - top, 0], 0.036, metal);
    gd.rod([0, -0.05, -0.43], [0, r - top + 0.18, 0], 0.024, metal);
    for (const off of name === 'nose' ? [-0.1, 0.1] : [0]) {
      gd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), seam, [off, r - top, 0]);
      gd.add(
        new T.CylinderGeometry(r * 0.55, r * 0.55, w + 0.012, 20).rotateZ(Math.PI / 2),
        metal,
        [off, r - top, 0],
      );
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        gd.add(
          new T.CylinderGeometry(r * 0.055, r * 0.055, w + 0.015, 8).rotateZ(Math.PI / 2),
          dark,
          [off, r - top + Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38],
        );
      }
    }
    if (name === 'nose') gd.box([0.32, 0.38, 0.035], [0, -0.05, 0.15], paint);
    else gd.box([0.025, 0.42, 0.54], [x > 0 ? 0.15 : -0.15, -0.15, -0.16], paint);
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
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1 },
    );
  }
  d.finish();
  const interior = gripenCockpit(root, { metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.28] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.24] },
    elevonLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    elevonRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: gripenFrame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.8, -6.3] }],
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

function gripenCockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    panelMount = group(cabin, 'Gripen-panel-assembly', [0, -0.18, 0]),
    ins = instrumentGeometry(panelMount, 'Gripen'),
    { bindings, derived, ink, black, amber } = ins;
  let d = detailKit(panelMount, 'Gripen-cabin');
  const panel = mat('Gripen-panel', '#3f494d', { side: T.DoubleSide }),
    button = mat('Gripen-buttons', '#1e292d'),
    green = mat('Gripen-display', '#99d6a6', { emissive: '#356544', emissiveIntensity: 0.6 }),
    cushion = mat('Gripen-cushion', '#526451'),
    belt = mat('Gripen-harness', '#9b9e87');
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
  const z = 3.85,
    rect = (x, y, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([u, v]) => [x + u * w, y + v * h, z + dz]),
    txt = (t, x, y, h = 0.008, color = ink, dz = -0.026, role = 'panel') =>
      d.text(t, [x, y, z + dz], h, Math.PI, color, role);
  const edge = [
    [-0.38, 1.98],
    [-0.4, 2.3],
    [-0.29, 2.42],
    [-0.13, 2.45],
    [0.13, 2.45],
    [0.29, 2.42],
    [0.4, 2.3],
    [0.38, 1.98],
    [0.13, 1.98],
    [0.12, 1.96],
    [-0.12, 1.96],
    [-0.13, 1.98],
  ];
  const holes = [rect(0.207, 2.228, 0.125, 0.085), rect(0, 2.11, 0.15748, 0.21082)];
  sheet(
    d,
    edge.map((p) => [...p, z]),
    panel,
    [0, 0, -1],
    holes,
  );
  outline(
    d,
    edge.map((p) => [...p, z - 0.004]),
    0.008,
    black,
  );
  for (let i = 0; i < 7; i++) {
    const a = edge[i],
      b = edge[i + 1];
    quad(
      d,
      [...a, z],
      [...b, z],
      [b[0] * 0.75, b[1] - 0.08, z + 0.3],
      [a[0] * 0.75, a[1] - 0.08, z + 0.3],
      button,
      [0, 1, 0],
    );
  }
  // 6.2 x 8.3 inch active portrait areas, matching Saab's ICAS paper and display exhibit.
  for (const [x, y] of [
    [0.207, 2.23],
    [-0.207, 2.23],
    [0, 2.11],
  ]) {
    const h =
      x === 0.207
        ? [rect(0.207, 2.228, 0.125, 0.085, -0.008)]
        : x === 0
          ? [rect(0, 2.11, 0.15748, 0.21082, -0.008)]
          : [];
    sheet(d, rect(x, y, 0.196, 0.25, -0.008), button, [0, 0, -1], h);
    if (x !== 0)
      sheet(
        d,
        rect(x, y, 0.15748, 0.21082, -0.013),
        black,
        [0, 0, -1],
        x > 0 ? [rect(0.207, 2.228, 0.125, 0.085, -0.013)] : [],
      );
    for (let i = 0; i < 6; i++) {
      d.box([0.012, 0.008, 0.004], [x - 0.075 + i * 0.03, y - 0.118, z - 0.018], panel);
      if (i < 5)
        for (const side of [-1, 1])
          d.box([0.009, 0.012, 0.004], [x + side * 0.089, y - 0.079 + i * 0.039, z - 0.018], panel);
    }
    for (const side of [-1, 1])
      d.add(new T.CylinderGeometry(0.006, 0.006, 0.009, 10).rotateX(Math.PI / 2), panel, [
        x + side * 0.089,
        y + 0.115,
        z - 0.02,
      ]);
  }
  ins.horizon('attitude', [0.207, 2.228, z + 0.01], 0.123, 0.083, { blankBackdrop: true });
  txt('FLIGHT / SIM', 0.207, 2.318, 0.007, green, undefined, 'display');
  txt('TAS', 0.244, 2.285, 0.005, green, undefined, 'display');
  ins.readout('speed', [0.244, 2.271, z - 0.025], 'knots', 3, 0.009, green);
  txt('GEO FT', 0.161, 2.285, 0.005, green, undefined, 'display');
  ins.readout('altitude', [0.161, 2.271, z - 0.025], 'feet', 5, 0.007, green, true, true);
  txt('FPM', 0.207, 2.17, 0.006, green, undefined, 'display');
  ins.readout(
    'vertical-speed',
    [0.207, 2.146, z - 0.025],
    'verticalFpm',
    5,
    0.009,
    green,
    true,
    true,
  );
  sheet(d, rect(0, 2.11, 0.15748, 0.21082, 0.025), black, [0, 0, -1]);
  const rose = group(panelMount, 'Gripen-heading', [0, 2.12, z + 0.018]),
    rd = detailKit(rose, rose.name);
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    rd.rod(p(i % 6 ? 0.058 : 0.054), p(0.063), 0.00065, green);
    if (i % 6 === 0) rd.text(String(i / 2), p(0.044), 0.006, Math.PI, green);
  }
  rd.finish();
  bindings.push({
    node: rose.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: Math.PI * 2,
  });
  ins.available('heading', 'trueHeading', rose.name);
  txt('NAV / SIM', 0, 2.202, 0.006, green, 0.016);
  txt('TRUE', 0, 2.12, 0.006, green, 0.015);
  txt('MAP UNAVAILABLE', 0, 2.032, 0.005, amber, 0.016);
  d.rod([0, 2.192, z + 0.016], [0, 2.18, z + 0.016], 0.0013, ink);
  txt('SYSTEMS', -0.207, 2.307, 0.008, green);
  txt('ENG --', -0.207, 2.27, 0.01, amber);
  txt('FUEL --', -0.207, 2.242, 0.009, amber, undefined, 'display');
  txt('SENSORS INOP', -0.207, 2.2, 0.006, amber, undefined, 'display');
  txt('SIM', -0.207, 2.156, 0.007, green);
  // Raised central input panel occupies the gap above the lower middle display.
  sheet(d, rect(0, 2.365, 0.234, 0.166, -0.025), button, [0, 0, -1]);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      const x = 0.075 - col * 0.035,
        y = 2.42 - row * 0.032;
      d.box([0.026, 0.022, 0.005], [x, y, z - 0.032], panel);
      txt(String(row * 4 + col + 1), x, y, 0.005, ink, -0.036);
    }
  sheet(d, rect(-0.075, 2.37, 0.061, 0.122, -0.032), black, [0, 0, -1]);
  for (const [i, l] of ['MENU', 'COM', 'NAV', 'SYS'].entries())
    txt(l, -0.075, 2.41 - i * 0.028, 0.006, green, -0.037);
  const hud = group(cabin, 'Gripen-HUD', [0, 2.21, 3.95]),
    hd = detailKit(hud, hud.name);
  hud.rotation.x = -0.18;
  const hc = [
    [-0.16, 0, 0],
    [-0.2, 0.18, 0],
    [-0.2, 0.23, 0],
    [-0.14, 0.29, 0],
    [0.14, 0.29, 0],
    [0.2, 0.23, 0],
    [0.2, 0.18, 0],
    [0.16, 0, 0],
  ];
  sheet(hd, hc, m.glass, [0, 0, -1]);
  outline(hd, hc, 0.0027, black);
  for (const side of [-1, 1])
    hd.rod([side * 0.17, -0.035, 0.015], [side * 0.198, 0.22, 0], 0.01, button);
  hd.finish();
  const lamp = group(panelMount, 'Gripen-gear-lamp', [0.34, 2.02, z - 0.027]),
    ld = detailKit(lamp, lamp.name);
  ld.box([0.012, 0.01, 0.003], [0, 0, 0], green);
  ld.finish();
  bindings.push({
    node: lamp.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  txt('GEAR', 0.34, 1.999, 0.005);
  d.finish();
  d = detailKit(cabin, 'Gripen-tub');
  // Tub, side consoles and the short centre stick from the installed cockpit arrangement.
  d.box([0.88, 0.035, 1.9], [0, 1.15, 2.85], panel);
  d.box([0.86, 0.48, 0.03], [0, 1.4, 4.15], panel);
  for (const side of [-1, 1]) {
    quad(
      d,
      [side * 0.44, 1.15, 1.95],
      [side * 0.44, 1.15, 4.2],
      [side * 0.43, 2.08, 4.2],
      [side * 0.44, 2.26, 1.95],
      panel,
      [-side, 0, 0],
    );
    d.box([0.18, 0.14, 1.4], [side * 0.35, 1.61, 2.9], panel);
    const g = group(cabin, `Gripen-console-${side}`, [side * 0.35, 1.69, 2.9]);
    g.rotation.x = Math.PI / 2;
    const gd = detailKit(g, g.name);
    for (let i = 0; i < 4; i++) {
      const y = 0.5 - i * 0.31;
      gd.box([0.16, 0.28, 0.01], [0, y, 0], panel);
      outline(
        gd,
        [
          [-0.077, y - 0.13, -0.007],
          [0.077, y - 0.13, -0.007],
          [0.077, y + 0.13, -0.007],
          [-0.077, y + 0.13, -0.007],
        ],
        0.0015,
        black,
      );
      gd.text(
        (side === 1 ? ['ENGINE', 'RADIO', 'POWER', 'FUEL'] : ['LIGHT', 'ECS', 'OXY', 'CANOPY'])[i],
        [0, y + 0.09, -0.009],
        0.006,
        Math.PI,
        ink,
      );
      for (let j = 0; j < 3; j++) {
        gd.rod(
          [-0.048 + j * 0.048, y - 0.02, -0.008],
          [-0.048 + j * 0.048, y - 0.014, -0.034],
          0.003,
          m.metal,
        );
        gd.box([0.009, 0.009, 0.006], [-0.048 + j * 0.048, y - 0.014, -0.037], button);
      }
    }
    gd.finish();
  }
  const seat = group(cabin, 'Gripen-Mk10L-seat', [0, 1.46, 2.35]),
    sd = detailKit(seat, seat.name);
  seat.rotation.x = -0.24;
  beveledBox(sd, [0.47, 0.13, 0.53], [0, 0.05, 0.08], button, 0.03);
  beveledBox(sd, [0.4, 0.09, 0.46], [0, 0.13, 0.1], cushion, 0.025);
  beveledBox(sd, [0.45, 0.68, 0.13], [0, 0.48, -0.16], button, 0.03);
  beveledBox(sd, [0.36, 0.56, 0.1], [0, 0.48, -0.08], cushion, 0.02);
  beveledBox(sd, [0.32, 0.25, 0.22], [0, 0.94, -0.17], button, 0.04);
  for (const side of [-1, 1]) {
    sd.box([0.035, 0.68, 0.18], [side * 0.23, 0.46, -0.13], panel);
    sd.box([0.045, 0.54, 0.016], [side * 0.09, 0.49, -0.019], belt);
    sd.box([0.14, 0.024, 0.038], [side * 0.1, 0.19, 0.28], belt);
    sd.box([0.04, 0.033, 0.02], [side * 0.09, 0.24, 0.015], m.metal);
  }
  sd.ring(0.045, 0.007, [0, 0.18, 0.36], amber);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    sd.add(new T.SphereGeometry(0.0075, 5, 3), black, [
      Math.sin(a) * 0.045,
      0.18 + Math.cos(a) * 0.045,
      0.36,
    ]);
  }
  sd.finish();
  const stick = group(cabin, 'Gripen-stick', [0, 1.46, 3.26]),
    st = detailKit(stick, stick.name);
  st.add(new T.CylinderGeometry(0.06, 0.075, 0.09, 16), black, [0, 0.045, 0]);
  st.rod([0, 0.07, 0], [0, 0.3, -0.035], 0.019, black);
  beveledBox(st, [0.085, 0.13, 0.075], [0, 0.35, -0.045], button, 0.015);
  for (const [x, y] of [
    [-0.022, 0.39],
    [0.022, 0.36],
  ])
    st.add(new T.CylinderGeometry(0.012, 0.012, 0.009, 10).rotateX(Math.PI / 2), black, [
      x,
      y,
      -0.087,
    ]);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.14 },
  );
  const th = group(cabin, 'Gripen-throttle', [0.32, 1.7, 3.04]),
    td = detailKit(th, th.name);
  td.rod([0, 0, 0], [0, 0.12, 0], 0.012, black);
  beveledBox(td, [0.11, 0.07, 0.13], [0, 0.15, 0], button, 0.015);
  td.finish();
  bindings.push({
    node: th.name,
    source: 'power',
    property: 'rotation',
    axis: 'x',
    scale: 0.6,
    offset: -0.3,
  });
  for (const side of [-1, 1]) {
    const g = group(cabin, `Gripen-pedal-${side}`, [side * 0.14, 1.31, 3.9]),
      gd = detailKit(g, g.name);
    gd.box([0.12, 0.14, 0.025], [0, 0, 0], m.metal);
    for (let i = 0; i < 5; i++)
      gd.box([0.105, 0.005, 0.005], [0, -0.052 + i * 0.026, -0.015], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
