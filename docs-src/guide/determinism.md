# Determinism: what is guaranteed

Determinism is Molen's headline guarantee. This page is the contract: what reproduces, how
exactly, what breaks it, and what happens to your save files when you upgrade.

## The short version

**Same scene, same seed, same command log, same build → the same state hash, tick for tick.**

The unit of proof is `stateHash(world)`: a SHA-256 over a canonical serialization of the world's
continuation state — tick, tick rate, seeded RNG state, entity creation order, every component's
data, the queued-command state, and every registered snapshot provider's blob (`stateHash` in
`packages/kernel/src/snapshot.ts`). Numbers are hashed as their raw IEEE-754 bits, object keys are
sorted, and the SHA-256 is pure JS with no `node:crypto` — so the kernel hashes identically in
Node and in a Web Worker.

Two granularities are available:

| Granularity | How you get it | What it tells you |
|---|---|---|
| Final state hash | `molen sim run … --hash`, `runHeadless().finalHash` | the whole run agrees, or it does not |
| Per-tick hashes | `perTickHashes()`, stored in a `*.replay.json` under `expected.tickHashes` | the **first tick** that disagrees |

Everything the hash covers is simulation state. Rendering is downstream of it and is never hashed.

## The levels

Determinism is not one guarantee, it is four. Every row below is the level at which that
subsystem's contribution to the state hash reproduces.

| Level | Means |
|---|---|
| **Cross-platform** | any OS, any JS engine, any build at the same `STATE_FORMAT`. Only IEEE-754 `+ - * /` and `Math.sqrt` reach hashed state, and those are exactly specified. |
| **Same JS engine** | reproduces wherever the same JS engine runs (V8 in Node, Chromium, Electron). Transcendentals (`sin`, `cos`, `pow`, `exp`, `log`, `atan2`) reach hashed state, and the spec leaves those implementation-approximated. |
| **Same build + platform** | native/WASM code whose float behaviour is a property of the compiled artifact. |
| **Not hashed** | the output never enters the state hash at all. It has its own contract, listed in the row. |

| Subsystem | Level | What backs it |
|---|---|---|
| ECS core, seeded RNG, command queue, hashing | Cross-platform | `rng.ts` is sfc32 — four uint32s and `Math.imul`, no floats in the state; `hash.ts` is pure-JS SHA-256 over canonical bytes |
| `physics.engine: "kinematics"` (2.5D XZ) | Cross-platform | `kernel/src/kinematics.ts` uses only `dmath.abs/ceil/clamp/floor/hypot/max/min/sqrt`; the broad-phase grid is rebuilt every tick and bodies resolve in creation order |
| `physics.engine: "platformer"` (XY swept boxes) | Cross-platform | `kernel/src/platformer.ts` uses only `dmath.clamp/max` |
| `physics.character: true` (character controller) | Cross-platform | `kernel/src/character.ts` uses only `dmath.hypot` |
| Terrain **sampling** — `molen.terrain.*`, ground under kinematics/character/vehicles | Cross-platform | `kernel/src/terrain.ts` is `+ - * /` plus `dmath.floor/sqrt`; the `Heightfield` behind it is `packages/terrain/src/heightfield.ts` + `gen.ts`, the two files `check-dmath` guards, and they use only `floor`, `sqrt`, `imul`, `max` |
| Timers, tweens, hierarchy, lifetime (`kernel/src/gameplay.ts`) | Cross-platform | no `dmath` and no `Math` transcendentals; easings are polynomial and `quatRotateVec3` is plain arithmetic |
| Scene scripts | Cross-platform **until** the script calls a transcendental; then same JS engine | the Compartment's `Math` is IEEE-exact natives plus `dmath` for everything else (`kernel/src/scripting.ts`); `Math.random` is absent and `Date`/`Intl`/`Promise` are shadowed to `undefined` |
| Quaternion helpers that use angles — `quatSlerp`, `lookRotation`, `quatFromYaw`, `quatFromEuler`, `yawOf` | Same JS engine | `kernel/src/math3d.ts` routes these through `dmath.sin/cos/acos/atan2`, and `dmath` is currently a thin re-export of native `Math` |
| Vehicles and aircraft | Same JS engine | `kernel/src/vehicles.ts` and `aircraft.ts` use `dmath.sin/cos/tan/atan2/exp` |
| Figures (`@bendyline/molen-figures/kernel`) | Same JS engine | its locomotion system writes `figureState` and `transform.rot` into the world and registers a `figures` snapshot provider, so it **is** hashed; it reaches `dmath.atan2` and `quatFromYaw`, and `gait.ts` reaches `dmath.pow`/`sin`/`cos` |
| `physics.engine: "rapier"` (3D rigid bodies) | Same build + platform | `@dimforge/rapier3d-compat` WASM; the plugin hashes an opaque `takeSnapshot()` blob plus its id→handle maps |
| Worldgen geometry and prop placement | Not hashed | `installWorldgen` registers the index on a `WeakMap` side channel with no snapshot provider; a test asserts installing it leaves `stateHash` unchanged. Its own content hashes (`hashWorldgenOutput`) are **same JS engine**: its kernel half calls `Math.hypot` in ~33 places, which `dmath.hypot` deliberately avoids because `Math.hypot`'s intermediate scaling is engine-defined |
| Terrain **streaming, projection, surface rendering** | Not hashed | outside `check-dmath`'s two guarded files on purpose; `geospatial.ts` reaches `Math.cos/log/tan/atan/exp` |
| `@bendyline/molen-materials` (textures, matgraphs, SVG) | Not hashed | render-only, and no kernel half imports it. Its contract is byte-identical output in Node and the browser — see the caveat below |
| Rendering, `molen shot`, golden images | Not hashed | pixels, not state; per-build, not cross-machine |

Two rows carry a footnote worth reading before you rely on them.

**Materials.** The contract is *identical bytes in Node and in the browser*, and it is tested
directly: `packages/tooling/test/golden/material-cross-env.golden.test.ts` bakes the same
matgraph and pixelgrid documents in Node and in headless Chromium and compares the RGBA buffers
byte for byte, with zero tolerance. Both of those are V8. The bakers call `Math.sin`/`Math.cos`
(in `noise.ts` and `matgraph.ts`), so that test is evidence across environments, not a proof
across JS engines. The SVG and UV-paint paths are not in that test.

**Worldgen's `worldgenBuilding` component.** The component *data* an entity is authored with is
ordinary ECS state and is hashed like any other component. What is not hashed is the geometry
worldgen generates from it.

## What breaks it

### Rules an author follows

The script Compartment enforces the first three. The rest are yours to keep.

- **No `Math.random`.** The injected `Math` has no `random`. Use `molen.rng()`, which draws from
  the seeded world RNG and is saved in every keyframe.
- **No `Date`, no `Intl`.** Both are shadowed to `undefined`. Use `molen.tick`.
- **No `Promise`.** Also shadowed: a `.then()` callback runs after the tick's hash was taken. Use
  `molen.after` / `molen.every`, which emit events on a tick boundary.
- **Locale formatting is a review rule, not a guarded one.** `toLocaleString`, `toLocaleDateString`
  and `localeCompare` live on `Number`/`String` prototypes, which the Compartment cannot remove.
  They depend on the host's locale and ICU build. Never put their output into component state or
  an event payload — format for display in the client.
- **Closure variables are not state.** Nothing serializes a JavaScript closure. Durable values
  belong in components, in `molen.state` (with `"checkpoint": "state"` on the script entry), or in
  a `world.registerSnapshotProvider`. See
  [scripting.md](scripting.md#state-that-survives-saveload-and-replay).
- **Never mutate a read.** `molen.get` and query rows hand back the stored object, frozen in dev
  worlds. Writing through it throws there — and with `devFreeze: false` it silently corrupts both
  the state and the deltas the client mirrors.
- **No NaN or Infinity in component data.** Dev worlds reject them at the write site: they hash as
  their IEEE bits but serialize to `null`, so a keyframe round trip would change both the state
  and its hash.
- **Kernel and capability code uses `dmath`, never transcendental `Math.*`.** `scripts/check-dmath.mjs`
  enforces it. It takes explicit roots, so coverage is per-package and deliberate: `kernel` guards
  all of `src`; `figures`, `worldgen` and `worldgen-earth` guard `src/kernel`; `terrain` guards
  exactly `src/heightfield.ts` and `src/gen.ts`, because a `Heightfield` is the kernel's structural
  `GroundField` and the rest of that package is projection and streaming. The lint is lexical — it
  cannot see a transcendental reached through an import, which is why
  `worldgen-earth` carries its own `dmath`-based `projection.ts` instead of importing terrain's.
- **Systems never read a content library at tick time.** Entity types, landmark models and
  business catalogs are content: a host loads them and hands them over as libraries
  (`createTypeLibrary`, `createLandmarkLibrary`, `createBusinessCatalog`). Anything a tick needs
  from them is copied into components when the entity spawns, which keeps the state hash complete
  on its own and lets a replay run without the library.

### Ways a host breaks it from outside

The Compartment only covers scripts. A setup module, a capability package or an embedding host
runs as ordinary code, and nothing lints it.

- **Reading the wall clock in a system.** `World` is clock-free by construction; every real-time
  concern lives in `Scheduler`, which is the only thing that calls `Date.now`. A system that reads
  `Date.now()` or `performance.now()` and writes the result into a component makes the run
  unreproducible, and the divergence report will say so.
- **Turning off `devFreeze`.** That disables both the freeze and the non-finite check, so mutating
  a read stops throwing and starts corrupting.
- **Iteration order that is not insertion order.** `Set`/`Map` iteration is insertion-ordered in
  JS, so the hazard is code that builds the collection in an order that varies — from an unordered
  fetch, a directory listing, or an object keyed by something unstable.
- **Changing the systems while comparing hashes.** Hash equality assumes identical systems,
  identical script sources and snapshot-safe host configuration. Two worlds built differently that
  happen to agree at tick 30 are not the same simulation.
- **Rapier.** Same build and same platform only. A replay recorded on one machine may diverge on
  another. The 2.5D kinematics layer is the cross-platform option.

## Upgrades and save files

**Upgrading Molen does not invalidate your saves unless the state format changed.**

Two constants live in `packages/kernel/src/version.ts` and they do different jobs:

| Constant | Today | Role |
|---|---|---|
| `ENGINE_VERSION` | `0.0.2` | metadata. Written into a keyframe's `engine` field so a save says which build wrote it. **Never compared on load, never hashed.** |
| `STATE_FORMAT` | `1` | the gate. Written into a keyframe under the reserved `plugins.$format` key, compared by `applyKeyframeTo`, and folded into `stateHash` as `stateFormat`. |

So a release — even one that moves every package on the fixed version line — keeps your keyframes
loadable and your recorded `*.replay.json` fixtures valid, as long as it did not change simulation
semantics or the snapshot layout. `STATE_FORMAT` is bumped only when it did. A keyframe written
before the key existed is read as format 1, the layout in use when it was introduced.

**What a mismatch looks like.** Loading a keyframe whose format does not match throws:

```text
keyframe state format 7 does not match 1 (written by engine 0.0.1)
```

`molen replay` checks the same thing before it runs anything, and tells you the fix:

```text
replay was recorded with state format 99; this build reads 1. Re-record it with: molen replay <fixture> --record
```

**What to do about it.** For a replay fixture or a pinned test hash, re-record:
`molen replay <fixture> --record`. For a save file, there is nothing to run: **formats are beta,
and a breaking change bumps the version in the envelope (`molen/scene@3`, `molen/keyframe@1`)
rather than shipping a migration.** Plan for saves to be disposable until the formats stabilize.

Loading a keyframe has three more requirements beyond the format, all of which throw rather than
silently drift: the target world's `tickRate` must match, `entityOrder` must name every entity
exactly once, and any script that has not declared `"checkpoint": "state"` refuses a restore at a
nonzero tick — because its durable state may be sitting in closures the engine cannot serialize.
Restore into the same systems, component vocabulary, script ids and plugin providers.

### Content identity

A world can record which content it was built from: `buildWorld(scene, setup, { content })`, where
`content` names each domain with the hash of the library that loaded it and, optionally, the packs
it came from (`{ types: { hash: typeLibrary.hash, packs: ['molen.entities@0.0.1'] } }`). The
identity is recorded **next to** the state hash, never inside it: keyframes carry it under the
reserved `plugins.$content` key, and a replay fixture records it as `content`. Content that affects
the simulation already reaches the hash through the components written at spawn; folding pack
hashes in as well would make a hash depend on content no tick read.

What the identity buys is a named error instead of a divergence at tick 0. Loading a keyframe into
a world built from different content throws before any state changes:

```text
keyframe was saved with different content: content "types" was sha256:ab… (molen.entities@0.0.1) but the loaded content is sha256:cd… (molen.entities@0.0.2)
```

`applyKeyframeTo(world, keyframe, { allowContentDrift: true })` loads anyway. `molen replay` checks
a fixture's `content` before it runs and suggests `--record`, which writes the identity the build
ran against. Only domains both sides name are compared, so a fixture recorded before a domain
existed, or a host that loads extra content, is not a mismatch. `worldFromKeyframe` restores the
identity the keyframe recorded.

## How to check it yourself

The commands below run in a copy of the Skybound sample, made from the npm packages with
`npx @bendyline/molen-tooling new skybound --template skybound` (then `cd skybound && npm install`).

**One run, one hash.**

```sh
npx molen sim run scene.json --ticks 30 --hash
```

```text
tick: 30
hash: sha256:ba22126aec5915b2de74b445cce75077e859ed5f1837cc3f13d4508c7222ccb9
events: 30
physics: platformer (cross-platform deterministic)
```

The last line is the CLI naming the level for you. A `rapier` scene prints
`physics: rapier (deterministic same-build/same-platform only)` instead. It reports the **physics
engine's** level, not the scene's: a kinematics scene that also drives vehicles or figures is
same-JS-engine overall. Use the table above for the whole scene.

**A recorded run, localized on failure.** A `*.replay.json` fixture holds the scene reference, the
command log, and `expected.stateHash` plus `expected.tickHashes`.

```sh
npx molen replay first-leap.replay.json
```

```text
✓ replay matches (150 ticks, hash sha256:ede1d58b…, 128 events)
```

On a mismatch you do not get "hash differs". `molen replay` re-runs the build against itself and
classifies what it finds:

- **`non-deterministic`** — the build diverged from *itself*. You get the first divergent tick and
  a component-level diff of what differed there, plus the usual causes (`Math.random`,
  `Date`/`performance`, iteration order). Fix the code.
- **`behavior-drift`** — the build is deterministic but no longer matches the recording. If the
  per-tick hashes are recorded, you get the first tick that differs:

```text
✖ replay diverged from the recording (the build is deterministic):
  expected: sha256:deadbeef
  actual:   sha256:ede1d58b…
  first differs at tick 40
  → if the change was intentional, re-record with: molen replay <fixture> --record
```

**Two regression artifacts per sample, doing different jobs.** A pinned `stateHash` literal in a
sample's `test/headless.test.ts` freezes one run of the current build; a run compared with itself
only proves reproducibility, so that literal is what catches a refactor that quietly moved the
whole simulation. The committed `*.replay.json` beside the scene freezes the command log and the
per-tick hashes, so a failure names the tick. Keep both.

**Other tools.** `molen diff a.keyframe.json b.keyframe.json` gives a component-level diff between
two snapshots, including continuation differences under the reserved `$world` pseudo-entity.
`molen sim watch scene.json --ticks N` reruns on every file change and reports hash flips, event
deltas and assertion transitions.

**Golden images** are a different mechanism with a different guarantee. `compareGolden` from
`@bendyline/molen-tooling` compares a render (from `molen shot`, or `screenshotScene` in a test)
against a committed PNG with a perceptual tolerance (per-pixel threshold 0.1, at most 0.3%
differing pixels by default). A missing golden **fails** rather than adopting the candidate.
Record with `UPDATE_GOLDENS=1`. The engine's own golden suites (`pnpm -r test:golden` in the
engine repository) render in a pinned headless Chromium on a software rasterizer, and their
authoritative refresh is the `update-goldens` workflow, which records on the same Ubuntu 24.04
runner as the CI golden job. Record your own goldens on one pinned machine for the same reason.

## What is not promised

Read this list before you build something that depends on a guarantee it does not make.

- **Golden images are deterministic per build, not across machines.** The software rasterizer
  agrees with itself for a given Chromium build; it does not agree across Chromium versions or
  operating systems. That is why goldens are recorded in one pinned container and compared with a
  tolerance, and why DOM text overlays are kept out of captured frames.
- **Rapier is not cross-platform.** Same build, same platform. Measured run-to-run in its own
  tests; not claimed beyond that.
- **Transcendentals are not proven across JS engines.** `dmath` exists so that the swap to
  polynomial approximations is a one-file change. Today its transcendentals are thin re-exports of
  native `Math`, so every "same JS engine" row above stays same-JS-engine until that swap happens.
  Routing through `dmath` buys you the swap point, not the result.
- **There is no cross-JS-engine CI.** Every environment Molen tests in — Node, headless Chromium,
  the browser goldens, the materials cross-environment test — runs V8. No claim in this repo has
  been checked against JavaScriptCore or SpiderMonkey.
- **Worldgen's content hashes are same-engine.** They are cache keys and regression signals, and
  its kernel half reaches `Math.hypot`, whose intermediate scaling is engine-defined.
- **Equal hashes are not proof of equivalent future behaviour.** `stateHash` compares serialized
  continuation state. Mutable host and script closure state is outside the contract, and two
  worlds that agree for 300 ticks can still diverge at tick 301 if their systems differ.
- **Nothing here survives a change to the inputs.** A different `tickRate`, a different seed, an
  edited script, an added system, or a reordered command log is a different simulation, and it is
  supposed to hash differently.

## Where to go next

- [Scripting](scripting.md) — the verb set, the determinism rules in context, and `hardenScripts()`.
- [The agent loop](agent-loop.md) — where `sim run`, `replay` and `diff` sit in the dev loop.
- [Scene manifest](../schemas/scene.md) — the `physics.engine` field and what each value means.
