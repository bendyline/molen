import type { AircraftCollisionProbe, AircraftContact, VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';

export interface AircraftObstacleScene {
  /** Collision tree origin and query, e.g. WalkCollision. */
  origin: THREE.Vector3;
  octree: {
    sphereIntersect(sphere: THREE.Sphere): false | { normal: THREE.Vector3; depth: number };
    getSphereTriangles?(sphere: THREE.Sphere, triangles: THREE.Triangle[]): unknown;
  };
  cars: ReadonlyArray<{
    transform: { pos: [number, number, number]; rot: [number, number, number, number] };
    spec: VehicleSpec;
  }>;
  /** Other aircraft body centers. The host excludes the queried aircraft. */
  aircraft: ReadonlyArray<[number, number, number]>;
}

/** Contact normals from streamed geometry and nearby parked vehicles, in absolute coordinates. */
export function aircraftObstacleContacts(
  probes: readonly AircraftCollisionProbe[],
  scene: AircraftObstacleScene,
): AircraftContact[] {
  const contacts: AircraftContact[] = [];
  for (const probe of probes) {
    const point = probe.center;
    const hit = (normal: THREE.Vector3, depth: number): void => {
      contacts.push({
        part: probe.part,
        point: new THREE.Vector3()
          .fromArray(point)
          .addScaledVector(normal, -probe.radius)
          .toArray(),
        normal: normal.toArray(),
        depth,
      });
    };
    const sphere = new THREE.Sphere(
      new THREE.Vector3().fromArray(point).sub(scene.origin),
      probe.radius,
    );
    if (scene.octree.getSphereTriangles) {
      const triangles: THREE.Triangle[] = [];
      scene.octree.getSphereTriangles(sphere, triangles);
      // Octree.sphereIntersect accumulates corrections from both faces of a thin wall,
      // sometimes pushing a sphere through it. Keep the face approached from outside.
      const faceNormal = new THREE.Vector3(),
        nearest = new THREE.Vector3();
      const faces: Array<{ normal: THREE.Vector3; depth: number }> = [];
      for (const triangle of triangles) {
        triangle.getNormal(faceNormal);
        if (faceNormal.dot(sphere.center.clone().sub(triangle.a)) < -1e-7) continue;
        triangle.closestPointToPoint(sphere.center, nearest);
        const offset = sphere.center.clone().sub(nearest);
        const distance = offset.length();
        if (distance >= probe.radius) continue;
        const normal = distance > 1e-7 ? offset.multiplyScalar(1 / distance) : faceNormal.clone();
        const depth = probe.radius - distance;
        const same = faces.find((face) => face.normal.dot(normal) > 0.9999);
        if (same) same.depth = Math.max(same.depth, depth);
        else faces.push({ normal, depth });
      }
      // Adjacent coplanar triangles also expose their shared diagonal as an edge contact.
      // The deepest face is the actual closest surface; extra edge impulses create snags.
      faces.sort(
        (a, b) =>
          b.depth - a.depth ||
          a.normal.x - b.normal.x ||
          a.normal.y - b.normal.y ||
          a.normal.z - b.normal.z,
      );
      const nearestFace = faces[0];
      if (nearestFace) hit(nearestFace.normal, nearestFace.depth);
    } else {
      const obstacle = scene.octree.sphereIntersect(sphere);
      if (obstacle) hit(obstacle.normal, obstacle.depth);
    }
    for (const { transform, spec } of scene.cars) {
      if (
        Math.hypot(transform.pos[0] - point[0], transform.pos[2] - point[2]) >
        Math.max(spec.width, spec.length) + probe.radius
      )
        continue;
      const orientation = new THREE.Quaternion().fromArray(transform.rot);
      const local = new THREE.Vector3()
        .fromArray(point)
        .sub(new THREE.Vector3().fromArray(transform.pos))
        .applyQuaternion(orientation.clone().invert());
      const bounds = new THREE.Box3(
        new THREE.Vector3(-spec.width / 2, 0, -spec.length / 2),
        new THREE.Vector3(spec.width / 2, spec.height, spec.length / 2),
      );
      const normal = local.clone().sub(bounds.clampPoint(local, new THREE.Vector3()));
      const distance = normal.length();
      if (distance >= probe.radius) continue;
      let depth = probe.radius - distance;
      if (distance > 0.0001) normal.multiplyScalar(1 / distance);
      else {
        const faces = (['x', 'y', 'z'] as const)
          .flatMap((axis) => [
            { axis, sign: -1, distance: local[axis] - bounds.min[axis] },
            { axis, sign: 1, distance: bounds.max[axis] - local[axis] },
          ])
          .sort((a, b) => a.distance - b.distance);
        const face = faces[0];
        if (!face) continue;
        normal.set(0, 0, 0);
        normal[face.axis] = face.sign;
        depth += face.distance;
      }
      hit(normal.applyQuaternion(orientation), depth);
    }
    for (const other of scene.aircraft) {
      const normal = new THREE.Vector3().fromArray(point).sub(new THREE.Vector3().fromArray(other));
      const distance = normal.length();
      if (distance < 1.2 + probe.radius)
        hit(
          distance > 0.0001 ? normal.multiplyScalar(1 / distance) : new THREE.Vector3(0, 1, 0),
          1.2 + probe.radius - distance,
        );
    }
  }
  return contacts;
}
