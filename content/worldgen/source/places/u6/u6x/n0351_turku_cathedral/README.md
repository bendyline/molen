# Turku Cathedral

![Molen preview](preview.png)

Individual medium-fi Turku Cathedral exterior:red/patchy brick western tower,clock/white cornice bands,dark closed upper belfry,green flared spire/gold ball/cross,long copper-roofed nave/clerestory,lower aisles,north projecting chapel,rounded northeast chapel,southern additions and polygonal east choir. Selected pale blind niches/recessed windows/closed portals. Exact sculpture,brick weathering,full interiors,adjacent city/plaza and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://turunseurakunnat.fi/en/turun-tuomiokirkko/)
- [Reference](https://commons.wikimedia.org/wiki/File:Turku_Cathedral_profile.jpg)

Five existing 256-square Flemish brick,raw limestone,granite,copper and plain wood graphs. Roof/dark belfry/gold trim share copper with separate linear tints;stone patches/blind niches share limestone. Flat blue-gray glazing,metric UVs,hard architectural normals,no embedded images.

## Model and axes

9,515 triangles; 28,545 vertices; 8 material groups; 1,146,504 bytes. Native bounds: -44.515, -10.644, -25.318 to 44.650, 87.100, 25.251. Source hash: `sha256:9af99423276080968726eaf543e0a8bef7b5ba57636dc2e72df3a1ee958a6c0d`.

{"x":"east toward polygonal eastern choir","y":"up","z":"south toward long aisle"}

Standard DEM datum 40.297409m;estimated floor 2.1m clears sampled footprint peak 1.729m and perimeter -10.29..0.98m. Foundation follows coarse terrain. Absolute altitude/exact plaza/portal thresholds remain approximate;no independent survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0351` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact-QID way437169589 retains approximately88.75x50.36m full envelope;36 current cathedral/part controls retain tower55/64/67/73/85m stages,nave42m,choir30/40m,northeast chapel34.61m,aisles16/30m,southwest chapel18.3/28.6m,southeast chapel16.1/29.7m and east annex17/29.36m intervals. Raw polygons retained,with nave/north range unions recorded. Intermediate eaves/roof slopes and openings are picture-led estimates. Retained101.9m fact has an unclear height datum and is not substituted for the current85m mapped spire;absolute altitude is unverified. No bespoke survey.
- Standard DEM datum 40.297409m;estimated floor 2.1m clears sampled footprint peak 1.729m and perimeter -10.29..0.98m. Foundation follows coarse terrain. Absolute altitude/exact plaza/portal thresholds remain approximate;no independent survey or certified walking.
- Individual medium-fi exterior from two useful tower/whole-south pictures and standard viewer PMTiles/DEM. Main eave35m and northeast eave24.4m,sloping roof fields,wall/roof subdivisions,selected windows/closed doors,pale blind niches/clock marks,upper shutter fields,spire profile/closed roof-light marks and small1.8m choir finial are estimated. Exact plaster/brick weathering,sculpture,full interiors,adjacent city/plaza and certified walking excluded. Large belfry fields and small roof lights are closed;no bell interior claimed. Physical phone/laptop timings pending.
- Skyline preserves the complete stepped roof/tower/choir silhouette and estimated supporting volumes. District adds shared graphs,selected glazing/doors,pale patch/niche rhythms and clocks. Street opens real glazing/closed-door and upper-shutter recesses. Closeup/master refine clock ticks,selected window bars and shutter slats. Curvature,aperture and ornament changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
