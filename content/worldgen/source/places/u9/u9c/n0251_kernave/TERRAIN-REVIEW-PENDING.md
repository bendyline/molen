# N0251 — Kernavė: terrain review pending

Rechecked 2026-10-11. This candidate remains in the fixed 213-model backlog; it is not counted as complete.

The original deterministic master remains unchanged at sha256:b9709daddae6b379c702d47d39c6bb990a5616df8f27fa3fd5dd0c2d197d59fa (140410 triangles, 15354172 bytes), built by packages/worldgen/scripts/kernave-landscape-model.mjs#kernaveStudy.build.

## Evidence actually inspected

- Vengalis and Vėlius (2019), [primary paper](https://doi.org/10.15388/ArchLit.2019.20.4): full aerial photograph on PDF page 2 and north-up LiDAR plan on page 8, plus the five hillfort descriptions. These are references; no paper images or LiDAR pixels are added to the asset.
- [Official museum aerial photograph](https://www.kernave.lt/uploads/ECB/content_1594931195/s-kvietka-muziejus-po-atviru-dangumi-is-dangaus_4244.jpg): three fenced craft yards, timber buildings, board roofs and sloping grass. It does not support the source's assumed flat 30-m terrace.
- Fresh public OSM area response for the retained map-parts bounding box. Individual hillfort identities remain distinct from town Q215315.
- Public Terrarium numeric elevation samples: working anchor 87.680397 m, museum node 107.221995 m, hillfort nodes 78.912688 / 98.320101 / 104.223103 / 83.790019 / 77.279384 m. Pixel-center spacing is 2.748181 m; this is sampling spacing, not native DEM resolution or certified vertical accuracy. The product is visibly too smooth to reproduce the individual hillforts and cannot approve their slopes or stair rises.

## Remaining completion requirements

Obtain detailed numeric elevation data with reusable rights, fit the five distinct hillforms and mapped visitor infrastructure, remove the interpreted terrace and visible terrain patch edges, then inspect the four current browser levels through the terrain-aware viewer. Keep the existing readiness gate pending until this evidence exists.

Lithuania's [data-order conditions](https://www.geoportal.lt/geoportal/bendrosios-erdviniu-duomenu-naudojimo-salygos) require a registered order and explicit terms acceptance for ordered data. No account, agreement or order was created. The owner has been asked about existing data/access; other backlog candidates can proceed independently.
