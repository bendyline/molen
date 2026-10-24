# Cefalù Cathedral

![Molen preview](preview.png)

Individual medium-fi Cefalù Cathedral: unequal-crowned twin square towers, two-tier blind-arcaded west facade and central round-headed window, three-pointed-arch open porch/closed wood entry, raised red-tiled nave/aisles, transverse gray barrel roof, tall choir/central apse and two lower flank apses with blind arcades/colonnettes. Broad front stair transition and terrain-following foundations. Exact statues/ironwork/inscriptions, mosaics, full interiors and certified walking excluded; adjoining cloister/urban ranges remain host buildings.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Duomo_cefalu_msu2017-0797.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Apsiden_des_Dom_von_Cefal%C3%B9_msu2017-0783.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Cefalu_Dom.jpg)

Five existing256-square raw limestone,lime plaster,ceramic tile,granite and plain wood graphs. Warm stone/pale trim,uniform pale central apse,terracotta roofs and gray barrel/apse roof use linear tints and metric UVs. Flat blue-gray glazing. No embedded images or baked weather/soot/shadows; exact marble texture/sculpture is not bespoke.

## Model and axes

10,777 triangles; 32,331 vertices; 8 material groups; 1,297,828 bytes. Native bounds: -55.762, -8.778, -22.851 to 40.060, 44.500, 22.930. Source hash: `sha256:fc27b4e5ec435364c4baa2a337e12589a2be6aa481f537c66b9d9e756e82d87c`.

{"x":"east toward triple apse","y":"up","z":"south toward Rocca"}

Standard DEM datum 33.867381m; estimated architectural floor0.5m relative to this datum, rather than lifting the full cathedral above the coarse rear/Rocca hill. Raw main perimeter spans -8.43..11.00m. Lower wall foundations follow terrain; the front stair flight is an estimated transition. Coarse DEM can conceal lower eastern/southern foundation surfaces. Exact thresholds, terrain cut/fill, absolute altitude and certified walking unverified; no independent survey or terrain flattening.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=cefalu_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID way 425988640 matches current main numeric feature35184798077472. One current unscaled outline controls the cathedral, twin west tower corners, transept wings and three coarse eastern apse projections. Current map has no architectural height tags; 44m tower tops, nave/aisle/vault/choir/apse heights and all body partitions are picture-led estimates. Fitted half-ellipse apse walls retain each recorded coarse projection extent; raw main footprint remains in the foundation/source frame.
- Standard DEM datum 33.867381m; estimated architectural floor0.5m relative to this datum, rather than lifting the full cathedral above the coarse rear/Rocca hill. Raw main perimeter spans -8.43..11.00m. Lower wall foundations follow terrain; the front stair flight is an estimated transition. Coarse DEM can conceal lower eastern/southern foundation surfaces. Exact thresholds, terrain cut/fill, absolute altitude and certified walking unverified; no independent survey or terrain flattening.
- Medium-fi exterior from2017 front/east and1997 elevated pictures plus standard viewer PMTiles/DEM only. All heights,wall/eave/roof/stage partitions,apse curves,windows/columns/cornices,biforia and steps are estimates. Later restoration/roof-state changes not independently verified. Separate northern cloister and urban buildings remain host content. Exact statues,gate ironwork,inscriptions,mosaics,full interiors and certified walking excluded. Physical device timings and exact terrain thresholds pending.
- Skyline retains major masses,coarse unequal crowns,open four-post upper belfries,barrel/three apse silhouettes and inclined front entry. District adds shared graphs,flat windows/closed door/blind fields and actual open porch/upper belfries. Street opens facade/apse/window recesses and adds columns,cornices,mullions,crenels and steps. Closeup/master refine curve facets,blind arcades and crown detail. Curvature,openings,ornament and step profiles change visibly. Synthetic Swedish-cottage neighbors are not local map buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
