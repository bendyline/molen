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
  const d = detailKit(root),
    bike = s.family === 'bicycle';
  const { height: H, width: W, wheelRadius: r, wheelbase: wb } = s;
  for (const name of ['wheel-front', 'wheel-rear'])
    addWheelDetail(
      root.getObjectByName(name),
      r,
      bike ? 0.06 : name === 'wheel-front' ? 0.16 : 0.2,
      bike,
    );
  // A scooter's belt drive, engine and fork are enclosed; chains, fins and tubes are not.
  const scooter = s.shape === 'motor-scooter';
  if (!scooter) {
    d.rod([-0.11, r, -wb / 2], [-0.11, r * 0.85, -wb * 0.1], 0.012, d.dark);
    d.rod([-0.11, r - 0.09, -wb / 2], [-0.11, r * 0.85 - 0.09, -wb * 0.1], 0.012, d.dark);
    d.ring(bike ? 0.09 : 0.11, 0.018, [-0.12, r * 0.85, -wb * 0.1], d.metal, 'x');
  }
  if (scooter)
    for (const side of [-1, 1])
      d.text('BENDY', [side * 0.212, 0.62, -0.48], 0.05, (side * Math.PI) / 2);
  else if (!bike) {
    for (let i = 0; i < 6; i++) d.box([0.35, 0.018, 0.32], [0, r * 1.15 + i * 0.04, -0.04], d.dark);
    for (const x of [-0.13, 0.13]) d.rod([x, r * 1.7, 0.14], [x, r * 0.75, 0.27], 0.027, d.metal);
    d.ring(0.037, 0.008, [0, H * 0.85 + 0.006, 0.15], d.metal, 'y');
    d.text('BENDY', [0.225, H * 0.71, 0.05], 0.045, Math.PI / 2);
    d.text('BENDY', [-0.225, H * 0.71, 0.05], 0.045, -Math.PI / 2);
  }
  const handlebars = root.getObjectByName('handlebar');
  const controls = detailKit(handlebars, 'rider-controls');
  const sweep = s.handlebarSweep ?? 0;
  for (const side of [-1, 1]) {
    controls.rod([side * W * 0.3, 0, -sweep], [side * W * 0.44, -0.035, -sweep + 0.07], 0.009);
    if (!bike) {
      controls.rod([side * W * 0.25, 0, -sweep], [side * W * 0.38, 0.18, -sweep + 0.04], 0.008);
      controls.box([0.115, 0.065, 0.018], [side * W * 0.38, 0.2, -sweep + 0.04], controls.metal);
    }
  }
  const p = panelTools(controls);
  const z = -sweep + 0.04;
  if (bike) {
    if (s.shape === 'road-bicycle') p.display(0, 0.035, z - 0.012, 0.045, 0.055, 'ride');
    else if (s.shape === 'city-bicycle') {
      controls.add(
        new T.SphereGeometry(0.025, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        controls.metal,
        [-W * 0.2, 0.02, z],
      );
      controls.box([0.026, 0.007, 0.012], [-W * 0.16, 0.02, z - 0.02], controls.dark);
    } else {
      p.display(-0.025, 0.025, z - 0.01, 0.036, 0.037, 'ride');
      p.knob(W * 0.2, 0.012, z, 0.013);
    }
  } else if (s.shape === 'cruiser-motorcycle') {
    // Tank-top speedometer; mounted to the chassis rather than turning with the handlebars.
    const instruments = detailKit(root, 'tank-instruments');
    const face = new T.Group();
    face.rotation.x = 0.8;
    face.position.set(0, H * 0.87, 0.04);
    instruments.root.add(face);
    const kit = detailKit(face, 'cruiser-gauge');
    panelTools(kit).gauge(0, 0, 0, 0.069, kit.ivory);
    kit.finish();
    instruments.finish();
  } else if (s.shape === 'motor-scooter') {
    controls.box([0.21, 0.15, 0.06], [0, 0.05, z + 0.02], controls.dark);
    p.gauge(0, 0.055, z - 0.018, 0.058, controls.ivory);
    p.gauge(-0.08, 0.015, z - 0.02, 0.024);
  } else {
    p.gauge(-0.055, 0.065, z - 0.01, 0.06);
    p.display(0.065, 0.05, z - 0.012, 0.085, 0.065, 'ride');
  }
  for (const side of [-1, 1]) {
    const x = side * W * 0.29;
    controls.box([0.04, 0.04, 0.035], [x, 0, -sweep], controls.dark);
    controls.box(
      [0.014, 0.009, 0.008],
      [x, 0.012, -sweep - 0.022],
      side < 0 && !bike ? controls.red : controls.ivory,
    );
    if (!bike)
      controls.box([0.06, 0.045, 0.055], [side * W * 0.2, 0.02, -sweep + 0.03], controls.dark);
    for (let i = 0; i < 5; i++)
      controls.rod(
        [x, -i * 0.035, z + 0.03 + i * 0.025],
        [x, -(i + 1) * 0.035, z + 0.055 + i * 0.025],
        0.003,
        controls.dark,
      );
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
  for (const side of [-1, 1]) {
    for (const z of [-L * 0.35, L * 0.26]) {
      const x = side * edge(z, 0.16 * size);
      d.box([0.17 * size, 0.04, 0.28 * size], [x, y + 0.11, z], d.metal);
      d.rod([x, y + 0.1, z], [x, y + 0.24 * size, z], 0.035 * size);
      d.rod(
        [x, y + 0.24 * size, z - 0.15 * size],
        [x, y + 0.24 * size, z + 0.15 * size],
        0.025 * size,
      );
    }
    // Hull lettering lies on the topsides (tilted with their flare), not standing off them.
    const topside = hull?.sideAt(0, y * 0.55) ?? { x: W / 2, tilt: 0 };
    const name = d.text(
      'BENDY',
      [side * (topside.x + 0.006), y * 0.55, 0],
      Math.min(0.42, y * 0.22),
      (side * Math.PI) / 2,
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
  // Deck hatch with raised coaming and a pair of visible hinges.
  d.box([W * 0.25, 0.035, Math.min(1.2, L * 0.12)], [0, y + 0.1, L * 0.32], d.dark);
  for (const x of [-W * 0.09, W * 0.09])
    d.box([0.09, 0.025, 0.035], [x, y + 0.13, L * 0.32 - Math.min(0.6, L * 0.06)], d.metal);
  if (L < 30) {
    for (let i = -3; i <= 3; i++)
      d.rod([i * W * 0.1, y + 0.086, -L * 0.34], [i * W * 0.1, y + 0.086, L * 0.25], 0.004, d.dark);
    for (const side of [-1, 1]) {
      const ringY = hull ? Math.max(y + 0.42, hull.sheerAt(-L * 0.28) + 0.25) : y + 0.42;
      d.ring(0.19, 0.047, [side * W * 0.34, ringY, -L * 0.28], d.ivory, 'x');
      d.rod(
        [side * W * 0.34, ringY + 0.25, -L * 0.28],
        [side * W * 0.34, ringY + 0.19, -L * 0.28],
        0.01,
        d.dark,
      );
    }
  }
  if (s.shape === 'sailboat') {
    for (const side of [-1, 1])
      d.rod([0, s.height * 0.82, L * 0.06], [side * W * 0.42, y + 0.15, 0], 0.009, d.metal);
    d.rod([0, s.height * 0.88, L * 0.06], [0, y + 0.1, L * 0.44], 0.009, d.metal);
    d.rod([0, s.height * 0.88, L * 0.06], [0, y + 0.1, -L * 0.44], 0.009, d.metal);
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

export function addTransitDetail(root, rail = false) {
  const d = detailKit(root);
  const L = rail ? 27 : 12,
    W = rail ? 2.65 : 2.55,
    floor = rail ? 0.95 : 0.36;
  const front = L / 2;
  d.text(
    rail ? 'BENDY LIGHT RAIL' : 'BENDY BUS',
    [0, rail ? 3.37 : 2.68, front + 0.012],
    0.13,
    0,
    d.amber,
  );
  for (const side of [-1, 1]) {
    d.text('BENDY', [side * (W / 2 + 0.032), floor + 0.65, 1], 0.18, (side * Math.PI) / 2);
    for (const z of rail ? [-9.5, -3.5, 3.5, 9.5] : [-0.4, 4.7]) {
      d.rod(
        [side * (W / 2 + 0.035), floor + 0.1, z],
        [side * (W / 2 + 0.035), floor + 2, z],
        0.012,
        d.dark,
      );
      d.box([0.035, 0.1, 0.07], [side * (W / 2 + 0.04), floor + 1, z - 0.45], d.amber);
    }
    d.rod([side * 0.3, floor + 0.95, front], [side * 0.85, floor + 1.65, front], 0.016, d.dark);
    for (let z = -front + 2; z < front - 2; z += 1.25) {
      d.box([0.75, 0.1, 0.45], [side * 0.7, floor + 0.45, z], d.dark);
      d.box([0.75, 0.65, 0.09], [side * 0.7, floor + 0.8, z - 0.21], d.dark);
    }
    for (let i = 0; i < 7; i++)
      d.box([0.65, 0.018, 0.025], [side * 0.5, floor + 0.4 + i * 0.07, -front - 0.025], d.metal);
  }
  const cab = panelTools(d),
    py = floor + 1.31,
    pz = front - 0.765;
  d.box([1.9, 0.25, 0.5], [0, floor + 1.26, front - 0.5], d.dark);
  // The fascia closes into the front body and has supported returns beside the driver's knees.
  d.box([W - 0.16, 1.15, 0.12], [0, floor + 0.575, front - 0.16], d.dark);
  for (const side of [-1, 1])
    d.box([0.18, 1.15, 0.58], [side * 0.86, floor + 0.575, front - 0.48], d.dark);
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
  if (rail) {
    for (let i = -5; i <= 5; i++)
      for (const side of [-1, 1])
        d.box([0.035, 2.3, 0.035], [side * (W / 2 - 0.1), floor + 1.3, i * 0.085], d.metal);
  } else {
    root.traverse((node) => {
      if (/^wheel-(front|rear)-(left|right)$/.test(node.name)) addWheelDetail(node, 0.5, 0.32);
    });
  }
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
