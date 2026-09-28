# Repository asset packs

Full-detail GLB models are distributed as GitHub release attachments. Git stores their
generators, source descriptions, sidecars, shared materials, licenses, placement catalogs and
review evidence, plus the root `asset-lock.json`. Restoring a snapshot recreates each GLB at its
original path with its original bytes. Asset IDs, source hashes and visual review bindings stay
valid; there is no mesh simplification, texture recompression or Git LFS dependency.

## Restore a checkout

From the engine repository, with Node 22.13 or newer:

```sh
pnpm install --frozen-lockfile
pnpm assets:fetch
pnpm assets:check
pnpm build
```

The checked-in manifest pins an immutable `assets-<snapshot>` release, archive hashes, individual
file hashes, sizes and destinations. Public downloads require no GitHub login. Fetching skips
files that already match, validates downloads and archive members before installation, and
refuses to overwrite modified local GLBs. `--force` explicitly restores the pinned versions.
Missing archives are downloaded into the ignored `.artifacts/asset-packs/` cache. Cached
archives are checked again before use. Download or integrity failures leave local models intact
and can be retried with the same command.

```sh
pnpm assets:fetch --offline
pnpm assets:fetch --prefix content/worldgen/assets/places/c2/
pnpm assets:fetch --archive-dir /path/to/downloaded-release-archives --offline
```

Selective fetching is useful for model work; the complete repository checks and site builds
need the full snapshot. `pnpm all` and the root `pnpm dev` restore it automatically. CI, release
and golden-image workflows restore it before building and cache the compressed archives.
`pnpm verify` checks hashes and newly added GLBs without making network requests for assets.
Allow disk space for the expanded models, compressed archives and one temporary archive's
selected files during restoration. The manifest's file sizes give the exact expanded total.

## Publish changed models

1. Author/import models through the normal model workflow and update their source manifests,
   sidecars, placement records and visual evidence. Keep the GLBs locally.
2. Run `pnpm assets:pack`. It discovers GLBs under `content/`, `assets/` and `examples/`, excluding
   dependency, build, cache and generated pack directories. It groups models by content role
   and geohash2, with a 256 MiB source-byte target per archive; a larger individual model gets
   its own archive, up to 1 GiB. Source masters and imported models are both included.
3. Review the changed `asset-lock.json` and run `pnpm verify`. Packing writes standard `.tar.gz`
   files, license notices and a copy of the manifest under `.artifacts/asset-packs/`. Every
   archive is read back and every member hash checked. Existing matching archives are reused.
4. The owner publishes the snapshot using GitHub CLI credentials with release write access:

   ```sh
   pnpm assets:publish --target <existing-GitHub-commit-SHA>
   ```

   This creates a separate draft asset release, uploads and verifies every attachment using
   GitHub's reported SHA-256 digest, then publishes it without making it the latest code release.
   Interrupted uploads can be rerun; identical attachments are skipped, and differing or
   unverifiable attachments are rejected. Published snapshots are never overwritten.
   The target must be the full SHA of an existing public repository commit. The release notes
   explain that the attached manifest identifies the asset snapshot, including model work that
   may await the owner's next source commit; the tag is not a new engine version.
5. Confirm a clean destination restores the published snapshot, then commit the updated
   manifest and authored text/image changes. Publish before the source commit so fresh clones
   and CI can fetch the newly pinned URLs. Do not commit the archives or GLBs.

Packing refuses to silently omit a file from the prior manifest when it is missing locally.
Restore it first, or pass `pnpm assets:pack --allow-removed` after intentionally deleting a model
and removing its registrations. A model change produces a new snapshot/release; retain older
releases so historical source commits remain reproducible. Asset releases are independent of
the existing npm/semantic-release workflow.

## Archive filenames

New releases use readable attachment names:

| Example | Contents |
| --- | --- |
| `worldgen-models-c2-part-001.tar.gz` | Imported landmarks in geohash2 cell `c2`, first part |
| `worldgen-sources-c2-part-001.tar.gz` | Source masters in the same cell |
| `worldgen-reusable-models-part-001.tar.gz` | Reusable structures without a fixed geographic location |
| `entities-models-part-001.tar.gz` | Imported entity models |
| `lantern-dungeon-sources-part-001.tar.gz` | The example's source masters |

The two-character code is a geohash2 cell, which can span multiple cities or countries.
Part numbers start at `001` and split a group to meet the archive size budget. They may change
when the group's contents change; use the manifest to locate a particular model.

Full SHA-256 checksums remain in `asset-lock.json`. The pinned release identifies the snapshot,
so the public filename does not need a checksum suffix. The local cache uses
`.artifacts/asset-packs/<sha256>/<filename>` to keep different releases with identical names
separate. The publisher uploads just the readable filename.

Previously published hash-suffixed filenames and flat caches still work. A directory of manually
downloaded attachments also works with `--archive-dir`; every archive must match the selected
manifest's checksum. Packing an unchanged older snapshot reuses matching archive bytes under
the new naming scheme. Existing published releases are not renamed.

## One-time Git tracking migration

`.gitignore` prevents new GLBs being added, but cannot untrack existing entries. After the first
release and restoration have been verified, the repository owner removes GLBs from the index
while preserving the local files:

```sh
git rm --cached --ignore-unmatch -- '*.glb'
```

Review that staged change together with `asset-lock.json`, scripts, documentation and CI changes,
then commit through the usual owner workflow. Agents do not modify the Git index under this
repository's `AGENTS.md` policy. If an oversized GLB was already committed in unpublished history,
the owner must also remove that blob from those unpublished commits; a later deletion or an
ignore rule does not bypass GitHub's per-file history limit.

## Runtime delivery

These tarballs restore repository build inputs. Applications continue to use the existing
`molen/pack@1` content packs and geographic model archives published with the site. Runtime
model references, regional loading and GPU unloading are unchanged. A browser does not fetch
the entire repository snapshot. Source GLBs remain excluded from runtime content packs.

The repository publisher uses streaming tar/gzip and the downloader rejects unexpected files,
links, unsafe destinations, mismatched lengths and hashes. Archive paths are never taken from
unverified downloads. `pnpm assets:test` exercises roundtrips, selective downloads, caching,
modified-file protection and malformed inputs.
