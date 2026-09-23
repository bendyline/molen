# Playing browser experiences

`molen play` is the browser counterpart to deterministic scene `drive`: it hosts a built web
experience, performs player-like inputs, and leaves screenshots plus diagnostics an agent can
inspect.

```sh
molen play examples/world-explorer/dist \
  --scenario examples/world-explorer/test/visual/navigation.play.json \
  --out-dir .artifacts/world-explorer
```

The host uses an ephemeral localhost port and supports HTTP byte ranges, so PMTiles and other
streamable archives exercise the same request path used in production. Each run writes the named
PNG frames and `experience-run.json`, containing probe text and browser console, page, and failed
request diagnostics. Failed plays also keep their partial frames and run manifest, including the
failing action and last observed stable-text probe, so a timeout remains inspectable.

## Scenario format

An `molen/experience-play@1` document declares its viewport, initial URL, optional DOM text probes,
and ordered actions:

```json
{
  "format": "molen/experience-play@1",
  "name": "walkthrough",
  "path": "/?quality=high",
  "viewport": [1280, 720],
  "probes": [{ "name": "status", "selector": "#status" }],
  "actions": [
    { "type": "wait-for-stable", "selector": "#status", "text": "0 loading" },
    { "type": "screenshot", "name": "start" },
    { "type": "keys", "keys": ["w", "Shift"], "durationMs": 1500 },
    { "type": "drag", "selector": "canvas", "from": [0.5, 0.5], "to": [0.75, 0.5] },
    { "type": "screenshot", "name": "after" }
  ]
}
```

Supported actions are `wait`, `wait-for`, `wait-for-stable`, `keys`, `key-down`, `key-up`, `drag`,
`click`, `select`, `navigate`, and `screenshot`. Use `key-down`/`key-up` around timed captures to
inspect an experience while it is moving. Drag coordinates are normalized within the target
element, so a scenario remains meaningful at different viewport sizes. `keys` holds all declared
keys for the duration, which makes continuous movement deterministic enough for visual regression
work.

Use `wait-for-stable` on an experience's status or loading indicator before capture. This avoids
blessing transient tiles as a golden image while still exposing stalls: the action times out when
the required text never appears or the probe keeps changing. Stability is measured in rendered
frames: each read waits for the page to draw a frame, and `stableMs` counts frame time. So a status
written from the render loop cannot pass while one slow frame keeps it stale, as happens under a
software rasterizer on a busy machine.

The same operation is exported as `playExperience()` from `@bendyline/molen-tooling` and as the
`play_experience` MCP tool. MCP results include the captured frames as images so an agent can run
the complete edit → play → look → improve loop without a manual browser.
