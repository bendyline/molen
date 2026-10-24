# Etchmiadzin Cathedral — current model review

Reviewed 2026-10-14 against two inspected close aerial/front pictures and the standard viewer PMTiles/DEM. This is an individual medium-fi exterior; untagged architectural subdivisions and exact site joins remain estimates.

## Completed checks

- Inspected all 49 final frames: 11 portable/source-terrain, 11 shared/geographic and 27 Earth-lighting/LOD frames. Bulk captures remain local; the retained summary is 1024 × 640.
- Source master, runtime master and four browser levels match their hashes. All six GLBs have zero Khronos errors/warnings and no embedded images.
- Verified the unioned current parent footprint, rigidly reframed exact-QID outline, signed west bell/east range orientation, standard DEM datum and retained 27 m overall crown.
- All 116 imported-geometry probes pass for 32 pavilion apertures, four gallery apertures and their masonry, the lower entry/rear door, main cone, roof supports and steps.
- Five existing shared 256 × 256 graphs provide sandstone, standing-seam metal, raw foundation stone, cast bronze and wood. Sandstone is reused for walls, trim and cones. Each graph reads once; unloading leaves zero live model geometries. Glass uses vertex colors.
- Removed a leftover wall strip beside the portico, added complete roof-belfry pedestals and attached the bronze bells to hangers.
- Targeted generation reproduces the master. Asset hash verification, scene validation and a 30-tick headless simulation pass.

| Level | Triangles | Geometry bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 754 | 77,132 | 1 |
| District | 3,472 | 280,224 | 8 |
| Street | 11,497 | 929,716 | 8 |
| Close-up | 18,613 | 1,568,524 | 8 |

Initial skyline plus district geometry totals **357,356 bytes**. Every level meets medium-fi budgets; CPU/GPU bytes match with separate position/normal streams. The source master is **18,613 triangles / 2,238,316 bytes**.

## Scope and limitations

The main faceted drum/conical roof, crossing roofs, west entry/gallery/belfry, three smaller roof belfries, side apses, connected eastern range, bronze bells/rails and selected stone motifs are individually authored. Surface windows and closed rear doors do not reconstruct interiors.

The map has **one parent footprint and no height-tagged components**. Retained 27 m overall height and 29 × 23 m core dimensions guide the picture-led reconstruction. The entire approximately 55 m mapped envelope includes the west portico and eastern ranges; it was not resized to the core dimensions. All drum/eave/portico/belfry subdivisions, eastern roof-belfry placement, lower-range roles, window rhythms and ornament are estimates.

Skyline preserves the distinctive cone/bell silhouettes with simple surfaces. District restores four gallery cuts and eight selected pavilion cuts. Street/close-up retain all 32 pavilion apertures and add bells, rails, drum windows and trim. Profile/detail changes remain visible during upgrades.

Native Y=0 follows standard DEM **874.7640151081456 m**. Estimated **0.65 m common floor** clears coarse perimeter samples of about −0.73 to 0.47 m. Foundations, plaza and doorway joins remain approximate. Geographic captures use flat terrain; portable views inspect retained native terrain. Medium-fi neighboring buildings are synthetic Balkan-konak context.

Exact reliefs, sculpture, lettering, structural plans, interiors, the surrounding monastic compound, separate churches and certified walking/collision surfaces are excluded. Physical laptop and phone measurements remain pending.

Current machine review and hashes are in `qa.json`. The latest full library source checkpoint covers cardiff_castle–alexander_nevsky_cathedral; tournai_cathedral–etchmiadzin_cathedral have targeted reproduction checks and join the next tournai_cathedral–riga_cathedral batch milestone.
