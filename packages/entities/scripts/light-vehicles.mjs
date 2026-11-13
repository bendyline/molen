/**
 * Light vehicles built with fleet-geometry's cycle tools: a shared electric kick scooter, a
 * skateboard and an electric skateboard. Each entry has the frame cycleGeometry() reads (head
 * angle and offset, rider contacts) and a builder handed the tools of fleetModel's cycle branch.
 * Dimensions come from common real machines of each class, scaled from published geometry; no
 * maker's styling, name or emblem is copied.
 */
import * as T from 'three';
import { SNOW_VEHICLES } from './snow-vehicles.mjs';
import { detailKit } from './vehicle-detail.mjs';
import { panelTools } from './vehicle-interiors.mjs';

/** A detail group tilted about x at `at` (an instrument face reading up toward the rider). */
function tilted(kit, at, tilt, build) {
  const face = new T.Group();
  face.position.set(...at);
  face.rotation.x = tilt;
  kit.root.add(face);
  const k = detailKit(face, 'instrument-face');
  build(k, panelTools(k));
  k.finish();
}

/** Wheel group and its spin child (the client spins the first child), parented to `parent`. */
function wheelGroup(parent, name, at) {
  const g = new T.Group();
  g.name = name;
  g.position.set(...at);
  parent.add(g);
  const spin = new T.Group();
  spin.name = `${name}-spin`;
  g.add(spin);
  return { g, spin };
}

/**
 * Small solid wheel on an x axle: a rounded tyre (or urethane wheel) turned from a profile, a
 * recessed core and a hub cap each side.
 */
function smallWheel(k, spin, radius, width, tyre, core, { lip = 0.35, coreRadius = 0.55 } = {}) {
  const half = width / 2;
  const round = Math.min(half, radius * lip);
  const profile = [];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 6;
    profile.push(
      new T.Vector2(radius - round + Math.cos(a) * round, Math.sin(a) * (half - 0.0005)),
    );
  }
  profile.unshift(new T.Vector2(radius * coreRadius, -half * 0.92));
  profile.push(new T.Vector2(radius * coreRadius, half * 0.92));
  const lathe = new T.LatheGeometry(profile, 20).rotateZ(Math.PI / 2);
  k.mesh(spin, lathe, tyre, 'tyre');
  k.cylinderX(spin, [0, 0, 0], radius * coreRadius, width * 0.86, core, 16);
  for (const side of [-1, 1])
    k.cylinderX(spin, [side * width * 0.44, 0, 0], radius * 0.22, 0.004, k.materials.metal, 10);
}

/** Skateboard deck sections [z, half-width, bottom, top]: rounded ends rising into kicktails. */
function deckSections({ length, width, flat, kick, bottom, thick, steps = 14 }) {
  const half = length / 2,
    w = width / 2;
  // Stations crowd toward the rounded nose and tail.
  const zs = [];
  for (let i = 0; i <= steps; i++) zs.push(-half * Math.cos((Math.PI * i) / steps));
  const shoulder = half - w;
  return zs.map((z) => {
    const a = Math.abs(z);
    const end = a > shoulder ? Math.sqrt(Math.max(0, 1 - Math.pow((a - shoulder) / w, 2))) : 1;
    const t = a > flat ? (a - flat) / (half - flat) : 0;
    const lift = kick * t * t;
    const hw = Math.max(0.012, w * end);
    return [z, hw, bottom + lift, bottom + lift + thick];
  });
}

/**
 * A skateboard truck at z: baseplate and bushings fixed under the deck, the hanger, axle and two
 * wheels in the turning group `name` (posed about y from the steering signal).
 */
function truck(k, name, z, { deckBottom, axleY, hanger, axle, wheel, urethane, side }) {
  const { metal, dark, cream } = k.materials;
  const plateY = deckBottom - 0.004;
  k.box(k.body, [0.064, 0.008, 0.095], [0, plateY, z], metal, `${name}-baseplate`);
  k.box(k.body, [0.07, 0.004, 0.1], [0, deckBottom - 0.001, z], dark);
  // Kingpin and bushings angle from the plate down toward the hanger's pivot cup.
  const pivotZ = z + side * 0.034;
  k.rod(
    k.body,
    [0, plateY - 0.004, z - side * 0.006],
    [0, axleY + 0.016, z + side * 0.006],
    0.0045,
    metal,
  );
  k.mesh(k.body, new T.CylinderGeometry(0.014, 0.014, 0.012, 12), cream).position.set(
    0,
    axleY + 0.022,
    z + side * 0.006,
  );
  k.rod(
    k.body,
    [0, plateY - 0.004, pivotZ - side * 0.012],
    [0, axleY + 0.01, pivotZ],
    0.007,
    metal,
  );
  const g = new T.Group();
  g.name = name;
  g.position.set(0, axleY, z);
  k.body.add(g);
  // Hanger: a cast bar thickest at its middle, the pivot arm and kingpin boss rising from it.
  k.mesh(
    g,
    new T.CylinderGeometry(0.009, 0.014, hanger, 10).rotateZ(Math.PI / 2),
    metal,
    `${name}-hanger`,
  ).position.set(-hanger / 4, 0.004, 0);
  k.mesh(
    g,
    new T.CylinderGeometry(0.014, 0.009, hanger, 10).rotateZ(Math.PI / 2),
    metal,
  ).position.set(hanger / 4, 0.004, 0);
  k.rod(g, [0, 0.006, 0], [0, 0.016, side * 0.034], 0.008, metal);
  k.cylinderX(g, [0, 0.014, side * 0.006], 0.016, 0.03, metal, 12);
  k.rod(g, [-axle, 0, 0], [axle, 0, 0], 0.004, metal, 6);
  for (const [suffix, x] of [
    ['left', axle - wheel.width / 2 - 0.002],
    ['right', -(axle - wheel.width / 2 - 0.002)],
  ]) {
    const { spin } = wheelGroup(g, `wheel-${name.replace('truck-', '')}-${suffix}`, [x, 0, 0]);
    smallWheel(k, spin, wheel.radius, wheel.width, urethane, cream, {
      lip: 0.3,
      coreRadius: 0.5,
    });
    k.cylinderX(spin, [0, 0, 0], 0.011, wheel.width * 0.9, metal, 10);
  }
  return g;
}

function buildBoard(k, electric) {
  const { body, materials, material } = k;
  const { paint, dark, metal, deck } = materials;
  const spec = electric
    ? {
        length: 0.97,
        width: 0.25,
        flat: 0.3,
        kick: 0.045,
        thick: 0.014,
        wheelbase: k.s.wheelbase,
        wheel: { radius: k.s.wheelRadius, width: 0.052 },
        hanger: 0.15,
        axle: 0.115,
      }
    : {
        length: 0.8,
        width: 0.21,
        flat: 0.2,
        kick: 0.055,
        thick: 0.012,
        wheelbase: k.s.wheelbase,
        wheel: { radius: k.s.wheelRadius, width: 0.032 },
        hanger: 0.13,
        axle: 0.104,
      };
  const axleY = spec.wheel.radius;
  // Deck bottom: axle to baseplate is a truck's height, plus a riser on the larger wheels.
  const deckBottom = axleY + (electric ? 0.062 : 0.053);
  const sections = deckSections({ ...spec, bottom: deckBottom, steps: 30 });
  // Laminated maple core showing at the edges, grip tape over the top, a painted graphic under.
  k.shell(body, sections, deck, 'deck', { e: 5, n: 16 });
  k.shell(
    body,
    sections.map(([z, w, , t]) => [z, Math.max(0.008, w - 0.004), t - 0.0006, t + 0.0012]),
    dark,
    'grip-tape',
    { e: 6, n: 16 },
  );
  k.shell(
    body,
    sections.map(([z, w, b]) => [z, Math.max(0.008, w - 0.006), b - 0.0012, b + 0.0006]),
    paint,
    'deck-graphic',
    { e: 6, n: 16 },
  );
  const urethane = material(
    'urethane-wheels',
    electric ? '#3a3f44' : '#e7dfc8',
    0,
    electric ? 0.75 : 0.55,
  );
  const tk = {
    ...k,
    materials: {
      ...materials,
      cream: material('bushings', electric ? '#d0a03c' : '#c9572f', 0, 0.6),
    },
  };
  for (const [name, z, side] of [
    ['truck-front', spec.wheelbase / 2, -1],
    ['truck-rear', -spec.wheelbase / 2, 1],
  ])
    truck(tk, name, z, {
      deckBottom,
      axleY,
      hanger: spec.hanger,
      axle: spec.axle,
      wheel: spec.wheel,
      urethane,
      side,
    });
  // Mounting bolts: four heads through the grip tape over each baseplate.
  const top = deckBottom + spec.thick + 0.0014;
  for (const z of [spec.wheelbase / 2, -spec.wheelbase / 2])
    for (const dx of [-0.02, 0.02])
      for (const dz of [-0.028, 0.028])
        k.mesh(body, new T.CylinderGeometry(0.0045, 0.0045, 0.002, 8), metal).position.set(
          dx,
          top,
          z + dz,
        );
  if (!electric) return;
  // Electric: battery enclosure between the trucks, motor on the rear hanger's right, its belt
  // and pulley guard, a charge port and power button; small lamps front and rear.
  const under = deckBottom - 0.002;
  k.shell(
    body,
    [
      [0.22, 0.05, under - 0.03, under],
      [0.19, 0.075, under - 0.042, under],
      [-0.17, 0.075, under - 0.042, under],
      [-0.2, 0.05, under - 0.03, under],
    ],
    dark,
    'battery-enclosure',
    { e: 3.2, bottom: 0.25 },
  );
  for (let i = -3; i <= 3; i++)
    k.box(body, [0.12, 0.003, 0.006], [0, under - 0.043, i * 0.05], metal);
  k.box(body, [0.03, 0.012, 0.02], [0.06, under - 0.02, -0.19], metal, 'power-button');
  const rear = body.getObjectByName('truck-rear');
  // The motor hangs from the hanger behind the axle, inboard of the right wheel; a guard covers
  // the belt down to that wheel's pulley.
  k.cylinderX(rear, [-0.036, 0.002, -0.05], 0.026, 0.04, metal, 14);
  k.cylinderX(rear, [-0.016, 0.002, -0.05], 0.027, 0.006, dark, 14);
  k.box(rear, [0.006, 0.06, 0.1], [-0.058, 0.002, -0.026], dark, 'belt-guard');
}

/**
 * Shared electric kick scooter: a thick battery deck, a raked stem carrying the bars, display,
 * lamp and phone mount, small pneumatic wheels with a fender over each, a kickstand.
 */
function buildKickScooter(k) {
  const { s, G, root, body, materials } = k;
  const { paint, dark, metal, cream } = materials;
  const { R, F, axisAt } = G;
  // Wheels: pneumatic tyres on five-spoke alloy rims.
  const tyreW = 0.055;
  const rear = wheelGroup(root, 'wheel-rear', R);
  const front = wheelGroup(root, 'wheel-front', F);
  for (const w of [rear, front]) {
    smallWheel(k, w.spin, s.wheelRadius, tyreW, dark, metal, { lip: 0.4, coreRadius: 0.62 });
    k.cylinderX(w.spin, [0, 0, 0], 0.032, 0.07, dark, 14);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const spoke = k.box(w.spin, [0.03, s.wheelRadius * 0.42, 0.016], [0, 0, 0], metal);
      spoke.rotation.x = a;
      spoke.position.set(0, Math.cos(a) * 0.055, Math.sin(a) * 0.055);
    }
  }
  const fork = k.steered(front.g, G.tilt);
  const handlebar = new T.Group();
  handlebar.name = 'handlebar';
  handlebar.position.set(...G.pivot);
  root.add(handlebar);
  const bars = k.steered(handlebar, G.barTilt);
  // Deck: a deep rounded slab holding the battery, a rubber mat in a shallow tray on top.
  const top = G.deck.top,
    bottom = G.deck.bottom;
  k.shell(
    body,
    [
      [G.deck.rear, 0.07, bottom + 0.012, top - 0.004],
      [G.deck.rear + 0.03, 0.088, bottom, top],
      [G.deck.front - 0.05, 0.09, bottom, top],
      [G.deck.front, 0.08, bottom + 0.006, top],
    ],
    paint,
    'deck',
    { e: 3.4, bottom: 0.18 },
  );
  k.box(
    body,
    [0.15, 0.004, G.deck.front - G.deck.rear - 0.08],
    [0, top + 0.001, (G.deck.front + G.deck.rear) / 2],
    dark,
    'deck-mat',
  );
  for (let i = -6; i <= 6; i++)
    k.box(
      body,
      [0.14, 0.003, 0.008],
      [0, top + 0.004, (G.deck.front + G.deck.rear) / 2 + i * 0.036],
      dark,
    );
  // Side light strips and the underside skid plate.
  for (const side of [-1, 1])
    k.box(body, [0.004, 0.012, 0.36], [side * 0.091, (top + bottom) / 2, -0.03], metal);
  k.box(body, [0.13, 0.006, 0.42], [0, bottom - 0.002, -0.03], dark, 'skid-plate');
  // Neck: the deck's front sweeps up into the steering head.
  const head0 = axisAt(G.headBottom),
    head1 = axisAt(G.headTop);
  k.shell(
    body,
    [
      [G.deck.front - 0.06, 0.082, bottom + 0.004, top],
      [G.deck.front, 0.075, bottom + 0.012, top + 0.02],
      [G.deck.front + 0.05, 0.066, bottom + 0.06, top + 0.07],
      [head0[2] - 0.035, 0.052, head0[1] - 0.075, head0[1] + 0.012],
      [head0[2] + 0.004, 0.042, head0[1] - 0.045, head0[1] + 0.03],
    ],
    paint,
    'neck',
    { e: 2.8 },
  );
  k.tube(body, [head0, head1], 0.036, paint, 14, 'steering-head');
  k.tube(body, [axisAt(G.headTop - 0.012), axisAt(G.headTop + 0.004)], 0.039, dark, 14);
  // Fork: a single-sided crown and twin legs to the axle; the fender turns with it.
  const crown = axisAt(G.headBottom - 0.02);
  k.box(fork, [0.11, 0.04, 0.05], crown, dark, 'fork-crown');
  for (const x of [-0.042, 0.042])
    k.tube(
      fork,
      [
        [x, crown[1] - 0.01, crown[2] + 0.004],
        [x, F[1], F[2]],
      ],
      0.014,
      dark,
      8,
    );
  k.fender(fork, F, s.wheelRadius + 0.018, -25, 62, 0.042, 0.018, paint, 'front-fender', 12);
  // Stem: a deep rounded tube, the folding latch at its foot, display and bars at its head.
  const stem0 = axisAt(G.headTop + 0.004),
    stem1 = axisAt(G.grip[1] - 0.02);
  const dir = new T.Vector3(0, stem1[1] - stem0[1], stem1[2] - stem0[2]);
  const length = dir.length();
  dir.normalize();
  k.barrel(
    bars,
    stem0,
    dir.toArray(),
    [
      [0, 1.15],
      [0.03, 1.15],
      [0.04, 1],
      [length - 0.02, 1],
      [length, 0.9],
    ],
    [0.027, 0.034],
    paint,
    { n: 14, e: 2.6 },
  );
  const latch = axisAt(G.headTop + 0.06);
  k.box(bars, [0.06, 0.05, 0.035], [0, latch[1], latch[2] - 0.035], dark, 'stem-latch');
  const [gx, gy, gz] = G.grip;
  k.tube(
    bars,
    [
      [-gx - 0.01, gy, gz + 0.006],
      [gx + 0.01, gy, gz + 0.006],
    ],
    0.012,
    metal,
    10,
    'bars',
  );
  for (const side of [-1, 1])
    k.tube(
      bars,
      [
        [side * (gx - 0.075), gy, gz + 0.005],
        [side * (gx + 0.018), gy, gz + 0.003],
      ],
      0.0175,
      dark,
      12,
    );
  // Bar housing: display above the clamp, angled up toward the rider.
  k.shell(
    bars,
    [
      [gz - 0.045, 0.04, gy - 0.02, gy + 0.025],
      [gz - 0.02, 0.07, gy - 0.025, gy + 0.035],
      [gz + 0.04, 0.07, gy - 0.025, gy + 0.03],
      [gz + 0.06, 0.045, gy - 0.02, gy + 0.018],
    ],
    paint,
    'bar-housing',
    { e: 3, top: 0.15 },
  );
  // Headlamp on the stem's face and a reflector below; the phone cradle above the display.
  const lampAt = axisAt(0.82);
  k.lamp(bars, [0, lampAt[1], lampAt[2] + 0.04], 0.026, 0.03, dark);
  const plate = axisAt(0.6);
  k.box(bars, [0.075, 0.12, 0.006], [0, plate[1], plate[2] + 0.034], cream, 'share-plate');
  // Rear: dropouts from the deck to the axle, a fender (the foot brake) and the tail lamp.
  for (const x of [-0.045, 0.045])
    k.tube(
      body,
      [
        [x, bottom + 0.035, G.deck.rear + 0.04],
        [x, R[1] + 0.01, R[2]],
      ],
      0.013,
      dark,
      8,
    );
  k.cylinderX(body, R, 0.012, 0.11, metal, 10);
  k.fender(body, R, s.wheelRadius + 0.018, -112, 30, 0.045, 0.02, paint, 'rear-fender', 12);
  k.box(
    body,
    [0.05, 0.022, 0.012],
    [0, R[1] + 0.06, R[2] - s.wheelRadius - 0.03],
    materials.red,
    'tail-lamp',
  );
  // Kickstand folded along the left of the deck.
  k.tube(
    body,
    [
      [0.088, bottom + 0.01, -0.02],
      [0.105, bottom - 0.035, -0.2],
    ],
    0.009,
    dark,
    6,
  );
}

/** Close detail for the kick scooter: brake lever, thumb throttle, bell, display, plate marks. */
function kickScooterDetail(root, s) {
  const G = s.cycleFrame;
  const frame = root.getObjectByName('handlebar-frame');
  const controls = detailKit(frame, 'rider-controls');
  const [gx, gy, gz] = G.grip;
  // Brake lever on the left grip, thumb throttle on the right, a bell inboard of the left grip.
  controls.box([0.03, 0.022, 0.035], [gx - 0.09, gy + 0.01, gz + 0.02], controls.dark);
  controls.rod([gx - 0.08, gy + 0.004, gz + 0.04], [gx + 0.01, gy - 0.012, gz + 0.065], 0.005);
  controls.box([0.032, 0.03, 0.022], [-(gx - 0.085), gy + 0.008, gz - 0.012], controls.dark);
  controls.box([0.022, 0.006, 0.026], [-(gx - 0.105), gy + 0.008, gz - 0.03], controls.dark);
  controls.add(new T.SphereGeometry(0.018, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), controls.metal, [
    gx - 0.13,
    gy + 0.012,
    gz,
  ]);
  tilted(controls, [0, gy + 0.034, gz + 0.012], 1.15, (_k, p) =>
    p.display(0, 0, 0, 0.07, 0.035, 'ride'),
  );
  // Phone cradle: two jaws on a stalk ahead of the display.
  controls.rod([0, gy + 0.03, gz + 0.05], [0, gy + 0.07, gz + 0.07], 0.006, controls.dark);
  controls.box([0.08, 0.008, 0.012], [0, gy + 0.075, gz + 0.07], controls.dark);
  controls.finish();
  // Fleet marks on the stem plate: an operator name above a scan code.
  const d = detailKit(frame, 'fleet-marks');
  const at = G.axisAt(0.6);
  d.text('BENDY', [0, at[1] + 0.035, at[2] + 0.0385], 0.016, 0, d.dark);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++)
      if ((i * 7 + j * 3 + i * j) % 3 !== 0)
        d.box(
          [0.008, 0.008, 0.001],
          [-0.02 + i * 0.01, at[1] - 0.02 + j * 0.01, at[2] + 0.0375],
          d.dark,
        );
  d.finish();
}

/** Steered wheels and bars shared by the mopeds: returns the fork and bar frames. */
function mopedChassis(k, style) {
  const { G, root } = k;
  const [rearTire, frontTire] = Array.isArray(G.tire[0]) ? G.tire : [G.tire, G.tire];
  const rear = k.cycleWheel('wheel-rear', G.R, rearTire, style);
  const front = k.cycleWheel('wheel-front', G.F, frontTire, style);
  const fork = k.steered(front, G.tilt);
  const handlebar = new T.Group();
  handlebar.name = 'handlebar';
  handlebar.position.set(...G.pivot);
  root.add(handlebar);
  const bars = k.steered(handlebar, G.barTilt);
  // Fork legs run parallel to the steering axis, through the axle.
  const legs = (x, y) => [x, y, G.F[2] - (y - G.F[1]) / Math.tan(G.ha)];
  return { rear, front, fork, bars, legs };
}

/** Handlebar tubes from a cover out to rubber grips (bars frame). */
function mopedBars(k, bars, from) {
  const { dark, metal } = k.materials;
  const [gx, gy, gz] = k.G.grip;
  for (const side of [-1, 1]) {
    k.tube(
      bars,
      [
        [side * from, gy, gz + 0.06],
        [side * (gx + 0.05), gy, gz - 0.012],
      ],
      0.011,
      metal,
      8,
    );
    k.tube(
      bars,
      [
        [side * (gx - 0.055), gy, gz + 0.012],
        [side * (gx + 0.055), gy, gz - 0.012],
      ],
      0.0175,
      dark,
      10,
    );
  }
}

/**
 * Underbone moped (the step-through commuter of South and Southeast Asia): a pressed backbone
 * under a plastic tunnel, leg shields, a horizontal single beneath it, telescopic fork, 17-inch
 * spoked wheels, chain case and twin shocks, a long seat and a rear rack.
 */
function buildUnderbone(k) {
  const { G, body, materials } = k;
  const { paint, cream, dark, metal, red } = materials;
  const { R, F, axisAt } = G;
  const { fork, bars, legs } = mopedChassis(k, 'wire');
  // Telescopic fork: shrouded stanchions, rubber gaiters and alloy sliders to the axle.
  const yoke = 0.74;
  for (const side of [-1, 1]) {
    const x = side * G.forkWidth;
    k.tube(fork, [legs(x, yoke + 0.03), legs(x, 0.6)], 0.024, paint, 10);
    k.tube(fork, [legs(x, 0.6), legs(x, 0.5)], 0.027, dark, 10);
    k.tube(fork, [legs(x, 0.5), legs(x, F[1] + 0.03)], 0.023, metal, 10);
    k.box(fork, [0.03, 0.05, 0.06], legs(x, F[1] + 0.01), metal);
  }
  k.box(fork, [G.forkWidth * 2 + 0.07, 0.035, 0.075], legs(0, yoke), dark, 'bottom-yoke');
  k.cylinderX(fork, F, 0.012, G.forkWidth * 2 + 0.08, metal, 10);
  k.fender(fork, F, G.rf + 0.03, -38, 64, 0.06, 0.045, paint, 'front-fender', 12);
  // Steering-head cover: a rounded shell round the head tube below the bars.
  const head0 = axisAt(G.headBottom - 0.1),
    head1 = axisAt(G.headTop);
  const up = new T.Vector3(0, head1[1] - head0[1], head1[2] - head0[2]);
  const span = up.length();
  up.normalize();
  k.barrel(
    body,
    head0,
    up.toArray(),
    [
      [0, 0.72],
      [0.05, 1],
      [span - 0.02, 1],
      [span + 0.02, 0.8],
    ],
    [0.075, 0.07],
    paint,
    { n: 14, e: 2.4 },
  );
  // Leg shields: a broad curved panel ahead of the rider's shins, wrapping the head cover.
  const rows = [
    [0.33, 0.29, 0.24, 0.1],
    [0.45, 0.33, 0.275, 0.19],
    [0.6, 0.355, 0.295, 0.215],
    [0.74, 0.34, 0.285, 0.2],
    [0.86, 0.3, 0.255, 0.14],
    [0.92, 0.27, 0.235, 0.085],
  ];
  k.ringLoft(
    body,
    rows.map(([y, front, back, hw]) => {
      const n = 7;
      const outer = Array.from({ length: n }, (_, i) => {
        const x = -hw + (2 * hw * i) / (n - 1);
        return [
          x,
          y,
          back + 0.025 + (front - back - 0.025) * Math.sqrt(Math.max(0, 1 - (x / hw) * (x / hw))),
        ];
      });
      const inner = outer.map(([x, , z]) => [x * 0.97, y, Math.max(back, z - 0.03)]).reverse();
      return [...outer, ...inner];
    }),
    cream,
    'leg-shield',
  );
  // The backbone's plastic tunnel: down from the head cover, low through the step-through,
  // rising under the seat.
  k.tube(
    body,
    [
      [0, 0.64, 0.29],
      [0, 0.53, 0.2],
      [0, 0.47, 0.06],
      [0, 0.48, -0.08],
      [0, 0.53, -0.18],
    ],
    0.062,
    paint,
    12,
    'tunnel',
  );
  // Body under the seat: side covers bulging over the frame, tapering to the tail.
  k.shell(
    body,
    [
      [-0.1, 0.09, 0.47, 0.6],
      [-0.18, 0.15, 0.42, 0.69],
      [-0.36, 0.165, 0.44, 0.715],
      [-0.56, 0.155, 0.5, 0.715],
      [-0.74, 0.12, 0.57, 0.705],
      [-0.86, 0.07, 0.61, 0.69],
    ],
    paint,
    'side-covers',
    { e: 2.5, top: 0.15, bottom: 0.1 },
  );
  // Seat: a long dual seat, rounded nose, slight step for the pillion.
  k.shell(
    body,
    [
      [-0.08, 0.07, 0.7, 0.745],
      [-0.13, 0.125, 0.698, 0.775],
      [-0.32, 0.135, 0.7, 0.782],
      [-0.55, 0.13, 0.702, 0.792],
      [-0.74, 0.11, 0.704, 0.785],
      [-0.81, 0.07, 0.708, 0.765],
    ],
    dark,
    'saddle',
    { e: 2.8, top: 0.2, bottom: 0.3 },
  );
  // Engine: crankcase under the tunnel, a finned horizontal barrel pointing forward.
  k.shell(
    body,
    [
      [0.1, 0.07, 0.2, 0.36],
      [0.04, 0.12, 0.17, 0.41],
      [-0.18, 0.125, 0.17, 0.42],
      [-0.28, 0.09, 0.2, 0.38],
    ],
    metal,
    'crankcase',
    { e: 2.6 },
  );
  k.barrel(
    body,
    [0, 0.31, 0.08],
    [0, 0.12, 0.9928],
    k.fins(0.02, 0.2, 7, 0.78),
    [0.062, 0.058],
    metal,
    { n: 12, e: 3 },
  );
  k.shell(
    body,
    [
      [-0.06, 0.035, 0.24, 0.34, 0.135],
      [-0.2, 0.035, 0.22, 0.36, 0.135],
    ],
    metal,
  );
  // Exhaust down from the head, along the right and into a shielded silencer by the wheel.
  k.tube(
    body,
    [
      [0, 0.28, 0.27],
      [-0.04, 0.17, 0.22],
      [-0.11, 0.15, 0.04],
      [-0.15, 0.19, -0.26],
    ],
    0.022,
    metal,
    8,
  );
  k.barrel(
    body,
    [-0.155, 0.2, -0.26],
    [0, 0.14, -0.9902],
    [
      [0, 0.55],
      [0.05, 1],
      [0.4, 1],
      [0.46, 0.7],
    ],
    [0.046, 0.046],
    metal,
    { n: 12, e: 2 },
  );
  k.shell(
    body,
    [
      [-0.32, 0.03, 0.25, 0.3, -0.2],
      [-0.62, 0.03, 0.29, 0.34, -0.2],
    ],
    dark,
  );
  // Swingarm, chain case on the left, twin shocks, rear fender, rack, tail lamp and plate.
  for (const side of [-1, 1])
    k.tube(
      body,
      [
        [side * 0.09, 0.33, -0.12],
        [side * 0.085, R[1], R[2]],
      ],
      0.02,
      dark,
      8,
    );
  k.shell(
    body,
    [
      [-0.1, 0.022, 0.25, 0.37, 0.115],
      [-0.16, 0.026, 0.21, 0.38, 0.115],
      [-0.6, 0.026, 0.22, 0.35, 0.115],
      [-0.66, 0.022, 0.25, 0.33, 0.115],
    ],
    dark,
    'chain-case',
    { e: 2.6 },
  );
  for (const side of [-1, 1]) {
    k.tube(
      body,
      [
        [side * 0.115, R[1] + 0.04, R[2] + 0.04],
        [side * 0.12, 0.5, -0.5],
      ],
      0.012,
      metal,
      8,
    );
    k.tube(
      body,
      [
        [side * 0.12, 0.49, -0.505],
        [side * 0.125, 0.69, -0.47],
      ],
      0.026,
      dark,
      10,
    );
  }
  k.fender(body, R, G.rr + 0.035, -98, 28, 0.075, 0.06, paint, 'rear-fender', 12);
  k.tube(
    body,
    [
      [0.12, 0.79, -0.6],
      [0.125, 0.8, -0.82],
      [0.08, 0.805, -0.9],
      [-0.08, 0.805, -0.9],
      [-0.125, 0.8, -0.82],
      [-0.12, 0.79, -0.6],
    ],
    0.011,
    metal,
    6,
  );
  for (const x of [-0.11, 0, 0.11])
    k.tube(
      body,
      [
        [x, 0.805, -0.62],
        [x, 0.805, -0.88],
      ],
      0.007,
      metal,
      6,
    );
  k.barrel(
    body,
    [0, G.tail[1], G.tail[0]],
    [0, -0.1, -0.995],
    [
      [0, 1],
      [0.035, 1],
      [0.05, 0.75],
    ],
    [0.06, 0.035],
    red,
    { n: 12, e: 2.4 },
  );
  k.box(body, [0.16, 0.11, 0.008], [0, 0.55, -0.93], dark, 'plate');
  // Footpegs, gear pedal, kick starter and side stand.
  for (const side of [-1, 1]) {
    k.tube(
      body,
      [
        [side * 0.05, 0.29, -0.04],
        [side * 0.2, 0.29, -0.04],
      ],
      0.01,
      metal,
      6,
    );
    k.cylinderX(body, [side * 0.17, 0.29, -0.04], 0.018, 0.08, dark, 8);
  }
  k.tube(
    body,
    [
      [0.12, 0.3, 0.0],
      [0.14, 0.33, 0.17],
    ],
    0.008,
    metal,
    6,
  );
  k.tube(
    body,
    [
      [-0.12, 0.34, -0.1],
      [-0.135, 0.36, -0.28],
    ],
    0.009,
    metal,
    6,
  );
  k.tube(
    body,
    [
      [0.08, 0.2, -0.1],
      [0.12, 0.08, -0.32],
    ],
    0.012,
    dark,
    6,
  );
  // Handlebar cover: headlamp in its nose, the bars leaving its flanks.
  const [, gy, gz] = G.grip;
  k.shell(
    bars,
    [
      [gz - 0.06, 0.07, gy - 0.05, gy + 0.03],
      [gz - 0.02, 0.15, gy - 0.07, gy + 0.045],
      [gz + 0.08, 0.15, gy - 0.075, gy + 0.05],
      [gz + 0.15, 0.115, gy - 0.07, gy + 0.04],
      [gz + 0.19, 0.075, gy - 0.06, gy + 0.025],
    ],
    paint,
    'handlebar-cowl',
    { e: 2.6, top: 0.2, bottom: 0.1 },
  );
  k.tube(bars, [axisAt(G.headTop - 0.05), axisAt(gy - 0.05)], 0.032, dark, 10);
  k.lamp(bars, G.headlamp, 0.055, 0.03, paint);
  mopedBars(k, bars, 0.14);
}

/**
 * Electric moped (the battery scooter of Chinese and Southeast Asian streets): a flat floor over
 * the battery, a squared apron with a lamp bar, 12-inch cast wheels, a rear hub motor on a
 * single-sided arm, a slim tail with a carrier, and a basket on the bars.
 */
function buildElectricMoped(k) {
  const { G, body, materials } = k;
  const { paint, cream, dark, metal, red } = materials;
  const { R, F, axisAt } = G;
  const { rear, fork, bars, legs } = mopedChassis(k, 'cast');
  // Hub motor: a deep drum filling the rear wheel's centre, turning with it.
  const spin = rear.children[0];
  k.cylinderX(spin, [0, 0, 0], 0.105, 0.075, metal, 24);
  k.cylinderX(spin, [0, 0, 0], 0.07, 0.085, dark, 18);
  // Telescopic fork to the front axle, fender turning with it.
  for (const side of [-1, 1]) {
    const x = side * G.forkWidth;
    k.tube(fork, [legs(x, G.headBottom), legs(x, 0.38)], 0.022, dark, 10);
    k.tube(fork, [legs(x, 0.38), legs(x, F[1] + 0.02)], 0.025, metal, 10);
  }
  k.box(fork, [G.forkWidth * 2 + 0.06, 0.03, 0.07], legs(0, G.headBottom), dark, 'bottom-yoke');
  k.cylinderX(fork, F, 0.012, G.forkWidth * 2 + 0.07, metal, 10);
  k.fender(fork, F, G.rf + 0.03, -34, 72, 0.075, 0.05, paint, 'front-fender', 12);
  // Apron: a squared shell ahead of the rider's legs; its inner face carries a parcel hook.
  const rows = [
    [0.31, 0.37, 0.32, 0.16],
    [0.45, 0.43, 0.37, 0.2],
    [0.6, 0.485, 0.415, 0.215],
    [0.75, 0.47, 0.405, 0.2],
    [0.88, 0.425, 0.365, 0.16],
    [0.96, 0.37, 0.325, 0.1],
  ];
  k.ringLoft(
    body,
    rows.map(([y, front, back, hw]) => {
      const n = 7;
      const outer = Array.from({ length: n }, (_, i) => {
        const x = -hw + (2 * hw * i) / (n - 1);
        const c = Math.pow(Math.abs(x / hw), 3);
        return [x, y, back + 0.02 + (front - back - 0.02) * (1 - c)];
      });
      const inner = outer.map(([x, , z]) => [x * 0.97, y, Math.max(back, z - 0.03)]).reverse();
      return [...outer, ...inner];
    }),
    paint,
    'apron',
  );
  // Lamp bar across the apron's face and a lower vent band.
  k.box(body, [0.2, 0.035, 0.02], [0, 0.82, 0.457], materials.light, 'headlamp');
  k.box(body, [0.23, 0.05, 0.016], [0, 0.82, 0.452], dark);
  k.box(body, [0.16, 0.012, 0.012], [0, 0.55, 0.43 + 0.04], dark);
  k.box(body, [0.16, 0.012, 0.012], [0, 0.52, 0.42 + 0.04], dark);
  // Flat floor over the battery tray, rubber mat and side rails.
  const floor = G.floor;
  k.loft(
    body,
    [
      [0.34, 0.17, floor - 0.12, floor],
      [-0.18, 0.17, floor - 0.12, floor],
      [-0.26, 0.17, floor - 0.08, floor + 0.02],
    ],
    paint,
    'floorboard',
  );
  k.box(body, [0.3, 0.006, 0.46], [0, floor + 0.003, 0.08], dark, 'floor-mat');
  for (const side of [-1, 1])
    k.box(body, [0.012, 0.012, 0.5], [side * 0.165, floor + 0.004, 0.08], metal);
  k.box(body, [0.3, 0.05, 0.52], [0, floor - 0.145, 0.06], dark, 'battery-tray');
  // Rear body: rises behind the floor, slim and squared, tapering to the tail lamp.
  k.shell(
    body,
    [
      [-0.2, 0.15, floor - 0.02, 0.6],
      [-0.26, 0.19, floor + 0.02, 0.72],
      [-0.46, 0.2, 0.34, 0.735],
      [-0.66, 0.185, 0.4, 0.735],
      [-0.84, 0.14, 0.47, 0.725],
      [-0.94, 0.08, 0.53, 0.71],
    ],
    paint,
    'rear-body',
    { e: 3.2, top: 0.12, bottom: 0.08 },
  );
  k.shell(
    body,
    [
      [-0.06, 0.08, 0.735, 0.775],
      [-0.12, 0.15, 0.73, 0.8],
      [-0.42, 0.16, 0.73, 0.805],
      [-0.5, 0.155, 0.735, 0.83],
      [-0.78, 0.13, 0.735, 0.835],
      [-0.84, 0.08, 0.74, 0.81],
    ],
    dark,
    'saddle',
    { e: 2.8, top: 0.2, bottom: 0.3 },
  );
  // Single-sided swing arm and shock on the left, the motor cable, carrier and tail lamp.
  k.shell(
    body,
    [
      [-0.26, 0.02, 0.24, 0.34, 0.12],
      [-0.6, 0.022, R[1] - 0.04, R[1] + 0.05, 0.11],
    ],
    dark,
    'swing-arm',
    { e: 2.4 },
  );
  k.tube(
    body,
    [
      [0.12, R[1] + 0.05, R[2] + 0.05],
      [0.13, 0.56, -0.62],
    ],
    0.022,
    metal,
    8,
  );
  k.tube(
    body,
    [
      [0.12, 0.33, -0.3],
      [0.1, R[1] + 0.02, R[2] + 0.1],
    ],
    0.007,
    dark,
    6,
  );
  k.fender(body, R, G.rr + 0.03, -100, 32, 0.08, 0.05, dark, 'rear-hugger', 12);
  k.tube(
    body,
    [
      [0.12, 0.81, -0.62],
      [0.125, 0.82, -0.9],
      [0.08, 0.825, -0.98],
      [-0.08, 0.825, -0.98],
      [-0.125, 0.82, -0.9],
      [-0.12, 0.81, -0.62],
    ],
    0.012,
    metal,
    6,
  );
  k.box(body, [0.22, 0.012, 0.3], [0, 0.828, -0.82], dark, 'carrier-plate');
  k.box(body, [0.17, 0.03, 0.02], [0, 0.66, -0.947], red, 'tail-lamp');
  k.box(body, [0.16, 0.11, 0.008], [0, 0.5, -0.93], dark, 'plate');
  // Footrests for a pillion folded against the rear body.
  for (const side of [-1, 1]) k.box(body, [0.05, 0.015, 0.07], [side * 0.2, 0.36, -0.42], dark);
  // Handlebar cover with the display, steering column shroud, bars and the front basket.
  const [, gy, gz] = G.grip;
  k.shell(
    bars,
    [
      [gz - 0.05, 0.08, gy - 0.04, gy + 0.03],
      [gz - 0.01, 0.16, gy - 0.06, gy + 0.05],
      [gz + 0.08, 0.16, gy - 0.065, gy + 0.05],
      [gz + 0.14, 0.11, gy - 0.07, gy + 0.03],
    ],
    paint,
    'handlebar-cowl',
    { e: 3, top: 0.15, bottom: 0.1 },
  );
  k.tube(bars, [axisAt(0.78), axisAt(gy - 0.04)], 0.045, paint, 12);
  mopedBars(k, bars, 0.15);
  const basket = { x: 0.16, bottom: gy - 0.11, top: gy + 0.03, back: gz + 0.2, front: gz + 0.39 };
  const bx = (basket.front + basket.back) / 2,
    bd = basket.front - basket.back,
    bh = basket.top - basket.bottom,
    by = (basket.top + basket.bottom) / 2;
  // Wire basket: a solid floor, a rim and corner posts, open mesh walls of thin wires.
  k.box(bars, [basket.x * 2, 0.008, bd], [0, basket.bottom, bx], dark, 'basket');
  const corners = [
    [-basket.x, basket.back],
    [basket.x, basket.back],
    [basket.x, basket.front],
    [-basket.x, basket.front],
  ];
  k.tube(
    bars,
    [...corners, corners[0]].map(([x, z]) => [x, basket.top, z]),
    0.006,
    dark,
    6,
    'basket-rim',
  );
  for (const [x, z] of corners)
    k.tube(
      bars,
      [
        [x, basket.bottom, z],
        [x, basket.top, z],
      ],
      0.005,
      dark,
      6,
    );
  for (let i = 1; i < 3; i++) {
    const y = basket.bottom + (bh * i) / 3;
    k.tube(
      bars,
      [...corners, corners[0]].map(([x, z]) => [x, y, z]),
      0.0025,
      dark,
      4,
    );
  }
  for (let i = 1; i < 8; i++) {
    const x = -basket.x + (2 * basket.x * i) / 8;
    for (const z of [basket.back, basket.front])
      k.tube(
        bars,
        [
          [x, basket.bottom, z],
          [x, basket.top, z],
        ],
        0.0025,
        dark,
        4,
      );
  }
  for (let i = 1; i < 6; i++) {
    const z = basket.back + (bd * i) / 6;
    for (const x of [-basket.x, basket.x])
      k.tube(
        bars,
        [
          [x, basket.bottom, z],
          [x, basket.top, z],
        ],
        0.0025,
        dark,
        4,
      );
  }
  k.box(bars, [0.04, 0.05, 0.05], [0, basket.bottom - 0.02, basket.back - 0.02], metal);
  void cream;
  void by;
}

/** Close detail for the mopeds: levers and switch housings, mirrors, gauges, indicators, badge. */
function mopedDetail(root, s) {
  const G = s.cycleFrame;
  const electric = s.shape === 'electric-moped';
  const frame = root.getObjectByName('handlebar-frame');
  const controls = detailKit(frame, 'rider-controls');
  const d = detailKit(root);
  const [gx, gy, gz] = G.grip;
  for (const side of [-1, 1]) {
    const x = side * gx;
    controls.box([0.05, 0.035, 0.04], [x - side * 0.09, gy, gz + 0.012], controls.dark);
    controls.box([0.04, 0.025, 0.03], [x - side * 0.085, gy + 0.012, gz + 0.04], controls.metal);
    controls.rod(
      [x - side * 0.07, gy + 0.008, gz + 0.05],
      [x + side * 0.06, gy - 0.004, gz + 0.08],
      0.006,
    );
    controls.rod(
      [x - side * 0.1, gy + 0.025, gz + 0.03],
      [x + side * 0.02, gy + 0.12, gz + 0.05],
      0.0065,
    );
    for (const [r, depth, z, material] of [
      [0.04, 0.02, gz + 0.056, controls.dark],
      [0.035, 0.004, gz + 0.044, controls.metal],
    ]) {
      const head = controls.add(new T.CylinderGeometry(r, r, depth, 16), material, [
        x + side * 0.045,
        gy + 0.14,
        z,
      ]);
      head.rotation.x = Math.PI / 2;
      head.scale.set(1, 1, 0.64);
    }
  }
  if (electric)
    tilted(controls, [0, gy + 0.052, gz + 0.05], 0.85, (_k, p) =>
      p.display(0, 0, 0, 0.13, 0.05, 'driver'),
    );
  else
    tilted(controls, [0, gy + 0.05, gz + 0.04], 0.8, (k, p) => {
      p.gauge(0, 0, 0, 0.05, k.ivory);
    });
  // Indicators: amber lenses on the cover's flanks (they turn with it) and beside the tail.
  const lens = (kit, at, size) => {
    const m = kit.add(new T.SphereGeometry(1, 10, 6), kit.amber, at);
    m.scale.set(...size);
  };
  for (const side of [-1, 1]) {
    lens(controls, [side * 0.15, gy - 0.02, gz + 0.12], [0.018, 0.022, 0.03]);
    lens(
      d,
      electric ? [side * 0.13, 0.66, -0.94] : [side * 0.12, 0.7, -0.86],
      [0.03, 0.018, 0.016],
    );
  }
  controls.finish();
  if (G.badge)
    for (const side of [-1, 1])
      d.text(
        'BENDY',
        [side * G.badge[0], G.badge[1], G.badge[2]],
        G.badge[3],
        (side * Math.PI) / 2,
      );
  d.finish();
}

/**
 * Auto-rickshaw (the three-wheeled taxi of South Asia, also East Africa, Egypt and Southeast
 * Asia): a steel body painted in the city's colour under a canvas canopy, open sides, a nose
 * cowl over the single steered front wheel, handlebar steering, the driver's saddle ahead of a
 * three-seat rear bench, and a rear-mounted engine between the two driven rear wheels.
 */
function buildAutoRickshaw(k) {
  const { s, G, root, body, materials, material } = k;
  const { paint, cream, dark, metal, red, glass } = materials;
  const { R, F, axisAt } = G;
  const canopy = material('canopy-fabric', '#e2b33c', 0, 0.85);
  const floorMat = material('floor-rubber', '#2a2d30', 0, 0.9);
  glass.transparent = true;
  glass.opacity = 0.28;
  glass.depthWrite = false;
  glass.side = T.DoubleSide;
  const r = s.wheelRadius;
  const halfTrack = s.wheelTrack / 2;
  // The body sits 4 cm behind the wheelbase centre: a short nose, the engine overhanging aft.
  const nose = s.length / 2 - 0.08,
    tail = -s.length / 2 - 0.035;
  // Wheels: pressed-steel discs on 8-inch rims; the front one steers with the bars.
  const tyreW = 0.1;
  const front = wheelGroup(root, 'wheel-front', F);
  const wheels = [front];
  for (const [side, x] of [
    ['left', halfTrack],
    ['right', -halfTrack],
  ])
    wheels.push(wheelGroup(root, `wheel-rear-${side}`, [x, R[1], R[2]]));
  for (const w of wheels) {
    smallWheel(k, w.spin, r, tyreW, dark, cream, { lip: 0.45, coreRadius: 0.55 });
    k.cylinderX(w.spin, [0, 0, 0], 0.045, tyreW + 0.012, metal, 12);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      k.cylinderX(
        w.spin,
        [0, Math.cos(a) * 0.07, Math.sin(a) * 0.07],
        0.012,
        tyreW + 0.004,
        dark,
        8,
      );
    }
  }
  const fork = k.steered(front.g, G.tilt);
  const handlebar = new T.Group();
  handlebar.name = 'handlebar';
  handlebar.position.set(...G.pivot);
  root.add(handlebar);
  const bars = k.steered(handlebar, G.barTilt);
  // Front suspension: a leading-link arm and shock down the right of the wheel; mudguard.
  const low = axisAt(0.56);
  k.tube(fork, [axisAt(0.7), low], 0.03, dark, 10);
  k.tube(
    fork,
    [
      [-0.075, low[1] - 0.02, low[2] + 0.01],
      [-0.075, F[1], F[2]],
    ],
    0.026,
    dark,
    8,
  );
  k.tube(
    fork,
    [
      [-0.075, low[1] + 0.08, low[2] - 0.04],
      [-0.08, F[1] + 0.07, F[2] + 0.05],
    ],
    0.02,
    metal,
    8,
  );
  k.cylinderX(fork, F, 0.014, 0.17, metal, 10);
  k.fender(fork, F, r + 0.04, -45, 70, 0.075, 0.055, paint, 'front-fender', 12);
  // Floor pan: driver's floor behind the front wheel, the passengers' footwell, a sill each side.
  const floor = G.floor;
  k.loft(
    body,
    [
      [0.66, 0.4, floor - 0.06, floor],
      [0.3, 0.58, floor - 0.06, floor],
      [-0.5, 0.62, floor - 0.06, floor],
    ],
    paint,
    'floor-pan',
  );
  k.box(body, [0.76, 0.006, 1.02], [0, floor + 0.003, 0.11], floorMat, 'floor-mat');
  for (const side of [-1, 1])
    k.box(body, [0.06, 0.06, 0.62], [side * 0.6, floor + 0.02, -0.22], dark, 'step-sill');
  // Nose cowl: rounded over the front wheel, skirts down to the floor behind it.
  k.shell(
    body,
    [
      [nose + 0.035, 0.27, 0.53, 0.84],
      [nose, 0.36, 0.49, 0.95],
      [nose - 0.13, 0.42, 0.48, 1.015],
      [nose - 0.27, 0.44, 0.48, 1.035],
      [0.8, 0.45, 0.48, 1.025],
    ],
    paint,
    'nose-cowl',
    { e: 3.2, top: 0.14, bottom: 0.05 },
  );
  k.shell(
    body,
    [
      [0.8, 0.45, floor - 0.02, 0.62],
      [0.72, 0.47, floor - 0.04, 0.6],
      [0.62, 0.47, floor - 0.04, 0.5],
    ],
    paint,
    'leg-skirt',
    { e: 3 },
  );
  // Dash fascia behind the cowl's top, facing the driver.
  k.shell(
    body,
    [
      [0.81, 0.42, 0.86, 1.03],
      [0.76, 0.4, 0.88, 1.02],
      [0.72, 0.36, 0.9, 0.99],
    ],
    dark,
    'dash',
    { e: 3.5 },
  );
  // Windscreen in a painted frame, A-pillars up to the canopy rail.
  const ws = { bottom: 1.035, top: s.height - 0.1, zb: nose - 0.3, zt: nose - 0.48 };
  const wsHalf = 0.4;
  const pane = new T.BufferGeometry();
  pane.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        -wsHalf,
        ws.bottom,
        ws.zb,
        wsHalf,
        ws.bottom,
        ws.zb,
        wsHalf - 0.02,
        ws.top,
        ws.zt,
        -wsHalf,
        ws.bottom,
        ws.zb,
        wsHalf - 0.02,
        ws.top,
        ws.zt,
        -wsHalf + 0.02,
        ws.top,
        ws.zt,
      ],
      3,
    ),
  );
  pane.computeVertexNormals();
  k.mesh(body, pane, glass, 'windscreen');
  for (const side of [-1, 1])
    k.tube(
      body,
      [
        [side * (wsHalf + 0.02), ws.bottom - 0.01, ws.zb + 0.01],
        [side * wsHalf, ws.top + 0.02, ws.zt],
      ],
      0.022,
      paint,
      8,
    );
  k.tube(
    body,
    [
      [-wsHalf, ws.top + 0.02, ws.zt],
      [wsHalf, ws.top + 0.02, ws.zt],
    ],
    0.018,
    dark,
    8,
  );
  k.tube(
    body,
    [
      [-wsHalf, ws.bottom + 0.005, ws.zb + 0.01],
      [wsHalf, ws.bottom + 0.005, ws.zb + 0.01],
    ],
    0.016,
    dark,
    8,
  );
  // Canopy: canvas stretched over hoops from the windscreen header to the tail, rounded down
  // at the back; rolled side curtains along its eaves.
  const roofY = s.height;
  const canopyRows = [
    [ws.zt + 0.05, 0.44, roofY - 0.09, roofY - 0.02],
    [ws.zt - 0.05, 0.5, roofY - 0.1, roofY],
    [-0.6, 0.62, roofY - 0.1, roofY],
    [-1.05, 0.64, roofY - 0.12, roofY - 0.01],
    [tail + 0.17, 0.64, roofY - 0.2, roofY - 0.04],
    [tail + 0.08, 0.62, roofY - 0.36, roofY - 0.12],
  ];
  k.shell(body, canopyRows, canopy, 'canopy', { e: 3.2, bottom: 0.6 });
  for (const side of [-1, 1])
    k.tube(
      body,
      [
        [side * 0.52, roofY - 0.11, ws.zt - 0.08],
        [side * 0.635, roofY - 0.12, -0.6],
        [side * 0.655, roofY - 0.13, -1.05],
      ],
      0.035,
      canopy,
      10,
      'rolled-curtain',
    );
  // Canopy frame: B-pillars behind the driver, C-pillars at the rear corners, a grab rail.
  for (const side of [-1, 1]) {
    k.tube(
      body,
      [
        [side * 0.6, floor + 0.04, -0.06],
        [side * 0.6, roofY - 0.1, -0.05],
      ],
      0.02,
      dark,
      8,
    );
    k.tube(
      body,
      [
        [side * 0.64, 0.9, tail + 0.12],
        [side * 0.63, roofY - 0.14, tail + 0.18],
      ],
      0.022,
      dark,
      8,
    );
  }
  k.tube(
    body,
    [
      [-0.55, 1.18, -0.07],
      [0.55, 1.18, -0.07],
    ],
    0.016,
    metal,
    8,
    'grab-rail',
  );
  // Driver's saddle on a pedestal, a low backrest against the passengers' side.
  const seatTop = G.seat[1] - 0.03;
  k.box(
    body,
    [0.34, seatTop - floor - 0.08, 0.36],
    [0, (seatTop + floor) / 2 - 0.04, G.seat[2] + 0.02],
    paint,
    'seat-pedestal',
  );
  k.shell(
    body,
    [
      [G.seat[2] + 0.23, 0.1, seatTop - 0.07, seatTop - 0.02],
      [G.seat[2] + 0.17, 0.19, seatTop - 0.08, seatTop],
      [G.seat[2] - 0.1, 0.22, seatTop - 0.08, seatTop + 0.005],
      [G.seat[2] - 0.16, 0.2, seatTop - 0.08, seatTop + 0.01],
    ],
    dark,
    'driver-saddle',
    { e: 2.8, top: 0.2 },
  );
  k.box(body, [0.42, 0.22, 0.05], [0, seatTop + 0.12, G.seat[2] - 0.19], dark, 'driver-backrest');
  // Rear bench: cushion and backrest across the body, over the engine compartment.
  const bench = { front: -0.42, back: -0.98, top: 0.7 };
  k.box(
    body,
    [1.0, bench.top - 0.08 - floor, 0.44],
    [0, (bench.top - 0.08 + floor) / 2, bench.front - 0.22],
    paint,
    'bench-base',
  );
  k.shell(
    body,
    [
      [bench.front, 0.55, bench.top - 0.09, bench.top - 0.02],
      [bench.front - 0.04, 0.58, bench.top - 0.1, bench.top],
      [bench.back + 0.04, 0.58, bench.top - 0.1, bench.top + 0.01],
    ],
    dark,
    'rear-bench',
    { e: 3.2, top: 0.15 },
  );
  k.box(body, [1.14, 0.45, 0.09], [0, bench.top + 0.25, bench.back - 0.02], dark, 'bench-back');
  // Rear body: quarter panels arched over the rear wheels, the engine bay behind the bench,
  // a tail panel with lamps, plate and the engine grille.
  const sideTop = 0.95;
  const archFront = R[2] + 0.23,
    archBack = R[2] - 0.23,
    archTop = R[1] + r + 0.06;
  for (const side of [-1, 1]) {
    const x = side * 0.645;
    k.box(
      body,
      [0.04, sideTop - floor, -0.55 - archFront],
      [x, (sideTop + floor) / 2, (archFront - 0.55) / 2],
      paint,
      'quarter-panel',
    );
    k.box(
      body,
      [0.04, sideTop - archTop, archFront - archBack],
      [x, (sideTop + archTop) / 2, R[2]],
      paint,
    );
    k.box(
      body,
      [0.04, sideTop - floor, archBack - tail],
      [x, (sideTop + floor) / 2, (archBack + tail) / 2],
      paint,
    );
    k.fender(
      body,
      [0, R[1], R[2]],
      r + 0.05,
      -80,
      80,
      0.07,
      0.03,
      dark,
      'arch-liner',
      10,
    ).position.x = side * halfTrack;
    k.box(
      body,
      [0.05, 0.035, archFront - tail],
      [x + side * 0.01, sideTop, (archFront + tail) / 2],
      paint,
      'waist-rail',
    );
  }
  k.box(
    body,
    [1.33, sideTop - floor + 0.02, 0.04],
    [0, (sideTop + floor) / 2, tail + 0.02],
    paint,
    'tail-panel',
  );
  // Engine cover: a deck behind the bench back, under the canopy's tail.
  k.box(
    body,
    [1.29, 0.03, bench.back - tail],
    [0, sideTop, (bench.back + tail) / 2],
    paint,
    'engine-cover',
  );
  for (const side of [-1, 1]) {
    k.box(body, [0.12, 0.08, 0.02], [side * 0.5, 0.82, tail - 0.002], red, 'tail-lamp');
    k.box(body, [0.06, 0.05, 0.018], [side * 0.5, 0.72, tail - 0.002], materials.light);
  }
  for (let i = 0; i < 6; i++)
    k.box(body, [0.3, 0.012, 0.012], [0, 0.42 + i * 0.03, tail - 0.004], dark);
  k.box(body, [0.32, 0.12, 0.008], [0, 0.66, tail - 0.006], cream, 'plate-rear');
  // Engine and exhaust under the rear: crankcase, silencer and tail pipe low on the right.
  k.shell(
    body,
    [
      [-0.85, 0.16, 0.2, 0.42],
      [-1.05, 0.18, 0.18, 0.44],
      [-1.2, 0.15, 0.2, 0.4],
    ],
    metal,
    'engine',
    { e: 2.6 },
  );
  k.barrel(
    body,
    [-0.3, 0.2, -0.95],
    [0, 0.0, -1],
    [
      [0, 0.7],
      [0.05, 1],
      [0.3, 1],
      [0.36, 0.6],
    ],
    [0.06, 0.06],
    metal,
    { n: 12, e: 2 },
  );
  k.tube(
    body,
    [
      [-0.3, 0.2, -1.31],
      [-0.3, 0.19, tail - 0.04],
    ],
    0.018,
    dark,
    8,
  );
  // Steering: column through the dash to the bars, a cover round the clamp, lamp on the nose.
  const [, gy, gz] = G.grip;
  k.tube(bars, [axisAt(0.86), axisAt(gy - 0.02)], 0.026, dark, 10);
  k.shell(
    bars,
    [
      [gz - 0.03, 0.06, gy - 0.035, gy + 0.025],
      [gz + 0.01, 0.12, gy - 0.045, gy + 0.035],
      [gz + 0.1, 0.12, gy - 0.05, gy + 0.03],
      [gz + 0.13, 0.08, gy - 0.045, gy + 0.02],
    ],
    paint,
    'bar-cover',
    { e: 2.8, top: 0.15 },
  );
  mopedBars(k, bars, 0.11);
  k.lamp(body, [0, 0.78, nose + 0.03], 0.075, 0.04, metal);
  k.box(body, [0.36, 0.12, 0.008], [0, 0.57, nose + 0.025], cream, 'plate-front');
  // The lit lamp: an emissive lens over the headlamp, shown by the `headlights` actuator.
  const lit = new T.Group();
  lit.name = 'headlights-lit';
  root.add(lit);
  const glow = material('headlight-emission', '#f2d999', 0, 0.4);
  glow.emissive.set('#fff1cf');
  glow.emissiveIntensity = 2;
  k.mesh(
    lit,
    new T.SphereGeometry(0.072, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.32).rotateX(Math.PI / 2),
    glow,
    'headlight-glow',
  ).position.set(0, 0.78, nose + 0.03 - 0.072 * Math.cos(Math.PI * 0.32) + 0.008);
  // One wiper on the windscreen: its mount lies in the glass, the arm sweeps up across it.
  const mount = new T.Group();
  mount.name = 'wiper-mount';
  mount.position.set(-wsHalf + 0.08, ws.bottom + 0.03, ws.zb - 0.009);
  mount.rotation.x = -Math.atan2(ws.zb - ws.zt, ws.top - ws.bottom);
  root.add(mount);
  const arm = new T.Group();
  arm.name = 'wiper';
  mount.add(arm);
  const wiper = detailKit(arm, 'wiper-skin');
  wiper.rod([0, 0, 0.012], [0.42, 0.015, 0.012], 0.007, wiper.dark);
  wiper.rod([0.12, 0.02, 0.016], [0.42, 0.02, 0.016], 0.008, wiper.dark);
  wiper.finish();
}

/** Close detail for the auto-rickshaw: controls, mirrors, gauge, meter, indicators, plates. */
function autoRickshawDetail(root, s) {
  const G = s.cycleFrame;
  const frame = root.getObjectByName('handlebar-frame');
  const controls = detailKit(frame, 'rider-controls');
  const d = detailKit(root);
  const [gx, gy, gz] = G.grip;
  for (const side of [-1, 1]) {
    const x = side * gx;
    controls.box([0.05, 0.035, 0.04], [x - side * 0.09, gy, gz + 0.012], controls.dark);
    controls.rod(
      [x - side * 0.07, gy + 0.008, gz + 0.05],
      [x + side * 0.06, gy - 0.004, gz + 0.08],
      0.006,
    );
  }
  // Mirrors on stalks from the windscreen frame's lower corners.
  const nose = s.length / 2 - 0.08;
  for (const side of [-1, 1]) {
    const base = [side * 0.43, 1.06, nose - 0.31];
    const head = [side * 0.58, 1.2, nose - 0.25];
    d.rod(base, head, 0.007, d.dark);
    const m = d.add(new T.CylinderGeometry(0.055, 0.055, 0.02, 16), d.dark, head);
    m.rotation.x = Math.PI / 2;
    m.scale.set(1, 1, 0.7);
  }
  // Speedometer in the dash and the fare meter on its left.
  tilted(d, [0.0, 0.98, 0.75], 0.5, (k, p) => p.gauge(0, 0, 0, 0.055, k.ivory));
  d.box([0.13, 0.09, 0.08], [0.3, 1.09, 0.72], d.dark);
  d.box([0.09, 0.03, 0.004], [0.3, 1.1, 0.678], d.red);
  // Indicators at the cowl's shoulders and the tail; plate lettering front and rear.
  for (const side of [-1, 1]) {
    const lens = d.add(new T.SphereGeometry(1, 10, 6), d.amber, [side * 0.3, 0.9, nose - 0.01]);
    lens.scale.set(0.035, 0.025, 0.02);
    const back = d.add(new T.SphereGeometry(1, 10, 6), d.amber, [
      side * 0.5,
      0.9,
      -s.length / 2 - 0.04,
    ]);
    back.scale.set(0.035, 0.025, 0.015);
  }
  d.text('MLN 3W', [0, 0.57, nose + 0.03], 0.05, 0, d.dark);
  d.text('MLN 3W', [0, 0.66, -s.length / 2 - 0.047], 0.05, Math.PI, d.dark);
  for (const side of [-1, 1])
    d.text('BENDY', [side * 0.668, 0.8, -0.62], 0.05, (side * Math.PI) / 2, d.ivory);
  controls.finish();
  d.finish();
}

/** Board marks: a brand stripe on the graphic, read from beneath. */
function boardDetail(root, s) {
  const d = detailKit(root, 'board-marks');
  // Under the deck between the trucks, or on the electric board's battery enclosure.
  const y =
    s.shape === 'electric-skateboard' ? s.wheelRadius + 0.016 : s.wheelRadius + 0.053 - 0.0025;
  const g = d.text('BENDY', [0, y, 0], 0.03, 0, d.ivory);
  g.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  d.finish();
}

export const LIGHT_VEHICLES = {
  'auto-rickshaw': {
    frame: {
      head: 65,
      offset: 0.06,
      headTop: 0.9,
      headBottom: 0.7,
      grip: [0.33, 1.02, 0.5],
      seat: { top: 0.76, z: 0.12 },
      peg: [0.14, 0.34, 0.6],
      floor: 0.32,
      tire: [0.1, 0.1],
      eye: [0.66, 0.1],
      // Headlamp lens centres (spec.headlamps): the nose lamp.
      lamps: [[0, 0.78, 1.3]],
    },
    build: buildAutoRickshaw,
    detail: autoRickshawDetail,
  },
  'underbone-moped': {
    frame: {
      head: 63,
      offset: 0.035,
      headTop: 0.93,
      headBottom: 0.72,
      forkWidth: 0.072,
      grip: [0.32, 1.0, 0.17],
      seat: { top: 0.775, z: -0.3 },
      peg: [0.16, 0.29, -0.04],
      tire: [
        [0.075, 0.07],
        [0.065, 0.065],
      ],
      eye: [0.66, 0.16],
      headlamp: [0, 0.985, 0.375],
      tail: [-0.885, 0.72],
      badge: [0.172, 0.6, -0.42, 0.045],
      lamps: [[0, 0.985, 0.4]],
    },
    build: buildUnderbone,
    detail: mopedDetail,
  },
  'electric-moped': {
    frame: {
      head: 66,
      offset: 0.025,
      headTop: 0.95,
      headBottom: 0.56,
      forkWidth: 0.08,
      grip: [0.31, 1.02, 0.2],
      seat: { top: 0.8, z: -0.27 },
      peg: [0.13, 0.3, 0.12],
      floor: 0.3,
      tire: [0.09, 0.075],
      eye: [0.66, 0.12],
      badge: [0.205, 0.56, -0.5, 0.045],
      lamps: [[0, 0.82, 0.47]],
    },
    build: buildElectricMoped,
    detail: mopedDetail,
  },
  'kick-scooter': {
    frame: {
      head: 74,
      offset: 0,
      headTop: 0.5,
      headBottom: 0.36,
      grip: [0.235, 1.07, 0.16],
      seat: { top: 1.02, z: -0.07 },
      peg: [0.04, 0.16, 0.06],
      // Standing, left foot ahead: ankles a shoe's height above the deck mat.
      footrests: [
        [0.035, 0.235, 0.08],
        [-0.045, 0.235, -0.19],
      ],
      deck: { front: 0.22, rear: -0.3, top: 0.16, bottom: 0.085 },
      tire: [0.055, 0.05],
      eye: [0.66, 0.08],
      lamps: [[0, 0.82, 0.3]],
    },
    build: buildKickScooter,
    detail: kickScooterDetail,
  },
  skateboard: {
    frame: {
      head: 90,
      offset: 0,
      headTop: 0.1,
      headBottom: 0.05,
      // Sideways, left foot forward over the front bolts: free hands out beside the hips,
      // elbows bent for balance.
      grip: [-0.18, 1.03, 0.25],
      grips: [
        [-0.18, 1.03, 0.25],
        [-0.15, 1.01, -0.28],
      ],
      seat: { top: 0.95, z: 0 },
      peg: [0, 0.1, 0.17],
      footrests: [
        [0, 0.17, 0.17],
        [0, 0.17, -0.21],
      ],
      tire: [0.032, 0.026],
      eye: [0.66, 0.06],
      lamps: [],
    },
    build: (k) => buildBoard(k, false),
    detail: boardDetail,
  },
  'electric-skateboard': {
    frame: {
      head: 90,
      offset: 0,
      headTop: 0.15,
      headBottom: 0.1,
      grip: [-0.18, 1.07, 0.27],
      grips: [
        [-0.18, 1.07, 0.27],
        [-0.15, 1.05, -0.3],
      ],
      seat: { top: 0.99, z: 0 },
      peg: [0, 0.14, 0.24],
      footrests: [
        [0, 0.21, 0.25],
        [0, 0.21, -0.25],
      ],
      tire: [0.052, 0.045],
      eye: [0.66, 0.06],
      lamps: [],
    },
    build: (k) => buildBoard(k, true),
    detail: boardDetail,
  },
  // Skis, a snowboard and a snowmobile: snow-vehicles.mjs.
  ...SNOW_VEHICLES,
};
