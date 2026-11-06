# Keban Dam

Reviewed 2026-11-03. **52 current views inspected.**

The reconstruction includes the rock-fill wedge and berm, white DSİ lettering, the adjacent concrete wing and six upper gates, three lower spillway lanes and stepped runout, eight visible penstocks, two open lower portal bores, and the riverfront power hall and switchyard. Pipe endpoints stop inside the hall and the openings remain visible after native shoreline clipping.

The source uses the retained exact way 28431893 and candidate Q1737672 in the signed frame at [38.756780695, 38.808041292], heading −1.5887627600177932 radians. +X follows the crest south and +Z points west toward the tailwater. The retained 1,047.935 m mapped extent and 1,097 m source length are separate measurements. Native linework locates eight penstocks, the concrete chute axis, power hall footprint and lower outlet water fingers. The model replaces only the single owned powerhouse footprint. Native roads and neighboring buildings are retained.

Four existing 256 px shared graphs supply basalt, gravel, concrete and painted metal. The skyline uses one draw and the nearer levels five shared surface groups with metric UVs and linear tints. All six GLBs have zero embedded images. Eviction restores the ground and releases geometry.

The 28 terrain views use four standard Terrarium tiles sampled at 12 m and two mapped water reaches with four polygons and two island holes. The production shoreline-bank cut behavior keeps both outlet mouths visible. Ground clipping is limited to the occupied embankment, wall, chute, powerhouse and portal bores. The original terrain samples remain unchanged.

The detailed master contains 6,460 triangles. Viewer tiers contain 999, 2809, 5700, 6060 triangles. Skyline plus district are 380,956 bytes and close-up is 578,384 bytes. Four focused checks verify exact source pins, selective replacement, the six gates, three lanes, two clear portals and roof, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The elevation field and photographs set a visual fit. Water levels, chute elevations, pipe diameters, electrical equipment and portal crowns are approximate. Local grade and retaining contacts are modeled from the 12 m field. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-keban-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=keban_dam`.
