# vank_cathedral — Vank Cathedral review

Reviewed 2026-10-14 against current source/runtime bytes. Accepted for the recorded medium-fi exterior and approximate geographic scope.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 final portable/source-terrain views. Buff pointed dome/short drum, tall blind-niche church walls, open tiled roof belfry with smaller column lantern/cone, freestanding double-stage open belfry with sparse pale rails, western clock gateway, northwest pedimented pavilion and four mapped surrounding ranges are present. The low southern range has shallow vaulted roofs. Courtyard paving leaves the mapped garden open. Corrected the roof-belfry footing gap and church-door threshold, removed windows hidden on shared walls, lowered/vaulted the south range and brought skyline geometry inside its budget. Pavilion rosettes, inscription bands and tile edges are abstract fields; exact text/sculpture is excluded.

Individual medium-fi Vank exterior/complex from three useful church/gateway/pavilion pictures and standard viewer PMTiles/DEM. None of the eight current building controls has heights. All dimensions above the floor are estimates: 11.2m church roof,13.3m drum,26.3m pointed dome/27.8m cross,21.5m freestanding belfry,23.2m roof belfry,7.4m gate/28.2m clock-tower tip,8.5m northwest pavilion with pediment,10m museum/7.5m other ranges and 5.5..6.7m south vaults. Dome/roof-belfry centers, wall niches, columns/clock/rails, abstract blue bands, enclosure/paving and room/roof subdivisions are picture-led. The northwest pavilion uses a library-like facade; its exact correspondence/function and the other range facades are unverified. Exact Armenian lettering/tile designs/sculpture, full interiors and forecourt statue/fountain are excluded. Certified walking and physical device timings remain pending.

## Shared materials and placement

Inspected all 11 final shared-material/geographic views. Five existing 256-square graphs provide running brick, raw limestone, ceramic tile, copper and plain wood. Church/dome/cones share warm brick; trim/flat roofs/paving share tinted limestone. Restrained blue tile and alternating pale/blue clock-roof planes carry accents; glass is flat blue-gray. UVs are metric and skyline uses graph mean tints. Each graph reads once. Unloading releases geometry, leaves zero live model geometries and restores ground. Flat placement compares the signed current church footprint; source-terrain views complement coarse DEM contact. Ground colors are diagnostic.

The previously unresolved candidate now has an approximate source-local frame from the retained reference coordinate, named current Armenian Vank Cathedral/museum POIs, eight current building footprints and three inspected exterior pictures. The named site point is about 22m from the reference coordinate. Anchor [51.65575,32.634888888], heading 0.0975156746134511rad: native-X faces the western gateway/freestanding belfry, native+X the main church dome, native-Z the courtyard museum. Raw transforms preserve position/scale. Current church outline and all eight building outlines are retained. Courtyard paving is the recorded approximate enclosure minus the buildings and current mapped garden. All 66 viewer footprint checks retain the eight modeled buildings and preserve the nearby parking/hotel and west plaza. Standard DEM datum 1583.040460m, estimated 0.6m floor and sampled peak 0.205m give approximate contact. Exact-QID polygon matching, precise thresholds/absolute altitude, peripheral building functions and walking fit remain unverified; no road replacement.

Inspected all 27 final Earth-lighting views: Economy/High, noon/late, three distances, silhouette, six details, four matched whole-model levels and four transitions. Skyline keeps the dome, three towers, two main pointed belfry stages, open gateway/courtyard and mapped range masses. It uses four-post rectangular upper-stage voids, a flat south roof and paving that may continue invisibly under roofed buildings; the garden stays open. District adds shared graphs, flat window/closed-door fields, tile/clock/pavilion rhythms, eight-post upper stages and coarse south vaults. Street opens real church/door/pavilion/range recesses and adds sparse rails. Closeup/master refine dome/cone facets, clock marks, window bars, vault profiles and rail cadence. Curvature, aperture, ornament and far south-roof changes remain visible. Matched cameras show the complex; details crop intentionally. Mexican-patio neighbors are synthetic context, not local map buildings.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 982 | 101420 | 1 |
| district | 3307 | 295348 | 8 |
| street | 7244 | 640540 | 8 |
| closeup | 9002 | 800420 | 8 |

Skyline plus district: **396768 bytes** of geometry. Source master: **1132940 bytes / 9402 triangles**. Five graphs cached separately; no embedded images. Initial geometry excludes graph definitions/texture generation. Separate POSITION/NORMAL streams have equal CPU/GPU buffer totals. Physical device timings pending.

## Verification

- Targeted source reproduction: generate-additional-landmarks.mjs --ids=vank_cathedral --check. Current source/import/derivative/review hashes match.
- Six GLBs pass Khronos with zero errors, warnings or embedded images. Four browser levels meet triangle/draw/download budgets.
- Eight raw map plans, named Vank/museum points, current church/multiple outlines, signed frame and standard DEM match. Courtyard difference matches its retained inputs. All six outputs retain the estimated 28.2m top above the common floor. No mapped architectural heights or exact-QID polygon claim.
- **724 imported geometry probes** pass: principal/range roofs, crosses, open belfry shafts/heads, open gateway, roofless courtyard/paving and unfilled garden; detailed niche/closed-door/glazing backing and clear threshold.
- **66 actual viewer footprint checks** pass: eight mapped buildings covered; nearby parking/hotel and west plaza preserved across six outputs.
- Five graphs read once; unloading disposes geometry and restores ground.
- Source inventory/schema, map-frame and medium-fi readiness bindings pass.
- Scene validation/30-tick simulation pass: sha256:911e9587a33066deb593c392e158f76007922cc03f00e2efbfcda6545d719f88.
- Inspected **49 current frames**: 11 portable,11 shared/placement,27 medium-fi. Reports retain paths, cameras and hashes; bulk views stay local/ignored.

Source hash: sha256:a4e61d237c228b33439c7dd2835dd249280107b87008a821fe7124a17903064a. Runtime hash: sha256:ff8ff4bb4f63e708a039331617f86b7e25471526e3a96edfc1349b642ad508c4. Input hash: sha256:ea7462e3dcee903eb41ee7ae46aad3f21b092b199ae9fe51e15fce748cdf3adb.

Commands: targeted generate/import/LOD; capture-structure-models.mjs --ids=vank_cathedral --reflections --antialias --fit-shadows; capture-landmark-library.mjs --ids=vank_cathedral --reflections --adaptive-clipping --bounded-placement; capture-medium-fi.mjs --ids=vank_cathedral --reflections; molen validate; molen sim run --ticks 30 --hash. No repository-wide engine suite/audit or full source rebuild repeated; next routine source checkpoint follows transfiguration_cathedral.

## Limits

- Eight current unmodified PMTiles building plans retain the approximately23.5x20m church,6x6m freestanding belfry,western gatehouse/northwest pavilion and four surrounding ranges. Named Armenian Vank Cathedral POI is22.16m from the retained reference coordinate,and the current museum POI lies in the north range. The previously unresolved heading is derived from the church long wall and checked against the southwest panorama/western gate picture. No map building has height values:all architectural heights and internal subdivisions are picture-led estimates. No exact-QID polygon match or independent survey claimed.
- Standard DEM datum 1583.040460m;estimated common floor 0.6m clears sampled compound peak 0.205m and building perimeter -3.27..0.07m. Foundations follow coarse terrain. Exact courtyard/gate thresholds,absolute altitude and certified walking unverified;no independent survey.
- Individual medium-fi exterior from three useful church/gateway/pavilion pictures and standard PMTiles/DEM. All heights,main dome/drum/roof-belfry positions,blind niches,openings,clock/gate/upper columns,pale rails,peripheral roof/room subdivisions and courtyard/boundary are picture-led estimates. Northwest pavilion uses a library-like facade;its exact map correspondence/function and the other range facades are unverified. Exact Armenian lettering,tile designs/sculpture,full interiors,forecourt statue/fountain and certified walking excluded. Physical device measurements pending.
- Skyline preserves principal masses,dome and open belfry/gateway voids with coarse piers/four-column upper stages. District adds shared graphs,flat window/closed-door fields,blue tile borders,clock/pavilion rhythms and eight-column upper stages. Street adds actual church/door/pavilion/range recesses and sparse belfry rails. Closeup/master refine dome/cone facets,clock ticks,mullions and railing cadence. Changes in curved profiles,openings and ornament remain visible.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
