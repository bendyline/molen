# Named landmark review

Build the workspace, import the authored sources, then run:

```sh
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=N0637,N0641
```

The batch runner uses the world viewer's `StructureModelLibrary`, material resolver and
semantic placement renderer. One browser session shares texture objects between models.
Every authored GLB retains its full hierarchy, UVs and material groups. The runner checks
that the rendered triangle count matches the imported sidecar, every declared shared
surface resolves, each graph is read only once, and unloading releases all model geometry.

For active ground placements it queries the complete geographic catalog at the actual
WGS84 anchor, checks rotation and translation, and asserts that no remote asset was loaded.
The north-up placement view overlays the cached OSM perimeter where available. This uses
flat test terrain: it does not certify DEM elevations or contact on a sloped site. Draft
or extended absolute-datum models receive an asset review without an invented placement.

Four turntable views, model-specific close cameras, and applicable placement views are
written to the source bundle's `shots/shared/`. `shared-capture-report.json` binds each
image to the source/runtime models, material graphs, spec, placement and fixture hashes.
These images require visual inspection; successful capture is not maximum-fidelity approval.
The separate `capture-next-1000-models.mjs` runner also exercises normal Molen asset/scene
screenshots with the portable GLB materials.

Unchanged captures are reused after checking model, spec, placement, fixture, graph and
image hashes. Use `--force` to recapture or `--check` to verify the saved set. Regression
runs pass `--out-dir <directory>` and write one subdirectory per candidate, preserving the
authoring images and their review records. The golden test covers a skyscraper and a
lighthouse in different geographic cells, including unload checks for both.

Sunken structures use the production terrain polygon cutter on the review ground. The runner ray-tests a point inside the opening, confirms hiding the model restores ground, and confirms showing it reopens the ground. Unloading must restore the original geometry and its ray intersection. Ordinary models must keep their original ground geometry. The geographic golden includes the sunken Santiago Bernabéu stadium.
