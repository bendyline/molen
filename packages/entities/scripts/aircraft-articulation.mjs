/** Exterior mechanisms. Reference scope and approximations: source/ANIMATION-COVERAGE.md. */
import * as T from 'three';
import {
  actuatorSources,
  actuatorBinding as bind,
  boxPlanes,
  extractPanel,
  pivot,
} from './articulation-geometry.mjs';
import { detailKit } from './vehicle-detail.mjs';

const dorsalBrakes = {
  'f-15c': [0, 2.9, 2.2, 1.1, 2.1],
  'fa-18c': [0, 2.62, -2.4, 0.8, 2.2],
  typhoon: [0, 2.35, 1.3, 0.75, 1.3],
  'av-8b': [0, 0.9, -2.0, 0.65, 0.95],
};
const splitBrakes = {
  'f-14d': [0, 2.05, -5.0, 1.25, 1.6],
  'mig-29a': [0, 1.8, -5.6, 0.7, 1.0],
  'f-16b': [0.65, 1.8, -5.0, 0.4, 0.75],
  'gripen-c': [0.65, 1.8, -3.4, 0.45, 0.8],
};
const hooks = { 'f-14d': [0, 1.9, -4.8, 1.7], 'fa-18c': [0, 1.32, -3.9, 1.7] };

function authoredMaterial(root, pattern, fallback) {
  let found;
  root.traverse((n) => {
    if (!found && n.isMesh && pattern.test(n.material?.name)) found = n.material;
  });
  return found ?? new T.MeshStandardMaterial({ color: fallback, roughness: 0.6 });
}
function movingParent(node, name) {
  const holder = pivot(node.parent, name, node.position.toArray());
  holder.quaternion.copy(node.quaternion);
  node.position.set(0, 0, 0);
  node.quaternion.identity();
  holder.add(node);
  holder.userData.articulated = true;
  return holder;
}

export function completeAircraftArticulation(root, spec, profile = {}, modelSignals) {
  const slug = profile.slug ?? root.name;
  const visual = spec.visual;
  visual.animation ??= { bindings: [] };
  const animation = visual.animation;
  // Base generators read their last emitted definitions. Remove this pass's bindings before
  // regenerating geometry so repeat builds neither duplicate channels nor omit their nodes.
  if (['airliner', 'p-51', 'oh-6'].includes(slug))
    animation.bindings = animation.bindings.filter(
      (b) =>
        !/^(airliner-|canopy-|speed-brake-|arresting-hook)/.test(b.node) &&
        !/well-door|release$|blade-jettison/.test(b.node) &&
        !(slug === 'airliner' && visual.gearNodes.includes(b.node)),
    );
  const bindings = animation.bindings;
  const additions = [];
  spec.actuators ??= {};
  const actuators = spec.actuators;
  const paint = authoredMaterial(root, /paint|gray|grey|white|airframe/i, '#929b9f');
  const metal = authoredMaterial(root, /alloy|metal/i, '#9ca6aa');
  const heli = spec.model === 'helicopter';
  const fighter = profile.category === 'fighter' || profile.category === 'vtol';
  const box = (parent, name, size, at, material = paint) => {
    const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.fromArray(at);
    parent.add(mesh);
    return mesh;
  };
  // Legacy fixed-gear flags conflated a tailwheel arrangement with fixed main wheels.
  if (['dc-3', 'beech-18'].includes(slug)) {
    delete spec.airplane.fixedGear;
    spec.airplane.gearTransitTime = 8;
  }
  if (heli) {
    spec.helicopter.fixedGear = slug !== 'aw139';
    spec.helicopter.gearTransitTime = slug === 'aw139' ? 7 : 0;
  }
  // Existing, aircraft-specific gear rigs retain their authored hinges and sequences.
  for (const name of visual.gearNodes) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    const existing = bindings.find((b) => b.node === name && b.property === 'rotation');
    if (existing && !/^gear-\d$/.test(name)) continue;
    if (existing) bindings.splice(bindings.indexOf(existing), 1);
    const nose = /nose/.test(name) || name === 'gear-0';
    const side = Math.sign(node.position.x) || 1;
    const angle = nose ? -Math.PI / 2 : (-side * Math.PI) / 2;
    additions.push({
      node: name,
      source: 'gear',
      property: 'rotation',
      axis: nose ? 'x' : 'z',
      keys: [
        [0, angle],
        [0.15, angle],
        [0.85, 0],
        [1, 0],
      ],
      ease: 'smooth',
    });
    // The 737-like main wheels remain exposed in their wells; no invented enclosing main doors.
    if (!nose && ['airliner', 'boeing-737-800'].includes(slug)) continue;
    const door = pivot(node.parent, `${name}-well-door`, node.position.toArray());
    const radius = nose ? spec.length * 0.008 : spec.length * 0.014;
    box(door, `${name}-door-skin`, [radius * 2.4, 0.025, radius * 4], [radius * 1.2, 0.015, 0]);
    additions.push({
      node: door.name,
      source: 'gear',
      property: 'rotation',
      axis: 'z',
      keys: [
        [0, 0],
        [0.13, 1.45],
        [0.87, 1.45],
        [1, nose ? 1.45 : 0],
      ],
      ease: 'smooth',
    });
  }
  if (slug === 'airliner') {
    spec.airplane.gearTransitTime = 10;
    spec.airplane.flapTransitTime = 6;
    for (const side of [-1, 1]) {
      const node = root.getObjectByName(side > 0 ? 'wing-left' : 'wing-right');
      const hingeZ = (x) =>
        7.339 -
        0.524 * x -
        0.72 *
          (7.339 -
            0.524 * 6.78 +
            0.052 +
            ((1.56 - (7.339 - 0.524 * 6.78 + 0.052)) * (x - 6.78)) / (17.9 - 6.78));
      const control = pivot(node.parent, `airliner-aileron-${side}`, [
        side * 12.0,
        -1.1 + 0.089 * 11,
        hingeZ(12),
      ]);
      extractPanel(
        node.parent,
        control,
        [(p) => side * p[0] - 9.5, (p) => 16.3 - side * p[0], (p) => hingeZ(side * p[0]) - p[2]],
        (mesh) => mesh === node,
      );
      additions.push(bind(control, 'rollInput', 'rotation', 'x', -side * 0.3));
      const tail = root.getObjectByName(side > 0 ? 'stabilizer-left' : 'stabilizer-right');
      const hinge = (x) =>
        -13.22 - (4.12 * (x - 0.2)) / 6.26 - 0.72 * (3.91 - (2.61 * (x - 0.2)) / 6.26);
      const elevator = pivot(tail.parent, `airliner-elevator-${side}`, [
        side * 3,
        4.77 + 0.105 * 3,
        hinge(3),
      ]);
      elevator.quaternion.setFromUnitVectors(
        new T.Vector3(1, 0, 0),
        new T.Vector3(1, side * 0.105, (side * (-4.12 + 0.72 * 2.61)) / 6.26).normalize(),
      );
      extractPanel(
        root,
        elevator,
        [(p) => side * p[0] - 0.8, (p) => hinge(side * p[0]) - p[2]],
        (mesh) => mesh === tail,
      );
      additions.push(bind(elevator, 'elevator', 'rotation', 'x', 0.4));
    }
    const fin = root.getObjectByName('fin-surface');
    const finHinge = (y) =>
      -11.01 - (5.59 * (y - 5.4)) / 6.8 - 0.72 * (5.93 - (3.88 * (y - 5.4)) / 6.8);
    const rudder = pivot(root, 'airliner-rudder', [0, 7, finHinge(7)]);
    rudder.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      new T.Vector3(0, 1, (-5.59 + 0.72 * 3.88) / 6.8).normalize(),
    );
    extractPanel(
      root,
      rudder,
      [(p) => p[1] - 5.7, (p) => finHinge(p[1]) - p[2]],
      (mesh) => mesh === fin,
    );
    additions.push(bind(rudder, 'yawInput', 'rotation', 'y', 0.45));
  }
  // Open the actual glazing and frame. The fixed forward windshield stays on the airframe.
  if (fighter || slug === 'p-51') {
    const eye = spec.pilotEye;
    const canopy =
      root.getObjectByName('canopy-opening') ??
      pivot(root, 'canopy-opening', [0, eye[1] - 0.35, eye[2] + (slug === 'f-35a' ? 0.4 : -1.0)]);
    const count = canopy.children.length || extractAircraftCanopy(root, canopy, spec, slug);
    if (count) {
      actuators.canopy = { seconds: 3 };
      additions.push(
        bind(
          canopy,
          'canopy',
          slug === 'p-51' ? 'position' : 'rotation',
          slug === 'p-51' ? 'z' : 'x',
          slug === 'p-51' ? -1.15 : slug === 'f-35a' ? 0.85 : -0.85,
        ),
      );
      if (slug === 'f-35a') shatterCanopy(canopy, additions);
      else {
        const ejection = movingParent(canopy, 'canopy-jettison');
        additions.push({
          node: ejection.name,
          source: 'eject',
          property: 'position',
          axis: 'y',
          keys: [
            [0, 0],
            [0.12, 0],
            [0.45, 6],
            [1, 20],
          ],
        });
        additions.push({
          node: ejection.name,
          source: 'eject',
          property: 'visible',
          keys: [
            [0, 1],
            [0.85, 1],
            [0.86, 0],
            [1, 0],
          ],
        });
      }
    }
  }
  // Emergency jettison is an explicit gameplay facility, not a claim of real helicopter seats.
  if (heli) {
    for (const rotor of visual.rotors) {
      const node = root.getObjectByName(rotor.node);
      if (!node) continue;
      const release = movingParent(node, `${rotor.node}-release`);
      releaseRotorBlades(node, rotor, additions);
      additions.push({
        node: release.name,
        source: 'eject',
        property: 'position',
        axis: 'y',
        keys: [
          [0, 0],
          [0.08, 0],
          [0.5, 1],
          [1, 3],
        ],
      });
      additions.push({
        node: release.name,
        source: 'eject',
        property: 'position',
        axis: 'x',
        keys: [
          [0, 0],
          [0.08, 0],
          [1, 0],
        ],
      });
      additions.push({
        node: release.name,
        source: 'eject',
        property: 'visible',
        keys: [
          [0, 1],
          [0.9, 1],
          [0.91, 0],
          [1, 0],
        ],
      });
      // Rotor-disc cyclic tilt is proportional to pilot input while the hub keeps spinning.
      if (rotor.axis === 'y') {
        additions.push(bind(release, 'pitchInput', 'rotation', 'x', 0.1));
        additions.push(bind(release, 'rollInput', 'rotation', 'z', 0.1));
      }
    }
  }
  if (additions.some((binding) => binding.source === 'eject'))
    actuators.eject = { seconds: 1.2, mode: 'latch' };
  else delete actuators.eject;
  if (hooks[slug]) {
    const [x, y, z, length] = hooks[slug];
    const hook = root.getObjectByName('arresting-hook') ?? pivot(root, 'arresting-hook', [x, y, z]);
    if (!hook.children.length) {
      const d = detailKit(hook, 'hook-skin');
      d.rod([0, 0, 0], [0, -0.1, -length], 0.04, metal);
      d.rod([0, -0.1, -length], [0, 0.02, -length - 0.12], 0.055, metal);
      d.finish();
    }
    actuators.tailHook = { seconds: 2.5 };
    additions.push(bind(hook, 'tailHook', 'rotation', 'x', -0.7));
  }
  const dorsal = dorsalBrakes[slug],
    split = splitBrakes[slug];
  if (dorsal || split) {
    actuators.speedBrake = { seconds: slug === 'fa-18c' ? 2.4 : 1.6 };
    const [x, y, z, width, length] = dorsal ?? split;
    for (const side of split && x !== 0 ? [-1, 1] : [1])
      for (const leaf of split ? [-1, 1] : [1]) {
        for (const section of slug === 'f-14d' && leaf < 0 ? [-1, 1] : [0]) {
          const panel = pivot(root, `speed-brake-${side}-${leaf}-${section}`, [
            side * x + (section * width) / 4,
            y,
            z,
          ]);
          box(
            panel,
            `${panel.name}-skin`,
            [section ? width / 2 - 0.02 : width, 0.025, length],
            [0, leaf * 0.025, -length / 2],
          );
          additions.push(
            bind(
              panel,
              'speedBrake',
              'rotation',
              'x',
              (slug === 'av-8b' ? -1 : leaf) * (slug === 'fa-18c' ? Math.PI / 3 : 0.95),
            ),
          );
        }
      }
  } else if (['f-22a', 'f-35a', 'rafale-c'].includes(slug)) {
    actuators.speedBrake = { seconds: 1.6 };
    // These airframes brake through coordinated controls, without a dorsal brake panel.
    const candidates = bindings.filter(
      (b) => b.property === 'rotation' && /rudder|elevon|flaperon/i.test(b.node),
    );
    animation.derived ??= {};
    animation.derived.brakePosition = { op: 'coalesce', args: ['speedBrake', 0] };
    for (const [i, b] of candidates.entries()) {
      const mix = `brakeMix${i}`;
      animation.derived[`${mix}Deflection`] = {
        op: 'multiply',
        args: ['brakePosition', i % 2 ? -0.35 : 0.35],
      };
      animation.derived[`${mix}Sum`] = { op: 'add', args: [b.source, `${mix}Deflection`] };
      animation.derived[mix] = { op: 'clamp', args: [`${mix}Sum`, -1, 1] };
      b.source = mix;
    }
  } else if (
    !heli &&
    ['airliner', 'regional', 'business', 'cargo'].includes(profile.category ?? slug) &&
    !['c-130j', 'dash-8-q400', 'atr-72-600'].includes(slug)
  ) {
    actuators.speedBrake = { seconds: 2 };
    // Spanwise spoiler panels follow the wing skin; no duplicated intact surface underneath.
    root.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const panel = wingSpoiler(root, spec, side);
      additions.push(bind(panel, 'speedBrake', 'rotation', 'x', 0.9));
    }
  }
  addJetTurbines(root, spec, slug);
  if (actuators.speedBrake && spec.airplane) spec.airplane.speedBrakeDrag = 0.08;
  animation.sources = { ...animation.sources, ...actuatorSources(actuators, 'aircraftState') };
  bindings.push(...additions);
  if (modelSignals) {
    modelSignals.sources = {
      ...modelSignals.sources,
      ...actuatorSources(actuators, 'aircraftState'),
    };
    modelSignals.bindings.push(...additions);
    modelSignals.derived = { ...modelSignals.derived, ...animation.derived };
  }
  root.userData.molenActuators = actuators;
  return root;
}

function shatterCanopy(canopy, bindings) {
  // F-35's canopy is fractured by its escape system; it is not jettisoned as one hood.
  canopy.updateWorldMatrix(true, true);
  const inv = canopy.matrixWorld.clone().invert(),
    bounds = new T.Box3();
  canopy.traverse((n) => {
    if (n.isMesh && /canopy|glass/.test(n.material?.name ?? '')) {
      const a = n.geometry.attributes.position;
      for (let i = 0; i < a.count; i++)
        bounds.expandByPoint(
          new T.Vector3().fromBufferAttribute(a, i).applyMatrix4(n.matrixWorld).applyMatrix4(inv),
        );
    }
  });
  const middle = bounds.getCenter(new T.Vector3());
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const shard = pivot(canopy, `canopy-fragment-${side}-${end}`);
      if (
        !extractPanel(
          canopy,
          shard,
          [(p) => side * (p[0] - middle.x), (p) => end * (p[2] - middle.z)],
          (n) => /canopy|glass/.test(n.material?.name ?? ''),
        )
      )
        continue;
      for (const [axis, value] of [
        ['x', side * 8],
        ['y', 12],
        ['z', end * 6],
      ])
        bindings.push({
          node: shard.name,
          source: 'eject',
          property: 'position',
          axis,
          keys: [
            [0, 0],
            [0.08, 0],
            [1, value],
          ],
        });
      bindings.push({
        node: shard.name,
        source: 'eject',
        property: 'visible',
        keys: [
          [0, 1],
          [0.85, 1],
          [0.86, 0],
          [1, 0],
        ],
      });
    }
}

function extractAircraftCanopy(root, target, spec, slug) {
  root.updateWorldMatrix(true, true);
  const eye = spec.pilotEye,
    rows = new Map(),
    inv = root.matrixWorld.clone().invert();
  const exterior = (mesh) => {
    for (let n = mesh; n && n !== root; n = n.parent)
      if (/cockpit|interior|instrument|display/i.test(n.name)) return false;
    return true;
  };
  const isGlass = (mesh) =>
    exterior(mesh) && /canopy|glazing|glass/i.test(mesh.material?.name ?? '');
  root.traverse((mesh) => {
    if (!mesh.isMesh || !isGlass(mesh)) return;
    const attr = mesh.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const p = new T.Vector3()
        .fromBufferAttribute(attr, i)
        .applyMatrix4(mesh.matrixWorld)
        .applyMatrix4(inv);
      if (p.y < eye[1] - 0.8 || p.z < eye[2] - 4 || p.z > eye[2] + 2 || Math.abs(p.x) > 1) continue;
      const key = Math.round(p.z * 1000) / 1000,
        row = rows.get(key) ?? { z: key, y: Infinity, x: 0 };
      row.y = Math.min(row.y, p.y);
      row.x = Math.max(row.x, Math.abs(p.x));
      rows.set(key, row);
    }
  });
  const stations = [...rows.values()].sort((a, b) => a.z - b.z);
  if (stations.length < 2) return 0;
  const z0 = stations[0].z,
    z1 = slug === 'f-35a' ? stations.at(-1).z : Math.min(stations.at(-1).z, eye[2] + 0.4);
  const at = (z) => {
    let i = stations.findIndex((r) => r.z >= z);
    i = Math.max(1, i < 0 ? stations.length - 1 : i);
    const a = stations[i - 1],
      b = stations[i],
      t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
    return { y: a.y + (b.y - a.y) * t, x: a.x + (b.x - a.x) * t };
  };
  const hinge = slug === 'f-35a' ? z1 : z0;
  target.position.set(0, at(hinge).y, hinge);
  // The sill envelope excludes the fixed fuselage roof and intake shoulders.
  return extractPanel(
    root,
    target,
    [
      (p) => p[2] - z0,
      (p) => z1 - p[2],
      (p) => p[1] - at(p[2]).y + 0.025,
      (p) => at(p[2]).x + 0.035 - Math.abs(p[0]),
    ],
    (mesh) => exterior(mesh) && (isGlass(mesh) || /airframe|canopy-frame/i.test(mesh.name)),
  );
}

function releaseRotorBlades(rotor, spec, bindings) {
  const blades = rotor.children.filter((n) => /blade-?\d/i.test(n.name));
  if (!blades.length) {
    // Older two-blade generators batch blade skins with the hub. Cut the two outer
    // halves, retaining the hub and shaft on the airframe.
    rotor.updateWorldMatrix(true, true);
    const inv = rotor.matrixWorld.clone().invert(),
      bounds = new T.Box3();
    rotor.traverse((n) => {
      if (n.isMesh) {
        const p = n.geometry.attributes.position;
        for (let i = 0; i < p.count; i++)
          bounds.expandByPoint(
            new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld).applyMatrix4(inv),
          );
      }
    });
    const size = bounds.getSize(new T.Vector3());
    const axis = spec.axis === 'y' ? (size.x > size.z ? 0 : 2) : size.y > size.z ? 1 : 2;
    const radius = size.getComponent(axis) / 2;
    for (const side of [-1, 1]) {
      const blade = pivot(rotor, `${rotor.name}-blade-release-${side}`);
      if (extractPanel(rotor, blade, [(p) => side * p[axis] - radius * 0.12])) blades.push(blade);
      else rotor.remove(blade);
    }
  }
  for (const [i, blade] of blades.entries()) {
    rotor.updateWorldMatrix(true, true);
    const center = new T.Box3().setFromObject(blade).getCenter(new T.Vector3());
    rotor.worldToLocal(center);
    center.setComponent(spec.axis === 'y' ? 1 : 0, 0);
    if (center.lengthSq() < 0.001) center.set(i % 2 ? 1 : -1, 0, 0);
    center.normalize().multiplyScalar(12);
    const release = movingParent(blade, `${rotor.name}-blade-jettison-${i}`);
    // Movement is in the rotor coordinate frame, independent of each blade's azimuth.
    const local = center.applyQuaternion(release.quaternion.clone().invert());
    for (const [axis, value] of [
      ['x', local.x],
      ['y', local.y + 5],
      ['z', local.z],
    ])
      bindings.push({
        node: release.name,
        source: 'eject',
        property: 'position',
        axis,
        keys: [
          [0, 0],
          [0.08, 0],
          [1, value],
        ],
      });
  }
}

function wingSpoiler(root, spec, side) {
  root.updateWorldMatrix(true, true);
  const points = [],
    inv = root.matrixWorld.clone().invert();
  const wingSkin = (mesh) =>
    /wing|airframe/i.test(mesh.name) && !/cockpit|interior/i.test(mesh.parent?.name ?? '');
  root.traverse((mesh) => {
    if (!mesh.isMesh || !wingSkin(mesh)) return;
    for (let n = mesh; n && n !== root; n = n.parent) if (n.userData.articulated) return;
    const attr = mesh.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const p = new T.Vector3()
        .fromBufferAttribute(attr, i)
        .applyMatrix4(mesh.matrixWorld)
        .applyMatrix4(inv);
      if (
        side * p.x > spec.span * 0.15 &&
        side * p.x < spec.span * 0.3 &&
        p.z > -spec.length * 0.25
      )
        points.push(p);
    }
  });
  if (!points.length) throw Error(`${spec.label}: cannot locate wing skin for spoilers`);
  const bounds = new T.Box3().setFromPoints(points),
    center = bounds.getCenter(new T.Vector3());
  const x = side * spec.span * 0.22,
    z = bounds.max.z - (bounds.max.z - bounds.min.z) * 0.55;
  const top = points.filter((p) => p.y >= center.y);
  const y = top.reduce((sum, p) => sum + p.y, 0) / top.length;
  const panel = pivot(root, `speed-brake-${side}`, [x, y, z]);
  const half = spec.span * 0.045,
    depth = Math.max(0.25, (bounds.max.z - bounds.min.z) * 0.15);
  const count = extractPanel(
    root,
    panel,
    boxPlanes([x - half, center.y, z - depth], [x + half, bounds.max.y + 0.1, z]),
    wingSkin,
  );
  if (!count) throw Error(`${spec.label}: empty spoiler cut`);
  return panel;
}

// Positions are the recessed end plates already authored in each original model.
// Blades remain behind the nozzle lip. Engine spool drives the same rotor phase as props.
const turbineDiscs = {
  'f-14d': [
    [1.68, 1.83, -6.01, 0.43],
    [-1.68, 1.83, -6.01, 0.43],
  ],
  'f-15c': [
    [0.7, 2.18, -6.26, 0.43],
    [-0.7, 2.18, -6.26, 0.43],
  ],
  'f-16b': [[0, 1.86, -5.04, 0.33]],
  'f-22a': [
    [0.64, 2, -4.22, 0.31],
    [-0.64, 2, -4.22, 0.31],
  ],
  'f-35a': [[0, 1.8, -4.33, 0.54]],
  'fa-18c': [
    [0.58, 1.99, -5.05, 0.34],
    [-0.58, 1.99, -5.05, 0.34],
  ],
  'gripen-c': [[0, 1.8, -6.23, 0.34]],
  'mig-29a': [
    [0.87, 1.62, -5.72, 0.4],
    [-0.87, 1.62, -5.72, 0.4],
  ],
  'rafale-c': [
    [0.61, 1.92, -5.46, 0.33],
    [-0.61, 1.92, -5.46, 0.33],
  ],
  typhoon: [
    [0.52, 1.82, -5.14, 0.4],
    [-0.52, 1.82, -5.14, 0.4],
  ],
  'av-8b': [[0, 1.93, 2.28, 0.94]],
};
function addJetTurbines(root, spec, slug) {
  const discs = turbineDiscs[slug];
  if (!discs) return;
  const material = new T.MeshStandardMaterial({
    name: 'turbine-blades',
    color: '#656862',
    metalness: 0.65,
    roughness: 0.6,
    side: T.DoubleSide,
  });
  for (const [i, [x, y, z, r]] of discs.entries()) {
    const fan = pivot(root, `engine-${i + 1}-turbine`, [x, y, z]),
      vertices = [];
    for (let j = 0; j < 18; j++) {
      const a = (j * Math.PI) / 9;
      const point = (radius, angle) => [radius * Math.sin(angle), radius * Math.cos(angle), 0];
      vertices.push(
        ...point(r * 0.18, a),
        ...point(r, a + 0.12),
        ...point(r, a + 0.3),
        ...point(r * 0.18, a),
        ...point(r, a + 0.3),
        ...point(r * 0.18, a + 0.2),
      );
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const blades = new T.Mesh(geometry, material);
    blades.name = `${fan.name}-blades`;
    fan.add(blades);
    spec.visual.rotors.push({
      node: fan.name,
      axis: 'z',
      multiplier: 1,
      engine: spec.engines?.[i]?.id ?? 'engine-1',
    });
  }
}
