# End-to-end test result

Status: **PASS**

The fixture was regenerated twice from the checked-in base-color texture. Both generator runs
produced the same 8,613,004-byte source GLB and SHA-256 digest.

| Check | Result |
| --- | --- |
| Source GLB | `sha256:72ecc66946ab08e03a8d02f772a8344dc558e063db7460ef1abcb7dc0529b34d` |
| Imported GLB | `sha256:70f7d9551cbb2b2d8a5ddd0f5ed07ce8ac565be19c39c69a0912c5182a155331` |
| Texture maps | 3 embedded 1254×1254 PNGs: base color, normal, metallic/roughness |
| Imported geometry | 1 mesh, 6 primitives/materials, 1,086 vertices, 542 triangles, 1 collision hull |
| Asset verification | All model/sidecar hashes verified |
| Scene validation | Valid `molen/scene@3` |
| Simulation | Tick 30; 2/2 assertions passed |
| State hash | `sha256:6aea483e2792db63a9465b363354d69c17ce345be38fbeb7368895eda2e11bc2`, identical across three runs |
| Molen capture | 1280×720 PNG, 2 entities, 7 draw calls, 554 rendered triangles |
| Screenshot | [`preview.png`](preview.png) |

Visual inspection passed: the red board texture and wear are readable; doors, diagonal bracing,
cream trim, loft and side windows, roof, ridge cap, and foundation render cleanly; the barn casts
a distinct directional shadow onto the receiving ground plane.

The state hash is reproducible anywhere; the screenshot is not. A software rasterizer is
deterministic for a given build rather than across machines, so the capture is recorded as the
committed image rather than as a digest.
