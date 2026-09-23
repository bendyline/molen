# Figures gallery

Every shipped figure preset rendered side by side: three human ages, six quadrupeds, a rider seated on a horse, a hat on a head socket, a pack on a back socket, and a five-step body-type sweep. Seventeen figures, all as scene data. This is the reference for the figures capability — descriptors, canonical rigs, sockets and attachments, and the deterministic gaits.

![Figures gallery](preview.png)

## Run

From the repository root, after `pnpm install` (engine dependencies build automatically):

```sh
pnpm --filter @bendyline/molen-examples-figures-gallery dev
```

1: idle (clears the override). 2: walk in place. 3: run in place. `?walk=1` or `?run=1` sets the gait on load. The keys are the scene's own bindings (`Digit1`/`Digit2`/`Digit3` emitting `gait_idle`/`gait_walk`/`gait_run`); `set_gait` with `{ mode }` does the same from a test or the CLI.

## Authoring map

- `scene.json`: the entire gallery. The `figure` prefab, seventeen figure entities, an `environment` entity (hemisphere ambient plus a shadow-casting sun), the socketed hat and pack (`figureAttachment` + `parent`), the `mountable` horse with its `mounted` rider, the four gait commands with a payload schema on `set_gait`, and one inline `gaits` script that sets or removes `figureIntent` on every unmounted figure.
- `src/worker.ts`: the only capability wiring in the sample — `installFigures(world)` plus `figuresScriptApi` passed to `buildWorld` as a capability, so scripts can reach it.
- `src/main.ts`: `mountExperience` with `kinds: [figureKind()]`, the client half of the capability, and the `?walk=` / `?run=` query params.

Bodies are authored, not modelled: `height`, `build`, `features` (`hair`, `sleeves`) and `palette` overrides on a figure component reshape a preset in place — that is what the `sweep-*` row and the `slim` / `heavy` pair demonstrate. `molen figure presets` lists the nine presets that ship, and `molen figure preview` renders them without a scene.

## Verify

From the repository root:

```sh
node packages/tooling/dist/cli.mjs validate examples/figures-gallery/scene.json
node packages/tooling/dist/cli.mjs sim run examples/figures-gallery/scene.json --ticks 240 --hash
node packages/tooling/dist/cli.mjs shot examples/figures-gallery/scene.json --ticks 45 --camera 0,4.6,9.4 --look 0,1,0.9 --out .artifacts/figures.png
pnpm --filter @bendyline/molen-examples-figures-gallery test:unit
```

`test/headless.test.ts` is the only test file. It pins the **state hash** at 240 ticks — the same hash `sim run --hash` prints, so a rig, gait or pose-evaluation change has to be an intentional edit there — and adds run-to-run equality plus two `molen/assert@1` scenarios: every one of the seventeen figures gets a `figureState`, the rider's mode is `sit`, both attachments resolved to a `localTransform`, no `figures-error` event ever fires, and a `set_gait` walk-then-run sequence lands as `run` with `prevMode` `walk` before returning to idle.

No golden image and no replay fixture. The bodies are generated procedurally on the client, so the regression that matters lives in kernel state, not in pixels.
