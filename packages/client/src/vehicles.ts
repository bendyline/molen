import type { VehicleData, VehiclePlacement } from '@bendyline/molen-schema';
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
  // Types without a paint color keep the model's authored paint.
  const color = vehicle.color !== undefined ? new THREE.Color(vehicle.color) : undefined;

  model.traverse((object) => {
    object.userData.vehicleGeometry = true;
    const named = nodes.get(object.name) ?? [];
    named.push(object);
    nodes.set(object.name, named);
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const cloned = materials.map((source) => {
        const material = source.clone();
        if (
          color !== undefined &&
          source.name === vehicle.visual.paintMaterial &&
          'color' in material
        ) {
          (material as THREE.MeshStandardMaterial).color.copy(color);
        }
        return material;
      });
      // A material array only draws through geometry groups: keep a single material single, or
      // a mesh without groups renders nothing at all.
      object.material = Array.isArray(object.material) ? cloned : (cloned[0] as THREE.Material);
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

/** The dimensions a vehicle proxy is built from (a `VehicleSpec` satisfies it). */
export interface VehicleProxyDimensions {
  width: number;
  length: number;
  height: number;
  wheelbase: number;
  wheelTrack: number;
  wheelRadius: number;
}

/**
 * The parked-car proxy shape with a white body, for instanced rendering: per-instance paint comes
 * from `instanceColor` (three multiplies vertex colours by it, so glass and tyres stay dark).
 * Cached by dimensions; never dispose the returned geometry.
 */
export function vehicleProxyGeometry(dimensions: VehicleProxyDimensions): THREE.BufferGeometry {
  return parkedTemplate(dimensions, '#ffffff');
}

/** The shared vertex-coloured material of parked and proxy vehicles. */
export const vehicleProxyMaterial: THREE.MeshStandardMaterial = parkedMaterial;

/** Generic dimension-driven proxy used only for large dormant parking batches. */
function parkedTemplate(spec: VehicleProxyDimensions, color: string): THREE.BufferGeometry {
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

/**
 * Dormant terrain-owned cars merged into one static mesh per tile. A plain mesh shares its
 * compiled shader with every other tile; an instanced batch per model and paint would build one
 * of its own. `userData.vehicleIds[i]` owns vertex range `userData.vehicleRanges[2i..2i+1]`;
 * hide and restore a car with `setParkedVehicleHidden`.
 */
export function createParkedVehicleBatch(
  placements: readonly VehiclePlacement[],
  origin: [number, number] = [0, 0],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'surface:parked-cars';
  if (placements.length === 0) return group;
  const templates = placements.map((placement) => parkedTemplate(placement.spec, placement.color));
  const vertices = templates.reduce(
    (sum, template) => sum + template.getAttribute('position').count,
    0,
  );
  const positions = new Float32Array(vertices * 3);
  const normals = new Float32Array(vertices * 3);
  const colors = new Float32Array(vertices * 3);
  const ranges = new Uint32Array(placements.length * 2);
  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const vertex = new THREE.Vector3();
  let offset = 0;
  placements.forEach((placement, index) => {
    const template = templates[index] as THREE.BufferGeometry;
    position.set(
      placement.position[0] - origin[0],
      placement.position[1],
      placement.position[2] - origin[1],
    );
    rotation.setFromEuler(
      new THREE.Euler(placement.pitch ?? 0, placement.yaw, placement.roll ?? 0, 'YXZ'),
    );
    matrix.compose(position, rotation, scale);
    normalMatrix.getNormalMatrix(matrix);
    const source = template.getAttribute('position');
    const sourceNormals = template.getAttribute('normal');
    const sourceColors = template.getAttribute('color');
    for (let i = 0; i < source.count; i++) {
      vertex
        .fromBufferAttribute(source, i)
        .applyMatrix4(matrix)
        .toArray(positions, (offset + i) * 3);
      vertex
        .fromBufferAttribute(sourceNormals, i)
        .applyMatrix3(normalMatrix)
        .normalize()
        .toArray(normals, (offset + i) * 3);
      vertex.fromBufferAttribute(sourceColors, i).toArray(colors, (offset + i) * 3);
    }
    ranges[index * 2] = offset;
    ranges[index * 2 + 1] = source.count;
    offset += source.count;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, parkedMaterial);
  mesh.name = 'vehicle:parked';
  mesh.userData.vehicleIds = placements.map((placement) => placement.id);
  mesh.userData.vehicleRanges = ranges;
  mesh.userData.terrainOwnedGeometry = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/** Whether `setParkedVehicleHidden` currently hides car `index` of a parked batch. */
export function isParkedVehicleHidden(batch: THREE.Mesh, index: number): boolean {
  return (
    (batch.userData.vehicleHidden as Map<number, Float32Array> | undefined)?.has(index) ?? false
  );
}

/**
 * Hide (collapse to a point) or restore one car of a parked batch, e.g. while its detailed
 * model or a driven entity stands in for it. Returns whether the geometry changed.
 */
export function setParkedVehicleHidden(batch: THREE.Mesh, index: number, hidden: boolean): boolean {
  const ranges = batch.userData.vehicleRanges as Uint32Array | undefined;
  const start = ranges?.[index * 2];
  const count = ranges?.[index * 2 + 1];
  if (start === undefined || count === undefined) return false;
  let saved = batch.userData.vehicleHidden as Map<number, Float32Array> | undefined;
  if (saved === undefined) {
    saved = new Map();
    batch.userData.vehicleHidden = saved;
  }
  if (saved.has(index) === hidden) return false;
  const attribute = batch.geometry.getAttribute('position') as THREE.BufferAttribute;
  const array = attribute.array as Float32Array;
  const from = start * 3,
    to = (start + count) * 3;
  if (hidden) {
    saved.set(index, array.slice(from, to));
    array.fill(0, from, to);
  } else {
    array.set(saved.get(index) as Float32Array, from);
    saved.delete(index);
  }
  attribute.addUpdateRange(from, to - from);
  attribute.needsUpdate = true;
  return true;
}
