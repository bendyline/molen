import type { VehicleData, VehiclePlacement, VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createVehicleInteriorVisual,
  type VehicleInteriorSignals,
  type VehicleInteriorVisual,
} from './vehicle-interior';

export type { VehicleCameraOptions, VehicleCameraPose } from './vehicle-camera';
export { vehicleCameraPose } from './vehicle-camera';
export type { VehicleInteriorSignals, VehicleInteriorVisual } from './vehicle-interior';
export { createVehicleInteriorVisual } from './vehicle-interior';

export interface VehicleVisual {
  object: THREE.Object3D;
  interior?: VehicleInteriorVisual;
  update(steer: number, wheelAngle: number, signals?: VehicleInteriorSignals): void;
  dispose(): void;
}

/** Bind a loaded entity GLB to generic wheel/steering animation using external node names. */
export function createVehicleVisual(model: THREE.Object3D, vehicle: VehicleData): VehicleVisual {
  const interior =
    vehicle.visual.interior === undefined
      ? undefined
      : createVehicleInteriorVisual(model, vehicle.visual.interior);
  const nodes = new Map<string, THREE.Object3D[]>();
  const frontWheels = new Set(vehicle.visual.frontWheelNodes);
  const wheels: { node: THREE.Object3D; front: boolean; baseY: number }[] = [];
  let steeringWheel: THREE.Object3D | undefined;
  const color = new THREE.Color(vehicle.color);

  model.traverse((object) => {
    object.userData.vehicleGeometry = true;
    const named = nodes.get(object.name) ?? [];
    named.push(object);
    nodes.set(object.name, named);
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.material = materials.map((source) => {
        const material = source.clone();
        if (source.name === vehicle.visual.paintMaterial && 'color' in material) {
          (material as THREE.MeshStandardMaterial).color.copy(color);
        }
        return material;
      });
    }
  });
  for (const name of vehicle.visual.wheelNodes) {
    for (const node of nodes.get(name) ?? []) {
      wheels.push({ node, front: frontWheels.has(name), baseY: node.rotation.y });
    }
  }
  if (vehicle.visual.steeringWheelNode !== undefined)
    steeringWheel = nodes.get(vehicle.visual.steeringWheelNode)?.[0];

  return {
    object: model,
    interior,
    update(steer, angle, signals) {
      for (const wheel of wheels) {
        wheel.node.rotation.y = wheel.baseY + (wheel.front ? -steer : 0);
        const spinner = wheel.node.children[0] ?? wheel.node;
        spinner.rotation.x = angle;
      }
      if (interior === undefined && steeringWheel !== undefined)
        steeringWheel.rotation.z = steer * 2.5;
      interior?.update({ steering: steer, wheelAngle: angle, ...signals });
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(material);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      model.removeFromParent();
    },
  };
}

const parkedMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.55,
  metalness: 0.12,
});
const parkedTemplates = new Map<string, THREE.BufferGeometry>();

function coloredBox(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  length: number,
  color: string,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, length).translate(x, y, z).toNonIndexed();
  geometry.deleteAttribute('uv');
  const tint = new THREE.Color(color);
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = tint.r;
    colors[i + 1] = tint.g;
    colors[i + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Generic dimension-driven proxy used only for large dormant parking batches. */
function parkedTemplate(spec: VehicleSpec, color: string): THREE.BufferGeometry {
  const key = `${spec.width}:${spec.length}:${spec.height}:${spec.wheelbase}:${color}`;
  const cached = parkedTemplates.get(key);
  if (cached !== undefined) return cached;
  const parts = [
    coloredBox(0, spec.height * 0.34, 0, spec.width, spec.height * 0.48, spec.length, color),
    coloredBox(
      0,
      spec.height * 0.72,
      -spec.length * 0.06,
      spec.width * 0.82,
      spec.height * 0.42,
      spec.length * 0.52,
      '#526b78',
    ),
  ];
  for (const x of [-spec.wheelTrack / 2, spec.wheelTrack / 2]) {
    for (const z of [-spec.wheelbase / 2, spec.wheelbase / 2]) {
      const wheel = new THREE.CylinderGeometry(
        spec.wheelRadius,
        spec.wheelRadius,
        spec.width * 0.1,
        8,
      );
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(x, spec.wheelRadius, z);
      const wheelGeometry = wheel.toNonIndexed();
      wheelGeometry.deleteAttribute('uv');
      const charcoal = new THREE.Color('#20242a');
      const colors = new Float32Array(wheelGeometry.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = charcoal.r;
        colors[i + 1] = charcoal.g;
        colors[i + 2] = charcoal.b;
      }
      wheelGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(wheelGeometry);
      wheel.dispose();
    }
  }
  const geometry = mergeGeometries(parts) as THREE.BufferGeometry;
  for (const part of parts) part.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  parkedTemplates.set(key, geometry);
  return geometry;
}

/** Shared proxy geometry and instance batches for dormant terrain-owned entities. */
export function createParkedVehicleBatch(
  placements: readonly VehiclePlacement[],
  origin: [number, number] = [0, 0],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'surface:parked-cars';
  const buckets = new Map<string, VehiclePlacement[]>();
  for (const placement of placements) {
    const key = `${placement.kind}:${placement.color}`;
    const list = buckets.get(key) ?? [];
    list.push(placement);
    buckets.set(key, list);
  }
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  for (const list of buckets.values()) {
    const first = list[0] as VehiclePlacement;
    const mesh = new THREE.InstancedMesh(
      parkedTemplate(first.spec, first.color),
      parkedMaterial,
      list.length,
    );
    mesh.name = `vehicle:${first.kind}`;
    mesh.userData.vehicleIds = list.map((placement) => placement.id);
    mesh.userData.terrainOwnedInstances = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    list.forEach((placement, index) => {
      position.set(
        placement.position[0] - origin[0],
        placement.position[1],
        placement.position[2] - origin[1],
      );
      rotation.setFromEuler(
        new THREE.Euler(placement.pitch ?? 0, placement.yaw, placement.roll ?? 0, 'YXZ'),
      );
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}
