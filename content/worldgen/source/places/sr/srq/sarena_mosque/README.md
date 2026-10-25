# Šarena Mosque

![Molen preview](preview.png)

Individual Šarena Mosque exterior: retained rectangular plan,a columned open porch below an enclosed painted upper gallery,a low brown tiled hip roof with broad colored eaves,four rows of framed cream/green/ochre/rust painted fields and one pale stone minaret. Coarse original geometric rosettes suggest the painted façade rhythm;no historic floral art,calligraphy or photo pixels are copied. No furnished interior,detached tomb,fountain,planting or courtyard wall is included.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://macedonia-timeless.com/mac/aktivnosti/setila/dopir/kulturaistorija/dzamija/sarenadzamija/)
- [Reference](https://sharinghistory.museumwnf.org/database_item.php?id=monument%3BAWE%3Bmc%3B10%3Ben)

Six existing shared256² lime plaster,coursed/raw limestone,ceramic tile,plain wood and painted metal graphs;seven merged roles with local opaque glazing. Colored facade panels,frames and coarse rosettes use original geometry and linear vertex tints over the shared plaster graph. Meter-scaled UVs,no embedded images,unique atlas,copied historic paintings or baked lighting.

## Model and axes

9,478 triangles; 28,434 vertices; 7 material groups; 1,141,592 bytes. Native bounds: -10.970, -0.417, -8.610 to 10.970, 27.741, 8.610. Source hash: `sha256:9ea8bf6e026e1ecc5f3ea1c1ae0d68d9856dddd57fbaec020168619947798b10`.

{"x":"retained long axis;estimated front atnegative X","y":"up","z":"retained transverse axis"}

Ordinary viewer Protomaps20261014 and Mapzen/USGS extractN0472;datum 470.5791049422154 m. 154 footprint samples span -0.06710494221545105 to 0.014665425620819406 m. Floor 0.24128936509498544 m equals the median of 40 outer samples plus0.25 m. Foundations sample edges at<=2 m. Replacement and preview seating use only the retained mosque outline. Park,street,courtyard objects and nearby buildings remain host content. Exact thresholds,steps and grade are unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=sarena_mosque` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained Q1009896 /way241085465 anchor,axis and six-vertex rectangle remain unchanged. Current named mosque/main polygon supplies four quantized corners. The front porch/upper gallery is assigned to negative X and the stone minaret is estimated inside the positive-X/positive-Z corner. No independent height tags or separate tower/tomb polygon are resolved. All partitions,facing,heights and painted-panel geometry remain picture-guided visualization estimates. The current named mosque and main polygon share id35184613174297. The separate tomb,courtyard enclosures,fountain and neighboring buildings are excluded.
- Retained dimensional facts and current height tags are empty. Horizontal scale follows the retained20.624×15.9 m plan and current four-corner check. All vertical dimensions are estimates: lower porch gallery4.1 m,painted wall10.1 m,hip ridge12.5 m,minaret27.5 m including its tip. The tower attachment,porch depth,painted grid and window sizes are not surveyed.
- Ordinary viewer Protomaps20261014 and Mapzen/USGS extractN0472;datum 470.5791049422154 m. 154 footprint samples span -0.06710494221545105 to 0.014665425620819406 m. Floor 0.24128936509498544 m equals the median of 40 outer samples plus0.25 m. Foundations sample edges at<=2 m. Replacement and preview seating use only the retained mosque outline. Park,street,courtyard objects and nearby buildings remain host content. Exact thresholds,steps and grade are unverified.
- Two inspected exterior pictures guide the painted facade grid,columned lower porch,enclosed upper gallery,brown tiled hip roof,broad red/green eaves and pale minaret. Coarse original geometric rosettes suggest painted rhythm;the historic floral imagery,calligraphy,lattice pattern and exact colors are not reproduced. Porch facing,interior wall partition,tower attachment and all heights remain estimated. Opaque window/door fields close the exterior shell;porch bays are shallow and unfurnished. Detached tomb,courtyard wall,fountain,planting and town remain host content. Current finish,engineering,ground joins and physical-device timing are unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.
