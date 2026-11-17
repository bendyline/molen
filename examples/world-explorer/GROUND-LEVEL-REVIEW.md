# World Explorer ground-level review

What walking through the Seattle, Bellevue and Sammamish package looks like, why, what the
November 2026 pass changed, and what is still open. It follows the whole-scene
[visual review](VISUAL-REVIEW.md) and the [medium-fi style guide](../../docs-src/guide/medium-fi.md);
this one stays at eye height.

## Method and limits

Nine places were captured on foot before the changes, at High quality on WebGL in July daylight:
Wallingford and Lake Hills (houses), Sammamish (wooded suburb), Broadway and downtown Bellevue
(commercial), Volunteer Park and Green Lake (parks), Bridle Trails (forest) and Georgetown
(industrial). Wallingford, Lake Hills and the two parks were captured again after. Captures load `?mode=human&navigation=walk&lat=…&lon=…`, wait for the stream to go
quiet, and read counts from the status line. Two of the tiles were also run offline through the
real pipeline (`generateWorldgenTile` on the decoded map tile) to count what each budget admits.

The captures are from one machine and a headless browser. Counts are exact; frame times are
relative. Nothing here was checked on WebGPU, at Balanced or Economy quality, or outside the
Pacific Northwest, where the new planting lists are authored priors that nobody has looked at yet.

## What was wrong

1. **Houses were blank boxes, and it was a budget, not a style.** A tile's building detail is
   bounded in vertices and was spent largest footprint first. The Wallingford tile holds 1,091
   buildings; at High on WebGL (320,000 vertices) 75 of them got full detail. The rest drew a
   simplified facade: walls, roof, a row of windows, and no door at all.
2. **Doors and interiors came only with that detail.** The same 75 were the only buildings a
   walker could enter (62 at Balanced, 424 with the 900,000-vertex budget other backends get; all
   of them would take 1.61 million vertices). They were the tile's largest buildings, so the
   house you walked up to was almost never one of them.
3. **Yards, parks and urban land had no planting rules.** Residential land got street and yard
   trees and nothing below them. Parks got trees. Commercial and industrial land got nothing.
4. **A tile drew few species.** Each scatter layer keeps its commonest species per tile and folds
   the rest into them: four understory and seven ground-cover models at High. One shared draw
   thins every rule in a layer, so a wood in a tile also thinned whatever else shared its layer.
5. **Ground cover was drawn where it could not be seen.** Near-detail-only models drew for every
   quarter tile within about 250 m, up to nine of them, which is what held their counts down.
6. **No animal could appear in a town.** Residential land counted as built and unsafe, flying
   animals needed safe ground under every wander target, and the cap was four to seven animals.

## What changed

- **The buildings nearest a walker take the budget.** Once the viewer is down among the buildings
  and moving at a walk, the finest tiles within 90 m are regenerated with their buildings queued
  nearest first, and again every 36 m. The same 320,000 vertices now detail the nearest 148
  buildings, out to 140 m, and those are the ones with doors and interiors. Nothing regenerates
  above 10 m/s, from the air, or while the viewer is inside a building. The explorer turns it
  off for frozen captures (`?freeze`) and with `?focus=0`.
- **Every simplified facade keeps a door.** The style's entrance as a bare leaf and light, eight
  vertices, on the wall the detailed building puts it on.
- **Planted ground.** A `garden` scatter layer with its own budget plants yards, parks and street
  land by role (shrubs, beds, small trees and hedges, lawn flowers), in pockets, and chooses its
  species per quarter tile so one street differs from the next. Rough ground gets verge grass,
  weeds, pioneer brush and stones in the wild layers.
- **83 new plant forms** (182 in all, 546 presets): flowering and clipped shrubs, hedges,
  cloud-pruned pines, small ornamental trees that blossom in their spring months, flower beds,
  ornamental grasses, ferns, carpets, boulders and stumps, in lists for eleven climate zones.
- **More species per tile and nearer ground cover.** Understory 4 to 6 models and ground cover 7
  to 10 at High; near-only models stop at 65% of their old distance, which pays for 10,000
  ground-cover instances a tile in place of 8,000.
- **Town wildlife.** Residential land is a habitat (`yard`) between its houses and streets,
  tended green space counts as park, a flying animal may cross a road, and the cap is 6 to 32
  animals by tier, not 4 to 7. Seven unnamed town groups were added: small songbirds, a crow-sized
  bird, pigeons, lawn geese near water, butterflies, a cat and a garden rabbit. Run headless over
  the real tiles at seven Seattle and Bellevue points (Balanced, 16 animals), the nearest animal
  is 20 to 55 m away with 6 to 13 within 100 m. Before, three of the seven had no animal at all,
  two had their nearest 240 to 350 m off, and the two lakeside parks had four each.

Measured on the Wallingford tile at High on WebGL:

| | Before | After |
| --- | --- | --- |
| Door on a house drawn with the simplified facade | none | a bare leaf, where its style has an entrance |
| Enterable buildings in the tile | 75, the largest | 148, the nearest (walker at its centre) |
| Farthest enterable building from the walker | anywhere in the tile | 140 m (median 125 m) |
| Interiors loaded round the walker | 2 | 12 (the streamer's cap) |
| Scatter instances in the tile | 1,205 | 7,630 |
| Plant models in the tile | 19 | 47 |
| Animals visible from the Wallingford capture point | 1 | 13 |

Frame time at that capture point (headless Chromium, vsync off, median of 600 frames, one
machine): 22.8 ms with the old scatter budgets, 23.9 ms with the new ones and nearest-first
buildings, and 25.9 to 27.3 ms over three runs with town wildlife on as well (32 animals active at
that tier). Planting costs about a millisecond there and the animals two to three. Samples of
the same configuration differ by up to 1.4 ms, so the first figure is at the edge of what this
can resolve.

## Still open

Ordered by what a walker would notice first.

1. **Street trees are forest conifers.** Yard and street canopy is Douglas-fir, cedar and hemlock
   at forest size, matched to aerial frames of Bellevue and Sammamish. From the sidewalk in
   Seattle proper it reads as a dark conifer avenue down Broadway, with near-black shade under
   it. A street-tree population (smaller, mostly deciduous) for mapped residential and commercial
   streets is the single largest remaining change, and it reverses a deliberate aerial match, so
   it needs the owner's call. The visual review's item 13 (street trees and curbside cars)
   describes the placement.
2. **Porches, stoops and steps.** A detailed house still has a door flush in a flat wall. A
   portico is about 56 vertices a house; the detail budget is the constraint (see cost rules).
3. **Doors face the longest wall, not the street,** and mapped houses get no front path, driveway
   or garage door. Inferred lots already have all three; mapped houses need the nearest road.
4. **Hedges and fences do not follow lot lines.** Hedge runs are scattered at random bearings.
   Edge-following placement along yard boundaries would fix both; it is the rest of the visual
   review's item 14 (yards with edges), whose garden beds this pass delivers.
5. **Detail beyond 140 m.** The budget still runs out; past it houses are simplified. A second,
   cheaper tier with trim but no interior would smooth the step.
6. **Regeneration cost on foot is unmeasured in play.** Each step regenerates up to four tiles in
   a worker (0.5 to 1.1 s each offline) and swaps them. It needs a look for hitches while
   running, and on WebGPU where each new batch pays for its shaders.
7. **Blossom ignores the month** on shrubs and beds; only the ornamental trees follow it.
8. **Ground cover still thins with tile size.** Budgets are per tile, so a finer cell grid round
   the viewer would raise near density further than a per-tile cap can.
9. **Yard objects.** No sheds, bins, garden furniture, play equipment or porch lights.
10. **Animal behaviour and cost.** Animals wander; none flock, perch, flee or follow a walker. The
    cat is the generic quadruped with a fox's muzzle, and butterflies draw only within 10 m while
    still taking cap slots. Each animal is a skinned draw and a pose: the two to three
    milliseconds measured above is the price of 32 of them, and the tier table in
    `packages/earth/src/client/performance.ts` is the lever.
11. **The ecology pack is 207 KB gzip,** up from 119 KB. Habitats in one zone repeat the same
    lists; sharing them would take it back down.

## Cost rules

- Building detail is bounded in vertices per tile. Any adornment added to a detailed house reduces
  how many houses are detailed. Count it on a real tile before adding it.
- A plant model is a draw per quarter tile in view. Variety is bought with model slots, not with
  longer species lists: a list's tail never shows.
- Near-detail-only plants cost triangles for every quarter tile in range. Their count can rise
  only as far as that range is short.

## Reproduction

In the engine repository, with the explorer's packs prepared (`pnpm dev:prepare`):

```sh
cd examples/world-explorer && pnpm exec vite --port 5333
```

Then open, for example,
`http://localhost:5333/?quality=high&sky=daylight&month=7&mode=human&navigation=walk&lat=47.6592&lon=-122.3345&alt=110&yaw=0.3`.
The status line reports draws, instances and `interiors N resident / M available`.
