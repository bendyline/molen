# Armenian Cathedral of the Holy Cross

![Molen preview](preview.png)

Individual Akhtamar Holy Cross medium-fi exterior: warm ashlar cross-gabled church with faceted drum, ribbed stone cone/cross, polygonal corner niches and narrow arched lights; low western narthex and northeast annex; southern two-stage bell entrance with open upper arches and six-column stone pavilion/cone. Shared stone/wood/metal surfaces, selective relief-band/medallion abstractions and four browser LODs. All heights/internal plans approximate. Narrative relief sculptures,inscriptions,frescoes,complete interior and island monastery/paths excluded or simplified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:The_Church_of_the_Holy_Cross_on_Akhtamar_Island.JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:AkdamarIslandChurch.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Akdamar_Kilisesi_-_ön_cephe.jpg)

Five existing shared256-square ashlar,continuous sandstone,basalt,plain wood and bronze graphs serve seven material groups. Warm linear tints,metric UVs and flat architectural normals;local blue-grey glazing. Broad relief bands,medallion/cross abstractions and stone roof ribs are geometry.No embedded images,unique facade maps,photo textures or baked lighting.

## Model and axes

6,845 triangles; 20,535 vertices; 7 material groups; 825,648 bytes. Native bounds: -16.301, -2.988, -8.800 to 16.248, 24.000, 10.400. Source hash: `sha256:88044abe3078fe7e9d29f82a024e0201b74fdc25cacc69624f05b22761726081`.

{"x":"east toward main sanctuary","y":"up","z":"south toward bell entrance"}

Standard viewer DEM datum 1661.326535 m; current whole perimeter -2.63..0.59 m. Estimated floor0.5 m. Footings crossY=0 and extend below samples. Exact island terrace,paths,door/base joins,absolute altitude and walking remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=armenian_cathedral_of_the_holy_cross` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way/191563484 and Q1281985 match current whole35184563652316 and its same-ID multilingual Surp Haç Kilisesi/Armenian Cathedral of the Holy Cross POI. Retain all eight current raw outline points/properties and earlier eight distinct whole points/tags. Anchor and heading -0.050814185243 rad are unchanged. The low western narthex, main conical drum, northern/eastern annex and southern stacked bell entrance in inspected pictures sign the frame: +X east toward main sanctuary, -X west narthex, +Z south bell porch. No horizontal rescale. The map supplies one coarse whole outline, not independent architectural parts.
- No mapped height/levels/roof tags or independent dimension facts. All vertical and internal divisions are picture-led estimates: main walls11.4 m, west/east/north arm ridges14 m and lower south arm eave/ridge10.2/11.4 m behind the open bell pavilion, corner volumes10.4/11.15 m, central16-sided drum12.4..18 m, stone cone22.1 m/cross23.5 m, western narthex5.5 m eaves/7.4 m ridge, northeast annex5.4/7.2 m, bell porch lower4.5 m and upper9.4 m, gable10.6 m, six-column pavilion10.6..12.7 m and cone14.2 m. Floor0.5 m, steps, relief-band abstractions, polygonal corner niches, concealed roof joins and part plans are estimates. Retained whole outline provides a conservative low base envelope; picture-led masses do not claim measured sub-footprints.
- Standard viewer DEM datum 1661.326535 m; current whole perimeter -2.63..0.59 m. Estimated floor0.5 m. Footings crossY=0 and extend below samples. Exact island terrace,paths,door/base joins,absolute altitude and walking remain unverified.
- Medium-fi exterior from three inspected western/southern photographs and standard viewer PMTiles/DEM. All heights and architectural sub-plans are estimates;single mapped whole provides conservative base coverage. Famous narrative reliefs and inscriptions are represented only by sparse band/medallion/cross abstractions,not exact carvings. Frescoes,full interiors/bells,monastery ruins,island paths/planting,current finish,engineering and exact ground joins excluded or unverified. Regional Anatolian neighbors are synthetic style fixtures. Physical laptop/phone timing pending.
- Skyline retains the main conical drum/cross,cross-gabled body,low narthex/annex,south two-stage bell porch and open six-post pavilion. District adds shared materials,slit/drum lights and alternating portal stone. Street adds recessed openings,roof ribs,frieze/eyebrow rhythm and detailed porch air. Close-up/master add sparse medallions,refined jambs and pavilion capitals;fine narrative sculpture remains abstract.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
