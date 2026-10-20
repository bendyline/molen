# N0412 — Al-Masjid Al-Haram

Reviewed2026-10-16 against current model bytes. Accepted for the stated medium-fi exterior and approximate horizontal fit. Nominal map heights,fine architectural profiles and terraced bases do not establish surveyed construction or exact ground contact.

![Molen summary preview](preview.png)

## Built exterior

Inspected all11 current portable views including the1024×640 summary. Three mapped pale mosque wings,old Mataf ring and open-sky marble court;individually oriented black/gold Kaaba,low Hatim wall and small Maqam Ibrahim;long Sai gallery,stepped roofs,eight principal roof domes,roof pavilions and thirteen mapped minaret groups. Selected arched fields have real recesses,others are draw-limited facade fields. Dated pictures guide broad architecture;newer-wing fine plans/current finish remain approximate. The old-campus ground replacement removes the initial DEM obstruction of the Mataf. Newer-wing terrain still produces visible undulation/base burial;exact joins unverified.

## Shared surfaces and browser levels

Inspected all11 current shared/geographic views. Five existing256² marble,limestone,painted metal,canvas and bronze graphs;seven merged groups including local blue-grey glazing. Marble is reused for walls,roofs and paving;canvas abstracts the Kaaba cloth,bronze the gold bands/caps. No invented Arabic writing. Linear tints,metric UVs and flat architectural normals;zero embedded images,bespoke facade bitmaps or baked light. Graphs read once;unload leaves zero live model geometries. The real visible-model old-mosque cutout opens while visible and restores on hide/unload. Geographic images use flat terrain and cannot verify exact site levels.

| Level | Triangles | Bytes | Draws |
| --- | ---: | ---: | ---: |
| skyline | 941 | 92,976 | 1 |
| district | 3,826 | 334,392 | 7 |
| street | 15,878 | 1,390,456 | 7 |
| closeup | 50,811 | 4,699,792 | 7 |

Initial skyline plus district geometry: **427,368 bytes**. Source master **7,658,092 bytes /63,782 triangles**;imported master **7,657,452 bytes**. Shared graph definitions/runtime texture generation are additional. Five shared256² graphs,seven groups,zero embedded images.

Inspected all27 current medium-fi views:Economy/High,noon/late,three distances,silhouette,six details,four matched whole levels and four transitions. Levels941/3826/15878/50811triangles. Skyline keeps the three wings,open-sky court/black Kaaba,principal domes and all thirteen minaret positions;radial shafts/caps and central roof steps are deliberately coarse. District adds shared surfaces,sparse facade fields,stepped roofs,more minaret bands,Kaaba gold band/Hatim/Maqam. Street adds selected recessed arches,minaret lantern columns/trim and roof pavilions. Close-up/master refine curves,bays,mullions and balcony stages. Corrected inward-facing radial surfaces and coplanar Kaaba bands. Synthetic neighborhood style and ground fixture are review context,not a site survey. Physical phone/laptop timing unverified.

## Geographic fit and terrain limits

Retained relation/1472531 /Q428858 identifies Al-Masjid Al-Haram. Current standard viewer PMTiles whole52776559605779 has three campus polygons and a courtyard hole; 609 selected parts plus separately mapped Kaaba35184476003401,Hatim35184688000726 and Maqam Ibrahim35184845390211 are retained. The same campus is one asset; separately authored N0142 Abraj Al Bait remains excluded. Anchor[39.824134536,21.424422395] and heading−1.297856525426rad retained without horizontal rescale. Native+X south-southeast toward the old Mataf/Kaaba and clock-tower side,−X north-northwest toward the expanded outer wing,+Z west-southwest. Pictures and map control signed facing;approximate3° uncertainty. Map heights are nominal:outer relation21m;central lower hall35.5m/upper roof42m,central dome54.5m with lower51m control,four smaller domes48m/twelve roof pavilions46m;old Mataf21m,Sai30m with34m roof blocks;C-shaped inner gallery roof9.5m;south hall21m with33m domes. Nine old minaret groups end84.3m and four newer groups137.5m. Retain all bands,including inconsistent min_height89/height84.3 tips,but never render inverted solids. Estimated coherent radial profiles,lantern columns,balcony parapets,caps and finials replace tiny map ornament boxes. Kaaba15m with cloth/gold bands at8.75/11.75/14.6m;Hatim1.23m,Maqam2.5m. Fine architecture and untagged outer-wing/south-hall heights are estimates. Retained Wikidata137.5m height lacks linked reference URLs and is only a consistency hint. Standard viewer DEM datum324.890903m. Main perimeter ranges-28.68 to37.44m relative to the anchor. Separate wing floors 20.460/-3.702/-30.065m use representative coarse samples plus0.5m;the old court sample is at the Kaaba. These are approximate terraces,not surveyed courtyard levels. Adaptive foundations crossY=0 and extend to retained ground. Height bands are relative to each wing floor;connector profiles are approximations. A visible-model ground cutout follows the mapped old-mosque outer polygon,with model-owned marble paving at its declared floor;this prevents coarse DEM from covering the Mataf and old wings. The review heightmap represents that replacement with a6.5m grid/7m edge transition;the original unmodified DEM grid is retained in pmtiles-fit.json. Newer wings retain coarse terrain and may show base burial. Exact altitude,base/road/court contact,steps,thresholds and walking remain unverified. No broad terrain flattening or road replacement. All4962 actual viewer-footprint checks cover613 retained controls,including every component polygon,and preserve170 separate neighboring buildings at all six source/runtime/LOD representations. Tests retain the actual separate GLB primitives so the viewer triangle sampling is represented. Refined distant roof tessellation and retained contour points near four close hosts prevent earlier false building replacement. Approximate horizontal fit and the Y=0 anchor convention accepted. The mapped old-mosque polygon has a localized ground cutout and model-owned paving;it restores when the model is hidden or evicted. No road replacement. Exact levels,outer ground joins,thresholds and walking remain unverified.

The original DEM grid is unchanged in pmtiles-fit.json. The source terrain-review heightmap applies the declared localized old-mosque ground replacement;it is not an unmodified survey. Newer-wing undulation/base burial remains visible. Exact outside-road/court/base contact and current restoration finish remain unverified.

## Verification

**49 current frames inspected;280 actual front-side geometry checks;4,962 viewer-footprint checks.** Six Khronos validations have zero errors/warnings/images. Source byte reproduction,scene validation,30-tick simulation and source/import/LOD/input/recipe/capture-image/report/shared graph bindings pass. Graphs read once;unload and ground-cutout restoration pass. Full source checkpoint remains N0410–N0427.

Source: `sha256:f99d1e9048db4d103bd2b5a957e624424c367961ac178164b5b3f71f978a8025`

Runtime: `sha256:c90c50a538157a404d4423731fc46a76831d7abe8a146f8e4ff6bc51d296e3b3`

Input: `sha256:7018db52a4e934e45dd6e4bf35a94562274098640cd0059b1b95ad19298333e8`

Simulation: `sha256:dc01283f44e1ff0d8314bade3ccbcc311fa0c44a75d668f875cfcabc6e254ea7`

Commands:targeted generate/import/LOD/register `--ids=N0412`;generation `--check`;portable reflections/antialias/fitted shadows;shared reflections/adaptive clipping/bounded placement;medium-fi reflections;scene validate and30-tick simulation. Bulk captures remain ignored.

## Inspected references

[Muhammad Ali Zabar — 2024-09-15](https://commons.wikimedia.org/wiki/File:Masjidil_Haram,_Mekah_Al-Mukaramah,_Arab_Saudi.jpg). CC-BY-SA-4.0. Inspected enlarged inner court: dark Kaaba cloth with gold frieze and door curtain; pale curved Mataf galleries with pointed arches and a thin gold band. The two nearer gate minarets are dark/scaffold-wrapped during construction. Clock tower, cranes and crowds are excluded. Current 2026 finish is not verified.

[Richard Mortel — 2022-10-24](https://commons.wikimedia.org/wiki/File:Exterior_of_the_Grand_Mosque_of_Makkah,_Saudi_Arabia_and_the_Clock_Tower_(52500933887).jpg). CC-BY-2.0. Inspected enlarged exterior: pale tall minarets with stepped bases, long cylindrical shafts, broad octagonal balcony/lantern stages, small upper caps and finials; paired mosque arches and pale stone bands. Green night lighting is not cladding color. Separate clock-tower complex is excluded. This dated picture guides estimated profiles, not a current as-built finish claim.

[Wurzelgnohm — 2012-02-28](https://commons.wikimedia.org/wiki/File:Masjidul-HaramAerialView_(cropped).jpg). CC0-1.0. Inspected enlarged older aerial linked by the retained OSM relation: open polygonal Mataf around the black/gold Kaaba, double arcade galleries, pale roofs with small tan/gold domes and paired minarets. The long Sai gallery is distinct. The northwest expansion is under construction in this older photograph; its present outline comes from current PMTiles. Temporary cranes, crowds and neighboring town are excluded.

## Remaining scope

Individual medium-fi campus exterior from three actually inspected2012/2022/2024 pictures plus standard viewer PMTiles/DEM. Exact relation/1472531 /Q428858,three current whole polygons,609 parts and separate Kaaba/Hatim/Maqam geometry retain4577 raw points/properties,earlier exact-QID whole/tags/facts and named POIs. Nine84.3m/four137.5m minaret groups use coherent estimated profiles instead of tiny band ornament boxes. Inconsistent min_height89/height84.3 tags are retained,not rendered as inverted solids. Nominal heights do not establish surveyed vertical levels. Newer-wing architecture,arcade rhythm,small domes,roof pavilions,balconies,finials and gold fields are abstractions;the2012 aerial does not verify the current expansion. Current construction/restoration finish,carving,inscriptions,interiors,engineering,precise hidden joins and physical-device timing remain excluded or unverified. Arcades are facade fields,not traversable galleries;lanterns have simplified columns and cores. Separate N0142 Abraj Al Bait,other town buildings,temporary construction and crowds remain host content. No bespoke surveys or redistributed photographs.
