/** AV-8B II Plus, clean configuration. Public NATOPS Fig1-2 sheet2 and FO-1.
 * Original geometry. Dimensioned layout and estimated transverse sections are kept separate. */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
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
export const av8Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.66,
  cy: 1.85,
  ry: 0.83,
  cabinZ: 3.95,
  cabinWidth: 0.84,
  eye: [0, 3.14, 3.95],
  panelZ: 4.75,
  floor: 1.95,
});
function slopeWing(geometry) {
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.13 * (p.getZ(i) - 1.62));
  geometry.computeVertexNormals();
}
function fixedWing(d, stations, material) {
  const temp = new T.Group(),
    dd = detailKit(temp, 'temporary');
  wing(dd, stations, material);
  dd.finish();
  temp.traverse((m) => {
    if (m.isMesh) {
      slopeWing(m.geometry);
      d.add(m.geometry, material);
    }
  });
}
function hinge(root, name, stations, material, bindings, source, scale, sloped = false) {
  const point = (p) => [p[0], p[1] + (sloped ? 0.13 * (p[2] - 1.62) : 0), p[2]],
    a = point(stations[0]),
    b = point(stations.at(-1)),
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
      if (m.isMesh) {
        if (sloped) slopeWing(m.geometry);
        m.geometry.applyMatrix4(inv);
      }
    });
    g.add(n);
  }
  bindings.push({ node: name, source, property: 'rotation', axis: 'x', scale });
}
export function buildAV8B(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('AV8-gray', '#8c969d', { side: T.DoubleSide }),
    upper = mat('AV8-upper', '#727f89', { side: T.DoubleSide }),
    dark = mat('AV8-seals', '#283137', { side: T.DoubleSide }),
    metal = mat('AV8-alloy', '#a5afb3', { metalness: 0.75 }),
    heat = mat('AV8-heat-shield', '#686d6c', { metalness: 0.6, side: T.DoubleSide }),
    rubber = mat('AV8-tires', '#171b1e'),
    glass = mat('AV8-glass', '#b5cbd1', {
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'AV8-airframe'),
    bindings = [];
  // Raster positions are documented in reference-review.json. Widths are reconstructed
  // from the plan/front diagrams and independent oblique photograph.
  const ppm = 569 / 14.5542,
    sz = (u) => 7.2771 - (u - 144) / ppm,
    sy = (v) => (443 - v) / ppm;
  const sections = [
    [144, 0.006, 354, 350],
    [185, 0.23, 368, 341],
    [204, 0.32, 372, 337],
    [235, 0.4, 378, 341],
    [255, 0.43, 382, 341],
    [290, 0.47, 387, 332],
    [330, 0.6, 394, 327],
    [380, 0.68, 399, 333],
    [450, 0.62, 406, 342],
    [510, 0.5, 407, 349],
    [570, 0.4, 406, 355],
    [640, 0.3, 416, 363],
    [680, 0.16, 405, 371],
    [713, 0.03, 383, 372],
  ];
  const rings = sections.map(([u, w, b, t]) => ({
    z: sz(u),
    points: Array.from({ length: 24 }, (_, j) => [
      Math.sin((j * Math.PI) / 12) * w,
      sy((b + t) / 2) + (Math.cos((j * Math.PI) / 12) * (b - t)) / ppm / 2,
    ]),
  }));
  loft(d, rings, paint, { skip: (i, j) => i < 2 || (i >= 2 && i < 6 && (j < 5 || j >= 19)) });
  loft(d, rings.slice(0, 3), mat('AV8-radome', '#a0a6aa'));
  for (const i of [2, 7, 9, 11])
    outline(
      d,
      rings[i].points.map(([x, y]) => [x * 1.007, y, rings[i].z]),
      0.0025,
      dark,
    );
  const canopy = [
    [5.74, 0.015, 2.7, 2.72],
    [5.25, 0.26, 2.62, 2.97],
    [4.46, 0.4, 2.61, 3.24],
    [3.8, 0.4, 2.78, 3.23],
    [3.1, 0.29, 2.94, 3.13],
    [2.6, 0.02, 2.96, 2.98],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      b + Math.sin((j * Math.PI) / 16) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  for (const i of [0, 2, 5])
    outline(
      d,
      cr[i].points.map((p) => [...p, cr[i].z]),
      i === 2 ? 0.021 : 0.014,
      paint,
      false,
    );
  for (const j of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[j], r.z]),
      0.017,
      paint,
      false,
    );
  // Close shell shoulders down to the cabin rails, leaving a true transparent opening.
  for (const side of [-1, 1]) {
    const railAt = (z) => {
      let i = 0;
      while (i < canopy.length - 2 && z < canopy[i + 1][0]) i++;
      const a = canopy[i],
        b = canopy[i + 1],
        t = Math.max(0, Math.min(1, (a[0] - z) / (a[0] - b[0])));
      return [side * (a[1] + (b[1] - a[1]) * t), a[2] + (b[2] - a[2]) * t, z];
    };
    for (let i = 0; i < 4; i++) {
      const a = rings[i + 2],
        b = rings[i + 3],
        j = side === 1 ? 5 : 19;
      quad(d, [...a.points[j], a.z], [...b.points[j], b.z], railAt(b.z), railAt(a.z), paint, [
        side,
        1,
        0,
      ]);
    }
    for (let i = 0; i < canopy.length - 1; i++)
      for (let j = 0; j < 7; j++) {
        const a = canopy[i],
          b = canopy[i + 1],
          t = j / 7;
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * (a[1] + (b[1] - a[1]) * t),
          a[2] + (b[2] - a[2]) * t + 0.018,
          a[0] + (b[0] - a[0]) * t,
        ]);
      }
  }
  // FLIR fairing above the long radar nose; no sensor or targeting behavior.
  const sensor = [
    [0.12, 2.66, 5.73],
    [0.12, 2.77, 6.33],
    [-0.12, 2.77, 6.33],
    [-0.12, 2.66, 5.73],
  ];
  sheet(d, sensor, upper, [0, 1, 0]);
  d.box([0.22, 0.12, 0.06], [0, 2.71, 6.33], dark);
  for (const side of [-1, 1])
    quad(
      d,
      [side * 0.12, 2.66, 5.73],
      [side * 0.12, 2.77, 6.33],
      [side * 0.12, 2.6, 6.33],
      [side * 0.12, 2.6, 5.73],
      paint,
      [side, 0, 0],
    );
  // Large side intakes, open ducts and auxiliary intake-door recesses.
  for (const side of [-1, 1]) {
    const shape = Array.from({ length: 24 }, (_, j) => {
      const a = (j * Math.PI) / 12;
      return [side * Math.max(0.53, 0.7 + Math.sin(a) * 0.48), 1.93 + Math.cos(a) * 0.78];
    });
    const outer = [
      { z: 3.7, points: shape },
      { z: 3.48, points: shape.map(([x, y]) => [x * 1.02, y]) },
      { z: 0.9, points: shape.map(([x, y]) => [x * 0.76, 1.85 + (y - 1.93) * 0.7]) },
    ];
    loft(d, outer, paint, { caps: false });
    const inside = shape.map(([x, y]) => [
      side * 0.7 + (x - side * 0.7) * 0.88,
      1.93 + (y - 1.93) * 0.88,
    ]);
    loft(
      d,
      [
        { z: 3.702, points: inside },
        { z: 2.3, points: inside.map(([x, y]) => [x * 0.88, y]) },
      ],
      dark,
      { caps: false },
    );
    for (let j = 0; j < 24; j++)
      quad(
        d,
        [...shape[j], 3.7],
        [...shape[(j + 1) % 24], 3.7],
        [...inside[(j + 1) % 24], 3.705],
        [...inside[j], 3.705],
        paint,
        [0, 0, 1],
      );
    sheet(
      d,
      inside.map((p) => [p[0] * 0.88, p[1], 2.3]),
      rubber,
      [0, 0, 1],
    );
    for (let j = 0; j < 8; j++) {
      const a = -0.25 + j * 0.42,
        x = side * (0.7 + Math.cos(a) * 0.47),
        y = 1.93 + Math.sin(a) * 0.76;
      const g = group(root, `AV8-inlet-door-${side}-${j}`, [x, y, 3.22]),
        dd = detailKit(g, g.name);
      g.rotation.z = side * (a - Math.PI / 2);
      dd.box([0.15, 0.012, 0.22], [0, 0, 0], dark);
      dd.box([0.13, 0.014, 0.16], [0, 0.009, -0.035], paint);
      dd.finish();
    }
    // Fixed fairings behind each rotating elbow; rear panels use heat-resistant metal.
    for (const [i, z, r] of [
      [0, 1.13, 0.23],
      [1, -1.94, 0.28],
    ]) {
      ellipsoid(d, [side * 0.64, 1.68, z], [0.3, 0.43, 0.56], i ? heat : paint, 16);
      const g = group(root, `AV8-nozzle-${side}-${i}`, [side * 0.68, 1.68, z]),
        nd = detailKit(g, g.name);
      const curve = new T.QuadraticBezierCurve3(
        new T.Vector3(0, 0, 0),
        new T.Vector3(side * 0.5, 0, 0),
        new T.Vector3(side * 0.5, 0, -0.56),
      );
      nd.add(new T.TubeGeometry(curve, 10, r, 12, false), i ? heat : paint);
      nd.add(new T.CircleGeometry(r * 0.88, 16).rotateY(Math.PI), rubber, [side * 0.5, 0, -0.565]);
      nd.ring(r, 0.014, [side * 0.5, 0, -0.565], metal);
      for (const yy of [-0.12, 0, 0.12])
        nd.box([r * 1.55, 0.014, 0.07], [side * 0.5, yy, -0.57], heat);
      nd.finish();
      bindings.push({
        node: g.name,
        source: 'thrustVector',
        property: 'rotation',
        axis: 'x',
        scale: -Math.PI / 2,
      });
    }
    // Broad anhedral wing with a rounded tip and distinct inboard flap/outboard aileron.
    const ws = [
      [0.45, 2.78, 1.62, -1.92, 0.14],
      [1.2, 2.63, 1.48, -1.98, 0.13],
      [2.75, 2.33, 0.35, -2.0, 0.09],
      [4.35, 2.02, -0.86, -2.28, 0.06],
      [4.62, 1.97, -1.25, -2.29, 0.045],
    ];
    fixedWing(
      d,
      ws.map(([x, y, l, t, h]) => [side * x, y, l, l + (t - l) * 0.72, h]),
      upper,
    );
    for (const [j, a, b, source] of [
      [0, 0, 2, 'flapPosition'],
      [1, 2, 4, 'rollInput'],
    ]) {
      const part = ws
        .slice(a, b + 1)
        .map(([x, y, l, t, h]) => [side * x, y, l + (t - l) * 0.72, t, h * 0.45]);
      hinge(
        root,
        `AV8-${j ? 'aileron' : 'flap'}-${side}`,
        part,
        paint,
        bindings,
        source,
        j ? -0.3 : -side * 0.65,
        true,
      );
    }
    for (let i = 0; i < ws.length - 1; i++) {
      const a = ws[i],
        b = ws[i + 1];
      for (const f of [0.28, 0.58]) {
        const za = a[2] + (a[3] - a[2]) * f,
          zb = b[2] + (b[3] - b[2]) * f;
        d.rod(
          [side * a[0], a[1] + a[4] + 0.003 + 0.13 * (za - 1.62), za],
          [side * b[0], b[1] + b[4] + 0.003 + 0.13 * (zb - 1.62), zb],
          0.002,
          dark,
        );
      }
    }
    // LERX upper shoulder, with the intake opening kept clear.
    wing(
      d,
      [
        [side * 0.48, 2.8, 3.3, 1.62, 0.06],
        [side * 0.92, 2.74, 3.2, 1.54, 0.06],
        [side * 1.18, 2.66, 2.64, 1.46, 0.05],
      ],
      upper,
    );
    const tails = [
      [side * 0.22, 2.02, -4.5, -6.24, 0.07],
      [side * 1.96, 1.48, -6.08, -6.72, 0.05],
      [side * 2.123, 1.43, -6.28, -6.76, 0.03],
    ];
    hinge(root, `AV8-stabilator-${side}`, tails, paint, bindings, 'pitchInput', side * 0.3);
    // Clean underside lift-improvement strakes, without optional gun pods or stores.
    const strake = [
      [side * 0.4, 1.1, 2.1],
      [side * 0.4, 0.6, 1.0],
      [side * 0.4, 0.55, -1.55],
      [side * 0.4, 0.91, -2.3],
    ];
    sheet(d, strake, paint, [side, 0, 0]);
    outline(d, strake, 0.012, paint);
    d.text('MARINES', [side * 0.31, 1.76, -5.35], 0.14, (side * Math.PI) / 2, dark);
    d.text('RESCUE', [side * 0.43, 2.3, 4.4], 0.065, (side * Math.PI) / 2, dark);
    for (const z of [4.3, 4.9]) d.box([0.009, 0.03, 0.29], [side * 0.4, 1.91, z], dark);
    d.add(
      new T.SphereGeometry(0.025, 8, 4),
      mat(`AV8-nav-${side}`, side === 1 ? '#b93939' : '#3d986f', {
        emissive: side === 1 ? '#641b1b' : '#1b5c38',
      }),
      [side * 4.62, 1.54, -1.7],
    );
  }
  // Single fin, with finite-thickness surfaces and a separately hinged rudder.
  const fin = [
    [0, 2.3, -3.55],
    [0, 2.43, -4.42],
    [0, 3.5, -6.39],
    [0, 3.55, -6.91],
    [0, 2.03, -6.57],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * 0.045, p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-0.045, a[1], a[2]],
      [0.045, a[1], a[2]],
      [0.045, b[1], b[2]],
      [-0.045, b[1], b[2]],
      paint,
      [0, a[1] - 2, a[2] + 5],
    );
  }
  const rudder = group(root, 'AV8-rudder', [0, 2.05, -6.58]),
    rd = detailKit(rudder, rudder.name);
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.036, 0, 0],
        [side * 0.036, 1.5, -0.33],
        [side * 0.036, 1.48, -0.48],
        [side * 0.036, 0, -0.18],
      ],
      upper,
      [side, 0, 0],
    );
  rd.rod([0, 0, -0.17], [0, 1.48, -0.47], 0.025, upper);
  rd.finish();
  bindings.push({
    node: rudder.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.38,
  });
  // Bicycle gear: single nose wheel, paired main wheels and two wing outriggers.
  for (const [name, x, z, r] of [
    ['nose', 0, 2.65, 0.35],
    ['main', 0, -0.831, 0.365],
    ['left', 2.591, -1.517, 0.18],
    ['right', -2.591, -1.517, 0.18],
  ]) {
    const g = group(root, `AV8-gear-${name}`),
      gd = detailKit(g, g.name),
      h = x === 0 ? 1.32 : 1.74;
    gd.rod([x, h, z + 0.19], [x, r, z], x === 0 ? 0.05 : 0.029, metal);
    gd.rod([x, h - 0.15, z + 0.48], [x, r + 0.13, z], 0.024, metal);
    for (const dx of name === 'main' ? [-0.21, 0.21] : [0]) {
      gd.add(new T.CylinderGeometry(r, r, 0.17, 24).rotateZ(Math.PI / 2), rubber, [x + dx, r, z]);
      for (const side of [-1, 1])
        gd.add(new T.CylinderGeometry(r * 0.55, r * 0.55, 0.018, 20).rotateZ(Math.PI / 2), metal, [
          x + dx + side * 0.09,
          r,
          z,
        ]);
    }
    if (x !== 0) {
      ellipsoid(d, [x, 1.76, z + 0.2], [0.13, 0.14, 0.64], paint, 16);
      gd.box([0.025, 0.52, 0.23], [x + 0.1, 1.35, z + 0.06], paint);
    } else gd.box([0.025, 0.45, 0.55], [0.2, 0.95, z + 0.12], paint);
    gd.finish();
    bindings.push(
      { node: g.name, source: 'gear', property: 'position', axis: 'y', scale: -0.9, offset: 0.9 },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  // Spine vents and access lines are geometric, not photograph textures.
  for (let j = 0; j < 7; j++) d.box([0.29, 0.012, 0.035], [0, 2.23, -3.6 - j * 0.07], dark);
  for (const z of [-0.3, -3.5])
    sheet(
      d,
      [
        [0, 2.46, z],
        [0, 2.71, z - 0.04],
        [0, 2.65, z - 0.22],
        [0, 2.4, z - 0.28],
      ],
      upper,
      [1, 0, 0],
    );
  d.finish();
  const interior = av8Cockpit(root, { paint, dark, metal, glass });
  cleanGeometry(root);
  return {
    root,
    frame: av8Frame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.68, -1.94] }],
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

function av8Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'AV8-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'AV8'),
    { bindings, derived, ink, black, amber } = ins,
    panel = mat('AV8-panel', '#596266', { side: T.DoubleSide }),
    seat = mat('AV8-upholstery', '#686b50'),
    belt = mat('AV8-harness', '#a5aa96'),
    green = mat('AV8-display', '#79d38d', { emissive: '#295e37', emissiveIntensity: 0.7 });
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'gearPosition',
      'flapPosition',
      'thrustVectorPosition',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear', thrustVectorPosition: 'thrustVector' }[k] ??
        k,
      { component: 'aircraftState', path: [k] },
    ]),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
  sources.engine1 = { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] };
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
    headingDegrees: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    nozzleDegrees: { op: 'multiply', args: ['thrustVector', 90] },
    rpmPercent: { op: 'multiply', args: ['engine1', 100] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
  });
  // FO-1 crop coordinates, uniform estimated panel width. Absolute panel dimensions
  // are not provided by this foldout; see the stated limitation in its review.
  const k = 0.00094,
    z = 4.75,
    at = (u, v, dz = 0) => [(535 - u) * k, 2.4 + (400 - v) * k, z + dz];
  const rect = (u, v, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([a, b]) => at(u + a * w, v + b * h, dz)),
    circle = (u, v, r) =>
      Array.from({ length: 40 }, (_, j) =>
        at(u + Math.cos((j * Math.PI) / 20) * r, v + Math.sin((j * Math.PI) / 20) * r),
      );
  const box = (u, v, w, h, material = black, depth = 0.012) =>
      d.box([w * k, h * k, depth], at(u, v, -0.012 - depth / 2), material),
    text = (t, u, v, h = 8, material = ink, role = 'panel') =>
      d.text(t, at(u, v, -0.033), h * k, Math.PI, material, role);
  const edge = [
    [110, 400],
    [110, 280],
    [145, 155],
    [210, 60],
    [290, 20],
    [400, 9],
    [650, 9],
    [760, 20],
    [840, 65],
    [905, 155],
    [953, 280],
    [953, 418],
    [922, 418],
    [922, 534],
    [642, 534],
    [642, 922],
    [422, 922],
    [422, 536],
    [143, 536],
    [143, 418],
  ];
  sheet(
    d,
    edge.map((p) => at(...p)),
    panel,
    [0, 0, -1],
    [circle(570, 396, 38), rect(285, 256, 148, 112)],
  );
  outline(
    d,
    edge.map((p) => at(...p, -0.004)),
    0.006,
    black,
  );
  const arc = edge.slice(1, 13);
  for (let j = 0; j < arc.length - 1; j++) {
    const a = at(...arc[j]),
      b = at(...arc[j + 1]);
    quad(d, a, b, [b[0], b[1] - 0.02, z + 0.23], [a[0], a[1] - 0.02, z + 0.23], black, [0, 1, 0]);
  }
  function screen(u, v, w, h, hole = false) {
    sheet(
      d,
      rect(u, v, w, h, -0.008),
      black,
      [0, 0, -1],
      hole ? [rect(u, v - 3, 148, 112, -0.008)] : [],
    );
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        box(u + side * (w / 2 - 11), v - h * 0.33 + j * h * 0.132, 13, 17, panel);
        box(u - w * 0.33 + j * w * 0.132, v + side * (h / 2 - 11), 17, 13, panel);
      }
  }
  screen(285, 259, 220, 226, true);
  screen(778, 264, 223, 226);
  ins.horizon('MPCD-attitude', at(285, 256, 0.012), 148 * k, 112 * k, { blankBackdrop: true });
  ins.readout('MPCD-speed', at(246, 331, -0.034), 'knots', 3, 0.012, green);
  text('TAS', 246, 315, 7, green, 'display');
  ins.readout('MPCD-altitude', at(330, 331, -0.034), 'feet', 5, 0.009, green, true, true);
  text('GEO FT', 330, 315, 7, green, 'display');
  text('SIM ATT', 285, 176, 8, green, 'display');
  // A true-heading rose occupies the second MPCD; no invented map or radar picture.
  const hg = group(cabin, 'AV8-heading', at(778, 256, -0.03)),
    hd = detailKit(hg, hg.name);
  for (let j = 0; j < 72; j++) {
    const a = (j * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(j % 6 ? 0.065 : 0.06), p(0.07), 0.00065, green);
    if (j % 6 === 0)
      hd.text(
        j === 0 ? 'N' : j === 18 ? 'E' : j === 36 ? 'S' : j === 54 ? 'W' : String(j / 2),
        p(0.049),
        0.008,
        Math.PI,
        green,
      );
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
  d.rod(at(778, 175, -0.031), at(778, 187, -0.031), 0.001, ink);
  text('TRUE / SIM', 778, 340, 8, green, 'display');
  ins.horizon('standby', at(570, 396, 0.012), 0.071, 0.071, { round: true, blankBackdrop: true });
  ins.dial(
    'speed',
    at(472, 420, -0.01),
    37 * k,
    'knots',
    [
      [0, 0],
      [100, 0.75],
      [200, 1.7],
      [300, 2.65],
      [400, 3.6],
      [600, 5.5],
    ],
    [0, 100, 200, 300, 400, 600],
    'TAS',
    { tickLabels: { 0: 0, 100: 1, 200: 2, 300: 3, 400: 4, 600: 6 }, minorStep: 20 },
  );
  ins.altimeter('altimeter', at(570, 506, -0.01), 37 * k, 'feet');
  // Actual VVI is offset to the right; standby AOA has no compatible calibrated sensor.
  ins.dial(
    'vertical-speed',
    at(675, 480, -0.01),
    36 * k,
    'verticalFpm',
    [
      [-6000, -Math.PI / 2],
      [0, Math.PI / 2],
      [6000, Math.PI * 1.5],
    ],
    [-6000, -4000, -2000, 0, 2000, 4000, 6000],
    'FPM',
    { tickLabels: { '-6000': -6, '-4000': -4, '-2000': -2, 0: 0, 2000: 2, 4000: 4, 6000: 6 } },
  );
  pt.gauge(...at(472, 506).slice(0, 2), z - 0.01, 36 * k, black, false);
  text('AOA', 472, 496, 7);
  text('--', 472, 516, 9, amber, 'display');
  // UFC, ODU, HUD controls and the distinct upper-right engine display.
  box(535, 121, 184, 198);
  box(535, 42, 108, 18, panel);
  text('----', 535, 42, 10, green, 'display');
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 4; col++) {
      const u = 495 + col * 25,
        v = 74 + row * 25;
      box(u, v, 19, 19, panel);
      text(
        [
          '1',
          '2',
          '3',
          'BRT',
          '4',
          '5',
          '6',
          'VOL',
          '7',
          '8',
          '9',
          'ALT',
          'CLR',
          '0',
          'ENT',
          'ON',
          'COM1',
          'TCN',
          'AWL',
          'COM2',
        ][row * 4 + col],
        u,
        v,
        row === 4 ? 4 : 6,
      );
    }
  for (let row = 0; row < 5; row++) {
    box(417, 60 + row * 31, 28, 24, black);
    text('--', 417, 60 + row * 31, 8, green, 'display');
  }
  box(533, 267, 185, 48);
  for (let j = 0; j < 6; j++) {
    const u = 457 + j * 30;
    d.add(
      new T.CylinderGeometry(0.006, 0.007, 0.012, 10).rotateX(Math.PI / 2),
      panel,
      at(u, 265, -0.031),
    );
    text(['BRT', 'SYM', 'ATT', 'VIDEO', 'ALT', 'BRT'][j], u, 281, 5);
  }
  sheet(
    d,
    [
      [686, 25],
      [767, 25],
      [824, 48],
      [855, 83],
      [864, 127],
      [686, 127],
    ].map((p) => at(...p, -0.018)),
    black,
    [0, 0, -1],
  );
  text('ENGINE', 771, 34, 9);
  for (const [u, v, label] of [
    [731, 60, 'RPM NORM'],
    [810, 60, 'NOZ DEG'],
    [731, 98, 'JPT --'],
    [810, 98, 'OIL --'],
  ])
    text(label, u, v, 6);
  ins.readout('rpm', at(731, 78, -0.034), 'rpmPercent', 3, 0.011, green, false, true);
  ins.readout(
    'nozzle-indicator',
    at(810, 78, -0.034),
    'nozzleDegrees',
    2,
    0.011,
    green,
    false,
    true,
  );
  box(812, 479, 192, 84);
  text('FUEL', 812, 452, 8);
  text('-----', 798, 480, 12, amber, 'display');
  // Dark warning cells remain unlit unless a corresponding simulated state exists.
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      box(237 + col * 65, 55 + row * 28, 57, 18);
      text(
        ['FIRE', 'HYD', 'CAUTION', 'OIL', 'GEN', 'ECS', 'FLAPS', 'GEAR', 'WATER'][row * 3 + col],
        237 + col * 65,
        55 + row * 28,
        5,
      );
    }
  box(280, 475, 273, 106);
  for (let j = 0; j < 9; j++) {
    const u = 160 + j * 28;
    box(u, 438, 22, 12);
    d.add(
      new T.CylinderGeometry(0.006, 0.007, 0.012, 10).rotateX(Math.PI / 2),
      panel,
      at(u, 465, -0.031),
    );
    d.rod(at(u, 500, -0.03), at(u, 492, -0.049), 0.0025, m.metal);
  }
  box(534, 703, 195, 270);
  for (const [v, labels] of [
    [625, ['FLR', 'VIS', 'ECS']],
    [700, ['MODE', 'SAFE', 'BRT']],
    [775, ['RPS', 'YAW', 'PITCH']],
    [845, ['ON', 'AUTO', 'OFF']],
  ])
    for (let j = 0; j < 3; j++) {
      const u = 473 + j * 59;
      d.add(
        new T.CylinderGeometry(0.007, 0.009, 0.014, 10).rotateX(Math.PI / 2),
        panel,
        at(u, v, -0.033),
      );
      text(labels[j], u, v - 17, 6);
    }
  box(897, 667, 103, 231);
  for (let row = 0; row < 12; row++)
    for (let col = 0; col < 2; col++) {
      box(871 + col * 51, 568 + row * 17, 45, 12, panel);
      text('--', 871 + col * 51, 568 + row * 17, 4, ink, 'display');
    }
  // Lower side panels, distinct from the center pedestal: gear/flap controls left,
  // V/STOL/radio-altimeter controls right. Detached foldout details are not copied twice.
  for (const [edge, label, u, v] of [
    [
      [
        [70, 720],
        [272, 710],
        [272, 920],
        [45, 920],
      ],
      'GEAR / FLAPS',
      180,
      734,
    ],
    [
      [
        [662, 780],
        [826, 780],
        [826, 918],
        [662, 918],
      ],
      'V/STOL',
      742,
      796,
    ],
    [
      [
        [833, 551],
        [951, 551],
        [1090, 704],
        [1090, 790],
        [833, 790],
      ],
      'CAUTION',
      892,
      562,
    ],
  ]) {
    sheet(
      d,
      edge.map((p) => at(...p, -0.006)),
      panel,
      [0, 0, -1],
    );
    outline(
      d,
      edge.map((p) => at(...p, -0.008)),
      0.003,
      black,
    );
    text(label, u, v, 6);
  }
  pt.gauge(...at(164, 767).slice(0, 2), z - 0.012, 27 * k, black, false);
  text('FLAPS', 164, 750, 5);
  ins.pointer('flap-indicator', at(164, 767, -0.032), 20 * k, 'flapPosition', [
    [0, -1.8],
    [1, 1.8],
  ]);
  for (const [u, v] of [
    [248, 766],
    [248, 814],
    [116, 851],
    [741, 830],
    [792, 830],
    [741, 885],
  ]) {
    d.add(
      new T.CylinderGeometry(0.008, 0.009, 0.012, 10).rotateX(Math.PI / 2),
      black,
      at(u, v, -0.03),
    );
    d.rod(at(u, v - 3, -0.04), at(u, v + 3, -0.04), 0.001, ink);
  }
  box(209, 871, 28, 45, m.metal);
  text('ANTI SKID', 111, 830, 5);
  const gearLever = group(cabin, 'AV8-gear-lever', at(211, 874, -0.055)),
    gld = detailKit(gearLever, gearLever.name);
  gld.rod([0, 0, 0], [0, 0.035, -0.018], 0.004, m.metal);
  gld.box([0.025, 0.018, 0.014], [0, 0.038, -0.02], black);
  gld.finish();
  bindings.push({
    node: gearLever.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    scale: -0.7,
    offset: 0.35,
  });
  for (const [u, v, label] of [
    [781, 680, 'BRAKE'],
    [1014, 746, 'HYD'],
    [1007, 323, 'RWR'],
  ]) {
    pt.gauge(...at(u, v).slice(0, 2), z - 0.01, 32 * k, black, false);
    text(label, u, v - 6, 6);
    text('--', u, v + 9, 9, amber, 'display');
  }
  for (let j = 0; j < 3; j++) {
    const g = group(
        cabin,
        `AV8-gear-lamp-${j}`,
        at(342 + (j === 0 ? 0 : j === 1 ? -15 : 15), 737 + (j === 0 ? 0 : 24), -0.034),
      ),
      gd = detailKit(g, g.name);
    gd.box([0.008, 0.008, 0.002], [0, 0, 0], green);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  // Physical combiner and triangulated supports; HUD symbology is not collimated yet.
  const hud = [
    [430, 4],
    [438, -132],
    [470, -153],
    [602, -153],
    [634, -132],
    [642, 4],
  ].map((p) => at(...p, -0.09));
  sheet(d, hud, m.glass, [0, 0, -1]);
  outline(d, hud, 0.004, black);
  for (const side of [-1, 1]) {
    d.rod(at(535 + side * 106, 4, -0.1), at(535 + side * 98, -128, -0.1), 0.008, m.metal);
    d.rod(at(535 + side * 106, 4, 0.1), at(535 + side * 98, -128, -0.1), 0.007, black);
  }
  d.box([0.8, 0.03, 2.2], [0, 1.95, 3.65], black);
  for (const side of [-1, 1]) {
    sheet(
      d,
      [
        [side * 0.37, 1.95, 2.7],
        [side * 0.37, 1.95, 4.9],
        [side * 0.37, 2.42, 4.9],
        [side * 0.37, 2.43, 2.7],
      ],
      panel,
      [-side, 0, 0],
    );
    d.box([0.18, 0.21, 1.55], [side * 0.33, 2.16, 3.7], panel);
    const cg = group(cabin, `AV8-console-${side}`, [side * 0.33, 2.275, 3.7]);
    cg.rotation.x = Math.PI / 2;
    const cd = detailKit(cg, cg.name);
    const units =
      side === 1
        ? [
            ['SERVICES', -0.62, 0.25, 5],
            ['LIGHTS', -0.38, 0.18, 3],
            ['FUEL', -0.16, 0.2, 6],
            ['THROTTLE', 0.12, 0.34, 0],
            ['SAAHS', 0.43, 0.22, 6],
            ['TRIM', 0.64, 0.15, 2],
          ]
        : [
            ['AWLS', -0.62, 0.22, 4],
            ['NVG', -0.35, 0.28, 0],
            ['ECS', -0.06, 0.25, 5],
            ['LIGHTS', 0.21, 0.23, 5],
            ['RCS', 0.43, 0.17, 3],
            ['ELECT', 0.64, 0.21, 5],
          ];
    for (let j = 0; j < units.length; j++) {
      const [label, y, h, n] = units[j];
      cd.box([0.17, h, 0.01], [0, y, 0], black);
      cd.text(label, [0, y + h / 2 - 0.025, -0.008], 0.011, Math.PI, ink);
      if (label === 'NVG') cd.box([0.12, 0.2, 0.035], [0, y - 0.01, -0.022], panel);
      if (label === 'THROTTLE')
        for (const x of [-0.045, 0.045]) cd.box([0.018, 0.27, 0.004], [x, y - 0.01, -0.008], panel);
      for (let q = 0; q < n; q++) {
        const x = -0.047 + (q % 3) * 0.047,
          v = y - 0.015 - Math.floor(q / 3) * 0.055;
        if ((j + q) % 2) cd.rod([x, v, -0.008], [x, v + 0.006, -0.028], 0.003, m.metal);
        else
          cd.add(new T.CylinderGeometry(0.008, 0.009, 0.012, 10).rotateX(Math.PI / 2), panel, [
            x,
            v,
            -0.015,
          ]);
        cd.text(
          label === 'FUEL' ? ['L', 'R', 'PROP', 'ON', 'OFF', 'AUTO'][q] : String(q + 1),
          [x, v + 0.025, -0.009],
          0.006,
          Math.PI,
          ink,
        );
      }
    }
    cd.finish();
  }
  // SJU-4-style seat structure, harness and center stick. Detail dimensions are estimates.
  const sg = group(cabin, 'AV8-seat', [0, 2.15, 3.44]);
  sg.rotation.x = -0.18;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.43, 0.12, 0.48], [0, 0, 0.2], seat);
  beveledBox(sd, [0.43, 0.66, 0.13], [0, 0.37, -0.07], seat);
  beveledBox(sd, [0.28, 0.26, 0.17], [0, 0.87, -0.09], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.23, -0.1, -0.16], [side * 0.23, 1.01, -0.16], 0.023, m.metal);
    sheet(
      sd,
      [
        [side * 0.1, 0.68, 0.01],
        [side * 0.15, 0.68, 0.01],
        [side * 0.08, 0.11, 0.11],
        [side * 0.03, 0.11, 0.11],
      ],
      belt,
      [0, 0, 1],
    );
    sd.box([0.13, 0.03, 0.23], [side * 0.16, 0.09, 0.17], belt);
  }
  sd.box([0.055, 0.04, 0.025], [0, 0.12, 0.16], m.metal);
  sd.ring(0.045, 0.008, [0, 0.13, 0.43], amber);
  sd.finish();
  const stick = group(cabin, 'AV8-stick', [0, 2.0, 4.06]),
    st = detailKit(stick, stick.name);
  st.rod([0, 0, 0], [0, 0.3, -0.04], 0.021, black);
  beveledBox(st, [0.07, 0.12, 0.07], [0, 0.36, -0.05], black, 0.009);
  for (const x of [-0.024, 0.024])
    st.add(new T.SphereGeometry(0.009, 8, 4), panel, [x, 0.4, -0.085]);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.22 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.22 },
  );
  for (const [name, x, source, scale] of [
    ['throttle', 0.29, 'power', 0.7],
    ['nozzle-lever', 0.38, 'thrustVector', -0.9],
  ]) {
    const g = group(cabin, `AV8-${name}`, [x, 2.29, 3.83]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0.12, 0], 0.01, m.metal);
    dd.box([0.055, 0.04, 0.065], [0, 0.13, 0], black);
    dd.finish();
    bindings.push({
      node: g.name,
      source,
      property: 'rotation',
      axis: 'x',
      scale,
      offset: source === 'power' ? -0.35 : 0.45,
    });
  }
  for (const side of [-1, 1]) {
    const g = group(cabin, `AV8-pedal-${side}`, [side * 0.13, 2.02, 4.85]),
      dd = detailKit(g, g.name);
    dd.box([0.12, 0.14, 0.025], [0, 0, 0], m.metal);
    for (let j = 0; j < 5; j++) dd.box([0.1, 0.005, 0.004], [0, -0.05 + j * 0.025, -0.017], black);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.055,
    });
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
