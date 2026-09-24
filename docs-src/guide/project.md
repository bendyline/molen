# Projects, the type registry, and typed authoring

Loose scenes work for demos; real experiences need shared vocabulary. `molen/project@1` binds a
project together, and `molen/types@1` gives entity types stable, namespaced ids that multiple
agents can extend without collisions. `molen new <name>` scaffolds all of this.

## project.json (`molen/project@1`)

```json
{
  "format": "molen/project@1",
  "name": "rail-yard",
  "scenes": { "main": "scenes/main.scene.json" },
  "defaultScene": "main",
  "types": ["types/train.types.json"],
  "assets": {},
  "reservations": [{ "namespace": "train", "owner": "agent:layout" }],
  "setup": "setup.mjs",
  "codegen": { "out": "gen/molen-types.ts" }
}
```

Every op discovers the project by walking up from the scene/cwd (or takes `--project`), so
`molen sim run main --ticks 30` works by scene *name*. `molen project info` prints the summary.

## The type registry (`molen/types@1`)

A types document declares entity types under one dotted namespace: default components, doc
strings, single-inheritance `extends`, asset refs, and optional deterministic behavior scripts.
Scenes instantiate them:

```json
{ "entities": [ { "id": "engine-1", "type": "train.locomotive",
                  "components": { "transform": { "pos": [4, 0, 0] } } } ] }
```

Component precedence, lowest to highest: **type chain → scene prefab chain → the entity's own
components** (scene-local always beats project-level; an entity's `components` is a partial
layer whenever it has a `type` or `prefab`). `molen types list` shows the vocabulary;
`molen types check` validates duplicates, extends cycles, namespace ownership, and asset refs.

Type scripts use the same `code` or contained `path` form as scene scripts. They inherit
ancestor-first and are installed once per registered type before scene scripts. Molen injects the
concrete type id as `config.type`, so one reusable script can react only to instances of the type
whose behavior it defines. The project loaders inline file-backed type scripts before `buildWorld`;
the same trust and determinism rules as scene scripts apply.

## Content packs (`packs`)

Shared content (entity types and models, style packs, catalogs) is not in any npm package; it
comes in content packs, `molen/pack@1` zip files built with `molen pack build`. Molen's own packs
are published with each release at `https://molen.dev/packs/`, listed by a `molen/pack-index@1`
index:

| Pack | What it carries |
| --- | --- |
| `molen.entities` | Entity types and models: trees, a shrub, a boulder, aircraft and road vehicles ([entities](entities.md)) |
| `molen.worldgen.default` | The default style pack: archstyles, materials, scatter rules, landmarks, 120 structures ([worldgen](worldgen.md)) |
| `molen.earth` | The region atlas and the business identity catalog ([recognizable places](recognizable-places.md)) |
| `molen.sky` | The Bright Star Catalogue as `molen/stars@1` columns ([sky](sky.md)) |

```sh
npx molen pack fetch https://molen.dev/packs/index.json                  # all of them
npx molen pack fetch https://molen.dev/packs/index.json molen.entities   # just one
```

`pack fetch` downloads into `packs/` beside project.json and pins each pack's `contentHash` in
the project's `packs`, so the project keeps working offline and a later re-publish never changes
it underneath you. A browser app serves the same zips from wherever it hosts its static files.

A project lists the packs it uses, in order, and their types join the registry like the
project's own:

```json
{
  "format": "molen/project@1",
  "name": "rail-yard",
  "scenes": { "main": "scenes/main.scene.json" },
  "packs": [
    { "id": "molen.entities", "source": "vendor/molen.entities-3f2a9c1b04d7.zip" },
    { "id": "molen.worldgen.default", "source": "https://example.com/packs/molen.worldgen.default.zip",
      "contentHash": "sha256:…" }
  ]
}
```

A `source` is a path relative to project.json (a built pack or a pack source directory) or an
`https://` URL. `molen pack fetch <url>` downloads a pack and pins it with its `contentHash`; a pack
whose content does not match its pin is refused. URL packs are cached in `MOLEN_CACHE_DIR`
(default `~/.cache/molen/packs`) and fetched once; `MOLEN_OFFLINE=1` never fetches. `MOLEN_PACKS`
adds packs (paths or URLs, separated like `PATH`) after the project's. When two packs provide the
same id, the later one wins. `molen sim run --hash` prints which packs the types came from, and a
recorded replay keeps that identity (see [determinism](determinism.md)). A project with no
`packs` needs none: `molen new` scaffolds one that stands alone.

## Reservations (multi-agent vocabulary partitioning)

`reservations` in project.json assign dotted namespaces to owners. A reservation covers the
namespace and everything under it on dot boundaries (`train` covers `train.car`, not
`trainer.x`), for **both type ids and asset ids**. Reserve before you author:

```
molen types reserve train --owner agent:layout
```

Reservation is idempotent per owner; a conflicting claim errors and names the holder. Writes go
through a lockfile so concurrent agents serialize instead of clobbering project.json.

## Typed TS authoring (`molen types gen` + `defineExperience`)

`molen types gen` writes `gen/molen-types.ts` (checked in; `types check` flags staleness):
typed `C.*` component handles generated from the component registry, a `ComponentName`
string-literal union, and `T.*` type-id constants. Author gameplay against it:

```ts
import { defineExperience } from '@bendyline/molen-kernel';
import { C, T } from './gen/molen-types';

export default defineExperience({
  commands: {
    couple: (w, cmd) => { /* ... */ },
  },
  systems: [{ fn: (w) => { for (const [id, t] of w.query(C.transform)) { /* typed */ } } }],
});
```

Every setup loader (sim/shot/frames/replay) accepts a bare `setup` function or a
`defineExperience(...)` result. Pure-JSON projects skip codegen entirely — nothing at runtime
depends on the generated file.

## Custom component vocabulary

Components you invent for your scripts are accepted as-is; names that are merely close to a
core component (`team` vs `tag`) get an advisory notice, while a strong near-miss (`helth`,
`Transform`) is an error. Declare your vocabulary in project.json (shared by every scene) or in a
scene's `components` block to document it and, optionally, shape-check it with a JSON Schema:

```json
{ "components": {
    "team": { "description": "Team membership.", "examples": [{ "id": "red" }],
              "schema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] } },
    "score": { "description": "Points.", "examples": [{ "value": 0 }] } } }
```

Declared components appear in `molen components` and are validated wherever core components are.

## Format versions

Formats carry `molen/<kind>@N` envelopes. The engine is in beta: a format bump replaces the old
version outright (no migration path); `molen validate` says exactly which version it expects.


## Isolated component vocabularies

Validation is pure: validating or loading a scene does not change another scene's component
schemas. Each project/world carries its own registry, built on the installed capability schemas.
Project and scene declarations cannot override built-in component schemas. Unsupported declared
schemas are errors, rather than silently accepting arbitrary objects.

For SDK callers, `createComponentRegistry(declarations, { base, owner })` returns `{ registry,
issues }`; pass the registry to `validate(..., { registry, types })`, `buildWorld(..., ..., {
registry, types })`, or `new World({ registry })`. Check the returned issues before using a new
registry. `validate('scene', data, { types })` validates final type/prefab/entity merges. Without
external types it can validate local prefab merges, but type-dependent completeness requires
loading the project. Runtime construction validates the final merge after defaults; script
`patch` validates the actual shallow-merged replacement before writing it.

The CLI and MCP resolve component discovery per request. `molen components --project
project.json` lists the project vocabulary; `molen component score --scene main` also includes
scene declarations. Without explicit context, discovery finds the current project. MCP
`list_components` and `get_component` accept `projectPath` and `scenePath`. Synchronous SDK
`listComponentsOp` / `getComponentOp` accept an optional registry.

Package default factories are captured when a world is constructed. For project-specific defaults,
pass `defaults: { health: { hp: 20 } }` to `World` or `buildWorld`; values are detached from the
caller and override package defaults only in that world. Register capability components before
constructing worlds.
