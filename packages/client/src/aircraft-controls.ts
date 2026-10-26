import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';

export type AircraftControlAction =
  | 'power'
  | 'mixture'
  | 'propeller'
  | 'stick'
  | 'yaw'
  | 'gear'
  | 'flaps'
  | 'engine'
  | 'brake'
  | 'thrustVector';
export interface AircraftCockpitControl {
  id: string;
  label: string;
  action: AircraftControlAction;
  /** Omitted for the common throttle or engine master. */
  engine?: string;
  /** Named physical controls; an empty array indicates an unmodeled control. */
  nodes: string[];
}
/** glTF node extras for authored cockpit controls. Motion is relative to the exported rest pose. */
export interface AircraftControlNode {
  action: AircraftControlAction;
  engine?: string;
  motion?: {
    property: 'position' | 'rotation';
    axis: 'x' | 'y' | 'z';
    scale: number;
    offset?: number;
  };
}
export interface AircraftControlChange {
  control: AircraftCockpitControl;
  value: number;
  /** Pitch for a two-axis stick; value is roll. */
  pitch?: number;
}
export interface AircraftCockpit {
  controls: readonly AircraftCockpitControl[];
  /** Adapted interior bindings give each physical throttle its own engine signal. */
  interior: AircraftSpec['visual']['interior'];
  pick(ray: THREE.Ray): AircraftCockpitControl | undefined;
}

/** Discover moving controls from their authored input bindings, never from instrument needles. */
export function createAircraftCockpit(model: THREE.Object3D, spec: AircraftSpec): AircraftCockpit {
  const controls: AircraftCockpitControl[] = [];
  let interior =
    spec.visual.interior === undefined ? undefined : structuredClone(spec.visual.interior);
  const nodes = new Map<string, THREE.Object3D[]>();
  model.traverse((node) => nodes.set(node.name, [...(nodes.get(node.name) ?? []), node]));
  const add = (
    action: AircraftControlAction,
    label: string,
    names: string[],
    engine?: string,
  ): AircraftCockpitControl => {
    const control = {
      id: `${action}:${engine ?? controls.length}`,
      action,
      label,
      nodes: names,
      ...(engine === undefined ? {} : { engine }),
    };
    controls.push(control);
    return control;
  };
  const bound = (source: string, pattern: RegExp): string[] => [
    ...new Set(
      (interior?.bindings ?? [])
        .filter(
          (b) =>
            b.source === source &&
            b.property !== 'visible' &&
            pattern.test(b.node) &&
            nodes.has(b.node),
        )
        .map((b) => b.node),
    ),
  ];
  const sticks = [
    ...new Set([
      ...bound('pitchInput', /stick|yoke|cyclic|column|control|wheel/i),
      ...bound('rollInput', /stick|yoke|cyclic|column|control|wheel/i),
    ]),
  ];
  if (!sticks.length && spec.visual.controlStick) sticks.push(spec.visual.controlStick.node);
  add('stick', 'Yoke / stick', sticks);
  add('yaw', 'Rudder pedals', bound('yawInput', /pedal/i));
  const powerNodes = bound('power', /throttle|power|lever|quadrant|collective|thrust/i).filter(
    (name) => !/pointer|needle|gauge|indicator/i.test(name),
  );
  if (!powerNodes.length && spec.visual.collective) powerNodes.push(spec.visual.collective.node);
  const engines = [...(spec.engines ?? [])].sort((a, b) => b.position[0] - a.position[0]);
  // Collective/thrust levers in a tiltrotor or helicopter are duplicated pilot stations.
  const independent =
    engines.length > 1 &&
    powerNodes.length === engines.length &&
    !powerNodes.some((name) => /collective|thrust/i.test(name));
  model.updateMatrixWorld(true);
  const localX = (name: string): number => {
    const node = nodes.get(name)?.[0];
    return node ? model.worldToLocal(node.getWorldPosition(new THREE.Vector3())).x : 0;
  };
  powerNodes.sort((a, b) => localX(b) - localX(a));
  add(
    'power',
    spec.model === 'helicopter' ? 'Collective' : 'All throttles',
    independent ? [] : powerNodes,
  );
  for (const [index, engine] of engines.entries()) {
    if (engines.length < 2) break;
    const names = independent ? [powerNodes[index] as string] : [];
    add('power', `Engine ${index + 1} throttle`, names, engine.id);
    for (const binding of interior?.bindings ?? []) {
      if (binding.source === 'power' && names.includes(binding.node))
        binding.source = `engines.${engine.id}.power`;
    }
  }
  add('engine', 'Engine master', []);
  const bank = spec.engines ?? (spec.engine ? [{ ...spec.engine, id: 'main' }] : []);
  for (const action of ['mixture', 'propeller'] as const) {
    const supported = bank.filter(
      (e) =>
        e.propulsion !== 'jet' && (action === 'mixture' ? e.mixtureControl : e.propellerControl),
    );
    const label = action === 'mixture' ? 'Mixture' : 'Propeller RPM';
    if (bank.length === 1 && supported.length) add(action, label, bound(action, /mixture|prop/i));
    else
      for (const engine of supported) {
        const index = engines.findIndex((e) => e.id === engine.id);
        add(
          action,
          `Engine ${index + 1} ${label.toLowerCase()}`,
          bound(`engines.${engine.id}.${action}`, /mixture|prop|condition/i),
          engine.id,
        );
      }
  }
  if (engines.length > 1)
    for (const [index, engine] of engines.entries())
      add('engine', `Engine ${index + 1}`, [], engine.id);
  if (spec.model === 'airplane' && !spec.airplane?.fixedGear)
    add('gear', 'Landing gear', [
      ...bound('gear', /handle|lever|selector/i),
      ...bound('gearPosition', /handle|lever|selector/i),
    ]);
  if (spec.model === 'airplane' && (spec.airplane?.flapLift ?? 0) > 0)
    add(
      'flaps',
      'Flaps',
      bound(
        'flapPosition',
        /flap.*(?:handle|lever|selector|pump)|(?:lever|handle).*flap|Skylane-flap|ATR72-power-lever-4/i,
      ),
    );
  if (spec.model === 'airplane') add('brake', 'Parking brake', []);
  if (spec.poweredLift)
    add('thrustVector', 'Nozzle / nacelle angle', bound('thrustVector', /lever|thumb/i));
  // Explicit model metadata also wires switches that have no legacy instrument binding.
  // Match only supported actions/engine IDs; arbitrary glTF extras cannot add simulator commands.
  model.traverse((node) => {
    const authored = node.userData.aircraftControl as AircraftControlNode | undefined;
    if (!authored || !node.name) return;
    const control = controls.find(
      (entry) => entry.action === authored.action && entry.engine === authored.engine,
    );
    if (!control) return;
    if (!control.nodes.includes(node.name)) control.nodes.push(node.name);
    const motion = authored.motion;
    if (
      !motion ||
      !['position', 'rotation'].includes(motion.property) ||
      !['x', 'y', 'z'].includes(motion.axis) ||
      !Number.isFinite(motion.scale) ||
      (motion.offset !== undefined && !Number.isFinite(motion.offset))
    )
      return;
    interior ??= { nodes: [], bindings: [] };
    const source = authored.engine
      ? `engines.${authored.engine}.${authored.action === 'engine' ? 'enabled' : authored.action}`
      : ((
          {
            yaw: 'yawInput',
            gear: 'gearCommand',
            flaps: 'flapCommand',
            thrustVector: 'vectorCommand',
          } as Partial<Record<AircraftControlAction, string>>
        )[authored.action] ?? authored.action);
    interior.bindings.push({ node: node.name, source, ...motion });
  });
  const targets = new Map<THREE.Object3D, AircraftCockpitControl>();
  for (const control of controls)
    for (const name of control.nodes)
      for (const node of nodes.get(name) ?? []) targets.set(node, control);
  const caster = new THREE.Raycaster();
  return {
    controls,
    interior,
    pick(ray) {
      caster.ray.copy(ray);
      model.updateWorldMatrix(true, true);
      for (const hit of caster.intersectObject(model, true)) {
        let hidden = false;
        for (let node: THREE.Object3D | null = hit.object; node; node = node.parent)
          if (!node.visible) hidden = true;
        if (hidden) continue;
        for (let node: THREE.Object3D | null = hit.object; node; node = node.parent) {
          const control = targets.get(node);
          if (control) return control;
        }
        const mesh = hit.object as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        // Glass does not intercept the pilot; solid panel/seat geometry does.
        if (
          materials.some(
            (material) => material && !(material.transparent && material.opacity < 0.8),
          )
        )
          return undefined;
      }
      return undefined;
    },
  };
}

export function aircraftControlValue(
  input: AircraftInputData,
  control: AircraftCockpitControl,
): number {
  if (control.action === 'stick') return input.roll;
  if (control.action === 'power')
    return control.engine ? (input.engines?.[control.engine]?.power ?? input.power) : input.power;
  if (control.action === 'mixture' || control.action === 'propeller')
    return (
      (control.engine ? input.engines?.[control.engine]?.[control.action] : undefined) ??
      input[control.action] ??
      1
    );
  if (control.action === 'engine')
    return Number(
      control.engine ? (input.engines?.[control.engine]?.enabled ?? true) : input.engine,
    );
  return Number(input[control.action] ?? 0);
}

/** Immutable pilot input update; hosts still submit it through flyAircraft's seat/authority checks. */
export function applyAircraftControl(
  input: AircraftInputData,
  change: AircraftControlChange,
  spec: AircraftSpec,
  state?: AircraftStateData,
): AircraftInputData {
  if (
    !Number.isFinite(change.value) ||
    (change.pitch !== undefined && !Number.isFinite(change.pitch))
  )
    return input;
  const { control, value } = change;
  const bank = spec.engines ?? (spec.engine ? [{ ...spec.engine, id: 'main' }] : []);
  if (control.engine && !bank.some((engine) => engine.id === control.engine)) return input;
  const clamp = (v: number, low = 0): number => Math.max(low, Math.min(1, v));
  const next = { ...input };
  switch (control.action) {
    case 'stick':
      next.roll = clamp(value, -1);
      next.pitch = clamp(change.pitch ?? input.pitch, -1);
      break;
    case 'yaw':
      next.yaw = clamp(value, -1);
      break;
    case 'power':
      if (control.engine)
        next.engines = {
          ...input.engines,
          [control.engine]: { ...input.engines?.[control.engine], power: clamp(value) },
        };
      else {
        next.power = clamp(value);
        // Common power deliberately synchronizes the levers, preserving individual cutoffs.
        if (input.engines)
          next.engines = Object.fromEntries(
            Object.entries(input.engines).map(([id, entry]) => [
              id,
              Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'power')),
            ]),
          );
      }
      break;
    case 'mixture':
    case 'propeller': {
      const action = control.action;
      const supported = bank.filter(
        (e) =>
          e.propulsion !== 'jet' && (action === 'mixture' ? e.mixtureControl : e.propellerControl),
      );
      if (!supported.length || (control.engine && !supported.some((e) => e.id === control.engine)))
        return input;
      if (control.engine)
        next.engines = {
          ...input.engines,
          [control.engine]: { ...input.engines?.[control.engine], [action]: clamp(value) },
        };
      else {
        next[action] = clamp(value);
        if (input.engines)
          next.engines = Object.fromEntries(
            Object.entries(input.engines).map(([id, entry]) => [
              id,
              Object.fromEntries(Object.entries(entry).filter(([key]) => key !== action)),
            ]),
          );
      }
      break;
    }
    case 'engine':
      if (control.engine)
        next.engines = {
          ...input.engines,
          [control.engine]: { ...input.engines?.[control.engine], enabled: value > 0 },
        };
      else next.engine = value > 0;
      break;
    case 'gear':
      if (spec.model !== 'airplane' || spec.airplane?.fixedGear || !state || state.grounded)
        return input;
      next.gear = value > 0;
      break;
    case 'flaps':
      if (spec.model !== 'airplane' || !spec.airplane?.flapLift) return input;
      next.flaps = clamp(value);
      break;
    case 'brake':
      next.brake = value > 0;
      break;
    case 'thrustVector':
      if (!spec.poweredLift) return input;
      next.thrustVector = clamp(value);
      break;
  }
  return next;
}

/** Transient pointer axes are mixed with keyboard/gamepad axes without latching after release. */
export class AircraftPointerAxes {
  pitch = 0;
  roll = 0;
  yaw = 0;
  set(change: AircraftControlChange): void {
    if (change.control.action === 'stick') {
      this.roll = change.value;
      this.pitch = change.pitch ?? 0;
    }
    if (change.control.action === 'yaw') this.yaw = change.value;
  }
  clear(): void {
    this.pitch = this.roll = this.yaw = 0;
  }
}
