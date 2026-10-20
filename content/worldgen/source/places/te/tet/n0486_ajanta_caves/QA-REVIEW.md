# N0486 — Ajanta Caves

Reviewed 2026-10-18 for its declared main-frontage medium-fi exterior and approximate map fit. This review explicitly excludes upper excavations29/30 and fine cave artwork.

![Molen preview](preview.png)

## Exterior

Inspected all 11 current portable views, including the retained 1024×640 summary. A continuous polygonal horseshoe cliff has layered basalt faces, a variable rock cap, a connecting ledge, recessed pillared porticos, two estimated double-height galleries and four larger arched chaitya fronts (9/10/19/26). Coarse cornices, jambs, columns, arch moldings and sparse frieze blocks abstract the exterior without reproducing historic artwork. The sharp bend at cave16 initially left green slits beside the recess; jambs and ceilings now meet the actual angled cliff panels. Current renders and edge probes confirm the correction. Both cliff ends are closed. Recesses have shallow closed back walls, floors and ceilings; they are not reconstructed navigable cave interiors.

## Shared materials and browser levels

Inspected 11 current shared-material/geographic views. Three existing shared256² graphs—raw basalt, plain concrete and painted metal—serve five semantic roles merged into four near materials. Metric UVs and linear tints; no embedded images, photo textures or unique atlas. The actual viewer reads each graph once, places the current model with the retained heading and rebased terrain reference, opens the occupied narrow cliff ribbon, and restores terrain/disposes geometry on unload. Flat placement views show approximate pose and cutout operation; they do not establish surveyed cliff geometry. No building footprint replacement is enabled; all four independent mapped neighboring buildings remain.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 548 | 59752 | 1 |
| district | 2890 | 271832 | 3 |
| street | 6218 | 614184 | 4 |
| closeup | 10466 | 1047556 | 4 |

Initial skyline plus district: **331,584 bytes**, plus three existing shared256² graphs. Detailed source: **12826 triangles / 1542068 bytes**.

Inspected all 27 current medium-fi views: Economy/High, noon/late light, street/block/skyline, silhouette, six details, four matched LODs and four transitions. Every level retains the horseshoe cliff and entrance rhythm. Skyline uses deliberately opaque recess and arch fields; district adds open recesses, square columns and simple chaitya surrounds; street/closeup add shaped columns, carved bands, sparse relief and arched-window framing. Coarse faceted rock and estimated proportions are intentional exterior abstractions. The standard DEM fixture remains approximate and synthetic surrounding context is illustrative. Physical laptop/phone/tablet and full-city timing remain pending.

## Map fit and limits

Retained Q184427 way/115567314 preserves its archaeological-site boundary,anchor,undirected axis,original tags and empty dimensions. That boundary is not extruded. Standard PMTiles supplies23 coherent numbered entrance points on the horseshoe cliff,plus two valley-displaced labels27/28 retained as rejected controls. Caves3/18/20 are interpolated gaps and27/28 are estimated endpoint continuations. The frontage is one connected rock-cut landform;not a collection of separate buildings or a surveyed cave plan. Standard Protomaps20261014/Mapzen-USGS viewer extractN0486;datum 439.8989605384872 m (original DEM datum 437.06629439875877 m;model origin rebased by 2.832666139728417 m so the lowest cliff base is Y=0). Source grid161²/6 m is retained. The source preview carves only the occupied cliff ribbon below its floor/bottom and uses a12 m fixture margin for its6 m height grid. The open valley and neighboring buildings remain independent. Finished grades,cliff stability,depth of real caves and host terrain accuracy are unverified. Independently checked23 map entrance coordinates, all25 retained raw entrance features, the rejected27/28 valley labels and five inferred frontage positions. The archaeological boundary remains evidence only; it is not extruded. One60-vertex occupied ribbon preserves the open valley. All four independent nearby building records are unchanged. The original DEM grid and a rebased101² preview fixture reproduce, including880 seated samples. The model origin is shifted by2.832666139728417m to the lowest cliff base; terrainReference.modelHeight compensates by the opposite amount. Raw coarse entrance heights are not surveyed thresholds. All714 current FrontSide probes pass for near recesses, doors, arch openings, floors, ceilings, continuous ledges, closed ends and the corrected angled jamb joins; skyline is checked as an opaque proxy.

Ajanta Caves main horseshoe-cliff exterior,with28 numbered frontage reconstructions:23 current map-controlled entrances,three interpolated gaps and two estimated endpoints. Includes open recessed porticos,selected double-height galleries,picture-guided chaitya facades9/10/19/26 with large arched windows and door groups,a connecting ledge and layered basalt rock shell. The archaeological boundary is retained only as evidence. Upper excavations29/30,fine sculpture,paintings,deep/navigable interiors,trees,river,bridges,modern visitor buildings and engineering are excluded. No architectural height facts or entrance elevations are supplied. Raw standard DEM heights at the23 mapped and five inferred frontage positions are retained. The review ledge uses their median plus15 percent of local deviation to avoid treating the coarse sloping DEM as surveyed cave thresholds. Cliff bottoms extend to sampled valley-side grade or10 m below the ledge;tops meet sampled rear grade or18 m above the ledge. Cave widths,depths,opening heights,chaitya proportions,upper galleries and rock strata are original picture-guided estimates. Unverified upper excavations29/30,exact sculptures,paintings and interiors are not reconstructed. The model reconstructs28 main-frontage positions:23 map-controlled, three interpolated gaps and two estimated endpoints. Upper incomplete/unverified excavations29/30 are omitted. Rock strata, ledge level, widths, depths, facing, architectural subdivisions and present condition remain estimates. Fine sculpture, paintings, historic inscriptions, deep interiors, river, vegetation, visitor facilities, surveyed grades and engineering are not supplied. This is an original medium-fi exterior visualization, not a surveyed complete site reconstruction.

## Verification

49 current views actually inspected;714 FrontSide probes;23 mapped entrances;four preserved host buildings;reproduced terrain fixture; six zero-error/zero-warning Khronos validations. Source/runtime/input/material/capture/placement hashes agree. Targeted source and placement checks, scene validate/sim30, selected LOD layout and Biome pass. Bulk renders stay ignored.

Source: sha256:7ebea24836d23e67be735b7d524ce67f8ed30a1a494136f7882edb2b56036480

Runtime: sha256:e974c898796f8a33482e6bbd61be682b2d70f00b8ffe38fc7ea209699113652c

Input: sha256:35adcf720b5e63925f9cddc65771192bc2f264a9407d0dc00b3d9f5dc238e7e7

Commands: generate-additional-landmarks/import-next-1000-models/generate-landmark-lods/register-landmark-previews --ids=N0486; source/placement --check; capture-next-1000-models --reflections --antialias --fit-shadows; capture-landmark-library --reflections --adaptive-clipping --bounded-placement; capture-medium-fi --ids=n0486_ajanta_caves --reflections; scene validate/sim30; selected LOD layout; Biome. No dependency audit, repository-wide build, Git mutation or upload.

## Inspected picture references

[Shreyans69 — 2015-06-28](https://commons.wikimedia.org/wiki/File:Panoramic_view_of_Ajanta.jpg). CC-BY-SA-4.0. Inspected1280×519 wide cliff panorama. The continuous horseshoe scarp has horizontal rock bands,an irregular upper rock cap,recessed rectangular pillared galleries,selected large arched chaitya fronts and a narrow connecting terrace. Trees obscure the lower ravine;no individual cave dimensions or survey heights are inferred from pixels.

[Vasukrishnan57 — 2011-12-03](https://commons.wikimedia.org/wiki/File:Facade,_Cave_19,_Ajanta.jpg). CC-BY-SA-4.0. Inspected960×720 upper Cave19 facade:large horseshoe-like arched window with concentric molding,projecting layered cornices,side pilasters and dense sculptural registers. Geometry abstracts bands,niches and arch silhouette;exact sculptures and artwork are not copied.

[Photo Dharma /Anandajoti Bhikkhu — 2017-03-10](https://commons.wikimedia.org/wiki/File:079_Cave_26,_Exterior_of_Chaitya_Hall_(33535465394).jpg). CC-BY-2.0. Inspected960×640 Cave26 exterior:large upper arched window with radial framing,three lower dark doorway groups,stepped carved jambs,a broken horizontal rock ledge and shallow relief registers. Used as an original coarse facade reconstruction. An additional picture establishes the lower facade omitted by the Cave19 crop.
