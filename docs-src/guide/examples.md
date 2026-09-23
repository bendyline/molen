# Examples gallery

Run `npm run dev` from the repository root to open the gallery and serve every browser example
from one local URL. The individual workspace commands below remain available when you only want
one demo.

Each example is a private workspace package that is simultaneously a browser demo and a headless
regression test. Run a demo with `pnpm --filter <pkg> dev`; run its headless test with
`pnpm --filter <pkg> test:unit`. They are the best copy-and-modify starting points.

| Example | Package | Shows | Run the demo |
|---|---|---|---|
| Cubes | `@bendyline/molen-examples-cubes` | ~50 spinning/drifting cubes; a `spawn_cube` command; determinism across runs | `pnpm --filter @bendyline/molen-examples-cubes dev` |
| Data viz | `@bendyline/molen-examples-data-viz` | data-driven entities (one per row) + a camera track; golden image | `pnpm --filter @bendyline/molen-examples-data-viz dev` |
| Terrain flyover | `@bendyline/molen-examples-terrain-flyover` | chunked LOD terrain from a descriptor + deterministic 16-bit heightmap | `pnpm --filter @bendyline/molen-examples-terrain-flyover dev` |
| World explorer | `@bendyline/molen-examples-world-explorer` | streamed Web Mercator terrain with adaptive package LOD, bare / land-classification / human-feature modes, and styled buildings from the default worldgen pack (`?style=`, `?synthetic=1&lineup=1`) | `pnpm --filter @bendyline/molen-examples-world-explorer dev` |
| Figures gallery | `@bendyline/molen-examples-figures-gallery` | a lineup of every figure preset, a body-type sweep, a hat on a head socket and a rider on a horse; `?walk=1` (or the `set_gait` command) animates the gaits in place | `pnpm --filter @bendyline/molen-examples-figures-gallery dev` |
| Top-down arena | `@bendyline/molen-examples-top-down-arena` | a complete small game as **pure data**: `scene.json` declares kinematics, the `move` command + WASD input, and four scripts (control/spawner/chaser/combat); no setup module | `pnpm --filter @bendyline/molen-examples-top-down-arena dev` |

## Playable game samples

[Three complete games, one authoring path](game-samples.md) explains the shared infrastructure.

| Game | Run | Demonstrates |
|---|---|---|
| City Courier | `pnpm dev:driving` | Arcade driving, traffic, five deliveries, damage, a time limit and restart |
| The Lantern Vault | `pnpm dev:dungeon` | First-person exploration, melee rolls, inventory, a locked gate and victory |
| Skybound | `pnpm dev:platformer` | Side-scrolling jumps, one-way ledges, seeds, stomps, hazards and checkpoints |

Each includes a command-only victory regression and a real-browser gameplay test.

## Capability layers used

- **Kinematics** (`@bendyline/molen-kernel/kinematics`): 2.5D circle/AABB collision, `raycast`,
  `overlapCircle` (arena).
- **Platformer** (`@bendyline/molen-kernel/platformer`): swept XY box movement against static
  solids, jump buffering, coyote grace, and short hops (Skybound).
- **Character controller** (`@bendyline/molen-kernel/character`): gravity + jump + planar movement
  from a `moveIntent` component.
- **Pathfinding** (`@bendyline/molen-pathfinding`): flow-field navigation over a grid.
- **Physics (Rapier)** (`@bendyline/molen-physics-rapier`): opt-in rigid-body plugin (WASM).
- **Terrain** (`@bendyline/molen-terrain`): `/kernel` heightfield queries + `/client` LOD meshes.
- **Worldgen** (`@bendyline/molen-worldgen`): `/kernel` outline → styled building and labeled
  polygon → prop generation; `/client` buffer uploads and style packs.
- **Worldgen Earth binding** (`@bendyline/molen-worldgen-earth`): `/kernel` terrain-semantics
  adapter and region atlas; `/client` terrain tile renderers.
- **Figures** (`@bendyline/molen-figures`): `/kernel` descriptors, rigs, gaits, `figureState`,
  sockets and attachments; `/client` the `figure` renderable kind (procedural skinned bodies).

## Start from scratch

`molen new <name>` scaffolds a runnable experience (scene with camera/input/commands + scripts +
setup + commands + checks + a Vite browser app) that already runs the [agent loop](agent-loop.md)
and mounts in a page ([browser-mount.md](browser-mount.md)). Then iterate.
