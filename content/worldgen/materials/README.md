# Canonical architectural materials

The default resource pack shares **45 procedural building materials**, including 30 construction
patterns added for the global structure catalog. Their stable prefix is `molen.worldgen.material.`;
use `matgraph:molen.worldgen.material.brick` in a style or scene. Reuse these documents across
building families. Change palette tints to represent local clay, timber species, paint or stone;
do not duplicate a graph just to recolor it.

All maps bake at **256 × 256** and remain shared by material reference. Every material includes a
roughness map; new jointed or profiled surfaces also have restrained height-derived normals, and
the three metal finishes provide metalness. The base colors are intentionally light for
`tint: "multiply"`; charcoal timber and basalt acquire their dark color from the style palette.
Finer grain follows boards, reeds and sediment strata, while broad construction patterns survive
mipmapping. Glazing keeps its own blue-gray color and should not receive an opaque wall tint.

## Masonry and earth

| Suffix | Construction and intended use | Physical repeat (U × V) | Roughness |
| --- | --- | --- | --- |
| brick | Standard running bond, 8 columns / 12 courses | 1.92 × 0.90 m | 0.88 |
| brick_flemish | Alternating headers/stretchers within each of 8 courses | 1.44 × 0.60 m | 0.90 |
| brick_stack | Modern stack bond with continuous vertical joints | 1.44 × 0.75 m | 0.88 |
| brick_longformat | Slender Roman brick, 4 columns / 16 courses | 1.80 × 0.80 m | 0.88 |
| brick_glazed | Crisp glazed face brick; palette supplies enamel color | 1.44 × 0.75 m | 0.28 |
| stone | Mortared irregular rubble | 2 × 2 m | 0.88 |
| stone_ashlar | Dressed staggered rectangular blocks | 2.40 × 1.50 m | 0.90 |
| stone_limestone | Large pale blocks with small fossil-like pores | 2.40 × 1.60 m | 0.91 |
| stone_sandstone | Coursed sedimentary stone with horizontal strata | 1.80 × 1.50 m | 0.96 |
| stone_basalt | Tightly coursed split volcanic stone; use a dark palette | 1.60 × 1.40 m | 0.97 |
| stone_drywall | Dry-laid fieldstone with open joints | 2 × 2 m | 0.98 |
| earth_adobe | Broad hand-formed earth blocks | 1.35 × 0.75 m | 0.99 |
| earth_rammed | Six broad compacted lifts, subtle layered sediment | 2 × 1.20 m | 0.99 |
| terracotta_screen | Thick ceramic webs and inset square openings | 1.20 × 1.20 m | 0.88 |

The terracotta screen is an opaque stylized recessed surface. Use facade geometry for an actual
open lattice or a silhouette that needs visible holes.

## Timber and plant fiber

| Suffix | Construction and intended use | Physical repeat (U × V) | Roughness |
| --- | --- | --- | --- |
| siding_lap | Eight horizontal lap boards with repeated narrow underlaps | 2 × 1.60 m | 0.88 |
| siding_shingle | Staggered small wood cladding shingles | 1.50 × 1.60 m | 0.88 |
| wood_board_batten | Six vertical broad boards with raised narrow battens | 1.80 × 2 m | 0.86 |
| wood_vertical | Ten narrow vertical tongue-and-groove boards | 1.50 × 2 m | 0.86 |
| wood_log | Seven rounded horizontal log courses | 2 × 1.75 m | 0.92 |
| wood_shou_sugi_ban | Charred vertical cedar with crackle; tint charcoal | 1.60 × 2 m | 0.97 |
| wood_weatherboard | Five wide weathered horizontal boards, silver grain | 2 × 1.25 m | 0.94 |
| bamboo | Twelve vertical poles with offset stem nodes | 0.96 × 1.80 m | 0.78 |
| shingle_cedar | Broad cedar shakes with vertical grain and seven exposures | 1.80 × 1.75 m | 0.96 |
| thatch | Dense vertical reed bundles in four broad courses | 1.60 × 1.20 m | 0.99 |

## Roofing, tile and sheet metal

| Suffix | Construction and intended use | Physical repeat (U × V) | Roughness |
| --- | --- | --- | --- |
| shingle_asphalt | Standard asphalt roof courses | 1.80 × 2.10 m | 0.88 |
| slate | Broad staggered plates with horizontal cleavage | 1.50 × 1.60 m | 0.82 |
| tile_ceramic | Eight aligned barrel tile ribs and courses | 2.40 × 2.40 m | 0.88 |
| tile_flat | Small staggered overlapping clay tiles | 1.60 × 1.80 m | 0.78 |
| tile_glazed | Nine rounded glazed tile ribs, seven lap courses | 2.25 × 2.10 m | 0.25 |
| tile_mosaic | Twelve small alternating squares and pale grout | 0.60 × 0.60 m | 0.32 |
| metal_standing_seam | Five broad pans with narrow folded ribs | 2.50 × 3 m | 0.50 |
| metal_corrugated | Sixteen narrow rounded vertical flutes | 1.20 × 2 m | 0.56 |
| metal_copper | Staggered soldered sheets, soft patination | 1.80 × 1.80 m | 0.63 |
| membrane | Low-contrast flat roofing | 4 × 4 m | 0.88 |
| gravel | Roof ballast and surface aggregate | 2 × 2 m | 0.88 |

For sloped roofs, U runs across the ribs and V along the drainage direction where the roof
generator provides slope-aligned UVs. Metalness is 0.45 for coated standing seam, 0.62 for
galvanized corrugation and 0.58 for patinated copper; these are stylized responses, not surveys.

## Render, concrete and glazing

| Suffix | Construction and intended use | Physical repeat (U × V) | Roughness |
| --- | --- | --- | --- |
| stucco | Fine mottled rendered wall surface | 2 × 2 m | 0.88 |
| plaster_lime | Matte limewash with soft overlapping brush clouds | 2 × 2 m | 0.94 |
| plaster_tadelakt | Burnished lime plaster with broad trowel mottling | 2 × 2 m | 0.48 |
| concrete_panel | Precast panels with restrained seams | 3 × 3 m | 0.88 |
| concrete_plain | Foundations, pads and poured surfaces | 2 × 2 m | 0.88 |
| concrete_boardformed | Eight horizontal timber formwork impressions | 2 × 1.60 m | 0.94 |
| window_punched | One framed pane | One repeat per window | 0.30 |
| window_grid | Paired commercial panes in one continuous storey | One repeat per bay | 0.30 |
| window_sliding | Two sliding panes | One repeat per window | 0.30 |
| storefront | Full-height commercial glazing | One repeat per pane | 0.22 |

Repeat sizes are authoring recommendations. Set worldgen material-part `uvScale` to
`[repeatWidthMeters, repeatHeightMeters]` with `uv: "meters"`. Static GLBs should use the same physical
repeat and PBR channel semantics. Check under neutral daylight and at gameplay distance.

The source is `packages/worldgen/scripts/generate-pack.mjs`. Regenerate with
`node packages/worldgen/scripts/generate-pack.mjs`; `--check` verifies byte-stable output.
Generate the labeled near/repeated swatch sheet with
`node packages/worldgen/scripts/preview-materials.mjs --out <sheet.png>`.
Review [3D art guidelines](../../../../../docs-src/guide/3d-art-guidelines.md) when adding materials.
