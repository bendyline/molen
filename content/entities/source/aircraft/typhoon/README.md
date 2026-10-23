# Eurofighter Typhoon

**Visual status: Reviewed against exterior and cockpit references, with documented limitations.** See the hash-bound [review record](../../aircraft-expansion-review.json) and [batch review](../../AIRCRAFT-EXPANSION.md).

Original unarmed polygonal aircraft, 15.96 m long, 10.95 m span/rotor diameter and 5.29 m nominal overall height. +Y up, +Z forward; ground-contact origin.

Typhoon single-seat: three 6x6in MHDDs, head-up control panel, wide HUD, center stick, twin left throttle, Mk16A-style seat. Main cockpit, seats, controls and instruments live in the exterior GLB. Live pointers, horizon cues, controls, rotors and gear use declared node bindings; screen maps and labels are diagrammatic.

Regenerate: `node packages/entities/scripts/generate-aircraft.mjs --ids=typhoon`. Use `--out .artifacts/typhoon.glb` for a separate candidate. Edit `source/aircraft-expansion.json` in the entities pack (`models/airframe.json` is a generated snapshot), plus its builder in `packages/entities/scripts/aircraft/` when present, or shared `aircraft-geometry.mjs` / `aircraft-interiors.mjs`. Reference provenance and variant limitations: [aircraft ledger](../../AIRCRAFT-EXPANSION.md).

Geometry is original MIT-licensed modeling; no reference image pixels or manufacturer logos are embedded. Dimensions and cockpit arrangement approximate the named variant; this is an assisted simulation, not a systems trainer. No external weapons, missiles, bombs, weapon pylons or gun pods. Target 15–100k triangles, under 4 MB optimized GLB, no textures.

[Exterior and cockpit preview](preview.png)
