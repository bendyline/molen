# kronborg_castle Kronborg Castle — reviewed medium-fi preview

Reviewed2026-10-11. **64final images actually inspected**:16portable,16shared-material and32medium-fi.

## Source and repaired geometry

Actually inspected64 final images:16portable,16shared-material and32medium-fi. Four continuous Renaissance wings surround a paved open courtyard. Distinct59m Trumpeter with two open lanterns,flat Cannon tower,three smaller corner spires,four stair turrets,scrolled gables,chimneys and chapel windows remain legible. Dedicated low north-vault image looks through the true11.7m-deep opening into the courtyard; paving continues through it. Lower court view shows no missing wing or hovering floor. Fresh museum courtyard photograph confirms pale carved sandstone,dark main roofs,shuttered gables and open gate. Museum plan and2021south-west aerial establish tower corners and surrounding grass earthworks. Rejected old filled fortress platform: reviewed version has narrow masonry edges,buried occupied foundations and no own castle hill. Turntables are small because they cover the complete214m extent;feature views supply detail.

Original detailed master remains exactly reproducible from `packages/worldgen/scripts/kronborg-castle-model.mjs#kronborgStudy.build`:337000triangles/28246264bytes at `sha256:19d963e651b26285ce37f136aac82dd41fe21fb689ca37b4cd863a8501e18e9a`. Reviewed independent geometry lives in `kronborg-runtime-model.mjs`. Generate only this ID with `node packages/worldgen/scripts/generate-signature-towers.mjs --ids=kronborg_castle`,import it and generate its source-local browser levels.

Six common granite,brick,sandstone,copper,timber and painted-metal graphs supply shared metric texture detail;opaque PBR glazing is the seventh near material. Sandstone also serves light trim,and painted metal supplies the small gold-tinted finials. Brown roofs and green domes share copper graph with different vertex tints. Skyline bakes common graph linear means into one draw. All6GLBs contain0embedded images. Current shared fixture reads each graph once and unload leaves0model geometries. Shared sandstone and copper simplify exact weathering,replacement patches and carved relief;no copied photographs or duplicate bitmap library.

## Browser levels

|Level|Triangles|Bytes|Draws|
|---|---:|---:|---:|
|skyline|860|69060|1|
|district|3472|271528|6|
|street|11674|901580|7|
|closeup|22120|1692648|7|

Actually inspected32final frames across noon/late light,economy/high settings,11architectural cameras,whole-model four-level comparison and4transitions. Near levels retain window frames,scroll gables,chimneys,open tower lanterns,Cannon rail and complete north passage. District groups openings and retains all4wings,court,tower positions and narrow perimeter. Skyline preserves the castle silhouette and open courtyard at860triangles;it omits small stair turrets and perimeter walls rather than exceeding the1000triangle budget. Synthetic surrounding houses and flat ground in these images are display context,not real mapped neighborhood or terrain proof. Late light produces expected cast shadows without a disappearing wing.

skyline:860triangles/69060bytes/1draws; district:3472triangles/271528bytes/6draws; street:11674triangles/901580bytes/7draws; closeup:22120triangles/1692648bytes/7draws. Initial skyline+district340588bytes. Reviewed source1842988bytes,import1842356bytes. Original28.25MBmaster staysindependently reproducible. Physical device timings remain unmeasured.

## Signed placement and limits

Fresh exact-Q189358 relation1588209 and13 component ways agree with retained source vertices within1mm. Native+X5.043deg points north;+Z95.043deg points east. Mapped lighthouse node1400918158/Q20042645 fixes north-east corner,chapel fixes south-east and the flat Cannon tower lies south-west; signed entrance points north. ModelY0 is reconstructed courtyard floor,Trumpeter top59m above it. Site absolute datum is not claimed; CBS62m above water implies3m courtyard-to-water,not a survey. Occupied walls extend4.8m below the relative floor; curtain walls are narrow masonry with estimated1.2m crest. Ground-contact policy uses courtyard-relative host terrain. No land plinth,whole-precinct replacement,moat excavation or synthetic ground presented as measured Danish DHM. Fresh13feature comparison is within0.65mm. ExactQ189358 relation1588209,NE lighthouseQ20042645node1400918158 andSEchapel establish a signed frame with+X5.04235deg/+Z95.04235deg. Main outline envelope includesopen space and does not excavate or replace the precinct. Reviewed placement is courtyard-relative and remains preview eligibility;not an as-built or survey assertion. Actual Danish DHM terrain fit has not been measured.

Actual reference pixels: museum [courtyard](https://kronborg.dk/en/experiences/the-castle-courtyard),WolfgangSauber2008 [museum plan](https://commons.wikimedia.org/wiki/File:Kronborg_-_Schlossplan.jpg),DavidCastor2021 [south-west aerial](https://commons.wikimedia.org/wiki/File:Kronborg_flygfoto_1,_2021.jpg). [CBS publication](https://research-api.cbs.dk/ws/portalfiles/portal/58852980/Lise_Llyck.pdf),printedpage57,describes59m courtyard/62m water height. Photos/publication remainlinked,notcopiedastextures. [Fresh bounded OSM](https://api.openstreetmap.org/api/0.6/map.json?bbox=12.6190,56.0365,12.6250,56.0410) ©OpenStreetMapcontributors,ODbL. Official [DHM WCS](https://datafordeler.dk/dataoversigt/danmarks-hoejdemodel-dhm/dhm-wcs/) requiresapikey;no numeric Danish DHM data or surveyed datum isclaimed.

Accepted medium-fi exterior reconstruction. CBS describes Trumpeter59m above courtyard/62m above water;courtyard-to-water3m is an inference with no asserted sea or DVR90datum. Other tower heights,window counts,gable scrolls,stair domes,wall crests and roof junctions are proportional estimates. Full crownwork,ravelins,coastal batteries,moat,terrain and interiors are outside this model. Figurative reliefs,clock faces,inscriptions and exact patch weathering are simplified. National DHM requires API-key access and no numeric DHM was obtained. Relative court contact and occupied buried foundations are checked;absolute grade and every curtain-wall/terrain intersection remain unverified. Physical phone/laptop timings remain pending.

## Checks

Three focused tests pass:untouched337000triangle/28246264byte originalmaster independently reproduces sha256:19d963e651b26285ce37f136aac82dd41fe21fb689ca37b4cd863a8501e18e9a;fresh signed13part frame/current source/runtime hashes match;rays keep open courtyard,north passage,continuous paving and occupied foundations at all4levels,andempty fortress areas have no horizontal land platform. Browser levels rebuild byte-identically within triangle,initial-download and8draw limits. POSITION/NORMAL are separate12byte streams. SixGLBs pass Khronos with0errors/0warnings/0images;strict medium-fi findings are empty. Sampled geometry checks do not establish surveyed wall grades,exhaustive manifold quality or navigation interiors.

Current hash-bound approval:[qa.json](qa.json).
