import type {
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
  LiveryData,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { type AircraftCockpit, createAircraftCockpit } from './aircraft-controls';
import { createAircraftDamageVisual } from './aircraft-damage';
import { createAircraftPropellers } from './aircraft-propellers';

export * from './aircraft-cockpit-pointer';
export * from './aircraft-collision';
export * from './aircraft-controls';

import { applyLivery } from './livery';
import {
  createModelSignalVisual,
  type ModelSignals,
  type ModelSignalVisual,
} from './model-signals';
import type { VehicleCameraOptions, VehicleCameraPose } from './vehicle-camera';
import { createVehicleInteriorVisual, type VehicleInteriorVisual } from './vehicle-interior';

export interface AircraftVisual {
  setLivery(data: LiveryData | undefined): void;
  object: THREE.Object3D;
  cockpit: AircraftCockpit;
  interior?: VehicleInteriorVisual;
  /** The spec's exterior `animation` bindings (gear legs and doors, control surfaces). */
  animation?: ModelSignalVisual;
  update(
    state: AircraftStateData,
    input: AircraftInputData,
    altitude: number,
    signals?: ModelSignals,
    timeSeconds?: number,
  ): void;
  /**
   * The camera, in the coordinates of `object.position`. Cabin nodes (the spec's interior) are
   * drawn only near it: from farther away a cockpit is a few pixels behind the canopy, yet it held
   * most of an aircraft's draw calls, and as many again in the shadow pass. Boarded and chase
   * views are always near enough.
   */
  updateView(camera: readonly [number, number, number]): void;
  dispose(): void;
}
/**
 * Takes ownership of a loaded library GLB. The named nodes remain editable in a DCC.
 *
 * The gear and flaps follow `state.gearPosition` and `state.flapPosition` as they travel, or the
 * selection in `input` when the state has no positions (helicopters, hosts that animate only).
 */
export function createAircraftVisual(
  model: THREE.Object3D,
  spec: AircraftSpec,
  livery?: LiveryData,
): AircraftVisual {
  const cockpit = createAircraftCockpit(model, spec);
  const interior =
    cockpit.interior === undefined
      ? undefined
      : createVehicleInteriorVisual(model, cockpit.interior);
  const animation =
    spec.visual.animation === undefined
      ? undefined
      : createModelSignalVisual(model, spec.visual.animation);
  const moving = new Map<string, THREE.Object3D[]>();
  const articulatedGear = new Set(
    (spec.visual.animation?.bindings ?? [])
      .filter((binding) => binding.property === 'rotation' || binding.property === 'position')
      .map((binding) => binding.node),
  );
  model.traverse((o) => {
    o.userData.vehicleGeometry = true;
    if (o instanceof THREE.Mesh) {
      o.castShadow = !o.name.includes('canopy') && !o.name.includes('bubble');
      o.receiveShadow = true;
    }
    const list = moving.get(o.name) ?? [];
    list.push(o);
    moving.set(o.name, list);
  });
  const turn = (name: string, axis: 'x' | 'y' | 'z', angle: number): void => {
    for (const node of moving.get(name) ?? []) node.rotation[axis] = angle;
  };
  let appearance = livery === undefined ? undefined : applyLivery(model, livery);
  const cabin = (spec.visual.interior?.nodes ?? []).flatMap((name) => moving.get(name) ?? []);
  // Nobody walks into a cockpit (boarding mounts the seat), and its hundreds of small parts made
  // the walker's collision tree beside a parked aircraft take a third of a second to build.
  for (const node of cabin)
    node.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) object.userData.walkIgnore = true;
    });
  const cabinRange = Math.max(60, 3 * Math.max(spec.length, spec.span));
  const damage = createAircraftDamageVisual(model, spec);
  let propellers = createAircraftPropellers(model, spec);
  let cabinShown = true;
  return {
    setLivery(data) {
      propellers.dispose();
      appearance?.dispose();
      damage.reset();
      appearance = data === undefined ? undefined : applyLivery(model, data);
      propellers = createAircraftPropellers(model, spec);
    },
    object: model,
    cockpit,
    interior,
    animation,
    update(state, input, altitude, signals, timeSeconds) {
      const gear = state.gearPosition ?? Number(input.gear);
      const flaps = state.flapPosition ?? Number(input.flaps);
      for (const binding of spec.visual.rotors) {
        const engine = binding.engine === undefined ? undefined : state.engines?.[binding.engine];
        turn(
          binding.node,
          binding.axis,
          (engine?.rotorAngle ?? state.rotorAngle) * binding.multiplier,
        );
      }
      for (const name of spec.visual.gearNodes) {
        // Authored hinges carry the gear into its well. Keep exposed stowed wheels visible
        // (e.g. 737 mains); the legacy hide/show fallback is only for unrigged models.
        if (articulatedGear.has(name)) continue;
        for (const node of moving.get(name) ?? []) node.visible = gear > 0;
      }
      for (const binding of spec.visual.flaps) {
        turn(binding.node, binding.axis, flaps * binding.multiplier);
      }
      for (const binding of spec.visual.ailerons) {
        turn(binding.node, binding.axis, input.roll * binding.multiplier);
      }
      if (spec.visual.interior === undefined && spec.visual.controlStick !== undefined) {
        turn(spec.visual.controlStick.node, spec.visual.controlStick.pitchAxis, input.pitch * 0.22);
        turn(spec.visual.controlStick.node, spec.visual.controlStick.rollAxis, input.roll * 0.22);
      }
      if (spec.visual.interior === undefined && spec.visual.collective !== undefined) {
        turn(
          spec.visual.collective.node,
          spec.visual.collective.axis,
          input.power * spec.visual.collective.multiplier,
        );
      }
      const engineSignals: Record<string, number | undefined> = Object.create(null);
      const bank = spec.engines ?? (spec.engine ? [{ ...spec.engine, id: 'main' }] : []);
      for (const engine of bank) {
        const reading = state.engines?.[engine.id];
        const prefix = `engines.${engine.id}.`;
        engineSignals[`${prefix}rpmNormalized`] = reading?.rpm;
        engineSignals[`${prefix}rotorRpm`] =
          reading === undefined
            ? undefined
            : (reading.rpm * engine.rotorAngularSpeed * 60) / (2 * Math.PI);
        engineSignals[`${prefix}failed`] =
          reading === undefined ? undefined : Number(reading.failed);
        engineSignals[`${prefix}thrustN`] = reading?.thrust;
        engineSignals[`${prefix}afterburner`] = reading?.afterburner ?? 0;
        engineSignals[`${prefix}shaftPowerW`] = reading?.shaftPower;
        engineSignals[`${prefix}combustion`] = reading?.combustion;
      }
      const telemetry: ModelSignals = {
        airspeed: state.airspeed,
        trueAirspeed: state.airspeed,
        equivalentAirspeed: state.equivalentAirspeed,
        mach: state.mach,
        overspeed: Number(state.overspeed ?? false),
        departure: state.departure ?? 0,
        vortexRing: state.vortexRing ?? 0,
        afterburner: Math.max(
          0,
          ...Object.values(state.engines ?? {}).map((engine) => engine.afterburner ?? 0),
        ),
        altitude,
        altitudeAGL: state.altitudeAGL,
        heading: state.yaw,
        verticalSpeed: state.verticalSpeed,
        rpm: state.rpm,
        rpmNormalized: state.rpm,
        // Shaft/prop/rotor speed configured by the flight model, never inferred turbine N1/N2.
        rotorRpm:
          spec.engines?.length || spec.engine === undefined
            ? undefined
            : (state.rpm * spec.engine.rotorAngularSpeed * 60) / (2 * Math.PI),
        pitch: state.pitch,
        roll: state.roll,
        pitchRate: state.pitchRate,
        rollRate: state.rollRate,
        yawRate: state.yawRate,
        angleOfAttack: state.angleOfAttack,
        sideslip: state.sideslip,
        loadFactor: state.loadFactor,
        groundSpeed:
          state.velocity === undefined
            ? undefined
            : Math.hypot(state.velocity[0], state.velocity[2]),
        stalled: Number(state.stalled),
        crashed: Number(state.crashed),
        power: input.power,
        pitchInput: input.pitch,
        rollInput: input.roll,
        yawInput: input.yaw,
        elevator: state.elevator ?? input.pitch,
        gear,
        flaps,
        thrustVector: state.thrustVectorPosition ?? 0,
        engine: Number(input.engine),
        brake: Number(input.brake),
        grounded: Number(state.grounded),
        ...state.actuators,
        ...engineSignals,
        ...signals,
      };
      for (const engine of bank) {
        // Commanded lever position, independent of shaft spool-up and external sensors.
        (telemetry as Record<string, number | undefined>)[`engines.${engine.id}.power`] =
          input.engines?.[engine.id]?.power ?? input.power;
        (telemetry as Record<string, number | undefined>)[`engines.${engine.id}.enabled`] = Number(
          input.engines?.[engine.id]?.enabled ?? true,
        );
        for (const action of ['mixture', 'propeller'] as const)
          (telemetry as Record<string, number | undefined>)[`engines.${engine.id}.${action}`] =
            input.engines?.[engine.id]?.[action] ?? input[action] ?? 1;
      }
      Object.assign(telemetry, {
        gearCommand: Number(input.gear),
        flapCommand: Number(input.flaps),
        vectorCommand: input.thrustVector ?? 0,
        engine: Number(input.engine),
        brake: Number(input.brake),
        mixture: input.mixture ?? 1,
        propeller: input.propeller ?? 1,
      });
      interior?.update(telemetry, timeSeconds);
      animation?.update(telemetry, timeSeconds);
      propellers.update(state);
      damage.update(state);
    },
    updateView(camera) {
      if (cabin.length === 0) return;
      const p = model.position;
      const distance = Math.hypot(p.x - camera[0], p.y - camera[1], p.z - camera[2]);
      // A little hysteresis, so a camera at the edge does not flicker the cabin.
      const shown = distance < cabinRange * (cabinShown ? 1.1 : 1);
      if (shown === cabinShown) return;
      cabinShown = shown;
      for (const node of cabin) node.visible = shown;
    },
    dispose() {
      damage.reset();
      propellers.dispose();
      appearance?.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
        }
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      model.removeFromParent();
    },
  };
}
export interface AircraftCameraPose extends VehicleCameraPose {
  rotation: [number, number, number, number];
}
export function aircraftCameraPose(
  transform: { pos: [number, number, number]; rot: [number, number, number, number] },
  spec: AircraftSpec,
  options: VehicleCameraOptions,
): AircraftCameraPose {
  const q = new THREE.Quaternion().fromArray(transform.rot);
  const origin = new THREE.Vector3().fromArray(transform.pos);
  const look = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-(options.lookPitch ?? 0), -(options.lookYaw ?? 0), 0, 'YXZ'),
  );
  const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(look).applyQuaternion(q);
  let position = new THREE.Vector3().fromArray(spec.pilotEye).applyQuaternion(q).add(origin);
  let target = position.clone().add(direction);
  let up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  if (options.view === 'chase') {
    target = origin.clone().add(new THREE.Vector3(0, 1.5, 0));
    position = target
      .clone()
      .addScaledVector(direction, -spec.length * 1.5)
      .add(new THREE.Vector3(0, 4.5, 0));
    const hit = options.obstructionDistance?.(target.toArray(), position.toArray());
    if (hit !== undefined && hit < target.distanceTo(position)) {
      const offset = position.clone().sub(target).normalize();
      position.copy(target).addScaledVector(offset, Math.max(0.3, hit - 0.3));
    }
    // World up keeps the horizon level in ordinary flight; toward the vertical of a loop it
    // stops defining a view, so the camera takes the airframe's own up instead.
    const vertical = THREE.MathUtils.smoothstep(Math.abs(direction.y), 0.7, 0.95);
    up = new THREE.Vector3(0, 1, 0).lerp(up, vertical).normalize();
  }
  const forward = target.clone().sub(position).normalize();
  const rotation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, up),
  );
  return {
    position: position.toArray(),
    lookAt: target.toArray(),
    rotation: rotation.toArray(),
    yaw: Math.atan2(forward.z, forward.x),
    pitch: Math.asin(forward.y),
  };
}
