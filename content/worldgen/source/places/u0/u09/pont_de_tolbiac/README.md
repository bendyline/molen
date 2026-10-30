# Pont de Tolbiac

![Molen preview](preview.png)

Five unequal limestone vaults, round cutwaters with low caps and narrow pilasters, ashlar spandrels, radial voussoirs and coursed soffits, dentil cornices and genuinely open capsule-slot stone balustrades.

## Evidence

- [Primary reference](https://www.afgc.asso.fr/history-heritage/pont-de-tolbiac-a-paris/)
- [Primary reference](https://www.afgc.asso.fr/app/uploads/2023/06/HistoireAdminPontsParis_Prade-1982b.pdf)
- [Primary reference](https://upload.wikimedia.org/wikipedia/commons/d/de/Grandes_vo%C3%BBtes_%28IA_grandesvoutes56sejo%29.pdf)
- [Primary reference](https://commons.wikimedia.org/wiki/File:Pont_Tolbiac_-_Paris_XII_(FR75)_-_2026-06-06_-_1.jpg)
- [Primary reference](https://commons.wikimedia.org/wiki/File:Paris_Pont_de_Tolbiac_bridge_railing_downstream_close_up.jpg)
- [Primary reference](https://www.openstreetmap.org/way/183626421)

Published dimensions and reconstruction assumptions are separated in spec.json. Source photos were consulted; no photographs or third-party architecture meshes are embedded. Memorial and name lettering uses the installed Gentilis typeface by J. Victor Gaultney and Annie Olsen, copyright SIL International2003–2008, under SIL Open Font License1.1. See FONT-LICENSE.txt. No per-model bitmap lettering texture is loaded. Map plan attribution: © OpenStreetMap contributors, ODbL-1.0.

## Source

794646 triangles; 70414972 bytes; 7 material groups. SHA256: sha256:9dae38078bfe6db4516b242056772ae4ad8a91dc5062379875bdb09fb167d3c3.

Shared surfaces (stone_limestone_raw, stone_limestone_weathered, metal_painted, metal_bronze_cast) are loaded through the central library; any transparent materials use local PBR parameters. Axis and provisional vertical datum are in spec.json.

Regenerate with node packages/worldgen/scripts/generate-researched-bridges.mjs --ids=pont_de_tolbiac; append --check to verify. Import and capture through the standard structure-catalog scripts. Geometry validation does not substitute for current-frame visual review.

## Reconstruction limits

- Nominal168m length conflicts with the mapped pier spacing and published clear spans; retain both rather than hiding the discrepancy.
- Quay stairways outside the recorded bridge footprint are not part of this asset. Exact current street-sign positions and memorial panel dimensions are reconstructed from photographs, not surveyed.
- Current terrain-fit captures must approve the IGN-supported vertical placement; river surface height varies.
- Detailed source/master are retained exactly. Browser close-up retains capsule openings and plaque backing but aggregates the memorial inscriptions,Gentilis glyphs,tiny fasteners,drain grilles and small carved details into their source masters. Street/district tiers merge repeated holes and dentils; skyline preserves the five-vault/cutwater/curved-wing silhouette with aggregated parapet caps.
- Runtime tiers reuse existing limestone,weathered limestone,painted-metal and concrete graphs. Shared concrete grain approximates roadway/sidewalk paving. Original master material assignments remain unchanged. Physical laptop/phone timing and a new global PMTiles datum comparison remain unmeasured.
