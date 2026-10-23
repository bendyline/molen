/** N522B panel and controls, Smithsonian NASM2016-03584 (Dane Penland, CC0).
 * Panel width checked against Beech Detail Specification 131: 45.75 inches.
 * Photograph is a perspective reference, not a surveyed orthographic drawing. */
import { panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import { beveledBox, detailKit, ellipsoid, group, mat, outline, sheet, T } from './mesh-kit.mjs';
export function beech18Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Beech18-cockpit'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'Beech18'),
    { bindings, derived, ink, black } = ins;
  const green = mat('Beech18-cabin-green', '#31534c'),
    liner = mat('Beech18-liner', '#aaa58a'),
    wood = mat('Beech18-wheel-wood', '#5b3020'),
    brown = mat('Beech18-controls-brown', '#6e3f2d'),
    yellow = mat('Beech18-prop-control', '#ce991e');
  const k = 1.16205 / 725,
    x = (u) => (1018 - u) * k,
    y = (v) => 1.85 + (450 - v) * k,
    z = 3,
    at = (u, v, dz = 0) => [x(u), y(v), z + dz];
  const edge = [
    [654, 696],
    [654, 488],
    [671, 452],
    [726, 432],
    [826, 421],
    [838, 395],
    [856, 385],
    [1180, 385],
    [1213, 403],
    [1220, 421],
    [1300, 432],
    [1357, 450],
    [1380, 478],
    [1380, 696],
  ].map((q) => at(...q));
  const circle = (u, v, r) =>
    Array.from({ length: 40 }, (_, i) => [
      x(u) + r * Math.cos((i * Math.PI) / 20),
      y(v) + r * Math.sin((i * Math.PI) / 20),
      z,
    ]);
  sheet(d, edge, m.dark, [0, 0, -1], [circle(895, 508, 0.051), circle(1300, 501, 0.044)]);
  sheet(
    d,
    edge.map((q) => [q[0], q[1], q[2] + 0.13]),
    black,
    [0, 0, 1],
  );
  outline(d, edge, 0.009, green);
  d.box([1.14, 0.027, 0.23], [0, 1.85, 3.11], m.dark);
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
    ['gearPosition', 'aircraftState', ['gearPosition']],
    ['engine1', 'aircraftState', ['engines', 'engine-1', 'rpm']],
    ['engine2', 'aircraftState', ['engines', 'engine-2', 'rpm']],
    ['pitchInput', 'aircraftInput', ['pitch']],
    ['rollInput', 'aircraftInput', ['roll']],
    ['yawInput', 'aircraftInput', ['yaw']],
    ['power', 'aircraftInput', ['power']],
  ])
    sources[name] = { component, path };
  Object.assign(derived, {
    mph: { op: 'multiply', args: ['trueAirspeed', 2.2369362920544] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * Math.PI] },
    rpm1: { op: 'multiply', args: ['engine1', 2300] },
    rpm2: { op: 'multiply', args: ['engine2', 2300] },
    turnDegrees: { op: 'multiply', args: ['yawRate', 180 / Math.PI] },
  });
  Object.assign(derived, {
    rollUp: { op: 'max', args: ['rollInput', 0] },
    rollDown: { op: 'min', args: ['rollInput', 0] },
    leftUp: { op: 'multiply', args: ['rollUp', (37.5 * Math.PI) / 180] },
    leftDown: { op: 'multiply', args: ['rollDown', (20 * Math.PI) / 180] },
    rightUp: { op: 'multiply', args: ['rollDown', (-37.5 * Math.PI) / 180] },
    rightDown: { op: 'multiply', args: ['rollUp', (-20 * Math.PI) / 180] },
    aileronL: { op: 'add', args: ['leftUp', 'leftDown'] },
    aileronR: { op: 'add', args: ['rightUp', 'rightDown'] },
    pitchUp: { op: 'max', args: ['pitchInput', 0] },
    pitchDown: { op: 'min', args: ['pitchInput', 0] },
    elevatorUp: { op: 'multiply', args: ['pitchUp', (35 * Math.PI) / 180] },
    elevatorDown: { op: 'multiply', args: ['pitchDown', (25 * Math.PI) / 180] },
    elevatorAngle: { op: 'add', args: ['elevatorUp', 'elevatorDown'] },
  });
  const speed = (n, u, v, r) =>
    ins.dial(
      n,
      at(u, v, -0.014),
      r,
      'mph',
      [
        [0, 0],
        [60, 0.9],
        [100, 1.9],
        [140, 2.9],
        [180, 3.8],
        [220, 4.7],
        [300, 5.9],
      ],
      [0, 60, 100, 140, 180, 220, 300],
      'TAS MPH',
      { responseSeconds: 0.2 },
    );
  speed('speed', 726, 506, 0.045);
  speed('speed-right', 1235, 569, 0.041);
  ins.headingDrum('heading', at(803, 505, -0.014), 0.041, 'trueHeading');
  ins.horizon('attitude', at(895, 508, 0.011), 0.102, 0.102, { round: true, blankBackdrop: true });
  d.ring(0.055, 0.003, at(895, 508, -0.015), m.metal);
  ins.horizon('attitude-right', at(1300, 501, 0.011), 0.088, 0.088, {
    round: true,
    blankBackdrop: true,
  });
  d.ring(0.049, 0.003, at(1300, 501, -0.015), m.metal);
  ins.altimeter('altimeter', at(731, 599, -0.014), 0.046, 'feet');
  ins.altimeter('altimeter-right', at(1297, 568, -0.014), 0.045, 'feet');
  for (const [n, u, v, r] of [
    ['turn', 807, 599, 0.043],
    ['turn-right', 1235, 502, 0.044],
  ])
    ins.dial(
      n,
      at(u, v, -0.014),
      r,
      'turnDegrees',
      [
        [-6, -0.6],
        [0, 0],
        [6, 0.6],
      ],
      [-3, 0, 3],
      'TURN DEG S',
    );
  for (const [n, u, v] of [
    ['vsi', 878, 599],
    ['vsi-right', 1231, 635],
  ])
    ins.dial(
      n,
      at(u, v, -0.014),
      0.042,
      'verticalFpm',
      [
        [-2000, -2.5],
        [0, 0],
        [2000, 2.5],
      ],
      [-2000, -1000, 0, 1000, 2000],
      'FT MIN',
      { responseSeconds: 0.5 },
    );
  ins.dial(
    'rpm-left',
    at(973, 570, -0.014),
    0.042,
    'rpm1',
    [
      [0, 0],
      [1000, 1.6],
      [2000, 3.3],
      [3000, 5.2],
    ],
    [0, 1000, 2000, 3000],
    'RPM L',
    { responseSeconds: 0.25 },
  );
  ins.pointer(
    'rpm-right',
    at(973, 570, -0.032),
    0.03,
    'rpm2',
    [
      [0, 0],
      [1000, 1.6],
      [2000, 3.3],
      [3000, 5.2],
    ],
    { material: yellow },
  );
  d.text('R', at(995, 589, -0.035), 0.008, Math.PI, yellow);
  for (const [u, v, r, label] of [
    [972, 502, 0.045, 'OIL L --'],
    [1040, 502, 0.044, 'OIL R --'],
    [1106, 501, 0.043, 'CLOCK --'],
    [1173, 501, 0.043, 'TEMP --'],
    [1040, 570, 0.043, 'MAP --'],
    [1104, 569, 0.041, 'ALT SET --'],
    [1173, 569, 0.042, 'PRESS --'],
    [1099, 635, 0.039, 'TEMP --'],
    [1167, 634, 0.039, 'TEMP --'],
    [1300, 631, 0.045, 'NAV --'],
    [731, 656, 0.035, 'NAV --'],
    [825, 659, 0.027, 'VAC --'],
    [873, 659, 0.027, 'FLAP'],
    [918, 657, 0.027, 'FUEL --'],
    [968, 657, 0.027, 'FUEL --'],
  ]) {
    pt.gauge(x(u), y(v), z - 0.02, r, undefined, false);
    d.text(label, at(u, v, -0.034), 0.0065, Math.PI, ink);
  }
  ins.pointer('flaps', at(873, 659, -0.038), 0.019, 'flapPosition', [
    [0, -1],
    [1, 1],
  ]);
  // Four original radio heads across the raised centre section; no fabricated frequencies.
  for (const [u, label] of [
    [905, 'COM --'],
    [975, 'NAV --'],
    [1040, 'NAV --'],
    [1106, 'COM --'],
  ]) {
    d.box([0.079, 0.055, 0.024], at(u, 440, -0.01), black);
    d.text(label, at(u, 434, -0.026), 0.0065, Math.PI, ink);
    for (const a of [-23, 23]) pt.knob(x(u + a), y(451), z - 0.032, 0.009);
    for (const a of [-16, 16])
      d.add(new T.SphereGeometry(0.003, 6, 4), m.metal, at(u + a, 424, -0.026));
  }
  pt.knob(x(1176), y(427), z - 0.04, 0.025);
  d.text('AUDIO', at(1176, 405, -0.02), 0.007, Math.PI, ink);
  for (let i = 0; i < 13; i++) pt.knob(x(858 + i * 23), y(405), z - 0.027, 0.007);
  for (const [u, v] of [
    [687, 548],
    [752, 548],
    [841, 547],
    [932, 547],
    [1370, 547],
    [686, 678],
    [1018, 678],
    [1355, 678],
    [848, 400],
    [1205, 405],
  ])
    d.add(new T.SphereGeometry(0.004, 6, 4), m.metal, at(u, v, -0.014));
  // Downward-tilted switch subpanels, flanking the centre quadrant.
  for (const side of [-1, 1]) {
    const sub = group(cabin, `Beech18-subpanel-${side}`, [side * 0.38, 1.37, 2.93]);
    sub.rotation.x = -Math.PI / 6;
    const sd = detailKit(sub, sub.name);
    sd.box([0.43, 0.105, 0.035], [0, 0, 0], green);
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 8; i++) {
        const xx = -0.177 + i * 0.05,
          yy = -0.027 + row * 0.05;
        sd.rod([xx, yy, -0.02], [xx, yy + 0.008, -0.042], 0.003, m.metal);
        sd.text(
          ['BAT', 'GEN', 'LTS', 'NAV', 'PUMP', 'HEAT', 'ICE', 'START'][i],
          [xx, yy + 0.016, -0.024],
          0.0044,
          Math.PI,
          ink,
        );
      }
    sd.finish();
  }
  const q = group(cabin, 'Beech18-quadrant', [0, 1.08, 2.78]),
    qd = detailKit(q, q.name);
  beveledBox(qd, [0.34, 0.39, 0.45], [0, 0, -0.08], green, 0.035);
  for (const [i, xx, label, color, source] of [
    [0, 0.13, 'P', yellow, null],
    [1, 0.08, 'P', yellow, null],
    [2, 0.027, 'T', brown, 'power'],
    [3, -0.027, 'T', brown, 'power'],
    [4, -0.08, 'M', brown, null],
    [5, -0.13, 'M', brown, null],
  ]) {
    qd.box([0.015, 0.012, 0.32], [xx, 0.2, -0.09], black);
    const lever = group(q, `Beech18-lever-${i}`, [xx, 0.19, 0.01]),
      ld = detailKit(lever, lever.name);
    ld.rod([0, 0, 0], [0, 0.24, -0.03], 0.009, m.metal);
    ellipsoid(ld, [0, 0.25, -0.03], [0.022, 0.024, 0.022], color, 12);
    ld.text(label, [0, 0.25, -0.054], 0.011, Math.PI, ink);
    ld.finish();
    if (source)
      bindings.push({ node: lever.name, source, property: 'rotation', axis: 'x', scale: 0.7 });
  }
  qd.ring(0.049, 0.009, [0, -0.03, -0.315], black);
  qd.rod([0, -0.03, -0.32], [0.03, -0.09, -0.32], 0.009, m.metal);
  for (const side of [-1, 1]) {
    pt.gauge(side * 0.11, 0.74, 2.5, 0.043, undefined, false);
    d.text('FUEL --', [side * 0.11, 0.74, 2.48], 0.008, Math.PI, ink);
    qd.rod([side * 0.11, -0.11, -0.31], [side * 0.1, -0.17, -0.34], 0.01, brown);
    qd.rod([side * 0.14, -0.24, -0.29], [side * 0.14, -0.3, -0.31], 0.01, m.metal);
  }
  qd.finish();
  // Paired bow-tie wheels on individual columns; pitch shaft and wheel roll are separate.
  for (const side of [-1, 1]) {
    const pitch = group(cabin, `Beech18-column-${side}`, [side * 0.36, 1.42, 2.38]),
      roll = group(pitch, `Beech18-wheel-${side}`),
      wd = detailKit(roll, roll.name),
      material = side === 1 ? wood : m.dark;
    d.rod([side * 0.36, 1.42, 2.45], [side * 0.36, 1.42, 3], 0.037, green);
    const points = [
      [-0.2, 0.13],
      [-0.23, 0.1],
      [-0.23, -0.1],
      [-0.2, -0.13],
      [-0.1, -0.1],
      [0, -0.08],
      [0.1, -0.1],
      [0.2, -0.13],
      [0.23, -0.1],
      [0.23, 0.1],
      [0.2, 0.13],
      [0.1, 0.09],
      [0, 0.075],
      [-0.1, 0.09],
    ].map(([a, b]) => [a, b, 0]);
    outline(wd, points, 0.019, material);
    for (const a of [-1, 1]) wd.rod([0, 0, 0], [a * 0.15, 0.065, 0], 0.019, green);
    ellipsoid(wd, [0, 0, 0], [0.055, 0.04, 0.025], green, 16);
    wd.text('BEECH', [0, 0, -0.028], 0.009, Math.PI, ink);
    wd.finish();
    bindings.push(
      { node: pitch.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.08 },
      { node: roll.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: -0.7 },
    );
    for (const sign of [-1, 1]) {
      const ped = group(cabin, `Beech18-pedal-${side}-${sign}`, [
          side * 0.36 + sign * 0.105,
          0.77,
          3.04,
        ]),
        pd = detailKit(ped, ped.name);
      pd.box([0.15, 0.16, 0.04], [0, 0, 0], m.metal);
      for (let j = 0; j < 8; j++)
        pd.rod(
          [-0.065 + j * 0.018, -0.066, -0.025],
          [-0.065 + j * 0.018, 0.066, -0.025],
          0.003,
          m.dark,
        );
      pd.finish();
      bindings.push({
        node: ped.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: sign * 0.035,
      });
    }
    d.box([0.033, 0.6, 1.3], [side * 0.65, 1.32, 1.85], green);
    d.rod([side * 0.63, 1.51, 2.5], [side * 0.63, 1.51, 2.11], 0.016, m.dark);
    // Small panel corner fans, with static blades and wire cage.
    const fg = group(cabin, `Beech18-fan-${side}`, [side * 0.54, 1.76, 2.96]),
      fd = detailKit(fg, fg.name);
    fd.rod([0, -0.15, 0.02], [0, 0, 0], 0.012, m.metal);
    fd.ring(0.065, 0.002, [0, 0, -0.015], m.metal);
    for (let j = 0; j < 3; j++) {
      const a = (j * 2 * Math.PI) / 3;
      ellipsoid(
        fd,
        [Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0],
        [0.03, 0.019, 0.004],
        m.dark,
        10,
      );
    }
    fd.finish();
  }
  // Green upholstered seats, belts and six passenger places behind the pilots.
  // The rear cabin narrows and its floor rises; a rectangular floor would escape the shell.
  const floors = [
    [3.2, 0.55, 0.71],
    [2.4, 0.64, 0.71],
    [0.6, 0.64, 0.74],
    [-0.8, 0.55, 0.91],
    [-1.6, 0.45, 1.07],
  ];
  for (let i = 0; i < floors.length - 1; i++) {
    const [za, wa, ya] = floors[i],
      [zb, wb, yb] = floors[i + 1];
    sheet(
      d,
      [
        [-wa, ya, za],
        [wa, ya, za],
        [wb, yb, zb],
        [-wb, yb, zb],
      ],
      m.dark,
      [0, 1, 0],
    );
  }
  for (const zz of [2.12, 1.05, -0.05, -1.15])
    for (const side of [-1, 1]) {
      const xx = side * (zz < 0 ? 0.28 : 0.34),
        lift = Math.max(0, (1.0 - (zz + 0.55)) * 0.14);
      beveledBox(d, [0.43, 0.11, 0.45], [xx, 0.96 + lift, zz], green, 0.04);
      beveledBox(d, [0.43, 0.65, 0.13], [xx, 1.29 + lift, zz - 0.21], green, 0.04);
      for (const sx of [-1, 1])
        d.rod([xx + sx * 0.18, 0.73 + lift, zz], [xx + sx * 0.18, 0.92 + lift, zz], 0.017, m.metal);
      d.rod([xx - 0.18, 1.03 + lift, zz - 0.13], [xx + 0.18, 1.03 + lift, zz + 0.13], 0.012, liner);
      d.box([0.045, 0.014, 0.033], [xx + 0.03, 1.044 + lift, zz + 0.02], m.metal);
    }
  sheet(
    d,
    [
      [-0.45, 1.07, -1.6],
      [0.45, 1.07, -1.6],
      [0.47, 1.9, -1.6],
      [0.35, 2.07, -1.6],
      [-0.35, 2.07, -1.6],
      [-0.47, 1.9, -1.6],
    ],
    liner,
    [0, 0, 1],
  );
  const overhead = group(cabin, 'Beech18-overhead-radio', [0, 2.14, 2.4]),
    od = detailKit(overhead, overhead.name);
  beveledBox(od, [0.33, 0.18, 0.19], [0, 0, 0], m.dark, 0.02);
  od.text('ADF  --', [0, 0.015, -0.102], 0.014, Math.PI, ink);
  for (let i = 0; i < 4; i++)
    od.add(new T.CylinderGeometry(0.015, 0.015, 0.02, 12).rotateX(Math.PI / 2), black, [
      -0.11 + i * 0.075,
      -0.042,
      -0.11,
    ]);
  od.finish();
  ins.headingDrum('compass', [0, 1.99, 2.78], 0.038, 'trueHeading');
  for (const zz of [1.1, 0, -1.1]) d.box([0.16, 0.016, 0.06], [0, 2.11, zz], liner);
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
