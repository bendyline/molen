/** Shared hard-surface authoring capability for the fleet's self-contained JSON recipes. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepareSurface } from './surface-normals.mjs';
import { addBoatDetail, addCarDetail, addCycleDetail } from './vehicle-detail.mjs';

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
    const bike = s.family === 'bicycle';
    const scooter = s.shape === 'motor-scooter';
    const r = s.wheelRadius;
    const wb = s.wheelbase;
    const back = [0, r, -wb / 2];
    const front = [0, r, wb / 2];
    const crank = [0, r * 0.85, -wb * 0.1];
    const saddle = [0, H * 0.78, -wb * 0.18];
    // A road frame's taller head tube keeps its drop bars on a short stem.
    const neck = [
      0,
      H * (s.shape === 'road-bicycle' ? 0.88 : 0.78),
      wb * (s.shape === 'cargo-bicycle' ? -0.05 : 0.34),
    ];
    const radius = bike ? 0.018 : 0.035;
    wheel('wheel-front', 0, front[2], r, bike ? 0.06 : 0.16, bike);
    wheel('wheel-rear', 0, back[2], r, bike ? 0.06 : 0.2, bike);
    if (bike) {
      // Diamond frame; the seat tube stops below the saddle and a seat post carries it.
      const seatTop = crank.map((v, i) => v + (saddle[i] - v) * 0.78);
      for (const [a, b] of [
        [back, seatTop],
        [back, crank],
        [crank, seatTop],
        [crank, neck],
        [seatTop, neck],
      ])
        rod(body, a, b, radius, paint);
      rod(body, seatTop, saddle, radius * 0.7, metal);
    } else if (!scooter) {
      // Motorcycle chassis under the tank: backbone and down tube from the steering head, a
      // swingarm from behind the engine to the rear axle, twin shocks and a seat subframe.
      const pivot = [0, r * 1.1, -wb * 0.14];
      rod(body, neck, [0, H * 0.64, -wb * 0.14], radius * 0.8, dark);
      rod(body, neck, [0, r * 0.95, wb * 0.12], radius * 0.8, dark);
      for (const x of [-0.12, 0.12]) {
        rod(body, [x, pivot[1], pivot[2]], [x, r, back[2]], 0.032, dark);
        rod(body, [x, r * 1.3, back[2] + 0.1], [x, H * 0.67, -wb * 0.34], 0.03, metal);
        rod(body, [x, H * 0.64, -wb * 0.14], [x, H * 0.69, -wb * 0.5], 0.02, dark);
        // Short uprights tie the padded saddle to the subframe instead of leaving it afloat.
        for (const z of [saddle[2] - 0.23, saddle[2] + 0.08]) {
          rod(body, [x, H * 0.65, z], [x, saddle[1] - 0.035, z], 0.018, dark);
        }
        rod(
          body,
          [x, saddle[1] - 0.035, saddle[2] - 0.28],
          [x, saddle[1] - 0.035, saddle[2] + 0.12],
          0.018,
          dark,
        );
      }
    }
    if (s.shape === 'cargo-bicycle') {
      // Long-john steering links run beneath/beside the box, leaving its load space clear.
      const forkTop = [0, r + 0.19, front[2] - 0.06];
      rod(body, neck, [0, r * 0.85, neck[2]], radius, paint);
      const forwardBeam = [0, r * 0.85, forkTop[2]];
      rod(body, [0, r * 0.85, neck[2]], forwardBeam, radius * 1.2, paint);
      rod(body, forwardBeam, forkTop, radius * 1.2, paint);
      for (const x of [-0.055, 0.055])
        rod(body, [x, r, front[2]], [x, forkTop[1], forkTop[2]], radius * 0.8, metal);
      rod(body, [-0.31, r * 1.05, neck[2]], [-0.31, r * 1.05, forkTop[2]], 0.009, metal);
      rod(body, [-0.31, r * 1.05, forkTop[2]], forkTop, 0.009, metal);
    } else if (!scooter)
      for (const x of [-0.1, 0.1])
        rod(body, [x, r, front[2]], [x, neck[1], neck[2]], radius * 0.8, metal);
    rod(body, neck, [0, H * 0.96, neck[2] - 0.04], radius, metal);
    const handlebar = new T.Group();
    handlebar.name = 'handlebar';
    handlebar.position.set(0, H * 0.96, neck[2]);
    root.add(handlebar);
    const sweep = s.handlebarSweep ?? 0;
    const barRadius = bike ? 0.012 : 0.014;
    if (sweep > 0) rod(handlebar, [0, 0, 0], [0, 0, -sweep], barRadius, metal);
    rod(handlebar, [-W / 2, 0, -sweep], [W / 2, 0, -sweep], barRadius, metal);
    for (const side of [-1, 1])
      rod(handlebar, [side * W * 0.34, 0, -sweep], [side * W * 0.49, 0, -sweep], 0.018, dark, 12);
    // Saddles taper from a broad rear to a narrow nose instead of being a flat block.
    const [, sy, sz] = saddle;
    if (bike)
      loft(
        body,
        [
          [sz - 0.13, 0.085, sy - 0.025, sy + 0.03],
          [sz - 0.03, 0.06, sy - 0.025, sy + 0.028],
          [sz + 0.13, 0.022, sy - 0.02, sy + 0.018],
        ],
        dark,
        'saddle',
      );
    else if (!scooter)
      loft(
        body,
        [
          [sz - 0.34, 0.13, sy - 0.04, sy + 0.03],
          [sz - 0.12, 0.17, sy - 0.045, sy + 0.045],
          [sz + 0.1, 0.16, sy - 0.045, sy + 0.04],
          [sz + 0.27, 0.1, sy - 0.04, sy + 0.02],
        ],
        dark,
        'saddle',
      );
    if (bike) {
      const pedals = new T.Group();
      pedals.name = 'pedal-crank';
      pedals.position.set(...crank);
      root.add(pedals);
      rod(pedals, [-0.13, 0, 0], [0.13, 0, 0], 0.018, metal);
      for (const side of [-1, 1]) {
        rod(pedals, [side * 0.13, 0, 0], [side * 0.13, side * 0.14, 0], 0.018, metal);
        const pedal = new T.Group();
        pedal.name = side > 0 ? 'pedal-left' : 'pedal-right';
        pedal.position.set(side * 0.18, side * 0.14, 0);
        pedals.add(pedal);
        box(pedal, [0.12, 0.025, 0.14], [0, 0, 0], dark);
      }
      if (s.shape === 'city-bicycle') {
        box(body, [0.35, 0.03, 0.45], [0, H * 0.7, back[2]], metal);
        for (const side of [-1, 1]) {
          rod(
            body,
            [side * 0.09, r, back[2]],
            [side * 0.15, H * 0.7, back[2] - 0.14],
            0.009,
            metal,
          );
          rod(
            body,
            [side * 0.15, H * 0.7, back[2] + 0.17],
            [side * 0.04, saddle[1] - 0.12, saddle[2]],
            0.009,
            metal,
          );
        }
        const basketY = H * 0.85,
          basketZ = neck[2] + 0.22;
        box(body, [0.36, 0.025, 0.28], [0, basketY - 0.1, basketZ], deck, 'basket-floor');
        for (const side of [-1, 1]) {
          box(body, [0.018, 0.23, 0.28], [side * 0.171, basketY, basketZ], deck, 'basket-side');
          box(body, [0.36, 0.23, 0.018], [0, basketY, basketZ + side * 0.131], deck, 'basket-end');
          rod(
            body,
            [side * 0.1, basketY - 0.1, basketZ],
            [side * 0.055, neck[1], neck[2]],
            0.009,
            metal,
          );
        }
      }
      if (s.shape === 'cargo-bicycle') {
        // Stop the box behind the front tyre's swept envelope; it must not pierce the load floor.
        const rearZ = neck[2] + 0.08;
        const frontZ = front[2] - r - 0.07;
        const length = frontZ - rearZ;
        const z = (rearZ + frontZ) / 2;
        // Two cross-bearers carry the load box above the low steering beam.
        for (const mountZ of [rearZ + 0.08, frontZ - 0.08]) {
          rod(body, [0, r * 0.85, mountZ], [0, r * 1.2 - 0.03, mountZ], 0.018, metal);
          rod(body, [-0.27, r * 1.2 - 0.03, mountZ], [0.27, r * 1.2 - 0.03, mountZ], 0.014, metal);
        }
        box(body, [0.58, 0.06, length], [0, r * 1.2, z], deck);
        for (const x of [-0.28, 0.28]) box(body, [0.04, 0.38, length], [x, r * 1.2 + 0.2, z], deck);
        for (const dz of [-length / 2 + 0.02, length / 2 - 0.02])
          box(body, [0.58, 0.38, 0.04], [0, r * 1.2 + 0.2, z + dz], deck);
      }
      if (s.shape === 'road-bicycle')
        // Drop bars: forward from the hoods, down through the hook and back to the drops.
        for (const x of [-W * 0.45, W * 0.45]) {
          const hook = [
            [x, 0, -sweep],
            [x, -0.015, 0.085 - sweep],
            [x, -0.09, 0.105 - sweep],
            [x, -0.15, 0.06 - sweep],
            [x, -0.155, -0.04 - sweep],
          ];
          for (let i = 1; i < hook.length; i++) rod(handlebar, hook[i - 1], hook[i], 0.013, dark);
        }
    } else if (scooter) {
      // Step-through scooter: floorboard between the wheels, a curved leg shield and apron in
      // front, and a cowl over the engine and rear wheel carrying the seat.
      const floorY = 0.3;
      box(body, [0.42, 0.16, 0.62], [0, floorY - 0.08, 0.05], paint, 'floorboard');
      for (let i = -2; i <= 2; i++)
        box(body, [0.34, 0.008, 0.025], [0, floorY + 0.004, 0.05 + i * 0.11], dark);
      const shield = loft(
        body,
        [
          [floorY - 0.02, 0.21, -0.43, -0.35],
          [0.62, 0.23, -0.46, -0.38],
          [0.96, 0.19, -0.51, -0.43],
          [1.09, 0.09, -0.54, -0.47],
        ],
        paint,
        'leg-shield',
      );
      shield.rotation.x = -Math.PI / 2;
      box(body, [0.07, 0.28, 0.04], [0, 0.82, 0.54], metal, 'horn-cover');
      loft(
        body,
        [
          [-0.08, 0.16, 0.3, 0.88],
          [-0.3, 0.205, 0.34, 0.9],
          [-0.55, 0.21, 0.4, 0.89],
          [-0.78, 0.16, 0.5, 0.85],
          [-0.93, 0.07, 0.62, 0.79],
        ],
        paint,
        'engine-cowl',
      );
      loft(
        body,
        [
          [-0.06, 0.14, 0.87, 0.95],
          [-0.3, 0.175, 0.89, 0.985],
          [-0.55, 0.17, 0.89, 0.98],
          [-0.78, 0.13, 0.85, 0.94],
        ],
        dark,
        'saddle',
      );
      // Single-sided front link, enclosed engine/swingarm unit, side exhaust and grab rail.
      rod(body, [0.075, r, front[2]], [0.075, 0.68, 0.53], 0.03, metal);
      rod(body, [0.075, 0.68, 0.53], neck, 0.035, metal);
      const fender = mesh(body, new T.TorusGeometry(r * 1.15, 0.03, 4, 16, Math.PI * 0.8), paint);
      fender.rotation.set(0, Math.PI / 2, Math.PI * 0.12);
      fender.position.set(0, r, front[2]);
      fender.scale.z = 3.4;
      box(body, [0.1, 0.15, 0.48], [0.13, 0.27, -0.47], dark, 'engine-unit');
      rod(body, [-0.16, 0.25, -0.24], [-0.17, 0.32, -0.84], 0.055, metal);
      rod(body, [-0.17, 0.32, -0.84], [-0.17, 0.33, -0.9], 0.03, dark);
      const rail = [
        [0.17, 0.92, -0.62],
        [0.15, 0.95, -0.86],
        [-0.15, 0.95, -0.86],
        [-0.17, 0.92, -0.62],
      ];
      for (let i = 1; i < rail.length; i++) rod(body, rail[i - 1], rail[i], 0.014, metal);
    } else {
      for (const side of [-1, 1])
        box(body, [0.17, 0.04, 0.14], [side * 0.26, r * 0.9, -wb * 0.08], dark, 'footrest');
      loft(
        body,
        [
          [-0.2, 0.15, H * 0.61, H * 0.77],
          [0.1, 0.2, H * 0.62, H * 0.85],
          [0.3, 0.14, H * 0.62, H * 0.8],
          [0.38, 0.08, H * 0.62, H * 0.68],
        ],
        paint,
        'fuel-tank',
      );
      box(body, [0.32, 0.32, 0.38], [0, r * 1.45, -0.04], metal, 'engine');
      for (const z of [-wb / 2, wb / 2]) {
        const fender = mesh(body, new T.TorusGeometry(r * 1.13, 0.026, 4, 16, Math.PI), paint);
        fender.rotation.y = Math.PI / 2;
        fender.position.set(0, r, z);
        fender.scale.z = 3.2;
      }
      box(body, [0.25, 0.06, 0.38], [0, H * 0.7, -wb * 0.42], paint, 'rear-tail');
      rod(body, [0, H * 0.7, -wb * 0.5], [0, H * 0.68, -wb * 0.52], 0.03, dark);
      rod(body, [-0.23, r * 0.7, -wb * 0.46], [-0.23, r * 0.9, 0.25], 0.06, metal);
      if (s.shape === 'cruiser-motorcycle')
        for (const x of [-0.25, 0.25])
          box(body, [0.2, 0.3, 0.42], [x, r * 1.65, -wb * 0.39], dark, 'pannier');
    }
    // Round headlamp in a shell; a scooter carries it in the handlebar cowl, turning with it.
    const lamp = bike ? 0.032 : 0.085;
    const lampAt = scooter ? [0, 0.03, 0.06] : [0, H * 0.84, neck[2] + 0.08];
    const lampGroup = scooter ? handlebar : body;
    const shell = mesh(
      lampGroup,
      new T.CylinderGeometry(lamp, lamp * 0.78, lamp * 1.3, 16).rotateX(Math.PI / 2),
      scooter ? paint : dark,
    );
    shell.position.set(...lampAt);
    const lens = mesh(lampGroup, new T.CircleGeometry(lamp * 0.88, 16), light);
    lens.position.set(lampAt[0], lampAt[1], lampAt[2] + lamp * 0.66);
    const rearLamp = scooter
      ? [0, 0.76, -0.935]
      : bike
        ? [0, saddle[1] - 0.09, saddle[2] - 0.075]
        : [0, H * 0.68, -wb * 0.52];
    if (bike) rod(body, [0, saddle[1] - 0.09, saddle[2]], rearLamp, 0.012, dark);
    box(body, [0.09, 0.055, 0.04], rearLamp, red);
  } else {
    const big = L > 50;
    const ferry = s.shape.includes('ferry');
    const deckY = s.freeboard;
    const draft = s.draft;
    // Hull form per type. transom: stern width / beam; entry: where the bow starts to narrow
    // (fraction of length from the stern); fullness: plan exponent of the bow (higher is fuller);
    // rake: how far the stem leans forward of the forefoot (fraction of length); flare: topside
    // widening above the waterline at the bow; deadrise: bottom V angle (rad); bilge: depth of the
    // bilge turn (fraction of draft); bowRise/sternRise: sheer above the bulwark (m); bulwark:
    // solid rail above the deck (m); canoe: hull-body draft when a fin keel carries the rest
    // (fraction of draft); deckColor: deck paint.
    const HULLS = {
      'bulk-carrier': {
        transom: 0.86,
        entry: 0.72,
        fullness: 2.6,
        rake: 0.05,
        flare: 0.05,
        deadrise: 0,
        bilge: 0.86,
        bowRise: 2.6,
        sternRise: 1.2,
        bulwark: 1.2,
        deckColor: '#8a3f32',
      },
      'container-ship': {
        transom: 0.88,
        entry: 0.66,
        fullness: 2.1,
        rake: 0.06,
        flare: 0.08,
        deadrise: 0.02,
        bilge: 0.8,
        bowRise: 2.8,
        sternRise: 1,
        bulwark: 1.2,
        deckColor: '#6f7d74',
      },
      'car-ferry': {
        transom: 0.6,
        entry: 0.82,
        fullness: 2,
        rake: 0.03,
        flare: 0.05,
        deadrise: 0.06,
        bilge: 0.7,
        bowRise: 0.5,
        sternRise: 0,
        bulwark: 0.9,
        doubleEnded: true,
        deckColor: '#7b8084',
      },
      'passenger-ferry': {
        transom: 0.82,
        entry: 0.7,
        fullness: 1.9,
        rake: 0.06,
        flare: 0.06,
        deadrise: 0.12,
        bilge: 0.6,
        bowRise: 0.45,
        sternRise: 0,
        bulwark: 0.25,
        deckColor: '#8a8f90',
      },
      'fishing-boat': {
        transom: 0.72,
        entry: 0.58,
        fullness: 1.7,
        rake: 0.1,
        flare: 0.16,
        deadrise: 0.26,
        bilge: 0.45,
        bowRise: 0.75,
        sternRise: 0.15,
        bulwark: 0.5,
        deckColor: '#8e9497',
      },
      tugboat: {
        transom: 0.78,
        entry: 0.62,
        fullness: 1.9,
        rake: 0.07,
        flare: 0.14,
        deadrise: 0.16,
        bilge: 0.55,
        bowRise: 1,
        sternRise: 0,
        bulwark: 0.6,
        deckColor: '#81878a',
      },
      speedboat: {
        transom: 0.84,
        entry: 0.5,
        fullness: 1.45,
        rake: 0.2,
        flare: 0.1,
        deadrise: 0.38,
        bilge: 0.12,
        bowRise: 0.22,
        sternRise: 0,
        bulwark: 0.08,
        deckColor: '#ae8963',
      },
      sailboat: {
        transom: 0.62,
        entry: 0.48,
        fullness: 1.6,
        rake: 0.1,
        flare: 0.05,
        deadrise: 0.3,
        bilge: 0.5,
        bowRise: 0.2,
        sternRise: 0.05,
        bulwark: 0.06,
        canoe: 0.35,
        deckColor: '#ae8963',
      },
    };
    const P = HULLS[s.shape];
    const hullDraft = draft * (P.canoe ?? 1);
    const smooth = (t) => t * t * (3 - 2 * t);
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
    const flareAt = (z) => P.flare * (0.3 + 0.7 * bowness(z));
    const sheerAt = (z) => {
      const u = (z + L / 2) / L;
      return (
        deckY +
        P.bulwark +
        P.bowRise * Math.pow(bowness(z), 1.5) +
        P.sternRise * Math.max(0, 1 - u / 0.15)
      );
    };
    // The stem rakes forward: lower points of each bow station sit aft of its gunwale.
    const rakeShift = (z, y) =>
      -P.rake * L * smooth(bowness(z)) * Math.min(1, (sheerAt(z) - y) / (sheerAt(z) + hullDraft));
    const stationCount = Math.max(16, Math.min(28, Math.round(L / 2)));
    const zs = Array.from({ length: stationCount + 1 }, (_, i) => -L / 2 + (L * i) / stationCount);
    // Half section from keel to gunwale: keel, bottom, bilge, waterline, boot-top, topside, gunwale.
    const bootTop = Math.min(0.6, Math.max(0.06, deckY * 0.08));
    const section = (z) => {
      const g = deckHalf(z),
        b = g / (1 + flareAt(z)),
        d = hullDraft * (1 - 0.35 * smooth(bowness(z)));
      const bottomY = Math.min(-d * P.bilge, -d + 0.5 * b * Math.tan(P.deadrise));
      const topside = [(b + g) / 2 + (g - b) * 0.1, deckY * 0.55];
      const points = [
        // Both halves share the keel; a nonzero half-width leaves the entire bottom open.
        [0, -d],
        [0.5 * b, bottomY],
        [0.93 * b, -d * P.bilge],
        [b, 0],
        [b + ((topside[0] - b) * bootTop) / topside[1], bootTop],
        topside,
        [g, sheerAt(z)],
      ];
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
    surface('hull', paint, [4, 5]);
    if (!P.doubleEnded) {
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
    // Deck plating inside the bulwarks, the bulwarks' inner faces and a cap rail along the sheer.
    const deckMaterial = material('deck', P.deckColor, 0, 0.8);
    const inset = Math.min(0.25, W * 0.012 + 0.03);
    const deckPositions = [],
      bulwarkPositions = [];
    for (let j = 0; j < zs.length - 1; j++) {
      const [z0, z1] = [zs[j], zs[j + 1]];
      const [w0, w1] = [Math.max(0, deckHalf(z0) - inset), Math.max(0, deckHalf(z1) - inset)];
      const [s0, s1] = [sheerAt(z0), sheerAt(z1)];
      deckPositions.push(-w0, deckY, z0, w1, deckY, z1, w0, deckY, z0);
      deckPositions.push(-w0, deckY, z0, -w1, deckY, z1, w1, deckY, z1);
      for (const m of [-1, 1]) {
        const quad = [
          [m * w0, deckY, z0],
          [m * w0, s0, z0],
          [m * w1, s1, z1],
          [m * w1, deckY, z1],
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
    ]) {
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
      box(body, [0.32, 0.22, L * 0.18], [0, -draft + 0.11, -L * 0.03], dark, 'keel-bulb');
      box(
        body,
        [0.08, hullDraft * 1.6, L * 0.06],
        [0, -hullDraft * 0.75, -L * 0.42],
        antifouling,
        'rudder',
      );
    }
    // Hull queries for the close-view fittings (cleats, lights, lettering).
    hull = {
      deckAt: (z) => deckHalf(z) - inset,
      sheerAt,
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
    const cabin = (z, len, width, y, height) => {
      let windowHeight = Math.min(1.4, height * 0.65);
      let sill = height - windowHeight;
      const eye = s.driverEye;
      const operatorCabin =
        eye && Math.abs(eye[2] - z) < len / 2 && eye[1] > y && eye[1] < y + height + 0.2;
      if (operatorCabin) {
        // A solid accommodation block is fine below the bridge, but the bridge itself is hollow.
        const floorY = Math.min(y + sill - 0.04, eye[1] - 1.15);
        // Wheelhouse windows sit on solid lower walls, not a glass band down to the floor.
        // Keep the sill below the operator's eye and leave at least a 55 cm window opening.
        const lowerTop = Math.min(y + height - 0.55, Math.max(y + sill, floorY + 0.75));
        sill = lowerTop - y;
        windowHeight = height - sill;
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
      // Four vertical panes only: a transparent box also puts a glass floor across the bridge.
      const panes = new T.BoxGeometry(width * 1.015, windowHeight, len * 0.99);
      const indices = [];
      for (const side of [0, 1, 4, 5]) {
        const group = panes.groups[side];
        for (let i = group.start; i < group.start + group.count; i++)
          indices.push(panes.index.getX(i));
      }
      panes.setIndex(indices);
      panes.clearGroups();
      mesh(body, panes, glass).position.set(0, y + sill + windowHeight / 2, z);
      const paneCount = big ? 5 : 3;
      for (const face of [-1, 1])
        for (let i = 1; i < paneCount; i++)
          box(
            body,
            [big ? 0.075 : 0.045, windowHeight, 0.065],
            [
              -width / 2 + (width * i) / paneCount,
              y + sill + windowHeight / 2,
              z + face * len * 0.495,
            ],
            cream,
          );
      box(body, [width * 1.07, 0.12, len * 1.05], [0, y + height + 0.04, z], cream);
      for (let j = 0; j < Math.max(2, Math.floor(len / (big ? 3 : 1.1))); j++)
        for (const x of [-width / 2, width / 2])
          box(
            body,
            [0.06, windowHeight, big ? 0.25 : 0.08],
            [
              x * 1.02,
              y + sill + windowHeight / 2,
              z - len * 0.4 + (j * len * 0.8) / Math.max(1, Math.floor(len / (big ? 3 : 1.1)) - 1),
            ],
            cream,
          );
      if (big && sill > 4) {
        // Accommodation decks below the bridge: a row of cabin windows on every face per deck.
        for (let level = y + 1.4; level < y + sill - 0.8; level += 2.8) {
          for (let i = 0; i < Math.floor(width / 2.4); i++)
            for (const face of [-1, 1])
              box(
                body,
                [1.1, 0.75, 0.06],
                [-width / 2 + 1.2 + i * 2.4, level, z + face * (len / 2 + 0.02)],
                dark,
              );
          for (let i = 0; i < Math.floor(len / 2.4); i++)
            for (const face of [-1, 1])
              box(
                body,
                [0.06, 0.75, 1.1],
                [face * (width / 2 + 0.02), level, z - len / 2 + 1.2 + i * 2.4],
                dark,
              );
        }
        // Bridge wings reach the ship's sides so the bridge can see down them.
        const wingWidth = (W * 0.96 - width) / 2;
        for (const side of [-1, 1])
          box(
            body,
            [wingWidth, 0.3, len * 0.28],
            [side * (width / 2 + wingWidth / 2), y + sill - 0.12, z + len * 0.32],
            cream,
            'bridge-wing',
          );
        // Funnel aft of the bridge, in hull color with a dark top.
        const funnelZ = z - len * 0.28;
        box(body, [W * 0.13, 6, W * 0.17], [0, y + height + 3, funnelZ], paint, 'funnel');
        box(body, [W * 0.135, 1, W * 0.175], [0, y + height + 5.6, funnelZ], dark);
      }
    };
    if (s.shape === 'container-ship') {
      cabin(-L * 0.35, L * 0.14, W * 0.79, deckY, H * 0.54);
      const cargo = material('container-colors', '#ffffff');
      cargo.vertexColors = true;
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++)
          for (let tier = 0; tier < 2 + (row % 2); tier++) {
            const o = box(
              body,
              [W * 0.26, 2.6, L * 0.105],
              [(col - 1) * W * 0.28, deckY + 1.4 + tier * 2.7, -L * 0.18 + row * L * 0.115],
              cargo,
            );
            const color = new T.Color(
              ['#a85a43', '#54858a', '#d6b46c', '#81996c'][(col + row + tier) % 4],
            );
            const values = Array.from({ length: o.geometry.attributes.position.count }, () =>
              color.toArray(),
            ).flat();
            o.geometry.setAttribute('color', new T.Float32BufferAttribute(values, 3));
          }
    } else if (s.shape === 'bulk-carrier') {
      const hatchCover = material('hatch-covers', '#5d6a63', 0.2, 0.6);
      cabin(-L * 0.36, L * 0.13, W * 0.72, deckY, H * 0.55);
      for (let j = 0; j < 4; j++) {
        const z = -L * 0.18 + j * L * 0.15;
        box(body, [W * 0.76, 0.9, L * 0.12], [0, deckY + 0.45, z], hatchCover, 'hatch');
        rod(body, [-W * 0.33, deckY, z], [-W * 0.33, deckY + H * 0.5, z], 0.35, cream);
        rod(
          body,
          [-W * 0.33, deckY + H * 0.48, z],
          [W * 0.28, deckY + H * 0.6, z + L * 0.06],
          0.24,
          cream,
        );
      }
    } else if (ferry) {
      const car = s.shape === 'car-ferry';
      if (car) {
        for (const x of [-W * 0.41, W * 0.41])
          box(body, [W * 0.13, 3.4, L * 0.75], [x, deckY + 1.7, -L * 0.05], cream);
        cabin(-L * 0.04, L * 0.66, W * 0.88, deckY + 3.4, 2.8);
        for (const z of [-L * 0.47, L * 0.44])
          box(body, [W * 0.55, 0.2, L * 0.1], [0, deckY + 0.15, z], metal, 'loading-ramp');
      } else cabin(-L * 0.05, L * 0.66, W * 0.82, deckY, H * 0.35);
      cabin(L * 0.16, L * 0.2, W * 0.75, deckY + (car ? 6.4 : H * 0.38), 1.8);
      const funnelBase = deckY + (car ? 6.2 : H * 0.35) + 0.08;
      box(body, [W * 0.17, 1.8, L * 0.08], [0, funnelBase + 0.9, -L * 0.23], paint, 'funnel');
    } else if (s.shape === 'sailboat') {
      cabin(-L * 0.06, L * 0.37, W * 0.65, deckY, 0.6);
      rod(body, [0, deckY, L * 0.06], [0, H, L * 0.06], 0.055, metal);
      const sail = new T.BufferGeometry();
      sail.setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [0.03, H * 0.94, L * 0.06, 0.03, deckY + 1.2, -L * 0.36, 0.03, deckY + 1.2, L * 0.06],
          3,
        ),
      );
      sail.computeVertexNormals();
      const sailMat = cream.clone();
      sailMat.name = 'sail-cloth';
      sailMat.side = T.DoubleSide;
      mesh(body, sail, sailMat, 'mainsail');
      rod(body, [0, deckY + 1.15, -L * 0.37], [0, deckY + 1.15, L * 0.06], 0.045, metal);
    } else if (s.shape === 'speedboat') {
      // A rear bench leaves the helm footwell clear; the previous solid cockpit block cut the wheel and seats.
      box(body, [W * 0.69, 0.32, L * 0.1], [0, deckY + 0.16, -L * 0.34], cream);
      s = { ...s, helmFloor: deckY + 0.025 };
      const windscreen = box(body, [W * 0.75, 0.48, 0.05], [0, deckY + 0.45, L * 0.08], glass);
      windscreen.rotation.x = -0.35;
      const lowerY = deckY + 0.45 - 0.24 * Math.cos(0.35);
      const lowerZ = L * 0.08 + 0.24 * Math.sin(0.35);
      const upperY = deckY + 0.45 + 0.24 * Math.cos(0.35);
      const upperZ = L * 0.08 - 0.24 * Math.sin(0.35);
      box(
        body,
        [W * 0.76, lowerY - deckY + 0.02, 0.18],
        [0, (deckY + lowerY) / 2, lowerZ + 0.045],
        cream,
        'windscreen-coaming',
      );
      for (const side of [-1, 1])
        rod(
          body,
          [side * W * 0.375, lowerY, lowerZ],
          [side * W * 0.375, upperY, upperZ],
          0.018,
          metal,
        );
      rod(body, [-W * 0.375, lowerY, lowerZ], [W * 0.375, lowerY, lowerZ], 0.018, metal);
      rod(body, [-W * 0.375, upperY, upperZ], [W * 0.375, upperY, upperZ], 0.018, metal);
      box(body, [0.45, 0.75, 0.42], [0, 0.24, -L * 0.51], dark, 'outboard');
    } else {
      const tug = s.shape === 'tugboat';
      cabin(tug ? L * 0.08 : -L * 0.15, L * 0.35, W * 0.65, deckY, H * 0.4);
      rod(body, [0, deckY, 0], [0, H, 0], 0.06 * (L / 10), metal);
      if (tug) {
        box(
          body,
          [W * 0.17, H * 0.455, L * 0.11],
          [0, deckY + H * 0.2275, -L * 0.19],
          dark,
          'exhaust',
        );
        // A tug works by pushing: a rubber fender belt runs along the sheer and round the bow,
        // with tire fenders hung on the topsides below it.
        for (const m of [-1, 1]) {
          const belt = zs
            .filter((z) => hull.deckAt(z) > 0.3)
            .map((z) => [m * (hull.sideAt(z, deckY * 0.85).x + 0.12), deckY * 0.85, z]);
          for (let j = 1; j < belt.length; j++) rod(body, belt[j - 1], belt[j], 0.2, dark, 6);
          for (const z of [-L * 0.3, -L * 0.12, L * 0.18]) {
            const tire = mesh(body, new T.TorusGeometry(0.42, 0.17, 6, 12), dark, 'fender');
            tire.rotation.y = Math.PI / 2;
            tire.position.set(m * (hull.sideAt(z, deckY * 0.4).x + 0.18), deckY * 0.4, z);
          }
        }
      } else {
        rod(body, [-W * 0.33, deckY, L * 0.18], [-W * 0.33, H * 0.7, L * 0.18], 0.055, metal);
        rod(body, [-W * 0.33, H * 0.7, L * 0.18], [W * 0.3, H * 0.7, L * 0.18], 0.055, metal);
      }
    }
    if (s.shape !== 'sailboat' && s.shape !== 'speedboat') {
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
