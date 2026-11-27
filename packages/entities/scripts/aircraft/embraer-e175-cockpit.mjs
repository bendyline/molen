/** Embraer E175 (E-Jet E1, Primus Epic) flight deck. Geometry only, original; positions relative to
 * the seated eye, scaled from photographs (C-FFYG, SP-LIN) by the published 8 x 10 in display unit.
 *
 * - Five identical portrait display units (about 203 x 254 mm, 158 x 211 mm of glass): PFD at
 *   0.52 m, MFD at 0.31 m each side, EICAS centred. IESI and autobrake left of EICAS, clock and gear
 *   lever right of it.
 * - Guidance panel about 0.6 m wide across the glareshield, display controllers at its ends and
 *   master warning and caution inboard of them. Over the nose, APM figure 4.5's 15 degrees.
 * - Floor-mounted grey columns with ram's-horn wheels. Pedestal: two MCDUs forward with guarded
 *   start knobs between, thrust levers between cursor-control palm rests, speedbrake left, flaps
 *   right, trim and audio aft.
 * - Controls (deck photograph "Cockpit of LOT Embraer ERJ-175LR (SP-LIN)", Oleg Belyakov, CC BY-SA
 *   3.0): light grey deck and glareshield; grey columns whose arms sweep up into raked horns with
 *   switch heads; cream box-shaped thrust lever handles with the A/T disconnect on top and TO/GA
 *   in front; cream speed brake and flap handles either side; ENG 1/2 START/STOP selectors
 *   between the MCDUs, the APU master knob overhead, the EMER/PARK BRAKE handle aft left.
 */
import {
  batch,
  emit,
  lathe,
  parkingBrakeGeometry,
  place,
  roundedBox,
  switchGeometry,
} from './cockpit-parts.mjs';
import { flightDeck } from './flight-deck-kit.mjs';
import { mat } from './mesh-kit.mjs';

const RAD = Math.PI / 180;
/** Portrait PFD: attitude over a compass rose, tapes either side. */
export const portraitPfd = {
  attitude: [0.02, 0.2, 0.52, 0.36],
  speed: [0.37, 0.2, 0.17, 0.44],
  altitude: [-0.31, 0.2, 0.17, 0.44],
  vsi: [-0.45, 0.2, 0.07, 0.36],
  heading: { kind: 'rose', center: [0.02, -0.25], radius: 0.19 },
  fma: [0.45, 0.92, 0.07, 4],
};

export function buildE175Cockpit(ctx) {
  const k = flightDeck(ctx, {
    panel: '#8e959c',
    glareshield: '#6c7379',
    controller: '#5a6067',
    seat: '#3b3e42',
    seatTrim: '#26292c',
    liner: '#c5c8c5',
    wall: '#979ea4',
    floor: '#3b3f44',
    key: '#454b51',
  });
  const [ex, ey, ez] = ctx.eye,
    tilt = 12 * RAD,
    // Guidance panel face 0.22 m aft of the panel, 15 degrees clear over it; the display tops sit
    // just below its lower edge as the eye sees it.
    panelZ = ez + 0.78,
    gpDepth = 0.045,
    gpZ = panelZ - 0.22,
    gpTop = ey - Math.tan(15.5 * RAD) * (gpZ - ez),
    gpBottom = gpTop - 0.075,
    unitTop = ey + ((gpBottom - ey) * (panelZ + 0.02 - ez)) / (gpZ - ez) - 0.01,
    row = [unitTop - 0.127, panelZ],
    P = k.surface('main-panel', [0, ...row], [0, Math.cos(tilt), Math.sin(tilt)]);
  const w = 0.158,
    h = 0.211,
    bezel = { b: [0.0225, 0.0225, 0.015, 0.028], keys: 6 };
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    k.pfd(P, `PFD-${tag}`, side * 0.52, 0, w, h, portraitPfd, { screen: bezel });
    k.mfd(P, `MFD-${tag}`, side * 0.31, 0, w, h, {
      screen: bezel,
      rows: ['FUEL --', 'HYD --', 'ELEC --'],
    });
  }
  k.engines(P, 'EICAS', 0, 0, w, h, { screen: bezel, flaps: true, row: h * 0.3 });
  k.standby(P, 'IESI', 0.155, 0.06, 0.07);
  k.knob(P, 0.155, -0.055, 0.013);
  k.clock(P, -0.155, 0.085, 0.07, 0.05);
  k.gearLever(P, -0.155, -0.035, { lamp: true });
  k.gearLamps(P.d, P.g, k.n('gear-light'), -0.155, 0.035, 0.012, -0.004, false);
  k.panelSheet(P, k.skinContour(P, 0.72, -0.17, 0.145));
  const top = P.world([0, 0.145, 0]),
    gs = k.glareshield({
      lipZ: gpZ + gpDepth,
      topY: gpTop,
      faceBottom: gpBottom,
      panelTopZ: top[2],
      panelTopY: top[1],
      halfWidth: 0.72,
      slope: 0.5,
      // The windscreen's front edge: eye u 2.92 less the glazing's uStart 1.73 (embraer-e175.mjs).
      glassFront: ez + 2.92 - 1.73,
    }),
    gy = gs.height / 2;
  k.controller(gs.S, {
    x: 0,
    y: gy,
    w: 0.6,
    h: 0.068,
    depth: gpDepth,
    windows: [
      [0.25, 0.034, 'CRS'],
      [0.13, 0.036, 'SPD'],
      [0.04, 0.034, 'HDG'],
      [-0.08, 0.044, 'ALT'],
      [-0.25, 0.034, 'CRS'],
    ],
    knobs: [
      [0.25, -0.017, 0.011],
      [0.13, -0.017, 0.012],
      [0.04, -0.017, 0.012],
      [-0.08, -0.017, 0.013],
      [-0.25, -0.017, 0.011],
    ],
    buttons: [
      [0.19, -0.017, 0.018, 0.012],
      [0.09, -0.017, 0.018, 0.012],
      [-0.02, 0.012, 0.018, 0.012],
      [-0.02, -0.017, 0.018, 0.012],
      [-0.13, 0.012, 0.018, 0.012],
      [-0.13, -0.017, 0.018, 0.012],
      [-0.19, -0.017, 0.018, 0.012],
    ],
  });
  gs.S.d.box([0.012, 0.03, 0.02], [-0.165, gy, -gpDepth - 0.004], k.m.knob);
  for (const side of [1, -1]) {
    k.lamp(gs.S, side * 0.35, gy + 0.016, 0.04, 0.024, 'red', 'WARN');
    k.lamp(gs.S, side * 0.35, gy - 0.016, 0.04, 0.024, 'amber', 'CAUT');
    const dc = k.controller(gs.S, {
      x: side * 0.5,
      y: gy,
      w: 0.17,
      h: 0.066,
      depth: 0.035,
      knobs: [
        [side * 0.05, -0.008, 0.012],
        [0, -0.008, 0.012],
        [-side * 0.05, -0.008, 0.01],
      ],
      buttons: [-0.06, -0.02, 0.02, 0.06].map((x) => [x, 0.022, 0.018, 0.01]),
    });
    void dc;
  }

  // Pedestal: MCDUs side by side forward, then quadrant, then aft panels.
  const base = P.world([0, -0.17, 0]),
    fwd = [
      [base[2] - 0.01, base[1]],
      [ez + 0.47, base[1] - 0.07],
    ],
    qY = fwd[1][1],
    aft = [
      [fwd[1][0], qY],
      [ez - 0.38, qY],
    ],
    half = 0.23;
  k.prism([fwd[0], fwd[1], aft[1]], 0, half);
  const F = k.onSegment('pedestal-forward', fwd, 0);
  for (const side of [1, -1])
    k.cdu(F, side > 0 ? 'MCDU 1' : 'MCDU 2', side * 0.135, 0, 0.146, 0.22);
  const P2 = k.parts,
    cream = mat(`${ctx.prefix}-lever-e6e3da`, '#e6e3da', { roughness: 0.6 });
  // ENG 1 and 2 START/STOP selectors between the MCDUs (STOP, RUN, START).
  for (const [i, x] of [0.022, -0.022].entries()) {
    k.label(F.d, `${i + 1}`, [x, 0.075, -0.003], 0.008);
    k.live(F.g, `eng-start-${i + 1}`, [x, 0.045, -0.004], {
      draw: (d) => switchGeometry(d, { style: 'pointer', palette: P2 }),
      control: { action: 'engine', engine: `engine-${i + 1}`, style: 'pointer' },
    });
  }
  k.label(F.d, 'START', [0, 0.012, -0.003], 0.006);
  const Q = k.onSegment('throttle-quadrant', aft, 0),
    L = Math.abs(aft[1][0] - aft[0][0]),
    qy = (d) => L / 2 - d;
  // Thrust levers: cream box handles, A/T disconnect on top, TO/GA on the face toward the crew.
  k.thrustLevers(Q, {
    xs: [0.04, -0.04],
    y: qy(0.15),
    slot: 0.15,
    cover: {
      w: 0.15,
      h: 0.2,
      t: 0.012,
      // Thrust lever angle marks down each slot: TO/GA, CLB, IDLE, and the reverse gate.
      draw: (d) => {
        for (const s of [1, -1])
          for (const [i, dy] of [0.06, 0.03, -0.035, -0.06].entries())
            d.box([0.016, 0.002, 0.001], [s * 0.066, dy, -0.0125], i === 3 ? P2.red : k.m.paint);
        k.label(d, 'TLA', [0, -0.088, -0.0125], 0.007);
      },
    },
    draw: (d, _i, x) => {
      const b = batch(),
        s = x > 0 ? 1 : -1;
      b.add(P2.steel, place(roundedBox([0.012, 0.16, 0.02], 0.003, 1), [0, 0.08, 0]));
      b.add(cream, place(roundedBox([0.06, 0.044, 0.05], 0.012), [s * 0.006, 0.17, -0.004]));
      b.add(P2.black, place(roundedBox([0.026, 0.004, 0.014], 0.002), [s * 0.006, 0.1935, 0.004]));
      b.add(P2.black, place(roundedBox([0.018, 0.012, 0.004], 0.002), [s * 0.006, 0.164, -0.0305]));
      emit(d, b.map);
    },
  });
  for (const side of [1, -1]) k.palmRest(Q, side * 0.15, qy(0.17), 0.09, 0.16);
  // Speed brake (cream grip) left, flaps (cream knob, 0 to FULL) right.
  k.speedBrakeLever(Q, {
    x: 0.2,
    y: qy(0.33),
    slot: 0.11,
    draw: (d) => {
      const b = batch();
      b.add(P2.alloy, place(roundedBox([0.008, 0.11, 0.014], 0.002, 1), [0, 0.055, 0]));
      b.add(
        cream,
        place(
          lathe(
            [
              [0.009, 0],
              [0.014, 0.006],
              [0.015, 0.05],
              [0.012, 0.058],
              [0, 0.06],
            ],
            16,
          ),
          [0, 0.1, 0],
        ),
      );
      emit(d, b.map);
    },
  });
  k.flapLever(Q, {
    x: -0.2,
    y: qy(0.33),
    slot: 0.12,
    marks: 7,
    gateWidth: 0.05,
    // A cream paddle standing fore and aft, a flap profile on its face.
    draw: (d) => {
      const b = batch();
      b.add(P2.alloy, place(roundedBox([0.008, 0.11, 0.014], 0.002, 1), [0, 0.055, 0]));
      b.add(cream, place(roundedBox([0.024, 0.052, 0.046], 0.008), [0, 0.13, 0.002]));
      for (const s of [-1, 1])
        b.add(
          P2.black,
          place(roundedBox([0.002, 0.012, 0.028], 0.001), [s * 0.0125, 0.135, 0.002], [0.2, 0, 0]),
        );
      emit(d, b.map);
    },
  });
  k.switchField(Q, 0, qy(0.5), 0.36, 0.13, { rows: 2, cols: 6, seed: 4, title: 'TRIM' });
  k.switchField(Q, 0, qy(0.66), 0.36, 0.15, { rows: 3, cols: 6, seed: 8, title: 'AUDIO' });
  // EMER/PARK BRAKE handle, aft left on the pedestal.
  k.label(Q.d, 'PARK BRAKE', [0.16, qy(0.74), -0.002], 0.006);
  k.live(Q.g, 'park-brake', [0.16, qy(0.8), 0], {
    stand: true,
    draw: (d) => parkingBrakeGeometry(d, { style: 'lever', palette: P2 }),
    control: { action: 'brake', style: 'lever' },
  });

  for (const side of [1, -1]) {
    const x = side * ex;
    k.seat(x, { z: ez, cushion: 0.8, back: 0.3, width: 0.48 });
    k.yoke(x, {
      wheel: [ey - 0.5, ez + 0.43],
      pivot: [ctx.floor + 0.02, ez + 0.57],
      style: 'embraer',
      width: 0.38,
      color: '#9ea5ac',
      gripColor: '#3a3d40',
    });
    k.pedals(x, ez + 0.86, { variant: 'embraer' });
    const C = k.sideConsole(side, {
      z0: ez - 0.5,
      z1: ez + 0.45,
      y: ey - 0.58,
      inboard: ex + 0.29,
    });
    if (side > 0) k.tiller(C, 0, 0.33);
    C.d.box([0.12, 0.08, 0.08], [0, -0.2, -0.04], k.m.grip);
  }
  const oh = k.overhead({ zF: ez + 0.35, zA: ez - 0.6, halfWidth: 0.31 });
  // The APU master knob (OFF ON START) on the forward overhead: the crew's single engine master,
  // the START/STOP selectors being each engine's.
  const apu = [0.077, oh.length * -0.36];
  oh.S.d.box([0.145, oh.length * 0.22, 0.006], [...apu, -0.003], k.m.face);
  k.label(oh.S.d, 'APU', [apu[0], apu[1] + oh.length * 0.085, -0.0065], 0.01);
  for (const [i, text] of ['OFF', 'ON', 'START'].entries())
    k.label(oh.S.d, text, [apu[0] + 0.024 - i * 0.024, apu[1] + 0.028, -0.0065], 0.005);
  k.live(oh.S.g, 'apu-master', [apu[0], apu[1], -0.006], {
    draw: (d) => switchGeometry(d, { style: 'concentric', scale: 1.3, palette: P2 }),
    control: { action: 'engine', style: 'concentric' },
  });
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      if (c !== 1 || r !== 3)
        k.switchField(
          oh.S,
          0.232 - c * 0.155,
          oh.length * (0.36 - r * 0.24),
          0.145,
          oh.length * 0.22,
          {
            rows: 3,
            cols: 4,
            seed: c * 3 + r + 1,
            title: ['ELEC', 'FUEL', 'HYD', 'BLEED'][(c + r) % 4],
          },
        );
  // The footwell: closed ahead of the pedal shaft and under the panel, lined and floored to it.
  const foot = P.world([0, -0.17, 0.1]),
    wellZ = ez + 1.08;
  k.footwell({ z: wellZ, top: foot[1], from: foot[2] });
  k.floorPlate(ctx.bulkheadZ, wellZ);
  k.walls(ctx.bulkheadZ, ez + 0.5, { lowerTo: wellZ });
  return k.finish();
}
