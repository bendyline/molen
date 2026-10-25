# 2025 Ram 1500

![Molen preview](preview.png)

Big Horn Crew Cab 5-foot-7 bed; pickup. Reference interpretation for Molen, with polygonal bodywork, wheel openings, lamp assemblies, cabin furniture and steering controls.

Authoring envelope: 5.916 × 2.085 × 1.971 m (body, excluding mirrors); wheelbase 3.673 m. Rounded visual targets, not a certified engineering reconstruction. The recipe records the selected year/body and editable proportions. Trim details and dashboard graphics are simplified; handling is gameplay tuning, not manufacturer performance data.

Generate: `node packages/entities/scripts/generate-fleet.mjs --ids=ram-1500-2025`. Import using the source manifest's asset ID, then capture using `packages/entities/scripts/capture-fleet.mjs --ids=ram-1500-2025`. The shared generator is `packages/entities/scripts/road-vehicle-geometry.mjs`. No bitmap textures or downloaded geometry.

Reference sources (manufacturer design/specification context; not every authored dimension is independently measured):
- [Manufacturer reference](https://www.ramtrucks.com/content/dam/fca-brands/na/ramtrucks/en_us/towing/towing-capacity-guide/brochure/25MY_Ram_1500_Customer_PayTow_2.0.pdf)

Bulk current renders belong in ignored `shots/`; batch validation is recorded in `content/entities/US-VEHICLE-REVIEW.md`.
