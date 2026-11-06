# Christ the Redeemer — monument and pedestal

**Construction complete; native terrain fit pending. Not counted ready.** Reviewed 2026-11-02.

The individual exterior includes the long draped robe and pleats, original mantle folds, closed head and face, extended sleeves, hands and fingers, paired feet, and octagonal chapel pedestal. The surrounding viewing terraces, access stairs, lifts, station, restaurants and mountain remain independent context. The face and hidden details are an original medium-fi interpretation rather than a sculpture scan.

The **43,830-triangle / 5,207,684-byte source** produces four browser tiers: **792 / 2,462 / 5,678 / 13,558 triangles**. Initial skyline plus district download is **335,612 bytes**; close-up is **1,458,708 bytes**. Three existing shared 256px graphs provide raw limestone, granite and painted metal. There are no private or embedded images; GPU attribute streams are separate. Current render inspection replaced an inappropriate coursed masonry pattern with the existing fine-grained raw stone graph.

Four focused tests pass and six GLBs validate without errors or warnings. All 46 final portable, shared-material and terrain/context frames were inspected. Tests cover closure, the source and runtime hashes, exact tier reconstruction, budgets, named map location, the shared terrain-reference height and preservation of all 16 surrounding native building components. Exact evidence is recorded in qa.json.

Current PMTiles place the monument at **[-43.210459649562836, -22.951917486936523]**. The approximate ENE-facing frame uses heading **1.7453292519943295**, with 10-degree uncertainty from ordinary front/side pictures and the viewing path. The host samples terrain once at that point for the pedestal base, keeping a consistent height across tiles.

**Remaining issue:** the standard global field places this point on a steep side slope and obscures the pedestal and lower robe in some views. Its center sample is 528.95m while the native peak POI records 710m. Correct placement-height sampling does not fix that terrain profile. No surveyed summit altitude, replacement mountain or broad flattening pad is asserted. This remains part of the shared site/terrain backlog.

Rebuild: node packages/worldgen/scripts/generate-christ-redeemer.mjs; append --check for exact source verification. Import, LOD and placement commands select --ids=christ_the_redeemer. Physical-device timing and numerical LOD error remain unmeasured.
