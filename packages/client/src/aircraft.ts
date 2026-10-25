import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import {
  createModelSignalVisual,
  type ModelSignals,
  type ModelSignalVisual,
} from './model-signals';
import type { VehicleCameraOptions, VehicleCameraPose } from './vehicle-camera';
import { createVehicleInteriorVisual, type VehicleInteriorVisual } from './vehicle-interior';

export interface AircraftVisual {
  object: THREE.Object3D;
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
  dispose(): void;
}
/**
 * Takes ownership of a loaded library GLB. The named nodes remain editable in a DCC.
 *
 * The gear and flaps follow `state.gearPosition` and `state.flapPosition` as they travel, or the
 * selection in `input` when the state has no positions (helicopters, hosts that animate only).
 */
export function createAircraftVisual(model: THREE.Object3D, spec: AircraftSpec): AircraftVisual {
  const interior =
    spec.visual.interior === undefined
      ? undefined
      : createVehicleInteriorVisual(model, spec.visual.interior);
  const animation =
    spec.visual.animation === undefined
      ? undefined
      : createModelSignalVisual(model, spec.visual.animation);
  const moving = new Map<string, THREE.Object3D[]>();
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
  return {
    object: model,
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
        for (const node of moving.get(name) ?? []) node.visible = gear > 0;
      }
      for (const binding of spec.visual.flaps) {
        turn(binding.node, binding.axis, flaps * binding.multiplier);
      }
      for (const binding of spec.visual.ailerons) {
        turn(binding.node, binding.axis, input.roll * binding.multiplier);
      }
      if (interior === undefined && spec.visual.controlStick !== undefined) {
        turn(spec.visual.controlStick.node, spec.visual.controlStick.pitchAxis, input.pitch * 0.22);
        turn(spec.visual.controlStick.node, spec.visual.controlStick.rollAxis, input.roll * 0.22);
      }
      if (interior === undefined && spec.visual.collective !== undefined) {
        turn(
          spec.visual.collective.node,
          spec.visual.collective.axis,
          input.power * spec.visual.collective.multiplier,
        );
      }
      const engineSignals: Record<string, number | undefined> = Object.create(null);
      for (const engine of spec.engines ?? []) {
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
        ...engineSignals,
        ...signals,
      };
      interior?.update(telemetry, timeSeconds);
      animation?.update(telemetry, timeSeconds);
    },
    dispose() {
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
