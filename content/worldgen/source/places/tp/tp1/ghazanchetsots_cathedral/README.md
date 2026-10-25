# Ghazanchetsots Cathedral

![Molen preview](preview.png)

Individual Ghazanchetsots Cathedral in the photographed2018–2019 exterior: pale ashlar main body with three faceted entrance porches, round recessed portals, tall arched glazing, cross-shaped gable lights, crossing roof folds and faceted drum carrying a tall silver metal cone/cross. Separate western three-stage bell tower has a true open base passage, two arcaded levels and a peaked stone cone/cross. Shared ashlar/limestone/standing-seam metal/wood; metric UVs/linear tints. Mapped main/bell controls and standard viewer terrain. Exact sculpture, inscriptions, small carving/stained glass, surveyed paving/landscaping, later restoration changes, full interiors and certified walking excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Ghazanchetsots_Cathedral_in_June_2018.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ghazanchetsots_Cathedral_1.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Ghazanchetsots_Cathedral,_Shushi_02.jpg)

Four existing shared256-square ashlar/limestone/standing-seam metal/wood graphs. Main walls and bell cone share ashlar with linear tints; metric UVs. Glazing/accents are flat PBR colors. No embedded images, bespoke facade textures or baked shadows.

## Model and axes

14,574 triangles; 43,722 vertices; 6 material groups; 1,752,540 bytes. Native bounds: -39.587, -5.221, -25.215 to 23.609, 35.100, 22.215. Source hash: `sha256:0e55d1afba0d20dde1f5bc74754dbcb825c673b40a4a7d9188ceead7491697d8`.

{"x":"east-northeast toward eastern apse","y":"up","z":"south-southeast"}

Standard DEM datum 1373.138947m; display offset 0.4m, main perimeter terrain -4.51..0.14m; bell local datum offset -3.988m and perimeter -4.56..-3.21m. Foundations follow terrain; main portal thresholds use an estimated display datum+0.2m, with approximate steps connecting to local DEM+0.22m; bell-passage thresholds use local DEM+0.22m. Coarse viewer DEM does not certify absolute altitude, paved terraces, stairs, podium/cut-fill, entrance levels, interiors or walking. No global terrain flattening.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=ghazanchetsots_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained exact-QID way292349517/Q2001493 matches current main35184664438349 with height34.7m. Separate western bell35184706969661 has height15m. Raw plans/tags and missing min_height values are retained, without rescale. These approximate map envelopes are full cone/cross tips, not stacked wall solids. Picture-led main body eave10.8m/ridges14.3m, porch eave8.2m/roof10.1m, east apse roof13m, drum14.3..22.5m and metal cone22.5..33.5m/cross34.7m are estimates. Bell elevations are relative to its own standard-DEM center, not the cathedral datum. Bell base3.5m, middle6.5m, upper10m and stone cone14.3m/cross15m subdivide its envelope. The2018–2019 photographed conical-roof exterior is the explicit appearance scope; later restoration state is unverified. Boolean partitions round derived inputs to0.1mm; raw controls remain exact. Retained facts have no independent measured dimensions. Facade rhythm, porch and drum forms, reliefs and thresholds are approximate.
- Standard DEM datum 1373.138947m; display offset 0.4m, main perimeter terrain -4.51..0.14m; bell local datum offset -3.988m and perimeter -4.56..-3.21m. Foundations follow terrain; main portal thresholds use an estimated display datum+0.2m, with approximate steps connecting to local DEM+0.22m; bell-passage thresholds use local DEM+0.22m. Coarse viewer DEM does not certify absolute altitude, paved terraces, stairs, podium/cut-fill, entrance levels, interiors or walking. No global terrain flattening.
- Medium-fi exterior based on three inspected2018–2019 pictures and standard PMTiles/DEM only. Later restoration changes unverified. Exact carving/statues/inscriptions, small stained-glass designs, surveyed paved terraces/stairs, landscaping, full interiors and certified walking excluded. Physical device timing pending.
- Skyline keeps body/porches, faceted drum/cone and separate bell with open base/upper stage. District adds shared textures, flat glazing/doors and open middle arcade. Street adds true facade recesses, roof/gable trim, narrow windows/cross lights and structural bands. Closeup/master refine facets and window bars. Synthetic cottage neighbors are review fixtures.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
