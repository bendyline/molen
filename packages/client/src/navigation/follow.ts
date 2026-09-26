// Chase camera behind a moving subject (an avatar, a vehicle, an animal), smoothed so the camera
// trails turns and bumps instead of welding to them. Look input swings the camera around the
// subject; it drifts back behind the subject after the input stops.

import type { NavigationVector } from './camera-math';
import type { NavigationInput } from './input-source';
import type { NavigationEnvironment, NavigationPose } from './orbit';

/** Where the followed subject is and which way it faces. */
export interface FollowSubject {
  position: NavigationVector;
  /** Compass bearing in radians the subject faces: 0 north, PI/2 east. */
  heading: number;
}

export interface FollowControllerOptions {
  /** Horizontal distance behind the subject, meters (default 6). */
  distance?: number;
  /** Camera height above the subject, meters (default 2.2). */
  height?: number;
  /** Height above the subject's origin the camera looks at, meters (default 1.2). */
  lookHeight?: number;
  /** Seconds to close ~63% of the gap to the ideal placement (default 0.18). */
  smoothing?: number;
  /** Seconds for look offsets to return behind the subject (default 1.5). */
  recenter?: number;
  /** Minimum height above the ground under the camera, meters (default 0.6). */
  minClearance?: number;
}

export class FollowController {
  private position: NavigationVector | undefined;
  private yawOffset = 0;
  private pitchOffset = 0;
  private readonly distance: number;
  private readonly height: number;
  private readonly lookHeight: number;
  private readonly smoothing: number;
  private readonly recenter: number;
  private readonly minClearance: number;

  constructor(options: FollowControllerOptions = {}) {
    this.distance = options.distance ?? 6;
    this.height = options.height ?? 2.2;
    this.lookHeight = options.lookHeight ?? 1.2;
    this.smoothing = options.smoothing ?? 0.18;
    this.recenter = options.recenter ?? 1.5;
    this.minClearance = options.minClearance ?? 0.6;
  }

  /** Snap next frame instead of easing (after a teleport or a subject change). */
  reset(): void {
    this.position = undefined;
    this.yawOffset = 0;
    this.pitchOffset = 0;
  }

  update(
    dt: number,
    subject: FollowSubject,
    input: NavigationInput,
    environment: NavigationEnvironment,
  ): NavigationPose {
    const step = Math.max(0, Math.min(0.1, dt));
    const looking = input.look[0] !== 0 || input.look[1] !== 0;
    this.yawOffset = Math.max(-Math.PI, Math.min(Math.PI, this.yawOffset - input.look[0] * 0.005));
    this.pitchOffset = Math.max(-0.35, Math.min(0.9, this.pitchOffset + input.look[1] * 0.004));
    if (!looking && this.recenter > 0) {
      const decay = Math.exp(-step / this.recenter);
      this.yawOffset *= decay;
      this.pitchOffset *= decay;
    }
    const heading = subject.heading + this.yawOffset;
    const lookAt: NavigationVector = [
      subject.position[0],
      subject.position[1] + this.lookHeight,
      subject.position[2],
    ];
    const reach = this.distance * Math.cos(this.pitchOffset);
    // Behind a subject facing `heading` (north = -Z) is the opposite compass direction.
    const ideal: NavigationVector = [
      subject.position[0] - Math.sin(heading) * reach,
      subject.position[1] + this.height + this.distance * Math.sin(this.pitchOffset),
      subject.position[2] + Math.cos(heading) * reach,
    ];
    if (this.position === undefined) this.position = [...ideal];
    else {
      const blend = this.smoothing <= 0 ? 1 : 1 - Math.exp(-step / this.smoothing);
      for (let axis = 0; axis < 3; axis++) {
        this.position[axis] =
          (this.position[axis] as number) +
          ((ideal[axis] as number) - (this.position[axis] as number)) * blend;
      }
    }
    const ground = environment.groundHeight(this.position[0], this.position[2]);
    if (ground !== undefined && this.position[1] < ground + this.minClearance) {
      this.position[1] = ground + this.minClearance;
    }
    const dx = lookAt[0] - this.position[0];
    const dy = lookAt[1] - this.position[1];
    const dz = lookAt[2] - this.position[2];
    const length = Math.hypot(dx, dy, dz) || 1;
    return {
      position: [...this.position],
      lookAt,
      direction: [dx / length, dy / length, dz / length],
    };
  }
}
