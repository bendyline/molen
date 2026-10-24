# Placement sources

Each JSON file is one authoritative geographic placement. Its path is
`<geohash2>/<geohash3>/<placement-id>.json`, derived from its anchor. Preserve the stable ID
when editing or relocating it. Records retain complete notes, terrain/cutout bases and map
evidence; none of those explanations needs to be downloaded to render a region.

The migration from `structures/placements.json` retained all 975 records and their individual
`JSON.stringify(entry)` SHA-256 values. Existing review hashes therefore remain valid.
Property order and numeric precision in these files are intentional.

Use `readStructurePlacements()` and `writeStructurePlacement(entry)` from
`packages/worldgen-earth/scripts/placement-sources.mjs` for authoring tools. A write changes
only the selected source record (moving its file if the anchor changes cells). The local
`structures/placements/authoring.json` aggregate is generated for existing review fixtures;
it is neither authoritative nor included in a content pack.

After building the library packages, regenerate runtime data with:

```sh
node packages/worldgen-earth/scripts/build-placement-catalogs.mjs
node packages/worldgen-earth/scripts/build-placement-catalogs.mjs --check
```

The worldgen-earth package build and the world-explorer pack build run this compiler. Generated
regions and their directory are ignored by Git. Source notes remain here; the compiler emits
only the runtime identity vocabulary and validates all emitted geometry. Historical extra
`mapIdentity` properties remain source evidence, and do not become runtime matching behavior.
An entry requesting mapped orientation without a usable runtime identity is an error.

The compiler groups records by geohash2, recursively subdivides large groups, and indexes
coverage using each placement's full bounds or mapped search radius. Do not hand-edit the
generated cell ownership: an anchor-only index loses bridges and boundary-crossing landmarks.
