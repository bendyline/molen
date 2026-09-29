# Repository GLBs

Every GLB in this repository is a build output of checked-in source, except five small authored
masters. Git holds the generators, their specs, shared materials and textures, sidecars and
review evidence. `asset-lock.json` pins the exact bytes the source builds to, on any machine. The
Assets workflow builds them from a clean checkout, requires those bytes, and publishes them as a
GitHub release that `pnpm assets:fetch` downloads as a cache. Building and fetching produce
identical files.

## How the pieces fit

| Stage | Input in Git | Output (ignored by Git) |
| --- | --- | --- |
| Generate | The programs in [`asset-build.json`](../asset-build.json), plus the specs, material graphs and textures they read | `models/source.glb` in each source bundle, and a few direct runtime models |
| Import | Each bundle's `source.json` model entry (`pipeline`, sidecar `output`) and optional `spec.json` `importOptions`, then the `afterImport` scripts in `asset-build.json` that derive reports from the imported models | The runtime `model.glb` beside each `asset.json` sidecar |
| Verify | `asset-lock.json` | Nothing; any byte difference fails the build |

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
one you built yourself unless you pass `--force`. `--offline` uses only the local cache in
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

## Change a model

1. Edit the generator, spec, material graph or texture. Iterate with the bundle's own command,
   for example `node packages/worldgen/scripts/generate-stadium-models.mjs --ids=N0692`.
2. Run `pnpm assets:build --update-lock`. It regenerates, re-imports and rewrites
   `asset-lock.json` for whatever the source now produces.
3. Review the diff: generator code, regenerated metadata (`source.json`, `spec.json`, sidecars,
   README), and the lock entries that changed. Commit them together. Never commit a built GLB,
   and there is nothing to upload.
4. On the pull request, the Assets workflow rebuilds from source and fails unless every byte
   matches the committed lock. The other workflows build from source too, because the new
   snapshot is not published yet. After the merge, Assets on `main` publishes it.

Instead of step 2, the Update asset lock workflow can run the build on GitHub's runner and commit
the lock and metadata to the branch (Actions, or `gh workflow run update-asset-lock.yml --ref
<branch>`). A push made with the workflow's token starts no workflows, so the pull request's
checks run on your next push.

To add a generator, append it to `generators` in `asset-build.json`. Every GLB the build produces
must be in the lock, and every locked GLB must be produced. A GLB that is neither locked nor a
listed master fails `pnpm assets:check`.

Generators also rewrite their JSON and Markdown metadata. A plain `pnpm assets:build` keeps
every committed file as it was and lists the ones the generators would change; CI annotates
them. A lock update accepts real changes. Either way, a file whose content is unchanged keeps
its committed bytes even if a generator lays it out differently, because review evidence pins
some of these files byte for byte.

## Determinism

The lock only works if every machine builds the same bytes, so generators must be
deterministic:

- No clocks, unseeded randomness or locale-dependent formatting.
- Iterate in a stable order.
- Don't hash files whose bytes vary by checkout. A Windows `core.autocrlf` working tree reads
  text files with CRLF.
- Hash only what a model depends on. Hashing an entire shared evidence file makes every model
  that cites it stale whenever any entry changes.
- Node's transcendental `Math` functions are C++: fdlibm, and the C library's `pow`. They round
  differently on arm64, where the compiler fuses multiply-adds (about 0.1-0.6% of results differ
  from x64 in the last bit), and `pow` differs between C libraries. That changed dozens of
  models, mostly through near-zero coordinates and UV projection ties. Every Node process an
  asset build starts therefore runs with
  `packages/worldgen/scripts/install-deterministic-math.mjs`, which replaces those functions with
  pure-JS ports in `deterministic-math.mjs`: V8's fdlibm expression for expression and glibc's
  `pow`, which return x64's results on any CPU. Worldgen generators also import it first, so a
  direct run matches the build. Test a change to the ports on arm64 and x64 before relying on it.
- The `**` operator calls the C library directly, and nothing can replace it. In generators,
  write `Math.pow` for any exponent other than 2 or 0.5, which V8 computes exactly. Biome's
  `useExponentiationOperator` is off for generator code, and a worldgen test rejects other `**`
  exponents there.
- Asset builds are also pinned to the Node major in `asset-build.json` (`"node": "24"`) and
  refuse to run on another one, so a V8 or three.js change arrives as a deliberate upgrade.
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
