# World Explorer world survey

Thirty-one places around the world as the engine draws them, beside photographs of the same
places: what did not match, what the November 2026 pass changed, and what is still open. It
follows the [building diversity review](BUILDING-DIVERSITY-REVIEW.md), which judged towns from
map tiles in a preview page, and the [medium-fi style guide](../../docs-src/guide/medium-fi.md).
The sites, cameras and photograph credits are in
[world-survey.reference.json](world-survey.reference.json).

## Method and limits

The explorer can stand anywhere through the hosted world terrain (`?package=qualla`), so each
place was seen in the Earth view itself, at High, in fixed July daylight, from one pose behind
and above it:

- **Towns:** Nafplio, Chefchaouen, Amsterdam's Jordaan, Bath, Hanoi's Old Quarter, Jodhpur,
  Cartagena, Stone Town in Zanzibar, Lisbon's Alfama, Reykjavik, Valparaíso.
- **Villages and farmland:** Pienza, Bibury, Hallstatt, Hongcun, Tegallalang, Djenné,
  Ollantaytambo, Kila Raipur in Punjab, farmland near Ames in Iowa, Shinyalu in western Kenya.
- **Wilderness:** the Lauterbrunnen valley, Yosemite Valley, Glen Coe, Seronera in the Serengeti,
  Erg Chebbi, Geirangerfjord, the Tambopata rainforest, Uluru, Torres del Paine, Monument
  Valley.

Each was compared with photographs from Wikimedia Commons: files geotagged near the site, two
chosen by eye. The towns and four of the villages were captured twice, with the style and atlas
content before the pass and after it; six villages were captured after only, and the wilderness
once. Captures ran on frozen builds of the explorer, with the content packs swapped per run.
Offline probes back the frames: one runs a zoom-15 basemap tile through the real adapter and
recipe and reports, for every building, what told the engine how tall it is; one lays an
invented town out on a grid of unmapped streets in any region; one renders a lineup of blocks
in any styles.

Limits. Two photographs are an impression of a place, not a measurement, and no pose was matched
to a photograph. The frames were taken while another pass was rebuilding terrain code in the same
tree and running its own captures: the two builds the before and after frames came from differ
in that code, a few poses differ slightly between them, and heavy towns (Bath, 80,000 buildings
in view) did not always finish loading in seven minutes. Commons has no usable photograph of
the place near the Punjab village, in western Kenya or at Tambopata (its geotagged files there
are insects and frogs); those three were judged from general knowledge and are marked so.
Ground, plants and water belong to a pass that was under way in the same tree, so what the
wilderness and farmland frames showed is reported here and nothing in it was changed. The
hosted world package and the explorer's own region packages differ in one way that matters
below: the hosted package's finest tiles are zoom 13. Nothing was measured on WebGPU.

## What did not match

1. **Clay tile was drawn dark red-brown.** Sunlit tile in the photographs of Nafplio and Lisbon
   measures 43–55% lightness at a hue of 15–23°. The engine's tile roofs measured 28–35%: the
   tile texture and the roof's own shading draw a tinted roof at about six tenths of its
   palette, and the palette (`#a8654a`) sat inside the band for dark pitched roofs.
2. **Whole building traditions were missing.** Chefchaouen was a field of sand-colored cubes
   under flat roofs (the photographs: limewash and blue wash, half of it under tile); Bath and
   Bibury were brick (honey limestone in every wall); Hallstatt was render under tile (boarded
   upper storeys under broad dark roofs); Pienza was painted render (bare stone and brick);
   and Djenné fell in West Africa's painted render under sheet roofs (earth the color of its
   ground under flat roofs).
3. **An invented street was a North American suburb everywhere.** Where a map has streets and no
   buildings, lots were laid 16 m apart with a house in a yard, a driveway and often a garage:
   in a Moroccan medina, a British terrace town and a street of Hanoi tube houses alike.
4. **Unmeasured buildings were given heights no evidence supported.** A basemap carries a
   height for about one building in ten; of 37 town tiles, 21 had heights on 2% of their
   buildings or fewer, and Chefchaouen's central tile has one measured building in 1,960. The
   rest are guessed, and three guesses made towers. The hotel style's own fallback is five to
   twelve storeys, so a 687 m² building in Chefchaouen holding a hotel's point was a twelve-storey
   slab and five lodgings in Mykonos were seven storeys or more. A prior written for the blocks
   round measured downtown towers fired on any densely built ground with no land use mapped.
   And a hospital's point made a 336 m² clinic five storeys.
5. **A tower was drawn as flats.** Where the map does give a height, the wall reaches it
   exactly, and the rows of windows are that height divided by the style's storey. So the
   Torre del Mangia in Siena (102 m, on a footprint of 21 m²) was 29 storeys of windows.
6. **An old town's blocks had a modern flat's storeys.** A masonry block took 2.85–3.1 m to a
   storey, so a mapped 21 m was seven rows of small windows where a palazzo has five floors.
7. **Every mid-rise block was the same building.** Outside the families whose blocks are built
   like their houses, a four-storey building was rendered concrete under a flat roof with one
   window size, whatever the town; a hotel, a hospital and an office each had one modern
   exterior for the whole world.
8. **A hotel in an old town was a hotel block.** A footprint of 600 m² holding a lodging's point
   took the hotel exterior. Old centers are often mapped a block to an outline, so Siena's
   center had 35 of them.
9. **A barn was a shop.** A large untyped footprint standing in mapped farmland took the
   commercial block, with a shopfront and rooftop plant.
10. **Waterfront cities had no region at all.** The architectural atlas's outlines are country
    coasts simplified at 0.02°, which cut estuaries, lagoons and inshore islands off, and the
    nearest-outline fallback reached 2.5 km. Central Lisbon is 2.6 km outside Iberia's outline,
    Venice 3.9 km outside Italy's, Cartagena 3.4 km outside Colombia's, Mumbai's Fort 4.9 km
    outside South Asia's; Cádiz, Kochi, Macau, San Juan, Portsmouth and Miami Beach likewise
    (ten of 72 coastal and island places checked). Their buildings were drawn in the worldwide
    fallback family: 61% of Alfama's roof area was flat grey membrane.

## What changed

- **Clay tile has its own band.** Terracotta is now `#c9774f`–`#d1946f` with pale weathered
  tiles among it (48–63% lightness), and roofs of fired or split units take a wider
  per-building jitter. The style guide records the measurement and the new row of its palette
  table. The Low Countries' roofs moved the other way: as much dark tile and slate as pantile.
- **Five more families and five more regions.** Alpine timber and render (the Alps), English
  limestone under slate (a belt from Bath through the Cotswolds), central Italian stone, brick
  and tile (Tuscany, Umbria, the Marche), Sahel earth under flat roofs (two regions from Senegal
  to Chad), and the Rif's limewash, blue wash and tile. 32 families, 608 regional styles, 61
  atlas regions. Arid towns' walls are whiter and more varied and South Asia's washes lighter;
  China's country houses keep their grey tile while its town plots go flat. Walls, like roofs,
  reach the screen at about six tenths of their palette, so a stone or a wash that should read
  light starts near 80% lightness: Bath's limestone at 74% drew khaki.
- **Invented streets follow the region.** A house style can say how the lots it invents line a
  street (`lots`): the share of blocks built as rows, fronts wall to wall at the back of the
  footway; how many fronts stand to 16 m; how deep and how tall. A block is rows or yards as a
  whole, storeys and rear walls step from house to house, and each front is its own building
  with its own door, its side walls blind. Twenty-three families build rows (85% of blocks in the
  Low Countries, the Rif and South Asia; three 5.3 m fronts, 13–18 m deep, for Southeast Asia's
  tube houses); North America, Australia and the Pacific keep yards.
- **A guess is bounded by its surroundings.** The Earth binding reads how tall a place is built
  from its own map (the storeys four in five measured buildings stay within, once eight are
  measured) and takes that or the region's ordinary block of flats, whichever is greater, as
  the most any unmeasured building there may be guessed at. The dense-district prior stops at
  it, and every unmeasured request carries it (`fallbackLevelsMax`). A region's flats are
  guessed a storey above its row houses: three floors at most in the Cyclades and the Sahel,
  five around the Mediterranean.
- **A use says what a building is for, not what it looks like in an old town.** A hotel, school,
  museum or hospital that is one of a row with no height mapped, or one occupant of a footprint
  holding four other businesses or a second institution, keeps its region's exterior. A lodging
  takes the hotel exterior from 900 m² (was 600) or a mapped 15 m.
- **A tower is a shaft.** A whole building under 250 m² with a mapped height of 20 m or more
  that is five and a half times its footprint's side gets a tier of openings every 11 m, in its
  region's masonry, in place of storeys. A slender part of a larger tower stays that tower's.
- **Old blocks are masonry blocks.** Where a town's larger buildings are built like its houses,
  its flats, shops and civic buildings have 3.15–3.5 m storeys over a 3.7–4.3 m ground floor,
  windows taller than wide over a low sill, a plinth, a string course to each floor and a
  cornice under a flat roof; civic buildings add pilasters.
- **Not every block was built in one decade.** Elsewhere one of the three facades a block can
  draw is an older building: brick under a cornice in North America, Australia, the Pacific and
  South Africa, the family's own wall materials in the rest.
- **A building on land has a region.** The nearest-outline fallback reaches 15 km (the atlas
  format now allows up to 50). All ten places resolve, at no measurable cost: resolving a point
  takes 10–12 µs either way. A quarter of Alfama's roof area is now flat and three quarters
  tile; Cartagena's walled city went from 78% flat to 44% once Latin blocks kept their tile
  through four storeys.
- **A large building in fields is a barn.** An untyped footprint of 250 m² or more on mapped
  farmland, orchard, vineyard or meadow takes the family's farm building.

## Measured

How tall the engine draws buildings, and what told it so, on 37 zoom-15 town tiles (the 36 of
the building diversity review and Chefchaouen):

| Buildings drawn with seven storeys or more | Before | After |
| --- | ---: | ---: |
| The map gave a height or a level count | 623 | 448 |
| The dense-district prior | 77 | 31 |
| A style's fallback | 69 | 9 |

The mapped ones fell because an old block's storeys are taller and towers are shafts, not
because any is lower: no wall is drawn above its mapped height. What is left of the guesses is
where measured neighbours stand as tall (Melbourne's 25 and Boston's 6 district blocks, Siena's
9 hotels beside measured palazzi of 30 m). Chefchaouen, Mykonos, Cusco, Lamu, Nairobi, Suva and
Stellenbosch draw no unmeasured building over four storeys.

On the explorer's own packages after the change:

| Tile | Measured | Seven storeys or more: mapped | district prior | fallback |
| --- | ---: | ---: | ---: | ---: |
| Seattle downtown | 81% | 162 | 26 | 0 |
| Pioneer Square | 69% | 65 | 5 | 0 |
| Capitol Hill | 22% | 2 | 0 | 0 |
| Bellevue downtown | 65% | 58 | 7 | 0 |
| Sydney, Paddington | 78% | 12 | 0 | 0 |
| Kyoto, Gion | 4% | 32 | 1 | 1 |
| Delhi | 8% | 8 | 0 | 0 |

Of the measured buildings of three storeys or more on those tiles, thirteen draw a storey
outside 2.5–5.2 m: halls, shafts, and heights that disagree with a mapped level count.

An invented town costs less in rows than in yards. On one zoom-15 tile of unmapped streets,
every building at full detail:

| Region | Buildings | In rows | Vertices | Lots laid out | Geometry |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pacific Northwest (yards) | 511 | 0 | 842k | 124 ms | 259 ms |
| Australia (yards) | 511 | 0 | 715k | 35 ms | 165 ms |
| Maghreb | 607 | 526 | 418k | 63 ms | 153 ms |
| Britain | 707 | 597 | 286k | 62 ms | 112 ms |
| Mainland Southeast Asia | 808 | 729 | 401k | 57 ms | 132 ms |
| Central Italy | 755 | 674 | 676k | 41 ms | 160 ms |

A row house has blind side walls and no fence, driveway or garage. The regional catalog is
1.25 MB (69.2 KB gzipped, against a guard of 70 KB); the explorer's core style pack grows from
2.35 MB to 2.42 MB.

## Place by place

Towns and villages, before and after. "Unchanged" means the frame did not move; the reason is
in the last column.

| Place | The photographs | Engine before | Engine after |
| --- | --- | --- | --- |
| Nafplio | Orange tile over cream and ochre render; shuttered three-storey fronts | Right forms, roofs dark red-brown | Tile at the photographs' value |
| Chefchaouen | Limewash and blue wash, tile on half the roofs | Sand-colored cubes under flat roofs; a twelve-storey hotel slab | White and blue walls, half tiled, nothing over four storeys |
| Amsterdam, Jordaan | Dark brick canal houses, four and five storeys, dark roofs | Orange pantile on most roofs | As much dark tile and slate as pantile |
| Bath | Honey limestone terraces and crescents under slate | Red brick under grey; the Circus and the Royal Crescent are there in plan | Limestone: khaki with the first palette, gold in a low frame with the second; the aerial frame of the second did not finish loading |
| Lisbon, Alfama | White walls under orange tile, roof after roof | Grey flat-roofed blocks: outside every region | Tile across the whole hill |
| Cartagena | Painted colonial fronts, balconies, tile | Muted, mostly flat, grey office slabs by the wall: outside every region | Colombia's family; slabs gone, tile on half the roof area |
| Hanoi, Old Quarter | Tube houses wall to wall, three to five storeys | A street grid on grass with the few large mapped buildings | Unchanged: the hosted world invents no buildings (open item 1) |
| Jodhpur | Blue and cream cubes under pale terraces | One dusty tan | Unchanged from the air: the terraces are the view (open item 4) |
| Zanzibar, Stone Town | Whitewashed coral stone, rusted roofs | Painted sheet roofs in red, blue and green | Unchanged (open item 4) |
| Reykjavik | Corrugated iron in red, yellow, black and white | Red and grey roofs over pale walls | Little change |
| Valparaíso | Painted corrugated houses up the hills | Dark roofs on tan hills; the first pose looked out to sea | Little change |
| Pienza | Bare stone and brick under tile, on golden fields | Pale render under brown-grey roofs | Warm stone under terracotta; barns in the fields |
| Bibury | Limestone cottages in a row under stone slates | Dark red brick | Limestone under grey-buff slates |
| Hallstatt | Dark boarded chalets over white render, broad roofs | Render under red tile | Timber and render under dark roofs |
| Hongcun | White walls, dark tile, horse-head gables | 44 mapped buildings: a pale patch and a pond | Unchanged: the village is not in the map |
| Tegallalang | Rice terraces under palms | Forest and flat fields | Unchanged: terraces are ground |
| Djenné | A town of earth, flat-roofed | Not captured | Earth-colored and flat-roofed on its island; all 6,448 buildings are mapped |
| Ollantaytambo | Adobe and tile on Inca stone, a tight grid | Not captured | The grid's streets with few buildings mapped |
| Kila Raipur, Punjab | No usable photograph | Not captured | Roads and trees on brown ground; the village is not in the map |
| Farmland near Ames, Iowa | Contoured green and gold fields, farmsteads behind windbreaks | Not captured | One flat tan with no fields or farmsteads mapped |
| Shinyalu, western Kenya | No usable photograph | Not captured | Small houses under colored sheet roofs among trees |

Wilderness, as found. Nothing here was changed.

| Place | The photographs | Engine |
| --- | --- | --- |
| Lauterbrunnen valley | Limestone walls, waterfalls, meadows, snow above | The U-shaped valley, forest on the slopes, the river and the village; walls draw as bare brown slope |
| Yosemite Valley | Grey granite domes over conifer and meadow | Valley, river, conifers and Half Dome's shape; granite draws as tan earth |
| Glen Coe | Treeless green and brown hills, burns, a wet floor | Treeless hills and a loch, one olive |
| Seronera, Serengeti | Grass plain, scattered acacia | A tan plain with scattered shrubs |
| Erg Chebbi | Orange dunes 100 m high | A flat grey-tan plain: no dune relief in view, no sand color |
| Geirangerfjord | Forested walls, waterfalls, a village at the head | The fjord, its walls and the village; thin forest |
| Tambopata | No usable photograph | Closed broadleaf canopy, a meandering river and a clearing |
| Uluru | Red-orange rock on red earth | The rock in relief, drawn in the plain's khaki |
| Torres del Paine | Pale granite towers, glacier, beech forest | Glacier white and green slopes; the towers are green, and one elevation spike stands as a needle |
| Monument Valley | Red buttes on red earth | Buttes and mesas in relief on khaki ground |

Three things recur. Bare rock is not a surface: granite, sandstone and limestone walls take the
color of the ground around them. Desert ground has one hue, so orange sand and red earth are both
khaki. And farmland with no mapped fields is one flat tone, which reads as desert in Iowa in
July.

## Still open

Ordered by what a viewer would notice first.

1. **The hosted world never invents a building.** Its finest tiles are zoom 13, 306 frontage
   slots wide, and lot layout stops at 300. So Hanoi's Old Quarter, where the map has the
   streets and a few large buildings, is a street grid on grass. Lifting the guard as it stands
   is not the fix: laying lots out across a zoom-13 tile took a worker 0.2–2 s, each tile then
   took 76 s to generate where it had taken about 20, and the view had not appeared after seven
   minutes. The lot cap (3,072 a tile) would also thin a town at random, to a quarter of its
   streets. It needs lots laid out per zoom-15 cell of a coarse tile, and a cap that keeps
   whole blocks. Until then every row and yard in this review is seen only in the explorer's
   own zoom-15 packages.
2. **Mapped heights are trusted.** Siena's data makes palazzi 30–35 m and nothing here doubts
   it; its hotels are then guessed as tall as those neighbours. A height far above everything
   round it on an ordinary footprint could be checked against the place's own measured storeys.
3. **A shaft is a plain shaft.** A bell tower gets tiers of openings and its region's stone, not
   a belfry, a spire or a crenellated crown; a minaret mapped as a building is square.
4. **A town is one color scheme per region.** Jodhpur's old city is blue wash over pale
   terraces, and from the air it is still one dusty tan: a flat-roofed town seen from above is
   its terraces, and South Asia's were matched to Delhi's orthophoto. Jaipur is pink; Stone
   Town's whitewashed coral stone draws East Africa's painted sheet roofs. A sub-region costs
   a rectangle and a family; a city's color could instead be a rule on a place name.
5. **Row corners are open.** A front is dropped where its slot meets a cross street, so a block
   of rows has a gap of a slot or two at each corner where a real one has its best building.
6. **A terrace's rhythm is seeded, not composed.** Bath's crescents are one facade a hundred
   meters long; the engine's rows vary front by front.
7. **Use exteriors are one building each for the world.** The hotel, hospital, school and
   office styles are modern everywhere; where they still apply (a free-standing footprint of
   their size) a region's own would be a style per family.
8. **Ground and plants, reported only** (see the place table): unmapped ground in a dry Greek
   town reads as desert, cypress and olive are missing from Tuscany, and farmland with no
   mapped fields is one flat color.

## Cost rules

- A new family is 19 style documents (about 7 KB of pack and 6 ms of validation); the regional
  catalog has 0.8 KB of gzipped headroom under its guard, and each family or rule spends it.
- A lot pattern is data on the house style; a row costs less than the yard it replaces.
- The guess ceiling reads a tile's buildings once (a pass over footprints that already carry a
  height) and selects one style per tile for the region's figure.
- Cornices, plinths and string courses on a block are the facade bands that already existed:
  no new geometry kind, and they are dropped with the other bands at the coarser detail tiers.

## Reproduction

The probes, photographs, frames and comparison sheets are local evidence under the ignored
`.artifacts/world-survey/` and are not committed: `probe/sites.mjs` (the sites),
`probe/photos.mjs` (Commons search), `probe/capture.mjs` (engine frames, with the packs swapped
by route interception so `public/packs` is untouched), `probe/compare.mjs` (sheets),
`probe/levels-all.mjs` and `probe/levels-local.mjs` (where storeys come from),
`probe/invent.mjs` and `probe/cost.mjs` (invented towns), `probe/lineup.mjs` (mid-rise blocks).
A capture run needs a frozen build of the explorer (`probe/build-explorer.mjs`,
`probe/serve.mjs`): a package rebuilt under a live dev server reloads the page mid-capture.
