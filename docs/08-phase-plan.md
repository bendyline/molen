# 08 — Phased Milestone Plan (Vertical Slices)

Every phase ends in a runnable demo. Phase ordering confirmed with the owner: **Phase 1 =
terrain flyover, Phase 2 = top-down game**, then visualizations, machinima, Rapier, UV
pipeline, RTS, FPS; networking is design-only until last. Phases 0 and 1 are broken into
Claude-Code-sized tasks (each a few hours of agentic work) with acceptance criteria — these
tables are literally the work queue. When a phase slips, **re-cut its scope; never extend it.**

---

## Phase 0 — Kernel/Worker/Client skeleton ("Spinning Cubes")

**Demo:** a browser page renders ~50 cubes spinning and drifting, simulated at 30 Hz in a
Web Worker kernel, rendered at display rate with interpolation. Space sends a `spawn_cube`
command through the command stream. The *same scene* runs headlessly in Node, asserts on
state, hashes deterministically, and screenshots via the CLI.

**Exit criteria**

- `examples/cubes` runs in the browser with visibly smooth interpolation (manual check:
  kernel forced to 10 Hz still renders smoothly).
- `molen sim run examples/cubes/scene.json --ticks 300 --hash` returns the identical hash
  across 100 consecutive runs and across two machines.
- `molen shot` produces a PNG of the cube scene; one golden test passes in CI.
- CI green: lint, typecheck, unit, replay, golden. Changesets release dry-run succeeds.
- An agent given only the repo + CLI completes the full dev loop
  ([07 §4](07-tooling-and-testing.md)) steps 1–6 on the cubes scene.

**Tasks**

| # | Task | Acceptance criteria | Deps |
|---|---|---|---|
| 0.1 | Monorepo scaffold: pnpm workspaces + tsconfig project refs + Biome + tsdown template; empty `schema`/`kernel`/`client`/`tooling` packages build | `pnpm build && pnpm typecheck && pnpm lint` green; a cross-package import typechecks | — |
| 0.2 | CI skeleton: `ci.yml` with check/unit jobs (plain `pnpm` scripts, `pre*` hooks build deps) | PR run green | 0.1 |
| 0.3 | `@bendyline/molen-schema` core: Zod setup, schema registry, `validate()` with `ValidationIssue` model + text formatter (did-you-mean, examples-in-hints) ; JSON Schema emission build step | Formatter golden-text tests pass; emitted `.json` schemas in package dist | 0.1 |
| 0.4 | First wire schemas: `format` envelope, command, scene manifest v0 (entities + components + prefabs), keyframe/delta | Round-trip tests; Zod/Ajv cross-validation agrees on 10 good + 10 bad fixtures | 0.3 |
| 0.5 | Kernel ECS core: string entity IDs + snapshotted counter, JSON-pure components, typed handles, query engine with version cache, deferred structural ops, 4-phase system registration, clock-free `step()`/`stepN()` | Unit tests: ID stability under interleaved create/destroy; query correctness incl. iterate-and-destroy; deterministic system order | 0.1 |
| 0.6 | sfc32 RNG + splitmix seeding + `dmath` module + Biome ban on transcendental `Math.*` in kernel | RNG test vectors pass; lint rule fails a seeded bad example | 0.5 |
| 0.7 | Command stream: queue, per-tick adjudication sorted by `(source, seq)`, schema validation of inbound commands with `command-rejected` events, late-command rewrite policy, event log | Unit: out-of-order/invalid/late commands handled per spec with formatted errors; valid commands mutate state at the declared tick | 0.4, 0.5 |
| 0.8 | Snapshot/delta: keyframe serialize/`fromKeyframe`, dirty-tracked delta encode + shared `applyDelta`, dev-mode freeze on `get()`, canonical binary hashing (SHA-256, sorted keys, float bits) | fast-check property `apply(delta(a,b),a)==b`; hash identical across 100 runs; save→load→hash equals continuous run | 0.5 |
| 0.9 | Replay harness: `.replay.json` recorder + runner with first-divergent-tick bisection; wired as `test:replay` | A recorded fixture passes; a mutated fixture reports the exact divergent tick + component diff | 0.7, 0.8 |
| 0.10 | Node headless runner + tooling bootstrap: ops library, `molen validate`, `molen sim run --ticks --commands --assert --hash`; selector DSL + assertion engine v0 (`@bendyline/molen-kernel/testing`) | CLI runs a scene 300 ticks; assertion doc with pass+fail cases produces formatted results | 0.9 |
| 0.11 | Worker host: kernel in Web Worker, postMessage protocol (commands/control in, deltas/keyframes/events out), Scheduler, browser bootstrap helper | Playwright (or Vitest browser-mode) test: worker boots, streams deltas at tick rate, pause/step works | 0.7, 0.8 |
| 0.12 | `@bendyline/molen-client` skeleton: three.js pin + wrapper layer, snapshot→scene-graph sync (`renderable` primitives + rung-1 materials), render loop, interpolation buffer | Manual demo renders; unit tests on interpolation math (clamp/no-extrapolate, spawn-snap, teleport, buffer underrun) | 0.11 |
| 0.13 | `examples/cubes`: scene manifest, spin/drift systems, Space→`spawn_cube` command flow, Vite app | Demo runs; headless variant: 300 ticks + assertions green via CLI | 0.10, 0.12 |
| 0.14 | Screenshot path v0: `createSnapshotViewer` capture page + Playwright orchestration; `molen shot` with camera args; forced deterministic capture settings; stats block | PNG produced for cubes at tick 300; stats include drawCalls/entities; asset-load barrier works | 0.12, 0.13 |
| 0.15 | Golden rig: odiff diffing, `--update` candidate flow, CI golden job with SwiftShader container (pinned digest) + triptych artifacts; first cube golden | Golden passes in CI; an intentional scene change fails with triptych uploaded | 0.14, 0.2 |
| 0.16 | Release + docs seed: changesets fixed group, `llms.txt` skeleton, quickstart + agent-loop guides, schema-reference autogenerator v0 | Release dry-run to local registry (verdaccio) succeeds; docs build; schema docs render all 0.4 kinds | 0.2, 0.4 |
| 0.17 | **De-risk spike: SES + WASM coexistence.** Load `rapier3d-compat` (as a representative emscripten module) in a Worker, run `lockdown()` after init, evaluate a script in a Compartment with injected `dmath`/rng, run ticks | Documented verdict: lockdown-after-init works / Compartments-without-lockdown fallback / escalate to QuickJS ([04 §8](04-kernel-design.md), [09](09-questions-and-risks.md) Q4) | 0.5 |

---

## Phase 1 — Terrain Flyover end-to-end

**Demo:** fly a free camera over a streamed, LOD'd, procedurally-shaded island at ≥60 fps —
the whole thing defined by a terrain descriptor JSON + material graph JSON; headlessly
screenshot-able; MCP server v0 live; llms.txt v0 shipped; release 0.1.0 published.

**Exit criteria**

- A 4k×4k-heightmap-scale world streams around a free camera at ≥60 fps on a mid-tier laptop
  GPU; no visible LOD cracks (golden + skirt-comparison test).
- Terrain height queries work headlessly in the kernel when collision is enabled (raycast
  down returns expected heights); render meshes live entirely in the client.
- Material rungs 1 (palette) and 4 (graph) work on terrain; `rasterize_material` previews
  graphs.
- MCP server v0 passes an integration test driving validate → load_scene → run_simulation →
  screenshot_scene.
- **Agent acceptance test:** a fresh Claude session, given only the MCP server + shipped
  docs, authors a *new* terrain descriptor variant (different seed/palette), validates it,
  screenshots it; result golden-checks as plausible terrain (manual sign-off this once).
- Release `0.1.0` on npm with the version-locked docs bundle.

**Tasks**

| # | Task | Acceptance criteria | Deps |
|---|---|---|---|
| 1.1 | Terrain descriptor schema (`molen/terrain@1`, evolved to `@2` when residency budgets shipped): tiles, grid, height range, layers with auto-banding, LOD/streaming config; validation + docs examples | Round-trip + error-format tests; schema doc page renders | 0.16 |
| 1.2 | `molen terrain gen`: seeded procedural heightmap generator (noise → 16-bit PNG tiles) in tooling — the engine ships no embedded assets; examples generate theirs | Deterministic output per seed (file hash); island fixture generated in example build | 1.1 |
| 1.3 | `@bendyline/molen-terrain/kernel`: heightfield resource, pure-TS PNG16 decoder, bilinear `sampleHeight`, `raycastDown`, residency command/ack handling; kernel plugin registration | Headless test: raycasts at known coords return expected heights; replay hash stable with terrain active | 1.1, 0.10 |
| 1.4 | `@bendyline/molen-terrain/client`: chunk meshing, quadtree LOD selection with skirts, distance bands | Wireframe screenshot shows expected LOD rings; crack-detection golden (skirts on/off comparison) | 1.1, 0.12 |
| 1.5 | Streaming: tile fetch/evict around camera (LRU), async decode, load-radius config, residency reporting | Camera-traverse test loads/evicts expected tile sets; heap ceiling assertion in Playwright | 1.4 |
| 1.6 | Free-fly camera (WASD + mouse-look, speed modifiers, client-side `minHeight` terrain clamp) + camera spec for headless shots | Manual flyover works; `molen shot --camera` reproduces an exact pose (golden) | 0.14, 1.4 |
| 1.7 | Material rung 1 polish: `palette:` / `vertex` resolvers, schema + docs | Schema tests; cube + terrain render with palette materials (golden) | 0.16 |
| 1.8 | Matgraph schema (`molen/matgraph@1`) + 14-node vocabulary, cycle detection with named-path errors | Schema tests incl. cycle error format; per-node param validation | 0.16 |
| 1.9 | Graph **CPU evaluator** in `@bendyline/molen-materials` (rasterize-to-texture; deterministic simplex with fixed permutation table; per-node sub-seeds) + client `DataTexture` adapter | Per-node golden swatches; identical bytes Node vs browser for 3 fixture graphs | 1.8 |
| 1.10 | Terrain splat shading: RGBA splat blending + height/slope auto-banding from layer config; the one tracked GLSL exception | Island renders with grass/rock/snow banding (goldens at 3 camera poses) | 1.5, 1.9 |
| 1.11 | `rasterize_material` op + `molen material bake` covering rungs 1–2–4 (pixelgrid rasterizer lands here too) | PNG outputs golden-tested for 3 graph + 2 pixelgrid fixtures | 1.9 |
| 1.12 | MCP server v0: stdio server exposing list/get_schema, search_docs, validate_asset, load_scene, query_state, spawn/update/destroy_entity, run_simulation, screenshot_scene | Integration test drives the full agent loop over MCP; tool inputSchemas are the op Zod schemas | 0.10, 0.14 |
| 1.13 | `examples/terrain-flyover`: descriptor + generated tiles + graph materials + fly cam; headless variant (camera traverse, height raycasts, assertions) | Demo runs; headless test green; 3 golden poses pass | 1.6, 1.10 |
| 1.14 | Perf pass: draw-call/triangle instrumentation, frustum culling sanity, stats in `screenshot_scene`; Playwright frame-time smoke (soft threshold, non-blocking) | ≥60 fps on reference hardware; stats reported | 1.13 |
| 1.15 | llms.txt v0 complete: concepts, agent-loop, terrain guide, autogen schema reference, `three-surface.md` generator, examples gallery with executed commands | Docs build in CI; all gallery commands execute green | 1.13, 0.16 |
| 1.16 | Docs-lint v0: API Extractor reports + drift check in CI | Seeded API change without docs fails CI; with docs passes | 1.15 |
| 1.17 | Release 0.1.0: changesets release, `@bendyline/molen-docs` published, GitHub release with llms bundle artifact | Clean-dir npm install; quickstart commands work as documented | 1.15, 1.16 |
| 1.18 | Agent acceptance run: scripted harness gives a fresh Claude session only MCP + docs to author a new terrain variant; transcript recorded as a fixture | Variant validates + screenshots + signs off; every friction point filed as an issue | 1.12, 1.17 |

---

## Phase 2 — Top-down game slice (sketch)

Prefab composition; **kinematic collision layer** (`@bendyline/molen-kernel/kinematics`: swept
circles/AABBs, grid checks, character mover) with terrain collision ON
(`collision.enabled: true`, kernel-side residency for gameplay chunks); **scripting sandbox
v1** (SES per [04 §8](04-kernel-design.md), informed by spike 0.17) with hot reload;
**pixel-grid texture rung** in anger; declarative input bindings → command flow; pointer
picking; `run_replay` + `diff_snapshots` MCP tools; top-down-ortho camera mode.

**Acceptance gate (intentionally brutal):** a small complete game (e.g. a 10-wave arena or a
sokoban-like) **authored end-to-end by an agent using ONLY the MCP interface and shipped
docs** — the engine's first true AI-legibility exam. The phase is not done when the demo
runs; it's done when this passes. Budget a stabilization stretch after it: the run will
surface a backlog of legibility gaps, and fixing them is the point
([09](09-questions-and-risks.md) Q9 context).

## Phases 3–7 (sketches)

- **P3 — Visualizations + machinima:** data-binding helpers (JSON data → entity
  attributes), replay scrubbing in the client (keyframe seek + interpolated playback,
  [04 §4.4](04-kernel-design.md)), camera-track schema, `export_frames` tool for image
  sequences. First non-game vertical slice.
- **P4 — Rapier opt-in (`@bendyline/molen-physics-rapier`):** `rapier3d-compat` lifecycle
  ([04 §7](04-kernel-design.md)), `rigidbody`↔ECS mirroring, hybrid snapshot blob,
  determinism findings **measured and documented** (expected: same-build/same-platform
  deterministic; cross-platform not promised).
- **P5 — UV paint-by-numbers + SVG rung:** xatlas unwrap productionized with the mesh
  validation pre-pass, template + sidecar generation, island masking + dilation import,
  `generate_uv_template`/`apply_uv_paint` live; resvg SVG rung lands here too
  ([06 §3, §6](06-materials-and-assets.md)).
- **P6 — RTS slice:** pathfinding capability package (flow fields or HPA* over grid),
  selection/command UX patterns, many-unit perf (instanced rendering; likely the first
  profiling-driven move of deltas to binary — [09](09-questions-and-risks.md) R10).
- **P7 — FPS slice + networking design doc:** character controller capability, 60 Hz world,
  extrapolation/prediction work; networking deliverable is a **design doc only** (authority
  model, transport slot, reconciliation) validated against the existing command/snapshot
  architecture ([01 §5](01-architecture.md)).
