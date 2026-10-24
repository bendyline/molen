# cathedral_of_st_elizabeth — Cathedral of St. Elizabeth review

Reviewed 2026-10-16 against current source/runtime bytes. Accepted for medium-fi exterior and approximate horizontal placement. Height interpretations and exact host-ground contact remain unverified.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 current portable/source-terrain frames. Individual Košice Gothic cruciform body, polygonal eastern choir and lower aisle/chapel perimeter; red tile roof with coarse ochre, slate and cream diamond rhythms. Unequal western towers retain the tall northern staged clock tower, dark onion crown with gold ribs and open upper lantern, and lower southern tower with dark pyramidal cap. The slender central fleche has an open lower stage. Three deep timber portals, pointed lights and blind tracery, ornamental gables, stone buttresses/pinnacles and sparse parapets carry the facade. Corrected large square roof colors, repeated parapet-band geometry, southern portal openings hidden behind its projecting front, gable details outside their triangles, roof slope disagreement at the crossing, and unfilled buttress roof notches. Roof notches are simplified while all raw map vertices remain source controls. Fine sculpture, inscriptions, glass art and interiors are excluded or approximate.

Medium-fi exterior from two actually inspected whole photographs: Ingo Mehling2019 northern/eastern oblique and Lacpo2020 western Alzbetina street view, plus standard viewer PMTiles/DEM only. No bespoke plans/surveys or redistributed photographs. Patterned cruciform roof, unequal western towers with dark/gold northern onion-clock crown, lower southern pyramidal cap, slender central fleche and ornamental portal gables establish identity. Coarse diamond sequence, tracery lobes, saints/crockets, inscriptions, glass art, gold flourishes, hidden elevations, complete interiors and engineering details are approximate or excluded. Upper clock-tower total, part datums, eaves and roof/door partitions remain estimates. St. Michael chapel and Urban tower remain separate host structures. Current finish, exact terrain joins and physical-device timing are unverified.

## Shared surfaces and placement

Inspected all 11 current shared/geographic frames. Five existing cached 256² ashlar, continuous limestone, ceramic tile, standing-seam metal and plain wood graphs serve seven merged groups; skyline uses one draw. Palette colors are linear, architectural normals flat, UV repeats metric. Roof diamonds are coarse geometric vertex-color regions over the same tile graph; no unique roof bitmap. Glass, clock dials and gold accents use local PBR colors. Actual stone courses, tile repeats and metal seams remain visible. No embedded images, reference-photo textures, unique facade maps or baked lighting. Each graph loads once, and eviction disposes all model geometry. Signed plan agrees with the retained whole and architectural parts.

Exact way/22895889, Q569428 and multilingual identity match current whole 35184394984721. Retained 213 current whole points and 107 parts/all 656 part points, totaling 869 current raw vertices, with all properties and height/min_height fields. Earlier 274 distinct whole points remain intact. Anchor [21.25819725, 48.7202683], heading 0 rad, unchanged; +X east choir, -X west portals/towers, -Z taller northern clock tower, +Z lower southern tower. No horizontal rescale. Whole height=1 m conflicts with six levels, pictures and part heights; retained as conflicting raw data. Parts control 12/14 m lower ranges, 29.5 m high roofs, 30.2 m crossing, 46 m central fleche with min_height30.2, 46 m north tower, 51.7 m crown with min_height45.4, 42.5 m stair turret and 30 m south tower. High eaves20 m, upper north lantern/finial59 m and south cap37 m are explicit estimates. Raw ele=212 m is not a surveyed attachment datum. Standard DEM datum213.023687 m, perimeter-0.30..0.81 m, estimated floor0.45 m. Footings crossY=0 and extend below samples; no flattening, host DEM change or road replacement. 156 actual viewer-footprint checks cover 20 major controls, retain St. Michael chapel, Urban tower, west/east neighbors, west street and north plaza. Exact pavement/door joins, base clipping, absolute altitude and walking remain unverified.

## LOD and lighting review

Inspected all 27 current Earth-lighting frames: Economy/High, noon/late, three distances, texture-free silhouette, six details, four matched whole LODs and four transitions. Skyline 920 triangles preserves the cruciform/choir roof envelope, unequal towers, tall onion/lantern crown and central fleche. District 3,832 adds shared surfaces, selected openings/clock and principal pinnacles. Street 14,797 adds coarse roof diamonds, fuller facade openings/blind tracery, trim and parapets, with simpler aperture bands and selected buttresses. Closeup/master 31,686 refine roof rhythm, tracery/transoms, clock ticks/gold ribs, tower pinnacles and gable details. Fine repeats drop by level. Pattern detail appears at street; its exact historical motif sequence is not claimed. Generic street/detail views crop parts of the tall envelope; four matched whole LOD views contain the 59.45 m local maximum. Regional neighbors and coarse standard terrain are fixtures. Physical laptop/phone timing remains pending.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 920 | 97208 | 1 |
| district | 3832 | 352024 | 7 |
| street | 14797 | 1238796 | 7 |
| closeup | 31686 | 2687000 | 7 |

Initial skyline plus district: **449,232 bytes** of geometry. Master: **3,806,468 bytes /31,686 triangles**. Five shared 256² graphs; zero embedded images. Download bytes exclude graph definitions and runtime texture generation. Split vertex streams and equal CPU/GPU reservations. Physical-device timing remains pending.

## Verification

Targeted source reproduction, source/import/LOD/input/report hashes, source/recipe inventory and schema pass. Six Khronos checks have zero errors, warnings and images. **140 actual geometry probes**, **156 actual viewer-footprint checks** and **49 inspected current frames** pass. Shared graph read-once/unload passes. Scene validation and30-tick simulation pass: sha256:2bb50a07fdf452640ca922b7f5f7ab797000ec55bc0545b6cada6fa65d7d7eeb.

Source hash: sha256:38825707555cf6b1699d35d1d464f3c432888f9e3fa1dfb1709bfff99ce5d212. Runtime hash: sha256:7ed77b5585e853e9ecf4858feda7f99fad9de2600c5bfaf94004ad7c9f797fa3. Input hash: sha256:fe4039e232f2dac420e0a047ba5c5edb1793b2050760e17dd5fbd30e2a04a92b.

Commands: targeted generate/import/LOD/register-landmark-previews --ids=cathedral_of_st_elizabeth; generate-additional-landmarks.mjs --ids=cathedral_of_st_elizabeth --check; capture-structure-models.mjs --ids=cathedral_of_st_elizabeth --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=cathedral_of_st_elizabeth --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=cathedral_of_st_elizabeth --reflections; molen validate; molen sim run --ticks30 --hash. Bulk captures remain ignored. Next routine full source checkpoint: new_cathedral_linz–st_stephans_cathedral_passau.

## Limits

- Retained whole height=1 m conflicts with building:levels=6, photographs and 107 mapped parts. It remains raw evidence and is not used as the cathedral height. Part heights fix low ranges12/14 m, high roof ridges29.5 m, crossing30.2 m, central fleche46 m with min_height30.2, north tower46 m, inner crown51.7 m with min_height45.4, stair turret42.5 m and south tower30 m. Interpret high eaves20 m, low eaves9.5/11.5 m, north onion46..51.7 m with an estimated upper lantern/finial to59 m, and south dark roof to37 m above an estimated0.45 m floor. Upper/roof/door/clock/tracery partitions, part height datums and total59 m tip remain picture estimates. No independent height/width/length facts or horizontal rescale. Whole roof:shape=onion applies visually to the north tower,not the entire cruciform roof.
- Standard viewer DEM datum213.023687 m; raw perimeter-0.30..0.81 m. Estimated floor0.45 m; footings crossY=0 and extend below samples. No flattening,host DEM changes or road replacement. Exact plaza/door joins,base clipping,absolute altitude and walking remain unverified. Separate St. Michael chapel,Urban tower,neighboring blocks and streets remain host content.
- Medium-fi exterior from two actually inspected2019/2020 whole oblique/western photographs and standard viewer PMTiles/DEM only.No bespoke plans/surveys.Reference images not redistributed.Roof motif sequence,fine saints/crockets,tracery lobes,inscriptions,glass artwork,gold crown flourishes,hidden elevations,full interiors and engineering sections are approximate or excluded.Separate St. Michael chapel/Urban tower and streets remain host content.Current finish and precise host-ground joins unverified.Physical laptop/phone timing pending.
- Skyline retains cruciform/choir roof hierarchy,tall staged onion clock tower,lower southern roof-cap tower,crossing fleche and lower aisle envelope.District adds shared surfaces,selected recesses/clock/portals and principal pinnacles.Street adds coarse multicolor roof pattern,fuller windows/blind tracery,stone trim/parapet rhythms.Closeup/master refine the roof color rhythm,selected tracery/transoms,clock ticks/gold ribs and gable detail.No unique roof texture.Raw micro-projections are simplified;partitions/eaves/roof joins are explicit estimates.Regional neighbors are fixtures.

This accepts the recorded exterior/approximate horizontal scope. The1,000-candidate project remains incomplete.
