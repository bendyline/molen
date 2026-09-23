# @bendyline/molen-tooling

The `molen` CLI and an MCP server over one shared ops library: scaffold a project, validate it,
simulate it headlessly, assert on the result, and render a PNG — no browser window and no human
in the loop.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i -g @bendyline/molen-tooling    # provides the `molen` executable
npx playwright install chromium      # needed by every op that renders
```

Or add it to a project (`npm i -D @bendyline/molen-tooling`) and run `npx molen …` from there.
Note the scope: the unscoped `molen` package on npm is unrelated to this one.

ESM only, Node >= 22.13. `typescript` is an **optional peer dependency** (>= 5.4) resolved from your
project, not from here, so `molen scripts check` uses the same compiler your editor does.

## Use

The inner loop. Each step prints structured, fixable text and exits non-zero on failure, so it
composes into CI or an agent's turn:

```sh
molen new my-experience && cd my-experience
npm install                          # the scaffold lists typescript as a devDependency

molen validate scenes/main.scene.json
molen scripts check
molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash
molen shot main --ticks 30 --out shot.png
```

```
tick: 30
hash: sha256:15b8fc099b055ac0d262bbc518e3099c15f9c6f845ae9ec31fee4b8d5ba8ade9
events: 0
physics: kinematics (cross-platform deterministic)
✓ 4/4 assertions passed
```

The hash is the determinism check: same build, same ticks, same hash. `molen replay <fixture>`
compares a recorded command log tick by tick and names the first tick that diverges.

## What's in it

| Surface | For |
|---|---|
| the `molen` bin | 37 operations, including `validate`, `sim run`, `sim watch`, `shot`, `frames`, `drive`, `play`, `replay`, `diff`, `new`, `asset import`/`inspect`/`pack`/`stage`/`shot`, `project info`, `types list`/`check`/`reserve`/`gen`/`test`, `scripts check`, `material bake`, `uvpaint apply`, `worldgen preview`/`bake`/`stats`, `figure preview` |
| `molen mcp` | every operation but the file watcher, as MCP tools over stdio; `drive_scene`, `play_experience`, `worldgen_preview` and `figure_preview` return frames as images |
| `molen describe [op]` | the machine-readable contract for every operation, CLI flags and MCP tool name side by side — the surface to build an agent against |
| discovery, no source reading | `molen schema list`/`get`, `molen components`/`component <name>`, `molen docs search <q>` over the engine docs bundle shipped inside this package |
| `.` (the ops library) | every op as a plain async `(input) => output`: `validateAsset`, `runSimulation`, `screenshotScene`, `runReplayFile`, `driveScene`, `playExperience`, `rasterizeMaterial`, `checkScripts`, `generateTypes`, `importAsset`, `scaffoldExperience`, … plus `OPS_CATALOG`, and `compareGolden`/`diffImages` for your own image tests |

Rendering ops (`shot`, `frames`, `drive`, `play`, `asset shot`, `figure preview`,
`worldgen preview`) render in headless Chromium over a software-rasterized WebGL context, so a
frame does not depend on the host GPU. That is why Playwright's browser download is a separate
step.

## Status

0.x. Nothing imports this package — it sits on top of the engine, so its version line moves with
everything else. All logic lives in the ops library and the CLI and MCP server are thin mappings
over it, which means new operations appear on both at once and `OPS_CATALOG` / `molen describe`
stay the one description of them. Expect operations and flags to be added; existing output shapes
are exercised by the repo's own tests but are not yet frozen.

## Docs

- [The headless agent dev loop](https://molen.dev/guide/agent-loop) — the loop above, step by step
- [CLI reference](https://molen.dev/reference/cli) — every command and flag
- [MCP reference](https://molen.dev/reference/mcp) — every tool and its I/O contract
- [API reference](https://molen.dev/api/tooling/index) — the ops library

MIT © Bendyline LLC
