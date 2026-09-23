import type { VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
export interface VehicleCameraOptions {
  view: 'cockpit' | 'chase';
  lookYaw?: number;
  lookPitch?: number;
  /** Distance to the first static obstruction between two absolute world points. */
  obstructionDistance?: (
    from: [number, number, number],
    to: [number, number, number],
  ) => number | undefined;
}
export interface VehicleCameraPose {
  position: [number, number, number];
  lookAt: [number, number, number];
  yaw: number;
  pitch: number;
}
/** Seat-space cockpit and collision-shortened chase views for any vehicle host. */
export function vehicleCameraPose(
  transform: { pos: [number, number, number]; rot: [number, number, number, number] },
  spec: VehicleSpec,
  options: VehicleCameraOptions,
): VehicleCameraPose {
  const rotation = new THREE.Quaternion().fromArray(transform.rot);
  const yaw = options.lookYaw ?? 0,
    pitch = options.lookPitch ?? 0;
  const direction = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ).applyQuaternion(rotation);
  const origin = new THREE.Vector3().fromArray(transform.pos);
  let position = new THREE.Vector3()
    .fromArray(spec.driverEye)
    .applyQuaternion(rotation)
    .add(origin);
  let target = position.clone().add(direction);
  if (options.view === 'chase') {
    target = origin.clone().add(new THREE.Vector3(0, 1.1, 0));
    position = target
      .clone()
      .addScaledVector(direction, -spec.length - 3)
      .add(new THREE.Vector3(0, 2.8, 0));
    const distance = target.distanceTo(position),
      hit = options.obstructionDistance?.(target.toArray(), position.toArray());
    if (hit !== undefined && hit < distance) {
      const offset = position.clone().sub(target).normalize();
      position.copy(target).addScaledVector(offset, Math.max(0.2, hit - 0.25));
    }
  }
  const forward = target.clone().sub(position).normalize();
  return {
    position: position.toArray(),
    lookAt: target.toArray(),
    yaw: Math.atan2(forward.z, forward.x),
    pitch: Math.asin(forward.y),
  };
}
