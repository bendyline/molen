# City Courier

Complete five deliveries in a compact city before the clock runs out. Traffic and buildings damage your car; follow the mint beacon and the route map. Arcade acceleration, reverse, steering, braking, collision damage, victory and loss all run in a deterministic Worker simulation.

![City Courier](https://raw.githubusercontent.com/bendyline/molen/main/examples/city-courier/preview.png)

## Play

Play it in the browser at [molen.dev/play/city-courier](https://molen.dev/play/city-courier/). To run and change
your own copy, make one from the npm packages (no clone of the engine repository needed):

```sh
npx @bendyline/molen-tooling new my-city-courier --template city-courier
cd my-city-courier
npm install
npm run dev
```

W/S or Up/Down: accelerate and reverse. A/D or Left/Right: steer. Space: handbrake. R: restart.

## Authoring map

- `scene.json`: validated prefabs, level entities, component schemas, command payloads, input bindings, camera, physics, and gameplay configuration.
- `scripts/game.ts`: the complete game rules, with persistent state in components / `molen.state` and `checkpoint: "state"`.
- `src/scene.ts` and `src/worker.ts`: the same `buildWorld` path used by the CLI; no game-specific setup module.
- `src/main.ts`: HUD and browser presentation. It reads mirrored state and sends commands. No Three.js imports or simulation mutations.
- `commands.json` + `checks.json`: a short reproducible headless smoke scenario.
- `test/playthrough.test.js`: a bounded agent that wins with **only player commands**, then restarts. It never teleports entities or grants inventory.

The car is an arcade controller with a conservative circular collision footprint in XZ. It is not a suspension/tire simulation. Change handling and the delivery route in `scripts[0].config`, vehicle dimensions in the `vehicle` prefab, and traffic routes in `trafficCar` components.

## Verify

From this directory:

```sh
npx molen validate scene.json
npx molen sim run scene.json --ticks 90 --commands commands.json --assert checks.json --hash
npx molen replay delivery-run.replay.json
npx molen shot scene.json --ticks 3 --out city-courier.png
npm test
```

`npm test` includes the command-only playthrough and replays `delivery-run.replay.json`, so a behaviour
change reports the first divergent tick. Visuals are original primitive-based art with palette
materials; no downloads, API keys, licensed asset packs, or runtime asset generation are required.
`npm run build` writes a static `dist/` with relative URLs, so it can be hosted beneath any
subdirectory (molen.dev/play hosts this exact build).

In the engine repository this sample lives in `examples/city-courier/`. There, a browser test plays the
built Worker app (HUD, restart, resizing) under `pnpm --filter @bendyline/molen-examples-city-courier test:golden`,
and the [shared asset and startup contract](https://github.com/bendyline/molen/blob/main/examples/ASSETS.md)
explains editing masters and checked-in runtime files.
