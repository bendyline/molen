# Three complete games, one authoring path

City Courier, The Lantern Vault and Skybound are complete games that exercise the same scene →
`buildWorld` → Worker → `mountExperience` path as the CLI. Each is JSON data + scene scripts,
with declared command/component schemas, input bindings, semantic prefabs, durable state, a HUD,
restart, and a tested win condition.

| Sample | Play | Loop | Engine services |
|---|---|---|---|
| City Courier | [molen.dev/play/city-courier](https://molen.dev/play/city-courier/) | Five deliveries, traffic, damage and a time limit | XZ kinematics, hierarchy, follow camera |
| The Lantern Vault | [molen.dev/play/lantern-dungeon](https://molen.dev/play/lantern-dungeon/) | Key, melee combat, healing, gate and relic | XZ kinematics/raycast, seeded RNG, hierarchy, tween, local follow camera |
| Skybound | [molen.dev/play/skybound](https://molen.dev/play/skybound/) | Islands, seeds, stomps, hazards, checkpoint and finish | XY platform controller, hierarchy, world follow camera |

To take one apart, copy it into your own npm project:

```sh
npx @bendyline/molen-tooling new my-courier --template city-courier   # or skybound
cd my-courier && npm install
npx molen sim run scene.json --ticks 90 --commands commands.json --assert checks.json --hash
npm test                                                             # includes the playthrough
npm run dev
```

The Lantern Vault is not a template, because its 28 GLB models are content and npm packages never
include content. Play it at molen.dev and read it
[on GitHub](https://github.com/bendyline/molen/tree/main/examples/lantern-dungeon).

Each sample's README documents controls and the exact validate/simulate/assert/screenshot
commands. `test/playthrough.test.js` in each sample proves its objective is reachable using player
commands alone. Headless tests also verify checkpoint continuation.

## Follow cameras

Camera tracking is part of scene data, so no example needs a custom Three.js camera loop:

```json
"camera": {
  "mode": "follow", "entity": "player",
  "offset": [0, 24, 18], "lookOffset": [0, 0, -3], "fov": 52
}
```

Offsets are world-axis meters by default. Set `"space": "local"` to rotate both offsets by the
entity quaternion. First person uses `offset: [0,1.6,0]`, `lookOffset: [0,1.6,-1]` and local
space. The target may be invisible; Skybound uses a separate camera-target entity to clamp
horizontal framing and keep the horizon steady while the player jumps.

Live tracking samples the same interpolation buffer as rendered objects. A missing target
holds the previous camera pose until it appears. `createClient` and `createSnapshotViewer`
accept `sceneCamera`; `mountExperience` supplies it automatically. `molen shot`, `drive`, and `frames`
resolve tracking against the captured keyframe. Explicit capture camera overrides still win.
`client.setCamera(pose)` overrides tracking for hosts that take over the camera.
Offsets do not inherit visual scale, and follow cameras do not perform obstacle avoidance.

## Lightweight platform physics

Choose `physics: { "engine": "platformer" }` for a deterministic, headless XY platform game.
It installs automatically in every `buildWorld` host, without WASM or a setup module:

```json
{
  "transform": { "pos": [0, 2, 0], "rot": [0, 0, 0, 1] },
  "platformBody": { "halfExtents": [0.35, 0.65], "speed": 7, "jumpSpeed": 12 },
  "platformIntent": { "move": 0, "jumpHeld": false }
}
```

Static platforms carry `platformSolid: { "halfExtents": [4,0.5] }`; add `oneWay: true` for
ledges the player can jump through from below. Dimensions are world-space meters, independent
of visual scale/rotation. The collision plane is XY; Z is preserved. Author non-overlapping
spawn positions. Motion sweeps X then Y to the nearest face, so fast bodies cannot tunnel
through thin walls, ceilings or floors along either sweep.

Translate commands to `platformIntent.move` (-1..1), a one-shot `jump: true`, and `jumpHeld`.
The service consumes the jump request, applies acceleration/gravity, handles coyote grace and
buffered presses, and exposes `platformBody.grounded` and `vel`. Releasing jump early reduces
upward velocity. Jump grace/buffer counters are component state, so checkpoints continue
without hidden closure state. Collision events publish after the resolved state is installed.

This service intentionally supports static axis-aligned solids and independent controlled
bodies. It has no body/body pushing, moving-platform carry, slopes, or rotation response; use
Rapier when a game needs those. It cannot be combined with `physics.character: true`.
Programmatic hosts can import the typed handles and `installPlatformer` from
`@bendyline/molen-kernel/platformer`.

## What these examples demonstrate

The game scripts have no renderer imports and no DOM access. Browser code never modifies the
simulation. Validation, headless play, replay/checkpoints, browser play, and screenshots consume
the same scene and scripts. The new camera and platform services remove duplicated host logic
and sample-specific collision solvers from ordinary game authoring.

These are compact single-player examples, not demonstrations of authoritative remote servers,
network prediction, vehicle suspension, full tabletop rules, or large-world streaming. The
world-explorer and terrain-flyover samples remain the terrain starting points.

## Lantern Vault asset collection

The dungeon ships 28 original GLB models: six creatures, eight architectural pieces and fourteen
props/items. Its textured stone, held equipment and tick-driven glTF clips use the same public
asset/component APIs as the headless tools. Three creatures participate in combat; three are
ambient dressing. The project index maps every model to a sidecar under `public/assets/`, so Vite
serves the same files that CLI captures verify.

See the [illustrated catalog](https://github.com/bendyline/molen/blob/main/examples/lantern-dungeon/asset-src/CATALOG.md)
and the [editable sources and regeneration guide](https://github.com/bendyline/molen/blob/main/examples/lantern-dungeon/asset-src/README.md).
The [example asset contract](https://github.com/bendyline/molen/blob/main/examples/ASSETS.md)
keeps editable masters and optimized runtime copies separately. The dungeon supports hand-edited
GLBs, protects them from accidental regeneration, and checks source/runtime freshness with a
Node-only verification script. [3D model assets](3d-model-assets.md) describes the same workflow
for your own project with the published CLI (`molen asset import`, `asset inspect --verify`,
`asset shot`). All three game builds use relative URLs, so each one can be hosted beneath a
subdirectory, as molen.dev/play does.
