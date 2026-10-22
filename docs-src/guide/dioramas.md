# Dioramas: scripted set pieces

A diorama is an ordinary `molen/scene@3` scene played inside a bounded local space: figures,
props and script choreography that make a place look alive. `@bendyline/molen-dioramas/kernel`
runs it headlessly; `/client` selects nearby placements and draws them in an existing viewer.
There is no second scripting language or football simulator. Use normal `molen.on('tick')`,
transforms, figure descriptors, timers, state and events.

The content pack includes a high-school football stage: two uniform palettes, fourteen helmeted
players running a repeated play, sixty seated/standing spectators, stands, goalposts and a
scoreboard with changing digits and a pulsing light. Its 24-second cycle lines up, runs,
celebrates and returns. The scores are decorative choreography. Content lives in the separate
`molen.dioramas` content pack, outside the npm runtime. Five more scenes stage an airport ramp,
little league, fireworks, a fair and a Saturday market. Every scene is a self-contained source
bundle with a typed script, local bounds and fixed entity pools.

## Definition and local simulation

```ts
import { createDiorama } from '@bendyline/molen-dioramas/kernel';

const playback = createDiorama({
  scene, // validated scene data; scripts[].path resolved to scripts[].code
  bounds: { min: [-72, -8, -52], max: [72, 24, 52] },
  maxEntities: 512,
});
const initial = playback.keyframe();
const delta = playback.advance(1 / 30);
playback.dispose();
```

Each instance owns a separate seeded world, script state, entity ids, figures, timers and RNG.
Two stadiums can use identical entity ids. Moving or rotating the stage never changes its local
simulation. Fixed ticks make the same scene/seed/tick count reproducible. Mark checkpoint-safe
scripts with `checkpoint: 'state'`; store durable values in components or `molen.state`.

Bounds are an axis-aligned box in local meters, Y up. After initialization and each tick, origins
are clamped to this box. Mesh extents can cross it: include an appropriate margin and author
paths inside it. This is an authoring guard, not collision or a security boundary. Scripts follow
the normal [script trust](scripting.md#script-trust-a-script-runs-as-the-host-process) contract.
The prototype supports scripted and kinematic scenes with figures; terrain, ambient networks
and Rapier remain outside it. It does not share collisions, input commands or audio with the host.

## Lazy playback in a viewer

```ts
import {
  createDioramaVisual, DioramaDirector, loadDioramaScene,
} from '@bendyline/molen-dioramas/client';

const director = new DioramaDirector({
  maxActive: 2,
  create: (definition, placement) => createDioramaVisual(definition, placement, {
    root: viewer.renderer.worldRoot,
    camera: viewer.renderer.camera,
    // assets: a host-owned AssetCache, when the scene uses glTF refs
    // A large streamed world keeps the diorama's own lights out (see below).
    localLights: false,
  }),
  onError: (error, id) => console.error(id, error),
});
director.add({
  id: 'school-field',
  position: [120, 4, 200],
  yaw: 0.4,
  enterDistance: 350,
  exitDistance: 420,
  load: (signal) => loadDioramaScene(new URL('./football/scene.json', contentBase), {
    min: [-72, -8, -52], max: [72, 24, 52],
  }, signal),
  // Optional host-selected event window, in UTC epoch milliseconds:
  active: (timeMs) => timeMs >= eventStartMs && timeMs < eventEndMs,
});

// In the existing frame loop (camera position uses absolute world coordinates):
director.update(cameraPosition, elapsedSeconds, Date.now());
// On teardown:
director.dispose();
```

A diorama's point and spot lights light the host scene by default. In a large streamed world, pass
`localLights: false` (Earth hosts do): three compiles the scene's lights into every lit shader, so a
light that arrives and leaves with a diorama rebuilds every object in view in one frame.

The loader is a host callback: use an allowlisted dynamic import, HTTP URL or your pack reader.
The runtime never chooses content hosts. `loadDioramaScene` fetches the scene and relative `.js`
scripts with the supplied AbortSignal. For `.ts`, use `molenScripts()` with a lazy `?raw` import
and `inlineScriptSources`, or erase types when publishing the content. The scripting runtime is
itself dynamically imported on first activation. On a page that mounts with a top-level `await`,
add `@bendyline/molen-dioramas/client` (or `@bendyline/molen-earth/client`, when the page uses
`mountEarthView`) to the `vendor` chunk beside three.js and the client, as in
[Production builds](browser-mount.md#production-builds); otherwise the lazy runtime's chunk
imports the entry and never settles.

The director defaults to two active or loading instances, each with a default 512-entity budget.
Existing instances retain their slot until leaving the exit radius; vacant slots choose nearest
eligible placements. Distance includes camera altitude. No work runs while out of range or
outside the supplied schedule. Schedule time is host policy and does not enter the state hash.
`status(id)` reports `idle`, `loading`, `playing` or `failed`; `retry(id)` explicitly retries a
failure. Failures release their slot and never retry every frame. Removal, disposal and leaving
range cancel pending requests; late results cannot resurrect removed instances.

Leaving range destroys the local simulation and visual resources. Re-entry restarts from the
seed. There is no offline catch-up, persistent game result or synchronization between stadiums.
Frame stalls advance at most 0.2 seconds per call. Passing zero holds playback. Normal entities,
static batching and figure distance tiers are reused; local scenes cannot replace the viewer's
lighting, weather or sky clock.

## Earth placement

World Explorer enables the shipped placement catalog by default. Its **Living places** checkbox
controls playback; its place picker and **Visit** button open any of the six registered scenes.
Direct links accept `?diorama=football`, `airport`, `little-league`, `fireworks`, `fair` or `market`.
Visit framing adapts to the viewport and fits above the loaded terrain; explicit camera
parameters take precedence. `?dioramas=0` disables playback. Source locations and orientation are data in
`content/dioramas/placements.json`. Content and script text stay in a separate lazy chunk until
the camera approaches. The Earth view example uses the same catalog by default.

Hosts that compose their own terrain loop, as World Explorer does, can use the exported
`EarthDioramaDirector` directly: call `update` with the terrain root, camera, absolute observer
position, elapsed seconds, clock, geographic-to-world transform and ground-height sampler;
call `dispose` on teardown. It uses the same implementation as `mountEarthView`.

`mountEarthView` accepts `dioramas: { maxActive, placements }`. Its returned `view.dioramas`
also exposes `add`, `remove`, `list`, `status` and `retry`:

```ts
view.dioramas.add({
  id: 'school-game',
  latitude: 47.61,
  longitude: -122.03,
  yaw: 0,
  enterDistance: 350,
  load: loadFootball, // (signal) => Promise<{ scene, bounds, maxEntities? }>
});
```

Choose a suitable mapped location in your host. Omitted `altitude` waits for terrain height at
the anchor; a supplied altitude is absolute meters. `groundFootprint: [71, 51]` samples the
center, corners and edge centers of a rotated footprint and anchors just above its highest
sample. The anchor follows terrain LOD refinement without resetting playback. Author a buried
foundation deep enough to close the resulting edges; this is intended for nearly flat sites.
The local stage stays flat; the prototype
does not reshape the terrain, fit arbitrary polygons or remove existing stadium geometry.
Local axes are east/up/south, and positive yaw rotates +Z toward east. Geographic registrations
survive terrain re-anchoring; old instances are disposed and recreated in the new frame.
Automatic matching of map features to dioramas is a future host policy, not silently enabled.

## Shipped performances

| Set piece | Geometry and roles | Choreography |
| --- | --- | --- |
| Airport apron | A bounded apron; tugs, baggage carts, service staff | A tug towing three baggage carts, a separate service van, a conveyor and walking crew |
| Little league | Diamond and spectator edge; two team palettes | Pitch/bat cues, a runner around bases, fielders out and back |
| Fireworks | Launch zone and audience zone | Three staggered launches, 96 reusable sparks, pulse lights and forty spectators |
| Fair | Booth strip and ride footprints | Rotating Ferris wheel with upright gondolas, bobbing carousel and circulating visitors |
| Saturday market | Stalls and pedestrian aisles | Eight produce stalls, browsing pauses, vendors and a moving handcart |

The performances do not claim to depict actual local events. Placement provenance is in the
catalog. The airport has elevation but sits outside the bundled detailed street extract.
Use the host time slider for dusk fireworks; scripts leave the host clock unchanged.

Keep motion and cue timing in scripts, uniforms/props in scene data, and geographic selection
and calendar policy in the host. Start with one convincing repeated vignette. Prefer a few
recognizable actions to full game rules, transport routing or crowd AI.

## Headless authoring loop

Use the existing `molen validate`, `molen scripts check`, `molen sim run --hash`, `molen replay`
and `molen shot` operations on the scene before placing it. These operate on the same script and
figures as the viewer. The runtime's additional confinement/budget guard is exercised by
`createDiorama` tests. Check both a wide view and an eye-level view, multiple points in the loop,
and leaving/re-entering range. No new CLI operation is needed.
