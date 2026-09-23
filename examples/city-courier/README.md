# City Courier

Complete five deliveries in a compact city before the clock runs out. Traffic and buildings damage your car; follow the mint beacon and the route map. Arcade acceleration, reverse, steering, braking, collision damage, victory and loss all run in a deterministic Worker simulation.

![City Courier](preview.png)

## Play

From the repository root, after `pnpm install` (engine dependencies build automatically):

```sh
pnpm dev:driving
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

From the repository root:

```sh
node packages/tooling/dist/cli.mjs validate examples/city-courier/scene.json
node packages/tooling/dist/cli.mjs sim run examples/city-courier/scene.json --ticks 90 --commands examples/city-courier/commands.json --assert examples/city-courier/checks.json --hash
node packages/tooling/dist/cli.mjs shot examples/city-courier/scene.json --ticks 3 --out .artifacts/city-courier.png
pnpm --filter @bendyline/molen-examples-city-courier test:unit
pnpm --filter @bendyline/molen-examples-city-courier test:golden
```

Build before tests when engine code changes. The browser test plays the actual built Worker app,
checks HUD/state and diagnostics, exercises restart and resizing, and writes screenshots under
`.artifacts/`. Visuals are original primitive-based art with palette materials; no downloads,
API keys, licensed asset packs, or runtime asset generation are required.

The [shared asset and startup contract](../ASSETS.md) explains editing masters, checked-in
runtime files and deployment. `pnpm -r build` produces this game's `dist/`; its `preview` script
serves that build. Relative URLs support hosting the same build beneath a subdirectory.
