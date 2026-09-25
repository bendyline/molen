# Camera navigation

`@bendyline/molen-client/navigation` moves a camera through a world you render yourself with
`createViewer`: an orbit camera for map-style views, free flight, first-person walking with
collision against whatever geometry you stream, and a chase camera for vehicles or avatars. Input
comes from one model that spans keyboard, gamepad, mouse and touch gestures, and an on-screen
stick. Nothing here attaches to `window`; every listener goes on the element you pass, so the
controls embed cleanly in a larger page.

Controllers are plain objects. Each frame you read an input, call `update(dt, input, environment)`
and render the returned pose:

```ts
import { createViewer } from '@bendyline/molen-client';
import { NavigationInputSource, OrbitController } from '@bendyline/molen-client/navigation';

canvas.tabIndex = 0; // key events arrive once the canvas has focus; presses focus it
const viewer = await createViewer({ canvas, cameraFar: 500_000 });
const input = new NavigationInputSource({ element: canvas, profile: 'orbit' });
const orbit = new OrbitController({ target: [0, 0, 0], range: 3000, heading: 0, pitch: 0.6 });
const environment = { groundHeight: (x: number, z: number) => stream.sampleHeight(x, z) };

let last = performance.now();
function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  const pose = orbit.update(dt, input.read(dt), environment);
  stream.update({ position: pose.position, direction: pose.direction, verticalFov, viewportHeight });
  viewer.setCamera({ position: pose.position, lookAt: pose.lookAt });
  viewer.renderFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

`environment.groundHeight(x, z)` returns the ground height at a world position, or `undefined`
while that terrain has not streamed in. Terrain streams provide it as `sampleHeight`. Controllers
use it to settle onto ground as it loads and to keep the camera above it.

## Orbit

`OrbitController` frames a ground `target` from `range` meters away, looking along a compass
`heading` (0 north, `PI/2` east) and tilted `pitch` radians below the horizon. Drag to rotate and
tilt (the scene follows the pointer), use the wheel or a pinch to zoom, twist two fingers to
rotate, and pan with the secondary mouse button, shift-drag, two fingers, or WASD/arrow keys (Q/E
zoom). Motion eases toward a goal, so every change feels smooth.

`flyTo({ target, range, heading, pitch }, { durationMs })` animates to a framing. It rises
mid-flight on long hops so the camera clears the scenery, and any direct input cancels it.
`set(state)` jumps immediately, and `state` reads the current framing. The target settles onto the
ground as finer terrain arrives, and the camera never dips below `minClearance`.

## Fly

`FlyController` moves along the view with WASD or the left stick, changes altitude with Q/E, and
looks by dragging or with the right stick. Its speed scales with height above ground, from
`minSpeed` near the surface to continental speeds high up, so one control scheme works at every
scale. Shift sprints.

## Walk

`WalkController` is a 1.8 m capsule with gravity, jumping, wall sliding and a 50° walkable-slope
limit. It integrates at a fixed 120 Hz, so the same input produces the same path at any frame rate.
Its world position is `feet`; render the camera `WALK_EYE_HEIGHT` above it. Collision comes from
`WalkCollision`, which builds a small bounding-volume tree from the **visible** meshes under a root
(usually your terrain stream's object) within about 24 m of the walker. Rebuilds happen only when
the walker moves or that nearby geometry changes, and stay correct across floating-origin rebasing.

```ts
const walker = new WalkController();
const collision = new WalkCollision();
walker.reset(x, z);
// each frame:
collision.update(stream.object, walker.feet.x, walker.feet.z);
if (!walker.ready) walker.place(collision, sampleHeight); // finds open ground, not a roof
walker.update(dt, { forward, right, yaw, sprint, jump }, collision, sampleHeight);
```

Meshes opt out with `userData.walkIgnore = true`. Water materials and landcover overlays are never
solid. A missing terrain tile pauses movement until it arrives, rather than dropping the walker.

## Follow

`FollowController` trails a subject, given its position and compass heading, at a set distance
and height. It eases after turns and bumps instead of welding to them. Look input swings the camera
around the subject, and it drifts back behind the subject after the input stops. Call `reset()`
after a teleport. For the cockpit and chase views of a mounted vehicle, see
[vehicles](vehicles.md) (`vehicleCameraPose`).

## Input

`NavigationInputSource` combines an `InputMap` (keyboard, gamepad, software controls) with
`NavigationPointer` gestures into one `NavigationInput` per frame: `move` (forward/right/up,
-1..1), `look`, `pan`, `zoom`, `twist`, `sprint`, `jump`, edge-triggered `interact`/`view` press
counts, and element-relative `taps` for picking. You can also build a `NavigationInput` yourself,
which is useful in tests, replays and agent-driven cameras (`idleNavigationInput()` is the neutral
value).

Default profiles come from `navigationInputProfiles()`:

| Profile | Keys | Gamepad (standard mapping) |
|---|---|---|
| `orbit`, `fly` | WASD/arrows move, Q/E down/up, Shift sprint | left stick move, right stick look, bumpers up/down |
| `walk`, `drive` | WASD/arrows move, Space jump/brake, E or F interact, V view, Shift sprint | left stick move, right stick look, A jump, X interact, Y view |

Call `input.setProfile(mode)` when navigation changes. The walk profile also turns on pointer lock
for mouse-look, with drag-look as the fallback when pointer lock is declined. Replace any profile
with `input.map.defineProfile(name, profile)`. The action names are exported as
`NAVIGATION_ACTIONS`.

### Touch

One finger drags to look, two fingers pinch, twist and pan, and a quick tap is reported in `taps`.
For movement on phones, add the on-screen stick:

```ts
import { createTouchJoystick } from '@bendyline/molen-client/navigation';

const stick = createTouchJoystick(container, input.map); // bottom-left, style with className
stick.setVisible(matchMedia('(pointer: coarse)').matches);
```

The stick drives the same `nav-forward`/`nav-back`/`nav-left`/`nav-right` actions through
`InputMap.setVirtual`, so a phone moves exactly like a keyboard or gamepad. `TouchStick` is its
DOM-free geometry, if you want to draw your own.

## Streaming alongside the camera

Terrain selection is usually throttled (for example to 10 Hz). `viewNeedsImmediateUpdate(previous
position, previous direction, position, direction, moveThreshold, turnRadians)` reports when a
move or turn is large enough to outrun the selector's guard band, so you can update the stream
before rendering that frame.
