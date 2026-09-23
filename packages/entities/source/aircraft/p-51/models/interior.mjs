/** Model-owned cockpit builder. Change interior.json or this module freely per vehicle. */
import * as T from 'three';

export function addInterior(parent, layout, api) {
  const {
    group,
    box,
    rod,
    sphere,
    mesh,
    lettering,
    silver,
    dark,
    white,
    yellow,
    blue,
    brown,
    green,
    rubber,
  } = api;
  function gauge(parent, id, label, x, y, z, r) {
    lettering(parent, `${id}-label`, label, x, y - r * 0.46, z - 0.012);
    for (const [label, dx, dy] of [
      ['0', 0, 0.62],
      ['3', -0.62, 0],
      ['6', 0, -0.67],
      ['9', 0.62, 0],
    ])
      lettering(parent, `${id}-number-${label}`, label, x + dx * r, y + dy * r, z - 0.013, 0.0017);
    const ring = mesh(parent, `${id}-bezel`, new T.TorusGeometry(r, 0.012, 6, 32), silver, [
      x,
      y,
      z,
    ]);
    const face = mesh(parent, `${id}-dial`, new T.CircleGeometry(r, 32), dark, [x, y, z - 0.004]);
    face.rotation.y = Math.PI;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tick = box(
        parent,
        `${id}-tick-${i}`,
        [0.006, i % 3 === 0 ? 0.022 : 0.012, 0.003],
        [x + Math.sin(a) * r * 0.8, y + Math.cos(a) * r * 0.8, z - 0.008],
        white,
      );
      tick.rotation.z = -a;
    }
    const needle = group(parent, `needle-${id}`, [x, y, z - 0.019]);
    box(needle, `${id}-pointer`, [0.006, r * 0.76, 0.004], [0, r * 0.32, 0], white);
    sphere(needle, `${id}-hub`, [0.014, 0.014, 0.006], [0, 0, -0.002], yellow);
    return ring;
  }
  const { eye, width, panelZ, panelY } = layout;
  const material = api[layout.material];
  const cabin = group(parent, layout.root);
  box(cabin, 'floor', [width, 0.07, 1.5], [0, panelY - 0.55, panelZ - 0.55], material);
  box(cabin, 'instrument-panel', [width, 0.44, 0.065], [0, panelY, panelZ]);
  for (const instrument of layout.gauges)
    gauge(cabin, instrument.id, instrument.label, ...instrument.position, instrument.radius);
  // Artificial horizon is a physical movable instrument behind its fixed yellow wings.
  const attitude = group(cabin, 'attitude-ball', layout.horizon.position);
  const sky = mesh(
    attitude,
    'horizon-sky',
    new T.CircleGeometry(layout.horizon.radius, 32, 0, Math.PI),
    blue,
  );
  sky.rotation.y = Math.PI;
  const earth = mesh(
    attitude,
    'horizon-earth',
    new T.CircleGeometry(layout.horizon.radius, 32, Math.PI, Math.PI),
    brown,
  );
  earth.rotation.y = Math.PI;
  box(cabin, 'horizon-wings', [0.088, 0.005, 0.004], layout.horizon.wings, yellow);
  for (const [i, control] of layout.switches.entries()) {
    rod(cabin, `switch-${i}`, control.from, control.to, 0.008);
  }
  const seatXs = layout.seatXs;
  for (const x of seatXs) {
    box(cabin, 'seat-cushion', [0.44, 0.12, 0.48], [x, eye[1] - 0.64, eye[2] - 0.14], green);
    const back = box(
      cabin,
      'seat-back',
      [0.46, 0.6, 0.12],
      [x, eye[1] - 0.35, eye[2] - 0.4],
      green,
    );
    back.rotation.x = -0.12;
    for (const side of [-1, 1])
      box(
        cabin,
        'shoulder-harness',
        [0.045, 0.5, 0.018],
        [x + side * 0.12, eye[1] - 0.32, eye[2] - 0.32],
        dark,
      );
    const stick = group(cabin, 'control-stick', [x, eye[1] - 0.85, eye[2] + 0.25]);
    rod(stick, 'stick-shaft', [0, 0, 0], [0, 0.5, 0], 0.018);
    sphere(stick, 'stick-grip', [0.037, 0.07, 0.038], [0, 0.51, 0], rubber);
    for (const side of [-1, 1])
      box(
        cabin,
        'rudder-pedal',
        [0.13, 0.07, 0.12],
        [x + side * 0.12, eye[1] - 0.87, panelZ - 0.2],
        silver,
      );
  }
}
