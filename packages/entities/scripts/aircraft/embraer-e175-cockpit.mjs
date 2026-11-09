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
 */
import { flightDeck } from './flight-deck-kit.mjs';

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
    glareshield: '#2a2d30',
    controller: '#5a6067',
    seat: '#3b3e42',
    seatTrim: '#26292c',
    liner: '#c5c8c5',
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
  k.gearLever(P, -0.155, -0.035);
  k.gearLamps(P.d, P.g, k.n('gear-light'), -0.155, 0.035, 0.012, -0.004, false);
  k.panelSheet(
    P,
    k.fitToSkin(P, [
      [0.72, -0.17],
      [-0.72, -0.17],
      [-0.72, 0.145],
      [0.72, 0.145],
    ]),
  );
  const top = P.world([0, 0.145, 0]),
    gs = k.glareshield({
      lipZ: gpZ + gpDepth,
      topY: gpTop,
      faceBottom: gpBottom,
      panelTopZ: top[2],
      panelTopY: top[1],
      halfWidth: 0.72,
      slope: 0.5,
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
  k.guarded(F, 0, 0.04, 2, 0.026, 'amber');
  const Q = k.onSegment('throttle-quadrant', aft, 0),
    L = Math.abs(aft[1][0] - aft[0][0]),
    qy = (d) => L / 2 - d;
  k.levers(Q, {
    xs: [0.04, -0.04],
    y: qy(0.15),
    length: 0.17,
    knob: [0.05, 0.03, 0.035],
    color: '#e6e3da',
    slot: 0.15,
  });
  for (const side of [1, -1]) k.palmRest(Q, side * 0.15, qy(0.17), 0.09, 0.16);
  k.levers(Q, {
    xs: [0.2],
    y: qy(0.33),
    name: 'speedbrake',
    source: null,
    rest: -0.3,
    length: 0.11,
    knob: [0.04, 0.02, 0.025],
    slot: 0.1,
  });
  k.levers(Q, {
    xs: [-0.2],
    y: qy(0.33),
    name: 'flap-lever',
    source: 'flapPosition',
    rest: 0.35,
    travel: -0.7,
    length: 0.13,
    knob: [0.045, 0.025, 0.03],
    color: 'toggle',
    slot: 0.12,
  });
  k.switchField(Q, 0, qy(0.5), 0.36, 0.13, { rows: 2, cols: 6, seed: 4, title: 'TRIM' });
  k.switchField(Q, 0, qy(0.66), 0.36, 0.15, { rows: 3, cols: 6, seed: 8, title: 'AUDIO' });
  k.handle(Q, 0.16, qy(0.8), { colour: 'red', width: 0.05 });

  for (const side of [1, -1]) {
    const x = side * ex;
    k.seat(x, { z: ez, cushion: 0.8, back: 0.3, width: 0.48 });
    k.yoke(x, {
      wheel: [ey - 0.5, ez + 0.43],
      pivot: [ctx.floor + 0.02, ez + 0.57],
      style: 'ram',
      width: 0.38,
      color: '#9ea5ac',
      gripColor: '#3a3d40',
    });
    k.pedals(x, ez + 0.86);
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
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
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
  k.floorPlate(ctx.bulkheadZ, ez + 1.05);
  k.walls(ctx.bulkheadZ, ez + 0.5);
  return k.finish();
}
