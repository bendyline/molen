# friday_mosque_of_herat — Friday Mosque of Herat

Reviewed 2026-10-18 for its declared medium-fi exterior and approximate geographic fit. Heights, internal divisions and tower positions are estimates.

![Molen preview](preview.png)

## Exterior and shared materials

Inspected 11 current portable renders including the retained 1024×640 summary. The irregular mapped outer envelope and open courtyard, four pointed court iwans, recessed eastern outer entry, eight capped minarets, cream portal borders, pale flat roofs and two rows of courtyard niche fields are present. The low roof no longer crosses the outer entrance. Fine calligraphy, historic tile artwork, furnishings, detached structures and large unsupported domes are omitted.

Inspected 11 current shared-material and geographic-flat views, including the footprint overlay. Six existing 256² graphs provide brick, raw limestone, mosaic tile, lime plaster, marble and plain wood; seven merged roles include local opaque glazing. Metric UVs and linear vertex tints are used, with no embedded images or unique atlas. Shared graphs are read once and model geometry is disposed on eviction. The 123 surrounding host buildings remain separate; courtyard ground is host content. The flat overlay checks pose and replacement, while the retained standard DEM fixture checks approximate contact.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 754 | 79036 | 1 |
| district | 3973 | 385892 | 7 |
| street | 13852 | 1370580 | 7 |
| closeup | 20656 | 2081864 | 7 |

**464,928 bytes for initial skyline plus district**, plus six existing shared 256² graphs. Seven merged roles; no embedded images.

Inspected 27 current medium-fi views: Economy/High, noon/late light, street/block/skyline, silhouette, six details, four matched LODs and four transitions. Courtyard void, five portal frames and capped tower silhouette persist through the LODs. Skyline drops small doors and niches and uses six-sided tower profiles; district restores coarse closed fields, portal borders and galleries; street restores two-tier niche rhythm and inner vault ribs; closeup restores more facets and original coarse diamond centers. The distant footing ribbon extends below the sampled terrain minimum without extra triangles. Whole views retain the model; some detail cameras intentionally crop tower tops. Context houses are synthetic. Physical-device and full-city timing remain pending.

## Placement and limitations

Retained Q1291612 /relation5873573 mosque identity,anchor,undirected axis and12-vertex outer footprint with a four-vertex courtyard hole remain unchanged. Current named mosque POI and buildings multipolygon share id52776564006821. Only this mosque envelope is selected;detached buildings,roads,park and courtyard objects remain host content. Internal range/portal/dome/minaret positions and all heights require picture-guided estimates. Retained courtyard hole is not filled or replaced. Current main ring has15 outer and6 hole vertices,including quantized tile-seam points. Western prayer iwan faces positive X;the recessed outer entry faces east along positive X. Four courtyard iwans,one outer entry,eight tower positions and roof partitions are visualization estimates. Standard Protomaps20261014 /Mapzen-USGS viewer extractN0475;datum 928.5131664399311 m. 1017 building-ring samples span -3.2980975838862605 to 1.4290032496760432 m. Floor -0.31888288261684467 m is the median of 311 outer/court-edge samples plus0.3 m. Footings sample edges at<=3 m. 16 triangulated ring masks preserve the entire retained courtyard hole;preview seating uses the same masks. Courtyard ground,park,roads and neighboring buildings stay host content. Exact thresholds,stairs and grade joins are unverified. Independently reproduced the unchanged retained 12-vertex outline and four-vertex courtyard, current two-fragment main polygon with 21 vertices, and named mosque POI. Sixteen triangle masks cover the retained building ring exactly and leave the courtyard unmasked. The low roof separately subtracts all four court recesses and the outer entry recess. All 744 footprint checks and 1,393 FrontSide probes pass: open sky and no authored floor at courtyard points, clear portals up to their backs, pointed soffits, niche backing, capped tower heights, roof/floor ring coverage and seated foundations. The standard DEM reproduces 1,017 ring, 311 perimeter and 1,402 seated preview samples and its 16-bit terrain image.

Individual Friday Mosque of Herat: retained irregular outer envelope and open courtyard;four pointed court iwans,a recessed eastern outer entry,paired taller west/east minarets,four lower court towers,turquoise caps,low pale flat roofs,blue/cream tiled pointed niches and selected coarse geometric tile fields. Original geometric rhythm suggests tilework without copying historic motifs or inscriptions. Court ground,detached buildings,park,street furniture,planting and furnished interiors remain outside the authored model. All internal divisions and vertical dimensions are estimates. No retained dimensional facts or current PMTiles height tags are available. All vertical dimensions are estimates: low ranges9.5 m;western prayer iwan27 m;other court iwans21–22 m;eastern outer entry25 m;paired western minarets33 m,eastern entry minarets35 m,and four smaller court towers22 m including turquoise caps. No large hall dome is added without a picture/map control. Fine tile art,calligraphy and vault decoration are abstracted. The exact retained relation supplies identity, outline, courtyard and an undirected plan axis. Facade direction is a visual estimate. Current PMTiles supplies the main ring and named POI but no height or roof-part controls. All tower counts/positions/heights, internal divisions, iwan roles, cap shapes, current finish, exact thresholds, stairs, artwork, interiors and engineering remain estimates or unverified. The two inspected pictures establish the visual vocabulary and do not establish the complete current condition.

## Verification

49 current views inspected; 1,393 FrontSide probes; 744 footprint checks; six zero-error/zero-warning Khronos validations. Source/runtime/input/material/capture/placement hashes agree. Raw map controls and the 16-bit terrain fixture reproduce. Source/placement checks, scene validate/sim30, selected LOD layout and Biome pass. Bulk captures remain ignored.

Source: sha256:6ad55cdb4593b887a4bc8701707a5486b9b1ac4d900a0ef037ab19c6d4ca85ca

Runtime: sha256:a0389f888a186662d84edf971973b43f7ebb951d64130c26ffe06ced7ce5401c

Input: sha256:74d9cf8ef3cb0dfa4441747c1abdc8dce5ab0720f52b3d0f024f4147a9975e05

Commands: targeted generate-additional-landmarks/import-structure-models/generate-landmark-lods/register-landmark-previews --ids=friday_mosque_of_herat; source/placement --check; capture-structure-models --reflections --antialias --fit-shadows; capture-landmark-library --reflections --adaptive-clipping --bounded-placement; capture-medium-fi --ids=friday_mosque_of_herat --reflections; scene validate/sim30; selected LOD layout; Biome. Existing builds reused.

## Inspected picture references

[Todd Huffman — 2011-01-15](https://commons.wikimedia.org/wiki/File:Friday_Mosque_of_Herat.jpg). CC-BY-2.0. Inspected960×640 exterior: large pointed blue/cream tiled entry,paired tall shafts with projecting galleries and small turquoise round caps,lower capped towers beyond,long closed pointed tiled niche fields and pale flat-roof ranges. The garden,snow,signs and lighting are not modeled.

[Pushpamwiki — 2025-12-13](https://commons.wikimedia.org/wiki/File:Great_Mosque_of_Herat.jpg). CC-BY-SA-4.0. Inspected810×468 low-angle iwan: tall tiled cylindrical shafts flank a large pointed portal;deep repeating pointed vault ribs,white/cream soffits,blue/turquoise/ochre geometric tile vocabulary and open side bays. Tower tops are cropped;precise artwork,calligraphy,vault cells,grilles and fixtures are not reproduced. This close view does not establish the whole current site condition.
