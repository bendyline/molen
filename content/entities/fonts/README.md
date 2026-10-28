# Cockpit lettering

All 53 aircraft use baked font textures for cockpit legends, dial numerals and static display
labels. The shared analog gauges, glass displays, G1000 panels and physical control labels
inherit the aircraft's [font profile](cockpit-profiles.json). A new label in those helpers gets
font rendering automatically; individual aircraft do not need their own atlas implementation.

These are visual approximations chosen for the authored cockpit variant and instrument style,
not identifications of a manufacturer's original typeface. A period aircraft with a modern
radio can use period dial lettering and a different display face.

| Role/profile | Font | Use |
| --- | --- | --- |
| `period` | Jost Medium | Geometric, Futura-inspired lettering for P-51, DC-3, Beech 18 and DHC-2 analog panels |
| `technical` | Overpass Semibold | Clear technical sans serif for later analog instruments, physical legends and standby gauges |
| `display` | Overpass Mono Semibold | Monospaced radio, CRT and HUD-style labels in analog and hybrid cockpits |
| `modern` | Overpass Regular | Lighter sans serif for modern LCD and glass-cockpit labels |

Every aircraft has separate `panel`, `dial` and `display` assignments in the profile JSON,
with its variant label and rationale. Examples include the OH-6's technical analog panel,
the F-14's technical legends and monospaced displays, and the Cessna 172 NAV III's technical
standby gauges and lighter glass display text. Only fonts actually used by the model are embedded.
Live seven-segment numeric readouts remain their existing animated geometry. Needles, ticks,
horizon cues, controls and their runtime bindings remain independently authored.

## Shared authoring path

`packages/entities/scripts/aircraft/cockpit-lettering.mjs` converts pinned font outlines to SVG
paths and rasterizes them with Molen's WASM SVG baker. Builds require no installed system font,
browser font renderer or network connection. No image-generation prompt is used.

Each used face has a 1024 x 1024 antialiased white/alpha PNG atlas. The source texture and embedded
GLB image contain identical bytes. Linear filtering, mipmaps, padded glyph bounds and white
transparent texels keep small letters smooth without dark rims. Material color supplies the ink;
the same atlas masks the emissive contribution. Font files and atlases are shared across aircraft.

`detailKit.text(label, at, height, yaw, material, role)` defaults to the `panel` role. Shared gauge
helpers pass `dial`; avionics helpers pass `display`. The detail kit retains original strings and
mounting transforms through geometry batching. `finishAircraftCockpit` replaces text inside
declared cabin and flight-control roots using the selected profile, preserving solid details and
animated parent nodes. Other vehicle and exterior batches retain their existing geometry.

The P-51 and OH-6 also use `cockpitText` directly. It takes a font profile, capital height in metres
and optional maximum width, uses actual advances and kerning, and emits two triangles per visible
glyph facing local -Z. `completeCockpitControls` accepts `letteringFont` for direct use; the other
aircraft's labels are converted by the shared finish step.

## Font provenance

- Jost: Owen Earl / indestructible type; [designer's page](https://indestructibletype.com/Jost.html).
  Source revision `indestructible-type/Jost@35f141c970538f1ed0f235789c19156b3ce2a762`,
  `fonts/ttf/Jost-500-Medium.ttf`. Licensed under [SIL OFL 1.1](Jost-OFL.txt).
- Overpass and Overpass Mono: the existing shared files in `content/earth/source/fonts/`;
  [project site](https://overpassfont.org/) and [SIL OFL license](../../earth/source/fonts/Overpass-OFL.txt).
  Overpass is inspired by Highway Gothic. These profiles use it as an approximation of technical
  lettering, not as a claim that the named aircraft used that font.

All font bytes are unmodified. SHA-256 pins:

| File | SHA-256 |
| --- | --- |
| `Jost-500-Medium.ttf` | `4f96c348370bb0b49534ed3da233ffc2f5a47dcc8ec642f175cc9b009d859926` |
| `Overpass-SemiBold.ttf` | `d72444ce96344d20cb4b0798dde08c45a8fd22b152e7dec03fc8da5d58ef1e9f` |
| `Overpass-Regular.ttf` | `bf107d7ae99031c2193cd187acc9d4e5ebd45b6ea0e6845159ce68f87eb623aa` |
| `OverpassMono-SemiBold.ttf` | `99e78a4419e6498a8bbfb36bc0d59670e5226d038d137f06785aeed4a67fe44f` |

## Regeneration and verification

Run `node packages/entities/scripts/generate-aircraft.mjs --ids=<slug>` for a roster aircraft.
The P-51, OH-6 and generic airliner use their own `source/aircraft/<slug>/models/generate.mjs`
scripts. Then run the normal `asset import --force` and `asset inspect --verify` commands in the
aircraft README. No runtime font loading is required.

The fleet review checks source pins and imported hashes, portable embedded font bytes, UVs,
material roles, control bindings and livery isolation. Its concise results are in
[fleet-review.json](fleet-review.json). Bulk captures, contact sheets and full command logs stay
local in `.artifacts/cockpit-gallery/` and `.artifacts/cockpit-fonts/fleet/`. The gallery caches
images by current model hash and camera; regenerate it with
`node packages/entities/scripts/cockpit-gallery.mjs`.

After building prerequisites, run the targeted regressions from `packages/entities`:

```sh
node node_modules/vitest/vitest.mjs run test/cockpit-font-authoring.test.mjs test/cockpit-lettering.test.mjs test/cockpit-surfaces.test.mjs --no-file-parallelism
```
