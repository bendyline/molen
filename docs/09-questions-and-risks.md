# 09 — Questions & Risks

Two sections: the **risk register** (things that can go wrong, with mitigations baked into
the plan) and **open decisions for the owner** (interesting tradeoffs surfaced during
design — the plan proceeds on the stated recommendation unless overridden).

## 1. Risk register

| # | Risk | Likelihood | Impact | Mitigation (where it lives) |
|---|---|---|---|---|
| R1 | **Scope explosion** — the brief spans 6 use cases, 6 material rungs, physics, tooling | High | High | Vertical-slice phases with demo exit criteria; the capability-package rule (kernel additions need explicit justification); the Phase 2 agent-authored-game gate forces depth before breadth; phases are **re-cut, never extended** when slipping ([08](08-phase-plan.md)). |
| R2 | **three.js version drift vs model knowledge** — models "know" old idioms; three releases monthly | High | Medium | Exact pin per release; wrapper layer localizes churn ([05 §1](05-client-design.md)); generated `three-surface.md` ships current truth; llms.txt instructs agents to trust shipped docs over priors ([07 §6.2](07-tooling-and-testing.md)). |
| R3 | **Rapier determinism limits** — stock builds lack `enhanced-determinism`; cross-platform unverified; snapshot purity breached | Medium → **measured** | Medium | **Phase 4 built and measured (`@bendyline/molen-physics-rapier`, see its tests):** `rapier3d-compat` 0.19 is **bit-deterministic run-to-run** here (two runs → identical state hash) and the **hybrid-blob snapshot resume is bit-exact** (continue-from-keyframe matches a continuous run to 5 decimals). Confirms the same-build/same-platform stance; cross-platform still not promised. The opaque base64 blob lives only under `keyframe.plugins.rapier` (the one labeled breach of all-JSON snapshots); the legible transform mirror is in components. |
| R4 | **UV pipeline quality on AI geometry** — degenerate/non-manifold meshes make xatlas crash or emit island confetti; community-maintained WASM bindings | High | Medium | Deferred to P5 after rungs 1–4 prove out; mandatory mesh-validation pre-pass with actionable errors; >40-island budget warning; island masking + dilation are hard requirements; pin + vendor the WASM build; rung 5 is opt-in per asset ([06 §6](06-materials-and-assets.md)). |
| R5 | **Headless capture gaps** — headless WebGPU needs unsafe flags and is CI-flaky; `headless-gl` is dead (WebGL1-only; three dropped WebGL1 in r163) | Medium | Medium | Playwright + SwiftShader WebGL2 is the canonical path ([05 §6](05-client-design.md)); WebGL stays the renderer default until the WebGPU headless gap closes (re-checked per version bump); OffscreenCanvas is an optimization, not a dependency. |
| R6 | **Worker/Node dual-target build complexity** | Medium | High | ESM-only; kernel environment-agnostic by construction with CI imports in both Node and a Worker harness; conditional exports confined to tooling/capture; WASM policy keeps loaders out of the kernel ([07 §1](07-tooling-and-testing.md)). |
| R7 | **Golden-image flakiness** — SwiftShader deterministic per build, not across Chromium versions/OSes | High | Medium | Pinned container digest; goldens recorded only in CI; perceptual diff with tolerance; snapshot-render (no live sim) capture; nightly ×3 canary; 1-day quarantine rule — a flaky golden suite teaches agents to ignore red ([07 §5.3](07-tooling-and-testing.md)). |
| R8 | **SES `lockdown()` is realm-global** — freezes intrinsics for kernel code and WASM/emscripten glue in the same worker | ~~Medium~~ **Retired** | Medium | **Spike 0.17 ran and passed (see `spikes/ses-sandbox/spike.mjs`):** after `lockdown()`, (a) the kernel ECS runs 10 ticks with a stable hash, (b) `Math.random` is tamed inside a Compartment, (c) user logic runs synchronously+deterministically with an injected API, and (d) **Rapier's `rapier3d-compat` WASM initializes and steps** — the emscripten-coexistence worry did not materialize. QuickJS fallback remains available behind the `ScriptAPI` contract but is not needed. |
| R9 | **Zod ↔ JSON-Schema lossiness** — published schemas are a build artifact and could drift | Medium | High | Restricted schema subset policy; cross-validation tripwire (every fixture validated by both Zod and Ajv, verdicts must agree) ([07 §2.1](07-tooling-and-testing.md)). TS-type drift is impossible by construction (inferred types). |
| R10 | **JSON deltas become the RTS-scale hotspot** — structured-clone whole-component deltas at 30 Hz are fine for thousands of entities, not tens of thousands | Low (early) → High (P6) | Medium | Encoding hidden behind `Keyframe`/`Delta` interfaces; binary is a drop-in when profiling demands; budget it before the RTS phase ([04 §4.1](04-kernel-design.md)). |
| R11 | **tsdown/Rolldown immaturity** | Low–Med | Low | Config-compatible retreat to tsup; bundler choice isolated to per-package configs ([07 §1.2](07-tooling-and-testing.md)). |
| R12 | **Docs rot** — docs are the product for agents; stale docs break the whole premise | Medium | High | Docs-lint (API-report drift check); gallery commands executed in CI (docs that lie fail the build); schema reference autogenerated; docs version-locked to releases ([07 §6](07-tooling-and-testing.md)). |
| R13 | **Whole-component delta granularity is chatty** if bulk data lands in hot components | Medium | Low–Med | Convention + loud docs ("keep hot components small"); per-field patch deltas are an additive format-version bump if a real case breaks it ([04 §4.3](04-kernel-design.md)). |
| R14 | **Dirty tracking trusts the write API** — in-place mutation of a `get()` result corrupts deltas silently in production | Medium | Medium | Dev mode freezes returned components (mutation throws); docs; revisit with always-copy if it bites agents in practice ([04 §4.3](04-kernel-design.md)). |
| R15 | **Agent-generated code sprawl/inconsistency** across many agentic tasks | Medium | Medium | Biome + `isolatedDeclarations` + api-report diffs make drift visible; `CONVENTIONS.md` at repo root; small-PR discipline — the phase task tables are the work queue with per-task acceptance criteria ([08](08-phase-plan.md)). |
| R16 | **Monorepo overhead for a solo+agents team** | Medium | Low | No task runner — plain `pnpm -r` + `pre*` hooks; fixed versioning; few packages until a boundary earns existence; the root scripts + one base tsconfig are the entire build mental model. Turborepo is the documented, non-structural re-add if builds outgrow ~30–60s ([07 §1.1](07-tooling-and-testing.md)). |

## 2. Open decisions for the owner

Each has a recommendation the plan proceeds on; flagging because the tradeoff is genuinely
interesting or hard to reverse.

| # | Decision | Recommendation & tradeoff |
|---|---|---|
| Q1 | **Playwright/Chromium (~150 MB) as a hard dependency of the agent screenshot loop** | Accept. The alternative (Node headless GL) is dead tech rendering through a *different* pipeline than users see — disqualifying. Warm context pool keeps shots at ~100–300 ms ([05 §6](05-client-design.md)). |
| Q2 | **ESM-only + Node ≥ 22** | Accept; free for a 2026 greenfield engine, but irreversible-ish post-1.0 — CJS consumers are foreclosed ([07 §1.2](07-tooling-and-testing.md)). |
| Q3 | **Transcendental-`Math` ban in kernel/sim code** (use `dmath`) | Accept. A small contributor tax that is the cheap insurance keeping cross-platform replay/lockstep alive ([04 §5.3](04-kernel-design.md)). |
| Q4 | **SES as the sandbox bet** | **Resolved by spike 0.17 (passed).** SES Compartments give sync, deterministic, near-zero-marshalling execution and coexist with both the kernel and Rapier WASM after `lockdown()`. Proceeding with SES; QuickJS fallback stays available behind `ScriptAPI` but is not expected to be needed ([04 §8](04-kernel-design.md), R8). |
| Q5 | **Rapier's two purity breaches** — an opaque base64 blob inside otherwise all-JSON keyframes, and ~~believed-not-yet-measured~~ **measured** determinism | **Resolved by Phase 4.** Determinism + bit-exact resume now measured (R3). Accept the documented stance ("Rapier worlds are replay-safe on one platform only"); both breaches are contained to the opt-in plugin and the general `registerSnapshotProvider` hook ([04 §7](04-kernel-design.md)). |
| Q6 | **Whole-component deltas + dev-freeze (not always-copy) on `get()`** | Accept; revisit only if silent-mutation bugs bite agents in practice (R13, R14). |
| Q7 | **No entity-ID generations** — dangling references resolve to `undefined` instead of erroring | Accept; the legibility-friendly trade. Agents must handle `undefined` from `get()`; tooling offers a strict mode logging dangling lookups ([04 §1.1](04-kernel-design.md)). |
| Q8 | **Static-only rung-4 textures in v1** — no animated water/lava; scrolling-UV tricks only | Accept for Phase 1. Wanting animated materials in Phase 1 forces the shader-compile backend early — significant scope ([06 §4.1](06-materials-and-assets.md)). |
| Q9 | **30 Hz + no client prediction is wrong for the FPS use case** | Confirm FPS stays last-priority. Per-world tick rate covers frequency; prediction is deliberately deferred — the command stream + deterministic kernel are exactly its prerequisites, so deferral cost is low ([04 §2](04-kernel-design.md), [08 P7](08-phase-plan.md)). |
| Q10 | **Zod-first vs JSON-Schema-first** | Zod-first for error quality + zero type drift. If significant non-TS consumers will author against the schemas, JSON-Schema-first becomes more defensible; the tripwire covers lossiness either way ([07 §2](07-tooling-and-testing.md)). |
| Q11 | **Single fixed version line for all packages** | Accept; split the fixed group only if a package (e.g. the Rapier wrapper) needs an independent cadence ([07 §1.4](07-tooling-and-testing.md)). |
| Q12 | **npm scope** | **Resolved (owner decision, 2026-09-17): `@bendyline/molen-*` is the real scope, not a placeholder.** Every published package is `@bendyline/molen-<name>`; the CLI ships as the `molen` bin of `@bendyline/molen-tooling`, because the unscoped `molen` name on npm belongs to an unrelated package. No rename is pending before the 0.1.0 release (task 1.17). |

### Smaller noted alternatives (no decision needed; recorded so nobody re-litigates blind)

- **Terrain double-fetch** (kernel and client decode the same PNG tiles independently):
  accepted to keep postMessage tiny and let flyovers skip kernel terrain entirely; the
  alternative (client fetches, transfers ArrayBuffers) is a contained protocol change if
  hosting costs matter ([05 §5.4](05-client-design.md)).
- **resvg-js native bindings** as a Node-only speedup behind the same `bakeSvg` API if
  wasm rasterization is ever too slow in tooling ([06 §3](06-materials-and-assets.md)).
- **SVG `<text>` policy** (reject; outline to paths): if signage-with-text proves
  high-frequency, bundle one OFL font into tooling instead ([06 §3](06-materials-and-assets.md)).
- **Rapier `-compat` inline WASM (~1.4 MB)**: accepted for an opt-in capability; streaming
  instantiation later if bundle size draws complaints ([07 §1.3](07-tooling-and-testing.md)).
- **Geometry clipmaps**: a compatible alternative terrain *renderer* over the same tiled
  data when single-giant-heightfield view distances matter ([05 §5.1](05-client-design.md)).
- **Named RNG substreams** (`world.rng("loot")`): documented later extension; each substream
  is more snapshot state ([04 §5.1](04-kernel-design.md)).
- **Interpolation never extrapolates in v1**: micro-stutter over misprediction; FPS-phase
  work revisits with prediction/reconciliation ([05 §2.3](05-client-design.md)).
