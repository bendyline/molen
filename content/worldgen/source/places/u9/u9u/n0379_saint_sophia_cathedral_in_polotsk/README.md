# Saint Sophia Cathedral in Polotsk

![Molen preview](preview.png)

Individual Polotsk Saint Sophia Cathedral: off-white lime-plaster Baroque twin-tower front with two actual open arched tiers per tower, narrower faceted attics/green caps and crosses; shaped central gable, tall arched glazing, recessed wood portal, pilasters and selected scroll/urn details. Broad green nave roof, rounded rear apse with small lantern, paired rounded side chapels/green domes/lanterns and low mapped envelope ranges. Four existing shared plaster/limestone/standing-seam metal/wood graphs, linear tints, metric UVs, flat normals and four browser levels. Fine stucco figures/iron scrollwork, inscriptions, full interiors, exact hidden rear details/roof joins and surveyed plaza thresholds are approximate or excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Modern_photos_of_Cathedral_of_Saint_Sophia_in_Polotsk.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Belarus-Polatsk-Cathedral_of_Sophia-11.jpg)

Four existing cached256-square lime-plaster, limestone, standing-seam metal and plain-wood graphs. Linear off-white/green tints, metric UVs and flat architectural normals; glazing/metal accents use geometric PBR colors. No embedded images, unique facade maps or baked shadows.

## Model and axes

15,369 triangles; 46,107 vertices; 6 material groups; 1,847,948 bytes. Native bounds: -25.143, -2.675, -18.702 to 25.474, 55.400, 18.653. Source hash: `sha256:46d9afe9f5959d12307033afb23e4029bb87d06e77895536118ba3e7d211621e`.

{"x":"southward from rounded rear apse toward twin-tower front","y":"up","z":"westward toward round side chapel"}

Standard viewer DEM datum 133.974217m; display floor0.4m, raw whole perimeter -2.26..-0.00m. Footings extend below coarse terrain; short local entrance steps approach a threshold0.3m above model floor. Exact hilltop paving/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0379` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSM way502489243/Q2465016 matches current main35184874578075. All51 current whole-outline vertices and raw tags reproduce by rigid rotation without rescale. Earlier multilingual tags, white plaster/green metal roof and building:levels1 remain retained. Current PMTiles emits height5m, conflicting with the pictured multi-tier cathedral; original OSM control and retained facts provide no measured height, so5m remains cartographic metadata and every modeled height is a picture estimate. Native+X paired tower front contrasts with-X rounded rear apse. Internal Boolean clips and side circular partitions, nave wall23m/roof29m, front wall25m/shaped central gable36m/cross38.8m, twin tower lower25m/open lower belfry25.8..35m/open upper36..44m/round attic44..47m/green caps49m/cross55m, round side chapels17m/green roofs20m/lanterns23m/cross25m, rear apse23m/green roof24.2m/lantern28m/cross30.5m and low ranges11m/12.5m are estimated. Exact ornament, fenestration, hidden roof joins, measured heights and engineering accuracy are unverified.
- Standard viewer DEM datum 133.974217m; display floor0.4m, raw whole perimeter -2.26..-0.00m. Footings extend below coarse terrain; short local entrance steps approach a threshold0.3m above model floor. Exact hilltop paving/door joins, absolute altitude and walking remain unverified. No global flattening or road replacement.
- Medium-fi exterior from two inspected2025 front/2006 reverse-side pictures and standard viewer PMTiles/DEM only. Cartographic5m height is retained but is not a measured cathedral height; all modeled vertical levels and internal partitions are estimated. Fine stucco/iron scrollwork, inscriptions, exact hidden rear/door details, full interiors/bells and surveyed paving/thresholds remain approximate or excluded. Physical phone/laptop timings pending.
- Skyline retains white stepped twin towers/green caps/crosses, shaped central gable, nave and rounded apse/side chapels. District adds shared textures, flat arched fields and actual open belfries. Street adds recessed glazing/wood portal, simple pilasters and blind arches; closeup/master refine frames/finials. Synthetic cottages are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
