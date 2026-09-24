# Skybound

Cross five floating islands, collect fifteen seeds, stomp purple creatures, avoid pink thorns, and reach the lighthouse. A midpoint checkpoint saves your progress through falls. Three lives, full restart, short/full jumps, one-way ledges, and optional elevated collectibles give the small level a complete loop.

![Skybound](https://raw.githubusercontent.com/bendyline/molen/main/examples/skybound/preview.png)

## Play

Play it in the browser at [molen.dev/play/skybound](https://molen.dev/play/skybound/). To run and change
your own copy, make one from the npm packages (no clone of the engine repository needed):

```sh
npx @bendyline/molen-tooling new my-skybound --template skybound
cd my-skybound
npm install
npm run dev
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

From this directory:

```sh
npx molen validate scene.json
npx molen sim run scene.json --ticks 90 --commands commands.json --assert checks.json --hash
npx molen replay first-leap.replay.json
npx molen shot scene.json --ticks 3 --out skybound.png
npm test
```

`npm test` includes the command-only playthrough and replays `first-leap.replay.json`, so a behaviour
change reports the first divergent tick. Visuals are original primitive-based art with palette
materials; no downloads, API keys, licensed asset packs, or runtime asset generation are required.
`npm run build` writes a static `dist/` with relative URLs, so it can be hosted beneath any
subdirectory (molen.dev/play hosts this exact build).

In the engine repository this sample lives in `examples/skybound/`. There, a browser test plays the
built Worker app (HUD, restart, resizing) under `pnpm --filter @bendyline/molen-examples-skybound test:golden`,
and the [shared asset and startup contract](https://github.com/bendyline/molen/blob/main/examples/ASSETS.md)
explains editing masters and checked-in runtime files.
