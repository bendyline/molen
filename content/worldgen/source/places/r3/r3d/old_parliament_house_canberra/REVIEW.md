# Old Parliament House, Canberra

The ordinary geographic model and its four detail levels retain the main building,
four open courtyards, paired chamber roofs and own north entrance. The local Qualla
front photograph, official museum description and aerial courtyard context guide
the exterior. Temporary lawn flags, banners, detached garden structures and interiors
are excluded. Photographic pixels are not distributed.

The entrance stair originally consisted of thin tread boxes with unintended open
undersides. The local front photograph supports a closed stone flight. Each tread
now extends down to the existing fixed architectural base; the original tread tops,
widths, positions, run, building massing, wall foot, anchor and north approach datum
remain unchanged. Skyline uses a simplified continuous entrance range; the other
three levels preserve the porch air.

The original Terrarium review field had a broad central bump and almost seven metres
of footprint relief. It is retained under `terrain-sources/rejected-terrarium/`.
The replacement comes from original official ACT vector tiles of two-metre contours,
derived by the provider from 2020 LiDAR. The provider's smoothing and generalization
are retained. This replacement was acquired after the initial geometry, before the
photographic stair support repair. No elevations were fitted, flattened or cut out.

Four original tiles and their numeric contour labels reproduce all 4,225 review
heights using a separate protobuf decoder and piecewise linear interpolation.
The source is AHD/MGA2020. The unchanged north approach gives a 570.1842 m datum;
763 native perimeter probes span approximately -0.194 to +1.834 m relative to it.
Actual exterior wall contact rays pass at every detail level. The official ACT
footprint also has four court holes; several-metre local outline differences remain.
Neither the map nor the interpolated ground is a building survey. A two-metre contour
interval is not a one-metre raster accuracy claim. An ELVIS one-metre tile request
is prepared but has not been submitted because it needs a delivery email.

Current acceptance is bound in `qa.json`: 36 inspected renders (8 portable, 8 shared
and geographic, 20 source-ground/context/detail views), four actual mesh levels,
774/783/783/783 geometric controls, source/runtime integrity, exact regeneration,
strict detail and palette budgets, four schemas and repeatable 30-tick simulation.
The normal preview keeps footprint replacement disabled. Other host terrain needs
its own contact review. Hidden rear details, roof steps, window spacing, heraldic
relief and floor levels remain medium-fi estimates.

Original contour data: Australian Capital Territory, CC BY 4.0,
[ACTGOV Contours 2m](https://www.arcgis.com/home/item.html?id=8c12c8e2e9f340908164d4aab9355e28).
The source manifest includes the original tiles, metadata and derivation record.
Run `terrain-sources/verify-derived-grid.py` with numpy 2.5.4, scipy 1.18.1 and
pyproj 3.8.0 to reproduce the grid; these are verification-only dependencies.
`verify-geometry.mjs` checks current source and imported meshes. Normal asset builds
use the saved inputs offline. Bulk render evidence remains in ignored folders.
