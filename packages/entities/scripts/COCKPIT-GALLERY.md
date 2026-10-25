# Cockpit gallery

From the repository root, with current tooling builds and imported aircraft assets:

```sh
node packages/entities/scripts/cockpit-gallery.mjs --serve
```

Open `http://127.0.0.1:4318`. The page also works by opening
`.artifacts/cockpit-gallery/index.html` directly. It has aircraft/category search, a refined
cockpit filter, enlarged detail views and a two-aircraft comparison. The P-51D, OH-6A and
Cessna 172S have extra views of their updated cockpit materials; the rest show existing interiors.

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
