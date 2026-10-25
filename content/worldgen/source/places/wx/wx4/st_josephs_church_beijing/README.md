# St. Joseph's Church, Beijing

![Molen preview](preview.png)

Individual St.Joseph’s Wangfujing Church medium-fi exterior:gray-brick long hall/irregular eastern rear,three domed western towers with central raised paired-louver stage and octagonal side crowns,lanterns/crosses,two facade orders,three deep timber portals,central rose/paired side lights,stone pilasters/cornices,white plaque/medallion abstractions,tall arched side glazing and stepped approach. Shared materials/four budgeted LODs;hidden roofs and all heights estimated.Fine artwork,inscriptions,interiors and surrounding buildings excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:St._Joseph%27s_Cathedral,_Beijing_facade.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:201611_St._Joseph%27s_Church_Beijing_exterior.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:St._Joseph%27s_Cathedral,_Beijing_walls_1.JPG)

Five existing cached256-square brick,continuous limestone,standing-seam metal,plain wood and ashlar graphs serve seven merged groups.Gray brick and pale trim,gray faceted caps,subdued wood/louver panels and blue-grey glazing use linear tints and metric UVs.Flat architectural normals.No embedded images,reference-photo textures,unique facade maps or baked lighting.

## Model and axes

25,233 triangles; 75,699 vertices; 7 material groups; 3,032,140 bytes. Native bounds: -40.000, -2.341, -16.000 to 36.000, 27.950, 16.000. Source hash: `sha256:3e830a7d0d8515a279fffc3fe6596a4f2e470406cd2093b8c4185fb5cf8687b2`.

{"x":"east toward irregular rear","y":"up","z":"south along the hall"}

Standard viewer DEM datum56.218566 m,raw control perimeter-1.99..4.30 m. Estimated floor0.65 m;footings crossY=0 and extend below samples. Western approach steps are picture-led.No flattening,host DEM change or road replacement.Exact pavement/door joins,base clipping,absolute altitude and walking remain unverified. Standard DEM rises4.30 m at the north-front raw control and buried its portal in the first current render. A bounded76x32 m visual ground opening covers the authored church and paved apron only. Complete opaque floor atY=0 and a fitted perimeter apron from the retained standard DEM edge cover the opening;three entrance treads rise to the estimated0.65 m floor. Original terrain returns when the model hides/unloads. No source DEM heights,roads or neighboring buildings are changed. The plaza shape/grade is reconstructed,not surveyed;exact host-edge/door joins and walking remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=st_josephs_church_beijing` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- No mapped height,levels or independent dimension facts are present. All vertical partitions are picture-led estimates:main body eave12.7 m/ridge17.2 m,western screen16.4 m,lower cornice8.1 m,central tower square stage20.1 m/octagonal drum22.4 m/dome24.4 m/lantern26.1 m/cross27.3 m,and side towers18.6 m/drum20 m/dome21.4 m/lantern22.8 m/cross23.6 m above the estimated0.65 m floor. Rear irregular roof15.3 m and hidden joins are inferred from the standard footprint. Approximate roof shape,window/door and tower-stage divisions are not surveys. All current11 raw points and earlier12 distinct whole points/tags retained without horizontal rescale.
- Standard viewer DEM datum56.218566 m,raw control perimeter-1.99..4.30 m. Estimated floor0.65 m;footings crossY=0 and extend below samples. Western approach steps are picture-led.No flattening,host DEM change or road replacement.Exact pavement/door joins,base clipping,absolute altitude and walking remain unverified. Standard DEM rises4.30 m at the north-front raw control and buried its portal in the first current render. A bounded76x32 m visual ground opening covers the authored church and paved apron only. Complete opaque floor atY=0 and a fitted perimeter apron from the retained standard DEM edge cover the opening;three entrance treads rise to the estimated0.65 m floor. Original terrain returns when the model hides/unloads. No source DEM heights,roads or neighboring buildings are changed. The plaza shape/grade is reconstructed,not surveyed;exact host-edge/door joins and walking remain unverified.
- Standard DEM rises4.30 m at the north-front raw control and buried its portal in the first current render. A bounded76x32 m visual ground opening covers the authored church and paved apron only. Complete opaque floor atY=0 and a fitted perimeter apron from the retained standard DEM edge cover the opening;three entrance treads rise to the estimated0.65 m floor. Original terrain returns when the model hides/unloads. No source DEM heights,roads or neighboring buildings are changed. The plaza shape/grade is reconstructed,not surveyed;exact host-edge/door joins and walking remain unverified.
- Medium-fi exterior from three inspected2007/2016 front/side pictures and standard viewer PMTiles/DEM only.Hidden roof/rear partitions and all heights are estimates.Fine carved figures,scrollwork,inscriptions,stained-glass art,small dentils,drains,complete interiors/bells and engineering are approximate or excluded.Dark belfry/lantern panels are louver/glass backing,not claims of open air.Current finish,exact terrain joins and physical-device timing unverified.
- Skyline retains three domed towers/crosses,raised central stage,two-tier front,long hall and irregular rear.District adds shared surfaces and simplified facade/window/louver rhythm.Street adds actual portal/window recesses,paired side lights,rose cross,buttress-pilasters,drum oculi and trim.Closeup/master refine dome ribs,selected column/capital/plaque/medallion and louver rhythms.Regional neighboring shophouses are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
