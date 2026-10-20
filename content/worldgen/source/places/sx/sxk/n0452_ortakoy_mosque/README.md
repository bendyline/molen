# Ortaköy Mosque

![Molen preview](preview.png)

Individual medium-fi Ortaköy Mosque: mapped waterfront prayer-hall/entrance-wing outline,three-bay arched facade tiers,curved lead pediments,stepped pilasters and medallion corner pinnacles,shallow grey dome/gold finial,two single-balcony minarets,lower pale stone wings and pink entry courtyard with three transoms/doors. All vertical dimensions,partitions,window/trim details,ornament and exact shore/ground joins are estimates. Six existing shared256² graphs,seven merged roles,four browser LODs. Fine artwork,calligraphy and unseen interiors omitted.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:View_of_Ortak%C3%B6y_Mosque_from_the_Bosphorus.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ortakoy_Mosque_DSCF5556.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ortakoy_Mosque_DSCF5637.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ortak%C3%B6y_Mosque_in_2026.jpg)

Six existing256² limestone,continuous limestone,lime plaster,standing-seam metal,cast bronze and plain wood graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,zero embedded images or unique atlases. Original simplified medallion/pediment masses;no copied carving,calligraphy or baked lighting.

## Model and axes

18,480 triangles; 55,440 vertices; 7 material groups; 2,221,860 bytes. Native bounds: -20.421, -0.725, -17.685 to 21.275, 43.843, 17.736. Source hash: `sha256:24e91fa8636c9db8c42e3e8a9f0d4784fa61494aa67220641702d861ebf283cc`.

{"x":"SE prayer hall;negative NW entrance wings","y":"up","z":"SW public pier square"}

Standard viewer DEM datum0.3745512807612056m;floor0.3428171866021358m is median of94 outside-perimeter samples every2m at1m offset plus0.25m. 239 raw footprint samples range-0.3745512807612056..3.5934048946384536m,including coarse hillside rise behind the entrance. Source foundation follows the retained perimeter;preview terrain seats the footprint and a1.5m perimeter margin. Sea preview uses the viewer zero-meter sea datum,relative-0.3745512807612056m;only the selected coast water is lowered. The water plane is a preview fixture absent from the runtime GLB. Exact quay,pier,courtyard,stairs,tide and terrain joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0452` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way498861735 /Q176380 is current standard viewer building35184870950567. All16 current raw outline vertices/properties and original anchor/heading are retained;current tile tags omit the QID. PositiveX SE toward the Bosphorus-facing square prayer hall;negativeX NW toward the U-shaped entrance wings;positiveZ SW toward the public pier square. Picture interpretation resolves the previously undirected axis without a180-degree flip or horizontal rescale. The coastal water polygons remain separate standard-map controls,not new building/parcel evidence.
- No retained height/width/length facts are linked for this candidate. All vertical dimensions and subdivisions are picture estimates:main hall17.8m,curved pediment crown20.8m,dome base20.3m/cap26.7m/finial28.5m,two single-balcony minaret tips43.5m,lower entrance wings9.0m with shallow grey roofs. Large upper/lower arched windows,blind seaward lower centre niche,pilasters,corner medallion pinnacles,crescent-like finials,pink rear courtyard walls,three entrance bays,step geometry and small ornament are simplified estimates. Fine carving,calligraphy,grille patterns,sculpture and unseen interiors are omitted.
- Standard viewer DEM datum0.3745512807612056m;floor0.3428171866021358m is median of94 outside-perimeter samples every2m at1m offset plus0.25m. 239 raw footprint samples range-0.3745512807612056..3.5934048946384536m,including coarse hillside rise behind the entrance. Source foundation follows the retained perimeter;preview terrain seats the footprint and a1.5m perimeter margin. Sea preview uses the viewer zero-meter sea datum,relative-0.3745512807612056m;only the selected coast water is lowered. The water plane is a preview fixture absent from the runtime GLB. Exact quay,pier,courtyard,stairs,tide and terrain joins remain unverified.
- No retained dimension facts. Every vertical height,roof/pediment profile,window/door/wing partition,small ornament and current finish is picture-proportioned. Exact raw16-point footprint and original anchor/heading are retained. Fine relief,calligraphy,grille patterns,sculpture and unseen interiors are omitted. Boats,piers,nearby businesses,bridges and cityscape remain host content. Runtime GLB contains no review water or terrain. Exact shore/quay/courtyard/stair/tidal contact,engineering and physical-device timings remain unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
