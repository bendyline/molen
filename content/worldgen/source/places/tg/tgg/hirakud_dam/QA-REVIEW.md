# Hirakud Dam

Reviewed 2026-11-03. **52 current views inspected.**

The individual model covers the two separate gate banks with lower recessed outlets, the main embankment and connected crest, the mapped Burla generating hall and apron, and the distinctive Gandhi and Nehru observation towers.

The reviewed position is [83.869445, 21.530007] at heading 0.679089667394 radians. Local +X runs northeast from Burla, and +Z points toward the downstream Mahanadi. The six native road fragments define the signed main crest. The modeled hall replaces PMTiles building 35184602584087 while preserving 86 neighboring buildings and the native transportation layer.

Seven existing material graphs provide board-formed and plain concrete, gravel, painted metal, standing-seam roofing, brick and glazing. All six GLBs have zero embedded images. Model eviction releases geometry and restores the ground.

The 28 terrain views retain 15 standard Terrarium tiles sampled on a 12 m grid, including the original outlying values. The upstream plane is 188.00 m and the downstream plane is 153.42 m. Production probe windows return 188.59–188.65 m upstream and 152.89–155.83 m downstream.

The detailed master contains 12,450 triangles. Viewer tiers contain 942, 3792, 4494, 10650 triangles. Skyline plus district are 394,596 bytes and close-up is 903,448 bytes. Four focused checks verify exact source pins, selective replacement, the two gate banks, Burla hall, twin minars and aligned crest deck, and byte-for-byte LOD reconstruction with separate GPU streams. All six GLBs pass Khronos validation. The scene validates and simulates 30 ticks.

The local grading, opening dimensions, gate pitch and exterior equipment are visual interpretations. A narrow terrain seam remains along part of the earthwork toe. The smaller photographed Burla outlet basin has no separate water polygon in the retained PMTiles. Remote perimeter dikes remain represented by native terrain. Physical-device timing remains unmeasured.

Rebuild with `node packages/worldgen/scripts/generate-hirakud-dam.mjs`. Append `--check` to check exact source bytes. Select this structure for import, LOD generation and readiness with `--ids=hirakud_dam`.
