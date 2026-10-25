# Pidhirtsi Castle — current model review

Reviewed 2026-10-13 against two inspected north/south aerial pictures and standard viewer
PMTiles/DEM. **Accepted as a medium-fi exterior reconstruction**, with the limits below.
`qa.json` binds the decision to current source, runtime, complete inputs, placement and captures.

## Inspected result

All 49 current frames were inspected: 11 portable/source-terrain, 11 shared/geographic and 27
Earth-lighting/LOD views. The individual mapped palace retains its projecting central bays,
west green/east gray tiered pavilion roofs, steep main roof, dormers/chimneys, pale/rose framed
facades, opposing curved stair arms, north belvederes and U-shaped fortified lower wings.
The southern gate opens through its wing and connects to a bridge-like causeway.

Corrections include rear roof-face ordering, an explicit pane on the short southern bay,
full gate-tunnel depth, joined stair landings and narrower stair curves that leave both pairs
of arcade bays clear. Skyline retains body/roof/courtyard/gate silhouettes and omits window,
stair and rail detail. District uses sparse surface panes, simpler roof tiers and continuous
rails. Street/closeup add recessed glazing, frames, cornices, treads and sparse balusters.

## Browser budgets and shared surfaces

| Level | Triangles | GLB bytes | Model draws |
| --- | ---: | ---: | ---: |
| Skyline | 802 | 66,144 | 1 |
| District | 3,134 | 277,368 | 5 |
| Street | 11,346 | 987,200 | 5 |
| Closeup | 16,626 | 1,466,152 | 5 |

The master has 16,626 triangles and occupies 1,998,416 bytes. Initial skyline + district
geometry totals **343,512 bytes**. All six GLBs pass Khronos validation with zero errors,
warnings or embedded images. Runtime position/normal streams are separate and CPU/GPU upload
accounting matches. Four existing 256² graphs supply lime plaster, weathered limestone,
slate and painted metal with linear tints/metric UVs. Glass uses vertex color. Each graph
loads once; unloading leaves zero live model geometries. No unique bitmap was introduced.

## Geometry and placement

The current main-palace polygon transform, retained exact-QID outline/axis, north garden and
entry/step paths match the decoded standard extract. Fifty-six raw-GLB probes pass: five
open gate/arcade passages with 10 masonry guards, eight recessed panes with 16 masonry guards,
six court/floor checks, six roof-cover checks, four stair/landing checks and outer causeway contact.

Native +X points approximately east; +Z points south toward gate/courtyard. Native Y=0 follows
standard DEM at the anchor (387.1541 m). Picture-led palace/court 3.5 m and wing-top 9.5 m levels
clear coarse ground. North foundations follow the slope and the causeway tapers to the outer
path near native 2.28 m. It is an untagged mapped footway, so bridge-specific road suppression
is not registered. Source-terrain views complement the flat geographic fixture. Synthetic
Bohemian townhouse neighbors and pale terrain bands are review context.

## Reproduce

```sh
node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=pidhirtsi_castle
node packages/worldgen/scripts/import-structure-models.mjs --ids=pidhirtsi_castle
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=pidhirtsi_castle
node packages/worldgen-earth/scripts/register-landmark-previews.mjs --ids=pidhirtsi_castle
node packages/worldgen/scripts/capture-structure-models.mjs --ids=pidhirtsi_castle --reflections --antialias --fit-shadows --force
node examples/world-explorer/test/visual/capture-landmark-library.mjs --ids=pidhirtsi_castle --reflections --adaptive-clipping --bounded-placement --force
node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=pidhirtsi_castle --reflections
```

The 1024×640 summary's complete options are in `capture-report.json`. Bulk views stay local in
ignored folders. Source inventory, recipe discovery, hashes and four LOD bindings pass; the
targeted generator `--check` reproduces the master. The scene validates and simulates for 30
ticks with hash `sha256:e7f893f3b4be6fe242fd03783793f67fcea25a53c0b81dc87111524104fb609a`.

## Limits

All architectural heights are untagged. Outer rampart/bastion outlines, roofs/cupolas, finials,
portal reliefs, facade weathering, stair curves, belvederes and dry-moat/terrain joins are
picture-led exterior estimates. This is not a bare-earth or current condition survey.
Complete interiors, full gardens, exact sculpture and certified walking collision are excluded.
Separate church, estate buildings, town, vegetation and visitors remain host content.
Physical laptop and phone performance measurements remain pending.
