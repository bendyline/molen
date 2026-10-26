# Aerial comparison implementation

Implementation follow-up to [the original 20-point review](AERIAL-COMPARISON-REVIEW.md),
reassessed after the owner's merge on 25 October 2026. Changes remain in the working tree;
no Git staging, commits, branches or history changes were performed.

The local [comparison gallery](../../.artifacts/aerial-implementation/index.html) places the
reference photograph, immutable original capture and updated capture together. It covers
Seattle, Bellevue, Sammamish, Yuma, Kyoto, Sydney and New Delhi, with six overhead and seven
oblique views. Original source attribution and camera evidence remain in
`aerial-comparison.reference.json`. Photographs are comparison evidence, not runtime textures.

## Changes against the 20 recommendations

| # | Implemented treatment | Validation / remaining fidelity limit |
|---|---|---|
| 1 | Separate height-selected tower styles; light neutral/blue-gray wall palettes, with a small warm-red weight. Ordinary homes retain regional colors. | Tower selection at ≥35 m or ≥11 levels and deterministic palette sampling tested. Five 300-building cohorts have 3.8–7.3% warm facade-area proxy; this is not a measured city census. Historic landmarks retain their own materials. |
| 2 | Southwestern roofs use independently sampled chalk, warm gray and sand, with minority terracotta; more flat home roofs. | Yuma roof rows no longer read predominantly orange. Five cohorts have 9.6–14.5% warm roof-area proxy. |
| 3 | East Asian home roofs use gray tile/metal tints with limited warm exceptions. | Five cohorts have 0% strongly warm roof-area proxy. Kyoto still has too much exposed green between mapped buildings. |
| 4 | Stable 128 m block identities correlate setbacks, plans, dimensions and style variants. Compact East Asian infill uses wider parcel occupancy. | Infill determinism, parcel/road/park exclusions and regional selection tests pass. Individual seeded buildings are intentionally not photo-matched. |
| 5 | Mapped heights/levels and footprints survive distant massing; tower recipes retain existing stepped massing and use taller glass-grid facades. | Coarse selection keeps the largest height×footprint masses, capped at 256 buildings/tile. Mapped tall buildings are retained in regression tests. Far surfaces remain deliberately plain. |
| 6 | Added an original 284-triangle India Gate arch, registered source/runtime assets, four runtime LODs and anchored terrain placement with automatic footprint replacement. Distant rendering retains up to eight existing landmarks/tile. | Turntables, lit scene and the Central Vista oblique were inspected; generic office fallback is removed. Streamed landmark clipping/LOD upgrades tested at fine and coarse levels. Nijo has no new dedicated palace-roof model. Sydney's existing tower silhouette is preserved. |
| 7 | Physical subclasses and smaller cover polygons outrank broad land use; paving, park, garden, gravel and crop aliases resolve consistently. | Order/alias tests pass; existing shoreline/ground-cutout fixes from the merge are retained. Missing map classes still fall back to biome colors; no invented city-wide pavement mask. |
| 8 | Muted wet, dry and desert ground palettes distinguish dry soil, rough grass and managed planting under the unchanged shared lighting. | Yuma loses the bright yellow cast; Delhi and Sydney parks have a separate green treatment. No global exposure adjustment was used to manufacture a match. |
| 9 | Agricultural polygons keep crisp edges and existing crop color/field attributes at coarse coverage levels. | Existing cultivation/context tests pass. Far fields use surface coverage without extra crop-plant batches. |
| 10 | Sonoran riparian planting mixes willow and mesquite near mapped water, with larger crowns; dry scrub/cacti remain in their habitat rules. | Water-context and wrong-realm plant tests pass. Riparian canopy is still sparser than the photograph in places. |
| 11 | Increased crown width in Pacific coastal, East Asian, Australian and Aravalli planting; reduced some tree densities rather than multiplying instances. | Existing scatter/model budgets remain. Overhead and oblique canopy inspected; canopy continuity still depends on mapped coverage. |
| 12 | Pacific woodland, home and park mixtures are distinct; cedar/fir remain evergreen while maple/alder use the existing species-aware calendar. | Explicit Seattle autumn regression plus seasonal placement-stability tests pass. Full summer/autumn/winter city-image matrices were not captured. |
| 13 | Sydney managed parks favor eucalyptus and warm broadleaf trees, with darker eucalyptus foliage and wider crowns. | Sydney oblique shows a greener planted mass. Exact species and individual tree positions are not inferred from aerial photos. |
| 14 | Kyoto garden/gravel/physical-cover precedence, gray roof field and broader garden crowns replace uniform treatment. | The moat/compound comparison is inspected. Fine historic court and palace roof geometry remains approximate. |
| 15 | Muted blue-green water; distance and pixel-footprint attenuation for ripples and distance attenuation for broad swells in both WebGL and WebGPU paths. | Initial screenshots exposed surviving swell stripes; fixed and recaptured. Water backend tests pass; screenshots use WebGL. |
| 16 | Width fallbacks distinguish river, canal, stream, ditch/drain and moat; explicit mapped widths win. Retained merged shore-bank clipping. | Width and shoreline tests pass. Source-map pier endpoints and polygon errors are not repaired by these heuristics. |
| 17 | Lower-chroma paint and physical-width/pixel-footprint blending quiet subpixel markings. | Surface tests pass. Dense path/pavement edges can still read too bright at altitude. |
| 18 | Rooftop HVAC capped at 2–6 units with larger spacing and appropriate LOD; far parking uses occupancy-aware color patches inside existing lot batches. | Parking exclusion/occupancy and surface tests pass; no per-car distant draw calls. |
| 19 | Inferred poles limited by road class, underground/bridge/tunnel tags and nearby high-rise context. Existing fences, hedges, brush and wildlife remain under their pools/caps. | Existing surface, infill and habitat/range tests pass. No animal population was invented from imagery; fauna remains the existing ecology-driven system. |
| 20 | Opt-in continuous semantic coverage, bounded coarse building shells and coarse cover without distant plant batches; failed/pending captures excluded from scoring. | Sammamish overhead now reaches zero pending/failed layers. Coarse coverage improves Kyoto/Yuma/Seattle airplane views, at measurable cost; performance gate is not fully met. |

Architecture now has 336 regional variants across 14 families and eight uses. Shared materials
are reused. The generated ecology JSON is compacted to keep the existing download-size gate;
its readable authoring source remains `content/ecology/source/build-catalog.mjs`.

## Verification

- Terrain suite: **396 tests passed** (46 files).
- Worldgen Earth suite: **384 tests passed** (47 files), followed by **50 focused tests passed**
  after adding the extra coarse-landmark and evergreen regressions (two additional cases).
- Five deterministic palette cohorts: 300 buildings × three styles × five cohorts, using
  facade/roof area proxies; measurements and method in local `palette-distributions.json`.
- Affected terrain, worldgen-earth, earth and World Explorer types and lint pass.
- **`pnpm smoke:packed` passes**: 17 tarballs installed and seven templates scaffolded,
  type-checked, tested and built. Terrain's renderer was split into code chunks to meet the
  existing 384 KB entry-file limit; the limit was not raised.
- India Gate: deterministic source hash, imported asset verification, all runtime LODs,
  source/asset-path validation, four inspected turntable views, lit scene validation and
  30 simulation ticks. See [its source review](../../content/worldgen/source/places/tt/ttn/india_gate/review.md).
- Local gallery checks retain capture loading state, camera, render counts and image hashes.
  A frame is admitted only with a capture record, zero pending/failed layers and no page errors.
  Browser validation confirms 13 comparisons, 39 loaded images, six filter checks, no page
  errors and no horizontal overflow at 720 px.

Required repository gates were attempted and expose unrelated merged-output blockers:

| Gate | Result |
|---|---|
| `pnpm verify` | Stops at stale installed asset stamp, reporting hundreds of changed merged inputs. No green full-CI claim. |
| Root `pnpm lint` | Affected packages pass; remaining error is generated `content/entities/livery-previews/manifest.json` formatting. |
| `pnpm docs:site:check` | Package builds pass after India Gate source registration/canonical manifest fixes; site check stops at stale P-51D livery preview. |
| `pnpm test:golden` | Package builds pass, then content staging stops at Salesforce Tower's source/runtime hash mismatch. Golden comparisons do not execute. |

Full content staging expects Salesforce Tower hash `e0440da…` but finds `7df1946…`.
The gallery therefore uses an isolated pack index: current ecology/Earth packs plus current
regional styles and verified India Gate over previously built model archives. It does not
pretend the full merged content rebuild succeeded or rewrite unrelated sidecars to hide it.
Logs, overlay manifest and capture scripts are under `.artifacts/aerial-implementation/`.

## Complexity and photographic limits

### Pacific coastal groundcover follow-up, 26 October 2026

Bellevue's central park lawn was still too pale and yellow in the first pass. The Pacific
coastal habitat now has a separate surface palette: cooler dark green managed turf,
lighter rough grass/verges, and deeper woodland ground. The general wet-biome palette,
plant colors, tree counts, positions, sizes and all other catalog data remain unchanged.
Palette selection is separate from the habitat identity used for brush/density rules.

The same Bellevue camera, sun and seed produce **514 draws / 2,706,154 triangles** before and
after. An illustrative open-lawn patch has median sRGB `[163,174,116]` before,
`[65,110,57]` after and `[48,97,69]` in the photograph; this is a qualitative comparison,
not calibrated reflectance. Existing regional ecology tests pass (7); generator freshness,
source formatting, pack build and an exact catalog delta check pass. Only one habitat's
surface colors changed. Local close-up and validation records are in
`.artifacts/pnw-groundcover/`. Additional trees would not explain the open lawn's color;
canopy continuity elsewhere remains a separate fidelity limit.

### Existing implementation budget

Existing quality, vegetation, furniture and ambient caps were not raised. New distant work has
explicit caps: 256 building features and eight landmarks per tile; no coarse street furniture
or far plant batches. India Gate adds one material, no textures and at most one model draw per
visible instance. Shared content families keep the approach reusable across regions.

**The proposed +5% triangles / +10 draws / +16 MiB review gate is not met.**
All 12 valid baseline comparisons exceed the resident-memory delta; six also exceed the
triangle delta and eight exceed the draw-call delta. These deltas include merged changes.
The gallery includes exact before/after counts. Continuous distant coverage replaces formerly
empty views with real geometry; the merge also changed resource accounting and scene content.
One same-merge Seattle control with distant coverage disabled measured 548 draws, 2,938,635
triangles and 567.1 MiB resident. It is a diagnostic, not a universal baseline. The original
Sammamish overhead was incomplete and cannot support a cost regression claim.

All capture animation is frozen. The displayed 16.7 ms is artificial and must not be reported
as measured 60 FPS. No hardware-performance sign-off is made. Adaptive streaming, approximate
oblique poses, historic photo dates, lighting and unknown map cover also prevent pixel-level
accuracy claims. Remaining visible priorities are canopy continuity, unknown urban cover,
Nijo's historic roof masses, source-map waterfront geometry and cheaper distant coverage.
