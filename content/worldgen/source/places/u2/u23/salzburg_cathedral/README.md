# Salzburg Cathedral

![Molen preview](preview.png)

Individual medium-fi cathedral exterior:staged twin west towers with clocks/open belfries/green cupolas/lanterns/crosses,three recessed closed entrance portals,layered pale facade with selected windows/pediments/pilasters/roofline figures,long dark nave/aisles,three rounded eastern/transept arms and roofs,and central octagonal drum/green dome/lantern. Exact sculpture/reliefs,full interiors,adjacent arcades/palace wings,plaza monuments and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://www.salzburg24.at/news/salzburg/grenznah/auch-in-salzburg-laeuten-glocken-gegen-den-hunger-art-166264)
- [Reference](https://commons.wikimedia.org/wiki/Dom_zu_Salzburg)

Four existing 256-square graphs: weathered/raw limestone, standing-seam metal and wood. Dark roofs and copper cupolas share the metal graph with linear tints. Metric UVs, flat normals and glazing; clocks are simple geometry. No embedded images.

## Model and axes

21,774 triangles; 65,322 vertices; 5 material groups; 2,616,208 bytes. Native bounds: -53.625, -0.776, -34.955 to 51.849, 79.800, 34.889. Source hash: `sha256:452227c5249e8dc5aa2a4e4d875b56bc21f3b91c01f246a03637d3bb9dc4eaa2`.

{"x":"east toward rounded sanctuary","y":"up","z":"south toward rounded transept"}

Standard DEM datum 424.198882m;estimated floor 0.8m clears sampled footprint peak 0.372m and perimeter -0.43..0.37m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=salzburg_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Current parent gives the approximately 103x69m cathedral plan. Contained mapped parts give 28m aisle/service roofs,41m nave/crossing/rounded-arm tops,52m tower bodies with23/40/53m cornices,69m cupolas,78m tower lanterns plus79m cross tips,63m central dome and79m central lantern top. Photo-led internal estimates distinguish22m lower walls,36.5m nave/rounded-arm eaves,41..52m central drum,52..63m central dome,63..75.5m lantern and79m cross. Tower cupola stages53..61m and61..69m are inferred. Openings,roof profiles,facade bands,statues and floors are approximate;map heights are not a survey.
- Standard DEM datum 424.198882m;estimated floor 0.8m clears sampled footprint peak 0.372m and perimeter -0.43..0.37m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.
- Individual exterior approximation from two useful inspected pictures and standard map/terrain. Selected figures/crest fields and clocks are simple geometry;exact sculpture,reliefs,inscriptions,full interiors,adjacent arcades/palace wings and plaza monuments excluded. Side/rear and oval glazing uses selected surface panels;certified walking and physical phone/laptop timings pending.
- Skyline retains stepped twin towers, green cupolas/lanterns, three rounded arms, high nave, dome and curved central facade. District adds shared graphs, recessed closed front portals, flat upper windows, selected frames/pilasters/clocks/figures and side glazing. Street opens actual belfry/lantern arches and recesses upper facade/central drum glazing; closeup refines curved profiles, mullions and trim. Visible detail changes remain.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
