# Palace of Versailles — complete principal exterior

Reviewed 2026-11-01. The model includes both long wings, seven enclosed courts, the garden corps de logis, Marble Court and its clock/balcony, the rounded Royal Chapel, Gabriel and Dufour pavilions, the six-column portico, open gate, slate roofs, dormers, chimneys and parapets. Independent gardens, pools, stables, the northern range and interiors remain context.

The detailed source has 698,109 triangles and builds to 56,873,356 bytes. Four browser tiers contain 998 / 3,979 / 13,275 / 48,123 triangles. Skyline and district total 446,688 bytes; close-up is 3,772,964 bytes. Seven existing 256px texture graphs serve eight near material groups, with metric UVs, linear colors and no private or embedded images. GPU attribute streams are separate.

Four focused tests pass. They verify source/runtime hashes, all seven open courts, chapel height, the open gate and portico, seated glazing, supported stairs, both gate-transition corners against the original terrain, actual native replacement and exact tier reconstruction. Six GLBs pass the Khronos validator without errors or warnings. All 55 current portable, shared-material, terrain, lighting and tier renders were inspected. Exact evidence and hashes are in qa.json.

Placement uses Q2946 / relation1149002 at [2.121153581, 48.804577976], heading 1.174824108517 radians. Seventeen court-aware occupied masks replace six actual palace components and retain all 42 independent native features, including the building inside a court. The approximate 147m datum uses two unchanged standard viewer Terrarium tiles. Bounded garden steps and the gate transition meet sampled outer terrain; wider gardens and the city approach retain their native data. Unloading restores the ground and releases model geometry.

Fine sculpture, ornament, hidden roof/window inventories and historic grades remain approximations. No interiors, copied decorative graphics or photographic textures are included. Physical laptop/phone performance and numerical LOD error measurements remain pending.
