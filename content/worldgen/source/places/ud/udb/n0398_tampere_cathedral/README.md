# Tampere Cathedral

![Molen preview](preview.png)

Individual Tampere Cathedral medium-fi exterior:rough grey/warm stone asymmetrical church,west rose/gabled portal and red tiled cross roofs; tall southwest,middle northwest and small northeast tapering spires with green tips;pointed belfry louvers,large south rose/gable and lower pointed lights,round west stair turret,southeast sacristy;two mapped gabled pedestrian gatehouses and bounded picture-led low red-capped wall wings. Shared textures and four browser LODs. Trees,park paths,full enclosure/interiors,glass artwork and exact terrain joins excluded or approximate.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Tampereen_Tuomiokirkko.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Tampereen_tuomiokirkko_2.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Tampere_Cathedral_Apr2012_001.jpg)

Five existing shared256-square dry-stone,granite,ceramic tile,copper and plain wood graphs serve seven groups.Linear tints,metric UVs and flat architectural normals. Opaque timber louver panels use the trim slot.Local blue-grey PBR glazing;no embedded images,unique facade/photo maps or baked lighting.

## Model and axes

7,269 triangles; 21,807 vertices; 7 material groups; 876,420 bytes. Native bounds: -38.000, -2.300, -22.000 to 29.000, 68.400, 31.000. Source hash: `sha256:a34cb8975527fdc605c1d4981f971b725dd1f7a34eb243b4fe0b7807b9abae76`.

{"x":"east to rear","y":"up","z":"south toward transverse rose/tall tower"}

Standard viewer DEM datum 112.765598 m at the western approach reference; church-center sample 124.958456 m is retained separately. Raw selected-control perimeter -0.65..10.26 m. Estimated floor0.4 m; footings crossY=0 and extend below samples. No terrain flattening or road replacement. Exact park,pavement,gate/door joins,base clipping,absolute altitude and walking remain unverified. The standard DEM church-center sample124.958456 m stands about12 m above the western approach reference. Use that retained approach reference as the terrain attachment datum. A bounded64x53 m reversible ground opening covers the authored church,gatehouses and reconstructed inner apron. A completeY=0 floor and a perimeter apron fitted to retained DEM samples cover the opening. Raw standard heights stay intact;terrain restores when the model hides/unloads. Grade,wall wings and exact park/gate/door/host joins remain reconstructed and unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0398` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact retained way/88874701 and Q1236638 match current whole 35184460963533 and its same-ID multilingual Tampere Cathedral/Tampereen tuomiokirkko POI. All eight selected whole/part/gatehouse controls and their raw points/properties remain source inputs, alongside the earlier 23-point whole outline. Anchor and heading0.150597742317 rad are unchanged. The tall southwest tower, lower northwest tower and west rose/portal in inspected photographs sign the -X front; the south transverse gable and third northeast spire agree with the plan. No horizontal rescale.
- The retained whole and Wikidata height64 m disagree with the current southwest tower part68 m. Preserve both;use the current68 m part as the approximate tall-spire envelope without claiming a survey. Other current parts supply northwest52 m, northeast36 m, body28 m and southeast20 m envelopes. Interpret body28 m as the main/transverse roof ridge with estimated eaves17.5 m; tall/middle/small tower masonry42/30/19 m and their roof partitions are picture estimates. Southeast part20 m controls a low sacristy gable; gatehouse5 m tags control approximate gables over3.7 m walls. Floor0.4 m,round front turrets,porches,window/door/louver splits,low wall wings and part datums are estimates. No precise surveyed doorway,height or engineering claim.
- Standard viewer DEM datum 112.765598 m at the western approach reference; church-center sample 124.958456 m is retained separately. Raw selected-control perimeter -0.65..10.26 m. Estimated floor0.4 m; footings crossY=0 and extend below samples. No terrain flattening or road replacement. Exact park,pavement,gate/door joins,base clipping,absolute altitude and walking remain unverified. The standard DEM church-center sample124.958456 m stands about12 m above the western approach reference. Use that retained approach reference as the terrain attachment datum. A bounded64x53 m reversible ground opening covers the authored church,gatehouses and reconstructed inner apron. A completeY=0 floor and a perimeter apron fitted to retained DEM samples cover the opening. Raw standard heights stay intact;terrain restores when the model hides/unloads. Grade,wall wings and exact park/gate/door/host joins remain reconstructed and unverified.
- The standard DEM church-center sample124.958456 m stands about12 m above the western approach reference. Use that retained approach reference as the terrain attachment datum. A bounded64x53 m reversible ground opening covers the authored church,gatehouses and reconstructed inner apron. A completeY=0 floor and a perimeter apron fitted to retained DEM samples cover the opening. Raw standard heights stay intact;terrain restores when the model hides/unloads. Grade,wall wings and exact park/gate/door/host joins remain reconstructed and unverified.
- Medium-fi exterior from three inspected2017/2007/2012 pictures and standard viewer PMTiles/DEM. Current tower68 m part and retained whole64 m height conflict;both preserved,not independently resolved. Hidden roof/gable joins and lower-window/porch/enclosure divisions remain picture estimates. Glass art,fine stone details,complete park enclosure/paths/trees,interiors/bells and engineering excluded or simplified. Current finish,exact host-ground joins,absolute altitude and physical-device timing unverified.
- Skyline keeps three unequal spires,west/south rose gables,irregular red roofs,portal,round turret and two gate tunnels. District adds shared surfaces,front/side light rhythm,louver groups and roof bands. Street adds recessed apertures,lead-grid abstraction,trim and buttress caps. Closeup/master refine louver/lead spacing and sparse roof ribs. Regional Finnish log cabins are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
