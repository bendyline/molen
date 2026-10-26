/** Shared hard-surface authoring capability for the fleet's self-contained JSON recipes. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepareSurface } from './surface-normals.mjs';
import { addBoatDetail, addCarDetail, addCycleDetail } from './vehicle-detail.mjs';

export function fleetModel(s) {
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
    const r = s.wheelRadius;
    const wb = s.wheelbase;
    const back = [0, r, -wb / 2];
    const front = [0, r, wb / 2];
    const crank = [0, r * 0.85, -wb * 0.1];
    const saddle = [0, H * 0.78, -wb * 0.18];
    const neck = [0, H * 0.78, wb * (s.shape === 'cargo-bicycle' ? 0.12 : 0.34)];
    const radius = bike ? 0.028 : 0.055;
    wheel('wheel-front', 0, front[2], r, bike ? 0.06 : 0.16, bike);
    wheel('wheel-rear', 0, back[2], r, bike ? 0.06 : 0.2, bike);
    for (const [a, b] of [
      [back, saddle],
      [back, crank],
      [crank, saddle],
      [crank, neck],
      [saddle, neck],
    ])
      rod(body, a, b, radius, paint);
    for (const x of [-0.1, 0.1])
      rod(body, [x, r, front[2]], [x, neck[1], neck[2]], radius * 0.8, metal);
    rod(body, neck, [0, H * 0.96, neck[2] - 0.04], radius, metal);
    const handlebar = new T.Group();
    handlebar.name = 'handlebar';
    handlebar.position.set(0, H * 0.96, neck[2]);
    root.add(handlebar);
    const sweep = s.handlebarSweep ?? 0;
    if (sweep > 0) rod(handlebar, [0, 0, 0], [0, 0, -sweep], radius, metal);
    rod(handlebar, [-W / 2, 0, -sweep], [W / 2, 0, -sweep], radius, metal);
    for (const x of [-W * 0.43, W * 0.43])
      box(handlebar, [W * 0.16, 0.055, 0.08], [x, 0, -sweep], dark);
    box(body, [bike ? 0.2 : 0.35, 0.085, bike ? 0.28 : 0.62], saddle, dark, 'saddle');
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
        box(body, [0.36, 0.23, 0.28], [0, H * 0.85, neck[2] + 0.22], deck, 'basket');
      }
      if (s.shape === 'cargo-bicycle') {
        const z = wb * 0.2;
        box(body, [0.58, 0.06, 0.78], [0, r * 1.2, z], deck);
        for (const x of [-0.28, 0.28]) box(body, [0.04, 0.38, 0.78], [x, r * 1.2 + 0.2, z], deck);
        for (const dz of [-0.37, 0.37])
          box(body, [0.58, 0.38, 0.04], [0, r * 1.2 + 0.2, z + dz], deck);
      }
      if (s.shape === 'road-bicycle')
        for (const x of [-W * 0.45, W * 0.45])
          rod(handlebar, [x, 0, -sweep], [x, -H * 0.17, 0.1 - sweep], 0.024, dark);
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
      if (s.shape === 'motor-scooter') {
        box(body, [0.38, 0.11, 0.63], [0, r * 0.9, 0.04], paint);
        box(body, [0.48, H * 0.45, 0.12], [0, H * 0.5, neck[2]], paint);
      }
      if (s.shape === 'cruiser-motorcycle')
        for (const x of [-0.25, 0.25])
          box(body, [0.2, 0.3, 0.42], [x, r * 1.65, -wb * 0.39], dark, 'pannier');
    }
    box(
      body,
      [bike ? 0.055 : 0.18, bike ? 0.055 : 0.16, 0.07],
      [0, H * 0.84, neck[2] + 0.08],
      light,
    );
    box(body, [0.09, 0.055, 0.04], [0, H * 0.68, -wb * 0.52], red);
  } else {
    const big = L > 50;
    const ferry = s.shape.includes('ferry');
    const deckY = s.freeboard;
    const draft = s.draft;
    // Keel narrows below the waterline; bow tapers to a narrow stem, never a rectangular barge.
    const outline = [
      [-L / 2, W * 0.36],
      [-L * 0.38, W / 2],
      [L * 0.26, W / 2],
      [L * 0.43, W * 0.3],
      [L / 2, W * 0.025],
    ];
    const sheer = (z) => Math.max(0, (z / L - 0.26) / 0.24) * Math.min(0.35, deckY * 0.25);
    // A chine and narrow keel create hull volume, rather than stacking rectangular slabs.
    const sections = outline.map(([z, w]) => [
      [-w, deckY + sheer(z), z],
      [-w * 0.9, 0, z],
      [-w * 0.22, -draft, z],
      [w * 0.22, -draft, z],
      [w * 0.9, 0, z],
      [w, deckY + sheer(z), z],
    ]);
    for (const [name, material, edges] of [
      ['hull', paint, [0, 4]],
      ['underwater-hull', dark, [1, 2, 3]],
    ]) {
      const positions = [];
      for (let j = 0; j < sections.length - 1; j++)
        for (const k of edges) {
          const a = sections[j][k],
            b = sections[j][k + 1];
          const c = sections[j + 1][k],
            d = sections[j + 1][k + 1];
          positions.push(...a, ...b, ...d, ...a, ...d, ...c);
        }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      mesh(body, geometry, material, name);
    }
    // Transom and stem caps.
    for (const [j, reverse] of [
      [0, true],
      [sections.length - 1, false],
    ]) {
      const positions = [],
        points = sections[j];
      for (let k = 1; k < points.length - 1; k++)
        positions.push(
          ...points[0],
          ...points[reverse ? k + 1 : k],
          ...points[reverse ? k : k + 1],
        );
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      mesh(body, geometry, paint, 'transom-and-stem');
    }
    loft(
      body,
      outline.map(([z, w]) => [z, w, deckY + sheer(z), deckY + 0.08 + sheer(z)]),
      deck,
      'deck',
    );
    const cabin = (z, len, width, y, height) => {
      const windowHeight = Math.min(1.4, height * 0.65);
      const sill = height - windowHeight;
      box(body, [width, sill, len], [0, y + sill / 2, z], cream);
      box(
        body,
        [width * 1.015, windowHeight, len * 0.99],
        [0, y + sill + windowHeight / 2, z],
        glass,
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
      cabin(-L * 0.36, L * 0.13, W * 0.72, deckY, H * 0.55);
      for (let j = 0; j < 4; j++) {
        const z = -L * 0.18 + j * L * 0.15;
        box(body, [W * 0.76, 0.9, L * 0.12], [0, deckY + 0.45, z], dark, 'hatch');
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
      box(body, [W * 0.17, 1.8, L * 0.08], [0, H * 0.82, -L * 0.23], paint, 'funnel');
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
      box(body, [W * 0.69, 0.35, L * 0.28], [0, deckY + 0.25, -L * 0.17], cream);
      const windscreen = box(body, [W * 0.75, 0.48, 0.05], [0, deckY + 0.45, L * 0.08], glass);
      windscreen.rotation.x = -0.35;
      box(body, [0.45, 0.75, 0.42], [0, 0.24, -L * 0.51], dark, 'outboard');
    } else {
      const tug = s.shape === 'tugboat';
      cabin(tug ? L * 0.08 : -L * 0.15, L * 0.35, W * 0.65, deckY, H * 0.4);
      rod(body, [0, deckY, 0], [0, H, 0], 0.06 * (L / 10), metal);
      if (tug) {
        box(
          body,
          [W * 0.17, H * 0.25, L * 0.11],
          [0, deckY + H * 0.33, -L * 0.19],
          dark,
          'exhaust',
        );
        for (const x of [-W * 0.5, W * 0.5])
          for (const z of [-L * 0.25, 0, L * 0.25])
            box(body, [W * 0.08, 0.7, 0.7], [x, deckY * 0.5, z], dark, 'fender');
      } else {
        rod(body, [-W * 0.33, deckY, L * 0.18], [-W * 0.33, H * 0.7, L * 0.18], 0.055, metal);
        rod(body, [-W * 0.33, H * 0.7, L * 0.18], [W * 0.3, H * 0.7, L * 0.18], 0.055, metal);
      }
    }
    if (s.shape !== 'sailboat' && s.shape !== 'speedboat') {
      for (const side of [-1, 1]) {
        const x = side * W * 0.43;
        const railY = deckY + (big ? 1.1 : 0.55);
        rod(body, [x, railY, -L * 0.35], [x, railY, L * 0.28], big ? 0.065 : 0.025, cream);
        for (let k = 0; k < 7; k++)
          rod(
            body,
            [x, deckY, -L * 0.35 + k * L * 0.105],
            [x, railY, -L * 0.35 + k * L * 0.105],
            big ? 0.05 : 0.02,
            cream,
            4,
          );
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
  else addBoatDetail(root, s);
  return root;
}
