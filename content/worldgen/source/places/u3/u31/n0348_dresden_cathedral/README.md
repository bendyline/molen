# Dresden Cathedral

![Molen preview](preview.png)

Individual medium-fi Dresden Cathedral exterior:rounded lower body/narrow upper nave,layered hipped roofs/pale apron,two balustrade/selected-figure tiers,repeated pilasters/tall windows/oval lights,single open staged tower/green onion-spire/cross and closed recessed portal. Exact statues,carvings,inscriptions,interiors,adjacent castle/covered connection and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Luftbild_Katholische_Hofkirche_Dresden_2014-03-29.JPG)
- [Reference](https://timesofindia.indiatimes.com/travel/dresden/hofkirche/ps52614606.cms)

Four existing 256-square sandstone/raw sandstone, standing-seam metal and wood graphs with metric UVs, linear tints, flat architecture normals/glass and no embedded images. Gray roofs, pale apron and green tower crown share one metal graph.

## Model and axes

39,121 triangles; 117,363 vertices; 5 material groups; 4,697,848 bytes. Native bounds: -47.641, -4.158, -28.517 to 48.100, 89.200, 27.475. Source hash: `sha256:6aeb595a4d0d33702da5cb5d986929d094e731bde386538fff078259defd11fa`.

{"x":"northeast toward single tower/entrance","y":"up","z":"southeast toward castle"}

Standard DEM datum 122.273763m;estimated floor 1.3m clears sampled footprint peak 0.866m and perimeter -3.75..0.87m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0348` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID way14879154 and86 current cathedral controls retain the approximately94.3x53.9m plan,tower/nave/apron outlines and mapped figure locations. The retained source explicitly flags inconsistent overall/part heights,especially tower stages. The mapped24m lower cornice and29.8m inner apron plus49.5/67.5/79.5/86m tower stages and87.9m cross top are used as approximate controls,not surveyed values. Upper nave has a conflicting26..53m mapped prism and47..53m figures;photo-led40m upper cornice,43.5m roof ridge and3.5m figures replace these vertical values for coherent proportions. Tower subdivisions/openings,roof slope,facade details and all thresholds remain approximate. The raw upper-body plan has an inward fold;its convex outer envelope supplies the reconstructed upper nave. Raw controls remain unchanged.
- Standard DEM datum 122.273763m;estimated floor 1.3m clears sampled footprint peak 0.866m and perimeter -3.75..0.87m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.
- Individual medium-fi current exterior from two inspected useful pictures and standard PMTiles/DEM. Upper wall/roof heights adjusted from flagged inconsistent map values. Figure positions project to the nearest reconstructed cornice;selected faceted figures,bands,pilasters,ovals,tower crown profiles and side/rear details are approximate. Exact sculptures/carved crests/inscriptions,full interiors,adjacent castle/covered connection and certified walking excluded. Physical device timings pending.
- Skyline preserves rounded lower/upper body envelopes, layered roofs, pale apron and a single stepped tower/onion-spike/cross; figures and glazing are omitted. District adds shared graphs, selected tall/oval glazing, pilasters, balustrades and five coarse figures. Street opens actual tower bays and recesses principal windows/closed portal; closeup refines curved profiles, frames, facade relief and figures. Bounded outline reduction preserves the curved ends. Detail changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
