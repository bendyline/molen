# 2025 Chevrolet Trax

![Molen preview](preview.png)

LT; suv. Reference interpretation for Molen, with polygonal bodywork, wheel openings, lamp assemblies, cabin furniture and steering controls.

Authoring envelope: 4.537 × 1.824 × 1.56 m (body, excluding mirrors); wheelbase 2.7 m. Rounded visual targets, not a certified engineering reconstruction. The recipe records the selected year/body and editable proportions. Trim details and dashboard graphics are simplified; handling is gameplay tuning, not manufacturer performance data.

Generate: `node packages/entities/scripts/generate-fleet.mjs --ids=chevrolet-trax-2025`. Import using the source manifest's asset ID, then capture using `packages/entities/scripts/capture-fleet.mjs --ids=chevrolet-trax-2025`. The shared generator is `packages/entities/scripts/road-vehicle-geometry.mjs`. No bitmap textures or downloaded geometry.

Reference sources (manufacturer design/specification context; not every authored dimension is independently measured):
- [Manufacturer reference](https://news.gm.com/home.detail.html/Pages/news/us/en/2025/apr/0401-gmsales.html)
- [Manufacturer reference](https://news.chevrolet.com/newsroom.detail.html/Pages/news/us/en/2024/jan/0123-equinox.html)

Bulk current renders belong in ignored `shots/`; batch validation is recorded in `content/entities/US-VEHICLE-REVIEW.md`.
