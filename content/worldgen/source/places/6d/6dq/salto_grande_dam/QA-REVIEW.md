# Salto Grande Dam

Reviewed 2026-11-03. **52 current catalog views inspected.**

The model includes the 852 m concrete crossing, all nineteen spillway bays, both 236 m generating halls with seven recessed outlets each, divider piers, yellow cranes and the two earthfill wings. A continuous road deck and static rails follow the mapped crest.

The mapped crossing sets anchor [-57.938498675, -31.274731806] and heading -0.532543345243 radians. Local +X follows the crossing southeast toward Uruguay and +Z points downstream. The authored road and rail deck replaces twelve crossing fragments and clips the overlapping ends of two west-approach fragments. The remaining approach and surrounding roads retain their map geometry.

Six shared graphs supply board-formed and plain concrete, gravel, painted steel, standing-seam metal and glazing. All six GLBs have zero embedded images. Unloading releases the model geometry and restores the terrain.

The 28 terrain views use eleven standard Terrarium tiles and two retained Uruguay River water polygons. The production sampler on nearby level 14 and 15 tiles gives 32.13–32.65 m in the reservoir and 3.46–3.56 m downstream. The main tile supplies the fixture stages. Both terminal deck grades were fitted to the standard terrain.

The detailed master contains 5,424 triangles. Viewer tiers contain 998, 2392, 4260, 5328 triangles. Skyline plus district are 272,664 bytes and close-up is 419,260 bytes. Four focused checks verify exact source pins, absolute elevation, bounded ground openings and selective road/rail replacement, the nineteen spillway bays, both rows of seven powerhouse outlets, and the continuous mapped deck, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Gate settings, equipment, embankment profiles and road grades are exterior approximations. The modeled rails are static. The unbuilt navigation system and submerged turbine machinery are outside this asset. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-salto-grande-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=salto_grande_dam`.
