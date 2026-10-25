# Graz Cathedral

![Molen preview](preview.png)

Individual Graz Cathedral:pale Gothic hall and polygonal eastern choir,red tile roof,large western copper roof lantern/smaller eastern turret,tall recessed pointed windows,stone buttresses,west portal/round window,projecting southern Baroque chapel and lower attached ranges. Medium-fi exterior;adjacent mausoleum dome/tower and neighboring buildings excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Grazer_Dom_(1).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Graz_Dom_Schlossberg.jpg)

Five existing cached256-square lime plaster,continuous limestone,ceramic tile,standing-seam copper and plain wood graphs.Metric UVs,linear pale-render/stone/red-tile/green-copper tints,flat normals,seven merged material groups.No embedded images,bespoke facade maps or baked lighting.

## Model and axes

9,172 triangles; 27,516 vertices; 7 material groups; 1,104,760 bytes. Native bounds: -31.450, -3.546, -20.620 to 30.280, 42.800, 22.050. Source hash: `sha256:7711825d48b3b7c010735e30892e4e1f9a9614cf09151ac78998ecd83c16dce4`.

{"x":"east toward choir","y":"up","z":"south toward projecting chapel"}

Standard viewer DEM datum362.580399m;raw perimeter-3.04..1.07m,estimated floor0.4m. Footings crossY=0 and extend below samples;no flattening,host DEM changes or road replacement. Exact pavement/door joins,base clipping,absolute altitude and walking remain unverified. Adjacent mausoleum/castle/university,streets,trees and site furniture remain host content.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=graz_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact way/84579393,Q262563 and raw height18m,roof:height8m,roof:shape gabled,roof:material roof_tiles tags. Current whole height18m and west roof-part height34m retained. Nave eave18/ridge26 and west roof-lantern main stage top34m interpret those scopes above an estimated0.4m floor;the roof-part tag does not independently describe an upper roof/finial or datum. Its estimated onion roof/upper lantern/finial reaches42.4m from the pictures;this is not a mapped total-height claim. Choir ridge24.5m,small turret28.6m,chapel10.8..13.7m and lower ranges8..12m are picture-based estimates. No independent height/width/length facts or horizontal rescale. Hidden bays,stage partitions and current finish remain approximate.
- Standard viewer DEM datum362.580399m;raw perimeter-3.04..1.07m,estimated floor0.4m. Footings crossY=0 and extend below samples;no flattening,host DEM changes or road replacement. Exact pavement/door joins,base clipping,absolute altitude and walking remain unverified. Adjacent mausoleum/castle/university,streets,trees and site furniture remain host content.
- Medium-fi exterior from two actually inspected2009/2014 pictures and standard viewer PMTiles/DEM only.No bespoke surveys.The neighboring mausoleum dome/tower are excluded.Fine sculpture,exact fresco art,inscriptions,glass patterns,louvres/hidden bays,full interiors and engineering sections simplified or omitted.Current finish and exact ground joins unverified.Physical phone/laptop timing pending.
- Skyline retains main red roof/pale hall,polygonal choir,staged green western lantern,small turret and lower chapel/ranges.District adds selected deep glazing/portals and buttress silhouette.Street adds fuller windows,stone trim/portal canopy and chapel pilasters.Closeup/master add sparse tracery/transoms,door panels,lantern louvres and roof vents.Simplified partitions are estimates;all raw map controls retained.Regional context neighbors are fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
