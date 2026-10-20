# N0521 — Dakshineswar Kali Temple

Reviewed 2026-10-19. Completed in one continuous authoring/inspection round for the visible exterior and approximate map fit.

![Dakshineswar Kali Temple](preview.png)

## Visible architecture

Inspected current source, shared-material, medium-fi and retained-terrain renders during this same authoring round. Specific nine-spire Navaratna main shrine with four lower/four upper/one central crown, bowed cornices, cream/red facades, five recessed arch bays, raised platform and south steps; separate southern Natmandir and northern shrine; twelve red double-curved-roof riverfront shrines in two rows around an open passage; low mapped boundary wings. Closed an observed cornice-underside gap, added the missing red panel/frieze rhythm, separated the west shrine row from boundary wings and widened the main-spire review camera. The native broad shell is replaced with an open compound. Unique LOD camera filenames prevent overwritten images. Refined the skyline cornice to retain its bowed silhouette. Unchanged master/source/shared views were carried forward only after checking all other spec/scope fields, master and other-level GLB hashes, camera poses and every retained image hash. The affected level views were captured again.

## Shared materials

Three reused 256-square graphs: lime plaster, raw limestone and painted metal. Cream/red roles share the same plaster texture with linear palette tints. Metric UVs, no embedded images or unique atlas, one read per graph, at most four model draws, separate GPU streams and geometry disposal on eviction. Flat/shared stages show buried bases and do not prove terrain contact; the native-grid fixture supplies that check.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 876 | 94172 | 1 |
| district | 3623 | 364368 | 4 |
| street | 12814 | 1243996 | 4 |
| closeup | 30742 | 2860884 | 4 |

Inspected 24 current medium-fi views: noon/late, Economy/High, street/block/skyline, silhouette, three details, four explicit levels and transitions. Levels 876 / 3,623 / 12,814 / 30,742 triangles. Initial skyline-plus-district geometry 458,540 bytes. All nine main spires, twelve subordinate shrines and open layout remain at distance; crowns, real recess depth, red panel rhythm and small rails resolve nearer. Physical laptop/phone and dense-city timings remain pending.

## Map and terrain

Q1157765 and way291865633 identify the mapped compound. Standard PMTiles record35184663954465 supplies its precise irregular outer outline; it currently has no courtyard holes or individual temple plans. Replace that one broad native shell with an open compound. Align local east/south about6degrees to the mapped walls. Main-shrine, Natmandir, northern shrine and twelve riverfront-shrine centers/dimensions are explicit picture-led subdivisions inside the boundary, not surveyed footprints. The south-facing main approach and western riverfront give signed orientation. Preserve every independent surrounding map record. Pinned standard Protomaps2026-10-14 and Mapzen13–14 terrain. Retain the original six-meter native grid and water. Each principal building has a locally sampled level datum and buried base; the main floor is raised about2.2m. Low boundary wings follow coarse native grade with buried bottoms. No terrain/water cutout or river surface is authored. The DEM does not resolve historic courtyard paving/ghat levels; exact thresholds and embankment engineering are approximate. The single native compound record is replaced to a boundary residue below 1e-7 square meters; all 408 independent in-tile buildings are byte-identical. Native ground and original Hooghly/pond water geometry stay unchanged. Failed loading restores all 409 original buildings; eviction releases all model geometry. Grass/ground and water classes in the fixture are host context: this model does not repaint the whole court, add the ghat embankment or reconstruct landscaping.

## Limits

Dakshineswar Kali Temple medium-fi compound: the specific cream/red nine-spired Navaratna main shrine with four lower/four upper/one central ridged spires, strongly bowed cornices, five-bay recessed arches, raised platform and south approach; a separate southern Natmandir hall and northern shrine, twelve small red double-curved-roof Shiva shrines along the riverfront split around the central passage, and mapped low courtyard boundary wings. Keep the court open and the Hooghly outside the asset; no large solid compound extrusion. Q1157765 and way291865633 identify the mapped compound. Standard PMTiles record35184663954465 supplies its precise irregular outer outline; it currently has no courtyard holes or individual temple plans. Replace that one broad native shell with an open compound. Align local east/south about6degrees to the mapped walls. Main-shrine, Natmandir, northern shrine and twelve riverfront-shrine centers/dimensions are explicit picture-led subdivisions inside the boundary, not surveyed footprints. The south-facing main approach and western riverfront give signed orientation. Preserve every independent surrounding map record. Daylight pictures guide the main three diminishing bowed stages, four-plus-four-plus-one spire silhouette, cream plaster/red pilasters, ribbed conical-curved crowns, five-bay arcades, plinth and shallow stairs. Main total height is estimated about31m above its approach, with subordinate hall about7m and small riverfront shrines about7m. Fine mouldings, rib counts, sculpture, inscriptions, exact balcony/door patterns and hidden interiors remain simplified; later restoration paint is not independently certified. Pinned standard Protomaps2026-10-14 and Mapzen13–14 terrain. Retain the original six-meter native grid and water. Each principal building has a locally sampled level datum and buried base; the main floor is raised about2.2m. Low boundary wings follow coarse native grade with buried bottoms. No terrain/water cutout or river surface is authored. The DEM does not resolve historic courtyard paving/ghat levels; exact thresholds and embankment engineering are approximate. Accepted for medium-fi exterior and approximate standard-map fit. The large outer outline is mapped; all internal positions/dimensions and facade motifs remain picture-led estimates. Recesses have opaque backs and closed floors; no navigable/furnished interior, idols or exact sacred iconography is modeled. Courtyard paving, landscaping, river ghat and exact current repair/paint are not authored. Context buildings remain native procedural shells.

## Selected checks

Two registered recipes rebuild the 3,692,008-byte source master. Six Khronos files: zero errors/warnings. 336 actual mesh probes pass. Inspected 48 current views (8 source, 8 shared, 24 medium-fi, 8 site/fallback). Scene validation/sim 30 and strict selected medium-fi audit pass. The 525-complete milestone now requires the broad source rebuild and current input-key bundle-stamp refresh, plus the pending N0512 renderer/selected-readiness release gates. This checkout uses source-input keys rather than asset-lock.json.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0521; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0521; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0521 --force.

Source: sha256:742761bdce090ef12fe86268c35a915431ee16ba55f13d8631359b593d0c37f7

Runtime: sha256:035b2a1050379454a9b7d377895ebf1ea2748615b53e2ccfc6bd60eb0525fe3c

Input: sha256:b573713f1883aa2b3c991eef1c3c0234622c2692304ed801c494c10649f5a999

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:Dakshineswar_Kali_Temple_(7169302531).jpg — shankar s.; 2009-05 (file-page; EXIF2009-05-06); CC BY2.0; viewed only. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Dakhineswar_temple_Kali.jpg — Prithwiraj Dhang; 2023-09-23; CC BY-SA4.0; viewed only. Viewed only; no pixels copied.

https://commons.wikimedia.org/wiki/File:Dakshineswar_Kali_Temple,_Dakshineswar,_West_Bengal,_India_(2007).jpg — asis k. chatt; 2007-05-20 (EXIF; original upload2007-06-10); CC BY-SA2.0; viewed only. Viewed only; no pixels copied.
