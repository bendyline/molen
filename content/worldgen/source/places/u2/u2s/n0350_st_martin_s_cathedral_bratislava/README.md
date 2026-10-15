# St. Martin's Cathedral, Bratislava

![Molen preview](preview.png)

Individual medium-fi St. Martins Cathedral exterior:pale single west tower,steep red nave/lower polygonal chancel,chapels/south vestibule,stepped buttresses/selected west pinnacles,tall lancets/pointed west windows,clock/rose fields,green copper apron/bulb/open lantern/spike/gold crown and closed recessed side portals. Exact sculpture/tracery/crown insignia/full interiors/adjacent walls and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://slovakia.travel/bratislavsky-region)
- [Reference](https://commons.wikimedia.org/wiki/File:Bratislava_Saint_Martin%27s_Cathedral_Tower_01.jpg)

Five existing 256-square lime plaster,raw limestone,ceramic tile,copper and wood graphs. Green copper and restrained golden ribs/crown share the copper graph with separate linear tints. Flat blue-gray glazing,metric UVs,flat architectural normals,no embedded images.

## Model and axes

8,280 triangles; 24,840 vertices; 7 material groups; 997,836 bytes. Native bounds: -38.614, -5.161, -19.060 to 38.661, 89.400, 19.182. Source hash: `sha256:728551c4796c709d4f699a2526c252a1de9c2d9042d1fb1158452c5868bbf74f`.

{"x":"east-northeast toward polygonal chancel","y":"up","z":"south-southeast toward vestibule"}

Standard DEM datum 155.384861m;estimated floor 4.4m clears sampled footprint peak 4.005m and perimeter -4.81..4.01m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0350` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact-QID relation16609274 and eight current cathedral/part controls retain the approximately77.2x38.1m plan. Current85m tower,34m nave roof,25.03m chancel roof,15.5m east chapel and8m vestibule control overall stages. The retained16m fact is not the tower or whole-building height. Nave/chancel wall cores are reconstructed inside mapped buttress footprints,with projected buttresses and roofs retaining the mapped envelope. Estimated eaves are18m nave/18.5m chancel,11.5m east chapel and5.3m vestibule;north chapel9.5/13.5m eave/ridge. Tower wall50m,copper apron50..53m,bulb53..63m,lantern63..68m,spike69..83.5m and simplified gold crown85m. Openings,body cores,buttress profiles,pinnacle height,metal stages and terrain thresholds remain picture-led estimates;no independent survey.
- Standard DEM datum 155.384861m;estimated floor 4.4m clears sampled footprint peak 4.005m and perimeter -4.81..4.01m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.
- Individual medium-fi exterior from two useful inspected pictures and standard PMTiles/DEM. Map tower/nave/chancel/east chapel/vestibule heights retained. Other eaves,wall core/roof subdivisions,buttresses,openings,clock/rose fields,copper bulb/lantern,spire and abstract crown are picture-led estimates. Exact crown insignia,sculpture,tracery,full interiors,adjacent city walls/buildings and certified walking excluded. Physical device timings pending.
- Skyline preserves principal masses,steep roof,single copper spire,crown and coarse buttresses. District adds shared graphs,selected flat lancets/closed doors/clocks/pinnacles. Street adds real recessed glazing/portals and open belfry/lantern with selected ribs. Closeup/master refine copper curve,clock marks and window mullions. Changes in curvature and small ornament remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
