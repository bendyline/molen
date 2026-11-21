# 2 World Trade Center construction review

The lit aerial and opposite street views show the concrete core cells, plywood deck runs with orange rails, open scaffold bays, the lattice hoist and paired ventilation stacks. The formwork, equipment sizes and excavation depth are photo-based estimates. [Placed preview](placement-preview.webp)

Khronos validation passed for the source, master and four runtime GLBs. The skyline and district levels total 381,556 bytes, and all six GLBs resolve the same four shared materials with zero embedded images. [QA record](qa.json)

The placements use the Greenwich, Fulton, Vesey and Church Street map frame. The hoarding fits the planned envelope and follows sampled Terrarium ground. All four levels replace the single 373.7 m tower footprint encoded in PMTiles once the construction mesh loads. A failed model load leaves the base map intact. [Mapped site frame](map-frame.json) · [Terrain and photographs](reference-observations.json)

The compiled placements were tested at October 6, 7 and 30. Each date selects the October 6 baseline, preserves the other 86 building features, and keeps all 235 road lines and the sampled terrain. The [October 31 snapshot](../2_world_trade_center_construction_2026_10_31/README.md) is the next dated phase and the default construction view. All six October 6 GLBs rebuild byte for byte through the shared recipe.
