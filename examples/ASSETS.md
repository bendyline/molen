# Editable assets and ready-to-run games

The game examples keep **both editing masters and optimized runtime assets** in the repo.
This is deliberate: a new checkout can open a model in a 3D editor and run the game without
first installing art tools or regenerating assets.

## Play and build

After `pnpm install`, launch from the repository root:

```sh
pnpm dev:driving
pnpm dev:dungeon
pnpm dev:platformer
```

Choose one command. Each game's `predev` builds its engine dependencies automatically, then
Vite serves its existing main page. Asset generation, Python/Pillow, external art services and
asset downloads are not part of startup. The primitive art in City Courier and Skybound is
already editable in `scene.json`; it needs no extra binary files.

For deployment, `pnpm -r build` builds the packages and games. Serve a game's `dist/` directory
over HTTP, or run its `preview` script. These three games use relative build URLs, so the same
build can be hosted at `/` or beneath a directory such as `/games/lantern-dungeon/`. The HTML,
JS and Workers are compiled normally; `dist/` stays ignored. Opening the source `index.html`
as `file://` is not a supported launch path for ES modules and Workers.

## Storage contract

The Lantern Vault demonstrates the model layout:

```text
scene.json, scripts/                       editable level, entities and game rules
asset-src/<category>/<thing>/source.json   portable logical-source manifest
asset-src/<category>/<thing>/metadata.json per-thing authoring metadata
asset-src/<category>/<thing>/models/       editable model masters
asset-src/shared/textures/                 collection-wide image/PBR sources
asset-src/catalog.json                     generated compatibility index
asset-src/import-report.json               actual editing-master and runtime hashes
asset-src/README.md, CATALOG.md             provenance, editing instructions and previews
tools/                                     optional generation, import and QA tools
public/assets/<asset-id>/model.glb          optimized, self-contained runtime copy (kept)
public/assets/<asset-id>/asset.json         importer-generated metadata (kept)
project.json                               stable IDs pointing to runtime sidecars
dist/                                      disposable app build, including copied public assets
.tmp/, .artifacts/                         disposable exports and QA output
```

Keep native authoring documents (`.blend`, layered images, etc.) when they are available.
A GLB supplied by an artist or service is an original even if there is no generator. Keep
originals out of `public/`; only runtime assets need to be copied into a web deployment.
Do not replace an editing master with the quantized runtime model to save a second copy.

## Edit the Lantern Vault

After the normal engine build, choose the relevant authoring path:

- **3D editor:** edit a GLB under `asset-src/<category>/<thing>/models/`, export it back there, then run
  `pnpm --filter @bendyline/molen-examples-lantern-dungeon assets:import`.
  The importer records the actual edited file's hash and marks `sourceEdited` in the report.
  It never regenerates the editing master.
- **Generator:** edit `tools/generate-assets.py` or the original stone bitmap, then run
  `assets:generate` followed by `assets:import` in that package. Generation checks the entire
  collection before writing. It preserves hand-edited models and maps and fails with no output
  changes if it would overwrite them. Use `assets:generate --out-dir .tmp/generated-art` for a
  separate review export, then deliberately copy back the files you intend to replace.
- **Texture editor:** retain the originals and editable maps. Re-export the affected GLB with
  its new embedded textures, or regenerate it from its authoring source before importing.

Use `assets:verify` to check current masters, published hashes, IDs and browser paths with
Node alone. Use `assets:verify --built dist` after building to verify the deployment copies too.
A stale or missing runtime asset fails the check with an actionable error. This verification
also runs in the dungeon unit/browser tests.

`assets:check` is a separate Python authoring check: it compares the masters with the generator's
current output. It can intentionally fail after a hand edit even when `assets:verify` passes.
The game and normal Node CI checks accept a correctly imported hand-edited master.
