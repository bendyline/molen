// @bendyline/molen-client/navigation — camera navigation for hosts that own their own frame
// loop: orbit (map-style), free flight, first-person walking with capsule collision against
// streamed geometry, and a chase camera; plus one input model spanning keyboard, gamepad, pointer
// gestures and an on-screen touch stick. Controllers are plain objects advanced with
// `update(dt, input, environment)` that return a camera pose; nothing here attaches to `window`.

export {
  applyCameraLookDelta,
  type CameraOrientation,
  cameraForward,
  cameraPlanarForward,
  cameraRight,
  MAX_LOOK_PITCH,
  type NavigationVector,
  orientationFromDirection,
  viewNeedsImmediateUpdate,
} from './navigation/camera-math';
export { CollisionTree } from './navigation/collision-tree';
export { FlyController, type FlyControllerOptions } from './navigation/fly';
export {
  FollowController,
  type FollowControllerOptions,
  type FollowSubject,
} from './navigation/follow';
export {
  idleNavigationInput,
  NAVIGATION_ACTIONS,
  type NavigationInput,
  NavigationInputSource,
  type NavigationInputSourceOptions,
  type NavigationKeyTarget,
  type NavigationProfileName,
  navigationInputProfiles,
} from './navigation/input-source';
export {
  type NavigationEnvironment,
  type NavigationPose,
  OrbitController,
  type OrbitControllerOptions,
  type OrbitFlyToOptions,
  type OrbitState,
} from './navigation/orbit';
export {
  type NavigationGestures,
  NavigationPointer,
  type NavigationPointerEvent,
  type NavigationPointerOptions,
  type NavigationPointerSurface,
  type NavigationWheelEvent,
} from './navigation/pointer';
export {
  createTouchJoystick,
  type TouchJoystick,
  type TouchJoystickOptions,
  TouchStick,
  type TouchStickOptions,
} from './navigation/touch-joystick';
export { WalkCollision } from './navigation/walk-collision';
export {
  RUN_SPEED,
  WALK_EYE_HEIGHT,
  WALK_SPEED,
  WalkController,
  type WalkInput,
} from './navigation/walk-controller';
