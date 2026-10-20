# N0489 — Karnak Temple Complex

Reviewed2026-10-18 for the declared principal medium-fi exterior and approximate standard-map/DEM fit.

![Karnak overview](preview.png)

## Exterior

Principal exterior visualization reviewed:the Amun entrance/courts,hypostyle hall,eastern pylons/obelisks,shrines,Akhmenu,east temples,sacred lake,southern processional pylons,Khonsu,Opet,Bab El Amara,Ptah,Taharqa,northern/entrance chapels,peristyle,Montu and southern Mut exteriors. Inspected100current official views:28portable,28shared-placement,44medium-fi. The28portable frames retain the byte-identical inspected contact sheets after the final metadata update. Another21selected actual-site/fallback/partial views establish approximate terrain fit. Open courts,doorways,lower pockets,stairs,banks and broken columns remain legible at their intended levels.

## Shared materials and browser levels

Three shared256² graphs: sandstone,raw sandstone and granite;five near merged materials include explicit local matte ground and still-water constants. Linear pale/red/stone tints,metricUVs,separateGPUattribute streams. No embedded images or unique atlas. Every shared graph loads once and unloading disposes all model geometry. Isolated shared-placement ground sits below the model to reveal every group;its cutout holes and floating edges do not claim actual terrain fit. The separate unmodified-DEM fixture establishes that fit.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 992 | 104336 | 1 |
| district | 3858 | 338836 | 5 |
| street | 15622 | 1448292 | 5 |
| closeup | 56514 | 5629584 | 5 |

All four LODs meet1000/4000/16000/64000triangle budgets and at most5draws. Initial skyline+district443172bytes plus shared graphs. Distant levels retain principal pylons,site layout,obelisks and both lakes;small columns,chapel openings and fine roof supports are intentionally omitted in remote levels. Street/closeup restore exterior rhythm and openings. Reviewed Economy/High,noon/late,three distances,silhouette,all LOD overviews and transitions under the common Earth rig. Physical phone/tablet/laptop and dense-city timings remain pending.

## Geographic placement and streaming

Approximate exterior placement from retained standard viewer PMTiles and unmodified161-square/16m DEM plus ordinary pictures. The hypostyle-hall control anchors the signed26-degree axis;native+X points ESE,+Z SSW,+Y up. NativeY0 is the DEM sample at the exact model anchor. Independent temple/shrine groups use retained-DEM neighborhood medians;processional and approach ramps connect their levels. Both lake levels use retained native-water lower quartiles. Thirty-one covered ground pockets and52separate building masks preserve432independent retained building records. Actual DEM tile:365independent records unchanged. Native-water replacement is limited to the two modeled lake footprints;failed loads,partial residency and eviction preserve or restore unloaded surfaces. Architectural grades and point-derived envelopes/facing remain visualization estimates,not surveyed archaeological elevations or hydrology. At all4LODs,124pocket/LOD combinations pass29856floor samples. The417-building actual tile preserves all365independent records. Three guarded authored shared-edge remnants remain,largest0.0204m²;no whole duplicate temple footprint. Partial512m residency preserves unloaded Mut water and terrain. Failed loading retains all417map buildings and native water/ground;eviction restores both surfaces. Global heading is the mapped26-degree signed axis;independent temple/shrine axes are retained inside it.

## Limits

Medium-fi exterior visualization,not a surveyed or navigable archaeological reconstruction. Standard DEM resolution creates approximate excavation/foundation edges. Point-derived Montu25m/20degrees,Taharqa10m,mainMut12m/8degrees,TempleA22m/15degrees and ChapelB22m uncertainties remain explicit. Other heights,ruin profiles,column counts,stairs,water levels and small forms are picture-guided estimates. Fine sculpture,reliefs,inscriptions,hidden historic interiors,exact stone inventories,vegetation and full ancient roofs are omitted. Host terrain data can alter contact. Model creation introduced no bespoke survey or additional terrain source.

## Source and verification

Eight registered recipes reconstruct the graded master and ground joins. buildKarnakUnposed retains the original62882-triangle detailed master byte-for-byte;its hash is sha256:8e36f9286429cc0fb506cc7bdd248d53ba8084a374fd72e5012bcb887fe5f2fd. Current sixGLBs pass Khronos with zeroerrors/warnings,1043grade-aware geometry probes and294coordinate round-trips. Strict medium-fi checks,source/import/placement checks and scene validate/sim30 pass.

Generate/import/force LODs/register with --ids=N0489;capture-next-1000-models --reflections --antialias --fit-shadows;capture-landmark-library --reflections --adaptive-clipping --bounded-placement;capture-medium-fi --ids=n0489_karnak_temple_complex --reflections. Source retains ordinary-picture references,standard-map controls,the unchanged raw DEM,source-local preview terrain,31ground pockets,52building masks and2water masks. Bulk captures remain ignored.

Runtime water/mask changes have46targeted tests and both changed-package typechecks passing. The full runtime milestone passed:pnpm verify,smoke:packed,docs:site:check and test:golden. The production audit reported one high finding below its critical failure threshold;WebGPU tests skip where unavailable. Normal model-only production continues with targeted checks.

Source: sha256:9ab959bed4ff351bb7aec618eadc6cb2693cadec4600ed637037037d03e7428b

Runtime: sha256:15e7c5099aa20faab38a54395f4cd900f24dc421650b39db2c03115dbd61571d

Input: sha256:5a89b5c6487903f5c1ef2969b9bc04e02f47564a44bf30846332b5ee69c03bca


