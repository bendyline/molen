# monza_cathedral — Monza Cathedral review

Reviewed 2026-10-16 against current source and runtime bytes. Accepted for the medium-fi exterior and approximate horizontal placement. Internal height partitions, hidden roofs and exact host-ground joins remain approximate.

![Molen summary preview](preview.png)

## Built result

The individual model has a pale and gray-green striped west marble screen, stepped parapet, six open Gothic pinnacles, central spoke rose, four smaller oculi, pointed lights and a recessed portal beneath an open projecting porch. The brick church has closed red tiled roofs, a raised nave, arched clerestory, rounded eastern end and green-roofed octagonal crossing loggia. Its northwest campanile carries a clock field, open belfry, four pediments, dark cap, small lantern and finial.

The review corrected front/body occlusion, roof-hidden clerestory, a side light behind the campanile, loggia openings that stopped before the inner wall, distant pinnacle gaps and a footprint stamp that could hide a neighbor.

## References and fit

Two photographs were actually inspected: [Albertomos, 2010](https://commons.wikimedia.org/wiki/File:MB-Monza-Duomo-facciata-a-vento-campanile-tiburio.jpg), showing the upper southwest front, campanile and crossing; and [Giorgio Pallavicini, 2020](https://commons.wikimedia.org/wiki/File:Monza,_Duomo.jpg), showing the full west front and campanile. They are linked references, not redistributed textures. Placement uses the standard viewer PMTiles and DEM.

All **16 current map controls and 124 raw points**, their properties, and the earlier reference-only record remain in the source. The main footprint **35184421893277** has a same-ID multilingual POI named “Duomo di Monza” / “Monza Cathedral.” The northwest campanile, western Piazza del Duomo and pictures establish the association and facing. This does not assert a newly proven exact Wikidata-tagged way match.

Anchor **[9.27567, 45.58359]** is retained. Heading **0.06016824725424221 rad** comes from the western edge; facing uncertainty is approximately 3°. Native +X points east to the choir, −X west to the facade and square, −Z north to the campanile/museum, and +Z south. There is no horizontal rescale. The northern museum/sacristy and neighboring town ranges remain host content. Local subdivision preserves UVs while limiting conservative footprint stamps along the attached southern low range.

Mapped tags retain their documented interpretations: low body/roof **18/27 m**, front **28/32/36 m**, pinnacle tips **27/35/40 m**, campanile stages **62/72/75 m**, and crossing **35 m**. The final **79 m** tower finial, **37.5 m** crossing lantern, **0.55 m** floor and internal stage/roof/door splits are picture estimates. They are not independent surveyed dimensions.

Standard DEM datum is **169.854015 m**; selected-control perimeter samples range from **−4.63 to +0.89 m** relative to it. Footings cross Y=0 and extend below samples. No terrain flattening or road replacement is used. Exact pavement/door joins, base clipping, absolute altitude and walking remain unverified.

## Shared surfaces

Six existing **256²** material graphs supply brick, ashlar, continuous limestone, ceramic tile, standing-seam metal and plain wood. The pale and green facade bands use the **same ashlar graph**, differentiated by linear vertex tint. The model uses metric UVs, flat architectural normals and local blue-gray PBR glazing. There are **zero embedded images**, private facade maps, photograph textures or baked lighting. Shared captures verify one read per graph and zero live model geometries after unload.

## Four browser levels

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| Skyline | 954 | 98,960 | 1 |
| District | 3,938 | 344,492 | 7 |
| Street | 10,567 | 898,156 | 7 |
| Close-up | 13,953 | 1,226,360 | 7 |

Initial skyline plus district geometry totals **443,452 bytes**. The detailed source master is **1,678,588 bytes / 13,953 triangles**. Download figures exclude graph definitions and runtime texture generation. POSITION/NORMAL streams are separate; CPU and GPU reservations match.

Skyline retains the stepped front, six pinnacles, porch, tall open-stage tower, green crossing and irregular red-roofed church. District adds shared stripe courses, facade and side-window rhythm, clock and simplified belfry/loggia. Street adds recessed openings, rose spokes, pilasters, cornices and clerestory. Close-up refines the blind arcade, clock ticks and sparse tracery. Distant omitted bands, clock and extra lights are intentional. Regional palazzo neighbors are review fixtures.

## Verification

**49 final frames were inspected**: 11 portable/source-terrain, 11 shared/geographic, and 27 medium-fi views covering Economy/High, noon/late, three distances, a texture-free silhouette, six details, four matched whole LODs and four transitions.

Six Khronos validations report zero errors, warnings and images. **302 actual geometry probes** check roof closure, finial height, belfry/loggia/porch air and recessed door/glass backing. **132 actual viewer-footprint checks** cover the 16 controls and preserve four neighbors, the west square and south street. Source, import, LOD, input and capture hashes, the individual recipe, source inventory/schema, targeted byte reproduction, scene validation and 30-tick simulation pass.

- Source: `sha256:a7a0e3036003fe98c61b4488738c7cc9728f540069f49a00973f6cc35404cd03`
- Runtime: `sha256:54e34073db47dbbabf05dab79b71697fe87c68d9326cab18e381646f66a9c522`
- Model input: `sha256:919cc2a25c90fbd2c5ff4c56e11fa734ab63790cac9163cf4d59793ded5d830d`
- Simulation: `sha256:fe0bd2a421320e69b2207a71bd7a95d4bdedbef6ea42072b57eb0a57612acd72`

Commands: targeted generate/import/LOD/register-landmark-previews with `--ids=monza_cathedral`; generation `--check`; portable captures with reflections, antialiasing and fitted shadows; shared captures with adaptive clipping/bounded placement; medium-fi captures; scene validation and 30-tick simulation. Bulk images stay ignored. Next routine full source checkpoint: **new_cathedral_linz–st_stephans_cathedral_passau**.

## Limits

Fine saints and other sculpture, detailed tracery, glass artwork, inscriptions, the freestanding plaza column, complete interiors/bells and engineering are excluded or simplified. Hidden roof/chapel partitions, current finish, exact ground joins and physical laptop/phone timing remain unverified. This review accepts the stated exterior and approximate horizontal scope. The 1,000-candidate project remains incomplete.
