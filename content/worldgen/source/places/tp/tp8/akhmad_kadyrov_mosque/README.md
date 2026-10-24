# Akhmad Kadyrov Mosque

![Molen preview](preview.png)

Individual medium-fi Akhmad Kadyrov Mosque with mapped prayer hall and open courtyard: four triple-balcony minarets, stepped central grey domes, pale stone arched facades, lower side porches, courtyard arcades and a domed through gate. Raw principal plan/height controls retained; repeated tiny map ornaments consolidated into original shared-material details. Seven merged roles, six existing 256² graphs, four budgeted browser LODs. Fine art, furnishings, park context and unseen interiors omitted.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Achmat-Kadyrow-Mosche,_Grosny_2.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Grozny,_Russia,_Akhmad_Kadyrov_Mosque,_Courtyard.jpg)

Six existing shared 256² sandstone, marble, continuous sandstone, standing-seam metal, cast bronze and wood graphs serve seven merged roles. Metric UVs, linear tints, no embedded images or unique facade atlases. Alternating original arch facets abstract pink/cream masonry; no copied calligraphy or tile art.

## Model and axes

28,066 triangles; 84,198 vertices; 7 material groups; 3,372,192 bytes. Native bounds: -50.360, -1.767, -31.815 to 50.570, 59.684, 31.774. Source hash: `sha256:a685e941e6fadc475b875a7814c96c1772002d652d412a0fe7c4f604c6df8db5`.

{"x":"NNE open court and gate","y":"up","z":"ESE side porch"}

Normal viewer DEM datum 124.2808983117137 m; floor -0.3157523352428001 m is median of 134 outside-perimeter samples every 3 m at 1 m offset plus 0.35 m. 527 raw footprint samples span -1.417415058856875..2.2325225342034543 m. Adaptive footings follow the outer outline; preview terrain seats the compound and 1.5 m margin. The paved court is open above its floor. Ground cutout follows the full compound outline, covered by the model paving. Exact street steps, thresholds, paving grades and host terrain joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=akhmad_kadyrov_mosque` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact relation 6012185 / Q340549 is current viewer building 52776564145433. All 45 current outer vertices and the 19-vertex open-court ring, original anchor and heading remain unchanged. Selected principal body, dome, roof and four minaret parts retain raw polygons/properties and mapped height ranges. Positive X NNE points from the SSW prayer hall toward the open court and gate; positive Z ESE toward the eastern side porch. Two inspected pictures resolve the signed axis without rescaling. The relation has no current QID tile tag; the retained exact relation supplies identity. Tiny mapped facade/ornament parts are consolidated into shared medium-fi window/arch rhythms. Park, streets and city buildings remain host content.
- Current principal map heights guide this visualization: prayer body 13 m, lower/upper podiums 15/18 m, drum 18–23 m, neck 23.5–25 m, main dome 25–31 m and finial top 32.5 m; four minaret tips 60 m. Lower roofs and courtyard domes use their selected map height ranges. Three minaret balconies at about 34/39/44 m and collar near 50 m follow the mapped ring levels. The gate top 9.5 m and its cap top 13 m are mapped. Arch depths, repeated bays, dome curves, roof slopes, small turrets/finials, screens, finishes and exact structural profiles are picture estimates. Fine carving/calligraphy, lights, flags, furniture and unseen interiors are omitted; map heights are not surveyed measurements.
- Normal viewer DEM datum 124.2808983117137 m; floor -0.3157523352428001 m is median of 134 outside-perimeter samples every 3 m at 1 m offset plus 0.35 m. 527 raw footprint samples span -1.417415058856875..2.2325225342034543 m. Adaptive footings follow the outer outline; preview terrain seats the compound and 1.5 m margin. The paved court is open above its floor. Ground cutout follows the full compound outline, covered by the model paving. Exact street steps, thresholds, paving grades and host terrain joins remain unverified.
- Principal mapped compound with consolidated repeated details. Open paved court and gate passage are modeled; gallery/door recesses stop before unseen interiors. Small dome count/spacing, arches, windows, pinnacles, railing patterns and current finish remain approximate. No copied artwork, furnished interior, precise engineering or physical-device performance claim.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
