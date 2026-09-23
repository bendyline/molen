import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { ModelSignals } from './model-signals';
import type { VehicleCameraOptions, VehicleCameraPose } from './vehicle-camera';
import { createVehicleInteriorVisual, type VehicleInteriorVisual } from './vehicle-interior';

export interface AircraftVisual {
  object: THREE.Object3D;
  interior?: VehicleInteriorVisual;
  update(
    state: AircraftStateData,
    input: AircraftInputData,
    altitude: number,
    signals?: ModelSignals,
  ): void;
  dispose(): void;
}
/** Takes ownership of a loaded library GLB. The named nodes remain editable in a DCC. */
export function createAircraftVisual(model: THREE.Object3D, spec: AircraftSpec): AircraftVisual {
  const interior =
    spec.visual.interior === undefined
      ? undefined
      : createVehicleInteriorVisual(model, spec.visual.interior);
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
    update(state, input, altitude, signals) {
      for (const binding of spec.visual.rotors) {
        const engine = binding.engine === undefined ? undefined : state.engines?.[binding.engine];
        turn(
          binding.node,
          binding.axis,
          (engine?.rotorAngle ?? state.rotorAngle) * binding.multiplier,
        );
      }
      for (const name of spec.visual.gearNodes) {
        for (const node of moving.get(name) ?? []) node.visible = input.gear;
      }
      for (const binding of spec.visual.flaps) {
        turn(binding.node, binding.axis, input.flaps ? binding.multiplier : 0);
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
      interior?.update({
        airspeed: state.airspeed,
        altitude,
        altitudeAGL: state.altitudeAGL,
        heading: state.yaw,
        verticalSpeed: state.verticalSpeed,
        rpm: state.rpm,
        pitch: state.pitch,
        roll: state.roll,
        power: input.power,
        pitchInput: input.pitch,
        rollInput: input.roll,
        yawInput: input.yaw,
        gear: Number(input.gear),
        flaps: Number(input.flaps),
        engine: Number(input.engine),
        ...signals,
      });
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
    up = new THREE.Vector3(0, 1, 0);
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
