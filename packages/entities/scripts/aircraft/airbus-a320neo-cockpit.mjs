/** Airbus A320neo flight deck. Geometry only, original, from published and replica-builder
 * dimensions; positions are relative to the seated eye.
 *
 * - Airbus flight deck briefing for pilots (STL 945.7136/97): six interchangeable 7.25 in display
 *   units, side-sticks on the outboard consoles, sliding tables, three-column overhead, 20 degrees of
 *   downward view along the pilot's sightline, eye-position balls on the centre post.
 * - Display units 184 mm square, about 165 mm of glass. PFD outboard at 0.545 m, ND inboard at
 *   0.335 m; upper ECAM centred with the lower ECAM 185 mm below it; ISIS left of the upper ECAM,
 *   clock and gear indication right, gear lever beside the lower ECAM (photo estimates).
 * - FCU about 256 x 86 mm with an EFIS control panel each side and master warning and caution
 *   outboard. The FCU's lower edge is set to just clear the display glass from the eye.
 * - Pedestal: two MCDUs forward, thrust levers with trim wheels either side, speedbrake left,
 *   flaps right, engine masters behind, then the parking brake and radio panels.
 * - Controls (FCOM and the pedestal photograph "Thrust levers of an Airbus A320", CC BY-SA 3.0):
 *   black thrust levers in a detent housing with the A/THR disconnect outboard, ENG MASTER 1/2
 *   lift-and-throw switches with chrome knobs either side of the ENG MODE rotary, a black speed
 *   brake knob left, the flap handle right in its 0-1-2-3-FULL gate, the PARK BRK handle turned a
 *   quarter, side-sticks with their takeover buttons.
 */
import {
  bar,
  batch,
  emit,
  lathe,
  leverGeometry,
  parkingBrakeGeometry,
  place,
  roundedBox,
  switchGeometry,
} from './cockpit-parts.mjs';
import { flightDeck } from './flight-deck-kit.mjs';
import { mat } from './mesh-kit.mjs';

const RAD = Math.PI / 180;

export function buildA320Cockpit(ctx) {
  const k = flightDeck(ctx, {
    // Airbus blue-grey (Air France F-GFKH flight deck photograph, ledger reference).
    panel: '#71889b',
    glareshield: '#1f2636',
    controller: '#4a5866',
    seat: '#5d6876',
    seatTrim: '#2a2f36',
    liner: '#c9ccca',
    wall: '#8c959c',
    floor: '#3a4048',
    key: '#3e4954',
    lettering: '#eef0ea',
  });
  const [ex, ey, ez] = ctx.eye,
    tilt = 12 * RAD,
    row = [ey - 0.5, ez + 0.77],
    P = k.surface('main-panel', [0, ...row], [0, Math.cos(tilt), Math.sin(tilt)]);
  const du = 0.165,
    bezel = { b: [0.0095, 0.0095, 0.0095, 0.0095] },
    pfd = {
      attitude: [0.04, 0.05, 0.42, 0.5],
      corner: 0.25,
      speed: [0.38, 0.05, 0.15, 0.62],
      altitude: [-0.29, 0.05, 0.13, 0.62],
      vsi: [-0.43, 0.05, 0.07, 0.5],
      heading: { kind: 'tape', box: [0.04, -0.4, 0.42, 0.09] },
      fma: [0.44, 0.92, 0.08, 5],
    };
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    k.pfd(P, `PFD-${tag}`, side * 0.545, 0, du, du, pfd, { screen: bezel });
    k.nd(P, `ND-${tag}`, side * 0.335, 0, du, du, { kind: 'rose', screen: bezel });
  }
  k.engines(P, 'upper-ECAM', 0, 0, du, du, { screen: bezel, flaps: true });
  k.systems(P, 'lower-ECAM', 0, -0.185, du, du, {
    title: 'WHEEL',
    gear: true,
    rows: ['BRK --', 'AUTO BRK', 'ANTI SKID'],
    screen: bezel,
  });
  k.standby(P, 'ISIS', 0.15, 0.035, 0.07);
  k.gearLamps(P.d, P.g, k.n('gear-indicator'), -0.15, 0.06, 0.013, -0.004, true);
  k.clock(P, -0.15, -0.025, 0.06, 0.05);
  for (const [i, label] of ['LO', 'MED', 'MAX'].entries())
    k.lamp(P, -0.115 - i * 0.036, -0.078, 0.03, 0.018, 'white', label);
  // The L/G lever: a grey wheel knob, UP over DOWN, beside the lower ECAM.
  k.gearLever(P, -0.14, -0.185, {
    knob: mat(`${ctx.prefix}-gear-knob`, '#a3a9ad', { roughness: 0.5 }),
  });
  // Outboard edges follow the skin; the centre drops to the pedestal under the lower ECAM.
  k.panelSheet(P, [
    ...k.skinContour(P, 0.72, -0.105, 0.1),
    [0.235, -0.105],
    [0.235, -0.285],
    [-0.235, -0.285],
    [-0.235, -0.105],
  ]);
  // Stowed sliding tables under the panel edge in front of each pilot.
  for (const side of [1, -1]) {
    P.d.box([0.42, 0.018, 0.03], [side * 0.47, -0.118, -0.012], k.m.face);
    P.d.box([0.08, 0.006, 0.01], [side * 0.47, -0.118, -0.032], k.m.metal);
  }
  // Glareshield: 20 degrees clear over the FCU; FCU 86 mm tall, its face 0.22 m aft of the panel.
  const depth = 0.04,
    lipZ = row[1] - 0.22 + depth,
    topY = ey - Math.tan(20.5 * RAD) * (lipZ - depth - ez),
    top = P.world([0, 0.1, 0]),
    gs = k.glareshield({
      lipZ,
      topY,
      faceBottom: topY - 0.09,
      panelTopZ: top[2],
      panelTopY: top[1],
      halfWidth: 0.72,
      slope: 0.5,
      // The windscreen's front edge: eye u 2.41 less the glazing's uStart 1.33 (airbus-a320neo.mjs).
      glassFront: ez + 2.41 - 1.33,
    }),
    gy = gs.height / 2;
  k.controller(gs.S, {
    x: 0,
    y: gy,
    w: 0.27,
    h: 0.084,
    depth,
    windows: [
      [0.09, 0.036, 'SPD'],
      [0.035, 0.036, 'HDG'],
      [-0.045, 0.044, 'ALT'],
      [-0.1, 0.044, 'V/S'],
    ],
    knobs: [
      [0.09, -0.02, 0.012],
      [0.035, -0.02, 0.012],
      [-0.045, -0.02, 0.013],
      [-0.1, -0.02, 0.012],
    ],
    buttons: [
      [0.117, -0.02, 0.016, 0.012],
      [0.062, -0.02, 0.016, 0.012],
      [0.006, 0.012, 0.016, 0.012],
      [-0.012, 0.012, 0.016, 0.012],
      [-0.003, -0.012, 0.03, 0.012],
      [-0.072, -0.02, 0.016, 0.012],
      [-0.125, -0.02, 0.016, 0.012],
    ],
  });
  for (const side of [1, -1]) {
    k.controller(gs.S, {
      x: side * 0.205,
      y: gy,
      w: 0.133,
      h: 0.084,
      depth: 0.035,
      knobs: [
        [side * 0.032, -0.012, 0.013],
        [-side * 0.032, -0.012, 0.013],
        [side * 0.04, 0.022, 0.009],
      ],
      buttons: [0.035, 0.012, -0.011, -0.034].map((x) => [x, 0.026, 0.016, 0.011]),
    });
    k.lamp(gs.S, side * 0.33, gy + 0.02, 0.044, 0.026, 'red', 'MASTER WARN');
    k.lamp(gs.S, side * 0.33, gy - 0.016, 0.044, 0.026, 'amber', 'MASTER CAUT');
    k.lamp(gs.S, side * 0.39, gy + 0.02, 0.03, 0.018, 'white', 'CHR');
    k.lamp(gs.S, side * 0.39, gy - 0.014, 0.03, 0.018, 'green');
  }

  // Pedestal: MCDUs forward, then thrust levers between the trim wheels, then the aft panels.
  const base = P.world([0, -0.285, 0]),
    ped = [
      [base[2] - 0.01, base[1]],
      [ez + 0.47, base[1] - 0.06],
      [ez + 0.47, base[1] - 0.06],
      [ez - 0.42, base[1] - 0.06],
    ],
    halfWidth = 0.25;
  k.prism([ped[0], ped[1], ped[3]], 0, halfWidth);
  const F = k.onSegment('pedestal-forward', ped, 0);
  for (const side of [1, -1])
    k.cdu(F, side > 0 ? 'MCDU 1' : 'MCDU 2', side * 0.155, 0, 0.146, 0.215, {
      screenColor: 'cyan',
    });
  k.switchField(F, 0, 0.0, 0.14, 0.2, { rows: 4, cols: 3, seed: 2, title: 'ECAM' });
  const Q = k.onSegment('throttle-quadrant', ped, 2);
  const qLen = Math.abs(ped[3][0] - ped[2][0]),
    qy = (dz) => qLen / 2 - dz;
  const P2 = k.parts;
  // Thrust levers in their detent housing (TOGA, FLX MCT, CL, IDLE marked down each slot), the
  // A/THR instinctive disconnect on each outboard side; the housing is all the throttles together.
  k.thrustLevers(Q, {
    xs: [0.05, -0.05],
    y: qy(0.16),
    slot: 0.16,
    cover: {
      w: 0.17,
      h: 0.22,
      t: 0.024,
      draw: (d) => {
        for (const s of [1, -1])
          for (const [i, dy] of [0.065, 0.04, 0.015, -0.045].entries())
            d.box([0.018, 0.002, 0.001], [s * 0.074, dy, -0.0245], i === 2 ? k.m.green : k.m.paint);
        k.label(d, 'TOGA', [0.074, 0.08, -0.0245], 0.006);
        k.label(d, 'IDLE', [0.074, -0.058, -0.0245], 0.006);
      },
    },
    draw: (d, _i, x) =>
      leverGeometry(d, { style: 'thrust-airbus', height: 0.17, side: x > 0 ? 1 : -1, palette: P2 }),
  });
  // Speed brake lever left (RET forward), flaps right in a five-stop gate (0 1 2 3 FULL).
  k.speedBrakeLever(Q, {
    x: 0.2,
    y: qy(0.13),
    slot: 0.12,
    draw: (d) => {
      const b = batch();
      b.add(P2.alloy, bar([0, 0, 0], [0, 0.13, -0.012], 0.0055, 12));
      b.add(
        P2.grip,
        place(
          lathe(
            [
              [0, 0],
              [0.011, 0.004],
              [0.016, 0.018],
              [0.015, 0.034],
              [0.01, 0.044],
              [0, 0.047],
            ],
            16,
          ),
          [0, 0.125, -0.011],
        ),
      );
      emit(d, b.map);
    },
  });
  k.label(Q.d, 'SPEED BRAKE', [0.2, qy(0.045), -0.002], 0.006);
  k.flapLever(Q, {
    x: -0.2,
    y: qy(0.3),
    slot: 0.13,
    marks: 5,
    gateWidth: 0.05,
    draw: (d) => {
      const b = batch();
      b.add(P2.alloy, place(roundedBox([0.008, 0.13, 0.014], 0.002, 1), [0, 0.065, 0]));
      b.add(P2.white, bar([0.032, 0.138, 0], [-0.032, 0.138, 0], 0.011, 14));
      for (const s of [-1, 1])
        b.add(
          P2.white,
          place(
            lathe(
              [
                [0.011, 0],
                [0.008, 0.004],
                [0, 0.005],
              ],
              14,
            ),
            [s * 0.032, 0.138, 0],
            [0, 0, (-s * Math.PI) / 2],
          ),
        );
      b.add(P2.black, place(roundedBox([0.022, 0.006, 0.012], 0.002), [0, 0.12, 0.004]));
      emit(d, b.map);
    },
  });
  k.label(Q.d, 'FLAPS', [-0.2, qy(0.215), -0.002], 0.007);
  for (const side of [1, -1])
    k.trimWheel(side * (halfWidth + 0.01), base[1] - 0.14, ped[2][0] - 0.16, 0.085);
  // ENG MASTER 1 and 2 (lift and throw: ON forward) either side of the ENG MODE selector.
  Q.d.box([0.18, 0.09, 0.004], [0, qy(0.36), -0.002], k.m.face);
  k.label(Q.d, 'ENG', [0, qy(0.325), -0.0045], 0.008);
  for (const [i, x] of [0.055, -0.055].entries()) {
    k.label(Q.d, `${i + 1}`, [x, qy(0.33), -0.0045], 0.008);
    k.label(Q.d, 'ON', [x - 0.018, qy(0.35), -0.0045], 0.005);
    k.label(Q.d, 'OFF', [x - 0.019, qy(0.385), -0.0045], 0.005);
    k.live(Q.g, `eng-master-${i + 1}`, [x, qy(0.367), -0.004], {
      stand: true,
      draw: (d) => {
        const b = batch();
        b.add(
          P2.black,
          lathe(
            [
              [0.013, 0],
              [0.013, 0.005],
              [0.009, 0.008],
              [0.005, 0.008],
            ],
            16,
          ),
        );
        b.add(P2.steel, bar([0, 0, 0], [0, 0.034, 0], 0.0038, 10));
        b.add(
          P2.alloy,
          lathe(
            [
              [0.005, 0.028],
              [0.0105, 0.032],
              [0.0115, 0.048],
              [0.009, 0.056],
              [0, 0.058],
            ],
            16,
          ),
        );
        emit(d, b.map);
      },
      control: {
        action: 'engine',
        engine: `engine-${i + 1}`,
        motion: { property: 'rotation', axis: 'x', scale: 0.7, offset: -0.35 },
      },
    });
  }
  k.label(Q.d, 'MODE', [0, qy(0.345), -0.0045], 0.005);
  k.live(Q.g, 'eng-mode', [0, qy(0.375), -0.004], {
    draw: (d) => switchGeometry(d, { style: 'chicken', scale: 1.1, palette: P2 }),
    control: { action: 'engine', style: 'chicken' },
  });
  // PARK BRK: a handle pulled up and turned a quarter.
  Q.d.box([0.1, 0.08, 0.004], [0, qy(0.48), -0.002], k.m.face);
  k.label(Q.d, 'PARK BRK', [0, qy(0.448), -0.0045], 0.006);
  k.live(Q.g, 'park-brake', [0, qy(0.485), -0.004], {
    stand: true,
    draw: (d) => parkingBrakeGeometry(d, { style: 'rotary', palette: P2 }),
    control: { action: 'brake', motion: { property: 'rotation', axis: 'z', scale: Math.PI / 2 } },
  });
  k.handle(Q, 0, qy(0.62), { colour: 'red', width: 0.04 });
  for (const side of [1, -1]) {
    k.switchField(Q, side * 0.15, qy(0.5), 0.15, 0.2, {
      rows: 3,
      cols: 3,
      seed: side > 0 ? 7 : 9,
      title: 'RMP',
    });
    k.switchField(Q, side * 0.15, qy(0.74), 0.15, 0.2, {
      rows: 3,
      cols: 4,
      seed: side > 0 ? 4 : 6,
      title: 'ACP',
    });
  }

  // Crew stations: side-sticks on the outboard consoles, tillers outboard and forward of them.
  for (const side of [1, -1]) {
    const x = side * ex;
    k.seat(x, { z: ez, cushion: 0.82, back: 0.3, width: 0.5 });
    k.pedals(x, ez + 0.86, { variant: 'airbus' });
    const inboard = ex + 0.27,
      C = k.sideConsole(side, { z0: ez - 0.45, z1: ez + 0.5, y: ey - 0.62, inboard });
    k.sideStick(side * (ex + 0.36), { base: [ey - 0.618, ez + 0.2] });
    k.tiller(C, side * 0.02, 0.38);
    C.d.box([0.12, 0.09, 0.07], [0, -0.3, -0.035], k.m.grip);
    // Armrest behind the stick.
    C.d.box([0.08, 0.3, 0.06], [-side * 0.02, -0.02, -0.03], k.m.seatTrim);
  }
  const oh = k.overhead({ zF: ez + 0.45, zA: ez - 0.55, halfWidth: 0.3 });
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 4; r++)
      k.switchField(oh.S, 0.2 - c * 0.2, oh.length * (0.36 - r * 0.24), 0.19, oh.length * 0.22, {
        rows: 3,
        cols: 5,
        seed: c * 5 + r + 2,
        title: [
          ['ELEC', 'FUEL', 'ADIRS', 'LIGHTS'],
          ['FIRE', 'HYD', 'ENG', 'APU'],
          ['AIR', 'PRESS', 'ANTI ICE', 'CALLS'],
        ][c][r],
      });
  // The footwell: closed ahead of the pedal shaft and under the panel, lined and floored to it.
  const foot = P.world([0.5, -0.105, 0.1]),
    wellZ = ez + 1.08;
  k.footwell({ z: wellZ, top: foot[1], from: foot[2] });
  k.floorPlate(ctx.bulkheadZ, wellZ);
  k.walls(ctx.bulkheadZ, ez + 0.55, { lowerTo: wellZ });
  return k.finish();
}
