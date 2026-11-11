# World Explorer visual review

Reviewed 10 November 2026. Research and recommendations; no engine, palette or content changes in
this pass. The standard these findings are held to is the
[medium-fi style guide](../../docs-src/guide/medium-fi.md), which this review also revised
(see [What changed in the style guide](#what-changed-in-the-style-guide)).

The goal: a visitor should feel they have found a model trainset of the whole world that is theirs
to play with. Fifty-one frames across all five region packages were flown at street level, from
rooftop height, from a few hundred meters and from 6 km, at noon, morning, sunset, dusk and
night, in fair, overcast, rain, storm, snow and fog, and at three quality settings. Thirty-two
improvements follow, ordered inside each group by what they buy for what they cost.

Local evidence: [frame gallery](../../.artifacts/visual-review/index.html), with every pose and
setting in `.artifacts/visual-review/frames.json` and the capture harness beside it. Frame ids
below (`a16`, `b05`, `c03`) name gallery frames. The folder is ignored by Git.

## Method and limits

- World Explorer on a private Vite port, headless Chromium, `backend=webgl` (the explorer's
  default), 1600 × 900, ambient life on, HUD off. Each frame waited for zero loading terrain,
  layers and landmarks for five seconds.
- Seattle-region frames (`a…`) and five early frames elsewhere (`b03`, `b04`, `b06`, `b09`,
  `b10`) used `quality=high`. The rest of the region frames and every time and weather frame
  (`b…`, `c…`) used `quality=balanced`, the tier automatic quality starts from. `c13` is
  Economy. The gallery labels each frame with its tier.
- The sky date was set per region for local midday, and `month` was set to match it.
- WebGPU was not reviewed: headless WebGPU output is unreliable on this machine. Ambient
  occlusion exists only there, so none of these frames has it.
- Frames were taken within about ten seconds of loading. Traffic and pedestrian counts are a
  lower bound.
- Sydney Harbour and central Kyoto did not finish loading at `quality=high` in a headless page
  (one renderer reached 4 GB and another ran out of memory with two pages open). That is an
  observation from a shared workstation, not a performance measurement.
- No photographs were matched in this pass. Judgements are against the style guide and against
  what the places are known to look like. Colors quoted from source are sRGB hex with HSL in
  brackets.

Counters from the status readout, for scale:

| Setting | Triangles | Draws | Geometry |
| --- | --- | --- | --- |
| `quality=high`, Seattle and Eastside frames under 500 m | 19–23 M | 2,350–3,800 | 1.2–2.0 GiB |
| `quality=balanced`, city frames in all regions | 5–9 M | 940–1,850 | 0.4–0.85 GiB |
| `quality=economy`, Sammamish retail | 3.3 M | 765 | 0.18 GiB |

## What already works

Keep these; several are the best argument for the trainset idea.

- **Kyoto** (`b05`, `b07`, `b08`): a grey roof mosaic, mid-value green hills with round crowns,
  moats and readable relief. It is the reference for how every region should sit in value.
- **Houses** in the Seattle region (`a14`, `c16`): varied siding colors, shingle roofs,
  dormers, chimneys. From 200 m Wallingford is a convincing model town.
- **Working details**: rail yards full of colored cars (`a06`, `a07`), ferries, aircraft on the
  apron, the Great Wheel, marked pitches and diamonds (`a11`), storage tanks, marina docks.
- **Street-level paving** (`a01`, `a03`): slab joints, stains, gutter grit, signals, lamps,
  bike racks and sign bands.
- **Cloud shadows** on the ground (`a12`, `a15`), **fog** (`c10`), the **sunset sky gradient**
  (`c02`) and **lamp-lit streets at eye level** (`c05`).
- **Long views**: Sydney's skyline from Bondi at 7 km, Seattle's from Boeing Field.

## Main findings

1. **The frame is too dark where it should be mid-value.** Glass towers, Pacific Northwest
   conifers and turf, deep water and every shadow render close to black in full sun. Economy,
   which has no cast shadows, is easier to read than High (`c13` against `a16`). This is a
   palette and light problem, not a detail problem, and fixing it costs no frame time.
2. **Exposure follows only a high, clear sun.** Morning, sunset, overcast, rain and snow are
   all underexposed (`c12`, `c01`, `c08`, `c07`, `c09`); night is black (`c04`, `c06`).
3. **There is no air inside two kilometers.** Haze begins at 2 km, so a skyline is a cut-out
   and distant tree instances stay crisp speckle.
4. **Large surfaces are dead.** Water is one flat color, industrial and port land is a cream
   plane, fields are flat polygons, lots are empty at Balanced, yards have no edges.
5. **Streets lack their two cheapest signs of life**: street trees and parked cars.
6. **Regions are uneven.** Kyoto is close to the target. Sydney reads as a desert town on an
   emerald sea, the Seattle region is cold and dark, Yuma is brown on brown, and Delhi's
   seeded houses stand alone on bare ground.

## Thirty-two improvements

Each entry gives the evidence, the change, its cost at run time, where to start and how to tell
it worked. Hex values proposed here are starting points to tune, not measurements. P0 changes
the first impression; P1 is clearly visible; P2 is polish.

### Light and value

#### 1. Glass that reflects the sky

**P0 · `a00`, `a17`, `a18`, `a02`, `a08`, `b01`, `c15`.** Downtown Seattle, Bellevue and Sydney
are clusters of near-black slabs at noon with no cloud. Tower walls are light
(`towerWalls`, mostly `#b8bfc4` and `#9eacb8`), but the tower recipe glazes 98% of bays with
`window_grid`, whose pane is `#4a6175` [208°, 22%, 37%] and almost entirely diffuse. A wall gets
under half a roof's light at midday, so the pane renders close to black. The far structural
level shows walls instead of glass, so the same tower is light far away and black close up
(`c15`).

Give panes a real sky reflection from the environment map the renderer already builds, so a
tower takes the sky's color: lighter toward its top and toward grazing angles, gold at sunset.
Set the flat and structural levels to the pane's displayed average, so all three levels agree.
Add two or three glass tints (blue-grey, green-grey, bronze, silver) chosen per building.

**Cost:** none; same materials and draws. **Start:** `content/worldgen/materials/window_grid.matgraph.json`,
the flat glass tone in `packages/worldgen/src/kernel/recipe.ts`, `towerWalls` in
`content/ecology/source/aerial-palettes.mjs`, the tower block of `build-architecture.mjs`.
**Done when:** at noon no tower face is darker than 15% on screen, a tower's mean lightness
changes by less than 8 points across its three levels, and the skyline reads light against the
sky as the guide's palette rules ask.

#### 2. Bring the Pacific Northwest palette back into band

**P0 · `a09`, `a10`, `a11`, `a13`, `a14`, `a12`.** Lawns read teal and forests read black.
Source values: turf `#2f5440` [148°, 28%, 26%], open ground `#344947` [174°, 17%, 25%], forest
floor `#1a3132` [183°, 32%, 15%], redcedar `#1a3436` [184°, 35%, 16%], Douglas-fir `#1f3a2e`
[153°, 30%, 17%], hemlock `#23423b` [166°, 31%, 20%]. The guide's bands are 45–55% for lawn
and 30–40% for conifers and forest floor, with lawn near 82° and fir near 144°. These colors
were fitted to NAIP orthophotos, which carry a cyan cast and already contain every tree's
shadow; the engine then adds its own shadows and tone curve on top.

Refit as albedo: conifers at 28–36% lightness and 115–150° hue, forest floor at 24% or more,
turf at 38–46% and 85–115°. Keep the region's character (deeper and cooler than the generic
lawn) through hue and saturation and through crown self-shadow, not through near-black albedo.
Re-run `scripts/aerial-color` and report the score beside eye-level captures; a few points lost
there is the accepted price.

**Cost:** none. **Start:** `content/ecology/source/build-catalog.mjs` (`pacificCoastal`, and the
`cedar`, `douglas_fir`, `hemlock`, `sitka_spruce`, `fir` plants). **Done when:** grass reads green
at eye level, a forest slope averages 18–30% on screen with visible crown shading, and three
greens in one frame (`a11`) look like one family.

#### 3. Shade that keeps its color

**P0 · `a03`, `a09`, `a16`, `b16`, `c13`.** Shaded walls, tree shadows and the undersides of
decks are close to black. The rig puts shade at about a third of sunlit before the ACES curve,
and downward faces get almost nothing.

Raise sky fill and ground bounce so shaded ground sits at 40–50% of the same ground in sun, keep
the shadow tint gently cool, and give downward faces the ground's bounce color. Compare ACES
with a curve that has a softer toe (AgX or Khronos neutral) on the same frames before choosing.

**Cost:** none. **Start:** `EARTH_LIGHTING` and `EARTH_TONE_MAPPING` in
`packages/earth/src/client/look.ts`, lighting in `packages/client/src/sky/visual.ts`. **Done
when:** no region larger than a car is under 8% on screen at noon, and High is at least as easy to
read as Economy in the `a16` pose.

#### 4. Exposure that follows the light

**P0 · `c12`, `c01`, `c08`, `c07`, `c09`.** At 07:00 with the sun at 16° the Sammamish frame is
nearly night. Overcast noon is as dark as dusk. Exposure adaptation holds sunlit ground steady
only above `referenceElevation` (26°), and cloud cover removes up to 92% of the sun with nothing
given back.

Extend the adaptation: hold skylit and sunlit mid-grey ground at a steady display value from
about 4° of sun upward and under any cloud cover, and let it fall only through twilight. An
overcast day is bright, soft and shadowless, not dim. It is one analytic factor from sun
elevation and cloud transmission; no histogram or extra pass.

**Cost:** none. **Start:** `referenceElevation` handling and cloud dimming in
`packages/client/src/sky/visual.ts`, `EARTH_LIGHTING`. **Done when:** mean luminance of one pose
at 07:00, at clear noon and at overcast noon agrees within 15%.

#### 5. Air from the first few hundred meters

**P0 · `a00`, `a12`, `a08`, `c02`.** Haze is a linear fog from 2 km to 20 km
(`createEarthFog`, `updateEarthFog`). A skyline 1.5 km away has no atmosphere at all, and distant
tree dots stay hard. At sunset the Olympics are hazed paler than the orange sky behind them,
because the haze takes one horizon color in every direction.

Use an exponential haze with a height falloff: a few percent at 500 m, about 15% at 2 km, half
at 8 km on a clear day, thinner above a few hundred meters so ridges stand clear of valleys.
Tint it warm within about 40° of the sun and cool away from it, and take its color from the sky
in the view direction. Scale it with weather visibility as today.

**Cost:** one exponential and one dot product in the shared fog term; no pass. **Start:**
`packages/earth/src/client/atmosphere.ts`, `earthHazeColor` in `look.ts`. **Done when:** in the
`a00` pose the far shore is at least 15 points lighter and visibly lower in contrast than the
waterfront, and in `c02` the ridge is darker than the sky behind it.

#### 6. Quieter sidewalks

**P1 · `a16`, `a08`, `c16`, `b08`, `a12`.** Curb `#ded9cb` [83% lightness] and sidewalk
`#c6c4b9` [75%] are the lightest things in most aerial frames, so every street carries a
cream double outline; in the far ground texture roads become pale threads.

Drop the sidewalk to about 68% and the curb to about 74%, vary slabs a little more, and let
the far raster paint roads in asphalt grey with sidewalks blended toward it.

**Cost:** none. **Start:** `packages/terrain/src/surface-styles.ts`, road paint in
`packages/terrain/src/landcover-raster.ts`. **Done when:** from 300 m roofs, not sidewalks, are
the lightest element, and far streets read mid grey.

### Sky, water and weather

#### 7. Sculpted cumulus

**P1 · `a10`, `a12`, `a15`, `b07`, `c02`.** Fair-weather clouds are smooth lens shapes with
soft edges: lenticular saucers from below, flat white pads with stippled edges from above. They
are the one element drawn in a different hand from the faceted world under them.

Shape the density so a cloud has a flat base at one altitude, a billowed top and a shaded
side: erode by height, strengthen self-shadow so bases are grey and tops bright, and use smaller
cells (the explorer's fair profile sets `scale: 24000`). Hide stipple with blue-noise jitter.

**Cost:** same march; shaping only. **Start:** `packages/client/src/weather/clouds.ts`,
`explorerProfile` in `examples/world-explorer/src/weather-controls.ts`. **Done when:** from the
street and from above, a cloud shows a base, a lit top and a shaded side, and no dither pattern.

#### 8. Water that takes the sky

**P0 · `a00`, `a18`, `c01`, `b01`, `b04`, `a11`, `c10`.** Water covers half of the best-known
views and is one flat color: near-black navy for Puget Sound (`#071f2b`, 10% lightness), vivid
emerald for Sydney (`#22493f`), black at sunset. The ripple texture visibly tiles, the sun path
is patchy white speckle, a garden pond takes the region's deep-sea color and reads as a hole,
and Bondi has no shallows or surf.

- Reflect the sky in the reflected direction with a stronger Fresnel term: deep and clear
  below the camera, sky-bright toward the horizon, orange at sunset.
- Lighten and warm the water within a few meters of a shore from a shore-distance value, and
  draw a foam line on ocean beaches.
- Break the ripple repeat with a second rotated scale; draw the sun path as a soft lobe.
- Give ponds, moats, pools and narrow rivers a lighter tint than open water.
- Revisit regional colors as albedo: Sydney Harbour is blue-green, not emerald, and no open
  water sits under 18% lightness.

**Cost:** shader terms and one small per-vertex value. **Start:** the water material in
`packages/terrain/src/semantic-client.ts`, `packages/earth/src/client/water.ts`,
`water-ripples.ts`, `water` in `examples/world-explorer/src/regions.ts`. **Done when:** the bay
carries the sunset, water lightens toward the horizon from 450 m, and no repeat is visible at any
height.

#### 9. Wet streets and white roofs

**P1 · `c07`, `c09`.** Rain is streaks over a dry, dim street. Snow falls on green ground and
bare roofs.

Drive two weather values through the ground, pavement, roof and foliage materials. Wetness
darkens paving by about a quarter and smooths it, so signals and lamps streak on the road. Snow
cover whitens up-facing ground, roofs and crowns by slope and noise, leaving ploughed roads
darker.

**Cost:** a few shader operations. **Start:** ground and pavement materials in
`packages/terrain/src`, `building-weathering.ts`, `scatter-material.ts`,
`packages/client/src/weather/visual.ts`. **Done when:** a rain frame and a snow frame are
recognizable with the particles turned off.

#### 10. One calendar

**P2 · `a00`.** Foliage follows the host clock's month, not the sky's date
(`vegetationMonth` in `main.ts`), so a June sky shows November leaves.

Take the month from the sky date control and update it when the date changes.

**Cost:** none. **Start:** `examples/world-explorer/src/main.ts` near `vegetationMonth`,
`sky-controls.ts`.

### Night

#### 11. A night you can see

**P1 · `c03`, `c04`, `c05`, `c06`.** At night the world is black with bright fragments. Lit
windows are near-white bands a whole floor wide on black towers; lit shopfronts are blank white
panels; lamp pools are hard pale discs; only the sixteen nearest lamps light anything; water and
ground are pure black, so the city has no shape.

- Raise the night floor (`nightAmbient` 0.05) to a deep blue that leaves roofs, roads and
  water as dark shapes, with a little more over built-up ground.
- Light windows per pane, not per band; warm whites that peak below white; fewer by midnight.
- Draw every lit street in view as a string of warm points, instanced or painted into the far
  ground texture, so a city's grid glows from the air.
- Give lamp pools a soft radial falloff.
- Let water pick up the lit shore.

**Cost:** a few thousand instanced points; otherwise shader values. **Start:**
`packages/worldgen/src/client/night-windows.ts`, `packages/terrain/src/surface-lights.ts`,
`packages/earth/src/client/night-lighting.ts`, `EARTH_LIGHTING.nightAmbient`. **Done when:** from
450 m at midnight the street grid, the shoreline and the skyline are each readable.

### Streets, lots and ground

#### 12. Parking lots that look used at every tier

**P0 · `c14`, `a16`, `a05`.** At Balanced the Sammamish lots have no cars and read as empty
slabs; at High they have cars but no visible stall paint, islands, trees or lamps.

Keep cheap instanced car proxies and stall paint at Balanced within a few hundred meters and
occupancy color patches beyond. Add end-of-row islands with a tree, lamp standards on a grid,
cart corrals at supermarkets and painted arrows. Vary occupancy by use and hour.

**Cost:** instanced proxies (160 triangles) inside the existing parked-vehicle pool. **Start:**
`packages/terrain/src/surface-client.ts` (parking), `surface-parking.ts`,
`examples/world-explorer/src/surface-controls.ts`. **Done when:** the `c14` pose shows occupied,
marked lots at Balanced and no lot larger than 2,000 m² is an unmarked plane.

#### 13. Street trees and curbside cars

**P0 · `c16`, `a03`, `b08`.** No street tree is inferred; the planting strip is left empty.
Nothing is parked at a curb. Seattle's residential streets, which are lined with broadleaf
trees and parked cars, show scattered conifers and bare asphalt.

Infer a street tree every 8–12 m in the planting strip of sidewalked residential and commercial
streets, from a regional street-tree list, clear of junctions, driveways and lamps. Park
instanced car proxies along residential curbs at 30–60% occupancy. Fund both from yard-tree and
far-tree instances rather than new budget.

**Cost:** reallocated instances. **Start:** the sidewalk builder in `surface-client.ts`,
`packages/worldgen-earth/src/kernel/residential-trees.ts`, `mapped-props.ts`. **Done when:** a
residential street at eye level shows trees and cars within 50 m in every region.

#### 14. Yards with edges

**P1 · `b10`, `b17`, `c16`.** Lots are bare ground up to the wall. Mapped `barrier` lines are
not decoded, and fences are inferred only around seeded houses.

Decode fences, walls and hedges into low instanced strips. Infer plot edges by regional family
for mapped houses too: block walls in Yuma, plot walls in Delhi, hedges and pickets in Sydney,
garden walls in Kyoto. Add a driveway and a car to a share of detached lots, and garden beds.

**Cost:** instanced strips under the furniture budget. **Start:**
`packages/terrain/src/mvt-semantic-decoder.ts`, `frontage-yard.ts` and `lot-plans.ts` in
`packages/worldgen-earth/src/kernel`.

#### 15. Working ground for ports, industry and rail

**P1 · `a06`, `a00`.** Harbor Island and Terminal 46 are featureless cream planes
(`industrial: '#9d978b'`) with thin service roads.

Dress land by use: rows of instanced container stacks and a few gantry cranes on container
terminals, trailers and pallets in industrial yards, asphalt-grey ground with painted lanes.

**Cost:** instanced boxes, one shared material. **Start:** `land-sites.ts` in
`packages/worldgen-earth/src/kernel`, surface colors in `build-catalog.mjs`. **Done when:** no
industrial polygon over a hectare is a single flat color.

#### 16. Fields with rows

**P1 · `b11`, `b09`.** Yuma's irrigated valley is a set of flat pale polygons from 500 m: no
furrows, crop variety, canals or farmsteads.

Stripe each field along its long axis in the ground shader, pick three to five crop and fallow
tones by region and month, add ditches along edges and the occasional farmstead. Fade to flat
tone beyond a few kilometers.

**Cost:** shader, one per-vertex direction. **Start:**
`packages/worldgen-earth/src/kernel/agriculture.ts`, the ground material.

#### 17. Calmer ground noise

**P1 · `b12`, `b13`, `a07`, `a12`.** The bare-soil mask draws two-tone camouflage blotches
across open desert, shrub clumps read as craters with shaded rims, the Boeing Field infield
carries hard-edged dark blotches, and fairways streak.

Widen the mask edges, cap patch contrast near ±6%, draw shrub clumps as soft dabs without a
rim, and check every thresholded layer from 300 m.

**Cost:** none. **Start:** `surface.detail` handling in the ground material
(`packages/terrain/src`), `desert.detail` and `dry.detail` in `build-catalog.mjs`.

#### 18. Junctions, crossings and lanes

**P2 · `a03`, `c16`.** Roads overlap at junctions with square corners; mapped crossings, cycle
lanes, bus lanes and roundabout islands are not drawn.

Build a junction polygon with curb radii by road class, draw mapped crossings, paint cycle lanes
from tags and raise medians where mapped.

**Cost:** small; replaces overlapping road ends. **Start:**
`packages/terrain/src/surface-network.ts`, `transport-features.ts`.

#### 19. Pavement seated on steep ground

**P1 · `b02`.** On George Street in Sydney the sidewalk bands tilt and tear apart, with soil
showing through the gaps, and a railway crossing gate stands on a tram street.

Conform bands to a smoothed local surface, weld neighboring band edges, limit cross-slope, and
keep crossing gates off street-running track. Add this pose to the capture set.

**Start:** `surface-client.ts`, `road-earthworks.ts`, level crossings in `surface-rail.ts`.

#### 20. Shores with an edge

**P2 · `a06`, `b04`, `a00`.** Land meets water at a cut edge or a vertical curtain.

Choose a shore by context: sand with a foam line on beaches, a capped seawall on quays, riprap
or reeds on natural banks.

**Start:** `packages/terrain/src/water-shoreline.ts`.

### Buildings

#### 21. Finished tower tops and setbacks

**P1 · `a02`, `a18`.** Towers are straight extrusions with flat, empty tops in one curtain-wall
pattern. `massing.setbacks` is declared in more than a hundred styles and built by no kernel
code.

Build setbacks, add a mechanical penthouse and parapet with a few crown variants, and offer
three or four facade rhythms (ribbon, grid, pier, punched) chosen per building.

**Cost:** a few hundred vertices per tower at tier 0 and 1. **Start:**
`packages/worldgen/src/kernel/archstyle-schema.ts`, massing in `building.ts`, `roof-details.ts`,
the tower block of `build-architecture.mjs`.

#### 22. Mapped appearance wins

**P1.** `roof:shape`, `roof:colour`, `building:colour` and `building:material` are read nowhere.
Where mappers recorded them, accuracy is free.

Decode them and let them override the style's choice, clamped to the palette bands. Check first
which of these the region packages' tiles carry.

**Start:** `packages/terrain/src/mvt-semantic-decoder.ts`,
`packages/worldgen-earth/src/kernel/semantic-adapter.ts`.

#### 23. Rows that are houses

**P1 · `b03`.** Paddington's terrace rows are mapped as long footprints and become sheds under
one hip roof.

Split long, narrow attached-residential footprints into 5–7 m party-wall units, each with its own
roof, wall color and chimney.

**Start:** footprint analysis in `packages/worldgen/src/kernel`, the regional `attached` styles.

#### 24. More kinds of building from the map

**P1.** A church without a matching POI becomes a shop; stadiums, greenhouses and construction
sites become windowless boxes; fuel stations have no handling; `power` and `man_made` features
are decoded and never placed.

Add use styles and props: place of worship by building tag with a regional tower form, fuel
station canopy and pumps, glass greenhouse, stadium bowl fallback, construction frame and crane,
warehouse with loading docks, and pylons, water towers, silos and masts.

**Start:** `building-use.ts` and the style rules in `packages/worldgen-earth/src/kernel`,
`content/worldgen/styles/use/`.

#### 25. Infill that belongs to its region

**P1 · `b10`, `b15`, `b17`, `b09`.** Yuma's seeded houses are dark adobe-brown boxes (walls near
30–35% on screen, under the painted-wall band; the cause was not traced) on bare sand. In Delhi,
detached white boxes are scattered where the real fabric is continuous.

Give each family a lot plan: light stucco ranch houses with carports, gravel yards and block
walls in the Southwest; abutting two- to four-storey plots with walls and roof tanks in South
Asian cities. Take density from the mapped neighbors' coverage.

**Start:** `frontage-infill.ts`, `lot-plans.ts`, `architecture-families.mjs`.

#### 26. Shopfronts with a hint of inside

**P2 · `a01`, `c05`.** Shop glass is an opaque dark pane by day and a blank white panel by
night.

Sample one shared interior atlas behind storefront glass with a parallax offset, lit at night.

**Cost:** one shared texture. **Start:** the window material in `packages/worldgen/src/client`,
`storefronts.ts`.

#### 27. Landmarks that read from the skyline

**P1 · `b01`.** From 1.2 km at Balanced neither the Opera House's shells nor the Harbour
Bridge's arch can be made out, and a roof part floats above the CBD with nothing under it.

Give landmarks a tighter error than generic buildings so the skyline level is replaced sooner,
verify these two models' skyline levels against the guide's three-feature rule, and drop or
support building parts whose base is above the ground with nothing beneath.

**Start:** `structure-streamer.ts`, `building-parts.ts` in `packages/worldgen-earth/src`.

### Distance and engine

#### 28. Forest as a mass

**P0 · `a12`, `a13`, `a00`, `b05`.** A forest is thousands of separate dark dots over a
different-colored floor, which reads as noise from the air, and it stops at a hard line where
plant tiers end.

Past the plant tiers, draw forest in the ground shader as a lumpy, self-shaded canopy in the
crown color, cross-faded with the last instanced tier. Inside the tiers, bring the forest floor
toward the crown color so gaps do not sparkle. Fewer far instances pay for other items here.

**Cost:** negative on instances; shader on far ground. **Start:** the ground material, plant tiers
in `tile-budgets.ts`, the far-ground canopy tint in `packages/earth/src/client/worldgen.ts`.
**Done when:** a forested ridge has no visible line where trees end.

#### 29. Cross-faded level changes

**P1 · `c15`.** Building cells, plants and stand-ins switch level with a hard pop.

Match mean color across levels first (item 1), then dither between levels over a short distance
band or about 0.4 s.

**Cost:** both levels drawn only while fading. **Start:** `building-lod.ts`,
`screen-space-lod.ts`, `instanced-lod.ts` in `packages/worldgen/src/client`.

#### 30. Occlusion without a post pass

**P1 · `a03`, `a16`.** Ambient occlusion is WebGPU-only and the explorer defaults to WebGL, so
buildings meet the ground with no contact shading. The guide rightly forbids baking it into
models.

Darken ground within a couple of meters of walls and under dense canopy from the building
coverage the land-cover layer already computes, and give walls a per-vertex sky-visibility term
from their height and neighbors at generation time.

**Cost:** one blurred mask per tile; vertex color. **Start:** urban ground coverage in
`packages/terrain/src/semantic-client.ts`, wall vertex colors in the worldgen kernel.

#### 31. Close-range traffic and people

**P2 · `b06`, `a02`, `a03`.** An ambient car three meters away has black octagon wheels and no
lamps, and most street frames hold one car or none.

Swap the nearest handful of ambient vehicles to the 2,000-triangle drawn model, and raise
daytime density on arterials and downtown sidewalks inside the existing pools.

**Start:** `packages/ambient`, `packages/earth/src/client/ambient.ts`.

#### 32. A lens for the layout

**P2, optional.** A photo mode at High: a gentle tilt-shift band when looking down from a few
hundred meters and a light vignette. It sells the miniature, and stays out of the default
pipeline, which has no post pass on WebGL.

## Cost rules

Nothing above may make a tier slower. Items 1–11 and 17 are colors, light and shader terms.
Items that add instances (12–15, 24) take them from pools that exist, and item 28 returns
instances. The fixed High preset already reports about 20 M triangles in Seattle; before adding
geometry to it, take the same amount out. Measure draws, triangles and resident geometry on the
same pose before and after, at Balanced and Economy as well as High.

## Suggested order

1. Light and value: 1, 2, 3, 4, 5. Together they change every frame and cost nothing.
2. Large surfaces: 8, 28, 12, 13.
3. Night and weather: 11, 9, 7.
4. Ground and yards: 6, 14, 15, 16, 17, 19.
5. Buildings: 21, 22, 23, 24, 25, 27.
6. Engine polish: 29, 30, 31, 10, 18, 20, 26, 32.

## What changed in the style guide

[medium-fi.md](../../docs-src/guide/medium-fi.md) now states the scene standard these findings
measure against:

- The trainset goal, and a section of rules for the frame as a whole: values, hue, air, life,
  no dead ground, distance as mass, one calendar.
- The value floor applies to vegetation, glass, water and regional ground, and palettes are
  albedo: a photograph is converted before it becomes a color. This replaces the earlier
  exemption for orthophoto-calibrated regional palettes, which current Pacific coastal colors
  do not meet (item 2).
- Shaded ground is to keep 40–50% of its sunlit value. The rig's fill, set in the October
  aerial calibration, gives about a third (item 3). Both this and the palette rule trade a few
  points of orthophoto match for frames that read at eye level; they are the two places where
  this review asks to revisit a recent decision.
- Standards for sky, haze and water; streets, lots and yards; towers; night and weather;
  distance.
- A scene review, with standard views and pass conditions, beside the asset review.

## Reproduction

In the engine repository, with the World Explorer dev server running on a private port:

```sh
node .artifacts/visual-review/capture.mjs .artifacts/visual-review/frames.json .artifacts/visual-review/recapture
```

Each frame's pose, date, weather and quality tier come from `frames.json`. The harness reads the
canvas directly, one page per browser; edit its `base` URL and Playwright path for your checkout,
and use `--only=<ids>` for a subset. A frame that still reports loading work is marked
`INCOMPLETE` and is not evidence.
