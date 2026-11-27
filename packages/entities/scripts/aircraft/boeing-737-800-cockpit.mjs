/** Boeing 737-800 (NG) flight deck. Geometry only, original, from published and replica-builder
 * dimensions; positions are relative to the seated eye.
 *
 * - Main panel: one flat plane leaning 15 degrees back, about 1.5 m wide, its lower edge 0.58 m above
 *   the floor (CAD-derived figures, AVSIM thread 133071). Five identical 8 in display units in one
 *   row with level tops, PFD outboard at 0.50 m and ND inboard at 0.29 m each side; the sixth unit
 *   lies on the forward pedestal between the two CDUs, tilted about 30 degrees from horizontal.
 * - Glareshield: mode control panel about 470 x 73 mm, its face 0.31 m aft of the main panel. It is
 *   set so the published 15 degrees over the nose holds and its lower edge just clears the display
 *   glass, which is the sight picture Boeing trains: along the glareshield, displays below it.
 * - Pedestal: three bays, about 0.47 m wide and 1.1 m long. CDUs 228 x 146 mm. Striped stabilizer
 *   trim wheels either side of the throttle quadrant, speedbrake left, flaps right, fire handles.
 * - Overhead: forward section 0.66 m wide.
 * - Controls (FCOM 7.10/9.10 and the ATA Airlines 737-800 deck photograph, Nick Bartolotta, CC BY-SA
 *   3.0): columns rising from the floor to wheels with the checklist clip over the hub; thrust levers
 *   with piggyback reversers, TO/GA and A/T disconnect switches; the two start levers aft of them;
 *   speed brake lever down the left of the stand, flap lever in its gate down the right, parking
 *   brake lever left aft with its red light; gear lever (UP OFF DN) right of the centre displays;
 *   the APU switch on the forward overhead.
 * Where the model's own eye, floor and nose differ from the aircraft, the eye-relative figures win.
 */
import {
  flapSelectorGeometry,
  handleGeometry,
  leverGeometry,
  parkingBrakeGeometry,
  switchGeometry,
} from './cockpit-parts.mjs';
import { flightDeck, rect } from './flight-deck-kit.mjs';
import { mat } from './mesh-kit.mjs';

const RAD = Math.PI / 180;

export function build737Cockpit(ctx) {
  const k = flightDeck(ctx, {
    panel: '#5c6166',
    glareshield: '#25282b',
    controller: '#5c6166',
    seat: '#9eaec4',
    seatTrim: '#2b2e31',
    liner: '#c6c8c3',
    wall: '#8f9597',
    floor: '#3d4247',
    key: '#3b4045',
  });
  const [ex, ey, ez] = ctx.eye,
    tilt = 15 * RAD,
    // Display row centre: active tops 0.18 m below the MCP's lower edge, seen from the eye.
    row = [ey - 0.44, ez + 0.76],
    P = k.surface('main-panel', [0, ...row], [0, Math.cos(tilt), Math.sin(tilt)]);
  const du = 0.175,
    bezel = { b: [0.014, 0.014, 0.012, 0.016] },
    pfd = {
      attitude: [0.02, 0.07, 0.44, 0.46],
      speed: [0.37, 0.07, 0.15, 0.62],
      altitude: [-0.31, 0.07, 0.15, 0.62],
      vsi: [-0.45, 0.07, 0.07, 0.5],
      heading: {
        kind: 'arc',
        center: [0.02, -0.62],
        radius: 0.3,
        window: [0.02, -0.39, 0.52, 0.17],
      },
      fma: [0.44, 0.62, 0.07, 3],
    };
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    k.pfd(P, `PFD-${tag}`, side * 0.5, 0, du, du, pfd, { screen: bezel });
    k.nd(P, `ND-${tag}`, side * 0.29, 0, du, du, { center: -0.3, radius: 0.55, screen: bezel });
    k.clock(P, side * 0.655, 0.055, 0.055, 0.05);
  }
  k.engines(P, 'upper-DU', 0, 0, du, du, { screen: bezel });
  k.standby(P, 'ISFD', 0.13, 0.035, 0.068);
  k.dial(
    P,
    'flap-indicator',
    0.13,
    -0.075,
    0.03,
    'flapPosition',
    [
      [0, -2.4],
      [1, 2.4],
    ],
    [0, 1],
    'FLAPS',
    {
      tickLabels: { 0: 'UP', 1: '40' },
      responseSeconds: 0.4,
    },
  );
  k.gearLever(P, -0.155, -0.045, { marks: ['UP', 'OFF', 'DN'] });
  k.gearLamps(P.d, P.g, k.n('gear-light'), -0.155, 0.065, 0.014, -0.004, true);
  k.knob(P, -0.12, -0.095, 0.011);
  k.panelSheet(P, k.skinContour(P, 0.76, -0.155, 0.13));
  // Glareshield: MCP face 0.31 m aft of the panel; 15 degrees clear over its top.
  const mcpDepth = 0.045,
    lipZ = row[1] - 0.31 + mcpDepth,
    topY = ey - Math.tan(15.4 * RAD) * (lipZ - ez),
    top = P.world([0, 0.13, 0]),
    gs = k.glareshield({
      lipZ,
      topY,
      faceBottom: topY - 0.075,
      panelTopZ: top[2],
      panelTopY: top[1],
      halfWidth: 0.68,
      slope: 0.45,
      // The windscreen's front edge: eye u 2.49 less the glazing's uStart 1.37 (boeing-737-800.mjs).
      glassFront: ez + 2.49 - 1.37,
    }),
    gy = gs.height / 2;
  k.controller(gs.S, {
    x: 0,
    y: gy,
    w: 0.47,
    h: 0.068,
    depth: mcpDepth,
    windows: [
      [0.2, 0.026, 'CRS'],
      [0.135, 0.034, 'IAS'],
      [0.035, 0.026, 'HDG'],
      [-0.07, 0.038, 'ALT'],
      [-0.145, 0.036, 'V/S'],
      [-0.205, 0.026, 'CRS'],
    ],
    knobs: [
      [0.2, -0.017, 0.009],
      [0.135, -0.017, 0.01],
      [0.035, -0.017, 0.011],
      [-0.07, -0.017, 0.011],
    ],
    buttons: [
      [0.09, -0.017, 0.016, 0.012],
      [0.07, -0.017, 0.016, 0.012],
      [-0.01, -0.017, 0.016, 0.012],
      [-0.03, -0.017, 0.016, 0.012],
      [-0.105, -0.017, 0.016, 0.012],
      [-0.175, 0.012, 0.016, 0.012],
      [-0.175, -0.017, 0.016, 0.012],
      [0.225, -0.017, 0.014, 0.012, 'amber'],
      [-0.225, -0.017, 0.014, 0.012, 'amber'],
    ],
  });
  // V/S thumbwheel.
  gs.S.d.box([0.012, 0.03, 0.02], [-0.145, gy - 0.017, -mcpDepth - 0.004], k.m.knob);
  for (const side of [1, -1]) {
    // EFIS control panel, then the warning lights and six-pack at the outboard end.
    k.controller(gs.S, {
      x: side * 0.32,
      y: gy,
      w: 0.12,
      h: 0.068,
      depth: 0.04,
      knobs: [
        [side * 0.03, 0.012, 0.011],
        [-side * 0.03, 0.012, 0.011],
      ],
      buttons: [-0.04, -0.02, 0, 0.02, 0.04].map((x) => [x, -0.02, 0.014, 0.01]),
    });
    k.lamp(gs.S, side * 0.43, gy + 0.016, 0.042, 0.024, 'red', 'FIRE');
    k.lamp(gs.S, side * 0.43, gy - 0.016, 0.042, 0.024, 'amber', 'CAUTION');
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 2; c++)
        k.lamp(gs.S, side * (0.49 + c * 0.034), gy + 0.02 - r * 0.02, 0.028, 0.013, 'amber');
  }

  // Pedestal: three-bay forward section at 30 degrees, then quadrant and aft electronics.
  const base = P.world([0, -0.155, 0]),
    cduLen = 0.235,
    fwd = [
      [base[2] - 0.01, base[1]],
      [base[2] - 0.01 - cduLen * Math.cos(30 * RAD), base[1] - cduLen * Math.sin(30 * RAD)],
    ],
    qY = fwd[1][1] + 0.01,
    aft = [
      [fwd[1][0], qY],
      [ez + 0.16, qY],
      [ez + 0.15, qY - 0.04],
      [ez - 0.34, qY - 0.04],
    ];
  k.prism(fwd, 0, 0.26, k.m.panel, k.cd, [0]);
  const F = k.onSegment('pedestal-forward', fwd, 0);
  for (const side of [1, -1]) k.cdu(F, side > 0 ? 'CDU 1' : 'CDU 2', side * 0.168, 0, 0.146, 0.226);
  k.systems(F, 'lower-DU', 0, 0.006, du, du, { title: 'ENG', screen: bezel });
  k.panelSheet(
    F,
    rect(0, 0, 0.52, cduLen + 0.01).map(([x, y]) => [x, y]),
  );
  k.prism(aft, 0, 0.215);
  const Q = k.onSegment('throttle-quadrant', aft, 0),
    P2 = k.parts,
    knobs = { ...P2, black: mat(`${ctx.prefix}-lever-d9d5c9`, '#d9d5c9', { roughness: 0.8 }) };
  // Thrust levers in their housing (the crew's "all throttles"), reversers piggyback, TO/GA under
  // each knob and the A/T disconnect at its outboard end; the start levers aft of them.
  k.thrustLevers(Q, {
    xs: [0.045, -0.045],
    y: 0.025,
    slot: 0.17,
    cover: {
      w: 0.19,
      h: 0.33,
      dy: -0.025,
      t: 0.014,
      draw: (d) => {
        for (const [x, text] of [
          [0.075, '1'],
          [-0.075, '2'],
        ])
          k.label(d, text, [x, -0.105, -0.0145], 0.012);
        k.label(d, 'CUTOFF', [0, -0.155, -0.0145], 0.007);
      },
    },
    draw: (d, _i, x) =>
      leverGeometry(d, {
        style: 'thrust-boeing',
        height: 0.22,
        rake: -0.012,
        side: x > 0 ? 1 : -1,
        palette: knobs,
      }),
  });
  for (const [i, x] of [0.03, -0.03].entries()) {
    Q.d.box([0.008, 0.05, 0.002], [x, -0.115, -0.0152], k.m.black);
    k.live(Q.g, `start-lever-${i + 1}`, [x, -0.12, -0.014], {
      stand: true,
      draw: (d) => leverGeometry(d, { style: 'start-lever', height: 0.05, palette: P2 }),
      control: { action: 'engine', engine: `engine-${i + 1}`, style: 'start-lever' },
    });
  }
  // Speed brake down the left side, DOWN detent forward; flaps in their gate down the right.
  k.speedBrakeLever(Q, {
    x: 0.165,
    y: 0.03,
    slot: 0.17,
    draw: (d) => handleGeometry(d, { style: 'lever', height: 0.17, palette: P2 }),
  });
  k.flapLever(Q, {
    x: -0.165,
    y: 0.02,
    slot: 0.17,
    marks: 9,
    gateWidth: 0.055,
    draw: (d) => flapSelectorGeometry(d, { style: 'lever', height: 0.15, palette: P2 }),
  });
  k.label(Q.d, 'FLAPS', [-0.165, 0.128, -0.003], 0.008);
  k.label(Q.d, 'SPEED BRAKE', [0.165, 0.135, -0.003], 0.006);
  // Parking brake lever, left aft, with its red light.
  k.live(Q.g, 'parking-brake', [0.17, -0.125, 0], {
    stand: true,
    draw: (d) => parkingBrakeGeometry(d, { style: 'lever', palette: P2 }),
    control: { action: 'brake', style: 'lever' },
  });
  k.lamp(Q, 0.125, -0.15, 0.03, 0.014, 'red');
  k.label(Q.d, 'PARK BRK', [0.165, -0.165, -0.003], 0.006);
  // Stabilizer trim wheels: big black wheels standing well proud of the quadrant either side, with
  // white stripes round the rim (ATA photograph), just clear of the stand's sides.
  for (const side of [1, -1]) {
    const r = 0.13,
      x = side * 0.233,
      y = qY - 0.07,
      z = (fwd[1][0] + ez + 0.16) / 2;
    k.trimWheel(x, y, z, r);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      k.cd.box(
        [0.0125, 0.003, 0.018],
        [x, y + Math.cos(a) * (r + 0.0005), z + Math.sin(a) * (r + 0.0005)],
        P2.white,
      ).rotation.x = a;
    }
  }
  const A = k.onSegment('aft-pedestal', aft, 2);
  for (const x of [0.11, 0, -0.11]) k.handle(A, x, 0.21, { colour: 'red', width: 0.07 });
  k.switchField(A, 0, 0.02, 0.4, 0.12, { rows: 2, cols: 6, seed: 3, title: 'NAV' });
  k.switchField(A, 0, -0.12, 0.4, 0.13, { rows: 3, cols: 5, seed: 5, title: 'AUDIO' });

  // Crew stations.
  for (const side of [1, -1]) {
    const x = side * ex;
    k.seat(x, { z: ez, cushion: 0.8, back: 0.3, width: 0.48 });
    k.yoke(x, {
      wheel: [ey - 0.53, ez + 0.43],
      pivot: [ctx.floor + 0.02, ez + 0.56],
      style: 'boeing',
      width: 0.34,
      color: '#4a4f54',
      hubColor: '#5c6166',
    });
    k.pedals(x, ez + 0.86, { variant: 'boeing' });
    const C = k.sideConsole(side, { z0: ez - 0.55, z1: ez + 0.45, y: ey - 0.6, inboard: ex + 0.3 });
    if (side > 0) k.tiller(C, 0, 0.35);
    C.d.box([0.13, 0.08, 0.1], [0, -0.15, -0.05], k.m.grip);
  }
  // Overhead: forward panel 0.66 m wide from the windscreen header back over the seats.
  const oh = k.overhead({ zF: ez + 0.5, zA: ez - 0.55, halfWidth: 0.33 });
  // The APU switch (OFF ON START) and its lights, on the forward overhead left of centre: the
  // crew's single engine master here, the start levers being each engine's.
  const apu = [0.132, oh.length * -0.36];
  oh.S.d.box([0.124, oh.length * 0.22, 0.006], [...apu, -0.003], k.m.face);
  k.label(oh.S.d, 'APU', [apu[0], apu[1] + oh.length * 0.085, -0.0065], 0.01);
  for (const [i, text] of ['OFF', 'ON', 'START'].entries())
    k.label(oh.S.d, text, [apu[0] + 0.022 - i * 0.022, apu[1] + 0.028, -0.0065], 0.005);
  k.lamp(oh.S, apu[0] + 0.042, apu[1] - 0.03, 0.026, 0.012, 'amber');
  k.lamp(oh.S, apu[0] - 0.042, apu[1] - 0.03, 0.026, 0.012, 'amber');
  k.live(oh.S.g, 'apu-switch', [apu[0], apu[1], -0.006], {
    draw: (d) => switchGeometry(d, { style: 'pointer', scale: 1.2, palette: P2 }),
    control: { action: 'engine', style: 'pointer' },
  });
  for (let c = 0; c < 5; c++)
    for (let r = 0; r < 4; r++)
      if (c !== 1 || r !== 3)
        k.switchField(
          oh.S,
          0.264 - c * 0.132,
          oh.length * (0.36 - r * 0.24),
          0.124,
          oh.length * 0.22,
          {
            rows: 3,
            cols: 4,
            seed: c * 4 + r,
            title: ['ELEC', 'FUEL', 'HYD', 'AIR', 'LIGHTS'][(c + r) % 5],
          },
        );
  // The footwell: closed ahead of the pedal shaft and under the panel, lined and floored to it.
  const foot = P.world([0, -0.155, 0.1]),
    wellZ = ez + 1.08;
  k.footwell({ z: wellZ, top: foot[1], from: foot[2] });
  k.floorPlate(ctx.bulkheadZ, wellZ);
  k.walls(ctx.bulkheadZ, ez + 0.55, { lowerTo: wellZ });
  return k.finish();
}
