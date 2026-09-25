// Free flight: WASD/stick translate along the view, Q/E (or up/down actions) change altitude,
// drag or right stick looks. Speed scales with height above the ground so the same controls
// work for street-level drifting and continental hops.

import {
  applyCameraLookDelta,
  cameraForward,
  cameraPlanarForward,
  cameraRight,
  type NavigationVector,
} from './camera-math';
import type { NavigationInput } from './input-source';
import type { NavigationEnvironment, NavigationPose } from './orbit';

export interface FlyControllerOptions {
  /** Slowest speed in m/s, used near the ground (default 12). */
  minSpeed?: number;
  /** Speed per meter of height above ground, in 1/s (default 1.2). */
  speedPerMeter?: number;
  /** Multiplier while sprinting (default 4). */
  sprintFactor?: number;
  /** Minimum height above the ground under the camera, meters (default 2). */
  minClearance?: number;
  /** Radians per CSS pixel of look (default 0.003). */
  lookSensitivity?: number;
}

export class FlyController {
  readonly position: NavigationVector;
  /** Engine yaw: 0 faces +X (east), -PI/2 faces north. */
  yaw: number;
  /** Radians above the horizon (negative looks down). */
  pitch: number;
  private readonly minSpeed: number;
  private readonly speedPerMeter: number;
  private readonly sprintFactor: number;
  private readonly minClearance: number;
  private readonly lookSensitivity: number;

  constructor(
    position: NavigationVector,
    orientation: { yaw: number; pitch: number },
    options: FlyControllerOptions = {},
  ) {
    this.position = [...position];
    this.yaw = orientation.yaw;
    this.pitch = orientation.pitch;
    this.minSpeed = options.minSpeed ?? 12;
    this.speedPerMeter = options.speedPerMeter ?? 1.2;
    this.sprintFactor = options.sprintFactor ?? 4;
    this.minClearance = options.minClearance ?? 2;
    this.lookSensitivity = options.lookSensitivity ?? 0.003;
  }

  update(dt: number, input: NavigationInput, environment: NavigationEnvironment): NavigationPose {
    const step = Math.max(0, Math.min(0.1, dt));
    const turned = applyCameraLookDelta(
      this.yaw,
      this.pitch,
      input.look[0],
      input.look[1],
      this.lookSensitivity,
    );
    this.yaw = turned.yaw;
    this.pitch = turned.pitch;
    const ground = environment.groundHeight(this.position[0], this.position[2]);
    const aboveGround = ground === undefined ? 100 : Math.max(0, this.position[1] - ground);
    const speed =
      Math.max(this.minSpeed, aboveGround * this.speedPerMeter) *
      (input.sprint ? this.sprintFactor : 1) *
      step;
    const forward = cameraPlanarForward(this.yaw);
    const right = cameraRight(this.yaw);
    const { move } = input;
    for (let axis = 0; axis < 3; axis++) {
      this.position[axis] =
        (this.position[axis] as number) +
        ((forward[axis] as number) * move.forward + (right[axis] as number) * move.right) * speed;
    }
    this.position[1] += move.up * speed;
    const floor = environment.groundHeight(this.position[0], this.position[2]);
    if (floor !== undefined && this.position[1] < floor + this.minClearance) {
      this.position[1] = floor + this.minClearance;
    }
    const direction = cameraForward(this.yaw, this.pitch);
    return {
      position: [...this.position],
      lookAt: [
        this.position[0] + direction[0],
        this.position[1] + direction[1],
        this.position[2] + direction[2],
      ],
      direction,
    };
  }
}
