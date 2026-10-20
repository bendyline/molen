> Historical review. Current public-domain imagery and new construction are recorded in CONSTRUCTION-REVIEW.md and qa.json;earlier reference photographs are excluded from the latest construction. Geographic placement remains held.

# Humayun’s Tomb — exterior review; placement held

The authored asset represents the main mausoleum and its raised terrace. Separate gates, other garden tombs, water channels, trees, furnishings and burial-chamber interiors are outside scope. The ordinary catalog identity and folder are `humayuns_tomb`.

All 60 local candidate thumbnails and three complete original photographs were inspected. The daylight oblique and south-front photographs control the red sandstone, white inlay, deep pointed iwans, clipped corners, terrace arcade and open chhatris. The sunset photograph is a silhouette comparison; its warm light does not define marble color. Photograph paths, dates, authors, licenses and byte hashes are in `reference-images.json`. No photograph pixels are embedded in the model.

The native Protomaps/OpenStreetMap lower platform, clipped terrace, 24-edge mausoleum and roof-part outlines are retained in `map-frame.json`. The named POI and lower platform share an identity. The frame and dry southern path datum were fixed before the independent terrain sources and before geometry. Quantized height tags are evidence, not measured architectural dimensions: in particular the 20–28 m drum part does not establish an exposed eight-metre red cylinder. The visible low drum and dome profile follow the photographs. The model uses an approximate 42.5 m overall finial envelope; the exact datum of UNESCO’s height description is ambiguous, and the modeled 38 m marble crown is an interpretation.

Primary architectural references:

- [UNESCO physical description](https://whc.unesco.org/en/list/232/) supports the irregular octagon, deep platform cells, central arched recesses, marble double dome and tiled smaller kiosks.
- [AKTC conservation account](https://the.akdn/tg/project/humayuns-tomb-conservation-completed) supports the sandstone/marble treatment, restored roof-canopy tiles and raised platform. Its 68 ground-level mausoleums agree with the 17 cells along each of the four long terrace fronts. The four short chamfer treatments are conservative estimates.

The four authored levels retain the native plan, dominant dome, four large open kiosks and eight small kiosks. The two nearer levels retain terrace recess depth and more inlay; district terrace arches are opaque proxies. Fine jaali patterns, capitals, stone joints, exact vault curvature and unseen elevations remain estimates. The closeup level is a recognizable exterior reconstruction, not a scan or a navigable interior.

Geographic completion is held. The original Terrarium composite rises from approximately −0.20 to +9.65 m along the lower platform perimeter relative to the independently chosen dry datum, cutting through the terrace. A separate original Copernicus surface raster gives approximately −2.15 to +5.02 m and also fails contact. Both are surface models that can include structures and vegetation. Their source bytes were preserved before geometry; the building and terrain were not stretched, flattened or cut out to force a fit. `ground-comparison.json` records the second source, byte ranges, independent decoder comparison and rejection. `terrain-sources/verify-derived-grid.py` reproduces all 66,049 Terrarium-derived grid values from the retained original tiles without changing them.

`qa.json` binds the current source, runtime, input and capture identities. Its exterior checks are separate from geographic acceptance. No active Earth placement or completed story annotation has been added. The model remains in the local batch until compatible ground contact passes; the overall goal remains active.
