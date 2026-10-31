/** Shared hard-surface authoring capability for the fleet's self-contained JSON recipes. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { joinedPath } from '../../worldgen/scripts/joined-path.mjs';
import { prepareSurface, smoothSurface } from './surface-normals.mjs';
import { addBoatDetail, addCarDetail, addCycleDetail } from './vehicle-detail.mjs';

// Cycle archetypes measured from real machines (side-profile photographs scaled by wheelbase and
// tyre size, checked against published geometry): a Dutch city bike, a steel road bike, a
// Bakfiets-style long-john, a twin-shock standard (Bonneville class), a V-twin cruiser (Shadow
// class) and a Vespa-class step-through. Heights are metres above the ground, z is metres
// forward of the wheelbase centre. The entity's grips, pedals, footrests, seat and eye repeat
// these contact points; cycleGeometry() is the single source for both.
const CYCLE_FRAMES = {
  'city-bicycle': {
    head: 67.5,
    offset: 0.055,
    headTop: 0.85,
    headBottom: 0.69,
    crown: 0.665,
    topTube: 0.8,
    stay: 0.498,
    drop: 0.055,
    seatAngle: 68,
    cluster: 0.78,
    saddle: 0.93,
    steerer: 1,
    reach: 0.03,
    rise: 0,
    bars: 'swept',
    grip: [0.28, 1.03, 0.076],
    crank: 0.17,
    pedalWidth: 0.14,
    tire: [0.042, 0.04],
    rack: 0.8,
    basket: [0.745, 0.535],
    eye: [0.66, 0.1],
  },
  'road-bicycle': {
    head: 73,
    offset: 0.045,
    headTop: 0.815,
    headBottom: 0.69,
    crown: 0.675,
    topTube: 0.795,
    stay: 0.41,
    drop: 0.07,
    seatAngle: 73.5,
    // Compact frame: the top tube slopes about 9 degrees down to the seat cluster.
    cluster: 0.7,
    saddle: 0.975,
    steerer: 0.885,
    reach: 0.1,
    rise: 0.015,
    bars: 'drop',
    grip: [0.205, 0.96, 0.37],
    crank: 0.1725,
    pedalWidth: 0.13,
    tire: [0.026, 0.026],
    eye: [0.385, 0.49],
  },
  'cargo-bicycle': {
    head: 70,
    offset: 0.04,
    headTop: 0.7,
    headBottom: 0.57,
    crown: 0.55,
    // The top tube steps down to the rear head tube, as on a long-john.
    topTube: 0.64,
    rearHead: { angle: 72, z: -0.4, y: 0.82, bottom: 0.56, top: 0.82 },
    stay: 0.47,
    drop: 0.05,
    seatAngle: 70,
    cluster: 0.72,
    saddle: 0.93,
    steerer: 1,
    reach: 0.1,
    rise: 0,
    bars: 'swept',
    grip: [0.3, 1.03, -0.47],
    crank: 0.17,
    pedalWidth: 0.14,
    tire: [0.05, 0.048],
    rack: 0.76,
    // Box: upright rear wall and sides; only the front panel slopes forward.
    box: { floor: 0.24, top: 0.72, rear: [-0.275, -0.275], front: [0.5, 0.73], half: 0.31 },
    // Step-through rider frame: no top tube to the rear steering head.
    stepThrough: true,
    // Maker's name on the box flanks.
    badge: [0.3125, 0.47, 0.17, 0.07],
    eye: [0.66, 0.12],
  },
  'standard-motorcycle': {
    head: 62.5,
    offset: 0.057,
    headTop: 0.93,
    headBottom: 0.76,
    forkWidth: 0.1,
    grip: [0.36, 1.1, 0.33],
    seat: { top: 0.8, z: -0.3 },
    peg: [0.22, 0.33, -0.22],
    tire: [
      [0.13, 0.104],
      [0.1, 0.09],
    ],
    eye: [0.66, 0.2],
    swingarm: [0, 0.36, -0.21],
    seatRail: [0.74, -0.98],
    shockTop: [0.7, -0.58],
    backbone: [
      [0, 0.8, 0.24],
      [0, 0.73, -0.08],
      [0, 0.7, -0.2],
    ],
    cradle: [
      [0.55, 0.4],
      [0.3, 0.37],
      [0.14, 0.28],
      [0.12, -0.08],
      [0.2, -0.2],
    ],
    engine: {
      // Polished cases, as on the Bonneville.
      polished: true,
      crankcase: [
        [-0.21, 0.12, 0.2, 0.45],
        [-0.14, 0.19, 0.14, 0.49],
        [0.15, 0.19, 0.13, 0.5],
        [0.3, 0.17, 0.16, 0.48],
        [0.35, 0.1, 0.2, 0.43],
      ],
      covers: [
        [-0.2, -0.05, 0.3, 0.11],
        [-0.195, 0.2, 0.31, 0.068],
        [0.2, 0.14, 0.28, 0.095],
        [0.2, -0.09, 0.3, 0.068],
      ],
      // A wide parallel twin: both barrels in one finned block.
      cylinders: [[[0.45, 0.09], [0.985, 0.174], 0.22, 0.4]],
      finDepth: 0.22,
      // Close-pitched fins on a deep core read as one cast block.
      finCore: 0.8,
      fins: 9,
    },
    exhaust: [1, -1].map((s) => ({
      radius: 0.027,
      path: [
        [s * 0.1, 0.62, 0.24],
        [s * 0.12, 0.56, 0.34],
        [s * 0.145, 0.42, 0.385],
        [s * 0.18, 0.24, 0.31],
        [s * 0.205, 0.19, 0.05],
        [s * 0.215, 0.21, -0.3],
      ],
      silencer: [
        [s * 0.215, 0.21, -0.3],
        [s * 0.215, 0.225, -0.45],
        [s * 0.215, 0.285, -1.03],
      ],
    })),
    // Long rounded teardrop tank reaching forward round the steering head.
    tankShape: [
      [-0.17, 0.08, 0.755, 0.83],
      [-0.11, 0.135, 0.74, 0.905],
      [0, 0.165, 0.73, 0.948],
      [0.14, 0.168, 0.735, 0.955],
      [0.26, 0.15, 0.75, 0.94],
      [0.34, 0.118, 0.77, 0.918],
      [0.385, 0.08, 0.79, 0.895],
      [0.405, 0.04, 0.81, 0.875],
    ],
    seatShape: [
      [
        [-0.12, 0.1, 0.71, 0.79],
        [-0.2, 0.15, 0.69, 0.8],
        [-0.45, 0.158, 0.685, 0.805],
        [-0.72, 0.152, 0.69, 0.815],
        [-0.9, 0.13, 0.7, 0.81],
        [-0.97, 0.09, 0.715, 0.79],
      ],
    ],
    // Side panel: a rounded lozenge tucked up under the bench.
    sideCover: [
      [-0.19, 0.1, 0.57, 0.68],
      [-0.22, 0.125, 0.53, 0.7],
      [-0.33, 0.135, 0.51, 0.71],
      [-0.43, 0.125, 0.53, 0.7],
      [-0.46, 0.1, 0.57, 0.68],
    ],
    fenders: { front: [0.045, -42, 58, 0.05, 0.016], rear: [0.05, -96, 22, 0.075, 0.02] },
    headlamp: [0, 0.86, 0.6],
    lampRadius: 0.09,
    tail: [-0.995, 0.665],
    badge: [0.146, 0.84, 0.095, 0.04],
  },
  'cruiser-motorcycle': {
    head: 57,
    offset: 0.035,
    headTop: 0.92,
    headBottom: 0.78,
    forkWidth: 0.125,
    grip: [0.4, 1.05, 0.08],
    seat: { top: 0.69, z: -0.36 },
    peg: [0.24, 0.29, 0.3],
    // Fat cruiser tyres (150-170 rear, 130 front).
    tire: [
      [0.17, 0.12],
      [0.13, 0.1],
    ],
    eye: [0.66, 0.22],
    swingarm: [0, 0.35, -0.25],
    seatRail: [0.66, -0.98],
    shockTop: [0.66, -0.62],
    backbone: [
      [0, 0.79, 0.25],
      [0, 0.71, -0.1],
      [0, 0.66, -0.24],
    ],
    cradle: [
      [0.55, 0.43],
      [0.32, 0.36],
      [0.15, 0.27],
      [0.13, -0.1],
      [0.2, -0.24],
    ],
    engine: {
      crankcase: [
        [-0.2, 0.1, 0.22, 0.42],
        [-0.14, 0.15, 0.18, 0.46],
        [0.14, 0.15, 0.17, 0.47],
        [0.24, 0.13, 0.2, 0.44],
        [0.28, 0.08, 0.24, 0.4],
      ],
      covers: [
        [-0.165, 0, 0.3, 0.1],
        [0.165, -0.04, 0.29, 0.095, 1.8],
      ],
      cylinders: [
        [[0.44, 0.07], [0.899, 0.438], 0.185, 0.23],
        [[0.44, -0.05], [0.899, -0.438], 0.185, 0.23],
      ],
      finDepth: 0.17,
      // Oval air-cleaner cover on the right: [x, y, z, radius, depth, length/height].
      airbox: [-0.15, 0.6, 0.01, 0.085, 0.04, 1.3],
    },
    exhaust: [
      {
        radius: 0.026,
        path: [
          [-0.07, 0.6, 0.2],
          [-0.12, 0.5, 0.3],
          [-0.16, 0.24, 0.33],
          [-0.19, 0.17, 0.22],
          [-0.215, 0.24, -0.05],
        ],
        silencer: [
          [-0.215, 0.24, -0.05],
          [-0.225, 0.29, -0.45],
          [-0.225, 0.37, -1.05],
        ],
      },
      {
        radius: 0.026,
        path: [
          [-0.07, 0.58, -0.12],
          [-0.15, 0.48, -0.08],
          [-0.2, 0.32, -0.05],
          [-0.23, 0.2, -0.15],
          [-0.235, 0.2, -0.35],
        ],
        silencer: [
          [-0.235, 0.2, -0.35],
          [-0.235, 0.21, -0.55],
          [-0.235, 0.24, -1.08],
        ],
      },
    ],
    // Teardrop tank: highest ahead of the knees, sweeping down and narrowing into the seat.
    tankShape: [
      [-0.25, 0.05, 0.72, 0.755],
      [-0.2, 0.1, 0.715, 0.81],
      [-0.11, 0.15, 0.71, 0.88],
      [0.01, 0.172, 0.705, 0.93],
      [0.15, 0.17, 0.715, 0.942],
      [0.27, 0.148, 0.735, 0.932],
      [0.355, 0.1, 0.77, 0.902],
      [0.39, 0.05, 0.8, 0.878],
    ],
    // Low dished rider seat tucked under the tank tail, stepped pillion behind.
    seatShape: [
      [
        [-0.2, 0.08, 0.68, 0.73],
        [-0.25, 0.15, 0.645, 0.712],
        [-0.36, 0.19, 0.63, 0.69],
        [-0.46, 0.175, 0.64, 0.715],
        [-0.53, 0.13, 0.66, 0.77],
      ],
      [
        [-0.55, 0.1, 0.72, 0.78],
        [-0.62, 0.135, 0.71, 0.82],
        [-0.85, 0.13, 0.72, 0.825],
        [-0.96, 0.09, 0.73, 0.8],
      ],
    ],
    // Styled side cover filling the frame under the seat: deep in front, tapering rearward.
    sideCover: [
      [-0.15, 0.09, 0.42, 0.6],
      [-0.19, 0.125, 0.38, 0.625],
      [-0.3, 0.13, 0.4, 0.63],
      [-0.4, 0.12, 0.47, 0.625],
      [-0.45, 0.09, 0.53, 0.61],
    ],
    fenders: { front: [0.04, -45, 72, 0.08, 0.07], rear: [0.045, -100, 28, 0.1, 0.07] },
    headlamp: [0, 0.89, 0.62],
    lampRadius: 0.115,
    tail: [-1.05, 0.7],
    badge: [0.157, 0.835, 0.07, 0.04],
    // Leather saddlebags: a body rounded at the lower corners under an overhanging lid.
    bags: [
      [-0.5, 0.04, 0.56, 0.7],
      [-0.52, 0.07, 0.5, 0.725],
      [-0.56, 0.088, 0.465, 0.74],
      [-0.63, 0.095, 0.45, 0.745],
      [-0.85, 0.095, 0.45, 0.745],
      [-0.92, 0.088, 0.465, 0.742],
      [-0.965, 0.07, 0.5, 0.735],
      [-0.99, 0.04, 0.56, 0.72],
    ],
    bagLid: [
      [-0.495, 0.058, 0.69, 0.725],
      [-0.525, 0.093, 0.685, 0.765],
      [-0.95, 0.1, 0.685, 0.765],
      [-0.995, 0.066, 0.69, 0.745],
    ],
  },
  'motor-scooter': {
    head: 63,
    offset: -0.045,
    headTop: 0.98,
    headBottom: 0.42,
    grip: [0.3, 1, 0.22],
    seat: { top: 0.81, z: -0.22 },
    peg: [0.13, 0.26, 0.16],
    tire: [0.12, 0.085],
    eye: [0.66, 0.12],
    floor: 0.26,
    badge: [0.262, 0.55, -0.6, 0.05],
  },
};

/** Frame geometry and rider contact points for a cycle recipe (also used by the authoring tools). */
export function cycleGeometry(s) {
  const f = CYCLE_FRAMES[s.shape];
  if (!f) throw new Error(`No cycle frame for ${s.shape}`);
  const wb = s.wheelbase,
    rr = s.wheelRadius,
    rf = s.frontWheelRadius ?? rr;
  const R = [0, rr, -wb / 2],
    F = [0, rf, wb / 2];
  const ha = (f.head * Math.PI) / 180;
  const Qz = F[2] - f.offset / Math.sin(ha);
  const axisAt = (y) => [0, y, Qz - (y - rf) / Math.tan(ha)];
  const g = { ...f, wb, rr, rf, R, F, ha, axisAt, tilt: -(Math.PI / 2 - ha) };
  g.barAxisAt = axisAt;
  g.barTilt = g.tilt;
  if (s.family === 'bicycle') {
    g.bb = [0, rr - f.drop, -wb / 2 + f.stay];
    const sa = (f.seatAngle * Math.PI) / 180;
    g.seatAt = (y) => [0, y, g.bb[2] - (y - g.bb[1]) / Math.tan(sa)];
    g.cluster = g.seatAt(f.cluster);
    g.saddle = [0, f.saddle, g.seatAt(f.saddle - 0.05)[2] - 0.01];
    if (f.rearHead) {
      const { angle, z, y } = f.rearHead;
      const a = (angle * Math.PI) / 180;
      g.barAxisAt = (h) => [0, h, z - (h - y) / Math.tan(a)];
      g.barTilt = -(Math.PI / 2 - a);
    }
    g.pivot = g.barAxisAt(f.steerer);
    g.clamp = [0, f.steerer + f.rise, g.pivot[2] + f.reach];
    g.seat = [0, f.saddle + 0.03, g.saddle[2]];
    g.pedals = { center: g.bb, radius: f.crank, halfWidth: f.pedalWidth };
  } else {
    g.pivot = axisAt(f.headTop);
    g.seat = [0, f.seat.top + 0.03, f.seat.z];
    // The rider's ankle rests above and behind the peg.
    const [px, py, pz] = f.peg;
    g.footrests = [
      [px, py + 0.08, pz - 0.06],
      [-px, py + 0.08, pz - 0.06],
    ];
  }
  g.grips = [f.grip, [-f.grip[0], f.grip[1], f.grip[2]]];
  g.eye = [0, g.seat[1] + f.eye[0], g.seat[2] + f.eye[1]];
  return g;
}

export function fleetModel(s) {
  let hull;
  const root = new T.Group();
  root.name = s.id;
  const body = new T.Group();
  body.name = 'body';
  root.add(body);
  const material = (name, color, metalness = 0, roughness = 0.7) =>
    new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true });
  const paint = material('vehicle-paint-and-trim', s.color, 0.12, 0.45);
  const cream = material('ivory', '#e8e5d9');
  const glass = material('glazing', '#4d6178', 0.15, 0.23);
  if (s.family === 'car' || s.family === 'watercraft') {
    glass.transparent = true;
    glass.opacity = 0.24;
    glass.depthWrite = false;
    glass.side = T.DoubleSide;
  }
  const dark = material('rubber-and-trim', '#30353a');
  const metal = material('brushed-metal', '#a4adb2', 0.65, 0.4);
  const deck = material('deck-and-seats', '#ae8963');
  const light = material('headlamps', '#f2d999');
  const red = material('tail-lamps', '#b83f38');
  function mesh(g, geometry, m, name = m.name) {
    ({ geometry, material: m } = prepareSurface(geometry, m));
    const o = new T.Mesh(geometry, m);
    o.name = name;
    g.add(o);
    return o;
  }
  function box(g, size, pos, m, name) {
    const o = mesh(g, new T.BoxGeometry(...size), m, name);
    o.position.set(...pos);
    return o;
  }
  function rod(g, a, b, r, m, sides = 8) {
    const start = new T.Vector3(...a);
    const end = new T.Vector3(...b);
    const d = end.clone().sub(start);
    const o = mesh(g, new T.CylinderGeometry(r, r, d.length(), sides), m);
    o.position.copy(start.add(end).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return o;
  }
  // Loft rectangular cross-sections [z, half-width, bottom, top]. Consistent outward winding.
  function loft(g, sections, m, name, openTop = false, openBottom = false) {
    // Recipes may describe a cowl from nose to tail; winding must still face outward.
    sections = [...sections].sort((a, b) => a[0] - b[0]);
    const points = sections.flatMap(([z, w, b, t]) => [
      [-w, b, z],
      [w, b, z],
      [w, t, z],
      [-w, t, z],
    ]);
    const positions = [];
    const tri = (a, b, c) => positions.push(...points[a], ...points[b], ...points[c]);
    for (let j = 0; j < sections.length - 1; j++) {
      for (let k = 0; k < 4; k++) {
        if ((openTop && k === 2) || (openBottom && k === 0)) continue;
        const a = j * 4 + k;
        const b = j * 4 + ((k + 1) % 4);
        tri(a, b, b + 4);
        tri(a, b + 4, a + 4);
      }
    }
    tri(0, 2, 1);
    tri(0, 3, 2);
    const n = points.length - 4;
    tri(n, n + 1, n + 2);
    tri(n, n + 2, n + 3);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return mesh(g, geometry, m, name);
  }
  function wheel(name, x, z, radius, width, spokes = false) {
    const g = new T.Group();
    g.name = name;
    g.position.set(x, radius, z);
    root.add(g);
    const spin = new T.Group();
    spin.name = `${name}-spin`;
    g.add(spin);
    if (spokes) {
      const tire = mesh(spin, new T.TorusGeometry(radius - width / 2, width / 2, 5, 20), dark);
      tire.rotation.y = Math.PI / 2;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        rod(
          spin,
          [0, 0, 0],
          [0, Math.cos(a) * radius * 0.87, Math.sin(a) * radius * 0.87],
          0.009,
          metal,
          4,
        );
      }
    } else {
      const tire = mesh(spin, new T.CylinderGeometry(radius, radius, width, 16), dark);
      tire.rotation.z = Math.PI / 2;
    }
    const hub = mesh(
      spin,
      new T.CylinderGeometry(
        radius * (spokes ? 0.1 : 0.56),
        radius * (spokes ? 0.1 : 0.56),
        width + 0.012,
        12,
      ),
      metal,
    );
    hub.rotation.z = Math.PI / 2;
    return g;
  }
  const { length: L, width: W, height: H } = s;
  if (s.family === 'car') {
    const r = s.wheelRadius;
    const wb = s.wheelbase;
    const truck = s.shape === 'box-truck';
    const offroad = s.shape === 'offroad';
    const sporty = s.shape === 'sports-coupe';
    const wagon = s.shape === 'station-wagon';
    const belt = truck ? H * 0.36 : H * 0.55;
    const rear = truck ? L * 0.19 : wagon || offroad ? -L * 0.42 : -L * 0.23;
    const front = truck ? L * 0.45 : L * 0.22;
    loft(
      body,
      [
        [-L / 2, W * 0.43, r * 0.7, belt * 0.84],
        [-L * 0.36, W / 2, r * 0.66, belt],
        [L * 0.32, W / 2, r * 0.66, belt],
        [L / 2, W * 0.44, r * 0.8, belt * 0.86],
      ],
      paint,
      'body-shell',
      true,
    );
    // Open the actual cabin: seats and instruments must not intersect a solid body slab.
    box(
      body,
      [W * 0.85, 0.035, front - rear],
      [0, r * 0.72, (front + rear) / 2],
      dark,
      'cabin-floor',
    );
    for (const x of [-W * 0.46, W * 0.46])
      box(body, [W * 0.08, 0.035, front - rear], [x, belt - 0.02, (front + rear) / 2], paint);
    const deckSkin = (sections) => {
      for (let i = 1; i < sections.length; i++) {
        const [a, wa, ya] = sections[i - 1],
          [b, wb, yb] = sections[i];
        const geometry = new T.BufferGeometry();
        geometry.setAttribute(
          'position',
          new T.Float32BufferAttribute(
            [-wa, ya, a, wb, yb, b, wa, ya, a, -wa, ya, a, -wb, yb, b, wb, yb, b],
            3,
          ),
        );
        geometry.computeVertexNormals();
        mesh(body, geometry, paint);
      }
    };
    const edge = (z) => {
      if (z < -L * 0.36) {
        const t = (z + L / 2) / (L * 0.14);
        return [z, W * (0.43 + 0.07 * t), belt * (0.84 + 0.16 * t)];
      }
      if (z > L * 0.32) {
        const t = (z - L * 0.32) / (L * 0.18);
        return [z, W * (0.5 - 0.06 * t), belt * (1 - 0.14 * t)];
      }
      return [z, W / 2, belt];
    };
    deckSkin([-L / 2, -L * 0.36, rear].filter((z) => z <= rear).map(edge));
    deckSkin([front, L * 0.32, L / 2].filter((z) => z >= front).map(edge));
    loft(
      body,
      [
        [rear, W * 0.44, belt, H * 0.84],
        [rear + L * 0.09, W * 0.37, belt, H * 0.96],
        [front - L * 0.12, W * 0.37, belt, H * 0.96],
        [front, W * 0.43, belt, H * 0.65],
      ],
      glass,
      'cabin-glazing',
      false,
      true,
    );
    box(
      body,
      [W * 0.76, H * 0.055, front - rear - L * 0.19],
      [0, H * 0.98, (front + rear - L * 0.03) / 2],
      paint,
      'roof',
    );
    for (const x of [-W * 0.405, W * 0.405]) {
      for (const z of [rear + L * 0.065, (rear + front) / 2])
        box(body, [0.07, H * 0.37, 0.075], [x, belt + H * 0.18, z], paint);
      box(body, [0.08, 0.04, 0.22], [x * 1.22, belt - 0.06, truck ? L * 0.3 : -0.05], metal);
    }
    for (const side of [-1, 1]) {
      rod(
        body,
        [side * W * 0.43, H * 0.65, front],
        [side * W * 0.37, H * 0.96, front - L * 0.12],
        0.035,
        paint,
      );
      rod(
        body,
        [side * W * 0.44, H * 0.84, rear],
        [side * W * 0.37, H * 0.96, rear + L * 0.09],
        0.035,
        paint,
      );
    }
    for (const z of [-L / 2, L / 2]) {
      box(body, [W * 0.83, 0.13, 0.07], [0, r * 1.1, z], dark);
      for (const x of [-W * 0.31, W * 0.31])
        box(
          body,
          [W * 0.23, sporty ? 0.09 : 0.16, 0.035],
          [x, belt * 0.78, z + Math.sign(z) * 0.03],
          z > 0 ? light : red,
        );
    }
    box(body, [W * 0.38, 0.16, 0.04], [0, belt * 0.62, L / 2 + 0.02], dark);
    for (const x of [-W * 0.52, W * 0.52])
      box(body, [0.14, 0.11, 0.18], [x, belt * 1.18, front - 0.18], paint);
    if (truck) {
      box(body, [W * 0.99, H * 0.67, L * 0.65], [0, H * 0.655, -L * 0.15], cream, 'cargo-box');
      for (let j = 0; j < 5; j++)
        box(body, [W * 0.92, 0.04, 0.035], [0, H * 0.42 + j * H * 0.11, -L * 0.48], metal);
      box(body, [0.035, H * 0.6, 0.04], [0, H * 0.65, -L * 0.48], dark);
    }
    if (wagon || offroad)
      for (const x of [-W * 0.3, W * 0.3])
        box(body, [0.05, 0.06, L * 0.48], [x, H + 0.035, -L * 0.06], metal);
    if (sporty) box(body, [W * 0.85, 0.06, 0.23], [0, H * 0.7, -L * 0.43], dark);
    if (s.shape === 'taxi') box(body, [W * 0.34, 0.18, 0.32], [0, H + 0.09, 0], light, 'taxi-sign');
    for (const [axle, z] of [
      ['front', wb / 2],
      ['rear', -wb / 2],
    ])
      for (const [side, x] of [
        ['left', W * 0.49],
        ['right', -W * 0.49],
      ])
        wheel(`wheel-${axle}-${side}`, x, z, r, W * 0.12);
  } else if (s.family === 'bicycle' || s.family === 'motorcycle') {
    // Cycles are built from the measured geometry of real archetypes (cycleGeometry): head and
    // seat angles, fork offset, bottom-bracket drop and the rider's contact points, which the
    // entity's grips, pedals, footrests and seat repeat.
    const G = cycleGeometry(s);
    s = { ...s, cycleFrame: G };
    const bike = s.family === 'bicycle';
    const kind = s.shape;
    const X = new T.Vector3(1, 0, 0);
    // A steering node turns about its local Y. Tilting the node lays that axis along the real
    // steering axis; the "-frame" child cancels the tilt so parts are authored in model space.
    const steered = (outer, tilt) => {
      outer.rotation.x = tilt;
      const inner = new T.Group();
      inner.name = `${outer.name}-frame`;
      inner.rotation.x = -tilt;
      inner.position.copy(outer.position).applyAxisAngle(X, -tilt).multiplyScalar(-1);
      outer.add(inner);
      return inner;
    };
    const indexed = (positions, indices) => {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };
    // Round tube along a polyline (shared mitred rings, capped ends).
    const tube = (g, points, radius, m, sides = 8, name) => {
      const { positions, indices } = joinedPath(points, radius, sides, false);
      return mesh(g, indexed(positions, indices), m, name);
    };
    // Closed loft through rings of equal point count: smooth sides, flat end caps. The winding is
    // chosen from the enclosed volume, so rings may run in either direction.
    const ringLoft = (g, rings, m, name) => {
      const n = rings[0].length;
      const positions = rings.flat(2);
      const indices = [];
      for (let j = 0; j < rings.length - 1; j++)
        for (let k = 0; k < n; k++) {
          const a = j * n + k,
            b = j * n + ((k + 1) % n);
          indices.push(a, b, b + n, a, b + n, a + n);
        }
      for (const [ring, flip] of [
        [rings[0], true],
        [rings.at(-1), false],
      ]) {
        const base = positions.length / 3;
        const centre = [0, 1, 2].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / n);
        positions.push(...ring.flat(), ...centre);
        for (let k = 0; k < n; k++) {
          const a = base + k,
            b = base + ((k + 1) % n);
          indices.push(...(flip ? [base + n, b, a] : [base + n, a, b]));
        }
      }
      let volume = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = [0, 1, 2].map((o) => indices[i + o] * 3);
        const p = (v, o) => positions[v + o];
        volume +=
          p(a, 0) * (p(b, 1) * p(c, 2) - p(b, 2) * p(c, 1)) -
          p(a, 1) * (p(b, 0) * p(c, 2) - p(b, 2) * p(c, 0)) +
          p(a, 2) * (p(b, 0) * p(c, 1) - p(b, 1) * p(c, 0));
      }
      if (volume < 0)
        for (let i = 0; i < indices.length; i += 3)
          [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      // Caps keep their own vertices so the rim stays crisp while the sides shade round.
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return mesh(g, geometry, m, name);
    };
    // Rounded body section [z, halfWidth, bottom, top, x?]: a superellipse whose top (and
    // bottom) can draw in, as a tank, seat or side cowl does.
    const section = ([z, w, b, t, xc = 0], { n = 14, e = 2.4, top = 0, bottom = 0 } = {}) => {
      const yc = (b + t) / 2,
        hy = (t - b) / 2;
      const se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 / e);
      return Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2;
        const u = (Math.sin(a) + 1) / 2;
        const taper = 1 - top * u * u - bottom * (1 - u) * (1 - u);
        return [xc + w * taper * se(Math.cos(a)), yc + hy * se(Math.sin(a)), z];
      });
    };
    const shell = (g, sections, m, name, options) =>
      ringLoft(
        g,
        sections.map((s) => section(s, options)),
        m,
        name,
      );
    // A fender or valance swept round a wheel centre: angle 0 is the top, + is forward.
    const fender = (g, [, y0, z0], radius, from, to, half, skirt, m, name, steps = 14) => {
      const t = 0.006;
      const profile = [
        [-half, -skirt],
        [-half * 0.82, 0.004],
        [-half * 0.4, 0.016],
        [0, 0.02],
        [half * 0.4, 0.016],
        [half * 0.82, 0.004],
        [half, -skirt],
      ];
      const loop = [...profile, ...profile.map(([x, r]) => [x * 0.94, r - t]).reverse()];
      const rings = Array.from({ length: steps + 1 }, (_, i) => {
        const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
        return loop.map(([x, r]) => [
          x,
          y0 + (radius + r) * Math.cos(a),
          z0 + (radius + r) * Math.sin(a),
        ]);
      });
      return ringLoft(g, rings, m, name);
    };
    const cylinderX = (g, at, radius, length, m, sides = 16, radiusEnd = radius) => {
      const o = mesh(
        g,
        new T.CylinderGeometry(radius, radiusEnd, length, sides).rotateZ(Math.PI / 2),
        m,
      );
      o.position.set(...at);
      return o;
    };
    const cylinderZ = (g, at, radius, length, m, sides = 16, radiusEnd = radius) => {
      const o = mesh(
        g,
        new T.CylinderGeometry(radiusEnd, radius, length, sides).rotateX(Math.PI / 2),
        m,
      );
      o.position.set(...at);
      return o;
    };
    const ringX = (g, at, radius, tubeRadius, m, segments = 24) => {
      const o = mesh(
        g,
        new T.TorusGeometry(radius, tubeRadius, 4, segments).rotateY(Math.PI / 2),
        m,
      );
      o.position.set(...at);
      return o;
    };
    const _mirror = (points) => points.map(([x, y, z]) => [-x, y, z]);
    // Solid swept along a unit axis d (in the y-z plane) from `base`: [t, scale] stations carry a
    // rounded-square section of half-sizes [x, across]. Steps between stations stay creased, so
    // finned barrels, heads, covers and lamps read as machined parts rather than soft blobs.
    const barrel = (g, base, d, stations, [hw, hd], m, { n = 12, e = 3 } = {}) => {
      const across = [0, d[2], -d[1]];
      const se = (c) => Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
      const rings = stations.map(([t, k]) =>
        Array.from({ length: n }, (_, i) => {
          const a = ((i + 0.5) / n) * Math.PI * 2;
          const u = hw * k * se(Math.cos(a)),
            w = hd * k * se(Math.sin(a));
          return [u, base[1] + d[1] * t + across[1] * w, base[2] + d[2] * t + across[2] * w];
        }).map(([x, y, z]) => [base[0] + x, y, z]),
      );
      const o = ringLoft(g, rings, m);
      o.geometry = smoothSurface(o.geometry, 50);
      return o;
    };
    // Barrel stations for `count` fins of thickness `thick` between t0 and t1 on a core `core`.
    const fins = (t0, t1, count, core, thick = 0.008, grow = 0) => {
      const out = [[t0, core]];
      for (let i = 0; i < count; i++) {
        const t = t0 + ((i + 0.5) * (t1 - t0)) / count,
          k = 1 + (grow * i) / Math.max(1, count - 1);
        out.push(
          [t - thick / 2, core],
          [t - thick / 2, k],
          [t + thick / 2, k],
          [t + thick / 2, core],
        );
      }
      out.push([t1, core]);
      return out;
    };

    // Wheels: tyre with a real section, rim, hub and wire or cast spokes on the spin node.
    const cycleWheel = (name, [, r, z], [tireWidth, tireHeight], style) => {
      const g = new T.Group();
      g.name = name;
      g.position.set(0, r, z);
      root.add(g);
      const spin = new T.Group();
      spin.name = `${name}-spin`;
      g.add(spin);
      const tire = new T.TorusGeometry(r - tireHeight / 2, tireHeight / 2, 8, bike ? 40 : 36)
        .rotateY(Math.PI / 2)
        .scale(tireWidth / tireHeight, 1, 1);
      mesh(spin, tire, dark, `${name}-tire`);
      const rim = r - tireHeight;
      if (style === 'cast') {
        ringX(spin, [0, 0, 0], rim, 0.016, metal, 32).scale.x = (tireWidth * 0.55) / 0.016;
        const hub = cylinderX(spin, [0, 0, 0], 0.055, tireWidth * 0.75, metal, 18);
        hub.name = `${name}-hub`;
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5;
          for (const d of [-0.12, 0.12]) {
            const spoke = box(spin, [0.022, rim - 0.06, 0.03], [0, 0, 0], metal);
            spoke.rotation.x = a + d;
            spoke.position.set(
              0,
              Math.cos(a + d) * (rim / 2 + 0.03),
              Math.sin(a + d) * (rim / 2 + 0.03),
            );
          }
        }
      } else {
        const rimTube = bike ? 0.009 : 0.013;
        ringX(spin, [0, 0, 0], rim + rimTube * 0.4, rimTube, metal, 36).scale.x = bike ? 1.7 : 2.4;
        // A road wheel has a deep-section rim (a dark band inside the braking track) and fewer
        // spokes, laced radially at the front.
        const road = kind === 'road-bicycle';
        if (road) ringX(spin, [0, 0, 0], rim - 0.02, 0.022, dark, 36).scale.x = 0.55;
        const flange = bike ? 0.03 : 0.055,
          hubRadius = bike ? 0.022 : 0.05;
        cylinderX(spin, [0, 0, 0], bike ? 0.016 : 0.045, flange * 2.2, metal, 12);
        for (const x of [-flange, flange]) cylinderX(spin, [x, 0, 0], hubRadius, 0.006, metal, 12);
        const radial = road && name === 'wheel-front';
        const count = road ? (radial ? 18 : 24) : bike ? 32 : 36;
        for (let k = 0; k < count; k++) {
          const side = k % 2 ? 1 : -1;
          const a = (k * Math.PI * 2) / count;
          const lead = radial ? a : a + side * (bike ? 0.35 : 0.25);
          // Spokes are open three-sided wires: their ends sit inside the hub flange and rim.
          const from = new T.Vector3(
            side * flange,
            Math.cos(lead) * hubRadius,
            Math.sin(lead) * hubRadius,
          );
          const span = new T.Vector3(
            side * 0.004,
            Math.cos(a) * (rim - 0.004),
            Math.sin(a) * (rim - 0.004),
          ).sub(from);
          const r = bike ? 0.0017 : 0.0026;
          const spoke = mesh(spin, new T.CylinderGeometry(r, r, span.length(), 3, 1, true), metal);
          spoke.position.copy(from).addScaledVector(span, 0.5);
          spoke.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), span.normalize());
        }
      }
      return g;
    };
    const [rearTire, frontTire] = Array.isArray(G.tire[0]) ? G.tire : [G.tire, G.tire];
    const rearWheel = cycleWheel(
      'wheel-rear',
      G.R,
      rearTire,
      kind === 'motor-scooter' ? 'cast' : 'wire',
    );
    const frontWheel = cycleWheel(
      'wheel-front',
      G.F,
      frontTire,
      kind === 'motor-scooter' ? 'cast' : 'wire',
    );
    // Fork, fender and caliper steer with the wheel; stem, bars and lamp with the handlebar.
    const fork = steered(frontWheel, G.tilt);
    const handlebar = new T.Group();
    handlebar.name = 'handlebar';
    handlebar.position.set(...G.pivot);
    root.add(handlebar);
    const bars = steered(handlebar, G.barTilt);
    const at = G.axisAt;
    const lamp = (g, centre, radius, depth, shellMaterial) => {
      cylinderZ(
        g,
        [centre[0], centre[1], centre[2] - depth / 2],
        radius,
        depth,
        shellMaterial,
        18,
        radius * 0.72,
      );
      const lens = mesh(
        g,
        new T.SphereGeometry(radius * 0.94, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.32).rotateX(
          Math.PI / 2,
        ),
        light,
        'headlamp',
      );
      lens.position.set(
        centre[0],
        centre[1],
        centre[2] - radius * 0.94 * Math.cos(Math.PI * 0.32) + 0.004,
      );
      return lens;
    };
    if (bike) {
      const { bb, R, F } = G;
      const fr = kind === 'road-bicycle' ? 0.014 : kind === 'cargo-bicycle' ? 0.019 : 0.016;
      const road = kind === 'road-bicycle';
      // Tube radii: plain steel on the utility bikes; the road bike's oversized alloy frame
      // has a fat down tube, a tapered head tube and slim stays dropped below the top tube.
      const tr = road
        ? { head: 0.021, top: 0.017, down: 0.022, seat: 0.017, chain: 0.011, stay: 0.0075 }
        : { head: fr * 1.3, top: fr, down: fr * 1.15, seat: fr, chain: fr * 0.62, stay: fr * 0.55 };
      const headAxis = kind === 'cargo-bicycle' ? G.barAxisAt : at;
      const head = G.rearHead ?? { bottom: G.headBottom, top: G.headTop };
      // Diamond (or long-john rear) frame: head tube, top/down/seat tubes, stays, BB shell.
      if (road) {
        const [a, b] = [headAxis(head.bottom - 0.01), headAxis(head.top)];
        const span = new T.Vector3(...b).sub(new T.Vector3(...a));
        barrel(
          body,
          a,
          span.clone().normalize().toArray(),
          [
            [0, 1.2],
            [span.length(), 0.9],
          ],
          [tr.head, tr.head],
          paint,
          { n: 12, e: 2 },
        );
      } else tube(body, [headAxis(head.bottom), headAxis(head.top)], tr.head, paint, 10);
      // The road bike's top and down tubes are oval: deeper than they are wide.
      const oval = (a, b, [w, d]) => {
        const span = new T.Vector3(...b).sub(new T.Vector3(...a));
        barrel(
          body,
          a,
          span.clone().normalize().toArray(),
          [
            [0, 1],
            [span.length(), 1],
          ],
          [w, d],
          paint,
          { n: 12, e: 2 },
        );
      };
      if (road) {
        oval(G.cluster, headAxis(G.topTube), [tr.top, tr.top * 1.15]);
        oval(bb, headAxis(head.bottom + 0.035), [tr.down * 0.9, tr.down * 1.15]);
      } else if (!G.stepThrough) {
        tube(body, [G.cluster, headAxis(G.topTube)], tr.top, paint, 10);
        tube(body, [bb, headAxis(head.bottom + 0.035)], tr.down, paint, 10);
      } else tube(body, [bb, headAxis(head.bottom + 0.035)], tr.down, paint, 10);
      tube(body, [bb, G.seatAt(G.cluster[1] + 0.03)], tr.seat, paint, 10);
      for (const side of [-1, 1]) {
        tube(
          body,
          [
            [side * 0.06, R[1], R[2]],
            [side * 0.05, bb[1] + 0.005, bb[2] - 0.12],
            [side * 0.03, bb[1], bb[2] - 0.02],
          ],
          tr.chain,
          paint,
          8,
        );
        tube(
          body,
          [
            [side * 0.056, R[1] + 0.01, R[2] + 0.01],
            [
              side * 0.022,
              G.cluster[1] - (road ? 0.05 : 0.025),
              (road ? G.seatAt(G.cluster[1] - 0.05)[2] : G.cluster[2]) - 0.01,
            ],
          ],
          tr.stay,
          paint,
          8,
        );
        box(body, [0.006, 0.05, 0.05], [side * 0.06, R[1], R[2]], paint);
      }
      cylinderX(body, bb, 0.022, 0.075, paint, 12);
      tube(
        body,
        [G.seatAt(G.cluster[1] - 0.02), G.seatAt(G.saddle[1] - 0.045)],
        fr * 0.82,
        metal,
        10,
      );
      // Fork: crown and blades raked forward to the dropouts.
      const crown = at(G.crown);
      // A road crown is a slim taper into the blades; utility forks carry a flat crown.
      if (road) {
        const crownTop = at(G.crown + 0.012);
        barrel(
          fork,
          crownTop,
          [0, -Math.sin(G.ha), Math.cos(G.ha)],
          [
            [0, 1],
            [0.03, 0.75],
          ],
          [0.046, 0.02],
          paint,
          { n: 12, e: 2.4 },
        );
      } else box(fork, [0.11, 0.03, 0.045], crown, paint);
      const bendFrom = F[1] + 0.6 * (G.crown - F[1]);
      const extra = G.offset / Math.sin(G.ha);
      for (const side of [-1, 1]) {
        // Steel blades bend forward near the dropouts; the road bike's are straight and raked.
        const blade = Array.from({ length: 7 }, (_, i) => {
          const y = G.crown - ((G.crown - F[1]) * i) / 6;
          const u = road ? i / 6 : Math.max(0, (bendFrom - y) / (bendFrom - F[1]));
          return [side * (0.03 + 0.018 * (i / 6)), y, at(y)[2] + extra * (road ? u : u * u)];
        });
        tube(fork, blade, road ? 0.013 : 0.012, paint, 8);
        box(fork, [0.006, 0.04, 0.04], [side * 0.05, F[1], F[2]], metal);
      }
      // Stem and bars on the handlebar.
      tube(bars, [headAxis(head.top - 0.01), G.pivot, G.clamp], 0.0135, metal, 10);
      // Headset spacers between the head tube and the stem.
      if (road) tube(bars, [headAxis(head.top), headAxis(G.steerer - 0.02)], 0.017, dark, 10);
      cylinderX(bars, G.clamp, 0.019, 0.05, metal, 12);
      const [gx, gy, gz] = G.grips[0];
      const [, cy, cz] = G.clamp;
      if (G.bars === 'drop') {
        // Round drop bar: tops, a forward bend to the ramps and hoods, then the drop curving
        // back to the bar ends, sampled along a smooth curve rather than a few straight runs.
        const half = gx;
        const hookCurve = (side) =>
          new T.CatmullRomCurve3(
            [
              [0.08, 0, 0],
              [half - 0.055, 0, 0.001],
              [half - 0.014, 0.002, 0.024],
              [half, 0.003, 0.056],
              [half, -0.016, 0.097],
              [half, -0.06, 0.109],
              [half, -0.108, 0.093],
              [half, -0.136, 0.048],
              [half, -0.142, -0.04],
            ].map(([x, y, z]) => new T.Vector3(side * x, cy + y, cz + z)),
            false,
            'centripetal',
          )
            .getPoints(16)
            .map((v) => v.toArray());
        tube(bars, [...hookCurve(-1).reverse(), ...hookCurve(1)], 0.0125, metal, 8);
        // Bar tape from the bend to the bar ends.
        for (const side of [-1, 1]) {
          const points = hookCurve(side);
          tube(bars, points.slice(points.findIndex(([, , z]) => z > cz + 0.03)), 0.0145, dark, 8);
        }
      } else {
        const sweep = (side) => [
          [side * 0.1, cy + 0.012, cz + 0.012],
          [side * (gx - 0.07), gy - 0.004, cz - 0.03],
          [side * (gx - 0.012), gy, gz + 0.07],
          [side * (gx + 0.012), gy, gz - 0.065],
        ];
        tube(bars, [...sweep(-1).reverse(), [0, cy, cz], ...sweep(1)], 0.0115, metal, 8);
        for (const side of [-1, 1])
          tube(
            bars,
            [
              [side * (gx - 0.008), gy, gz + 0.06],
              [side * (gx + 0.012), gy, gz - 0.065],
            ],
            0.0175,
            dark,
            10,
          );
      }
      // Saddle: broad sprung leather on utility bikes, a slim racing shell on the road bike.
      const [, sy, sz] = G.saddle;
      const slim = kind === 'road-bicycle';
      shell(
        body,
        slim
          ? [
              [sz - 0.12, 0.05, sy - 0.03, sy - 0.006],
              [sz - 0.08, 0.07, sy - 0.035, sy],
              [sz - 0.02, 0.055, sy - 0.035, sy - 0.002],
              [sz + 0.07, 0.028, sy - 0.03, sy - 0.006],
              [sz + 0.15, 0.016, sy - 0.03, sy - 0.012],
            ]
          : [
              [sz - 0.12, 0.085, sy - 0.05, sy - 0.012],
              [sz - 0.09, 0.115, sy - 0.06, sy],
              [sz - 0.01, 0.1, sy - 0.06, sy - 0.004],
              [sz + 0.07, 0.045, sy - 0.05, sy - 0.012],
              [sz + 0.15, 0.028, sy - 0.045, sy - 0.02],
            ],
        dark,
        'saddle',
        { e: 2.6, bottom: 0.2 },
      );
      const clamp = G.seatAt(sy - 0.045);
      tube(
        body,
        [
          [0, clamp[1], sz - 0.08],
          [0, clamp[1], sz + 0.1],
        ],
        0.008,
        metal,
        6,
      );
      if (!slim)
        for (const side of [-1, 1])
          for (let i = 0; i < 4; i++)
            ringX(
              body,
              [side * 0.07, sy - 0.07 - i * 0.014, sz - 0.08],
              0.014,
              0.003,
              metal,
              8,
            ).rotation.set(Math.PI / 2, 0, 0);
      // Cranks, chainring and pedals turn on the crank pivot.
      const pedals = new T.Group();
      pedals.name = 'pedal-crank';
      pedals.position.set(...bb);
      root.add(pedals);
      cylinderX(pedals, [0, 0, 0], 0.008, 0.18, metal, 8);
      const chainring = kind === 'road-bicycle' ? 0.105 : 0.08;
      // Chainrings: a toothed band (flat ring) rather than a wire hoop.
      ringX(pedals, [-0.045, 0, 0], chainring - 0.008, 0.01, metal, 32).scale.x = 0.3;
      if (road) ringX(pedals, [-0.038, 0, 0], 0.072, 0.009, metal, 28).scale.x = 0.3;
      for (let k = 0; k < 5; k++) {
        const a = (k * Math.PI * 2) / 5;
        rod(
          pedals,
          [-0.045, 0, 0],
          [-0.045, Math.cos(a) * chainring * 0.9, Math.sin(a) * chainring * 0.9],
          0.005,
          metal,
          4,
        );
      }
      const crank = G.pedals.radius,
        pedalX = G.pedals.halfWidth;
      for (const side of [-1, 1]) {
        tube(
          pedals,
          [
            [side * 0.075, 0, 0],
            [side * 0.085, side * crank, 0],
          ],
          0.009,
          metal,
          6,
        );
        const pedal = new T.Group();
        pedal.name = side > 0 ? 'pedal-left' : 'pedal-right';
        pedal.position.set(side * pedalX, side * crank, 0);
        pedals.add(pedal);
        if (road) {
          // Clipless pedal: a narrow body round its spindle tapering to a nose, the cleat
          // plate on top.
          box(pedal, [0.045, 0.014, 0.045], [side * 0.008, 0, -0.006], dark);
          box(pedal, [0.028, 0.01, 0.025], [side * 0.008, -0.002, 0.026], dark);
          box(pedal, [0.036, 0.004, 0.04], [side * 0.008, 0.009, 0], metal);
        } else {
          box(pedal, [0.09, 0.016, 0.06], [side * 0.01, 0, 0], dark);
          box(pedal, [0.06, 0.008, 0.012], [side * 0.01, 0, 0.033], red);
        }
      }
      // Chain and sprocket on the drive (right, -X) side.
      const cog = kind === 'road-bicycle' ? 0.05 : 0.04;
      for (let i = 0; i < (kind === 'road-bicycle' ? 5 : 1); i++)
        ringX(body, [-0.035 - i * 0.005, R[1], R[2]], cog - i * 0.005, 0.003, metal, 20);
      for (const dir of [1, -1])
        tube(
          body,
          [
            [-0.045, bb[1] + dir * chainring, bb[2]],
            [-0.04, R[1] + dir * cog, R[2]],
          ],
          0.004,
          dark,
          4,
        );
      if (kind === 'road-bicycle') {
        // Rear derailleur: a body off the hanger and a cage with two jockey wheels below the
        // sprockets.
        tube(
          body,
          [
            [-0.062, R[1] - 0.012, R[2] + 0.004],
            [-0.07, R[1] - 0.045, R[2] - 0.016],
          ],
          0.009,
          dark,
          8,
        );
        box(body, [0.006, 0.08, 0.022], [-0.074, R[1] - 0.082, R[2] - 0.006], dark).rotation.x =
          0.12;
        for (const [dy, dz] of [
          [-0.052, -0.002],
          [-0.112, -0.01],
        ])
          cylinderX(body, [-0.068, R[1] + dy, R[2] + dz], 0.011, 0.006, metal, 10);
        // Dual-pivot caliper brakes: arms from the centre bolt straddle the tyre to the pads.
        const caliper = (g, [y, z], drop) => {
          tube(
            g,
            [
              [-0.028, y - drop, z],
              [-0.028, y - 0.016, z],
              [-0.014, y + 0.003, z],
              [0.014, y + 0.003, z],
              [0.028, y - 0.016, z],
              [0.028, y - drop, z],
            ],
            0.006,
            dark,
            6,
          );
          box(g, [0.012, 0.014, 0.02], [0, y, z - 0.008], metal);
          for (const side of [-1, 1])
            box(g, [0.006, 0.01, 0.03], [side * 0.019, y - drop, z], dark);
        };
        caliper(body, [G.seatAt(R[1] + 0.32)[1], R[2] + 0.18], 0.06);
        caliper(fork, [crown[1] - 0.012, crown[2] + 0.03], 0.045);
        // A bottle cage on the down tube.
        const cageA = [0, 0, 0].map((_, i) => bb[i] + (headAxis(head.bottom)[i] - bb[i]) * 0.35);
        const cageB = [0, 0, 0].map((_, i) => bb[i] + (headAxis(head.bottom)[i] - bb[i]) * 0.62);
        tube(
          body,
          [
            [0, cageA[1] + 0.035, cageA[2] - 0.01],
            [0, cageB[1] + 0.035, cageB[2] - 0.01],
          ],
          0.033,
          metal,
          10,
        );
      } else {
        // Utility kit: full fenders, enclosed chain case, rear rack and lamps.
        const fenderRadius = (r) => r + 0.022;
        fender(body, R, fenderRadius(G.rr), -118, 38, 0.034, 0.012, paint, 'rear-fender');
        fender(fork, F, fenderRadius(G.rf), -122, 34, 0.034, 0.012, paint, 'front-fender');
        for (const side of [-1, 1]) {
          const a = (-112 * Math.PI) / 180;
          rod(
            body,
            [side * 0.055, R[1], R[2]],
            [
              side * 0.036,
              R[1] + fenderRadius(G.rr) * Math.cos(a),
              R[2] + fenderRadius(G.rr) * Math.sin(a),
            ],
            0.0035,
            metal,
            4,
          );
          const b = (28 * Math.PI) / 180;
          rod(
            fork,
            [side * 0.05, F[1], F[2]],
            [
              side * 0.036,
              F[1] + fenderRadius(G.rf) * Math.cos(b),
              F[2] + fenderRadius(G.rf) * Math.sin(b),
            ],
            0.0035,
            metal,
            4,
          );
        }
        // Chain case: the hull of the chainring and the rear sprocket, closed on the outside.
        const hull2 = [];
        for (const [cz, cy, cr] of [
          [bb[2], bb[1], chainring + 0.016],
          [R[2], R[1], cog + 0.02],
        ])
          for (let k = 0; k < 24; k++)
            hull2.push([
              cz + Math.sin((k * Math.PI) / 12) * cr,
              cy + Math.cos((k * Math.PI) / 12) * cr,
            ]);
        hull2.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lower = [],
          upper = [];
        for (const p of hull2) {
          while (lower.length > 1 && turn(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
          lower.push(p);
        }
        for (const p of [...hull2].reverse()) {
          while (upper.length > 1 && turn(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
          upper.push(p);
        }
        const outline = [...lower.slice(0, -1), ...upper.slice(0, -1)];
        const chainCase = new T.ExtrudeGeometry(
          new T.Shape(outline.map(([u, v]) => new T.Vector2(u, v))),
          {
            depth: 0.026,
            bevelEnabled: false,
          },
        ).rotateY(-Math.PI / 2);
        mesh(body, chainCase, dark, 'chain-case').position.x = -0.03;
        // Rear rack over the fender, on stays to the dropouts.
        const rackY = G.rack;
        const rackBack = R[2] - 0.235,
          rackFront = G.cluster[2] - 0.03;
        for (const side of [-1, 1]) {
          tube(
            body,
            [
              [side * 0.075, rackY, rackBack],
              [side * 0.075, rackY, rackFront],
            ],
            0.0055,
            metal,
            6,
          );
          rod(
            body,
            [side * 0.075, rackY, R[2] - 0.12],
            [side * 0.058, R[1] + 0.02, R[2] - 0.02],
            0.005,
            metal,
            5,
          );
          rod(
            body,
            [side * 0.075, rackY, rackBack + 0.02],
            [side * 0.06, R[1] + 0.03, R[2] - 0.03],
            0.005,
            metal,
            5,
          );
          rod(
            body,
            [side * 0.075, rackY, rackFront],
            [side * 0.03, G.cluster[1] - 0.05, G.cluster[2] - 0.05],
            0.004,
            metal,
            5,
          );
        }
        for (let i = 0; i < 5; i++) {
          const z = rackBack + ((rackFront - rackBack) * i) / 4;
          rod(body, [-0.075, rackY, z], [0.075, rackY, z], 0.0045, metal, 5);
        }
        // Tail lamp with its reflector on the rack's rear plate.
        box(body, [0.16, 0.012, 0.03], [0, rackY - 0.02, rackBack - 0.005], metal);
        box(body, [0.09, 0.045, 0.035], [0, rackY - 0.035, rackBack - 0.012], red, 'tail-lamp');
        // Side stand folded along the left chain stay.
        tube(
          body,
          [
            [0.07, bb[1] + 0.01, bb[2] - 0.06],
            [0.085, bb[1] + 0.03, bb[2] - 0.36],
          ],
          0.009,
          dark,
          6,
        );
        if (kind === 'city-bicycle') {
          // Dutch dress guards over the wheel's upper rear quadrant, from the seat stays back:
          // strung guards, drawn as three arc bands with the spokes showing between them. The
          // ring lock sits on the stays above the tyre.
          const stayAngle = Math.atan2(G.cluster[1] - R[1], G.cluster[2] - R[2]);
          const bands = [
            [0.14, 0.18],
            [0.2, 0.24],
            [0.26, G.rr - 0.05],
          ].map(([r0, r1]) => {
            const band = new T.Shape();
            band.absarc(0, 0, r1, stayAngle + 0.08, Math.PI - 0.45, false);
            band.absarc(0, 0, r0, Math.PI - 0.45, stayAngle + 0.08, true);
            return new T.ExtrudeGeometry(band, {
              depth: 0.004,
              bevelEnabled: false,
              curveSegments: 8,
            }).rotateY(-Math.PI / 2);
          });
          const plate = mergeGeometries(bands);
          for (const side of [-1, 1])
            mesh(body, plate.clone(), dark, 'dress-guard').position.set(
              side * 0.08 + 0.002,
              R[1],
              R[2],
            );
          const lockAt = G.rr + 0.035;
          const lock = box(
            body,
            [0.115, 0.05, 0.075],
            [0, R[1] + lockAt * Math.sin(stayAngle), R[2] + lockAt * Math.cos(stayAngle)],
            metal,
            'ring-lock',
          );
          lock.rotation.x = Math.PI / 2 - stayAngle;
          box(body, [0.012, 0.016, 0.016], [-0.062, lock.position.y, lock.position.z], dark);
          // Fork-mounted front carrier with a crate; the lamp sits on the carrier's nose.
          const basketY = G.basket[0],
            basketZ = G.basket[1];
          box(fork, [0.28, 0.018, 0.24], [0, basketY, basketZ], deck, 'basket-floor');
          for (const side of [-1, 1]) {
            box(
              fork,
              [0.018, 0.18, 0.24],
              [side * 0.141, basketY + 0.09, basketZ],
              deck,
              'basket-side',
            );
            box(
              fork,
              [0.28, 0.18, 0.018],
              [0, basketY + 0.09, basketZ + side * 0.111],
              deck,
              'basket-end',
            );
            rod(
              fork,
              [side * 0.12, basketY - 0.01, basketZ + 0.08],
              [side * 0.05, F[1] + 0.02, F[2]],
              0.005,
              metal,
              5,
            );
            rod(
              fork,
              [side * 0.12, basketY - 0.01, basketZ - 0.1],
              [side * 0.03, crown[1] + 0.005, crown[2] + 0.01],
              0.005,
              metal,
              5,
            );
          }
          for (let i = 1; i < 4; i++) {
            const y = basketY + i * 0.045;
            box(fork, [0.288, 0.008, 0.248], [0, y, basketZ], dark);
          }
          lamp(fork, [0, basketY - 0.035, basketZ + 0.135], 0.042, 0.055, metal);
        }
      }
      if (kind === 'cargo-bicycle') {
        // Long-john: a low beam carries the box to the front steering head; a rod links the
        // rider's steerer to the small front wheel's fork.
        const box0 = G.box;
        const fh = [at(G.headBottom), at(G.headTop)];
        tube(body, fh, 0.021, paint, 10);
        tube(
          body,
          [
            [0, bb[1] - 0.01, bb[2] + 0.04],
            [0, 0.17, -0.2],
            [0, 0.155, box0.front[0]],
            [0, fh[0][1] - 0.04, fh[0][2] - 0.06],
            fh[0],
          ],
          0.022,
          paint,
          10,
        );
        tube(
          body,
          [headAxis(head.bottom), [0, 0.17, headAxis(head.bottom)[2] + 0.03]],
          0.02,
          paint,
          10,
        );
        tube(body, [headAxis(head.bottom - 0.02), [0, 0.13, headAxis(0.13)[2]]], 0.011, metal, 8);
        tube(
          body,
          [
            [-0.06, 0.12, headAxis(0.13)[2] + 0.02],
            [-0.06, 0.12, box0.front[0] + 0.02],
            [-0.06, 0.25, fh[0][2] + 0.05],
          ],
          0.006,
          metal,
          6,
        );
        // Box: plywood floor and walls flaring to an open top, a bench and rim trim.
        const half = box0.half;
        const side = [
          [box0.rear[0], box0.floor],
          [box0.front[0], box0.floor],
          [box0.front[1], box0.top],
          [box0.rear[1], box0.top],
        ];
        const wall = new T.ExtrudeGeometry(new T.Shape(side.map(([u, v]) => new T.Vector2(u, v))), {
          depth: 0.016,
          bevelEnabled: false,
        }).rotateY(-Math.PI / 2);
        for (const x of [half, -half + 0.016])
          mesh(body, wall.clone(), deck, 'box-side').position.x = x;
        box(
          body,
          [half * 2, 0.018, box0.front[0] - box0.rear[0]],
          [0, box0.floor + 0.009, (box0.front[0] + box0.rear[0]) / 2],
          deck,
          'box-floor',
        );
        // The box stands on two cross brackets above the low beam.
        for (const z of [-0.12, 0.32]) {
          box(body, [half * 1.6, 0.02, 0.03], [0, box0.floor - 0.01, z], dark);
          box(body, [0.03, box0.floor - 0.16, 0.03], [0, (box0.floor + 0.16) / 2, z], dark);
        }
        for (const [bottom, top] of [
          [box0.rear[0], box0.rear[1]],
          [box0.front[0], box0.front[1]],
        ]) {
          const length = Math.hypot(top - bottom, box0.top - box0.floor);
          const panel = box(
            body,
            [half * 2, length, 0.016],
            [0, (box0.top + box0.floor) / 2, (top + bottom) / 2],
            deck,
            'box-end',
          );
          panel.rotation.x = Math.atan2(top - bottom, box0.top - box0.floor);
        }
        // Child bench across the rear of the box, a padded backrest against the rear wall.
        box(
          body,
          [half * 2 - 0.04, 0.03, 0.2],
          [0, box0.floor + 0.24, box0.rear[0] + 0.12],
          deck,
          'box-bench',
        );
        for (const x of [-0.12, 0.12])
          box(body, [0.03, 0.24, 0.03], [x, box0.floor + 0.12, box0.rear[0] + 0.2], deck);
        box(
          body,
          [half * 2 - 0.08, 0.2, 0.03],
          [0, box0.floor + 0.37, box0.rear[0] + 0.035],
          dark,
          'box-backrest',
        );
        // Edge trim: the rim all round and the four corner posts.
        tube(
          body,
          [
            [-half, box0.top + 0.006, box0.rear[1]],
            [-half, box0.top + 0.006, box0.front[1]],
            [half, box0.top + 0.006, box0.front[1]],
            [half, box0.top + 0.006, box0.rear[1]],
            [-half, box0.top + 0.006, box0.rear[1]],
          ],
          0.009,
          dark,
          6,
        );
        for (const x of [-half, half])
          for (const [bottom, top] of [box0.rear, box0.front])
            tube(
              body,
              [
                [x, box0.floor, bottom],
                [x, box0.top, top],
              ],
              0.008,
              dark,
              6,
            );
        // Two-legged stand folded under the box, its feet joined by a bar; lamp on the box nose.
        for (const x of [-0.16, 0.16])
          tube(
            body,
            [
              [0, 0.14, 0.02],
              [x, 0.08, 0.2],
            ],
            0.013,
            dark,
            6,
          );
        tube(
          body,
          [
            [-0.17, 0.078, 0.205],
            [0.17, 0.078, 0.205],
          ],
          0.012,
          dark,
          6,
        );
        lamp(body, [0, box0.top - 0.07, box0.front[1] + 0.03], 0.046, 0.06, dark);
      } else if (kind === 'road-bicycle') {
        const post = G.seatAt(G.saddle[1] - 0.13);
        box(body, [0.025, 0.036, 0.016], [0, post[1], post[2] - 0.022], red, 'tail-lamp');
      }
    } else {
      // ---- Motorcycles and the scooter ----
      const { R, F } = G;
      const legs = (y) => [0, y, F[2] - (y - F[1]) / Math.tan(G.ha)];
      if (kind === 'motor-scooter') {
        // Step-through monocoque: leg shield, flat floor, bulging rear cowls carrying the seat.
        const rows = [
          [0.22, 0.6, 0.34, 0.2],
          [0.42, 0.66, 0.33, 0.225],
          [0.62, 0.65, 0.335, 0.23],
          [0.78, 0.58, 0.355, 0.185],
          [0.88, 0.5, 0.375, 0.13],
          [0.93, 0.45, 0.385, 0.1],
        ];
        const shieldRings = rows.map(([y, front, back, hw]) => {
          const n = 7;
          const outer = Array.from({ length: n }, (_, i) => {
            const x = -hw + (2 * hw * i) / (n - 1);
            return [
              x,
              y,
              back + 0.03 + (front - back - 0.03) * Math.sqrt(Math.max(0, 1 - (x / hw) * (x / hw))),
            ];
          });
          const inner = outer.map(([x, , z]) => [x * 0.97, y, Math.max(back, z - 0.035)]).reverse();
          return [...outer, ...inner];
        });
        ringLoft(body, shieldRings, paint, 'leg-shield');
        // The "tie": a raised spine down the shield's face ending in the horn grille.
        const face = (y) => {
          const k = rows.findIndex((r) => r[0] >= y);
          const [y0, z0] = rows[Math.max(0, k - 1)],
            [y1, z1] = rows[k];
          return z0 + ((z1 - z0) * (y - y0)) / (y1 - y0 || 1);
        };
        tube(
          body,
          [0.5, 0.6, 0.7, 0.8, 0.86].map((y) => [0, y, face(y) + 0.004]),
          0.02,
          paint,
          8,
        );
        box(body, [0.05, 0.1, 0.03], [0, 0.56, face(0.56) + 0.008], dark, 'horn-cover');
        for (let i = 0; i < 3; i++)
          box(body, [0.044, 0.008, 0.012], [0, 0.53 + i * 0.03, face(0.53) + 0.024], metal);
        const floorTop = G.floor;
        // Floorboard: five rubber runners along it, polished edge strips and grooved sides.
        // Its lower edge sweeps up at the back into the rear body's lower edge.
        loft(
          body,
          [
            [0.36, 0.2, floorTop - 0.1, floorTop],
            [-0.17, 0.2, floorTop - 0.1, floorTop],
            [-0.25, 0.2, floorTop - 0.075, floorTop],
            [-0.31, 0.2, floorTop - 0.035, floorTop],
            [-0.35, 0.2, floorTop + 0.02, floorTop + 0.03],
          ],
          paint,
          'floorboard',
        );
        for (let i = -2; i <= 2; i++)
          box(body, [0.018, 0.008, 0.42], [i * 0.06, floorTop + 0.003, 0.12], dark);
        for (const side of [-1, 1]) {
          tube(
            body,
            [
              [side * 0.198, floorTop - 0.002, -0.1],
              [side * 0.198, floorTop - 0.002, 0.34],
            ],
            0.007,
            metal,
            6,
          );
          for (let i = 0; i < 3; i++)
            box(
              body,
              [0.004, 0.008, 0.4 - i * 0.04],
              [side * 0.2, floorTop - 0.035 - i * 0.022, 0.1 + i * 0.02],
              dark,
            );
        }
        // The rear body sweeps up from the back of the floor in a concave curve (a Vespa's
        // tunnel face), bulges out over the engine with its lower edge near hub height (the rear
        // wheel rises into it), then tapers in plan and profile to a narrow tail.
        shell(
          body,
          [
            [-0.035, 0.12, 0.62, 0.7],
            [-0.06, 0.16, 0.5, 0.712],
            [-0.075, 0.18, 0.4, 0.716],
            [-0.1, 0.2, 0.32, 0.72],
            [-0.15, 0.225, 0.275, 0.723],
            [-0.22, 0.24, floorTop - 0.01, 0.724],
            [-0.3, 0.25, floorTop - 0.01, 0.725],
            [-0.36, 0.265, 0.31, 0.725],
            [-0.44, 0.275, 0.36, 0.725],
            [-0.56, 0.28, 0.38, 0.722],
            [-0.68, 0.272, 0.4, 0.716],
            [-0.77, 0.25, 0.43, 0.708],
            [-0.84, 0.21, 0.47, 0.698],
            [-0.885, 0.16, 0.51, 0.684],
            [-0.912, 0.105, 0.545, 0.665],
            [-0.928, 0.05, 0.57, 0.645],
          ],
          paint,
          'engine-cowl',
          { e: 2.4, top: 0.2, bottom: 0.1 },
        );
        // Cooling slots low on the front of each cowl.
        for (const side of [-1, 1])
          for (let i = 0; i < 3; i++)
            box(
              body,
              [0.006, 0.011, 0.07 - i * 0.012],
              [side * (0.243 + i * 0.003), 0.44 + i * 0.025, -0.42],
              dark,
            );
        // Dual seat: a rounded nose, the rider's dip, a step up to the crowned pillion.
        shell(
          body,
          [
            [0.07, 0.06, 0.725, 0.77],
            [0.035, 0.12, 0.71, 0.8],
            [-0.04, 0.16, 0.705, 0.812],
            [-0.3, 0.168, 0.705, 0.81],
            [-0.42, 0.168, 0.708, 0.83],
            [-0.5, 0.166, 0.71, 0.846],
            [-0.7, 0.155, 0.712, 0.852],
            [-0.79, 0.125, 0.712, 0.836],
            [-0.83, 0.07, 0.715, 0.8],
          ],
          dark,
          'saddle',
          { e: 2.8, top: 0.2, bottom: 0.3 },
        );
        // Front: trailing link and shock on the left, deep mudguard turning with the wheel.
        const tubeLow = at(0.42);
        tube(fork, [at(0.88), tubeLow], 0.028, dark, 10);
        tube(
          fork,
          [
            [0.07, tubeLow[1] - 0.02, tubeLow[2] + 0.01],
            [0.075, F[1], F[2]],
          ],
          0.022,
          dark,
          8,
        );
        tube(
          fork,
          [
            [0.07, tubeLow[1] + 0.12, tubeLow[2] - 0.05],
            [0.08, F[1] + 0.06, F[2] + 0.04],
          ],
          0.018,
          metal,
          8,
        );
        fender(fork, F, G.rf + 0.035, -40, 72, 0.085, 0.07, paint, 'front-fender', 12);
        cylinderX(fork, [0.06, F[1], F[2]], 0.1, 0.006, metal, 20);
        box(fork, [0.03, 0.06, 0.05], [0.07, F[1] + 0.06, F[2] - 0.07], dark);
        // Handlebar cover enclosing the bars, the headlamp in its nose; only the grips leave
        // its sides.
        shell(
          bars,
          [
            [0.2, 0.08, 0.93, 1.0],
            [0.235, 0.19, 0.9, 1.04],
            [0.29, 0.22, 0.885, 1.055],
            [0.36, 0.2, 0.88, 1.068],
            [0.43, 0.155, 0.885, 1.068],
            [0.49, 0.115, 0.9, 1.055],
            [0.52, 0.08, 0.92, 1.04],
          ],
          paint,
          'handlebar-cowl',
          { e: 2.6, top: 0.2, bottom: 0.1 },
        );
        // Steering-column shroud: the cover sits down on the leg shield, no bare neck.
        tube(bars, [at(0.8), at(0.93)], 0.06, paint, 12);
        lamp(bars, [0, 0.99, 0.525], 0.062, 0.05, metal);
        const [gx, gy, gz] = G.grips[0];
        for (const side of [-1, 1]) {
          tube(
            bars,
            [
              [side * 0.1, gy, gz + 0.09],
              [side * (gx + 0.06), gy, gz - 0.015],
            ],
            0.012,
            metal,
            8,
          );
          tube(
            bars,
            [
              [side * (gx - 0.05), gy, gz + 0.015],
              [side * (gx + 0.06), gy, gz - 0.015],
            ],
            0.018,
            dark,
            10,
          );
        }
        // Rear: CVT case and swingarm on the left, silencer on the right, shock, rail, lamp.
        shell(
          body,
          [
            [-0.24, 0.035, 0.2, 0.32, 0.1],
            [-0.4, 0.05, 0.16, 0.36, 0.11],
            [-0.62, 0.05, 0.14, 0.34, 0.11],
            [-0.74, 0.04, 0.16, 0.3, 0.1],
          ],
          metal,
          'engine-unit',
          { e: 2.6 },
        );
        shell(
          body,
          [
            [-0.3, 0.07, 0.17, 0.33, -0.08],
            [-0.45, 0.08, 0.16, 0.34, -0.09],
          ],
          dark,
        );
        tube(
          body,
          [
            [-0.1, 0.26, -0.36],
            [-0.17, 0.25, -0.5],
            [-0.18, 0.3, -0.62],
          ],
          0.025,
          dark,
          8,
        );
        // Compact silencer tucked under the right cowl.
        shell(
          body,
          [
            [-0.62, 0.042, 0.265, 0.355, -0.17],
            [-0.68, 0.048, 0.26, 0.36, -0.175],
            [-0.81, 0.045, 0.27, 0.355, -0.17],
            [-0.84, 0.03, 0.285, 0.34, -0.165],
          ],
          metal,
          'silencer',
          { e: 2.2 },
        );
        tube(
          body,
          [
            [-0.165, 0.305, -0.84],
            [-0.165, 0.305, -0.875],
          ],
          0.013,
          dark,
          8,
        );
        tube(
          body,
          [
            [-0.12, 0.3, -0.62],
            [-0.12, 0.56, -0.5],
          ],
          0.022,
          dark,
          8,
        );
        // Polished rack round the back of the seat, rising behind it on two posts; tail lamp
        // on the point of the tail above the plate.
        tube(
          body,
          [
            [0.16, 0.73, -0.56],
            [0.162, 0.75, -0.76],
            [0.1, 0.775, -0.86],
            [-0.1, 0.775, -0.86],
            [-0.162, 0.75, -0.76],
            [-0.16, 0.73, -0.56],
          ],
          0.01,
          metal,
          6,
        );
        for (const x of [-0.15, 0.15])
          tube(
            body,
            [
              [x, 0.755, -0.78],
              [x * 0.85, 0.69, -0.8],
            ],
            0.008,
            metal,
            6,
          );
        barrel(
          body,
          [0, 0.622, -0.905],
          [0, -0.2, -0.98],
          [
            [0, 1],
            [0.03, 1],
            [0.045, 0.75],
          ],
          [0.065, 0.032],
          red,
          { n: 12, e: 2.4 },
        );
        box(body, [0.17, 0.115, 0.008], [0, 0.49, -0.945], dark, 'plate');
        tube(
          body,
          [
            [0, 0.585, -0.915],
            [0, 0.545, -0.94],
          ],
          0.012,
          dark,
          6,
        );
        // Centre stand folded under the floor: two legs and a foot bar.
        for (const x of [-0.12, 0.12])
          tube(
            body,
            [
              [x, 0.18, -0.26],
              [x * 1.1, 0.14, -0.5],
            ],
            0.015,
            dark,
            6,
          );
        tube(
          body,
          [
            [-0.14, 0.14, -0.5],
            [0.14, 0.14, -0.5],
          ],
          0.013,
          dark,
          6,
        );
      } else {
        const cruiser = kind === 'cruiser-motorcycle';
        const top = at(G.headTop - 0.015),
          bottom = at(G.headBottom + 0.015);
        // Frame: steering head, backbone under the tank, cradle round the engine, seat rails.
        tube(body, [bottom, top], 0.032, dark, 12);
        const pivot = G.swingarm;
        const cradle = G.cradle;
        tube(body, [at(G.headTop - 0.05), ...G.backbone], 0.022, dark, 8);
        for (const side of [-1, 1]) {
          tube(
            body,
            [
              [side * 0.03, ...at(G.headBottom + 0.04).slice(1)],
              ...cradle.map(([y, z]) => [side * 0.075, y, z]),
              [side * 0.08, pivot[1] + 0.05, pivot[2]],
              [side * 0.08, G.backbone.at(-2)[1] - 0.02, G.backbone.at(-2)[2]],
            ],
            0.017,
            dark,
            8,
          );
          tube(
            body,
            [
              [side * 0.08, G.backbone.at(-2)[1], G.backbone.at(-2)[2]],
              [side * 0.1, G.seatRail[0], G.seatRail[1]],
            ],
            0.015,
            dark,
            8,
          );
          tube(
            body,
            [
              [side * 0.08, pivot[1] + 0.06, pivot[2] - 0.02],
              [side * 0.1, G.seatRail[0] + 0.02, G.shockTop[1] - 0.04],
            ],
            0.013,
            dark,
            8,
          );
          // Swingarm to the rear axle and twin shocks.
          tube(
            body,
            [
              [side * 0.11, pivot[1], pivot[2]],
              [side * 0.12, R[1], R[2] + 0.06],
              [side * 0.12, R[1], R[2] - 0.02],
            ],
            0.022,
            dark,
            8,
          );
          if (cruiser) {
            // Softail look: hidden shocks, a triangulated swingarm reading as a hardtail frame.
            tube(
              body,
              [
                [side * 0.12, R[1] + 0.01, R[2] + 0.02],
                [side * 0.11, 0.56, -0.5],
                [side * 0.09, G.backbone.at(-1)[1] - 0.04, G.backbone.at(-1)[2] - 0.06],
              ],
              0.02,
              dark,
              8,
            );
          } else {
            const shockLow = [side * 0.135, R[1] + 0.04, R[2] + 0.09];
            const shockTop = [side * 0.13, G.shockTop[0], G.shockTop[1]];
            tube(body, [shockLow, shockTop], 0.014, metal, 8);
            const [lx, ly, lz] = shockLow;
            for (let i = 0; i < 6; i++) {
              const t = 0.2 + i * 0.11;
              const c = [
                lx + (shockTop[0] - lx) * t,
                ly + (shockTop[1] - ly) * t,
                lz + (shockTop[2] - lz) * t,
              ];
              const coil = mesh(body, new T.TorusGeometry(0.03, 0.006, 3, 10), paint);
              coil.position.set(...c);
              coil.quaternion.setFromUnitVectors(
                new T.Vector3(0, 0, 1),
                new T.Vector3(...shockTop).sub(new T.Vector3(...shockLow)).normalize(),
              );
            }
          }
          // Footpeg on a hanger plate; the brake pedal (right) and gear lever (left) ahead of it.
          const [px, py, pz] = G.peg;
          tube(
            body,
            [
              [side * 0.11, py, pz],
              [side * (px + 0.06), py, pz],
            ],
            0.017,
            dark,
            8,
          );
          box(body, [0.012, 0.11, 0.08], [side * 0.11, py + 0.04, pz + 0.02], metal);
          tube(
            body,
            [
              [side * (px - 0.02), py + 0.02, pz + 0.02],
              [side * (px - 0.03), py + 0.05, pz + 0.17],
              [side * (px - 0.03), py + 0.055, pz + 0.2],
            ],
            0.008,
            metal,
            6,
          );
          if (cruiser) {
            // Footboard: a rubber-topped board on a polished pan at the forward pegs.
            const xc = side * (px + 0.035);
            shell(
              body,
              [
                [pz - 0.13, 0.035, py - 0.012, py + 0.012, xc],
                [pz - 0.11, 0.06, py - 0.016, py + 0.016, xc],
                [pz + 0.1, 0.06, py - 0.016, py + 0.016, xc],
                [pz + 0.13, 0.035, py - 0.012, py + 0.012, xc],
              ],
              dark,
              'footboard',
              { e: 4 },
            );
            shell(
              body,
              [
                [pz - 0.135, 0.04, py - 0.03, py - 0.01, xc],
                [pz - 0.115, 0.066, py - 0.032, py - 0.01, xc],
                [pz + 0.105, 0.066, py - 0.032, py - 0.01, xc],
                [pz + 0.135, 0.04, py - 0.03, py - 0.01, xc],
              ],
              metal,
              'footboard-pan',
              { e: 4, bottom: 0.3 },
            );
          }
        }
        // Engine: crankcase, domed side covers, finned barrels and heads.
        const E = G.engine;
        shell(body, E.crankcase, E.polished ? metal : dark, 'engine-crankcase', { e: 3, n: 16 });
        for (const [x, z, y, radius, stretch = 1] of E.covers) {
          // A cast cover stepping out to a polished dome; a stretched one is a primary case.
          const s = Math.sign(x);
          const parts = [
            cylinderX(body, [x, y, z], radius, 0.04, metal, 20),
            cylinderX(
              body,
              [x + s * 0.026, y, z],
              radius * (s > 0 ? 0.94 : 0.62),
              0.014,
              metal,
              20,
              radius * (s > 0 ? 0.62 : 0.94),
            ),
          ];
          for (const o of parts) o.scale.z = stretch;
        }
        for (const [base, dir, len, width] of E.cylinders) {
          const d = new T.Vector3(0, dir[0], dir[1]).normalize().toArray();
          const at0 = [0, base[0], base[1]];
          const half = [width / 2, (E.finDepth ?? 0.15) / 2];
          const head = len + 0.075;
          // Dark barrel and head core; polished fins stand proud of it, the head's a little
          // deeper; the rocker box caps the head.
          barrel(
            body,
            at0,
            d,
            [
              [0, (E.finCore ?? 0.7) + 0.04],
              [head, (E.finCore ?? 0.7) + 0.04],
            ],
            half,
            dark,
            { n: 10, e: 3.2 },
          );
          barrel(
            body,
            at0,
            d,
            [
              ...fins(0.012, len, E.fins ?? 7, E.finCore ?? 0.7, 0.009),
              ...fins(len + 0.01, head, 2, E.finCore ?? 0.7, 0.012, 0.06),
            ],
            half,
            metal,
            { n: 10, e: 3.2 },
          );
          barrel(
            body,
            at0,
            d,
            [
              [head - 0.004, 0.86],
              [head, 0.98],
              [head + 0.028, 0.98],
              [head + 0.046, 0.86],
              [head + 0.052, 0.55],
            ],
            [half[0] * 0.96, half[1] * 0.9],
            metal,
            { n: 12, e: 2.6 },
          );
        }
        if (E.airbox) {
          const [x, y, z, radius, depth, stretch] = E.airbox;
          const s = Math.sign(x);
          const cover = [
            cylinderX(body, [x, y, z], radius, depth, metal, 20),
            cylinderX(
              body,
              [x + (s * depth) / 2, y, z],
              radius * (s > 0 ? 0.9 : 0.55),
              depth * 0.5,
              metal,
              20,
              radius * (s > 0 ? 0.55 : 0.9),
            ),
          ];
          for (const o of cover) o.scale.z = stretch;
        }
        // Exhaust headers and silencers.
        for (const { path, silencer, radius } of G.exhaust) {
          tube(body, path, radius, metal, 8);
          const [x, y, z] = silencer.at(-1);
          if (cruiser) {
            tube(body, silencer, radius * 1.45, metal, 12);
            cylinderZ(body, [x, y, z - 0.004], radius * 0.95, 0.012, dark, 12);
          } else {
            // Peashooter: the header flares into a long silencer ending in a short tail pipe.
            const from = new T.Vector3(...silencer[0]);
            const span = new T.Vector3(x, y, z).sub(from);
            const len = span.length();
            barrel(
              body,
              silencer[0],
              span.normalize().toArray(),
              [
                [0, 1],
                [0.08, 1],
                [0.22, 1.8],
                [len - 0.06, 1.8],
                [len - 0.035, 1.5],
                [len - 0.035, 0.85],
                [len, 0.85],
              ],
              [radius, radius],
              metal,
              { n: 12, e: 2 },
            );
            cylinderZ(body, [x, y, z - 0.002], radius * 0.6, 0.006, dark, 10);
          }
        }
        // Tank, seat and side covers.
        shell(body, G.tankShape, paint, 'fuel-tank', { e: 2.3, top: 0.38, bottom: 0.22 });
        for (const seat of G.seatShape) shell(body, seat, dark, 'saddle', { e: 2.8, bottom: 0.2 });
        shell(body, G.sideCover, paint, 'side-cover', { e: 2.6 });
        if (!cruiser) {
          // Rubber knee pads on the tank flanks; throttle bodies behind the head; a polished
          // grab rail round the back of the bench.
          for (const side of [-1, 1]) {
            const pad = mesh(body, new T.SphereGeometry(1, 12, 6), dark);
            pad.scale.set(0.02, 0.04, 0.055);
            pad.position.set(side * 0.124, 0.825, -0.075);
            cylinderZ(body, [side * 0.1, 0.665, -0.035], 0.032, 0.075, metal, 12);
            cylinderZ(body, [side * 0.1, 0.665, 0.012], 0.022, 0.03, dark, 10);
          }
          tube(
            body,
            [
              [0.15, 0.73, -0.6],
              [0.156, 0.75, -0.85],
              [0.12, 0.775, -0.99],
              [0, 0.785, -1.015],
              [-0.12, 0.775, -0.99],
              [-0.156, 0.75, -0.85],
              [-0.15, 0.73, -0.6],
            ],
            0.011,
            metal,
            8,
          );
        }
        // Fenders: the front one steers with the fork.
        fender(
          fork,
          F,
          G.rf + G.fenders.front[0],
          G.fenders.front[1],
          G.fenders.front[2],
          G.fenders.front[3],
          G.fenders.front[4],
          paint,
          'front-fender',
        );
        fender(
          body,
          R,
          G.rr + G.fenders.rear[0],
          G.fenders.rear[1],
          G.fenders.rear[2],
          G.fenders.rear[3],
          G.fenders.rear[4],
          paint,
          'rear-fender',
        );
        // Telescopic fork: sliders to the axle, stanchions to the bottom yoke, disc and caliper.
        const legAxis = [0, Math.sin(G.ha), -Math.cos(G.ha)];
        for (const side of [-1, 1]) {
          const x = side * G.forkWidth;
          // Slider: a cast lower leg with the axle boss, stepping in at its seal.
          barrel(
            fork,
            [x, F[1] - 0.05, legs(F[1] - 0.05)[2]],
            legAxis,
            [
              [0, 0.7],
              [0.012, 1.12],
              [0.09, 1.12],
              [0.13, 1],
              [0.33, cruiser ? 1.02 : 0.96],
              [0.34, 0.8],
              [0.355, 0.8],
            ],
            [0.034, 0.034],
            metal,
            { n: 12, e: 2 },
          );
          tube(
            fork,
            [
              [x, F[1] + 0.28, legs(F[1] + 0.28)[2]],
              [x, G.headBottom, legs(G.headBottom)[2]],
            ],
            0.025,
            metal,
            12,
          );
          // A cruiser hides its upper fork in broad covers from the slider to the top yoke.
          if (cruiser)
            for (const [g, from, to] of [
              [fork, F[1] + 0.4, G.headBottom],
              [bars, G.headBottom, G.headTop + 0.03],
            ])
              tube(
                g,
                [
                  [x, from, legs(from)[2]],
                  [x, to, legs(to)[2]],
                ],
                0.05,
                metal,
                14,
              );
          if (!cruiser)
            tube(
              fork,
              [
                [x, F[1] + 0.32, legs(F[1] + 0.32)[2]],
                [x, F[1] + 0.47, legs(F[1] + 0.47)[2]],
              ],
              0.031,
              dark,
              10,
            );
          tube(
            bars,
            [
              [x, G.headBottom - 0.02, legs(G.headBottom - 0.02)[2]],
              [x, G.headTop + 0.03, legs(G.headTop + 0.03)[2]],
            ],
            0.025,
            metal,
            12,
          );
          // Fender stay from the axle up to the inside of the fender's skirt.
          const a = (32 * Math.PI) / 180;
          const [lift, , , half, skirt] = G.fenders.front;
          tube(
            fork,
            [
              [side * 0.055, F[1] + G.rf * 0.86 * Math.cos(a) * 0.4, F[2] + 0.02],
              [side * half * 0.92, F[1] + G.rf + lift - skirt - 0.005, F[2] + 0.02],
            ],
            0.006,
            metal,
            5,
          );
        }
        // Handlebar on risers above the top yoke.
        const [gx, gy, gz] = G.grips[0];
        const clampAt = [0, G.headTop + 0.07, G.pivot[2] + 0.01];
        for (const side of [-1, 1])
          tube(
            bars,
            [
              [side * 0.04, G.headTop, clampAt[2]],
              [side * 0.04, clampAt[1], clampAt[2]],
            ],
            0.014,
            metal,
            8,
          );
        // A cruiser's pullback bar rises well above the clamp before sweeping back and down to
        // the grips; a standard's is a gentle bend.
        const bend = (side) =>
          cruiser
            ? new T.CatmullRomCurve3(
                [
                  [0.12, clampAt[1] + 0.005, clampAt[2]],
                  [0.21, gy + 0.05, clampAt[2] - 0.05],
                  [0.29, gy + 0.075, (clampAt[2] + gz) / 2],
                  [gx - 0.07, gy + 0.03, gz + 0.06],
                  [gx - 0.03, gy, gz + 0.02],
                  [gx + 0.07, gy, gz - 0.015],
                ].map(([x, y, z]) => new T.Vector3(side * x, y, z)),
                false,
                'centripetal',
              )
                .getPoints(12)
                .map((v) => v.toArray())
            : [
                [side * 0.12, clampAt[1] + 0.005, clampAt[2]],
                [side * (gx - 0.12), gy - 0.01, (clampAt[2] + gz) / 2 + 0.03],
                [side * (gx - 0.06), gy, gz + 0.03],
                [side * (gx + 0.07), gy, gz - 0.015],
              ];
        tube(
          bars,
          [...bend(-1).reverse(), [0, clampAt[1], clampAt[2]], ...bend(1)],
          0.012,
          metal,
          8,
        );
        for (const side of [-1, 1])
          tube(
            bars,
            [
              [side * (gx - 0.06), gy, gz + 0.02],
              [side * (gx + 0.07), gy, gz - 0.015],
            ],
            0.018,
            dark,
            10,
          );
        box(
          fork,
          [G.forkWidth * 2 + 0.07, 0.05, 0.09],
          [0, G.headBottom, (legs(G.headBottom)[2] + at(G.headBottom)[2]) / 2],
          metal,
          'bottom-yoke',
        );
        box(
          bars,
          [G.forkWidth * 2 + 0.07, 0.035, 0.09],
          [0, G.headTop, (legs(G.headTop)[2] + at(G.headTop)[2]) / 2],
          metal,
          'top-yoke',
        );
        if (cruiser) {
          // Headlamp nacelle: a polished shroud joining the fork covers between the yokes.
          const y0 = G.headBottom - 0.03;
          barrel(
            bars,
            [0, y0, (legs(y0)[2] + at(y0)[2]) / 2 + 0.01],
            legAxis,
            [
              [0, 0.8],
              [0.03, 1],
              [(G.headTop - y0) / Math.sin(G.ha) - 0.01, 1],
              [(G.headTop - y0) / Math.sin(G.ha) + 0.02, 0.85],
            ],
            [G.forkWidth + 0.05, 0.065],
            metal,
            { n: 14, e: 2.6 },
          );
        }
        cylinderX(
          frontWheel.getObjectByName('wheel-front-spin'),
          [0.075, 0, 0],
          0.14,
          0.006,
          metal,
          24,
        );
        box(fork, [0.03, 0.09, 0.07], [0.075, F[1] + 0.1, F[2] - 0.08], dark, 'brake-caliper');
        cylinderX(
          rearWheel.getObjectByName('wheel-rear-spin'),
          [-0.085, 0, 0],
          0.11,
          0.006,
          metal,
          20,
        );
        // Chain on the left.
        const sprocket = [0.13, G.swingarm[1] - 0.02, G.swingarm[2] + 0.08];
        ringX(body, [0.13, R[1], R[2]], 0.1, 0.005, metal, 24);
        ringX(body, sprocket, 0.04, 0.005, metal, 12);
        for (const dir of [1, -1])
          tube(
            body,
            [
              [0.13, sprocket[1] + dir * 0.04, sprocket[2]],
              [0.13, R[1] + dir * 0.1, R[2]],
            ],
            0.006,
            dark,
            4,
          );
        // Headlamp in a chrome shell on the fork ears; indicators, tail lamp and plate.
        const [lx, ly, lz] = G.headlamp;
        lamp(bars, [lx, ly, lz], G.lampRadius, G.lampRadius * 1.5, metal);
        for (const side of [-1, 1])
          rod(
            bars,
            [side * G.forkWidth, ly + 0.02, legs(ly + 0.02)[2]],
            [side * G.lampRadius * 0.85, ly, lz - G.lampRadius * 0.9],
            0.01,
            metal,
            6,
          );
        // Tail lamp: a lens in a polished housing on the fender, the plate below it.
        const [tz, ty] = G.tail;
        const lens = cruiser ? [0.075, 0.04] : [0.06, 0.032];
        barrel(
          body,
          [0, ty, tz + 0.045],
          [0, 0, -1],
          [
            [0, 0.8],
            [0.012, 1.08],
            [0.03, 1.08],
          ],
          lens,
          metal,
          { n: 12, e: 2.6 },
        );
        barrel(
          body,
          [0, ty, tz + 0.015],
          [0, 0, -1],
          [
            [0, 1],
            [0.018, 1],
            [0.03, 0.78],
          ],
          lens,
          red,
          { n: 12, e: 2.6 },
        );
        box(body, [0.18, 0.12, 0.008], [0, ty - 0.1, tz + 0.02], dark, 'plate');
        if (cruiser) {
          // Leather saddlebags hung either side of the rear wheel: a rounded body under an
          // overhanging lid, closed by two strap buckles.
          for (const side of [-1, 1]) {
            shell(
              body,
              G.bags.map(([z, w, b, t]) => [z, w, b, t, side * 0.33]),
              dark,
              'pannier',
              { e: 2.2, bottom: 0.25 },
            );
            shell(
              body,
              G.bagLid.map(([z, w, b, t]) => [z, w, b, t, side * 0.33]),
              dark,
              'pannier-lid',
              { e: 3, top: 0.3 },
            );
            for (const z of [-0.6, -0.86]) {
              box(body, [0.008, 0.11, 0.03], [side * 0.428, 0.66, z], dark);
              box(body, [0.012, 0.035, 0.034], [side * 0.432, 0.655, z], metal);
            }
            // Engine guard: a polished hoop round the front of the engine.
            tube(
              body,
              [
                [side * 0.075, 0.62, 0.44],
                [side * 0.19, 0.57, 0.47],
                [side * 0.255, 0.45, 0.46],
                [side * 0.24, 0.32, 0.4],
                [side * 0.09, 0.24, 0.31],
              ],
              0.015,
              metal,
              8,
            );
          }
        }
        // Side stand folded under the left footpeg.
        tube(
          body,
          [
            [0.12, 0.22, G.peg[2] + 0.12],
            [0.15, 0.18, G.peg[2] - 0.22],
          ],
          0.012,
          dark,
          6,
        );
      }
    }
  } else {
    const big = L > 50;
    const ferry = s.shape.includes('ferry');
    const deckY = s.freeboard;
    const draft = s.draft;
    // Tinted marine glazing reads as windows from outside, not an open frame.
    glass.opacity = 0.42;
    // Hull form per type. transom: stern width / beam; entry: where the bow starts to narrow
    // (fraction of length from the stern); fullness: plan exponent of the bow (higher is fuller);
    // rake: how far the stem leans forward of the forefoot (fraction of length); chine: a planing
    // hull's spray strake [height at the stern m, rise toward the bow m, width m] with flared
    // topsides and a white bottom moulding below it; cap: depth of the white deck moulding band
    // (m); flare: topside widening above the waterline at the bow (flareMid: the fraction of it
    // kept amidships, default 0.3; 0 leaves a ship wall-sided); deadrise: bottom V angle (rad);
    // bilge: depth of the bilge turn (fraction of draft); bowRise/sternRise: sheer above the bulwark (m); bulwark:
    // solid rail above the deck (m); canoe: hull-body draft when a fin keel carries the rest
    // (fraction of draft); forefoot: how far the keel rises at the stem (fraction of draft);
    // bulb: bulbous bow [radius / draft, half-length / length], the stem then raked above the
    // waterline only; run: stern fraction over which the bottom sweeps up to a transom whose
    // underside sits transomY m above the waterline (negative: immersed), the keel holding on as
    // a skeg ahead of the propeller; forecastle: [break as a fraction from the stern, raised deck
    // height m]; stemCurve: below 1 rounds the stem; stations: hull station count (default from
    // length); deckColor: deck paint.
    const HULLS = {
      'bulk-carrier': {
        transom: 0.78,
        entry: 0.8,
        fullness: 2.3,
        rake: 0.04,
        stemCurve: 0.6,
        flare: 0.2,
        flareMid: 0,
        deadrise: 0,
        bilge: 0.9,
        bowRise: 0.5,
        sternRise: 0.8,
        bulwark: 1.2,
        forefoot: 0.03,
        bulb: [0.34, 0.045],
        run: 0.16,
        transomY: 0.9,
        forecastle: [0.925, 2.6],
        deckColor: '#8a3f32',
      },
      'container-ship': {
        transom: 0.82,
        entry: 0.68,
        fullness: 2,
        rake: 0.04,
        stemCurve: 0.6,
        flare: 0.3,
        flareMid: 0,
        deadrise: 0.02,
        bilge: 0.85,
        bowRise: 1.2,
        sternRise: 0.6,
        bulwark: 1.2,
        forefoot: 0.03,
        bulb: [0.32, 0.05],
        run: 0.22,
        transomY: 1.3,
        forecastle: [0.915, 3.6],
        deckColor: '#6f7d74',
      },
      'car-ferry': {
        transom: 0.6,
        entry: 0.86,
        fullness: 3.2,
        rake: 0.03,
        flare: 0.14,
        deadrise: 0.06,
        bilge: 0.7,
        bowRise: 0.2,
        sternRise: 0,
        bulwark: 0.4,
        doubleEnded: true,
        deckColor: '#7b8084',
      },
      'passenger-ferry': {
        transom: 0.6,
        entry: 0.66,
        fullness: 1.9,
        rake: 0.08,
        flare: 0.08,
        deadrise: 0.14,
        bilge: 0.6,
        bowRise: 0.8,
        sternRise: 0.2,
        bulwark: 0.5,
        run: 0.18,
        transomY: -0.35,
        deckColor: '#8a8f90',
      },
      'fishing-boat': {
        transom: 0.72,
        entry: 0.58,
        fullness: 1.7,
        rake: 0.1,
        flare: 0.24,
        deadrise: 0.26,
        bilge: 0.45,
        bowRise: 0.75,
        sternRise: 0.15,
        bulwark: 0.5,
        run: 0.2,
        transomY: -0.45,
        deckColor: '#8e9497',
      },
      tugboat: {
        transom: 0.8,
        entry: 0.6,
        fullness: 1.8,
        rake: 0.07,
        flare: 0.2,
        deadrise: 0.16,
        bilge: 0.55,
        bowRise: 0.45,
        sternRise: 0,
        bulwark: 0.4,
        run: 0.3,
        transomY: 0.1,
        forecastle: [0.58, 0.6],
        deckColor: '#81878a',
      },
      speedboat: {
        transom: 0.84,
        entry: 0.5,
        fullness: 1.55,
        rake: 0.2,
        stemCurve: 0.95,
        stations: 26,
        flare: 0.3,
        deadrise: 0.38,
        bilge: 0.12,
        bowRise: 0.15,
        sternRise: 0,
        bulwark: 0.51,
        chine: [0.12, 0.32, 0.035],
        cap: 0.27,
        deckColor: '#ae8963',
      },
      sailboat: {
        transom: 0.77,
        entry: 0.52,
        fullness: 1.6,
        rake: 0.015,
        flare: 0.05,
        deadrise: 0.25,
        bilge: 0.45,
        bowRise: 0.2,
        sternRise: 0,
        bulwark: 0.5,
        canoe: 0.35,
        run: 0.35,
        transomY: 0.05,
        deckColor: '#ae8963',
      },
    };
    const P = HULLS[s.shape];
    // Flat quads [a, b, c, d] or triangles [a, b, c] (counter-clockwise seen from outside) as one
    // surface; twoSided adds the reverse faces for walls that are also seen from inside.
    const quads = (list, m, name, twoSided = false) => {
      const positions = [];
      for (const [a, b, c, d] of list) {
        positions.push(...a, ...b, ...c);
        if (d) positions.push(...a, ...c, ...d);
        if (twoSided) positions.push(...a, ...c, ...b);
        if (twoSided && d) positions.push(...a, ...d, ...c);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      return mesh(body, geometry, m, name);
    };
    // Masts reach the recipe's air draft; the declared height stays the body height (proxies).
    const mastTop = s.mastHeight ?? H;
    const hullDraft = draft * (P.canoe ?? 1);
    const smooth = (t) => t * t * (3 - 2 * t);
    const unit = (t) => Math.min(1, Math.max(0, t));
    // Plan view runs from the stern (0) to the stem (1); a double-ended ferry has two bows.
    const bowness = (z) => {
      const u = (z + L / 2) / L;
      const v = Math.max(0, (u - P.entry) / (1 - P.entry));
      const back = P.doubleEnded ? Math.max(0, (1 - u - P.entry) / (1 - P.entry)) : 0;
      return Math.max(v, back);
    };
    const deckHalf = (z) => {
      const u = (z + L / 2) / L;
      const stern = P.doubleEnded ? 1 : P.transom + (1 - P.transom) * smooth(Math.min(1, u / 0.2));
      return (W / 2) * stern * Math.max(0, 1 - Math.pow(bowness(z), P.fullness));
    };
    const flareAt = (z) => P.flare * ((P.flareMid ?? 0.3) + (1 - (P.flareMid ?? 0.3)) * bowness(z));
    // A raised forecastle steps the deck up at its break over a short ramp.
    const fcZ = P.forecastle ? -L / 2 + L * P.forecastle[0] : L;
    const fcRamp = Math.min(0.4, L * 0.004);
    const deckYAt = (z) =>
      deckY + (P.forecastle ? P.forecastle[1] * unit((z - fcZ) / fcRamp + 1) : 0);
    const sheerAt = (z) => {
      const u = (z + L / 2) / L;
      return (
        deckYAt(z) +
        P.bulwark +
        P.bowRise * Math.pow(bowness(z), 1.5) +
        P.sternRise * Math.max(0, 1 - u / 0.15)
      );
    };
    // The stem rakes forward: lower points of each bow station sit aft of its gunwale. Behind a
    // bulbous bow the stem stays plumb below the waterline. A stemCurve below 1 rounds the stem:
    // raked well forward near the head, steepening into the forefoot.
    const rakeShift = (z, y) =>
      -P.rake *
      L *
      smooth(bowness(z)) *
      Math.pow(
        Math.min(1, Math.max(0, (sheerAt(z) - y) / (sheerAt(z) + (P.bulb ? 0 : hullDraft)))),
        P.stemCurve ?? 1,
      );
    const stationCount = P.stations ?? Math.max(16, Math.min(28, Math.round(L / 2)));
    const zs = Array.from({ length: stationCount + 1 }, (_, i) => -L / 2 + (L * i) / stationCount);
    // Extra stations resolve the stern run and square the forecastle break.
    const extra = [];
    if (P.run) for (const f of [0.12, 0.25, 0.4, 0.6, 0.8]) extra.push(-L / 2 + L * P.run * f);
    if (P.forecastle) extra.push(fcZ - fcRamp, fcZ);
    for (const z of extra)
      if (!zs.some((v) => Math.abs(v - z) < Math.min(0.3, L * 0.01) && v !== fcZ - fcRamp))
        zs.push(z);
    zs.sort((a, b) => a - b);
    // Half section from keel to gunwale: keel, bottom, bilge, waterline, boot-top, topside, gunwale.
    const bootTop = Math.min(0.6, Math.max(0.06, deckY * 0.08));
    const transomY = P.transomY ?? 0;
    // Half-width of the topsides at height y: a planing hull's flare narrows them toward the chine.
    const topsideHalf = (z, y) => {
      const g = deckHalf(z);
      if (!P.chine) return g;
      const b = g / (1 + flareAt(z));
      return b + (g - b) * Math.pow(unit(y / sheerAt(z)), 1.4);
    };
    const section = (z) => {
      const u = (z + L / 2) / L;
      const g = deckHalf(z),
        b = g / (1 + flareAt(z));
      const full = hullDraft * (1 - (P.forefoot ?? 0.35) * smooth(bowness(z)));
      // The run sweeps the bottom up to the transom; the keel holds its depth a little longer as
      // the skeg (stern frame) ahead of the propeller.
      const t = P.run ? unit(u / P.run) : 1;
      const d = full - (full + transomY) * Math.pow(1 - t, 1.4);
      const keel = P.run ? d + (full - d) * smooth(unit((t - 0.25) / 0.12)) : full;
      const bottomY = Math.min(-d * P.bilge, -d + 0.5 * b * Math.tan(P.deadrise));
      const topside = [(b + g) / 2 + (g - b) * 0.1, deckY * 0.55];
      const points = [
        // Both halves share the keel; a nonzero half-width leaves the entire bottom open.
        [0, -keel],
        [0.5 * b * (0.25 + 0.75 * t), bottomY],
        [0.93 * b, -d * P.bilge],
        [b, 0],
        [b + ((topside[0] - b) * bootTop) / topside[1], bootTop],
        topside,
        [g, sheerAt(z)],
      ];
      if (P.chine) {
        // Planing hull above the boot-top: flared topsides (narrow at the chine, flaring out to
        // the gunwale), a white bottom moulding up to a spray strake whose line climbs toward the
        // bow, the hull colour above it and the white deck moulding along the top.
        const sheer = sheerAt(z),
          [low, rise, strake] = P.chine;
        // The strake climbs steadily from the transom toward the bow.
        const chineY = Math.min(sheer - P.cap - 0.15, low + rise * u * u);
        const flared = (y) => [topsideHalf(z, y), y];
        const lip = flared(chineY);
        points.splice(
          4,
          3,
          flared(bootTop),
          lip,
          [lip[0] + strake, chineY + 0.012],
          flared(chineY + 0.05),
          flared((chineY + 0.05 + sheer - P.cap) / 2),
          flared(sheer - P.cap),
          [g, sheer],
        );
      }
      // A transom above the waterline lifts the lower points; keep each above the one below it.
      for (let k = 1; k < points.length; k++)
        points[k][1] = Math.max(points[k][1], points[k - 1][1] + 0.005);
      return points.map(([x, y]) => [x, y, z + rakeShift(z, y)]);
    };
    const sections = zs.map(section);
    const surface = (name, material, edges) => {
      const positions = [];
      for (const k of edges)
        for (const m of [-1, 1])
          for (let j = 0; j < sections.length - 1; j++) {
            const [a, b, c, d] = [
              sections[j][k],
              sections[j][k + 1],
              sections[j + 1][k],
              sections[j + 1][k + 1],
            ].map(([x, y, z]) => [x * m, y, z]);
            if (m > 0) positions.push(...a, ...b, ...d, ...a, ...d, ...c);
            else positions.push(...a, ...d, ...b, ...a, ...c, ...d);
          }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      return mesh(body, geometry, material, name);
    };
    const antifouling = material('antifouling', big ? '#7c3b31' : '#3a3f42', 0, 0.85);
    surface('underwater-hull', antifouling, [0, 1, 2]);
    // Boot-top: a dark band at the waterline, as painted on working hulls.
    surface('boot-top', dark, [3]);
    if (P.chine) {
      // Bottom moulding and strake underside, topsides, deck moulding.
      surface('hull-bottom', cream, [4, 5, 9]);
      surface('hull', paint, [6, 7, 8]);
    } else surface('hull', paint, [4, 5]);
    if (P.chine) {
      // A planing hull's transom carries the side bands round it.
      const stern = sections[0];
      for (const [m, edges, name] of [
        [antifouling, [0, 1, 2], 'transom'],
        [dark, [3], 'transom'],
        [cream, [4, 5, 9], 'transom-bands'],
        [paint, [6, 7, 8], 'transom'],
      ])
        quads(
          edges.map((k) => {
            const [[x0, y0, z0], [x1, y1, z1]] = [stern[k], stern[k + 1]];
            return [
              [x0, y0, z0],
              [-x0, y0, z0],
              [-x1, y1, z1],
              [x1, y1, z1],
            ];
          }),
          m,
          name,
        );
    } else if (!P.doubleEnded) {
      const stern = sections[0];
      const outline = [...stern.map(([x, y, z]) => [-x, y, z]).reverse(), ...stern];
      const positions = [];
      for (let k = 1; k < outline.length - 1; k++)
        positions.push(...outline[0], ...outline[k + 1], ...outline[k]);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      mesh(body, geometry, paint, 'transom');
    }
    // Ships carry a bulbous bow ahead of a plumb forefoot.
    if (P.bulb) {
      const dBow = hullDraft * (1 - P.forefoot);
      const radius = dBow * P.bulb[0],
        half = L * P.bulb[1];
      const bulb = mesh(body, new T.SphereGeometry(1, 12, 7), antifouling, 'bulbous-bow');
      bulb.scale.set(radius * 0.8, radius, half);
      bulb.position.set(0, -dBow * 0.52, L / 2 - P.rake * L - half * 0.35);
    }
    // Propeller in the aperture behind the skeg, rudder abaft it under the counter.
    if (P.run && !P.canoe) {
      const at = (f) => -L / 2 + L * P.run * f;
      const propZ = at(0.2),
        rudderZ = at(0.07);
      const counter = section(propZ)[1][1];
      const propR = Math.max(0.12, Math.min(hullDraft * 0.36, (counter + hullDraft * 0.97) * 0.48));
      const shaftY = counter - propR * 1.08;
      const hub = mesh(
        body,
        new T.CylinderGeometry(propR * 0.2, propR * 0.16, propR * 0.45, 8).rotateX(Math.PI / 2),
        metal,
      );
      hub.position.set(0, shaftY, propZ);
      for (let k = 0; k < 4; k++) {
        const blade = mesh(body, new T.BoxGeometry(propR * 0.5, propR * 0.92, propR * 0.06), metal);
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        blade.position.set(Math.sin(a) * propR * 0.52, shaftY + Math.cos(a) * propR * 0.52, propZ);
        blade.rotation.set(0.35, 0, -a, 'ZXY');
      }
      rod(body, [0, shaftY, propZ + propR * 0.2], [0, shaftY, at(0.3)], propR * 0.08, metal);
      if (s.shape === 'tugboat') {
        // Harbour tugs drive through a Kort nozzle.
        const nozzle = mesh(body, new T.TorusGeometry(propR * 1.08, propR * 0.13, 5, 16), dark);
        nozzle.position.set(0, shaftY, propZ);
        nozzle.scale.z = 2.4;
      }
      const top = section(rudderZ)[1][1];
      const bottom = Math.max(-hullDraft * 0.95, shaftY - propR * 1.05);
      const chord = Math.max(0.25, L * 0.02);
      box(
        body,
        [Math.max(0.05, chord * 0.18), top - bottom, chord],
        [0, (top + bottom) / 2, rudderZ],
        antifouling,
        'rudder',
      );
    }
    // Deck plating inside the bulwarks, the bulwarks' inner faces and a cap rail along the sheer.
    const deckMaterial = material('deck', P.deckColor, 0, 0.8);
    const inset = Math.min(0.25, W * 0.012 + 0.03);
    const deckPositions = [],
      bulwarkPositions = [],
      breakPositions = [];
    for (let j = 0; j < zs.length - 1; j++) {
      const [z0, z1] = [zs[j], zs[j + 1]];
      const [w0, w1] = [Math.max(0, deckHalf(z0) - inset), Math.max(0, deckHalf(z1) - inset)];
      const [s0, s1] = [sheerAt(z0), sheerAt(z1)];
      const [y0, y1] = [deckYAt(z0), deckYAt(z1)];
      // The sole meets the topsides where they cross its height.
      const [f0, f1] = [
        Math.max(0, topsideHalf(z0, y1) - inset),
        Math.max(0, topsideHalf(z1, y1) - inset),
      ];
      if (y1 - y0 > 0.01) {
        // The forecastle break is a bulkhead facing aft, not a steep deck plate.
        breakPositions.push(-w0, y0, z0, -w0, y1, z0, w0, y1, z0);
        breakPositions.push(-w0, y0, z0, w0, y1, z0, w0, y0, z0);
      }
      deckPositions.push(-f0, y1, z0, f1, y1, z1, f0, y1, z0);
      deckPositions.push(-f0, y1, z0, -f1, y1, z1, f1, y1, z1);
      for (const m of [-1, 1]) {
        const quad = [
          [m * f0, y0, z0],
          [m * w0, s0, z0],
          [m * w1, s1, z1],
          [m * f1, y1, z1],
        ];
        if (m > 0) quad.reverse();
        bulwarkPositions.push(
          ...quad[0],
          ...quad[1],
          ...quad[2],
          ...quad[0],
          ...quad[2],
          ...quad[3],
        );
      }
    }
    for (const [positions, mat, name] of [
      [deckPositions, deckMaterial, 'deck'],
      [bulwarkPositions, cream, 'bulwark-lining'],
      [breakPositions, cream, 'forecastle-break'],
    ]) {
      if (!positions.length) continue;
      // Follow the raked stem, so a deep bulwark's lining stays inside the bow.
      for (let i = 0; i < positions.length; i += 3)
        positions[i + 2] += rakeShift(positions[i + 2], positions[i + 1]);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      mesh(body, geometry, mat, name);
    }
    const capRadius = Math.min(0.18, Math.max(0.025, W * 0.008));
    for (const m of [-1, 1]) {
      const rail = zs
        .filter((z) => deckHalf(z) > capRadius)
        .map((z) => [m * (deckHalf(z) - capRadius * 0.6), sheerAt(z) + capRadius * 0.4, z]);
      for (let j = 1; j < rail.length; j++) rod(body, rail[j - 1], rail[j], capRadius, cream, 6);
    }
    if (s.shape === 'sailboat') {
      // Fin keel and spade rudder carry the declared draft below a shallow canoe body.
      box(
        body,
        [0.16, draft - hullDraft + 0.15, L * 0.14],
        [0, -(draft + hullDraft) / 2 + 0.05, -L * 0.02],
        antifouling,
        'fin-keel',
      );
      const bulb = mesh(body, new T.SphereGeometry(1, 10, 6), dark, 'keel-bulb');
      bulb.scale.set(0.2, 0.13, L * 0.1);
      bulb.position.set(0, -draft + 0.13, -L * 0.035);
      box(
        body,
        [0.08, hullDraft * 2.2, L * 0.06],
        [0, -hullDraft * 0.85, -L * 0.4],
        antifouling,
        'rudder',
      );
    }
    // Hull queries for the close-view fittings (cleats, lights, lettering).
    hull = {
      deckAt: (z) => deckHalf(z) - inset,
      deckYAt,
      sheerAt,
      rake: rakeShift,
      sideAt(z, y) {
        const points = section(z);
        for (let k = 1; k < points.length; k++) {
          const [x0, y0] = points[k - 1],
            [x1, y1] = points[k];
          if (y >= y0 && y <= y1) {
            const t = y1 > y0 ? (y - y0) / (y1 - y0) : 0;
            return { x: x0 + (x1 - x0) * t, tilt: Math.atan2(x1 - x0, y1 - y0) };
          }
        }
        return { x: points.at(-1)[0], tilt: 0 };
      },
    };
    // A ship's anchors lie stowed in slanted hawse pockets on the bow flare below the deck edge.
    if (P.bulb)
      for (const m of [-1, 1]) {
        const z = L / 2 - L * 0.05,
          y = deckYAt(z) - 0.5;
        const side = hull.sideAt(z, y);
        const slope = (deckHalf(z + 1) - deckHalf(z - 1)) / 2;
        for (const [size, out, part, name] of [
          [[0.12, 0.9, 1.5], 0.03, dark, 'hawse-pocket'],
          [[0.16, 0.5, 1.1], 0.07, metal, 'anchor'],
        ]) {
          const o = box(body, size, [m * (side.x + out), y, z + rakeShift(z, y)], part, name);
          o.rotation.set(0.5, Math.atan(m * slope), -m * side.tilt, 'YZX');
        }
      }
    // A box-section member between two points: window posts, frames and davits. size is the side,
    // or [x, z] for a flat post standing near upright.
    const strut = (a, b, size, m, name) => {
      const start = new T.Vector3(...a);
      const d = new T.Vector3(...b).sub(start);
      const [sx, sz] = Array.isArray(size) ? size : [size, size];
      const o = mesh(body, new T.BoxGeometry(sx, d.length(), sz), m, name);
      o.position.copy(start.addScaledVector(d, 0.5));
      o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      return o;
    };
    // A guard rail on a deck at height y along [x, z] points: a top rail on posts about 2 m apart.
    const railing = (points, y, height = 1, size = 0.05) => {
      const top = points.map(([x, z]) => [x, y + height, z]);
      const closed = points.at(-1).every((v, i) => v === points[0][i]);
      for (let k = 1; k < top.length; k++) {
        const [a, b] = [top[k - 1], top[k]];
        strut(a, b, size, cream);
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 2));
        const last = closed && k === top.length - 1 ? n - 1 : n;
        for (let i = k === 1 ? 0 : 1; i <= last; i++) {
          const [x, z] = [a[0] + ((b[0] - a[0]) * i) / n, a[2] + ((b[2] - a[2]) * i) / n];
          strut([x, y, z], [x, y + height, z], size, cream);
        }
      }
    };
    // A deckhouse: solid lower walls, a glazed band and a roof. opts.sill and opts.window place the
    // band (default: at the top of the house). The house holding the operator's eye is hollow.
    // Wheelhouse options: rake leans the front glazing out at its top (m) and flare each side (m);
    // aftSolid closes that fraction of each side from the aft end, and the aft face; corner is the
    // corner post width (m) and post the side posts' (separate windows rather than a band); visor
    // the roof's overhang ahead of the front and eave elsewhere; band the material of the fascia
    // and roof above the glass; facing -1 turns the front astern; core darkens a passenger house's
    // windows with an unlit interior behind them.
    const cabin = (z, len, width, y, height, opts = {}) => {
      let windowHeight = Math.min(opts.window ?? 1.4, height * 0.65);
      let sill = opts.sill ?? height - windowHeight;
      const eye = s.driverEye;
      const operatorCabin =
        eye && Math.abs(eye[2] - z) < len / 2 && eye[1] > y && eye[1] < y + height + 0.2;
      if (operatorCabin) {
        // A solid accommodation block is fine below the bridge, but the bridge itself is hollow.
        const floorY = Math.min(y + sill - 0.04, eye[1] - 1.15);
        // Wheelhouse windows sit on solid lower walls, not a glass band down to the floor.
        // Keep the sill below the operator's eye and leave at least a 55 cm window opening.
        const lowerTop = Math.min(
          y + height - 0.55,
          Math.max(floorY + 0.75, Math.min(y + sill, eye[1] - 0.3)),
        );
        sill = lowerTop - y;
        windowHeight = Math.min(height - sill, opts.operatorWindow ?? height);
        if (floorY - 0.06 > y)
          box(body, [width, floorY - 0.06 - y, len], [0, (floorY - 0.06 + y) / 2, z], cream);
        const wallHeight = Math.max(0.06, y + sill - floorY);
        box(body, [width, 0.06, len], [0, floorY - 0.03, z], dark, 'bridge-floor');
        for (const side of [-1, 1]) {
          box(
            body,
            [0.075, wallHeight, len],
            [side * (width / 2 - 0.0375), floorY + wallHeight / 2, z],
            cream,
            'bridge-side-lining',
          );
          box(
            body,
            [width, wallHeight, 0.075],
            [0, floorY + wallHeight / 2, z + side * (len / 2 - 0.0375)],
            cream,
            'bridge-end-lining',
          );
        }
        s = { ...s, helmFloor: floorY };
      } else box(body, [width, sill, len], [0, y + sill / 2, z], cream);
      const fascia = height - sill - windowHeight;
      const rake = opts.rake ?? 0,
        flare = opts.flare ?? 0,
        aftSolid = opts.aftSolid ?? 0,
        facing = opts.facing ?? 1;
      const half = width / 2,
        y0 = y + sill;
      // A point on the glazed band: across -1 (right) .. 1 (left), along 0 (aft) .. 1 (front), up
      // 0..1. A house facing -1 looks astern (the far end of a double-ended ferry).
      const band = (across, along, up) => [
        across * (half + flare * up),
        y0 + windowHeight * up,
        z + facing * (-len / 2 + along * (len + rake * up)),
      ];
      const top = opts.band ?? cream;
      if (fascia > 0.01)
        box(
          body,
          [width + 2 * flare, fascia, len + rake],
          [0, y + height - fascia / 2, z + (facing * rake) / 2],
          top,
        );
      // Four panes only: a transparent box also puts a glass floor across the bridge. The aft part
      // of a wheelhouse is plated, seen from inside as well.
      const glazed = [
        [band(-1, 1, 0), band(1, 1, 0), band(1, 1, 1), band(-1, 1, 1)],
        [band(1, 1, 0), band(1, aftSolid, 0), band(1, aftSolid, 1), band(1, 1, 1)],
        [band(-1, aftSolid, 0), band(-1, 1, 0), band(-1, 1, 1), band(-1, aftSolid, 1)],
      ];
      const aftFace = [band(1, 0, 0), band(-1, 0, 0), band(-1, 0, 1), band(1, 0, 1)];
      if (aftSolid > 0)
        quads(
          [
            aftFace,
            [band(1, aftSolid, 0), band(1, 0, 0), band(1, 0, 1), band(1, aftSolid, 1)],
            [band(-1, 0, 0), band(-1, aftSolid, 0), band(-1, aftSolid, 1), band(-1, 0, 1)],
          ],
          cream,
          'cabin-aft-wall',
          true,
        );
      else glazed.push(aftFace);
      quads(glazed, glass, 'glazing');
      if (opts.core && !operatorCabin)
        box(
          body,
          [width - 0.5, windowHeight - 0.02, len - 0.5],
          [0, y0 + windowHeight / 2, z],
          dark,
          'cabin-interior',
        );
      const mullion = big ? 0.09 : 0.05;
      const paneCount = opts.panes ?? (big ? 5 : 3);
      for (const along of aftSolid > 0 ? [1] : [0, 1])
        for (let i = 1; i < paneCount; i++) {
          const across = -1 + (2 * i) / paneCount;
          strut(band(across, along, 0), band(across, along, 1), mullion, cream);
        }
      // Solid corner posts frame the front; side posts divide the side glazing.
      const corner = opts.corner ?? mullion;
      for (const across of [-1, 1])
        for (const along of [0, 1])
          strut(band(across, along, 0), band(across, along, 1), corner, cream);
      const posts = Math.max(2, Math.floor(len / (opts.spacing ?? (big ? 3 : 1.1))));
      for (let j = 0; j < posts; j++) {
        const along = 0.1 + (j * 0.8) / Math.max(1, posts - 1);
        if (along < aftSolid) continue;
        for (const across of [-1, 1])
          strut(
            band(across, along, 0),
            band(across, along, 1),
            [0.08, opts.post ?? (big ? 0.16 : 0.07)],
            cream,
          );
      }
      // Roof overhanging the glass: a sun visor ahead of the front, a drip edge elsewhere.
      const visor = opts.visor ?? 0.025,
        eave = opts.eave ?? visor;
      box(
        body,
        [(width + 2 * flare) * 1.04 + 0.04, 0.12, len + rake + visor + eave],
        [0, y + height + 0.04, z + (facing * (rake + visor - eave)) / 2],
        top,
      );
    };
    // A raked funnel: an oval casing sheared aft, with a dark top band.
    const funnel = (z, len, width, base, top, rake = 0.18) => {
      const make = (y0, y1, m) => {
        const g = new T.CylinderGeometry(0.5, 0.5, 1, 10);
        g.scale(width, y1 - y0, len);
        g.translate(0, (y1 - y0) / 2, 0);
        g.applyMatrix4(new T.Matrix4().makeShear(0, 0, 0, -rake, 0, 0));
        g.translate(0, y0, z);
        g.computeVertexNormals();
        mesh(body, g, m, 'funnel');
      };
      const band = Math.min(1, (top - base) * 0.16);
      make(base, top - band, paint);
      make(top - band, top, dark);
    };
    // A merchant funnel casing: a chamfered box whose aft face rakes aft and whose top slopes down
    // aft, in the ship's colour under a dark top band, with exhaust pipes standing out of it.
    const casing = (z, len, width, base, top) => {
      const rake = (top - base) * 0.07,
        drop = len * 0.15,
        band = Math.min(1.5, (top - base) * 0.12);
      const w = width / 2,
        c = Math.min(w, len / 2) * 0.3,
        fore = z + len / 2;
      const ring = (y, t, sloped) => {
        const aftZ = z - len / 2 - rake * t;
        return [
          [w - c, fore],
          [w, fore - c],
          [w, aftZ + c],
          [w - c, aftZ],
          [-w + c, aftZ],
          [-w, aftZ + c],
          [-w, fore - c],
          [-w + c, fore],
        ].map(([x, pz]) => [x, y - (sloped ? (drop * (fore - pz)) / (fore - aftZ) : 0), pz]);
      };
      const rings = [ring(base, 0, false), ring(top - band, 1 - band / (top - base), true)];
      rings.push(ring(top, 1, true));
      for (const [k, m] of [
        [0, paint],
        [1, dark],
      ])
        quads(
          rings[k].map((p, i) => {
            const j = (i + 1) % 8;
            return [p, rings[k][j], rings[k + 1][j], rings[k + 1][i]];
          }),
          m,
          'funnel',
        );
      const cap = rings[2];
      const middle = cap.reduce((a, p) => a.map((v, i) => v + p[i] / 8), [0, 0, 0]);
      quads(
        cap.map((p, i) => [middle, p, cap[(i + 1) % 8]]),
        dark,
        'funnel-top',
      );
      for (const x of [-w * 0.35, w * 0.35])
        rod(
          body,
          [x, top - 1, fore - len * 0.3],
          [x, top + 1.1, fore - len * 0.3 - 0.2],
          0.28,
          dark,
        );
    };
    const mast = (z, base, top, yard) => {
      rod(body, [0, base, z], [0, top, z], Math.max(0.035, (top - base) * 0.012), metal);
      if (yard) rod(body, [-yard, top - 0.7, z], [yard, top - 0.7, z], 0.035, metal);
    };
    // Merchant accommodation aft: decks of cabins under a full-width bridge with wings, the funnel
    // casing behind the wheelhouse and a radar mast on its roof.
    const accommodation = (aft, front, width, funnelTop, mastTop) => {
      const eye = s.driverEye;
      const floor = eye[1] - 1.15;
      // A tall bridge: 2.9 m from its floor to the roof, the compass deck railed on top.
      const roof = floor + 2.9;
      const decks = Math.max(3, Math.round((floor - deckY) / 2.8));
      const tier = (floor - deckY) / decks;
      // The two lowest decks run the house's full length; the decks above stop short of the funnel
      // deck aft, so the funnel casing rises from it past the bridge.
      const step = Math.min(7, (front - aft) * 0.3);
      const lowTop = deckY + tier * 2;
      box(
        body,
        [width, lowTop - deckY, front - aft],
        [0, (lowTop + deckY) / 2, (front + aft) / 2],
        cream,
        'accommodation',
      );
      box(
        body,
        [width, floor - 0.06 - lowTop, front - aft - step],
        [0, (floor - 0.06 + lowTop) / 2, (front + aft + step) / 2],
        cream,
        'accommodation',
      );
      // Wheelhouse across the house front: raked front windows, glazed forward sides, plated aft.
      const whLen = Math.min(front - aft - step, Math.max(6, (front - aft) * 0.45));
      cabin(front - whLen / 2, whLen, width, floor, roof - floor, {
        visor: 0.9,
        eave: 0.25,
        rake: 0.35,
        aftSolid: 0.45,
        corner: 0.3,
        panes: Math.round(width / 1.8),
      });
      // Cabin windows: rows across the house front, a few cabins along the sides and two on each
      // aft face, clear of the funnel casing and the lifeboat ramp, deck by deck.
      const panes = [];
      const pane = (c, u, v) =>
        panes.push(
          ...[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, -1],
            [1, 1],
            [-1, 1],
          ].flatMap(([a, b]) => c.map((x, i) => x + a * u[i] + b * v[i])),
        );
      const across = Math.floor((width - 1) / 2.1);
      for (let k = 0; k < decks; k++) {
        const level = deckY + tier * (k + 0.55);
        const from = k < 2 ? aft : aft + step;
        for (let i = 0; i < across; i++)
          pane([(i - (across - 1) / 2) * 2.1, level, front + 0.02], [0.6, 0, 0], [0, 0.42, 0]);
        for (const dz of [1.5, 4.3, 6.1, 9.5])
          if (front - dz > from + 1.2)
            for (const face of [-1, 1])
              pane(
                [face * (width / 2 + 0.02), level, front - dz],
                [0, 0, -face * 0.5],
                [0, 0.375, 0],
              );
        for (const x of [-1, 1])
          pane([x * width * 0.37, level, from - 0.02], [-0.5, 0, 0], [0, 0.375, 0]);
      }
      const windows = new T.BufferGeometry();
      windows.setAttribute('position', new T.Float32BufferAttribute(panes, 3));
      windows.computeVertexNormals();
      mesh(body, windows, dark, 'cabin-windows');
      // Bridge wings reach the ship's sides so the bridge can see down them, carried on brackets.
      const wingWidth = (W * 0.96 - width) / 2;
      for (const side of [-1, 1]) {
        const x = side * (width / 2 + wingWidth / 2);
        box(body, [wingWidth, 0.3, 3.2], [x, floor - 0.15, front - 1.6], cream, 'bridge-wing');
        box(body, [wingWidth, 1.1, 0.08], [x, floor + 0.55, front - 0.04], cream);
        box(body, [0.08, 1.1, 3.2], [side * (W * 0.48 - 0.04), floor + 0.55, front - 1.6], cream);
        const inner = (side * width) / 2,
          outer = side * W * 0.48;
        const [y0, y1] = [floor - 0.3, floor - 0.3 - Math.min(1.6, tier * 0.55)];
        const [z0, z1] = [front - 3.1, front - 0.1];
        quads(
          [
            [
              [inner, y1, z0],
              [inner, y1, z1],
              [outer, y0, z1],
              [outer, y0, z0],
            ],
            [
              [inner, y0, z1],
              [inner, y1, z1],
              [outer, y0, z1],
            ],
            [
              [inner, y0, z0],
              [outer, y0, z0],
              [inner, y1, z0],
            ],
          ],
          cream,
          'bridge-wing-bracket',
          true,
        );
      }
      // The funnel casing stands on the funnel deck against the house and clears the bridge roof;
      // a guard rail runs round the deck's open edges.
      casing(aft + 0.8 + step / 2, step, width * 0.5, lowTop, funnelTop);
      railing(
        [
          [width / 2 - 0.1, aft + step],
          [width / 2 - 0.1, aft + 0.1],
          [-width / 2 + 0.1, aft + 0.1],
          [-width / 2 + 0.1, aft + step],
        ],
        lowTop,
        1.1,
        0.07,
      );
      railing(
        [
          [width / 2 - 0.3, front - whLen + 0.4],
          [width / 2 - 0.3, front - 0.4],
          [-width / 2 + 0.3, front - 0.4],
          [-width / 2 + 0.3, front - whLen + 0.4],
          [width / 2 - 0.3, front - whLen + 0.4],
        ],
        roof + 0.1,
        1.1,
        0.06,
      );
      const mastZ = front - whLen * 0.55;
      mast(mastZ, roof + 0.1, mastTop, width * 0.18);
      box(body, [2.4, 0.12, 0.25], [0, roof + (mastTop - roof) * 0.55, mastZ + 0.2], dark);
      // Free-fall lifeboat on its launching ramp over the stern, under a recovery davit.
      const orange = material('lifeboat', '#e0662e', 0.05, 0.5);
      const slope = 0.55,
        ramp = Math.min(9, (aft + L / 2) * 0.9);
      const hi = [lowTop + 0.4, aft - 0.4],
        lo = [hi[0] - ramp * Math.sin(slope), hi[1] - ramp * Math.cos(slope)];
      for (const x of [-0.85, 0.85]) {
        strut([x, hi[0], hi[1]], [x, lo[0], lo[1]], 0.22, metal);
        if (lo[0] - deckY > 0.4) strut([x, lo[0], lo[1]], [x, deckY, lo[1]], 0.22, metal);
      }
      const boat = loft(
        body,
        [
          [-3.7, 1.0, 0.45, 2.3],
          [-3.0, 1.3, 0.1, 2.85],
          [1.6, 1.3, 0.05, 2.75],
          [3.0, 0.85, 0.35, 2.3],
          [3.75, 0.25, 0.95, 1.7],
        ],
        orange,
        'lifeboat',
      );
      boat.rotation.set(-slope, Math.PI, 0);
      boat.position.set(
        0,
        (hi[0] + lo[0]) / 2 + 0.12 * Math.cos(slope),
        (hi[1] + lo[1]) / 2 - 0.12 * Math.sin(slope),
      );
      const davit = [lowTop + 4.6, aft - 3.4];
      for (const x of [-1.9, 1.9]) strut([x, lowTop, aft - 0.3], [x * 0.7, ...davit], 0.26, cream);
      strut([-1.33, ...davit], [1.33, ...davit], 0.26, cream);
      return { floor, roof };
    };
    if (s.shape === 'container-ship') {
      const front = s.driverEye[2] + 1.15;
      accommodation(-L / 2 + L * 0.08, front, W * 0.72, s.driverEye[1] + 3, mastTop);
      // Container bays on hatch covers from the accommodation to the forecastle, stepped down
      // forward so the bridge keeps its view over the bow. Faces are coloured per box.
      const cargo = material('container-colors', '#ffffff');
      cargo.vertexColors = true;
      cargo.side = T.DoubleSide;
      const colors = [
        '#9b3b30',
        '#2f5f8f',
        '#c9c5bb',
        '#7a7f84',
        '#3d7f6a',
        '#b8502d',
        '#1f6f8b',
      ].map((c) => new T.Color(c).toArray());
      const positions = [],
        vertexColors = [];
      const quad = (a, b, c, d, color) => {
        positions.push(...a, ...b, ...c, ...a, ...c, ...d);
        for (let i = 0; i < 6; i++) vertexColors.push(...color);
      };
      const cw = 2.44,
        ch = 2.59,
        cl = 12.19,
        gap = 0.05;
      const start = front + 1.8,
        end = fcZ - 2.2;
      const bays = Math.round((end - start) / (cl + 0.6));
      const pitch = (end - start) / bays;
      const coamingTop = deckY + 1.6;
      for (let bay = 0; bay < bays; bay++) {
        const z0 = start + bay * pitch + (pitch - cl) / 2,
          z1 = z0 + cl;
        const half = Math.min(deckHalf(z0), deckHalf(z1)) - 0.6;
        const rows = Math.min(9, Math.floor((2 * half) / cw));
        const tiers = bay >= bays - 1 ? 2 : bay >= bays - 3 ? 3 : 4;
        box(
          body,
          [rows * cw + 0.4, 1.6, cl + 0.3],
          [0, deckY + 0.8, (z0 + z1) / 2],
          deckMaterial,
          'hatch',
        );
        const pick = (r, t) =>
          colors[(bay * 3 + r * 5 + t * 2 + ((bay * r + t * r + bay * t) % 3)) % colors.length];
        // Stacks are not loaded level: some rows stand a box or two lower.
        const height = (r) =>
          r < 0 || r >= rows
            ? 0
            : tiers -
              ((bay * 7 + r * 3) % 5 === 1 ? 1 : 0) -
              (tiers > 3 && (bay * 5 + r * 11) % 7 === 2 ? 1 : 0);
        for (let r = 0; r < rows; r++) {
          const x0 = (r - rows / 2) * cw + gap,
            x1 = x0 + cw - 2 * gap;
          for (let t = 0; t < height(r); t++) {
            const y0 = coamingTop + t * ch + gap,
              y1 = y0 + ch - 2 * gap;
            const color = pick(r, t);
            quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color);
            quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color);
            if (height(r - 1) <= t)
              quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color);
            if (height(r + 1) <= t)
              quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color);
            if (t === height(r) - 1)
              quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color);
          }
        }
        // Lashing bridge across the hatch between this bay and the next.
        if (bay < bays - 1)
          box(
            body,
            [rows * cw + 0.4, 2.5, 0.3],
            [0, coamingTop + 1.25, z1 + (pitch - cl) / 2],
            deckMaterial,
            'lashing-bridge',
          );
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new T.Float32BufferAttribute(vertexColors, 3));
      geometry.computeVertexNormals();
      mesh(body, geometry, cargo, 'containers');
      // Breakwater on the forecastle and a foremast.
      // A V-shaped breakwater pointing forward on the forecastle, braced behind.
      const hw = W * 0.36,
        apex = fcZ + 4.5,
        foot = fcZ + 2.5,
        span = Math.hypot(hw, apex - foot);
      for (const m of [-1, 1]) {
        const plate = box(
          body,
          [0.25, 2.4, span],
          [(m * hw) / 2, deckYAt(L / 2) + 1.2, (apex + foot) / 2],
          cream,
          'breakwater',
        );
        plate.rotation.y = Math.atan2(-m * hw, apex - foot);
        for (const f of [0.3, 0.7])
          strut(
            [m * hw * f, deckYAt(L / 2) + 2.2, apex - (apex - foot) * f - 0.1],
            [m * hw * f, deckYAt(L / 2), apex - (apex - foot) * f - 1.6],
            0.18,
            cream,
          );
      }
      mast(L / 2 - L * 0.05, deckYAt(L / 2) - 0.2, deckYAt(L / 2) + 9, 1.4);
    } else if (s.shape === 'bulk-carrier') {
      const hatchCover = material('hatch-covers', '#5d6a63', 0.2, 0.6);
      const front = s.driverEye[2] + 1.15;
      accommodation(-L / 2 + L * 0.075, front, W * 0.8, deckY + 17.4, mastTop);
      // Five holds under raised coamings and lift-away covers, four deck cranes between them.
      const start = front + 2,
        end = fcZ - 1.5;
      const pitch = (end - start) / 5;
      for (let j = 0; j < 5; j++) {
        const z = start + pitch * (j + 0.5);
        box(
          body,
          [W * 0.52, 1.8, pitch * 0.68],
          [0, deckY + 0.9, z],
          deckMaterial,
          'hatch-coaming',
        );
        box(body, [W * 0.54, 0.75, pitch * 0.7], [0, deckY + 2.15, z], hatchCover, 'hatch');
        box(body, [W * 0.46, 0.35, pitch * 0.66], [0, deckY + 2.68, z], hatchCover);
        // Side-rolling cover panels meet on the centreline.
        box(body, [0.18, 0.06, pitch * 0.66], [0, deckY + 2.87, z], dark, 'hatch-joint');
      }
      for (let j = 1; j < 5; j++) {
        const z = start + pitch * j;
        const pedestalTop = deckY + 8.5;
        rod(body, [0, deckY, z], [0, pedestalTop, z], 1.35, cream, 12);
        // Round slewing house on the post, the operator's cab on its side glazed toward the jib,
        // an A-frame on top for the luffing wires.
        const house = mesh(body, new T.CylinderGeometry(2.1, 2.1, 3.2, 12), cream, 'crane-house');
        house.position.set(0, pedestalTop + 1.6, z);
        box(body, [1.8, 2.1, 2.3], [2.1, pedestalTop + 2.0, z + 0.7], cream, 'crane-cab');
        box(body, [1.5, 0.9, 0.04], [2.1, pedestalTop + 2.4, z + 1.86], dark);
        for (const x of [-0.7, 0.7])
          strut([x, pedestalTop + 3, z - 0.9], [0, pedestalTop + 4.4, z - 1.3], 0.22, cream);
        // Jib stowed forward over the next hatch and crane, luffing wires to the house top.
        const heel = [0, pedestalTop + 0.8, z + 1.6];
        const jib = Math.min(pitch * 1.02, 21),
          a = 0.35;
        const tip = [0, heel[1] + Math.sin(a) * jib, heel[2] + Math.cos(a) * jib];
        // Heavy box-section jib tapering toward the head.
        const beam = mesh(body, new T.CylinderGeometry(0.5, 1.0, jib, 4), cream, 'crane-jib');
        beam.position.set(0, (heel[1] + tip[1]) / 2, (heel[2] + tip[2]) / 2);
        beam.rotation.set(Math.PI / 2 - a, 0, 0);
        beam.rotateY(Math.PI / 4);
        rod(body, [0, pedestalTop + 4.4, z - 1.3], tip, 0.05, dark, 4);
        rod(body, tip, [0, tip[1] - 3, tip[2]], 0.04, dark, 4);
      }
      mast(L / 2 - L * 0.04, deckYAt(L / 2) - 0.2, deckYAt(L / 2) + 8, 1.2);
    } else if (ferry) {
      const car = s.shape === 'car-ferry';
      const eye = s.driverEye;
      if (car) {
        // Double-ended car ferry: car-deck casings along both sides, a full-width passenger deck
        // over the cars with a row of windows across each end above the car-deck portal and a
        // raked bulwark over the portal, the sun deck on its roof railed round, a wide pilothouse
        // with bridge wings near each end of the sun deck, and a pair of stacks amidships.
        const casingTop = deckY + 4.6,
          passengerTop = casingTop + 3.4;
        const casing = W * 0.11;
        const rescueZ = -L * 0.32;
        for (const side of [-1, 1]) {
          const x = side * (W * 0.47 - casing / 2);
          box(body, [casing, casingTop - deckY, L * 0.88], [x, (casingTop + deckY) / 2, 0], cream);
          // Tween-deck windows along the casing, two car-deck openings at each end.
          for (let i = 0; i < 17; i++) {
            const z = -L * 0.32 + i * L * 0.04;
            box(body, [0.06, 0.9, 1.8], [side * (W * 0.47 + 0.02), casingTop - 1.2, z], dark);
          }
          for (const z of [-L * 0.39, -L * 0.35, L * 0.35, L * 0.39]) {
            if (side > 0 && Math.abs(z - rescueZ) < 1) continue;
            box(body, [0.06, 1.4, 1.8], [side * (W * 0.47 + 0.02), deckY + 1.6, z], dark);
          }
        }
        // Rescue boat in a recess in the starboard casing.
        box(body, [0.06, 2.2, 5.6], [W * 0.47 + 0.02, deckY + 1.6, rescueZ], dark);
        const rescue = loft(
          body,
          [
            [-2.3, 0.6, 0.3, 0.9],
            [-1.6, 0.85, 0.05, 1.05],
            [1.2, 0.85, 0.05, 1.05],
            [2.3, 0.2, 0.55, 1.0],
          ],
          material('lifeboat', '#e0662e', 0.05, 0.5),
          'rescue-boat',
        );
        rescue.position.set(W * 0.47 - 0.55, deckY + 0.7, rescueZ);
        const front = eye[2] + 1.15,
          len = 4.6,
          floor = passengerTop + 0.1,
          endZ = L * 0.43,
          houseHalf = W * 0.37;
        cabin(0, endZ * 2, W * 0.92, casingTop, passengerTop - casingTop, {
          sill: 1,
          window: 1.2,
          spacing: 2,
          post: 0.35,
          panes: 9,
          core: true,
        });
        for (const end of [-1, 1]) {
          // Raked bulwark over the car-deck portal under the passenger deck's end windows.
          const visor = box(
            body,
            [W * 0.86, 0.16, 1.9],
            [0, casingTop - 0.6, end * (endZ + 0.75)],
            cream,
            'portal-bulwark',
          );
          visor.rotation.x = end * 0.55;
          // Pilothouse windows lean out over the sun deck under a green visor; the sides flare.
          cabin(end * (front - len / 2), len, houseHalf * 2, floor, eye[1] + 1.75 - floor, {
            sill: 1.3,
            window: 1.55,
            visor: 0.45,
            eave: 0.15,
            rake: 0.3,
            flare: 0.22,
            corner: 0.16,
            operatorWindow: 1.55,
            panes: 6,
            band: paint,
            facing: end,
          });
          mast(end * (front - len * 0.6), eye[1] + 1.85, mastTop, 1.1);
          // Railed bridge wings either side of the pilothouse at its window sill.
          const wingY = eye[1] - 0.4,
            [z0, z1] = [end * (front - len + 0.2), end * (front - 0.2)];
          for (const m of [-1, 1]) {
            box(
              body,
              [W * 0.48 - houseHalf, 0.14, len - 0.4],
              [m * (W * 0.48 + houseHalf) * 0.5, wingY - 0.07, (z0 + z1) / 2],
              cream,
              'bridge-wing',
            );
            railing(
              [
                [m * houseHalf, z0],
                [m * W * 0.48, z0],
                [m * W * 0.48, z1],
                [m * houseHalf, z1],
              ],
              wingY,
            );
          }
        }
        // Guard rails round the sun deck.
        const rail = W * 0.46 - 0.1;
        railing(
          [
            [rail, -endZ + 0.1],
            [rail, endZ - 0.1],
            [-rail, endZ - 0.1],
            [-rail, -endZ + 0.1],
            [rail, -endZ + 0.1],
          ],
          passengerTop + 0.1,
        );
        // Sun-deck house amidships with the twin stacks rising through it.
        box(body, [W * 0.42, 2.7, L * 0.16], [0, passengerTop + 1.45, 0], cream, 'sun-deck-house');
        for (const x of [-1.2, 1.2]) {
          const stack = mesh(body, new T.CylinderGeometry(0.62, 0.7, 4.4, 12), dark, 'funnel');
          stack.position.set(x, passengerTop + 2.1, -0.6);
          stack.scale.z = 1.3;
        }
        // Aprons at the car-deck ends, within the hull.
        for (const z of [-endZ, endZ])
          box(body, [W * 0.4, 0.12, L * 0.08], [0, deckY + 0.08, z], metal, 'loading-ramp');
      } else {
        // Single-ended harbour ferry (Mersey style): two passenger decks in one house, small
        // main-deck windows under the big upper-saloon windows, the bridge house forward on its
        // roof and a raked funnel aft of it; aft, a low main-deck house under an open upper deck
        // with rails, benches and lifebuoys.
        const saloonTop = eye[1] - 1.15 - 0.06;
        const saloonW = W * 0.84,
          upper = deckY + 1.52;
        // The house runs full width aft; forward it narrows inside the bulwarks as the bow
        // tapers (the deck at house height lies a little aft of its gunwale station).
        const saloonFront = L * 0.356,
          saloonAft = -L * 0.2;
        const houseHalf = (z) => Math.min(saloonW / 2, deckHalf(z + 0.6) - 0.35);
        let cut = saloonFront;
        while (houseHalf(cut) < saloonW / 2 && cut > 0) cut -= 0.1;
        const saloonZ = (cut + saloonAft) / 2,
          saloonLen = cut - saloonAft;
        cabin(saloonZ, saloonLen, saloonW, deckY, saloonTop - deckY, {
          sill: 1.6,
          window: 1.1,
          spacing: 1.5,
          post: 0.32,
          core: true,
        });
        const noseZ = [0, 0.25, 0.5, 0.75, 1].map((t) => cut + (saloonFront - cut) * t);
        loft(
          body,
          noseZ.map((z) => [z, houseHalf(z), deckY, saloonTop]),
          cream,
          'saloon-front',
        );
        // Forward saloon windows follow the tapered sides; the front carries its own row.
        const noseWindows = [];
        for (const m of [-1, 1])
          for (let k = 1; k < noseZ.length; k++) {
            const [z0, z1] = [noseZ[k - 1], noseZ[k]];
            const [x0, x1] = [houseHalf(z0) + 0.01, houseHalf(z1) + 0.01];
            const [b, t] = [deckY + 1.6, deckY + 2.7];
            const q = [
              [m * x0, b, z0 + 0.1],
              [m * x1, b, z1 - 0.1],
              [m * x1, t, z1 - 0.1],
              [m * x0, t, z0 + 0.1],
            ];
            noseWindows.push(m > 0 ? q.reverse() : q);
          }
        const fw = houseHalf(saloonFront);
        for (let i = 0; i < 3; i++) {
          const pitch = (2 * fw - 0.6) / 3;
          const [x0, x1] = [-fw + 0.3 + i * pitch, -fw + 0.3 + (i + 1) * pitch - 0.25];
          noseWindows.push([
            [x0, deckY + 1.6, saloonFront + 0.01],
            [x1, deckY + 1.6, saloonFront + 0.01],
            [x1, deckY + 2.7, saloonFront + 0.01],
            [x0, deckY + 2.7, saloonFront + 0.01],
          ]);
        }
        quads(noseWindows, dark, 'saloon-front-windows');
        box(body, [saloonW + 0.16, 0.1, saloonLen + 0.16], [0, upper, saloonZ], cream, 'deck-edge');
        const ports = [];
        // Main-deck saloon windows under the deck edge.
        for (let i = 0; i < 9; i++) {
          const z = saloonZ - saloonLen / 2 + 1.1 + i * ((saloonLen - 2.2) / 8);
          const [x, y0, y1] = [saloonW / 2 + 0.01, upper - 1.0, upper - 0.3];
          ports.push(
            [
              [x, y0, z + 0.5],
              [x, y0, z - 0.5],
              [x, y1, z - 0.5],
              [x, y1, z + 0.5],
            ],
            [
              [-x, y0, z - 0.5],
              [-x, y0, z + 0.5],
              [-x, y1, z + 0.5],
              [-x, y1, z - 0.5],
            ],
          );
        }
        quads(ports, dark, 'saloon-windows');
        const aftEnd = -L * 0.44,
          aftFront = saloonZ - saloonLen / 2;
        cabin((aftEnd + aftFront) / 2, aftFront - aftEnd, W * 0.74, deckY, upper - deckY, {
          sill: 0.62,
          window: 0.56,
          spacing: 1.4,
          post: 0.55,
          core: true,
        });
        railing(
          [
            [W * 0.36, aftFront],
            [W * 0.36, aftEnd + 0.1],
            [-W * 0.36, aftEnd + 0.1],
            [-W * 0.36, aftFront],
          ],
          upper + 0.06,
        );
        for (const x of [-0.32, 0.32])
          box(body, [0.5, 0.45, 3.6], [x, upper + 0.29, (aftEnd + aftFront) / 2], deck, 'bench');
        hull.rings = [-1, 1].map((m) => [m * W * 0.37, upper + 0.7, -L * 0.3]);
        // A heavy rubbing strake round the hull at deck level.
        const strake = zs
          .filter((z) => hull.deckAt(z) > 0.2)
          .map((z) => [z, hull.sideAt(z, deckY).x + 0.08]);
        for (const m of [-1, 1])
          for (let k = 1; k < strake.length; k++) {
            const [[z0, x0], [z1, x1]] = [strake[k - 1], strake[k]];
            strut(
              [m * x0, deckY, z0 + rakeShift(z0, deckY)],
              [m * x1, deckY, z1 + rakeShift(z1, deckY)],
              0.24,
              dark,
              'rubbing-strake',
            );
          }
        const sternX = strake[0][1];
        strut([-sternX, deckY, -L / 2 - 0.06], [sternX, deckY, -L / 2 - 0.06], 0.24, dark);
        railing(
          [
            [saloonW / 2 - 0.05, aftFront + 0.1],
            [saloonW / 2 - 0.05, saloonZ + saloonLen / 2 - 0.1],
            [-saloonW / 2 + 0.05, saloonZ + saloonLen / 2 - 0.1],
            [-saloonW / 2 + 0.05, aftFront + 0.1],
          ],
          saloonTop + 0.1,
        );
        // Liferaft canisters in cradles at the saloon roof's aft corners.
        for (const m of [-1, 1]) {
          const raft = mesh(
            body,
            new T.CylinderGeometry(0.28, 0.28, 0.95, 8).rotateZ(Math.PI / 2),
            cream,
            'liferaft',
          );
          raft.position.set(m * (saloonW / 2 - 0.7), saloonTop + 0.42, aftFront + 0.9);
          box(
            body,
            [0.9, 0.16, 0.5],
            [m * (saloonW / 2 - 0.7), saloonTop + 0.16, aftFront + 0.9],
            metal,
          );
        }
        const front = eye[2] + 1.15,
          len = L * 0.26;
        cabin(front - len / 2, len, W * 0.66, saloonTop + 0.06, 2.35, {
          visor: 0.3,
          eave: 0.1,
          rake: 0.2,
          operatorWindow: 1.15,
          corner: 0.12,
          panes: 4,
          spacing: 1,
          post: 0.3,
        });
        funnel(-L * 0.06, L * 0.075, W * 0.18, saloonTop, saloonTop + 3.6);
        mast(front - len * 0.35, saloonTop + 2.5, mastTop, 0.8);
      }
    } else if (s.shape === 'sailboat') {
      // Modern cruising sloop: side decks and foredeck at the sheer around a low coachroof, the
      // cockpit well aft at deck level, a deck-stepped fractional rig with boom and two sails.
      const cockpitZ = -L * 0.12,
        houseFront = L * 0.18,
        side = 0.34;
      const yacht = [],
        walls = [];
      const yz = [...zs.filter((z) => Math.abs(z - cockpitZ) > 0.05), cockpitZ].sort(
        (a, b) => a - b,
      );
      for (let j = 0; j < yz.length - 1; j++) {
        const [z0, z1] = [yz[j], yz[j + 1]];
        const [w0, w1] = [Math.max(0, hull.deckAt(z0)), Math.max(0, hull.deckAt(z1))];
        const [s0, s1] = [sheerAt(z0) - 0.02, sheerAt(z1) - 0.02];
        const inner = (w) => (z0 >= cockpitZ - 1e-6 ? 0 : Math.max(0, w - side));
        const [i0, i1] = [inner(w0), inner(w1)];
        for (const m of [-1, 1]) {
          const q = [
            [m * i0, s0, z0],
            [m * w0, s0, z0],
            [m * w1, s1, z1],
            [m * i1, s1, z1],
          ];
          if (m < 0) q.reverse();
          yacht.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
          if (i0 > 0) {
            const wq = [
              [m * i0, deckY, z0],
              [m * i0, s0, z0],
              [m * i1, s1, z1],
              [m * i1, deckY, z1],
            ];
            if (m < 0) wq.reverse();
            walls.push(...wq[0], ...wq[2], ...wq[1], ...wq[0], ...wq[3], ...wq[2]);
          }
        }
      }
      const iw = Math.max(0, hull.deckAt(cockpitZ) - side),
        sy = sheerAt(cockpitZ) - 0.02;
      walls.push(-iw, deckY, cockpitZ, -iw, sy, cockpitZ, iw, sy, cockpitZ);
      walls.push(-iw, deckY, cockpitZ, iw, sy, cockpitZ, iw, deckY, cockpitZ);
      for (const [positions, mat] of [
        [yacht, deckMaterial],
        [walls, cream],
      ]) {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        mesh(body, geometry, mat, 'yacht-deck');
      }
      // Coachroof: a lofted trunk with long dark side windows and a raked front windscreen.
      const base = sheerAt(0) - 0.05;
      const front0 = houseFront - L * 0.06;
      loft(
        body,
        [
          [cockpitZ, W * 0.3, base, base + 0.44],
          [cockpitZ + L * 0.12, W * 0.31, base, base + 0.44],
          [front0, W * 0.26, base, base + 0.38],
          [houseFront, W * 0.17, base, base + 0.2],
        ],
        cream,
        'coachroof',
      );
      const screen = (t, x) => [x, base + 0.392 - 0.18 * t, front0 + (houseFront - front0) * t];
      const [near, far] = [W * 0.2, W * 0.13];
      quads(
        [[screen(0.15, near), screen(0.15, -near), screen(0.75, -far), screen(0.75, far)]],
        dark,
        'coachroof-windscreen',
      );
      for (const m of [-1, 1]) {
        // Coachroof glazing: a long dark band down each side, following the trunk's taper.
        const trunk = [
          [cockpitZ + 0.3, W * 0.3],
          [cockpitZ + L * 0.12, W * 0.31],
          [front0 - 0.05, W * 0.26],
        ];
        quads(
          trunk.slice(1).map(([z1, w1], k) => {
            const [z0, w0] = trunk[k];
            const [b, t] = [base + 0.18, base + 0.36];
            const q = [
              [m * (w0 + 0.01), b, z0],
              [m * (w1 + 0.01), b, z1],
              [m * (w1 + 0.01), t, z1],
              [m * (w0 + 0.01), t, z0],
            ];
            return m > 0 ? q.reverse() : q;
          }),
          dark,
          'coachroof-windows',
        );
        // Long hull ports in the topsides, laid on the flare.
        for (const [z, len] of [
          [L * 0.0, L * 0.12],
          [L * 0.15, L * 0.12],
        ]) {
          const y = sheerAt(z) - 0.32;
          const side = hull.sideAt(z, y);
          const port = box(body, [0.02, 0.13, len], [m * (side.x + 0.004), y, z], dark);
          port.rotation.z = -m * side.tilt;
        }
      }
      const mastZ = L * 0.07,
        boomY = base + 1.55;
      rod(body, [0, base + 0.3, mastZ], [0, mastTop, mastZ], 0.07, metal, 8);
      for (const f of [0.42, 0.68])
        rod(
          body,
          [-0.7, mastTop * f, mastZ - 0.15],
          [0.7, mastTop * f, mastZ - 0.15],
          0.025,
          metal,
          4,
        );
      const boomEnd = -L * 0.33;
      rod(body, [0, boomY, mastZ - 0.1], [0, boomY + 0.05, boomEnd], 0.06, metal, 8);
      // White sailcloth passes light: its shaded side still glows.
      const sailMat = material('sail-cloth', '#f2f0e8', 0, 0.75);
      sailMat.side = T.DoubleSide;
      sailMat.emissive.set('#6e6c66');
      const stemZ = L / 2 - 0.15,
        stemY = sheerAt(L / 2);
      // Sails set on one tack: each a cambered sheet from luff to leech, deepest forward of
      // the middle and flattening toward the head, so the cloth shades across its belly.
      const positions = [],
        indices = [];
      const sheet = (tack, head, clew, depth, roach = 0) => {
        const first = positions.length / 3;
        for (let r = 0; r <= 4; r++) {
          const v = r / 4;
          const luff = tack.map((t, i) => t + (head[i] - t) * v);
          // A roach curves the leech aft of the straight line from clew to head.
          const leech = clew.map((c, i) => c + (head[i] - c) * v);
          leech[2] -= roach * Math.sin(Math.PI * v);
          const chord = Math.hypot(leech[1] - luff[1], leech[2] - luff[2]);
          for (let c = 0; c <= 3; c++) {
            const u = c / 3;
            const p = luff.map((l, i) => l + (leech[i] - l) * u);
            p[0] +=
              depth *
              chord *
              4 *
              u *
              (1 - u) *
              (1 - 0.3 * u) *
              (0.45 + 0.55 * Math.sin(Math.PI * v));
            positions.push(...p);
          }
        }
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 3; c++) {
            const a = first + r * 4 + c;
            indices.push(a, a + 1, a + 5, a, a + 5, a + 4);
          }
      };
      // Mainsail: head near the masthead, tack at the gooseneck, clew at the boom end.
      sheet(
        [0.03, boomY + 0.1, mastZ - 0.08],
        [0.03, mastTop * 0.95, mastZ - 0.08],
        [0.03, boomY + 0.1, boomEnd + 0.3],
        0.1,
        0.55,
      );
      // Self-tacking jib: head on the forestay, tack at the stem, clew by the mast.
      sheet(
        [-0.03, stemY + 0.5, stemZ - 0.25],
        [-0.03, mastTop * 0.8, mastZ + (stemZ - mastZ) * 0.06],
        [-0.03, stemY + 1.05, mastZ + 0.35],
        0.12,
      );
      const sail = new T.BufferGeometry();
      sail.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      sail.setIndex(indices);
      sail.computeVertexNormals();
      mesh(body, sail, sailMat, 'mainsail');
      // Sprayhood over the companionway: a canvas hood with a clear front, open aft.
      const canvas = material('canvas', '#c2ae8a', 0, 0.85);
      const roofTop = base + 0.44,
        hoodZ = cockpitZ + 1.05,
        hood = [
          [hoodZ, 0],
          [hoodZ - 0.18, 0.36],
          [hoodZ - 0.5, 0.58],
          [cockpitZ - 0.12, 0.64],
        ].map(([z, h]) => [z, roofTop + h]);
      const hw = (h) => W * 0.29 - (h - roofTop) * 0.12;
      const across = (k) => [
        [-hw(hood[k][1]), hood[k][1], hood[k][0]],
        [hw(hood[k][1]), hood[k][1], hood[k][0]],
      ];
      quads([[...across(0), ...across(1).reverse()]], glass, 'sprayhood-window');
      const cloth = [
        [...across(1), ...across(2).reverse()],
        [...across(2), ...across(3).reverse()],
      ];
      for (const m of [-1, 1]) {
        const foot = [m * hw(roofTop), roofTop, cockpitZ - 0.12];
        for (let k = 0; k < 3; k++)
          cloth.push([
            foot,
            [m * hw(hood[k][1]), hood[k][1], hood[k][0]],
            [m * hw(hood[k + 1][1]), hood[k + 1][1], hood[k + 1][0]],
          ]);
      }
      quads(cloth, canvas, 'sprayhood', true);
      // Bimini over the cockpit on two stainless hoops, clear of the boom.
      const biminiY = boomY - 0.32,
        bimini = [cockpitZ - 0.3, -L * 0.37];
      const crown = [-1, -0.5, 0.5, 1].map((t) => [t * W * 0.36, biminiY - Math.abs(t) * 0.1]);
      const canopy = [];
      for (let k = 1; k < crown.length; k++) {
        const [[x0, y0], [x1, y1]] = [crown[k - 1], crown[k]];
        canopy.push([
          [x0, y0, bimini[0]],
          [x1, y1, bimini[0]],
          [x1, y1, bimini[1]],
          [x0, y0, bimini[1]],
        ]);
      }
      quads(canopy, canvas, 'bimini', true);
      for (const z of bimini)
        for (const m of [-1, 1])
          rod(
            body,
            [m * (hull.deckAt(z) - 0.12), sheerAt(z), z],
            [m * W * 0.36, biminiY - 0.1, z],
            0.016,
            metal,
            4,
          );
      // Drop-down swim platform hinged at the foot of the transom: a moulded step with a teak top.
      box(body, [W * 0.6, 0.12, 0.5], [0, 0.26, -L / 2 - 0.24], cream, 'swim-platform');
      box(body, [W * 0.58, 0.02, 0.46], [0, 0.33, -L / 2 - 0.25], deckMaterial);
      // Lifelines on stanchions round the side decks, with a pulpit and pushpit at the ends.
      const lifeZ = Array.from({ length: 7 }, (_, k) => -L * 0.46 + (k * L * 0.86) / 6);
      for (const m of [-1, 1]) {
        const top = lifeZ.map((z) => [m * (hull.deckAt(z) - 0.06), sheerAt(z) + 0.62, z]);
        for (let k = 0; k < top.length; k++) {
          const [x, y, z] = top[k];
          rod(body, [x, y - 0.62, z], [x, y, z], 0.014, metal, 4);
          if (k) {
            rod(body, top[k - 1], top[k], 0.006, metal, 4);
            rod(
              body,
              [top[k - 1][0], top[k - 1][1] - 0.3, top[k - 1][2]],
              [x, y - 0.3, z],
              0.006,
              metal,
              4,
            );
          }
        }
        rod(body, top.at(-1), [0, sheerAt(L / 2) + 0.62, L / 2 - 0.3], 0.014, metal, 4);
      }
      rod(
        body,
        [-hull.deckAt(-L * 0.46) + 0.06, sheerAt(-L * 0.46) + 0.62, -L * 0.46],
        [hull.deckAt(-L * 0.46) - 0.06, sheerAt(-L * 0.46) + 0.62, -L * 0.46],
        0.014,
        metal,
        4,
      );
    } else if (s.shape === 'speedboat') {
      // Outboard bowrider: cushioned bow seating round the forward cockpit under a crowned
      // foredeck, the deck moulding's broad gunwales wrapping round it, a tinted windscreen sweeping
      // in one arc across the walk-through door back to the side decks on a black frame, twin
      // consoles with helm seats, a stern bench under a sun pad and an outboard on the transom.
      const eye = s.driverEye;
      s = { ...s, helmFloor: deckY + 0.025 };
      // A low screen, 0.55 m above the deck moulding and raked 60 degrees: the helm looks over it.
      const screenZ = eye[2] + 1.5,
        rake = 1.05,
        wrap = 0.7;
      const sheer = sheerAt(screenZ);
      const screenH = 0.55 / Math.cos(rake);
      const lift = [0, screenH * Math.cos(rake), -screenH * Math.sin(rake)];
      const up = (p) => p.map((v, i) => v + lift[i]);
      const walk = 0.27;
      // The walk-through door closes the arc at the centre.
      const door = [
        [-walk, sheer - 0.02, screenZ],
        [walk, sheer - 0.02, screenZ],
      ];
      quads([[door[0], door[1], up(door[1]), up(door[0])]], glass, 'windscreen');
      strut(up(door[0]), up(door[1]), 0.025, dark);
      for (const m of [-1, 1]) {
        const outer = hull.deckAt(screenZ - wrap) - 0.07;
        // Plan curve from the walk-through round to the side deck.
        const curve = [0, 0.3, 0.55, 0.8, 1].map((t) => {
          const a = (t * Math.PI) / 2;
          const z = screenZ - wrap * (1 - Math.cos(a));
          return [m * (walk + (outer - walk) * Math.sin(a)), sheerAt(z) - 0.02, z];
        });
        quads(
          curve.slice(1).map((b, k) => [curve[k], b, up(b), up(curve[k])]),
          glass,
          'windscreen',
        );
        for (let k = 1; k < curve.length; k++) {
          strut(up(curve[k - 1]), up(curve[k]), 0.03, dark);
          strut(curve[k - 1], curve[k], 0.04, dark);
        }
        for (const p of [curve[0], curve.at(-1)]) strut(p, up(p), 0.028, dark);
        // Console behind each half of the screen, inside the liner where it closes in at the sole.
        const side = Math.min(outer, topsideHalf(screenZ + 0.1, deckY) - inset - 0.03);
        box(
          body,
          [Math.max(0.3, side - walk - 0.1), sheer - deckY - 0.05, 0.75],
          [(m * (walk + side)) / 2, (sheer + deckY) / 2 - 0.02, screenZ - 0.45],
          cream,
          'console',
        );
      }
      // The helm's own seat comes with its dashboard; the passenger's mirrors it.
      const [px, ez] = [-eye[0], eye[2]];
      box(body, [0.54, 0.1, 0.48], [px, eye[1] - 0.66, ez - 0.05], cream, 'seat');
      box(body, [0.54, 0.38, 0.08], [px, eye[1] - 0.43, ez - 0.27], cream, 'seat');
      box(
        body,
        [0.16, eye[1] - 0.71 - deckY, 0.16],
        [px, (eye[1] - 0.71 + deckY) / 2, ez - 0.05],
        metal,
      );
      // Bow seating: cushions along both sides meeting in the bow, under a short foredeck. Bow
      // stations follow the raked stem like the hull.
      const raked = (list) => list.map((q) => q.map(([x, y, z]) => [x, y, z + rakeShift(z, y)]));
      const seatTop = deckY + 0.36,
        bowZ = [0.08, 0.15, 0.22, 0.29, 0.35, 0.39, 0.42].map((f) => L * f);
      for (const m of [-1, 1]) {
        // Outer edges lie on the flared liner: narrower at the sole than at the cushion tops.
        const edge = bowZ.map((z) => {
          const out = topsideHalf(z, seatTop) - inset - 0.04;
          return [m * out, m * Math.max(0, out - 0.42), z];
        });
        const cushions = [];
        for (let k = 1; k < edge.length; k++) {
          const [[o0, i0, z0], [o1, i1, z1]] = [edge[k - 1], edge[k]];
          const top = [
            [i0, seatTop, z0],
            [o0, seatTop, z0],
            [o1, seatTop, z1],
            [i1, seatTop, z1],
          ];
          const face = [
            [i1, deckY, z1],
            [i0, deckY, z0],
            [i0, seatTop, z0],
            [i1, seatTop, z1],
          ];
          cushions.push(m > 0 ? top.reverse() : top, m > 0 ? face.reverse() : face);
        }
        const [o, i, z] = edge[0];
        const end = [
          [i, deckY, z],
          [m * (topsideHalf(z, deckY) - inset - 0.04), deckY, z],
          [o, seatTop, z],
          [i, seatTop, z],
        ];
        cushions.push(m > 0 ? end.reverse() : end);
        quads(raked(cushions), cream, 'bow-seat');
      }
      // Crowned foredeck from the cushions to the stem, its edge rolling into the gunwales.
      const fore = [0.42, 0.45, 0.48].map((f) => L * f);
      fore.push(L / 2 - 0.04);
      const crown = (z, x) => sheerAt(z) + 0.01 + 0.07 * (1 - x * x);
      const foredeck = [];
      for (let k = 1; k < fore.length; k++)
        for (const [x0, x1] of [
          [-1, -0.5],
          [-0.5, 0],
          [0, 0.5],
          [0.5, 1],
        ]) {
          const at = (z, x) => [x * hull.deckAt(z), crown(z, x), z];
          foredeck.push([
            at(fore[k - 1], x0),
            at(fore[k], x0),
            at(fore[k], x1),
            at(fore[k - 1], x1),
          ]);
        }
      const [fw, fz] = [hull.deckAt(fore[0]) - 0.02, fore[0]];
      foredeck.push([
        [fw, deckY, fz],
        [-fw, deckY, fz],
        [-fw, crown(fz, 1), fz],
        [fw, crown(fz, 1), fz],
      ]);
      quads(raked(foredeck), cream, 'foredeck');
      // Stern bench under a sun pad of three cushions flush with the gunwale.
      const stern = sheerAt(-L / 2);
      box(body, [W * 0.76, 0.4, 0.5], [0, deckY + 0.2, -L * 0.37], cream, 'stern-bench');
      box(body, [W * 0.8, stern - deckY, 0.55], [0, (stern + deckY) / 2, -L * 0.44], cream);
      for (const x of [-1, 0, 1])
        box(body, [W * 0.26, 0.1, 0.5], [x * W * 0.268, stern + 0.05, -L * 0.44], cream, 'sun-pad');
      // Short, low bow rails at the stem.
      for (const m of [-1, 1]) {
        const pts = [L * 0.36, L * 0.44].map((z) => [
          m * (hull.deckAt(z) - 0.05),
          sheerAt(z) + 0.14,
          z,
        ]);
        pts.push([0, sheerAt(L / 2) + 0.14, L / 2 - 0.12]);
        for (let k = 0; k < pts.length; k++) {
          if (k < pts.length - 1)
            rod(body, [pts[k][0], pts[k][1] - 0.14, pts[k][2]], pts[k], 0.012, metal, 4);
          if (k) rod(body, pts[k - 1], pts[k], 0.014, metal, 6);
        }
      }
      // Broad moulded gunwales from the transom to the foredeck, with a rolled inner lip over the
      // cockpit liner.
      const gunwale = [...zs.filter((z) => z > -L / 2 + 0.2 && z < fore[0]), fore[0]];
      const lips = [];
      for (const m of [-1, 1])
        for (let k = 1; k < gunwale.length; k++) {
          const [z0, z1] = [gunwale[k - 1], gunwale[k]];
          const [o0, o1] = [hull.deckAt(z0) + 0.03, hull.deckAt(z1) + 0.03];
          const [i0, i1] = [Math.max(0, o0 - 0.24), Math.max(0, o1 - 0.24)];
          const [y0, y1] = [sheerAt(z0) + 0.01, sheerAt(z1) + 0.01];
          const top = [
            [m * i0, y0, z0],
            [m * o0, y0, z0],
            [m * o1, y1, z1],
            [m * i1, y1, z1],
          ];
          const lip = [
            [m * i1, y1 - 0.07, z1],
            [m * i0, y0 - 0.07, z0],
            [m * i0, y0, z0],
            [m * i1, y1, z1],
          ];
          lips.push(m > 0 ? top.reverse() : top, m > 0 ? lip.reverse() : lip);
        }
      quads(lips, cream, 'gunwale');
      // Black rub rail along the sheer.
      const onSide = (m, z, y) => [m * (hull.sideAt(z, y).x + 0.02), y, z + rakeShift(z, y)];
      for (const m of [-1, 1]) {
        const rub = zs
          .filter((z) => hull.deckAt(z) > 0.05)
          .map((z) => onSide(m, z, sheerAt(z) - 0.035));
        for (let k = 1; k < rub.length; k++) strut(rub[k - 1], rub[k], 0.05, dark);
      }
      // Outboard: cowl over the powerhead, midsection leg, cavitation plate, gearcase and skeg.
      const mount = -L / 2 - 0.18;
      const top = sheerAt(-L / 2) + 0.05;
      // Rounded cowl: an oval pill, deeper fore and aft than across, on a lower pan.
      const cowl = mesh(body, new T.CapsuleGeometry(0.2, 0.22, 3, 10), dark, 'outboard');
      cowl.scale.set(1.05, 1, 1.35);
      cowl.position.set(0, top + 0.2, mount - 0.13);
      box(body, [0.36, 0.14, 0.5], [0, top - 0.04, mount - 0.1], dark);
      const plate = -hullDraft * 0.85;
      box(body, [0.13, top - 0.1 - plate, 0.26], [0, (top - 0.1 + plate) / 2, mount - 0.06], dark);
      box(body, [0.34, 0.025, 0.42], [0, plate, mount - 0.05], dark);
      const gear = mesh(
        body,
        new T.CylinderGeometry(0.075, 0.075, 0.42, 8).rotateX(Math.PI / 2),
        dark,
      );
      gear.position.set(0, plate - 0.17, mount - 0.08);
      box(body, [0.03, 0.2, 0.2], [0, plate - 0.3, mount - 0.04], dark);
      for (let k = 0; k < 3; k++) {
        const blade = mesh(body, new T.BoxGeometry(0.1, 0.16, 0.015), metal);
        const a = (k * Math.PI * 2) / 3;
        blade.position.set(Math.sin(a) * 0.09, plate - 0.17 + Math.cos(a) * 0.09, mount - 0.31);
        blade.rotation.set(0.4, 0, -a, 'ZXY');
      }
      // Swim platforms moulded onto the transom either side of the motor, with teak tops.
      for (const m of [-1, 1]) {
        const x = m * W * 0.2;
        box(body, [W * 0.28, 0.16, 0.6], [x, 0.26, -L / 2 - 0.3], cream, 'swim-platform');
        box(body, [W * 0.26, 0.02, 0.56], [x, 0.35, -L / 2 - 0.31], deckMaterial);
      }
    } else if (s.shape === 'tugboat') {
      // Harbour tug: a deckhouse on the raised foredeck under a narrower upper level, the
      // wheelhouse glazed all round on top, mast and twin stacks behind, heavy bow and stern
      // fenders, towing gear on the low aft deck.
      const eye = s.driverEye;
      const floor = eye[1] - 1.15;
      const front = eye[2] + 1.15;
      const houseFront = Math.max(front + 0.6, L * 0.25),
        houseAft = -L * 0.11;
      const houseTop = Math.min(floor - 0.6, deckYAt(houseFront) + 2.5);
      box(
        body,
        [W * 0.66, houseTop - deckY, houseFront - houseAft],
        [0, (houseTop + deckY) / 2, (houseFront + houseAft) / 2],
        cream,
        'deckhouse',
      );
      const whLen = 3.9,
        upperAft = front - whLen - 1.6;
      box(
        body,
        [W * 0.5, floor - 0.06 - houseTop, front - upperAft],
        [0, (floor - 0.06 + houseTop) / 2, (front + upperAft) / 2],
        cream,
        'upper-house',
      );
      // Portholes along the deckhouse, small windows in the upper level.
      for (const m of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const port = mesh(body, new T.CylinderGeometry(0.2, 0.2, 0.06, 10), dark, 'porthole');
          port.rotation.z = Math.PI / 2;
          port.position.set(m * (W * 0.33 + 0.02), houseTop - 1, houseAft + 1 + i * 1.9);
        }
        for (let i = 0; i < 2; i++)
          box(
            body,
            [0.06, 0.4, 0.8],
            [m * (W * 0.25 + 0.02), (houseTop + floor) / 2, upperAft + 1 + i * 1.6],
            dark,
          );
      }
      box(body, [0.9, 1.7, 0.06], [W * 0.18, deckY + 0.95, houseAft - 0.02], dark);
      // Wheelhouse glazed all round for towing astern, its windows leaning out at the top.
      cabin(front - whLen / 2, whLen, W * 0.68, floor, 2.5, {
        visor: 0.4,
        eave: 0.12,
        rake: 0.45,
        flare: 0.24,
        corner: 0.13,
        panes: 4,
        spacing: 0.9,
      });
      const roof = floor + 2.6;
      mast(front - whLen * 0.75, roof, mastTop, 1.1);
      // Rail round the wheelhouse top.
      railing(
        [
          [W * 0.36, front + 0.2],
          [W * 0.36, front - whLen],
          [-W * 0.36, front - whLen],
          [-W * 0.36, front + 0.2],
          [W * 0.36, front + 0.2],
        ],
        roof,
        0.85,
        0.045,
      );
      // Radar scanner on the mast; a railed walkway round the deckhouse top.
      box(
        body,
        [1.7, 0.12, 0.28],
        [0, roof + (mastTop - roof) * 0.42, front - whLen * 0.75 + 0.2],
        dark,
      );
      railing(
        [
          [W * 0.32, houseAft + 0.1],
          [W * 0.32, houseFront - 0.1],
          [-W * 0.32, houseFront - 0.1],
          [-W * 0.32, houseAft + 0.1],
          [W * 0.32, houseAft + 0.1],
        ],
        houseTop,
        0.9,
        0.045,
      );
      // Twin oval exhaust stacks raked aft, rising from a casing on the deckhouse top.
      const stackZ = front - whLen - 0.7;
      box(body, [2.5, 0.8, 1.1], [0, floor + 0.4, stackZ], cream, 'stack-casing');
      for (const x of [-0.85, 0.85]) {
        const stack = mesh(body, new T.CylinderGeometry(0.3, 0.34, 2.6, 10), dark, 'exhaust');
        stack.scale.z = 1.45;
        stack.position.set(x, floor + 1.0, stackZ - 0.1);
        stack.rotation.x = -0.12;
      }
      // Fenders: a heavy cylindrical bow fender round the stem, a belt along the sheer and tires.
      for (const m of [-1, 1]) {
        const bow = zs
          .filter((z) => z > L * 0.18 && hull.deckAt(z) > 0.05)
          .map((z) => [m * (hull.deckAt(z) + 0.2), sheerAt(z) + 0.1, z]);
        bow.push([0, sheerAt(L / 2) + 0.1, L / 2 + 0.3]);
        for (let j = 1; j < bow.length; j++) rod(body, bow[j - 1], bow[j], 0.42, dark, 8);
        const belt = zs
          .filter((z) => hull.deckAt(z) > 0.3 && z <= L * 0.2)
          .map((z) => [m * (hull.sideAt(z, deckY * 0.6).x + 0.1), deckY * 0.6, z]);
        for (let j = 1; j < belt.length; j++) rod(body, belt[j - 1], belt[j], 0.16, dark, 6);
        // A row of tyres hung from the bulwark along the topsides, laid on the hull's flare.
        for (let k = 0; k < 11; k++) {
          const z = -L * 0.43 + k * L * 0.062;
          const y = sheerAt(z) - 0.45;
          const side = hull.sideAt(z, y);
          const tire = mesh(body, new T.TorusGeometry(0.28, 0.11, 4, 10), dark, 'fender');
          tire.rotation.set(0, (m * Math.PI) / 2, -m * side.tilt, 'ZYX');
          tire.position.set(m * (side.x + 0.12), y, z);
        }
      }
      const sternRail = [-1, -0.6, -0.2, 0.2, 0.6, 1].map((f) => [
        f * hull.deckAt(-L / 2) * 0.95,
        sheerAt(-L / 2) - 0.25,
        -L / 2 - 0.25,
      ]);
      for (let j = 1; j < sternRail.length; j++)
        rod(body, sternRail[j - 1], sternRail[j], 0.32, dark, 8);
      // Towing winch behind the deckhouse, the line led aft through a staple (an arched pipe
      // frame) to an H-bitt; anchor winch on the foredeck.
      const winchZ = houseAft - 1.1;
      for (const x of [-1, 1]) box(body, [0.12, 1.1, 1.0], [x * 1.05, deckY + 0.55, winchZ], paint);
      const towDrum = mesh(
        body,
        new T.CylinderGeometry(0.45, 0.45, 1.9, 10).rotateZ(Math.PI / 2),
        dark,
        'tow-winch',
      );
      towDrum.position.set(0, deckY + 0.75, winchZ);
      const stapleZ = -L * 0.36;
      for (const x of [-1, 1])
        rod(
          body,
          [x * 1.3, deckY, stapleZ],
          [x * 1.0, deckY + 1.9, stapleZ + 0.15],
          0.17,
          paint,
          8,
        );
      rod(
        body,
        [-1.0, deckY + 1.9, stapleZ + 0.15],
        [1.0, deckY + 1.9, stapleZ + 0.15],
        0.17,
        paint,
        8,
      );
      rod(body, [-0.6, deckY, -L * 0.25], [-0.6, deckY + 1, -L * 0.25], 0.14, metal, 8);
      rod(body, [0.6, deckY, -L * 0.25], [0.6, deckY + 1, -L * 0.25], 0.14, metal, 8);
      rod(body, [-0.75, deckY + 0.85, -L * 0.25], [0.75, deckY + 0.85, -L * 0.25], 0.1, metal, 8);
      const fy = deckYAt(L * 0.35);
      box(body, [1.6, 0.5, 0.7], [0, fy + 0.25, L * 0.32], dark, 'winch');
      const drum = mesh(
        body,
        new T.CylinderGeometry(0.32, 0.32, 1.1, 10).rotateZ(Math.PI / 2),
        metal,
      );
      drum.position.set(0, fy + 0.62, L * 0.32);
    } else {
      // Inshore fishing boat: wheelhouse amidships with a raked front, mast on its roof, net
      // drum and stern gantry over the working deck aft.
      const eye = s.driverEye;
      const front = eye[2] + 1.15,
        len = 2.7;
      const floor = eye[1] - 1.15;
      // A working wheelhouse narrower than the beam: three front windows leaning out under a short
      // visor, glazed sides with a plated aft corner for the door, three windows over the deck aft.
      cabin(front - len / 2, len, W * 0.63, deckY, floor + 2 - deckY, {
        visor: 0.16,
        eave: 0.05,
        rake: 0.35,
        aftSolid: 0.32,
        corner: 0.09,
        panes: 3,
        operatorWindow: 0.95,
      });
      const roof = floor + 2.1;
      const back = front - len - 0.03;
      for (const x of [-W * 0.19, 0, W * 0.19])
        box(body, [0.62, 0.55, 0.03], [x, floor + 1.3, back], dark, 'wheelhouse-window');
      box(body, [0.03, 1.75, 0.62], [-W * 0.315 - 0.02, deckY + 0.95, back + 0.5], dark, 'door');
      const mastZ = front - len * 0.3;
      mast(mastZ, roof, mastTop, 0.8);
      // Light bar with work lamps and whip aerials on the wheelhouse roof.
      box(body, [W * 0.5, 0.08, 0.08], [0, roof + 0.55, front - len + 0.3], metal, 'light-bar');
      for (const x of [-W * 0.2, W * 0.2]) {
        rod(
          body,
          [x, roof, front - len + 0.3],
          [x, roof + 0.55, front - len + 0.3],
          0.03,
          metal,
          4,
        );
        box(body, [0.2, 0.16, 0.12], [x * 0.6, roof + 0.66, front - len + 0.3], light);
        rod(
          body,
          [x * 1.1, roof, front - len + 0.6],
          [x * 1.1, roof + 2.2, front - len + 0.6],
          0.012,
          dark,
          4,
        );
      }
      // Radar dome on a short pedestal at the front of the wheelhouse roof.
      const dome = mesh(body, new T.CylinderGeometry(0.3, 0.32, 0.24, 10), cream, 'radome');
      dome.position.set(0, roof + 0.36, front - 0.45);
      rod(body, [0, roof, front - 0.45], [0, roof + 0.25, front - 0.45], 0.05, metal, 6);
      // Derrick boom from the mast over the working deck, held by a topping lift.
      const heel = [0, roof + 0.9, mastZ - 0.1],
        head = [0, roof + 0.25, -L * 0.27];
      rod(body, heel, head, 0.07, metal, 6);
      box(body, [0.22, 0.3, 0.3], [0, heel[1], heel[2] + 0.05], metal, 'gooseneck');
      rod(body, [0, mastTop - 0.4, mastZ], head, 0.018, dark, 4);
      // Stern A-frame gantry of box-section legs and crosshead.
      const gantryZ = -L * 0.44;
      for (const m of [-1, 1])
        strut(
          [m * (hull.deckAt(gantryZ) - 0.1), sheerAt(gantryZ), gantryZ],
          [m * 0.6, roof + 0.3, gantryZ - 0.15],
          0.22,
          metal,
          'gantry',
        );
      strut([-0.75, roof + 0.3, gantryZ - 0.15], [0.75, roof + 0.3, gantryZ - 0.15], 0.24, metal);
      // A dark rubbing strake along the sheer.
      for (const m of [-1, 1]) {
        const band = zs
          .filter((z) => hull.deckAt(z) > 0.05)
          .map((z) => {
            const y = sheerAt(z) - 0.14;
            return [m * (hull.sideAt(z, y).x + 0.04), y, z + rakeShift(z, y)];
          });
        for (let k = 1; k < band.length; k++)
          strut(band[k - 1], band[k], 0.1, dark, 'rubbing-strake');
      }
      const drum = mesh(
        body,
        new T.CylinderGeometry(0.42, 0.42, W * 0.5, 12).rotateZ(Math.PI / 2),
        dark,
        'net-drum',
      );
      drum.position.set(0, deckY + 0.75, -L * 0.3);
      for (const m of [-1, 1])
        box(body, [0.1, 0.8, 0.5], [m * W * 0.27, deckY + 0.4, -L * 0.3], metal);
    }
    if (!['sailboat', 'speedboat'].includes(s.shape)) {
      // Guard rails stand on the bulwark cap and follow the deck edge into the bow.
      const railH = big ? 1.1 : 0.55;
      for (const side of [-1, 1]) {
        const stations = Array.from({ length: 8 }, (_, k) => -L * 0.4 + k * L * 0.105);
        const top = stations.map((z) => [
          side * (hull.deckAt(z) - 0.02),
          hull.sheerAt(z) + railH,
          z,
        ]);
        for (let k = 1; k < top.length; k++)
          rod(body, top[k - 1], top[k], big ? 0.065 : 0.025, cream);
        for (const [x, y, z] of top)
          rod(body, [x, hull.sheerAt(z), z], [x, y, z], big ? 0.05 : 0.02, cream, 4);
      }
    }
  }
  // Merge static pieces by material within each group, preserving wheel pivots and their spin child.
  function consolidate(g) {
    const buckets = new Map();
    for (const child of [...g.children]) {
      if (!child.isMesh) {
        consolidate(child);
        continue;
      }
      child.updateMatrix();
      let geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      geo = geo.applyMatrix4(child.matrix);
      geo.deleteAttribute('uv');
      const list = buckets.get(child.material) ?? [];
      list.push(geo);
      buckets.set(child.material, list);
      g.remove(child);
    }
    for (const [m, geometries] of buckets) {
      const merged = mergeGeometries(geometries);
      if (!merged) throw new Error(`Incompatible geometry for ${m.name}`);
      mesh(g, merged, m, `${g.name}-${m.name}`);
      for (const geo of geometries) geo.dispose();
    }
  }
  consolidate(root);
  if (s.family === 'car') addCarDetail(root, s);
  else if (s.family === 'bicycle' || s.family === 'motorcycle') addCycleDetail(root, s);
  else addBoatDetail(root, { ...s, hull });
  return root;
}
