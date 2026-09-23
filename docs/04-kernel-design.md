# 04 — Kernel Design

Resolves brief §4 questions 2 (ECS query API), 3 (snapshot wire format), 4 (scripting
sandbox), 8 (tick rate), 9 (Rapier lifecycle). Public API signatures in
[02-packages-and-apis.md §3](02-packages-and-apis.md); wire shapes in
[03-data-formats.md](03-data-formats.md).

## 1. Custom minimal ECS (~350 LOC target)

### 1.1 Entity IDs: never-reused strings from a snapshotted counter

- Runtime spawns get `"e" + nextEntitySeq++`; the counter is **world snapshot state**, so IDs
  never collide across save/load, and deterministic simulation makes them replay-safe.
- Manifest/prefab entities may carry authored IDs (`"player"`, `"gate-west"`) — stable across
  manifest edits, so agents assert `get("player", Transform)` without spawn-order archaeology.
  Authored IDs must not match `/^e\d+$/` (validator-enforced).
- **No generation counters.** Generations detect stale references when IDs are reused; we
  never reuse, so a dangling reference resolves to `undefined` from `get()` — a whole class
  of complexity deleted. (Tradeoff escalated as [09](09-questions-and-risks.md) Q7: dangling
  refs can mask bugs; tooling offers a strict mode that logs dangling lookups.)
- Strings, not numbers: authored IDs need them, they read well in snapshots/diffs/errors, and
  the perf cost of string Map keys is irrelevant at our entity counts (thousands, not
  millions — locked by the "legibility over SoA" decision).

### 1.2 Storage: component-major in memory, entity-major in snapshots

```ts
// inside World (private)
stores: Map<string /*componentName*/, Map<EntityId, unknown>>;
```

- Component-major wins for queries: iterate the smallest store, probe the others —
  O(smallest), no per-entity scans.
- JS `Map` preserves insertion order → deterministic iteration for free (§5.2).
- Snapshots serialize entity-major (`{"player": {"transform": …}}`) because that's what
  agents read; the layout transform is ~15 lines.
- Typed handles via `defineComponent(name)` are metadata-only wrappers over wire-string names
  — strings on the wire, types in code, no class instances anywhere. Unknown component names
  in a snapshot/prefab still load (stored raw); only systems referencing them need handles.
  Snapshots stay forward-loadable; agents can invent components freely.

### 1.3 Query API: variadic typed handles, version-stamped lazy cache

```ts
for (const [id, t, v] of world.query(Transform, Velocity)) {
  world.patch(id, Transform, { pos: addScaled(t.pos, v.vel, ctx.dt) });
}
```

- Overloads to 4 typed components (codegen'd); rest-arg untyped fallback beyond.
- `QueryResult` is an `Iterable<[EntityId, ...components]>` plus `ids()`, `count()`, `first()`.
- **Caching:** each store carries a `structureVersion` bumped on component add/remove (not
  value writes). A query caches its matching-ID list keyed by the sorted name tuple + the
  version vector; any version change → lazy rebuild. No subscriptions, no invalidation bugs;
  ~30 lines.
- **Iteration order = entity creation order** (store insertion order; snapshot load
  reconstructs stores in serialized order, so order survives save/load and replay).
- **Mutation during iteration:** structural ops (`spawn`/`destroy`/`remove`) inside systems
  are deferred to a per-tick op buffer applied **between systems**; value writes
  (`set`/`patch`) apply immediately. "Iterate and destroy" is safe by construction — the
  single most common ECS footgun removed for agent-written logic.

### 1.4 Systems: four fixed phases, registration order within a phase

`commands → update → physics → late` — command adjudication, game logic, movement/physics
resolution, reactions/cleanup/event flush. Capability packages slot relative to user logic
without anyone hand-ordering a global list; within a phase, order = registration order
(= manifest order for scripts) — explicit, deterministic, debuggable.
No priorities, no dependency graphs. `world.describeSystems()` returns the flat ordered list
with names for agent inspection.

## 2. Tick model

**30 Hz default, per-world `tickRate` (manifest field, immutable for the world's lifetime),
clock-free synchronous `step()`, one `Scheduler` for Worker and Node.**

- 30 Hz: Phases 1–2 (flyover, top-down) have no sub-33 ms input-feel needs; interpolation
  hides the rate; halves script budget pressure, delta traffic, and replay size vs 60; it's
  the conventional authoritative-server rate, so future netcode inherits a sane number. An
  FPS-style world later sets 60. Mid-run rate changes are forbidden (they'd invalidate
  replays and the interpolation contract); the rate is recorded in every keyframe.
- **The world has no clock.** `world.step()` advances exactly one tick synchronously with
  `dt = 1/tickRate`; no `Date.now`/`performance.now` anywhere inside. All real time lives in
  `Scheduler`: a `setTimeout`-chained accumulator loop (not `setInterval` — avoids pileup),
  running `step()` while `acc >= dt`, capped at `maxCatchUpTicks = 5`; beyond the cap the
  debt is dropped and a `tick-overrun` diag event emitted. `setTimeout` exists identically in
  Workers and Node — one scheduler, no conditional code.
- **Pause/step:** `pause()` stops the timer; `step(n)` runs n ticks synchronously while
  paused; commands queued while paused execute on their adjudicated ticks when stepping.
- **Headless tests skip the Scheduler entirely** and call `world.stepN(n)` — this is the
  brief's "run N ticks headlessly in Node" requirement, trivially deterministic because
  `step()` is clock-free.

## 3. Command stream

### 3.1 Envelope

`{kind, seq, source, tick, type, payload}` ([03 §2](03-data-formats.md)). The brief locks
`{tick, type, payload}`; `seq` (per-source monotonic) adds dedupe and a deterministic total
order; `source` is the authority hook future netcode needs and costs nothing now. No
correlation-id field — `(source, seq)` is the correlation key, carried by
`command-rejected` events.

### 3.2 Validate → queue → adjudicate

1. **Schema validation on receipt** against the command type's registered schema. Failure →
   immediate `command-rejected` event with the full formatted error. Invalid commands never
   enter the queue ⇒ replay logs contain only valid commands.
2. **Queue** into `Map<tick, Command[]>` keyed by adjudicated execution tick.
3. **Execute** at the start of the target tick (the `commands` phase), sorted by
   `(source, seq)` — deterministic regardless of arrival order. One registered handler per
   type (`world.registerCommand(type, handler, {schema})`); handlers are the *semantic*
   adjudication layer (does the unit exist, is the move legal) and may freely mutate state.

### 3.3 Late commands: rewrite-to-next, record executed tick

Commands with `tick <= currentTick` are re-stamped to `currentTick + 1`; `tickExecuted` is
recorded, and **replay logs store commands with their executed ticks** — replays are exact
regardless of sloppy live timing. Per-world `lateCommands: "rewrite" | "reject"`; `"reject"`
is what a future lockstep mode sets.

## 4. Snapshot + delta serialization

### 4.1 Wire format: JSON-shaped plain objects; no binary in early phases

Kernel→client transport is structured clone of plain objects that are by construction
`JSON.stringify`-able (that's what "components are pure JSON" buys). Save files and replay
logs are the same objects as JSON text. There is no separate debug mode because **the
production format is the debug format** — maximal AI-legibility, zero encode/decode code.
Structured clone of a few-hundred-entity delta at 30 Hz is well under budget for Phases 1–2.
Binary packing goes behind the same `Keyframe`/`Delta` interfaces later **only if profiling
demands it** (expected before the RTS phase — [09](09-questions-and-risks.md) R10); nothing
forecloses it.

### 4.2 Shapes, versioning

Keyframe and delta shapes in [03 §3–4](03-data-formats.md). Keyframes capture entities, RNG
state, `nextEntitySeq`, `tickRate`, and opaque plugin blobs. Integer `v` per format; mismatch
is a hard, descriptive error. Unknown component names load fine (raw data), which absorbs
most *content* evolution without format bumps.

### 4.3 Delta encoding: per-component dirty tracking, whole-component granularity

- All writes go through `set`/`patch`/`remove`/`spawn`/`destroy`, so the kernel marks
  `(entity, component)` dirty at write time — exact and O(writes), vs structural diffing's
  O(world) per tick.
- **Whole-component replacement** in deltas, not per-field diffs: simple to produce, trivial
  to apply, legible in logs. Convention (documented loudly): keep hot components small; bulk
  data (terrain chunks, big inventories) belongs in rarely-mutated components or plugin
  stores. If a real case breaks this, per-field patch deltas are an additive `v` bump.
- To protect dirty tracking, `get()` returns `Readonly<T>`; **dev mode hands out
  `Object.freeze`-d copies** so in-place mutation throws instead of silently corrupting
  deltas. Production skips the freeze. ([09](09-questions-and-risks.md) Q6/R-list.)

### 4.4 One machinery, four masters

- **Cadence:** delta every tick; keyframe every 60 ticks (2 s @ 30 Hz, per-world
  `keyframeInterval`) and on demand.
- **Save/load:** a save file is a keyframe; load = `fromKeyframe()` (restores entities, RNG,
  counter, plugin blobs).
- **Replay:** artifact = `{initial keyframe, commands[]}` — determinism regenerates the rest.
  **Scrubbing** restores the nearest keyframe ≤ target and `stepN`s forward replaying logged
  commands. (Storing the delta stream is an optional optimization for scrub-heavy machinima,
  not the source of truth.)
- **Client interpolation:** the client applies the delta stream to a passive mirror store and
  interpolates between recent ticks — the same shared `applyDelta` the scrubber uses.

## 5. Determinism

### 5.1 RNG: sfc32

~6 lines of pure 32-bit integer ops (`|0`, `>>>`), no BigInt, passes PractRand, and its state
is **four uint32s — trivially snapshot-able** (the `rng` field in every keyframe). PCG32
needs 64-bit state (BigInt or emulated pairs — needless in JS); xoshiro128** is equivalent
but no simpler. Seeding: world seed → splitmix32 → four state words. **One stream per
world**, exposed only as `ctx.rng` / `molen.rng()` inside the tick. Named substreams
(`world.rng("loot")`) are a documented later extension. `Math.random` is forbidden in kernel
code (lint) and unavailable to scripts (tamed by the sandbox).

### 5.2 Iteration-order rules (normative)

1. Kernel collections are `Map`/`Set` (insertion-ordered) or arrays.
2. Query iteration order = entity creation order (survives save/load via serialized-order
   store reconstruction).
3. Command execution order = `(tick, source, seq)`.
4. Event delivery = emission order; handlers in registration order.
5. Systems = phase order, then registration order.

### 5.3 Floats: what to defer

Within one JS engine, IEEE-754 `+ - * /` and `Math.sqrt` are exactly specified — single-
platform replay needs nothing special. The hazards are transcendentals (`sin/cos/exp/pow`
are implementation-approximated, differ across engines/versions). Cheap insurance: kernel
and scripts use a **`dmath` module** (initially literally re-exporting `Math.*`) so swapping
in polynomial approximations later is a one-file change, not a codebase audit; a lint rule
bans direct transcendental `Math.*` in kernel/capability sim code (sqrt allowed). Actual
software-math implementations are deferred indefinitely.

### 5.4 "Deterministic enough for single-platform replay" — the checklist

1. Every external influence enters via the command stream (input, agent actions, debug
   teleports included).
2. Randomness only via the seeded, snapshotted RNG.
3. Iteration orders per §5.2.
4. No clock/locale/`Math.random` inside `step()` — structural (clock-free step) and enforced
   (sandbox) for user code.
5. Keyframes capture RNG state, `nextEntitySeq`, plugin blobs.
6. Scripts execute synchronously inside the tick (§8) — no async interleaving.

### 5.5 What would foreclose cross-platform lockstep (flagged, all contained)

- **Stock Rapier npm builds** (no `enhanced-determinism` cargo feature): cross-platform float
  behavior unverified. Not foreclosed — Rapier is opt-in and snapshot-isolated (§7); a
  lockstep-grade world simply doesn't use the plugin (or uses a custom deterministic build).
- **Transcendental `Math.*` in game logic** — mitigated by the `dmath` indirection.
- Everything else (string IDs, JSON snapshots, Map iteration, sfc32) is platform-independent
  already. Cross-platform lockstep would additionally mean pinning JS-engine behavior — a
  transport-era problem, not an engine-rework problem.

## 6. Kinematic collision layer — `@bendyline/molen-kernel/kinematics`

Opt-in subpath plugin (`world.use(kinematics(opts))`): zero deps, the brief calls it
built-in, Phase 2 needs it; a flyover world that doesn't register it pays nothing.

Deliberately **2.5D**: circles/AABBs in the XZ plane, Y via ground-height queries — covers
top-down, RTS, and basic character control. Full 3D swept volumes are Rapier's job.

- **Components:** `collider` `{shape: "circle"|"aabb", radius?|halfExtents?, layer, mask,
  isStatic?}`; `kinematicBody` `{vel: Vec3, slide: boolean}`.
- **Systems** (all `physics` phase): grid build → integrate-and-sweep (move by `vel*dt` with
  swept tests vs statics and dynamics; slide response when `slide`) → emit `collision`
  events `{a, b, normal, depth}`.
- **Queries** (added to `ScriptAPI` when active): `raycast(origin, dir, maxDist, mask)`,
  `overlapCircle(center, r, mask)`, `gridCheck(x, z)` — the latter delegates to a registered
  ground provider (the terrain kernel half registers one; a tilemap component can too).
- **Broad-phase: uniform grid / spatial hash, fully rebuilt each tick.** At hundreds-to-low-
  thousands of colliders a rebuild is microseconds, ~40 legible lines, and **no incremental
  state to corrupt or snapshot** — the grid is derived data, so snapshot/replay correctness
  is automatic. Cell size configurable (default ≈ 2× median collider radius). Quadtrees/BVH
  buy nothing at this scale and cost legibility.

## 7. Rapier integration — `@bendyline/molen-physics-rapier` (Phase 4, opt-in)

- **Loading, dual-target:** `@dimforge/rapier3d-compat` — WASM inlined as base64, initialized
  via `await RAPIER.init()`, identical code path in a Web Worker and Node; no bundler WASM
  gymnastics, no fetch, no conditional init. The plugin's `init(world)` is async; the kernel
  awaits all plugin inits **before the first tick**, so ticks stay fully synchronous. (The
  streaming-WASM non-compat package is a later load-time optimization; nothing architectural
  changes.)
- **Per-tick mirroring:** an ECS `rigidbody` component (`{body: "dynamic"|"fixed"|
  "kinematicPosition", shape, mass, …}`) is the authoring source. The plugin watches
  spawn/destroy via the query-version mechanism to create/free Rapier bodies **in entity-
  creation order** (insertion order matters for Rapier determinism — §5.2 already guarantees
  it), applies intent fields (`impulse`/`force`, consumed and cleared each tick, fed by
  normal commands), calls `rapierWorld.step()` in the `physics` phase, then writes
  translation/rotation/linvel/angvel back through normal `world.patch(id, Transform, …)` —
  so dirty tracking, deltas, and client interpolation see physics motion with zero special
  cases.
- **Determinism — believed vs to-be-verified:**
  - *Believed (Rapier docs):* bit-identical results on the same build + platform given
    identical operation order — sufficient for our single-platform replay target.
    Cross-platform bit-determinism requires the `enhanced-determinism` cargo feature
    (disables SIMD; not enabled in stock npm builds).
  - *Verify empirically* (a Phase-0-adjacent 20-line test on the replay harness, run when
    the plugin lands): (a) stock `rapier3d-compat` run-to-run determinism in our usage
    including insertion order; (b) `takeSnapshot`/`restoreSnapshot` resume bit-exactness vs
    continuous run; (c) cross-browser behavior (informational).
- **Snapshots: hybrid.** Mirrored transform/velocity live in legible ECS components (enough
  for the client and most assertions). Keyframes additionally embed
  `rapierWorld.takeSnapshot()` as base64 under `plugins.rapier` for **bit-exact resume** —
  reconstructing from components alone loses sleeping flags, contact manifolds, and solver
  warm-start state, which would fork replays. The blob records the Rapier version; on
  mismatch the plugin falls back to reconstruct-from-components with a loud warning
  ("approximate resume; earlier replays not bit-exact"). This is the one deliberate breach
  of all-JSON snapshot purity — contained, labeled, opt-in with the plugin
  ([09](09-questions-and-risks.md) Q5). Doc stance: **"Rapier worlds are replay-safe on one
  platform only."**

## 8. Scripting sandbox

### 8.1 Mechanism: SES Compartments for early phases

| | Nested Worker | **SES / Compartments** | QuickJS-WASM |
|---|---|---|---|
| Sync execution inside a tick | **No** — postMessage is async; sync needs Atomics.wait + SAB (off the table early) | **Yes** — same realm, plain function calls | Yes |
| Determinism | OK | **Yes** — `lockdown()` tames `Date`/`Math.random`; we inject `dmath`/`rng` | Strongest |
| API marshalling | structured clone per call — bad for get/set-chatty logic | **~zero** — hardened objects passed directly | every call crosses JS↔WASM with handle lifetimes |
| Hot reload | terminate + respawn | **fresh Compartment, re-evaluate source** | recreate VM (slower) |
| Runaway-loop protection | worker terminate | none in-realm — but the kernel already lives in a Worker; a watchdog can kill/restart it | interrupt handler (best) |
| Complexity / debuggability | medium / poor (async seams) | **~100 LOC / good — user code visible in devtools** | high / poor |

The nested Worker is disqualified by the synchronous-execution requirement alone. QuickJS is
the right answer for *hostile* code, but its marshalling layer is a real subsystem and it
degrades the agent debugging loop. SES gives sync, deterministic, near-free calls now;
because scripts only ever see the `ScriptAPI` object
([02 §8](02-packages-and-apis.md)), **swapping the host to QuickJS later is contained** —
the API surface is the contract, not the mechanism.

**Phase 0 verification spike (required):** `lockdown()` freezes intrinsics realm-wide,
including for kernel code and any emscripten/WASM glue (Rapier) in the same worker. Order of
operations: call `lockdown()` after all plugin `init()`s complete. Fallback ladder if
conflicts persist: Compartments without full lockdown (weaker, still deterministic via what
we inject) → QuickJS-WASM. ([08](08-phase-plan.md) task 0.17; [09](09-questions-and-risks.md)
Q4/R8.)

### 8.2 Declaration, loading, hot reload

Manifest: `"scripts": [{id, src, config}]`. Each module exports
`export default function setup(molen: ScriptAPI, config: JsonObject): void` and registers
handlers via `molen.on(...)`. The **host** does all I/O (fetch in browser, `fs` in Node —
scripts never touch I/O); source is evaluated in a Compartment; `setup` runs in **manifest
order** (deterministic registration, §5.2). Hot reload: a `reload-script` control message
drops the old compartment's handlers, re-evaluates new source in a fresh Compartment, and
re-runs `setup` against the live world. **World state survives; script-local closure state
does not** — the correct, predictable semantic, documented loudly: durable state belongs in
components (itself an AI-legibility win).

## 9. Kernel boundary summary

Core `@bendyline/molen-kernel`: ECS, `step()`/Scheduler, command queue, event bus, snapshot/delta
engine, sfc32 + dmath, prefab instantiation, plugin interface, `transform` + `lifetime`
components only. Opt-in subpaths: `./kinematics`, `./scripting`, `./testing`. Everything
else — terrain, Rapier, materials, rendering — is a capability or client concern
([02 §1](02-packages-and-apis.md)).
