# N0503 — Temple of Saturn

Reviewed 2026-10-19. Accepted for the specific medium-fi present-day Roman Forum ruin and approximate PMTiles/DEM fit.

![Current modeled ruin](preview.png)

## Exterior and shared materials

Inspected all 10 portable views. The specific present-day Roman Forum ruin has eight mapped smooth granite columns: six across the northeast front and two short returns. Tiered bases, coarse Ionic volutes, surviving U-shaped marble entablature, recessed restoration inscription, broken upper pediment masonry, occupied podium, low mapped wall fragments and three bounded chamber niches are modeled. The roof and missing cella remain absent. Current renders prompted correcting inward wall sides, faint and mirrored lettering, an obscured chamber detail camera and overly regular upper masonry. Fine carving, repairs, chamber allocation and damage remain medium-fi estimates.

Inspected all 10 shared-material views. Five common 256-square graphs provide granite, marble, weathered limestone, long-format brick and gravel through metric UVs and linear tints. Each graph is read once; eviction releases geometry. No embedded images, unique atlas or copied photograph. Letter recess backs reuse the granite graph for contrast under the engine lighting; this is an approximate stone-color treatment, not a replica of each weathered letter. Five near draws and one skyline draw. Flat-stage previews expose buried retaining depth; actual contact was reviewed on the original standard DEM separately.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 662 | 69056 | 1 |
| district | 2110 | 212812 | 5 |
| street | 5150 | 527528 | 5 |
| closeup | 10869 | 1086592 | 5 |

Inspected all 26 medium-fi views: street/block/skyline at noon and late afternoon in Economy/High, an untextured silhouette, five architectural details, all four complete-ruin levels and transitions. Levels 662/2110/5150/10869 triangles retain all eight column positions, open bays, U-shaped entablature, broken upper masonry and roofless podium. District adds profiles and coarse Ionic scrolls; street adds chamber recesses, selected cornice stones and loose rubble; closeup adds recessed readable inscription geometry, selected rear frieze lobes and repaired shaft joints. Initial skyline plus district geometry totals 281868 bytes, plus five reused common graphs. Separate attribute streams avoid duplicate GPU uploads. Physical-device and dense-city measurements remain pending.

## Geographic fit

Reviewed approximate full-site fit on the unchanged161-square/6m standard DEM. Thirteen original mapped components retain97 vertices, including eight separate column centres. Six front columns face northeast, with two short rear returns; the ordinary front inscription photograph resolves the signed orientation. Geometry retains raw east/south coordinates at heading0, with a35.5237-degree internal architectural rotation. The occupied podium top clears every rendered grid cell intersecting its bounds by at least0.200001m: all81 bounding grid vertices were checked, so triangle interpolation cannot rise through it. Deep retaining sides and bounded chamber recesses enclose the native ground without any terrain/water opening. Full-site loading replaces13 authored records and preserves1932 independent tile buildings exactly. All2831 independent buildings in the retained extract are outside the replacement envelope;328 nearby records are retained in source, including the13 controls. Native water remains unchanged at127038.71519859218 square metres. Failed loads preserve1945 native tile buildings; eviction releases model geometry. Synthetic10m partial residency clips away the remote columns, entablature and much of the podium while preserving original ground under and outside the clipped model. Full architecture requires surrounding tiles; the partial fixture does not establish architectural completeness. The surrounding unmodeled Forum ruins still use the generic procedural renderer and are not historical reconstructions. Height, chamber placement, damage and stone profiles remain approximate; no surveyed thresholds are claimed.

## Scope and limitations

Accepted for the specific medium-fi present-day Temple of Saturn ruin and approximate standard-map/DEM placement. Thirteen mapped components retain 97 original vertices, including eight separate column centres. Ordinary northeast front and western reverse photos establish six front columns, two short returns, smooth granite shafts, Ionic capitals, the front restoration inscription and reused ornate rear band. Geometry uses raw east/south coordinates at heading 0, with a 35.5237-degree internal rotation. The surviving podium envelope is approximately 27×39m and the front column span about 19m. Podium mass, shaft/capital heights, 17.5m entablature top and irregular 19.15m upper core above the lower base datum are picture-guided estimates. Broken profiles, selected cornice blocks, simplified Ionic volutes, block lettering and three recessed chamber niches do not reproduce exact stone joints or a measured chamber plan. Granite lettering backs approximate visible carved contrast with a shared graph. No roof, full pediment, missing cella, buried rooms, restored original temple or independent Forum monument is invented. A conservative opaque podium top clears the original rendered terrain by at least 0.200001m across every intersecting grid cell; retaining sides extend below coarse grade, so no terrain/water opening is needed. Synthetic 10m residency clips much of the podium and removes the remote colonnade/entablature while native ground remains intact. Full architectural completeness requires the surrounding tiles. Neighboring Forum ruins still use generic procedural shells and their historical appearance is not approved. No bespoke survey, archive or academic research was used.

## Source and checks

Two registered recipes and retained source inputs rebuild the master and four browser levels. Master: 10869 triangles / 1307716 bytes. Six Khronos validations have zero errors and warnings. All 114 shape/opening probes, 97 original map vertices, 196 occupied-floor samples and 81 relevant rendered terrain vertices pass. Inspected 46 official and 23 site/failure/partial views. Bulk captures stay local.

The 960m integration tile contains 1945 map buildings. Thirteen authored components are replaced and 1932 independent records remain byte-identical. All 2831 independent buildings in the full retained extract were checked outside the replacement envelope; 328 nearby records, including the 13 controls, remain in source. Nine native water features retain 127038.71519859218m². Original map properties and the 161-square/6m DEM remain unchanged. Failure retains native procedural buildings; eviction releases geometry. The synthetic 10m fixture preserves native ground while intentionally clipping the architecture.

Selected generation/import/LOD/placement checks, strict medium-fi audit, asset hash verification, scene validate and sim30 pass. The next full source rebuild and asset-lock refresh belong to a meaningful batch milestone. No dependency audit, Git mutation or upload was performed.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0503; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0503; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0503.

Source: sha256:5af767fdd7608389fb59fd913656e1a4c791f1b65c12103f7c56f3a040d91aaf

Runtime: sha256:a1effa1dc9f4d12e1509258c78d67c5fc5c51201dd91e3be1d41b20d1bb4ffa5

Input: sha256:ce19c86254208251a95d3445252915910e182a1e014c574af0db833f5bd35ba4

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:Foro_romano_tempio_Saturno_09feb08_01.jpg — Marcok; CC BY-SA3.0; viewed only. No pixels shipped.

https://commons.wikimedia.org/wiki/File:Foro_romano_tempio_Saturno_09feb08_03.jpg — Marcok; CC BY-SA3.0; viewed only. No pixels shipped.

https://commons.wikimedia.org/wiki/File:Front_Saturntempel.jpg — Rabax63; CC BY-SA3.0; viewed only. No pixels shipped.
