# Capanda Dam

Reviewed 2026-11-03. **46 current views inspected.**

The individual Capanda model includes both angled wings, four deep spillway chutes with divider walls, the mapped curved service crossing, two yellow gantries, supported switchyard, generator hall and mapped tailrace apron.

Signed position [15.466341039, −9.795258874], heading −1.118970338564 radians, follows the 1,245.232 m retained dam outline, native two-part crest crossing and owned powerhouse. The model placement samples the nearby 958.33 m shoulder and applies its local terrain contact offset. The surrounding native service roads and buildings are preserved.

Six existing material graphs supply board-formed concrete, plain concrete, gravel, painted steel, standing-seam roofing and glazing. The skyline uses one draw and the nearer tiers at most six. All six GLBs have zero embedded images. Eviction releases geometry and restores the terrain.

The 26 site views use ten standard Terrarium tiles with all original height values retained. The fixture uses a 956 m water plane estimated from the shoreline band. The production inland water sampler measured 890.50 m at the crest window and 868.92 m in the reservoir interior window. These values are approximate because the diagnostic windows are independent of live tile boundaries. See native-datum-probes.json.

The detailed master contains 4,789 triangles. Viewer tiers contain 665, 2387, 3085, 4453 triangles. Skyline plus district are 275,620 bytes and close-up is 393,248 bytes. Four focused checks verify exact source pins, selective replacement, the four chute beds, curved service crossing, powerhouse roof and both supported aprons, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

Runtime reservoir datum remains pending. The ordinary photos show water immediately upstream of the crest, while default raw-terrain sampling places the reservoir about 66–87 m below the draft water plane. Some local shoreline slivers and grade seams also remain. The gate machinery and switchyard hardware are visually interpreted.

Rebuild with `node packages/worldgen/scripts/generate-capanda-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=capanda_dam`.
