# Medium-fi style guide

Molen's Earth view draws the real planet at full scale in a browser, with thousands of buildings,
trees, vehicles and landmarks on screen at once. Its look is **medium-fi**: a bright, polygonal
model-railroad version of the world. This page sets the standard for every model, building
style, palette and prop made for it, and ends with the review an agent runs before submitting one.

Medium-fi sits between two looks it avoids. It is not low-fi, meaning voxels, pixel art or bare
grey boxes. It is not high-fi either: photoreal surfaces, or even the most detail the engine can
draw. The nearest reference is an open-world game of the early 2000s, Grand Theft Auto III or Vice
City. Proportions are realistic, faces are visibly polygonal, and shared textures are simple under
a strong sun. Every object reads clearly, the whole frame is coherent, and it holds 60 frames per
second on ordinary laptops.

## Why medium-fi

Three constraints decide the style, and every rule below follows from one of them:

- **Scale.** A city view holds 20,000–35,000 procedural buildings and a few dozen landmarks.
  Budgets are spent per frame across all of them, not per model.
- **The browser.** WebGPU or WebGL on integrated laptop GPUs, phones and the occasional
  software rasterizer. Memory, draw calls and shader cost are tight.
- **Coherence.** Most buildings are generated from map footprints. Hand-made landmarks,
  vehicles and props must sit beside those procedural shells without looking like they came from
  a different game.

## The five rules

1. **Recognizable shape first.** Silhouette, proportion and two or three identity features carry
   recognition, not surface detail. The P-51 is unmistakably a P-51, like a good model-railroad
   P-51: correct planform, spinner and canopy, chunky but true. If a model is not recognizable
   with textures off and flat-shaded, more detail will not fix it.
2. **Shared, low-frequency textures.** Surfaces use a small library of shared 256² material
   graphs tinted by palette, never a unique texture per building. Hundreds of distinct models
   then cost a handful of textures.
3. **Fit any footprint.** Procedural buildings are generated from whatever outline the map
   supplies: L-shapes, courtyards, slivers and curves. A style has to stay coherent on all of
   them, so it is built from simple, rule-driven parts.
4. **Low-poly with levels of detail.** Cars are a little chunky, trees show their facets, and
   buildings carry few adornments. LODs add detail as the camera approaches. High-priority
   entities, such as the vehicle the player is in, earn more polygons than ambient copies.
5. **Three rendering modes.** Economy, Medium and High (see
   [Rendering modes](#rendering-modes)) change resolution, shadows and level of detail. They
   never change the palette or the style, so every mode looks like the same world.

## The look the engine provides

Author against the lighting the Earth view actually uses. Both Earth hosts share one rig:
`mountEarthView`, and viewers that compose their own, such as the World Explorer. The rig is
exported from `@bendyline/molen-earth/client` as `EARTH_SKY_PALETTE`, `EARTH_LIGHTING`,
`EARTH_TONE_MAPPING`, `EARTH_EXPOSURE`, `EARTH_WATER_COLOR` and `earthHazeColor`.

| Element | Value | What it means for an asset |
| --- | --- | --- |
| Sun | Warm white `#fff1d8`, intensity 3.5 | Sunlit horizontal faces render near their authored color |
| Sky fill | `dayAmbient` 2 from the sky dome, warm ground bounce `#7a7258` | Faces in shade sit at roughly a third of lit faces, cool-tinted |
| Tone mapping | Khronos PBR Neutral, exposure 1 | Authored colors keep their hue and saturation below the highlights |
| Cast shadows | On from the Medium tier up, in a shadow map that follows the camera | Do not bake shadows or ambient occlusion into colors or textures |
| Sky | Saturated zenith `#2f7fd3` over a pale horizon `#c4dcec` | Large pure-white surfaces outshine it; prefer off-whites and creams |
| Haze | The sky's own horizon color, from about 2 km | Distant ground dissolves into the horizon; do not add a fog color of your own |
| Water | `#286d83` with a soft sky reflection | Lakes and bays read clearly blue, never grey |

Two consequences matter for authoring:

- **Walls receive less light than roofs.** Under a high sun a vertical wall gets about half the
  light a roof gets. A wall palette therefore needs to be lighter than the color you want to see.
- **Shadows do the grounding.** A building, tree or car is seated by its cast shadow. Never fake
  contact shading with a dark gradient or soot band at the base of a model; a foundation is its
  own material, not a shadow.

### Color spaces

Getting color spaces wrong is the most common reason a model looks washed out or muddy next to
its neighbors.

- **Hex palettes are sRGB.** Archstyle palettes, scatter surface colors, terrain bands, landmark
  manifests and identity colors are sRGB hex. The client decodes them to linear before the GPU
  sees them, so a swatch renders as that swatch.
- **glTF vertex colors (`COLOR_0`) and `baseColorFactor` are linear.** Writing `[0.5, 0.5, 0.5]`
  gives the light grey `#bcbcbc`; the mid grey `#808080` is linear `0.216`. Convert from sRGB
  when you move a palette color into a GLB.
- **Base-color textures are sRGB; normal, roughness, metalness and occlusion maps are linear.**
- **Multiply tinting darkens.** A palette tint multiplies its material graph. The shared siding,
  render and shingle graphs average about 0.85 in sRGB (0.65 linear), so a tinted surface renders
  about 15% darker than its swatch. Author tints a step lighter, or keep a graph near white.
  Distant flat levels and loading placeholders multiply by the same mean
  (`TEXTURED_SURFACE_MEAN`), so a building's brightness holds as its detail changes; a new
  graph far from that mean will brighten or darken visibly at the switch.

## Color and palette

The palette is clean, coherent and realistic. Each kind of surface uses a narrow band of
lightness. Houses carry most of the color; downtown blocks are mostly light neutrals with color
where real buildings have it. Avoid both grey-on-grey and candy color.

| Surface | HSL lightness | HSL saturation | Reference swatches |
| --- | --- | --- | --- |
| Painted wall, siding, render | 60–90% | 15–60% | sage `#a3b78f`, slate blue `#8199b2`, cream `#efe3c4`, butter `#e6cf86` |
| Urban wall: concrete, panel, limestone | 55–90% | 0–25% | light concrete `#d2cec5`, limestone `#ddd6c6`, cool grey `#b8bfc4`, graphite `#8f9397` |
| Masonry, brick, timber walls | 45–65% | 25–45% | brick `#a8634b`, sandstone `#c9ab84`, cedar `#a77a54` |
| Pitched roof (shingle, tile, slate) | 35–50% | 6–40% | charcoal `#575c62`, brown `#725c49`, moss `#5a6d55`, terracotta `#a5644b` |
| Flat roof (membrane, gravel) | 62–80% | 0–12% | gravel `#a9a59c`, membrane `#c4c0b6` |
| Trim and frames | 85–95% or 22–30% | 0–30% | white `#f4f1ea`, dark frame `#3b3e42` |
| Untextured window glass | 35–45% | 20–30% | blue-grey pane `#4d6178` |
| Lawn and residential ground | 45–55% | 25–35% | lawn `#8aa065`, grass `#7fa258`, park `#6c9a55` |
| Paved and commercial ground | 60–70% | 5–12% | paving `#aaa59a` |
| Forest floor and conifers | 30–40% | 25–35% | forest `#3c6a3f`, fir `#3e7052` |
| Asphalt | 25–32% | 0–10% | road `#41484d`, with markings `#eee9d4` and `#e8bd57` |
| Identity and wayfinding accents | 35–60% | 55–90% | signal red `#b81d18`, chrome yellow `#e7b52a` |

Palette rules:

- **Houses carry the hue; urban blocks stay mostly neutral.** A house palette gives at least a
  third of its weight to colors with saturation of 25% or more, so a street of procedural houses
  never reads as grey concrete. Commercial, office and apartment palettes reverse that: about
  three quarters light neutrals (concrete, limestone, off-white, warm and cool greys), with clear
  hue as the minority. A downtown should read as a clean, light skyline, not a patchwork.
- **Tie color to material.** Brick colors belong on brick and concrete colors on concrete, so a
  style that mixes them names a `palette` on each material choice. Keep red and brown brick to
  about a tenth of an urban style's weight. Dark red and brown towers read as heavy blocks across
  a whole skyline.
- **No black and no white on large surfaces.** Large surfaces stay between 22% and 94% lightness.
  A near-black roof reads as a hole in the frame, and a pure white wall blooms in sun.
- **Roofs are darker than walls; flat commercial roofs are lighter.** Pitched roofs sit 15–35
  lightness points below their walls, so a neighborhood seen from above reads as roofs. Large
  flat roofs are light membranes and gravel, as they are in reality. A pitched style declares
  `materials.flatRoof` so its flat fallback is membrane, not shingle tinted charcoal.
- **Reserve saturated accents.** Strong saturation belongs to identity: a store's sign band, a
  landmark's signature color, a bus livery, a fire station. Use one accent per object.
- **Real landmarks use their real colors.** The Tacoma Narrows towers are green and the Golden
  Gate is International Orange. A generic recipe must never repaint a known structure.
- **Jitter gently.** Per-building variation of ±0.012 hue, ±0.05 saturation and ±0.05 lightness
  keeps a street from looking cloned without drifting out of the palette.
- **Regional palettes stay in band.** A desert region is warmer and a Japanese street is cooler
  and darker-roofed, but every region uses the same lightness bands.

## Geometry and polygon budgets

Budgets are per model and per level of detail. The scene and tile budgets in
[adaptive rendering performance](adaptive-performance.md) still decide how many instances fit.

| Asset | Near | Medium | Far |
| --- | --- | --- | --- |
| Procedural building | Style tier 0: roof, windows, trim, dormers, props | Tier 1: roof and windows, no trim or props | Tier 2 or an instanced stand-in box |
| Landmark or authored structure | Closeup ≤ 64,000 | Street ≤ 16,000, district ≤ 4,000 | Skyline ≤ 1,000 |
| Small static building | 1,000–8,000 | 500–2,000 | Box or silhouette ≤ 200 |
| Controllable vehicle (road, rail, aircraft or boat) | Up to 60,000; use the close-view standard below | 5,000–15,000 or a simpler silhouette | ≤ 2,000; instanced proxy for traffic |
| Ambient car or bus | ≤ 2,000 drawn | — | Proxy ≤ 160 |
| Tree | 240–450 | 120–140 | 12–20 |
| Street furniture (lamp, bench, rack) | 50–500 | 50–150 | 36–72 or none |
| Ground cover (tussock, fern, stone) | 20–70 | None | None |
| Figure (person or animal) | 1,000–4,000 | 600–900 | 100–300 rigid |

Geometry rules:

- **Flat shading.** Every face reads as a plane, with hard normals on architecture, vehicles and
  vegetation alike. Use smooth normals only on intentionally round forms, such as a fuselage, a
  dome or a storage tank, and give them enough sides that the silhouette stays clean.
- **Facet counts.** Cylinders and cones get 6–8 sides far, 12–16 near and 24–32 on a hero
  model. Spheres and domes follow the same rings. An octagonal column reads as round at street
  distance.
- **Nothing thinner than it can draw.** At the distance a level is used, an element must be at
  least a pixel or two wide. Cables, mullions, railings, guy wires and lattice members that fall
  below that move into a texture, merge into a solid panel, or drop out of that level. Sub-pixel
  geometry shimmers and costs as much as solid geometry.
- **No micro-bevels on scenery.** Controllable vehicles may use small edge breaks where they
  visibly explain construction at the driver's eye; remove them from distance representations.
- **One draw per material.** Merge a model's parts by material. Two to five materials is
  typical; more than eight needs a reason.
- **Instance repeats.** Seats, windows, bollards, lamps and trees are instanced or merged, never
  thousands of separate meshes.
- **Ground contact.** The base sits at Y=0, or on a declared attachment plane, with no floating
  gap and no deep embedding.

## Controllable vehicles: close-view fidelity

Every vehicle the player can drive, ride, fly or helm is a close-view subject. This includes
cars, pickups, motorcycles, bicycles, buses, rail vehicles, aircraft, small boats and ships.
The distant world remains medium-fi, but the player's vehicle must hold up from the seat and
when walking alongside it. Do not remove useful cockpit or mechanical detail merely to meet
an ambient traffic triangle budget. An ambient-only prototype should acquire controls, seats,
collision and a usable operator view as it becomes a finished vehicle.

Keep the inherently polygonal style: deliberate planes, clean curves with finite segments,
coherent paint colors and believable material response. Increase fidelity through shape and
construction, not a blanket of photographic textures or exaggerated dirt. A model should still
read correctly with textures disabled. Model the parts a nearby player can understand:

- **Road and rail:** proportioned body panels, real window openings and pillars, door and hood
  gaps, wheel wells, tires with shoulders, rims, lug hardware, brake discs/calipers where visible,
  lamps with housings, mirrors and stalks, wipers, grilles, handles, badges and plates. Bicycles
  and motorcycles also need brake levers, grips, drivetrain, fork and suspension detail,
  cooling fins, footrests and correct rider contact points. Rail wheels have steel treads and
  flanges, not car tires.
- **Cabins and controls:** a clear forward view at the declared eye position, seats and
  headrests, panel/coaming depth, bezels, gauge marks, display frames, pedals, switches and
  readable nearby labels. Live steering wheels, yokes, levers and instrument needles retain
  stable named pivots. Decorative instruments must not be described as live telemetry.
  Calibrate live needles and their face markings from the same measured scale. Use named
  component signals and derived expressions with explicit units, local pivot axes, wraparound,
  response and missing-data behavior; see [instrument wiring](vehicle-interiors.md#named-variables-and-expressions).
  Verify zero, intermediate and maximum readings, heading wraparound, bank/pitch independently,
  and unavailable data from the seated view. Also check both directions of cockpit/control-surface
  movement in the imported hierarchy: actual grip, pedal and trailing-edge travel. Neutral
  overlays do not reveal reversed pivots. Record measurement approximations (for example,
  geometric altitude versus pressure altitude) and leave unsupported systems visibly inactive.
  Give each vehicle an authored cabin profile: match the model generation's instrument
  placement, vent shapes, screen arrangement, selector and steering-wheel form before adding
  small controls. Vary upholstery, door cards, storage, stitching and hardware where references
  support it. A central speedometer must not become a later generation's infotainment circle;
  a car with driver-only instrumentation must not receive a generic center screen. Generic
  Bendy models need purpose-specific controls too: yacht binnacles, workboat radios, ship radar
  consoles, bus door switches and rail traction desks. Record citable photo sources, authors,
  exact licenses, model/trim mismatches and gaps; prefer public domain/CC0, then appropriately
  attributed CC references. The image's license is separate from the code's license. Review
  a wide cabin/detail view in addition to the forward operator view.
- **Aircraft:** correct silhouette and airfoil/control-surface relationships first, then
  skin panel boundaries, access covers, cowling fasteners, rivet rows following structural
  attachments, hinges, intakes, exhausts, landing-gear joints, lights and antennas. Markings,
  warning stencils, serials and decals should conform to the actual skin without floating or
  z-fighting. Use references for the relevant variant: do not add a uniform rivet grid, rivet
  transparent glazing, or expose rivets over filled/painted laminar-flow wing surfaces.
  Record approximate fastener placement as approximate, not an engineering-accurate rivet map.
- **Boats:** a credible hull, sheer, transom and waterline, deck and cabin openings, glazing,
  rails and stanchions, cleats/fairleads, mooring fittings, hatches, navigation lights, life
  rings, propulsion hardware and a furnished helm. Sailboats add mast fittings and plausible
  standing/running rigging. Large ships need useful bridge detail even when the whole hull is
  distant from the camera.

Use small geometry or an authored decal/normal atlas for millimeter-scale details according
to their visibility. Flush rivets should stay nearly flush; do not turn them into oversized
bolts. Consolidate repeated fasteners and lettering by material, preserving articulated
groups. A thousand rivets must not mean a thousand draws. Small neutral authored atlases are
allowed; photographs, baked lighting and unnecessary unique 4K maps are not the default.

The 60,000-triangle near budget is a ceiling for an ordinary complete vehicle, not a quota.
A good 6,000-triangle road vehicle can be better than a noisy 60,000-triangle one. Larger ships
or complex flight decks may justify more with measured draw, memory and frame-time evidence.
Keep most static detail within roughly eight material batches; glass, lights, animated parts
and specialist cockpit materials can justify additional batches.

At medium distance, remove tiny fasteners, fine lettering, seat stitching and small fittings
first; retain windows, wheel proportions, control surfaces and recognizable livery. At far
distance use the existing instanced traffic/parking proxies or an authored simpler model.
Model-owned detail must not disappear while occupied. Record which distance fallback the host
actually uses; authoring a high-detail GLB alone does not install an LOD system.

Review the current model in neutral daylight with reflections and shadows: front/side/rear,
three-quarter, operator-eye, a close detail and normal chase/traffic distance. Check opacity,
outward normals, clear sight lines, wheel/propeller/rotor pivots, steering or gear travel,
rider/seat fit, boarding and scale. Validate and drive the same registered type headlessly.
Keep bulk captures local under `shots/` or `.artifacts/`, with concise hash-bound evidence and
one or two small summary previews.

### Vehicle reference overlays

**Authoring goal: use calibrated drawing/photo overlays to verify the exterior and interior
of every vehicle.** This applies to road, rail, air and water vehicles, including Bendy models,
new assets and revisions. Aim for front, side and top exterior comparisons, plus the dashboard,
cockpit or helm and the surrounding cabin. Make comparisons during shape construction and
repeat affected views after corrections; a final decorative comparison sheet is insufficient.
For Bendy designs, use a documented design drawing or suitable real-world exemplars to check
plausible proportions and ergonomics, without claiming an exact make or variant match.

Suitable references will not always exist. This is a strong default authoring goal, not a
requirement to invent evidence or block all work on an undocumented vehicle. Record which
views were sought, which were usable, and why a particular overlay could not be made. Use
published dimensions, multiple photographs and explicit reconstruction assumptions for the
remaining work. Mark exterior and interior confidence separately; an unavailable cockpit
drawing does not invalidate a supported exterior comparison or establish cockpit accuracy.

For an identified real vehicle, the review must compare the actual geometry with references:

1. Establish the exact variant and configuration. Gather useful exterior views and an
   unobscured cabin view, plus a dimensioned drawing when available. A licensed photo of a
   seat, canopy or exterior does not establish an instrument layout. Record missing views.
2. Overlay front, side and top orthographic renders with suitable drawings. For photographs,
   match camera position, orientation and field of view before comparing. Check major
   landmarks in meters: axles, rotor
   mast, wing roots, glazing corners, roof breaks, intakes and tail junctions. Distinguish
   body length from overall length including rotors, propellers or appendages. Record the
   measurements and discrepancies; do not claim an overlay comparison if none was made.
3. Correct the silhouette, cross sections, openings and major panel shapes before adding
   rivets, lettering or small controls. Shared generators may supply construction utilities;
   a generic body scaled to published dimensions is not an aircraft-specific airframe.
4. Compare the operator view and wide cabin with the correct variant's references. Aim for
   overlays of the panel face and cabin sections where drawings exist, and matched-camera
   overlays for photographs. Verify panel outline, depth and tilt, instrument positions and
   sizes, seat/pedal relationships, console position and windshield framing. A frontal panel
   image cannot establish cabin depth; review an additional angle or section. A repeated
   six-pack or a different display count is insufficient.
5. Establish a convincing representative model before expanding a family, then review every
   member individually. Record visual acceptance separately from geometry validity, flight
   tests and resource budgets. Unresolved silhouette or cabin mismatches leave the model a
   prototype; successful rendering, triangle counts and reference citations do not pass it.

Use these rules to make an overlay meaningful:

- **Calibrate before judging.** Identify the reference variant, source/page, projection,
  units and configuration (gear, steering, rotor azimuth, control surfaces). Set scale from
  published dimensions or measured controls and align a fixed datum. Check additional
  landmarks that were not used to align the images. Do not fit each body part independently.
- **Preserve proportions.** Normally use uniform scale, translation and rotation. Never
  stretch or locally warp a drawing or render to make the model agree. Correct scan distortion
  only when independent reference measurements establish it; record the original image,
  controls and correction. Photo perspective and lens distortion require a documented camera
  match or correction, not an arbitrary affine fit of a three-dimensional vehicle.
- **Keep disagreement visible.** Use a contrasting transparent outline, opacity toggle or
  difference view alongside the unmodified reference and render. Inspect the actual overlay
  at useful resolution. Note landmark offsets, missing volumes and uncertain boundaries;
  do not treat a global pixel score as a fidelity verdict. Choose tolerances appropriate to
  reference resolution, vehicle scale and the player's viewing distance, and record them.
- **Review both inside and outside.** Exterior bounds do not validate the cabin. Check glazing
  and panel openings, coaming and console volumes, seat/eye/control relationships and clearance,
  not just instrument count. Preserve a clear seated view while matching the reference.
- **Retain reproducible evidence.** Record source/author/license, reference image hash or
  revision, model source/runtime hashes, camera/projection, crop, scale, alignment controls,
  measurements, inspected views, corrections and unresolved gaps. Distinguish a measured
  overlay, a qualitative photo comparison and an unsupported assumption. Keep bulk references,
  overlays and iteration captures local under `shots/` or `.artifacts/`; retain concise reports
  and one or two small summary previews under the normal model-review image policy. Required
  authored source inputs remain in the source bundle. A saved citation alone is not a review.

### Bendy house brand

Generic vehicles use **Bendy** display names: Bendy Sedan, Bendy Pickup, Bendy Motorcycle,
Bendy Bus, Bendy Light Rail and Bendy Small Airliner, as well as Bendy names for boats and
bicycles. Apply the name to source titles, runtime labels, documentation and visible badges.
Keep stable asset/type IDs so existing scenes and saved references continue to resolve.

Identified real vehicles retain their actual identities: **P-51D Mustang** and **OH-6** are
the first examples. Future models such as a 2024 Ford Mustang require variant-specific
reference and proportion work; Bendy styling is not a substitute for the real vehicle.

## Textures and materials

- Use the shared material graphs in the default style pack (brick, siding, render, concrete,
  shingle, tile, slate, metal, glazing) before adding one. Their
  [catalog](https://github.com/bendyline/molen/blob/main/content/worldgen/materials/README.md)
  lists repeat sizes and intended use.
- Textures are 256² seamless and low contrast, with true physical repeats: a 2 m facade holds
  2 m of brick courses, not two giant bricks.
- A material graph that will be tinted averages near white (sRGB 0.85 or above), so palettes
  keep their meaning.
- Never bake directional light, shadows, ambient occlusion or dirt gradients into base color.
- Glass is a dark blue-grey pane with a modest reflection, not a mirror. Identity lettering is
  geometry or vertex color, not a texture per business.
- Photographs from research are evidence, not textures, and never ship inside a model.

## Procedural buildings that fit any footprint

A style is a set of rules applied to arbitrary outlines, so its parts must survive every shape:

- **Build from the outline.** Walls extrude from the footprint. Bays repeat at 2.6–4 m along each
  wall, and windows sit in those bays. Nothing assumes a rectangle.
- **Have a roof fallback.** Gable and hip roofs apply only where the footprint analysis allows
  them; anything else falls back to a flat roof with a parapet. The fallback must look as
  intentional as the main roof.
- **Keep details sparse and local.** Porches, dormers, balconies and shutters attach to
  qualifying walls and stop cleanly at corners, seams and courtyards. A detail that would cross
  a clipped edge is skipped.
- **Respect mapped data.** Keep the footprint, height, levels and minimum height. Missing height
  falls back to a conservative default for the category, not to the style's tallest form.
- **Declare the LOD tiers.** Each style lists which feature groups survive at tiers 0, 1 and 2,
  so distant buildings keep their roof shape and window rhythm after trim and props drop.

The [worldgen guide](worldgen.md) and the
[structure library](structure-library.md) cover the archstyle format and the 120 shipped styles.

## Landmarks and authored structures

A landmark earns its own model because people know it. Spend its budget on recognition, in this
order:

1. **Three identity features at skyline distance.** For the Space Needle that is the hourglass
   legs with a narrow waist, the flared halo of the top house, and the spire. For a suspension
   bridge it is the tower shape, the cable sag and the deck color. For a stadium it is the roof
   form and the bowl outline. The 1,000-triangle skyline level must still show all three, so
   author it by hand when automatic simplification loses them.
2. **Correct proportion and massing** at the district level, with up to 4,000 triangles.
3. **Rhythm and openings** (window bands, arches, truss bays) at street level, with up to 16,000.
4. **Selected detail** close up, with up to 64,000. More than that needs a written reason, and
   the levels below it must still meet their own targets.

Runtime levels come from the engine repository's landmark LOD generator, which meets these
targets for you where it can. It simplifies each level at its natural error first; if that
leaves the level more than 15% over target, it raises the error budget and prunes isolated parts
(seat rows, mullions, cables) until the level fits, up to 2% of the model's extent for district,
0.6% for street and 0.15% for closeup. A closeup that still does not fit stays over target
rather than blur; that is a master to re-author, not a level to force. A master already under
the closeup target ships as its own closeup only if it draws in 12 calls or fewer (an instanced
mesh counts once per primitive); otherwise it gets the material-merged derivative. The audit
`node packages/tooling/scripts/check-medium-fi.mjs` (in the engine repository) reports level
budgets, material counts, draw calls and near-black or pure-white surfaces for every structure.

Further rules:

- **Signature color.** Use the structure's documented paint and cladding colors, converted to
  linear for `COLOR_0`.
- **Repeated structural members.** Model a stadium's seat tiers as stepped bands, not
  individual seats (the stadium generators' `seatBand` draws a row as one band per aisle
  section). Model truss and lattice work as a few members plus a texture or panel, and
  cables as a few thick strands that thin out by level.
- **Nothing below the closeup's error.** The closeup level may drop detail smaller than 0.15% of
  the model's extent (about 40 cm on a 260 m tower), so do not author it: 3–7 cm window frames,
  stone joints, baluster rails and glazing bars on a tall building never reach the screen, and
  the generator cannot remove them for you, because each one is a closed little part.
- **Draw a curtain wall once.** A facade of framed cells is one glass face with its mullions as
  full-length strips just proud of it (the signature-tower `grid` and `facetedGlazing` helpers),
  not an inset pane and frame ring per cell. Per-cell panels made towers carry 300,000 to
  1,000,000 triangles that no level could simplify; as one face the same wall is a few hundred
  and looks the same.
- **Sit in the palette.** A landmark is the most saturated thing in its block only where its
  real color demands it.

## Ground

Large map polygons (a lawn, a meadow, a forest floor) are one color edge to edge, so the ground
gets variation from two cheap sources rather than from per-polygon textures:

- **The ground shader.** `createTerrainGroundMaterialAsync` from `@bendyline/molen-terrain/client`
  multiplies terrain and landcover vertex colors by world-space value noise: broad 64 m mottling,
  16 m patches, 4 m clumps and 1 m grain, plus straw-colored dry areas and darker lush ones on
  green ground only, so paving, sand and rock keep their hue. Finer layers fade out before they
  fall below a pixel. It costs no geometry, texture or upload. The Earth view uses it by default;
  the World Explorer's `?ground=flat` turns it off for comparison.
- **Ground cover.** Knee-high tussocks, ferns, small shrubs and stones from scatter rules on the
  `groundcover` layer (see [worldgen](worldgen.md)). They draw near the camera only, under 70
  triangles each, from their own budget so they never thin the trees, and not at Economy quality.

New ground palettes stay inside the lawn and forest bands in the palette table: the shader
already brightens and darkens them by about ±12% and tints dry patches toward straw.

## Vehicles, aircraft, trees and figures

- **Controllable vehicles require close detail.** Follow the close-view vehicle standard above:
  readable controls, fittings and interiors are part of the model. Ambient copies retain a
  simple silhouette and use the host's distance proxy where available.
- **Vehicles are chunky but true.** Wheel arches, glasshouse and stance carry the type. Paint is
  one shared material with per-instance color from a palette of real car colors. Glass is one
  dark material.
- **Trees are faceted.** Use 6–12-sided conifers and icosahedral crowns with flat shading, a
  slightly darker base, and varied heights. Never use alpha-card foliage.
- **Humans use polygonal realism.** Model facial relief, shaped hands and footwear, and clear
  garment construction on the shared animated skeleton. Spend close-view triangles on these
  features and retain cheaper crowd tiers; see [figures](figures.md).

## Rendering modes

The adaptive controller picks one of six tiers from measured frame times. They group into three
modes. Every mode keeps the same palette and style; only cost changes.

| Mode | Tiers | Resolution | Sun shadows | Objects | What it is for |
| --- | --- | --- | --- | --- | --- |
| Economy | Minimum, Low | 50–65% scale, ≤ 0.7 megapixels | Off | Simplified procedural tiers, stand-in boxes sooner, 6–8 px LOD error | Phones, weak integrated GPUs, software rendering |
| Medium | Medium, Balanced | 80–100% scale, ≤ 1.8 megapixels | Medium, then high | Balanced worldgen preset, 2.5–4 px error | Typical laptops |
| High | High, Ultra | 100–125% scale, ≤ 4 megapixels | High | Full detail, 1.5–2 px error | Discrete GPUs and capture |

Economy has no cast shadows, so it must still look good without them. That is one more reason to
keep roofs darker than walls and to avoid baked shading. Hosts choose a fixed mode with
`quality: 'economy' | 'balanced' | 'high'`, or let `'auto'` adapt; see
[adaptive rendering performance](adaptive-performance.md).

## Review before submitting

Run this review for every new or changed model, style or palette. A successful build is not a
visual approval.

Perform these checks during the same continuous pass that builds the model. Reuse the brief,
reference pictures and map fit already established; do not restart research in a separate
validation phase. Choose views that cover several checks together, fix observed defects and
record the completed result once. Revisit it when a defect or relevant change warrants it.

1. **Silhouette.** Render with textures off and flat shading. Name the object from the
   silhouette alone, at skyline distance.
2. **Budget.** Record triangles, materials and draw calls per level, and check them against the
   tables above. A level far over target usually means the master repeats a framed part per
   cell or per floor; find the helper that emits most of the triangles before tuning anything.
3. **Palette.** Every large surface falls inside its band. Hex palettes are sRGB, and colors
   moved into a GLB are converted to linear.
4. **Context.** View the model in an Earth scene beside procedural buildings at three distances
   (street, block, skyline), and at noon and late afternoon. It should look like it belongs.
   Neither the brightest nor the dullest thing in the frame, unless it is meant to be.
5. **Modes.** Check the Economy mode (no shadows) as well as High.
6. **Distance behavior.** Watch the switches between levels for popping, shimmer on thin parts,
   and floating or sinking at the base.

Useful captures from a project:

```sh
npx molen asset shot assets/my-model/asset.json --out-dir review --angles 8   # one asset, eight angles
npx molen worldgen preview my.archstyle.json --out style.png                 # a style on sample footprints
npx molen figure preview --preset human.adult --angles review --out figure.png
```

In the engine repository, the World Explorer is the reference scene. Its structure sheet renders
all 120 styles under the same light, `node examples/world-explorer/scripts/capture-structure-sheet.mjs`.

## Read next

- [3D art guidelines](3d-art-guidelines.md): scale, pivots, the material library and review captures
- [3D model assets](3d-model-assets.md): prompt-to-glTF authoring, import and hosting
- [Worldgen](worldgen.md): archstyles, palettes and LOD tiers in detail
- [Earth view](earth-view.md): the host these rules are written for
