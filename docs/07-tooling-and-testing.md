# 07 — Tooling, Build, Testing & Docs

Resolves brief §4 questions 11 (repo structure) and 12 (testing strategy), plus the agent
tooling boundary and the MCP tool list from brief §3.7.

## 1. Monorepo & build

### 1.1 Workspace: pnpm workspaces (no task runner)

pnpm is the de facto TS-monorepo standard with deep agent training exposure
(`pnpm-workspace.yaml`, `workspace:*`). At this scale (≈12 packages, full cold build under
~20s) a dedicated task runner isn't earning its keep: `pnpm -r <script>` already runs scripts
in **topological dependency order**, and the one cross-script ordering constraint turbo
provided (`dependsOn: ^build` — build a package's deps before typechecking/testing it) is
replicated by pnpm `pre*` lifecycle hooks in the root `package.json` (`pretypecheck`,
`pretest:unit`, `pretest:golden` each run `pnpm -r build`). No `turbo.json`, no Nx
generators/daemon — the entire build mental model is the root scripts plus one base tsconfig.
Turborepo (local + remote cache) is the documented re-add if full builds ever creep past
~30–60s or CI wants a cross-machine cache; it's a non-structural change (drop `turbo.json`
back in, point the root scripts at it) because the `dependsOn`/`outputs` contract lives at the
root, not in the packages.

```
molen/
  pnpm-workspace.yaml
  tsconfig.base.json
  biome.json
  CONVENTIONS.md
  packages/
    schema/  kernel/  client/  materials/  terrain/  tooling/  docs/
    physics-rapier/        (Phase 4)
  examples/
    cubes/                 (private) Phase 0 demo + regression test
    terrain-flyover/       (private) Phase 1 demo + regression test
  docs-src/                markdown sources + doc generator
  .github/workflows/       ci.yml  release.yml  nightly.yml  update-goldens.yml
```

Examples are **private workspace packages**: they participate in the task graph (typecheck,
test, golden) and resolve `@bendyline/molen-*` via `workspace:*` but never publish. Every example is
simultaneously a demo and a regression test (a Vite app + a headless test file).

### 1.2 Bundling & TypeScript

- **tsdown** (Rolldown-based tsup successor) per library package, ~15-line config; if its
  immaturity bites, **tsup is a config-compatible retreat** ([09](09-questions-and-risks.md)
  R11). Vite for examples.
- **ESM-only. Node ≥ 22.** No CJS — pure cost in 2026, and dual builds double WASM-loading
  edge cases. Irreversible-ish post-1.0 ([09](09-questions-and-risks.md) Q2).
- **TS project references** for typecheck (`tsc -b` at root) — correct incremental
  cross-package checking, explicit boundaries. Bundling (tsdown) and typecheck don't fight.
- **`isolatedDeclarations: true`** everywhere: every exported symbol carries an explicit type
  annotation, so the public API is fully readable at declaration sites — exactly what "type
  definitions are the API contract" demands — and `.d.ts` emission is fast and
  bundler-independent.
- Conditional exports (`"node"`/`"browser"`) appear **only** in `@bendyline/molen-tooling` and the
  capture path. Kernel and schema are environment-agnostic pure ESM by construction —
  CI-enforced (a test imports the kernel in plain Node and in a Worker harness).
- Biome for lint/format (includes the kernel transcendental-`Math` ban,
  [04 §5.3](04-kernel-design.md)).

### 1.3 WASM dependency policy

**WASM never appears in `@bendyline/molen-kernel` core or `@bendyline/molen-schema`.** It lives behind
capability/tooling packages with explicit `await init()`.

| Dep | Where | Packaging |
|---|---|---|
| Rapier | `@bendyline/molen-physics-rapier` (P4, opt-in) | `@dimforge/rapier3d-compat` — base64-inlined WASM, identical load in Worker/main/Node, zero bundler config; worth ~1.4 MB inline ([09](09-questions-and-risks.md) Q-list). Streaming-instantiate later behind the same `init()`. |
| xatlas | `@bendyline/molen-tooling` only | **Node-only** (import-time tool) — sidesteps browser WASM bundling for the UV pipeline entirely. Pin + vendor the WASM build. |
| resvg | `@bendyline/molen-materials` | `@resvg/resvg-wasm` in both browser and Node — identical bytes for goldens ([06 §3](06-materials-and-assets.md)). |

Rule of thumb agents follow: *runtime* WASM must be `-compat`-style self-contained;
*toolchain* WASM stays Node-only inside tooling. Each WASM dep lands with a dedicated smoke
test in both target environments before any feature uses it.

### 1.4 Versioning & publishing: Changesets, fixed version group

All `@bendyline/molen-*` packages share **one version line** — docs, schemas, and packages all say
"engine 0.4.0"; agents never reason about a compatibility matrix. Cost (bumps for unchanged
packages) is trivial at this count; split the fixed group only if e.g. the Rapier wrapper
needs to track Rapier releases independently ([09](09-questions-and-risks.md) Q11).
`changeset publish` runs from the release workflow; `@bendyline/molen-docs` builds and publishes in
the same release — docs↔code version lock by construction. Pre-1.0: breaking changes per
minor; wire-format versioning is independent (integer `v` envelopes,
[03](03-data-formats.md)).

### 1.5 CI (GitHub Actions)

**`ci.yml`** (every PR/push), all steps are plain `pnpm` scripts so agents run *identical
commands locally*: setup → `lint typecheck` → `test:unit` (Vitest incl. schema round-trips) →
`test:replay` (Node) → `test:golden` (pinned Playwright + SwiftShader container by
**digest**, diff artifacts on failure) → docs-lint (§6.4).
**`release.yml`** — changesets release PR + publish.
**`nightly.yml`** — golden suite ×3 (flake canary) + full agent-loop smoke (CLI end-to-end
on an example).
**`update-goldens.yml`** — manually triggered; regenerates goldens in the CI container and
commits to the PR branch (§5.3).

## 2. Schema & validation strategy

### 2.1 Zod v4 source of truth, generated JSON Schema

The brief's hardest requirement is **aggressively good validation errors**, and Ajv errors
against raw JSON Schema are notoriously bad (`must match "then" schema`). Zod gives
programmatic per-issue control — `expected`, examples, did-you-mean at the definition site —
and TS types are *inferred*, so validator↔types drift is impossible by construction. Agents
still get both representations: legible Zod source *and* published JSON Schema files
(emitted at build via `z.toJSONSchema()`), the universal interchange used for docs autogen
and non-TS consumers.

**Lossiness guard:** wire schemas may only use a JSON-Schema-expressible subset (no
`z.transform`, no refinements without equivalent description) — enforced by the
**cross-validation tripwire**: every fixture in the repo is validated by both Zod and
Ajv-against-emitted-JSON-Schema and the verdicts must agree
([09](09-questions-and-risks.md) R9, Q10).

Every schema carries `.meta({id, title, examples, docsRef})`; examples are mandatory
(lint-enforced) — they feed error hints and the autogenerated schema reference.

### 2.2 The error formatter (a tested product surface)

`ValidationIssue` model in [02 §2](02-packages-and-apis.md). The `formatted` block is what
agents iterate on:

```
✖ prefab "goblin" failed validation (2 issues)

1. /components/transform/position
   expected: array of 3 numbers [x, y, z]
   received: array of 2 numbers
   hint:     e.g. "position": [0, 1.5, -3]

2. /components/helth
   unknown component "helth" — did you mean "health"?
   valid components: transform, velocity, health, sprite, collider
   docs: schemas/components.md
```

Implementation notes that matter: collapse union errors to the deepest-matching branch
instead of dumping all branches; Levenshtein did-you-mean over enum values and object keys;
pull `examples` from schema meta into hints; cap at ~10 issues with "and N more". The
formatter has **golden-text tests** — error quality is a tested feature, not a vibe.

## 3. Agent tooling: one package, two faces

`@bendyline/molen-tooling` = `src/ops/` (every operation is `(input) => Promise<output>` with
Zod-validated I/O — the only place logic lives) + `molen` CLI (commander, thin mapping) +
`molen mcp` (stdio MCP server; each tool's `inputSchema` **is** the op's Zod schema — one
definition serves CLI parsing, MCP declaration, and validation).

**Session model:** stateful tools operate on a `session` (in-memory headless world keyed by
id, created by `load_scene`); stateless tools take paths. The CLI mirrors sessions with
`--scene` (load-run-discard) plus a long-lived `molen serve` mode.

### 3.1 MCP tool list

**Schema & docs**
- `list_schemas` — `() → [{kind, title, summary}]`
- `get_schema` — `(kind) → {jsonSchema, examples[], docsRef}`
- `search_docs` — `(query, k?) → [{section, path, excerpt}]` — lexical BM25 over the shipped
  bundle; no embeddings dependency; offline and version-matched.

**Validation**
- `validate_asset` — `(path | inline, kind?) → {ok} | {issues[], formatted}` (kind
  auto-detected from the `format` envelope when omitted)

**Scene & state**
- `load_scene` — `(scenePath | inline) → {session, summary: {entities, systems, tick}}`
- `spawn_entity` — `(session, prefab | inlineComponents, overrides?) → {entityId}`
- `update_entity` — `(session, selector, componentPatch) → {updated: entityId[]}`
- `destroy_entity` — `(session, selector) → {destroyed: entityId[]}`
- `query_state` — `(session, selector) → {matches: [{id, components}]}`

**Simulation & determinism**
- `run_simulation` — `(session | scenePath, ticks, commands?, assertions?) →
  {tick, stateHash, events[], assertionResults[], summary}`
- `run_replay` — `(replayPath) → {ok, expectedHash, actualHash, firstDivergentTick?}`
- `diff_snapshots` — `(a, b) → {added[], removed[], changed: [{id, component, path, before, after}]}`

**Rendering & capture**
- `screenshot_scene` — `(session | scenePath, {camera, size, atTick?}) →
  {imagePath | base64, renderStats}` ([05 §6](05-client-design.md))
- `rasterize_material` — `(materialJson | path, size) → {imagePath}` — one preview tool for
  pixel-grid, SVG, and graph rungs.

**Asset pipeline**
- `import_model` — `(gltfPath, {unwrap?, dilatePx?, atlasRes?}) → {outPath, report:
  {triangles, uvIslands, warnings[]}}`
- `generate_uv_template` — `(assetPath, opts) → {templatePng, sidecarJson}` (P5; contract
  declared now so it's stable)
- `apply_uv_paint` — `(assetPath, paintedPng) → {texturePath, previewPng}` (P5)

### 3.2 CLI mirror

`molen validate <path>` · `molen schema list|get <kind>` ·
`molen sim run <scene> --ticks N [--commands f] [--assert f] [--hash]` ·
`molen replay <fixture>` · `molen diff <a> <b>` ·
`molen shot <scene> [--camera …] [--at-tick N] -o out.png` ·
`molen material bake <json> -o out.png` · `molen import <gltf> [--unwrap]` ·
`molen uv unwrap|template|import` · `molen terrain gen` · `molen docs search <q>` ·
`molen test [unit|replay|golden] [--update]` · `molen mcp`

Every command exits non-zero with the `formatted` error block on failure — CLI output **is**
the agent feedback channel and gets the same quality bar as MCP results.

## 4. The headless agent dev loop (canonical, end-to-end)

1. **Author** — agent writes `scene.json` (+ `logic.js` scripts from Phase 2) using
   `get_schema`/`search_docs`.
2. **Validate** — `molen validate scene.json` → formatted issues. Cheap; the inner-inner loop.
3. **Simulate** — `molen sim run scene.json --ticks 300 --commands cmds.json --assert
   checks.json`. Boots the kernel **in-process in Node** (no Worker — the kernel is
   environment-agnostic), injects commands at their declared ticks, runs as fast as
   possible, returns final snapshot + event log + canonical state hash.
4. **Assert** — results in the same call (assertion doc format, [03 §6](03-data-formats.md)).
5. **Screenshot** — `molen shot scene.json --at-tick 300 --camera "pos=0,50,80 look=0,0,0"
   -o shot.png` — snapshot-render via Playwright ([05 §6.2](05-client-design.md)); agent
   reads the PNG (vision) and/or the stats block.
6. **Iterate** — edit, goto 2. Structured, formatted text at every failure.

One assertion engine behind everything: `@bendyline/molen-kernel/testing` exports
`createTestWorld`/`runAssertions`/`stateHash`; Vitest, the CLI, and MCP all call the same
functions.

## 5. Testing strategy

### 5.1 Unit — Vitest 3.x workspace mode

One project per package. Kernel priorities: ECS invariants (ID stability under interleaved
create/destroy; query correctness; deterministic system order), RNG test vectors, command
adjudication, snapshot/delta round-trip — `apply(delta(a,b), a) === b` as **fast-check
property tests** over small random worlds.

### 5.2 Deterministic replay tests

Fixture `*.replay.json` ([03 §5](03-data-formats.md)). **Stable hashing:** SHA-256 over a
canonical binary serialization — entities sorted by id, component keys sorted
lexicographically, numbers as raw IEEE-754 64-bit bits (never decimal strings), strings
UTF-8 length-prefixed. JS float `+ - * /` is bit-deterministic; transcendentals are the
hazard, hence the kernel `dmath` ban ([04 §5.3](04-kernel-design.md)) — cheap insurance
that keeps the cross-platform door open. On mismatch the harness **auto-bisects**: re-runs
with per-tick hashing, reports `firstDivergentTick` + a component-level diff at that tick —
a divergence report an agent can act on, not "hash differs."

### 5.3 Golden-image tests

- **Capture:** pinned Playwright Chromium, `--use-gl=angle --use-angle=swiftshader`
  (software rasterizer — CI pixels independent of host GPUs); snapshot-render only (no live
  sim during capture); fixed seed/DPR/tone mapping; 3 warmup frames.
- **Diff:** **odiff**, per-pixel threshold 0.1, `maxDiffPixelRatio` 0.3% default
  (per-test overridable), AA tolerance on.
- **Goldens are recorded only in the pinned CI container** (`update-goldens` workflow
  commits to the PR branch) — SwiftShader is deterministic per build, not across Chromium
  versions/OSes. Local `molen test golden --update` produces *candidates* only; the diff
  tool clearly distinguishes "within local tolerance" vs "CI-authoritative." Failures upload
  expected/actual/diff triptychs.
- **Flakiness:** nightly ×3 canary; any intermittent golden is quarantined (non-blocking
  job) within a day — a flaky golden suite is worse than none, because agents learn to
  ignore red.

### 5.4 Schema round-trips

(1) Every schema `examples` entry parses. (2) Every fixture and docs-gallery document
validates under both Zod and Ajv-against-emitted-JSON-Schema with agreeing verdicts (the
§2.1 tripwire). (3) Error-formatter golden-text tests on known-bad fixtures.

### 5.5 Agents run exactly what CI runs

`pnpm test:unit|test:replay|test:golden` and the `molen test` wrappers are the same
scripts CI executes. No CI-only incantations — local green must equal CI green or the agent
dev loop breaks down.

## 6. Docs strategy (docs are the product, for agents)

### 6.1 Bundle structure (`@bendyline/molen-docs`, also embedded in tooling for offline search)

```
llms.txt                      — index: one line per doc, engine version, three.js pin
llms-full.txt                 — concatenated single-file variant
guide/quickstart.md           — zero-to-cube in Node + browser
guide/agent-loop.md           — the §4 loop, copy-pasteable commands
guide/concepts.md             — kernel/client/schema mental model, tick/interpolation
packages/<name>.md            — per-package prose + generated API section
schemas/<kind>.md             — AUTOGENERATED from emitted JSON Schemas
                                (fields, types, constraints, examples, error catalog)
three-surface.md              — the wrapped three.js API (§6.2)
examples/<name>.md            — gallery: goal, full source, expected screenshot,
                                the exact commands that run it
changelog.md
```

### 6.2 `three-surface.md`

Generated from the client wrapper module: every wrapped/re-exported symbol gets the
engine-facing signature, the underlying three.js class at the pinned version, and
divergences from stock three idioms. CI fails if a wrapper export lacks a doc comment. This
file is the antidote to model-knowledge lag: an agent that "knows" r150 idioms reads current
truth here; llms.txt instructs agents to trust shipped docs over priors.

### 6.3 Versioning

Fixed-group changesets (§1.4) ⇒ `@bendyline/molen-docs@X.Y.Z` describes engine `X.Y.Z` exactly;
embedded in tooling so `search_docs`/`molen docs` are always version-matched and offline;
released bundles also attach to GitHub releases.

### 6.4 Docs-lint (pragmatic; full semantic coverage is a tarpit)

1. **API Extractor** `api-report.md` per public package, committed; any public-surface
   change shows up as a report diff.
2. CI rule (a 30-line script, not a framework): a PR changing any `api-report.md` must also
   touch `docs-src/` or carry a changeset tagged `docs-reviewed`.
3. Strict checks that never relax: schema reference regen is a build step (can't drift);
   **every documented example's commands execute in CI** (docs that lie fail the build);
   wrapper exports require doc comments.
