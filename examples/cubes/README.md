# Cubes

Fifty seeded cubes spinning and drifting inside a bounce box, one `spawn_cube` command, one pinned determinism test. This is the smallest complete Molen experience and the reference for the architecture at minimum size: a scene manifest, the kernel in a Worker, the three.js client mounted on the page. Copy it when you start something new.

![Cubes](https://raw.githubusercontent.com/bendyline/molen/main/examples/cubes/preview.png)

## Run

Play it in the browser at [molen.dev/play/cubes](https://molen.dev/play/cubes/). To run and change
your own copy, make one from the npm packages (no clone of the engine repository needed):

```sh
npx @bendyline/molen-tooling new my-cubes --template cubes
cd my-cubes
npm install
npm run dev
```

Space: spawn one more cube. That is the scene's own `input` block — `Space` binds to a `spawn` action, and a `press` rule emits the `spawn_cube` command.

## Authoring map

- `scene.json`: fifteen lines of data — seed, 30 Hz tick rate, the fixed camera, the `Space` input rule, and the command with its doc string. No entities: the cubes are seeded in code.
- `src/cubes.ts`: the whole demo. The `spin` and `drift` components, the two systems that move them, the `spawn_cube` handler, and the fifty initial cubes seeded from the manifest seed via `createRng`. Rotation goes through `dmath`, never transcendental `Math`.
- `src/worker.ts`: `buildWorld(scene, setup)` under a `KernelHost` — the same build order the CLI uses.
- `src/main.ts`: `await mountExperience({ link: worker, scene, canvas })` plus a one-line hint. Framing and input come from `scene.json`, so this file re-declares nothing.

Cubes is a **setup-module** sample: the systems are TypeScript because ECS systems in other phases are exactly what a setup module is for. For the same shape expressed as pure scene data, read [top-down-arena](https://github.com/bendyline/molen/tree/main/examples/top-down-arena) (`--template top-down-arena`).

## Verify

From this directory:

```sh
npx molen validate scene.json
npx molen sim run scene.json --ticks 300 --setup src/cubes.ts --hash
npx molen shot scene.json --ticks 200 --setup src/cubes.ts --camera 9,6,17 --look 0,0,0 --out cubes.png
npm test
```

`--setup src/cubes.ts` hands Node a TypeScript module, which it loads with its built-in type
stripping: that is on by default from Node 22.18 (on 22.13–22.17, run with
`NODE_OPTIONS=--experimental-strip-types`).

`test/headless.test.ts` is the only test file, and it holds a **pinned state hash** at 300 ticks — the same hash `sim run --hash` prints above, so a drift is visible from the command line. Around it: run-to-run equality, component counts through a `molen/assert@1` doc, three `spawn_cube` commands adjudicated at their tick (50 + 3 cubes), and a check that the world changes at all between tick 1 and tick 100.

There is no golden image and no replay fixture here. Cubes is a determinism fixture, not a render one; `shot` is for looking at it, not for regressions.

In the engine repository this sample lives in `examples/cubes/`. The same commands run from
that directory, and `pnpm --filter @bendyline/molen-examples-cubes test:unit` runs its tests from the
root.
