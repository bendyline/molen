# Repository GLBs

Every GLB in this repository is a build output of checked-in source, except five small authored
masters. Git holds the generators, their specs, shared materials and textures, sidecars and
review evidence. `asset-lock.json` pins the exact bytes the source builds to on Linux x64, and
only the Update asset lock workflow writes it. The Assets workflow builds them from a clean
checkout, requires those bytes, and publishes them as a GitHub release that `pnpm assets:fetch`
downloads as a cache. On Linux x64, building and fetching produce identical files.

## How the pieces fit

| Stage | Input in Git | Output (ignored by Git) |
| --- | --- | --- |
| Generate | The programs in [`asset-build.json`](../asset-build.json), plus the specs, material graphs and textures they read | `models/source.glb` in each source bundle, and a few direct runtime models |
| Import | Each bundle's `source.json` model entry (`pipeline`, sidecar `output`) and optional `spec.json` `importOptions`, then the `afterImport` scripts in `asset-build.json` that derive reports from the imported models | The runtime `model.glb` beside each `asset.json` sidecar |
| Verify | `asset-lock.json` | Nothing; any byte difference fails a Linux x64 build and is reported elsewhere |

The generators are the source of truth. Most live in `packages/worldgen/scripts/` (landmarks,
bridges, stadiums, towers, lighthouses, props). The others are the aircraft recipes in
`content/entities/source/aircraft/*/models/generate.mjs`,
`packages/entities/scripts/generate-json-models.mjs` (trees and the boulder, from each bundle's
`models/model.json`), the red barn's `scripts/generate-barn.mjs`, and Lantern Dungeon's
`tools/generate-assets.py`. Each source bundle's README names the command that regenerates it.

The five vehicle `source.glb` files are listed as `masters` in `asset-build.json`. No generator
for them survives, so the committed binary is their source (about 125 KB each). Their runtime
models are still imported by the build. Prefer a generator for anything new.

`asset-lock.json` (`molen/asset-lock@2`) lists the path, size and SHA-256 of every built GLB.
Its release name, `assets-<16 hex>`, is derived from those entries alone, so a lock can be
committed before its release exists.

## Get the GLBs

In the engine repository, with Node 22.13 or newer:

```sh
pnpm install --frozen-lockfile
pnpm assets:fetch     # download the release the lock names, or build from source if it is not published
pnpm build
```

`pnpm assets:fetch` checks every archive and every restored file against the committed lock. It
skips files that already match. It replaces a GLB it installed earlier, but refuses to overwrite
one you built yourself unless you pass `--force`. A GLB that `pnpm assets:build` wrote for the
current lock counts as installed once the lock changes; until then fetch keeps it, even where it
differs from the pinned bytes, as it does off Linux x64. `--offline` uses only the local cache in
`.artifacts/asset-packs/`, and `--prefix content/worldgen/assets/places/c2/` restores part of the
tree. `pnpm all` and `pnpm dev` fetch automatically.

To build everything from source instead, with no network access for models (Node 24, the major
`asset-build.json` pins):

```sh
pnpm assets:build
```

This compiles the packages if needed, moves the previous generated GLBs aside, runs every
generator, imports every model, and compares all of it with the lock. The Lantern Dungeon
generator needs Python 3.10+ with `pip install -r examples/lantern-dungeon/tools/requirements.txt`.
The build runs `$PYTHON` (default `python3`, or `python` on Windows) and checks its version and
pinned packages before any generator starts.
A full build takes a few minutes on a workstation and writes about 18 GB. The report and one log
per generator are in `.artifacts/asset-build/`.

Only a Linux x64 build is held to the lock. Other hosts round some generator math differently
(macOS arm64 builds several dozen models to other bytes), so there `pnpm assets:build` lists the
GLBs that differ from the lock and still succeeds. Their output is fine for iterating, and the
Assets workflow does the checking.

## Change a model

1. Edit the generator, spec, material graph or texture. Iterate with the bundle's own command,
   for example `node packages/worldgen/scripts/generate-stadium-models.mjs --ids=N0692`.
2. Commit the source change and push the branch.
3. Run the Update asset lock workflow on the branch (Actions, or
   `gh workflow run update-asset-lock.yml --ref <branch>`). On Linux x64 it regenerates,
   re-imports, rewrites `asset-lock.json` for whatever the source now produces, and commits the
   lock with the regenerated metadata (`source.json`, `spec.json`, sidecars, README). Pull that
   commit and review it with your change. Never commit a built GLB, and there is nothing to
   upload. On a Linux x64 machine, `pnpm assets:build --update-lock` does the same locally; on
   any other host it refuses to run.
4. On the pull request, the Assets workflow rebuilds from source and fails unless every byte
   matches the committed lock. A push made with the workflow's token starts no workflows, so the
   checks run on your next push. The other workflows build from source too, because the new
   snapshot is not published yet. After the merge, Assets on `main` publishes it.

To add a generator, append it to `generators` in `asset-build.json`. Every GLB the build produces
must be in the lock, and every locked GLB must be produced. A GLB that is neither locked nor a
listed master fails `pnpm assets:check`.

Generators also rewrite their JSON and Markdown metadata. A plain `pnpm assets:build` keeps
every committed file as it was and lists the ones the generators would change; CI annotates
them. A lock update accepts real changes. Either way, a file whose content is unchanged keeps
its committed bytes even if a generator lays it out differently, because review evidence pins
some of these files byte for byte.

## Determinism

The lock is written and checked on Linux x64, so generators must be deterministic there, run to
run and across runner-image updates. Matching bytes on other hosts is what keeps their local
builds quiet. Each rule below removes one source of differences:

- No clocks, unseeded randomness or locale-dependent formatting.
- Iterate in a stable order.
- Don't hash files whose bytes vary by checkout. A Windows `core.autocrlf` working tree reads
  text files with CRLF.
- Hash only what a model depends on. Hashing an entire shared evidence file makes every model
  that cites it stale whenever any entry changes.
- Node's `**` and `Math.pow` round differently on Windows and Linux builds, even for integer
  exponents, and between Node majors; its other `Math` functions agree. In generators, multiply
  for squares and use `pow` from `packages/worldgen/scripts/deterministic-math.mjs` for anything
  else. three.js's color management uses `Math.pow` internally, so asset builds are pinned to
  the Node major in `asset-build.json` (`"node": "24"`) and refuse to run on another one.
- Values that should be exactly 0 (`sin(Math.PI)`, a tube's frame along an axis) come out as
  ~1e-16 noise whose last bits differ by platform. float32 rounds that noise away from a normal
  value but keeps a tiny one whole, so it reaches the GLB. Clear near-zero vertex data before
  export, as the OH-6 generator's `settleZeros` does.
- Python's `math` is the C library's, whose results can differ in the last bit. Derive stored
  data (normals, UVs) from the float32 values the GLB will hold, as Lantern Dungeon's generator
  does.
- Don't re-encode images during a build: PNG compression depends on the platform's zlib. Commit
  derived textures and embed or reference their bytes. Lantern Dungeon re-derives its maps only
  with `--derive-textures`.

The Assets and Update asset lock workflows pin Node 24.18.0 and Python 3.12. When another workflow has to build from
source, it switches to Node 24 for the build only. Pillow is pinned by
`examples/lantern-dungeon/tools/requirements.txt`. If a runner-image update ever changes a byte,
the weekly scheduled run reports it before a model change is blamed for it.

## Shared materials and textures

Structures reference shared, procedural material graphs
(`content/worldgen/materials/*.matgraph.json`) through `extras.molenSurface` on their glTF
materials. The client bakes each graph once and shares it across every model that uses it, so
the landmark GLBs embed no textures beyond a few kilobyte-sized portable fallbacks. Model size
is geometry. The largest runtime models are single flattened meshes of millions of triangles,
and they would benefit from instancing repeated parts, meshopt compression and LODs.

Two sets still embed image textures. Each textured Lantern Dungeon model carries its own copy of
the shared limestone set from `asset-src/shared/textures/`. The red barn embeds its three
weathered-wood maps.

## Releases

The Assets workflow runs on every pull request, on `main`, weekly and on demand. On `main` it
runs `pnpm assets:publish --target <commit>`. That packs the built GLBs into `.tar.gz` archives
grouped by content role and geohash2 cell, about 256 MiB each. It uploads them with
`asset-manifest.json` and `ASSET-NOTICES.txt` to a draft release, checks every attachment's
digest, then publishes the release without marking it latest. A release that is already
published is left untouched, and older releases stay for older commits. The owner can run the
same command with GitHub CLI credentials that have release write access.

| Archive example | Contents |
| --- | --- |
| `worldgen-models-c2-part-001.tar.gz` | Imported landmarks in geohash2 cell `c2` |
| `worldgen-sources-c2-part-001.tar.gz` | Their generated source GLBs |
| `worldgen-reusable-models-part-001.tar.gz` | Reusable structures without a location |
| `entities-models-part-001.tar.gz` | Imported entity models |
| `lantern-dungeon-sources-part-001.tar.gz` | The example's generated source GLBs |

These archives restore repository build inputs. Applications use the `molen/pack@1` content
packs and geographic model archives published with the site; a browser never downloads a
repository snapshot.

## Git tracking

`.gitignore` ignores `*.glb` except the listed masters. GLBs committed before this layout stay in
the index until the owner removes them once, keeping the local files:

```sh
git ls-files -- '*.glb' | grep -v '^content/entities/source/vehicles/' | xargs git rm --cached --
```

Removing them from the index does not remove old blobs from history.
