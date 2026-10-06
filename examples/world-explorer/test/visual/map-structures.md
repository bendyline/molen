# Map structure browser integration check

After a workspace build, run from the repository root:

```powershell
node examples/world-explorer/test/visual/capture-map-structures.mjs
```

It is a manual check; no CI suite runs it. The fixture is served by an isolated,
temporary Vite server; it does not change the normal world explorer or its PMTiles. Chromium
uses software WebGL. Set `PLAYWRIGHT_BROWSERS_PATH` when using a nondefault browser install.

The synthetic semantic tile contains a classified windmill POI with an ordinary building
outline, a wind-powered generator, and an unclassified building named “Windmill Cafe.” The
test loads the shipped style pack, map rules, and actual runtime GLBs through
`createWorldgenSemanticRenderers` and `StructureModelLibrary`.

Assertions check:

- Exactly the windmill and turbine models load, at their mapped positions and distinct headings.
- Triangle counts match the imported sidecars, with multiple original materials and terrain contact.
- The loaded windmill replaces its mapped building shell; the cafe keeps its procedural building.
- Removing the classification evidence produces no models, preserves both building footprints,
  and fetches no additional model assets.
- Brick, wood, fabric, painted metal, granite and concrete bind the shared material graphs.
  Both GLBs reuse the same painted-metal texture; each graph is read and baked once.
- The browser reports no page or console errors.

Eight frames include the overview, complete models, mill brick and gallery details, turbine base
and nacelle details, and the missing-tags fallback. Images and measurements are saved under
`examples/world-explorer/captures/map-structures/`. The report binds the source/runtime GLBs,
material graphs and images by SHA-256 so visual reviews can identify their exact inputs.
This proves the renderer/category integration
with controlled data. It does not establish that a particular PMTiles provider includes windmill
classification tags or validate any named landmark's real geographic placement.
