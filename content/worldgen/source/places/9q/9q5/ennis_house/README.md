# Ennis House

Stepped buff textile-block house above massive retaining terraces, with projecting dining-window tower, high living-room block, rear loggia, eastern master room, western motor court, bridge and garage wing. Visible 16-inch block courses and restrained Greek-key relief.

![Molen preview](preview.png)

Authoring state: **review-in-qa.json**. Current completion evidence is in [qa.json](qa.json) and the [local 100 ledger](../../../../qualla-structures/batches/PROGRESS.md).

- [Ennis House](https://qualla.com/ennis-house/)

Original medium-fi exterior based on individually inspected Qualla photographs, HABS CA-1942 elevation/description, 1928 Architectural Record plan/perspective and satellite roof context. Room dimensions, roof heights and precise relief are interpreted, not surveyed.

House, linked garage/servant wing, bridge, court, terraces and pool basin included. Interiors, vegetation, neighboring houses, vehicles, temporary scaffolds, furniture and photo pixels excluded.

Independent USGS CA_LosAngeles_B23 bare-earth evidence is preserved unmodified. Terrain under buildings is source-interpolated, and host datasets may differ; placement remains a preview with footprint replacement disabled.

16-inch block course spacing is retained; ornate block relief and leaded-glass geometry are simplified at medium-fi and progressively omitted at distant detail levels.

Build: `node packages/worldgen/scripts/generate-authored-places.mjs --ids=ennis_house`. Add `--check` to verify exact regeneration. 60816 triangles; 5 materials; no embedded photographs.
