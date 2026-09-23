# Quickstart

## Prerequisites

Node ≥ 22.13, pnpm. Clone the repo and install:

```
pnpm install
pnpm build
```

## Run the cubes demo in the browser

```
pnpm --filter @bendyline/molen-examples-cubes dev
```

Open the printed URL. ~50 cubes spin and drift, simulated at 30 Hz in a Web Worker kernel and
rendered with interpolation. Press **Space** to spawn a cube — the keypress emits a command that
the kernel validates and adjudicates; the client never mutates simulation state directly.

## Run the same scene headlessly

```
pnpm --filter @bendyline/molen-examples-cubes test:unit
```

This runs the cubes scene in Node for 300 ticks, asserts on world state, and checks the state
hash is identical across runs — the same determinism the browser demo relies on for smooth
interpolation and replay.

## Start your own (scaffold)

```
node packages/tooling/dist/cli.mjs new my-experience
```

Creates a runnable `my-experience/` project (project.json + scene + type registry + setup +
commands + checks) and prints the exact headless-loop commands. See the
[agent loop](agent-loop.md) and [projects & types](project.md).

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
