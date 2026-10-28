# Diorama content

Eight self-contained scripted performances for `@bendyline/molen-dioramas`:

| Scene | Performance |
| --- | --- |
| [Football](football/README.md) | Uniformed players, stands, spectators and changing scoreboard |
| [Airport](airport/README.md) | Baggage tug with three carts, service van, conveyor and ramp crew |
| [Flight school](flight-school/README.md) | Briefing board, maintenance tools, pilots and service cart |
| [Airport cargo](airport-cargo/README.md) | Pallet loads, forklift and cargo crew |
| [Little league](little-league/README.md) | Pitch, hit, runner around the diamond and chasing fielders |
| [Fireworks](fireworks/README.md) | Staggered rockets, reusable spark pools, pulse lights and audience |
| [Fair](fair/README.md) | Ferris wheel, upright gondolas, bobbing carousel, booths and visitors |
| [Market](market/README.md) | Produce stalls, vendors, browsing shoppers and a handcart |

Each directory is a logical source bundle: ordinary scene data, bounds, a typed script and
its declarations. Copy a whole directory to reuse it. No model downloads are required.
These are illustrative performances, not real event schedules or operational simulations.

Build workspace packages first, then run from the repository root:

```sh
node packages/tooling/dist/cli.mjs types gen --project content/dioramas/project.json
node packages/tooling/dist/cli.mjs scripts check --project content/dioramas/project.json
node content/dioramas/build.mjs
node packages/tooling/dist/cli.mjs pack build content/dioramas
```

The build follows `project.json`, erases script types and writes eight JavaScript scenes under
`dist/`. The pack declares `scenes`, `diorama-bounds` and `diorama-placements`. Nothing is uploaded.

World Explorer's **Living places** picker and **Visit** button open each geographic placement.
Direct links use `?diorama=football|airport|flight-school|airport-cargo|little-league|fireworks|fair|market` (one value).
Earth view uses the same registry; `examples/dioramas` offers an isolated preview picker.
All three use lazy Vite import maps, so visiting a market does not load airport choreography.

`placements.json` carries centers, orientations, footprints, load/unload radii, overview framing
and provenance. Locations are curated examples. The Renton airport placement lies beyond the
bundled detailed street extract, so it currently has terrain and the scripted apron but no
surrounding airport buildings. The other sites use POIs from the bundled map extract.
The flight-school and cargo scenes use reserved service areas on Boeing Field's mapped aprons.
All airport scenes contain ground operations only; the Earth airport population supplies the
boardable aircraft and preserves them when a visitor flies away.
The Saturday market is a fictional theme, not a statement of the real market's operating day.

The host retains control over time and sky: use World Explorer's time slider to view fireworks
at dusk. No script changes the host clock. See [the authoring guide](../../docs-src/guide/dioramas.md)
for bounds, schedules, placement and the normal headless validation loop.
