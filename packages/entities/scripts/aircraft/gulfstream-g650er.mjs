/** Gulfstream G650ER, BR725. No dimensioned drawing was found: Gulfstream does not publish an
 * airport planning three-view. Stations are traced from photograph EC-LZU, a long-lens profile
 * about 20 degrees off the beam: 57 px/m along the body from the 30.41 m length and 54 px/m in
 * height from the 7.82 m overall height, the two differing by that foreshortening. The wing is
 * built from the published 36 degree sweep and 119.2 m2 area, and its traced tip then falls where
 * the same yaw predicts. Treat this as a reconstruction, not a measured three-view.
 */
import {
  bar,
  contour,
  lathe,
  loftUp,
  place,
  roundedBox,
  switchGeometry,
  tube,
} from './cockpit-parts.mjs';
import { T } from './mesh-kit.mjs';
import { stamp } from './transport-deck.mjs';
import { buildTransport, transportFrame } from './transport-kit.mjs';

const rot = (axis, scale, offset) => ({ property: 'rotation', axis, scale, offset });
/** Gulfstream throttle: a slim blade under a chrome barrel laid across the quadrant, the twin
 * barrels nearly meeting on the centreline, and the reverse lever's smaller barrel folded ahead
 * of it. `side` is the lever's own side (-1 right, +1 left). */
function throttle(k, P, side) {
  const arm = 0.115;
  k.add(place(roundedBox([0.01, arm, 0.024], 0.003, 1), [0, arm / 2, 0]), P.steel);
  k.add(
    place(
      lathe(
        [
          [0, -0.033],
          [0.015, -0.033],
          [0.0185, -0.029],
          [0.0185, 0.029],
          [0.015, 0.033],
          [0, 0.033],
        ],
        20,
      ),
      [-side * 0.004, arm + 0.012, 0],
      [0, 0, Math.PI / 2],
    ),
    P.alloy,
  );
  k.add(
    place(roundedBox([0.007, 0.05, 0.008], 0.002, 1), [0, arm - 0.022, 0.02], [0.45, 0, 0]),
    P.steel,
  );
  k.add(
    place(
      new T.CylinderGeometry(0.009, 0.009, 0.036, 16),
      [0, arm - 0.002, 0.032],
      [0, 0, Math.PI / 2],
    ),
    P.alloy,
  );
}

/** The G650's yoke: a deep hub widening to its foot (its face plate left blank), the arms swept
 * out level from the foot and up into near-vertical horns; the outboard horn carries the switch
 * pod, the inboard horn one push button. `side` is the outboard direction (+1 for the captain,
 * on +X). */
function yoke(k, P, side) {
  const hub = (y, w, depth) => ({ y, points: contour(0, 0.004, w, depth, 16, 4) });
  k.add(
    loftUp([
      hub(-0.085, 0.064, 0.042),
      hub(-0.02, 0.06, 0.04),
      hub(0.032, 0.054, 0.036),
      hub(0.044, 0.047, 0.03),
    ]),
    P.grip,
  );
  k.add(place(roundedBox([0.086, 0.07, 0.006], 0.008), [0, -0.026, -0.038]), P.black);
  for (const s of [-1, 1]) {
    const x = s * 0.155,
      out = s === side;
    k.add(
      tube(
        [
          [s * 0.05, -0.062, 0],
          [s * 0.1, -0.067, -0.004],
          [s * 0.138, -0.057, -0.008],
          [x, -0.028, -0.01],
          [x, 0.002, -0.01],
        ],
        0.014,
        14,
      ),
      P.grip,
    );
    const section = (y, rx, rz, dz = 0) => ({ y, points: contour(0, dz, rx, rz, 14, 2.3) });
    k.add(
      place(
        loftUp([
          section(-0.004, 0.0135, 0.015),
          section(0.03, 0.0145, 0.019, -0.002),
          section(0.068, 0.0125, 0.016, 0.001),
          section(0.1, 0.0135, 0.017, -0.002),
          section(out ? 0.116 : 0.126, 0.011, 0.013),
        ]),
        [x, 0, -0.01],
        [0, 0, -s * 0.06],
      ),
      P.grip,
    );
    if (out) {
      const head = [x + s * 0.009, 0.128, -0.012];
      k.add(place(roundedBox([0.04, 0.03, 0.05], 0.011), head, [0.2, 0, -s * 0.15]), P.grip);
      k.add(
        place(new T.CylinderGeometry(0.006, 0.006, 0.008, 12), [
          head[0] - s * 0.006,
          head[1] + 0.016,
          head[2] - 0.006,
        ]),
        P.black,
      );
      k.add(
        place(
          new T.CylinderGeometry(0.0045, 0.0045, 0.006, 12),
          [head[0] - s * 0.004, head[1] + 0.002, head[2] - 0.026],
          [Math.PI / 2, 0, 0],
        ),
        P.red,
      );
    } else
      k.add(place(new T.SphereGeometry(0.008, 12, 8), [x - s * 0.007, 0.127, -0.012]), P.white);
  }
}

/** The yoke's floor column: a black boxed section up into the hub's foot, raked a little forward
 * at the floor. */
function column(d, P, x, floor, [, ey, ez]) {
  const section = (y, z, w, depth) => ({ y, points: contour(x, z, w, depth, 16, 4) });
  d.add(
    loftUp([
      section(floor, ez + 0.4, 0.05, 0.045),
      section(floor + 0.035, ez + 0.396, 0.033, 0.03),
      section(ey - 0.635, ez + 0.31, 0.027, 0.025),
    ]),
    P.grip,
  );
}

/** An engine fire handle on the centre panel, fixed: black stem toward the pilot and a red T-cap
 * with the engine's letter (L and R either end of the gear and autobrake panels). */
function fireHandle(c, k, P, letter, [x, y, z]) {
  k.add(bar([x, y, z - 0.004], [x, y + 0.03, z - 0.012], 0.0045, 12), P.black);
  k.add(place(roundedBox([0.022, 0.046, 0.014], 0.004), [x, y + 0.048, z - 0.016]), P.red);
  c.text(k, letter, [x, y + 0.046, z - 0.0235], 0.02);
}

/** A FUEL CONTROL lift toggle from its pivot on the pedestal (RUN upright, OFF pulled out and
 * back): alloy stem, black ball knob with a red band. */
function fuelSwitch(k, P) {
  k.add(bar([0, 0, 0], [0, 0.028, 0], 0.003, 12), P.alloy);
  k.add(new T.SphereGeometry(0.0085, 14, 10), P.black, [0, 0.035, 0]);
  k.add(new T.CylinderGeometry(0.0088, 0.0088, 0.0025, 14), P.red, [0, 0.034, 0]);
}

/** The speed brake lever from its pivot in its slot: a black stalk and the clear, frosted block
 * knob with a black dot on its top (RETRACT forward, EXTEND aft). */
function speedBrakeLever(k, P) {
  k.add(bar([0, -0.008, 0], [0, 0.062, 0], 0.0042, 12), P.black);
  k.add(place(roundedBox([0.02, 0.052, 0.03], 0.005), [0, 0.088, 0]), P.alloy);
  k.add(new T.CylinderGeometry(0.0042, 0.0042, 0.002, 12), P.black, [0, 0.1145, 0.003]);
}

/** The flap lever from its pivot in its gated slot: a black stalk and the white block knob, its
 * aft face lettered FLAP. */
function flapLever(c, k, P) {
  k.add(bar([0, -0.008, 0], [0, 0.056, 0], 0.0042, 12), P.black);
  k.add(place(roundedBox([0.038, 0.024, 0.026], 0.004), [0, 0.068, 0]), P.white);
  c.text(k, 'FLAP', [0, 0.068, -0.0135], 0.0075, 'panel', P.black);
}

/** The parking brake handle, drawn in a mount turned to face aft (local +Z runs aft, local -X
 * outboard): a black bar along the pedestal's top edge from its forward pivot, lettered PARK
 * BRAKE, and the brushed-steel grip at its aft end curling down the pedestal's side. */
function parkBrakeHandle(k, P) {
  k.add(place(roundedBox([0.024, 0.022, 0.175], 0.006), [0, 0.012, 0.0875]), P.black);
  k.add(
    tube(
      [
        [0, 0.014, 0.16],
        [0, 0.016, 0.192],
        [-0.012, 0.008, 0.212],
        [-0.026, -0.022, 0.216],
        [-0.028, -0.058, 0.212],
      ],
      0.0085,
      14,
    ),
    P.alloy,
  );
  const label = k.text('PARK BRAKE', [0.0005, 0.0235, 0.085], 0.0095, 0, k.ivory, 'panel');
  label.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
}

/** A cursor control device on the forward end of a sidewall armrest: a black palm grip with its
 * scroll wheel, track nub and buttons. */
function cursorControl(d, P, [x, y, z]) {
  const section = (h, w, depth, dz = 0) => ({
    y: y + h,
    points: contour(x, z + dz, w, depth, 14, 2.6),
  });
  d.add(
    loftUp([
      section(0, 0.03, 0.044),
      section(0.018, 0.029, 0.042),
      section(0.03, 0.022, 0.034, -0.004),
      section(0.036, 0.012, 0.02, -0.006),
    ]),
    P.grip,
  );
  d.add(
    place(
      new T.CylinderGeometry(0.009, 0.009, 0.005, 14),
      [x, y + 0.03, z + 0.028],
      [0, 0, Math.PI / 2],
    ),
    P.tread,
  );
  d.add(new T.SphereGeometry(0.005, 10, 6), P.black, [x, y + 0.032, z + 0.012]);
  for (const u of [-1, 1])
    d.box([0.01, 0.004, 0.008], [x + u * 0.013, y + 0.026, z + 0.026], P.black);
}

/** The gear handle from its pivot on the centre panel: a short lever toward the pilot and the
 * pale wheel-shaped knob standing upright on it. */
function gearHandle(k, P) {
  k.add(bar([0, 0, 0], [0, 0, -0.03], 0.005, 12), P.alloy);
  k.add(
    place(new T.CylinderGeometry(0.022, 0.022, 0.022, 20), [0, 0, -0.038], [0, 0, Math.PI / 2]),
    P.white,
  );
  k.add(
    place(new T.CylinderGeometry(0.016, 0.016, 0.0235, 16), [0, 0, -0.038], [0, 0, Math.PI / 2]),
    P.tread,
  );
}

/** Flight deck of the PlaneView II type as photographed in G650 N520GA (2012) and G650ER N650GA
 * (EBACE 2018). Four 14 in landscape displays edge to edge on a dark grey panel; across the
 * glareshield the guidance panel, a display controller either side of it (the captain's carries
 * the standby display) and key panels at the ends. Yokes on floor columns. The centre panel
 * under the displays heads the pedestal: the red L and R fire handles at its ends, brake
 * accumulator gauge, autobrake selector and the gear handle right of centre. The pedestal itself
 * follows Jeff Atchison's 2023 G650ER photographs (Flickr): throttles between MCDU 1 and 2, FUEL
 * CONTROL and MCDU 3 behind them between the speed brake (left) and flap lever (right), the park
 * brake bar on the left edge, the trim panel aft and a cupholder tray at the end; the cursor
 * controllers ride on the sidewall armrests. A long overhead runs from the windscreen header back
 * over the seats. */
const g650Deck = {
  colors: {
    panel: '#454c51',
    // The pedestal and panel's slate blue-grey (Atchison's daylight photographs).
    console: '#55616b',
    glare: '#1c1e20',
    lining: '#a9a5a4',
    floor: '#56514c',
    seat: '#c5b597',
    bezel: '#2a2e31',
  },
  pedals: { style: 'airliner', scale: 0.95, lean: 0.27 },
  // Inboard armrests stowed, as photographed: the pedestal stays clear between the seats.
  seat: { armrests: 1 },
  leverSpacing: 0.09,
  control(c, { P, side }) {
    yoke(c, P, side);
  },
  column: (d, { P, x, floor, eye }) => column(d, P, x, floor, eye),
  powerLever(k, { P, index }) {
    throttle(k, P, index ? 1 : -1);
  },
  build(c) {
    const { d, m, P, sy, sz, floor, overhead: o } = c,
      [ex, ey, ez] = c.eye,
      z = sz;
    const W = 0.3,
      H = 0.22,
      Y = sy + 0.035;
    c.screen(d, 0.495, Y, z, W, H, 'pfd', { horizon: 'horizon-0' });
    c.screen(d, 0.165, Y, z, W, H, 'eicas');
    c.screen(d, -0.165, Y, z, W, H, 'map');
    c.screen(d, -0.495, Y, z, W, H, 'pfd', { horizon: 'horizon-3' });
    // Clocks outboard of each PFD.
    for (const side of [-1, 1]) {
      d.box([0.034, 0.05, 0.006], [side * 0.69, sy - 0.02, z - 0.001], m.bezel);
      d.box([0.024, 0.01, 0.002], [side * 0.69, sy - 0.012, z - 0.0045], m.amber);
    }
    // Glareshield band under the hood, the whole panel's width: the guidance panel's readouts and
    // knobs in the middle, a display controller either side, key panels at the ends.
    const gy = sy + 0.195,
      gz = z - 0.062;
    d.box([1.3, 0.074, 0.045], [0, gy, z - 0.0395], m.console);
    d.box([0.46, 0.064, 0.004], [0, gy, gz - 0.002], m.bezel);
    for (let q = 0; q < 6; q++) {
      const x = (q - 2.5) * 0.072;
      d.box([0.032, 0.011, 0.002], [x, gy + 0.014, gz - 0.0045], m.amber);
      c.tools.knob(x, gy - 0.012, gz - 0.004, 0.008);
    }
    for (const side of [-1, 1]) {
      d.box([0.17, 0.066, 0.004], [side * 0.35, gy, gz - 0.002], m.bezel);
      d.box([0.13, 0.054, 0.004], [side * 0.575, gy, gz - 0.002], m.bezel);
      for (let r = 0; r < 4; r++)
        for (const u of [-1, 1])
          d.box(
            [0.012, 0.008, 0.003],
            [side * 0.35 + u * 0.068, gy + 0.021 - r * 0.014, gz - 0.005],
            d.dark,
          );
      for (let r = 0; r < 2; r++)
        for (let q = 0; q < 4; q++)
          d.box(
            [0.022, 0.016, 0.004],
            [side * 0.575 + (q - 1.5) * 0.028, gy + 0.011 - r * 0.022, gz - 0.005],
            d.dark,
          );
    }
    c.standby(d, 0.35, gy, gz - 0.006, 0.058);
    c.screen(d, -0.35, gy, gz - 0.006, 0.08, 0.04, 'cdu');
    // Centre panel under the displays, the pedestal's head.
    const ly = sy - 0.148,
      lz = z - 0.004;
    d.box([0.44, 0.105, 0.02], [0, ly, z + 0.006], m.console);
    for (const x of [0.185, -0.185])
      d.box([0.012, 0.064, 0.002], [x, ly - 0.004, lz - 0.001], P.black);
    // Brake accumulator gauge and the autobrake selector with its three buttons.
    d.box([0.05, 0.075, 0.004], [0.1, ly, lz - 0.002], m.bezel);
    for (const [x, material] of [
      [0.112, m.green],
      [0.088, m.amber],
    ])
      d.box([0.006, 0.05, 0.002], [x, ly, lz - 0.0045], material);
    c.tools.knob(0.005, ly + 0.022, lz - 0.002, 0.011);
    for (const x of [-0.026, 0.005, 0.036])
      d.box([0.018, 0.018, 0.006], [x, ly - 0.026, lz - 0.003], d.dark);
    // Gear panel right of centre: three greens over the handle, horn silence and lock release
    // either side of it.
    d.box([0.075, 0.095, 0.004], [-0.098, ly, lz - 0.002], m.bezel);
    for (const x of [-0.118, -0.098, -0.078])
      d.box([0.012, 0.009, 0.003], [x, ly + 0.036, lz - 0.005], m.green);
    d.box([0.008, 0.062, 0.002], [-0.098, ly - 0.012, lz - 0.0045], P.black);
    d.box([0.014, 0.012, 0.006], [-0.124, ly - 0.004, lz - 0.005], d.dark);
    d.add(new T.CylinderGeometry(0.005, 0.005, 0.008, 12).rotateX(Math.PI / 2), P.red, [
      -0.072,
      ly - 0.004,
      lz - 0.006,
    ]);
    c.text(d, 'LDG GEAR', [-0.098, ly - 0.048, lz - 0.0045], 0.005);
    const gear = c.control('cockpit-gear', [-0.098, ly - 0.012, lz - 0.004], [0, 0, 0], {
      action: 'gear',
      motion: rot('x', -0.7, 0.35),
    });
    gearHandle(gear, P);
    // Fire handles at the panel's ends: L for the left engine (+X), R for the right.
    for (const [i, x] of [0.185, -0.185].entries())
      fireHandle(c, d, P, i ? 'R' : 'L', [x, ly - 0.034, lz - 0.002]);
    // Pedestal, as photographed from the seats (Flickr, Jeff Atchison's G650ER set, 2023): MCDU 1
    // and 2 on a slope under the centre panel with the throttle quadrant raised between them; on
    // the flat run behind, the FUEL CONTROL panel (L and R lift toggles), MCDU 3 with the speed
    // brake in its slot left of it and the flap lever in its gate right, the parking brake bar
    // along the left edge, a stowage pocket and the RAT handle in the right rail; then the
    // switch, cockpit call and trim panels and a three-cup tray at the aft end. The cursor
    // controllers sit on the sidewall armrests, not here.
    const top = Math.min(c.consoleY + 0.13, sy - 0.2),
      fore = z + 0.04,
      half = 0.215,
      yM = top - 0.1,
      zM = ez + 0.405,
      zF = z - 0.01,
      yF = top + 0.01,
      aft = ez - 0.36;
    c.pedestal(
      [
        [aft, floor],
        [aft, yM - 0.03],
        [aft + 0.03, yM],
        [zM, yM],
        [zF, yF],
        [fore, yF],
        [fore, floor],
      ],
      half,
    );
    const mcdu = (k, x, v) => {
      k.box([0.145, 0.232, 0.012], [x, v, -0.006], m.bezel);
      c.screen(k, x, v + 0.062, -0.013, 0.094, 0.07, 'cdu');
      for (const u of [-1, 1])
        for (let r = 0; r < 4; r++)
          k.box([0.01, 0.007, 0.004], [x + u * 0.061, v + 0.038 + r * 0.016, -0.013], d.dark);
      for (let r = 0; r < 5; r++)
        for (let q = 0; q < 6; q++)
          k.box(
            [0.016, 0.012, 0.004],
            [x + (q - 2.5) * 0.021, v - 0.014 - r * 0.019, -0.013],
            d.dark,
          );
    };
    // The MCDU slope, its face-local y running up and forward.
    const tilt = Math.atan2(yF - yM, zF - zM),
      slopeLength = Math.hypot(yF - yM, zF - zM),
      mcduSlope = c.face(
        'g650-mcdu-slope',
        [0, (yM + yF) / 2 + 0.001 * Math.cos(tilt), (zM + zF) / 2 - 0.001 * Math.sin(tilt)],
        [Math.PI / 2 - tilt, 0, 0],
      );
    for (const x of [0.142, -0.142]) mcdu(mcduSlope, x, 0);
    // Display brightness strip at the top of the slope, between the MCDUs.
    const dim = slopeLength / 2 - 0.028;
    mcduSlope.box([0.12, 0.034, 0.004], [0, dim, -0.002], m.bezel);
    for (const x of [0.03, -0.03])
      mcduSlope.add(new T.CylinderGeometry(0.007, 0.007, 0.01, 14).rotateX(Math.PI / 2), P.black, [
        x,
        dim,
        -0.009,
      ]);
    // Throttle quadrant: a raised box between the MCDUs, the power levers in its two slots.
    const yQ = yM + 0.075;
    d.box([0.132, yQ - yM, 0.29], [0, (yM + yQ) / 2, ez + 0.445], m.console);
    for (const x of [0.045, -0.045])
      d.box([0.011, 0.002, 0.13], [x, yQ + 0.001, ez + 0.38], P.black);
    // Flat run, face-local y running forward.
    const quad = c.face('g650-quadrant', [0, yM + 0.001, 0], [Math.PI / 2, 0, 0]);
    quad.box([0.132, 0.095, 0.004], [0, ez + 0.255, -0.002], m.panel);
    c.text(quad, 'FUEL CONTROL', [0, ez + 0.288, -0.0045], 0.0055);
    for (const [i, x] of [0.035, -0.035].entries()) {
      quad.add(new T.CylinderGeometry(0.009, 0.009, 0.003, 14).rotateX(Math.PI / 2), P.alloy, [
        x,
        ez + 0.245,
        -0.0055,
      ]);
      c.text(quad, i ? 'R' : 'L', [x, ez + 0.27, -0.0045], 0.006);
      const run = c.control(`cockpit-engine-${i}`, [x, yM + 0.006, ez + 0.245], [0, 0, 0], {
        action: 'engine',
        engine: i,
        motion: rot('x', 0.6, -0.6),
      });
      fuelSwitch(run, P);
    }
    mcdu(quad, 0, ez + 0.095);
    // Speed brake slot left of MCDU 3 (RETRACT forward), flap gate right of it (UP forward).
    for (const x of [0.112, -0.112]) {
      quad.box([0.034, 0.23, 0.003], [x, ez + 0.14, -0.0015], m.panel);
      quad.box([0.009, 0.2, 0.002], [x, ez + 0.14, -0.0035], P.black);
    }
    c.text(quad, 'SPEED BRAKE', [0.112, ez + 0.017, -0.004], 0.005);
    for (const [label, at] of [
      ['UP', 0.215],
      ['10', 0.17],
      ['20', 0.13],
      ['DN', 0.075],
    ])
      c.text(quad, label, [-0.0865, ez + at, -0.004], 0.0055);
    const brake = c.control('cockpit-speedbrake', [0.112, yM + 0.004, ez + 0.19], [0, 0, 0], {
      action: 'speedBrake',
      motion: rot('x', -0.6),
    });
    speedBrakeLever(brake, P);
    const flap = c.control('cockpit-flaps', [-0.112, yM + 0.004, ez + 0.15], [0, 0, 0], {
      action: 'flaps',
      motion: rot('x', -0.7, 0.35),
    });
    flapLever(c, flap, P);
    // Right rail: the stowage pocket forward, the RAT handle in its well aft.
    d.box([0.058, 0.032, 0.31], [-0.185, yM + 0.016, ez + 0.145], m.console);
    d.box([0.042, 0.002, 0.1], [-0.185, yM + 0.0325, ez + 0.235], P.black);
    d.box([0.042, 0.002, 0.12], [-0.185, yM + 0.0325, ez + 0.085], P.black);
    d.add(bar([-0.185, yM + 0.038, ez + 0.04], [-0.185, yM + 0.038, ez + 0.12], 0.0045, 12), P.red);
    d.add(place(roundedBox([0.028, 0.012, 0.014], 0.004), [-0.185, yM + 0.038, ez + 0.125]), P.red);
    c.text(quad, 'RAT', [-0.185, ez + 0.02, -0.0335], 0.006);
    // Parking brake bar along the left edge. Its mount faces aft, so the handle's bound lift
    // (rotation about x) raises the grip end.
    const parkMount = c.face(
      'g650-park-brake-mount',
      [0.192, yM + 0.002, ez + 0.25],
      [0, Math.PI, 0],
    );
    const park = c.control(
      'cockpit-brake',
      [0, 0, 0],
      [0, 0, 0],
      { action: 'brake', motion: rot('x', -0.5) },
      parkMount.root.parent,
    );
    parkBrakeHandle(park, P);
    // Aft row: system switches over the cockpit call panel and satcom handset (left), the trim
    // panel (centre: roll rocker, rudder trim knob, backup pitch rocker), a plain lid (right).
    for (const v of [-0.0725, -0.1725])
      quad.box([0.13, 0.093, 0.003], [0.145, ez + v, -0.0015], m.panel);
    quad.box([0.142, 0.19, 0.003], [0, ez - 0.1225, -0.0015], m.panel);
    quad.box([0.13, 0.19, 0.003], [-0.145, ez - 0.1225, -0.0015], m.panel);
    for (const [x, v, material] of [
      [0.185, -0.045, d.dark],
      [0.185, -0.09, d.dark],
      [0.125, -0.045, d.dark],
      [0.1, -0.045, d.dark],
      [0.1, -0.09, m.amber],
      [0.19, -0.15, d.dark],
      [0.165, -0.15, d.dark],
      [0.19, -0.19, d.dark],
      [0.165, -0.19, d.dark],
      [-0.03, -0.06, d.dark],
    ])
      quad.box([0.017, 0.017, 0.007], [x, ez + v, -0.0035], material);
    c.text(quad, 'COCKPIT CALL', [0.145, ez - 0.133, -0.0035], 0.0045);
    quad.add(place(roundedBox([0.028, 0.066, 0.016], 0.006), [0.112, ez - 0.172, -0.008]), P.steel);
    c.text(quad, 'TRIM', [0, ez - 0.036, -0.0035], 0.0055);
    for (const [x, v] of [
      [0.04, -0.06],
      [0.026, -0.06],
      [-0.023, -0.14],
      [-0.037, -0.14],
    ])
      quad.add(place(roundedBox([0.012, 0.03, 0.012], 0.003), [x, ez + v, -0.006]), P.black);
    quad.add(
      place(
        lathe(
          [
            [0, 0],
            [0.014, 0],
            [0.012, 0.014],
            [0, 0.016],
          ],
          16,
        ),
        [0.03, ez - 0.135, -0.002],
        [-Math.PI / 2, 0, 0],
      ),
      P.black,
    );
    quad.box([0.004, 0.02, 0.004], [0.03, ez - 0.128, -0.0185], d.ivory);
    quad.add(new T.CylinderGeometry(0.008, 0.008, 0.006, 14).rotateX(Math.PI / 2), P.black, [
      0.03,
      ez - 0.18,
      -0.004,
    ]);
    quad.box([0.03, 0.012, 0.002], [-0.16, ez - 0.19, -0.004], d.dark);
    // Cupholder tray at the aft end: three steel cups in a moulded tray.
    d.add(place(roundedBox([0.43, 0.02, 0.14], 0.01), [0, yM + 0.002, aft + 0.07]), m.console);
    for (const x of [0.13, 0, -0.13]) {
      d.add(
        lathe(
          [
            [0.039, 0],
            [0.046, 0],
            [0.046, 0.003],
            [0.039, 0.003],
          ],
          20,
        ),
        P.alloy,
        [x, yM + 0.011, aft + 0.07],
      );
      d.add(new T.CylinderGeometry(0.039, 0.039, 0.002, 20), P.tread, [x, yM + 0.0125, aft + 0.07]);
    }
    // Outboard consoles, each with its nosewheel tiller and the armrest carrying that pilot's
    // cursor control device at its forward end.
    for (const side of [-1, 1]) {
      const inner = Math.abs(ex) + 0.27,
        consoleTop = ey - 0.66;
      c.sideConsole(side, { inner, top: consoleTop, aft: ez - 0.45, fore: ez + 0.5 });
      d.add(
        place(roundedBox([0.07, 0.035, 0.34], 0.014), [
          side * (inner + 0.04),
          consoleTop + 0.018,
          ez - 0.08,
        ]),
        m.padded,
      );
      cursorControl(d, P, [side * (inner + 0.04), consoleTop + 0.034, ez + 0.05]);
      d.add(
        lathe(
          [
            [0, 0],
            [0.05, 0],
            [0.05, 0.012],
            [0.04, 0.018],
            [0, 0.018],
          ],
          20,
        ),
        P.grip,
        [side * (Math.abs(ex) + 0.4), consoleTop, ez + 0.36],
      );
    }
    // Overhead. Its forward run slopes down to the windscreen header: exterior and cockpit
    // lights, anti-ice and windshield heat across the front, fuel and electrical behind.
    const header = o.z + o.depth / 2,
      drop = 0.095,
      run = 0.38,
      length = Math.hypot(run, drop),
      fwd = c.face(
        'g650-overhead-forward',
        [0, o.y - 0.0275 - drop / 2, header + run / 2],
        [-Math.PI / 2 + Math.atan2(drop, run), 0, Math.PI],
      );
    fwd.box([0.52, length, 0.05], [0, 0, 0.025], m.console);
    const front = length / 2 - 0.05;
    for (let r = 0; r < 2; r++)
      for (let q = 0; q < 6; q++)
        fwd.box([0.018, 0.016, 0.006], [-0.235 + q * 0.024, front - r * 0.024, -0.003], d.dark);
    for (let r = 0; r < 2; r++)
      fwd.box([0.018, 0.016, 0.006], [-0.075, front - r * 0.024, -0.003], d.dark);
    for (const [x, y] of [
      [-0.04, front],
      [-0.04, front - 0.026],
      [0.0, front - 0.012],
      [0.04, front],
      [0.04, front - 0.026],
    ])
      fwd.add(new T.CylinderGeometry(0.008, 0.008, 0.012, 12).rotateX(Math.PI / 2), P.black, [
        x,
        y,
        -0.006,
      ]);
    for (let r = 0; r < 2; r++)
      for (let q = 0; q < 4; q++)
        fwd.box(
          [0.018, 0.016, 0.006],
          [0.09 + q * 0.04, front - r * 0.024, -0.003],
          r === 1 && q === 0 ? m.cyan : m.amber,
        );
    // Behind them the wing and cowl anti-ice knobs, then electrical power (left), the fire
    // extinguisher and APU control (centre) and fuel (right).
    const knobs = front - 0.08;
    for (let q = 0; q < 4; q++)
      fwd.add(new T.CylinderGeometry(0.009, 0.009, 0.014, 12).rotateX(Math.PI / 2), P.black, [
        0.02 + q * 0.04,
        knobs,
        -0.007,
      ]);
    for (let r = 0; r < 3; r++)
      for (let q = 0; q < 4; q++) {
        const x = q < 2 ? -0.22 + q * 0.045 : 0.1 + q * 0.04,
          lit = (q + r) % 3 === 0 ? (q < 2 ? m.cyan : m.amber) : d.dark;
        fwd.box([0.018, 0.016, 0.006], [x, knobs - 0.06 - r * 0.05, -0.003], lit);
      }
    const apuAt = -0.15,
      fireAt = -0.03;
    fwd.box([0.05, 0.05, 0.003], [fireAt, apuAt, -0.0015], P.red);
    fwd.box([0.04, 0.04, 0.006], [fireAt, apuAt, -0.003], d.dark);
    for (const x of [0.08, 0.12]) fwd.box([0.018, 0.016, 0.006], [x, apuAt, -0.003], d.dark);
    c.text(fwd, 'APU', [0.03, apuAt + 0.032, -0.002], 0.008);
    // The APU master: a lit pushbutton on the sloping panel (face-local x is the body's -X, its
    // y runs forward and down the slope), its pivot just under the face.
    const slope = Math.atan2(drop, run),
      [sa, ca] = [Math.sin(slope), Math.cos(slope)],
      apu = c.control(
        'cockpit-engine-common',
        [
          -0.03,
          o.y - 0.0275 - drop / 2 - apuAt * sa - 0.003 * ca,
          header + run / 2 + apuAt * ca - 0.003 * sa,
        ],
        [-Math.PI / 2 + slope, 0, 0],
        {
          action: 'engine',
          motion: { property: 'position', axis: 'z', scale: 0.003 },
        },
      );
    stamp(apu, [0, 0, 0], [0, 0, 0], (t) =>
      switchGeometry(t, { style: 'korry', scale: 1.4, lit: P.lamp, palette: P }),
    );
    // Main overhead over the seats: system and fire test, the display-switching knobs, bleed air
    // and temperature; the circuit-breaker panels aft.
    const roof = c.face('g650-overhead', [0, o.y - 0.028, o.z], [-Math.PI / 2, 0, Math.PI]);
    for (let r = 0; r < 3; r++)
      for (let q = 0; q < 8; q++)
        if (r !== 2 || q % 2)
          roof.box(
            [0.022, 0.018, 0.006],
            [(q - 3.5) * (o.w / 9), 0.2 - r * 0.045, -0.003],
            q === 6 && r === 0 ? m.amber : d.dark,
          );
    for (const [x, y] of [
      [-0.03, 0.06],
      [0.03, 0.06],
      [-0.05, 0.01],
      [0.0, 0.01],
      [0.05, 0.01],
    ])
      roof.add(new T.CylinderGeometry(0.009, 0.009, 0.014, 12).rotateX(Math.PI / 2), P.black, [
        x,
        y,
        -0.007,
      ]);
    for (const [x, material] of [
      [0.17, m.amber],
      [0.21, d.dark],
      [0.25, m.amber],
    ])
      roof.box([0.022, 0.018, 0.006], [x, 0.04, -0.003], material);
    for (const side of [-1, 1])
      for (let r = 0; r < 3; r++)
        for (let q = 0; q < 5; q++)
          roof.box(
            [0.012, 0.012, 0.004],
            [side * (0.04 + q * 0.045), -0.09 - r * 0.05, -0.002],
            P.black,
          );
  },
};

const body = [
  [0.02, 0.05, 0.72, 0.78, 0.5],
  [0.05, 0.08, 0.71, 0.79, 0.5],
  [0.1, 0.13, 0.67, 0.83, 0.5],
  [0.2, 0.2, 0.61, 0.91, 0.5],
  [0.3, 0.25, 0.56, 0.96, 0.5],
  [0.5, 0.34, 0.49, 1.08, 0.5],
  [0.75, 0.45, 0.41, 1.22, 0.5],
  [1, 0.55, 0.35, 1.33, 0.5],
  [1.25, 0.64, 0.28, 1.5, 0.5],
  [1.5, 0.72, 0.23, 1.63, 0.5],
  [1.75, 0.8, 0.19, 1.8, 0.5],
  [2, 0.87, 0.15, 2, 0.5],
  [2.25, 0.94, 0.11, 2.15, 0.5],
  [2.5, 1, 0.08, 2.25, 0.5],
  [3, 1.12, 0.05, 2.41, 0.5],
  [3.5, 1.2, 0.02, 2.53],
  [4, 1.27, 0, 2.6],
  [4.5, 1.31, 0, 2.63],
  [5, 1.33, 0, 2.65],
  [6, 1.35, 0, 2.68],
  [10, 1.35, 0, 2.7],
  [19, 1.35, 0.04, 2.7],
  [20, 1.3, 0.25, 2.72],
  [21, 1.22, 0.55, 2.74],
  [22, 1.1, 0.85, 2.75],
  [23, 0.95, 1.1, 2.74],
  [24, 0.75, 1.4, 2.7],
  [25, 0.5, 1.72, 2.5],
  [25.75, 0.12, 2, 2.2],
];
const wingH = (x) => 0.3 + 0.1 * (x - 1.35);

export const g650 = {
  prefix: 'GLF6',
  length: 30.41,
  width: 2.7,
  bodyHeight: 2.7,
  // Keel set so the fin reaches the 7.82 m height; stands essentially level.
  stance: [0, 12, 1.55],
  midFraction: 0.5,
  bellyAngle: 2.1,
  bellyColor: '#d4d6d2',
  // Inside the flight deck the window posts are dark grey trim (EBACE 2018 photograph).
  windowTrim: '#55595c',
  body,
  deck: g650Deck,
  cockpit: {
    uStart: 1.7,
    uEnd: 3.47,
    centerPost: 2.3,
    low: [
      [1.6, 1.7],
      [1.86, 1.68],
      [2.6, 1.68],
      [3.47, 1.74],
      [3.9, 1.76],
    ],
    top: [
      [1.6, 2.1],
      [2.6, 2.16],
      [3.47, 2.18],
      [3.9, 2.18],
    ],
    arcs: [[1.7, 1.69]],
    posts: [
      [2.4, 2.6],
      [3, 3],
    ],
  },
  // No published eye position. Placed as on the Dash 8 and CJ4: forward in the side pane.
  eye: { u: 2.95, x: 0.44, h: 2, floor: 0.93, bulkhead: 5.45 },
  cabinWidth: 1.5,
  windows: {
    y: 1.68,
    w: 0.66,
    h: 0.43,
    oval: true,
    pitch: 1.3,
    runs: [{ from: 6.42, count: 8 }],
  },
  doors: [
    { u0: 4.4, u1: 5.28, y0: 0.35, y1: 2.42, corner: 0.2, side: 1 },
    { u0: 10.9, u1: 11.75, y0: 1.32, y1: 2.02, corner: 0.16 },
    { u0: 12.2, u1: 13.05, y0: 1.32, y1: 2.02, corner: 0.16 },
  ],
  seams: [1],
  wing: {
    // The winglet springs from this row and is built as its own node.
    tip: 14.2,
    rows: [
      [0.3, wingH(0.3), 8.6, 16.2, 0.36],
      [1.35, wingH(1.35), 9.4, 16.2, 0.34],
      [5.5, wingH(5.5), 12.4, 17, 0.2],
      [14.2, wingH(14.2), 18.7, 20.2, 0.07],
      [14.6, 1.8, 19.2, 20.5, 0.06],
      [14.85, 2.2, 19.9, 20.9, 0.05],
      [15.02, 2.8, 20.7, 21.4, 0.04],
      [15.18, 3.35, 21.4, 21.95, 0.015],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 1.5, to: 5.4, chord: 0.27 },
      { kind: 'flap', name: 'outer', from: 5.6, to: 10.5, chord: 0.28 },
      { kind: 'aileron', from: 10.7, to: 13.6, chord: 0.24 },
    ],
  },
  fin: {
    rows: [
      [2.4, 20.4, 25.6, 0.22],
      [2.75, 21, 25.85, 0.2],
      [3.11, 21.7, 26, 0.17],
      [4.18, 22.95, 26.4, 0.13],
      [5.1, 23.65, 26.75, 0.11],
      [6, 24.1, 27.2, 0.1],
      [6.26, 24.4, 27.3, 0.06],
    ],
    rudder: { from: 3.1, to: 5.85, chord: 0.33 },
    caps: [
      {
        name: 'fin-top-fairing',
        rows: [
          [23.9, 0.02, 6.1, 6.15],
          [24.6, 0.2, 5.98, 6.3],
          [26, 0.26, 5.98, 6.32],
          [27.6, 0.16, 6.02, 6.22],
          [28.6, 0.02, 6.1, 6.12],
        ],
      },
    ],
  },
  tailplane: {
    rows: [
      [0.2, 6.05, 24.35, 28, 0.16],
      [0.8, 6.08, 25.1, 28.1, 0.14],
      [5.4, 6.22, 29.5, 30.25, 0.05],
      [5.7, 6.25, 29.95, 30.41, 0.02],
    ],
    elevator: { from: 0.7, to: 5.3, chord: 0.33 },
  },
  fairings: [
    {
      name: 'belly-fairing',
      rows: [
        [9, 0.9, 0.1, 0.9],
        [10.5, 1.35, -0.35, 1.1],
        [12.5, 1.55, -0.6, 1.2],
        [14, 1.55, -0.63, 1.2],
        [15.5, 1.45, -0.55, 1.15],
        [17, 1.1, -0.25, 1],
        [18.5, 0.45, 0.25, 0.8],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 2.55,
    u: 18.25,
    h: 2.28,
    lip: [
      [0.3, 0.62, 0.62, 0.62],
      [0.08, 0.63, 0.63, 0.63],
      [0, 0.68, 0.68, 0.68],
      [0.06, 0.74, 0.74, 0.74],
      [0.2, 0.8, 0.8, 0.8],
    ],
    cowl: [
      [0.2, 0.8, 0.8, 0.8],
      [0.7, 0.86, 0.86, 0.86],
      [1.4, 0.86, 0.86, 0.86],
      [2.2, 0.78, 0.78, 0.78],
      [3, 0.6, 0.6, 0.6],
      [3.6, 0.45, 0.45, 0.45],
    ],
    duct: [
      [0.3, 0.62, 0.62, 0.62],
      [0.6, 0.62, 0.62, 0.62],
    ],
    fanAt: 0.55,
    fanRadius: 0.61,
    spinner: [0.18, 0.4],
    core: [
      [3.2, 0.4, 0],
      [3.75, 0.36, 0],
    ],
    plug: [
      [3.7, 0.2, 0],
      [4, 0.03, 0],
    ],
    pylonMaterial: 'paint',
    pylon: [
      [19.4, 0.02, 2.25, 2.3, -0.65],
      [19.9, 0.62, 2.06, 2.46, -0.65],
      [21, 0.65, 2.06, 2.46, -0.65],
      [21.6, 0.6, 2.1, 2.4, -0.65],
      [22.3, 0.02, 2.25, 2.3, -0.65],
    ],
  },
  gear: {
    // Stations read from the photograph; Gulfstream's figures were not found.
    // Pivots, rake and fold angles are set so the stowed legs and wheels lie inside the skin,
    // fairings and wing (checked against these tables); the fold doors are not modelled.
    nose: {
      u: 2.28,
      r: 0.3,
      w: 0.17,
      spread: 0.36,
      top: 1.7,
      strut: 0.07,
      hinge: -0.2,
      retract: 1.85,
    },
    main: {
      u: 15.2,
      x: 2.2,
      pivotX: 2.1,
      r: 0.5,
      w: 0.3,
      spread: 0.62,
      top: 1.95,
      hinge: 0.6,
      retract: 1.55,
      strut: 0.1,
    },
  },
};
export const g650Frame = () => transportFrame(g650);
export const buildG650 = (s) => buildTransport(s, g650);
