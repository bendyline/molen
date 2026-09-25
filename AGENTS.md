# AGENTS.md — building on molen

molen is an **AI-legible 3D experience engine**: a deterministic headless simulation **kernel**
(no DOM/three.js; runs in a Web Worker and in Node) + a three.js **client**, joined by a message
protocol, over a data-only **schema** package, with an agent **tooling** package (the `molen`
CLI + an MCP server) on top. Its #1 design goal is that an agent can build a complete small
experience with **zero human intervention** from shipped docs, schemas, and the headless loop.

> **Building an app on Molen? You do not need this repository.** Install from npm
> (`npx @bendyline/molen-tooling new <name> [--template <sample>]`), then read the version-locked
> docs bundle at `node_modules/@bendyline/molen-tooling/dist/docs-src/llms.txt`; every scaffolded
> project carries its own `AGENTS.md` pointing there. Samples play at https://molen.dev/play/ and
> content packs come from `molen pack fetch https://molen.dev/packs/index.json`. This file is for
> agents working **on** the engine.

## START HERE

1. Read the shipped agent bundle: **[docs-src/llms.txt](docs-src/llms.txt)** (index) →
   [docs-src/guide/agent-loop.md](docs-src/guide/agent-loop.md) (the loop) →
   [docs-src/guide/scripting.md](docs-src/guide/scripting.md) (game logic).
   For prompt-driven models and textures, continue to
   [docs-src/guide/3d-model-assets.md](docs-src/guide/3d-model-assets.md).
2. Build once, then drive everything through the CLI (or the MCP server, which mirrors it):

```sh
pnpm install && pnpm -r build              # build before typecheck/test (see "Build invariant")
node packages/tooling/dist/cli.mjs --help  # NOTE: dist/cli.mjs (.mjs, not .js)
node packages/tooling/dist/cli.mjs new my-experience   # scaffold a runnable starter
```

If `molen` is on your PATH (via the `bin`), drop the `node packages/tooling/dist/cli.mjs` prefix.

## The truth rule (important)

- **`docs/`** is the original **DESIGN PLAN**: historical, not maintained, and it may lag the code
  (see [docs/README.md](docs/README.md)). Treat it as intent, not fact.
- **`docs-src/`** (shipped docs bundle) and **`packages/`** (the implementation) are the
  **shipped truth**. When they disagree with `docs/`, trust `docs-src/` + `packages/`.
- `search_docs` / `molen docs search` default to `docs-src/` only; pass `--design` to also search
  `docs/` (those hits are tagged `[DESIGN PLAN]`).

## Names

- **Molen** is the engine and product name.
- `molen` is the private root package name, the CLI executable (shipped as the `molen` bin of
  `@bendyline/molen-tooling`), and the serialized format namespace (`"format": "molen/<kind>@n"`).
- `@bendyline/molen-*` is the npm scope for every published package (`@bendyline/molen-<name>`,
  e.g. `@bendyline/molen-kernel`). It is the real scope, not a placeholder — never introduce a
  second scope or an unscoped package name.
- Private workspace members use the same shape: `@bendyline/molen-examples-<name>` for the demos,
  `@bendyline/molen-docs-site` for the site.

## The headless loop (the inner dev loop)

```sh
molen validate scene.json                                  # cheap; do it constantly
molen sim run scene.json --ticks 30 --setup ./setup.mjs --commands cmds.json --assert checks.json --hash
molen shot scene.json --ticks 30 --camera 0,6,16 --look 0,0,0 --out shot.png
molen replay demo.replay.json --setup ./setup.mjs         # localizes divergence on mismatch
```

Discover the surface without reading source:
`molen describe`, `molen schema list|get <kind>`, `molen components`, `molen component <name>`.
The MCP server exposes the same operations as tools (`molen mcp`); see llms.txt for the list.

## Authoring an experience

- **Data**: a `scene.json` (`molen/scene@3`) with `prefabs` + `entities`, the `commands` the
  scene accepts (optionally with JSON Schema payloads), custom `components` it declares, and
  `camera` / `input` / `physics` / `terrain` blocks the runtime consumes — entities may
  instantiate project-registry types from `molen/types@1` docs bound by a `project.json` (see
  docs-src/guide/project.md). Components are validated against a known vocabulary —
  `molen components` lists it; typos get did-you-mean, near-miss custom names get a notice.
- **Logic** (see scripting.md): **scene-data `scripts`** in the manifest (`code` inline or
  `path` file refs) — deterministic, no build step. Scripts handle input with
  `molen.onCommand`, so a complete game is data + scripts. A **`setup.mjs`** (or a
  `defineExperience({...})` result) adds ECS systems in other phases and typed authoring; set
  `"setup"` in project.json and every op picks it up.
- **Browser**: the same manifest runs in a Worker (`buildWorld` installs its scripts) and the
  page mounts on it with `await mountExperience` (docs-src/guide/browser-mount.md). Every client
  factory is async because it picks a graphics backend — `backend` defaults to `'auto'` (WebGPU,
  falling back to WebGL); capture paths pin `backend: 'webgl'`.
- **Scripts are TypeScript and type-checked**: author `scripts/*.ts`; types are erased where the
  scene is loaded (whitespace-preserving, so error line numbers still match the file) — the
  tooling loader in Node, `molenScripts()` from `@bendyline/molen-client/vite` in the browser.
  `molen types gen` writes `molen-scripts.d.ts` + `tsconfig.json` beside each scripts directory
  (component names, entity ids, command payloads, `config`) and `molen scripts check` checks the
  scripts against them, so a component typo or a bad payload is an error before the first tick.
  Only erasable syntax is allowed (no enums/namespaces/parameter properties); `.js` still works.
- Determinism is the headline guarantee: route randomness through `molen.rng` / the world RNG and
  math through `molen.math` (dmath). The script Compartment has no `Math.random` and shadows
  `Date`/`Intl`/`Promise`, so a script cannot break determinism by accident.
- **Scripts are not sandboxed from the host.** A script runs with the authority of the process
  that evaluates it, and the CLI and MCP server evaluate a manifest's scripts **in-process**:
  treat a `scene.json` like source code and only run manifests you would run as a program. The
  Compartment and its tamed endowments buy determinism, not containment — intrinsics are shared
  and mutable, and the host global is one expression away. A kernel-only host (a Worker, a
  dedicated Node process) can opt into the real boundary with `hardenScripts()` from
  `@bendyline/molen-kernel`; see the "Script trust" section of
  [docs-src/guide/scripting.md](docs-src/guide/scripting.md).
- Reads are immutable: `world.get` / `molen.get` return the stored object (frozen in dev). Never
  mutate what you read; `set`/`patch` install a new object.

## Git is the owner's (hands off)

Models and agents do **not** perform git operations in this repo. No `git commit`, `add`,
`stash`, `checkout`/`switch`, `branch`, `reset`, `rebase`, `merge`, `push`, `worktree`, tag, or
history rewriting — and no PR creation. Git semantics (branching, commit boundaries, messages,
merging, releases) are managed by the owner. Read-only inspection (`git status`, `git diff`,
`git log`, `git show`) is fine. Leave your work in the working tree and say what changed.

## Build invariant & conventions

- **Build before typecheck/test**: packages consume each other's `dist`. The root scripts encode
  this (`pretypecheck`/`pretest:unit` run `pnpm -r build`); run `pnpm typecheck`, `pnpm test:unit`
  from the root, or `pnpm -r build` first if invoking `tsc`/`vitest` in a package directly.
- **Agents run exactly what CI runs**: `pnpm verify` (lint, typecheck, source and docs checks,
  test:unit, production audit), then `pnpm smoke:packed` (the release tarballs installed with npm
  into a fresh project), `pnpm docs:site:check` and `pnpm test:golden`. `pnpm all` is all of it in order, and
  `verify` is also the Release workflow's gate, so a green `pnpm all` means a release will not
  fail on a check you could have run yourself. `pnpm docs:gen` regenerates `docs-src/schemas/*.md` (including
  components.md) from the registry; `pnpm docs:site:gen` regenerates the public site in
  [docs-site/](docs-site/README.md) — API reference from the built `.d.mts`, CLI/MCP reference
  from `OPS_CATALOG`, sample pages from `examples/`. Preview it with `pnpm docs:site:dev`.
- **ESM-only, Node ≥ 22.13.** Subpath exports matter: `@bendyline/molen-kernel` also exposes
  `/testing`, `/kinematics`, `/character`, `/scripting`, `/terrain`, `/platformer`,
  `/determinism`, `/content`, `/vehicles`, `/aircraft`, `/world`; `@bendyline/molen-client`
  also exposes `/camera-track`, `/vite`, `/vehicles`, `/aircraft`, `/navigation`, `/markers`;
  `@bendyline/molen-terrain` and `@bendyline/molen-figures` expose only `/kernel` and `/client`
  (no `.`).
- **Content lives in `content/`, not in packages.** Each `content/<pack>/` directory builds into
  one content pack (`molen pack build content/<pack>`). CLI ops find packs through the project's
  `packs`, `MOLEN_PACKS`, or a worldgen op's `--pack`; see [content/README.md](content/README.md).

See [CONVENTIONS.md](CONVENTIONS.md) for the full convention list.
