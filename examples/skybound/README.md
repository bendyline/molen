# Skybound

Cross five floating islands, collect fifteen seeds, stomp purple creatures, avoid pink thorns, and reach the lighthouse. A midpoint checkpoint saves your progress through falls. Three lives, full restart, short/full jumps, one-way ledges, and optional elevated collectibles give the small level a complete loop.

![Skybound](preview.png)

## Play

From the repository root, after `pnpm install` (engine dependencies build automatically):

```sh
pnpm dev:platformer
```

A/D or Left/Right: run. Space: jump; hold for a full jump, release for a short hop. R: restart.

## Authoring map

- `scene.json`: validated prefabs, level entities, component schemas, command payloads, input bindings, camera, physics, and gameplay configuration.
- `scripts/game.ts`: the complete game rules, with persistent state in components / `molen.state` and `checkpoint: "state"`.
- `src/scene.ts` and `src/worker.ts`: the same `buildWorld` path used by the CLI; no game-specific setup module.
- `src/main.ts`: HUD and browser presentation. It reads mirrored state and sends commands. No Three.js imports or simulation mutations.
- `commands.json` + `checks.json`: a short reproducible headless smoke scenario.
- `test/playthrough.test.js`: a bounded agent that wins with **only player commands**, then restarts. It never teleports entities or grants inventory.

The shared `physics.engine: "platformer"` service owns swept XY box collision, gravity, coyote time, jump buffering, and variable jump height. `platformSolid` boxes are static and axis-aligned; `oneWay` ledges only catch descending bodies. Moving-platform carry, slopes, and rigid-body interactions are outside this small controller. Use Rapier for those needs. Edit `platformBody` tuning and authored level entities; scripts never implement wall or floor collision.

## Verify

From the repository root:

```sh
node packages/tooling/dist/cli.mjs validate examples/skybound/scene.json
node packages/tooling/dist/cli.mjs sim run examples/skybound/scene.json --ticks 90 --commands examples/skybound/commands.json --assert examples/skybound/checks.json --hash
node packages/tooling/dist/cli.mjs shot examples/skybound/scene.json --ticks 3 --out .artifacts/skybound.png
pnpm --filter @bendyline/molen-examples-skybound test:unit
pnpm --filter @bendyline/molen-examples-skybound test:golden
```

Build before tests when engine code changes. The browser test plays the actual built Worker app,
checks HUD/state and diagnostics, exercises restart and resizing, and writes screenshots under
`.artifacts/`. Visuals are original primitive-based art with palette materials; no downloads,
API keys, licensed asset packs, or runtime asset generation are required.

The [shared asset and startup contract](../ASSETS.md) explains editing masters, checked-in
runtime files and deployment. `pnpm -r build` produces this game's `dist/`; its `preview` script
serves that build. Relative URLs support hosting the same build beneath a subdirectory.
