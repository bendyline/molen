# N0346 — Vilnius Cathedral and bell tower review

Reviewed 2026-10-14 against current source/runtime bytes. Accepted for the recorded medium-fi exterior and approximate geographic scope.

![Molen summary preview](preview.png)

## Built result

Inspected all 11 final portable/source-terrain views. Individual six-column west portico with real open bays, closed recessed central door, selected niche figures/relief fields, triangular pediment and three roofline figures/cross, open north/south galleries, long gray nave roof, paired rear domed chapels/open lanterns and detached staged bell tower/clock/dark spire are present. Column bases meet their platform. Corrected the obstructed portico and summary cameras so the detached tower no longer hides the facade.

Individual medium-fi cathedral and mapped detached bell exterior from two useful inspected pictures and standard PMTiles/DEM. Map parts control 20m roof/dome tops,14m galleries,16m front columns,17m chapel bodies,24m lanterns,25m front cross,15/24/36m bell stages,57m spire and 59m finial. Eaves, column taper/capitals, upper tower stage roles, selected relief/figure/niche/clock geometry, roof profiles and stairs are estimates. The upper bell uses the approximate mapped faceted plan. Side/rear glazing is selected surface detail. Exact sculpture/carvings,full interiors,adjacent palace/square monuments and certified walking excluded. High shadow corner artifacts and physical phone/laptop timings remain limitations.

## Shared materials and placement

Inspected all 11 final shared-material/geographic views. Five existing 256-square graphs provide lime plaster, raw/weathered limestone, standing-seam metal and wood. Colors are linear tints, UVs metric and glazing flat blue-gray. Each graph reads once. Unloading leaves zero live model geometries and restores ground. Flat placement checks cathedral/tower spacing against the mapped plan; source heightmap views complement coarse contact. Ground colors are diagnostic.

Retained exact-QID way4870323 and 74 current cathedral/bell controls preserve the approximately 73x60m cathedral/gallery envelope, detached 14.3m bell base and spacing about 70m west/21m south. Native-X faces the western six-column portico and native+X the rear pair of chapels, at heading 0.000845732951rad. Raw transforms match without overall rescaling. The viewer's actual footprint functions pass 24 checks across all six GLBs: both cathedral and detached bell are covered, while the neighboring palace and intervening square are not. Standard DEM datum 96.258140m and estimated 2.0m floor clear sampled footprint peak 1.632m. Foundation follows coarse terrain; exact square/entry thresholds and walking fit remain approximate.

Inspected all 27 final Earth-lighting views: Economy/High, noon/late, three distances, silhouette, six details, four matched whole-model levels and four transitions. Skyline retains open six-column portico and galleries, nave, rear chapel domes and detached tower/spire. District adds shared textures, recessed closed door, selected niche/figure fields, frames and flat bell/lantern panels. Street opens belfry/lantern arches and recesses niches; closeup refines columns, curves, mullions and figures. Whole-model cameras retain both structures; closer details crop intentionally. Two additional matched Economy/High skyline views confirm diagonal marks near front gallery corners are shadow artifacts, not stray geometry; those High shadow marks remain a rendering limitation. Detail changes are visible. Procedural neighbors are synthetic context, not local mapped buildings.

## Browser budgets

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 830 | 87324 | 1 |
| district | 3776 | 364836 | 6 |
| street | 11186 | 1067236 | 6 |
| closeup | 16272 | 1600000 | 6 |

Skyline plus district: **452160 bytes** of geometry. Source master: **1956440 bytes / 16272 triangles**. Five graphs cached separately; no embedded images. Initial geometry excludes graph definitions/texture generation. Separate POSITION/NORMAL streams have equal CPU/GPU buffer totals. Physical device timings pending.

## Verification

- Exact targeted source reproduction with --ids=N0346 --check; source/import/derivative/review hashes match.
- Six GLBs pass Khronos with zero errors, warnings or embedded images. Four browser levels meet triangle/draw/download budgets.
- All 74 current map controls,retained exact-QID outline,signed frame and standard DEM match. Six outputs retain the mapped 59m bell finial above the floor.
- **322 imported probes** pass: portico/gallery gaps,18 column shafts/front platforms,nave/portico/gallery/chapel roofs,lantern floors,belfry floor and spire;closed door recess and street+seven belfry/sixteen chapel-lantern openings.
- **24 current viewer footprint checks** cover both modeled buildings while retaining the neighboring palace and intervening square. Checks bind all six GLB hashes.
- Five material graphs read once; unloading disposes geometry/restores ground.
- Source inventory/schema,map-frame and medium-fi readiness bindings pass.
- Scene validation and 30-tick simulation pass: sha256:daa8cf09c2aba622f7f7a13302f82e846e3829d2543fde2052736f67441aaf07.
- Inspected **49 standard current frames**: 11 portable,11 shared/placement,27 medium-fi;plus two matched shadow diagnostics. Reports retain camera/path/hash evidence. Bulk images remain local/ignored.

Source hash: sha256:5d0610eeb4bfd6bba20e7649b7affcfd672555baba4533aab6fb60cd0ae81b80. Runtime hash: sha256:e6f6db3d0d9b1cfef19b6e058cbf50782edf7cb49f7f65e4e672f69bb3e928c7. Input hash: sha256:cc8cd3d292aeb2dd4b6e3ff29cbd67f8601ab22c8122cfb2872d68223b09da5c.

Commands: targeted generate/import/LOD;capture-next-1000-models.mjs --ids=N0346 --reflections --antialias --fit-shadows;capture-landmark-library.mjs --ids=N0346 --reflections --adaptive-clipping --bounded-placement;capture-medium-fi.mjs --ids=n0346_vilnius_cathedral --reflections;molen validate;molen sim run --ticks 30 --hash. No repository-wide engine suite/audit or full source rebuild repeated;next routine source checkpoint follows N0359.

## Limits

- Current cathedral parent is approximately73x60m including lateral galleries/chapels;the detached14.3m bell base sits about70m west and21m south of the cathedral anchor. Current parts give20m main roof/front roof/chapel domes,14m galleries,16m front columns,17m chapel bodies,24m chapel lanterns and25m front cross. Bell parts give15m round base,24m lower faceted stage,36m belfry,50m clock/upper roof control,57m spire and59m finial. Internal stage roles are photo-led estimates:16.8m nave eave,16..17m front entablature,17..20m pediment,17..20m chapel domes and19.8..24m lanterns;bell belfry24..36m,clock stage36..43m,spire43..57m. Column taper,capitals,openings,selected figures/relief fields and thresholds remain approximate;map heights are not a survey.
- Standard DEM datum 96.258140m;estimated floor 2.0m clears sampled footprint peak 1.632m and perimeter -1.95..1.45m. Foundation follows coarse terrain. Exact plaza/portal thresholds remain approximate;no independent survey or certified walking.
- Two useful exterior pictures and standard map/terrain guide this individual medium-fi cathedral/bell exterior. Column taper/capitals,selected figures/relief fields,niches and clocks are simplified. Upper bell uses the approximate mapped faceted plan. Side/rear glazing is selected surface detail;full interiors,exact sculpture/carvings,adjacent palace/square monuments and certified walking excluded. Physical phone/laptop timings pending.
- Skyline preserves six-column open portico,open side galleries,long nave,two domed chapels and detached staged bell tower/spire. District adds shared graphs,closed recessed central door,selected niche fields/figures,frames,flat bell/lantern openings and clocks. Street opens actual belfry/lantern arches and recesses niches;closeup refines columns,curves,mullions and selected figures. Detail changes remain visible.
- High-quality shadow rendering shows diagonal corner marks in matched views; Economy with identical geometry is clean. Exact physical device performance remains unmeasured.

Readiness accepts this exterior scope. The 1,000-candidate goal remains incomplete.
