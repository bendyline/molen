# Quickstart

Everything here runs from the published npm packages. You never need a clone of the engine
repository to build on Molen. Node ≥ 22.13.

## See it running

Every sample plays in the browser at [molen.dev/play](https://molen.dev/play/), with nothing to
install: three complete games, the capability demos and the small starters.

## Start your own project

Scaffold a project from npm and install it:

```
npx @bendyline/molen-tooling new my-experience
cd my-experience
npm install                       # the engine, the molen CLI, TypeScript and Vite
npx playwright install chromium   # once per machine, for screenshots
npx molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash
npm run dev                       # the same scene in the browser
```

`my-experience/` is a runnable project (project.json + scene + type registry + setup + commands +
checks), and `new` prints the exact headless-loop commands. Use the scoped package name for the
first command: the unscoped `molen` on npm is unrelated. Inside the project, `npx molen` runs the
CLI the project installed. See the [agent loop](agent-loop.md) and
[projects & types](project.md).

## Start from a sample instead

The smaller samples ship inside `@bendyline/molen-tooling` as templates, locked to the engine
version you install. `--template` copies one into a standalone npm project that you own:

```
npx @bendyline/molen-tooling templates                  # list them
npx @bendyline/molen-tooling new my-game --template skybound
cd my-game
npm install
npm test                          # the sample's headless tests, in Node
npm run dev
```

The cubes template is the whole architecture at minimum size. About 50 cubes spin and drift,
simulated at 30 Hz in a Web Worker kernel and rendered with interpolation. Press **Space** to
spawn a cube: the keypress emits a command that the kernel validates and adjudicates, and the
client never mutates simulation state directly. Its `npm test` runs the same scene in Node for 300
ticks, asserts on world state, and checks the state hash is identical across runs. That is the
determinism the browser relies on for smooth interpolation and replay.

The [samples gallery](examples.md) lists every template and what each one teaches. The largest
samples (World Explorer and The Lantern Vault) carry content that npm packages never include, so
you play them at molen.dev and read their source on GitHub instead.

## The shape of things

- **Kernel** (`@bendyline/molen-kernel`): headless, deterministic simulation. No DOM, no three.js. Runs
  in a Worker in the browser and directly in Node for testing.
- **Client** (`@bendyline/molen-client`): three.js rendering, interpolation, input. Speaks to the kernel
  only through messages (commands in; keyframes/deltas out).
- **Schema** (`@bendyline/molen-schema`): every wire and file format, with a validator that produces
  fixable error messages.
- **Tooling** (`@bendyline/molen-tooling`): the `molen` CLI and MCP server. It validates,
  simulates, screenshots, replays and scaffolds, and answers schema, component and docs questions.
  It also carries this documentation, version-locked, at `dist/docs-src/`.

Shared content (entity models, the default building style pack, the Earth catalogs, the star
table) is not in any npm package. It comes as content packs:
`npx molen pack fetch https://molen.dev/packs/index.json` downloads them into your project and pins
them in project.json. See [content packs](project.md#content-packs-packs).

Next: the [agent loop](agent-loop.md).
