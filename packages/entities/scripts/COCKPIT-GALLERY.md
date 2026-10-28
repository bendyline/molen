# Cockpit gallery

From the repository root, with current tooling builds and imported aircraft assets:

```sh
node packages/entities/scripts/cockpit-gallery.mjs --serve
```

Open `http://127.0.0.1:4318`. The page also works by opening
`.artifacts/cockpit-gallery/index.html` directly. It has aircraft/category search, panel-finish
and detail-view filters, enlarged views and a two-aircraft comparison. All 53 cockpits use the
[shared finish library](../../../content/entities/source/cockpit-materials/README.md).
The P-51D, OH-6A and Cessna 172S have extra panel and upholstery views; the Baron and P-51D
also have throttle-quadrant close-ups. The Cessna 182T has a panel close-up, and the MiG-29
has panel, canopy, intake and exhaust views for inspecting surfaces and repaired curved joins.

Captures use the current imported GLBs and reference-ledger cabin cameras, with uniform
lighting. Cache keys include the model hash, scene, camera and output size. Stale captures
are omitted when capture is disabled or an aircraft is outside the requested selection.
All review images and the generated page stay in ignored `.artifacts/`.

```sh
# Rebuild just the affected captures; keep other current cached aircraft in the gallery.
node packages/entities/scripts/cockpit-gallery.mjs --ids=p-51,oh-6,cessna-172s
# Refresh the page from current captures and serve it without invoking the renderer.
node packages/entities/scripts/cockpit-gallery.mjs --no-capture --serve
```

Use `--port=4320` for another local port. Capture requires Playwright Chromium, as with
`molen shot`; on Windows set `PLAYWRIGHT_BROWSERS_PATH` to the installed browser directory
if it is outside Playwright's default location. Exit the process to stop the local server.
The gallery displays rendered model evidence, not source-reference photographs or a systems trainer.

For interactive controls backed by the flight simulation, run:

```sh
pnpm --filter @bendyline/molen-examples-world-explorer exec vite --config ../../packages/entities/scripts/cockpit-controls-vite.mjs
```

Open `http://127.0.0.1:4322/packages/entities/scripts/cockpit-controls.html` and choose an aircraft.
Click its modeled switches and drag its levers. Manual mixture and propeller governors are
enabled on the 17 aircraft with those capabilities; twins have separate engine controls.
The readings show commanded mixture/propeller settings alongside actual RPM and shaft power.
See [the engine model](../../../docs-src/guide/aircraft.md#mixture-and-propeller-governors)
for its approximations and supported inputs.
