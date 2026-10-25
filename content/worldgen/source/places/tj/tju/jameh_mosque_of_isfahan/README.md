# Jameh Mosque of Isfahan

![Molen preview](preview.png)

Individual medium-fi Jameh Mosque of Isfahan:map-exact irregular low brick complex and two courtyards,four distinct deep pointed iwans/two-storey court arcade fields,larger south and smaller north pale-brick domes,twin south minarets,west timber lookout,blue central basin and low arched pavilion. Five shared256² brick/mosaic/plaster/stone/wood graphs,six merged groups,four browser levels. All untagged vertical dimensions and subplans explicitly picture-estimated;fine facade art,interiors and exact terrain/threshold joins omitted or unverified.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:20180301124354_IMG_4179And6more_Interior_3.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Jameh_Mosque_of_Isfahan_-_Northern_Iwan.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Masjed-e_J%C4%81m%C3%A9_of_Isfahan.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Exterior_and_north_dome_Jameh_Mosque_of_Isfahan.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Jameh_Mosque_of_Isfahan_-_Western_Iwan_01.jpg)

Five existing shared256² longformat brick,sandstone,lime plaster,mosaic and wood graphs;six merged groups. Untiled domes share brick;cyan facade bands share generic mosaic. Metric UVs,zero embedded images,baked lighting or unique facade art. Muqarnas abstracted as a few original broad facets.

## Model and axes

15,042 triangles; 45,126 vertices; 6 material groups; 1,808,808 bytes. Native bounds: -86.246, -2.932, -73.840 to 86.167, 39.910, 73.869. Source hash: `sha256:38c35c54019a0ee03a6089fc8996b9762120cd835e1f242639d4a9f69c133430`.

{"x":"northeast north iwan and dome,opposite southwest south prayer dome","y":"up","z":"southeast east iwan and small mapped court"}

Standard viewer DEM datum1575.420164m;whole perimeter-2.58..1.76m relative to anchor. Floor3.910m clears the maximum retained DEM grid sample affecting the footprint,including an8.5m interpolation margin,plus0.25m. The initial median-perimeter floor allowed coarse DEM to protrude into the court;this explicit working platform plane corrects that visible burial without flattening or deleting terrain. Adaptive brick footings crossY=0 and extend below retained ground. Raw DEM retained without flattening/cutout;coarse building contamination may expose or bury base margins. Exact altitude,ground/court/threshold/stair/street joins and walking unverified;no road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=jameh_mosque_of_isfahan` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact relation/5730508 /Q1256501 matches current PMTiles whole52776563863756 (3×2^44+5730508). One fragment retains29 outer points and two4-point courtyard holes,with all raw properties;there are no separately mapped roof parts or building heights in this extract. Anchor[51.685304841,32.669782786] and heading0.933690517117rad unchanged,no horizontal rescale. Main70×57m court follows its mapped skew quadrilateral;the60m width fact is explicitly courtyard-qualified,not a whole-building dimension. Native−X southwest south/prayer iwan and larger dome,+X northeast north iwan/Taj al-Mulk dome;−Z northwest west iwan/lookout,+Z southeast east iwan/small mapped court. Pictures resolve facing to about3°. Four iwans/domes/minarets/roof vaults/fountain/pavilion are picture-estimated subplans within about4m working uncertainty;unseen roof divisions remain unverified. Adjacent bazaar,roads and separate buildings remain host assets.
- No numerical height claims in retained Wikidata facts and no mapped height/min_height bands. Retain nominal70m length and courtyard-qualified60m width without rescaling the172×148m whole footprint. Working low range9.8m/two-storey court facade11m,four portal frames23–24m,open vault crowns20.5–21.3m,south dome31m/north dome23m,twin minaret tips36m and west lookout28.5m are picture-estimated proportions above the declared floor,not surveyed dimensions. Roof vault cadence,muqarnas cells,drum transitions,portal depth,shaft/cap profiles and secondary court elevations are working approximations. Current finish/interiors/engineering and exact ground contacts unverified.
- Standard viewer DEM datum1575.420164m;whole perimeter-2.58..1.76m relative to anchor. Floor3.910m clears the maximum retained DEM grid sample affecting the footprint,including an8.5m interpolation margin,plus0.25m. The initial median-perimeter floor allowed coarse DEM to protrude into the court;this explicit working platform plane corrects that visible burial without flattening or deleting terrain. Adaptive brick footings crossY=0 and extend below retained ground. Raw DEM retained without flattening/cutout;coarse building contamination may expose or bury base margins. Exact altitude,ground/court/threshold/stair/street joins and walking unverified;no road replacement.
- Individual medium-fi exterior from five inspected courtyard/iwan/north-dome photographs. Exact main outline/two courtyard holes retained;four vaulted iwans have closed rear walls,shallow gallery bays are closed external fields. South/north dome footprints,all heights,minaret spacing,roof vault grid and secondary court elevations are picture-led estimates. Fine tile/calligraphic/brick lattice artwork,portraits/banners/fixtures,interiors,unseen roofs,current finish and exact terrain/threshold/street joins omitted or unverified. No enclosed-interior/free walking claim. Surrounding bazaar/streets/landscaping remain host content. Synthetic regional context and physical-device timing unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
