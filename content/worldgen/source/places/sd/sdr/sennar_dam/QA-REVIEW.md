# Sennar Dam

Reviewed 2026-11-03. **43 current catalog views and five standard-water comparison views inspected.**

The model reproduces the 600 m sandstone gravity wall, 80 low sluices and 72 upper arched apertures, plus the crest railway, traveling gantry, embankments and two irrigation intakes.

The PMTiles crest rail establishes the anchor at [33.63519769, 13.54762612] and heading −3.00541828 radians. Local +X runs west and +Z runs north-northwest downstream. The fixed 425.4 m crest grade is inferred from terrain and the maximum reservoir level. The dedicated rail replacement matches only the modeled span.

Five shared graphs supply sandstone, board-formed concrete, plain concrete, gravel and painted steel. All six GLBs have zero embedded images. Eviction releases model geometry and restores terrain.

The 25 design-terrain views use nine standard Terrarium tiles. The fixture separates the mapped Blue Nile water at the occupied wall and uses 421.7 m upstream, 410.3 m tailwater, and an illustrative 416 m canal level. Five comparison views use sampled stages of 423.58 m upstream, 409.65 m downstream and 423.65 m at the first canal. The second canal probe gives 423.10 m.

The detailed master contains 17,066 triangles. The four viewer tiers contain 938, 3742, 6902, 12522 triangles. Skyline plus district are 367,164 bytes and close-up is 932,172 bytes. Four focused checks verify exact source pins, signed placement, rail replacement scope, gate counts, both intakes and byte-for-byte viewer tiers. The production road filter suppresses all three overlapping native rail fragments and preserves all 216 other retained transport lines. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The design and sampled views both use a local split at the crest. The unsplit production river polygon and higher sampled canal levels need validation in the regional viewer, where the intake gates may be obscured. Embankment ties, intake shapes and the mobile crane position are approximate. The model shows static closed sluices.

Rebuild with `node packages/worldgen/scripts/generate-sennar-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=sennar_dam`.
