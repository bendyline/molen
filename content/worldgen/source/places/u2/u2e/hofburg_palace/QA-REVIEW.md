# hofburg_palace Hofburg Palace — reviewed medium-fi preview

Reviewed 2026-10-11. **89 final images inspected**: 16 portable, 16 with shared materials, 32 medium-fi, and 25 against retained city terrain.

## Source and repairs

The original master remains reproducible from `packages/worldgen/scripts/hofburg-palace-model.mjs#hofburgStudy.build`: 606,293 triangles, 52,576,076 bytes, SHA-256 `79084a947c6c83616f25e862fab35a882027b1012e91d045614889f344256de9`.

The independent `hofburg-runtime-model.mjs` repairs jagged roof ridges, clips courtyard holes where they cross wing boundaries, raises the Albertina to its working terrace level, removes the duplicate solid bastion, adds the dark canopy pylon, closes conservatory ends, and lowers the garden balcony to its evidence-guided level. Checked numerical [roof plans](roof-plans.json) are source inputs; the normal JavaScript GLB build needs no Python.

The inspected views retain the separate palace wings, curved Neue Burg, Michaeler domes, Amalien clock, library dome, Augustinian spire, open courtyards, raised Albertina and long Palmenhaus. A low camera looks through the real diagonal Michaeler passage. Whole turntables cover a 443-metre complex; feature cameras supply detail.

Generate only this model with `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=hofburg_palace`, import it, then build its source-local runtime levels.

## Shared materials and browser levels

Seven shared graphs supply plaster, limestone, ceramic tile, copper, timber, granite and painted metal; opaque PBR glazing is the eighth close-up material. Limestone also serves carved trim. Tinted painted metal serves small gold pieces, and tinted ceramic approximates the slate spire. These substitutions are explicit medium-fi approximations. All six GLBs contain zero embedded images. Shared-material loading reads each graph once; unloading leaves zero model geometries.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 974 | 78,976 | 1 |
| district | 3,995 | 308,972 | 7 |
| street | 14,599 | 1,102,420 | 7 |
| closeup | 59,792 | 4,778,304 | 8 |

Initial skyline plus district download: **387,948 bytes**. Reviewed source: 5,198,592 bytes. Street and close-up retain grouped windows, columns, pilasters, roof planes and the passage. District groups secondary windows; skyline omits close-up ornament and the canopy pylon. Noon, late light, economy/high settings and four transitions were inspected. Surrounding props in those views are synthetic context.

## Signed placement and terrain

Fresh OSM relation 3898175 identifies Q46242. Its 123 component ways agree with retained source vertices within 0.694 mm. Native +X points north at 2.678°, and +Z points east at 92.678°. Domes, clock, curved wings and Albertina establish the signed orientation. The precinct envelope includes open space, so whole-precinct replacement remains disabled.

A retained public Vienna 1-metre Float32 DGM crop covers tiles 35/3 and 35/4 in EPSG:31256. Its native 5-metre grid contains 10,197 finite heights. Published height datum: Wiener Null, EPSG:8881, 156.68 metres above Adria. Model Y=0 is a reconstructed working gate datum of 18.85 metres Wiener Null. Production placement subtracts the actual source-anchor grid height of −0.3728 metres.

Albertina's +9.56-metre floor, the 15-metre canopy and 4.45-metre garden balcony are working reconstructions. Terrain supplies the bastion earth. Occupied foundations extend below local relief. Three ground probes show 0.015-metre clearance; sampled Swiss, Albertina and Amalien foundation rays pass at near levels. The passage remains open at every level. All five unload cycles restore terrain and leave zero model geometries.

Exact requests, crop hash, conversion and attribution: [site-grade.json](site-grade.json). Production terrain captures: [grade report](shots/grade/report.json). City data attribution: **Datenquelle: Stadt Wien — data.wien.gv.at**, CC BY 4.0. Map plan: © OpenStreetMap contributors, ODbL-1.0.

## References and limits

Actual photographs were inspected on the heritage owner's pages: [Michaelertrakt](https://www.burghauptmannschaft.at/Liegenschaften/Liegenschaften/Wien/Hofburg-Wien-/Michaelertrakt.html), [Neue Burg](https://www.burghauptmannschaft.at/Liegenschaften/Liegenschaften/Wien/Hofburg-Wien-/Neue-Burg.html), [Amalientrakt](https://www.burghauptmannschaft.at/Liegenschaften/Liegenschaften/Wien/Hofburg-Wien-/Amalientrakt.html), and [Albertina](https://www.burghauptmannschaft.at/Liegenschaften/Liegenschaften/Wien/Hofburg-Wien-/Albertina.html). Photos remain linked, not copied as textures. City [DGM download information](https://www.wien.gv.at/stadtplanung/digitales-gelaendemodell-daten-beziehen) and [OGD datum information](https://www.wien.gv.at/stadtplanung/geodatenviewer-ogd-daten-herunterladen) document the terrain. Roof plans were authored with [py_straight_skeleton 0.1.0](https://github.com/iconbuild/py_straight_skeleton).

Roof slopes, ridge plateaus, bay counts, opening positions, small ornaments and working floors are reconstructed. Figurative monuments, detailed capitals, balustrade stems and the Palmenhaus central cross pavilion are omitted or simplified. No complete interiors or underground rooms are claimed. Under-roof DGM interpolation does not survey occupied floors. The 5-metre fixture smooths steps; display terrain clamps only outside the bounded crop. Exact acquisition vintage, vertical precision, host terrain compatibility and physical phone/laptop timings remain unverified.

## Checks

Three focused tests pass: original-master byte reproduction and current evidence hashes; roof-plan coverage, court holes and passage geometry; deterministic four-level rebuild, budgets and separate 12-byte POSITION/NORMAL streams. Six GLBs pass Khronos validation with zero errors, warnings and embedded images. Strict medium-fi findings are empty. These are sampled integrity checks, not exhaustive manifold or as-built certification.

Current hash-bound approval: [qa.json](qa.json).
