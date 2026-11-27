/** De Havilland Canada Dash 8-400, PW150A, Dowty R408. No dimensioned drawing was found: the
 * manufacturer's spec sheet carries overall figures only (32.83 by 28.42 by 8.34 m). Wheelbase
 * 13.94 m, track 8.80 m and the 4.12 m propeller come from an operator's aeroplane-general notes.
 * Stations are read from photographs G-ECOG (ground, oblique) and C-GLQK (underside, for the
 * planform), with depth and clearance scaled from the 2.69 m body and 63.1 m2 wing area.
 * Treat this as a reconstruction, not a measured three-view.
 */

import {
  bar,
  flapSelectorGeometry,
  gearHandleGeometry,
  lathe,
  place,
  roundedBox,
  switchGeometry,
  tube,
} from './cockpit-parts.mjs';
import { T } from './mesh-kit.mjs';
import { controlColumn, controlWheel, stamp } from './transport-deck.mjs';
import { buildTransport, transportFrame } from './transport-kit.mjs';

const rot = (axis, scale, offset) => ({ property: 'rotation', axis, scale, offset });
/** Q400 quadrant lever: a black arm to a knob, its engine number in white on the aft face.
 * Power levers carry a large barrel grip across the lever (the pair nearly meet, crop-quadrant
 * photo); condition levers a squared block. */
function quadrantLever(k, P, ink, label, { arm = 0.2, condition = false } = {}) {
  k.add(place(roundedBox([0.011, arm, 0.02], 0.003, 1), [0, arm / 2, 0]), P.grip);
  if (condition)
    k.add(place(roundedBox([0.034, 0.03, 0.038], 0.006), [0, arm + 0.01, -0.004]), P.grip);
  else
    k.add(
      place(
        new T.CylinderGeometry(0.026, 0.026, 0.062, 20),
        [0, arm + 0.012, -0.004],
        [0, 0, Math.PI / 2],
      ),
      P.grip,
    );
  k.text(
    label,
    [0, arm + (condition ? 0.008 : 0.01), condition ? -0.0235 : -0.0305],
    condition ? 0.018 : 0.024,
    Math.PI,
    ink,
  );
}

/** Flight deck after the DHC-8-402Q cockpit photograph (Dtom, public domain): blue-grey panel
 * with five portrait displays (PFD, MFD, engine display, MFD, PFD), the standby left of the
 * engine display and the gear lever right of it; tall wheels on floor columns with a checklist
 * plate; FMS units and the engine control panel on the pedestal's forward slope, then the drum
 * quadrant: park brake and trim left, power levers 1-2, condition levers 1-2, flap lever right. */
const q400Deck = {
  colors: {
    panel: '#69737e',
    console: '#6e7884',
    glare: '#272b30',
    lining: '#b6bbbf',
    floor: '#4a4f53',
    seat: '#87909a',
    bezel: '#3d444c',
  },
  pedals: { style: 'airliner', scale: 1.05, lean: 0.3 },
  leverSpacing: 0.07,
  control(c, { P }) {
    controlWheel(c, P, {
      span: 0.3,
      horn: 0.165,
      cant: 0.07,
      grip: 0.017,
      drop: 0.075,
      hub: [0.06, 0.075, 0.07],
      heads: 1.25,
      plate: [0.17, 0.12],
    });
  },
  column: (d, { P, x, floor, eye }) => controlColumn(d, P, x, floor, eye, { radius: 0.03 }),
  powerLever(k, { P, d, index }) {
    quadrantLever(k, P, d.ivory, index ? '1' : '2');
  },
  build(c) {
    const { d, m, P, sy, sz, floor, overhead: o } = c,
      [ex, ey, ez] = c.eye,
      z = sz;
    const W = 0.175,
      H = 0.225,
      Y = sy + 0.035;
    c.screen(d, 0.5, Y, z, W, H, 'pfd', { horizon: 'horizon-0' });
    c.screen(d, 0.29, Y, z, W, H, 'map');
    c.screen(d, 0, Y, z, W, H, 'eicas');
    c.screen(d, -0.29, Y, z, W, H, 'synoptic');
    c.screen(d, -0.5, Y, z, W, H, 'pfd', { horizon: 'horizon-4' });
    // Left centre strip: the standby over a blank plate. Right: landing gear and hydraulics.
    c.standby(d, 0.145, sy + 0.1, z, 0.066);
    d.box([0.07, 0.1, 0.004], [0.145, sy - 0.03, z - 0.002], m.bezel);
    d.box([0.078, 0.15, 0.005], [-0.145, sy + 0.045, z - 0.0025], m.bezel);
    for (const x of [-0.165, -0.145, -0.125])
      d.box([0.012, 0.01, 0.004], [x, sy + 0.105, z - 0.006], m.green);
    c.text(d, 'LANDING GEAR', [-0.145, sy + 0.125, z - 0.006], 0.0055);
    const gear = c.control('cockpit-gear', [-0.145, sy + 0.045, z - 0.006], [0, 0, 0], {
      action: 'gear',
      motion: rot('x', -0.7, 0.35),
    });
    stamp(gear, [0, 0, 0], [0, 0, 0], (t) =>
      gearHandleGeometry(t, { style: 'jet', scale: 0.75, palette: P }),
    );
    for (let i = 0; i < 3; i++) c.tools.knob(-0.125 - i * 0.02, sy - 0.06, z - 0.004, 0.006);
    c.text(d, 'HYDRAULIC CONTROL', [-0.145, sy - 0.035, z - 0.004], 0.005);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) c.tools.knob(side * 0.655, sy + 0.08 - i * 0.06, z - 0.004, 0.01);
    // Glareshield panel: a grey box standing well out from the displays up to the hood's rolled
    // lip, across the full width (402Q photograph). Flight guidance panel in the middle with the
    // four powered-flight-control shutoffs over its mode buttons and the course/heading knobs at
    // its ends; either side the clock, stick-pusher shutoffs and master warning/caution.
    const span = Math.min(1.5, c.panelWidth - 0.14),
      gy = sy + 0.199,
      gz = z - 0.07;
    d.box([span, 0.082, 0.07], [0, gy, z - 0.035], m.panel);
    d.box([0.42, 0.07, 0.004], [0, gy, gz - 0.002], m.bezel);
    for (let q = 0; q < 4; q++)
      d.box([0.024, 0.014, 0.004], [(q - 1.5) * 0.032, gy + 0.021, gz - 0.006], d.dark);
    for (const row of [-0.002, -0.02])
      for (let q = 0; q < 6; q++)
        d.box([0.022, 0.011, 0.004], [(q - 2.5) * 0.03, gy + row, gz - 0.006], d.dark);
    c.text(d, 'PWR FLT CTRL SHUTOFFS', [0, gy + 0.031, gz - 0.0045], 0.0042);
    for (const side of [-1, 1]) {
      c.tools.knob(side * 0.17, gy + 0.012, gz - 0.0105, 0.011);
      c.tools.knob(side * 0.17, gy - 0.018, gz - 0.0105, 0.009);
      c.tools.gauge(side * 0.5, gy, gz - 0.014, 0.026, d.dark, true);
      for (const dy of [0.012, -0.014])
        d.box([0.022, 0.016, 0.006], [side * 0.42, gy + dy, gz - 0.003], d.dark);
      c.text(d, 'STICK PUSHER', [side * 0.42, gy + 0.031, gz - 0.0005], 0.0042);
      d.box([0.022, 0.016, 0.006], [side * 0.36, gy - 0.014, gz - 0.003], d.dark);
      d.box([0.03, 0.022, 0.006], [side * 0.3, gy + 0.008, gz - 0.003], m.amber);
      d.box([0.03, 0.022, 0.006], [side * 0.255, gy + 0.008, gz - 0.003], d.red);
      c.tools.knob(side * 0.64, gy, gz - 0.0065, 0.009);
    }
    // Pedestal: forward slope with the FMS units and engine control panel, the drum quadrant,
    // and the radio heads on the aft top.
    const half = 0.21,
      slopeFoot = [ez + 0.47, 1.28 + (c.consoleY - 1.17)],
      slopeTop = [z - 0.005, sy - 0.1];
    const drum = [
      [ez + 0.08, slopeFoot[1] - 0.02],
      [ez + 0.16, slopeFoot[1] + 0.015],
      [ez + 0.27, slopeFoot[1] + 0.03],
      [ez + 0.38, slopeFoot[1] + 0.02],
    ];
    c.pedestal(
      [
        [ez - 0.36, floor],
        [ez - 0.36, slopeFoot[1] - 0.045],
        [ez - 0.33, slopeFoot[1] - 0.02],
        ...drum,
        slopeFoot,
        slopeTop,
        [slopeTop[0], floor],
      ],
      half,
    );
    const lean = Math.atan2(slopeTop[1] - slopeFoot[1], slopeTop[0] - slopeFoot[0]),
      slope = c.face(
        'q400-pedestal-slope',
        [0, (slopeFoot[1] + slopeTop[1]) / 2 + 0.001, (slopeFoot[0] + slopeTop[0]) / 2],
        [Math.PI / 2 - lean, 0, 0],
      );
    for (const x of [0.12, -0.12]) {
      slope.box([0.13, 0.22, 0.012], [x, 0, -0.006], m.bezel);
      c.screen(slope, x, 0.055, -0.013, 0.1, 0.06, 'cdu', { bezel: m.bezel });
      for (let r = 0; r < 4; r++)
        for (let q = 0; q < 5; q++)
          slope.box(
            [0.016, 0.013, 0.005],
            [x + (q - 2) * 0.022, -0.02 - r * 0.021, -0.014],
            d.dark,
          );
    }
    c.text(slope, 'ENGINE CONTROL', [0, 0.07, -0.002], 0.006);
    // The two yellow-and-black striped fuel-off handles at the top, between the FMS units
    // (crop-quadrant photo), each a T-bar on a short stem.
    c.text(slope, 'FUEL CONTROL', [0, 0.086, -0.002], 0.005);
    for (const x of [0.045, -0.045]) {
      slope.add(bar([x, 0.1, 0], [x, 0.1, -0.028], 0.004, 8), P.alloy);
      slope.add(place(roundedBox([0.044, 0.016, 0.016], 0.005), [x, 0.1, -0.036]), P.yellow);
      for (const dx of [-0.011, 0.011])
        slope.add(
          place(roundedBox([0.007, 0.0165, 0.0165], 0.002), [x + dx, 0.1, -0.036], [0, 0, 0.5]),
          P.black,
        );
    }
    for (const [i, x] of [0.025, -0.025].entries()) {
      c.text(slope, `START ${i + 1}`, [x, 0.035, -0.002], 0.0055);
      const start = c.control(
        `cockpit-engine-${i}`,
        [x, 0.005, -0.002],
        [0, 0, 0],
        { action: 'engine', engine: i, motion: rot('x', 0.7, -0.7) },
        slope.root.parent,
      );
      stamp(start, [0, 0, 0], [0, 0, 0], (t) =>
        switchGeometry(t, { style: 'toggle', scale: 1.3, palette: P }),
      );
    }
    // Lever slots following the drum, from the power levers out to the flap lever.
    const groove = (x, from = 0, to = drum.length) =>
      d.add(
        tube(
          [...drum.slice(from, to), slopeFoot].map(([zz, yy]) => [x, yy + 0.002, zz]),
          0.006,
          6,
        ),
        P.black,
      );
    for (const x of [0.035, -0.035, -0.11, -0.155, -0.19, 0.14]) groove(x, 1);
    const ink = d.ivory;
    for (const [i, x] of [-0.11, -0.155].entries()) {
      const lever = c.control(
        `cockpit-propeller-${i}`,
        [x, c.consoleY + 0.06, ez + 0.3],
        [0, 0, 0],
        {
          action: 'propeller',
          engine: i,
          motion: rot('x', 0.65, -0.65),
        },
      );
      quadrantLever(lever, P, ink, String(i + 1), { arm: 0.18, condition: true });
    }
    const flap = c.control('cockpit-flaps', [-0.192, c.consoleY + 0.06, ez + 0.36], [0, 0, 0], {
      action: 'flaps',
      motion: rot('x', -0.7, 0.35),
    });
    stamp(flap, [0, 0, 0], [0, 0, 0], (t) =>
      flapSelectorGeometry(t, { style: 'lever', height: 0.2, palette: P }),
    );
    const park = c.control('cockpit-brake', [0.14, c.consoleY + 0.06, ez + 0.4], [0, 0, 0], {
      action: 'brake',
      motion: rot('x', -0.5),
    });
    park.add(place(roundedBox([0.01, 0.16, 0.016], 0.002, 1), [0, 0.08, 0]), P.alloy);
    park.add(place(roundedBox([0.07, 0.024, 0.024], 0.007), [0, 0.165, -0.004]), P.yellow);
    for (const x of [-0.024, 0, 0.024])
      park.add(
        place(roundedBox([0.008, 0.0245, 0.0245], 0.002), [x, 0.165, -0.004], [0, 0, 0.5]),
        P.black,
      );
    const quad = c.face(
      'q400-quadrant',
      [0, slopeFoot[1] + 0.035, ez + 0.2],
      [Math.PI / 2 - 0.15, 0, 0],
    );
    c.text(quad, 'PARK', [0.14, 0.18, -0.002], 0.008);
    c.text(quad, 'FLAPS', [-0.19, 0.18, -0.002], 0.008);
    c.text(quad, 'PROP', [-0.133, 0.18, -0.002], 0.008);
    // Elevator trim wheel in the pedestal's left face.
    d.add(
      place(
        new T.CylinderGeometry(0.075, 0.075, 0.02, 24),
        [half + 0.002, slopeFoot[1] - 0.06, ez + 0.3],
        [0, 0, Math.PI / 2],
      ),
      P.grip,
    );
    // Radio and trim heads on the aft top.
    const aft = c.face(
      'q400-pedestal-aft',
      [0, slopeFoot[1] - 0.019, ez - 0.13],
      [Math.PI / 2, 0, 0],
    );
    for (const x of [0.11, -0.11]) {
      aft.box([0.16, 0.3, 0.01], [x, 0, -0.005], m.bezel);
      aft.box([0.09, 0.06, 0.002], [x, 0.09, -0.011], m.green);
      for (let r = 0; r < 4; r++)
        for (let q = 0; q < 3; q++)
          aft.box([0.02, 0.016, 0.006], [x + (q - 1) * 0.04, 0.02 - r * 0.045, -0.012], d.dark);
    }
    // Outboard consoles and the captain's tiller.
    for (const side of [-1, 1]) {
      const inner = Math.abs(ex) + 0.28,
        top = ey - 0.66;
      c.sideConsole(side, { inner, top, aft: ez - 0.45, fore: ez + 0.5 });
      d.add(
        place(roundedBox([0.07, 0.035, 0.34], 0.014), [
          side * (inner + 0.04),
          top + 0.018,
          ez - 0.08,
        ]),
        m.padded,
      );
    }
    d.add(
      lathe(
        [
          [0, 0],
          [0.055, 0],
          [0.055, 0.012],
          [0.045, 0.018],
          [0, 0.018],
        ],
        20,
      ),
      P.grip,
      [Math.abs(ex) + 0.4, ey - 0.66, ez + 0.35],
    );
    d.add(
      bar(
        [Math.abs(ex) + 0.4, ey - 0.645, ez + 0.35],
        [Math.abs(ex) + 0.44, ey - 0.62, ez + 0.35],
        0.009,
        12,
      ),
      P.grip,
    );
    // Overhead: system panels, the main battery switch aft on the centre line.
    const roof = c.face('q400-overhead', [0, o.y - 0.028, o.z], [-Math.PI / 2, 0, Math.PI]);
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 10; q++)
        if ((r * 3 + q) % 4)
          roof.box(
            [0.014, 0.022, 0.012],
            [(q - 4.5) * (o.w / 11), -0.16 + r * 0.085, -0.006],
            d.dark,
          );
    for (const x of [-0.2, 0.2]) roof.box([0.16, 0.1, 0.004], [x, 0.2, -0.002], m.bezel);
    c.text(roof, 'MAIN BATT', [0, -0.215, -0.002], 0.008);
    const batt = c.control(
      'cockpit-engine-common',
      [0, o.y - 0.03, o.z - 0.25],
      [-Math.PI / 2, 0, 0],
      {
        action: 'engine',
        motion: rot('x', 0.7, -0.7),
      },
    );
    stamp(batt, [0, 0, 0], [0, 0, 0], (t) =>
      switchGeometry(t, { style: 'paddle', scale: 1.5, palette: P }),
    );
  },
};

const body = [
  [0.02, 0.08, 0.62, 0.74, 0.5],
  [0.1, 0.2, 0.5, 0.86, 0.5],
  [0.3, 0.36, 0.38, 1.02, 0.5],
  [0.6, 0.5, 0.27, 1.2, 0.5],
  [1, 0.66, 0.17, 1.42, 0.5],
  [1.5, 0.82, 0.09, 1.66, 0.5],
  [2, 0.98, 0.04, 1.9, 0.5],
  [2.5, 1.1, 0.01, 2.16, 0.5],
  [3, 1.2, 0, 2.36],
  [3.5, 1.27, 0, 2.5],
  [4, 1.31, 0, 2.6],
  [5, 1.345, 0, 2.69],
  [21, 1.345, 0, 2.69],
  [22, 1.34, 0.1, 2.69],
  [23, 1.3, 0.25, 2.69],
  [24, 1.24, 0.44, 2.69],
  [25, 1.16, 0.66, 2.69],
  [26, 1.06, 0.9, 2.69],
  [27, 0.94, 1.14, 2.68],
  [28, 0.8, 1.4, 2.66],
  [29, 0.64, 1.66, 2.6],
  [30, 0.44, 1.92, 2.5],
  [30.8, 0.12, 2.12, 2.4],
];

export const q400 = {
  prefix: 'DH8D',
  length: 32.83,
  width: 2.69,
  bodyHeight: 2.69,
  // The oblique photograph shows the type's slight nose-down sit; 0.5 degrees is an estimate.
  stance: [0.0087, 12, 1.1],
  midFraction: 0.5,
  bellyAngle: 2.05,
  body,
  deck: q400Deck,
  cockpit: {
    uStart: 1.72,
    uEnd: 3.4,
    centerPost: 2.57,
    low: [
      [1.6, 1.72],
      [2, 1.68],
      [2.6, 1.67],
      [3.4, 1.7],
      [3.9, 1.72],
    ],
    top: [
      [1.6, 2.19],
      [3.9, 2.19],
    ],
    arcs: [[1.72, 1.71]],
    // G-ECOG shows two panes a side.
    posts: [[2.9, 2.9]],
  },
  // No published eye position. The pilot shows in the forward part of the side pane in G-ECOG.
  eye: { u: 3.15, x: 0.46, h: 2.02, floor: 0.92, bulkhead: 5.8 },
  cabinWidth: 1.7,
  windows: {
    y: 1.55,
    w: 0.26,
    h: 0.34,
    pitch: 0.76,
    runs: [
      { from: 6.3, count: 12 },
      { from: 16.3, count: 11 },
    ],
  },
  doors: [
    { u0: 4.5, u1: 5.3, y0: 0.72, y1: 2.42, corner: 0.15 },
    { u0: 25.3, u1: 26.1, y0: 0.9, y1: 2.45, corner: 0.15 },
  ],
  seams: [0.85],
  wing: {
    rows: [
      [0.3, 2.76, 13.3, 16.4, 0.27],
      [1.3, 2.79, 13.3, 16.4, 0.27],
      [4.6, 2.87, 13.3, 16.4, 0.26],
      [14, 3.2, 15.1, 16.3, 0.08],
      [14.21, 3.2, 15.5, 16.25, 0.03],
    ],
    surfaces: [
      { kind: 'flap', name: 'inner', from: 1.5, to: 3.75, chord: 0.3 },
      { kind: 'flap', name: 'outer', from: 5.25, to: 9.6, chord: 0.3 },
      { kind: 'aileron', from: 9.8, to: 13.2, chord: 0.28 },
    ],
  },
  fin: {
    rows: [
      [2.2, 23.6, 30.4, 0.3],
      [2.69, 24.4, 30.6, 0.26],
      [3.2, 26.2, 30.9, 0.2],
      [3.6, 26.9, 31.05, 0.17],
      [5, 28, 31.5, 0.14],
      [6.6, 29.3, 32.1, 0.1],
      [6.98, 29.7, 32.3, 0.06],
    ],
    rudder: { from: 3.1, to: 6.6, chord: 0.33 },
    caps: [
      {
        name: 'fin-top-fairing',
        rows: [
          [29.2, 0.02, 6.92, 6.96],
          [29.8, 0.2, 6.82, 7.1],
          [31, 0.2, 6.82, 7.12],
          [32.3, 0.02, 6.95, 6.98],
        ],
      },
    ],
  },
  tailplane: {
    rows: [
      [0.1, 6.95, 29.6, 31.7, 0.13],
      [0.6, 6.97, 29.9, 31.85, 0.12],
      [4.2, 7.1, 31.6, 32.6, 0.05],
      [4.4, 7.1, 31.85, 32.83, 0.03],
    ],
    elevator: { from: 0.6, to: 4.1, chord: 0.35 },
  },
  fairings: [
    {
      name: 'wing-root-fairing',
      material: 'paint',
      rows: [
        [11.8, 0.7, 2.6, 2.75],
        [13, 1, 2.4, 3.05],
        [15, 1, 2.4, 3.07],
        [17, 0.6, 2.5, 2.92],
        [18.5, 0.1, 2.62, 2.72],
      ],
    },
  ],
  engine: {
    kind: 'turboprop',
    // On the main gear track: the legs retract into these nacelles (8.80 m track, see the review).
    x: 4.4,
    u: 10.8,
    h: 2.02,
    // The nacelle runs well behind the trailing edge, holding the gear bay: it stays full to
    // du 7.7, round the stowed wheels, before its short tail cone. Depth and length as reviewed.
    cowl: [
      [0, 0.4, 0.4, 0.42],
      [0.6, 0.52, 0.56, 0.62],
      [1.6, 0.58, 0.64, 0.74],
      [3, 0.6, 0.68, 0.8],
      [5, 0.6, 0.66, 0.8],
      [6.4, 0.6, 0.63, 0.66],
      [7.7, 0.58, 0.6, 0.62],
      [8.4, 0.34, 0.36, 0.38],
      [8.9, 0.03, 0.03, 0.03],
    ],
    propAt: 0.02,
    spinner: [0.42, 0.85],
    radius: 2.06,
    blades: 6,
    bladeChord: 1.15,
  },
  gear: {
    // The nose leg's pivot sits high enough that the stowed wheels clear the keel.
    nose: { u: 2.36, r: 0.3, w: 0.18, spread: 0.36, top: 1.6, strut: 0.075, retract: 1.6 },
    // The legs hang from the nacelles, raked from a pivot ahead of the axle, and retract aft into
    // the nacelle bay: the stowed wheels sit on the nacelle axis. Twin 34 x 10.75-16 tyres.
    main: {
      u: 16.3,
      x: 4.4,
      pivotX: 4.4,
      r: 0.43,
      w: 0.27,
      spread: 0.5,
      top: 2.62,
      hinge: 0.55,
      strut: 0.11,
      axis: 'x',
      retract: -Math.PI / 2,
    },
  },
};
export const q400Frame = () => transportFrame(q400);
export const buildQ400 = (s) => buildTransport(s, q400);
