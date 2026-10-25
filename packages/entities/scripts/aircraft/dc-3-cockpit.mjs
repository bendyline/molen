/** Wright-powered DC-3, Knoxville museum panel; Carol M. Highsmith, LOC 2015630848.
 * The panel photograph supplies layout, not surveyed cockpit dimensions. */
import { panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import { beveledBox, detailKit, ellipsoid, group, mat, outline, sheet, T } from './mesh-kit.mjs';
export function dc3Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'DC3-cockpit'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'DC3'),
    { bindings, derived, ink, black } = ins;
  const green = mat('DC3-cockpit-green', '#34473b'),
    liner = mat('DC3-cabin-liner', '#c4bca5'),
    cloth = mat('DC3-seat-cloth', '#6b7c6f'),
    blue = mat('DC3-prop-controls', '#366ba0');
  const k = 1.95 / 1145,
    x = (u) => (925 - u) * k,
    y = (v) => 3.95 + (500 - v) * k,
    z = 8.15,
    at = (u, v, dz = 0) => [x(u), y(v), z + dz];
  const edge = [
    [370, 500],
    [778, 415],
    [1095, 415],
    [1515, 492],
    [1515, 807],
    [1115, 807],
    [1115, 870],
    [778, 870],
    [778, 825],
    [370, 825],
  ].map((q) => at(...q));
  const circle = (u, v, r) =>
    Array.from({ length: 40 }, (_, i) => [
      x(u) + r * Math.cos((i * Math.PI) / 20),
      y(v) + r * Math.sin((i * Math.PI) / 20),
      z,
    ]);
  sheet(d, edge, green, [0, 0, -1], [circle(618, 556, 0.065), circle(1250, 535, 0.06)]);
  sheet(
    d,
    edge.map((p) => [p[0], p[1], p[2] + 0.16]),
    black,
    [0, 0, 1],
  );
  outline(d, edge, 0.012, m.dark);
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
    rpm1: { op: 'multiply', args: ['engine1', 2350] },
    rpm2: { op: 'multiply', args: ['engine2', 2350] },
    turnDegrees: { op: 'multiply', args: ['yawRate', 180 / Math.PI] },
    rollUp: { op: 'max', args: ['rollInput', 0] },
    rollDown: { op: 'min', args: ['rollInput', 0] },
    leftUp: { op: 'multiply', args: ['rollUp', (27 * Math.PI) / 180] },
    leftDown: { op: 'multiply', args: ['rollDown', (18 * Math.PI) / 180] },
    rightUp: { op: 'multiply', args: ['rollDown', (-27 * Math.PI) / 180] },
    rightDown: { op: 'multiply', args: ['rollUp', (-18 * Math.PI) / 180] },
    aileronL: { op: 'add', args: ['leftUp', 'leftDown'] },
    aileronR: { op: 'add', args: ['rightUp', 'rightDown'] },
    pitchUp: { op: 'max', args: ['pitchInput', 0] },
    pitchDown: { op: 'min', args: ['pitchInput', 0] },
    elevatorUp: { op: 'multiply', args: ['pitchUp', Math.PI / 6] },
    elevatorDown: { op: 'multiply', args: ['pitchDown', Math.PI / 9] },
    elevatorAngle: { op: 'add', args: ['elevatorUp', 'elevatorDown'] },
  });
  for (const [n, u, v, r] of [
    ['speed', 714, 556, 0.056],
    ['speed-right', 1341, 533, 0.053],
  ])
    ins.dial(
      n,
      at(u, v, -0.014),
      r,
      'mph',
      [
        [0, 0],
        [40, 0.5],
        [80, 1.4],
        [120, 2.4],
        [160, 3.4],
        [200, 4.4],
        [240, 5.4],
        [280, 6.1],
      ],
      [0, 40, 80, 120, 160, 200, 240, 280],
      'TAS MPH',
      { responseSeconds: 0.2 },
    );
  for (const [n, u, v, r] of [
    ['altimeter', 529, 556, 0.052],
    ['altimeter-right', 1163, 533, 0.052],
  ])
    ins.altimeter(n, at(u, v, -0.014), r, 'feet');
  for (const [n, u, v, r] of [
    ['attitude', 618, 556, 0.065],
    ['attitude-right', 1250, 535, 0.06],
  ]) {
    ins.horizon(n, at(u, v, 0.011), r * 2, r * 2, { round: true, blankBackdrop: true });
    d.ring(r + 0.004, 0.003, at(u, v, -0.013), m.metal);
  }
  for (const [n, u, v] of [
    ['heading', 546, 647],
    ['heading-right', 1165, 631],
  ])
    ins.headingDrum(n, at(u, v, -0.014), 0.054, 'trueHeading');
  for (const [n, u, v] of [
    ['vsi', 638, 651],
    ['vsi-right', 1239, 642],
  ])
    ins.dial(
      n,
      at(u, v, -0.014),
      0.048,
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
  for (const [n, u, v] of [
    ['turn', 728, 676],
    ['turn-right', 1340, 635],
  ])
    ins.dial(
      n,
      at(u, v, -0.014),
      0.048,
      'turnDegrees',
      [
        [-6, -0.6],
        [0, 0],
        [6, 0.6],
      ],
      [-3, 0, 3],
      'TURN DEG S',
    );
  const rpm = [
    [0, 0],
    [1000, 1.5],
    [2000, 3],
    [3000, 4.5],
    [4000, 6],
  ];
  ins.dial(
    'rpm-left',
    at(822, 503, -0.014),
    0.057,
    'rpm1',
    rpm,
    [0, 1000, 2000, 3000, 4000],
    'RPM L',
    { responseSeconds: 0.25 },
  );
  ins.pointer('rpm-right', at(822, 503, -0.031), 0.043, 'rpm2', rpm, { material: blue });
  d.text('R', at(843, 521, -0.036), 0.009, Math.PI, blue);
  for (const [u, v, r, label] of [
    [706, 486, 0.036, 'CLOCK --'],
    [1168, 473, 0.036, 'CLOCK --'],
    [900, 503, 0.057, 'MAP --'],
    [823, 576, 0.052, 'NAV --'],
    [901, 576, 0.053, 'NAV --'],
    [981, 482, 0.045, 'FUEL --'],
    [1046, 482, 0.045, 'FUEL --'],
    [981, 535, 0.043, 'OIL --'],
    [1046, 535, 0.043, 'OIL --'],
    [993, 585, 0.042, 'TEMP --'],
    [1057, 585, 0.042, 'TEMP --'],
    [996, 636, 0.041, 'TEMP --'],
    [1057, 636, 0.041, 'TEMP --'],
    [997, 687, 0.04, 'TEMP --'],
    [1057, 687, 0.04, 'TEMP --'],
    [448, 650, 0.055, 'NAV --'],
    [1437, 559, 0.037, 'VAC --'],
  ]) {
    pt.gauge(x(u), y(v), z - 0.018, r, undefined, false);
    d.text(label, at(u, v, -0.033), 0.0078, Math.PI, ink);
  }
  for (const u of [947, 1085])
    for (const v of [506, 543, 629]) {
      ellipsoid(d, at(u, v, -0.026), [0.009, 0.009, 0.005], m.orange, 8);
      d.text('PRESS --', at(u, v + 13, -0.02), 0.006, Math.PI, ink);
    }
  for (const [u, v] of [
    [395, 511],
    [772, 441],
    [1107, 443],
    [1497, 507],
    [399, 804],
    [749, 804],
    [1124, 784],
    [1486, 785],
  ])
    d.add(new T.SphereGeometry(0.005, 6, 4), m.metal, at(u, v, -0.013));
  ins.dial(
    'flaps',
    at(647, 829, -0.02),
    0.032,
    'flapPosition',
    [
      [0, -1.2],
      [1, 1.2],
    ],
    [0, 0.5, 1],
    'FLAP',
  );
  // Central magnetic-compass housing; engine supplies no magnetic variation, so label true.
  beveledBox(d, [0.21, 0.26, 0.16], [0, 4.45, 8.17], m.dark, 0.025);
  ins.headingDrum('compass', [0, 4.46, 8.078], 0.068, 'trueHeading');
  d.text('TRUE', [0, 4.35, 8.07], 0.016, Math.PI, ink);
  const q = group(cabin, 'DC3-quadrant', [0, 2.91, 7.65]),
    qd = detailKit(q, q.name);
  beveledBox(qd, [0.43, 0.48, 0.66], [0, 0, 0], m.dark, 0.025);
  for (const [i, xx, label, color, signal] of [
    [0, 0.175, 'P', liner, null],
    [1, 0.115, 'P', liner, null],
    [2, 0.037, 'T', m.metal, 'power'],
    [3, -0.037, 'T', m.metal, 'power'],
    [4, -0.115, 'M', blue, null],
    [5, -0.175, 'M', blue, null],
  ]) {
    qd.box([0.018, 0.012, 0.49], [xx, 0.247, 0], black);
    const g = group(q, `DC3-lever-${i}`, [xx, 0.24, 0.12]),
      ld = detailKit(g, g.name);
    ld.rod([0, 0, 0], [0, 0.28, -0.11], 0.01, m.metal);
    ellipsoid(ld, [0, 0.3, -0.12], [0.028, 0.027, 0.026], color, 12);
    ld.text(label, [0, 0.3, -0.15], 0.015, Math.PI, ink);
    ld.finish();
    if (signal)
      bindings.push({ node: g.name, source: signal, property: 'rotation', axis: 'x', scale: 0.7 });
  }
  // White elevator trim wheel on the left; no simulated trim signal is invented.
  qd.add(new T.TorusGeometry(0.2, 0.017, 6, 32).rotateY(Math.PI / 2), liner, [0.26, 0.03, -0.07]);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2)
    qd.rod(
      [0.26, 0.03, -0.07],
      [0.26, 0.03 + Math.sin(a) * 0.19, -0.07 + Math.cos(a) * 0.19],
      0.009,
      liner,
    );
  qd.text('PARKING BRAKE', [0, -0.29, -0.345], 0.018, Math.PI, ink);
  qd.rod([0, -0.32, -0.35], [0, -0.42, -0.38], 0.016, m.metal);
  qd.finish();
  for (const side of [-1, 1]) {
    const pitch = group(cabin, `DC3-column-${side}`, [side * 0.56, 2.28, 7.3]),
      pd = detailKit(pitch, pitch.name);
    pd.rod([0, 0, 0], [0, 0.93, -0.09], 0.038, m.dark);
    pd.finish();
    const roll = group(pitch, `DC3-wheel-${side}`, [0, 0.93, -0.09]),
      wd = detailKit(roll, roll.name),
      points = Array.from({ length: 35 }, (_, i) => {
        const a = ((140 + (i * 260) / 34) * Math.PI) / 180;
        return [0.29 * Math.cos(a), 0.29 * Math.sin(a), 0];
      });
    outline(wd, points, 0.019, m.dark, false);
    for (const a of [35, 145, 270])
      wd.rod(
        [0, 0, 0],
        [0.28 * Math.cos((a * Math.PI) / 180), 0.28 * Math.sin((a * Math.PI) / 180), 0],
        0.013,
        m.metal,
      );
    ellipsoid(wd, [0, 0, 0], [0.05, 0.05, 0.03], m.metal, 16);
    wd.finish();
    bindings.push(
      { node: pitch.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: 0.16 },
      { node: roll.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: -0.75 },
    );
    for (const sign of [-1, 1]) {
      const g = group(cabin, `DC3-pedal-${side}-${sign}`, [side * 0.56 + sign * 0.16, 2.35, 7.98]),
        dd = detailKit(g, g.name);
      dd.box([0.23, 0.18, 0.1], [0, 0, 0], m.dark);
      for (let i = 0; i < 6; i++)
        dd.rod([-0.1, -0.07 + i * 0.028, -0.055], [0.1, -0.07 + i * 0.028, -0.055], 0.004, m.metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: sign * 0.05,
      });
    }
    beveledBox(d, [0.57, 0.15, 0.62], [side * 0.58, 2.65, 6.95], cloth, 0.055);
    beveledBox(d, [0.57, 0.75, 0.16], [side * 0.58, 3.05, 6.68], cloth, 0.06);
    for (const xx of [-0.22, 0.22])
      d.rod([side * 0.58 + xx, 2.18, 6.97], [side * 0.58 + xx, 2.55, 6.97], 0.022, m.metal);
    d.rod([side * 0.58 - 0.23, 2.75, 6.87], [side * 0.58 + 0.23, 2.75, 7.12], 0.018, liner);
    d.box([0.055, 0.019, 0.04], [side * 0.58, 2.76, 7], m.metal);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 9; col++) {
        const zz = 6.35 + col * 0.18,
          yy = 2.5 + row * 0.19;
        d.rod([side * 1.12, yy, zz], [side * 1.12, yy + 0.18, zz + 0.18], 0.0025, cloth);
        d.rod([side * 1.12, yy + 0.18, zz], [side * 1.12, yy, zz + 0.18], 0.0025, cloth);
      }
  }
  for (const side of [-1, 1])
    sheet(
      d,
      [
        [side * 1.07, 2.4, 6.15],
        [side * 1.09, 3.5, 6.15],
        [side * 1.09, 3.55, 6.8],
        [side * 0.91, 3.4, 7.65],
        [side * 0.82, 2.55, 7.65],
      ],
      green,
      [-side, 0, 0],
    );
  // Original overhead: paired ignition selectors in the middle, electrical switches at the sides.
  const oh = group(cabin, 'DC3-overhead', [0, 4.32, 7.63]);
  oh.rotation.x = 0.5;
  const od = detailKit(oh, oh.name);
  sheet(
    od,
    [
      [-0.84, 0.16, 0],
      [0.84, 0.16, 0],
      [0.9, -0.14, 0],
      [0.24, -0.16, 0],
      [0.2, -0.1, 0],
      [-0.2, -0.1, 0],
      [-0.24, -0.16, 0],
      [-0.9, -0.14, 0],
    ],
    m.dark,
    [0, 0, -1],
  );
  for (const side of [-1, 1]) {
    od.add(new T.CylinderGeometry(0.053, 0.053, 0.025, 20).rotateX(Math.PI / 2), m.metal, [
      side * 0.16,
      0.03,
      -0.025,
    ]);
    od.rod([side * 0.16, 0.03, -0.045], [side * 0.16 + 0.03, 0.06, -0.045], 0.01, m.dark);
    od.text('IGNITION', [side * 0.16, 0.11, -0.012], 0.012, Math.PI, ink);
    for (let i = 0; i < 7; i++)
      for (let row = 0; row < 2; row++) {
        const xx = side * (0.3 + i * 0.078),
          yy = 0.06 - row * 0.12;
        od.rod([xx, yy, -0.02], [xx, yy + 0.02, -0.065], 0.004, m.metal);
        if (row === 0)
          od.text(
            ['BAT', 'GEN', 'LTS', 'START', 'PUMP', 'HEAT', 'ICE'][i],
            [xx, yy + 0.035, -0.016],
            0.007,
            Math.PI,
            ink,
          );
      }
  }
  od.finish();
  // Cockpit floor follows the nose taper. Twenty-one seats follow the manual's 2+1 plan.
  for (const [a, b] of [
    [
      [8.48, 0.61, 2.44],
      [7.7, 0.85, 2.27],
    ],
    [
      [7.7, 0.85, 2.27],
      [6.1, 1, 2.19],
    ],
  ])
    sheet(
      d,
      [
        [-a[1], a[2], a[0]],
        [a[1], a[2], a[0]],
        [b[1], b[2], b[0]],
        [-b[1], b[2], b[0]],
      ],
      m.dark,
      [0, 1, 0],
    );
  const floors = [
    [6.1, 1, 2.19],
    [-0.8, 1, 2.19],
    [-2.1, 0.92, 2.34],
    [-3.8, 0.68, 2.72],
  ];
  for (let i = 0; i < floors.length - 1; i++) {
    const a = floors[i],
      b = floors[i + 1];
    sheet(
      d,
      [
        [-a[1], a[2], a[0]],
        [a[1], a[2], a[0]],
        [b[1], b[2], b[0]],
        [-b[1], b[2], b[0]],
      ],
      m.dark,
      [0, 1, 0],
    );
  }
  for (let row = 0; row < 7; row++)
    for (const xx of [0.78, 0.23, -0.78]) {
      const zz = 4.7 - row * 0.99;
      beveledBox(d, [0.47, 0.13, 0.55], [xx, 2.55, zz], cloth, 0.04);
      beveledBox(d, [0.47, 0.78, 0.15], [xx, 2.94, zz - 0.24], cloth, 0.045);
      for (const dx of [-0.235, 0.235]) {
        d.box([0.045, 0.055, 0.42], [xx + dx, 2.84, zz], m.dark);
        d.rod([xx + dx, 2.2, zz], [xx + dx, 2.48, zz], 0.018, m.metal);
      }
      d.box([0.29, 0.18, 0.02], [xx, 3.2, zz - 0.325], liner);
      d.rod([xx - 0.2, 2.63, zz - 0.13], [xx + 0.2, 2.63, zz + 0.14], 0.012, m.dark);
    }
  for (const side of [-1, 1]) {
    d.box([0.24, 0.025, 6.95], [side * 0.97, 4.03, 1.71], liner);
    for (let j = 0; j < 7; j++) {
      d.box([0.12, 0.02, 0.07], [side * 0.99, 3.99, 4.7 - j * 0.99], m.metal);
    }
  }
  sheet(
    d,
    [
      [-1.04, 2.19, 5.55],
      [-0.34, 2.19, 5.55],
      [-0.34, 4.12, 5.55],
      [0.34, 4.12, 5.55],
      [0.34, 2.19, 5.55],
      [1.04, 2.19, 5.55],
      [1.04, 4.38, 5.55],
      [-1.04, 4.38, 5.55],
    ],
    liner,
    [0, 0, -1],
  );
  sheet(
    d,
    [
      [-0.68, 2.72, -3.8],
      [0.68, 2.72, -3.8],
      [0.86, 3.92, -3.8],
      [-0.86, 3.92, -3.8],
    ],
    liner,
    [0, 0, 1],
  );
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
