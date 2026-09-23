# 01 — Architecture

## 1. System overview

The engine is a **headless deterministic simulation kernel** plus a **rendering client**,
connected only by message passing, with a **data-only schema package** both depend on and an
**agent tooling package** on top. Everything that can be a capability layer is one.

```
                ┌─────────────────────────────────────────────────────┐
                │                  @bendyline/molen-tooling                    │
                │   CLI (`molen …`) + MCP server, shared ops core    │
                │   validate · sim run · shot · material bake · …     │
                └───────┬───────────────┬───────────────┬─────────────┘
                        │               │               │
        ┌───────────────▼──┐   ┌────────▼─────────┐  ┌──▼────────────────┐
        │  @bendyline/molen-kernel  │   │  @bendyline/molen-client  │  │ @bendyline/molen-materials │
        │  headless sim    │   │  three.js render │  │ rungs 2–4, no     │
        │  no DOM, no three│   │  interpolation   │  │ three.js (RGBA    │
        │  Worker + Node   │   │  cameras, input  │  │ image output)     │
        └───────┬──────────┘   └────────┬─────────┘  └──┬────────────────┘
                │                       │               │
                │     ┌─────────────────▼───────┐       │
                ├─────►      @bendyline/molen-terrain    ◄───────┤
                │     │  ./kernel   ./client    │       │
                │     └─────────────┬───────────┘       │
                │                   │                   │
        ┌───────▼───────────────────▼───────────────────▼───────┐
        │                    @bendyline/molen-schema                     │
        │   components · commands · snapshots · manifests ·     │
        │   asset formats · validator + error formatter         │
        │              (depends on nothing)                     │
        └───────────────────────────────────────────────────────┘

   Later, opt-in:  @bendyline/molen-physics-rapier (kernel plugin, WASM)
   Per release:    @bendyline/molen-docs (llms.txt bundle, version-locked)
```

Dependency rules (CI-enforced):

- `@bendyline/molen-schema` depends on **nothing**.
- `@bendyline/molen-kernel` depends only on schema. No DOM, no three.js, no WASM. Runs identically in a
  Web Worker and in Node.
- `@bendyline/molen-client` depends on schema (+ three.js). Never imports kernel internals — it only
  speaks the message protocol.
- `@bendyline/molen-materials` is renderer-agnostic (no three.js); it emits raw RGBA images that the
  client wraps in textures and tooling writes to PNG, so pixels are byte-identical everywhere.
- Capability packages (`@bendyline/molen-terrain`, later `@bendyline/molen-physics-rapier`) plug into kernel
  and/or client via published extension interfaces, with kernel/client halves as subpath
  exports of one package.
- `@bendyline/molen-tooling` sits at the top; nothing imports it.

## 2. Responsibilities

| Concern | Kernel | Client | Schema |
|---|---|---|---|
| Entities/components/systems (ECS) | owns | mirrors (read-only) | defines component schemas |
| Game logic & scripting sandbox | owns | — | script manifest schema |
| Tick scheduling & determinism | owns | estimates kernel clock | — |
| Input | adjudicates commands | captures, emits commands | command schemas |
| Collision/physics | owns (kinematics, Rapier) | — | collider schemas |
| Terrain heightfield & queries | owns (via @bendyline/molen-terrain/kernel) | renders meshes (via /client) | descriptor schema |
| Rendering, cameras, materials | — | owns | renderable/camera/material schemas |
| Snapshots, deltas, replay | produces | consumes (interpolation) | wire format schemas |
| Validation & error messages | uses | uses | owns |

The kernel **never** knows what a `renderable` component means; the client **never** mutates
simulation state. Single-player is one trusted peer with zero latency — the same command/
snapshot contract a future transport layer would carry over a network.

## 3. Message flow

All kernel↔client traffic is structured-clone `postMessage` of plain JSON-shaped objects.
No SharedArrayBuffer in early phases (no COOP/COEP hosting requirements). The full envelope
schemas live in [03-data-formats.md](03-data-formats.md).

```
  CLIENT (main thread)                          KERNEL (Web Worker / Node)
  ────────────────────                          ──────────────────────────
  input events ──► InputMap ──► command ───────►  validate (schema)
                                                  ├─ invalid → command-rejected event ─┐
                                                  └─ valid → queue at tick T           │
                                                                                       │
                                                  tick T: phases                       │
                                                  commands → update → physics → late   │
                                                                                       │
  interpolation buffer ◄── delta {tick T} ◄────── dirty-tracked per-tick delta         │
  (render ~1.5 ticks                                                                   │
   behind, lerp/slerp)  ◄── keyframe ◄─────────── every 60 ticks + on demand           │
                                                                                       │
  error surfaced to user/agent ◄───────────────────────────────────────────────────────┘
```

Message kinds, kernel-bound: `command`, `control` (pause/step/reload-script/request-keyframe),
`terrain.residency` (advisory chunk residency). Client-bound: `delta`, `keyframe`, `event`
(includes `command-rejected`), `diag` (tick-overrun etc.).

The same kernel, imported directly in Node (no Worker), drives the headless agent loop:
validate → `stepN(n)` → assert on state → screenshot → iterate
(see [07-tooling-and-testing.md §4](07-tooling-and-testing.md)).

## 4. Tick & interpolation timing

Kernel runs a fixed timestep (default **30 Hz**, per-world, immutable per world — see
[04-kernel-design.md §2](04-kernel-design.md)). The client renders at display rate and
interpolates entity transforms from a small buffer of recent kernel snapshots, rendering
~1.5 ticks (50 ms at 30 Hz) behind the simulation. It never extrapolates in v1.

```
 kernel ticks (30 Hz):     T28        T29        T30        T31
 ─────────────────────●──────────●──────────●──────────●──────────► sim time
 deltas sent:         └─Δ28──────└─Δ29──────└─Δ30──────└─Δ31

 client frames (e.g. 120 Hz):  f f f f f f f f f f f f f f f f
 estimated kernel clock:                        ▲ estTick ≈ 30.4
 render position:                   ▲ renderTick = estTick − 1.5 ≈ 28.9
                                    └─ interpolate between snapshot T28 and T29 at t=0.9
```

Properties this buys:

- Smooth motion at any display rate regardless of tick rate.
- Tolerance to `postMessage` jitter (the 1.5-tick delay absorbs one late delta).
- The interpolation buffer is the same `applyDelta` machinery used by replay scrubbing and
  save/load — one serialization system serving four masters (save/load, replay, machinima,
  client rendering).

## 5. Multiplayer affordances (designed, not implemented)

Built in from day one per the brief, with the transport layer absent:

- **Command-stream input** with `{seq, source, tick, type, payload}` envelopes — `source` is
  the future peer identity; adjudication order `(tick, source, seq)` is already
  arrival-order-independent.
- **Snapshot + delta serialization** as kernel features.
- **Deterministic ticks + seeded RNG** (single-platform replay strictness; the choices that
  would foreclose cross-platform lockstep are flagged and contained — see
  [04-kernel-design.md §5](04-kernel-design.md)).
- **Authority model (design stance):** the kernel is the single authority; clients are
  untrusted command emitters plus snapshot consumers. A future networking layer is a
  transport + reconciliation layer that (a) carries the same command envelopes upstream,
  (b) carries the same delta stream downstream, (c) adds client-side prediction by running a
  second, predictive kernel instance ahead of the authoritative stream and reconciling on
  receipt. Nothing in the engine changes; the late-command policy flips from `rewrite` to
  `reject` for lockstep modes ([04 §3.3](04-kernel-design.md)).

## 6. Where the open questions got resolved

| Brief §4 question | Resolution | Doc |
|---|---|---|
| 1. Package naming/boundaries | `@bendyline/molen-*` (final scope, Q12); terrain is a capability package; tooling = CLI+MCP in one package | [02](02-packages-and-apis.md) |
| 2. ECS query API | typed component handles over wire-string names; variadic `query()`; version-stamped lazy cache | [04 §1](04-kernel-design.md) |
| 3. Snapshot wire format | JSON-shaped plain objects; binary deferred behind same interfaces; integer format version | [04 §4](04-kernel-design.md) |
| 4. Scripting sandbox | SES Compartments (QuickJS fallback); sync in-tick execution | [04 §8](04-kernel-design.md) |
| 5. Terrain LOD/streaming | quadtree chunked LOD with skirts; client-driven residency; kernel owns sampling only | [05 §5](05-client-design.md) |
| 6. Material graph nodes | 14-node closed vocabulary, CPU-rasterized to textures in v1 | [06 §4](06-materials-and-assets.md) |
| 7. UV template/sidecar | template PNG + `molen/uvpaint@1` sidecar; 1024² / 128 px-per-m defaults | [06 §6](06-materials-and-assets.md) |
| 8. Tick rate | 30 Hz default, per-world configurable, immutable per world | [04 §2](04-kernel-design.md) |
| 9. Rapier WASM lifecycle | `rapier3d-compat` (inlined WASM), async plugin init before first tick | [04 §7](04-kernel-design.md) |
| 10. Headless screenshots | snapshot-render via pinned Playwright Chromium + SwiftShader | [05 §6](05-client-design.md) |
| 11. Repo structure | pnpm workspaces (no task runner), ESM-only, fixed version group, examples as private packages | [07 §1](07-tooling-and-testing.md) |
| 12. Testing strategy | unit + replay-hash + golden-image + schema round-trip; agents run CI's exact commands | [07 §5](07-tooling-and-testing.md) |
