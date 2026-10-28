# Richmond Bridge, London

Reviewed 2026-10-27. **Scoped medium-fi exterior and approximate native placement complete.**

![Richmond in the native viewer](preview.png)

Inspected 62 current frames: 11 portable, 11 shared-material/geographic, 23 medium-fi and 17 native. Five unequal masonry arches with a larger centre, humpback deck, raised outside walks, open pear-shaped balusters and square interval posts, rounded full-height pier heads, stepped cornices, individual voussoirs and eight framed gas-style lanterns remain present. Fixed small baluster-to-rail gaps and added lantern base plates in this same authoring pass. Contact probes now verify both stone joints. Distant levels retain the silhouette and simplify curves, rail infill and lamp fittings.

Four existing shared 256px graphs: stone_limestone, stone_limestone_raw, concrete_plain and metal_painted. Metric UVs and linear vertex tints; carved balusters use raw stone rather than masonry coursing. One local transparent lantern-glass material adds no image. Near levels use five merged material groups; skyline uses one mean-tinted group. No embedded/private textures or copied photo pixels. Each graph is read once per native view; all runtime files use separate GPU attribute streams.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 652 | 53464 | 1 |
| district | 3772 | 320524 | 4 |
| street | 15480 | 1270356 | 5 |
| closeup | 48280 | 4294884 | 5 |

Detailed source master: 137848 triangles / 16545092 bytes. Runtime levels: 652 / 3772 / 15480 / 48280 triangles, 53464 / 320524 / 1270356 / 4294884 bytes, 1 / 4 / 5 / 5 draws. Initial skyline plus district is 373988 bytes. Strict medium-fi ceilings pass; physical laptop/phone timings remain unmeasured.

Retained exact-QID OSM way 576808129/Q487356 and fresh named Richmond Bridge/A305 PMTiles crossing establish the geographic identity. Anchor [-0.307086178,51.457362863], heading 0.754105270811: +X northeast toward Richmond town centre, -X southwest toward St Margarets/Twickenham, +Z southeast/upstream along the Thames. The 141.898 m by 10.603 m mapped plan is retained, with a declared approximate crown and source datum 2.0348180770874023m beneath native water 2.6348180770874023m. All 18 boundary width samples have model support. Twelve retain map paving and meet within 0.019912m; six lie inside the replacement, including two parapet-edge hits which are not described as road-floor joins. Ten additional outside-end lane/walk samples retain model/map paving within 0.023637m. These are renderer-fit results, not surveyed geographic accuracy.

All 2857 resident buildings, 881 input road records and 806 independent road records remain. Four separate railway/lock crossing records and 26 checked tunnel/cross-bank path records retain their inputs and receive no authored connections. Raw roads, DEM samples, displayed ground and water remain unchanged; connected bank paving is deliberately graded. Failed loading retains the original map crossing; unload releases all model/support geometry. No ground cutout was used.

## Reconstruction limits

- Scoped bridge exterior only. Pinned map plan 141.898m by 10.603m is retained as a straightened millimetre-level outline; photo-led unequal arch proportions, height, deck crown, pier heads and ornament are visual approximations, not surveyed engineering sections.
- Five opening widths 21/21.2/27.4/21.2/21m, elliptical rises and four 3.8m piers are inferred from ordinary photographs. Exact masonry bond, inscriptions, gas-lamp castings and widening construction joints are not reconstructed.
- Source datum 2.0348180770874023m follows the native semantic water surface at 2.6348180770874023m and a declared bank/crown grade. Raw water polygons vary locally in height; no tide stage, surveyed threshold or historic water-level accuracy is claimed.
- Connected map bank paving is deliberately graded to the authored deck. Small 1.5m flared apron overlaps cover generalized road/footway edges; raw roads, terrain and water remain inputs. Surrounding quays, steps, buildings, trees, signs, boats and newer crossings are procedural context.
- Distant LODs simplify arch curves, rail infill, pier-head facets and lamp fittings; skyline uses a coarser crown and solid parapet band. Nearer levels retain open vase-shaped balusters, individual arch voussoirs, rounded heads and framed lantern panes. Physical laptop/phone timing remains unmeasured.
- Coarse present-day banks partly obscure the two outer arch openings in native views. All five complete openings remain in the model and asset views. Exact riverbanks, quays and under-bridge footpath levels are not reconstructed.
- The six replacement-interior width samples include two hits on parapet edges; only the twelve remaining map-paving samples support the reported boundary join metric.
