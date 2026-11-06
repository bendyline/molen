# Banqiao Dam

Reviewed 2026-11-03. **46 current views inspected.**

The current rebuilt dam has two grass-covered embankments, the paved crest and toe walkway, a central stair and lights, a concrete release crossing and apron, and a roofed reservoir intake hut with a catwalk. The apron and embankment profiles meet along matching edges. The four modeled underflow bays remain open in the close-up.

The retained reservoir 22027803, crest road 35185317969920 and short release bridge 35185541377734 define the placement at [113.623333333, 32.982777777], heading 1.7596123023364287 radians. Local +X follows the crest north-northwest and +Z points east toward the downstream Ru River. The retained crest trace is 2,655.71 m and the release crossing is 50.05 m. A test with native projected PMTiles coordinates shows that only the owned bridge is removed. The other 94 transportation fragments are preserved.

Six existing shared graphs supply gravel, basalt, concrete, painted steel, standing-seam metal and window glass. The skyline uses one draw. The closer tiers use seven or fewer draws with metric UVs and linear tints. All six GLBs have zero embedded images. Eviction restores the ground and releases model geometry.

The 26 terrain views use ten standard Terrarium tiles sampled at 16 m and the mapped reservoir with five polygons and one hole. The occupied terrain cut follows the union of the two earthworks and release apron. Raw terrain elevations are unchanged. The downstream river and canal are linework in the retained tiles.

The detailed master contains 3,664 triangles. Viewer tiers contain 392, 1288, 3488, 3568 triangles. Skyline plus district are 165,232 bytes and close-up is 324,928 bytes. Four focused checks verify exact source pins, selective replacement, the four modeled gate leaves, open underflow bays, crest deck and release apron, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The four gate leaves, gate sill and operating equipment are illustrative. The ordinary photos show the intake silhouette, while its exact location, dimensions and local grades remain approximate. The nearby museum and park are separate structures. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-banqiao-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=banqiao_dam`.
