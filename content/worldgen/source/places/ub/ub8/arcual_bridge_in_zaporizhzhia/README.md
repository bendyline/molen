# Zaporizhzhia arch bridge

Two steel ribs carry a straight road deck across the Old Dnipro to Khortytsia. The deck, sidewalks, open spandrels and lattice bracing use four shared material graphs at every detail level.

Run `node packages/worldgen/scripts/generate-arcual-bridge.mjs` to rebuild the detailed master. The landmark LOD generator exports all four authored runtime levels.

OpenStreetMap via Protomaps PMTiles supplies the road and sidewalk placement. The municipal repair inventory gives the deck length, arch span and widths. Grades, support foundations and the short approach grading are visual estimates from exterior photos and standard Terrarium samples.
