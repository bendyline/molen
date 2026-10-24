# basilica_of_saint_nicholas — Basilica of Saint Nicholas review

Reviewed 2026-10-15 against current source/runtime bytes. Accepted for the medium-fi exterior and approximate geographic/terrain scope.

![Molen summary preview](preview.png)

## Built result

Inspected all11 current portable/source-terrain frames. Bari's Basilica of Saint Nicholas has a high cream ashlar central gable, sloped shoulders, unequal low north/tall south square west towers and a genuinely open south belfry. Triple west portals have a central triangular prothyron canopy; small paired rounded windows, geometric oculi and restrained blind arches retain its facade. Six deep lower side arcade bays and five groups of three upper gallery fields, separate recessed inner windows/door, tall eastern transept and a flat eastern wall with central barred window are individually authored. Closed an upper shoulder gap above the low north tower; moved side bays clear of the tall tower and corrected arch-surround bands and lowered east blind arches beneath the central window. Fine carvings/statues/text and adjacent town omitted.

Medium-fi exterior from three useful west/south2016 and east2021 pictures and standard viewer PMTiles/DEM only. North arcade/gallery rhythm is inferred. Flat east wall is retained rather than an invented projecting apse. Oculi are shallow framed geometric disks; window/galleria panels and tile/stone textures approximate the photographed material. Exact sculpture/reliefs/inscriptions, tiny Romanesque carving, complete interior/crypt, adjacent town fabric, cars/parking/railings, surveyed paving/steps/thresholds and certified walking excluded. Actual facade recesses/side cavities and open belfry are geometry, with flat dark/glazing backing where appropriate. Physical laptop/phone timing remains pending.

## Shared materials and placement

Inspected all11 current shared/geographic frames. Four existing cached256-square ashlar, limestone, flat tile and plain wood graphs serve six merged groups with cream/muted tile linear tints, metric UVs and flat normals. Glazing, oculi and gallery cavity backing use geometric flat PBR colors. No embedded images, new bespoke textures or baked shadows. Each graph reads once. Unload disposes geometry, leaves zero live model geometries and restores ground. Signed top placement follows the mapped basilica and unequal western tower projections. Source-terrain views show approximate foundations; flat diagnostic ground can mask below-datum footing. Ground bands are fixtures.

Exact-QID way417998763/Q550514 matches current PMTiles main35184790087595. Its13-vertex raw outline/tags retain absent height/min_height; the current extract has no separately mapped basilica parts. Anchor[16.870169215,41.130326863], heading-0.06826997932098744rad follows the southern long edge, signed by west triple portals/unequal towers and the eastern flat wall. Raw map geometry rotates rigidly without rescale. Body/tower/nave/transept subplans are explicit picture-guided subdivisions and approximations. All vertical dimensions are picture estimates: nave eave25/ridge29.8m, aisle wall20.5/join24m, transept eave24/ridge29m, north tower18.8m and south27.5m. All30 actual viewer footprint checks cover the main footprint while preserving three neighbors and a west-front patch across six outputs. Standard DEM datum10.557088m, display offset0.4m, perimeter-1.28..0.88m. Side foundations follow terrain; doors use floor+0.2m estimates. Exact plaza paving, doorway thresholds, entry steps, cut/fill, absolute altitude and walking remain unverified; entry steps are not modeled. No road replacement or global flattening.

Inspected all27 current Earth-lighting frames: Economy/High, noon/late, three distances, silhouette, six detail crops, four matched whole-model LODs and four transitions. Skyline preserves unequal towers, open south belfry and stepped nave/transept/aisle roof form. District adds shared textures and flat facade/gallery fields. Street opens side arcade/gallery cavities and recessed window/door fields, with simple round bands and canopy. Closeup/master retain finer curved surrounds and east window bars. All four whole-model cameras include the entire church. Synthetic cottage neighbors/context bands are review fixtures. The inferred north facade, simplified Romanesque carving and repeated gallery rhythm are explicit medium-fi approximations.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 979 | 99184 | 1 |
| district | 1824 | 162912 | 6 |
| street | 12328 | 1006960 | 6 |
| closeup | 23190 | 1926984 | 6 |

Initial skyline plus district: **262096 bytes** of geometry. Master: **2786436 bytes / 23190 triangles**. Four cached shared 256² graphs, zero embedded images. Geometry bytes exclude graph definitions/texture generation. Split POSITION/NORMAL streams with equal CPU/GPU totals. Physical device timing pending.

## Verification

- Targeted byte reproduction, source/import/LOD/input/review hashes, recipe index and source inventory/schema match.
- Six Khronos validations: zero errors/warnings/images; four browser budgets pass.
- One raw main control with absent height/min_height, signed frame, retained estimated subplans and standard DEM match.
- **1562 geometry probes** and **30 actual viewer footprint checks** pass.
- Shared graph read-once/unload and hash-bound placement/medium-fi reviews pass.
- Scene validation and 30-tick simulation pass: sha256:ed33d53145ec5d7eed4e00d912669f209f6b34fea6d9e30de5972df447fc0bd2.
- Inspected **49 current frames**: 11 portable, 11 shared/placement, 27 medium-fi. Cameras/paths/hashes retained; bulk images ignored.

Source hash:sha256:4b68775d5a98bf9e424f78b8a2e6423bbbcfd42d17e7e76810b9126c626b6da4. Runtime hash:sha256:e369135806f57a78a3d5091405c4d3f752fc714a4ba7035fff31a467d97730ea. Input hash:sha256:6ee0f305d91696633564af0a0de9582a3425e0525113a4de993451492b9d9167.

Commands: targeted generate/import/LOD/register-landmark-previews --ids=basilica_of_saint_nicholas; generate-additional-landmarks.mjs --ids=basilica_of_saint_nicholas --check; capture-structure-models.mjs --ids=basilica_of_saint_nicholas --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=basilica_of_saint_nicholas --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=basilica_of_saint_nicholas --reflections; molen validate; molen sim run --ticks 30 --hash. Routine full source checkpoint covers ljubljana_cathedral–saint_sophia_cathedral_in_polotsk.

## Limits

- Exact-QID way417998763/Q550514 matches current PMTiles main35184790087595. Its13-vertex raw outline/tags retain absent height and min_height. No surveyed height/width/length is retained. All vertical dimensions are explicit picture estimates: nave eave25m/ridge29.8m, side gallery wall20.5m/roof join24m, east transept eave24m/ridge29m, north tower18.8m and south tower27.5m. Western central/side doors, canopy, arcade/galleries, paired windows and flat east wall follow three inspected pictures. Only subplans subdivide/approximate the raw main envelope; no map rescale. North facade rhythm is inferred from the south. Exact carving, thresholds and roof junctions are not surveyed.
- Standard viewer DEM datum 10.557088m; display offset 0.4m, mapped perimeter terrain -1.28..0.88m. Side-only foundations follow this coarse terrain. Doorways use estimated floor+0.2m and small connecting steps where possible; exact Basilica plaza paving, doorway levels and absolute altitude remain unverified. No global terrain flattening or road replacement.
- Medium-fi exterior from three inspected west/south/east pictures and standard viewer PMTiles/DEM only. North side rhythm inferred. Exact reliefs/statues/inscriptions, tiny carving, interiors, neighboring town fabric, parking/railings and surveyed paving/thresholds/walking excluded. Oculi are framed geometric dark disks. Physical device timing pending.
- Skyline retains stepped roof/tower silhouette and open south belfry. District adds shared surfaces and flat doors/windows/gallery fields. Street opens lower side recesses, upper gallery cavities and door/window recesses; closeup/master refine rounded arch bands, window bars and canopy moulds. Synthetic neighbors are review fixtures.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
