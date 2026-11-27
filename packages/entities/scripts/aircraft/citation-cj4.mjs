/** Cessna Citation CJ4 (525C), FJ44-4A. No dimensioned drawing was found: stations are read from
 * photograph D-CEFE, a three-quarter view from the ground at about 100 px/m near mid-body, with
 * its perspective slope removed along the keel. Overall length, span and height are published, as
 * are 30.66 m2 wing area and 12.5 degrees of sweep; the wheelbase and tread come from a dealer
 * listing. Treat this as a reconstruction, not a measured three-view.
 */
import {
  engineMasterGeometry,
  eyeballVentGeometry,
  flapSelectorGeometry,
  gearHandleGeometry,
  handleGeometry,
  parkingBrakeGeometry,
  place,
  roundedBox,
  switchGeometry,
} from './cockpit-parts.mjs';
import { controlColumn, controlWheel, stamp } from './transport-deck.mjs';
import { buildTransport, transportFrame } from './transport-kit.mjs';

const rot = (axis, scale, offset) => ({ property: 'rotation', axis, scale, offset });
/** CJ4 throttle: a flat arm raked aft to a wide T-handle, its thumb button on the inboard end. */
function throttle(k, P, side) {
  const arm = 0.13;
  k.add(
    place(roundedBox([0.01, arm, 0.018], 0.003, 1), [0, arm / 2, -0.006], [-0.09, 0, 0]),
    P.alloy,
  );
  k.add(
    place(
      roundedBox([0.04, 0.026, 0.032], 0.009),
      [-side * 0.005, arm + 0.006, -0.018],
      [-0.2, 0, 0],
    ),
    P.grip,
  );
  k.add(
    place(roundedBox([0.01, 0.008, 0.01], 0.002), [-side * 0.024, arm + 0.012, -0.024]),
    P.black,
  );
}

/** Flight deck after the Citation CJ4 cabin-to-cockpit photograph (JetRequest.com, CC BY-SA 3.0):
 * grey Pro Line 21 panel with four portrait displays, the standby and gear handle in the centre
 * strip; the two FMS units ahead of the throttle quadrant, speed brake left and flaps right of the
 * throttles; cream headliner and seats; ram's-horn wheels on floor columns. The engine start
 * buttons and battery switch sit low on the pilot's panel, the parking brake handle under it. */
const cj4Deck = {
  colors: {
    panel: '#6e787f',
    console: '#4a5156',
    glare: '#1d2023',
    lining: '#c9c2b2',
    floor: '#8a8377',
    seat: '#d3c9b1',
    bezel: '#7a838a',
  },
  seat: { width: 0.42, armrests: 1 },
  pedals: { style: 'airliner', scale: 0.85, lean: 0.34 },
  leverSpacing: 0.05,
  control(c, { P }) {
    controlWheel(c, P, {
      span: 0.27,
      horn: 0.1,
      cant: 0.3,
      grip: 0.015,
      drop: 0.005,
      hub: [0.11, 0.045, 0.04],
      heads: 0.85,
      flare: 1.1,
    });
  },
  column: (d, { P, x, floor, eye }) =>
    controlColumn(d, P, x, floor, eye, { radius: 0.022, boot: 0.05 }),
  powerLever(k, { P, index }) {
    throttle(k, P, index ? 1 : -1);
  },
  build(c) {
    const { d, m, P, sy, sz, floor, overhead: o } = c,
      [, , ez] = c.eye,
      z = sz;
    const W = 0.19,
      H = 0.235,
      Y = sy + 0.03;
    c.screen(d, 0.376, Y, z, W, H, 'pfd', { horizon: 'horizon-0' });
    c.screen(d, 0.157, Y, z, W, H, 'map');
    c.screen(d, -0.157, Y, z, W, H, 'synoptic');
    c.screen(d, -0.376, Y, z, W, H, 'pfd', { horizon: 'horizon-3' });
    // Centre strip: standby over the gear handle and its three greens.
    c.standby(d, 0, sy + 0.115, z, 0.058);
    d.box([0.07, 0.11, 0.005], [0, sy + 0.005, z - 0.0025], m.bezel);
    for (const y of [0.03, 0.005, -0.02])
      d.box([0.01, 0.01, 0.004], [-0.022, sy + y, z - 0.006], m.green);
    c.text(d, 'GEAR', [0.012, sy + 0.05, z - 0.006], 0.006);
    const gear = c.control('cockpit-gear', [0.012, sy, z - 0.006], [0, 0, 0], {
      action: 'gear',
      motion: rot('x', -0.7, 0.35),
    });
    stamp(gear, [0, 0, 0], [0, 0, 0], (t) =>
      gearHandleGeometry(t, { style: 'ga', scale: 1.5, palette: P }),
    );
    // Glareshield: the flight guidance controller between the display control panels.
    d.box([0.62, 0.062, 0.03], [0, sy + 0.2, z - 0.032], m.bezel);
    for (let q = 0; q < 9; q++)
      d.box([0.03, 0.014, 0.006], [(q - 4) * 0.06, sy + 0.21, z - 0.049], d.dark);
    for (const x of [-0.2, 0, 0.2]) c.tools.knob(x, sy + 0.185, z - 0.049, 0.009);
    for (const side of [-1, 1]) {
      d.box([0.11, 0.055, 0.026], [side * 0.39, sy + 0.195, z - 0.03], m.bezel);
      for (const dx of [-0.03, 0.03]) c.tools.knob(side * 0.39 + dx, sy + 0.19, z - 0.045, 0.008);
    }
    // Pilot's lower panel: engine start buttons and the battery switch; parking brake under it.
    for (const [i, x] of [0.44, 0.39].entries()) {
      c.text(d, `ENG ${i + 1}`, [x, sy - 0.118, z - 0.002], 0.0055);
      const start = c.control(`cockpit-engine-${i}`, [x, sy - 0.145, z - 0.001], [0, 0, 0], {
        action: 'engine',
        engine: i,
        motion: { property: 'position', axis: 'z', scale: 0.003 },
      });
      stamp(start, [0, 0, 0], [0, 0, 0], (t) =>
        engineMasterGeometry(t, { style: 'button', scale: 0.8, palette: P }),
      );
    }
    c.text(d, 'BATT', [0.31, sy - 0.118, z - 0.002], 0.0055);
    const batt = c.control('cockpit-engine-common', [0.31, sy - 0.145, z - 0.001], [0, 0, 0], {
      action: 'engine',
      motion: rot('x', 0.7, -0.7),
    });
    stamp(batt, [0, 0, 0], [0, 0, 0], (t) =>
      switchGeometry(t, { style: 'toggle', scale: 1.2, palette: P }),
    );
    d.box([0.08, 0.05, 0.05], [0.17, sy - 0.235, z - 0.0], m.console);
    c.text(d, 'PARK BRAKE', [0.17, sy - 0.222, z - 0.026], 0.0055);
    const park = c.control('cockpit-brake', [0.17, sy - 0.24, z - 0.025], [0, 0, 0], {
      action: 'brake',
      motion: { property: 'position', axis: 'z', scale: -0.025 },
    });
    stamp(park, [0, 0, 0], [0, 0, 0], (t) =>
      parkingBrakeGeometry(t, { style: 'tee', scale: 0.9, palette: P }),
    );
    // Pedestal: the FMS units laid back ahead of the quadrant, the narrow quadrant between the
    // seats with speed brake left and flaps right of the throttles, trim heads aft.
    const top = c.consoleY + 0.09,
      fore = z - 0.005,
      foreTop = sy - 0.105,
      joint = ez + 0.37;
    c.pedestal(
      [
        [joint, floor],
        [joint, top],
        [fore, foreTop],
        [fore, floor],
      ],
      0.125,
    );
    c.pedestal(
      [
        [ez - 0.3, floor],
        [ez - 0.3, top - 0.06],
        [ez - 0.26, top - 0.05],
        [ez + 0.05, top - 0.04],
        [ez + 0.12, top],
        [joint + 0.01, top],
        [joint + 0.01, floor],
      ],
      0.085,
    );
    const lean = Math.atan2(foreTop - top, fore - joint),
      slope = c.face(
        'cj4-pedestal-slope',
        [0, (top + foreTop) / 2 + 0.001, (joint + fore) / 2],
        [Math.PI / 2 - lean, 0, 0],
      );
    for (const x of [0.061, -0.061]) {
      slope.box([0.118, 0.19, 0.01], [x, 0, -0.005], m.bezel);
      c.screen(slope, x, 0.045, -0.011, 0.09, 0.055, 'cdu', { bezel: m.bezel });
      for (let r = 0; r < 4; r++)
        for (let q = 0; q < 5; q++)
          slope.box(
            [0.014, 0.011, 0.004],
            [x + (q - 2) * 0.019, -0.022 - r * 0.018, -0.012],
            d.dark,
          );
    }
    const quad = c.face('cj4-quadrant', [0, top + 0.001, 0], [Math.PI / 2, 0, 0]);
    for (const x of [0.025, -0.025]) quad.box([0.009, 0.12, 0.003], [x, ez + 0.36, 0], P.black);
    for (const x of [0.07, -0.07]) quad.box([0.009, 0.1, 0.003], [x, ez + 0.28, 0], P.black);
    c.text(quad, 'SPD BRK', [0.058, ez + 0.2, -0.002], 0.006);
    c.text(quad, 'FLAPS', [-0.058, ez + 0.2, -0.002], 0.006);
    c.text(quad, 'THROTTLE', [0, ez + 0.275, -0.002], 0.006);
    const brake = c.control('cockpit-speedbrake', [0.07, top, ez + 0.27], [0, 0, 0], {
      action: 'speedBrake',
      motion: rot('x', -0.6),
    });
    stamp(brake, [0, 0, 0], [0, 0, 0], (t) =>
      handleGeometry(t, { style: 'lever', height: 0.06, scale: 0.8, palette: P }),
    );
    const flap = c.control('cockpit-flaps', [-0.07, top, ez + 0.28], [0, 0, 0], {
      action: 'flaps',
      motion: rot('x', -0.7, 0.35),
    });
    stamp(flap, [0, 0, 0], [0, 0, 0], (t) =>
      flapSelectorGeometry(t, {
        style: 'lever',
        height: 0.06,
        scale: 0.7,
        palette: { ...P, white: P.alloy },
      }),
    );
    const aft = c.face('cj4-pedestal-aft', [0, top - 0.039, ez - 0.1], [Math.PI / 2 - 0.04, 0, 0]);
    aft.box([0.14, 0.26, 0.008], [0, 0, -0.004], m.bezel);
    for (const [x, y] of [
      [-0.035, 0.06],
      [0.035, 0.06],
      [0, -0.05],
    ])
      aft.box([0.022, 0.022, 0.012], [x, y, -0.012], d.dark);
    // Overhead: lights and the cabin air outlets.
    const roof = c.face('cj4-overhead', [0, o.y - 0.028, o.z], [-Math.PI / 2, 0, Math.PI]);
    for (let q = 0; q < 6; q++)
      roof.box([0.016, 0.02, 0.012], [(q - 2.5) * 0.06, 0.1, -0.006], d.dark);
    for (const x of [-0.18, 0.18])
      stamp(roof, [x, -0.08, 0], [0, 0, 0], (t) =>
        eyeballVentGeometry(t, { radius: 0.03, palette: P }),
      );
  },
};

const body = [
  [0.02, 0.07, 0.42, 0.53, 0.5],
  [0.05, 0.11, 0.37, 0.58, 0.5],
  [0.2, 0.18, 0.3, 0.68, 0.5],
  [0.55, 0.33, 0.16, 0.86, 0.5],
  [1.15, 0.47, 0.09, 1.04, 0.5],
  [1.75, 0.57, 0.04, 1.2, 0.5],
  [2.25, 0.66, 0.01, 1.41, 0.5],
  [2.55, 0.71, 0, 1.6, 0.5],
  [3, 0.76, 0, 1.72],
  [3.5, 0.8, 0, 1.75],
  [4, 0.81, 0, 1.75],
  [8.5, 0.81, 0, 1.75],
  [9.5, 0.79, 0.08, 1.75],
  [10.5, 0.72, 0.2, 1.74],
  [11.5, 0.61, 0.38, 1.7],
  [12.5, 0.46, 0.8, 1.6],
  [13.3, 0.12, 1.28, 1.5],
];
const wingH = (x) => 0.15 + 0.07 * (x - 0.81);
const fin = (photo) => photo * 1.06;

export const cj4 = {
  prefix: 'C25C',
  length: 16.26,
  width: 1.62,
  bodyHeight: 1.75,
  compactDeck: true,
  stance: [0, 8, 0.65],
  midFraction: 0.5,
  bellyAngle: 2.05,
  bellyColor: '#cfd1cf',
  body,
  deck: cj4Deck,
  cockpit: {
    // N194ME (side, FDK): a two-piece windshield and one side window, split by a raked pillar,
    // the side window ending about 0.7 m ahead of the door with plain skin between. An extra
    // aft pane to the door, and a top edge hard under the crown, had read as a glass canopy.
    uStart: 1.8,
    uEnd: 3.1,
    centerPost: 2.53,
    low: [
      [1.7, 1.2],
      [2, 1.16],
      [2.4, 1.12],
      [2.9, 1.1],
      [3.4, 1.12],
      [3.8, 1.12],
    ],
    // The header crosses the crown at about u 2.5; aft of it the side window top runs a hand
    // under the roof, which rises on over the cabin.
    top: [
      [1.7, 1.6],
      [2.5, 1.57],
      [2.9, 1.55],
      [3.1, 1.55],
      [3.8, 1.55],
    ],
    arcs: [[1.8, 1.19]],
    posts: [[2.28, 2.58]],
  },
  // No published eye position. The pilot's head shows in the side pane in D-CEFE, about u 3.
  eye: { u: 3, x: 0.3, h: 1.42, floor: 0.42, bulkhead: 5.2 },
  cabinWidth: 1.02,
  windows: {
    y: 1.18,
    w: 0.26,
    h: 0.37,
    corner: 0.6,
    pitch: 0.5,
    // N194ME and OE-GTI: five evenly spaced windows aft of the door each side, plus one on the
    // right opposite the door. The left side has none ahead of the five.
    runs: [
      { from: 4.03, count: 1, side: -1 },
      { from: 4.95, count: 5, pitch: 0.51 },
    ],
  },
  doors: [
    { u0: 3.77, u1: 4.43, y0: 0.32, y1: 1.5, corner: 0.14, side: 1 },
    { u0: 7.93, u1: 8.4, y0: 0.74, y1: 1.46, corner: 0.1 },
  ],
  seams: [0.9],
  wing: {
    rows: [
      [0.2, wingH(0.2), 5.85, 8.85, 0.2],
      [0.81, wingH(0.81), 6, 8.85, 0.19],
      [2.6, wingH(2.6), 6.5, 8.85, 0.15],
      [7.4, wingH(7.4), 7.85, 8.95, 0.055],
      [7.6, 0.68, 8.1, 9, 0.045],
      [7.745, 0.84, 8.45, 9.1, 0.02],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 0.95, to: 4.6, chord: 0.27 },
      { kind: 'aileron', from: 4.8, to: 7, chord: 0.27 },
    ],
  },
  fin: {
    rows: [
      [1.4, 10.4, 13.1, 0.16],
      [fin(1.72), 10.85, 13.25, 0.15],
      [fin(2.82), 12.1, 13.9, 0.1],
      [fin(3.3), 12.65, 14.25, 0.085],
      [fin(3.75), 13.1, 14.5, 0.05],
    ],
    rudder: { from: fin(1.85), to: fin(3.4), chord: 0.3 },
    caps: [
      {
        name: 'fin-top-fairing',
        rows: [
          [13, 0.02, 3.85, 3.9],
          [13.5, 0.12, 3.78, 3.98],
          [14.4, 0.12, 3.78, 4],
          [15.1, 0.02, 3.85, 3.88],
        ],
      },
    ],
  },
  tailplane: {
    rows: [
      [0.1, 3.8, 13, 14.7, 0.09],
      [0.4, 3.82, 13.3, 14.75, 0.085],
      [2.9, 3.95, 15.3, 16, 0.035],
      [3.1, 3.97, 15.7, 16.26, 0.02],
    ],
    elevator: { from: 0.4, to: 2.85, chord: 0.33 },
  },
  fairings: [
    {
      name: 'wing-body-fairing',
      rows: [
        [5.4, 0.6, 0.1, 0.6],
        [6.4, 0.85, -0.07, 0.7],
        [8, 0.9, -0.07, 0.7],
        [9.2, 0.6, 0.1, 0.6],
        [9.9, 0.2, 0.3, 0.5],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 1.5,
    u: 9,
    h: 1.3,
    lip: [
      [0.25, 0.36, 0.36, 0.36],
      [0.06, 0.37, 0.37, 0.37],
      [0, 0.41, 0.41, 0.41],
      [0.04, 0.45, 0.45, 0.45],
      [0.12, 0.48, 0.48, 0.48],
    ],
    cowl: [
      [0.12, 0.48, 0.48, 0.48],
      [0.5, 0.52, 0.52, 0.52],
      [1.1, 0.52, 0.52, 0.52],
      [1.7, 0.46, 0.46, 0.46],
      [2.2, 0.34, 0.34, 0.34],
      [2.6, 0.24, 0.24, 0.24],
    ],
    duct: [
      [0.25, 0.36, 0.36, 0.36],
      [0.45, 0.36, 0.36, 0.36],
    ],
    fanAt: 0.42,
    fanRadius: 0.35,
    spinner: [0.12, 0.25],
    core: [
      [2.3, 0.2, 0],
      [2.58, 0.18, 0],
    ],
    plug: [
      [2.58, 0.12, 0],
      [2.8, 0.01, 0],
    ],
    pylonMaterial: 'paint',
    pylon: [
      [9.9, 0.02, 1.25, 1.3, -0.35],
      [10.3, 0.34, 1.16, 1.44, -0.35],
      [11, 0.36, 1.16, 1.44, -0.35],
      [11.4, 0.02, 1.25, 1.3, -0.35],
    ],
  },
  gear: {
    // Wheelbase 6.45 m and tread 3.76 m from a dealer listing; single wheels per the photograph.
    // Stowed, the nose leg lies inside the nose and the mains in the wing root, their tyres just
    // proud of the lower skin as on the real airplane, whose main wheels show in flight.
    nose: { u: 1.5, r: 0.2, w: 0.13, top: 0.9, strut: 0.05, retract: 1.7 },
    main: {
      u: 7.95,
      x: 1.88,
      pivotX: 1.85,
      r: 0.29,
      w: 0.17,
      top: 0.9,
      retract: 1.5,
      strut: 0.065,
    },
  },
};
export const cj4Frame = () => transportFrame(cj4);
export const buildCJ4 = (s) => buildTransport(s, cj4);
