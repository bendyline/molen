/** OH-6A: narrow center pedestal, tubular cyclics, collectives and light tubular seats. */
import * as T from 'three';
import { instrumentParts } from './instruments.mjs';

export function addInterior(parent, layout, api) {
  const { group, box, rod, sphere, mesh, silver, dark, green, rubber, white } = api;
  const { gauge, plate, screw, text, placard, toggle, grip } = instrumentParts(api);
  const cabin = group(parent, layout.root);
  const gray = new T.MeshStandardMaterial({
    name: 'cabin-gray-enamel',
    color: '#717974',
    metalness: 0.15,
    roughness: 0.68,
  });
  const fabric = new T.MeshStandardMaterial({
    name: 'seat-olive-fabric',
    color: '#4a513d',
    roughness: 0.97,
  });
  plate(cabin, 'instrument-panel', layout.panelOutline, layout.panelZ, gray);
  for (const spec of layout.gauges) gauge(cabin, spec);
  for (const [i, [x, y]] of layout.panelOutline.entries())
    screw(
      cabin,
      `panel-fastener-${i}`,
      x * 0.94,
      y > 1.5 ? y - 0.018 : y + 0.018,
      layout.panelZ - 0.007,
    );
  // Annunciators above the dials and caution/radio blocks on the pedestal.
  for (let i = 0; i < 5; i++) {
    box(cabin, `annunciator-${i}`, [0.04, 0.015, 0.004], [0.25 - i * 0.125, 1.573, 1.307], dark);
    text(
      cabin,
      `annunciator-print-${i}`,
      ['GEN', 'OIL', 'FUEL', 'RPM', 'TEMP'][i],
      0.25 - i * 0.125,
      1.573,
      1.303,
      0.0009,
    );
  }
  box(cabin, 'caution-panel', [0.22, 0.082, 0.008], [0.17, 1.095, 1.305], dark);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      box(
        cabin,
        `caution-lamp-${i}-${j}`,
        [0.056, 0.017, 0.003],
        [0.24 - i * 0.067, 1.12 - j * 0.024, 1.298],
        i === 0 && j === 0 ? api.yellow : rubber,
      );
  placard(cabin, 'rotor-limit-placard', 'ROTOR 400 RPM', [-0.095, 1.16, 1.305], 0.19, 0.0014);
  box(cabin, 'radio-face', [0.205, 0.07, 0.015], [0, 0.86, 1.31], dark);
  text(cabin, 'radio-frequency', 'FM 34.50', 0, 0.871, 1.3, 0.002);
  for (const x of [-0.085, 0.085])
    sphere(cabin, `radio-knob-${x}`, [0.012, 0.012, 0.009], [x, 0.843, 1.295], rubber);
  for (let i = 0; i < 4; i++) toggle(cabin, `pedestal-switch-${i}`, [0.09 - i * 0.06, 0.94, 1.306]);
  box(cabin, 'pedestal-body', [0.24, 0.27, 0.25], [0, 0.82, 1.465], gray);
  box(cabin, 'center-console', [0.23, 0.08, 0.63], [0, 0.72, 0.69], gray);
  for (let i = 0; i < 4; i++) toggle(cabin, `console-switch-${i}`, [0.075 - i * 0.05, 0.767, 0.84]);
  box(cabin, 'floor', [1.25, 0.035, 1.72], [0, 0.68, 0.31], gray);
  for (const side of [-1, 1]) {
    // One front seat each side, on exposed tubing, plus the aft cabin bench.
    const x = side * 0.38;
    const seat = group(cabin, `front-seat-${side}`);
    for (const dx of [-0.19, 0.19]) {
      rod(seat, `seat-leg-${dx}`, [x + dx, 0.7, 0.24], [x + dx, 1.01, 0.2], 0.013, silver);
      rod(seat, `seat-back-frame-${dx}`, [x + dx, 0.94, 0.18], [x + dx, 1.63, 0.08], 0.016, silver);
    }
    rod(seat, 'seat-upper-rail', [x - 0.19, 1.62, 0.08], [x + 0.19, 1.62, 0.08], 0.015, silver);
    box(seat, 'seat-pan', [0.43, 0.035, 0.46], [x, 0.99, 0.38], gray);
    box(seat, 'seat-cushion', [0.39, 0.105, 0.4], [x, 1.055, 0.39], fabric);
    const back = box(seat, 'seat-back', [0.38, 0.5, 0.07], [x, 1.37, 0.135], fabric);
    back.rotation.x = -0.12;
    for (const dx of [-0.095, 0.095]) {
      const strap = box(
        seat,
        `shoulder-harness-${dx}`,
        [0.036, 0.5, 0.01],
        [x + dx, 1.37, 0.188],
        white,
      );
      strap.rotation.x = -0.12;
    }
    box(seat, 'lap-belt', [0.34, 0.028, 0.014], [x, 1.114, 0.4], white);
    box(seat, 'harness-buckle', [0.038, 0.035, 0.018], [x, 1.12, 0.408], silver);
    const stick = group(cabin, side === -1 ? 'control-stick' : 'control-stick_1', [x, 0.72, 0.88]);
    sphere(stick, 'cyclic-boot', [0.055, 0.045, 0.055], [0, 0, 0], rubber);
    const curve = new T.CatmullRomCurve3(
      [
        [0, 0, 0],
        [0, 0.14, -0.01],
        [0, 0.26, -0.11],
        [0, 0.34, -0.14],
      ].map((p) => new T.Vector3(...p)),
    );
    mesh(stick, 'cyclic-shaft', new T.TubeGeometry(curve, 16, 0.015, 8, false), silver);
    grip(stick, 'cyclic-grip', [0, 0.385, -0.15], 0.12);
    const collective = group(cabin, side === -1 ? 'collective' : 'collective_1', [
      x + 0.24,
      0.8,
      0.26,
    ]);
    rod(collective, 'collective-shaft', [0, 0, 0], [0, 0.18, 0.29], 0.015, dark);
    const handle = grip(collective, 'collective-throttle', [0, 0.205, 0.32], 0.14);
    handle.rotation.x = 0.8;
    for (const dx of [-0.115, 0.115]) {
      rod(
        cabin,
        `pedal-arm-${side}-${dx}`,
        [x + dx, 0.7, 1.12],
        [x + dx, 0.81, 1.27],
        0.009,
        green,
      );
      rod(
        cabin,
        `rudder-pedal-${side}-${dx}`,
        [x + dx - 0.064, 0.81, 1.27],
        [x + dx + 0.064, 0.81, 1.27],
        0.012,
        dark,
      );
    }
  }
  box(cabin, 'aft-seat-bench', [1.1, 0.1, 0.43], [0, 0.91, -0.51], fabric);
  box(cabin, 'aft-seat-back', [1.08, 0.47, 0.07], [0, 1.16, -0.77], fabric);
  for (const x of [-0.36, 0, 0.36])
    box(cabin, `aft-seat-belt-${x}`, [0.036, 0.38, 0.009], [x, 1.18, -0.727], white);
  for (const side of [-1, 1]) {
    rod(
      cabin,
      `door-inner-handle-${side}`,
      [side * 0.77, 1.19, 0.5],
      [side * 0.77, 1.19, 0.67],
      0.013,
      dark,
    );
    box(cabin, `door-map-pocket-${side}`, [0.035, 0.2, 0.26], [side * 0.73, 0.9, 0.24], rubber);
  }
}
