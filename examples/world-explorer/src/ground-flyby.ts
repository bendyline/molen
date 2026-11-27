import type { AircraftCameraPose } from '@bendyline/molen-client/aircraft';
import { WalkCollision } from '@bendyline/molen-client/navigation';
import { Boat } from '@bendyline/molen-kernel/boats';
import { Vehicle } from '@bendyline/molen-kernel/vehicles';
import { Transform, type World } from '@bendyline/molen-kernel/world';
import type * as THREE from 'three';
import { FlybyCamera, type FlybySight, VEHICLE_FLYBY, WALKER_FLYBY } from './flyby-camera.js';
import { collisionObstruction } from './walk-camera.js';

type Vec3 = [number, number, number];

/** The walker's size for the flyby camera (m): what it aims at and keeps beside. */
const WALKER = { length: 0.5, span: 0.5, height: 1.75 };

/**
 * The flyby view of what is driven, ridden or sailed, and of the walker: a bystander's camera at
 * the roadside or beside the footpath ahead (see `FlybyCamera`), in front of facades, walls and
 * slopes rather than inside or behind them.
 */
export interface GroundFlyby {
  /** The mounted vehicle's flyby pose, or undefined while it has no transform or type yet. */
  vehicle(id: string, speed: number): AircraftCameraPose | undefined;
  /** The walker's: `feet` and horizontal `velocity` in world meters, `forward` its heading. */
  walker(
    feet: Vec3,
    velocity: Vec3,
    forward: readonly [number, number, number],
  ): AircraftCameraPose;
  /** Place afresh on the next pose: the view was left, or its subject changed. */
  reset(): void;
}

export function createGroundFlyby(options: {
  root: THREE.Object3D;
  world: World;
  groundHeight: (x: number, z: number) => number | undefined;
  /**
   * Surfaces around the walker (`collisionObstruction` of the walk collision, kept around them
   * each frame): their flyby asks within its reach and scans nothing of its own.
   */
  walkObstruction: (from: Vec3, to: Vec3) => number | undefined;
}): GroundFlyby {
  // A vehicle's camera waits up to 45 m ahead, past the reach of the vehicles' own collision:
  // each placement scans around the way ahead once. A 40 m neighbourhood 24 m tall took 18 to
  // 57 ms a placement in central Seattle (on battery), so this one reaches 31 m from its center,
  // just past the farthest a placement asks, in a 12 m band. Vehicles are left out, the subject
  // among them. Instances count as their boxes: a tree hides the road behind it, its leaves need
  // not.
  const collision = new WalkCollision({
    ignoreVehicles: true,
    radius: 32,
    rebuildDistance: 1,
    verticalRadius: 12,
    instanceBounds: true,
  });
  const ahead: FlybySight = {
    prepare: (x, y, z) => {
      collision.invalidate();
      collision.update(options.root, x, z, y);
    },
    obstruction: collisionObstruction(collision),
  };
  const beside: FlybySight = { prepare: () => {}, obstruction: options.walkObstruction };
  const vehicles = new FlybyCamera(VEHICLE_FLYBY);
  const walkers = new FlybyCamera(WALKER_FLYBY);
  return {
    vehicle(id, speed) {
      const transform = options.world.get(id, Transform);
      const spec = (options.world.get(id, Vehicle) ?? options.world.get(id, Boat))?.spec;
      if (!transform || !spec) return undefined;
      // Local +Z is forward; the speed is negative in reverse, so the camera waits behind.
      const [x, y, z, w] = transform.rot;
      const forward: Vec3 = [
        2 * (x * z + w * y) * speed,
        2 * (y * z - w * x) * speed,
        (1 - 2 * (x * x + y * y)) * speed,
      ];
      return vehicles.pose(
        transform,
        forward,
        { length: spec.length, span: spec.width, height: spec.height },
        options.groundHeight,
        ahead,
      );
    },
    walker(feet, velocity, forward) {
      // A heading turn about +Y that takes local +Z onto `forward`.
      const yaw = Math.atan2(forward[0], forward[2]);
      return walkers.pose(
        { pos: feet, rot: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] },
        velocity,
        WALKER,
        options.groundHeight,
        beside,
      );
    },
    reset() {
      vehicles.reset();
      walkers.reset();
    },
  };
}
