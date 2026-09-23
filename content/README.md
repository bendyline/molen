# Content

Molen's npm packages carry code, schemas and types. Everything else ships as content packs:
`molen/pack@1` zip files with a manifest, which an app hosts wherever it likes (its own domain,
inside an Electron app, as bytes in its bundle, or a file the user picks) and opens with
`@bendyline/molen-pack`.

Each directory here is the source of one pack. Its `molen-pack.source.json` names the pack, its
license, which files go in, and which roles it `provides`.

| Directory | Pack id | What it carries |
| --- | --- | --- |
| [entities/](entities/) | `molen.entities` | Entity type documents (trees, boulder, aircraft, vehicles), their generated scripts, and glTF models with `molen/asset@1` sidecars |
| [worldgen/](worldgen/) | `molen.worldgen.default` | The default style pack: archstyles, material graphs, scatter rules, props, landmarks, and the structure catalog |
| [earth/](earth/) | `molen.earth` | The region atlas and the business identity catalog |
| [sky/](sky/) | `molen.sky` | The Bright Star Catalogue as `molen/stars@1` binary columns |

Authoring sources (`worldgen/source/`, `entities/source/`), fixtures and the entities authoring
project sit beside the files they generate but are excluded from the packs.

## Build, inspect, verify

```sh
molen pack build content/worldgen --out-dir dist-packs   # same content, same bytes
molen pack inspect dist-packs/molen.worldgen.default-<hash>.zip
molen pack verify dist-packs/molen.worldgen.default-<hash>.zip
```

The world explorer builds all four into `examples/world-explorer/public/packs/` (with an
`index.json`) before `dev` and `build`.

## Using packs from the CLI

Ops that need content find packs in this order: the project's `project.json` `packs` list
(a relative path or an `https://` URL, optionally pinned by `contentHash`), then `MOLEN_PACKS`
(paths or URLs, separated like `PATH`). The worldgen commands also take `--pack`. URL packs are
downloaded once into `MOLEN_CACHE_DIR` (default `~/.cache/molen/packs`); `MOLEN_OFFLINE=1` never
fetches.

```sh
MOLEN_PACKS=content/worldgen:content/earth molen worldgen preview --out preview.png
```

## Regenerating

- `node packages/entities/scripts/generate-models.mjs` writes `entities/assets/` and
  `entities/types/`.
- `node packages/worldgen/scripts/generate-structures.mjs` and the other `generate-*.mjs` scripts
  there write `worldgen/`.
- `node packages/client/scripts/generate-star-catalog.mjs <catalog.gz>` writes `sky/stars.bin` from
  the CDS Bright Star Catalogue download.
