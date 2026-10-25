# Šibenik Cathedral

![Molen preview](preview.png)

Šibenik Cathedral: pale ribbed stone barrel nave/aisle/transept vaults, curved western crown/large and small roses, recessed west/north portals, octagonal windowed drum/pointed stone dome, selected side bays/pilasters and three mapped eastern apses.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Cathedral_of_St._James,_%C5%A0ibenik_01.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:HR-Sibenik-Kathedrale-01.jpg)

Four existing256-square sandstone,raw/weathered limestone and wood graphs; shared wall/roof/trim bindings, metric UVs,linear vertex tints,flat glass and small gold-tinted trim cross. No embedded images.

## Model and axes

10,843 triangles; 32,529 vertices; 6 material groups; 1,304,980 bytes. Native bounds: -21.335, -1.238, -9.550 to 20.608, 33.400, 9.039. Source hash: `sha256:23d68f28f1e9d8d741c75770c62c5a45a7b48c593e8507f3ab5f8dee5fff51dc`.

{"x":"east along nave toward three apses","y":"up","z":"south toward seaward side"}

Standard viewerDEM datum8.650114m; estimated level floor1.4m clears sampled footprint peak1.091m/perimeter-0.89..1.09m. Foundations descend to retained coarse terrain. Native−Z is uphill square/northern portal; exact plaza/stair/apse thresholds remain approximate, with no bespoke surveyed or certified walking claim.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=sibenik_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Current PMTiles provides20.16m nave,32m dome,12.56m aisle,20.5m transept,14.9m central apse and8.84m flanking-apse height values. Their roof/drum/eave roles are interpreted with two exterior pictures; dome top follows the32m map value, not a surveyed measurement. Eaves,window/drum stages,curved profiles,statue omissions and all thresholds remain approximate. Retained facts contain no published height/width/length values.
- Standard viewerDEM datum8.650114m; estimated level floor1.4m clears sampled footprint peak1.091m/perimeter-0.89..1.09m. Foundations descend to retained coarse terrain. Native−Z is uphill square/northern portal; exact plaza/stair/apse thresholds remain approximate, with no bespoke surveyed or certified walking claim.
- Current PMTiles controls are approximate and do not certify measured real heights. Selected rosette spokes,portal hoods,side bays,ribs,apse profiles and landing are approximations. Exact sculpture/lion figures,head frieze,full tracery,full interiors,neighboring palace/town/plaza and certified walking surfaces excluded. Physical phone/laptop timings pending.
- Skyline uses closed portals,coarse curved roofs/dome and mean tints. District adds shared textures,main rose aperture/recessed closed portals and selected windows. Street adds actual drum openings,small round facade cuts,roof ribs,pilasters and portal trim; closeup refines vault facets,dome ribs/windows and rosette spokes. Detail/profile changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
