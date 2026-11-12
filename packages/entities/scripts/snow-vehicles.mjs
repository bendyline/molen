/**
 * Snow vehicles built with fleet-geometry's cycle tools: a pair of alpine skis with poles, a
 * snowboard and a trail snowmobile. Each entry has the frame cycleGeometry() reads (the rider's
 * contacts and the pivot the hands turn about) and a builder handed the tools of fleetModel's
 * cycle branch. They ride on runners, not wheels: the vehicle solver's `runners` slides them on
 * the weather's lying snow. Dimensions follow common machines of each class; no maker's styling,
 * name or emblem is copied.
 */
import * as T from 'three';
import { detailKit } from './vehicle-detail.mjs';

/**
 * Plank sections [z, half-width, bottom, top, x] for a ski or a board: a sidecut between the
 * contact points (narrowest at the waist), a flat base, a core that is thickest underfoot, and
 * rounded ends that turn up. Stations crowd toward the ends, where the curves are.
 */
function plankSections({
  length,
  tip,
  tail,
  waist,
  shovel,
  heel,
  thick,
  core,
  tipRise,
  tailRise,
  waistAt = 0,
  x = 0,
  steps = 26,
}) {
  const half = length / 2;
  const front = half - tip;
  const back = -(half - tail);
  const sections = [];
  for (let i = 0; i <= steps; i++) {
    const z = -half * Math.cos((Math.PI * i) / steps);
    let w;
    let rise = 0;
    if (z > front) {
      const t = (z - front) / tip;
      w = shovel * Math.sqrt(Math.max(0, 1 - 0.93 * t * t));
      rise = tipRise * t * t;
    } else if (z < back) {
      const t = (back - z) / tail;
      w = heel * Math.sqrt(Math.max(0, 1 - 0.93 * t * t));
      rise = tailRise * t * t;
    } else if (z >= waistAt) {
      const t = (z - waistAt) / (front - waistAt);
      w = waist + (shovel - waist) * t * t;
    } else {
      const t = (waistAt - z) / (waistAt - back);
      w = waist + (heel - waist) * t * t;
    }
    const under = Math.max(0, 1 - Math.pow((z - waistAt) / (half * 0.55), 2));
    sections.push([z, Math.max(0.01, w), rise, rise + thick + (core - thick) * under, x]);
  }
  return sections;
}

/** A plank: the dark base and sidewalls, and a painted topsheet let into its upper face. */
function plank(k, parent, sections, name, topsheet) {
  k.shell(parent, sections, k.materials.dark, name, { e: 6, n: 12 });
  k.shell(
    parent,
    sections.map(([z, w, , t, x]) => [z, Math.max(0.008, w - 0.004), t - 0.0008, t + 0.0016, x]),
    topsheet,
    `${name}-topsheet`,
    { e: 6, n: 12 },
  );
}

/** The top of a plank at z, from its sections. */
function topAt(sections, z) {
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1];
    const b = sections[i];
    if (z <= b[0]) {
      const t = (z - a[0]) / (b[0] - a[0] || 1);
      return a[3] + (b[3] - a[3]) * t;
    }
  }
  return sections.at(-1)[3];
}

/**
 * An alpine binding on a ski at x, the boot's middle at z: a riser plate, the toe piece with its
 * wings, the anti-friction pad, the heel piece with its step-in lever, and the two brake arms
 * that drop beside the ski when the boot is out.
 */
function skiBinding(k, parent, x, z, top) {
  const { dark, metal, paint } = k.materials;
  k.box(parent, [0.066, 0.012, 0.6], [x, top + 0.006, z], dark, 'binding-plate');
  const y = top + 0.012;
  // Toe piece: a housing on a turntable, wings that hold the boot's toe lug.
  k.box(parent, [0.07, 0.034, 0.075], [x, y + 0.017, z + 0.215], paint, 'toe-piece');
  k.box(parent, [0.05, 0.02, 0.05], [x, y + 0.044, z + 0.225], dark);
  for (const side of [-1, 1])
    k.box(parent, [0.014, 0.022, 0.05], [x + side * 0.034, y + 0.03, z + 0.17], metal);
  k.box(parent, [0.056, 0.004, 0.045], [x, y + 0.002, z + 0.14], metal, 'anti-friction-pad');
  // Heel piece: the housing on its track, the cup and the lever the pole tip opens.
  k.box(parent, [0.062, 0.008, 0.2], [x, y + 0.004, z - 0.23], metal, 'heel-track');
  k.box(parent, [0.066, 0.05, 0.085], [x, y + 0.033, z - 0.25], paint, 'heel-piece');
  k.box(parent, [0.05, 0.03, 0.03], [x, y + 0.03, z - 0.195], dark);
  const lever = k.box(parent, [0.04, 0.012, 0.085], [x, y + 0.072, z - 0.3], dark, 'heel-lever');
  lever.rotation.x = -0.5;
  // Brake: the pedal under the heel and an arm down each side to a rubber tip.
  k.box(parent, [0.05, 0.006, 0.05], [x, y + 0.006, z - 0.15], metal);
  for (const side of [-1, 1]) {
    const from = [x + side * 0.04, y + 0.006, z - 0.14];
    const to = [x + side * 0.062, top - 0.03, z - 0.33];
    k.rod(parent, from, to, 0.0035, metal, 5);
    k.box(parent, [0.012, 0.016, 0.03], to, dark);
  }
}

/**
 * A ski pole hanging from its grip at the group's origin: planted upright at a stand, and tilted
 * back about the hand by the speed animation once under way. Grip with a pommel and a strap
 * loop, a tapered shaft, a basket and a carbide tip.
 */
function skiPole(k, parent, name, at, height, shaft) {
  const { dark, metal } = k.materials;
  const g = new T.Group();
  g.name = name;
  g.position.set(...at);
  parent.add(g);
  // Planted: the tip a few centimeters into the snow below the hand.
  const length = height + 0.035;
  k.mesh(g, new T.CylinderGeometry(0.0065, 0.0045, length, 8), shaft, `${name}-shaft`).position.y =
    -length / 2;
  k.mesh(g, new T.CylinderGeometry(0.015, 0.0125, 0.125, 10), dark, `${name}-grip`).position.y =
    0.02;
  k.mesh(g, new T.CylinderGeometry(0.019, 0.016, 0.014, 10), dark).position.y = 0.089;
  // The strap: a flat loop out of the top of the grip.
  const strap = k.mesh(g, new T.TorusGeometry(0.036, 0.004, 4, 12), dark, `${name}-strap`);
  strap.position.set(0, 0.062, -0.03);
  strap.rotation.y = Math.PI / 2;
  strap.scale.set(1, 1.5, 0.5);
  k.mesh(g, new T.CylinderGeometry(0.043, 0.043, 0.005, 12), dark, `${name}-basket`).position.y =
    -length + 0.085;
  k.mesh(g, new T.CylinderGeometry(0.011, 0.02, 0.022, 8), dark).position.y = -length + 0.098;
  k.mesh(g, new T.CylinderGeometry(0.004, 0.0015, 0.05, 6), metal).position.y = -length + 0.025;
  return g;
}

/** A pair of all-mountain skis side by side with alpine bindings, and two poles planted beside. */
function buildSkis(k) {
  const { G, root, body, materials, material } = k;
  const stance = G.footrests[0][0];
  const bootZ = G.footrests[0][2];
  for (const [name, side] of [
    ['ski-left', 1],
    ['ski-right', -1],
  ]) {
    const sections = plankSections({
      length: k.s.length,
      tip: 0.2,
      tail: 0.075,
      waist: 0.042,
      shovel: 0.059,
      heel: 0.052,
      thick: 0.007,
      core: 0.019,
      tipRise: 0.062,
      tailRise: 0.012,
      waistAt: bootZ,
      x: side * stance,
    });
    plank(k, body, sections, name, materials.paint);
    // Steel edges catch the light along the base.
    for (const edge of [-1, 1])
      k.box(
        body,
        [0.0022, 0.0022, k.s.length * 0.82],
        [side * stance + edge * 0.0405, 0.0011, bootZ + 0.02],
        materials.metal,
      );
    skiBinding(k, body, side * stance, bootZ, topAt(sections, bootZ));
  }
  // The hands turn about this pivot with the steering, and the poles go with them.
  const handlebar = new T.Group();
  handlebar.name = 'handlebar';
  handlebar.position.set(...G.pivot);
  root.add(handlebar);
  const shaft = material('pole-shafts', '#c9ccd1', 0.55, 0.42);
  for (const [name, grip] of [
    ['pole-left', G.grips[0]],
    ['pole-right', G.grips[1]],
  ])
    skiPole(
      k,
      handlebar,
      name,
      [grip[0] - G.pivot[0], grip[1] - G.pivot[1], grip[2] - G.pivot[2]],
      grip[1],
      shaft,
    );
}

/**
 * A strap binding on a board at z, turned `angle` about the vertical: a disc and baseplate with
 * side rails, a heel cup and a tall highback on the heel side (+x; the rider's toes point to
 * the board's right), and an ankle and a toe strap arched over the boot.
 */
function boardBinding(k, parent, z, top, angle, accent) {
  const { dark, metal } = k.materials;
  const g = new T.Group();
  g.name = z > 0 ? 'binding-front' : 'binding-rear';
  g.position.set(0, top, z);
  g.rotation.y = angle;
  parent.add(g);
  k.mesh(g, new T.CylinderGeometry(0.052, 0.052, 0.006, 16), metal, 'mounting-disc').position.y =
    0.011;
  k.box(g, [0.255, 0.008, 0.118], [0, 0.004, 0], dark, 'baseplate');
  k.box(g, [0.09, 0.006, 0.1], [-0.075, 0.011, 0], accent, 'toe-ramp');
  for (const side of [-1, 1]) {
    k.box(g, [0.2, 0.05, 0.008], [0.015, 0.033, side * 0.061], dark, 'side-rail');
    // Strap ladders rising from the rails.
    k.box(g, [0.022, 0.07, 0.006], [0.03, 0.09, side * 0.066], dark);
    k.box(g, [0.018, 0.045, 0.006], [-0.085, 0.05, side * 0.066], dark);
  }
  // Heel cup: a hoop round the back of the boot.
  for (const side of [-1, 1])
    k.rod(g, [0.085, 0.045, side * 0.061], [0.13, 0.06, side * 0.035], 0.008, metal, 6);
  k.rod(g, [0.13, 0.06, -0.035], [0.13, 0.06, 0.035], 0.008, metal, 6);
  // Highback: three stations up the calf, leaning forward.
  const highback = new T.Group();
  highback.position.set(0.128, 0.06, 0);
  highback.rotation.z = 0.24;
  g.add(highback);
  k.box(highback, [0.012, 0.09, 0.118], [0, 0.045, 0], accent, 'highback');
  k.box(highback, [0.012, 0.09, 0.104], [0.002, 0.13, 0], accent);
  k.box(highback, [0.012, 0.06, 0.08], [0.004, 0.2, 0], accent);
  // Straps: padded arches over the instep and the toe.
  const arch = (x, y, width, thick, depth, name) => {
    k.box(g, [width, thick, depth], [x, y, 0], accent, name);
    for (const side of [-1, 1]) {
      const wing = k.box(
        g,
        [width, thick, 0.03],
        [x, y - 0.012, side * (depth / 2 + 0.008)],
        accent,
      );
      wing.rotation.x = side * 0.9;
    }
  };
  arch(0.03, 0.128, 0.058, 0.014, 0.1, 'ankle-strap');
  arch(-0.085, 0.075, 0.04, 0.012, 0.096, 'toe-strap');
  k.box(g, [0.02, 0.012, 0.03], [0.03, 0.126, 0.068], metal, 'ankle-buckle');
  k.box(g, [0.016, 0.01, 0.026], [-0.085, 0.073, 0.066], metal, 'toe-buckle');
}

/** A twin-tip all-mountain snowboard with two strap bindings in a duck stance. */
function buildSnowboard(k) {
  const { G, body, materials, material } = k;
  const sections = plankSections({
    length: k.s.length,
    tip: 0.2,
    tail: 0.2,
    waist: 0.125,
    shovel: 0.147,
    heel: 0.147,
    thick: 0.007,
    core: 0.011,
    tipRise: 0.058,
    tailRise: 0.058,
    steps: 32,
  });
  plank(k, body, sections, 'board', materials.paint);
  for (const edge of [-1, 1])
    k.box(body, [0.0022, 0.0022, k.s.length * 0.7], [edge * 0.124, 0.0011, 0], materials.metal);
  const accent = material('binding-straps', '#23272b', 0.05, 0.6);
  const [front, rear] = G.footrests;
  boardBinding(k, body, front[2], topAt(sections, front[2]), (15 * Math.PI) / 180, accent);
  boardBinding(k, body, rear[2], topAt(sections, rear[2]), (-9 * Math.PI) / 180, accent);
  // Stomp pad between the bindings, where the free foot rests while skating.
  k.box(
    body,
    [0.1, 0.004, 0.09],
    [-0.01, topAt(sections, -0.02) + 0.003, -0.03],
    materials.dark,
    'stomp-pad',
  );
}

/** Belt cross-sections along a closed path in the y-z plane, `width` across. */
function beltRings(path, width, thick) {
  const rings = [];
  const n = path.length;
  for (let i = 0; i <= n; i++) {
    const [z, y] = path[i % n];
    const [z0, y0] = path[(i - 1 + n) % n];
    const [z1, y1] = path[(i + 1) % n];
    // Outward normal of a path that runs clockwise seen from +x (forward along the top).
    const tz = z1 - z0;
    const ty = y1 - y0;
    const length = Math.hypot(tz, ty) || 1;
    const nz = -ty / length;
    const ny = tz / length;
    const half = width / 2;
    rings.push([
      [-half, y, z],
      [half, y, z],
      [half, y + ny * thick, z + nz * thick],
      [-half, y + ny * thick, z + nz * thick],
    ]);
  }
  return rings;
}

/**
 * A trail snowmobile: a rubber track on a slide-rail suspension under a tunnel, a long seat, a
 * cowl with a windscreen and headlamp over the engine, handlebars, and two steered skis on
 * wishbones with coil-over shocks.
 */
function buildSnowmobile(k) {
  const { s, G, root, body, materials, material } = k;
  const { paint, dark, metal, glass, red } = materials;
  const wb = s.wheelbase;
  const skiZ = wb / 2;
  const trackZ = -wb / 2;
  const seat = material('seat-vinyl', '#1d2023', 0, 0.82);
  // Track: a lugged belt round the drive sprocket (front, high), the rail and the rear idlers.
  const belt = [];
  const rearZ = trackZ - 0.55;
  const frontZ = trackZ + 0.72;
  const idler = 0.15;
  const driver = 0.11;
  const arc = (cz, cy, r, from, to, steps) => {
    for (let i = 0; i <= steps; i++) {
      const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
      belt.push([cz + r * Math.sin(a), cy + r * Math.cos(a)]);
    }
  };
  // Clockwise seen from +x: forward along the top, down round the sprocket, back along the snow.
  arc(rearZ, idler + 0.01, idler, 180, 360, 8);
  arc(frontZ, 0.3, driver, 0, 135, 6);
  belt.push([trackZ + 0.42, 0.012], [trackZ - 0.2, 0.01]);
  k.ringLoft(body, beltRings(belt, 0.38, 0.014), dark, 'track');
  // Lugs across the belt, about a hand apart, all the way round.
  let run = 0;
  for (let i = 0; i < belt.length; i++) {
    const [z0, y0] = belt[i];
    const [z1, y1] = belt[(i + 1) % belt.length];
    const span = Math.hypot(z1 - z0, y1 - y0);
    for (let d = (0.064 - (run % 0.064)) % 0.064; d < span; d += 0.064) {
      const t = d / span;
      const lug = k.box(body, [0.37, 0.022, 0.012], [0, 0, 0], dark);
      const nz = -(y1 - y0) / span;
      const ny = (z1 - z0) / span;
      lug.position.set(0, y0 + (y1 - y0) * t + ny * 0.02, z0 + (z1 - z0) * t + nz * 0.02);
      lug.rotation.x = Math.atan2(nz, ny);
    }
    run += span;
  }
  // Slide rails with their bogie wheels and the rear idlers, seen through the track's sides.
  for (const side of [-1, 1]) {
    k.box(body, [0.03, 0.05, 1.02], [side * 0.14, 0.07, trackZ - 0.06], metal, 'slide-rail');
    for (const z of [trackZ + 0.3, trackZ - 0.05, trackZ - 0.36])
      k.cylinderX(body, [side * 0.165, 0.075, z], 0.062, 0.03, dark, 12);
    k.cylinderX(body, [side * 0.14, idler + 0.01, rearZ], idler - 0.016, 0.04, dark, 14);
    k.rod(
      body,
      [side * 0.14, 0.09, trackZ + 0.34],
      [side * 0.14, 0.36, trackZ + 0.5],
      0.014,
      metal,
    );
    k.rod(
      body,
      [side * 0.14, 0.09, trackZ - 0.3],
      [side * 0.14, 0.38, trackZ - 0.05],
      0.014,
      metal,
    );
  }
  k.cylinderX(body, [0, 0.3, frontZ], driver - 0.016, 0.32, metal, 12);
  // Tunnel over the track, its running boards and the snow flap behind.
  const tunnelTop = 0.45;
  k.shell(
    body,
    [
      [rearZ - 0.08, 0.215, 0.37, tunnelTop - 0.01],
      [rearZ + 0.1, 0.225, 0.36, tunnelTop],
      [frontZ - 0.05, 0.235, 0.36, tunnelTop],
      [frontZ + 0.1, 0.26, 0.3, tunnelTop + 0.02],
    ],
    metal,
    'tunnel',
    { e: 7, n: 12 },
  );
  for (const side of [-1, 1]) {
    k.box(body, [0.012, 0.16, 1.15], [side * 0.228, 0.3, trackZ + 0.02], metal, 'tunnel-side');
    k.box(body, [0.15, 0.014, 1.26], [side * 0.31, 0.255, trackZ + 0.42], dark, 'running-board');
    for (let i = 0; i < 12; i++)
      k.box(body, [0.13, 0.008, 0.012], [side * 0.31, 0.266, trackZ - 0.15 + i * 0.105], metal);
    // Toe hold at the front of the footwell, and the board's outer support.
    k.box(body, [0.15, 0.11, 0.014], [side * 0.31, 0.31, trackZ + 1.05], dark, 'toe-hold');
    k.rod(
      body,
      [side * 0.385, 0.26, trackZ - 0.25],
      [side * 0.228, 0.36, trackZ - 0.42],
      0.01,
      metal,
    );
  }
  k.box(body, [0.4, 0.2, 0.012], [0, 0.2, rearZ - 0.16], dark, 'snow-flap').rotation.x = 0.18;
  // Seat: a long saddle rising to a backrest hump, a storage trunk and the tail lamp behind it.
  k.shell(
    body,
    [
      [trackZ - 0.56, 0.15, tunnelTop, 0.62],
      [trackZ - 0.45, 0.185, tunnelTop, 0.72],
      [trackZ - 0.2, 0.2, tunnelTop, 0.705],
      [trackZ + 0.25, 0.195, tunnelTop, 0.7],
      [trackZ + 0.62, 0.17, tunnelTop, 0.72],
      [trackZ + 0.74, 0.14, tunnelTop + 0.03, 0.76],
    ],
    seat,
    'seat',
    { e: 3.2, n: 14, top: 0.22 },
  );
  k.box(body, [0.2, 0.06, 0.03], [0, 0.56, rearZ - 0.09], red, 'tail-lamp');
  // Rear grab bar and rack: a hoop off the tunnel's end.
  k.tube(
    body,
    [
      [0.2, tunnelTop, rearZ + 0.25],
      [0.22, 0.56, rearZ + 0.02],
      [0.2, 0.6, rearZ - 0.14],
      [-0.2, 0.6, rearZ - 0.14],
      [-0.22, 0.56, rearZ + 0.02],
      [-0.2, tunnelTop, rearZ + 0.25],
    ],
    0.013,
    metal,
    8,
    'grab-bar',
  );
  // Cowl: the hood over the engine, wide at the rider's knees and drawn down to the nose.
  const nose = skiZ + 0.3;
  k.shell(
    body,
    [
      [frontZ - 0.12, 0.22, 0.46, 0.74],
      [frontZ + 0.08, 0.28, 0.5, 0.84],
      [frontZ + 0.38, 0.33, 0.42, 0.82],
      [frontZ + 0.55, 0.36, 0.27, 0.78],
      [skiZ - 0.02, 0.35, 0.25, 0.7],
      [nose - 0.16, 0.29, 0.25, 0.58],
      [nose, 0.19, 0.29, 0.46],
    ],
    paint,
    'hood',
    { e: 2.7, n: 16, top: 0.3 },
  );
  k.shell(
    body,
    [
      [frontZ + 0.02, 0.2, 0.2, 0.47],
      [frontZ + 0.4, 0.23, 0.17, 0.44],
      [frontZ + 0.56, 0.33, 0.15, 0.3],
      [skiZ - 0.1, 0.33, 0.15, 0.28],
      [nose - 0.1, 0.25, 0.18, 0.28],
      [nose + 0.02, 0.16, 0.22, 0.3],
    ],
    dark,
    'belly-pan',
    { e: 3.5, n: 12 },
  );
  // Side vents and the knee pads at the back of the cowl.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++)
      k.box(body, [0.012, 0.022, 0.12], [side * 0.35, 0.5 + i * 0.045, frontZ + 0.62], dark);
    k.box(body, [0.05, 0.18, 0.16], [side * 0.235, 0.62, frontZ - 0.04], seat, 'knee-pad');
  }
  k.lamp(body, G.lamps[0], 0.075, 0.07, dark);
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
  ).position.set(
    G.lamps[0][0],
    G.lamps[0][1],
    G.lamps[0][2] - 0.072 * Math.cos(Math.PI * 0.32) + 0.008,
  );
  // Front bumper: a hoop round the nose.
  k.tube(
    body,
    [
      [0.3, 0.3, skiZ + 0.02],
      [0.26, 0.31, nose - 0.04],
      [0.14, 0.33, nose + 0.06],
      [-0.14, 0.33, nose + 0.06],
      [-0.26, 0.31, nose - 0.04],
      [-0.3, 0.3, skiZ + 0.02],
    ],
    0.014,
    dark,
    8,
    'front-bumper',
  );
  // Windscreen: a raked panel on the cowl ahead of the bars, and the gauge pod beneath it.
  const screen = k.box(body, [0.46, 0.32, 0.008], [0, 0.9, frontZ + 0.5], glass, 'windscreen');
  screen.rotation.x = -0.62;
  k.box(body, [0.48, 0.03, 0.05], [0, 0.775, frontZ + 0.59], dark, 'windscreen-base').rotation.x =
    -0.62;
  k.box(body, [0.22, 0.07, 0.1], [0, 0.87, frontZ + 0.44], dark, 'gauge-pod').rotation.x = -0.5;
  // Handlebars: a raked column, a riser block, bars with a brace and hooked ends.
  const handlebar = new T.Group();
  handlebar.name = 'handlebar';
  handlebar.position.set(...G.pivot);
  root.add(handlebar);
  const bars = k.steered(handlebar, G.barTilt);
  const [gx, gy, gz] = G.grip;
  k.tube(
    bars,
    [G.barAxisAt(G.headTop - 0.3), G.barAxisAt(G.headTop + 0.04)],
    0.019,
    dark,
    10,
    'steering-post',
  );
  k.box(bars, [0.11, 0.045, 0.06], [0, G.pivot[1] + 0.05, G.pivot[2] - 0.02], dark, 'riser-block');
  k.tube(
    bars,
    [
      [gx + 0.02, gy, gz],
      [gx - 0.1, gy, gz + 0.012],
      [0.07, G.pivot[1] + 0.06, G.pivot[2] - 0.02],
      [-0.07, G.pivot[1] + 0.06, G.pivot[2] - 0.02],
      [-gx + 0.1, gy, gz + 0.012],
      [-gx - 0.02, gy, gz],
    ],
    0.012,
    metal,
    8,
    'handlebars',
  );
  for (const side of [-1, 1]) {
    k.cylinderX(bars, [side * (gx - 0.03), gy, gz], 0.018, 0.13, dark, 10);
    // Brake lever on the left, thumb throttle on the right, a hand guard on each.
    k.rod(
      bars,
      [side * (gx - 0.11), gy + 0.004, gz + 0.03],
      [side * (gx + 0.01), gy, gz + 0.055],
      0.005,
      metal,
      5,
    );
    k.box(
      bars,
      [0.11, 0.07, 0.012],
      [side * (gx - 0.03), gy + 0.01, gz + 0.085],
      dark,
      'hand-guard',
    );
    k.box(bars, [0.035, 0.03, 0.04], [side * (gx - 0.12), gy + 0.004, gz + 0.004], dark);
  }
  // Skis on spindles that turn with the bars; wishbones and a coil-over shock to each.
  const half = s.wheelTrack / 2;
  const spring = material('shock-springs', '#e0b322', 0.2, 0.5);
  for (const [name, side] of [
    ['ski-left', 1],
    ['ski-right', -1],
  ]) {
    const ski = new T.Group();
    ski.name = name;
    ski.position.set(side * half, 0, skiZ);
    root.add(ski);
    const sections = plankSections({
      length: 1.06,
      tip: 0.26,
      tail: 0.07,
      waist: 0.062,
      shovel: 0.07,
      heel: 0.062,
      thick: 0.016,
      core: 0.03,
      tipRise: 0.15,
      tailRise: 0.015,
      steps: 20,
    }).map(([z, w, b, t]) => [z + 0.1, w, b, t]);
    k.shell(ski, sections, dark, `${name}-plank`, { e: 5, n: 10 });
    // Keel with its carbide runner, the saddle and spindle, and the loop at the tip.
    k.box(ski, [0.014, 0.014, 0.6], [0, -0.004, 0.02], metal, 'wear-bar');
    k.box(ski, [0.09, 0.07, 0.16], [0, 0.065, 0], dark, 'ski-saddle');
    k.rod(ski, [0, 0.06, 0], [0, 0.34, -0.03], 0.02, metal);
    k.tube(
      ski,
      [
        [0, 0.03, 0.34],
        [0, 0.15, 0.4],
        [0, 0.21, 0.56],
        [0, 0.17, 0.62],
      ],
      0.011,
      dark,
      6,
      'ski-loop',
    );
    // Wishbones and the shock run from the chassis to the spindle and do not turn.
    const hub = [side * half, 0.2, skiZ - 0.02];
    for (const [y, z] of [
      [0.22, 0.14],
      [0.22, -0.18],
      [0.36, 0.1],
      [0.36, -0.14],
    ])
      k.rod(
        body,
        [side * 0.22, y + 0.04, skiZ + z],
        [hub[0] - side * 0.03, y - 0.01, hub[2]],
        0.011,
        metal,
        6,
      );
    const top = [side * 0.24, 0.62, skiZ - 0.04];
    const foot = [side * (half - 0.08), 0.24, skiZ - 0.02];
    k.rod(body, top, foot, 0.013, metal, 6);
    const mid = [0, 1, 2].map((i) => top[i] + (foot[i] - top[i]) * 0.48);
    const low = [0, 1, 2].map((i) => top[i] + (foot[i] - top[i]) * 0.92);
    k.rod(body, top, mid, 0.026, dark, 10);
    k.rod(body, mid, low, 0.034, spring, 10);
  }
}

/** Marks on the snowmobile: the house name along the cowl and the tunnel, a number on the nose. */
function snowmobileDetail(root, s) {
  const d = detailKit(root, 'sled-marks');
  const frontZ = -s.wheelbase / 2 + 0.72;
  for (const side of [-1, 1]) {
    d.text('BENDY', [side * 0.362, 0.66, frontZ + 0.6], 0.06, (side * Math.PI) / 2, d.ivory);
    d.text(
      'MLN 600',
      [side * 0.236, 0.31, -s.wheelbase / 2 - 0.1],
      0.04,
      (side * Math.PI) / 2,
      d.dark,
    );
  }
  d.finish();
}

/** Marks on the board: the house name across the nose, read from above. */
function snowboardDetail(root, s) {
  const d = detailKit(root, 'board-marks');
  const g = d.text('BENDY', [0, 0.0118, s.length / 2 - 0.3], 0.06, 0, d.ivory);
  g.rotation.set(-Math.PI / 2, 0, 0);
  d.finish();
}

export const SNOW_VEHICLES = {
  skis: {
    frame: {
      // No steering head: `offset` only places the pivot the hands and poles turn about, between
      // the grips (the frame's pivot is at wheelbase / 2 - offset).
      head: 90,
      offset: 0.35,
      headTop: 1.03,
      headBottom: 0.9,
      grip: [0.3, 1.03, 0.2],
      // Hips over the boots in a ready stance, knees a little bent.
      seat: { top: 0.89, z: -0.03 },
      peg: [0.13, 0.08, -0.05],
      // Ankles a ski boot's height above the binding plates.
      footrests: [
        [0.13, 0.17, -0.05],
        [-0.13, 0.17, -0.05],
      ],
      tire: [0.02, 0.02],
      eye: [0.7, 0.08],
      lamps: [],
    },
    build: buildSkis,
  },
  snowboard: {
    frame: {
      head: 90,
      offset: 0,
      headTop: 0.1,
      headBottom: 0.05,
      // Sideways, left foot forward: free hands out beside the hips for balance.
      grip: [-0.18, 1.01, 0.27],
      grips: [
        [-0.18, 1.01, 0.27],
        [-0.15, 0.99, -0.3],
      ],
      seat: { top: 0.9, z: 0 },
      peg: [0, 0.06, 0.26],
      // Ankles in the bindings, a shoulder's width and a half apart.
      footrests: [
        [0, 0.16, 0.26],
        [0, 0.16, -0.26],
      ],
      tire: [0.02, 0.02],
      eye: [0.66, 0.06],
      lamps: [],
    },
    build: buildSnowboard,
    detail: snowboardDetail,
  },
  snowmobile: {
    frame: {
      head: 62,
      offset: 0,
      headTop: 0.95,
      headBottom: 0.6,
      grip: [0.31, 1.0, 0.27],
      seat: { top: 0.7, z: -0.3 },
      // Boots on the running boards, toes under the holds.
      peg: [0.31, 0.27, 0.15],
      tire: [0.1, 0.1],
      eye: [0.66, 0.1],
      // Headlamp lens centre (spec.headlamps): in the nose of the cowl.
      lamps: [[0, 0.44, 1.03]],
    },
    build: buildSnowmobile,
    detail: snowmobileDetail,
  },
};
