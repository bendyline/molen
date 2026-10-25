# De Havilland Canada DHC-6 Twin Otter 400

**Visual status: Reviewed against exterior and cockpit references, with documented limitations.** See the hash-bound [review record](../../aircraft-expansion-review.json) and [batch review](../../AIRCRAFT-EXPANSION.md).

Original unarmed polygonal aircraft, 15.77 m long, 19.81 m span/rotor diameter and 5.94 m nominal overall height. +Y up, +Z forward; ground-contact origin.

Primus Apex: outer PFDs and two stacked center MFDs, shared pitch column with dual ram-horn wheels, overhead power/prop/condition levers and lower electrical subpanels. Main cockpit, seats, controls and instruments live in the exterior GLB. Live pointers, horizon cues, controls, rotors and gear use declared node bindings; screen maps and labels are diagrammatic.

Regenerate: `node packages/entities/scripts/generate-aircraft.mjs --ids=dhc-6`. Use `--out .artifacts/dhc-6.glb` for a separate candidate. Edit `source/aircraft-expansion.json` in the entities pack (`models/airframe.json` is a generated snapshot), plus its builder in `packages/entities/scripts/aircraft/` when present, or shared `aircraft-geometry.mjs` / `aircraft-interiors.mjs`. Reference provenance and variant limitations: [aircraft ledger](../../AIRCRAFT-EXPANSION.md).

Geometry is original MIT-licensed modeling; no reference image pixels or manufacturer logos are embedded. Dimensions and cockpit arrangement approximate the named variant; this is an assisted simulation, not a systems trainer. No external weapons, missiles, bombs, weapon pylons or gun pods. Target 15–100k triangles, under 4 MB optimized GLB, no textures.

[Exterior and cockpit preview](preview.png)
