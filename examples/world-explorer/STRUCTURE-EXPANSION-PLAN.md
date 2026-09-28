# World Explorer: 100 new buildings and structures

This is the original 100-target expansion plan. The target list and reference briefs below
preserve its design intent; current production and placement status are maintained in the
[source catalog](../../content/worldgen/source/site-structures/README.md), the
[expansion progress report](../../content/worldgen/source/next-1000/PROGRESS.md), and the
[round review](../../content/worldgen/source/next-1000/ROUND-REVIEW.md).
Authoring is paused for review and cleanup. Imported geometry, visual acceptance and geographic
readiness are separate milestones; a model's folder location does not establish placement approval.

| Concern | Maintained record |
| --- | --- |
| Source bundles and previews | `content/worldgen/source/structure-index.json` and the [geographic gallery](../../content/worldgen/source/places/gallery.html) |
| Imported Molen assets | Sidecars and canonical GLBs under `content/worldgen/assets/places/` and `content/worldgen/assets/reusable/` |
| Asset/project registration | `content/worldgen/project.json` and `content/worldgen/stylepack.json` |
| Visual and geographic review | Each source bundle's capture reports and hash-bound `qa.json`, summarized in the generated readiness ledger |
| Earth placement and category matching | `content/earth/structures/placements.json` and `content/earth/structures/map-rules.json` |
| Procedural building styles | `content/worldgen/structures/catalog.json` |

## Viewer integration

- The default worldgen pack supplies procedural building styles, shared materials, small props,
  and signs. Building outlines and measured heights from terrain semantics drive those styles.
- The Earth adapter queries geographically indexed landmark placements for resident tiles and
  matches reusable models from map classifications such as windmills. Unique named landmarks
  require their own placement records; names alone do not turn arbitrary buildings into them.
- `StructureModelLibrary` preserves authored meshes, UVs and shared PBR materials. Models load
  when needed and release when their last tile is evicted. A generic shell remains available
  while its replacement model loads or if loading fails.
- Authored bridge placements support tile clipping and road replacement. Generic bridge
  geometry covers mapped crossings without an authored model; terrain and bank fit still
  require geographic review for each detailed bridge.
- Hosts supply PMTiles and terrain retrieval. The sample supports Seattle, Bellevue and
  Sammamish; locations elsewhere require appropriate host data to verify their actual terrain fit.

See the shipped [Earth viewer guide](../../docs-src/guide/earth-view.md) for the implemented APIs
and limits.

## Placement contract

The original design contract below describes the intended information, rather than literal
current schema field names. The implemented catalog lives in `content/earth/structures/` and
loads through `@bendyline/molen-earth`; use the shipped guides for its validated schema.

| Field | Purpose |
| --- | --- |
| `id`, `assetRef`, `kind` | Stable identity and model reference; `kind` is building, point structure, or linear structure. |
| `anchor` or `path` | WGS84 position for a point; measured centerline plus section anchors for a bridge. |
| `sourceIds`, `names`, `geometryChecks` | Verified map identifiers and conservative aliases, plus expected footprint/span/height tolerances. |
| `orientation`, `baseElevation`, `dimensions` | Meter-scale positioning. Surface sampling supplies terrain height unless a surveyed value is present. |
| `lodRefs`, `bounds`, `collision`, `credit` | Streaming, culling, walk/drive behavior, and provenance. |

Match source IDs first. Use a name only when a coordinate window, class, and geometry tolerance
also agree. Reject ambiguous matches and keep the normal worldgen building. Use one canonical
site identity across zoom levels; the tile that owns the anchor emits it. A matched building
suppresses only its corresponding generic shell, not neighbors or unrelated parts. Long structures
are clipped or assembled per tile from stable section IDs so loading adjacent tiles cannot duplicate
them. The source road remains navigable and aligned with any bridge deck overlay.

Named editable source bundles live at
`content/worldgen/source/places/<gh2>/<gh3>/<source-key>/`. Imported bundles mirror that geography
at `content/worldgen/assets/places/<gh2>/<gh3>/<source-key>/`, with `asset.json`, `model.glb` and
optional collision data. The geographic folders are two- and three-character geohashes; legacy
entries without reference coordinates use `places/unlocated/<source-key>/`. Coordinates used
for folder organization do not activate a landmark in the viewer.

Reusable urban and infrastructure bundles live under `source/reusable/urban/` and
`source/reusable/infrastructure/`, mirrored under `assets/reusable/`. Generic mapped features
use `source/map-structures/<source-key>/` and `assets/reusable/map-structures/<source-key>/`.
Procedural styles remain in their semantic catalogs.

`content/worldgen/source/structure-index.json` maps source keys to authoring folders. Runtime
asset IDs remain unchanged: `content/worldgen/project.json` registers them to sidecars for
tooling, and `content/worldgen/stylepack.json` lets `stylePackAssetIndex` resolve the same IDs
to pack paths. Import with an exact `--asset-dir` when establishing a custom bundle location;
ordinary `--force` reimports retain the registered sidecar path. Use these mappings rather than
deriving folders from dotted asset IDs. Hosted worldgen content separates shared style metadata
from regional model archives, with archive routes and model instances loaded on demand.

## First three reference assets

| Target | Model brief | Placement and acceptance |
| --- | --- | --- |
| **A01 Space Needle** | 184.4 m overall height (605 ft); tripod legs, tapering core, broad observation saucer, narrow mast. A silhouette should read from both street and skyline distances. Original mesh with restrained painted metal and dark glass; no photographed facade baked into textures. | Point/footprint anchor in a Seattle fixture. Keep its full height even if the mapped footprint is small or split. Compare a near, side, and 2 km skyline view. [Official height](https://www.spaceneedle.com/about). |
| **C01 Golden Gate Bridge** | Model a 1,280 m main suspension span, 343 m side spans, two Art Deco towers, sweeping main cables, suspenders, and deck truss as repeatable sections. Use an original International Orange palette and shared metal/concrete materials. | Match a surveyed centerline and tower anchors in a Bay Area fixture. Preserve road continuity, tower position, clearance and water/terrain contact at both ends. One monolithic stretched GLB is unsuitable. [Bridge district dimensions](https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/). |
| **C02 SR 520 floating bridge** | Model the approximately 2,350 m floating section (7,710 ft) as repeatable longitudinal pontoon/deck sections, side stability pontoons, guardrails, separated path, and distinct transition spans. Do not depict it as a conventional pier bridge. | Use a Seattle/Lake Washington fixture, segmented ownership across tiles, and sampled water level. Inspect deck transitions and silhouette at water level. WSDOT documents 77 pontoons. [WSDOT project booklet](https://wsdot.wa.gov/sites/default/files/2021-11/SR520-Booklet-FB042017.pdf), [WSDOT environmental review](https://wsdot.wa.gov/sites/default/files/2021-09/SR520-Report-FEISExecSummaryFrontMatterChapters1to3.pdf). |

These are stylized, scale-conscious interpretations. Source photographs and third-party meshes
are reference material only unless their licenses explicitly permit redistribution.

## Catalog of 100 targets

`A` and `B` are named building/landmark assets, `C` are bridge assemblies, `D` are resizable
urban building recipes, and `E` are infrastructure recipes. Site-specific assets require verified
anchors; recipes may appear wherever a compatible mapped class and footprint occur. IDs are
stable candidates; confirm spelling and mapped coverage before publishing.

### A. Pacific coast anchors (20)

| ID | Target | Key silhouette/detail |
| --- | --- | --- |
| A01 | Space Needle, Seattle | Tripod and observation saucer |
| A02 | Smith Tower, Seattle | Tapered historic tower and pyramidal roof |
| A03 | Columbia Center, Seattle | Three stepped tower sections |
| A04 | Seattle Central Library | Faceted glass and steel envelope |
| A05 | Museum of Pop Culture, Seattle | Curved metal volumes |
| A06 | Pike Place Market, Seattle | Terraced market block and arcade |
| A07 | Climate Pledge Arena, Seattle | Broad historic roof silhouette |
| A08 | T-Mobile Park, Seattle | Retractable roof and stadium bowl |
| A09 | Lumen Field, Seattle | Two large roof canopies |
| A10 | Pacific Science Center, Seattle | Slender arches and courtyard |
| A11 | Seattle Great Wheel | Wheel, rim, spokes and gondola rhythm |
| A12 | Suzzallo Library, Seattle | Collegiate Gothic massing and entry |
| A13 | Tacoma Dome | Low, wide geodesic dome |
| A14 | Vancouver Harbour Centre | Observation tower above office podium |
| A15 | San Francisco Ferry Building | Long waterfront hall and clock tower |
| A16 | Transamerica Pyramid, San Francisco | Pyramid tower and wings |
| A17 | Salesforce Tower, San Francisco | Rounded taper and crown |
| A18 | Coit Tower, San Francisco | Fluted cylindrical tower |
| A19 | Palace of Fine Arts, San Francisco | Rotunda and colonnade |
| A20 | Oakland Tribune Tower | Historic clock tower |

### B. Global landmark buildings (20)

| ID | Target | Key silhouette/detail |
| --- | --- | --- |
| B01 | Empire State Building, New York | Setbacks and spire |
| B02 | Chrysler Building, New York | Tiered crown and spire |
| B03 | One World Trade Center, New York | Faceted taper and mast |
| B04 | Flatiron Building, New York | Triangular plan and cornice |
| B05 | United States Capitol | Dome and legislative wings |
| B06 | Washington Monument | Obelisk taper |
| B07 | CN Tower, Toronto | Concrete shaft and observation pod |
| B08 | Eiffel Tower, Paris | Open lattice legs and platforms |
| B09 | Arc de Triomphe, Paris | Monumental arched mass |
| B10 | Elizabeth Tower, London | Clock tower and pinnacles |
| B11 | Tower of London | Multi-building castle silhouette |
| B12 | Colosseum, Rome | Elliptical arcades and open center |
| B13 | Sagrada Família, Barcelona | Distinct clustered spires |
| B14 | Sydney Opera House | Layered shell roof forms |
| B15 | Tokyo Tower | Open lattice and observation decks |
| B16 | Tokyo Skytree | Slender taper and stacked decks |
| B17 | Taipei 101 | Repeated tiered tower modules |
| B18 | Petronas Towers, Kuala Lumpur | Twin towers and skybridge |
| B19 | Shanghai Tower | Twisting taper |
| B20 | Burj Khalifa, Dubai | Stepped buttressed taper |

### C. Named bridges and viaducts (20)

| ID | Target | Assembly type |
| --- | --- | --- |
| C01 | Golden Gate Bridge | Suspension |
| C02 | SR 520 Evergreen Point Floating Bridge | Floating pontoon |
| C03 | I-90 Lacey V. Murrow Memorial Bridge | Floating pontoon |
| C04 | I-90 Homer M. Hadley Memorial Bridge | Floating pontoon |
| C05 | Hood Canal Bridge | Floating pontoon and draw span |
| C06 | Tacoma Narrows Bridges | Twin suspension corridor |
| C07 | San Francisco–Oakland Bay Bridge, west span | Suspension |
| C08 | San Francisco–Oakland Bay Bridge, east span | Self-anchored suspension/viaduct |
| C09 | Brooklyn Bridge | Hybrid cable suspension with stone towers |
| C10 | Manhattan Bridge | Suspension |
| C11 | Williamsburg Bridge | Suspension and truss |
| C12 | Tower Bridge, London | Towered bascule and suspension sides |
| C13 | Forth Bridge, Scotland | Cantilever rail truss |
| C14 | Sydney Harbour Bridge | Steel through arch |
| C15 | Akashi Kaikyō Bridge | Long suspension |
| C16 | Millau Viaduct | Multi-pylon cable stayed |
| C17 | Ponte Vecchio, Florence | Inhabited stone arch |
| C18 | Rialto Bridge, Venice | Stone arch with shops |
| C19 | Charles Bridge, Prague | Repeating stone arches |
| C20 | Øresund Bridge | Cable stayed and approach viaduct |

### D. Reusable high-detail urban buildings (20)

| ID | Recipe | Distinct improvement over the current general envelope |
| --- | --- | --- |
| D01 | Curtainwall office slab | Facade mullion rhythm and service core |
| D02 | Stepped glass tower | Real setbacks and crown |
| D03 | Brutalist civic block | Exposed structural bays |
| D04 | Brick loft conversion | Tall industrial windows and roof plant |
| D05 | Residential podium tower | Mixed podium/tower setbacks |
| D06 | Masonry corner apartments | Wrapped corner entry and balconies |
| D07 | Midrise hotel | Repeated rooms and arrival canopy |
| D08 | Open-deck parking garage | Visible floors, ramps and parapets |
| D09 | Hospital campus wing | Large clinical floors and service core |
| D10 | University laboratory | Deep facade and rooftop equipment |
| D11 | Secondary school with gym | Classroom wing and gym volume |
| D12 | Municipal courthouse | Public entry and restrained colonnade |
| D13 | Contemporary museum | Gallery massing and entrance glazing |
| D14 | Urban convention center | Long-span halls and prominent public entrance |
| D15 | Intermodal rail terminal | Multiple platforms, train shed and concourse |
| D16 | Urban bus terminal | Sawtooth bays and canopy |
| D17 | Fuel station with canopy | Pump islands, service building and forecourt |
| D18 | Multistory self-storage building | Repeated storage bays and loading frontage |
| D19 | Airport terminal concourse | Modular gates and long roof |
| D20 | Data center | Cooling plant, blank halls and secure entry |

### E. Reusable infrastructure and civil structures (20)

| ID | Recipe | Geometry/placement driver |
| --- | --- | --- |
| E01 | Cylindrical water tower | Point plus mapped height |
| E02 | Lattice water tower | Point plus mapped height |
| E03 | Ground reservoir | Polygon and terrain fit |
| E04 | Concrete dam | Waterway crossing and crest line |
| E05 | Hydroelectric powerhouse | Dam adjacency and building footprint |
| E06 | Electrical substation | Fenced polygon, repeated equipment |
| E07 | Transmission pylon | Power-line point and line direction |
| E08 | Wind turbine | Point, hub height and rotor heading |
| E09 | Solar inverter field | Solar polygon, rows and access lanes |
| E10 | Cellular tower | Point and mapped height |
| E11 | Lighthouse | Coast point and tower height |
| E12 | Harbor container crane | Quay line and water-facing orientation |
| E13 | Container terminal gantry | Rail/yard line and span |
| E14 | Grain silo complex | Industrial polygon and cylinder cluster |
| E15 | Elevated rail viaduct | Rail centerline and pier spacing |
| E16 | Rail signal gantry | Track centerline and width |
| E17 | Pedestrian overpass | Path crossing and clearances |
| E18 | Road underpass portal | Road centerline and terrain cut |
| E19 | Canal lock | Waterway polygon, gates and basin |
| E20 | Fire lookout tower | Point on elevated terrain |

## Delivery sequence and acceptance gates

1. **Platform and reference three (A01, C01, C02).** Asset authoring is done. Define the catalog schema, matching
   priorities, asset provider path, tile ownership, suppression of matched generic shells, and
   modular bridge placement. Make Seattle/Lake Washington and Bay Area review fixtures. Import
   and visually inspect the three GLBs before marking this gate complete.
2. **10 Pacific coast anchors and 10 bridges (20 total).** Cover the highest-viewed Seattle and
   Bay targets first. Reuse bridge modules, but give each crossing verified tower, deck, and
   transition anchors. Review aerial, shoreline, and drivable views.
3. **20 urban recipes plus 20 infrastructure recipes (60 total).** Use the existing footprint
   generator for resizable buildings. Extend semantic decoding only for source fields actually
   present in the selected terrain packages. Confirm visual variety on an ordinary neighborhood,
   not only the model sheet.
4. **Remaining 10 Pacific anchors, 20 global landmarks, and 10 bridges (100 total).** Add regional
   packages or representative fixtures with attribution before claiming any named place appears
   in situ.

For every asset: editable source or deterministic generator; one self-contained GLB where
practical; meter scale and +Y up; stable material/node names; imported sidecar with hash; neutral
turntable; lit Molen scene with ground/contact shadows; near and distant in-viewer captures;
collision and LOD review. Use shared materials and low-detail substitutes rather than 100 unique
large textures. A small building should usually stay near the existing 1,000–8,000 triangle
target; hero assets need their own justified budget. Bridge geometry is sectioned and culled by
visible span. Record source license and attribution for map data and any reference material.

**Release gates:** no duplicate structure across adjacent tiles or zoom transitions; no generic
building shell beneath a matched landmark; no missing road surface across a bridge; correct
water/terrain contact; no asset fetch until visible; no new browser errors or failed materials;
repeatable visual frames at high and economy quality; and `pnpm all` green before release.
Compare load time, pack download bytes, resident geometry, draw calls, GPU memory and frame time
against the current World Explorer baseline on both desktop and mobile quality tiers.
