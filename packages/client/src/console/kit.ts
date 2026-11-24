// The console kit: generic controls drawn for a vehicle whose model has no part of its own to
// show (a gear handle on an aircraft whose cockpit has only a placeholder, car pedals, a
// handbrake). Built from three.js primitives at runtime, in cockpit axes (+Z forward, +Y up, +X
// the operator's left), facing the operator (-Z) like an instrument panel.

import * as THREE from 'three';
import type { ModelSignals } from '../model-signals';
import { PEDAL_LEAN } from './camera';

/** A kit control: its group, how it is posed, and the geometry it owns. */
export interface KitControl {
  root: THREE.Group;
  /** Pose from the readings. `preview` (0..1) overrides the position while a thumb drags it. */
  pose(signals: ModelSignals, preview?: number): void;
  /** Nodes whose pose or material changes. */
  moving: THREE.Object3D[];
  dispose(): void;
}

const materials = {
  plate: new THREE.MeshStandardMaterial({ color: '#2a3035', roughness: 0.55, metalness: 0.35 }),
  slot: new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.9 }),
  alloy: new THREE.MeshStandardMaterial({ color: '#c2c8ce', roughness: 0.32, metalness: 0.85 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#191a1b', roughness: 0.92 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#ece6d2', roughness: 0.45 }),
  red: new THREE.MeshStandardMaterial({ color: '#c3271d', roughness: 0.4 }),
  blue: new THREE.MeshStandardMaterial({ color: '#2f6fb0', roughness: 0.4 }),
  green: new THREE.MeshStandardMaterial({ color: '#3f8f4a', roughness: 0.45 }),
  grey: new THREE.MeshStandardMaterial({ color: '#7d858c', roughness: 0.5, metalness: 0.2 }),
  tread: new THREE.MeshStandardMaterial({ color: '#1e2124', roughness: 0.85 }),
  tick: new THREE.MeshBasicMaterial({ color: '#d8dde2' }),
  pointer: new THREE.MeshBasicMaterial({ color: '#ff9d2e' }),
  greenOn: new THREE.MeshBasicMaterial({ color: '#46ff7a' }),
  greenOff: new THREE.MeshStandardMaterial({ color: '#173a22', roughness: 0.3 }),
  redOn: new THREE.MeshBasicMaterial({ color: '#ff4436' }),
  redOff: new THREE.MeshStandardMaterial({ color: '#3a1714', roughness: 0.3 }),
};

/** Knob colors for a lever by what it works. */
export type KitLeverColor = 'black' | 'red' | 'blue' | 'green' | 'grey' | 'ivory';
const KNOB: Record<KitLeverColor, THREE.Material> = {
  black: materials.rubber,
  red: materials.red,
  blue: materials.blue,
  green: materials.green,
  grey: materials.grey,
  ivory: materials.ivory,
};

function own(root: THREE.Object3D): () => void {
  return () =>
    root.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) (node as THREE.Mesh).geometry.dispose();
    });
}

/** A rounded panel plate, its face at z = 0 toward -Z (the operator), `depth` behind it. */
function plate(width: number, height: number, radius: number, depth: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;
  shape.moveTo(-w + radius, -h);
  shape.lineTo(w - radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h + radius);
  shape.lineTo(w, h - radius);
  shape.quadraticCurveTo(w, h, w - radius, h);
  shape.lineTo(-w + radius, h);
  shape.quadraticCurveTo(-w, h, -w, h - radius);
  shape.lineTo(-w, -h + radius);
  shape.quadraticCurveTo(-w, -h, -w + radius, -h);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 2,
    curveSegments: 6,
  });
  return new THREE.Mesh(geometry, materials.plate);
}

function box(
  size: readonly [number, number, number],
  at: readonly [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...at);
  return mesh;
}

/** A rod from the origin along -Z, `length` long. */
function rod(radius: number, length: number): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius * 1.15, length, 12)
    .rotateX(Math.PI / 2)
    .translate(0, 0, -length / 2);
  return new THREE.Mesh(geometry, materials.alloy);
}

/** A rod from the origin up +Y, `length` long. */
function post(radius: number, length: number): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius * 1.15, length, 12).translate(
    0,
    length / 2,
    0,
  );
  return new THREE.Mesh(geometry, materials.alloy);
}

/** Rod length of a panel handle, from a pivot behind the plate so the rod sweeps the gate. */
const LEVER = 0.11;
const PIVOT = 0.03;
const SWING = 0.5;
const gateHeight = (angle: number): number => PIVOT * Math.tan(angle);
const GATE = gateHeight(SWING) * 2 + 0.012;

/** Group sloped back by `slope` radians, so a panel seen from above faces the viewer. */
function sloped(slope: number): THREE.Group {
  const root = new THREE.Group();
  root.rotation.x = slope;
  return root;
}

/** A panel handle pivoted behind the plate, with `knob` at its end. */
function panelHandle(knob: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.position.z = PIVOT;
  group.add(rod(0.0042, LEVER));
  knob.position.z = -LEVER;
  group.add(knob);
  return group;
}

/**
 * Landing-gear handle: a lever in a gate with a wheel for a knob, three green lamps for gear down
 * and locked and a red one while it travels. Reads `gearCommand` (1 down) and `gear` (where the
 * gear is). `preview` is 0 up .. 1 down.
 */
export function kitGearHandle(slope = 0): KitControl {
  const root = sloped(slope);
  root.add(plate(0.066, 0.15, 0.011, 0.006));
  root.add(box([0.012, GATE, 0.002], [0, 0, -0.001], materials.slot));
  // A small tire on an alloy hub, facing the operator: seen head-on it reads as a wheel.
  const wheel = new THREE.Group();
  wheel.add(
    new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0085, 12, 32), materials.rubber),
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.0115, 0.0115, 0.0155, 24).rotateX(Math.PI / 2),
      materials.alloy,
    ),
  );
  const handle = panelHandle(wheel);
  root.add(handle);
  // Domes standing off the face, so they still show when the plate is seen at an angle.
  const dome = (): THREE.BufferGeometry =>
    new THREE.SphereGeometry(0.0072, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
      .rotateX(-Math.PI / 2)
      .scale(1, 1, 1.4);
  const lamps: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];
  for (const y of [-0.034, -0.05, -0.066]) {
    const lamp = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(dome(), materials.greenOff);
    lamp.position.set(0.018, y, 0);
    lamps.push(lamp);
    root.add(lamp);
  }
  const transit = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(dome(), materials.redOff);
  transit.position.set(0.018, 0.06, 0);
  root.add(transit);
  for (const angle of [SWING, -SWING])
    root.add(box([0.014, 0.0024, 0.001], [-0.018, gateHeight(angle), -0.0012], materials.tick));
  return {
    root,
    moving: [handle, ...lamps, transit],
    pose(signals, preview) {
      const down = preview ?? signals.gearCommand ?? 1;
      handle.rotation.x = SWING - down * 2 * SWING;
      const position = signals.gear ?? down;
      const locked = position >= 0.999;
      for (const lamp of lamps) lamp.material = locked ? materials.greenOn : materials.greenOff;
      transit.material = position > 0.001 && position < 0.999 ? materials.redOn : materials.redOff;
    },
    dispose: own(root),
  };
}

/** NACA four-digit symmetric section, chord 1, as a closed outline. */
function airfoil(thickness: number, points = 14): THREE.Vector2[] {
  const half = (x: number): number =>
    5 *
    thickness *
    (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const upper: THREE.Vector2[] = [];
  for (let i = 0; i <= points; i++) {
    const x = (1 - Math.cos((i / points) * Math.PI)) / 2;
    upper.push(new THREE.Vector2(x, half(x)));
  }
  const lower = upper
    .slice(1, -1)
    .reverse()
    .map((p) => new THREE.Vector2(p.x, -p.y));
  return [...upper, ...lower];
}

/** Flap lever notches: up, half and full. */
export const FLAP_DETENTS: readonly number[] = [0, 0.5, 1];

/**
 * Flap lever: a gate with up / half / full notches and a small wing for a knob, an orange
 * pointer beside it where the flaps are. Reads `flapCommand` and `flaps` (position); `preview`
 * is 0 up .. 1 full.
 */
export function kitFlapLever(slope = 0): KitControl {
  const root = sloped(slope);
  root.add(plate(0.066, 0.15, 0.011, 0.006));
  root.add(box([0.012, GATE, 0.002], [0, 0, -0.001], materials.slot));
  // The wing section faces the operator: seen head-on it reads as a little wing.
  const chord = 0.05;
  const depth = 0.02;
  const knob = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      new THREE.Shape(airfoil(0.24).map((p) => new THREE.Vector2(p.x * chord, p.y * chord))),
      { depth, bevelEnabled: false },
    ).translate(-chord / 2, 0, -depth),
    materials.ivory,
  );
  const handle = panelHandle(knob);
  root.add(handle);
  const angle = (value: number): number => SWING - value * 2 * SWING;
  for (const value of FLAP_DETENTS)
    root.add(
      box([0.013, 0.0024, 0.001], [-0.018, gateHeight(angle(value)), -0.0012], materials.tick),
    );
  const pointer = box([0.009, 0.005, 0.01], [0.017, 0, -0.005], materials.pointer);
  root.add(pointer);
  return {
    root,
    moving: [handle, pointer],
    pose(signals, preview) {
      const value = preview ?? signals.flapCommand ?? 0;
      handle.rotation.x = angle(value);
      pointer.position.y = gateHeight(angle(signals.flaps ?? value));
    },
    dispose: own(root),
  };
}

/**
 * A quadrant lever in its own short box: forward for more. `signal` names the reading it
 * follows (`power`, `mixture`, ...), 0..1.
 */
export function kitLever(signal: string, color: KitLeverColor = 'black'): KitControl {
  const root = new THREE.Group();
  root.add(box([0.05, 0.07, 0.13], [0, -0.035, 0], materials.plate));
  root.add(box([0.012, 0.002, 0.1], [0, 0.0005, 0], materials.slot));
  const lever = new THREE.Group();
  lever.add(post(0.0045, 0.1));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 20, 14), KNOB[color]);
  knob.scale.set(1, 1.15, 1);
  knob.position.y = 0.108;
  lever.add(knob);
  root.add(lever);
  return {
    root,
    moving: [lever],
    pose(signals, preview) {
      const value = preview ?? signals[signal] ?? 0;
      lever.rotation.x = -0.55 + Math.max(0, Math.min(1, value)) * 1.1;
    },
    dispose: own(root),
  };
}

/**
 * A short dark box under lifted levers that have no housing of their own, spanning their pivots
 * (`moving`, in `root`'s frame) so they stand in a quadrant rather than in the air.
 */
export function kitLeverHousing(
  root: THREE.Object3D,
  moving: readonly THREE.Object3D[],
): KitControl {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const pivots = new THREE.Box3();
  for (const node of moving)
    pivots.expandByPoint(
      new THREE.Vector3().setFromMatrixPosition(node.matrixWorld).applyMatrix4(inverse),
    );
  const group = new THREE.Group();
  if (!pivots.isEmpty()) {
    const size = pivots.getSize(new THREE.Vector3());
    const center = pivots.getCenter(new THREE.Vector3());
    group.add(
      box(
        [Math.max(0.05, size.x + 0.04), 0.07, Math.max(0.08, size.z + 0.07)],
        [center.x, pivots.min.y - 0.037, center.z],
        materials.plate,
      ),
    );
  }
  return { root: group, moving: [], pose() {}, dispose: own(group) };
}

/**
 * Engine master: a guarded toggle on a small plate, up when on, and a green lamp while the
 * engine turns. Reads `engine` (0 or 1) and `rpm`.
 */
export function kitEngineSwitch(slope = 0): KitControl {
  const root = sloped(slope);
  root.add(plate(0.05, 0.07, 0.008, 0.006));
  // The red guard either side of the toggle.
  for (const x of [-0.011, 0.011])
    root.add(box([0.003, 0.022, 0.018], [x, 0, -0.009], materials.red));
  const toggle = new THREE.Group();
  const bat = rod(0.0032, 0.024);
  toggle.add(bat);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 14, 10), materials.alloy);
  tip.position.z = -0.024;
  toggle.add(tip);
  root.add(toggle);
  const lamp = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
    new THREE.SphereGeometry(0.0055, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2),
    materials.greenOff,
  );
  lamp.position.set(0, 0.024, 0);
  root.add(lamp);
  return {
    root,
    moving: [toggle, lamp],
    pose(signals, preview) {
      const on = (preview ?? signals.engine ?? 0) > 0.5;
      toggle.rotation.x = on ? 0.45 : -0.45;
      lamp.material = (signals.rpm ?? 0) > 0.15 ? materials.greenOn : materials.greenOff;
    },
    dispose: own(root),
  };
}

/**
 * Parking brake: a T-handle on a plate, pulled out toward the operator when set. Reads `brake`.
 */
export function kitParkingBrake(slope = 0): KitControl {
  const root = sloped(slope);
  root.add(plate(0.05, 0.07, 0.008, 0.006));
  const handle = new THREE.Group();
  handle.add(rod(0.0035, 0.02));
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.04, 14).rotateZ(Math.PI / 2),
    materials.red,
  );
  bar.position.z = -0.02;
  handle.add(bar);
  root.add(handle);
  return {
    root,
    moving: [handle],
    pose(signals, preview) {
      handle.position.z = -(preview ?? signals.brake ?? 0) * 0.03;
    },
    dispose: own(root),
  };
}

/** A car's handbrake lever beside the seat: up when pulled. `preview` 1 is pulled. */
export function kitHandbrake(): KitControl {
  const root = new THREE.Group();
  root.add(box([0.07, 0.04, 0.24], [0, -0.02, 0], materials.plate));
  const lever = new THREE.Group();
  lever.position.z = -0.08;
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.022, 0.2).translate(0, 0.012, 0.1),
    materials.grey,
  );
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.03, 0.08).translate(0, 0.014, 0.17),
    materials.rubber,
  );
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.012, 12).rotateX(Math.PI / 2),
    materials.alloy,
  );
  button.position.set(0, 0.016, 0.215);
  lever.add(arm, grip, button);
  root.add(lever);
  return {
    root,
    moving: [lever],
    pose(_signals, preview) {
      lever.rotation.x = -0.12 - (preview ?? 0) * 0.5;
    },
    dispose: own(root),
  };
}

/** One treaded pad on a short floor arm, hinged at the floor ahead of it. */
function pedal(
  width: number,
  height: number,
  material: THREE.Material,
): {
  group: THREE.Group;
  pad: THREE.Group;
} {
  const group = new THREE.Group();
  const pad = new THREE.Group();
  pad.add(box([width, height, 0.014], [0, height / 2, 0], material));
  const treads = Math.max(2, Math.round(height / 0.02));
  for (let i = 0; i < treads; i++)
    pad.add(
      box(
        [width * 0.82, 0.006, 0.006],
        [0, (height * (i + 0.6)) / (treads + 0.2), -0.009],
        materials.tread,
      ),
    );
  // Hinged at the floor, its top leaning forward, away from the foot: the treaded face looks up
  // and back at the operator. Pressing tips it further forward.
  pad.rotation.x = PEDAL_LEAN;
  group.add(pad);
  return { group, pad };
}

/**
 * Rudder pedals, for an aircraft without its own: right rudder pushes the right pad forward.
 * Reads `yawInput` (-1..1).
 */
export function kitRudderPedals(): KitControl {
  const root = new THREE.Group();
  const left = pedal(0.09, 0.12, materials.alloy);
  const right = pedal(0.09, 0.12, materials.alloy);
  left.group.position.x = 0.13;
  right.group.position.x = -0.13;
  root.add(left.group, right.group);
  return {
    root,
    moving: [left.group, right.group],
    pose(signals, preview) {
      const yaw = preview ?? signals.yawInput ?? 0;
      left.group.position.z = -yaw * 0.04;
      right.group.position.z = yaw * 0.04;
    },
    dispose: own(root),
  };
}

/**
 * A car's accelerator and brake pedals. Reads `throttle` (-1..1: forward presses the
 * accelerator) and `brake`; `preview` 1 presses the brake.
 */
export function kitCarPedals(): KitControl {
  const root = new THREE.Group();
  const accelerator = pedal(0.05, 0.12, materials.rubber);
  const brake = pedal(0.085, 0.075, materials.rubber);
  accelerator.group.position.set(-0.075, 0, 0);
  brake.group.position.set(0.05, 0.02, 0);
  root.add(accelerator.group, brake.group);
  return {
    root,
    moving: [accelerator.pad, brake.pad],
    pose(signals, preview) {
      const throttle = Math.max(0, signals.throttle ?? 0);
      const braking = Math.max(
        preview ?? 0,
        signals.brake ?? 0,
        Math.max(0, -(signals.throttle ?? 0)),
      );
      accelerator.pad.rotation.x = PEDAL_LEAN + throttle * 0.32;
      brake.pad.rotation.x = PEDAL_LEAN + Math.min(1, braking) * 0.32;
    },
    dispose: own(root),
  };
}

/** A control stick, for an aircraft without its own. Reads `pitchInput` and `rollInput`. */
export function kitStick(): KitControl {
  const root = new THREE.Group();
  const boot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), materials.rubber);
  boot.scale.set(1, 0.7, 1);
  root.add(boot);
  const stick = new THREE.Group();
  stick.add(post(0.012, 0.3));
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.016, 0.1, 16).translate(0, 0.35, 0),
    materials.rubber,
  );
  stick.add(grip);
  root.add(stick);
  return {
    root,
    moving: [stick],
    pose(signals) {
      // Nose up tilts the stick aft (-Z); right bank toward -X.
      stick.rotation.x = -(signals.pitchInput ?? 0) * 0.32;
      stick.rotation.z = (signals.rollInput ?? 0) * 0.32;
    },
    dispose: own(root),
  };
}

/** A steering wheel, for a vehicle without its own. Reads `steering` (-1..1, right positive). */
export function kitSteeringWheel(): KitControl {
  const root = new THREE.Group();
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 12, 48), materials.rubber));
  wheel.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.03, 20).rotateX(Math.PI / 2),
      materials.plate,
    ),
  );
  for (const angle of [Math.PI / 2, (Math.PI * 7) / 6, (-Math.PI * 1) / 6]) {
    const spoke = box([0.15, 0.02, 0.012], [0, 0, 0], materials.grey);
    spoke.geometry.translate(0.075, 0, 0);
    spoke.rotation.z = angle + Math.PI;
    wheel.add(spoke);
  }
  root.add(wheel);
  return {
    root,
    moving: [wheel],
    pose(signals) {
      // As the catalog's wheels: right is positive about +Z, clockwise from the driver's seat.
      wheel.rotation.z = (signals.steering ?? 0) * 2.5;
    },
    dispose: own(root),
  };
}
