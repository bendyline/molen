# Heidelberg Castle — reviewed medium-fi exterior

Reviewed2026-10-12. **49 final rendered images inspected.**

Inspected all49 final images:11 portable,11 shared-material placement and27 medium-fi views. Main wings enclose the smaller open court; restored twin-gabled Friedrich wing, open Renaissance facades, broken powder towers, gate tower, Ruprecht roof, separate library/Ludwig ranges and arched protective Hall of Glass roof remain visible. Overall appearance compared with previously inspected aerial and numbered site picture. Named PMTiles/map wing positions replace the oversized combined draft ranges. Architecture remains a bounded exterior approximation.

Inspected all11 shared-loader images. Common sandstone, slate, ceramic tile and lime-plaster graphs provide reusable material detail; opaque local PBR glass supplies panes and protective roof. Each shared graph is fetched once and model unload releases geometry. Skyline uses actual shared linear means in one draw; detailed tiers use five draws. Six GLBs have zero embedded images.

Inspected all27 lighting/LOD images. Four tiers retain principal wing positions, roofs, open court, broken towers and gate silhouettes. District adds openings and arcades; street and close-up add frames, pilasters and coarse carved trim. Four tiers pass1000/4000/16000/64000 triangle limits. Synthetic context is diagnostic, not a reconstruction of Heidelberg. Fixed upper/lower wall inversions in the garden retaining geometry; thin terrace parapets and undersides are omitted at skyline distance.

## Placement

Picture-based current exterior registered to named mapped wings and the standard Protomaps/Mapzen PMTiles viewer data. +X south toward gate, +Z west toward English wing; signed orientation retains heading-1.430862687712. Working datum187.413498859529m and reconstructed court8.3m. Bounded lower walls follow coarse PMTiles ground; bridge and outer gate use separate levels. No surveyed threshold accuracy. Bespoke DGM1 verification remains deferred at the owner request. Portable previews use retained PMTiles-derived ground; shared north-up placement shows the model inside the mapped precinct. This is approximate picture/PMTiles fit. Flat shared-loader ground does not prove hillside contact. Temporary detailed DGM1 verification is deferred and is not a completion gate under the owner's revised workflow.

## Geometry and runtime

Selected master and all four authored tier meshes pass finite-attribute, Float32 degeneracy and normal/winding checks. Six current GLBs pass Khronos validation with zero errors/warnings/images. Source and runtime hashes match current files. Original6948-triangle/752596-byte master recipe remains unchanged against the saved original script; only the independent reviewed derivative and its scope changed. Shared material cache and unload checks pass. No full repository build or dependency audit was run.

skyline: 967 triangles, 87300 bytes, 1 draws; district: 3355 triangles, 297132 bytes, 5 draws; street: 5787 triangles, 516040 bytes, 5 draws; closeup: 7655 triangles, 668908 bytes, 5 draws. Initial skyline+district download384432 bytes, below3MB phone and6MB laptop limits. Separate POSITION/NORMAL streams avoid interleaved attribute uploads.

## Accepted limits

Accepted medium-fi present-day exterior reconstructed from reference pictures and standard viewer PMTiles. Original detailed heidelberg-castle-model.mjs remains available and unchanged. Component rectangles, roof shapes, floors, facade openings, bridge supports and western retaining walls are approximate. Coarse Mapzen terrain does not resolve exact thresholds or moat levels. No survey accuracy, interiors, terrain cutout, distant gardens or forest is claimed. Bespoke DGM1 terrain verification remains deferred. Physical laptop/phone timings and continuous-motion shimmer remain unmeasured.

## Reference pictures and map

- [Castle aerial](https://www.schloss-heidelberg.de/fileadmin/_processed_/4/7/csm_17_heidelberg_aussen_1976_2010_foto-ssg-achim-mende_crop825x548_1d1cb3172d.webp) and [numbered site picture](https://www.schloss-heidelberg.de/fileadmin/Broschueren/Abrissplaene/ssg_schloss-heidelberg_kunstfuehrer-lageplan.pdf), previously inspected; images not redistributed.
- Standard viewer PMTiles: Protomaps20261008 and Mapzen Terrarium; retained fit controls in pmtiles-fit.json. ©OpenStreetMap contributors/ODbL; elevation attribution retained in source metadata.
