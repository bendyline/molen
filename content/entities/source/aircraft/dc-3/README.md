# Douglas DC-3

**Visual status: Reviewed against exterior and cockpit references, with documented limitations.** See the hash-bound [review record](../../aircraft-expansion-review.json) and [batch review](../../AIRCRAFT-EXPANSION.md).

Original unarmed polygonal aircraft, 19.6469 m long, 28.956 m span/rotor diameter and 5.16 m nominal overall height. +Y up, +Z forward; ground-contact origin.

Wright Cyclone civilian DC-3, swept/tapered wing, rounded fin,21-seat2+1cabin, Knoxville split wheels and dual-RPM analog panel. Main cockpit, seats, controls and instruments live in the exterior GLB. Live pointers, horizon cues, controls, rotors and gear use declared node bindings; screen maps and labels are diagrammatic.

Regenerate: `node packages/entities/scripts/generate-aircraft.mjs --ids=dc-3`. Use `--out .artifacts/dc-3.glb` for a separate candidate. Edit `source/aircraft-expansion.json` in the entities pack (`models/airframe.json` is a generated snapshot), plus its builder in `packages/entities/scripts/aircraft/` when present, or shared `aircraft-geometry.mjs` / `aircraft-interiors.mjs`. Reference provenance and variant limitations: [aircraft ledger](../../AIRCRAFT-EXPANSION.md).

Geometry is original MIT-licensed modeling; no reference image pixels or manufacturer logos are embedded. Dimensions and cockpit arrangement approximate the named variant; this is an assisted simulation, not a systems trainer. No external weapons, missiles, bombs, weapon pylons or gun pods. Target 15–100k triangles, under 4 MB optimized GLB, no textures.

[Exterior and cockpit preview](preview.png)
