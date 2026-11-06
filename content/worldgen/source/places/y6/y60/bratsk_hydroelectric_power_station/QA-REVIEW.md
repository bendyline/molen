# Bratsk Hydroelectric Power Station

Reviewed 2026-11-03. **46 current views inspected.**

The original model includes the long sloped concrete gravity wall, deep crest ribs and cap, highway and double-track railway with catenary, white crest gantry, full turbine hall and walled transverse retaining spur. The bridge approaches rise over the abutments and taper to the adjacent grade. The retaining spur follows the native shoreline and its upper deck is clear in the terrain views.

The mapped industrial outline way/113557354, signed at [101.786825702, 56.28641663] with heading 2.328962879809793 radians, defines the downstream-facing plan. The mapped crest highway spans 1,169.94 m and the railway spans 1,489.83 m. The runtime geometry clips exactly two mapped building IDs and the 14 owned highway, rail and sidewalk fragments. It preserves all 2,039 other transportation fragments in the retained extract.

Five existing material graphs supply board-formed concrete, plain concrete, painted steel, standing-seam roofing and glazing. The skyline uses one draw and closer tiers use at most five. All six GLBs have zero embedded images. Eviction releases the model and restores the terrain.

The 26 raw-terrain views use 21 standard Terrarium tiles sampled at 16 m and both retained Angara water surfaces. The occupied dam, turbine hall and spur terrain cut covers the mapped concrete, with a narrow allowance for the intersecting shoreline curtain. The original height values remain unchanged.

The detailed master contains 4,769 triangles. Viewer tiers contain 457, 2003, 3151, 4553 triangles. Skyline plus district are 221,980 bytes and close-up is 394,572 bytes. Four focused checks verify exact source pins, selective replacement, the deep ribs, road and rail deck separation, graded approaches, hall roof and retaining spur, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Exact rib spacing, individual gantry equipment, rail and road elevations and water levels are visual approximations. The raw terrain contains local elevation outliers and the native approaches use the standard coarse grade. Physical-device timings remain unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-bratsk-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=bratsk_hydroelectric_power_station`.
