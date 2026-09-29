# Geographic model bundles

[Browse the model gallery](gallery.html) or resolve a stable source key using the
[source index](../structure-index.json). Named landmarks live in standard WGS84 geohash
folders, with a two-character region and three-character cell:

```text
content/worldgen/source/
  places/
    sr/srs/n0001_stari_most/
      spec.json
      models/source.glb
      source.json
      scene.json
      preview.png
      shots/
      ...review and capture reports
    c2/c22/space-needle/
    c2/c23/sr-520-floating-bridge/
    9q/9q8/golden-gate-bridge/
  reusable/
    urban/d01_curtainwall_office_slab/
    infrastructure/...
  map-structures/                 # Map-tag-driven windmills and turbines
  structures/                     # Resizable procedural building styles
  material-library/               # Shared surface authoring and audit
  structure-index.json
```

Both the editable model and its previews, textures, map frame and review reports stay together.
Imported runtime bundles mirror this organization under `content/worldgen/assets/`:

```text
assets/
  places/6g/6gy/n0148_edificio_altino_arantes/
    asset.json
    model.glb
  places/9q/9q8/golden-gate-bridge/
  reusable/urban/d01_curtainwall_office_slab/
  reusable/infrastructure/...
  reusable/map-structures/...
```

The existing leaf keys and runtime asset IDs remain stable. `project.json` and `stylepack.json`
map those IDs to their bundle sidecars; consumers resolve each model relative to its sidecar.
The world viewer's geographic query, loading and unloading use
`content/earth/structures/placements.json`, independently of these source folders.

## Geographic meaning

Geohash3 is an organizational cell, not a surveyed footprint. Long bridges can cross its
boundary; their complete bundle stays under the cell containing the recorded anchor.
`structure-index.json` records the anchor's basis: source map frame, placement record, or
research reference. Legacy landmark references are recorded with source URLs and identity notes
in [folder-location-evidence.json](../folder-location-evidence.json). A folder does not approve a model's scale, heading, current-world
eligibility or placement. Those remain in the existing review evidence and readiness ledger.

The encoding uses the same standard alphabet and coordinate system as Qualla. Qualla's
current data uses four characters nested individually; Molen groups the first two and then
the first three for convenient browsing. The helper's argument order is `(longitude, latitude)`;
Qualla's geohash API accepts `(latitude, longitude)`.

Future named models without a recorded coordinate start explicitly `unlocated`. Reusable
urban/infrastructure models have semantic folders; they do not inherit a location from one
example placement. Existing map-structure models and procedural styles retain their own
semantic directories. Collection members have independent bundles and coordinates.

## Authoring and maintenance

Use `structureSourceDirectory(key)` or `structureSourcePath(key, ...segments)` from
`packages/worldgen/scripts/structure-source-paths.mjs` in authoring, capture and evidence tools.
Use `structureAssetDirectory(assetId)` and `structureAssetSidecarPath(assetId)` from
`packages/worldgen/scripts/structure-asset-paths.mjs` for runtime imports and manifests.
Importers pass `assetDir` (CLI `--asset-dir`) to select the exact bundle directory. Ordinary
reimports with a registered project preserve its existing sidecar path; `--out-dir` explicitly
requests the generic ID-based layout and should not be used for these structure bundles.
Existing registered paths stay pinned if a later map refinement crosses a cell boundary.
New candidate or collection-member keys use recorded research coordinates as an initial
folder proposal; other new keys start in `places/unlocated`.

After adding a bundle, refresh the source registry before importing or capturing it:

```sh
node packages/worldgen/scripts/index-structure-sources.mjs
node packages/worldgen/scripts/index-structure-sources.mjs --check
node packages/worldgen/scripts/validate-structure-asset-paths.mjs
node packages/worldgen/scripts/build-place-gallery.mjs
```

The worldgen build checks registry freshness, matching source/runtime registrations, missing
files and duplicate or legacy runtime bundles. Discovery tools reject an unregistered bundle
with the refresh command rather than omitting it silently. For a deliberate relocation, move
the source and runtime bundles and update `sourcePath`, organizational anchor, geohashes,
project/stylepack registration and `source.json` output together; then refresh and check the
index. Never edit a capture or QA report merely to relocate files.

The [next-1,000 catalog](../next-1000/README.md) and [original structure catalog](../site-structures/README.md)
remain as planning/history views, with links to these canonical sources. Their names do not
determine storage or runtime identity.

## September 2026 migration

321 existing folders were moved: 220 authored next-catalog models, one research-only draft,
60 named original structures and 40 reusable original models. Together with the two existing
map-structure models, the index covers 323 bundles. A follow-up resolved organizational anchors
for all 47 remaining legacy landmarks and moved all 322 imported structure bundles: 280 named
models in geographic cells and 42 reusable models in semantic folders. The extra source entry
is a research-only draft. Geometry, images, sidecars, material references and hash-bound review
evidence were retained; creation remains paused for the results review.

Registry-based discovery also recovered three already-existing models whose current asset IDs
differed from old research aliases (N0654, N0681 and N0682). This corrects the inventory count;
it is not a new modeling batch.
