# Medium-fi review of the Earth view and structure corpus

Audit of the Earth view's rendering and of the authored structure corpus against the
[medium-fi style guide](../../../docs-src/guide/medium-fi.md), dated 2026-10-06. It records what
this pass changed, what the corpus looks like now, and a prioritized backlog. Numbers come from
the runtime sidecars (`assets/**/asset.json`: `stats`, `runtimeLods`), `qa.json` records, the
generators, and World Explorer captures on WebGPU and WebGL (Apple GPU, 1600×1000, High quality).

## What was wrong with the look

Before this pass the World Explorer read as drab and dusty. The causes, in order of effect:

1. **A flat blue sky fill.** With reflections on (the Earth default), the sky's reflection map
   replaced the hemisphere light but carried the raw sky palette at full radiance. That was about
   three times `dayAmbient`. Shade and sunlit faces differed little, and everything picked up a
   blue-grey cast.
2. **Procedural colors rendered lighter and greyer than authored.** Archstyle palettes, landmark
   prop colors, stand-in boxes and terrain bands are sRGB hex. They reached the GPU without
   decoding, so three.js read them as linear. A sage `#93a385` wall rendered as `#c8d1bf`, and
   the far building LOD looked chalky.
3. **Grey haze brighter than the sky.** The fog color `#d6e0e3` was a near-grey, brighter than
   the sky dome's horizon, so distant terrain formed a pale band in front of the sky.
4. **AgX tone mapping at exposure 0.9**, which compresses and desaturates the mid-tones that
   palette colors occupy.
5. **No cast shadows in the World Explorer.** The sky's sun never had shadows turned on, and the
   terrain stream was not asked to receive them. `mountEarthView` had shadows, but on WebGL they
   self-shadowed every caster (see below).
6. **Low-chroma palettes.** Residential landuse was grey `#8a8b7f`, so suburbs read as
   concrete. Roofs were near-black charcoal, and walls sat at 5–25% saturation.

## What this pass changed

| Area | Change | Files |
| --- | --- | --- |
| Shared look | One rig for every Earth host: `EARTH_SKY_PALETTE`, `EARTH_LIGHTING` (sun 3.5, sky fill 2), Neutral tone mapping at exposure 1, `EARTH_WATER_COLOR`, `earthHazeColor` | `packages/earth/src/client/look.ts`, `earth-view.ts`, `atmosphere.ts` |
| Sky fill | The sky reflection map is scaled by the ambient intensity ÷ π, matching `reflectionStateFromLights` | `packages/client/src/sky/visual.ts` |
| Tone mapping | `toneMapping: 'neutral'` (Khronos PBR Neutral) added to the environment schema and client | `packages/schema/src/components.ts`, `packages/client/src/three/environment.ts` |
| Color space | Procedural vertex colors, building cells, placement tints and terrain bands are decoded from sRGB; kernel constants re-expressed as sRGB | `worldgen` `color-attribute.ts`, `building-cells.ts`, `instanced-box.ts`, `recipe.ts`, `building.ts`; `terrain` `splat.ts` |
| Haze | Fog takes the sky's horizon color through day, dusk and night, converted per backend | `look.ts`, `examples/world-explorer/src/sky-controls.ts` |
| Shadows | Tier-driven sun shadows (`EarthPerformanceTier.shadows`) and a shared `earthShadowFocus`; the explorer turns them on and asks the terrain stream to receive them | `performance.ts`, `look.ts`, `examples/world-explorer/src/main.ts` |
| WebGL shadow bug | three r184's WebGL PCF lookup adds the bias unflipped under a reversed depth buffer, so casters shadowed themselves. The bias is now flipped there | `packages/client/src/three/shadow-focus.ts`, `renderer.ts` |
| WebGPU shadows and bundles | Render bundles stay on in the main pass while shadows are on, re-record when shadow settings change, and refresh their objects every frame. An earlier version of this pass also skipped that refresh, which looked 2.5 times faster but left replayed receivers on stale shadow state, so the scene flashed between shadowed and unshadowed frames. Correct shadows cost real CPU on WebGPU (about 55 ms against 40–45 ms without shadows in a dense view on a heavily loaded machine) | `packages/client/src/three/webgpu-scene-optimizer.ts` |
| WebGPU shadow teardown | Changing shadow quality disposed the WebGPU shadow node's render target, and three r184 cannot rebuild it in place. Every submit then failed with "Destroyed texture … used in a submit" and the view froze half-loaded. A WebGPU map now keeps its size, and "off" fades it out | `packages/client/src/three/renderer.ts` |
| LOD brightness | Distant flat building levels, stand-in boxes and loading placeholders multiply by the textures' mean (`TEXTURED_SURFACE_MEAN` 0.65), so buildings no longer brighten by half when they leave textured range | `packages/worldgen/src/client/materials.ts`, `packages/worldgen-earth/src/client/renderers.ts` |
| Ground palette | Landuse classes in all four scatter sets: lawn-green residential, light paving for commercial, richer forest and park | `content/worldgen/scatter/*.scatter.json` |
| Building palettes | The 16 hand-authored styles (PNW house, generic house, commercial, retail, box, Japan, southwest) moved into the medium-fi bands; asphalt shingle texture lightened | `source/structures/*/archstyle.json`, `packages/worldgen/scripts/generate-pack.mjs` |
| Vegetation | Builtin trees are flat-shaded, matching the hard-edged architecture | `packages/worldgen/src/client/vegetation.ts` |
| Ground variation | World-space value-noise mottling, dry and lush patches on terrain and landcover, both backends; no geometry or textures | `packages/terrain/src/ground-material.ts`, both Earth hosts |
| Ground cover | `builtin:groundcover.tuft` and `.fern`, near detail only, on a `groundcover` scatter layer with its own budget; an `open_ground` base polygon reaches unmapped land | `packages/worldgen/src/client/vegetation.ts`, `packages/worldgen/src/kernel/scatter.ts`, `packages/worldgen-earth/src/kernel/semantic-adapter.ts`, `content/worldgen/scatter/*.scatter.json` |
| Landmark footprints | A ring footprint (stadium bowl, cloister) whose hole holds a landmark's anchor is replaced under the landmark's size test, and in exact map data any footprint lying wholly inside the placed model's extent is replaced too (the Space Needle's SkyLine level and leg columns were mapped building parts drawn as boxes through the model) | `packages/worldgen-earth/src/client/renderers.ts` |
| Runtime LODs | Levels more than 15% over their triangle target raise the error budget with meshoptimizer pruning, up to 2% / 0.6% / 0.15% of the extent for district / street / closeup, then drop components thinner than that error. All 370 structures rebuilt | `packages/tooling/scripts/landmark-lods.mjs` |
| Medium-fi audit | `check-medium-fi.mjs` reports level budgets, materials, closeup draw calls and near-black or pure-white skyline surfaces for every structure | `packages/tooling/scripts/check-medium-fi.mjs` |
| Space Needle | Rebuilt: six legs in three pairs pinching to the hourglass waist and splaying under the top house, central core with gold elevator cabs, the SkyLine level at 100 ft, the ribbed underside, restaurant and observation glass bands, the halo rim, roof and spire. 2,412 triangles, which the skyline level keeps exactly | `packages/worldgen/scripts/generate-site-structures.mjs` |
| Lumen Field, T-Mobile Park | Rebuilt at their mapped size (212 × 257 m and 240 × 216 m): Lumen's bowl open low at the north end under two arched-truss canopies; T-Mobile's fan around home plate, brick facade, clock tower and the parked three-panel roof on its rail trusses. About 1,600–1,900 triangles each | `packages/worldgen/scripts/seattle-stadiums.mjs` |
| Mapped parts under landmarks | A loaded landmark also replaces exact-data polygons that half stand on its own ground footprint, in its tile and in the neighbouring tiles it reaches, which regenerate when it loads and when it is evicted. T-Mobile Park's anchor sits 5 m from a tile edge, so its stands and roof parts had drawn as windowed buildings through the bowl | `packages/worldgen-earth/src/client/renderers.ts`, `structure-geometry.ts` |
| Bridge paint | Seven suspension bridges take their documented colors (Tacoma Narrows green, Bay Bridge silver and white, Manhattan blue, Williamsburg red, Akashi grey-green) instead of one orange recipe | `packages/worldgen/scripts/structure-bridges.mjs` |
| Aircraft | The P-51 drops its 2 mm panel joints and cowling fasteners, the OH-6 its seams and rivets, and both get lighter instrument bezels and tubes: 56,618 → 38,674 and 44,558 → 32,214 triangles. Ambient copies overhead merge their still parts per material, from 281 draws to one per material plus moving parts | `content/entities/source/aircraft/*/models/`, `packages/ambient/src/client/aircraft.ts` |

On WebGL, shadows were measured at Space Needle density (33,600 buildings, 23M triangles) at
16.6 ms a frame with and without them (vsync-bound), and they no longer self-shadow. On WebGPU
they cost CPU time, as described in the table above; reducing that cost without the stale-state
flicker is open work (backlog item 10).

## The corpus today

370 authored structure assets, plus 120 procedural styles and the builtin props and vegetation.
Totals are the sum of one copy of every model's level; the targets are skyline 1,000, district
4,000, street 16,000 and closeup 64,000 triangles.

| Level | Over target at first | After the LOD generator | After re-authoring | Total at first | Total now |
| --- | --- | --- | --- | --- | --- |
| District | 239 | 83 | 50 | 18.2M | 1.9M |
| Street | 223 | 65 | 36 | 31.8M | 5.0M |
| Closeup | 169 | 71 | 27 | 45.3M | 15.6M |

Median levels sit on target: district 3,998, street 15,951, closeup 56,562. Munich Olympic
Stadium, the heaviest master at 4.1M triangles, went from 11,397 / 528,853 / 585,765 to
4,663 / 17,831 / 62,710 at 7.4 / 0.9 / 0.45 m of error.

### Re-authored masters

The dense masters were re-authored in their generators, at the helpers that emitted most of
their triangles (profiled per call chain), with every change compared against the old master
in renders. 69 models changed, in two passes; 39 of them now meet every level's target.

| Change | Models | Effect |
| --- | --- | --- |
| Signature-tower `grid`: one glass face with full-length frame strips instead of a framed panel per cell | 55 | CITIC Plaza 1,186,200 → 74,676; Abraj Al Bait 817,086 → 260,178; ICC 455,150 → 121,424; Grande Arche 371,160 → 22,776 |
| `facetedGlazing`: the same for clipped facets | 3 | Bank of America Tower 436,461 → 19,475; Mercury City 176,721 → 16,573 |
| `floorCurtain`: floor bands plus full-height mullions | 13 call sites | Landmark 81 512,049 → 72,981; Commerzbank 214,907 → 54,151 |
| Ryugyong: one sloped curtain wall per plan edge | 1 | 812,701 → 36,147 |
| Guangzhou IFC: curved glass skin with the diagrid as 30 helical bands | 1 | 425,949 → 36,534 |
| Sub-pixel members dropped (frames, joints, louvre clips, balusters, ribs) | Torre Glòries, 30 Rockefeller, US Bank, Tuntex, Flame Towers, Gran Torre Costanera, Nina Tower | Torre Glòries 1,555,592 → 142,044; Nina Tower 1,313,564 → 128,948; 30 Rockefeller 1,007,083 → 201,315; US Bank 701,784 → 130,716; Gran Torre 702,432 → 83,912 |
| Barolo Palace's authored ladder re-tiered | 1 | 33,368 / 106,076 / 135,188 → 4,364 / 16,444 / 62,940 |
| Second pass, the ten worst closeups: storey bays, vision and spandrel bands, flush panes and twisting skins as faces; lattice masts as a few members; cobogó screens and louvres coarsened; seats as `seatBand` rows instead of a chair per 0.54 m | Two Prudential, 4 WTC, FNB, Tuntex, Lusail, Copan, First Canadian Place, Lakhta, Brasília, Trump Chicago | Closeups 279,648 → 51,384; 202,804 → 60,544; 188,762 → 70,615; 180,230 → 68,749; 177,751 → 95,652; 142,808 → 69,199; 142,108 → 25,864; 121,005 → 15,202; 118,408 → 71,567; 117,747 → 64,000 |

All 106 signature-tower masters together went from 45.5M to 30.4M triangles, and the ten worst
closeups of the first pass from 1.67M to 0.59M; six of those ten now meet every target. The
LOD generator now ships a master as its own closeup only when it also draws in 12 calls or
fewer: Two Prudential's instanced bays had reported 11,370 calls there, more than the landmark
streamer's whole budget. The models the generator still cannot fit, by closeup:

| Model | Closeup triangles |
| --- | --- |
| 70 Pine Street | 116,188 |
| Parken Stadium | 113,356 |
| Merdeka 118 | 113,134 |
| One Canada Square | 111,570 |
| Torre Glòries | 110,267 |
| 875 North Michigan Avenue | 109,827 |
| Zifeng Tower | 108,064 |
| 30 Rockefeller Plaza | 108,040 |
| Oriental Pearl Tower | 104,577 |
| Edifício Italia | 98,750 |

Many re-authored models still over target miss only at district or street, with district about
as heavy as street (Tuntex in the first pass, 154,104 / 155,842; FNB's 13,824 coloured panels,
22,715 / 29,383). Their facades are mosaics of separate parts: too large to prune at the
district's error and too disconnected to simplify. Welding them does not help: Lusail's
same-coloured lips welded into one pierced surface that could neither be pruned nor simplified,
and its district grew from 4,225 to 19,626, so they stay separate. Backlog item 11 covers this.

The audit also lists 25 models with more than eight materials and four whose skyline is mostly
near-white (Rostov Arena, MHPArena, the Gateway Arch and the Spire of Dublin; the last two are
stainless steel and correct). `.artifacts/medium-fi/report.json` holds the per-model findings.

### Color

- The seven suspension bridges now carry their documented paint.
- Landmark GLBs store linear `COLOR_0`; after the color-space fix they sit in the same space as
  procedural buildings, so a landmark and its neighbors compare honestly.
- The next-1000 surfaces come from shared material graphs and look coherent.

### Seattle

The Space Needle, Lumen Field and T-Mobile Park are rebuilt (see the table above). The others
read as medium-fi studies: Smith Tower, Columbia Center, MoPOP's three colored masses, Climate
Pledge Arena's roof, the Pacific Science Center arches and the Great Wheel. Two are weak: the
Central Library is a plain faceted box rather than its stack of offset glass platforms, and Pike
Place Market is a row of brick halls without its sign and clock.

### Entities

- Aircraft are inside the hero budget (see above) and ambient copies are cheap to draw. They have
  no separate distant level yet.
- Cars sit on budget: 1,128 unique triangles (about 1,920 drawn) with a 152-triangle proxy.
- Trees are on budget (fir 240/132/12, broadleaf 424/124/20) and flat-shaded; ground cover is
  under 70 triangles a clump and near-only.

## Backlog, in priority order

1. **Re-author the dense masters.** 27 closeups are still over target, led by the ten above:
   find the helper that emits most triangles, draw repeated frames once (see the medium-fi
   guide's curtain-wall rule), model seat rows as stepped bands, then rebuild their LODs.
2. **Seattle's remaining weak studies.** The Central Library as its offset platforms under the
   diamond-grid skin; Pike Place Market with the Public Market Center sign and clock.
3. **Placement evidence for the rebuilt stadiums.** Lumen Field and T-Mobile Park are sized and
   oriented from the mapped footprints and the parked roof; record that as their geographic
   review, and confirm T-Mobile's home-plate orientation against imagery.
4. **Aircraft distant level.** Ambient aircraft merge by material but still draw the full mesh;
   a 1,500-triangle silhouette beyond a few hundred meters would finish the job.
5. **Materials over eight.** Review the 25 models in the audit and merge material slots that do
   not change the surface.
6. **Thin-member pass.** Close the remaining distant-aliasing notes by dropping or merging
   members thinner than two pixels at each level's switch distance.
7. **Style selection for tall residential.** Four-plus-storey residential in the PNW region uses
   `pnw.house` with a flat roof, so 20-storey towers get wood siding in sage and butter. Route
   residential buildings of eight or more levels to `modern_apartments` or a dedicated tower
   style in `content/earth/world.atlas.json`.
8. **Catalog roof colors.** `generate-structures.mjs` gives every recipe one roof color per
   material (asphalt is a neutral `#747574`). Give each material a two- or three-entry palette
   with a little hue, as the hand-authored styles now have.
9. **Near-shore seabed above the sea surface.** Elliott Bay's coarse elevation smears the seawall
   into the bay, and that seabed rises through the sea as a green strip 100–200 m wide along the
   downtown waterfront. Flatten terrain under mapped `ocean` and `bay` polygons when the tile is
   meshed.
10. **Cheaper WebGPU shadows.** Bundled receivers must refresh every frame while shadows are on,
    which gives back most of the bundles' saving. Find the per-object state that goes stale on
    replay and refresh only that. Renderer warm-ups (`compileAsync`) also re-run the sun's shadow
    pass over the whole scene once per new render object; skipping it during a warm-up would save
    loading time, at the price of compiling shadow-depth pipelines on first draw.
11. **District levels for facade mosaics.** When a tower's facade is many separate
    storey-sized parts, the generator's district level stays near its street level. Either
    author those facades as connected surfaces, or give the generator a massing fallback (the
    skyline's convex derivative with more cells) for a district that is still twice its target
    after pruning. The second changes the recipe, so every model's levels rebuild.

## How to reproduce the captures

In the engine repository, build once (`pnpm -r build`) and serve the World Explorer
(`pnpm --filter @bendyline/molen-examples-world-explorer dev`). Then open these views with
`hud=0&freeze=1&quality=high`, or add `&backend=webgl` for the WebGL path:

| View | Query |
| --- | --- |
| Sammamish street | `lat=47.6168136&lon=-122.0388213&alt=157&yaw=-0.99&pitch=-0.316` |
| Space Needle | `lat=47.6185&lon=-122.3535&alt=280&yaw=-0.6&pitch=-0.3` |
| Downtown towers | `lat=47.6027&lon=-122.3365&alt=350&yaw=-0.25&pitch=-0.3` |
| Stadiums | `lat=47.586&lon=-122.3395&alt=170&yaw=-0.98&pitch=-0.33` |
| I-90 bridges | `lat=47.596&lon=-122.282&alt=120&yaw=0.656&pitch=-0.22` |

Add `date=2026-07-15T19:00:00Z` for local noon and switch to Human mode before capturing. Wait
until the status reads `0 loading terrain · 0 loading layers` and the landmark count settles. Use
`shadows=0` for the shadow-off comparison.
