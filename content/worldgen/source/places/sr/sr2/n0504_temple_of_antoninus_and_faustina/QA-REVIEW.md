# N0504 — Temple of Antoninus and Faustina

Reviewed 2026-10-19. Accepted for the specific medium-fi temple/church exterior and approximate PMTiles/DEM fit.

![Current complete temple and church](preview.png)

## Exterior and shared materials

Inspected all 11 portable views. The complete temple/church exterior includes six front columns and two returns behind each end, smooth shafts with selected repair/rope grooves, tiered bases, simplified Corinthian capitals, open U-shaped entablature, recessed two-line dedication, grey podium and descending brick stair treads. The later church has the raised closed doorway with curved canopy, pilasters, framed upper window, split curved pediment and cross. Both side walls, inclined buttresses and the complete tiled nave roof are included. The missing antique porch roof and full antique pediment remain absent. Early renders prompted correcting the doorway canopy and stair material. Fine carving, stone joints and exact damage remain medium-fi estimates.

Inspected all 11 shared-material views. Six common 256-square graphs provide marble, weathered limestone, long-format brick, ceramic roof tile, window grid and cast bronze through metric UVs and linear tints. Each graph is read once across the model; eviction releases geometry. Six near draws and one skyline draw. No embedded images, unique atlas or copied photograph. The shared marble approximates cipollino, brick and roof colors remain approximate, and the window-grid graph is a generic glazing treatment. Dark shared body-stone backs provide contrast behind the recessed dedication. Flat-stage views expose some buried retaining depth; terrain contact was inspected separately on the original standard DEM.

## Browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 535 | 58140 | 1 |
| district | 2674 | 258996 | 6 |
| street | 6110 | 616976 | 6 |
| closeup | 12412 | 1225344 | 6 |

Inspected all 27 medium-fi views: street/block/skyline at noon and late afternoon in Economy/High, an untextured silhouette, six architectural details, all four whole-building levels and transitions. Levels 535/2674/6110/12412 triangles retain the ten columns, open porch, complete church body, roof and characteristic split pediment. Skyline uses a simple stair ramp and coarse columns; district adds steps, bases, coarse capitals, buttresses and facade trim; street adds more profiles and canopy geometry; closeup adds recessed dedication letters, Corinthian leaf/volute masses and selected shaft grooves. Initial skyline plus district geometry totals 317136 bytes, plus six reused common graphs. Separate attribute streams avoid duplicate GPU uploads. Physical-device and dense-city measurements remain pending.

## Geographic fit

Reviewed approximate full-site fit on the unchanged161-square/6m standard DEM. Four mapped component footprints retain29 original vertices and include the complete church/cella body, temple porch, beam and stair projection. Ten picture-guided column positions fit the mapped beam (six front and two returns behind each end); they are not separately mapped controls. The southwest stair and front/west photos establish the signed front. Geometry uses raw east/south coordinates at heading0 with a33.1047-degree internal rotation. The church/porch floor and lower stair pocket cover their original grade: all88 vertices of the rendered grid cells intersecting their bounds were checked, leaving at least0.200000m clearance. Retaining faces continue below the coarse grade, and treads connect to the low pocket. No ground or water opening is needed. Full-site loading replaces4 authored records and preserves2042 independent tile buildings exactly; all2768 independent records in the retained extract remain outside the replacement envelope. Source retains465 nearby records including the four controls. Nine native water features retain127658.69298314617 square metres. Failed loads preserve all2046 native tile buildings; eviction frees geometry. Synthetic10m partial residency clips the church body, facade, roof, returns and outer porch while keeping original terrain under and outside the remaining columns/stairs. Full architecture requires surrounding tiles; partial architectural completeness is not claimed. Neighboring unmodeled Forum ruins retain generic procedural shells and their historical appearance is not approved. Height, exact stonework, column positions, raised threshold and roof pitch remain approximate.

## Scope and limitations

Accepted for the specific medium-fi Temple of Antoninus and Faustina / San Lorenzo in Miranda exterior and approximate standard-map/DEM placement. Four mapped components retain 29 original vertices and include the church/cella body, porch, front stair projection and U-shaped beam. The ten column positions are picture-guided within that beam, not separate map controls: six across the southwest front and two behind each end. An ordinary article describes eight columns, while the inspected front/west pictures support the modeled return arrangement; this discrepancy remains explicit. Geometry uses raw east/south coordinates at heading 0, with an internal 33.1047-degree rotation and local +Z facing southwest. Heights, precise column positions, coarse Corinthian carving, lettering, raised threshold, buttress dimensions, roof pitch and Baroque facade profiles are estimates. The 17m shaft top, 20.6m entablature and 33.5m cross top above the lower model datum are not surveyed heights. No complete interior, restored antique porch roof, full antique pediment, guildhall or independent neighboring monument is claimed. Two conservative opaque floor pockets clear the original terrain by at least 0.200000m over all 88 relevant rendered grid vertices; retaining sides extend below coarse grade. Ground and water remain intact. Synthetic 10m residency clips the church, facade, roof, returns and outer porch, leaving only the resident architecture; full completeness requires surrounding tiles. Neighboring Forum ruins retain generic procedural shells and their historical appearance is not approved. Only ordinary pictures and the standard map/DEM were used.

## Source and checks

Two registered recipes and retained source inputs rebuild the master and four browser levels. Master: 12,412 triangles / 1,493,348 bytes. Six Khronos validations have zero errors or warnings. All 156 geometry probes, 29 original map vertices, 432 occupied-floor samples and 88 relevant terrain vertices pass. Inspected 49 official and 24 site/failure/partial views. Bulk captures stay local.

The 960m integration tile contains 2,046 map buildings. Four authored components are replaced; 2,042 independent records remain byte-identical. All 2,768 independent buildings in the full retained extract lie outside the replacement envelope. Source retains 465 nearby records including the four controls. Nine native water features retain 127,658.69298314617 square metres. Map properties and the original 161-square/6m DEM remain unchanged. Failed loads preserve all native buildings; eviction releases geometry. The synthetic 10m partial fixture preserves ground while intentionally clipping architecture.

Selected source/import/LOD/placement checks, strict medium-fi audit, verified hashes, scene validation and sim30 pass. The next full source rebuild and asset-lock refresh belong to a meaningful batch milestone. No dependency audit, Git mutation or upload was performed.

Rebuild: node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0504; node packages/worldgen/scripts/import-next-1000-models.mjs --ids=N0504; node packages/tooling/scripts/generate-landmark-lods.mjs --ids=N0504.

Source: sha256:6fd94a02c8f07e200f22baf8b7bf288e2f9b5a5bedd71a5c873751745ca9bd2a

Runtime: sha256:5dd3af5079222ff47fe3351d6ba5f406df9d4b08f2b1ddeeb9edccfba275bba8

Input: sha256:e3d11bba60a6da89daba00c99a7a1a9a1b2da7921dbb2444254e4d76dd6c33a7

## Ordinary pictures

https://commons.wikimedia.org/wiki/File:Temple_of_Antoninus_and_Faustina_(Roma).jpg — ThePhotografer; CC BY-SA4.0; viewed only. No pixels shipped.

https://commons.wikimedia.org/wiki/File:San_Lorenzo_in_Miranda_from_West,_Roman_Forum.jpg — Julian Lupyan; CC0; viewed only. No pixels shipped.
