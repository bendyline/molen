# CONVENTIONS

Conventions for working in the Molen monorepo. Start at [AGENTS.md](AGENTS.md).

## Names

- Product **Molen**; private root package and CLI bin **`molen`**; serialized format namespace
  **`molen/<kind>@n`**; npm scope **`@bendyline/molen-*`**. The scope is final, not a placeholder.
- One naming shape everywhere: a published package is **`@bendyline/molen-<name>`** (a capability's
  kernel/client halves are subpath exports of it, never separate packages); a demo is
  **`@bendyline/molen-examples-<name>`** and private; the site is **`@bendyline/molen-docs-site`**
  and private. The CLI is published as the `molen` bin of `@bendyline/molen-tooling` — the
  unscoped `molen` name on npm belongs to an unrelated package.
- Package `description` fields start with **Molen**, never the pre-rename "Experience engine": npm
  and the generated API index print them verbatim.
- The plan's `@bendyline/molen-docs` package was never built: the shipped docs bundle lives inside
  `@bendyline/molen-tooling` (`dist/docs-src`). Don't create it.

## Truth vs plan

- `docs/` = historical design plan (may lag the code); `docs-src/` + `packages/` = shipped truth.
  Don't implement against `docs/` without checking the code.

## Build & test

- **Build before typecheck/test.** Packages import each other's `dist`. Use the root scripts
  (`pnpm typecheck`, `pnpm test:unit`, `pnpm lint`) which run `pnpm -r build` first via `pre*`
  hooks, or run `pnpm -r build` before invoking `tsc`/`vitest` inside a package.
- CI runs only plain `pnpm` scripts: `pnpm lint`, `pnpm typecheck`, `pnpm source:check`,
  `pnpm test:unit`, `pnpm audit:prod`, `pnpm docs:check`, `pnpm smoke:packed`,
  `pnpm docs:site:check`, `pnpm test:golden`. Local green must equal CI green.
  `pnpm all` runs the lot in the right order; `pnpm verify` is the fast subset of it (lint,
  typecheck, source and docs checks, test:unit, production audit) that also gates the Release workflow, so a green `pnpm all`
  means a release will not fail on a check you could have run yourself. `check-release-gate.mjs`
  in `pnpm lint` enforces that: every script the Release workflow runs must be reachable from
  `all`. Local source copies without `.github/workflows` explicitly skip that comparison; CI
  and checkouts with a workflows directory still require `release.yml`.
  The recursive test scripts pass `--no-bail` on purpose: without it one failing package stops the
  run and every package after it reports nothing, so a red CI has to be fixed one round-trip at a
  time. `test:golden` additionally pins `--workspace-concurrency=1`: these suites drive real
  browsers on a software rasterizer, and run in parallel they starve each other until a page misses
  a timing-sensitive wait that passes when the suite runs alone. Serial is slower and honest.
- **A golden image must be committed.** `compareGolden` fails when the reference is missing rather
  than adopting the candidate — otherwise "this test has no reference" and "this test passed" look
  identical, and a fresh CI checkout takes that branch for every uncommitted golden. Record with
  `UPDATE_GOLDENS=1`; locally that produces a candidate only, and the authoritative refresh is the
  `update-goldens` workflow, which records on the same Ubuntu 24.04 runner as CI. Keep DOM overlays out of a
  captured frame (world-explorer's `hud=0`): text metrics differ between platforms, and a golden
  that includes them is a font test wearing a render test's clothes.
- Generated script types: `molen-scripts.d.ts` + `tsconfig.json` beside a scripts directory come
  from `molen types gen` (scene + registry). Never edit them by hand — change the scene or the
  component schema and regenerate; `molen types gen --check` flags staleness and
  `molen scripts check` refuses to run against stale declarations.
- Generated docs: `docs-src/schemas/*.md` come from the registry (`pnpm docs:gen`); never edit
  them by hand — add `.describe()` to the Zod field and regenerate.
- Generated site: `docs-site/` (molen.dev) builds its API, CLI/MCP, guide, schema and sample pages
  from the shipped build (`pnpm docs:site:gen`); those directories are gitignored build output, so
  never edit them by hand — fix the TSDoc comment, the `OPS_CATALOG` entry, or the `docs-src/`
  page instead. Only the landing page, the VitePress config and the editorial arrays in
  `docs-site/scripts/*` are hand-written. See [docs-site/README.md](docs-site/README.md).
- ESM-only, Node ≥ 22.13. Bundling via tsdown; typecheck via `tsc`. `isolatedDeclarations` is on, so
  **every exported symbol needs an explicit type annotation** (the `.d.ts` is the API contract).
  `stripInternal` is on too: a member marked `/** @internal */` stays at runtime and inside the
  package but is removed from the published `.d.mts`, which is how an accessor like
  `World._internal()` can exist without becoming a public API. Keep the marker on anything a
  consumer should not see, and remember the doc comments that survive it are shipped text — a
  citation to `docs/` (the repo-only design plan) is a dead pointer in a consumer's editor.

## Package boundaries

- `@bendyline/molen-schema` depends on nothing. It owns formats **and the component vocabulary**
  (register new components with `registerComponent`).
- `@bendyline/molen-kernel` depends only on schema (+ `ses` for the script Compartment). No
  DOM/three.js/WASM. Subpaths: `/testing`, `/kinematics`, `/character`, `/scripting`, `/terrain`,
  `/platformer`, `/determinism`, `/content`, `/vehicles`, `/aircraft`.
  `buildWorld` is the one build order every host uses (data systems → commands → entities →
  physics hook → terrain hook → setup → scripts).
- `@bendyline/molen-client` depends on schema + materials (+ three.js); never imports kernel
  internals. (materials is pure CPU — the client's MaterialResolver bakes doc-backed
  materialRefs at load time.) Subpaths: `/camera-track`, `/vite`, `/vehicles`, `/aircraft`. The
  main barrel is the rendering surface only: finished game content sits behind a subpath that
  mirrors the kernel's, so `/vehicles` and `/aircraft` are the render halves of the kernel
  subpaths of the same name. Put the next `createXVisual` there, not in `index.ts`.
- `@bendyline/molen-terrain` is a capability package split into `/kernel` and `/client` — it has
  **no `.` export**. New capability packages follow this kernel/client-halves pattern.
- `@bendyline/molen-pack` depends only on schema (+ `fflate`). Its `.` entry runs in browsers,
  Workers and Node and imports no `node:` modules; file-system helpers live in `/node`. The
  client does not depend on it: a pack set hands the client an `AssetProvider`-shaped object.
- **Content is not in npm packages.** Models, style packs, catalogs and the star table live under
  the top-level `content/<pack>/` directories, each with a `molen-pack.source.json`, and ship as
  content packs. A package's `files` is `["dist"]`. Library code never fetches content on its own
  and never names a host; the app passes in documents or a pack, and without them the feature is
  simply absent (no stars, no parked cars, no recognized businesses), never a hidden default.
  `scripts/check-package-contents.mjs` enforces this in `pnpm lint` and again on the release
  tarballs: no content files or directories, no JSON reached outside a package, no chunk large
  enough to be data.
- `@bendyline/molen-tooling` sits on top; nothing imports it. All logic lives in `src/ops/*` as
  `(input) => output`; the CLI and MCP server are thin mappings over those ops.

## Determinism (the headline guarantee)

- Kernel/sim code must use `dmath`, never transcendental `Math.*` (enforced by
  `scripts/check-dmath.mjs`). Scripts get a `Math` endowment routed through `dmath` and have no
  `Math.random`, `Date`, or `Intl` — use `molen.rng` and `molen.tick`. Those endowments are
  determinism tooling, **not** a security boundary: a script shares the host realm's mutable
  intrinsics and runs with the host process's authority (the CLI and MCP server evaluate scripts
  in-process), so a scene manifest is source code, not data. `hardenScripts()` is the opt-in SES
  `lockdown()` for a kernel-only host — see docs-src/guide/scripting.md ("Script trust").
  `check-dmath.mjs` takes one or more roots (a directory or a single file), so a package guards
  exactly the modules whose output reaches the state hash — `@bendyline/molen-terrain` guards
  `heightfield.ts` + `gen.ts` (a `Heightfield` is the kernel's structural `GroundField`) and not
  its projection/streaming code. `@bendyline/molen-materials` is deliberately **not** guarded: it
  is render-only, never enters the state hash, and importing `dmath` would make it depend on the
  kernel. Its real contract — identical bytes in Node and the browser — is tested directly by
  `packages/tooling/test/golden/material-cross-env.golden.test.ts`.
- **Two regression artifacts per example, and they do different jobs.** A pinned `stateHash` in
  `test/headless.test.ts` freezes one run of the current build; comparing a run with itself only
  proves reproducibility, so a refactor that moves the whole simulation passes it. A committed
  `*.replay.json` next to the scene freezes a recorded command log plus per-tick hashes, so a
  divergence reports the first tick that differs and says whether the build is non-deterministic
  or the behaviour drifted. Re-record intentional changes with `molen replay <fixture> --record`.
- Reads are freeze-on-write: `world.get`/query rows return the stored object (frozen in dev);
  a write installs a new object, so reference identity is the change signal (rapier relies on
  it). Never mutate a read.
- Formats are beta: bump the version (`molen/scene@3`) instead of carrying migrations.
- Adding a new op? Add it to `src/ops/`, surface it on **both** the CLI and the MCP server, and
  add an entry to `OPS_CATALOG` (`src/ops/describe.ts`) so `molen describe` / `describe_op` see it.

## Releases

- One fixed version line across all `@bendyline/molen-*` packages. Semantic-release reads
  Conventional Commits on `main`: `fix:` for a patch, `feat:` for a minor, and a breaking change
  for a minor while the project is on 0.x. Release metadata is committed once after publication.
