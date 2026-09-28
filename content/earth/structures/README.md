# Geographic structures

`placements.json` is the Earth pack's catalog of authored, geographically anchored models.
Its coordinates are WGS84 `[longitude, latitude]`; `asset` is an ID in the worldgen style
pack. The runtime indexes each entry by three-character geohash, queries only cells crossing
the current terrain tile, then tests the anchor or extended bounds against the tile bounds.
Point structures are owned by one tile. Extended models are clipped to resident tiles, which
share the prepared asset and release their own clipped geometry on eviction.

The first Seattle set records 14 sites: 13 active visual previews and one draft. Each record
retains a geographic source URL and a note describing what still needs site alignment. The
active set covers the Space Needle, downtown towers and library, Seattle Center venues,
Pike Place Market, the waterfront wheel, both stadiums, Suzzallo Library, and SR-520.
The Ballard Locks remains a draft.

The next-1,000 batch adds eight ground-contact previews: Shanghai World Financial Center,
The Shard, Oriental Pearl Tower, Maiden Tower, Gonbad-e Qabus, Ka'ba-ye Zartosht, Tower of
Hercules and Kõpu Lighthouse. Their metadata records directed footprints or explicit facing
approximations. Kiipsaare Lighthouse remains an offshore draft. Their authored geometry uses
the shared architectural surfaces and streams through the same resident-tile index.
The [batch review runner](../../../examples/world-explorer/test/visual/landmark-library.md)
checks actual model/material loading, geographic transforms and eviction on flat test terrain.
Its captures do not establish final ground fit against the host's elevation data.

`preview` means the reference point is suitable for a visual placement study. A preview model
is still stylized and its footprint, heading, and ground fit may need surveying. `draft` means
the source point does not establish an unambiguous current structure location; draft records
are discoverable through the index but the viewer does not render them. The Ballard Locks
facility point does not resolve the chamber centerline or orientation.

## SR-520 alignment

`node packages/worldgen-earth/scripts/fit-sr520.mjs` fits the floating section to three paired
carriageway centers decoded from the bundled Protomaps 2026-09-25 z15 roads. The anchor is
`[-122.25870362, 47.64076031]`, heading `-0.22822702` radians: authored +X points east and
13.076 degrees south; the trail is on the north side. The sampled centerline residual is
under 0.25 m. The 2350 m span endpoints are approximately `[-122.27396312, 47.64314838]` and
`[-122.24344412, 47.63837213]`. End stations are visual estimates within the mapped crossing,
not surveyed pontoon transitions.

The model's water origin is set to 5.76 m absolute Y, matching the sample DEM's roughly
5.11 m lake surface plus the viewer's 0.65 m water offset. This is a rendering datum for the
bundled sample, not the Corps' separate lock gauge datum or live lake level. The deck is
6.096 m above that origin, based on the [WSDOT project booklet](https://wsdot.wa.gov/sites/default/files/2021-11/SR520-Booklet-FB042017.pdf).
The extent includes 100 m approach transitions. `replaceRoads` removes covered parallel
bridge centerlines only after the asset loads, preserves outside approaches, and blends their
estimated elevations into the authored deck. Unavailable models retain procedural spans.

The shared terrain renderer builds slabs, barriers and piers for other mapped bridges,
including rail and pedestrian crossings. Heights and support layouts are inferred when
the map lacks survey data; `deckElevation` can supply an absolute measured height. The
fallback is visual geometry, without engineering detail or walk/drive collision.
Water elevations use interior polygon samples to avoid raising a lake to the height of
its shoreline banks on coarse terrain tiles. Water uses its geometric elevation without
a slope-based depth bias, which can otherwise hide elevated decks in distant views.

On a nongeneralized map tile, `replaceFootprint` suppresses a procedural building only when
the anchor falls inside that building polygon. Other mapped buildings remain untouched.
The model sits on the sampled terrain height unless `datum` is `sea-level`; `elevation` adds
a vertical offset. Extended bounds require an absolute datum to keep tile fragments aligned. New placements
should be inspected in the real terrain package at close and distant views before changing
their status or orientation.
Prepared landmark geometry is shared by nearby tiles and released after its last tile leaves
view. The viewer never requests assets for cells outside its resident terrain tiles.

Regional procedural building suggestions come from `world.atlas.json`. The
`suggestStructureStyles` API returns the first matching style rule and its normalized variant
weights for a map feature. Seattle's unmeasured low-rise house rule currently assigns
4/7 to the wood-sided PNW house, 1/7 to wood Craftsman, 1/7 to brick Prairie, and 1/7 to
Ranch. Japan and other broad regions have their own rules. These are visual priors, not claims
about the actual material of any particular building; measured source geometry and explicit
styles take precedence.

The bundled Seattle–Bellevue–Sammamish terrain is built by
`examples/world-explorer/scripts/build-sammamish-package.mjs`. The recorded landmarks can be
inspected with `examples/world-explorer/test/visual/seattle-landmarks.play.json` after building
the World Explorer. The original model previews and source bundles are in
`content/worldgen/source/places/<geohash2>/<geohash3>/<model-key>/`.
The [source index](../../worldgen/source/structure-index.json) resolves stable source keys,
and the [geographic gallery](../../worldgen/source/places/gallery.html) includes reusable
models from semantic folders. Source-folder anchors do not approve runtime placements.

Initial scene captures: [Seattle Center](../../../examples/world-explorer/captures/seattle-landmarks-verified/01-space-needle.png),
[downtown](../../../examples/world-explorer/captures/seattle-landmarks-verified/02-downtown-towers.png),
and [stadiums](../../../examples/world-explorer/captures/seattle-landmarks-verified/03-stadiums.png).
The accompanying `experience-run.json` records the repeatable browser run and diagnostics.
The [embeddable Earth view](../../../examples/earth-view/captures/seattle-space-needle.png)
also records the Space Needle through `mountEarthView`.

Bridge captures and their `experience-run.json` are in `examples/world-explorer/captures/bridges/`.
After building the workspace and World Explorer, reproduce the five views with:

```sh
node packages/tooling/dist/cli.mjs play examples/world-explorer/dist --scenario examples/world-explorer/test/visual/bridges.play.json --out-dir examples/world-explorer/captures/bridges
```

The scenario records the full SR-520 span, its deck and both approaches, and the automatic
Montlake Bridge fallback. It waits for terrain and detail layers to finish before each capture.
