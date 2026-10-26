# Cessna 208B Grand Caravan EX

**Visual status: Prototype; individual exterior and cockpit rework/review required.** See the hash-bound [review record](../../aircraft-expansion-review.json) and [batch review](../../AIRCRAFT-EXPANSION.md).

Original unarmed polygonal aircraft, 12.6746 m long, 15.875 m span/rotor diameter and 4.7244 m nominal overall height. +Y up, +Z forward; ground-contact origin.

2021 Grand Caravan EX, four-blade McCauley propeller, strut wing, separate cabin windows and NXi three-screen cockpit with live flight and propeller readings. Main cockpit, seats, controls and instruments live in the exterior GLB. Live pointers, horizon cues, controls, rotors and gear use declared node bindings; screen maps and labels are diagrammatic.

Regenerate: `node packages/entities/scripts/generate-aircraft.mjs --ids=cessna-208b`. Use `--out .artifacts/cessna-208b.glb` for a separate candidate. Edit `source/aircraft-expansion.json` in the entities pack (`models/airframe.json` is a generated snapshot), plus its builder in `packages/entities/scripts/aircraft/` when present, or shared `aircraft-geometry.mjs` / `aircraft-interiors.mjs`. Reference provenance and variant limitations: [aircraft ledger](../../AIRCRAFT-EXPANSION.md).

Geometry is original MIT-licensed modeling; no reference image pixels or manufacturer logos are embedded. Dimensions and cockpit arrangement approximate the named variant; this is an assisted simulation, not a systems trainer. No external weapons, missiles, bombs, weapon pylons or gun pods. Target 15–100k triangles, under 4 MB optimized GLB. Small original procedural cockpit finishes are embedded; source maps live in textures/. Shared [finish library](../../cockpit-materials/README.md) and [material review](../../COCKPIT-MATERIALS.json). Shared [font profiles](../../../fonts/README.md) select period, technical and display lettering for this cockpit.

[Exterior and cockpit preview](preview.png)
