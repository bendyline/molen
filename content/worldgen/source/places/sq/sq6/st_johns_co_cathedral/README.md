# St. John's Co-Cathedral

![Molen preview](preview.png)

Individual medium-fi current exterior:two limestone towers/open belfries/green bells,pale pyramids/base balustrades,exposed upper-right bell frame,three clock fields,column-supported central balcony/single recessed door/upper arch,niches/cornices/gable,pale metal nave roof,repeated sloping buttress ribs and lower side/rear masses. Exact sculpture/dial text/full interiors,adjacent buildings and the background dome excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://church.mt/mass-on-the-second-sunday-of-easter-the-sunday-of-the-divine-mercy-27th-april-2025-930am/)
- [Reference](https://culture-malta.org/st-johns-co-cathedral/)

Five existing 256-square raw/weathered limestone, standing-seam metal, lime plaster and wood graphs. Pale pyramids and clocks reuse plaster; green bells share metal. Metric UVs, linear tints, flat architecture normals/glazing, no embedded images.

## Model and axes

9,285 triangles; 27,855 vertices; 7 material groups; 1,118,492 bytes. Native bounds: -35.894, -0.018, -22.627 to 33.062, 48.600, 22.410. Source hash: `sha256:67ab8efcb13304c0f2e4cf212ce6e43fd539b1eb0522a81230536d4830552b17`.

{"x":"northeast toward rear nave","y":"up","z":"southeast toward clock-tower side"}

Standard DEM datum 55.671413m;estimated floor 2.4m clears sampled footprint peak 1.969m and perimeter 0.33..1.93m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=st_johns_co_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- The approximately66x44m current parent and two front building-part plans control horizontal placement. The north part includes a broad lower mass;its upper tower is a photo-led9.5x9.3m reconstruction within that control. The south tower retains its raw plan. No part heights exist. The current17m parent is a generic levels-derived value and is not used as the overall cathedral height. Photo-led estimates are14.5..15.1m low aisles,22.5..27m nave,24m central front/27m gable,27.5..36.7m belfries,37.6m parapets,45.3m pale pyramid tips and46.2m finials. Right upper bell frame reaches44.2m. Openings,balcony,clocks,buttresses and all vertical stages remain approximate;no independently measured heights.
- Standard DEM datum 55.671413m;estimated floor 2.4m clears sampled footprint peak 1.969m and perimeter 0.33..1.93m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.
- Individual medium-fi exterior from two inspected useful pictures and standard PMTiles/DEM. Bell profiles,roof balustrades,clock/calendar fields,balcony/niches,gable relief and side/rear details are selected approximations. North upper belfry plan is inferred within the larger mapped base. Exact inscriptions/sculpture,full interiors,adjacent museum/city blocks,background dome and certified walking excluded. Physical phone/laptop timings pending.
- Skyline preserves twin pale pyramid towers,upper-right exposed bell frame,central balcony/door/upper arch,gable,nave roof and coarse buttress rhythm. District adds shared graphs,recessed closed portal/upper glass,selected columns/rails,three clock fields and flat belfry/bell marks. Street opens actual belfries with suspended green bells and recesses blind niches;closeup refines arches,bells,rails and clock ticks. Detail changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
