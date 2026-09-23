# @bendyline/molen-pathfinding

Grid flow fields for many-unit movement in Molen: one Dijkstra integration per goal, sampled by
any number of agents heading there.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-pathfinding
```

Node >= 22.13, ESM only, one `.` export, and no peer requirements at all: the built module imports
nothing — no three.js, no WASM, not even the kernel (the example below pulls it in only to show
where the directions get spent). It registers no components and no systems either, so you build
the grid from your own collision data and steer your units yourself.

## Use

```ts
import { Transform } from '@bendyline/molen-kernel';
import { MoveIntent } from '@bendyline/molen-kernel/character';
import { computeFlowField, Grid } from '@bendyline/molen-pathfinding';

const grid = new Grid({ cols: 256, rows: 256, cellSize: 1, origin: [0, 0] });
for (let cz = 40; cz < 200; cz++) grid.setBlocked(128, cz); // a wall to walk around

// One sweep per goal, not per unit — that is the whole point of a flow field.
const field = computeFlowField(grid, [200, 200]);

world.addSystem(
  (w) => {
    for (const [id, transform] of w.query(Transform)) {
      const [x, , z] = transform.pos;
      const [dx, dz] = field.directionAt(x, z); // unit step to the goal, [0, 0] if unreachable
      w.set(id, MoveIntent, { dir: [dx, dz], jump: false });
    }
  },
  { phase: 'update', name: 'steer' },
);
```

Pure and deterministic: no `Math.random`, no clock, stable tie-breaking by cell index, and
diagonal moves never cut a blocked corner. The same grid and goal give the same field everywhere.

## What's in it

- `Grid` — a uniform XZ grid with per-cell blocked flags, `worldToCell` / `cellToWorld`, and
  out-of-bounds treated as blocked.
- `computeFlowField(grid, goal)` — a `FlowField` with per-cell `cost` to the goal plus `dirX` /
  `dirZ`, read through `directionAt(x, z)` and `reachable(cx, cz)`.
- `DEFAULT_MAX_CELLS` — the cell-count ceiling, and `GridOptions.maxCells` to raise it.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package.

Mind the cost, because it scales with the whole grid rather than the distance walked: every
`computeFlowField` call allocates three `Float32Array`s over every cell plus heap entries —
about 13 bytes per cell — and runs a full Dijkstra sweep of every passable cell. Budget roughly
12 MB and about a second per query per million cells, and reuse one field for every agent with
the same goal. That is why `cols * rows` is capped at `DEFAULT_MAX_CELLS` (4,000,000 — a
2000x2000 grid): a bigger grid throws a `RangeError` naming the limit instead of quietly
allocating, and `maxCells` raises it as a deliberate, measured opt-in. Prefer a coarser `cellSize`
over a bigger grid.

## Docs

- [Examples gallery](https://molen.dev/guide/examples) — the capability layers, this one included
- [Scripting](https://molen.dev/guide/scripting) — where the directions usually get spent
- [Authoring a capability package](https://molen.dev/guide/capability-authoring)

MIT © Bendyline LLC
