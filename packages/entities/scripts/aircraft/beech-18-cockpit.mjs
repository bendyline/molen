/** N522B panel and controls, Smithsonian NASM2016-03584 (Dane Penland, CC0).
 * Panel width checked against Beech Detail Specification 131: 45.75 inches.
 * Photograph is a perspective reference, not a surveyed orthographic drawing. */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { cockpitBulkhead, cockpitLiner, skinSection, wallAt } from './cockpit-fit.mjs';
import {
  bar,
  lathe,
  partPalette,
  place,
  roundedBox,
  switchGeometry,
  tube,
} from './cockpit-parts.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import { beveledBox, detailKit, group, mat, outline, sheet, T } from './mesh-kit.mjs';

/** The Beech "butterfly" control wheel (C-45H and D18S photos): one frame loops out from the
 * hub into two rounded lobes, the outer uprights are the hand grips, and a clock sits in the hub.
 * Hub at the origin, facing the pilot (-Z). */
function butterflyWheel(wd, P, frame, face) {
  const shape = [
    [0, 0.042],
    [0.085, 0.066],
    [0.18, 0.112],
    [0.222, 0.098],
    [0.236, 0],
    [0.222, -0.098],
    [0.18, -0.112],
    [0.085, -0.066],
    [0, -0.042],
  ];
  const loop = [
    ...shape,
    ...shape
      .slice(1, -1)
      .reverse()
      .map(([x, y]) => [-x, y]),
  ];
  const curve = new T.CatmullRomCurve3(
    loop.map(([x, y]) => new T.Vector3(x, y, 0)),
    true,
    'centripetal',
  );
  const points = curve
    .getSpacedPoints(36)
    .slice(0, 36)
    .map((p) => p.toArray());
  wd.add(tube(points, 0.0115, 10, true), frame);
  // Thicker hand grips on the outer uprights.
  for (const s of [-1, 1])
    wd.add(
      tube(
        [
          [s * 0.229, -0.074, 0],
          [s * 0.2375, -0.03, 0],
          [s * 0.2375, 0.03, 0],
          [s * 0.229, 0.074, 0],
        ],
        0.0165,
        12,
      ),
      P.grip,
    );
  // Hub boss with the wheel clock (lathe +Y turned to face the pilot).
  wd.add(
    lathe(
      [
        [0, -0.03],
        [0.03, -0.03],
        [0.05, -0.012],
        [0.052, 0.008],
        [0.046, 0.018],
        [0, 0.018],
      ],
      16,
    ).rotateX(-Math.PI / 2),
    frame,
  );
  wd.add(
    new T.CylinderGeometry(0.034, 0.034, 0.003, 16, 1, true)
      .rotateX(Math.PI / 2)
      .translate(0, 0, -0.019),
    P.alloy,
  );
  wd.add(new T.CircleGeometry(0.032, 16).rotateY(Math.PI).translate(0, 0, -0.0205), face);
}

/** Beech rudder pedal: a rubber-faced plate leaning forward on a cast arm hinged at the floor,
 * with the toe-brake cylinder outboard. Origin at the middle of the pad. */
function beechPedal(pd, P, out) {
  const lean = [0.32, 0, 0];
  pd.add(place(roundedBox([0.104, 0.148, 0.012], 0.01, 1), [0, 0, 0], lean), P.steel);
  pd.add(place(roundedBox([0.088, 0.128, 0.005], 0.008, 1), [0, 0, -0.0075], lean), P.grip);
  // Moulded tread ribs in the same rubber, low enough to read as a pad, not a grille.
  for (let j = 0; j < 3; j++)
    pd.add(
      place(new T.BoxGeometry(0.074, 0.008, 0.004), [0, -0.034 + j * 0.034, -0.0105], lean),
      P.grip,
    );
  pd.add(
    place(bar([-0.05, 0.068, 0.006], [0.05, 0.068, 0.006], 0.0055, 10), [0, 0, 0], lean),
    P.alloy,
  );
  // Arm from the back of the pad down to its floor hinge.
  pd.add(
    tube(
      [
        [0, -0.03, 0.03],
        [0, -0.09, 0.06],
        [0, -0.13, 0.085],
      ],
      0.0095,
      10,
    ),
    P.alloy,
  );
  pd.add(
    new T.CylinderGeometry(0.014, 0.014, 0.05, 12).rotateZ(Math.PI / 2).translate(0, -0.135, 0.088),
    P.steel,
  );
  pd.add(bar([out * 0.038, 0.05, 0.035], [out * 0.038, -0.1, 0.11], 0.0075, 10, 0.0085), P.steel);
}

/** Sidewall lining between window panes, like cockpitLiner but triangle by triangle: a cell
 * with three of its four corners on skin still gets the triangle between them, so the lining
 * reaches the window frames instead of stopping a whole sample short of them. */
function paneLiner(
  d,
  body,
  { zFrom, zTo, yFrom, yTo, zSteps, ySteps, inset = 0.006, from = 0.05, material },
) {
  const grid = [];
  for (let i = 0; i <= zSteps; i++) {
    const z = zFrom + ((zTo - zFrom) * i) / zSteps,
      segments = skinSection(body, z);
    grid.push(
      Array.from({ length: ySteps + 1 }, (_, j) => {
        const y = yFrom + ((yTo - yFrom) * j) / ySteps;
        return {
          z,
          y,
          x: { 1: wallAt(segments, y, 1, from), [-1]: wallAt(segments, y, -1, from) },
        };
      }),
    );
  }
  const positions = [],
    u = new T.Vector3(),
    v = new T.Vector3();
  for (const side of [1, -1]) {
    const at = (p) => (p.x[side] === undefined ? undefined : [p.x[side] - side * inset, p.y, p.z]);
    const tri = (...corners) => {
      if (corners.some((c) => !c)) return false;
      const [a, b, c] = corners;
      u.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      v.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      // Face inboard.
      positions.push(...a, ...(u.cross(v).x * -side >= 0 ? [...b, ...c] : [...c, ...b]));
      return true;
    };
    for (let i = 0; i < zSteps; i++)
      for (let j = 0; j < ySteps; j++) {
        const [p, q, r, w] = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]].map(
          at,
        );
        if (p && q && r && w) {
          tri(p, q, r);
          tri(p, r, w);
        } else tri(p, q, r) || tri(p, r, w) || tri(p, q, w) || tri(q, r, w);
      }
  }
  if (!positions.length) return;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  d.add(geometry, material);
}

/** Convert stations authored in the cockpit group's frame into the model frame that
 * completeCockpitControls expects (the airframe sits pitched on its tail wheel). */
export function cockpitFrameStations(root, cabin, stations) {
  root.updateMatrixWorld(true);
  const frame = root.matrixWorld.clone().invert().multiply(cabin.matrixWorld),
    turn = new T.Quaternion();
  frame.decompose(new T.Vector3(), turn, new T.Vector3());
  return stations.map((station) => {
    const local = new T.Quaternion().setFromEuler(new T.Euler(...(station.rotation ?? [0, 0, 0])));
    const e = new T.Euler().setFromQuaternion(turn.clone().multiply(local), 'XYZ');
    return {
      ...station,
      at: new T.Vector3(...station.at).applyMatrix4(frame).toArray(),
      rotation: [e.x, e.y, e.z],
    };
  });
}

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
    yellow = mat('Beech18-prop-control', '#ce991e'),
    P = partPalette();
  const k = 1.16205 / 725,
    x = (u) => (1018 - u) * k,
    y = (v) => 1.79 + (450 - v) * k,
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
  d.box([1.14, 0.027, 0.23], [0, 1.79, 3.11], m.dark);
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
    // Positive turning right, so the needle leans into the turn (yawRate is positive left).
    turnDegrees: { op: 'multiply', args: ['yawRate', -180 / Math.PI] },
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
  // Starter switches on the panel's lower edge, right of centre and under the engine
  // temperature gauges, with the guarded ignition master beside them (a control station). The
  // landing gear lever is on the quadrant's left face, as in the C-45H photo.
  for (const [u, name, label, engine] of [
    [1068, 'Beech18-starter-1', 'START L', 'engine-1'],
    [1110, 'Beech18-starter-2', 'START R', 'engine-2'],
  ]) {
    d.box([0.03, 0.026, 0.004], at(u, 683, -0.003), black);
    d.text(label, at(u, 667, -0.006), 0.0055, Math.PI, ink);
    const g = group(cabin, name, at(u, 683, -0.005)),
      gd = detailKit(g, name);
    switchGeometry(gd, { style: 'toggle', scale: 1.15 });
    gd.finish();
    // Up for on, as the shared toggle stations move.
    g.userData.aircraftControl = {
      action: 'engine',
      engine,
      motion: { property: 'rotation', axis: 'x', scale: 0.7, offset: -0.7 },
    };
  }
  d.box([0.03, 0.026, 0.004], at(1152, 683, -0.003), black);
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
        // One legend per column, over the top row (both rows repeated it).
        if (row === 1)
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
  // Throttle quadrant hanging under the panel centre (C-45H/D18S photos): propeller levers with
  // ball knobs, throttles with tall turned wooden knobs, mixtures with flat paddles.
  const q = group(cabin, 'Beech18-quadrant', [0, 1.08, 2.78]),
    qd = detailKit(q, q.name);
  beveledBox(qd, [0.3, 0.39, 0.45], [0, 0, -0.08], green, 0.03);
  const throttleKnob = lathe(
    [
      [0, 0],
      [0.009, 0],
      [0.013, 0.008],
      [0.0165, 0.022],
      [0.0175, 0.036],
      [0.014, 0.046],
      [0.006, 0.05],
      [0, 0.0505],
    ],
    16,
  );
  for (const [i, xx, label, source] of [
    [0, 0.13, 'P', null],
    [1, 0.08, 'P', null],
    [2, 0.027, 'T', 'power'],
    [3, -0.027, 'T', 'power'],
    [4, -0.08, 'M', null],
    [5, -0.13, 'M', null],
  ]) {
    // Lever slot in the quadrant top.
    qd.box([0.009, 0.003, 0.32], [xx, 0.1955, -0.09], black);
    const lever = group(q, `Beech18-lever-${i}`, [xx, 0.19, 0.01]),
      ld = detailKit(lever, lever.name),
      top = [0, 0.24, -0.03],
      tilt = Math.atan2(-0.03, 0.24);
    // Flat lever blade from the slot to the knob.
    ld.add(
      place(roundedBox([0.007, 0.245, 0.013], 0.002, 1), [0, 0.12, -0.015], [tilt, 0, 0]),
      P.alloy,
    );
    if (label === 'P') {
      ld.add(new T.SphereGeometry(0.0175, 14, 9), yellow, [0, 0.257, -0.032]);
      ld.text(label, [0, 0.257, -0.05], 0.0105, Math.PI, ink);
    } else if (label === 'T') {
      ld.add(place(throttleKnob.clone(), top, [tilt, 0, 0]), wood);
      ld.text(label, [0, 0.262, -0.049], 0.0105, Math.PI, ink);
    } else {
      ld.add(
        place(roundedBox([0.032, 0.024, 0.012], 0.005), [0, 0.254, -0.032], [tilt, 0, 0]),
        brown,
      );
      ld.text(label, [0, 0.254, -0.0385], 0.0105, Math.PI, ink);
    }
    ld.finish();
    if (source)
      bindings.push({ node: lever.name, source, property: 'rotation', axis: 'x', scale: 0.7 });
  }
  throttleKnob.dispose();
  // Elevator trim knob on the quadrant's aft face, its crank handle on the rim.
  qd.add(
    lathe(
      [
        [0, 0],
        [0.05, 0],
        [0.052, 0.01],
        [0.046, 0.022],
        [0.03, 0.03],
        [0, 0.032],
      ],
      20,
    ).rotateX(-Math.PI / 2),
    black,
    [0, -0.04, -0.305],
  );
  qd.add(bar([0.032, -0.072, -0.33], [0.032, -0.072, -0.36], 0.006, 12), m.metal);
  qd.text('TRIM', [0, 0.024, -0.307], 0.009, Math.PI, ink);
  // Fuel selector valves on the floor at the quadrant's foot.
  for (const side of [-1, 1]) {
    pt.gauge(side * 0.11, 0.74, 2.5, 0.043, undefined, false);
    d.text('FUEL --', [side * 0.11, 0.74, 2.48], 0.008, Math.PI, ink);
    qd.add(bar([side * 0.11, -0.11, -0.31], [side * 0.1, -0.17, -0.34], 0.009, 12), brown);
    qd.add(bar([side * 0.14, -0.24, -0.29], [side * 0.14, -0.3, -0.31], 0.009, 12), m.metal);
  }
  // Landing gear lever in its slot on the quadrant's left face ("UP - WHEELS - DOWN"), the
  // white grip pointing aft; it drops for gear down.
  qd.box([0.004, 0.13, 0.016], [0.151, 0.02, -0.22], black);
  qd.text('UP', [0.153, 0.085, -0.22], 0.009, Math.PI / 2, ink);
  qd.text('DOWN', [0.153, -0.06, -0.22], 0.009, Math.PI / 2, ink);
  const gear = group(q, 'Beech18-gear-switch', [0.158, 0.02, -0.22]),
    gd = detailKit(gear, gear.name);
  gd.add(
    new T.CylinderGeometry(0.012, 0.012, 0.012, 16).rotateZ(Math.PI / 2).translate(0.002, 0, 0),
    m.metal,
  );
  gd.add(
    tube(
      [
        [0.006, 0, 0],
        [0.022, 0, -0.02],
        [0.026, 0, -0.07],
      ],
      0.0055,
      12,
    ),
    m.metal,
  );
  gd.add(
    lathe(
      [
        [0, 0],
        [0.009, 0],
        [0.012, 0.012],
        [0.012, 0.04],
        [0.009, 0.05],
        [0, 0.052],
      ],
      16,
    )
      .rotateX(-Math.PI / 2)
      .translate(0.026, 0, -0.068),
    P.white,
  );
  gd.finish();
  gear.userData.aircraftControl = {
    action: 'gear',
    motion: { property: 'rotation', axis: 'x', scale: -0.6, offset: 0.3 },
  };
  // Flap switch lever at the quadrant's lower right, over its FLAP placard.
  qd.box([0.05, 0.022, 0.003], [-0.09, -0.165, -0.307], liner);
  qd.text('FLAP', [-0.09, -0.165, -0.309], 0.009, Math.PI, ink);
  qd.box([0.016, 0.05, 0.004], [-0.09, -0.11, -0.307], black);
  const flap = group(q, 'Beech18-flap-lever', [-0.09, -0.11, -0.31]),
    fd = detailKit(flap, flap.name);
  fd.add(new T.CylinderGeometry(0.008, 0.008, 0.008, 16).rotateX(Math.PI / 2), m.metal);
  fd.add(bar([0, 0, -0.003], [0, 0, -0.045], 0.0035, 12, 0.003), m.metal);
  fd.add(place(roundedBox([0.03, 0.009, 0.018], 0.003), [0, 0, -0.05]), black);
  fd.finish();
  flap.userData.aircraftControl = {
    action: 'flaps',
    motion: { property: 'rotation', axis: 'x', scale: -0.5, offset: 0.25 },
  };
  qd.finish();
  // Paired butterfly wheels on push-pull shafts out of the panel; pitch shaft and wheel roll
  // are separate. The shaft slides in a sleeve that runs into the panel.
  for (const side of [-1, 1]) {
    const pitch = group(cabin, `Beech18-column-${side}`, [side * 0.36, 1.62, 2.66]),
      roll = group(pitch, `Beech18-wheel-${side}`),
      wd = detailKit(roll, roll.name),
      shaft = detailKit(pitch, `${pitch.name}-shaft`);
    d.add(bar([side * 0.36, 1.62, 2.74], [side * 0.36, 1.62, 3], 0.025, 16), black);
    d.add(
      lathe(
        [
          [0.026, 0],
          [0.045, 0],
          [0.045, 0.006],
          [0.03, 0.014],
          [0.026, 0.014],
        ],
        20,
      ).rotateX(-Math.PI / 2),
      m.metal,
      [side * 0.36, 1.62, 2.996],
    );
    shaft.add(bar([0, 0, 0.02], [0, 0, 0.36], 0.0165, 16), m.metal);
    shaft.finish();
    butterflyWheel(wd, P, black, liner);
    wd.finish();
    bindings.push(
      { node: pitch.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.08 },
      // Right bank turns the wheel clockwise from the seat.
      { node: roll.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.7 },
    );
    for (const sign of [-1, 1]) {
      const ped = group(cabin, `Beech18-pedal-${side}-${sign}`, [
          side * 0.36 + sign * 0.105,
          0.845,
          3.04,
        ]),
        pd = detailKit(ped, ped.name);
      beechPedal(pd, P, sign);
      pd.finish();
      bindings.push({
        node: ped.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        // Right rudder pushes the right pedal (-X) forward.
        scale: -sign * 0.035,
      });
    }
    d.box([0.033, 0.6, 1.3], [side * 0.65, 1.32, 1.85], green);
    d.rod([side * 0.63, 1.51, 2.5], [side * 0.63, 1.51, 2.11], 0.016, m.dark);
    // Small panel corner fans, with static blades and wire cage.
    const fg = group(cabin, `Beech18-fan-${side}`, [side * 0.54, 1.7, 2.96]),
      fd = detailKit(fg, fg.name);
    fd.rod([0, -0.15, 0.02], [0, 0, 0], 0.012, m.metal);
    fd.ring(0.065, 0.002, [0, 0, -0.015], m.metal);
    for (let j = 0; j < 3; j++) {
      const a = (j * 2 * Math.PI) / 3;
      fd.add(new T.SphereGeometry(1, 8, 4).scale(0.03, 0.019, 0.004).rotateZ(a), m.dark, [
        Math.cos(a) * 0.035,
        Math.sin(a) * 0.035,
        0,
      ]);
    }
    fd.finish();
  }
  // Green upholstered seats, belts and six passenger places behind the pilots.
  // The rear cabin narrows and its floor rises; a rectangular floor would escape the shell.
  const floors = [
    // Out to the sidewall liners (trimmed to the skin), so no skin shows beside the pedals.
    [3.2, 0.7, 0.71],
    [2.4, 0.7, 0.71],
    [0.6, 0.64, 0.74],
    [-0.8, 0.55, 0.91],
    [-1.6, 0.45, 1.07],
  ];
  // Sampled strips trimmed to the skin at their height: the straight-edged panels poked out of
  // the curved lower sides beside the nose wheel-well bulkhead.
  const wall = (zz, yy) => (m.skin ? m.skin(zz, yy) : 9),
    floorAt = (zz) => {
      const i = Math.max(0, Math.min(floors.length - 2, floors.findIndex((f) => f[0] < zz) - 1)),
        [za, wa, ya] = floors[i],
        [zb, wb, yb] = floors[i + 1],
        f = Math.max(0, Math.min(1, (za - zz) / (za - zb))),
        yy = ya + (yb - ya) * f;
      return [Math.min(wa + (wb - wa) * f, wall(zz, yy) - 0.02, wall(zz, yy + 0.02) - 0.02), yy];
    };
  for (let zz = floors[0][0]; zz > floors.at(-1)[0] + 1e-6; zz -= 0.2) {
    const z1 = Math.max(floors.at(-1)[0], zz - 0.2),
      [wa, ya] = floorAt(zz),
      [wb, yb] = floorAt(z1);
    if (wa > 0.05 && wb > 0.05)
      sheet(
        d,
        [
          [-wa, ya, zz],
          [wa, ya, zz],
          [wb, yb, z1],
          [-wb, yb, z1],
        ],
        m.dark,
        [0, 1, 0],
      );
  }
  for (const zz of [2.18, 1.05, -0.05, -1.15])
    for (const side of [-1, 1]) {
      // Pilot seats stand tall on their pedestals, so the eye clears the panel and the long nose.
      const xx = side * (zz < 0 ? 0.28 : 0.34),
        lift = zz > 2 ? 0.305 : Math.max(0, (1.0 - (zz + 0.55)) * 0.14),
        foot = zz > 2 ? 0 : lift;
      beveledBox(d, [0.43, 0.11, 0.45], [xx, 0.96 + lift, zz], green, 0.04);
      beveledBox(d, [0.43, 0.65, 0.13], [xx, 1.29 + lift, zz - 0.21], green, 0.04);
      for (const sx of [-1, 1])
        d.rod([xx + sx * 0.18, 0.73 + foot, zz], [xx + sx * 0.18, 0.92 + lift, zz], 0.017, m.metal);
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
  // The ADF control box hangs flat under the roof at the windscreen header (Alberta D18S): at
  // eye height it filled the view to the right.
  const overhead = group(cabin, 'Beech18-overhead-radio', [0, 2.15, 2.6]),
    od = detailKit(overhead, overhead.name);
  beveledBox(od, [0.27, 0.06, 0.16], [0, 0, 0], m.dark, 0.012);
  od.text('ADF  --', [0, 0.015, -0.082], 0.009, Math.PI, ink);
  for (let i = 0; i < 4; i++)
    od.add(new T.CylinderGeometry(0.01, 0.01, 0.014, 16).rotateX(Math.PI / 2), black, [
      -0.096 + i * 0.064,
      -0.01,
      -0.086,
    ]);
  od.finish();
  ins.headingDrum('compass', [0, 1.93, 2.78], 0.038, 'trueHeading');
  for (const zz of [1.1, 0, -1.1]) d.box([0.16, 0.016, 0.06], [0, 2.11, zz], liner);
  d.finish();
  // Controls without a modeled part, placed where the D18S has them (cockpit frame; the builder
  // converts them with cockpitFrameStations once the cabin is posed).
  const stations = [
    // Guarded ignition master beside the starter switches on the panel's lower edge.
    {
      action: 'engine',
      style: 'guarded',
      at: at(1152, 683, -0.006),
      label: 'MASTER',
      labelAt: [0, 0.026, -0.0015],
      labelHeight: 0.0055,
    },
    // Parking brake pull handle low on the quadrant's left face, under the gear lever.
    {
      action: 'brake',
      style: 'tee',
      at: [0.152, 1.08 - 0.115, 2.78 - 0.22],
      rotation: [0, -Math.PI / 2, 0],
      label: 'PARK BRK',
      labelAt: [0, 0.026, -0.0015],
      labelHeight: 0.0075,
    },
  ];
  /** Close the nose behind the panel and line the sidewalls to the sill, in the airframe
   * (`body`) frame, once the cockpit group is posed in it. */
  const fit = (body) => {
    const holder = group(cabin, 'Beech18-cockpit-fit', cabin.position.clone().negate().toArray()),
      fd = detailKit(holder, holder.name);
    // Just ahead of the panel's back sheet, floor to the windscreen frame: no ivory skin beside
    // or under the panel. The liners run from the seats to it, under the side-window sill.
    cockpitBulkhead(fd, body, { z: 3.69, yFrom: 1.25, yTo: 2.3, material: green });
    cockpitLiner(fd, body, {
      zFrom: 1.75,
      zTo: 3.69,
      yFrom: 1.25,
      yTo: 2.16,
      zSteps: 10,
      ySteps: 6,
      from: 0.5,
      inset: 0.006,
      material: green,
    });
    // The window posts and the strips between the panes: finely sampled, so only skin between
    // the glass is lined (cells crossing a pane are left open).
    paneLiner(fd, body, {
      zFrom: 1.75,
      zTo: 3.69,
      yFrom: 2.13,
      yTo: 2.8,
      zSteps: 64,
      ySteps: 12,
      from: 0.5,
      material: green,
    });
    // The wing root runs through the cabin at knee height (root cap at x 0.4): its leading edge
    // showed ivory in the outer footwells ahead of the seats. Box it in as a kick panel whose top
    // falls with the wing's upper surface toward the leading edge, clear of the pedals' sightline.
    const [z0, z1, y0, ya, yb] = [2.95, 3.36, 1.26, 1.79, 1.66],
      aft = skinSection(body, z0),
      ahead = skinSection(body, z1),
      edge = (z, y, side) => wallAt(z === z0 ? aft : ahead, y, side, 0.5) - side * 0.006;
    for (const side of [1, -1]) {
      const x0 = side * 0.395;
      sheet(
        fd,
        [
          [x0, y0, z0],
          [x0, y0, z1],
          [x0, yb, z1],
          [x0, ya, z0],
        ],
        green,
        [-side, 0, 0],
      );
      sheet(
        fd,
        [
          [x0, ya, z0],
          [x0, yb, z1],
          [edge(z1, yb, side), yb, z1],
          [edge(z0, ya, side), ya, z0],
        ],
        green,
        [0, 1, 0.3],
      );
      sheet(
        fd,
        [[x0, y0, z0], [x0, ya, z0], ...[ya, 1.55, 1.4, y0].map((y) => [edge(z0, y, side), y, z0])],
        green,
        [0, 0, -1],
      );
    }
    fd.finish();
  };
  return { nodes: ['cockpit'], sources, derived, bindings, stations, fit };
}
