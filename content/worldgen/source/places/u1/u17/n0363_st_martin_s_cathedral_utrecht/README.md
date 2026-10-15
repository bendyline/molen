# St. Martin’s Cathedral, Utrecht

![Molen preview](preview.png)

Individual surviving Utrecht Domkerk with broad north/south transept, narrow eastern polygonal choir, gray slate cross roof, warm mixed brick/stone Gothic facades, tall pointed glazing, layered lower ambulatory/chapels, flying buttresses and pinnacles. Separate western Dom Tower across the open square: square lower stages, open tall belfry and octagonal lantern/crown, gray pointed cap and finial; real ground passage retained. South U-shaped low cloister with genuinely open garden arcades. No vanished connecting nave. Shared materials and standard-terrain footings. Exact carved sculpture, inscriptions, bells/internal staircases, temporary west-front trompe-l’oeil artwork, garden trees/fountain, interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Domkerk_2024_gezien_vanaf_de_Domtoren.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Utrecht_Dom_Sint_Martin_Chor_1.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Domtoren_Utrecht_-_2.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Domtoren_taken_from_Mariaplaats,_Utrecht.jpg)

Six existing shared256-square brick, ashlar, limestone, slate, plain wood and standing-seam metal graphs. Warm gray-pink masonry, pale trim and blue-gray slate use linear tints/metric UVs. Glass and accents use flat PBR colors. No embedded images, unique facade textures, temporary artwork or baked weathering/shadows.

## Model and axes

12,395 triangles; 37,185 vertices; 8 material groups; 1,491,964 bytes. Native bounds: -88.899, -1.423, -29.281 to 32.640, 112.720, 50.161. Source hash: `sha256:7787d0e55f8622312967f3790810eea757c9ab20848795da7f79c3ab036149f9`.

{"x":"east-northeast toward choir","y":"up","z":"south-southeast toward cloister"}

Standard DEM datum 12.733629m; display datum offset 0.4m, main/tower/cloister perimeter terrain -1.07..0.81m. Foundations follow terrain; approximate western entries/tower passage thresholds use local DEM +0.22m. Coarse standard terrain does not certify absolute altitude, square paving, threshold/step joins, cut/fill, interiors or walking. No global flattening or modeled connection across the square.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0363` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID OSMway1159618262/Q936545 matches current main35185531707094. All24 current raw controls preserve heights/min_height absences. Church high part33.5m and low aisle20m are approximate roof envelopes: estimated high eaves25m/ridge33.5m and aisle eaves13m/roof20m. Separate Dom Tower stage controls retain38.6m base,38.6..68.08m square middle,68.08..106.75m octagon and106.75..112.32m tip;12 low pinnacles retain38.6..43m. The modeled low masonry regularizes tiny mapped buttress notches to the union of high/aisle plans; the raw mapped outline remains in the foundation and all controls. The retained112.3m Wikidata claim is explicitly qualified to Q200334 (Dom Tower), never applied to church walls. Width12.14m/length49m claims do not rescale map plans. Vestry/cloister roof and facade details are picture estimates.
- Standard DEM datum 12.733629m; display datum offset 0.4m, main/tower/cloister perimeter terrain -1.07..0.81m. Foundations follow terrain; approximate western entries/tower passage thresholds use local DEM +0.22m. Coarse standard terrain does not certify absolute altitude, square paving, threshold/step joins, cut/fill, interiors or walking. No global flattening or modeled connection across the square.
- Medium-fi surviving exterior from four useful pictures and standard PMTiles/DEM only. Current stage heights are map controls; church eaves/roofs, lower annexes/cloister, flying buttress curves, pinnacle/tracery/window rhythm, threshold and small ornament are estimates. Exact sculpture/text, temporary trompe-l’oeil west artwork, bells/inner staircases, gardens/fountain/trees, full interiors and certified walking excluded. Physical device timing pending.
- Skyline preserves cross roof, polygonal choir, coarse buttresses, separate square/octagonal tower and U-shaped cloister. District adds shared textures, flat glazing/doors and open tower/arcade apertures. Street adds facade recesses, window/mullion tracery, flying buttress curves and pinnacles. Closeup/master refine facets. Synthetic context neighbors are not mapped Utrecht buildings.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
