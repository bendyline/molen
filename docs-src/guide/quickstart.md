# Quickstart

## Start your own project

Node ≥ 22.13. Scaffold a project from npm and install it:

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
first command: the unscoped `molen` on npm is unrelated. See the [agent loop](agent-loop.md) and
[projects & types](project.md).

## Run the samples from a clone

With pnpm, clone the repository and build it:

```
pnpm install
pnpm build
```

### The cubes demo in the browser

```
pnpm --filter @bendyline/molen-examples-cubes dev
```

Open the printed URL. ~50 cubes spin and drift, simulated at 30 Hz in a Web Worker kernel and
rendered with interpolation. Press **Space** to spawn a cube — the keypress emits a command that
the kernel validates and adjudicates; the client never mutates simulation state directly.

### The same scene headlessly

```
pnpm --filter @bendyline/molen-examples-cubes test:unit
```

This runs the cubes scene in Node for 300 ticks, asserts on world state, and checks the state
hash is identical across runs — the same determinism the browser demo relies on for smooth
interpolation and replay.

From a clone, the CLI is `node packages/tooling/dist/cli.mjs`.

## The shape of things

- **Kernel** (`@bendyline/molen-kernel`): headless, deterministic simulation. No DOM, no three.js. Runs
  in a Worker in the browser and directly in Node for testing.
- **Client** (`@bendyline/molen-client`): three.js rendering, interpolation, input. Speaks to the kernel
  only through messages (commands in; keyframes/deltas out).
- **Schema** (`@bendyline/molen-schema`): every wire and file format, with a validator that produces
  fixable error messages.
- **Tooling** (`@bendyline/molen-tooling`): the `molen` CLI and MCP server — validate, simulate,
  screenshot, replay, scaffold, and schema/component/docs introspection.

Next: the [agent loop](agent-loop.md).
