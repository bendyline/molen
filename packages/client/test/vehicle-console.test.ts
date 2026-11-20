import { readFileSync } from 'node:fs';
import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  type AircraftCockpitSession,
  applyAircraftControl,
  createAircraftVisual,
} from '../src/aircraft';
import {
  aircraftDeck,
  type ConsoleItem,
  type ConsoleLayoutItem,
  layoutConsole,
  onFootDeck,
} from '../src/console';
import { TouchLever } from '../src/navigation';

describe('touch lever', () => {
  it('moves by thumb travel from where the thumb landed, never jumping', () => {
    const lever = new TouchLever({ travel: 100 });
    lever.press(50, 300, 0.4);
    expect(lever.value).toBe(0.4);
    expect(lever.drag(70, 300)).toBe(0.4);
    expect(lever.drag(50, 250)).toBeCloseTo(0.9);
    expect(lever.drag(50, 100)).toBe(1);
    expect(lever.release()).toBe(1);
    expect(lever.active).toBe(false);
  });
  it('slides sideways, springs back and settles on notches', () => {
    const rudder = new TouchLever({ axis: 'x', travel: 50, min: -1, max: 1, spring: 0 });
    rudder.press(0, 0, 0);
    expect(rudder.drag(25, 40)).toBeCloseTo(1);
    expect(rudder.release()).toBe(0);
    const flaps = new TouchLever({ travel: 100, detents: [0, 0.5, 1] });
    flaps.press(0, 0, 0);
    flaps.drag(0, -38);
    expect(flaps.release()).toBe(0.5);
  });
});

const phoneItems: ConsoleLayoutItem[] = [
  { id: 'stick', side: 'left', size: [160, 168], priority: 0 },
  { id: 'pedals', side: 'left', size: [124, 96], priority: 4 },
  { id: 'throttle', side: 'right', size: [86, 160], priority: 1 },
  { id: 'gear', side: 'right', size: [62, 120], priority: 2 },
  { id: 'flaps', side: 'right', size: [62, 120], priority: 3 },
  { id: 'speed', side: 'middle', size: [84, 84], priority: 5 },
  { id: 'altitude', side: 'middle', size: [84, 84], priority: 5 },
  { id: 'engine', side: 'right', size: [52, 76], priority: 6 },
  { id: 'brakes', side: 'right', size: [56, 56], priority: 7 },
  { id: 'parking-brake', side: 'right', size: [52, 76], priority: 8 },
  { id: 'mixture', side: 'right', size: [58, 120], priority: 10, drawer: true },
  { id: 'propeller', side: 'right', size: [58, 120], priority: 11, drawer: true },
];

const overlaps = (
  rects: Map<string, { left: number; top: number; width: number; height: number }>,
) => {
  const all = [...rects];
  const found: string[] = [];
  for (const [i, [a, ra]] of all.entries())
    for (const [b, rb] of all.slice(i + 1))
      if (
        ra.left < rb.left + rb.width &&
        rb.left < ra.left + ra.width &&
        ra.top < rb.top + rb.height &&
        rb.top < ra.top + ra.height
      )
        found.push(`${a}/${b}`);
  return found;
};

describe('console layout', () => {
  it('keeps a landscape phone to one row: stick left, throttle at the edge, dials between', () => {
    const layout = layoutConsole({ width: 852, height: 393, items: phoneItems });
    expect(layout.size).toBe('phone');
    // The touch stick's box stays where it always was: 144 px, 24 px in from the corner.
    expect(layout.stick).toEqual({ side: 24, bottom: 24, size: 144 });
    expect(layout.rects.get('throttle')).toEqual({ left: 756, top: 225, width: 86, height: 160 });
    for (const rect of layout.rects.values()) expect(rect.top + rect.height).toBe(385);
    expect(layout.hidden).toEqual(['parking-brake', 'mixture', 'propeller']);
    expect(layout.drawer).toBe(true);
    expect(overlaps(layout.rects)).toEqual([]);
    expect(layout.height).toBe(176);
    const speed = layout.rects.get('speed');
    const pedals = layout.rects.get('pedals');
    expect(speed && pedals && speed.left > pedals.left + pedals.width).toBe(true);
  });
  it('opens the drawer as a row of its own above', () => {
    const layout = layoutConsole({ width: 852, height: 393, items: phoneItems, drawerOpen: true });
    expect(layout.hidden).toEqual([]);
    expect(layout.rects.get('mixture')?.top).toBeLessThan(217);
    expect(overlaps(layout.rects)).toEqual([]);
  });
  it('stacks two rows on a portrait phone and keeps the dials together', () => {
    const layout = layoutConsole({ width: 393, height: 852, items: phoneItems });
    expect(overlaps(layout.rects)).toEqual([]);
    expect(layout.height).toBeLessThan(852 / 2);
    expect(layout.rects.has('speed')).toBe(layout.rects.has('altitude'));
    expect(layout.rects.get('throttle')?.left).toBe(393 - 10 - 86);
  });
  it('shows a tablet everything a quarter larger', () => {
    const layout = layoutConsole({ width: 1180, height: 820, items: phoneItems });
    expect(layout.size).toBe('tablet');
    expect(layout.rects.get('throttle')?.width).toBe(108);
    expect(layout.rects.has('mixture')).toBe(true);
    expect(overlaps(layout.rects)).toEqual([]);
  });
  it('mirrors for the left hand and keeps clear of safe areas', () => {
    const layout = layoutConsole({
      width: 852,
      height: 393,
      items: phoneItems,
      mirror: true,
      insets: { left: 44, right: 44, bottom: 20 },
    });
    expect(layout.rects.get('stick')?.left).toBe(852 - 44 - 16 - 160);
    expect(layout.rects.get('throttle')?.left).toBe(44 + 10);
    expect(layout.stick.bottom).toBe(44);
  });
});

/** A model laid out as the P-51's runtime GLB: the parts the console lifts, by the same names. */
function p51Model(): THREE.Object3D {
  const box = (name: string, size: [number, number, number], at: [number, number, number]) => {
    // Segmented: a dozen-triangle box is a placeholder the console replaces with its kit's.
    const geometry = new THREE.BoxGeometry(...size, 2, 2, 2);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.position.set(...at);
    return mesh;
  };
  const group = (name: string, at: [number, number, number] = [0, 0, 0], control?: object) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(...at);
    if (control) node.userData.aircraftControl = control;
    return node;
  };
  const root = group('P-51D-Mustang');
  const tilt = new THREE.Quaternion(-0.1132, 0, 0, 0.9936).normalize();
  const cockpit = group('cockpit', [0, 0.103, 0]);
  cockpit.quaternion.copy(tilt);
  const stick = group('control-stick', [0, 1.39, 0.25]);
  stick.add(box('stick-shaft', [0.02, 0.32, 0.02], [0, 0.16, 0]));
  const quadrant = group('throttle-quadrant', [0.37, 1.72, 0.21]);
  quadrant.add(box('quadrant-case', [0.085, 0.115, 0.29], [0, 0, 0]));
  const levers: [string, number][] = [
    ['power', 0],
    ['propeller', -0.65],
    ['mixture', -0.65],
  ];
  for (const [index, [action, offset]] of levers.entries()) {
    const lever = group(`engine-control-${index}`, [-0.008, 0.03, 0.09 - index * 0.083], {
      action,
      motion: { property: 'rotation', axis: 'x', scale: 0.65, offset },
    });
    lever.add(box(`engine-lever-${index}`, [0.01, 0.1, 0.01], [-0.017, 0.05, 0.02]));
    quadrant.add(lever);
  }
  for (const side of [-1, 1]) {
    const pedal = group(`rudder-control-${side}`, [0, 0, 0], {
      action: 'yaw',
      // Bound backwards on purpose (as the P-51 was until 2026-11-19): left pedal forward for
      // right rudder, so the console's own check has something to correct.
      motion: { property: 'position', axis: 'z', scale: side * 0.035 },
    });
    pedal.add(box(`pedal-link-${side}`, [0.018, 0.018, 0.14], [side * 0.145, 1.36, 0.39]));
    pedal.add(box(`rudder-pedal-${side}`, [0.16, 0.12, 0.025], [side * 0.145, 1.42, 0.465]));
    cockpit.add(pedal);
  }
  cockpit.add(stick, quadrant);
  const kit = group('flight-controls', [0, 0.103, 0]);
  kit.quaternion.copy(tilt);
  for (const [action, axis, scale] of [
    ['gear', 'y', -0.025],
    ['flaps', 'y', 0.025],
    ['engine', 'x', -0.5],
  ] as const) {
    const control = group(`flight-${action}-common`, [-0.2, 1.47, 0.46], {
      action,
      motion: { property: axis === 'x' ? 'rotation' : 'position', axis, scale },
    });
    control.add(box(`flight-${action}-common-moving`, [0.03, 0.02, 0.03], [0, 0, -0.03]));
    kit.add(control);
  }
  root.add(cockpit, kit);
  return root;
}

const p51 = (
  Object.values(
    JSON.parse(
      readFileSync(
        new URL(
          '../../../content/entities/source/aircraft/p-51/entity.types.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ).types as Record<string, { components: { aircraft: { spec: AircraftSpec } } }>,
  )[0] as { components: { aircraft: { spec: AircraftSpec } } }
).components.aircraft.spec;

function flying(grounded: boolean) {
  const model = p51Model();
  const visual = createAircraftVisual(model, p51);
  const air: { input: AircraftInputData; state: AircraftStateData } = {
    input: {
      power: 0.4,
      pitch: 0,
      roll: 0,
      yaw: 0,
      engine: true,
      gear: true,
      flaps: 0,
      brake: false,
    },
    state: { grounded, engines: {}, velocity: [0, 0, 0] } as unknown as AircraftStateData,
  };
  const session = (): AircraftCockpitSession => ({
    id: 'p51',
    cockpit: visual.cockpit,
    spec: p51,
    input: air.input,
    state: air.state,
    change: (change) => {
      air.input = applyAircraftControl(air.input, change, p51, air.state);
    },
    release: () => {},
  });
  const actions = new Map<string, number>();
  const items = aircraftDeck(
    { kind: 'aircraft', visual, spec: p51, session },
    { setAction: (action, value) => actions.set(action, value), mirror: false },
  );
  return { model, visual, air, items, actions };
}

const item = (items: ConsoleItem[], id: string): ConsoleItem => {
  const found = items.find((entry) => entry.id === id);
  if (!found) throw new Error(`No ${id}`);
  return found;
};
const names = (scene: THREE.Object3D): Set<string> => {
  const found = new Set<string>();
  scene.traverse((node) => found.add(node.name));
  return found;
};

describe('aircraft deck', () => {
  it('gives the P-51 its own stick, pedals and throttle, and kit gear and flap handles', () => {
    const { items } = flying(false);
    expect(items.map((entry) => entry.id)).toEqual([
      'stick',
      'pedals',
      'throttle',
      'gear',
      'flaps',
      'engine',
      'parking-brake',
      'brakes',
      'mixture',
      'propeller',
    ]);
    const throttle = names(item(items, 'throttle').part?.().scene ?? new THREE.Object3D());
    expect(throttle.has('engine-control-0')).toBe(true);
    expect(throttle.has('engine-control-1')).toBe(false);
    const pedals = names(item(items, 'pedals').part?.().scene ?? new THREE.Object3D());
    expect(pedals.has('rudder-pedal-1')).toBe(true);
    // The linkage rods stood in front of the pads; the pads are what reads as pedals.
    expect(pedals.has('pedal-link-1')).toBe(false);
    // The bolted-on module's plungers are not the handles: the kit's are drawn instead.
    const gear = names(item(items, 'gear').part?.().scene ?? new THREE.Object3D());
    expect(gear.has('flight-gear-common')).toBe(false);
  });
  it('lifts a part from its rest pose, wherever the live part stands, and moves it as the cockpit does', () => {
    const { model, visual, items } = flying(false);
    visual.update(
      {
        grounded: false,
        engines: {},
        velocity: [0, 0, 0],
        rpm: 1,
        rotorAngle: 0,
      } as unknown as AircraftStateData,
      { power: 1, pitch: 1, roll: 0, yaw: 0, engine: true, gear: true, flaps: 0, brake: false },
      600,
    );
    // The P-51's cockpit tilts its stick aft for nose up.
    expect(model.getObjectByName('control-stick')?.rotation.x).toBeCloseTo(-0.22);
    const part = item(items, 'stick').part?.();
    if (!part) throw new Error('No stick');
    const copy = part.scene.getObjectByName('control-stick');
    expect(copy?.rotation.x).toBe(0);
    expect(part.pose({ pitchInput: 0, rollInput: 0 })).toBe(true);
    expect(part.pose({ pitchInput: 0, rollInput: 0 })).toBe(false);
    expect(part.pose({ pitchInput: 1, rollInput: 0 })).toBe(true);
    // Nose up tilts the copy aft too (the documented convention), so a thumb pushing forward
    // sees the stick go forward.
    // 13 degrees of travel, drawn at about 18 so a full push reads.
    expect(copy?.rotation.x).toBeCloseTo(-0.32);
    part.pose({ pitchInput: 0, rollInput: 1 });
    // Right bank tilts it toward -X: positive about +Z.
    expect(copy?.rotation.z).toBeCloseTo(0.32);
  });
  it('pushes the right pedal forward for right rudder, whichever way the model binds it', () => {
    const { items } = flying(false);
    const part = item(items, 'pedals').part?.();
    if (!part) throw new Error('No pedals');
    const right = part.scene.getObjectByName('rudder-control--1');
    const left = part.scene.getObjectByName('rudder-control-1');
    part.pose({ yawInput: 1 });
    expect(right?.position.z).toBeGreaterThan(0);
    expect(left?.position.z).toBeLessThan(0);
  });
  it('works the throttle, refuses the gear on the ground, and settles flaps on notches', () => {
    const ground = flying(true);
    const throttle = item(ground.items, 'throttle').zone;
    if (throttle?.kind !== 'lever') throw new Error('No throttle lever');
    throttle.change?.(0.9);
    expect(ground.air.input.power).toBeCloseTo(0.9);
    const gear = item(ground.items, 'gear').zone;
    if (gear?.kind !== 'lever') throw new Error('No gear handle');
    gear.release?.(0);
    expect(ground.air.input.gear).toBe(true);
    expect(item(ground.items, 'gear').overrides?.(performance.now())).toBeDefined();
    const air = flying(false);
    const handle = item(air.items, 'gear').zone;
    if (handle?.kind !== 'lever') throw new Error('No gear handle');
    handle.release?.(0);
    expect(air.air.input.gear).toBe(false);
    const flaps = item(air.items, 'flaps').zone;
    if (flaps?.kind !== 'lever') throw new Error('No flap lever');
    flaps.release?.(0.5);
    expect(air.air.input.flaps).toBe(0.5);
  });
  it('slides the rudder through the navigation actions and centers it', () => {
    const { items, actions } = flying(false);
    const pedals = item(items, 'pedals').zone;
    if (pedals?.kind !== 'lever') throw new Error('No pedals');
    pedals.change?.(0.6);
    expect(actions.get('nav-yaw-right')).toBeCloseTo(0.6);
    expect(actions.get('nav-yaw-left')).toBe(0);
    pedals.release?.(0);
    expect(actions.get('nav-yaw-right')).toBe(0);
  });
});

describe('on foot', () => {
  it('is the plain stick with jump and use, or up and down for a free camera', () => {
    expect(onFootDeck({ kind: 'walk' }).map((entry) => entry.id)).toEqual(['stick', 'jump', 'use']);
    expect(onFootDeck({ kind: 'free' }).map((entry) => entry.id)).toEqual(['stick', 'up', 'down']);
    expect(onFootDeck({ kind: 'walk' })[0]?.part).toBeUndefined();
  });
});
