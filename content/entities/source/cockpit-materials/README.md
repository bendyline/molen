# Shared cockpit finishes

All 53 aircraft use the profiles in [library.json](library.json). This is a small,
tintable surface library, not a separate texture set painted for every cockpit.
The existing aircraft colors, labels, instrument faces and screens remain authored separately.

| Finish | Intended surfaces | Tile size | Repeat distance |
| --- | --- | --- | --- |
| Stippled enamel (`panel`) | Traditional painted backboards and quadrant housings | 256 × 256 | 12 cm |
| Satin coating (`satin`) | Finer modern panel and console finishes | 128 × 128 | 12 cm |
| Rubberized grain (`rubber`) | Padded glare shields, grips and protective trim | 256 × 256 | 10 cm |
| Brushed alloy (`brushed`) | Exposed lever shafts, fasteners and metal hardware | 128 × 128 | 8 cm |

The earlier fine paint, vinyl, canvas and harness-webbing recipes remain available for
existing upholstery. Each finish has a near-white tintable base-color PNG, a tangent-space
normal PNG and a metallic-roughness PNG. All are original, deterministic procedural data:
periodic noise for paint/rubber, directional grain for alloy, woven patterns for fabric.
No photographs, baked reflections, baked shadows or manufacturer graphics are embedded.
The authoring brief is subtle, evenly lit microtexture that reads under changing light
without competing with instruments; no image-generation service or external bitmap prompt is used.

## Selecting a finish

Each aircraft profile explicitly lists its panel, padding and hardware material names and a
panel recipe. Edit that profile to change its surface treatment; edit the aircraft's own
material palette to change its color. References describe the represented variant where a
reference review exists. Finish assignments are appearance approximations, not verified coating
specifications. For example, the 2007 NAV III Cessna retains its gray panel rather than adopting
the black panel introduced in Textron's [2024 interior refresh](https://media.txtav.com/228190-textron-aviation-introduces-all-new-interiors-for-its-iconic-cessna-single-engine-high-wing-piston-lineup/).

The finisher runs after geometry batching and physical controls are added. It visits only
declared interior nodes and the physical control module, clones selected materials, and assigns
metric box-projected UVs. Instrument displays, legends and emissive/transparent materials are
excluded. The legacy airliner's cabin fittings are batched separately from exterior fittings.

PNG swatches in this directory are canonical source inputs. Aircraft source bundles carry
byte-identical copies of only their used recipes, and their GLBs embed those images so each
model remains portable. Images are shared by materials within each GLB; this does not promise
GPU texture sharing between independently loaded aircraft.

## Regeneration and review

```sh
node --input-type=module -e 'import {writeCockpitFinishLibrary} from "./packages/entities/scripts/aircraft/cockpit-surfaces.mjs"; await writeCockpitFinishLibrary();'
node packages/entities/scripts/generate-aircraft.mjs --ids=cessna-172s,baron-g58
# Standalone models: p-51, oh-6, airliner
node content/entities/source/aircraft/p-51/models/generate.mjs
```

Run these from the repository root. Import changed masters through `molen asset import`,
verify the sidecars with `molen asset inspect --verify`, and refresh the entity catalog with
`node packages/entities/scripts/generate-models.mjs`. Use the targeted tests
`cockpit-surfaces.test.mjs` and `aircraft-interactions.test.mjs` with current package builds.
The [cockpit gallery](../../../../packages/entities/scripts/COCKPIT-GALLERY.md) includes
finish filtering and detailed panel/quadrant views. Batch evidence is in
[COCKPIT-MATERIALS.json](../COCKPIT-MATERIALS.json); bulk captures stay in ignored `.artifacts/`.
