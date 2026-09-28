# Canonical architectural materials

The default resource pack shares **65 procedural architectural materials**. Their stable prefix is `molen.worldgen.material.`;
use `matgraph:molen.worldgen.material.brick` in a style or scene. Reuse these documents across
building families. Change palette tints to represent local clay, timber species, paint or stone;
do not duplicate a graph just to recolor it.

The authoring catalog in [source/material-library/catalog.json](../source/material-library/catalog.json)
records semantic families, intended uses, physical repeats, PBR channels and named tint variants.
For example, `white_painted_wood` uses the neutral `wood_painted_lap` graph with `#eeeae0` vertex
color; `green_shingled_wood` uses `wood_painted_shingle` with `#486a56`. Color variants share the
same texture maps. [The material-library guide](../source/material-library/README.md) describes
static GLB binding, texture ownership, the extraction audit and reviewed swatches.

All maps bake at **256 × 256** and remain shared by material reference. Every material includes a
roughness map; new jointed or profiled surfaces also have restrained height-derived normals, and
uncoated metal finishes provide metalness. Stainless steel has continuous fine grain without
roof-panel seams; marble also has a continuous surface for columns and sculpture. The base colors are intentionally light for
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
| stone_granite | Dressed granite mineral flecks, without built-in block joints | 2 × 2 m | 0.82–0.94 |
| stone_marble | Restrained mineral veins without joints, for columns and sculpture | 2 × 2 m | 0.52–0.64 |
| stone_travertine | Continuous bedding and shallow pores for modeled blocks | 1.2 × 1.2 m | 0.82–0.94 |
| stone_limestone_raw | Continuous neutral pores and mottling for modeled boulders | 1.2 × 1.2 m | 0.86–0.96 |
| stone_limestone_weathered | Mineral mottling and biological patina on exposed ancient stone | 1.2 × 1.2 m | 0.90–0.99 |
| stone_sandstone_raw | Continuous horizontal sediment grain without mortar joints | 1.2 × 1.2 m | 0.90–0.98 |
| stone_basalt_raw | Continuous isotropic volcanic grain without masonry courses | 1.2 × 1.2 m | 0.86–0.95 |
| clay_fired | Continuous fired-clay grain for individually modeled bricks | 0.8 × 0.8 m | 0.86–0.96 |
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
| wood_painted_lap | Eight painted horizontal wood courses, restrained underlying grain | 2 × 1.60 m | 0.58–0.70 |
| wood_painted_shingle | Eight staggered painted shingle courses; green and white tint variants | 1.60 × 1.60 m | 0.65–0.79 |
| wood_plain | Grain without board joints for modeled timbers/planks; U along grain | 2 × 0.25 m | 0.77–0.91 |
| fabric_canvas | Canvas-like woven yarns for sails and awnings | 0.25 × 0.25 m | 0.91–0.99 |
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
| metal_painted | Continuous intact paint film for modeled steel; no built-in joints | 2 × 2 m | 0.49–0.61 |
| metal_stainless | Continuous brushed stainless grain; no panel seams | 1 × 1 m | 0.25–0.37 |
| metal_bronze_cast | Joint-free cast bronze with fine patination and pits | 0.25 × 0.25 m | 0.59–0.72 |
| metal_perforated_square | Actual 65.5 mm square alpha apertures on 85 mm centers | 0.085 × 0.085 m | 0.48 |
| metal_perforated_round | Actual 4 mm round alpha apertures on 12 mm centers | 0.012 × 0.012 m | 0.50 |
| metal_perforated_round_open | Actual 9 mm round alpha apertures on 12 mm centers | 0.012 × 0.012 m | 0.50 |
| metal_expanded_diamond | Staggered elongated diamond alpha apertures, 56% open | 0.12 × 0.04 m | 0.50 |
| membrane | Low-contrast flat roofing | 4 × 4 m | 0.88 |
| etfe_film | Smooth neutral opaque ETFE film; cushion shape remains geometry | 2 × 2 m | 0.22–0.28 |
| gravel | Roof ballast and surface aggregate | 2 × 2 m | 0.88 |

For sloped roofs, U runs across the ribs and V along the drainage direction where the roof
generator provides slope-aligned UVs. Metalness is 0.45 for coated standing seam, 0.62 for
galvanized corrugation and 0.58 for patinated copper; these are stylized responses, not surveys.
The `metal_painted` surface is dielectric (metalness zero): its intact paint covers the
substrate. Corrosion, exposed metal, rivets and welds need their own geometry or authored treatment.
Cast bronze has continuous patination and pits; use `metal_copper` only when its sheet seams fit
the construction. The four perforated metal surfaces use base-color alpha with `alphaTest: 0.3`.
Frames, folded returns, panel thickness and larger openings remain geometry. Their cutout
textures use linear minification without mip averaging to preserve small holes at distance.
The shared `etfe_film` graph is opaque. Transparent film must retain a local GLB material;
shared material replacement does not copy an asset's local alpha or transmission parameters.

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
Portable GLBs may embed graph-baked base-color PNGs, including alpha holes, for standalone
viewers. These are fallback copies of the same canonical surfaces. A GLB material's
`extras.molenSurface` binding lets the world viewer replace its private fallback with the
shared graph material. Keep unique artwork local. See the [texture audit](../source/material-library/texture-audit.json)
for per-file image hashes and shared bindings.

Review [3D art guidelines](../../../docs-src/guide/3d-art-guidelines.md) when adding materials.
