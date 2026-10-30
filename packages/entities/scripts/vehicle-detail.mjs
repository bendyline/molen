/** Polygonal close-view fittings. No photographs, baked light, or per-fastener draw calls. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { joinedPath } from '../../worldgen/scripts/joined-path.mjs';
import { prepareSurface } from './surface-normals.mjs';
import {
  addMarineDashboard,
  addRoadDashboard,
  carveLegacyCabin,
  panelTools,
} from './vehicle-interiors.mjs';

// Authoring-only recipes survive batching, without changing legacy vehicle/exterior GLBs.
// Aircraft can replace the selected cabin's text before export; no bitmap recognition is needed.
const batchedText = new WeakMap();
export function replaceDetailText(cabin, render) {
  const meshes = [];
  cabin.traverse((mesh) => {
    if (batchedText.has(mesh)) meshes.push(mesh);
  });
  for (const mesh of meshes) {
    const { solid, runs } = batchedText.get(mesh);
    batchedText.delete(mesh);
    const holder = new T.Group().copy(mesh, false);
    mesh.parent.add(holder);
    mesh.removeFromParent();
    if (solid) holder.add(new T.Mesh(solid, mesh.material));
    render(holder, runs, mesh.material);
    mesh.geometry.dispose();
  }
}

export function detailKit(parent, name = 'close-detail') {
  const textGroups = new WeakMap();
  const root = new T.Group();
  root.name = name;
  parent.add(root);
  const mat = (name, color, metalness = 0, roughness = 0.6) =>
    new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true });
  const metal = mat('detail-alloy', '#9ca6aa', 0.65, 0.4);
  const dark = mat('detail-trim', '#32383d', 0.05, 0.8);
  const ivory = mat('detail-lettering', '#deded3', 0, 0.55);
  const amber = mat('detail-amber', '#d49339', 0.05, 0.4);
  const red = mat('detail-red', '#ad3934', 0.05, 0.4);
  const green = mat('detail-green', '#397552', 0.05, 0.4);
  const add = (geometry, material = metal, at = [0, 0, 0], group = root) => {
    ({ geometry, material } = prepareSurface(geometry, material));
    const mesh = new T.Mesh(geometry, material);
    mesh.position.fromArray(at);
    group.add(mesh);
    return mesh;
  };
  const box = (size, at, material = metal, group) =>
    add(new T.BoxGeometry(...size), material, at, group);
  const rod = (a, b, radius = 0.01, material = metal, group) => {
    const from = new T.Vector3(...a),
      delta = new T.Vector3(...b).sub(from);
    const mesh = add(
      new T.CylinderGeometry(radius, radius, delta.length(), 6),
      material,
      from.addScaledVector(delta, 0.5).toArray(),
      group,
    );
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };
  const path = (points, radius = 0.01, material = metal, closed = false) => {
    const { positions, indices } = joinedPath(points, radius, 6, closed);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return add(geometry, material);
  };
  const ring = (radius, tube, at, material = metal, axis = 'z', group) => {
    const mesh = add(new T.TorusGeometry(radius, tube, 5, 24), material, at, group);
    if (axis === 'x') mesh.rotation.y = Math.PI / 2;
    if (axis === 'y') mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  // Compact sans-serif geometry, front +Z. Both sides must be rotated, never mirrored.
  const glyphs = {
    A: '010101111101101',
    B: '110101110101110',
    C: '011100100100011',
    D: '110101101101110',
    E: '111100110100111',
    F: '111100110100100',
    G: '011100101101011',
    H: '101101111101101',
    I: '111010010010111',
    J: '001001001101010',
    K: '101101110101101',
    L: '100100100100111',
    M: '101111111101101',
    N: '101111111111101',
    O: '010101101101010',
    P: '110101110100100',
    Q: '010101101111011',
    R: '110101110101101',
    S: '011100010001110',
    T: '111010010010010',
    U: '101101101101111',
    V: '101101101101010',
    W: '101101111111101',
    X: '101101010101101',
    Y: '101101010010010',
    Z: '111001010100111',
    0: '111101101101111',
    1: '010110010010111',
    2: '110001010100111',
    3: '110001010001110',
    4: '101101111001001',
    5: '111100110001110',
    6: '011100111101111',
    7: '111001010010010',
    8: '111101111101111',
    9: '111101111001110',
    '-': '000000111000000',
    '.': '000000000000010',
  };
  const text = (label, at, height = 0.05, yaw = 0, material = ivory, role = 'panel') => {
    const g = new T.Group();
    g.position.fromArray(at);
    g.rotation.y = yaw;
    root.add(g);
    textGroups.set(g, { label, height, role });
    const pixel = height / 5,
      width = (label.length * 4 - 1) * pixel;
    [...label.toUpperCase()].forEach((char, n) => {
      [...(glyphs[char] ?? '')].forEach((bit, i) => {
        if (bit === '1')
          box(
            [pixel * 0.85, pixel * 0.85, 0.001],
            [-width / 2 + (n * 4 + (i % 3)) * pixel, height / 2 - Math.floor(i / 3) * pixel, 0],
            material,
            g,
          );
      });
    });
    return g;
  };
  const finish = () => {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert(),
      batches = new Map();
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const geometry = (
        mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      ).applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      geometry.deleteAttribute('uv');
      const batch = batches.get(mesh.material) ?? { all: [], solid: [], runs: new Map() };
      batch.all.push(geometry);
      const inherited = batchedText.get(mesh),
        text = textGroups.get(mesh.parent),
        transform = inverse.clone().multiply(mesh.matrixWorld);
      if (inherited) {
        if (inherited.solid) batch.solid.push(inherited.solid.clone().applyMatrix4(transform));
        for (const run of inherited.runs)
          batch.runs.set(run, { ...run, matrix: transform.clone().multiply(run.matrix) });
      } else if (text) {
        batch.runs.set(mesh.parent, {
          ...text,
          matrix: inverse.clone().multiply(mesh.parent.matrixWorld),
        });
      } else batch.solid.push(geometry);
      batches.set(mesh.material, batch);
    });
    root.clear();
    for (const [material, batch] of batches) {
      const merged = mergeGeometries(batch.all);
      if (!merged) throw new Error(`Cannot consolidate ${name}/${material.name}`);
      const mesh = add(merged, material);
      mesh.name = `${name}-${material.name}`;
      if (batch.runs.size)
        batchedText.set(mesh, {
          solid: batch.solid.length ? mergeGeometries(batch.solid) : null,
          runs: [...batch.runs.values()],
        });
      for (const geometry of new Set([...batch.all, ...batch.solid])) geometry.dispose();
    }
    return root;
  };
  return { root, metal, dark, ivory, amber, red, green, add, box, rod, path, ring, text, finish };
}

export function addWheelDetail(wheel, radius, width, bicycle = false) {
  // Preserve the existing spin and steering nodes.
  let spin = wheel.getObjectByName(`${wheel.name}-spin`);
  if (!spin) {
    spin = new T.Group();
    spin.name = `${wheel.name}-spin`;
    for (const child of [...wheel.children]) spin.add(child);
    wheel.add(spin);
  }
  const d = detailKit(spin, `${wheel.name}-fittings`);
  const fixed = detailKit(wheel, `${wheel.name}-brakes`);
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + 0.009);
    d.ring(radius * 0.69, radius * 0.035, [x, 0, 0], d.metal, 'x');
    d.ring(radius * 0.86, radius * 0.008, [x, 0, 0], d.dark, 'x');
    for (let k = 0; k < (bicycle ? 16 : 5); k++) {
      const a = (k * Math.PI * 2) / (bicycle ? 16 : 5);
      const end = [x, Math.cos(a) * radius * 0.66, Math.sin(a) * radius * 0.66];
      d.rod([x, 0, 0], end, radius * (bicycle ? 0.009 : 0.038), d.metal);
      if (!bicycle)
        d.add(new T.CylinderGeometry(0.014, 0.014, 0.009, 6).rotateZ(Math.PI / 2), d.dark, [
          x + side * 0.009,
          Math.cos(a) * radius * 0.23,
          Math.sin(a) * radius * 0.23,
        ]);
    }
    if (!bicycle) {
      d.ring(radius * 0.48, radius * 0.08, [x - side * 0.018, 0, 0], d.dark, 'x');
      fixed.box([0.045, radius * 0.38, radius * 0.16], [x, 0, radius * 0.45], fixed.red);
    }
  }
  d.finish();
  fixed.finish();
}

export function addCarDetail(root, s, legacy = false) {
  const { length: L, width: W, height: H, wheelRadius: r } = s;
  const d = detailKit(root);
  const belt = H * (s.shape === 'box-truck' ? 0.36 : 0.55);
  // Grille slats, a real license-plate recess and house wordmark.
  for (let i = -3; i <= 3; i++)
    d.box([W * 0.034, 0.12, 0.012], [i * W * 0.052, belt * 0.62, L / 2 + 0.045], d.metal);
  for (const side of [-1, 1]) {
    const z = side * (L / 2 + 0.055);
    d.box([0.42, 0.115, 0.018], [0, r * 0.83, z], d.dark);
    d.text('BENDY', [0, r * 0.83, z + side * 0.011], 0.055, side < 0 ? Math.PI : 0);
    d.box([W * 0.77, 0.022, 0.022], [0, r * 1.25, z], d.metal);
  }
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + 0.008);
    for (const z of [-L * 0.18, L * 0.13]) {
      d.rod([x, r * 0.85, z], [x, belt * 0.96, z], 0.005, d.dark);
      d.box([0.022, 0.023, 0.15], [x, belt * 0.91, z - 0.11], d.metal);
    }
    d.rod([x, r * 0.84, -s.wheelbase * 0.37], [x, r * 0.84, s.wheelbase * 0.37], 0.015, d.dark);
    // Fuel/charging hatch, turn repeater and sill.
    d.box([0.012, 0.13, 0.17], [x, belt * 0.78, -L * 0.32], d.dark);
    d.box([0.018, 0.035, 0.09], [x, belt * 0.85, L * 0.28], d.amber);
    if (!legacy) {
      const front = s.shape === 'box-truck' ? L * 0.45 : L * 0.22;
      const z = front - L * 0.025,
        y = H * (0.65 + (0.31 * 0.025) / 0.12) + 0.012;
      d.rod([side * W * 0.19, y, z], [side * W * 0.36, y, z], 0.008, d.dark);
      d.rod([side * W * 0.19, y, z], [side * W * 0.13, H * 0.65 + 0.012, front], 0.005, d.dark);
    }
    // Exhaust outlets.
    d.ring(0.035, 0.007, [side * W * 0.32, r * 0.7, -L / 2 - 0.025], d.metal);
  }
  const eye = s.driverEye ?? [W * 0.24, H * 0.78, 0.2];
  if (legacy) {
    // Preserve the editable master; replace its solid cabin infill in the derived model.
    const oldWheel = root.getObjectByName('steering-wheel');
    oldWheel?.removeFromParent();
    carveLegacyCabin(root, s);
  }
  for (const x of [-W * 0.24, W * 0.24]) {
    d.box([W * 0.28, 0.12, 0.42], [x, eye[1] - 0.62, eye[2] - 0.12], d.dark);
    const back = d.box([W * 0.28, 0.42, 0.11], [x, eye[1] - 0.41, eye[2] - 0.34], d.dark);
    back.rotation.x = -0.1;
    d.box([W * 0.16, 0.14, 0.09], [x, eye[1] - 0.13, eye[2] - 0.35], d.dark);
  }
  addRoadDashboard(
    root,
    s,
    {
      eye,
      width: W,
      dashY: eye[1] - 0.28,
      dashZ: eye[2] + 0.56,
      seatY: eye[1] - 0.62,
      clearance: r * 0.4,
    },
    detailKit,
  );
  root.traverse((node) => {
    if (/^wheel-(front|rear)-(left|right)$/.test(node.name))
      addWheelDetail(node, r, W * (legacy ? 0.115 : 0.12));
  });
  d.finish();
}

export function addCycleDetail(root, s) {
  // Rider controls and markings. Frame, wheels, drivetrain and lamps come from fleet-geometry,
  // whose cycle geometry (s.cycleFrame) also places these in model space.
  const d = detailKit(root),
    bike = s.family === 'bicycle',
    G = s.cycleFrame;
  const scooter = s.shape === 'motor-scooter';
  const badge = G.badge;
  if (badge)
    for (const side of [-1, 1])
      d.text('BENDY', [side * badge[0], badge[1], badge[2]], badge[3], (side * Math.PI) / 2);
  // Controls are authored in model space inside the handlebar's untilted frame, so they turn
  // about the real steering axis with the bars.
  const frame = root.getObjectByName('handlebar-frame');
  const controls = detailKit(frame, 'rider-controls');
  const [gx, gy, gz] = G.grips[0];
  const tilted = (kit, at, tilt, build) => {
    const face = new T.Group();
    face.position.set(...at);
    face.rotation.x = tilt;
    kit.root.add(face);
    const k = detailKit(face, 'instrument-face');
    build(k, panelTools(k));
    k.finish();
  };
  for (const side of [-1, 1]) {
    const x = side * gx;
    if (s.shape === 'road-bicycle') {
      // Brake/shift hoods on the drop bar and their lever blades.
      const [, cy, cz] = G.clamp;
      // Rounded hood body rising forward to its horn, as a lever hood is shaped.
      const hood = controls.add(new T.CapsuleGeometry(0.0155, 0.045, 3, 8), controls.dark, [
        x,
        cy + 0.014,
        cz + 0.086,
      ]);
      hood.rotation.x = Math.PI / 2 - 0.4;
      hood.scale.set(0.95, 1, 1.3);
      controls.rod([x, cy + 0.01, cz + 0.122], [x, cy - 0.085, cz + 0.112], 0.006);
    } else if (bike) {
      // Upright bars: the lever lies along the swept grip, outboard of the fingers.
      controls.box([0.03, 0.025, 0.04], [x - side * 0.01, gy + 0.008, gz + 0.075], controls.dark);
      controls.rod(
        [x + side * 0.03, gy - 0.008, gz + 0.06],
        [x + side * 0.042, gy - 0.02, gz - 0.035],
        0.005,
      );
    } else {
      // Motorcycle perch, lever, switch housing and mirror.
      controls.box([0.045, 0.03, 0.035], [x - side * 0.085, gy + 0.012, gz + 0.03], controls.metal);
      controls.box([0.05, 0.035, 0.04], [x - side * 0.09, gy, gz + 0.005], controls.dark);
      controls.rod(
        [x - side * 0.07, gy + 0.008, gz + 0.045],
        [x + side * 0.06, gy - 0.004, gz + 0.075],
        0.006,
      );
      // Mirror: a stalk angled up and out to an oval head facing the rider; a scooter's
      // stalks stand taller than a motorcycle's.
      const reach = scooter ? 0.16 : 0.1,
        k = scooter ? 0.85 : 0.8;
      controls.rod(
        [x - side * 0.1, gy + 0.025, gz + 0.03],
        [x + side * 0.035, gy + reach, gz + 0.05],
        0.0065,
      );
      for (const [r, depth, z, material] of [
        [0.053 * k, 0.022, gz + 0.056, controls.dark],
        [0.047 * k, 0.004, gz + 0.044, controls.metal],
      ]) {
        const head = controls.add(new T.CylinderGeometry(r, r, depth, 16), material, [
          x + side * 0.06,
          gy + reach + 0.025 * k,
          z,
        ]);
        head.rotation.x = Math.PI / 2;
        head.scale.set(1, 1, 0.64);
      }
    }
  }
  if (bike) {
    const [, cy, cz] = G.clamp;
    if (s.shape === 'road-bicycle') {
      // Bike computer on an out-front mount.
      tilted(controls, [0, cy + 0.02, cz + 0.03], 0.9, (_k, p) =>
        p.display(0, 0, 0, 0.036, 0.046, 'ride'),
      );
    } else {
      controls.add(
        new T.SphereGeometry(0.024, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        controls.metal,
        [0.12, cy + 0.018, cz - 0.01],
      );
      controls.box([0.026, 0.007, 0.012], [0.15, cy + 0.016, cz - 0.03], controls.dark);
      if (s.shape === 'cargo-bicycle')
        tilted(controls, [-0.06, cy + 0.02, cz], 0.9, (_k, p) =>
          p.display(0, 0, 0, 0.036, 0.037, 'ride'),
        );
    }
  } else if (s.shape === 'cruiser-motorcycle') {
    // Tank-top speedometer: chassis-mounted, it does not turn with the bars.
    const console = detailKit(root, 'tank-instruments');
    console.add(new T.CylinderGeometry(0.085, 0.095, 0.03, 20), console.metal, [0, 0.948, 0.14]);
    tilted(console, [0, 0.968, 0.14], 1.25, (k, p) => p.gauge(0, 0, 0, 0.066, k.ivory));
    console.finish();
  } else if (scooter) {
    tilted(controls, [0, 1.062, 0.3], 0.75, (k, p) => {
      p.gauge(0, 0.008, 0, 0.052, k.ivory);
      p.gauge(-0.075, -0.012, 0.004, 0.022);
    });
  } else {
    // Twin clocks above the top yoke.
    tilted(controls, [0, G.headTop + 0.11, G.pivot[2] + 0.05], 0.75, (k, p) => {
      p.gauge(-0.062, 0, 0, 0.048, k.ivory);
      p.gauge(0.062, 0, 0, 0.048);
    });
  }
  if (!bike) {
    // Indicators: amber lenses ahead of the bars (they turn with them) and beside the tail.
    const lens = (kit, at, size) => {
      const mesh = kit.add(new T.SphereGeometry(1, 10, 6), kit.amber, at);
      mesh.scale.set(...size);
      return mesh;
    };
    if (scooter) {
      // Set into the leg shield's upper corners and the rear body's flanks.
      for (const side of [-1, 1]) {
        lens(d, [side * 0.15, 0.8, 0.505], [0.032, 0.02, 0.016]);
        lens(d, [side * 0.15, 0.62, -0.885], [0.014, 0.018, 0.032]);
      }
    } else {
      // Bullet lamps on stalks: from the fork beside the headlamp, and from the rear fender.
      const leg = (y) => G.F[2] - (y - G.F[1]) / Math.tan(G.ha);
      const [, ly, lz] = G.headlamp;
      const [tz, ty] = G.tail;
      for (const side of [-1, 1]) {
        const x = side * G.forkWidth;
        const tip = [side * (G.forkWidth + 0.1), ly - 0.06, lz - 0.06];
        controls.rod([x, ly - 0.06, leg(ly - 0.06)], tip, 0.007, controls.dark);
        controls
          .add(new T.CylinderGeometry(0.02, 0.026, 0.05, 10), controls.amber, [
            tip[0],
            tip[1],
            tip[2] + 0.02,
          ])
          .rotation.set(Math.PI / 2, 0, 0);
        const back = [side * 0.15, ty + 0.01, tz + 0.06];
        d.rod([side * 0.06, ty + 0.01, tz + 0.1], back, 0.007, d.dark);
        d.add(new T.CylinderGeometry(0.026, 0.02, 0.05, 10), d.amber, [
          back[0],
          back[1],
          back[2] - 0.02,
        ]).rotation.set(Math.PI / 2, 0, 0);
      }
    }
  }
  controls.finish();
  d.finish();
}

export function addBoatDetail(root, s) {
  const d = detailKit(root);
  const { length: L, width: W, freeboard: y } = s;
  const size = Math.min(2, Math.max(0.65, W / 5));
  // Fairleads, bollards and cleats follow the usable deck, clear of the narrow bow; a lofted hull
  // (fleet-geometry) reports its deck edge and topsides for them.
  const hull = s.hull;
  const edge = (z, inset) => Math.min(W * 0.39, hull ? hull.deckAt(z) - inset : W);
  const sail = s.shape === 'sailboat';
  const small = s.shape === 'speedboat';
  // Fittings stand on the deck they serve: a raised forecastle, or a yacht's side decks and a
  // runabout's gunwales at the sheer.
  const deckTop = (z) =>
    (sail || small) && hull ? hull.sheerAt(z) - 0.02 : (hull?.deckYAt?.(z) ?? y);
  for (const side of [-1, 1]) {
    for (const z of [-L * 0.35, L * 0.26]) {
      const x = side * edge(z, 0.16 * size),
        dy = deckTop(z);
      d.box([0.17 * size, 0.04, 0.28 * size], [x, dy + 0.11, z], d.metal);
      d.rod([x, dy + 0.1, z], [x, dy + 0.24 * size, z], 0.035 * size);
      d.rod(
        [x, dy + 0.24 * size, z - 0.15 * size],
        [x, dy + 0.24 * size, z + 0.15 * size],
        0.025 * size,
      );
    }
    // Hull lettering lies on the topsides (tilted with their flare), not standing off them. A
    // runabout's sole sits low in the hull, so its name goes by the gunwale; a tug's goes on the
    // bow, clear of the tyres along its sides, where the topsides turn in plan and the stem rake
    // carries them aft.
    const letterY = small && hull ? hull.sheerAt(0) * 0.5 : y * 0.55;
    const letterZ = s.shape === 'tugboat' ? L * 0.27 : 0;
    const topside = hull?.sideAt(letterZ, letterY) ?? { x: W / 2, tilt: 0 };
    const turn = letterZ ? Math.atan(hull.deckAt(letterZ + 0.5) - hull.deckAt(letterZ - 0.5)) : 0;
    const raked = letterZ ? letterZ + hull.rake(letterZ, letterY) : 0;
    const name = d.text(
      'BENDY',
      [side * (topside.x + 0.006), letterY, raked],
      small ? 0.13 : Math.min(0.42, y * 0.22),
      side * (Math.PI / 2 + turn),
    );
    name.rotation.order = 'YXZ';
    name.rotation.x = topside.tilt;
    d.box(
      [0.09 * size, 0.08 * size, 0.12 * size],
      [
        side * edge(L * 0.25, 0.08 * size),
        hull ? hull.sheerAt(L * 0.25) + 0.08 * size : y + 0.35,
        L * 0.25,
      ],
      side > 0 ? d.red : d.green,
    );
  }
  // Deck hatch with raised coaming and a pair of visible hinges (a runabout's anchor locker lid
  // on its foredeck).
  const [hatchZ, hatchLength] = small ? [L * 0.44, 0.34] : [L * 0.32, Math.min(1.2, L * 0.12)];
  const hatchY = deckTop(hatchZ) - (small ? 0.08 : 0);
  d.box([W * 0.25, 0.035, hatchLength], [0, hatchY + 0.1, hatchZ], d.dark);
  for (const x of [-W * 0.09, W * 0.09])
    d.box([0.09, 0.025, 0.035], [x, hatchY + 0.13, hatchZ - hatchLength / 2], d.metal);
  if (sail || small) {
    // Teak seams on the open cockpit sole of a yacht or runabout (between a runabout's flared
    // liner sides, which close in toward the bow).
    const [from, to] = sail ? [-L * 0.46, -L * 0.13] : [-L * 0.34, L * 0.2];
    const [n, seamY] = sail ? [3, y + 0.086] : [2, y + 0.01];
    for (let i = -n; i <= n; i++)
      d.rod([i * W * 0.1, seamY, from], [i * W * 0.1, seamY, to], 0.004, d.dark);
  }
  if (L < 30 && !small) {
    // Ring buoys: on a yacht's pushpit, on the guard rails of working boats.
    for (const side of [-1, 1]) {
      const z = sail ? -L * 0.45 : -L * 0.28;
      const x = side * (sail && hull ? hull.deckAt(z) * 0.62 : W * 0.34);
      const ringY = hull ? Math.max(y + 0.42, hull.sheerAt(z) + (sail ? 0.4 : 0.25)) : y + 0.42;
      d.ring(0.19, 0.047, [x, ringY, z], d.ivory, sail ? 'z' : 'x');
      d.rod([x, ringY + 0.25, z], [x, ringY + 0.19, z], 0.01, d.dark);
    }
  }
  // Lifebuoys the hull places on a ferry's deck rails.
  for (const at of hull?.rings ?? []) d.ring(0.3, 0.07, at, d.ivory, 'x');
  if (sail && hull) {
    // Fractional rig: cap and lower shrouds to chainplates on the side decks, forestay to the stem
    // and a backstay to the transom, all from the deck-stepped mast.
    const mastZ = L * 0.07,
      plateZ = mastZ - 0.3;
    for (const side of [-1, 1]) {
      const plate = [side * (hull.deckAt(plateZ) - 0.08), hull.sheerAt(plateZ), plateZ];
      d.rod([0, s.height * 0.86, mastZ], plate, 0.009, d.metal);
      d.rod([0, s.height * 0.43, mastZ], plate, 0.008, d.metal);
    }
    d.rod(
      [0, s.height * 0.86, mastZ],
      [0, hull.sheerAt(L / 2) + 0.05, L / 2 - 0.15],
      0.009,
      d.metal,
    );
    d.rod(
      [0, s.height * 0.99, mastZ - 0.05],
      [0, hull.sheerAt(-L / 2) + 0.05, -L / 2 + 0.12],
      0.008,
      d.metal,
    );
  }
  d.finish();
  if (s.driverEye) addMarineDashboard(root, s, detailKit);
}

/** Flush heads projected onto the actual triangles, so they never float above faceted skins. */
export function addRivetRows(root, targets, rows, radius = 0.0035) {
  const d = detailKit(root, 'airframe-fasteners');
  const ray = new T.Raycaster();
  root.updateMatrixWorld(true);
  for (const row of rows) {
    for (const { point, normal } of row) {
      const n = new T.Vector3(...normal).normalize();
      ray.set(new T.Vector3(...point).addScaledVector(n, 0.08), n.clone().negate());
      ray.far = 0.18;
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) continue;
      const surfaceNormal = hit.face.normal
        .clone()
        .applyNormalMatrix(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld));
      const head = d.add(
        new T.CircleGeometry(radius, 6),
        d.metal,
        hit.point.addScaledVector(surfaceNormal, 0.0008).toArray(),
      );
      head.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), surfaceNormal);
    }
  }
  d.finish();
}

export function addTransitDetail(root, rail = false, shape = {}) {
  const d = detailKit(root);
  const L = rail ? 27 : 12,
    W = rail ? 2.65 : 2.55,
    floor = rail ? 0.95 : 0.36;
  const front = L / 2;
  // The generator passes its cab surface: face(x, y, inset) is the z of the outer front face,
  // so the lettering, wipers and fascia follow a raked, rounded cab (default: a flat front).
  const {
    face = (_x, _y, inset = 0) => front - inset,
    signY = rail ? 3.37 : 2.68,
    signInset = -0.012,
  } = shape;
  const lean = Math.atan((face(0, signY - 0.1) - face(0, signY + 0.1)) / 0.2);
  // Both rail cabs carry the destination; the lettering leans back with the face and each
  // glyph follows the face's curve in plan.
  for (const end of rail ? [1, -1] : [1]) {
    const sign = d.text(
      rail ? 'BENDY LIGHT RAIL' : 'BENDY BUS',
      [0, signY, end * face(0, signY, signInset)],
      0.13,
      end > 0 ? 0 : Math.PI,
      d.amber,
    );
    sign.rotation.x = -end * lean;
    for (const glyph of sign.children)
      glyph.position.z += face(glyph.position.x, signY) - face(0, signY);
  }
  for (const side of [-1, 1]) {
    // Side lettering below the rail car's livery stripe; on the bus's lower panel.
    const lettering = floor + (rail ? 0.25 : 0.65);
    d.text('BENDY', [side * (W / 2 + 0.032), lettering, 1], 0.18, (side * Math.PI) / 2);
    for (const z of rail ? [-9.5, -3.5, 3.5, 9.5] : [-0.4, 4.7]) {
      d.rod(
        [side * (W / 2 + 0.035), floor + 0.1, z],
        [side * (W / 2 + 0.035), floor + 2, z],
        0.012,
        d.dark,
      );
      d.box([0.035, 0.1, 0.07], [side * (W / 2 + 0.04), floor + 1, z - 0.45], d.amber);
    }
    // Wipers lie on the windscreen (both cabs of the rail car).
    const wiper = [
      [side * 0.3, floor + 0.95],
      [side * 0.85, floor + 1.65],
    ];
    for (const end of rail ? [1, -1] : [1])
      d.rod(...wiper.map(([x, y]) => [x, y, end * (face(x, y) + 0.02)]), 0.016, d.dark);
    for (let z = -front + 2; z < front - 2; z += 1.25) {
      d.box([0.75, 0.1, 0.45], [side * 0.7, floor + 0.45, z], d.dark);
      d.box([0.75, 0.65, 0.09], [side * 0.7, floor + 0.8, z - 0.21], d.dark);
    }
    // Louvres in the grille of the bus's tall engine door.
    if (!rail)
      for (let i = 0; i < 7; i++)
        d.box([0.55, 0.018, 0.025], [side * 0.3, floor + 0.8 + i * 0.06, -front - 0.025], d.metal);
  }
  const cab = panelTools(d),
    py = floor + 1.31,
    pz = front - 0.765;
  // Cab furniture stops `gap` behind the cab face over its extent (xs, ys), so a raked,
  // rounded nose never cuts through it; the rear faces stay where the controls expect them.
  const behind = (xs, ys, gap) => Math.min(...xs.flatMap((x) => ys.map((y) => face(x, y)))) - gap;
  const deskFront = Math.min(
    front - 0.25,
    behind([-0.95, 0.95], [floor + 1.135, floor + 1.385], 0.03),
  );
  d.box(
    [1.9, 0.25, deskFront - front + 0.75],
    [0, floor + 1.26, (deskFront + front - 0.75) / 2],
    d.dark,
  );
  // The fascia closes into the front body and has supported returns beside the driver's knees.
  // It is built in strips set back from the cab face.
  const fasciaTop = floor + 1.15,
    span = W - 0.16;
  for (let i = 0; i < 10; i++) {
    const x0 = -span / 2 + (i * span) / 10,
      x1 = x0 + span / 10;
    const z = behind([x0, x1], [floor, fasciaTop], 0.1);
    d.box([x1 - x0, 1.15, 0.12], [(x0 + x1) / 2, floor + 0.575, z - 0.06], d.dark);
  }
  const returnFront = Math.min(front - 0.19, behind([0.77, 0.95], [floor, fasciaTop], 0.02));
  for (const side of [-1, 1])
    d.box(
      [0.18, 1.15, returnFront - front + 0.77],
      [side * 0.86, floor + 0.575, (returnFront + front - 0.77) / 2],
      d.dark,
    );
  d.box([0.36, 0.12, 0.45], [0.27, floor + 1.16, front - 0.92], d.dark);
  if (!rail)
    d.rod([0.55, floor + 1.25, front - 1.04], [0.55, floor + 0.5, front - 0.48], 0.045, d.dark);
  if (rail) {
    // Driver display, separate vehicle-monitor screen, guarded door and emergency controls.
    cab.display(0.53, py + 0.025, pz, 0.34, 0.2, 'driver');
    cab.display(-0.02, py + 0.025, pz, 0.32, 0.2, 'route');
    cab.gauge(0.84, py - 0.005, pz, 0.065);
    cab.display(-0.59, py + 0.025, pz, 0.25, 0.18, 'camera');
    for (const x of [-0.3, 0.22, 0.86]) {
      cab.buttons(x, py - 0.135, pz - 0.03, 4, 0.04);
      cab.knob(x, py + 0.15, pz, 0.017);
    }
    d.add(new T.CylinderGeometry(0.028, 0.028, 0.028, 12).rotateX(Math.PI / 2), d.red, [
      -0.31,
      py + 0.04,
      pz - 0.025,
    ]);
    d.text('DOORS', [-0.3, py - 0.17, pz - 0.033], 0.018, Math.PI);
    d.text('TRACTION', [0.26, py - 0.17, pz - 0.033], 0.018, Math.PI);
  } else {
    d.box([0.64, 0.2, 0.1], [0.55, py + 0.03, pz + 0.04], d.dark);
    cab.gauge(0.4, py + 0.02, pz - 0.012, 0.083);
    cab.gauge(0.7, py + 0.02, pz - 0.012, 0.083);
    cab.display(0.55, py + 0.015, pz - 0.015, 0.11, 0.085, 'driver');
    cab.display(-0.16, py + 0.13, pz + 0.02, 0.27, 0.16, 'route');
    cab.display(-0.61, py + 0.15, pz - 0.02, 0.2, 0.13, 'fare');
    for (let row = 0; row < 3; row++)
      cab.buttons(-0.12, py - 0.04 - row * 0.035, pz - 0.02, 5, 0.043);
    cab.vent(0.94, py + 0.02, pz, 'round', 0.11);
    cab.knob(-0.54, py - 0.06, pz, 0.021);
    cab.knob(-0.68, py - 0.06, pz, 0.021);
    d.text('DOORS', [-0.13, py - 0.16, pz - 0.025], 0.02, Math.PI);
  }
  // Radio handset and flexible cord remain below the windscreen.
  d.box([0.045, 0.12, 0.035], [-0.86, py - 0.02, pz - 0.04], d.dark);
  for (let i = 0; i < 7; i++)
    d.ring(0.013, 0.002, [-0.86, py - 0.1 - i * 0.016, pz - 0.035], d.metal, 'y');
  d.box([0.5, 0.12, 0.5], [0.55, floor + 0.65, front - 1.3], d.dark);
  d.box([0.24, 0.59, 0.28], [0.55, floor + 0.295, front - 1.3], d.dark);
  d.box([0.5, 0.7, 0.1], [0.55, floor + 1, front - 1.55], d.dark);
  // Articulation ribs. (Bus wheels are steel disc wheels modelled by the bus generator.)
  if (rail)
    for (let i = -5; i <= 5; i++)
      for (const side of [-1, 1])
        d.box([0.035, 2.3, 0.035], [side * (W / 2 - 0.1), floor + 1.3, i * 0.085], d.metal);
  d.finish();
  const control = new T.Group();
  control.name = rail ? 'traction-lever' : 'steering-wheel';
  control.position.set(rail ? 0.27 : 0.55, floor + 1.25, front - 1.04);
  root.add(control);
  const c = detailKit(control, 'cab-control');
  if (rail) {
    c.rod([0, 0, 0], [0, 0.16, 0], 0.018);
    c.box([0.08, 0.04, 0.04], [0, 0.17, 0], c.dark);
  } else {
    c.ring(0.22, 0.02, [0, 0, 0], c.dark);
    for (const x of [-0.2, 0.2]) c.rod([0, 0, 0], [x, 0, 0], 0.014);
  }
  c.finish();
}
