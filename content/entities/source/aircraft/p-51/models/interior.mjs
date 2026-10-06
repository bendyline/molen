/** P-51D station: black asymmetric panel, K-14 sight, bucket seat and sidewall controls. */
import * as T from 'three';
import { instrumentParts } from './instruments.mjs';

export function addInterior(parent, layout, api) {
  const { group, box, rod, sphere, mesh, silver, dark, green, rubber, yellow, red } = api;
  const { plate, gauge, screw, placard, toggle, grip, text } = instrumentParts(api);
  const cabin = group(parent, layout.root);
  plate(cabin, 'instrument-panel', layout.panelOutline, layout.panelZ);
  for (const instrument of layout.gauges) gauge(cabin, instrument);
  for (const [i, [x, y]] of layout.panelOutline.entries())
    screw(
      cabin,
      `panel-fastener-${i}`,
      x * 0.94,
      y > 2 ? y - 0.018 : y + 0.013,
      layout.panelZ - 0.007,
    );
  box(cabin, 'lower-switch-panel', [0.76, 0.11, 0.035], [0, 1.49, 0.805], dark);
  for (const [i, label] of ['BAT', 'GEN', 'LIGHT', 'FUEL', 'PITOT', 'GUN'].entries())
    toggle(cabin, `panel-switch-${i}`, [0.32 - i * 0.105, 1.49, 0.781], label);
  placard(cabin, 'landing-check', 'GEAR DOWN', [0.185, 1.735, 0.774], 0.13, 0.0011);
  const brake = group(cabin, 'parking-brake', [0.03, 1.56, 0.743]);
  rod(brake, 'brake-shaft', [0, 0, 0], [0, 0, -0.055], 0.007, silver);
  box(brake, 'brake-handle', [0.076, 0.018, 0.02], [0, 0, -0.06], yellow);
  for (const [i, color] of [green, red, yellow].entries())
    sphere(
      cabin,
      `gear-indicator-${i}`,
      [0.008, 0.008, 0.004],
      [0.25 + i * 0.035, 1.955, 0.772],
      color,
    );
  const coaming = new T.CatmullRomCurve3(
    [
      [-0.43, 2.07, 0.83],
      [-0.28, 2.2, 0.86],
      [0, 2.225, 0.87],
      [0.28, 2.2, 0.86],
      [0.43, 2.07, 0.83],
    ].map((p) => new T.Vector3(...p)),
  );
  mesh(
    cabin,
    'padded-instrument-coaming',
    new T.TubeGeometry(coaming, 32, 0.021, 8, false),
    rubber,
  );
  const sight = group(cabin, 'k14-gunsight', [0, 2.245, 0.89]);
  box(sight, 'sight-mount', [0.09, 0.07, 0.11], [0, -0.085, 0.04], dark);
  const body = mesh(
    sight,
    'sight-optical-housing',
    new T.CylinderGeometry(0.079, 0.065, 0.11, 24),
    dark,
  );
  body.rotation.x = Math.PI / 2;
  box(sight, 'sight-range-dial', [0.155, 0.025, 0.032], [0, 0.036, -0.062], dark);
  text(sight, 'sight-range-scale', '100 200 400', 0, 0.038, -0.08, 0.0013);
  const reflector = box(
    sight,
    'canopy-gunsight-glass',
    [0.14, 0.083, 0.003],
    [0, 0.085, -0.035],
    api.glass,
  );
  reflector.rotation.x = -0.16;
  for (const side of [-1, 1])
    rod(
      sight,
      `sight-reflector-post-${side}`,
      [side * 0.072, 0.025, 0],
      [side * 0.072, 0.127, -0.042],
      0.004,
      dark,
    );

  box(cabin, 'floor', [0.79, 0.045, 1.45], [0, 1.275, 0.02], green);
  box(cabin, 'heel-trough', [0.37, 0.025, 0.7], [0, 1.315, 0.42], silver);
  for (const side of [-1, 1]) {
    box(cabin, `side-console-${side}`, [0.09, 0.14, 0.9], [side * 0.397, 1.59, 0.09], green);
    for (const z of [-0.2, 0.11, 0.42])
      rod(
        cabin,
        `sidewall-rib-${side}-${z}`,
        [side * 0.425, 1.35, z],
        [side * 0.425, 2.0, z],
        0.009,
        green,
      );
  }
  const throttle = group(cabin, 'throttle-quadrant', [0.37, 1.72, 0.21]);
  box(throttle, 'quadrant-case', [0.085, 0.115, 0.29], [0, 0, 0], dark);
  for (const [i, color] of [rubber, yellow, red].entries()) {
    rod(
      throttle,
      `engine-lever-${i}`,
      [-0.008, 0.03, 0.09 - i * 0.083],
      [-0.025, 0.13, 0.13 - i * 0.083],
      0.006,
      silver,
    );
    sphere(
      throttle,
      `engine-lever-knob-${i}`,
      [0.018, 0.024, 0.018],
      [-0.025, 0.145, 0.13 - i * 0.083],
      color,
    );
  }
  placard(cabin, 'throttle-placard', 'THROTTLE PROP MIX', [0.32, 1.66, 0.37], 0.2, 0.0013);
  box(cabin, 'radio-control-box', [0.09, 0.16, 0.29], [-0.373, 1.72, -0.04], dark);
  for (let i = 0; i < 4; i++)
    sphere(
      cabin,
      `radio-channel-${i}`,
      [0.012, 0.012, 0.012],
      [-0.322, 1.79 - i * 0.035, 0.065],
      rubber,
    );
  const selector = group(cabin, 'fuel-selector', [0, 1.38, 0.55]);
  const selectorPlate = mesh(
    selector,
    'selector-plate',
    new T.CylinderGeometry(0.075, 0.075, 0.01, 24),
    dark,
  );
  selectorPlate.rotation.x = Math.PI / 2;
  box(selector, 'selector-handle', [0.06, 0.013, 0.018], [0.02, 0, -0.02], red);
  text(selector, 'selector-label', 'L OFF R', 0, 0.05, -0.008, 0.0017);

  plate(
    cabin,
    'seat-bucket-back',
    [
      [-0.23, 1.49],
      [-0.23, 1.95],
      [-0.17, 2.1],
      [0.17, 2.1],
      [0.23, 1.95],
      [0.23, 1.49],
    ],
    -0.395,
    green,
    0.028,
  );
  box(cabin, 'seat-pan', [0.46, 0.05, 0.49], [0, 1.49, -0.15], green);
  mesh(cabin, 'seat-cushion', new T.BoxGeometry(0.39, 0.1, 0.41), api.brown, [0, 1.56, -0.13]);
  box(cabin, 'seat-back-pad', [0.36, 0.41, 0.06], [0, 1.85, -0.353], api.brown);
  box(cabin, 'armor-plate', [0.39, 0.5, 0.04], [0, 2.12, -0.47], dark);
  mesh(
    cabin,
    'headrest',
    new T.CapsuleGeometry(0.07, 0.11, 4, 12).rotateZ(Math.PI / 2),
    rubber,
    [0, 2.335, -0.426],
  );
  for (const side of [-1, 1]) {
    const strap = box(
      cabin,
      `shoulder-harness-${side}`,
      [0.04, 0.54, 0.01],
      [side * 0.115, 1.86, -0.31],
      api.white,
    );
    strap.rotation.z = side * 0.13;
    box(cabin, `lap-belt-${side}`, [0.17, 0.025, 0.01], [side * 0.09, 1.61, -0.08], api.white);
  }
  box(cabin, 'harness-buckle', [0.04, 0.035, 0.015], [0, 1.62, -0.072], silver);
  const stick = group(cabin, 'control-stick', [0, 1.39, 0.25]);
  sphere(stick, 'stick-boot', [0.063, 0.075, 0.063], [0, 0, 0], rubber);
  rod(stick, 'stick-shaft', [0, 0, 0], [0, 0.32, -0.03], 0.016, silver);
  grip(stick, 'stick-grip', [0, 0.365, -0.045]);
  for (const side of [-1, 1]) {
    rod(
      cabin,
      `pedal-link-${side}`,
      [side * 0.145, 1.32, 0.58],
      [side * 0.145, 1.4, 0.7],
      0.009,
      silver,
    );
    const pedal = box(
      cabin,
      `rudder-pedal-${side}`,
      [0.16, 0.12, 0.025],
      [side * 0.145, 1.42, 0.715],
      silver,
    );
    pedal.rotation.x = -0.28;
    for (let i = 0; i < 5; i++)
      box(
        cabin,
        `pedal-tread-${side}-${i}`,
        [0.13, 0.008, 0.007],
        [side * 0.145, 1.38 + i * 0.021, 0.692],
        dark,
      );
  }
}
