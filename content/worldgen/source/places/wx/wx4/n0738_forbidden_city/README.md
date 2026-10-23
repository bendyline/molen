# Forbidden City

![Molen preview](preview.png)

Specific complete mapped Forbidden City exterior: irregular palace courts and dense east/west gallery compounds; central Supreme/Central/Preserving Harmony halls on triple stone terraces; inner palaces; U-shaped Meridian Gate/five roofed pavilions; north/east/west gates; grey perimeter walls and four cross-roof corner towers. Original central stream/moat/roads remain native, with five specific stone footbridges at mapped crossings. Red walls/columns, gold swept tile roofs/teal beam belts, white stone stairs/balustrades, opaque timber door/lattice panels and grey side roofs use shared surfaces. The panels use the shared wood graph rather than generic glass; their fine lattice pattern is not reproduced. Fine architectural inventory is approximate; furnished halls, collections, inscriptions, copied artwork/banners/crowds and trees are outside this structure model.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:China_(Beijing)_Aerial_view_of_Forbidden_City_(38884882275).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Forbidden_City_IMG_4303_Meridian_Gate_-_Gate_of_Supreme_Harmony.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Forbidden_City,_as_viewed_from_Jingshan.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Forbidden_City,_Hall_of_Supreme_Harmony_(9854242723).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:The_northwest_corner_tower_of_the_Forbidden_City_(May_2017).jpg)

Specific complete mapped Forbidden City exterior: irregular palace courts and dense east/west gallery compounds; central Supreme/Central/Preserving Harmony halls on triple stone terraces; inner palaces; U-shaped Meridian Gate/five roofed pavilions; north/east/west gates; grey perimeter walls and four cross-roof corner towers. Original central stream/moat/roads remain native, with five specific stone footbridges at mapped crossings. Red walls/columns, gold swept tile roofs/teal beam belts, white stone stairs/balustrades, opaque timber door/lattice panels and grey side roofs use shared surfaces. The panels use the shared wood graph rather than generic glass; their fine lattice pattern is not reproduced. Fine architectural inventory is approximate; furnished halls, collections, inscriptions, copied artwork/banners/crowds and trees are outside this structure model.

## Model and axes

63,694 triangles; 191,082 vertices; 5 material groups; 7,646,668 bytes. Native bounds: -393.469, -17.828, -539.250 to 391.444, 44.048, 529.085. Source hash: `sha256:aa4a99a8e5e64c6a94c4a6d08ca45b46fe5d3da8da9f6788c526ac8c5790dcf4`.

{"x":"east","y":"up","z":"south"}

The geographic proposal uses exact-QID OpenStreetMap evidence. Map-derived orientation and estimated architectural details require real-site visual review; preview eligibility is distinct from geographic/fidelity approval. Map attribution: © OpenStreetMap contributors, ODbL-1.0.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0738` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Specific complete mapped Forbidden City exterior: irregular palace courts and dense east/west gallery compounds; central Supreme/Central/Preserving Harmony halls on triple stone terraces; inner palaces; U-shaped Meridian Gate/five roofed pavilions; north/east/west gates; grey perimeter walls and four cross-roof corner towers. Original central stream/moat/roads remain native, with five specific stone footbridges at mapped crossings. Red walls/columns, gold swept tile roofs/teal beam belts, white stone stairs/balustrades, opaque timber door/lattice panels and grey side roofs use shared surfaces. The panels use the shared wood graph rather than generic glass; their fine lattice pattern is not reproduced. Fine architectural inventory is approximate; furnished halls, collections, inscriptions, copied artwork/banners/crowds and trees are outside this structure model.
- Retained Q80290/relation9511883 and named native Forbidden City POI52776567645131 establish identity. 2470 integrated native building/part records within the retained historic boundary guide the full approximately752x1051m compound. Main hall POIs/footprints control the central axis; southern Meridian Gate establishes positive internalZ. Anchor[116.390807753,39.916348348]/world heading0/internal X[0.9992843702173692,-0.037825222263404915]/Z[0.037825222263404915,0.9992843702173692]. Separate Tiananmen/Duanmen, Jingshan, moat and surrounding neighborhood remain native. Fine facing/working roof profiles are approximate.
- Standard map heights/min-heights have unqualified datum. Main controls supply working central hall ridges41/32/35m, triple terraces3/6/9m, Meridian Gate roof peaks up to45m and north gate28m. These values are retained as visualization controls, not surveyed measurements. Unqualified smaller buildings use footprint-led picture estimates; generic lower roofs, bays, ridge ornaments, roof-tier/railing/column inventories and absent gate arch dimensions remain approximate. Five photographs from1991/2017/2018 establish visible form, not current condition or a certified room/roof inventory. Ceremonial floor datum-6.288943978990174m comes from the original southern plaza samples rather than the roof-influenced anchor; triple terrace heights and central hall profiles are relative to that working floor.
- Retain the original standard6m Mapzen grid, native roads, central Golden Water stream, moat and every independent neighboring building. Coarse samples contain roof/terrain variation; individual occupied foundations extend below original local grades and selected hall terraces share an approximate datum. Ground openings are bounded by actual occupied model floors, never a whole palace-precinct ground slab. Replace only integrated native components; detailed coverage99.5percent/generalized bounded clipping. Failed loading retains originals; unloading restores terrain and releases model geometry. The three central halls/terraces share original plaza grade-6.288943978990174m; bounded stair-floor openings reveal the occupied steps without changing source samples.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.
