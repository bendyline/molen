# Severn Bridge — severn_bridge

![Molen preview](preview.png)

The original M48 Severn suspension bridge: two white steel portal towers, paired inclined hangers, continuous main cables, shallow aerofoil box deck, cantilever footways, cutwater piers and concrete cable anchorages. Includes close-view cable sockets, parapets, tower saddles, access doors and four traffic lanes.

## Source and browser models

The original detailed recipe is preserved at `content/worldgen/source/places/gc/gcn/severn_bridge/models/severn-bridge-model.mjs#buildSevern`. Original master hash: `sha256:41a39bb8d560fad968924a5f1cd2dc687f8af781a35c039da0be20e415d29450`. The current shared-material master has 308648 triangles and 24002716 bytes. It binds reusable painted metal and concrete graphs with metric UVs and embeds no texture images. Independent silhouettes live in `severn-browser-model.mjs`; four browser levels follow the1k/4k/16k/64k budgets.

## Approximate placement

Two inspected pictures confirm white portal towers, paired inclined hangers, continuous suspension cables and a thin deck. Standard viewer PMTiles named M48 bridge roads and tower-adjacent path offsets establish the main-span midpoint and east/southeast Aust-facing native+X. Mapped tower spacing986.5m matches the retained987.5m source within about1m. The named road includes a separate eastern approach, which remains outside this1637.5m suspension/anchorage asset. LocalY0 is deliberately accepted as an approximate global sea plane; no tidal or engineering datum certification. PMTiles water masks and raw terrain provide the surrounding review fixture; physical road endpoints remain approximate.

## Accepted limits

- The 308648-triangle shared-material detailed master remains exact. Browser models preserve paired portals, connected main cables, inclined hangers, complete aerofoil roadway and footways, piers and anchorages.
- Source nominal dimensions, local sea-plane datum, sag/grade and fittings remain photo/map approximations; this is not a reconciled tidal or engineering survey.
- Skyline/district use representative paired hangers. Near levels retain the 344-hanger schedule, continuous cables and rails; parapet pickets are spaced 16 m on street and 2 m on closeup, while the master retains the fine original 0.75 m rhythm.
- Separate Aust/Beachley/Wye approach structures use the independent native procedural bridge renderer. Their detailed unique models, current traffic, interiors, exact endpoint grades and physical device timings are outside this asset.

Regenerate with `node content/worldgen/source/places/gc/gcn/severn_bridge/models/generate-severn-bridge.mjs`; use `--check` for the selected source. QA reports bind the final inspected images and placement.
