import * as T from 'three';
import {
  actuatorSources,
  actuatorBinding as bind,
  boxPlanes,
  extractPanel,
  pivot,
} from './articulation-geometry.mjs';

/** Road body panels use the same measured shut lines as the shell builder. */
export function articulateRoadVehicle(root, s, frame) {
  const { length: L, width: W, height: H, form: f } = s;
  const { cowl, bz, rearShut, coupeShut, clearance, belt, roofY, rb, rr, black } = frame;
  const specs = {
    hood: { seconds: 1.8 },
    trunk: { seconds: 1.8 },
    headlights: { seconds: 0 },
    wipers: { seconds: 1.4, mode: 'cycle' },
  };
  const bindings = [];
  const shell = (mesh) =>
    !/wheel|tire|brake|steering|pointer|needle/i.test(mesh.name) && !mesh.name.startsWith('wiper');
  for (const side of [-1, 1]) {
    const two = f.twoDoor || (f.asymmetricDoors && side > 0);
    const doors = [['Front', two ? coupeShut : bz, cowl - 0.035]];
    if (!two && !f.cargoVan) doors.push(['Rear', rearShut, bz - 0.02]);
    for (const [label, aft, fore] of doors) {
      const name = `door${label}${side > 0 ? 'Left' : 'Right'}`;
      const node = pivot(root, name, [side * W * 0.45, belt, fore]);
      const min = [side > 0 ? W * 0.31 : -W, clearance + 0.08, aft + 0.012];
      const max = [side > 0 ? W : -W * 0.31, roofY - 0.055, fore];
      extractPanel(root, node, boxPlanes(min, max), shell);
      specs[name] = { seconds: 1.2 };
      // Rear minivan doors translate aft, away from the side before sliding.
      if (label === 'Rear' && s.bodyStyle === 'van') {
        bindings.push(bind(node, name, 'position', 'z', -0.9));
        bindings.push({
          node: name,
          source: name,
          property: 'position',
          axis: 'x',
          keys: [
            [0, 0],
            [0.15, side * 0.12],
            [1, side * 0.12],
          ],
        });
      } else bindings.push(bind(node, name, 'rotation', 'y', -side * 1.15));
    }
  }
  const hood = pivot(root, 'hood', [0, belt, cowl + 0.025]);
  extractPanel(
    root,
    hood,
    boxPlanes([-W * 0.38, H * 0.44, cowl + 0.025], [W * 0.38, H, L / 2 - 0.09]),
    (mesh) => shell(mesh) && /body-shell|exterior-fittings/.test(mesh.name),
  );
  bindings.push(bind(hood, 'hood', 'rotation', 'x', -1.05));
  // A dark recessed bay gives open panels depth without fabricating a particular engine. The
  // shell builder shapes it inside the hood, nose and plan outline (road-vehicle-geometry.mjs);
  // a builder without one gets a box kept well inside the hood opening.
  if (!root.getObjectByName('engine-bay')) {
    const depth = Math.max(0.15, L / 2 - cowl - 0.45);
    const bay = new T.Mesh(new T.BoxGeometry(W * 0.5, 0.12, depth), black);
    bay.name = 'engine-bay';
    bay.position.set(0, Math.min(H * 0.43, belt - 0.15), cowl + 0.05 + depth / 2);
    root.add(bay);
  }
  const pickup = s.bodyStyle === 'pickup';
  const deck = ['sedan', 'coupe', 'fastback', 'roadster'].includes(s.bodyStyle);
  const hatch = pivot(root, 'trunk', [
    0,
    pickup ? clearance + 0.2 : deck ? belt : roofY - 0.04,
    deck ? rb : pickup ? -L / 2 + 0.06 : rr,
  ]);
  const hatchPlanes = boxPlanes(
    [-W * 0.43, pickup ? clearance + 0.2 : deck ? belt - 0.04 : clearance + 0.12, -L],
    [W * 0.43, H + 0.1, deck ? rb - 0.02 : pickup ? -L / 2 + 0.14 : rr - 0.025],
  );
  if (!pickup && !deck)
    hatchPlanes.push(
      (p) =>
        -L / 2 +
        0.12 +
        (rr + L / 2 - 0.12) *
          Math.max(0, Math.min(1, (p[1] - clearance - 0.12) / (roofY - clearance - 0.12))) -
        p[2],
    );
  extractPanel(root, hatch, hatchPlanes, (mesh) => shell(mesh) && !/cabin/.test(mesh.name));
  bindings.push(bind(hatch, 'trunk', 'rotation', 'x', pickup ? -1.55 : 1.05));
  for (const side of [-1, 1])
    bindings.push({
      node: `wiper-${side}`,
      source: 'wipers',
      property: 'rotation',
      axis: 'z',
      keys: [
        [0, 0],
        [0.5, 1.35],
        [1, 0],
      ],
      ease: 'smooth',
    });
  const lamps = pivot(root, 'headlights-lit');
  root.updateMatrixWorld(true);
  const matches = [];
  root.traverse((mesh) => {
    if (mesh.isMesh && mesh.material?.name === 'led-optics' && mesh.name.includes('front-fascia'))
      matches.push(mesh);
  });
  for (const [i, mesh] of matches.entries()) {
    const material = mesh.material.clone();
    material.name = 'headlight-emission';
    material.emissive.set('#fff1cf');
    material.emissiveIntensity = 2;
    const lens = new T.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), material);
    lens.name = `headlight-glow-${i}`;
    lens.position.z = 0.003;
    lamps.add(lens);
  }
  bindings.push(bind(lamps, 'headlights', 'visible', undefined, 1));
  root.userData.molenActuators = specs;
  root.userData.molenAnimation = { sources: actuatorSources(specs, 'vehicleState'), bindings };
  return root;
}

/** Coach entry, cab doors and service hatches share the same actuator vocabulary as cars. */
export function articulateMotorhome(root, s, { cab, cabRear, doorZ }) {
  const { length: L, width: W, cabWidth: cw, floor } = s,
    front = L / 2;
  const specs = {
    hood: { seconds: 1.8 },
    trunk: { seconds: 1.8 },
    wipers: { seconds: 1.4, mode: 'cycle' },
    headlights: { seconds: 0 },
  };
  const bindings = [];
  const skin = (n) => !/interior|cabin|wheel|wiper|steering/.test(n.name);
  const cut = (name, at, min, max, axis, angle) => {
    const node = pivot(root, name, at);
    if (!extractPanel(root, node, boxPlanes(min, max), skin)) throw Error(`${s.id}: empty ${name}`);
    bindings.push(bind(node, name, 'rotation', axis, angle));
    specs[name] ??= { seconds: 1.2 };
    return node;
  };
  if (s.rvClass !== 'A')
    for (const side of [-1, 1]) {
      const fore = front - cab.cowl - 0.025,
        aft = cabRear + 0.16;
      cut(
        `doorFront${side > 0 ? 'Left' : 'Right'}`,
        [side * cw * 0.46, cab.belt, fore],
        [side > 0 ? cw * 0.32 : -cw, 0.45, aft],
        [side > 0 ? cw : -cw * 0.32, cab.glassTop, fore],
        'y',
        -side * 1.15,
      );
    }
  const entry = s.rvClass === 'B' ? cabRear - 0.65 : doorZ;
  cut(
    'doorRearRight',
    [-W / 2, floor + 0.9, entry + 0.32],
    [-W / 2 - 0.08, floor - 0.02, entry - 0.32],
    [-W / 2 + 0.18, floor + 1.8, entry + 0.32],
    'y',
    1.15,
  );
  if (s.rvClass === 'B') {
    const b = bindings.pop();
    bindings.push({ ...b, property: 'position', axis: 'z', scale: -0.85 });
    bindings.push({
      node: 'doorRearRight',
      source: 'doorRearRight',
      property: 'position',
      axis: 'x',
      keys: [
        [0, 0],
        [0.15, -0.12],
        [1, -0.12],
      ],
    });
  }
  if (cab)
    cut(
      'hood',
      [0, cab.belt, front - cab.cowl],
      [-cw * 0.36, cab.nose * 0.85, front - cab.cowl],
      [cw * 0.36, cab.belt + 0.1, front - 0.1],
      'x',
      -1.05,
    );
  else
    cut(
      'hood',
      [0, 1.2, -L / 2 + 0.08],
      [-W * 0.3, 0.6, -L / 2 - 0.1],
      [W * 0.3, 1.2, -L / 2 + 0.2],
      'x',
      -1.05,
    );
  cut('trunk', [W / 2, 0.9, -1.3], [W / 2 - 0.15, 0.45, -1.3], [W / 2 + 0.1, 0.9, -0.3], 'z', 1.15);
  for (const side of [-1, 1])
    bindings.push({
      node: `wiper-${side}`,
      source: 'wipers',
      property: 'rotation',
      axis: 'z',
      keys: [
        [0, 0],
        [0.5, 1.35],
        [1, 0],
      ],
      ease: 'smooth',
    });
  const lamps = pivot(root, 'headlights-lit');
  extractPanel(root, lamps, boxPlanes([-W, 0.85, front - 1.4], [W, 1.5, front + 0.2]), (n) =>
    /led-optics|coach-lens-white/.test(n.material?.name ?? ''),
  );
  // The unlit optical lens stays visible; emission is an overlay driven by the state.
  const unlit = lamps.clone();
  unlit.name = 'headlights-unlit';
  root.add(unlit);
  lamps.traverse((n) => {
    if (n.isMesh) {
      n.material = n.material.clone();
      n.material.emissive.set('#fff1cf');
      n.material.emissiveIntensity = 2;
      n.position.z += 0.002;
    }
  });
  bindings.push(bind(lamps, 'headlights', 'visible', undefined, 1));
  root.userData.molenActuators = specs;
  root.userData.molenAnimation = { sources: actuatorSources(specs, 'vehicleState'), bindings };
  return root;
}
