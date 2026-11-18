# World Explorer building diversity review

How generated buildings looked in towns around the world, why most of them were wrong for
their place, what the November 2026 pass changed, and what is still open. It follows the
whole-scene [visual review](VISUAL-REVIEW.md), the [ground-level review](GROUND-LEVEL-REVIEW.md)
and the [medium-fi style guide](../../docs-src/guide/medium-fi.md). A second pass, which looked at
the engine itself against photographs of 31 places, is in the
[world survey review](WORLD-SURVEY-REVIEW.md); the counts below (27 families, 513 regional
styles, 56 regions) are this pass's and have since grown.

## Method and limits

One zoom-15 basemap tile was taken for each of 36 towns (Nafplio, Ioannina, Mykonos, Siena, Ronda,
Dubrovnik, Rothenburg, York, Delft, Paris, Bergen, Suzdal, Fes, Cairo, Yazd, Jaipur, Hoi An, Ubud,
Pingyao, Seoul, San Miguel de Allende, Cusco, Ouro Preto, New Orleans, Santa Fe, Boston,
Stellenbosch, Lagos, Nairobi, Lamu, Safranbolu, Melbourne, Wellington, Suva, Buenos Aires,
Kalamata) and run through the real pipeline in Node: the Protomaps decoder, the Earth tile
adapter with the shipped packs and business catalog, and the batch generator at High. Each run
reports the style every building was given, its roof, its party walls and its vertex cost. A
crop of each town was rendered with `molen worldgen preview`, before and after. The same probes
were run on the Seattle, Sydney, Kyoto, Yuma and Delhi packages with real ground and interiors
on, against a build of the previous commit, to measure what the changes cost.

Limits. The town tiles have no elevation, so they were generated on flat ground. The preview
page's light is not the Earth view's, so its frames show form, material and hue, not value: no
town outside the five packaged regions was judged in the Earth view itself, and no palette here
was matched to an orthophoto. Family assignments are authored priors drawn from general
knowledge of each region's building, not from a survey. Nothing was measured on WebGPU or in a
browser frame loop; costs are vertices, material groups and generation time.

## What was wrong

1. **A building left its region as soon as the map stopped describing it.** The regional styles
   were reached only through a building type or a `residential`, `commercial` or `industrial`
   land-use polygon. Protomaps keeps no building type, and most of the world's towns have no
   such polygon, so the footprint fell through to the pack's last rules: a generic North
   American house under 600 m², a generic commercial block over it. Fes was 0% regional (132
   hipped and 50 gabled roofs over a medina of roof terraces), Jaipur 0%, Yazd 0%, Nairobi 5%,
   Boston 8%, Hoi An 20%.
2. **A shop turned its building into a store.** Any low building holding a recognized business
   became `generic.store`, a single-storey retail shell: 116 of Nafplio's 531 buildings, 136 of
   Bergen's 525, 103 of Dubrovnik's 449. A guest house or a hostel made its building a mid-rise
   hotel (77 in Cusco), and a gallery made it a museum (40 in Santa Fe).
3. **Larger buildings were modern everywhere.** Flats, shops and civic buildings were rendered
   concrete under a white membrane in every family, so an old town's blocks, which are its
   houses built larger, lost both wall and roof. With the mapped heights common in European
   centers, 50% of Nafplio's roofs, 63% of Siena's and 79% of central Paris's were flat.
4. **Clay tile was tan.** The Mediterranean roof palette was `#b58e73` and `#9c7664`: a dusty
   beige at 58% lightness, outside the guide's own pitched-roof band.
5. **Fourteen families covered the world.** One family (stucco under grey standing-seam metal)
   stood for Mexico, the Andes, Brazil, the Caribbean and all of Africa south of the Sahara;
   one for France, Germany, Russia and Central Asia. Each family had one wall material and one
   roof material, so a street varied in color only. Brick shared the siding's texture scale and
   drew bricks two and a half times too tall.
6. **Irregular plans could not take a pitched roof.** Only rectilinear footprints decompose into
   ridged wings. Others got one sloping plane under 400 m² and a flat roof over it; a courtyard
   block or a plan wider than a ridge spans went flat too. 43% of Siena's footprints and 35% of
   central Paris's are not rectilinear.
7. **Rows were roofed as detached houses.** Nothing knew that footprints touched: 80% of Ronda's
   buildings, 73% of Delft's and 89% of Boston's share a wall with a neighbour, and 20–38% of
   all wall edges in those towns are party walls. Each house drew windows on them, hipped its
   roof down onto its neighbours, and ran its ridge along its own long side.
8. **A place of worship was one building.** Every church, mosque and temple was a stone nave
   under a slate gable, and only when its footprint was at least 180 m² and carried the POI's
   own id. The basemap gives the religion (`kind_detail`); nothing read it.
9. **Slender towers were offices.** Any building over 35 m took the glass-and-panel tower
   style, a 50 m² bell tower included.
10. **Chimneys everywhere, nothing else on a roof.** Every house style carried the same brick
    chimney, in Fiji as in Yorkshire; roof terraces were bare.

## What changed

- **Every building keeps its region.** Each regional profile ends in rules for footprints the
  map neither types nor puts on labelled land: small ones are its houses, a row is its row
  houses, large or tall ones its flats or its commercial blocks. Nothing leaves the family for
  want of a land-use polygon.
- **Twenty-seven families, nine uses.** The world's envelopes are bound to 27 construction
  families in place of 14 (see the table below), and three new sub-regions sit above their
  countries: the Cyclades (whitewashed flat roofs, unlike the tiled mainland), Mediterranean
  France (Roman tile, not slate) and the North American Northeast (brick rows and clapboard). A
  family lists several wall and roof materials, each with its own palette and texture scale, so
  a street mixes brick, render and board at their true course sizes.
- **Roofs follow the tradition and the use.** Clay tile is terracotta. Where a town's larger
  buildings are built like its houses (`urban: 'traditional'`), flats, shops and civic
  buildings take the family's walls and keep a pitched roof through the height those roofs were
  built to: four storeys of brick under slate in Britain, eight under a mansard in France.
  Traditions of flat roofs (the Maghreb, the Gulf, South Asia, the Cyclades) are flat throughout.
- **A hipped roof for any outline.** `roof.fallback: 'hipped'` covers a footprint no ridge fits
  with slopes rising from every wall, courtyard walls included, to a level deck. Irregular
  plans, courtyard blocks and broad halls keep their neighbours' roof; with a steep slope and a
  low deck it is a mansard on any plan.
- **Party walls.** The Earth adapter probes each outline edge for a neighbour's footprint on its
  far side. Shared walls take no windows, doors, trim or storefronts; the building is labelled
  `attached` when it gives a fifth of its outline to neighbours, which selects the family's row
  house; and a pitched roof in a row is gabled with its ridge turned to the row
  (`roof.partyRidge`): eaves to the street in Britain, France and the Mediterranean, a gable
  to the street in the Low Countries, Germany and Scandinavia.
- **Shops keep their buildings.** Outside the regions that build shops as store shells (North
  America, the Southwest, and the neutral fallback), a business gives its building a frontage
  and a sign and leaves the building its region's, unless it stands free on retail land, is a
  catalog chain's own building, or covers 600 m². A lodging, museum, theatre, library or civic
  POI takes over the exterior only of a building large enough to be one.
- **Places of worship by religion.** A place of worship takes its family's `worship` style (its
  region's walls and roof, tall narrow windows) and a crown from its religion: a dome on a drum
  for Orthodox and Oriental churches, a tower under a spire or a belfry for Western ones, a dome
  and a minaret for a mosque, a stepped tower for a Hindu or Jain temple. Chapels down to 25 m²
  are recognized, and so is a hall-sized building with a place of worship's point and no shops
  in it.
- **Up close.** A share of each family's houses has a porch: a step, two posts and a canopy
  (44 vertices). Shutters and door leaves are painted one of the family's colors (Aegean blue,
  Mediterranean green, Baltic white) instead of the trim darkened. Chimneys stand only where
  winters have them, and roof terraces carry water tanks or solar heaters (two new box models,
  instanced, near detail only).
- **Slender towers stay masonry.** The tower style needs a 250 m² floor plate, and in
  traditional families starts at 50 m or fifteen storeys.

| Family | Regions | Walls | Roofs |
| --- | --- | --- | --- |
| `north_american` | North America, Pacific Northwest | Lap siding, some shingle and brick | Asphalt shingle |
| `northeastern` | US Northeast, lower Great Lakes | Brick, clapboard | Asphalt, slate |
| `southwestern` | US Southwest | Stucco | Mostly flat, some tile |
| `northern` | Nordic countries, Iceland, Baltics | Painted board, render | Dark tile, sheet |
| `atlantic` | Britain, Ireland | Brick, render, sandstone | Slate, brown tile |
| `lowland` | Low Countries | Dark brick | Red and dark pantile |
| `french` | France | Limestone, cream render | Slate, zinc, mansards in town |
| `continental` | Germany, Alps, Eastern Europe | Pastel render, some brick | Steep red clay tile |
| `east_slavic` | Russia, Central Asia, Caucasus | Painted board, brick | Painted sheet |
| `mediterranean` | Italy, Iberia, Greece, Adriatic, Anatolia, southern France | Warm render, limestone | Terracotta |
| `aegean` | Cyclades | Limewash | Flat |
| `arid` | Maghreb, Iran, Arabia, Nile | Sand and rose render, adobe | Flat |
| `levantine` | Levant | Limestone | Mostly flat |
| `tropical_masonry` | West, East and Central Africa, Madagascar | Render, earth | Corrugated sheet |
| `south_african` | Southern Africa | Render, brick | Tile, sheet |
| `tropical_timber` | Pacific islands, Caribbean | Painted board | Corrugated sheet |
| `latin` | Mexico, Central America, Colombia | Painted render | Flat, clay tile, sheet |
| `andean` | Peru, Bolivia, Ecuador | Whitewash, adobe, brick | Clay tile, sheet |
| `brazilian` | Brazil | White and pastel render | Clay tile |
| `southern_cone` | Argentina, Uruguay, Paraguay | Render, brick | Flat, tile |
| `east_asian` | Japan | Render | Grey tile |
| `sinic` | China, Korea, Taiwan | Render, grey brick | Flat, grey tile |
| `south_asian` | South Asia | Painted render | Flat |
| `southeast_asian` | Southeast Asia, Philippines | Yellow and pastel render | Clay tile, sheet |
| `australian` | Australia | Brick, weatherboard | Terracotta and concrete tile, sheet |
| `oceanian` | New Zealand, Chile, remote islands | Weatherboard | Corrugated sheet |
| `neutral` | Unclassified | Render | Tile |

## Measured

Share of buildings in a regional style, and share of flat roofs, on the same tile before and
after:

| Town | Buildings | Regional | Flat roofs | Material groups |
| --- | --- | --- | --- | --- |
| Nafplio, Greece | 531 | 67% → 98% | 50% → 3% | 19 → 13 |
| Mykonos, Greece | 958 | 81% → 99% | 18% → 100% | 19 → 14 |
| Siena, Italy | 1,153 | 79% → 90% | 63% → 24% | 21 → 17 |
| Paris (4e), France | 948 | 84% → 97% | 79% → 16% | 19 → 17 |
| Delft, Netherlands | 3,102 | 88% → 99% | 24% → 5% | 20 → 14 |
| Bergen, Norway | 525 | 54% → 94% | 65% → 33% | 21 → 17 |
| Fes, Morocco | 242 | 0% → 99% | 13% → 100% | 17 → 10 |
| Yazd, Iran | 94 | 0% → 97% | 55% → 100% | 17 → 10 |
| Jaipur, India | 743 | 0% → 99% | 12% → 100% | 18 → 11 |
| Hoi An, Vietnam | 9,232 | 20% → 100% | 6% → 17% | 23 → 18 |
| Nairobi, Kenya | 3,549 | 5% → 100% | 5% → 4% | 17 → 15 |
| Cusco, Peru | 1,041 | 74% → 95% | 30% → 29% | 23 → 19 |
| Boston, USA | 1,704 | 8% → 96% | 23% → 50% | 24 → 24 |
| Melbourne, Australia | 1,928 | 20% → 96% | 31% → 18% | 22 → 19 |

Siena's remaining flat roofs come from its mapped heights (a median of 30 m in a town of
four- and five-storey houses), which push its blocks past the pitched limit. Boston's rise is
its four-storey brick rows, which are flat-roofed.

Fewer material groups means fewer draws: a town now uses its family's materials instead of
those of two or three unrelated fallback styles. Generation time fell on most tiles (Nafplio
982 → 543 ms, Hoi An 2,093 → 1,045 ms in Node) because party walls no longer build facades.

What the detail budget reaches, on real tiles with interiors on (buildings a walker can enter,
at the 320,000-vertex WebGL budget and the 900,000 one):

| Tile | Before | After |
| --- | --- | --- |
| Wallingford, Seattle | 93 / 449 | 81 / 428 |
| Capitol Hill, Seattle | 44 / 216 | 38 / 211 |
| Downtown Seattle | 25 / 64 | 29 / 77 |
| Sammamish | 115 / 418 | 111 / 413 |
| Paddington, Sydney | 75 / 367 | 64 / 582 |
| Gion, Kyoto | 0 / 137 | 0 / 126 |
| Old Delhi | 40 / 292 | 35 / 292 |

House districts pay 3–15% at the compact budget and up to 8% at the full one; downtown and
terrace districts gain. Toggling the additions one at a time on the Wallingford tile (81
buildings at the compact budget) shows where it goes: without party walls it reaches 80,
without porches 82, and with the flat fallback in place of deck roofs 85. The rest is
classification: buildings that were cheap generic boxes are now their region's flats and
commercial blocks, with more windows. Paddington's terraces, once 393 generic houses, now fit
the full budget whole. A walker's nearest-first queue, which decides what is detailed on foot,
is unchanged.

The pack holds 513 regional styles in place of 336 (646 styles in all, from 469). Validating
them at load takes about 0.3 s in Node with the documents already read, up from 0.2 s, once per
context (the page and each worker). The explorer's core style pack, which compresses its small
documents together, grows from 2.17 MB to 2.35 MB.

## Still open

Ordered by what a viewer would notice first.

1. **None of this has been seen in the Earth view outside five regions.** The explorer has no
   Mediterranean, European, African or Latin American package. The palettes are in band and
   plausible in the preview; they need frames under the Earth rig, and a region package or two
   (a Greek town, a brick terrace town, a medina) to take them in. Done since through the
   hosted world terrain: see the [world survey review](WORLD-SURVEY-REVIEW.md), which moved
   the clay tile and stone palettes.
2. **Families are countries wide.** Naples and Lisbon share a palette; Kerala and Sri Lanka get
   Delhi's flat roofs; Lima gets the highland's tile; the churches of Poland get spires and
   those of Romania too. More sub-regions cost a rectangle and a family each.
3. **Mapped heights are trusted.** Siena's data makes half its center 30–100 m tall. A check
   against the neighbours' heights, or a cap by footprint, would catch it. The world survey
   pass bounds guessed heights by the neighbours' and draws slender mapped towers as shafts;
   a mapped height is still believed.
4. **Deck roofs are level on top.** A true straight skeleton would bring an irregular plan's
   slopes to ridges. From the street the deck is hidden; from the air it reads as a flat
   terracotta patch in the middle of a roof.
5. **A long footprint is still one building.** Party walls make rows of mapped houses read as
   rows; a terrace mapped as one outline is still roofed as one shed (visual review item 23).
6. **Doors face the longest free wall, not the street,** as before (ground-level review item 3).
   Party walls at least rule out the shared ones.
7. **Windows are one texture per family.** Sash, casement, shuttered and arched openings would
   each be a shared window graph and a material group.
8. **Crowns are five forms.** No onion dome, pagoda, stupa, twin towers or crossing lantern; a
   Buddhist temple and a synagogue are told by their walls and roof alone.
9. **Roof furniture is two models,** on flat roofs only. Chimney pots on a terrace, solar
   heaters on a tiled slope and satellite dishes would need a sloped anchor.
10. **The regional content repeats itself.** Each of 27 profiles lists the 120 explicit
    precedent rules ahead of its own (1.0 MB of JSON, 58 KB gzipped); a shared rule prefix in
    the format would shrink it tenfold. Facade variants are whole style documents; made a
    parameter of the rule that selects them, they would cost nothing to ship.
11. **Mapped roof shape, color and material** remain unread: the Protomaps basemap does not
    carry them (visual review item 22).

## Cost rules

- A family's materials are draws. Each wall or roof material a family adds is a material group
  in every batch that holds one of its buildings; the finest tiles admit 24 at High and 16 at
  Balanced. Three wall materials and two roofs is the working limit.
- A style is a document to download and validate at load. Homes, flats, shops and towers come
  in three facade rhythms; sheds, barns, civic buildings and places of worship in one. That is
  19 documents a family and 513 in all; a new family adds 19, about 7 KB of pack and 6 ms of
  validation.
- Party walls are the cheapest detail there is: they remove geometry, and generation time with
  it. Anything that reads the neighbours (a continuous cornice, a shared ridge) should start
  from them.
- A deck roof is four vertices a wall and a cap, where a flat roof is the cap alone. It is the
  costliest of this pass's additions in a house district, and still worth it where the roofs
  are the town.

## Reproduction

In the engine repository, with the packages built:

```sh
node content/ecology/source/build-architecture.mjs          # regenerate the regional styles
node packages/worldgen-earth/scripts/generate-structure-atlas.mjs
node packages/tooling/dist/cli.mjs worldgen preview --pack content/worldgen --batch town.batch.json --out town.png
```

A town's batch comes from decoding its zoom-15 tile with `createProtomapsTerrainMvtDecoder`,
adapting it with `semanticTileToBatch` and the shipped regional catalogs, and writing the
buildings near a point as a `molen/worldgen-batch@1` document.
