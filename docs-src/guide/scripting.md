# Game logic: scripts and setup

A molen experience is **data plus scripts**. The scene manifest declares the world, the commands
it accepts, and its scripts; the scripts hold the logic. A code setup module exists for the rare
things scripts cannot express, and for typed TypeScript authoring inside a project that installs
the engine packages.

## 1. Scene-data scripts (the default)

Put logic in the scene manifest's `scripts` array. Each script is evaluated in its own SES
`Compartment` with two injected globals: `molen` (the verb set below) and `config` (this script's
config object, frozen). Author it as a scene-file-relative `path` to a **`.ts`** file (the
default — see [Typed scripts](#typed-scripts-checked-before-the-first-tick)), a `.js` file, or
inline as `code` (exactly one of `code` or `path`).

The Compartment is a determinism harness, **not** a security boundary — a script runs with the
authority of the host process that evaluates it. Read
[Script trust](#script-trust-a-script-runs-as-the-host-process) before you run a manifest you did
not write.

Only JavaScript is ever evaluated: a `.ts` script has its **types erased where the
scene is loaded** — the tooling loader in Node, the `molenScripts()` Vite plugin in the browser.
Erasure is whitespace-preserving, so the evaluated source keeps the exact line and column numbers
of the file you wrote and `script "chase" tick handler at tick 12: …` still points at the right
line. Nothing is emitted next to your source, and there is no build step to run by hand.

> **Renamed:** the verb set was injected as `api` in earlier builds and is now `molen`. There is
> no alias — a script that references `api` throws at evaluation with the new name in the
> message, so the fix is a find-and-replace of `api.` with `molen.`.

```json
{
  "format": "molen/scene@3",
  "name": "spinner",
  "commands": {
    "move": {
      "doc": "Planar move direction [x, z], each in -1..1.",
      "payload": {
        "type": "object",
        "properties": { "dir": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 } },
        "required": ["dir"],
        "additionalProperties": false
      }
    }
  },
  "input": {
    "bindings": { "KeyW": "up", "KeyS": "down", "KeyA": "left", "KeyD": "right" },
    "emit": [{ "kind": "axis2d", "xNeg": "left", "xPos": "right", "yNeg": "up", "yPos": "down", "command": "move" }]
  },
  "physics": { "engine": "kinematics" },
  "entities": [
    { "id": "hero", "components": {
      "transform": { "pos": [0, 0, 0], "rot": [0, 0, 0, 1] },
      "collider": { "shape": "circle", "radius": 0.5, "layer": 1, "mask": 1 },
      "kinematicBody": { "vel": [0, 0, 0], "slide": true },
      "renderable": { "kind": "primitive", "ref": "box", "materialRef": "palette:#4363d8" }
    } }
  ],
  "scripts": [
    {
      "id": "control",
      "config": { "speed": 6 },
      "code": "molen.onCommand('move', (p) => molen.patch('hero', 'kinematicBody', { vel: [p.dir[0] * config.speed, 0, p.dir[1] * config.speed] }));"
    },
    { "id": "spawner", "path": "scripts/spawner.ts" }
  ]
}
```

`molen sim run scene.json --ticks 60 --hash` runs it; `molen drive` plays it with commands;
`mountExperience` runs the same manifest in the browser, where the `input` block turns WASD into
`move` commands. No setup module, no build step. A script that registers no handler at all gets a
warning (`molen.on` / `molen.onCommand` was never called).

A script may also declare `function setup(molen, config) { … }` instead of top-level code.

## The script verb set (`molen`)

| Verb | Signature | Notes |
|---|---|---|
| `onCommand` | `(type, handler(payload, ctx, command))` | **player/agent input.** The scene declares the type under `commands` (with an optional JSON Schema payload); undeclared types and bad payloads are rejected before any handler runs. Runs in the commands phase, before every system. |
| `on` | `('tick' \| eventType, handler(payload, ctx))` | tick handlers run in the update phase; event handlers run when the event is emitted (`collision`, `tween-complete`, your own `emit`s). Returns an unsubscribe. |
| `spawn` | `(components, id?)` or `(prefabName, components?, id?)` | prefab form needs a manifest (it has one when run via `buildWorld`); component data is validated. Spawns apply at the system boundary (all tick handlers share one system): `molen.exists(id)` is false until then. |
| `spawnType` | `(typeId, components?, id?)` | instantiate a project-registry type with overrides; pass `types` to `buildWorld` in browser hosts (the CLI resolves the project automatically) |
| `state` / `setState` / `patchState` | immutable JSON read / `(data)` / `(partial)` | script-owned persistent state, saved in checkpoints and preserved on hot reload; patches replace top-level fields |
| `destroy` / `exists` | `(id)` | |
| `get` / `set` / `patch` / `remove` / `has` | `(id, component, …)` | component is a **string name**; `set` and the final shallow-merged `patch` value are validated against this world's vocabulary |
| `query` | `(...componentNames)` | iterable result with `.ids()`, `.count()`, `.first()`, `.without(...names)` |
| `emit` | `(type, payload)` | events reach other scripts, `molen.on` handlers, the client (`client.onEvent`), and `drive`/assert |
| `raycast` / `overlapCircle` | spatial queries (kinematics layer) | |
| `after` / `every` | `(ticks, event, payload?)` | snapshot-safe world timers that EMIT (no callbacks); returns timer id. The handler receives `{ entity, timerId, payload }`. |
| `cancelTimer` | `(timerId, entity?)` | |
| `tween` / `cancelTween` | `(entity, { component, path, to, ticks, easing?, loop? })` | data-driven value animation; completion emits `tween-complete` |
| `parent` / `unparent` | `(id, parentId)` / `(id)` | keep-world reparenting; the hierarchy system composes transforms |
| `rng` | `() => number` | the **only** source of randomness — deterministic |
| `tick` / `dt` | current tick / seconds-per-tick | |
| `math` | `molen.math.sin/cos/tan/atan2/pow/exp/log/hypot/sqrt/clamp/...` | deterministic (`dmath`) |
| `physics` | `molen.physics.raycast(origin, dir, maxDist, { mask?, exclude? })` / `overlapSphere(center, radius, { mask?, exclude? })` / `velocityOf(id)` | present when the scene's `physics.engine` is `rapier`; hits carry `normal`; `collision` events carry `normal`/`point` |
| `terrain` | `molen.terrain.heightAt/normalAt/slopeAt/raycast` | present when the scene has a `terrain` block with a heightmap |

### Reads are immutable snapshots

`molen.get` and query rows hand back the engine's stored object, frozen. Never mutate it — write
with `molen.set`/`molen.patch`, which install a new object. Mutating a read throws with a hint
naming the script, the handler, and the tick.

### State that survives save/load and replay

Use `molen.state`, components, or a registered snapshot provider for **all durable state**.
JavaScript closure variables are not serialized. For example:

```js
molen.on('tick', () => {
  const rounds = (molen.state.rounds ?? 0) + 1;
  molen.patchState({ rounds });
  if (rounds % 30 === 0) molen.spawnType('game.enemy');
});
```

Mark each script that follows this rule with `"checkpoint": "state"` in its scene entry
(or `checkpoint: 'state'` in `LoadedScript`). This is an authoring contract, not static analysis
of JavaScript: do not mark a script that keeps counters, cooldowns, or other durable values in
mutable closures. `molen.state` is isolated by script id; reads are immutable, and reload retains
it. Initialization should use existing state (`molen.state.value ?? initialValue`) rather than
unconditionally resetting it. Script ids must stay stable across save/load.

For scripts without this declaration, `ReplayPlayer` reconstructs from the beginning when
seeking. Restoring a nonzero checkpoint into their active script host throws an actionable
error instead of silently resetting closures. Cached seeking is available once every script
has opted in. Setup-module systems have the same durable-state obligation: store state
in components or use `world.registerSnapshotProvider`; the engine cannot serialize host closures.

Randomness during initialization, command/event handling, and ticks uses the same seeded world
RNG. Reload evaluation consumes fresh draws from the current world stream; restoring a
checkpoint restores its saved RNG state after the host has constructed the scripts. Timers and tweens commit their next state before dispatching completion events, so handlers
can cancel repeating work or schedule the next step. Events already due in that system pass
are dispatched once in their original order.

### Script trust: a script runs as the host process

A script has the authority of the process that evaluates it. **Treat a scene manifest like source
code: only run manifests you would run as a program.** That matters most for the `molen` CLI and
the MCP server, which evaluate a manifest's scripts **in-process** on a developer's machine, so a
`scene.json` handed to you by an agent, a sample repo, or a bug report is a program you are about
to execute.

The `Compartment` and its tamed endowments are there to make the simulation **deterministic**, not
to contain hostile code. Concretely, un-hardened:

- **Intrinsics are shared and mutable.** The kernel does not call SES `lockdown()` — it is
  process-global and would freeze the intrinsics of every host that links the kernel — so
  `Object`, `Array` and friends inside a script are the host's own. `Array.prototype.x = 1` in a
  script changes the array prototype the kernel itself runs on.
- **The host global is one expression away.** `(() => {}).constructor('return globalThis')()`
  returns the host realm — in Node, `process` and all.
- **Taking `Math.random` away stops accidents, not attacks.** It removes the most common source
  of accidental non-determinism; it does nothing to a script that is trying to get out, and was
  never meant to.

What the Compartment does buy, reliably: each script gets a fresh global (and a fresh one per hot
reload), `config` and the shared `molen` verb set are frozen so one script cannot rewrite
another's verbs or the manifest, and `Date` / `Intl` / `Promise` / `Math.random` cannot be reached
by accident — the determinism rules below are enforced rather than merely documented.

#### Hardening a kernel-only host (`hardenScripts()`)

A host whose whole job is running the kernel *can* have the boundary. `hardenScripts()` from
`@bendyline/molen-kernel` runs SES `lockdown()` once for the process: intrinsics are frozen and
`Function.prototype.constructor` stops building functions in the host realm, so the escape above
throws instead of returning `globalThis`.

```ts
import { buildWorld, hardenScripts } from '@bendyline/molen-kernel';

hardenScripts();                       // once, at startup, BEFORE buildWorld
const world = buildWorld(manifest);    // scripts installed here cannot reach the host realm
```

- **Process-global and irreversible.** Call it at host startup, before building a world, and only
  in a process dedicated to the kernel — a Worker, or a Node host that does nothing else. Do
  **not** call it in a host that also runs bundlers, image/asset tooling, or a browser-automation
  stack: frozen intrinsics break libraries that patch prototypes at runtime. That is why the CLI
  and the MCP server do not call it for you.
- **Idempotent.** It returns `true` if this call performed the lockdown and `false` if the realm
  was already hardened (by an earlier call or by the host's own `lockdown()`); `scriptsHardened()`
  reports the current state.
- **Determinism is unaffected** — it never depended on lockdown. The kernel ticks, hashes and
  replays identically before and after; Rapier's WASM initializes under lockdown too.
- `hardenScripts({ errorTaming: 'unsafe' })` keeps `error.stack` readable while you debug;
  `overrideTaming` and `stackFiltering` are the other passthroughs. Defaults are SES's, except
  `overrideTaming: 'severe'` (the most forgiving setting for ordinary JS).

`molen new` puts the call in the generated Worker as a commented-out one-liner: a starter you
author yourself does not need it, and uncommenting it is the whole change if that Worker will run
scenes you did not write.

### Determinism rules (what every script must follow)

These are the rules an author follows to keep a run reproducible. They are determinism tooling —
see [Script trust](#script-trust-a-script-runs-as-the-host-process) for why that is not the same
as containment.

- No `Math.random` — the injected `Math` has no `random`; use `molen.rng()`.
- No `Date` or `Intl` — both are shadowed to `undefined`, so a reach for them fails at the use
  site. Use `molen.tick` for time.
- No `Promise`: it is shadowed too, because a `.then()` callback would run after the tick's hash
  was taken. Use `molen.after` / `molen.every` for "later".
- Math goes through `molen.math` (routed through `dmath`, the cross-platform swap point).
- Locale formatting (`toLocaleString`, `localeCompare`) lives on `Number`/`String` prototypes,
  which the Compartment cannot take away — keep it out of component state and event payloads, and
  format for display in the client instead.
- These keep replay hashes identical run-to-run; `molen replay <fixture>` will pinpoint the first
  divergent tick (with a component diff) if you break them.

A script that sticks to IEEE-exact arithmetic reproduces on any JS engine; one that calls
`molen.math.sin` and friends reproduces on the same JS engine, because `dmath` is today a thin
re-export of native `Math` for transcendentals. [determinism.md](determinism.md) has the level for
every subsystem, what a host can break from outside, and what `STATE_FORMAT` means for save files.

### Typed scripts: checked before the first tick

Scripts are TypeScript, and they are **checked** — not just at the edges. `molen types gen`
writes two generated files next to every directory of file-backed scripts:

| File | What it is |
|---|---|
| `molen-scripts.d.ts` | ambient declarations for `molen` and `config`, generated from the same facts the engine validates against |
| `tsconfig.json` | the project that checks `*.ts` (and any `*.js`) in that directory — editors pick it up automatically |

The declarations are derived, not hand-written: component names and their data shapes come from
the component registry (scene-declared custom components included), the entity id and prefab
unions from the scene, `spawnType` ids from the project type registry, and each command's payload
from the JSON Schema the scene declares under `commands`. `config` is typed from the `config`
blocks of the scripts in that directory, each key tagged with the script that declares it.

```sh
molen types gen        # regenerate after editing the scene, its commands, or the type registry
molen scripts check    # type-check every script in the project
```

So these are errors at author time rather than throws at tick 40:

```js
molen.get('player', 'transfrom');        // TS2345: not assignable to keyof MolenComponentData
molen.patch('hero', 'transform', { pos: [1, 2] });  // TS2322: needs 3 elements
molen.onCommand('move', (p) => p.dir[2]);           // TS2493: tuple has length 2
molen.spawnType('arena.enemey');                    // TS2345: not a registered type id
```

Two things the types insist on, both real:

- **`get` returns `T | undefined`.** An entity can be destroyed and a component removed, so guard
  (`const g = molen.get('game', 'state'); if (!g) return;`) — the examples do.
- **Reads are `Readonly`.** Mutating one throws at runtime; now it also fails to compile.

Annotate where inference needs help — a fixed-length vector is the common case:

```ts
const pos: [number, number, number] = onX ? [a, 0, b] : [b, 0, a];
```

Because erasure is not compilation, a script may only use **erasable** syntax: no `enum`, no
`namespace`, no constructor parameter properties, and `import type` for any type-only import.
The generated tsconfig sets `erasableSyntaxOnly`, so `molen scripts check` reports that as an
error instead of letting the scene fail to load. A script still may not `import` anything at
runtime — the Compartment has no module loader, so its whole world is `molen` and `config`. That
is an authoring constraint, not containment (see
[Script trust](#script-trust-a-script-runs-as-the-host-process)).

`molen scripts check` refuses to run against stale declarations: if the scene changed and the
generated files no longer match, it says so and names `molen types gen` rather than reporting
errors against types the scene no longer describes. Scripts authored inline as `code` have no
file to check — another reason to prefer `path` refs.

### What the script API cannot express

Shape of the verb set, not a containment claim (for that, see
[Script trust](#script-trust-a-script-runs-as-the-host-process)):

- Run in a phase other than `update` (all tick handlers run in one system; command handlers run
  in the commands phase). Post-physics logic belongs in a setup-module system.
- Register a new command *type* — scenes declare types under `commands`; scripts attach handlers.
- `import` anything, or reach `Date` / `Intl` / `Promise` / `Math.random` by accident (the
  determinism rules above).

Errors carry the script id: `script "chase" tick handler at tick 12: …`, or
`script "spawner" failed to evaluate: …` for syntax errors.

## 2. Setup module (`setup.mjs`) — systems and typed authoring

Use a code module for ECS **systems** in any phase and for typed TypeScript authoring. Pass it
with `--setup ./setup.mjs`, or set `"setup": "setup.mjs"` in project.json and every scene op
picks it up. Within a phase, systems run by `priority` (lower first, default 0), then in
registration order; the character controller, for example, prepares at -100 and reconciles with
the ground at 100.

```js
export function setup(world, manifest) {
  world.addSystem((w, ctx) => { /* runs after physics */ }, { phase: 'late', name: 'cleanup' });
  world.registerCommand('spawn_cube', (w) => {
    w.spawnRaw({
      transform: { pos: [0, 2, 0], rot: [0, 0, 0, 1] },
      renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#e6194b' },
    });
  });
}
export default setup;
```

A setup module loaded from an arbitrary folder can't import the kernel (no `node_modules`
there), so it uses `world.spawnRaw(componentMap)`, `world.registerCommand`, `world.addSystem`,
and string-named component handles (`w.patch(id, { name: 'kinematicBody' }, …)`). Inside a
project that installs `@bendyline/molen-kernel` (anything `molen new` scaffolds) you can import
handles from it and use the typed
`world` API or `defineExperience({...})` (see [project.md](project.md)).

A command type may carry many handlers: a scene-declared `move` can be handled by a script and by
a setup module; handlers run in registration order (setup first, then scripts in manifest order).

## Build order (one path for every host)

`buildWorld(manifest, setup?, opts?)` is how tooling ops, example workers, and tests all build a
world: data-declared systems (gameplay; kinematics + character controller when `physics` asks
for them) → declared `commands` → entities → physics plugin hook (rapier) → terrain hook →
`setup` → the manifest's scripts. Scripts install last so they see every command and every
capability extension.

## Try it

`molen new my-experience` scaffolds a scene with a control script, an input block, and a
`setup.mjs`, plus `cmds.json` / `checks.json`, wired for the full loop in
[agent-loop.md](agent-loop.md).
