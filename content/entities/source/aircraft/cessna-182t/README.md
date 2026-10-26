# Cessna 182T Skylane

**Visual status: Prototype; individual exterior and cockpit rework/review required.** See the hash-bound [review record](../../aircraft-expansion-review.json) and [batch review](../../AIRCRAFT-EXPANSION.md).

Original unarmed polygonal aircraft, 8.8392 m long, 10.9728 m span/rotor diameter and 2.8448 m nominal overall height. +Y up, +Z forward; ground-contact origin.

2007 NAV III/GFC700, twin glass displays, mechanical standby cluster, propeller/mixture push-pull controls and rudder trim. Main cockpit, seats, controls and instruments live in the exterior GLB. Live pointers, horizon cues, controls, rotors and gear use declared node bindings; screen maps and labels are diagrammatic.

Regenerate: `node packages/entities/scripts/generate-aircraft.mjs --ids=cessna-182t`. Use `--out .artifacts/cessna-182t.glb` for a separate candidate. Edit `source/aircraft-expansion.json` in the entities pack (`models/airframe.json` is a generated snapshot), plus its builder in `packages/entities/scripts/aircraft/` when present, or shared `aircraft-geometry.mjs` / `aircraft-interiors.mjs`. Reference provenance and variant limitations: [aircraft ledger](../../AIRCRAFT-EXPANSION.md).

Geometry is original MIT-licensed modeling; no reference image pixels or manufacturer logos are embedded. Dimensions and cockpit arrangement approximate the named variant; this is an assisted simulation, not a systems trainer. No external weapons, missiles, bombs, weapon pylons or gun pods. Target 15–100k triangles, under 4 MB optimized GLB. Small original procedural cockpit finishes are embedded; source maps live in textures/. Shared [finish library](../../cockpit-materials/README.md) and [material review](../../COCKPIT-MATERIALS.json). Shared [font profiles](../../../fonts/README.md) select period, technical and display lettering for this cockpit.

[Exterior and cockpit preview](preview.png)
