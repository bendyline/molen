/** Reusable 10.4-inch G1000 physical units and live display subset.
 * Coordinates are in the caller's panel frame, facing local -Z. Use a parent
 * transform for an inclined panel. No independent sensors or synthetic systems.
 */
import { panelTools } from '../vehicle-interiors.mjs';
import { detailKit, group, sheet } from './mesh-kit.mjs';
export function addG1000Readouts({
  cabin,
  d,
  instruments,
  prefix,
  pfd,
  mfd,
  z,
  maxRpm,
  tapeMax = 240,
  twinEngine = false,
  mfdReadouts = true,
}) {
  const { bindings, derived, ink, black } = instruments;
  const sw = 0.211328,
    sh = 0.158496;
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  // These sources also drive ordinary mountExperience/CLI scenes, without an Earth-only bridge.
  const sources = {
    trueAirspeed: { component: 'aircraftState', path: ['airspeed'] },
    altitude: { component: 'transform', path: ['pos', 1] },
    roll: { component: 'aircraftState', path: ['roll'] },
    pitch: { component: 'aircraftState', path: ['pitch'] },
    yaw: { component: 'aircraftState', path: ['yaw'] },
    propNormalized: { component: 'aircraftState', path: ['engines', 'engine-1', 'rpm'] },
    verticalSpeed: { component: 'aircraftState', path: ['verticalSpeed'] },
    pitchInput: { component: 'aircraftInput', path: ['pitch'] },
    rollInput: { component: 'aircraftInput', path: ['roll'] },
    yawInput: { component: 'aircraftInput', path: ['yaw'] },
    power: { component: 'aircraftInput', path: ['power'] },
    elevator: { component: 'aircraftState', path: ['elevator'] },
  };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    propRpm: { op: 'multiply', args: ['propNormalized', maxRpm] },
    rpmTens: { op: 'divide', args: ['propRpm', 10] },
    rpmRoundedTens: { op: 'add', args: ['rpmTens', 0.5] },
    rpmWholeTens: { op: 'floor', args: ['rpmRoundedTens'] },
    rpmDisplay: { op: 'multiply', args: ['rpmWholeTens', 10] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', Math.PI * 2] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
  });
  const [sx, sy] = pfd;
  // Horizon is behind the cut-out panel/screen mask, so it cannot bleed outside the display.
  instruments.horizon('PFD-horizon', [sx, sy + 0.026, z + 0.012], 0.11, 0.068);
  const screenMask = rect(sx, sy, sw, sh, z + 0.007);
  sheet(
    d,
    screenMask,
    black,
    [0, 0, -1],
    [
      rect(sx, sy + 0.026, 0.11, 0.068, z + 0.007),
      rect(sx + 0.083, sy + 0.026, 0.031, 0.062, z + 0.007),
    ],
  );
  // The speed tape uses one translation plus per-row visibility; static geometry, no glyph churn.
  const tape = group(cabin, `${prefix}-speed-tape`, [sx + 0.083, sy + 0.026, z + 0.009]);
  bindings.push({
    node: tape.name,
    source: 'knots',
    property: 'position',
    axis: 'y',
    scale: -0.001,
  });
  for (let value = 20; value <= tapeMax; value += 10) {
    const row = group(tape, `${prefix}-speed-tape-${value}`, [0, value * 0.001, 0]),
      dd = detailKit(row, row.name);
    dd.text(String(value), [0.002, 0, 0], 0.0045, Math.PI, ink, 'display');
    dd.rod([-0.008, 0, 0], [-0.014, 0, 0], 0.0004, ink);
    dd.finish();
    const distance = `tape.${value}.distance`,
      absolute = `tape.${value}.absolute`,
      show = `tape.${value}.show`;
    derived[distance] = { op: 'subtract', args: ['knots', value] };
    derived[absolute] = { op: 'abs', args: [distance] };
    derived[show] = { op: 'less', args: [absolute, 29] };
    bindings.push({ node: row.name, source: show, property: 'visible', scale: 1, missing: 'hide' });
  }
  d.box([0.029, 0.012, 0.001], [sx + 0.083, sy + 0.025, z + 0.004], black);
  // Readouts retain the real PFD locations. Small TAS/GEO labels disclose the current approximation.
  instruments.readout(
    'PFD-speed',
    [sx + 0.083, sy + 0.025, z + 0.002],
    'knots',
    3,
    0.01,
    ink,
    false,
    true,
  );
  instruments.readout(
    'PFD-altitude',
    [sx - 0.08, sy + 0.025, z + 0.002],
    'feet',
    5,
    0.0075,
    ink,
    true,
    true,
  );
  d.text('TAS', [sx + 0.083, sy + 0.065, z + 0.001], 0.006, Math.PI, ink, 'display');
  d.text('GEO FT', [sx - 0.081, sy + 0.047, z + 0.001], 0.005, Math.PI, ink, 'display');
  const vsi = group(cabin, `${prefix}-VSI`, [sx - 0.101, sy + 0.025, z + 0.001]),
    vd = detailKit(vsi, 'VSI');
  vd.rod([-0.002, 0, 0], [0.002, 0.002, 0], 0.0008, ink);
  vd.rod([-0.002, 0, 0], [0.002, -0.002, 0], 0.0008, ink);
  vd.finish();
  bindings.push({
    node: vsi.name,
    source: 'verticalFpm',
    property: 'position',
    axis: 'y',
    scale: 0.000012,
    min: -0.024,
    max: 0.024,
    responseSeconds: 0.6,
  });
  instruments.available('VSI', 'verticalFpm', vsi.name);
  for (const fpm of [-2000, -1000, 0, 1000, 2000])
    d.rod(
      [sx - 0.097, sy + 0.025 + fpm * 0.000012, z + 0.002],
      [sx - 0.1, sy + 0.025 + fpm * 0.000012, z + 0.002],
      0.0004,
      ink,
    );
  const rose = group(cabin, `${prefix}-heading-rose`, [sx, sy - 0.046, z + 0.002]),
    hr = detailKit(rose, 'heading-rose');
  for (let deg = 0; deg < 360; deg += 10) {
    const a = (deg * Math.PI) / 180,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hr.rod(p(deg % 30 ? 0.023 : 0.021), p(0.025), 0.0005, ink);
    if (deg % 30 === 0)
      hr.text(
        deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
        p(0.017),
        0.004,
        Math.PI,
        ink,
        'display',
      );
  }
  hr.finish();
  bindings.push({
    node: rose.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: 2 * Math.PI,
    responseSeconds: 0.15,
  });
  instruments.available('heading', 'trueHeading', rose.name);
  d.text('TRUE', [sx, sy - 0.013, z + 0.001], 0.004, Math.PI, ink, 'display');
  d.rod([sx, sy - 0.024, z - 0.001], [sx, sy - 0.029, z - 0.001], 0.001, instruments.amber);
  d.text('NAV --  COM --', [sx, sy + 0.071, z + 0.001], 0.005, Math.PI, ink, 'display');
  if (!mfdReadouts) return sources;
  // MFD engine sidebar. Oil, fuel, electrical and map data remain explicitly unavailable.
  const [mx, my] = mfd;
  sheet(d, rect(mx, my, sw, sh, z + 0.003), black, [0, 0, -1]);
  if (twinEngine) {
    sources.propNormalized2 = { component: 'aircraftState', path: ['engines', 'engine-2', 'rpm'] };
    Object.assign(derived, {
      propRpm2: { op: 'multiply', args: ['propNormalized2', maxRpm] },
      rpmTens2: { op: 'divide', args: ['propRpm2', 10] },
      rpmRoundedTens2: { op: 'add', args: ['rpmTens2', 0.5] },
      rpmWholeTens2: { op: 'floor', args: ['rpmRoundedTens2'] },
      rpmDisplay2: { op: 'multiply', args: ['rpmWholeTens2', 10] },
    });
    // G58 default EIS: mirrored left/right half scales on a common center.
    // Garmin 190-00526-02, p5. Missing manifold/thermal/electrical data stays blank.
    const cx = mx + 0.078,
      cy = my + 0.025,
      radius = 0.021;
    d.text('MAN -- --', [cx, my + 0.063, z - 0.001], 0.004, Math.PI, ink, 'display');
    for (const [engine, side, source, display] of [
      [1, 1, 'propRpm', 'rpmDisplay'],
      [2, -1, 'propRpm2', 'rpmDisplay2'],
    ]) {
      for (let rpm = 0; rpm <= 3000; rpm += 250) {
        const angle = side * (2.4 - (rpm / 3000) * 1.68);
        const p = (r) => [cx - Math.sin(angle) * r, cy + Math.cos(angle) * r, z - 0.001];
        d.rod(p(radius * 0.89), p(radius), 0.00045, ink);
      }
      instruments.pointer(
        `MFD-tach-${engine}`,
        [cx, cy, z - 0.002],
        radius * 0.78,
        source,
        [
          [0, side * 2.4],
          [3000, side * 0.72],
        ],
        { responseSeconds: 0.1 },
      );
      instruments.readout(
        `MFD-rpm-${engine}`,
        [cx + side * 0.013, cy - 0.024, z - 0.003],
        display,
        4,
        0.005,
      );
    }
    d.text('RPM', [cx, cy + 0.007, z - 0.002], 0.004, Math.PI, ink, 'display');
    d.text('3000', [cx, cy + 0.024, z - 0.001], 0.0035, Math.PI, ink, 'display');
    for (const [label, yy] of [
      ['FF -- --', -0.016],
      ['CHT -- --', -0.028],
      ['OIL -- --', -0.04],
      ['AMPS -- --', -0.052],
      ['FUEL -- --', -0.064],
    ])
      d.text(label, [cx, my + yy, z - 0.001], 0.004, Math.PI, ink, 'display');
  } else {
    instruments.dial(
      'MFD-tach',
      [mx + 0.076, my + 0.041, z - 0.001],
      0.024,
      'propRpm',
      [
        [0, -2.35],
        [3000, 2.35],
      ],
      [0, 1000, 2000, 3000],
      'RPM',
      { responseSeconds: 0.1 },
    );
    instruments.readout('MFD-rpm', [mx + 0.076, my + 0.006, z - 0.016], 'rpmDisplay', 4, 0.006);
    for (const [label, yy] of [
      ['OIL --', -0.016],
      ['FUEL --', -0.031],
      ['VOLTS --', -0.046],
    ])
      d.text(label, [mx + 0.072, my + yy, z], 0.005, Math.PI, ink, 'display');
  }
  d.rod([mx + 0.042, my - 0.074, z], [mx + 0.042, my + 0.074, z], 0.0006, ink);
  d.text('MAP DATA', [mx - 0.025, my + 0.012, z], 0.009, Math.PI, ink, 'display');
  d.text('UNAVAILABLE', [mx - 0.025, my - 0.003, z], 0.007, Math.PI, ink, 'display');

  return sources;
}

export function addG1000Bezels(d, centers, z, black, trim) {
  const pt = panelTools(d);
  const rect = (x, y, w, h, zz) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  for (const [x, y] of centers) {
    sheet(
      d,
      rect(x, y, 0.29972, 0.19558, z - 0.006),
      black,
      [0, 0, -1],
      [rect(x, y, 0.211328, 0.158496, z - 0.006)],
    );
    for (const side of [-1, 1])
      for (const yy of [-0.073, -0.039, 0.036, 0.075])
        pt.knob(x + side * 0.13, y + yy, z - 0.016, 0.009);
    for (let i = 0; i < 12; i++)
      d.box([0.01, 0.006, 0.004], [x + 0.098 - i * 0.018, y - 0.088, z - 0.013], trim);
    for (let i = 0; i < 5; i++)
      d.box([0.011, 0.005, 0.004], [x - 0.13, y - 0.011 + i * 0.009, z - 0.013], trim);
    for (const side of [-1, 1])
      for (const yy of [-0.089, 0.089]) pt.knob(x + side * 0.143, y + yy, z - 0.011, 0.0028);
  }
}
