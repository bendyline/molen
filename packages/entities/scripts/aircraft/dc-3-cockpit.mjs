/** Wright-powered DC-3, Knoxville museum panel; Carol M. Highsmith, LOC 2015630848.
 * The panel photograph supplies layout, not surveyed cockpit dimensions. */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { cockpitBulkhead, cockpitLiner, skinSection, wallAt } from './cockpit-fit.mjs';
import { bar, lathe, partPalette, place, roundedBox, tube } from './cockpit-parts.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import { beveledBox, detailKit, group, mat, outline, quad, sheet, T } from './mesh-kit.mjs';

/** The Douglas control wheel (C-47A Le Bourget photo): a rim open across the top, three spokes
 * from a domed hub, the rim's ends rounded off as grips. Hub at the origin, facing -Z. */
function douglasWheel(wd, P, rim, hub) {
  const r = 0.28,
    points = Array.from({ length: 29 }, (_, i) => {
      const a = ((140 + (i * 260) / 28) * Math.PI) / 180;
      return [r * Math.cos(a), r * Math.sin(a), 0];
    });
  wd.add(tube(points, 0.0145, 10), rim);
  // Rounded rim ends and the thicker hand grips at the upper corners of the open rim.
  for (const s of [-1, 1]) {
    const a = s > 0 ? (40 * Math.PI) / 180 : (140 * Math.PI) / 180;
    wd.add(new T.SphereGeometry(0.0165, 10, 6), rim, [r * Math.cos(a), r * Math.sin(a), 0]);
    const grip = Array.from({ length: 5 }, (_, i) => {
      const b = a + (s * ((-8 - i * 9) * Math.PI)) / 180;
      return [r * Math.cos(b), r * Math.sin(b), 0];
    });
    wd.add(tube(grip, 0.0175, 12), P.grip);
  }
  for (const a of [35, 145, 270])
    wd.add(
      bar(
        [0.04 * Math.cos((a * Math.PI) / 180), 0.04 * Math.sin((a * Math.PI) / 180), 0],
        [(r - 0.01) * Math.cos((a * Math.PI) / 180), (r - 0.01) * Math.sin((a * Math.PI) / 180), 0],
        0.0105,
        12,
        0.0075,
      ),
      hub,
    );
  wd.add(
    lathe(
      [
        [0, -0.04],
        [0.03, -0.04],
        [0.05, -0.02],
        [0.052, 0.0],
        [0.042, 0.016],
        [0.022, 0.024],
        [0, 0.026],
      ],
      18,
    ).rotateX(-Math.PI / 2),
    hub,
  );
  wd.add(
    new T.CylinderGeometry(0.016, 0.016, 0.004, 16).rotateX(Math.PI / 2).translate(0, 0, -0.026),
    P.black,
  );
}

/** Douglas rudder pedal: a broad cast plate with a raised rim and a rubber tread, the toe-brake
 * hinge across its top, on an arm down to the floor pivot. Origin at the middle of the pad. */
function douglasPedal(pd, P, out) {
  const lean = [0.25, 0, 0];
  pd.add(place(roundedBox([0.16, 0.13, 0.014], 0.03, 1), [0, 0, 0], lean), P.steel);
  // Oval rubber tread on the cast plate.
  pd.add(
    place(
      new T.CylinderGeometry(1, 1, 0.006, 20).scale(0.062, 1, 0.046).rotateX(Math.PI / 2),
      [0, -0.004, -0.009],
      lean,
    ),
    P.grip,
  );
  pd.add(
    place(bar([-0.075, 0.068, 0.004], [0.075, 0.068, 0.004], 0.008, 12), [0, 0, 0], lean),
    P.steel,
  );
  pd.add(place(roundedBox([0.15, 0.014, 0.03], 0.005, 1), [0, -0.068, -0.012], lean), P.alloy);
  pd.add(
    tube(
      [
        [out * 0.05, -0.03, 0.03],
        [out * 0.05, -0.08, 0.06],
        [out * 0.05, -0.1, 0.1],
      ],
      0.011,
      10,
    ),
    P.alloy,
  );
  pd.add(
    new T.CylinderGeometry(0.016, 0.016, 0.05, 12)
      .rotateZ(Math.PI / 2)
      .translate(out * 0.05, -0.1, 0.1),
    P.steel,
  );
  pd.add(bar([-out * 0.04, 0.06, 0.03], [-out * 0.04, -0.09, 0.13], 0.008, 10, 0.009), P.steel);
}

/** Sidewall lining between window panes, triangle by triangle: a cell with three of its four
 * corners on skin still gets the triangle between them, so the lining reaches the frames. */
function paneLiner(
  d,
  body,
  {
    zFrom,
    zTo,
    yFrom,
    yTo,
    zSteps,
    ySteps,
    inset = 0.008,
    from = 0.3,
    material,
    exclude = ['cockpit'],
  },
) {
  const grid = [];
  for (let i = 0; i <= zSteps; i++) {
    const z = zFrom + ((zTo - zFrom) * i) / zSteps,
      segments = skinSection(body, z, { exclude });
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
    v = new T.Vector3(),
    sections = new Map();
  // A partial cell's triangle is kept only when skin also lies under its centroid, so it does
  // not reach across a slanted pane edge.
  const onSkin = (corners, side) => {
    const z = (corners[0][2] + corners[1][2] + corners[2][2]) / 3,
      y = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;
    if (!sections.has(z)) sections.set(z, skinSection(body, z, { exclude }));
    return wallAt(sections.get(z), y, side, from) !== undefined;
  };
  for (const side of [1, -1]) {
    const at = (p) => (p.x[side] === undefined ? undefined : [p.x[side] - side * inset, p.y, p.z]);
    const tri = (partial, ...corners) => {
      if (corners.some((c) => !c) || (partial && !onSkin(corners, side))) return false;
      const [a, b, c] = corners;
      u.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      v.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      positions.push(...a, ...(u.cross(v).x * -side >= 0 ? [...b, ...c] : [...c, ...b]));
      return true;
    };
    for (let i = 0; i < zSteps; i++)
      for (let j = 0; j < ySteps; j++) {
        const [p, q, r, w] = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]].map(
          at,
        );
        if (p && q && r && w) {
          tri(false, p, q, r);
          tri(false, p, r, w);
        } else tri(true, p, q, r) || tri(true, p, r, w) || tri(true, p, q, w) || tri(true, q, r, w);
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
export function dc3FrameStations(root, cabin, stations) {
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

export function dc3Cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'DC3-cockpit'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'DC3'),
    { bindings, derived, ink, black } = ins;
  const green = mat('DC3-cockpit-green', '#34473b'),
    liner = mat('DC3-cabin-liner', '#c4bca5'),
    cloth = mat('DC3-seat-cloth', '#6b7c6f'),
    blue = mat('DC3-prop-controls', '#366ba0'),
    P = partPalette();
  const deck = 2.9,
    k = 1.95 / 1145,
    x = (u) => (925 - u) * k,
    y = (v) => 3.85 + (500 - v) * k,
    z = 8.15,
    at = (u, v, dz = 0) => [x(u), y(v), z + dz];
  const edge = [
    [395, 500],
    [778, 415],
    [1095, 415],
    [1490, 492],
    [1490, 807],
    [1115, 807],
    [1115, 870],
    [778, 870],
    [778, 825],
    [395, 825],
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
  // Close the panel housing's top between the face and its back sheet: from the seat, above
  // the eye-level edge, the back sheet showed as a black band over the panel.
  for (let i = 0; i < 3; i++) {
    const [a, b] = [edge[i], edge[i + 1]];
    quad(d, a, b, [b[0], b[1], b[2] + 0.16], [a[0], a[1], a[2] + 0.16], m.dark, [0, 1, 0]);
  }
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
    // Positive turning right, so the needle leans into the turn (yawRate is positive left).
    turnDegrees: { op: 'multiply', args: ['yawRate', -180 / Math.PI] },
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
      // Pressure warning lamps: 9 mm domes need few facets.
      d.add(new T.SphereGeometry(1, 10, 6).scale(0.009, 0.009, 0.005), m.orange, at(u, v, -0.026));
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
  // It hangs inside the roof behind the windscreen centre post (it once stood through the skin).
  beveledBox(d, [0.14, 0.17, 0.12], [0, 4.3, 7.97], m.dark, 0.02);
  ins.headingDrum('compass', [0, 4.31, 7.904], 0.045, 'trueHeading');
  d.text('TRUE', [0, 4.238, 7.905], 0.012, Math.PI, ink, 'display');
  // Throttle quadrant at the panel's lower centre (C-47A Le Bourget photo): cranked flat levers,
  // white propeller balls (P), black throttle balls (T), red mixture balls (M).
  const q = group(cabin, 'DC3-quadrant', [0, 3.16, 7.65]),
    qd = detailKit(q, q.name),
    knobRed = P.red;
  beveledBox(qd, [0.43, 0.48, 0.66], [0, 0, 0], m.dark, 0.025);
  for (const [i, xx, label, color, signal] of [
    [0, 0.175, 'P', liner, null],
    [1, 0.115, 'P', liner, null],
    [2, 0.037, 'T', P.black, 'power'],
    [3, -0.037, 'T', P.black, 'power'],
    [4, -0.115, 'M', knobRed, null],
    [5, -0.175, 'M', knobRed, null],
  ]) {
    qd.box([0.011, 0.004, 0.49], [xx, 0.2405, 0], black);
    const g = group(q, `DC3-lever-${i}`, [xx, 0.24, 0.12]),
      ld = detailKit(g, g.name);
    // A flat bar cranked aft halfway up, as the Douglas levers are.
    const knee = [0, 0.15, -0.02],
      top = [0, 0.285, -0.115];
    for (const [a, b] of [
      [[0, 0, 0], knee],
      [knee, top],
    ])
      ld.add(
        place(
          roundedBox([0.009, Math.hypot(b[1] - a[1], b[2] - a[2]) + 0.012, 0.016], 0.002, 1),
          [0, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
          [Math.atan2(b[2] - a[2], b[1] - a[1]), 0, 0],
        ),
        m.engine,
      );
    ld.add(new T.SphereGeometry(0.026, 14, 10), color, [0, 0.3, -0.12]);
    ld.text(label, [0, 0.3, -0.147], 0.014, Math.PI, label === 'P' ? black : ink);
    ld.finish();
    if (signal)
      bindings.push({ node: g.name, source: signal, property: 'rotation', axis: 'x', scale: 0.7 });
  }
  // White elevator trim wheel on the left; no simulated trim signal is invented.
  qd.add(new T.TorusGeometry(0.2, 0.016, 6, 36).rotateY(Math.PI / 2), liner, [0.26, 0.03, -0.07]);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2)
    qd.add(
      bar(
        [0.26, 0.03, -0.07],
        [0.26, 0.03 + Math.sin(a) * 0.19, -0.07 + Math.cos(a) * 0.19],
        0.008,
        10,
      ),
      liner,
    );
  qd.add(
    new T.CylinderGeometry(0.03, 0.03, 0.04, 16).rotateZ(Math.PI / 2),
    m.metal,
    [0.25, 0.03, -0.07],
  );
  qd.finish();
  // Landing gear and flap levers on the floor between the seats, aft of the pedestal. The gear
  // lever carries its red safety latch; both swing forward for down.
  const floorQuadrant = group(cabin, 'DC3-floor-quadrant', [-0.1, deck, 7.22]),
    fq = detailKit(floorQuadrant, floorQuadrant.name);
  fq.add(place(roundedBox([0.2, 0.05, 0.16], 0.012, 1), [0, 0.025, 0]), m.dark);
  for (const x of [0.045, -0.055]) fq.box([0.012, 0.003, 0.12], [x, 0.051, 0], black);
  fq.text('GEAR', [0.045, 0.053, -0.07], 0.016, Math.PI, ink);
  fq.text('FLAPS', [-0.055, 0.053, -0.07], 0.016, Math.PI, ink);
  fq.finish();
  for (const [name, x, action, height, knob] of [
    ['DC3-gear-lever', 0.045, 'gear', 0.34, P.red],
    ['DC3-flap-lever', -0.055, 'flaps', 0.28, P.black],
  ]) {
    const g = group(floorQuadrant, name, [x, 0.04, 0]),
      gd = detailKit(g, name);
    gd.add(new T.CylinderGeometry(0.016, 0.016, 0.028, 14).rotateZ(Math.PI / 2), m.metal);
    gd.add(bar([0, 0, 0], [0, height, -0.02], 0.009, 12, 0.007), m.metal);
    if (action === 'gear') {
      // Ball grip and the hinged latch plate that blocks the lever until lifted.
      gd.add(new T.SphereGeometry(0.021, 14, 10), knob, [0, height + 0.012, -0.02]);
      gd.add(
        place(roundedBox([0.032, 0.06, 0.006], 0.003, 1), [0, 0.1, -0.022], [-0.08, 0, 0]),
        P.yellow,
      );
      gd.add(bar([-0.018, 0.13, -0.024], [0.018, 0.13, -0.024], 0.004, 10), P.yellow);
    } else {
      gd.add(
        lathe(
          [
            [0, 0],
            [0.012, 0],
            [0.016, 0.016],
            [0.015, 0.034],
            [0.01, 0.042],
            [0, 0.043],
          ],
          14,
        ),
        knob,
        [0, height - 0.005, -0.02],
      );
    }
    gd.finish();
    g.userData.aircraftControl = {
      action,
      motion: { property: 'rotation', axis: 'x', scale: 0.6, offset: -0.3 },
    };
  }
  for (const side of [-1, 1]) {
    const pitch = group(cabin, `DC3-column-${side}`, [side * 0.56, deck, 7.92]),
      pd = detailKit(pitch, pitch.name);
    // Tapered column from its floor boot to a collar under the wheel hub.
    pd.add(
      lathe(
        [
          [0, 0],
          [0.075, 0],
          [0.07, 0.03],
          [0.05, 0.05],
          [0.046, 0.08],
          [0.034, 0.1],
          [0, 0.1],
        ],
        16,
        28,
      ),
      P.grip,
    );
    pd.add(bar([0, 0.05, 0], [0, 0.72, -0.046], 0.034, 16, 0.027), m.dark);
    pd.add(
      lathe(
        [
          [0, 0],
          [0.036, 0],
          [0.036, 0.03],
          [0, 0.03],
        ],
        16,
      ),
      m.metal,
      [0, 0.7, -0.045],
    );
    pd.finish();
    const roll = group(pitch, `DC3-wheel-${side}`, [0, 0.76, -0.05]),
      wd = detailKit(roll, roll.name);
    douglasWheel(wd, P, m.dark, m.metal);
    wd.finish();
    bindings.push(
      // Nose up pulls the column aft; right bank turns the wheel clockwise from the seat.
      { node: pitch.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.16 },
      { node: roll.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.75 },
    );
    for (const sign of [-1, 1]) {
      const g = group(cabin, `DC3-pedal-${side}-${sign}`, [
          side * 0.56 + sign * 0.16,
          deck + 0.12,
          7.98,
        ]),
        dd = detailKit(g, g.name);
      douglasPedal(dd, P, sign);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        // Right rudder pushes the right pedal (-X) forward.
        scale: -sign * 0.05,
      });
    }
    beveledBox(d, [0.57, 0.15, 0.62], [side * 0.58, 3.345, 7.42], cloth, 0.055);
    beveledBox(d, [0.57, 0.75, 0.16], [side * 0.58, 3.745, 7.15], cloth, 0.06);
    for (const xx of [-0.22, 0.22])
      d.rod([side * 0.58 + xx, deck, 7.44], [side * 0.58 + xx, 3.25, 7.44], 0.022, m.metal);
    d.rod([side * 0.58 - 0.23, 3.445, 7.34], [side * 0.58 + 0.23, 3.445, 7.59], 0.018, liner);
    d.box([0.055, 0.019, 0.04], [side * 0.58, 3.455, 7.47], m.metal);
  }
  // The flight-deck sidewalls are lined from the skin by `fit` below (the straight sheets that
  // stood here missed the curved skin and let bare aluminium show around them).
  // Original overhead: paired ignition selectors in the middle, electrical switches at the sides.
  // It lies along the sloping roof behind the header, narrowed to fit under the curved ceiling.
  const oh = group(cabin, 'DC3-overhead', [0, 4.43, 7.77]);
  oh.rotation.x = -1.314;
  oh.scale.x = 0.72;
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
  // Ignition selector dial plates; their pointer knobs are the engine control stations below.
  for (const side of [-1, 1]) {
    od.add(
      lathe(
        [
          [0, 0],
          [0.053, 0],
          [0.053, 0.014],
          [0.046, 0.02],
          [0, 0.02],
        ],
        24,
      )
        .rotateX(-Math.PI / 2)
        // Round again under the overhead's narrowing scale.
        .scale(1 / 0.72, 1, 1),
      m.metal,
      [side * 0.16, 0.03, -0.002],
    );
    for (let k = 0; k < 4; k++) {
      const a = (-0.6 + k * 0.4) * Math.PI;
      od.box(
        [0.003, 0.012, 0.002],
        [side * 0.16 + Math.sin(a) * 0.04, 0.03 + Math.cos(a) * 0.04, -0.023],
        black,
      );
    }
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
  // Flight deck stands a step above the cabin floor, level with the seats, column bases and pedals.
  // Twenty-one seats follow the manual's 2+1 plan.
  sheet(
    d,
    [
      [-1, 2.19, 6.4],
      [1, 2.19, 6.4],
      [1, deck, 6.4],
      [-1, deck, 6.4],
    ],
    m.dark,
    [0, 0, -1],
  );
  for (const [a, b] of [
    [
      [6.4, 1, 2.19],
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
  // Skin half width at a station and height (cockpit frame); the cabin floor and furniture
  // stay inside it where the belly sweeps up behind the wing.
  const wall = (zz, yy) => (m.skin ? m.skin(zz, yy) : 9);
  // The flight deck runs out to the skin: a 1 m wide sheet left the belly showing beside it.
  for (let zz = 6.4; zz < 8.3 - 1e-6; zz += 0.19) {
    const z1 = Math.min(8.3, zz + 0.19),
      half = (z) => Math.min(1.25, wall(z, deck + 0.005), wall(z, deck + 0.04)) - 0.012;
    sheet(
      d,
      [
        [-half(zz), deck, zz],
        [half(zz), deck, zz],
        [half(z1), deck, z1],
        [-half(z1), deck, z1],
      ],
      m.dark,
      [0, 1, 0],
    );
  }
  const floors = [
    [6.1, 1, 2.19],
    [-0.8, 1, 2.19],
    [-2.1, 0.92, 2.34],
    [-3.8, 0.68, 2.72],
  ];
  const floorY = (zz) => {
    const i = Math.max(0, Math.min(floors.length - 2, floors.findIndex((f) => f[0] < zz) - 1)),
      a = floors[i],
      b = floors[i + 1],
      f = Math.max(0, Math.min(1, (a[0] - zz) / (a[0] - b[0])));
    return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  // Floor strips sampled along the cabin, each trimmed to the skin at its height: the 2 m wide
  // panels poked out of the belly from the wing trailing edge aft.
  for (let zz = 6.1; zz > -3.8 + 1e-6; zz -= 0.25) {
    const z1 = Math.max(-3.8, zz - 0.25),
      edge = (z0) => {
        const [half, yy] = floorY(z0);
        return [Math.min(half, wall(z0, yy) - 0.02, wall(z0, yy + 0.02) - 0.02), yy];
      },
      [ha, ya] = edge(zz),
      [hb, yb] = edge(z1);
    if (ha > 0.05 && hb > 0.05)
      sheet(
        d,
        [
          [-ha, ya, zz],
          [ha, ya, zz],
          [hb, yb, z1],
          [-hb, yb, z1],
        ],
        m.dark,
        [0, 1, 0],
      );
  }
  for (let row = 0; row < 7; row++)
    for (const seatX of [0.78, 0.23, -0.78]) {
      const zz = 4.7 - row * 0.99,
        foot = floorY(zz)[1],
        // Window-side seats come in where the cabin narrows aft (cushion corners showed outside).
        xx = Math.sign(seatX) * Math.min(Math.abs(seatX), wall(zz, 2.49) - 0.255);
      beveledBox(d, [0.47, 0.13, 0.55], [xx, 2.55, zz], cloth, 0.04);
      beveledBox(d, [0.47, 0.78, 0.15], [xx, 2.94, zz - 0.24], cloth, 0.045);
      for (const dx of [-0.235, 0.235]) {
        d.box([0.045, 0.055, 0.42], [xx + dx, 2.84, zz], m.dark);
        // Outboard legs splay in to the seat track where the floor narrows.
        const top = xx + dx,
          base = Math.sign(top) * Math.min(Math.abs(top), wall(zz, foot + 0.02) - 0.06);
        d.rod([base, foot + 0.01, zz], [top, 2.48, zz], 0.018, m.metal);
      }
      d.box([0.29, 0.18, 0.02], [xx, 3.2, zz - 0.325], liner);
      d.rod([xx - 0.2, 2.63, zz - 0.13], [xx + 0.2, 2.63, zz + 0.14], 0.012, m.dark);
    }
  for (const side of [-1, 1]) {
    // Hat racks clear of the skin where the crown narrows aft.
    d.box([0.24, 0.025, 6.95], [side * 0.93, 4.03, 1.71], liner);
    for (let j = 0; j < 7; j++) {
      d.box([0.12, 0.02, 0.07], [side * 0.99, 3.99, 4.7 - j * 0.99], m.metal);
    }
  }
  // Forward cabin bulkhead with its doorway, its outline following the skin (the square
  // corners poked through the fuselage).
  {
    const heights = [2.19, 2.5, 2.9, 3.3, 3.7, 4.05, 4.38],
      rim = heights.map((yy) => Math.min(1.04, wall(5.55, yy) - 0.015));
    sheet(
      d,
      [
        [-rim[0], 2.19, 5.55],
        [-0.34, 2.19, 5.55],
        [-0.34, 4.12, 5.55],
        [0.34, 4.12, 5.55],
        [0.34, 2.19, 5.55],
        ...heights.map((yy, n) => [rim[n], yy, 5.55]),
        ...heights
          .map((yy, n) => [-rim[n], yy, 5.55])
          .reverse()
          .slice(0, -1),
      ],
      liner,
      [0, 0, -1],
    );
  }
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
  // Controls without a modeled part, placed where the DC-3 has them (cockpit frame; the builder
  // converts them with dc3FrameStations once the cabin is posed). The ignition selectors' pointer
  // knobs sit on the overhead dial plates, the master switch between them; the parking brake
  // handle is low on the pedestal's left face, ahead of the captain's seat.
  oh.updateMatrix();
  const overhead = (x, y, z) => new T.Vector3(x, y, z).applyMatrix4(oh.matrix).toArray(),
    up = [oh.rotation.x, 0, 0];
  const stations = [
    ...[1, -1].map((side, engine) => ({
      action: 'engine',
      engine,
      style: 'rotary',
      scale: 1.5,
      at: overhead(side * 0.16, 0.03, -0.022),
      rotation: up,
    })),
    {
      action: 'engine',
      style: 'guarded',
      scale: 1.3,
      at: overhead(0, 0.05, -0.002),
      rotation: up,
      label: 'MASTER',
      labelAt: [0, 0.04, -0.002],
      labelHeight: 0.009,
    },
    {
      action: 'brake',
      style: 'tee',
      scale: 1.2,
      at: [0.217, 3.06, 7.86],
      rotation: [0, -Math.PI / 2, 0],
      label: 'PARK BRK',
      labelAt: [0, 0.035, -0.002],
      labelHeight: 0.011,
    },
  ];
  /** Close the nose behind the panel and line the flight deck's sidewalls, in the airframe
   * (`body`) frame, once the cockpit group is posed in it. */
  const fit = (body) => {
    const holder = group(cabin, 'DC3-cockpit-fit', cabin.position.clone().negate().toArray()),
      fd = detailKit(holder, holder.name),
      wallLining = m.lining ?? green;
    // Just ahead of the panel's back sheet, deck to the windscreen's lower frame: no bare skin
    // beside or under the panel.
    cockpitBulkhead(fd, body, { z: 8.08, yFrom: 2.9, yTo: 3.56, material: m.dark });
    cockpitLiner(fd, body, {
      zFrom: 5.9,
      zTo: 8.08,
      yFrom: 2.88,
      yTo: 3.57,
      zSteps: 10,
      ySteps: 5,
      from: 0.3,
      inset: 0.008,
      material: wallLining,
    });
    // Above the sill: the aft wall, the window posts and the strip up to the roof lining (the
    // lining and the roof frames are left out of the skin it follows). It stops short of the
    // windscreen's corner post: a grid over that steeply slanted post only made saw teeth.
    const exclude = ['cockpit', 'DC3-shell-DC3-deck-lining', 'DC3-shell-DC3-engine-case'];
    paneLiner(fd, body, {
      zFrom: 5.9,
      zTo: 7.82,
      yFrom: 3.55,
      yTo: 4.22,
      zSteps: 56,
      ySteps: 9,
      material: wallLining,
      exclude,
    });
    // Over the side windows the roof curves in from the window heads.
    cockpitLiner(fd, body, {
      zFrom: 5.9,
      zTo: 7.5,
      yFrom: 4.22,
      yTo: 4.45,
      zSteps: 10,
      ySteps: 3,
      from: 0.3,
      inset: 0.008,
      material: wallLining,
      exclude,
    });
    fd.finish();
  };
  return { nodes: ['cockpit'], sources, derived, bindings, stations, fit };
}
