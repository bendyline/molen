# Content

Molen's npm packages carry code, schemas and types. Everything else ships as content packs:
`molen/pack@1` zip files with a manifest, which an app hosts wherever it likes (its own domain,
inside an Electron app, as bytes in its bundle, or a file the user picks) and opens with
`@bendyline/molen-pack`.

Every release publishes these packs at `https://molen.dev/packs/` with a `molen/pack-index@1`
index (the docs site build stages them; see [docs-site/README.md](../docs-site/README.md)), so a
user of the npm packages runs `npx molen pack fetch https://molen.dev/packs/index.json` rather
than building them from this directory. That index carries the core packs only. Every pack,
including the worldgen pack's regional model archives (several GB of landmark models), is also an
asset of the rolling GitHub release `packs`
(`npx molen pack fetch https://github.com/bendyline/molen/releases/download/packs/index.json`,
written by `scripts/publish-pack-release.mjs` in the Release workflow), and is published unzipped
at `https://qualla.com/_a/index.json`, which molen.dev's samples read (GitHub's downloads send no
CORS headers). A style pack whose archives an index does not list falls back to procedural
buildings. `hostPacks` in `@bendyline/molen-pack/node` writes the unzipped layout.

Each directory here defines a logical pack. Its `molen-pack.source.json` names the pack, its
license, which files go in, and which roles it `provides`. Hosted worldgen content is divided
into a shared core and regional model archives while retaining that logical pack identity.

| Directory | Pack id | What it carries |
| --- | --- | --- |
| [entities/](entities/) | `molen.entities` | Entity type documents (trees, boulder, aircraft, vehicles), their generated scripts, and glTF models with `molen/asset@1` sidecars |
| [worldgen/](worldgen/) | `molen.worldgen.default` | The default style pack: archstyles, material graphs, scatter rules, props, landmarks, and the structure catalog |
| [earth/](earth/) | `molen.earth` | The region atlas and the business identity catalog |
| [sky/](sky/) | `molen.sky` | The Bright Star Catalogue as `molen/stars@1` binary columns |
| [sounds/](sounds/) | `molen.sounds` | 63 CC0 sounds and six music tracks behind a `molen/soundbank@1` bank; provenance in `sources.json` and `NOTICE.md` |

The worldgen authoring source also carries a [next 1,000 structure candidate catalog](worldgen/source/next-1000/README.md).
See its generated [progress report](worldgen/source/next-1000/PROGRESS.md) for current readiness
and the [structure gallery](worldgen/source/places/gallery.html) for registered model bundles.
Candidate metadata is excluded from the runtime pack.

Authoring sources (`worldgen/source/`, `entities/source/`), fixtures and the entities authoring
project sit beside the files they generate but are excluded from the packs.

GLB binaries in these folders are build outputs, ignored by Git. `pnpm assets:build` generates
and imports them from the checked-in generators, and `pnpm assets:fetch` downloads the identical
snapshot CI published for the repository's `asset-lock.json`. Generators, sidecars, shared
materials and review evidence stay in Git. That repository snapshot is separate from the
application-facing runtime packs described above. See [repository GLBs](ASSET-PACKS.md).

## Structure file organization

Named models are organized by two- and three-character geohashes. Their editable sources live
at `worldgen/source/places/<gh2>/<gh3>/<source-key>/`; their imported runtime sidecars, GLBs and
collision data live at `worldgen/assets/places/<gh2>/<gh3>/<source-key>/`. Legacy entries without
an organizational coordinate use `places/unlocated/<source-key>/` under the corresponding root.
These reference coordinates classify folders; placement approval remains in the Earth catalog
and each model's geographic review.

Reusable runtime bundles use `worldgen/assets/reusable/urban/<source-key>/`,
`worldgen/assets/reusable/infrastructure/<source-key>/`, or
`worldgen/assets/reusable/map-structures/<source-key>/`. Urban and infrastructure source bundles
use matching `source/reusable/` folders; generic mapped-feature sources use `source/map-structures/`.
Procedural architectural styles remain in `worldgen/styles/` and `worldgen/structures/`.

Folder changes preserve asset IDs such as `molen.worldgen.structure.space_needle`.
`worldgen/source/structure-index.json` locates source bundles, `worldgen/project.json` maps IDs
to runtime sidecars for authoring tools, and `worldgen/stylepack.json` provides those mappings
to pack consumers. Model URLs come from these registrations and the pack index, not from
turning an ID into a directory path. Repository scripts use `structure-source-paths.mjs` and
`structure-asset-paths.mjs` in `packages/worldgen/scripts/` to resolve both sides.

For a new custom layout, `molen asset import --asset-dir <exact-bundle-directory>` sets the
destination while retaining `--id`. Ordinary reimports with `--force` preserve the sidecar path
already registered in the project. Explicit `--out-dir` retains the legacy assets-root-plus-ID
layout and cannot be combined with `--asset-dir`. See the
[model import guide](../docs-src/guide/3d-model-assets.md) for the complete contract.

## Build, inspect, verify

```sh
molen pack build content/worldgen --out-dir dist-packs   # same content, same bytes
molen pack inspect dist-packs/molen.worldgen.default-<hash>.zip
molen pack verify dist-packs/molen.worldgen.default-<hash>.zip
```

The world explorer stages all five content libraries into `examples/world-explorer/public/packs/` (with an
`index.json`) before `dev` and `build`. It and the docs site use a small worldgen core plus
bounded geographic model archives. The core retains sidecars and style metadata; archive routes
load a model's archive on demand through the host's fetch function. Hosts need HTTP Range
support for selective network reads; a server returning a full-file response still works but
downloads that archive. The standalone `molen pack build` command above remains available for
a monolithic pack. See [Earth view hosting](../docs-src/guide/earth-view.md).

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
- `node content/sounds/tools/fetch.mjs` then `node content/sounds/tools/build.mjs` rebuild
  `sounds/audio/`, `sounds.soundbank.json` and `NOTICE.md` from `sounds/sources.json` (needs ffmpeg);
  see [sounds/README.md](sounds/README.md).
