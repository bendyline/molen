/** ATR Training Center V14 (11-2015) panel arrangement, cross-checked with ATR's
 * published cockpit photograph. Geometry only; no copyrighted image pixels shipped.
 * The poster has no scale. Its main display spacing matches a head-on photograph of a -600 panel
 * once the 140-pixel display is the published 6 x 8 in LCD, so the panel is built in poster
 * coordinates and carried by one scaled group.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  detailKit,
  fittedFloor,
  group,
  mat,
  outline,
  quad,
  sheet,
  T,
} from './mesh-kit.mjs';

/** Flight deck stations: the seated eye, the panel face and the raised floor over the nose gear. */
export const atr72Deck = { eye: [0.5, 3.02, 10.92], panelZ: 11.68, floor: 1.78 };

const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
export function buildATR72Cockpit(root, m, sections) {
  const cabin = group(root, 'cockpit'),
    { eye, panelZ, floor } = atr72Deck;
  // 0.67 sets the 140-pixel display to 154 mm; 3.026 is the coaming peak, set at 2.83 m.
  const scale = 0.67,
    panel = group(cabin, 'ATR72-main-panel', [0, 2.83 - scale * 3.026, panelZ - scale * 11.4]);
  panel.scale.setScalar(scale);
  const d = detailKit(panel, 'ATR72-panel-face'),
    cd = detailKit(cabin, 'ATR72-cabin'),
    ins = instrumentGeometry(panel, 'ATR72'),
    { bindings, derived, ink, black } = ins,
    pt = panelTools(d);
  const face = mat('ATR72-panel', '#627d8c'),
    liner = mat('ATR72-liner', '#d2d7d3', { side: T.DoubleSide }),
    seat = mat('ATR72-upholstery', '#677477'),
    green = mat('ATR72-panel-print', '#83a99b');
  const k = 2.04 / 1242,
    px = (u) => (666 - u) * k,
    py = (v) => 2.55 + (800 - v) * k,
    z = 11.4,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const edge = [
    [44, 700],
    [136, 658],
    [1178, 658],
    [1286, 700],
    [1286, 942],
    [866, 942],
    [866, 974],
    [466, 974],
    [466, 942],
    [44, 942],
  ].map((q) => at(...q));
  const screens = [
    [208, 810, 140, 183],
    [385, 810, 140, 183],
    [666, 821, 140, 183],
    [943, 810, 140, 183],
    [1121, 810, 140, 183],
  ];
  const holes = screens.map(([u, v, w, h]) => rect(px(u), py(v), w * k, h * k, z));
  holes.push(rect(px(529), py(753), 0.085, 0.072, z));
  sheet(d, edge, face, [0, 0, -1], holes);
  sheet(
    d,
    edge.map((q) => [q[0], q[1], q[2] + 0.13]),
    black,
    [0, 0, 1],
  );
  outline(d, edge, 0.006, m.dark);
  // The broad coaming carries AFCS in its raised centre and warning controls at each side.
  const coaming = [
    [92, 600],
    [550, 510],
    [780, 510],
    [1250, 600],
    [1250, 664],
    [1105, 616],
    [231, 616],
    [92, 664],
  ].map((q) => at(q[0], q[1], -0.015));
  sheet(d, coaming, face, [0, 0, -1]);
  outline(d, coaming, 0.018, m.dark);
  // The unfolded training poster separates these surfaces; the actual panel joins them.
  d.box([2.04, 0.15, 0.05], [0, py(665), z + 0.07], face);
  const sources = {};
  for (const [name, component, path] of [
    ['trueAirspeed', 'aircraftState', ['airspeed']],
    ['altitude', 'transform', ['pos', 1]],
    ['yaw', 'aircraftState', ['yaw']],
    ['roll', 'aircraftState', ['roll']],
    ['pitch', 'aircraftState', ['pitch']],
    ['verticalSpeed', 'aircraftState', ['verticalSpeed']],
    ['flapPosition', 'aircraftState', ['flapPosition']],
    ['gearPosition', 'aircraftState', ['gearPosition']],
    ['power', 'aircraftInput', ['power']],
    ['pitchInput', 'aircraftInput', ['pitch']],
    ['rollInput', 'aircraftInput', ['roll']],
    ['yawInput', 'aircraftInput', ['yaw']],
    ['engine1', 'aircraftState', ['engines', 'engine-1', 'rpm']],
    ['engine2', 'aircraftState', ['engines', 'engine-2', 'rpm']],
  ])
    sources[name] = { component, path };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * Math.PI] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    rpm1: { op: 'multiply', args: ['engine1', 100] },
    rpm2: { op: 'multiply', args: ['engine2', 100] },
    gearDown: { op: 'greater', args: ['gearPosition', 0.98] },
    gearExposed: { op: 'greater', args: ['gearPosition', 0.02] },
  });
  for (const [i, [u, v, w, h]] of screens.entries()) {
    const x = px(u),
      yy = py(v),
      sw = w * k,
      sh = h * k;
    sheet(
      d,
      rect(x, yy, sw + 0.045, sh + 0.035, z - 0.006),
      black,
      [0, 0, -1],
      [rect(x, yy, sw, sh, z - 0.006)],
    );
    for (const side of [-1, 1]) pt.knob(x + side * sw * 0.35, yy - sh / 2 - 0.012, z - 0.02, 0.005);
    for (let j = 0; j < 6; j++)
      d.box(
        [0.009, 0.006, 0.005],
        [x + sw * 0.4 - j * sw * 0.16, yy - sh / 2 - 0.012, z - 0.018],
        m.dark,
      );
    if (i === 0 || i === 4) {
      const hx = x,
        hy = yy + 0.052,
        hw = 0.132,
        hh = 0.115;
      sheet(
        d,
        rect(x, yy, sw, sh, z + 0.007),
        black,
        [0, 0, -1],
        [rect(hx, hy, hw, hh, z + 0.007)],
      );
      ins.horizon(`PFD-${i}-attitude`, [hx, hy, z + 0.011], hw, hh, { blankBackdrop: true });
      ins.readout(`PFD-${i}-speed`, [x + 0.09, hy, z - 0.012], 'knots', 3, 0.011, ink, false, true);
      ins.readout(
        `PFD-${i}-altitude`,
        [x - 0.088, hy, z - 0.012],
        'feet',
        5,
        0.007,
        ink,
        true,
        true,
      );
      d.text('TAS', [x + 0.09, yy + 0.128, z - 0.013], 0.0045, Math.PI, ink, 'display');
      d.text('GEO FT', [x - 0.086, yy + 0.128, z - 0.013], 0.0045, Math.PI, ink, 'display');
      // Fixed tape ticks bracket live digits; no fabricated IAS, target bugs or flight director.
      for (const side of [-1, 1])
        for (let j = -3; j <= 3; j++)
          d.rod(
            [x + side * 0.067, hy + j * 0.012, z - 0.013],
            [x + side * 0.074, hy + j * 0.012, z - 0.013],
            0.0007,
            ink,
          );
      const rose = group(panel, `ATR72-PFD-${i}-rose`, [x, yy - 0.071, z - 0.014]),
        rd = detailKit(rose, rose.name);
      for (let deg = 0; deg < 360; deg += 10) {
        const a = (deg * Math.PI) / 180,
          p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
        rd.rod(p(deg % 30 ? 0.041 : 0.038), p(0.046), 0.0007, ink);
        if (deg % 90 === 0) rd.text(['N', 'E', 'S', 'W'][deg / 90], p(0.031), 0.006, Math.PI, ink);
      }
      rd.finish();
      bindings.push({
        node: rose.name,
        source: 'trueHeading',
        property: 'rotation',
        axis: 'z',
        scale: -1,
        period: 2 * Math.PI,
        responseSeconds: 0.15,
      });
      ins.available(`PFD-${i}-heading`, 'trueHeading', rose.name);
      d.text('TRUE', [x, yy - 0.131, z - 0.015], 0.0045, Math.PI, ink, 'display');
      ins.dial(
        `PFD-${i}-VSI`,
        [x - 0.09, yy - 0.058, z - 0.012],
        0.018,
        'verticalFpm',
        [
          [-6000, -2.3],
          [0, 0],
          [6000, 2.3],
        ],
        [-6000, 0, 6000],
        'VSI',
      );
    } else {
      sheet(d, rect(x, yy, sw, sh, z + 0.007), black, [0, 0, -1]);
      if (i === 2) {
        for (const [j, dx] of [0.055, -0.055].entries())
          ins.dial(
            `engine-${j}-indicator`,
            [x + dx, yy + 0.039, z - 0.013],
            0.037,
            `rpm${j + 1}`,
            [
              [0, -2.3],
              [100, 2.3],
            ],
            [0, 50, 100],
            'RPM %',
          );
        d.text('TQ --  ITT --', [x, yy + 0.115, z - 0.013], 0.008, Math.PI, ink, 'display');
        d.text('NH --  FUEL --', [x, yy - 0.024, z - 0.013], 0.008, Math.PI, ink, 'display');
        d.text('OIL --', [x, yy - 0.046, z - 0.013], 0.008, Math.PI, ink, 'display');
        ins.dial(
          'flap-indicator',
          [x, yy - 0.095, z - 0.014],
          0.028,
          'flapPosition',
          [
            [0, -1],
            [0.5, 0],
            [1, 1],
          ],
          [0, 0.5, 1],
          'FLAP',
          { tickLabels: { 0: '0', 0.5: '15', 1: '30' } },
        );
      } else {
        d.text(i === 1 ? 'NAV --' : 'SYS --', [x, yy + 0.07, z - 0.013], 0.014, Math.PI, ink);
        d.text('NO DATA', [x, yy + 0.025, z - 0.013], 0.008, Math.PI, ink, 'display');
        d.text('COM --  NAV --', [x, yy - 0.09, z - 0.013], 0.007, Math.PI, ink, 'display');
      }
    }
  }
  sheet(
    d,
    rect(px(529), py(753), 0.11, 0.1, z - 0.006),
    black,
    [0, 0, -1],
    [rect(px(529), py(753), 0.085, 0.072, z - 0.006)],
  );
  ins.horizon('standby-attitude', at(529, 753, 0.011), 0.085, 0.072, { blankBackdrop: true });
  // Clock, pressure control and radio digits are deliberately unpowered/blank.
  for (const u of [84, 1243]) {
    d.add(
      new T.CylinderGeometry(0.037, 0.037, 0.016, 24).rotateX(Math.PI / 2),
      m.dark,
      at(u, 754, -0.01),
    );
    d.text('--:--', at(u, 754, -0.02), 0.009, Math.PI, ink);
    for (const v of [822, 866, 899]) pt.knob(px(u), py(v), z - 0.025, 0.009);
  }
  for (const [u, v, label] of [
    [660, 690, 'SPEED LIMITS'],
    [531, 818, 'ICING'],
    [531, 869, 'ENG CONTROL'],
    [802, 890, 'AUTO PRESS'],
  ]) {
    d.box([0.1, 0.05, 0.008], at(u, v, -0.012), m.dark);
    d.text(label, at(u, v, -0.018), 0.005, Math.PI, ink);
  }
  for (const side of [-1, 1])
    for (let j = 0; j < 3; j++) {
      d.box([0.018, 0.018, 0.007], at(529 + side * 14, 839 + j * 24, -0.014), black);
      d.box([0.011, 0.004, 0.003], at(529 + side * 14, 835 + j * 24, -0.02), ink);
    }
  const gear = group(panel, 'ATR72-gear-lever', at(803, 822, -0.027)),
    gd = detailKit(gear, gear.name);
  gd.rod([0, 0, 0], [0, -0.035, -0.035], 0.006, m.metal);
  gd.add(
    new T.CylinderGeometry(0.014, 0.014, 0.027, 16).rotateZ(Math.PI / 2),
    black,
    [0, -0.04, -0.04],
  );
  gd.finish();
  bindings.push({
    node: gear.name,
    source: 'gearPosition',
    property: 'rotation',
    axis: 'x',
    scale: 0.65,
  });
  for (let j = 0; j < 3; j++) {
    const g = group(panel, `ATR72-gear-lamp-${j}`, at(787 + j * 16, 772, -0.02)),
      dd = detailKit(g, g.name);
    sheet(
      dd,
      [
        [-0.006, 0.006, 0],
        [0.006, 0.006, 0],
        [0, -0.005, 0],
      ],
      green,
      [0, 0, -1],
    );
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'gearDown',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  for (const [u, v, w, h, label] of [
    [665, 555, 226, 68, 'AFCS'],
    [305, 588, 142, 46, 'WARN'],
    [1040, 588, 142, 46, 'WARN'],
  ]) {
    d.box([w * k, h * k, 0.012], at(u, v, -0.027), face);
    d.text(label, at(u, v + 18, -0.035), 0.006, Math.PI, ink);
    for (let j = 0; j < 6; j++) {
      pt.knob(px(u - w * 0.37 + j * w * 0.148), py(v - 2), z - 0.044, 0.007);
      d.box([0.012, 0.005, 0.004], at(u - w * 0.37 + j * w * 0.148, v - 12, -0.04), black);
    }
  }
  // Two independent pitch columns and rectangular ram-horn wheels with top-mounted switches.
  for (const side of [-1, 1]) {
    const pilotX = side * eye[0];
    const column = group(cabin, `ATR72-column-${side}`, [pilotX, floor + 0.065, panelZ - 0.2]),
      kit = detailKit(column, column.name);
    beveledBox(kit, [0.11, 0.65, 0.13], [0, 0.28, -0.06], face);
    const wheel = group(column, `ATR72-yoke-${side}`, [0, 0.61, -0.14]),
      wd = detailKit(wheel, wheel.name);
    outline(
      wd,
      [
        [-0.18, 0.16, 0],
        [-0.2, 0.03, 0],
        [-0.16, -0.04, 0],
        [-0.08, -0.04, 0],
        [0, 0.02, 0],
        [0.08, -0.04, 0],
        [0.16, -0.04, 0],
        [0.2, 0.03, 0],
        [0.18, 0.16, 0],
      ],
      0.019,
      black,
      false,
    );
    beveledBox(wd, [0.17, 0.13, 0.035], [0, 0, -0.016], m.dark, 0.012);
    for (const sign of [-1, 1]) {
      wd.box([0.04, 0.036, 0.035], [sign * 0.18, 0.16, -0.005], black);
      wd.box([0.015, 0.006, 0.012], [sign * 0.18, 0.18, -0.008], ink);
    }
    wd.finish();
    kit.finish();
    bindings.push(
      { node: column.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.12 },
      { node: wheel.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
    );
    for (const off of [-0.12, 0.12]) {
      const g = group(cabin, `ATR72-pedal-${side}-${off < 0 ? 'a' : 'b'}`, [
          pilotX + off,
          floor + 0.16,
          panelZ + 0.12,
        ]),
        dd = detailKit(g, g.name);
      dd.box([0.18, 0.12, 0.04], [0, 0, 0], m.metal);
      for (let j = 0; j < 5; j++)
        dd.rod(
          [-0.075, -0.045 + j * 0.02, -0.025],
          [0.075, -0.045 + j * 0.02, -0.025],
          0.003,
          m.dark,
        );
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: off < 0 ? -0.045 : 0.045,
      });
    }
    // Side shelf, oxygen mask, sill, chart holder and tiller on the captain's side.
    cd.box([0.22, 0.05, 1.0], [side * 1.06, 2.33, 11.0], face);
    cd.box([0.15, 0.15, 0.06], [side * 1.08, 2.42, 11.42], m.dark);
    cd.rod([side * 1.1, 2.4, 11.4], [side * 1.04, 2.46, 11.27], 0.018, m.accent);
    cd.box([0.16, 0.13, 0.02], [side * 0.9, 2.5, panelZ - 0.012], m.dark);
    for (let j = 0; j < 4; j++)
      cd.rod(
        [side * 0.9 - 0.05, 2.53 - j * 0.02, panelZ - 0.024],
        [side * 0.9 + 0.05, 2.53 - j * 0.02, panelZ - 0.024],
        0.001,
        ink,
      );
    if (side > 0) {
      cd.ring(0.075, 0.014, [side * 1.03, 2.43, 11.1], black, 'y');
      cd.rod([side * 1.03, 2.36, 11.1], [side * 1.03, 2.43, 11.1], 0.013, black);
    }
  }
  // Front sloping avionics pedestal: two FMS keyboards and central weather radar panel.
  const fms = group(cabin, 'ATR72-FMS', [0, 2.3, panelZ - 0.18]);
  fms.rotation.x = 0.6;
  fms.scale.setScalar(0.7);
  const fd = detailKit(fms, fms.name);
  beveledBox(fd, [0.66, 0.35, 0.1], [0, 0, 0], face);
  for (const side of [-1, 1]) {
    fd.box([0.22, 0.13, 0.012], [side * 0.215, 0.07, -0.056], black);
    fd.text('FMS DATA --', [side * 0.215, 0.08, -0.064], 0.01, Math.PI, ink, 'display');
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 7; c++)
        fd.box(
          [0.019, 0.016, 0.008],
          [side * 0.215 - 0.084 + c * 0.028, -0.025 - r * 0.026, -0.059],
          black,
        );
    for (let r = 0; r < 5; r++)
      fd.box(
        [0.012, 0.008, 0.006],
        [side * 0.215 + side * 0.12, 0.115 - r * 0.023, -0.058],
        m.dark,
      );
  }
  fd.box([0.17, 0.08, 0.012], [0, 0.08, -0.057], black);
  fd.text('RADAR --', [0, 0.08, -0.064], 0.01, Math.PI, ink, 'display');
  fd.finish();
  const ped = group(cabin, 'ATR72-pedestal', [0, 2.17, panelZ - 0.83]);
  ped.rotation.x = Math.PI / 2;
  ped.scale.setScalar(0.85);
  cd.box([0.42, 0.35, 1.04], [0, floor + 0.175, panelZ - 0.83], face);
  const pd = detailKit(ped, ped.name),
    pp = panelTools(pd);
  beveledBox(pd, [0.53, 1.25, 0.14], [0, 0, 0], face);
  for (const [x, label] of [
    [0.14, 'POWER'],
    [0.055, 'POWER'],
    [-0.075, 'COND'],
    [-0.14, 'COND'],
    [-0.215, 'FLAP'],
  ]) {
    pd.box([0.015, 0.42, 0.007], [x, 0.18, -0.075], black);
    pd.text(label, [x, 0.42, -0.08], 0.008, Math.PI, ink);
  }
  for (const [i, x, source] of [
    [0, 0.14, 'power'],
    [1, 0.055, 'power'],
    [2, -0.075, null],
    [3, -0.14, null],
    [4, -0.215, 'flapPosition'],
  ]) {
    const g = group(ped, `ATR72-power-lever-${i}`, [x, 0.06, -0.08]),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0], [0, 0, -0.095], 0.006, m.metal);
    beveledBox(
      dd,
      [i === 4 ? 0.075 : 0.055, 0.044, 0.027],
      [0, 0, -0.11],
      i === 4 ? liner : black,
      0.008,
    );
    if (i < 2) dd.text(String(i + 1), [0, 0, -0.125], 0.018, Math.PI, ink);
    dd.finish();
    if (source)
      bindings.push({
        node: g.name,
        source,
        property: 'rotation',
        axis: 'x',
        scale: source === 'power' ? -0.85 : 0.65,
      });
  }
  pd.box([0.19, 0.014, 0.014], [0.095, 0.27, -0.1], m.accent);
  pd.text('GUST LOCK', [0.1, 0.29, -0.11], 0.008, Math.PI, ink);
  for (const [y0, label] of [
    [-0.22, 'RADIO'],
    [-0.38, 'AUDIO'],
    [-0.52, 'TRIM'],
  ]) {
    pd.box([0.48, 0.11, 0.01], [0, y0, -0.078], m.dark);
    pd.text(label, [0, y0 + 0.036, -0.087], 0.008, Math.PI, ink);
    for (let j = 0; j < 8; j++) pp.knob(-0.21 + j * 0.06, y0 - 0.015, -0.09, 0.008);
  }
  pd.finish();
  // Overhead uses the four-column ATR arrangement. Switch positions are static decoration.
  const oh = group(cabin, 'ATR72-overhead', [0, 3.36, 11.18]);
  oh.rotation.x = -Math.PI / 2 + 0.25;
  const od = detailKit(oh, oh.name),
    op = panelTools(od);
  beveledBox(od, [0.81, 0.68, 0.045], [0, 0, 0], face);
  const labels = [
    ['MFC', 'DOORS', 'FUEL', 'LT'],
    ['ELEC', 'START', 'EXT LT', 'BAT'],
    ['HYD', 'PROBES', 'ANTI ICE', 'DE ICE'],
    ['OXY', 'AIR', 'TEMP', 'VENT'],
  ];
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      const x = 0.3 - c * 0.2,
        yy = 0.22 - r * 0.13;
      od.box([0.184, 0.117, 0.008], [x, yy, -0.028], face);
      outline(od, rect(x, yy, 0.184, 0.117, -0.034), 0.001, ink);
      od.text(labels[c][r], [x, yy + 0.042, -0.036], 0.007, Math.PI, ink);
      for (let j = 0; j < 4; j++) {
        od.box([0.025, 0.019, 0.008], [x - 0.063 + j * 0.042, yy + 0.008, -0.035], black);
        od.box([0.015, 0.004, 0.002], [x - 0.063 + j * 0.042, yy + 0.011, -0.041], ink);
      }
      for (const dx of [-0.042, 0.042]) op.knob(x + dx, yy - 0.029, -0.042, 0.009);
    }
  for (const side of [-1, 1]) {
    od.box([0.15, 0.036, 0.023], [side * 0.3, 0.3, -0.04], ins.red);
    od.text(`ENG ${side > 0 ? '1' : '2'} FIRE`, [side * 0.3, 0.3, -0.054], 0.008, Math.PI, ink);
  }
  od.finish();
  // Glareshield deck: one flat plane from the panel top down to where it meets the skin, which
  // always falls below the glass, so nothing stands in front of the windscreen from outside.
  const wall = (zz, yy) => m.skinX(zz, yy) * 0.992,
    deckEdge = wall(panelZ, m.sill(panelZ) - 0.03),
    deckFall = (2.83 - (m.sill(panelZ) - 0.03)) / deckEdge,
    deckDrop = 0.1,
    deck = (x, zz) => 2.83 - deckFall * x - deckDrop * (zz - panelZ),
    meet = (zz) => {
      let x = 0.5;
      for (let i = 0; i < 12; i++) x = wall(zz, deck(x, zz)) * 0.96;
      return x;
    };
  let deckTip = panelZ;
  while (deckTip < 12.3 && meet(deckTip + 0.01) > 0.08) deckTip += 0.01;
  const deckOutline = [[0, 2.83, panelZ]];
  for (let i = 0; i <= 12; i++) {
    const zz = panelZ + ((deckTip - panelZ) * i) / 12,
      x = i === 12 ? 0 : meet(zz);
    deckOutline.push([x, deck(x, zz), zz]);
  }
  for (const side of [-1, 1]) {
    sheet(
      cd,
      deckOutline.map(([x, y, zz]) => [side * x, y, zz]),
      black,
      [side * deckFall, 1, deckDrop],
    );
    // Blanking panels close the nose bay beside the panel and over the foot wells.
    const lower = 2.3,
      toe = 12.02;
    sheet(
      cd,
      [
        [side * 0.66, lower, panelZ + 0.01],
        [side * wall(panelZ, lower), lower, panelZ + 0.01],
        [side * deckEdge, deck(deckEdge, panelZ), panelZ + 0.01],
        [side * 0.634, 2.73, panelZ + 0.01],
      ],
      face,
      [0, 0, -1],
    );
    quad(
      cd,
      [0, lower, panelZ],
      [side * wall(panelZ, lower), lower, panelZ],
      [side * wall(toe, lower), lower, toe],
      [0, lower, toe],
      m.dark,
      [0, -1, 0],
    );
    sheet(
      cd,
      [
        [0, floor, toe],
        [side * wall(toe, floor), floor, toe],
        [side * wall(toe, 2.05), 2.05, toe],
        [side * wall(toe, lower), lower, toe],
        [0, lower, toe],
      ],
      m.dark,
      [0, 0, -1],
    );
    // Raised flight deck floor over the nose gear bay, ending at the door bulkhead.
    sheet(
      cd,
      [
        [0, floor, 10.15],
        [side * wall(10.15, floor), floor, 10.15],
        [side * wall(10.8, floor), floor, 10.8],
        [side * wall(11.4, floor), floor, 11.4],
        [side * wall(toe, floor), floor, toe],
        [0, floor, toe],
      ],
      m.dark,
      [0, 1, 0],
    );
  }
  // Solid door bulkhead behind the seats, drawn at the plan's 3.4 m from the nose.
  sheet(
    cd,
    Array.from({ length: 25 }, (_, i) => {
      const yy = 1.53 + (i * (3.57 - 1.53)) / 24;
      return [wall(10.16, yy), yy, 10.16];
    }).concat(
      Array.from({ length: 25 }, (_, i) => {
        const yy = 3.57 - (i * (3.57 - 1.53)) / 24;
        return [-wall(10.16, yy), yy, 10.16];
      }),
    ),
    liner,
    [0, 0, 1],
  );
  outline(cd, rect(0, 2.55, 0.74, 1.54, 10.14), 0.008, m.dark);
  // Cabin follows the 72-seat, 29-inch-pitch manufacturer plan and 2.57 m cross section.
  fittedFloor(cd, sections, m.dark, { y: 1.57, front: 10.15, back: -8.25, width: 2.24 });
  cd.box([0.05, 1.5, 0.055], [1.04, 2.31, 8.75], liner);
  cd.box([0.05, 1.5, 0.055], [-1.04, 2.31, 8.75], liner);
  for (const side of [-1, 1]) {
    // Forward baggage compartment separates flight deck from passenger rows.
    sheet(
      cd,
      [
        [side * 0.39, 1.56, 8.1],
        [side * 1.06, 1.56, 8.1],
        [side * 1.06, 3.12, 8.1],
        [side * 0.39, 3.4, 8.1],
      ],
      liner,
      [0, 0, 1],
    );
    cd.box([0.3, 0.3, 13.2], [side * 0.8, 2.98, -0.3], liner);
    for (let row = 0; row < 18; row++) {
      const zz = 5.65 - row * 0.7366;
      cd.rod([side * 0.71, 3.04, zz], [side * 1.12, 3.04, zz], 0.002, m.dark);
    }
  }
  const seats = [
    // A seated eye is about 0.3 m ahead of the seatback.
    [eye[0], eye[2] - 0.12, true],
    [-eye[0], eye[2] - 0.12, true],
  ];
  for (let row = 0; row < 18; row++)
    for (const x of [-0.94, -0.44, 0.44, 0.94]) seats.push([x, 5.65 - row * 0.7366, false]);
  for (const [x, zz, pilot] of seats) {
    const w = pilot ? 0.47 : 0.44,
      lift = pilot ? floor - 1.53 : 0;
    beveledBox(cd, [w, 0.1, 0.44], [x, 1.94 + lift, zz], seat, 0.025);
    beveledBox(cd, [w, 0.64, 0.1], [x, 2.28 + lift, zz - 0.21], seat, 0.025);
    beveledBox(cd, [w * 0.72, 0.16, 0.11], [x, 2.67 + lift, zz - 0.21], seat, 0.025);
    for (const side of [-1, 1]) {
      cd.rod(
        [x + side * w * 0.4, 1.57 + lift, zz],
        [x + side * w * 0.4, 1.89 + lift, zz],
        0.014,
        m.metal,
      );
      cd.box([0.045, 0.04, 0.33], [x + side * w * 0.52, 2.15 + lift, zz - 0.015], liner);
    }
    cd.rod(
      [x - w * 0.38, 2.003 + lift, zz - 0.13],
      [x + w * 0.36, 2.003 + lift, zz + 0.13],
      0.009,
      m.dark,
    );
    cd.box([0.04, 0.011, 0.03], [x + 0.04, 2.015 + lift, zz + 0.04], m.metal);
  }
  d.finish();
  cd.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
