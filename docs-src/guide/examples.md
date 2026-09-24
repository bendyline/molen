# Samples gallery

Every sample is simultaneously a browser demo and a headless regression test, and each one is
meant to be copied. Three ways in, none of which needs a clone of the engine repository:

- **Play** any sample in the browser at [molen.dev/play](https://molen.dev/play/).
- **Copy** a sample into your own npm project with `--template`. The templates ship inside
  `@bendyline/molen-tooling`, locked to the engine version you install, so they work offline:

  ```
  npx @bendyline/molen-tooling new my-game --template skybound
  cd my-game && npm install && npm run dev
  ```

  `molen templates` lists them. A copy keeps whatever the sample has (scene, scripts, commands,
  checks, replay fixture, headless tests), so `npx molen sim run`, `npx molen replay` and
  `npm test` work in it straight away.
- **Read** the source on [GitHub](https://github.com/bendyline/molen/tree/main/examples).

| Sample | Shows | Play | Template |
|---|---|---|---|
| Cubes | ~50 spinning/drifting cubes; a `spawn_cube` command; determinism across runs | [play](https://molen.dev/play/cubes/) | `cubes` |
| Data viz | data-driven entities (one per row) + a camera track | [play](https://molen.dev/play/data-viz/) | `data-viz` |
| Top-down arena | a complete small game as **pure data**: `scene.json` declares kinematics, the `move` command + WASD input, and four scripts (control/spawner/chaser/combat); no setup module | [play](https://molen.dev/play/top-down-arena/) | `top-down-arena` |
| Terrain flyover | chunked LOD terrain from a descriptor + deterministic 16-bit heightmap | [play](https://molen.dev/play/terrain-flyover/) | `terrain-flyover` |
| Figures gallery | a lineup of every figure preset, a body-type sweep, a hat on a head socket and a rider on a horse; `?walk=1` (or the `set_gait` command) animates the gaits in place | [play](https://molen.dev/play/figures-gallery/) | `figures-gallery` |
| World explorer | streamed Web Mercator terrain with adaptive package LOD, bare / land-classification / human-feature modes, and styled buildings from the default worldgen pack (`?style=`, `?synthetic=1&lineup=1`) | [play](https://molen.dev/play/world-explorer/) | [source](https://github.com/bendyline/molen/tree/main/examples/world-explorer) |

## Playable game samples

[Three complete games, one authoring path](game-samples.md) explains the shared infrastructure.

| Game | Demonstrates | Play | Template |
|---|---|---|---|
| City Courier | Arcade driving, traffic, five deliveries, damage, a time limit and restart | [play](https://molen.dev/play/city-courier/) | `city-courier` |
| The Lantern Vault | First-person exploration, melee rolls, inventory, a locked gate and victory | [play](https://molen.dev/play/lantern-dungeon/) | [source](https://github.com/bendyline/molen/tree/main/examples/lantern-dungeon) |
| Skybound | Side-scrolling jumps, one-way ledges, seeds, stomps, hazards and checkpoints | [play](https://molen.dev/play/skybound/) | `skybound` |

Each includes a command-only victory regression (`test/playthrough.test.js`) that proves the game
is winnable without a browser.

World Explorer and The Lantern Vault are not templates. They carry content (terrain tiles and 28
GLB models), and npm packages never include content. Their scenes and code are still the best
reference for streaming and for a glTF asset pipeline, so read them on GitHub.

## Capability layers used

- **Kinematics** (`@bendyline/molen-kernel/kinematics`): 2.5D circle/AABB collision, `raycast`,
  `overlapCircle` (arena).
- **Platformer** (`@bendyline/molen-kernel/platformer`): swept XY box movement against static
  solids, jump buffering, coyote grace, and short hops (Skybound).
- **Character controller** (`@bendyline/molen-kernel/character`): gravity + jump + planar movement
  from a `moveIntent` component.
- **Pathfinding** (`@bendyline/molen-pathfinding`): flow-field navigation over a grid.
- **Physics (Rapier)** (`@bendyline/molen-physics-rapier`): opt-in rigid-body plugin (WASM).
  Colliders apply a positive uniform `transform.scale`, including offsets, asset geometry and
  heightfields, and a scale change rebuilds the collider while keeping the body and its velocity.
  Nonuniform, zero or negative scale on a physical entity fails with a diagnostic; bake it into
  the collision geometry. Purely visual entities keep per-axis scale.
- **Terrain** (`@bendyline/molen-terrain`): `/kernel` heightfield queries + `/client` LOD meshes.
- **Worldgen** (`@bendyline/molen-worldgen`): `/kernel` outline → styled building and labeled
  polygon → prop generation; `/client` buffer uploads and style packs.
- **Worldgen Earth binding** (`@bendyline/molen-worldgen-earth`): `/kernel` terrain-semantics
  adapter and region atlas; `/client` terrain tile renderers.
- **Figures** (`@bendyline/molen-figures`): `/kernel` descriptors, rigs, gaits, `figureState`,
  sockets and attachments; `/client` the `figure` renderable kind (procedural skinned bodies).

## Start from scratch

`molen new <name>` without `--template` scaffolds a minimal runnable experience (scene with
camera/input/commands + scripts + setup + commands + checks + a Vite browser app) that already
runs the [agent loop](agent-loop.md) and mounts in a page ([browser-mount.md](browser-mount.md)).
Then iterate.
