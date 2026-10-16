# Cattedrale di Monreale

![Molen preview](preview.png)

Individual medium-fi Monreale Cathedral and cloister exterior:unequal west towers/short clock tower/tall open belfry,three-arch pale portico,patterned front/central arch,nave/aisles/north gallery,high eastern sanctuary/three decorated apses,tiled cloister ring/open arcades/court and approximate surrounding mapped monastery ranges. Exact carvings/inlay/bronze panels/full interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://www.italy-museum.com/hidden-sicily/basilica-monreale-complex-in-palermo-priority-entrance)
- [Reference](https://homepages.bluffton.edu/~sullivanm/monreale/cathedral.html)

Four existing 256-square raw sandstone, raw limestone, ceramic tile and wood graphs. Red/green roofs share the tile graph; warm/dark stone and pale carved/column/paving fields use linear tints of shared stone. Metric UVs, flat architecture normals/glass/garden, no embedded images.

## Model and axes

39,202 triangles; 117,606 vertices; 8 material groups; 4,708,872 bytes. Native bounds: -78.117, -12.860, -86.306 to 78.088, 42.600, 86.471. Source hash: `sha256:8a79fe9a068484e311fba8f3574e5375b951610bae3657231ac23af1a745b34f`.

{"x":"east-northeast toward eastern apses","y":"up","z":"south-southeast toward cloister"}

Standard DEM datum 310.438308m;estimated floor 3.1m clears sampled footprint peak 2.677m and perimeter -9.55..2.68m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0349` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Exact-QID way82665029 supplies the approximately95.9x45.6m cathedral parent. Five current PMTiles controls retain that parent,a cloister roof ring,its courtyard and two overlapping monastery parents. None has a usable height. Nave/tower/apse subdivisions and all heights are picture-led estimates:15m lower aisles,24m nave eave/29m ridge,33m sanctuary eave/37m ridge,25m north tower/39m south belfry,29m central apse and20.5m side apses,6.2m cloister eave/8.4m roof ridge and10..14m secondary monastery massing. Original map plans are retained without overall rescaling. Exact sculpture/inlay/portals/interiors,individual monastery rooms and terrain thresholds are not surveyed. The second open courtyard has an estimated flat paving datum4.7m relative to the standard DEM anchor,clearing its sampled peak4.272m;this is a visualization floor,not surveyed walking ground.
- Standard DEM datum 310.438308m;estimated floor 3.1m clears sampled footprint peak 2.677m and perimeter -9.55..2.68m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.
- Individual medium-fi cathedral/cloister exterior from two useful inspected pictures and standard PMTiles/DEM. Current plans have no height values. Interior subdivisions,three apses/roof stages,tower openings,arches/clocks/column capitals and selected inlay motifs are picture-led. Surrounding monastery ranges use approximate mapped massing/tiled roofs/selected windows to replace overlapping generic parents. Full interiors,exact bronze panels/carvings/inlay/individual monastery rooms and certified walking excluded. Physical device timings pending.
- Skyline keeps cathedral/monastery masses, unequal towers, three apses, major roofs and roofless courts with coarse supporting piers. District adds shared graphs, selected windows/inlay fields, three front/11 north arches and four cloister bays per side. Street adds actual cathedral apertures and 16 paired-column cloister bays per side; closeup has 22 bays/profile refinements. The detailed master preserves 26 bays per side. Detail/curvature changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
