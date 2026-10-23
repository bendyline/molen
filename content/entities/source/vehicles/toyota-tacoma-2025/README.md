# 2025 Toyota Tacoma

![Molen preview](preview.png)

SR5 Double Cab 5-foot bed; pickup. Reference interpretation for Molen, with polygonal bodywork, wheel openings, lamp assemblies, cabin furniture and steering controls.

Authoring envelope: 5.41 × 1.953 × 1.88 m (body, excluding mirrors); wheelbase 3.35 m. Rounded visual targets, not a certified engineering reconstruction. The recipe records the selected year/body and editable proportions. Trim details and dashboard graphics are simplified; handling is gameplay tuning, not manufacturer performance data.

Generate: `node packages/entities/scripts/generate-fleet.mjs --ids=toyota-tacoma-2025`. Import using the source manifest's asset ID, then capture using `packages/entities/scripts/capture-fleet.mjs --ids=toyota-tacoma-2025`. The shared generator is `packages/entities/scripts/road-vehicle-geometry.mjs`. No bitmap textures or downloaded geometry.

Reference sources (manufacturer design/specification context; not every authored dimension is independently measured):
- [Manufacturer reference](https://pressroom.toyota.com/toyota-motor-north-america-reports-2025-u-s-sales-results/)
- [Manufacturer reference](https://pressroom.toyota.com/whats-new-for-2025/)

Bulk current renders belong in ignored `shots/`; batch validation is recorded in `content/entities/US-VEHICLE-REVIEW.md`.
