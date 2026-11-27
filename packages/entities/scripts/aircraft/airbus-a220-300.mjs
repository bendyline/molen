/** Airbus A220-300 (BD-500-1A11), PW1500G.
 * The Airbus ACP (Oct 2026) tabulates locators A to BB, but in the PDF as published its dimension
 * figures have no line art: only the letters render. So dimensions come from the tables, with each
 * letter identified by where its label sits on the blank figure, and the fuselage outline comes
 * from a near-orthographic side-on photograph (airBaltic CS300 YL-CSA) at 43.65 px/m, a scale the
 * 38.69 m length and the 15.31 m wheelbase each give independently.
 * Identifying M 13.04, J 19.89, G 21.79 and F 24.42 m as wing stations gives a planform of
 * 111.4 m2 against the published 112.3 m2, which is why those readings were kept.
 */
import {
  bar,
  contour,
  flapSelectorGeometry,
  gearHandleGeometry,
  handleGeometry,
  lathe,
  loftUp,
  parkingBrakeGeometry,
  place,
  roundedBox,
  stickGeometry,
  switchGeometry,
} from './cockpit-parts.mjs';
import { T } from './mesh-kit.mjs';
import { stamp } from './transport-deck.mjs';
import { buildTransport, canoe, transportFrame } from './transport-kit.mjs';

/** A220 thrust lever: a flat arm raked aft to a cream paddle grip, the A/T disconnect button on
 * its outboard face. */
function thrustLever(k, { P, side }) {
  const rake = -0.1,
    arm = 0.2,
    top = [0, arm * Math.cos(rake), arm * Math.sin(rake)];
  k.add(
    place(roundedBox([0.012, arm, 0.022], 0.003, 1), [0, arm / 2, top[2] / 2], [rake, 0, 0]),
    P.alloy,
  );
  k.add(
    place(
      loftUp([
        { y: -0.012, points: contour(0, 0, 0.012, 0.014, 16, 2.6) },
        { y: 0.004, points: contour(0, 0.002, 0.026, 0.02, 16, 2.8) },
        { y: 0.034, points: contour(0, 0.004, 0.028, 0.022, 16, 3) },
        { y: 0.046, points: contour(0, 0.002, 0.02, 0.016, 16, 2.6) },
      ]),
      top,
      [rake, 0, 0],
    ),
    P.white,
  );
  k.add(
    place(
      new T.CylinderGeometry(0.006, 0.006, 0.005, 14),
      [side * 0.028, top[1] + 0.024, top[2]],
      [0, 0, Math.PI / 2],
    ),
    P.black,
  );
}

const rot = (axis, scale, offset) => ({ property: 'rotation', axis, scale, offset });
/** Flight deck after the JetBlue A220-300 cockpit photograph (airbus777, CC BY 2.0): light grey
 * shell and pedestal, four 15.1 in displays across the panel with the standby, gear lever and
 * autobrake in the centre strip, the fifth display on the pedestal ahead of the thrust levers,
 * speed brake left and flap lever right of them, side-sticks and the captain's tiller outboard. */
const a220Deck = {
  colors: {
    // The A220's light grey flight deck (Commons JetBlue A220 cockpit photographs).
    panel: '#b3b9bc',
    console: '#a9afb1',
    glare: '#2a2f32',
    lining: '#c3c7c6',
    floor: '#3b4043',
    seat: '#6f767b',
    bezel: '#555c60',
  },
  pedals: { style: 'airliner', scale: 1 },
  leverSpacing: 0.09,
  // Side-sticks on the outboard consoles, well outboard of the seat.
  controlX: (x) => Math.sign(x) * (Math.abs(x) + 0.37),
  control(c, { P }) {
    stamp(c, [0, -0.035, 0], [0, 0, 0], (t) =>
      stickGeometry(t, { style: 'airbus', height: 0.06, shaft: 0.012, boot: false, palette: P }),
    );
  },
  column(d, { x, eye: [, ey, ez], P }) {
    d.add(
      lathe(
        [
          [0, 0],
          [0.045, 0],
          [0.044, 0.008],
          [0.032, 0.014],
          [0.028, 0.026],
          [0.016, 0.034],
          [0, 0.034],
        ],
        18,
      ),
      P.tread,
      [x, ey - 0.6, ez + 0.3],
    );
  },
  powerLever: (k, ctx) => thrustLever(k, ctx),
  build(c) {
    const { d, m, P, sy, sz, floor, overhead: o } = c,
      [ex, ey, ez] = c.eye,
      z = sz;
    // Four displays across; the inboard pair are EICAS (left) and the first officer's MFD.
    const W = 0.33,
      H = 0.25,
      Y = sy + 0.03;
    c.screen(d, 0.607, Y, z, W, H, 'pfd', { horizon: 'horizon-0' });
    c.screen(d, 0.242, Y, z, W, H, 'eicas');
    c.screen(d, -0.242, Y, z, W, H, 'map');
    c.screen(d, -0.607, Y, z, W, H, 'pfd', { horizon: 'horizon-4' });
    // Centre strip: standby, the gear lever on its own plate, autobrake.
    c.standby(d, 0, sy + 0.12, z, 0.08);
    d.box([0.1, 0.13, 0.006], [0, sy - 0.035, z - 0.003], m.bezel);
    for (const x of [-0.025, 0, 0.025])
      d.box([0.012, 0.01, 0.004], [x, sy + 0.012, z - 0.007], m.green);
    c.text(d, 'LDG GEAR', [0, sy - 0.092, z - 0.007], 0.007);
    const gear = c.control('cockpit-gear', [0, sy - 0.035, z - 0.006], [0, 0, 0], {
      action: 'gear',
      motion: rot('x', -0.7, 0.35),
    });
    stamp(gear, [0, 0, 0], [0, 0, 0], (t) =>
      gearHandleGeometry(t, { style: 'jet', scale: 0.85, palette: P }),
    );
    c.tools.knob(0, sy - 0.14, z - 0.004, 0.012);
    c.text(d, 'AUTOBRAKE', [0, sy - 0.165, z - 0.004], 0.006);
    // Glareshield: flight control panel in the middle, EFIS and radio heads either side.
    const fcp = Math.min(1.56, c.panelWidth - 0.2);
    d.box([fcp, 0.075, 0.034], [0, sy + 0.205, z - 0.035], m.bezel);
    for (let i = 0; i < 4; i++) {
      const x = (1.5 - i) * 0.085;
      d.box([0.05, 0.016, 0.002], [x, sy + 0.222, z - 0.053], m.amber);
      c.tools.knob(x, sy + 0.19, z - 0.058, 0.011);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        c.tools.knob(side * (0.42 + i * 0.07), sy + 0.195, z - 0.058, 0.009);
      d.box([0.09, 0.024, 0.002], [side * 0.65, sy + 0.215, z - 0.053], m.green);
      for (let i = 0; i < 4; i++)
        d.box([0.016, 0.01, 0.004], [side * (0.27 + i * 0.024), sy + 0.222, z - 0.054], d.dark);
    }
    // Pedestal: the fifth display ahead of the quadrant, the thrust levers in their slots, speed
    // brake and flap levers either side, run switches and keypads aft.
    const top = Math.min(c.consoleY + 0.14, sy - 0.215),
      half = 0.2,
      fore = z + 0.05,
      quad = ez + 0.47;
    c.pedestal(
      [
        [ez - 0.34, floor],
        [ez - 0.34, top - 0.03],
        [ez - 0.31, top],
        [fore, top],
        [fore, floor],
      ],
      half,
    );
    // Laid back toward the crew on a wedge housing.
    const display = c.face(
      'a220-pedestal-display',
      [0, top + 0.035, (quad + fore) / 2 - 0.01],
      [Math.PI / 2 - 0.35, 0, 0],
    );
    c.screen(display, 0, 0, 0, 0.3, 0.15, 'synoptic');
    display.box([0.32, 0.17, 0.05], [0, 0, 0.04], m.console);
    const deck = c.face('a220-quadrant', [0, top + 0.001, 0], [Math.PI / 2, 0, 0]);
    for (const x of [-0.045, 0.045]) deck.box([0.014, 0.19, 0.004], [x, ez + 0.375, 0], P.black);
    for (const x of [-0.15, 0.15]) deck.box([0.012, 0.12, 0.004], [x, ez + 0.36, 0], P.black);
    c.text(deck, 'SPD BRK', [0.15, ez + 0.28, -0.003], 0.008);
    c.text(deck, 'FLAP', [-0.15, ez + 0.28, -0.003], 0.008);
    for (const [i, x] of [0.045, -0.045].entries()) {
      c.text(deck, `ENG ${i + 1}`, [x, ez + 0.2, -0.003], 0.008);
      const run = c.control(
        `cockpit-engine-${i}`,
        [x, top + 0.003, ez + 0.24],
        [Math.PI / 2, 0, 0],
        {
          action: 'engine',
          engine: i,
          motion: rot('x', 0.7, -0.7),
        },
      );
      stamp(run, [0, 0, 0], [0, 0, 0], (t) =>
        switchGeometry(t, { style: 'toggle', scale: 1.6, palette: P }),
      );
    }
    for (const x of [-0.12, 0.12]) {
      deck.box([0.13, 0.2, 0.012], [x, ez + 0.02, -0.006], m.bezel);
      for (let r = 0; r < 5; r++)
        for (let q = 0; q < 3; q++)
          deck.box(
            [0.03, 0.016, 0.006],
            [x + (q - 1) * 0.038, ez - 0.05 + r * 0.03, -0.014],
            d.dark,
          );
    }
    const brake = c.control('cockpit-speedbrake', [0.15, top, ez + 0.33], [0, 0, 0], {
      action: 'speedBrake',
      motion: rot('x', -0.6),
    });
    stamp(brake, [0, 0, 0], [0, 0, 0], (t) =>
      handleGeometry(t, { style: 'lever', height: 0.085, palette: P }),
    );
    const flap = c.control('cockpit-flaps', [-0.15, top, ez + 0.36], [0, 0, 0], {
      action: 'flaps',
      motion: rot('x', -0.7, 0.35),
    });
    stamp(flap, [0, 0, 0], [0, 0, 0], (t) =>
      flapSelectorGeometry(t, { style: 'lever', height: 0.085, palette: { ...P, white: P.grip } }),
    );
    // Parking brake: the rotary handle low on the centre panel, left of the pedestal.
    d.box([0.1, 0.075, 0.07], [0.28, sy - 0.25, z - 0.005], m.console);
    c.text(d, 'PARK BRAKE', [0.28, sy - 0.222, z - 0.042], 0.006);
    const park = c.control('cockpit-brake', [0.28, sy - 0.258, z - 0.041], [-Math.PI / 2, 0, 0], {
      action: 'brake',
      motion: rot('y', 1.57),
    });
    stamp(park, [0, 0, 0], [0, 0, 0], (t) =>
      parkingBrakeGeometry(t, { style: 'rotary', scale: 0.9, palette: P }),
    );
    // Outboard consoles with the side-sticks, padded armrests and the captain's tiller.
    for (const side of [-1, 1]) {
      const inner = Math.abs(ex) + 0.28,
        consoleTop = ey - 0.6;
      c.sideConsole(side, { inner, top: consoleTop, aft: ez - 0.45, fore: ez + 0.52 });
      d.add(
        place(roundedBox([0.075, 0.04, 0.36], 0.015), [
          side * (inner + 0.045),
          consoleTop + 0.02,
          ez - 0.08,
        ]),
        m.padded,
      );
      d.box(
        [0.11, 0.004, 0.13],
        [side * (Math.abs(ex) + 0.37), consoleTop + 0.002, ez + 0.3],
        m.bezel,
      );
    }
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
      [Math.abs(ex) + 0.5, ey - 0.6, ez + 0.44],
    );
    d.add(
      bar(
        [Math.abs(ex) + 0.5, ey - 0.58, ez + 0.44],
        [Math.abs(ex) + 0.535, ey - 0.56, ez + 0.44],
        0.008,
        12,
      ),
      P.grip,
    );
    // Overhead: APU and system panels in rows of lit pushbuttons.
    // The face is turned so its lettering reads from the seat: local +Y runs forward, -X is left.
    const roof = c.face('a220-overhead', [0, o.y - 0.028, o.z], [-Math.PI / 2, 0, Math.PI]);
    for (let r = 0; r < 6; r++)
      for (let q = 0; q < 9; q++)
        if ((r + q) % 3)
          roof.box(
            [0.022, 0.022, 0.008],
            [(q - 4) * (o.w / 10), -0.2 + r * 0.08, -0.004],
            (r * 9 + q) % 7 ? d.dark : m.bezel,
          );
    c.text(roof, 'APU', [-0.06, -0.21, -0.002], 0.009);
    const apu = c.control(
      'cockpit-engine-common',
      [0.06, o.y - 0.032, o.z - 0.24],
      [-Math.PI / 2, 0, 0],
      {
        action: 'engine',
        motion: { property: 'position', axis: 'z', scale: 0.003 },
      },
    );
    stamp(apu, [0, 0, 0], [0, 0, 0], (t) =>
      switchGeometry(t, { style: 'korry', scale: 1.4, lit: P.lamp, palette: P }),
    );
  },
};

const body = [
  // Above u 1.25 the crown is read by eye off the photograph: the glazing defeats edge tracing.
  [0.02, 0.09, 1.05, 1.2, 0.5],
  [0.05, 0.13, 1.01, 1.26, 0.5],
  [0.1, 0.22, 0.96, 1.33, 0.5],
  [0.2, 0.35, 0.87, 1.44, 0.5],
  [0.3, 0.46, 0.82, 1.53, 0.5],
  [0.5, 0.62, 0.72, 1.7, 0.5],
  [0.75, 0.79, 0.57, 1.88, 0.5],
  [1, 0.93, 0.45, 2.02, 0.5],
  [1.25, 1.04, 0.35, 2.15, 0.5],
  [1.5, 1.14, 0.27, 2.35, 0.5],
  [2, 1.33, 0.17, 2.62, 0.5],
  [2.34, 1.43, 0.12, 2.84, 0.5],
  [2.5, 1.48, 0.1, 2.95, 0.5],
  [3, 1.6, 0.05, 3.16],
  [3.5, 1.7, 0.02, 3.37],
  [4, 1.77, 0, 3.51],
  [4.5, 1.81, 0, 3.6],
  [5, 1.82, 0, 3.67],
  [6, 1.86, 0, 3.72],
  [26, 1.86, 0, 3.72],
  [27, 1.84, 0.07, 3.72],
  [28, 1.8, 0.2, 3.72],
  [29, 1.71, 0.37, 3.72],
  [30, 1.6, 0.56, 3.72],
  [31, 1.48, 0.77, 3.72],
  [32, 1.35, 1, 3.72],
  [33, 1.19, 1.24, 3.71],
  [34, 1.02, 1.5, 3.68],
  [35, 0.85, 1.78, 3.62],
  [36, 0.66, 2.08, 3.55],
  [37, 0.48, 2.37, 3.45],
  [38, 0.28, 2.66, 3.3],
  [38.69, 0.1, 2.9, 3.12],
];
const wingH = (x) => 0.95 + 0.112 * (x - 1.86);
const tailH = (x) => 2.42 + 0.115 * x;
// Fin read at 5.46 m crown height in the photograph and scaled so its top lands on locator R.
const fin = (photo) => 3.72 + (photo - 5.46) * 1.056;

export const a220 = {
  prefix: 'BCS3',
  length: 38.69,
  width: 3.72,
  bodyHeight: 3.72,
  // Locator AA gives the static attitude directly: 0.477 degrees nose down. Locator A, fuselage
  // top, is 5.38 to 5.48 m, which puts a 3.72 m body 1.74 m off the ground.
  stance: [0.00833, 12, 1.74],
  midFraction: 0.5,
  bellyAngle: 1.95,
  body,
  deck: a220Deck,
  cockpit: {
    uStart: 1.25,
    uEnd: 3.2,
    centerPost: 2.13,
    low: [
      [1.1, 2.13],
      [1.26, 2.13],
      [1.8, 2.16],
      [2.4, 2.2],
      [3.2, 2.24],
      [3.6, 2.26],
    ],
    // The photograph's side window top stands near 2.8, but this elliptical section then carries
    // the glass over the head: 2.71 gives the pilot about the published 25 degrees up.
    top: [
      [1.1, 2.71],
      [3.6, 2.71],
    ],
    posts: [[2.3, 2.34]],
  },
  // ACP 'Visibility from cockpit': eye 2.6 m aft of the nose tip, 0.5 m off the centerline; 17
  // degrees down, 25 up.
  eye: { u: 2.6, x: 0.5, h: 2.5, floor: 1.45, bulkhead: 5.2 },
  cabinWidth: 1.9,
  windows: {
    y: 2.47,
    w: 0.28,
    h: 0.45,
    pitch: 0.87,
    runs: [
      { from: 6.9, count: 10 },
      { from: 16.75, count: 14 },
    ],
  },
  doors: [
    { u0: 4.92, u1: 5.96, y0: 1.37, y1: 3.25, corner: 0.17 },
    { u0: 29.67, u1: 30.65, y0: 1.37, y1: 3.25, corner: 0.17 },
    { u0: 15.49, u1: 16.08, y0: 1.9, y1: 2.95 },
    { u0: 8, u1: 9.3, y0: 0.2, y1: 1.2, side: -1 },
    { u0: 23.6, u1: 24.9, y0: 0.2, y1: 1.2, side: -1 },
  ],
  seams: [1.1],
  wing: {
    // The winglet springs from this row and is built as its own node.
    tip: 16.8,
    rows: [
      [0.3, wingH(0.3), 12.25, 19.89, 0.38],
      [1.86, wingH(1.86), 13.04, 19.89, 0.35],
      [6, wingH(6), 15.15, 19.89, 0.22],
      [16.8, 2.62, 20.66, 21.79, 0.07],
      [17.1, 2.84, 20.95, 22.1, 0.065],
      [17.3, 3.2, 21.6, 22.6, 0.055],
      [17.45, 3.7, 22.6, 23.4, 0.04],
      [17.54, 4.14, 23.7, 24.42, 0.02],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 2, to: 5.9, chord: 0.28 },
      { kind: 'flap', name: 'outer', from: 6.1, to: 13, chord: 0.29 },
      { kind: 'aileron', from: 13.2, to: 16.2, chord: 0.23 },
    ],
    pods: [
      { x: 5.8, rows: canoe(18.8, 2.4, 0.8) },
      { x: 9, rows: canoe(19.2, 2.4, 0.8) },
      { x: 12, rows: canoe(19.6, 2.3, 0.75) },
    ],
  },
  fin: {
    rows: [
      [3.2, 29.4, 36.3, 0.34],
      [3.72, 30, 36.5, 0.3],
      [fin(6.05), 31.6, 36.75, 0.2],
      [fin(6.96), 32.8, 36.95, 0.16],
      [fin(8.34), 34.1, 37.2, 0.125],
      [fin(11.0), 35.85, 37.73, 0.07],
      [fin(11.13), 36.3, 37.8, 0.03],
    ],
    rudder: { from: fin(5.7), to: fin(11.05), chord: 0.33 },
  },
  tailplane: {
    rows: [
      [0.3, tailH(0.3), 33.6, 36.2, 0.16],
      [0.6, tailH(0.6), 33.75, 36.21, 0.155],
      [5.8, tailH(5.8), 36.25, 37.7, 0.05],
      [6.13, tailH(6.13), 36.65, 37.83, 0.025],
    ],
    elevator: { from: 0.7, to: 5.75, chord: 0.34 },
  },
  fairings: [
    {
      name: 'wing-body-fairing',
      rows: [
        [10.8, 0.9, 0.35, 0.95],
        [12, 1.5, 0.1, 1.3],
        [14, 2, -0.02, 1.45],
        [16, 2.15, -0.06, 1.5],
        [18, 2.15, -0.06, 1.5],
        [20, 2, 0, 1.45],
        [22, 1.4, 0.2, 1.25],
        [23.4, 0.4, 0.5, 0.9],
      ],
    },
  ],
  engine: {
    kind: 'turbofan',
    x: 4.75,
    u: 12.17,
    h: 0.1,
    // Locator G: 0.58 to 0.66 m under the nacelle. The photograph gives a pod about 2.45 m deep.
    lip: [
      [0.5, 0.94, 0.94, 0.94],
      [0.12, 0.94, 0.94, 0.94],
      [0, 1.02, 1.02, 1.02],
      [0.07, 1.1, 1.1, 1.1],
      [0.22, 1.16, 1.16, 1.16],
    ],
    cowl: [
      [0.22, 1.16, 1.16, 1.16],
      [0.7, 1.22, 1.22, 1.22],
      [1.4, 1.24, 1.24, 1.24],
      [2.2, 1.22, 1.2, 1.22],
      [3, 1.1, 1.06, 1.1],
      [3.75, 0.86, 0.82, 0.86],
    ],
    duct: [
      [0.5, 0.94, 0.94, 0.94],
      [0.82, 0.94, 0.94, 0.94],
    ],
    fanAt: 0.75,
    fanRadius: 0.92,
    spinner: [0.3, 0.6],
    blades: 18,
    core: [
      [3, 0.7, -0.06],
      [3.75, 0.52, -0.08],
      [4.4, 0.4, -0.1],
    ],
    plug: [
      [4.4, 0.24, -0.1],
      [4.7, 0.14, -0.1],
      [5.05, 0.012, -0.1],
    ],
    pylon: [
      [12.9, 0.03, 1.15, 1.25],
      [13.6, 0.1, 1.15, 1.42],
      [15, 0.16, 1, 1.5],
      [16.6, 0.15, 0.95, 1.42],
      [18, 0.1, 1.05, 1.36],
      [18.9, 0.03, 1.12, 1.25],
    ],
  },
  gear: {
    // Locators Z wheelbase, W nose gear station, Y track, X axle spread.
    // Pivots, rake and fold angles are set so the stowed legs and wheels lie inside the skin,
    // fairings and wing (checked against these tables); the fold doors are not modelled.
    nose: { u: 3.39, r: 0.31, w: 0.19, spread: 0.42, top: 2.3, strut: 0.075, retract: 1.7 },
    main: {
      u: 18.7,
      x: 3.365,
      pivotX: 3.4,
      r: 0.51,
      w: 0.34,
      spread: 0.69,
      top: 2.9,
      hinge: 0.8,
      retract: 1.45,
      strut: 0.11,
    },
  },
};
export const a220Frame = () => transportFrame(a220);
// Pro Line Fusion: five 15.1 in displays across the panel (two PFDs, two MFDs, EICAS between),
// where the catalog entry's four left the panel a display short.
export const buildA220 = (s) => buildTransport({ ...s, screens: 5 }, a220);
