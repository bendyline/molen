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
 * Where the model's own eye, floor and nose differ from the aircraft, the eye-relative figures win.
 */
import { flightDeck, rect } from './flight-deck-kit.mjs';

const RAD = Math.PI / 180;

export function build737Cockpit(ctx) {
  const k = flightDeck(ctx, {
    panel: '#5c6166',
    glareshield: '#25282b',
    controller: '#5c6166',
    seat: '#9eaec4',
    seatTrim: '#2b2e31',
    liner: '#c6c8c3',
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
      heading: { kind: 'arc', center: [0.02, -0.62], radius: 0.3, window: [0.02, -0.39, 0.52, 0.17] },
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
  k.dial(P, 'flap-indicator', 0.13, -0.075, 0.03, 'flapPosition', [[0, -2.4], [1, 2.4]], [0, 1], 'FLAPS', {
    tickLabels: { 0: 'UP', 1: '40' },
    responseSeconds: 0.4,
  });
  k.gearLever(P, -0.155, -0.045);
  k.gearLamps(P.d, P.g, k.n('gear-light'), -0.155, 0.065, 0.014, -0.004, true);
  k.knob(P, -0.12, -0.095, 0.011);
  k.panelSheet(
    P,
    k.fitToSkin(P, [
      [0.76, -0.155],
      [-0.76, -0.155],
      [-0.76, 0.13],
      [0.76, 0.13],
    ]),
  );
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
      for (let c = 0; c < 2; c++) k.lamp(gs.S, side * (0.49 + c * 0.034), gy + 0.02 - r * 0.02, 0.028, 0.013, 'amber');
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
  k.panelSheet(F, rect(0, 0, 0.52, cduLen + 0.01).map(([x, y]) => [x, y]));
  k.prism(aft, 0, 0.215);
  const Q = k.onSegment('throttle-quadrant', aft, 0);
  k.levers(Q, { xs: [0.045, -0.045], length: 0.22, knob: [0.06, 0.03, 0.034], color: '#d9d5c9', slot: 0.18 });
  k.levers(Q, { xs: [0.17], name: 'speedbrake', source: null, rest: -0.3, length: 0.14, knob: [0.045, 0.02, 0.02], slot: 0.12 });
  k.levers(Q, { xs: [-0.17], name: 'flap-lever', source: 'flapPosition', rest: 0.35, travel: -0.7, length: 0.15, knob: [0.05, 0.022, 0.03], color: 'toggle', slot: 0.14 });
  for (const side of [1, -1]) k.trimWheel(side * 0.225, qY - 0.1, (fwd[1][0] + ez + 0.16) / 2, 0.1);
  const A = k.onSegment('aft-pedestal', aft, 2);
  for (const x of [0.11, 0, -0.11]) k.handle(A, x, 0.21, { colour: 'red', width: 0.07 });
  k.handle(A, 0.15, 0.1, { colour: 'red', width: 0.035 });
  k.switchField(A, 0, 0.02, 0.4, 0.12, { rows: 2, cols: 6, seed: 3, title: 'NAV' });
  k.switchField(A, 0, -0.12, 0.4, 0.13, { rows: 3, cols: 5, seed: 5, title: 'AUDIO' });

  // Crew stations.
  for (const side of [1, -1]) {
    const x = side * ex;
    k.seat(x, { z: ez, cushion: 0.8, back: 0.3, width: 0.48 });
    k.yoke(x, { wheel: [ey - 0.53, ez + 0.43], pivot: [ctx.floor + 0.02, ez + 0.56], style: 'boeing', width: 0.34, color: '#4a4f54', hubColor: '#5c6166' });
    k.pedals(x, ez + 0.86);
    const C = k.sideConsole(side, { z0: ez - 0.55, z1: ez + 0.45, y: ey - 0.6, inboard: ex + 0.3 });
    if (side > 0) k.tiller(C, 0, 0.35);
    C.d.box([0.13, 0.08, 0.1], [0, -0.15, -0.05], k.m.grip);
  }
  // Overhead: forward panel 0.66 m wide from the windscreen header back over the seats.
  const oh = k.overhead({ zF: ez + 0.5, zA: ez - 0.55, halfWidth: 0.33 });
  for (let c = 0; c < 5; c++)
    for (let r = 0; r < 4; r++)
      k.switchField(oh.S, 0.264 - c * 0.132, oh.length * (0.36 - r * 0.24), 0.124, oh.length * 0.22, {
        rows: 3,
        cols: 4,
        seed: c * 4 + r,
        title: ['ELEC', 'FUEL', 'HYD', 'AIR', 'LIGHTS'][(c + r) % 5],
      });
  k.floorPlate(ctx.bulkheadZ, ez + 1.05);
  k.walls(ctx.bulkheadZ, ez + 0.55);
  return k.finish();
}
