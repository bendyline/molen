# Saint Petersburg Mosque

![Molen preview](preview.png)

Individual medium-fi Saint Petersburg mosque exterior:gray granite base,large ribbed blue dome over a stone drum,twin tapered stone minarets with corbel flares/arched chambers/blue lanterns and ribbed caps,tiled main/side pointed recesses with abstract stepped vaults,selected pointed windows and oculi,and nominal-height crescent finials. Six existing shared256² graphs,eight merged roles including opaque untextured window glass,four authored browser levels. Exact carving,inscriptions,room plans,roof detail,current condition and ground/walking remain approximate or unverified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Saint_Petersburg_Mosque,_2021.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Saint_Petersburg_Mosque_-_02.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Saint_Petersburg_Mosque.jpg)

Six existing shared256² granite,limestone,mosaic tile,standing-seam metal,plain wood and bronze graphs;eight merged roles including opaque local window glass. Metric UVs and linear tints. Broad stepped portal vaults and sparse original geometric tile accents;no embedded images,unique atlas,baked lighting or copied motifs/calligraphy.

## Model and axes

11,127 triangles; 33,381 vertices; 8 material groups; 1,339,952 bytes. Native bounds: -23.545, -6.474, -17.972 to 23.718, 47.164, 17.976. Source hash: `sha256:a51e9215391682a187aac55af4ce8fa9a2a56d210b4141fd15efc3084c862925`.

{"x":"positive toward dome-side rear;negative toward twin minaret end","y":"up","z":"positive toward the projecting side portal"}

Standard viewer DEM datum24.730195m. A1m footprint grid plus all raw control vertices yields1581 samples,-6.124..8.608m. The large building-scale variation suggests DEM contamination. 90 samples every2m at1m outside the footprint give a median-1.086472m;working plane-0.836472m is that median plus0.25m. A visible-model ground cutout follows the mapped base so coarse terrain cannot fill the entrance recesses. The preview heightmap seats its interior at floor minus0.2m with a1.8m edge transition;the raw DEM stays in pmtiles-fit.json. Footings extend below retained outside terrain. Exact street/paving joins,steps,thresholds and walking remain unverified;no bespoke survey or broad flattening.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0444` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained way28712430 has exact Q281900. Its original anchor[30.323903295,59.95518917] and heading-1.274639227411rad are unchanged. Current encoded way35184400801262 supplies the18-point22m base;separate48m minaret parts and39m dome part fix the tower-side/front and opposite dome-side hand. The main portal is assigned to the tower-side end,the smaller portal to the mapped projecting side bay,using the inspected whole-building pictures.15-degree orientation allowance is an approximate visual assignment,not a surveyed doorway bearing.
- No height,width or length facts were present in the retained candidate. Current PMTiles tags are preserved:base22m;dome min_height22/top39m;two minarets min_height22/top48m. Their internal gray drum/blue ribbed cap,shaft taper,flared chamber,blue lantern and finial partitions are picture-guided estimates ending at those nominal tops. The lower shaft portions are modeled continuously within the base footprint rather than floating at min_height22. Portal/window dimensions,roof detail,moon orientation and exact current restoration remain unverified;no independent surveyed dimensions are claimed.
- Standard viewer DEM datum24.730195m. A1m footprint grid plus all raw control vertices yields1581 samples,-6.124..8.608m. The large building-scale variation suggests DEM contamination. 90 samples every2m at1m outside the footprint give a median-1.086472m;working plane-0.836472m is that median plus0.25m. A visible-model ground cutout follows the mapped base so coarse terrain cannot fill the entrance recesses. The preview heightmap seats its interior at floor minus0.2m with a1.8m edge transition;the raw DEM stays in pmtiles-fit.json. Footings extend below retained outside terrain. Exact street/paving joins,steps,thresholds and walking remain unverified;no bespoke survey or broad flattening.
- Medium-fi exterior. Portals close on tile backings and wood door proxies;façade/chamber windows close on opaque glass. Three broad stepped arch bands abstract the portal vault;no detailed copied muqarnas or calligraphy. Exact rear/roof elevations,window counts,corbel/lobe/rib profiles,current condition,interior rooms/stairs,finial orientation,street/paving joins and walking remain unverified. Raw DEM is retained;visible-model base cutout prevents interior terrain burial. Skyline coarsens dome/crescent and uses flat window proxies. Physical-device performance remains unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
