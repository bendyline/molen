# St. Paul's Cathedral, Mdina

![Molen preview](preview.png)

Individual St. Paul’s Cathedral, Mdina: warm Maltese limestone Baroque west front with paired clock/bell towers and curved stone spires, central triangular pediment/cross, paired pilasters, three recessed wooden portals and large upper arched window. Broad lower flat-roof aisles, eastward central nave/crossing, large octagonal windowed drum, low weathered metal dome with stone ribs/scrolls and small lantern/cross. Sparse side windows, cornices, stone diamonds/crest and short front steps. Five existing shared ashlar/limestone/granite/standing-seam-metal/wood graphs, linear tints, metric UVs, flat architectural normals and four browser levels. Exact carving/heraldry/clock numerals, full interiors/bells, hidden rear windows/roof joins and surveyed plaza/thresholds remain approximate or excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Mdinakathedraal.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:St_Paul%27s_Cathedral_Dome,_Mdina.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Mdina_cathedral.jpg)

Five existing cached256-square ashlar, limestone, granite, standing-seam metal and plain wood graphs. Warm Maltese limestone, pale stone trim, muted weathered metal dome and flat roof use linear tints/metric UVs/flat architectural normals. Clock faces/hands, dark glass and sparse accents use geometric PBR colors. Zero embedded images or bespoke facade maps.

## Model and axes

8,042 triangles; 24,126 vertices; 7 material groups; 969,156 bytes. Native bounds: -30.900, -5.065, -16.941 to 28.330, 34.100, 16.950. Source hash: `sha256:69b42b636b5c1d4416de49f4a80fa1f96e3ba848ad32b8b86412453443846f7d`.

{"x":"east from twin-tower west facade toward crossing dome/rear nave","y":"up","z":"south toward southern clock tower and aisle"}

Standard viewer DEM datum 193.391278m; display floor4.1m, whole perimeter terrain -4.71..3.85m. West threshold0.3m above model floor with short local steps; walls extend down to coarse standard terrain. DEM slopes under the rear plateau/adjacent buildings are coarse and may expose tall foundations; no bespoke terrain correction is claimed. Exact cathedral plaza/retaining-wall grading, threshold joins, absolute altitude and walking remain unverified. No global flattening or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0375` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSM way27044968/Q1630170 matches current main35184399133800. All6 raw whole vertices and current dome19/tower4+4 component vertices and full tags remain exact after rigid rotation with no rescale. Main20m and dome/towers30m heights are PMTiles controls for complete components, not offsets added on top of the main height. West twin-tower facade versus eastward nave/dome signs the retained axis. Main body: estimated low aisle walls12m/parapet13.2m, central nave and transept walls17.8m with low roof20m; full west screen20m/central pediment23.3m/finial24.3m. Towers: lower clock shaft20m, open bell tier20..25.2m, hood25.2..26.3m, curved stone spire26.3..29m/cross30m. Dome: estimated octagonal drum18..25m, low faceted metal canopy25..27.9m, lantern27.8..29.4m/cross30m. Drum center[6.614,-0.708]m/radius9.1m is derived from mapped circular control; octagonal shape/phase and roof partitions are picture estimates. Portals, clocks, window rhythm, stone pilasters/capitals and scrolls are approximate. No survey or engineering accuracy claimed.
- Standard viewer DEM datum 193.391278m; display floor4.1m, whole perimeter terrain -4.71..3.85m. West threshold0.3m above model floor with short local steps; walls extend down to coarse standard terrain. DEM slopes under the rear plateau/adjacent buildings are coarse and may expose tall foundations; no bespoke terrain correction is claimed. Exact cathedral plaza/retaining-wall grading, threshold joins, absolute altitude and walking remain unverified. No global flattening or road replacement.
- Medium-fi exterior from inspected2005 facade,2024 dome/drum and2021 rear plus standard viewer PMTiles/DEM only. Exact carving/heraldry/inscriptions, full clock numerals, statues, sculptural spire scrolls, bells/interiors, hidden rear windows/roof joins and surveyed plaza/thresholds remain approximate or excluded. Physical phone/laptop timings pending.
- Skyline keeps paired curved stone tower spires, central pediment, octagonal drum/dome/lantern and low nave/aisle forms. District adds shared surfaces, clock faces, flat glazing/belfry bays and selected trim. Street adds actual recesses/open belfries, capitals/pilasters, larger mullions and dome ribs. Closeup/master refine surrounds, window bars, spire ribs and clock marks. Small lantern windows remain flat fields. Synthetic cottages are a review fixture.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
